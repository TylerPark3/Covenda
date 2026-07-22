-- Covenda credits. 1 credit = $1. The ledger is the ONLY source of truth for a
-- balance: balance = sum(credits) where user_id = <member>. Rows with user_id = null
-- are Covenda platform revenue and never affect a member balance.
--
-- Money rules encoded here:
--   * public post = free, hyper-narrow (vertical/work-type + referred students) = 25 credits
--   * platform fee = 10% of the listed amount, charged ON TOP (the student always
--     receives the full listed amount; the fee is never netted out of their payout)
--   * escrow is held at post and released on acceptance
-- Payments are STUBBED in v1 — `purchase` rows are granted, not charged, and the API
-- gates that behind an env flag so credits cannot be minted in production.
--
-- Idempotent; RLS + service-role only, and the ledger is APPEND-ONLY (no update/delete
-- grant) so history cannot be rewritten.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  entry_type text not null,
  credits integer not null,
  project_id uuid references public.member_projects(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint credit_ledger_entry_type_allowed
    check (entry_type in ('purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment')),
  constraint credit_ledger_note_length check (note is null or char_length(note) <= 500),
  constraint credit_ledger_credits_nonzero check (credits <> 0)
);

create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
create index if not exists credit_ledger_project_idx on public.credit_ledger (project_id, entry_type);
-- Database-level double-pay guard: a project can only ever be released once. Any retry
-- or double-click that races past the application check fails here instead of paying twice.
create unique index if not exists credit_ledger_one_release_per_project
  on public.credit_ledger (project_id) where entry_type = 'escrow_release';
-- Same guard for the refund path, so a cancelled project cannot be refunded twice.
create unique index if not exists credit_ledger_one_refund_per_project
  on public.credit_ledger (project_id) where entry_type = 'refund';

alter table public.member_projects
  add column if not exists credits_listed integer,
  add column if not exists targeting text not null default 'public',
  add column if not exists credits_held integer not null default 0,
  add column if not exists platform_fee_credits integer not null default 0;

alter table public.member_projects
  drop constraint if exists member_projects_targeting_allowed,
  add constraint member_projects_targeting_allowed check (targeting in ('public', 'targeted')) not valid;
alter table public.member_projects
  drop constraint if exists member_projects_credits_nonnegative,
  add constraint member_projects_credits_nonnegative
    check (coalesce(credits_listed, 0) >= 0 and credits_held >= 0 and platform_fee_credits >= 0) not valid;

alter table public.credit_ledger enable row level security;
alter table public.credit_ledger force row level security;
revoke all on table public.credit_ledger from public, anon, authenticated;
-- Append-only on purpose: select + insert, never update or delete.
grant select, insert on table public.credit_ledger to service_role;

comment on table public.credit_ledger is
  'Append-only credit ledger. Balance = sum(credits) per user_id; user_id null = Covenda platform revenue.';

notify pgrst, 'reload schema';
