# Covenda — Website Realignment Prompt (Master Brief)

**Status:** supersedes the framing in `POSITIONING_PROMPT.md` where they conflict. That doc's
audience narratives and grounding discipline still apply; this one sets the *new outlook* —
startup-first, proof-precedes-access, staked referrals — and tells you what to change to align
the site and portal to it.

**How to use:** this is the instruction set for a major site + portal realignment. Read the
thesis and the "what changed" section, then execute the concrete changes. Nothing external
(stat, partnership, count) ships until it clears the **Grounding checklist** at the end.
`[T]` marks the founder's own thesis; `[R]` marks prior Claude research/pressure-testing —
keep them distinct in any external copy (never present `[R]` figures as Covenda's own).

---

## 0. The thesis in one line
**Covenda is a curated batch of professor- and club-vouched, high-capability students who earn
their way in through bounded work-trials and compound that into a verified, rubric-scored
record within a vertical — built for startups that hire on proof, not résumés.**

The product is **curation + proof**, not distribution. The buyer wedge is **startups**. The
growth channel is **staked referrals**. Everything on the site should ladder up to those three.

---

## 1. What changed vs the current site (the realignment) `[T]` + `[R]`

The site today already says a lot of this. The realignment sharpens five things:

1. **Startup-first, explicitly.** Market primarily as a **startup ↔ student** platform. Drop the
   wealth-management / family-office / "small projects for small firms" framing from the lead
   narrative. **No exposure to finance internships** as a category. *(Tension to resolve — see §7:
   the accounting/finance-ops wedge in `GTM_ACCOUNTING_WEDGE.md`. Finance-*ops project work* for a
   small team is not finance recruiting, but the lead story must not read as "finance interns.")*

2. **The model is a work-trial ladder, not "task forces."** `[R]` Stage 1 = a bounded deliverable
   with **no systems access**; Stage 2 (deeper integration, access) unlocks only after a strong
   Stage 1. **Proof precedes access** — this resolves the "unvetted undergrad can't be net-positive
   / security risk" objection structurally rather than with a promise. The portal's existing
   packet → escrow → reviewed-deliverable flow *is* Stage 1; name the ladder and show Stage 2 as
   earned.

3. **Referrals are a staked-reputation *channel*, not university partnerships.** `[R]` A referral is
   a wager: the referrer's visible score rises or falls with the outcome. Professors, club officers,
   and industry pros vouch for people they can actually speak to. This is why the audience formerly
   called **"Educators" is now "Referrals."** Do **not** position around institutional/career-center
   partnerships — that is Handshake's game and it imports their constraint (see §4).

4. **Foreground proof-of-work: GitHub, portfolios, the verified record.** `[R]` 67% of early
   startups do "firm-driven search" — founders hunt for visible GitHub/portfolios and *pull*
   people in. The student profile and public talent view should lead with a repo/portfolio/
   reviewed-work record, not a résumé.

5. **Language cleanup.** `[R]` Retire "curated repository segmented into task forces" (reads as
   inventory-of-people) and "multi-sided referral flywheel." Use: **verified talent batches by
   vertical**, **proof of work**, **work-trial**, **staked referrals with accountability scoring**.

---

## 2. The problem & why now (source narrative for the "Why now" surfaces) `[T]`
- Hundreds of thousands of high-capacity undergraduates want real professional experience; the
  internship system is broken by long-seated bias — fear that training an intern is wasted when they
  return to being a student or leave (the "~60% return-to-company" figure is **[grounding flag]**).
- AI has raised **talent-per-student** (a motivated undergrad now contributes real work) while
  simultaneously **poisoning sourcing**: mass AI-generated applications make Handshake and cold
  outreach expensive and low-signal for HR and founders.
- The smartest students increasingly want **startups over the finance treadmill**, but startup
  access runs on personal connection + YC-board postings (a narrow cohort).
- The private workaround — founders sourcing through **professor/club referrals** (the Rootic
  operator) — is what Covenda universalizes.

Keep the honest note that these cite published research, not Covenda outcomes.

## 3. Company value proposition (what the company surfaces must say) `[T]`
- **Skills over résumés.** `[R]` NACE Job Outlook 2026: ~70% of employers use skills-based hiring
  (up from 65%) — **verify exact figure/year before publishing.**
- **AI-poisoned résumés are a filtering tax;** Covenda removes it — a short, vouched, reviewed
  shortlist, not a spam pile.
- **Time-flexible trial runs, not manufactured intern roles.** A startup runs a low-risk work-trial
  with top talent tied to real roadmap work, instead of inventing an intern-shaped role.
- Reduced burden + shifted risk (ties to the existing pay-on-acceptance / packet / escrow model).

## 4. Handshake positioning that survives their pivot `[R]`
Handshake's structural constraint: **universities are their customer**, which forces breadth,
neutrality, and every-student inclusion. Their Nov-2025 "refounding" concedes small companies get
crowded out and neither side has skill signal. Covenda's advantage is a **posture they cannot
adopt** — hard curation, rankings, and reputations that can fall — **not a feature they lack**.
Frame the contrast as "open marketplace vs. curated batch," never naming them disparagingly.
**Corollary:** heavy career-center / university GTM imports the same breadth constraint — so the
site should *not* lean on institutional partnerships as the story. (Flag the tension with the
earlier `covenda-outreach` career-center plan.)

---

## 5. Concrete changes, mapped to what exists now

**Marketing (`index.html` / `styles.css` / `app.js`):**
- **Student hero** (vertical-first domain narrowing) → keep, but frame the payoff as the
  **work-trial ladder + verified record**, and make GitHub/portfolio a first-class signal, not a
  later profile field. Message: *"Stop cold-DMing founders. Prove it once, and be pulled in."*
- **Company hero** (two segments: delegate backlog → *Create Project*; find elite talent) → keep the
  two-segment structure; rewrite copy to **startup trial-run** language and skills-over-résumés.
- **Referrals hero** (formerly Educators) → rewrite as the **staked-referral channel**: a vouch is a
  wager, your score moves with outcomes. Remove any "institutional partnership" implication.
- **Contrast section** ("the pile vs. Covenda") → keep; sharpen to "open marketplace / AI-spam pile"
  vs. "vouched, reviewed, curated batch."
- **Why-now stat band** → keep the four grounded stats; only add new figures that clear grounding.
- **Covenda tree / "The Covenda Model"** → re-caption around **proof precedes access** (roots =
  vouch, trunk = work-trial, canopy = verified record).

**Portal (`portal.*`, `api/portal.js`):**
- Name the **work-trial ladder** in the projects/packets UI: Stage 1 (bounded, no access) → Stage 2
  (deeper access, earned). The packet/escrow flow already implements Stage 1.
- **Verified record within a vertical:** show completed reviewed work compounding into a rubric-
  scored proof record (differentiates from Parker Dewey's one-shot generalist projects). `[R]`
- **Staked referrals:** referrer score visibly tied to referred-student outcomes (Phase 1 manual
  curation; Phase 2 staked once scores are meaningful). Build the surface; gate the scoring on real
  outcomes only.
- **Batches** (already redesigned: expandable cards, assigned 5-min video prompt, interest
  questions) → keep; make each batch a **vertical batch** with a domain rubric.
- **Student profile editor** → the near-term "make it fun + easier" work: chip-based, add club
  activities (structured: club, role, dates), live completeness/credibility meter driven by **real
  inputs only** (verified vouches, reviewed work, real endorsements) — never fabricated exit/LinkedIn
  stats.

**Pricing (the pilot's actual purpose):** `[R]` run a **pricing experiment** — ~10–15 firms in one
vertical, three price points (commodity control / 2–3× curated premium / success-fee hybrid). The
single most valuable datapoint this year: **does the premium tier convert?** Keep the credit system;
instrument the experiment.

---

## 6. Positioning guardrails (unchanged, load-bearing)
- **Nothing fabricated.** No stat/partnership/count/outcome ships unverified. Pilot framing only;
  Covenda has no outcome data yet.
- **Anti-spam is the whole point** — never add features that reward volume or make AI mass
  applications easier. (The application should demand *signal*: vouch, video, work samples, rubric.)
- **Never charge students.**
- **Curation is the product** — say plainly that Covenda is selective; exclusivity is the value.

## 7. Tensions to resolve before/while executing
1. **Finance wedge vs. "no finance exposure."** `GTM_ACCOUNTING_WEDGE.md` targets accounting/
   finance-ops project work for small firms; the new lead is startup-first with no finance-internship
   exposure. Decide: is accounting-ops kept as *one vertical batch* (fine) while the **headline**
   narrative is startups? Recommended: yes — demote finance-ops from lead story to one vertical.
2. **Career-center GTM vs. Handshake corollary (§4).** The `covenda-outreach` plan leans on
   educators/career centers. Reconcile: keep professor/club outreach as **staked-referral sourcing**
   (individuals vouching), not institutional partnerships/distribution deals.

## 8. Grounding checklist (consolidated research flags — verify each before it ships)
| Claim | Status |
|---|---|
| ~60–62% intern → company return/conversion rate | **NEEDS SOURCE** (asserted; unverified) |
| Enterprises mass-spending on AI agents/tools | **NEEDS SOURCE** (Menlo: $11.5B→$37B GenAI spend '24→'25 is the closest verified figure) |
| SWE layoffs rebounding as full automation proves false | **NEEDS SOURCE / frame as founder view** |
| Smartest students shifting startups over finance | **NEEDS SOURCE / frame as founder view** |
| NACE Job Outlook 2026 — ~70% skills-based hiring (up from 65%) | **VERIFY** exact figure + year |
| Handshake: 950k+ employers, ~$12k–$100k+ enterprise pricing, 8:1→3:1 ratio, Nov-25 refounding | **VERIFY** before publishing |
| 67% of early startups do "firm-driven search" | **VERIFY** source |
| Referral retention (46% vs 33%; 88% rate referrals highest-ROI) | **VERIFY** — traces mostly to 2012 Jobvite; describes *coworker* referrals, not peer-to-peer student |
| Parker Dewey micro-internship economics ($200–600, 10–40 hrs) | **VERIFY** if cited externally |

Verified so far (usable, cite the source): 273 applications/tech-internship posting, +69% YoY
(Handshake Internships Index 2025); NACE 63.1% intern→FT conversion, 88.3% acceptance (2024–25);
Menlo enterprise GenAI spend $11.5B→$37B ('24→'25); the four "Why now" band stats already live.

## 9. Competitors (track; build out)
- **Handshake** — incumbent; refounding around short-term/gig + AI; constrained by university-as-
  customer.
- **Parker Dewey** — micro-internships; closest *format* analog; one-shot generalist (Covenda's
  differentiator: progression + rubric-scored vertical record). `[R]`
- **Pangea.app** — cautionary analog (student↔SMB marketplace; stalled ~$50–100K monthly GMV). `[R]`
- **Mercor / Micro1** — vetted talent marketplaces that scale, but buyers are AI labs with huge
  budgets (different buyer than Covenda). `[R]`
- **Litmus** (YC S26, Columbia founders) — hiring-assessment comparable.
- **Riipen / Break Through Tech** — course-embedded project intermediaries — **potential partners**
  (rubric validation / course-embedded sourcing), more than competitors. `[R]`

---

## Copy bank (student voice — implement where it lands)
- **"I know I could contribute to this startup, but I don't know how to get in front of the
  founder."** — the exact pain Covenda removes; strong candidate for the student hero or the
  contrast section. (Per Tyler; hold for a good placement.)

### The unproven crux (say it plainly internally)
`[R]` The weakest links are **small-firm willingness-to-pay** (Pangea stalled exactly here) and
**peer-to-peer referral as a *predictive* signal** (no research validates it; referral data is about
coworkers). So the pilot's job is narrow and specific: **prove the premium tier converts in one
vertical, and prove a staked vouch predicts outcomes.** The website should sell the posture; the
pilot should test the economics.
