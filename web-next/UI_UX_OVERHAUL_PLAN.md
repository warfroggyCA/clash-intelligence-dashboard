# UI/UX Overhaul Blueprint

Based on a comprehensive site documentation audit (Nov 19, 2025), this blueprint provides a sequenced implementation plan to elevate the user experience to a world-class standard.

## Fix the Frame First

Ship a global shell with:

- **Collapsible Sidebar** listing Dashboard, War, Analytics, Leadership plus a clear clan switcher block ("Active Clan: …HeCk YeAh…").
- **Sticky Header:**
  - **Left:** Breadcrumbs (e.g., `Home > War > Prep`).
  - **Right:** Global Actions (profile avatar dropdown, theme toggle, notification bell). No more "DSigned in…" badge.
- **Consistent Page Title + Toolbar Row** beneath the header to host page-level actions (refresh/export/copy) so we don't scatter buttons across cards.

## Standardize Cards + Visuals in Component Library Phase

- **Build an InfoCard Primitive** with explicit primary/secondary/tertiary slots so roster cards can:
  - Highlight Name+TH (primary).
  - Show role/status badges (secondary).
  - Render metric bars (hero levels, rush%) (tertiary).
- **Replace "View Detail" Micro Buttons** by making each card clickable and giving it hover/active states. Provide a single "Open in new tab" affordance via icon.
- **Convert Hero Stats into Progress Bars** (e.g., BK 80/85) with color coding; keep raw numbers in tooltips.

## Dashboard Refactor (Once New Cards Exist)

- **Use a Masonry or Responsive Grid** so cards align cleanly.
- **Put the Action Toolbar** (Refresh data, Export CSV, Copy summary) in the top-right of the content area; secondary actions are icon-only with tooltips.
- **Surface Global "Data Fresh As Of …" Metadata** under the page title instead of repeating "Refresh" in multiple cards.

## War Planning Rewrite as a True Guided Flow

- **Implement a Stepper Component** (Step 1 of 4) with:
  - Side rail summary.
  - Persistent "Next/Back" buttons.
  - Autosave per step.
- **Group Inputs Logically:**
  - War Context.
  - Opponent Intel.
  - Assignments.
  - Final Review.
- **Collapse Non-Active Steps Entirely** to reduce scrolling.
- **Pre-fill Obvious Values** (our clan tag, roster) and provide inline AI suggestions (e.g., recommended lineup) as chips.
- **For Assignments:** Offer drag-and-drop between "Available Members" and "Targets," with TH indicators and slot statuses.

## Leadership/Management Grid Rebuild

- **Replace Raw Inputs** with a TanStack-based data grid:
  - Sticky headers.
  - Sortable/filterable columns.
  - Inline validation.
- **Selected Rows Trigger a Floating Action Bar** (Evaluate, Shortlist, Export) so actions are contextual.
- **Apply Input Masks and Validation States** (e.g., player tags auto-capitalized, error badge if malformed).
- **Include Row Expansion or Side Drawer** for detail editing.

## Accessibility + Polish Baked In

- **Every Form Element** uses the new labeled components; no input ships without visible label + aria-describedby.
- **Replace Spinner-Only Loading** with skeleton placeholders tailored to each layout (cards, tables, steppers).
- **Empty States Always Include a Call-to-Action** (e.g., "No war plan yet — Start war plan").
- **Ensure Keyboard Navigation:**
  - Stepper: ←/→ for steps, Enter for Next.
  - Data grid: arrow navigation, space to select rows.

## Implementation Roadmap (In Order)

1. **App Shell & Navigation:** Sidebar, header, breadcrumbs, action toolbar scaffolding.
2. **Component Library:** InfoCards, metric bars, labeled inputs, stepper, data grid, empty/skeleton states.
3. **Dashboard:** Migrate roster cards to new components, add the consolidated toolbar, remove redundant buttons.
4. **War Planning Stepper:** Rebuild the wizard with autosave, drag/drop assignments, smart defaults.
5. **Leadership Grid:** Drop the spreadsheet-style inputs in favor of the new data grid and bulk-action patterns.

This keeps the work sequenced (frame → components → pages) while addressing all the issues from the audit: navigation consistency, data density, workflow fatigue, management clarity, and accessibility.
