-- Two live holes, both found by the 2026-08-01 pre-merge audit and both pre-existing.
--
-- ── 1. bump_rate_limit was callable by anyone ────────────────────────────────────────
--
-- 20260728200000_infrastructure.sql creates public.bump_rate_limit as SECURITY DEFINER and
-- never revokes it. Every other definer function in this repo does:
-- 20260725100000_escrow_release_functions.sql revokes two, 20260726000000_payout_requests.sql
-- revokes one. This file revoked none, so the function runs with owner privileges for any
-- caller including anon.
--
-- The exploit needs no account. bump_rate_limit(subject, action, window_start) increments a
-- counter keyed on a subject the caller chooses, so anyone can inflate the counter for someone
-- else's subject and lock that person out of their own sign-in. Targeted denial of service,
-- unauthenticated, one function call.
--
-- Worth noting for the threat model: Supabase's advisor flagged the two SECURITY DEFINER views
-- closed in 20260730300000 and did not flag this. An advisor is a floor, not a audit.
--
-- Revoking does not break the application. The API calls this with the service role
-- (api/limits.js checkLimit -> client), which bypasses grants.

revoke all on function public.bump_rate_limit(text, text, timestamptz) from public, anon, authenticated;

-- The table behind it, for the same reason. Nothing in the browser should read or write counters.
revoke all on table public.rate_limits from public, anon, authenticated;

comment on function public.bump_rate_limit(text, text, timestamptz) is
  'SECURITY DEFINER. Service-role only: revoked from public/anon/authenticated because the subject is caller-supplied, so an open grant lets anyone rate-limit anyone else.';

-- ── 2. The company verification attempt cap never fired ──────────────────────────────
--
-- api/verification.js checkCode() gates on `Number(record.attempts) >= MAX_ATTEMPTS`, and both
-- verification paths call it. The student path works: school_email_codes has an attempts column
-- and api/portal.js increments it on every failure.
--
-- company_email_codes has no attempts column and nothing ever incremented one. So
-- Number(undefined) is NaN, NaN >= 5 is false, and the branch was unreachable from the day it
-- was written. A six-digit code could be tried without limit.
--
-- This is the same shape as the rate limiter sitting inert for days while appearing active: the
-- check is present, reads correct, and protects nothing. A guard that cannot fire is worse than
-- no guard, because it stops anyone looking.

alter table public.company_email_codes
  add column if not exists attempts integer not null default 0;

-- Cheap insurance behind the application-level cap. Even if a future caller forgets to
-- increment, the column cannot be driven somewhere meaningless.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_email_codes_attempts_sane'
  ) then
    alter table public.company_email_codes
      add constraint company_email_codes_attempts_sane check (attempts >= 0 and attempts <= 100);
  end if;
end $$;

comment on column public.company_email_codes.attempts is
  'Failed submissions for this code. api/verification.js checkCode() locks at MAX_ATTEMPTS. Added 2026-08-01: the column was missing, so the cap evaluated NaN >= 5 and never fired.';
