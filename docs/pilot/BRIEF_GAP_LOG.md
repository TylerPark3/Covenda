# Brief Gap Log

The instrument for the Brief-First Concierge pilot.
Design doc: `~/.gstack/projects/TylerPark3-Covenda/tylerpark-portal-redesign-v1-design-20260731-180007.md`

## What this is for

`api/brief-engine.js` already implements the step the founder named as most expensive:
turning a vague company ask into a scoped brief. It is wired — `api/project-intake.js:457`
returns `diagnosisGaps(...)` when a company has not said enough, `:508` runs `evaluateBrief(...)`,
and `portal.js:3655` renders the verdict.

It has never carried a real conversation. Every deal so far was scoped in the founder's inbox.

This log answers one question: **which questions does the founder ask that the engine does not?**

That list is the engine's next question set. If it turns out the founder's questions cannot be
written down — that scoping is judgment rather than a question set — then the wedge is not
automatable and Approach C (sell the brief as a standalone deliverable) is the real business.

## Rules

- **Do not build a tool for this.** A text file is the deliverable. Adding tooling here repeats
  the mistake the pilot exists to diagnose.
- **Do not fix the engine mid-pilot.** Log the gap, keep going. Fixing as you go destroys the
  count, and the count is the finding.
- **Answer as the company would have answered**, not as you now know the answer to be. The
  whole value is in reproducing their ignorance, not your hindsight.

---

## Deal 000 — the retrospective run (do this first)

The assignment: take the deal you already closed and re-run its scoping through
`project-intake.js` yourself, playing the company. Feed it their actual first message.

| Field | Value |
|---|---|
| Company | |
| Their literal first message | |
| Date run | |
| Minutes to a scoped brief | |

### Questions the engine asked

| # | Question | Useful? | Notes |
|---|---|---|---|
| 1 | | | |

### Questions YOU had to ask in real life that the engine never asked

This is the output. Everything else is bookkeeping.

| # | Your question | Why it mattered | Would a template have caught it? |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

### Verdict

- Engine asked ___ of your ___ real questions.
- If it asked most of them: the wedge is shippable, and the gap list is the roadmap.
- If it asked none: scoping is your judgment, not a question set. Read Approach C again.

---

## Deals 001–005 — live runs

Copy the block above per deal. Company scopes in `project-intake.js`; you sit beside it and
stay quiet until the engine gives up.

---

## The falsification test

P1 of the design doc — *"the bottleneck is scoping, not supply"* — was agreed without pushback
and has a live counter-argument: scoping may have been expensive because it was the **first**
one, and may get cheap with templates.

Track this and let it kill the premise if it deserves to:

| Deal | Minutes to scoped brief | Engine questions used | Founder questions still needed |
|---|---|---|---|
| 000 (retrospective) | | | |
| 001 | | | |
| 002 | | | |
| 003 | | | |
| 004 | | | |
| 005 | | | |

**If minutes-to-scoped-brief drops more than 4x between deal 000 and deal 005, P1 is wrong.**
Scoping was a learning tax, not a structural bottleneck, and this pilot's premise collapses.
That is a good outcome to discover cheaply. Write it down rather than explaining it away.

## The business bar (unchanged, from decision D11)

≥3 of 5 companies request a second engagement. One paid engagement is demand. A repeat is a
business. Track it here:

| Company | First engagement paid? | Came back? |
|---|---|---|
| | | |

## Explicit non-goals

- No new endpoints. Zero code needs to be written for this pilot to succeed.
- No automation of any step until the gap list exists.
- No changes to `brief-engine.js` during the pilot.
