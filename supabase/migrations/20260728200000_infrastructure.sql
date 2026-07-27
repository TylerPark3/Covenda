-- Infrastructure: rate limits, an error log, and the index media playback needs.
--
-- Idempotent throughout: safe to re-run.

-- ── 1. The index media.js authorisation depends on ───────────────────────────────────
-- mayView() looks an application up BY its video_url. Without this it is a sequential scan on
-- every single playback, which is fine at 50 applications and not at 50,000.
create index if not exists project_applications_video_url_idx
  on public.project_applications (video_url) where video_url is not null;

-- ── 2. Rate limiting ─────────────────────────────────────────────────────────────────
-- Serverless functions share no memory, so an in-process counter would reset on every cold
-- start and cap nothing. The counter has to live where every instance can see it.
--
-- This matters most for routes that cost money per call: /api/resume-interview hits the
-- Anthropic API on every upload, so without a cap one signed-in account can run up a bill by
-- re-uploading the same file.
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  subject text not null,           -- who: usually a user id
  action text not null,            -- what: the route being limited
  window_start timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint rate_limits_unique unique (subject, action, window_start)
);
create index if not exists rate_limits_lookup_idx on public.rate_limits (subject, action, window_start desc);

alter table public.rate_limits enable row level security;
-- No policies on purpose: only the service role touches this. A client that could read it
-- could enumerate other people's usage, and a client that could write it could reset its own.

-- Atomic increment, so two concurrent requests cannot both read 4 and both write 5.
create or replace function public.bump_rate_limit(
  p_subject text, p_action text, p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (subject, action, window_start, count)
  values (p_subject, p_action, p_window_start, 1)
  on conflict (subject, action, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- ── 3. Error log ─────────────────────────────────────────────────────────────────────
-- console.error goes to Vercel logs and dies there, so the first anyone hears of a failure is
-- a user reporting it. This makes failures queryable and countable.
--
-- Deliberately NOT a general event log: only errors, capped detail, no request bodies. A log
-- that quietly accumulates user data is a breach waiting to be discovered.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  kind text not null,                       -- 'error' | 'schema_missing' | 'degraded'
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists error_events_recent_idx on public.error_events (created_at desc);
create index if not exists error_events_route_idx on public.error_events (route, created_at desc);

alter table public.error_events enable row level security;
-- Service role only. Operators read it through /api/admin, never directly.

notify pgrst, 'reload schema';
