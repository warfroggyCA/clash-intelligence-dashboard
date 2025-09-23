# Ingestion Operations Guide

## Manual Runs

- **CLI**: `npm run ingest:run` (optional `#CLANTAG` argument). Uses service-role credentials to run the pipeline locally.
- **HTTP**: `POST /api/admin/run-ingestion` with JSON `{ "clanTag": "#TAG" }`. Include `x-api-key` header matching `ADMIN_API_KEY` (if set).

## Scheduling

1. **Vercel Cron**: Configure a cron job to call `/api/admin/run-ingestion` daily (e.g., `0 6 * * *`).
2. **Supabase Scheduled Function** (optional): create an Edge Function that calls the same endpoint.
3. Set `INGESTION_CRON` for self-hosted node-cron via `ensureIngestionSchedule()` if needed.

## Monitoring

- Check `ingest_logs` table for job history.
- Review Next.js logs for `[Ingestion]` entries during manual runs.
- Alerts/Errors will appear in Supabase logs and job-store entries.

