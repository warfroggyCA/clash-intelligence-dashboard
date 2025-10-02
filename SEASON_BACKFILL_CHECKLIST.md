# 🎯 Season Backfill Execution Checklist

## Pre-Flight (5 minutes)
- [ ] **Environment**: Staging first, then production
- [ ] **Backup**: Create database backup (timestamp: __________)
- [ ] **Access**: Supabase SQL editor ready
- [ ] **Window**: Low-traffic maintenance window confirmed
- [ ] **Rollback**: Backup restoration procedure ready

## Execute (2 minutes)
- [ ] **Copy Script**: From `web-next/scripts/backfill-season-data.sql`
- [ ] **Paste & Run**: In Supabase SQL editor as single transaction
- [ ] **Watch Results**: Look for verification output at end

## Verify (3 minutes)
- [ ] **Check Results**: `rows_with_season_id = total_rows` for all tables
- [ ] **Dashboard Test**: Load dashboard, check roster summary shows season info
- [ ] **Manual Ingestion**: Run one ingestion to verify new snapshots get season data

## Log (2 minutes)
- [ ] **Record**: Date, operator, environment, results in deployment notes
- [ ] **Document**: Any issues encountered and resolutions

---

## 🚨 Emergency Rollback
If anything goes wrong:
1. **STOP** all operations immediately
2. **RESTORE** from backup (ID: __________)
3. **VERIFY** restoration successful
4. **INVESTIGATE** root cause before retry

---

## ✅ Success Criteria
- All verification queries show 100% season_id coverage
- Dashboard displays season metadata correctly
- New snapshots continue to populate season fields
- No application errors in logs

**Total Time**: ~10 minutes  
**Risk Level**: Low (only updates NULL values, atomic transaction)  
**Rollback**: Simple backup restore

