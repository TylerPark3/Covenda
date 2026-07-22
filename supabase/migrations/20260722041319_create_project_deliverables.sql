create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.member_projects(id) on delete cascade,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  artifact_type text not null default 'document',
  artifact_url text not null,
  notes text,
  status text not null default 'submitted',
  revision smallint not null default 1,
  review_note text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_deliverables_title_length check (char_length(title) between 3 and 160),
  constraint project_deliverables_type_allowed check (artifact_type in ('document', 'presentation', 'dashboard', 'repository', 'other')),
  constraint project_deliverables_url_safe check (char_length(artifact_url) <= 2048 and artifact_url ~* '^https?://'),
  constraint project_deliverables_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint project_deliverables_status_allowed check (status in ('submitted', 'changes_requested', 'accepted')),
  constraint project_deliverables_revision_range check (revision between 1 and 50),
  constraint project_deliverables_review_note_length check (review_note is null or char_length(review_note) <= 2000),
  constraint project_deliverables_review_consistent check (
    (status = 'submitted' and reviewed_at is null)
    or (status in ('changes_requested', 'accepted') and reviewed_at is not null)
  ),
  constraint project_deliverables_changes_note_required check (status <> 'changes_requested' or char_length(review_note) >= 3)
);

create index if not exists project_deliverables_project_created_idx
  on public.project_deliverables (project_id, created_at desc);

create index if not exists project_deliverables_project_status_idx
  on public.project_deliverables (project_id, status, updated_at desc);

comment on table public.project_deliverables is
  'Versioned evidence links submitted and reviewed inside a matched Covenda project.';

alter table public.project_deliverables enable row level security;
alter table public.project_deliverables force row level security;

revoke all on table public.project_deliverables from public, anon, authenticated;
revoke delete on table public.project_deliverables from service_role;
grant select, insert, update on table public.project_deliverables to service_role;

notify pgrst, 'reload schema';
