# Build vs buy vs partner vs human

The question this answers: **which parts of the vetting stack should Covenda own?**

The default answer everywhere below is *do not build it*. Covenda is a talent verification
and matching platform, not an assessment company, and every hour spent building a coding
sandbox is an hour not spent on the layer nobody else is building.

---

## The test each component has to pass

A component is **built** only if all four are true:

1. It is central to Covenda's differentiation.
2. No mature provider does it adequately.
3. It generates evidence Covenda needs to own.
4. Building it is cheaper than the strategic cost of depending on someone else.

If only some are true, integrate. If the capability is judgement, use people.

---

## The decisions

| Component | Decision | Why |
|---|---|---|
| **Compatibility engine** | **BUILD** | Already built. It is the product. Nobody sells "does this student fit this specific opportunity" because nobody else has both sides. |
| **Evidence graph / normalisation** | **BUILD** | `api/evidence.js`. The moat. Every vendor sells a score; nobody sells a normalised, tiered, cross-source profile with its limits attached. |
| **Ownership defense** | **BUILD** | Requires knowing what the candidate submitted. A vendor cannot generate questions from a repo they have never seen, and no vendor has a relationship with the student afterwards. |
| **Batch admission logic** | **BUILD** | Requirements checklists, gap explanations, operator adjudication. Specific to how Covenda has chosen to admit people. |
| **Company-facing profile** | **BUILD** | The output. "Verified, with what it does and does not prove" is the thing being sold. |
| **Brief engine** | **BUILD** | Already built. Turning a founder's problem into a scoped trial is the wedge. |
| **Coding execution sandbox** | **BUY** | CodeSignal, Codility and HackerRank have spent years on this. Building it is pure cost with no differentiation. |
| **Automated code grading** | **BUY** | Same. Solved, commoditised, competitive. |
| **Standardised skills tests** (Excel, SQL, business fundamentals) | **BUY** | TestGorilla / Vervoe class. Where a generic test genuinely suffices, a generic test is correct. |
| **Proctoring** | **BUY** | Regulated, adversarial, and expensive to get right. |
| **Identity verification** | **BOUGHT** | Already Stripe Identity. Correct call, already made. |
| **Video interview infrastructure** | **NEITHER** | See below — this is the one where the obvious buy is wrong. |
| **Financial model parsing** | **BUILT, correctly** | `api/xlsx-parse.js`. No vendor reads a formula layer and reports on integrity; this is genuinely differentiated and it already exists. |
| **Judgement, adjudication, admission** | **HUMAN** | The capability being measured *is* judgement. Automating it would remove the thing being tested. |

---

## Where integration is genuinely available

Verified against official documentation rather than marketing pages.

**CodeSignal** — [GraphQL API](https://developer.codesignal.com/graphql/) exposing test,
certification and interview data, plus [webhooks](https://developer.codesignal.com/webhooks/)
for `companyTestSessionStarted` and `companyTestSessionFinished`. Available to customers *and
partners*. This is the most integration-ready of the three: event-driven, so a result lands in
Covenda's evidence graph without polling.

**Codility** — [public API](https://codility.com/api-documentation/) built for integrating
with HR and BI tooling.

**HackerRank** — ATS connectivity, API documentation and webhook support.

All three are viable. **CodeSignal is the recommended first integration** on the strength of
documented webhooks and explicit partner access — not because its assessment is better, which
is not established.

---

## The one decision that goes against the obvious answer

**Do not buy video interview infrastructure.**

HireVue and its category exist to run structured interviews at scale, and on paper that is
exactly what the ownership defense is. It is not, for two reasons:

1. **The questions come from the candidate's own submission.** A generic structured-interview
   platform asks the same questions of everyone — which is precisely what makes an interview
   answerable in advance, and what the entire AI-era design is built to avoid. The defense is
   only worth anything because it is unfakeable, and it is only unfakeable because it is
   specific.

2. **The recording is already built and already ours.** `videoStudio` records in the portal
   and stores against the account. Buying an interview platform would mean sending candidates
   out of Covenda to answer questions Covenda generated about work Covenda holds — worse
   experience, more vendor surface, no gain.

Buy the sandbox. Do not buy the conversation.

---

## What a vendor result is allowed to be worth

Enforced in code (`api/evidence.js`), not left to a policy document: **third-party
assessments cap at `artifact` tier.** A vendor asserting "verified" cannot promote itself.

The reasoning is not snobbery about vendor quality. A proctored CodeSignal score is real
evidence that someone performed on a day under those conditions. What it cannot do is survive
*"walk me through what you did"* — and that is the thing companies actually want, the thing
Covenda can uniquely provide, and the reason a vendor score is an input rather than an answer.

Stated the other way: if a vendor score were sufficient, the company would buy the vendor.

---

## What integrating costs strategically

**Lock-in is low and worth accepting.** Assessment results enter as evidence rows; if a
provider is dropped, historical rows keep their meaning and new candidates route elsewhere.
Nothing in the admission logic depends on a specific vendor.

**The real risk is different: becoming a reseller.** If Covenda's pitch becomes "we run
CodeSignal for you", the vendor can disintermediate at will. The protection is that the
company-facing output is a *profile*, not a score — compatibility, provenance, defense and
human review are all Covenda's, and a vendor selling directly cannot assemble them.

That is the line to hold. Integrate freely at the assessment layer; own everything above it.

---

## Sources

- [CodeSignal — Webhook API](https://developer.codesignal.com/webhooks/)
- [CodeSignal — APIs (knowledge base)](https://support.codesignal.com/hc/en-us/articles/18050947755031-CodeSignal-APIs)
- [CodeSignal — Building integrations with the API and webhooks](https://codesignal.com/blog/codesignal-api-and-webhooks/)
- [Codility — Public API documentation](https://codility.com/api-documentation/)
- [HackerRank vs Codility comparison](https://www.hackerrank.com/writing/hackerrank-vs-codility-coding-test-comparison-2025)
- [daily.dev — Codility vs HackerRank vs CodeSignal](https://recruiter.daily.dev/resources/technical-screening-tools-codility-vs-hackerrank-vs-codesignal/)
- [Litmus — async work trials generated from your repos](https://litmushiring.com/)
