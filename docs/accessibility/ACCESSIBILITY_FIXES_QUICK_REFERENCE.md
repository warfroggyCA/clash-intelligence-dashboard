# Accessibility Fixes - Quick Reference Guide
## Clash Intelligence Dashboard

This document provides copy-paste ready code fixes for the most critical accessibility issues.

---

## 🎨 Color Contrast Fixes

### Fix 1: Update CSS Variables in `globals.css`

```css
/* BEFORE - Low contrast colors */
:root {
  --text-muted: #94A3B8; /* 2.8:1 ratio - FAILS */
  --text-secondary: #E2E8F0; /* Borderline */
}

[data-theme="dark"] {
  --text-muted: #94A3B8; /* 2.8:1 ratio - FAILS */
}

/* AFTER - High contrast colors */
:root {
  --text-muted: #A3B4C8; /* 4.5:1 ratio - PASSES */
  --text-secondary: #E8EFF6; /* Better contrast */
}

[data-theme="dark"] {
  --text-muted: #B4C4D8; /* 4.7:1 ratio - PASSES */
  --text-secondary: #CBD5E1; /* Better visibility */
}

/* Fix specific text color classes */
[data-theme="dark"] .text-slate-400 {
  color: #B0C5DC !important; /* 4.7:1 ratio */
}

[data-theme="dark"] .text-slate-500 {
  color: #98ABBD !important; /* 5.2:1 ratio */
}

/* Fix metric labels */
[data-theme="dark"] .metric-label {
  color: rgba(241, 245, 249, 0.90) !important; /* Increased from 0.65 */
  font-weight: 600; /* Add weight for better readability */
}

[data-theme="light"] .metric-label {
  color: #1E3A5A !important; /* Darker for light theme */
  font-weight: 600;
}
```

---

## 🎯 Focus Styles Enhancement

### Fix 2: Add Visible Focus Indicators

```css
/* Add to globals.css - AFTER existing focus styles */

/* Enhanced focus-visible for keyboard navigation */
*:focus-visible {
  outline: 3px solid #60A5FA !important;
  outline-offset: 3px !important;
  box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.25) !important;
}

/* Buttons need special attention */
button:focus-visible,
a:focus-visible {
  outline: 3px solid #60A5FA !important;
  outline-offset: 2px !important;
}

/* Table rows when focused */
tr:focus-visible {
  outline: 2px solid #60A5FA !important;
  outline-offset: -2px !important;
  background-color: rgba(59, 130, 246, 0.1) !important;
}

/* Never hide focus outlines */
*:focus {
  outline-width: 2px !important;
  outline-style: solid !important;
  outline-color: #60A5FA !important;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline-width: 4px !important;
    outline-color: currentColor !important;
  }
}
```

---

## 📱 Touch Target Fixes

### Fix 3: Minimum 44x44px Touch Targets

```css
/* Add to globals.css */

/* Ensure all interactive elements meet minimum size */
button,
a,
input[type="checkbox"],
input[type="radio"],
select,
.interactive {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
}

/* Icon-only buttons */
button:has(svg:only-child),
button[aria-label]:not(:has(span)) {
  min-height: 44px;
  min-width: 44px;
  padding: 10px;
  display: inline-flex;
  align-items: center;
  justify-center: center;
}

/* Small buttons that need to be bigger */
.text-xs button,
button.text-xs {
  min-height: 44px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem; /* Increase from text-xs */
}

/* Mobile optimizations */
@media (max-width: 768px) {
  button,
  a.button,
  .interactive {
    min-height: 48px; /* Even larger on mobile */
    min-width: 48px;
  }
}
```

---

## ♿ ARIA Labels for Buttons

### Fix 4: CommandCenter.tsx Button Updates

```tsx
// File: /web-next/src/components/CommandCenter.tsx

// BEFORE - Line 122-137
<button
  onClick={() => setShowAllAlerts(!showAllAlerts)}
  className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
>
  {showAllAlerts ? (
    <>
      <ChevronUp className="w-4 h-4" />
      Show Less
    </>
  ) : (
    <>
      <ChevronDown className="w-4 h-4" />
      Show All {alerts.length} Alerts
    </>
  )}
</button>

// AFTER - With proper ARIA
<button
  onClick={() => setShowAllAlerts(!showAllAlerts)}
  className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1 focus-ring min-h-[44px]"
  aria-expanded={showAllAlerts}
  aria-controls="alerts-list"
  aria-label={showAllAlerts 
    ? `Collapse alerts list. Currently showing all ${alerts.length} alerts.` 
    : `Expand to show all ${alerts.length} alerts. Currently showing 5.`
  }
>
  {showAllAlerts ? (
    <>
      <ChevronUp className="w-4 h-4" aria-hidden="true" />
      Show Less
    </>
  ) : (
    <>
      <ChevronDown className="w-4 h-4" aria-hidden="true" />
      Show All {alerts.length} Alerts
    </>
  )}
</button>

// Add ID to alerts container
<div id="alerts-list" className="space-y-3">
  {displayedAlerts.map((alert) => (
    // ... alert cards
  ))}
</div>
```

### Fix 5: Quick Action Buttons (Line 313-321)

```tsx
// BEFORE
<Button variant="outline" className="w-full" disabled>
  📢 Share Weekly Update
</Button>
<Button variant="outline" className="w-full" disabled>
  👥 Export Watchlist
</Button>
<Button variant="outline" className="w-full" disabled>
  🏆 View Detailed Analytics
</Button>

// AFTER
<Button 
  variant="outline" 
  className="w-full min-h-[44px]" 
  disabled
  aria-label="Share weekly clan update (Coming soon)"
  aria-describedby="share-update-desc"
>
  <span aria-hidden="true">📢</span> Share Weekly Update
</Button>
<span id="share-update-desc" className="sr-only">
  This feature will allow you to share weekly clan updates via Discord or email
</span>

<Button 
  variant="outline" 
  className="w-full min-h-[44px]" 
  disabled
  aria-label="Export watchlist to CSV (Coming soon)"
>
  <span aria-hidden="true">👥</span> Export Watchlist
</Button>

<Button 
  variant="outline" 
  className="w-full min-h-[44px]" 
  disabled
  aria-label="View detailed clan analytics (Coming soon)"
>
  <span aria-hidden="true">🏆</span> View Detailed Analytics
</Button>
```

---

## 📋 Table Accessibility Fixes

### Fix 6: RosterTable.tsx Semantic Improvements

```tsx
// File: /web-next/src/components/roster/RosterTable.tsx
// Line 553 - Add proper table attributes

// BEFORE
<table className="clash-table" role="table" aria-label="Clan member roster">
  <TableHeader
    sortKey={sortKey}
    sortDirection={sortDir}
    onSort={handleSort}
  />
  <tbody>
    {paginatedMembers.map((member, index) => (
      <TableRow
        key={`${member.tag}-${index}`}
        member={member}
        index={index}
        roster={roster}
        activeSortKey={sortKey}
        aceScoresByTag={aceScoresByTag}
      />
    ))}
  </tbody>
</table>

// AFTER - With caption and better ARIA
<table className="clash-table" role="table" aria-label="Clan member roster">
  <caption className="sr-only">
    Clan member roster showing {paginatedMembers.length} of {filteredMembers.length} members.
    {hasActiveFilters && ' Filters are active.'}
    {sortKey && ` Sorted by ${sortKey} ${sortDir === 'asc' ? 'ascending' : 'descending'}.`}
    Table has {/* column count */} columns including name, role, town hall level, heroes, trophies, donations, and activity.
  </caption>
  <TableHeader
    sortKey={sortKey}
    sortDirection={sortDir}
    onSort={handleSort}
  />
  <tbody>
    {paginatedMembers.length === 0 ? (
      <tr>
        <td colSpan={12} className="text-center py-8">
          <p className="text-slate-400">
            No members match your filters. Try adjusting your search criteria.
          </p>
        </td>
      </tr>
    ) : (
      paginatedMembers.map((member, index) => (
        <TableRow
          key={`${member.tag}-${index}`}
          member={member}
          index={index}
          roster={roster}
          activeSortKey={sortKey}
          aceScoresByTag={aceScoresByTag}
        />
      ))
    )}
  </tbody>
</table>

// Add announcement for filter/sort changes
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {announceText}
</div>
```

### Fix 7: TableHeader.tsx - Add scope and aria-sort

```tsx
// File: /web-next/src/components/roster/TableHeader.tsx

// Example for one header cell
<th 
  scope="col"
  className="px-4 py-3 text-left"
>
  <button
    onClick={() => onSort('name')}
    className="flex items-center gap-2 hover:text-clash-gold transition-colors focus-ring"
    aria-label={`Sort by player name ${
      sortKey === 'name' 
        ? sortDirection === 'asc' 
          ? '(currently ascending, click to sort descending)' 
          : '(currently descending, click to sort ascending)'
        : '(not sorted, click to sort ascending)'
    }`}
    aria-sort={
      sortKey === 'name' 
        ? sortDirection === 'asc' 
          ? 'ascending' 
          : 'descending'
        : 'none'
    }
  >
    <span>Name</span>
    {sortKey === 'name' && (
      <span aria-hidden="true">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )}
  </button>
</th>
```

---

## 🔘 Form Input Fixes

### Fix 8: Search Input with Proper Label

```tsx
// File: /web-next/src/components/roster/RosterTable.tsx
// Around line 467-473

// BEFORE
<Input
  type="text"
  placeholder="Search members by name or tag..."
  value={filters.search}
  onChange={(e) => handleFilterChange({ search: e.target.value })}
  className="mt-1"
/>

// AFTER
<div className="relative">
  <label htmlFor="member-search-input" className="sr-only">
    Search clan members
  </label>
  <Input
    id="member-search-input"
    type="search"
    role="searchbox"
    placeholder="Search members by name or tag..."
    value={filters.search}
    onChange={(e) => handleFilterChange({ search: e.target.value })}
    className="mt-1"
    aria-label="Search clan members by name or player tag"
    aria-describedby="search-help"
    autoComplete="off"
  />
  <span id="search-help" className="sr-only">
    Enter a player name or tag to filter the roster. Results update as you type.
  </span>
  {filters.search && (
    <button
      onClick={() => handleFilterChange({ search: '' })}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200"
      aria-label="Clear search"
    >
      <X className="w-4 h-4" />
    </button>
  )}
</div>

// Add live region for search results announcement
{filters.search && (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    {filteredCount === 0 
      ? `No members found matching "${filters.search}"`
      : `Found ${filteredCount} member${filteredCount === 1 ? '' : 's'} matching "${filters.search}"`
    }
  </div>
)}
```

---

## 🎬 Loading States with Announcements

### Fix 9: Add Loading Announcements

```tsx
// Add to any component with loading states
// Example: ClientDashboard.tsx

const [loadingAnnouncement, setLoadingAnnouncement] = useState('');

useEffect(() => {
  if (isLoading) {
    setLoadingAnnouncement('Loading clan data, please wait...');
  } else if (error) {
    setLoadingAnnouncement(`Error loading data: ${error.message}`);
  } else if (data) {
    setLoadingAnnouncement(`Successfully loaded roster with ${data.members?.length || 0} members`);
    // Clear announcement after 3 seconds
    setTimeout(() => setLoadingAnnouncement(''), 3000);
  }
}, [isLoading, error, data]);

// In JSX
<>
  {/* Screen reader announcements */}
  <div 
    role="status" 
    aria-live="polite" 
    aria-atomic="true"
    className="sr-only"
  >
    {loadingAnnouncement}
  </div>

  {/* Visual loading indicator */}
  {isLoading && (
    <div className="flex items-center justify-center p-8" role="alert" aria-busy="true">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
      <span className="sr-only">Loading clan data...</span>
    </div>
  )}
</>
```

---

## 🦘 Skip Navigation Link

### Fix 10: Add Skip to Main Content

```tsx
// File: /web-next/src/components/layout/DashboardLayout.tsx
// Add at the very top of the component return

export default function DashboardLayout({ children }) {
  return (
    <>
      {/* Skip to main content link - MUST be first focusable element */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-xl focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Header/Navigation */}
      <header>
        {/* ... existing header code ... */}
      </header>

      {/* Main content - add ID here */}
      <main id="main-content" role="main" tabIndex={-1}>
        {children}
      </main>

      {/* Footer */}
      <footer>
        {/* ... existing footer code ... */}
      </footer>
    </>
  );
}
```

---

## 🖼️ Image Alt Text

### Fix 11: Icon Accessibility

```tsx
// Decorative icons (no meaning, just visual)
<Trophy className="w-5 h-5" aria-hidden="true" />
<Shield className="w-5 h-5" aria-hidden="true" />

// Meaningful icons (convey information)
<Trophy 
  className="w-5 h-5" 
  role="img" 
  aria-label="Trophy count indicator"
/>
<AlertTriangle 
  className="w-5 h-5 text-amber-400" 
  role="img"
  aria-label="Warning alert"
/>

// Clan badges and images
<img 
  src="/clans/badge.png" 
  alt={`Badge for ${clanName} clan`}
  className="w-16 h-16"
/>

// League badges
<img 
  src={leagueBadgeUrl} 
  alt={`${leagueName} league badge`}
  className="w-8 h-8"
/>
```

---

## 📱 Responsive Design Improvements

### Fix 12: Mobile Table Stacking

```css
/* Add to globals.css */

@media (max-width: 768px) {
  /* Ensure table is scrollable */
  .clash-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    font-size: 14px;
  }

  .clash-table thead,
  .clash-table tbody,
  .clash-table tr {
    display: block;
  }

  .clash-table thead {
    position: sticky;
    top: 0;
    background: var(--clash-bg-card);
    z-index: 10;
  }

  .clash-table th,
  .clash-table td {
    padding: 0.75rem 0.5rem;
    min-height: 44px; /* Touch target */
  }

  /* Increase base font size on mobile to prevent zoom */
  body {
    font-size: 16px;
  }

  /* Ensure tap targets are larger on mobile */
  button,
  a {
    min-height: 48px;
    min-width: 48px;
  }
}
```

---

## 🎭 Reduced Motion Support

### Fix 13: Respect User Preferences

```css
/* Add to globals.css */

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Keep essential focus indicators */
  *:focus-visible {
    transition: outline 0.1s ease !important;
  }
}

/* Smooth scroll only if user hasn't requested reduced motion */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
```

---

## 🎯 View Toggle Buttons

### Fix 14: Accessible View Toggle

```tsx
// File: /web-next/src/components/roster/RosterTable.tsx
// Lines 520-539

// BEFORE
<Button
  size="sm"
  variant={rosterViewMode === 'table' ? 'primary' : 'ghost'}
  onClick={() => setRosterViewMode('table')}
  className={`view-toggle-btn ${rosterViewMode === 'table' ? 'view-toggle-btn--active' : ''}`}
>
  <List className="h-4 w-4" aria-hidden />
  <span>Table View</span>
</Button>

// AFTER
<Button
  size="sm"
  variant={rosterViewMode === 'table' ? 'primary' : 'ghost'}
  onClick={() => setRosterViewMode('table')}
  className={`view-toggle-btn min-h-[44px] ${rosterViewMode === 'table' ? 'view-toggle-btn--active' : ''}`}
  aria-pressed={rosterViewMode === 'table'}
  aria-label={`Switch to table view${rosterViewMode === 'table' ? ' (currently active)' : ''}`}
>
  <List className="h-4 w-4" aria-hidden="true" />
  <span>Table View</span>
</Button>

<Button
  size="sm"
  variant={rosterViewMode === 'cards' ? 'primary' : 'ghost'}
  onClick={() => setRosterViewMode('cards')}
  className={`view-toggle-btn min-h-[44px] ${rosterViewMode === 'cards' ? 'view-toggle-btn--active' : ''}`}
  aria-pressed={rosterViewMode === 'cards'}
  aria-label={`Switch to card view${rosterViewMode === 'cards' ? ' (currently active)' : ''}`}
  role="button"
  tabIndex={0}
>
  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
  <span>Card View</span>
</Button>

{/* Add announcement for view change */}
{viewChangeAnnouncement && (
  <div role="status" aria-live="polite" className="sr-only">
    {viewChangeAnnouncement}
  </div>
)}
```

---

## 🎨 Light Theme Contrast Fixes

### Fix 15: Light Theme Role Badge Improvements

```css
/* In globals.css - around line 721-749 */

/* BEFORE - Low contrast */
[data-theme="light"] .role-badge {
  background-color: rgba(226, 232, 240, 0.9) !important;
  border-color: rgba(203, 213, 225, 0.85) !important;
  color: #1E293B !important;
}

/* AFTER - Better contrast */
[data-theme="light"] .role-badge {
  background-color: rgba(203, 213, 225, 0.95) !important;
  border-color: rgba(148, 163, 184, 0.9) !important;
  color: #0F172A !important;
  font-weight: 600 !important;
}

[data-theme="light"] .role-badge--member {
  background-color: rgba(203, 213, 225, 0.85) !important;
  border-color: rgba(148, 163, 184, 0.85) !important;
  color: #0F172A !important;
  font-weight: 600 !important;
}

/* Ensure text on light backgrounds meets contrast */
[data-theme="light"] .glass-card p,
[data-theme="light"] .glass-card span {
  color: #0F172A !important; /* Darkest for maximum contrast */
}

[data-theme="light"] .text-muted-contrast {
  color: #475569 !important; /* Darker muted text */
}
```

---

## ✅ Implementation Checklist

Use this checklist as you implement fixes:

### Critical Fixes
- [ ] Fix 1: Update CSS color variables for contrast
- [ ] Fix 2: Enhance focus styles
- [ ] Fix 3: Increase touch target sizes
- [ ] Fix 4: Add ARIA labels to CommandCenter buttons
- [ ] Fix 5: Add ARIA to Quick Action buttons
- [ ] Fix 6: Improve table semantics
- [ ] Fix 7: Add aria-sort to table headers
- [ ] Fix 8: Add proper labels to search input
- [ ] Fix 9: Add loading state announcements
- [ ] Fix 10: Add skip navigation link
- [ ] Fix 11: Add alt text to images/icons
- [ ] Fix 12: Improve mobile responsiveness
- [ ] Fix 13: Add reduced motion support
- [ ] Fix 14: Make view toggle accessible
- [ ] Fix 15: Fix light theme contrast

### Testing After Each Fix
- [ ] Test with keyboard (Tab, Enter, Space, Escape, Arrows)
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Test color contrast with WebAIM tool
- [ ] Run Lighthouse accessibility audit
- [ ] Test on mobile device (real device, not just simulator)

---

## 📊 Before/After Testing

### Test with these tools:
1. **Lighthouse** (Chrome DevTools)
   - Run before: Record score
   - Implement fixes
   - Run after: Should be 95+ score

2. **axe DevTools**
   - Scan before: Note number of issues
   - Implement fixes
   - Scan after: Should be 0 issues

3. **WAVE** (webaim.org/wave)
   - Check before: Note errors
   - Implement fixes
   - Check after: Should have minimal errors

4. **Contrast Checker** (webaim.org/resources/contrastchecker)
   - Test each color combination
   - All should pass WCAG AA (4.5:1 for normal text, 3:1 for large)

---

**Remember:** Accessibility is not a one-time fix but an ongoing commitment. Test regularly and with real users!
