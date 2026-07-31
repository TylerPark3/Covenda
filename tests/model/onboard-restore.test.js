import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// portal.js is a browser script rather than a module, so the function under test is lifted out
// of the source and evaluated. Asserting on the behaviour beats matching the source text: the
// bug this covers was a shape that slipped through a guard, which a regex would not have caught.
function lift(name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in portal.js`);
  let depth = 0, end = src.indexOf('{', start);
  for (let i = end; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i; break; }
  }
  return new Function(`${src.slice(start, end + 1)} return ${name};`)();
}

const mergeSavedOnboard = lift('mergeSavedOnboard');
const BASE = { role: 'student', verticals: [], workTypes: [], displayName: '', graduationYear: '', bio: '' };

// The lockout this exists to prevent: a saved payload holding an object where a list belongs
// replaced a guarded array, reached `new Set(...)`, and threw "object is not iterable". That
// TypeError escaped loadDashboard and rendered on the sign-in screen, so a signed-in member was
// told to sign in again — by a fault their session could not fix and a reload could not clear.
test('a saved list of the wrong shape is refused, not merged', () => {
  const merged = mergeSavedOnboard(BASE, { verticals: { 0: 'Research' } });
  assert.deepEqual(merged.verticals, [], 'the guarded default must survive');
  assert.doesNotThrow(() => new Set(merged.verticals));
});

test('a saved list of the right shape is restored', () => {
  const merged = mergeSavedOnboard(BASE, { verticals: ['Research', 'Operations'] });
  assert.deepEqual(merged.verticals, ['Research', 'Operations']);
});

test('scalars restore; objects and unknown keys are dropped', () => {
  const merged = mergeSavedOnboard(BASE, { displayName: 'Ada', graduationYear: 2027, bio: {}, nonsense: 'x' });
  assert.equal(merged.displayName, 'Ada');
  assert.equal(merged.graduationYear, 2027);
  assert.equal(merged.bio, '', 'an object where a string belongs is refused');
  assert.equal('nonsense' in merged, false, 'unknown keys are not carried along');
});

// Every field a multi-select screen can read has to survive a hostile payload, not just the one
// that happened to break.
test('no multi-select field can receive a non-iterable', () => {
  const merged = mergeSavedOnboard(BASE, { verticals: {}, workTypes: 'Research' });
  for (const field of ['verticals', 'workTypes']) {
    assert.ok(Array.isArray(merged[field]), `${field} must stay a list`);
    assert.doesNotThrow(() => new Set(merged[field]), field);
  }
});

test('a missing or unparsed payload leaves the defaults alone', () => {
  for (const saved of [null, undefined, {}]) {
    assert.deepEqual(mergeSavedOnboard(BASE, saved), BASE);
  }
});

test('the multi screen guards on shape, not truthiness', () => {
  assert.match(src, /new Set\(Array\.isArray\(values\[screen\.field\]\)\?values\[screen\.field\]:\[\]\)/);
});

// Presentation is half the bug: the member saw a raw JavaScript message on a sign-in screen.
test('a render crash does not present as a sign-in failure', () => {
  const fn = src.slice(src.indexOf('async function loadDashboard'), src.indexOf('function profileCompletion'));
  assert.match(fn, /error instanceof TypeError/, 'a client-side crash is distinguished from an auth failure');
  assert.match(fn, /clearOnboard\(\)/, 'and the state that caused it is dropped so a reload can recover');
});
