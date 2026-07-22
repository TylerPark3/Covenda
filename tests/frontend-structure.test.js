import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

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
  assert.match(hero, /What kind of work do you want to <span class="word-gold">prove<\/span>\?/);
  assert.equal((hero.match(/class="work-option/g) || []).length, 5);
  assert.match(hero, /Join the pilot list/);
  assert.match(hero, /See how Covenda works/);
  assert.match(hero, /href="#how"/);
});

test('Covenda restores the skippable editorial intro and keeps it replayable', () => {
  assert.match(html, /id="introScreen"/);
  assert.match(html, /Students get paid\./);
  assert.match(html, /Employers get work done\./);
  assert.match(html, /id="introEnter"[^>]*>[\s\S]*Enter Covenda/);
  assert.match(html, /id="introSkip"[^>]*>Skip intro/);
  assert.match(html, /data-action="replay-intro"/);
  assert.match(script, /covendaIntroSeen/);
  assert.match(script, /function openIntro\(/);
  assert.match(script, /function dismissIntro\(/);
  assert.match(styles, /--font-display:/);
  assert.match(styles, /\.intro-statement/);
});

test('the initial path chooser uses a continuous responsive glass control', () => {
  assert.match(styles, /\.work-selector[\s\S]*border-radius: 999px/);
  assert.match(styles, /\.work-option\.is-selected[\s\S]*radial-gradient/);
  assert.match(styles, /scroll-snap-type: x proximity/);
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
  assert.match(html, /What work keeps getting pushed\?/);
  assert.match(script, /document\.body\.dataset\.audience = audience/);
  assert.match(styles, /body\[data-audience="company"\] \.hero-student/);
  assert.match(script, /covendaAudience/);
  assert.match(script, /covendaSelectedWorkType/);
});

test('company story preserves the managed Project Packet workflow and risk boundary', () => {
  assert.match(html, /From messy work to an/);
  for (const phrase of ['Company problem', 'Covenda scopes', 'You approve', 'Student works', 'Covenda reviews']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /No production access or restricted records/);
  assert.match(html, /Illustrative Project Packet/);
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
  assert.match(styles, /--font-ui: "Manrope"/);
  assert.match(styles, /--font-display: "Newsreader"/);
  assert.match(html, /fonts\.googleapis\.com/);
});

test('page avoids unsupported marketplace claims and legacy branding', () => {
  assert.doesNotMatch(html, /ProofPath/i);
  assert.doesNotMatch(html, /Sign in/i);
  assert.doesNotMatch(html, /customer logos/i);
  assert.doesNotMatch(html, /success rate/i);
  assert.doesNotMatch(html, /Student score:/i);
});
