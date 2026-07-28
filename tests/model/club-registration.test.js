import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const form = html.slice(html.indexOf('id="clubRegisterForm"'), html.indexOf('</form>', html.indexOf('id="clubRegisterForm"')));

// An officer registering between classes should finish in under a minute.
test('only the three fields that are actually required are visible', () => {
  const visible = form.slice(0, form.indexOf('<details'));
  for (const field of ['clubName', 'clubSchool', 'clubEmail']) {
    assert.match(visible, new RegExp(`name="${field}"`), `${field} should be up front`);
  }
  for (const field of ['clubRole', 'clubSize', 'clubVertical']) {
    assert.doesNotMatch(visible, new RegExp(`name="${field}"`), `${field} should be behind the disclosure`);
  }
});

test('the optional half is collapsed and labelled as optional', () => {
  assert.match(form, /<details class="club-more">/);
  assert.match(form, /Optional, and it speeds up verification/);
});

test('required fields are marked required, so the browser helps before the server does', () => {
  assert.match(form, /name="clubName"[^>]*required/);
  assert.match(form, /name="clubEmail"[^>]*required/);
  assert.match(form, /name="clubConsent"[^>]*required/);
});

// A club that chases once and hears nothing is gone.
test('the success message says what happens next and when', () => {
  assert.match(app, /replies within two working days/);
  assert.match(app, /two questions about how your club selects members/);
});

// A cold email cannot ask an officer to land on a homepage and go hunting.
test('covenda.app/#clubs lands directly on the form', () => {
  assert.match(app, /clubDeepLink/);
  assert.match(app, /'#clubs'/);
  assert.match(app, /showAudience\('university'\)/);
  assert.match(app, /clubRegister/);
  assert.match(app, /focus\(\{ preventScroll: true \}\)/, 'keyboard users land where the page is about');
});

test('the vertical select being absent never breaks setup', () => {
  // It moved inside a <details>; an early return on a missing element would kill the tier list.
  assert.match(app, /if \(!form \|\| !tiersHost\) return;/);
  assert.match(app, /if \(select\) \{/);
});
