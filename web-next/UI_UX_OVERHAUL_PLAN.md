# UI/UX Overhaul Plan

Based on a comprehensive site documentation audit (Nov 19, 2025), this plan outlines specific, actionable recommendations to elevate the user experience to a world-class standard.

## 1. Global Navigation & Layout

**Current Issue:**
- Navigation is split between a sidebar (implied by repeated navigation buttons) and disjointed top-level links (`Go to Roster`, `...HeCk YeAh...`).
- The user profile button has an awkward label ("DSigned indo...").
- Breadcrumbs are inconsistent or missing on some pages.

**Recommendations:**
- **Unified App Shell:** Implement a persistent, collapsible **Sidebar Navigation** for primary modules (Dashboard, War, Analytics, Leadership).
- **Consistent Header:**
  - **Left:** Breadcrumbs (e.g., `Home > War > Prep`).
  - **Right:** Global Actions (User Profile, Clan Switcher, Theme Toggle).
- **User Profile:** Rename "DSigned in..." to a clean Avatar + Name component. Dropdown should handle "Sign Out", "Settings", "Profile".
- **Clan Context:** The clan switcher (`...HeCk YeAh...`) should be a distinct UI element in the sidebar or header, clearly indicating the *active* clan context.

## 2. Dashboard & Data Visualization

**Current Issue:**
- **Visual Noise:** "View Detail" button repeated 17+ times creates clutter.
- **Card Density:** Roster cards are packed with dense text (Trophies, Rush %, Hero Progress) without clear hierarchy.
- **Action Redundancy:** Multiple "Refresh" buttons (`Refresh Data & Insights` vs `Refresh`) confuse the primary action.

**Recommendations:**
- **Interactive Cards:** Make the *entire* player card clickable to view details. Remove the explicit "View Detail" button.
- **Visual Hierarchy in Cards:**
  - **Primary:** Player Name & TH Level (Bold, Large).
  - **Secondary:** Role & Status (Badge/Icon).
  - **Tertiary:** Key Metrics (Hero Levels as visual bars, not just text `100/105`).
- **Action Bar:** Consolidate "Refresh", "Export", and "Copy" into a single **Page Action Toolbar** at the top right of the content area. Use icons with tooltips for secondary actions to save space.

## 3. War Planning & Workflows

**Current Issue:**
- **Input Overload:** "War Planning" presents a wall of inputs (23+) and checkboxes without clear grouping.
- **Accordion Fatigue:** The "Step 1", "Step 2" flow is implemented as collapsible sections, which can lead to scrolling fatigue.

**Recommendations:**
- **Stepper UI:** Convert the "War Planning" workflow into a true **Stepper Component**.
  - Show progress (Step 1 of 4).
  - Only display the active step's content.
  - Provide "Next" and "Back" navigation buttons.
- **Smart Defaults:** Pre-fill inputs where possible (e.g., "Our Clan" tag).
- **Drag-and-Drop:** For "Select Players & Prep Plan", explore a drag-and-drop interface for assigning members to targets instead of a grid of checkboxes.

## 4. Leadership & Management Tools

**Current Issue:**
- **Grid Confusion:** The "Management" tab contains a grid of unnamed inputs (`10`, `0`, `#XXXXXXXX`). This looks like a spreadsheet but lacks headers or context.
- **Tab Inconsistency:** Leadership uses tabs, but other multi-view pages do not.

**Recommendations:**
- **Data Grid Component:** Replace raw input grids with a proper **Data Grid** (e.g., TanStack Table).
  - sticky headers.
  - inline validation.
  - sortable columns.
- **Bulk Actions:** Move bulk actions (Evaluate, Shortlist) to a floating or sticky toolbar that appears when rows are selected.
- **Input Masking:** Use input masks for Player Tags (starts with `#`, uppercase) to prevent errors.

## 5. Accessibility & Usability Polish

**Current Issue:**
- **Missing Labels:** 60+ `unnamed` inputs and 35+ `unnamed` checkboxes. This is a major accessibility blocker.
- **Cryptic Placeholders:** Placeholders like `#XXXXXXXX` are intimidating.

**Recommendations:**
- **Semantic Labeling:** Ensure every input has a visible label or `aria-label`.
- **Human-Readable Placeholders:** Change `#OPPONENT` to "Opponent Clan Tag" and `#XXXXXXXX` to "Player Tag".
- **Feedback States:**
  - **Loading:** Use skeletons instead of spinners for smoother perceived performance.
  - **Empty:** "No War Found" states should provide a "Start War" or "Sync" button, not just text.
- **Keyboard Navigation:** Ensure the new Stepper and Data Grid support full keyboard navigation (Tab, Arrow keys).

## Implementation Roadmap

1.  **Phase 1: App Shell & Navigation** - Fix the frame (Sidebar, Header, Breadcrumbs).
2.  **Phase 2: Component Library** - Standardize Buttons, Inputs, Cards, and the Data Grid.
3.  **Phase 3: Dashboard Refactor** - Implement clickable cards and consolidate actions.
4.  **Phase 4: War Planning Stepper** - Rebuild the wizard flow.
5.  **Phase 5: Management Grid** - Upgrade the Leadership input tables.

