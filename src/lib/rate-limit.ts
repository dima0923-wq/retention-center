/**
 * In-memory token bucket rate limiter.
 * Suitable for single-server deployment.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

// Cleanup old buckets every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const BUCKET_TTL = 10 * 60 * 1000; // 10 minutes

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > BUCKET_TTL) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Don't keep process alive just for cleanup
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export type RateLimitConfig = {
  maxTokens: number;  // Max requests in window
  refillRate: number; // Tokens per millisecond
  windowMs: number;   // Window in ms (for display only)
};

const AUTHENTICATED_LIMIT: RateLimitConfig = {
  maxTokens: 100,
  refillRate: 100 / 60000, // 100 per minute
  windowMs: 60000,
};

const UNAUTHENTICATED_LIMIT: RateLimitConfig = {
  maxTokens: 20,
  refillRate: 20 / 60000, // 20 per minute
  windowMs: 60000,
};

/**
 * Check if a request should be rate limited.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = AUTHENTICATED_LIMIT
): { allowed: true } | { allowed: false; retryAfter: number } {
  startCleanup();
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  // Calculate when next token will be available
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfterMs = tokensNeeded / config.refillRate;
  return { allowed: false, retryAfter: Math.ceil(retryAfterMs / 1000) };
}

/**
 * Get rate limit config based on authentication status.
 */
export function getRateLimitConfig(isAuthenticated: boolean): RateLimitConfig {
  return isAuthenticated ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;
}
