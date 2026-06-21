import config from '../config.js';
import { REQUIRED_QUESTION_TYPES } from '../questionTypes.js';

const REQUIRED_TYPES = new Set(REQUIRED_QUESTION_TYPES);
const CHOICE_TYPES = new Set([
  'listen_pick_image',
  'match_word_image',
  'listen_pick_word',
  'fill_blank',
  'translate_pick',
  'dialogue_complete',
  'mixed_challenge',
]);

export function validateQuestion(question) {
  const errors = [];

  if (!question || typeof question !== 'object') {
    return { valid: false, errors: ['question must be an object'] };
  }

  requireString(question, 'id', errors);
  requireString(question, 'type', errors);
  requireString(question, 'child_instruction', errors);

  if (question.type && !REQUIRED_TYPES.has(question.type)) {
    errors.push(`unknown type ${question.type}`);
  }
  if (question.type === 'letter_sound_trace') {
    errors.push('letter_sound_trace has been removed');
  }
  if (!Array.isArray(question.source_refs) || question.source_refs.length === 0) {
    errors.push('source_refs is required');
  }
  if (!Array.isArray(question.knowledge_tags) || question.knowledge_tags.length === 0) {
    errors.push('knowledge_tags is required');
  }

  if (CHOICE_TYPES.has(question.type)) {
    validateOptions(question, errors);
  }

  switch (question.type) {
    case 'spell_word':
      if (!hasAnyString(question, ['answer', 'spell_word', 'target_word'])) {
        errors.push('spell_word requires answer, spell_word, or target_word');
      }
      requireString(question, 'audio_text', errors);
      break;
    case 'read_aloud':
      if (!hasAnyString(question, ['text', 'audio_text', 'sentence'])) {
        errors.push('read_aloud requires text, audio_text, or sentence');
      }
      break;
    case 'listen_judge':
      requireString(question, 'audio_text', errors);
      if (typeof question.answer !== 'boolean' && typeof question.is_correct !== 'boolean') {
        errors.push('listen_judge requires boolean answer or is_correct');
      }
      break;
    case 'fill_blank':
      validateFillBlank(question, errors);
      break;
    case 'word_order':
      validateWordOrder(question, errors);
      break;
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}

export function validateQuestions(questions) {
  const errors = [];

  if (!Array.isArray(questions)) {
    return { valid: false, errors: ['questions must be an array'], results: [] };
  }

  const results = questions.map((question, index) => {
    const result = validateQuestion(question);
    if (!result.valid) {
      errors.push(`question ${index + 1} (${question?.type || 'unknown'}): ${result.errors.join('; ')}`);
    }
    return result;
  });

  return { valid: errors.length === 0, errors, results };
}

export function summarizeQuestionTypes(questions) {
  const counts = {};
  REQUIRED_QUESTION_TYPES.forEach(type => {
    counts[type] = 0;
  });

  questions.forEach(question => {
    if (question?.type) {
      counts[question.type] = (counts[question.type] || 0) + 1;
    }
  });

  const missingTypes = REQUIRED_QUESTION_TYPES.filter(type => (counts[type] || 0) === 0);
  const insufficientTypes = REQUIRED_QUESTION_TYPES.filter(
    type => (counts[type] || 0) < config.questions.minPerType
  );

  return {
    counts,
    coveredTypes: REQUIRED_QUESTION_TYPES.length - missingTypes.length,
    totalTypes: REQUIRED_QUESTION_TYPES.length,
    missingTypes,
    insufficientTypes,
  };
}

function validateOptions(question, errors) {
  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`${question.type} requires at least 2 options`);
    return;
  }

  const correctOptions = question.options.filter(option => option?.is_correct === true);
  if (correctOptions.length < 1) {
    errors.push(`${question.type} requires at least one correct option`);
  }
}

function validateFillBlank(question, errors) {
  requireString(question, 'blank_answer', errors);

  if (!Array.isArray(question.sentence_parts) || question.sentence_parts.length !== 2) {
    errors.push('fill_blank requires sentence_parts with exactly 2 entries');
    return;
  }

  const [before, after] = question.sentence_parts;
  if (typeof before !== 'string' || before.trim().length === 0) {
    errors.push('fill_blank blank cannot be at the beginning');
  }
  if (typeof after !== 'string' || after.trim().length === 0) {
    errors.push('fill_blank blank cannot be at the end');
  }
}

function validateWordOrder(question, errors) {
  requireString(question, 'sentence', errors);

  if (!Array.isArray(question.words) || question.words.length < 2) {
    errors.push('word_order requires words with at least 2 entries');
  }
}

function requireString(object, field, errors) {
  if (typeof object[field] !== 'string' || object[field].trim().length === 0) {
    errors.push(`${field} is required`);
  }
}

function hasAnyString(object, fields) {
  return fields.some(field => typeof object[field] === 'string' && object[field].trim().length > 0);
}

export default {
  validateQuestion,
  validateQuestions,
  summarizeQuestionTypes,
};
