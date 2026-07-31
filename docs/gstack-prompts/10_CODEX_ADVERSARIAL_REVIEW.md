# CODEX ADVERSARIAL REVIEW

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Use Codex as an independent adversarial reviewer of the current Covenda branch.

Read:

- `docs/COVENDA_GSTACK_CONTEXT.md`
- the approved feature plan
- the branch diff
- migrations and RLS
- tests
- affected user journeys

Challenge the implementation from five perspectives:

1. Staff engineer: correctness, concurrency, migrations, rollback, maintainability.
2. Security reviewer: tenant isolation, authorization, uploads, secrets, abuse.
3. Product skeptic: does this actually advance the V1 transaction?
4. Fairness reviewer: hidden ranking, prestige proxies, missing-evidence penalties, discriminatory filters.
5. Student/company user: confusing states, misleading claims, lost consent, inaccessible UX.

Look specifically for defects that the primary model may have rationalized away.

Return a strict pass/fail gate with evidence, reproduction steps, and the smallest acceptable fixes.



---
