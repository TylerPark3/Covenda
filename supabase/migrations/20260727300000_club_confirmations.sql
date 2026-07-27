-- Letting a club officer confirm a membership claim.
--
-- Until now a student could file a claim and the only way to confirm it was an operator
-- editing the table by hand — so the club-credibility thesis the whole referral model rests
-- on could never actually be earned.
--
-- Design constraint that shaped everything: club officers will not create accounts. They are
-- volunteers with a term of office, and asking them to sign up to vouch for someone is where
-- this would die. So confirmation runs on a single-use token the STUDENT sends them. The
-- officer opens a link, states who they are, and confirms or declines. No account, no
-- password, no session.
--
-- The token is the credential, so it is single-use, expiring, and records who acted on it.
--
-- Idempotent: safe to re-run.

create table if not exists public.club_confirmations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  club_id uuid not null references public.clubs(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid references public.club_members(id) on delete cascade,

  -- Who acted, captured at confirmation time. A confirmation nobody's name is attached to is
  -- worth nothing, which is the same rule the student side applies to referrals.
  officer_name text,
  officer_email text,
  officer_role text,

  status text not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),

  constraint club_confirmations_status_allowed check (status in ('pending', 'confirmed', 'declined', 'expired')),
  constraint club_confirmations_officer_named check (
    status <> 'confirmed' or (officer_name is not null and char_length(btrim(officer_name)) > 1)
  )
);

create index if not exists club_confirmations_student_idx
  on public.club_confirmations (student_user_id, created_at desc);
create index if not exists club_confirmations_club_idx
  on public.club_confirmations (club_id, status);

alter table public.club_confirmations enable row level security;
alter table public.club_confirmations force row level security;
-- Server-only. A browser that could read this table could read every live token.
revoke all on table public.club_confirmations from public, anon, authenticated;
grant select, insert, update on table public.club_confirmations to service_role;

notify pgrst, 'reload schema';
