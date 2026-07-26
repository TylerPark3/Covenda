-- §13 slice 7: clubs get a record.
--
-- api/clubs.js could compute verification but had nowhere to read from or write to: a club
-- registration landed in the generic submissions inbox and stopped there. So the thing the
-- founder calls the main goal — a selective club anywhere building credibility a stranger
-- will trust — could never actually be earned. This is the missing half.
--
-- Design notes:
--   * A club is verified PER BATCH, never globally. A robotics club is strong evidence for a
--     robotics team and none at all for an accounting one, so verification hangs off
--     (club, batch) and there is deliberately no overall club score column.
--   * Membership is a CLAIM by the student, confirmed by an officer. An unconfirmed claim
--     carries nothing — otherwise anyone could attach themselves to a selective club.
--   * Counts are DERIVED from batch_applications and member_projects, never stored. A stored
--     count is a number that can drift from the outcomes it claims to summarise.
--
-- Idempotent; safe to re-run.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  school text,
  vertical_slug text,                 -- the batch vertical this club feeds
  contact_email text,
  contact_role text,
  member_estimate integer,
  status text not null default 'pending',
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clubs_name_length check (char_length(name) between 1 and 160),
  constraint clubs_status_allowed check (status in ('pending', 'active', 'suspended', 'archived')),
  constraint clubs_member_estimate_nonneg check (member_estimate is null or member_estimate >= 0)
);
create unique index if not exists clubs_slug_key on public.clubs (slug) where slug is not null;
create index if not exists clubs_status_idx on public.clubs (status, created_at desc);
create index if not exists clubs_vertical_idx on public.clubs (vertical_slug);

-- A student's membership claim. Confirmed by an officer or an operator; unconfirmed carries
-- no weight anywhere, which is what stops a selective club being self-assigned.
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'claimed',
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint club_members_status_allowed check (status in ('claimed', 'confirmed', 'rejected')),
  constraint club_members_unique unique (club_id, student_user_id)
);
create index if not exists club_members_club_idx on public.club_members (club_id, status);
create index if not exists club_members_student_idx on public.club_members (student_user_id);

-- Verification is EARNED per (club, batch) and recorded when an operator grants a tier. The
-- evidence behind it stays derivable from applications and outcomes; this table records the
-- decision and who made it, so a badge is always traceable to a person.
create table if not exists public.club_verifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  batch_slug text not null,
  tier text not null,
  admitted_count integer not null default 0,
  accepted_work_count integer not null default 0,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  rationale text,
  constraint club_verifications_tier_allowed check (tier in ('recognised', 'verified', 'distinguished')),
  constraint club_verifications_unique unique (club_id, batch_slug)
);
create index if not exists club_verifications_club_idx on public.club_verifications (club_id);
create index if not exists club_verifications_batch_idx on public.club_verifications (batch_slug);

alter table public.clubs enable row level security;
alter table public.clubs force row level security;
revoke all on table public.clubs from public, anon, authenticated;
grant select, insert, update on table public.clubs to service_role;

alter table public.club_members enable row level security;
alter table public.club_members force row level security;
revoke all on table public.club_members from public, anon, authenticated;
grant select, insert, update on table public.club_members to service_role;

alter table public.club_verifications enable row level security;
alter table public.club_verifications force row level security;
revoke all on table public.club_verifications from public, anon, authenticated;
grant select, insert, update on table public.club_verifications to service_role;

notify pgrst, 'reload schema';
