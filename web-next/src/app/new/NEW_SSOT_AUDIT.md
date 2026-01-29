# /new SSOT Audit (Draft)

**Goal:** Make `/new` the only production experience, with a single source of truth for stats.

## Recommended rule
- **Server components** load canonical data from Supabase directly (no internal HTTP dependency).
- **Client components** use SWR only for:
  - user-triggered mutations (POST/PUT/DELETE)
  - occasional revalidation (optional)

## Current `/new` coupling to legacy
Imports from `@/app/(dashboard)` (legacy types/helpers):
- `new/roster/useRosterData.ts` → `RosterData` from `simple-roster/roster-transform`
- `new/roster/roster-utils.ts` → `RosterMember` from `simple-roster/roster-transform`
- `new/roster/table/TableClient.tsx` → `RosterData` from `simple-roster/roster-transform`
- `new/roster/table/page.tsx` → `getInitialRosterData` from `simple-roster/get-initial-roster`
- `new/roster/page.tsx` → `getInitialRosterData` from `simple-roster/get-initial-roster`
- `new/DashboardClient.tsx` → `RosterMember` from `simple-roster/roster-transform`
- `new/player/[tag]/page.tsx` → `getInitialPlayerProfile` from `(dashboard)/player/[tag]/get-initial-profile`

**Plan:** replace these with `/new`-scoped domain types + server loaders.

## `/new` pages doing internal HTTP fetches
- Settings: `/api/tracked-clans` (mutation/admin)
- Roster: `/api/v2/roster` and `/api/v2/roster/former` (canonical roster fetch)
- Player profile: `/api/v2/player/:tag` (canonical player fetch)
- CWL pages: `/api/cwl/*` (feature-specific)
- Player database + notes + warnings: `/api/player-*` (mutations/admin)

**Plan:** keep mutations via HTTP; migrate canonical roster/profile to server loaders.

## Sanity checks (manual)
We should periodically verify displayed stats against in-game:
- current trophies
- town hall
- donations (season)
- war stars / attack wins (if shown)
- league/ranked league

Record mismatches with: playerTag, stat name, app value, in-game value, timestamp.
