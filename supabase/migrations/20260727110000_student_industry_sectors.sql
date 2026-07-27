-- Add the second level of the shared startup-industry taxonomy. Broad industries continue
-- to live in verticals; industry_sectors stores optional, more specific interests/targets.
-- Both remain server-validated by api/portal.js. This migration is additive and repeatable.
alter table public.member_profiles
  add column if not exists industry_sectors jsonb not null default '[]'::jsonb;

alter table public.member_projects
  add column if not exists industry_sectors jsonb not null default '[]'::jsonb;

alter table public.member_profiles
  drop constraint if exists member_profiles_industry_sectors_array,
  add constraint member_profiles_industry_sectors_array
    check (jsonb_typeof(industry_sectors) = 'array') not valid;

alter table public.member_projects
  drop constraint if exists member_projects_industry_sectors_array,
  add constraint member_projects_industry_sectors_array
    check (jsonb_typeof(industry_sectors) = 'array') not valid;

create index if not exists member_profiles_industry_sectors_gin
  on public.member_profiles using gin (industry_sectors);

create index if not exists member_projects_industry_sectors_gin
  on public.member_projects using gin (industry_sectors);

notify pgrst, 'reload schema';
