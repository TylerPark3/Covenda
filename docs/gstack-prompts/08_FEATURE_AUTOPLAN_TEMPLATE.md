# FEATURE AUTOPLAN TEMPLATE

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Plan exactly one Covenda feature. Do not expand the task into the whole platform.

FEATURE:
[INSERT ONE FEATURE, such as "student evidence cards and consent controls"]

OBJECTIVE:
[INSERT THE USER OUTCOME]

Read:

- `docs/COVENDA_GSTACK_CONTEXT.md`
- the approved V1 spec
- the relevant sections of `docs/COVENDA_MASTER_SPEC.md`
- the actual implementation and tests related to this feature

Run CEO, design, engineering, and developer-experience review as one pipeline.

Binding constraints:

- extend existing abstractions;
- evidence-first;
- no universal score;
- missing evidence is uncertainty;
- paid trials and referrals remain optional;
- no prestige proxies;
- privacy, consent, RLS, and audit are first-class;
- support loading, empty, error, stale, permission, and mobile states;
- include migration and rollback;
- do not build later-stage features unless needed as a clean interface boundary.

Return:

1. user problem and narrow feature contract;
2. scope and non-goals;
3. exact files and abstractions inspected;
4. data model and state transitions;
5. UI and interaction states;
6. API and authorization;
7. security/privacy/fairness/accessibility;
8. test plan;
9. observability;
10. implementation steps in small commits;
11. acceptance criteria;
12. open decisions requiring Tyler.



---
