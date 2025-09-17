# 🚀 Deployment Guide - Clash Intelligence Dashboard

## Environment Setup

### 1. Local Development
```bash
# Install dependencies
npm install

# Copy environment template
cp env.example .env.local

# Edit .env.local with your actual values
nano .env.local

# Check environment variables
npm run env:check

# Start development server
npm run dev
```

### 2. Vercel Environments

#### Development (Local)
- **URL**: `http://localhost:5050`
- **Environment**: `development`
- **Database**: Uses your local Supabase instance
- **Purpose**: Feature development and testing

#### Staging (Preview)
- **URL**: `https://clash-intelligence-git-[branch]-yourusername.vercel.app`
- **Environment**: `preview`
- **Database**: Staging Supabase project
- **Purpose**: Integration testing and client review

#### Production
- **URL**: `https://clash-intelligence.vercel.app`
- **Environment**: `production`
- **Database**: Production Supabase project
- **Purpose**: Live application

## Deployment Workflow

### Step 1: Development
```bash
# Create feature branch
git checkout -b feature/leadership-access-control

# Make changes
# Test locally
npm run dev
npm run env:check

# Commit changes
git add .
git commit -m "feat: add leadership access control system"
```

### Step 2: Staging Deployment
```bash
# Push to staging branch
git checkout staging
git merge feature/leadership-access-control
git push origin staging

# Deploy to staging
npm run deploy:staging

# Test staging environment
# Verify all features work correctly
```

### Step 3: Production Deployment
```bash
# Merge to main branch
git checkout main
git merge staging
git push origin main

# Deploy to production
npm run deploy:prod

# Verify production deployment
```

## Environment Variables

### Required Variables
- `COC_API_KEY`: Clash of Clans API key
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key for AI summaries

### Optional Variables
- `DEFAULT_CLAN_TAG`: Default clan tag (default: #2PR8R8V8P)
- `DEV_MODE`: Enable development features (default: false)
- `ENABLE_DEBUG_LOGGING`: Enable debug logging (default: false)

### Data Source Configuration
- `USE_LOCAL_DATA`: Use local files for development (default: true in dev)
- `MOCK_API_CALLS`: Mock API calls for testing (default: false)
- `USE_TEST_DATA`: Use test data instead of real data (default: false)

## Data Flow Strategy

### 🏠 **Local Development**
- **Data Source**: Local files (`../out/` and `../data/`)
- **Database**: None (uses local JSON files)
- **Purpose**: Safe development without affecting live data
- **Configuration**: `USE_LOCAL_DATA=true`

### 🧪 **Staging Environment**
- **Data Source**: Supabase (staging project)
- **Database**: Separate Supabase project for staging
- **Purpose**: Integration testing with real database
- **Configuration**: `VERCEL_ENV=preview`

### 🚀 **Production Environment**
- **Data Source**: Supabase (production project)
- **Database**: Production Supabase project
- **Purpose**: Live application with real data
- **Configuration**: `VERCEL_ENV=production`

**Key Benefits**:
- ✅ **No data loss risk** - local development uses local files
- ✅ **Data preservation** - production data never touched during development
- ✅ **Safe testing** - staging uses separate database
- ✅ **Easy rollback** - each environment is isolated

See `DATA_FLOW.md` for complete data flow documentation.

## Vercel Configuration

### Environment Variables in Vercel
1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add variables for each environment:
   - **Development**: Use your test API keys
   - **Preview**: Use staging API keys
   - **Production**: Use production API keys

### Branch Configuration
- **Production**: `main` branch
- **Preview**: `staging` branch
- **Development**: Any other branch

## Safety Checklist

### Before Deploying to Production
- [ ] All tests pass locally
- [ ] Staging environment tested thoroughly
- [ ] Environment variables configured correctly
- [ ] Database migrations applied (if any)
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Performance optimized

### Rollback Plan
If production deployment fails:
1. Revert to previous commit
2. Force push to main branch
3. Vercel will automatically redeploy

## Insights Deployment Troubleshooting

During the AI → Insights terminology migration we uncovered several landmines. Use this section as a pre-flight checklist to keep future promotions painless.

### 1. Date/Time Formatting
- **Incident**: `date-fns` threw `RangeError: Format string contains an unescaped latin alphabet character 'U'` because `"UTC"` wasn’t escaped.
- **Prevention**:
  - Escape literals in `format()` (e.g. `format(date, "HH:mm 'UTC'")`).
  - Route all `toLocale*` usage through the helpers in `lib/date.ts`.
  - Run `rg "toLocale" src` before merging to ensure new calls use the helpers.

### 2. Build-Time Environment Variables
- **Incident**: Vercel builds failed with `supabaseUrl is required` when env vars were absent at compile time.
- **Prevention**:
  - Instantiate Supabase/OpenAI clients only when both URL and key exist.
  - Guard every call with `if (!client) throw new Error('Missing …')` so failures surface fast.
  - Execute `npm run env:check` locally and in CI before deploying.

### 3. TypeScript Object Spread Bugs
- **Incident**: Duplicated properties while spreading API responses caused `TS2783` build failures.
- **Prevention**:
  - Avoid re-stating keys already included in spread objects; destructure first if needed.
  - Keep `noDuplicateObjectKeys` enabled and run `npm run lint` prior to push.

### 4. Supabase Schema Drift
- **Incident**: Missing tables (`clan_snapshots`, `batch_ai_results`, `player_dna_cache`) disabled automated insights with only quiet failures.
- **Prevention**:
  - Apply `supabase-schema.sql` (or migrations) before first deploy to any environment.
  - Add a smoke test that hits `/api/ai/batch-results` and `/api/ai/dna-cache` to confirm tables exist.
  - Keep schema diffs in PRs; don’t rely on manual UI changes.

### 5. Vercel Project Linking & ESLint
- **Incident**: `vercel` CLI searched in a non-existent `web-next/web-next` path; ESLint also blocked builds.
- **Prevention**:
  - From within `web-next/`, run `vercel link --yes --project clash-intelligence-new` on every fresh workstation.
  - If ESLint versioning breaks builds, temporarily set `eslint: { ignoreDuringBuilds: true }` but create a follow-up ticket to restore linting.

### 6. Static Asset Case Sensitivity
- **Incident**: Clan logo requests (e.g. `/clans/2pr8r8v8p.png`) 404’d because macOS ignored case.
- **Prevention**:
  - Store assets in lower-case paths (e.g. `public/clans/2pr8r8v8p.png`).
  - Add a simple CI script that fetches representative assets to catch casing issues early.

### 7. Terminology Consistency
- **Incident**: UI, permissions, and API payloads still referenced “AI” which confused users and broke lookups.
- **Prevention**:
  - After renaming, run `rg "AI" src` to ensure only intended references remain.
  - Update types/permissions (`canGenerateCoachingInsights`, `InsightsBundle`, etc.) before tweaking UI copy.

Keep this section current—append new lessons learned after each promotion so the next deployment is smoother than the last.

## Troubleshooting

### Common Issues
1. **Environment variables not loading**: Check Vercel environment settings
2. **Build failures**: Check build logs in Vercel dashboard
3. **API errors**: Verify API keys and endpoints
4. **Database connection issues**: Check Supabase configuration

### Debug Commands
```bash
# Check environment variables
npm run env:check

# Test build locally
npm run build

# Test production build
npm run build:staging
```

## Best Practices

1. **Never develop directly in production**
2. **Always test in staging first**
3. **Use feature branches for new development**
4. **Keep environment variables secure**
5. **Monitor deployment logs**
6. **Have a rollback plan ready**

## Emergency Procedures

### If Production is Down
1. Check Vercel dashboard for errors
2. Check Supabase dashboard for database issues
3. Check API key validity
4. Rollback to last known good commit if necessary

### Contact Information
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Supabase Support**: [supabase.com/support](https://supabase.com/support)
- **Project Owner**: [Your contact info]
