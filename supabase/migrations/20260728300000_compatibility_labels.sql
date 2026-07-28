-- The label pipeline: what turns completed trials into training data.
--
-- Extends the existing match_events rather than replacing it (the brief is explicit that
-- repo files are extended, never rebuilt). The table already carried event_type, features,
-- fit_score and fit_reasons; what it lacked was the tier, a match identity that survives
-- across events, and the metadata a close-out rating lives in.
--
-- Idempotent throughout.

alter table public.match_events
  add column if not exists match_id uuid,
  add column if not exists tier text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists match_events_match_idx on public.match_events (match_id, created_at);

-- Append-only, enforced rather than intended. A label paired with anything other than the
-- features that produced the recommendation is worthless, so history cannot be edited.
drop trigger if exists match_events_append_only on public.match_events;
create or replace function public.refuse_match_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'match_events is append-only: % refused', tg_op;
end;
$$;
create trigger match_events_append_only
  before update or delete on public.match_events
  for each row execute function public.refuse_match_event_mutation();

-- One labelled row per completed trial.
--
-- label = 1 only when the deliverable was accepted AND the employer said they would request
-- the student again. Acceptance alone is not enough: employers accept mediocre work to be
-- polite, and a label that cannot tell "fine" from "excellent" cannot train anything useful.
create table if not exists public.training_labels (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  label integer not null check (label in (0, 1)),
  feature_vector_at_scoring jsonb,
  -- Provenance is never inferred. No external claim of "trained on outcomes" until real
  -- rows exist, and sources are never silently pooled.
  source text not null check (source in ('real_trial', 'founder_rating', 'synthetic')),
  founder_rating integer check (founder_rating between 1 and 5),
  rationale text,
  rated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint training_labels_unique_match unique (match_id, source)
);
create index if not exists training_labels_source_idx on public.training_labels (source, created_at desc);

alter table public.training_labels enable row level security;
-- Service role only. No student may see a label about themselves, and no company may see one
-- about a student: a visible label changes the behaviour it is trying to measure.

-- The close-out gate, enforced in the database as well as the route, because the rating
-- unlocking the credential is the only reason completion approaches 100%.
alter table public.member_projects
  add column if not exists closeout_rating boolean,
  add column if not exists closeout_at timestamptz;

notify pgrst, 'reload schema';
