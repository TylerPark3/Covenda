-- §14: student verification. Nothing checked that a student account belonged to a student.
--
-- School email is the FLOOR, not the proof — it shows someone controls an address at an
-- academic domain, which is not enrolment and not identity. The columns are named so that
-- distinction survives into the data: school_email_verified_at records what was checked, and
-- nothing here is called "verified_student".
--
-- Idempotent; safe to re-run.

alter table public.member_profiles
  add column if not exists school_email text,
  add column if not exists school_email_domain text,
  add column if not exists school_email_verified_at timestamptz;

create index if not exists member_profiles_school_domain_idx
  on public.member_profiles (school_email_domain)
  where school_email_domain is not null;

-- Short-lived codes. A six-digit code rather than a second magic link: sign-in already sends
-- links, and two kinds of link in one inbox is how people click the wrong one.
create table if not exists public.school_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code text not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint school_email_codes_code_shape check (code ~ '^[0-9]{6}$'),
  constraint school_email_codes_attempts_nonneg check (attempts >= 0)
);
create index if not exists school_email_codes_user_idx on public.school_email_codes (user_id, created_at desc);

alter table public.school_email_codes enable row level security;
alter table public.school_email_codes force row level security;
revoke all on table public.school_email_codes from public, anon, authenticated;
grant select, insert, update on table public.school_email_codes to service_role;

notify pgrst, 'reload schema';
