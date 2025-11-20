# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [1.53.0] - 2025-01-15

### Added
- **App Shell Architecture** - New unified shell scaffolding system
  - New `AppShell` component (`src/components/layout/AppShell.tsx`) for consistent page structure
  - New dashboard route group (`src/app/(dashboard)/`) for organized routing
  - Feature flag `NEXT_PUBLIC_ENABLE_APP_SHELL` to enable/disable app shell (default: false)
  - `APP_SHELL_GUIDE.md` documentation for app shell implementation

### Changed
- **Architecture Refactoring** - Migrated to app shell pattern
  - Consolidated page routes into dashboard route group
  - Updated layout components to support app shell architecture
  - Enhanced `DashboardLayout` with app shell integration
  - Updated `AuthGuard`, `ClanSwitcher`, and `QuickActions` for shell compatibility

### Fixed
- **TypeScript Build Errors** - Resolved multiple type safety issues
  - Fixed implicit `any` types in `DiscordPublisher.tsx` (PerformerStat, sort callbacks, map functions)
  - Fixed `ApiResponse` type usage in AI war summary API
  - Added explicit type annotations throughout Discord publisher component

### Technical Details
- App shell provides consistent navigation, header, and layout structure
- Feature flag allows gradual rollout and testing of new architecture
- All existing functionality preserved during migration

## [1.52.0] - 2025-11-19

### Added
- **Comprehensive Site Documentation Test** (`tests/e2e/comprehensive-site-documentation.spec.ts`)
  - Automated test that captures full-page screenshots of all pages and states
  - Documents all interactive elements (inputs, buttons, tabs, links) with metadata
  - Generates markdown and JSON documentation reports
  - Captures navigation paths and page states for UI/UX review
- **UI/UX Overhaul Plan** (`UI_UX_OVERHAUL_PLAN.md`)
  - World-class UI/UX recommendations based on comprehensive site audit
  - 5-phase implementation roadmap covering navigation, components, workflows, and accessibility
  - Specific, actionable recommendations for improving user experience

### Changed
- Updated `.gitignore` to exclude screenshot files from test reports (keeps documentation, excludes images)
- Test report screenshots are now stored locally but not committed to repository

### Technical Details
- Comprehensive documentation test captures 15+ page states across all major sections
- Documentation includes element inventory, navigation flows, and interactive element metadata
- Screenshots are excluded from git to reduce repository size while maintaining documentation accessibility

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

## [1.51.0] - 2025-01-25

### Added - UI/UX Foundation & Navigation Improvements 🎨

#### Foundation UI Components
- **Tooltip Component** (`components/ui/Tooltip.tsx`) - Accessible tooltip system with hover/click/focus triggers, multiple positioning options, and keyboard navigation support
- **Breadcrumbs Component** (`components/ui/Breadcrumbs.tsx`) - Dynamic breadcrumb navigation with automatic route mapping and mobile-responsive design
- **Tabs Component** (`components/ui/Tabs.tsx`) - Accessible tab navigation with URL state support, keyboard navigation (arrow keys, home/end), and ARIA attributes
- **MetricCard Component** (`components/ui/MetricCard.tsx`) - Standardized metric display with optional tooltip support, trend indicators, and consistent styling
- **EmptyState Component** (`components/ui/EmptyState.tsx`) - Empty state component with actionable messaging, optional icons, and primary/secondary action buttons
- **SectionHeader Component** (`components/ui/SectionHeader.tsx`) - Consistent section titles with optional descriptions, icons, and action buttons
- **CollapsibleSection Component** (`components/ui/CollapsibleSection.tsx`) - Collapsible/accordion sections with localStorage persistence for user preferences
- **BackToTop Component** (`components/ui/BackToTop.tsx`) - "Back to top" button for long pages with smooth scroll animation

#### Tooltip Content Library
- **Centralized Tooltip Definitions** (`lib/tooltips/tooltip-content.ts`) - Comprehensive tooltip content library with:
  - Metrics & Scores: ACE, WPIE, WCI, VIP, War Efficiency, War Consistency, Activity Score, Rush %, Carry Score, ROI, Loot Efficiency
  - Abbreviations: TH, BK, AQ, GW, RC, MP (Town Hall and Hero abbreviations)
  - Status Indicators: Current/Former Member, Warning Level, War Opt-In
  - War Planning Features: Enrich Level, AI Analysis, Confidence Rating, Hero Delta, TH Delta, Ranked Delta, War Stars Delta
  - Leadership Features: Roster Intelligence Pulse, Activity Pulse, Ranked Surge, Personal Best Chase, Tenure Anchors
  - War Analytics Metrics: Average Stars, Missed Attacks, Attack Efficiency
  - Capital Analytics Metrics: Total Loot, Attacks, Participants, Top Contributors, Bonus Earned

#### Navigation Improvements
- **Breadcrumb Navigation** added to all major pages:
  - War Planning (`/war`)
  - War Analytics (`/war-analytics`)
  - Capital Analytics (`/capital-analytics`)
  - Player Database (`/player-database`)
  - Leadership (`/leadership`)
- Breadcrumbs automatically generate from route structure with "Dashboard" as home link
- Created `BreadcrumbsClient.tsx` wrapper for server components

#### Leadership Page Reorganization
- **Tabbed Interface** for Leadership Dashboard:
  - **Overview Tab**: Quick Actions, Ingestion Monitor, Roster Intelligence Pulse, News Feed
  - **Analytics Tab**: Daily Insights, Leadership Recognition metrics (Activity Pulse Leaders, Ranked Surge, Personal Best Chase, Tenure Anchors)
  - **Management Tab**: Clan Games Tracker, Applicant Evaluation System, Recent Joiners, Game Chat Messages
- Tabs use URL state (`?tab=overview`, `?tab=analytics`, `?tab=management`) for shareable links
- All existing functionality preserved with improved organization

#### Planning & Documentation
- **UI/UX Improvement Implementation Plan** (`UI_UX_IMPROVEMENT_IMPLEMENTATION_PLAN.md`) - Comprehensive 8-phase plan covering:
  - Foundation components (Phase 1)
  - Navigation & hierarchy (Phase 2)
  - Tooltip implementation (Phase 3)
  - Page length management (Phase 4)
  - Visual consistency (Phase 5)
  - Documentation updates (Phase 6)
  - Testing & validation (Phase 7)
  - Link audits (Phase 8)

### Changed
- Leadership Dashboard (`components/leadership/LeadershipDashboard.tsx`) reorganized into tabbed interface for better content organization
- All target pages now include breadcrumb navigation for improved wayfinding
- Component exports updated in `components/ui/index.ts` to include all new foundation components

### Technical Details
- All new components follow existing code patterns and TypeScript conventions
- Components include full accessibility support (ARIA attributes, keyboard navigation, screen reader compatibility)
- Tooltip system supports both string and React node content
- Tabs component supports disabled tabs and badge indicators
- Breadcrumbs component includes schema.org structured data for SEO

### Notes
- This release implements Phase 1, Phase 2.1, Phase 2.2, and Phase 3.1 of the UI/UX Improvement Implementation Plan
- Remaining phases (tooltip implementation on pages, War Planning workflow, collapsible sections, documentation updates) will follow in subsequent releases
- All components are fully typed and include comprehensive prop interfaces
- No breaking changes to existing functionality

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
- **Self-serve registration workflow:**
  - `/register` public page with step-by-step instructions, verification code display, and FAQ (username vs email accounts).
  - Supabase migration `20250228_create_pending_registrations.sql` storing clan-tagged requests with expiration and approval metadata.
  - API suite (`/api/register`, `/api/register/pending`, `/api/register/approve`, `/api/register/reject`) covering public submissions, leadership queues, and approval actions.
  - Leadership dashboard card (`PendingRegistrations.tsx`) inside the Management tab with filters, status badges, and inline Approve/Reject controls.
  - Shared registration utilities (`generateVerificationCode`, `validatePlayerInClan`) and Jest coverage.
  - System manual + plan docs updated with reproduction steps, screenshot TODOs, and change log entry.

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
