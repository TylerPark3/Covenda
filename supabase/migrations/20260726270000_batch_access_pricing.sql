-- §13 slice 3: company credit-gated access to a batch's admitted students.
-- Adds a per-batch access price (operator-set) and lets the append-only credit ledger record
-- a 'batch_access' charge. Access itself is recorded in public.batch_access (already exists).
-- 1 credit = $1; the whole access fee is Covenda platform revenue (no student payout, so no
-- platform-fee-on-top split — the company pays the price, the platform keeps it). Idempotent.

alter table public.batches
  add column if not exists access_credits integer not null default 25;

alter table public.batches
  drop constraint if exists batches_access_credits_nonneg,
  add constraint batches_access_credits_nonneg check (access_credits >= 0);

-- Extend the ledger's allowed entry types with 'batch_access'. The constraint is replaced
-- (drop + re-add) so re-running this migration is safe.
alter table public.credit_ledger
  drop constraint if exists credit_ledger_entry_type_allowed,
  add constraint credit_ledger_entry_type_allowed
    check (entry_type in ('purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment', 'batch_access'));

notify pgrst, 'reload schema';
