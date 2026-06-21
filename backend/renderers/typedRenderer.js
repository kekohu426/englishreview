import config from '../config.js';
import { generateQuestionsFromTasks } from '../generators/mock.js';
import { normalizeQuestion } from '../adapters/userClient.js';
import { repairQuestions, validatePedagogicalQuality } from '../quality/questionQuality.js';
import { validateSemanticQuality } from '../quality/semanticQuality.js';
import { validateQuestions } from '../validators/index.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';
import { QualityGateError } from '../errors.js';

export function renderQuestionsFromTasks(taskList = [], context = {}) {
  const rawQuestions = generateQuestionsFromTasks(taskList, context.content || '');
  return prepareQuestions(rawQuestions, context);
}

export function prepareQuestions(rawQuestions = [], context = {}) {
  const questions = repairQuestions(rawQuestions.map((question, index) => normalizeQuestion(question, index)));
  assertQuestionQuality(questions, context);
  return questions;
}

export function regenerateQuestion({ moduleId, itemId, type, reason = '', note = '', confirmedAnalysis = null, coverageContext = {}, index = 0 }) {
  if (!REQUIRED_QUESTION_TYPES.includes(type)) {
    throw new QualityGateError(`Cannot regenerate unsupported question type: ${type}`, {
      missing: [`invalid_type:${type}`],
    });
  }

  const targetWord = pickRegenerationTarget(coverageContext, confirmedAnalysis, index);
  const task = {
    task_id: `${itemId || 'regenerated'}_regen_${Date.now().toString(36)}`,
    module: moduleId || moduleForType(type),
    kp_id: 'KP_REGENERATE',
    priority: 'must',
    question_type: type,
    target_word: targetWord,
    target_sentence: targetSentenceFor(type, targetWord, index),
    source_refs: sourceRefsFor(targetWord, coverageContext),
    knowledge_tags: [`word:${targetWord}`, `type:${type}`, 'regenerated'],
    ability_targets: TYPE_ABILITIES[type] || ['reading'],
    generation_intent: `Regenerate because parent reported: ${reason || note || 'needs review'}.`,
  };

  const [question] = renderQuestionsFromTasks([task], {
    content: coverageContext.teacherText || confirmedAnalysis?.raw_text || '',
    knowledgeScope: coverageContext.knowledgeScope || coverageContext.knowledge_scope || {},
    confirmedAnalysis,
  });
  return {
    ...question,
    id: itemId || question.id,
    module_id: moduleId || question.module_id,
  };
}

export function assertQuestionQuality(questions, context = {}) {
  const validation = validateQuestions(questions);
  if (!validation.valid) {
    throw new QualityGateError(`Generated questions failed validation: ${validation.errors.join(' | ')}`, {
      stage: 'validator',
      missing: validation.errors,
    });
  }
  const quality = validatePedagogicalQuality(questions);
  if (!quality.valid) {
    throw new QualityGateError(`Generated questions failed quality gate: ${quality.errors.join(' | ')}`, {
      stage: 'quality',
      missing: quality.errors,
    });
  }
  const semantic = validateSemanticQuality(questions, context);
  if (!semantic.valid) {
    throw new QualityGateError(`Generated questions failed semantic gate: ${semantic.errors.join(' | ')}`, {
      stage: 'semantic',
      missing: semantic.errors,
    });
  }
}

function pickRegenerationTarget(coverageContext = {}, confirmedAnalysis = {}, index = 0) {
  const candidates = [
    ...(coverageContext.target_words || []),
    ...(coverageContext.words || []),
    ...(coverageContext.knowledgeScope?.confirmed_words || []),
    ...(coverageContext.knowledgeScope?.all_unit_words || []),
    ...(confirmedAnalysis?.words || confirmedAnalysis?.target_words || []).map(item => item?.value || item?.label || item),
  ]
    .map(normalizeWord)
    .filter(Boolean);
  const pool = [...new Set(candidates)];
  return pool[index % Math.max(1, pool.length)] || 'book';
}

function sourceRefsFor(word, coverageContext = {}) {
  const refs = coverageContext.source_refs || coverageContext.sourceRefs || [];
  return Array.isArray(refs) && refs.length ? refs.map(String) : [`regenerate:${word}`];
}

function targetSentenceFor(type, word, index) {
  if (['rain', 'lightning', 'thunder'].includes(normalizeWord(word))) {
    if (normalizeWord(word) === 'thunder') return 'I hear thunder.';
    return `I see ${normalizeWord(word)}.`;
  }
  if (type === 'listen_pick_word' || type === 'dialogue_complete' || type === 'mixed_challenge') {
    return index % 2 === 0 ? 'What is this?' : 'What are these?';
  }
  if (type === 'fill_blank') return `It is ____ ${word}.`;
  if (type === 'word_order' || type === 'translate_pick' || type === 'read_aloud') return `It is a ${word}.`;
  return null;
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default {
  renderQuestionsFromTasks,
  prepareQuestions,
  regenerateQuestion,
  assertQuestionQuality,
};
