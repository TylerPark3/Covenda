import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptFor, raterView, MODE_BY_SLUG, MODES, ANECDOTE_PROBES } from '../../api/session-script.js';
import { BATCH_CATALOG } from '../../api/batches.js';

// Asking a robotics candidate to screen-share is asking them to perform the least
// representative part of their discipline.
test('robotics is a conversation, not a screen share', () => {
  const s = scriptFor('physical-ai');
  assert.equal(s.mode, 'conversation');
  assert.equal(s.capture, 'camera');
  assert.match(s.brief, /No screen share/);
  assert.ok(s.probes.length >= 3, 'and it gets anecdote probes');
  assert.match(s.probes[0], /simulation/i);
});

test('work that lives on a screen is screen-shared', () => {
  for (const slug of ['ai-ml', 'investment-banking', 'health-analytics']) {
    assert.equal(scriptFor(slug).capture, 'screen', slug);
  }
});

test('hybrid moves off the screen partway through', () => {
  const s = scriptFor('management-consulting');
  assert.equal(s.mode, 'hybrid');
  assert.ok(s.beats.some(b => /stop sharing/i.test(b.say)));
});

// A bare screen share produces twenty silent minutes of clicking.
test('every mode is scripted, and every prompt says what it reads', () => {
  for (const mode of MODES) {
    const slug = Object.entries(MODE_BY_SLUG).find(([, m]) => m === mode)?.[0];
    const s = scriptFor(slug);
    assert.ok(s.beats.length >= 5, mode);
    for (const b of s.beats) {
      assert.ok(b.say.length > 15, mode);
      assert.ok(b.why.length > 25, `${mode}: every prompt states what it reads`);
    }
  }
});

test('prompts scale with the exercise rather than firing on a fixed clock', () => {
  const short = scriptFor('ai-ml', { minutes: 10 });
  const long = scriptFor('ai-ml', { minutes: 30 });
  assert.equal(short.beats.length, long.beats.length);
  assert.ok(long.beats[4].atSeconds > short.beats[4].atSeconds);
  assert.equal(short.beats[0].atSeconds, 0, 'the first fires before they touch anything');
});

// Dead ends are the clearest authorship signal there is.
test('the conversation script asks what did NOT work', () => {
  const beats = scriptFor('physical-ai').beats.map(b => b.say).join(' ');
  assert.match(beats, /did not work/i);
  assert.match(beats, /did not fix it/i);
  // And the second half of the closing question, which is the discriminator.
  assert.match(beats, /why did you not do that then/i);
});

test('every specialisation has a mode, and none defaults silently', () => {
  const missing = BATCH_CATALOG.filter(b => !MODE_BY_SLUG[b.slug]).map(b => b.slug);
  assert.deepEqual(missing, [], 'every slug should be assigned deliberately');
});

// Silence at a prompt is an observation, not a gap.
test('the rater view tells a reader what to do with silence', () => {
  const r = raterView(scriptFor('ai-ml'));
  assert.ok(r.checkpoints.length >= 5);
  assert.match(r.checkpoints[0].ifSilent, /is data, not a missing field/);
});

test('anecdote probes ask for something only a participant would hold', () => {
  for (const [slug, probes] of Object.entries(ANECDOTE_PROBES)) {
    for (const p of probes) {
      assert.ok(p.length > 30, slug);
      assert.doesNotMatch(p, /tell me about a project/i, 'no generic invitations');
    }
  }
});
