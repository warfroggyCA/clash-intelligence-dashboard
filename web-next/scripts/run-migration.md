# Pipeline Schema Migration Instructions

## Step 1: Apply the Migration

1. Go to your Supabase dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20250115_pipeline_schema_upgrade.sql`
3. Run the migration
4. Verify no errors occurred

## Step 2: Backfill Existing Data

1. In the same SQL Editor, copy and paste the contents of `scripts/backfill-new-columns.sql`
2. Run the backfill script
3. Check the output for row counts to ensure data was populated

## Step 3: Verify the Migration

1. Copy and paste the contents of `scripts/verify-migration.sql`
2. Run the verification script
3. Ensure all checks show ✓ status and reasonable row counts

## Expected Results

After successful migration and backfill:

- `members` table should have new columns populated with league/trophy data
- `roster_snapshots` should have version metadata
- `member_snapshot_stats` should have new league columns
- `ingest_logs` should support phase telemetry
- New indexes should be created for performance

## Troubleshooting

If you encounter issues:

1. Check that the tables exist first: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
2. Verify column names match your existing schema
3. Check for any naming conflicts with existing columns
4. Ensure you have proper permissions to alter tables

## Next Steps

Once migration is complete:
1. Test the new v2 roster API endpoint
2. Verify the data-spine-roster mapper works with new columns
3. Begin refactoring ingestion pipeline into staged phases
