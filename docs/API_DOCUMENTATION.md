# Clash Intelligence Dashboard - API Documentation

**Version:** 0.31.0  
**Last Updated:** October 2025  
**Project:** Clash of Clans Clan Management Dashboard

---

## Table of Contents

1. [Overview](#overview)
2. [REST API Endpoints](#rest-api-endpoints)
3. [Core Library Functions](#core-library-functions)
4. [React Components](#react-components)
5. [Type Definitions](#type-definitions)
6. [Database Schema](#database-schema)
7. [Usage Examples](#usage-examples)
8. [Authentication & Authorization](#authentication--authorization)
9. [Rate Limiting](#rate-limiting)
10. [Error Handling](#error-handling)

---

## Overview

The Clash Intelligence Dashboard is a comprehensive Next.js application for managing Clash of Clans clans. It provides real-time roster management, player analytics, war tracking, and AI-powered insights.

### Tech Stack
- **Frontend:** Next.js 14, React 18, TypeScript
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL)
- **External APIs:** Clash of Clans API
- **AI:** OpenAI GPT-4
- **State Management:** Zustand

---

## REST API Endpoints

### Roster Management

#### `GET /api/v2/roster`

Fetches the current clan roster with comprehensive member data.

**Query Parameters:**
- `clanTag` (string, optional): The clan tag (e.g., `#2PR8R8V8P`). Defaults to configured home clan.

**Response:**
```typescript
{
  success: boolean;
  data: {
    clan: {
      id: string;
      tag: string;
      name: string;
      logo_url: string | null;
    };
    snapshot: {
      id: string;
      fetchedAt: string;
      memberCount: number;
      totalTrophies: number | null;
      totalDonations: number | null;
      metadata: Record<string, any>;
      payloadVersion: string | null;
      seasonId: string | null;
      seasonStart: string | null;
      seasonEnd: string | null;
    };
    members: Member[];
    seasonId: string | null;
  };
}
```

**Example Request:**
```bash
curl https://your-domain.com/api/v2/roster?clanTag=%232PR8R8V8P
```

**Features:**
- ETag support for efficient caching
- Automatic tenure calculation
- Hero level extraction
- League and ranked data
- Metrics aggregation

---

### Snapshots

#### `POST /api/snapshots/create`

Creates a new daily snapshot of the clan roster and detects changes.

**Request Body:**
```typescript
{
  clanTag: string; // e.g., "#2PR8R8V8P"
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    snapshot: DailySnapshot;
    changes: ChangeSummary | null;
  };
}
```

**Example Request:**
```bash
curl -X POST https://your-domain.com/api/snapshots/create \
  -H "Content-Type: application/json" \
  -d '{"clanTag": "#2PR8R8V8P"}'
```

**Rate Limiting:**
- 6 requests per minute per clan/IP combination

---

#### `GET /api/snapshots/list`

Lists all available snapshots for a clan.

**Query Parameters:**
- `clanTag` (string, required): The clan tag

**Response:**
```typescript
{
  success: boolean;
  data: {
    snapshots: Array<{
      date: string;
      memberCount: number;
      timestamp: string;
    }>;
  };
}
```

---

#### `GET /api/snapshots/changes`

Retrieves change summaries between snapshots.

**Query Parameters:**
- `clanTag` (string, required): The clan tag
- `date` (string, optional): Specific date in YYYY-MM-DD format

**Response:**
```typescript
{
  success: boolean;
  data: {
    changes: MemberChange[];
    summary: string; // AI-generated summary
    gameChatMessages: string[];
  };
}
```

---

### Player Management

#### `GET /api/player/[tag]`

Fetches detailed player information.

**Path Parameters:**
- `tag` (string): Player tag (e.g., `#VGQVRLRL`)

**Response:**
```typescript
{
  success: boolean;
  data: {
    player: CoCPlayer;
    history: PlayerHistory[];
    analytics: PlayerAnalytics;
  };
}
```

---

#### `GET /api/player/[tag]/history`

Retrieves player performance history.

**Path Parameters:**
- `tag` (string): Player tag

**Query Parameters:**
- `limit` (number, optional): Number of records to return (default: 30)

**Response:**
```typescript
{
  success: boolean;
  data: {
    history: Array<{
      date: string;
      trophies: number;
      donations: number;
      townHallLevel: number;
      heroLevels: HeroCaps;
    }>;
  };
}
```

---

#### `GET /api/player/[tag]/comparison`

Compares player performance against clan averages.

**Response:**
```typescript
{
  success: boolean;
  data: {
    player: Member;
    clanAverages: {
      trophies: number;
      donations: number;
      activityScore: number;
    };
    percentiles: {
      trophies: number;
      donations: number;
      performance: number;
    };
  };
}
```

---

### Tenure Management

#### `GET /api/tenure/map`

Retrieves the current tenure map for all players.

**Response:**
```typescript
{
  success: boolean;
  data: Record<string, number>; // playerTag -> tenure in days
}
```

---

#### `POST /api/tenure/save`

Updates tenure for a player.

**Request Body:**
```typescript
{
  tag: string;
  base: number; // Base tenure in days
  asOfYmd: string; // Date in YYYY-MM-DD format
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

#### `GET /api/tenure/ledger`

Retrieves the full tenure ledger.

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    tag: string;
    base: number;
    as_of: string;
    ts: string;
    tenure_days: number;
  }>;
}
```

---

### AI & Analytics

#### `POST /api/ai-summary/generate`

Generates AI-powered summary of clan changes.

**Request Body:**
```typescript
{
  clanTag: string;
  changes: MemberChange[];
  date: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    summary: string;
    keyInsights: string[];
    recommendations: string[];
  };
}
```

---

#### `POST /api/ai-coaching/generate`

Generates personalized coaching insights for players.

**Request Body:**
```typescript
{
  playerTag: string;
  clanTag: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    insights: CoachingInsight[];
    actionPlan: string[];
  };
}
```

---

### Access Management

#### `GET /api/access/list`

Lists all access members for the clan.

**Response:**
```typescript
{
  success: boolean;
  data: {
    members: AccessMember[];
  };
}
```

---

#### `POST /api/access/init`

Initializes access configuration for a clan.

**Request Body:**
```typescript
{
  clanTag: string;
  clanName: string;
  initialMembers: Array<{
    name: string;
    accessLevel: AccessLevel;
    cocPlayerTag?: string;
    email?: string;
  }>;
}
```

---

### War Management

#### `GET /api/war/opponent`

Fetches current war opponent data.

**Query Parameters:**
- `clanTag` (string, required): The clan tag

**Response:**
```typescript
{
  success: boolean;
  data: {
    state: string;
    teamSize: number;
    opponent: {
      name: string;
      tag: string;
      members: Member[];
    };
    startTime: string;
    endTime: string;
  };
}
```

---

#### `POST /api/war/pin`

Pins/unpins a war for tracking.

**Request Body:**
```typescript
{
  warId: string;
  pinned: boolean;
}
```

---

### Departures & Notifications

#### `GET /api/departures`

Retrieves departure records.

**Query Parameters:**
- `clanTag` (string, required): The clan tag

**Response:**
```typescript
{
  success: boolean;
  data: {
    departures: DepartureRecord[];
    rejoins: RejoinNotification[];
  };
}
```

---

#### `POST /api/departures/notifications`

Processes departure notifications.

**Request Body:**
```typescript
{
  clanTag: string;
  currentMembers: Member[];
}
```

---

### Admin Endpoints

#### `POST /api/admin/run-ingestion`

Manually triggers data ingestion (admin only).

**Request Body:**
```typescript
{
  clanTag: string;
  mode?: 'full' | 'incremental'; // default: 'full'
}
```

---

#### `POST /api/admin/trigger-ingestion`

Schedules an ingestion job (admin only).

**Request Body:**
```typescript
{
  clanTag: string;
  scheduledAt?: string; // ISO timestamp
}
```

---

#### `POST /api/admin/force-refresh`

Forces cache invalidation (admin only).

**Request Body:**
```typescript
{
  clanTag?: string; // If not provided, clears all caches
}
```

---

### Health & Diagnostics

#### `GET /api/health`

Returns API health status.

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    cocApi: 'up' | 'down';
    cache: 'up' | 'down';
  };
}
```

---

#### `GET /api/health/pipeline`

Returns ingestion pipeline health.

**Response:**
```typescript
{
  status: string;
  lastRun: string;
  nextScheduled: string;
  recentJobs: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string;
  }>;
}
```

---

## Core Library Functions

### ACE Score System (`/lib/ace-score.ts`)

The ACE (All-Mode Clan Excellence) scoring system provides comprehensive player performance evaluation.

#### `calculateAceScores(inputs: AcePlayerInput[], options?: AceCalculationOptions): AceScoreResult[]`

Calculates ACE scores for a roster of players.

**Parameters:**
- `inputs`: Array of player input data
- `options`: Optional configuration for weights and shrinkage

**Returns:** Sorted array of ACE score results

**Example:**
```typescript
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';

// From roster data
const aceInputs = createAceInputsFromRoster(roster);
const aceScores = calculateAceScores(aceInputs);

// With custom weights
const customScores = calculateAceScores(aceInputs, {
  weights: {
    ova: 0.45,  // Offensive Value Added
    dva: 0.20,  // Defensive Value Added
    par: 0.15,  // Participation
    cap: 0.15,  // Capital Performance
    don: 0.05   // Donations
  }
});

// Access results
aceScores.forEach(result => {
  console.log(`${result.name}: ACE ${result.ace.toFixed(1)}`);
  console.log(`  OVA: ${result.breakdown.ova.shrunk.toFixed(2)}`);
  console.log(`  DVA: ${result.breakdown.dva.shrunk.toFixed(2)}`);
});
```

**ACE Components:**
- **OVA (Offensive Value Added)**: War attack performance
- **DVA (Defensive Value Added)**: Base defense effectiveness
- **PAR (Participation)**: War and capital raid engagement
- **CAP (Capital Performance)**: Capital raid efficiency
- **DON (Donations)**: Donation balance and ratio

---

### Player DNA System (`/lib/player-dna.ts`)

Multi-dimensional player classification system.

#### `calculatePlayerDNA(member: Member, clanContext?: ClanContext): PlayerDNA`

Analyzes player behavior across six dimensions.

**Example:**
```typescript
import { calculatePlayerDNA, classifyPlayerArchetype, getArchetypeInfo } from '@/lib/player-dna';

const dna = calculatePlayerDNA(member, {
  averageDonations: 500,
  averageWarStars: 15,
  averageCapitalContributions: 8000,
  totalMembers: 50
});

const archetype = classifyPlayerArchetype(dna, member);
const archetypeInfo = getArchetypeInfo(archetype);

console.log(`${member.name} is a ${archetype}`);
console.log(`  Leadership: ${dna.leadership}/100`);
console.log(`  Performance: ${dna.performance}/100`);
console.log(`  Generosity: ${dna.generosity}/100`);
console.log(`  Strengths: ${archetypeInfo.strengths.join(', ')}`);
```

**Player Archetypes:**
- **Balanced Titan**: Perfect all-around player
- **Alpha Donor**: Massive donation provider
- **Paradox Player**: Takes donations but delivers top performance
- **Silent Warrior**: Elite performer, low social engagement
- **Social Catalyst**: Community builder
- **Specialist**: Niche expert
- **Grinder**: Consistent steady performer
- **Veteran**: Long-tenured loyal member
- **Potential**: New member with promise
- **Wildcard**: Unpredictable unique patterns

---

### Snapshot & Change Detection (`/lib/snapshots.ts`)

#### `detectChanges(previous: DailySnapshot, current: DailySnapshot): MemberChange[]`

Detects changes between two snapshots.

**Example:**
```typescript
import { getLatestSnapshot, loadSnapshot, detectChanges } from '@/lib/snapshots';

const currentSnapshot = await getLatestSnapshot(clanTag);
const previousSnapshot = await loadSnapshot(clanTag, '2025-10-08');

const changes = detectChanges(previousSnapshot, currentSnapshot);

// Filter by type
const newMembers = changes.filter(c => c.type === 'new_member');
const heroUpgrades = changes.filter(c => c.type === 'hero_upgrade');

console.log(`${newMembers.length} new members joined`);
console.log(`${heroUpgrades.length} hero upgrades detected`);
```

**Change Types:**
- `new_member`: New player joined
- `left_member`: Player departed
- `town_hall_upgrade`: TH upgrade
- `hero_upgrade`: Hero level increase
- `trophy_change`: Significant trophy change
- `donation_change`: Donation increase
- `role_change`: Role promotion/demotion
- `attack_wins_change`: War attack wins
- `capital_contributions_change`: Capital gold contribution

---

### Tenure Management (`/lib/tenure.ts`)

#### `readTenureDetails(targetDate?: string): Promise<Record<string, {days: number, as_of?: string}>>`

Reads effective tenure for all players.

**Example:**
```typescript
import { readTenureDetails, appendTenureLedgerEntry } from '@/lib/tenure';

// Get current tenure
const tenure = await readTenureDetails();
console.log(`Player #VGQVRLRL tenure: ${tenure['#VGQVRLRL']?.days} days`);

// Set base tenure
await appendTenureLedgerEntry('#VGQVRLRL', 365, '2025-10-09');
```

---

### Clash of Clans API (`/lib/coc.ts`)

#### `getClanMembers(clanTag: string): Promise<Member[]>`

Fetches clan member list from CoC API.

**Example:**
```typescript
import { getClanMembers, getPlayer, getClanWarLog } from '@/lib/coc';

// Get clan members
const members = await getClanMembers('#2PR8R8V8P');

// Get player details
const player = await getPlayer('#VGQVRLRL');
console.log(`${player.name} - TH${player.townHallLevel}`);

// Get war log
const warLog = await getClanWarLog('#2PR8R8V8P', 10);
```

**Available Functions:**
- `getClanInfo(clanTag)`: Fetch clan information
- `getClanMembers(clanTag)`: Fetch member list
- `getPlayer(tag)`: Fetch player details
- `getClanWarLog(clanTag, limit)`: Fetch war history
- `getClanCurrentWar(clanTag)`: Fetch current war
- `getClanCapitalRaidSeasons(clanTag, limit)`: Fetch capital raid history
- `extractHeroLevels(player)`: Extract hero levels from player data

---

### Roster Building (`/lib/roster.ts`)

#### `buildRosterSnapshotFirst(clanTagRaw: string, date?: string): Promise<Roster | null>`

Builds a complete roster with snapshot-first approach.

**Example:**
```typescript
import { buildRosterSnapshotFirst } from '@/lib/roster';

// Get latest snapshot or live data
const roster = await buildRosterSnapshotFirst('#2PR8R8V8P', 'latest');

// Get specific date
const historicalRoster = await buildRosterSnapshotFirst('#2PR8R8V8P', '2025-10-08');

// Force live fetch
const liveRoster = await buildRosterSnapshotFirst('#2PR8R8V8P', 'live');

if (roster) {
  console.log(`${roster.clanName}: ${roster.members.length} members`);
  console.log(`Source: ${roster.source}`);
}
```

---

### Tag Utilities (`/lib/tags.ts`)

#### `normalizeTag(tag: string): string`

Normalizes player/clan tags to standard format.

**Example:**
```typescript
import { normalizeTag, isValidTag, safeTagForFilename } from '@/lib/tags';

const tag = normalizeTag('2pr8r8v8p');  // Returns: "#2PR8R8V8P"
const isValid = isValidTag(tag);  // Returns: true
const filename = safeTagForFilename(tag);  // Returns: "2PR8R8V8P"
```

---

### Date Utilities (`/lib/date.ts`)

#### `ymdNowUTC(): string`

Returns current date in YYYY-MM-DD format (UTC).

**Example:**
```typescript
import { ymdNowUTC, daysSince, daysBetween } from '@/lib/date';

const today = ymdNowUTC();  // "2025-10-09"
const days = daysSince('2025-10-01');  // 8
const duration = daysBetween('2025-10-01', '2025-10-09');  // 8
```

---

## React Components

### Core Components

#### `<RosterTable />`

Main roster table with sorting, filtering, and pagination.

**Props:**
```typescript
interface RosterTableProps {
  className?: string;
}
```

**Usage:**
```tsx
import { RosterTable } from '@/components/roster/RosterTable';

function Dashboard() {
  return (
    <div>
      <h1>Clan Roster</h1>
      <RosterTable />
    </div>
  );
}
```

**Features:**
- Advanced multi-column sorting
- Real-time search and filtering
- Pagination (50 items per page)
- Responsive design (table + mobile cards)
- ACE score integration
- Leadership-based actions

---

#### `<PlayerProfileModal />`

Modal for displaying detailed player information.

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
import { PlayerProfileModal } from '@/components/layout/PlayerProfileModal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>View Player</button>
      <PlayerProfileModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        playerTag="#VGQVRLRL"
        playerName="DoubleD"
      />
    </>
  );
}
```

---

#### `<ChangeDashboard />`

Displays clan changes and notifications.

**Props:**
```typescript
interface ChangeDashboardProps {
  clanTag: string;
}
```

**Usage:**
```tsx
import { ChangeDashboard } from '@/components/ChangeDashboard';

function App() {
  return <ChangeDashboard clanTag="#2PR8R8V8P" />;
}
```

---

#### `<DepartureManager />`

Manages player departures and returns.

**Props:**
```typescript
interface DepartureManagerProps {
  clanTag: string;
  currentMembers: Member[];
}
```

---

#### `<PlayerDNADashboard />`

Visualizes player DNA analysis.

**Props:**
```typescript
interface PlayerDNADashboardProps {
  members: Member[];
}
```

**Usage:**
```tsx
import { PlayerDNADashboard } from '@/components/PlayerDNADashboard';

function Analytics() {
  return <PlayerDNADashboard members={roster.members} />;
}
```

---

### UI Components

#### `<Button />`

Customizable button component.

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
```

**Usage:**
```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="lg" onClick={handleClick}>
  Click Me
</Button>
```

---

#### `<TownHallBadge />`

Displays Town Hall level badge.

**Props:**
```typescript
interface TownHallBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage:**
```tsx
import { TownHallBadge } from '@/components/ui/TownHallBadge';

<TownHallBadge level={16} size="md" />
```

---

#### `<LeagueBadge />`

Displays league badge with icon.

**Props:**
```typescript
interface LeagueBadgeProps {
  leagueName: string;
  leagueId?: number;
  trophies?: number;
  iconUrl?: string;
}
```

---

#### `<HeroLevel />`

Displays hero level with progress bar.

**Props:**
```typescript
interface HeroLevelProps {
  hero: 'bk' | 'aq' | 'gw' | 'rc' | 'mp';
  level: number;
  maxLevel: number;
  showProgress?: boolean;
}
```

---

#### `<Modal />`

Flexible modal component.

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
```

---

## Type Definitions

### Core Types (`/types/index.ts`)

All type definitions are centralized in `/web-next/src/types/index.ts`.

**Key Types:**
- `Member`: Clan member data structure
- `Roster`: Complete roster with metadata
- `DailySnapshot`: Daily snapshot format
- `MemberChange`: Change detection result
- `PlayerDNA`: Six-dimensional player analysis
- `AceScoreResult`: ACE score breakdown
- `AccessMember`: Access control member
- `DepartureRecord`: Departure tracking

See [Type Definitions Reference](./types.md) for complete documentation.

---

## Database Schema

### Tables

#### `clans`
- `id` (uuid, PK)
- `tag` (text, unique)
- `name` (text)
- `logo_url` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `members`
- `id` (uuid, PK)
- `tag` (text, unique)
- `name` (text)
- `th_level` (integer)
- `role` (text)
- `league` (jsonb)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `roster_snapshots`
- `id` (uuid, PK)
- `clan_id` (uuid, FK -> clans)
- `fetched_at` (timestamp)
- `member_count` (integer)
- `total_trophies` (integer)
- `total_donations` (integer)
- `payload` (jsonb)
- `metadata` (jsonb)
- `season_id` (text)

#### `member_snapshot_stats`
- `id` (uuid, PK)
- `snapshot_id` (uuid, FK -> roster_snapshots)
- `member_id` (uuid, FK -> members)
- `th_level` (integer)
- `role` (text)
- `trophies` (integer)
- `donations` (integer)
- `donations_received` (integer)
- `hero_levels` (jsonb)
- `activity_score` (numeric)
- `rush_percent` (numeric)
- `extras` (jsonb)

#### `metrics`
- `id` (uuid, PK)
- `clan_id` (uuid, FK -> clans)
- `member_id` (uuid, FK -> members)
- `metric_name` (text)
- `metric_window` (text)
- `value` (numeric)
- `metadata` (jsonb)
- `computed_at` (timestamp)

#### `clan_snapshots`
- `id` (uuid, PK)
- `clan_tag` (text)
- `snapshot_date` (date)
- `fetched_at` (timestamp)
- `clan` (jsonb)
- `member_summaries` (jsonb)
- `player_details` (jsonb)
- `current_war` (jsonb)
- `war_log` (jsonb)
- `capital_seasons` (jsonb)
- `metadata` (jsonb)

---

## Usage Examples

### Example 1: Fetch and Display Roster

```typescript
import { useState, useEffect } from 'react';

function RosterDisplay() {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoster() {
      const response = await fetch('/api/v2/roster?clanTag=%232PR8R8V8P');
      const result = await response.json();
      
      if (result.success) {
        setRoster(result.data);
      }
      setLoading(false);
    }
    
    fetchRoster();
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{roster.clan.name}</h1>
      <p>{roster.snapshot.memberCount} members</p>
      {roster.members.map(member => (
        <div key={member.tag}>
          {member.name} - TH{member.townHallLevel}
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Create Snapshot and Detect Changes

```typescript
async function createDailySnapshot(clanTag: string) {
  const response = await fetch('/api/snapshots/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clanTag })
  });
  
  const result = await response.json();
  
  if (result.success && result.data.changes) {
    console.log('Changes detected:');
    result.data.changes.changes.forEach(change => {
      console.log(`- ${change.description}`);
    });
    
    console.log('\nAI Summary:');
    console.log(result.data.changes.summary);
  }
}
```

### Example 3: Calculate Player Rankings

```typescript
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';
import { calculatePlayerDNA, classifyPlayerArchetype } from '@/lib/player-dna';

async function analyzeRoster(roster: Roster) {
  // Calculate ACE scores
  const aceInputs = createAceInputsFromRoster(roster);
  const aceScores = calculateAceScores(aceInputs);
  
  // Calculate DNA profiles
  const dnaProfiles = roster.members.map(member => ({
    member,
    dna: calculatePlayerDNA(member),
    archetype: classifyPlayerArchetype(
      calculatePlayerDNA(member),
      member
    )
  }));
  
  // Top performers
  console.log('Top 5 ACE Scores:');
  aceScores.slice(0, 5).forEach((result, i) => {
    console.log(`${i + 1}. ${result.name}: ${result.ace.toFixed(1)}`);
  });
  
  // Archetype distribution
  const archetypes = new Map();
  dnaProfiles.forEach(profile => {
    archetypes.set(
      profile.archetype,
      (archetypes.get(profile.archetype) || 0) + 1
    );
  });
  
  console.log('\nArchetype Distribution:');
  archetypes.forEach((count, archetype) => {
    console.log(`${archetype}: ${count} members`);
  });
}
```

### Example 4: Track Player Tenure

```typescript
import { readTenureDetails, appendTenureLedgerEntry } from '@/lib/tenure';

async function updatePlayerTenure(playerTag: string) {
  // Get current tenure
  const tenureMap = await readTenureDetails();
  const currentTenure = tenureMap[playerTag]?.days || 0;
  
  console.log(`Current tenure: ${currentTenure} days`);
  
  // Set new base tenure (e.g., after manual verification)
  const newBaseTenure = 500; // 500 days
  const asOfDate = '2025-10-09';
  
  await appendTenureLedgerEntry(playerTag, newBaseTenure, asOfDate);
  
  console.log(`Updated tenure to ${newBaseTenure} days as of ${asOfDate}`);
}
```

### Example 5: Custom ACE Score Weights

```typescript
import { calculateAceScores, createAceInputsFromRoster } from '@/lib/ace-score';

// Emphasize war performance over donations
const warFocusedScores = calculateAceScores(aceInputs, {
  weights: {
    ova: 0.50,  // Offensive (war attacks)
    dva: 0.20,  // Defensive
    par: 0.20,  // Participation
    cap: 0.05,  // Capital
    don: 0.05   // Donations
  }
});

// Emphasize support and teamwork
const supportFocusedScores = calculateAceScores(aceInputs, {
  weights: {
    ova: 0.25,
    dva: 0.15,
    par: 0.25,
    cap: 0.15,
    don: 0.20   // Higher donation weight
  }
});
```

---

## Authentication & Authorization

### Access Levels

The system supports five access levels:

1. **Viewer**: Read-only access to roster
2. **Member**: Basic member features
3. **Elder**: Elder-specific features
4. **Co-Leader**: Advanced management features
5. **Leader**: Full administrative access

### Authentication Flow

```typescript
import { getSupabaseServerClient } from '@/lib/supabase-server';

async function checkAuth(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return { authenticated: false };
  }
  
  return {
    authenticated: true,
    user: session.user
  };
}
```

### Protected Routes

Use the `<LeadershipGuard>` component:

```tsx
import LeadershipGuard from '@/components/LeadershipGuard';

function AdminPanel() {
  return (
    <LeadershipGuard requiredRole="coleader">
      <div>Admin content here</div>
    </LeadershipGuard>
  );
}
```

---

## Rate Limiting

### Inbound Rate Limits

The API uses rate limiting to prevent abuse:

```typescript
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';

const limit = await rateLimitAllow(key, {
  windowMs: 60_000,  // 1 minute window
  max: 10            // 10 requests max
});

if (!limit.ok) {
  return new Response('Too Many Requests', {
    status: 429,
    headers: formatRateLimitHeaders(limit, 10)
  });
}
```

### Outbound Rate Limiting (CoC API)

```typescript
import { rateLimiter } from '@/lib/rate-limiter';

await rateLimiter.acquire();  // Wait for token
try {
  // Make API call
  const data = await fetchFromCoCAPI();
} finally {
  rateLimiter.release();  // Release token
}
```

---

## Error Handling

### API Response Format

All API endpoints return a consistent response format:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}
```

### Error Types

```typescript
// 400 Bad Request
{
  success: false,
  error: "Invalid clanTag format"
}

// 401 Unauthorized
{
  success: false,
  error: "Authentication required"
}

// 403 Forbidden
{
  success: false,
  error: "Insufficient permissions"
}

// 404 Not Found
{
  success: false,
  error: "Clan not found"
}

// 429 Too Many Requests
{
  success: false,
  error: "Rate limit exceeded"
}

// 500 Internal Server Error
{
  success: false,
  error: "Internal server error",
  requestId: "abc123"
}
```

### Client-Side Error Handling

```typescript
async function fetchWithErrorHandling(url: string) {
  try {
    const response = await fetch(url);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Request failed');
    }
    
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    // Handle error appropriately
    throw error;
  }
}
```

---

## Additional Resources

- [Architecture Documentation](./architecture/data-spine.md)
- [Development Guide](./development/type-safety-checklist.md)
- [Deployment Guide](../web-next/DEPLOYMENT.md)
- [Operations Guide](./operations/ingestion.md)

---

## Support & Contributing

For questions or issues:
1. Check the documentation
2. Review existing issues
3. Contact the development team

---

**Last Updated:** October 2025  
**Maintained by:** Clash Intelligence Team
