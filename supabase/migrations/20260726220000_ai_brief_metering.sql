-- §2 AI-brief metering. Generating a structured brief can cost credits (default 5). Allow
-- the new 'ai_brief' ledger entry type. `not valid` skips re-checking existing rows (they
-- already comply); new inserts are checked. Idempotent.
alter table public.credit_ledger
  drop constraint if exists credit_ledger_entry_type_allowed,
  add constraint credit_ledger_entry_type_allowed
    check (entry_type in ('purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment', 'payout', 'ai_brief')) not valid;

notify pgrst, 'reload schema';
