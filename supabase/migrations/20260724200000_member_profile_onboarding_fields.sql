-- Student onboarding + project-matching fields on member_profiles: the student's
-- target verticals (industries) and work types drive vertical-matched project
-- discovery, and an optional avatar_url backs a real profile image (a procedural
-- gradient avatar is used client-side until an upload is added). Idempotent
-- (add column if not exists) so it is safe to re-run. RLS / grants unchanged — the
-- portal API stays the sole gatekeeper and validates these against a fixed taxonomy.
alter table public.member_profiles
  add column if not exists verticals jsonb not null default '[]'::jsonb,
  add column if not exists work_types jsonb not null default '[]'::jsonb,
  add column if not exists avatar_url text;

alter table public.member_profiles
  drop constraint if exists member_profiles_verticals_array,
  add constraint member_profiles_verticals_array check (jsonb_typeof(verticals) = 'array') not valid;
alter table public.member_profiles
  drop constraint if exists member_profiles_work_types_array,
  add constraint member_profiles_work_types_array check (jsonb_typeof(work_types) = 'array') not valid;

-- Refresh the Data API so the new columns are queryable immediately.
notify pgrst, 'reload schema';
