import { getCustomSourceDefinitions } from '../knowledge/customMaterials.js';
import { SOURCE_REGISTRY, parsePagesFromText, routeHomeworkSources } from './sourceRouter.js';

export function parseRequirements(inputText = '', context = {}) {
  const raw = String(inputText || '');
  const text = raw.toLowerCase();
  const sourceRouting = routeHomeworkSources(raw, [...SOURCE_REGISTRY, ...getCustomSourceDefinitions()], context);
  const requestedUnits = sourceRouting.opw2_units;
  const requestedPages = unique([
    ...sourceRouting.opw2_pages,
    ...parsePagesFromText(raw),
  ]);
  const requestedPatterns = [];
  const requestedSkills = [];
  const requestedSources = [];

  if (/how\s*much/i.test(raw)) requestedPatterns.push('How much');
  if (/how\s*many/i.test(raw)) requestedPatterns.push('How many');
  if (/countable|uncountable|\u53ef\u6570|\u4e0d\u53ef\u6570/.test(text)) requestedSkills.push('countable_uncountable');
  if (/phonics|natural phonics|\u81ea\u7136\u62fc\u8bfb|\u81ea\u62fc|\u62fc\u8bfb|\u725b\u6d25\u81ea\u7136\u62fc\u8bfb/.test(text)) requestedSkills.push('phonics_blending');
  if (/spelling|spell|\u62fc\u5199|\u5199\u51fa|\u8ddf\u5199/.test(text)) requestedSkills.push('spelling');
  if (/qa|question|answer|\u95ee\u7b54|\u53e5\u578b/.test(text)) requestedSkills.push('mixed_qa');
  if (/(?:^|[^a-z])(?:alphabet|a-?z)(?:[^a-z]|$)/.test(text) || /\b26\s*(letters?|alphabet)\b/i.test(raw) || /26\s*\u5b57\u6bcd/.test(raw)) {
    requestedSkills.push('alphabet_reference');
  }

  if (/textbook|page|p\d+|\u8bfe\u672c|\u6559\u6750|\u7ec3\u4e60/.test(text)) requestedSources.push('textbook_page');
  if (/song|chant|\u6b4c\u66f2|\u6b4c\u5531/.test(text)) requestedSources.push('song_or_chant');
  if (/review|\u590d\u4e60/.test(text)) requestedSources.push('unit_review');
  if (sourceRouting.source_routes.some(route => route.sources.includes('opw2_textbook'))) requestedSources.push('opw2_textbook');
  if (
    sourceRouting.source_routes.some(route => route.sources.includes('oxford_phonics')) ||
    sourceRouting.source_scopes?.oxford_phonics?.selected
  ) requestedSources.push('oxford_phonics');

  return {
    raw_text: raw,
    requested_units: requestedUnits,
    requested_phonics_units: sourceRouting.phonics_units,
    requested_pages: requestedPages.sort((a, b) => a - b),
    requested_patterns: unique(requestedPatterns),
    requested_skills: unique(requestedSkills),
    requested_sources: unique(requestedSources),
    source_routing: sourceRouting,
    alphabet: [],
  };
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

export default {
  parseRequirements,
};
