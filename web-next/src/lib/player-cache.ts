import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { safeTagForFilename } from './tags';

interface CachedPlayerDetail {
  fetchedAt: string;
  detail: any;
}

const PLAYER_CACHE_DIR = path.join(process.cwd(), cfg.dataRoot, 'player-cache');
// Default TTL: 6 hours
const DEFAULT_PLAYER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function ensureCacheDir(): Promise<void> {
  try {
    await fsp.mkdir(PLAYER_CACHE_DIR, { recursive: true });
  } catch (error) {
    // ignore race condition errors
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function loadPlayerDetailFromCache(tag: string): Promise<any | null> {
  if (!cfg.useLocalData) {
    return null;
  }

  try {
    await ensureCacheDir();
    const safeTag = safeTagForFilename(tag);
    const cachePath = path.join(PLAYER_CACHE_DIR, `${safeTag}.json`);
    const raw = await fsp.readFile(cachePath, 'utf-8');
    const cached: CachedPlayerDetail = JSON.parse(raw);
    if (!cached?.fetchedAt || !cached?.detail) {
      return null;
    }

    const ttl = getPlayerCacheTTL();
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (Number.isNaN(age) || age > ttl) {
      return null;
    }

    return cached.detail;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.warn('[PlayerCache] Failed to load cache for tag', tag, error);
    return null;
  }
}

export async function savePlayerDetailToCache(tag: string, detail: any): Promise<void> {
  if (!cfg.useLocalData) {
    return;
  }

  try {
    await ensureCacheDir();
    const safeTag = safeTagForFilename(tag);
    const cachePath = path.join(PLAYER_CACHE_DIR, `${safeTag}.json`);
    const payload: CachedPlayerDetail = {
      fetchedAt: new Date().toISOString(),
      detail,
    };
    await fsp.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[PlayerCache] Failed to write cache for tag', tag, error);
  }
}

export function setPlayerCacheTTL(hours: number) {
  if (Number.isFinite(hours) && hours > 0) {
    (global as any).__PLAYER_CACHE_TTL_MS__ = hours * 60 * 60 * 1000;
  }
}

export function getPlayerCacheTTL(): number {
  return (global as any).__PLAYER_CACHE_TTL_MS__ ?? DEFAULT_PLAYER_CACHE_TTL_MS;
}
