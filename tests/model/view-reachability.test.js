import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');

// Found by a pre-merge audit, and it was this branch's fault.
//
// The nav reduction moved #batchesNav to data-roles="company", so for a student that button is
// hidden. But the same change added a Batches TAB inside Opportunities, giving students a route
// to the view whose nav button had just been taken away.
//
// setView stamped .is-active onto the hidden button anyway. renderDashboard reads the active nav
// item to decide whether the current view still exists for this role, saw a hidden one, and sent
// the student to Home. Concrete: open Opportunities, click Batches, start a simulation, close it
// (that path calls loadDashboard with no trailing setView) — you are on Home with no explanation
// and a stale tab selection.
//
// The journey ladder's "Apply to a batch" step routes straight into it, which made the single
// most prominent CTA on the redesigned overview a trap.

test('a hidden nav button never claims to be the active view', () => {
  const fn = portal.slice(portal.indexOf('function setView(view, opts)'), portal.indexOf('#memberBreadcrumb'));
  assert.match(fn, /!button\.hidden&&button\.dataset\.view===state\.view/,
    'hidden buttons are excluded from .is-active, or they read as "this view is gone"');
});

test('views reachable without a nav item are not treated as stranded', () => {
  const fn = portal.slice(portal.indexOf('const REACHABLE_WITHOUT_NAV'), portal.indexOf('$$(\'[data-org-only]\')'));
  assert.match(fn, /student: \['batches', 'activity'\]/,
    'students reach Batches via the tab strip and Activity via the overview metric');
  assert.match(fn, /!reachable\.has\(state\.view\)/, 'and are not ejected from either');
});

// The two routes must actually exist, or the exemption above is protecting nothing.
test('the student routes into those views are real', () => {
  assert.match(html, /data-opp-tab="batches"/, 'the Batches tab exists in the markup');
  assert.match(portal, /setView\(target==='batches'\?'batches':'discover'\)/, 'and it navigates there');
  assert.match(portal, /setView\('activity'\)/, 'the Applications metric routes to activity');
});

// The fallback must still do its job: a role that genuinely loses a view sees the overview, not
// an empty pane.
test('a genuinely unavailable view still falls back', () => {
  const fn = portal.slice(portal.indexOf('const REACHABLE_WITHOUT_NAV'), portal.indexOf('$$(\'[data-org-only]\')'));
  assert.match(fn, /navButton && navButton\.hidden && !reachable\.has\(state\.view\)/,
    'hidden AND unreachable is what strands someone');
  assert.match(fn, /if \(strandedView\) setView\('overview'\)/);
  // Companies and universities have no tab-only routes, so their lists stay empty on purpose.
  assert.match(fn, /company: \[\]/);
  assert.match(fn, /university: \[\]/);
});

// One naming system for the nav. The redesign briefly had two — NAV_LABELS plus a direct paint
// of three ids — which ran every render and disagreed, so order decided the winner. A student
// saw "Explore" and "Chats" from the map and "Profile" and "Earnings" from the paint.
test('nav labels come from exactly one place', () => {
  assert.match(portal, /const NAV_LABELS = \{/);
  for (const dead of ['portfolioNavLabel', 'walletNavLabel', 'projectsNavLabel']) {
    const code = portal.replace(/\/\/[^\n]*/g, '');
    assert.ok(!code.includes(dead), `${dead} is gone: the second naming system is deleted`);
  }
  assert.match(portal, /discover: 'Opportunities'/, 'the map carries the redesign names now');
  assert.match(portal, /student: \{[^}]*messages: 'Messages'/);
});
