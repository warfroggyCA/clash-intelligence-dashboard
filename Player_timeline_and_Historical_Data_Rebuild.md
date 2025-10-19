# 🧭 Player Timeline & Historical Data Rebuild (Preferred Approach)

## 🎯 Goal

Restore the **player timeline scrubber** and enable all comparative and historical exhibits (hero progress, trophy trends, donations, war/raid summaries) using a unified **canonical + historical time-series model** that remains API-driven and lightweight.

---

## ⚙️ Overview

Your nightly canonical cron job provides **latest state** only. To power time-based visuals, we must **persist state per day** and compute **deltas + events** between consecutive snapshots.

**Key idea:** Each night, **append** a compact `player_day` row per player. UI reads timeline data from this table instead of the single snapshot.

---

## 🧩 Data Model

### SQL (Postgres-compatible)

```sql

CREATE TABLE IF NOT EXISTS player_day (

date DATE NOT NULL,

clan_tag TEXT NOT NULL,

player_tag TEXT NOT NULL,

th SMALLINT,

league TEXT,

trophies SMALLINT,

donations SMALLINT,

donations_rcv SMALLINT,

war_stars SMALLINT,

capital_contrib INT,

legend_attacks SMALLINT,

hero_levels JSONB, -- {bk:85, aq:85, gw:60, rc:35}

equipment_levels JSONB,

pets JSONB,

super_troops_active TEXT[],

achievements JSONB, -- {count: 120, score: 5600}

rush_percent SMALLINT,

exp_level SMALLINT,

deltas JSONB, -- {trophies:+120, bk:+1}

events TEXT[], -- ["hero_level_up","league_change"]

notability SMALLINT, -- 0..N (timeline gate: >=1 shows)

snapshot_hash TEXT, -- md5 of core fields to skip duplicates

PRIMARY KEY (player_tag, date)

);

CREATE INDEX IF NOT EXISTS idx_player_day_clan_date ON player_day (clan_tag, date);

Hot/Warm/Cold retention

Hot (≤ 400 days): keep full daily rows.

Warm (≤ 2 years): optionally drop low-value columns (e.g., donations_rcv).

Cold (> 2 years): archive to Parquet/gzip object storage.

> **Why the extra columns?** With `equipment_levels`, `pets`, `super_troops_active`, `achievements`, `rush_percent`, and `exp_level` stored per day, the profile/timeline can replay everything the canonical snapshot exposes (hero gear, pets, rush score, XP). That keeps UI cards in sync with the daily history without recomputing from canonical on demand.

🔁 Nightly Ingest Flow

Load canonical: fetch all current players (state) for the clan.

Read last snapshot: SELECT * FROM player_day WHERE player_tag=? ORDER BY date DESC LIMIT 1.

Compute deltas: trophies, league, TH, hero_levels, donations, war_stars, capital, legend_attacks.

Classify events + score: convert changes to events; sum to notability.

Hash + write: if snapshot_hash unchanged and notability = 0, skip; else INSERT.

(Optional) partition/compact by month for storage efficiency.

🧮 Notability Rules (simple & API-friendly)

Event+Score

TH/Workshop/Lab upgrade completion+1

Any hero level up+1

League change+1

Δ trophies

War result with ≥ 4 stars (that day)+1

Raid Weekend participation ≥ threshold+1

Capital upgrade or notable contrib+1

Donations ≥ 50+1

Re-entered Legend League+1

Streak start/break (donations, legend attacks)+1

Days with notability ≥ 1 are rendered on the timeline.

🖼️ Frontend: Timeline & Exhibits

Timeline scrubber source: SELECT date, events, notability FROM player_day WHERE player_tag=? AND notability >= 1 ORDER BY date.

Tooltip/card: map events[] → small badges; show deltas.

Other views:

Hero progress: series from hero_levels + deltas.

Trophy trend: daily line from trophies.

Donations trend: donations vs donations_rcv.

War: war_stars (rolling 7-day).

Raid/Capital: weekend grouping over capital_contrib.

League tenure: segments from league changes.

Activity heatmap: calendar from notability.

🧰 TypeScript: Diff Builder & Writer

Drop this into your nightly job. It takes prev (yesterday) and current (canonical today), emits a compact PlayerDayRow, including events, deltas, notability, and a snapshot hash to dedupe identical rows.

ts

Copy code

// types.ts

export type HeroLevels = { bk?: number; aq?: number; gw?: number; rc?: number };

export type CanonicalPlayerState = {

date: string; // "YYYY-MM-DD" (ingest date)

clan_tag: string; // e.g., "#2PR8R8V8P"

player_tag: string; // e.g., "#ABC123"

th?: number;

league?: string; // e.g., "Legend League"

trophies?: number;

donations?: number; // daily

donations_rcv?: number; // daily

war_stars?: number; // stars earned today (if available)

capital_contrib?: number;// today

legend_attacks?: number; // today

hero_levels?: HeroLevels;// current levels

};

export type PlayerDayRow = {

date: string;

clan_tag: string;

player_tag: string;

th?: number;

league?: string;

trophies?: number;

donations?: number;

donations_rcv?: number;

war_stars?: number;

capital_contrib?: number;

legend_attacks?: number;

hero_levels?: HeroLevels;

deltas: Record<string, number>;

events: string[];

notability: number;

snapshot_hash: string;

};

ts

Copy code

// diff.ts

import crypto from "crypto";

import { CanonicalPlayerState, PlayerDayRow, HeroLevels } from "./types";

const TROPHY_DELTA_THRESHOLD = 100;

const DONATION_THRESHOLD = 50;

const WAR_STAR_THRESHOLD = 4;

const LEGEND_REENTRY = "Legend League";

function md5(input: string): string {

return crypto.createHash("md5").update(input, "utf8").digest("hex");

}

function diffNumber(prev?: number, curr?: number): number | undefined {

if (typeof prev !== "number" || typeof curr !== "number") return undefined;

const d = curr - prev;

return d !== 0 ? d : undefined;

}

function diffHero(prev?: HeroLevels, curr?: HeroLevels): Record<string, number> {

const keys: (keyof HeroLevels)[] = ["bk", "aq", "gw", "rc", "mp"];

const out: Record<string, number> = {};

for (const k of keys) {

const pd = prev?.[k];

const cd = curr?.[k];

if (typeof pd === "number" && typeof cd === "number" && cd !== pd) {

out[k] = cd - pd;

}

}

return out;

}

export function generatePlayerDayRow(

prev: CanonicalPlayerState | undefined,

curr: CanonicalPlayerState

): PlayerDayRow {

const deltas: Record<string, number> = {};

const events: string[] = [];

// Core numeric diffs

const trophyDelta = diffNumber(prev?.trophies, curr.trophies);

if (typeof trophyDelta === "number") deltas.trophies = trophyDelta;

const donationDelta = diffNumber(prev?.donations, curr.donations);

if (typeof donationDelta === "number") deltas.donations = donationDelta;

const donationRcvDelta = diffNumber(prev?.donations_rcv, curr.donations_rcv);

if (typeof donationRcvDelta === "number") deltas.donations_rcv = donationRcvDelta;

const warStarsDelta = diffNumber(prev?.war_stars, curr.war_stars);

if (typeof warStarsDelta === "number") deltas.war_stars = warStarsDelta;

const capitalDelta = diffNumber(prev?.capital_contrib, curr.capital_contrib);

if (typeof capitalDelta === "number") deltas.capital_contrib = capitalDelta;

const legendAtkDelta = diffNumber(prev?.legend_attacks, curr.legend_attacks);

if (typeof legendAtkDelta === "number") deltas.legend_attacks = legendAtkDelta;

// TH change

if (typeof prev?.th === "number" && typeof curr.th === "number" && curr.th !== prev.th) {

deltas.th = curr.th - prev.th;

events.push("th_level_up");

}

// League change

if (prev?.league && curr.league && prev.league !== curr.league) {

events.push("league_change");

}

// Legend re-entry (prev not Legend, now Legend)

if (curr.league === LEGEND_REENTRY && prev?.league !== LEGEND_REENTRY) {

events.push("legend_reentry");

}

// Hero diffs

const heroDiffs = diffHero(prev?.hero_levels, curr.hero_levels);

for (const k of Object.keys(heroDiffs)) {

deltas[`hero_${k}`] = heroDiffs[k];

}

if (Object.keys(heroDiffs).length > 0) events.push("hero_level_up");

// Pet / equipment diffs
if (JSON.stringify(prev?.pets ?? {}) !== JSON.stringify(curr.pets ?? {})) {
  events.push("pet_level_up");
}
if (JSON.stringify(prev?.equipment_levels ?? {}) !== JSON.stringify(curr.equipment_levels ?? {})) {
  events.push("equipment_upgrade");
}

// Threshold-based events

if (typeof trophyDelta === "number" && Math.abs(trophyDelta) >= TROPHY_DELTA_THRESHOLD) {

events.push("trophies_big_delta");

}

if (typeof curr.donations === "number" && curr.donations >= DONATION_THRESHOLD) {

events.push("donations_threshold");

}

if (typeof curr.war_stars === "number" && curr.war_stars >= WAR_STAR_THRESHOLD) {

events.push("war_perf_day");

}

if (typeof curr.capital_contrib === "number" && curr.capital_contrib > 0) {

events.push("capital_activity");

}

if (typeof curr.legend_attacks === "number" && curr.legend_attacks > 0) {

events.push("legend_activity");

}

// Notability score (binary per category)

const uniqueEventCategories = new Set<string>();

const categoryMap: Record<string, string> = {

th_level_up: "upgrade",

hero_level_up: "upgrade",

league_change: "league",

legend_reentry: "league",

trophies_big_delta: "trophies",

war_perf_day: "war",

capital_activity: "capital",

donations_threshold: "donations",

legend_activity: "activity"

};

for (const e of events) uniqueEventCategories.add(categoryMap[e] || e);

const notability = uniqueEventCategories.size;

// Stable, compact hash of core snapshot fields

const coreForHash = {

th: curr.th ?? null,

league: curr.league ?? null,

trophies: curr.trophies ?? null,

donations: curr.donations ?? null,

donations_rcv: curr.donations_rcv ?? null,

war_stars: curr.war_stars ?? null,

capital_contrib: curr.capital_contrib ?? null,

legend_attacks: curr.legend_attacks ?? null,

hero_levels: curr.hero_levels ?? null,

equipment_levels: curr.equipment_levels ?? null,

pets: curr.pets ?? null,

super_troops_active: curr.super_troops_active ?? null,

achievements: curr.achievements ?? null,

rush_percent: curr.rush_percent ?? null,

exp_level: curr.exp_level ?? null

};

const snapshot_hash = md5(JSON.stringify(coreForHash));

const row: PlayerDayRow = {

date: curr.date,

clan_tag: curr.clan_tag,

player_tag: curr.player_tag,

th: curr.th,

league: curr.league,

trophies: curr.trophies,

donations: curr.donations,

donations_rcv: curr.donations_rcv,

war_stars: curr.war_stars,

capital_contrib: curr.capital_contrib,

legend_attacks: curr.legend_attacks,

hero_levels: curr.hero_levels,

deltas,

events: Array.from(new Set(events)), // dedupe

notability,

snapshot_hash

};

return row;

}

ts

Copy code

// write.ts (pseudo-DAO for Postgres; adapt to your DB lib)

import { generatePlayerDayRow } from "./diff";

import { CanonicalPlayerState } from "./types";

// Decide whether to insert (avoid duplicates with hash + notability)

export async function writePlayerDay(

db: any,

prev: CanonicalPlayerState | undefined,

curr: CanonicalPlayerState

) {

const row = generatePlayerDayRow(prev, curr);

// check last by PK OR by date

const last = prev; // you likely queried this already

const lastHash = last ? await getLastHash(db, curr.player_tag) : null;

// Skip if identical and not notable

if (row.snapshot_hash === lastHash && row.notability === 0) return { skipped: true };

await db.query(

`

INSERT INTO player_day (

date, clan_tag, player_tag, th, league, trophies,

donations, donations_rcv, war_stars, capital_contrib, legend_attacks,

hero_levels, deltas, events, notability, snapshot_hash

) VALUES (

$1,$2,$3,$4,$5,$6,

$7,$8,$9,$10,$11,

$12::jsonb,$13::jsonb,$14::text[],$15,$16

)

ON CONFLICT (player_tag, date) DO UPDATE SET

th=EXCLUDED.th,

league=EXCLUDED.league,

trophies=EXCLUDED.trophies,

donations=EXCLUDED.donations,

donations_rcv=EXCLUDED.donations_rcv,

war_stars=EXCLUDED.war_stars,

capital_contrib=EXCLUDED.capital_contrib,

legend_attacks=EXCLUDED.legend_attacks,

hero_levels=EXCLUDED.hero_levels,

deltas=EXCLUDED.deltas,

events=EXCLUDED.events,

notability=EXCLUDED.notability,

snapshot_hash=EXCLUDED.snapshot_hash

`,

[

row.date, row.clan_tag, row.player_tag, row.th, row.league, row.trophies,

row.donations, row.donations_rcv, row.war_stars, row.capital_contrib, row.legend_attacks,

JSON.stringify(row.hero_levels ?? {}), JSON.stringify(row.deltas ?? {}),

row.events, row.notability, row.snapshot_hash

]

);

return { inserted: true };

}

async function getLastHash(db: any, player_tag: string): Promise<string | null> {

const res = await db.query(

`SELECT snapshot_hash FROM player_day WHERE player_tag=$1 ORDER BY date DESC LIMIT 1`,

[player_tag]

);

return res.rows?.[0]?.snapshot_hash ?? null;

}

### Backfill Strategy

1. **Seed from canonical history** – walk `canonical_member_snapshots` for each player in chronological order and feed the records through `generatePlayerDayRow`, writing out only when hashes/notability warrant it.
2. **Batch smartly** – process by clan/month (e.g., 250 players × 30 days) so the backfill stays memory friendly and can resume if interrupted.
3. **Validate afterwards** – compare row counts (`player_day` vs. expected snapshots), spot-check deltas in the UI, and ensure indices keep queries fast.
4. **Archive legacy history** – once the timeline UI reads from `player_day`, retire any ad hoc timeline JSON artifacts we no longer need.

### Event Vocabulary & Enum

- Maintain a shared enum (`th_level_up`, `hero_level_up`, `pet_level_up`, `equipment_upgrade`, `league_change`, `legend_reentry`, `trophies_big_delta`, `war_perf_day`, `capital_activity`, `donations_threshold`, `legend_activity`) so ingestion and UI stay aligned.
- Optionally persist `event_categories` alongside `events` if the API would rather not translate via `categoryMap` every request.
- When adding new events, update both the enum and the UI badge map to keep the scrubber/tooltips synchronized.

📈 UI Queries (examples)

sql

Copy code

-- Timeline points for scrubber (notable days only)

SELECT date, events, notability

FROM player_day

WHERE player_tag = $1 AND notability >= 1

ORDER BY date;

-- Hero progress series

SELECT date, hero_levels

FROM player_day

WHERE player_tag = $1

ORDER BY date;

-- Trophy trend

SELECT date, trophies

FROM player_day

WHERE player_tag = $1

ORDER BY date;

-- Donation trend (last 90 days)

SELECT date, donations, donations_rcv

FROM player_day

WHERE player_tag = $1 AND date >= CURRENT_DATE - INTERVAL '90 days'

ORDER BY date;

✅ Outcome

Scrubber restored: real frames from per-day rows with notability ≥ 1.

Comparative analytics unlocked: deltas/events power charts & summaries.

Canonical preserved: nightly corn remains single source for "latest".

Lightweight footprint: compact rows, hashes, and optional partitioning.
