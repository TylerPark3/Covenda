-- Student of the Week: consent-first homepage spotlight.
-- spotlight_consent is an EXPLICIT opt-in ("Covenda may feature me publicly...") — a higher
-- bar than portfolio_visibility, never reused from it. featured_at marks the one active
-- featured student (most recent non-null wins; the admin action clears others). Idempotent.

alter table if exists public.member_profiles
  add column if not exists spotlight_consent boolean not null default false,
  add column if not exists featured_at timestamptz;

notify pgrst, 'reload schema';
