# Batch vetting design — Pass 5: Healthcare operations

Five specialisations: `clinical-operations`, `health-analytics`, `revenue-cycle`,
`regulatory-quality`, `digital-health-product`.

**This batch is explicitly a human rail.** No API verifies process work in healthcare, the
product says so, and this document does not invent one.

Current bar leans on `artifact(1, 'de-identified …') + defense + referral + hours(5)`.

---

## PART 1 — The PHI intake gate

**Specified before any rubric, because it is the higher-consequence design.** A student
uploading real protected health information to Covenda would be a serious problem — for the
student, for whoever gave them access, and for us. The gate has to make that structurally
hard, not merely discouraged.

### What the standard actually requires

HIPAA offers two de-identification routes, and they are different in kind:

**Safe Harbor** (§164.514(b)(2)) is rule-based: remove all 18 identifier categories, then
confirm you have no actual knowledge the remainder could identify someone. The categories that
students get wrong most often, and that our gate must therefore target:

- **All date elements except year** — admission, discharge, birth, death. A student who
  redacts names and leaves admission dates has not de-identified anything.
- **Geography below state level**, except 3-digit ZIP codes covering ≥20,000 people.
- **All ages above 89**, which must be aggregated into a single 90+ category.
- Names, MRNs, account numbers, device identifiers, biometrics, full-face photographs, and any
  other unique identifying number or code.

**Expert Determination** is risk-based: a qualified statistician concludes residual
re-identification risk is acceptably low for that data, those recipients, that use.

**Design decision: Covenda accepts Safe Harbor only.** Expert Determination requires a
qualified expert we do not employ and cannot verify, and accepting a student's assertion that
an expert cleared their data would be accepting the thing we are trying to check. Stated on
the bar in plain language.

### The gate, in order

**1. Refuse outright — no upload accepted.**
- Any file type associated with clinical systems: `.hl7`, `.ccd`, `.cda`, `.dcm` (DICOM),
  `.xml` matching HL7 schemas.
- Any file whose name matches patient-record patterns (`mrn`, `patient`, `chart`, `phi`,
  `encounter` with an identifier).
- Images of any kind. **No exceptions.** A photographed screen is the single most common way
  PHI arrives, and there is no scanning approach that reliably reads what is in an image.

**2. Warn and block pending confirmation — the pattern scan.**
Before storage, scan the extracted text for the Safe Harbor categories we can detect
mechanically:
- Date patterns with day-level precision (`\d{1,2}[/-]\d{1,2}[/-]\d{2,4}`).
- Ages above 89.
- Sequences resembling MRNs, SSNs, or account numbers.
- 5-digit ZIP codes.
- Full names adjacent to clinical vocabulary.

A hit blocks the upload and returns the specific line and category, so the student can fix it
rather than guess. **The scan is a safety net, not a guarantee** — it catches formatting, not
meaning, and a narrative note naming a rare condition and a small town can identify someone
with every pattern-matchable field removed. The copy says this.

**3. What we tell them to submit instead.**
- A **process artifact** with no patient data in it at all: a workflow map, an SOP, a checklist,
  a queue design.
- **Synthetic data** — we should provide a generated dataset per specialisation, which removes
  the need for the student to de-identify anything and is the single highest-leverage
  mitigation available.
- An **aggregate analysis** where every cell represents ≥20 individuals.

**4. Attestation, and what it is worth.**
A checkbox: *"This contains no patient-identifiable information, and I had the right to
access the underlying material."* It creates a record and prompts a moment of thought. **It
does not protect anyone**, and the design should not treat it as a control. The refuse-list
and the synthetic-data default are the controls.

### Honest limits of the gate

It cannot detect PHI in an image. It cannot detect a re-identifiable narrative. It cannot
verify the student had authorisation. What it does is make the careless path hard and the
correct path easy — which is the achievable goal.

---

## PART 2 — The specialisations

Every design here runs on the human rail. That is not an apology. In a domain where no
verification exists, **claiming verification would be the failure**; a documented, dual-rated,
referral-backed process is the honest instrument, and saying so is part of the product.

---

## `clinical-operations` — Clinical operations *(elite)*

**1. The bar, and why.** Screens for whether a candidate has run a real process and understands
its exception path — the thing that happens when the workflow does not apply. Clinical
operations is mostly exceptions, and a candidate who only knows the happy path has not done it.

**2. The submission.** A de-identified process artifact (workflow, SOP, queue design) plus a
structured referral from a named supervisor. Candidate nominates **one exception the process
handles badly**.

**3. What the machine checks.** The PHI gate above. Nothing about quality. Stated plainly.

**4. Anchored rubric.**
- **4** — Documents a process. Exception path absent, or "escalate to manager".
- **6** — Exceptions have defined owners and routes. Can say where the process usually breaks.
- **9** — Reasons about who bears the cost when the process fails — patient, clinician, or
  administrator — and designs the exception path around that rather than around convenience.

**5. Defense questions.**
- "Walk me through the exception you nominated. Who notices first?"
- "What does the person at the end of this process do differently because of it?"
- Follow-up one: "What did you change, and who pushed back?"
- Follow-up two: "Were they right?" — real process work has friction and the friction had a
  reason; a candidate who reports unanimous approval usually was not there.

**6. Failure modes caught.** Textbook workflows with no exceptions; candidates who cannot name
who the process burdens; process descriptions with no negotiation in them.

**7. What it cannot catch.** Whether the process was ever implemented, or whether the candidate
designed it or observed it. **The referral is the only mitigation** and it is load-bearing —
which is why it stays mandatory here.

**8. Requirement set.** `artifact(1) + defense + referral + hours(5)` — **unchanged**.

---

## `health-analytics` — Health data & analytics *(open)*

**1. The bar, and why.** Screens for analytical reasoning under the constraint that healthcare
data is messy in specific, known ways — missingness that is not random, coding that changes,
denominators that are hard to define. The discriminating skill is knowing what the data cannot
tell you.

**2. The submission.** An analysis on **Covenda-provided synthetic data by default**. A
student's own de-identified aggregate analysis is accepted but must clear the gate.

**3. What the machine checks.** PHI gate; formula integrity where a workbook is submitted.
Nothing about whether the analysis is sound.

**4. Anchored rubric.**
- **4** — Reports figures. Denominator unstated or wrong. Missingness ignored.
- **6** — Defines the population and denominator explicitly. Notes missing data and how it was
  handled.
- **9** — Reasons about *why* data is missing and whether that biases the result. States what
  the analysis cannot conclude.

**5. Defense questions.**
- "What is your denominator, and who did you exclude?"
- "Which of these missing values is missing for a reason?"
- Follow-up one: "How would that change your answer?"
- Follow-up two: "What would you need to check it?"

**6. Failure modes caught.** Rates without denominators; complete-case analysis with no
comment; candidates who treat clinical data as clean.

**7. What it cannot catch.** Domain intuition about which findings are clinically meaningful.
Not claimed.

**8. Requirement set.** `artifact(1) + defense + referral + hours(5)` — **unchanged**.

---

## `revenue-cycle` — Payer & revenue cycle *(open)*

**1. The bar, and why.** Screens for whether a candidate can trace a denial to its cause and
distinguish a coding error from a process failure from a payer behaviour. It is detective work
with financial consequences, and the discriminating experience is having recovered something.

**2. The submission.** A de-identified or synthetic denials analysis. Candidate nominates
**one denial pattern they traced to a root cause**.

**3. What the machine checks.** PHI gate; formula integrity. **Denial data is high-risk for
re-identification** — dates of service plus procedure codes plus a small facility is
identifying — so this specialisation should default to synthetic data more strongly than the
others.

**4. Anchored rubric.**
- **4** — Categorises denials by reason code. No causal analysis.
- **6** — Groups denials by root cause rather than code, and quantifies the recoverable
  portion.
- **9** — Distinguishes what is fixable upstream from what is payer behaviour to be managed,
  and states what the fix costs relative to what it recovers.

**5. Defense questions.**
- "Where in the process did `<their nominated pattern>` actually originate?"
- "Which of these denials should not be fought?" — the discriminator. Recovering everything is
  not the goal; knowing what to concede is.
- Follow-up one: "What would stop it happening again?"
- Follow-up two: "Why hasn't that been done?"

**6. Failure modes caught.** Reason-code reporting presented as analysis; candidates who treat
every denial as recoverable; no sense of cost-to-collect.

**7. What it cannot catch.** Whether they have worked with a real payer. Referral mitigates.

**8. Requirement set.** `artifact(1) + defense + referral + hours(5)` — **unchanged**.

---

## `regulatory-quality` — Regulatory & quality *(elite)*

**1. The bar, and why.** Screens for whether a candidate understands that a control is only
real if it is evidenced. The discriminating experience is having been asked to prove something
happened and finding there was no record.

**2. The submission.** A quality or compliance artifact — CAPA, audit prep, a control
description — plus a structured referral from whoever signed it off.

**3. What the machine checks.** PHI gate only.

**4. Anchored rubric.**
- **4** — Describes a requirement and a control. No evidence trail.
- **6** — Control has defined evidence and an owner. Can say how it would be demonstrated.
- **9** — Distinguishes a control that prevents from one that merely detects, and identifies
  where the evidence would be thin under real audit.

**5. Defense questions.**
- "If an auditor asked you to prove this happened last March, what would you show them?"
- "Which of your controls is detective rather than preventive?"
- Follow-up one: "Where would the evidence be thin?"
- Follow-up two: "What did you do about that?"

**6. Failure modes caught.** Controls with no evidence; candidates who cannot distinguish
prevention from detection; compliance-by-document.

**7. What it cannot catch.** Jurisdiction- and framework-specific expertise. Explicitly out of
scope.

**8. Requirement set.** `artifact(1) + defense + referral + hours(5)` — **unchanged**.

---

## `digital-health-product` — Digital health product *(open)*

**1. The bar, and why.** Screens for whether a candidate can reason about a product whose users
are constrained by clinical workflow and regulation — where the obvious UX improvement is often
prohibited, and the user is frequently not the buyer.

**2. The submission.** A product artifact — spec, flow, or research synthesis — with **the
constraint that shaped it stated explicitly**.

**3. What the machine checks.** PHI gate only.

**4. Anchored rubric.**
- **4** — Product thinking with no clinical constraint acknowledged. User treated as a
  consumer.
- **6** — Identifies the workflow or regulatory constraint and designs within it.
- **9** — Distinguishes the user, the buyer and the person who bears the risk, and can say
  whose interest the design serves when they conflict.

**5. Defense questions.**
- "Who is the user here, and who is paying?"
- "What would you build if the regulation did not exist, and why can't you?"
- Follow-up one: "Whose workflow does this add time to?"
- Follow-up two: "What did you decide not to solve?"

**6. Failure modes caught.** Consumer product thinking; designs that add clinician burden
invisibly; candidates who cannot separate user from buyer.

**7. What it cannot catch.** Regulatory depth. Out of scope and stated.

**8. Requirement set.** `artifact(1) + defense + referral + hours(5)` — **unchanged**.

---

## Recommendations arising from this pass

1. **Build the PHI intake gate before opening this batch.** It is the only place in the
   catalogue where a student error creates a legal problem for a third party. The refuse-list
   and the pattern scan are both small; the synthetic datasets are the real work and the real
   mitigation.

2. **Provide synthetic datasets per specialisation.** It removes the need for a student to
   de-identify anything, which removes the failure mode entirely rather than policing it. This
   is the highest-leverage item in this document.

3. **Accept Safe Harbor only, and say so.** Expert Determination requires an expert we cannot
   verify; accepting the assertion would be accepting the thing we are checking.

4. **Do not soften the human-rail language.** "No API verifies this; a person reads it against
   a published bar" is more credible than a machine-verification claim this vertical cannot
   support — and it is the sentence that makes the automated claims elsewhere believable.

---

## Sources

- [Accountable — *HIPAA De-Identification Safe Harbor Method: The 18 Identifiers You Must Remove*](https://www.accountablehq.com/post/hipaa-de-identification-safe-harbor-method-explained-the-18-identifiers-you-must-remove)
- [Accountable — *HIPAA De-Identification Requirements: Safe Harbor, Expert Determination, and Documentation*](https://www.accountablehq.com/post/hipaa-de-identification-requirements-safe-harbor-expert-determination-and-documentation)
- [Censinet — *18 HIPAA Identifiers for PHI De-Identification*](https://censinet.com/perspectives/18-hipaa-identifiers-for-phi-de-identification)
- [University of South Carolina IFS — *Guidelines and Methods for De-Identifying Protected Health Information*](https://ifs.sc.edu/resources/documents/USC_IFS_PHIDataDeIdentification_18_REV22.pdf)
- [Inside Privacy — *HHS Releases Guidance on HIPAA De-Identification Standard*](https://www.insideprivacy.com/health-privacy/hhs-releases-guidance-on-hipaa-de-identification-standard/)
