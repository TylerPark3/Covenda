# Batch vetting design — Pass 2: Accounting & finance

Five specialisations: `investment-banking`, `private-equity`, `venture-capital`,
`asset-wealth-management`, `accounting-audit`.

Extends the existing engine. Current bar across the batch:
`artifact(1) + skills(1–2) + defense + hours(6–8)`.

**Constraint honoured:** the Alpaca connector is gated pending terms review. Nothing below
depends on it shipping. Where an order trail would help, the design states what it would add
and works without it.

---

## What the evidence says, and where it points

**1. The industry's own filter is a timed build, and it is more auditable than it looks.**
The LBO modelling test sits in the final or penultimate round, runs 30 minutes to 3 hours,
and grading is described as pragmatic and consistent across firms: sources and uses balance,
debt rolls forward correctly, exit equity reconciles to enterprise value minus net debt. It
is explicitly a test of whether a candidate can be trusted to *build, audit and explain*
models that inform real decisions.

Two things follow for us. The good news is that structural correctness is genuinely
checkable — and we can check it **programmatically**, which the firms cannot, because
`api/xlsx-parse.js` reads formulas rather than rendered values. The bad news is the honest
part: at three hours with an LLM available, the build is not the filter. One source describes
it plainly as "more of an Excel speed test." Speed under LLM assistance measures nothing.

**So we invert it.** The firms use the model to filter and the interview to confirm. We use
the parse to *establish the floor* — a workbook of pasted values fails by construction — and
the defense to do the discriminating. This is the same conclusion Pass 1 reached from
Sackett: the structured conversation carries the validity.

**2. Scoring returns would be actively harmful, not merely weak.** The literature is
consistent that past returns are a poor signal because virtually all outperformance in short
windows is luck, and — the part that matters for a vetting design — *mistaking a lucky streak
for skill leads directly to increased risk-taking*. A rubric that rewards returns therefore
does not merely fail to measure skill; it **selects for gambling**, and it teaches the
students being measured that gambling is what we reward.

The alternative the literature points to is process: a set of rules and checks that balance
behavioural tendencies. That is readable from an order trail, and readable from a defense
even without one.

**3. Venture capital has no numbers to check, and pretending otherwise is the failure mode.**
Early-stage judgement cannot be back-tested inside a student's timeframe. The only honest
artifact is the reasoning itself — which makes VC the specialisation where the memo is
weakest as evidence and the defense strongest, for the same reason `technical-writing` will
be in Pass 3: prose is what an LLM produces best.

---

## What the parse can and cannot establish (applies to all five)

`api/xlsx-parse.js` reads the formula layer. That means it **can** establish:

- Whether outputs are computed or typed. A "model" of pasted values is caught outright.
- Whether inputs actually drive outputs, or sit beside them unreferenced.
- Whether circular references exist and how they are handled.
- Whether a sensitivity table is live or hardcoded.
- Structural reconciliation: does exit equity trace to EV − net debt through formulas.

It **cannot** establish:

- Whether the assumptions are defensible. A perfectly-wired model can be nonsense.
- Whether the candidate built it. Template provenance is invisible to a formula read.
- Whether the sourcing is real. A cited figure and an invented one look identical.

The third one is the residual gap for this batch and the defense has to carry it.

---

## `investment-banking` — Investment banking *(elite)*

**1. The bar, and why.** Screens for someone who can build a model another person can audit.
The job is not producing an answer; it is producing an answer a managing director can
interrogate at 11pm without the builder present. Fair, because that is verifiably the task.

**2. The submission.** One `.xlsx` the candidate built — a three-statement model, a DCF, or a
comps analysis. Uploaded, not linked. Candidate nominates **one assumption they are least
confident in**, in a single line, at submission time.

**3. What the machine checks.** Formula integrity; input-to-output linkage; whether the
sensitivity analysis is live; whether the statements tie. **It does not establish** whether
the WACC is defensible, whether the comps set is honest, or who built it.

**4. Anchored rubric (4 / 6 / 9).**
- **4** — Model computes. Drivers are hardcoded inside formulas. Cannot say what moves the
  output most without changing cells to find out.
- **6** — Drivers are separated from calculations. Can state which assumption the answer is
  most sensitive to and roughly why. Sourcing is named but not interrogated.
- **9** — Can state the range over which the conclusion holds and where it flips. Distinguishes
  an assumption they chose from one they inherited from a source, and can say why the source
  is credible.

**5. Defense questions** *(generated from their own workbook)*
- "Cell `<specific driver>` is 8%. Where did that come from?"
- "If it were 11%, what happens to your conclusion?" — the parse knows the true answer,
  so the rater can check it live.
- Follow-up one: "You said `<their nominated weak assumption>` was your least confident. What
  would you need to firm it up?"
- Follow-up two: "Why didn't you?" — the discriminator throughout this design.

**6. Failure modes caught.** Pasted-value workbooks (caught by parse, before a human looks);
template-filling with no understanding of the drivers; candidates who cannot locate their own
assumptions; sensitivity tables that are pictures of tables.

**7. What it cannot catch.** A candidate who used a strong template, understood it, and can
defend it. As in Pass 1: that person has done real learning and we admit them.

**8. Requirement set.** `artifact(1) + skills(2) + defense + hours(8)` — **unchanged**. Same
recommendation as Pass 1: `defense` should carry the nominated weak assumption.

---

## `private-equity` — Private equity *(elite)*

**1. The bar, and why.** An LBO is the industry's own filter, and structural correctness has
a published definition: sources and uses balance, debt rolls, exit equity reconciles. We can
check all three mechanically, which frees the human time for the part that discriminates —
whether the candidate understands what the leverage is doing.

**2. The submission.** One LBO model the candidate built. Candidate nominates **the return
driver they think matters most** — multiple expansion, deleveraging, or operational
improvement.

**3. What the machine checks.** The three structural reconciliations above, plus circularity
handling (interest on average balances is the standard trap) and whether the returns bridge is
computed. **It does not establish** whether the entry multiple, exit multiple or operating
case are remotely plausible.

**4. Anchored rubric.**
- **4** — Model runs and returns compute. Cannot decompose the IRR — attributes returns to
  "the exit multiple" without checking.
- **6** — Can decompose returns across deleveraging, multiple and operations. Understands why
  the circularity exists and how their model resolves it.
- **9** — Can say what the deal needs to be true to work, which assumption is doing the most
  unearned work, and what would make them walk away. Distinguishes financial engineering from
  value creation without being prompted to.

**5. Defense questions.**
- "Your IRR is `<X>`. How much of it is deleveraging?" — the parse can compute the honest
  answer independently.
- "What entry multiple makes this deal not work?"
- Follow-up one: "You nominated `<their driver>`. What would have to happen for that not to
  materialise?"
- Follow-up two: "Would you still do the deal?" — separates model-operators from people who
  are actually thinking about the investment.

**6. Failure modes caught.** Returns that come entirely from an assumed multiple expansion the
candidate has not noticed; broken or fudged circularity; candidates who cannot decompose their
own IRR.

**7. What it cannot catch.** Whether the operating case is realistic for the industry. No
undergraduate submission can establish that and we should not pretend to test it.

**8. Requirement set.** `artifact(1) + skills(2) + defense + hours(8)` — **unchanged**.

---

## `venture-capital` — Venture capital *(elite)*

**1. The bar, and why.** There are no numbers to check, so this screens for the quality of
reasoning under genuine uncertainty: whether a candidate can state what they believe, what
would change their mind, and what they cannot know. That is the actual job at seed stage.

**2. The submission.** One investment memo on a real company, plus — required here and
nowhere else in this batch — **a stated disconfirming condition**: the specific thing that,
if observed, would make them wrong.

**3. What the machine checks.** Almost nothing. Document parses; sources resolve. **This is
the weakest machine read in the batch and the design says so.** The memo is prose, and prose
is the LLM's strongest output.

**4. Anchored rubric.**
- **4** — Memo summarises the company and asserts a conclusion. Risks section is generic
  ("competition", "execution"). No falsifiable claim.
- **6** — Identifies the specific bet being made and at least one non-obvious risk. States
  what they would want to know before investing.
- **9** — Names what has to be true, what evidence would settle it, and what they would expect
  to see in twelve months if they are right versus wrong. Can argue the strongest case against
  their own recommendation.

**5. Defense questions.**
- "What is the single fact that would change your mind?" — asked first, because a candidate
  who cannot answer it has not made an investment argument.
- "Who is the natural acquirer, and why would they not just build it?"
- Follow-up one: "Your memo says `<a specific claim>`. How did you get to that number?"
- Follow-up two: "What did you look for and fail to find?" — real research has gaps; generated
  research is seamless, and seamlessness is the tell.

**6. Failure modes caught.** Memos that summarise rather than argue; risk sections that could
apply to any company; candidates who cannot defend a specific figure they wrote down.

**7. What it cannot catch.** Whether the judgement is any good — that requires outcomes over
years. We are testing the *shape* of the reasoning, not its accuracy, and the copy to students
should say exactly that.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(8)` — **unchanged**, but
this specialisation should require **two raters mandatorily**, for the same reason as
`security-reliability` in Pass 1: prose artifact, thin machine read, defense carrying
everything.

---

## `asset-wealth-management` — Asset & wealth management *(open)*

**1. The bar, and why.** This screens for **risk discipline, explicitly not returns**. A
student who tripled a paper account by concentrating into one position has demonstrated
variance tolerance, not skill — and the literature is direct that mistaking a lucky streak for
skill drives *more* risk-taking. Rewarding returns would select for the exact behaviour the
industry spends its time suppressing.

**2. The submission.** A portfolio or research note with position sizing and a stated risk
framework — the rules the candidate follows *before* a decision, not the outcomes after.
Where a paper-trading account is connected, a **timestamped order trail** may be submitted as
supporting evidence.

**3. What the machine checks.** Document parse. If an order trail is present: position sizing
consistency, whether stops were set before or after adverse moves, whether the stated rules
were actually followed. **We never read P&L.** That is a deliberate design decision, not a
technical limitation, and it is worth publishing to students.

> **Alpaca is gated.** Nothing above requires it. Without a connected account this
> specialisation runs on the note plus defense; the order trail would add adherence evidence,
> and its absence is a stated gap rather than a blocker.

**4. Anchored rubric.**
- **4** — Describes positions and rationale. Risk framework is absent or retrospective
  ("I would have sold if..."). Sizing is unexplained.
- **6** — States a sizing rule and applies it consistently. Can explain what would make them
  exit, defined before entry.
- **9** — Articulates the risk they are being paid to take versus the risk they are carrying
  unintentionally. Can identify a position that worked for the wrong reason.

**5. Defense questions.**
- "Which of these positions worked out for a reason you did not anticipate?" — the single
  best discriminator here. Honest process-thinkers answer instantly; outcome-thinkers hear it
  as a trick.
- "How did you size `<specific position>`, and would you size it the same way today?"
- Follow-up one: "What is the worst outcome you were prepared for?"
- Follow-up two: "What would have happened if it went further than that?"

**6. Failure modes caught.** Returns-led narratives; risk frameworks written after the fact;
concentration presented as conviction; candidates who cannot separate a good decision from a
good outcome.

**7. What it cannot catch.** Whether the framework survives real money and real drawdown.
Nothing at this stage can.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(6)` — **unchanged**.
Recommend adding to the published bar an explicit line: *"Returns are not scored."* It changes
what students submit, which is the point.

---

## `accounting-audit` — Accounting & audit *(open)*

**1. The bar, and why.** Screens for the habit of tying out — whether a candidate checks that
things agree, and what they do when they do not. The discriminating experience is having found
a real discrepancy, because finding one is unglamorous and cannot be simulated by describing
the process.

**2. The submission.** A worked reconciliation or close checklist. Candidate nominates **one
discrepancy they found and resolved**.

**3. What the machine checks.** Formula integrity where a workbook is submitted; whether
reconciling items are computed or asserted. **It does not establish** whether the underlying
records were real.

**4. Anchored rubric.**
- **4** — Reconciliation is present and balances. Reconciling items are listed without
  explanation.
- **6** — Each reconciling item has a cause. Can describe the process they followed and where
  it usually breaks.
- **9** — Distinguishes a timing difference from an error from a control failure. Can say what
  in the process allowed the discrepancy to arise and what they changed.

**5. Defense questions.**
- "Walk me through the discrepancy you nominated. What made you look there?"
- "How long had it been wrong?"
- Follow-up one: "What would have caught it sooner?"
- Follow-up two: "Why wasn't that already happening?" — the same second-order question as
  every other specialisation, and it works here for the same reason.

**6. Failure modes caught.** Textbook reconciliations with no lived detail; candidates who
cannot distinguish timing from error; process descriptions with no failure in them.

**7. What it cannot catch.** Whether the candidate did the work or transcribed a worked
example from coursework. The nominated discrepancy plus the second follow-up is the mitigation;
it is weaker here than in software, because there is no history span to lean on.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(6)` — **unchanged**.

---

## Recommendations arising from this pass

1. **Publish "returns are not scored" on the `asset-wealth-management` bar.** It is the
   clearest example in the product of a published requirement changing what students do, and
   the reasoning — rewarding returns selects for gambling — is worth stating out loud.

2. **`venture-capital` needs two mandatory raters.** Second specialisation flagged for this
   (with `security-reliability` from Pass 1). Both share the shape: prose artifact, thin
   machine read, defense carrying the whole load.

3. **Surface the parse result to the rater before the defense.** The parse knows what a
   driver change actually does to the output. A rater who can see that can check a claimed
   answer live, which converts the defense from an interview into a verification. This is a
   UI change, not an engine one.

4. **A pasted-values workbook should fail before a human is scheduled.** It is already caught
   by construction; make it an explicit early gate so operator time is never spent on it.

---

## Measuring whether the rubrics work

Same standard as Pass 1: **κ ≥ 0.6** on 20 double-scored defenses per specialisation, via
`interRaterReliability` in `api/hardening.js`. I would expect `investment-banking`,
`private-equity` and `accounting-audit` to calibrate faster than the software batch, because
the parse gives both raters a shared factual base. I would expect **`venture-capital` to
calibrate worst in the entire catalogue** — judgement rubrics always do — and would watch it
first.

---

## Sources

- [Wall Street Prep — *Standard LBO Modeling Test*](https://www.wallstreetprep.com/knowledge/leveraged-buyout-lbo-modeling-1-hour-practice-test/)
- [Mergers & Inquisitions — *LBO Modeling Test: Example and Full Tutorial*](https://mergersandinquisitions.com/lbo-modeling-test/)
- [Interview Private Equity — *Private Equity LBO Modeling Tests: Who gets them? What are they?*](https://www.interviewprivateequity.com/what-are-private-equity-lbo-modeling-tests/)
- [Financial Edge — *90-Minute LBO Modeling Test*](https://www.fe.training/free-resources/careers-in-finance/90-minute-lbo-modeling-test/)
- [CFA Institute — *Luck vs. Skill: Great Investment Leaders Know the Difference*](https://blogs.cfainstitute.org/investor/2025/02/21/luck-vs-skill-great-investment-leaders-know-the-difference/)
- [Institutional Investor — *Were Those Great Returns the Result of Skill — or Just Luck?*](https://www.institutionalinvestor.com/article/2bstmbrjgwbr10h5wkirk/portfolio/were-those-great-returns-the-result-of-skill-or-just-luck)
- [Kiplinger — *Skill Versus Luck in Investing*](https://www.kiplinger.com/article/investing/t038-c032-s014-skill-versus-luck-in-investing.html)
