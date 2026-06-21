import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuleBasedAnalysis, normalizeConfirmedAnalysis } from './backend/analysis/homeworkAnalysis.js';
import { generateQuestionsFromTasks } from './backend/generators/mock.js';
import { repairQuestions, validatePedagogicalQuality } from './backend/quality/questionQuality.js';
import { validateSemanticQuality } from './backend/quality/semanticQuality.js';
import { normalizeQuestion } from './backend/adapters/userClient.js';
import { buildFallbackStage1Plan } from './backend/generators/stage1Fallback.js';
import { ensureAllQuestionTypes } from './backend/generators/fallback.js';
import { sanitizeTaskPlan } from './backend/quality/taskQuality.js';
import { auditAndRepairTaskCoverage } from './backend/coverage/taskCoverage.js';

test('source labels and OCR garbage are not promoted into confirmed analysis', () => {
  const analysis = buildRuleBasedAnalysis('Review textbook Unit 3 They are ()y pets) Who grandfather? grandfather is my grandfather');
  const words = analysis.words.map(item => item.value);
  const patterns = analysis.sentence_patterns.map(item => item.value).join('\n');

  assert.equal(words.includes('textbook'), false);
  assert.equal(/\(\)y|grandfathery|th is|yo u/i.test(patterns), false);
});

test('person/family words use person templates instead of object templates', () => {
  const tasks = [
    task('dialogue_complete', 'grandfather', 'What is this?'),
    task('listen_pick_word', 'grandmother', 'What is this?'),
    task('read_aloud', 'aunt', ''),
    task('word_order', 'uncle', ''),
    task('translate_pick', 'cousin', ''),
  ];
  const questions = repairQuestions(generateQuestionsFromTasks(tasks, 'Review textbook Unit 3')
    .map((question, index) => normalizeQuestion(question, index)));

  const quality = validatePedagogicalQuality(questions);
  const semantic = validateSemanticQuality(questions, {
    knowledgeScope: { all_unit_words: ['grandfather', 'grandmother', 'aunt', 'uncle', 'cousin'] },
  });

  assert.equal(quality.valid, true, quality.errors.join(' | '));
  assert.equal(semantic.valid, true, semantic.errors.join(' | '));
  assert.equal(JSON.stringify(questions).includes('It is a grandfather'), false);
  assert.match(JSON.stringify(questions), /Who is|He is my|She is my/);
});

test('semantic gate rejects person-as-object and image fallback outside selected scope', () => {
  const badQuestions = [
    normalizeQuestion({
      id: 'bad_person',
      type: 'read_aloud',
      child_instruction: 'Read.',
      source_refs: ['unit:3'],
      knowledge_tags: ['word:grandfather'],
      text: 'It is a grandfather.',
      target_word: 'grandfather',
    }, 0),
    normalizeQuestion({
      id: 'bad_image_scope',
      type: 'listen_pick_image',
      child_instruction: 'Listen.',
      source_refs: ['unit:3'],
      knowledge_tags: ['word:grandfather'],
      audio_text: 'book',
      target_word: 'book',
      options: [
        { text: 'book', image_key: 'book', is_correct: true },
        { text: 'ball', image_key: 'ball', is_correct: false },
        { text: 'box', image_key: 'box', is_correct: false },
      ],
    }, 1),
  ];
  const semantic = validateSemanticQuality(badQuestions, {
    knowledgeScope: { all_unit_words: ['grandfather', 'grandmother', 'aunt', 'uncle', 'cousin', 'house', 'apartment', 'pets'] },
  });

  assert.equal(semantic.valid, false);
  assert.match(semantic.errors.join('\n'), /person\/family word rendered as an object/);
  assert.match(semantic.errors.join('\n'), /image options fallback outside confirmed material scope|target word outside confirmed material scope/);
});

test('image rendering keeps image targets inside the confirmed material scope when possible', () => {
  const scopeWords = ['grandfather', 'grandmother', 'aunt', 'uncle', 'cousin', 'house', 'apartment', 'pets'];
  const tasks = scopeWords.slice(0, 5).flatMap((word, index) => [
    task('listen_pick_image', word, '', index),
    task('match_word_image', word, '', index + 10),
  ]);
  const questions = repairQuestions(generateQuestionsFromTasks(tasks, 'Review textbook Unit 3')
    .map((question, index) => normalizeQuestion(question, index)));
  const semantic = validateSemanticQuality(questions, {
    knowledgeScope: { all_unit_words: scopeWords },
  });

  assert.equal(semantic.valid, true, semantic.errors.join(' | '));
  const imageWords = questions.flatMap(question => (question.options || []).map(option => option.image_key || option.text));
  assert.equal(imageWords.some(word => ['book', 'ball', 'box', 'scissors', 'markers'].includes(word)), false);
});

test('unit 4 image words stay in scope and natural phenomena do not use articles', () => {
  const content = '\u590d\u4e60\u8bfe\u672c\u7b2c\u56db\u5355\u5143';
  const analysis = buildRuleBasedAnalysis(content, {
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const inputs = normalizeConfirmedAnalysis(content, analysis);
  const plan = sanitizeTaskPlan(buildFallbackStage1Plan(content, inputs), content, inputs);
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    taskList: ensureAllQuestionTypes(plan.task_list, plan.knowledge_points),
    knowledgePoints: plan.knowledge_points,
  });
  const questions = repairQuestions(generateQuestionsFromTasks(taskCoverage.repaired_task_list, content)
    .map((question, index) => normalizeQuestion(question, index)));
  const semantic = validateSemanticQuality(questions, {
    knowledgeScope: inputs.knowledgeScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
  });
  const fullText = JSON.stringify(questions).toLowerCase();
  const imageKeys = questions
    .filter(question => ['listen_pick_image', 'match_word_image'].includes(question.type))
    .flatMap(question => (question.options || []).map(option => option.image_key || option.text));

  assert.deepEqual(analysis.requested_units, [4]);
  assert.equal(semantic.valid, true, semantic.errors.join(' | '));
  assert.equal(imageKeys.some(word => ['book', 'ball', 'box', 'scissors', 'markers'].includes(word)), false);
  assert.equal(/it is an? (lightning|thunder)/.test(fullText), false);
  assert.equal(/\b(it is|this is|i see|i have)\s+a\s+(rain|lightning|thunder|clouds)\b/.test(fullText), false);
  assert.equal(/\bthey are\s+(rain|lightning|thunder)\b/.test(fullText), false);
  assert.equal(/\b(book|scissors|markers|aunt|uncle|grandfather|grandmother|meat|chicken|corn|restaurant|hospital)\b/.test(fullText), false);
  assert.equal(/i see\s{2,}/.test(fullText), false);
});

test('textbook units 5-8 keep cleaned vocabulary and scoped image options', () => {
  for (const unit of [5, 6, 7, 8]) {
    const { analysis, questions, semantic } = generateUnitQuestions(unit);
    const fullText = JSON.stringify(questions).toLowerCase();
    const imageKeys = questions
      .filter(question => ['listen_pick_image', 'match_word_image'].includes(question.type))
      .flatMap(question => (question.options || []).map(option => option.image_key || option.text));
    const scope = new Set(analysis.words.map(item => item.value));
    const outOfScopeImageKeys = imageKeys.filter(key => !scope.has(String(key).toLowerCase()) && !scope.has(String(key).toLowerCase().replace(/s$/, '')));

    assert.equal(semantic.valid, true, `Unit ${unit}: ${semantic.errors.join(' | ')}`);
    assert.equal(outOfScopeImageKeys.length, 0, `Unit ${unit}: image keys outside scope ${outOfScopeImageKeys.join(', ')}`);
    assert.equal(/\bjljice\b|\bbt\b|\bca t\b|eggsh e chick|\bseeds seeds\b/.test(fullText), false, `Unit ${unit}: OCR garbage leaked`);
    assert.equal(/\bit is an? (sunny|rainy|windy)\b|\bthey are (sunny|rainy|windy)\b/.test(fullText), false, `Unit ${unit}: weather adjective rendered as object`);
    assert.equal(/\bwhat is this\?\s*(it is )?next to\b/.test(fullText), false, `Unit ${unit}: preposition rendered as object`);
  }
});

function generateUnitQuestions(unit) {
  const content = `Review textbook Unit ${unit}`;
  const analysis = buildRuleBasedAnalysis(content, {
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const inputs = normalizeConfirmedAnalysis(content, analysis);
  const plan = sanitizeTaskPlan(buildFallbackStage1Plan(content, inputs), content, inputs);
  const taskCoverage = auditAndRepairTaskCoverage({
    requirements: inputs.requirements,
    knowledgeScope: inputs.knowledgeScope,
    phonicsScope: inputs.phonicsScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
    taskList: ensureAllQuestionTypes(plan.task_list, plan.knowledge_points),
    knowledgePoints: plan.knowledge_points,
  });
  const questions = repairQuestions(generateQuestionsFromTasks(taskCoverage.repaired_task_list, content)
    .map((question, index) => normalizeQuestion(question, index)));
  const semantic = validateSemanticQuality(questions, {
    knowledgeScope: inputs.knowledgeScope,
    confirmedAnalysis: inputs.confirmedAnalysis,
  });
  return { analysis, questions, semantic };
}

function task(type, word, sentence = '', index = 0) {
  return {
    task_id: `semantic_${type}_${word}_${index}`,
    question_type: type,
    module: 'm1',
    kp_id: `KP_${word}`,
    target_word: word,
    target_sentence: sentence,
    source_refs: ['unit:3'],
    knowledge_tags: [`word:${word}`, `type:${type}`],
    ability_targets: ['reading'],
  };
}
