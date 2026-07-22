-- Escrow settlement. These run as database functions rather than API calls because the
-- ledger writes and the project status change MUST commit together: a completed project
-- with an unpaid student, or a payout on an incomplete project, are both unacceptable.
--
-- Each function locks the project row (for update) so two concurrent accepts serialize,
-- re-checks ownership and status inside the transaction, and relies on the partial unique
-- indexes from 20260725000000 (one escrow_release / one refund per project) as a final
-- backstop — a race that slips past the status check still cannot pay twice.
--
-- security definer + a pinned search_path so the function runs with the owner's rights
-- against known schemas. Execute is granted to service_role only; the portal API remains
-- the sole gatekeeper and still checks the caller before invoking these.

create or replace function public.release_project_escrow(p_project_id uuid, p_owner_id uuid)
returns public.member_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proj public.member_projects;
begin
  select * into proj from public.member_projects where id = p_project_id for update;
  if not found then
    raise exception 'This project is no longer available.';
  end if;
  if proj.owner_user_id is distinct from p_owner_id then
    raise exception 'Only the project owner can review a deliverable.';
  end if;
  if proj.status <> 'review' then
    raise exception 'This project has no submitted deliverable to review.';
  end if;
  if proj.assigned_student_user_id is null then
    raise exception 'This project has no assigned student to pay.';
  end if;

  -- The student receives the FULL listed amount; the 10% was collected separately at
  -- hold time and is booked to the platform here, never netted out of the payout.
  if proj.credits_held > 0 then
    insert into public.credit_ledger (user_id, entry_type, credits, project_id, note)
      values (proj.assigned_student_user_id, 'escrow_release', proj.credits_held, proj.id, 'Accepted work payout');
  end if;
  if proj.platform_fee_credits > 0 then
    insert into public.credit_ledger (user_id, entry_type, credits, project_id, note)
      values (null, 'platform_fee', proj.platform_fee_credits, proj.id, 'Platform fee on accepted work');
  end if;

  update public.member_projects
     set status = 'complete', completed_at = now(), credits_held = 0, updated_at = now()
   where id = proj.id
   returning * into proj;
  return proj;
end;
$$;

-- Cancelling before completion returns the whole held amount to the company. The escrow
-- hold was (listed + platform fee), so both come back — charging a fee for work that was
-- never accepted would be wrong. The reach fee is NOT refunded: the post was distributed.
create or replace function public.refund_project_escrow(p_project_id uuid, p_owner_id uuid)
returns public.member_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proj public.member_projects;
  refund_total integer;
begin
  select * into proj from public.member_projects where id = p_project_id for update;
  if not found then
    raise exception 'This project is no longer available.';
  end if;
  if proj.owner_user_id is distinct from p_owner_id then
    raise exception 'Only the project owner can cancel a project.';
  end if;
  if proj.status in ('complete', 'archived') then
    raise exception 'This project is already finished.';
  end if;

  refund_total := coalesce(proj.credits_held, 0) + coalesce(proj.platform_fee_credits, 0);
  if refund_total > 0 then
    insert into public.credit_ledger (user_id, entry_type, credits, project_id, note)
      values (proj.owner_user_id, 'refund', refund_total, proj.id, 'Cancelled before completion');
  end if;

  update public.member_projects
     set status = 'archived', credits_held = 0, platform_fee_credits = 0, updated_at = now()
   where id = proj.id
   returning * into proj;
  return proj;
end;
$$;

revoke all on function public.release_project_escrow(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refund_project_escrow(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_project_escrow(uuid, uuid) to service_role;
grant execute on function public.refund_project_escrow(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
