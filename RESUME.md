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

- **718 tests green**
- Live at covenda.app
- Blob store is **private**, and playback now works: `api/media.js` authorises the caller
  against rows, then mints a 15-minute read-only signed URL. Wired into the student's video
  library, the company's application review, and the operator's batch reviewer.

## Still on your list

**Yours, not code:**
- `STRIPE_CONNECT_ENABLED=true` in Vercel if you want automatic payouts (manual works now)
- Add `TylerPark3@users.noreply.github.com` to your Vercel account to stop the
  "not a collaborator" email

**Mine, next session:**
1. Wire `companyBriefing` into the company dashboard UI (backend done, nothing renders it)
2. Wire the supplied assessments into the batch application UI (all 25 exist in
   `api/assessments.js`, nothing shows them)


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
