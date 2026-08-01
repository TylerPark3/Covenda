# TODOS

Deferred during `/autoplan` on the portal redesign. Each has a reason, not just a name.

## Leaving Vercel — step 1 done, steps 2-6 open

Step 1 (remove `@vercel/blob`) is complete: `api/storage.js` is the seam, backed by Supabase
Storage, and zero `@vercel/*` packages remain. Hosting is now a deployment decision rather than
a rewrite. Remaining, in order:

- **Create the `uploads` bucket in Supabase, private.** Nothing works until it exists. Set a
  bucket-level file-size limit while you are there (see the downgrade below).
- **Two guarantees weakened by the provider swap.** The old signed upload token carried
  `maximumSizeInBytes` and `allowedContentTypes`, so the *storage service* refused an oversized
  or wrong-typed upload. A Supabase signed upload URL carries neither. Both limits still exist
  in `api/upload-token.js` but are now enforced before minting the URL, not by storage after.
  A caller who obtains a URL legitimately could PUT something larger than `MAX_BYTES` to their
  own path — bounded (no cross-member reach, no read, no delete) but real. A bucket-level file
  size limit closes it.
- **Old files stay on Vercel Blob.** Reads handle both, so nothing breaks, but the Vercel Blob
  store cannot be deleted until those objects are copied across or aged out. No data migration
  was attempted: copying files is a riskier change than ceasing to write new ones.
- **Express/Fastify shim** so the 84 `(req, res)` handlers run off-platform.
- **Replace the 3 `vercel.json` crons** with systemd timers or `node-cron`.
- **Move DNS**, TTL dropped to 300s a day beforehand so a rollback takes five minutes.

## Live on production, found by the 2026-08-01 pre-merge audit

These were refuted as findings *against portal-redesign-v1* — correctly, since the branch does
not touch them. That scoping is not the same as "not a problem": each one is shipped and live on
covenda.app right now. Ordered by how much they would cost.

- ~~`bump_rate_limit` is a SECURITY DEFINER function with no REVOKE.~~ **FIXED 2026-08-01 (20260801300000). A test now requires a revoke for every definer function in the repo.**
  Original finding:
  `supabase/migrations/20260728200000_infrastructure.sql:34-51`. Every other definer function in
  the repo revokes from `anon`/`authenticated`; this one does not, so it is callable by any
  browser role. Same class as the two people views closed in `20260730300000`, which the Supabase
  advisor did flag. This one it did not.

- ~~The work-email verification attempt cap never fires.~~ **FIXED 2026-08-01 (20260801300000 + api/portal.js). The attempts column exists and the company path increments it, mirroring the student path.**
  Original finding:
  `api/verification.js:106` gates on `Number(record.attempts) >= MAX_ATTEMPTS`, but
  `company_email_codes` (`20260727200000_company_verification.sql:11-19`) has no `attempts`
  column and nothing increments one. So the check reads `undefined >= 5`, which is false, forever.
  A code can be brute-forced without limit. This is the "fails open while appearing to work"
  pattern the rate limiter already taught us once.

- ~~`renderVerification` iterates `verification.signals` with no shape guard~~ **FIXED 2026-08-01. All four readers go through asList; a test forbids bare forEach, ||[] and optional chaining on that field.**
  Original finding: (`portal.js`,
  the `v.signals.forEach` line). Identical to the crash that killed the portal on `t.unprompted`.
  Live today; `studentJourney` was hardened for the same field, this was not.

- ~~`renderCredibility` uses `(x||[]).find` on the same field.~~ **FIXED 2026-08-01, same change.**
  Original finding: Truthiness where shape is meant.

- **`requestIntroduction` does not apply the `portfolio_visibility` gate** (`api/portal.js`).
  The shortlist and the directory both withhold invisible students; this path does not. The
  auditor argued it is a different direction of disclosure, which is worth deciding deliberately
  rather than by omission.

- **`loadBatchRoster` returns full profiles and user_ids of admitted students** with no
  visibility gate.

- ~~`registerClub` overwrites any existing club by slug with no ownership check~~ **FIXED 2026-08-01. Only the original registrant may update, and created_by is never rewritten. Officer turnover still needs a human-in-the-loop route.**
  Original finding: — a club can be
  hijacked by registering its slug.

- ~~Verification codes are placed in the email subject line~~ **FIXED 2026-08-01. Subject is generic; the code is in the body.**
  Original finding: (`api/portal.js`). Subjects appear
  in notification previews on a lock screen.

- ~~`recordDelivery` writes raw provider error text into `error_events`~~ **FIXED 2026-08-01. Runs through safeDetail like every other error path.**
  Original finding:, bypassing the
  `safeDetail` redaction every other error path uses.

- ~~The mobile nav drawer is not positioned.~~ **FIXED 2026-08-01.** position:fixed restated inside the 680px block (not by editing the global rule, whose ::after anchors to it and whose desktop behaviour is fine). The closed drawer is now visibility:hidden too, so its eleven controls leave the tab order. Original finding: `.member-nav` computes to `position:relative`
  (`portal.css`, pre-existing since 9803d72), so the 680px slide-in transform does not produce a
  drawer. Worth confirming in a real browser before acting.

- ~~At the 1000px breakpoint every nav button loses its accessible name~~ **FIXED 2026-08-01.** Labels are clipped rather than display:none, so the name stays in the accessibility tree. Original finding: — labels are hidden and
  no `aria-label` replaces them, leaving eight unlabelled buttons for a screen reader.

## Pilot: Brief-First Concierge (approved 2026-07-31)

- **Deal 000, the retrospective run.** Re-run the already-closed deal's scoping through
  `project-intake.js`, playing the company, using their literal first message. Log every
  question you asked in real life that the engine never asked. One hour, no code.
  Instrument: `docs/pilot/BRIEF_GAP_LOG.md`.
- **Falsification watch on P1.** If minutes-to-scoped-brief drops more than 4x between deal
  000 and deal 005, scoping was a learning tax rather than a structural bottleneck and the
  pilot's premise is wrong. Let it die if it earns it.
- **Unanswered, and needed before deal 001.** Which company paid, how much, for what, and
  have they come back? The V1 bar is a *second* engagement, and that is unknown today.
- **Open risk.** If the founder's scoping is judgment rather than a question set, the engine
  cannot capture it and Approach C (sell the brief standalone) becomes the real business.

## Deferred from the portal redesign

- **Offline / retry handling.** `portalRequest` has no retry layer. Adding one is its own
  change with its own failure modes; the redesign should not smuggle it in.
- **Multi-tab behaviour.** No state is shared between tabs today. Not a redesign concern.
- **Screen-reader pass.** No assistive-technology harness exists, so this cannot be
  automated honestly. Needs a human with a screen reader.
- **Tap-target audit — measured 2026-08-01, partially fixed.** The portal has 12 interactive
  rules under the 44px guidance. Two were introduced by the redesign and are fixed
  (`.member-account-menu button` 40->44, `.skip-link` 44). The rest are pre-existing and were
  left alone deliberately: raising them changes layouts that cannot be verified without a
  browser, and no browser driver is available here. Recorded rather than silently changed:
  `.message-attach-btn` 34, `.list-row button` 36, `.cred-next-go` 40, `.conversion-label select`
  40, `.discover-filters input/select` 42, `.axis-grid select` 42, `.closeout-answers button` 42.
  The four checkbox rules (`.chip-check input` 15, `.visibility-row input` 16,
  `.intake-consent input` 24, `.filter-line input` 34) are likely fine, since the label is the
  click target, but that needs a human to confirm.
- ~~**Skip link.**~~ Added 2026-08-01: off-screen until focused, targets `#memberMain`, which is
  `tabindex="-1"` so focus actually moves rather than only the viewport.
- ~~**`DESIGN.md`.**~~ Written 2026-08-01. Every token value in it was verified against
  `type.css` and `styles.css` rather than recalled. It names which rules are enforced by
  `tests/frontend-structure.test.js` and which are conventions, so a reader knows what bites.

## Deferred from earlier today

- **`record-outcome` idempotency.** No conflict handling; a retry after a committed-but-failed
  write creates a second row. A unique index on `introduction_id` would settle it.
- **Audit events.** The V1 spec's event taxonomy (`shortlist.published`, `outcome.recorded`,
  `introduction.*`) is specified and unimplemented.
- **Shortlist empty state.** Now that the visibility gate can empty a shortlist, a company
  can see nothing at all rather than "being prepared".
- **Operator signal when a candidate is dropped.** The visibility gate silently removes a
  student the operator chose. Correct for privacy, surprising for the operator.
- **Synthetic browser check in CI.** Ten lines: load the homepage, click a nav control,
  assert the DOM changed. Would have caught the `ddca447` outage the day it shipped.
- **Migration-head assertion at startup.** Code deploys automatically; migrations need a
  human paste. That gap let the client run eleven migrations ahead of the schema.
- **Linter.** None exists. Acceptance test 12 asked for one.
