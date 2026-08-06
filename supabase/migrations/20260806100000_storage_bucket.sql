-- The bucket api/storage.js has been writing to.
--
-- ── WHY ───────────────────────────────────────────────────────────────────────────────
-- api/storage.js replaced the previous vendor's blob store with Supabase Storage, which is
-- what made the host replaceable. It writes to `SUPABASE_STORAGE_BUCKET`, defaulting to
-- 'uploads'. Nothing ever created that bucket. Every other piece of schema this code depends on
-- arrives through a migration; the bucket arrived through an instruction in a runbook to click
-- something in a dashboard, which is the same class of step that left three migrations
-- "applied: reported, not observed" in RESUME.md.
--
-- A first upload against a missing bucket fails with "Bucket not found" — after the request has
-- been accepted and the student has waited for the file to go up. Creating it here means a new
-- environment (a Render preview, a fresh project, a restored backup) is one `npm run migrate`
-- away from working rather than one undocumented click away from a confusing 500.
--
-- ── PRIVATE, AND WHY THAT IS NOT A POLICY QUESTION ────────────────────────────────────
-- public = false. These are résumés, deliverables and recordings of students. Reads go through
-- signedReadUrl(), which mints a URL that expires in five minutes; writes go through
-- signedUploadUrl() or putObject(), both server-side with the service key.
--
-- No RLS policies on storage.objects are created here, deliberately. The service role bypasses
-- RLS, and it is the only identity that touches this bucket — a browser never holds a Supabase
-- key that can read it, it holds a signed URL that the server decided to issue. Adding a policy
-- would widen access to make a permission model that nothing uses, and every policy that exists
-- is a policy that can be got wrong later.
--
-- ── IDEMPOTENT ────────────────────────────────────────────────────────────────────────
-- Like every migration here: running it against a project where the bucket already exists
-- leaves it alone rather than resetting its visibility, so re-running the whole set is safe.

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- If the bucket predates this file it may have been created public by hand in the dashboard,
-- which is exactly the state this migration exists to make impossible. Correct it rather than
-- trusting that nobody ever ticked the box.
update storage.buckets set public = false where id = 'uploads' and public is distinct from false;
