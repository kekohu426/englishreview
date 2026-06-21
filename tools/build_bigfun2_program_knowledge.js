import fs from 'fs';
import path from 'path';

const mdDir = process.argv[2] || 'D:/zhishiku/00_Inbox/bigfun2_textbook_md';
const outPath = process.argv[3] || path.join(mdDir, 'bigfun2_program_knowledge.json');

const UNIT_STARTS = [
  { unit: 1, page: 8, title: 'My School' },
  { unit: 2, page: 22, title: 'My Senses' },
  { unit: 3, page: 34, title: 'My Family' },
  { unit: 4, page: 42, title: 'Toys' },
  { unit: 5, page: 54, title: 'Food' },
  { unit: 6, page: 68, title: 'Clothes' },
  { unit: 7, page: 82, title: 'Animals' },
  { unit: 8, page: 94, title: 'Places' },
];

const STOP_WORDS = new Set([
  'listen', 'say', 'find', 'match', 'look', 'trace', 'count', 'paste', 'cut', 'draw',
  'color', 'review', 'practice', 'presentation', 'language', 'vocabulary', 'math',
  'connection', 'numbers', 'unit', 'preview', 'page', 'pre', 'reading', 'writing',
  'phonics', 'words', 'word', 'this', 'that', 'these', 'those', 'what', 'where',
  'with', 'they', 'are', 'is', 'the', 'and', 'you', 'your', 'my', 'his', 'her',
  'she', 'he', 'it', 'its', 'have', 'has', 'like', 'likes', 'want', 'wants',
  'please', 'yes', 'no', 'not', 'can', 'see', 'need', 'going', 'go', 'time',
  'show', 'wrap', 'assessment', 'learning', 'critical', 'thinking', 'values',
  'dehkhodaedu', 'com', 'nit', 'findit', 'amazing',
]);

const FIX_WORDS = new Map(Object.entries({
  scrssors: 'scissors',
  sctssors: 'scissors',
  scisssors: 'scissors',
  'b ox': 'box',
  'un cle': 'uncle',
  campflre: 'campfire',
  ptano: 'piano',
  raingcoat: 'raincoat',
  b00ts: 'boots',
  mllk: 'milk',
  'm 00n': 'moon',
  hospltal: 'hospital',
  'sup errnar et': 'supermarket',
  liza: 'lizard',
}));

const pageFiles = fs.readdirSync(mdDir)
  .filter(name => /^page_\d+\.md$/i.test(name))
  .sort((a, b) => a.localeCompare(b));

const pageTexts = pageFiles.map(name => {
  const page = Number(name.match(/page_(\d+)/i)?.[1]);
  return { page, text: fs.readFileSync(path.join(mdDir, name), 'utf8') };
});

const coverage = emptyCoverageIndex();
const units = UNIT_STARTS.map((unit, index) => {
  const next = UNIT_STARTS[index + 1];
  const endPage = next ? next.page - 1 : 105;
  const pages = pageTexts.filter(item => item.page >= unit.page && item.page <= endPage);
  const text = pages.map(item => item.text).join('\n');
  const vocabulary = unique([
    ...extractLabeledWords(text, /Vocabulary Presentation[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledWords(text, /Vocabulary Practice[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledWords(text, /Vocabulary Review[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledWords(text, /Science Words[:.]\s*([^.;\n]+)/gi),
  ]).filter(isVocabularyWord);
  const patterns = unique([
    ...extractLanguagePatterns(text),
    ...extractLabeledPhrases(text, /Language Presentation[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Language Practice[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Language Review[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Review[:.]\s*([^.;\n]+)/gi),
  ]).slice(0, 24);
  const connections = unique([
    ...extractLabeledPhrases(text, /Math Connection[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Pre-reading[^:.]*[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Pre-writing[^:.]*[:.]\s*([^.;\n]+)/gi),
    ...extractLabeledPhrases(text, /Values[:.]\s*([^.;\n]+)/gi),
  ]).slice(0, 24);
  const phonicsWords = unique(extractLabeledWords(text, /Phonics Words[:.]\s*([^.;\n]+)/gi)).filter(isVocabularyWord);
  const sourcePages = `${unit.page}-${endPage}`;

  vocabulary.forEach(word => addCoverage(coverage, {
    coverage_id: `BF2-U${unit.unit}-WORD-${slug(word)}`,
    type: 'word',
    unit_id: unit.unit,
    unit: unit.unit,
    word,
    source_pages: sourcePages,
    source: 'bigfun2_textbook_ocr',
  }, pages.map(item => item.page), [word]));

  patterns.forEach((pattern, patternIndex) => addCoverage(coverage, {
    coverage_id: `BF2-U${unit.unit}-PATTERN-${patternIndex + 1}`,
    type: 'pattern',
    unit_id: unit.unit,
    unit: unit.unit,
    pattern,
    examples: instantiatePattern(pattern, vocabulary),
    source_pages: sourcePages,
    source: 'bigfun2_textbook_ocr',
  }, pages.map(item => item.page), extractWords(pattern)));

  connections.forEach((connection, connectionIndex) => addCoverage(coverage, {
    coverage_id: `BF2-U${unit.unit}-CONNECTION-${connectionIndex + 1}`,
    type: 'connection',
    unit_id: unit.unit,
    unit: unit.unit,
    text: connection,
    source_pages: sourcePages,
    source: 'bigfun2_textbook_ocr',
  }, pages.map(item => item.page), extractWords(connection)));

  phonicsWords.forEach(word => addCoverage(coverage, {
    coverage_id: `BF2-U${unit.unit}-PHONICS-${slug(word)}`,
    type: 'phonics_word',
    unit_id: unit.unit,
    unit: unit.unit,
    word,
    source_pages: sourcePages,
    source: 'bigfun2_textbook_ocr',
  }, pages.map(item => item.page), [word]));

  return {
    id: unit.unit,
    title: unit.title,
    pages: sourcePages,
    source: 'Big Fun Student Book 2 OCR',
    vocabulary,
    patterns: patterns.map(pattern => ({ pattern, examples: instantiatePattern(pattern, vocabulary) })),
    skills: connections,
    phonics_words: phonicsWords,
    raw_pages: pages.map(item => ({ page: item.page, text: cleanupText(item.text) })),
  };
});

const vocabulary = units.flatMap(unit => unit.vocabulary.map(word => ({
  coverage_id: `BF2-U${unit.id}-WORD-${slug(word)}`,
  word,
  unit: unit.id,
  unit_id: unit.id,
  source_pages: unit.pages,
})));

const data = {
  schema_version: 'opw2.program_knowledge.v1',
  material_id: 'bigfun2_textbook',
  title: 'Big Fun Student Book 2',
  source_pdf: 'C:/Users/ke\'ko/Desktop/new bigfun student book 2.pdf',
  extraction: {
    method: 'Windows.Media.Ocr from rendered PDF pages',
    source_md_dir: mdDir.replace(/\\/g, '/'),
    generated_at: new Date().toISOString(),
    notes: [
      'OCR text is noisy; use source_pages/source_refs for traceability.',
      'OPW2 markdown folder is Oxford phonics material and should be used as phonics scope, not textbook scope.',
    ],
  },
  units,
  reviews: [],
  vocabulary,
  vocabularyByUnit: Object.fromEntries(units.map(unit => [unit.id, unit.vocabulary])),
  sightWordsByUnit: {},
  storiesByUnit: {},
  chantsByUnit: Object.fromEntries(units.map(unit => [unit.id, unit.patterns.flatMap(pattern => pattern.examples || []).filter(Boolean)])),
  coverage_index: coverage,
  prompt_slices: {
    compact: units.map(unit => [
      `Unit ${unit.id} ${unit.title} pages ${unit.pages}`,
      `Words: ${unit.vocabulary.join(', ')}`,
      `Patterns: ${unit.patterns.map(item => item.pattern).join(' | ')}`,
      `Skills: ${unit.skills.join(' | ')}`,
      `Phonics words in textbook pages: ${unit.phonics_words.join(', ')}`,
    ].join('\n')).join('\n\n'),
  },
};

fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`Units: ${units.length}; words: ${vocabulary.length}; coverage: ${Object.keys(coverage.by_id).length}`);

function extractLabeledWords(text, regex) {
  return extractLabeledPhrases(text, regex).flatMap(value =>
    truncateAtNextLabel(value)
      .replace(/\([^)]*\)/g, '')
      .split(/[,;，、/]+|\band\b/gi)
      .map(cleanWord)
      .filter(Boolean)
  );
}

function extractLabeledPhrases(text, regex) {
  const values = [];
  for (const match of text.matchAll(regex)) {
    const value = truncateAtNextLabel(cleanupText(match[1])).replace(/\s+/g, ' ').trim();
    if (isUsefulPhrase(value)) values.push(value);
  }
  return values;
}

function extractLanguagePatterns(text) {
  const normalized = cleanupText(text);
  const patterns = [];
  const candidates = [
    /What\s+(?:is|are)\s+[^?]{0,40}\?/gi,
    /Where\s+(?:is|are)\s+[^?]{0,40}\?/gi,
    /What\s+do\s+you\s+[^?]{0,40}\?/gi,
    /Do\s+you\s+like\s+[^?]{0,40}\?/gi,
    /How\s+many\s+[^?]{0,40}\?/gi,
    /(?:It|They|He|She|This|These|Those)\s+(?:is|are|has|needs|likes|is wearing)[^.?!]{0,50}/gi,
    /I\s+(?:like|have|see|smell|taste|hear|touch|want)[^.?!]{0,50}/gi,
  ];
  candidates.forEach(regex => {
    for (const match of normalized.matchAll(regex)) {
      patterns.push(cleanupText(match[0]).replace(/\s+/g, ' ').trim());
    }
  });
  return patterns.filter(value => value.length >= 8 && value.length <= 90 && isUsefulPhrase(value));
}

function isUsefulPhrase(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/# Page|[<>丿仃]|GO TO|SHOW|Assessment|FIND IT/i.test(text)) return false;
  return /[a-z]/i.test(text);
}

function instantiatePattern(pattern, words) {
  const first = words[0] || 'ball';
  const second = words[1] || first;
  return unique([
    pattern,
    pattern.replace(/\([^)]*\)/g, first).replace(/\s+/g, ' '),
    pattern.replace(/\.\.\./g, second),
  ]).slice(0, 3);
}

function addCoverage(index, item, pages = [], words = []) {
  index.by_id[item.coverage_id] = item;
  const unit = item.unit_id || item.unit;
  if (unit) {
    index.by_unit[unit] = unique([...(index.by_unit[unit] || []), item.coverage_id]);
  }
  pages.forEach(page => {
    if (!Number.isFinite(Number(page))) return;
    index.by_page[page] = unique([...(index.by_page[page] || []), item.coverage_id]);
  });
  words.map(cleanWord).filter(Boolean).forEach(word => {
    index.by_word[word] = unique([...(index.by_word[word] || []), item.coverage_id]);
  });
}

function emptyCoverageIndex() {
  return { by_id: {}, by_unit: {}, by_page: {}, by_word: {}, by_type: {} };
}

function isVocabularyWord(word) {
  const clean = String(word || '').toLowerCase().trim();
  if (!/^[a-z][a-z -]{1,30}$/i.test(clean)) return false;
  if (STOP_WORDS.has(clean)) return false;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.some(part => STOP_WORDS.has(part))) return false;
  if (parts.length > 3) return false;
  return true;
}

function cleanWord(value) {
  const clean = String(value || '')
    .toLowerCase()
    .replace(/language\s+(presentation|practice|review).*$/i, '')
    .replace(/vocabulary\s+(presentation|practice|review).*$/i, '')
    .replace(/math\s+connection.*$/i, '')
    .replace(/pre-?reading.*$/i, '')
    .replace(/review.*$/i, '')
    .replace(/\blt\b/g, 'it')
    .replace(/\bd0\b/g, 'do')
    .replace(/\bth\s*is\b/g, 'this')
    .replace(/[^\sa-z-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return FIX_WORDS.get(clean) || clean;
}

function extractWords(value) {
  return (String(value || '').toLowerCase().match(/\b[a-z][a-z-]{1,20}\b/g) || [])
    .map(cleanWord)
    .filter(isVocabularyWord);
}

function cleanupText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/l00/gi, 'look')
    .replace(/\blt\b/g, 'It')
    .replace(/\bd0\b/gi, 'do')
    .replace(/\ba re\b/gi, 'are')
    .replace(/\bta ste\b/gi, 'taste')
    .replace(/\bm ilk\b/gi, 'milk')
    .replace(/\bsna il\b/gi, 'snail')
    .replace(/\btra il\b/gi, 'trail')
    .replace(/\bscrssors\b/gi, 'scissors')
    .replace(/\bsctssors\b/gi, 'scissors')
    .replace(/\bb ox\b/gi, 'box')
    .replace(/\bun cle\b/gi, 'uncle')
    .replace(/\bcampflre\b/gi, 'campfire')
    .replace(/\bptano\b/gi, 'piano')
    .replace(/\bb00ts\b/gi, 'boots')
    .replace(/\bmllk\b/gi, 'milk')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtNextLabel(value) {
  return String(value || '')
    .replace(/\s+(Language|Vocabulary|Math|Pre-reading|Pre-writing|Review|FIND IT|Critical Thinking|Values)[:.].*$/i, '')
    .replace(/\s+# Page \d+.*$/i, '')
    .trim();
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}
