-- Student discovery instrumentation and bookmarks.
-- Both tables are deliberately server-only: the portal API verifies the authenticated
-- member, computes fit explanations, and writes through the service role.

create table if not exists public.saved_projects (
  student_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.member_projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_user_id, project_id)
);

create index if not exists saved_projects_project_idx
  on public.saved_projects(project_id, created_at desc);

alter table public.saved_projects enable row level security;
alter table public.saved_projects force row level security;
revoke all on table public.saved_projects from public, anon, authenticated;
revoke all on table public.saved_projects from service_role;
grant select, insert, delete on table public.saved_projects to service_role;

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.member_projects(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'surfaced', 'viewed', 'applied', 'accepted', 'declined', 'submitted',
    'revision_requested', 'completed', 'cancelled'
  )),
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  fit_score smallint check (fit_score between 0 and 100),
  fit_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(fit_reasons) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists match_events_student_created_idx
  on public.match_events(student_user_id, created_at desc);
create index if not exists match_events_project_type_created_idx
  on public.match_events(project_id, event_type, created_at desc);

alter table public.match_events enable row level security;
alter table public.match_events force row level security;
revoke all on table public.match_events from public, anon, authenticated;
revoke all on table public.match_events from service_role;
-- Append-only by design: no role receives update or delete.
grant select, insert on table public.match_events to service_role;

comment on table public.match_events is
  'Append-only project-to-student fit events. Scores describe a specific pairing, never a universal student rank.';
comment on column public.match_events.features is
  'Bounded server-computed feature snapshot; never include protected attributes or school prestige.';

notify pgrst, 'reload schema';
