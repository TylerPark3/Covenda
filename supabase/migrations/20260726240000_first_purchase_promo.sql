-- §7 first-purchase promo. A company's first card purchase grants a one-time bonus, recorded
-- as a separate 'promo' ledger entry (distinct from 'purchase' so revenue vs incentive stay
-- separable). Idempotency is enforced by a per-user external_ref on the existing unique index,
-- so the bonus lands exactly once no matter how many times the webhook fires. Idempotent DDL.
alter table public.credit_ledger
  drop constraint if exists credit_ledger_entry_type_allowed,
  add constraint credit_ledger_entry_type_allowed
    check (entry_type in ('purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment', 'payout', 'ai_brief', 'promo')) not valid;

notify pgrst, 'reload schema';
