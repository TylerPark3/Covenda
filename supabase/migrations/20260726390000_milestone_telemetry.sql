-- Stage 4 telemetry: the one column the milestone runtime needs that Stage 0 did not add.
--
-- Stage 0 created `milestones`, `founder_eval`, `rubric_scores` and
-- `founder_time_actual_min_week` but no backup assignee — so "reassign to a pre-selected
-- backup", the flake defense the whole stage is built around, had nowhere to read from.
-- Without this, api/milestones.js can only ever escalate to an operator.
--
-- Idempotent; safe to re-run.

alter table public.member_projects
  add column if not exists backup_user_id uuid references auth.users(id) on delete set null;

-- Finding the projects whose active milestone has gone quiet is the query this stage runs
-- constantly; without an index it degrades into a full scan as project volume grows.
create index if not exists member_projects_active_milestone_idx
  on public.member_projects (status, updated_at desc)
  where status in ('active', 'in_progress');

notify pgrst, 'reload schema';
