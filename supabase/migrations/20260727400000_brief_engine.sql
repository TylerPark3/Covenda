-- The Project Brief Engine's columns.
--
-- Extends member_projects rather than creating a parallel table: member_projects IS the
-- opportunity, and a second table would immediately disagree with it.
--
-- All nullable, all CHECK-constrained NOT VALID in the same style as the compatibility
-- columns, so existing rows are untouched and a brief written before this ran keeps working.
--
-- Idempotent: safe to re-run.

alter table public.member_projects
  -- Stage 1 · diagnosis. The stated problem is a claim to test, so both readings are kept.
  add column if not exists stated_problem text,
  add column if not exists likely_problem text,
  add column if not exists diagnosis jsonb,          -- { decomposition[], rootCause, reasoning, confirmingEvidence[], killingEvidence[] }
  add column if not exists root_cause_class text,

  -- Stage 2 · the trial. Every brief carries what the company gets and what separates a
  -- strong candidate from a weak one, or it does not ship.
  add column if not exists value_to_company text,
  add column if not exists discriminating_signal jsonb,  -- [{ trait, element, weakLooksLike, strongLooksLike, discriminates }]
  add column if not exists inputs_required jsonb,        -- [{ label, kind }] — public | synthetic | founder_approved
  add column if not exists grading_rubric jsonb,         -- { skill, anchors: { 4, 6, 9 } }

  -- Stage 3 · founder in the loop. Every edit is kept with its reason; those reasons are the
  -- highest-value training data we get about what founders actually want.
  add column if not exists brief_version integer not null default 1,
  add column if not exists brief_revisions jsonb not null default '[]'::jsonb,
  add column if not exists brief_approved_at timestamptz,
  add column if not exists brief_engine_version text;

alter table public.member_projects drop constraint if exists member_projects_root_cause_class_check;
alter table public.member_projects add constraint member_projects_root_cause_class_check
  check (root_cause_class is null or root_cause_class in ('structural', 'behavioral')) not valid;

alter table public.member_projects drop constraint if exists member_projects_brief_version_check;
alter table public.member_projects add constraint member_projects_brief_version_check
  check (brief_version >= 1) not valid;

alter table public.member_projects drop constraint if exists member_projects_signal_array_check;
alter table public.member_projects add constraint member_projects_signal_array_check
  check (discriminating_signal is null or jsonb_typeof(discriminating_signal) = 'array') not valid;

alter table public.member_projects drop constraint if exists member_projects_inputs_array_check;
alter table public.member_projects add constraint member_projects_inputs_array_check
  check (inputs_required is null or jsonb_typeof(inputs_required) = 'array') not valid;

alter table public.member_projects drop constraint if exists member_projects_revisions_array_check;
alter table public.member_projects add constraint member_projects_revisions_array_check
  check (jsonb_typeof(brief_revisions) = 'array') not valid;

-- Briefs a founder has not yet approved are the operator's queue.
create index if not exists member_projects_brief_pending_idx
  on public.member_projects (owner_user_id, updated_at desc)
  where brief_approved_at is null and value_to_company is not null;

notify pgrst, 'reload schema';
