# GStack Prompt: CEO Review After Alan Zhang Analysis

## Put this into

```text
/plan-ceo-review
```

## Prompt

Review the strategic documents produced from the Alan Zhang advisor-feedback analysis.

Read:

- `docs/strategy/HIRING_MANAGER_WEDGE_REVIEW.md`
- `docs/strategy/VERTICAL_SELECTION_MATRIX.md`
- `docs/strategy/30_INTERVIEW_DISCOVERY_PLAN.md`
- `docs/strategy/CONCIERGE_PILOT_OPTIONS.md`
- `docs/strategy/ADVISOR_FEEDBACK_DECISION_LEDGER.md`
- `docs/COVENDA_MASTER_SPEC.md`
- the current product repository
- all previously approved V1 decisions

Do not write code.

Act as Covenda's CEO and force a decision about the next 30 days. The long-term blueprint is not automatically the current roadmap.

Decide:

1. Which single vertical should receive primary discovery attention?
2. Which exact internship or early-career role should be investigated?
3. Who is the first company-side user?
4. Who is the economic buyer?
5. What problem is Covenda solving first?
6. Which current product components remain relevant?
7. What should not be built before discovery?
8. What must be learned directly from hiring managers?
9. What evidence would cause Covenda to abandon the selected wedge?
10. What is the smallest manually delivered pilot?

The final output must include one-sentence positioning, initial vertical, initial role, initial user, economic buyer, student segment, company promise, student promise, concierge pilot, 30-day interview goal, 90-day outcome goal, explicit non-goals, decision ledger, and kill criteria.

Create or update:

- `docs/V1_DECISION_LEDGER.md`
- `docs/V1_MARKET_WEDGE.md`
- `docs/V1_DISCOVERY_PLAN.md`
- `docs/V1_PILOT.md`

Do not approve software implementation until the plan identifies which assumptions must be validated through direct customer discovery.
