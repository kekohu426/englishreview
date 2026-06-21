import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv({ path: path.join(__dirname, '../.env') });

const DEFAULT_SOURCE_DIR = path.dirname(process.env.OPW2_KB_PATH || 'D:/zhishiku/00_Inbox/bigfun2_textbook_md/bigfun2_program_knowledge.json');
const DEFAULT_IMAGES_DIR = path.join(DEFAULT_SOURCE_DIR, '_page_images');
const DEFAULT_CACHE_DIR = path.join(DEFAULT_SOURCE_DIR, '_vision_cache');
const DEFAULT_OUTPUT_PATH = process.env.OPW2_KB_PATH || path.join(DEFAULT_SOURCE_DIR, 'bigfun2_program_knowledge.json');

const UNIT_RANGES = [
  { id: 1, title: 'My School', pages: [8, 21] },
  { id: 2, title: 'My Senses', pages: [22, 33] },
  { id: 3, title: 'My Family', pages: [34, 43] },
  { id: 4, title: 'Toys', pages: [44, 53] },
  { id: 5, title: 'Food', pages: [54, 67] },
  { id: 6, title: 'Clothes', pages: [68, 81] },
  { id: 7, title: 'Animals', pages: [82, 93] },
  { id: 8, title: 'Places', pages: [94, 105] },
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'big', 'book', 'can', 'do', 'does', 'for', 'from',
  'go', 'going', 'have', 'he', 'her', 'his', 'i', 'in', 'is', 'it', 'its', 'like', 'little',
  'listen', 'look', 'my', 'new', 'no', 'not', 'of', 'oh', 'on', 'one', 'open', 'please',
  'predict', 'review', 'say', 'school', 'see', 'she', 'small', 'student', 'the', 'there',
  'these', 'they', 'this', 'to', 'unit', 'use', 'want', 'we',
  'find', 'what', 'where', 'who', 'with', 'you', 'your',
]);

const PAGE_TYPE_ORDER = [
  'vocabulary_presentation',
  'language_presentation',
  'language_practice',
  'story',
  'song_or_chant',
  'phonics',
  'review',
  'values',
  'project',
  'sticker',
  'unknown',
];

const args = parseArgs(process.argv.slice(2));
const sourceDir = normalizePath(args.sourceDir || DEFAULT_SOURCE_DIR);
const imagesDir = normalizePath(args.imagesDir || DEFAULT_IMAGES_DIR);
const cacheDir = normalizePath(args.cacheDir || DEFAULT_CACHE_DIR);
const outputPath = normalizePath(args.output || DEFAULT_OUTPUT_PATH);
const applyOutput = Boolean(args.apply);
const dryRun = Boolean(args.dryRun);
const force = Boolean(args.force);
const maxPages = Number(args.maxPages || args.limit || 0);
const onlyPages = parsePageSelection(args.pages || '');
const startPage = Number(args.start || 0);
const endPage = Number(args.end || 0);
const requestDelayMs = Number(args.delayMs || process.env.LLM_MIN_REQUEST_INTERVAL_MS || 15000);
const maxAttempts = Number(args.maxAttempts || process.env.VISION_MAX_ATTEMPTS || 3);

main().catch(error => {
  console.error(`Vision knowledge build failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});

async function main() {
  ensureDir(cacheDir);
  const pageImages = listPageImages(imagesDir)
    .filter(page => shouldIncludePage(page.page))
    .slice(0, maxPages > 0 ? maxPages : undefined);

  if (!pageImages.length) {
    throw new Error(`No page images found in ${imagesDir}`);
  }

  console.log(`Vision source images: ${imagesDir}`);
  console.log(`Vision cache: ${cacheDir}`);
  console.log(`Pages selected: ${pageImages.map(page => page.page).join(', ')}`);
  console.log(`Mode: ${dryRun ? 'dry-run cache assembly only' : 'AI vision extraction + assembly'}`);

  const extractedPages = [];
  for (const [index, pageImage] of pageImages.entries()) {
    const cached = readCachedPage(pageImage.page);
    if (cached && !force) {
      extractedPages.push(cached);
      console.log(`[${index + 1}/${pageImages.length}] page ${pageImage.page}: cache`);
      continue;
    }

    if (dryRun) {
      console.warn(`[${index + 1}/${pageImages.length}] page ${pageImage.page}: missing cache in dry-run`);
      continue;
    }

    const extracted = await extractPageWithVision(pageImage);
    writeCachedPage(pageImage.page, extracted);
    extractedPages.push(extracted);
    console.log(`[${index + 1}/${pageImages.length}] page ${pageImage.page}: AI ok (${extracted.page_type}, unit ${extracted.unit_id || 'n/a'})`);

    if (index < pageImages.length - 1 && requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }
  }

  if (!extractedPages.length) {
    throw new Error('No extracted page records available; run without --dry-run or check cache.');
  }

  const knowledge = buildProgramKnowledge(extractedPages);
  validateProgramKnowledge(knowledge);

  const draftPath = outputPath.replace(/\.json$/i, '.vision-draft.json');
  fs.writeFileSync(draftPath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
  fs.writeFileSync(draftPath.replace(/\.json$/i, '.summary.md'), renderSummaryMarkdown(knowledge), 'utf8');
  console.log(`Vision draft written: ${draftPath}`);

  if (applyOutput) {
    if (fs.existsSync(outputPath)) {
      const backupPath = outputPath.replace(/\.json$/i, `.before-vision-${timestamp()}.json`);
      fs.copyFileSync(outputPath, backupPath);
      console.log(`Backup written: ${backupPath}`);
    }
    fs.writeFileSync(outputPath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
    console.log(`Applied vision knowledge: ${outputPath}`);
  } else {
    console.log('Draft only. Re-run with --apply to replace the active knowledge JSON after review.');
  }

  console.log(`Units: ${knowledge.units.length}`);
  console.log(`Vocabulary: ${knowledge.vocabulary.length}`);
  console.log(`Patterns: ${Object.keys(knowledge.coverage_index.by_pattern).length}`);
  console.log(`Pages indexed: ${Object.keys(knowledge.coverage_index.by_page).length}`);
}

async function extractPageWithVision(pageImage) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is required for AI vision extraction.');

  const model = process.env.VISION_MODEL || process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const timeoutMs = Number(process.env.VISION_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || 300000);
  const url = joinApiUrl(baseUrl, 'chat/completions');
  const ocrText = readPageMarkdown(pageImage.page);
  const imageBase64 = fs.readFileSync(pageImage.path).toString('base64');

  const payload = {
    model,
    temperature: 0,
    max_tokens: Number(process.env.VISION_MAX_TOKENS || 2200),
    messages: [
      {
        role: 'system',
        content: [
          'You extract a children English textbook page into strict JSON.',
          'Use the image as primary evidence. OCR text is only auxiliary and may be noisy.',
          'Pay special attention to vocabulary boxes/corners/footers and labeled target language.',
          'Do not invent content that is not visible on the page.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildVisionPrompt(pageImage.page, ocrText),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchWithRetries(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }, pageImage.page);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Vision API error ${response.status}: ${text.slice(0, 300)}`);
    }
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(cleanJson(content));
    return normalizePageExtraction(parsed, pageImage.page, pageImage.path, ocrText);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`Vision API timeout after ${timeoutMs}ms on page ${pageImage.page}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetries(url, options, page) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      const text = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`Vision API error ${response.status}: ${text.slice(0, 300)}`);
      if (!retryable || attempt === maxAttempts) throw lastError;

      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(90000, 5000 * attempt);
      console.warn(`page ${page}: vision API ${response.status}; retrying in ${Math.ceil(delay / 1000)}s (${attempt}/${maxAttempts})`);
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' || attempt === maxAttempts) throw error;
      const delay = Math.min(90000, 5000 * attempt);
      console.warn(`page ${page}: ${error.message}; retrying in ${Math.ceil(delay / 1000)}s (${attempt}/${maxAttempts})`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function buildVisionPrompt(page, ocrText) {
  const route = routeUnitByPage(page);
  return [
    `Textbook: Big Fun Student Book 2. Physical/image page number: ${page}.`,
    route ? `Expected unit by page range: Unit ${route.id} ${route.title}.` : 'This page may be cover, review, sticker, index, or non-unit content.',
    '',
    'Return ONLY valid JSON with this exact shape:',
    JSON.stringify({
      page,
      unit_id: route?.id || null,
      unit_title: route?.title || '',
      visible_page_number: null,
      page_type: 'vocabulary_presentation|language_presentation|language_practice|story|song_or_chant|phonics|review|values|project|sticker|unknown',
      vocabulary_box: ['target words from corner/footer/explicit vocabulary box only'],
      other_target_words: ['other clearly taught vocabulary words on this page'],
      language_patterns: [
        { pattern: 'What do you see?', examples: ['What do you see?', 'I see clouds.'] },
      ],
      grammar_points: ['short grammar labels only'],
      story_sentences: ['complete story sentences visible on the page'],
      song_or_chant: ['complete chant/song lines visible on the page'],
      phonics_words: ['phonics words visible on the page'],
      activities: [{ label: 'Listen and say', instructions: 'short visible instruction' }],
      source_refs: [`textbook:p${page}`],
      confidence: 0.0,
      notes: ['brief uncertainty notes'],
    }, null, 2),
    '',
    'Rules:',
    '- vocabulary_box must be only the explicit target vocabulary list/box/corner/footer for this page.',
    '- Do not put teacher instructions, page numbers, track numbers, unit titles, activity verbs, or random OCR words into vocabulary_box/other_target_words.',
    '- Words like look, listen, find, predict, review, unit, school are instructions/context, not target vocabulary.',
    '- Keep sentence patterns as reusable patterns or exact target sentences, not noisy fragments.',
    '- If OCR and image disagree, trust the image.',
    '- If a field is not visible, use an empty array.',
    '',
    'Auxiliary OCR text, may be noisy:',
    ocrText.slice(0, 3000),
  ].join('\n');
}

function buildProgramKnowledge(pages) {
  const normalizedPages = pages
    .map(page => normalizePageExtraction(page, page.page, page.image_path || '', page.ocr_text || ''))
    .sort((a, b) => a.page - b.page);

  const coverageIndex = emptyCoverageIndex();
  const vocabulary = [];
  const coreVocabulary = [];
  const supplementalVocabulary = [];
  const vocabularyByUnit = {};
  const coreVocabularyByUnit = {};
  const supplementalVocabularyByUnit = {};
  const sightWordsByUnit = {};
  const storiesByUnit = {};
  const chantsByUnit = {};
  const pagesByNumber = {};

  UNIT_RANGES.forEach(unit => {
    vocabularyByUnit[unit.id] = [];
    coreVocabularyByUnit[unit.id] = [];
    supplementalVocabularyByUnit[unit.id] = [];
    sightWordsByUnit[unit.id] = [];
    storiesByUnit[unit.id] = { title: `${unit.title} Story`, frames: [] };
    chantsByUnit[unit.id] = [];
  });

  normalizedPages.forEach(page => {
    pagesByNumber[page.page] = page;
    const unitId = page.unit_id;
    if (!unitId) return;

    const selectedWords = selectTargetVocabulary(page);
    const words = selectedWords.words
      .map(normalizeVocabulary)
      .filter(isUsefulVocabulary);

    words.forEach(word => {
      if (!vocabularyByUnit[unitId].includes(word)) vocabularyByUnit[unitId].push(word);
      const bucket = selectedWords.core.includes(word) ? 'core' : 'supplemental';
      if (bucket === 'core' && !coreVocabularyByUnit[unitId].includes(word)) coreVocabularyByUnit[unitId].push(word);
      if (bucket === 'supplemental' && !supplementalVocabularyByUnit[unitId].includes(word)) supplementalVocabularyByUnit[unitId].push(word);
      const item = {
        coverage_id: `U${unitId}-P${page.page}-WORD-${slug(word)}`,
        type: bucket === 'core' ? 'core_vocabulary_word' : 'supplemental_vocabulary_word',
        unit_id: unitId,
        word,
        requiredness: bucket,
        source_pages: String(page.page),
        source_refs: [`textbook:p${page.page}`],
      };
      vocabulary.push(item);
      if (bucket === 'core') coreVocabulary.push(item);
      if (bucket === 'supplemental') supplementalVocabulary.push(item);
      addCoverage(coverageIndex, item, [page.page], [word]);
    });

    page.language_patterns.forEach((pattern, index) => {
      const text = cleanSentence(pattern.pattern);
      if (!isTeachablePattern(text)) return;
      const examples = unique((pattern.examples || []).map(cleanSentence).filter(isTeachablePattern));
      const item = {
        coverage_id: `U${unitId}-P${page.page}-PATTERN-${index + 1}-${slug(text)}`,
        type: 'pattern',
        unit_id: unitId,
        pattern: text,
        examples,
        source_pages: String(page.page),
        source_refs: [`textbook:p${page.page}`],
      };
      addCoverage(coverageIndex, item, [page.page], extractWords([text, ...examples].join(' ')));
    });

    page.story_sentences.forEach((sentence, index) => {
      const text = cleanSentence(sentence);
      if (!isTeachablePattern(text)) return;
      storiesByUnit[unitId].frames.push(text);
      const item = {
        coverage_id: `U${unitId}-P${page.page}-STORY-${index + 1}`,
        type: 'story_frame',
        unit_id: unitId,
        text,
        source_pages: String(page.page),
        source_refs: [`textbook:p${page.page}`],
      };
      addCoverage(coverageIndex, item, [page.page], extractWords(text));
    });

    page.song_or_chant.forEach((line, index) => {
      const text = cleanSentence(line);
      if (!isTeachablePattern(text)) return;
      chantsByUnit[unitId].push(text);
      const item = {
        coverage_id: `U${unitId}-P${page.page}-CHANT-${index + 1}`,
        type: 'chant',
        unit_id: unitId,
        text,
        source_pages: String(page.page),
        source_refs: [`textbook:p${page.page}`],
      };
      addCoverage(coverageIndex, item, [page.page], extractWords(text));
    });

    page.grammar_points.forEach((grammar, index) => {
      const text = cleanSentence(grammar);
      if (!text) return;
      const item = {
        coverage_id: `U${unitId}-P${page.page}-GRAMMAR-${index + 1}-${slug(text)}`,
        type: 'grammar',
        unit_id: unitId,
        text,
        source_pages: String(page.page),
        source_refs: [`textbook:p${page.page}`],
      };
      addCoverage(coverageIndex, item, [page.page], extractWords(text));
    });
  });

  const units = UNIT_RANGES.map(unit => {
    const unitPages = range(unit.pages[0], unit.pages[1]);
    const pageRecords = unitPages.map(page => pagesByNumber[page]).filter(Boolean);
    const patterns = idsToItems(coverageIndex.by_unit[unit.id] || [], coverageIndex)
      .filter(item => item.type === 'pattern');
    const grammar = idsToItems(coverageIndex.by_unit[unit.id] || [], coverageIndex)
      .filter(item => item.type === 'grammar');

    return {
      id: unit.id,
      unit_id: unit.id,
      title: unit.title,
      pages: `${unit.pages[0]}-${unit.pages[1]}`,
      page_numbers: unitPages,
      source: 'Big Fun Student Book 2 AI vision',
      vocabulary: vocabularyByUnit[unit.id],
      core_vocabulary: coreVocabularyByUnit[unit.id],
      supplemental_vocabulary: supplementalVocabularyByUnit[unit.id],
      words: vocabulary
        .filter(item => Number(item.unit_id) === unit.id)
        .map(item => ({ ...item })),
      patterns,
      grammar_points: grammar,
      sight_words: [],
      story: {
        coverage_id: `U${unit.id}-STORY`,
        title: `${unit.title} Story`,
        page: pageRecords.find(page => page.story_sentences.length)?.page || null,
        frames: unique(storiesByUnit[unit.id].frames).map((text, index) => ({
          coverage_id: `U${unit.id}-STORY-F${index + 1}`,
          type: 'story_frame',
          unit_id: unit.id,
          text,
          source_pages: findFirstPageForText(pageRecords, 'story_sentences', text),
        })),
      },
      chants: unique(chantsByUnit[unit.id]).map((text, index) => ({
        coverage_id: `U${unit.id}-CHANT-${index + 1}`,
        type: 'chant',
        unit_id: unit.id,
        text,
        source_pages: findFirstPageForText(pageRecords, 'song_or_chant', text),
      })),
      raw_pages: pageRecords,
    };
  });

  sortCoverageIndex(coverageIndex);

  return {
    schema_version: 'opw2.program_knowledge.v1',
    material_id: 'bigfun2_textbook',
    title: 'Big Fun Student Book 2',
    source_pdf: 'C:/Users/ke\'ko/Desktop/new bigfun student book 2.pdf',
    extraction: {
      method: 'AI vision page understanding from rendered PDF pages',
      source_image_dir: imagesDir,
      source_md_dir: sourceDir,
      cache_dir: cacheDir,
      generated_at: new Date().toISOString(),
      model: process.env.VISION_MODEL || process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || '',
      notes: [
        'Image is primary evidence; OCR markdown is auxiliary.',
        'Vocabulary boxes/corners/footers are separated from general visible words.',
        'Generated for programmatic coverage gating; every item keeps source page refs.',
      ],
    },
    source: {
      source_json: outputPath,
      generated_at: new Date().toISOString(),
      extraction_method: 'AI vision',
    },
    meta: {
      course: 'Big Fun Student Book 2',
      material_kind: 'textbook',
      page_count: normalizedPages.length,
    },
    units,
    reviews: buildReviews(normalizedPages, coverageIndex),
    pages: normalizedPages,
    pagesByNumber,
    vocabulary,
    coreVocabulary,
    supplementalVocabulary,
    vocabularyByUnit,
    coreVocabularyByUnit,
    supplementalVocabularyByUnit,
    sightWordsByUnit,
    storiesByUnit,
    chantsByUnit,
    class_instructions: [],
    coverage_index: coverageIndex,
    prompt_slices: buildPromptSlices(units),
    raw: { pages: normalizedPages },
  };
}

function buildReviews(pages, coverageIndex) {
  return pages
    .filter(page => page.page_type === 'review')
    .map((page, index) => ({
      review_id: index + 1,
      id: index + 1,
      covers: page.unit_id ? `Unit ${page.unit_id}` : 'mixed review',
      pages: String(page.page),
      page_numbers: [page.page],
      activities: page.activities,
      coverage_ids: coverageIndex.by_page[String(page.page)] || [],
    }));
}

function buildPromptSlices(units) {
  return {
    compact: units.map(unit => {
      const patterns = unique((unit.patterns || []).map(item => item.pattern)).join(' | ');
      const grammar = unique((unit.grammar_points || []).map(item => item.text)).join(' | ');
      return [
        `Unit ${unit.unit_id} ${unit.title} pages ${unit.pages}`,
        `Words: ${unit.vocabulary.join(', ')}`,
        `Patterns: ${patterns}`,
        `Grammar: ${grammar}`,
        `Story: ${(unit.story?.frames || []).map(frame => frame.text).join(' | ')}`,
        `Chants: ${(unit.chants || []).map(chant => chant.text).join(' | ')}`,
      ].join('\n');
    }).join('\n\n'),
    by_unit: Object.fromEntries(units.map(unit => [
      unit.unit_id,
      {
        title: unit.title,
        pages: unit.pages,
        words: unit.core_vocabulary?.length ? unit.core_vocabulary : unit.vocabulary,
        supplemental_words: unit.supplemental_vocabulary || [],
        sight_words: [],
        story_sentences: (unit.story?.frames || []).map(frame => frame.text),
        chants: (unit.chants || []).map(chant => chant.text),
        patterns: (unit.patterns || []).map(pattern => pattern.pattern),
        grammar_points: (unit.grammar_points || []).map(grammar => grammar.text),
      },
    ])),
  };
}

function normalizePageExtraction(input, page, imagePath, ocrText) {
  const route = routeUnitByPage(page);
  const unitId = route?.id || normalizeUnitId(input.unit_id) || null;
  const unitTitle = cleanText(input.unit_title || route?.title || '');
  return {
    page,
    unit_id: unitId,
    unit_title: unitTitle,
    visible_page_number: Number(input.visible_page_number) || null,
    page_type: PAGE_TYPE_ORDER.includes(input.page_type) ? input.page_type : 'unknown',
    vocabulary_box: normalizeWordList(input.vocabulary_box),
    other_target_words: normalizeWordList(input.other_target_words),
    language_patterns: normalizePatterns(input.language_patterns),
    grammar_points: normalizeSentenceList(input.grammar_points).filter(isUsefulGrammar),
    story_sentences: normalizeSentenceList(input.story_sentences),
    song_or_chant: normalizeSentenceList(input.song_or_chant),
    phonics_words: unique([
      ...normalizeWordList(input.phonics_words),
      ...(input.page_type === 'phonics' ? normalizeWordList(input.vocabulary_box) : []),
    ]),
    activities: normalizeActivities(input.activities),
    source_refs: normalizeSentenceList(input.source_refs).length ? normalizeSentenceList(input.source_refs) : [`textbook:p${page}`],
    confidence: clamp(Number(input.confidence), 0, 1),
    notes: normalizeSentenceList(input.notes),
    image_path: imagePath,
    ocr_text: ocrText,
  };
}

function selectTargetVocabulary(page) {
  if (page.page_type === 'phonics') return { words: [], core: [], supplemental: [] };
  if (page.page_type === 'story') return { words: [], core: [], supplemental: [] };
  if (page.page_type === 'values') return { words: [], core: [], supplemental: [] };
  if (page.page_type === 'project') return { words: [], core: [], supplemental: [] };

  const explicitWords = [...page.vocabulary_box];
  const explicitSet = new Set(explicitWords.map(normalizeVocabulary));
  const canUseOtherTargets = [
    'vocabulary_presentation',
    'language_presentation',
    'language_practice',
    'review',
  ].includes(page.page_type);

  if (!canUseOtherTargets) {
    const core = unique(explicitWords);
    return { words: core, core, supplemental: [] };
  }

  const evidence = [
    page.ocr_text,
    ...page.notes,
    ...page.activities.map(item => `${item.label} ${item.instructions}`),
  ].join(' ').toLowerCase();
  const targetEvidence = /vocabulary|review|presentation|practice|language|match|write|look and match/.test(evidence);
  if (!targetEvidence && explicitWords.length) {
    const core = unique(explicitWords);
    return { words: core, core, supplemental: [] };
  }
  if (!targetEvidence) {
    const core = unique(explicitWords);
    return { words: core, core, supplemental: [] };
  }

  const all = unique([...explicitWords, ...page.other_target_words]);
  const isVocabularyReview = /vocabulary\s+review/.test(evidence);
  const core = all.filter(word =>
    explicitSet.has(normalizeVocabulary(word))
    || page.page_type === 'vocabulary_presentation'
    || isVocabularyReview
  );
  const supplemental = all.filter(word => !core.includes(word));
  return { words: all, core, supplemental };
}

function validateProgramKnowledge(knowledge) {
  if (knowledge.schema_version !== 'opw2.program_knowledge.v1') throw new Error('Invalid schema version');
  if (knowledge.units.length !== 8) throw new Error(`Expected 8 units, got ${knowledge.units.length}`);
  const indexedUnits = new Set(Object.keys(knowledge.coverage_index.by_unit).map(Number));
  const partialBuild = indexedUnits.size > 0 && indexedUnits.size < 8;
  knowledge.units.forEach(unit => {
    if (!unit.vocabulary.length && !partialBuild) throw new Error(`Unit ${unit.unit_id} has no vocabulary`);
    if (!unit.patterns.length) console.warn(`WARN: Unit ${unit.unit_id} has no language patterns`);
  });
  const badWords = knowledge.vocabulary
    .map(item => item.word)
    .filter(word => /\d/.test(word) || word.length > 28 || !/[a-z]/.test(word));
  if (badWords.length) throw new Error(`Invalid vocabulary items: ${badWords.slice(0, 20).join(', ')}`);
}

function renderSummaryMarkdown(knowledge) {
  const lines = [
    '# Big Fun 2 AI Vision Knowledge Summary',
    '',
    `- Generated: ${knowledge.extraction.generated_at}`,
    `- Pages: ${knowledge.pages.length}`,
    `- Units: ${knowledge.units.length}`,
    `- Vocabulary: ${knowledge.vocabulary.length}`,
    '',
  ];
  knowledge.units.forEach(unit => {
    lines.push(`## Unit ${unit.unit_id}: ${unit.title}`);
    lines.push(`- Pages: ${unit.pages}`);
    lines.push(`- Words: ${unit.vocabulary.join(', ')}`);
    lines.push(`- Patterns: ${unique(unit.patterns.map(item => item.pattern)).join(' | ') || '(none)'}`);
    lines.push(`- Grammar: ${unique(unit.grammar_points.map(item => item.text)).join(' | ') || '(none)'}`);
    lines.push(`- Story: ${(unit.story?.frames || []).map(frame => frame.text).join(' | ') || '(none)'}`);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

function listPageImages(dir) {
  return fs.readdirSync(dir)
    .map(name => {
      const match = name.match(/^page_(\d+)\.(png|jpg|jpeg)$/i);
      if (!match) return null;
      return { page: Number(match[1]), path: path.join(dir, name) };
    })
    .filter(Boolean)
    .sort((a, b) => a.page - b.page);
}

function shouldIncludePage(page) {
  if (onlyPages.size) return onlyPages.has(page);
  if (startPage && page < startPage) return false;
  if (endPage && page > endPage) return false;
  return true;
}

function readCachedPage(page) {
  const file = cachePath(page);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeCachedPage(page, data) {
  fs.writeFileSync(cachePath(page), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function cachePath(page) {
  return path.join(cacheDir, `page_${String(page).padStart(3, '0')}.json`);
}

function readPageMarkdown(page) {
  const mdPath = path.join(sourceDir, `page_${String(page).padStart(3, '0')}.md`);
  return fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
}

function routeUnitByPage(page) {
  return UNIT_RANGES.find(unit => page >= unit.pages[0] && page <= unit.pages[1]) || null;
}

function normalizePatterns(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (typeof item === 'string') return { pattern: cleanSentence(item), examples: [] };
    return {
      pattern: cleanSentence(item?.pattern || ''),
      examples: normalizeSentenceList(item?.examples),
    };
  }).filter(item => isTeachablePattern(item.pattern));
}

function normalizeActivities(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (typeof item === 'string') return { label: cleanText(item), instructions: '' };
    return {
      label: cleanText(item?.label || ''),
      instructions: cleanText(item?.instructions || ''),
    };
  }).filter(item => item.label || item.instructions);
}

function normalizeWordList(list) {
  if (!Array.isArray(list)) return [];
  return unique(list.flatMap(item => String(item || '').split(/[,;，；]/))
    .map(normalizeVocabulary)
    .filter(isUsefulVocabulary));
}

function normalizeSentenceList(list) {
  if (!Array.isArray(list)) return [];
  return unique(list.map(cleanSentence).filter(Boolean));
}

function normalizeVocabulary(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z]+|[^a-z]+$/g, '');
}

function isUsefulVocabulary(word) {
  if (!word || word.length < 2) return false;
  if (/\d/.test(word)) return false;
  if (!/^[a-z]+(?: [a-z]+){0,2}$/.test(word)) return false;
  if (STOP_WORDS.has(word)) return false;
  if (word.split(' ').some(part => STOP_WORDS.has(part) && word.split(' ').length === 1)) return false;
  return true;
}

function isUsefulGrammar(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^\d+$/.test(text)) return false;
  return text.length <= 80;
}

function isTeachablePattern(value) {
  const text = cleanSentence(value);
  if (!text || text.length < 4 || text.length > 140) return false;
  if (/\d{2,}/.test(text)) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/^(unit|page|track|student book|big fun)$/i.test(text)) return false;
  return true;
}

function cleanSentence(value) {
  return cleanText(value)
    .replace(/\s+([?.!,])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
}

function cleanText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[�]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnitId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 8 ? number : null;
}

function cleanJson(content) {
  const text = String(content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function addCoverage(index, item, pages = [], words = []) {
  if (!item.coverage_id) throw new Error('Missing coverage_id');
  if (!index.by_id[item.coverage_id]) index.by_id[item.coverage_id] = item;
  if (item.unit_id) pushIndex(index.by_unit, item.unit_id, item.coverage_id);
  if (item.pattern) pushIndex(index.by_pattern, item.pattern, item.coverage_id);
  words.forEach(word => pushIndex(index.by_word, normalizeCoverageWord(word), item.coverage_id));
  pages.forEach(page => pushIndex(index.by_page, page, item.coverage_id));
}

function pushIndex(group, key, value) {
  const safeKey = String(key || '').trim();
  if (!safeKey) return;
  group[safeKey] = group[safeKey] || [];
  if (!group[safeKey].includes(value)) group[safeKey].push(value);
}

function idsToItems(ids, index) {
  return ids.map(id => index.by_id[id]).filter(Boolean);
}

function sortCoverageIndex(index) {
  Object.values(index).forEach(group => {
    Object.keys(group).forEach(key => {
      if (Array.isArray(group[key])) group[key].sort();
    });
  });
}

function emptyCoverageIndex() {
  return { by_id: {}, by_unit: {}, by_pattern: {}, by_word: {}, by_page: {} };
}

function extractWords(value) {
  return [...String(value || '').toLowerCase().matchAll(/\b[a-z]{2,20}\b/g)].map(match => match[0]);
}

function normalizeCoverageWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function findFirstPageForText(pages, field, text) {
  const found = pages.find(page => (page[field] || []).includes(text));
  return found ? String(found.page) : '';
}

function unique(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function parsePageSelection(value) {
  const selected = new Set();
  String(value || '').split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
    const rangeMatch = item.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      range(Number(rangeMatch[1]), Number(rangeMatch[2])).forEach(page => selected.add(page));
    } else {
      const page = Number(item);
      if (Number.isFinite(page)) selected.add(page);
    }
  });
  return selected;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, rawValue] = arg.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (rawValue !== undefined) {
      parsed[key] = rawValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      parsed[key] = argv[index + 1];
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function joinApiUrl(baseUrl, suffix) {
  return `${String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '')}/v1/${suffix}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizePath(input) {
  return path.normalize(String(input || ''));
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

function slug(value) {
  return String(value || 'item')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    || 'item';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
