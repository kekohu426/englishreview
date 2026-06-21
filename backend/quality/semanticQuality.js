const MATERIAL_LABEL_WORDS = new Set([
  'textbook', 'unit', 'review', 'practice', 'homework', 'lesson', 'page',
  'phonics', 'opw', 'opw2', 'bigfun', 'material', 'source',
]);

const PERSON_WORDS = new Set([
  'grandfather', 'grandmother', 'grandpa', 'grandma', 'father', 'mother',
  'dad', 'mom', 'aunt', 'uncle', 'cousin', 'brother', 'sister', 'child',
  'boy', 'girl', 'teacher', 'friend', 'family',
]);
const MASS_OR_NATURAL_WORDS = new Set(['rain', 'lightning', 'thunder']);
const WEATHER_ADJECTIVES = new Set(['sunny', 'rainy', 'windy']);

export const SUPPORTED_IMAGE_WORDS = new Set([
  'book', 'bag', 'pencil', 'ruler', 'desk', 'chair',
  'ball', 'box', 'scissors', 'markers', 'marker', 'shelves', 'shelf',
  'cat', 'dog', 'fish', 'bird', 'hen', 'pen', 'bed',
  'red', 'blue', 'yellow', 'green',
  'apple', 'banana', 'orange', 'pear',
  'tongue', 'nose', 'ear', 'ears', 'hands', 'eyes',
  'campfire', 'flower', 'soup', 'piano',
  'grandfather', 'grandmother', 'father', 'mother', 'aunt', 'uncle',
  'cousin', 'child', 'boy', 'girl', 'house', 'apartment', 'pet', 'pets',
  'swing', 'tricycle', 'slide', 'cloud', 'clouds', 'lightning', 'thunder',
  'meat', 'chicken', 'corn', 'potatoes', 'potato', 'salad', 'milk',
  'lemonade', 'juice', 'food', 'fruit', 'seeds', 'seed',
  'sunny', 'rainy', 'windy', 'raincoat', 'hat', 'umbrella', 'boots',
  'boot',
  't-shirt', 'sweater', 'pants', 'bathing suit',
  'tractor', 'barn', 'lamb', 'horse', 'dogs', 'ducks', 'egg', 'eggs', 'chick',
  'police car', 'fire truck', 'ambulance', 'truck', 'toy store',
]);

export function validateSemanticQuality(questions = [], context = {}) {
  const errors = [];
  const scopeWords = buildScopeWords(context);

  questions.forEach((question, index) => {
    const label = `question ${index + 1} (${question?.type || 'unknown'} ${question?.id || ''})`;
    const allText = collectQuestionText(question);
    const targetWord = normalizeWord(question?.target_word || question?.word || question?.spell_word || question?.blank_answer);

    if (targetWord && MATERIAL_LABEL_WORDS.has(targetWord)) {
      errors.push(`${label}: source/material label used as target word: ${targetWord}`);
    }

    const malformed = allText.find(hasMalformedKnowledgeText);
    if (malformed) {
      errors.push(`${label}: malformed OCR/source text leaked into question: ${short(malformed)}`);
    }

    const personWord = [...PERSON_WORDS].find(word => allText.some(text => containsWord(text, word)) || targetWord === word);
    if (personWord && allText.some(text => objectifiesPerson(text, personWord))) {
      errors.push(`${label}: person/family word rendered as an object: ${personWord}`);
    }

    const massWord = [...MASS_OR_NATURAL_WORDS].find(word => allText.some(text => containsWord(text, word)) || targetWord === word);
    if (massWord && allText.some(text => objectifiesMassWord(text, massWord))) {
      errors.push(`${label}: mass/natural phenomenon word uses an article: ${massWord}`);
    }

    const weatherWord = [...WEATHER_ADJECTIVES].find(word => allText.some(text => containsWord(text, word)) || targetWord === word);
    if (weatherWord && allText.some(text => objectifiesWeatherAdjective(text, weatherWord))) {
      errors.push(`${label}: weather adjective uses an object article: ${weatherWord}`);
    }

    if (['listen_pick_image', 'match_word_image'].includes(question?.type)) {
      const imageKeys = imageWordsFromQuestion(question);
      const unsupported = imageKeys.filter(word => word && !SUPPORTED_IMAGE_WORDS.has(word));
      if (unsupported.length) {
        errors.push(`${label}: unsupported image keys: ${unique(unsupported).join(', ')}`);
      }
      if (scopeWords.size > 0 && imageKeys.length > 0 && !imageKeys.some(word => scopeWords.has(singular(word)))) {
        errors.push(`${label}: image options fallback outside confirmed material scope: ${unique(imageKeys).join(', ')}`);
      }
    }

    if (scopeWords.size > 0 && targetWord && !scopeWords.has(singular(targetWord)) && !isFunctionalTarget(targetWord, question)) {
      errors.push(`${label}: target word outside confirmed material scope: ${targetWord}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function isPersonWord(value) {
  return PERSON_WORDS.has(singular(value));
}

export function personSentence(value) {
  const word = singular(value);
  const pronoun = ['grandmother', 'mother', 'mom', 'aunt', 'sister', 'girl'].includes(word) ? 'She' : 'He';
  return `${pronoun} is my ${word}.`;
}

export function personQuestion(value) {
  const word = singular(value);
  const pronoun = ['grandmother', 'mother', 'mom', 'aunt', 'sister', 'girl'].includes(word) ? 'she' : 'he';
  return `Who is ${pronoun}?`;
}

function buildScopeWords(context = {}) {
  const knowledgeScope = context.knowledgeScope || {};
  const confirmedAnalysis = context.confirmedAnalysis || {};
  const values = [
    ...(knowledgeScope.all_unit_words || []),
    ...(knowledgeScope.confirmed_words || []),
    ...(knowledgeScope.custom_words || []),
    ...(confirmedAnalysis.words || confirmedAnalysis.target_words || []).map(item => item?.value || item?.label || item),
  ];
  return new Set(values.flatMap(value => [normalizeWord(value), singular(value)]).filter(Boolean));
}

function collectQuestionText(question = {}) {
  const values = [
    question.audio_text,
    question.text,
    question.sentence,
    question.source_text,
    question.target_sentence,
    question.word,
    question.target_word,
    question.blank_answer,
    question.explanation,
    ...(Array.isArray(question.sentence_parts) ? question.sentence_parts : []),
    ...(Array.isArray(question.words) ? question.words : []),
    ...(Array.isArray(question.options) ? question.options.flatMap(option => [option?.text, option?.label, option?.image_key]) : []),
    ...(Array.isArray(question.dialogue) ? question.dialogue.map(line => line?.text) : []),
  ];
  return values.map(value => String(value || '').trim()).filter(Boolean);
}

function imageWordsFromQuestion(question = {}) {
  return unique((question.options || [])
    .flatMap(option => [option?.image_key, option?.label, option?.text])
    .map(normalizeWord)
    .filter(Boolean));
}

function hasMalformedKnowledgeText(value) {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (/\(\s*\)|\[\s*\]|\{\s*\}/.test(text)) return true;
  if ((text.match(/\(/g) || []).length !== (text.match(/\)/g) || []).length) return true;
  if (/\b(?:yo u|th is|wh at|gr and|grandfathery)\b/.test(lower)) return true;
  if (/this is\/these are|grandparents language/.test(lower)) return true;
  if (/[A-Za-z]\)[A-Za-z]/.test(text)) return true;
  return false;
}

function objectifiesPerson(text, word) {
  const lower = String(text || '').toLowerCase();
  const phrase = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(it is|this is|what is this\\??\\s*(it is)?)\\s+(a|an|my)?\\s*${phrase}\\b`).test(lower);
}

function objectifiesMassWord(text, word) {
  const lower = String(text || '').toLowerCase();
  const phrase = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(it is|this is)\\s+(a|an)\\s+${phrase}\\b`).test(lower);
}

function objectifiesWeatherAdjective(text, word) {
  const lower = String(text || '').toLowerCase();
  const phrase = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(it is|this is|they are)\\s+(a|an)\\s+${phrase}\\b`).test(lower)
    || new RegExp(`\\bthey are\\s+${phrase}\\b`).test(lower);
}

function isFunctionalTarget(word, question = {}) {
  if (['a', 'an', 'the', 'some', 'much', 'many'].includes(word)) return true;
  if (question.type === 'listen_judge' && ['correct', 'not correct'].includes(word)) return true;
  return false;
}

function containsWord(text, word) {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(text || ''));
}

function normalizeWord(value) {
  return normalizeAlias(String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim());
}

function singular(value) {
  const clean = normalizeAlias(String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim());
  if (['scissors', 'hands', 'eyes', 'ears', 'pets', 'boots', 'pants'].includes(clean)) return clean;
  if (clean.includes(' ')) return clean;
  if (clean.endsWith('ies')) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s') && clean.length > 3) return clean.slice(0, -1);
  return clean;
}

function normalizeAlias(value) {
  if (value === 'tshirt' || value === 't shirt') return 't-shirt';
  if (value === 'boot') return 'boots';
  return value;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function short(value) {
  const text = String(value || '');
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export default {
  SUPPORTED_IMAGE_WORDS,
  validateSemanticQuality,
  isPersonWord,
  personSentence,
  personQuestion,
};
