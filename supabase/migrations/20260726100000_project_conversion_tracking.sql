-- Record what accepted work led to. Tracking only: no payment or fee logic changes.
-- Idempotent and compatible with the existing member_projects ownership policies.
alter table public.member_projects
  add column if not exists conversion_outcome text not null default 'none',
  add column if not exists conversion_note text,
  add column if not exists conversion_recorded_at timestamptz;

alter table public.member_projects
  drop constraint if exists member_projects_conversion_allowed,
  add constraint member_projects_conversion_allowed
    check (conversion_outcome in ('none', 'continued', 'interview', 'internship', 'full_time', 'referred_on')) not valid;

alter table public.member_projects
  drop constraint if exists member_projects_conversion_note_length,
  add constraint member_projects_conversion_note_length
    check (conversion_note is null or char_length(conversion_note) <= 500) not valid;

notify pgrst, 'reload schema';
