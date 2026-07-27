-- The ideal intern, as the founder describes them.
--
-- From the 26 July session: personality traits, objective skill sets, and a memo explaining
-- why this person is needed. The memo matters most — a list of skills says what to filter
-- on, the memo says what the work is FOR, and the brief engine reads that to decide what a
-- trial should actually discriminate on.
--
-- Traits are stored separately from skills on purpose. A skill can be evidenced from an
-- artifact; a trait cannot, and merging them would let "self-starter" sit in the same list
-- as a verified capability as if the two were comparable.
--
-- Idempotent: safe to re-run.

alter table public.member_projects
  add column if not exists ideal_traits jsonb,      -- ["comfortable with ambiguity", ...]
  add column if not exists ideal_skills jsonb,      -- ["Python", "SQL", ...]
  add column if not exists ideal_memo text;         -- why this person is needed

alter table public.member_projects drop constraint if exists member_projects_ideal_traits_check;
alter table public.member_projects add constraint member_projects_ideal_traits_check
  check (ideal_traits is null or jsonb_typeof(ideal_traits) = 'array') not valid;

alter table public.member_projects drop constraint if exists member_projects_ideal_skills_check;
alter table public.member_projects add constraint member_projects_ideal_skills_check
  check (ideal_skills is null or jsonb_typeof(ideal_skills) = 'array') not valid;

notify pgrst, 'reload schema';
