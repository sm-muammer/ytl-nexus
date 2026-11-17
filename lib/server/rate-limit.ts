import "server-only";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

export type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfter: number; resetAt: number };

/**
 * Checks a rate limit key against maximum requests within windowMs.
 * Thread-safe for single Node runtime with automatic pruning of stale entries.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = options.now ?? Date.now();
  const record = store.get(key);

  // If no record exists or window expired, create a fresh window
  if (!record || now >= record.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });

    // Periodic cleanup of expired records if map grows large
    if (store.size > 2000) {
      pruneStale(now);
    }

    return {
      ok: true,
      remaining: Math.max(0, options.maxRequests - 1),
      resetAt,
    };
  }

  // Window active: check if limit exceeded
  if (record.count >= options.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { ok: false, retryAfter, resetAt: record.resetAt };
  }

  record.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, options.maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

function pruneStale(now: number) {
  for (const [key, record] of store.entries()) {
    if (now >= record.resetAt) {
      store.delete(key);
    }
  }
}

/** Clear all rate limits (for testing purposes). */
export function clearRateLimits() {
  store.clear();
}

/** Build standard RFC 6585 429 response. */
export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: "rate-limited", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
