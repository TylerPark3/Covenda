# PLAN ENG REVIEW

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Act as Covenda's engineering manager and turn the approved V1 spec into a buildable technical plan.

Before proposing architecture:

1. Read `docs/COVENDA_GSTACK_CONTEXT.md`.
2. Read the approved office-hours, CEO, spec, and design documents.
3. Read Chapters 5–10, 22–28, 32, 34, 41, 43, and 44 of `docs/COVENDA_MASTER_SPEC.md`.
4. Inspect the entire repository.
5. Identify the actual framework, routes, package manager, deployment platform, Supabase setup, schema, migrations, RLS, storage, auth, API patterns, local-storage behavior, tests, and CI.
6. Inspect any existing files named or analogous to:
   - `api/batches.js`
   - `api/connectors.js`
   - `api/hardening.js`
   - `api/xlsx-parse.js`
   - `docs/PROOF_CONNECTORS.md`
   - `docs/MODEL_CARD.md`
   - `docs/COMPATIBILITY_ENGINE_MASTER.md`

Do not invent a replacement architecture from memory.

Create an implementation plan for:

- users and identities;
- student, company, partner, and operator roles;
- consent and profile visibility;
- evidence objects and provenance;
- evidence relationships;
- company verification;
- Company DNA versions;
- Talent Briefs;
- shortlists;
- introduction approval;
- outcomes;
- audit events;
- notifications;
- operator review.

Include:

- component diagram;
- data-flow diagrams;
- state diagrams;
- trust boundaries;
- RLS matrix;
- schema and migration sequence;
- API contracts;
- background jobs;
- idempotency;
- retries;
- optimistic concurrency;
- file storage and scanning;
- rate limiting;
- observability;
- feature flags;
- seed data;
- rollback;
- unit, integration, browser, and security tests.

Explicitly distinguish:

- V1 implemented now;
- interface prepared for Phase 2;
- long-term architecture deferred.

End with a dependency-ordered implementation plan containing small coherent pull requests.



---
