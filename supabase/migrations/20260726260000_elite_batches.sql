-- §13 Elite Batch system. A batch is a curated, vetted cohort in a discipline (mapped to a
-- vertical), optionally partner-affiliated (a club/professor). Exclusivity is REAL: an
-- operator reviews every application. Companies spend credits (§7) to access a batch's
-- admitted students. Anyone can hold a Covenda account (open tier); elite batches are gated.
-- All service-role only, like every other private table. Idempotent.

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text,
  partner_org text,
  tier text not null default 'open',
  status text not null default 'open',
  season text,
  description text,
  capacity integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_tier_allowed check (tier in ('open', 'elite')),
  constraint batches_status_allowed check (status in ('draft', 'open', 'reviewing', 'closed', 'archived')),
  constraint batches_name_length check (char_length(name) between 1 and 160),
  constraint batches_capacity_nonneg check (capacity is null or capacity >= 0)
);
create index if not exists batches_status_idx on public.batches (status, created_at desc);

create table if not exists public.batch_applications (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted',
  materials jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint batch_applications_status_allowed check (status in ('submitted', 'reviewing', 'accepted', 'waitlisted', 'declined')),
  constraint batch_applications_unique unique (batch_id, student_user_id)
);
create index if not exists batch_applications_batch_idx on public.batch_applications (batch_id, status);
create index if not exists batch_applications_student_idx on public.batch_applications (student_user_id, created_at desc);

-- A company's paid access to a batch's admitted students (credit charge lives in credit_ledger).
create table if not exists public.batch_access (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  credits_spent integer not null default 0,
  granted_at timestamptz not null default now(),
  constraint batch_access_unique unique (batch_id, company_user_id)
);
create index if not exists batch_access_company_idx on public.batch_access (company_user_id);

alter table public.batches enable row level security;
alter table public.batches force row level security;
revoke all on table public.batches from public, anon, authenticated;
grant select, insert, update on table public.batches to service_role;

alter table public.batch_applications enable row level security;
alter table public.batch_applications force row level security;
revoke all on table public.batch_applications from public, anon, authenticated;
grant select, insert, update on table public.batch_applications to service_role;

alter table public.batch_access enable row level security;
alter table public.batch_access force row level security;
revoke all on table public.batch_access from public, anon, authenticated;
grant select, insert on table public.batch_access to service_role;

notify pgrst, 'reload schema';
