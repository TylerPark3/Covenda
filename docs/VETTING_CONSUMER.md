# Batch vetting design — Pass 4: Consumer & retail

Five specialisations: `growth-performance`, `brand-content`, `merchandising`,
`supply-chain`, `ecommerce-marketplace`.

`growth-performance` and `ecommerce-marketplace` already require `REQ.trial` — an instrumented
challenge, because self-reported campaign numbers are unfalsifiable.

**Status:** grounded designs, not validated filters. No cohort has run; the κ ≥ 0.6 target is
a target.

---

## The cost problem, addressed first

`REQ.trial` is the most expensive requirement in the catalogue. An instrumented challenge
needs tooling, a budget, and operator setup per candidate — and this batch is entirely
`open` tier, which is the tier with the most applicants and the least revenue per admission.
A design that assumes real ad spend does not survive contact with a pilot.

So: **three tiers of instrumented trial**, and the design states honestly what each cannot
prove.

**Tier A — synthetic dataset (£0, no setup).** The candidate receives a realistic but
generated dataset — funnel events, campaign performance, inventory movements — and works
against it. The platform records what they queried, what they looked at first, and what they
concluded.
*Cannot prove:* anything about behaviour under real money or real consequences. A candidate
who is careless with £5,000 looks identical to one who is careful.

**Tier B — sandboxed tooling (£0–low, moderate setup).** A provisioned account in a real tool
(analytics, ad manager in draft mode, spreadsheet environment) with no live spend. The
platform records the actual sequence of actions.
*Cannot prove:* judgement under budget pressure, or whether they would have pulled the trigger.

**Tier C — live bounded budget (real money, heavy setup).** A fixed small budget with a hard
cap and a defined objective.
*Cannot prove:* much more than Tier B, honestly — the sample is too small for the outcome to
be signal. **What it does prove is behaviour: whether they check before scaling, whether they
stop when it is not working.** That is worth paying for, and the outcome is not.

**Recommendation: run Tier A at pilot scale.** Tier C should be reserved for candidates who
have already cleared everything else and are being considered for a specific paid engagement
— at which point the company is paying, not Covenda. The published bar should say which tier a
batch runs so nobody imagines they are being handed a budget.

The research supports this: the standard industry approach to assessing growth roles is case
studies, campaign critiques, ad-optimisation exercises and channel simulations — **retrospective
analysis and planning rather than live execution**. Nobody hands a candidate real spend, and we
should not pretend the cheap version is a compromise.

---

## `growth-performance` — Growth & performance *(open)*

**1. The bar, and why.** Screens for whether a candidate reasons from data to a decision, and
whether they know when the data cannot support one. Self-reported campaign results are
unfalsifiable — "I grew signups 300%" has no denominator, no counterfactual, and no way to
check — which is why this specialisation runs an instrumented exercise instead.

**2. The submission.** A Tier A instrumented challenge: a synthetic funnel dataset with a
stated business question. Candidate produces a recommendation with a stated confidence.

**3. What the machine checks.** The platform records the sequence — what they looked at, in
what order, what they filtered, how long before they reached a conclusion. **It does not
establish** whether the conclusion is right; the dataset has a designed answer, but a
candidate reaching it by luck and one reaching it by reasoning look identical in the output.
The defense separates them.

**4. Anchored rubric.**
- **4** — Reports what the data shows. Recommendation does not follow from the analysis, or
  follows from one number.
- **6** — Locates the drop-off, quantifies it, recommends an action proportionate to it.
  States one assumption.
- **9** — Distinguishes the metric that moved from the metric that matters, names the
  confound they cannot rule out, and says what they would need to be confident.

**5. Defense questions.**
- "You looked at `<specific view>` first. Why there?" — the platform knows; the candidate has
  to be able to say.
- "What would make this conclusion wrong?"
- Follow-up one: "What did you check that turned out not to matter?"
- Follow-up two: "How much would you spend on this before checking again?" — separates people
  who think in bets from people who think in campaigns.

**6. Failure modes caught.** Correlation-as-cause; recommendations untethered from the
analysis; candidates who reach an answer without ever checking a denominator.

**7. What it cannot catch.** Behaviour under real budget pressure. Tier A cannot reach it and
the bar should say so rather than implying a live simulation.

**8. Requirement set.** `trial + skills(1) + defense + hours(6)` — **unchanged**, with the
tier made explicit on the published bar.

---

## `brand-content` — Brand & content *(open)*

**1. The bar, and why.** The artifact is now the cheapest part. A model produces competent
copy, competent images, competent campaign concepts. What it cannot do is **choose** — decide
which of three good options fits this audience, this moment, this brand. So this screens for
creative *judgement*, and the design has to stop treating the output as the evidence.

**2. The submission.** Not a portfolio. **Three options and a decision**: the candidate
produces or assembles three plausible directions for a stated brief, picks one, and writes why
— including what they gave up. Where AI produced the options, that is fine and should be
stated; the choosing is the assessed part.

**3. What the machine checks.** Nothing meaningful. Parse only. **This is a human rail wearing
a creative costume** and the design says so.

**4. Anchored rubric.**
- **4** — Presents work. Rationale is descriptive ("this is bold and modern"). No alternatives
  considered, or alternatives are obvious straw men.
- **6** — Three genuinely distinct directions. Choice is justified against a stated audience
  and objective. Names one tradeoff.
- **9** — Rejects a direction they clearly like for a reason external to their taste. Can
  articulate who the chosen direction will not work for, and why that is acceptable here.

**5. Defense questions.**
- "Which of the three did you personally prefer?" — then: "Why didn't you pick it?" The gap
  between taste and judgement is the entire specialisation, and this pair opens it directly.
- "Who does this alienate?"
- Follow-up one: "What would make you switch to option two?"
- Follow-up two: "What did you try that did not make the three?"

**6. Failure modes caught.** Portfolio-as-submission; rationale that is post-hoc description;
three options where two exist to make the third look good; candidates who cannot articulate a
tradeoff.

**7. What it cannot catch.** Whether the taste is any good. Taste resolves against audiences
over time, and no vetting process reads it in one sitting. We test whether choices are made
deliberately, which is what a junior can actually be assessed on.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(5)` — **change proposed**:
the artifact descriptor should read *"three directions and a documented choice"* rather than
"one work sample". Justification: the current descriptor invites a portfolio, and a portfolio
is exactly the artifact an LLM now produces. This is a wording change to `REQ.artifact`'s
label for this specialisation, not a new requirement kind.

---

## `merchandising` — Merchandising & assortment *(open)*

**1. The bar, and why.** Screens for whether a candidate can reason about assortment under
constraint — shelf space, capital, and cannibalisation are all finite, and the discriminating
skill is knowing what to *drop*. Spreadsheet mechanics are table stakes and easily produced;
the reasoning is not.

**2. The submission.** A worked assortment or range exercise against a synthetic dataset, with
stated assumptions. Candidate nominates **one product they would cut and why**.

**3. What the machine checks.** Formula integrity where a workbook is submitted (reusing
`xlsx-parse`, as in Pass 2). **It does not establish** whether the assortment logic is sound.

**4. Anchored rubric.**
- **4** — Ranks products by a single metric and cuts the bottom. No consideration of what the
  cut product was doing.
- **6** — Considers margin, velocity and role in the range. Recognises that some low performers
  are traffic drivers.
- **9** — Reasons about cannibalisation and substitution — what happens to the customer who
  came for the cut item — and states what they would monitor after the change.

**5. Defense questions.**
- "You cut `<their nominated product>`. Where does that customer go?"
- "Which of your remaining products is most at risk from that decision?"
- Follow-up one: "How would you know if the cut was a mistake?"
- Follow-up two: "How long before you would know?"

**6. Failure modes caught.** Single-metric ranking; ignoring range role; candidates who treat
products as independent when the whole discipline is about interaction.

**7. What it cannot catch.** Category intuition built over years. Not testable at this level
and not claimed.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(5)` — **unchanged**.

---

## `supply-chain` — Supply chain & operations *(open)*

**1. The bar, and why.** Screens for forecasting judgement, specifically **whether the
candidate reasons about being wrong**. Every forecast is wrong; the skill is knowing in which
direction, by how much, and what it costs. A student who produces a point estimate with no
error discussion has not done the job.

**2. The submission.** A forecast or inventory analysis against a synthetic dataset, including
**a stated error range and what it would cost to be wrong in each direction**.

**3. What the machine checks.** Formula integrity; whether the forecast is computed or
asserted. **It does not establish** whether the method suits the demand pattern.

**4. Anchored rubric.**
- **4** — Produces a point forecast. No error range. Method unstated or unjustified.
- **6** — States a range and the method behind it. Recognises that over- and under-forecasting
  have different costs.
- **9** — Quantifies the asymmetry — what a stockout costs versus what carrying costs — and
  sets the forecast where the expected cost is lowest rather than where the estimate is most
  likely.

**5. Defense questions.**
- "Which is worse here: running out, or holding too much?" — the highest-signal question in
  this specialisation. It separates statistical thinking from operational thinking.
- "Your forecast assumes `<a specific pattern>`. What breaks that?"
- Follow-up one: "What would you watch to catch it early?"
- Follow-up two: "How late would you find out?"

**6. Failure modes caught.** Point estimates presented as answers; symmetric treatment of
asymmetric costs; method chosen by familiarity rather than fit.

**7. What it cannot catch.** Whether the forecast is accurate. Accuracy resolves in the future;
we assess the reasoning.

**8. Requirement set.** `artifact(1) + skills(1) + defense + hours(5)` — **unchanged**.

---

## `ecommerce-marketplace` — E-commerce & marketplace *(open)*

**1. The bar, and why.** Marketplaces fail in a specific way — one side of the market starves
— and the discriminating skill is thinking about both sides at once. Screens for whether a
candidate can reason about a two-sided system rather than a funnel.

**2. The submission.** A Tier A instrumented exercise on a synthetic marketplace dataset, or a
worked funnel analysis where instrumented tooling is unavailable.

**3. What the machine checks.** Recorded action sequence in the instrumented version; parse
only otherwise. **It does not establish** whether the candidate understood the market
dynamics or pattern-matched a funnel.

**4. Anchored rubric.**
- **4** — Analyses one side of the marketplace as a funnel. Treats supply as fixed.
- **6** — Recognises both sides and that an intervention on one affects the other. Identifies
  which side is constrained.
- **9** — Reasons about liquidity — whether the problem is matching rather than volume — and
  identifies the intervention with the best ratio of effect to effort.

**5. Defense questions.**
- "Which side of this market is the problem?"
- "If you doubled demand tomorrow, what breaks?"
- Follow-up one: "What would you have to be true for that not to happen?"
- Follow-up two: "Where would you look to check?"

**6. Failure modes caught.** Single-sided analysis; growth recommendations that would break
fulfilment; candidates who treat a marketplace as a store.

**7. What it cannot catch.** Whether they can execute against real market participants.
Nothing at this stage can.

**8. Requirement set.** `trial + skills(1) + defense + hours(6)` — **unchanged**, with the
tier stated on the published bar and Tier A as the pilot default.

---

## Recommendations arising from this pass

1. **Publish the trial tier on the bar.** A student reading `REQ.trial` currently has no way
   to know whether they are being handed a budget or a synthetic dataset. Tier A / B / C
   should appear in the requirement label.

2. **Default `REQ.trial` to Tier A for the pilot.** Live budget is not affordable at open-tier
   volume and, more importantly, is not where the signal is — behaviour is, and behaviour is
   observable in a sandbox. Reserve Tier C for candidates already through everything else and
   being considered for a specific paid engagement, where the company funds it.

3. **Change the `brand-content` artifact label to "three directions and a documented choice".**
   The current wording invites a portfolio, and a portfolio is precisely what a model now
   produces. This is a label change to an existing descriptor, not a new requirement kind.

4. **The "which is worse" question generalises.** `supply-chain` uses it to separate
   statistical from operational thinking, and the same shape works anywhere a decision has
   asymmetric costs. Worth adding to the shared defense bank alongside the seam probe from
   Pass 3.

---

## Sources

- [Adaface — *Growth Marketing Test: candidate screening assessment*](https://www.adaface.com/assessment-test/growth-marketing-test)
- [Vervoe — *Growth Marketer Skills Assessment*](https://vervoe.com/assessment-library/growth-marketer-skills-assessment/)
- [TestGorilla — *B2C Growth Marketing (Ecommerce) Test*](https://www.testgorilla.com/test-library/role-specific-skills-tests/growth-marketing-b2c-test/)
- [Trade Press Services — *Hiring High-Performing Marketers Using the Right Assessments*](https://www.tradepressservices.com/hiring-high-performing-marketers-using-the-right-assessments/)
