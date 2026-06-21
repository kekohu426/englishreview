import { SUPPORTED_IMAGE_WORDS, isPersonWord, personQuestion, personSentence } from './semanticQuality.js';
import {
  TASTE_ADJECTIVES,
  WEATHER_ADJECTIVES,
  UNCOUNTABLES,
  SENSE_WITH,
  alternateSenseVerb,
  isTasteAdjective,
  isWeatherAdjective,
  isNaturalPhenomenon,
  isUncountable,
  isSenseVerb,
  normalizeSenseVerb,
  senseSentence,
  tasteSentence,
  naturalSentence,
  sentenceForWordClass,
  nounPhrase,
  article,
  pluralize,
  singular,
  isPluralLike,
} from '../knowledge/wordClasses.js';

const CHOICE_TYPES = new Set([
  'listen_pick_image',
  'match_word_image',
  'listen_pick_word',
  'listen_judge',
  'fill_blank',
  'translate_pick',
  'dialogue_complete',
  'mixed_challenge',
]);

const EN_TO_ZH = {
  water: '水',
  milk: '牛奶',
  juice: '果汁',
  rice: '米饭',
  bread: '面包',
  corn: '玉米',
  cat: '猫',
  dog: '狗',
  ant: '蚂蚁',
  ants: '蚂蚁',
  yak: '牦牛',
  ax: '斧头',
  ram: '公羊',
  yam: '山药',
  dad: '爸爸',
  cap: '帽子',
  bat: '球棒',
  web: '网',
  vet: '兽医',
  ten: '十',
  jet: '喷气机',
  net: '网',
  wet: '湿的',
  pet: '宠物',
  hip: '臀部',
  ink: '墨水',
  zip: '拉链',
  lip: '嘴唇',
  tip: '尖端',
  sip: '小口喝',
  rib: '肋骨',
  kid: '孩子',
  hen: '母鸡',
  pen: '钢笔',
  bed: '床',
  red: '红色',
  book: '书',
  bag: '书包',
  pencil: '铅笔',
  egg: '鸡蛋',
  eggs: '鸡蛋',
  jam: '果酱',
};

Object.assign(EN_TO_ZH, {
  book: '\u4e66',
  books: '\u4e66',
  ball: '\u7403',
  box: '\u76d2\u5b50',
  scissors: '\u526a\u5200',
  markers: '\u9a6c\u514b\u7b14',
  marker: '\u9a6c\u514b\u7b14',
  shelves: '\u67b6\u5b50',
  shelf: '\u67b6\u5b50',
  hoops: '\u5708',
  hoop: '\u5708',
  jungle: '\u4e1b\u6797',
  gym: '\u5065\u8eab\u67b6',
  boy: '\u7537\u5b69',
  snail: '\u8717\u725b',
  trail: '\u5c0f\u8def',
  tongue: '\u820c\u5934',
  nose: '\u9f3b\u5b50',
  ear: '\u8033\u6735',
  ears: '\u8033\u6735',
  hands: '\u624b',
  eyes: '\u773c\u775b',
  smell: '\u95fb',
  taste: '\u5c1d',
  touch: '\u89e6\u6478',
  hear: '\u542c',
  campfire: '\u7bdd\u706b',
  flower: '\u82b1',
  soup: '\u6c64',
  piano: '\u94a2\u7434',
  grandfather: '\u7237\u7237',
  grandmother: '\u5976\u5976',
  father: '\u7238\u7238',
  mother: '\u5988\u5988',
  aunt: '\u963f\u59e8',
  uncle: '\u53d4\u53d4',
  cousin: '\u8868\u5144\u5f1f\u59d0\u59b9',
  child: '\u5b69\u5b50',
  house: '\u623f\u5b50',
  apartment: '\u516c\u5bd3',
  pet: '\u5ba0\u7269',
  pets: '\u5ba0\u7269',
  swing: '\u79cb\u5343',
  tricycle: '\u4e09\u8f6e\u8f66',
  slide: '\u6ed1\u68af',
  cloud: '\u4e91',
  clouds: '\u4e91',
  lightning: '\u95ea\u7535',
  thunder: '\u96f7\u58f0',
});
const KNOWN_WORDS = Object.keys(EN_TO_ZH);
const PLURAL_LIKE_WORDS = new Set([
  'scissors', 'markers', 'shelves', 'books', 'hoops',
  'clouds', 'hands', 'eyes', 'ears', 'pets', 'boots', 'pants',
  'shorts', 'sandals', 'dogs', 'ducks', 'eggs', 'hats', 'sweaters',
]);
const SAFE_IMAGE_WORDS = SUPPORTED_IMAGE_WORDS;
const IRREGULAR_SINGULARS = {
  shelves: 'shelf',
  scissors: 'scissors',
};
const IRREGULAR_PLURALS = {
  shelf: 'shelves',
  scissors: 'scissors',
};

export function repairQuestions(questions) {
  const repaired = questions.map((question, index) => repairQuestion(question, index));
  return balanceListenJudgeAnswers(distributeCorrectAnswers(repaired));
}

export function validatePedagogicalQuality(questions) {
  const errors = [];
  const correctPositions = [];
  const judgeCorrectAnswers = [];

  questions.forEach((question, index) => {
    const label = `question ${index + 1} (${question?.type || 'unknown'} ${question?.id || ''})`;

    if (CHOICE_TYPES.has(question?.type)) {
      const correct = (question.options || []).filter(option => option?.is_correct === true);
      if (correct.length !== 1) errors.push(`${label}: expected exactly one correct option`);
      const correctIndex = (question.options || []).findIndex(option => option?.is_correct === true);
      if (correctIndex >= 0) correctPositions.push(correctIndex);
      if (question.type === 'listen_judge') {
        judgeCorrectAnswers.push(String((question.options || [])[correctIndex]?.text || ''));
      }
    }

    if (['listen_pick_image', 'match_word_image'].includes(question?.type)) {
      const imageKeys = (question.options || []).map(option => normalizedWord(option?.image_key || option?.text || option?.label));
      const duplicateKeys = imageKeys.filter((key, keyIndex) => key && imageKeys.indexOf(key) !== keyIndex);
      const unsafeKeys = imageKeys.filter(key => key && !SUPPORTED_IMAGE_WORDS.has(key));
      if (duplicateKeys.length) errors.push(`${label}: duplicate image option keys: ${duplicateKeys.join(', ')}`);
      if (unsafeKeys.length) errors.push(`${label}: unsupported image option keys: ${unsafeKeys.join(', ')}`);
    }

    if ((question.type === 'listen_pick_word' || question.type === 'mixed_challenge') && isQuestionSentence(question.audio_text)) {
      const correctText = getCorrectOptionText(question).toLowerCase();
      if (isBareWord(correctText)) {
        errors.push(`${label}: sentence/question prompt has a bare-word answer option`);
      }
      if (isHowMuchMany(question.audio_text) && !/(some|three|two|many|much|water|ants|eggs|cats|dogs)/i.test(correctText)) {
        errors.push(`${label}: How much/How many answer is not compatible`);
      }
      const compatibilityError = promptAnswerCompatibilityError(question.audio_text, correctText);
      if (compatibilityError) errors.push(`${label}: ${compatibilityError}`);
    }

    if (question.type === 'spell_word') {
      const answer = normalizedWord(question.spell_word || question.answer || question.audio_text);
      const hint = normalizedWord(question.word_translation);
      if (answer && hint === answer) {
        errors.push(`${label}: spelling hint leaks the answer`);
      }
      const poolText = (question.letter_pool || []).join('').toLowerCase();
      if (answer && poolText.slice(0, answer.length) === answer) {
        errors.push(`${label}: spelling letters reveal answer order`);
      }
    }

    if (question.type === 'translate_pick' && question.source_lang === 'en') {
      const correctText = getCorrectOptionText(question);
      if (!hasCjk(correctText)) {
        errors.push(`${label}: English source should have a Chinese correct option`);
      }
    }

    if (question.type === 'dialogue_complete') {
      const prompt = firstDialoguePrompt(question).toLowerCase();
      const correctText = getCorrectOptionText(question).toLowerCase();
      if (isBareWord(correctText)) {
        errors.push(`${label}: dialogue answer cannot be a bare word`);
      }
      if (prompt.includes('can you spell') && /^yes[,. ]+[a-z]+\.?$/.test(correctText)) {
        errors.push(`${label}: spelling dialogue answer should spell letters, not say "Yes. word."`);
      }
      const compatibilityError = promptAnswerCompatibilityError(prompt, correctText);
      if (compatibilityError) errors.push(`${label}: ${compatibilityError}`);
    }

    if (question.type === 'fill_blank') {
      const answer = normalizedWord(question.blank_answer || getCorrectOptionText(question));
      const after = String(question.sentence_parts?.[1] || '');
      const before = String(question.sentence_parts?.[0] || '');
      if (answer && /^[a-z]/i.test(after)) {
        errors.push(`${label}: fill_blank answer is split inside a word`);
      }
      if (answer && /[a-z]$/i.test(before)) {
        errors.push(`${label}: fill_blank blank starts inside a word`);
      }
      if (/how many/i.test(`${before} ${after}`) && answer && (!isPlural(answer) || UNCOUNTABLES.has(singular(answer)))) {
        errors.push(`${label}: How many blank answer should be plural`);
      }
      if (answer && afterContainsAnswer(after, answer)) {
        errors.push(`${label}: fill_blank leaks answer after the blank`);
      }
      const frame = `${before} ____ ${after}`.toLowerCase().replace(/\s+/g, ' ');
      if ((isTasteAdjective(answer) || isWeatherAdjective(answer)) && /\b(this is|it is)\s+(a|an)\s+____|\b(this is|it is)\s+a\s+____/.test(frame)) {
        errors.push(`${label}: adjective answer is placed in a noun/article blank frame`);
      }
      if ((isUncountable(answer) || isNaturalPhenomenon(answer)) && /\b(this is|it is)\s+(a|an)\s+____|\b(this is|it is)\s+a\s+____/.test(frame)) {
        errors.push(`${label}: mass/natural word is placed in an article blank frame`);
      }
    }
  });

  if (correctPositions.length >= 9) {
    const counts = correctPositions.reduce((acc, index) => {
      acc[index] = (acc[index] || 0) + 1;
      return acc;
    }, {});
    const max = Math.max(...Object.values(counts));
    if (max / correctPositions.length > 0.6) {
      errors.push(`correct answer positions are too concentrated: ${JSON.stringify(counts)}`);
    }
  }

  if (judgeCorrectAnswers.length >= 4 && new Set(judgeCorrectAnswers).size < 2) {
    errors.push(`listen_judge answers are too predictable: ${judgeCorrectAnswers.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

function repairQuestion(question, index) {
  const repaired = { ...question };

  switch (repaired.type) {
    case 'listen_pick_word':
    case 'mixed_challenge':
      return repairListenPickWord(repaired, index);
    case 'translate_pick':
      return repairTranslatePick(repaired, index);
    case 'dialogue_complete':
      return repairDialogueComplete(repaired, index);
    case 'spell_word':
      return repairSpellWord(repaired);
    case 'fill_blank':
      return repairFillBlank(repaired, index);
    case 'listen_pick_image':
    case 'match_word_image':
      return repairImageOptions(repaired, index);
    case 'listen_judge':
      return repairChoiceOptions(repaired, index);
    default:
      return repaired;
  }
}

function repairListenPickWord(question, index) {
  const word = pickWordFromQuestion(question, index);
  const audio = normalizePromptForWord(String(question.audio_text || '').trim(), word);
  question.audio_text = audio;
  if (isQuestionSentence(audio)) question.target_sentence = audio;
  if (!isQuestionSentence(audio)) return repairChoiceOptions(question, index);

  const answer = answerForPrompt(audio, word);
  question.options = uniqueOptions([
    option(answer, true),
    ...distractorsForPrompt(audio, answer, word).map(text => option(text, false)),
  ]);
  question.explanation = question.explanation || `Answer: ${answer}`;
  return question;
}

function repairTranslatePick(question, index) {
  const source = String(question.source_text || question.audio_text || '').trim();
  if (!source) return repairChoiceOptions(question, index);

  if (question.source_lang === 'en') {
    const word = pickWordFromText(source) || pickWordFromQuestion(question, index);
    const correct = translateSentence(source, word);
    question.options = uniqueOptions(fillTranslateOptions([
      option(correct, true),
      option(translateSentence(makeDistractorSentence(source, index + 1), pickWordFromQuestion(question, index + 1)), false),
      option(translateSentence(makeDistractorSentence(source, index + 2), pickWordFromQuestion(question, index + 2)), false),
    ], correct, index));
  } else {
    question.options = repairOneCorrect(question.options);
  }
  return question;
}

function repairDialogueComplete(question, index) {
  const word = pickWordFromQuestion(question, index);
  let prompt = normalizePromptForWord(firstDialoguePrompt(question), word);
  const declarative = dialogueFromDeclarative(prompt);
  const answer = declarative?.answer || answerForPrompt(prompt, word);
  prompt = declarative?.prompt || prompt;
  question.dialogue = normalizeDialogue(question.dialogue, prompt);
  question.options = uniqueOptions([
    option(answer, true),
    ...distractorsForPrompt(prompt, answer, word).map(text => option(text, false)),
  ]);
  question.explanation = question.explanation || `Answer: ${answer}`;
  return question;
}

function dialogueFromDeclarative(prompt) {
  const text = String(prompt || '').trim();
  const lower = text.toLowerCase();
  if (!text || isQuestionSentence(text)) return null;

  if (/^i have\b/.test(lower)) return { prompt: 'What do you have?', answer: ensureSentence(text) };
  if (/^i see\b/.test(lower)) return { prompt: 'What do you see?', answer: ensureSentence(text) };
  if (/^i want\b/.test(lower)) return { prompt: 'What do you want?', answer: ensureSentence(text) };
  if (/^i like\b/.test(lower)) return { prompt: 'What do you like?', answer: ensureSentence(text) };
  if (/^i can read\b/.test(lower)) return { prompt: 'Can you read it?', answer: 'Yes, I can.' };

  return null;
}

function repairSpellWord(question) {
  const answer = normalizedWord(question.spell_word || question.answer || question.audio_text);
  if (answer) {
    question.spell_word = answer;
    question.audio_text = answer;
    question.letter_pool = buildLetterPool(answer, question.letter_pool);
  }

  const hint = String(question.word_translation || '').trim();
  if (!hint || normalizedWord(hint) === answer || /^[a-z\s-]+$/i.test(hint)) {
    question.word_translation = '';
  }

  return question;
}

function repairFillBlank(question, index) {
  let answer = String(question.blank_answer || getCorrectOptionText(question) || pickWordFromQuestion(question, index)).trim();
  let before = String(question.sentence_parts?.[0] || '');
  let after = String(question.sentence_parts?.[1] || '');

  if (answer && afterContainsAnswer(after, answer)) {
    question.sentence_parts = [`I see ${articleForBlank(answer)} `, '.'];
    before = question.sentence_parts[0];
    after = question.sentence_parts[1];
  }

  const beforeLower = before.toLowerCase();
  const afterNoun = normalizedWord(String(after).match(/^\s*([a-z]+)/i)?.[1] || '');

  if (/^how\s+$/i.test(before) && afterNoun) {
    answer = UNCOUNTABLES.has(singular(afterNoun)) ? 'much' : 'many';
  }

  if (answer && /^[a-z]/i.test(after)) {
    const suffix = after.match(/^\s*([a-z]+)/i)?.[1] || '';
    const combined = normalizedWord(`${answer}${suffix}`);
    if (combined) {
      answer = combined;
      question.sentence_parts = [before, after.replace(/^\s*[a-z]+/i, '') || '?'];
    }
  }

  if (answer && /[a-z]$/i.test(before)) {
    const prefix = before.match(/([a-z]+)\s*$/i)?.[1] || '';
    const combined = normalizedWord(`${prefix}${answer}`);
    if (combined) {
      answer = combined;
      question.sentence_parts = [before.replace(/[a-z]+\s*$/i, ''), after];
    }
  }

  if (/how many/i.test(beforeLower) && answer && (!isPlural(answer) || UNCOUNTABLES.has(singular(answer)))) {
    answer = pluralize(answer);
    if (UNCOUNTABLES.has(singular(answer))) {
      answer = 'pens';
    }
  }

  if ((isTasteAdjective(answer) || isWeatherAdjective(answer)) && articleBlankFrame(before, after)) {
    question.sentence_parts = ['It is ', '.'];
    before = question.sentence_parts[0];
    after = question.sentence_parts[1];
  }

  if ((isUncountable(answer) || isNaturalPhenomenon(answer)) && articleBlankFrame(before, after)) {
    question.sentence_parts = ['I see ', '.'];
    before = question.sentence_parts[0];
    after = question.sentence_parts[1];
  }

  question.blank_answer = answer;
  if (Array.isArray(question.options)) {
    const hasAnswer = question.options.some(option => normalizedWord(option?.text) === normalizedWord(answer));
    question.options = repairOneCorrect(hasAnswer
      ? question.options.map(option => ({ ...option, is_correct: normalizedWord(option.text) === normalizedWord(answer) }))
      : [option(answer, true), ...question.options.map(item => ({ ...item, is_correct: false }))]
    );
  }

  return repairChoiceOptions(question, index);
}

function repairChoiceOptions(question, index) {
  if (Array.isArray(question.options)) {
    if (question.type === 'listen_judge') {
      if (isWeatherAdjective(question.target_word) && /\b(it is|this is|they are)\s+(a|an)?\s*(sunny|rainy|windy)\b/i.test(String(question.audio_text || ''))) {
        question.audio_text = `It is ${singular(question.target_word)}.`;
        question.target_sentence = question.audio_text;
      }
      const answer = resolveJudgeAnswer(question);
      question.answer = answer;
      question.options = judgeOptionsFor(answer);
    } else {
      question.options = repairOneCorrect(question.options);
    }
  }
  return question;
}

function repairImageOptions(question, index) {
  const requested = normalizedWord(question.target_word || question.word || question.audio_text);
  const existingSafeWords = uniqueValues((question.options || [])
    .map(item => normalizedWord(item?.image_key || item?.label || item?.text))
    .filter(word => SUPPORTED_IMAGE_WORDS.has(word)));
  const safeWords = existingSafeWords.length >= 3 ? existingSafeWords : [...SAFE_IMAGE_WORDS].filter(word => SUPPORTED_IMAGE_WORDS.has(word));
  const correct = SUPPORTED_IMAGE_WORDS.has(requested) ? requested : safeWords[index % safeWords.length];
  const pool = safeWords.filter(word => word !== correct);
  question.target_word = correct;
  if (question.type === 'listen_pick_image') question.audio_text = correct;
  if (question.type === 'match_word_image') {
    question.word = correct;
    question.word_translation = '';
  }
  question.options = [correct, ...pool].slice(0, 3).map(word => ({
    text: word,
    label: word,
    image_key: word,
    is_correct: word === correct,
  }));
  return question;
}

function distributeCorrectAnswers(questions) {
  let choiceIndex = 0;
  return questions.map(question => {
    if (!CHOICE_TYPES.has(question?.type) || !Array.isArray(question.options) || question.options.length < 2) {
      return question;
    }

    if (question.type === 'listen_judge') {
      const answer = resolveJudgeAnswer(question);
      return { ...question, answer, options: judgeOptionsFor(answer) };
    }

    const options = repairOneCorrect(question.options);
    const correctIndex = options.findIndex(option => option.is_correct);
    const targetIndex = choiceIndex % options.length;
    choiceIndex += 1;

    if (correctIndex === targetIndex || correctIndex < 0) {
      return { ...question, options };
    }

    const moved = [...options];
    const [correct] = moved.splice(correctIndex, 1);
    moved.splice(targetIndex, 0, correct);
    return { ...question, options: moved };
  });
}

function balanceListenJudgeAnswers(questions) {
  const judgeIndexes = questions
    .map((question, index) => question?.type === 'listen_judge' ? index : -1)
    .filter(index => index >= 0);

  if (judgeIndexes.length < 4) return questions;

  const answers = judgeIndexes.map(index => resolveJudgeAnswer(questions[index]));
  const uniqueAnswers = new Set(answers);
  if (uniqueAnswers.size > 1) return questions;

  const uniformAnswer = answers[0];
  const targetFlipCount = Math.floor(judgeIndexes.length / 2);
  let flipped = 0;
  return questions.map((question, index) => {
    if (question?.type !== 'listen_judge') return question;
    const localIndex = judgeIndexes.indexOf(index);
    const shouldFlip = localIndex % 2 === 1 && flipped < targetFlipCount;
    if (!shouldFlip) {
      return { ...question, answer: uniformAnswer, options: judgeOptionsFor(uniformAnswer) };
    }
    flipped += 1;
    const answer = !uniformAnswer;
    return {
      ...question,
      audio_text: answer
        ? makeCorrectJudgeSentence(question.audio_text, question.target_word, index)
        : makeIncorrectJudgeSentence(question.audio_text, question.target_word, index),
      answer,
      options: judgeOptionsFor(answer),
      explanation: question.explanation || (answer ? 'This sentence is correct.' : 'This sentence is not correct.'),
    };
  });
}

function makeCorrectJudgeSentence(sentence, targetWord, index) {
  const text = String(sentence || '').trim();
  const lower = text.toLowerCase();
  const cleanTarget = normalizedWord(targetWord);

  if (isSenseVerb(cleanTarget)) return senseSentence(cleanTarget);
  if (isTasteAdjective(cleanTarget) || isWeatherAdjective(cleanTarget)) return tasteSentence(cleanTarget);
  if (isNaturalPhenomenon(cleanTarget)) return naturalSentence(cleanTarget);

  if (/^how many\b/.test(lower)) {
    const noun = nounAfterQuestionPrefix(lower, 'how many') || targetWord || KNOWN_WORDS[index % KNOWN_WORDS.length];
    return `How many ${pluralize(noun)}?`;
  }

  if (/^how much\b/.test(lower)) {
    const noun = nounAfterQuestionPrefix(lower, 'how much') || 'water';
    const safeNoun = UNCOUNTABLES.has(singular(noun)) ? singular(noun) : 'water';
    return `How much ${safeNoun}?`;
  }

  const word = normalizedWord(targetWord) || pickWordFromText(text) || KNOWN_WORDS[index % KNOWN_WORDS.length] || 'pen';
  return `How many ${pluralize(word)}?`;
}

function makeIncorrectJudgeSentence(sentence, targetWord, index) {
  const text = String(sentence || '').trim();
  const lower = text.toLowerCase();
  const cleanTarget = normalizedWord(targetWord);

  if (isSenseVerb(cleanTarget)) return senseSentence(alternateSenseVerb(cleanTarget));
  if (isTasteAdjective(cleanTarget)) return `It is ${alternateTaste(singular(cleanTarget))}.`;
  if (isWeatherAdjective(cleanTarget)) return `It is ${alternateWeather(singular(cleanTarget))}.`;
  if (isNaturalPhenomenon(cleanTarget)) return sentenceForWord(alternateWord(cleanTarget));

  if (/^how many\b/.test(lower)) {
    const noun = nounAfterQuestionPrefix(lower, 'how many') || pluralize(targetWord || KNOWN_WORDS[index % KNOWN_WORDS.length]);
    return `How much ${pluralize(noun)}?`;
  }

  if (/^how much\b/.test(lower)) {
    const noun = nounAfterQuestionPrefix(lower, 'how much') || 'water';
    return `How many ${singular(noun)}?`;
  }

  const word = normalizedWord(targetWord) || pickWordFromText(text) || KNOWN_WORDS[index % KNOWN_WORDS.length] || 'pen';
  return `How much ${pluralize(word)}?`;
}

function resolveJudgeAnswer(question) {
  const inferred = inferJudgeAnswer(question.audio_text);
  return typeof inferred === 'boolean'
    ? inferred
    : typeof question.answer === 'boolean'
    ? question.answer
    : ((question.options || []).find(option => option?.is_correct === true)?.text || '').toLowerCase().includes('correct');
}

function judgeOptionsFor(isCorrectSentence) {
  return [
    { text: 'Correct', is_correct: isCorrectSentence === true },
    { text: 'Not correct', is_correct: isCorrectSentence !== true },
  ];
}

function afterContainsAnswer(after, answer) {
  const afterWords = String(after || '').toLowerCase().match(/[a-z]+/g) || [];
  const normalizedAnswer = normalizedWord(answer);
  return !!normalizedAnswer && afterWords.some(word => normalizedWord(word) === normalizedAnswer);
}

function articleBlankFrame(before, after = '') {
  return /\b(this is|it is)\s+(a|an)\s*$/i.test(String(before || ''))
    || /\b(this is|it is)\s+(a|an)\s+____/i.test(`${before} ____ ${after}`);
}

function articleForBlank(answer) {
  const clean = singular(answer);
  if (UNCOUNTABLES.has(clean)) return 'some';
  return /^[aeiou]/i.test(clean) ? 'an' : 'a';
}

function inferJudgeAnswer(sentence) {
  const lower = String(sentence || '').toLowerCase().trim();
  if (!lower) return null;
  const many = nounAfterQuestionPrefix(lower, 'how many');
  if (many) return !UNCOUNTABLES.has(singular(many)) && isPlural(many);
  const much = nounAfterQuestionPrefix(lower, 'how much');
  if (much) return UNCOUNTABLES.has(singular(much));
  return null;
}

function nounAfterQuestionPrefix(text, prefix) {
  const lower = String(text || '').toLowerCase().trim();
  const normalizedPrefix = String(prefix || '').toLowerCase();
  if (!lower.startsWith(normalizedPrefix)) return '';
  return pickNounAfter(lower, normalizedPrefix);
}

function repairOneCorrect(options = []) {
  const byKey = new Map();
  options
    .map(item => ({ ...item, text: String(item?.text || item?.label || '').trim() }))
    .filter(item => item.text || item.image_key)
    .forEach(item => {
      const key = String(item.text || item.image_key || '').toLowerCase();
      const existing = byKey.get(key);
      if (!existing || item.is_correct === true) {
        byKey.set(key, item);
      }
    });
  const normalized = [...byKey.values()];

  if (normalized.length === 0) return options;

  let seenCorrect = false;
  return normalized.map((item, index) => {
    const isCorrect = item.is_correct === true && !seenCorrect;
    if (isCorrect) seenCorrect = true;
    return { ...item, is_correct: isCorrect || (!seenCorrect && index === normalized.length - 1) };
  });
}

function answerForPrompt(prompt, word) {
  const text = String(prompt || '').trim();
  const lower = text.toLowerCase();
  const cleanWord = normalizedWord(word) || pickWordFromText(text) || 'book';

  if (/^who is\b/.test(lower)) return personSentence(cleanWord);
  if (/^how is the weather\b/.test(lower)) return `It is ${singular(cleanWord)}.`;
  if (/how much/.test(lower)) {
    const noun = pickNounAfter(lower, 'how much') || cleanWord;
    return `Some ${singular(noun)}.`;
  }
  if (/how does it taste/.test(lower)) return tasteSentence(cleanWord);
  if (/how many/.test(lower)) {
    const noun = pickNounAfter(lower, 'how many') || pluralize(cleanWord);
    return `Three ${pluralize(singular(noun))}.`;
  }
  if (/can you spell/.test(lower)) return spellOut(cleanWord);
  if (/what do you\s+[a-z]+\s+with/.test(lower)) return senseSentence(verbFromSensePrompt(text) || cleanWord);
  if (/what are these/.test(lower)) return `They are ${pluralize(cleanWord)}.`;
  if (/what is this/.test(lower)) return sentenceForWord(cleanWord);
  if (/what do you see/.test(lower)) return `I see ${nounPhrase(cleanWord)}.`;
  if (/what do you have/.test(lower)) return `I have ${nounPhrase(cleanWord)}.`;
  if (/what do you want/.test(lower)) return `I want ${nounPhrase(cleanWord)}.`;
  if (/can you/.test(lower)) return 'Yes, I can.';
  if (/do you/.test(lower)) return 'Yes, I do.';
  if (/is this|is it/.test(lower)) return 'Yes, it is.';
  return cleanWord;
}

function normalizePromptForWord(prompt, word) {
  const cleanPrompt = String(prompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  if ((/^what is this\??$/.test(lower) || /^what are these\??$/.test(lower)) && isPersonWord(word)) return personQuestion(word);
  if ((/^what is this\??$/.test(lower) || /^what are these\??$/.test(lower)) && isTasteAdjective(word)) return 'How does it taste?';
  if ((/^what is this\??$/.test(lower) || /^what are these\??$/.test(lower)) && isWeatherAdjective(word)) return 'How is the weather?';
  if (/^what is this\??$/.test(lower) && isPluralLike(word)) return 'What are these?';
  if (/^what are these\??$/.test(lower) && !isPluralLike(word)) return 'What is this?';
  return cleanPrompt;
}

function promptAnswerCompatibilityError(prompt, answer) {
  const lowerPrompt = String(prompt || '').toLowerCase();
  const lowerAnswer = String(answer || '').toLowerCase();
  if (/^what is this\b/.test(lowerPrompt) && /^they are\b/.test(lowerAnswer)) {
    return 'singular prompt cannot have a plural answer';
  }
  if (/^what are these\b/.test(lowerPrompt) && /^(it is|this is)\b/.test(lowerAnswer)) {
    return 'plural prompt cannot have a singular answer';
  }
  return '';
}

function distractorsForPrompt(prompt, answer, word) {
  const lower = String(prompt || '').toLowerCase();
  const cleanWord = normalizedWord(word) || 'book';
  if (/^who is\b/.test(lower)) return ['It is a book.', 'They are books.'];
  if (/^how is the weather\b/.test(lower)) return ['It is a raincoat.', 'They are hats.'];
  if (/how much/.test(lower)) return ['Three pens.', 'Yes, I can.'];
  if (/how does it taste/.test(lower)) return [...TASTE_ADJECTIVES].filter(item => item !== singular(cleanWord)).slice(0, 2).map(tasteSentence);
  if (/how many/.test(lower)) return ['Some water.', 'Yes, it is.'];
  if (/what do you\s+[a-z]+\s+with/.test(lower)) return senseDistractors(verbFromSensePrompt(prompt) || cleanWord);
  if (/can you spell/.test(lower)) return [`I see ${nounPhrase(cleanWord)}.`, 'No, it is not.'];
  if (/what are these/.test(lower)) return ['No, it is not.', 'Yes, it is.'];
  if (/what is this/.test(lower)) {
    return ['No, it is not.', 'Yes, I do.'];
  }
  if (/what do you see/.test(lower)) return [`I have ${nounPhrase(cleanWord)}.`, 'Yes, I do.'];
  if (/what do you have/.test(lower)) return [`I see ${nounPhrase(cleanWord)}.`, 'Yes, I can.'];
  if (/what do you want/.test(lower)) return [`I see ${nounPhrase(cleanWord)}.`, 'Yes, it is.'];
  if (/can you/.test(lower)) return ['Yes, it is.', 'Yes, I do.'];
  if (/do you/.test(lower)) return ['Yes, I can.', 'Yes, it is.'];
  if (/is this|is it/.test(lower)) return ['Yes, I can.', 'Yes, I do.'];
  return KNOWN_WORDS.filter(item => item !== cleanWord).slice(0, 2);
}

function translateSentence(sentence, word) {
  const lower = String(sentence || '').toLowerCase();
  const cleanWord = normalizedWord(word) || pickWordFromText(lower) || 'book';
  const zh = EN_TO_ZH[cleanWord] || EN_TO_ZH[singular(cleanWord)] || cleanWord;

  if (/how much/.test(lower)) return `多少${EN_TO_ZH[pickNounAfter(lower, 'how much') || cleanWord] || zh}？`;
  if (/how many/.test(lower)) return `多少个${EN_TO_ZH[singular(pickNounAfter(lower, 'how many') || cleanWord)] || zh}？`;
  if (/can you spell/.test(lower)) return `你会拼 ${cleanWord} 吗？`;
  if (/what is this/.test(lower)) return `这是什么？`;
  if (/what are these/.test(lower)) return `这些是什么？`;
  if (/who is/.test(lower)) return `他/她是谁？`;
  if (/what do you see/.test(lower)) return `你看见了什么？`;
  if (/what do you have/.test(lower)) return `你有什么？`;
  if (/what do you want/.test(lower)) return `你想要什么？`;
  if (/i touch with my hands/.test(lower)) return '我用手触摸。';
  if (/i taste with my tongue/.test(lower)) return '我用舌头品尝。';
  if (/i smell with my nose/.test(lower)) return '我用鼻子闻。';
  if (/i hear with my ears/.test(lower)) return '我用耳朵听。';
  if (/i see with my eyes/.test(lower)) return '我用眼睛看。';
  if (/they are/.test(lower)) return `它们是${zh}。`;
  if (/these are/.test(lower)) return `这些是${zh}。`;
  if (/it is/.test(lower)) return `它是${articleZh(cleanWord)}${zh}。`;
  if (/this is/.test(lower)) return `这是${articleZh(cleanWord)}${zh}。`;
  if (/i see/.test(lower)) return `我看见${articleZh(cleanWord)}${zh}。`;
  if (/i have/.test(lower)) return `我有${articleZh(cleanWord)}${zh}。`;
  if (/i want/.test(lower)) return `我想要${articleZh(cleanWord)}${zh}。`;
  if (/i can read/.test(lower)) return `我会读 ${cleanWord}。`;
  if (/is this/.test(lower)) return `这是你的${zh}吗？`;
  if (/can you/.test(lower)) return '你会吗？';
  if (/do you/.test(lower)) return '你喜欢吗？';
  return zh;
}

function makeDistractorSentence(source, index) {
  const lower = String(source || '').toLowerCase();
  const word = KNOWN_WORDS[index % KNOWN_WORDS.length];
  if (/how much/.test(lower)) return `How many ${pluralize(word)}?`;
  if (/how many/.test(lower)) return `How much water?`;
  if (/can you spell/.test(lower)) return `I see ${nounPhrase(word)}.`;
  if (/what do you\s+[a-z]+\s+with/.test(lower)) return senseSentence(KNOWN_WORDS[index % KNOWN_WORDS.length]);
  if (/what is this/.test(lower)) return `They are ${pluralize(word)}.`;
  if (/what are these/.test(lower)) return sentenceForWord(word);
  if (/they are|these are/.test(lower)) return `They are ${pluralize(word)}.`;
  if (/it is|this is/.test(lower)) return sentenceForWord(word);
  return index % 2 === 0 ? `I have ${nounPhrase(word)}.` : `I see ${nounPhrase(word)}.`;
}

function normalizeDialogue(dialogue, prompt) {
  if (Array.isArray(dialogue) && dialogue.some(line => line?.isBlank)) {
    let firstPromptApplied = false;
    return dialogue.map((line, index) => {
      const isBlank = line.isBlank === true;
      const shouldApplyPrompt = !isBlank && !firstPromptApplied;
      if (shouldApplyPrompt) firstPromptApplied = true;
      return {
        name: line.name || (index % 2 ? 'Mia' : 'Leo'),
        icon: line.icon || (index % 2 ? 'M' : 'L'),
        text: isBlank ? '' : String(shouldApplyPrompt ? prompt || line.text || '' : line.text || ''),
        isBlank,
      };
    });
  }

  return [
    { name: 'Leo', icon: 'L', text: prompt || 'What do you see?', isBlank: false },
    { name: 'Mia', icon: 'M', text: '', isBlank: true },
  ];
}

function firstDialoguePrompt(question) {
  const line = (question.dialogue || []).find(item => !item?.isBlank && item?.text);
  return String(line?.text || question.audio_text || question.prompt || '');
}

function uniqueOptions(options) {
  const seen = new Set();
  const output = [];
  for (const item of options) {
    const key = String(item.text || item.label || item.image_key || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return repairOneCorrect(output).slice(0, 4);
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function fillTranslateOptions(options, correctText, index) {
  const fillers = [
    '\u8fd9\u662f\u4ec0\u4e48\uff1f',
    '\u8fd9\u4e9b\u662f\u4ec0\u4e48\uff1f',
    '\u5b83\u662f\u4e00\u4e2a\u7403\u3002',
    '\u5b83\u4eec\u662f\u4e66\u3002',
    '\u6211\u770b\u5230\u4e00\u4e2a\u76d2\u5b50\u3002',
  ].filter(text => text !== correctText);
  const output = [...options];
  let cursor = index;
  while (new Set(output.map(item => String(item.text || '').trim())).size < 3 && fillers.length) {
    output.push(option(fillers[cursor % fillers.length], false));
    cursor += 1;
  }
  return output;
}

function alternateWord(word) {
  const clean = normalizedWord(word);
  const pool = ['book', 'box', 'ball', 'markers', 'scissors', 'tongue', 'nose', 'hands', 'eyes', 'ears'];
  return pool.find(item => item !== clean) || 'book';
}

function option(text, isCorrect) {
  return { text, is_correct: isCorrect };
}

function getCorrectOptionText(question) {
  return String((question.options || []).find(option => option?.is_correct === true)?.text || '');
}

function pickWordFromQuestion(question, index = 0) {
  const optionWords = Array.isArray(question.options)
    ? question.options.flatMap(option => String(option?.text || '').toLowerCase().match(/[a-z]+/g) || [])
    : [];
  const candidates = [
    question.spell_word,
    question.blank_answer,
    question.word,
    question.target_word,
    optionWords.find(word => KNOWN_WORDS.includes(singular(word))),
    pickWordFromText(question.audio_text),
    pickWordFromText(question.source_text),
    pickWordFromText(question.explanation),
    KNOWN_WORDS[index % KNOWN_WORDS.length],
  ];
  return candidates.map(normalizedWord).find(Boolean) || 'book';
}

function pickWordFromText(value) {
  const words = String(value || '').toLowerCase().match(/[a-z]+/g) || [];
  return [...words].reverse().find(word => KNOWN_WORDS.includes(word) || KNOWN_WORDS.includes(singular(word))) || '';
}

function pickNounAfter(text, prefix) {
  const rest = String(text || '').replace(prefix, '').replace(/[?.!]/g, '').trim();
  return normalizedWord(rest.split(/\s+/)[0]);
}

function normalizedWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isQuestionSentence(value) {
  return /\?/.test(String(value || '')) || /^(how|can|do|is|what)\b/i.test(String(value || '').trim());
}

function isHowMuchMany(value) {
  return /^how (much|many)\b/i.test(String(value || '').trim());
}

function isBareWord(value) {
  return /^[a-z]+$/i.test(String(value || '').trim());
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''));
}

function ensureSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[?.!]$/.test(text) ? text : `${text}.`;
}

function buildLetterPool(answer, existing = []) {
  const required = answer.toUpperCase().split('');
  const extra = [...existing, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
    .map(letter => String(letter || '').toUpperCase())
    .filter(letter => /^[A-Z]$/.test(letter) && !required.includes(letter));
  return seededShuffle([...required, ...extra].slice(0, Math.max(8, required.length)), answer);
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

function spellOut(word) {
  return normalizedWord(word).toUpperCase().split('').join('-') + '.';
}

function articleZh(word) {
  return UNCOUNTABLES.has(singular(word)) || isPluralLike(word) ? '' : '??';
}

function isPlural(word) {
  const clean = normalizedWord(word);
  return isPluralLike(clean) || (clean.endsWith('s') && singular(clean) !== clean);
}

function alternateWeather(word) {
  return [...WEATHER_ADJECTIVES].find(item => item !== word) || 'rainy';
}

function alternateTaste(word) {
  return [...TASTE_ADJECTIVES].find(item => item !== word) || 'sweet';
}

function sentenceForWord(word) {
  const clean = normalizedWord(word);
  if (isPersonWord(clean)) return personSentence(clean);
  return sentenceForWordClass(clean);
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

export default {
  repairQuestions,
  validatePedagogicalQuality,
};
