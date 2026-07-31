# Portal redesign — implementation plan

`/autoplan` over the approved design direction in `PORTAL_REDESIGN_CONSULTATION.md`. **Nothing implemented.** Plan ends at the approval gate, per the brief.

**Voices:** `[codex-unavailable]` — Codex CLI is not installed. Claude-only. Stated rather than hidden; this review has less independence than a dual-voice one.

**Scope detection:** UI scope **yes** (nav, dashboard, cards, layout, mobile — 20+ matches). DX scope **no** (no API/CLI/SDK surface; the portal is product UI). **Phase 3.5 skipped.**

---

## Two corrections to the brief, before anything else

### C-1 — There are no routes, so there is nothing to redirect

The brief asks to *"preserve all existing routes"* and *"add redirects for renamed routes"*, and acceptance test 10 requires *"every renamed route has a working redirect."*

`portal.js:168`:

```js
function setView(view) {
  const allowed=['overview','projects','activity','discover','batches','portfolio','messages','wallet'];
  state.view=allowed.includes(view)?view:'overview';
  $$('[data-portal-view]').forEach(s=>s.classList.toggle('is-active', s.dataset.portalView===state.view));
  ...
}
```

The portal is **one page** (`portal.html`) with panel switching. **Zero** `pushState` calls in `portal.js`. The URL never changes. There is no `/portal/career`, no `/portal/profile` — those exist only in the brief.

**Consequences:**
- Acceptance test 10 is **vacuous as written** — nothing to redirect.
- Renaming a nav item is a label change plus a `data-view` value. No migration.
- **But:** the brief also requires *"the next action must deep-link directly to the correct form."* No deep-link mechanism exists. `covendaProjectSeed` in `localStorage` is the closest thing and is a one-shot seed consumed on load.

**Auto-decided (P5, explicit over clever):** do **not** add URL routing to satisfy a requirement that only exists because the brief assumed it. Deep-linking becomes `setView(view, { focus: '#elementId' })` — switch panel, scroll to the target, focus it. Ten lines against the function that already exists. Acceptance test 10 is **rewritten** as: *every renamed nav item reaches the same content it did before*.

### C-2 — Two of the four gates in acceptance test 12 do not exist

Test 12 requires *"lint, typecheck, tests, and production build pass."*

```
npm run check  →  node --check (syntax) on ~40 files, then node --test
```

There is **no linter**, **no TypeScript** (no `.ts`, no `tsconfig.json`), and **no build step** — the site is static files served by Vercel.

**Auto-decided (P3, pragmatic):** test 12 becomes *"`npm run check` passes (syntax + 1,382 tests) and the deployed page loads with no console errors."* Adding ESLint and a bundler to satisfy a checklist item is new infrastructure this redesign does not need. **Flagged, not silently dropped** — if you want a linter, that is its own task.

---

## What already exists

The redesign is composition. Almost every part exists.

| Need | Existing | Gap |
|---|---|---|
| Panel switching | `setView()` + `[data-portal-view]` | add focus target |
| Nav collapse | `--nav: 228px → 82px` at breakpoint | reuse for tablet |
| Section builder | `portalGroup()`, `techSection()`, both fault-isolated via `buildSection()` | none |
| Irreversible confirm | `armedButton()` | none |
| Evidence tiers | `presentationBand()`, `TIERS` | surface per skill |
| Setup steps | `ONBOARD_SCREENS`, `shouldOnboard()`, `mergeSavedOnboard()` | reuse as the checklist source |
| Verification state | `#verificationPanel`, `loadVerificationStanding()` | becomes one checklist item |
| Empty states | `emptyList(root, icon, title, copy, action)` | already takes a CTA |
| Reduced motion | `prefers-reduced-motion` checked in `transitionAudience` | apply to nav |
| Guards | `asList()`, shape-not-truthiness | keep using |

**No new tables. No new API actions. No new dependencies.**

---

## The mapping

Format as requested: **Existing component → UX problem → Approved change → Code change → Data impact → Route impact → Test → Rollback.**

### M-1 · `.member-nav` (8 destinations)

- **Problem:** 8 destinations, 4 non-actionable badges, sign-out occupying primary space.
- **Change:** 5 destinations — Home · Opportunities · My Work · Profile · Messages · Earnings *(6 including Earnings)*. Sign-out into the account menu.
- **Code:** `portal.html:80-100` nav markup; `setView()` allowlist gains `opportunities`, keeps old values as aliases.
- **Data:** none.
- **Route:** none *(C-1)*. `discover` and `batches` become tabs inside `opportunities`.
- **Test:** every old `data-view` value still resolves; nav renders 6 items; sign-out is not in `.member-nav`.
- **Rollback:** revert markup; `setView` aliases are additive and harmless.

### M-2 · Nav badges

- **Problem:** `#batchCount` shows 25 with nothing to respond to. `#projectCount`, `#intakeCount`, `#opportunityCount` are informational.
- **Change:** keep `#messageCount` (unread is actionable). Remove the rest from nav; `#walletNavBalance` moves into the Earnings page.
- **Code:** remove badge spans; delete their paint calls.
- **Data:** none — the counts still exist in the payload.
- **Route:** none.
- **Test:** exactly one badge element in `.member-nav`, and it is the message count.
- **Rollback:** re-add spans; paint functions untouched.

### M-3 · `.welcome-row`

- **Problem:** oversized greeting consuming primary viewport without helping.
- **Change:** one line + one subline, no card. `#primaryAction` moves into the NEXT card.
- **Code:** `portal.html:111`; `renderWelcome()` copy.
- **Data:** none.
- **Route:** none.
- **Test:** greeting is not inside a bordered card; the page has exactly one primary CTA.
- **Rollback:** restore markup.

### M-4 · `.overview-rail` (8 panels) — **the main change**

- **Problem:** 360px permanent rail with 8 panels; four of them answer the same question.
- **Change:** remove the rail **container**. Panels become contextual or fold into the setup model.

| Panel | Destination |
|---|---|
| `#profileRing` + `#journeyPanel` + `#verificationPanel` + `#nextActions` | **one NEXT card** with `Setup N of 6` |
| `#introPanel` | first session only |
| `#trialStartPanel` | only when a trial is startable |
| `#pipelinePanel` | only with an active pipeline |
| `#milestonePanel` | moves to project detail |

- **Code:** delete `.overview-rail` from `portal.html:120-128`; `.overview-grid` becomes single-column; render functions keep their panel builders and gain visibility conditions.
- **Data:** none — every panel reads the same dashboard fields.
- **Route:** none.
- **Test:** `.overview-rail` absent; NEXT card renders exactly one action; setup count equals real completed steps, never hardcoded.
- **Rollback:** restore the grid column and the rail element. **Panel builders are not deleted**, which is what makes rollback cheap.

### M-5 · Consolidated setup

- **Problem:** four progress systems (`profileRing` %, journey, verification, nextActions).
- **Change:** one model — `Setup 4 of 6`, one named next action, expandable list.
- **Code:** new `setupModel(dashboard)` deriving steps from existing signals: profile fields, `skill_signals`, projects, preferences, `identity_verified`, endorsement. Rendered by `portalGroup()`.
- **Data:** **read-only.** Nothing new stored. Per the brief, completion is claimed only where real data supports it — each step maps to a field, never to a flag we set ourselves.
- **Route:** none. Next action uses `setView(view, {focus})` from C-1.
- **Test:** count matches the data for partial/complete/unverified/verified fixtures; the next action's focus target exists in the DOM.
- **Rollback:** re-render the old panels; `setupModel` is additive and pure.

### M-6 · Skills surface

- **Problem:** skills are keywords; adding one is not discoverable; evidence is not connected visibly.
- **Change:** Profile › Skills. Each skill shows its tier (`Self-declared / Evidence connected / Verified / Needs more evidence`) with its evidence beneath. Add-skill is one field; attaching evidence is a separate later act.
- **Code:** new skills view inside the Profile panel; tier from `presentationBand()` per skill; reuse `armedButton` for remove.
- **Data:** reads `member_profiles.skills` and `skill_signals`. Writing a skill uses the existing `save-profile` action — **no new API**.
- **Route:** none.
- **Test:** skill editor reachable in ≤2 interactions (acceptance test 2); tier label present as **text**, not colour alone; **no numeric score anywhere** (D10).
- **Rollback:** hide the view; data untouched.

### M-7 · Empty state

- **Problem:** "No assigned project yet" is passive and dominates.
- **Change:** explanation + two CTAs + suggested opportunities beneath.
- **Code:** `emptyList()` already accepts `{label, run}` — pass a second action, then render up to 3 recommendations.
- **Data:** none.
- **Route:** none.
- **Test:** no-active-work state renders both CTAs and never occupies the full viewport alone.
- **Rollback:** one-line revert.

### M-8 · Responsive

- **Problem:** three columns at every width above the breakpoint.
- **Change:** desktop single column; tablet reuses the existing 82px icon rail; mobile gets a bottom tab bar.
- **Code:** `portal.css` — `.overview-grid` to one column at all widths; new `@media (max-width: 767px)` tab bar.
- **Data / Route:** none.
- **Test:** no horizontal overflow at 375 / 768 / 1280 (acceptance test 8 — the harness for this already exists from the QA sweep); tap targets ≥44px.
- **Rollback:** revert CSS.

---

## Dependency order

```
1. M-1 nav + setView aliases      ← everything else assumes the new nav
2. M-2 badges                     ← trivial, unblocks nav tests
3. M-5 setupModel (pure fn+tests) ← NEXT card depends on it
4. M-4 rail removal + NEXT card   ← the main change
5. M-3 greeting                   ← visual only, after layout settles
6. M-7 empty state
7. M-6 skills surface             ← largest new surface; independent
8. M-8 responsive                 ← last, once structure is final
```

Steps 1–6 are one branch. **Step 7 should be its own branch** — it is the only piece that is genuinely new rather than re-composed.

---

## Test plan

| # | Test | Type |
|---|---|---|
| T1 | Old `data-view` values still resolve through `setView` | unit |
| T2 | `.member-nav` renders 6 items, sign-out absent | structure |
| T3 | Exactly one nav badge, and it is messages | structure |
| T4 | `.overview-rail` absent from markup | structure |
| T5 | `setupModel` returns correct counts across 6 fixtures | **behavioural** |
| T6 | Setup count never exceeds real data | **behavioural** |
| T7 | NEXT card renders exactly one action | structure |
| T8 | Focus target of the next action exists in the DOM | structure |
| T9 | Skill tier is text, not colour alone | structure |
| T10 | No numeric score in the skills view | structure |
| T11 | Empty state renders both CTAs | structure |
| T12 | No horizontal overflow at 3 viewports | browser |
| T13 | Keyboard: nav → NEXT card → active work, focus visible | browser |
| T14 | Reduced motion honoured on nav transition | structure |

**T5 and T6 are the ones that matter** — the rest assert shape. Every test gets verified failing against the un-refactored version before commit, per the standing rule.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `setView` allowlist drops a value; a nav item silently dead-ends | **High** | T1 covers every old value; aliases are additive |
| Setup count claims completion the data does not support | **High** | T6; every step maps to a field |
| Rail removal hides a panel a student needed | Medium | Panels become contextual, not deleted; rollback restores in one commit |
| `portal.js` is 6,500 lines; large edits are risky | Medium | Changes are localised; `buildSection` already isolates render failures |
| Skills view is the only genuinely new surface | Medium | Separate branch, ships after the rest is stable |

---

## NOT in scope

Company and partner portals (brief constraint 15) · new tables or API actions · URL routing *(C-1)* · linter or bundler *(C-2)* · the Career Signal Engine · any change to shortlist, outcome or accommodation surfaces shipped earlier today.

---

## Decision audit trail

| # | Phase | Decision | Class | Principle | Rationale |
|---|---|---|---|---|---|
| 1 | Intake | Skip Phase 3.5 (DX) | Mechanical | — | No developer surface |
| 2 | CEO | Reject URL routing | **Taste** | P5 explicit | Requirement assumed routes that do not exist; `setView(view,{focus})` is 10 lines vs a routing layer |
| 3 | CEO | Rewrite acceptance test 12 | Mechanical | P3 pragmatic | Lint and typecheck do not exist; adding them is separate scope |
| 4 | CEO | Rewrite acceptance test 10 | Mechanical | — | Vacuous as written; nothing to redirect |
| 5 | Eng | No new tables or API actions | Mechanical | P4 DRY | Every field needed is already in the dashboard payload |
| 6 | Eng | Panels contextual, not deleted | **Taste** | P2 blast radius | Preserves rollback and functionality; costs some dead code until proven |
| 7 | Eng | Skills view on its own branch | **Taste** | P3 pragmatic | Only genuinely new surface; isolates the risk |
| 8 | Design | Setup as a count, not a percentage | **Taste** | P5 explicit | "4 of 6" is actionable; "67%" is not |
| 9 | Design | Keep `#messageCount` only | Mechanical | — | Unread is the sole actionable count |

---

## Gate

Rendered as prose deliberately — the tool-based gate was declined last time.

**D1 — approve this implementation plan?**

**ELI10.** The redesign is mostly moving things that already exist: 8 nav items become 6, the 360px right rail goes away and its 8 panels either combine into one setup card or appear only when relevant. Two requirements in your brief assumed things this codebase does not have (URL routes, a linter), so I rewrote those acceptance tests rather than build infrastructure to satisfy a checklist. The one genuinely new surface is the skills editor, and I would ship it on its own branch.

**Stakes if we pick wrong.** Getting the nav aliases wrong means a student clicks a nav item and lands nowhere. That is why T1 exists and why the old `data-view` values stay as aliases rather than being renamed in place.

**Recommendation: A** — approve as planned, because the two corrections are grounded in what the repo actually is, and the sequencing keeps the risky part (skills) separate from the safe part (re-composition).

**A) Approve as planned** *(recommended)* — **Completeness 9/10.** Steps 1–6 on one branch, skills on a second. Every acceptance test either passes as written or is rewritten with the reason stated. `npm run check` plus a live browser pass at three viewports. The one gap from 10/10: no authenticated end-to-end run, because I still have no account.

**B) Approve, but build URL routing too** — **Completeness 10/10 against the brief as written.** Real deep-links, shareable URLs, browser back/forward. Costs a routing layer in a 6,500-line file that has never had one, and back/forward becomes a new class of bug in a portal that just had two render outages. **Human ~2 days / CC ~3 hours.**

**C) Approve steps 1–6 only, defer skills** — **Completeness 6/10.** Ships the crowding fix fast and leaves requirement 9 ("make Add skills easy to find") unmet. Reasonable if you want the layout win in front of students this week.

**Net:** A trades strict brief-compliance for fitting the codebase you have. B is the only option that satisfies acceptance test 10 literally, and pays for it with a routing layer you did not previously need.

Reply **A**, **B**, or **C**.

---

**Status: DONE_WITH_CONCERNS.** Plan complete, nothing implemented.

**Concerns:** single-voice review (no Codex); no authenticated session, so every acceptance test involving a signed-in student is unverified by me; and the design direction this implements was itself built from markup rather than a running portal, since no screenshot arrived.
