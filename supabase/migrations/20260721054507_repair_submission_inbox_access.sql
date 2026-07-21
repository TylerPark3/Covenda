-- Safe to run after the inbox table already exists. This restores the
-- server-only permissions required by supabase-js and refreshes PostgREST's
-- schema cache without granting browser roles access to private submissions.

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

revoke all on table public.submissions from public, anon, authenticated;
revoke all on sequence public.submissions_id_seq from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update on table public.submissions to service_role;
grant usage, select on sequence public.submissions_id_seq to service_role;

notify pgrst, 'reload schema';
