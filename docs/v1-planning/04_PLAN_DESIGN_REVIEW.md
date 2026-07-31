# Design Review — Covenda V1

Output of `04_PLAN_DESIGN_REVIEW.md`. Reviewed against the live product, `portal.css` / `styles.css` / `type.css`, and Ch. 12–17, 28, 41.

**Posture:** the visual language is deliberate and largely good. This review preserves it and attacks specific behaviours, not the aesthetic.

---

## ⚠️ Correction: the headline finding below is WRONG. D-01 is withdrawn.

Checking the call sites disproves it. The two renderers serve **different audiences, deliberately**:

| Renderer | Called from | Audience |
|---|---|---|
| `fitTier` — tier label, no number | `applicantCard` (`portal.js:515`, `application.fit_score`) | **Company viewing a candidate** |
| `fitPill` — `% fit` + uncertainty band | `discoverCard` (`:1611`), `openDiscoverDetail` (`:2913`) | **Student viewing a project** |

The rule in the codebase is scoped precisely — *"an employer sees a tier, never a raw percentage. A number invites arithmetic the score cannot support — a company comparing 71 against 68 is reading precision that is not there."* The company-facing path uses `fitTier`. It obeys its own rule.

A student seeing their own fit to an opportunity, with the uncertainty band shown, is decision support for the person the number is about. That is not "reducing a person to one opaque score" (Ch. 1.5 instruction 4), which concerns third parties evaluating people.

**D-01 is withdrawn. Do not delete `fitPill`.** Deleting it would have removed the student's uncertainty band and made the discover view less honest, not more.

The reasoning error: I matched a *pattern* (two similar functions, one with a warning comment) that had been correct three times before — `armedButton`, the evidence ladders, `endProjectControl` — and asserted it a fourth time without checking who each caller served. Duplication is not automatically drift.

The remaining ratings below stand. The section that follows is retained deliberately, as the record of a wrong call.

---

## ~~Headline finding: the product renders a score it forbids~~ *(withdrawn — see above)*

`portal.js` contains two fit renderers:

```js
function fitTier(score, pres){          // tier label: "Strong signal"
  ...
  // The number stays available to the operator, never rendered to the company.
  el.dataset.score = ...
}

function fitPill(score, pres){          // "71% fit"
  el.textContent = `${s}% fit`;
}
```

`fitTier` is correct and states the rule in its own comment. `fitPill` violates it — and is used **more**: 3 call sites versus 2, including the discovery row (`:1611`) and the detail header (`:2913`).

This contradicts Ch. 4.2 (context over universal ranking), Ch. 1.5 instruction 4 (*never reduce a person to one opaque score*), the repo's own note that *"an employer sees a tier, never a raw percentage — a company comparing 71 against 68 is reading precision that is not there"*, and D10.

**Resolved change D-01: delete `fitPill`; route all three call sites through `fitTier`.** This is the same failure mode as the two evidence ladders and the two arming-button implementations found earlier — a correct abstraction was written, and the thing it replaced was left in place and kept being used.

---

## AI-slop audit

Measured, not asserted.

| Signal | styles.css | portal.css | Verdict |
|---|---|---|---|
| `linear-gradient` | 51 | 40 | **Acceptable** — the gold treatment is the brand |
| `radial-gradient` | 24 | 4 | Acceptable |
| `box-shadow` | 72 | 54 | **Watch** — highest slop risk |
| `border-radius: 9999` | 0 | 0 | ✅ Clean — no pill-everything |
| `backdrop-filter` | 16 | 5 | Acceptable |

**Type is disciplined:** 5 sizes (`display`, `heading`, `subhead`, `body`, `caption`), 3 weights. That is a real type system, not ad-hoc sizing — rare, and worth protecting.

**No generic AI aesthetic.** No purple-blue gradient hero, no pill-shaped everything, no decorative icon grid. Recent commits ("Delete the gold auras: points, not blobs", "Delete the gold bonds", "Remove the gold dot at the cursor") show active *subtraction*. That instinct is correct and should continue.

**Language check:** the homepage says "Beyond the Resume", "Prove your worth, get paid", "Find the next unicorn talent". The first two are concrete. **"Find the next unicorn talent" is empty marketing language** and contradicts the thesis — Covenda's claim is evidence and fit, not lottery-ticket talent. **D-02: replace.** Something like "See what they've actually built."

---

## Surfaces

### Public landing page

**Intent:** a founder decides in 20 seconds whether this is for them.
**Hierarchy today:** brand → "Beyond the Resume" → three-way audience choice → how-it-works → trial steps.

**Problem.** The three-way path picker (student / company / referrer) makes the visitor do segmentation work before receiving any value, and it dilutes the founder-first decision (D1). Three doors means no door is designed well.

**D-03:** lead with the founder. Keep the student/referrer paths as secondary nav, not a co-equal fork. The audience-switch machinery already exists and works — this is a hierarchy change, not a rebuild.

**States:** the intro animation ("Replay intro") must never block first paint or delay the CTA. Verify reduced-motion is honoured — `transitionAudience` already checks `prefers-reduced-motion`, which is correct and should be the pattern everywhere.

---

### Student onboarding

**Intent:** get to a shareable evidence profile in under 30 minutes.
**Today:** multi-screen flow — role, profile, verticals, work types, school, graduation, headline, skills, bio, handoff.

**Problem.** Ten screens before a single piece of evidence is added. The flow collects *claims* first and evidence last, which is backwards for a product whose thesis is evidence over claims.

**D-04:** move evidence capture earlier — ideally screen 2, immediately after name. "Paste a link to something you built" is a better second question than "what is your graduation year."

**Empty state:** a profile with zero evidence must say what to add and why, never render an empty shell.
**Stale state:** the crash fixed earlier came from restoring saved progress without validating shape. `mergeSavedOnboard` now guards it; the design rule is that **restored progress must always be re-validated, never trusted.**

---

### Student evidence profile

**Intent:** feel like a living body of work, not a résumé form.

**Preserve:** the tier distinction (self-reported → artifact-linked → verified) is the product's core visual idea and it is implemented.

**D-05:** verification state must be legible at a glance without a legend — an unverified item should look visibly *lighter* than a verified one, not merely carry a different badge. Missing evidence must read as "not yet shown", never as weakness (Ch. 4.3).

---

### Company onboarding / Company DNA

**Intent (V1):** get to a signed Talent Brief.
**Today:** the company surface is a project form. Company DNA is an operator interview (D4) with no UI.

**D-06:** the brief form should ask for the *environment*, not just the task — team size, who evaluates, what the first 30 days look like. That is what makes a shortlist explainable, and `company_environments` already exists in the schema to hold it.

---

### Shortlist review *(the money surface)*

This is where a founder decides whether Covenda is worth a second brief. It deserves the most design attention and currently has the least.

**Hierarchy per candidate:** evidence first → rationale second → identity third. Not a profile card with evidence buried below the fold.

**D-07:** no rank order, and say so. Five candidates presented as an ordered list will be read as a ranking regardless of intent. Present as a set, with a one-line note that order implies nothing.

**D-08:** the operator's rationale is the product. It should be the most prominent text on the card, not a caption.

**States.** *Empty:* "Being prepared — by [SLA date]", never a bare empty grid. *Partial:* a candidate mid-verification shows the honest tier, never a spinner standing in for data.

---

### Introduction approval

**Preserve.** The consent gate is well-modelled — `introductions` carries `role_summary`, `why_relevant`, `compensation`, `time_commitment`, `next_step`. That is exactly the right set for an informed decision.

**D-09:** the decision is irreversible in V1 and must say so *before* confirming, not after. Reuse the existing `armedButton` two-step pattern — it exists, is now the single implementation, and is the right affordance for irreversible actions.

**Accessibility:** approve/decline must be reachable and operable by keyboard with a visible focus ring; this is the highest-stakes action a student takes.

---

### Outcome collection

**Intent:** the founder records what happened in under 60 seconds.

**D-10:** two required fields only — what happened, and `would_continue`. Everything else optional. Demanding `days_to_contribution` and `senior_hours` from a founder who did not measure them produces fabricated data, which is worse than absent data for a product whose thesis is evidence quality.

**Empty state is the operator's worklist** — outstanding outcomes, oldest first. This list *is* the admin product for 90 days (spec §8).

---

### Operator / admin

**D-11:** the admin home should be the four worklists from spec §8, not a dashboard of metrics. The founder needs a queue, not analytics, at n=5.

---

## Accessibility

**Blocking (D15 / R-09):** the required walkthrough has no text alternative, no captions requirement, and no accommodation route. Requiring video to apply, with no alternative, excludes students — a fairness defect in a product whose stated purpose is fairer evaluation. `accommodation_requests` already exists in the schema and is unwired.

**Also required:** focus visible on every interactive element; the armed-confirm pattern must announce its state change to screen readers (currently a `textContent` swap with no `aria-live`); colour must never be the sole carrier of verification tier.

---

## Ratings

| Dimension | Rating | Note |
|---|---|---|
| Visual identity | **8/10** | Distinctive, restrained, actively subtracting |
| Typography | **8/10** | Real scale, 3 weights, disciplined |
| Information hierarchy | **5/10** | Three-door landing; evidence too late in onboarding |
| Evidence-first design | **7/10** | Tiers modelled well and audience-scoped correctly |
| Honesty of display | **7/10** | Company sees a tier; student sees their own fit with an uncertainty band. Correct. |
| Empty/partial states | **5/10** | Present but inconsistent; shortlist unbuilt |
| Accessibility | **3/10** | No walkthrough alternative; focus/ARIA gaps |
| Destructive confirmation | **8/10** | `armedButton`, now single implementation |
| AI-slop resistance | **8/10** | No generic aesthetic; shadow count worth watching |

---

## Resolved changes

| ID | Change | Priority |
|---|---|---|
| ~~D-01~~ | ~~Delete `fitPill`~~ — **withdrawn**, the two renderers serve different audiences by design | — |
| D-02 | Replace "Find the next unicorn talent" | High |
| D-03 | Landing leads with the founder; other paths secondary | High |
| D-04 | Move evidence capture to onboarding screen 2 | High |
| D-05 | Verification state legible without a legend | Medium |
| D-06 | Brief captures environment, not just task | High |
| D-07 | Shortlist presented as a set, not a ranked list | **Blocking** |
| D-08 | Rationale is the most prominent text on the card | **Blocking** |
| D-09 | Irreversible actions warn before, via `armedButton` | Medium |
| D-10 | Outcome form: two required fields | **Blocking** |
| D-11 | Admin home is four worklists | Medium |
| D-12 | Walkthrough accessibility path | **Blocking** |

---

## Unresolved taste decisions for Tyler

1. **How much of the intro animation survives contact with a founder in a hurry?** It is beautiful and it is between the visitor and the value. I would keep it, gated on `prefers-reduced-motion` and skippable on first frame — but this is your call.
2. **Does the landing page keep three doors?** D-03 argues one. If you believe the student side drives word-of-mouth at Columbia, three may be right and the founder-first argument is wrong.
3. **Tier labels.** "Strong signal / promising / early signal" is honest but soft. A founder may want something more decisive. Changing it changes what the product claims.
4. **Does the company ever see the number?** Today it does not, and I think that is right. There is a defensible position that a sophisticated technical founder should see the score *with* its uncertainty band, exactly as the student does. Worth deciding explicitly rather than by default.

---

## Next command

`/plan-eng-review` with `docs/gstack-prompts/05_PLAN_ENG_REVIEW.md`.
