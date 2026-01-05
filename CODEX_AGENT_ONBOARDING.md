# Clash Intelligence Dashboard - Codex Agent Onboarding Guide

**Last Updated:** December 24, 2025  
**Version:** 1.54.0  
**Status:** Production - Active Development

---

## 🎯 Executive Summary

**Clash Intelligence Dashboard** is a comprehensive clan management and analytics platform for Clash of Clans. It provides real-time roster management, player analytics, VIP scoring, war intelligence, and leadership tools to help clan leaders make data-driven decisions.

### What We're Building
- **Primary Goal**: A fast, reliable dashboard for clan leaders to manage their roster, track player performance, and make informed decisions
- **Architecture**: Simple, backend-driven architecture with presentational frontend
- **Data Source**: Supabase (PostgreSQL) as Single Source of Truth (SSOT)
- **Current State**: ~47% of strategic vision complete, core MVP ~75% complete

### Key Differentiators
- **VIP Score System**: Comprehensive player performance metric (replaced WCI/ACE)
- **Automated Data Pipeline**: Daily ingestion with change detection
- **Smart Insights**: AI-powered coaching and recommendations
- **Command Center**: Real-time intelligence dashboard for leadership
- **Historical Tracking**: Complete player history with trend analysis

---

## 🏗️ Architecture Overview

### Tech Stack

**Frontend:**
- Next.js 15.5.7 (App Router)
- React 18.2.0
- TypeScript 5.5.4
- Tailwind CSS 3.4.10
- Zustand 5.0.8 (state management)
- Recharts 2.15.4 (data visualization)

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Storage)
- Node.js with TypeScript

**External Services:**
- Clash of Clans API (official)
- OpenAI GPT-3.5/4 (for insights)
- Vercel (deployment)

**Key Libraries:**
- `@supabase/supabase-js` - Database client
- `openai` - AI insights
- `recharts` - Charts
- `date-fns` - Date utilities
- `zod` - Schema validation

### Architecture Evolution: From Complex to Simple

**Historical Context:**
The project started with a **complex Zustand-based architecture** that experienced persistent issues:
- React 185 infinite loop errors ("Maximum update depth exceeded")
- Complex state management with unstable object/array references
- Multiple `useMemo` dependencies causing infinite re-renders
- Browser crashes on back navigation
- 3000+ lines of complex state management code

**Migration to Simple Architecture:**
We migrated to a **Simple Architecture** approach:
- Created `/simple-roster` and `/simple-player/[tag]` pages
- Replaced complex Zustand stores with direct API calls
- Reduced code from 3000+ lines to ~400 lines
- Eliminated React 185 errors completely
- Made Simple Architecture the primary system

**Current Architecture Status:**
- ✅ **Simple Architecture** (`/simple-roster`, `/simple-player/[tag]`) - **PRIMARY, PRODUCTION** (on `main` branch)
- 🚧 **New UI Architecture** (`/new/*`) - **IN DEVELOPMENT** (on `feature/new-roster-ui` branch, see `web-next/docs/NEW_UI_Architecture_and_Product_Spec.md`)
- ❌ **Old Complex Architecture** - **DEPRECATED** (kept for reference in `_retired_reference/`)

**Important:** 
- When working on new features, use the Simple Architecture patterns from the `main` branch
- The `/new` UI architecture is being developed in the `feature/new-roster-ui` branch and is not yet merged to production
- Simple Architecture remains the current production standard

### Architecture Philosophy: "Simple Architecture"

**Core Principles:**
1. **Backend-Driven**: All calculations and data processing happen server-side
2. **Presentational Frontend**: Frontend only fetches and displays
3. **Direct API Calls**: No complex state management (minimal Zustand usage)
4. **Simple State**: Use `useState` and `useEffect` primarily
5. **SSOT = Supabase**: Pull once, use everywhere

**Data Flow:**
```
Clash of Clans API 
  → Staged Ingestion Pipeline 
  → Supabase (canonical_member_snapshots) 
  → API Endpoints (/api/v2/*) 
  → Frontend Display
```

**Comparison:**
| Aspect | Old Complex | New Simple |
|--------|------------|------------|
| State Management | Zustand store (1600+ lines) | `useState` (1 line) |
| Subscriptions | 20+ components | 0 |
| useMemo calls | 50+ | 0 |
| Re-render issues | Constant | None |
| React 185 errors | Every day | Impossible |
| Code to maintain | 3000+ lines | 400 lines |
| Bug surface area | Huge | Tiny |

---

## 📁 Project Structure

### Key Directories

```
web-next/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (dashboard)/              # Main dashboard routes (PRODUCTION)
│   │   │   ├── simple-roster/       # Primary roster page (Simple Architecture)
│   │   │   ├── player/[tag]/        # Player profile pages
│   │   │   └── command-center/      # Leadership dashboard
│   │   ├── new/                     # NEW UI Architecture (IN DEVELOPMENT - feature/new-roster-ui branch)
│   │   │   ├── roster/             # New roster implementation
│   │   │   ├── player/[tag]/        # New player profiles
│   │   │   └── war/                 # War planning tools
│   │   ├── api/                     # API routes
│   │   │   ├── v2/                  # Version 2 API endpoints
│   │   │   │   ├── roster/          # Roster data endpoint
│   │   │   │   └── player/[tag]/    # Player profile endpoint
│   │   │   ├── cron/                # Scheduled job endpoints
│   │   │   │   └── daily-ingestion/ # Daily data ingestion
│   │   │   └── insights/            # AI insights endpoints
│   │   └── layout.tsx               # Root layout
│   ├── components/                   # React components
│   │   ├── layout/                  # Layout components
│   │   ├── roster/                  # Roster table components
│   │   ├── player/                  # Player profile components
│   │   ├── command-center/          # Command center components
│   │   ├── ui/                      # Base UI components (shadcn-style)
│   │   └── insights/                 # Insights components
│   ├── lib/                         # Core business logic
│   │   ├── ingestion/               # Data ingestion pipeline
│   │   │   ├── staged-pipeline.ts   # Main ingestion pipeline
│   │   │   └── calculate-vip.ts     # VIP score calculation
│   │   ├── metrics/                 # Metric calculations
│   │   │   └── vip.ts               # VIP score formulas
│   │   ├── coc.ts                   # Clash of Clans API client
│   │   ├── supabase-*.ts            # Supabase clients
│   │   ├── stores/                  # Zustand stores
│   │   └── config.ts                # Configuration
│   └── types/                       # TypeScript definitions
│       ├── index.ts                 # Main types
│       └── canonical-member-snapshot.ts
├── supabase/
│   └── migrations/                  # Database migrations
└── package.json
```

### Critical Files

**Frontend:**
- `web-next/src/app/(dashboard)/simple-roster/RosterPage.tsx` - Main roster table
- `web-next/src/app/(dashboard)/player/[tag]/PlayerProfileClient.tsx` - Player profile
- `web-next/src/app/(dashboard)/command-center/CommandCenterClient.tsx` - Command center

**Backend:**
- `web-next/src/app/api/v2/roster/route.ts` - Roster API endpoint
- `web-next/src/app/api/v2/player/[tag]/profile/route.ts` - Player API endpoint
- `web-next/src/app/api/cron/daily-ingestion/route.ts` - Cron job handler

**Data Pipeline:**
- `web-next/src/lib/ingestion/staged-pipeline.ts` - Main ingestion pipeline
- `web-next/src/lib/ingestion/calculate-vip.ts` - VIP score calculation
- `web-next/src/lib/metrics/vip.ts` - VIP score formulas

**Configuration:**
- `web-next/src/lib/config.ts` - App configuration (home clan, etc.)

---

## 🗄️ Database Schema (Supabase)

### Core Tables

**`canonical_member_snapshots`** (Primary API Data Source)
- Latest member data for API consumption
- Updated by ingestion pipeline
- Includes: TH level, hero levels, trophies, donations, VIP scores

**`member_snapshot_stats`** (Detailed Snapshots)
- Complete historical snapshots
- Used for trend analysis and change detection
- Includes all enriched fields (pets, builder base, war stats, etc.)

**`vip_scores`** (VIP Score History)
- Weekly VIP score calculations
- Calculated on Monday snapshots
- Historical tracking for trends

**`members`** (Player Registry)
- Current roster registry
- Player metadata and aliases

**`roster_snapshots`** (Snapshot Metadata)
- Snapshot timestamps and metadata
- Links to raw snapshot data

**`wars`**, **`war_attacks`**, **`war_defenses`**
- War activity tracking
- Attack/defense performance

**`capital_raid_seasons`**, **`capital_attacks`**
- Capital raid participation
- Capital contribution tracking

**`tenure_ledger`**
- Append-only JSONL format
- Historical tenure tracking

**`alerts`**, **`tasks`**, **`notes`**
- Leadership tooling
- Player notes and alerts

**`user_roles`**
- Role mapping (LEADER, CO_LEADER, ELDER, MEMBER, VISITOR)
- Access control

---

## 🔄 Data Pipeline & Automation

### Daily Ingestion Process

**Schedule:**
- 4:30 AM UTC - First daily ingestion
- 5:30 AM UTC - Second daily ingestion

**Pipeline Stages:**
1. **Fetch** - Pull clan + player data from Clash of Clans API
2. **Transform** - Process and validate data
3. **Upsert** - Write to `canonical_member_snapshots`
4. **Write Snapshot** - Store detailed snapshot in `member_snapshot_stats`
5. **Write Stats** - Calculate and store metrics
6. **Calculate VIP** - Weekly VIP score calculation (Mondays)

**Key Features:**
- Idempotent operations (safe to rerun)
- Rate limiting (100ms dev, 700ms prod)
- Error handling and retries
- Change detection
- Stale data detection

### VIP Score Calculation

**Formula:**
```
VIP Score = (0.50 × Competitive) + (0.30 × Support) + (0.20 × Development)
```

**Components:**

**Competitive (50%):**
- Ranked (60%): LAI (70%) + TPG (30%)
- War (40%): OVA (60%) + DVA (40%)

**Support (30%):**
- Donations (60%): Small-clan friendly calculation
- Capital (40%): Week-over-week delta

**Development (20%):**
- Base Quality (40%): PDR (100 - rush%)
- Activity (30%): Capital + Achievement + War participation
- Hero Progression (30%): Week-over-week hero upgrades

**Calculation Schedule:**
- Calculated weekly on Monday snapshots
- Historical tracking for trends
- Displayed on roster and player pages

---

## ✨ Key Features

### ✅ Completed Features (Production Ready)

#### 1. Simple Architecture Dashboard (90% Complete)
- **Roster Page** (`/simple-roster`)
  - Sortable columns (League, Trophies, TH, Donations, VIP Score)
  - VIP Score display with trend indicators
  - Rush % calculation and color coding
  - Activity badges (Very Active → Inactive)
  - Hero levels display (BK, AQ, GW, RC, MP)
  - Mobile-responsive (table → cards)
  - Auto-refresh on stale data detection
  - Export functionality (CSV, Discord, Copy Summary)
  - Roster summary cards
  - New joiner flagging
  - Tenure tracking

#### 2. Player Profiles (80% Complete)
- **Player Profile Page** (`/player/[tag]`)
  - Comprehensive player detail view
  - VIP Score history and breakdown
  - Hero progression tracking
  - Donation statistics
  - League and trophy history
  - Historical charts:
    - Trophy progression (regular + ranked)
    - Donation history (given vs received)
    - Hero upgrade timeline (BK, AQ, GW, RC)
  - Comprehensive copy summary
  - Player navigation (prev/next, keyboard shortcuts)

#### 3. Command Center (100% Complete - Phase 1)
- Real-time intelligence dashboard
- Automated alert detection:
  - Inactivity alerts (7+ days, 14+ days)
  - Donation imbalance warnings
  - Rushed base detection
  - Elder promotion opportunities
  - At-risk member identification
  - New member welcome reminders
- Clan health metrics
- Top performers showcase
- Watchlist with severity levels
- Momentum indicators

#### 4. Smart Insights System (85% Complete)
- InsightsEngine class (1,520 lines)
- SmartInsightsPayload unified structure
- Today's Briefing component
- Coaching Insights component
- Player of the Day recognition
- OpenAI GPT-3.5 Turbo integration
- Resilient fallbacks (local analysis when AI unavailable)
- Nightly batch processing pipeline

#### 5. Data Enrichment (100% Complete)
- 17 new enriched fields tracked historically
- Pet levels, Builder Base metrics, War statistics
- Lab progress, Achievement tracking, Experience metrics
- Timeline deltas for upgrades and changes
- Backfill script for historical data

### 🚧 Partially Implemented Features

#### 1. War Analytics (20% Complete) 🔴 HIGH PRIORITY
- ✅ Basic war log display
- ✅ Current war status
- ❌ Attack Efficiency Index (stars per attack)
- ❌ Contribution Consistency Score
- ❌ Cleanup Efficiency tracking
- ❌ Defensive Hold Rate
- ❌ Strategy Failure Detection
- ❌ Visual war analytics dashboard

#### 2. Capital Analytics (15% Complete) 🔴 HIGH PRIORITY
- ✅ Basic capital raid data display
- ❌ Average Loot per Attack metrics
- ❌ One-Hit District Clear Rate
- ❌ Player "Carry" Score
- ❌ Raid Participation Rate analysis
- ❌ District Performance Heatmaps

#### 3. Trend & Progress Tracking (10% Complete) 🔴 HIGH PRIORITY
- ✅ Basic snapshot history
- ✅ Change detection
- ✅ VIP Score historical tracking
- ❌ Rolling War Performance Trends (30/60/90 day windows)
- ❌ Sparklines for key metrics
- ❌ Clan Momentum Quadrants
- ❌ Predictive Performance Modeling

### ❌ Not Implemented (Planned)

- Multi-clan portfolio management
- Advanced export/import tools
- Comprehensive testing suite
- Error monitoring (Sentry)
- CI/CD pipelines
- Monetization features

---

## 🔑 Key Business Logic

### Hero Level Validation

Hero maximum levels by Town Hall:
```typescript
const HERO_MAX_LEVELS: Record<number, HeroCaps> = {
  7: { bk: 5 },
  8: { bk: 10 },
  9: { bk: 30, aq: 30, mp: 5 },
  10: { bk: 40, aq: 40, mp: 10 },
  11: { bk: 50, aq: 50, gw: 20, mp: 15 },
  12: { bk: 65, aq: 65, gw: 40, mp: 20 },
  13: { bk: 75, aq: 75, gw: 50, rc: 25, mp: 25 },
  14: { bk: 80, aq: 80, gw: 55, rc: 30, mp: 30 },
  15: { bk: 85, aq: 85, gw: 60, rc: 35, mp: 35 },
  16: { bk: 90, aq: 90, gw: 65, rc: 40, mp: 40 }
};
```

### Rush Percentage Calculation
- Compares hero levels to TH-appropriate maximums
- Calculates peer-relative rush percentage
- Identifies rushed vs properly developed bases

### Activity Scoring
- Very Active: High engagement across all metrics
- Active: Good participation
- Moderate: Average participation
- Low: Below average
- Inactive: Minimal or no activity

### Tenure Tracking
- Append-only JSONL ledger format
- Automatic date calculation from "as_of" timestamps
- Non-destructive historical data preservation

### Stale Data Detection
```typescript
// API returns dateInfo
{
  currentDate: "2025-11-01",
  snapshotDate: "2025-10-31",
  isStale: true  // currentDate > snapshotDate
}

// Frontend auto-refreshes if stale
if (dateInfo.isStale && !staleCheckRef.current) {
  setRefreshTrigger(prev => prev + 1);
}
```

---

## 🛠️ Development Workflow

### Environment Setup

**Required Environment Variables:**
```bash
# Required
COC_API_TOKEN=your_clash_api_token
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key

# Optional
USE_LOCAL_DATA=false
ENABLE_DEBUG_LOGGING=true
SKIP_API_CALLS=false
FIXIE_URL=your_proxy_url
```

**Home Clan Configuration:**
- Default: `#2PR8R8V8P`
- Configured in `web-next/src/lib/config.ts`

### Key Scripts

```bash
# Development
npm run dev              # Start dev server (port 5050)
npm run dev:alt          # Alternative port (5060)

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Watch mode
npm run test:e2e         # E2E tests with Playwright

# Ingestion
npm run ingest:run       # Run ingestion manually
npm run ingest:mac       # Mac-based ingestion

# Backfill
npm run backfill-enriched-data
npm run backfill:player-day
npm run backfill:player-history

# Deployment
npm run build            # Production build
npm run deploy:prod      # Deploy to production
```

### Rate Limiting Configuration
- **Development**: 100ms intervals, 5 concurrent requests
- **Production**: 700ms intervals, 3 concurrent requests
- **Fallback**: Mock data when API unavailable

---

## 📊 Current Status & Priorities

### Overall Completion
- **Strategic Vision**: ~47% Complete
- **Core MVP**: ~75% Complete
- **Advanced Analytics**: ~15% Complete
- **Production Readiness**: ~30% Complete

### Immediate Priorities (Week 1-2)

1. **VIP Score Trend Chart** 🟡
   - Data is available, just needs chart visualization
   - Add to player profile page

### High Priority (Month 1-2)

1. **War Performance Intelligence Engine** 🔴 **GAME CHANGER**
   - Attack Efficiency Index
   - Contribution Consistency Score
   - Cleanup Efficiency tracking
   - Defensive Hold Rate
   - Visual war analytics dashboard

2. **Trend & Momentum Intelligence** 🔴
   - Rolling performance windows (30/60/90 day)
   - Sparklines for key metrics
   - Clan momentum quadrants
   - Predictive modeling

3. **Capital Raid Analytics** 🟡
   - Loot per attack metrics
   - Carry score calculations
   - Raid participation tracking
   - District performance heatmaps

### Medium Priority (Month 2-3)

- Engagement & Readiness System
- Export/Import Tools
- Production Hardening (testing, monitoring, error handling)

---

## 🚫 What We're NOT Doing

### Deprecated/Removed

**Old Complex Architecture (Deprecated):**
- ❌ Original Zustand-based dashboard (`/` route with ClientDashboard)
- ❌ Complex Zustand state management (1600+ lines, caused React 185 errors)
- ❌ Dual architecture approach (Simple Architecture is now primary)
- ❌ ClientDashboard component (replaced by SimpleRosterPage)
- ❌ Old complex roster components (in `_retired_reference/`)

**UI Components (Deprecated):**
- ❌ Command Rail (disabled placeholder)
- ❌ QuickActions bar (moved to header menu)
- ❌ Card view toggle (auto-responsive instead)

**Metrics (Replaced):**
- ❌ WCI Score (replaced by VIP Score)
- ❌ ACE Score (replaced by VIP Score)

**Note:** Old complex architecture code is preserved in `src/_retired_reference/` for reference only. Do not use these patterns for new development.

### Not Planned
- ❌ Real-time WebSocket updates (polling is sufficient)
- ❌ Complex memoization patterns
- ❌ Multi-clan management (single clan focus for now)
- ❌ Custom dashboard builder
- ❌ Advanced AI features (keep it simple)

---

## 🔒 Security & Access Control

### Role-Based Access

**Roles:**
- `LEADER` - Full access
- `CO_LEADER` - Full access
- `ELDER` - Read access to leadership views, analytics
- `MEMBER` - Personal profile, basic roster view
- `VISITOR` - Logged in but not part of current clan

**Permissions:**
- LeadershipGuard component for access control
- Role-based UI visibility
- API-level access checks

### API Security
- Rate limiting to prevent abuse
- Input validation and sanitization
- Proper error handling without information leakage
- Environment variable protection

---

## 📝 Code Quality Standards

### TypeScript
- Strict type checking enabled
- Comprehensive interface definitions
- No `any` types in production code
- Proper error handling with typed exceptions

### Code Style
- Consistent naming conventions
- Proper component composition
- Separation of concerns
- Comprehensive JSDoc documentation

### Testing
- Jest with TypeScript support
- Mock implementations for CoC API
- File system mocking for ledger operations
- Environment-specific test configurations

### Performance
- Optimized re-renders with React.memo
- Efficient state updates with Zustand
- Proper cleanup of async operations
- Memory leak prevention

---

## 🎯 Success Metrics

### Technical Metrics
- ✅ Zero React 185 errors
- ✅ Zero infinite loop crashes
- ✅ < 2 second page load time
- ✅ 100% API endpoint uptime
- ✅ Daily cron job success rate > 95%

### User Experience Metrics
- ✅ Fresh data always available
- ✅ Smooth navigation (no crashes)
- ✅ Mobile-responsive design
- ✅ Intuitive interface
- ✅ Fast feature additions

### Data Quality Metrics
- ✅ Accurate VIP scores
- ✅ Complete player data
- ✅ Historical tracking
- ✅ Reliable ingestion

---

## 🔍 Key Patterns & Conventions

### API Endpoints

**Version 2 API (Current):**
- `/api/v2/roster` - Roster data with VIP scores
- `/api/v2/player/[tag]/profile` - Player profile data

**Legacy Endpoints (Deprecated):**
- `/api/roster` - Old roster endpoint
- `/api/ai-*` - Old AI endpoints (being consolidated)

### Data Fetching Pattern

```typescript
// Simple fetch pattern (no complex state)
const [data, setData] = useState<Data | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/v2/roster')
    .then(res => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

### Component Structure

```typescript
// Presentational component pattern
export function ComponentName({ data }: Props) {
  // Simple state, no complex logic
  // Display data from props
  return <div>...</div>;
}
```

### Error Handling

```typescript
// Graceful error handling
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error);
  // Fallback or user-friendly error message
}
```

---

## 📚 Related Documentation

### Key Documents
- `CODEX_CONTEXT.md` - Original Codex context (may be outdated)
- `STATUS_OVERVIEW.md` - Detailed status and completion metrics
- `MASTER_PLAN_2025-11-01.md` - Current master plan
- `FEATURE_INVENTORY.md` - Feature wishlist
- `VIP_SCORE_SPECIFICATION.md` - VIP score formula documentation
- `SIMPLE_ARCHITECTURE_CHANGELOG.md` - Implementation history

### Architecture Docs
- `docs/APP_SPEC.md` - Application specification
- `docs/architecture/data-spine.md` - Data spine architecture
- `web-next/docs/NEW_UI_Architecture_and_Product_Spec.md` - UI architecture

---

## 🚀 Getting Started for Codex Agents

### When Starting Work

1. **Read First:**
   - This document (CODEX_AGENT_ONBOARDING.md)
   - `STATUS_OVERVIEW.md` for current state
   - `MASTER_PLAN_2025-11-01.md` for priorities

2. **Understand the Architecture:**
   - **Simple Architecture is PRIMARY** (migrated from complex Zustand-based architecture)
   - Simple Architecture principles (backend-driven, presentational frontend)
   - SSOT = Supabase
   - `/new` UI architecture is in `feature/new-roster-ui` branch (IN DEVELOPMENT, not merged to production)
   - Old complex architecture is DEPRECATED (see `_retired_reference/`)

3. **Check Current State:**
   - Review `STATUS_OVERVIEW.md` completion metrics
   - Check what's already implemented
   - Understand what's deprecated

4. **Follow Patterns:**
   - Use existing patterns (don't reinvent)
   - Keep it simple (avoid complexity)
   - Test thoroughly before moving on

### Common Tasks

**Adding a New Feature:**
1. Check if feature exists in `FEATURE_INVENTORY.md`
2. Review similar implementations
3. Follow Simple Architecture principles
4. Add to appropriate API endpoint
5. Create presentational component
6. Test thoroughly

**Fixing a Bug:**
1. Reproduce the issue
2. Check related code patterns
3. Fix following existing conventions
4. Test fix thoroughly
5. Check for similar issues

**Modifying Data Pipeline:**
1. Review `staged-pipeline.ts`
2. Understand data flow
3. Check Supabase schema
4. Ensure idempotency
5. Test with sample data

---

## 💡 Key Insights

### What's Working Well
- ✅ Simple architecture is stable and fast
- ✅ Data pipeline is reliable
- ✅ VIP Score system is comprehensive
- ✅ Command Center provides real-time intelligence
- ✅ Player profiles are comprehensive

### Biggest Opportunities
- 🔴 **War Analytics** - Most requested by clan leaders
- 🔴 **Trend Analysis** - Shows progress, not just snapshots
- 🔴 **Capital Analytics** - 1/3 of clan activity, under-analyzed
- ✅ **Automation** - Cron jobs are working

### Strategic Assessment
**Current State:** Solid MVP with excellent technical foundations  
**Biggest Gap:** Intelligence Engines (War, Capital, Trends)  
**Next Step:** Build War Performance Intelligence Engine (highest impact)

---

## 🆘 Troubleshooting

### Common Issues

**Stale Data:**
- Check cron job status: `/api/admin/cron-status`
- Verify ingestion logs
- Check Supabase for latest snapshot

**VIP Scores Not Calculating:**
- Verify it's a Monday (weekly calculation)
- Check `calculate-vip.ts` logic
- Review Supabase `vip_scores` table

**API Rate Limiting:**
- Check rate limiter configuration
- Verify CoC API token is valid
- Review rate limiter logs

**Build Errors:**
- Check TypeScript errors
- Verify environment variables
- Review dependency versions

---

## 📞 Quick Reference

### Important URLs
- Production: (Vercel deployment)
- Staging: (Vercel preview)
- Local Dev: `http://localhost:5050`

### Key Endpoints
- `/simple-roster` - Main roster page
- `/player/[tag]` - Player profile
- `/command-center` - Leadership dashboard
- `/api/v2/roster` - Roster API
- `/api/v2/player/[tag]/profile` - Player API
- `/api/cron/daily-ingestion` - Ingestion endpoint

### Key Commands
```bash
npm run dev              # Start development
npm test                 # Run tests
npm run ingest:run       # Run ingestion
npm run build            # Build for production
```

---

**Last Updated:** December 24, 2025  
**Maintained By:** Development Team  
**Questions?** Review related documentation or check `STATUS_OVERVIEW.md` for current state

