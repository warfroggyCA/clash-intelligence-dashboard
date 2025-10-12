# Simple Architecture - Changelog & Technical Documentation

**Last Updated:** October 12, 2025  
**Purpose:** Track all changes made to the simplified Clash of Clans Dashboard architecture

---

## Overview

This document tracks the creation and evolution of the simplified architecture for the Clash of Clans Intelligence Dashboard. The goal is to provide a stable, maintainable alternative to the original complex Zustand-based architecture that was experiencing persistent React 185 infinite loop errors.

---

## Architecture Decision

**Decision:** Create simplified `/simple-roster` and `/simple-player/[tag]` pages with backend-driven data flow.

**Why:**
- Original dashboard had persistent "Maximum update depth exceeded" (React 185) errors
- Complex Zustand state management with unstable object/array references
- Multiple `useMemo` dependencies causing infinite re-renders
- Browser crashes on back navigation
- Card view completely broken

**Approach:**
- Backend provides fully processed data
- Frontend is purely presentational (no complex state)
- Direct API calls instead of Zustand stores
- Simple `useState` and `useEffect` patterns only

---

## Changes Log

### 1. Backend Proxy Setup (Critical Infrastructure)

**Date:** October 12, 2025

**Problem:** 
- Kubernetes ingress routes `/api/*` to port 8001 (backend)
- This is a Next.js-only app (no separate backend)
- API routes handled by Next.js on port 3000
- Preview URL getting 502 errors

**Solution:**
- Created `/etc/nginx/backend-proxy.conf` - nginx reverse proxy
- Created `/etc/supervisor/conf.d/supervisord_backend_proxy.conf` - supervisor service
- Proxy listens on port 8001 and forwards to Next.js on port 3000

**Files Created:**
```
/etc/nginx/backend-proxy.conf
/etc/supervisor/conf.d/supervisord_backend_proxy.conf
```

**Impact:** Preview window now works correctly for all API calls

---

### 2. Simple Roster Page

**File:** `/app/web-next/src/app/simple-roster/page.tsx`

**Created:** October 12, 2025

**Features:**
- Clean implementation with no Zustand
- Direct fetch to `/api/v2/roster` endpoint
- Displays clan roster in table format
- Real player names from Supabase
- Professional styling with DashboardLayout
- Mobile responsive (table → cards)

**Key Implementation Details:**
```typescript
// Simple state management
const [roster, setRoster] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Direct API fetch in useEffect
useEffect(() => {
  async function loadRoster() {
    const response = await fetch('/api/v2/roster');
    const apiData = await response.json();
    setRoster(apiData.data);
  }
  loadRoster();
}, []);
```

**UI Components Used:**
- `DashboardLayout` - Full dashboard chrome
- `TownHallBadge` - Real game assets for TH icons
- `LeagueBadge` - Real league icons from game
- `getRoleBadgeVariant` - Consistent role badge styling

**Responsive Design:**
- Desktop: Full table with all columns
- Mobile (<768px): Card layout with stats grid

---

### 3. Simple Player Profile Page

**File:** `/app/web-next/src/app/simple-player/[tag]/page.tsx`

**Created:** October 12, 2025

**Features:**
- Clean player profile display
- Real player names from Supabase
- Hero levels display
- Donation statistics
- League information
- Mobile responsive

**Key Implementation:**
- Fetches from `/api/v2/player/[tag]` endpoint
- No Zustand state management
- Simple presentational component

---

### 4. New API Endpoint - Player Data from Supabase

**File:** `/app/web-next/src/app/api/v2/player/[tag]/route.ts`

**Created:** October 12, 2025

**Why:**
- Original `/api/player/[tag]` fetches from Clash of Clans API
- CoC API returns generic placeholder names (e.g., "Player354")
- Need real player names stored in Supabase

**What It Does:**
1. Looks up player in Supabase `members` table
2. Gets latest snapshot data for stats
3. Returns complete player data with real name
4. Includes hero levels, donations, league info

**Data Structure:**
```typescript
{
  success: true,
  data: {
    name: "andrew",           // Real name from DB
    tag: "#UU9GJ9QQ",
    role: "member",
    townHallLevel: 12,
    trophies: 2729,
    donations: 0,
    donationsReceived: 0,
    league: { name: "..." },
    rankedLeague: { name: "..." },
    clan: { name: "...HeCk YeAh..." },
    bk: 52, aq: 59, gw: 26, rc: 15, mp: 15
  }
}
```

**Tag Normalization:**
- Handles tags with or without `#` prefix
- Ensures consistent lookup in database

---

### 5. Styling Enhancements

**Date:** October 12, 2025

**Initial State:**
- Basic table with emojis and simple styling
- Gradient backgrounds but no game assets
- Generic role badges

**Enhanced To:**
- **Real Town Hall icons** - Actual game assets from `/assets/clash/Townhalls/`
- **Real League badges** - Game assets from `/assets/Oct2025 Leagues/`
- **Professional role badges** - Consistent with original dashboard
  - Leader: Yellow background
  - Co-Leader: Orange background
  - Elder: Purple background
  - Member: Gray background
- **Brand colors** - Golden yellow for headers, proper contrast
- **Clean typography** - Proper font weights and spacing
- **Hover effects** - Smooth transitions on table rows
- **Better borders** - Clean dividers and structure

**Desktop Table Features:**
- Column headers with uppercase tracking
- Right-aligned numbers (trophies, donations)
- Left-aligned text (names, roles)
- Center-aligned icons (TH, League)
- Subtle hover highlighting

**Mobile Card Features:**
- Player name as clickable link
- TH badge + Role badge in header
- League icon in top-right corner
- Stats grid: Trophies | Donated | Received
- Touch-friendly spacing

---

### 6. DashboardLayout Integration

**Date:** October 12, 2025

**Change:** Wrapped both simple pages in `DashboardLayout` component

**Why:**
- User wanted exact same look and feel as original
- Original has full navigation, branding, quick actions
- Needed professional, sophisticated UI

**Result:**
- "CLASH INTELLIGENCE" branding
- Top navigation with clan icon and tag
- Tab navigation (Dashboard, History, Command Center, etc.)
- Quick Actions bar
- Same dark blue theme
- Professional polish matching original

**Implementation:**
```typescript
import dynamic from 'next/dynamic';
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

// Wrap content
return (
  <DashboardLayout>
    {/* page content */}
  </DashboardLayout>
);
```

---

## Known Issues & Limitations

### Current Limitations:
1. **No filtering** - Table shows all members, no search/filter
2. **No sorting** - Columns not sortable yet
3. **No roster summary** - Missing stats cards at top
4. **No card view toggle** - Only table view (mobile gets cards automatically)
5. **No ACE scores** - Advanced metrics not calculated
6. **No pagination** - All members shown at once (fine for small clans)

### These Are Intentional:
- Simple architecture by design
- Can add features incrementally
- Each addition tested for stability

---

## Testing Status

### What's Been Tested:
✅ Roster page loads with all 19 members  
✅ Player profile pages load with real names  
✅ Navigation between roster and player profiles  
✅ Desktop layout (1920x800)  
✅ Mobile layout (375x667)  
✅ API endpoints return 200 status  
✅ Backend proxy correctly forwards requests  
✅ Real game assets (TH icons, League badges) display  
✅ Role badges show correct colors  
✅ Preview window access works  

### Not Yet Tested:
- Back button from player profile
- Very large rosters (100+ members)
- Tablet breakpoints (768-1024px)
- Keyboard navigation
- Screen reader compatibility
- Performance with slow network

---

## Deployment Notes

### Critical Services:
1. **Frontend (Next.js)** - Port 3000, managed by supervisor
2. **Backend Proxy (nginx)** - Port 8001, managed by supervisor
3. **MongoDB** - For session/auth data
4. **Supabase** - External, for clan/player data

### Service Control:
```bash
sudo supervisorctl status
sudo supervisorctl restart backend   # nginx proxy
sudo supervisorctl restart frontend  # Next.js
sudo supervisorctl restart all
```

### If Backend Proxy Fails:
The nginx config may be lost on container restart. Recreate:
1. `/etc/nginx/backend-proxy.conf` (see section 1 above)
2. `sudo supervisorctl restart backend`
3. Verify: `curl http://localhost:8001/api/v2/roster`

---

## Future Enhancements (Planned)

### Phase 1 - Core Features:
- [ ] Add roster summary cards (total members, avg TH, total donations)
- [ ] Add search/filter functionality
- [ ] Add column sorting
- [ ] Add player count badge

### Phase 2 - Advanced Features:
- [ ] Add rush score calculations
- [ ] Add activity level indicators
- [ ] Add ACE score integration
- [ ] Add donation balance warnings
- [ ] Add card/table view toggle

### Phase 3 - Polish:
- [ ] Add animations and transitions
- [ ] Add loading skeletons
- [ ] Add error boundaries
- [ ] Add offline support
- [ ] Add keyboard shortcuts

---

## Architecture Comparison

### Original Dashboard:
```
User Action
  ↓
Zustand Store (complex state)
  ↓
Multiple useMemo hooks (unstable deps)
  ↓
Re-render cascade
  ↓
Infinite loop (React 185 error)
```

### Simple Architecture:
```
User Action
  ↓
API Call (direct fetch)
  ↓
useState update (stable)
  ↓
Single render
  ↓
Stable ✅
```

---

## Code Quality Metrics

### Before (Original):
- Multiple nested `useMemo` hooks
- Zustand store with 20+ state properties
- Complex selectors with array/object references
- 5+ components causing infinite loops
- Browser crashes on navigation

### After (Simple):
- No `useMemo` dependencies on unstable refs
- No Zustand (just useState)
- Direct API calls
- Zero infinite loops
- Stable navigation

---

## Maintenance Notes

### When Adding Features:
1. **Test incrementally** - Add one feature at a time
2. **Avoid useMemo with objects/arrays** - Unless properly memoized
3. **Keep API calls simple** - No complex state management
4. **Test mobile responsiveness** - Check card layout
5. **Update this document** - Document all changes

### When Debugging:
1. Check supervisor status first
2. Check backend proxy is running on 8001
3. Check frontend logs: `tail -n 50 /var/log/supervisor/frontend.err.log`
4. Check browser console for client-side errors
5. Verify API endpoints with curl

---

## References

### Key Files:
- `/app/web-next/src/app/simple-roster/page.tsx` - Roster table
- `/app/web-next/src/app/simple-player/[tag]/page.tsx` - Player profile
- `/app/web-next/src/app/api/v2/roster/route.ts` - Roster API
- `/app/web-next/src/app/api/v2/player/[tag]/route.ts` - Player API
- `/etc/nginx/backend-proxy.conf` - Backend proxy config
- `/etc/supervisor/conf.d/supervisord_backend_proxy.conf` - Supervisor config

### Related Documents:
- `RCA_PLAYER_PROFILE_BUG.md` - Original bug analysis
- `REACT_185_INFINITE_LOOP_FINAL_FIX.md` - Infinite loop documentation
- `SIMPLE_REBUILD_PLAN.md` - Initial rebuild plan

---

**End of Changelog**
