import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
const adminApi = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');

const loader = api.slice(api.indexOf('export async function loadCompanyShortlists'), api.indexOf('export async function loadIntroductions'));

// The operator has been able to curate a shortlist into `matches` for some time, and both the
// admin route and the database require a rationale for every decision. None of it ever reached
// the company. A founder saw project_applications — students who applied to them — and never the
// five people we picked by hand and wrote reasons for, which is the entire product.
test('the operator side was already complete', () => {
  assert.match(adminApi, /human_decision: decision, human_rationale: rationale/, 'decisions carry a rationale');
});

test('a company only ever sees its own briefs', () => {
  assert.match(loader, /\.eq\('owner_user_id', member\.user\.id\)/, 'briefs are scoped to the owner');
  assert.match(loader, /\.in\('opportunity_id', ids\)/, 'and matches are scoped to those briefs');
});

test('only proposed candidates are shown', () => {
  assert.match(loader, /\.eq\('human_decision', 'proposed'\)/,
    'candidates under consideration and rejected ones are not the shortlist');
});

// The repo's own rule: an employer sees a tier, never a raw percentage, because a company
// comparing 71 against 68 is reading precision that is not there.
test('the score never leaves the server', () => {
  assert.doesNotMatch(loader, /score_components/, 'components are not selected');
  const select = loader.slice(loader.indexOf(".select('id, opportunity_id"), loader.indexOf('.in('));
  assert.doesNotMatch(select, /\bscore\b/, 'nor the score itself');
  assert.match(loader, /presentationBand\(claimsFromProfile\(profile\)\)/, 'a band is sent instead');
  assert.doesNotMatch(portal.slice(portal.indexOf('function shortlistCard'), portal.indexOf('function renderProjects')), /score/i,
    'and the card renders no number');
});

// Five candidates in a column read as a ranking whatever the intent, so order is by decision
// time and the page says so outright.
test('nothing is ranked, and the page says so', () => {
  assert.match(loader, /\.order\('decided_at', \{ ascending: true \}\)/, 'ordered by decision, not score');
  assert.match(portal, /Listed in no particular order — nothing here is ranked/);
});

test('the reasoning leads the card', () => {
  const card = portal.slice(portal.indexOf('function shortlistCard'), portal.indexOf('function renderProjects'));
  assert.ok(card.indexOf('shortlist-why') < card.indexOf('shortlist-who'),
    'the operator rationale is rendered above the identity block');
  assert.ok(card.indexOf('shortlist-band') < card.indexOf('shortlist-why'),
    'and the evidence band above that — evidence, then reasoning, then who');
});

test('the engine explanation stays secondary to the human judgement', () => {
  const card = portal.slice(portal.indexOf('function shortlistCard'), portal.indexOf('function renderProjects'));
  assert.match(card, /createElement\('details'\)/, 'it is collapsed, not competing with the rationale');
});

// A company whose first shortlist arrives before it has posted anything else must still see it.
test('a shortlist is not hidden by an empty project list', () => {
  assert.match(portal, /if\(!items\.length&&!asList\(state\.dashboard\.shortlists\)\.length\)/);
});

test('a missing matches table degrades instead of breaking the dashboard', () => {
  assert.match(loader, /optional\(member\.supabase\.from\('matches'\)/, 'optional(), like every other late table');
  assert.match(loader, /if \(!ids\.length\) return \[\]/);
  assert.match(loader, /if \(!rows\.length\) return \[\]/);
});

test('tier is carried by text, not only colour', () => {
  const card = portal.slice(portal.indexOf('function shortlistCard'), portal.indexOf('function renderProjects'));
  assert.match(card, /titleCase\(c\.evidenceBand\|\|'self_reported'\)\+' evidence'/, 'the band is spelled out');
  assert.match(css, /\.shortlist-band\.is-self_reported/, 'and styled distinctly');
});
