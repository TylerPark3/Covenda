-- Private project threads are mediated by the Covenda portal API. Browser
-- roles never receive direct table access, even after authenticating.
create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.member_projects(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint project_messages_body_length check (char_length(body) between 1 and 4000)
);

create index project_messages_project_created_idx
  on public.project_messages (project_id, created_at asc);

create index project_messages_author_idx
  on public.project_messages (author_user_id);

comment on table public.project_messages is
  'Private project conversation history returned only through role-aware portal API checks.';

alter table public.project_messages enable row level security;
alter table public.project_messages force row level security;

revoke all on table public.project_messages from public, anon, authenticated;
grant select, insert on table public.project_messages to service_role;
