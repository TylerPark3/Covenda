-- Intro videos students record inside the portal.
--
-- The old flow asked for "a link — Loom, YouTube, Drive". Almost nobody has an intro video of
-- themselves sitting on YouTube, so the field read as a wall rather than a prompt. Instead the
-- student records a take in the portal once, it lands here, and every later application picks
-- from what they already made.
--
-- Idempotent: safe to re-run.

create table if not exists public.member_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  label text,
  prompt text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists member_videos_user_created_idx
  on public.member_videos (user_id, created_at desc);

alter table public.member_videos enable row level security;

-- A video belongs to the person who recorded it. Companies never read this table directly —
-- an application carries the chosen URL, so consent is per-application, not blanket.
drop policy if exists member_videos_owner_read on public.member_videos;
create policy member_videos_owner_read on public.member_videos
  for select using (auth.uid() = user_id);

drop policy if exists member_videos_owner_write on public.member_videos;
create policy member_videos_owner_write on public.member_videos
  for insert with check (auth.uid() = user_id);

drop policy if exists member_videos_owner_delete on public.member_videos;
create policy member_videos_owner_delete on public.member_videos
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
