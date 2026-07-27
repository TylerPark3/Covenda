# Assessment platforms: what to buy, what to build

The question is not whether existing assessment tools are good. Several are. The question is
which part of Covenda's judgement can be outsourced without outsourcing the thing that makes
Covenda worth using.

---

## The line

**Buy the instrument. Never buy the interpretation.**

A vendor can tell you someone scored 78 on a Python test. Only Covenda can say what 78 means for
*this* role at *this* company, against a bar that is published, and with the score's own
limitations attached. That interpretation is the product.

Consequence, enforced in `api/evidence.js`: **a third-party assessment caps at the `artifact`
tier.** It is evidence that a test was taken under conditions Covenda did not observe. It never
reaches `contribution` or `observer`.

---

## The matrix

| Capability | Buy or build | Why |
|---|---|---|
| Multiple-choice concept testing | **Build** | Cheap, and every distractor must be a real misconception in *that* discipline. A generic bank tests recall (`api/question-bank.js`) |
| Timed coding challenges | **Buy, if needed** | Mature vendors, well-calibrated, not a differentiator. Caps at `artifact` |
| Screen-recorded work sessions | **Build** | This is the core mechanism. Scripted prompts fire during the session (`api/session-script.js`) — no vendor does this |
| Résumé-anchored questions | **Build** | Requires the candidate's own history, and the prestige-stripping is the hard part (`api/resume-questions.js`) |
| Proctoring / identity | **Buy, if ever** | Real expertise, real cost, high false-positive harm. Not needed at current scale |
| AI-generation detection | **Neither** | Unreliable. A false positive accuses a student on the strength of a classifier nobody can inspect. See `docs/AI_AUTHENTICITY.md` |
| Inter-rater reliability | **Build** | Cohen's κ over Covenda's own raters. No vendor can compute it for you (`api/hardening.js`) |
| Structured interview scaffolding | **Build** | Sackett et al. (2022) put structured interviews above work samples after range-restriction correction. It is the highest-value thing to own |
| Personality / psychometrics | **Neither** | Weak predictive validity for this population, and adverse-impact exposure with no upside |
| Background checks | **Buy, if a company asks** | Regulated, and not something to improvise |

---

## Where a vendor score is allowed to appear

1. **Shown, with its source named.** "Scored 78 on {vendor} Python, taken {date}."
2. **Capped at `artifact`.**
3. **Never the reason a student is admitted or rejected.** It is one input among several, read by
   a human who can see the other inputs.
4. **Never re-scaled onto a Covenda number.** Rescaling implies a mapping that has not been
   validated and would invent precision.

---

## What buying anything would cost

Worth stating plainly, because "just integrate a vendor" is always the cheap-sounding option:

- **Latency in the funnel.** Every external step is a place students drop out, and the drop is
  not random — it correlates with time, money, and bandwidth.
- **A dependency on someone else's roadmap.** If a vendor changes its scoring, every historical
  score becomes incomparable and you will not be told in advance.
- **An explanation you cannot give.** A company asks why a candidate scored what they did. "The
  vendor's model produced it" is the answer Covenda's entire pitch is against.
- **Data leaving the envelope.** Every integration is another party holding student data.

---

## What this means today

**Buy nothing yet.** At current volume the build cost is lower than the integration cost, and
the parts worth buying — proctoring, background checks — solve problems Covenda does not have.

Revisit when either is true:
- A company explicitly requires a specific vendor's assessment as a condition of hiring. Then
  integrate that one, cap it at `artifact`, and say so on the profile.
- Timed coding challenges become a bottleneck on operator time. That is the first thing to
  outsource, because it is the most commoditised.

Do not revisit because a vendor is impressive. The question is never whether the tool is good;
it is whether owning that judgement is what makes Covenda worth using.

---

## Where this connects

- `docs/BUILD_VS_BUY.md` — the same reasoning across the whole product
- `api/evidence.js` — the ceiling that makes the "buy the instrument" line enforceable
- `api/question-bank.js`, `api/assessments.js` — what is built
- `docs/VETTING_RAILS.md` — the constraints any bought instrument must still respect
