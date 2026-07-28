-- Simulation runs.
--
-- A run has to be replayable exactly. A rater looking at a decision months later needs to see
-- what the candidate saw at the moment they made it, not what the scenario says today, so the
-- scenario version is stamped on the run and the full event list is stored rather than a
-- summary.
--
-- Idempotent: safe to re-run.

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  scenario_version text not null,
  specialization text not null,
  batch_id uuid references public.batches(id) on delete set null,

  -- The live position and the whole history. `state` is what the engine returns; storing it
  -- whole means a resume is exact rather than reconstructed.
  state jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),

  -- Filled only on completion. Kept separate from state so a partial run can never be read
  -- as evidence of anything.
  evidence jsonb,
  defense jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  -- One live run per person per scenario. A second attempt means abandoning the first, which
  -- is a decision somebody makes rather than something that happens by accident.
  constraint simulation_runs_one_live unique (user_id, scenario_id, status) deferrable initially deferred
);

create index if not exists simulation_runs_user_idx on public.simulation_runs (user_id, started_at desc);
create index if not exists simulation_runs_review_idx on public.simulation_runs (status, completed_at desc) where status = 'completed';

alter table public.simulation_runs enable row level security;

drop policy if exists "own runs readable" on public.simulation_runs;
create policy "own runs readable" on public.simulation_runs
  for select using (auth.uid() = user_id);

-- Writes go through the service role only. A client that could update its own run could edit
-- the decisions it made, which is the one thing this table exists to record honestly.

notify pgrst, 'reload schema';
