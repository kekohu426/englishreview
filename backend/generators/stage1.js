import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { formatForPrompt } from '../knowledge/opw2_loader.js';
import { buildPhonicsScope, formatPhonicsForPrompt } from '../knowledge/phonics_loader.js';
import { noteRateLimit, runWithLlmThrottle } from '../llmThrottle.js';
import { buildFallbackStage1Plan } from './stage1Fallback.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generateStage1Plan(teacherText, difficulty = 'level_2', targetMinutes = 20, options = {}) {
  console.log('Stage1: generating exercise plan...');

  const promptPath = path.join(__dirname, '../../prompts/stage1_balanced.md');
  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  const phonicsScope = options.phonicsScope || buildPhonicsScope(options.requirements || {}, options.confirmedAnalysis);
  const prompt = promptTemplate
    .replace('{{OPW2_KB}}', formatForPrompt())
    .replace('{{PHONICS_KB}}', formatPhonicsForPrompt(phonicsScope))
    .replace('{{CONFIRMED_ANALYSIS}}', JSON.stringify(options.confirmedAnalysis || {}, null, 2))
    .replace('{{QUESTION_TYPES}}', config.questions.requiredTypes.map((type, index) => `${index + 1}. \`${type}\``).join('\n'))
    .replace('{{MIN_PER_TYPE}}', String(config.questions.minPerType))
    .replace('{{level}}', difficulty)
    .replace('{{minutes}}', targetMinutes)
    .replace('{{teacherText}}', teacherText);

  const response = await callLLM(prompt);
  const debugPath = path.join(__dirname, '../../debug_stage1_response.txt');
  fs.writeFileSync(debugPath, response, 'utf-8');
  console.log(`Stage1 raw response saved: ${debugPath}`);

  const cleaned = cleanJsonResponse(response);

  let plan;
  try {
    plan = JSON.parse(cleaned);
  } catch (error) {
    console.error('Stage1 JSON parse failed:', error.message);
    console.error('Raw response:', response.substring(0, 500));
    console.warn('Stage1 falling back to local safe plan.');
    return buildFallbackStage1Plan(teacherText, options);
  }

  if (!Array.isArray(plan.knowledge_points)) {
    console.warn('Stage1 missing knowledge_points; falling back to local safe plan.');
    return buildFallbackStage1Plan(teacherText, options);
  }
  if (!Array.isArray(plan.task_list)) {
    console.warn('Stage1 missing task_list; falling back to local safe plan.');
    return buildFallbackStage1Plan(teacherText, options);
  }

  console.log(`Stage1 complete: ${plan.task_list.length} tasks, ${plan.knowledge_points.length} knowledge points`);
  return plan;
}

function cleanJsonResponse(response) {
  const cleaned = String(response)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1).trim();
  }
  return cleaned;
}

async function callLLM(prompt) {
  const { llm } = config;

  let url;
  let headers;
  let payload;

  if (llm.provider === 'openai') {
    url = joinApiUrl(llm.baseUrl, 'chat/completions');
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    };
    payload = {
      model: llm.model,
      max_tokens: llm.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
  } else {
    url = joinApiUrl(llm.baseUrl, 'messages');
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': llm.apiKey,
      'anthropic-version': '2023-06-01',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    payload = {
      model: llm.model,
      max_tokens: llm.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'disabled' },
    };
  }

  console.log(`Calling LLM: ${url}`);
  console.log(`Model: ${llm.model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), llm.timeoutMs);

  try {
    const response = await fetchWithRetries(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (llm.provider === 'openai') {
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } else {
      const textBlock = data.content?.find(block => block.type === 'text');
      if (textBlock?.text) return textBlock.text;
    }

    throw new Error('LLM response does not contain text content');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`LLM timeout after ${llm.timeoutMs}ms`);
    }
    throw error;
  }
}

async function fetchWithRetries(url, options, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await runWithLlmThrottle('stage1', () => fetch(url, options));
      if (response.ok) return response;

      const errorText = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`LLM API error: ${response.status} ${errorText}`);

      if (!retryable || attempt === maxAttempts) {
        throw lastError;
      }

      const delay = response.status === 429 ? noteRateLimit(response, errorText) : 1500 * attempt;
      console.warn(`LLM call failed with ${response.status}; retrying in ${Math.ceil(delay / 1000)}s (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' || !isRetryableError(error) || attempt === maxAttempts) throw error;
      const delay = 1500 * attempt;
      console.warn(`LLM call error: ${error.message}; retrying in ${delay}ms (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  const message = String(error?.message || '');
  return message.includes('LLM API error: 429') || /LLM API error: 5\d\d/.test(message) || !message.includes('LLM API error: 4');
}

function joinApiUrl(baseUrl, suffix) {
  return `${String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '')}/v1/${suffix}`;
}

export default {
  generateStage1Plan,
};
