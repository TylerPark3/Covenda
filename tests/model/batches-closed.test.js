import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { batchApplicationsOpen, applyToBatch, BATCHES_CLOSED_MESSAGE } from '../../api/portal.js';

const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// Closed by DEFAULT. Several specialisations do not yet verify what they claim to, and a
// student applying to one of those spends real hours against a bar about to change. Defaulting
// to open would make a forgotten env var the only thing preventing that.
test('applications are closed unless deliberately switched on', () => {
  assert.equal(batchApplicationsOpen({}), false, 'an empty environment leaves applications open');
  assert.equal(batchApplicationsOpen({ COVENDA_BATCH_APPLICATIONS_OPEN: 'false' }), false);
  assert.equal(batchApplicationsOpen({ COVENDA_BATCH_APPLICATIONS_OPEN: 'yes' }), false, 'only an exact "true" opens them');
  assert.equal(batchApplicationsOpen({ COVENDA_BATCH_APPLICATIONS_OPEN: 'true' }), true);
});

// A closed door that exists only in the client is not closed.
test('the server refuses an application before it touches anything', async () => {
  const member = {
    user: { id: 'u1' },
    // Any database call here means the refusal came too late to be a real gate.
    supabase: { from() { throw new Error('the request reached the database while closed'); } },
  };
  await assert.rejects(() => applyToBatch(member, { batchId: 'b1' }, {}), /Applications open again soon/);
});

test('the refusal says it is temporary and that prior work is safe', () => {
  assert.match(BATCHES_CLOSED_MESSAGE, /open again soon/i);
  assert.match(BATCHES_CLOSED_MESSAGE, /nothing you have already submitted is affected/i);
});

test('the dashboard tells the client, so the portal never offers a control that fails', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(api, /batchApplicationsOpen: batchApplicationsOpen\(env\)/);
  assert.match(api, /batchesClosedMessage: BATCHES_CLOSED_MESSAGE/);
});

test('the button says what is happening rather than being dead', () => {
  const card = js.slice(js.indexOf('function batchCard('), js.indexOf('let batchResumeUrl'));
  assert.match(card, /Opening soon/);
  assert.match(card, /state\.dashboard\?\.batchApplicationsOpen===false/);
  assert.match(card, /learn\.disabled=closed\|\|batch\.status!=='open'/);
});

test('one banner above the list, not the same note on twenty-five cards', () => {
  const render = js.slice(js.indexOf('function renderBatches('), js.indexOf('function renderCompanyBatches'));
  assert.match(render, /batch-closed-notice/);
  assert.match(render, /Applications open again soon/);
});

// Browsing stays open on purpose: a student deciding whether Covenda is worth returning to
// should still be able to see what the batches are.
test('batches are still browsable while applications are shut', () => {
  const render = js.slice(js.indexOf('function renderBatches('), js.indexOf('function renderCompanyBatches'));
  assert.ok(!/return;\s*}\s*renderBatchFilter/.test(render.slice(0, render.indexOf('renderBatchFilter'))),
    'the list is being hidden entirely rather than marked closed');
  assert.match(render, /for\(const batch of batches\)root\.append\(batchCard/);
});
