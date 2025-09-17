// web-next/src/lib/smart-insights-cache.ts
// Local storage helpers for Smart Insights payloads

import { normalizeTag, safeTagForFilename } from '@/lib/tags';
import type { SmartInsightsPayload } from './smart-insights';

const STORAGE_PREFIX = 'smart_insights_payload_';

export function makeSmartInsightsStorageKey(clanTag: string): string {
  const normalized = normalizeTag(clanTag);
  const safeKey = safeTagForFilename(normalized || clanTag || 'unknown');
  return `${STORAGE_PREFIX}${safeKey}`;
}

export function saveSmartInsightsPayload(clanTag: string, payload: SmartInsightsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const key = makeSmartInsightsStorageKey(clanTag || payload.metadata.clanTag);
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error('[SmartInsightsCache] Failed to persist payload:', error);
  }
}

export function loadSmartInsightsPayload(clanTag: string): SmartInsightsPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = makeSmartInsightsStorageKey(clanTag);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SmartInsightsPayload;
  } catch (error) {
    console.error('[SmartInsightsCache] Failed to load cached payload:', error);
    return null;
  }
}

export function clearSmartInsightsPayload(clanTag: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = makeSmartInsightsStorageKey(clanTag);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[SmartInsightsCache] Failed to clear cached payload:', error);
  }
}
