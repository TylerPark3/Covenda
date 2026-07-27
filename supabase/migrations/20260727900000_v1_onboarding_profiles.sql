-- V1 student and company onboarding foundation.
--
-- These fields keep first-run setup concise while preserving the product rules:
-- student discovery is private by default, introductions require explicit approval,
-- capability claims are not verification, and evidence remains reviewable.

alter table public.member_profiles
  add column if not exists area_of_study text,
  add column if not exists capability_areas jsonb not null default '[]'::jsonb,
  add column if not exists engagement_preferences jsonb not null default '{}'::jsonb,
  add column if not exists discovery_opt_in boolean not null default false,
  add column if not exists introduction_approval_required boolean not null default true,
  add column if not exists profile_state text not null default 'draft';

alter table public.member_profiles
  drop constraint if exists member_profiles_capability_areas_array,
  add constraint member_profiles_capability_areas_array
    check (jsonb_typeof(capability_areas) = 'array') not valid,
  drop constraint if exists member_profiles_engagement_preferences_object,
  add constraint member_profiles_engagement_preferences_object
    check (jsonb_typeof(engagement_preferences) = 'object') not valid,
  drop constraint if exists member_profiles_profile_state_allowed,
  add constraint member_profiles_profile_state_allowed
    check (profile_state in ('draft','profile_complete','company_visible','evidence_confirmed','work_verified','paused')) not valid;

create table if not exists public.student_evidence_items (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  title text not null,
  context text,
  contribution text not null,
  outcome text,
  artifact_url text,
  observer_name text,
  ai_use text not null default 'none',
  review_state text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_evidence_title_length check (char_length(title) between 1 and 160),
  constraint student_evidence_contribution_length check (char_length(contribution) between 1 and 1200),
  constraint student_evidence_source_required check (artifact_url is not null or observer_name is not null),
  constraint student_evidence_ai_use_allowed check (ai_use in ('none','assistive','substantial')),
  constraint student_evidence_review_state_allowed check (review_state in ('unreviewed','confirmed','needs_context','rejected'))
);

create index if not exists student_evidence_items_owner_idx
  on public.student_evidence_items (student_user_id, created_at desc);

alter table public.student_evidence_items enable row level security;
alter table public.student_evidence_items force row level security;
revoke all on table public.student_evidence_items from public, anon, authenticated;
grant select, insert, update, delete on table public.student_evidence_items to service_role;

notify pgrst, 'reload schema';
