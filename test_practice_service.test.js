import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuleBasedAnalysis } from './backend/analysis/homeworkAnalysis.js';
import { generatePracticeService } from './backend/services/generatePracticeService.js';
import { regenerateQuestion } from './backend/renderers/typedRenderer.js';
import { REQUIRED_QUESTION_TYPES } from './backend/questionTypes.js';
import { validateQuestions } from './backend/validators/index.js';

const TEXTBOOK_UNIT_1 = '复习课本第一单元';

test('generatePracticeService returns a publishable PracticePackage for confirmed textbook input', async () => {
  const analysis = buildRuleBasedAnalysis(TEXTBOOK_UNIT_1, {
    default_textbook_id: 'opw2_textbook',
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const result = await generatePracticeService({
    content: TEXTBOOK_UNIT_1,
    confirmedAnalysis: analysis,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.practice.publishable, true);
  assert.equal(result.practice.teacherText, TEXTBOOK_UNIT_1);
  assert.ok(result.practice.confirmedAnalysis);
  assert.ok(result.practice.coverageReport);
  assert.ok(Array.isArray(result.practice.modules));
  assert.ok(result.practice.modules.length > 0);
  assert.equal(result.practice.audit.overall, 'PASS');

  const questions = result.practice.modules.flatMap(module => module.items);
  const counts = Object.fromEntries(REQUIRED_QUESTION_TYPES.map(type => [type, 0]));
  questions.forEach(question => {
    counts[question.type] = (counts[question.type] || 0) + 1;
  });
  REQUIRED_QUESTION_TYPES.forEach(type => {
    assert.ok(counts[type] >= 5, `${type} should have at least 5 questions`);
  });
});

test('local item regeneration preserves type and validates the replacement question', () => {
  const analysis = buildRuleBasedAnalysis(TEXTBOOK_UNIT_1, {
    default_textbook_id: 'opw2_textbook',
    selected_material_ids: ['opw2_textbook'],
    selected_material_label: 'Big Fun 2 textbook',
  });
  const item = regenerateQuestion({
    moduleId: 'm2',
    itemId: 'replace_me',
    type: 'match_word_image',
    reason: '图片不对',
    confirmedAnalysis: analysis,
    coverageContext: {
      target_words: analysis.target_words.map(entry => entry.value),
      source_refs: ['test:unit1'],
      teacherText: TEXTBOOK_UNIT_1,
    },
  });

  assert.equal(item.id, 'replace_me');
  assert.equal(item.type, 'match_word_image');
  assert.equal(item.module_id, 'm2');
  assert.equal(validateQuestions([item]).valid, true);
});
