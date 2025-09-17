# Clash Intelligence Dashboard - Planning Notes

## UI/UX Changes (Immediate Priority)

### Tab Visibility & Access Control
- [ ] **Hide non-leader tabs completely** instead of locking them
- [ ] **Hide AI/API-dependent tabs** from everyone except owner
- [ ] **Hide Discord tab** from non-leaders  
- [ ] **Rename "AI Coaching"** → **"Coaching"**

### Layout Improvements
- [ ] **Move tabs below Quick Actions** (instead of above)
- [ ] **Make main panel sticky** on scroll
- [ ] **Remove ratio from donation balance** → move to mouseover
- [ ] **Move attack totals to mouseover** in War Eff column (keep main number only)

### Icon Updates
- [ ] **Activity icon**: Change to 🏁
- [ ] **Performance icon**: Change to 🏆

## Access Control Refinement

### Role-Based Access System
- [ ] **Remove role picker** → roles inherit from login credentials
- [ ] **Player tag in login URL** → automatic revocation when player leaves/booted
- [ ] **New members** → automatic universal public access
- [ ] **API credentials** → future feature for self-service

## Data & Analytics Clarifications Needed

### War Consistency Question
- [ ] **War Consistency %** - clarify if this includes multiplayer battles or only actual wars
- Currently showing percentages with no war data

## Mobile & Responsive Improvements
- [ ] **Improve mobile layout** for player evaluation modal
- [ ] **Add touch-friendly controls** for roster management
- [ ] **Optimize table scrolling** on small screens

## Advanced Analytics Dashboard (Phase 1)
- [ ] **Clan health score calculation**
- [ ] **Member activity trends** over time
- [ ] **Donation ratio analysis**
- [ ] **War performance tracking**
- [ ] **Trophy trend graphs** in player panel (line graph showing trophy progression over time)

## War Performance Analytics (Phase 2)
- [ ] **Attack Efficiency Index** - Average stars earned per attack
- [ ] **Contribution Consistency Score** - Measure steadiness of war performance
- [ ] **Stars per Town Hall Difference** - Track performance when hitting up/down
- [ ] **Cleanup Efficiency** - Percentage of remaining stars secured on second attempts
- [ ] **Defensive Hold Rate** - Track how often bases avoid being 3-starred

## Clan Capital Analytics (Phase 3)
- [ ] **Average Capital Loot per Attack** - Individual and clan-wide metrics
- [ ] **One-Hit District Clear Rate** - Percentage destroyed in single attacks
- [ ] **Attack-to-Destruction Efficiency** - Average destruction per attack
- [ ] **Player "Carry" Score** - Quantify individual contribution
- [ ] **Raid Participation Rate** - Proportion of eligible attacks used

## Player Engagement Metrics
- [ ] **Attack Participation Rate** - Combine war and capital participation
- [ ] **Builder Base vs Main Base Activity Skew** - Ratio analysis
- [ ] **Hero Upgrade Downtime** - Track hero availability in wars
- [ ] **Donation Balance & Ratio** - Track trends over time

## Trend & Progress Tracking
- [ ] **War Performance Trends** - Plot efficiency over time with sparklines
- [ ] **Donation Trends** - Monthly totals per member
- [ ] **Clan Capital Progress** - Track total loot per season
- [ ] **Membership and Town Hall Evolution** - Timeline of clan changes
- [ ] **Performance vs Opposition Level** - Stars relative to enemy strength

## Revolutionary Analytics Vision (Phase 4)
- [ ] **Player DNA Fingerprinting System** - Multi-dimensional player classification
- [ ] **Clan Momentum Matrix** - Quadrant analysis revealing performance DNA
- [ ] **Social Ecosystem Flow Network** - Donation economy analysis
- [ ] **Capital Raid Efficiency Matrix** - Heatmap revealing performance paradoxes
- [ ] **Clan Chemistry Heat Map** - Real-time social network visualization
- [ ] **Member Archetype AI Classifier** - Automatic player categorization
- [ ] **Predictive Intelligence Features** - Burnout prediction, war forecasting

## Automated Systems
- [ ] **Automated Alerts System** - Notify when members go inactive
- [ ] **Alert on significant stat changes** - Automated monitoring
- [ ] **Remind about evaluation deadlines** - Scheduled notifications

## Export/Import Functionality
- [ ] **Export roster data** to CSV/Excel
- [ ] **Export clan summary** - JSON/Markdown format with war status, capital raids, recent performance
- [ ] **Import player notes** from external sources
- [ ] **Backup/restore functionality** - Data management

## Multi-Clan Support
- [ ] **Add clans to track** with nightly cron jobs
- [ ] **Build history** for multiple clans
- [ ] **Compare clan performance** - Cross-clan analytics
- [ ] **Cross-clan member tracking** - Member movement history

## Database & Authentication
- [ ] **Replace local storage** with proper database
- [ ] **User authentication system** - Secure login
- [ ] **Multi-user support** with roles
- [ ] **Settings feature** for users to enter their own API credentials

## Settings & Configuration
- [ ] **Settings gear wheel** - Centralized configuration panel
- [ ] **Home clan management** - Move from home screen to settings
- [ ] **Clan logo editing** - Upload and manage clan logo/avatar
- [ ] **User preferences** - Theme, notifications, display options

## API Enhancements
- [ ] **Webhook support** for real-time updates
- [ ] **Third-party integrations** - External connections
- [ ] **Custom API endpoints** - Extended functionality

## Leadership Team Features
- [ ] **Shared Notes System** - Collaborative notes with author attribution
- [ ] **Real-time updates** when data refreshes
- [ ] **Note history and version tracking** - Change management
- [ ] **Author tags** (e.g., "Note by Tigress #ABC123")
- [ ] **Role-Based Permissions** - Granular access control
- [ ] **Invite code authentication** - Simple access management

## Future Vision & Wish List

### Multi-Tenant SaaS Version
- [ ] **Setup Wizard** - New users enter API keys and configuration
- [ ] **Isolated Instances** - Each clan gets own data environment
- [ ] **Custom Branding** - Allow customization of colors, logos
- [ ] **Subscription Model** - Tiered pricing based on features

### Technical Debt & Infrastructure
- [ ] **Refactor rate limiting** to use Redis
- [ ] **Implement proper logging system**
- [ ] **Add comprehensive error monitoring**
- [ ] **Write unit tests** for core functions
- [ ] **Optimize bundle size**
- [ ] **Add loading states** for better UX

## Bug Fixes & Critical Issues
- [ ] **Fix any remaining hero data inconsistencies**
- [ ] **Improve error handling** for API failures
- [ ] **Fix change detection system** - Not detecting member departures
- [ ] **Fix dashboard auto-loading** - Should auto-load latest snapshot on startup

---

## Smart Insights Consolidation (Work In Progress)

### Current “AI” Feature Inventory
- **Coaching advice** (`AICoaching` panel, `/api/ai-coaching/generate`, `ai-processor.generateCoachingAdvice`) – personalized tips + ready-to-paste chat.
- **Change summaries** (`ChangeDashboard`, quick actions “Generate Summary”, `/api/ai-summary/generate`, `ai-summarizer.generateChangeSummary`) – narrative digest of roster deltas.
- **Snapshot headlines** (`QuickActions` snapshot copy, `ai-storage.generateSnapshotSummary`) – text summary injected into clipboard/export flows.
- **Player DNA insights** (`PlayerDNADashboard`, `/api/ai/dna-cache`, `ai-processor.generatePlayerDNAInsights`) – “archetype” cards for members.
- **Clan DNA overview** (`PlayerDNADashboard` overview, `ai-processor.generateClanDNAInsights`) – health/weakness callouts.
- **Game chat blurbs** (`FullSnapshotDashboard`, `ai-processor.generateGameChatMessages`) – optional templated shout-outs.
- **Nightly batch pipeline** (`cron/daily-snapshot`, `ai-processor.processBatchAI`, Supabase `batch_ai_results`) – orchestrates all of the above and caches outputs.
- **Force-refresh flow** (`/api/admin/force-refresh`, Settings modal) – on-demand snapshot & insights run.

### Pain Points
- Multiple prompts/pipelines create inconsistent tone and brittle parsing.
- UI labels scream “AI”, scattered across tabs so failures feel pervasive.
- Insights buried in separate panels instead of a single “What matters now” feed.
- Storage duplication (Supabase + localStorage + ad hoc copies) complicates refresh/fallback logic.

### Consolidation Direction
1. **Rename + Reframe**
   - Replace “AI Coaching”, “AI Summary”, etc. with “Smart Insights”, “Coaching”, “Daily Headlines”.
   - Audit copy for “AI” references and switch to value-focused language (“Automatic insights”, “Daily highlights”).

2. **Single Insights Service**
   - Promote `ai-processor` to `smart-insights-service` with one orchestrator that produces a typed payload:
     ```ts
     interface SmartInsightsPayload {
       headlines: Headline[];        // surfaced on dashboard
       coaching: Recommendation[];   // actionable items
       playerSpotlights: Spotlight[];// optional individual cards
       diagnostics: InsightMeta;     // timestamps, health flags
     }
     ```
   - Internally reuse shared prompt builders for snapshot context + roster stats.
   - Persist a single JSON blob per snapshot (Supabase + local cache) instead of per-feature arrays.

3. **Dashboard Integration**
   - Add “Today’s Headlines” section to the main dashboard header/body fed by `payload.headlines`.
   - Feature limited actionable cards (top 3 coaching tips) with “View more insights” link.
   - Move detailed player DNA + clan archetype views under expandable “Deep Dive” modal fed from same payload.

4. **Resilient Fallbacks**
   - Centralize error handling in service; when generation fails, serve last known payload + “Stale insight” badge.
   - Continue nightly cron, but allow manual refresh to only regenerate missing pieces.

### Immediate Tasks (Suggested Order)
1. **Terminology sweep** – search/replace UI copy to drop “AI” branding; update navigation labels, button text, toasts.
2. **Define `SmartInsightsPayload`** – schema + type in `lib/smart-insights.ts`; adapt batch runner to emit it while still backfilling current consumers.
3. **Build dashboard headlines section** – surface top 3 highlights in `ClientDashboard` with fallback messaging when payload stale.
4. **Adapter layer** – shim existing components (coaching panel, DNA dashboard) to read from unified payload before full refactor.
5. **Deprecate legacy endpoints** – once adapters migrated, collapse `/api/ai-*` routes into `/api/insights/*`.

### Open Questions
- Do we keep player DNA calculations if no OpenAI key is present (pure heuristics vs. removal)?
- Should coaching/chat messages remain shareable to Discord, and if so, what’s the preferred format post-consolidation?
- How fresh do “Headlines” need to be (live refresh vs. nightly snapshot)?

## Access Management
- [ ] **Role inheritance** from login (remove picker for production)
- [ ] **Player tag-based login URLs** for automatic access management

---

## Implementation Notes

- **Role picker removal**: Currently implemented for testing ease - needs production version
- **Tab hiding**: More elegant than locking - cleaner UX
- **Sticky header**: Improve navigation experience
- **Mouseover details**: Reduce visual clutter while maintaining functionality

## Priority Order
1. UI/UX immediate changes (tabs, icons, layout)
2. Access control refinements
3. Data clarification
4. Future feature planning
