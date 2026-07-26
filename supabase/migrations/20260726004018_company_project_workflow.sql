-- Core company-to-project workflow.
--
-- This migration is deliberately additive. It does not publish a member_project,
-- match a student, or move money. Browser roles receive no direct table access;
-- all authorization is enforced by the server API before it uses the service role.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(name) between 2 and 160)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint organization_members_role_allowed check (membership_role in ('owner', 'member'))
);

create unique index organization_members_user_unique_idx
  on public.organization_members (user_id);

create table public.company_intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft',
  classification text,
  company_name text,
  company_website text,
  company_industry text,
  company_size text,
  contact_name text,
  contact_email text,
  contact_role text,
  delayed_work_example text,
  delay_reason text,
  normal_owner text,
  occurrence_frequency text,
  desired_business_result text,
  final_deliverable text,
  named_reviewer text,
  acceptance_criteria text,
  company_review_minutes integer,
  employee_hours_avoided numeric(8,2),
  student_hours numeric(8,2),
  budget_cents integer,
  deadline date,
  available_context text,
  tools_required text,
  system_access text,
  data_classification text,
  confidentiality_concerns text,
  ai_use_policy text,
  restricted_information_declared boolean,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_intakes_status_allowed check (status in (
    'draft', 'submitted', 'under_review', 'needs_clarification',
    'classified', 'brief_created', 'closed'
  )),
  constraint company_intakes_classification_allowed check (
    classification is null or classification in (
      'suitable_short_project', 'needs_clarification', 'better_as_internship',
      'better_for_contractor', 'better_for_employee', 'better_for_ai', 'not_eligible'
    )
  ),
  constraint company_intakes_contact_email_format check (
    contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint company_intakes_review_minutes_range check (
    company_review_minutes is null or company_review_minutes between 0 and 10080
  ),
  constraint company_intakes_employee_hours_range check (
    employee_hours_avoided is null or employee_hours_avoided between 0 and 100000
  ),
  constraint company_intakes_student_hours_range check (
    student_hours is null or student_hours between 0 and 100000
  ),
  constraint company_intakes_budget_range check (
    budget_cents is null or budget_cents between 0 and 100000000
  ),
  constraint company_intakes_data_classification_allowed check (
    data_classification is null or data_classification in ('public', 'internal', 'confidential', 'restricted')
  ),
  constraint company_intakes_text_bounds check (
    char_length(coalesce(delayed_work_example, '')) <= 8000
    and char_length(coalesce(delay_reason, '')) <= 4000
    and char_length(coalesce(desired_business_result, '')) <= 4000
    and char_length(coalesce(final_deliverable, '')) <= 4000
    and char_length(coalesce(acceptance_criteria, '')) <= 4000
    and char_length(coalesce(available_context, '')) <= 8000
    and char_length(coalesce(confidentiality_concerns, '')) <= 4000
    and char_length(coalesce(ai_use_policy, '')) <= 4000
  )
);

create index company_intakes_organization_idx
  on public.company_intakes (organization_id, created_at desc);
create index company_intakes_operator_queue_idx
  on public.company_intakes (status, submitted_at asc)
  where status <> 'draft';

create table public.company_intake_attachments (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.company_intakes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes integer not null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint company_intake_attachments_name_length check (char_length(original_name) between 1 and 180),
  constraint company_intake_attachments_path_length check (char_length(storage_path) between 10 and 600),
  constraint company_intake_attachments_size check (size_bytes between 1 and 10485760)
);

create index company_intake_attachments_intake_idx
  on public.company_intake_attachments (intake_id, created_at);

create table public.company_intake_internal_notes (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.company_intakes(id) on delete cascade,
  note text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  constraint company_intake_internal_notes_length check (char_length(note) between 1 and 4000)
);

create index company_intake_internal_notes_intake_idx
  on public.company_intake_internal_notes (intake_id, created_at);

create table public.company_intake_clarifications (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.company_intakes(id) on delete cascade,
  missing_fields jsonb not null default '[]'::jsonb,
  request_message text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_by_email text not null,
  requested_at timestamptz not null default now(),
  company_response text,
  responded_by uuid references auth.users(id) on delete restrict,
  responded_at timestamptz,
  status text not null default 'open',
  constraint company_intake_clarifications_missing_fields_array check (jsonb_typeof(missing_fields) = 'array'),
  constraint company_intake_clarifications_request_length check (char_length(request_message) between 10 and 4000),
  constraint company_intake_clarifications_response_length check (
    company_response is null or char_length(company_response) between 1 and 8000
  ),
  constraint company_intake_clarifications_status_allowed check (status in ('open', 'responded', 'closed'))
);

create index company_intake_clarifications_intake_idx
  on public.company_intake_clarifications (intake_id, requested_at desc);

create table public.workflow_projects (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null unique references public.company_intakes(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'draft',
  current_version integer not null default 0,
  domain_reviewer_user_id uuid references auth.users(id) on delete set null,
  domain_reviewer_name text,
  domain_reviewer_email text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_projects_status_allowed check (
    status in ('draft', 'awaiting_approvals', 'approved_for_sourcing', 'closed')
  ),
  constraint workflow_projects_current_version_valid check (current_version >= 0),
  constraint workflow_projects_reviewer_email_format check (
    domain_reviewer_email is null or domain_reviewer_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create index workflow_projects_organization_idx
  on public.workflow_projects (organization_id, updated_at desc);
create index workflow_projects_status_idx
  on public.workflow_projects (status, updated_at desc);

create table public.project_brief_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.workflow_projects(id) on delete cascade,
  version_number integer not null,
  objective text not null,
  deliverables jsonb not null,
  approved_context text not null,
  student_responsibilities text not null,
  company_responsibilities text not null,
  out_of_scope text not null,
  milestones jsonb not null,
  acceptance_criteria text not null,
  compensation_cents integer not null,
  deadline date not null,
  ai_policy text not null,
  information_boundary text not null,
  required_reviewer text not null,
  company_response_expectation text not null,
  one_revision_rule boolean not null default true,
  change_summary text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  unique (project_id, version_number),
  constraint project_brief_versions_number_positive check (version_number > 0),
  constraint project_brief_versions_deliverables_array check (jsonb_typeof(deliverables) = 'array'),
  constraint project_brief_versions_milestones_array check (jsonb_typeof(milestones) = 'array'),
  constraint project_brief_versions_compensation_range check (compensation_cents between 0 and 100000000),
  constraint project_brief_versions_text_bounds check (
    char_length(objective) between 10 and 8000
    and char_length(approved_context) between 10 and 8000
    and char_length(student_responsibilities) between 10 and 8000
    and char_length(company_responsibilities) between 10 and 8000
    and char_length(out_of_scope) between 2 and 8000
    and char_length(acceptance_criteria) between 10 and 8000
    and char_length(ai_policy) between 2 and 4000
    and char_length(information_boundary) between 10 and 8000
    and char_length(required_reviewer) between 2 and 500
    and char_length(company_response_expectation) between 2 and 2000
    and char_length(coalesce(change_summary, '')) <= 2000
  )
);

create index project_brief_versions_project_idx
  on public.project_brief_versions (project_id, version_number desc);

create table public.project_brief_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.workflow_projects(id) on delete cascade,
  version_number integer not null,
  approval_type text not null,
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  approver_email text,
  approved_at timestamptz not null default now(),
  unique (project_id, version_number, approval_type),
  foreign key (project_id, version_number)
    references public.project_brief_versions(project_id, version_number)
    on delete cascade,
  constraint project_brief_approvals_type_allowed check (
    approval_type in ('covenda', 'company', 'reviewer')
  )
);

create index project_brief_approvals_project_idx
  on public.project_brief_approvals (project_id, version_number, approval_type);

-- Private supporting files. The API uploads and signs files only after it authorizes
-- the current member or operator. No storage.objects policy is added for browser roles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-intake-private',
  'company-intake-private',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.company_intakes enable row level security;
alter table public.company_intakes force row level security;
alter table public.company_intake_attachments enable row level security;
alter table public.company_intake_attachments force row level security;
alter table public.company_intake_internal_notes enable row level security;
alter table public.company_intake_internal_notes force row level security;
alter table public.company_intake_clarifications enable row level security;
alter table public.company_intake_clarifications force row level security;
alter table public.workflow_projects enable row level security;
alter table public.workflow_projects force row level security;
alter table public.project_brief_versions enable row level security;
alter table public.project_brief_versions force row level security;
alter table public.project_brief_approvals enable row level security;
alter table public.project_brief_approvals force row level security;

revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_members from public, anon, authenticated;
revoke all on table public.company_intakes from public, anon, authenticated;
revoke all on table public.company_intake_attachments from public, anon, authenticated;
revoke all on table public.company_intake_internal_notes from public, anon, authenticated;
revoke all on table public.company_intake_clarifications from public, anon, authenticated;
revoke all on table public.workflow_projects from public, anon, authenticated;
revoke all on table public.project_brief_versions from public, anon, authenticated;
revoke all on table public.project_brief_approvals from public, anon, authenticated;

grant select, insert, update on table public.organizations to service_role;
grant select, insert, update on table public.organization_members to service_role;
grant select, insert, update on table public.company_intakes to service_role;
grant select, insert on table public.company_intake_attachments to service_role;
grant select, insert on table public.company_intake_internal_notes to service_role;
grant select, insert, update on table public.company_intake_clarifications to service_role;
grant select, insert, update on table public.workflow_projects to service_role;
grant select, insert on table public.project_brief_versions to service_role;
grant select, insert on table public.project_brief_approvals to service_role;

comment on table public.company_intakes is
  'Private company work intake. Submission never creates or publishes a student project.';
comment on table public.company_intake_internal_notes is
  'Operator-only notes. Never include this table in company or student responses.';
comment on table public.project_brief_versions is
  'Immutable project brief versions. Approvals always reference the exact approved version.';
comment on table public.project_brief_approvals is
  'Covenda, company, and assigned reviewer approvals for a specific brief version.';

-- Version creation is atomic. The expected-version check prevents two operator tabs
-- from both creating the same next version or leaving an inserted version detached
-- from workflow_projects.current_version.
create or replace function public.create_workflow_project_version(
  p_project_id uuid,
  p_expected_current_version integer,
  p_objective text,
  p_deliverables jsonb,
  p_approved_context text,
  p_student_responsibilities text,
  p_company_responsibilities text,
  p_out_of_scope text,
  p_milestones jsonb,
  p_acceptance_criteria text,
  p_compensation_cents integer,
  p_deadline date,
  p_ai_policy text,
  p_information_boundary text,
  p_required_reviewer text,
  p_company_response_expectation text,
  p_one_revision_rule boolean,
  p_change_summary text,
  p_created_by uuid,
  p_created_by_email text
)
returns public.project_brief_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.workflow_projects;
  v_version public.project_brief_versions;
  v_next_version integer;
begin
  select * into v_project
  from public.workflow_projects
  where id = p_project_id
  for update;

  if not found then raise exception 'The project was not found.'; end if;
  if v_project.status = 'closed' then raise exception 'A closed project cannot receive a new brief version.'; end if;
  if v_project.current_version <> p_expected_current_version then
    raise exception 'The project brief changed. Reload before saving another version.';
  end if;

  v_next_version := v_project.current_version + 1;
  insert into public.project_brief_versions (
    project_id, version_number, objective, deliverables, approved_context,
    student_responsibilities, company_responsibilities, out_of_scope,
    milestones, acceptance_criteria, compensation_cents, deadline, ai_policy,
    information_boundary, required_reviewer, company_response_expectation,
    one_revision_rule, change_summary, created_by, created_by_email
  ) values (
    p_project_id, v_next_version, p_objective, p_deliverables, p_approved_context,
    p_student_responsibilities, p_company_responsibilities, p_out_of_scope,
    p_milestones, p_acceptance_criteria, p_compensation_cents, p_deadline, p_ai_policy,
    p_information_boundary, p_required_reviewer, p_company_response_expectation,
    p_one_revision_rule, p_change_summary, p_created_by, p_created_by_email
  )
  returning * into v_version;

  update public.workflow_projects
  set current_version = v_next_version,
      status = 'awaiting_approvals',
      updated_at = now()
  where id = p_project_id;

  return v_version;
end;
$$;

revoke all on function public.create_workflow_project_version(
  uuid, integer, text, jsonb, text, text, text, text, jsonb, text, integer,
  date, text, text, text, text, boolean, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.create_workflow_project_version(
  uuid, integer, text, jsonb, text, text, text, text, jsonb, text, integer,
  date, text, text, text, text, boolean, text, uuid, text
) to service_role;

-- Approval recording and the approved-for-sourcing transition are one transaction.
-- The API authorizes each actor first; this function is callable only by service_role
-- and enforces the current version plus assigned-reviewer invariant again.
create or replace function public.record_workflow_project_approval(
  p_project_id uuid,
  p_expected_version integer,
  p_approval_type text,
  p_approver_user_id uuid,
  p_approver_email text
)
returns public.workflow_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.workflow_projects;
  v_covenda boolean;
  v_company boolean;
  v_reviewer boolean;
begin
  if p_approval_type not in ('covenda', 'company', 'reviewer') then
    raise exception 'Choose a valid approval type.';
  end if;

  select * into v_project
  from public.workflow_projects
  where id = p_project_id
  for update;

  if not found then raise exception 'The project was not found.'; end if;
  if v_project.current_version = 0 then raise exception 'Create a project brief version before recording approval.'; end if;
  if v_project.current_version <> p_expected_version then
    raise exception 'The project brief changed. Reload before approving.';
  end if;
  if p_approval_type = 'reviewer'
    and v_project.domain_reviewer_user_id is distinct from p_approver_user_id then
    raise exception 'Only the assigned domain reviewer can approve this brief.';
  end if;

  insert into public.project_brief_approvals (
    project_id, version_number, approval_type, approver_user_id, approver_email, approved_at
  ) values (
    p_project_id, p_expected_version, p_approval_type, p_approver_user_id, p_approver_email, now()
  )
  on conflict (project_id, version_number, approval_type)
  do update set
    approver_user_id = excluded.approver_user_id,
    approver_email = excluded.approver_email,
    approved_at = excluded.approved_at;

  select exists (
    select 1 from public.project_brief_approvals
    where project_id = p_project_id and version_number = p_expected_version and approval_type = 'covenda'
  ) into v_covenda;
  select exists (
    select 1 from public.project_brief_approvals
    where project_id = p_project_id and version_number = p_expected_version and approval_type = 'company'
  ) into v_company;
  select exists (
    select 1 from public.project_brief_approvals
    where project_id = p_project_id and version_number = p_expected_version
      and approval_type = 'reviewer'
      and approver_user_id = v_project.domain_reviewer_user_id
  ) into v_reviewer;

  update public.workflow_projects
  set status = case
        when v_covenda and v_company and v_reviewer then 'approved_for_sourcing'
        else 'awaiting_approvals'
      end,
      updated_at = now()
  where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

revoke all on function public.record_workflow_project_approval(uuid, integer, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_workflow_project_approval(uuid, integer, text, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
