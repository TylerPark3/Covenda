# V1 SPEC

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Turn the approved Covenda office-hours and CEO-review decisions into a precise, backlog-ready V1 specification.

Read:

- `docs/COVENDA_GSTACK_CONTEXT.md`
- the approved GStack product documents
- Chapters 12, 13, 16, 17, 25–30, 32, 34, 41, and 44 of `docs/COVENDA_MASTER_SPEC.md`
- the complete current repository

The V1 should cover only:

1. repository and live-app audit;
2. authentication and role authorization;
3. student identity, consent, and evidence cards;
4. company identity, verification, and manual Company DNA;
5. Talent Briefs;
6. evidence-based search or manual shortlist support;
7. introduction approval;
8. structured outcomes;
9. operator administration;
10. audit events.

Compatibility and automated verification may be designed as interfaces but should not be deeply automated until the concierge loop produces data.

For every requirement include:

- user story;
- requirement ID;
- rationale;
- preconditions;
- happy path;
- loading, empty, error, permission, and stale states;
- data created or changed;
- authorization rule;
- audit event;
- privacy/consent requirement;
- acceptance criteria;
- test plan;
- observability requirement;
- rollback or recovery behavior.

Create:

- system actors;
- domain entities;
- state machines;
- route inventory;
- API contracts;
- schema changes;
- RLS policy matrix;
- event taxonomy;
- admin workflow;
- analytics events;
- migration plan;
- seeded demo data plan;
- end-to-end test matrix;
- launch checklist.

Map every proposed change as:

Existing abstraction -> requirement -> gap -> change -> migration -> test.

Do not code yet. File or structure the resulting work as independently shippable backlog items in dependency order.



---
