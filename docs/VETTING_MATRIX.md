# Vetting matrix — all 25 specialisations

Generated against the live catalogue in `api/batches.js`. Requirement sets are what the
engine actually enforces today, not proposals.

Designs: [Software & AI](./VETTING_SOFTWARE.md) · [Accounting & finance](./VETTING_FINANCE.md) ·
[Professional services](./VETTING_PROFESSIONAL.md) · [Consumer & retail](./VETTING_CONSUMER.md) ·
[Healthcare operations](./VETTING_HEALTHCARE.md)

**Status: designed, not validated.** No cohort has run. No rubric has been double-scored. The
κ ≥ 0.6 target across 20 double-scored defenses per specialisation is a target, and until it
is measured these are reasoned designs rather than proven filters. That distinction should
survive into anything student- or company-facing.

---

## The matrix

| Vertical | Specialisation | Tier | Requirements |
|---|---|---|---|
| Software & AI | AI & machine learning | elite | `ownership + history:90 + skills:2 + defense + availability:8`|
| Software & AI | Physical AI & robotics | elite | `ownership + history:90 + skills:2 + defense + availability:8`|
| Software & AI | Infrastructure & data | open | `ownership + history:60 + skills:2 + defense + availability:6`|
| Software & AI | Product engineering | elite | `ownership + history:90 + skills:2 + defense + availability:8`|
| Software & AI | Security & reliability | open | `ownership + skills + defense + availability:6`|
| Accounting & finance | Investment banking | elite | `artifact + skills:2 + defense + availability:8`|
| Accounting & finance | Private equity | elite | `artifact + skills:2 + defense + availability:8`|
| Accounting & finance | Venture capital | elite | `artifact + skills:2 + defense + availability:6`|
| Accounting & finance | Asset & wealth management | open | `artifact + skills + defense + availability:6`|
| Accounting & finance | Accounting & audit | open | `artifact + skills + defense + availability:6`|
| Healthcare operations | Clinical operations | elite | `artifact + defense + referral + availability:5`|
| Healthcare operations | Health data & analytics | open | `artifact + skills + defense + availability:5`|
| Healthcare operations | Payer & revenue cycle | open | `artifact + defense + availability:5`|
| Healthcare operations | Regulatory & quality | elite | `artifact + defense + referral + availability:5`|
| Healthcare operations | Digital health product | open | `artifact + skills + defense + availability:5`|
| Consumer & retail | Growth & performance | open | `trial + skills + defense + availability:5`|
| Consumer & retail | Brand & content | open | `artifact + defense + availability:5`|
| Consumer & retail | Merchandising & assortment | open | `artifact + skills + defense + availability:5`|
| Consumer & retail | Supply chain & operations | open | `artifact + skills + defense + availability:5`|
| Consumer & retail | E-commerce & marketplace | open | `trial + skills + defense + availability:5`|
| Professional services | Management consulting | elite | `artifact + defense + skills + availability:6`|
| Professional services | Strategy & research | open | `artifact + defense + skills + availability:5`|
| Professional services | Market intelligence | open | `artifact + defense + availability:5`|
| Professional services | Legal operations | open | `artifact + defense + referral + availability:5`|
| Professional services | Technical writing | open | `artifact + defense + availability:5`|

---

## What each rail proves, and what it does not

| Rail | Verticals | Establishes | Does not establish |
|---|---|---|---|
| **Ownership (OAuth)** | Software & AI | The account owns the work; how it accumulated over time | **That a human wrote it.** Gradual paste-in of generated code defeats this entirely |
| **Formula parse** | Accounting & finance | Outputs are computed not typed; linkage; circularity handling; live sensitivity | Whether the assumptions are defensible, or who built the workbook |
| **Instrumented trial** | Consumer & retail | What the candidate actually did, in what order, because the platform recorded it | Behaviour under real budget pressure, at Tier A. Outcome is never the signal — the sample is too small |
| **Human rail** | Healthcare, Professional services | Judgement, process reasoning, and authorship — read by two calibrated people against published anchors | Anything mechanically. This is a real process, not a machine check, and the copy says so |
| **Structured referral** | Healthcare (all), `legal-operations` | A named person answers for the work under their own identity | The referee's judgement, or how closely they observed |
| **Recorded defense** | **All 25** | That the candidate can account for the decisions inside their own submission | That they produced every line of it |

---

## Cross-cutting findings

**1. The defense carries the most weight everywhere, and the evidence says it should.**
Sackett et al. (2022) put structured interviews above work samples and above cognitive
ability after correcting for range-restriction over-correction. Independently, 38–48% of
technical candidates now show AI assistance and 80% use an LLM on take-homes when told not to.
The artifact channel is compromised in every vertical; the conversation is not.

**2. Detection is a losing race; capture is the winning move.** Litmus encourages AI use and
records the prompts alongside the code, then grades tool fluency, process and outcome
separately. That is a better answer than the ownership-verification approach Pass 1 started
with, and Pass 1 was revised to say so.

**3. Three specialisations need two mandatory raters** — `security-reliability`,
`venture-capital`, `technical-writing`. One diagnosis: prose artifact, no meaningful machine
read, defense carrying the entire load. Worth encoding as a rule rather than three exceptions.

**4. Per-step scoring should replace holistic scoring across the catalogue.** McKinsey scores
each question within a case independently, so one stumble does not contaminate the result and
one flourish does not conceal weakness. Every rubric in Passes 1 and 2 is currently holistic.

**5. Two shared defense probes generalise across the catalogue.**
- *"What did you look for and fail to find?"* — real work has seams; generated work is
  seamless, and seamlessness is the tell.
- *"Which is worse: X or Y?"* — separates statistical from operational thinking anywhere a
  decision carries asymmetric cost.

**6. The PHI gate is the highest-consequence item in the catalogue** and is specified before
any healthcare rubric. Safe Harbor only. Refuse images outright. Provide synthetic datasets,
which removes the failure mode rather than policing it.

**7. `REQ.trial` needs a published tier.** Synthetic / sandboxed / live-budget cost wildly
different amounts and prove different things. A student reading the bar cannot currently tell
which they face. Tier A is the pilot default; live budget belongs to a paying company, not to
Covenda's cost base.

---

## Open recommendations

Nothing below is applied. Each needs a decision.

1. Add a **nominated defense scope** to `REQ.defense` — the candidate names which commit
   range, assumption, or exception they will defend. Every design depends on it; without it,
   questions are answerable from a README.
2. **Two mandatory raters** for the three prose-artifact specialisations.
3. **Per-step scoring** in place of holistic rubrics.
4. **Publish the trial tier** on `REQ.trial`.
5. **Relabel the `brand-content` artifact** as "three directions and a documented choice" —
   the current wording invites a portfolio, which is what a model now produces.
6. **Accept an optional prompt transcript**, and make a submission *easier* to defend with one.
7. **Build the PHI intake gate** before opening healthcare.
