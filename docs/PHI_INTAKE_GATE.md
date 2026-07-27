# The PHI intake gate

Why a healthcare exercise never contains patient data, and what stops one arriving by accident.

---

## The rule

**No student is ever asked to handle real patient data, and no company can supply it through
Covenda.** Not de-identified, not "just a sample", not with a signed agreement.

This is absolute and it is enforced in code, in `api/frameworks.js` → `checkAgainstEnvelope()`.

---

## Why it is absolute rather than managed

The usual argument for allowing it is that de-identification exists and agreements exist. Both
are true and neither survives contact with this specific situation:

1. **The student is not a covered entity or a business associate.** An undergraduate on a
   two-week trial has no compliance training, no institutional oversight, and no legal exposure
   they understand. Handing them PHI transfers risk to the person least equipped to carry it.

2. **De-identification is harder than it looks and everyone underestimates it.** Removing names
   is not de-identification. Dates of service, ZIP codes, and rare diagnoses re-identify people,
   and a founder in a hurry will send a spreadsheet believing it is clean.

3. **The failure is unrecoverable.** Most product mistakes can be fixed. A patient record on a
   student's laptop cannot be un-sent, and the harm lands on someone who was never party to any
   of it.

4. **It is not necessary.** Every healthcare exercise Covenda runs works on synthetic data.
   Nothing is being traded away.

A rule with exceptions becomes a rule someone argues about at 6pm on a Friday. This one has
none, so there is nothing to argue about.

---

## What the gate blocks

`checkAgainstEnvelope()` hard-refuses a brief containing any of:

- Patient records, encounters, claims tied to individuals
- Anything described as PHI, ePHI, or "de-identified patient data"
- Production access to an EHR, practice-management, or billing system
- Credentials of any kind
- Named individuals in a clinical context

The refusal is not a warning the company can dismiss. The brief does not proceed.

---

## What healthcare exercises use instead

Synthetic data, generated deterministically in `api/exercise-files.js`. It carries the *shape*
of real data, including the parts that make the work hard:

- **`health-analytics`** — a dataset where missingness is not random. The sickest patients are
  the ones with no follow-up recorded, so any complete-case analysis reports better outcomes
  than reality. That is the exercise.
- **`revenue-cycle`** — denials where one reason code hides three distinct causes, one of which
  only starts after a specific date.
- **`clinical-operations`** — an intake process with a bottleneck that moves when you staff
  around it.

None of it is derived from a real dataset. It is generated from a seed, which means it can be
regenerated, inspected, and published without anyone's permission.

---

## What a company may still supply

Healthcare companies have plenty of real work that contains no PHI:

- Published payer policies and reimbursement rules
- Their own public documentation, marketing, and pricing
- Aggregate operational metrics with no individual-level rows
- Regulatory text, standards, guidance
- Vendor documentation and integration specs
- Process descriptions, workflow maps, org structures

The envelope is a constraint on *data*, not on usefulness. Most of what a founder actually needs
help with is in the list above.

---

## What happens if it arrives anyway

Assume at some point a company uploads something it should not have.

1. The intake refuses briefs that describe PHI, which catches the deliberate case.
2. Uploads land in a **private** Blob store, never a public one, so a leaked URL is not a leaked
   file — reading requires an authorised, signed, short-lived URL (`api/media.js`).
3. If something is discovered after the fact: delete the blob, notify the company, and record it.
   Do not quietly remove it — a company that sent PHI by accident needs to know, because their
   obligations do not run through Covenda.

The third step is the one that is easy to skip and the one that matters.

---

## Where this connects

- `api/frameworks.js` → `checkAgainstEnvelope()` — the enforcement
- `api/exercise-files.js` — the synthetic generators
- `api/media.js` — private-store access control
- `docs/VETTING_HEALTHCARE.md` — the vetting design this sits inside
