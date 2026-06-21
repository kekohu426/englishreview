export const REQUIRED_QUESTION_TYPES = [
  'listen_pick_image',
  'match_word_image',
  'spell_word',
  'read_aloud',
  'listen_pick_word',
  'listen_judge',
  'fill_blank',
  'word_order',
  'translate_pick',
  'dialogue_complete',
  'mixed_challenge',
];

export const QUESTION_TYPE_SET = new Set(REQUIRED_QUESTION_TYPES);

export const TYPE_TO_MODULE = {
  listen_pick_image: 'm1',
  match_word_image: 'm2',
  spell_word: 'm3',
  read_aloud: 'm4',
  listen_pick_word: 'm5',
  listen_judge: 'm6',
  fill_blank: 'm7',
  word_order: 'm8',
  translate_pick: 'm9',
  dialogue_complete: 'm10',
  mixed_challenge: 'm11',
};

export const MODULE_CONFIG = {
  m1: { icon: 'Audio', title: 'Listen And Pick Image', goal: 'Listen to the target word and choose the picture', estimated_minutes: 6, color: '#3167d8' },
  m2: { icon: 'Image', title: 'Match Word And Image', goal: 'Match English words with pictures', estimated_minutes: 6, color: '#1f9d67' },
  m3: { icon: 'Spell', title: 'Spell The Word', goal: 'Listen and spell target words', estimated_minutes: 8, color: '#9b59b6' },
  m4: { icon: 'Read', title: 'Read Aloud', goal: 'Read words and sentences clearly', estimated_minutes: 8, color: '#f28a3c' },
  m5: { icon: 'QA', title: 'Listen And Pick Word', goal: 'Listen to short prompts and choose the answer', estimated_minutes: 7, color: '#2ca6a4' },
  m6: { icon: 'Check', title: 'Listen And Judge', goal: 'Judge sentence or pattern correctness', estimated_minutes: 6, color: '#e04b4b' },
  m7: { icon: 'Blank', title: 'Fill In The Blank', goal: 'Complete words and sentence patterns', estimated_minutes: 7, color: '#3167d8' },
  m8: { icon: 'Order', title: 'Word Order', goal: 'Put words in the right sentence order', estimated_minutes: 8, color: '#1f9d67' },
  m9: { icon: 'Translate', title: 'Translation Pick', goal: 'Choose the matching translation', estimated_minutes: 6, color: '#2ca6a4' },
  m10: { icon: 'Chat', title: 'Dialogue Complete', goal: 'Choose the best dialogue reply', estimated_minutes: 7, color: '#e04b4b' },
  m11: { icon: 'Mix', title: 'Mixed Challenge', goal: 'Review words, phonics, patterns, and grammar together', estimated_minutes: 8, color: '#6f42c1' },
};

export const TYPE_ABILITIES = {
  listen_pick_image: ['listening', 'reading'],
  match_word_image: ['reading'],
  spell_word: ['listening', 'writing'],
  read_aloud: ['speaking', 'reading'],
  listen_pick_word: ['listening', 'reading'],
  listen_judge: ['listening', 'grammar'],
  fill_blank: ['reading', 'writing'],
  word_order: ['reading', 'writing', 'grammar'],
  translate_pick: ['reading'],
  dialogue_complete: ['reading', 'speaking'],
  mixed_challenge: ['listening', 'speaking', 'reading', 'writing'],
};

export function isRequiredQuestionType(type) {
  return QUESTION_TYPE_SET.has(type);
}

export function moduleForType(type) {
  return TYPE_TO_MODULE[type] || 'm1';
}

export default {
  REQUIRED_QUESTION_TYPES,
  QUESTION_TYPE_SET,
  TYPE_TO_MODULE,
  MODULE_CONFIG,
  TYPE_ABILITIES,
  isRequiredQuestionType,
  moduleForType,
};
