-- §6 brokered requests. Instead of only posting projects directly, a company can ASK Covenda
-- to package work — a new project, more students on an existing one, a scope change, a
-- revision, a consult, a question, or a specific student. An operator triages/packages these
-- (in admin) and, for a new_project, publishes a member_project. Keeping this brokered is the
-- moat: it's why a company works through Covenda rather than going around it to LinkedIn.
create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.member_projects(id) on delete set null,
  request_type text not null,
  subject text,
  details text not null,
  status text not null default 'submitted',
  resolution_note text,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_requests_type_allowed
    check (request_type in ('new_project', 'more_students', 'scope_change', 'revision', 'consult', 'question', 'specific_student')),
  constraint project_requests_status_allowed
    check (status in ('submitted', 'in_packaging', 'packaged', 'declined', 'closed')),
  constraint project_requests_subject_length check (subject is null or char_length(subject) <= 200),
  constraint project_requests_details_length check (char_length(details) between 1 and 5000),
  constraint project_requests_resolution_length check (resolution_note is null or char_length(resolution_note) <= 2000)
);
create index if not exists project_requests_company_idx on public.project_requests (company_user_id, created_at desc);
create index if not exists project_requests_status_idx on public.project_requests (status, created_at desc);

-- Service-role only, like every other private table. The API is the sole gatekeeper.
alter table public.project_requests enable row level security;
alter table public.project_requests force row level security;
revoke all on table public.project_requests from public, anon, authenticated;
grant select, insert, update on table public.project_requests to service_role;

notify pgrst, 'reload schema';
