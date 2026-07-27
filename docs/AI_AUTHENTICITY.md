# AI authenticity

How Covenda treats AI-assisted work.

---

## The position

**AI assistance is not cheating.** The modern workplace uses these tools; a vetting process
that treats them as contamination is testing whether someone can pretend to work like it is
2019.

What matters is whether the candidate **understands and can move** what they produced. That
is a spectrum, not a binary, and the whole design follows from naming the levels.

| Level | What it looks like | Verdict |
|---|---|---|
| **1** | Cannot explain the work | Fail. Nothing was learned and nothing can be built on. |
| **2** | Can explain it, cannot modify it | Fail — but a *different* failure, and the feedback says so. They read it; they did not absorb it. |
| **3** | Used AI, understands it, can modify it | **Admit.** This is a competent modern junior. |
| **4** | Independent judgement, AI as a tool | **Admit.** Rare at undergraduate level and worth finding. |

**The target is 3 and 4.** A process that only admits 4 would reject most working engineers.

---

## Why detection was abandoned

The first design (Pass 1) tried to detect AI use: ownership verification, history span,
questions built to expose a non-author. That approach loses.

- 38.5% of tech candidates already show AI assistance; ~48% in purely technical roles.
- 80% used an LLM on a take-home *after being told not to*.
- Gradual paste-in of generated code defeats every forensic check we have.

Detection is an arms race against tools improving faster than detectors. **Capture wins
instead:** if the process is visible, there is nothing to catch.

---

## The four mechanisms

**1. Practical task.** Work resembling the work. Covenda supplies it where the student would
otherwise have to invent one — see `api/finance-assessment.js`.

**2. Process evidence.** Commits, iterations, intermediate outputs, and — where the candidate
kept them — the **prompt transcript**. A submission that includes prompts should be *easier*
to defend, not harder. That inversion is the entire point: making disclosure advantageous
removes the incentive to hide.

**3. Defense.** Questions from their own submission. The second follow-up is the
discriminator: *"what would you change?"* survives preparation, *"why didn't you do that at
the time?"* usually does not.

**4. Perturbation.** *"Now change it under this new constraint."* This is the cleanest
separator of Level 2 from Level 3, because explaining is recall and modifying is not.

---

## What each level looks like under questioning

**Level 1** — answers describe what the code *is* rather than why it is that way. No dead
ends. Cannot locate their own decision in their own diff.

**Level 2** — fluent explanation, then stalls on perturbation. Can say what a function does;
cannot say what breaks if the constraint changes.

**Level 3** — explains, modifies, and can name a tradeoff they made. Often volunteers where
the AI was wrong.

**Level 4** — reasons about the problem independently and uses the tool where it helps.
Frequently describes rejecting AI output for a stated reason.

---

## Disclosure

Asked, never required, and never penalised:

> *Did you use AI on this? If so, roughly how — and what did you change about what it gave
> you?*

A truthful "yes, heavily, and here is what I fixed" is a **Level 3 answer** and scores
accordingly. Concealment is not separately punished, because punishing it would only teach
better concealment. The defense reaches the same conclusion either way.

---

## The residual gap, stated

A patient candidate who generated code gradually and **studied it well enough to defend and
modify it** passes. That candidate is Level 3. They have done the learning that matters, and
admitting them is the correct outcome rather than a leak in the filter.

The honest claim, which appears in student-facing copy: **this raises the cost of passing off
work you did not do. It does not make it impossible.**

---

## Sources

- [Fabric — State of AI Interview Cheating in 2026 (19,368 interviews)](https://fabrichq.ai/blogs/state-of-ai-interview-cheating-in-2026-insights-from-19-368-interviews)
- [We Recruit IT — 38% of tech candidates using AI](https://werecruit.it/blog/ai-cheating-interviews-2026/)
- [Built In — Is using AI in a job interview cheating? It depends](https://builtin.com/articles/ai-job-interview-cheating-debate)
- [Litmus — AI encouraged, prompts captured alongside the code](https://litmushiring.com/)
