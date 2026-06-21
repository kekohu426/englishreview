import test from 'node:test';
import assert from 'node:assert/strict';
import config from './backend/config.js';
import { REQUIRED_QUESTION_TYPES } from './backend/questionTypes.js';
import { parseRequirements } from './backend/coverage/requirements.js';
import { buildRuleBasedAnalysis, normalizeConfirmedAnalysis } from './backend/analysis/homeworkAnalysis.js';
import { loadPhonicsKnowledge, buildPhonicsScope, formatPhonicsForPrompt } from './backend/knowledge/phonics_loader.js';
import { ensureAllQuestionTypes } from './backend/generators/fallback.js';
import { generateQuestionsFromTasks } from './backend/generators/mock.js';
import { normalizeQuestion } from './backend/adapters/userClient.js';
import { validateQuestions } from './backend/validators/index.js';
import { auditAndRepairTaskCoverage } from './backend/coverage/taskCoverage.js';
import { auditQuestionCoverage } from './backend/coverage/questionCoverage.js';
import { repairQuestions, validatePedagogicalQuality } from './backend/quality/questionQuality.js';
import { deleteCustomMaterial, saveCustomMaterial } from './backend/knowledge/customMaterials.js';

const SAMPLE = 'Review OPW2 Unit 3: hen, pen, bed, red. Practice phonics, spelling, reading aloud, How many and How much.';

test('question type constants expose exactly 11 non-letter types', () => {
  assert.equal(REQUIRED_QUESTION_TYPES.length, 11);
  assert.equal(config.questions.requiredTypes.length, 11);
  assert.ok(!REQUIRED_QUESTION_TYPES.includes('letter_sound_trace'));
});

test('parseRequirements does not parse 26 letters as page 26', () => {
  const requirements = parseRequirements('26字母自然拼读复习。Review Unit 3.');
  assert.deepEqual(requirements.requested_pages, []);
  assert.ok(requirements.requested_skills.includes('alphabet_reference'));
  assert.ok(requirements.requested_skills.includes('phonics_blending'));
});

test('parseRequirements understands Chinese ordinal unit requests', () => {
  const requirements = parseRequirements('复习课本第一单元');
  assert.deepEqual(requirements.requested_units, [1]);
  assert.deepEqual(requirements.requested_phonics_units, []);
  assert.ok(requirements.requested_sources.includes('unit_review'));
});

test('source router separates textbook units from phonics units', () => {
  const textbook = parseRequirements('复习课本第一单元');
  assert.deepEqual(textbook.requested_units, [1]);
  assert.deepEqual(textbook.requested_phonics_units, []);
  assert.ok(textbook.requested_sources.includes('opw2_textbook'));

  const phonics = parseRequirements('自然拼读第一单元反复拼读');
  assert.deepEqual(phonics.requested_units, []);
  assert.deepEqual(phonics.requested_phonics_units, [1]);
  assert.ok(phonics.requested_sources.includes('oxford_phonics'));
});

test('custom uploaded material can be routed by alias', () => {
  const material = saveCustomMaterial({
    label: 'Test Book',
    aliases: ['TestBookAlias'],
    filename: 'test-book.md',
    content: '# Unit 1\nWords: moon, star\nSentence: I see the moon.',
  });
  try {
    const analysis = buildRuleBasedAnalysis('复习 TestBookAlias 第一单元');
    assert.ok(analysis.source_refs.some(item => item.value === 'Test Book'));
    assert.ok(analysis.target_words.some(item => item.value === 'moon'));
    assert.ok(analysis.target_words.some(item => item.value === 'star'));
  } finally {
    deleteCustomMaterial(material.id);
  }
});

test('analysis exposes editable confirmed fields', () => {
  const analysis = buildRuleBasedAnalysis(SAMPLE);
  assert.ok(Array.isArray(analysis.words));
  assert.ok(Array.isArray(analysis.sentence_patterns));
  assert.ok(Array.isArray(analysis.grammar_points));
  assert.ok(Array.isArray(analysis.phonics_points));
  assert.ok(analysis.editable_flags.words);

  const normalized = normalizeConfirmedAnalysis(SAMPLE, analysis);
  assert.ok(normalized.confirmedAnalysis.words.length > 0);
  assert.ok(normalized.phonicsScope.rules.length > 0);
});

test('textbook-only analysis does not include Oxford phonics scope', () => {
  const analysis = buildRuleBasedAnalysis('复习课本第一单元', {
    default_textbook_id: 'opw2_textbook',
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 课本',
  });

  assert.deepEqual(analysis.requested_units, [1]);
  assert.deepEqual(analysis.requirements.requested_phonics_units, []);
  assert.equal(analysis.phonics_points.length, 0);
  assert.equal(analysis.phonics_scope.rules.length, 0);
  assert.ok(analysis.target_words.some(item => item.value === 'scissors'));
  assert.ok(analysis.target_words.some(item => item.value === 'ball'));
  assert.ok(!analysis.target_words.some(item => item.value === 'ant'));
  assert.ok(!analysis.source_refs.some(item => /Oxford|自然拼读|Phonics Unit/i.test(item.value)));
});

test('phonics analysis only appears when selected or explicitly requested', () => {
  const selected = buildRuleBasedAnalysis('复习第一单元', {
    default_textbook_id: 'opw2_textbook',
    selected_material_ids: ['oxford_phonics'],
    selected_material_label: 'Oxford 自然拼读',
  });
  assert.deepEqual(selected.requested_units, []);
  assert.ok(selected.requirements.requested_phonics_units.length > 0);
  assert.ok(selected.phonics_points.length > 0);

  const explicit = buildRuleBasedAnalysis('复习自然拼读第一单元', {
    default_textbook_id: 'opw2_textbook',
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 课本',
  });
  assert.deepEqual(explicit.requested_units, []);
  assert.deepEqual(explicit.requirements.requested_phonics_units, [1]);
  assert.ok(explicit.phonics_points.length > 0);
});

test('phonics loader derives Oxford phonics scope for Stage1 prompt', () => {
  const knowledge = loadPhonicsKnowledge();
  assert.ok(knowledge.rules.length > 0);
  assert.ok(knowledge.rules.some(rule => /short|family|phonics/i.test(rule.label)));

  const scope = buildPhonicsScope(parseRequirements(SAMPLE));
  const prompt = formatPhonicsForPrompt(scope);
  assert.match(prompt, /Natural Phonics Knowledge/);
  assert.match(prompt, /source_refs/);
});

test('coverage and validators reject removed letter type and require traceability', () => {
  const bad = [{
    id: 'q_bad',
    type: 'letter_sound_trace',
    child_instruction: 'Trace.',
    source_refs: ['teacher'],
    knowledge_tags: ['letter:A'],
  }];
  const validation = validateQuestions(bad);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' | '), /letter_sound_trace|unknown type/);
});

test('task and question coverage pass for confirmed 11-type local flow', () => {
  const inputs = normalizeConfirmedAnalysis(SAMPLE, buildRuleBasedAnalysis(SAMPLE));
  const seedTasks = ensureAllQuestionTypes([], [{ id: 'KP_TEST', targets: inputs.knowledgeScope.all_unit_words.slice(0, 8) }]);
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    taskList: seedTasks,
    knowledgePoints: [{ id: 'KP_TEST', targets: inputs.knowledgeScope.all_unit_words.slice(0, 8) }],
  });
  assert.equal(taskCoverage.valid, true, taskCoverage.missing.join(' | '));

  const questions = generateQuestionsFromTasks(taskCoverage.repaired_task_list, SAMPLE)
    .map((question, index) => normalizeQuestion(question, index));
  const validation = validateQuestions(questions);
  assert.equal(validation.valid, true, validation.errors.join(' | '));
  assert.ok(questions.every(question => question.type !== 'letter_sound_trace'));
  assert.ok(questions.every(question => question.source_refs.length && question.knowledge_tags.length));

  const questionCoverage = auditQuestionCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    tasks: taskCoverage.repaired_task_list,
    questions,
    taskReport: taskCoverage.report,
  });
  assert.equal(questionCoverage.valid, true, questionCoverage.missing.join(' | '));
});

test('quality repair balances repetitive listen_judge answers from Stage2', () => {
  const questions = Array.from({ length: 6 }, (_, index) => normalizeQuestion({
    id: `judge_${index + 1}`,
    type: 'listen_judge',
    child_instruction: 'Listen and judge.',
    source_refs: ['test'],
    knowledge_tags: ['grammar:how_many'],
    ability_targets: ['listening', 'grammar'],
    audio_text: `How many pens?`,
    answer: true,
    options: [
      { text: 'Correct', is_correct: true },
      { text: 'Not correct', is_correct: false },
    ],
  }, index));

  const repaired = repairQuestions(questions);
  const correctTexts = repaired
    .filter(question => question.type === 'listen_judge')
    .map(question => question.options.find(option => option.is_correct)?.text);
  assert.deepEqual([...new Set(correctTexts)].sort(), ['Correct', 'Not correct']);
  assert.equal(validatePedagogicalQuality(repaired).valid, true);
});

test('quality repair blocks ambiguous images and singular/plural prompt mismatches', () => {
  const questions = [
    {
      id: 'bad_image_shelves',
      type: 'listen_pick_image',
      child_instruction: 'Listen and choose.',
      source_refs: ['test'],
      knowledge_tags: ['word:shelves'],
      target_word: 'shelves',
      audio_text: 'shelves',
      options: [
        { text: 'shelves', image_key: 'shelves', is_correct: true },
        { text: 'books', image_key: 'books', is_correct: false },
        { text: 'box', image_key: 'box', is_correct: false },
      ],
    },
    {
      id: 'bad_listen_plural',
      type: 'listen_pick_word',
      child_instruction: 'Listen and choose.',
      source_refs: ['test'],
      knowledge_tags: ['word:scissors'],
      target_word: 'scissors',
      audio_text: 'What is this?',
      options: [
        { text: 'They are scissors.', is_correct: true },
        { text: 'It is a book.', is_correct: false },
        { text: 'Yes, I do.', is_correct: false },
      ],
    },
    {
      id: 'bad_dialogue_plural',
      type: 'dialogue_complete',
      child_instruction: 'Complete dialogue.',
      source_refs: ['test'],
      knowledge_tags: ['word:markers'],
      target_word: 'markers',
      dialogue: [
        { name: 'Leo', icon: 'L', text: 'What is this?', isBlank: false },
        { name: 'Mia', icon: 'M', text: '', isBlank: true },
      ],
      options: [
        { text: 'They are markers.', is_correct: true },
        { text: 'It is a book.', is_correct: false },
        { text: 'Yes, I do.', is_correct: false },
      ],
    },
  ].map((question, index) => normalizeQuestion(question, index));

  const repaired = repairQuestions(questions);
  const imageQuestion = repaired.find(question => question.type === 'listen_pick_image');
  const listenQuestion = repaired.find(question => question.type === 'listen_pick_word');
  const dialogueQuestion = repaired.find(question => question.type === 'dialogue_complete');

  assert.ok(!JSON.stringify(imageQuestion.options).match(/shelves|books/));
  assert.equal(listenQuestion.audio_text, 'What are these?');
  assert.equal(listenQuestion.options.find(option => option.is_correct)?.text, 'They are scissors.');
  assert.equal(dialogueQuestion.dialogue[0].text, 'What are these?');
  assert.equal(dialogueQuestion.options.find(option => option.is_correct)?.text, 'They are markers.');
  assert.equal(validatePedagogicalQuality(repaired).valid, true);
});

test('unit 2 senses keep touch-with-hands pattern and do not treat sense verbs as objects', () => {
  const content = 'Review textbook Unit 2.';
  const analysis = buildRuleBasedAnalysis(content, {
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const patternText = analysis.sentence_patterns.map(item => item.value).join(' | ');
  assert.match(patternText, /I touch with my hands/);
  assert.doesNotMatch(patternText, /What do you tongue with|I tongue with my tongue/);

  const inputs = normalizeConfirmedAnalysis(content, analysis);
  const seedTasks = ensureAllQuestionTypes([], [{ id: 'KP_U2', targets: inputs.knowledgeScope.all_unit_words }]);
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    taskList: seedTasks,
    knowledgePoints: [{ id: 'KP_U2', targets: inputs.knowledgeScope.all_unit_words }],
  });
  const questions = repairQuestions(generateQuestionsFromTasks(taskCoverage.repaired_task_list, content)
    .map((question, index) => normalizeQuestion(question, index)));
  const questionText = JSON.stringify(questions);

  assert.match(questionText, /I touch with my hands|What do you touch with/);
  assert.doesNotMatch(questionText, /It is a (touch|smell|taste|hear|see)\./);
  assert.doesNotMatch(questionText, /What do you tongue with|I tongue with my tongue/);
  assert.equal(validatePedagogicalQuality(questions).valid, true);
});
