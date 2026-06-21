import { loadOPW2 } from '../knowledge/opw2_loader.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';
import { SUPPORTED_IMAGE_WORDS, isPersonWord, personQuestion, personSentence } from './semanticQuality.js';

const IMAGE_WORDS = SUPPORTED_IMAGE_WORDS;
const SENSE_WITH = {
  smell: 'nose',
  taste: 'tongue',
  touch: 'hands',
  hear: 'ears',
  see: 'eyes',
};
const MASS_OR_NATURAL_WORDS = new Set(['rain', 'lightning', 'thunder']);
const BAD_STUDENT_TERMS = ['countable noun', 'countable nouns', 'uncountable noun', 'uncountable nouns', 'question and answer practice', 'opw'];

export function sanitizeTaskPlan(plan, teacherText = '', contextOverrides = {}) {
  const context = buildScope(teacherText, contextOverrides);
  const knowledgePoints = Array.isArray(plan?.knowledge_points)
    ? sanitizeKnowledgePoints(plan.knowledge_points, context)
    : [];
  const counters = {};
  const taskList = (Array.isArray(plan?.task_list) ? plan.task_list : [])
    .filter(task => REQUIRED_QUESTION_TYPES.includes(task?.question_type))
    .map((task, index) => {
      const type = task.question_type;
      counters[type] = (counters[type] || 0) + 1;
      return sanitizeTask(task, index, counters[type] - 1, context);
    });

  return {
    ...plan,
    knowledge_points: knowledgePoints,
    task_list: taskList,
  };
}

export function sanitizeTasks(taskList = [], knowledgePoints = [], teacherText = '') {
  const plan = sanitizeTaskPlan({ knowledge_points: knowledgePoints, task_list: taskList }, teacherText);
  return plan.task_list;
}

function sanitizeKnowledgePoints(points, context) {
  return points.map(point => ({
    ...point,
    targets: sanitizeTargets(point.targets, context),
    target_words: sanitizeTargets(point.target_words, context),
  }));
}

function sanitizeTargets(value, context) {
  if (!Array.isArray(value)) return value;
  const cleaned = value.map(item => cleanTargetWord(item, context)).filter(Boolean);
  return cleaned.length ? unique(cleaned) : context.words.slice(0, 5);
}

function sanitizeTask(task, globalIndex, typeIndex, context) {
  const type = task.question_type;
  const word = pickWord(task, typeIndex, context, type);
  const targetSentence = sentenceForType(type, word, typeIndex, task.target_sentence, context);
  return {
    ...task,
    task_id: task.task_id || `stage1_task_${globalIndex + 1}`,
    question_type: type,
    module: moduleForType(type),
    target_word: word,
    target_sentence: targetSentence,
    ability_targets: Array.isArray(task.ability_targets) && task.ability_targets.length ? task.ability_targets : TYPE_ABILITIES[type],
    source_refs: sanitizeSourceRefs(task.source_refs, context, word),
    knowledge_tags: sanitizeKnowledgeTags(task.knowledge_tags, type, word),
    generation_intent: task.generation_intent || `Practice ${word} with ${type}.`,
    note: appendAuditNote(task.note, globalIndex, word),
  };
}

function sanitizeSourceRefs(sourceRefs, context, word) {
  const existing = Array.isArray(sourceRefs) ? sourceRefs.filter(Boolean).map(String) : [];
  if (existing.length) return existing;
  const coverageRefs = context.coverageByWord[word] || [];
  return coverageRefs.length ? coverageRefs.slice(0, 3) : ['teacher_input'];
}

function sanitizeKnowledgeTags(tags, type, word) {
  const existing = Array.isArray(tags) ? tags.filter(Boolean).map(String) : [];
  return unique([...existing, `word:${word}`, `type:${type}`]);
}

function sentenceForType(type, word, index, originalSentence, context) {
  const original = String(originalSentence || '').trim();
  if (isSafeSentence(original, type, context)) return original;
  if (isPersonWord(word)) {
    if (['listen_pick_word', 'dialogue_complete', 'mixed_challenge'].includes(type)) return personQuestion(word);
    if (type === 'listen_judge') return personSentence(word);
    if (type === 'fill_blank') return `${personSentence(word).replace(new RegExp(`\\b${word}\\b`, 'i'), '____')}`;
    if (['word_order', 'translate_pick', 'read_aloud'].includes(type)) return personSentence(word);
  }
  if (isSenseVerb(word)) {
    if (['listen_pick_word', 'dialogue_complete', 'mixed_challenge'].includes(type)) return `What do you ${word} with?`;
    if (type === 'listen_judge') return index % 2 === 0 ? senseSentence(word) : senseSentence(alternateSenseVerb(word));
    if (type === 'fill_blank') return `I ${word} with my ____ .`;
    if (['word_order', 'translate_pick', 'read_aloud'].includes(type)) return senseSentence(word);
  }

  switch (type) {
    case 'listen_pick_word':
      return qaPrompt(index, word);
    case 'listen_judge':
      return index % 2 === 0 ? 'How many pens?' : 'How much water?';
    case 'fill_blank':
      return index % 2 === 0 ? 'How ____ pens?' : `I see a ____ .`;
    case 'word_order':
      return index % 2 === 0 ? `I see a ${word}.` : 'How many pens?';
    case 'translate_pick':
    case 'read_aloud':
      return `I see a ${word}.`;
    case 'dialogue_complete':
    case 'mixed_challenge':
      return qaPrompt(index, word);
    default:
      return original || null;
  }
}

function qaPrompt(index, word) {
  const cycle = index % 5;
  if (cycle === 0) return `How many pens?`;
  if (cycle === 1) return `How much water?`;
  if (cycle === 2) return `Can you spell ${word}?`;
  if (cycle === 3) return `What do you see?`;
  return `Is this your ${singular(word)}?`;
}

function isSafeSentence(sentence, type, context) {
  if (!sentence) return false;
  const lower = sentence.toLowerCase();
  if (BAD_STUDENT_TERMS.some(term => lower.includes(term))) return false;
  const personWord = context.words.find(word => isPersonWord(word) && lower.includes(word));
  if (personWord && /\b(it is|this is|what is this)\b/.test(lower)) return false;
  const massWord = context.words.find(word => MASS_OR_NATURAL_WORDS.has(singular(word)) && lower.includes(singular(word)));
  if (massWord && /\b(it is|this is)\s+(a|an)\b/.test(lower)) return false;
  if (type === 'listen_pick_word' && !isQuestion(sentence)) return false;
  const words = lower.match(/[a-z]+/g) || [];
  const allowed = new Set([
    ...context.words,
    'i', 'see', 'a', 'an', 'the', 'is', 'in', 'on', 'it', 'this', 'your',
    'can', 'you', 'spell', 'what', 'do', 'have', 'want', 'how', 'many', 'much',
    'there', 'are', 'some', 'yes', 'no', 'read', 'water', 'milk', 'pens', 'with', 'my',
  ]);
  return words.every(word => allowed.has(singular(word)) || /^[a-z]$/.test(word));
}

function pickWord(task, index, context, type) {
  const candidates = [
    task.target_word,
    task.word,
    extractKnownWord(task.target_sentence, context),
    context.words[index % context.words.length],
  ];
  const word = candidates.map(item => cleanTargetWord(item, context)).find(Boolean) || context.words[index % context.words.length] || 'cat';
  if (['listen_pick_image', 'match_word_image'].includes(type)) {
    return IMAGE_WORDS.has(word) ? word : [...IMAGE_WORDS][index % IMAGE_WORDS.size];
  }
  return word;
}

function cleanTargetWord(value, context) {
  const normalized = normalizeWord(value);
  if (!normalized || BAD_STUDENT_TERMS.includes(normalized)) return '';
  if (context.allowedWords.has(normalized)) return normalized;
  const singularWord = singular(normalized);
  if (context.allowedWords.has(singularWord)) return singularWord;
  return '';
}

function extractKnownWord(value, context) {
  const words = String(value || '').toLowerCase().match(/[a-z]+/g) || [];
  return [...words].reverse().find(word => context.allowedWords.has(singular(word))) || '';
}

function buildScope(teacherText, contextOverrides = {}) {
  const opw2 = loadOPW2();
  const knowledgeScope = contextOverrides.knowledgeScope || contextOverrides.confirmedAnalysis?.knowledge_scope || {};
  const scopedWords = knowledgeScope.all_unit_words || knowledgeScope.confirmed_words || [];
  const requestedUnits = [
    ...(contextOverrides.requirements?.requested_units || []),
    ...(contextOverrides.confirmedAnalysis?.requested_units || []),
    ...(knowledgeScope.units || []),
  ].map(String);
  const opw2Words = scopedWords.length
    ? scopedWords
    : requestedUnits.length
      ? requestedUnits.flatMap(unit => opw2.vocabularyByUnit?.[unit] || [])
      : Object.values(opw2.vocabularyByUnit || {}).flat().slice(0, 24);
  const confirmedWords = (contextOverrides.confirmedAnalysis?.words || contextOverrides.confirmedAnalysis?.target_words || [])
    .filter(item => item?.selected !== false)
    .map(item => normalizeWord(item?.value || item?.label || item))
    .filter(Boolean);
  const teacherWords = extractTeacherWords(teacherText);
  const requiredSenseWords = requestedUnits.map(Number).includes(2) ? Object.keys(SENSE_WITH) : [];
  const words = unique([...confirmedWords, ...teacherWords, ...opw2Words.map(normalizeWord), ...requiredSenseWords].filter(Boolean));
  const allowedWords = new Set([...words, ...words.map(singular)]);
  const coverageByWord = opw2.coverageIndex?.by_word || {};
  return { words: words.length ? words : ['cat', 'bag', 'hen', 'pen', 'bed', 'red'], allowedWords, coverageByWord };
}

function extractTeacherWords(text) {
  return (String(text || '').toLowerCase().match(/[a-z]+/g) || [])
    .filter(word => word.length > 1 && !['how', 'much', 'many', 'unit', 'review', 'practice'].includes(word))
    .map(normalizeWord);
}

function singular(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (['scissors', 'hands', 'eyes', 'ears'].includes(clean)) return clean;
  if (clean.endsWith('ies')) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s') && clean.length > 3) return clean.slice(0, -1);
  return clean;
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSenseVerb(word) {
  return !!SENSE_WITH[String(word || '').toLowerCase()];
}

function senseSentence(word) {
  const verb = String(word || '').toLowerCase();
  return `I ${verb} with my ${SENSE_WITH[verb]}.`;
}

function alternateSenseVerb(word) {
  return Object.keys(SENSE_WITH).find(verb => verb !== word) || 'smell';
}

function isQuestion(value) {
  return /\?/.test(String(value || '')) || /^(how|can|do|is|what)\b/i.test(String(value || '').trim());
}

function appendAuditNote(note, index, word) {
  const base = String(note || '')
    .replace(/opw/gi, '')
    .replace(/countable nouns?/gi, '')
    .replace(/uncountable nouns?/gi, '')
    .replace(/question and answer practice/gi, '')
    .trim();
  const audit = `scope_checked:${index + 1}:${word}`;
  return base ? `${base} (${audit})` : audit;
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export default {
  sanitizeTaskPlan,
  sanitizeTasks,
};
