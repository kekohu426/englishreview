import config from '../config.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';
import { SUPPORTED_IMAGE_WORDS } from '../quality/semanticQuality.js';

const IMAGE_WORDS = SUPPORTED_IMAGE_WORDS;
const SENSE_WITH = {
  smell: 'nose',
  taste: 'tongue',
  touch: 'hands',
  hear: 'ears',
  see: 'eyes',
};
const SENSE_PATTERN_TYPES = new Set([
  'read_aloud',
  'listen_pick_word',
  'listen_judge',
  'fill_blank',
  'word_order',
  'translate_pick',
  'dialogue_complete',
  'mixed_challenge',
]);
const STOP_TARGET_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'with', 'for', 'of', 'in', 'on', 'at',
  'he', 'she', 'it', 'we', 'you', 'they', 'is', 'are', 'am', 'has', 'have',
  'can', 'see', 'do', 'does', 'how', 'many', 'much', 'review', 'practice',
  'phonics', 'spelling', 'reading', 'aloud', 'unit', 'opw', 'opw2',
  'listening', 'speaking', 'writing', 'simple', 'sentence', 'sentences',
  'word', 'words', 'question', 'questions', 'type', 'types',
]);

export function auditAndRepairTaskCoverage({ requirements, knowledgeScope, phonicsScope, confirmedAnalysis, taskList, knowledgePoints }) {
  const originalTasks = Array.isArray(taskList) ? taskList : [];
  const tasks = originalTasks.filter(task => REQUIRED_QUESTION_TYPES.includes(task?.question_type));
  const repairs = [];
  const warnings = [];
  const missing = [];
  const targets = collectCoverageTargets({ requirements, knowledgeScope, phonicsScope, confirmedAnalysis, knowledgePoints });

  ensureTypeMinimums(tasks, repairs, targets);
  ensureKnowledgeTargets(tasks, repairs, targets);
  ensureAbilityTargets(tasks, repairs, targets);

  const repairedTaskList = [...tasks, ...repairs].map((task, index) => normalizeTask(task, index, targets));
  const report = buildTaskCoverageReport(repairedTaskList, requirements, knowledgeScope, repairs, missing, warnings, { phonicsScope, confirmedAnalysis, knowledgePoints });

  return {
    valid: report.overall === 'PASS',
    score: scoreReport(report),
    missing: report.missing,
    warnings,
    repairs: repairs.map(task => task.task_id),
    repaired_task_list: repairedTaskList,
    knowledge_points: knowledgePoints,
    report,
  };
}

export function buildTaskCoverageReport(tasks, requirements = {}, scope = {}, repairs = [], missing = [], warnings = [], extras = {}) {
  const cleanTasks = Array.isArray(tasks) ? tasks : [];
  const typeCounts = countTypes(cleanTasks);
  const invalidTypes = cleanTasks.map(task => task.question_type).filter(type => !REQUIRED_QUESTION_TYPES.includes(type));
  const typeMissing = REQUIRED_QUESTION_TYPES.filter(type => (typeCounts[type] || 0) < config.questions.minPerType);
  const sourceMissing = cleanTasks.filter(task => !Array.isArray(task.source_refs) || task.source_refs.length === 0).map(task => task.task_id);
  const abilityMissing = cleanTasks.filter(task => !Array.isArray(task.ability_targets) || task.ability_targets.length === 0).map(task => task.task_id);
  const tagMissing = cleanTasks.filter(task => !Array.isArray(task.knowledge_tags) || task.knowledge_tags.length === 0).map(task => task.task_id);
  const targets = collectCoverageTargets({
    requirements,
    knowledgeScope: scope,
    phonicsScope: extras.phonicsScope,
    confirmedAnalysis: extras.confirmedAnalysis,
    knowledgePoints: extras.knowledgePoints,
  });
  const content = JSON.stringify(cleanTasks).toLowerCase();
  const uncoveredTargets = targets.required_words.filter(word => !hasWord(content, word));
  const abilityCoverage = abilityCounts(cleanTasks);
  const abilityNames = ['listening', 'speaking', 'reading', 'writing'];
  const missingAbilities = abilityNames.filter(name => (abilityCoverage[name] || 0) === 0);

  const checks = {
    question_types: {
      status: invalidTypes.length === 0 && typeMissing.length === 0 ? 'PASS' : 'FAIL',
      counts: typeCounts,
      missing: typeMissing,
      invalid: invalidTypes,
    },
    traceability: {
      status: sourceMissing.length === 0 && tagMissing.length === 0 ? 'PASS' : 'FAIL',
      source_missing: sourceMissing,
      tag_missing: tagMissing,
    },
    abilities: {
      status: abilityMissing.length === 0 && missingAbilities.length === 0 ? 'PASS' : 'FAIL',
      counts: abilityCoverage,
      missing_tasks: abilityMissing,
      missing_abilities: missingAbilities,
    },
    knowledge_targets: {
      status: uncoveredTargets.length === 0 ? 'PASS' : 'FAIL',
      required_words: targets.required_words,
      missing_words: uncoveredTargets,
    },
  };

  const allMissing = [
    ...missing,
    ...typeMissing.map(type => `question_type:${type}`),
    ...invalidTypes.map(type => `invalid_type:${type}`),
    ...sourceMissing.map(id => `source_refs:${id}`),
    ...abilityMissing.map(id => `ability_targets:${id}`),
    ...tagMissing.map(id => `knowledge_tags:${id}`),
    ...uncoveredTargets.map(word => `target_word:${word}`),
    ...missingAbilities.map(ability => `ability:${ability}`),
  ];
  const failed = Object.values(checks).some(check => check.status === 'FAIL');

  return {
    overall: failed ? 'FAIL' : 'PASS',
    checks,
    missing: allMissing,
    warnings,
    repairs_added: repairs.length,
  };
}

function ensureTypeMinimums(tasks, repairs, targets) {
  const counts = countTypes(tasks);
  REQUIRED_QUESTION_TYPES.forEach(type => {
    const needed = Math.max(0, config.questions.minPerType - (counts[type] || 0));
    for (let index = 0; index < needed; index += 1) {
      const word = pickWord(type, targets, index + (counts[type] || 0));
      repairs.push(makeTask(`type_${type}_${index}`, type, word, sentenceFor(type, word, index), [`coverage:type:${type}`], [`type:${type}`, `word:${word}`]));
    }
  });
}

function ensureKnowledgeTargets(tasks, repairs, targets) {
  const content = JSON.stringify(tasks).toLowerCase();
  targets.required_words.forEach((word, index) => {
    if (hasWord(content, word)) return;
    const type = REQUIRED_QUESTION_TYPES[index % REQUIRED_QUESTION_TYPES.length];
    repairs.push(makeTask(`word_${word}`, type, word, sentenceFor(type, word, index), [`coverage:word:${word}`], [`word:${word}`]));
  });
}

function ensureAbilityTargets(tasks, repairs, targets) {
  const allTasks = [...tasks, ...repairs];
  const counts = abilityCounts(allTasks);
  const abilityRepairTypes = {
    listening: 'listen_pick_word',
    speaking: 'read_aloud',
    reading: 'translate_pick',
    writing: 'spell_word',
  };

  Object.entries(abilityRepairTypes).forEach(([ability, type], index) => {
    if ((counts[ability] || 0) > 0) return;
    const word = pickWord(type, targets, index);
    repairs.push(makeTask(
      `ability_${ability}`,
      type,
      word,
      sentenceFor(type, word, index),
      [`coverage:ability:${ability}`],
      [`ability:${ability}`, `word:${word}`],
    ));
    counts[ability] = 1;
  });
}

function normalizeTask(task, index, targets) {
  const type = REQUIRED_QUESTION_TYPES.includes(task.question_type) ? task.question_type : REQUIRED_QUESTION_TYPES[index % REQUIRED_QUESTION_TYPES.length];
  const word = pickCanonicalWord(task, type, targets, index);
  const sentence = shouldReplaceSentence(task.target_sentence, word)
    ? sentenceFor(type, word, index)
    : (task.target_sentence || sentenceFor(type, word, index));
  return {
    ...task,
    task_id: task.task_id || `task_${index + 1}`,
    module: moduleForType(type),
    question_type: type,
    target_word: word,
    target_sentence: sentence,
    ability_targets: Array.isArray(task.ability_targets) && task.ability_targets.length ? task.ability_targets : TYPE_ABILITIES[type],
    source_refs: Array.isArray(task.source_refs) && task.source_refs.length ? task.source_refs.map(String) : [`coverage:${word}`],
    knowledge_tags: cleanKnowledgeTags(task.knowledge_tags, word, type),
    generation_intent: task.generation_intent || `Practice ${word} with ${type}.`,
  };
}

function cleanKnowledgeTags(tags, word, type) {
  const output = (Array.isArray(tags) ? tags : [])
    .map(String)
    .filter(tag => !/^word:/i.test(tag));
  return unique([`word:${word}`, `type:${type}`, ...output]);
}

function shouldReplaceSentence(sentence, word) {
  const text = String(sentence || '').toLowerCase();
  if (!text) return false;
  if (/how much|how many/.test(text)) return true;
  const allowedWords = new Set([word, pluralize(word), singular(word)]);
  const taggedWords = [...text.matchAll(/\b[a-z]+\b/g)].map(match => match[0])
    .filter(token => !STOP_TARGET_WORDS.has(token))
    .filter(token => !['what', 'this', 'these', 'yes', 'not', 'correct'].includes(token));
  return taggedWords.some(token => !allowedWords.has(token) && !['it', 'they'].includes(token));
}

function makeTask(prefix, type, targetWord, targetSentence, sourceRefs, knowledgeTags) {
  const idPart = String(prefix || targetWord || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    task_id: `coverage_${idPart}`,
    module: moduleForType(type),
    kp_id: 'KP_COVERAGE',
    priority: 'must',
    question_type: type,
    target_word: targetWord,
    target_sentence: targetSentence,
    ability_targets: TYPE_ABILITIES[type] || ['reading'],
    source_refs: sourceRefs,
    knowledge_tags: knowledgeTags,
    generation_intent: `Repair coverage for ${sourceRefs.join(', ')}.`,
    note: `Coverage repair for ${sourceRefs.join(', ')}.`,
  };
}

function collectCoverageTargets({ knowledgeScope = {}, phonicsScope = {}, confirmedAnalysis = {}, knowledgePoints = [] }) {
  const confirmedWords = selectedValues(confirmedAnalysis?.words || confirmedAnalysis?.target_words);
  const kpWords = confirmedWords.length ? [] : (knowledgePoints || []).flatMap(point => [...(point.targets || []), ...(point.target_words || [])]).map(normalizeWord).filter(Boolean);
  const scopeWords = [
    ...(knowledgeScope.confirmed_words || []),
    ...(knowledgeScope.page_words || []).slice(0, 24),
    ...(phonicsScope.words || []).slice(0, 24),
  ].map(normalizeWord).filter(Boolean);
  const requiredWords = unique([
    ...confirmedWords,
    ...scopeWords,
    ...kpWords,
    ...requiredSenseWords({ knowledgeScope, confirmedAnalysis }),
  ])
    .filter(word => !STOP_TARGET_WORDS.has(word))
    .filter(word => word.length > 1)
    .slice(0, 80);
  return {
    required_words: requiredWords,
    fallback_words: requiredWords.length ? requiredWords : ['book', 'ball', 'box', 'scissors', 'markers', 'shelves'],
  };
}

function selectedValues(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item?.selected !== false)
    .map(item => normalizeWord(item?.value || item?.label || item))
    .filter(Boolean);
}

function pickWord(type, targets, index) {
  const pool = targets.fallback_words.length ? targets.fallback_words : ['book', 'ball', 'box', 'scissors', 'markers', 'shelves'];
  const senseWords = pool.filter(isSenseVerb);
  if (SENSE_PATTERN_TYPES.has(type) && senseWords.length) {
    return senseWords[index % senseWords.length];
  }
  if (['listen_pick_image', 'match_word_image'].includes(type)) {
    const safe = pool.filter(word => IMAGE_WORDS.has(word));
    const imagePool = safe.length ? safe : pool;
    return imagePool[index % imagePool.length];
  }
  return pool[index % pool.length];
}

function requiredSenseWords({ knowledgeScope = {}, confirmedAnalysis = {} }) {
  const units = [
    ...(knowledgeScope.units || []),
    ...(confirmedAnalysis.requested_units || []),
  ].map(Number);
  return units.includes(2) ? Object.keys(SENSE_WITH) : [];
}

function pickCanonicalWord(task, type, targets, index) {
  const allowed = new Set(targets.required_words || []);
  const tagWord = (task.knowledge_tags || [])
    .map(tag => String(tag || '').match(/^word:(.+)$/i)?.[1])
    .map(normalizeWord)
    .find(word => allowed.has(word));
  const taskWord = normalizeWord(task.target_word);
  if (tagWord) return tagWord;
  if (allowed.has(taskWord)) return taskWord;
  return pickWord(type, targets, index);
}

function sentenceFor(type, word, index) {
  if (isSenseVerb(word)) {
    if (type === 'listen_pick_word' || type === 'dialogue_complete' || type === 'mixed_challenge') {
      return senseQuestion(word);
    }
    if (type === 'listen_judge') return index % 2 === 0 ? senseSentence(word) : senseSentence(alternateSenseVerb(word));
    if (type === 'fill_blank') return `I ${normalizeSenseVerb(word)} with my ____ .`;
    if (type === 'word_order' || type === 'translate_pick' || type === 'read_aloud') return senseSentence(word);
  }
  if (type === 'listen_pick_word' || type === 'dialogue_complete' || type === 'mixed_challenge') {
    if (isPluralLike(word)) return 'What are these?';
    if (index % 4 === 0) return 'What is this?';
    if (index % 4 === 1) return 'What are these?';
    if (index % 4 === 2) return sentenceForWord(word);
    return `They are ${pluralize(word)}.`;
  }
  if (type === 'listen_judge') return index % 2 === 0 ? sentenceForWord(word) : `They are ${pluralize(word)}.`;
  if (type === 'fill_blank') return index % 2 === 0 ? `It is ____ ${word}.` : 'They are ____ .';
  if (type === 'word_order' || type === 'translate_pick' || type === 'read_aloud') return sentenceForWord(word);
  return null;
}

function countTypes(tasks) {
  const counts = {};
  tasks.forEach(task => {
    counts[task.question_type] = (counts[task.question_type] || 0) + 1;
  });
  return counts;
}

function abilityCounts(tasks) {
  const counts = {};
  tasks.forEach(task => {
    (task.ability_targets || []).forEach(ability => {
      counts[ability] = (counts[ability] || 0) + 1;
    });
  });
  return counts;
}

function hasWord(text, word) {
  return new RegExp(`\\b${escapeRegExp(String(word).toLowerCase())}\\b`).test(text);
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

function pluralize(word) {
  const clean = singular(word);
  if (!clean) return 'books';
  if (clean === 'shelf') return 'shelves';
  if (clean === 'scissors') return 'scissors';
  if (clean.endsWith('s')) return clean;
  if (clean.endsWith('x') || clean.endsWith('ch') || clean.endsWith('sh')) return `${clean}es`;
  if (clean.endsWith('y')) return `${clean.slice(0, -1)}ies`;
  return `${clean}s`;
}

function singular(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (clean === 'shelves') return 'shelf';
  if (clean === 'scissors') return 'scissors';
  return clean;
}

function sentenceForWord(word) {
  const clean = String(word || '').toLowerCase().trim();
  if (isSenseVerb(clean)) return senseSentence(clean);
  if (isPluralLike(clean)) {
    return `They are ${clean}.`;
  }
  return `It is ${/^[aeiou]/.test(clean) ? 'an' : 'a'} ${clean}.`;
}

function isPluralLike(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  return ['scissors', 'markers', 'shelves', 'books', 'hoops'].includes(clean)
    || (clean.endsWith('s') && clean.length > 3);
}

function normalizeSenseVerb(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  return SENSE_WITH[clean] ? clean : '';
}

function isSenseVerb(word) {
  return !!normalizeSenseVerb(word);
}

function senseQuestion(word) {
  const verb = normalizeSenseVerb(word) || 'touch';
  return `What do you ${verb} with?`;
}

function senseSentence(word) {
  const verb = normalizeSenseVerb(word) || 'touch';
  return `I ${verb} with my ${SENSE_WITH[verb]}.`;
}

function alternateSenseVerb(word) {
  const verb = normalizeSenseVerb(word);
  return Object.keys(SENSE_WITH).find(item => item !== verb) || 'smell';
}

function scoreReport(report) {
  const checks = Object.values(report.checks || {});
  if (!checks.length) return 1;
  const passed = checks.filter(check => check.status === 'PASS').length;
  return Number((passed / checks.length).toFixed(2));
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  auditAndRepairTaskCoverage,
  buildTaskCoverageReport,
};
