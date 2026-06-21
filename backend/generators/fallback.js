import config from '../config.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';

const IMAGE_SAFE_WORDS = new Set([
  'book', 'ball', 'box', 'scissors', 'markers',
]);
const DEFAULT_WORDS = ['book', 'ball', 'box', 'scissors', 'markers', 'shelves'];
const IMAGE_TYPES = new Set(['listen_pick_image', 'match_word_image']);

export function ensureAllQuestionTypes(taskList = [], knowledgePoints = []) {
  const cleanTasks = (Array.isArray(taskList) ? taskList : [])
    .filter(task => REQUIRED_QUESTION_TYPES.includes(task?.question_type));
  const typeCounts = Object.fromEntries(REQUIRED_QUESTION_TYPES.map(type => [
    type,
    cleanTasks.filter(task => task.question_type === type).length,
  ]));
  const targetWords = extractTargetWords(knowledgePoints);
  const fallbackTasks = [];
  let fallbackId = cleanTasks.length + 1;

  REQUIRED_QUESTION_TYPES.forEach(type => {
    const needed = Math.max(0, config.questions.minPerType - (typeCounts[type] || 0));
    for (let i = 0; i < needed; i += 1) {
      const word = pickTargetWord(type, targetWords, i);
      fallbackTasks.push({
        task_id: `t_fallback_${fallbackId++}`,
        module: moduleForType(type),
        kp_id: knowledgePoints[0]?.id || 'KP_FALLBACK',
        priority: 'must',
        question_type: type,
        target_word: word,
        target_sentence: needsTargetSentence(type) ? generateDefaultSentence(word, type, i) : null,
        ability_targets: TYPE_ABILITIES[type] || ['reading'],
        source_refs: [`fallback:${word}`],
        knowledge_tags: [`word:${word}`, `type:${type}`],
        generation_intent: `Ensure minimum coverage for ${type}.`,
        note: `Fallback task for ${type}; keep it aligned with ${word}.`,
      });
    }
  });

  return [...cleanTasks, ...fallbackTasks];
}

function extractTargetWords(knowledgePoints) {
  const words = [];
  knowledgePoints.forEach(kp => {
    if (Array.isArray(kp.target_words)) words.push(...kp.target_words);
    if (Array.isArray(kp.targets)) words.push(...kp.targets);
  });
  const cleaned = unique(words
    .map(word => String(word || '').trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' '))
    .filter(word => /^[a-z][a-z ]*$/.test(word)));
  return cleaned.length > 0 ? cleaned : DEFAULT_WORDS;
}

function pickTargetWord(type, targetWords, index) {
  if (IMAGE_TYPES.has(type)) {
    const safeWords = targetWords.filter(word => IMAGE_SAFE_WORDS.has(word));
    const pool = safeWords.length ? safeWords : DEFAULT_WORDS;
    return pool[index % pool.length];
  }
  return targetWords[index % targetWords.length];
}

function needsTargetSentence(type) {
  return ['read_aloud', 'listen_judge', 'word_order', 'fill_blank', 'dialogue_complete', 'mixed_challenge', 'translate_pick', 'listen_pick_word'].includes(type);
}

function generateDefaultSentence(word, type, index) {
  if (type === 'listen_pick_word' || type === 'dialogue_complete' || type === 'mixed_challenge') {
    if (isPluralLike(word)) return 'What are these?';
    return index % 2 === 0 ? 'What is this?' : 'What are these?';
  }
  if (type === 'listen_judge') return index % 2 === 0 ? sentenceForWord(word) : `They are ${pluralize(word)}.`;
  if (type === 'fill_blank') return index % 2 === 0 ? `It is ____ ${word}.` : `They are ____ .`;
  if (type === 'word_order') return sentenceForWord(word);
  if (type === 'translate_pick' || type === 'read_aloud') return sentenceForWord(word);
  return null;
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

function singular(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (clean === 'shelves') return 'shelf';
  if (clean === 'scissors') return 'scissors';
  return clean;
}

function sentenceForWord(word) {
  const clean = String(word || '').toLowerCase().trim();
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

export default {
  ensureAllQuestionTypes,
};
