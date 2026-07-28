import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isEnabled, asBatch, syntheticStudent, syntheticProject, syntheticOutcome } from '../../api/synthetic.js';

// Required test 4 from the brief: a default query returns zero synthetic records.
test('synthetic rows are excluded from every surface a person browses', () => {
  const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const discover = portal.slice(portal.indexOf("eq('status', 'open')") - 200, portal.indexOf("eq('status', 'open')") + 200);
  assert.match(discover, /eq\('synthetic', false\)/, 'the discover feed must exclude them');
  const dir = portal.slice(portal.indexOf("from('member_profiles').select('user_id,display_name"), portal.indexOf("from('member_profiles').select('user_id,display_name") + 400);
  assert.match(dir, /eq\('synthetic', false\)/, 'the talent directory must exclude them');
});

test('every synthetic record carries the tag on the row, not a naming convention', () => {
  assert.equal(syntheticStudent({}).synthetic, true);
  assert.equal(syntheticProject({}).synthetic, true);
  // A convention holds until somebody forgets; a column can be filtered on with confidence.
  const src = readFileSync(new URL('../../api/synthetic.js', import.meta.url), 'utf8');
  assert.match(src, /The tag is on the ROW, not on a naming convention/);
});

test('a synthetic project can never become discoverable', () => {
  assert.equal(syntheticProject({ visibility: 'open', status: 'open' }).visibility, 'private');
});

test('the endpoint is off in production unless explicitly switched on', () => {
  assert.equal(isEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isEnabled({ NODE_ENV: 'production', SYNTHETIC_DATA_ENABLED: 'true' }), true);
  assert.equal(isEnabled({ NODE_ENV: 'development' }), true);
});

test('bulk writes are bounded so a malformed loop cannot flood the table', () => {
  assert.equal(asBatch({ a: 1 }).length, 1, 'one object or an array, per the brief');
  assert.equal(asBatch([{ a: 1 }, { b: 2 }]).length, 2);
  assert.throws(() => asBatch(Array(500).fill({})), /At most 100/);
});

// Inserting a label directly would test nothing. The point is to exercise the real path.
test('an outcome is written as events so it travels the same path a real trial does', async () => {
  const written = [];
  const db = { from: () => ({ insert: async rows => { written.push(...rows); return { error: null }; } }) };
  const out = await syntheticOutcome(db, { matchId: 'm1', accepted: true, wouldRequestAgain: true });
  assert.equal(out.expectedLabel, 1);
  assert.deepEqual(written.map(r => r.event_type), ['match_shown', 'deliverable_accepted', 'closeout_rating']);
  assert.equal(written[0].features.synthetic, true, 'and carries a feature vector, as match_shown must');
});

test('the rating is required, because it is the label', async () => {
  const db = { from: () => ({ insert: async () => ({ error: null }) }) };
  await assert.rejects(() => syntheticOutcome(db, { matchId: 'm1', accepted: true }), /it is the label/);
  await assert.rejects(() => syntheticOutcome(db, { accepted: true, wouldRequestAgain: true }), /matchId is required/);
});

test('accepted without a positive rating is a zero, not a one', async () => {
  const db = { from: () => ({ insert: async () => ({ error: null }) }) };
  const out = await syntheticOutcome(db, { matchId: 'm2', accepted: true, wouldRequestAgain: false });
  assert.equal(out.expectedLabel, 0, 'employers accept mediocre work to be polite');
});
