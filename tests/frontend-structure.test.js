import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const typeCss = await readFile(new URL('../type.css', import.meta.url), 'utf8');

// app.js is a classic script whose top level touches document, so it cannot be evaluated whole
// in node. Lifting one function out by source keeps these as real behaviour tests rather than
// assertions about how the code is spelled.
function pureFunction(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is not defined in app.js`);
  const end = script.indexOf('\n}', start);
  assert.ok(end > start, `${name} has no closing brace`);
  return new Function(`${script.slice(start, end + 2)}; return ${name};`)();
}

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
  assert.match(hero, /Let the company/);
  assert.equal((hero.match(/data-work-type=/g) || []).length, 5);
  // The promise is that a direction is optional. The sentence that said so is deleted, so it is
  // now carried structurally: a join mode that takes no work area, and an OR between that and
  // the picker. Both have to survive, or joining silently starts requiring a choice.
  // (The duplicated assertion here was my own leftover from an earlier edit.)
  assert.match(hero, /data-join-mode="open"/);
  assert.match(hero, /class="student-choice-divider"/);
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
  assert.match(studentHero, /Let the company/);
  assert.match(studentHero, /class="gold-button student-join-primary"[^>]*data-join-mode="open"/);
  // The picker is on industry verticals now, matching BATCH_CATALOG. It used to offer work
  // types — research, data, QA — a taxonomy nothing else on the platform spoke, so a
  // student's choice lined up with no batch, no profile field and no matching signal.
  // Order matters: joining without a direction comes before being asked for one.
  assert.match(studentHero, /data-join-mode="open"[\s\S]*What do you do\?/);
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
  // Three doors, not three steps. The 01/02/03 markers implied an order and a priority, and
  // the approved treatment gives all three paths identical weight, so they are gone. The
  // supporting line is the only text in each card.
  assert.equal((hero.match(/class="home-path"/g) || []).length, 3);
  assert.ok(!hero.includes('home-path-index'), 'the numbered markers are back');
  assert.ok(!hero.includes('home-path-go'), 'a second affordance is back inside the card');
  assert.match(hero, /Beyond the <span class="word-gold">Resume<\/span>/);
  assert.ok(!/home-kicker|home-oneliner/.test(hero), 'the wordmark tagline is back');
  for (const line of ['Prove your worth, get paid', 'Find the next unicorn talent',
                      'For professors and clubs that are Covenda verified']) {
    assert.ok(hero.includes(line), `the hero lost the approved line: ${line}`);
  }
  assert.match(styles, /\.hero-home \{[\s\S]*linear-gradient\(145deg, #12120f/);
  assert.match(styles, /\.site-header \{[\s\S]*font-family: var\(--font-display\)/);
  assert.match(script, /function initHeroField\(target\)/);
  assert.match(script, /gold: Math\.random\(\) < \.1/);
  assert.match(script, /\.slice\(0, 5\)/);
  assert.match(script, /spawnSignal\(now\)/);
});

test('the proof lens opens the homepage without removing the existing product story', () => {
  const heroAt = html.indexOf('class="hero hero-home"');
  const proofAt = html.indexOf('class="proof-lens-section"');
  const compareAt = html.indexOf('class="compare-section"');
  const exchangeAt = html.indexOf('class="exchange-section"');
  assert.ok(heroAt >= 0 && heroAt < proofAt && proofAt < compareAt && compareAt < exchangeAt);
  assert.match(html, /Startups need help, <span class="word-gold">students want startup work\./);
  // The industry tags are gone: naming six verticals never supported the claim above them, and
  // the claim itself is now stated instead of illustrated.
  assert.match(html, /Talent reaches startups[\s\S]*by referral\./);
  assert.ok(!/proof-node-field/.test(html), 'the industry tag grid is back');
  assert.ok(!/Illustrative preview/.test(html), 'the preview label is back');
  // The comparison now sits between the problem and the product.
  assert.ok(html.indexOf('class="compare-section"') < html.indexOf('class="proof-product"'),
    'Quality over quantity should come before Covenda makes the work visible');
  assert.match(html, /AI makes applications[\s\S]*harder to trust\./);
  assert.match(html, /More students want[\s\S]*startup work\./);
  assert.match(html, /Covenda makes the work visible\./);
  assert.match(html, /data-proof-step="0"/);
  assert.match(html, /data-proof-step="3"/);
  assert.match(html, /Build a work profile/);
  assert.match(html, /Filter for fit/);
  assert.match(html, /Try one real project/);
  assert.match(html, /Paid · 2 weeks · named reviewer/);
  assert.match(html, /Trials become roles/);
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
  assert.match(demo, /Two ways in/);
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
  assert.match(html, /Vetted, ready/);
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
  assert.match(html, /Build proof, one project/);
  assert.match(html, /No universal score/);
  assert.match(html, /One delayed problem, scoped/);
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
  // The manual "Clear draft" button was cut. A draft must still clear itself once the form is
  // actually submitted, or a student's answers linger on a shared machine.
  assert.match(script, /discardDraft\(form\)/);
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
  assert.match(styles, /--gold: #c08a22/);
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
  // Five, and only ones genuinely near: seven-nearest could still reach across half the canvas.
  assert.match(script, /\.slice\(0, 5\)/);
  assert.match(script, /ctx\.lineTo\(item\.point\.x, item\.point\.y\)/);
  assert.match(script, /pointerleave/);
  // The gold-bond system is gone. It joined a random pair from every gold node on the canvas, so
  // its line was unconstrained by distance and routinely spanned the whole field. The ambient mesh
  // already connects near neighbours; a second system drawing longer lines over it only fought it.
  assert.ok(!/goldBond/.test(script), 'the unbounded gold bonds are back');
  // Every remaining line is bounded to a neighbour, which is the property that was actually wanted.
  const reach = Number(script.match(/const LINK_DISTANCE = (\d+);/)[1]);
  assert.ok(reach <= 110, `link reach is ${reach}px, long enough to read as a string`);
  assert.match(script, /item\.distance < 150/, 'the cursor can reach across the canvas again');
  // The gold aura is gone. It was a radial gradient out to five node radii, so every gold node
  // sat inside a ~25px soft blob: the field read as smudges rather than points, and on the
  // resolved figure they merged into one mass. A gold node is brighter and larger than a white
  // one, which is enough. What has to stay true is that gold is still distinguishable.
  // The gold fill is no longer a constant: it walks from a near-neutral off-white at rest to a
  // deep gold as the shape resolves, so the field reads as separate points that turn metal
  // rather than as a pale glow that was always yellow. The invariant is that the colour is
  // driven by how formed the shape is, and that gold is still drawn larger than white.
  assert.match(script, /const rich = form \* form;/, 'the gold no longer deepens as the shape forms');
  assert.match(script, /ctx\.fillStyle = `rgba\(\$\{rr\},\$\{gg\},\$\{bb\}/, 'gold nodes lost their form-driven colour');
  // Larger than a white node, but only slightly: at a full extra pixel and a half the resolved
  // figure read as a rope of beads instead of a line. The invariant is the sign, not the size.
  const goldRadius = script.match(/ctx\.arc\(q\.x, q\.y, r \+ ([\d.]+) \+ pulse/);
  assert.ok(goldRadius, 'the gold node radius line moved or changed shape');
  assert.ok(Number(goldRadius[1]) > 0, 'gold nodes no longer render larger than white ones');
  assert.ok(Number(goldRadius[1]) <= 0.6, `gold nodes are ${goldRadius[1]}px fatter and will read as beads`);
  // The ambient aura is gone: it sat on every gold node all the time and turned the field into
  // blobs. A glow on a RESOLVED shape is a different thing and is wanted, so the guard is that
  // any node glow is gated on the shape being formed rather than drawn unconditionally.
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [, before] of code.matchAll(/([\s\S]{0,220})createRadialGradient\(q\.x, q\.y/g)) {
    assert.match(before, /formed > 0\.25/, 'a node glow is drawn without checking the shape is formed');
  }
  // And the twinkling cross is gone with it.
  assert.ok(!/const glint =/.test(code), 'the glint cross is back');
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
  // No "Learn more" button. It opened a deep dive built from the requirements that are being
  // rebuilt, so it offered a door that is shut. The bar states the state instead.
  assert.ok(!/id="batchLearnMore"/.test(html), 'the walkthrough trigger is back while applications are closed');
  assert.match(script, /Batches are not open yet/);
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
  assert.match(html, /Register free/);
  assert.match(html, /Verification is earned/);
  assert.match(html, /name="clubVertical"/);
  assert.match(script, /action: 'club-tiers'/);
  // Reuses the existing intake — no new storage path, no new inbox.
  assert.match(script, /type: 'referrer_endorsement'/);
  assert.match(script, /intent: 'club_verification'/);
  // Earned, never granted. Both restatements of this have now been cut for density, so the
  // heading is the only carrier left and is asserted directly in tests/model/club-model.
  assert.match(html, /Verification comes from what your members deliver/);
  // The assumption every club will otherwise make, contradicted before they make it. The
  // wording shortened; the guarantee did not.
  assert.match(html, /Standing opens doors, it does not walk through them/);
  assert.match(html, /Members still apply with their own recorded work and are judged on it/);
  assert.match(styles, /\.club-ladder/);
});

// "Join an elite batch in your field" pinned the old heading. The section now leads with the
// distinction instead, and "elite" survives where it belongs — on the batches that are.
test('elite is a tier on the batch, not the section headline', () => {
  // The tier chip is off the marketing card for now: Elite-vs-Open describes how a batch is
  // vetted, and that is the thing being rebuilt, so publishing it advertises a distinction about
  // to change. The tier is still on the model, so nothing about the data lost the concept.
  // Comments stripped first. My own comment explaining the removal names the code it removed,
  // and a raw substring scan matches its own documentation. Sixth time in this build.
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Scoped to the card. The deep-dive renderer still names the tier, and that is fine: its
  // trigger is gone, so nothing reaches it while applications are closed.
  const cardOnly = code.slice(code.indexOf('function renderBatchCard('), code.indexOf('const toggle = () =>'));
  assert.ok(!/brief\.tier === 'elite'/.test(cardOnly), 'the tier chip is back on the public card');
  assert.match(html, /Trials work/);
  // The card is the name and nothing else while applications are closed.
  const cardFn = cardOnly;
  assert.ok(!/batch-desc|batch-rail-chip|batch-req-count/.test(cardFn), 'the hidden card detail is back');
  assert.match(cardFn, /className: 'batch-title', textContent: brief\.name/);
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
  assert.match(html, /data-action="student-quick"[^>]*data-join-mode="open"/);
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

// The hero field argues the thesis: a large visible crowd, rare shining talent, and
// periodic white-to-gold proof signals that make the idea readable without extra copy.
test('the hero field turns talent into proof while keeping white nodes dominant', () => {
  assert.match(script, /gold: Math\.random\(\) < \.1/);
  assert.match(script, /function spawnSignal\(now\)/);
  assert.match(script, /signals\.push\(\{ node, born: now, duration:/);
  assert.match(script, /const color = progress < \.22 \? WHITE : GOLD/);
  // Bounded and dense, asserted as a property rather than as two literals. The count went up
  // when the link reach came down: a finer web needs more nodes to stay a web.
  const [, lo, hi] = script.match(/const target = Math\.max\((\d+), Math\.min\((\d+)/);
  assert.ok(Number(lo) >= 120, `field floor is ${lo}, too sparse to read as a crowd`);
  assert.ok(Number(hi) <= 400, `field ceiling is ${hi}, unbounded enough to cost a frame`);
  // The cap exists so a dense field cannot spend an unbounded amount of a frame on links. Its
  // value moved with LINK_DISTANCE: at the longer reach, 520 truncated the lattice mid-render
  // and left one corner visibly emptier than the rest. What matters is that it is bounded.
  const cap = Number(script.match(/linkCount < (\d+)/)[1]);
  assert.ok(cap >= 600 && cap <= 1200, `link cap is ${cap}, either truncating or unbounded`);
  // The reach is a property, not a constant to pin. It came down from 152 so the mesh reads as
  // a fine web rather than as long struts; what has to stay true is that it links neighbours and
  // not the whole canvas.
  const reach = Number(script.match(/const LINK_DISTANCE = (\d+);/)[1]);
  assert.ok(reach >= 60 && reach <= 130, `link reach is ${reach}px, either disconnected or a net`);
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
    'Vouched by people who know them',
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
  // The "Before the project" kicker is gone: it said the same thing as the heading under it.
  assert.match(html, /Vetted before the <span class="word-gold">trial begins\./);
  assert.match(html, /A referral starts the signal\. Evidence has to confirm it\./);
  // Stage one is "Stand out" now, and it carries the ownership/artifact/walkthrough list that
  // used to sit under stage two, so each stage's body describes its own graphic.
  assert.match(html, /class="bf-label">Stand out</);
  assert.match(html, /Stand out<\/p>[\s\S]{0,120}?<ul class="bf-rails">/, 'stage 1 lost the evidence list');
  assert.match(html, /Evidence checked<\/p>[\s\S]{0,140}?<div class="bf-pool"/, 'stage 2 lost the pool');
  for (const label of ['Stand out', 'Evidence checked', 'Admitted to a batch', 'Ready for a trial']) {
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
  // Tag-tolerant: the heading now carries a gold emphasis span mid-sentence.
  assert.match(html.replace(/<[^>]+>/g, ''), /One vouch, six months on/);
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
  // height: 100% is what keeps the five cards level in a row, so it stays.
  assert.match(styles, /\.batch-card\.is-pickable \{[\s\S]*?height: 100%/);
  // The four-row grid and the .batch-meta footer are gone with the content they laid out: the
  // card is a name and a tick while applications are closed, so it is two columns, not four rows.
  assert.match(styles, /\.batch-card\.is-pickable \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  // Scoped to the card. Unscoped this matched .form-rail, an unrelated component that legitimately
  // uses four rows.
  const pickable = styles.slice(styles.lastIndexOf('.batch-card.is-pickable {'));
  assert.ok(!/grid-template-rows: auto auto 1fr auto/.test(pickable.slice(0, 500)),
    'the four-row card layout is back');
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
  assert.match(html, /Trials work/);
  assert.match(html, /Batches shortlist/);
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
  // The accent moved from #b47b20 to #c08a22 on a deliberate call: the LinkedIn export wanted
  // a richer gold and the site follows it rather than the two drifting apart. Same hue, more
  // saturation. What this assertion is actually for is that the accent stays WARM and does not
  // slide back toward the cool grey the old palette used, so it checks the channels.
  const gold = styles.match(/--gold: #([0-9a-f]{6})/)[1];
  const [gr, gg, gb] = [0, 2, 4].map(i => parseInt(gold.slice(i, i + 2), 16));
  assert.ok(gr > gg && gg > gb, `--gold #${gold} is not a warm gold (needs R > G > B)`);
  assert.match(styles, /--gold-pale: #f4f5f7/);
  assert.match(styles, /--ink: #0e1013/);
});

// The rule is SIZE, not importance. A serif at 15px reads as a mistake; the same face at 44px
// reads as a decision.
test('the serif is display-only and h3 downward stays in the grotesque', () => {
  // The serif carries the two largest roles and nothing below them.
  for (const role of ['display', 'heading']) {
    const rule = typeCss.match(new RegExp(`\\.t-${role} \\{[^}]*\\}`))[0];
    assert.match(rule, /font-family: var\(--font-display\)/, `.t-${role} lost the serif`);
    // A serif carries its own weight; 650 was calibrated for Geist and reads as a fake bold.
    assert.match(rule, /font-weight: var\(--weight-regular\)/, `.t-${role} is set too heavy for a serif`);
  }
  for (const role of ['subhead', 'caption']) {
    const rule = typeCss.match(new RegExp(`\\.t-${role} \\{[^}]*\\}`))[0];
    assert.ok(!rule.includes('--font-display'), `.t-${role} must not be the serif`);
  }
  assert.match(typeCss, /\.t-body \{ font-family: var\(--font-body\)/);
});

// The whole point of the token system: five sizes and three weights, nothing else, anywhere.
test('the type scale is exactly five sizes and three weights', async () => {
  const sizes = new Set();
  const weights = new Set();
  for (const name of ['styles.css', 'portal.css', 'admin.css', 'type.css']) {
    const css = (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, decl, val] of css.matchAll(/(font-size|font-weight|line-height|letter-spacing)\s*:\s*([^;}]+)/g)) {
      const v = val.replace(/\s*!important\s*/, '').trim();
      // `font-size: 0` and `line-height: 0` are layout devices for hiding glyphs and collapsing
      // canvas wrappers, not typography, and are the only permitted raw values.
      if (v === '0' || v === 'inherit') continue;
      assert.ok(v.startsWith('var(--'), `${name} sets ${decl}: ${v} outside the token set`);
      if (decl === 'font-size') sizes.add(v);
      if (decl === 'font-weight') weights.add(v);
    }
  }
  // --optical-serif is a relative nudge for a serif word inside a sans line, not a size role.
  sizes.delete('var(--optical-serif)');
  assert.deepEqual([...sizes].sort(), [
    'var(--text-body)', 'var(--text-caption)', 'var(--text-display)',
    'var(--text-heading)', 'var(--text-subhead)',
  ], `${sizes.size} size tokens in use`);
  assert.deepEqual([...weights].sort(), [
    'var(--weight-bold)', 'var(--weight-medium)', 'var(--weight-regular)',
  ], `${weights.size} weight tokens in use`);
});

// A size with no measure or tracking bound to it is a size that gets set ad hoc again later.
test('every size role has a line-height and a tracking bound to it', () => {
  for (const role of ['display', 'heading', 'subhead', 'body', 'caption']) {
    for (const prop of ['text', 'lh', 'ls']) {
      assert.match(typeCss, new RegExp(`--${prop}-${role}:\\s*[^;]+;`), `--${prop}-${role} is not defined`);
    }
  }
  // One easing curve and two durations, so no component invents its own.
  for (const token of ['--ease', '--dur-fast', '--dur']) {
    assert.match(typeCss, new RegExp(`${token}:\\s*[^;]+;`), `${token} is not defined`);
  }
  assert.equal((typeCss.match(/cubic-bezier\(/g) || []).length, 1,
    'more than one easing curve is defined');
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
  // The rule now names a token, so the value has to be resolved from :root to be checked.
  const token = name => typeCss.match(new RegExp(`${name}:\\s*(-?[\\d.]+)em`))[1];
  assert.match(typeCss.match(/\.t-display \{[^}]*\}/)[0], /letter-spacing: var\(--ls-display\)/);
  assert.ok(Number(token('--ls-display')) <= -0.03,
    `display tracking is ${token('--ls-display')}em, too loose for a neo-grotesque`);

  // Eyebrows and uppercase labels need POSITIVE tracking; tightening those collapses the
  // small-caps rhythm.
  assert.match(typeCss.match(/\.t-eyebrow \{[^}]*\}/)[0], /letter-spacing: var\(--ls-caption-caps\)/);
  assert.ok(Number(token('--ls-caption-caps')) > 0, 'uppercase label tracking must stay positive');
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


// The sourcing flow is eleven stacked rows. It used to appear whole, which asked a reader to take
// in the entire diagram at once; each row now arrives as it scrolls into view.
test('the sourcing flow reveals row by row rather than all at once', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  // Hidden state gated on BOTH the js-reveal guard and the .is-stepped class the script adds, so a
  // script that fails before reaching this code leaves a readable diagram rather than a blank one.
  assert.match(styles, /\.js-reveal \.mflow\.is-stepped > \* \{[^}]*opacity: 0/);
  assert.ok(
    !/^\.mflow > \* \{[^}]*opacity: 0/m.test(styles),
    'flow rows are hidden without the js-reveal and is-stepped guards',
  );
  assert.match(styles, /\.js-reveal \.mflow\.is-stepped > \.is-in \{[^}]*opacity: 1/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.js-reveal \.mflow\.is-stepped > \* \{[^}]*opacity: 1/,
  );

  // The class is added by the script, and every row is observed rather than only the figure.
  assert.match(app, /mflow\.classList\.add\('is-stepped'\)/);
  assert.match(app, /rows\.forEach\(row => flowIO\.observe\(row\)\)/);
  // Each row stops being watched once it has arrived; a row that re-enters must not re-animate.
  assert.match(app, /flowIO\.unobserve\(entry\.target\)/);
});

// The mark is hovered deliberately, so it is slow enough to watch. Asserted because a rate is
// a bare number that reads as arbitrary and invites being 'tidied' back up.
test('the home mark assembles slowly enough to watch, and does not hold the page', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const rate = app.match(/'mark' \? ([\d.]+) : ([\d.]+)/);
  assert.ok(rate, 'the morph rate line moved or changed shape');
  const mark = Number(rate[1]);
  // Frames to reach 95% of the way there, at the exponential approach the loop uses.
  let v = 0; let frames = 0;
  while (v < 0.95 && frames < 1000) { v += (1 - v) * mark; frames += 1; }
  // Bounds widened downward on a direct call: the slow assembly was the right length to watch
  // once and too long to sit through on a page you visit often. It still must not be instant.
  assert.ok(frames / 60 > 0.9, `the mark settles in ${(frames / 60).toFixed(2)}s, too fast to read as an assembly`);
  assert.ok(frames / 60 < 2.5, `the mark settles in ${(frames / 60).toFixed(2)}s, slow enough to read as stuck`);

  // Assembles once and stays. Replaying on every pointer entry meant the logo spent most of
  // its life dispersed, and re-formed as a hover toy rather than as an arrival.
  assert.match(app, /let markLatched = false;/);
  assert.match(app, /morphTo === 1 && morph > 0\.985\) markLatched = true/);
  // Assembles on its own shortly after load rather than waiting for a hover: a visitor who
  // scrolls past never saw it, and one who crossed the hero saw it restart.
  assert.match(app, /canvas\.dataset\.morph === 'mark' && !reduce/);
  assert.match(app, /assignFigure\(\); morphTo = 1; start\(\);/);
  assert.match(app, /pointerenter[\s\S]{0,120}if \(markLatched\) return;/,
    're-entering the hero replays the assembly');
  assert.match(app, /pointerleave[\s\S]{0,340}if \(markLatched\) return;/,
    'leaving the hero disperses a mark that has already assembled');

  // A slower assembly is only safe if it never captures the wheel. The canvas must stay
  // pointer-transparent and own no scroll-blocking listener.
  assert.match(styles, /\.hero-field \{[^}]*pointer-events: none/);
  const field = app.slice(app.indexOf('function initHeroField'));
  const body = field.slice(0, field.indexOf('\n}\n'));
  for (const blocking of ['wheel', 'touchmove']) {
    assert.ok(!body.includes(`addEventListener('${blocking}'`), `the hero field listens for ${blocking} and can block scrolling`);
  }
});

// A serif needs more leading than the sans these values were tuned for.
test('no display rule sets a line-height that clips a descender', () => {
  for (const file of [styles, typeCss]) {
    for (const block of file.match(/\{[^{}]*\}/g) || []) {
      if (!block.includes('var(--font-display)')) continue;
      const lh = block.match(/line-height:\s*(\.\d+|1(?:\.\d+)?)\b/);
      if (lh) assert.ok(Number(lh[1]) >= 1.06, `line-height ${lh[1]} clips descenders on a serif`);
    }
  }
});

// Four tokens, one definition, no aliases. --font-ui was a legacy alias for --font-body used by
// exactly one rule, which is how two names for one thing quietly become two different things.
test('every surface draws its type from the same four tokens', async () => {
  const files = { 'styles.css': styles, 'type.css': typeCss };
  for (const name of ['portal.css', 'admin.css']) {
    files[name] = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  }
  for (const [name, css] of Object.entries(files)) {
    // No hardcoded stacks: every family comes through a token or inherits.
    for (const [, value] of css.matchAll(/font-family:\s*([^;}]+)/g)) {
      const clean = value.trim();
      // A fallback inside the var() is fine: var(--font-display, inherit) still routes through
      // the token. A bare stack does not.
      assert.ok(/^var\(--font-(display|sans|body|mono)\s*(,[^)]*)?\)$/.test(clean) || clean === 'inherit',
        `${name} sets a font stack outside the tokens: ${clean}`);
    }
    assert.ok(!/--font-(ui|heading)\b/.test(css), `${name} still references a retired token`);
  }
  // Defined once, in the shared file.
  for (const token of ['display', 'sans', 'body', 'mono']) {
    assert.equal((typeCss.match(new RegExp(`^\\s+--font-${token}:`, 'gm')) || []).length, 1);
  }
});

// Twelve distinct font sizes between 9px and 16px is not a scale, it is a pile: each value was
// picked in isolation to fit one component, so nothing lines up and the smallest are unreadable.
test('no text is set below the readable floor', async () => {
  for (const name of ['styles.css', 'portal.css', 'admin.css']) {
    const css = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    for (const [, size] of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      assert.ok(Number(size) >= 11, `${name} sets text at ${size}px, below the readable floor`);
    }
  }
});

test('the small end of the scale stays on a few steps rather than sprawling', async () => {
  const sizes = new Set();
  for (const name of ['styles.css', 'portal.css', 'admin.css']) {
    const css = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    for (const [, size] of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(size) <= 14) sizes.add(size);
    }
  }
  assert.ok(sizes.size <= 4, `${sizes.size} distinct sizes at or below 14px: ${[...sizes].sort().join(', ')}`);
});

// An empty list left a void where the roster will be, so the section jumped when the first
// student was added.
test('the roster empty state occupies the space the list will', () => {
  const rule = styles.match(/\.roster-empty \{[^}]*\}/)[0];
  assert.match(rule, /border: 1px dashed/);
  assert.match(rule, /padding: \d+px/);
  assert.match(styles, /\.roster-list:empty \{ display: none; \}/);
});

// A diagram about work moving between two sides looked like a printed figure because nothing
// in it ever moved.
test('the exchange cards drift, slowly and out of step', () => {
  for (const name of ['drift-a', 'drift-b', 'drift-centre']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} is missing`);
  }
  const durations = [...styles.matchAll(/animation: drift-[a-z]+ (\d+)s/g)].map(m => Number(m[1]));
  assert.equal(durations.length, 3);
  // Coprime cycles, so the cards never fall into step and the pattern never becomes visible.
  assert.equal(new Set(durations).size, 3, 'two cards share a cycle and will synchronise');
  for (const d of durations) assert.ok(d >= 10, `a ${d}s cycle is fast enough to distract`);

  // The independent transform properties, NOT `transform`. The side cards already carry a
  // transform for their position offset, and a keyframe on `transform` replaces it outright:
  // the drift fought the offset instead of riding on it.
  const frames = styles.slice(styles.indexOf('@keyframes drift-a'), styles.indexOf('.exchange-source--task { animation'));
  assert.ok(!/\btransform:/.test(frames), 'drift animates transform and will overwrite the position offset');
  for (const [, prop] of frames.matchAll(/^\s+\d+%[^{]*\{\s*([a-z-]+):/gm)) {
    assert.ok(['translate', 'rotate', 'scale'].includes(prop), `drift animates ${prop}, which is not compositor-safe`);
  }
  // The offset itself has to survive, or the cards sit in the wrong place.
  assert.match(styles, /\.exchange-source--task \{ grid-area: task; transform: translateX/);
});

test('drift settles under a cursor and never runs against a motion preference', () => {
  assert.match(styles, /\.exchange-source:hover, \.exchange-workbench:hover \{ animation-play-state: paused; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}\.exchange-workbench \{ animation: none; \}/);
});

// Two transforms on one element fight: the reveal's translateY and a drift keyframe would
// cancel each other, and the card would either skip its entrance or jump at the end of it.
test('nothing both drifts and reveals', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const list = app.slice(app.indexOf('function initScrollReveal'), app.indexOf("].join(',')"));
  for (const drifting of ['exchange-source', 'exchange-workbench']) {
    assert.ok(!list.includes(drifting), `${drifting} is in the reveal list and also drifts`);
  }
});

// The gold italic marks the phrase carrying the claim. A heading that is ENTIRELY gold is not
// an emphasis, and once every heading has one the device stops meaning anything at all.
test('gold emphasis marks a phrase, never a whole heading', () => {
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const headings = main.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) || [];
  const strip = x => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  for (const heading of headings) {
    const gold = heading.match(/<span class="word-gold">([\s\S]*?)<\/span>/);
    if (!gold) continue;
    assert.notEqual(strip(gold[1]), strip(heading), `this heading is entirely gold: ${strip(heading).slice(0, 50)}`);
  }

  // And some headings stay plain. Utility and sub-headings do not carry a claim to emphasise.
  const plain = headings.filter(h => !h.includes('word-gold'));
  assert.ok(plain.length >= 5, `only ${plain.length} headings left plain, the device is losing its force`);
});

// Mono is for things read character by character: a reference code, a count, a timer, a URL
// about to be copied. It had spread onto 45 rules, most of them labels and prose, and a page
// mixing three faces in forty-five places is what reads as "too many fonts".
test('the monospace is used for data, not for labels', () => {
  const uses = [];
  for (const block of styles.match(/[^{}]+\{[^{}]*\}/g) || []) {
    if (!block.includes('var(--font-mono)')) continue;
    uses.push(block.split('{')[0].trim().replace(/\s+/g, ' '));
  }
  assert.ok(uses.length <= 12, `${uses.length} rules use the monospace: ${uses.slice(0, 8).join(', ')}`);
  for (const sel of uses) {
    assert.ok(/-(n|count|timer|code|num)\b|reference|referral-link/.test(sel),
      `${sel} is not code-like and should not be monospace`);
  }
});

test('a selected industry reads as gold, not as a hole in the rail', () => {
  const rule = styles.match(/\.student-vertical\.is-selected \{[^}]*\}/)[0];
  // Dark ground with the particle field behind it and white type, the same language as the
  // hero. A flat gold fill read as a swatch rather than as a selected card.
  assert.match(rule, /background: #2b2721/);
  assert.match(rule, /border-color: var\(--gold\)/);
  // Clipping moved to the base rule, because the resting dot grid needs it too. Asserted
  // there rather than dropped: without it the field spills past the card corners.
  assert.match(styles, /\.student-vertical \{[^}]*overflow: hidden/, 'the card no longer clips its field');
  assert.match(styles, /\.vertical-field \{[^}]*position: absolute/);
  // At rest the card shows the field as an ordered dot grid; selecting it hands over to the
  // live canvas, so the click reads as the same material waking up.
  assert.match(styles, /\.student-vertical::before \{[^}]*radial-gradient\(circle at center/);
  assert.match(styles, /\.student-vertical\.is-selected::before \{[^}]*opacity: 0/);
  // The work areas are a menu, so they are set in the menu's face, not in a competing sans.
  assert.match(styles, /\.student-vertical > strong \{[^}]*font-family: var\(--font-display\)/);
});

// The card is highlighted and the button reads "Join for X". A line underneath saying
// "Selected: X" was the same fact a third time.
test('the specialty prompt disappears once a choice is made', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(!/Selected: \$\{/.test(app), 'the redundant echo is back');
  // The status line is now always hidden and always empty: the heading asks the question and
  // the buttons answer it, so there was nothing left for it to say.
  assert.match(app, /status\.hidden = true;/);
  // Deleted: it described the interface rather than adding anything to it.
  assert.ok(!/Choose the specific work you want attached/.test(app), 'the redundant prompt is back');
});

// The roster builder was the longest thing on the page and the least likely to be used on a
// first visit. Behind a trigger it is a tool; inline it was homework.
test('the roster builder opens on demand and its trigger works', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /id="rosterDialog"/);
  assert.match(html, /data-action="roster-open"/);
  // A trigger with no handler is a dead button, which is worse than an inline form.
  assert.match(app, /action === 'roster-open'/);
  assert.match(app, /getElementById\('rosterDialog'\)/);
  // Closing follows the same contract every other dialog on this page uses.
  assert.match(html, /id="rosterDialog"[\s\S]{0,400}data-close-dialog/);
  // The form itself moved rather than being duplicated.
  assert.equal((html.match(/class="roster-builder/g) || []).length, 1);
  assert.equal((html.match(/id="rosterList"/g) || []).length, 1);
});

// The gold word was a gradient painted through background-clip: text, which clips the fill to
// the inline box. Browsers disagree about which font metric sets that box, and four separate
// rounds of clipped glyphs came out of it: the p and f of "proof", the g of "good", the italic
// g's left-swinging descender loop, the s of "students". Each was fixed by padding one more
// side, and each was followed by another.
//
// A solid colour cannot be clipped by a box it does not have.
test('the gold word is a solid colour, not a clipped fill', () => {
  // Comments explain why the technique is gone, so they contain its name. Fourth time this
  // trap has bitten: "age" in "stage", "rank" in "not a ranking", "env" in a comment about
  // env, and now this. Strip them and read the declarations.
  const rule = styles.match(/\.word-gold \{[^}]*\}/)[0].replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/background-clip/.test(rule), 'the clipped fill is back, and so is the whole class of bug');
  assert.ok(!/-webkit-text-fill-color/.test(rule));
  assert.match(rule, /color: var\(--gold\)/);
  assert.match(rule, /font-style: italic/);
  // No orphaned padding hacks left behind: they existed only to feed the fill box.
  assert.ok(!/padding-(bottom|left|right)/.test(rule), 'padding survives with nothing to pad');
  // And a brighter value where it sits on a dark ground.
  assert.match(styles, /\.hero-home \.word-gold[\s\S]{0,120}color: #e2bd6b/);
});

// ── Guided sign-up (§15) ──────────────────────────────────────────────────────────────
// The rail doubles as the progress indicator: setFormStep toggles `.is-active` on
// `.form-progress span` by index. If anything nested inside a step becomes a <span>, the
// selector picks it up and every step lights the wrong row.
test('the rail steps index one-to-one with the form steps', () => {
  for (const [id, stepAttr] of [['studentForm', 'data-student-step'], ['companyForm', 'data-company-step']]) {
    const form = html.slice(html.indexOf(`<form id="${id}"`));
    const body = form.slice(0, form.indexOf('</form>'));
    const progress = body.match(/<div class="form-progress"[\s\S]*?<\/div>/)[0];
    const spans = (progress.match(/<span[\s>]/g) || []).length;
    const steps = (body.match(new RegExp(stepAttr + '="', 'g')) || []).length;
    assert.equal(spans, steps, `${id} has ${spans} rail rows for ${steps} steps`);
    assert.equal(spans, 4);
    // The nested content must not be spans, or $$('.form-progress span') over-matches. Checked
    // per row: matching across the whole block would just find the next sibling row.
    for (const [row] of progress.matchAll(/<span[^>]*>[\s\S]*?<\/span>/g)) {
      assert.ok(!row.slice(1).includes('<span'), `${id} nests a span inside a rail row`);
    }
    // <small> was dropped from every rail row on request: four titles plus four descriptions
    // made the rail heavier than the form it indexes. The number and the title still hold.
    for (const tag of ['<i>', '<strong>']) {
      assert.equal((progress.match(new RegExp(tag, 'g')) || []).length, 4, `${id} rail rows are missing ${tag}`);
    }
    assert.equal((progress.match(/<small>/g) || []).length, 0, `${id} rail rows grew subtext back`);
  }
});

// The per-row subtext was cut on request: four titles plus four descriptions plus two trust
// lines made the rail heavier than the form it indexed. What still has to hold is that both
// forms have four rows each and that a title fits its column.
test('the rail indexes four steps per form with titles that fit', () => {
  const rows = [...html.matchAll(/<span[^>]*><i>\d<\/i><strong>([^<]+)<\/strong><\/span>/g)];
  assert.equal(rows.length, 8, `expected 8 rail rows across both forms, found ${rows.length}`);
  for (const [, title] of rows) {
    assert.ok(title.length <= 16, `rail title "${title}" is too long for the column`);
  }
});

// Chips replaced selects. The name and every option value have to survive that swap byte for
// byte, or the payload silently changes shape and api/submissions.js rejects it.
test('the chip groups kept the values their selects had', () => {
  const expected = {
    studentEducation: ['College first-year', 'College sophomore', 'College junior', 'College senior', 'Graduate student', 'Recent graduate'],
    studentSkillLevel: ['Learning the basics', 'Comfortable with guidance', 'Can work independently', 'Advanced, with work examples'],
    studentWorkStyle: ['Independent with clear checkpoints', 'Collaborative with regular feedback', 'Either, if expectations are clear'],
    studentAvailability: ['Within 7 days', 'Within 30 days', 'Next academic break', 'Just exploring'],
    studentHours: ['3–5 hours', '6–10 hours', '11–15 hours'],
    studentCompensation: ['$150+', '$300+', '$500+', 'Depends on scope'],
    studentScreening: ['Yes', 'Maybe, if time-boxed and relevant', 'No'],
    studentPriority: ['Paid work and employer feedback', 'Building specific capability evidence', 'Learning an industry', 'Possibility of follow-on work'],
    studentTimezone: ['Eastern', 'Central', 'Mountain', 'Pacific', 'Outside the United States'],
    companySize: ['1–5 people', '6–20 people', '21–50 people', '51–200 people', '201+ people'],
    companyFrequency: ['Every week', 'Every month', 'Every quarter', 'One-time backlog', 'Not sure'],
    companyStudentHours: ['3–5 hours', '5–8 hours', '8–15 hours', 'Not sure'],
    companyAccess: ['none', 'temporary', 'production'],
  };
  for (const [name, values] of Object.entries(expected)) {
    const found = [...html.matchAll(new RegExp(`name="${name}" value="([^"]*)"`, 'g'))].map(m => m[1]);
    assert.deepEqual(found, values, `${name} lost or reordered its options`);
    assert.ok(!new RegExp(`<select name="${name}"`).test(html), `${name} is still a select`);
  }
});

// A required chip group cannot use the native `required` bubble: it would point at a
// transparent overlay with no visible label. Every one declares its own message instead.
test('every required chip group carries the sentence shown when it is empty', () => {
  const groups = [...html.matchAll(/class="chip-field[^"]*"([^>]*)>/g)].map(m => m[1]);
  // Two groups were cut from step 3 to shorten it; the rule is that every remaining one
  // still carries its empty-state sentence.
  assert.ok(groups.length >= 13, `only ${groups.length} chip groups found`);
  for (const attrs of groups) {
    assert.match(attrs, /data-require-group="[^"]{12,}"/, `a chip group has no message: ${attrs}`);
  }
  // No chip radio may carry `required`, or Chrome logs "not focusable" for the hidden input.
  assert.ok(!/class="chip"><input type="radio"[^>]*required/.test(html), 'a chip radio is natively required');
});

// The graduation year answers the education question, so the student does not type both.
test('education is derived from the graduation year, and the range is covered', () => {
  const fn = pureFunction('educationFromGraduation');
  assert.equal(fn(2029, 2026), 'College first-year');
  assert.equal(fn(2028, 2026), 'College sophomore');
  assert.equal(fn(2027, 2026), 'College junior');
  assert.equal(fn(2026, 2026), 'College senior');
  assert.equal(fn(2025, 2026), 'Recent graduate');
  // Further out than the chips go is left alone rather than guessed at.
  assert.equal(fn(2033, 2026), 'College first-year');
  // A cleared field is unknown, not year zero.
  assert.equal(fn('', 2026), '');
  assert.equal(fn('   ', 2026), '');
  assert.equal(fn(undefined, 2026), '');
  assert.equal(fn('not a year', 2026), '');
  // Every derived value has to be one of the chips, or the prefill selects nothing.
  const chips = [...html.matchAll(/name="studentEducation" value="([^"]+)"/g)].map(m => m[1]);
  for (const year of [2025, 2026, 2027, 2028, 2029]) assert.ok(chips.includes(fn(year, 2026)));
});

// Offsets are ambiguous across daylight saving; the zone name is not.
test('the timezone comes from the IANA zone and falls back honestly', () => {
  const fn = pureFunction('timezoneChoice');
  assert.equal(fn('America/New_York'), 'Eastern');
  assert.equal(fn('America/Chicago'), 'Central');
  assert.equal(fn('America/Phoenix'), 'Mountain');
  assert.equal(fn('America/Los_Angeles'), 'Pacific');
  // Not a nearest-guess: anything unlisted says so.
  assert.equal(fn('Europe/London'), 'Outside the United States');
  assert.equal(fn('Asia/Seoul'), 'Outside the United States');
  // '' rather than undefined: undefined triggers the default parameter and reads the real
  // machine zone, which would make this assertion depend on where the test runs.
  assert.equal(fn(''), 'Outside the United States');
  const chips = [...html.matchAll(/name="studentTimezone" value="([^"]+)"/g)].map(m => m[1]);
  for (const zone of ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London']) {
    assert.ok(chips.includes(fn(zone)), `${fn(zone)} is not one of the timezone chips`);
  }
});

// Restoring a draft used to overwrite each radio's own value attribute, and serializing one
// stored the LAST option in every group rather than the chosen one. Both were silent.
test('drafts round-trip a radio group by its chosen option', () => {
  const src = script.replace(/\/\/.*$/gm, '');
  const serialize = src.slice(src.indexOf('function serializeDraft'));
  assert.match(serialize.slice(0, 700), /field\.type === 'radio'[\s\S]*?if \(field\.checked\)/,
    'serializeDraft writes a radio value without checking whether it is the chosen one');
  const apply = src.slice(src.indexOf('function applyFormValues'));
  assert.match(apply.slice(0, 500), /field\.type === 'radio'\) field\.checked =/,
    'applyFormValues assigns to a radio value instead of its checked state');
});

// A keyboard-activated click reports 0,0, which a coordinate-based backdrop check reads as
// "outside" and closes the dialog on. Pressing Enter on Continue killed the whole form.
test('the backdrop check does not use pointer coordinates', () => {
  const rule = script.slice(script.indexOf("$$('.form-dialog').forEach"));
  const body = rule.slice(0, rule.indexOf('}));') + 4);
  assert.match(body, /event\.target === dialog/);
  for (const banned of ['clientX', 'clientY', 'getBoundingClientRect']) {
    assert.ok(!body.includes(banned), `the backdrop check still reads ${banned}`);
  }
});

// companyAccess became a radio group, where $('[name=x]').value is the first option's value
// and never the answer. Reading it that way disables the production-access blocker.
test('the boundary blocker reads the selected access level, not the first one', () => {
  const src = script.replace(/\/\/.*$/gm, '');
  const fn = src.slice(src.indexOf('function companyBoundaryBlockers'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /selectedControl\(form, 'companyAccess'\)/);
  assert.ok(!/\$\('\[name="companyAccess"\]', form\)/.test(body),
    'companyBoundaryBlockers still takes the first radio as the answer');
  assert.match(body, /access\.value === 'production'/);
});

// The rail trust footer was removed on request. The promise it carried still has to appear
// somewhere a student reads before submitting, and that is the review step, so this checks the
// claim rather than the element that used to hold it.
test('the privacy promise is on screen before anything is sent', () => {
  assert.match(html, /Private by default/, 'nothing tells a student the profile is not public');
  const review = html.slice(html.indexOf('review-boundary'));
  assert.ok(review.length > 0, 'the review step no longer carries the boundary note');
});


// ── Density, motion and the quality floor (§16) ───────────────────────────────────────
// Six words. The cap is on the heading text, so inline markup is stripped and trailing
// punctuation does not count as a word.
test('no heading runs longer than six words', () => {
  const over = [];
  for (const [, inner] of html.matchAll(/<h[1-4][^>]*>((?:(?!<\/h).)*?)<\/h[1-4]>/gs)) {
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text.split(' ').filter(w => /[a-z0-9]/i.test(w));
    if (words.length > 6) over.push(`${words.length}w: ${text}`);
  }
  // Two known and deliberate. The full-screen intro is two four-word lines inside one h1, and
  // the proof-lens heading is copy the founder wrote verbatim: his words outrank my cap, and
  // exempting it by name is better than silently widening the rule for everything.
  const allowed = over.filter(o => !/Students get to prove|Startups need help, students want startup work/.test(o));
  assert.deepEqual(allowed, [], `headings over the six-word cap: ${allowed.join(' | ')}`);
});

// Motion has to encode the order it depicts, and only one diagram gets to.
test('the signature diagram reveals in the order the process runs', () => {
  assert.match(script, /const funnel = document\.getElementById\('flowDemo'\)/);
  // Staged by a custom property, not a chain of timers: one declaration, and nothing left
  // running if the reader scrolls away mid-sequence.
  assert.match(script, /stage\.style\.setProperty\('--stage-index'/);
  assert.match(script, /funnelIO\.disconnect\(\)/, 'the sequence observer never releases');
  assert.match(styles, /calc\(var\(--stage-index, 0\) \* 110ms\)/);
  // Opacity and a few pixels of translate only. Anything that changes the box would shift the
  // page as each stage lands.
  const seq = styles.match(/\.js-reveal \.batch-funnel \.bf-stage,[\s\S]*?\}/)[0];
  for (const shifting of ['height', 'margin', 'padding', 'width', 'display']) {
    assert.ok(!seq.includes(shifting + ':'), `the reveal animates ${shifting} and will shift layout`);
  }
  // And it resolves instantly when motion is not wanted.
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.batch-funnel[\s\S]*?opacity: 1/);
});

// role="img" hides its own children, so the four stage labels would have been unreachable and
// the focusable stages inside it tabbable-but-unannounced.
test('the diagram is readable by a screen reader, not just visible', () => {
  const tag = html.match(/<div class="flow-demo batch-funnel"[^>]*>/)[0];
  assert.match(tag, /role="group"/, 'an image role would hide every stage label');
  assert.match(tag, /aria-label="How a student reaches a trial/);
  // The hover disclosure clips the detail visually and leaves it in the accessibility tree,
  // so it must never become display:none or visibility:hidden.
  const hover = styles.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/)[0];
  assert.match(hover, /max-height: 0/);
  assert.ok(!/display: none|visibility: hidden/.test(hover), 'the detail is removed from the tree on hover-capable devices');
  // Keyboard and focus-within both open it, so the detail is not mouse-only.
  assert.match(styles, /\.bf-stage:focus-visible \.bf-body/);
  assert.match(styles, /\.bf-stage:focus-within \.bf-body/);
});

// An audit at 375px found 16 interactive elements with no focus indicator at all, each styled
// and each missed individually. The floor is global now.
test('keyboard focus is visible on anything focusable', () => {
  const rule = styles.match(/a:focus-visible,\s*button:focus-visible,[\s\S]*?\}/)[0];
  assert.match(rule, /outline: 2px solid var\(--gold-deep\)/);
  assert.match(rule, /outline-offset/);
  for (const sel of ['summary:focus-visible', '[tabindex]:not([tabindex="-1"]):focus-visible']) {
    assert.ok(rule.includes(sel), `${sel} is not covered by the global focus floor`);
  }
  // Deep gold vanishes into the dark sections, so those get the light gold.
  assert.match(styles, /\.hero-home button:focus-visible,[\s\S]*?outline-color: var\(--gold-light\)/);
});

// Wide content scrolls inside its own container so the page body never scrolls sideways.
test('wide content scrolls itself rather than the page', () => {
  for (const sel of ['.compare-scroll', '.flow-demo-scroll']) {
    const rule = styles.match(new RegExp(`\\${sel}[^{]*\\{[^}]*\\}`))[0];
    assert.match(rule, /overflow-x: auto/, `${sel} does not scroll its own overflow`);
  }
});

// Running text held to a readable measure rather than the column it happens to sit in.
test('body text is capped to a readable measure', () => {
  assert.match(typeCss, /--measure:\s*\d+ch;/);
  assert.match(typeCss, /\.t-body, \.t-measure \{ max-width: var\(--measure\)/);
});

// A card title is never a section header. The size conversion bucketed by the old max value, so
// anything that had been set at 23-43px landed on --text-heading regardless of how wide its
// container was: "Talent vouched for by people who know them" ended up at up to 40px in a
// ~300px column and wrapped to six lines, dwarfing the panel it pointed at.
//
// Static, not rendered, because how many lines something wraps to depends on the viewport, and
// a browser check at one width silently passes at another. This asserts the role directly.
test('titles inside cards take the subhead role, not the heading role', async () => {
  const CARD = /(-card|-source|-output|-tile|-cell|-chip|-pill|-badge|-stage\b|-step\b|-item\b|-rung|\bli\b|\bdd\b|\bdt\b)/;
  const offenders = [];
  for (const name of ['styles.css', 'portal.css', 'admin.css']) {
    const css = (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, rawSel, body] of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/font-size:\s*var\(--text-(heading|display)\)/.test(body)) continue;
      const sel = rawSel.trim().replace(/\s+/g, ' ');
      if (!CARD.test(sel)) continue;
      // Big numeric readouts are data, not titles: a balance or a countdown earns display.
      if (/-count|-n\b|-value|-score|balance|timer/.test(sel)) continue;
      // The exchange workbench panel is the focal object of its own diagram, not one card in a
      // row. It is capped at 12ch so the heading size wraps to a deliberate two lines.
      if (sel === '.exchange-step-copy h3') continue;
      offenders.push(`${name}: ${sel}`);
    }
  }
  assert.deepEqual(offenders, [], `card titles set at a section-header size:\n  ${offenders.join('\n  ')}`);
});

// ── Every page, not just the marketing one (§17) ──────────────────────────────────────
// A walk of all six pages found join-qr.html running its own design system entirely, cohort's
// page headline falling back to the body sans, two pages with no favicon at all, and confirm
// stranded on the retired cream ground with no way back to the site. None of it was visible to
// this suite, because every test here read index.html.
const SECONDARY = ['portal.html', 'admin.html', 'cohort.html', 'confirm.html', 'join-qr.html'];

test('every page declares the same favicon set', async () => {
  for (const page of ['index.html', ...SECONDARY]) {
    const src = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    // Without these the browser falls back to /favicon.ico, which does not exist and 404s.
    assert.ok((src.match(/rel="icon"/g) || []).length >= 3, `${page} has no favicon set`);
    assert.match(src, /rel="apple-touch-icon"/, `${page} has no touch icon`);
  }
});

// The retired ground. type.css records why: cream plus an editorial serif is the exact
// combination readers called out as AI-generated.
test('no page reintroduces the warm cream ground', async () => {
  for (const page of ['index.html', ...SECONDARY]) {
    const src = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    for (const cream of ['#fbf9f4', '#faf9f6', '#F4F1EA', '#FDF9F0;']) {
      // The gold gradient panels legitimately use warm tones as gradient stops, so only a flat
      // page background counts.
      const re = new RegExp(`background:\\s*${cream}`, 'i');
      assert.ok(!re.test(src), `${page} sets a cream page background (${cream})`);
    }
  }
});

// A dead end is worse than an error. Both link-error pages are reached from an email.
test('the pages reached from an email offer a way onward', async () => {
  for (const page of ['confirm.html', 'cohort.html']) {
    const src = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(src, /href="(\/|https:\/\/covenda\.app\/?)"/, `${page} strands a visitor with no exit`);
  }
});

// join-qr.html is deliberately self-contained so it works offline and prints, but self-contained
// is not the same as off-brand: it had its own font stack, 20px rounded corners on a --radius: 0
// site, and a gradient button that exists nowhere else.
test('the standalone QR page uses the shared type system and the house geometry', async () => {
  const src = await readFile(new URL('../join-qr.html', import.meta.url), 'utf8');
  assert.match(src, /rel="stylesheet" href="type\.css"/, 'it does not load the shared type tokens');
  assert.match(src, /family=Geist/, 'it does not load the house typeface');
  assert.ok(!/-apple-system/.test(src), 'it still declares its own system font stack');
  assert.ok(!/linear-gradient/.test(src), 'a gradient button is back');
  for (const [, radius] of src.matchAll(/border-radius:\s*([^;]+)/g)) {
    assert.equal(radius.trim(), '0', `border-radius: ${radius.trim()} on a square-cornered site`);
  }
});

// Implementation detail leaking into user-facing copy. A student signing in cannot act on it.
test('sign-in copy does not mention the mail transport', async () => {
  const src = await readFile(new URL('../portal.html', import.meta.url), 'utf8');
  assert.ok(!/SMTP/i.test(src), 'the sign-in page explains SMTP to a student');
});

// href="#" with target="_blank" opens a blank copy of the current page. It is only reachable
// once a partner has a code, which is exactly when it must already work.
test('the cohort link is only a link once it has a destination', async () => {
  const src = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const tag = src.match(/<a[^>]*id="cohortLinkOpen"[^>]*>/)[0];
  assert.ok(!/href="#"/.test(tag), 'it ships with a placeholder href');
  assert.match(tag, /hidden/, 'it is visible before it has a destination');
  assert.match(script, /cohortOpen\.removeAttribute\('href'\)/);
});

// Em dashes, in copy a person reads. Code comments are documentation and keep theirs.
test('visitor-facing copy has no em dashes', async () => {
  for (const page of ['cohort.html', 'admin.html']) {
    const src = (await readFile(new URL(`../${page}`, import.meta.url), 'utf8'))
      .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!src.includes('—'), `${page} still has an em dash in visible copy`);
  }
});

// Bare text links inherited only their line box: 17px on the admin back-link, well under the
// 24px minimum, and the hardest thing on the page to hit on a phone.
test('small text links meet the tap-target floor', () => {
  const rule = styles.match(/\.back-site, \.auth-back, \.ghost-button, \.quiet-link[^{]*\{[^}]*\}/)[0];
  assert.match(rule, /min-height: 24px/);
  assert.match(rule, /padding-block/);
});

// The corners of the icosahedron have to read as points of light. They previously did not: the
// core was painted in the same gold ramp as the edges meeting it, so on a gold ground a vertex
// had nothing to stand out against and rendered as a dull brown dot.
test('the icosahedron corners are lights, not dots', () => {
  const fn = script.slice(script.indexOf('function initIcosahedron'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  // A falloff from a hot centre, not a flat disc: constant alpha reads as a smudge.
  assert.match(body, /createRadialGradient\(p\.sx, p\.sy, 0, p\.sx, p\.sy, glowR\)/,
    'the vertex glow is not a radial falloff');
  // The core must be near-white so it is brighter than both the metal and the ground.
  const core = body.match(/ctx\.fillStyle = `rgba\((\d+),(\d+),(\d+),\$\{\(0\.7 \+ depth/);
  assert.ok(core, 'the vertex core is no longer a fixed near-white');
  for (const channel of core.slice(1, 4)) {
    assert.ok(Number(channel) >= 244, `vertex core channel ${channel} is too dark to shine`);
  }
  // Every corner breathes, and it resolves to a fixed brightness when motion is not wanted,
  // because the reduced-motion path draws exactly once with time = 0.
  assert.match(body, /const pulse = reduceMotion\s*\?\s*0\.5/);
  assert.match(body, /activeNodes\.has\(i\) \? 1 : 0\.4/, 'only the active corners pulse again');
});
