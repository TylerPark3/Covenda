# INVESTIGATE BUG

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Investigate this Covenda bug without making a speculative fix.

BUG:
[INSERT OBSERVED BEHAVIOR]

EXPECTED:
[INSERT EXPECTED BEHAVIOR]

AFFECTED ROLE AND ROUTE:
[INSERT]

Read `docs/COVENDA_GSTACK_CONTEXT.md`, reproduce the problem, trace the full data flow, inspect logs, network, database state, RLS, audit events, and surrounding code.

Generate ranked hypotheses and test them one at a time.

Do not:

- patch symptoms before finding the root cause;
- weaken RLS to make the UI work;
- silently discard data;
- invent missing evidence;
- bypass consent or authorization.

After root cause is proven, propose the smallest safe fix, regression tests, migration or data repair if needed, and rollback.



---
