-- §13 slice 4: batch admission thresholds + the seeded batch catalogue.
--
-- The threshold SPEC itself lives in api/batches.js (BATCH_CATALOG), versioned in the repo
-- like every other scorer — the DB stores a `slug` to join on plus a denormalized snapshot of
-- the published requirements so an operator reviewing an old application can see the bar as
-- it stood. Code stays the single source of truth; this column is an audit convenience.
--
-- Idempotent: safe to re-run. Seeds only insert when the slug is absent, so operator edits to
-- name/description/capacity are never clobbered by a re-run.

alter table public.batches
  add column if not exists slug text,
  add column if not exists admission_requirements jsonb,
  add column if not exists admission_version text;

-- A PARTIAL unique index cannot back the `on conflict (slug)` below: Postgres will only infer
-- an arbiter index whose predicate is restated in the ON CONFLICT clause, so the partial form
-- failed with 42P10. The predicate bought nothing anyway — a plain unique index already allows
-- unlimited NULL slugs, since NULLs are never equal to each other. Dropped first so a database
-- that already has the partial version gets corrected rather than silently keeping it.
drop index if exists public.batches_slug_key;
create unique index if not exists batches_slug_key on public.batches (slug);

-- Seed the catalogue. One batch per vertical; disciplines match the canonical VERTICALS set in
-- api/portal.js so batch ↔ profile ↔ opportunity all speak the same taxonomy.
insert into public.batches (slug, name, discipline, tier, status, capacity, access_credits, description, admission_version)
values
  ('software-ai', 'Software & AI', 'Software & AI', 'elite', 'open', 24, 25,
   'The software bench. Admission runs on your own GitHub account — connected, not pasted — so credited repos are provably yours and history is read from the commit timeline.',
   'batch-admission-1.0.0'),
  ('accounting-finance', 'Accounting & finance', 'Accounting & finance', 'elite', 'open', 24, 25,
   'The finance bench. Submit a real model and Covenda parses the workbook itself — formula integrity and DCF structure — then you defend it against anchored rubric questions.',
   'batch-admission-1.0.0'),
  ('healthcare-operations', 'Healthcare operations', 'Healthcare operations', 'elite', 'open', 16, 25,
   'Operations work no API can verify. Vetted on the human rail: a recorded walkthrough scored by two raters, plus a structured referral. De-identified material only.',
   'batch-admission-1.0.0'),
  ('consumer-retail', 'Consumer & retail', 'Consumer & retail', 'open', 'open', 24, 15,
   'Growth and merchandising proved by an instrumented challenge inside Covenda-provisioned tooling. Self-reported campaign numbers are not admission evidence.',
   'batch-admission-1.0.0'),
  ('professional-services', 'Professional services', 'Professional services', 'open', 'open', 24, 15,
   'Research and writing vetted on authorship. The document gets you to the interview; defending it on record is the proof.',
   'batch-admission-1.0.0')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
