// web-next/src/lib/coc.ts
// Server-only Clash of Clans API helpers.
// Uses native fetch and undici to correctly force IPv4 when not using a proxy.

import { Agent, setGlobalDispatcher } from "undici";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { normalizeTag } from './tags';

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

// Force IPv4 for native fetch (some keys/IP-allowlists are v4-only) when no proxy is set
const FIXIE_URL = process.env.FIXIE_URL;
if (!FIXIE_URL) {
  try {
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  } catch {}
}

// Development mode - skip API calls to save Fixie quota
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.SKIP_API_CALLS === 'true';

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
  // Development mode - use mock data to save Fixie quota
  if (DEV_MODE) {
    console.log(`[DEV MODE] Using mock data for: ${path}`);
    
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
    console.log(`[Cache Hit] Using cached data for ${path}`);
    return cached;
  }

  const token = process.env.COC_API_TOKEN;
  if (!token) {
    // In development, fall back to mock data if no token
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] No COC_API_TOKEN, using mock data for: ${path}`);
      
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
  
  // If a proxy URL is provided, use axios + https-proxy-agent (fetch proxy dispatcher not installed)
  console.log('[DEBUG] FIXIE_URL present:', !!FIXIE_URL);
  console.log('[DEBUG] FIXIE_URL value:', FIXIE_URL ? FIXIE_URL.replace(/:[^:]*@/, ':****@') : 'undefined');
  console.log('[DEBUG] Force fresh deployment - testing Fixie proxy');
  
  // Re-enable Fixie proxy for IP whitelisting
  console.log('[DEBUG] FIXIE_URL from env:', !!FIXIE_URL);
  console.log('[DEBUG] Using Fixie proxy:', FIXIE_URL ? 'YES' : 'NO');
  console.log('[DEBUG] Fixie proxy re-enabled for IP whitelisting - FORCE DEPLOY');

  if (FIXIE_URL) {
    const axiosConfig: any = {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 10000,
    };
    console.log('Using Fixie proxy with axios:', FIXIE_URL?.replace(/:[^:]*@/, ':****@'));
    console.log('[DEBUG] Proxy URL being used:', FIXIE_URL?.replace(/:[^:]*@/, ':****@'));
    const proxyAgent = new HttpsProxyAgent(FIXIE_URL!);
    console.log('[DEBUG] Proxy agent created successfully');
    axiosConfig.httpsAgent = proxyAgent;
    axiosConfig.httpAgent = proxyAgent;
    try {
      console.log(`[API Call] (proxy) ${path}`);
      const response = await axios.get(`${BASE}${path}`, axiosConfig);
      setCached(path, response.data);
      return response.data as T;
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;
        throw new Error(`CoC API ${status} ${statusText}: ${JSON.stringify(data)}`);
      } else {
        throw new Error(`CoC API request failed: ${error.message}`);
      }
    }
  }

  // Default path: native fetch using global IPv4 dispatcher
  try {
    console.log(`[API Call] ${path}`);
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CoC API ${res.status} ${res.statusText}: ${text}`);
    }
    const data = (await res.json()) as T;
    setCached(path, data);
    return data;
  } catch (error: any) {
    throw new Error(`CoC API request failed: ${error.message}`);
  }
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
    console.warn('[CoC] Failed to load current war', error?.message || error);
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
    console.warn('[CoC] Failed to load capital raid seasons', error?.message || error);
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
