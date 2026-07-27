# Batch vetting design — Pass 1: Software & AI

Five specialisations: `ai-ml`, `physical-ai`, `infrastructure-data`,
`product-engineering`, `security-reliability`.

Extends the existing engine (`api/batches.js` `REQ.*`, `api/connectors.js`,
`api/hardening.js`). Nothing here replaces the admission checklist model.

---

## What the evidence actually says

Three findings shaped every design below, and one of them cuts against the obvious answer.

**1. Work samples are weaker predictors than the folklore claims.** The Schmidt & Hunter
numbers everyone quotes were revised down substantially by Sackett et al. (2022), who found
prior meta-analyses had systematically over-corrected for range restriction. Most methods
kept their rank but lost .10–.20 of validity, and **structured interviews came out top —
above cognitive ability, and above work samples**.

This matters because the intuitive design for Covenda is "make them build something and
judge the artifact." The evidence says the *structured conversation about* the work predicts
better than the work product alone. That is why the defense is not a fraud check bolted onto
the end — it is the highest-validity component in the process, and the rubric should weight
it accordingly.

**2. The artifact channel is compromised, and the numbers are not marginal.** Fabric's
analysis of 19,368 interviews (July 2025 – January 2026) found 38.5% of tech candidates
showing signs of AI assistance, rising to ~48% in purely technical roles, and adoption
more than doubled inside six months. Take-homes are the worst case: one coding-interview
company found **80% of candidates used an LLM on a top-of-funnel test after being explicitly
told not to**.

A repository submitted as a work sample is a take-home with extra steps. It cannot be the
filter.

**3. The industry response is the one Covenda already bet on.** Firms have moved away from
pattern-matched coding toward system design, role-specific scenarios, and pair-programming-
with-AI formats; some, like Canva, now *require* AI use and judge what the candidate does
with it. The direction of travel is away from "can you produce this artifact" and toward
"can you defend the decisions inside it."

**The design consequence, stated plainly:** ownership verification proves provenance, not
authorship. A student who pastes generated code into their own repo over several weeks
passes every forensic check we have. Only the defense separates them — and only if the
questions come from their specific commits.

---

## Revision after reading Litmus — this changes the design

Litmus runs an async work trial generated **from the hiring company's own repos, tickets and
job descriptions**, scoped to the feature that team is shipping next rather than a generic
problem. Candidates work in their own IDE and terminal. **AI use is encouraged, and the
prompts are captured alongside the code** — from Claude Code, the Copilot CLI — so reviewers
see how the candidate actually works. Submissions execute in a sandbox, and grading runs on
three axes: **tool fluency, process, and outcome.**

That is a better answer to the problem than the one I designed above, and I want to be
direct about why.

**Everything in "the residual gap" below is an attempt to DETECT AI use.** Ownership
verification, history span, defense questions built to expose a non-author — all of it treats
model assistance as contamination to be filtered out. Litmus treats it as the medium the work
now happens in, and grades how well the candidate directs it. Given that ~38–48% of
candidates are already using AI and 80% do so on take-homes when told not to, detection is a
losing arms race and *capture* is the winning move. If you can see the prompts, you do not
need to catch anyone.

**What I am changing in the design above:**

1. **Ask for the transcript, not just the artifact.** A candidate submitting a repo should be
   able to submit the prompt history alongside it. Not required — many students will not have
   kept it — but a submission that includes it should be *easier* to defend, not harder,
   because the reviewer can see the reasoning directly rather than reconstructing it through
   questions.

2. **Grade three axes, not one.** The single rubric above collapses tool fluency, process and
   outcome into one number. Litmus separates them, and the separation is the useful part: a
   candidate with weak output and excellent process is exactly the junior hire a startup
   wants, and a single score hides that. This should replace the 4/6/9 single scale with
   three anchored scales.

3. **Generate the assessment from the company's real context.** Litmus builds the trial from
   the hiring company's repos and tickets. Covenda already has the machinery for the
   equivalent — the brief engine turns a founder's problem statement into a scoped trial —
   and this is confirmation that the shape is right. The gap is that our batch vetting is
   still generic while our trials are specific. Batch vetting should pull from the same well.

4. **What survives unchanged:** the defense. Litmus captures process through prompts; we
   capture it through a recorded walkthrough. Both are reading the same thing. Where a
   candidate has no transcript, the defense is the only route to process, so it stays
   mandatory rather than becoming an alternative.

**What I would not copy:** Litmus grades against the hiring company's specific codebase.
Covenda admits to a *batch* before any company is attached, so there is no codebase to scope
to at that moment. Batch vetting has to stay company-agnostic; the company-specific version
is what the trial itself already does.

---

## The residual gap, stated once (applies to all five)

**Ownership ≠ authorship.** OAuth proves the account owns the repo. Commit timeline proves
the work accumulated over time rather than landing in one dump. Neither proves a human wrote
it. Gradual paste-in of generated code defeats both.

What mitigates it, in order of strength:

1. **Defense questions generated from their own diff** — not the repo, the *specific change*.
   Someone who did not make a decision cannot reconstruct why they made it.
2. **The second follow-up.** A prepared answer survives one question. It rarely survives
   "what would you change" followed by "why didn't you do that at the time."
3. **Asking about the abandoned path.** Real work has dead ends. Generated code has none,
   and a candidate who never hit one usually cannot invent a convincing one on the spot.

What does *not* mitigate it, and we should stop pretending otherwise: commit frequency,
line counts, test coverage, or any static read of the code. All are trivially producible.

---

## `ai-ml` — AI & machine learning *(elite)*

**1. The bar, and why.** This screens for someone who has trained a model *and knows why it
did what it did* — evaluation discipline, not model zoo familiarity. The industry-standard
failure is a student who fine-tuned something, got a number, and cannot say what the number
would look like if the split were wrong. Fair, because it is the same thing a first-week task
would expose.

**2. The submission.** A connected GitHub account plus one designated repository containing
a training or evaluation pipeline. Candidate nominates **one commit range** as the work they
will defend — this is new, and it is what makes defense questions specific rather than about
the repo in general.

**3. What the machine checks.** Ownership via OAuth (`connectors.github`, live). History span
≥90 days. Presence of an evaluation harness distinct from the training loop — a structural
read, not a quality judgement. **It does not establish** that the candidate wrote any of it,
that the evaluation is sound, or that the results reproduce.

**4. Anchored rubric (4 / 6 / 9).**
- **4** — Can describe what the model does. Reports a headline metric. Cannot say how the
  train/test split was made, or answers "the library did it."
- **6** — Explains the split and why it is appropriate for the data. Names one thing the
  metric hides. Can identify which hyperparameter mattered most and roughly why.
- **9** — Articulates a failure mode they found and how they found it. Distinguishes what the
  evaluation proves from what it merely suggests. Can state the experiment that would falsify
  their own result.

**5. Defense questions** *(from their nominated commit range)*
- "Walk me through the commit where you changed `<specific file>` — what were you fixing?"
- "Your eval reports `<metric>`. What would that number look like if `<specific leakage
  risk visible in their code>` were happening?"
- Follow-up one: "What would you change if you rebuilt it tomorrow?"
- Follow-up two: "Why didn't you do that at the time?" — **the discriminator.** An author has
  a reason (time, unknown, different priority). A non-author has no memory of the tradeoff.

**6. Failure modes caught.** Fine-tuned-a-tutorial candidates; results with no error analysis;
metric quoted without knowing what it excludes; anyone who cannot locate their own decision
in their own diff.

**7. What it cannot catch.** A patient candidate who generated code gradually and *studied it*
well enough to defend it. That candidate has arguably done the learning; we accept them and
say so rather than pretending the filter is airtight.

**8. Requirement set.** `ownership + history(90) + skills(2) + defense + hours(8)` —
**unchanged**. One addition: `defense` should carry the nominated commit range. Justification:
the descriptor already says "a recorded walkthrough of your own work"; scoping it to a range
the candidate chooses is what makes the questions unfakeable, and costs no new machinery.

---

## `physical-ai` — Physical AI & robotics *(elite)*

**1. The bar, and why.** The discriminating experience in robotics is **sim-to-real failure**
— the thing that worked in simulation and did not survive contact with hardware. It is the
experience that cannot be acquired from a tutorial, because tutorials do not have friction,
latency, sensor noise, or a motor that browns out under load.

**2. The submission.** Connected account plus a repository containing control, perception or
hardware-interface code. Candidate nominates **one specific sim-to-real discrepancy** they
encountered — described in one line at submission, defended live.

**3. What the machine checks.** Ownership, history ≥90 days, and presence of hardware or
simulator interfacing (imports, config, message definitions) — a structural read. **It does
not establish** that the candidate ever ran it on hardware, which is the entire point of the
defense here.

**4. Anchored rubric.**
- **4** — Describes a system that worked in simulation. Sim-to-real discrepancy is generic
  ("real world is noisy") or absent.
- **6** — Names a specific discrepancy, how it manifested, and what they changed. May not
  distinguish the fix from the workaround.
- **9** — Explains *why* the gap existed (a modelling assumption, a timing assumption, an
  unmodelled dynamic), what they measured to confirm it, and what they would instrument next
  time to catch it earlier.

**5. Defense questions.**
- "You said `<their stated discrepancy>`. How did you first notice it — what were you looking at?"
- "What did you rule out before you landed on that cause?"
- Follow-up one: "What would have caught this in simulation?"
- Follow-up two: "Why wasn't that in your sim already?" — separates someone who lived it from
  someone who read about it.

**6. Failure modes caught.** Simulation-only candidates presenting as hardware-experienced;
anyone whose "debugging story" has no dead ends; candidates who cannot name what they
measured.

**7. What it cannot catch.** A student with genuine hardware access who did the work as part
of a large team and is describing a colleague's debugging. Structured referral would catch it;
we do not require one here, and that is a deliberate gap for an elite batch with a small pool.

**8. Requirement set.** `ownership + history(90) + skills(2) + defense + hours(8)` —
**unchanged**.

---

## `infrastructure-data` — Infrastructure & data *(open)*

**1. The bar, and why.** This screens for someone who has operated something, not just built
it. Pipelines are easy to write and hard to keep running; the discriminating experience is
having been on the wrong end of a silent failure.

**2. The submission.** Connected account plus a pipeline, transformation, or infrastructure
repository. Candidate nominates **one failure they diagnosed**.

**3. What the machine checks.** Ownership, history ≥60 days (lower than the elite batches —
open tier, and pipeline work is often bursty), presence of orchestration or transformation
structure. **It does not establish** the pipeline ever ran on real data.

**4. Anchored rubric.**
- **4** — Can describe what the pipeline does end to end. No account of failure beyond "it
  broke and I fixed it."
- **6** — Describes a specific failure, how it surfaced, and the fix. May not distinguish
  the symptom from the cause.
- **9** — Distinguishes symptom from cause, explains how long it went undetected and why,
  and names the check that would have caught it sooner.

**5. Defense questions.**
- "How would you know if `<a specific transformation in their code>` silently dropped rows?"
- "Walk me through the failure you nominated — what did you see first?"
- Follow-up one: "How long had it been wrong before you noticed?"
- Follow-up two: "What did you add so it wouldn't happen again?" — an author has an answer,
  and it is usually specific and slightly embarrassing.

**6. Failure modes caught.** Tutorial pipelines; candidates who have never seen data arrive
malformed; anyone who treats "it ran" as "it worked."

**7. What it cannot catch.** Small-scale work presented as production-scale. We do not verify
volume, and a candidate is not asked to.

**8. Requirement set.** `ownership + history(60) + skills(2) + defense + hours(6)` —
**unchanged**.

---

## `product-engineering` — Product engineering *(elite)*

**1. The bar, and why.** Application code judged on structure and testing habits, not line
count. The thing being screened for is whether someone can change code they did not write —
which is most of the job and almost none of a portfolio.

**2. The submission.** Connected account plus an application repository. Candidate nominates
**one change they made to code they did not originally write** — their own older code counts,
and for most undergraduates that will be the honest answer.

**3. What the machine checks.** Ownership, history ≥90 days, presence of tests as a
structural fact. **It does not establish** that the tests are meaningful, that they were
written before the code, or that the candidate wrote either.

**4. Anchored rubric.**
- **4** — Can explain what the code does. Testing account is "there are tests."
- **6** — Explains what a specific test protects against and why it exists. Can describe how
  they oriented in unfamiliar code.
- **9** — Articulates a structural decision and its cost, names something they would do
  differently at ten times the scale, and can say which test they would delete.

**5. Defense questions.**
- "Take me to the change you nominated. What did you have to understand before you could
  make it safely?"
- "Which test here would fail first if `<a specific behaviour>` regressed?"
- Follow-up one: "Which of these tests is not earning its keep?"
- Follow-up two: "Why is it still there?" — authors have opinions about their own dead weight.

**6. Failure modes caught.** Greenfield-only candidates; test suites written to hit coverage;
anyone who cannot navigate their own repository under questioning.

**7. What it cannot catch.** Sustained, careful AI collaboration by a student who understands
the output. As above — that student has done real learning, and the honest position is that
we admit them.

**8. Requirement set.** `ownership + history(90) + skills(2) + defense + hours(8)` —
**unchanged**.

---

## `security-reliability` — Security & reliability *(open)*

**1. The bar, and why.** Screens for adversarial thinking: the habit of asking what breaks
this, rather than does this work. Test suites and incident write-ups are the artifact; the
reasoning is the point.

**2. The submission.** Connected account plus test suites, an issue history, or an incident
write-up. **No minimum history span** — this is the one software batch where a single
well-reasoned artifact is legitimately enough, because a good incident write-up is a complete
piece of thinking.

**3. What the machine checks.** Ownership, presence of test or issue artifacts. **It does not
establish** whether the reasoning is sound — and here, less than anywhere else in this batch,
because prose is the easiest thing for a model to produce.

**4. Anchored rubric.**
- **4** — Identifies that something failed. Description is chronological, not causal.
- **6** — Separates cause from symptom. Proposes a fix addressing the cause. May not consider
  what the fix breaks.
- **9** — Reasons about the failure class rather than the instance, states what the fix costs,
  and identifies what would still get through.

**5. Defense questions.**
- "How would you attack `<a specific component in their submission>`?"
- "What did you assume was safe that turned out not to be?"
- Follow-up one: "What does your fix not cover?"
- Follow-up two: "What would you need to know to close that gap?" — surfaces whether they
  have thought past their own patch.

**6. Failure modes caught.** Checklist security thinking; candidates who cannot articulate a
threat model; write-ups that describe events without causes.

**7. What it cannot catch.** **This is the weakest design in the batch and I want that on the
record.** The artifact is prose, prose is what LLMs produce best, and there is no history
requirement to lean on. The defense is carrying nearly the whole load. If any software
specialisation needs a second rater to be non-negotiable, it is this one.

**8. Requirement set.** `ownership + skills(1) + defense + hours(6)` — **unchanged**, but see
the recommendation below.

---

## Recommendations arising from this pass

1. **Add a nominated scope to `REQ.defense`.** Every design above depends on the candidate
   naming *which* commit range, failure, or change they will defend. Without it, questions
   are about the repo in general and become answerable from a README. This is a small change
   to an existing descriptor, not a new requirement.

2. **Weight the defense above the artifact in scoring.** Sackett et al. put structured
   interviews above work samples; our own threat model puts the artifact channel at ~38–48%
   compromised. The current engine treats requirements as a checklist, which is correct for
   *admission* — but when the dual-rater rubric produces a score, the defense should dominate.

3. **`security-reliability` should require two raters explicitly**, or gain a history
   requirement. It is the one design here where a single reader plus a prose artifact is not
   a real filter.

4. **Publish the residual gap to students.** "Ownership verification proves the account owns
   the work, not that you wrote it — the walkthrough is where that gets established" is both
   honest and a deterrent. It tells a would-be gamer exactly where the load-bearing wall is.

---

## Measuring whether the rubrics work

`interRaterReliability` in `api/hardening.js` computes Cohen's κ. The target for these
anchors is **κ ≥ 0.6** on a sample of at least 20 double-scored defenses per specialisation.
Below that, the anchors are not concrete enough and should be rewritten rather than
explained to raters.

Adjudication is already implemented: a split of ≥3 points goes to a third reader rather than
being averaged (`api/vetting-software.js`), because averaging 4 and 9 produces a number
neither rater would defend.

---

## Sources

- [Sackett et al. (2022), *Revisiting meta-analytic estimates of validity in personnel
  selection* — PubMed](https://pubmed.ncbi.nlm.nih.gov/34968080/)
- [SIOP — *Is Cognitive Ability the Best Predictor of Job Performance? New Research Says It's
  Time to Think Again*](https://www.siop.org/tip-article/is-cognitive-ability-the-best-predictor-of-job-performance-new-research-says-its-time-to-think-again/)
- [Sackett et al. (2023), *Revisiting the design of selection systems in light of new
  findings* — Cambridge Core](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/A20984B138319E3D432E643978BF026D/S175494262300024Xa.pdf/revisiting_the_design_of_selection_systems_in_light_of_new_findings_regarding_the_validity_of_widely_used_predictors.pdf)
- [Fabric — *State of AI Interview Cheating in 2026: Insights from 19,368
  Interviews*](https://fabrichq.ai/blogs/state-of-ai-interview-cheating-in-2026-insights-from-19-368-interviews)
- [We Recruit IT — *38% of Your Tech Candidates Are Using AI to Cheat*](https://werecruit.it/blog/ai-cheating-interviews-2026/)
- [Built In — *Is Using AI in a Job Interview Cheating? It
  Depends.*](https://builtin.com/articles/ai-job-interview-cheating-debate)
- [Litmus — async work trials generated from your repos and tickets](https://litmushiring.com/)
- [Y Combinator — *Litmus: Run an async work trial on every engineer you interview*](https://www.ycombinator.com/companies/litmus-hiring)
