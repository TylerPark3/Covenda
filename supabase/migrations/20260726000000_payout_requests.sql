-- Payout requests. A student's credits are an obligation Covenda owes them; until real
-- payment rails exist, this makes that obligation explicit and auditable instead of
-- implicit in a balance nobody acts on.
--
-- Deliberately does NOT store bank or card numbers. The student supplies a method and a
-- non-sensitive handle (a PayPal/Zelle email, say) and the operator arranges the actual
-- transfer out of band. Storing account numbers in a service-role table would turn a
-- credential leak into a financial-data breach, which is not a trade worth making for a
-- pilot. The API additionally rejects anything that looks like a raw account number.
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null,
  status text not null default 'requested',
  method text,
  handle text,
  note text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint payout_requests_status_allowed check (status in ('requested', 'paid', 'cancelled')),
  constraint payout_requests_credits_positive check (credits > 0),
  constraint payout_requests_method_length check (method is null or char_length(method) <= 40),
  constraint payout_requests_handle_length check (handle is null or char_length(handle) <= 160),
  constraint payout_requests_note_length check (note is null or char_length(note) <= 500)
);

-- At most one open request per student, so a double-click cannot queue two payouts.
create unique index if not exists payout_requests_one_open_per_user
  on public.payout_requests (user_id) where status = 'requested';
create index if not exists payout_requests_status_idx on public.payout_requests (status, requested_at desc);

-- A payout is a real ledger movement, so the ledger needs the entry type and a link back
-- to the request. The unique index makes fulfilment idempotent the same way escrow is.
alter table public.credit_ledger
  add column if not exists payout_request_id uuid references public.payout_requests(id) on delete set null;
create unique index if not exists credit_ledger_one_row_per_payout
  on public.credit_ledger (payout_request_id) where payout_request_id is not null;

alter table public.credit_ledger
  drop constraint if exists credit_ledger_entry_type_allowed,
  add constraint credit_ledger_entry_type_allowed
    check (entry_type in ('purchase', 'reach_fee', 'escrow_hold', 'escrow_release', 'platform_fee', 'refund', 'adjustment', 'payout')) not valid;

alter table public.payout_requests enable row level security;
alter table public.payout_requests force row level security;
revoke all on table public.payout_requests from public, anon, authenticated;
grant select, insert, update on table public.payout_requests to service_role;

-- Marking a payout paid debits the ledger and closes the request together, under a row
-- lock, re-checking the balance inside the transaction. A student can never be shown as
-- paid without the ledger reflecting it, and never debited twice.
create or replace function public.fulfil_payout_request(p_request_id uuid, p_operator_id uuid, p_note text)
returns public.payout_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.payout_requests;
  available integer;
begin
  select * into req from public.payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'This payout request is no longer available.';
  end if;
  if req.status <> 'requested' then
    raise exception 'This payout request has already been resolved.';
  end if;

  select coalesce(sum(credits), 0) into available from public.credit_ledger where user_id = req.user_id;
  if available < req.credits then
    raise exception 'This student no longer has enough credits for that payout.';
  end if;

  insert into public.credit_ledger (user_id, entry_type, credits, note, payout_request_id)
    values (req.user_id, 'payout', -req.credits, coalesce(p_note, 'Payout sent'), req.id);

  update public.payout_requests
     set status = 'paid', resolved_at = now(), resolved_by = p_operator_id, note = p_note
   where id = req.id
   returning * into req;
  return req;
end;
$$;

revoke all on function public.fulfil_payout_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fulfil_payout_request(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
