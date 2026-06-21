#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import config from './backend/config.js';
import { validateQuestions, summarizeQuestionTypes } from './backend/validators/index.js';

const API_URL = `http://${config.server.host}:${config.server.port}`;
const REPORT_DIR = path.join(process.cwd(), 'reports');
const CASE_TEXT = `混合复习已学自拼内容
加强拼读练习和词汇理解

综合复习前 4 单元
统一做题：教材练习p38，41


复习巩固歌曲
How much&How many

课后小练兵：
✅混合过往句型练习问答
加强名词可数 & 不可数的理解

✅26字母发音视频跟读跟写
听音频边读边写出对应字母

✅自然拼读学过的单元反复拼读及尝试拼写

✅How much&How many歌唱视频跟读跟唱`;

const EXPECTED_SIGNALS = ['how much', 'how many', 'letter', 'spell', 'read', 'question', 'answer'];
const BAD_DEMO_WORDS = ['book', 'bag', 'pencil', 'cat', 'dog', 'fish'];

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const backend = await startBackend();

  const response = await fetch(`${API_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: CASE_TEXT, difficulty: 'level_2', target_minutes: 20 }),
  });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    backend.kill();
    throw new Error(`Response was not JSON: ${error.message}; body=${text.slice(0, 500)}`);
  }

  const questions = flatten(data);
  const quality = evaluate(data, questions);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    status: response.status,
    meta: data.meta,
    questionCount: questions.length,
    moduleCount: data.modules?.length || 0,
    quality,
    sample: questions.slice(0, 12),
  };

  const out = path.join(REPORT_DIR, `quality-case-${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`status ${response.status}`);
  console.log(`mode ${data.meta?.mode}`);
  console.log(`modules ${report.moduleCount}`);
  console.log(`questions ${questions.length}`);
  console.log(`quality ${quality.pass ? 'PASS' : 'FAIL'}`);
  quality.failures.forEach(failure => console.log(`FAIL ${failure}`));
  quality.warnings.forEach(warning => console.log(`WARN ${warning}`));
  console.log(`report ${out}`);

  backend.kill();
  process.exit(quality.pass ? 0 : 1);
}

async function startBackend() {
  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', chunk => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[backend-err] ${chunk}`));

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return child;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  child.kill();
  throw new Error('Backend did not start.');
}

function flatten(data) {
  return Array.isArray(data.modules) ? data.modules.flatMap(module => module.items || []) : [];
}

function evaluate(data, questions) {
  const failures = [];
  const warnings = [];
  const validation = validateQuestions(questions);
  const summary = summarizeQuestionTypes(questions);
  const text = JSON.stringify(questions).toLowerCase();

  if (!validation.valid) failures.push(validation.errors.slice(0, 10).join(' | '));
  if ((data.modules?.length || 0) !== 12) failures.push(`expected 12 modules, got ${data.modules?.length || 0}`);
  if (questions.length < 60) failures.push(`expected at least 60 questions, got ${questions.length}`);
  if (summary.missingTypes.length > 0) failures.push(`missing types: ${summary.missingTypes.join(', ')}`);
  if (summary.insufficientTypes.length > 0) failures.push(`insufficient types: ${summary.insufficientTypes.join(', ')}`);

  const signalHits = EXPECTED_SIGNALS.filter(signal => text.includes(signal));
  if (signalHits.length < 5) failures.push(`teacher intent underrepresented: ${signalHits.join(', ')}`);

  const demoHits = BAD_DEMO_WORDS.filter(word => text.includes(word));
  if (demoHits.length >= 5 && !text.includes('how much') && !text.includes('how many')) {
    failures.push(`looks like generic demo words: ${demoHits.join(', ')}`);
  } else if (demoHits.length >= 5) {
    warnings.push(`generic words still present: ${demoHits.join(', ')}`);
  }

  const letters = questions.filter(question => question.type === 'letter_sound_trace').map(question => question.letter);
  if (letters.length < config.questions.minPerType) failures.push('not enough letter trace questions');

  const howQuestions = questions.filter(question => JSON.stringify(question).toLowerCase().includes('how much') || JSON.stringify(question).toLowerCase().includes('how many'));
  if (howQuestions.length < 5) failures.push(`expected at least 5 How much/How many items, got ${howQuestions.length}`);

  return {
    pass: failures.length === 0,
    failures,
    warnings,
    counts: summary.counts,
    signalHits,
    demoHits,
    howQuestionCount: howQuestions.length,
    letters,
  };
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
