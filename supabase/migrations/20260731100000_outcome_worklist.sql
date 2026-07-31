-- Close the outcome loop.
--
-- ── WHY ───────────────────────────────────────────────────────────────────────────────
-- placement_outcomes has existed since 20260729100000 and api/admin.js has had a
-- `record-outcome` action almost as long. Neither portal.js nor admin.js references the table.
-- There has never been a way to record an outcome.
--
-- That matters more than a missing form. Chapter 32's north star is "successful evidence-backed
-- student-company relationships" and Chapter 31.5's economic unit ends in "one recorded
-- outcome". Compatibility calibration, hiring memory and the ML export all read a table that
-- nothing writes to. The pilot cannot produce learnable data until this closes.
--
-- ── WHAT THIS ADDS ────────────────────────────────────────────────────────────────────
-- Two nullable columns. Nullable on purpose: every existing row and every existing caller of
-- record-outcome stays valid, so this cannot break the action that is already shipped.
--
--   result           what actually happened, from a fixed vocabulary
--   introduction_id  which introduction this closes
--
-- `result` is a small closed set rather than free text. The operator worklist has to ask "which
-- accepted introductions still have no outcome", and that question cannot be answered against a
-- note field. The vocabulary matches what a founder can actually report without guessing:
-- whether a conversation happened, whether work followed, and whether it ended.
--
-- introduction_id is what makes the worklist cheap — outstanding work is an anti-join rather
-- than a fuzzy match on (student, company) pairs, which would silently mis-link a company that
-- ran two searches for the same student.
--
-- Idempotent: safe to re-run.

alter table public.placement_outcomes
  add column if not exists result text,
  add column if not exists introduction_id uuid references public.introductions(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'placement_outcomes_result_allowed'
  ) then
    alter table public.placement_outcomes
      add constraint placement_outcomes_result_allowed
      check (result is null or result in (
        'no_response',      -- introduction accepted, conversation never happened
        'interviewed',      -- they spoke, nothing further yet
        'no_fit',           -- evaluated, declined
        'project',          -- bounded paid work started
        'trial',            -- paid trial started
        'hired',            -- internship, part-time or full-time
        'withdrawn'         -- student withdrew
      ));
  end if;
end $$;

-- The worklist query: accepted introductions with no outcome, oldest first. Both sides of the
-- anti-join are indexed so the operator's daily view stays cheap as the pilot grows.
create index if not exists placement_outcomes_introduction_idx
  on public.placement_outcomes (introduction_id);

create index if not exists placement_outcomes_student_recorded_idx
  on public.placement_outcomes (student_user_id, recorded_at desc);

create index if not exists introductions_status_created_idx
  on public.introductions (status, created_at);

-- Same posture as every other table holding student data: no browser role reaches it directly.
-- All access is through /api/* on the service role.
revoke all on table public.placement_outcomes from public, anon, authenticated;
grant select, insert, update on table public.placement_outcomes to service_role;

comment on column public.placement_outcomes.result is
  'What actually happened after the introduction. Closed vocabulary so the outstanding-outcome worklist is answerable.';
comment on column public.placement_outcomes.introduction_id is
  'The introduction this outcome closes. Lets the worklist be an anti-join rather than a guess.';

notify pgrst, 'reload schema';
