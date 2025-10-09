# inbound-rate-limit.ts

Simple inbound rate limiter with Upstash Redis support and in-memory fallback.

## Types
- `RateLimitOptions = { windowMs?: number; max?: number }`

## Exports
- `rateLimitAllow(key: string, opts?: RateLimitOptions)` → `{ ok, remaining, resetAt }`
- `formatRateLimitHeaders(result, max)` → standard `X-RateLimit-*` and `Retry-After`

## Example

```ts
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';

const limit = await rateLimitAllow(`route:${ip}`, { windowMs: 60_000, max: 60 });
if (!limit.ok) {
  return NextResponse.json({ success: false, error: 'Too many requests' }, {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      ...formatRateLimitHeaders(limit, 60)
    }
  });
}
```
