# Vercel Cron Verification Checklist

## Why Cron Hasn't Been Running

**Root Cause**: The app is running **locally/in dev**, not on Vercel production.

- ❌ Local Next.js server **does not execute cron jobs**
- ❌ `vercel.json` cron config **only works on Vercel deployments**
- ✅ `CRON_SECRET` is set locally, but Vercel isn't calling the endpoint
- ✅ Cron endpoint code exists and works (tested manually)

## Current Status

```
Environment: Local/Development (VERCEL_ENV=development)
Cron Status: ❌ Not running (needs Vercel deployment)
Data Status: 6 snapshots since Oct 1 (sporadic, manual triggers)
```

## Deployment Checklist

### ✅ Already Done (In Codebase)
- [x] Cron endpoint: `/api/cron/daily-ingestion/route.ts`
- [x] Cron schedule in `vercel.json`: `"0 3 * * *"` (3 AM daily)
- [x] Ingestion pipeline: `run-staged-ingestion.ts`
- [x] CRON_SECRET auth check
- [x] Clean data cutoff: Oct 6, 2025

### 🔲 Deployment Steps (To Do)

#### Step 1: Verify Local Environment Variables
Check `.env.local` has these set:
```bash
cd /app/web-next
cat .env.local | grep -E "CRON_SECRET|COC_API_KEY|SUPABASE"
```

You should see:
- ✅ `CRON_SECRET=<some-value>`
- ✅ `COC_API_KEY=<your-key>`
- ✅ `SUPABASE_SERVICE_ROLE_KEY=<your-key>`
- ✅ `NEXT_PUBLIC_SUPABASE_URL=<your-url>`

#### Step 2: Push to GitHub
```bash
git add .
git commit -m "Add automated nightly data ingestion with player history"
git push origin main
```

#### Step 3: Deploy to Vercel

**Option A: Vercel Dashboard** (Easiest)
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel auto-detects Next.js and `vercel.json`
5. Click "Deploy"

**Option B: Vercel CLI**
```bash
npm i -g vercel
cd /app/web-next
vercel --prod
```

#### Step 4: Set Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these (copy from your `.env.local`):

| Variable | Value | Environment |
|----------|-------|-------------|
| `CRON_SECRET` | `<your-cron-secret>` | Production, Preview, Development |
| `COC_API_KEY` | `<your-coc-key>` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `<your-supabase-key>` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `<your-supabase-url>` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<your-anon-key>` | Production, Preview, Development |
| `DEFAULT_CLAN_TAG` | `#2PR8R8V8P` | Production, Preview, Development |

**Important**: After adding env vars, click "Redeploy" to apply them.

#### Step 5: Verify Cron Job in Vercel

1. Go to: **Vercel Dashboard → Your Project → Cron Jobs**
2. You should see:
   ```
   ✅ daily-ingestion
      Schedule: 0 3 * * * (3:00 AM UTC daily)
      Path: /api/cron/daily-ingestion
      Status: Active
      Next run: [timestamp]
   ```

3. If you don't see it, check:
   - `vercel.json` is in the root of your repo
   - The `crons` array is properly formatted
   - You're on a Vercel Pro plan (Hobby has limits)

#### Step 6: Test Manually (Optional)

Trigger the cron endpoint manually to verify it works:

```bash
# Replace with your deployed URL and CRON_SECRET
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
    "ingestionResult": { ... }
  },
  "timestamp": "2025-10-13T..."
}
```

## How to Know It's Working

### Next Day (Oct 14)
1. **Check Vercel Logs**:
   - Go to: Vercel Dashboard → Your Project → Logs
   - Filter: "cron/daily-ingestion"
   - Should see a log entry around 3 AM UTC

2. **Check Supabase**:
   - Go to: Supabase Dashboard → Table Editor → `roster_snapshots`
   - Should see a new row with `fetched_at` around Oct 14, 3 AM UTC

3. **Check App UI**:
   - Visit: `https://your-app.vercel.app/player/VGQVRLRL/history`
   - Should see Oct 14 data point in charts

### Week Later (Oct 20)
- Should have 7 consecutive daily data points
- Charts should show smooth progression
- No gaps in dates

## Troubleshooting

### ❌ Cron Not Showing in Vercel Dashboard
**Cause**: `vercel.json` not detected or malformed
**Fix**: 
- Ensure `vercel.json` is in repo root (not `/app/web-next/`)
- Validate JSON syntax
- Redeploy

### ❌ Cron Runs But Returns 401 Unauthorized
**Cause**: `CRON_SECRET` mismatch
**Fix**: 
- Check Vercel env vars match your secret
- Redeploy after changing env vars

### ❌ Cron Runs But Ingestion Fails
**Cause**: Missing/invalid API keys
**Fix**:
- Check `COC_API_KEY` is valid
- Check `SUPABASE_SERVICE_ROLE_KEY` has write permissions
- Check Vercel function logs for error details

### ❌ Cron Shows But Doesn't Run
**Cause**: Vercel plan limitations
**Fix**:
- Hobby plan: 1 cron job (should work)
- If issues persist, check Vercel status page

## Expected Timeline

| Day | Data Points | Status |
|-----|-------------|--------|
| Today (Oct 13) | 3 (Oct 9, 12, 13) | Manual snapshots |
| Oct 14 | 4 | First auto cron run ✅ |
| Oct 20 | 10 | Week of daily data |
| Oct 27 | 17 | 2 weeks of data |
| Nov 13 | 34 | Full month ✅ |

## Success Criteria

After deployment, you should see:

✅ **Vercel Dashboard**: Cron job listed as "Active"
✅ **Vercel Logs**: Daily execution logs at 3 AM UTC
✅ **Supabase**: New rows in `roster_snapshots` daily
✅ **App UI**: Sequential data points in player history charts
✅ **No Manual Intervention**: Completely hands-off

## Local Testing (Development Only)

If you need to test locally before deploying:

```bash
cd /app/web-next
./test-local-cron.sh
```

This simulates what Vercel cron does, but you'd need to set up a system cron to run it daily.

**Note**: This is NOT recommended for production. Deploy to Vercel instead.

---

## Summary

**Current State**: ❌ Not working (running locally, cron doesn't trigger)
**After Deployment**: ✅ Will work automatically (Vercel handles scheduling)
**Action Required**: Deploy to Vercel + set env vars
**Time to First Auto Run**: Tonight at 3 AM UTC after deployment
