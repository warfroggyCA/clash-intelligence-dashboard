-- Enable RLS for leadership assessment tables (server-side access only via service role).
alter table if exists public.leadership_assessments enable row level security;
alter table if exists public.leadership_assessment_results enable row level security;
