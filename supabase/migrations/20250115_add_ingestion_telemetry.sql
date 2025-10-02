-- Add telemetry columns to ingestion_jobs table for enhanced monitoring
-- This migration adds payload/ingestion/schema versioning, duration tracking,
-- anomaly detection, and timestamp fields to support comprehensive ingestion monitoring

begin;

-- Add telemetry columns to ingestion_jobs table
alter table public.ingestion_jobs
  add column if not exists payload_version text,
  add column if not exists ingestion_version text,
  add column if not exists schema_version text,
  add column if not exists total_duration_ms bigint,
  add column if not exists anomalies jsonb,
  add column if not exists fetched_at timestamptz,
  add column if not exists computed_at timestamptz;

-- Create indexes for telemetry queries
create index if not exists ingestion_jobs_payload_version_idx on public.ingestion_jobs (payload_version);
create index if not exists ingestion_jobs_ingestion_version_idx on public.ingestion_jobs (ingestion_version);
create index if not exists ingestion_jobs_schema_version_idx on public.ingestion_jobs (schema_version);
create index if not exists ingestion_jobs_total_duration_idx on public.ingestion_jobs (total_duration_ms);
create index if not exists ingestion_jobs_fetched_at_idx on public.ingestion_jobs (fetched_at);
create index if not exists ingestion_jobs_computed_at_idx on public.ingestion_jobs (computed_at);

-- Add comments for documentation
comment on column public.ingestion_jobs.payload_version is 'Version identifier for the payload data structure';
comment on column public.ingestion_jobs.ingestion_version is 'Version identifier for the ingestion pipeline';
comment on column public.ingestion_jobs.schema_version is 'Version identifier for the database schema';
comment on column public.ingestion_jobs.total_duration_ms is 'Total duration of the ingestion job in milliseconds';
comment on column public.ingestion_jobs.anomalies is 'JSON array of detected anomalies during ingestion';
comment on column public.ingestion_jobs.fetched_at is 'Timestamp when data was fetched from external API';
comment on column public.ingestion_jobs.computed_at is 'Timestamp when data processing was completed';

commit;
