create extension if not exists pgcrypto;

create table if not exists war_plans (
  id uuid primary key default gen_random_uuid(),
  our_clan_tag text not null,
  opponent_clan_tag text not null,
  our_selection jsonb not null default '[]'::jsonb,
  opponent_selection jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists war_plans_unique_pair
  on war_plans (our_clan_tag, opponent_clan_tag);
