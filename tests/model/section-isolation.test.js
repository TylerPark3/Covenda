import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');

function lift(name, extra = '') {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in portal.js`);
  let depth = 0, end = src.indexOf('{', start);
  for (let i = end; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i; break; }
  }
  return new Function('document', 'console', `${extra}${src.slice(start, end + 1)} return ${name};`);
}

// Minimal DOM: buildSection only ever creates and appends an element.
function fakeDom() {
  const make = () => ({ className: '', textContent: '', children: [], append(c) { this.children.push(c); } });
  return { createElement: make };
}

// The failure this contains: the dashboard renders in one uninterrupted pass, so a throw in any
// section aborted every section after it. One profile with t.unprompted === {} took the entire
// portal down and surfaced on the sign-in screen as though the session had failed.
test('a throwing section does not propagate', () => {
  const logged = [];
  const buildSection = lift('buildSection')(fakeDom(), { error: (...a) => logged.push(a) });
  const body = { className: '', textContent: '', children: [], append(c) { this.children.push(c); } };

  assert.doesNotThrow(() => buildSection(body, () => { throw new TypeError('object is not iterable'); }, 'Agency'));
  assert.equal(logged.length, 1, 'the real error must still reach the console');
  assert.match(String(logged[0][0]), /section "Agency" failed/);
});

test('a failed section says so instead of vanishing', () => {
  const buildSection = lift('buildSection')(fakeDom(), { error() {} });
  const body = { className: '', textContent: '', children: [], append(c) { this.children.push(c); } };
  const ok = buildSection(body, () => { throw new Error('boom'); }, 'Breadth');

  assert.equal(ok, false, 'the caller must be able to tell success from failure');
  assert.equal(body.children.length, 1, 'a notice is rendered');
  assert.equal(body.children[0].className, 'section-error');
  assert.match(body.children[0].textContent, /could not be displayed/);
});

test('a working section is untouched', () => {
  const buildSection = lift('buildSection')(fakeDom(), { error() {} });
  const body = { className: '', textContent: '', children: [], append(c) { this.children.push(c); } };
  const ok = buildSection(body, b => b.append({ className: 'chip' }), 'Depth');

  assert.equal(ok, true);
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0].className, 'chip', 'no wrapper, no interference');
});

// emptyText means "nothing here yet". A crash means something else entirely. Showing the empty
// copy after a failure would tell a student their evidence is missing when it is actually the
// render that broke — a lie they cannot detect and will not report.
test('a crashed section is never mistaken for an empty one', () => {
  const fn = src.slice(src.indexOf('function techSection'), src.indexOf('function renderTechnicalVertical'));
  assert.match(fn, /const built=buildSection\(/, 'techSection routes through buildSection');
  assert.match(fn, /if\(built&&!body\.childElementCount\)/, 'empty copy only when the build succeeded');
});

test('both section builders are isolated', () => {
  assert.match(src, /buildSection\(body,build,title\)/, 'portalGroup is isolated');
  assert.equal((src.match(/buildSection\(/g) || []).length >= 3, true, 'definition plus both call sites');
});

test('the failure state is visually distinct from the empty state', () => {
  assert.match(css, /\.section-error\s*\{/);
  assert.match(css, /\.section-error[^}]*var\(--danger\)/, 'failure uses the danger token, not the soft empty-state colour');
});
