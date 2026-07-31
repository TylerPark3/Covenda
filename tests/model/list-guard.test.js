import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['portal.js', 'app.js', 'admin.js'];
const src = Object.fromEntries(FILES.map(f => [f, readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')]));

function lift(file, name) {
  const body = src[file];
  const start = body.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in ${file}`);
  let depth = 0, end = body.indexOf('{', start);
  for (let i = end; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}' && --depth === 0) { end = i; break; }
  }
  return new Function(`${body.slice(start, end + 1)} return ${name};`)();
}

// The crash this closes: t.unprompted came back as {} instead of [], and
// `for (const sig of (t.unprompted||[]))` threw, because an object is truthy and `||[]` only
// guards falsy. The render is one uninterrupted pass, so that single throw took the entire
// portal down and surfaced as a sign-in failure.
//
// V8's message for a *parenthesised* source is "object is not iterable (cannot read property
// Symbol(Symbol.iterator))" — it cannot name the expression — which is identical to what a bad
// `new Set(obj)` produces. That collision is what made this take three attempts to locate.
test('asList guards on shape, not truthiness', () => {
  for (const file of FILES) {
    const asList = lift(file, 'asList');
    assert.deepEqual(asList({ a: 1 }), [], `${file}: an object where a list belongs yields nothing`);
    assert.deepEqual(asList({}), [], `${file}: including an empty object`);
    assert.deepEqual(asList(null), []);
    assert.deepEqual(asList(undefined), []);
    assert.deepEqual(asList(0), []);
    assert.deepEqual(asList('abc'), [], `${file}: a string must not iterate as characters`);
  }
});

test('asList leaves real lists alone', () => {
  for (const file of FILES) {
    const asList = lift(file, 'asList');
    const arr = [1, 2, 3];
    assert.equal(asList(arr), arr, `${file}: arrays pass through by identity, not a copy`);
    assert.deepEqual([...asList(new Set([1, 2]))], [1, 2], `${file}: a Set is still iterable`);
    assert.deepEqual([...asList(new Map([['k', 'v']]))], [['k', 'v']], `${file}: so is a Map`);
  }
});

test('nothing survives that would throw on a non-list', () => {
  const SAFE = e =>
       /^\[/.test(e)
    || /\.(map|filter|flatMap|slice|concat|split|entries|keys|values|matchAll)\s*\(/.test(e)
    || /^Object\.(keys|values|entries)\s*\(/.test(e)
    || /Array\.isArray\s*\(/.test(e)
    || /^(new\s+(Set|Map)|document\.|\$\$\()/.test(e)
    || /^asList\(/.test(e)
    || /^[A-Z_][A-Z0-9_]*$/.test(e)
    || !/[.[]/.test(e);
  const re = /for\s*\(\s*(?:const|let|var)\s+[\w$]+\s+of\s+([^){;]{1,70}?)\s*\)\s*[{a-zA-Z]/g;
  const unguarded = [];
  for (const file of FILES) {
    for (const [, expr] of src[file].matchAll(re)) {
      const e = expr.trim();
      if (!SAFE(e)) unguarded.push(`${file}: for(... of ${e})`);
    }
  }
  assert.deepEqual(
    unguarded,
    [],
    'these iterate a property that is not provably a list. If the server ever returns an object '
    + `there, the whole render dies at that line. Wrap in asList(): ${unguarded.join('; ')}`,
  );
});

// The exact line reported from production. asList() stopped it throwing, but the real fix was
// to stop treating it as a list at all: unpromptedBuild returns one object, always has, and
// reading it as an empty list only replaced a crash with a silently blank section. See
// tests/model/agency-section.test.js.
test('the reported crash site no longer iterates an object', () => {
  // Scoped to the section itself. The whole file still quotes the original buggy line inside a
  // comment in buildSection, which is documentation worth keeping — a file-wide match would be
  // testing the prose rather than the code.
  const p = src['portal.js'];
  const agency = p.slice(p.indexOf("techSection('Agency'"), p.indexOf("techSection('Builder history'"));
  assert.doesNotMatch(agency, /of asList\(t\.unprompted\)/, 'not guarded-as-a-list');
  assert.doesNotMatch(agency, /of \(?t\.unprompted/, 'and not iterated raw');
  assert.match(agency, /const u=t\.unprompted;/, 'it is read as the object it is');
});
