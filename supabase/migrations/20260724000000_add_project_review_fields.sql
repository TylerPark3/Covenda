-- Close-the-loop review fields on member_projects: when did the assigned student
-- submit a deliverable, what did the reviewer ask to be revised, and when was the
-- work accepted. Idempotent (add column if not exists) so it is safe to re-run on
-- the live table. RLS / grants are unchanged — the portal API stays the sole
-- gatekeeper; these columns are written only by owner/assignee-checked actions.
alter table public.member_projects
  add column if not exists deliverable_submitted_at timestamptz,
  add column if not exists review_note text,
  add column if not exists completed_at timestamptz;

alter table public.member_projects
  drop constraint if exists member_projects_review_note_length,
  add constraint member_projects_review_note_length check (review_note is null or char_length(review_note) <= 2000) not valid;

-- Faster lookup of projects awaiting a reviewer decision (owner review queue).
create index if not exists member_projects_review_idx on public.member_projects (status, updated_at desc) where status = 'review';

-- Refresh the Data API so the new columns are queryable immediately.
notify pgrst, 'reload schema';
