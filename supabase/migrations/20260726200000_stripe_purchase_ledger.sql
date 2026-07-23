-- Stripe money-in. A purchase is recorded from the Stripe webhook, keyed to the Stripe
-- Checkout session id so the write is idempotent — Stripe retries webhooks, and this
-- guarantees a single session can only ever grant credits once. Idempotent; RLS/grants
-- unchanged (the webhook writes with the service role, verified by Stripe's signature).
alter table public.credit_ledger
  add column if not exists external_ref text;

create unique index if not exists credit_ledger_external_ref_unique
  on public.credit_ledger (external_ref) where external_ref is not null;

notify pgrst, 'reload schema';
