import config from '../config.js';
import { loadOPW2 } from '../knowledge/opw2_loader.js';
import { REQUIRED_QUESTION_TYPES, TYPE_ABILITIES, moduleForType } from '../questionTypes.js';
import { SUPPORTED_IMAGE_WORDS, isPersonWord, personQuestion, personSentence } from '../quality/semanticQuality.js';
import { normalizeCourseWord } from '../knowledge/wordNormalizer.js';
import {
  TASTE_ADJECTIVES,
  WEATHER_ADJECTIVES,
  UNCOUNTABLES,
  SENSE_WITH,
  isTasteAdjective,
  isWeatherAdjective,
  isNaturalPhenomenon,
  isUncountable,
  isSenseVerb,
  normalizeSenseVerb,
  senseQuestion,
  senseSentence,
  alternateSenseVerb,
  tasteQuestion,
  tasteSentence,
  naturalSentence,
  sentenceForWordClass,
  nounPhrase,
  article,
  pluralize,
  singular,
  isPluralLike,
} from '../knowledge/wordClasses.js';

const IMAGE_WORDS = [
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
const DEFAULT_WORDS = ['book', 'ball', 'box', 'scissors', 'markers', 'shelves'];
const UNCOUNTABLE_LIST = [...UNCOUNTABLES];
const COUNTABLES = ['pens', 'cats', 'bags', 'hens', 'eggs', 'beds'];
const ZH = {
  cat: 'cat', ant: 'ant', yak: 'yak', ax: 'ax', ram: 'ram', jam: 'jam', yam: 'yam',
  dad: 'dad', bag: 'bag', cap: 'cap', bat: 'bat', web: 'web', egg: 'egg',
  hen: 'hen', pen: 'pen', bed: 'bed', red: 'red', hip: 'hip', ink: 'ink', zip: 'zip',
  water: 'water', milk: 'milk', corn: 'corn', scissors: 'scissors', markers: 'markers',
  shelves: 'shelves', books: 'books', book: 'book', box: 'box', ball: 'ball', hoops: 'hoops',
  grandfather: '爷爷', grandmother: '奶奶', father: '爸爸', mother: '妈妈',
  aunt: '阿姨', uncle: '叔叔', cousin: '表兄弟姐妹', child: '孩子',
  house: '房子', apartment: '公寓', pet: '宠物', pets: '宠物',
  swing: '秋千', tricycle: '三轮车', slide: '滑梯',
  cloud: '云', clouds: '云', lightning: '闪电', thunder: '雷声',
  meat: '肉', chicken: '鸡肉', corn: '玉米', potatoes: '土豆', potato: '土豆',
  salad: '沙拉', lemonade: '柠檬水', juice: '果汁', food: '食物', fruit: '水果',
  seeds: '种子', seed: '种子', sunny: '晴朗的', rainy: '下雨的', windy: '有风的',
  raincoat: '雨衣', hat: '帽子', umbrella: '雨伞', boots: '靴子',
  't-shirt': 'T恤', sweater: '毛衣', pants: '裤子', 'bathing suit': '泳衣',
  tractor: '拖拉机', barn: '谷仓', lamb: '小羊', horse: '马', dogs: '狗',
  ducks: '鸭子', chick: '小鸡', 'police car': '警车', 'fire truck': '消防车',
  ambulance: '救护车', truck: '卡车', 'toy store': '玩具店',
};
const choice = (text, isCorrect = false, extra = {}) => ({ text, is_correct: isCorrect, ...extra });

export function generateMockQuestions(inputText = '', minPerType = config.questions.minPerType) {
  const context = buildContext(inputText);
  return REQUIRED_QUESTION_TYPES.flatMap(type =>
    Array.from({ length: minPerType }, (_, index) => makeQuestion(type, index, context))
  );
}

export function generateQuestionsFromTasks(taskList = [], inputText = '') {
  const taskWords = unique((Array.isArray(taskList) ? taskList : [])
    .map(task => normalizeWord(task?.target_word))
    .filter(isUsefulWord));
  const baseContext = buildContext(inputText);
  const context = {
    ...baseContext,
    phonicsWords: taskWords.length ? taskWords : baseContext.phonicsWords,
    imageWords: taskWords.filter(word => IMAGE_WORDS.includes(word)).length
      ? taskWords.filter(word => IMAGE_WORDS.includes(word))
      : baseContext.imageWords,
  };
  const counters = {};
  return taskList
    .filter(task => REQUIRED_QUESTION_TYPES.includes(task?.question_type))
    .map(task => {
      const type = task.question_type;
      counters[type] = (counters[type] || 0) + 1;
      const index = counters[type] - 1;
      const taskWord = normalizeWord(task.target_word);
      const question = makeQuestion(type, index, {
        ...context,
        taskWord,
        taskSentence: task.target_sentence,
      });
      return {
        ...question,
        id: task.task_id || question.id,
        requirement_ids: [task.kp_id || 'LOCAL_FALLBACK'],
        source_refs: Array.isArray(task.source_refs) && task.source_refs.length ? task.source_refs : ['local_fallback'],
        knowledge_tags: Array.isArray(task.knowledge_tags) && task.knowledge_tags.length ? task.knowledge_tags : [`word:${question.target_word || taskWord}`, `type:${type}`],
        ability_targets: Array.isArray(task.ability_targets) && task.ability_targets.length ? task.ability_targets : TYPE_ABILITIES[type],
        target_word: question.target_word || task.target_word,
        target_sentence: question.target_sentence || task.target_sentence,
      };
    });
}

function buildContext(inputText) {
  const text = String(inputText || '').toLowerCase();
  const opw2 = loadOPW2();
  const requestedUnits = [...text.matchAll(/unit\s*(\d+)/gi)].map(match => match[1]);
  const unitWords = requestedUnits.length
    ? requestedUnits.flatMap(unit => opw2.vocabularyByUnit?.[unit] || [])
    : Object.values(opw2.vocabularyByUnit || {}).flat();
  const teacherWords = text.match(/\b[a-z]{2,12}\b/g) || [];
  const targetWords = unique([...teacherWords, ...unitWords]).filter(isUsefulWord);
  const imageWords = targetWords.filter(word => IMAGE_WORDS.includes(word));
  return {
    text,
    phonicsWords: targetWords.length ? targetWords : DEFAULT_WORDS,
    imageWords: imageWords.length ? imageWords : DEFAULT_WORDS.filter(word => IMAGE_WORDS.includes(word)),
    includeHowMuchMany: /how much|how many|countable|uncountable/.test(text),
  };
}

function makeQuestion(type, index, context) {
  const base = makeBase(type, index);
  const word = context.taskWord || context.phonicsWords[index % context.phonicsWords.length];
  const imageWord = context.imageWords.includes(word) ? word : context.imageWords[index % context.imageWords.length];
  const sentence = safeSentenceForWord(context.taskSentence, word, index, context);

  switch (type) {
    case 'listen_pick_image':
      return { ...base, audio_text: imageWord, options: imageOptions(imageWord, context.imageWords), target_word: imageWord };
    case 'match_word_image':
      return { ...base, word: imageWord, word_translation: imageWord, options: imageOptions(imageWord, context.imageWords), target_word: imageWord };
    case 'spell_word':
      return { ...base, audio_text: word, spell_word: word, word_translation: '', letter_pool: buildLetterPool(word), target_word: word };
    case 'read_aloud':
      return { ...base, text: sentence, translation: sentence, pronunciation_target: sentence, pronunciation_focus: focusWords(sentence, word), scene_key: 'school', role_name: 'Leo', role_icon: 'L', target_word: word, target_sentence: sentence };
    case 'listen_pick_word': {
      const prompt = isQuestionPrompt(context.taskSentence) ? context.taskSentence : questionPrompt(index, word);
      return { ...base, audio_text: prompt, options: answerOptions(prompt, word), target_word: word, target_sentence: prompt };
    }
    case 'listen_judge': {
      const judge = judgeItem(index, word, context);
      return { ...base, audio_text: judge.audio_text, answer: judge.answer, options: [choice('Correct', judge.answer), choice('Not correct', !judge.answer)], target_word: word, target_sentence: judge.audio_text };
    }
    case 'fill_blank': {
      const fill = fillBlankFor(index, word, context);
      return { ...base, sentence_parts: fill.parts, blank_answer: fill.answer, options: textOptions(fill.answer, fill.options, 4), target_word: word };
    }
    case 'word_order':
      return { ...base, sentence, words: shuffleSentence(sentence), translation: sentence, target_word: word, target_sentence: sentence };
    case 'translate_pick':
      return { ...base, source_text: sentence, source_lang: 'en', options: [choice(translateSentence(sentence), true), choice(translateSentence(`I see a ${nextWord(context.phonicsWords, index)}.`)), choice(translateSentence(`Can you spell ${word}?`))], target_word: word, target_sentence: sentence };
    case 'dialogue_complete': {
      const prompt = isQuestionPrompt(context.taskSentence) ? context.taskSentence : questionPrompt(index, word);
      return { ...base, dialogue: [{ name: 'Leo', icon: 'L', text: prompt, isBlank: false }, { name: 'Mia', icon: 'M', text: '', isBlank: true }], options: answerOptions(prompt, word), target_word: word, target_sentence: prompt };
    }
    case 'mixed_challenge': {
      const prompt = isQuestionPrompt(context.taskSentence) ? context.taskSentence : questionPrompt(index, word);
      return { ...base, audio_text: prompt, options: answerOptions(prompt, word), target_word: word, target_sentence: prompt };
    }
    default:
      return base;
  }
}

function safeSentenceForWord(taskSentence, word, index, context) {
  const sentence = String(taskSentence || '').trim();
  const unsafePersonSentence = isPersonWord(word) && /\b(it is|this is|what is this)\b/i.test(sentence);
  const unsafeMassSentence = (isUncountable(word) || isTasteAdjective(word) || isWeatherAdjective(word)) && /\b(it is|this is)\s+(a|an)\b/i.test(sentence);
  const unsafeWeatherSentence = isWeatherAdjective(word) && /\b(it is|this is|they are)\s+(a|an)?\s*(sunny|rainy|windy)\b/i.test(sentence) && !/^it is (sunny|rainy|windy)\.?$/i.test(sentence);
  if (sentence && !unsafePersonSentence && !unsafeMassSentence && !unsafeWeatherSentence) return sentence;
  return sentenceFor(index, word, context);
}

function makeBase(type, index) {
  return {
    id: `mock_${type}_${index + 1}`,
    type,
    module_id: moduleForType(type),
    requirement_ids: ['LOCAL_FALLBACK'],
    source_refs: ['local_mock'],
    knowledge_tags: [`type:${type}`],
    ability_targets: TYPE_ABILITIES[type],
    child_instruction: instructionForType(type),
    prompt: instructionForType(type),
    explanation: 'Generated from teacher input, OPW2, and phonics knowledge.',
  };
}

function sentenceFor(index, word, context) {
  if (isPersonWord(word)) return personSentence(word);
  if (isNaturalPhenomenon(word)) return naturalSentence(word);
  if (isTasteAdjective(word) || isWeatherAdjective(word)) return tasteSentence(word);
  if (isSenseVerb(word)) return senseSentence(word);
  if (context.includeHowMuchMany && index % 5 <= 1) return howMuchManySentence(index, word);
  if (index % 5 === 0) return `What is this? ${sentenceForWord(word)}`;
  if (index % 5 === 1) return `What are these? They are ${pluralize(word)}.`;
  if (index % 5 === 2) return isPluralLike(word) ? `These are ${pluralize(word)}.` : `This is ${nounPhrase(word)}.`;
  if (index % 5 === 3) return `These are ${pluralize(word)}.`;
  return `I see ${nounPhrase(word)}.`;
}

function howMuchManySentence(index, word) {
  if (index % 2 === 0) return `How much ${UNCOUNTABLE_LIST[index % UNCOUNTABLE_LIST.length]}?`;
  return `How many ${countableNoun(index, word)}?`;
}

function questionPrompt(index, word) {
  if (isPersonWord(word)) return personQuestion(word);
  if (isTasteAdjective(word)) return tasteQuestion();
  if (isWeatherAdjective(word)) return 'How is the weather?';
  if (isSenseVerb(word)) return senseQuestion(word);
  if (isPluralLike(word)) return 'What are these?';
  const cycle = index % 5;
  if (cycle === 0) return 'What is this?';
  if (cycle === 1) return 'What are these?';
  if (cycle === 2) return 'What is this?';
  if (cycle === 3) return 'What are these?';
  return `Is this ${article(word)} ${singular(word)}?`;
}

function answerOptions(prompt, word) {
  const answer = answerForPrompt(prompt, word);
  const lower = prompt.toLowerCase();
  let wrong;
  if (lower.startsWith('how many')) wrong = ['Some water.', 'Yes, it is.'];
  else if (lower.startsWith('how much')) wrong = ['Three pens.', 'Yes, I can.'];
  else if (lower.startsWith('what do you') && lower.includes('with')) wrong = senseDistractors(word);
  else if (lower.startsWith('what is this')) wrong = ['No, it is not.', 'Yes, I do.'];
  else if (lower.startsWith('what are these')) wrong = ['No, it is not.', 'Yes, it is.'];
  else if (lower.startsWith('what do you see')) wrong = [`I have ${nounPhrase(word)}.`, 'Yes, I do.'];
  else if (lower.startsWith('what do you have')) wrong = [`I see ${nounPhrase(word)}.`, 'Yes, I can.'];
  else wrong = ['Yes, I can.', 'Yes, I do.'];
  return uniqueOptions([choice(answer, true), ...wrong.map(text => choice(text, false))]);
}

function answerForPrompt(prompt, word) {
  const lower = prompt.toLowerCase();
  if (lower.startsWith('who is')) return personSentence(word);
  if (lower.startsWith('how is the weather')) return `It is ${singular(word)}.`;
  if (lower.startsWith('how many')) return `Three ${nounAfter(prompt, 'how many') || countableNoun(0, word)}.`;
  if (lower.startsWith('how much')) return `Some ${nounAfter(prompt, 'how much') || UNCOUNTABLE_LIST[0]}.`;
  if (lower.startsWith('how does it taste')) return tasteSentence(word);
  if (lower.startsWith('what do you') && lower.includes('with')) return senseSentence(verbFromSensePrompt(prompt) || word);
  if (lower.startsWith('what is this')) return sentenceForWord(word);
  if (lower.startsWith('what are these')) return `They are ${pluralize(word)}.`;
  if (lower.startsWith('what do you see')) return `I see ${nounPhrase(word)}.`;
  if (lower.startsWith('what do you have')) return `I have ${nounPhrase(word)}.`;
  if (lower.startsWith('what do you want')) return `I want ${nounPhrase(word)}.`;
  return 'Yes, it is.';
}

function judgeItem(index, word, context) {
  const pattern = index % 4;
  const other = nextWord(context.phonicsWords || DEFAULT_WORDS, index);
  if (isSenseVerb(word)) {
    if (pattern <= 1) return { audio_text: senseSentence(word), answer: true };
    return { audio_text: senseSentence(alternateSenseVerb(word)), answer: false };
  }
  if (pattern === 0) return { audio_text: sentenceForWord(word), answer: true };
  if (pattern === 1) return { audio_text: isPluralLike(word) ? `They are ${pluralize(word)}.` : sentenceForWord(word), answer: true };
  if (pattern === 2) return { audio_text: sentenceForWord(other), answer: false };
  return { audio_text: isPluralLike(other) ? `They are ${pluralize(other)}.` : sentenceForWord(other), answer: false };
}

function fillBlankFor(index, word, context = {}) {
  if (isSenseVerb(word)) {
    const bodyPart = SENSE_WITH[normalizeSenseVerb(word)];
    return { parts: [`I ${normalizeSenseVerb(word)} with my `, '.'], answer: bodyPart, options: unique([bodyPart, ...Object.values(SENSE_WITH)]).slice(0, 4) };
  }
  if (isTasteAdjective(word) || isWeatherAdjective(word)) {
    const pool = isTasteAdjective(word) ? [...TASTE_ADJECTIVES] : [...WEATHER_ADJECTIVES];
    return { parts: ['It is ', '.'], answer: singular(word), options: unique([singular(word), ...pool]).slice(0, 4) };
  }
  if (isNaturalPhenomenon(word) || isUncountable(word)) {
    return { parts: ['I see ', '.'], answer: singular(word), options: massSafeOptions(singular(word), index, context) };
  }
  if (index % 3 === 0) {
    if (isPluralLike(word)) return { parts: ['They are ', '.'], answer: pluralize(word), options: pluralSafeOptions(pluralize(word), index, context) };
    return { parts: ['It is ', ` ${singular(word)}.`], answer: article(word), options: ['a', 'an', 'the', 'some'].filter(Boolean) };
  }
  if (index % 3 === 1) return { parts: ['They are ', '.'], answer: pluralize(word), options: pluralSafeOptions(pluralize(word), index, context) };
  const pool = optionWordPool(context);
  return { parts: ['This is a ', '.'], answer: singular(word), options: [singular(word), nextWord(pool, index), nextWord(pool, index + 1), nextWord(pool, index + 2)] };
}

function pluralSafeOptions(answer, index, context = {}) {
  const pool = optionWordPool(context);
  return unique([
    answer,
    pluralize(nextWord(pool, index)),
    pluralize(nextWord(pool, index + 1)),
    pluralize(nextWord(pool, index + 2)),
  ]).slice(0, 4);
}

function optionWordPool(context = {}) {
  const pool = unique((context.phonicsWords || DEFAULT_WORDS)
    .map(singular)
    .filter(word => /^[a-z]+$/.test(word))
    .filter(word => !['smell', 'taste', 'touch', 'hear', 'see'].includes(word))
    .filter(word => !isTasteAdjective(word) && !isWeatherAdjective(word) && !isUncountable(word)));
  return pool.length ? pool : DEFAULT_WORDS;
}

function massSafeOptions(answer, index, context = {}) {
  const scoped = unique((context.phonicsWords || [])
    .map(singular)
    .filter(word => /^[a-z]+$/.test(word))
    .filter(word => !isTasteAdjective(word) && !isWeatherAdjective(word) && !isSenseVerb(word)));
  const fallback = [answer, 'rain', 'lightning', 'thunder'].filter(word => word === answer || isNaturalPhenomenon(word));
  const pool = unique([answer, ...(scoped.length ? scoped : fallback)])
    .filter(word => !isTasteAdjective(word) && !isWeatherAdjective(word));
  return [answer, nextWord(pool, index), nextWord(pool, index + 1), nextWord(pool, index + 2)];
}

function translateSentence(sentence) {
  const lower = String(sentence || '').toLowerCase();
  const word = pickKnownWord(lower);
  const zh = ZH[word] || word || 'word';
  if (lower.startsWith('how many')) return `How many ${ZH[singular(nounAfter(lower, 'how many'))] || zh}?`;
  if (lower.startsWith('how much')) return `How much ${ZH[singular(nounAfter(lower, 'how much'))] || zh}?`;
  if (lower.startsWith('what is this')) return '这是什么？';
  if (lower.startsWith('what are these')) return '这些是什么？';
  if (lower.startsWith('who is')) return '他/她是谁？';
  if (lower.startsWith('i touch with my hands')) return '我用手触摸。';
  if (lower.startsWith('i taste with my tongue')) return '我用舌头品尝。';
  if (lower.startsWith('i smell with my nose')) return '我用鼻子闻。';
  if (lower.startsWith('i hear with my ears')) return '我用耳朵听。';
  if (lower.startsWith('i see with my eyes')) return '我用眼睛看。';
  if (lower.startsWith('they are')) return `它们是${zh}。`;
  if (lower.startsWith('these are')) return `这些是${zh}。`;
  if (lower.startsWith('it is')) return `它是${zh}。`;
  if (lower.startsWith('this is')) return `这是${zh}。`;
  if (lower.includes('i see')) return `我看到${zh}。`;
  return zh;
}

function nounAfter(sentence, prefix) {
  return String(sentence || '').toLowerCase().replace(prefix, '').replace(/[?.!]/g, '').trim().split(/\s+/)[0] || '';
}

function pickKnownWord(sentence) {
  const words = String(sentence || '').toLowerCase().match(/[a-z]+/g) || [];
  return words.map(singular).find(word => ZH[word]) || '';
}

function countableNoun(index, word) {
  const base = singular(word);
  const plural = pluralize(word);
  if (base && !isUncountable(base) && !isTasteAdjective(base) && !isWeatherAdjective(base) && plural !== word) return plural;
  return COUNTABLES[index % COUNTABLES.length];
}

function sentenceForWord(word) {
  const clean = String(word || '').toLowerCase();
  if (isPersonWord(clean)) return personSentence(clean);
  return sentenceForWordClass(clean);
}

function isQuestionPrompt(value) {
  return /\?$/.test(String(value || '').trim());
}

function verbFromSensePrompt(prompt) {
  return String(prompt || '').toLowerCase().match(/what do you\s+([a-z]+)\s+with/)?.[1] || '';
}

function senseDistractors(word) {
  const correct = senseSentence(word);
  return Object.keys(SENSE_WITH)
    .filter(verb => senseSentence(verb) !== correct)
    .slice(0, 2)
    .map(senseSentence);
}

function imageOptions(correctWord, pool) {
  const scopedImageWords = pool.filter(word => IMAGE_WORDS.includes(word) && SUPPORTED_IMAGE_WORDS.has(word));
  const safePool = unique((scopedImageWords.length ? scopedImageWords : pool)
    .filter(word => SUPPORTED_IMAGE_WORDS.has(word)));
  const correct = SUPPORTED_IMAGE_WORDS.has(correctWord) && safePool.includes(correctWord)
    ? correctWord
    : safePool[0] || correctWord;
  const start = Math.max(0, safePool.indexOf(correct));
  const distractors = safePool.filter(word => word !== correct);
  const rotated = [...distractors.slice(start), ...distractors.slice(0, start)];
  const options = unique([correct, ...rotated]).slice(0, 3);
  return options
    .map(item => ({ text: item, label: item, image_key: item, is_correct: item === correct }));
}

function textOptions(correctWord, pool, count) {
  const values = unique([correctWord, ...pool]).slice(0, count);
  return values.map((text, index) => choice(text, index === 0));
}

function nextWord(pool, index) {
  return pool[(Math.max(0, index) + 1) % pool.length];
}

function buildLetterPool(word) {
  const answer = String(word).toUpperCase().split('');
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

function focusWords(sentence, word) {
  return (sentence.match(/[A-Za-z']+/g) || []).filter(item => item.toLowerCase() === word || /spell|read|see|how|much|many/.test(item.toLowerCase())).slice(0, 2);
}

function shuffleSentence(sentence) {
  const words = sentence.match(/[A-Za-z']+|[?.!,;]/g) || sentence.split(/\s+/);
  return [...words].sort((a, b) => a.localeCompare(b));
}

function spellOut(word) {
  return String(word || '').toUpperCase().split('').join('-') + '.';
}

function instructionForType(type) {
  const instructions = {
    listen_pick_image: 'Listen and choose the picture.',
    match_word_image: 'Choose the picture that matches the word.',
    spell_word: 'Listen and spell the word.',
    read_aloud: 'Read the sentence aloud.',
    listen_pick_word: 'Listen and choose the answer.',
    listen_judge: 'Listen and judge the sentence.',
    fill_blank: 'Choose the word to fill the blank.',
    word_order: 'Put the words in order.',
    translate_pick: 'Choose the matching sentence.',
    dialogue_complete: 'Complete the dialogue.',
    mixed_challenge: 'Choose the right pattern.',
  };
  return instructions[type] || 'Complete the question.';
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function uniqueOptions(options) {
  const seen = new Set();
  return options.filter(option => {
    const key = String(option.text || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeWord(value) {
  return normalizeCourseWord(String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim());
}

function isUsefulWord(value) {
  const word = normalizeWord(value);
  return /^[a-z][a-z -]{1,30}$/.test(word) && !['review', 'unit', 'practice', 'phonics', 'homework'].includes(word);
}

export default {
  generateMockQuestions,
  generateQuestionsFromTasks,
};
