import { MODULE_CONFIG, TYPE_TO_MODULE } from '../questionTypes.js';

const WORDS = ['book', 'books', 'ball', 'box', 'scissors', 'markers', 'shelves', 'bag', 'pencil', 'cat', 'dog', 'fish'];
const OPW2_IMAGE_WORDS = [
  'book', 'ball', 'box', 'scissors', 'markers',
  'tongue', 'nose', 'ear', 'ears', 'hands', 'eyes',
  'campfire', 'flower', 'soup', 'piano',
  'grandfather', 'grandmother', 'father', 'mother', 'aunt', 'uncle',
  'cousin', 'child', 'boy', 'girl', 'house', 'apartment', 'pets',
  'swing', 'tricycle', 'slide', 'cloud', 'clouds', 'lightning', 'thunder',
  'meat', 'fish', 'chicken', 'corn', 'potatoes', 'potato', 'salad', 'milk',
  'lemonade', 'juice', 'food', 'fruit', 'seeds', 'seed',
  'sunny', 'rainy', 'windy', 'raincoat', 'hat', 'umbrella', 'boots',
  't-shirt', 'sweater', 'pants', 'bathing suit',
  'tractor', 'barn', 'lamb', 'horse', 'cat', 'girl', 'boy', 'dogs', 'ducks',
  'egg', 'eggs', 'chick',
  'police car', 'fire truck', 'ambulance', 'truck', 'toy store',
];
const FRONTEND_IMAGE_KEYS = new Set([
  'book', 'ball', 'box', 'scissors', 'markers', 'bag', 'pencil', 'ruler', 'desk', 'chair',
  'tongue', 'nose', 'ear', 'ears', 'hands', 'eyes', 'campfire', 'flower', 'soup', 'piano',
  'red', 'blue', 'yellow', 'green',
  'apple', 'banana', 'orange', 'pear',
  'cat', 'dog', 'fish', 'bird',
  'hen', 'pen', 'bed',
  'grandfather', 'grandmother', 'father', 'mother', 'aunt', 'uncle',
  'cousin', 'child', 'boy', 'girl', 'house', 'apartment', 'pet', 'pets',
  'swing', 'tricycle', 'slide', 'cloud', 'clouds', 'lightning', 'thunder',
  'meat', 'fish', 'chicken', 'corn', 'potatoes', 'potato', 'salad', 'milk',
  'lemonade', 'juice', 'food', 'fruit', 'seeds', 'seed',
  'sunny', 'rainy', 'windy', 'raincoat', 'hat', 'umbrella', 'boots',
  't-shirt', 'sweater', 'pants', 'bathing suit',
  'tractor', 'barn', 'lamb', 'horse', 'cat', 'girl', 'boy', 'dogs', 'ducks',
  'egg', 'eggs', 'chick',
  'police car', 'fire truck', 'ambulance', 'truck', 'toy store',
]);

export { MODULE_CONFIG, TYPE_TO_MODULE };

export function createUserModuleShells() {
  return Object.keys(MODULE_CONFIG).map(moduleId => ({
    module_id: moduleId,
    ...MODULE_CONFIG[moduleId],
    status: 'pending',
    items: [],
  }));
}

export function assembleUserModules(questions) {
  const grouped = {};
  questions.map(normalizeQuestion).forEach(question => {
    const moduleId = TYPE_TO_MODULE[question.type] || question.module_id || 'm1';
    if (!grouped[moduleId]) grouped[moduleId] = [];
    grouped[moduleId].push({ ...question, module_id: moduleId });
  });

  return Object.keys(MODULE_CONFIG)
    .filter(moduleId => grouped[moduleId]?.length)
    .map(moduleId => ({
      module_id: moduleId,
      ...MODULE_CONFIG[moduleId],
      items: grouped[moduleId],
    }));
}

export function normalizeQuestion(question, index = 0) {
  const type = TYPE_TO_MODULE[question?.type] ? question.type : 'listen_pick_word';
  const base = {
    id: stringOr(question?.id, `generated_${type}_${index + 1}`),
    type,
    module_id: TYPE_TO_MODULE[type] || question?.module_id || 'm1',
    requirement_ids: Array.isArray(question?.requirement_ids) ? question.requirement_ids : ['AI_GENERATED'],
    source_refs: Array.isArray(question?.source_refs) && question.source_refs.length ? question.source_refs : ['unknown_source'],
    knowledge_tags: Array.isArray(question?.knowledge_tags) && question.knowledge_tags.length ? question.knowledge_tags : [`type:${type}`],
    ability_targets: Array.isArray(question?.ability_targets) ? question.ability_targets : [],
    target_word: question?.target_word,
    target_sentence: question?.target_sentence,
    child_instruction: stringOr(question?.child_instruction, promptForType(type)),
    prompt: stringOr(question?.prompt, question?.child_instruction, promptForType(type)),
    explanation: stringOr(question?.explanation, 'Good work.'),
  };

  switch (type) {
    case 'listen_pick_image': {
      const listenImageWord = pickImageWord(question, index);
      return {
        ...base,
        target_word: listenImageWord,
        audio_text: stringOr(question.audio_text, listenImageWord),
        options: normalizeImageOptions(question.options, listenImageWord),
      };
    }
    case 'listen_pick_word':
    case 'mixed_challenge':
      return {
        ...base,
        audio_text: stringOr(question.audio_text, question.text, question.target_sentence, 'Is this your book?'),
        options: normalizeTextOptions(question.options, ['Yes, it is.', 'Yes, I can.', 'Yes, I do.']),
      };
    case 'listen_judge':
      return {
        ...base,
        audio_text: stringOr(question.audio_text, question.text, question.target_sentence, 'How many pens?'),
        answer: typeof question.answer === 'boolean' ? question.answer : Boolean(question.is_correct),
        options: normalizeTextOptions(question.options, ['Correct', 'Not correct']),
      };
    case 'read_aloud': {
      const text = stringOr(question.text, question.pronunciation_target, question.audio_text, question.sentence, question.target_sentence, 'I see a book.');
      return {
        ...base,
        text,
        translation: stringOr(question.translation, text),
        focus: stringOr(question.focus, 'read aloud'),
        pronunciation_target: stringOr(question.pronunciation_target, text),
        pronunciation_focus: Array.isArray(question.pronunciation_focus) ? question.pronunciation_focus : text.split(/\s+/).slice(-2),
        scene_key: stringOr(question.scene_key, 'school'),
        role_name: stringOr(question.role_name, 'Leo'),
        role_icon: stringOr(question.role_icon, 'L'),
      };
    }
    case 'word_order': {
      const sentence = stringOr(question.sentence, question.text, question.audio_text, question.target_sentence, 'I see a book.');
      return {
        ...base,
        sentence,
        words: Array.isArray(question.words) && question.words.length > 1 ? question.words : shuffleSentence(sentence),
        translation: stringOr(question.translation, sentence),
      };
    }
    case 'fill_blank':
      return normalizeFillBlank(base, question, index);
    case 'match_word_image': {
      const word = pickImageWord(question, index);
      return {
        ...base,
        target_word: word,
        word,
        word_translation: stringOr(question.word_translation, question.translation, word),
        options: normalizeImageOptions(question.options, word),
      };
    }
    case 'spell_word': {
      const word = stringOr(question.spell_word, question.answer, question.target_word, question.audio_text, WORDS[index % WORDS.length]).toLowerCase().replace(/[^a-z]/g, '');
      return {
        ...base,
        audio_text: stringOr(question.audio_text, word),
        spell_word: word,
        word_translation: safeTranslation(question.word_translation, question.translation, word),
        letter_pool: Array.isArray(question.letter_pool) && question.letter_pool.length ? question.letter_pool : buildLetterPool(word),
      };
    }
    case 'translate_pick':
      return {
        ...base,
        source_text: stringOr(question.source_text, question.text, question.prompt_text, question.target_sentence, 'I have a book.'),
        source_lang: question.source_lang === 'zh' ? 'zh' : 'en',
        options: normalizeTextOptions(question.options, ['I have a book.', 'I see a book.', 'I want a book.']),
      };
    case 'dialogue_complete':
      return {
        ...base,
        dialogue: normalizeDialogue(question.dialogue, question.target_sentence),
        options: normalizeTextOptions(question.options, ['Yes, it is.', 'Yes, I can.', 'Yes, I do.']),
      };
    default:
      return base;
  }
}

function pickImageWord(question, index) {
  const raw = pickWord(question, index);
  if (FRONTEND_IMAGE_KEYS.has(raw)) return raw;
  return OPW2_IMAGE_WORDS[index % OPW2_IMAGE_WORDS.length];
}

function normalizeFillBlank(base, question, index) {
  const word = stringOr(question.blank_answer, question.answer, question.target_word, WORDS[index % WORDS.length]);
  let sentenceParts = Array.isArray(question.sentence_parts) && question.sentence_parts.length === 2
    ? question.sentence_parts.map(part => typeof part === 'string' ? part : '')
    : ['I see a ', '.'];

  if (!sentenceParts[0].trim() || !sentenceParts[1].trim()) {
    const sentence = stringOr(question.sentence, question.text, question.audio_text, question.target_sentence, `I see a ${word}.`);
    sentenceParts = splitSentenceAroundWord(sentence, word);
  }

  return {
    ...base,
    sentence_parts: sentenceParts,
    blank_answer: word,
    options: normalizeTextOptions(question.options, [word, 'many', 'much', 'see']),
  };
}

function splitSentenceAroundWord(sentence, word) {
  const safeSentence = stringOr(sentence, `I see a ${word}.`);
  const lowerSentence = safeSentence.toLowerCase();
  const lowerWord = String(word || '').toLowerCase();
  const index = lowerWord ? lowerSentence.indexOf(lowerWord) : -1;
  if (index > 0 && index + lowerWord.length < safeSentence.length) {
    return [safeSentence.slice(0, index), safeSentence.slice(index + lowerWord.length)];
  }
  return ['I see a ', '.'];
}

function normalizeImageOptions(options, correctWord) {
  const safeCorrectWord = imageKey(correctWord);
  const normalized = Array.isArray(options) ? options.map(option => ({
    text: stringOr(option.text, option.translation, option.label, option.image_key, correctWord),
    label: imageKey(stringOr(option.label, option.image_key, option.text, correctWord)),
    image_key: imageKey(stringOr(option.image_key, option.label, option.text, correctWord)),
    is_correct: option.is_correct === true,
  })) : [];

  return ensureCorrectOption(normalized, {
    text: safeCorrectWord,
    label: safeCorrectWord,
    image_key: safeCorrectWord,
    is_correct: true,
  }, OPW2_IMAGE_WORDS.slice(0, 3).map(word => ({ text: word, label: word, image_key: imageKey(word), is_correct: word === safeCorrectWord })));
}

function normalizeTextOptions(options, fallbackTexts) {
  const normalized = Array.isArray(options) ? options.map(option => ({
    text: stringOr(option.text, option.label, option.translation, ''),
    is_correct: option.is_correct === true,
  })).filter(option => option.text) : [];
  const fallback = fallbackTexts.map((text, index) => ({ text, is_correct: index === 0 }));
  return ensureCorrectOption(normalized, fallback[0], fallback);
}

function ensureCorrectOption(options, correctOption, fallback) {
  const usable = options.length >= 2 ? options : fallback;
  if (usable.some(option => option.is_correct)) return usable;
  return [{ ...correctOption, is_correct: true }, ...usable.slice(1)].slice(0, Math.max(3, usable.length));
}

function normalizeDialogue(dialogue, targetSentence = '') {
  if (Array.isArray(dialogue) && dialogue.length) {
    return dialogue.map((line, index) => ({
      name: stringOr(line.name, line.speaker, index % 2 ? 'Mia' : 'Leo'),
      icon: stringOr(line.icon, index % 2 ? 'M' : 'L'),
      text: stringOr(line.text, line.isBlank ? '' : targetSentence),
      isBlank: line.isBlank === true,
    }));
  }
  return [
    { name: 'Leo', icon: 'L', text: targetSentence || 'What do you see?', isBlank: false },
    { name: 'Mia', icon: 'M', text: '', isBlank: true },
  ];
}

function pickWord(question, index) {
  const raw = stringOr(question.word, question.target_word, question.answer, question.audio_text, WORDS[index % WORDS.length])
    .toLowerCase()
    .replace(/[^a-z -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (FRONTEND_IMAGE_KEYS.has(raw)) return raw;
  return raw.split(/\s+/).pop() || WORDS[index % WORDS.length];
}

function imageKey(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
  if (FRONTEND_IMAGE_KEYS.has(key)) return key;
  return OPW2_IMAGE_WORDS.find(word => FRONTEND_IMAGE_KEYS.has(word)) || 'book';
}

function buildLetterPool(word) {
  const answer = word.toUpperCase().split('');
  const extras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(letter => !answer.includes(letter)).slice(0, Math.max(0, 8 - answer.length));
  return seededShuffle([...answer, ...extras].slice(0, Math.max(8, answer.length)), word);
}

function seededShuffle(items, seedText) {
  const output = [...items];
  let seed = String(seedText || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const swapIndex = seed % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  const answer = String(seedText || '').toUpperCase();
  if (output.join('').slice(0, answer.length) === answer && output.length > answer.length) {
    [output[0], output[answer.length]] = [output[answer.length], output[0]];
  }
  return output;
}

function shuffleSentence(sentence) {
  const words = sentence.match(/[A-Za-z']+|[?.!,;]/g) || sentence.split(/\s+/);
  return [...words].sort((a, b) => a.localeCompare(b));
}

function promptForType(type) {
  const prompts = {
    listen_pick_image: 'Listen and choose the picture.',
    match_word_image: 'Choose the matching picture.',
    spell_word: 'Listen and spell the word.',
    read_aloud: 'Read aloud.',
    listen_pick_word: 'Listen and choose the answer.',
    listen_judge: 'Listen and judge.',
    fill_blank: 'Choose the word to fill the blank.',
    word_order: 'Put the words in order.',
    translate_pick: 'Choose the matching meaning.',
    dialogue_complete: 'Complete the dialogue.',
    mixed_challenge: 'Complete the mixed challenge.',
  };
  return prompts[type] || 'Complete the question.';
}

function stringOr(...values) {
  const value = values.find(item => typeof item === 'string' && item.trim().length > 0);
  return value ? value.trim() : '';
}

function safeTranslation(...values) {
  const answer = String(values[values.length - 1] || '').trim().toLowerCase();
  const value = values.slice(0, -1).find(item => typeof item === 'string' && item.trim().length > 0);
  if (!value) return '';
  const text = value.trim();
  if (text.toLowerCase() === answer || /^[a-z\s-]+$/i.test(text)) return '';
  return text;
}
