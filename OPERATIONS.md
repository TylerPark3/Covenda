# Covenda submission operations

This project now has one submission path for company forms, student forms, university/partner roster forms, and call requests:

1. The server validates and sanitizes the form.
2. It first writes through Supabase's server-only Data API.
3. If that route is unavailable, it tries the server-only Postgres connection supplied by the Vercel Supabase integration. Both routes reach the same private `submissions` table.
4. Only if both database routes fail does it write the record to private Vercel Blob backup and mark the receipt **Primary sync pending**.
5. If email notifications are configured, Covenda receives a short alert with the submission reference. Private form answers are deliberately left out of email.

The public website never receives a Supabase secret. There is not yet a public or unprotected admin page.

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

An alert contains only the submission type, receipt reference, company Project Packet readiness count when applicable, revision reference when applicable, and the protected admin link when configured. It excludes names, email addresses, company problems, student profiles, and other private answers.

## Where submissions can be viewed now

- Primary, after connection: Supabase Dashboard → Table Editor → `public.submissions`.
- Fallback: Vercel Dashboard → the Covenda project → Storage → Blob → `submissions/`.
- Email: a notification that a record exists, not a copy of the private record.

## Next operations milestone

Build `admin.covenda…` only after authentication is connected. The first protected dashboard should query Supabase on the server, list company and student submissions separately, support status changes, and open a single record by reference. It must not use the Supabase secret in browser code or add a public read policy to the submissions table.

## Safety checks before production use

- Keep Supabase and Resend keys in Vercel server environment variables only.
- Keep Blob private; do not expose private Blob URLs through a public endpoint.
- Use synthetic test records after deployment and remove them manually once verified.
- Decide on retention and deletion rules before collecting submissions at larger volume.
- Add authenticated operator access before creating an admin subdomain.
- Run `npm run check` before every deployment.
