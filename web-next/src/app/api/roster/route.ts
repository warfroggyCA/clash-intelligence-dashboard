// web-next/src/app/api/roster/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";
import { promises as fsp } from "fs";
import { cfg } from "@/lib/config";
import { getClanInfo, getClanMembers, getPlayer, extractHeroLevels } from "@/lib/coc";
import { getLatestSnapshot, loadSnapshot } from "@/lib/snapshots";

// ---------- small helpers ----------
const CLASH_TAG_RE = /^#[0289PYLQGRJCUV]{5,}$/;

function ymdNowUTC(): string {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return u.toISOString().slice(0, 10);
}
function daysSince(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return 0;
  const a = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.floor((b - a) / 86400000);
  return diff > 0 ? diff : 0;
}
async function readLedgerEffective(): Promise<Record<string, number>> {
  const file = path.join(process.cwd(), cfg.dataRoot, "tenure_ledger.jsonl");
  const map: Record<string, number> = {};
  const latest: Record<string, string> = {};
  try {
    const text = await fsp.readFile(file, "utf-8");
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim(); if (!s) continue;
      let row: any; try { row = JSON.parse(s); } catch { continue; }
      const tag = String(row?.tag ?? "").toUpperCase().trim();
      const ts  = String(row?.ts ?? "");
      if (!CLASH_TAG_RE.test(tag) || !ts) continue;
      if (latest[tag] && latest[tag] >= ts) continue;
      latest[tag] = ts;
      const base = typeof row.base === "number" ? row.base :
                   typeof row.tenure_days === "number" ? row.tenure_days : undefined;
      if (typeof base !== "number") continue;
      const as_of = String(row?.as_of ?? "") || ymdNowUTC();
      map[tag] = Math.max(0, Math.round(base + daysSince(as_of)));
    }
  } catch { /* no ledger yet */ }
  return map;
}
const sleep = (ms:number)=> new Promise(r=>setTimeout(r,ms));

// Global rate limiter for CoC API calls
class CoCRateLimiter {
  private queue: Array<() => void> = [];
  private active = 0;
  private lastRequest = 0;
  private readonly maxConcurrent = 3; // Conservative limit
  private readonly minInterval = 700; // ~85 requests/minute (well under 100/min limit)

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.process();
    });
  }

  release(): void {
    this.active--;
    this.process();
  }

  private process(): void {
    if (this.queue.length === 0 || this.active >= this.maxConcurrent) return;
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      // Wait before processing next request
      const waitTime = this.minInterval - timeSinceLastRequest;
      if (process.env.NODE_ENV === "development") {
        console.log(`[RateLimiter] Waiting ${waitTime}ms before next request (queue: ${this.queue.length}, active: ${this.active})`);
      }
      setTimeout(() => this.process(), waitTime);
      return;
    }

    const resolve = this.queue.shift();
    if (resolve) {
      this.active++;
      this.lastRequest = now;
      if (process.env.NODE_ENV === "development") {
        console.log(`[RateLimiter] Processing request (queue: ${this.queue.length}, active: ${this.active})`);
      }
      resolve();
    }
  }
}

const rateLimiter = new CoCRateLimiter();

async function mapLimit<T,R>(items:T[], limit:number, fn:(x:T,i:number)=>Promise<R>):Promise<R[]>{
  const out: R[] = new Array(items.length) as any; let i=0, active=0;
  return new Promise((resolve) => {
    const launch = () => {
      if (i>=items.length && active===0) return resolve(out);
      while (active<limit && i<items.length) {
        const idx=i++, it=items[idx]; active++;
        fn(it,idx).then(res => { out[idx]=res; })
          .catch(() => { out[idx] = undefined as any; })
          .finally(() => { active--; launch(); });
      }
    };
    launch();
  });
}

// ---------- route ----------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("clanTag") || cfg.homeClanTag || "").toUpperCase().trim();
    const mode = url.searchParams.get("mode") || "live";
    
    if (!raw || !CLASH_TAG_RE.test(raw)) {
      return NextResponse.json({ ok:false, error:"Provide a valid clanTag like #2PR8R8V8P" }, { status:400 });
    }

    // Handle snapshot mode - load from stored snapshots
    if (mode === "snapshot") {
      const requestedDate = url.searchParams.get("date");
      let snapshot;
      
      if (requestedDate && requestedDate !== "latest") {
        snapshot = await loadSnapshot(raw, requestedDate);
      } else {
        snapshot = await getLatestSnapshot(raw);
      }
      
      if (!snapshot) {
        // Fallback to live data if no snapshot available
        console.log(`No snapshot found for ${raw}, falling back to live data`);
        // Continue to live data fetching below instead of returning error
      } else {
        // Read effective tenure map (append-only)
        const tenureMap = await readLedgerEffective();

        // Enrich snapshot members with current tenure data
        const enrichedMembers = snapshot.members.map(member => ({
          ...member,
          tenure_days: tenureMap[member.tag.toUpperCase()] || member.tenure_days || 0,
        }));

        return NextResponse.json({
          source: "snapshot",
          date: snapshot.date,
          clanName: snapshot.clanName,
          meta: { clanTag: raw, clanName: snapshot.clanName },
          members: enrichedMembers,
        }, { status: 200 });
      }
    }

    // 1) clan info + members (live, rate-limited)
    await rateLimiter.acquire();
    let info, members;
    try {
      [info, members] = await Promise.all([
        getClanInfo(raw),
        getClanMembers(raw) // (coc.ts uses ?limit=50)
      ]);
    } finally {
      rateLimiter.release();
    }
    if (!members?.length) {
      return NextResponse.json({ ok:false, error:`No members returned for ${raw}` }, { status:404 });
    }

    // 2) read effective tenure map (append-only)
    const tenureMap = await readLedgerEffective();

    // 3) pull each player for TH + heroes (rate-limited)
    const enriched = await mapLimit(members, 3, async (m) => {
      await rateLimiter.acquire();
      try {
        const p = await getPlayer(m.tag);
        const heroes = extractHeroLevels(p);
        return {
          name: m.name,
          tag: m.tag.toUpperCase(),
          townHallLevel: p.townHallLevel,
          trophies: m.trophies,
          donations: m.donations,
          donationsReceived: m.donationsReceived,
          role: m.role,
          bk: typeof heroes.bk === "number" ? heroes.bk : null,
          aq: typeof heroes.aq === "number" ? heroes.aq : null,
          gw: typeof heroes.gw === "number" ? heroes.gw : null,
          rc: typeof heroes.rc === "number" ? heroes.rc : null,
          mp: typeof heroes.mp === "number" ? heroes.mp : null,
          tenure_days: tenureMap[m.tag.toUpperCase()],
        };
      } finally {
        rateLimiter.release();
      }
    });

    return NextResponse.json({
      source: "live",
      date: ymdNowUTC(),
      clanName: (info as any)?.name,
      meta: { clanTag: raw, clanName: (info as any)?.name },
      members: (enriched || []).filter(Boolean),
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || "failed" }, { status: 500 });
  }
}

