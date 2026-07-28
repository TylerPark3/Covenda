import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mayReplace, cleanTranscript, saveTranscript, requestAccommodation } from '../../api/transcripts.js';

const member = (video = { id: 'v1', user_id: 'u1', transcript_source: null }) => ({
  user: { id: 'u1' },
  supabase: { from: () => ({
    select: () => ({ eq: function () { return this; }, maybeSingle: async () => ({ data: video, error: null }) }),
    update: () => ({ eq: function () { return this; }, then: r => r({ error: null }) }),
    insert: async () => ({ error: null }),
  }) },
});

// A wrong machine transcript replacing an accurate human one is worse than no transcript.
test('a student transcript is authoritative and machine text never overwrites it', () => {
  assert.equal(mayReplace('student', 'auto'), false);
  assert.equal(mayReplace('auto', 'student'), true);
  assert.equal(mayReplace(null, 'auto'), true);
});

test('the student path needs no transcription service to work', () => {
  const src = readFileSync(new URL('../../api/transcripts.js', import.meta.url), 'utf8');
  // Shipping nothing while waiting for an API key would leave the gap open indefinitely.
  assert.doesNotMatch(src, /OPENAI|WHISPER|DEEPGRAM|ASSEMBLY/i, 'no key required on the primary path');
  assert.match(src, /export async function saveTranscript/);
});

test('a transcript belonging to someone else cannot be written', async () => {
  await assert.rejects(
    () => saveTranscript(member(null), { videoId: 'v1', text: 'hello there friend' }),
    /not yours/,
  );
});

test('transcripts are bounded and normalised', () => {
  assert.equal(cleanTranscript('  hi\r\nthere '), 'hi\nthere');
  assert.equal(cleanTranscript(''), null);
  assert.equal(cleanTranscript('x'.repeat(30000)).length, 20000);
});

// Requiring someone to classify their own disability in order to apply is its own barrier.
test('an accommodation request never asks for a diagnosis or a category', () => {
  const src = readFileSync(new URL('../../api/transcripts.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /diagnos(is|es)['"]|disabilityType|condition:/i);
  assert.match(src, /never asks for a diagnosis/i, 'and says so, so nobody adds one later');
});

test('an accommodation request goes to a person and says what happens next', async () => {
  const out = await requestAccommodation(member(), { context: 'batch_application', need: 'I would rather answer in writing.' });
  assert.equal(out.sent, true);
  assert.match(out.note, /person reads this/);
  assert.match(out.note, /not blocked/, 'applying must not stall while they wait');
});

test('an empty request is refused rather than filed as noise', async () => {
  await assert.rejects(() => requestAccommodation(member(), { need: 'help' }), /sentence or two/);
});

test('the accommodation route is reachable from the batch application, not buried', () => {
  const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  assert.match(portal, /accommodationLink\('batch_application'/);
  assert.match(portal, /transcriptEditor\(v\)/, 'and every recording carries a transcript editor');
});
