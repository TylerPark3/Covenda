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
  assert.match(script,/interest:readBatchInterest\(form\)/);
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
