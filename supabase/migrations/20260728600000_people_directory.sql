-- One row per person, over a table that has one row per click.
--
-- ── THE PROBLEM ───────────────────────────────────────────────────────────────────────
-- submissions is an event log and behaves like one: every form send writes a row, so somebody
-- who filled in the quick-join and then the fuller interest form appears three times. Reading
-- it as a list of people gives a wrong count and a wrong picture of who is actually there.
--
-- ── WHY A VIEW AND NOT A DEDUPE ───────────────────────────────────────────────────────
-- The submissions themselves are real. Each one happened, carries its own consent timestamp,
-- and is the record that a specific person agreed to a specific thing on a specific day.
-- Collapsing them destructively would throw that away to fix a display problem. So the log
-- stays exactly as it is and this reads over it.
--
-- ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────
-- It groups by EMAIL, which is exact. It does not merge two different emails that share a
-- name: `same_name_other_email` flags them for a human instead. Automatically merging
-- identities on a name match would eventually merge two real people who happen to share one,
-- and that is not a mistake you can find after the fact.
--
-- Idempotent: safe to re-run.

create or replace view public.people_directory as
with normalised as (
  select
    lower(trim(submitter_email)) as email,
    -- The most recent non-empty name and organisation win, on the assumption that a later
    -- submission is a correction of an earlier one.
    submitter_name,
    organization_name,
    submission_type,
    summary,
    details,
    created_at,
    -- Verticals live in two shapes depending on which form was used. Both are read; neither
    -- is authoritative on its own.
    coalesce(
      nullif(details -> 'industries', 'null'::jsonb),
      case when details ? 'interests' then details -> 'interests' -> 'industries' else null end,
      '[]'::jsonb
    ) as industries,
    nullif(details ->> 'interest', '') as interest_line,
    nullif(details ->> 'school', '') as school
  from public.submissions
  where submitter_email is not null and trim(submitter_email) <> ''
)
select
  n.email,
  (array_agg(n.submitter_name order by n.created_at desc) filter (where n.submitter_name is not null and n.submitter_name <> ''))[1] as name,
  (array_agg(coalesce(n.school, n.organization_name) order by n.created_at desc)
     filter (where coalesce(n.school, n.organization_name) is not null))[1] as organisation,

  -- Every distinct vertical this person has expressed, across every form they filled in.
  (select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
     from normalised n2, jsonb_array_elements_text(n2.industries) as value
    where n2.email = n.email) as verticals,

  (array_agg(n.interest_line order by n.created_at desc) filter (where n.interest_line is not null))[1] as latest_interest,
  count(*) as submissions,
  array_agg(distinct n.submission_type) as forms,
  min(n.created_at) as first_seen,
  max(n.created_at) as last_seen
from normalised n
group by n.email;

comment on view public.people_directory is
  'One row per email over the submissions event log. Never merges two emails, however similar.';

-- Likely-duplicate people, surfaced rather than merged. A human decides.
create or replace view public.people_possible_duplicates as
select
  lower(trim(submitter_name)) as name_key,
  (array_agg(distinct submitter_name))[1] as name,
  count(distinct lower(trim(submitter_email))) as distinct_emails,
  array_agg(distinct lower(trim(submitter_email))) as emails
from public.submissions
where submitter_name is not null and trim(submitter_name) <> ''
  and submitter_email is not null and trim(submitter_email) <> ''
group by lower(trim(submitter_name))
having count(distinct lower(trim(submitter_email))) > 1;

comment on view public.people_possible_duplicates is
  'Same name, different emails. A hint for a human, never an automatic merge: two real people do share names.';

notify pgrst, 'reload schema';
