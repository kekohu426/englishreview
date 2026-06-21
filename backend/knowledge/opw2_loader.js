import fs from 'fs';
import path from 'path';
import config from '../config.js';

let opw2Data = null;

export function loadOPW2() {
  if (opw2Data) return opw2Data;

  const kbPath = resolveKnowledgePath(config.opw2.path);

  try {
    const rawData = fs.readFileSync(kbPath, 'utf-8');
    const data = JSON.parse(rawData);
    opw2Data = isProgramKnowledge(data)
      ? normalizeProgramKnowledge(data, kbPath)
      : normalizeLegacyKnowledge(data, kbPath);

    console.log(`OPW2 knowledge loaded: ${opw2Data.vocabulary.length} words from ${kbPath}`);
    return opw2Data;
  } catch (error) {
    console.error('OPW2 knowledge load failed:', error.message);
    throw new Error(`Failed to load OPW2 knowledge base: ${error.message}`);
  }
}

export function getVocabularyByUnit(unitId) {
  return loadOPW2().vocabularyByUnit[unitId] || [];
}

export function findWord(word) {
  const clean = normalizeWord(word);
  return loadOPW2().vocabulary.find(item => normalizeWord(item.word) === clean) || null;
}

export function getAllSightWords() {
  return Object.values(loadOPW2().sightWordsByUnit).flat();
}

export function getStoryByUnit(unitId) {
  return loadOPW2().storiesByUnit[unitId]?.frames || [];
}

export function getChantsByUnit(unitId) {
  return loadOPW2().chantsByUnit[unitId] || [];
}

export function getCoverageById(coverageId) {
  return loadOPW2().coverageIndex?.by_id?.[coverageId] || null;
}

export function getCoverageByPage(page) {
  const data = loadOPW2();
  return idsToItems(data.coverageIndex?.by_page?.[page] || [], data);
}

export function getCoverageByUnit(unitId) {
  const data = loadOPW2();
  return idsToItems(data.coverageIndex?.by_unit?.[unitId] || [], data);
}

export function formatForPrompt() {
  const data = loadOPW2();
  if (data.prompt_slices?.compact) {
    return [
      '### OPW2 Program Knowledge',
      data.prompt_slices.compact,
      '',
      'Task rules:',
      '- Use source_refs with coverage_id values from this knowledge base.',
      '- Use knowledge_tags for unit, page, pattern, word, story, chant, or song.',
      '- Expand only from teacher input or the OPW2 in-scope items above.',
    ].join('\n');
  }

  return [
    '### OPW2 Phonics Knowledge',
    ...data.units.map(unit => {
      const words = (unit.patterns || []).flatMap(pattern => pattern.examples || []);
      const sight = unit.sight_words?.length ? ` | Sight Words: ${unit.sight_words.join(', ')}` : '';
      return `Unit ${unit.id}: ${words.join(', ')}${sight}`;
    }),
  ].join('\n');
}

export function isValidOPW2Word(word) {
  const clean = normalizeWord(word);
  return loadOPW2().vocabulary.some(item => normalizeWord(item.word) === clean);
}

function resolveKnowledgePath(inputPath) {
  const normalized = String(inputPath || '').replace(/\\/g, '/');
  const sourceDir = path.dirname(normalized);
  const programPath = path.join(sourceDir, 'opw2_program_knowledge.json').replace(/\\/g, '/');
  if (fs.existsSync(programPath)) return programPath;
  return normalized;
}

function isProgramKnowledge(data) {
  return data?.schema_version === 'opw2.program_knowledge.v1';
}

function normalizeProgramKnowledge(data, kbPath) {
  return {
    ...data,
    kbPath,
    vocabulary: data.vocabulary || [],
    vocabularyByUnit: data.coreVocabularyByUnit || data.vocabularyByUnit || buildVocabularyByUnit(data.units || []),
    fullVocabularyByUnit: data.vocabularyByUnit || buildVocabularyByUnit(data.units || []),
    supplementalVocabularyByUnit: data.supplementalVocabularyByUnit || {},
    sightWordsByUnit: normalizeSightWords(data),
    storiesByUnit: normalizeStories(data),
    chantsByUnit: normalizeChants(data),
    units: data.units || [],
    reviews: data.reviews || [],
    coverageIndex: data.coverage_index || data.coverageIndex || emptyCoverageIndex(),
    coverage_index: data.coverage_index || data.coverageIndex || emptyCoverageIndex(),
    prompt_slices: data.prompt_slices || {},
    raw: data.raw || data,
  };
}

function normalizeLegacyKnowledge(data, kbPath) {
  const vocabulary = [];
  const vocabularyByUnit = {};
  const sightWordsByUnit = {};
  const storiesByUnit = {};
  const chantsByUnit = {};
  const coverageIndex = emptyCoverageIndex();

  (data.units || []).forEach(unit => {
    const unitId = unit.id;
    const pages = parsePages(unit.pages);
    vocabularyByUnit[unitId] = [];

    (unit.patterns || []).forEach(pattern => {
      const patternId = `U${unitId}-PATTERN-${slug(pattern.pattern)}`;
      addCoverage(coverageIndex, {
        coverage_id: patternId,
        type: 'pattern',
        unit_id: unitId,
        pattern: pattern.pattern,
        examples: pattern.examples || [],
        source_pages: unit.pages,
      }, pages, pattern.examples || []);

      (pattern.examples || []).forEach(word => {
        const vocabEntry = {
          coverage_id: `U${unitId}-WORD-${slug(word)}`,
          word,
          unit: unitId,
          unit_id: unitId,
          pattern: pattern.pattern,
          phoneme: unit.phoneme,
        };
        vocabulary.push(vocabEntry);
        vocabularyByUnit[unitId].push(word);
        addCoverage(coverageIndex, { ...vocabEntry, type: 'word', source_pages: unit.pages }, pages, [word]);
      });
    });

    sightWordsByUnit[unitId] = unit.sight_words || [];
    (unit.sight_words || []).forEach(word => {
      addCoverage(coverageIndex, {
        coverage_id: `U${unitId}-SIGHT-${slug(word)}`,
        type: 'sight_word',
        unit_id: unitId,
        word,
        source_pages: unit.pages,
      }, pages, [word]);
    });

    if (unit.story) {
      storiesByUnit[unitId] = { title: unit.story.title, frames: unit.story.frames || [] };
      (unit.story.frames || []).forEach((text, index) => {
        addCoverage(coverageIndex, {
          coverage_id: `U${unitId}-STORY-${slug(unit.story.title)}-F${index + 1}`,
          type: 'story_frame',
          unit_id: unitId,
          text,
          story_title: unit.story.title,
          source_pages: String(unit.story.page || unit.pages),
        }, [Number(unit.story.page)].filter(Boolean), extractWords(text));
      });
    }

    chantsByUnit[unitId] = unit.chants || [];
    (unit.chants || []).forEach((text, index) => {
      addCoverage(coverageIndex, {
        coverage_id: `U${unitId}-CHANT-${index + 1}`,
        type: 'chant',
        unit_id: unitId,
        text,
        source_pages: unit.pages,
      }, pages, extractWords(text));
    });
  });

  return {
    schema_version: 'opw2.legacy.normalized.v1',
    kbPath,
    meta: data.meta,
    vocabulary,
    vocabularyByUnit,
    sightWordsByUnit,
    storiesByUnit,
    chantsByUnit,
    units: data.units || [],
    reviews: data.reviews || [],
    coverageIndex,
    coverage_index: coverageIndex,
    prompt_slices: {},
    raw: data,
  };
}

function normalizeSightWords(data) {
  if (data.sightWordsByUnit) {
    return Object.fromEntries(Object.entries(data.sightWordsByUnit).map(([unit, words]) => [
      unit,
      words.map(item => typeof item === 'string' ? item : item.word).filter(Boolean),
    ]));
  }
  return Object.fromEntries((data.units || []).map(unit => [
    unit.unit_id || unit.id,
    (unit.sight_words || []).map(item => typeof item === 'string' ? item : item.word).filter(Boolean),
  ]));
}

function normalizeStories(data) {
  if (data.storiesByUnit) return data.storiesByUnit;
  return Object.fromEntries((data.units || []).filter(unit => unit.story).map(unit => [
    unit.unit_id || unit.id,
    {
      title: unit.story.title,
      frames: (unit.story.frames || []).map(item => typeof item === 'string' ? item : item.text).filter(Boolean),
    },
  ]));
}

function normalizeChants(data) {
  if (data.chantsByUnit) return data.chantsByUnit;
  return Object.fromEntries((data.units || []).map(unit => [
    unit.unit_id || unit.id,
    (unit.chants || []).map(item => typeof item === 'string' ? item : item.text).filter(Boolean),
  ]));
}

function buildVocabularyByUnit(units) {
  return Object.fromEntries(units.map(unit => [
    unit.unit_id || unit.id,
    (unit.words || []).map(item => typeof item === 'string' ? item : item.word).filter(Boolean),
  ]));
}

function idsToItems(ids, data) {
  return ids.map(id => data.coverageIndex?.by_id?.[id]).filter(Boolean);
}

function emptyCoverageIndex() {
  return { by_id: {}, by_unit: {}, by_pattern: {}, by_word: {}, by_page: {} };
}

function addCoverage(index, item, pages = [], words = []) {
  index.by_id[item.coverage_id] = item;
  if (item.unit_id) pushIndex(index.by_unit, item.unit_id, item.coverage_id);
  if (item.pattern) pushIndex(index.by_pattern, item.pattern, item.coverage_id);
  words.forEach(word => pushIndex(index.by_word, normalizeWord(word), item.coverage_id));
  pages.forEach(page => pushIndex(index.by_page, page, item.coverage_id));
}

function pushIndex(group, key, value) {
  const safeKey = String(key || '').trim();
  if (!safeKey) return;
  group[safeKey] = group[safeKey] || [];
  if (!group[safeKey].includes(value)) group[safeKey].push(value);
}

function parsePages(value) {
  const text = String(value || '');
  const range = text.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  return [...text.matchAll(/\d+/g)].map(match => Number(match[0]));
}

function extractWords(value) {
  return [...String(value || '').toLowerCase().matchAll(/\b[a-z]{1,12}\b/g)].map(match => match[0]);
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function slug(value) {
  return String(value || 'item')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    || 'item';
}

export default {
  loadOPW2,
  getVocabularyByUnit,
  findWord,
  getAllSightWords,
  getStoryByUnit,
  getChantsByUnit,
  getCoverageById,
  getCoverageByPage,
  getCoverageByUnit,
  formatForPrompt,
  isValidOPW2Word,
};
