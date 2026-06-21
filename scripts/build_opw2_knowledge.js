import fs from 'fs';
import path from 'path';

const SOURCE_DIR = process.env.OPW2_SOURCE_DIR || 'D:/zhishiku/00_Inbox/笑笑英语/OPW2-文字提取';
const SOURCE_JSON = path.join(SOURCE_DIR, '99_all-units.json');
const PROGRAM_JSON = path.join(SOURCE_DIR, 'opw2_program_knowledge.json');
const REVIEW_MD = path.join(SOURCE_DIR, 'OPW2_程序知识库_人工审阅.md');

const raw = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
const knowledge = buildProgramKnowledge(raw);

validateKnowledge(knowledge);

fs.writeFileSync(PROGRAM_JSON, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
fs.writeFileSync(REVIEW_MD, renderReviewMarkdown(knowledge), 'utf8');

console.log(`OPW2 program knowledge written: ${PROGRAM_JSON}`);
console.log(`OPW2 review markdown written: ${REVIEW_MD}`);
console.log(`Units: ${knowledge.units.length}`);
console.log(`Reviews: ${knowledge.reviews.length}`);
console.log(`Vocabulary: ${knowledge.vocabulary.length}`);
console.log(`Coverage IDs: ${Object.keys(knowledge.coverage_index.by_id).length}`);

function buildProgramKnowledge(source) {
  const coverageIndex = {
    by_id: {},
    by_unit: {},
    by_pattern: {},
    by_word: {},
    by_page: {},
  };

  const vocabulary = [];
  const vocabularyByUnit = {};
  const sightWordsByUnit = {};
  const storiesByUnit = {};
  const chantsByUnit = {};

  const units = (source.units || []).map(unit => {
    const unitId = Number(unit.id);
    const unitPages = parsePages(unit.pages);
    vocabularyByUnit[unitId] = [];
    sightWordsByUnit[unitId] = [...(unit.sight_words || [])];

    const patterns = (unit.patterns || []).map(pattern => {
      const coverageId = `U${unitId}-PATTERN-${slug(pattern.pattern)}`;
      const item = {
        coverage_id: coverageId,
        type: 'pattern',
        unit_id: unitId,
        title: unit.title,
        phoneme: unit.phoneme,
        pattern: pattern.pattern,
        examples: [...(pattern.examples || [])],
        rule: pattern.rule || '',
        source_pages: unit.pages,
      };
      addCoverage(coverageIndex, item, unitPages, item.examples);

      const examples = (pattern.examples || []).map(word => {
        const vocabEntry = findVocabulary(source, word, unitId, pattern.pattern, unit.phoneme);
        const wordItem = {
          coverage_id: `U${unitId}-WORD-${slug(word)}`,
          type: 'word',
          unit_id: unitId,
          word,
          pattern: pattern.pattern,
          phoneme: unit.phoneme,
          meaning_zh: vocabEntry?.meaning_zh || '',
          source_pages: unit.pages,
        };
        vocabulary.push(wordItem);
        vocabularyByUnit[unitId].push(word);
        addCoverage(coverageIndex, wordItem, unitPages, [word]);
        return wordItem;
      });

      return { ...item, words: examples };
    });

    const sight_words = (unit.sight_words || []).map(word => {
      const item = {
        coverage_id: `U${unitId}-SIGHT-${slug(word)}`,
        type: 'sight_word',
        unit_id: unitId,
        word,
        source_pages: unit.pages,
      };
      addCoverage(coverageIndex, item, unitPages, [word]);
      return item;
    });

    const chants = (unit.chants || []).map((text, index) => {
      const item = {
        coverage_id: `U${unitId}-CHANT-${index + 1}`,
        type: 'chant',
        unit_id: unitId,
        text,
        source_pages: unit.pages,
        words: extractWords(text),
      };
      addCoverage(coverageIndex, item, unitPages, item.words);
      return item;
    });
    chantsByUnit[unitId] = chants.map(item => item.text);

    const storyTitle = unit.story?.title || '';
    const storyFrames = (unit.story?.frames || []).map((text, index) => {
      const item = {
        coverage_id: `U${unitId}-STORY-${slug(storyTitle)}-F${index + 1}`,
        type: 'story_frame',
        unit_id: unitId,
        story_title: storyTitle,
        frame: index + 1,
        text,
        source_pages: String(unit.story?.page || unit.pages),
        audio_track: unit.story?.audio_track || '',
        words: extractWords(text),
      };
      addCoverage(coverageIndex, item, [Number(unit.story?.page)].filter(Boolean), item.words);
      return item;
    });
    const story = unit.story ? {
      coverage_id: `U${unitId}-STORY-${slug(storyTitle)}`,
      title: storyTitle,
      page: unit.story.page,
      audio_track: unit.story.audio_track || '',
      frames: storyFrames,
    } : null;
    if (story) {
      storiesByUnit[unitId] = {
        title: story.title,
        frames: story.frames.map(frame => frame.text),
      };
    }

    return {
      unit_id: unitId,
      id: unitId,
      title: unit.title,
      phoneme: unit.phoneme,
      pages: unit.pages,
      page_numbers: unitPages,
      patterns,
      words: patterns.flatMap(pattern => pattern.words),
      sight_words,
      chants,
      story,
    };
  });

  const reviews = (source.reviews || []).map(review => {
    const reviewId = Number(review.id);
    const pages = parsePages(review.pages);
    const songLines = splitSongLines(review.song?.lyrics || '').map((text, index) => {
      const item = {
        coverage_id: `R${reviewId}-SONG-L${index + 1}`,
        type: 'song_line',
        review_id: reviewId,
        text,
        source_pages: review.pages,
        audio_track: review.song?.audio_track || '',
        words: extractWords(text),
      };
      addCoverage(coverageIndex, item, pages, item.words);
      return item;
    });
    const item = {
      coverage_id: `R${reviewId}-SONG-${slug(review.song?.title || `review-${reviewId}`)}`,
      type: 'review_song',
      review_id: reviewId,
      covers: review.covers,
      pages: review.pages,
      title: review.song?.title || '',
      lyrics: review.song?.lyrics || '',
      audio_track: review.song?.audio_track || '',
      lines: songLines,
    };
    addCoverage(coverageIndex, item, pages, extractWords(item.lyrics));
    return {
      review_id: reviewId,
      id: reviewId,
      covers: review.covers,
      pages: review.pages,
      page_numbers: pages,
      song: item,
    };
  });

  sortIndex(coverageIndex);

  return {
    schema_version: 'opw2.program_knowledge.v1',
    source: {
      source_json: SOURCE_JSON,
      generated_at: new Date().toISOString(),
      extraction_date: source.meta?.extraction_date || '',
      extraction_method: source.meta?.extraction_method || '',
    },
    meta: source.meta || {},
    structure: source.structure || {},
    units,
    reviews,
    vocabulary,
    vocabularyByUnit,
    sightWordsByUnit,
    storiesByUnit,
    chantsByUnit,
    class_instructions: source.class_instructions || [],
    coverage_index: coverageIndex,
    prompt_slices: buildPromptSlices(units, reviews),
    raw: source,
  };
}

function buildPromptSlices(units, reviews) {
  return {
    compact: [
      'OPW2 Level 2 Short Vowels. Use only teacher input plus the in-scope items below for expansions.',
      ...units.map(unit => {
        const patterns = unit.patterns.map(pattern =>
          `${pattern.pattern}: ${pattern.examples.join(', ')}`
        ).join(' | ');
        const sight = unit.sight_words.map(item => item.word).join(', ');
        return `Unit ${unit.unit_id} ${unit.title} pages ${unit.pages}: ${patterns}; sight: ${sight}; story: ${unit.story?.title || ''}.`;
      }),
      ...reviews.map(review =>
        `Review ${review.review_id} pages ${review.pages}: ${review.covers}; song: ${review.song.title}.`
      ),
    ].join('\n'),
    by_unit: Object.fromEntries(units.map(unit => [
      unit.unit_id,
      {
        title: unit.title,
        pages: unit.pages,
        words: unit.words.map(item => item.word),
        sight_words: unit.sight_words.map(item => item.word),
        story_sentences: unit.story?.frames.map(frame => frame.text) || [],
        chants: unit.chants.map(item => item.text),
      },
    ])),
  };
}

function addCoverage(index, item, pages = [], words = []) {
  if (!item.coverage_id) throw new Error('Missing coverage_id');
  if (index.by_id[item.coverage_id]) throw new Error(`Duplicate coverage_id: ${item.coverage_id}`);
  index.by_id[item.coverage_id] = item;

  if (item.unit_id) pushIndex(index.by_unit, item.unit_id, item.coverage_id);
  if (item.pattern) pushIndex(index.by_pattern, item.pattern, item.coverage_id);
  words.forEach(word => pushIndex(index.by_word, normalizeWord(word), item.coverage_id));
  pages.forEach(page => pushIndex(index.by_page, page, item.coverage_id));
}

function sortIndex(index) {
  Object.values(index).forEach(group => {
    Object.keys(group).forEach(key => {
      if (Array.isArray(group[key])) group[key] = [...new Set(group[key])].sort();
    });
  });
}

function pushIndex(group, key, id) {
  const safeKey = String(key || '').trim();
  if (!safeKey) return;
  group[safeKey] = group[safeKey] || [];
  group[safeKey].push(id);
}

function findVocabulary(source, word, unit, pattern, phoneme) {
  return (source.all_vocabulary || []).find(item =>
    normalizeWord(item.word) === normalizeWord(word) &&
    Number(item.unit) === Number(unit) &&
    item.pattern === pattern &&
    item.phoneme === phoneme
  );
}

function validateKnowledge(knowledge) {
  const ids = Object.keys(knowledge.coverage_index.by_id);
  if (knowledge.units.length !== 8) throw new Error(`Expected 8 units, got ${knowledge.units.length}`);
  if (knowledge.reviews.length !== 4) throw new Error(`Expected 4 reviews, got ${knowledge.reviews.length}`);
  if (knowledge.vocabulary.length !== 93) throw new Error(`Expected 93 vocabulary words, got ${knowledge.vocabulary.length}`);
  if (ids.length !== new Set(ids).size) throw new Error('Coverage IDs must be unique');
  knowledge.units.forEach(unit => {
    if (!unit.patterns.length || !unit.words.length || !unit.sight_words.length || !unit.story || !unit.chants.length) {
      throw new Error(`Unit ${unit.unit_id} is missing required program knowledge sections`);
    }
  });
}

function renderReviewMarkdown(knowledge) {
  const lines = [
    '# OPW2 程序知识库人工审阅版',
    '',
    `- Schema: ${knowledge.schema_version}`,
    `- Source: ${knowledge.source.source_json}`,
    `- Units: ${knowledge.units.length}`,
    `- Reviews: ${knowledge.reviews.length}`,
    `- Vocabulary: ${knowledge.vocabulary.length}`,
    `- Coverage IDs: ${Object.keys(knowledge.coverage_index.by_id).length}`,
    '',
  ];

  knowledge.units.forEach(unit => {
    lines.push(`## Unit ${unit.unit_id}: ${unit.title}`, '');
    lines.push(`- Pages: ${unit.pages}`);
    lines.push(`- Phoneme: ${unit.phoneme}`);
    lines.push(`- Words: ${unit.words.map(item => `${item.word}(${item.coverage_id})`).join(', ')}`);
    lines.push(`- Sight Words: ${unit.sight_words.map(item => `${item.word}(${item.coverage_id})`).join(', ')}`);
    lines.push('');
    lines.push('### Patterns');
    unit.patterns.forEach(pattern => {
      lines.push(`- ${pattern.coverage_id}: ${pattern.pattern} -> ${pattern.examples.join(', ')}`);
    });
    lines.push('');
    lines.push('### Chants');
    unit.chants.forEach(chant => {
      lines.push(`- ${chant.coverage_id}: ${chant.text}`);
    });
    lines.push('');
    lines.push(`### Story: ${unit.story?.title || ''}`);
    (unit.story?.frames || []).forEach(frame => {
      lines.push(`- ${frame.coverage_id}: ${frame.text}`);
    });
    lines.push('');
  });

  lines.push('## Reviews', '');
  knowledge.reviews.forEach(review => {
    lines.push(`### Review ${review.review_id}: ${review.covers}`);
    lines.push(`- Pages: ${review.pages}`);
    lines.push(`- Song: ${review.song.title} (${review.song.coverage_id})`);
    review.song.lines.forEach(line => {
      lines.push(`- ${line.coverage_id}: ${line.text}`);
    });
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function parsePages(value) {
  const text = String(value || '');
  const range = text.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  return [...text.matchAll(/\d+/g)].map(match => Number(match[0]));
}

function splitSongLines(value) {
  return String(value || '')
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function extractWords(value) {
  return [...String(value || '').toLowerCase().matchAll(/\b[a-z]{1,12}\b/g)]
    .map(match => match[0]);
}

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function slug(value) {
  return String(value || 'item')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    || 'item';
}
