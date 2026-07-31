# BASELINE QA

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Perform a report-only baseline QA audit of the current Covenda application before V1 changes.

Do not modify code.

Read `docs/COVENDA_GSTACK_CONTEXT.md`, inspect the repository, run the app locally, and test the live product at `https://covenda.app`.

Cover:

- every public route;
- every portal route;
- student flow;
- company flow;
- educator/partner flow;
- local draft behavior;
- form validation;
- submission receipts;
- navigation;
- browser refresh;
- back/forward navigation;
- mobile widths;
- keyboard-only use;
- screen-reader semantics;
- slow network;
- failed network;
- duplicate submissions;
- stale data;
- unauthorized access;
- direct URL access;
- Supabase failures;
- empty states;
- placeholder and illustrative content.

For each visible feature classify it as:

- production functional;
- partially functional;
- local preview only;
- illustrative;
- future gated;
- broken;
- unknown.

Run and report:

- install command;
- dev command;
- lint;
- typecheck;
- tests;
- production build;
- browser test commands.

Create a prioritized baseline report with reproducible steps, screenshots where useful, severity, affected users, and recommended owner. Do not fix issues in this run.



---
