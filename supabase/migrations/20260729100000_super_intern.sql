-- The Super-Intern engine: company environment in, assessment plan out, outcomes back.
--
-- ── WHY THE PLAN IS STORED AND NOT RECOMPUTED ─────────────────────────────────────────
-- assessmentPlan() is a pure function, so a plan could be derived on every read. It is stored
-- anyway, because a student assessed in March must be able to see the plan they were actually
-- assessed under, not the one today's code would produce. Changing the framework must never
-- silently rewrite what somebody was already judged against. That is a fairness requirement
-- before it is a compliance one, and under AEDT rules it is both.
--
-- ── WHY OUTCOMES ARE A SEPARATE TABLE ─────────────────────────────────────────────────
-- Everything else here is a claim about what someone might do. placement_outcomes is the only
-- table that records what actually happened, and it is the one the whole thesis rests on: no
-- assessment can claim to predict time-to-productivity until enough of these exist. Keeping it
-- separate makes it obvious how empty it is.
--
-- Idempotent: safe to re-run.

-- What a company said about its own environment. The answers, not a score.
create table if not exists public.company_environments (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.member_projects(id) on delete cascade,

  vertical text not null,
  autonomy text not null default 'semi_autonomous',
  -- The input nobody else asks for and the one that decides the shape of everything.
  senior_hours_per_week numeric,
  domain_knowledge boolean not null default false,
  onboarding_burden jsonb not null default '[]'::jsonb,

  -- The eight reverse-audit answers, keyed by question id. Free text on purpose: the value is
  -- in what a company says unprompted, and a dropdown would destroy exactly that.
  reverse_audit jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_environments_autonomy_allowed
    check (autonomy in ('guided', 'semi_autonomous', 'autonomous', 'high_agency')),
  constraint company_environments_senior_hours_sane
    check (senior_hours_per_week is null or (senior_hours_per_week >= 0 and senior_hours_per_week <= 168)),
  constraint company_environments_burden_array check (jsonb_typeof(onboarding_burden) = 'array'),
  constraint company_environments_audit_object check (jsonb_typeof(reverse_audit) = 'object')
);

create index if not exists company_environments_owner_idx
  on public.company_environments (company_user_id, created_at desc);

alter table public.company_environments enable row level security;

drop policy if exists company_environments_owner on public.company_environments;
create policy company_environments_owner on public.company_environments
  for all using (auth.uid() = company_user_id) with check (auth.uid() = company_user_id);


-- The plan as generated, frozen at the moment it was generated.
create table if not exists public.assessment_plans (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid references public.company_environments(id) on delete cascade,
  batch_slug text,
  vertical text not null,

  -- The framework version that produced this. Without it, a plan from an older version is
  -- indistinguishable from one the current code would make, and neither can be audited.
  engine_version text not null,
  autonomy text not null,
  focus jsonb not null default '[]'::jsonb,
  components jsonb not null default '[]'::jsonb,
  deferred_to_trial jsonb not null default '[]'::jsonb,
  not_relevant jsonb not null default '[]'::jsonb,
  because jsonb not null default '[]'::jsonb,
  total_minutes integer not null default 0,

  created_at timestamptz not null default now(),

  constraint assessment_plans_focus_array check (jsonb_typeof(focus) = 'array'),
  constraint assessment_plans_components_array check (jsonb_typeof(components) = 'array'),
  -- The cap is a product decision and a proxy-risk control, so the database holds it too: a
  -- battery long enough to select on who can afford the time cannot be written at all.
  constraint assessment_plans_within_budget check (total_minutes > 0 and total_minutes <= 90)
);

create index if not exists assessment_plans_batch_idx on public.assessment_plans (batch_slug, created_at desc);


-- One student's run against one plan. Observations, never a score.
create table if not exists public.assessment_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.assessment_plans(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'in_progress',
  -- Per component: the band a human placed them in and the note behind it. Bands are named
  -- strings from the framework, deliberately not numbers, so nothing here can be averaged into
  -- the composite the whole design refuses to produce.
  observations jsonb not null default '{}'::jsonb,
  reviewer_name text,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint assessment_runs_status_allowed
    check (status in ('in_progress', 'submitted', 'reviewed', 'withdrawn')),
  constraint assessment_runs_observations_object check (jsonb_typeof(observations) = 'object'),
  constraint assessment_runs_one_per_plan unique (plan_id, student_user_id)
);

create index if not exists assessment_runs_student_idx
  on public.assessment_runs (student_user_id, started_at desc);

alter table public.assessment_runs enable row level security;

-- A student can read and start their own run. They cannot write observations: those are a
-- reviewer's, and a candidate who could edit them is not being assessed.
drop policy if exists assessment_runs_student_read on public.assessment_runs;
create policy assessment_runs_student_read on public.assessment_runs
  for select using (auth.uid() = student_user_id);

drop policy if exists assessment_runs_student_start on public.assessment_runs;
create policy assessment_runs_student_start on public.assessment_runs
  for insert with check (auth.uid() = student_user_id);


-- What actually happened. The only table that can ever validate any of the above.
create table if not exists public.placement_outcomes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.assessment_plans(id) on delete set null,
  project_id uuid references public.member_projects(id) on delete set null,

  days_to_contribution integer,
  senior_hours integer,
  independent_resolution numeric,
  rework_rate numeric,
  would_continue boolean,
  note text,

  recorded_at timestamptz not null default now(),

  constraint placement_outcomes_days_nonneg check (days_to_contribution is null or days_to_contribution >= 0),
  constraint placement_outcomes_hours_nonneg check (senior_hours is null or senior_hours >= 0),
  constraint placement_outcomes_rates_fraction check (
    (independent_resolution is null or (independent_resolution >= 0 and independent_resolution <= 1))
    and (rework_rate is null or (rework_rate >= 0 and rework_rate <= 1)))
);

create index if not exists placement_outcomes_student_idx on public.placement_outcomes (student_user_id, recorded_at desc);

-- Operator-only. A company must not see another company's onboarding cost, and a student must
-- not see the senior hours they consumed written down against their name.
alter table public.placement_outcomes enable row level security;
alter table public.assessment_plans enable row level security;

comment on table public.placement_outcomes is
  'What actually happened after a placement. Until roughly twenty rows exist, Covenda cannot claim its assessments predict time to productivity, and must not.';

notify pgrst, 'reload schema';
