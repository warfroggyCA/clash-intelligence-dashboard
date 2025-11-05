# tags.ts

Utilities for Clash of Clans player/clan tags.

## Exports

- `normalizeTag(tag: string): string`
- `isValidTag(tag: string): boolean`
- `safeTagForFilename(tag: string): string`
- `sanitizeInputTag(input: string): string`

## Examples

```ts
import { normalizeTag, isValidTag, safeTagForFilename, sanitizeInputTag } from '@/lib/tags';

const raw = ' 2pr8r8v8p ';
const input = sanitizeInputTag(raw); // '#2PR8R8V8P'
const tag = normalizeTag(input); // '#2PR8R8V8P'
if (isValidTag(tag)) {
  const key = safeTagForFilename(tag); // '2pr8r8v8p'
}
```
