// web-next/src/lib/data.ts
import { promises as fsp } from "fs";
import path from "path";
import { cfg } from "./config";
import { normalizeTag, isValidTag } from "./tags";

export type Member = {
  name: string;
  tag: string;
  townHallLevel?: number | null; th?: number;

  bk?: number | null; aq?: number | null; gw?: number | null; rc?: number | null; mp?: number | null;

  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  warStars?: number;

  // League information
  league?: {
    id: number;
    name: string;
    iconUrls: {
      small: string;
      tiny: string;
      medium: string;
    };
  };
  builderBaseLeague?: {
    id: number;
    name: string;
  };

  tenure_days?: number; // effective tenure for display
  tenure?: number;      // alias accepted

  lastSeen?: number | string;
  role?: string;

  recentClans?: string[];
};

export type RosterPayload = {
  source: "snapshot" | "fallback";
  date?: string;
  clanName?: string;
  members: Member[];
  meta?: { recentClans?: string[]; clanName?: string };
};

async function exists(p: string): Promise<boolean> {
  try { await fsp.stat(p); return true; } catch { return false; }
}
async function readJSON<T = any>(p: string): Promise<T> {
  return JSON.parse(await fsp.readFile(p, "utf-8")) as T;
}

type LedgerRow = { tag: string; base?: number; tenure_days?: number; as_of?: string; ts?: string };

function ymdNowUTC(): string {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return u.toISOString().slice(0, 10);
}
function daysSince(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ""); if (!m) return 0;
  const a = Date.UTC(+m[1], +m[2]-1, +m[3], 0,0,0);
  const now = new Date();
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0,0,0);
  const diff = Math.floor((b - a)/86400000);
  return diff > 0 ? diff : 0;
}

export async function readLedgerEffective(): Promise<Record<string, number>> {
  const file = path.join(process.cwd(), cfg.dataRoot, "tenure_ledger.jsonl");
  const map: Record<string, number> = {}; const latest: Record<string, string> = {};
  if (!(await exists(file))) return map;
  const lines = (await fsp.readFile(file, "utf-8")).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for (const line of lines) {
    let row: LedgerRow | null = null; try { row = JSON.parse(line); } catch { continue; }
    const tag = normalizeTag(String(row?.tag ?? ""));
    const ts  = String(row?.ts ?? "");
    if (!isValidTag(tag) || !ts) continue;
    if (latest[tag] && latest[tag] >= ts) continue; latest[tag] = ts;
    const base = typeof row?.base === "number" ? row.base : (typeof row?.tenure_days === "number" ? row.tenure_days : undefined);
    if (typeof base !== "number") continue;
    const as_of = String(row?.as_of ?? "") || ymdNowUTC();
    map[tag] = Math.max(0, Math.round(base + daysSince(as_of)));
  }
  return map;
}

function coerceNum(v: any): number | null {
  if (typeof v === "number") return v;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
function collectRecentClans(members: Member[]): string[] {
  const s = new Set<string>(); members.forEach(m => (m.recentClans||[]).forEach(c=>s.add(String(c))));
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}

export async function loadRoster(): Promise<RosterPayload> {
  const dataDir = path.join(process.cwd(), cfg.fallbackDataRoot);
  const heroIdxPath = path.join(dataDir, "hero_index.json");
  const membersPath = path.join(dataDir, "members.json");
  const clanInfoPath = path.join(dataDir, "clan_info.json");

  const [heroIdx, members, clanInfo] = await Promise.all([
    (await exists(heroIdxPath)) ? readJSON<Record<string, Partial<Member>>>(heroIdxPath) : {},
    (await exists(membersPath)) ? readJSON<Member[]>(membersPath) : [],
    (await exists(clanInfoPath)) ? readJSON<{ name?: string }>(clanInfoPath) : {}
  ]);

  const tenureMap = await readLedgerEffective();

  const merged: Member[] = (members || []).map((m) => {
    const tag = normalizeTag(String(m.tag || ""));
    const hero = (heroIdx as any)[tag] || {};
    const th = m.townHallLevel ?? m.th;
    const add: Partial<Member> = {
      bk: coerceNum(hero.bk ?? m.bk),
      aq: coerceNum(hero.aq ?? m.aq),
      gw: coerceNum(hero.gw ?? m.gw),
      rc: coerceNum(hero.rc ?? m.rc),
      mp: coerceNum(hero.mp ?? m.mp),
      townHallLevel: typeof th === "number" ? th : null,
      tenure_days: tenureMap[tag] ?? m.tenure_days ?? m.tenure
    };
    return { ...m, ...add };
  });

  return {
    source: "fallback",
    date: ymdNowUTC(),
    clanName: (clanInfo as any)?.name,
    members: merged,
    meta: { clanName: (clanInfo as any)?.name, recentClans: collectRecentClans(merged) }
  };
}
