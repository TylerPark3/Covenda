-- Company project intake: AI-assisted understanding, private file attachments, and
-- vertical/work-type targeting used to route finished projects to the right students.
-- Idempotent (add column if not exists) so it is safe to re-run. RLS / grants are
-- unchanged — the portal API stays the sole gatekeeper. member_profiles.verticals /
-- work_types were added by the onboarding migration (20260724200000); this reuses them.
alter table public.member_projects
  add column if not exists verticals jsonb not null default '[]'::jsonb,
  add column if not exists work_types jsonb not null default '[]'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists ai_brief jsonb,
  add column if not exists problem_text text,
  add column if not exists consult_booked boolean not null default false;

alter table public.member_projects
  drop constraint if exists member_projects_verticals_array,
  add constraint member_projects_verticals_array check (jsonb_typeof(verticals) = 'array') not valid;
alter table public.member_projects
  drop constraint if exists member_projects_work_types_array,
  add constraint member_projects_work_types_array check (jsonb_typeof(work_types) = 'array') not valid;
alter table public.member_projects
  drop constraint if exists member_projects_attachments_array,
  add constraint member_projects_attachments_array check (jsonb_typeof(attachments) = 'array') not valid;

-- Refresh the Data API so the new columns are queryable immediately.
notify pgrst, 'reload schema';
