begin;

create table if not exists public.war_prep_pins (
  id bigserial primary key,
  our_clan_tag text not null,
  opponent_tag text not null,
  profile_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (our_clan_tag)
);

create index if not exists war_prep_pins_our_tag_idx on public.war_prep_pins (our_clan_tag);

create or replace function public.set_war_prep_pins_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists war_prep_pins_set_updated_at on public.war_prep_pins;
create trigger war_prep_pins_set_updated_at
  before update on public.war_prep_pins
  for each row
  execute function public.set_war_prep_pins_updated_at();

commit;

