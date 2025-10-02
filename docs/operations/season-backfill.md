# Season Backfill Operations Guide

## Overview

This guide covers the safe execution of season data backfill for existing snapshots and metrics in the Clash Intelligence database. The backfill adds season metadata (`season_id`, `season_start`, `season_end`) to historical data to align with the new season-aware schema.

## Pre-Execution Checklist

### ✅ Environment Preparation
- [ ] **Target Environment Confirmed**: Staging first, then production
- [ ] **Database Backup Created**: Full backup before any changes
- [ ] **No Concurrent Operations**: Ensure no other migrations or manual writes
- [ ] **Maintenance Window**: Schedule during low-traffic period
- [ ] **Rollback Plan**: Backup restoration procedure ready

### ✅ Access Verification
- [ ] **Supabase Access**: SQL editor or psql connection verified
- [ ] **Permissions**: Confirm write access to target tables
- [ ] **Network**: Stable connection to avoid transaction interruption

## Execution Steps

### 1. Environment Verification
```sql
-- Check current state before backfill
SELECT 
  'roster_snapshots' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id
FROM public.roster_snapshots
UNION ALL
SELECT 
  'member_snapshot_stats' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id
FROM public.member_snapshot_stats
UNION ALL
SELECT 
  'metrics' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id
FROM public.metrics;
```

### 2. Execute Backfill Script
```bash
# Copy the script from web-next/scripts/backfill-season-data.sql
# Execute in Supabase SQL Editor as a single transaction
```

**Script Location**: `web-next/scripts/backfill-season-data.sql`

**Key Features**:
- ✅ **Atomic Transaction**: All changes in single `BEGIN/COMMIT`
- ✅ **Safe Updates**: Only updates `NULL` values (`WHERE season_id IS NULL`)
- ✅ **Season Logic**: 05:00 UTC start, 04:59:59 UTC end (Clash reset times)
- ✅ **Auto Cleanup**: Removes temporary function after use
- ✅ **Built-in Verification**: Includes verification queries

### 3. Verification
The script automatically runs verification queries. Expected results:
```
table_name            | total_rows | rows_with_season_id | rows_with_season_start | rows_with_season_end
roster_snapshots     |      X      |         X           |          X             |         X
member_snapshot_stats|      Y      |         Y           |       null             |       null  
metrics              |      Z      |         Z           |       null             |       null
```

**Success Criteria**: `rows_with_season_id = total_rows` for all tables

### 4. Application Verification
- [ ] **Dashboard Load**: Confirm season metadata appears in roster summary
- [ ] **Manual Ingestion**: Test that new snapshots populate season fields
- [ ] **UI Elements**: Verify season information displays correctly

## Rollback Procedure

### If Issues Occur
1. **Immediate**: Stop any running operations
2. **Restore Backup**: Use the pre-execution backup
3. **Verify Restoration**: Confirm all data restored correctly
4. **Investigate**: Identify root cause before retry

### Safe Retry
- ✅ **Rerun Safe**: Script only updates `NULL` values
- ✅ **Idempotent**: Multiple runs won't cause issues
- ✅ **Incremental**: Can be run again after fixing issues

## Season Logic Details

### Season Boundaries
- **Start**: 1st of month at 05:00 UTC (Clash reset time)
- **End**: 1st of next month at 04:59:59 UTC
- **Format**: `YYYY-MM` (e.g., `2025-01`)

### Example Season Calculation
```sql
-- January 2025 season
season_id: '2025-01'
season_start: '2025-01-01 05:00:00+00'
season_end: '2025-02-01 04:59:59+00'

-- December 2025 season  
season_id: '2025-12'
season_start: '2025-12-01 05:00:00+00'
season_end: '2026-01-01 04:59:59+00'
```

## Tables Affected

### `public.roster_snapshots`
- **Columns**: `season_id`, `season_start`, `season_end`
- **Source**: `fetched_at` timestamp
- **Update**: Direct calculation from snapshot timestamp

### `public.member_snapshot_stats`
- **Columns**: `season_id`
- **Source**: Parent snapshot's season data
- **Update**: Inherited from `roster_snapshots.season_id`

### `public.metrics`
- **Columns**: `season_id`
- **Logic**: Set to `'latest'` for current metrics
- **Update**: Only for `metric_window = 'latest'`

## Logging & Documentation

### Required Documentation
- [ ] **Execution Date**: When backfill was performed
- [ ] **Operator**: Who executed the backfill
- [ ] **Environment**: Staging/Production
- [ ] **Results**: Verification query results
- [ ] **Issues**: Any problems encountered and resolutions

### Log Entry Template
```
Season Backfill Execution Log
============================
Date: YYYY-MM-DD HH:MM:SS UTC
Operator: [Name]
Environment: [staging/production]
Backup Created: [backup-id/timestamp]
Tables Updated:
- roster_snapshots: X rows updated
- member_snapshot_stats: Y rows updated  
- metrics: Z rows updated
Verification: ✅ All rows have season_id
Issues: [None/Description]
```

## Troubleshooting

### Common Issues

#### Verification Fails
```sql
-- Check for any remaining NULL values
SELECT COUNT(*) FROM public.roster_snapshots WHERE season_id IS NULL;
SELECT COUNT(*) FROM public.member_snapshot_stats WHERE season_id IS NULL;
SELECT COUNT(*) FROM public.metrics WHERE season_id IS NULL;
```

#### Partial Updates
- **Cause**: Transaction interrupted or permission issues
- **Solution**: Rerun script (safe to retry)

#### Wrong Season Values
- **Cause**: Incorrect timestamp parsing
- **Solution**: Check `fetched_at` values, restore backup if needed

### Emergency Contacts
- **Database Admin**: [Contact Info]
- **Backup Restoration**: [Procedure]
- **Application Team**: [Contact Info]

## Post-Execution

### Monitoring
- [ ] **Watch Dashboard**: Monitor for any season-related errors
- [ ] **Check Logs**: Review application logs for issues
- [ ] **Verify Features**: Test season-aware functionality

### Next Steps
- [ ] **Production Deployment**: If staging successful
- [ ] **Documentation Update**: Update any relevant docs
- [ ] **Team Notification**: Inform stakeholders of completion

---

**Last Updated**: 2025-01-15  
**Version**: 1.0  
**Status**: Ready for Execution