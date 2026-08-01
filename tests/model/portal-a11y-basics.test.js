import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../portal.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');

// A keyboard user should not have to walk six navigation items to reach the content on every
// single page load. The nav reduction from eight destinations to six made this better and did
// not make it unnecessary.
test('a skip link is the first tabbable thing on the page', () => {
  const skip = html.indexOf('class="skip-link"');
  const nav = html.indexOf('<aside class="member-nav">');
  assert.notEqual(skip, -1, 'the skip link exists');
  assert.ok(skip < nav, 'and comes before the navigation in source order');
  assert.match(html, /href="#memberMain"/);
  assert.match(html, /<main class="member-main" id="memberMain" tabindex="-1">/,
    'the target is focusable, or the jump moves the viewport without moving focus');
});

// display:none cannot be tabbed to, which would defeat the entire point of a skip link.
test('the skip link is reachable by keyboard, not merely hidden', () => {
  const rule = css.slice(css.indexOf('.skip-link {'), css.indexOf('.skip-link:focus'));
  assert.doesNotMatch(rule, /display:\s*none/, 'off-screen, never display:none');
  assert.doesNotMatch(rule, /visibility:\s*hidden/);
  assert.match(rule, /position:absolute/);
  assert.match(css, /\.skip-link:focus \{[^}]*left:8px/, 'and it becomes visible on focus');
});

// The account menu was added today at 40px. Anything this change introduced meets the 44px
// guidance; the pre-existing controls below that line are recorded in TODOS rather than being
// silently restyled, since layout changes cannot be verified here without a browser.
test('controls introduced by this redesign meet the 44px tap guidance', () => {
  for (const [selector, why] of [
    ['.member-account-menu button', 'the account menu, added with the nav redesign'],
    ['.skip-link', 'the skip link, added here'],
  ]) {
    const at = css.indexOf(selector + ' {');
    assert.notEqual(at, -1, `${selector} has a rule`);
    const body = css.slice(at, css.indexOf('}', at));
    const m = body.match(/min-height:\s*(\d+)px/);
    assert.ok(m, `${selector} declares a min-height`);
    assert.ok(Number(m[1]) >= 44, `${why}: ${m[1]}px is under the 44px guidance`);
  }
});

// The tab strip is a real tablist and has to behave like one for anyone not using a mouse.
test('the opportunities tabs carry their roles', () => {
  const strip = html.slice(html.indexOf('class="opp-tabs"'), html.indexOf('</div>', html.indexOf('class="opp-tabs"')));
  assert.match(strip, /role="tablist"/);
  assert.match(strip, /aria-label="Opportunities"/);
  assert.equal((strip.match(/role="tab"/g) || []).length, 2, 'both tabs are tabs');
  assert.match(strip, /aria-selected="(true|false)"/);
});

// The disclosure has to announce its state, or a screen reader user infers it from what vanished.
test('the account menu is a real disclosure', () => {
  assert.match(html, /id="memberIdentity"[^>]*aria-expanded="false"/);
  assert.match(html, /aria-controls="memberAccountMenu"/);
});
