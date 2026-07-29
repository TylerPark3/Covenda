# Running Covenda locally

For when the network you are on will not load `covenda.app`. Local traffic never leaves the
machine, so SSL interception on guest WiFi cannot touch it.

## Start it

```
npm run local
```

Then open **http://localhost:3000**.

This runs `vercel dev`, which serves the static pages *and* executes everything in `api/` as
real serverless functions — same code, same routes as production.

## First run: you need database credentials

`npm run local` checks for them before starting and tells you if they are missing.

They are not in `.env.local` automatically, and `vercel env pull` will never fetch them: the
Supabase variables are marked **Sensitive** in Vercel, and sensitive variables cannot be read
back by design. That is the flag working, not a bug.

Get them from the Supabase dashboard for this project, under **Project Settings → API**:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SECRET_KEY=<the service_role key>
```

Paste both into `.env.local`. That file is gitignored, so nothing you put there is committed
or deployed.

Optional, each only needed for the feature named:

| Variable | Needed for |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | video upload and playback |
| `RESEND_API_KEY` | sign-in emails and notifications |
| `COVENDA_ADMIN_EMAILS` | operator access to `/admin.html` |

## What works without credentials

The marketing site, all CSS, and all client JavaScript. Start with `npm run local -- --force`
if that is all you need.

**Signing in, the student portal, and the admin will not work** — they read the database on
every request. The batch cards live inside the portal, so seeing those requires credentials.

## Getting changes onto the real site

Local and production are the same code. Nothing about running locally changes what deploys.

```
npm run ship
```

That runs the full test suite, deploys, points **covenda.app** at the new build, and verifies
with Vercel that the domain resolves to it. It stops at the first failure, so a red test never
reaches production and a deploy that cannot be aliased is reported as a failed ship.

The alias used to be a separate command to run afterwards. It was forgotten repeatedly, and
the failure is quiet in the worst way: the deploy succeeds, the tests pass, a URL is printed,
and covenda.app carries on serving a build from days ago. Everything reports success and
nothing is live. It is one command now.

`ship` does not push to GitHub, because that should be a decision rather than a side effect of
a build:

```
git push origin HEAD:main
```

Verification is done against Vercel rather than by fetching the site. An intercepting proxy on
a guest network fails the fetch while the alias is perfectly fine, and that false alarm is
worse than no check at all.

## Normal loop

1. Edit a file.
2. Reload http://localhost:3000 — `vercel dev` picks up changes without a restart.
3. `npm run check` when the change is done.
4. `npm run ship` — tests, deploys, and points covenda.app at it.
5. `git push origin HEAD:main`.
