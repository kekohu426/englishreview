import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { loadOPW2, getCoverageById, formatForPrompt } from './backend/knowledge/opw2_loader.js';

const PROGRAM_KB_PATH = 'D:/zhishiku/00_Inbox/笑笑英语/OPW2-文字提取/opw2_program_knowledge.json';

test('OPW2 program knowledge file is complete and parseable', () => {
  const data = JSON.parse(fs.readFileSync(PROGRAM_KB_PATH, 'utf8'));
  const coverageIds = Object.keys(data.coverage_index.by_id);

  assert.equal(data.schema_version, 'opw2.program_knowledge.v1');
  assert.equal(data.units.length, 8);
  assert.equal(data.reviews.length, 4);
  assert.equal(data.vocabulary.length, 93);
  assert.equal(coverageIds.length, new Set(coverageIds).size);
  assert.ok(data.units.every(unit =>
    unit.patterns.length &&
    unit.words.length &&
    unit.sight_words.length &&
    unit.story?.frames?.length &&
    unit.chants.length
  ));
  assert.ok(data.coverage_index.by_id['U1-WORD-jam']);
  assert.ok(data.coverage_index.by_page['38']?.length);
});

test('OPW2 loader exposes backward-compatible fields and coverage helpers', () => {
  const opw2 = loadOPW2();

  assert.ok(opw2.vocabulary.length >= 90);
  assert.ok(opw2.vocabularyByUnit[1].includes('scissors'));
  assert.ok(opw2.vocabularyByUnit[2].includes('tongue'));
  assert.ok(opw2.vocabularyByUnit[2].includes('hands'));
  assert.ok(opw2.vocabularyByUnit[2].includes('eyes'));
  assert.ok(opw2.vocabularyByUnit[4].includes('swing'));
  assert.ok(opw2.vocabularyByUnit[4].includes('tricycle'));
  assert.ok(opw2.vocabularyByUnit[4].includes('slide'));
  assert.equal(getCoverageById('U2-P23-WORD-tongue').word, 'tongue');
});

test('OPW2 prompt slice carries source-ref instructions', () => {
  const promptText = formatForPrompt();

  assert.match(promptText, /OPW2 Program Knowledge/);
  assert.match(promptText, /Unit 1/);
  assert.match(promptText, /source_refs/);
  assert.match(promptText, /coverage_id/);
});
