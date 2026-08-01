import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');

// portal.js is a browser script, not a module, so there is nothing to import. Rather than
// assert on its source text — which is how a 1,375-test suite missed four outages in one day —
// lift the pure functions out and run them for real.
function lift(name) {
  const at = portal.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} exists in portal.js`);
  let depth = 0, i = portal.indexOf('{', at);
  for (; i < portal.length; i++) {
    if (portal[i] === '{') depth++;
    else if (portal[i] === '}' && --depth === 0) break;
  }
  return portal.slice(at, i + 1);
}

// The `go` closures reference navigation helpers but are never invoked while the ladder is
// built, so stubs are enough to exercise the model itself.
const studentJourney = new Function(`
  const setView = () => {}, openVerificationStep = () => {}, openReferralStep = () => {};
  ${lift('asList')}
  ${lift('profileCompletion')}
  ${lift('studentJourney')}
  return studentJourney;
`)();

const EMPTY = { profile: {}, verification: {}, projects: [], applications: [], messages: [] };

// ── The finding this file exists for ────────────────────────────────────────────────────
// The first cut of this redesign added setupModel(): a second six-step "what to do next"
// ladder with its own count, rendered directly above studentJourney's six-step ladder with
// its own count. Two denominators, one question, one screen — the exact defect the redesign
// set out to remove. studentJourney already showed only the next step, folded the rest away
// and counted "N of 6"; it was simply buried in a rail beneath three other progress widgets.
//
// Ch. 1.5: reuse existing abstractions unless a documented limitation makes extension
// impractical. There was none. The duplicate is gone and the original is promoted.
test('there is exactly one model of what the student should do next', () => {
  for (const dead of ['setupModel', 'nextActionCard', 'renderNextAction', 'nextActionMount']) {
    assert.ok(!portal.includes(dead), `${dead} is gone from portal.js`);
    assert.ok(!html.includes(dead), `${dead} is gone from portal.html`);
  }
  assert.ok(!css.includes('next-card') && !css.includes('setup-progress'),
    'and its styling is gone too');
  // profileCompletion survives, but only inside the ladder and the credibility panel. It must
  // never become a second on-screen progress readout competing with "N of 6".
  const calls = (portal.match(/profileCompletion\(/g) || []).length;
  assert.ok(calls > 0 && calls < 10, 'still used, not proliferating');
});

// The ladder is the single source, so it must behave correctly on real data.
test('an empty dashboard completes no steps and names the first one', () => {
  const steps = studentJourney(EMPTY);
  assert.equal(steps.length, 6);
  assert.equal(steps.filter(s => s.done).length, 0);
  assert.equal(steps.find(s => !s.done).key, 'verify');
});

// "Do not claim profile or verification completion unless supported by real data."
test('no step reads complete without the data behind it', () => {
  for (const shape of [{}, { profile: null }, { profile: {}, projects: null }, EMPTY]) {
    assert.equal(studentJourney(shape).filter(s => s.done).length, 0,
      `nothing is claimed for ${JSON.stringify(shape)}`);
  }
});

test('a malformed field is incomplete, never an exception', () => {
  for (const junk of ['three', 42, {}, { length: 9 }, true]) {
    assert.doesNotThrow(() => studentJourney({ profile: { skills: junk }, projects: junk, messages: junk }));
  }
});

test('verification is only claimed when the server says so', () => {
  // A confirmed school email is explicitly the floor, not the proof — it marks partial, not done.
  const floor = studentJourney({ ...EMPTY, verification: { isStudentVerified: false, signals: [{ key: 'school_email', held: true }] } });
  const verify = floor.find(s => s.key === 'verify');
  assert.equal(verify.done, false, 'a school email alone is not verification');
  assert.equal(verify.partial, true, 'but it is acknowledged');
  const real = studentJourney({ ...EMPTY, verification: { isStudentVerified: true, signals: [] } });
  assert.equal(real.find(s => s.key === 'verify').done, true);
});

test('every step carries an action, an explanation and a destination', () => {
  for (const step of studentJourney(EMPTY)) {
    assert.ok(step.title && step.now && step.cta, `${step.key} is fully written`);
    assert.equal(typeof step.go, 'function', `${step.key} goes somewhere`);
    assert.ok(!/\bscore\b|\brating\b/i.test(step.title + step.now),
      `${step.key} names an action, not a score`);
  }
});

// The brief: "do not create a universal skill score" / "universal employability score".
// A count of discrete named steps is not a score; a percentage starts reading as one.
test('progress is a count of named steps, not a score', () => {
  const fn = portal.slice(portal.indexOf('function renderJourney()'), portal.indexOf('function renderTrialStart()'));
  assert.match(fn, /\$\{doneCount\} of \$\{steps\.length\}/);
  assert.doesNotMatch(fn, /employability|universal score/i);
});

// ── The rail removal, and its hazard ────────────────────────────────────────────────────
test('the rail is gone and the journey is promoted to the top of the overview', () => {
  for (const gone of ['overview-rail', 'id="profileRing"', 'id="nextActions"']) {
    assert.ok(!html.includes(gone), `${gone} is out of portal.html`);
  }
  assert.ok(!css.includes('overview-rail'), 'and the rail is out of portal.css');
  for (const dead of ['renderProgress', 'renderActions']) {
    assert.ok(!portal.includes(dead), `${dead} is deleted, not left as a guarded no-op`);
  }
  // Verification standing is real information and survived the rail.
  assert.ok(html.includes('id="verificationPanel"'), 'verification standing survived');
  assert.match(portal, /const host=\$\('#verificationPanel'\); if\(!host\)return;/);

  // The journey must be the first panel a student meets, above every other panel.
  const main = html.slice(html.indexOf('<div class="overview-main">'), html.indexOf('data-portal-view="projects"'));
  const journeyAt = main.indexOf('id="journeyPanel"');
  assert.notEqual(journeyAt, -1, 'the journey is on the overview');
  for (const later of ['id="introPanel"', 'class="focus-section"', 'id="verificationPanel"', 'class="plain-section"']) {
    assert.ok(journeyAt < main.indexOf(later), `the journey outranks ${later}`);
  }
});

// The defect that killed the homepage from app.js:1897 was an element removed from markup
// while a renderer still reached through it, unguarded. Nothing in portal.js may do that.
test('no selector is dereferenced without existing in the markup', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const src = portal.replace(/\/\/[^\n]*/g, '');   // comments name absent ids on purpose
  const offenders = [];
  for (const m of src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)\s*\.\w+/g)) {
    if (!ids.has(m[1])) offenders.push(`$('#${m[1]}') at line ${src.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(offenders, [], `these deref an element absent from portal.html: ${offenders.join(', ')}`);
});

test('every nav element paint is null-guarded', () => {
  // The three label ids this used to check are gone: they were a second naming system running
  // beside NAV_LABELS, both painting every render and disagreeing about the result. What is
  // left is the one badge and the one role-gated button, and both are still role-hidden, so
  // both still need a guard before they are touched.
  const at = portal.indexOf("const mc=$('#messageCount')");
  assert.notEqual(at, -1, 'the badge paint block exists');
  const block = portal.slice(at, at + 800);
  for (const id of ['messageCount', 'batchesNav']) {
    assert.match(block, new RegExp(`\\$\\('#${id}'\\);?\\s*\\n?\\s*if\\(`), `#${id} is checked before it is written`);
  }
});

// Found by tracing the interaction, not the code: setView swaps the entire panel, so a tab
// strip that existed only inside Discover disappeared the moment a student pressed "Batches" —
// leaving them on a panel whose only route back was the nav item this redesign removed.
test('the opportunities tab strip exists in both panels it switches between', () => {
  for (const view of ['discover', 'batches']) {
    const at = html.indexOf(`data-portal-view="${view}"`);
    assert.notEqual(at, -1, `the ${view} panel exists`);
    const panel = html.slice(at, html.indexOf('<section class="portal-view"', at + 10));
    assert.ok(panel.includes('data-opp-tab="discover"') && panel.includes('data-opp-tab="batches"'),
      `${view} carries both tabs, so the strip survives its own use`);
  }
  assert.match(portal, /const on=t\.dataset\.oppTab===target;/);
  assert.match(portal, /if\(state\.view==='discover'\|\|state\.view==='batches'\)paintOppTabs\(state\.view\);/);
});

// One primary CTA per screen. The welcome row's button and the ladder's next step would
// otherwise both be primary and disagree about what to do first.
test('the welcome-row CTA stands down while the ladder has a next step', () => {
  const fn = portal.slice(portal.indexOf('function renderJourney()'), portal.indexOf('function renderTrialStart()'));
  assert.match(fn, /const primary=\$\('#primaryAction'\);/, 'the welcome CTA is looked up');
  assert.match(fn, /if\(primary\)primary\.hidden=nextIndex>=0;/, 'and null-guarded');
});

// The no-active-work empty state must offer a way forward, drawn from the same single ladder.
test('the empty state routes through studentJourney, not a second model', () => {
  const fn = portal.slice(portal.indexOf('function renderFocus()'), portal.indexOf('function pill('));
  assert.match(fn, /asList\(studentJourney\(state\.dashboard\)\)/, 'one model, shape-guarded');
  assert.match(fn, /second\.addEventListener\('click',next\.go\)/, "and reuses the step's own destination");
});
