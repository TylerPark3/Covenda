# Vertical Selection Matrix

Section B of `02_OFFICE_HOURS_PROMPT.md`. Seven verticals scored against thirteen criteria.

**This matrix does not pick the wedge.** It ranks which verticals are worth interviewing, and it
is explicit about which cells are guesses. Nine of thirteen criteria cannot be scored from here
without talking to a hiring manager. The matrix's real output is the two segments the 30
interviews should cover.

Labels as in the decision ledger: **[ADVISOR]** **[EVIDENCE]** **[INFERENCE]** **[UNKNOWN]**

Scores are 1-5, 5 best. Cells marked ° are **[UNKNOWN]** — a placeholder scored by inference,
and the thing the interviews replace with fact.

---

## The matrix

| Criterion | Quant SWE | Quant research | IB | Consulting | Startup eng | AI infra | Robotics |
|---|---|---|---|---|---|---|---|
| Economic value of an exceptional hire | 5 | 5 | 4 | 3 | 4 | 5 | 4 |
| Urgency of the hiring need | 4° | 3° | 3 | 3 | **5** | 5° | 3° |
| Student demand to participate | 5 | 4 | 5 | 4 | 3 | 5 | 3 |
| Hiring-manager accessibility | 2° | 1° | 2° | 2° | **5** | 3° | 3° |
| Can define objective evidence | 5 | 4 | 2 | 2 | 4 | 4 | 4 |
| Can build a realistic simulation | 4 | 3 | 3 | 4 | 4 | 3 | 2 |
| Willingness to share requirements | 2° | 1° | 2° | 3° | **5** | 3° | 3° |
| Confidentiality barrier (5 = low) | 1 | 1 | 2 | 3 | **5** | 2 | 3 |
| Sales-cycle length (5 = short) | 2° | 2° | 1° | 2° | **5** | 3° | 3° |
| Recruiting maturity (5 = immature, more room) | 1 | 1 | 1 | 1 | **5** | 3 | 4 |
| Probability of a first pilot | 2° | 1° | 1° | 2° | **5** | 3° | 3° |
| Founder access today | 2° | 1° | 3 | 3 | **5** | 2° | 1° |
| Expansion potential | 4 | 4 | 3 | 3 | 4 | 5 | 3 |
| **Unweighted total** | **39** | **31** | **32** | **35** | **55** | **46** | **39** |

## Weighted

The weights encode what actually kills an early pilot. Access and willingness matter more than
economics, because a market you cannot enter has no economics.

| Criterion | Weight | Why |
|---|---|---|
| Hiring-manager accessibility | 3× | You cannot interview a market that will not take the call |
| Probability of a first pilot | 3× | Everything else is theory until one runs |
| Willingness to share requirements | 2× | The product *is* the requirements. No sharing, no product |
| Confidentiality barrier | 2× | Where the work is most real, sharing it is most restricted |
| Economic value | 2× | Alan's core argument, and it is right |
| Everything else | 1× | |

| Vertical | Weighted | Rank |
|---|---|---|
| **Startup engineering** | **107** | 1 |
| AI infrastructure | 78 | 2 |
| Quant SWE | 63 | 3 |
| Robotics | 62 | 4 |
| Consulting | 60 | 5 |
| Investment banking | 51 | 6 |
| Quant research | 45 | 7 |

---

## Reading this honestly

**Startup engineering wins on access, not on value.** **[INFERENCE]** It scores 5 on
accessibility, willingness, sales cycle, pilot probability and founder access — the five
criteria that decide whether anything happens at all. **[EVIDENCE]** Those fives are not guesses:
Covenda has actually closed a paid deal in this segment, and the founder can reach these people.

**Quant SWE wins on value and loses on entry.** **[ADVISOR]** Alan is right that the economics
are the best available: 5 on value, 5 on student demand, 5 on definable evidence. **[UNKNOWN]**
But every access cell is a guess, and confidentiality scores 1 — the trading logic that makes the
work real is the part a fund will never let outside.

**The matrix cannot resolve this and should not pretend to.** Nine of the thirteen quant cells
are marked °. If accessibility turns out to be 4 rather than 2, quant's weighted score jumps to
81 and it takes second place. The interviews exist to set that one number.

**Quant research and IB are out.** **[INFERENCE]** Research has the worst access profile and the
tightest confidentiality. IB cannot define objective pre-hire evidence — the job is relationship
and stamina, and a take-home cannot represent it. Neither is worth interview slots.

**AI infrastructure is the sleeper.** **[INFERENCE]** Second on weighted score, high on value and
expansion, and its hiring managers are reachable through the same startup networks Covenda
already uses. **[UNKNOWN]** It was not in Alan's framing and has not been tested. If the
startup arm of the campaign produces a strong AI-infra signal, that is the finding to chase.

---

## What the campaign covers

| Segment | Interviews | Purpose |
|---|---|---|
| **Startup + AI-infra engineering** | 15 | Test whether the observed scoping gap generalises beyond one customer |
| **Quant SWE** | 15 | Test the one thing the matrix cannot: will they take the call, and will they share requirements |

Quant gets equal weight despite ranking third, because its uncertainty is concentrated in cells
that a single week of outreach resolves. Startups rank first on evidence; quant ranks third on
guesses. Spending fifteen interviews to convert guesses into facts is the cheapest information in
this document.

## The falsification test

**[INFERENCE]** If after 20 messages no quant manager takes a call, accessibility is 1, not 2,
quant drops below consulting, and the vertical question is settled by silence. Record the
outreach-to-response ratio per segment in `07_DISCOVERY_TRACKER.csv`. That ratio, not opinion, is
what closes this matrix.
