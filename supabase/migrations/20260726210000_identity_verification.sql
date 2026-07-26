-- Identity verification (Stripe Identity). A student photographs a government ID + selfie
-- through Stripe's hosted flow; Stripe verifies it and, via the webhook, we store ONLY the
-- result here — never the ID image or raw document data. Two things gate on this: an
-- "Identity verified" credibility badge, and payout eligibility (must be verified AND 18+).
-- Idempotent. Written by the service role from the signature-verified webhook.
alter table public.member_profiles
  add column if not exists identity_verified boolean not null default false,
  add column if not exists identity_verified_at timestamptz,
  add column if not exists identity_18plus boolean not null default false,
  add column if not exists identity_session_id text;

notify pgrst, 'reload schema';
