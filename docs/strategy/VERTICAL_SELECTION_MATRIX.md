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
| **Unweighted total** | **39** | **31** | **32** | **35** | **59** | **46** | **39** |

> **Arithmetic corrected 2026-08-01** (adversarial review). The startup-engineering column was
> published as 55; it sums to 59. Every weighted score below was also wrong. See the note under
> the weighted table.

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
| **Startup engineering** | **93** | 1 |
| AI infrastructure | 68 | 2 |
| Robotics | 61 | 3 |
| Quant SWE | 55 | 4 |
| Consulting | 52 | 5 |
| Investment banking | 46 | 6 |
| Quant research | 42 | 7 |

> **All seven scores recomputed 2026-08-01** (adversarial review). The published figures (107 /
> 78 / 63 / 62 / 60 / 51 / 45) matched no stated method — not weight×score summed, not unweighted
> plus a bonus. Each cell is now `score × weight`, summed. The winner is unchanged and its margin
> is wider in relative terms (93 vs 68), but **the correction flips ranks 3 and 4: robotics (61)
> now outranks quant SWE (55).**
>
> Treat this table as *an argument made legible*, not as a measurement. The scores are the
> founder's judgement, the weights are the founder's judgement, and one anecdote supplies five of
> startup engineering's thirteen cells. A number computed correctly from estimated inputs is still
> an estimate. It ranks options; it does not settle them.

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
are marked °. **Corrected 2026-08-01:** if accessibility turns out to be 4 rather than 2, quant
gains 2 × 3 = **6 points → 61**, which *ties robotics for third* and stays below AI infra's 68.
The pre-correction text claimed "jumps to 81 and takes second place" — off by 20 points and two
ranks. The sensitivity is much weaker than this file originally argued, which is itself a reason
to spend less on resolving it.

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

> **Superseded 2026-08-01 by D16/D17.** This two-segment allocation no longer stands. The vertical
> is scoped by the §2 product contract (5-75 people, engineering-led, no recruiter), so the
> campaign is **20 interviews on software/AI plus a 20-message quant probe** — not 15 + 15. See
> `docs/V1_DISCOVERY_PLAN.md`. Quant now ranks **fourth**, not third; the correction above flipped
> it below robotics.

## The falsification test

**[INFERENCE]** If after 20 messages no quant manager takes a call, accessibility is 1 rather
than 2: quant loses 3 points → **52, exactly tying consulting** (it does not "drop below" it, as
this file previously claimed). Record the outreach-to-response ratio per segment in
`07_DISCOVERY_TRACKER.csv`.

> **This test is no longer decisive (D17).** The vertical is closed by the product contract, not
> by a response rate, and 20 messages per arm has only ~35% power to separate a 30% response rate
> from a 10% one — the honest reading is one-directional: a result near **0/20 has a 95% upper
> bound of ~14%**, which does exclude a software-like 30%. Anything else is uninformative. The
> ratio does not close this matrix; the product contract does.
