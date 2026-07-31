# CODE REVIEW

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Review this branch as a staff engineer against the approved Covenda plan and product invariants.

Read `docs/COVENDA_GSTACK_CONTEXT.md`, the relevant approved plan, the diff, tests, migrations, and surrounding code.

Check for:

- contradiction with Covenda decisions;
- replacement of existing abstractions without justification;
- missing evidence provenance;
- hidden or universal ranking;
- treating missing evidence as weakness;
- prestige proxies;
- referral gating;
- unpaid productive labor;
- verification overclaim;
- hallucinated evidence explanations;
- broken consent or visibility;
- missing RLS;
- tenant leakage;
- missing audit events;
- invalid state transitions;
- race conditions;
- idempotency failures;
- migration safety;
- rollback gaps;
- incomplete loading, empty, error, stale, and permission states;
- accessibility regressions;
- mobile regressions;
- inadequate tests;
- code duplication;
- overbuilt V1.

Auto-fix only obvious, low-risk defects. Flag architectural or product decisions for approval.

End with:

- blocking findings;
- non-blocking findings;
- fixes made;
- tests run;
- residual risks;
- pass/fail ship recommendation.



---
