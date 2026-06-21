const WORD_ALIASES = new Map([
  ['jljice', 'juice'],
  ['jllice', 'juice'],
  ['bt', 'boots'],
  ['b00t5', 'boots'],
  ['ca t', 'cat'],
  ['eggsh e chick', 'eggs chick'],
  ['seeds seeds', 'seeds'],
  ['b cks', 'books'],
  ['pant s', 'pants'],
  ['pantS', 'pants'],
]);

const BAD_WORDS = new Set([
  'textbook', 'opw', 'opw2', 'unit', 'review', 'practice',
]);

export function normalizeCourseWord(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const spaced = raw
    .replace(/[，、]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!spaced) return '';
  const alias = WORD_ALIASES.get(spaced);
  const normalized = alias || spaced;
  if (BAD_WORDS.has(normalized)) return '';
  if (hasBrokenSingleLetters(normalized)) return '';
  if (!/^[a-z][a-z0-9 -]{1,30}$/.test(normalized)) return '';
  return normalized;
}

export function normalizeCourseWords(values = []) {
  return unique(values.map(normalizeCourseWord).filter(Boolean));
}

function hasBrokenSingleLetters(value) {
  const tokens = String(value || '').split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.some(token => token.length === 1) && !['t-shirt'].includes(value);
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export default {
  normalizeCourseWord,
  normalizeCourseWords,
};
