-- The technical evidence graph, and the practitioner records that were pure functions.
--
-- ── ONE TABLE, NOT ONE PER TYPE ───────────────────────────────────────────────────────
-- A hackathon, an open-source PR and a shipped product differ in what they demonstrate, not
-- in what has to be stored about them. Separate tables would duplicate every column and force
-- every reader to union across them, and adding a ninth evidence type would mean a migration
-- rather than a table entry. api/technical-evidence.js already treats type as data; the
-- schema follows.
--
-- Type-specific fields live in `detail` because they genuinely vary: a hackathon has a team
-- size and a placement, a PR has a merge status. Anything queried across types is a column.
--
-- ── WHY ownership_level IS SEPARATE FROM verification_level ───────────────────────────
-- They answer different questions and get conflated constantly. Verification is "how much do
-- we trust this happened"; ownership is "how much of it was this person". A well-evidenced
-- contribution to a large team project is high verification and low ownership, and a company
-- reading it needs both numbers to mean anything.
--
-- Idempotent: safe to re-run.

create table if not exists public.technical_evidence (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,

  evidence_type text not null,
  evidence_source text not null,
  ownership_level text not null default 'contributor',
  verification_level text not null default 'claimed',

  title text,
  pointer text,
  repo_url text,
  deployment_url text,
  deployment_status text,
  project_status text,

  skills jsonb not null default '[]'::jsonb,
  technical_domains jsonb not null default '[]'::jsonb,
  agency_signals jsonb not null default '[]'::jsonb,

  -- Disclosed rather than detected. A null here means "not disclosed", which is different
  -- from "no AI used" and must not be read as the second.
  ai_assistance_disclosure jsonb,
  defense_result jsonb,

  -- Type-specific: hackathon_metadata, open_source_metadata, usage metrics, timeline.
  detail jsonb not null default '{}'::jsonb,

  months_operated integer,
  iterations integer,
  assigned boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint technical_evidence_type_allowed check (evidence_type in (
    'shipped_product', 'hackathon', 'open_source', 'independent_project',
    'coursework', 'research', 'technical_writing', 'community')),
  constraint technical_evidence_ownership_allowed check (ownership_level in (
    'contributor', 'substantial', 'primary', 'sole')),
  constraint technical_evidence_verification_allowed check (verification_level in (
    'claimed', 'artifact', 'referral', 'trial')),
  constraint technical_evidence_skills_array check (jsonb_typeof(skills) = 'array'),
  constraint technical_evidence_domains_array check (jsonb_typeof(technical_domains) = 'array'),
  constraint technical_evidence_agency_array check (jsonb_typeof(agency_signals) = 'array'),
  -- Mirrors the rule in normaliseEvidence: above `claimed`, something has to point at it.
  constraint technical_evidence_pointer_required check (
    verification_level = 'claimed' or coalesce(pointer, repo_url, deployment_url) is not null),
  constraint technical_evidence_counts_nonneg check (
    (months_operated is null or months_operated >= 0) and (iterations is null or iterations >= 0))
);

create index if not exists technical_evidence_student_idx
  on public.technical_evidence (student_user_id, created_at desc);
create index if not exists technical_evidence_type_idx
  on public.technical_evidence (evidence_type, verification_level);

alter table public.technical_evidence enable row level security;

drop policy if exists technical_evidence_owner_read on public.technical_evidence;
create policy technical_evidence_owner_read on public.technical_evidence
  for select using (auth.uid() = student_user_id);

drop policy if exists technical_evidence_owner_write on public.technical_evidence;
create policy technical_evidence_owner_write on public.technical_evidence
  for insert with check (auth.uid() = student_user_id);

drop policy if exists technical_evidence_owner_update on public.technical_evidence;
create policy technical_evidence_owner_update on public.technical_evidence
  for update using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);

drop policy if exists technical_evidence_owner_delete on public.technical_evidence;
create policy technical_evidence_owner_delete on public.technical_evidence
  for delete using (auth.uid() = student_user_id);


-- ── Company evidence requests ─────────────────────────────────────────────────────────
-- What a specific team wants to see, so alignment can name what lines up instead of emitting
-- a percentage. Priorities are stored as the company's own words; the recommended evidence is
-- derived at read time rather than frozen here, so improving the mapping does not require
-- rewriting rows that already exist.
create table if not exists public.company_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  batch_slug text,
  project_id uuid references public.member_projects(id) on delete cascade,

  headline text,
  priorities jsonb not null default '[]'::jsonb,
  required_evidence_types jsonb not null default '[]'::jsonb,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_evidence_priorities_array check (jsonb_typeof(priorities) = 'array'),
  constraint company_evidence_types_array check (jsonb_typeof(required_evidence_types) = 'array')
);

create index if not exists company_evidence_requests_company_idx
  on public.company_evidence_requests (company_user_id, created_at desc);

alter table public.company_evidence_requests enable row level security;

drop policy if exists company_evidence_requests_owner on public.company_evidence_requests;
create policy company_evidence_requests_owner on public.company_evidence_requests
  for all using (auth.uid() = company_user_id) with check (auth.uid() = company_user_id);


-- ── Practitioner review records ───────────────────────────────────────────────────────
-- api/professional-review.js was pure functions with nowhere to put a result, so a
-- calibration existed only for as long as the request that computed it. Without these, the
-- bar a practitioner set could not survive to the next applicant.
create table if not exists public.practitioner_calibrations (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  reviewer_name text not null,
  reviewer_role text,
  bar numeric not null,
  anchors jsonb not null default '[]'::jsonb,
  incomplete integer not null default 0,
  cycle_started timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint practitioner_calibrations_anchors_array check (jsonb_typeof(anchors) = 'array'),
  constraint practitioner_calibrations_bar_range check (bar >= 0 and bar <= 10)
);

create index if not exists practitioner_calibrations_vertical_idx
  on public.practitioner_calibrations (vertical, created_at desc);

create table if not exists public.practitioner_adjudications (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  skill text not null,
  submission_ref text,
  score numeric,
  -- 'practitioner' or 'covenda'. An internal tiebreak must never be presented as theirs, and
  -- storing which is the only way that survives past the request that decided it.
  decided_by text not null default 'covenda',
  reviewer_name text,
  note text,
  cycle_started timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint practitioner_adjudications_source check (decided_by in ('practitioner', 'covenda')),
  constraint practitioner_adjudications_score_range check (score is null or (score >= 0 and score <= 10))
);

create index if not exists practitioner_adjudications_cycle_idx
  on public.practitioner_adjudications (vertical, cycle_started, decided_by);

create table if not exists public.practitioner_audits (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  reviewer_name text,
  samples jsonb not null default '[]'::jsonb,
  drifted boolean not null default false,
  direction text,
  action text,
  created_at timestamptz not null default now(),
  constraint practitioner_audits_samples_array check (jsonb_typeof(samples) = 'array')
);

create index if not exists practitioner_audits_vertical_idx
  on public.practitioner_audits (vertical, created_at desc);

-- Operator-only tables: no anon or authenticated policy is created, so only the service role
-- reaches them. A student must not be able to read the bar they are being measured against
-- before they are measured, and a practitioner's name is not public until they agree.
alter table public.practitioner_calibrations enable row level security;
alter table public.practitioner_adjudications enable row level security;
alter table public.practitioner_audits enable row level security;

notify pgrst, 'reload schema';
