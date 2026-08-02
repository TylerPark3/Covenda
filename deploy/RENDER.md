# Moving covenda.app to Render

The code is ready. `server.js` is one long-lived Node process that serves the static site and
all ~28 API handlers, `api/storage.js` reads and writes Supabase Storage with no `@vercel/blob`
import left anywhere, and `render.yaml` declares the service. Nothing in the codebase names a
hosting provider as a requirement.

**The work is not the code. It is the secrets and the cutover.** Read the first section before
starting, because it is the part that cannot be rushed or automated.

---

## 1. The secrets cannot be exported from Vercel

All 24 are stored **encrypted**, which is write-only. `vercel env pull` returns `[SENSITIVE]`,
the dashboard will not display them, and the API will not return them. This is Vercel's
security model working correctly — but it means there is no copy-paste migration path, for
anyone, including you.

Each value must be re-read from the system that issued it:

| Block | Where to get it |
|---|---|
| 9 Supabase keys | Supabase → Project Settings → **API** |
| 7 Postgres vars | Supabase → Project Settings → **Database** (one connection string; the parts derive from it) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | **Do not reuse the Vercel one** — see §4 |
| `RESEND_API_KEY` | resend.com → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `BLOB_*` | Vercel → Storage (these two are readable) |
| `COVENDA_*` | Your own values |

`vercel env ls production` lists the names, which is the checklist. It cannot give values.

**Rotate rather than hunt, where you can.** For Resend and Anthropic, issuing a new key is
faster than finding the old one, and it retires a credential that has been sitting in two
places. `RESEND_API_KEY` was already flagged for rotation and is still live.

## 2. Create the service

1. Render → **New** → **Blueprint**, point it at this repo. It reads `render.yaml`.
2. Render prompts for every `sync: false` variable. Fill them from §1.
3. Deploy. Watch the log for `[covenda] N routes, M taking a raw body`.

## 3. Verify before touching DNS

Render gives you `covenda.onrender.com` (or similar). Prove it works there first — the domain
is the last thing to move, not the first.

```bash
BASE=https://covenda.onrender.com

curl -s $BASE/healthz                       # {"ok":true,"routes":28}
curl -s -o /dev/null -w '%{http_code}\n' $BASE/            # 200
curl -s -o /dev/null -w '%{http_code}\n' $BASE/portal.html # 200

# The one that actually matters: 200 means the Supabase vars are right.
# 503 PORTAL_AUTH_NOT_CONFIGURED means a Supabase URL or key is missing or wrong.
curl -s -X POST $BASE/api/portal \
  -H 'content-type: application/json' \
  -d '{"action":"auth-readiness"}'
```

Then sign in as a real member and load the portal. A 200 on `auth-readiness` proves the keys
are *present*; only a real sign-in proves they are *correct*.

**Note:** `/portal` (no extension) works on Render because `server.js` sets
`extensions: ['html']`. It 404s on Vercel. So links written against Render are more permissive
than Vercel's — fine when Render is the only host, worth remembering while both are live.

## 4. Stripe webhooks need a new endpoint

`STRIPE_WEBHOOK_SECRET` is issued **per endpoint**. Copying the Vercel one to Render fails
signature verification — and it fails quietly: checkout appears to work, and webhooks never
land, so payments succeed while nothing downstream records them.

1. Stripe → Developers → Webhooks → **Add endpoint** → `https://<render-url>/api/stripe-webhook`
2. Subscribe to the same events as the Vercel endpoint.
3. Copy the **new** signing secret into Render's `STRIPE_WEBHOOK_SECRET`.
4. Keep the Vercel endpoint live until DNS has moved and settled, then disable it.

## 5. Cut over DNS

Point covenda.app at Render (Render → Settings → Custom Domain gives the exact record).

- Lower the TTL **a day before**, so a rollback propagates in minutes rather than hours.
- Both hosts serve correctly during propagation. That is intended — some users hit Vercel and
  some hit Render, and both talk to the same Supabase project.
- **Rollback is DNS, not a redeploy.** Point the record back at Vercel. Keep the Vercel project
  alive for a week.

## 6. Cron jobs

`render.yaml` has them commented out. Enable after the web service is verified — a cron firing
against a half-configured deployment is a bad first thing to debug. Each cron service needs the
same environment variables as the web service.

## 7. After it has been stable for a week

- Delete the stray **`portal-onboard-lockout`** Vercel project. It was created accidentally by
  running `npm run ship` from a git worktree, has no environment variables, and briefly served
  covenda.app with sign-in broken. `scripts/ship.mjs` now refuses to build from the wrong
  project, but deleting it removes the target entirely.
- Drop `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID` once no stored record still points at
  `blob.vercel-storage.com`. `api/storage.js` accepts absolute legacy URLs precisely so this
  can wait until then.
- Retire the Vercel project, and the $40/month with it.

---

## What does not change

Development is unaffected by any of this. Edit locally, `npm run check`, commit, `npm run land`.
GitHub stays the source of truth and both hosts deploy from it, so you can run Vercel and Render
side by side for as long as you like.

`npm run serve` runs `server.js` — the exact entry point Render runs. Prefer it over
`npm run preview` while migrating: preview matches Vercel's stricter routing, `serve` matches
Render's.
