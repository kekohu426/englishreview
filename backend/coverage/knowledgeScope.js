import { loadOPW2 } from '../knowledge/opw2_loader.js';
import { buildCustomMaterialScope } from '../knowledge/customMaterials.js';
import { normalizeCourseWords } from '../knowledge/wordNormalizer.js';

export function buildKnowledgeScope(requirements) {
  const opw2 = loadOPW2();
  const units = requirements.requested_units || [];
  const pages = requirements.requested_pages || [];
  const pageScopes = pages.map(page => buildPageScope(page, opw2)).filter(Boolean);
  const customMaterials = buildCustomMaterialScope(requirements.source_routing?.source_scopes || {});

  const unitVocabulary = {};
  const unitSightWords = {};
  const unitStories = {};
  const unitChants = {};
  const unitCoverage = {};

  units.forEach(unit => {
    unitVocabulary[unit] = normalizeCourseWords(opw2.vocabularyByUnit?.[unit] || []);
    unitSightWords[unit] = opw2.sightWordsByUnit?.[unit] || [];
    unitStories[unit] = opw2.storiesByUnit?.[unit]?.frames || [];
    unitChants[unit] = opw2.chantsByUnit?.[unit] || [];
    unitCoverage[unit] = idsToItems(opw2.coverageIndex?.by_unit?.[unit] || [], opw2);
  });

  return {
    units,
    pages,
    unit_vocabulary: unitVocabulary,
    unit_sight_words: unitSightWords,
    unit_stories: unitStories,
    unit_chants: unitChants,
    unit_coverage: unitCoverage,
    page_scopes: pageScopes,
    all_unit_words: normalizeCourseWords(units.flatMap(unit => unitVocabulary[unit] || [])),
    page_words: normalizeCourseWords(pageScopes.flatMap(page => page.words || [])),
    page_sentences: unique(pageScopes.flatMap(page => page.sentences || [])),
    page_activities: unique(pageScopes.flatMap(page => page.activities || [])),
    custom_materials: customMaterials.materials,
    custom_words: customMaterials.words,
    custom_sentences: customMaterials.sentences,
    source_refs: unique([
      ...Object.values(unitCoverage).flat().map(item => item.coverage_id),
      ...pageScopes.flatMap(page => page.coverage_ids || []),
      ...customMaterials.source_refs,
    ]),
    coverage_index_schema: opw2.schema_version,
  };
}

export function loadMarkdownIndex() {
  return {
    root: loadOPW2().kbPath,
    pages: Object.fromEntries(Object.keys(loadOPW2().coverageIndex?.by_page || {}).map(page => [
      page,
      buildPageScope(Number(page), loadOPW2()),
    ])),
  };
}

function buildPageScope(page, opw2) {
  const ids = opw2.coverageIndex?.by_page?.[page] || [];
  const items = idsToItems(ids, opw2);
  if (!items.length) return null;

  return {
    page,
    title: `Page ${page}`,
    activities: unique(items.map(activityForItem).filter(Boolean)),
    words: unique(items.flatMap(wordsForItem)),
    sentences: unique(items.map(sentenceForItem).filter(Boolean)),
    text: items.map(textForItem).filter(Boolean).join('\n'),
    coverage_ids: ids,
    coverage_items: items,
  };
}

function idsToItems(ids, opw2) {
  return ids.map(id => opw2.coverageIndex?.by_id?.[id]).filter(Boolean);
}

function activityForItem(item) {
  return {
    story_frame: 'story',
    chant: 'chant',
    review_song: 'song',
    song_line: 'song',
    word: 'word',
    sight_word: 'sight_word',
    pattern: 'pattern',
  }[item.type] || item.type;
}

function wordsForItem(item) {
  if (item.word) return normalizeCourseWords([item.word]);
  if (Array.isArray(item.words)) return normalizeCourseWords(item.words);
  if (Array.isArray(item.examples)) return normalizeCourseWords(item.examples);
  return extractWords(item.text || item.lyrics || '');
}

function sentenceForItem(item) {
  return item.text || item.lyrics || '';
}

function textForItem(item) {
  if (item.word) return item.word;
  if (item.pattern) return `${item.pattern}: ${(item.examples || []).join(', ')}`;
  return item.text || item.lyrics || item.title || '';
}

function extractWords(value) {
  return normalizeCourseWords([...String(value || '').toLowerCase().matchAll(/\b[a-z]{1,20}(?:\s+[a-z]{1,20})?\b/g)].map(match => match[0]));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export default {
  buildKnowledgeScope,
  loadMarkdownIndex,
};
