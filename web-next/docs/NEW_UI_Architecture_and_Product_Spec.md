Here you go — one big, explicit, Codex-ready “bible” in markdown:
# Clash Intelligence Dashboard – NEW UI Architecture & Product Spec

> **Status:** Draft v1  
> **Scope:** Phase 1 (single-clan, web app, no public marketing site)  
> **Audience:** Humans + AI coding agents (Codex, etc.).  
> **Rule:** This document is the **source of truth** for UX, flows, and data for the `/new` UI.

---

## 0. High-level summary

The Clash Intelligence Dashboard is a web app for a single Clash of Clans clan that:

- Gives **leaders** a command console to manage:
  - Player performance and participation
  - Joins / leaves / warnings / notes
  - War rosters and war plans
  - Capital raids and other analytics

- Gives **members**:
  - A personal performance hub
  - Historical and trending stats not available in-game
  - Context on current wars and clan status

Phase 1 focuses on:

- Core navigation and layout
- Players & Player profiles
- War Planner and War History (regular wars)
- Basic Analytics (war + activity + donations)
- Leadership tools (review queue, warnings)
- Settings (permissions, basic thresholds)
- Cron-based data model (nightly snapshot)
- Simple auth (no marketing site)

Multi-clan, external notifications, deep CWL tooling, and public landing pages are **Phase 2+**.

---

## 1. Personas & roles

### 1.1 Roles

We have logical roles, usually mapped from in-game roles, but stored in our own auth:

- `LEADER`
- `CO_LEADER`
- `ELDER`
- `MEMBER`
- `VISITOR` (logged in but not part of current clan roster)

### 1.2 Permissions (conceptual)

Permissions are controlled through **chip switches** in Settings (Phase 1 implementation uses a static mapping; UI for editing can be basic).

Expected defaults:

- **LEADER / CO_LEADER**
  - Full access to:
    - Leadership section
    - Player add/remove
    - Warnings / notes
    - War Planner
    - Analytics
    - Settings

- **ELDER**
  - Read access to:
    - Leadership views
    - Analytics
  - Limited updates:
    - Add notes
    - View warnings
  - No:
    - Player add/remove
    - Settings changes

- **MEMBER**
  - Read-only access to:
    - Dashboard (member variant)
    - Players (cards and table)
    - Their own profile’s full details
    - War headline and basic war info
  - No:
    - Leadership
    - Settings
    - War Planner

- **VISITOR**
  - Read-only access to a very small subset (TBD).
  - For Phase 1 assume mostly testing; can be treated similar to `MEMBER` but with restrictions if needed.

Permissions are enforced in the UI (conditional rendering) and in APIs.

---

## 2. Global principles

1. **Single source of truth**:  
   All normal UI views use data from the nightly **cron snapshot** – no random live API calls on simple navigation.

2. **Snappy UX**:
   - All main list and detail pages read precomputed data.
   - On-demand API calls are **visible and explicit**, tied to clear buttons like “Add player” or “Refresh opponent roster”.

3. **Role-aware first screen**:
   - Leaders see: “while you were away,” active war, review items.
   - Members see: personal snapshot + clan overview.

4. **Layout stability**:
   - Player profile uses fixed slots and layout so flipping between players keeps the same structure; only values change.

5. **Clan names over tags**:
   - Everywhere we show a clan, the **name** is primary; tag is secondary (pill or smaller text).

6. **One canonical Player Profile**:
   - All navigation paths (Roster, Player DB, Leadership, Analytics) lead to the same profile view.

---

## 3. Tech stack assumptions

_(These are assumptions; adjust if different, but Codex should treat them as default.)_

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Styling**: Tailwind CSS or similar utility CSS (not critical to logic, can be abstracted in prompts)
- **Backend**:
  - Supabase (Postgres + auth) or similar DB layer
  - Node API routes under `/app/api`
- **Cron**:
  - Server-side scheduled jobs (e.g., Supabase cron, Vercel cron, or external worker)
  - Cron runs at **04:30** and **05:30** UTC

- **Data from Clash API**:
  - Player snapshots
  - Clan snapshot
  - War logs (where available)
  - CWL data (minimal for Phase 1)
  - Capital Raid data (if accessible; otherwise we rely more on in-app captured data)

---

## 4. Data model (entities & TypeScript shapes)

> NOTE: This describes **logical shapes**, not exact DB schemas. Codex can map these to DB tables/columns.

### 4.1 Player-related types

```ts
export type PlayerStatus =
  | 'IN_CLAN'
  | 'NOT_IN_CLAN'
  | 'PENDING_ADD'
  | 'PENDING_REMOVE';

export type PlayerRole =
  | 'LEADER'
  | 'CO_LEADER'
  | 'ELDER'
  | 'MEMBER'
  | 'VISITOR';

export interface Player {
  id: string;             // Internal UUID
  tag: string;            // Clash tag (e.g. #XXXX)
  name: string;
  townHallLevel: number;
  clanName?: string | null;
  clanTag?: string | null;
  status: PlayerStatus;
  role: PlayerRole;       // Derived from clan rank where possible
  createdAt: string;      // ISO
  updatedAt: string;
}

export interface PlayerLinkedAccount {
  id: string;
  playerId: string;       // FK to Player
  linkedTag: string;
  linkedName: string;
  linkedTownHallLevel: number;
  inClan: boolean;
}

export interface PlayerWarning {
  id: string;
  playerId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  createdAt: string;
  createdBy: string;      // user id or name
}

export interface PlayerNote {
  id: string;
  playerId: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

export interface PlayerTenureSegment {
  id: string;
  playerId: string;
  joinedAt: string;       // date joined
  leftAt?: string | null; // null if still in clan
}

export interface PlayerSnapshot {
  id: string;
  playerId: string;
  snapshotDate: string;   // Date of cron
  townHallLevel: number;
  heroes: {
    barbarianKing: number;
    archerQueen: number;
    grandWarden: number;
    royalChampion: number;
    [key: string]: number | undefined;
  };
  // Additional stats as needed
}

export interface PlayerPerformanceMetrics {
  playerId: string;
  snapshotDate: string;   // computed per cron
  warStarsRecent: number;
  warAttacksRecent: number;
  warHitRateRecent: number | null;
  donationsGivenRecent: number;
  donationsReceivedRecent: number;
  warsParticipatedRecent: number;
  // capital raids, etc, can be added later
}
4.2 Clan & metrics
export interface Clan {
  id: string;            // internal UUID
  name: string;
  tag: string;
  description?: string;
  badgeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClanMetricsDaily {
  id: string;
  clanId: string;
  date: string;          // e.g., "2025-01-15"
  warWinsLastN: number;
  warLossesLastN: number;
  warDrawsLastN: number;
  avgStarsPerAttackLastN: number | null;
  activeMembersCount: number;
  totalMembersCount: number;
  donationsGivenLastN: number;
  donationsReceivedLastN: number;
  // any other metrics we pre-aggregate
}
4.3 War & war planner
export type WarStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';

export interface War {
  id: string;
  clanId: string;
  opponentClanName: string;
  opponentClanTag: string;
  size: number;                    // e.g. 10 for 10v10
  status: WarStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  result?: 'WIN' | 'LOSS' | 'DRAW' | null;
  ourStars?: number | null;
  opponentStars?: number | null;
  heuristicSummaryId?: string | null;
}

export interface WarRosterEntry {
  id: string;
  warId: string;
  side: 'OUR' | 'OPPONENT';
  orderIndex: number;              // 0..size-1 (optional for matching)
  playerTag: string;
  playerName: string;
  townHallLevel: number;
  heroesSnapshot: {
    [heroName: string]: number;
  };
}

export interface WarHeuristicSummary {
  id: string;
  warId: string;
  generatedAt: string;
  content: string;                 // textual heuristic summary
}

export interface WarPlanNote {
  id: string;
  warId: string;
  createdAt: string;
  createdBy: string;
  content: string;
}
4.4 CWL (Phase 1.5 outline)
export interface CwlSeason {
  id: string;
  clanId: string;
  seasonId: string;        // e.g. "2025-03"
  leagueName: string;
  createdAt: string;
}

export interface CwlWarDay {
  id: string;
  cwlSeasonId: string;
  dayIndex: number;        // 0..6
  opponentClanName: string;
  opponentClanTag: string;
  ourStars: number | null;
  opponentStars: number | null;
}
4.5 Capital raids
export interface RaidWeekend {
  id: string;
  clanId: string;
  startDate: string;
  endDate: string;
  totalGoldLooted: number;
}

export interface RaidContribution {
  id: string;
  raidWeekendId: string;
  playerTag: string;
  playerName: string;
  goldLooted: number;
  attacks: number;
  avgDamage: number | null;
}
4.6 Auth & user
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: PlayerRole;        // maps to dashboard permissions
  playerTag?: string | null; // link to a Player if applicable
}

5. Cron jobs & data freshness
5.1 Cron schedule
cron_1: 04:30 UTC
cron_2: 05:30 UTC
Both cron jobs:
Pull clan snapshot.
Pull all current clan members' player snapshots.
Pull war log / current war (where possible).
Pull CWL state (if clan is in CWL).
Pull Capital Raid data (where accessible).
Compute:
ClanMetricsDaily
PlayerPerformanceMetrics
Update PlayerTenureSegment entries.
5.2 UI usage
UI uses:
Latest ClanMetricsDaily for today (or last successful cron).
Latest PlayerSnapshot per player.
Latest PlayerPerformanceMetrics per player.
Display data freshness, e.g.:
Dashboard: “Data as of 2025‑01‑15 05:30 UTC”
Player profile: “Stats last updated 2025‑01‑15 05:30 UTC”

6. API / data access layer
NOTE: This is conceptual. Codex can implement these as Next.js API routes or as client-wrapped DB calls.
6.1 Player APIs
GET /api/players
Query params:
status (optional, e.g. IN_CLAN, ALL)
search (name/tag, optional)
limit, offset
Returns:
Array of Player records with recent PlayerPerformanceMetrics aggregated.
GET /api/players/[id]
Returns:
Player
PlayerLinkedAccount[]
Latest PlayerSnapshot
Recent PlayerPerformanceMetrics
PlayerWarning[]
PlayerNote[]
PlayerTenureSegment[]
Aggregated metrics vs clan average
POST /api/players/add
Body:
playerTag
note?
linkedTags? (string[])
hasAlreadyLeft? (boolean)
Performs:
Clash API call to fetch player.
Supabase lookup for historical record.
Create/update Player + Tenure + Linked accounts.
Returns:
Player with any previousTenure and warnings.
POST /api/players/[id]/remove
Body:
reason or note
Marks:
Player as PENDING_REMOVE
Updates current Tenure segment
Returns updated Player.
POST /api/players/[id]/notes
Adds a note.
POST /api/players/[id]/warnings
Adds a warning.
6.2 War APIs
POST /api/war/planner/start
Body:
None (or optional default if needed)
Creates a new War with status: PLANNING.
POST /api/war/planner/select-our
Body:
warId
playerIds (array of player internal IDs or tags)
Saves selection for our side.
POST /api/war/planner/set-opponent-clan
Body:
warId
opponentClanTag
Calls Clash API to fetch clan + roster.
POST /api/war/planner/select-opponent
Body:
warId
opponentPlayerTags (tags, count must match our players)
Validates counts; saves selection.
POST /api/war/planner/fetch-stats
Body:
warId
Populates WarRosterEntry for both sides.
POST /api/war/planner/save-roster
Body:
warId
Moves War to status: ACTIVE (or remains PLANNING if desired).
Returns War with roster.
POST /api/war/[warId]/heuristic
Body:
None
Runs heuristic analysis on our side vs opponent, saves WarHeuristicSummary.
POST /api/war/[warId]/plan
Body:
content (leader notes, plan)
Saves WarPlanNote and attaches to war.
POST /api/war/[warId]/complete
Body:
ourStars
opponentStars
result (WIN/LOSS/DRAW)
Marks War as COMPLETED and takes final snapshot.
GET /api/war/current
Returns:
Current active war (if any) + rosters + heuristic summary + plan.
GET /api/war/history
Query:
Pagination, maybe filters
Returns:
List of completed wars with basic info.
GET /api/war/[warId]
Returns:
War + WarRosterEntry[] + WarHeuristicSummary + WarPlanNote[].
6.3 Analytics APIs
GET /api/analytics/clan
Returns:
ClanMetricsDaily for recent N days.
War stats aggregated.
GET /api/analytics/players
Returns:
Aggregated PlayerPerformanceMetrics for all players.
GET /api/analytics/capital
Returns:
RaidWeekend[] + aggregated RaidContribution[].
6.4 Leadership APIs
GET /api/leadership/review-queue
Returns:
New joins (since last leader review).
Recent leaves.
Players with warnings.
Pending adds/removes.
POST /api/leadership/acknowledge-join
Body:
playerId
Removes player from the "needs review" queue.
6.5 Settings APIs
GET /api/settings
POST /api/settings
Exact shape of settings can evolve; for Phase 1, focus on:
Thresholds (inactivity, donation expectations)
Permissions mapping (role → capability)
AI snippet templates (preamble, war blurbs)

7. Routing & navigation
7.1 Route map (Next.js App Router)
/ → Dashboard
/players → Players list
/players/[id] → Player profile
/war → War overview
/war/planner → War Planner
/war/history → War history list
/war/[warId] → War detail
/analytics → Analytics home
/analytics/capital → Capital Raid analytics
/leadership → Leadership home (review queue)
/settings → Settings home
/login → Simple login page
7.2 Navigation structure (UI)
Left sidebar (persistent):
Dashboard
Players
War
Analytics
Leadership
Settings
Top bar:
Global search input
User menu (profile/logout)
Optional data freshness indicator

8. Dashboard specification
8.1 Layout
Page pattern:
Top region:
Active war headline (if any)
Data freshness indicator
Middle region:
Role-specific “What’s new since you last visited”
Bottom region:
Summary KPIs and quick actions
8.2 Leader view
Sections:
Active War headline (if active war exists)
Shows:
“Active war vs {opponentClanName} ({size}v{size})”
Status: “Planning”, “War in progress”, or “Completed (awaiting mark)”
Quick actions:
View war plan (link to /war/[warId])
Open war planner (if war still planning)
Copy chat blurb (pre-filled short string)
If no war: show CTA Open war planner.
Data freshness
Compact card:
“Data last updated: 2025‑01‑15 05:30 UTC”
“Next scheduled cron: 2025‑01‑16 04:30 UTC” (if desired)
While you were away (leaders)
Lists changes since last login:
New joins:
For each:
Name, TH, join date.
Flag Returning player if we have previous tenure.
Show Old name(s) if different.
Warning icon if they have warnings.
Leaves:
Name, TH, leave date, any last notes.
Pending adds/removes:
Players in PENDING_ADD / PENDING_REMOVE.
Each item links to the Player Profile.
Top-level CTA: Review all in Leadership (navigate to /leadership).
Clan health snapshot
3–4 KPI tiles:
War record last 10 wars (wins / losses / draws).
Avg stars per attack last N wars.
Active members (attacked in last N wars) vs total.
Donations given vs received last period.
Each tile can link to relevant Analytics detail.
Quick actions
Add player → opens Add Player flow (modal or redirect).
Open war planner (if no active war).
Review new joins → /leadership.
8.3 Member view
Sections:
Active War headline
Show same opponent and size.
Only one CTA: See war detail (no war planner access).
My snapshot
Components:
TH, hero levels.
War stats last N wars (e.g., stars, attacks).
Donations: given vs received last period.
Visual: small trend arrows or micro charts.
Compared to clan
A small panel:
“You vs clan average”
For 2–3 metrics:
War stars (recent)
Donations
Activity (wars participated)
Clan summary
Tiles (similar to leader view, but without management emphasis).

9. Players section specification
9.1 Unified player list
Route: /players
Default view:
Table view for leaders.
Card view for regular members (leader can toggle to cards too).
Controls:
Filters:
Status: Current clan (default) vs All players.
Role: Leader / Co-Leader / Elder / Member / Visitor.
Warnings: Has warnings / No warnings.
Search bar:
By name or tag.
Sort:
Name (alphabetical)
TH
Role
VIP / pulling weight (if implemented)
Last activity
9.1.1 Table view columns
Name
Tag
TH
Role
Status (In clan / Pending add / Pending remove / Not in clan)
Warning icon (if any, with tooltip count)
War performance summary (stars/attacks recent)
Donations summary (given/received)
Last seen (optional)
Clicking a row → /players/[id].
9.1.2 Card view
Each card shows:
Player name + TH + role.
Tag (small).
Quick stats (small subset):
War stars recent
Donations recent
Warning badge if present.
View profile button (or clickable entire card).
9.2 Add player flow
Entry points:
Dashboard quick action.
Players page button Add player.
UI steps:
Player tag input
Single input box for Clash player tag.
CTA: Look up player.
Confirm identity & context
Show:
Name, TH, role from Clash API.
Query Player DB:
If known:
Show “Returning player” badge.
List previous tenure(s).
Show previous name(s).
Show any warnings (with severity).
Inputs:
Optional note (textarea).
Optional linked accounts:
Text field for comma-separated tags or chip-based input (“Add linked account”).
Checkbox: Player has already left (for fast join+leave scenario).
Save
On confirm:
Create/update Player.
Update Tenure segments.
Create LinkedAccount records.
If Player has already left is checked:
Record a short tenure with join+leave.
Set status appropriately (e.g. NOT_IN_CLAN, not PENDING_ADD).
Else:
Mark as PENDING_ADD until cron confirms.
Post-save
Option to go to:
Player Profile, or
Back to Roster (with filter highlighting new player).
9.3 Remove player flow
Trigger: from Player Profile or player list row (leader only).
Steps:
Click Remove from clan.
Confirmation dialog:
Show:
Player name, TH.
Any warnings.
Recent activity summary.
Input:
Required reason / note (short text).
On confirm:
Mark Player as PENDING_REMOVE.
Update Tenure segment end date.
UI indicates:
Player appears with Pending remove chip until next cron.
9.4 Player profile
Route: /players/[id].
9.4.1 Layout & navigation
Left/right arrows at top:
Navigate to previous/next player in the current list context (same filter & sort).
Preserved scroll position:
When switching via arrows, keep scroll at same Y coordinate.
This enables visual comparison of specific sections across players.
Layout is fixed:
Slots for name, badges, stats, etc, do not move across players, so scanning differences is easy.
9.4.2 Sections
Header
Large name.
TH icon + level.
Clan name + tag (if in clan).
Role (Leader/Co/Elder/Member).
Status pill: In clan / Not in clan / Pending add / Pending remove.
Warning badges (colored by severity) – leader/elder view.
Last updated timestamp.
Linked accounts
Row of chips:
Each chip: [Name] TH [X] with a small tag and optional “Not in clan” label.
Chips are clickable → go to that profile.
Manage linked accounts button:
Opens modal to add/remove links.
Avoid inline “X” delete on chips to prevent accidental removal.
Current snapshot
TH + hero levels in consistent positions:
All hero icons in a grid with levels.
Other important stats:
Troop levels if needed (optional).
Layout stable so flipping between players keeps everything lined up.
Performance summary
War:
Stars per attack over last N wars.
Number of attacks.
Hit rate (if available).
Donations:
Given vs received over recent period.
Activity:
Wars participated in last N wars.
Capital raid participation (if tracked).
Compared to clan
Panel like:
“You vs clan average (last N wars)”
For each metric:
Player value, clan average, simple indicator (above / about equal / below).
Example metrics:
War stars per attack.
Donations given.
Wars participated.
Timeline / milestones
Chronological list or visual timeline:
Joined clan.
Left clan.
Returned.
TH level-up events.
Hero milestones (e.g. max hero at certain TH).
Important war achievements (first 3-star at TH N, etc, if available).
Filter or show only “important events” to avoid clutter.
Notes & warnings
Notes:
List with date and author.
Add-note form (leaders/elders).
Warnings:
List with severity, message, date, author.
Add-warning form (leaders only).
Warning badges also appear in header.

10. War section
10.1 War overview (/war)
If there is an active or planning war:
Show summary card:
Opponent clan (name + tag).
War size.
Status (planning / active).
Link: View details (/war/[warId]).
Link: Open War Planner (if planning).
List of recent wars (like mini history):
Opponent.
Result (if completed).
Date.
10.2 War Planner (/war/planner)
War Planner is a multi-step flow.
10.2.1 Step 1 – Select our participants
Show alphabetical list of current clan players.
Each line: Name (primary), optional TH, checkbox.
No detailed stats here.
User selects players who will participate.
Selected count defines war.size.
Step CTA: Next (disabled until at least 1 player is selected).
10.2.2 Step 2 – Set opponent clan
Input: Opponent clan tag.
On Look up:
Call Clash API.
Fetch opponent clan name + roster.
Show opponent roster in alphabetical list:
Name, optional TH, checkbox.
Enforce:
User can select exactly war.size opponent players.
If too many or too few selected, show validation and disable Next.
Step CTA: Next when counts match.
10.2.3 Step 3 – Fetch full stats
Confirmation screen:
“You selected X players from your clan, X from opponent clan. Fetch full stats?”
CTA: Fetch stats.
Calls APIs:
For our players: uses snapshot where possible.
For opponent players: calls Clash API to fetch hero levels etc.
On success:
Show summary table:
Two columns: Our players vs Opponent players.
Each row: player names, THs, hero levels.
10.2.4 Step 4 – Save war roster
User can review summary.
CTA: Save war roster.
Creates or updates War record with status: PLANNING or ACTIVE.
Saves WarRosterEntry entries for both sides.
After save:
War is accessible at /war/[warId].
10.3 War detail (/war/[warId])
Sections:
Header
“War vs {opponentClanName} ({size}v{size})”
Status: PLANNING / ACTIVE / COMPLETED.
Buttons:
Copy war data for AI (LLM payload).
Copy short chat summary (for in-game chat).
Mark war as over (leaders only, when ready).
Roster overview
Side-by-side lists or table:
Our roster (with TH and hero summary).
Opponent roster.
Optional sort by TH or order index.
Heuristic summary
If WarHeuristicSummary exists:
Show content.
Button: Run heuristic analysis (if none yet) — calls POST /api/war/[warId]/heuristic.
War plan
Text area showing latest WarPlanNote or aggregated notes.
Edit plan / Add note for leaders.
Outcome (if completed)
Our stars vs opponent stars.
Result (WIN / LOSS / DRAW).
Date/time.
Short chat summary
Non-editable text with:
Opponent name and size.
Simple difficulty label (derived, e.g., from TH/hero comparisons).
Copy button.
10.4 LLM export payload
The Copy war data for AI button copies text like:
You are an expert Clash of Clans war strategist.

You will receive:
- The roster for our clan in the upcoming war.
- The roster for the enemy clan.
- Town Hall levels and hero levels for each player.
- (Optional) A heuristic summary generated by a previous analysis.

Your task:
- Suggest an ideal attack assignment plan.
- Identify favorable and risky matchups.
- Recommend which of our players should hit which enemy bases.
- Highlight any obvious structural advantages or disadvantages.

Constraints:
- This is a standard {size}v{size} war.
- Use normal Clash of Clans war rules (2 attacks per player, max stars 3 per base).

Data follows in JSON format:

{
  "warId": "...",
  "size": 10,
  "ourClan": {
    "name": "OurClan",
    "tag": "#XXXX",
    "players": [
      {
        "tag": "#AAAA",
        "name": "Player1",
        "townHallLevel": 14,
        "heroes": {
          "barbarianKing": 80,
          "archerQueen": 80,
          "grandWarden": 55,
          "royalChampion": 30
        }
      }
      // ...
    ]
  },
  "opponentClan": {
    "name": "OpponentClan",
    "tag": "#YYYY",
    "players": [
      {
        "tag": "#BBBB",
        "name": "Enemy1",
        "townHallLevel": 14,
        "heroes": {
          "barbarianKing": 75,
          "archerQueen": 78,
          "grandWarden": 50,
          "royalChampion": 25
        }
      }
      // ...
    ]
  },
  "heuristicSummary": "<optional text here>"
}
AI agents should not modify this format; only the preamble can be tweaked via Settings in future phases.

11. War history (/war/history)
Table listing completed wars:
Date
Opponent clan (name + tag)
Size
Our stars vs opponent stars
Result (WIN/LOSS/DRAW)
Clicking row → /war/[warId] in read-only “historic” mode.

12. CWL (Phase 1.5 minimum)
For Phase 1, CWL can be a simple sub-page under War:
/war/cwl
Shows:
Current/last CWL season:
League name
Day-by-day war results (opponent + stars).
Per-player CWL stars for the season (simple table).
No deep lineup management or planner logic in Phase 1; only display of data we can pull/derive.

13. Analytics
13.1 Analytics home (/analytics)
Sections:
Clan war analytics
Last N wars:
Line chart of win/loss.
Avg stars per attack.
Link: View details (could scroll or open dedicated war analytics panel).
Player performance analytics
Table or cards:
Top war performers (stars per attack).
Top donors.
Most active members.
Capital raids analytics
Short summary:
Last raid weekend.
Total gold.
Top contributors.
Link: /analytics/capital.
13.2 Capital raids (/analytics/capital)
Sections:
Raid weekends list
Table:
Weekend date range.
Total gold looted.
Number of participants.
Link to details.
Raid weekend detail
For a selected weekend:
Per-player table:
Player name
TH (if known)
Gold looted
Attacks
Avg damage
Highlight top contributors.
Optional:
Trend vs previous weekends (small chart).
13.3 Player analytics view (per-player context)
Player Profile includes the “Compared to clan” panel; no separate route required in Phase 1.

14. Leadership section (/leadership)
14.1 Review queue
Main view:
Tabs or sections:
New joins
Recent leaves
Pending actions
Warnings
Each section is a list:
New joins:
Player name, TH, join date.
“Returning” label if previous tenure.
Warnings flag if history exists.
Actions:
Open profile
Acknowledge (mark as reviewed)
Recent leaves:
Player name, TH, leave date.
Last note (if any).
Link to profile.
Pending actions:
Players with PENDING_ADD / PENDING_REMOVE.
Explanation of what is pending (awaiting cron).
Warnings:
Players with active warnings.
Filters by severity.
14.2 Bulk actions (Phase 2)
For now, bulk actions can be mentioned but not implemented; UI may have disabled multi-select.

15. Settings (/settings)
Phase 1 aims for a minimal but functional Settings page.
Sections:
Permissions (role → capability)
Table of roles vs features with chip/toggle UI.
At minimum, a read-only representation; editing can be partial or manual.
Thresholds
Configurable values:
Inactive definition (e.g., no war attacks in last X wars).
Donation expectation (e.g., recommended min donations per period).
These thresholds feed into Analytics/Leadership flags.
Cron info (read-only)
Show schedule and last run timestamps.
Show last run status (success/failure).
AI / export templates (optional in Phase 1)
Text areas for:
LLM preamble template.
Clan chat war summary template.
Discord share summary template.

16. Global search
16.1 Behaviour
Search input in top bar.
When user types and submits, show results grouped into:
Players
Matching name or tag.
Clans
Our clan and known opponent clans from history.
Screens & tools
Hard-coded mapping: “war planner”, “player trends”, “new joins” etc.
16.2 Result actions
Clicking a Player → /players/[id].
Clicking a Clan → if ours, /; if opponent, /war/history filtered.
Clicking a Screen → navigate to the relevant route.

17. Auth & login
17.1 Login flow
Route: /login
Simple form:
Username / email
Password
On success:
Redirect to / (Dashboard).
No marketing/landing page in Phase 1.
17.2 Role assignment
Mapping is out of scope for UI:
For Phase 1, assume roles are assigned manually in DB or via a basic admin tool.
Role determines which sections appear in sidebar and what actions are enabled.

18. Notifications (Phase 2 outline)
For now, only in-app notifications exist (headline + review queue).Future external notifications to consider:
New player joined → notify leader/co-leaders.
War about to start → notify.
Raid weekend recap → notify.
Phase 1 only needs to leave logical space in Settings for this; no outbound integration yet.

19. Copy snippets for sharing
19.1 Clan chat war blurb example
Generated text:
War vs {opponentClanName} ({size}v{size}) is set.

Initial read: {difficultyLabel} match-up based on TH and hero levels.

Check the dashboard for details and suggested targets.
difficultyLabel is derived from heuristic summary (e.g. “favorable”, “even”, “tough”).
19.2 Discord share snippets
From Dashboard:
[Clash Intel] Clan update for {clanName}:

- Last {N} wars: {wins}W {losses}L {draws}D
- Avg stars/attack: {avgStarsPerAttack}
- Active members: {active}/{total}

Current war: {statusText}
{optionalWarLine}
From War detail:
[Clash Intel] War vs {opponentClanName} ({size}v{size})

Status: {status}
Our roster is locked in. Early assessment: {difficultyLabel}.

Leaders have full details and target suggestions on the dashboard.
From Capital raids:
[Clash Intel] Capital Raid weekend recap:

- Total gold looted: {totalGold}
- Participants: {participantCount}
- Top contributors: {top3List}

Thanks for raiding – check the dashboard for the full breakdown.

20. Phase 1 scope checklist (for Codex)
IN SCOPE:
Navigation & layout:
Sidebar, top bar, global search (basic).
Dashboard:
Leader & member variants.
Active war headline.
“While you were away” for leaders.
Players:
Unified roster/Player DB.
Table + card view.
Filters and basic search.
Add/Remove player flows.
Canonical Player Profile (including arrows & scroll behaviour).
War:
War overview.
War Planner (our participants → opponent clan → fetch stats → save roster).
War detail page.
War history list.
LLM export payload.
Chat/Discord snippet buttons (even if text is hard-coded initially).
Analytics:
Basic clan war + player + raid metrics (no ultra-fancy charts required).
Capital raids basic view.
Leadership:
Review queue for joins/leaves/pending/warnings.
Settings:
Visible structure with at least:
Permissions (even if mostly read-only).
Thresholds.
Cron info.
Cron awareness:
UI shows last snapshot time.
OUT OF SCOPE FOR PHASE 1:
Multi-clan support.
Public marketing/landing pages.
External notification integrations (Discord, email, etc.).
Deep CWL management tools (beyond basic season/war day display).
Perfect visual design. Functional layout & stable positioning are more important than pixel-perfect styling.

End of spec.
