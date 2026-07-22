create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  display_name text not null,
  organization_name text,
  school_name text,
  headline text,
  bio text,
  skills jsonb not null default '[]'::jsonb,
  graduation_year smallint,
  portfolio_visibility text not null default 'members',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_profiles_role_allowed check (role in ('student', 'company', 'university')),
  constraint member_profiles_name_length check (char_length(display_name) between 1 and 120),
  constraint member_profiles_skills_array check (jsonb_typeof(skills) = 'array'),
  constraint member_profiles_graduation_year check (graduation_year is null or graduation_year between 2020 and 2100),
  constraint member_profiles_visibility_allowed check (portfolio_visibility in ('private', 'members'))
);

create table public.member_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_student_user_id uuid references auth.users(id) on delete set null,
  source_submission_reference text references public.submissions(reference) on update cascade on delete set null,
  title text not null,
  summary text not null,
  deliverable text,
  status text not null default 'draft',
  visibility text not null default 'private',
  desired_skills jsonb not null default '[]'::jsonb,
  budget_cents integer,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_projects_title_length check (char_length(title) between 3 and 160),
  constraint member_projects_summary_length check (char_length(summary) between 10 and 5000),
  constraint member_projects_status_allowed check (status in ('draft', 'scoping', 'open', 'matched', 'in_progress', 'review', 'complete', 'archived')),
  constraint member_projects_visibility_allowed check (visibility in ('private', 'members', 'open')),
  constraint member_projects_skills_array check (jsonb_typeof(desired_skills) = 'array'),
  constraint member_projects_budget_positive check (budget_cents is null or budget_cents >= 0)
);

create table public.project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.member_projects(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_applications_unique_student unique (project_id, student_user_id),
  constraint project_applications_note_length check (note is null or char_length(note) <= 2000),
  constraint project_applications_status_allowed check (status in ('submitted', 'reviewing', 'shortlisted', 'accepted', 'declined', 'withdrawn'))
);

create index member_profiles_role_idx on public.member_profiles (role, updated_at desc);
create index member_projects_owner_idx on public.member_projects (owner_user_id, updated_at desc);
create index member_projects_student_idx on public.member_projects (assigned_student_user_id, updated_at desc) where assigned_student_user_id is not null;
create index member_projects_discover_idx on public.member_projects (status, visibility, created_at desc);
create index project_applications_student_idx on public.project_applications (student_user_id, updated_at desc);
create index project_applications_project_idx on public.project_applications (project_id, updated_at desc);

comment on table public.member_profiles is 'Private role-aware member profiles. Authorization is mediated by the Covenda portal API.';
comment on table public.member_projects is 'Company and university projects visible only through authenticated, role-aware portal API queries.';
comment on table public.project_applications is 'Student applications to member projects, protected by the portal API.';

alter table public.member_profiles enable row level security;
alter table public.member_profiles force row level security;
alter table public.member_projects enable row level security;
alter table public.member_projects force row level security;
alter table public.project_applications enable row level security;
alter table public.project_applications force row level security;

revoke all on table public.member_profiles from public, anon, authenticated;
revoke all on table public.member_projects from public, anon, authenticated;
revoke all on table public.project_applications from public, anon, authenticated;

grant select, insert, update, delete on table public.member_profiles to service_role;
grant select, insert, update, delete on table public.member_projects to service_role;
grant select, insert, update, delete on table public.project_applications to service_role;

notify pgrst, 'reload schema';
