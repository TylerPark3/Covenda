# Student Portal — design consultation

Redesign direction for review. **Nothing implemented.** Per the brief: direction first, approval, then code.

**Evidence basis, stated honestly.** No screenshot arrived with the request, and the authenticated portal cannot be reached without an account. This diagnosis is built from `portal.html`, `portal.css`, and your description — which the markup corroborates precisely. Anything I could not verify is marked *(unverified)*.

**Also relevant:** `NO_DESIGN_FILE` — there is no `DESIGN.md`. The visual system is real and consistent but lives only in `portal.css`. That is worth fixing separately; it is why "preserve the editorial identity" currently has no written definition to preserve *against*.

---

## 1. Current UX diagnosis

### The crowding is measurable

At a 1440px viewport:

```
228px  nav        (--nav: 228px, fixed)
 72px  gap        (clamp(35px, 5vw, 80px) → 72px at 1440)
360px  right rail (minmax(310px, 360px))
──────
660px  chrome — 46% of the viewport
724px  main content — 50%
```

**The primary column gets barely half the screen.** The rail alone is larger than a phone.

### The rail holds eight blocks, not two

From `portal.html:120-128`, `aside.overview-rail` contains:

| # | Element | What it says |
|---|---|---|
| 1 | `.profile-progress` / `#profileRing` | Profile strength, % ring |
| 2 | `#introPanel` | How this works |
| 3 | `#pipelinePanel` | Pipeline state |
| 4 | `#trialStartPanel` | Starting a trial |
| 5 | `#journeyPanel` | Journey / building proof |
| 6 | `#milestonePanel` | Milestones |
| 7 | `#verificationPanel` | Verification checklist |
| 8 | `#nextActions` | "What you can do next" |

Plus five in the main column: `.welcome-row`, `#companySegments`, `#briefingPanel`, `#focusProject`, `#memberMetrics`.

**Thirteen content blocks on one screen**, most at similar visual weight. Your instinct is right and it is worse than "a few too many cards."

### Four systems answer one question

`#profileRing` (strength %), `#journeyPanel` (building proof), `#verificationPanel` (verification), and `#nextActions` (what to do next) are four different progress models. A student has to learn all four to work out what to do. **This is the single biggest fix available.**

### Navigation

Eight destinations plus identity plus sign-out, four carrying counts: `#projectCount`, `#intakeCount`, `#opportunityCount`, `#batchCount`, `#messageCount`, `#walletNavBalance`.

`#batchCount` showing 25 is the clearest offender. Twenty-five batches exist; none require the student to respond. It reads as an inbox and is a catalogue.

### What is already good

- The type system is real: 5 sizes, 3 weights, defined in `type.css`. Rare and worth protecting.
- Contrast measured on the public side: **19:1** headings, **6.4:1** body. Comfortably above AA.
- `--nav` already collapses to **82px** at a breakpoint, so a compact rail is a pattern the CSS already knows.
- The gold accent is used as accent, not decoration.

**The problem is information architecture, not visual design.** Almost nothing here needs to look different. Things need to stop competing.

---

## 2. Revised information architecture

One organising rule: **the dashboard answers "what now", everything else is a place you go on purpose.**

```
HOME              what now, what is moving, what is available
├── next action        (one, never a list)
├── active work        (or an empty state that offers work)
└── recommended        (3 opportunities, not a feed)

OPPORTUNITIES     everything you could take on
├── Open projects      (was: Explore / discover)
└── Batches            (was: its own destination)

MY WORK           everything you have taken on
├── Active
├── In review
└── Completed          (verified records)

PROFILE           everything that represents you
├── Skills & evidence  (was: Portfolio)
├── Verification       (was: a rail panel)
├── Preferences
└── Account            (sign-out lives here)

MESSAGES          conversations, badge only when unread
EARNINGS          wallet, balance in the page not the nav
```

Eight destinations become five, and the fifth is where sign-out belongs.

---

## 3. Revised navigation

| Now | Proposed | Change |
|---|---|---|
| Overview | **Home** | Rename. "Overview" describes a layout, not a destination |
| Explore + Batches | **Opportunities** | Combine. Both are "work I could take" |
| My work | **My Work** | Preserve |
| Portfolio | **Profile** | Rename + absorb verification, skills, preferences |
| Chats | **Messages** | Preserve |
| Earnings | **Earnings** | Preserve, drop the balance from the nav label |
| User profile | *(account menu)* | Move |
| Sign out | *(account menu)* | Move |

**Badge rule:** a badge means *something is waiting for you*. Unread messages qualify. A catalogue of 25 batches does not. Counts that are merely informational move into the page itself, where there is room to say what they mean.

---

## 4. Desktop wireframe (≥1200px)

```
┌────────┬──────────────────────────────────────────────────────────┐
│        │  Covenda            [search]              ◐   (TP) ▾     │
│  ◇     ├──────────────────────────────────────────────────────────┤
│        │                                                          │
│ Home   │  Good afternoon, Tyler                                   │
│ Oppo…  │  Continue building your profile, or find your next work.  │
│ Work   │                                                          │
│ Profile│  ┌────────────────────────────────────────────────────┐  │
│ Msgs ② │  │ NEXT                                               │  │
│ Earn   │  │ Verify your school email                           │  │
│        │  │ Takes a minute. Unlocks Columbia-only batches.     │  │
│        │  │ [Verify now]                    Setup 4 of 6  ▸    │  │
│        │  └────────────────────────────────────────────────────┘  │
│        │                                                          │
│        │  ACTIVE WORK                                             │
│        │  ┌────────────────────────────────────────────────────┐  │
│        │  │  (project card, or the empty state from §8)         │  │
│        │  └────────────────────────────────────────────────────┘  │
│        │                                                          │
│        │  RECOMMENDED FOR YOU                          See all →  │
│        │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│        │  │ opportunity  │ │ opportunity  │ │ opportunity  │      │
│        │  └──────────────┘ └──────────────┘ └──────────────┘      │
│        │                                                          │
│        │  ──────────────────────────────────────────────────────  │
│        │  Recent activity          Earnings          Messages     │
│  (TP)▾ │  three quiet summary lines, not cards                    │
└────────┴──────────────────────────────────────────────────────────┘
```

**The right rail is gone.** Main content goes from ~724px to **~1150px** — a 59% increase — with no reduction in what is available.

Setup lives in the NEXT card as `Setup 4 of 6 ▸`, expanding in place. One system, one location.

---

## 5. Mobile wireframe (<768px)

```
┌─────────────────────────┐
│ ☰   Covenda      (TP)▾  │
├─────────────────────────┤
│ Good afternoon, Tyler   │
│                         │
│ ┌─────────────────────┐ │
│ │ NEXT                │ │
│ │ Verify school email │ │
│ │ [Verify now]        │ │
│ │ Setup 4 of 6    ▸   │ │
│ └─────────────────────┘ │
│                         │
│ ACTIVE WORK             │
│ ┌─────────────────────┐ │
│ │ project / empty     │ │
│ └─────────────────────┘ │
│                         │
│ RECOMMENDED             │
│ ┌─────────────────────┐ │
│ │ opportunity         │ │
│ ├─────────────────────┤ │
│ │ opportunity         │ │
│ └─────────────────────┘ │
│                         │
│ Activity · Earnings     │
├─────────────────────────┤
│  ⌂     ◈     ▤     ✉    │
│ Home  Oppo  Work  Msgs ②│
└─────────────────────────┘
```

Bottom tab bar for the four most-used destinations; Profile and Earnings live in the account menu. Next action stays above the fold. Cards stack, never scroll sideways. Tap targets ≥44px — note the public form currently has one at 42px, so this needs an audit, not an assumption.

**Tablet (768–1199px):** nav collapses to the existing 82px icon rail; recommended goes 2-up; no right rail at any width.

---

## 6. Component hierarchy

```
PortalShell
├── Nav              5 destinations, badge only when actionable
├── Header           brand · search · theme · AccountMenu
└── Home
    ├── Greeting             one line + one subline, no card
    ├── NextActionCard       ← the page's only primary CTA
    │   └── SetupProgress    collapsed "4 of 6", expands in place
    ├── ActiveWork
    │   ├── ProjectCard
    │   └── EmptyState       ← §8, action-oriented
    ├── RecommendedRail      exactly 3, "See all →"
    └── QuietSummary         activity · earnings · messages, text not cards
```

**Reused, not rebuilt:** `armedButton` for irreversible actions, `techSection`/`portalGroup` (now fault-isolated via `buildSection`), the existing tier chips, `asList` guards. This redesign is a re-composition of components that already exist.

---

## 7. Content-priority model

| Tier | Weight | Content | Rule |
|---|---|---|---|
| 1 | Largest, gold CTA | Next action | **Exactly one.** If two things are urgent, the system picks. |
| 2 | Full-width card | Active work / empty state | The reason a student returns |
| 3 | 3-up cards, no CTA | Recommended | Browsable, not demanding |
| 4 | Text, no card | Activity · earnings · messages | Present, not competing |
| 5 | Collapsed | Setup checklist | Visible as a count, expandable on intent |

The current page has roughly nine things at tier 1–2. The target is **one** at tier 1.

---

## 8. Empty states

**No active work** *(replaces "No assigned project yet")*

```
┌──────────────────────────────────────────────────┐
│  No active work yet                              │
│                                                  │
│  Your profile is 4 of 6 complete. Finishing it   │
│  improves the work companies send you.           │
│                                                  │
│  [Explore opportunities]   [Complete profile]    │
└──────────────────────────────────────────────────┘
```

Then three recommended opportunities directly beneath, so the page is never a dead end.

**No recommendations yet** — *"Add two more skills and we can start matching you to open work."* One CTA: Add skills.

**Nothing at all (new account)** — collapse to the NEXT card alone. A first-time student should see one instruction, not an empty dashboard.

**Rule:** an empty state names what is missing, why it matters, and one action. Never a shrug.

---

## 9. Profile and skills flow

Skills are the weakest surface today. The proposal makes evidence the visible unit.

```
PROFILE  ›  Skills & evidence

  Python                                    ●●●○  Artifact
  ├─ Data-analysis project        artifact · verified
  ├─ COMS 3134 coursework         claimed
  └─ github.com/…/pipeline        artifact
                                            [+ Add evidence]

  React                                     ●○○○  Self-reported
  └─ No evidence yet
     Adding a repo or project moves this to Artifact.
                                            [+ Add evidence]

  [+ Add a skill]
```

**Two-step, deliberately.** Adding a skill is one field and instant. Attaching evidence is a separate, later act. Forcing evidence at declaration time is why students stop at three skills.

**Tier language is already correct in the codebase** — `claimed → artifact → referral → trial`, with `presentationBand` mapping to bands. The UI should show the tier per skill, which the data already supports and the interface currently does not surface.

Missing evidence reads as **"not yet shown"**, never as weakness. That is Ch. 4.3 and it is currently honoured in copy; the redesign must not lose it.

---

## 10. Onboarding + verification consolidation

Four systems collapse into one.

| Today | Becomes |
|---|---|
| `#profileRing` — strength % | **Setup: 4 of 6** — a count, not a percentage |
| `#journeyPanel` — building proof | folded into the same checklist |
| `#verificationPanel` — verification | one item in that checklist |
| `#nextActions` — what to do next | **the NEXT card** — one item, the top of the list |

```
NEXT
Verify your school email
Takes a minute. Unlocks Columbia-only batches.
[Verify now]

Setup 4 of 6  ▾
  ✓ Add your name and school
  ✓ Add three skills
  ✓ Set opportunity preferences
  ✓ Add one project
  ○ Verify your school email      ← current
  ○ Request an endorsement
```

**Percentages out, counts in.** "67%" is not actionable; "4 of 6" tells you there are two left and the next one is named.

---

## 11. Accessibility

**Carry forward (already right):** contrast well above AA; `prefers-reduced-motion` honoured in `transitionAudience`; `aria-live` on async status; visible focus rings (13/13 focusable elements in the public dialog).

**Required by this redesign:**

- Collapsible setup must be a real `<details>`/disclosure with `aria-expanded`, not a div that hides content.
- Skill tier must be carried by **text**, not colour alone — the dots in §9 need a label beside them.
- Bottom tab bar needs `aria-current="page"` and ≥44px targets.
- Nav collapse must not trap focus; the account menu needs Escape-to-close and focus return.
- The single NEXT card must be the first focusable element after the header — keyboard users get the primary action immediately.
- One skip link to main content. Currently absent *(unverified — could not inspect the authenticated DOM)*.

**Open, from the earlier QA sweep:** one public-form touch target measures 42px against the 44px guidance. Whether the portal has the same issue is unverified.

---

## 12. Every element classified

| Element | Verdict | Notes |
|---|---|---|
| `.member-nav` (8 items) | **Simplify** | → 5 destinations |
| `#batchCount` badge (25) | **Remove** | Catalogue size, not an action |
| `#projectCount`, `#intakeCount`, `#opportunityCount` | **Remove** | Informational, belong in-page |
| `#messageCount` | **Preserve** | Unread is genuinely actionable |
| `#walletNavBalance` | **Move** | Into the Earnings page |
| `#memberSignout` | **Move** | Into the account menu |
| `.welcome-row` h1 | **Simplify** | One line + one subline, no card |
| `#primaryAction` | **Preserve** | Becomes the NEXT card's CTA |
| `.overview-rail` | **Remove** | The container, not its contents |
| `#profileRing` | **Combine** | → Setup 4 of 6 |
| `#journeyPanel` | **Combine** | → same checklist |
| `#verificationPanel` | **Combine** | → one checklist item |
| `#nextActions` | **Simplify** | List → the single NEXT card |
| `#introPanel` | **Hide contextually** | First session only |
| `#trialStartPanel` | **Hide contextually** | Only when a trial is startable |
| `#pipelinePanel` | **Hide contextually** | Only with active pipeline |
| `#milestonePanel` | **Move** | → the project detail, where milestones live |
| `#focusProject` | **Preserve** | Promote to tier 2 |
| `#memberMetrics` | **Simplify** | → quiet text line |
| `#briefingPanel` | **Hide contextually** | Company role only |
| `#companySegments` | **Hide contextually** | Company role only |
| Type scale, gold accent, serif headings | **Preserve** | Not the problem |

**Nothing is deleted.** Seven rail panels become contextual, three combine, one moves. Functionality is preserved; simultaneity is not.

---

## 13. Three directions

### A — Single column *(recommended)*
Rail removed, one column, contextual panels. Main content 724px → ~1150px.
**For:** biggest crowding win; matches the existing 82px collapse pattern; reuses every component.
**Against:** loses persistent at-a-glance setup — mitigated by the count in the NEXT card.

### B — Collapsible rail
Rail stays but starts collapsed to a 56px strip that expands on click.
**For:** nothing moves; smallest diff.
**Against:** treats the symptom. Eight panels behind a toggle is still eight panels, and it adds a state to learn. Half the win for two-thirds the work.

### C — Two-pane workspace
Rail becomes a contextual detail pane — click a project, it opens on the right.
**For:** the most capable long-term layout; good for a student managing several trials.
**Against:** solves a problem nobody has yet. Zero students currently have multiple active trials. This is a Phase-3 layout for a Phase-1 product.

---

## 14. Recommendation

**Direction A.** Three reasons.

**The diagnosis is simultaneity, not density.** Thirteen blocks at one weight is the problem; a toggle (B) hides them without resolving which matters. A removes the container and lets each panel appear when it is relevant.

**It is the smallest change that fixes the actual complaint.** No new components, no new visual language. The CSS already collapses `--nav` to 82px, so the responsive machinery exists. This is composition work.

**C is right eventually and wrong now.** A two-pane workspace serves a student juggling three trials. There are currently zero completed trials. Build A now; C becomes obvious if and when students have enough work to need it.

### What A is trading away

Persistent visibility of setup progress. Today a student always sees the ring; after, they see `Setup 4 of 6` inside the NEXT card and must expand for the full list. **I think that is the right trade** — the ring is glanceable but not actionable, and one named next step beats a permanent percentage. If you disagree, that is the one decision in this document I would most expect pushback on, and it is reversible.

---

## Open questions

1. **Does `#introPanel` earn a place at all?** "How this works" as a permanent panel suggests the product is not self-explanatory. Worth testing whether removing it changes anything.
2. **Should Batches stay a top-level destination?** I have folded it under Opportunities. If batches are the primary student acquisition path, that may be wrong — you know the funnel; I do not.
3. **Search in the header** — is it used? It appears in the wireframe because it is in the current markup. If nobody searches, it is 200px of chrome.

---

## Status

**DONE_WITH_CONCERNS.** Direction proposed, nothing implemented, per the brief.

**Concerns:** the diagnosis is from markup and CSS rather than the running authenticated portal — no screenshot arrived and I have no account. The numbers (228/360/72px, 8 rail panels, 13 blocks) are read directly from source and are solid. Anything about how it *feels* in use is inference, and the three items marked *(unverified)* need a human with a session to confirm.

**Recommended next:** approve a direction, then `/design-review` against the built result rather than the plan.
