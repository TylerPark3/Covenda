create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.member_projects(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'planned',
  due_date date,
  position smallint not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_milestones_title_length check (char_length(title) between 3 and 160),
  constraint project_milestones_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint project_milestones_status_allowed check (status in ('planned', 'in_progress', 'blocked', 'complete')),
  constraint project_milestones_position_range check (position between 0 and 1000),
  constraint project_milestones_completion_consistent check ((status = 'complete') = (completed_at is not null))
);

create index if not exists project_milestones_project_position_idx
  on public.project_milestones (project_id, position, created_at);

create index if not exists project_milestones_project_status_idx
  on public.project_milestones (project_id, status, due_date)
  where status <> 'complete';

comment on table public.project_milestones is
  'Shared delivery checkpoints for matched projects. Access is mediated by the Covenda portal API.';

alter table public.project_milestones enable row level security;
alter table public.project_milestones force row level security;

revoke all on table public.project_milestones from public, anon, authenticated;
revoke delete on table public.project_milestones from service_role;
grant select, insert, update on table public.project_milestones to service_role;

notify pgrst, 'reload schema';
