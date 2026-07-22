# Covenda submission operations

This project now has one submission path for company forms, student forms, university/partner roster forms, and call requests:

1. The server validates and sanitizes the form.
2. It first writes through Supabase's server-only Data API.
3. If that route is unavailable, it tries the server-only Postgres connection supplied by the Vercel Supabase integration. Both routes reach the same private `submissions` table.
4. Only if both database routes fail does it write the record to private Vercel Blob backup and mark the receipt **Primary sync pending**.
5. If email notifications are configured, Covenda receives a short alert with the submission reference. Private form answers are deliberately left out of email.

The public website never receives a Supabase secret. Both the operator inbox and member portal validate Supabase access tokens on the server before reading private data.

## Connect Supabase

Create a Supabase project, then run these commands from this repository:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The migration in `supabase/migrations/20260721051450_create_submission_inbox.sql` creates the private inbox. It enables and forces Row Level Security, grants no access to anonymous or signed-in website users, and allows the server role to read, insert, and update records. It does not grant deletion.

The later migration `supabase/migrations/20260721060000_allow_university_partner.sql` adds the `university_partner` type and the `UNI-` reference prefix. It is idempotent (drop-if-exists then add), so it is safe to re-run. The API's accepted types and reference prefixes are exported from `api/submissions.js` (`SUBMISSION_TYPES` / `REFERENCE_PREFIXES`) as a single source of truth, and a test asserts the migration allows exactly those — so the API can never accept a type the database would reject.

If an earlier SQL run stopped with `relation "submissions" already exists`, run `supabase/migrations/20260721172703_harden_submission_delivery.sql` in SQL Editor. It is the canonical repair: it adds any missing inbox columns and constraints, restores server-only grants, accepts all current audiences, refreshes the Data API schema, and never deletes existing rows.

Before using real submissions, add these server-only environment variables to the Covenda Vercel project:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | The project URL from Supabase. |
| `NEXT_PUBLIC_SUPABASE_URL` | Accepted URL fallback when it is supplied automatically by the Vercel Supabase integration. The URL is public configuration; the secret key is not. |
| `SUPABASE_SECRET_KEY` | Preferred server-only Supabase secret key. Never add it to client-side code or use a `NEXT_PUBLIC_`/`VITE_` prefix. |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback only if the project has not issued a new secret key. |
| `SUPABASE_PUBLISHABLE_KEY` | Preferred key for requesting Supabase Magic Links. The Vercel integration may provide this automatically. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are accepted fallbacks. |
| `POSTGRES_URL` | Server-only pooled database connection supplied by the Vercel Supabase integration. This is the independent ingestion fallback when the Data API is unavailable. |
| `BLOB_READ_WRITE_TOKEN` | Existing private Blob fallback. Keep it while Supabase is being introduced and during the MVP. |

After adding variables, redeploy the Vercel project. Submit one clearly synthetic company form, one synthetic student form, and one synthetic university roster. Confirm all three appear in Supabase Table Editor under `public.submissions` with `EMP-`, `STU-`, and `UNI-` references. Also confirm the website receipt shows the same reference.

### If receipts appear on the website but not in Supabase

The website keeps local receipts after the server accepts a submission. The server may have used private Blob backup storage if both Supabase routes were unavailable. New receipts identify the server record as **Primary inbox** or **Backup · sync pending**, and the workspace checks delivery health without exposing private records.

Check that Vercel contains either `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus `SUPABASE_SECRET_KEY` and `POSTGRES_URL`, and redeploy after any environment-variable change. Then run `supabase/migrations/20260721172703_harden_submission_delivery.sql` once in Supabase SQL Editor. The repair is safe to repeat.

Existing Blob backup records do not automatically appear in Supabase. Keep their receipt references; they can be backfilled after the primary connection is verified.

## Turn on email alerts

Email is optional and does not control whether a submission is saved. Configure:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-only Resend API key. |
| `COVENDA_NOTIFICATION_EMAIL` | Covenda inbox that should receive alerts. |
| `COVENDA_NOTIFICATION_FROM` | Verified sender, for example `Covenda <submissions@covenda.com>`. |
| `COVENDA_ADMIN_URL` | Optional future link to the protected admin area. Leave blank until that area exists. |

## Protected operator inbox

The first operator inbox is available at `/admin.html`. It uses Supabase passwordless Magic Links and revalidates every access token against Supabase Auth on the server before returning private records or accepting a status update.

1. In Supabase Dashboard → Authentication → Users, invite or create each operator account.
2. In Authentication → URL Configuration, add the exact production URL `https://YOUR_DOMAIN/admin.html` and the relevant Vercel preview URL pattern. Supabase only redirects Magic Links to configured URLs.
3. Add `COVENDA_ADMIN_EMAILS` to Vercel as a comma-separated allowlist, for example `founder@covenda.com,operations@covenda.com`.
4. Set `COVENDA_ADMIN_URL=https://YOUR_DOMAIN/admin.html` so notification emails can link to the inbox.
5. Redeploy, request a link from `/admin.html`, and verify that an unlisted Supabase user receives no inbox access.

The green request message is intentionally generic and does **not** prove that Supabase sent an email. A request from an address outside `COVENDA_ADMIN_EMAILS` receives the same public response but is suppressed before Supabase is called. The page now displays a request reference; find that reference in Vercel Runtime Logs for `/api/admin`. `ADMIN_LINK_REQUESTED` means Supabase accepted the request, while `ADMIN_LINK_SUPPRESSED` means the address did not match the deployed allowlist. Neither log includes the email address or token.

For dependable email delivery, connect custom SMTP under Supabase Authentication → Email. Supabase's shared SMTP provider is not intended for sending production login emails to arbitrary end users. Until custom SMTP is connected, add the operator as a member of the Supabase organization or use Google login for member accounts.

Admin API failures include a safe diagnostic code and an actionable message. The most common codes are:

- `ADMIN_ALLOWLIST_MISSING`: `COVENDA_ADMIN_EMAILS` is blank in this deployment, or the deployment predates the variable change.
- `ADMIN_SUPABASE_PUBLISHABLE_KEY_MISSING`: add or reconnect the Vercel Supabase integration so a publishable/anon key is available, then redeploy.
- `ADMIN_SUPABASE_SECRET_MISSING`: the server-only Supabase secret is absent from the selected Vercel environment.
- `ADMIN_MAGIC_LINK_FAILED`: create/confirm the operator in Supabase Authentication → Users, enable Email sign-in, and check the exact `/admin.html` redirect URL.
- `ADMIN_SUBMISSIONS_UNAVAILABLE`: the login worked but the configured Supabase project cannot read `public.submissions`; run the inbox repair migration and verify the project reference.

Vercel environment changes never update an already-built deployment. After changing any admin or Supabase variable, redeploy the `Dylan` preview before testing it again. The admin API logs a structured error with the same diagnostic code under Vercel Runtime Logs → `/api/admin` without logging access tokens or form data.

The endpoint never creates a user from a sign-in attempt (`shouldCreateUser: false`). An authentic Supabase account is necessary but not sufficient: its normalized email must also appear in `COVENDA_ADMIN_EMAILS`. Keep the Supabase JWT expiry short for this operator surface; signing out clears the token from the current browser session, while already-issued access tokens remain valid until expiry.

The operator inbox also stores a private internal note and optional follow-up date on each submission. Apply `supabase/migrations/20260721225331_add_operator_follow_up_fields.sql` before using those controls in production. The migration preserves existing records, keeps browser roles revoked, bounds notes to 2,000 characters, records the last authorized operator and update time, and refreshes the Data API schema cache. These fields are available only through the authenticated admin route; the public receipt endpoint never returns them.

## Member portal

The first authenticated member workspace is available at `/portal.html`. It supports one Supabase account system for students, companies, and universities:

- students can complete a private profile, view assigned projects, browse open member projects, and send an application;
- companies can create projects, track their project list and applications, and view student profiles that opted into member discovery;
- universities can maintain their partner profile and create or track projects.

Before deploying it:

1. Apply `supabase/migrations/20260721231522_create_member_portal.sql`. It creates `member_profiles`, `member_projects`, and `project_applications`, forces RLS, revokes browser-role access, and grants access only to the server role.
2. In Supabase Authentication → URL Configuration, add `https://YOUR_DOMAIN/portal.html` and the exact Vercel preview URLs you will test.
3. In Authentication → Providers → Google, enable Google and enter the Google OAuth client ID and client secret. Add the Supabase callback URL shown on that page to the Google Cloud OAuth client.
4. For email sign-in, configure custom SMTP in Supabase. Google sign-in is the recommended first production path while SMTP is being configured.
5. Confirm Vercel has the same Supabase URL, publishable key, and server-only secret used by the project where the migration was applied. Redeploy after every variable change.

Google and email callbacks return to `/portal.html`; the browser stores the short-lived session only in the current tab's session storage. The API revalidates the access token with Supabase on every protected request and refreshes expired sessions with the Supabase refresh token. Member tables have no anonymous or direct authenticated-browser grants.

An alert contains only the submission type, receipt reference, company Project Packet readiness count when applicable, revision reference when applicable, and the protected admin link when configured. It excludes names, email addresses, company problems, student profiles, and other private answers.

## Where submissions can be viewed now

- Primary, after connection: Supabase Dashboard → Table Editor → `public.submissions`.
- Fallback: Vercel Dashboard → the Covenda project → Storage → Blob → `submissions/`.
- Email: a notification that a record exists, not a copy of the private record.

The website workspace now shows the connected Supabase project reference and the exact table name under **Submissions → Private server destination**. The same safe diagnostic is available at `GET /api/submissions`; it returns only connection status, route, project reference, table name, and check time—never submission rows or secrets. Use the displayed project reference to confirm that you opened the same Supabase project that the live Vercel deployment is using.

People can also recover a missing receipt from **Workspace → Submissions → Find receipt** by entering the receipt reference and the same email used on the original submission. `POST /api/receipts` performs the match using server-only credentials and returns only the reference, submission type, status, and timestamps. It never returns names, emails, summaries, form answers, roster entries, or Project Packet details. Lookup attempts are rate-limited, and cross-origin browser requests are rejected.

## Next operations milestone

Connect a verified Covenda SMTP sender, enable the Google provider, and apply the member portal migration to the same Supabase project used by Vercel. After real accounts can sign in, the next product milestone is operator-controlled project matching, milestone updates, and private project messages.

## Safety checks before production use

- Keep Supabase and Resend keys in Vercel server environment variables only.
- Keep Blob private; do not expose private Blob URLs through a public endpoint.
- Use synthetic test records after deployment and remove them manually once verified.
- Decide on retention and deletion rules before collecting submissions at larger volume.
- Add authenticated operator access before creating an admin subdomain.
- Run `npm run check` before every deployment.
