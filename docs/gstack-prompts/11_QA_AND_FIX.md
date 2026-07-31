# QA AND FIX

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Test and fix the implemented Covenda feature.

Read `docs/COVENDA_GSTACK_CONTEXT.md`, the approved feature plan, and the engineering-review test artifact.

Test the real browser flow for all affected roles.

Required coverage:

- happy path;
- first-use empty state;
- partial data;
- invalid input;
- network failure;
- duplicate action;
- stale record;
- revoked permission;
- unauthorized direct URL;
- mobile viewport;
- keyboard-only;
- refresh during operation;
- retry;
- browser back/forward;
- multi-tab behavior when relevant;
- audit event creation;
- RLS enforcement;
- no cross-tenant data access.

For every bug:

1. reproduce;
2. identify root cause;
3. fix in an atomic commit;
4. add a regression test;
5. re-run the full affected flow.

Do not change product scope during QA. Report unresolved blockers separately.



---
