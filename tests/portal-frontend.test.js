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
  assert.match(html,/data-portal-view="requests"/);
  assert.match(html,/Covenda scopes and packages every request before students see it/);
  assert.match(script,/action:'create-request'/);
  assert.doesNotMatch(script,/action:'create-project'/);
  assert.match(script,/action:'apply'/);
  assert.match(script,/action:'send-message'/);
});

test('organization requests cover every brokered work type and expose transparent lifecycle states',()=>{
  for(const type of ['new_project','more_students','scope_change','revision','consult','question','specific_student']) assert.match(html,new RegExp(`value="${type}"`));
  for(const status of ['Submitted','Covenda is packaging','Packaged &amp; live']) assert.match(html,new RegExp(status));
  assert.match(html,/Do not include client or patient records/);
  assert.match(script,/requestStatusLabels/);
  assert.match(script,/operator_note/);
  assert.match(styles,/\.request-workspace/);
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

test('member workspace uses the institutional control system and actionable empty states',()=>{
  assert.match(html,/class="profile-meter"/);
  assert.match(html,/aria-label="Profile completion"/);
  assert.match(script,/Browse open projects/);
  assert.match(script,/className='empty-action'/);
  assert.match(script,/label:'Open profile'/);
  assert.match(script,/label:'Reset filters'/);
  assert.match(script,/profileNeedsWork\?'Complete profile'/);
  assert.match(styles,/\.profile-meter/);
  assert.match(styles,/\.empty-action/);
  assert.match(styles,/\.portal-primary \{[^}]*background:var\(--gold\)/);
  assert.doesNotMatch(styles,/\.progress-ring/);
});

test('project intake uses a full-screen working surface and completed work records outcomes',()=>{
  assert.match(styles,/#intakeDialog \{[^}]*width:100vw[^}]*height:100dvh/);
  assert.match(styles,/#intakeDialog \.dialog-body \{[^}]*overflow-y:auto/);
  assert.match(script,/Did working together lead to anything more\?/);
  assert.match(script,/action:'record-conversion'/);
  assert.match(styles,/\.conversion-control/);
});

test('portal shares the canonical mark and prepares avatar photos before upload',()=>{
  assert.ok((html.match(/src="\/assets\/covenda-mark\.svg"/g)||[]).length>=2);
  assert.match(script,/function downscaleAvatar\(file\)/);
  assert.match(script,/512\/Math\.max\(width,height\)/);
  assert.match(script,/canvas\.toBlob\(resolve,'image\/webp',\.85\)/);
  assert.match(script,/HEIC photos are not supported yet/);
  assert.match(html,/Attach files · 4 MB each/);
});

test('company portal includes a gated, filterable Trusted Talent marketplace',()=>{
  assert.match(html,/id="networkAccessDialog"/);
  assert.match(html,/id="talentProfileDialog"/);
  assert.match(script,/Find students through people and institutions you already trust/);
  assert.match(script,/action:'request-network-access'/);
  assert.match(script,/Verified referral only/);
  assert.match(script,/verified_project_count/);
  assert.match(styles,/\.talent-network-visual/);
  assert.match(styles,/talent-flow/);
  assert.match(styles,/@keyframes talent-flow/);
});

test('university partners receive a functional cohort and invitation workspace',()=>{
  assert.match(script,/Your student cohort/);
  assert.match(script,/Students referred/);
  assert.match(script,/Copy invitation/);
  assert.match(script,/Founder-confirmed founding faculty partner/);
  assert.match(script,/No grades, student records, or ongoing administration/);
  assert.match(script,/No students linked yet/);
  assert.match(script,/partnerCohort/);
  assert.match(styles,/\.cohort-metrics/);
  assert.match(styles,/\.cohort-table/);
  assert.match(styles,/@media \(max-width:520px\)[\s\S]*?\.cohort-row/);
});

test('student discovery includes explainable matching, bookmarks, filters, and mobile detail behavior',()=>{
  for(const id of ['discoverSearch','discoverSort','discoverFilters','discoverFilterDialog','discoverDetail']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/data-discover-tab="best"/);
  assert.match(html,/data-discover-tab="saved"/);
  assert.match(html,/Fit is about this project—not a universal student score/);
  assert.match(script,/action:'match-event'/);
  assert.match(script,/action:'toggle-save'/);
  assert.match(script,/fit_reasons/);
  assert.match(styles,/\.discover-workspace/);
  assert.match(styles,/\.discover-filter-dialog/);
  assert.match(styles,/@media \(max-width:680px\)[\s\S]*?\.discover-detail/);
});
