# Definitive Site Reorganization & IA Implementation Plan

## Objective
Restructure the app around a task-first IA (Dashboard, Players, War, Analytics, Leadership, Settings), replace fragmented tabs with a persistent sidebar + breadcrumbs, unify duplicate routes (single player profile), and elevate key flows (Assess, War Planning) while preserving current behavior during migration.

## Baseline & Guardrails
- Back up codebase + DB snapshot.
- Run Playwright UI/UX audit and sitemap crawl; save reports/screenshots as baseline.
- Maintain an old→new route matrix with status columns: `moved`, `redirected`, `linked`, `tested`.
- Add a lightweight navigation smoke checklist (visit top-level sections + key child routes) to run after each phase.

## Governance
- Centralize navigation data in `nav-config` (labels, paths, icons, permissions) to drive Sidebar, Breadcrumbs, and Global Search.
- Keep redirects checklist in sync with the matrix; land redirects as soon as a route moves.
- Avoid parallel refactors during moves; migrate by feature cluster (Players, then War, then Analytics).

## Phased Work
**Phase 0 – Foundation (Pre-Week 1)**
- Backup; capture baseline audit + crawl; draft route matrix; list redirect pairs.

**Phase 1 – Scaffold & Navigation (Week 1)**
- Create route directories with placeholders: `/app`, `/players`, `/players/roster`, `/players/assess`, `/players/database`, `/players/search`, `/players/[tag]`, `/war`, `/war/planning`, `/war/active`, `/war/analytics`, `/war/results`, `/analytics`, `/analytics/war`, `/analytics/capital`, `/analytics/player`, `/leadership`, `/settings`.
- Implement `nav-config`; replace TabNavigation in `AppShell` with Sidebar; add Breadcrumbs; add Global Search shell (Cmd+K modal stub).
- Smoke test navigation renders (no broken imports/layout).

**Phase 2 – Content Migration & Consolidation (Week 2)**
- Move `player-database` → `/players/database`; keep behavior unchanged.
- Move `capital-analytics` → `/analytics/capital`.
- Move `war-analytics` → `/war/analytics`.
- Consolidate `/war` + `/war/prep` into `/war/planning` with functional parity.
- Activate redirects immediately for each moved route; rerun navigation smoke checklist across Players, War, Analytics.

**Phase 3 – Unification & Refinement (Week 3)**
- Build canonical `/players/[tag]` merging `/player/[tag]` and `/simple-player/[tag]`; update all internal links to only this route.
- Build `/players/assess` UI using existing applicant evaluation API.
- Refactor `war/page.tsx` into a hub; extract child components for `planning`, `active`, `results`, `analytics`.
- Integrate Discord publishing flow into `/war/results`; start splitting oversized war components into reusable pieces.

**Phase 4 – Polish, Testing & Deployment (Week 4)**
- Hook Global Search to backend; target <2s query latency.
- Add task CTAs on Dashboard: “Assess New Member” and “Start New War Plan.”
- UAT on assess workflow + navigation; re-run Playwright audit vs baseline.
- Finalize documentation (developer + user) and deploy.

## Redirects Checklist (old → new)
- `/simple-roster` → `/app`
- `/simple-player/[tag]` → `/players/[tag]`
- `/player/[tag]` → `/players/[tag]`
- `/player-database` → `/players/database`
- `/war-analytics` → `/war/analytics`
- `/capital-analytics` → `/analytics/capital`

## Open Items to Track
- Assign owners/dates per phase.
- Decide location for route matrix file (CSV/MD) and link it here.
- Add navigation smoke checklist to scripts or docs and reference in CI/UAT steps.
