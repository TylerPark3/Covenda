import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unpromptedBuild } from '../../api/super-intern.js';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// The portal crash at portal.js:5063 was reported as a data problem — the server returning {}
// where a list belonged. It was not. unpromptedBuild has always returned a single object
// describing the agency dimension, and the client has always iterated it as a list. That path
// threw for every student who reached it, not for one with unusual data.
//
// asList() then stopped the crash by reading the object as an empty list, which turned a loud
// failure into a silently blank section. This pins the actual contract.
test('unpromptedBuild returns one object, never a list', () => {
  const out = unpromptedBuild([]);
  assert.equal(Array.isArray(out), false, 'it is not a list and never was');
  assert.equal(typeof out, 'object');
  for (const key of ['dimension', 'tier', 'band', 'count', 'repeated', 'ladder']) {
    assert.ok(key in out, `the contract includes ${key}`);
  }
});

test('an empty history is tier "none", not an error', () => {
  assert.equal(unpromptedBuild([]).tier, 'none');
  assert.equal(unpromptedBuild([]).count, 0);
});

test('tier climbs with what the artifacts actually show', () => {
  assert.equal(unpromptedBuild([{ finished: true }]).tier, 'finished');
  assert.equal(unpromptedBuild([{ usersReported: true }]).tier, 'used');
  assert.equal(unpromptedBuild([{}]).tier, 'started');
  // Assigned work is not agency — that is the entire distinction the dimension exists to draw.
  assert.equal(unpromptedBuild([{ assigned: true, finished: true }]).tier, 'none');
});

test('repetition is counted, because it is a different claim from magnitude', () => {
  assert.equal(unpromptedBuild([{}, {}]).repeated, true);
  assert.equal(unpromptedBuild([{}]).repeated, false);
});

// The client must read the object as an object. Reading it as a list is the original bug;
// reading it via asList is the silent version of the same misunderstanding.
test('the Agency section reads unprompted as an object', () => {
  const fn = portal.slice(portal.indexOf("techSection('Agency'"), portal.indexOf("techSection('Builder history'"));
  assert.doesNotMatch(fn, /asList\(t\.unprompted\)/, 'not as a list');
  assert.doesNotMatch(fn, /of \(?t\.unprompted/, 'and not iterated');
  assert.match(fn, /u\.band&&u\.band\.label/, 'the band label is shown');
  assert.match(fn, /u\.count/, 'and the count');
  assert.match(fn, /u\.tier!=='none'/, 'nothing recorded renders nothing, not a zero');
});
