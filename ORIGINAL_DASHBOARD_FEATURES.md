# Original Dashboard Features (To Remember)

## Main Dashboard Page (`/app/page.tsx`)
**Status:** Complex, Zustand-heavy, had infinite loop issues

### Features That Were There:
1. **Live Roster Data** - Real-time CoC API calls with rate limiting
2. **Hero Level Tracking** - With TH-appropriate max levels
3. **Rush Percentage** - Peer-relative calculation
4. **Donation Balance** - Shows deficit when receiving > giving
5. **Tenure Tracking** - Append-only ledger
6. **Player Notes** - Custom fields per player
7. **AI-Powered Coaching** - Summaries and advice
8. **Snapshot Versioning** - Historical data access
9. **Events Dashboard** - Player events, milestones, clan activities
10. **Filters** - Multiple roster filtering options
11. **Summary Cards** - Clan overview stats
12. **Card View** - Alternative to table view (was crashing)
13. **Zustand State Management** - Complex reactive state

### Components Used:
- `ClientAppShell` - Main shell with Zustand store
- `RosterTable` - Complex table with infinite loops
- `RosterCards` - Card view (disabled due to crashes)
- `PlayerProfilePage` - Full player detail view
- Multiple filter components
- AI summary panels
- Quick Actions sidebar
- Command Rail sidebar
- Theme toggle

### What We Kept/Improved:
✅ Roster data → simple-roster (clean, fast)
✅ Hero tracking → Added to simple-roster
✅ Rush % → Improved calculation
✅ Donations → Better visualization
✅ Activity scoring → Multi-indicator system

### What We're Building:
🚧 Player history pages with charts
🚧 Historical trends and graphs
🚧 War performance tracking
🚧 Clean navigation

### What We Removed:
❌ Zustand complexity
❌ Infinite re-render loops
❌ Card view (was broken)
❌ Overly complex state management
❌ Multiple redundant refresh buttons
❌ Theme toggle
❌ Quick Actions sidebar (will move to menu)
❌ Command Rail (will simplify)
