-- More dimensions to compare on, so compatibility resolves finer than four axes allow.
--
-- WHY MORE: with four dimensions a score can only land on five distinct values for that
-- component, which is why two very different students kept scoring identically. Four more
-- roughly doubles the resolution without adding anything a company has to guess at.
--
-- WHAT IS DELIBERATELY ABSENT: every dimension here is about HOW someone likes to work, and
-- is answerable by a first-year with no experience. None of them is a proxy for background —
-- no school, no location, no seniority, no age, no work authorisation. That exclusion is the
-- whole reason this scoring is allowed to exist.
--
-- Both sides are optional on every axis. A missing answer is skipped, never penalised, which
-- is what keeps an incomplete profile from reading as a bad one.
--
-- Idempotent: safe to re-run.

alter table public.member_projects
  add column if not exists env_collaboration text,   -- solo | paired
  add column if not exists env_feedback text,        -- frequent | light
  add column if not exists env_communication text,   -- async | sync
  add column if not exists env_scope text;           -- depth | breadth

do $$
declare
  d record;
begin
  for d in
    select * from (values
      ('env_collaboration', array['solo','paired']),
      ('env_feedback',      array['frequent','light']),
      ('env_communication', array['async','sync']),
      ('env_scope',         array['depth','breadth'])
    ) as t(col, vals)
  loop
    execute format('alter table public.member_projects drop constraint if exists member_projects_%s_check', d.col);
    execute format(
      'alter table public.member_projects add constraint member_projects_%s_check check (%I is null or %I = any (%L)) not valid',
      d.col, d.col, d.col, d.vals);
  end loop;
end $$;

-- The student side of the same axes lives in member_profiles.work_style (jsonb), which needs
-- no migration. Keeping it as one object rather than eight columns means adding a ninth axis
-- later is a code change, not a schema change.

notify pgrst, 'reload schema';

-- Student-side traits. Self-declared, matched against a company's ideal_traits, and weighted
-- lowest of anything in the score precisely because both sides are self-reported.
alter table public.member_profiles
  add column if not exists traits jsonb;

alter table public.member_profiles drop constraint if exists member_profiles_traits_check;
alter table public.member_profiles add constraint member_profiles_traits_check
  check (traits is null or jsonb_typeof(traits) = 'array') not valid;

notify pgrst, 'reload schema';

-- The basis a snapshotted score was built on. Stored alongside the score because a 78 built on
-- two answered axes is not the same claim as a 78 built on eight, and a reviewer reading an
-- application months later cannot recover that from the number alone.
alter table public.project_applications
  add column if not exists fit_precise numeric,
  add column if not exists fit_compared_on integer,
  add column if not exists fit_concerns jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
