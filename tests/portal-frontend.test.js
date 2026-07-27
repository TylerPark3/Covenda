import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../portal.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../portal.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../portal.css',import.meta.url),'utf8');

test('member portal exposes login, onboarding, role-aware navigation, and project actions',()=>{
  assert.match(html,/Continue with Google/);
  assert.match(html,/id="memberEmailForm"/);
  assert.match(html,/value="student"/);
  assert.match(html,/value="company"/);
  assert.match(html,/value="university"/);
  assert.match(html,/data-portal-view="overview"/);
  assert.match(html,/data-portal-view="projects"/);
  assert.match(html,/data-portal-view="discover"/);
  assert.match(html,/data-portal-view="messages"/);
  assert.match(html,/id="projectForm"/);
  assert.match(html,/id="applyForm"/);
  assert.match(html,/id="messageForm"/);
  assert.match(script,/action:'google-login'/);
  assert.match(script,/action:'save-profile'/);
  assert.match(script,/action:'create-project'/);
  assert.match(script,/action:'apply'/);
  assert.match(script,/action:'send-message'/);
});

test('student onboarding uses the shared industry hierarchy and remains skippable and editable',()=>{
  assert.match(html,/<script src="industry-taxonomy\.js" defer><\/script>[\s\S]*<script src="portal\.js" defer><\/script>/);
  assert.match(html,/id="profileIndustryOptions"/);
  assert.match(html,/id="profileSectorOptions"/);
  assert.match(html,/id="profileWorkTypeOptions"/);
  assert.match(script,/const PORTAL_TAXONOMY = globalThis\.CovendaIndustryTaxonomy/);
  assert.match(script,/kind:'industries'/);
  assert.match(script,/kind:'sectors'/);
  assert.match(script,/kind:'multiOptional'/);
  assert.match(script,/Skip for now/);
  assert.match(script,/industrySectors:v\.industrySectors/);
  assert.match(script,/renderProfileInterestEditor/);
  assert.match(styles,/\.profile-interests/);
});

test('batch experience: expandable cards + application with assigned video prompt and interest questions',()=>{
  const api=readFileSync(new URL('../api/portal.js',import.meta.url),'utf8');
  // Expandable, detail-rich cards instead of a bare Apply button.
  assert.match(script,/batch-card-lg/);
  assert.match(script,/batchStudentProfile/);
  assert.match(script,/batchSampleCompanies/);
  assert.match(script,/Learn more & apply/);
  // Application flow: a randomly assigned video prompt + interest questions.
  assert.match(script,/pickBatchPrompt/);
  assert.match(script,/BATCH_VIDEO_PROMPTS/);
  assert.match(script,/batchInterestQuestions/);
  assert.match(script,/videoPrompt:currentBatchPrompt/);
  // Answers come from the store now, not the form — only one question is mounted at a
  // time, so reading the form would return the current question and nothing else.
  assert.match(script,/interest:readBatchInterest\(\)/);
  assert.match(script,/Read from the answer store, not the form/);
  // Dialog scaffolding for the prompt + interest answers + detail recap.
  assert.match(html,/id="batchVideoPrompt"/);
  assert.match(html,/id="batchInterestQuestions"/);
  assert.match(html,/id="batchApplyWho"/);
  assert.match(html,/id="batchApplySamples"/);
  // API persists the assigned prompt + interest answers (JSONB materials, no migration).
  assert.match(api,/videoPrompt: cleanText\(input\.videoPrompt/);
  assert.match(api,/interest: Array\.isArray\(input\.interest\)/);
  // Sample companies are described by type, never as fabricated named partnerships.
  assert.match(script,/Exact companies vary each season/);
});

test('member portal is responsive, reduced-motion safe, and contains no server secret',()=>{
  assert.match(styles,/@media \(max-width: 680px\)/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles,/\.overview-grid/);
  assert.doesNotMatch(html+script,/SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/i);
  assert.match(html,/noindex,nofollow/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
});

// A method="dialog" form CLOSES its dialog on implicit submit, so pressing Enter in a text
// input silently dismissed the whole thing — the school-email dialog vanished without ever
// calling the API, and the company intake would have lost everything typed.
test('pressing Enter in a dialog runs the action instead of closing the dialog', () => {
  const portalJs = script;
  // The dynamically-built verification dialogs.
  assert.match(portalJs, /shell\.addEventListener\('submit',event=>\{[\s\S]{0,120}preventDefault/);
  assert.match(portalJs, /footer \.portal-primary:not\(\[disabled\]\)/);
  // And the company intake, which has text inputs and had no handler at all.
  assert.match(portalJs, /\$\('#intakeForm'\)\?\.addEventListener\('submit'/);
});

// Excel technique and code navigation happen on a screen. A camera recording of someone's
// face while they work tells a rater nothing about method.
test('the assessment records the screen, not the candidate', () => {
  assert.match(script, /getDisplayMedia/);
  assert.match(script, /mode==='screen'/);
  // The mic is merged in, because thinking aloud is half the signal.
  assert.match(script, /createMediaStreamDestination/);
  // Stopping the merge must stop the sources, or the browser keeps saying "sharing".
  assert.match(script, /stream\.__sources\|\|\[\]/);
  // And a student is told the method is what is scored, before they start working silently.
  assert.match(script, /Reviewers score the method/);
});

// A second stylesheet of `.dark .thing` rules drifts the moment someone adds a component and
// forgets one. Night mode redefines tokens instead.
test('night mode redefines tokens rather than overriding components', () => {
  assert.match(styles, /:root\[data-theme="night"\]/);
  assert.match(styles, /--accent: #d9a94e/, 'gold is lifted for dark, not reused');
  // #b47b20 on near-black is muddy and fails contrast; reusing it would break the brand in
  // half the product.
  assert.doesNotMatch(styles, /\[data-theme="night"\][\s\S]{0,400}--accent: #b47b20/);
  assert.match(html, /id="themeToggle"/);
});

test('the OS preference is respected until someone chooses', () => {
  assert.match(script, /prefers-color-scheme: dark/);
  assert.match(script, /localStorage\.setItem\(KEY/);
  // Private browsing throws on localStorage; it must not take the portal down.
  assert.match(script, /catch\{ \/\* private browsing \*\/ \}/);
});

// Gold marks what was earned. Decorating everything with it would empty it of meaning.
test('gold is reserved for earned signals, not applied as decoration', () => {
  assert.match(styles, /Gold marks what was EARNED/);
});

// Gold as a line or a ground is decoration and can be everywhere. Gold as a FILL is a
// signal and stays rare. Losing that distinction is how an accent becomes noise.
test('gold fills stay reserved while gold lines carry structure', () => {
  assert.match(styles, /gold as a LINE or a GROUND is/i);
  // The earned marks keep the strongest treatment.
  assert.match(styles, /\.verif-list li\.is-held \.verif-mark[\s\S]{0,200}box-shadow: 0 0 0 1px var\(--accent\)/);
  // And night mode gets its own ring value, because the day glow disappears on black.
  assert.match(styles, /\[data-theme="night"\][\s\S]{0,300}rgba\(217,169,78,\.5\)/);
});
