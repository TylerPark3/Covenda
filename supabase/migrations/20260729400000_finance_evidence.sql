-- Finance evidence: the artifacts a finance student actually produces.
--
-- ── WHY NOT REUSE technical_evidence ──────────────────────────────────────────────────
-- Tempting, since the column list is close. But its type CHECK enumerates software types, so
-- every finance artifact would need that constraint widened, and a shipped_product row and a
-- dcf_model row would then share a table whose constraints describe neither well. The columns
-- that differ are the ones that matter: a model has a subject and an as-of date and no repo,
-- a repo has a deployment status and no subject.
--
-- ── WHY subject IS NOT NULL ───────────────────────────────────────────────────────────
-- A pitch with no company and a memo with no target cannot be checked by anyone. The model
-- refuses to record one; the database refuses to hold one, so the rule survives a caller that
-- forgets to ask the model first.
--
-- ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────────────────
-- No score, no rating, no returns column. A student's stated return is unverifiable and mostly
-- measures the market over their horizon, so storing it would invite reading it as skill. The
-- track record that IS trustworthy is a connected brokerage statement, and that lives in
-- api/finance.js where the provenance can be checked.
--
-- Idempotent: safe to re-run.

create table if not exists public.finance_evidence (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,

  artifact_type text not null,
  evidence_source text not null,
  verification_level text not null default 'claimed',

  -- The company, sector, or target. The thing that makes the artifact checkable.
  subject text not null,
  title text,
  pointer text,
  published boolean not null default false,
  -- The date the analysis was made as of, which is not the date it was uploaded. A pitch is
  -- only judgeable against what was knowable when it was written.
  as_of date,

  skills jsonb not null default '[]'::jsonb,
  disciplines jsonb not null default '[]'::jsonb,

  -- Where the numbers came from and what was reused. Disclosed, not detected: a template is
  -- fine to start from, and pretending otherwise just teaches students to hide it.
  provenance jsonb,
  -- A live defense of the reasoning. The one thing that cannot be downloaded.
  defense_result jsonb,

  detail jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_evidence_type_allowed check (artifact_type in (
    'stock_pitch', 'investment_memo', 'dcf_model', 'lbo_model', 'ma_model',
    'research_report', 'published_writing', 'market_map', 'diligence_pack',
    'accounting_project', 'portfolio_record', 'macro_credit')),
  constraint finance_evidence_verification_allowed check (verification_level in (
    'claimed', 'artifact', 'referral', 'trial')),
  constraint finance_evidence_subject_present check (length(btrim(subject)) > 0),
  constraint finance_evidence_skills_array check (jsonb_typeof(skills) = 'array'),
  constraint finance_evidence_disciplines_array check (jsonb_typeof(disciplines) = 'array'),
  -- Mirrors normaliseEvidence: above `claimed`, something has to point at it.
  constraint finance_evidence_pointer_required check (
    verification_level = 'claimed' or pointer is not null)
);

create index if not exists finance_evidence_student_idx
  on public.finance_evidence (student_user_id, created_at desc);
create index if not exists finance_evidence_type_idx
  on public.finance_evidence (artifact_type, verification_level);

alter table public.finance_evidence enable row level security;

drop policy if exists finance_evidence_owner_read on public.finance_evidence;
create policy finance_evidence_owner_read on public.finance_evidence
  for select using (auth.uid() = student_user_id);

drop policy if exists finance_evidence_owner_write on public.finance_evidence;
create policy finance_evidence_owner_write on public.finance_evidence
  for insert with check (auth.uid() = student_user_id);

drop policy if exists finance_evidence_owner_update on public.finance_evidence;
create policy finance_evidence_owner_update on public.finance_evidence
  for update using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);

drop policy if exists finance_evidence_owner_delete on public.finance_evidence;
create policy finance_evidence_owner_delete on public.finance_evidence
  for delete using (auth.uid() = student_user_id);

-- A student may say which kind of firm they are aiming at, which reorders their own profile.
-- Nullable and non-binding: it changes emphasis, never eligibility, and a student who picks
-- nothing sees the profile as they built it.
alter table public.member_profiles
  add column if not exists target_firm_type text;

comment on column public.member_profiles.target_firm_type is
  'Finance firm type the student is aiming at. Reorders their profile emphasis only; never a filter or a gate.';

notify pgrst, 'reload schema';
