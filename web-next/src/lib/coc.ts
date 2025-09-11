// web-next/src/lib/coc.ts
// Server-only Clash of Clans API helpers.
// Reads process.env.COC_API_TOKEN. Forces IPv4 egress to avoid invalidIp on IPv6.

import { Agent } from "undici";

type CoCPlayer = {
  tag: string;
  name: string;
  townHallLevel?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  heroes?: Array<{ name: string; level?: number; currentLevel?: number }>;
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

const BASE = process.env.COC_API_BASE || "https://api.clashofclans.com/v1";

// Force IPv4 for all requests (some keys/IP-allowlists are v4-only)
const agent4 = new Agent({ connect: { family: 4 } });

function encTag(tag: string) {
  const t = String(tag || "").trim();
  return t.startsWith("#") ? `%23${t.slice(1)}` : `%23${t}`;
}

async function api<T>(path: string): Promise<T> {
  const token = process.env.COC_API_TOKEN;
  if (!token) throw new Error("COC_API_TOKEN not set");
  
  const fetchOptions: RequestInit = {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  };

  // Use Fixie proxy if available (for production), otherwise use IPv4 agent
  if (process.env.FIXIE_URL) {
    // Set proxy environment variables for Node.js to use
    process.env.HTTP_PROXY = process.env.FIXIE_URL;
    process.env.HTTPS_PROXY = process.env.FIXIE_URL;
    console.log('Set proxy environment variables');
  }
  
  // Always use IPv4 agent (proxy handled by environment variables)
  // @ts-ignore - undici agent for IPv4
  fetchOptions.dispatcher = agent4;

  const res = await fetch(`${BASE}${path}`, fetchOptions);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoC API ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function getClanMembers(clanTag: string) {
  const t = encTag(clanTag);
  const r = await api<CoCClanMembersResp>(`/clans/${t}/members?limit=50`);
  return r.items.map((m) => ({
    tag: m.tag.toUpperCase(),
    name: m.name,
    role: m.role,
    trophies: m.trophies,
    donations: m.donations,
    donationsReceived: m.donationsReceived,
  }));
}

export async function getClanInfo(clanTag: string) {
  return api<CoCClan>(`/clans/${encTag(clanTag)}`);
}

export async function getPlayer(tag: string) {
  return api<CoCPlayer>(`/players/${encTag(tag)}`);
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
    const lvl = typeof h.currentLevel === "number" ? h.currentLevel
              : typeof h.level === "number" ? h.level : 0;
    out[k] = lvl || 0;
  }
  return out;
}

