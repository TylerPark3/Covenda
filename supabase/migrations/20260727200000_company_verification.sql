-- Company work-email verification, and the public company profile behind a posted project.
--
-- Mirrors the student side deliberately. A confirmed work email proves someone reads mail at
-- a domain; it does NOT prove they can hire, sign, or speak for the company. The column is
-- named for what it is — work_email_verified_at — so no later reader mistakes it for a
-- verified company.
--
-- Idempotent: safe to re-run.

-- ── Codes ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.company_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  domain text not null,
  code text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists company_email_codes_user_idx
  on public.company_email_codes (user_id, created_at desc);

alter table public.company_email_codes enable row level security;
-- Codes are server-only. A browser that could read this table could verify any domain.
drop policy if exists company_email_codes_no_browser on public.company_email_codes;

-- ── Verification state on the profile ─────────────────────────────────────────────────
alter table public.member_profiles add column if not exists work_email_verified_at timestamptz;
alter table public.member_profiles add column if not exists work_email_domain text;

create index if not exists member_profiles_work_domain_idx
  on public.member_profiles (work_email_domain)
  where work_email_domain is not null;

-- ── Public company profile ────────────────────────────────────────────────────────────
-- What a student sees when they click the company name on a posted project. Everything here
-- is company-authored and public to signed-in members; private settings stay on
-- member_profiles and are never exposed through this table.
create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  logo_url text,
  website_url text,
  location text,
  remote_policy text,
  team_size text,
  stage text,
  founded_year smallint,

  -- What they build and who for.
  one_liner text,
  industry text,
  ideal_customer text,
  current_priorities text,

  -- Why a student would join. The section most job posts skip.
  student_gain text,
  work_examples text,
  work_environment text,

  -- Technical shape.
  tech_stack jsonb not null default '[]'::jsonb,
  departments jsonb not null default '[]'::jsonb,
  common_tools jsonb not null default '[]'::jsonb,
  capability_areas jsonb not null default '[]'::jsonb,

  -- Engagement terms, stated up front rather than discovered late.
  weekly_hours text,
  engagement_types jsonb not null default '[]'::jsonb,
  compensation_approach text,
  work_authorization text,
  hiring_timeline text,

  links jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_profiles_name_length check (char_length(company_name) between 1 and 160),
  constraint company_profiles_stack_array check (jsonb_typeof(tech_stack) = 'array'),
  constraint company_profiles_departments_array check (jsonb_typeof(departments) = 'array'),
  constraint company_profiles_tools_array check (jsonb_typeof(common_tools) = 'array'),
  constraint company_profiles_capability_array check (jsonb_typeof(capability_areas) = 'array'),
  constraint company_profiles_engagement_array check (jsonb_typeof(engagement_types) = 'array'),
  constraint company_profiles_links_array check (jsonb_typeof(links) = 'array')
);

alter table public.company_profiles enable row level security;

-- A company edits only its own profile.
drop policy if exists company_profiles_owner_write on public.company_profiles;
create policy company_profiles_owner_write on public.company_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Signed-in members read published profiles. Unpublished drafts stay with their owner.
drop policy if exists company_profiles_member_read on public.company_profiles;
create policy company_profiles_member_read on public.company_profiles
  for select using (published = true and auth.uid() is not null);

-- ── What the company came here to do ──────────────────────────────────────────────────
-- Asked during onboarding so the portal can lead with the right thing rather than showing
-- every surface to everyone.
alter table public.member_profiles add column if not exists company_intent text;

notify pgrst, 'reload schema';
