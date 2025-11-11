# Mac-Based Multi-Clan Tracking Plan

## Overview

Extend Mac-based ingestion to support multiple clans. Mac ingests all tracked clans directly from CoC API (no Fixie) and writes to Supabase. UI allows leaders to manage tracked clans. Vercel cron remains as backup for home clan.

## Phase 1: Multi-Clan Infrastructure ✅ COMPLETE

### 1. Tracked Clans Configuration ✅

- **File**: `web-next/scripts/tracked-clans.json`
- JSON file storing list of clan tags to track
- Default: Contains home clan only
- Managed via API endpoint

### 2. API Endpoint for Tracked Clans ✅

- **File**: `web-next/src/app/api/tracked-clans/route.ts`
- **GET** `/api/tracked-clans` - Fetch list of tracked clans
- **POST** `/api/tracked-clans` - Add a clan to tracking
- **DELETE** `/api/tracked-clans?clanTag=#TAG` - Remove a clan from tracking
- Leader-only access (requires authentication)
- Reads/writes `tracked-clans.json`

### 3. UI Component for Managing Tracked Clans ✅

- **File**: `web-next/src/components/settings/SettingsContent.tsx`
- **Component**: `TrackedClansManager`
- Location: Settings → Multi-Clan Tracking section
- Features:
  - View all tracked clans
  - Add new clan tag
  - Remove clan from tracking
  - Real-time updates
  - Shows count of tracked clans

### 4. Update Mac Ingestion Script ✅

- **File**: `web-next/scripts/mac-ingestion.ts`
- Already supports `--all` flag to ingest all tracked clans
- Reads `tracked-clans.json` via `loadTrackedClans()`
- Processes each clan sequentially
- Handles errors per clan (one failure doesn't stop others)
- Logs results per clan

### 5. Update Mac Cron Job ✅

- **File**: `web-next/scripts/com.clashintelligence.ingestion.plist`
- Updated `ProgramArguments` to include `--all` flag
- Now ingests all clans in `tracked-clans.json`
- Runs daily at 4:30 AM UTC and 5:30 AM UTC
- Setup script handles `--all` flag correctly

### 6. Update Setup Script ✅

- **File**: `web-next/scripts/setup-mac-ingestion.sh`
- Ensures `--all` flag is present in LaunchAgent
- Handles both direct tsx and npx scenarios

## Current Status

### ✅ Completed

1. **API Endpoint** - `/api/tracked-clans` with GET/POST/DELETE
2. **UI Component** - TrackedClansManager in Settings
3. **Mac Script** - Already supports `--all` flag
4. **Cron Job** - Updated to use `--all` flag
5. **Setup Script** - Handles `--all` flag correctly

### ⏳ Next Steps

1. **Re-run Setup** - User needs to run `npm run ingest:mac:setup` to update LaunchAgent
2. **Add Clans** - Use Settings UI to add additional clans to track
3. **Monitor** - Check logs and Supabase to verify all clans are being ingested
4. **Clan Switcher** (Optional) - Add quick switcher in header for tracked clans

## Usage

### Adding a Clan to Tracking

1. Go to Settings → Multi-Clan Tracking
2. Enter clan tag (e.g., `#ABC123`)
3. Click "Add Clan"
4. Clan is added to `tracked-clans.json`
5. Mac cron will ingest it on next run

### Removing a Clan from Tracking

1. Go to Settings → Multi-Clan Tracking
2. Find clan in list
3. Click X button next to clan tag
4. Clan is removed from `tracked-clans.json`
5. Mac cron will skip it on next run

### Manual Ingestion

```bash
# Ingest all tracked clans
npm run ingest:mac:all

# Ingest specific clan
npm run ingest:mac -- #ABC123

# Ingest home clan only
npm run ingest:mac
```

## Architecture

```
Mac Cron (4:30 AM & 5:30 AM UTC)
    ↓
Reads tracked-clans.json
    ↓
For each clan:
    ↓
Calls CoC API (direct, no Fixie)
    ↓
Writes to Supabase
    ↓
All clans ingested daily
```

## Benefits

- ✅ **No Fixie Costs** - Direct API calls from Mac (fixed IP)
- ✅ **Multi-Clan Support** - Track unlimited clans
- ✅ **Easy Management** - UI-based clan management
- ✅ **Vercel Backup** - Home clan still has Vercel cron as backup
- ✅ **Production Access** - All data accessible from production site
- ✅ **Centralized Storage** - All clans write to same Supabase instance

## Files Created/Modified

### New Files
- `web-next/src/app/api/tracked-clans/route.ts` - API endpoint
- `MAC_BASED_MULTI_CLAN_PLAN.md` - This plan document

### Modified Files
- `web-next/src/components/settings/SettingsContent.tsx` - Added TrackedClansManager component
- `web-next/scripts/com.clashintelligence.ingestion.plist` - Added `--all` flag
- `web-next/scripts/setup-mac-ingestion.sh` - Handles `--all` flag

### Existing Files (Already Supported)
- `web-next/scripts/mac-ingestion.ts` - Already supports `--all` flag
- `web-next/scripts/tracked-clans.json` - Already exists

## Testing Checklist

- [ ] Re-run `npm run ingest:mac:setup` to update LaunchAgent
- [ ] Add a test clan via Settings UI
- [ ] Verify `tracked-clans.json` is updated
- [ ] Run manual ingestion: `npm run ingest:mac:all`
- [ ] Verify both clans are ingested
- [ ] Check Supabase for data from both clans
- [ ] Verify Vercel app shows data from both clans
- [ ] Monitor Mac cron logs for 2-3 days
- [ ] Verify all tracked clans are ingested daily

## Future Enhancements

### Phase 2: Enhanced Multi-Clan Features

1. **Clan Switcher in Header**
   - Quick dropdown to switch between tracked clans
   - Shows clan name and last update time
   - Persists selection in localStorage

2. **Ingestion Status Dashboard**
   - Show status for each tracked clan
   - Last ingestion time per clan
   - Success/failure indicators
   - Link to logs

3. **Cross-Clan Analytics**
   - Compare metrics across clans
   - Member movement tracking
   - Performance benchmarking

4. **Clan-Specific Settings**
   - Per-clan configuration
   - Custom ingestion schedules
   - Alert thresholds

## Notes

- Vercel cron remains active for home clan as backup
- Mac cron handles all tracked clans (including home clan)
- Both systems write to same Supabase instance
- Ingestion logic handles duplicate runs gracefully
- All tracked clans share same data freshness

