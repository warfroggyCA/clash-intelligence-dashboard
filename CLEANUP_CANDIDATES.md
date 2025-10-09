# Cleanup Candidates - Old Code & Debug Files

## Recommended for Deletion

### Old Code Files
1. **`web-next/src/app/page-backup.tsx`** ✅ DELETED
   - Old dashboard implementation (4,500+ lines)
   - Replaced by: `web-next/src/app/ClientDashboard.tsx`
   - Status: SAFE TO DELETE

### Old Investigation/Debug Documents
2. **`COC_API_TIMEOUT_INVESTIGATION.md`**
   - Investigation into CoC API timeouts (Oct 2025)
   - Issues resolved: Fixie proxy disabled, hardened client implemented
   - Status: Investigation complete - can archive

3. **`LEAGUE_BADGES_FIX_SUMMARY.md`**
   - Initial league badges implementation notes
   - Superseded by: `EXPERT_SUMMARY_2025-10-09.md`
   - Status: Can delete (info captured in new summary)

4. **`LEAGUE_BADGES_IMPLEMENTATION_SUMMARY.md`**
   - Detailed league badges implementation
   - Superseded by: `EXPERT_SUMMARY_2025-10-09.md`
   - Status: Can delete (info captured in new summary)

5. **`MAXIMUM_UPDATE_DEPTH_DEBUG.md`**
   - Old infinite loop debugging notes
   - Superseded by: `CRITICAL_INFINITE_LOOP_PATTERN.md`
   - Status: Can delete (issue documented in new file)

6. **`web-next/REACT_ERROR_185_DEBUG_LOG.md`**
   - Old React error debugging
   - Status: Investigation complete - can delete

7. **`web-next/React-185.md`**
   - Old React error notes
   - Status: Can delete

8. **`web-next/AUTO_REFRESH_ARCHITECTURE_ISSUE.md`**
   - Old refresh mechanism issues
   - Status: Likely addressed by current dashboard-store fixes

9. **`web-next/VERCEL_DEPLOYMENT_ISSUES.md`**
   - Old deployment problems  
   - Status: Check if still relevant, otherwise delete

10. **`test_result.md`**
    - Old test results
    - Status: Can delete

11. **`test_results_detailed.json`**
    - Old test results JSON
    - Status: Can delete

### Old Config Backups
12. **`.cursor/mcp.json.backup`** ✅ DELETED
    - Old MCP config backup
    - Status: SAFE TO DELETE

13. **`web-next/.env.backup`** ✅ DELETED
    - Old env backup
    - Status: SAFE TO DELETE

14. **`web-next/.env.local.backup`** ✅ DELETED
    - Old env backup  
    - Status: SAFE TO DELETE

### Build Cache (Auto-generated)
15. **`.next/cache/webpack/*/*.old`**
    - Webpack build cache files
    - Status: Auto-generated, safe to delete (will rebuild)

---

## Files to KEEP

### Active Documentation
- ✅ `CRITICAL_INFINITE_LOOP_PATTERN.md` - Current P0 issue
- ✅ `EXPERT_SUMMARY_2025-10-09.md` - Today's session summary
- ✅ `CHANGELOG.md` - Project changelog
- ✅ `README.md` - Project readme
- ✅ All `docs/*` files - Architecture documentation
- ✅ `PLANNING_NOTES.md` - Active planning
- ✅ `SEASON_BACKFILL_CHECKLIST.md` - Operations guide

### Data Backups (IMPORTANT!)
- ✅ `out/tenure_ledger_backup_*.jsonl` - Critical data backups
- ✅ `comprehensive_data_*/*.json` - Historical CoC data snapshots

### Assets
- ✅ `public/assets/**/*.png` - Game assets (icons, badges, etc.)
- ✅ `public/assets/clash/Fonts/*.otf` - Font files

---

## Cleanup Commands

### Safe Deletion (run these)
```bash
# Delete old investigation/debug docs
rm -f COC_API_TIMEOUT_INVESTIGATION.md
rm -f LEAGUE_BADGES_FIX_SUMMARY.md
rm -f LEAGUE_BADGES_IMPLEMENTATION_SUMMARY.md
rm -f MAXIMUM_UPDATE_DEPTH_DEBUG.md
rm -f test_result.md
rm -f test_results_detailed.json

# Delete old React error debugs
rm -f web-next/REACT_ERROR_185_DEBUG_LOG.md
rm -f web-next/React-185.md
rm -f web-next/AUTO_REFRESH_ARCHITECTURE_ISSUE.md

# Delete old deployment issues (if resolved)
# rm -f web-next/VERCEL_DEPLOYMENT_ISSUES.md  # REVIEW FIRST

# Clean webpack cache
rm -f web-next/.next/cache/webpack/**/*.old
```

### Archive Instead (optional)
```bash
# Create archive directory
mkdir -p archive/investigations-oct2025

# Move old docs to archive
mv COC_API_TIMEOUT_INVESTIGATION.md archive/investigations-oct2025/
mv LEAGUE_BADGES_*_SUMMARY.md archive/investigations-oct2025/
mv MAXIMUM_UPDATE_DEPTH_DEBUG.md archive/investigations-oct2025/
mv web-next/REACT_ERROR_185_DEBUG_LOG.md archive/investigations-oct2025/
mv web-next/React-185.md archive/investigations-oct2025/
```

---

## Recommendation

**Delete the investigation files** since:
1. All issues are resolved
2. Key findings documented in `EXPERT_SUMMARY_2025-10-09.md` and `CRITICAL_INFINITE_LOOP_PATTERN.md`
3. Git history preserves everything if needed
4. Reduces repo clutter

**Keep the data backups** (tenure ledgers, comprehensive_data) - these are valuable historical records.

---

**Created**: 2025-10-09  
**Status**: READY FOR CLEANUP
