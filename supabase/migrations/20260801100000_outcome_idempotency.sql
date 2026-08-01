-- One introduction closes exactly once.
--
-- `record-outcome` did a bare insert with no conflict handling. The failure is not exotic: the
-- operator submits, the row commits, the response is lost to a dropped connection or a closed
-- laptop, the operator submits again, and `placement_outcomes` now holds two rows for one
-- introduction. Nothing in the schema said that was wrong, so nothing stopped it.
--
-- That matters more here than the usual duplicate-row annoyance. `placement_outcomes` is the
-- table the north-star metric reads. A duplicate does not merely clutter it; it silently
-- doubles the weight of one engagement in `calibrationStatus`, and the whole point of that
-- number is that it is honest about a very small n. With five pilot outcomes, one duplicate is
-- a 20% error in the only measurement the company is steering by.
--
-- A partial unique index rather than a plain one, because `introduction_id` is nullable by
-- design: outcomes recorded before introductions existed, and outcomes for work that never had
-- a formal introduction, both legitimately carry null. Postgres treats nulls as distinct, so an
-- unfiltered unique index would permit unlimited null rows anyway — the `where` clause states
-- the intent explicitly instead of relying on that.
--
-- Idempotent, like every migration here: safe to run against a database that already has it.

-- Any duplicates that already landed have to go before the index can be built, or the create
-- fails and the whole bundle stops. Keep the earliest row for each introduction: it is the one
-- the operator actually confirmed, and any later row is the retry that should never have been
-- accepted. `ctid` breaks ties when two rows share a timestamp.
delete from public.placement_outcomes a
using public.placement_outcomes b
where a.introduction_id is not null
  and a.introduction_id = b.introduction_id
  and (a.recorded_at, a.ctid) > (b.recorded_at, b.ctid);

create unique index if not exists placement_outcomes_introduction_unique
  on public.placement_outcomes (introduction_id)
  where introduction_id is not null;

-- The plain index from 20260731100000 is now redundant: the unique index above serves the same
-- worklist anti-join. Dropping it saves a write on every insert and one index to keep in cache.
drop index if exists public.placement_outcomes_introduction_idx;

comment on index public.placement_outcomes_introduction_unique is
  'One outcome per introduction. Partial because introduction_id is legitimately null for outcomes with no formal introduction. Enforces idempotency for api/admin.js record-outcome, which upserts on this constraint.';
