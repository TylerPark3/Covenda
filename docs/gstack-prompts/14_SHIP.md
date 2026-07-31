# SHIP

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Prepare the current Covenda branch for a pull request.

Read the approved plan and `docs/COVENDA_GSTACK_CONTEXT.md`.

Before opening the PR:

- sync with main safely;
- run lint, typecheck, unit tests, integration tests, browser tests, and production build;
- validate migrations;
- validate RLS;
- confirm no secrets or private student/company data are committed;
- verify acceptance criteria;
- verify docs are updated or list the required doc follow-up;
- audit test coverage for critical state and permission paths.

The PR description must include:

- user problem;
- scope;
- non-goals;
- screenshots for UI work;
- schema and migration changes;
- RLS changes;
- audit events;
- security/privacy/fairness/accessibility impact;
- tests;
- rollback;
- known limitations;
- master-spec requirements satisfied.



---
