import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const typeCss = await readFile(new URL('../type.css', import.meta.url), 'utf8');

test('frontend JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('HTML ids remain unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('student-first hero leads with optional joining, five work areas, and a scroll continuation', () => {
  const hero = html.match(/<section class="hero hero-student"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(hero, /Do work that proves/);
  assert.equal((hero.match(/data-work-type=/g) || []).length, 5);
  assert.match(hero, /Join now\s*[,—.]\s*choose later/);
  assert.match(hero, /No work area is required/);
  assert.match(hero, /See how Covenda works/);
  assert.match(hero, /href="#how"/);
});

test('Covenda restores the skippable editorial intro and keeps it replayable', () => {
  assert.match(html, /id="introScreen"/);
  assert.match(html, /Students get to prove\./);
  assert.match(html, /Startups get proven talent\./);
  assert.match(html, /id="introEnter"[^>]*>[\s\S]*Enter Covenda/);
  assert.match(html, /id="introSkip"[^>]*>Skip intro/);
  assert.match(html, /data-action="replay-intro"/);
  assert.match(script, /covendaIntroSeen/);
  assert.match(script, /function openIntro\(/);
  assert.match(script, /function dismissIntro\(/);
  assert.match(typeCss, /--font-display:/); // §14: fonts now live in the shared type.css
  assert.match(styles, /\.intro-statement/);
});

test('the student entry separates signup without a choice from signup with a specific direction', () => {
  const studentHero = html.match(/<section class="hero hero-student"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(studentHero, /Do work that proves/);
  assert.match(studentHero, /class="gold-button student-join-primary"[^>]*data-join-mode="open"[\s\S]*Join now\s*[,—.]\s*choose later/);
  // The picker is on industry verticals now, matching BATCH_CATALOG. It used to offer work
  // types — research, data, QA — a taxonomy nothing else on the platform spoke, so a
  // student's choice lined up with no batch, no profile field and no matching signal.
  assert.match(studentHero, /Join now\s*[,—.]\s*choose later[\s\S]*Choose your industry/);
  assert.match(studentHero, /Software &amp; AI/);
  assert.doesNotMatch(studentHero, /QA &amp; testing/);
  for (const vertical of ['Software &amp; AI', 'Accounting &amp; finance', 'Healthcare operations', 'Consumer &amp; retail', 'Professional services']) {
    assert.match(studentHero, new RegExp(vertical));
  }
  assert.doesNotMatch(studentHero, /student-vertical is-selected/);
  assert.doesNotMatch(studentHero, /Explore[\s\S]*Profile[\s\S]*Track/);
  assert.doesNotMatch(studentHero, /selectorFxCanvas|student-journey|narrowFlow/);
  assert.match(styles, /\.student-vertical-rail[\s\S]*grid-template-columns: repeat\(5/);
  assert.match(styles, /\.student-vertical \{[\s\S]*border-right: 1px solid var\(--line-strong\)[\s\S]*border-radius: 0/);
  assert.match(styles, /\.student-join-primary \{[\s\S]*width: min\(100%, 320px\)[\s\S]*border-radius: 0/);
  assert.match(styles, /@keyframes student-join-confirm/);
  assert.match(script, /\$\$\('\.work-option, \.student-vertical'\)/);
  assert.match(studentHero, /id="studentSpecialtyPanel"/);
  assert.match(studentHero, /id="studentSpecialtyPanel"[^>]*hidden/);
  assert.match(studentHero, /id="studentSpecialtyOptions"/);
  assert.match(studentHero, /id="studentJoinSelected"[^>]*data-join-mode="selected"[^>]*disabled/);
  assert.match(studentHero, /id="studentChoiceClear"/);
  assert.match(script, /const studentSpecialties = \{/);
  // One specialty per vertical, all five drawn from the batch catalogue.
  for (const specialty of ['AI & machine learning', 'Private equity', 'Clinical operations', 'Growth & performance', 'Management consulting']) {
    assert.match(script, new RegExp(specialty));
  }
  assert.match(script, /function renderStudentSpecialties\(workType\)/);
  assert.match(script, /function selectStudentSpecialty\(label\)/);
  assert.match(script, /function clearStudentWorkChoice\(\)/);
  assert.match(script, /function updateStudentJoinChoice\(\)/);
  assert.match(script, /quickJoinDirection/);
  assert.match(script, /includeDirection = button\.dataset\.joinMode === 'selected'/);
  assert.match(script, /studentSpecialtyStorageKey/);
  assert.match(script, /function confirmStudentJoin\(button\)/);
});

test('audience switch supports student and company site states', () => {
  assert.match(html, /data-audience-option="student"/);
  assert.match(html, /data-audience-option="company"/);
  // The company hero leads with one free-text box. Six structured fields before a founder had
  // seen a single student was filtering they had no basis to do — the skills, hours and budget
  // questions come later, once there is a reason to ask them.
  assert.match(html, /id="companyProblemSeed"/);
  assert.match(html, /What keeps getting pushed back\?/);
  assert.match(html, /Hire from a vetted batch/);
  // The chip pickers and the numeric grid are gone from the entry point.
  assert.doesNotMatch(html, /id="ibVerticals"/);
  assert.doesNotMatch(html, /id="ibWorkTypes"/);
  assert.doesNotMatch(html, /name="requiredSkills"/);
  assert.match(script, /document\.body\.dataset\.audience = audience/);
  assert.match(styles, /body\[data-audience="company"\] \.hero-student/);
  assert.match(script, /covendaAudience/);
  assert.match(script, /covendaSelectedWorkType/);
});

test('production home keeps the approved clean banner and talent-to-proof hero', () => {
  const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] || '';
  const hero = html.match(/<section class="hero hero-home"[\s\S]*?<\/section>/)?.[0] || '';

  for (const label of ['How it works', 'Students', 'Companies', 'Referrals', 'About']) {
    assert.match(header, new RegExp(`>${label}<`));
  }
  assert.match(hero, /id="heroFieldCanvas"/);
  assert.equal((hero.match(/class="home-path-index"/g) || []).length, 3);
  assert.match(styles, /\.hero-home \{[\s\S]*linear-gradient\(145deg, #12120f/);
  assert.match(styles, /\.site-header \{[\s\S]*font-family: var\(--font-display\)/);
  assert.match(script, /function initHeroField\(\)/);
  assert.match(script, /gold: Math\.random\(\) < \.1/);
  assert.match(script, /\.slice\(0, 7\)/);
  assert.match(script, /spawnSignal\(now\)/);
});

test('the proof lens opens the homepage without removing the existing product story', () => {
  const heroAt = html.indexOf('class="hero hero-home"');
  const proofAt = html.indexOf('class="proof-lens-section"');
  const compareAt = html.indexOf('class="compare-section"');
  const exchangeAt = html.indexOf('class="exchange-section"');
  assert.ok(heroAt >= 0 && heroAt < proofAt && proofAt < compareAt && compareAt < exchangeAt);
  assert.match(html, /Here’s what that means\./);
  assert.match(html, /More startups[\s\S]*need talent\./);
  assert.match(html, /AI makes applications[\s\S]*harder to trust\./);
  assert.match(html, /More students want[\s\S]*startup work\./);
  assert.match(html, /Covenda makes the work visible\./);
  assert.match(html, /data-proof-step="0"/);
  assert.match(html, /data-proof-step="3"/);
  assert.match(html, /Build a work profile/);
  assert.match(html, /Filter for fit/);
  assert.match(html, /Try one real project/);
  assert.match(html, /Paid · 2 weeks · named reviewer/);
  assert.match(html, /A strong trial can lead to a role\./);
  assert.match(html, /Internship · ongoing project · full-time/);
  assert.match(html, /not a guaranteed offer/);
  assert.doesNotMatch(html, /Stop screening claims|Define the proof|Meet by mutual choice/);
  assert.match(html, /Quality over quantity/);
  assert.match(html, /See the work\.[\s\S]*Then decide\./);
  assert.match(html, /A small paid trial with a clear finish/);
  assert.match(html, /Can lead to an internship, project, or role/);
  assert.match(html, /One project\.[\s\S]*Two sides win\./);
  assert.match(styles, /body:not\(\[data-audience="home"\]\) \.proof-lens-section \{ display: none; \}/);
  assert.match(styles, /body\[data-audience="home"\] \.compare-section \{ display: block; \}/);
  assert.match(styles, /\.proof-product-rail/);
  assert.match(styles, /@keyframes proof-rise-in/);
  assert.match(script, /function initProofLens\(\)/);
  assert.match(script, /querySelectorAll\('\[data-proof-step\]'\)/);
});

test('the ideal-intern walkthrough is a minimal company-only two-route demo', () => {
  const demo = html.match(/<section class="company-product-demo[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(demo, /data-for-audience="company"/);
  assert.match(demo, /Two ways to get the help you need\./);
  assert.match(demo, /Find a student/);
  assert.match(demo, /Post a trial/);
  assert.match(demo, /You have a problem\./);
  assert.match(demo, /Open Talent\./);
  assert.match(demo, /Illustrative match/);
  assert.match(demo, /Post one small task\./);
  assert.match(demo, /Qualified students apply\./);
  assert.match(demo, /Run the paid trial\./);
  assert.doesNotMatch(html, /id="cdemoControls"|id="cdemoScore"|Build your ideal intern\. Watch the score/);
  assert.match(script, /function initCompanyProductDemo\(\)/);
  assert.match(script, /Object\.entries\(panels\)/);
  assert.match(styles, /\.company-demo-steps \{[\s\S]*grid-template-columns: repeat\(3/);
});

// Reframed from "approved Project Packet" to vetted-talent-then-trial. The managed workflow
// and the risk boundary are unchanged — only the framing around them moved.
test('company story preserves the managed workflow and risk boundary', () => {
  assert.match(html, /Vetted talent, ready/);
  for (const phrase of ['Company problem', 'Covenda scopes', 'You approve', 'Student works', 'Covenda reviews']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /No production access or restricted records/);
  assert.match(html, /Illustrative Project Packet/);
});

test('company hero problem composer remains focusable above decorative effects', () => {
  assert.match(html, /id="companyProblemSeed"/);
  assert.match(styles, /\.selector-orbit::after[\s\S]*pointer-events: none/);
  assert.match(styles, /\.company-composer[\s\S]*z-index: 2/);
  assert.match(styles, /\.company-composer textarea[\s\S]*pointer-events: auto/);
  assert.match(script, /seed\.addEventListener\('input', update\)/);
});

test('workspace includes honest student and company pilot states', () => {
  assert.match(html, /id="workspaceShell"/);
  assert.match(html, /Build proof one project at a time/);
  assert.match(html, /No universal score/);
  assert.match(html, /Turn one delayed problem into a bounded project/);
  assert.match(html, /Payment and publication are not active in this pilot workspace/);
  assert.match(html, /Submission delivery/);
});

test('both live submission paths have progressive forms and consent', () => {
  assert.equal((html.match(/data-student-step=/g) || []).length, 4);
  assert.equal((html.match(/data-company-step=/g) || []).length, 4);
  assert.match(html, /id="studentForm"/);
  assert.match(html, /id="companyForm"/);
  assert.match(html, /name="studentConsent"/);
  assert.match(html, /name="companyConsent"/);
  assert.match(script, /fetch\('\/api\/submissions'/);
  assert.match(script, /type: 'student_interest'/);
  assert.match(script, /type: 'employer_intake'/);
});

test('drafts persist locally and feed review and workspace summaries', () => {
  assert.match(script, /covendaStudentInterestDraft/);
  assert.match(script, /covendaCompanyProblemDraft/);
  assert.match(script, /function serializeDraft\(form\)/);
  assert.match(script, /function restoreDraft\(form\)/);
  assert.match(script, /function renderReview\(form\)/);
  assert.match(script, /function renderWorkspaceDrafts\(\)/);
  assert.match(html, /id="studentReviewSummary"/);
  assert.match(html, /id="companyReviewSummary"/);
  assert.match(html, /id="studentDraftBanner"/);
  assert.match(html, /id="companyDraftBanner"/);
  assert.match(html, /data-clear-draft/);
});

test('server-confirmed submissions become durable review receipts', () => {
  assert.match(html, /Submission receipts/);
  assert.match(html, /id="submissionHistory"/);
  assert.match(html, /id="studentReviewStatus"/);
  assert.match(html, /id="companyScopingStatus"/);
  assert.match(script, /function renderReceipt\(item\)/);
  assert.match(script, /function renderSubmissionHistory\(\)/);
  assert.match(script, /Queued for human review/);
  assert.match(script, /Copy reference/);
  assert.match(script, /Download receipt/);
  assert.match(script, /function submissionStorageLabel\(item\)/);
  assert.match(script, /Primary inbox/);
  assert.match(script, /Backup · sync pending/);
  assert.match(script, /function refreshDeliveryHealth/);
  assert.match(script, /Primary sync pending/);
  assert.match(html, /id="deliveryDetails"/);
  assert.match(html, /id="deliveryProjectRef"/);
  assert.match(html, /Supabase → Table Editor/);
  assert.match(script, /result\.destination/);
  assert.match(styles, /\.delivery-details/);
  assert.match(html, /id="receiptRecoveryForm"/);
  assert.match(html, /Receipt missing from this device/);
  assert.match(script, /function findServerReceipt/);
  assert.match(script, /function openReceiptRecovery/);
  assert.match(script, /Refresh status/);
  assert.match(styles, /\.receipt-recovery/);
  assert.match(script, /setWorkspaceTab\('submissions'\)/);
  assert.match(styles, /\.receipt-progress/);
  assert.match(styles, /\.receipt-action/);
});

test('company review calculates the net time case without promising launch', () => {
  assert.match(script, /function companyTimeCase\(form\)/);
  assert.match(script, /net: avoided - reviewHours/);
  assert.match(script, /Covenda still validates this estimate/);
  assert.match(script, /would redesign or stop this project/);
  assert.match(html, /No payment, publication, or student assignment occurs from this submission/);
});

test('company review exposes a six-part Project Packet readiness model', () => {
  assert.match(html, /id="companyReadinessStatus"/);
  assert.match(html, /id="companyReadinessChecks"/);
  assert.match(html, /Readiness is not approval/);
  assert.match(script, /function companyPacketReadiness\(input\)/);
  for (const key of ['outcome', 'review', 'context', 'boundary', 'time', 'terms']) {
    assert.match(script, new RegExp("key: '" + key + "'"));
  }
  assert.match(script, /Human review still required/);
  assert.match(script, /packetReadiness: result\.readiness/);
  assert.match(styles, /\.packet-readiness/);
});

test('company receipts preserve packet snapshots and immutable revision lineage', () => {
  assert.match(html, /id="companyRevisionContext"/);
  assert.match(script, /function companyPacketSnapshot\(form, readiness\)/);
  assert.match(script, /function renderReceiptPacket\(item\)/);
  assert.match(script, /function startPacketRevision\(item\)/);
  assert.match(script, /revisionOf: form\.dataset\.revisionOf/);
  assert.match(script, /the original submission remains unchanged/i);
  assert.match(script, /\['packet', 'View packet'/);
  assert.match(script, /\['revise', 'Revise packet'/);
  assert.match(styles, /\.receipt-packet/);
  assert.match(styles, /\.receipt-lineage/);
});

test('forms preserve backend safety and evidence requirements', () => {
  for (const name of ['companyProblem', 'companyDecision', 'companyDeliverable', 'companyReviewer', 'companyAcceptance', 'companyContext']) {
    assert.match(html, new RegExp('name="' + name + '"'));
  }
  assert.match(script, /clientRecords:/);
  assert.match(script, /restrictedJudgment:/);
  assert.match(html, /id="companyBoundaryGuidance"/);
  assert.match(script, /function companyBoundaryBlockers\(form\)/);
  assert.match(script, /change System access from production\/client systems/);
  assert.match(script, /setFormStep\(companyForm, 2\)/);
  assert.match(html, /This is an interest profile, not a job application or guarantee/);
});

test('homepage operations icon and navigation polish remain centered and usable', () => {
  const operationsIcon = html.match(/<symbol id="icon-operations"[\s\S]*?<\/symbol>/)?.[0] || '';
  assert.match(operationsIcon, /<circle cx="12" cy="12" r="3"/);
  assert.match(styles, /\.site-header, \.workspace-header[\s\S]*position: sticky/);
  assert.match(styles, /#how, #why \{ scroll-margin-top:/);
});

test('design system stays true white and supports responsive and reduced-motion states', () => {
  assert.match(styles, /--white: #fff/);
  assert.match(styles, /--gold: #b47b20/);
  assert.match(styles, /backdrop-filter: blur/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  // §14: the families live in one shared type.css, linked by all surfaces.
  //
  // Newsreader over Manrope on a warm cream ground is the exact combination AI-generated
  // sites converge on, and readers said so unprompted. Geist is a modern neo-grotesque, free
  // under the SIL OFL, in the same family tree as TWK Lausanne (commercial) and the face
  // Cluely uses. This asserts the pair and refuses the AI-default cluster coming back.
  // EB Garamond at display sizes only, over a cool ground, with Geist carrying every other
  // level. That is Cluely's treatment and it is not the thing that read as AI-generated: that
  // was an editorial serif doing ALL the headings over warm cream.
  assert.match(typeCss, /--font-display: "EB Garamond"/);
  assert.match(typeCss, /--font-sans: "Geist"/);
  assert.match(typeCss, /--font-body: "Geist"/);
  assert.match(typeCss, /--font-mono: "IBM Plex Mono"/);
  for (const face of ['Newsreader', 'Manrope', 'Inter', 'Space Grotesk']) {
    assert.ok(!new RegExp(`--font-[a-z]+: "${face}"`).test(typeCss), `${face} is the AI-default cluster`);
  }
  assert.match(html, /href="type\.css"/);
  assert.match(html, /fonts\.googleapis\.com/);
});

test('page avoids unsupported marketplace claims and legacy branding', () => {
  assert.doesNotMatch(html, /ProofPath/i);
  assert.match(html, /href="\/portal\.html"/);
  assert.match(html, /Member sign in/);
  assert.doesNotMatch(html, /customer logos/i);
  assert.doesNotMatch(html, /success rate/i);
  assert.doesNotMatch(html, /Student score:/i);
});

// A4 — the free Talent Readiness Assessment. The scorer (readiness-1.0.0) shipped
// before any UI existed; these guard the surface that finally reaches it.
test('talent readiness assessment reaches the pre-auth scorer and stays decision-support', () => {
  assert.match(html, /id="readinessDialog"/);
  assert.match(html, /data-action="readiness-check"/);
  // Every field the scorer reads must exist, or an axis silently scores zero.
  for (const field of ['goal', 'blocked', 'skills', 'supervisionHoursWeekly', 'projectWeeks', 'budget', 'systemsAccess', 'hireIntent']) {
    assert.match(html, new RegExp(`name="${field}"`), `readiness form is missing the ${field} input`);
  }
  assert.match(script, /action: 'readiness-check'/);
  assert.match(script, /fetch\('\/api\/portal'/);
  // Decision-support, never a gate: the read-out always offers the next step.
  assert.match(html, /data-action="readiness-submit-project"/);
  assert.match(html, /A score is not a decision\./);
  // Scores never display bare — the band is what self-reported answers earn.
  assert.match(script, /readiness-band/);
  assert.match(script, /readinessVersion/);
  assert.match(styles, /\.readiness-axis/);
});

test('readiness read-out builds nodes with createIcon, not raw icon strings', () => {
  const block = script.match(/function renderReadinessAxis\([\s\S]*?\n}/)?.[0] || '';
  assert.ok(block, 'renderReadinessAxis not found');
  assert.match(block, /createIcon\('icon-check'\)/);
  assert.doesNotMatch(block, /iconUse\(/); // iconUse returns a string; append() would print it
});

test('the redundant why-now and machine-check explainers stay removed', () => {
  assert.doesNotMatch(html, /The thing you can’t put on a résumé/);
  assert.doesNotMatch(html, /class="whynow/);
  assert.doesNotMatch(html, /id="verifyMethods"/);
  assert.doesNotMatch(html, /Machines check facts/);
  assert.doesNotMatch(script, /function initVerifyMethods\(\)/);
  assert.doesNotMatch(styles, /\.verify-section|\.whynow-head|\.whynow-grid/);
});

// The public batch board renders the same brief the portal does, fetched from the pre-auth
// 'batch-briefs' action — so the bar a visitor reads and the bar the portal checks them
// against cannot drift. The old hardcoded BATCHES array survives only as a static-preview
// fallback (no serverless locally), never as a second source of truth for the bar.
//
// The per-card detail panel this used to assert is gone: the bar now renders full-width in
// the deep dive, because five requirements in a card was a thin ribbon of text down a very
// wide page.
test('public batch board renders the shipped brief in the full-width walkthrough', () => {
  assert.match(script, /action: 'batch-briefs'/);
  assert.match(script, /data-batch-grid/);
  assert.match(script, /What this batch asks of you/);
  assert.match(script, /How it gets checked/);
  // Honest labelling survives the trip to the marketing site.
  assert.match(script, /Expert-vetted/);
  assert.match(script, /the bar is guidance, not a gate/);
  // The orphaned per-card panel must not creep back.
  assert.doesNotMatch(script, /function batchDetailPanel\(/);
  // Requirements tile across the panel instead of stacking in one column.
  assert.match(styles, /\.bd-reqs \{ grid-template-columns: repeat\(auto-fit/);
  assert.match(styles, /\.bd-steps \{ grid-template-columns: repeat\(auto-fit/);
});

// The hand-kept fallback list is gone: with 13 specialisations a duplicate array would drift
// from the catalogue immediately, and a wrong board is worse than an empty one.
test('the board has no second source of truth for the catalogue', () => {
  assert.doesNotMatch(script, /const BATCHES = \[/);
  assert.match(script, /Better an empty board than a wrong one/);
});

test('the board groups by vertical and the deep dive names what is inspected', () => {
  assert.match(script, /className = 'batch-group'/);
  assert.match(script, /data\.groups/);
  assert.match(script, /What counts as evidence here/);
  assert.match(styles, /\.bd-read dt/);
  assert.match(styles, /\.batch-row \{ display: grid/);
});

// The candidate browser is portal-only. index.html long claimed it was "scoped to the company
// audience in CSS" while no such rule existed — but gating on audience was never sufficient
// anyway: the switcher is public, so anyone could click "Company" and browse scored students.
// It is now absent from the public page entirely; the portal is where the viewer is known.
test('candidate browser is not on the public site', () => {
  assert.doesNotMatch(html, /id="candidates"/);
  assert.doesNotMatch(html, /candidates-section/);
  assert.doesNotMatch(html, /id="candGrid"/);
  // The renderers stay in app.js and must no-op rather than throw without their nodes.
  assert.match(script, /const bar = \$\('#candToolbar'\);\n  if \(!bar\) return;/);
  assert.match(script, /const grid = \$\('#candGrid'\);\n  if \(!grid\) return;/);
});

// The hero field is the geometric motif the rest of the site borrows from. It gained a
// pointer-reactive layer; the guardrails around it must survive that.
test('hero field keeps pointer discovery without shifting the 3D field', () => {
  // The cursor finds nearby nodes, but no longer drives camera parallax.
  assert.doesNotMatch(script, /targetX = -\(\(pointer\.x/);
  assert.match(script, /\.slice\(0, 7\)/);
  assert.match(script, /ctx\.lineTo\(item\.point\.x, item\.point\.y\)/);
  assert.match(script, /pointerleave/);
  assert.match(script, /function formGoldBond\(now\)/);
  assert.match(script, /nextGoldBondAt = now \+ 10000/);
  assert.match(script, /for \(const bond of goldBonds\)/);
  assert.match(script, /createRadialGradient\(q\.x, q\.y/);
  // Reduced-motion returns before any listener is attached (the early `if (reduce) return`),
  // and coarse pointers never get a hover handler at all.
  assert.match(script, /\(hover: hover\) and \(pointer: fine\)/);
  // Listens on the hero, not the canvas — the canvas sits behind the copy.
  assert.match(script, /canvas\.closest\('\.hero'\)/);
});

// The board is a CHOICE, not a commit: per-card "Join this batch" asked a student to decide
// before the batch had shown what it requires. Select batches, then walk through them.
test('batch board selects batches and walks through them full-width', () => {
  assert.match(html, /id="batchPickBar"/);
  assert.match(html, /id="batchLearnMore"/);
  assert.match(html, /id="batchDeep"/);
  assert.match(script, /const batchPicks = new Set\(\)/);
  // The whole card is the control — no separate "Select" button to hunt for — and it stays
  // keyboard-operable and announced as a toggle rather than a click handler on a div.
  assert.match(script, /card\.setAttribute\('role', 'button'\)/);
  assert.match(script, /card\.addEventListener\('keydown'/);
  assert.doesNotMatch(script, /textContent: 'Select'/);
  assert.match(script, /function renderBatchDeepDive\(\)/);
  assert.match(script, /HOW_TO_APPLY/);
  // The diagram is built from the brief, so it can never name a rail the batch does not use.
  // Applying stays possible before the bar is cleared — guidance, not a gate.
  assert.match(script, /bar is guidance, not a gate/);
  assert.match(styles, /\.bd-panel/);
  assert.match(styles, /\.bd-accepts/);
});

test('a selection made before the briefs load is not silently dropped', () => {
  // paint() repaints over the fallback cards; the selection must be re-applied.
  assert.match(script, /if \(!batchPicks\.has\(b\.dataset\.batchPick\)\) return;/);
});

// Referrals are club-first now: a club registers, names the vertical it feeds, and earns
// verified status from outcomes. The ladder is fetched from api/clubs.js rather than
// hardcoded, so what a club reads is what the code enforces.
test('school clubs can register and see the earned verification ladder', () => {
  assert.match(html, /id="clubRegisterForm"/);
  assert.match(html, /id="clubTiers"/);
  // Registering and being verified are different things, and the page must say so rather
  // than implying one leads to the other.
  assert.match(html, /Registering takes a minute/);
  assert.match(html, /Verification is earned/);
  assert.match(html, /name="clubVertical"/);
  assert.match(script, /action: 'club-tiers'/);
  // Reuses the existing intake — no new storage path, no new inbox.
  assert.match(script, /type: 'referrer_endorsement'/);
  assert.match(script, /intent: 'club_verification'/);
  // Earned, never granted — the honesty line has to survive into the UI.
  assert.match(html, /Nothing here is granted or sold/);
  // The assumption every club will otherwise make, contradicted before they make it.
  assert.match(html, /never substitutes for a member's own evidence/);
  assert.match(styles, /\.club-ladder/);
});

// "Join an elite batch in your field" pinned the old heading. The section now leads with the
// distinction instead, and "elite" survives where it belongs — on the batches that are.
test('elite is a tier on the batch, not the section headline', () => {
  assert.match(script, /brief\.tier === 'elite' \? 'Elite' : 'Open'/);
  assert.match(html, /Trials are the work/);
});

// Credibility is club-led now, and the geometric motif carries past the hero.
// The section was three paragraph cards plus a numbered list restating them. It is one
// figure now: three ways in converging on a ladder that is the same for everyone.
test('credibility is shown as a diagram, not restated in prose', () => {
  assert.match(html, /Three ways in/);
  assert.match(html, /class="cred-map"/);
  assert.match(html, /A verified club/);
  assert.match(html, /Vetted work/);
  // Faculty is present and visibly the lightest — dashed, greyed, stated in the label.
  assert.match(html, /lightest of the four/);
  // Built as markup, not SVG: an SVG diagram cannot inherit the type scale or the tokens,
  // which is why its labels overflowed their boxes and it read as a foreign flowchart.
  assert.doesNotMatch(html, /cred-fig/);
  assert.match(html, /class="cred-ladder"/);
  // The duplicate rung list is gone; the ladder draws it.
  assert.doesNotMatch(html, /class="cred-rungs"/);
  assert.doesNotMatch(html, /class="cred-doors"/);
});

test('the geometric motif extends past the hero and stays decorative', () => {
  assert.match(styles, /\.credibility-ladder::before/);
  // Decorative layers must never eat clicks.
  const motif = styles.slice(styles.indexOf('Geometric motif, carried past the hero'));
  assert.ok((motif.match(/pointer-events: none/g) || []).length >= 3);
});

test('batch selection has real feedback and respects reduced motion', () => {
  assert.match(styles, /@keyframes batchPickPulse/);
  assert.match(styles, /\.batch-card\.is-picked \.batch-mark/);
  const rm = styles.slice(styles.indexOf('@keyframes batchPickPulse'));
  assert.match(rm, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
});

test('joining the talent pool is name, email and school — not the four-step form', () => {
  assert.match(html, /data-action="student-quick"[^>]*data-join-mode="open"[^>]*>[\s\S]*Join now\s*[,—.]\s*choose later/);
  assert.doesNotMatch(html.match(/<section class="hero hero-student"[\s\S]*?<\/section>/)?.[0] || '', /Or add full details now/);
});

// The geometry is interactive, not wallpaper: selecting batches knits a link web, and the
// spine tracks reading position. Both are decorative and must stay out of the way.
test('selection draws a link web that never intercepts clicks', () => {
  assert.match(html, /id="batchWebCanvas"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(script, /function initBatchWeb\(\)/);
  assert.match(script, /batchWeb\?\.animate\(\)/);
  assert.match(styles, /\.batch-web > canvas[\s\S]*pointer-events: none/);
  // Cards must sit above the canvas or the whole board stops being clickable.
  assert.match(styles, /\.batch-web \.batch-grid \{ position: relative; z-index: 1; \}/);
});

test('the reading spine is decorative, scroll-passive and reduced-motion safe', () => {
  assert.match(html, /id="pageSpine"[^>]*aria-hidden="true"/);
  assert.match(script, /function initPageSpine\(\)/);
  // Scroll work is rAF-throttled and passive, or it fights the scroller.
  assert.match(script, /\{ passive: true \}/);
  assert.match(script, /requestAnimationFrame\(\(\) => \{ update\(\); ticking = false; \}\)/);
  assert.match(styles, /prefers-reduced-motion: reduce\)\s*\{\s*\.page-spine/);
});

// The demo is walked per vertical: a company asking "what does this look like for us" needs
// its own industry, because vetting differs per batch.
test('the demo walks each vertical separately and stays labelled illustrative', () => {
  assert.match(html, /id="verticalDemo"/);
  assert.match(html, /What this looks like for you/);
  assert.match(html, /Illustrative walkthrough\s*[,—.]\s*no real company/);
  assert.match(script, /action: 'vertical-demo'/);
  // A tablist has to be operable with arrow keys.
  assert.match(script, /ArrowRight/);
  assert.match(script, /setAttribute\('role', 'tab'\)/);
  assert.match(styles, /\.vdemo-beats/);
});

// The five-step explanation belongs inside the two-sided exchange, not in a second section
// that repeats the same process with another row of cards.
test('the work exchange contains one swipeable five-step trial', () => {
  assert.match(html, /id="exchangeStepViewport"/);
  assert.match(html, /id="exchangeStepTrack"/);
  assert.equal((html.match(/data-exchange-card/g) || []).length, 5);
  assert.match(html, /A company brings real work/);
  assert.match(html, /We shape a fair trial/);
  assert.match(html, /It reaches a vetted batch/);
  assert.match(html, /The student does the work/);
  assert.match(html, /The company decides/);
  assert.equal((html.match(/data-exchange-dot=/g) || []).length, 5);
  assert.match(styles, /\.exchange-step-viewport \{[\s\S]*?scroll-snap-type: x mandatory/);
  assert.match(styles, /\.exchange-step-card \{[\s\S]*?scroll-snap-align: start/);
  assert.match(styles, /@keyframes exchange-card-pop/);
  assert.match(script, /viewport\.addEventListener\('scroll'/);
  assert.match(script, /visibleStep = Math\.round\(viewport\.scrollLeft/);
  assert.match(script, /event\.key === 'ArrowRight'/);
  assert.doesNotMatch(html, /class="trial-flow"|id="tfTrack"|Five steps, start to finish/);
  assert.doesNotMatch(script, /function initTrialFlow\(\)/);
  assert.doesNotMatch(styles, /\.tf-viewport|\.tf-slide/);
});

test('the founder quote stands alone, unattributed and without a portrait', () => {
  assert.match(html, /Every ambitious student hits the same wall/);
  assert.doesNotMatch(html, /founder-portrait/);
  assert.doesNotMatch(html, /Tyler Park · founder/);
  assert.doesNotMatch(html, /assets\/tyler-park\.png/);
});

test('the company problem field lives inside the builder, with its fit chip', () => {
  // Everything that reads #companyProblemSeed (fit chip, demo prefill, project-fit scroll,
  // dialog handoff) still resolves after the backlog card was removed.
  assert.match(html, /<textarea id="companyProblemSeed" name="problem"/);
  assert.match(html, /id="companyFitChip"/);
  const builder = html.match(/<form class="ideal-builder"[\s\S]*?<\/form>/)?.[0] || '';
  assert.ok(builder.includes('companyProblemSeed'), 'problem field must be inside the builder form');
  assert.ok(builder.includes('companyFitChip'), 'fit chip must sit with the field it describes');
});

// app.js is a classic script: a top-level throw kills every line after it. A `let`/`const`
// assigned ABOVE its own declaration is a temporal-dead-zone ReferenceError that does exactly
// that — and it shipped once, silently breaking the batch board, the company builder, club
// registration, the demo tabs and the spine all at once. `new Function(script)` only PARSES,
// so it cannot catch this. This does.
test('no module-level binding is assigned before it is declared', () => {
  const lines = script.split('\n');
  const declaredAt = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^(?:let|const)\s+([A-Za-z_$][\w$]*)/);
    if (m && !declaredAt.has(m[1])) declaredAt.set(m[1], i);
  });
  const offenders = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\s{0,4}([A-Za-z_$][\w$]*)\s*=\s*[^=]/);
    if (!m) return;
    const at = declaredAt.get(m[1]);
    if (at !== undefined && at > i) offenders.push(`${m[1]}: assigned line ${i + 1}, declared line ${at + 1}`);
  });
  assert.deepEqual(offenders, [], 'temporal dead zone — these would throw at runtime');
});

// The tree is the vetting system, told top to bottom. It used to describe the model in the
// abstract ("the talent", "Covenda") without saying how anyone is actually vetted.
test('the tree explains the vetting system specifically', () => {
  assert.match(html, /Vetted twice, then proven/);
  assert.match(html, /Soil · the first vet/);
  assert.match(html, /Trunk · the second vet/);
  assert.match(html, /Three ways to prove it/);
  // The low-barrier rail must be named, since it is the one most fields actually use.
  assert.match(html, /recorded walkthrough where neither applies/);
  // Guardrails survive into the diagram.
  assert.match(html, /never a person score, never a ranking/);
  assert.match(html, /an operator decides and records why/);
});

// The gold word is painted with background-clip:text, so any glyph extending past the
// padding box renders TRANSPARENT — which is why the italic "f" in "proof" looked cut off.
// The padding must stay wide enough to cover Newsreader's italic overhang.
test('the gold word covers its italic overhang', () => {
  const rule = styles.match(/\.word-gold \{[\s\S]*?\}/)?.[0] || '';
  const pad = Number(rule.match(/padding-right:\s*([\d.]+)em/)?.[1] || 0);
  assert.ok(pad >= 0.4, `padding-right ${pad}em is too tight for an italic overhang`);
  assert.match(rule, /box-decoration-break: clone/);
});

// The hero field argues the thesis: a large visible crowd, rare shining talent, and
// periodic white-to-gold proof signals that make the idea readable without extra copy.
test('the hero field turns talent into proof while keeping white nodes dominant', () => {
  assert.match(script, /gold: Math\.random\(\) < \.1/);
  assert.match(script, /function spawnSignal\(now\)/);
  assert.match(script, /signals\.push\(\{ node, born: now, duration:/);
  assert.match(script, /const color = progress < \.22 \? WHITE : GOLD/);
  assert.match(script, /const target = Math\.max\(140, Math\.min\(240/);
  assert.match(script, /linkCount < 520/);
  // Real 3D: depth, perspective projection, and far-to-near paint order.
  assert.match(script, /function project\(n\)/);
  assert.match(script, /FOCAL \/ z/);
  assert.match(script, /sort\(\(a, b\) => nodes\[b\]\.z - nodes\[a\]\.z\)/);
  // Reduced motion gets a single static frame — no drift, no conversions, no parallax.
  assert.match(script, /if \(reduce\) return; \/\/ static frame only/);
});

// The first explanation is one two-way exchange, not another field of abstract nodes.
// A visitor can understand the static frame, then inspect each phase with any input method.
test('the work exchange turns one project into clear value for both sides', () => {
  assert.match(html, /class="exchange-section"/);
  assert.match(html, /id="workExchangeStory"/);
  assert.match(html, /id="workExchange"/);
  assert.match(
    html,
    /Swipe, use the arrow buttons, or press the arrow keys to move through five steps\./
  );
  assert.doesNotMatch(html, /Brief, Build, and Review/);
  assert.match(html, /One project\./);
  assert.match(html, /Two sides win\./);
  assert.match(html, /[Rr]eferred talent[\s\S]{0,60}trial both sides can trust/);
  for (const label of [
    'Real startup task',
    'Work the team needs done',
    'Referred student',
    'Talent vouched for by people who know them',
    'Scoped work trial',
    'A company brings real work',
    'We shape a fair trial',
    'It reaches a vetted batch',
    'The student does the work',
    'The company decides',
    'Useful deliverable',
    'Credible proof',
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /href="#bridgeStory"/);
  assert.match(html, /data-nav-target="bridgeStory"/);
  assert.match(script, /function initWorkExchange\(\)/);
  assert.match(script, /function setExchangeStep\(nextStep, userInitiated = false, shouldScroll = true\)/);
  assert.match(script, /viewport\.addEventListener\('pointerdown', takeControl/);
  assert.match(script, /event\.key === 'ArrowRight'/);
  assert.match(script, /event\.key === 'Home'/);
  assert.match(script, /window\.setInterval/);
  assert.match(script, /if \(reduce\) return; \/\/ Swipe and controls remain; only autoplay and pop motion stop\./);
  assert.match(styles, /\.exchange-stage \{[\s\S]*grid-template-areas:/);
  assert.match(styles, /\.exchange-dots \{[\s\S]*grid-template-columns: repeat\(5/);
  assert.match(styles, /\.exchange-source \{[\s\S]*border-radius: 0/);
  assert.match(styles, /\.exchange-output \{[\s\S]*border-radius: 0/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*"task student"[\s\S]*"bench bench"[\s\S]*"outputs outputs"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.exchange-source/);
  assert.doesNotMatch(html, /id="bridgeCanvas"/);
  assert.doesNotMatch(script, /function initBridge\(\)|function makeCloud\(|function drawCloud\(/);
  assert.doesNotMatch(script, /Columbia Consulting Group/);
  assert.match(styles, /body\[data-audience="home"\] \.stat-band/);
  assert.doesNotMatch(html, /The problem isn’t talent/);
});

test('the qualification rail is shorter and visually distinct from the trial carousel', () => {
  assert.match(html, /Before the project/);
  assert.match(html, /Vetted before the/);
  assert.match(html, /trial begins/);
  assert.match(html, /A referral starts the signal\. Evidence has to confirm it\./);
  for (const label of ['Referred', 'Evidence checked', 'Admitted to a batch', 'Ready for a trial']) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /Selective clubs and faculty screen first\. Covenda vets again/);
  assert.match(styles, /\.batch-funnel \.bf-track \{[\s\S]*grid-template-columns: repeat\(4/);
  assert.match(styles, /\.bf-card \{[\s\S]*border: 0;[\s\S]*background: transparent/);
  assert.match(styles, /\.batch-funnel\.is-armed \.bf-stage \{[\s\S]*scale\(\.96\)/);
  assert.match(styles, /\.batch-funnel\.is-playing \.bf-stage-4 \{ transition-delay: \.54s; \}/);
});

test('only the student path uses the folded-sheet transition, and it respects reduced motion', () => {
  assert.match(html, /id="audienceTransition"/);
  // Only the student path uses the wipe. The other two go straight through, which is a markup
  // decision — the gate is the attribute, so turning one on is a one-attribute change.
  assert.match(html, /data-audience-option="student" data-hero-entry/);
  for (const audience of ['company', 'university']) {
    assert.doesNotMatch(
      html,
      new RegExp(`data-audience-option="${audience}" data-hero-entry`),
      `the ${audience} path should not use the transition`,
    );
  }
  assert.match(script, /function transitionAudience\(audience\)/);
  // Gated on the attribute alone now — it means "entering from the home hero", which is when
  // the wipe makes sense — rather than on a hardcoded audience name.
  assert.match(script, /button\.matches\('\[data-hero-entry\]'\)/);
  assert.doesNotMatch(script, /audience !== 'student'/, 'the student-only gate is gone');
  // The label has to name the audience being entered, or the wipe says the wrong thing.
  assert.match(script, /AUDIENCE_TRANSITION_LABEL\[audience\]/);
  for (const label of ['For students', 'For companies', 'For referrers']) {
    assert.ok(script.includes(label), `missing transition label: ${label}`);
  }
  assert.match(script, /document\.body\.classList\.add\('is-audience-transitioning'\)/);
  assert.match(styles, /@keyframes audience-sheet-a/);
  assert.match(styles, /@keyframes audience-sheet-b/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.audience-transition \{ display: none; \}/);
});

// A referrer was told their "vouch gains weight" with nothing showing what that becomes.
test('the referral section shows the outcome, labelled illustrative', () => {
  assert.match(html, /What a referral becomes/);
  assert.match(html, /One vouch, six months on/);
  assert.match(html, /Your track record page/);
  // A vouch is a head start, never a bypass — that has to survive into the example.
  assert.match(html, /carries them to review, not past it/);
  // Numbers on a page with no outcome data must be labelled, every time.
  assert.match(html, /Covenda has no outcome data yet/);
  assert.match(html, /No student names, just the numbers/);
});

// The referral page opened with a roster form — asking for work before making the case.
// It now leads with the demonstration: how a founder hires undergraduates today, and what
// changes when the same thing is systematised.
test('the referral page argues before it asks', () => {
  assert.match(html, /Founders already ask you/);
  assert.match(html, /How it works today/);
  assert.match(html, /The same thing, systematised/);
  // The actual goal, stated: credibility a stranger will trust. The wording is allowed to
  // tighten — what must survive is that the page says it out loud.
  assert.match(html, /builds? credibility (that )?a stranger will trust/i);
});

// Self-rated scales carried no signal and contradicted the platform's own rule that
// self-report is never evidence. The application asks the batch's real questions instead.
test('the batch application asks real questions, not a self-rating survey', async () => {
  const portalJs = await readFile(new URL('../portal.js', import.meta.url), 'utf8');
  // portal.js is a separate classic script, so it is not the `script` fixture above.
  assert.match(portalJs, /brief&&brief\.questions/);
  assert.doesNotMatch(portalJs, /How deep are you in/);
  assert.doesNotMatch(portalJs, /how set are you on working in/);
  // How each answer is judged is stated up front.
  assert.match(portalJs, /How you bound the problem is the point/);
});

// Five batches per vertical means five columns on a wide screen, and every card fills its
// track — ragged heights came from cards sizing to their own summary instead of the row.
test('the batch grid is five even columns on a wide screen', () => {
  assert.match(styles, /@media \(min-width: 1180px\) \{ \.batch-row \{ grid-template-columns: repeat\(5/);
  assert.match(styles, /\.batch-card\.is-pickable \{[\s\S]*?height: 100%/);
  assert.match(styles, /\.batch-card\.is-pickable \{[\s\S]*?grid-template-rows: auto auto 1fr auto/);
  assert.match(styles, /\.batch-meta \{[\s\S]*?align-self: end/);
});

// .batch-grid used to hold cards directly; it now holds five <section class="batch-group">
// elements. Left as an auto-fit grid it laid the VERTICALS out as columns — five overlapping
// stacks with the cards crushed inside. Groups stack; only the row inside a group is a grid.
test('vertical groups stack down the page, not across it', () => {
  assert.match(styles, /\.batch-grid \{ display: block;/);
  assert.doesNotMatch(styles, /\.batch-grid \{ display: grid/);
  assert.match(styles, /\.batch-row \{ display: grid/);
});

// The batch panel is read by a STUDENT deciding whether to apply. It used to open with a
// process diagram (rails, bar, operator review) and carry the company's evaluation
// walkthrough — both written for someone deciding whether to trust the batch, which is not
// who is looking.
test('the batch panel answers what a student needs, not what a company wants', () => {
  assert.match(script, /What counts as evidence here/);
  assert.match(script, /What this batch asks of you/);
  assert.match(script, /How to apply/);
  // The company-facing process diagram and walkthrough are gone from the student board.
  assert.doesNotMatch(script, /function batchDiagram\(/);
  assert.doesNotMatch(script, /How you evaluate this batch/);
  // Evidence is named concretely enough to self-assess against.
  assert.match(script, /brief\.accepts/);
  assert.match(script, /apply anyway and say what it is/);
  assert.match(styles, /\.bd-accepts/);
});

test('the credibility heading lost the stranded numeral', () => {
  assert.doesNotMatch(html, /cred-big-num/);
  assert.doesNotMatch(styles, /\.cred-big-num/);
  assert.match(styles, /\.credibility-ladder \.section-heading \{ display: block/);
});

// Trials and batches both existed with no explanation of which to do or why, so a student
// had to guess. The relationship — trials earn the evidence, batches are what companies pay
// to search — is now stated once, plainly, with the direction between them shown.
test('the trial/batch distinction is stated, not left to inference', () => {
  assert.match(html, /Trials are the work/);
  assert.match(html, /Batches are the shortlist/);
  assert.match(html, /[Nn]o batch needed/);
  assert.match(html, /accepted trial work is the strongest way to clear it/);
  // Which to start with, said outright.
  assert.match(html, /[Nn]o evidence yet\?[\s\S]{0,40}[Ss]tart with trials/);
  assert.match(styles, /\.tb-split/);
});

// The portal nav was identical for every role — a student saw the operator submissions inbox,
// a company saw views built for students — and every view was named for the data model rather
// than the reader.
test('the portal nav is role-gated and named for the reader', async () => {
  const portalHtml = await readFile(new URL('../portal.html', import.meta.url), 'utf8');
  const portalJs = await readFile(new URL('../portal.js', import.meta.url), 'utf8');
  // Each item declares its roles in the markup, next to the thing it gates.
  assert.ok((portalHtml.match(/data-roles="/g) || []).length >= 8);
  assert.match(portalJs, /roles\.includes\(role\)/);
  assert.match(portalJs, /const NAV_LABELS = \{/);
  assert.match(portalJs, /student: \{ projects: 'My work'/);
  // A view that vanishes under the current role must not leave an empty pane behind.
  assert.match(portalJs, /if \(active && active\.hidden\) setView\('overview'\)/);
});

test('students can see their verification standing and where work stands', async () => {
  const portalHtml = await readFile(new URL('../portal.html', import.meta.url), 'utf8');
  const portalJs = await readFile(new URL('../portal.js', import.meta.url), 'utf8');
  assert.match(portalHtml, /id="verificationPanel"/);
  assert.match(portalHtml, /id="milestonePanel"/);
  assert.match(portalJs, /function renderVerification\(\)/);
  assert.match(portalJs, /function renderMilestones\(\)/);
  // The two rules that only matter if the student actually reads them.
  assert.match(portalJs, /it is the floor, not the proof/);
  // The rule, not the sentence — copy tightens, the guarantee does not. Being late must
  // stay safe and silence must stay the thing that costs you the work.
  assert.match(portalJs, /Running late is fine/);
  assert.match(portalJs, /Going quiet is what loses the work/);
});

// The other half of the signal readers reacted to was the ground, not the accent: warm cream
// under an amber gold. Gold stays; the neutrals it sits on are cool now.
test('the neutral palette carries no warm bias', () => {
  const warm = ['#fbf7ed', '#11110f', '#60605b', '#85857f', '#deded9', '#c9c9c2', '#fbf9f4'];
  for (const value of warm) {
    assert.ok(!styles.toLowerCase().includes(value), `${value} is a warm neutral from the old palette`);
  }
  assert.match(styles, /--gold: #b47b20/, 'the brand accent must not have changed');
  assert.match(styles, /--gold-pale: #f4f5f7/);
  assert.match(styles, /--ink: #0e1013/);
});

// The rule is SIZE, not importance. A serif at 15px reads as a mistake; the same face at 44px
// reads as a decision.
test('the serif is display-only and h3 downward stays in the grotesque', () => {
  for (const [, weight] of typeCss.matchAll(/\.t-(?:display-\w+|h1|h2)\s*\{[^}]*font-weight:\s*(\d+)/g)) {
    // A serif carries its own weight; 650 was calibrated for Geist and reads as a fake bold.
    assert.ok(Number(weight) <= 600, `display serif set at ${weight}, too heavy`);
  }
  assert.match(typeCss, /\.t-h3 \{ font-family: var\(--font-sans\)/, 'h3 must not be the serif');
  assert.match(typeCss, /\.t-body \{ font-family: var\(--font-body\)/);
});

// Every surface has to load the pair, or one page silently falls back to Helvetica.
test('every page loads the same two families', async () => {
  for (const page of ['index.html', 'portal.html', 'admin.html', 'cohort.html']) {
    const src = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(src, /family=Geist/, `${page} does not load Geist`);
    assert.match(src, /family=IBM\+Plex\+Mono/, `${page} does not load the mono`);
    assert.ok(!/Newsreader|Manrope/.test(src), `${page} still loads a retired face`);
  }
});

// Display tracking is the header treatment on the sites referenced: large, tight, and set in
// the body face rather than a contrasting display family.
test('display headings are tracked tight, and label tracking stays positive', () => {
  const displayRule = typeCss.match(/\.t-display-xl \{[^}]*\}/)[0];
  const tracking = Number(displayRule.match(/letter-spacing:\s*(-?[\d.]+)em/)[1]);
  assert.ok(tracking <= -0.03, `display tracking is ${tracking}em, too loose for a neo-grotesque`);

  // Eyebrows and uppercase labels need POSITIVE tracking; tightening those collapses the
  // small-caps rhythm.
  const eyebrow = typeCss.match(/\.t-eyebrow \{[^}]*\}/)[0];
  assert.match(eyebrow, /letter-spacing:\s*\.\d+em/, 'eyebrow tracking must stay positive');
});

// Sections added since the reveal list was written were never in it, so they simply appeared.
test('the newer sections are covered by the existing reveal observer', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const list = app.slice(app.indexOf('function initScrollReveal'), app.indexOf("].join(',')"));
  for (const sel of ['.about-lede', '.recruiter-lede', '.recruiter-card', '.rmap-row']) {
    assert.ok(list.includes(`'${sel}'`), `${sel} never reveals`);
  }
  // One observer, not two: a second would double-observe the overlap and fight over the class.
  assert.equal((app.match(/function initScrollReveal/g) || []).length, 1);
  assert.equal((app.match(/initScrollReveal\(\);/g) || []).length, 1);
});

// The hidden state must only exist when JavaScript is present to remove it, or a failed script
// leaves the page blank.
test('nothing is hidden unless the reveal can actually run', () => {
  assert.match(styles, /html\.js-reveal \.reveal \{/);
  assert.ok(!/^\.reveal \{[^}]*opacity: 0/m.test(styles), 'content is hidden without the js-reveal guard');
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,160}html\.js-reveal \.reveal \{ opacity: 1/);
});
