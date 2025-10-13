# Vercel Deployment Setup - Automated Nightly Data Ingestion

## Overview
The app is configured to automatically pull Clash of Clans data every night at **3:00 AM UTC** using Vercel Cron Jobs.

## Current Configuration

### ✅ Already Configured (in codebase)
1. **Cron Job Configuration** (`vercel.json`):
   ```json
   "crons": [
     {
       "path": "/api/cron/daily-ingestion",
       "schedule": "0 3 * * *"
     }
   ]
   ```
   - Runs daily at 3 AM UTC
   - Calls `/api/cron/daily-ingestion` endpoint
   - Uses Vercel's built-in cron service

2. **Ingestion Endpoint** (`/app/api/cron/daily-ingestion/route.ts`):
   - Fetches fresh clan data from Clash of Clans API
   - Saves roster snapshot to Supabase
   - Writes member stats for historical tracking
   - Generates AI summaries and insights
   - Detects member changes (joins/leaves)
   - Protected by CRON_SECRET authentication

3. **Data Pipeline** (`/lib/ingestion/run-staged-ingestion.ts`):
   - Phase 1: Fetch clan data from CoC API
   - Phase 2: Persist roster snapshot
   - Phase 3: Write member stats (enables player history charts)
   - Phase 4: Generate insights & summaries
   - Phase 5: Detect changes & anomalies

## Required Vercel Environment Variables

### 🔐 Must Set in Vercel Dashboard

1. **CRON_SECRET**
   - Purpose: Authenticates cron job requests
   - Value: Any random secure string (e.g., use `openssl rand -base64 32`)
   - Where: Vercel Dashboard → Project Settings → Environment Variables
   - Example: `"x7k9m2p4q8r1s5t6u9v3w7y2z4a6b8c1"`

2. **COC_API_KEY** (if not already set)
   - Purpose: Clash of Clans API authentication
   - Value: Get from https://developer.clashofclans.com
   - Where: Vercel Dashboard → Project Settings → Environment Variables

3. **SUPABASE_SERVICE_ROLE_KEY** (if not already set)
   - Purpose: Database write access for ingestion
   - Value: From Supabase project settings
   - Where: Vercel Dashboard → Project Settings → Environment Variables

4. **NEXT_PUBLIC_SUPABASE_URL** (if not already set)
   - Purpose: Supabase project URL
   - Value: From Supabase project settings
   - Where: Vercel Dashboard → Project Settings → Environment Variables

## Deployment Steps

### 1. Deploy to Vercel
```bash
# Push to GitHub (assuming connected to Vercel)
git add .
git commit -m "Add nightly data ingestion"
git push origin main
```

### 2. Configure Environment Variables
Go to: **Vercel Dashboard → Project → Settings → Environment Variables**

Add the following:
- `CRON_SECRET`: `<your-random-secret>`
- `COC_API_KEY`: `<your-coc-api-key>`
- `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-key>`
- `NEXT_PUBLIC_SUPABASE_URL`: `<your-supabase-url>`

### 3. Verify Cron Job Setup
After deployment, go to:
**Vercel Dashboard → Project → Cron Jobs**

You should see:
```
✅ daily-ingestion
   Schedule: 0 3 * * * (Daily at 3:00 AM UTC)
   Path: /api/cron/daily-ingestion
   Status: Active
```

### 4. Test the Ingestion (Optional)
Trigger manually to verify it works:

```bash
curl -X POST https://your-app.vercel.app/api/cron/daily-ingestion \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "clanTag": "#2PR8R8V8P",
    "success": true,
    "ingestionResult": { ... },
    "changeSummary": "...",
    "playersResolved": 0,
    "insightsGenerated": true
  },
  "timestamp": "2025-10-13T03:00:00.000Z"
}
```

## What Happens Every Night

### 3:00 AM UTC Daily
1. ✅ **Vercel Cron** triggers `/api/cron/daily-ingestion`
2. ✅ **Fetch Data**: Gets latest clan roster from CoC API
3. ✅ **Save Snapshot**: Writes roster snapshot to Supabase `roster_snapshots` table
4. ✅ **Save Stats**: Writes individual member stats to `member_snapshot_stats` table
5. ✅ **Build History**: Each snapshot becomes a data point in player history charts
6. ✅ **Generate Insights**: AI analyzes changes and generates summaries
7. ✅ **Detect Changes**: Tracks joins, leaves, promotions, etc.

### Data Retention
- **Full snapshots**: Stored indefinitely in `roster_snapshots`
- **Member stats**: Stored indefinitely in `member_snapshot_stats`
- **Player history**: Available from Oct 6, 2025 onwards (clean data cutoff)

## Monitoring

### Check if Ingestion is Running
1. **Vercel Dashboard → Logs**
   - Filter by "cron/daily-ingestion"
   - Should see daily logs at 3 AM UTC

2. **Supabase Dashboard → Table Editor**
   - Check `roster_snapshots` table for new rows daily
   - Check `member_snapshot_stats` table for new rows daily

3. **App UI**
   - Visit player history pages
   - New data points should appear daily after 3 AM UTC

### Common Issues

**Issue**: Cron not running
- **Check**: CRON_SECRET is set in Vercel env vars
- **Check**: Vercel plan supports cron jobs (Hobby tier: 1 cron max)

**Issue**: Ingestion fails
- **Check**: COC_API_KEY is valid
- **Check**: SUPABASE_SERVICE_ROLE_KEY has write permissions
- **Check**: Vercel logs for error messages

**Issue**: No new data points
- **Check**: Clan tag is correct (#2PR8R8V8P)
- **Check**: CoC API is accessible
- **Check**: Database has space

## Timeline

- **Oct 6, 2025**: Clean data starts (ranked mode launch)
- **Oct 13, 2025**: Automated nightly ingestion configured
- **Going forward**: Daily snapshots at 3 AM UTC automatically

## Success Metrics

After deployment, you should see:
- ✅ New `roster_snapshots` row every day
- ✅ New `member_snapshot_stats` rows for each clan member daily
- ✅ Player history charts showing sequential daily data points
- ✅ No gaps in dates (consistent daily pulls)
- ✅ Smooth chart progressions (no zigzagging)

## Notes

- **No manual intervention needed**: Completely automated once deployed
- **Cost**: Vercel cron jobs are free on Pro plans, limited on Hobby
- **Timing**: 3 AM UTC chosen to avoid peak game activity
- **Redundancy**: If a nightly job fails, next night's job will continue
- **Data quality**: Oct 6+ data is reliable, pre-Oct 6 filtered out
