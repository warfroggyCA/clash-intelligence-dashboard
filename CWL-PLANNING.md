# Clash Intelligence Dashboard – CWL Planning & UX Specification

> **Scope:** CWL only – simple, powerful planning tools without overcomplicating.  

> **Audience:** Humans + AI coders implementing CWL features.  

> **Goal:** Make CWL **easy to run**, **easy to rotate players**, and **easy to understand opponents**.

---

## 1. CWL goals for the dashboard

The CWL module should help the leader:

1. **Lock the CWL season roster** (the 15/30 accounts eligible for all 7 days).

2. **Understand the 7 opponent clans**:
   - Their TH distribution.
   - Their rough offensive strength (via TH + heroes).

3. **Pick a fair but competitive daily lineup** from that roster:
   - Day 1: best fit for the opener.
   - Later days: rotate players while staying competitive.

4. **See who actually attacked** each day (once the war is live).

5. **Export data to an LLM** with a clean preamble for advanced suggestions if desired.

We’re **not** trying to build a massive CWL "war room" with every edge case. Phase 1 is about:

- Clear roster.
- Clear opponents.
- Simple daily lineup decisions.
- Easy copy-to-LLM for deeper coaching.

---

## 2. CWL mental model in this tool

- CWL season has:
  - A **season roster**: 15 or 30 players locked for the whole week.
  - 7 war days (Day 1–7), each vs a different opponent clan.

- Our tool will:
  - Let you **lock that roster** at the start.
  - Let you **see all opponent clans** and their full rosters (as soon as known).
  - Let you **pick a daily lineup** from your season roster.
  - Let you **compare daily opponent strength** with your available players.
  - Let you **copy structured data** to an LLM for advice.

We **do not** change the actual in-game roster. This is a planning & tracking layer that *assumes* you then configure CWL correctly in-game.

---

## 3. CWL pages (minimal set)

We use three core pages:

1. `/war/cwl` – **CWL Season Overview**

2. `/war/cwl/roster` – **CWL Season Roster Setup**

3. `/war/cwl/day/[dayIndex]` – **Daily War-Day Planner** (Day 1..7)

Everything else (analytics, medal distribution, etc.) can come later.

---

## 4. CWL Season Overview (`/war/cwl`)

### 4.1 Purpose

- Show:
  - That CWL is active.
  - Who the opponents are for each day.
  - Quick context for today and tomorrow.

- Link to:
  - Roster setup.
  - Daily planning page for each day.

### 4.2 Layout

**Sections:**

1. **Season header**
   - League name (if known), e.g. "Crystal I / Master III".
   - War size: 15v15 or 30v30.
   - Season label: e.g. "2025-07 CWL".

2. **Opponent list & days**

Simple table:

- Columns:
  - Day (1–7).
  - Opponent clan name.
  - Opponent clan tag.
  - Status: `Not loaded` / `Roster loaded` / `War finished`.
  - Link: `Open Day {N} planner` → `/war/cwl/day/[N]`.

You **do not** see opponent participants per day (game decides that), but you do see their **full clan roster** once loaded.

3. **Season roster status**

Small card:

- Text:
  - "Season roster: X / 15 (or 30) selected"
  - "Status: Locked / Not locked"
- Button:
  - `Manage CWL Season Roster` → `/war/cwl/roster`.

4. **Quick actions**

- `Manage CWL Season Roster`
- `Open today's war-day planner` (if we know today's index)
- `Copy season overview for LLM` (optional, later)

---

## 5. CWL Season Roster Setup (`/war/cwl/roster`)

### 5.1 Purpose

- First thing you do at CWL start:
  - Choose which 15 or 30 accounts are **eligible** for the whole 7 days.

- This matches your "very, very, very first thing" requirement:
  - Present everyone in the clan.
  - You tick who is in the season.
  - Once saved, that becomes the pool for daily planners.

### 5.2 Data needed

For each **clan member at CWL signup time**:

- Player name.
- Tag.
- TH level.
- Hero levels (optional summary e.g. combined hero level).
- Basic "reliability" metric if available (e.g. missed war attacks from history – can be v2).

### 5.3 Layout

**Top card: "CWL Season Roster"**

- War size selector: `15` or `30` (read-only if already known from the game).
- "Season roster selected: X / warSize".
- Warning if:
  - Less than warSize chosen.
  - More than warSize chosen (disallow saving).

**Table: all current clan members**

Columns:

- Checkbox: `In CWL season roster`.
- Name.
- TH.
- Hero power indicator (optional).
- Reliability indicator (optional, shading/flair – not required for v1).

Interactions:

- You scroll through everyone and tick 15 (or 30) players.
- Once done, you click `Save season roster`.

**Actions:**

- `Save season roster`:
  - Stores the list of eligible CWL players for this season.
  - These are the **only players** shown later on the daily pages.

- `Lock roster` (optional step):
  - After you're happy, you can "lock" so you don't accidentally mess it up.
  - Lock can be undone only by leaders.

**Nice-to-have (later):**

- Show simple TH distribution of selected players:
  - e.g. TH16 x 5, TH15 x 6, etc.
- Show a short text: "This is your core squad for all 7 days."

---

## 6. Opponent data model & loading

We keep this **very simple**.

### 6.1 Concept

- For each of the 7 war days:
  - You'll know which clan you're fighting.
  - You won't know their final 15/30 lineup in advance.

- Our tool will:
  - Store the **opponent clan name + tag** for each day.
  - When you're ready, fetch the **full clan roster** via the Clash API (once per opponent).

### 6.2 Data we store per opponent

For each opponent clan (per day):

- Clan name.
- Clan tag.
- For each member at the time we fetch:
  - Name.
  - Tag.
  - TH level.
  - Hero levels (if API provides).

We derive:

- TH distribution:
  - Counts of each TH.

- Simple "strength index":
  - Example: average hero sum for top 15, 20, 25 players.

### 6.3 Where do we show this?

- On `/war/cwl/day/[N]`:
  - Opponent summary card:
    - TH distribution.
    - Example: "Their top 15 are roughly: 10 x TH16, 5 x TH15."
  - This is the context we use to suggest which of our players should play Day N.

---

## 7. Daily War-Day Planner (`/war/cwl/day/[dayIndex]`)

Route example: `/war/cwl/day/1` for Day 1.

### 7.1 Purpose

For each CWL day:

- Show:
  - Opponent clan info.
  - Our season roster.

- Help the leader:
  - Choose which 15 (or 30) from the season roster will play.
  - See a rough recommendation (heuristic).
  - Optionally export data to an LLM for deeper advice.

### 7.2 Page layout

Sections (from top to bottom):

1. Day header & opponent summary  
2. Our season roster (selection for that day)  
3. Simple recommendation hints  
4. LLM export (copy block)  

We are **not** doing full target assignment on this page in Phase 1. This is about **who plays** each day, not "who hits which base".

---

### 7.3 Section 1 – Day header & opponent summary

Header:

- "CWL – Day {N} vs {Opponent clan name}"
- Opponent clan tag.
- If war is already in progress or finished:
  - Show stars / result (if we read it from API later – optional).

Opponent summary card:

- TH distribution:
  - `TH16: X`, `TH15: Y`, etc.

- High-level strength:
  - Example metrics:
    - "Top 15 avg hero sum: 290"
  - Short descriptive line:
    - "This is a **strong** roster with heavy TH16 concentration."

- Button:
  - `Refresh opponent roster` – re-fetch their clan data if needed.

---

### 7.4 Section 2 – Our season roster selection for the day

Table of **only the season roster** (15/30 players):

Columns:

- Checkbox: `Playing today` (true/false).
- Name.
- TH.
- (Optional) hero power indicator.
- (Optional) fairness indicator: how many CWL attacks they've had so far this season (if tracked).

Constraints:

- You must select exactly `warSize` players to "play today".
- If you try to save with fewer or more, show validation.

**Actions:**

- `Select lineup for Day {N}` (save button):
  - Stores who is scheduled to play Day N in our tool.
  - We can later compare this with actual participants (if we can read from API), but that's not essential for v1.

---

### 7.5 Section 3 – Recommendation hints (heuristic)

We keep this **very light** and explicit.

The backend (or client) can compute:

- Opponent top-TH distribution (e.g. "They have 10 TH16, 5 TH15").
- Our season roster sorted by:
  - TH, then hero power.
- Fairness hint:
  - How many times each player has already played in earlier days.

UI hint:

- On the roster table, we can:
  - Highlight players the heuristic suggests for today:
    - e.g. a subtle "Suggested for today" badge for the strongest 15 who have **played the fewest days so far**.
  - This is not automatic; leader still checks the boxes manually.

**Heuristic logic (first pass):**

- Sorted by TH (desc), then hero power (desc).
- Start from top and:
  - Favor players with fewer "days played" so far.
  - Ensure we still have enough raw strength vs opponent top THs.

We describe it in the doc so Codex has something to implement; we don't need to make it perfect.

---

### 7.6 Section 4 – LLM export (copy block)

We reuse your existing pattern: no auto-AI calls; we provide a "Copy for AI" button.

Button: `Copy rosters for AI help`

Clipboard payload (text):

1. **Preamble** – sets context and expectations.
2. **Our season roster** – all players, with TH and hero power.
3. **Opponent clan roster summary** – their TH distribution and, if possible, a list of top 20.

Example structure (simplified):

```txt
You are an expert Clash of Clans Clan War League strategist.

You will see:

- Our clan's CWL season roster (all players eligible for the week).

- Today's opponent clan and their roster summary.

We are playing in a {warSize}v{warSize} format in CWL Day {dayIndex}.

We want to:

- Select the best {warSize} players from our roster for today's war.

- Balance fair participation over the week with the need to win.

- Avoid relying only on the most overpowered accounts every day.

Constraints:

- Only players in the season roster can be used.

- You do NOT know which enemy players will be selected today, so treat the enemy clan roster as a worst-case pool.

- Focus on Town Hall level first, and reliability/fairness second.

Please:

1. Recommend which {warSize} of our players should play today.

2. Explain briefly why, mentioning TH levels and overall strength.

3. If there are "borderline" players, suggest alternates.

---

Our season roster:

[

  { "name": "Player1", "tag": "#AAA", "th": 16, "heroPower": 290, "daysPlayedSoFar": 0 },

  { "name": "Player2", "tag": "#BBB", "th": 16, "heroPower": 275, "daysPlayedSoFar": 1 },

  ...

]

Opponent clan:

{

  "name": "EnemyClan",

  "tag": "#ENEMYTAG",

  "thDistribution": {

    "16": 10,

    "15": 5,

    "14": 3,

    "13": 2

  },

  "topPlayersExample": [

    { "name": "Enemy1", "th": 16, "heroPower": 295 },

    ...

  ]

}
```

The UI doesn't need to show all of this text; it just needs a Copy button and a tooltip like "Copies a detailed prompt + roster data for your AI tool of choice".

---

## 8. Data & state for CWL (minimal for Phase 1)

We only need these extra pieces to support this plan:

```typescript
// Season-level
export interface CwlSeason {
  id: string;
  clanId: string;
  seasonId: string;         // e.g. "2025-07"
  warSize: 15 | 30;
  createdAt: string;
}

// Season roster
export interface CwlSeasonPlayer {
  id: string;
  cwlSeasonId: string;
  playerId: string;         // FK to Player
  inSeasonRoster: boolean;  // true if selected
  // optional: cached TH, heroPower at signup
}

// Opponent per day
export interface CwlDayOpponent {
  id: string;
  cwlSeasonId: string;
  dayIndex: number;         // 1..7
  clanName: string;
  clanTag: string;
}

// Opponent roster snapshot (optional but useful)
export interface CwlOpponentMemberSnapshot {
  id: string;
  cwlDayOpponentId: string;
  name: string;
  tag: string;
  townHallLevel: number;
  heroPower?: number | null;
}

// Our `playing today` selection
export interface CwlDayLineup {
  id: string;
  cwlSeasonId: string;
  dayIndex: number;
  playerId: string;
  playingToday: boolean;
}
```

Later, if you want to track who actually attacked, you can add:

```typescript
export interface CwlDayAttackResult {
  id: string;
  cwlSeasonId: string;
  dayIndex: number;
  playerId: string;
  stars: number | null;
  destructionPercent: number | null;
}
```

…but that's optional for your first CWL.

---

## 9. Workflow recap

To keep it clear for future you (and Codex):

**Before CWL starts / day 0**

1. Go to `/war/cwl/roster`.
2. Select 15 or 30 players for the season roster.
3. Save (and optionally lock).

**Once group is known / opponents revealed**

1. Go to `/war/cwl`.
2. For each day, fill in opponent clan name/tag (if not auto-fetched).
3. On a day's page, click "Load opponent roster" to fetch and store their TH distribution.

**For each war day (e.g. Day 1)**

1. Open `/war/cwl/day/1`.
2. See opponent summary (TH spread, rough strength).
3. See your season roster.
4. Tick `Playing today` for exactly 15 or 30 accounts.
5. Optionally use the heuristic hints + LLM export to decide.
6. Save lineup, then go set those players in-game.

**During / after war (optional extras)**

1. Mark who actually attacked to adjust future reliability metrics.
2. Use that later for better suggestions.

