# TODOS

Deferred during `/autoplan` on the portal redesign. Each has a reason, not just a name.

## Deferred from the portal redesign

- **Offline / retry handling.** `portalRequest` has no retry layer. Adding one is its own
  change with its own failure modes; the redesign should not smuggle it in.
- **Multi-tab behaviour.** No state is shared between tabs today. Not a redesign concern.
- **Screen-reader pass.** No assistive-technology harness exists, so this cannot be
  automated honestly. Needs a human with a screen reader.
- **Tap-target audit.** The public student form has a control at 42px against the 44px
  guidance. Whether the portal has the same issue is unmeasured.
- **Skip link.** Not specified in the design direction and not present today.
- **`DESIGN.md`.** The visual system exists only in `portal.css`. "Preserve the editorial
  identity" currently has no written definition to preserve against.

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
