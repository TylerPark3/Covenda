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
