# Component Reference Guide

**Version:** 0.31.0  
**Last Updated:** October 2025

---

## Table of Contents

1. [Roster Components](#roster-components)
2. [Player Components](#player-components)
3. [Layout Components](#layout-components)
4. [UI Components](#ui-components)
5. [Analytics Components](#analytics-components)
6. [Admin Components](#admin-components)
7. [Component Composition Examples](#component-composition-examples)

---

## Roster Components

### `<RosterTable />`

The main roster table component with advanced sorting, filtering, and pagination.

**Location:** `/components/roster/RosterTable.tsx`

**Props:**
```typescript
interface RosterTableProps {
  className?: string;
}
```

**State Management:**
- Uses Zustand store (`useDashboardStore`)
- Manages sorting, filtering, pagination locally
- Syncs with global roster data

**Features:**
- Multi-column sorting
- Real-time search
- Filter by role, TH, rush level, activity
- Pagination (50 items/page)
- Responsive (desktop table + mobile cards)
- ACE score integration
- Leadership-based actions

**Usage:**
```tsx
import { RosterTable } from '@/components/roster/RosterTable';

function Dashboard() {
  return (
    <div className="container mx-auto p-4">
      <RosterTable />
    </div>
  );
}
```

---

### `<TableHeader />`

Table header with sortable columns.

**Props:**
```typescript
interface TableHeaderProps {
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  showAceScore?: boolean;
}
```

**Usage:**
```tsx
<TableHeader
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
  showAceScore={true}
/>
```

---

### `<TableRow />`

Individual roster table row.

**Props:**
```typescript
interface TableRowProps {
  member: Member;
  aceScore?: number;
  onPlayerClick?: (tag: string, name: string) => void;
  isLeadership?: boolean;
}
```

---

### `<MobileCard />`

Mobile-optimized member card.

**Props:**
```typescript
interface MobileCardProps {
  member: Member;
  aceScore?: number;
  onPlayerClick?: (tag: string, name: string) => void;
}
```

---

### `<PlayerCard />`

Detailed player card with stats.

**Props:**
```typescript
interface PlayerCardProps {
  member: Member;
  showActions?: boolean;
  onViewProfile?: () => void;
}
```

**Usage:**
```tsx
<PlayerCard
  member={member}
  showActions={true}
  onViewProfile={() => router.push(`/player/${member.tag}`)}
/>
```

---

### `<TableFilters />`

Filter controls for roster table.

**Props:**
```typescript
interface TableFiltersProps {
  filters: TableFilters;
  onFilterChange: (filters: Partial<TableFilters>) => void;
  totalItems: number;
  filteredItems: number;
}
```

**Filter Options:**
```typescript
interface TableFilters {
  search: string;
  role: 'all' | 'leader' | 'coLeader' | 'elder' | 'member';
  townHall: 'all' | '17' | '16' | '15' | '14' | '13' | '12-';
  rushLevel: 'all' | 'very-rushed' | 'rushed' | 'not-rushed';
  activityLevel: 'all' | 'very-active' | 'active' | 'moderate' | 'low' | 'inactive';
  donationStatus: 'all' | 'net-receiver' | 'net-donator' | 'low-donator';
}
```

---

### `<Pagination />`

Pagination controls.

**Props:**
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}
```

---

### `<RosterSummary />`

Roster statistics summary panel.

**Props:**
```typescript
interface RosterSummaryProps {
  roster: Roster;
  aceScores?: AceScoreResult[];
}
```

**Displays:**
- Total members
- Average TH level
- Top donors
- Top trophy earners
- Average ACE score
- Archetype distribution

---

### `<RosterHighlightsPanel />`

Highlights and achievements panel.

**Props:**
```typescript
interface RosterHighlightsPanelProps {
  members: Member[];
  aceScores: AceScoreResult[];
}
```

---

### `<AceLeaderboardCard />`

ACE score leaderboard card.

**Props:**
```typescript
interface AceLeaderboardCardProps {
  aceScores: AceScoreResult[];
  limit?: number;
  onPlayerClick?: (tag: string) => void;
}
```

**Usage:**
```tsx
<AceLeaderboardCard
  aceScores={aceScores}
  limit={10}
  onPlayerClick={(tag) => setSelectedPlayer(tag)}
/>
```

---

## Player Components

### `<PlayerProfilePage />`

Full player profile page.

**Location:** `/components/player/PlayerProfilePage.tsx`

**Props:**
```typescript
interface PlayerProfilePageProps {
  playerTag: string;
  clanTag: string;
}
```

**Features:**
- Player summary header
- Performance overview
- Activity analytics
- Hero progress tracking
- Historical data charts
- Notes panel

---

### `<PlayerSummaryHeader />`

Player profile header with key stats.

**Props:**
```typescript
interface PlayerSummaryHeaderProps {
  player: Member;
  clanName?: string;
  showActions?: boolean;
}
```

---

### `<PlayerPerformanceOverview />`

Performance metrics overview.

**Props:**
```typescript
interface PlayerPerformanceOverviewProps {
  player: Member;
  aceScore?: AceScoreResult;
  dnaProfile?: PlayerDNA;
}
```

---

### `<PlayerActivityAnalytics />`

Activity tracking and analytics.

**Props:**
```typescript
interface PlayerActivityAnalyticsProps {
  playerTag: string;
  history: PlayerHistory[];
}
```

**Displays:**
- Activity score trend
- Donation patterns
- War participation
- Capital raid engagement

---

### `<PlayerHeroProgress />`

Hero upgrade progress tracker.

**Props:**
```typescript
interface PlayerHeroProgressProps {
  player: Member;
  showProgress?: boolean;
}
```

**Usage:**
```tsx
<PlayerHeroProgress
  player={member}
  showProgress={true}
/>
```

---

### `<PlayerComparisonDashboard />`

Compare player against clan averages.

**Props:**
```typescript
interface PlayerComparisonDashboardProps {
  player: Member;
  clanAverages: {
    trophies: number;
    donations: number;
    activityScore: number;
    aceScore: number;
  };
}
```

---

### `<PlayerNotesPanel />`

Player notes management.

**Props:**
```typescript
interface PlayerNotesPanelProps {
  playerTag: string;
  notes: PlayerNote[];
  onAddNote: (note: string) => void;
  isLeadership?: boolean;
}
```

---

### `<PlayerEngagementInsights />`

AI-powered engagement insights.

**Props:**
```typescript
interface PlayerEngagementInsightsProps {
  playerTag: string;
  player: Member;
}
```

---

## Layout Components

### `<DashboardLayout />`

Main dashboard layout wrapper.

**Props:**
```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}
```

**Features:**
- Responsive sidebar navigation
- Header with user menu
- Tab navigation
- Quick actions menu
- Settings modal
- Toast notifications

---

### `<CommandRail />`

Left sidebar command rail.

**Props:**
```typescript
interface CommandRailProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}
```

---

### `<TabNavigation />`

Top tab navigation bar.

**Props:**
```typescript
interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  tabs: TabType[];
}
```

---

### `<QuickActionsMenu />`

Quick actions dropdown menu.

**Props:**
```typescript
interface QuickActionsMenuProps {
  isLeadership: boolean;
  clanTag: string;
}
```

**Available Actions:**
- Create snapshot
- Run ingestion
- View departures
- Access settings
- Export data

---

### `<PlayerProfileModal />`

Modal for player profile display.

**Props:**
```typescript
interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerTag: string;
  playerName: string;
}
```

**Usage:**
```tsx
import { useState } from 'react';
import { PlayerProfileModal } from '@/components/layout/PlayerProfileModal';

function RosterRow({ member }) {
  const [showProfile, setShowProfile] = useState(false);
  
  return (
    <>
      <tr onClick={() => setShowProfile(true)}>
        <td>{member.name}</td>
      </tr>
      
      <PlayerProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        playerTag={member.tag}
        playerName={member.name}
      />
    </>
  );
}
```

---

### `<SettingsModal />`

Application settings modal.

**Props:**
```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

---

### `<ToastHub />`

Centralized toast notification system.

**Props:**
```typescript
interface ToastHubProps {
  // No props - uses global toast store
}
```

**Usage:**
```tsx
import { useToast } from '@/lib/toast';

function MyComponent() {
  const { showToast } = useToast();
  
  const handleAction = () => {
    showToast({
      type: 'success',
      message: 'Action completed successfully!'
    });
  };
  
  return <button onClick={handleAction}>Do Action</button>;
}
```

---

### `<AuthGuard />`

Authentication guard component.

**Props:**
```typescript
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

---

### `<LeadershipGuard />`

Leadership permission guard.

**Props:**
```typescript
interface LeadershipGuardProps {
  children: React.ReactNode;
  requiredRole: 'elder' | 'coleader' | 'leader';
  fallback?: React.ReactNode;
}
```

**Usage:**
```tsx
import LeadershipGuard from '@/components/LeadershipGuard';

function AdminPanel() {
  return (
    <LeadershipGuard requiredRole="coleader">
      <div>
        <h2>Admin Controls</h2>
        <button>Run Ingestion</button>
      </div>
    </LeadershipGuard>
  );
}
```

---

## UI Components

### `<Button />`

Versatile button component.

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}
```

**Usage:**
```tsx
import { Button } from '@/components/ui/Button';
import { Download } from 'lucide-react';

<Button 
  variant="primary" 
  size="lg"
  loading={isLoading}
  icon={<Download size={16} />}
  onClick={handleDownload}
>
  Download Report
</Button>
```

---

### `<Input />`

Form input component.

**Props:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Usage:**
```tsx
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

<Input
  label="Search Players"
  placeholder="Enter player name..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  leftIcon={<Search size={16} />}
  error={validationError}
/>
```

---

### `<Modal />`

Flexible modal dialog.

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
}
```

**Usage:**
```tsx
import { Modal } from '@/components/ui/Modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure you want to proceed?</p>
  <div className="mt-4 flex gap-2">
    <Button onClick={handleConfirm}>Confirm</Button>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
  </div>
</Modal>
```

---

### `<TownHallBadge />`

Town Hall level badge.

**Props:**
```typescript
interface TownHallBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

**Usage:**
```tsx
import { TownHallBadge } from '@/components/ui/TownHallBadge';

<TownHallBadge level={16} size="md" showLabel={true} />
```

---

### `<LeagueBadge />`

League badge with icon.

**Props:**
```typescript
interface LeagueBadgeProps {
  leagueName: string;
  leagueId?: number;
  trophies?: number;
  iconUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrophies?: boolean;
}
```

**Usage:**
```tsx
import { LeagueBadge } from '@/components/ui/LeagueBadge';

<LeagueBadge
  leagueName="Legend League"
  leagueId={29000000}
  trophies={5500}
  size="md"
  showTrophies={true}
/>
```

---

### `<HeroLevel />`

Hero level display with progress.

**Props:**
```typescript
interface HeroLevelProps {
  hero: 'bk' | 'aq' | 'gw' | 'rc' | 'mp';
  level: number;
  maxLevel: number;
  townHallLevel: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage:**
```tsx
import { HeroLevel } from '@/components/ui/HeroLevel';

<HeroLevel
  hero="bk"
  level={85}
  maxLevel={90}
  townHallLevel={16}
  showProgress={true}
  size="md"
/>
```

---

### `<GlassCard />`

Glass morphism card component.

**Props:**
```typescript
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg';
  opacity?: number;
}
```

**Usage:**
```tsx
import { GlassCard } from '@/components/ui/GlassCard';

<GlassCard blur="md" opacity={0.8}>
  <h3>Card Title</h3>
  <p>Card content goes here...</p>
</GlassCard>
```

---

### `<SectionCard />`

Section container card.

**Props:**
```typescript
interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}
```

---

### `<ResourceDisplay />`

Display resources (gold, elixir, etc.).

**Props:**
```typescript
interface ResourceDisplayProps {
  type: 'gold' | 'elixir' | 'dark-elixir' | 'gems' | 'capital-gold';
  amount: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

---

### `<ThemeToggle />`

Dark/light theme toggle.

**Props:**
```typescript
interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
}
```

---

## Analytics Components

### `<PlayerDNADashboard />`

Player DNA visualization dashboard.

**Props:**
```typescript
interface PlayerDNADashboardProps {
  members: Member[];
  selectedPlayer?: string;
  onPlayerSelect?: (tag: string) => void;
}
```

**Features:**
- Radar chart visualization
- Archetype classification
- Strength/weakness analysis
- Comparison tools

---

### `<PlayerDNARadar />`

DNA radar chart component.

**Props:**
```typescript
interface PlayerDNARadarProps {
  dna: PlayerDNA;
  size?: number;
  showLabels?: boolean;
}
```

---

### `<ClanAnalytics />`

Comprehensive clan analytics dashboard.

**Props:**
```typescript
interface ClanAnalyticsProps {
  roster: Roster;
  historical?: HistoricalData[];
}
```

**Displays:**
- Member growth trends
- Donation patterns
- War performance
- Activity distribution
- TH distribution
- ACE score distribution

---

### `<ChangeDashboard />`

Change detection and notification dashboard.

**Props:**
```typescript
interface ChangeDashboardProps {
  clanTag: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}
```

**Features:**
- Real-time change detection
- AI-generated summaries
- Game chat message templates
- Notification history
- Mark as read/actioned

---

### `<FullSnapshotDashboard />`

Full snapshot visualization.

**Props:**
```typescript
interface FullSnapshotDashboardProps {
  clanTag: string;
  snapshotDate?: string;
}
```

---

### `<InsightsDashboard />`

AI insights dashboard.

**Props:**
```typescript
interface InsightsDashboardProps {
  clanTag: string;
  insights: InsightsBundle;
}
```

---

## Admin Components

### `<CommandCenter />`

Admin command center.

**Props:**
```typescript
interface CommandCenterProps {
  clanTag: string;
}
```

**Features:**
- Manual ingestion trigger
- Cache management
- System diagnostics
- User role management
- Watchlist management
- Elder promotion panel

---

### `<AccessManager />`

Access control management.

**Props:**
```typescript
interface AccessManagerProps {
  clanTag: string;
}
```

**Features:**
- Add/remove members
- Assign access levels
- View access history
- Audit logs

---

### `<DepartureManager />`

Departure tracking and management.

**Props:**
```typescript
interface DepartureManagerProps {
  clanTag: string;
  currentMembers: Member[];
}
```

**Features:**
- Track departed members
- Rejoin notifications
- Departure reasons
- Historical departure data

---

### `<ApplicantsPanel />`

Clan applicant evaluation panel.

**Props:**
```typescript
interface ApplicantsPanelProps {
  clanTag: string;
}
```

**Features:**
- Scan applicants
- AI evaluation
- Shortlist management
- Application history

---

### `<DiscordPublisher />`

Discord webhook publisher.

**Props:**
```typescript
interface DiscordPublisherProps {
  clanTag: string;
  webhookUrl?: string;
}
```

**Features:**
- Publish roster updates
- Share achievements
- War results
- Custom messages

---

## Component Composition Examples

### Example 1: Full Dashboard Layout

```tsx
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RosterTable } from '@/components/roster/RosterTable';
import { RosterSummary } from '@/components/roster/RosterSummary';
import { ChangeDashboard } from '@/components/ChangeDashboard';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

function Dashboard() {
  const { roster, activeTab } = useDashboardStore();
  
  return (
    <DashboardLayout>
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <RosterSummary roster={roster} />
          <RosterTable />
        </div>
      )}
      
      {activeTab === 'changes' && (
        <ChangeDashboard clanTag={roster.clanTag} />
      )}
    </DashboardLayout>
  );
}
```

### Example 2: Player Analysis Page

```tsx
import { PlayerProfilePage } from '@/components/player/PlayerProfilePage';
import { PlayerDNARadar } from '@/components/PlayerDNARadar';
import { calculatePlayerDNA } from '@/lib/player-dna';

function PlayerAnalysis({ playerTag }: { playerTag: string }) {
  const [player, setPlayer] = useState(null);
  const [dna, setDNA] = useState(null);
  
  useEffect(() => {
    // Fetch player data
    fetchPlayer(playerTag).then(data => {
      setPlayer(data);
      setDNA(calculatePlayerDNA(data));
    });
  }, [playerTag]);
  
  if (!player || !dna) return <div>Loading...</div>;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <PlayerProfilePage 
          playerTag={playerTag}
          clanTag={player.clanTag}
        />
      </div>
      
      <div className="lg:col-span-1">
        <GlassCard>
          <h3>Player DNA</h3>
          <PlayerDNARadar dna={dna} size={300} showLabels={true} />
        </GlassCard>
      </div>
    </div>
  );
}
```

### Example 3: Custom Roster View

```tsx
import { RosterTable } from '@/components/roster/RosterTable';
import { AceLeaderboardCard } from '@/components/roster/AceLeaderboardCard';
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';

function CustomRosterView() {
  const roster = useDashboardStore(state => state.roster);
  const [aceScores, setAceScores] = useState([]);
  
  useEffect(() => {
    if (roster) {
      const inputs = createAceInputsFromRoster(roster);
      const scores = calculateAceScores(inputs);
      setAceScores(scores);
    }
  }, [roster]);
  
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      <div className="xl:col-span-3">
        <RosterTable />
      </div>
      
      <div className="xl:col-span-1">
        <AceLeaderboardCard
          aceScores={aceScores}
          limit={10}
          onPlayerClick={(tag) => {
            // Handle player click
          }}
        />
      </div>
    </div>
  );
}
```

### Example 4: Leadership Dashboard

```tsx
import LeadershipGuard from '@/components/LeadershipGuard';
import { CommandCenter } from '@/components/CommandCenter';
import { AccessManager } from '@/components/AccessManager';
import { DepartureManager } from '@/components/DepartureManager';

function LeadershipDashboard({ clanTag }: { clanTag: string }) {
  const [activePanel, setActivePanel] = useState('command');
  
  return (
    <LeadershipGuard requiredRole="coleader">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Button
            variant={activePanel === 'command' ? 'primary' : 'outline'}
            onClick={() => setActivePanel('command')}
          >
            Command Center
          </Button>
          <Button
            variant={activePanel === 'access' ? 'primary' : 'outline'}
            onClick={() => setActivePanel('access')}
          >
            Access Management
          </Button>
          <Button
            variant={activePanel === 'departures' ? 'primary' : 'outline'}
            onClick={() => setActivePanel('departures')}
          >
            Departures
          </Button>
        </div>
        
        {activePanel === 'command' && <CommandCenter clanTag={clanTag} />}
        {activePanel === 'access' && <AccessManager clanTag={clanTag} />}
        {activePanel === 'departures' && <DepartureManager clanTag={clanTag} />}
      </div>
    </LeadershipGuard>
  );
}
```

### Example 5: Mobile-Optimized View

```tsx
import { MobileCard } from '@/components/roster/MobileCard';
import { PlayerProfileModal } from '@/components/layout/PlayerProfileModal';

function MobileRoster() {
  const roster = useDashboardStore(state => state.roster);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  return (
    <div className="md:hidden">
      <div className="space-y-2">
        {roster.members.map(member => (
          <MobileCard
            key={member.tag}
            member={member}
            onPlayerClick={(tag, name) => {
              setSelectedPlayer({ tag, name });
            }}
          />
        ))}
      </div>
      
      {selectedPlayer && (
        <PlayerProfileModal
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          playerTag={selectedPlayer.tag}
          playerName={selectedPlayer.name}
        />
      )}
    </div>
  );
}
```

---

## Best Practices

### 1. Component Performance

```tsx
// Use memo for expensive computations
const MemoizedRosterTable = React.memo(RosterTable, (prev, next) => {
  return prev.roster === next.roster;
});

// Use useMemo for derived state
const aceScores = useMemo(() => {
  const inputs = createAceInputsFromRoster(roster);
  return calculateAceScores(inputs);
}, [roster]);

// Use useCallback for event handlers
const handlePlayerClick = useCallback((tag: string, name: string) => {
  setSelectedPlayer({ tag, name });
}, []);
```

### 2. Error Boundaries

```tsx
import { RootErrorBoundary } from '@/components/layout/RootErrorBoundary';

function App() {
  return (
    <RootErrorBoundary>
      <DashboardLayout>
        {/* Your app content */}
      </DashboardLayout>
    </RootErrorBoundary>
  );
}
```

### 3. Loading States

```tsx
import { Button } from '@/components/ui/Button';

function ActionButton() {
  const [loading, setLoading] = useState(false);
  
  const handleAction = async () => {
    setLoading(true);
    try {
      await performAction();
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button
      onClick={handleAction}
      loading={loading}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Submit'}
    </Button>
  );
}
```

### 4. Accessibility

```tsx
// Use semantic HTML
<button aria-label="Close modal" onClick={onClose}>
  <X size={16} aria-hidden="true" />
</button>

// Provide keyboard navigation
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  onClick={handleClick}
>
  Click me
</div>
```

---

**Last Updated:** October 2025  
**Maintained by:** Clash Intelligence Team
