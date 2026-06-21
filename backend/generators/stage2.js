import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { noteRateLimit, runWithLlmThrottle } from '../llmThrottle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generateStage2Questions(taskList) {
  console.log(`Stage2: generating ${taskList.length} questions...`);

  const promptPath = path.join(__dirname, '../../prompts/stage2.md');
  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  const batchSize = Math.max(1, config.stage2.batchSize);
  const results = [];

  for (let i = 0; i < taskList.length; i += batchSize) {
    const batch = taskList.slice(i, i + batchSize);
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: questions ${i + 1}-${Math.min(i + batchSize, taskList.length)}`);

    try {
      const batchResults = batch.length === 1
        ? [await generateSingleQuestion(batch[0], promptTemplate)]
        : await generateQuestionBatch(batch, promptTemplate);
      results.push(...batchResults);
    } catch (error) {
      console.error('Batch generation failed:', error.message);
      if (batch.length > 1 && !isNonRetryableApiError(error) && !isRateLimitError(error)) {
        console.warn('Falling back to sequential single-question generation for this batch.');
        for (const task of batch) {
          results.push(await generateSingleQuestion(task, promptTemplate));
        }
      } else {
        throw error;
      }
    }

    if (i + batchSize < taskList.length && config.stage2.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, config.stage2.delayMs));
    }
  }

  console.log(`Stage2 complete: generated ${results.length} questions.`);
  return results;
}

function isNonRetryableApiError(error) {
  const message = String(error?.message || '');
  return message.includes('LLM API error: 401')
    || message.includes('LLM API error: 403')
    || message.includes('API_KEY_DISABLED')
    || message.includes('INVALID_API_KEY');
}

function isRateLimitError(error) {
  return String(error?.message || '').includes('LLM API error: 429');
}

async function generateSingleQuestion(task, promptTemplate) {
  const prompt = promptTemplate.replace('{{taskJson}}', JSON.stringify(task, null, 2));
  const response = await callLLM(prompt);
  const cleaned = cleanJsonResponse(response);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(`Stage2 JSON parse failed for task ${task.task_id}:`, error.message);
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Stage2 failed to parse JSON for task ${task.task_id}`);
  }
}

async function generateQuestionBatch(tasks, promptTemplate) {
  const prompt = buildBatchPrompt(tasks, promptTemplate);
  const response = await callLLM(prompt);
  const cleaned = cleanJsonResponse(response);

  try {
    const parsed = JSON.parse(cleaned);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions)) {
      throw new Error('batch response must be an array or { questions: [] }');
    }
    if (questions.length !== tasks.length) {
      console.warn(`Batch returned ${questions.length} questions for ${tasks.length} tasks.`);
    }
    return questions;
  } catch (error) {
    console.error('Stage2 batch JSON parse failed:', error.message);
    console.error('Cleaned response:', cleaned.substring(0, 500));
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Stage2 failed to parse batch JSON for tasks ${tasks.map(task => task.task_id).join(', ')}`);
  }
}

function buildBatchPrompt(tasks, promptTemplate) {
  return `${promptTemplate}

IMPORTANT BATCH OVERRIDE:
The input below is an array of tasks, not a single task.
Generate exactly one complete question object for each task.
Return ONLY valid JSON in this exact shape:
[
  { "id": "same_as_task_id", "type": "same_as_question_type", "...": "required fields" }
]
No markdown fences. No prose. No trailing comments.

Task array:
${JSON.stringify(tasks, null, 2)}
`;
}

function cleanJsonResponse(response) {
  const cleaned = String(response)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstArray = cleaned.indexOf('[');
  const firstObject = cleaned.indexOf('{');

  if (firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)) {
    const lastArray = cleaned.lastIndexOf(']');
    if (lastArray > firstArray) {
      return cleaned.substring(firstArray, lastArray + 1).trim();
    }
  }

  if (firstObject !== -1) {
    const lastObject = cleaned.lastIndexOf('}');
    if (lastObject > firstObject) {
      return cleaned.substring(firstObject, lastObject + 1).trim();
    }
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

function joinApiUrl(baseUrl, suffix) {
  return `${String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '')}/v1/${suffix}`;
}

async function fetchWithRetries(url, options, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await runWithLlmThrottle('stage2', () => fetch(url, options));
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

export default {
  generateStage2Questions,
};
