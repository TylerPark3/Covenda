# ProofPath prototype — editor handoff

Updated: July 17, 2026

## Purpose

This prototype demonstrates the current ProofPath thesis: **the core product is managed problem-to-project design, not matching**. ProofPath reconstructs a recurring internal problem, isolates the safe work unit, and converts it into a funded Project Packet that an outside student can complete without consuming more employer time than the work saves.

**July 17 alignment decision:** lead with the employer's last real problem, use the de-identified onboarding bottleneck map as the flagship accounting example, and expose only Accounting Operations plus the bounded Wealth Operations second path. Review-note analysis remains a higher-risk later use case; AI and science paths are not active lanes.

**Development status: evidence-gated freeze with bounded lead capture.** The prototype is already sufficient for sales explanation and workflow discussion. The employer intake, student interest form, and call-request flow now persist minimal submissions so founder-led customer discovery can happen. Until ProofPath records customer interviews, convertible tasks, funded pilots, accepted work, and repeat or candidate-advancement behavior, make only factual corrections, broken-flow repairs, accessibility fixes, safety changes, or edits required by a real employer conversation. Do not add a native calendar, certificate program, generalized score, broad matching, marketplace features, or automated project generation merely because the prototype can depict them.

The public entry now follows a deliberately sparse, statement-led structure inspired by the functional restraint of Litmus Hiring and Soar: one promise, four numbered handoffs, one proof statement, two audience outcomes, three labeled planning targets, and one repeated action. The scheduling flow collects a preferred date and time and clearly says that ProofPath must confirm it by email; it does not claim live calendar availability or create an invitation. The rounded visual layer borrows only general principles from Apple's material guidance and Polymarket's compact information hierarchy: translucent material is reserved for navigation and controls, while product content stays on calm, high-contrast surfaces. ProofPath does not copy any reference's branding, imagery, claims, customers, or product mechanics.

## Live lead capture

Three forms send JSON to `POST /api/submissions` and store one private JSON blob per submission:

1. **Employer intake** — contact details plus the bounded problem, expected output, reviewer, acceptance rule, budget, and safety choices.
2. **Student interest** — name, email, school, level, task interest, availability, and an 18-or-older confirmation. No résumé upload.
3. **Call request** — name, work email, company, topic, preferred date/time, and browser timezone. It is a request until confirmed by email.

Each successful submission returns a reference beginning with `EMP-`, `STU-`, or `CALL-`. Records are stored under `submissions/<type>/YYYY/MM/DD/` in the private Vercel Blob store. Retrieve them from the Vercel project’s Storage tab. Do not expose `BLOB_READ_WRITE_TOKEN`, private blob URLs, or the stored JSON through a public endpoint.

The endpoint rejects cross-origin browser posts, oversized payloads, a filled honeypot, implausibly fast posts, missing consent, malformed email addresses, production access, client records, and regulated decisions. It stores no uploaded files and no IP address. This is basic MVP abuse resistance, not a substitute for production authentication, retention controls, or a formal privacy program.

The simple overview leads into three connected role views:

1. **Employer** — last-instance discovery, generated Problem Brief and Talent Requirement Card, a sourced national talent-depth view, five consequential approvals, transparent evidence slate, short work intake, generated Project Packet, safety gate, funding simulation, employer-time metrics, and outcome decision.
2. **Student** — one intent question, one matched illustrative role path, a four-step journey, and one compact role-path application. Project examples, evidence progression, Proof Profile controls, the agreement gate, and the assigned workspace remain available through progressive disclosure.
3. **ProofPath operations** — template versions, demand gates, review queue, evidence-backed credential controls, immutable session audit, privacy blocks, and employer-leverage metrics.

## Qualification and verified-evidence demo

The prototype now models five distinct evidence states. They are deliberately role-specific and cannot be collapsed into one universal score:

1. **Explorer** — self-reported profile context only.
2. **Applicant** — application recorded against a demand-backed Batch.
3. **Role-Qualified** — a human-reviewed synthetic work sample produced active evidence for Accounting Operations.
4. **Employer-Verified** — a paid-project deliverable was accepted by the named employer reviewer.
5. **Proven** — accepted work was followed by a stronger recorded outcome such as an interview, referral, or follow-on offer.

The employer side starts with the last real instance of a recurring problem and drafts a Problem Brief plus Talent Requirement Card. A candidate slate appears only after the employer approves must-haves, the information boundary, the exact agreement version, the reviewer, and project funding. Candidate explanations name the task family, evidence source, observer, observation date, missing evidence, and risk rather than presenting a percentage or unexplained rank.

The student side shows task, time, tools, privacy constraints, AI policy, retake rule, accommodation path, and rubric before the synthetic work sample. The result preserves dimension-level evidence, one explicitly unassessed dimension, correction and appeal controls, renewal and limitation language, and student-controlled sharing. Self-reported and external evidence remain separate.

The versioned agreement gates only the approved private Context Pack. It never overrides the project's information boundary. Accepted project evidence cannot be silently replaced by a later pass decision; consequential corrections move through Operations with an operator, reason, and supporting evidence.

For inspection, the local records are exposed at `window.PROOFPATH_DEMO_MODEL`. The object includes StudentProfile, RolePath, Batch, Application, WorkSample, RubricVersion, AssessmentAttempt, EvidenceItem, Credential, TalentBrief, TalentRequirementCard, Project, CandidateMatch, Agreement, AccessGate, SubmissionVersion, WorkRecord, EmployerReview, OutcomeEvent, and AuditEvent.

## Presentation rules

- Explain the product before exposing the operating interface.
- Use one strong accent, black text, consistent rounded geometry, and restrained depth instead of decorative card grids. Reserve translucent glass for navigation, controls, and dialogs; keep reading surfaces nearly opaque and high contrast.
- Preserve the two-part wordmark: **Proof** stays upright black; **Path** is italic blue with a dark edge and no neon glow. Keep it legible at navigation size and avoid decorative flicker.
- Keep one persistent pale-blue caret beside the second intro line from its first typed character through the final blinking state. Do not swap to a differently sized or offset cursor after the last letter.
- Keep the homepage statement-led; detailed controls belong inside the role demos.
- Keep the student entry in this order: one intent question → one matched illustrative path → four clear moves → one compact role-path application. Put project grids, evidence states, Proof Profile controls, and the assigned workspace behind rounded disclosure rows until the student asks for them.
- The intent field is local demo routing, not AI matching or a live opportunity search. Accounting, research, and workflow interests route to the current Accounting Operations example; wealth and finance interests route to the closed Wealth Operations path. The student still chooses whether to apply.
- Lead student decisions with the role, pay, expected time, qualification step, and safe-input boundary. Keep AI policy and demand mechanics available as secondary detail instead of competing with the next action.
- State the decision rights plainly: students choose every application, employers make final selections, and accepted work can become student-controlled evidence. Never imply guaranteed placement.
- Keep “No posting.”, “No guessing.”, and “See the work.” on three separate block lines with visible vertical spacing. Never tighten that statement until the letterforms overlap.
- Pair that statement with the briefcase figure as an editorial people moment: an off-white field, a black suit, a restrained blue briefcase, and a translucent blue shirt/vest beneath the jacket. Keep the original face, pose, formal silhouette, and black linework intact. Keep the figure to the right on desktop and below the statement on mobile; do not turn it into a profile card, testimonial, or claimed user.
- Keep the two homepage tickers short and news-like, immediately above the three proof points: the company row first, using a pale-blue label and charcoal moving lane, then the talent row, using a charcoal label and white moving lane. Use only ProofPath charcoal, white, cool gray, and restrained blue here—never neon, tan, or brown. Both rows must clearly disclose that no partnership is being claimed until a relationship is verified. Recognizable logos may appear only as explicitly labeled visual examples, never as users, customers, partners, announced targets, or endorsements. Do not add Columbia campus organizations or describe prepared outreach routes as users, customers, or partners. Pause on hover/focus and fall back to horizontal scrolling when reduced motion is requested.
- Keep the homepage evidence section near the end of the page and compact: three small rounded stat boxes rather than full-width rows. Keep all three boxes white. Each box uses one large figure, one concise paraphrase, then a direct **— Source** link. Use primary sources, keep the limitation line visible, and never imply that labor-market evidence validates ProofPath demand or proves that a short remote project equals an internship.
- Make the employer demo show the transaction before explaining it: one problem-to-project diagram, visible launch gates, a leverage check, then the working intake. Do not repeat the same promise in headings, principles, and paragraphs.
- Keep the problem-to-project arrows bold and structural: a thick shaft and large arrowhead, horizontal on desktop and downward on mobile. Do not revert to a thin text glyph or let an arrow overlap stage copy.
- Preserve the four-step spine: Bring the problem → Review the brief → Approve + fund → See the work.
- Keep the employer-path switcher honest: owner-managed work is a test lane, 11–30-person growing teams are the current pilot focus, and the enterprise wallet is a later hypothesis. The four buyer roles are project sponsor, budget owner, legal buyer, and reviewer.
- Label every named employer persona as a composite example. Never use a real company name, employee, logo, or customer claim unless verified and approved.
- Show the breadth of potential talent with clearly labeled fictional composites and current, linked national education context. National enrollment and degree totals are not ProofPath users, applicants, supply, or traction.
- Make the participation model explicit: every student chooses a role path or paid trial, applies individually with selected evidence, controls the profile shared, and is never placed into an employer slate automatically. The employer retains the final selection decision.
- Treat school, major, earlier jobs, and standardized tests as context only. Do not rank students by SAT, school prestige, a public leaderboard, or one opaque score; show role-specific assessments, accepted paid work, verifier, date, limitations, and later outcomes.
- Express enterprise wallets in dollars. Do not introduce artificial tokens or obscure the approved project price.
- Reserve the layered dollar-sign motif for the funded-work rule. Keep it in the ProofPath white, charcoal, cool-gray, and pale-blue palette; never use it to imply unverified earnings, savings, or traction.
- Open the Overview with a full-screen black introduction. Type the two-line promise with a deliberate pause after each period, then keep a slim, separated cursor blinking at the final letter. The black screen contains no company name or product description—only one **Proof** action. Proof uses one continuous 2.35-second blur-and-fade into the centered ProofPath homepage where the company name, one-line product description, and the **Bring a problem** and **Find paid work** choices live. Keep the screen and homepage fixed in place: no tilt, scale, bounce, vertical landing, or second animation after the blur. Do not repeat the typed promise on the homepage. Show the intro once per page load: switching to another role view and returning to Overview must not replay it, while a real browser reload starts it again. Remove transitional motion when reduced motion is requested.
- Keep the black-screen **Proof** action white on transparent black at rest. On hover or keyboard focus, draw one crisp white frame and one lighter outer frame around it; do not turn it into a filled accent button or a rounded capsule.
- Reset the document to the absolute top whenever the black introduction opens and again when **Proof** reveals the homepage. Do not preserve or restore an earlier scroll position beneath the intro.
- Use one coherent motion system across the role views: a short page entrance, one-time scroll reveals, horizontal state swaps for tabs and newly revealed content, subtle button lift, and structural blue-edge responses on work surfaces. Keep all motion restrained and functional; never turn it into floating decorative bubbles.
- Use large figures for product rules and planning targets. Label them explicitly so they cannot be mistaken for live traction.
- When no verified backend is connected, the network section may demonstrate its future counter behavior with the explicitly labeled illustrative figures `12`, `86h`, and `$4,250`. Animate them rapidly from zero when the section first enters view, but label the section **Illustrative · not live** and state that the figures are not company traction. Demo interactions never increment them or the company metric.
- A project can enter a real total only after employer acceptance; hours saved require employer confirmation at close; student earnings require a recorded payout. `window.PROOFPATH_LIVE_TOTALS` is the future backend injection point for `projects`, `hoursSaved`, `studentEarnings`, an optional `status`, and the required flag `verified: true`. Without that exact verification flag, the section must remain in illustrative mode.
- Use a diagram only when it shows the actual product transaction.
- Do not show fake employers, logos, testimonials, users, placements, or live marketplace volume. Illustrative opportunities must be labeled as illustrative.
- Reveal major homepage beats from the left as they enter the viewport. Keep the movement subtle, run it once, and show everything immediately when reduced motion is requested or JavaScript is unavailable.
- Preserve full keyboard access, visible focus, mobile wrapping, and reduced-motion behavior.

## Files

- `index.html` — complete static prototype with embedded CSS and JavaScript.
- `api/submissions.js` — validated Vercel Function that writes minimal lead records to private Blob storage.
- `package.json` — Vercel Blob SDK dependency.
- `assets/talent-composite-strip.png` — original four-panel fictional-composite portrait artwork used in the employer talent-depth section.
- `assets/work-over-resume-figure.png` — preserved founder-supplied source artwork for the “No posting. No guessing. See the work.” statement.
- `assets/work-over-resume-figure-lime.png` — legacy-named source asset recolored to blue by the current presentation layer.

## Open and test

For a quick preview, double-click `index.html`.

For a static visual preview, run this command from the `Startup` folder:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/proofpath-prototype/`.

The static preview cannot submit forms because it does not run the Vercel Function. For end-to-end local testing, install dependencies and use Vercel’s local development command from `proofpath-prototype`, with a private Blob store token in `.env.local`. Production deploys run the function automatically. There is still no account system, file upload, outbound email, live calendar integration, or payment processing. Prototype project, qualification, workspace, and payment interactions remain front-end simulations and reset when the page reloads.

## Current product rules

- Do not ask employers to author a polished listing from a blank page.
- The employer describes the symptom; ProofPath drafts the scope.
- Maintain a public student-facing listing and a separate private Context Pack.
- Use one shared project schema with vertical-specific safety modules.
- Do not publish without a useful deliverable, named reviewer, observable acceptance rule, approved Context Pack, safe access boundary, funded pay, and plausible net time savings.
- Default to approved copies in the ProofPath workspace rather than employer production systems.
- One assigned student, fixed pay, one scoped revision, and one documented employer outcome.
- Never grant a role status without its prerequisite evidence event. A Batch requires expected assignments; Role-Qualified requires an assessment attempt; Employer-Verified requires accepted paid work; Proven requires accepted work plus a stronger outcome.
- Every important evidence claim names its task family, source type, source reference, observer or verifier, observation date, visibility, status, and correction history.
- Treat a résumé as optional context, not proof. Keep self-reported, ProofPath-observed, employer-observed, and external issuer evidence visibly separate.
- Require the exact employer-approved agreement version before private context opens. Signing does not broaden the approved data boundary.
- Preserve correction, appeal, expiry, suspension, revocation, and restoration history. Do not silently overwrite accepted evidence.
- Students see employer, task, deliverable, pay, time, deadline, reviewer, acceptance criteria, information boundary, AI policy, and possible next step before applying.
- Employer burden includes intake, context approval, questions, and final review.
- The launch metric is paid employer pilots completed and accepted—not registrations, listings, profile views, or student subscriptions.

## What is intentionally absent

- Open self-service marketplace
- Student subscriptions
- Social communities or feeds
- Opaque scores or rankings
- Mass student acquisition
- Production credentials or unrestricted company-system access
- Claims of verified savings or live customer activity
- Persistent verification URLs, QR codes, signed credentials, automated issuer validation, or production-grade identity checks

## Canonical strategy

Before changing product logic, read:

- `company-os/CANONICAL.md`
- `company-os/data/state.json`
- `deliverables/ProofPath_Founder_Brainstorm_2026.md`

Do not reintroduce superseded startup-first, community-first, or broad marketplace concepts without a recorded decision and customer evidence.
