export type QuestionType =
  | "listen_pick_image"
  | "listen_pick_word"
  | "listen_judge"
  | "mixed_challenge"
  | "read_aloud"
  | "word_order"
  | "fill_blank"
  | "match_word_image"
  | "spell_word"
  | "translate_pick"
  | "dialogue_complete";

export interface Option {
  text: string;
  label?: string;
  translation?: string;
  image_key?: string;
  is_correct: boolean;
}

export interface DialogueLine {
  name: string;
  icon: string;
  text: string;
  isBlank?: boolean;
}

export interface LessonItem {
  id: string;
  type: QuestionType;
  prompt?: string;
  explanation?: string;
  knowledge_tip?: string;
  audio_text?: string;
  options?: Option[];
  text?: string;
  translation?: string;
  focus?: string;
  pronunciation_target?: string;
  pronunciation_focus?: string[];
  scene_key?: string;
  role_name?: string;
  role_icon?: string;
  sentence?: string;
  words?: string[];
  sentence_parts?: string[];
  blank_answer?: string;
  word?: string;
  word_translation?: string;
  spell_word?: string;
  letter_pool?: string[];
  source_text?: string;
  source_lang?: "zh" | "en";
  dialogue?: DialogueLine[];
  source_refs?: string[];
  knowledge_tags?: string[];
  requirement_ids?: string[];
  target_word?: string;
  target_sentence?: string;
}

export interface Module {
  module_id: string;
  icon: string;
  title: string;
  goal: string;
  estimated_minutes: number;
  color: string;
  items: LessonItem[];
  status?: "pending" | "planning" | "generating" | "ready" | "error";
  fallback?: boolean;
}

export interface VocabWord {
  word: string;
  translation: string;
  image: string;
  category: string;
}

export const VOCABULARY: VocabWord[] = [
  { word: "book", translation: "book", image: "📖", category: "school" },
  { word: "books", translation: "books", image: "📚", category: "school" },
  { word: "ball", translation: "ball", image: "⚽", category: "school" },
  { word: "box", translation: "box", image: "📦", category: "school" },
  { word: "scissors", translation: "scissors", image: "✂️", category: "school" },
  { word: "markers", translation: "markers", image: "🖍️", category: "school" },
  { word: "bag", translation: "bag", image: "🎒", category: "school" },
  { word: "pencil", translation: "pencil", image: "✏️", category: "school" },
  { word: "ruler", translation: "ruler", image: "📏", category: "school" },
  { word: "desk", translation: "desk", image: "🪑", category: "school" },
  { word: "chair", translation: "chair", image: "🪑", category: "school" },
  { word: "red", translation: "red", image: "🔴", category: "color" },
  { word: "blue", translation: "blue", image: "🔵", category: "color" },
  { word: "yellow", translation: "yellow", image: "🟡", category: "color" },
  { word: "green", translation: "green", image: "🟢", category: "color" },
  { word: "apple", translation: "apple", image: "🍎", category: "fruit" },
  { word: "banana", translation: "banana", image: "🍌", category: "fruit" },
  { word: "orange", translation: "orange", image: "🍊", category: "fruit" },
  { word: "pear", translation: "pear", image: "🍐", category: "fruit" },
  { word: "cat", translation: "cat", image: "🐱", category: "animal" },
  { word: "dog", translation: "dog", image: "🐶", category: "animal" },
  { word: "fish", translation: "fish", image: "🐟", category: "animal" },
  { word: "bird", translation: "bird", image: "🐦", category: "animal" },
  { word: "hen", translation: "hen", image: "🐔", category: "animal" },
  { word: "pen", translation: "pen", image: "🖊️", category: "school" },
  { word: "bed", translation: "bed", image: "🛏️", category: "home" },
  { word: "tongue", translation: "tongue", image: "👅", category: "senses" },
  { word: "nose", translation: "nose", image: "👃", category: "senses" },
  { word: "ear", translation: "ear", image: "👂", category: "senses" },
  { word: "ears", translation: "ears", image: "👂", category: "senses" },
  { word: "hands", translation: "hands", image: "👐", category: "senses" },
  { word: "eyes", translation: "eyes", image: "👀", category: "senses" },
  { word: "campfire", translation: "campfire", image: "🔥", category: "senses" },
  { word: "flower", translation: "flower", image: "🌸", category: "senses" },
  { word: "soup", translation: "soup", image: "🥣", category: "senses" },
  { word: "piano", translation: "piano", image: "🎹", category: "senses" },
  { word: "grandfather", translation: "grandfather", image: "👴", category: "family" },
  { word: "grandmother", translation: "grandmother", image: "👵", category: "family" },
  { word: "father", translation: "father", image: "👨", category: "family" },
  { word: "mother", translation: "mother", image: "👩", category: "family" },
  { word: "aunt", translation: "aunt", image: "👩", category: "family" },
  { word: "uncle", translation: "uncle", image: "👨", category: "family" },
  { word: "cousin", translation: "cousin", image: "🧒", category: "family" },
  { word: "child", translation: "child", image: "🧒", category: "family" },
  { word: "boy", translation: "boy", image: "👦", category: "family" },
  { word: "girl", translation: "girl", image: "👧", category: "family" },
  { word: "house", translation: "house", image: "🏠", category: "home" },
  { word: "apartment", translation: "apartment", image: "🏢", category: "home" },
  { word: "pet", translation: "pet", image: "🐾", category: "home" },
  { word: "pets", translation: "pets", image: "🐾", category: "home" },
  { word: "swing", translation: "swing", image: "🛝", category: "playground" },
  { word: "tricycle", translation: "tricycle", image: "🚲", category: "playground" },
  { word: "slide", translation: "slide", image: "🛝", category: "playground" },
  { word: "cloud", translation: "cloud", image: "☁️", category: "weather" },
  { word: "clouds", translation: "clouds", image: "☁️", category: "weather" },
  { word: "rain", translation: "rain", image: "🌧️", category: "weather" },
  { word: "lightning", translation: "lightning", image: "⚡", category: "weather" },
  { word: "thunder", translation: "thunder", image: "🌩️", category: "weather" },
  { word: "meat", translation: "meat", image: "🥩", category: "food" },
  { word: "chicken", translation: "chicken", image: "🍗", category: "food" },
  { word: "corn", translation: "corn", image: "🌽", category: "food" },
  { word: "potato", translation: "potato", image: "🥔", category: "food" },
  { word: "potatoes", translation: "potatoes", image: "🥔", category: "food" },
  { word: "salad", translation: "salad", image: "🥗", category: "food" },
  { word: "milk", translation: "milk", image: "🥛", category: "food" },
  { word: "lemonade", translation: "lemonade", image: "🍋", category: "food" },
  { word: "juice", translation: "juice", image: "🧃", category: "food" },
  { word: "food", translation: "food", image: "🍽️", category: "food" },
  { word: "fruit", translation: "fruit", image: "🍎", category: "food" },
  { word: "seeds", translation: "seeds", image: "🌱", category: "food" },
  { word: "seed", translation: "seed", image: "🌱", category: "food" },
  { word: "sunny", translation: "sunny", image: "☀️", category: "weather" },
  { word: "rainy", translation: "rainy", image: "🌧️", category: "weather" },
  { word: "windy", translation: "windy", image: "💨", category: "weather" },
  { word: "raincoat", translation: "raincoat", image: "🧥", category: "clothes" },
  { word: "hat", translation: "hat", image: "🧢", category: "clothes" },
  { word: "umbrella", translation: "umbrella", image: "☂️", category: "clothes" },
  { word: "boots", translation: "boots", image: "🥾", category: "clothes" },
  { word: "t-shirt", translation: "t-shirt", image: "👕", category: "clothes" },
  { word: "sweater", translation: "sweater", image: "🧥", category: "clothes" },
  { word: "pants", translation: "pants", image: "👖", category: "clothes" },
  { word: "bathing suit", translation: "bathing suit", image: "🩱", category: "clothes" },
  { word: "tractor", translation: "tractor", image: "🚜", category: "farm" },
  { word: "barn", translation: "barn", image: "🏚️", category: "farm" },
  { word: "lamb", translation: "lamb", image: "🐑", category: "farm" },
  { word: "horse", translation: "horse", image: "🐴", category: "farm" },
  { word: "dogs", translation: "dogs", image: "🐶", category: "farm" },
  { word: "ducks", translation: "ducks", image: "🦆", category: "farm" },
  { word: "egg", translation: "egg", image: "🥚", category: "farm" },
  { word: "eggs", translation: "eggs", image: "🥚", category: "farm" },
  { word: "chick", translation: "chick", image: "🐥", category: "farm" },
  { word: "police car", translation: "police car", image: "🚓", category: "town" },
  { word: "fire truck", translation: "fire truck", image: "🚒", category: "town" },
  { word: "ambulance", translation: "ambulance", image: "🚑", category: "town" },
  { word: "truck", translation: "truck", image: "🚚", category: "town" },
  { word: "toy store", translation: "toy store", image: "🧸", category: "town" },
];

export const VOCAB_MAP: Record<string, VocabWord> = Object.fromEntries(
  VOCABULARY.map((w) => [w.word, w])
);

export { PHONICS_WORDS, getPhonicsWordsByLevel, getPhonicsWordsByFamily, generateLetterPool, samplePhonicsWords, buildSpellWordItem, LEVEL_LABELS, FAMILY_LABELS } from "./phonics";

export const SCENE_BG: Record<string, string> = {
  school: "#d7e8ff",
  fruit: "#ffecd7",
  animal: "#dff5e3",
  color: "#f0e6ff",
  action: "#fff3d7",
  senses: "#e2f7f1",
  home: "#f5ecd7",
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildLetterPool(word: string): string[] {
  const answer = word.toUpperCase().split("");
  const extras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((letter) => !answer.includes(letter)).slice(0, 4);
  return shuffle([...answer, ...extras]);
}

function optionSet(correct: string, wrong: string[]): Option[] {
  return shuffle([
    { text: correct, is_correct: true },
    ...wrong.map((text) => ({ text, is_correct: false })),
  ]);
}

function vocabOptions(word: VocabWord, pool = VOCABULARY): Option[] {
  const wrong = pool.filter((item) => item.word !== word.word).slice(0, 3);
  return shuffle([
    { text: word.translation, label: word.word, image_key: word.image, is_correct: true },
    ...wrong.map((item) => ({ text: item.translation, label: item.word, image_key: item.image, is_correct: false })),
  ]);
}

const SAMPLE_WORDS = VOCABULARY.slice(0, 6);
const SENTENCES = [
  "I have a book.",
  "I see a cat.",
  "Can you sing?",
  "Do you like apples?",
  "What do you have?",
];

export const MODULES: Module[] = [
  {
    module_id: "m1",
    icon: "Audio",
    title: "Listen Pick Image",
    goal: "Listen and choose the matching picture.",
    estimated_minutes: 8,
    color: "#4f7cff",
    items: SAMPLE_WORDS.map((word) => ({
      id: `lpi_${word.word}`,
      type: "listen_pick_image",
      audio_text: word.word,
      prompt: "Listen and choose the picture.",
      options: vocabOptions(word),
      explanation: `${word.word} means ${word.translation}.`,
    })),
  },
  {
    module_id: "m2",
    icon: "Image",
    title: "Match Word Image",
    goal: "Read the word and choose the matching picture.",
    estimated_minutes: 6,
    color: "#1f9d67",
    items: SAMPLE_WORDS.map((word) => ({
      id: `mwi_${word.word}`,
      type: "match_word_image",
      word: word.word,
      word_translation: word.translation,
      prompt: "Read the word and choose the picture.",
      options: vocabOptions(word),
      explanation: `${word.word} means ${word.translation}.`,
    })),
  },
  {
    module_id: "m3",
    icon: "Spell",
    title: "Spell Word",
    goal: "Listen and spell the target word.",
    estimated_minutes: 8,
    color: "#9b59b6",
    items: ["cat", "dog", "bag", "red", "book"].map((word) => ({
      id: `sw_${word}`,
      type: "spell_word",
      audio_text: word,
      spell_word: word,
      word_translation: VOCAB_MAP[word]?.translation || word,
      prompt: "Listen and spell the word.",
      letter_pool: buildLetterPool(word),
    })),
  },
  {
    module_id: "m4",
    icon: "Speak",
    title: "Read Aloud",
    goal: "Read the sentence aloud.",
    estimated_minutes: 5,
    color: "#ff8a4c",
    items: SENTENCES.map((sentence, index) => ({
      id: `ra_${index + 1}`,
      type: "read_aloud",
      text: sentence,
      prompt: "Read aloud.",
      translation: sentence,
      pronunciation_target: sentence,
      pronunciation_focus: sentence.split(" ").slice(0, 3),
    })),
  },
  {
    module_id: "m5",
    icon: "Word",
    title: "Listen Pick Word",
    goal: "Listen and choose the word you hear.",
    estimated_minutes: 6,
    color: "#16a6d9",
    items: SAMPLE_WORDS.map((word) => ({
      id: `lpw_${word.word}`,
      type: "listen_pick_word",
      audio_text: word.word,
      prompt: "Listen and choose the word.",
      options: optionSet(word.word, VOCABULARY.filter((item) => item.word !== word.word).slice(0, 3).map((item) => item.word)),
      explanation: `The word is ${word.word}.`,
    })),
  },
  {
    module_id: "m6",
    icon: "Judge",
    title: "Listen Judge",
    goal: "Decide whether the sentence is correct.",
    estimated_minutes: 6,
    color: "#ef6f6c",
    items: [
      { id: "lj_1", type: "listen_judge", audio_text: "I see a cat.", prompt: "Is the sentence correct?", options: optionSet("Correct", ["Not correct"]), explanation: "The sentence is correct." },
      { id: "lj_2", type: "listen_judge", audio_text: "I have a dog.", prompt: "Is the sentence correct?", options: optionSet("Correct", ["Not correct"]), explanation: "The sentence is correct." },
      { id: "lj_3", type: "listen_judge", audio_text: "I touch with hands.", prompt: "Is the sentence correct?", options: optionSet("Correct", ["Not correct"]), explanation: "We touch with hands." },
      { id: "lj_4", type: "listen_judge", audio_text: "I smell with nose.", prompt: "Is the sentence correct?", options: optionSet("Correct", ["Not correct"]), explanation: "We smell with nose." },
      { id: "lj_5", type: "listen_judge", audio_text: "I hear with ears.", prompt: "Is the sentence correct?", options: optionSet("Correct", ["Not correct"]), explanation: "We hear with ears." },
    ],
  },
  {
    module_id: "m7",
    icon: "Blank",
    title: "Fill Blank",
    goal: "Choose the missing word.",
    estimated_minutes: 6,
    color: "#f28a3c",
    items: [
      { id: "fb_1", type: "fill_blank", sentence_parts: ["Do you ", " cats?"], blank_answer: "like", options: optionSet("like", ["have", "see", "want"]), translation: "Do you like cats?" },
      { id: "fb_2", type: "fill_blank", sentence_parts: ["I ", " a book."], blank_answer: "have", options: optionSet("have", ["see", "like", "want"]), translation: "I have a book." },
      { id: "fb_3", type: "fill_blank", sentence_parts: ["Is this your ", "?"], blank_answer: "pencil", options: optionSet("pencil", ["apple", "cat", "blue"]), translation: "Is this your pencil?" },
      { id: "fb_4", type: "fill_blank", sentence_parts: ["Yes, I ", "."], blank_answer: "can", options: optionSet("can", ["do", "is", "have"]), translation: "Yes, I can." },
      { id: "fb_5", type: "fill_blank", sentence_parts: ["I see a ", "."], blank_answer: "bird", options: optionSet("bird", ["banana", "red", "desk"]), translation: "I see a bird." },
    ],
  },
  {
    module_id: "m8",
    icon: "Order",
    title: "Word Order",
    goal: "Put words in the correct order.",
    estimated_minutes: 7,
    color: "#7a6df0",
    items: SENTENCES.map((sentence, index) => ({
      id: `wo_${index + 1}`,
      type: "word_order",
      sentence,
      words: shuffle(sentence.replace(/[.?]/g, "").split(" ")),
      translation: sentence,
      explanation: `Correct sentence: ${sentence}`,
    })),
  },
  {
    module_id: "m9",
    icon: "Translate",
    title: "Translate Pick",
    goal: "Choose the matching translation.",
    estimated_minutes: 6,
    color: "#2ca6a4",
    items: [
      { id: "tr_1", type: "translate_pick", source_text: "I have a book.", source_lang: "en", options: optionSet("I have a book.", ["I see a book.", "I want a book."]), explanation: "have means to own." },
      { id: "tr_2", type: "translate_pick", source_text: "Can you swim?", source_lang: "en", options: optionSet("Can you swim?", ["Do you swim?", "Is this swim?"]), explanation: "Can you asks about ability." },
      { id: "tr_3", type: "translate_pick", source_text: "I like bananas.", source_lang: "en", options: optionSet("I like bananas.", ["I want bananas.", "I have bananas."]), explanation: "like means enjoy." },
      { id: "tr_4", type: "translate_pick", source_text: "Is this your pencil?", source_lang: "en", options: optionSet("Is this your pencil?", ["This is my pencil.", "Do you have a pencil?"]), explanation: "Is this your asks about ownership." },
      { id: "tr_5", type: "translate_pick", source_text: "I see a cat.", source_lang: "en", options: optionSet("I see a cat.", ["I like a cat.", "I want a cat."]), explanation: "see means look and notice." },
    ],
  },
  {
    module_id: "m10",
    icon: "Dialog",
    title: "Dialogue Complete",
    goal: "Choose the best answer to complete the dialogue.",
    estimated_minutes: 7,
    color: "#e04b4b",
    items: [
      { id: "dc_1", type: "dialogue_complete", dialogue: [{ name: "Leo", icon: "Leo", text: "Is this your book?" }, { name: "Mia", icon: "Mia", text: "???", isBlank: true }], options: optionSet("Yes, it is.", ["Yes, I can.", "Yes, I do."]), explanation: "Answer Is this your ...? with Yes, it is." },
      { id: "dc_2", type: "dialogue_complete", dialogue: [{ name: "Mia", icon: "Mia", text: "Can you sing?" }, { name: "Leo", icon: "Leo", text: "???", isBlank: true }], options: optionSet("No, I can't.", ["No, it isn't.", "No, I don't."]), explanation: "Answer Can you ...? with Yes, I can or No, I can't." },
      { id: "dc_3", type: "dialogue_complete", dialogue: [{ name: "Leo", icon: "Leo", text: "Do you like apples?" }, { name: "Mia", icon: "Mia", text: "???", isBlank: true }], options: optionSet("Yes, I do.", ["Yes, it is.", "Yes, I can."]), explanation: "Answer Do you ...? with Yes, I do." },
      { id: "dc_4", type: "dialogue_complete", dialogue: [{ name: "Mia", icon: "Mia", text: "What do you have?" }, { name: "Leo", icon: "Leo", text: "???", isBlank: true }], options: optionSet("I have a pencil.", ["Yes, I do.", "I like pencils."]), explanation: "Answer What do you have? with I have ..." },
      { id: "dc_5", type: "dialogue_complete", dialogue: [{ name: "Leo", icon: "Leo", text: "What do you want?" }, { name: "Mia", icon: "Mia", text: "???", isBlank: true }], options: optionSet("I want an orange.", ["I see an orange.", "Yes, I do."]), explanation: "Answer What do you want? with I want ..." },
    ],
  },
  {
    module_id: "m11",
    icon: "Mix",
    title: "Mixed Challenge",
    goal: "Review words, sentences, and grammar together.",
    estimated_minutes: 8,
    color: "#3549a6",
    items: [
      { id: "mc_1", type: "mixed_challenge", prompt: "Choose the school word.", audio_text: "book", options: optionSet("book", ["apple", "cat", "red"]), explanation: "book is a school word." },
      { id: "mc_2", type: "mixed_challenge", prompt: "Choose the color word.", audio_text: "blue", options: optionSet("blue", ["bag", "dog", "pen"]), explanation: "blue is a color." },
      { id: "mc_3", type: "mixed_challenge", prompt: "Choose the animal word.", audio_text: "fish", options: optionSet("fish", ["desk", "pear", "green"]), explanation: "fish is an animal." },
      { id: "mc_4", type: "mixed_challenge", prompt: "Choose the sentence about ability.", options: optionSet("Can you sing?", ["I see a cat.", "I have a book.", "Do you like apples?"]), explanation: "Can you asks about ability." },
      { id: "mc_5", type: "mixed_challenge", prompt: "Choose the sentence about senses.", options: optionSet("I touch with hands.", ["I have a book.", "Do you like apples?", "What do you want?"]), explanation: "touch with hands is a senses sentence." },
    ],
  },
];

export const VOCAB_MAP_ALIAS = VOCAB_MAP;
