import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { loadOPW2 } from './opw2_loader.js';

let cached = null;

const SHORT_VOWELS = ['short a', 'short e', 'short i', 'short o', 'short u'];
const CVC_PATTERN = /^[bcdfghjklmnpqrstvwxyz]?[aeiou][bcdfghjklmnpqrstvwxyz]+$/i;

export function loadPhonicsKnowledge() {
  if (cached) return cached;

  const externalPath = config.phonics?.path;
  if (externalPath && fs.existsSync(externalPath)) {
    cached = normalizeExternalKnowledge(readJsonOrMarkdown(externalPath), externalPath);
    return cached;
  }

  cached = deriveFromOPW2();
  return cached;
}

export function buildPhonicsScope(requirements = {}, confirmedAnalysis = null) {
  const knowledge = loadPhonicsKnowledge();
  const selectedPoints = selectedPhonicsValues(confirmedAnalysis);
  const requestedUnits = requirements.requested_phonics_units || [];
  const requestedPages = requirements.requested_pages || [];
  const hasPhonicsIntent = selectedPoints.length > 0
    || requestedUnits.length > 0
    || (requirements.requested_skills || []).includes('phonics_blending');

  if (!hasPhonicsIntent) {
    return {
      source: knowledge.source,
      rules: [],
      words: [],
      source_refs: [],
    };
  }

  const matchingRules = knowledge.rules.filter(rule => {
    if (selectedPoints.some(value => rule.keywords.some(keyword => includesNormalized(value, keyword)))) return true;
    if (requestedUnits.length && requestedUnits.includes(rule.unit)) return true;
    if (requestedPages.length && rule.pages.some(page => requestedPages.includes(page))) return true;
    return false;
  });

  const rules = matchingRules.length ? matchingRules : knowledge.rules.slice(0, 12);
  return {
    source: knowledge.source,
    rules,
    words: unique(rules.flatMap(rule => rule.words)).slice(0, 120),
    source_refs: unique(rules.flatMap(rule => rule.source_refs)),
  };
}

export function formatPhonicsForPrompt(scope = null) {
  const activeScope = scope || buildPhonicsScope();
  const lines = [
    '### Natural Phonics Knowledge',
    `Source: ${activeScope.source || 'opw2_derived'}`,
    '- Use these rules to plan phonics, blending, segmenting, spelling, reading aloud, and writing tasks.',
    '- Keep source_refs when a task uses a listed rule or word.',
  ];

  activeScope.rules.slice(0, 24).forEach(rule => {
    lines.push(`- ${rule.id}: ${rule.label}; pattern=${rule.pattern}; words=${rule.words.slice(0, 16).join(', ')}; source_refs=${rule.source_refs.slice(0, 6).join(', ')}`);
  });

  return lines.join('\n');
}

function deriveFromOPW2() {
  const opw2 = loadOPW2();
  const rulesByKey = new Map();

  Object.values(opw2.coverageIndex?.by_id || {}).forEach(item => {
    const words = wordsForItem(item);
    if (!words.length) return;

    const unit = Number(item.unit || item.unit_id || 0);
    words.forEach(word => {
      const rule = classifyWord(word, item, unit);
      if (!rule) return;
      const existing = rulesByKey.get(rule.id) || { ...rule, words: [], source_refs: [], pages: [] };
      existing.words.push(word);
      if (item.coverage_id) existing.source_refs.push(item.coverage_id);
      if (Number.isInteger(item.page)) existing.pages.push(item.page);
      rulesByKey.set(rule.id, existing);
    });
  });

  const rules = [...rulesByKey.values()].map(rule => ({
    ...rule,
    words: unique(rule.words).sort(),
    source_refs: unique(rule.source_refs),
    pages: unique(rule.pages).sort((a, b) => a - b),
  })).sort((a, b) => a.id.localeCompare(b.id));

  return {
    source: 'opw2_derived_oxford_phonics_world',
    rules,
    generated_at: new Date().toISOString(),
  };
}

function classifyWord(word, item, unit) {
  const clean = normalizeWord(word);
  if (!clean || clean.length < 2) return null;
  const family = wordFamily(clean);
  const vowel = firstVowel(clean);
  const labelPrefix = vowel ? `short ${vowel}` : 'phonics';
  const pattern = CVC_PATTERN.test(clean) ? 'CVC' : family ? `word_family_${family}` : 'phonics_word';
  const sourceLabel = String(item.title || item.pattern || item.type || '').toLowerCase();
  const sourceShortVowel = SHORT_VOWELS.find(label => sourceLabel.includes(label));
  const label = sourceShortVowel || (family ? `${labelPrefix} / ${family}` : labelPrefix);

  return {
    id: `PHONICS_${unit || 'X'}_${family || vowel || 'WORD'}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
    label,
    pattern,
    unit,
    keywords: unique([label, pattern, family, vowel, clean].filter(Boolean)),
  };
}

function normalizeExternalKnowledge(raw, sourcePath) {
  if (typeof raw === 'object' && raw !== null) {
    if (raw.schema_version === 'opw2.program_knowledge.v1' || raw.coverage_index || raw.coverageIndex) {
      return normalizeProgramKnowledgeAsPhonics(raw, sourcePath);
    }
    const rules = Array.isArray(raw.rules) ? raw.rules : Array.isArray(raw.phonics_points) ? raw.phonics_points : [];
    return {
      source: sourcePath,
      rules: rules.map((rule, index) => ({
        id: rule.id || `PHONICS_EXTERNAL_${index + 1}`,
        label: String(rule.label || rule.name || rule.pattern || 'phonics rule'),
        pattern: String(rule.pattern || rule.type || 'phonics'),
        unit: Number(rule.unit || 0),
        pages: Array.isArray(rule.pages) ? rule.pages.map(Number).filter(Number.isFinite) : [],
        words: unique((rule.words || rule.examples || []).map(normalizeWord).filter(Boolean)),
        source_refs: Array.isArray(rule.source_refs) ? rule.source_refs.map(String) : [`phonics:${index + 1}`],
        keywords: unique([rule.label, rule.name, rule.pattern, ...(rule.words || [])].map(String).filter(Boolean)),
      })).filter(rule => rule.words.length || rule.label),
    };
  }

  const words = unique(String(raw || '').toLowerCase().match(/\b[a-z]{2,12}\b/g) || []);
  return {
    source: sourcePath,
    rules: [{
      id: 'PHONICS_EXTERNAL_MARKDOWN',
      label: 'external phonics markdown',
      pattern: 'phonics',
      unit: 0,
      pages: [],
      words,
      source_refs: ['phonics:external_markdown'],
      keywords: ['phonics', 'markdown', ...words.slice(0, 20)],
    }],
  };
}

function normalizeProgramKnowledgeAsPhonics(raw, sourcePath) {
  const coverage = raw.coverage_index || raw.coverageIndex || {};
  const rulesByKey = new Map();
  Object.values(coverage.by_id || {}).forEach(item => {
    const words = wordsForItem(item);
    if (!words.length) return;
    const unit = Number(item.unit || item.unit_id || 0);
    words.forEach(word => {
      const rule = classifyWord(word, item, unit);
      if (!rule) return;
      const existing = rulesByKey.get(rule.id) || { ...rule, words: [], source_refs: [], pages: [] };
      existing.words.push(normalizeWord(word));
      if (item.coverage_id) existing.source_refs.push(item.coverage_id);
      (item.source_pages || item.pages || []).toString().split(/[^0-9]+/).map(Number).filter(Number.isFinite).forEach(page => existing.pages.push(page));
      rulesByKey.set(rule.id, existing);
    });
  });

  return {
    source: sourcePath,
    rules: [...rulesByKey.values()].map(rule => ({
      ...rule,
      words: unique(rule.words).sort(),
      source_refs: unique(rule.source_refs),
      pages: unique(rule.pages).sort((a, b) => a - b),
      keywords: unique([...(rule.keywords || []), ...rule.words].filter(Boolean)),
    })).sort((a, b) => a.id.localeCompare(b.id)),
    generated_at: new Date().toISOString(),
  };
}

function readJsonOrMarkdown(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (path.extname(filePath).toLowerCase() === '.json') {
    return JSON.parse(text);
  }
  return text;
}

function wordsForItem(item) {
  if (item.word) return [item.word];
  if (Array.isArray(item.words)) return item.words;
  if (Array.isArray(item.examples)) return item.examples;
  return String(item.text || item.lyrics || '').match(/\b[a-z]{2,12}\b/g) || [];
}

function selectedPhonicsValues(analysis) {
  const raw = analysis?.phonics_points || analysis?.skills || [];
  return (Array.isArray(raw) ? raw : [])
    .filter(item => item?.selected !== false)
    .map(item => String(item?.value || item?.label || item || '').toLowerCase())
    .filter(Boolean);
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function firstVowel(word) {
  return normalizeWord(word).match(/[aeiou]/)?.[0] || '';
}

function wordFamily(word) {
  const clean = normalizeWord(word);
  const match = clean.match(/[aeiou]([bcdfghjklmnpqrstvwxyz]+)$/i);
  return match ? `${firstVowel(clean)}${match[1]}` : '';
}

function includesNormalized(value, keyword) {
  return String(value || '').toLowerCase().includes(String(keyword || '').toLowerCase());
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

export default {
  loadPhonicsKnowledge,
  buildPhonicsScope,
  formatPhonicsForPrompt,
};
