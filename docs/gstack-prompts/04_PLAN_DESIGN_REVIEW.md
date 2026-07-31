# PLAN DESIGN REVIEW

> Source: Covenda GStack Prompt Pack. Paste into the matching GStack skill.

Perform a senior product-design review of the approved Covenda V1 plan before implementation.

Read:

- `docs/COVENDA_GSTACK_CONTEXT.md`
- the approved V1 spec
- Chapters 12–17, 28, and 41 of `docs/COVENDA_MASTER_SPEC.md`
- the current UI implementation
- the live product at `https://covenda.app`

Review these surfaces:

- public landing page;
- student onboarding;
- student evidence profile;
- evidence graph or evidence explorer;
- company onboarding;
- manual Company DNA interview;
- Talent Brief creation;
- shortlist review;
- introduction approval;
- student visibility and consent;
- outcome collection;
- operator/admin review.

The design hierarchy must be evidence-first. The student profile should feel like a living professional body of work, not a résumé form or generic SaaS dashboard. Company views should explain why evidence is relevant without reducing a person to one score.

For every surface, specify:

- primary user intent;
- information hierarchy;
- primary and secondary actions;
- navigation;
- loading state;
- empty state;
- error state;
- partial-data state;
- stale-data state;
- permission state;
- verification state;
- mobile behavior;
- keyboard behavior;
- accessibility labels;
- destructive-action confirmation;
- success feedback;
- audit visibility where appropriate.

Audit for AI-generated visual clichés, including excessive gradients, generic card grids, decorative icon overload, empty marketing language, and unexplained scores.

Preserve the current brand where it is intentional, but do not preserve weak UX merely because it exists.

End with:

1. ratings by design dimension;
2. resolved design changes;
3. unresolved taste decisions for Tyler;
4. screen-by-screen implementation requirements;
5. component inventory;
6. responsive and accessibility acceptance criteria.



---
