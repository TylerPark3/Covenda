-- Open roles pulled from public job boards.
--
-- ── WHY THIS TABLE IS SHARED, NOT PER STUDENT ─────────────────────────────────────────
-- Every other table in this schema is owner-scoped: a row belongs to one student and RLS
-- checks auth.uid(). This one is the opposite. A posting is the same posting for everyone, so
-- it is written once by the sync job and read by all signed-in members. The scoring against a
-- student never lands here; it is computed per request in api/roles.js from the student's own
-- profile, so no student's position is ever stored next to a public posting.
--
-- ── WHY NOBODY BUT THE SERVICE ROLE CAN WRITE ─────────────────────────────────────────
-- There is a select policy and no insert, update, or delete policy. Under RLS that means a
-- signed-in member can read every row and write none. Only the service role, which bypasses
-- RLS, can populate it. A table of job postings that any account could write to is a phishing
-- surface: a fake posting with a real company name and an attacker's apply link.
--
-- ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────────────────
-- No score, no match, no rank, no probability column. Fit is per student and per request, and
-- storing it here would mean either a row per student per role, or one number pretending to be
-- true for everyone. No salary column either: the boards rarely publish it and an inferred
-- figure would be us inventing compensation.
--
-- Idempotent: safe to re-run.

create table if not exists public.open_roles (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'greenhouse',
  board_token text,
  external_id text not null,
  company text not null,
  title text not null,
  location text,
  remote boolean not null default false,
  url text,
  posted_at timestamptz,
  description text,
  -- Set every sync. A posting that stops appearing on the board has been filled or pulled, and
  -- this is how it stops being shown without deleting history.
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint open_roles_source_allowed check (source in ('greenhouse', 'lever', 'ashby')),
  constraint open_roles_title_present check (length(btrim(title)) > 0),
  constraint open_roles_company_present check (length(btrim(company)) > 0),
  -- One row per posting per board. The sync upserts on this, so re-running it refreshes rather
  -- than duplicating, which matters because it is meant to run on a schedule.
  constraint open_roles_unique_posting unique (source, external_id)
);

create index if not exists open_roles_seen_idx on public.open_roles (last_seen_at desc);
create index if not exists open_roles_company_idx on public.open_roles (company, posted_at desc);

alter table public.open_roles enable row level security;

-- Read by any signed-in member. Deliberately not public: the postings are public on the
-- boards themselves, but there is no reason to serve an anonymous scraper from our database.
drop policy if exists open_roles_member_read on public.open_roles;
create policy open_roles_member_read on public.open_roles
  for select using (auth.role() = 'authenticated');

-- No insert, update, or delete policy, on purpose. See the header.

comment on table public.open_roles is
  'Open student roles pulled from public job boards. Written only by the service role; readable by any signed-in member. Fit is computed per request in api/roles.js and never stored here.';

notify pgrst, 'reload schema';
