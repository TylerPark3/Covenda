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

That runs the full test suite and then deploys to production. It will not deploy if a test
fails.

Two things `ship` deliberately does not do, because both should be decisions rather than side
effects:

```
git push origin HEAD:main                                   # put the code on GitHub
npx vercel alias set <the-url-ship-printed> covenda.app     # point the domain at it
```

`ship` prints the deployment URL. The alias step is what makes `covenda.app` serve it.

## Normal loop

1. Edit a file.
2. Reload http://localhost:3000 — `vercel dev` picks up changes without a restart.
3. `npm run check` when the change is done.
4. `npm run ship`, then push and alias.
