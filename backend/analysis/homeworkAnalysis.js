import config from '../config.js';
import { parseRequirements } from '../coverage/requirements.js';
import { buildKnowledgeScope } from '../coverage/knowledgeScope.js';
import { buildPhonicsScope } from '../knowledge/phonics_loader.js';
import { listCustomMaterials } from '../knowledge/customMaterials.js';
import { normalizeCourseWord } from '../knowledge/wordNormalizer.js';

const ANALYSIS_LLM_TIMEOUT_MS = 8000;
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'he', 'she', 'it', 'is', 'are', 'am', 'and', 'or',
  'can', 'see', 'use', 'open', 'this', 'that', 'these', 'now', 'try', 'like',
  'with', 'my', 'your', 'his', 'her', 'there', 'some', 'unit', 'review',
  'practice', 'textbook', 'listening', 'reading', 'writing', 'speaking',
  'simple', 'sentence', 'sentences', 'word', 'words', 'question', 'questions',
]);
const PATTERN_FUNCTION_WORDS = new Set([
  ...STOP_WORDS,
  'what', 'where', 'who', 'how', 'do', 'does', 'did', 'is', 'are', 'am', 'be',
  'i', 'me', 'we', 'us', 'you', 'he', 'she', 'it', 'they', 'them',
  'have', 'has', 'like', 'want', 'see', 'smell', 'taste', 'touch', 'hear',
  'wear', 'wearing', 'eat', 'please', 'yes', 'no',
]);
const UNIT2_SENSE_PATTERNS = [
  'What do you smell with? I smell with my nose.',
  'What do you taste with? I taste with my tongue.',
  'What do you touch with? I touch with my hands.',
  'What do you hear with? I hear with my ears.',
  'What do you see with? I see with my eyes.',
];

export async function analyzeHomework(content = '', context = {}) {
  const base = buildRuleBasedAnalysis(content, context);
  let aiHints = null;

  try {
    aiHints = await analyzeWithLlm(content, base);
  } catch (error) {
    console.warn(`[homework-analysis] AI enrichment skipped: ${shortError(error)}`);
  }

  const merged = aiHints ? mergeAiHints(base, aiHints) : base;
  return {
    ...merged,
    analysis_id: `analysis-${Date.now().toString(36)}`,
    mode: aiHints ? 'ai_materials' : 'rules_materials',
  };
}

export function buildRuleBasedAnalysis(content = '', context = {}) {
  const rawText = String(content || '');
  const requirements = parseRequirements(rawText, context);
  const knowledgeScope = buildKnowledgeScope(requirements);
  const phonicsScope = buildPhonicsScope(requirements);
  const teacherWords = extractTeacherWords(rawText).filter(word => !customAliasWords().has(word));
  const scopedWords = unique([
    ...teacherWords,
    ...(knowledgeScope.page_words || []),
    ...(knowledgeScope.all_unit_words || []),
    ...(knowledgeScope.custom_words || []),
  ]).filter(isUsefulWord);

  const words = scopedWords.map(word => item(`word:${word}`, word, teacherWords.includes(word) ? 'teacher_input' : 'opw2_kb', true));
  const sentencePatterns = unique([
    ...requirements.requested_patterns,
    ...inferPatterns(rawText),
    ...unitSentences(knowledgeScope),
    ...(knowledgeScope.custom_sentences || []),
  ]).map(pattern => item(`pattern:${slug(pattern)}`, pattern, patternSource(pattern, rawText), true));
  const grammarPoints = unique([
    ...inferGrammar(rawText, requirements),
    ...unitGrammarPoints(knowledgeScope),
  ]).map(point => item(`grammar:${slug(point)}`, point, grammarSource(point, rawText), true));
  const phonicsPoints = phonicsScope.rules.slice(0, 16).map(rule => item(rule.id, rule.label, 'phonics_kb', true, rule.pattern));
  const skills = requirements.requested_skills.map(skill => item(`skill:${skill}`, skill, 'teacher_input', true));
  const sourceRefs = [
    ...sourceBindingItems(requirements),
    ...requirements.requested_units.map(unit => item(`source:unit:${unit}`, `Unit ${unit}`, 'teacher_input', true)),
    ...(requirements.requested_phonics_units || []).map(unit => item(`source:phonics_unit:${unit}`, `Phonics Unit ${unit}`, 'teacher_input', true)),
    ...requirements.requested_pages.map(page => item(`source:page:${page}`, `Page ${page}`, 'teacher_input', true)),
    ...requirements.requested_sources.map(source => item(`source:${source}`, source, 'teacher_input', true)),
    ...(knowledgeScope.custom_materials || []).map(material => item(`source:custom:${material.id}`, material.label, 'custom_material', true)),
    ...phonicsScope.source_refs.slice(0, 12).map(ref => item(`source:${ref}`, ref, 'phonics_kb', false)),
  ];

  return normalizeAnalysisShape({
    raw_text: rawText,
    material_context: context,
    requested_units: requirements.requested_units,
    requested_pages: requirements.requested_pages,
    words,
    target_words: words,
    sentence_patterns: sentencePatterns,
    grammar_points: grammarPoints,
    phonics_points: phonicsPoints,
    skills,
    source_refs: sourceRefs,
    editable_flags: {
      words: true,
      sentence_patterns: true,
      grammar_points: true,
      phonics_points: true,
    },
    warnings: [],
    coverage_preview: {
      units: requirements.requested_units,
      pages: requirements.requested_pages,
      word_count: words.length,
      pattern_count: sentencePatterns.length,
      grammar_count: grammarPoints.length,
      phonics_count: phonicsPoints.length,
      abilities: ['listening', 'speaking', 'reading', 'writing'],
    },
    requirements: { ...requirements, material_context: context },
    knowledge_scope: knowledgeScope,
    phonics_scope: phonicsScope,
  });
}

export function normalizeConfirmedAnalysis(content = '', confirmedAnalysis = null) {
  const materialContext = confirmedAnalysis?.material_context
    || confirmedAnalysis?.materialContext
    || confirmedAnalysis?.requirements?.material_context
    || {};
  const base = buildRuleBasedAnalysis(content || confirmedAnalysis?.raw_text || '', materialContext);
  const merged = normalizeAnalysisShape({
    ...base,
    ...(confirmedAnalysis || {}),
    raw_text: content || confirmedAnalysis?.raw_text || base.raw_text,
    material_context: materialContext,
  });

  const selectedUnits = unique([
    ...(base.requested_units || []),
    ...(base.requirements?.requested_units || []),
    ...(merged.requested_units || []),
    ...(merged.requirements?.requested_units || []),
    ...selectedValues(merged.source_refs).map(value => Number(String(value).match(/unit\s*(\d+)/i)?.[1])).filter(Number.isFinite),
  ].map(Number).filter(Number.isFinite));
  const unitWordAllowlist = new Set((base.knowledge_scope?.all_unit_words || [])
    .map(normalizeWordForValue)
    .filter(Boolean));
  const selectedWords = selectedValues(merged.words)
    .map(normalizeWordForValue)
    .filter(isUsefulWord)
    .filter(word => selectedUnits.length && unitWordAllowlist.size ? unitWordAllowlist.has(word) : true);
  const selectedPatterns = selectedValues(merged.sentence_patterns);
  const selectedGrammar = selectedValues(merged.grammar_points);
  const selectedPhonics = selectedValues(merged.phonics_points);
  const selectedPages = unique([
    ...(base.requested_pages || []),
    ...(base.requirements?.requested_pages || []),
    ...(merged.requested_pages || []),
    ...(merged.requirements?.requested_pages || []),
    ...selectedValues(merged.source_refs).map(value => Number(String(value).match(/(?:page|p)\s*(\d+)/i)?.[1])).filter(Number.isFinite),
  ].map(Number).filter(Number.isFinite));
  const selectedPhonicsUnits = unique([
    ...(base.requested_phonics_units || []),
    ...(base.requirements?.requested_phonics_units || []),
    ...(merged.requested_phonics_units || []),
    ...(merged.requirements?.requested_phonics_units || []),
    ...selectedValues(merged.source_refs).map(value => Number(String(value).match(/phonics\s*unit\s*(\d+)/i)?.[1])).filter(Number.isFinite),
  ].map(Number).filter(Number.isFinite));

  const requirements = {
    ...(merged.requirements || parseRequirements(merged.raw_text || '', materialContext)),
    raw_text: merged.raw_text || '',
    requested_units: selectedUnits,
    requested_phonics_units: selectedPhonicsUnits,
    requested_pages: selectedPages,
    requested_patterns: unique([
      ...(merged.requirements?.requested_patterns || []),
      ...selectedPatterns.filter(pattern => /^how\s+(much|many)$/i.test(pattern)),
    ]),
    requested_skills: unique([
      ...(merged.requirements?.requested_skills || []),
      ...grammarSkills(selectedGrammar),
      ...(selectedPhonics.length ? ['phonics_blending'] : []),
    ]),
  };
  const knowledgeScope = buildKnowledgeScope(requirements);
  knowledgeScope.confirmed_words = selectedWords;
  knowledgeScope.all_unit_words = unique([...(knowledgeScope.all_unit_words || []), ...selectedWords]);
  const phonicsScope = buildPhonicsScope(requirements, merged);

  return {
    requirements,
    knowledgeScope,
    phonicsScope,
    confirmedAnalysis: {
      ...merged,
      words: normalizeItems(merged.words),
      target_words: normalizeItems(merged.words),
      sentence_patterns: normalizeItems(merged.sentence_patterns),
      grammar_points: normalizeItems(merged.grammar_points),
      phonics_points: normalizeItems(merged.phonics_points),
      skills: normalizeItems(merged.skills),
      source_refs: normalizeItems(merged.source_refs),
      editable_flags: merged.editable_flags || {},
    },
  };
}

function normalizeAnalysisShape(analysis) {
  const words = normalizeItems(analysis.words || analysis.target_words || []);
  return {
    ...analysis,
    words,
    target_words: words,
    sentence_patterns: normalizeItems(analysis.sentence_patterns || []),
    grammar_points: normalizeItems(analysis.grammar_points || []),
    phonics_points: normalizeItems(analysis.phonics_points || []),
    skills: normalizeItems(analysis.skills || []),
    source_refs: normalizeItems(analysis.source_refs || []),
    editable_flags: analysis.editable_flags || {
      words: true,
      sentence_patterns: true,
      grammar_points: true,
      phonics_points: true,
    },
  };
}

async function analyzeWithLlm(content, base) {
  if (!config.llm.apiKey || process.env.ANALYZE_HOMEWORK_LLM === 'false') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_LLM_TIMEOUT_MS);
  try {
    const prompt = [
      'Analyze this homework for a kids English review app.',
      'Return JSON only with arrays: words, sentence_patterns, grammar_points, phonics_points, warnings.',
      'Only include words from teacher text, OPW2 scope, or phonics scope.',
      `Known words: ${base.words.map(entry => entry.value).slice(0, 120).join(', ')}`,
      `Known phonics: ${base.phonics_points.map(entry => entry.value).slice(0, 40).join(', ')}`,
      `Teacher text:\n${content}`,
    ].join('\n\n');

    const response = await fetch(llmUrl(), {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify(llmPayload(prompt)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const data = await response.json();
    const text = config.llm.provider === 'openai'
      ? data.choices?.[0]?.message?.content
      : data.content?.find(part => part.type === 'text')?.text;
    if (!text) return null;
    return JSON.parse(extractJson(text));
  } finally {
    clearTimeout(timer);
  }
}

function mergeAiHints(base, aiHints) {
  const allowedWords = new Set(base.words.map(entry => entry.value));
  const teacherWords = new Set(extractTeacherWords(base.raw_text));
  const words = [...base.words];
  (aiHints.words || aiHints.target_words || []).forEach(raw => {
    const word = normalizeWord(raw?.value || raw);
    if (!word || (!allowedWords.has(word) && !teacherWords.has(word))) return;
    words.push(item(`word:ai:${word}`, word, 'ai_inferred', false));
  });

  return normalizeAnalysisShape({
    ...base,
    words: dedupeItems(words),
    sentence_patterns: dedupeItems([...base.sentence_patterns, ...(aiHints.sentence_patterns || []).map(value => item(`pattern:ai:${slug(value)}`, value, 'ai_inferred', false))]),
    grammar_points: dedupeItems([...base.grammar_points, ...(aiHints.grammar_points || []).map(value => item(`grammar:ai:${slug(value)}`, value, 'ai_inferred', false))]),
    phonics_points: dedupeItems([...base.phonics_points, ...(aiHints.phonics_points || []).map(value => item(`phonics:ai:${slug(value)}`, value, 'ai_inferred', false))]),
    warnings: [
      ...(base.warnings || []),
      ...filterAiWarnings(aiHints.warnings, base).slice(0, 3),
    ],
  });
}

function sourceBindingItems(requirements) {
  const routes = requirements.source_routing?.source_routes || [];
  const sourceIds = new Set(routes.flatMap(route => route.sources || []));
  const bindings = [];
  if (sourceIds.has('opw2_textbook') || requirements.requested_units?.length) {
    bindings.push(item('source-binding:opw2_textbook', '课本 = Big Fun 2', 'system_router', true));
  }
  if (sourceIds.has('oxford_phonics') || requirements.requested_phonics_units?.length) {
    bindings.push(item('source-binding:oxford_phonics', '自然拼读 = Oxford Phonics', 'system_router', true));
  }
  return bindings;
}

function unitSentences(knowledgeScope) {
  const units = (knowledgeScope.units || []).map(Number);
  const coveragePatterns = [];
  Object.values(knowledgeScope.unit_coverage || {}).flat().forEach(item => {
    if (item?.type === 'pattern' && item.pattern) {
      const normalized = normalizePatternText(item.pattern);
      if (isUsefulPatternForScope(normalized, knowledgeScope, units)) coveragePatterns.push(normalized);
    }
    (item?.examples || []).forEach(example => {
      const normalized = normalizePatternText(example);
      if (isUsefulPatternForScope(normalized, knowledgeScope, units)) coveragePatterns.push(normalized);
    });
  });
  const base = unique([
    ...coveragePatterns,
    ...Object.values(knowledgeScope.unit_stories || {}).flat(),
    ...Object.values(knowledgeScope.unit_chants || {}).flat(),
    ...(knowledgeScope.page_sentences || []),
  ])
    .map(normalizePatternText)
    .filter(pattern => isUsefulPatternForScope(pattern, knowledgeScope, units));
  return unique([
    ...(units.includes(2) ? UNIT2_SENSE_PATTERNS : []),
    ...base,
  ]);
}

function unitGrammarPoints(knowledgeScope) {
  const points = [];
  const units = (knowledgeScope.units || []).map(Number);
  Object.values(knowledgeScope.unit_coverage || {}).flat().forEach(item => {
    if (item?.type === 'pattern' && item.pattern) {
      const normalized = normalizePatternText(item.pattern);
      if (isUsefulPatternForScope(normalized, knowledgeScope, units)) points.push(normalized);
    }
    if (item?.rule) points.push(item.rule);
  });
  return unique([
    ...(units.includes(2) ? UNIT2_SENSE_PATTERNS : []),
    ...points,
  ].filter(Boolean));
}

function normalizePatternText(value) {
  const text = String(value || '').replace(/\(([^)]+)\)/g, '$1').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  if (isMalformedKnowledgeText(text)) return '';
  if (/what do you .*smell.*with|i smell with my nose/.test(lower)) return 'What do you smell with? I smell with my nose.';
  if (/what do you .*taste.*with|i taste with my tongue|what do you tongue with|i tongue with my tongue/.test(lower)) return 'What do you taste with? I taste with my tongue.';
  if (/what do you .*touch.*with|i touch with my hand/.test(lower)) return 'What do you touch with? I touch with my hands.';
  if (/what do you .*hear.*with|i hear with my ear/.test(lower)) return 'What do you hear with? I hear with my ears.';
  if (/what do you .*see.*with|i see with my eye/.test(lower)) return 'What do you see with? I see with my eyes.';
  if (/who\s+she\??.*she\s+is\s+my\s+grandmother/.test(lower)) return 'Who is she? She is my grandmother.';
  if (/who\s+he\??.*he\s+is\s+my\s+grandfather/.test(lower)) return 'Who is he? He is my grandfather.';
  if (/who\s+grandfather|grandfather\s+is\s+my\s+grandfather/.test(lower)) return 'Who is he? He is my grandfather.';
  if (/it\s+is\s+my\s+grandfather|this\s+is\s+my\s+grandfather/.test(lower)) return 'Who is he? He is my grandfather.';
  if (/it\s+is\s+my\s+grandmother|this\s+is\s+my\s+grandmother/.test(lower)) return 'Who is she? She is my grandmother.';
  if (/she\s+is\s+my\s+cousin/.test(lower)) return 'Who is she? She is my cousin.';
  if (/she\s+is\s+my\s+aunt/.test(lower)) return 'Who is she? She is my aunt.';
  if (/he\s+is\s+my\s+uncle/.test(lower)) return 'Who is he? He is my uncle.';
  return text;
}

function isMalformedKnowledgeText(value) {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (!text) return true;
  if (/^\w+(?:,\s*\w+)+\s*\d+$/.test(lower)) return true;
  if (/^\w+$/.test(lower)) return true;
  if (/\(\s*\)|\[\s*\]|\{\s*\}/.test(text)) return true;
  if ((text.match(/\(/g) || []).length !== (text.match(/\)/g) || []).length) return true;
  if (/\b[a-z]{3,}y\b/.test(lower) && /\)\w|\(\)/.test(lower)) return true;
  if (/\b(?:yo u|th is|wh at|gr and|grandfathery)\b/.test(lower)) return true;
  if (/this is\/these are|grandparents language/.test(lower)) return true;
  if (/[A-Za-z]\)[A-Za-z]/.test(text)) return true;
  if (/^who\s+[a-z]+\?\s+[a-z]+\s+is\s+my\s+[a-z]+\.?$/i.test(text)) return true;
  if (/^where does\s+[a-z]+\s+live\s*[锛?]\s+[a-z]+\.?$/i.test(text)) return true;
  return false;
}

function isUsefulPatternForUnits(pattern, units = []) {
  const text = String(pattern || '').trim();
  const lower = text.toLowerCase();
  if (!text || isMalformedKnowledgeText(text)) return false;
  return /[a-z]{2,}/i.test(text) && isTeachablePatternText(lower);
}

function isUsefulPatternForScope(pattern, knowledgeScope, units = []) {
  if (!isUsefulPatternForUnits(pattern, units)) return false;
  const scopedWords = new Set(normalizeCourseWordsForScope(knowledgeScope.all_unit_words || []));
  if (!scopedWords.size) return true;
  const contentWords = extractPatternContentWords(pattern);
  return contentWords.every(word => !isCourseContentWord(word) || scopedWords.has(word));
}

function isTeachablePatternText(lower) {
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) return false;
  if (/^(?:he|she|it|they|we|you)\s+(?:is|are|am)\s+not\.?$/.test(lower)) return false;
  if (/\ball\s+my\s+family\b/.test(lower)) return false;
  if (/\boh,?\s*no\b/.test(lower)) return false;
  if (/\b[a-z]+\s*,\s*[a-z]+/.test(lower) && !/[?]/.test(lower)) return false;
  if (/^(?:what|where|who|how|do|does|is|are|can)\b/.test(lower)) return true;
  if (/^(?:i|you|he|she|they|we|this|these|there)\b/.test(lower) && /\b(?:like|want|have|see|smell|taste|touch|hear|wear|wearing|is|are)\b/.test(lower)) {
    return wordCount >= 4;
  }
  return false;
}

function normalizeCourseWordsForScope(words = []) {
  return unique(words.map(normalizeWordForValue).filter(Boolean));
}

function extractPatternContentWords(value) {
  return unique((String(value || '').toLowerCase().match(/\b[a-z]{2,20}\b/g) || [])
    .map(normalizeWordForValue)
    .filter(Boolean)
    .filter(word => !PATTERN_FUNCTION_WORDS.has(word)));
}

function isCourseContentWord(word) {
  return !!normalizeCourseWord(word) && !PATTERN_FUNCTION_WORDS.has(word);
}

function patternSource(pattern, rawText) {
  return String(rawText || '').includes(pattern) ? 'teacher_input' : 'knowledge_base';
}

function grammarSource(point, rawText) {
  return String(rawText || '').includes(point) ? 'teacher_input' : 'knowledge_base';
}

function filterAiWarnings(warnings = [], base) {
  const hasScopedContent = base.words.length > 0 || base.phonics_points.length > 0 || base.source_refs.length > 0;
  return (Array.isArray(warnings) ? warnings : [])
    .map(String)
    .filter(warning => {
      if (!hasScopedContent) return true;
      return !/chinese instruction|teacher text|not english|only says|no target|known words|known phonics|phonics list|phonics scope|no matching|no eligible|cannot safely extract|cannot.*extract|no english|no analyzable|does not contain|no .*allowed scope|no .*within the allowed scopes?|no additional items|no .*scope .*content|scope .*not provided|beyond the known words list|send the full homework page|classify it accurately/i.test(warning);
    });
}

function item(id, value, source, required = true, note = '') {
  const text = String(value || '').trim();
  return {
    id,
    value: text,
    label: text,
    source,
    source_label: source,
    required,
    selected: true,
    status: required ? 'required' : 'optional',
    note,
  };
}

function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : []).map((entry, index) => {
    const value = String(entry?.value || entry?.label || entry || '').trim();
    return {
      id: entry?.id || `${entry?.source || 'parent_added'}:${slug(value || index)}`,
      value,
      label: String(entry?.label || value).trim(),
      source: entry?.source || 'parent_added',
      source_label: entry?.source_label || entry?.source || 'parent_added',
      selected: entry?.selected !== false,
      required: entry?.required === true,
      status: entry?.required === true ? 'required' : 'optional',
      note: entry?.note || '',
    };
  }).filter(entry => entry.value);
}

function selectedValues(items = []) {
  return normalizeItems(items).filter(entry => entry.selected !== false).map(entry => entry.value);
}

function extractTeacherWords(text) {
  return unique((String(text || '').toLowerCase().match(/\b[a-z]{2,12}\b/g) || [])
    .map(normalizeWord)
    .filter(isUsefulWord));
}

function customAliasWords() {
  return new Set(listCustomMaterials().flatMap(material =>
    material.aliases.flatMap(alias =>
      String(alias || '').toLowerCase().match(/\b[a-z]{2,20}\b/g) || []
    )
  ));
}

function inferPatterns(text) {
  const raw = String(text || '');
  const patterns = [];
  if (/spell|\u62fc\u5199|\u62fc\u8bfb/i.test(raw)) patterns.push('Can you spell ...?');
  if (/question|qa|\u95ee\u7b54|\u53e5\u578b/i.test(raw)) patterns.push('What do you see?');
  return patterns;
}

function inferGrammar(text, requirements) {
  const points = [];
  if (requirements.requested_skills.includes('countable_uncountable')) {
    points.push('countable and uncountable nouns');
  }
  if (/how\s+many/i.test(text)) points.push('How many + plural countable noun');
  if (/how\s+much/i.test(text)) points.push('How much + uncountable noun');
  return unique(points);
}

function grammarSkills(values = []) {
  return values.some(value => /countable|uncountable|\u53ef\u6570|\u4e0d\u53ef\u6570/i.test(value))
    ? ['countable_uncountable']
    : [];
}

function llmUrl() {
  return `${String(config.llm.baseUrl).replace(/\/+$/, '')}/${config.llm.provider === 'openai' ? 'chat/completions' : 'messages'}`;
}

function llmHeaders() {
  if (config.llm.provider === 'openai') {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` };
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': config.llm.apiKey,
    'anthropic-version': '2023-06-01',
  };
}

function llmPayload(prompt) {
  if (config.llm.provider === 'openai') {
    return { model: config.llm.model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] };
  }
  return { model: config.llm.model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }], thinking: { type: 'disabled' } };
}

function extractJson(text) {
  const clean = String(text || '').replace(/```json|```/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  return start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
}

function dedupeItems(items = []) {
  const seen = new Set();
  return normalizeItems(items).filter(entry => {
    const key = `${entry.source}:${entry.value}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isUsefulWord(value) {
  const word = normalizeWordForValue(value);
  return !!normalizeCourseWord(word) && /^[a-z][a-z -]{1,30}$/.test(word) && !STOP_WORDS.has(word);
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeWordForValue(value) {
  return normalizeCourseWord(String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim());
}

function slug(value) {
  return String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function unique(items = []) {
  return [...new Set(items.filter(item => item !== undefined && item !== null && item !== ''))];
}

function shortError(error) {
  if (error?.name === 'AbortError') return 'AI analysis timeout';
  return String(error?.message || error || 'AI unavailable').slice(0, 120);
}

export default {
  analyzeHomework,
  buildRuleBasedAnalysis,
  normalizeConfirmedAnalysis,
};
