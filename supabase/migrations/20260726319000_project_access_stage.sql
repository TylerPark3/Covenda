-- Work-trial ladder made real: a project's access stage. 1 = bounded work-trial (no systems
-- access, the default). 2 = deeper access, which the accept flow only grants to a student who
-- has already completed a Stage 1 with the same company. Proof precedes access.
-- Backward compatible: default 1, and the app only writes this column when a project is
-- explicitly created as Stage 2, so everything works before this migration runs.

alter table if exists public.member_projects
  add column if not exists access_stage smallint not null default 1;
