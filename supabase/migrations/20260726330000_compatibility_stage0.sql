-- Compatibility Engine — Stage 0 schema (docs/COMPATIBILITY_ENGINE_MASTER.md).
-- Schema before any AI. Idempotent; service-role only (the portal/admin API is the sole
-- gatekeeper); no data backfill. Stays empty until the pilot fills it — designed now so
-- extraction (Stage 1), matching (Stage 2), and telemetry (Stage 4) plug in without a rewrite.

-- 1) skill_claim: evidence-tiered skill rows. A claim without an evidence pointer may exist
--    only as tier='claimed' and is EXCLUDED from matching by default (enforced in the API).
create table if not exists public.skill_claim (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  skill text not null,
  skill_canonical text, -- normalized against the Stage-1 taxonomy (Lightcast/O*NET); null until normalized
  level text,
  verification_tier text not null default 'claimed',
  evidence_pointer text, -- URL/ref to the raw proof (repo, artifact, Loom walkthrough, trial)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_claim_tier_allowed check (verification_tier in ('claimed', 'artifact', 'referral', 'trial')),
  constraint skill_claim_skill_length check (char_length(skill) between 1 and 120),
  -- Above 'claimed', evidence is mandatory: no pointer, no tier.
  constraint skill_claim_evidence_required check (verification_tier = 'claimed' or evidence_pointer is not null)
);
create index if not exists skill_claim_student_idx on public.skill_claim (student_user_id, verification_tier);

alter table public.skill_claim enable row level security;
revoke all on table public.skill_claim from public, anon, authenticated;
grant select, insert, update, delete on table public.skill_claim to service_role;

-- 2) Opportunity fields on member_projects (member_projects IS the opportunity; no rename).
alter table if exists public.member_projects
  add column if not exists opportunity_type text not null default 'project',
  add column if not exists complexity_rating smallint,
  add column if not exists ambiguity_rating smallint,
  add column if not exists founder_time_budget_min_week integer,
  add column if not exists talent_source_prefs jsonb,
  add column if not exists referral_requirement text,
  add column if not exists experience_requirement text;

alter table public.member_projects drop constraint if exists member_projects_opportunity_type_check;
alter table public.member_projects add constraint member_projects_opportunity_type_check
  check (opportunity_type in ('project','part_time','internship','research','apprenticeship','talent_pipeline','full_time')) not valid;
alter table public.member_projects drop constraint if exists member_projects_complexity_check;
alter table public.member_projects add constraint member_projects_complexity_check
  check (complexity_rating is null or complexity_rating between 1 and 5) not valid;
alter table public.member_projects drop constraint if exists member_projects_ambiguity_check;
alter table public.member_projects add constraint member_projects_ambiguity_check
  check (ambiguity_rating is null or ambiguity_rating between 1 and 5) not valid;
alter table public.member_projects drop constraint if exists member_projects_referral_req_check;
alter table public.member_projects add constraint member_projects_referral_req_check
  check (referral_requirement is null or referral_requirement in ('required','preferred','none')) not valid;
alter table public.member_projects drop constraint if exists member_projects_experience_req_check;
alter table public.member_projects add constraint member_projects_experience_req_check
  check (experience_requirement is null or experience_requirement in ('none','relevant_project','prior_internship','professional')) not valid;

-- 3) matches: the formal match log. Every human decision REQUIRES a rationale — those
--    rationales are the training labels the whole learned stage depends on.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.member_projects(id) on delete cascade,
  student_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  hard_filter_pass boolean,
  score numeric,
  score_components jsonb,
  explanation text,
  scorer_version text,
  human_decision text,
  human_rationale text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint matches_decision_allowed check (human_decision is null or human_decision in ('proposed','selected','rejected')),
  constraint matches_rationale_required check (human_decision is null or (human_rationale is not null and char_length(btrim(human_rationale)) > 0))
);
create index if not exists matches_opportunity_idx on public.matches (opportunity_id, created_at desc);
create index if not exists matches_student_idx on public.matches (student_user_id, created_at desc);

alter table public.matches enable row level security;
revoke all on table public.matches from public, anon, authenticated;
grant select, insert, update, delete on table public.matches to service_role;

-- 4) Outcome extensions on member_projects (shipped/completed_at/conversion_outcome exist).
alter table if exists public.member_projects
  add column if not exists milestones jsonb,          -- [{title, due_at, submitted_at, on_time, reassigned}]
  add column if not exists rubric_scores jsonb,       -- dual-rater + adjudicated
  add column if not exists founder_eval jsonb,        -- structured questionnaire
  add column if not exists founder_time_actual_min_week integer;

notify pgrst, 'reload schema';
