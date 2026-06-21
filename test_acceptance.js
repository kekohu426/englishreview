#!/usr/bin/env node

import { spawn } from 'child_process';
import config from './backend/config.js';
import { generateMockQuestions } from './backend/generators/mock.js';
import { validateQuestions, summarizeQuestionTypes } from './backend/validators/index.js';

const TEST_PORT = Number(process.env.ACCEPTANCE_PORT || 5500);
const API_URL = `http://${config.server.host}:${TEST_PORT}`;
const RUN_REAL = process.argv.includes('--real') || process.env.ACCEPTANCE_REAL === 'true';
const FULL_ACCEPTANCE = process.argv.includes('--full') || process.env.ACCEPTANCE_FULL === 'true';
const MIN_PER_TYPE = FULL_ACCEPTANCE ? 5 : config.questions.minPerType;

const SAMPLE_INPUT = `Unit 3: hen, pen, red
Practice listening, spelling, reading aloud, and simple sentences.`;

const results = [];

async function main() {
  const managedServer = await ensureBackendServer();

  console.log('English Review App Acceptance Check');
  console.log('='.repeat(44));
  console.log(`Target: ${API_URL}`);
  console.log(`Real LLM check: ${RUN_REAL ? 'enabled' : 'skipped (use --real to enable)'}`);
  console.log(`Minimum per type: ${MIN_PER_TYPE}`);
  console.log('');

  await checkHealth();
  checkMockGeneration();
  await checkAnalysisRequired();

  if (RUN_REAL) {
    await checkRealGeneration();
  } else {
    addResult('Real LLM Generation', 'SKIP', 'Run node test_acceptance.js --real to call the live LLM API.');
  }

  printSummary();

  const failed = results.some(result => result.status === 'FAIL');
  if (managedServer) managedServer.kill();
  process.exit(failed ? 1 : 0);
}

async function ensureBackendServer() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, 1500);
    if (response.ok) {
      const data = await response.json();
      if (isExpectedBackendConfig(data)) return null;
    }
  } catch {
    // Start a temporary backend for this acceptance run.
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

async function checkHealth() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, 5000);
    if (!response.ok) {
      addResult('Backend Health', 'FAIL', `/health returned ${response.status}`);
      addResult('OPW2 Loaded', 'FAIL', 'Backend health check failed.');
      return;
    }

    const data = await response.json();
    if (data.status !== 'ok') {
      addResult('Backend Health', 'FAIL', `/health status was ${data.status}`);
      addResult('OPW2 Loaded', 'FAIL', 'Backend is not healthy.');
      return;
    }

    addResult('Backend Health', 'PASS', `${data.config?.llm || 'unknown'} / ${data.config?.model || 'unknown'}`);
    addResult('OPW2 Loaded', 'PASS', 'Server startup completed and health endpoint is available.');
    if (RUN_REAL && data.config?.stage2UseLLM !== true) {
      addResult('Stage2 API Enabled', 'FAIL', `Expected stage2UseLLM=true, got ${data.config?.stage2UseLLM}`);
    } else if (RUN_REAL) {
      addResult('Stage2 API Enabled', 'PASS', 'stage2UseLLM=true');
    }
  } catch (error) {
    addResult('Backend Health', 'FAIL', error.message);
    addResult('OPW2 Loaded', 'FAIL', 'Could not confirm OPW2 because backend is unavailable.');
  }
}

function checkMockGeneration() {
  try {
    const questions = generateMockQuestions(SAMPLE_INPUT, MIN_PER_TYPE);
    const validation = validateQuestions(questions);
    const typeSummary = summarizeQuestionTypesForMinimum(questions, MIN_PER_TYPE);

    if (!validation.valid) {
      addResult('Mock Generation', 'FAIL', validation.errors.join(' | '));
      addResult('Validation', 'FAIL', 'Mock data failed validator.');
      return;
    }

    if (typeSummary.missingTypes.length > 0) {
      addResult('Mock Generation', 'FAIL', `missing type ${typeSummary.missingTypes.join(', ')}`);
      return;
    }

    if (typeSummary.insufficientTypes.length > 0) {
      addResult('Mock Generation', 'FAIL', `insufficient type ${typeSummary.insufficientTypes.join(', ')}`);
      return;
    }

    addResult('Mock Generation', 'PASS', `${questions.length} questions generated locally.`);
    addResult('Validation', 'PASS', 'Mock questions satisfy validator requirements.');
  } catch (error) {
    addResult('Mock Generation', 'FAIL', error.message);
  }
}

async function checkRealGeneration() {
  const started = Date.now();

  try {
    const analysisResponse = await fetchWithTimeout(`${API_URL}/api/analyze-homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: SAMPLE_INPUT }),
    }, 60000);
    const analysisData = await analysisResponse.json();
    if (!analysisResponse.ok || !analysisData.analysis) {
      addResult('Homework Analysis', 'FAIL', `API ${analysisResponse.status}: ${JSON.stringify(analysisData).slice(0, 300)}`);
      return;
    }
    addResult('Homework Analysis', 'PASS', `${analysisData.analysis.words?.length || 0} words, ${analysisData.analysis.phonics_points?.length || 0} phonics points`);

    const response = await fetchWithTimeout(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: SAMPLE_INPUT,
        difficulty: 'level_1',
        target_minutes: 5,
        confirmed_analysis: analysisData.analysis,
      }),
    }, FULL_ACCEPTANCE ? 20 * 60 * 1000 : 6 * 60 * 1000);

    if (!response.ok) {
      const errorText = await response.text();
      addResult('Real LLM Generation', 'FAIL', `API ${response.status}: ${errorText}`);
      return;
    }

    const data = await response.json();
    const questions = flattenQuestions(data);
    const validation = validateQuestions(questions);
    const typeSummary = summarizeQuestionTypesForMinimum(questions, MIN_PER_TYPE);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const mode = data.meta?.mode || 'unknown';

    if (!Array.isArray(data.modules) || data.modules.length === 0) {
      addResult('Real LLM Generation', 'FAIL', 'Response is missing modules.');
      return;
    }
    if (!mode.startsWith('llm_full')) {
      addResult('Stage2 API Path', 'FAIL', `Expected llm_full mode, got ${mode}`);
    } else {
      addResult('Stage2 API Path', 'PASS', mode);
    }

    if (typeSummary.missingTypes.length > 0) {
      addResult('Question Type Coverage', 'FAIL', `missing type ${typeSummary.missingTypes.join(', ')}`);
    } else {
      addResult('Question Type Coverage', 'PASS', `${typeSummary.coveredTypes}/${typeSummary.totalTypes}`);
    }

    if (typeSummary.insufficientTypes.length > 0) {
      addResult('Minimum Per Type', 'FAIL', `insufficient type ${typeSummary.insufficientTypes.join(', ')}`);
    } else {
      addResult('Minimum Per Type', 'PASS', `minimum ${MIN_PER_TYPE} per type met`);
    }

    if (!validation.valid) {
      addResult('Validation', 'FAIL', validation.errors.join(' | '));
    } else {
      addResult('Validation', 'PASS', 'Real questions satisfy validator requirements.');
    }

    const realFailed = ['Stage2 API Path', 'Question Type Coverage', 'Minimum Per Type', 'Validation']
      .some(name => latestStatus(name) === 'FAIL');

    addResult(
      'Real LLM Generation',
      realFailed ? 'FAIL' : 'PASS',
      `${questions.length} questions in ${elapsed}s; mode=${mode}`
    );
  } catch (error) {
    addResult('Real LLM Generation', 'FAIL', error.message);
  }
}

async function checkAnalysisRequired() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: SAMPLE_INPUT,
        difficulty: 'level_1',
        target_minutes: 5,
      }),
    }, 60000);
    const data = await response.json();
    if (response.status === 409 && data.status === 'analysis_required' && data.analysis) {
      addResult('Confirmed Analysis Gate', 'PASS', 'Generate requires analysis confirmation.');
    } else {
      addResult('Confirmed Analysis Gate', 'FAIL', `Expected 409 analysis_required, got ${response.status}`);
    }
  } catch (error) {
    addResult('Confirmed Analysis Gate', 'FAIL', error.message);
  }
}

function flattenQuestions(data) {
  if (!Array.isArray(data.modules)) return [];
  return data.modules.flatMap(module => Array.isArray(module.items) ? module.items : []);
}

function summarizeQuestionTypesForMinimum(questions, minimum) {
  const summary = summarizeQuestionTypes(questions);
  return {
    ...summary,
    insufficientTypes: config.questions.requiredTypes.filter(type => (summary.counts[type] || 0) < minimum),
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function addResult(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`${name}: ${status}${detail ? ` - ${detail}` : ''}`);
}

function latestStatus(name) {
  const result = [...results].reverse().find(item => item.name === name);
  return result?.status;
}

function printSummary() {
  const failed = results.filter(result => result.status === 'FAIL');
  const skipped = results.filter(result => result.status === 'SKIP');

  console.log('');
  console.log('Acceptance Summary');
  console.log('='.repeat(44));

  if (failed.length === 0) {
    console.log(`Overall: PASS${skipped.length > 0 ? ' (with skipped checks)' : ''}`);
  } else {
    console.log('Overall: FAIL');
    failed.forEach(result => {
      console.log(`FAIL: ${result.name} - ${result.detail}`);
    });
  }
}

main().catch(error => {
  console.error('Acceptance runner crashed:', error);
  process.exit(1);
});
