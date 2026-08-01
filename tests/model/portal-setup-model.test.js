import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');

// portal.js is a browser script, not a module, so there is nothing to import. Rather than
// assert on its source text — which is how a 1,375-test suite missed four outages in one day —
// lift the two pure functions out and run them for real.
function lift(name) {
  const at = portal.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} exists in portal.js`);
  // Brace-match to the end of the declaration.
  let depth = 0, i = portal.indexOf('{', at);
  const start = i;
  for (; i < portal.length; i++) {
    if (portal[i] === '{') depth++;
    else if (portal[i] === '}' && --depth === 0) break;
  }
  return portal.slice(at, i + 1);
}

const setupModel = new Function(
  `${lift('asList')}\n${lift('setupModel')}\nreturn setupModel;`
)();

const EMPTY = { profile: {}, projects: [] };

test('an empty profile completes no steps and names the first one', () => {
  const m = setupModel(EMPTY);
  assert.equal(m.complete, 0);
  assert.equal(m.total, 6);
  assert.equal(m.next.id, 'identity');
});

// The constraint the brief states twice: "do not claim profile or verification completion
// unless supported by real data." Every step must read false on absent data, so the count can
// only ever be earned. A step that defaulted true would inflate the number silently.
test('no step reads complete without the data behind it', () => {
  for (const shape of [{}, { profile: null }, { profile: {}, projects: null }, EMPTY]) {
    const m = setupModel(shape);
    assert.equal(m.complete, 0, `nothing is claimed for ${JSON.stringify(shape)}`);
  }
  // Undefined dashboard entirely — the render pass must not throw before data lands.
  assert.equal(setupModel(undefined).complete, 0);
  assert.equal(setupModel(null).complete, 0);
});

test('a half-filled name does not count as identity', () => {
  assert.equal(setupModel({ profile: { display_name: 'Veer' } }).complete, 0, 'school missing');
  assert.equal(setupModel({ profile: { school_name: 'UBC' } }).complete, 0, 'name missing');
  // Whitespace is not an answer.
  assert.equal(setupModel({ profile: { display_name: '  ', school_name: '  ' } }).complete, 0);
  assert.equal(
    setupModel({ profile: { display_name: 'Veer', school_name: 'UBC' } }).complete, 1);
});

test('skills needs three, not one', () => {
  assert.equal(setupModel({ profile: { skills: ['a', 'b'] } }).complete, 0);
  assert.equal(setupModel({ profile: { skills: ['a', 'b', 'c'] } }).complete, 1);
});

// asList is the shape guard, so a malformed field degrades to "not done" rather than throwing
// mid-render. This is the same class of defect as the crash at portal.js:5063.
test('a malformed field is incomplete, never an exception', () => {
  for (const junk of ['three', 42, {}, { length: 9 }, true]) {
    assert.doesNotThrow(() => setupModel({ profile: { skills: junk, verticals: junk } }));
    assert.equal(setupModel({ profile: { skills: junk } }).complete, 0);
  }
});

test('evidence counts a project or a linked repository', () => {
  assert.equal(setupModel({ profile: {}, projects: [{ id: 1 }] }).complete, 1);
  assert.equal(
    setupModel({ profile: { skill_signals: { github: [{ repo: 'x' }] } } }).complete, 1);
});

test('preferences accept either axis', () => {
  assert.equal(setupModel({ profile: { verticals: ['fintech'] } }).complete, 1);
  assert.equal(setupModel({ profile: { work_types: ['research'] } }).complete, 1);
});

test('a finished profile has no next action', () => {
  const m = setupModel({
    profile: {
      display_name: 'Veer', school_name: 'UBC',
      skills: ['a', 'b', 'c'], verticals: ['fintech'],
      identity_verified: true, referral_verified: true,
    },
    projects: [{ id: 1 }],
  });
  assert.equal(m.complete, 6);
  assert.equal(m.next, null, 'nothing is invented once setup is genuinely done');
});

// Every step must be reachable. A step whose view is not a real panel would render a CTA that
// silently does nothing — the dead-button class of defect this redesign exists to remove.
test('every step deep-links to a real panel and a real element', () => {
  const allowed = ['overview', 'projects', 'activity', 'discover', 'batches', 'portfolio', 'messages', 'wallet'];
  for (const step of setupModel(EMPTY).steps) {
    assert.ok(allowed.includes(step.view), `${step.id} targets a real view`);
    const id = step.focus.replace(/^#/, '');
    assert.ok(html.includes(`id="${id}"`), `${step.id} focuses #${id}, which exists in portal.html`);
    assert.ok(step.label.length > 0 && !/score|rating|\d+%/i.test(step.label),
      `${step.id} names an action, not a score`);
  }
});

// The brief: "do not create a universal skill score" / "universal employability score".
// A count of discrete named steps is not a score — but the moment it becomes a percentage or
// a rating it starts reading as one.
test('setup is reported as a count of named steps, not a score', () => {
  const card = portal.slice(portal.indexOf('function nextActionCard('), portal.indexOf('async function loadDashboard()'));
  assert.match(card, /Setup \$\{m\.complete\} of \$\{m\.total\} complete/);
  assert.doesNotMatch(card, /%|score|rating|percent/i, 'no score language anywhere in the card');
});

// Colour alone must not carry the done state; the tick is in the text node.
test('completion is legible without colour', () => {
  const card = portal.slice(portal.indexOf('function nextActionCard('), portal.indexOf('async function loadDashboard()'));
  assert.match(card, /step\.done \? '\\u2713 ' : '\\u25cb '/, 'tick and circle are in the text');
});

// M-4: the rail and the four competing progress systems are gone, and every path that used to
// paint them is guarded. This is exactly the defect that killed the homepage from app.js:1897 —
// an element removed from markup while a renderer still reached through it.
test('the removed rail elements are gone from markup and guarded in code', () => {
  // The ring and the action list are genuinely retired — both restated what the NEXT card now
  // says once. The verification panel is NOT: a student's verification standing is real
  // information, so it moved out of the rail into the main column rather than being dropped.
  for (const gone of ['overview-rail', 'id="profileRing"', 'id="nextActions"']) {
    assert.ok(!html.includes(gone), `${gone} is out of portal.html`);
  }
  assert.ok(html.includes('id="verificationPanel"'), 'verification standing survived the rail');
  assert.ok(!css.includes('overview-rail'), 'and the rail is out of portal.css');
  // The two renderers that painted them are deleted outright, not left as guarded no-ops.
  // A guarded no-op is still dead code that reads as a live renderer to the next person.
  for (const dead of ['renderProgress', 'renderActions']) {
    assert.ok(!portal.includes(dead), `${dead} is gone, declaration and call site both`);
  }
  // renderVerification survives and keeps its host guard — the panel is real but optional.
  assert.match(portal, /const host=\$\('#verificationPanel'\); if\(!host\)return;/);
});

// The defect that killed the homepage from app.js:1897 was an element removed from markup
// while a renderer still reached through it, unguarded. Nothing in portal.js may do that.
test('no selector is dereferenced without existing in the markup', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const src = portal.replace(/\/\/[^\n]*/g, '');   // comments name absent ids on purpose
  const offenders = [];
  for (const m of src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)\s*\.\w+/g)) {
    if (!ids.has(m[1])) {
      offenders.push(`$('#${m[1]}') at line ${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(offenders, [], `these deref an element that is not in portal.html: ${offenders.join(', ')}`);
});

// Same class, the nav labels. These are painted every render and the elements are role-gated.
test('every nav label paint is null-guarded', () => {
  const at = portal.indexOf("const pl=$('#portfolioNavLabel')");
  assert.notEqual(at, -1, 'the badge paint block exists');
  const block = portal.slice(at, at + 1200);
  for (const id of ['portfolioNavLabel', 'walletNavLabel', 'projectsNavLabel', 'messageCount', 'batchesNav']) {
    assert.match(block, new RegExp(`\\$\\('#${id}'\\);?\\s*if\\(`),
      `#${id} is checked before it is written`);
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
  // Selection is painted from the target view, never from which button was pressed — otherwise
  // the two copies drift apart the first time the nav is used instead of the tab.
  assert.match(portal, /const on=t\.dataset\.oppTab===target;/);
  assert.match(portal, /if\(state\.view==='discover'\|\|state\.view==='batches'\)paintOppTabs\(state\.view\);/);
});

// One primary CTA per screen. The welcome row's button and the NEXT card would otherwise both
// be gold, both be primary, and disagree about what to do first.
test('the welcome-row CTA stands down while the NEXT card is up', () => {
  const at = portal.indexOf('function renderNextAction()');
  assert.notEqual(at, -1);
  const fn = portal.slice(at, portal.indexOf('\nfunction ', at + 10));
  assert.match(fn, /const primary=\$\('#primaryAction'\);/, 'the welcome CTA is looked up');
  assert.match(fn, /if\(primary\)primary\.hidden=rendered;/,
    'hidden exactly when a card rendered, and null-guarded');
  // Only one .portal-primary in the card itself.
  const card = portal.slice(portal.indexOf('function nextActionCard('), portal.indexOf('async function loadDashboard()'));
  assert.equal((card.match(/portal-primary/g) || []).length, 1, 'the card contributes exactly one');
});
