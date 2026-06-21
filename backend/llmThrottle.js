import config from './config.js';

let queue = Promise.resolve();
let nextAllowedAt = 0;
let throttleReason = null;

export async function runWithLlmThrottle(label, operation) {
  const run = queue.catch(() => undefined).then(async () => {
    const waitMs = Math.max(0, nextAllowedAt - Date.now());
    if (waitMs > 0) {
      console.log(`LLM throttle: waiting ${Math.ceil(waitMs / 1000)}s before ${label}`);
      await sleep(waitMs);
    }

    throttleReason = null;
    nextAllowedAt = Date.now() + config.llm.minRequestIntervalMs;
    return operation();
  });

  queue = run.then(() => undefined, () => undefined);
  return run;
}

export function noteRateLimit(response, errorText = '') {
  const retryDelay = getRetryDelayMs(response, errorText);
  nextAllowedAt = Math.max(nextAllowedAt, Date.now() + retryDelay);
  throttleReason = 'rate_limit';
  return retryDelay;
}

export function getLlmThrottleStatus() {
  const waitMs = Math.max(0, nextAllowedAt - Date.now());
  return {
    waiting: waitMs > 0,
    waitMs,
    nextRetryAt: waitMs > 0 ? new Date(nextAllowedAt).toISOString() : null,
    reason: waitMs > 0 ? throttleReason || 'request_spacing' : null,
  };
}

export function getRetryDelayMs(response, errorText = '') {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  const minuteLimitMatch = String(errorText).match(/(\d+)\s*分钟/);
  if (minuteLimitMatch) {
    const minutes = Number(minuteLimitMatch[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      return Math.min(minutes * 60 * 1000, config.llm.rateLimitCooldownMs);
    }
  }

  return config.llm.rateLimitCooldownMs;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
