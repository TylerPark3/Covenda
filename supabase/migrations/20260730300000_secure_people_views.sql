-- The people views handed out exactly what the table beneath them refuses to.
--
-- ── WHAT WAS WRONG ────────────────────────────────────────────────────────────────────
-- public.submissions is locked down and has been since 20260721051450: RLS enabled, `revoke
-- all on table public.submissions from public, anon, authenticated`, and service_role the only
-- grantee. That is the correct posture for a table holding every name, email, school and
-- stated interest anyone has ever typed into a Covenda form.
--
-- people_directory and people_possible_duplicates read that table. A Postgres view executes as
-- its OWNER, not as its caller, and the owner can read submissions. Neither view declared any
-- grants of its own, so both inherited the default public-schema grants to anon and
-- authenticated. The result: two ordinary-looking views that returned the entire contact list
-- to a role explicitly denied the table.
--
-- Supabase's linter calls this 0010_security_definer_view and rates it critical. That rating is
-- right. The anon key is designed to be published; a protection that only holds while a
-- publishable key stays private is not a protection.
--
-- ── WHY BOTH CHANGES ──────────────────────────────────────────────────────────────────
-- security_invoker = on makes each view run as whoever queries it, so the RLS and grants on
-- submissions finally apply through the view as well.
--
-- The revoke/grant is not redundant. It matches each view's own grants to the table's, so the
-- default public-schema privileges cannot be silently re-inherited the next time either view
-- is recreated — which is how the hole opened in the first place.
--
-- security_invoker requires Postgres 15 or newer. Supabase has shipped 15+ since 2023.
--
-- Idempotent: safe to re-run.

alter view public.people_directory set (security_invoker = on);
alter view public.people_possible_duplicates set (security_invoker = on);

revoke all on table public.people_directory from public, anon, authenticated;
revoke all on table public.people_possible_duplicates from public, anon, authenticated;

-- The server reads these with the service role, which is the only caller that should have them.
grant select on table public.people_directory to service_role;
grant select on table public.people_possible_duplicates to service_role;

notify pgrst, 'reload schema';
