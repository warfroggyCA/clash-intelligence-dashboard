# Ingestion Operations Guide

## Manual Runs

- **CLI**: `npm run ingest:run` (optional `#CLANTAG` argument). Uses service-role credentials to run the pipeline locally.
- **HTTP**: `POST /api/admin/run-staged-ingestion` with JSON `{ "clanTag": "#TAG" }`. Include `x-api-key` header matching `ADMIN_API_KEY` (or `INGESTION_TRIGGER_KEY`). Falls back to the default home clan if `clanTag` is omitted.

## Scheduling

### GitHub Actions (recommended)

The repository ships with `.github/workflows/nightly-ingestion.yml` which triggers `/api/admin/run-staged-ingestion` at 05:00 UTC daily.

**Setup:**

1. In GitHub repository settings, add secrets:
   - `APP_BASE_URL` – e.g. `https://your-app.vercel.app`
   - `ADMIN_API_KEY` – must match the value in your deployment environment (`ADMIN_API_KEY` or `INGESTION_TRIGGER_KEY`).
2. Optionally run the workflow manually via the *Actions* tab (supports an override `clanTag` input).

### Other options

1. **Vercel Cron**: configure a scheduled request to `/api/admin/run-staged-ingestion` using the same API key.
2. **Supabase Edge Function** (optional): call the ingestion endpoint on a schedule if you prefer to keep automation within Supabase.
3. **Self-hosted cron**: run `curl -H "x-api-key: $ADMIN_API_KEY" -X POST "$APP_BASE_URL/api/admin/run-staged-ingestion"` from a server you control.

## Monitoring

- Check `ingest_logs` table for job history.
- Review Next.js logs for `[Ingestion]` entries during manual runs.
- Alerts/Errors will appear in Supabase logs and job-store entries.
- Optional: set `INGESTION_ALERT_WEBHOOK` (Slack/Teams-compatible JSON webhook) and `INGESTION_ALERT_CHANNEL` to receive failure/anomaly notifications when the nightly job trips.
- Ensure Supabase tables `members` and `member_snapshot_stats` include `tenure_days` (integer) and `tenure_as_of` (date). The staged pipeline writes these fields every run so the API/UI stay read-only.
- Extend `ingestion_jobs` with telemetry columns used by the dashboard/API:
  - `payload_version text`, `ingestion_version text`, `schema_version text`
  - `total_duration_ms bigint`, `anomalies jsonb`, `fetched_at timestamptz`, `computed_at timestamptz`
