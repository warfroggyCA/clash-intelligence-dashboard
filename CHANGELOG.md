# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.32.0] - 2025-10-12

### Added - Data Enrichment Initiative 🎊
- **17 new enriched fields** tracked historically in `member_snapshot_stats`:
  - `pet_levels` (JSONB) - Pet name → level mapping
  - `builder_hall_level`, `versus_trophies`, `versus_battle_wins`, `builder_league_id` - Builder Base metrics
  - `war_stars`, `attack_wins`, `defense_wins`, `capital_contributions` - War statistics
  - `max_troop_count`, `max_spell_count`, `super_troops_active` - Lab progress
  - `achievement_count`, `achievement_score` - Achievement tracking
  - `exp_level`, `best_trophies`, `best_versus_trophies` - Experience metrics
- **Field extraction utilities** (`lib/ingestion/field-extractors.ts`) with comprehensive error handling
- **Enhanced player API** (`/api/v2/player/[tag]`) now returns `enriched` object with all new data
- **Timeline deltas** for pet upgrades, equipment upgrades, super troop changes, war progress, etc.
- **Backfill script** (`scripts/backfill-enriched-data.ts`) to populate historical snapshots
- **8 new database indexes** for query performance
- **34 unit tests** for field extractors (100% pass rate)
- **Comprehensive documentation**:
  - `DATA_ENRICHMENT_FIELD_INVENTORY.md` - Field catalog and priority matrix
  - `docs/api/enriched-player-data.md` - API reference with query examples
  - `docs/development/adding-tracked-fields.md` - Developer guide for extending system
  - `DATA_ENRICHMENT_DEPLOYMENT_SUMMARY.md` - Deployment guide and verification steps

### Changed
- Ingestion pipeline (`lib/ingestion/staged-pipeline.ts`) now extracts and stores enriched fields
- Player API timeline events now include pet/equipment upgrades and enriched stat deltas

### Performance
- Query times remain < 300ms for 60-day player history
- Storage overhead: ~30% increase (acceptable)
- Ingestion duration: No significant change (~3-5s)

### Migration
- Applied `supabase/migrations/20250115_data_enrichment_schema.sql` in production
- All columns nullable - no breaking changes
- Rollback script included in migration file

## [Unreleased]

### Added
- Two-row, full-width header with centered, vertically-aligned clan name.
- Right-aligned tag controls (Switch, Set Home, Load Home) with unified sizing.
- Per-clan logo support with multi-path and multi-extension fallbacks:
  - `/clans/<safeTag>.{png,jpg,jpeg,webp}` then `/<tagLower>.*` then `/<TAGUPPER>.PNG`, finally `/clan-logo.png`.
- Tabs visual integration under header (“glued” look) with gradient seam.
- Shared gradient variable `--header-gradient` and `.bg-header-gradient` utility.
- Toast system: lightweight event-bus (`lib/toast.ts`) and renderer (`components/layout/ToastHub.tsx`).
- Data source toggle (Live vs Snapshot) in header.
- Release scripts: `release:patch|minor|major` and `commit` (minor), which bump version, create a tag, and push.

### Changed
- Footer version now reads from `NEXT_PUBLIC_APP_VERSION`; scripts inject the package version for dev/build/start.
- Tabs container styling to sit visually attached beneath the header.

### Fixed
- Type errors: allow `title` on table cells by extending `TdHTMLAttributes`.
- Client-side hooks marked with `"use client"` where needed.
- Store typing for rehydrate callback and roster tag persistence.

## [0.16.3] - 2025-09-14
- Baseline prior to header/tabs redesign and infrastructure updates.

## [0.17.0] - 2025-09-15
### Added
- Security + API hardening sweep: standardized ApiResponse with requestId; Zod-validated inputs; durable Upstash rate limiting; production security headers; leadership middleware; structured JSON logging with provider hook; brief read-side caching for hot GETs.
- Applicant Evaluation feature:
  - API endpoints: `/api/applicants/evaluate`, `/api/applicants/shortlist` (batch), `/api/applicants/scan-clan` (batch roster scan).
  - UI Applicants panel: single evaluation, save to Player DB, Discord blurb, Shortlist Builder (local candidates), Scan External Clan (rank external clan members).
  - Filters: Top N, min/max TH, min score, min trophies, include roles, and max rush%.
  - Rush% exposed in UI and copied blurbs; tooltips added throughout for clarity.
- Player Database enhancements: status badge in list; modal “How to use” section; status selector persisted locally.

### Changed
- MCP server updated to consume `response.data` after ApiResponse standardization.
- Health/diag/access/snapshots/departures/AI routes now emit requestId and consistent headers.

### Notes
- Version surfaces via `NEXT_PUBLIC_APP_VERSION` from package.json in dev/build scripts.
