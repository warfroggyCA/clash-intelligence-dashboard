# Library Functions Reference

Public utilities, helpers, and services exported from `web-next/src/lib`.

- See individual files for details. This index links to focused references.

## Core helpers
- `tags` — normalize and validate Clash tags
- `inbound-rate-limit` — lightweight rate limiter and headers
- `war-metrics` — compute war performance, alerts
- `snapshots` — change detection and storage
- `full-snapshot` — fetch/persist full clan snapshots
- `insights-storage` — persist/load insights bundles and DNA cache
- `export-utils` — CSV/Discord formatting and downloads

## API helpers
- `api/route-helpers.ts` — `createApiContext(req, route)` for logging and JSON helper

## Supabase
- `supabase-server`, `supabase-admin`, `supabase`

## Usage examples

```ts
import { normalizeTag, isValidTag } from '@/lib/tags';

const tag = normalizeTag('#2pr8r8v8p');
if (!isValidTag(tag)) throw new Error('Bad tag');
```

```ts
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';

const result = await rateLimitAllow(`key:${ip}`, { windowMs: 60_000, max: 60 });
if (!result.ok) {
  const headers = formatRateLimitHeaders(result, 60);
  // return 429 with headers
}
```
