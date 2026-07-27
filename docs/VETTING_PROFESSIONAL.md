# Batch vetting design — Pass 3: Professional services

Five specialisations: `management-consulting`, `strategy-research`, `market-intelligence`,
`legal-operations`, `technical-writing`.

Current bar: `artifact(1) + defense + skills(1) + hours(5–6)`; `legal-operations` also
requires `referral`.

---

## Status of these designs

Grounded in published evidence about what predicts performance and how these roles are
actually assessed. **Not validated for Covenda.** No cohort has run, no rubric has been
double-scored, and the κ ≥ 0.6 target is a target rather than a measurement. These are
designs with reasoning attached, not proven filters, and the distinction should survive into
how they are described to students and companies.

---

## What the evidence says

**1. The case interview is the most refined vetting instrument in existence, and its
structure is public.** McKinsey scores four dimensions independently — problem solving
(decomposing an ambiguous problem into a MECE structure, the most heavily weighted at ~25%),
analytical and quantitative thinking (~20%), personal impact, and drive. The detail that
matters for us: **McKinsey scores each question within the case independently**, rather than
holistically at the end as BCG and Bain do. A candidate who stumbles once and is strong
throughout still passes.

That is a directly borrowable design decision, and it fixes a real defect. A single holistic
rubric — which is what every design in Passes 1 and 2 currently uses — lets one bad moment
contaminate the whole score, and lets one impressive moment paper over consistent weakness.
Per-step scoring is more work for the rater and substantially more informative.

**2. Authorship is the entire problem in this batch, more than anywhere else.** Every
artifact here is prose or a document. Prose is what LLMs produce best. There is no OAuth to
establish provenance, no formula layer to parse, no commit history to read. The machine
contributes almost nothing, and any design pretending otherwise is dishonest.

This is the batch where the Litmus insight from Pass 1 matters most: **stop trying to detect
and start capturing process.** A research artifact submitted with its source trail, its dead
ends, and the questions the candidate asked along the way is far more informative than the
polished output, and far harder to fabricate — not because fabricating it is impossible, but
because fabricating a *convincing* dead end requires having had one.

**3. What separates real research from generated research is the seams.** Real work has
sources that did not pan out, a question that changed halfway, a number that could not be
found. Generated work is seamless. Every defense below probes for seams, and the absence of
seams is itself the signal.

---

## `management-consulting` — Management consulting *(elite)*

This should be the closest thing to the real interview Covenda runs, and it is the one
specialisation in the catalogue where a live structured case is worth the operator cost.

**1. The bar, and why.** Screens for structured problem solving under questioning: can the
candidate take an ambiguous problem, decompose it MECE, state a hypothesis, and update it
when handed a fact that contradicts them. Fair, because it is verifiably what the job's own
interview tests, and because we publish the criteria in advance rather than concealing them.

**2. The submission.** A **live recorded structured case**, 25–30 minutes, run against a
published prompt bank. Not an artifact — the process *is* the submission. Candidate sees the
evaluation criteria before starting.

**3. What the machine checks.** Nothing beyond the recording existing. Stated plainly: this
is a human rail, and it is a real process rather than a vibe check because the criteria are
published, scored per step, and double-rated.

**4. Anchored rubric — scored per step, not holistically.**
Four dimensions, each 4 / 6 / 9, following the McKinsey separation:

*Structure*
- **4** — Lists factors. Categories overlap or leave obvious gaps.
- **6** — MECE decomposition appropriate to the problem. Can say why they chose that cut.
- **9** — Structure is driven by a stated hypothesis, and they prune branches that cannot
  matter before spending time on them.

*Quantitative*
- **4** — Arithmetic errors, or sets up the calculation only when prompted.
- **6** — Sets up correctly, sanity-checks the magnitude, states assumptions aloud.
- **9** — Chooses the estimate that resolves the question fastest and says what precision
  would actually be needed to act.

*Judgement*
- **4** — Recommends the first plausible option.
- **6** — Weighs alternatives against a stated criterion.
- **9** — Identifies what would change the recommendation, and says what they would check
  before committing.

*Communication*
- **4** — Answer emerges at the end; reasoning is hard to follow.
- **6** — Signposts, answer-first, checks the listener is with them.
- **9** — Adjusts depth to the listener, and states confidence honestly rather than uniformly.

**5. Defense questions** *(the case itself contains them)*
- Mid-case: "Here is a fact that contradicts your hypothesis. What now?" — the single highest
  signal moment in the entire batch. Real problem-solvers update; rehearsed ones defend.
- "Which branch of your structure did you decide not to pursue, and why?"
- Follow-up one: "What would have made you pursue it?"
- Follow-up two: "What are you least sure about in your own recommendation?"

**6. Failure modes caught.** Memorised frameworks applied regardless of fit; candidates who
cannot abandon a hypothesis; arithmetic that is never sanity-checked; recommendations with no
stated conditions.

**7. What it cannot catch.** Coached candidates are genuinely good at this format —
consulting prep is an industry. Per-step scoring and the contradiction moment help; they do
not eliminate it. A well-coached candidate who has internalised the method has, arguably,
learned the method.

**8. Requirement set.** `artifact(1) + defense + skills(1) + hours(6)` — **change proposed**:
the `artifact` here should be the recorded case itself rather than a separate document.
Justification: requiring both a written sample and a live case doubles the cost for a signal
the case already provides better.

---

## `strategy-research` — Strategy & research *(open)*

**1. The bar, and why.** Screens for whether a candidate can frame a question before
answering it, and whether their sources survive contact. The failure mode is a well-written
document that answers a question nobody asked.

**2. The submission.** A research sample, plus — new, and central — **the source trail**:
what they consulted, what they discarded, and one thing they looked for and could not find.

**3. What the machine checks.** Document parses; cited URLs resolve. Nothing else. **A
resolving URL does not establish the source was read**, and the design should not imply
otherwise.

**4. Anchored rubric.**
- **4** — Summarises sources. No stated question. Conclusion restates the inputs.
- **6** — States the question, answers it, and cites what the answer rests on. Sources are
  reasonable but uninterrogated.
- **9** — Frames the question sharply, distinguishes what the sources establish from what
  they merely suggest, and names what would change the conclusion.

**5. Defense questions.**
- "Which source did you trust least, and what did you do about it?"
- "What did you look for and fail to find?" — **the seam probe.** Generated research has no
  gaps; real research always does.
- Follow-up one: "How did the question change while you were working?"
- Follow-up two: "What would you have needed to answer the original one?"

**6. Failure modes caught.** Summary-as-research; uninterrogated sources; conclusions with no
stated basis; candidates whose research process has no friction in it.

**7. What it cannot catch.** A careful candidate who used a model well, read the output
critically, and can defend it. As throughout: that person has done the work that matters.

**8. Requirement set.** `artifact(1) + defense + skills(1) + hours(5)` — **unchanged**, plus
the source trail as part of the artifact rather than a new requirement.

---

## `market-intelligence` — Market intelligence *(open)*

**1. The bar, and why.** Screens for whether a candidate can build a defensible picture of a
market from public information — and, more importantly, say where the picture is thin. The
job is being useful under incomplete information, not appearing certain.

**2. The submission.** A landscape or competitive analysis with sources, plus **a stated
confidence level per major claim**.

**3. What the machine checks.** Parse and source resolution only.

**4. Anchored rubric.**
- **4** — Lists competitors and features. No structure to the comparison. Confidence uniform.
- **6** — Compares along axes that matter to a decision. Distinguishes verified facts from
  inference.
- **9** — States what the analysis cannot resolve and why, and identifies which unknown would
  most change the picture.

**5. Defense questions.**
- "Which claim here are you least confident in, and why did you include it?"
- "Where did `<a specific figure>` come from, and how old is it?"
- Follow-up one: "What would you check first if this had to be right?"
- Follow-up two: "What did you assume because you could not verify it?"

**6. Failure modes caught.** Feature-matrix-as-analysis; uniform confidence across claims of
wildly different quality; figures with no provenance.

**7. What it cannot catch.** Whether the market read is *correct* — that resolves over years.
We are testing calibration, not accuracy, and should say so.

**8. Requirement set.** `artifact(1) + defense + skills(1) + hours(5)` — **unchanged**.

---

## `legal-operations` — Legal operations *(open)*

**1. The bar, and why.** Screens for process discipline in a domain where errors are
expensive and where the candidate must know the edge of their own competence. The referral
requirement already on this specialisation is correct and should stay.

**⚠ Scope boundary, specified before the rubric.** Nothing in this specialisation may ask a
student to give, or appear to give, legal advice. The submission is **operational** — process
design, contract *administration*, matter tracking, intake workflow. Any submission that
reads as legal analysis or advice is redirected, not scored. The published bar should say
this in the student's own language: *"This is about how legal work is run, not what the law
says."*

**2. The submission.** A process or contract-administration artifact — an intake workflow, a
matter-tracking design, a clause library structure — plus a structured referral from whoever
oversaw it.

**3. What the machine checks.** Parse only.

**4. Anchored rubric.**
- **4** — Describes a process. No exception path. Cannot say what happens when it fails.
- **6** — Process with exception handling and a stated owner for each step.
- **9** — Identifies where the process creates risk, what the control is, and — the
  discriminator — **where the process should escalate to a lawyer rather than continue.**

**5. Defense questions.**
- "Where in this process would you stop and ask a lawyer?" — asked first. Someone who does not
  know the boundary of their competence is the risk this specialisation screens for.
- "What happens when `<a specific step>` is skipped?"
- Follow-up one: "How would you know it had been skipped?"
- Follow-up two: "Who finds out first?"

**6. Failure modes caught.** Candidates who cannot identify the advice boundary; processes
with no exception path; designs that assume everyone follows them.

**7. What it cannot catch.** Whether the process is compliant in a specific jurisdiction. Out
of scope by design, and stated as such.

**8. Requirement set.** `artifact(1) + defense + skills(1) + referral + hours(5)` —
**unchanged**. The referral is load-bearing here and should not be relaxed.

---

## `technical-writing` — Technical writing *(open)*

**1. The bar, and why.** **Authorship is the whole problem**, more acutely than anywhere else
in the catalogue. An LLM writes competent documentation. What it cannot do is have learned the
thing being documented. So this screens for the *learning*, not the prose.

**2. The submission.** A documentation sample, plus **an account of what they had to
understand to write it and what confused them first**.

**3. What the machine checks.** Parse only. **This is the thinnest machine read in the entire
catalogue** and the design says so rather than implying a check exists.

**4. Anchored rubric.**
- **4** — Accurate prose that restates the source material. No evidence of a reader in mind.
- **6** — Organised around what a reader needs to do, in the order they need it. Anticipates
  one likely confusion.
- **9** — Demonstrably shaped by having watched someone fail — addresses the misunderstanding
  that actually occurs, not the one that logically might.

**5. Defense questions.**
- "What confused you first when you were learning this?" — a genuine author answers instantly
  and specifically. This is the highest-signal question in the specialisation.
- "What did you leave out, and why?"
- Follow-up one: "Who is this for, and what do they already know?"
- Follow-up two: "What would you cut if it had to be half as long?"

**6. Failure modes caught.** Documentation that mirrors the source's structure rather than the
reader's task; candidates who cannot name a single point of confusion; prose with no evident
audience.

**7. What it cannot catch.** A candidate who understood the material and used a model to draft
it. That is the normal working method now, and treating it as failure would mean failing most
competent technical writers.

**8. Requirement set.** `artifact(1) + defense + skills(1) + hours(5)` — **unchanged**, but
**two mandatory raters**, joining `venture-capital` and `security-reliability`. Same shape:
prose artifact, no machine read, defense carrying everything.

---

## Recommendations arising from this pass

1. **Adopt per-step scoring across the catalogue.** McKinsey scores each question
   independently rather than holistically, and it is a better instrument: one stumble does not
   contaminate the score, one flourish does not conceal weakness. Every rubric in Passes 1 and
   2 is currently holistic and should be revisited.

2. **Three specialisations now need two mandatory raters:** `security-reliability` (Pass 1),
   `venture-capital` (Pass 2), `technical-writing` (Pass 3). All three share the diagnosis —
   prose artifact, no meaningful machine read, defense carrying the entire load. This is a
   pattern worth encoding as a rule rather than three separate exceptions.

3. **Add "the seam probe" as a standard defense question for every prose artifact.** *"What
   did you look for and fail to find?"* Real work has gaps. Generated work is seamless, and
   seamlessness is the tell.

4. **`legal-operations` needs its scope boundary published on the student-facing bar**, not
   just held in this document. A student must know before submitting that legal analysis is
   out of scope.

---

## Sources

- [Road to Offer — *Case Interview Scoring: What Partners Look For*](https://www.roadtooffer.com/blog/case-interview-scoring-rubric)
- [Case Interview Hub — *How McKinsey Evaluates Your Case Interview*](https://www.caseinterviewhub.com/post/how-mckinsey-evaluates-your-case-interview-by-former-mckinsey-interviewers)
- [StrategyCase — *McKinsey Case Interview: The Insider's Guide*](https://strategycase.com/mckinsey-case-interview/)
- [CaseBasix — *Case Interview Scoring System Explained*](https://www.casebasix.com/pages/case-interview-scoring-system)
- [Litmus — async work trials with captured process](https://litmushiring.com/)
