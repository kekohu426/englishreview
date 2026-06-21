#!/usr/bin/env node

import { spawn } from 'child_process';
import config from './backend/config.js';

const TEST_PORT = Number(process.env.PROGRESSIVE_PORT || 5502);
const API_URL = `http://${config.server.host}:${TEST_PORT}`;
const CASE_TEXT = 'Review OPW2 Unit 3 hen pen bed red. Practice phonics, spelling, reading aloud, How many and How much.';
let backend = null;

try {
  await ensureBackend();
  const response = await fetch(`${API_URL}/api/generate-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: CASE_TEXT, difficulty: 'level_2', target_minutes: 20 }),
  });
  const data = await readJson(response);
  assert(response.status === 409, `expected 409 from /api/generate-progress without analysis, got ${response.status}`);
  assert(data.status === 'analysis_required', `expected analysis_required, got ${data.status}`);
  assert(data.analysis?.words?.length > 0, 'analysis response should include words');
  assert(data.analysis?.phonics_points?.length > 0, 'analysis response should include phonics points');
  console.log('Progressive Analysis Gate: PASS');
  process.exit(0);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
} finally {
  if (backend) backend.kill();
}

async function ensureBackend() {
  if (await healthOk()) return;
  backend = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(TEST_PORT) },
  });
  backend.stdout.on('data', chunk => process.stdout.write(`[backend] ${chunk}`));
  backend.stderr.on('data', chunk => process.stderr.write(`[backend-err] ${chunk}`));

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await healthOk()) return;
    await sleep(500);
  }
  throw new Error('/health unavailable');
}

async function healthOk() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`invalid JSON from ${response.url}: ${text.slice(0, 300)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
