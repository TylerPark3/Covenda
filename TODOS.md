# TODOS

Deferred during `/autoplan` on the portal redesign. Each has a reason, not just a name.

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
