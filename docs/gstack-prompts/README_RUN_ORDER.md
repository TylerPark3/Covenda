# Covenda GStack Prompt Pack

This pack converts the Covenda master blueprint into a practical GStack workflow.

## Put the files in the repository

From the root of the Covenda repository:

```bash
mkdir -p docs/gstack-prompts
cp Covenda_MASTER_SPEC.md docs/COVENDA_MASTER_SPEC.md
cp COVENDA_GSTACK_CONTEXT.md docs/COVENDA_GSTACK_CONTEXT.md
cp -R prompts/* docs/gstack-prompts/
```

Add the contents of `CLAUDE_MD_SNIPPET.md` to the repository's `CLAUDE.md`.

## How to invoke a prompt

In Claude Code:

1. Type the listed GStack skill, such as `/office-hours`.
2. Press Enter.
3. Paste the contents of the matching prompt file.

If GStack was installed with namespaced commands, use `/gstack-office-hours`, `/gstack-review`, and so forth.

## Do not run everything at once

### One-time company and V1 planning sequence

1. `/office-hours` -> `01_OFFICE_HOURS.md`
2. `/plan-ceo-review` -> `02_CEO_REVIEW.md`
3. `/spec` -> `03_V1_SPEC.md`
4. `/plan-design-review` -> `04_PLAN_DESIGN_REVIEW.md`
5. `/plan-eng-review` -> `05_PLAN_ENG_REVIEW.md`
6. `/cso` -> `06_SECURITY_REVIEW.md`
7. `/qa-only` -> `07_BASELINE_QA.md`

Use the manual sequence above for the first V1 because the product has a large blueprint and several important scope conflicts.

### Per-feature implementation loop

For one feature at a time:

1. `/autoplan` -> `08_FEATURE_AUTOPLAN_TEMPLATE.md`
2. Implement the approved plan
3. `/review` -> `09_CODE_REVIEW.md`
4. `/codex` -> `10_CODEX_ADVERSARIAL_REVIEW.md`
5. `/qa` -> `11_QA_AND_FIX.md`
6. `/design-review` -> `12_LIVE_DESIGN_REVIEW.md` for UI work
7. `/benchmark` -> `13_PERFORMANCE_BENCHMARK.md` for performance-sensitive work
8. `/ship` -> `14_SHIP.md`
9. `/land-and-deploy` -> `15_LAND_AND_DEPLOY.md`
10. `/canary` -> `16_CANARY.md`
11. `/document-release` -> `17_DOCUMENT_RELEASE.md`
12. `/retro` -> `18_RETRO.md`

Do not run `/autoplan` after separately completing CEO, design, and engineering reviews for the same unchanged plan. It is the compressed replacement for those reviews during ordinary feature work.

## Recommended first feature backlog

1. Foundation audit and decision ledger
2. Authentication, roles, RLS, and audit events
3. Student identity, consent, and evidence cards
4. Company identity and manual Company DNA
5. Talent Briefs, shortlists, and introduction approval
6. Outcome collection and operator administration
7. Preliminary compatibility explanations
8. Repository verification and endorsements
9. One compensated paid-trial pilot
10. Software and AI evidence rails

## Utility prompts

- Bug investigation: `19_INVESTIGATE_BUG.md`
- New design direction: `20_DESIGN_CONSULTATION.md`
- Multiple visual concepts: `21_DESIGN_SHOTGUN.md`
- Approved mockup implementation: `22_DESIGN_HTML.md`
- Health dashboard: `23_HEALTH.md`
- Context handoff: `24_CONTEXT_SAVE.md`
- Learning capture: `25_LEARN.md`
- GBrain setup and sync: `26_GBRAIN.md`
