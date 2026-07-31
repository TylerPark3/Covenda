# SECURITY REVIEW

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Run a full security and privacy review for the Covenda V1 plan and current repository.

Read:

- `docs/COVENDA_GSTACK_CONTEXT.md`
- the approved V1 spec and engineering plan
- Chapters 23, 24, 25, 26, 27, 28, and 34 of `docs/COVENDA_MASTER_SPEC.md`
- the complete repository and Supabase migrations/policies

Threat-model these actors and assets:

Actors:
- anonymous visitor;
- student;
- company user;
- educator or partner;
- operator/admin;
- malicious student;
- malicious company;
- compromised account;
- external integration;
- automated agent.

Assets:
- identity data;
- educational records;
- résumés and transcripts;
- GitHub and portfolio connections;
- private evidence;
- recommendations and endorsements;
- Company DNA;
- shortlists;
- compatibility explanations;
- introduction decisions;
- outcome records;
- audit logs;
- uploaded files;
- secrets and service-role keys.

Audit:

- authentication;
- session management;
- authorization;
- Supabase RLS;
- insecure direct object references;
- tenant isolation;
- storage bucket policies;
- upload validation;
- malware risk;
- XSS;
- injection;
- CSRF where applicable;
- SSRF;
- secret leakage;
- logging of sensitive data;
- admin privilege escalation;
- consent bypass;
- stale permissions;
- data export and deletion;
- rate limits;
- abuse;
- discriminatory company filters;
- hidden ranking;
- unpaid trial abuse;
- audit tampering.

Produce:

1. OWASP findings;
2. STRIDE model;
3. data classification;
4. trust-boundary diagram;
5. severity-ranked findings;
6. exact code and policy fixes;
7. tests for each critical or high finding;
8. launch blockers;
9. residual risk;
10. security acceptance gate for Phase 0.



---
