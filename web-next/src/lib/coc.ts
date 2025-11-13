// web-next/src/lib/coc.ts
// Server-only Clash of Clans API helpers.
// Uses native fetch and undici to correctly force IPv4 when not using a proxy.

import { Agent, setGlobalDispatcher } from "undici";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { normalizeTag } from './tags';
import { rateLimiter } from './rate-limiter';

type CoCPlayer = {
  tag: string;
  name: string;
  townHallLevel?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  attackWins?: number;
  versusBattleWins?: number;
  versusTrophies?: number;
  clanCapitalContributions?: number;
  league?: {
    id: number;
    name: string;
    iconUrls: {
      small: string;
      tiny: string;
      medium: string;
    };
  };
  heroes?: Array<{ 
    name: string; 
    level?: number; 
    currentLevel?: number;
    maxLevel?: number;
    village?: string;
  }>;
};

type CoCClanMembersResp = {
  items: Array<{
    tag: string;
    name: string;
    role?: string;
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
    leagueTier?: {
      id: number;
      name: string;
    };
  }>;
};

type CoCClan = { tag: string; name?: string };

type CoCWarLogEntry = {
  result?: string;
  teamSize?: number;
  endTime?: string;
  clan?: Record<string, any>;
  opponent?: Record<string, any>;
};

type CoCCurrentWar = {
  state?: string;
  teamSize?: number;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan?: Record<string, any>;
  opponent?: Record<string, any>;
};

type CoCCapitalRaidSeason = {
  id?: string;
  startTime?: string;
  endTime?: string;
  capitalTotalLoot?: number;
  defensiveReward?: number;
  offensiveReward?: number;
  members?: Array<Record<string, any>>;
};

const BASE = process.env.COC_API_BASE || "https://api.clashofclans.com/v1";
const FIXIE_URL = process.env.FIXIE_URL;
const DEFAULT_TIMEOUT_MS = Number(process.env.COC_API_TIMEOUT_MS ?? 15000);
const MAX_RETRIES = Math.max(1, Number(process.env.COC_API_MAX_RETRIES ?? 3));
const RETRY_BACKOFF_BASE_MS = Number(process.env.COC_API_RETRY_BASE_MS ?? 1000);
const DISABLE_PROXY = process.env.COC_DISABLE_PROXY === 'true';

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production' && (process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV);

// Lazy check for FIXIE_URL - only validate when API is actually called, not at module load time
// This prevents build-time errors when FIXIE_URL is not set during build
function validateFixieConfig() {
  // Skip validation during build phase (when VERCEL_ENV is not set or is 'development')
  const isBuildPhase = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development';
  if (isBuildPhase) {
    return; // Skip validation during build
  }
  
  // CRITICAL: In production runtime, Fixie is REQUIRED. Direct connections are not allowed.
  if (isProduction && !FIXIE_URL && !DISABLE_PROXY) {
    console.error('[CoC API] CRITICAL ERROR: FIXIE_URL is not set in production environment. Fixie proxy is REQUIRED for production.');
    throw new Error('FIXIE_URL environment variable is required in production. Direct CoC API connections are not allowed.');
  }
}

// CRITICAL: In production, NEVER allow fallback to direct connections
// Production MUST use Fixie proxy only. Direct connections are forbidden.
const ALLOW_PROXY_FALLBACK = isDevelopment ? (process.env.COC_ALLOW_PROXY_FALLBACK !== 'false') : false;

// Force IPv4 for native fetch (some keys/IP-allowlists are v4-only) when no proxy is set
if (!FIXIE_URL) {
  try {
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  } catch {}
}

// Development mode - skip API calls to save Fixie quota
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.SKIP_API_CALLS === 'true';

// Debug logging control - gate verbose logs in production
// Set DEBUG_COC_API=true to enable verbose logging in production
const DEBUG_COC_API = process.env.DEBUG_COC_API === 'true' || process.env.NODE_ENV === 'development';

/**
 * Log debug/info messages only in development or when DEBUG_COC_API is enabled
 * Errors are always logged regardless of debug flag
 */
function debugLog(...args: any[]): void {
  if (DEBUG_COC_API) {
    console.log(...args);
  }
}

/**
 * Log warnings only in development or when DEBUG_COC_API is enabled
 * Critical warnings are always logged
 */
function debugWarn(...args: any[]): void {
  if (DEBUG_COC_API) {
    console.warn(...args);
  }
}

// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Mock data for development mode
const MOCK_DATA = {
  '/clans/%232PR8R8V8P': {
    tag: '#2PR8R8V8P',
    name: 'HeCk YeAh',
    memberCount: 20,
    clanLevel: 18,
    clanPoints: 45000,
    warWinStreak: 5,
    warWins: 150,
    warTies: 10,
    warLosses: 20,
    isWarLogPublic: true,
    warLeague: { id: 48000007, name: 'Master League II' }
  },
  '/clans/%232PR8R8V8P/members?limit=50': {
    items: [
      { tag: '#VGQVRLRL', name: 'DoubleD', role: 'leader', trophies: 5200, donations: 1500, donationsReceived: 200 },
      { tag: '#QULRCQ02G', name: 'Sirojiddin', role: 'coLeader', trophies: 4800, donations: 1200, donationsReceived: 150 },
      { tag: '#LP920YJC', name: 'Mate 238', role: 'elder', trophies: 4200, donations: 800, donationsReceived: 100 },
      { tag: '#QYLYG8J9G', name: '_RSENIC', role: 'member', trophies: 3800, donations: 600, donationsReceived: 80 },
      { tag: '#8CRRR2RQ2', name: 'ShakiB', role: 'member', trophies: 3400, donations: 400, donationsReceived: 60 },
      { tag: '#QRC2C2PVQ', name: 'A_Ar1an', role: 'member', trophies: 3600, donations: 500, donationsReceived: 70 },
      { tag: '#UU9GJ9QQ', name: 'andrew', role: 'member', trophies: 3200, donations: 350, donationsReceived: 45 },
      { tag: '#G8JYPVVUQ', name: 'Binh_en24', role: 'member', trophies: 3100, donations: 300, donationsReceived: 40 },
      { tag: '#QCRVR2CPU', name: 'bob', role: 'member', trophies: 3000, donations: 250, donationsReceived: 35 },
      { tag: '#YYVUCPQ90', name: 'CosmicThomas', role: 'member', trophies: 2900, donations: 200, donationsReceived: 30 },
      { tag: '#980GYGLRR', name: 'ethan', role: 'member', trophies: 2800, donations: 180, donationsReceived: 25 },
      { tag: '#9L9QC8LUU', name: 'fahad_bd', role: 'member', trophies: 2700, donations: 160, donationsReceived: 20 },
      { tag: '#GPYCPQV8J', name: 'Headhuntress', role: 'member', trophies: 2600, donations: 140, donationsReceived: 18 },
      { tag: '#QVCYP9V8Q', name: 'JPSavke', role: 'member', trophies: 2500, donations: 120, donationsReceived: 15 },
      { tag: '#Y988C90RG', name: 'Strombreaker', role: 'member', trophies: 2400, donations: 100, donationsReceived: 12 },
      { tag: '#G09GGYC2Y', name: 'Tigress', role: 'member', trophies: 2300, donations: 80, donationsReceived: 10 },
      { tag: '#UL0LRJ02', name: 'War_Frog', role: 'member', trophies: 2200, donations: 60, donationsReceived: 8 },
      { tag: '#G9QVRYC2Y', name: 'warfroggy', role: 'member', trophies: 2100, donations: 40, donationsReceived: 5 },
      { tag: '#G8GCC8GGC', name: 'Zouboul', role: 'member', trophies: 2000, donations: 20, donationsReceived: 2 },
      { tag: '#YUGUL9JJ0', name: 'se', role: 'member', trophies: 1900, donations: 10, donationsReceived: 1 }
    ]
  }
};

// Generate mock player data
function generateMockPlayer(tag: string, name: string) {
  const th = Math.floor(Math.random() * 5) + 10; // 10-14
  const bk = Math.floor(Math.random() * 20) + 40; // 40-60
  const aq = Math.floor(Math.random() * 20) + 40; // 40-60
  const gw = Math.floor(Math.random() * 15) + 20; // 20-35
  const rc = Math.floor(Math.random() * 15) + 15; // 15-30
  const mp = Math.floor(Math.random() * 10) + 10; // 10-20
  
  return {
    tag,
    name,
    townHallLevel: th,
    trophies: Math.floor(Math.random() * 2000) + 3000, // 3000-5000
    donations: Math.floor(Math.random() * 1000) + 200, // 200-1200
    donationsReceived: Math.floor(Math.random() * 200) + 50, // 50-250
    attackWins: Math.floor(Math.random() * 1500) + 1000, // 1000-2500
    versusBattleWins: Math.floor(Math.random() * 100) + 50, // 50-150
    versusTrophies: Math.floor(Math.random() * 1000) + 2500, // 2500-3500
    clanCapitalContributions: Math.floor(Math.random() * 10000) + 5000, // 5000-15000
    role: 'member',
    clanTag: '#2PR8R8V8P',
    heroes: [
      { name: 'Barbarian King', level: bk, village: 'home' },
      { name: 'Archer Queen', level: aq, village: 'home' },
      { name: 'Grand Warden', level: gw, village: 'home' },
      { name: 'Royal Champion', level: rc, village: 'home' },
      { name: 'Minion Prince', level: mp, village: 'builder' }
    ]
  };
}

function encTag(tag: string) {
  const t = normalizeTag(tag);
  return `%23${t.slice(1)}`;
}

async function api<T>(path: string): Promise<T> {
  // Validate Fixie config when API is actually called (not at module load)
  validateFixieConfig();
  
  // Development mode - use mock data to save Fixie quota
  if (DEV_MODE) {
    debugLog(`[DEV MODE] Using mock data for: ${path}`);
    
    // Return mock clan data
    if (path.includes('/clans/')) {
      const mockData = MOCK_DATA[path as keyof typeof MOCK_DATA] || MOCK_DATA['/clans/%232PR8R8V8P'];
      return mockData as T;
    }
    
    // Return mock player data
    if (path.includes('/players/')) {
      const playerTag = path.split('/players/')[1];
      const mockPlayer = generateMockPlayer(playerTag, `Player${Math.floor(Math.random() * 1000)}`);
      return mockPlayer as T;
    }
    
    // Default mock response
    return {} as T;
  }

  // Check cache first
  const cached = getCached<T>(path);
  if (cached) {
    debugLog(`[Cache Hit] Using cached data for ${path}`);
    return cached;
  }

  // Support both COC_API_TOKEN and COC_API_KEY for compatibility
  const token = process.env.COC_API_TOKEN || process.env.COC_API_KEY;
  if (!token) {
    // In development, fall back to mock data if no token
    if (process.env.NODE_ENV === 'development') {
      debugLog(`[DEV MODE] No COC_API_TOKEN, using mock data for: ${path}`);
      
      // Return mock clan data
      if (path.includes('/clans/')) {
        const mockData = MOCK_DATA[path as keyof typeof MOCK_DATA] || MOCK_DATA['/clans/%232PR8R8V8P'];
        if (mockData) {
          setCached(path, mockData);
          return mockData as T;
        }
      }
      
      // Return mock player data
      if (path.includes('/players/')) {
        const playerTag = path.split('/players/')[1];
        const mockPlayer = generateMockPlayer(playerTag, `Player${Math.floor(Math.random() * 1000)}`);
        setCached(path, mockPlayer);
        return mockPlayer as T;
      }
      
      // Default mock response
      return {} as T;
    }
    throw new Error("COC_API_TOKEN not set");
  }
  
  const attemptModes: Array<'proxy' | 'direct'> = [];
  const canUseProxy = Boolean(FIXIE_URL) && !DISABLE_PROXY;
  
  // Log proxy configuration for debugging (only in debug mode)
  debugLog(`[CoC API] Proxy config - Environment: ${isProduction ? 'PRODUCTION' : isDevelopment ? 'DEVELOPMENT' : 'UNKNOWN'}, FIXIE_URL: ${FIXIE_URL ? 'SET' : 'NOT SET'}, DISABLE_PROXY: ${DISABLE_PROXY}, canUseProxy: ${canUseProxy}`);
  
  // PRODUCTION: Must use Fixie, no direct connections allowed
  if (isProduction) {
    if (!canUseProxy) {
      const error = new Error('FIXIE_URL is required in production. Direct CoC API connections are not allowed.');
      console.error('[CoC API] PRODUCTION ERROR:', error.message);
      throw error;
    }
    // Production: Only use proxy, no fallback
    while (attemptModes.length < MAX_RETRIES) {
      attemptModes.push('proxy');
    }
  } 
  // DEVELOPMENT: Allow direct connections if Fixie not available
  else if (isDevelopment) {
    if (canUseProxy) {
      attemptModes.push('proxy');
      if (ALLOW_PROXY_FALLBACK) {
        while (attemptModes.length < MAX_RETRIES) {
          attemptModes.push('direct');
        }
      } else {
        while (attemptModes.length < MAX_RETRIES) {
          attemptModes.push('proxy');
        }
      }
    } else {
      debugWarn(`[CoC API] Development mode: Proxy not available, using direct connection`);
      while (attemptModes.length < MAX_RETRIES) {
        attemptModes.push('direct');
      }
    }
  }
  // UNKNOWN ENVIRONMENT: Try to use proxy if available, otherwise direct
  else {
    if (canUseProxy) {
      attemptModes.push('proxy');
      if (ALLOW_PROXY_FALLBACK) {
        while (attemptModes.length < MAX_RETRIES) {
          attemptModes.push('direct');
        }
      } else {
        while (attemptModes.length < MAX_RETRIES) {
          attemptModes.push('proxy');
        }
      }
    } else {
      debugWarn(`[CoC API] WARNING: Proxy not available - using direct connection`);
      while (attemptModes.length < MAX_RETRIES) {
        attemptModes.push('direct');
      }
    }
  }

  let lastError: any = null;

  for (let i = 0; i < attemptModes.length; i += 1) {
    const mode = attemptModes[i];
    const attemptNumber = i + 1;
    const totalAttempts = attemptModes.length;

    try {
      const data = await withRateLimiter(async () => {
        if (mode === 'proxy') {
          return requestViaProxy<T>(path, token);
        }
        return requestDirect<T>(path, token);
      });

      setCached(path, data);
      if (lastError) {
        debugWarn(`[CoC API] Recovered after ${attemptNumber}/${totalAttempts} attempts for ${path}`);
      }
      return data;
    } catch (error: any) {
      lastError = error;
      const status = (error as any)?.status ?? deriveStatusFromMessage(error?.message);
      const isClientError = typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
      const isLastAttempt = attemptNumber === totalAttempts || isClientError;

      const modeLabel = mode === 'proxy' ? 'proxy' : 'direct';
      const errorStatus = (error as any)?.status ?? status;
      const is403 = errorStatus === 403;
      
      if (is403 && mode === 'direct') {
        console.error(`[CoC API] 403 Forbidden on direct connection - FIXIE_URL is ${FIXIE_URL ? 'SET' : 'NOT SET'}. This likely means Fixie proxy is not configured in production environment.`);
      }
      
      // Only log retry attempts in debug mode - final errors are logged below
      debugWarn(`[CoC API] Attempt ${attemptNumber}/${totalAttempts} (${modeLabel}) failed for ${path}: ${error?.message || error}`);

      if (mode === 'proxy' && (!ALLOW_PROXY_FALLBACK || isClientError)) {
        // If proxy fails and fallback disabled or client error, stop immediately
        if (isClientError) {
          throw error;
        }
      }
      
      // In production, direct connections should never happen
      if (isProduction && mode === 'direct') {
        console.error(`[CoC API] CRITICAL ERROR: Direct connection attempted in PRODUCTION. This should never happen. FIXIE_URL must be set.`);
        throw new Error('Direct CoC API connection attempted in production. Fixie proxy is required.');
      }
      
      // If direct connection gets 403, and we have Fixie available but didn't try it, suggest using proxy
      if (is403 && mode === 'direct' && FIXIE_URL && !DISABLE_PROXY) {
        console.error(`[CoC API] CRITICAL: 403 on direct connection but Fixie is configured. This suggests proxy configuration issue.`);
      }

      if (isLastAttempt) {
        throw new Error(`CoC API request failed after ${attemptNumber} attempts: ${error?.message || error}`);
      }

      await delay(RETRY_BACKOFF_BASE_MS * attemptNumber + Math.floor(Math.random() * 250));
    }
  }

  throw new Error(`CoC API request failed: ${lastError?.message || 'Unknown error'}`);
}

async function withRateLimiter<T>(fn: () => Promise<T>): Promise<T> {
  await rateLimiter.acquire();
  try {
    return await fn();
  } finally {
    rateLimiter.release();
  }
}

async function requestViaProxy<T>(path: string, token: string): Promise<T> {
  if (!FIXIE_URL) {
    const error = new Error('requestViaProxy called but FIXIE_URL not set');
    console.error(`[CoC API] CRITICAL: ${error.message}`);
    throw error;
  }

  const axiosConfig: any = {
    headers: { 
      Authorization: `Bearer ${token}`, 
      Accept: "application/json",
      'User-Agent': 'ClashIntelligence/1.0'
    },
    timeout: DEFAULT_TIMEOUT_MS,
    maxRedirects: 5,
  };
  
  // Log proxy URL (masked for security) - only in debug mode
  const fixieHost = FIXIE_URL.match(/@([^:]+)/)?.[1] || 'unknown';
  debugLog(`[API Call] (proxy via Fixie ${fixieHost}) ${path}`);
  debugLog(`[API Call] Proxy config - FIXIE_URL format: ${FIXIE_URL.startsWith('http') ? 'valid' : 'invalid'}, length: ${FIXIE_URL.length}`);
  
  try {
    const proxyAgent = new HttpsProxyAgent(FIXIE_URL);
    axiosConfig.httpsAgent = proxyAgent;
    axiosConfig.httpAgent = proxyAgent;

    // Log request details (but mask sensitive data) - only in debug mode
    const maskedToken = token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'MISSING';
    debugLog(`[API Call] (proxy) Making request to: ${BASE}${path}`);
    debugLog(`[API Call] (proxy) Authorization header: Bearer ${maskedToken}`);
    debugLog(`[API Call] (proxy) Proxy agent configured: ${proxyAgent ? 'YES' : 'NO'}`);

    const response = await axios.get(`${BASE}${path}`, axiosConfig);
    debugLog(`[API Call] (proxy) SUCCESS for ${path} - Status: ${response.status}`);
    debugLog(`[API Call] (proxy) Response headers:`, JSON.stringify(response.headers));
    return response.data as T;
  } catch (error: any) {
    if (error?.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const data = error.response.data;
      const headers = error.response.headers;
      
      // Always log errors, but reduce verbosity in production
      console.error(`[API Call] (proxy) FAILED ${status} ${statusText} for ${path}`);
      
      // Only log full response data/headers in debug mode (can be large)
      if (DEBUG_COC_API) {
        console.error(`[API Call] Response data:`, JSON.stringify(data));
        console.error(`[API Call] Response headers:`, JSON.stringify(headers));
      }
      
      // Check if the error is actually from the proxy or from CoC API
      if (status === 403) {
        console.error(`[API Call] 403 Forbidden through Fixie proxy. Possible causes:`);
        console.error(`  1. CoC API token is invalid or revoked`);
        console.error(`  2. Fixie proxy IP is not whitelisted in CoC API key settings`);
        if (DEBUG_COC_API) {
          console.error(`     → Run /api/debug/fixie-ip to get Fixie IP addresses`);
          console.error(`     → Whitelist these IPs in https://developer.clashofclans.com/#/account/apikey`);
        }
        console.error(`  3. API key permissions are insufficient`);
        console.error(`  4. API key rate limits exceeded`);
      }
      
      const proxiedError: any = new Error(`CoC API ${status} ${statusText}: ${JSON.stringify(data)}`);
      proxiedError.status = status;
      proxiedError.proxied = true;
      throw proxiedError;
    }
    
    // Network/proxy errors - always log message, stack only in debug mode
    console.error(`[API Call] (proxy) REQUEST FAILED for ${path}:`, error?.message || error);
    if (DEBUG_COC_API) {
      console.error(`[API Call] Error code:`, error?.code);
      console.error(`[API Call] Error stack:`, error?.stack);
    }
    
    const proxiedError: any = new Error(`CoC API proxy request failed: ${error?.message || error}`);
    proxiedError.code = error?.code;
    proxiedError.proxied = true;
    throw proxiedError;
  }
}

async function requestDirect<T>(path: string, token: string): Promise<T> {
  debugLog(`[API Call] ${path}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err: any = new Error(`CoC API ${res.status} ${res.statusText}: ${text}`);
      err.status = res.status;
      throw err;
    }

    return (await res.json()) as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError: any = new Error(`CoC API request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveStatusFromMessage(message?: string): number | null {
  if (!message) return null;
  const match = message.match(/CoC API (\d{3})/);
  if (match) {
    const code = Number(match[1]);
    return Number.isFinite(code) ? code : null;
  }
  return null;
}

export async function getClanMembers(clanTag: string) {
  const t = encTag(clanTag);
  const r = await api<CoCClanMembersResp>(`/clans/${t}/members?limit=50`);
  return r.items.map((m) => ({
    tag: normalizeTag(m.tag),
    name: m.name,
    role: m.role,
    trophies: m.trophies,
    donations: m.donations,
    donationsReceived: m.donationsReceived,
  }));
}

export async function getClanInfo(clanTag: string) {
  return api<any>(`/clans/${encTag(clanTag)}`);
}

export async function getPlayer(tag: string) {
  return api<CoCPlayer>(`/players/${encTag(tag)}`);
}

export async function getClanWarLog(clanTag: string, limit = 10) {
  const t = encTag(clanTag);
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const res = await api<{ items: CoCWarLogEntry[] }>(`/clans/${t}/warlog?limit=${safeLimit}`);
  return Array.isArray(res?.items) ? res.items : [];
}

export async function getClanCurrentWar(clanTag: string) {
  const t = encTag(clanTag);
  try {
    return await api<CoCCurrentWar>(`/clans/${t}/currentwar`);
  } catch (error: any) {
    // API returns 404/403 when war log hidden or no war
    debugWarn('[CoC] Failed to load current war', error?.message || error);
    return null;
  }
}

export async function getClanCapitalRaidSeasons(clanTag: string, limit = 5) {
  const t = encTag(clanTag);
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  try {
    const res = await api<{ items: CoCCapitalRaidSeason[] }>(`/clans/${t}/capitalraidseasons?limit=${safeLimit}`);
    return Array.isArray(res?.items) ? res.items : [];
  } catch (error: any) {
    debugWarn('[CoC] Failed to load capital raid seasons', error?.message || error);
    return [];
  }
}

// Map CoC hero names to our short keys.
function heroKeyFromName(name: string): "bk" | "aq" | "gw" | "rc" | "mp" | null {
  const s = (name || "").toLowerCase();
  if (s.includes("barbarian") && s.includes("king")) return "bk";
  if (s.includes("archer") && s.includes("queen")) return "aq";
  if (s.includes("warden")) return "gw";
  if (s.includes("royal") && s.includes("champion")) return "rc";
  if (s.includes("minion") && s.includes("prince")) return "mp";
  return null;
}

export function extractHeroLevels(p: CoCPlayer) {
  const out: Partial<Record<"bk" | "aq" | "gw" | "rc" | "mp", number | null>> = {
    bk: null, aq: null, gw: null, rc: null, mp: null,
  };

  for (const h of p.heroes || []) {
    const k = heroKeyFromName(h.name || "");
    if (!k) continue;

    // Precedence: currentLevel > level > maxLevel; 0 is a valid value when hero exists
    let lvl: number | null = null;
    if (typeof h.currentLevel === "number") {
      lvl = h.currentLevel;
    } else if (typeof h.level === "number") {
      lvl = h.level;
    } else if (typeof h.maxLevel === "number") {
      lvl = h.maxLevel;
    } else {
      lvl = 0; // hero present but no numeric level provided
    }

    // Ensure non-negative
    if (typeof lvl === 'number' && lvl < 0) lvl = 0;

    out[k] = lvl;
  }

  return out;
}
