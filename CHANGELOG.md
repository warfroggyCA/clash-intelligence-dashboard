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

