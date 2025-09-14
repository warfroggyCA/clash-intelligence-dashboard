// web-next/src/lib/tags.ts
// Centralized helpers for Clash of Clans tags

// Valid Clash tag characters come from official docs
export const CLASH_TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/i;

// Normalize a tag to canonical form: uppercase with leading '#'
export function normalizeTag(tag: string): string {
  const raw = String(tag || '').trim().toUpperCase();
  if (!raw) return '';
  const noHash = raw.replace(/^#+/, '');
  if (!noHash) return '';
  return `#${noHash}`;
}

// Validate a tag after normalization
export function isValidTag(tag: string): boolean {
  const t = normalizeTag(tag);
  return CLASH_TAG_RE.test(t);
}

// Create a filesystem-safe tag key (lowercase, no '#') for filenames/paths
export function safeTagForFilename(tag: string): string {
  const t = normalizeTag(tag);
  return t.replace('#', '').toLowerCase();
}

// Sanitize user input from text fields to a best-effort tag string
export function sanitizeInputTag(input: string): string {
  let v = String(input || '').trim().toUpperCase();
  v = v.replace(/[^A-Z0-9#]/g, '');
  // Ensure single leading '#'
  v = v.replace(/^#+/, '#');
  if (!v.startsWith('#')) v = `#${v}`;
  // Hard limit to prevent junk
  if (v.length > 15) v = v.slice(0, 15);
  return v;
}

