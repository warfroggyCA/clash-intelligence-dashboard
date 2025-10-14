-- Add snapshot_date column to member_snapshot_stats for weekly tournament tracking
-- This enables efficient querying of Monday snapshots (final weekly results)

BEGIN;

-- Add the snapshot_date column
ALTER TABLE member_snapshot_stats 
ADD COLUMN IF NOT EXISTS snapshot_date timestamptz;

-- Backfill snapshot_date from roster_snapshots.fetched_at
UPDATE member_snapshot_stats mss
SET snapshot_date = rs.fetched_at
FROM roster_snapshots rs
WHERE mss.snapshot_id = rs.id
  AND mss.snapshot_date IS NULL;

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS member_snapshot_stats_snapshot_date_idx 
  ON member_snapshot_stats(snapshot_date);

-- Create index for efficient Monday queries (DOW = 1)
CREATE INDEX IF NOT EXISTS member_snapshot_stats_snapshot_date_dow_idx 
  ON member_snapshot_stats((EXTRACT(DOW FROM snapshot_date)));

-- Add comment for documentation
COMMENT ON COLUMN member_snapshot_stats.snapshot_date IS 
  'Timestamp when this snapshot was captured. Used to identify Monday snapshots (DOW=1) for weekly tournament finals tracking.';

COMMIT;

