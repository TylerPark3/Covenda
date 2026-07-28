-- Text alternatives for recorded work.
--
-- The walkthrough is required and there was no text path: no captions, no transcript, no
-- accommodation route. That excludes deaf and hard-of-hearing REVIEWERS as much as applicants
-- — a rater who cannot hear a submission cannot assess it, and Covenda's whole method is two
-- raters scoring the same artifact.
--
-- Two sources on purpose. A student-written transcript is authoritative because they wrote it;
-- a machine one is a convenience that can be wrong. Never silently blend them.

alter table public.member_videos
  add column if not exists transcript text,
  add column if not exists transcript_source text,
  add column if not exists transcript_at timestamptz;

alter table public.member_videos drop constraint if exists member_videos_transcript_source_check;
alter table public.member_videos add constraint member_videos_transcript_source_check
  check (transcript_source is null or transcript_source in ('student', 'auto')) not valid;

-- An accommodation request. Deliberately a request to a human, not a toggle: the point is that
-- somebody reads it and arranges an alternative, which is the only thing that covers cases
-- nobody anticipated.
create table if not exists public.accommodation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context text not null,                    -- 'batch_application' | 'project_application'
  reference text,                           -- the batch or project it concerns
  -- What they need, in their words. Never a diagnosis, never a category to select from:
  -- asking someone to classify their own disability to apply for work is its own barrier.
  need text not null,
  status text not null default 'open' check (status in ('open', 'arranged', 'declined', 'closed')),
  operator_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint accommodation_need_length check (char_length(need) between 10 and 2000)
);
create index if not exists accommodation_open_idx on public.accommodation_requests (status, created_at desc);

alter table public.accommodation_requests enable row level security;

drop policy if exists "own requests readable" on public.accommodation_requests;
create policy "own requests readable" on public.accommodation_requests
  for select using (auth.uid() = user_id);

drop policy if exists "own requests insertable" on public.accommodation_requests;
create policy "own requests insertable" on public.accommodation_requests
  for insert with check (auth.uid() = user_id);

-- Synthetic isolation. The tag is on the ROW rather than a naming convention: a convention
-- holds until somebody forgets, and a training run that quietly includes fabricated outcomes
-- produces a model nobody can defend.
alter table public.member_profiles add column if not exists synthetic boolean not null default false;
alter table public.member_projects add column if not exists synthetic boolean not null default false;

create index if not exists member_profiles_real_idx on public.member_profiles (synthetic) where synthetic = false;
create index if not exists member_projects_real_idx on public.member_projects (synthetic) where synthetic = false;

notify pgrst, 'reload schema';
