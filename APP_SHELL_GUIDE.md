# App Shell Guide

**Status:** Scaffolding / Feature Flagged
**Feature Flag:** `NEXT_PUBLIC_ENABLE_APP_SHELL=true`

## Overview
The `AppShell` component provides a modern, responsive layout structure with:
- **Desktop:** Collapsible sidebar (left) + Sticky header (top)
- **Mobile:** Slide-out overlay sidebar + Mobile menu trigger

## Usage

The shell is currently integrated into `DashboardLayout.tsx` but only active when the feature flag is enabled.

```tsx
// DashboardLayout.tsx
if (process.env.NEXT_PUBLIC_ENABLE_APP_SHELL === 'true') {
  return (
    <AppShell
      headerContent={<DashboardHeader ... />}
      toolbarContent={<Toolbar ... />}
    >
      {children}
    </AppShell>
  );
}
```

## Component Structure

### `AppShell.tsx`
- **Props:**
  - `children`: Main content
  - `headerContent`: Content for the sticky top header
  - `toolbarContent`: Optional secondary toolbar (e.g., tabs, quick actions)
  - `sidebarHeader`: Optional content above nav items
  - `sidebarFooter`: Optional content below nav items
  - `navItems`: Array of navigation links (label, href, icon)

### Mobile Behavior
- **Breakpoint:** `md` (768px)
- **Desktop:** 
  - Sidebar is visible (`flex`), collapsible via an **absolute toggle button** on the right edge.
  - When collapsed, the "CI" logo centers and navigation labels hide.
- **Mobile:** Sidebar is hidden by default.
  - A "Menu" trigger button appears in the header area.
  - Clicking the trigger opens a fixed overlay sidebar with backdrop.
  - Clicking a link or the backdrop closes the sidebar.

## Current State
- **Sidebar Links:** Placeholders (Dashboard, War Room, Analytics, Leadership).
- **Brand Mark:** "CI" text (placeholder for Clan Logo/Switcher).
- **Integration:** Only `DashboardLayout` is currently wired up.
- **Quick Actions:** The `SidebarQuickActions` component is injected via `sidebarFooter`, so the Refresh / Export / War Prep controls now live at the bottom of the drawer (no longer in the main content area).

## Next Steps
1. Enable flag locally to verify visual layout.
2. Wire up real navigation links in `AppShell`.
3. Replace "CI" mark with actual Clan Switcher/Logo component.
4. Migrate other layouts if necessary.
