# 🚨 CRITICAL: Vercel Cron Job Setup

## THE PROBLEM (FIXED)
**Vercel cron jobs were SILENTLY FAILING because the endpoint only had a POST handler, but Vercel sends GET requests!**

## Current Configuration

### 1. Cron Schedule (vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-ingestion",
      "schedule": "30 4 * * *"
    }
  ]
}
```
- **Runs daily at 4:30 AM UTC**
- **Strategic timing**: Captures data 30 minutes before the weekly Ranked League reset (5:00 AM UTC Tuesday)
- **Monday snapshots** represent final weekly tournament results before reset
- **Production only** (Vercel cron jobs do NOT run on preview deployments)

### 2. API Endpoint
- **Location**: `web-next/src/app/api/cron/daily-ingestion/route.ts`
- **HTTP Method**: `GET` (Vercel cron jobs use GET, NOT POST!)
- **Authentication**: Bearer token via `Authorization` header

### 3. Environment Variable (CRITICAL!)
You **MUST** set this in Vercel's Environment Variables:

```
CRON_SECRET=my-clash-cron-secret-2025
```

**Steps to set in Vercel:**
1. Go to your project dashboard
2. Settings → Environment Variables
3. Add: `CRON_SECRET` = `my-clash-cron-secret-2025`
4. **IMPORTANT**: Select "Production" environment
5. Save and redeploy

### 4. Deployment Requirements
⚠️ **Cron jobs ONLY work on production deployments!**

To activate cron:
```bash
vercel deploy --prod
```

Or push to main branch (if auto-deploy is enabled).

## How Vercel Cron Works

1. **Vercel's cron service** makes a GET request to your endpoint at the scheduled time
2. **Authorization header** is automatically included: `Bearer my-clash-cron-secret-2025`
3. Your endpoint validates the token and runs the ingestion job
4. Results are logged in Vercel's function logs

## Testing the Endpoint

### Option 1: Manual Test via Browser/Postman
```bash
curl -X GET "https://your-app.vercel.app/api/cron/daily-ingestion" \
  -H "Authorization: Bearer my-clash-cron-secret-2025"
```

### Option 2: Test Locally
```bash
# Set environment variable
export CRON_SECRET=my-clash-cron-secret-2025

# Start dev server
npm run dev

# In another terminal
curl -X GET "http://localhost:3000/api/cron/daily-ingestion" \
  -H "Authorization: Bearer my-clash-cron-secret-2025"
```

## Expected Response

### Success:
```json
{
  "success": true,
  "data": {
    "snapshotId": "abc123",
    "membersProcessed": 42,
    "changesDetected": 5
  },
  "timestamp": "2025-01-15T03:00:00.000Z"
}
```

### Failure:
```json
{
  "success": false,
  "error": "Database connection failed",
  "timestamp": "2025-01-15T03:00:00.000Z"
}
```

## Monitoring Cron Execution

### View Logs in Vercel
1. Go to your project dashboard
2. Deployments → Select production deployment
3. Functions → Look for logs starting with `[Cron]`

### Look for these log messages:
- ✅ `[Cron] Starting daily ingestion job at 2025-01-15T04:30:00.000Z`
- ✅ `[Cron] Daily ingestion completed successfully`
- ❌ `[Cron] Daily ingestion FAILED`
- ❌ `[Cron] Unauthorized access attempt`

## Troubleshooting

### Cron not running?
1. ✅ Is `CRON_SECRET` set in Vercel environment variables?
2. ✅ Is the app deployed to **production**?
3. ✅ Is the endpoint using `GET` method (not POST)?
4. ✅ Is the schedule correct? (Use https://crontab.guru to verify)

### Getting 401 Unauthorized?
- Check that `CRON_SECRET` matches exactly in both:
  - Vercel environment variables
  - Your local `.env.local` (for testing)

### Getting 404 Not Found?
- Verify the path in `vercel.json` matches your route file location
- Path: `/api/cron/daily-ingestion`
- File: `src/app/api/cron/daily-ingestion/route.ts`

### Cron runs but ingestion fails?
- Check Supabase credentials are set
- Check CoC API key is set
- Review function logs for specific error messages

## Critical Files

1. **Cron configuration**: `web-next/vercel.json`
2. **Cron endpoint**: `web-next/src/app/api/cron/daily-ingestion/route.ts`
3. **Ingestion logic**: `web-next/src/lib/ingestion/run-staged-ingestion.ts`
4. **Environment template**: `web-next/env.example`

## Additional Notes

- **Timezone**: All cron schedules are in UTC
- **Weekly Reset Timing**: Ranked League tournaments reset Tuesday 5:00 AM UTC
  - Cron at 4:30 AM captures final weekly results (30-minute buffer)
  - Monday snapshots can be used for weekly performance tracking
- **Timeout**: Max execution time is 60 seconds (configured in vercel.json)
- **Memory**: 1024 MB allocated (configured in vercel.json)
- **Retries**: Vercel does NOT automatically retry failed cron jobs
- **Rate limits**: Be mindful of Clash of Clans API rate limits

## Next Steps

1. ✅ Fix applied: Changed POST to GET in endpoint
2. ✅ Timing optimized: Changed from 3:00 AM to 4:30 AM UTC
3. 🔄 Deploy to production: `vercel deploy --prod`
4. 🔄 Verify CRON_SECRET is set in Vercel
5. 🔄 Wait for next scheduled run (4:30 AM UTC)
6. 🔄 Check logs to confirm successful execution

---

**Last Updated**: 2025-01-14  
**Status**: OPTIMIZED for weekly Ranked League tracking

