#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import config from './backend/config.js';
import { loadOPW2 } from './backend/knowledge/opw2_loader.js';
import { validateQuestions } from './backend/validators/index.js';

const TEST_PORT = Number(process.env.GENERATION_LOOP_PORT || 5501);
const API_URL = `http://${config.server.host}:${TEST_PORT}`;
const RUN_REAL = process.argv.includes('--real') || process.env.GENERATION_LOOP_REAL === 'true';
const LOOP_COUNT = numberArg('--loops', 5);
const START_INDEX = Math.max(1, numberArg('--start', 1));
const MIN_PER_TYPE = numberArg('--min', config.questions.minPerType);
const REPORT_DIR = path.join(process.cwd(), 'reports');

const IMAGE_KEYS = new Set([
  'book', 'bag', 'pencil', 'ruler', 'desk', 'chair',
  'red', 'blue', 'yellow', 'green',
  'apple', 'banana', 'orange', 'pear',
  'cat', 'dog', 'fish', 'bird',
  'hen', 'pen', 'bed',
]);

const COMMON_WORDS = new Set([
  'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'is', 'are', 'am', 'do', 'does', 'can', 'have', 'has', 'like', 'want', 'see',
  'this', 'that', 'your', 'my', 'yes', 'no', 'not', 'what', 'how', 'much', 'many',
  'some', 'and', 'or', 'to', 'in', 'on', 'with', 'correct', 'choose', 'listen',
  'read', 'spell', 'word', 'picture', 'trace', 'letter', 'complete', 'dialogue',
  'id', 'ids', 'type', 'module', 'requirement', 'requirements', 'child', 'instruction',
  'prompt', 'explanation', 'audio', 'text', 'source', 'lang', 'label', 'image', 'key',
  'correct', 'option', 'options', 'translation', 'target', 'sentence', 'parts', 'blank',
  'answer', 'letter', 'pool', 'focus', 'scene', 'role', 'name', 'icon', 'heard',
  'listen', 'pick', 'match', 'aloud', 'judge', 'order', 'translate', 'challenge',
  'blankanswer', 'spellword', 'sourcetext', 'imagkey', 'imagekey',
]);

const TEACHER_CASES = [
  {
    name: 'unit-phonics-hen-pen-red',
    content: 'Review OPW2 Unit 3. Focus on hen, pen, bed, red. Practice spelling, listening, reading aloud, and simple sentence order.',
    expected: ['hen', 'pen', 'bed', 'red'],
  },
  {
    name: 'school-objects-question-patterns',
    content: 'Practice school words: book, bag, pencil. Sentence patterns: Is this your book? Yes, it is. No, it is not.',
    expected: ['book', 'bag', 'pencil'],
  },
  {
    name: 'animal-and-can-pattern',
    content: 'Use animal words cat, dog, fish. Review Can you see a cat? and short answers Yes, I can / No, I cannot.',
    expected: ['cat', 'dog', 'fish'],
  },
  {
    name: 'colors-and-description',
    content: 'Review colors red, blue, yellow, green. Use sentences like The pen is red and I see a blue bag.',
    expected: ['red', 'blue', 'yellow', 'green'],
  },
  {
    name: 'mixed-ui-schema-stress',
    content: 'Create a complete child practice set using book, pen, cat, dog, red. Include dialogue, fill blank, word order, translation, listening, spelling, phonics, reading, and writing.',
    expected: ['book', 'pen', 'cat', 'dog', 'red'],
  },
];

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const managedServer = await ensureBackendServer();

  const opw2Words = getOpw2WordSet();
  const selectedCases = Array.from(
    { length: LOOP_COUNT },
    (_, index) => TEACHER_CASES[(START_INDEX - 1 + index) % TEACHER_CASES.length]
  );
  const report = {
    mode: RUN_REAL ? 'real' : 'mock-endpoint',
    apiUrl: API_URL,
    startedAt: new Date().toISOString(),
    minPerType: MIN_PER_TYPE,
    loops: [],
  };

  console.log(`Generation loop: ${report.mode}`);
  console.log(`Target: ${API_URL}`);
  console.log(`Loops: ${selectedCases.length}`);
  console.log(`Start case: ${START_INDEX}`);
  console.log('');

  await checkHealth(report);

  for (let i = 0; i < selectedCases.length; i += 1) {
    const testCase = selectedCases[i];
    const loop = await runOneLoop(START_INDEX + i, testCase, opw2Words);
    report.loops.push(loop);
    printLoopSummary(loop);
    persistLatestReport(report);

    if (loop.status === 'FAIL' && RUN_REAL && loop.failures.some(failure => failure.includes('429'))) {
      console.log('Stopping real loop early because the provider returned a rate limit.');
      break;
    }
  }

  report.finishedAt = new Date().toISOString();
  report.overall = report.loops.every(loop => loop.status === 'PASS') ? 'PASS' : 'FAIL';

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(REPORT_DIR, `generation-loop-${report.mode}-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `generation-loop-${report.mode}-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf-8');

  console.log('');
  console.log(`Overall: ${report.overall}`);
  console.log(`Report JSON: ${jsonPath}`);
  console.log(`Report MD: ${mdPath}`);

  if (managedServer) managedServer.kill();
  process.exit(report.overall === 'PASS' ? 0 : 1);
}

async function checkHealth(report) {
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, 5000);
    const data = await response.json();
    report.health = { ok: response.ok && data.status === 'ok', data };
  } catch (error) {
    report.health = { ok: false, error: error.message };
  }
}

async function ensureBackendServer() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, 1500);
    if (response.ok) {
      const data = await response.json();
      if (isExpectedBackendConfig(data)) return null;
    }
  } catch {
    // Start a temporary backend for this verification run.
  }

  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: buildServerEnv(),
  });

  child.stdout.on('data', chunk => {
    const text = String(chunk).trim();
    if (text) console.log(`[backend] ${text}`);
  });
  child.stderr.on('data', chunk => {
    const text = String(chunk).trim();
    if (text) console.error(`[backend] ${text}`);
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(`${API_URL}/health`, {}, 1000);
      if (response.ok) {
        const data = await response.json();
        if (isExpectedBackendConfig(data)) return child;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  child.kill();
  throw new Error('Backend did not become healthy within 15s.');
}

function buildServerEnv() {
  return {
    ...process.env,
    PORT: String(TEST_PORT),
    ...(RUN_REAL ? { LLM_STAGE2: 'true', MOCK_GENERATION: 'false' } : {}),
  };
}

function isExpectedBackendConfig(data) {
  if (data.config?.requiredTypes !== config.questions.requiredTypes.length) return false;
  if (RUN_REAL && data.config?.stage2UseLLM !== true) return false;
  if (RUN_REAL && data.config?.mockGeneration !== false) return false;
  return true;
}

async function runOneLoop(loopIndex, testCase, opw2Words) {
  const startedAt = Date.now();
  const loop = {
    loop: loopIndex,
    caseName: testCase.name,
    content: testCase.content,
    endpoint: RUN_REAL ? '/api/generate' : '/api/mock-generate',
    failures: [],
    warnings: [],
  };

  try {
    const data = await requestGeneration(testCase);
    loop.meta = data.meta || {};
    loop.moduleCount = Array.isArray(data.modules) ? data.modules.length : 0;
    loop.questions = flattenQuestions(data);
    loop.questionCount = loop.questions.length;
    loop.counts = countByType(loop.questions);

    checkRealApiPath(loop);
    checkCoverage(loop);
    checkValidation(loop);
    checkUiSchema(loop);
    checkTeacherAlignment(loop, testCase, opw2Words);
    checkNoOldStaticSet(loop, testCase);
  } catch (error) {
    loop.failures.push(error.message);
  }

  loop.elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
  loop.status = loop.failures.length === 0 ? 'PASS' : 'FAIL';
  return loop;
}

function checkRealApiPath(loop) {
  if (!RUN_REAL) return;
  const mode = String(loop.meta?.mode || '');
  if (!mode.startsWith('llm_full')) {
    loop.failures.push(`Stage2 API path not used: mode=${mode || 'unknown'}`);
  }
}

async function requestGeneration(testCase) {
  const endpoint = RUN_REAL ? '/api/generate' : '/api/mock-generate';
  const timeout = RUN_REAL ? 20 * 60 * 1000 : 10000;
  let confirmedAnalysis;
  if (RUN_REAL) {
    const analysisResponse = await fetchWithTimeout(`${API_URL}/api/analyze-homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: testCase.content }),
    }, 60000);
    const analysisData = await analysisResponse.json();
    if (!analysisResponse.ok || !analysisData.analysis) {
      throw new Error(`analysis API ${analysisResponse.status}: ${JSON.stringify(analysisData).slice(0, 300)}`);
    }
    confirmedAnalysis = analysisData.analysis;
  }
  const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: testCase.content,
      difficulty: 'level_2',
      target_minutes: 20,
      confirmed_analysis: confirmedAnalysis,
    }),
  }, timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

function checkCoverage(loop) {
  const missing = config.questions.requiredTypes.filter(type => !loop.counts[type]);
  const insufficient = config.questions.requiredTypes.filter(type => (loop.counts[type] || 0) < MIN_PER_TYPE);

  if (loop.moduleCount < config.questions.requiredTypes.length) {
    loop.failures.push(`module coverage is ${loop.moduleCount}/${config.questions.requiredTypes.length}`);
  }
  if (missing.length > 0) {
    loop.failures.push(`missing types: ${missing.join(', ')}`);
  }
  if (insufficient.length > 0) {
    loop.failures.push(`types below ${MIN_PER_TYPE}: ${insufficient.join(', ')}`);
  }
  if (loop.questionCount < config.questions.requiredTypes.length * MIN_PER_TYPE) {
    loop.failures.push(`total questions ${loop.questionCount} below ${config.questions.requiredTypes.length * MIN_PER_TYPE}`);
  }
}

function checkValidation(loop) {
  const validation = validateQuestions(loop.questions);
  if (!validation.valid) {
    loop.failures.push(`validator failed: ${validation.errors.slice(0, 8).join(' | ')}`);
  }
}

function checkUiSchema(loop) {
  loop.questions.forEach(question => {
    const prefix = `${question.id || 'missing-id'} (${question.type || 'missing-type'})`;

    if (!question.module_id) loop.failures.push(`${prefix}: missing module_id`);
    if (!question.child_instruction) loop.failures.push(`${prefix}: missing child_instruction`);

    if (['listen_pick_image', 'match_word_image'].includes(question.type)) {
      const options = Array.isArray(question.options) ? question.options : [];
      options.forEach(option => {
        if (!IMAGE_KEYS.has(option.image_key)) {
          loop.failures.push(`${prefix}: unknown image_key ${option.image_key}`);
        }
      });
    }

    if (['listen_pick_word', 'fill_blank', 'translate_pick', 'dialogue_complete', 'mixed_challenge'].includes(question.type)) {
      const correct = (question.options || []).filter(option => option?.is_correct === true);
      if (correct.length !== 1) loop.failures.push(`${prefix}: expected exactly one correct option, got ${correct.length}`);
    }

    if (question.type === 'spell_word' && (!Array.isArray(question.letter_pool) || question.letter_pool.length < 4)) {
      loop.failures.push(`${prefix}: invalid letter_pool`);
    }

    if (question.type === 'fill_blank') {
      const parts = question.sentence_parts || [];
      if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
        loop.failures.push(`${prefix}: invalid sentence_parts`);
      }
    }

    if (question.type === 'word_order') {
      if (!question.sentence || !Array.isArray(question.words) || question.words.length < 2) {
        loop.failures.push(`${prefix}: invalid word_order fields`);
      }
    }

    if (question.type === 'dialogue_complete') {
      const blanks = (question.dialogue || []).filter(line => line?.isBlank === true);
      if (blanks.length !== 1) loop.failures.push(`${prefix}: dialogue must have exactly one blank line`);
    }
  });
}

function checkTeacherAlignment(loop, testCase, opw2Words) {
  if (!RUN_REAL) {
    loop.warnings.push('teacher alignment skipped in mock mode');
    return;
  }

  const text = JSON.stringify(loop.questions).toLowerCase();
  const expectedHits = testCase.expected.filter(word => text.includes(word));
  if (expectedHits.length < Math.min(3, testCase.expected.length)) {
    loop.failures.push(`teacher targets underused: expected ${testCase.expected.join(', ')}, found ${expectedHits.join(', ') || 'none'}`);
  }

  const suspicious = extractEnglishWords(text)
    .filter(word => !COMMON_WORDS.has(word))
    .filter(word => !opw2Words.has(word))
    .filter(word => !testCase.expected.includes(word))
    .filter(word => !IMAGE_KEYS.has(word))
    .filter(word => word.length > 2);

  const uniqueSuspicious = [...new Set(suspicious)].slice(0, 12);
  if (uniqueSuspicious.length > 0) {
    loop.warnings.push(`words outside teacher/OPW2/common set: ${uniqueSuspicious.join(', ')}`);
  }
}

function checkNoOldStaticSet(loop, testCase) {
  if (!RUN_REAL) return;

  const text = JSON.stringify(loop.questions).toLowerCase();
  const oldWords = ['book', 'bag', 'pencil', 'cat', 'dog', 'fish'];
  const oldHits = oldWords.filter(word => text.includes(word));
  const expectedHits = testCase.expected.filter(word => text.includes(word));

  if (oldHits.length >= 5 && expectedHits.length < 2) {
    loop.failures.push(`looks like old static/demo set: ${oldHits.join(', ')}`);
  }
}

function flattenQuestions(data) {
  if (!Array.isArray(data.modules)) return [];
  return data.modules.flatMap(module => Array.isArray(module.items) ? module.items : []);
}

function countByType(questions) {
  const counts = {};
  config.questions.requiredTypes.forEach(type => {
    counts[type] = 0;
  });
  questions.forEach(question => {
    counts[question.type] = (counts[question.type] || 0) + 1;
  });
  return counts;
}

function getOpw2WordSet() {
  try {
    const data = loadOPW2();
    const words = new Set();
    data.vocabulary.forEach(item => words.add(item.word.toLowerCase()));
    Object.values(data.sightWordsByUnit || {}).flat().forEach(word => words.add(String(word).toLowerCase()));
    return words;
  } catch (error) {
    console.warn(`Could not load OPW2 for evaluator vocabulary check: ${error.message}`);
    return new Set();
  }
}

function extractEnglishWords(text) {
  return String(text).toLowerCase().match(/[a-z]+/g) || [];
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function printLoopSummary(loop) {
  console.log(`Loop ${loop.loop} ${loop.caseName}: ${loop.status} (${loop.questionCount || 0} questions, ${loop.elapsedSeconds}s)`);
  if (loop.failures.length > 0) {
    loop.failures.forEach(failure => console.log(`  FAIL: ${failure}`));
  }
  if (loop.warnings.length > 0) {
    loop.warnings.slice(0, 3).forEach(warning => console.log(`  WARN: ${warning}`));
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Generation Loop Report',
    '',
    `- Mode: ${report.mode}`,
    `- API: ${report.apiUrl}`,
    `- Minimum per type: ${report.minPerType}`,
    `- Overall: ${report.overall}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    '',
    '## Health',
    '',
    report.health?.ok ? '- Backend health: PASS' : `- Backend health: FAIL ${report.health?.error || ''}`,
    '',
    '## Loops',
    '',
  ];

  report.loops.forEach(loop => {
    lines.push(`### Loop ${loop.loop}: ${loop.caseName}`);
    lines.push('');
    lines.push(`- Status: ${loop.status}`);
    lines.push(`- Endpoint: ${loop.endpoint}`);
    lines.push(`- Questions: ${loop.questionCount || 0}`);
    lines.push(`- Modules: ${loop.moduleCount || 0}`);
    lines.push(`- Meta: ${JSON.stringify(loop.meta || {})}`);
    lines.push(`- Counts: ${JSON.stringify(loop.counts || {})}`);
    if (loop.failures.length > 0) {
      loop.failures.forEach(failure => lines.push(`- FAIL: ${failure}`));
    }
    if (loop.warnings.length > 0) {
      loop.warnings.forEach(warning => lines.push(`- WARN: ${warning}`));
    }
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function persistLatestReport(report) {
  const name = `generation-loop-${report.mode}-latest`;
  const partial = {
    ...report,
    finishedAt: new Date().toISOString(),
    overall: report.loops.every(loop => loop.status === 'PASS') ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(path.join(REPORT_DIR, `${name}.json`), JSON.stringify(partial, null, 2), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, `${name}.md`), renderMarkdown(partial), 'utf-8');
}

function numberArg(name, fallback) {
  const arg = process.argv.find(value => value.startsWith(`${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 1));
  return Number.isFinite(value) ? value : fallback;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
