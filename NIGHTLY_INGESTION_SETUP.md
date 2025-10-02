# Nightly Ingestion Setup Guide

This guide covers the remaining tasks to complete the nightly ingestion automation with tenure tracking and alerting.

## ✅ Completed Tasks

1. **Supabase Migration**: Created migration `20250115_add_tenure_columns.sql` to add:
   - `tenure_days` (integer, default 0) to `members` and `member_snapshot_stats` tables
   - `tenure_as_of` (date) to `members` and `member_snapshot_stats` tables
   - Appropriate indexes for tenure queries

## 🔧 Remaining Tasks

### 1. Apply Supabase Migration

The migration file has been created at `supabase/migrations/20250115_add_tenure_columns.sql`. You need to apply it to your Supabase database:

```sql
-- Run this in your Supabase SQL editor
-- Add tenure tracking columns to members and member_snapshot_stats tables
-- This migration adds tenure_days and tenure_as_of columns to support
-- the tenure pipeline that reads from the tenure_ledger and persists
-- calculated tenure values in Supabase

begin;

-- Add tenure columns to members table
alter table public.members
  add column if not exists tenure_days integer default 0,
  add column if not exists tenure_as_of date;

-- Add tenure columns to member_snapshot_stats table  
alter table public.member_snapshot_stats
  add column if not exists tenure_days integer default 0,
  add column if not exists tenure_as_of date;

-- Create indexes for tenure queries
create index if not exists members_tenure_days_idx on public.members (tenure_days);
create index if not exists members_tenure_as_of_idx on public.members (tenure_as_of);
create index if not exists member_snapshot_stats_tenure_days_idx on public.member_snapshot_stats (tenure_days);
create index if not exists member_snapshot_stats_tenure_as_of_idx on public.member_snapshot_stats (tenure_as_of);

-- Add comments for documentation
comment on column public.members.tenure_days is 'Number of days the member has been in the clan, calculated from tenure_ledger';
comment on column public.members.tenure_as_of is 'Date when tenure_days was last calculated';
comment on column public.member_snapshot_stats.tenure_days is 'Number of days the member had been in the clan at the time of this snapshot';
comment on column public.member_snapshot_stats.tenure_as_of is 'Date when tenure_days was calculated for this snapshot';

commit;
```

### 2. Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:

**Required Secrets:**
- `APP_BASE_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
- `ADMIN_API_KEY`: The same value as your deployment's `ADMIN_API_KEY` environment variable

**Optional Secrets (for alerting):**
- `INGESTION_ALERT_WEBHOOK`: Webhook URL for Slack/Teams notifications
- `INGESTION_ALERT_CHANNEL`: Channel name for notifications

### 3. Test the Nightly Workflow

1. **Manual Test**: Go to Actions → "Nightly Clan Ingestion" → "Run workflow" to test manually
2. **Health Check**: After running, verify the ingestion worked:
   ```bash
   curl "https://your-app.vercel.app/api/ingestion/health?clanTag=#YOUR_CLAN_TAG"
   ```
3. **Database Verification**: Check Supabase for:
   - New rows in `ingestion_jobs` table
   - Updated `tenure_days` and `tenure_as_of` columns in `members` and `member_snapshot_stats`
   - Alert notifications (if configured)

### 4. Verify Tenure Data Population

After the first successful run, check that tenure data is populated:

```sql
-- Check members with tenure data
SELECT tag, name, tenure_days, tenure_as_of 
FROM public.members 
WHERE tenure_days > 0 
ORDER BY tenure_days DESC;

-- Check snapshot stats with tenure data
SELECT m.tag, m.name, mss.tenure_days, mss.tenure_as_of, rs.fetched_at
FROM public.member_snapshot_stats mss
JOIN public.members m ON mss.member_id = m.id
JOIN public.roster_snapshots rs ON mss.snapshot_id = rs.id
WHERE mss.tenure_days > 0
ORDER BY rs.fetched_at DESC, mss.tenure_days DESC;
```

## 🔍 Monitoring & Troubleshooting

### Health Endpoint
The ingestion health endpoint provides detailed status:
- **URL**: `/api/ingestion/health?clanTag=#YOUR_CLAN_TAG`
- **Response**: Job status, phase summaries, anomalies, and timing information

### Common Issues

1. **Migration Fails**: Ensure you have the correct permissions in Supabase
2. **Secrets Missing**: Verify all required secrets are set in GitHub
3. **API Key Mismatch**: Ensure `ADMIN_API_KEY` matches between GitHub and deployment
4. **Tenure Not Populating**: Check that the tenure pipeline is reading from `tenure_ledger` correctly

### Alerting Setup (Optional)

If you want notifications for ingestion failures or anomalies:

1. **Slack**: Create a webhook URL in your Slack workspace
2. **Teams**: Create a webhook URL in your Teams channel
3. **Set Secrets**: Add `INGESTION_ALERT_WEBHOOK` and `INGESTION_ALERT_CHANNEL` to GitHub secrets

## 🚀 Final Verification

Once all tasks are complete:

1. ✅ Migration applied to Supabase
2. ✅ GitHub secrets configured
3. ✅ Manual workflow test successful
4. ✅ Health endpoint shows successful ingestion
5. ✅ Tenure data populated in database
6. ✅ Alerting working (if configured)

The nightly ingestion will then run automatically at 05:00 UTC daily, with tenure tracking and optional alerting fully operational.
