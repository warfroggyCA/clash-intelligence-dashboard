# Clash Intelligence Dashboard - Planning Notes

## Execution Status
- [x] Sprint 0 – Data spine schema in Supabase (clans, members, snapshots, wars, raids, metrics, alerts, tasks, notes, roles, settings, ingest logs)
- [ ] Sprint 1 – Roster pipeline
  - [x] `/api/v2/roster` backed by Supabase snapshots
  - [x] Ingestion persistence into `roster_snapshots` + `member_snapshot_stats`
  - [ ] Nightly job / automation to run ingestion
  - [x] Dashboard store hydration from new endpoint
- [ ] Sprint 2 – Auth & role gating via Supabase
- [ ] Sprint 3 – Historical metrics + trend surfaces
- [ ] Sprint 4 – Command center UX & automation

## UI/UX Changes (Immediate Priority)

### Tab Visibility & Access Control
- [ ] **Hide non-leader tabs completely** instead of locking them
- [ ] **Hide AI/API-dependent tabs** from everyone except owner
- [ ] **Hide Discord tab** from non-leaders  
- [ ] **Rename "AI Coaching"** → **"Coaching"**
- [ ] **Upgrade Smart Insights quality** – rework AI summaries for deeper, high-value analysis

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

## Player Engagement Metrics201
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

## Phase 1 – Dashboard Cleanup (In Progress)

- [ ] **Command Rail**
  - [ ] Finalize trimmed scope: snapshot freshness, quick refresh, links into Insights/History
  - [ ] Confirm the command rail only reads from: `selectors.snapshotMetadata`, `selectors.dataAge`, `lastLoadInfo`, and `smartInsights` selectors
  - [ ] Provide navigation actions that call `setActiveTab` instead of duplicating content (Insights → `coaching`, History → `changes`)
  - [ ] Move departure alerts, change summary previews, and exports into their new homes (Roster/Insights tabs)
  - [ ] Write regression checklist (render counts stay low, no Zustand warning logs) before/after refactor

- [ ] **Roster Tab Consolidation**
  - [ ] Move `RosterStatsPanel` and `RosterHighlightsPanel` content into the roster tab
  - [ ] Ensure leadership-only actions remain accessible (modals, quick departures)
  - [ ] Surface snapshot metadata (last load info) in the roster header

- [ ] **Insights Tab**
  - [ ] Create a unified “Insights” tab combining Smart Insights headlines, change summaries, and action items
  - [ ] Reuse `selectors.smartInsights*`, `historyByClan`, and `lastLoadInfo` for data
  - [ ] Provide clear empty/error states so the tab degrades gracefully when data is missing

- [ ] **Tab Visibility**
  - [ ] Hide placeholder tabs (Events, Applicants, Intelligence) unless data is production-ready
  - [ ] Enforce role-based visibility per planning so leadership tools only show for leaders
  - [ ] Update `getVisibleTabs` and `TabNavigation` to reflect the new rules

- [ ] **Store & Selector Audit**
  - [ ] Document which selectors feed each tab after the refactor
  - [ ] Ensure shared selectors return stable references to prevent unnecessary renders
  - [ ] Outline additional store fields required for upcoming analytics phases (war trends, capital, engagement)

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

## Strategic Dashboard Vision: The Indispensable War Room

### Core Mission: Transform Data into Actionable Intelligence
The dashboard must evolve beyond data display into a command center that provides insights the native Clash of Clans experience never will. This strategic vision encompasses five critical intelligence domains:

### 1. War Performance Intelligence Engine
**Goal**: Turn war performance into actionable intelligence that reveals strategy failures
- [ ] **Attack Efficiency Tracking** - Stars per attack with context (TH difference, base strength)
- [ ] **Contribution Consistency Scoring** - Measure steadiness vs. one-hit wonders
- [ ] **Stars-per-Differential Analysis** - Performance when hitting up vs. down
- [ ] **Cleanup Efficiency Metrics** - Second-attempt success rates
- [ ] **Defensive Hold Rate** - Base design effectiveness tracking
- [ ] **Strategy Failure Detection** - AI-powered insights on where war strategy breaks down
- [ ] **Target Selection Optimization** - Data-driven recommendations for attack assignments

### 2. Capital Raid Economy Mastery
**Goal**: Own the capital-raid economy with precision metrics
- [ ] **Capital Loot per Attack** - Individual and clan-wide efficiency
- [ ] **One-Hit District Clear Rates** - Destruction efficiency tracking
- [ ] **Carry Score Quantification** - Individual contribution measurement
- [ ] **Raid Participation Analytics** - Attack utilization vs. eligibility
- [ ] **District Performance Heatmaps** - Visual identification of weak spots
- [ ] **Weekend Reward Optimization** - Predictive modeling for maximum returns
- [ ] **Capital ROI Matrices** - Investment vs. return analysis

### 3. Engagement & Readiness Quantification
**Goal**: Flag burnout risks and underdeveloped bases before they become liabilities
- [ ] **Donation Balance/Ratio Trends** - Long-term engagement patterns
- [ ] **Combined Attack Participation** - War + Capital activity synthesis
- [ ] **Builder vs. Main Base Activity** - Development balance analysis
- [ ] **Town Hall Progress Efficiency** - Rush detection and optimization
- [ ] **Hero Downtime Tracking** - War readiness assessment
- [ ] **Burnout Risk Prediction** - Early warning system for inactive members
- [ ] **Base Development Scoring** - War readiness assessment

### 4. Momentum & Trend Intelligence
**Goal**: Show momentum, not just snapshots - prove improvement or regression
- [ ] **Rolling War Performance Trends** - 30/60/90 day performance windows
- [ ] **Donation Trend Analysis** - Seasonal patterns and anomalies
- [ ] **Capital Progress Tracking** - Long-term raid performance evolution
- [ ] **Membership Evolution Analytics** - Clan composition changes over time
- [ ] **Opponent Strength Comparisons** - Performance vs. relative competition
- [ ] **Clan Momentum Quadrants** - Visual positioning of improvement/decline
- [ ] **Predictive Performance Modeling** - Future outcome forecasting

### 5. Recruitment Crystal Ball
**Goal**: Perfect recruitment decisions with data-driven insights
- [ ] **Town Hall Spread Analysis** - Optimal clan composition modeling
- [ ] **Role Coverage Assessment** - Leadership gap identification
- [ ] **Sandbagger/Rush Alert System** - Quality control for new members
- [ ] **Composite Contribution Scoring** - Multi-dimensional member evaluation
- [ ] **AI-Assisted Applicant Scoring** - Automated candidate assessment
- [ ] **Recruitment ROI Analysis** - Success rate of different recruitment strategies
- [ ] **Cultural Fit Prediction** - Social dynamics and clan chemistry analysis

### 6. Signature Smart Insights Engine
**Goal**: Deliver "What matters now" intelligence that stays resilient to failures
- [ ] **Curated Daily Briefing** - AI-powered "What matters now" feed
- [ ] **Resilient Intelligence Architecture** - Fallback systems for AI failures
- [ ] **Living Briefing System** - Real-time updates, not static reports
- [ ] **Priority-Based Insight Ranking** - Most critical information first
- [ ] **Context-Aware Recommendations** - Insights tailored to current clan state
- [ ] **Automated Alert Triggers** - Proactive notification system
- [ ] **Insight Confidence Scoring** - Reliability indicators for recommendations

### 7. Revolutionary Perspective Unlocking
**Goal**: Reveal hidden economies, archetypes, and future outcomes competitors can't see
- [ ] **Player DNA Radar Profiles** - Multi-dimensional player classification
- [ ] **Clan Momentum Quadrants** - Performance DNA analysis
- [ ] **Social Ecosystem Flow Maps** - Donation economy visualization
- [ ] **Capital ROI Matrices** - Investment vs. return heatmaps
- [ ] **Predictive Outcome Widgets** - Future scenario modeling
- [ ] **Hidden Economy Detection** - Uncover non-obvious performance patterns
- [ ] **Competitive Advantage Analytics** - What makes this clan unique

### 8. Leadership Alignment & Proactivity System
**Goal**: Keep leaders aligned and proactive with instant reaction capabilities
- [ ] **Automated Alert System** - Instant notifications for critical changes
- [ ] **Collaborative Notes with Authorship** - Shared intelligence gathering
- [ ] **Invite-Based Access Control** - Secure, role-based information sharing
- [ ] **Real-Time Collaboration Tools** - Leadership team coordination
- [ ] **Action Item Tracking** - Follow-through on coaching assignments
- [ ] **Decision Audit Trail** - Track leadership decisions and outcomes
- [ ] **Performance Accountability Metrics** - Leadership effectiveness measurement

### The Ultimate Deliverable: Command Center Integration
**Result**: Bundle all intelligence domains into a single curated daily briefing that delivers:
- **Why the clan is winning or struggling** - Root cause analysis
- **Who deserves recognition or support** - Performance-based insights
- **What to do next** - Actionable recommendations
- **Competitive advantage visibility** - Insights competitors can't see
- **Proactive leadership tools** - Stay ahead of problems

This transforms the dashboard from a data viewer into an indispensable command center that every serious clan leader must use.

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

## Strategic Implementation Priority

### Phase 1: Foundation (Current - Q1 2025)
1. **UI/UX immediate changes** (tabs, icons, layout)
2. **Access control refinements** (role inheritance, security)
3. **Data clarification** (war consistency, metrics validation)
4. **Smart Insights consolidation** (unified intelligence service)

### Phase 2: Core Intelligence (Q2 2025)
1. **War Performance Intelligence Engine** - Attack efficiency, consistency scoring
2. **Engagement & Readiness Quantification** - Burnout prediction, readiness assessment
3. **Momentum & Trend Intelligence** - Rolling performance analysis
4. **Enhanced Smart Insights** - Curated daily briefing system

### Phase 3: Advanced Analytics (Q3 2025)
1. **Capital Raid Economy Mastery** - Comprehensive capital analytics
2. **Recruitment Crystal Ball** - AI-assisted applicant scoring
3. **Revolutionary Perspective Unlocking** - Player DNA, clan momentum analysis
4. **Leadership Alignment System** - Collaborative tools, automated alerts

### Phase 4: Command Center Integration (Q4 2025)
1. **Unified Intelligence Dashboard** - Single curated briefing
2. **Predictive Analytics** - Future outcome modeling
3. **Competitive Advantage Tools** - Hidden economy detection
4. **Multi-Tenant SaaS Platform** - Scalable infrastructure

### Success Metrics
- **Adoption**: Dashboard becomes "must-open tab" for clan leaders
- **Actionability**: Insights lead to measurable clan performance improvements
- **Competitive Edge**: Features unavailable in native Clash of Clans experience
- **Retention**: Daily usage patterns indicating indispensable tool status

## Monetization & Productionization Strategy

### Premium Intelligence Tiers

#### Free Tier
- [ ] **Limited war/capital dashboards** - Basic metrics and historical data
- [ ] **Delayed Smart Insights** - 24-48 hour processing delays
- [ ] **Basic export capabilities** - Limited CSV downloads
- [ ] **Community features** - Access to public insights and tips

#### Pro Tier ($19-29/month per clan)
- [ ] **Real-time "What matters now" briefings** - Instant intelligence updates
- [ ] **Trend alerts and notifications** - Proactive clan management
- [ ] **Player DNA profiles** - Advanced member analytics and archetypes
- [ ] **Recruiting AI assistance** - Automated candidate evaluation
- [ ] **Full CSV/Excel export** - Complete data portability
- [ ] **Slack/Discord notifications** - Integration with communication tools
- [ ] **Priority support** - Faster response times for issues

#### Elite Clan Tier ($99-199/month per clan)
- [ ] **Multi-clan portfolio management** - Manage multiple clans from one dashboard
- [ ] **Comparative benchmarking** - Cross-clan performance analysis
- [ ] **White-label branding** - Custom logos and color schemes
- [ ] **Custom Smart Insight models** - Tailored AI recommendations
- [ ] **Advanced analytics** - Predictive modeling and forecasting
- [ ] **API access** - Programmatic data access
- [ ] **Dedicated success manager** - Personal onboarding and support

#### Add-on Services
- [ ] **Coach/Analyst seats** - Additional user licenses for team members
- [ ] **Season passes** - Discounted annual subscriptions
- [ ] **Custom integrations** - Specialized API connections

### Data-as-a-Service & API

#### Core API Endpoints
- [ ] **War history API** - Complete war performance data
- [ ] **Capital ROI metrics** - Raid efficiency and optimization data
- [ ] **Player DNA metrics** - Member analytics and archetype data
- [ ] **Clan momentum tracking** - Performance trend analysis
- [ ] **Real-time webhooks** - Live data streaming for partners

#### Billing Models
- [ ] **Usage-based pricing** - Per-request or per-seat billing
- [ ] **Webhook-driven alerts** - Partner app integrations
- [ ] **Tiered API limits** - Different access levels based on subscription

### Marketplace & Affiliate Plays

#### Partner Integrations
- [ ] **Base-building partners** - Curated base design services
- [ ] **Coaching services** - Professional coaching referrals
- [ ] **Gem deals and promotions** - In-game currency partnerships
- [ ] **Revenue sharing** - Commission-based affiliate model

#### API Marketplace
- [ ] **Featured tool placement** - High-value integrations
- [ ] **Developer ecosystem** - Third-party app marketplace
- [ ] **Integration marketplace** - Curated partner tools

### Insights Studio & Reports

#### Custom Reports
- [ ] **Monthly war debriefs** - Comprehensive war analysis
- [ ] **Recruiting dossiers** - Member evaluation reports
- [ ] **Performance reviews** - Individual and clan assessments
- [ ] **Strategic planning documents** - Long-term clan development

#### Premium Services
- [ ] **Concierge onboarding** - Personal setup and training
- [ ] **Quarterly strategy workshops** - Professional consulting
- [ ] **Custom analytics** - Tailored metric development
- [ ] **Priority feature requests** - Influence product roadmap

## Production Readiness Roadmap

### Data Pipeline Infrastructure
- [ ] **Automated Clash API ingestion** - Scheduled data collection
- [ ] **ETL workflows with retries** - Robust data processing
- [ ] **Historical snapshot maintenance** - Long-term data retention
- [ ] **Data quality monitoring** - Automated validation and alerts
- [ ] **Backup and disaster recovery** - Data protection and restoration

### Processing & Analytics
- [ ] **Managed workflow orchestration** - Airflow/Prefect integration
- [ ] **Unit and integration testing** - Comprehensive test coverage
- [ ] **CI/CD pipelines** - Automated deployment and testing
- [ ] **Infrastructure as Code** - Terraform for reproducible deployments
- [ ] **Performance monitoring** - Real-time system health tracking

### Platform & Infrastructure
- [ ] **Scalable cloud deployment** - Vercel/Netlify frontend + AWS/GCP backend
- [ ] **CDN integration** - Global content delivery optimization
- [ ] **Caching strategies** - Redis/Memcached for performance
- [ ] **Application monitoring** - APM, logs, and error tracking
- [ ] **Load balancing** - High availability and scalability

### Security & Compliance
- [ ] **OAuth for clan leader accounts** - Secure authentication
- [ ] **Granular RBAC** - Role-based access control
- [ ] **Encrypted storage** - Data protection at rest and in transit
- [ ] **GDPR-ready data retention** - Privacy compliance policies
- [ ] **Security auditing** - Regular vulnerability assessments

### Operations & Customer Success
- [ ] **Customer success CRM** - Relationship management system
- [ ] **Billing integration** - Stripe payment processing
- [ ] **Feature flagging** - Gradual feature rollouts
- [ ] **In-app feedback loops** - User experience optimization
- [ ] **NPS tracking** - Customer satisfaction measurement
- [ ] **Roadmap telemetry** - Usage analytics for product decisions

### AI Lifecycle Management
- [ ] **Versioned models** - Model tracking and rollback capabilities
- [ ] **Explainability summaries** - Transparent AI decision-making
- [ ] **Feedback-driven retraining** - Continuous model improvement
- [ ] **A/B testing framework** - Model performance comparison
- [ ] **Model monitoring** - Performance drift detection

## Growth Loop Instrumentation

### Viral Mechanics
- [ ] **Shareable spotlight cards** - Social media integration
- [ ] **Weekly email digests** - Automated engagement campaigns
- [ ] **Discord bot integration** - Community engagement tools
- [ ] **Referral programs** - User acquisition incentives
- [ ] **Public leaderboards** - Competitive social features

### Analytics & Optimization
- [ ] **Activation/retention cohorts** - User behavior analysis
- [ ] **Pricing experiments** - Paywall analytics and optimization
- [ ] **Conversion funnel tracking** - User journey optimization
- [ ] **Feature usage analytics** - Product adoption measurement
- [ ] **Churn prediction models** - Proactive retention strategies

## Future Deliverables
- [ ] Onboarding wizard: guided setup for clan tag, CoC API key, optional proxy/OpenAI keys, Supabase linkage, and health check
- [ ] Credential storage improvements: secure Supabase secrets, admin UI to rotate keys
- [ ] Optional AI tier toggle with fallback heuristics

## TypeScript Build Issues & Fixes (Expert Coder Notes)

**Date**: 2025-09-25  
**Context**: Authentication system implementation required several TypeScript fixes before successful build/deployment

### Issues Encountered & Solutions:

#### 1. **Supabase Admin API Method Changes**
- **Issue**: `supabase.auth.admin.getUserByEmail()` method doesn't exist
- **Error**: `Property 'getUserByEmail' does not exist on type 'GoTrueAdminApi'`
- **Fix**: Use `supabase.auth.admin.listUsers()` and filter client-side:
  ```typescript
  // ❌ Old (broken)
  const userResponse = await supabase.auth.admin.getUserByEmail(payload.email);
  const user = userResponse?.data?.user;
  
  // ✅ New (working)
  const userResponse = await supabase.auth.admin.listUsers();
  const user = userResponse?.data?.users?.find(u => u.email === payload.email);
  ```

#### 2. **Button Component Size Props**
- **Issue**: `size="xs"` not supported in Button component
- **Error**: `Type '"xs"' is not assignable to type 'ButtonSize | undefined'`
- **Fix**: Use supported sizes only (`'sm' | 'md' | 'lg' | 'xl'`):
  ```typescript
  // ❌ Old (broken)
  <Button size="xs" />
  
  // ✅ New (working)
  <Button size="sm" />
  ```

#### 3. **Type Property Mismatches**
- **Issue**: Accessing non-existent properties on TypeScript interfaces
- **Error**: `Property 'description' does not exist on type 'ActivityEvidence'`
- **Fix**: Use correct property names from interface:
  ```typescript
  // ❌ Old (broken)
  {activity.description && <p>{activity.description}</p>}
  
  // ✅ New (working)
  {activity.indicators && activity.indicators.length > 0 && 
    <p>{activity.indicators.join(', ')}</p>}
  ```

#### 4. **Store Type Inference Issues**
- **Issue**: TypeScript can't infer proper types in Zustand store initialization
- **Error**: `Type 'string' is not assignable to type '"table" | "cards"'`
- **Fix**: Use explicit type assertions:
  ```typescript
  // ❌ Old (broken)
  rosterViewMode: 'table',
  impersonatedRole: process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true' ? 'leader' : null,
  
  // ✅ New (working)
  rosterViewMode: 'table' as const,
  impersonatedRole: process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true' ? 'leader' as ClanRoleName : null,
  ```

### Prevention Strategies:

1. **API Method Validation**: Always check current Supabase documentation for admin API methods
2. **Component Prop Types**: Verify all component props match their TypeScript interfaces
3. **Type Safety**: Use `as const` assertions for literal types in stores
4. **Interface Compliance**: Ensure all property accesses match actual interface definitions
5. **Build Testing**: Run `npm run build` locally before committing to catch TypeScript errors early

### Key Takeaway:
The authentication system implementation was solid, but several TypeScript strictness issues required fixes. Always test builds locally before deployment to catch these issues early.

- [ ] Explore blurring sensitive clan metrics in any publicly shared dashboard views to protect roster privacy.

## Clan Player Scoring Framework (Future Idea)
- Track ACE (clan contribution) alongside Hero Momentum (self progression).
- Hero Momentum: weekly snapshots + 4-week rolling window, compute ΔBK/ΔAQ/ΔGW/ΔRC, EMA trend, idle week streaks, upgrade streaks.
- Engagement Index = 100 - (idleWeeks*12) + (upgradeStreak*4) + (EMA*6) to penalize inactivity and reward streaks.
- ACE inputs: donations, war stars/consistency, CWL participation, general activity normalized per season; scale 0–2000.
- Optional Combined Clan Score = 0.65*ACE + 0.35*EI for all-rounder ranking.
- Dashboard hooks: ACE leaderboard, hero heatmap, momentum streaks, watchlist (EI drop/idle weeks), recovery highlights, all-rounders, Discord challenges (longest upgrade streak, most improved ACE, highest EI gain, weekly top builders/needs a nudge).
