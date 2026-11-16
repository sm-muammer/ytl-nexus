export const AI_LIMITS = {
  MAX_PROMPT_CHARS: 2000,
  MAX_RESPONSE_TOKENS: 512,
  RATE_LIMIT_PER_WINDOW: 10,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  MAX_CONCURRENT_GENERATIONS: 2, // Bound CPU load on 8-core host
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const ipRateLimits = new Map<string, RateLimitRecord>();
let activeSlots = 0;

/**
 * Checks prompt length and per-IP/user rate limit.
 */
export function checkAiLimits(params: {
  prompt: string;
  ip: string;
  now?: () => number;
}): { ok: true } | { ok: false; error: "prompt-too-long" | "rate-limited" } {
  if (params.prompt.length > AI_LIMITS.MAX_PROMPT_CHARS) {
    return { ok: false, error: "prompt-too-long" };
  }

  const now = params.now ? params.now() : Date.now();
  let record = ipRateLimits.get(params.ip);

  if (!record || now >= record.resetAt) {
    record = { count: 1, resetAt: now + AI_LIMITS.RATE_LIMIT_WINDOW_MS };
    ipRateLimits.set(params.ip, record);
    return { ok: true };
  }

  if (record.count >= AI_LIMITS.RATE_LIMIT_PER_WINDOW) {
    return { ok: false, error: "rate-limited" };
  }

  record.count += 1;
  return { ok: true };
}

/**
 * Checks if a concurrent slot is available.
 */
export function checkConcurrentSlots(): boolean {
  return activeSlots < AI_LIMITS.MAX_CONCURRENT_GENERATIONS;
}

/**
 * Acquires a generation slot. Returns true if acquired, false if busy.
 */
export function acquireSlot(): boolean {
  if (activeSlots >= AI_LIMITS.MAX_CONCURRENT_GENERATIONS) {
    return false;
  }
  activeSlots += 1;
  return true;
}

/**
 * Releases an acquired generation slot.
 */
export function releaseSlot(): void {
  activeSlots = Math.max(0, activeSlots - 1);
}
