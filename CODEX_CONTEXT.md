# Clash Intelligence Dashboard - Codex Review Context

## Project Overview

**Clash Intelligence Dashboard** is a comprehensive clan management system for Clash of Clans, built with Next.js 14 and TypeScript. It provides real-time clan data visualization, AI-powered coaching, player analytics, and leadership tools for clan management.

### Key Features
- **Live Roster Management**: Real-time clan member data with hero tracking, rush analysis, and tenure calculation
- **AI Coaching**: OpenAI-powered insights and recommendations for clan improvement
- **Change Detection**: Daily snapshots with detailed change tracking and notifications
- **Player Database**: Comprehensive player notes, custom fields, and historical data
- **Access Control**: Role-based permissions for different clan leadership levels
- **Discord Integration**: Automated clan updates and notifications
- **Mobile-Responsive**: Modern UI with Tailwind CSS and gradient designs

## Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom gradients and animations
- **State Management**: Zustand for client-side state
- **Database**: Supabase (PostgreSQL) with file storage
- **AI**: OpenAI GPT-4 for coaching and analysis
- **Deployment**: Vercel with environment-specific configurations
- **Testing**: Jest with comprehensive test coverage

### Project Structure
```
web-next/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── roster/        # Main roster API with rate limiting
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main dashboard page
│   ├── components/            # Reusable UI components
│   │   ├── layout/            # Layout components (DashboardLayout, etc.)
│   │   ├── roster/            # Roster-specific components
│   │   └── ui/                # Base UI components
│   ├── lib/                   # Core business logic
│   │   ├── stores/            # Zustand state stores
│   │   ├── coc.ts             # Clash of Clans API integration
│   │   ├── config.ts          # Environment configuration
│   │   ├── data.ts            # Data processing utilities
│   │   └── snapshots.ts       # Snapshot and change detection
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets
├── jest.config.js             # Test configuration
└── package.json               # Dependencies and scripts
```

## Core Components

### 1. Roster API (`/api/roster/route.ts`)
**Purpose**: Main API endpoint for fetching clan roster data

**Key Features**:
- Rate-limited CoC API calls (100ms dev, 700ms prod)
- Support for both live data and snapshot mode
- Hero level extraction and TH-appropriate validation
- Tenure calculation from append-only ledger
- Comprehensive error handling and fallback mechanisms

**Rate Limiting**: Custom `CoCRateLimiter` class with:
- Configurable concurrent requests (5 dev, 3 prod)
- Minimum interval enforcement
- Queue management with proper cleanup
- Development vs production timing differences

### 2. Dashboard Store (`lib/stores/dashboard-store.ts`)
**Purpose**: Centralized state management using Zustand

**State Structure**:
```typescript
interface DashboardState {
  // Clan Data
  roster: Roster | null;
  homeClan: string;
  clanTag: string;
  
  // UI State
  activeTab: TabType;
  status: Status;
  
  // Actions
  loadRoster: (clanTag: string) => Promise<void>;
  setClanTag: (tag: string) => void;
  setActiveTab: (tab: TabType) => void;
}
```

### 3. Roster Table Component (`components/roster/RosterTable.tsx`)
**Purpose**: Main data visualization component

**Features**:
- Sortable columns (name, TH, heroes, trophies, donations, tenure)
- Pagination with configurable page sizes
- Mobile-responsive card layout
- Real-time data updates
- Hero level validation with TH-appropriate caps

### 4. Change Detection System (`lib/snapshots.ts`)
**Purpose**: Track and analyze clan changes over time

**Capabilities**:
- Daily snapshot creation with full member data
- Change detection across 15+ metrics
- AI-powered change summaries
- Activity evidence calculation
- Historical data preservation

## Data Flow

### 1. Roster Loading Process
```
User Request → Roster API → CoC API (rate limited) → Data Processing → 
Hero Extraction → Tenure Calculation → Response → Dashboard Store → UI Update
```

### 2. Change Detection Process
```
Daily Cron → Snapshot Creation → Previous Snapshot Comparison → 
Change Detection → AI Analysis → Database Storage → Notification Generation
```

### 3. AI Coaching Flow
```
Roster Data → OpenAI Analysis → Structured Advice → UI Display → 
Actionable Recommendations → Player-Specific Insights
```

## Configuration

### Environment Variables
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

### Rate Limiting Configuration
- **Development**: 100ms intervals, 5 concurrent requests
- **Production**: 700ms intervals, 3 concurrent requests
- **Fallback**: Mock data when API unavailable

## Key Business Logic

### Hero Level Validation
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

### Tenure Tracking
- Append-only JSONL ledger format
- Automatic date calculation from "as_of" timestamps
- Non-destructive historical data preservation

## Testing Strategy

### Current Test Coverage
- **Hero Extraction**: Comprehensive tests for `extractHeroLevels()` function
- **Tenure Calculation**: Full test suite for ledger processing
- **Data Validation**: Edge cases and error handling
- **Mock Data**: Development-friendly fallbacks

### Test Infrastructure
- Jest with TypeScript support
- Mock implementations for CoC API
- File system mocking for ledger operations
- Environment-specific test configurations

## Recent Changes (Commit: 224af10)

### Architecture Improvements
- **Modular Components**: Replaced 4,538-line monolith with organized component structure
- **Zustand State Management**: Centralized state with proper TypeScript typing
- **Rate Limiting**: Fixed API hammering issues with robust rate limiter
- **Error Handling**: Comprehensive error boundaries and fallback mechanisms

### Performance Optimizations
- **Concurrent Request Management**: Proper queue handling for API calls
- **Caching Strategy**: In-memory cache for CoC API responses (5min TTL)
- **Lazy Loading**: Component-level code splitting
- **Mobile Optimization**: Responsive design with touch-friendly interactions

## Current Status

### ✅ Completed
- Automatic home clan loading (`#2PR8R8V8P`)
- Fixed API rate limiting (100ms dev, 700ms prod)
- Resolved infinite request loops
- Improved UX with proper welcome messaging
- Modular architecture implementation

### 🔄 In Progress
- Comprehensive testing implementation
- Performance monitoring and optimization
- Mobile experience enhancements

### 📋 Planned
- Design system standardization
- Advanced analytics features
- Security audit and access control improvements
- Documentation completion

## Code Quality Standards

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

### Performance
- Optimized re-renders with React.memo
- Efficient state updates with Zustand
- Proper cleanup of async operations
- Memory leak prevention

## Security Considerations

### API Security
- Rate limiting to prevent abuse
- Input validation and sanitization
- Proper error handling without information leakage
- Environment variable protection

### Access Control
- Role-based permissions system
- Clan-specific data isolation
- Secure password handling
- Session management

## Deployment

### Environments
- **Development**: Local development with hot reload
- **Staging**: Vercel preview deployments
- **Production**: Vercel production with custom domain

### CI/CD Pipeline
- Automated testing on pull requests
- Environment-specific builds
- Automatic deployments on main branch
- Health checks and monitoring

---

## Review Focus Areas

When reviewing this codebase, please pay special attention to:

1. **API Rate Limiting**: The custom `CoCRateLimiter` implementation and its edge cases
2. **State Management**: Zustand store patterns and state synchronization
3. **Error Handling**: Comprehensive error boundaries and fallback mechanisms
4. **Type Safety**: TypeScript usage and interface consistency
5. **Performance**: React optimization patterns and memory management
6. **Security**: Input validation and access control implementation
7. **Testing**: Test coverage gaps and mock strategy effectiveness
8. **Code Organization**: Component structure and separation of concerns

The codebase follows modern React/Next.js best practices with a focus on maintainability, performance, and user experience.
