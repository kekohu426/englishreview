export const TASTE_ADJECTIVES = new Set(['salty', 'sweet', 'sour']);
export const WEATHER_ADJECTIVES = new Set(['sunny', 'rainy', 'windy']);
export const NATURAL_PHENOMENA = new Set(['rain', 'lightning', 'thunder']);
export const UNCOUNTABLES = new Set([
  'water', 'milk', 'rice', 'bread', 'fish', 'corn', 'juice', 'jam',
  'meat', 'chicken', 'salad', 'food', 'fruit', 'lemonade',
  'rain', 'lightning', 'thunder',
]);
export const SENSE_WITH = {
  smell: 'nose',
  taste: 'tongue',
  touch: 'hands',
  hear: 'ears',
  see: 'eyes',
};

export function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function compactWord(value) {
  return normalizeWord(value).replace(/[^a-z]/g, '');
}

export function singular(value) {
  const clean = compactWord(value);
  if (clean === 'shelves') return 'shelf';
  if (['scissors', 'hands', 'eyes', 'ears', 'pants', 'boots'].includes(clean)) return clean;
  if (clean.endsWith('ies')) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s') && clean.length > 3) return clean.slice(0, -1);
  return clean;
}

export function isTasteAdjective(value) {
  return TASTE_ADJECTIVES.has(singular(value));
}

export function isWeatherAdjective(value) {
  return WEATHER_ADJECTIVES.has(singular(value));
}

export function isNaturalPhenomenon(value) {
  return NATURAL_PHENOMENA.has(singular(value));
}

export function isUncountable(value) {
  return UNCOUNTABLES.has(singular(value));
}

export function normalizeSenseVerb(value) {
  const clean = compactWord(value);
  return SENSE_WITH[clean] ? clean : '';
}

export function isSenseVerb(value) {
  return !!normalizeSenseVerb(value);
}

export function senseQuestion(value) {
  const verb = normalizeSenseVerb(value) || 'touch';
  return `What do you ${verb} with?`;
}

export function senseSentence(value) {
  const verb = normalizeSenseVerb(value) || 'touch';
  return `I ${verb} with my ${SENSE_WITH[verb]}.`;
}

export function alternateSenseVerb(value) {
  const verb = normalizeSenseVerb(value);
  return Object.keys(SENSE_WITH).find(item => item !== verb) || 'smell';
}

export function tasteQuestion() {
  return 'How does it taste?';
}

export function tasteSentence(value) {
  return `It is ${singular(value)}.`;
}

export function naturalSentence(value) {
  const clean = singular(value);
  if (clean === 'thunder') return 'I hear thunder.';
  return `I see ${clean}.`;
}

export function pluralize(value) {
  const clean = singular(value);
  if (!clean) return 'books';
  if (clean === 'shelf') return 'shelves';
  if (clean === 'scissors') return 'scissors';
  if (UNCOUNTABLES.has(clean) || TASTE_ADJECTIVES.has(clean) || WEATHER_ADJECTIVES.has(clean)) return clean;
  if (clean.endsWith('s')) return clean;
  if (clean.endsWith('x') || clean.endsWith('ch') || clean.endsWith('sh')) return `${clean}es`;
  if (clean.endsWith('y')) return `${clean.slice(0, -1)}ies`;
  return `${clean}s`;
}

export function isPluralLike(value) {
  const clean = compactWord(value);
  return ['scissors', 'markers', 'shelves', 'books', 'hoops', 'clouds', 'hands', 'eyes', 'ears', 'pets', 'boots', 'pants', 'dogs', 'ducks', 'eggs'].includes(clean)
    || (clean.endsWith('s') && clean.length > 3 && !TASTE_ADJECTIVES.has(clean) && !WEATHER_ADJECTIVES.has(clean));
}

export function article(value) {
  const clean = singular(value);
  if (!clean || UNCOUNTABLES.has(clean) || TASTE_ADJECTIVES.has(clean) || WEATHER_ADJECTIVES.has(clean) || isPluralLike(value)) return '';
  return /^[aeiou]/i.test(clean) ? 'an' : 'a';
}

export function nounPhrase(value) {
  const clean = normalizeWord(value);
  if (!clean) return 'a book';
  if (isNaturalPhenomenon(clean) || isUncountable(clean) || isPluralLike(clean)) return pluralize(clean);
  return [article(clean), singular(clean)].filter(Boolean).join(' ');
}

export function sentenceForWordClass(value) {
  const clean = normalizeWord(value);
  if (isSenseVerb(clean)) return senseSentence(clean);
  if (isTasteAdjective(clean) || isWeatherAdjective(clean)) return `It is ${singular(clean)}.`;
  if (isNaturalPhenomenon(clean)) return naturalSentence(clean);
  if (isPluralLike(clean)) return `They are ${pluralize(clean)}.`;
  return `It is ${nounPhrase(clean)}.`;
}
