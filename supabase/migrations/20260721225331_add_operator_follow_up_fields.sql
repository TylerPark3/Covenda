-- Add server-only workflow context to the existing Covenda submission inbox.
-- These fields are never returned by the public receipt endpoint.

alter table public.submissions
  add column if not exists internal_note text not null default '',
  add column if not exists follow_up_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

alter table public.submissions
  drop constraint if exists submissions_internal_note_length,
  add constraint submissions_internal_note_length
    check (char_length(internal_note) <= 2000) not valid,
  drop constraint if exists submissions_reviewed_by_length,
  add constraint submissions_reviewed_by_length
    check (reviewed_by is null or char_length(reviewed_by) <= 254) not valid;

create index if not exists submissions_follow_up_at_idx
  on public.submissions (follow_up_at)
  where follow_up_at is not null;

comment on column public.submissions.internal_note is
  'Private operator context. Available only through the authenticated server-side admin route.';
comment on column public.submissions.follow_up_at is
  'Optional operator follow-up time used for inbox triage.';
comment on column public.submissions.reviewed_by is
  'Normalized email of the last authorized operator to update workflow fields.';
comment on column public.submissions.reviewed_at is
  'Time of the latest authenticated operator workflow update.';

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

revoke all on table public.submissions from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on table public.submissions to service_role;

notify pgrst, 'reload schema';
