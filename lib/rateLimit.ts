/**
 * Rate Limiter for Resume Parsing API
 *
 * Supports shared distributed storage via Upstash Redis or Vercel KV REST APIs
 * when environment variables are provided:
 *   - UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *   - KV_REST_API_URL and KV_REST_API_TOKEN
 *
 * Falls back to an in-memory sliding window rate limiter for local development.
 */

export const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
export const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;
export const DEFAULT_RATE_LIMIT_MAX = 10; // 10 parses per hour per IP in dev/normal
export const PRODUCTION_FALLBACK_STRICT_LIMIT = 3; // Stricter in-memory limit in production when shared store is missing

export function hasSharedRateLimitStore(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

let hasLoggedStartupWarning = false;

export function warnIfSharedStoreMissingInProduction(): void {
  if (process.env.NODE_ENV === 'production' && !hasSharedRateLimitStore() && !hasLoggedStartupWarning) {
    hasLoggedStartupWarning = true;
    console.warn(
      '[RATE_LIMIT_WARNING] Shared rate-limit store environment variables (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN) are missing in production. ' +
      `Applying stricter in-memory rate limit (${PRODUCTION_FALLBACK_STRICT_LIMIT} requests per hour).`
    );
  }
}

// Log warning at module startup in production
warnIfSharedStoreMissingInProduction();

export function getEffectiveRateLimitMax(): number {
  if (process.env.NODE_ENV === 'production' && !hasSharedRateLimitStore()) {
    return PRODUCTION_FALLBACK_STRICT_LIMIT;
  }
  return DEFAULT_RATE_LIMIT_MAX;
}

// Local dev fallback: In-memory sliding window rate limiter
const ipRequestTimestamps = new Map<string, number[]>();

export function resetInMemoryRateLimit(): void {
  ipRequestTimestamps.clear();
}

export function checkInMemoryRateLimit(ip: string): boolean {
  warnIfSharedStoreMissingInProduction();
  const maxAllowed = getEffectiveRateLimitMax();
  const now = Date.now();
  const timestamps = ipRequestTimestamps.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= maxAllowed) {
    ipRequestTimestamps.set(ip, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  ipRequestTimestamps.set(ip, validTimestamps);
  return true;
}

/**
 * Extracts the platform's trusted client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  return '127.0.0.1';
}

/**
 * Checks whether an IP has exceeded the rate limit (10 parses / hour).
 * Uses Upstash Redis / Vercel KV REST if env vars are present; falls back to in-memory.
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const sanitizedIp = encodeURIComponent(ip);
      const key = `ratelimit:resume:${sanitizedIp}`;
      const baseUrl = redisUrl.replace(/\/+$/, '');

      // Execute INCR via Upstash / Vercel KV REST API
      const incrRes = await fetch(`${baseUrl}/incr/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (incrRes.ok) {
        const data = await incrRes.json();
        const count = typeof data.result === 'number' ? data.result : parseInt(data.result, 10);

        // First hit: set TTL
        if (count === 1) {
          fetch(`${baseUrl}/expire/${key}/${RATE_LIMIT_WINDOW_SECONDS}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${redisToken}` }
          }).catch(() => {
            // Non-critical background TTL expiration
          });
        }

        if (count > DEFAULT_RATE_LIMIT_MAX) {
          return false;
        }
        return true;
      }
    } catch (redisErr) {
      console.warn('Redis rate limit check failed, falling back to in-memory limiter:', redisErr);
      return checkInMemoryRateLimit(ip);
    }
  }

  // Fallback to in-memory rate limiter for local development
  return checkInMemoryRateLimit(ip);
}
