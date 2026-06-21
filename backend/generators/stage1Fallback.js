import config from '../config.js';
import { loadOPW2 } from '../knowledge/opw2_loader.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';

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

export function buildFallbackStage1Plan(teacherText = '', options = {}) {
  const opw2 = loadOPW2();
  const confirmed = options.confirmedAnalysis || {};
  const confirmedWords = selectedValues(confirmed.words || confirmed.target_words);
  const unitWords = scopedUnitWords(opw2, options);
  const words = unique([...confirmedWords, ...unitWords]).filter(Boolean);
  const patterns = selectedValues(confirmed.sentence_patterns);
  const grammar = selectedValues(confirmed.grammar_points);
  const phonics = selectedValues(confirmed.phonics_points);

  const knowledgePoints = [
    {
      id: 'KP_WORDS',
      type: 'vocabulary',
      priority: 'must',
      description: 'Confirmed vocabulary and OPW2-safe expansion words.',
      targets: words.slice(0, 80),
      source: confirmedWords.length ? 'teacher' : 'opw2_expansion',
    },
    {
      id: 'KP_PHONICS',
      type: 'phonics',
      priority: 'must',
      description: 'Only use confirmed phonics points when parent selected phonics material.',
      targets: phonics,
      source: phonics.length ? 'phonics_expansion' : 'not_requested',
    },
    {
      id: 'KP_PATTERNS',
      type: 'sentence_pattern',
      priority: 'must',
      description: 'Confirmed sentence patterns and child-safe Q&A.',
      targets: patterns.length ? patterns : ['What is this?', 'What are these?', 'This is ...', 'They are ...'],
      source: patterns.length ? 'teacher' : 'opw2_expansion',
    },
    {
      id: 'KP_GRAMMAR',
      type: 'grammar_sense',
      priority: 'must',
      description: 'Grammar sense in simple sentences.',
      targets: grammar.length ? grammar : ['This is / These are', 'It is / They are'],
      source: grammar.length ? 'teacher' : 'opw2_expansion',
    },
  ];

  const taskList = [];
  let id = 1;
  for (const type of REQUIRED_QUESTION_TYPES) {
    for (let index = 0; index < config.questions.minPerType; index += 1) {
      const word = pickWordForType(type, words, index);
      const kp = pickKnowledgePoint(type);
      taskList.push({
        task_id: `local_stage1_${id++}`,
        module: moduleForType(type),
        kp_id: kp,
        priority: 'must',
        question_type: type,
        target_word: word,
        target_sentence: sentenceFor(type, word, index),
        ability_targets: TYPE_ABILITIES[type] || ['reading'],
        source_refs: sourceRefsForWord(opw2, word),
        knowledge_tags: unique([`word:${word}`, `type:${type}`, ...tagForType(type)]),
        generation_intent: intentForType(type),
        note: `Local Stage1 fallback for ${type}.`,
      });
    }
  }

  return {
    topic: 'confirmed homework review plan',
    knowledge_points: knowledgePoints,
    task_list: taskList,
    summary: {
      total_tasks: taskList.length,
      must_tasks: taskList.length,
      optional_tasks: 0,
      estimated_minutes: 20,
      fallback: true,
    },
  };
}

function selectedValues(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item?.selected !== false)
    .map(item => String(item?.value || item?.label || item || '').toLowerCase().replace(/[^a-z ?./]/g, '').trim())
    .filter(Boolean);
}

function pickKnowledgePoint(type) {
  if (['spell_word', 'read_aloud'].includes(type)) return 'KP_PHONICS';
  if (['listen_judge', 'fill_blank', 'word_order', 'translate_pick', 'mixed_challenge'].includes(type)) return 'KP_GRAMMAR';
  if (['dialogue_complete', 'listen_pick_word'].includes(type)) return 'KP_PATTERNS';
  return 'KP_WORDS';
}

function pickWordForType(type, words, index) {
  const pool = words.length ? words : ['book', 'ball', 'box', 'scissors', 'markers', 'shelves'];
  const senseWords = pool.filter(isSenseVerb);
  if (SENSE_PATTERN_TYPES.has(type) && senseWords.length) {
    return senseWords[index % senseWords.length];
  }
  const imageWords = pool.filter(word => [
    'book', 'ball', 'box', 'scissors', 'markers',
    'tongue', 'nose', 'ear', 'ears', 'hands', 'eyes',
    'campfire', 'flower', 'soup', 'piano',
  ].includes(word));
  if (['listen_pick_image', 'match_word_image'].includes(type)) {
    const safe = imageWords.length ? imageWords : pool;
    return safe[index % safe.length];
  }
  return pool[index % pool.length];
}

function scopedUnitWords(opw2, options = {}) {
  const unitIds = unique([
    ...(options.confirmedAnalysis?.requested_units || []),
    ...(options.requirements?.requested_units || []),
    ...(options.knowledgeScope?.units || []),
  ].map(unit => String(unit)));

  const confirmedUnitWords = unitIds.flatMap(unit => opw2.vocabularyByUnit?.[unit] || opw2.vocabularyByUnit?.[Number(unit)] || []);
  if (confirmedUnitWords.length) return withRequiredUnitWords(normalizeWords(confirmedUnitWords), options);

  const scopeWords = normalizeWords(options.knowledgeScope?.all_unit_words);
  if (scopeWords.length) return withRequiredUnitWords(scopeWords, options);

  const unitWords = unitIds.flatMap(unit => opw2.vocabularyByUnit?.[unit] || opw2.vocabularyByUnit?.[Number(unit)] || []);
  if (unitWords.length) return withRequiredUnitWords(normalizeWords(unitWords), options);

  return normalizeWords(Object.values(opw2.vocabularyByUnit || {}).flat()).slice(0, 24);
}

function withRequiredUnitWords(words, options = {}) {
  const unitIds = [
    ...(options.confirmedAnalysis?.requested_units || []),
    ...(options.requirements?.requested_units || []),
    ...(options.knowledgeScope?.units || []),
  ].map(Number);
  if (unitIds.includes(2)) {
    return unique([...words, 'smell', 'taste', 'touch', 'hear', 'see']);
  }
  return words;
}

function normalizeWords(words = []) {
  return unique((Array.isArray(words) ? words : [])
    .map(word => String(word || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(word => /^[a-z][a-z ]*$/.test(word))
    .filter(word => !['b cks', 'ca t', 'bt', 'jljice', 'eggsh e chick', 'seeds seeds'].includes(word)));
}

function sentenceFor(type, word, index) {
  if (isSenseVerb(word)) {
    if (type === 'listen_pick_word' || type === 'mixed_challenge' || type === 'dialogue_complete') {
      return senseQuestion(word);
    }
    if (type === 'listen_judge') return index % 2 === 0 ? senseSentence(word) : senseSentence(alternateSenseVerb(word));
    if (type === 'fill_blank') return `I ${normalizeSenseVerb(word)} with my ____ .`;
    if (type === 'word_order' || type === 'translate_pick' || type === 'read_aloud') return senseSentence(word);
  }
  if (type === 'listen_pick_word' || type === 'mixed_challenge' || type === 'dialogue_complete') {
    if (isPluralLike(word)) return 'What are these?';
    if (index % 4 === 0) return 'What is this?';
    if (index % 4 === 1) return 'What are these?';
    if (index % 4 === 2) return sentenceForWord(word);
    return `They are ${pluralize(word)}.`;
  }
  if (type === 'listen_judge') return index % 2 === 0 ? sentenceForWord(word) : `They are ${pluralize(word)}.`;
  if (type === 'fill_blank') return index % 2 === 0 ? `It is ____ ${word}.` : `They are ____ .`;
  if (type === 'word_order') return index % 2 === 0 ? sentenceForWord(word) : `They are ${pluralize(word)}.`;
  if (type === 'translate_pick' || type === 'read_aloud') return sentenceForWord(word);
  return null;
}

function sourceRefsForWord(opw2, word) {
  const refs = opw2.coverageIndex?.by_word?.[word] || [];
  return refs.length ? refs.slice(0, 3) : ['teacher_input'];
}

function tagForType(type) {
  if (['spell_word', 'read_aloud'].includes(type)) return ['phonics'];
  if (['listen_judge', 'fill_blank', 'word_order'].includes(type)) return ['grammar'];
  if (['dialogue_complete', 'listen_pick_word'].includes(type)) return ['sentence_pattern'];
  return ['vocabulary'];
}

function intentForType(type) {
  return {
    listen_pick_image: 'Connect heard word to visual meaning.',
    match_word_image: 'Read the word and identify visual meaning.',
    spell_word: 'Segment sounds and spell the target word.',
    read_aloud: 'Read aloud for pronunciation and fluency.',
    listen_pick_word: 'Listen to a prompt and choose the fitting response.',
    listen_judge: 'Judge whether a sentence pattern is correct.',
    fill_blank: 'Complete a word or sentence pattern in writing.',
    word_order: 'Build a sentence in correct word order.',
    translate_pick: 'Map English sentence meaning to a translation.',
    dialogue_complete: 'Use a sentence pattern in dialogue.',
    mixed_challenge: 'Combine listening, speaking, reading, and writing recall.',
  }[type] || 'Practice the target knowledge point.';
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
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

function sentenceForWord(word) {
  const clean = String(word || '').toLowerCase();
  if (isSenseVerb(clean)) return senseSentence(clean);
  if (isPluralLike(clean)) return `They are ${clean}.`;
  return `It is ${/^[aeiou]/.test(clean) ? 'an' : 'a'} ${clean}.`;
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

function singular(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (clean === 'shelves') return 'shelf';
  if (clean === 'scissors') return 'scissors';
  return clean;
}

function isPluralLike(word) {
  return ['scissors', 'markers', 'shelves', 'books', 'hoops'].includes(String(word || '').toLowerCase())
    || String(word || '').toLowerCase().endsWith('s');
}

export default {
  buildFallbackStage1Plan,
};
