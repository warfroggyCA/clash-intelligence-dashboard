alter table if exists public.cwl_seasons
  add column if not exists season_label text;
