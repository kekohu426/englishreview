import { buildRuleBasedAnalysis, normalizeConfirmedAnalysis } from './backend/analysis/homeworkAnalysis.js';
import { buildFallbackStage1Plan } from './backend/generators/stage1Fallback.js';
import { ensureAllQuestionTypes } from './backend/generators/fallback.js';
import { sanitizeTaskPlan } from './backend/quality/taskQuality.js';
import { auditAndRepairTaskCoverage } from './backend/coverage/taskCoverage.js';
import { auditQuestionCoverage } from './backend/coverage/questionCoverage.js';
import { generateQuestionsFromTasks } from './backend/generators/mock.js';
import { normalizeQuestion } from './backend/adapters/userClient.js';
import { repairQuestions, validatePedagogicalQuality } from './backend/quality/questionQuality.js';
import { validateQuestions } from './backend/validators/index.js';
import { REQUIRED_QUESTION_TYPES } from './backend/questionTypes.js';
import config from './backend/config.js';

const CONTENT = 'Review textbook Unit 2';
const REQUIRED_SENSE_SENTENCES = [
  'I smell with my nose.',
  'I taste with my tongue.',
  'I touch with my hands.',
  'I hear with my ears.',
  'I see with my eyes.',
];
const UNIT1_WORDS = [
  'scissors',
  'markers',
  'shelves',
  'book',
  'books',
  'box',
  'ball',
  'hoops',
  'jungle gym',
  'boy',
];

function main() {
  const analysis = buildRuleBasedAnalysis(CONTENT, {
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const inputs = normalizeConfirmedAnalysis(CONTENT, analysis);
  const plan = sanitizeTaskPlan(buildFallbackStage1Plan(CONTENT, inputs), CONTENT, inputs);
  const seededTasks = ensureAllQuestionTypes(plan.task_list, plan.knowledge_points);
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    taskList: seededTasks,
    knowledgePoints: plan.knowledge_points,
  });
  const questions = repairQuestions(generateQuestionsFromTasks(taskCoverage.repaired_task_list, CONTENT)
    .map((question, index) => normalizeQuestion(question, index)));
  const validation = validateQuestions(questions);
  const quality = validatePedagogicalQuality(questions);
  const questionCoverage = auditQuestionCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    tasks: taskCoverage.repaired_task_list,
    questions,
    taskReport: taskCoverage.report,
  });

  const fullText = JSON.stringify(questions).toLowerCase();
  const typeCounts = Object.fromEntries(REQUIRED_QUESTION_TYPES.map(type => [
    type,
    questions.filter(question => question.type === type).length,
  ]));
  const missingTypes = REQUIRED_QUESTION_TYPES.filter(type => typeCounts[type] < config.questions.minPerType);
  const missingSenseSentences = REQUIRED_SENSE_SENTENCES.filter(sentence => !fullText.includes(sentence.toLowerCase()));
  const leakedUnit1Words = UNIT1_WORDS.filter(word => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(fullText));
  const badSensePhrases = [
    'it is a touch.',
    'it is a smell.',
    'it is a taste.',
    'it is a hear.',
    'it is a see.',
    'it is a salty.',
    'it is a sour.',
    'it is a sweet.',
    'this is a sour.',
    'this is a salty.',
    'this is a sweet.',
    'what do you tongue with',
    'i tongue with my tongue',
  ].filter(phrase => fullText.includes(phrase));
  const badBareTasteAnswers = questions
    .filter(question => ['listen_pick_word', 'dialogue_complete', 'mixed_challenge'].includes(question.type))
    .filter(question => /how does it taste/i.test(question.audio_text || question.dialogue?.[0]?.text || ''))
    .filter(question => /^(salty|sweet|sour)$/i.test((question.options || []).find(option => option.is_correct)?.text || ''))
    .map(question => question.id);
  const badFillBlankFrames = questions
    .filter(question => question.type === 'fill_blank')
    .filter(question => ['salty', 'sweet', 'sour'].includes(String(question.blank_answer || '').toLowerCase()))
    .filter(question => /this is a|it is a/i.test(String(question.sentence_parts?.[0] || '')))
    .map(question => question.id);

  const issues = [
    ...(!validation.valid ? validation.errors.map(error => `validation: ${error}`) : []),
    ...(!quality.valid ? quality.errors.map(error => `quality: ${error}`) : []),
    ...(!taskCoverage.valid ? taskCoverage.missing.map(item => `task coverage: ${item}`) : []),
    ...(!questionCoverage.valid ? questionCoverage.missing.map(item => `question coverage: ${item}`) : []),
    ...missingTypes.map(type => `missing type minimum: ${type}`),
    ...(missingSenseSentences.length ? [`missing Unit2 sense sentences: ${missingSenseSentences.join(' | ')}`] : []),
    ...(leakedUnit1Words.length ? [`Unit1 words leaked into Unit2: ${leakedUnit1Words.join(', ')}`] : []),
    ...(badSensePhrases.length ? [`bad sense phrases: ${badSensePhrases.join(' | ')}`] : []),
    ...(badBareTasteAnswers.length ? [`taste answers should be full sentences: ${badBareTasteAnswers.join(', ')}`] : []),
    ...(badFillBlankFrames.length ? [`taste adjectives in noun blank frames: ${badFillBlankFrames.join(', ')}`] : []),
  ];

  const report = {
    status: issues.length ? 'FAIL' : 'PASS',
    total: questions.length,
    coverage: questionCoverage.report?.overall,
    typeCounts,
    requiredSenseSentences: REQUIRED_SENSE_SENTENCES,
    missingSenseSentences,
    leakedUnit1Words,
    issues,
  };
  console.log(JSON.stringify(report, null, 2));
  if (issues.length) process.exit(1);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
