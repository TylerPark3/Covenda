-- Student-controlled company discovery with a recorded human review.
--
-- A profile starts private. The student makes an explicit request, an operator records a
-- decision and rationale, and only an approved request can move the profile to
-- company_visible. The browser never receives direct table access.

create table if not exists public.student_visibility_reviews (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  student_note text,
  operator_note text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  updated_at timestamptz not null default now(),

  constraint student_visibility_reviews_status_allowed
    check (status in ('pending', 'approved', 'needs_changes', 'declined', 'withdrawn')),
  constraint student_visibility_reviews_student_note_length
    check (student_note is null or char_length(student_note) <= 1000),
  constraint student_visibility_reviews_operator_note_length
    check (operator_note is null or char_length(operator_note) <= 2000),
  constraint student_visibility_reviews_snapshot_object
    check (jsonb_typeof(profile_snapshot) = 'object'),
  constraint student_visibility_reviews_decision_note
    check (status not in ('needs_changes', 'declined') or nullif(btrim(operator_note), '') is not null)
);

create unique index if not exists student_visibility_reviews_one_pending
  on public.student_visibility_reviews (student_user_id)
  where status = 'pending';
create index if not exists student_visibility_reviews_queue_idx
  on public.student_visibility_reviews (status, requested_at asc);
create index if not exists student_visibility_reviews_student_idx
  on public.student_visibility_reviews (student_user_id, requested_at desc);

alter table public.student_visibility_reviews enable row level security;
alter table public.student_visibility_reviews force row level security;
revoke all on table public.student_visibility_reviews from public, anon, authenticated;
grant select, insert, update on table public.student_visibility_reviews to service_role;

-- One transaction owns both the review receipt and the discovery state. This prevents an
-- approved receipt with a still-private profile (or the reverse) if one write fails.
create or replace function public.review_student_visibility(
  p_review_id uuid,
  p_decision text,
  p_operator_note text,
  p_reviewed_by text
) returns public.student_visibility_reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review public.student_visibility_reviews;
begin
  if p_decision not in ('approved', 'needs_changes', 'declined') then
    raise exception 'invalid visibility decision';
  end if;
  if p_decision in ('needs_changes', 'declined')
     and nullif(btrim(coalesce(p_operator_note, '')), '') is null then
    raise exception 'operator note required';
  end if;

  select * into v_review
  from public.student_visibility_reviews
  where id = p_review_id and status = 'pending'
  for update;
  if not found then
    raise exception 'visibility review is no longer pending';
  end if;

  update public.student_visibility_reviews
  set status = p_decision,
      operator_note = nullif(btrim(p_operator_note), ''),
      reviewed_by = nullif(lower(btrim(p_reviewed_by)), ''),
      reviewed_at = now(),
      updated_at = now()
  where id = p_review_id
  returning * into v_review;

  update public.member_profiles
  set profile_state = case
        when p_decision = 'approved' then 'company_visible'
        when p_decision = 'declined' then 'paused'
        else 'profile_complete'
      end,
      discovery_opt_in = p_decision = 'approved',
      portfolio_visibility = case when p_decision = 'approved' then 'members' else 'private' end,
      updated_at = now()
  where user_id = v_review.student_user_id and role = 'student';

  if not found then
    raise exception 'student profile not found';
  end if;
  return v_review;
end;
$$;

revoke all on function public.review_student_visibility(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.review_student_visibility(uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
