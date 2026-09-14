import { AppError } from "../errors";

/**
 * Fixed-window in-memory limiter.
 *
 * Deliberately dependency-free to hold the $100 infrastructure ceiling
 * (section 5) -- no Redis, no paid add-on. The tradeoff is real and worth
 * stating: limits are per serverless instance, so effective capacity scales
 * with instance count. It stops accidental floods and casual abuse, not a
 * distributed attack. Swap in a shared store before relying on it for the
 * latter; see docs/SECURITY.md.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    throw new AppError("RATE_LIMITED", {
      retryAfterMs: existing.resetAt - now,
    });
  }
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client identity for anonymous endpoints. */
export function clientKey(req: Request, prefix: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}
