import { isValidTag, normalizeTag } from '@/lib/tags';

export const normalizeClanTagInput = (value: string | null | undefined) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const normalized = normalizeTag(trimmed) || trimmed;
  return normalized.startsWith('#') ? normalized.toUpperCase() : `#${normalized.toUpperCase()}`;
};

export const buildClanTagError = (value: string | null | undefined) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Enter a clan tag';
  const normalized = normalizeTag(trimmed) || trimmed;
  const tagged = normalized.startsWith('#') ? normalized : `#${normalized}`;
  if (!isValidTag(tagged)) {
    return 'Enter a valid clan tag (e.g., #2PR8R8V8P)';
  }
  return null;
};
