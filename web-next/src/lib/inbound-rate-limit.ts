// Inbound rate limiter with Upstash Redis fallback to in-memory.

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export type RateLimitOptions = {
  windowMs?: number;
  max?: number;
};

const DEFAULTS: Required<RateLimitOptions> = { windowMs: 60_000, max: 30 };

let upstashReady = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
let ratelimit: any | null = null;
let upstashMax = 0;

async function getRedisLimiter(max: number, windowMs: number) {
  if (!upstashReady) return null;
  if (ratelimit && upstashMax === max) return ratelimit;
  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    ratelimit = new Ratelimit({
      redis,
      // Upstash Duration expects a string like "1000 ms" | "60 s"
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms` as any),
      prefix: 'rate-limit',
    });
    upstashMax = max;
    return ratelimit;
  } catch (e) {
    upstashReady = false;
    return null;
  }
}

export async function rateLimitAllow(key: string, opts: RateLimitOptions = {}) {
  const { windowMs, max } = { ...DEFAULTS, ...opts };

  const rl = await getRedisLimiter(max, windowMs);
  if (rl) {
    const { success, reset } = await rl.limit(key);
    const resetAt = (reset ? Number(reset) * 1000 : Date.now() + windowMs);
    const remaining = success ? Math.max(0, max - 1) : 0; // Upstash exposes remaining via headers; approximate here
    return { ok: success, remaining, resetAt };
  }

  // In-memory fallback (single instance only)
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (existing.count < max) {
    existing.count += 1;
    return { ok: true, remaining: max - existing.count, resetAt: existing.resetAt };
  }
  return { ok: false, remaining: 0, resetAt: existing.resetAt };
}

export function formatRateLimitHeaders(result: { remaining: number; resetAt: number }, max: number) {
  const retryAfter = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
  return {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(retryAfter),
  } as Record<string, string>;
}
