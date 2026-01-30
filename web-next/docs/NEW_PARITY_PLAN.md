# /new Parity Plan (Working)

Last updated: 2026-01-07
Owner: Codex (staff audit)
Scope: /new replaces legacy /(dashboard) entirely. Parity means all legacy functionality and data items are available in /new, using SSOT and Simple Architecture.

## Non-negotiables (from DEVELOPMENT_TRUTHS.md)
- Simple Architecture only: backend computes, frontend presents.
- Supabase is SSOT; no page invents its own data.
- One roster snapshot feeds everything.
- /api/v2/roster is the canonical roster API shape.
- /api/v2/player/[tag] must fall back to roster stats, not replace them.
- No fake data in production.

## Decisions (confirmed)
- Default home is `/new` (dashboard).
- Capital analytics is public (no leadership gate); gating applies to write/edit/copy/analysis actions and sensitive data (notes, warnings).
- Access/Permissions management must be duplicated in /new so leaders/owners can decide what is gated.
- Parity means adding legacy functionality to /new; do not remove existing /new features to match legacy.
- Permissions/Access UI lives under Leadership (Settings reserved for clan/config + personal preferences).

## Recent updates
- War analytics (/new/war/results): add active-roster-only filter (default on) so former players are hidden by default.
- War Center planner: reskinned cards/steps to /new tokens and added roster/profile/analysis loading feedback.

## Route Inventory

New routes (/new)
- /new (dashboard) -> web-next/src/app/new/page.tsx
- /new/analytics/war -> web-next/src/app/new/analytics/war/page.tsx
- /new/roster -> web-next/src/app/new/roster/page.tsx
- /new/roster/table -> web-next/src/app/new/roster/table/page.tsx
- /new/player/[tag] -> web-next/src/app/new/player/[tag]/page.tsx
- /new/player/[tag]/history -> web-next/src/app/new/player/[tag]/history/page.tsx
- /new/player-database -> web-next/src/app/new/player-database/page.tsx
- /new/leadership -> web-next/src/app/new/leadership/page.tsx
- /new/leadership/assessment -> web-next/src/app/new/leadership/assessment/page.tsx
- /new/leadership/access -> web-next/src/app/new/leadership/access/page.tsx
- /new/assess -> web-next/src/app/new/assess/page.tsx
- /new/member-performance -> web-next/src/app/new/member-performance/page.tsx
- /new/capital-raids -> web-next/src/app/new/capital-raids/page.tsx
- /new/war/cwl -> web-next/src/app/new/war/cwl/page.tsx
- /new/war/cwl/setup -> web-next/src/app/new/war/cwl/setup/page.tsx
- /new/war/cwl/roster -> web-next/src/app/new/war/cwl/roster/page.tsx
- /new/war/cwl/day/[day] -> web-next/src/app/new/war/cwl/day/[day]/page.tsx
- /new/search -> web-next/src/app/new/search/page.tsx
- /new/settings -> web-next/src/app/new/settings/page.tsx
- /new/ui, /new/ui/iconography, /new/foundation (UI experiments)

Legacy routes (/(dashboard))
- /app -> web-next/src/app/(dashboard)/app/page.tsx (simple roster)
- /player/[tag] -> web-next/src/app/(dashboard)/player/[tag]/page.tsx
- /player/[tag]/history -> web-next/src/app/(dashboard)/player/[tag]/history/page.tsx
- /simple-player/[tag] -> web-next/src/app/(dashboard)/simple-player/[tag]/page.tsx
- /player-database -> web-next/src/app/(dashboard)/player-database/page.tsx
- /leadership -> web-next/src/app/(dashboard)/leadership/page.tsx
- /war -> web-next/src/app/(dashboard)/war/page.tsx
- /war-analytics -> web-next/src/app/(dashboard)/war-analytics/page.tsx
- /capital-analytics -> web-next/src/app/(dashboard)/capital-analytics/page.tsx
- /settings -> web-next/src/app/(dashboard)/settings/page.tsx
- /war/planning, /war/prep -> redirects to /war
- /ui-lab (dev only) -> web-next/src/app/(dashboard)/ui-lab/page.tsx

## Parity Matrix (Initial)

### 1) Dashboard / Home
Legacy:
- /app renders roster page (simple roster).
New:
- /new renders dashboard KPIs and spotlight cards.
Data items expected:
- Roster snapshot metrics (member count, activity bands, donations, VIP, etc).
Endpoints:
- Server data via `getCurrentRosterData` (Supabase: `clans`, `roster_snapshots`, `vip_scores` + `resolveRosterMembers`).
Gaps:
- Behavior difference: /app is roster, /new is dashboard. Plan to redirect /app to /new at cutover.
SSOT notes:
- Dashboard must use /api/v2/roster or SSOT snapshot data, no client recomputes.

### 2) Roster (current and former)
Legacy:
- /app -> web-next/src/app/(dashboard)/simple-roster/RosterPage.tsx
New:
- /new/roster -> web-next/src/app/new/roster/RosterClient.tsx
- /new/roster/table -> web-next/src/app/new/roster/table/TableClient.tsx
Data items expected:
- Member snapshot fields, activity score, donations, received, hero levels, tenure, role.
- VIP score and trend data.
- Leadership actions (notes, warnings, tenure, departures).
- Exports (CSV/Discord/summary).
Legacy features to port:
- VIP score column + sorting.
- Export actions (CSV, Discord, summary).
- Leadership modals for notes/tenure/departure actions.
- Roster summary cards: Avg VIP, Top VIP leaders, activity distribution.
Endpoints:
- `/api/v2/roster` (current roster, canonical).
- `/api/v2/roster/former` (former members).
Write actions (gated):
- Notes/warnings/tenure/departures (legacy modal actions).
Gaps:
- VIP column and sorting missing in /new roster views.
- Exports missing in /new roster.
- Leadership modals/actions missing in /new roster.
SSOT notes:
- Use resolveRosterMembers and /api/v2/roster. No direct member_snapshot_stats queries.

### 3) Player Profile
Legacy:
- /player/[tag] -> web-next/src/app/(dashboard)/player/[tag]/PlayerProfileClient.tsx
- Tabs: overview, history, evaluations, metrics, analysis, comparison.
New:
- /new/player/[tag] -> web-next/src/app/new/player/[tag]/PlayerProfileClient.tsx
- Tabs: overview, equipment, history.
Data items expected:
- Profile summary, hero levels, activity, war analytics, VIP, history timeline, evaluations, comparison, DNA/radar analytics.
Endpoints:
- `/api/v2/player/[tag]` (canonical profile).
- `/api/war-intelligence?playerTag=...` (war metrics).
- Legacy-only: `/api/player-aliases`, `/api/player-notes`, `/api/player-warnings` (must be ported or consolidated).
Legacy features to port:
- Evaluations workflow (create/read evaluation notes).
- Metrics/analysis tabs (DNA radar, stats radar, war analytics details).
- Comparison view (player vs player).
- Alias/linked accounts management.
Gaps:
- Missing tabs: evaluations, metrics, analysis, comparison.
- Missing components: DNA/radar, comparison views, evaluation workflow.
- No dedicated history route in /new.
SSOT notes:
- /api/v2/player/[tag] must fall back to roster stats; do not recompute in UI.

### 4) Player History
Legacy:
- /player/[tag]/history -> trophies, donations, hero upgrade history.
New:
 - /new/player/[tag]/history (dedicated history route).
Gaps:
 - History charts still backed by `/api/player/[tag]/history`; evaluate `/api/v2/player/[tag]` timeline merge.
Endpoints:
- Legacy uses `/api/player/[tag]/history` (needs /new equivalent or merged into profile).

### 5) Player Database
Legacy:
- /player-database -> web-next/src/app/(dashboard)/player-database/PlayerDatabasePage.tsx
- Full CRUD: notes, warnings, tenure, return actions, archive, edit events.
New:
- /new/player-database -> web-next/src/app/new/player-database/page.tsx
Gaps:
- Read-only UI; no modals/actions for notes, warnings, tenure, returns, archive.
Endpoints:
- `/api/player-database` (read + write actions for notes/warnings/tenure/returns/archives).
Legacy features to port:
- Add/edit notes, warnings, departures, tenure actions.
- Mark return + tenure award.
- Archive/unarchive players and edit timeline events.
Gating:
- All write actions gated by canModifyClanData.
SSOT notes:
- Uses /api/player-database; must remain canonical for notes/warnings.

### 6) Leadership
Legacy:
- /leadership -> LeadershipDashboard with Applicants, NewsFeed, Pending Registrations,
  Clan Games, Ingestion Monitor, Insights.
New:
- /new/leadership (hub + placeholders)
- /new/leadership/dashboard (new-ui leadership ops dashboard)
- /new/leadership/assessment
- /new/assess
 - /new/leadership/access (permissions management)
Gaps:
- Leadership hub needs dedicated recruiting and alert detail pages (currently routes to existing flows).
Endpoints:
- `/api/leadership/highlights`
- `/api/leadership/assessment` (+ run action, gated)
- `/api/joiners` (Assess review actions, gated)
Legacy features to port:
- Applicants panel, News feed, Pending registrations (now in /new/leadership/dashboard).
- Clan Games manager, Ingestion monitor, Quick actions (now in /new/leadership/dashboard).
- Permissions/Access manager UI (per decision).
SSOT notes:
- Leadership assessment output is persisted and must be reused.

### 7) War (general)
Legacy:
- /war (general war planning and AI prompt)
- /war-analytics (WarIntelligenceDashboard)
New:
- /new/war/cwl/* (CWL only)
Gaps:
- General war planning not ported to /new.
- War analytics not ported to /new.
Endpoints:
- `/api/war-intelligence` (war analytics)
- `/api/v2/war-planning/*` (rosters, opponents, matchup, plan, analysis)
- `/api/war/opponent`, `/api/war/pin`, `/api/war/history`
Legacy features to port:
- Opponent auto-detect + pin, opponent roster selection.
- Saved plan load/save, AI analysis toggle.
- Copy payload + Discord brief outputs.
Gating:
- Page access: canViewWarPrep
- Save/pin/clear: canManageWarPlans
- AI analysis/copy outputs: canRunWarAnalysis
SSOT notes:
- War analytics data should be precomputed server-side and persisted.

### 8) Capital Raids
Legacy:
- /capital-analytics (LeadershipGuard)
New:
- /new/capital-raids (publicAccess)
Gaps:
- Ensure public access uses the same SSOT data as legacy. Gate only write/copy/analysis actions via permissions.
SSOT notes:
- Both use CapitalAnalyticsDashboard; ensure shared SSOT inputs.
Gating:
- Read-only analytics are public.

### 9) Settings
Legacy:
- /settings
New:
 - /new/settings
Gaps:
 - Remaining config panels from legacy (ingestion toggles, audit log, access tooling) stay under Leadership or need new /new equivalents.
Key components:
- `SettingsContent` + `PermissionManager` (access control and per-permission gating)
Decision:
- Move permissions UI to Leadership; Settings reserved for config/prefs.

### 10) Search and Other New-only Pages
New-only:
- /new/search (global nav search)
- /new/member-performance (war + capital composite ranking)
- /new/ui, /new/foundation (UI sandbox)
Legacy-only:
- /ui-lab (dev-only), /simple-player/[tag]
Decision:
- Keep /new-only pages; no feature removal for parity.

## Data Item Checklists (v1, SSOT)

### Dashboard (/new)
Data items:
- Member count, active breakdown, donations totals.
- Avg VIP, VIP of the week, most improved VIP, donation king, trophy leader.
- Momentum score (VIP trend), war readiness, activity breakdown.
SSOT source:
- Roster snapshot via `getCurrentRosterData` or `/api/v2/roster` (vip_scores + resolveRosterMembers).
Notes:
- Current dashboard derives metrics client-side; move to server-side aggregation to align with SSOT.

### Roster (/new/roster, /new/roster/table)
Data items:
- Name, tag, role, TH, trophies (resolved order), league (resolved order).
- Donations given/received, war stars, activity score + band, tenure days/as-of.
- Hero levels + hero power, rush percent, war preference.
- VIP score + rank + trend.
- Former members (departed at, last role, last TH/league/trophies, total tenure).
SSOT source:
- `/api/v2/roster` and `/api/v2/roster/former` (resolveRosterMembers + roster-derivations).

### Player Profile (/new/player/[tag])
Data items (from SupabasePlayerProfilePayload):
- Summary: clan, role, TH, trophies, ranked trophies, league, donations, war stats, builder base, capital contributions.
- Activity: score + evidence; tenure; hero levels/power; pets; equipment; achievements; exp level.
- Timeline: snapshot series (trophies, donations, activity, hero levels, war stats, capital, league changes).
- History: tenure movements, aliases, leadership notes/warnings, tenure/departure actions.
- Evaluations, joiner events, VIP current + history.
SSOT source:
- `/api/v2/player/[tag]` (canonical); war metrics from `/api/war-intelligence?playerTag=...`.

### Player History (legacy route)
Data items:
- Trophy history, donation history, hero upgrade history, league changes.
SSOT source:
- `/api/player/[tag]/history` (legacy) or `/api/v2/player/[tag]` timeline (preferred).

### Player Database (/new/player-database)
Data items:
- Player notes, warnings, tenure actions, departure actions, linked accounts, status.
- Current/former membership, last updated, archive status.
SSOT source:
- `/api/player-database` (read/write).

### Leadership (/new/leadership + /new/leadership/assessment + /new/assess)
Data items:
- Weekly highlights: promotions/demotions, hero upgrades, new joiners.
- Assessment: band, weights, scores, flags.
- Joiner queue: metadata, warnings, linked account warnings, prior history.
SSOT source:
- `/api/leadership/highlights`, `/api/leadership/assessment`, `/api/joiners`.

### War (general)
Data items:
- Our roster (hero levels, war preference), opponent roster, selections.
- Matchup metrics (TH distribution, hero delta, readiness, danger slots).
- Saved plan, AI analysis, briefing copy.
SSOT source:
- `/api/v2/war-planning/*` and `/api/war/opponent`, `/api/war/pin`, `/api/war/history`.

### War Analytics
Data items:
- War performance metrics per member; clan averages; latest war summary.
SSOT source:
- `/api/war-intelligence`.

### Capital Raids
Data items:
- Per-player metrics (loot/attack, ROI, participation), clan averages, weekend summary.
- Optional roster-only filter.
SSOT source:
- `/api/capital-analytics` + `/api/v2/roster` for roster filter.

### CWL Planning (/new/war/cwl/*)
Data items:
- cwl_eligible_members (frozen roster), cwl_opponents.roster_snapshot, cwl_day_lineups.
- cwl_day_results + cwl_attack_results.
- cwl_player_day_activity + cwl_attendance_rollups (attendance signals).
SSOT source:
- `/api/cwl/*` routes (per DEVELOPMENT_TRUTHS).

### Settings (to create in /new)
Data items:
- Clan config (home clan, tracked clans, ingestion toggles).
- Personal prefs (theme, density, font size).
SSOT source:
- Config tables / settings endpoints (to define).

### Permissions / Access (under Leadership)
Data items:
- Access members (level, email, last accessed), custom permission overrides.
SSOT source:
- `/api/access/list`, `/api/access/init`, `/api/access/permissions`.

## Gating Matrix (Draft Defaults)
Area -> Read -> Write/Edit -> Analyze/Copy -> Sensitive Data
- Dashboard: Public -> N/A -> N/A -> N/A
- Roster: Public -> canModifyClanData -> canGenerateCoachingInsights (exports) -> canViewSensitiveData (notes/warnings)
- Player Profile: Public -> canModifyClanData (notes/evals) -> canRunWarAnalysis (analysis/copy) -> canViewSensitiveData
- Player Database: canViewLeadershipFeatures -> canModifyClanData -> N/A -> canViewSensitiveData
- Leadership Hub: canViewLeadershipFeatures -> canManageChangeDashboard -> canGenerateCoachingInsights -> canViewSensitiveData
- Access/Permissions: canManageAccess -> canManageAccess -> N/A -> canManageAccess
- War Planning: canViewWarPrep -> canManageWarPlans -> canRunWarAnalysis -> canViewSensitiveData (if notes shown)
- War Analytics: default canViewLeadershipFeatures (configurable via permissions) -> N/A -> canRunWarAnalysis -> N/A
- Capital Analytics: Public -> N/A -> N/A -> N/A
- CWL Planning: canViewWarPrep -> canManageWarPlans -> canRunWarAnalysis -> canViewSensitiveData (if notes shown)
- Settings (new): Public (personal prefs) / canManageChangeDashboard (clan config)

## Data Flow Map (Initial)
- Roster: Clash API -> ingestion -> member_snapshot_stats -> resolveRosterMembers -> /api/v2/roster -> /new roster + /new dashboard.
- Player profile: /api/v2/player/[tag] uses roster snapshot fallback + player history tables.
- Leadership: assessment engine -> persisted results -> /api/leadership/assessment.
- War analytics: war intelligence tables -> /api/war-intelligence (dashboard uses WarIntelligenceDashboard).
- Capital analytics: capital metrics tables -> /api/capital-analytics -> CapitalAnalyticsDashboard.
- CWL: cwl_* tables -> /api/cwl/* -> /new/war/cwl/* pages.
- Access/Permissions: access members + custom_permissions -> /api/access/*.

## Permissions & Gating (Initial)
Permission keys (defaults in `lib/access-management.ts`):
- canViewRoster, canViewBasicStats
- canViewSensitiveData (notes/warnings)
- canModifyClanData (notes/warnings/tenure/departures)
- canViewLeadershipFeatures
- canManageAccess (permissions UI)
- canViewAuditLog
- canViewWarPrep, canManageWarPlans, canRunWarAnalysis
- canAccessDiscordPublisher, canGenerateCoachingInsights

Access/permissions APIs:
- `/api/access/list` (list access members, grant/revoke)
- `/api/access/init` (initialize access config)
- `/api/access/permissions` (GET/POST custom overrides)

Gating policy (target):
- Read-only analytics (capital, war metrics, roster snapshots) are public unless flagged sensitive.
- Write/edit operations (lineups, notes, warnings, tenure, departures) are gated by canModifyClanData.
- AI/analysis/copy/export workflows gated by canRunWarAnalysis or canGenerateCoachingInsights.
- Permissions management gated by canManageAccess and lives under Leadership.

## Open Questions
- Finalize per-page gating matrix (which actions are read-only vs gated).
- Define Settings scope in /new (clan config + personal prefs).

## Working Log
- 2026-01-07: Initial parity matrix drafted from route inventory and page inspections.
- 2026-01-07: Decisions logged for /new default home, public capital analytics, and permissions-based gating.
- 2026-01-07: Began implementation: added /new/analytics/war and /new/leadership/access pages; wired nav to new routes.
- 2026-01-07: Roster parity started: VIP stats in header, VIP display on cards, export actions, leadership action modals, table sorting + VIP column.
- 2026-01-07: Roster parity expanded: activity distribution cards in card/table views, export menu added to table header.
- 2026-01-07: Player profile parity started: added evaluations/analysis/comparison tabs; wired leadership actions (notes, warnings, alias linking) in /new player profile.
- 2026-01-07: Player database parity in progress: added action modal in /new player database with notes, warnings, tenure, departures, and mark-returned flows.
- 2026-01-07: Leadership parity started: added /new/leadership/dashboard using existing LeadershipDashboard and linked from leadership overview + nav.
- 2026-01-07: War parity started: added /new/war route rendering legacy war planner and linked from leadership + nav.
- 2026-01-07: War parity expanded: added /new/war/active, /new/war/planning, /new/war/results routes and nav children.
- 2026-01-07: War UI reskin: WarCenterPage now uses new-ui styling (buttons/cards/inputs) to match /new design language.
- 2026-01-15: Dashboard: added UTC data freshness + next cron indicator, leader chat blurb copy for active war, enriched joiner/departure review cards (returning, warnings, notes, name changes), leadership alerts, and leader-only weekly Discord summary export. Metrics now include avg trophies + top donors/trophy gainers.
- 2026-01-15: Player Database (/new): added "Add player" flow with validation + note creation, plus unit tests for payload builder. Fixed /new/war/planning runtime revalidate error by making route a server component.
- 2026-01-15: Leadership dashboard (/new): rebuilt with new UI and SSOT data sources (highlights, joiners, applicants, pending registrations, clan games, ingestion monitor, quick actions, news feed).
- 2026-01-24: Settings (/new): added settings hub with home clan, active clan context, tracked clans, and personal preferences (theme + density).
- 2026-01-24: Leadership hub: wired Discord, Command Center, and Recruiting links to live /new routes.
- 2026-01-24: Player history (/new): added dedicated /new/player/[tag]/history page using /new UI.
- 2026-01-24: Player database (/new): derive tenure display from tenure_days + tenure_as_of to avoid "joined 1 day ago" regressions.