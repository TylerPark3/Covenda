import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURSE_KINDS, COURSE_KIND_IDS, COMPETENCIES, COMPETENCY_IDS, FAMILIES,
  matchCourse, recordCoursework, courseworkProfile, provingPlan, claimsFromStoredCoursework,
} from '../../api/course-ontology.js';
import { SOURCES, normaliseEvidence } from '../../api/evidence.js';

// ── The point of the file ─────────────────────────────────────────────────────────────
// This module maps courses to competencies, which is the opening move of a resume screen. The
// tests that matter are the ones proving it cannot become one.

test('every course claim is capped at claimed, whatever the caller asks for', () => {
  const result = recordCoursework({ title: 'Machine Learning' });
  assert.ok(result.ok);
  assert.ok(result.claims.length >= 3);
  for (const claim of result.claims) {
    assert.equal(claim.verification_tier, 'claimed', 'a course produced a claim above claimed');
  }
});

test('the coursework source cannot be promoted past claimed', () => {
  assert.equal(SOURCES.completed_coursework.ceiling, 'claimed');
  // Ask for the top tier directly, bypassing recordCoursework, and confirm the registry caps it.
  const forced = normaliseEvidence({
    source: 'completed_coursework', skill: 'Testing', tier: 'trial', pointer: 'https://x.test',
  });
  assert.equal(forced.claim.verification_tier, 'claimed');
  assert.ok(forced.capped, 'the ceiling did not report that it capped anything');
});

test('an unrecognised course is refused rather than guessed into a bucket', () => {
  const result = recordCoursework({ title: 'Underwater Basket Weaving' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.claims, []);
  assert.equal(result.unmapped, true);
  // The student's own words survive, so the UI can show what was not matched.
  assert.equal(result.title, 'Underwater Basket Weaving');
});

test('institution-specific course codes are stripped, not registered', () => {
  // The registry holds titles because codes differ per catalogue. These must still land.
  assert.equal(matchCourse('CS 61A Introduction to Programming').kind.id, 'programming_foundations');
  assert.equal(matchCourse('6.006 Algorithms').kind.id, 'algorithms');
  assert.equal(matchCourse('MATH-54: Linear Algebra').kind.id, 'linear_algebra');
  // A bare title still works, so the stripping is not load-bearing for the common case.
  assert.equal(matchCourse('Data Structures').kind.id, 'data_structures');
});

test('the longest alias wins so a short one cannot steal a longer course', () => {
  // 'statistics' is an alias of its own kind and a substring of 'mathematical statistics'.
  assert.equal(matchCourse('Statistical Learning').kind.id, 'machine_learning');
  assert.equal(matchCourse('Probability and Statistics').kind.id, 'statistics');
});

test('the profile returns no composite score', () => {
  const profile = courseworkProfile(recordCoursework({ title: 'Algorithms' }).claims);
  for (const banned of ['score', 'rating', 'rank', 'grade', 'gpa', 'total', 'readiness', 'percentile']) {
    assert.ok(!(banned in profile), `courseworkProfile returns a ${banned}`);
  }
});

test('the profile states that coursework is excluded from matching', () => {
  const profile = courseworkProfile(recordCoursework({ title: 'Algorithms' }).claims);
  assert.match(profile.note, /excluded from matching/i);
  // Unproven is the headline number, and for coursework it is always everything.
  assert.equal(profile.unproven, profile.competencies.length);
});

test('courses are counted once even though each yields several competencies', () => {
  const claims = [
    ...recordCoursework({ title: 'Machine Learning' }).claims,
    ...recordCoursework({ title: 'Databases' }).claims,
  ];
  const profile = courseworkProfile(claims);
  assert.equal(profile.courseCount, 2);
  assert.ok(profile.competencies.length > 2, 'competencies should outnumber courses');
});

// ── The output the file exists for ────────────────────────────────────────────────────
test('every competency a course exposes has a route to real evidence', () => {
  for (const id of COMPETENCY_IDS) {
    const competency = COMPETENCIES[id];
    assert.ok(competency.provenBy && competency.provenBy.length > 20,
      `${id} has no proving route, so it is a dead end`);
    assert.ok(FAMILIES[competency.family], `${id} has family ${competency.family}, which does not exist`);
  }
});

test('the proving plan turns a course list into a build list', () => {
  const profile = courseworkProfile(recordCoursework({ title: 'Machine Learning' }).claims);
  const { plan, total } = provingPlan(profile, { limit: 2 });
  assert.equal(plan.length, 2);
  assert.ok(total >= 4, 'the plan should know it truncated');
  for (const item of plan) {
    assert.equal(item.currently, 'claimed');
    assert.ok(item.build.length > 20, 'a plan entry with no work to do is not a plan');
  }
});

test('every course kind states what it cannot show', () => {
  for (const id of COURSE_KIND_IDS) {
    const kind = COURSE_KINDS[id];
    assert.ok(kind.cannotShow && kind.cannotShow.length > 30, `${id} has no cannotShow`);
    assert.ok(kind.competencies.length > 0, `${id} maps to no competencies`);
    for (const c of kind.competencies) {
      assert.ok(COMPETENCIES[c], `${id} maps to unknown competency ${c}`);
    }
    assert.ok(FAMILIES[kind.family], `${id} has family ${kind.family}, which does not exist`);
  }
});

test('stored rows are rehydrated through the model, not trusted', () => {
  const rows = [
    { id: 'a', course_kind: 'algorithms', course_title: 'Algorithms', source: 'completed_coursework' },
    // A row claiming a tier it cannot have. Rehydration must not carry it through.
    { id: 'b', course_kind: 'databases', course_title: 'Databases', verification_level: 'trial' },
    { id: 'c', course_kind: 'not_a_real_kind', course_title: 'Nonsense' },
  ];
  const claims = claimsFromStoredCoursework(rows);
  assert.ok(claims.length > 0);
  for (const claim of claims) assert.equal(claim.verification_tier, 'claimed');
  // The unknown kind is skipped rather than thrown on.
  assert.ok(!claims.some(c => c.evidence_meta.course_title === 'Nonsense'));
});

test('input errors are worded so the portal returns 400 rather than 500', () => {
  // The portal classifies expected input errors by this prefix. A message outside it is a 500.
  const expected = /^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/;
  assert.match(recordCoursework({ title: '' }).reason, expected);
  assert.match(recordCoursework({ title: 'Underwater Basket Weaving' }).reason, expected);
});

// ── Wiring ────────────────────────────────────────────────────────────────────────────
// A model with no callers is not a feature.
test('the coursework routes are wired into the portal', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const action of ['save-coursework', 'load-coursework', 'delete-coursework', 'preview-course']) {
    assert.match(api, new RegExp(`input\\.action === '${action}'`), `${action} has no route`);
  }
});

test('the coursework read degrades and the coursework write does not', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const load = api.slice(api.indexOf('export async function loadCoursework'));
  assert.match(load.slice(0, 500), /optional\(/, 'loadCoursework uses checked() and will take the portal down');

  const save = api.slice(api.indexOf('export async function saveCoursework'));
  assert.match(save.slice(0, 2000), /checked\(member\.supabase\.from\('coursework'\)\.insert/,
    'the write does not verify it landed');
});

test('the migration enforces the rules the model enforces', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260730100000_coursework.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /notify pgrst, 'reload schema';\s*$/);
  // The tier rule written where a stray insert cannot route around it.
  assert.match(sql, /coursework_is_claimed check \(verification_level = 'claimed'\)/);
  // Every kind the model knows must be storable, or saving one 500s on a CHECK.
  for (const id of COURSE_KIND_IDS) {
    assert.ok(sql.includes(`'${id}'`), `${id} is not allowed by the CHECK constraint`);
  }
  // The columns that would turn this back into a resume screen, deliberately absent.
  for (const banned of ['grade', 'gpa', 'institution', 'school', 'score', 'rating', 'credit']) {
    assert.ok(!new RegExp(`^\\s+${banned}\\b`, 'm').test(sql), `the table has a ${banned} column`);
  }
});

// ── The portal UI ─────────────────────────────────────────────────────────────────────
// The finance form shipped with a server that accepted evidence and nothing that asked for
// it. These assert the panel is reachable and that it cannot quietly grow a grade field.
test('the coursework panel is reachable from the student profile', () => {
  const ui = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const branch = ui.slice(ui.indexOf("if(profile?.role==='student'){"), ui.indexOf('function renderPortfolioEmpty'));
  assert.match(branch, /renderCoursework\(\w+,\s*state\.dashboard\)/,
    'renderCoursework is defined but never called, so no student can see it');
  assert.match(ui, /function renderCoursework\(/);
  assert.match(ui, /openCoursework/);

  const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
  assert.match(html, /id="courseworkDialog"/);
  assert.match(html, /id="courseTitle"/);
  // Every class the panel applies must exist, or the element ships invisible.
  const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
  for (const cls of ['tech-more', 'tech-note-line', 'te-limit']) {
    assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `.${cls} is used by the panel but never styled`);
  }
});

test('the coursework form collects no grade', () => {
  const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
  const dialog = html.slice(html.indexOf('id="courseworkDialog"'), html.indexOf('id="techEvidenceDialog"'));
  assert.ok(dialog.length > 200, 'the coursework dialog was not found where expected');
  for (const banned of ['grade', 'gpa', 'score', 'institution', 'school']) {
    assert.ok(!new RegExp(`name="${banned}`, 'i').test(dialog), `the form collects ${banned}`);
  }
  // And it says so, because a student should know why it was not asked for.
  assert.match(dialog, /No grade is stored/i);
});

test('the course guide travels with the dashboard rather than being duplicated in the UI', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(api, /courseGuide:/, 'the form has no guide to render limits from');
  const ui = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  // The UI must not carry its own copy of the course list; that is how the list a student
  // picks from stops matching the one the server accepts.
  for (const id of COURSE_KIND_IDS.slice(0, 12)) {
    assert.ok(!ui.includes(`'${id}'`), `portal.js hardcodes course kind ${id}`);
  }
});
