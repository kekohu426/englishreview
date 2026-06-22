import { config as loadDotEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { REQUIRED_QUESTION_TYPES } from './questionTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledKnowledgeDir = join(__dirname, 'knowledge/data');
loadDotEnv({ path: join(__dirname, '../.env') });

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function listEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function isNodeTest() {
  return process.env.NODE_TEST_CONTEXT === 'child-v8' || process.argv.some(arg => arg.includes('node:test'));
}

export default {
  llm: {
    provider: process.env.LLM_PROVIDER || 'claude',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || 'https://muyuan.do',
    model: process.env.LLM_MODEL || 'claude-opus-4-8',
    timeoutMs: numberEnv('LLM_TIMEOUT_MS', 300000),
    maxTokens: numberEnv('LLM_MAX_TOKENS', 12000),
    minRequestIntervalMs: numberEnv('LLM_MIN_REQUEST_INTERVAL_MS', 15000),
    rateLimitCooldownMs: numberEnv('LLM_RATE_LIMIT_COOLDOWN_MS', 90000),
  },

  server: {
    port: numberEnv('PORT', 5000),
    host: process.env.HOST || '0.0.0.0',
  },

  features: {
    mockGeneration: booleanEnv('MOCK_GENERATION', false),
  },

  opw2: {
    path: process.env.OPW2_KB_PATH || join(bundledKnowledgeDir, 'bigfun2_program_knowledge.json'),
  },

  phonics: {
    path: process.env.PHONICS_KB_PATH || join(bundledKnowledgeDir, 'phonics_opw2_program_knowledge.json'),
  },

  questions: {
    minPerType: numberEnv('MIN_QUESTIONS_PER_TYPE', 5),
    maxTasks: numberEnv('MAX_GENERATION_TASKS', 0),
    requiredTypes: REQUIRED_QUESTION_TYPES,
  },

  stage2: {
    batchSize: numberEnv('STAGE2_BATCH_SIZE', 1),
    delayMs: numberEnv('STAGE2_DELAY_MS', 4000),
    useLLM: booleanEnv('LLM_STAGE2', true),
    mode: isNodeTest() ? 'local' : (process.env.STAGE2_MODE || (booleanEnv('LLM_STAGE2', true) ? 'full_llm' : 'local')),
    aiTypes: listEnv('STAGE2_AI_TYPES', [
      'read_aloud',
      'word_order',
      'translate_pick',
      'dialogue_complete',
      'mixed_challenge',
    ]),
    progressDelayMs: numberEnv('STAGE2_PROGRESS_DELAY_MS', 12000),
  },
};
