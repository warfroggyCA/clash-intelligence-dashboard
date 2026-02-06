# Dev Status (auto-updated)

**Last update:** 2026-02-06 14:29 EST

## Current
- Next dev server: **RUNNING** (port 5050)
- Watchdog: **RUNNING** (auto-restarts next dev if killed)
- Focus: **/new/roster spec2 parity** (cards + table)

## What I'm working on
- Completed parity pass for routing + tooltip + toolbar consistency:
  - view toggle now standardizes on `/new/roster?view=cards|table`
  - replaced remaining native `title` usage in `/new/roster` surface with shared Tooltip
  - aligned cards filter/search toolbar sizing and spacing with table/spec2 controls
  - fixed table search input callback signature regression (`Spec2Input` string callback)

## How to check quickly
- If `http://127.0.0.1:5050/new/roster` loads → dev server is up.
- If it does not load → dev server likely down; ping me.

## Notes
- SIGKILLs happen; watchdog should bring dev back automatically.
- Visual captures generated in `web-next/output/playwright/roster-parity-2026-02-06/`.
- Spec2 reference page `/new/ui/roster-spec2` is rendering again after recompilation; runtime error no longer reproduces.
