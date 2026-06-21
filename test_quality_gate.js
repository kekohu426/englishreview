#!/usr/bin/env node

import { repairQuestions, validatePedagogicalQuality } from './backend/quality/questionQuality.js';
import { sanitizeTaskPlan } from './backend/quality/taskQuality.js';
import { validateQuestions } from './backend/validators/index.js';
import { normalizeQuestion } from './backend/adapters/userClient.js';
import { generateQuestionsFromTasks } from './backend/generators/mock.js';
import { ensureAllQuestionTypes } from './backend/generators/fallback.js';
import { parseRequirements } from './backend/coverage/requirements.js';
import { buildKnowledgeScope } from './backend/coverage/knowledgeScope.js';
import { auditAndRepairTaskCoverage } from './backend/coverage/taskCoverage.js';
import { auditQuestionCoverage } from './backend/coverage/questionCoverage.js';
import { buildRuleBasedAnalysis, normalizeConfirmedAnalysis } from './backend/analysis/homeworkAnalysis.js';
import { REQUIRED_QUESTION_TYPES } from './backend/questionTypes.js';

const badQuestions = [
  {
    id: 'bad_listen_how_much',
    type: 'listen_pick_word',
    child_instruction: 'Listen and choose.',
    source_refs: ['test'],
    knowledge_tags: ['pattern:how_much'],
    audio_text: 'How much water?',
    options: [
      { text: 'cat', is_correct: true },
      { text: 'yak', is_correct: false },
      { text: 'ax', is_correct: false },
    ],
  },
  {
    id: 'bad_spell_leak',
    type: 'spell_word',
    child_instruction: 'Spell the word.',
    source_refs: ['test'],
    knowledge_tags: ['word:yak'],
    audio_text: 'yak',
    spell_word: 'yak',
    word_translation: 'yak',
    letter_pool: ['Y', 'A', 'K', 'B', 'C', 'D', 'E', 'F'],
  },
  {
    id: 'bad_dialogue_spell',
    type: 'dialogue_complete',
    child_instruction: 'Complete dialogue.',
    source_refs: ['test'],
    knowledge_tags: ['pattern:spell'],
    dialogue: [
      { name: 'Leo', icon: 'L', text: 'Can you spell cat?', isBlank: false },
      { name: 'Mia', icon: 'M', text: '', isBlank: true },
    ],
    options: [
      { text: 'Yes. cat.', is_correct: true },
      { text: 'I see a cat.', is_correct: false },
      { text: 'No, it is not.', is_correct: false },
    ],
  },
];

const badStage1Plan = {
  knowledge_points: [
    { id: 'KP1', targets: ['How many ...?', 'countable nouns', 'question and answer practice'] },
  ],
  task_list: [
    {
      task_id: 'stage_bad_letter',
      question_type: 'letter_sound_trace',
      kp_id: 'KP1',
      target_word: 'A',
    },
    {
      task_id: 'stage_bad_listen_word',
      question_type: 'listen_pick_word',
      kp_id: 'KP1',
      target_word: 'web',
      target_sentence: 'The web is red.',
    },
    {
      task_id: 'stage_bad_opw',
      question_type: 'dialogue_complete',
      kp_id: 'KP1',
      target_word: 'OPW',
      target_sentence: 'A: Can you spell OPW? B: O-P-W.',
    },
  ],
};

const normalized = badQuestions.map((question, index) => normalizeQuestion(question, index));
const repaired = repairQuestions(normalized);
const structure = validateQuestions(repaired);
const quality = validatePedagogicalQuality(repaired);
const sanitizedPlan = sanitizeTaskPlan(badStage1Plan, 'How much and How many; corn, pens, water, milk.');
const visibleText = JSON.stringify(sanitizedPlan.task_list.map(task => ({
  target_word: task.target_word,
  target_sentence: task.target_sentence,
  note: task.note,
  generation_intent: task.generation_intent,
}))).toLowerCase();

const teacherCoverageText = 'Review OPW2 Unit 3 hen pen bed red. Natural phonics, spelling, reading aloud, How much and How many.';
const requirements = parseRequirements(teacherCoverageText);
const knowledgeScope = buildKnowledgeScope(requirements);
const homeworkAnalysis = buildRuleBasedAnalysis(teacherCoverageText);
const confirmedInputs = normalizeConfirmedAnalysis(teacherCoverageText, homeworkAnalysis);
const coverageSeedTasks = ensureAllQuestionTypes([], [{ id: 'KP_TEST', targets: knowledgeScope.all_unit_words.slice(0, 8) }]);
const coveragePlan = auditAndRepairTaskCoverage({
  requirements,
  knowledgeScope,
  phonicsScope: confirmedInputs.phonicsScope,
  confirmedAnalysis: confirmedInputs.confirmedAnalysis,
  taskList: coverageSeedTasks,
  knowledgePoints: [{ id: 'KP_TEST', targets: knowledgeScope.all_unit_words.slice(0, 8) }],
});
const coverageQuestions = generateQuestionsFromTasks(coveragePlan.repaired_task_list, teacherCoverageText)
  .map((question, index) => normalizeQuestion(question, index));
const questionCoverage = auditQuestionCoverage({
  requirements,
  knowledgeScope,
  phonicsScope: confirmedInputs.phonicsScope,
  confirmedAnalysis: confirmedInputs.confirmedAnalysis,
  tasks: coveragePlan.repaired_task_list,
  questions: coverageQuestions,
  taskReport: coveragePlan.report,
});
const coverageTypeCounts = coverageQuestions.reduce((counts, question) => {
  counts[question.type] = (counts[question.type] || 0) + 1;
  return counts;
}, {});

assert(structure.valid, `structure failed: ${structure.errors.join(' | ')}`);
assert(quality.valid, `quality failed: ${quality.errors.join(' | ')}`);
assert(!sanitizedPlan.task_list.some(task => task.question_type === 'letter_sound_trace'), 'task sanitizer kept removed letter type');
assert(!visibleText.includes('questionandanswer'), 'task sanitizer kept glued question-and-answer artifact');
assert(!visibleText.includes('opw'), 'task sanitizer kept OPW artifact');
assert(sanitizedPlan.task_list[0]?.target_sentence?.includes('?'), `listen_pick_word should become a question prompt, got ${sanitizedPlan.task_list[0]?.target_sentence}`);
assert(REQUIRED_QUESTION_TYPES.length === 11, 'expected 11 required types');
assert(!REQUIRED_QUESTION_TYPES.includes('letter_sound_trace'), 'letter_sound_trace should not be required');
assert(!requirements.requested_pages.includes(26), `26 letters should not become page 26: ${requirements.requested_pages.join(',')}`);
assert(homeworkAnalysis.words.length > 0, 'homework analysis missed words');
assert(homeworkAnalysis.phonics_points.length > 0, 'homework analysis missed phonics points');
assert(confirmedInputs.phonicsScope.rules.length > 0, 'confirmed analysis did not build phonics scope');
assert(coveragePlan.report.overall === 'PASS', `task coverage did not repair to PASS: ${coveragePlan.report.missing.join(' | ')}`);
assert(questionCoverage.valid, `question coverage failed: ${questionCoverage.missing.join(' | ')}`);
assert(REQUIRED_QUESTION_TYPES.every(type => (coverageTypeCounts[type] || 0) >= 5), `not every type has 5 questions: ${JSON.stringify(coverageTypeCounts)}`);
assert(!coverageQuestions.some(question => question.type === 'letter_sound_trace'), 'questions include removed letter type');
assert(coverageQuestions.every(question => question.source_refs.length && question.knowledge_tags.length), 'questions missing traceability');

console.log('Quality Gate: PASS');
console.log(JSON.stringify({
  repairedCount: repaired.length,
  sanitizedTasks: sanitizedPlan.task_list.length,
  coverage: {
    taskOverall: coveragePlan.report.overall,
    questionOverall: questionCoverage.overall,
    typeCounts: coverageTypeCounts,
  },
}, null, 2));

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}
