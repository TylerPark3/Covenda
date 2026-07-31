# Covenda GStack Context

## Product thesis

Covenda is an evidence-based talent discovery and verification platform for undergraduate and early-career talent.

Covenda helps students build a living professional identity from demonstrated work, verified evidence, interests, goals, endorsements, and outcomes. Companies discover and evaluate students through explainable, company-specific compatibility rather than résumé keyword matching or mass applications.

Tagline:

> Stop applying. Start getting discovered.

## Core product law

Every meaningful interaction should create knowledge that improves the next decision.

Long-term loop:

```text
Evidence
-> capability understanding
-> Company DNA
-> compatibility
-> evaluation
-> outcome
-> institutional learning
-> better future decision
```

## What Covenda owns

- Evidence aggregation and provenance
- Verification and authorship confidence
- Company-specific compatibility
- The candidate's verified professional profile
- Explainable company-facing talent intelligence
- The connection between demonstrated capability and real company needs

## What Covenda must not become

- A generic job board
- An ATS clone
- A universal student-ranking system
- A résumé keyword scorer
- A traditional testing company
- A project marketplace that requires every company to create paid work
- A referral-gated network
- A system that rebuilds commodity assessment or identity infrastructure

## Non-negotiable product decisions

1. Inspect and extend the existing Covenda app. Do not rebuild from scratch.
2. Treat the repository and live app at `https://covenda.app` as the current implementation baseline.
3. Read `docs/COVENDA_MASTER_SPEC.md` before making architectural decisions.
4. Paid trials are optional evidence mechanisms, not the definition of Covenda.
5. Referrals and endorsements are optional context, never required access.
6. Compatibility is company- and role-specific, explainable, and separate from admission.
7. Do not expose a universal student score.
8. Missing evidence is uncertainty, not evidence of low ability.
9. Store evidence and provenance, not only aggregate scores.
10. Every evidence claim must state what it proves, what it does not prove, how it was verified, and remaining uncertainty.
11. Do not use protected attributes or prestige proxies.
12. No unpaid productive trial work.
13. Human operators retain authority for high-stakes decisions and appeals.
14. Student consent and visibility controls are first-class.
15. Supabase authorization must be enforced through Row Level Security, not only frontend checks.
16. All important state transitions need audit events.
17. Use current official sources for vendor, API, legal, privacy, and security claims.
18. Build the narrowest coherent product that proves the core transaction.
19. Do not expand the batch system or all 25 verticals in V1.
20. Validate Software and AI first after the foundation and concierge marketplace work.

## V1 from the master roadmap

### Phase 0: Foundation

- Authentication
- Student profile
- Company profile
- Evidence cards
- Consent and privacy
- Company verification
- Talent Brief
- Introduction approval
- Audit trail
- Basic administration

Exit gate:

- Complete student and company walkthroughs
- No critical privacy or safety gaps
- Example profiles are understandable without founder explanation

### Phase 1: Concierge marketplace

Target:

- 25–50 students
- 5–10 companies
- Manual Company DNA
- Manual evidence review
- Manual shortlists
- Approved introductions
- Outcome collection

Product:

- Simple student, company, and operator dashboards
- Evidence filters
- Shortlists
- Communication only after introduction approval
- Structured outcome forms

### Later phases

- Phase 2: explainable compatibility and verification
- Phase 3: paid trials and Work Records
- Phase 4: first shared simulation engine
- Phase 5: Software and AI batch
- Additional verticals only after stage-gate evidence

## First implementation sequence

1. Audit the current repository and live app.
2. Confirm framework, routes, data model, Supabase schema, RLS, storage, auth, local drafts, and deployment.
3. Create a decision ledger mapping the existing app to the master spec.
4. Implement real authentication, roles, permissions, and audit events.
5. Implement student evidence profiles and consent.
6. Implement company profiles and a manual Company DNA interview.
7. Implement Talent Briefs, shortlists, and introduction approval.
8. Implement outcome tracking and basic operator administration.
9. Only then introduce preliminary compatibility and verification.
10. Add paid trials only after the discovery and evaluation loop works.

## Required agent output

Every planning, implementation, or review response must include:

1. Summary
2. Files inspected
3. Existing abstraction -> requirement -> gap -> change -> migration -> test
4. Decisions and assumptions
5. Implementation or plan
6. Tests and validation
7. Security, privacy, fairness, and accessibility impact
8. Limitations
9. Next required action


---
