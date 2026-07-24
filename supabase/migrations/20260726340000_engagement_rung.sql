-- Delta patch #2: the engagement ladder's rung on the opportunity. 'micro' is the smallest
-- unit — a bounded ~5-hour task (~$100-200 anchor via credits) — the de-risked first bet,
-- NOT the price ceiling. Ladder: micro -> project_short (~2wk) -> project_long (~6wk) ->
-- part_time -> internship -> full_time. Nullable + CHECK NOT VALID; rung progression
-- respects the stage1 -> stage2 access gate. No behavior change until written.

alter table if exists public.member_projects
  add column if not exists engagement_rung text;

alter table public.member_projects drop constraint if exists member_projects_engagement_rung_check;
alter table public.member_projects add constraint member_projects_engagement_rung_check
  check (engagement_rung is null or engagement_rung in ('micro','project_short','project_long','part_time','internship','full_time')) not valid;

notify pgrst, 'reload schema';
