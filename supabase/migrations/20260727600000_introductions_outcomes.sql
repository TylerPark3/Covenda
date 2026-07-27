-- Introductions, outcomes, and company referrals.
--
-- Three things the company plan calls for that had no home.
--
-- INTRODUCTIONS (step 5). A company can reach a student at any point — while browsing,
-- after a batch, after trial work. The student always gets to decline or report it, and a
-- request carries the terms up front: what the work is, why they were picked, the money, the
-- time. An introduction with no compensation stated is how students get strung along.
--
-- OUTCOMES (step 6). What actually happened, plus the founder's read on it. These answers
-- are the only thing that will ever tell us whether the matching works, so they are stored
-- structurally rather than as free text in a note.
--
-- COMPANY REFERRALS (step 7). Rewarded only after the referred company does something real.
-- A reward on signup pays for noise.
--
-- Idempotent: safe to re-run.

create table if not exists public.introductions (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.member_projects(id) on delete set null,

  -- The terms, stated up front. Nullable so a draft can exist, checked by the API on send.
  role_summary text,
  why_relevant text,
  compensation text,
  time_commitment text,
  next_step text,
  message text,

  status text not null default 'sent',
  student_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),

  constraint introductions_status_allowed
    check (status in ('sent', 'accepted', 'question', 'declined', 'reported', 'withdrawn')),
  constraint introductions_message_length check (message is null or char_length(message) <= 2000),
  constraint introductions_response_length check (student_response is null or char_length(student_response) <= 2000),
  -- One live introduction per pair per project: repeated asks are pressure, not outreach.
  constraint introductions_unique_live unique (company_user_id, student_user_id, project_id)
);

create index if not exists introductions_student_idx on public.introductions (student_user_id, created_at desc);
create index if not exists introductions_company_idx on public.introductions (company_user_id, created_at desc);

alter table public.introductions enable row level security;
alter table public.introductions force row level security;
revoke all on table public.introductions from public, anon, authenticated;
grant select, insert, update on table public.introductions to service_role;

-- ── Outcomes ──────────────────────────────────────────────────────────────────────────
-- conversion_outcome already records WHAT happened. This records what the company learned,
-- which is the part that improves matching.
alter table public.member_projects
  add column if not exists outcome_survey jsonb,
  add column if not exists outcome_survey_at timestamptz;

alter table public.member_projects drop constraint if exists member_projects_outcome_survey_check;
alter table public.member_projects add constraint member_projects_outcome_survey_check
  check (outcome_survey is null or jsonb_typeof(outcome_survey) = 'object') not valid;

-- ── Company referrals ─────────────────────────────────────────────────────────────────
create table if not exists public.company_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  referred_user_id uuid references auth.users(id) on delete set null,

  -- The gates, in order. A reward before all four is a reward for noise.
  verified_at timestamptz,        -- the referred company confirmed a work email
  brief_at timestamptz,           -- created a legitimate brief
  introduced_at timestamptz,      -- requested an introduction
  converted_at timestamptz,       -- paid for something or hired

  reward_credits integer,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),

  constraint company_referrals_reward_nonneg check (reward_credits is null or reward_credits >= 0)
);

create index if not exists company_referrals_referrer_idx on public.company_referrals (referrer_user_id, created_at desc);

alter table public.company_referrals enable row level security;
alter table public.company_referrals force row level security;
revoke all on table public.company_referrals from public, anon, authenticated;
grant select, insert, update on table public.company_referrals to service_role;

notify pgrst, 'reload schema';
