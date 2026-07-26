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

test('student-first hero offers five work paths and a scroll continuation', () => {
  const hero = html.match(/<section class="hero hero-student"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(hero, /What is your <span class="word-gold">domain expertise<\/span>\?/); // §8 rename
  assert.equal((hero.match(/class="work-option/g) || []).length, 5);
  assert.match(hero, /Join the talent/); // §8: one student-account flow (CTA renamed per founder)
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

test('the initial path chooser uses a continuous responsive glass control', () => {
  // Squared deliberately: the pill/rounded-rectangle look was the thing being removed.
  assert.match(styles, /\.work-selector[\s\S]*border-radius: 0/);
  assert.match(styles, /\.work-option\.is-selected[\s\S]*radial-gradient/);
  // The picker used to force five columns and side-scroll, which squeezed each option to
  // whatever width was left. It auto-fits on a real minimum now and wraps instead.
  assert.match(styles, /\.work-selector[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(196px/);
  assert.match(html, /<\/div>\s*<button class="gold-button selector-submit"/);
  assert.match(html, /id="selectorFxCanvas"/);
  assert.match(html, /class="student-journey"/);
  assert.match(script, /function initSelectorFx\(\)/);
  assert.match(script, /function initButtonFeedback\(\)/);
  assert.match(styles, /\.selector-fx/);
});

test('audience switch supports student and company site states', () => {
  assert.match(html, /data-audience-option="student"/);
  assert.match(html, /data-audience-option="company"/);
  // Company hero leads with the profile builder — the backlog card was removed, since
  // "describe the person" is the entry point now and the problem field lives inside it.
  assert.match(html, /Build the profile/);
  assert.match(html, /Hire from a vetted batch/);
  assert.doesNotMatch(html, /Work that keeps getting pushed back/);
  assert.match(script, /document\.body\.dataset\.audience = audience/);
  assert.match(styles, /body\[data-audience="company"\] \.hero-student/);
  assert.match(script, /covendaAudience/);
  assert.match(script, /covendaSelectedWorkType/);
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
  // §14: the three families now live in one shared type.css, linked by all surfaces.
  assert.match(typeCss, /--font-body: "Manrope"/);
  assert.match(typeCss, /--font-display: "Newsreader"/);
  assert.match(typeCss, /--font-mono:/);
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

test('the how-we-verify section exists and advertises only what is actually built', () => {
  // The section must be present but start hidden — it only appears once /api/proof-methods
  // returns real registry data, so a failed fetch shows nothing rather than empty scaffolding.
  assert.match(html, /<section class="verify-section" id="verifyMethods" hidden>/);
  assert.match(html, /id="verifyMachineList"/);
  assert.match(html, /id="verifyHumanList"/);

  // The renderer must filter on status: only 'live' mechanisms are presented as verification,
  // and only 'human_rail' verticals in the honest-limits column. A gated connector (Alpaca,
  // pending terms) or an unbuilt stub must never be advertised as available.
  const block = script.match(/function initVerifyMethods\(\)[\s\S]*?\}\)\(\);/)?.[0] || '';
  assert.ok(block, 'initVerifyMethods should exist in app.js');
  assert.match(block, /m\.status === 'live'/);
  assert.match(block, /m\.status === 'human_rail'/);
  assert.ok(!/status === 'planned'|status === 'stub'/.test(block), 'must not surface planned/stub connectors');
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
  assert.match(script, /How this industry is vetted|batchDiagram/);
  // Honest labelling survives the trip to the marketing site.
  assert.match(script, /Human rail/);
  assert.match(script, /recommendation, not an admission|recommendation\. A human decides/);
  // The orphaned per-card panel must not creep back.
  assert.doesNotMatch(script, /function batchDetailPanel\(/);
  // Requirements tile across the panel instead of stacking in one column.
  assert.match(styles, /\.bd-reqs \{ grid-template-columns: repeat\(auto-fit/);
  assert.match(styles, /\.bd-steps \{ grid-template-columns: repeat\(auto-fit/);
});

test('batch board degrades without the serverless function', () => {
  // paint(null) runs before the fetch, so a static preview still shows the cards.
  assert.match(script, /paint\(null\)/);
  assert.match(script, /\.catch\(\(\) => \{ \/\* No serverless in static preview/);
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
test('hero field reacts to the pointer without breaking motion or touch guardrails', () => {
  // The cursor drives camera parallax and carries LIGHT along the gold links that already
  // exist — it does not spray its own lines, which competed with the network it was lighting.
  assert.match(script, /targetX = -\(\(pointer\.x/);
  assert.match(script, /const LIGHT = \d+;/);
  assert.doesNotMatch(script, /const REACH = 155/);
  assert.match(script, /pointerleave/);
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
  assert.match(script, /function batchDiagram\(/);
  assert.match(script, /HOW_TO_APPLY/);
  // The diagram is built from the brief, so it can never name a rail the batch does not use.
  assert.match(script, /brief\.vetting\.rails\.forEach/);
  // Applying stays possible before the bar is cleared — guidance, not a gate.
  assert.match(script, /bar is guidance, not a gate/);
  assert.match(styles, /\.bd-panel/);
  assert.match(styles, /\.bd-figure/);
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
  assert.match(html, /Get your club Covenda-verified/);
  assert.match(html, /name="clubVertical"/);
  assert.match(script, /action: 'club-tiers'/);
  // Reuses the existing intake — no new storage path, no new inbox.
  assert.match(script, /type: 'referrer_endorsement'/);
  assert.match(script, /intent: 'club_verification'/);
  // Earned, never granted — the honesty line has to survive into the UI.
  assert.match(html, /never granted and never sold/);
  assert.match(styles, /\.club-ladder/);
});

test('batches are described as elite batches', () => {
  assert.match(html, /Join an elite batch in your field/);
  assert.match(html, /an elite batch in one field/);
});

// Credibility is club-led now, and the geometric motif carries past the hero.
test('credibility section offers three routes with faculty de-emphasised', () => {
  assert.match(html, /Credibility is built,/);
  assert.match(html, /A top club/);
  assert.match(html, /Research/);
  assert.match(html, /Vetted work/);
  assert.doesNotMatch(html, /Two ways to earn/);
  // Faculty still counts — stated plainly, not deleted.
  assert.match(html, /still counts — it is just no longer the only door/);
});

test('the homepage states the abundance thesis', () => {
  assert.match(html, /top 1% of the 1%/);
  assert.match(html, /more abundant than ever/);
  assert.match(html, /résumé was never built to parse that/);
});

test('the geometric motif extends past the hero and stays decorative', () => {
  assert.match(styles, /\.broken-section::before/);
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
  assert.match(html, /data-action="student-quick"[^>]*>Join the talent/);
  assert.match(html, /Or add full details now/);
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
  assert.match(html, /Illustrative walkthrough — no real company/);
  assert.match(script, /action: 'vertical-demo'/);
  // A tablist has to be operable with arrow keys.
  assert.match(script, /ArrowRight/);
  assert.match(script, /setAttribute\('role', 'tab'\)/);
  assert.match(styles, /\.vdemo-beats/);
});

// The pop-art panel made an argument where this spot needed an explanation. Replaced with a
// five-step walkthrough of how a trial actually runs.
test('the trial walkthrough explains the five steps and stays operable', () => {
  assert.match(html, /id="tfTrack"/);
  assert.equal((html.match(/class="tf-slide"/g) || []).length, 5);
  assert.match(html, /A company brings real work/);
  assert.match(html, /We scope it into a trial/);
  assert.match(html, /It goes to a vetted batch/);
  assert.match(html, /The student does the work/);
  assert.match(html, /The company decides/);
  // Native scroll-snap means swipe works with no JS; the rail must still read unscripted.
  assert.match(styles, /\.tf-viewport \{[\s\S]*?scroll-snap-type: x mandatory/);
  // Dots follow the scroll rather than assuming they caused it.
  assert.match(script, /if \(nearest !== index\) sync\(nearest\)/);
  assert.match(script, /ArrowRight/);
  // The pop-art panel must not linger.
  assert.doesNotMatch(html, /popart/);
  assert.doesNotMatch(styles, /\.popart-svg/);
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

// "Why this exists" names both forces: applications became free to generate, and the
// students worth finding started leaving the places that used to collect them.
// The section carried its argument in three stacked paragraph blocks. It is a figure now —
// a company buried in identical applications, a student radiating signal nobody receives, and
// a broken line between them — with the prose cut to a line each.
test('the broken-system section leads with a visual, not paragraphs', () => {
  assert.match(html, /class="break-fig"/);
  assert.match(html, /ALL IDENTICAL/);
  assert.match(html, /REAL, UNSEEN/);
  assert.match(html, /NO<\/text>/);
  // The figure must carry its meaning to a screen reader, not just to the eye.
  assert.match(html, /aria-label="A company on the left is buried/);
  // The subtaps are gone; their point is in the drawing.
  assert.doesNotMatch(html, /broken-subtaps/);
  assert.doesNotMatch(styles, /\.bsub-tag/);
});

// The student's case is not only "you get judged unfairly" — it is that the work itself is
// real: contributing to something and building domain expertise, not monkey work.
test('the student case names real work and domain expertise, not monkey work', () => {
  assert.match(html, /not monkey work/);
  assert.match(html, /not monkey work/);
  assert.match(html, /domain expertise, not filing/);
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

// The hero field argues the thesis: a crowd, a few already gold, and pale nodes visibly
// BECOMING proof. If the conversion goes away the picture stops making the argument.
test('the hero field converts pale nodes into proof, and keeps gold scarce', () => {
  assert.match(script, /function proveOne\(\)/);
  assert.match(script, /proofs\.push\(\{ node: n, age: 0 \}\)/);
  // Scarcity is load-bearing: a gold field would say the opposite of what this is for.
  // An ABSOLUTE ceiling, not a ratio: a denser crowd must not mean more gold, or the
  // contrast the crowd exists to create disappears as the field grows.
  assert.match(script, /goldCount >= MAX_GOLD/);
  assert.match(script, /const MAX_GOLD = \d+;/);
  // The crowd is UNLINKED — the network is what proof buys, so only proven nodes connect.
  assert.match(script, /if \(nodes\[i\]\.lit > 0\.12\) litIdx\.push\(i\)/);
  // And proven nodes connect to EVERY other one across the field, not just near neighbours:
  // proximity would say "these two happen to be close", which is not the claim.
  assert.doesNotMatch(script, /GOLD_LINK/);
  // Real 3D: depth, perspective projection, and far-to-near paint order.
  assert.match(script, /function project\(n\)/);
  assert.match(script, /FOCAL \/ z/);
  assert.match(script, /sort\(\(a, b\) => nodes\[b\]\.z - nodes\[a\]\.z\)/);
  // Reduced motion gets a single static frame — no drift, no conversions, no parallax.
  assert.match(script, /if \(reduce\) return; \/\/ static frame only/);
});
