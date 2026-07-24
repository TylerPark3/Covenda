-- Startup-Fit dimension for the compatibility engine. Company projects gain four optional
-- environment descriptors; students gain matching optional work-style preferences. ALL nullable
-- and CHECK-constrained NOT VALID (same style as conversion_outcome) so a missing value never
-- lowers a match and existing rows are unaffected. No protected attributes here.

alter table if exists public.member_projects
  add column if not exists env_structure text,
  add column if not exists env_autonomy text,
  add column if not exists env_pace text,
  add column if not exists env_stage text;

alter table public.member_projects drop constraint if exists member_projects_env_structure_check;
alter table public.member_projects add constraint member_projects_env_structure_check
  check (env_structure is null or env_structure in ('structured','ambiguous')) not valid;
alter table public.member_projects drop constraint if exists member_projects_env_autonomy_check;
alter table public.member_projects add constraint member_projects_env_autonomy_check
  check (env_autonomy is null or env_autonomy in ('guided','independent')) not valid;
alter table public.member_projects drop constraint if exists member_projects_env_pace_check;
alter table public.member_projects add constraint member_projects_env_pace_check
  check (env_pace is null or env_pace in ('steady','fast')) not valid;
alter table public.member_projects drop constraint if exists member_projects_env_stage_check;
alter table public.member_projects add constraint member_projects_env_stage_check
  check (env_stage is null or env_stage in ('idea','seed','growth')) not valid;

-- Student work-style preferences (jsonb: { structure, autonomy, pace, stage }). Validated in the
-- API via cleanWorkStyle; kept as jsonb here so the shape can evolve without a migration.
alter table if exists public.member_profiles
  add column if not exists work_style jsonb;

notify pgrst, 'reload schema';
