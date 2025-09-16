Ok # Clash Intelligence Dashboard - Development Ideas

## What's New (Unreleased)
### Security + API hardening sweep (2025‑09‑15)
- Production security headers: CSP, HSTS, X‑Frame‑Options, Referrer‑Policy, Permissions‑Policy; disabled `x-powered-by`.
- Standardized API response shape: every hot route returns `ApiResponse<T>` with `{ success, data?, error?, message?, requestId? }`.
- Zod‑validated inputs across routes; consistent 400/401/403/404/429 semantics.
- Durable inbound rate limiting via Upstash Redis with in‑memory fallback; applied to roster, snapshots, departures, AI, sync, uploads, migrations.
- SSR roster snapshot‑first bootstrap for fast first paint; `lib/roster.ts` helper.
- Leadership middleware (opt‑in via `LEADERSHIP_TOKEN`) guarding admin/write endpoints.
- Structured JSON request logging with `requestId`; pluggable transport (provider hook), console JSON fallback.
- Fix: CoC client uses IPv4 for native fetch; proxy path uses axios + https‑proxy‑agent.
- Breaking: Roster and other APIs return `{ success, data }`—external consumers must read `json.data`.

### RequestId + ApiResponse standardization (details)
- Helper: `createApiContext(req, route)` provides `{ logger, json }`.
  - `json(body, init?)` injects `requestId` into body and sets `x-request-id` header.
  - `logger` emits structured JSON logs with consistent fields: `level, msg, route, path, ip, requestId, ts`.
- Updated routes to use helper: roster, snapshots (list/create/changes), departures (+notifications), AI (summary/coaching/batch-results/dna-cache), sync/heroes, tenure (map/save/seed/update), health, diag (ip/env), access (init/list), player‑resolver, player/[tag], upload‑snapshots, migrate‑departures, cron/daily‑snapshot, ip‑test, debug (data/player).
- Middleware 401s include `requestId` and set `x-request-id`.

### Read‑side caching
- Added tiny wrapper `cached(key, fn, ttlSeconds)` over `next/cache` `unstable_cache` for brief deduping on hot reads.
- Applied conservatively (defaults 10s): snapshots list (Supabase), snapshot/tenure reads in roster snapshot path, snapshot changes (by‑date/all), departures list, player‑resolver file, departures/notifications roster fetch, tenure ledger lines, AI batch‑results.

### Logging transport (provider‑ready)
- `src/lib/logger.ts` now supports a pluggable provider via `globalThis.__structuredLogger` with `info|warn|error|debug(payload)`; falls back to console JSON.
- Keep current logs but future‑proof for pino or hosted transports without touching call sites.

### MCP compatibility
- `web-next/mcp-server.js` updated to read `response.data` for roster and activity changes (breaking change consumer fix).

- Header overhaul: two-row, full-width with centered clan name; controls right-aligned and compact.
- Tabs visually “glued” to header via gradient seam; still render below.
- Clan logo support: detects `/clans/<safeTag>.*` and common root paths, with fallback to `/clan-logo.png`.
- Shared gradient variable `--header-gradient` and utility `.bg-header-gradient`.
- Data Source toggle (Live/Snapshot) added to header.
- Toast notifications: `lib/toast.ts` + `components/layout/ToastHub.tsx`.
- Build/type fixes: td `title` support, client directives, store rehydrate typing.
- Version display wired to `NEXT_PUBLIC_APP_VERSION`; scripts inject version and add `release:*` helpers.
- Consider introducing a Settings gear entry point to consolidate defaults, permission controls, and other configuration toggles.

See full details in CHANGELOG.md.

## Version 0.8.5 - Released ✅
- [x] **Critical Bug Fixes Complete**
  - Fixed auto-loading issue: API calls now include # prefix for compatibility
  - Resolved excessive re-rendering: Removed console.logs from render function
  - Updated version footer to show current app version
  - Dashboard now auto-loads clan data on startup
  - Component renders efficiently without performance issues
  - All critical bugs resolved, dashboard is stable and humming

## Version 0.8.4 - Released ✅
- [x] **Mobile Responsiveness Implementation**
  - Made navigation tabs fully responsive with mobile-friendly layout
  - Created dual layout system: card-based for mobile, table for desktop
  - Optimized control sections for mobile screens with responsive grids
  - Enhanced all modals for mobile compatibility
  - Added responsive breakpoints and touch-friendly interactions
  - Maintained desktop experience while adding beautiful mobile interface

## Version 0.8.3 - Released ✅
- [x] **Enhanced Navigation & UI Improvements**
  - Made navigation tabs more prominent with enhanced styling (larger size, color-coded gradients, shadows, scale effects)
  - Improved visual hierarchy and user experience across the dashboard
- [x] **Player Name Resolution System**
  - Added automatic resolution of "Unknown Player" names in Player Database
  - Integrated player name resolution into nightly cron job
  - Created new API endpoint `/api/player-resolver` for serving resolved player names
  - Player Database now automatically updates unknown player names on load
- [x] **Manual Activity Override Aging System**
  - Manual activity overrides now age over time (e.g., "Today" becomes "1-2 days" after 1 day)
  - Implemented timestamp-based aging with progressive activity status updates
  - Maintains backward compatibility with existing string-based overrides
  - Removed redundant "Manual" badges for cleaner UI
- [x] **Development Guidelines**
  - Added critical JSX structure safety guidelines to prevent site breakage
  - Emphasized careful code review practices for component structure

## Version 0.8.2 - Released ✅
- [x] **Bell Icon & Departure Manager Improvements**
  - Fixed "Done" button visibility in player change popup
  - Added visual feedback for processed departures (green background for processed, red for pending)
  - Made "Done" button permanently visible for better UX
  - Optimized loading speed with cached notifications and background refresh
  - Added persistent dismissal using localStorage to prevent notifications from reappearing after refresh
  - Added manual refresh button for departure notifications
  - Reduced unnecessary API calls while maintaining data freshness

- [x] **Enhanced Hover Effects & Visual Feedback**
  - Added consistent hover effects across the application (scale, shadow, transitions)
  - Improved table row hover effects with subtle scaling and shadow
  - Enhanced button hover effects with scaling animations
  - Fixed hero stat hover effects (removed "goofy question mark" cursor, added visual changes)
  - Made tooltips appear immediately without browser delay using CSS overrides

- [x] **UI/UX Improvements**
  - Fixed table header alignment for Hero columns, Rush %, and Trophies
  - Improved Co-Leader role styling with purple gradient and proper text formatting
  - Added persistent cleared game chat messages using localStorage
  - Enhanced role display with consistent colors and icons (Leader: 👑 gold, Co-Leader: 💎 purple, Elder: ⭐ blue)

- [x] **Performance Optimizations**
  - Implemented notification caching to reduce API calls
  - Added optimistic UI updates for better perceived performance
  - Optimized departure manager loading with instant display of cached data
  - Maintained data isolation between different clans

## Version 0.8.0 Ideas
- [ ] **Mobile Responsive Design**
  - Improve mobile layout for player evaluation modal
  - Add touch-friendly controls for roster management
  - Optimize table scrolling on small screens

- [ ] **Advanced Analytics Dashboard**
  - Clan health score calculation
  - Member activity trends over time
  - Donation ratio analysis
  - War performance tracking
  - Trophy trend graphs in player panel (line graph showing trophy progression over time)
  - **Copyable game chat messages** for key achievements (huge trophy pushes, maxed heroes, TH upgrades, etc.) - ✅ COMPLETED

- [ ] **Automated Alerts System**
  - Notify when members go inactive
  - Alert on significant stat changes
  - Remind about evaluation deadlines

## Version 0.9.0 Ideas
- [ ] **AI-Powered Features**
  - Automated player summaries
  - Recruitment recommendations
  - Clan composition optimization suggestions

- [ ] **Export/Import Functionality**
  - Export roster data to CSV/Excel
  - Import player notes from external sources
  - Backup/restore functionality

- [ ] **Multi-Clan Support**
  - Manage multiple clans from one dashboard
  - Compare clan performance
  - Cross-clan member tracking

## Version 1.0.0 Ideas
- [ ] **Database Integration**
  - Replace local storage with proper database
  - User authentication system
  - Multi-user support with roles

- [ ] **API Enhancements**
  - Webhook support for real-time updates
  - Third-party integrations
  - Custom API endpoints

## Future Considerations
- [ ] **War Management Integration**
- [ ] **Discord Bot Integration**
- [ ] **Advanced Reporting**
- [ ] **Performance Optimization**
- [ ] **Internationalization Support**

## Bug Fixes & Improvements
- [ ] Fix any remaining hero data inconsistencies
- [ ] Improve error handling for API failures
- [ ] Add loading states for better UX
- [ ] Optimize bundle size
- [ ] **CRITICAL: Fix change detection system** - Not detecting member departures (e.g., "Gambit" left but system said "no changes")
- [ ] **CRITICAL: Fix dashboard auto-loading** - Dashboard should auto-load latest snapshot data on startup but currently shows empty

### 2025-09-14 Updates
- [x] Hardened change detection: normalize tags to uppercase when diffing snapshots to ensure joins/leaves are correctly detected regardless of case drift.
- [x] Snapshot-first loading: `loadRoster()` now attempts `mode=snapshot&date=latest` by default and falls back to live if no snapshot exists. Status messages indicate the data source.
- [x] Centralized tag handling: Added `lib/tags.ts` and refactored API/routes/libs to use shared helpers (normalize, validate, filenames).
- [x] Extracted rate limiter: Shared `lib/rate-limiter.ts` imported by APIs for consistent pacing.
- [x] Data-source policy: `lib/data-source-policy.ts` decides snapshot/live fetch order; store uses it for clarity.
- [x] Added focused unit tests: tags utils and mixed-case snapshot change detection.
- [x] Clean tab nav: hide leadership-only tabs for non-leaders; renamed "AI Coaching" to "Coaching".

### Structural Improvements (Modularity/SOLID)
- **Tag utilities**: Centralize clan/player tag normalization (uppercasing, prefix handling) in a small util to avoid divergent logic across API, store, and detectors.
- **Data source policy**: Encapsulated snapshot-vs-live selection and fallback in a dedicated module used by the store.
- **Rate limiter boundary**: Extracted a reusable limiter. Next, consider standardizing around limiter-only and removing ad-hoc `mapLimit` where it duplicates pacing logic.
- **Typed domain models**: Share `Member`/`Roster` types across API/Store/Components to prevent optional/nullable drift and ease future analytics features.
- **Observability hooks**: Add minimal debug logs and timings behind `ENABLE_DEBUG_LOGGING` to trace cache hits, limiter waits, and data source decisions.

## Technical Debt
- [ ] Refactor rate limiting to use Redis
- [ ] Implement proper logging system
- [ ] Add comprehensive error monitoring
- [ ] Write unit tests for core functions

## Advanced Clan Management Roadmap

### Next-Level Clan Leader Dashboard - Strategic Vision

This comprehensive roadmap outlines advanced metrics and features that could transform the clan management dashboard into a strategic command center. These ideas go beyond basic stats to provide actionable insights for clan leadership.

#### War Performance: New Efficiency Metrics

**Attack Efficiency Index**
- Average stars earned per attack (total war stars / total attacks)
- Track improvement over time to measure strategy effectiveness
- Example: 55 stars from 28 attacks = ~1.96 stars per attack

**Contribution Consistency Score**
- Measure steadiness of each player's war performance
- Standard deviation of stars per war or streak counting
- Identify clutch players vs. streaky performers for better war assignments

**Stars per Town Hall Difference**
- Track performance when hitting up or down in war
- Calculate averages by TH differential (e.g., +1 TH = 1.4⭐, -1 TH = 2.9⭐)
- Identify over-performers who excel against higher-level bases

**Cleanup Efficiency**
- Percentage of remaining stars secured on second attempts
- Measure teamwork and planning effectiveness
- Low cleanup rate indicates wasted attacks or poor target selection

**Defensive Hold Rate**
- Track how often each base avoids being 3-starred
- Identify strong base designs to share as defensive MVPs
- Example: "TH13 bases held without being tripled in 3 of 5 wars"

#### Clan Capital: Attack Effectiveness Metrics

**Average Capital Loot per Attack**
- Individual and clan-wide capital gold per attack
- Bar chart visualization to identify top performers
- Encourage strategy sharing between high and low performers

**One-Hit District Clear Rate**
- Percentage of districts destroyed in single attacks
- Breakdown by district type to identify optimization opportunities
- Track improvement as troop levels and strategies evolve

**Attack-to-Destruction Efficiency**
- Average destruction percentage per attack
- Measure coordination and systematic approach
- Track impact of new troop unlocks and strategies

**Player "Carry" Score**
- Quantify individual contribution relative to others
- Combine share of total loot, districts destroyed, and finishing attacks
- Identify heroes and potential burnout risks

**Raid Participation Rate**
- Proportion of eligible capital attacks actually used
- Track engagement and ensure maximum raid rewards
- Flag members who consistently leave attacks unused

#### Player Engagement & Activity Metrics

**Donation Balance & Ratio**
- Donation balance = troops donated - troops received
- Donation ratio (donated:received) for fair assessment
- Track trends over time to spot improving or declining habits

**Attack Participation Rate**
- Combine war and capital participation into single engagement score
- Percentage of attacks used out of total possible
- Identify consistently low participation for intervention

**Builder Base vs. Main Base Activity Skew**
- Ratio of Builder Base trophies to Main Base trophies
- Identify specialists (e.g., Builder Base experts for Capital raids)
- Personalize engagement understanding

**Town Hall Progress Efficiency (Rush Index)**
- Combine experience level, heroes/troops level, and TH level
- Identify rushed vs. efficiently developed bases
- Flag war liabilities and upgrade priorities

**Hero Upgrade Downtime**
- Track hero availability in wars over time
- Encourage smart timing of upgrades or book usage
- Measure dedication to war readiness

#### Trend & Progress Tracking (Longitudinal Metrics)

**War Performance Trends**
- Plot Attack Efficiency and total stars over time
- Individual sparklines showing 3-war rolling averages
- Identify slumps and improvements for proactive intervention

**Donation Trends**
- Monthly donated and received totals per member
- Side-by-side bar charts to spot patterns
- Identify burnout or absence through donation drops

**Clan Capital Progress**
- Track total capital gold looted per season
- Monitor average attacks used per member each weekend
- Identify participation issues and re-engagement needs

**Membership and Town Hall Evolution**
- Timeline of clan composition changes
- Stacked area chart of TH level distribution over time
- Track new joins and departures for stability insights

**Performance vs. Opposition Level**
- Stars earned relative to enemy clan strength in CWL
- Track progress against tougher competition over seasons
- Identify if clan is closing gaps or plateauing

**Individual Improvement Highlights**
- Automatic flagging of notable personal trends
- Celebrate progress and call attention to concerns
- Use trend data for recognition and intervention

#### Roster Composition & Recruitment Metrics

**Town Hall Spread & "Weight" Gaps**
- Calculate weight gap between top and bottom war bases
- Identify optimal TH band for war matching
- Flag significant holes in roster (e.g., no TH15s)

**Role Coverage (Offense/Defense)**
- Analyze if clan has enough of each "role"
- Check for optimal TH15 slots filled
- Identify defensive gaps and diversification needs

**Sandbagger/Efficiency Alerts**
- Flag overpowered members (sandbaggers) affecting war weight
- Identify underpowered members (rushed) for war planning
- Help prioritize donations and coaching

**Overall Contribution Score**
- Composite metric rolling up war, donations, and capital contributions
- Point system: +3 per war attack, +2 per war star, +1 per 1k donation net, etc.
- Create "Clan MVP index" leaderboard for motivation

**Recruitment Priorities**
- Generate actionable insights for leaders
- Example: "Low on TH14/15 - recruit 2 high-level players before next CWL"
- Turn raw metrics into strategic to-dos

### Implementation Priority Recommendations

**Phase 1: Foundation Metrics (Immediate)**
1. Attack Efficiency Index
2. Donation Balance & Ratio
3. Basic participation tracking
4. Town Hall distribution analysis

**Phase 2: Advanced War Analytics (Short-term)**
1. Contribution Consistency Score
2. Cleanup Efficiency
3. Defensive Hold Rate
4. War performance trends

**Phase 3: Capital & Engagement (Medium-term)**
1. Capital loot per attack
2. One-hit district clear rate
3. Builder Base vs Main Base skew
4. Hero upgrade downtime tracking

**Phase 4: Strategic Insights (Long-term)**
1. Overall Contribution Score
2. Recruitment priority recommendations
3. Advanced trend analysis
4. Performance vs opposition level

**Phase 5: Advanced Features (Future)**
1. AI-powered insights
2. Automated alerts
3. Cross-clan comparisons
4. Predictive analytics

This roadmap transforms the dashboard from a stats page into a strategic command center, enabling data-driven clan management and proactive leadership decisions.

## 🚀 **REVOLUTIONARY ANALYTICS VISION (NEW)**

### **🧬 Player DNA Fingerprinting System**
**Concept**: Each member gets a unique "DNA profile" across six dimensions with radar visualization
- **Balanced Titans**: Perfect leadership + performance + generosity combo (like DoubleD)
- **Alpha Donors**: Leaders who give massive donations (like warfroggy with 293 donations)
- **Paradox Players**: Take all donations but deliver highest capital performance (like Zouboul)
- **Silent Warriors**: Elite performance with zero social engagement (like War.Frog)
- **Innovation**: First-ever multi-dimensional player classification predicting behavior patterns

### **🎯 Clan Momentum Matrix**
**Concept**: Revolutionary quadrant analysis revealing clan's performance DNA across zones
- **Domination Zone**: High stars + high destruction (where you want to be)
- **Grinding Zone**: High destruction but lower stars (current position - good offense, needs strategy)
- **Performance Pattern**: Tie-heavy recent record indicates perfectly matched opponents
- **Innovation**: Real-time war momentum tracking with predictive win probability

### **🌐 Social Ecosystem Flow Network**
**Concept**: Most enlightening discovery - perfect donation economy analysis
- 4 players give ALL 643 donations
- 1 player receives ALL 643 donations
- Mathematical perfect balance reveals hidden social contract
- 15 players are donation-neutral (massive untapped resource)
- **Innovation**: First-ever social fairness quantification with relationship strength mapping

### **🏰 Capital Raid Efficiency Matrix**
**Concept**: Heatmap revealing performance paradoxes
- **Zouboul**: Lowest social contributor but HIGHEST capital performer (30K loot)
- **CosmicThomas**: Highest attack efficiency (2.17 stars/attack)
- Only 35% of clan participates in capital raids (huge opportunity)
- **Innovation**: Multi-dimensional efficiency scoring revealing hidden talents

### **🎮 Game-Changing Dashboard Widgets**
1. **Clan Chemistry Heat Map**: Real-time social network showing donation flows, attack collaborations, chat interactions
2. **Member Archetype AI Classifier**: Automatically categorizes players as Titans, Grinders, Socials, Specialists, Potentials
3. **Momentum Flow Dashboard**: Live performance trends with predictive algorithms
4. **Resource Flow Ecosystem**: Donation network visualization with fairness scores
5. **Capital Raid ROI Matrix**: Economic analysis showing cost-benefit of each attack

### **🔮 Predictive Intelligence Features**
- **Player Burnout Prediction**: Tracks engagement velocity changes to prevent member loss
- **War Outcome Forecasting**: Based on lineup composition + current momentum
- **Recruitment Fit Analysis**: Recommends ideal new member profiles
- **Clan Health Score**: Overall ecosystem stability metrics with early warning alerts

### **💡 Revolutionary Insights Integration**
- **Hidden Clan Economy**: 4 top donors create sustainable ecosystem supporting 16 other members
- **Performance Paradox**: Highest capital performer is also biggest social taker (strategic specialization works)
- **Momentum Pattern**: Tie-heavy wars indicate perfect matchmaking but untapped potential
- **Growth Opportunity**: Zero TH15 players and 65% non-capital participation represent massive competitive advantages

**Implementation Priority**: These revolutionary concepts could be implemented as **Phase 2** after Leadership Team Access Control, transforming the dashboard from reactive clan management to **predictive intelligence platform**.

## Future Vision & Wish List

### 1. Multi-Tenant SaaS Version
**Goal**: Offer the dashboard to other clan leaders as a service
- **Setup Wizard**: New users enter their own API keys and configuration
- **Isolated Instances**: Each clan gets their own data environment
- **Custom Branding**: Allow customization of colors, logos, clan-specific settings
- **Subscription Model**: Tiered pricing based on features and clan size
- **Technical Considerations**:
  - Database per tenant or shared with tenant isolation
  - API key management and rotation
  - Rate limiting per tenant
  - Data backup and recovery per tenant
  - User authentication and authorization

### 2. Leadership Team Shared Version
**Goal**: Allow co-leaders to collaborate on clan management
- **Read-Only Access**: Co-leaders can view data but not modify core settings
- **Shared Notes System**: 
  - Notes are collaborative with author attribution
  - Real-time updates when data refreshes
  - Note history and version tracking
  - Author tags (e.g., "Note by Tigress #ABC123")
- **Role-Based Permissions**:
  - Leaders: Full access
  - Co-Leaders: View + Notes + Limited settings
  - Elders: View + Notes only
- **Technical Implementation**:
  - User authentication (simple password or invite codes)
  - Real-time data sync when you refresh
  - Collaborative note editing
  - Activity logging for accountability

### 3. Implementation Phases
**Phase 1**: Leadership Team Version (Priority: HIGH)
- **Access Control System**:
  - Invite code authentication (e.g., "TIGRESS-2024", "WARFROG-2024")
  - Simple config-based leader management
  - Instant access revocation (set `active: false`)
  - No IP restrictions needed
- **Collaborative Features**:
  - Shared player notes with author attribution
  - Real-time updates when you refresh data
  - Note history and version tracking
  - Author tags (e.g., "Note by Tigress #ABC123")
- **Role-Based Permissions**:
  - Leaders: Full access + access management
  - Co-Leaders: View + Notes + Limited settings
  - Elders: View + Notes only
- **Technical Implementation**:
  - Use existing Vercel free tier
  - Supabase free tier for notes storage
  - Simple environment variable config
  - Minimal additional cost (~$0/month)

**Phase 2**: Multi-Tenant Foundation
- Design tenant isolation architecture
- Create setup wizard for new instances
- Implement API key management
- Build subscription and billing system

**Phase 3**: Full SaaS Platform
- Multi-tenant database design
- Custom branding and theming
- Advanced analytics and reporting
- Mobile app integration

## Development Guidelines
- **CRITICAL: JSX Structure Safety** - When working on JSX structure, be extra careful and think, re-think code so that syntax doesn't break the site. Always verify function braces, component structure, and return statements are properly nested before testing.

- **CRITICAL: TypeScript Compatibility** - NEVER make incompatible changes between environments. Always ensure TypeScript code compiles correctly before committing. Test builds locally before pushing to prevent Vercel deployment failures. All variables must be properly defined and typed.

## 🚀 Deployment Workflow (NEW - v0.16.1)

### Multi-Environment Setup
- **Development**: Local development with test data
- **Staging**: Vercel preview deployments for testing
- **Production**: Live application with real data

### Safe Development Process
1. **Never develop directly in production** - Use staging environment
2. **Feature branches** - Create branches for new features
3. **Staging testing** - Always test in staging before production
4. **Environment variables** - Separate configs for each environment

### Quick Commands
```bash
# Local development
npm run dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod

# Check environment
npm run env:check
```

### Environment Configuration
- Copy `env.example` to `.env.local` for local development
- Configure Vercel environment variables for staging/production
- Use different API keys and database instances for each environment

See `DEPLOYMENT.md` for complete deployment guide.
### Applicant Evaluation (new feature)
- Endpoint: `GET /api/applicants/evaluate?tag=#PLAYER_TAG&clanTag=#CLAN_TAG`
  - Returns `{ success, data: { applicant, evaluation }, requestId }` where `evaluation = { score (0-100), recommendation ('Excellent'|'Good'|'Fair'|'Poor'), breakdown: [{ category, points, maxPoints, details }] }`.
  - Input validation via Zod; inbound rate limited; uses `requestId` helper.
  - Clan context is optional; when provided, uses latest snapshot (if available) to compute “Clan Fit” vs average TH; otherwise treated neutral.
- UI: Applicant tab now includes an evaluation panel
  - Component: `src/components/ApplicantsPanel.tsx`
  - Enter player tag (and optional clan tag), hit Evaluate; shows score, recommendation, and category breakdown.
  - Consumes the new API and respects standardized `ApiResponse` shape.
  - One-click "Save to Player DB": stores an applicant note in localStorage under `player_notes_<TAG>` and name under `player_name_<TAG>`. View saved applicants in the Player Database tab.
  - Discord copy: "Copy Discord Blurb" creates a short, readable message with score, TH, trophies, hero levels, strengths and a top gap.
  - Applicant status: choose status (shortlisted/consider-later/hired/rejected); saved alongside the note and editable from Player Database modal.
  - Shortlist Builder: Build a ranked shortlist from locally saved candidates (status shortlisted/consider-later), parameterized Top N.
    - API: `POST /api/applicants/shortlist { clanTag?, tags: string[], top? }` returns `{ shortlist: [{ applicant, evaluation }] }`.
    - UI: Button on Applicants tab; copies individual blurbs; uses standardized `ApiResponse` and requestId.
  - Scan External Clan: Type a clan tag, fetch roster, score all, return Top N.
    - API: `GET /api/applicants/scan-clan?sourceClanTag=#&contextClanTag=#&top=20`
    - Filters supported on both shortlist + scan: `minTh`, `maxTh`, `minScore`, `minTrophies`, and `includeRoles` (member, elder, coleader, leader).
    - UI: Filter inputs (TH, score, trophies) and role checkboxes (leaders/co-leaders off by default).
- Scoring logic
  - Location: `src/lib/applicants.ts`
  - Criteria and weights: Town Hall (25), Hero Development (30) vs TH caps, Trophy Count (20), Clan Fit vs avg TH (15), Activity via donations (10).
  - Uses `HERO_MAX_LEVELS` from `src/types`.

## Deployment Strategy (Updated January 2025)

### Preview Deployment Workflow
**Cost**: FREE - No additional charges for preview deployments

**Workflow**:
1. Create feature branch: `git checkout -b feature/your-feature-name`
2. Make changes and commit: `git commit -m "feat: your feature description"`
3. Push branch: `git push origin feature/your-feature-name`
4. **Vercel automatically creates preview URL**: `https://clash-intelligence-[hash]-dougs-projects.vercel.app`
5. Test on preview URL before merging
6. Merge to main: `git checkout main && git merge feature/your-feature-name`
7. Push main: `git push origin main` → Deploys to production
8. Delete feature branch: `git branch -D feature/your-feature-name`

**Benefits**:
- ✅ Zero additional cost
- ✅ Automatic preview URLs for every feature branch
- ✅ Test changes safely before production
- ✅ No manual configuration needed
- ✅ Better than staging (unique URL per feature)

**Production URLs**:
- Main production: `https://clash-intelligence-new.vercel.app`
- Preview deployments: `https://clash-intelligence-[hash]-dougs-projects.vercel.app`

**Environment Variables**: All environments (production, preview) automatically inherit the same environment variables from Vercel project settings.

### Future: Discord-Based Authentication & Auto Access
- Discord bot command `/link <playerTag>` issues a signed one-time URL that ties `discordId` to the clan roster tag; visiting the link sets a session cookie.
- Sessions derive permissions automatically from Supabase roster snapshots (leader/coleader/elder/member) so tabs/access update instantly; leaving the clan revokes access on the next request.
- Keep Access Manager for manual overrides and external viewers; `/unlink` command or roster removal tears down sessions immediately.
