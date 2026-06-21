import config from '../config.js';
import { analyzeHomework, normalizeConfirmedAnalysis } from '../analysis/homeworkAnalysis.js';
import { generateStage1Plan } from '../generators/stage1.js';
import { generateStage2Questions } from '../generators/stage2.js';
import { buildFallbackStage1Plan } from '../generators/stage1Fallback.js';
import { ensureAllQuestionTypes } from '../generators/fallback.js';
import { generateMockQuestions } from '../generators/mock.js';
import { assembleUserModules } from '../adapters/userClient.js';
import { createRunId, writeGenerationArtifacts } from '../debugArtifacts.js';
import { sanitizeTaskPlan } from '../quality/taskQuality.js';
import { auditAndRepairTaskCoverage } from '../coverage/taskCoverage.js';
import { auditQuestionCoverage } from '../coverage/questionCoverage.js';
import { MODULE_CONFIG } from '../questionTypes.js';
import { AnalysisRequiredError, QualityGateError } from '../errors.js';
import { prepareQuestions, renderQuestionsFromTasks } from '../renderers/typedRenderer.js';

export async function generatePracticeService({
  content,
  difficulty = 'level_2',
  targetMinutes = 20,
  confirmedAnalysis = null,
  mode = 'generate',
} = {}) {
  const startTime = Date.now();
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Invalid request: content is required');
  }

  if (!confirmedAnalysis && mode !== 'mock') {
    const analysis = await analyzeHomework(content);
    throw new AnalysisRequiredError(analysis);
  }

  if (mode === 'mock' || config.features.mockGeneration) {
    const questions = prepareQuestions(generateMockQuestions(content), {});
    return buildPracticePackage({
      content,
      questions,
      mode: 'mock',
      startTime,
      publishable: true,
      audit: passAudit(),
    });
  }

  const generationInputs = normalizeConfirmedAnalysis(content, confirmedAnalysis);
  const { requirements, knowledgeScope, phonicsScope } = generationInputs;
  const normalizedConfirmedAnalysis = generationInputs.confirmedAnalysis;

  const stage1Options = {
    requirements,
    knowledgeScope,
    phonicsScope,
    confirmedAnalysis: normalizedConfirmedAnalysis,
  };
  const rawPlan = normalizedConfirmedAnalysis
    ? buildFallbackStage1Plan(content, stage1Options)
    : await generateStage1Plan(content, difficulty, targetMinutes, stage1Options);
  const plan = sanitizeTaskPlan(rawPlan, content, stage1Options);

  const typeCoveredTaskList = limitTasksForInteractiveUse(
    ensureAllQuestionTypes(plan.task_list, plan.knowledge_points)
  );
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements,
    knowledgeScope,
    phonicsScope,
    confirmedAnalysis: normalizedConfirmedAnalysis,
    taskList: typeCoveredTaskList,
    knowledgePoints: plan.knowledge_points,
  });

  if (!taskCoverage.valid) {
    throw new QualityGateError(`Task coverage failed: ${taskCoverage.missing.join(' | ')}`, {
      stage: 'task_coverage',
      coverage: taskCoverage.report,
      missing: taskCoverage.missing,
    });
  }

  const completedTaskList = taskCoverage.repaired_task_list;
  let stage2RepairCount = 0;
  let stage2AiCount = 0;
  let stage2AiFailedCount = 0;
  let generationMode = stage2GenerationMode();
  let publishable = true;
  const localQuestions = renderQuestionsFromTasks(completedTaskList, { content, knowledgeScope, confirmedAnalysis: normalizedConfirmedAnalysis });
  let questions = localQuestions;

  if (generationMode === 'llm_full' || generationMode === 'llm_hybrid') {
    const llmTasks = generationMode === 'llm_full'
      ? completedTaskList
      : completedTaskList.filter(task => config.stage2.aiTypes.includes(task.question_type));

    if (llmTasks.length) {
      try {
        const rawAiQuestions = await generateStage2Questions(llmTasks);
        const aligned = alignStage2Questions(rawAiQuestions, llmTasks, content);
        const aiPreparation = prepareAiQuestionsIndividually(aligned.questions, { knowledgeScope, confirmedAnalysis: normalizedConfirmedAnalysis });
        const preparedAiQuestions = aiPreparation.questions;
        const merged = mergeAiQuestions(localQuestions, preparedAiQuestions);
        questions = prepareQuestions(merged, { knowledgeScope, confirmedAnalysis: normalizedConfirmedAnalysis });
        stage2RepairCount = aligned.repairCount;
        stage2AiCount = preparedAiQuestions.length;
        stage2AiFailedCount = aiPreparation.failedCount;
        if (stage2RepairCount > 0 && generationMode === 'llm_full') generationMode = 'llm_full_repaired';
        if (generationMode === 'llm_hybrid' && stage2AiFailedCount > 0) generationMode = 'llm_hybrid_partial';
      } catch (error) {
        stage2AiFailedCount = llmTasks.length;
        if (generationMode === 'llm_full') {
          publishable = false;
          generationMode = 'llm_stage2_failed_local_render';
        } else {
          console.warn(`Hybrid Stage2 AI failed; keeping local questions: ${error.message}`);
          generationMode = 'llm_hybrid_ai_failed_local_render';
          questions = localQuestions;
        }
      }
    }
  }

  const questionCoverage = auditQuestionCoverage({
    requirements,
    knowledgeScope,
    phonicsScope,
    confirmedAnalysis: normalizedConfirmedAnalysis,
    tasks: completedTaskList,
    questions,
    taskReport: taskCoverage.report,
  });
  if (!questionCoverage.valid) {
    throw new QualityGateError(`Generated questions failed coverage gate: ${questionCoverage.missing.join(' | ')}`, {
      stage: 'question_coverage',
      coverage: questionCoverage.report,
      missing: questionCoverage.missing,
    });
  }

  const runId = createRunId('llm');
  const modules = assembleUserModules(questions);
  const artifacts = writeGenerationArtifacts(runId, {
    request: { content, difficulty, target_minutes: targetMinutes },
    requirements,
    knowledgeScope,
    phonicsScope,
    confirmedAnalysis: normalizedConfirmedAnalysis,
    plan,
    tasks: completedTaskList,
    coverage: { task: taskCoverage.report, question: questionCoverage.report },
      stage2RepairCount,
      stage2AiCount,
      stage2AiFailedCount,
      questions,
    modules,
  });

  return buildPracticePackage({
    content,
    questions,
    modules,
    mode: generationMode,
    startTime,
    publishable,
    audit: {
      overall: publishable ? 'PASS' : 'REVIEW_REQUIRED',
      validation: 'pass',
      coverage: questionCoverage.report,
      stage2RepairCount,
      stage2AiCount,
      stage2AiFailedCount,
      stage2: {
        useLLM: generationMode !== 'llm_plan_local_render',
        renderer: generationMode,
        aiTypes: config.stage2.aiTypes,
      },
    },
    confirmedAnalysis: normalizedConfirmedAnalysis,
    coverageReport: questionCoverage.report,
    artifactId: runId,
    artifacts,
  });
}

export function buildPracticePackage({
  content,
  questions,
  modules = null,
  mode,
  startTime = Date.now(),
  publishable = true,
  audit = passAudit(),
  confirmedAnalysis = null,
  coverageReport = null,
  artifactId = null,
  artifacts = null,
}) {
  const assembledModules = modules || assembleUserModules(questions);
  const practiceId = `practice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    modules: assembledModules,
    meta: {
      mode,
      validation: audit.validation || 'pass',
      runId: artifactId,
      artifactId,
      artifacts,
      coverage: coverageReport,
      confirmedAnalysis,
      audit,
      publishable,
      stage2: audit.stage2 || {
        useLLM: mode === 'llm_full' || mode === 'llm_hybrid',
        renderer: mode,
      },
      elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
    },
    practice: {
      id: practiceId,
      createdAt: new Date().toISOString(),
      teacherText: content,
      materialIds: materialIdsFromAnalysis(confirmedAnalysis),
      confirmedAnalysis,
      coverageReport,
      modules: assembledModules,
      audit,
      feedback: [],
      source: mode === 'mock' ? 'mock' : 'llm_plan_local_render',
      artifactId,
      completedItemIds: [],
      completedModuleIds: [],
      publishable,
    },
    publishable,
    updatedAt: new Date().toISOString(),
  };
}

function stage2GenerationMode() {
  const mode = String(config.stage2.mode || '').toLowerCase();
  if (mode === 'hybrid' || mode === 'llm_hybrid') return 'llm_hybrid';
  if (mode === 'full_llm' || mode === 'llm_full') return 'llm_full';
  if (config.stage2.useLLM) return 'llm_full';
  return 'llm_plan_local_render';
}

function mergeAiQuestions(localQuestions = [], aiQuestions = []) {
  const aiById = new Map(aiQuestions.map(question => [question.id, question]));
  return localQuestions.map(local => aiById.get(local.id) || local);
}

function prepareAiQuestionsIndividually(rawQuestions = [], context = {}) {
  const accepted = [];
  let failedCount = 0;
  rawQuestions.forEach(question => {
    try {
      const [prepared] = prepareQuestions([question], context);
      if (prepared) accepted.push(prepared);
    } catch (error) {
      failedCount += 1;
      console.warn(`Hybrid Stage2 rejected AI question ${question?.id || 'unknown'}: ${error.message}`);
    }
  });
  return { questions: accepted, failedCount };
}

function passAudit() {
  return {
    overall: 'PASS',
    validation: 'pass',
  };
}

function materialIdsFromAnalysis(analysis = {}) {
  const ids = analysis?.material_context?.selected_material_ids || analysis?.requirements?.material_context?.selected_material_ids || [];
  return Array.isArray(ids) ? ids : [];
}

function alignStage2Questions(rawQuestions, tasks, content) {
  const localByTask = new Map(renderQuestionsFromTasks(tasks, { content }).map(question => [question.id, question]));
  let repairCount = 0;
  const questions = tasks.map((task, index) => {
    const generated = rawQuestions.find(question => question?.id === task.task_id)
      || rawQuestions[index]
      || {};
    const local = localByTask.get(task.task_id) || {};
    const merged = {
      ...local,
      ...generated,
      id: task.task_id,
      type: task.question_type,
      module_id: task.module,
      requirement_ids: Array.isArray(generated.requirement_ids) && generated.requirement_ids.length
        ? generated.requirement_ids
        : [task.kp_id || 'KP_STAGE1'],
      source_refs: Array.isArray(generated.source_refs) && generated.source_refs.length
        ? generated.source_refs
        : task.source_refs,
      knowledge_tags: Array.isArray(generated.knowledge_tags) && generated.knowledge_tags.length
        ? generated.knowledge_tags
        : task.knowledge_tags,
      ability_targets: Array.isArray(generated.ability_targets) && generated.ability_targets.length
        ? generated.ability_targets
        : task.ability_targets,
      target_word: task.target_word,
      target_sentence: task.target_sentence,
    };

    if (
      generated.id !== task.task_id ||
      generated.type !== task.question_type ||
      !Array.isArray(generated.source_refs) ||
      !Array.isArray(generated.knowledge_tags) ||
      !Array.isArray(generated.ability_targets)
    ) {
      repairCount += 1;
    }

    return merged;
  });

  return { questions, repairCount };
}

function limitTasksForInteractiveUse(taskList) {
  const maxTasks = config.questions.maxTasks;
  if (!maxTasks || taskList.length <= maxTasks) return taskList;
  const selected = [];
  const seenTypes = new Set();
  for (const task of taskList) {
    if (!seenTypes.has(task.question_type)) {
      selected.push(task);
      seenTypes.add(task.question_type);
    }
  }
  for (const task of taskList) {
    if (selected.length >= maxTasks) break;
    if (!selected.includes(task)) selected.push(task);
  }
  return selected;
}

export function logPracticeCompletion(label, startTime, modules, questions) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${label} completed in ${elapsed}s`);
  console.log(`Stats: ${modules.length}/${Object.keys(MODULE_CONFIG).length} modules, ${questions.length} questions`);
}

export default {
  generatePracticeService,
  buildPracticePackage,
};
