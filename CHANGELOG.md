# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

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
