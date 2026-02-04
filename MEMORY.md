# MEMORY.md

Curated long-term context for this workspace + agent.

## UI / Roster (Spec2)
- Goal: bring `/new/roster` (cards + table) into near-identical compliance with Spec2 global UI/UX conventions (tokens, spacing, typography, controls, tooltip behavior, shared header, consistent behavior across views).
- Routing decision: unify behind `/new/roster?view=cards|table` with a shared header/surface; `/new/roster/table` redirects.
- Tooltip convention: prefer `web-next/src/components/ui/Tooltip.tsx` tooltips; avoid native `title` tooltips.

## Dev Status / Heartbeat
- Next dev runs on :5050.
- A sidecar dev-status server runs on :5051 (`web-next/scripts/dev-status-sidecar.mjs`) to remain available even if Next dies.
- Heartbeat writer updates `web-next/output/dev-heartbeat.json` via `web-next/scripts/agent-heartbeat.mjs`.
- Sidecar probes Next via `/api/health` (not `/`) to reduce false DOWN states.

## Stability / Supervision
- Next dev and status/heartbeat are supervised via macOS launchd LaunchAgents (user: froggy):
  - `ai.clashintelligence.nextdev`
  - `ai.clashintelligence.devstatus`
  - `ai.clashintelligence.heartbeat`
- Logs: `web-next/output/launchd/*.log`.
