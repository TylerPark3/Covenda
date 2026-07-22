-- Brokered company/university requests. A requester can ask Covenda for work, but
-- only an authenticated operator can turn that request into a student-visible
-- Project Packet. This table is deliberately server-only: browser clients never
-- receive direct grants, even when they have a valid Supabase session.
create table public.project_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  related_project_id uuid references public.member_projects(id) on delete set null,
  project_id uuid references public.member_projects(id) on delete set null,
  request_type text not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  operator_note text,
  ai_brief jsonb not null default '{}'::jsonb,
  packet_draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_requests_type_allowed check (request_type in (
    'new_project', 'more_students', 'scope_change', 'revision',
    'consult', 'question', 'specific_student'
  )),
  constraint project_requests_status_allowed check (status in (
    'submitted', 'in_packaging', 'packaged', 'declined', 'closed'
  )),
  constraint project_requests_body_length check (char_length(body) between 10 and 8000),
  constraint project_requests_operator_note_length check (operator_note is null or char_length(operator_note) <= 2000),
  constraint project_requests_attachments_array check (jsonb_typeof(attachments) = 'array'),
  constraint project_requests_ai_brief_object check (jsonb_typeof(ai_brief) = 'object'),
  constraint project_requests_packet_draft_object check (jsonb_typeof(packet_draft) = 'object')
);

create index project_requests_requester_idx
  on public.project_requests (requester_user_id, updated_at desc);
create index project_requests_packaging_idx
  on public.project_requests (status, created_at asc);

alter table public.project_requests enable row level security;
alter table public.project_requests force row level security;
revoke all on table public.project_requests from public, anon, authenticated;
grant select, insert, update on table public.project_requests to service_role;

comment on table public.project_requests is
  'Server-only brokered work requests. Operators package approved requests before any student can see them.';

alter table public.member_projects
  add column if not exists acceptance_criteria text,
  add column if not exists safe_inputs text;

alter table public.member_projects
  drop constraint if exists member_projects_acceptance_criteria_length,
  add constraint member_projects_acceptance_criteria_length
    check (acceptance_criteria is null or char_length(acceptance_criteria) <= 4000) not valid;
alter table public.member_projects
  drop constraint if exists member_projects_safe_inputs_length,
  add constraint member_projects_safe_inputs_length
    check (safe_inputs is null or char_length(safe_inputs) <= 4000) not valid;

-- Publishing and escrow happen in one transaction. The request row is locked so a
-- double-click or retry can never create a second project or charge escrow twice.
create or replace function public.publish_project_request(
  p_request_id uuid,
  p_operator_email text,
  p_title text,
  p_summary text,
  p_deliverable text,
  p_acceptance_criteria text,
  p_safe_inputs text,
  p_credits integer,
  p_verticals jsonb default '[]'::jsonb,
  p_work_types jsonb default '[]'::jsonb,
  p_desired_skills jsonb default '[]'::jsonb,
  p_target_date date default null
)
returns public.member_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.project_requests;
  v_project public.member_projects;
  v_balance integer;
  v_platform_fee integer;
begin
  select * into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Project request was not found.'; end if;
  if v_request.status = 'packaged' and v_request.project_id is not null then
    select * into v_project from public.member_projects where id = v_request.project_id;
    return v_project;
  end if;
  if v_request.status not in ('submitted', 'in_packaging') then
    raise exception 'Only submitted or in-packaging requests can be published.';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 160 then raise exception 'Enter a valid packet title.'; end if;
  if char_length(trim(coalesce(p_summary, ''))) not between 10 and 5000 then raise exception 'Enter a valid packet summary.'; end if;
  if char_length(trim(coalesce(p_deliverable, ''))) not between 10 and 2000 then raise exception 'Define a useful deliverable.'; end if;
  if char_length(trim(coalesce(p_acceptance_criteria, ''))) not between 10 and 4000 then raise exception 'Define acceptance criteria.'; end if;
  if char_length(trim(coalesce(p_safe_inputs, ''))) not between 10 and 4000 then raise exception 'Define safe inputs.'; end if;
  if p_credits is null or p_credits < 1 or p_credits > 100000 then raise exception 'Choose a valid credit amount.'; end if;
  if jsonb_typeof(p_verticals) <> 'array' or jsonb_typeof(p_work_types) <> 'array' or jsonb_typeof(p_desired_skills) <> 'array' then
    raise exception 'Packet taxonomies must be arrays.';
  end if;

  v_platform_fee := round(p_credits * 0.10);
  select coalesce(sum(credits), 0)::integer into v_balance
  from public.credit_ledger where user_id = v_request.requester_user_id;
  if v_balance < p_credits + v_platform_fee then
    raise exception 'The requester needs % credits but has %.', p_credits + v_platform_fee, v_balance;
  end if;

  if v_request.request_type not in ('scope_change', 'revision') or v_request.related_project_id is null then
    insert into public.member_projects (
      owner_user_id, title, summary, deliverable, acceptance_criteria, safe_inputs,
      status, visibility, desired_skills, target_date, verticals, work_types,
      problem_text, attachments, ai_brief, credits_listed, targeting,
      credits_held, platform_fee_credits, updated_at
    ) values (
      v_request.requester_user_id, trim(p_title), trim(p_summary), trim(p_deliverable),
      trim(p_acceptance_criteria), trim(p_safe_inputs), 'open', 'members',
      p_desired_skills, p_target_date, p_verticals, p_work_types,
      v_request.body, v_request.attachments, v_request.ai_brief, p_credits, 'public',
      p_credits, v_platform_fee, now()
    ) returning * into v_project;
  else
    update public.member_projects set
      title = trim(p_title), summary = trim(p_summary), deliverable = trim(p_deliverable),
      acceptance_criteria = trim(p_acceptance_criteria), safe_inputs = trim(p_safe_inputs),
      status = 'open', visibility = 'members', desired_skills = p_desired_skills,
      target_date = p_target_date, verticals = p_verticals, work_types = p_work_types,
      attachments = v_request.attachments, ai_brief = v_request.ai_brief,
      credits_listed = p_credits, targeting = 'public',
      credits_held = credits_held + p_credits,
      platform_fee_credits = platform_fee_credits + v_platform_fee,
      updated_at = now()
    where id = v_request.related_project_id and owner_user_id = v_request.requester_user_id
    returning * into v_project;
    if not found then raise exception 'The related project is not owned by this requester.'; end if;
  end if;

  insert into public.credit_ledger (user_id, entry_type, credits, project_id, note)
  values (
    v_request.requester_user_id, 'escrow_hold', -(p_credits + v_platform_fee),
    v_project.id, 'Operator-published packet escrow: ' || p_credits || ' listed + ' || v_platform_fee || ' platform fee'
  );

  update public.project_requests set
    project_id = v_project.id,
    status = 'packaged',
    operator_note = 'Published by ' || left(trim(coalesce(p_operator_email, 'Covenda operator')), 254),
    packet_draft = jsonb_build_object(
      'title', trim(p_title), 'summary', trim(p_summary), 'deliverable', trim(p_deliverable),
      'acceptanceCriteria', trim(p_acceptance_criteria), 'safeInputs', trim(p_safe_inputs),
      'credits', p_credits, 'verticals', p_verticals, 'workTypes', p_work_types,
      'desiredSkills', p_desired_skills, 'targetDate', p_target_date
    ),
    updated_at = now()
  where id = v_request.id;

  return v_project;
end;
$$;

revoke all on function public.publish_project_request(uuid, text, text, text, text, text, text, integer, jsonb, jsonb, jsonb, date)
  from public, anon, authenticated;
grant execute on function public.publish_project_request(uuid, text, text, text, text, text, text, integer, jsonb, jsonb, jsonb, date)
  to service_role;

notify pgrst, 'reload schema';
