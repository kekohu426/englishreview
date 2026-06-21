import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequirements } from './backend/coverage/requirements.js';
import { buildRuleBasedAnalysis } from './backend/analysis/homeworkAnalysis.js';

const TEXTBOOK_CONTEXT = {
  selected_material_ids: ['opw2_textbook'],
  default_textbook_id: 'opw2_textbook',
  selected_material_label: 'Big Fun 2 课本',
};

test('textbook lesson wording maps to the selected textbook unit', () => {
  const requirements = parseRequirements('复习课本第四课', TEXTBOOK_CONTEXT);

  assert.deepEqual(requirements.requested_units, [4]);
  assert.deepEqual(requirements.requested_phonics_units, []);
  assert.ok(requirements.requested_sources.includes('opw2_textbook'));
});

test('textbook unit parser supports lesson and unit wording generally', () => {
  const cases = [
    ['复习课本第4课', [4]],
    ['复习课本第四课', [4]],
    ['复习课本第4单元', [4]],
    ['review textbook lesson 5', [5]],
    ['综合复习前四课', [1, 2, 3, 4]],
    ['综合复习前4单元', [1, 2, 3, 4]],
  ];

  for (const [text, expected] of cases) {
    assert.deepEqual(parseRequirements(text, TEXTBOOK_CONTEXT).requested_units, expected, text);
  }
});

test('textbook lesson 4 analysis uses Big Fun 2 Unit 4 knowledge', () => {
  const analysis = buildRuleBasedAnalysis('复习课本第四课', TEXTBOOK_CONTEXT);
  const words = analysis.target_words.map(item => item.value);
  const patterns = analysis.sentence_patterns.map(item => item.value).join('\n');
  const grammar = analysis.grammar_points.map(item => item.value).join('\n');

  assert.deepEqual(analysis.requested_units, [4]);
  assert.ok(words.includes('swing'));
  assert.ok(words.includes('tricycle'));
  assert.ok(words.includes('slide'));
  assert.ok(!words.includes('meat'), 'lesson 4 should not drift into Unit 5 Food vocabulary');
  assert.match(patterns, /What do you (have|see)\?/i);
  assert.doesNotMatch(`${patterns}\n${grammar}`, /family|aunt|she\s+is\s+not|swing,\s*tricycle,\s*slide\s*49/i);
});
