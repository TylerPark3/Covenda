-- Stripe Connect accounts for student payouts.
--
-- We store the account ID and the derived state, never bank details. That is the whole point
-- of using Connect: the student's account numbers live with Stripe, so a credential leak here
-- cannot become a financial-data breach. payout_requests already avoids storing them for the
-- same reason.
--
-- Idempotent: safe to re-run.

alter table public.member_profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_account_state text,
  add column if not exists stripe_account_checked_at timestamptz;

alter table public.member_profiles drop constraint if exists member_profiles_stripe_state_check;
alter table public.member_profiles add constraint member_profiles_stripe_state_check
  check (stripe_account_state is null or stripe_account_state in ('none', 'pending', 'restricted', 'ready')) not valid;

create index if not exists member_profiles_stripe_account_idx
  on public.member_profiles (stripe_account_id)
  where stripe_account_id is not null;

-- The transfer that settled a payout, so a request can always be traced to the money.
alter table public.payout_requests
  add column if not exists stripe_transfer_id text;

create unique index if not exists payout_requests_transfer_unique
  on public.payout_requests (stripe_transfer_id)
  where stripe_transfer_id is not null;

notify pgrst, 'reload schema';
