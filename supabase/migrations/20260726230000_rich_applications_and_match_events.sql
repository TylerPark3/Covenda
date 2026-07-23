-- §4a rich applications + §5 match_events.
--
-- Applications carry more than a note now: an optional intro video link, the skills the
-- student self-rates for THIS project, a demonstration link, a professor/partner referral,
-- and the fit score/reasons snapshotted at apply time. All additive + idempotent.
alter table public.project_applications
  add column if not exists video_url text,
  add column if not exists skills jsonb not null default '[]'::jsonb,
  add column if not exists demonstration text,
  add column if not exists referral jsonb not null default '{}'::jsonb,
  add column if not exists fit_score integer,
  add column if not exists fit_reasons jsonb not null default '[]'::jsonb;

-- §5 instrumentation. Append-only log of every matching lifecycle event with a snapshot of
-- the features on BOTH sides at that moment (never recomputed later), so fairness/quality can
-- be audited and a future model has honest training data. Fairness: features must never
-- include protected attributes or proxies (e.g. school prestige). Human-in-the-loop only —
-- there is no automated decision here, just a logged signal.
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.member_projects(id) on delete set null,
  student_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  features jsonb not null default '{}'::jsonb,
  fit_score integer,
  fit_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint match_events_type_allowed
    check (event_type in ('surfaced', 'viewed', 'applied', 'accepted', 'declined', 'submitted', 'revision_requested', 'completed', 'cancelled'))
);
create index if not exists match_events_project_idx on public.match_events (project_id, created_at desc);
create index if not exists match_events_student_idx on public.match_events (student_user_id, created_at desc);

-- Service-role only, like every other private table. The API is the sole gatekeeper.
alter table public.match_events enable row level security;
alter table public.match_events force row level security;
revoke all on table public.match_events from public, anon, authenticated;
grant select, insert on table public.match_events to service_role;

notify pgrst, 'reload schema';
