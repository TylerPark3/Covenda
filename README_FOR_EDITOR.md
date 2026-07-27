# Covenda prototype — editor handoff

Updated: July 18, 2026

## Purpose

This prototype demonstrates the current Covenda thesis: **the core product is managed problem-to-project design, not matching**. Covenda reconstructs a recurring internal problem, isolates the safe work unit, and converts it into a funded Project Packet that an outside student can complete without consuming more employer time than the work saves.

**July 17 alignment decision:** lead with the employer's last real problem, use the de-identified onboarding bottleneck map as the flagship accounting example, and expose only Accounting Operations plus the bounded Wealth Operations second path. Review-note analysis remains a higher-risk later use case; AI and science paths are not active lanes.

**Development status: authenticated MVP foundation.** The public site collects structured company, student, university, and call-request intake. A protected operator inbox and the first role-aware member portal now exist in code; live member access still requires the portal migration, Google provider, redirect URLs, and custom SMTP to be configured in the same Supabase project used by Vercel. There is no live payment or automated matching system. Until Covenda records customer interviews, convertible tasks, funded pilots, accepted work, and repeat or candidate-advancement behavior, add only what improves real customer learning, safety, accessibility, or completion of the current flows.

**July 18 launch decision:** prioritize a functional public pilot site and practical visitor outcomes over more decorative UI work. The working public address is `https://proof-path.vercel.app/`. Local source and GitHub `main` now contain the same five-step Overview, interactive 11-stage employer workflow, bounded intake function, and referenced founder imagery represented by the current public presentation. Future edits are unfinished until the local tests and public-flow QA pass and the change is deployed to the existing Vercel project. Use the founder's real Calendly event link for booking instead of building a native scheduling backend. A custom domain is valuable but should not delay customer conversations; connecting or buying one requires the founder's exact domain choice and DNS or purchase approval.

The public entry leads with one plain promise, two audience paths, a five-step managed boomerang, project-fit boundaries, the current pilot stage, research limitations, and an independent founder note. It uses no customer-logo theater or illustrative traction counter. Until the exact Calendly event link is connected, the existing scheduling flow is only a fallback that collects a preferred date and time and says Covenda must confirm it by email.

## Public launch sequence

1. Run `npm run check` and complete desktop, mobile, keyboard, reduced-motion, overflow, form-state, and console QA on the latest local build.
2. Record the founder's exact Calendly event URL in `<meta name="covenda-calendly-url" content="">` at the top of `index.html`. The code accepts only an HTTPS `calendly.com` host; when configured, every `data-schedule` CTA opens that event in a new tab. Label the result **Book a 20-minute call**. Do not display the simulated availability calendar as though it were live.
3. Deploy the tested local build to the existing `proof-path` Vercel project; do not create a duplicate project or storage store.
4. On production, submit one clearly synthetic employer intake and one student-interest profile, then verify their private `EMP-` and `STU-` records. Test the Calendly link without creating an actual meeting unless the founder explicitly authorizes a test booking.
5. Choose one custom domain, confirm ownership or purchase approval, connect it in Vercel, and make the preferred apex or `www` host canonical. Keep `proof-path.vercel.app` as a working fallback.
6. Send employer outreach to the company-problem intake and the Calendly booking outcome. Keep student distribution demand-gated.

The launch is functional when a visitor can understand the offer, complete the appropriate intake, book a real founder conversation, receive a clear confirmation, and enter a manual follow-up process. Accounts, automated matching, payments, and protected dashboards are not required for this launch.

## Live lead capture

Three forms send JSON to `POST /api/submissions`. When Supabase is connected, each submission becomes one structured row in the private `public.submissions` table. The existing private Vercel Blob store remains an automatic fallback during setup or a temporary database failure:

1. **Employer intake** — contact details plus the bounded problem, expected output, reviewer, acceptance rule, budget, and safety choices.
2. **Student interest** — education context, work and industry interests, honest self-reported skill levels, optional evidence links, working terms, priorities, and an 18-or-older confirmation. No résumé or file upload.
3. **Call request fallback** — name, work email, company, topic, preferred date/time, and browser timezone. It remains available only until the real Calendly event is connected or as an explicit backup path.

Each successful submission returns a reference beginning with `EMP-`, `STU-`, or `CALL-`. View primary records in Supabase Table Editor under `public.submissions`. Fallback records are stored under `submissions/<type>/YYYY/MM/DD/` in the private Vercel Blob store and can be retrieved from the Vercel project’s Storage tab. Optional Resend alerts contain only a reference and safe operational metadata—not the private form answers. Setup instructions are in `OPERATIONS.md`. Do not expose database secrets, `BLOB_READ_WRITE_TOKEN`, private blob URLs, or stored answers through a public endpoint.

The endpoint rejects cross-origin browser posts, oversized payloads, a filled honeypot, implausibly fast posts, missing consent, malformed email addresses, invalid links, production access, client records, and regulated decisions. A best-effort in-memory request limit slows obvious bursts but resets with serverless instances. The endpoint stores no uploaded files and does not persist IP addresses. This is basic MVP abuse resistance, not a substitute for production authentication, durable rate limiting, idempotency, retention controls, or a formal privacy program.

The simple overview leads into three connected role views:

1. **Employer** — a five-step live intake for company context, the last real problem, proposed output, information boundary, and review; the existing Project Packet and workflow remain clearly illustrative.
2. **Student** — a five-step live interest profile for basics, interests, skills, evidence links, availability, compensation preferences, and review. Project examples, evidence progression, Proof Profile controls, agreement gate, and workspace remain local demonstrations.
3. **Covenda operations** — a local demonstration only, no longer presented in public navigation. It is not authenticated or protected. The intake database is now prepared for a future authenticated operator dashboard, but no public admin page exists yet.

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

For inspection, the local records are exposed at `window.COVENDA_DEMO_MODEL`. The object includes StudentProfile, RolePath, Batch, Application, WorkSample, RubricVersion, AssessmentAttempt, EvidenceItem, Credential, TalentBrief, TalentRequirementCard, Project, CandidateMatch, Agreement, AccessGate, SubmissionVersion, WorkRecord, EmployerReview, OutcomeEvent, and AuditEvent.

## Presentation rules

- Explain the product before exposing the operating interface.
- Keep the home story in this order: dark hero, interactive proof lens, **Quality over quantity** comparison, then the existing project exchange and supporting sections. The proof lens adds an opening explanation; it does not replace the longer product story.
- Keep the compact **Find a student / Post a trial** walkthrough on the company audience only. Each route uses three short steps and remains explicitly illustrative.
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
- Do not use recognizable company logos, university lists, or animated counters as a substitute for customer evidence. Show project categories, suitability rules, and the current pilot stage instead.
- Keep employer and student market context on the Overview, but do not give it a standalone report section. Place two small, directly linked proof notes inside each audience panel, keep the limitation line immediately beneath both panels, and never imply that labor-market evidence validates Covenda demand or makes a short remote project equivalent to an internship.
- Make the employer demo show the transaction before explaining it: one problem-to-project diagram, visible launch gates, a leverage check, then the working intake. Do not repeat the same promise in headings, principles, and paragraphs.
- Keep the problem-to-project arrows bold and structural: a thick shaft and large arrowhead, horizontal on desktop and downward on mobile. Do not revert to a thin text glyph or let an arrow overlap stage copy.
- Preserve the four-step spine: Bring the problem → Review the brief → Approve + fund → See the work.
- Preserve the managed boomerang directly beneath that spine: Company problem → Covenda scope and safeguards → student work → Covenda review and packaging → company decision. Raw student work does not go straight to the employer; the company receives a company-ready presentation, and the student keeps an evidence-backed Work Record.
- Keep the employer-path switcher honest: owner-managed work is a test lane, 11–30-person growing teams are the current pilot focus, and the enterprise wallet is a later hypothesis. The four buyer roles are project sponsor, budget owner, legal buyer, and reviewer.
- Label every named employer persona as a composite example. Never use a real company name, employee, logo, or customer claim unless verified and approved.
- Show the breadth of potential talent with clearly labeled fictional composites and current, linked national education context. National enrollment and degree totals are not Covenda users, applicants, supply, or traction.
- Make the participation model explicit: every student chooses a role path or paid trial, applies individually with selected evidence, controls the profile shared, and is never placed into an employer slate automatically. The employer retains the final selection decision.
- Treat school, major, earlier jobs, and standardized tests as context only. Do not rank students by SAT, school prestige, a public leaderboard, or one opaque score; show role-specific assessments, accepted paid work, verifier, date, limitations, and later outcomes.
- Express enterprise wallets in dollars. Do not introduce artificial tokens or obscure the approved project price.
- Reserve the layered dollar-sign motif for the funded-work rule. Keep it in the Covenda white, charcoal, cool-gray, and pale-blue palette; never use it to imply unverified earnings, savings, or traction.
- Open the Overview with a short light introduction using the existing serif display font: “Students get paid.” followed by “Employers get work done.” Type both lines once while keeping **Enter Covenda** and **Skip intro** visible immediately. Store completion in local storage so returning visitors on the same browser/device go directly to the homepage. There is no account-level preference until authentication exists. Escape must dismiss it. Reduced-motion users should see the final copy immediately.
- Reset the document to the absolute top whenever the introduction opens and again when it reveals the homepage. Do not preserve or restore an earlier scroll position beneath the intro.
- Use one coherent motion system across the role views: a short page entrance, one-time scroll reveals, horizontal state swaps for tabs and newly revealed content, subtle button lift, and structural blue-edge responses on work surfaces. Keep all motion restrained and functional; never turn it into floating decorative bubbles.
- Use large figures for product rules and planning targets. Label them explicitly so they cannot be mistaken for live traction.
- Do not publish illustrative project, hours-saved, or earnings counters. Add outcome totals only after a verified backend records employer acceptance, employer-confirmed time avoided, and student payout.
- Use a diagram only when it shows the actual product transaction.
- Do not show fake employers, logos, testimonials, users, placements, or live marketplace volume. Illustrative opportunities must be labeled as illustrative.
- Reveal major homepage beats from the left as they enter the viewport. Keep the movement subtle, run it once, and show everything immediately when reduced motion is requested or JavaScript is unavailable.
- Preserve full keyboard access, visible focus, mobile wrapping, and reduced-motion behavior.

## Files

- `index.html` — complete static prototype with embedded CSS and JavaScript.
- `api/submissions.js` — validated Vercel Function that writes structured records to Supabase with private Blob fallback and optional minimal email alerts.
- `supabase/migrations/20260721051450_create_submission_inbox.sql` — secured private submission-inbox schema.
- `OPERATIONS.md` — plain-language setup and operator instructions.
- `package.json` — server integration dependencies plus `test` and `check` scripts.
- `tests/submissions.test.js` — server-validation coverage for employer, student, and call-request records.
- `assets/talent-composite-strip.png` — original four-panel fictional-composite portrait artwork used in the employer talent-depth section.
- `assets/work-over-resume-figure.png` — preserved founder-supplied source artwork for the “No posting. No guessing. See the work.” statement.
- `assets/work-over-resume-figure-lime.png` — legacy-named source asset recolored to blue by the current presentation layer.

## Open and test

For a quick preview, double-click `index.html`.

Run server-validation checks from the repository root with:

```powershell
npm run check
```

For a static visual preview, run this command from the `Startup` folder:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

The static preview cannot submit forms or authenticate because it does not run the Vercel Functions. For end-to-end local testing, install dependencies and use Vercel’s local development command with the private server variables described in `OPERATIONS.md`. Production deploys run the functions automatically. The repository now includes an authenticated operator inbox and member portal; file upload, live payment processing, and automated matching are not implemented. Email alerts and auth email delivery are available only when configured.

## Current product rules

- Do not ask employers to author a polished listing from a blank page.
- The employer describes the symptom; Covenda drafts the scope.
- Maintain a public student-facing listing and a separate private Context Pack.
- Use one shared project schema with vertical-specific safety modules.
- Do not publish without a useful deliverable, named reviewer, observable acceptance rule, approved Context Pack, safe access boundary, funded pay, and plausible net time savings.
- Default to approved copies in the Covenda workspace rather than employer production systems.
- One assigned student, fixed pay, one scoped revision, and one documented employer outcome.
- Never grant a role status without its prerequisite evidence event. A Batch requires expected assignments; Role-Qualified requires an assessment attempt; Employer-Verified requires accepted paid work; Proven requires accepted work plus a stronger outcome.
- Every important evidence claim names its task family, source type, source reference, observer or verifier, observation date, visibility, status, and correction history.
- Treat a résumé as optional context, not proof. Keep self-reported, Covenda-observed, employer-observed, and external issuer evidence visibly separate.
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
- the current founder brainstorm and meeting notes supplied for the active development round

Do not reintroduce superseded startup-first, community-first, or broad marketplace concepts without a recorded decision and customer evidence.
