# Covenda — pick up here

Everything below is committed, pushed to `main`, and deployed to covenda.app.
Working tree is clean; nothing is lost by closing the terminal.

---

## The three commands you actually use

```bash
cd ~/Documents/GitHub/ProofPath

npm run sql        # bundles every migration, copies to clipboard → paste into Supabase
npm run check      # 718 tests + syntax across every API file
```

Deploy (two steps — the second is required, the domain does not follow production):

```bash
npx vercel --prod --yes
npx vercel alias set <the-deployment-url-it-printed> covenda.app
```

---

## State right now

- **1,339 tests green**
- Live at covenda.app, `main` is the deploy branch
- Working with Dylan on the same repo. He pushes to `main` too — always `git fetch` before
  pushing, and never force. A rejected push means he got there first; merge, do not override.

## Moving off Vercel to Render — in progress

`render.yaml` describes the whole deployment: one web service running `node server.js`, and
three cron jobs calling the same endpoints `vercel.json` scheduled. Nothing in `api/` needed to
change — `api/storage.js` had already removed the last `@vercel/*` package. The old Vercel
project stays up read-only until the new one is confirmed, and `BLOB_READ_WRITE_TOKEN` has to be
carried across: every file uploaded before the storage swap still lives on Vercel Blob and is
still fetched from there by absolute URL.

Three things still need a human, because they need credentials this machine does not have:

1. Set the env vars on Render. **24 of the 47 in Vercel export as `[SENSITIVE]`** and have to be
   copied from the dashboard by hand; `vercel env pull` will not give them to you.
2. `npm run migrate` against production — including the new `20260806100000_storage_bucket.sql`.
   The `uploads` bucket `api/storage.js` writes to was never created by anything. A first upload
   against a missing bucket fails *after* the request has been accepted.
3. Generate a `CRON_SECRET` and set it on Render. There was never one in production — see below.

**The cron endpoints were open.** All three checked `req.headers['x-vercel-cron'] || authorization
=== \`Bearer ${process.env.CRON_SECRET || ''}\``. The first half trusts a header the caller
writes. The second half, with the secret unset — which it was — compares against the literal
`"Bearer "`, so sending exactly that ran the job. `api/cron-auth.js` now requires a configured
secret and constant-time compares it; an unset secret admits nobody. Setting `CRON_SECRET` on
Render is therefore not optional: without it the jobs get 401 and stop running silently.

## Migrations

Run `npm run sql` and paste the bundle after any migration change. The applied head is not
tracked here any more: this file said `fit_dimensions` while eleven later migrations sat
unapplied, including `infrastructure` (rate limits, the error log). Both fail open by design, so
nothing broke and nothing was protected either — the limiter enforced nothing for days while
appearing to. A stale note is worse than no note, so the note is gone. Check Supabase.

**Applied 2026-08-01:** the full bundle was pasted and run, which brought the schema up to
`20260731100000_outcome_worklist`. That included `20260730300000_secure_people_views`, the
`security_invoker` fix for the two people views that Supabase's advisor flagged as
`SECURITY DEFINER`. Both were verified present in the pasted bundle before the run; neither
was verified in the database afterwards, because no Supabase credentials exist on the machine
that generated it. Treat "applied" as reported, not observed.

`20260731100000_outcome_worklist` adds `result` and `introduction_id` to `placement_outcomes`
and powers the operator worklist. It went in with the 2026-08-01 bundle. If the admin surface
still reports it missing, the paste did not take and the bundle needs re-running.

## Built and NOT wired

Honest list. Each is written and tested; nothing imports it.

`api/evidence.js` used to be on this list, described as a second evidence ladder competing with
a `studentEvidenceTier` in `portal.js`. That was wrong and cost a planning cycle. Eight modules
import it, `api/portal.js` among them, and `studentEvidenceTier` is a one-line wrapper around
its `claimsFromProfile` + `presentationBand`. There is one ladder — `claimed → artifact →
referral → trial` — and one presentation mapping onto it. Nothing to collapse.

| Module | What it would do |
|---|---|
| `api/batch-churn.js` | Inactivity removal policy. No caller. |
| `api/ml-data.js` | Training-data export. Nothing calls it. |
| `api/analyze-model.js` | Model analysis. No caller. |
| `api/proof-methods.js` | No caller. |

`api/scoring.js` **is** now wired: fit results route through `scoreCandidate()`, so the stage a
score reports is resolved rather than assumed. With zero outcomes it is `rules` and the number
is untouched.

## Known gaps

- **The required walkthrough has no accessibility path.** No text alternative, no captions
  requirement, no accommodation route. The product spec flags this and the code does not answer
  it. If video stays required, this needs closing.
- **No lead list yet** — the message describing it arrived truncated.

---

## Where things live

| What | File |
|---|---|
| Batch catalogue, 25 specialisations | `api/batches.js` |
| Vetting process per vertical | `api/vetting.js`, `api/vetting-software.js` |
| Supplied assessments (all 25) | `api/assessments.js`, `api/finance-assessment.js` |
| Résumé-generated questions | `api/resume-questions.js` → `api/resume-interview.js` |
| Batch admission scoring | `api/batch-score.js` |
| Batch churn policy | `api/batch-churn.js` |
| Evidence normalisation | `api/evidence.js` |
| Brief engine + industry frameworks | `api/brief-engine.js`, `api/frameworks.js` |
| Company briefing | `api/portal.js` → `companyBriefing` |
| Private-media playback | `api/media.js` |
| Vetting designs, all five passes | `docs/VETTING_*.md`, `docs/VETTING_MATRIX.md` |
| Build vs buy | `docs/BUILD_VS_BUY.md` |
| AI authenticity position | `docs/AI_AUTHENTICITY.md` |

---

## The one thing I'd say before you close

The product is built. What it does not have is a single completed trial — no student has
finished work, no company has accepted a deliverable, and every example on the site is
labelled illustrative because that is what it is.

Every remaining feature is designed to improve outcomes that do not exist yet. One real
trial — one founder, one student, one accepted deliverable — will tell you more than the
next month of building, and it turns the illustrative examples into real ones.
