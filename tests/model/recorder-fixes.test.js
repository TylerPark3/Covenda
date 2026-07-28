import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');

// Mirroring is right for a selfie camera and wrong for everything else: a shared screen
// showed every word backwards.
test('only the camera preview is mirrored', () => {
  assert.match(css, /\.rec-stage\[data-capture="camera"\] video \{ transform: scaleX\(-1\); \}/);
  assert.doesNotMatch(css, /\.rec-stage video \{[^}]*scaleX\(-1\)/, 'never on the bare selector');
  assert.match(portal, /data-capture="'\+\(mode==='screen'\?'screen':'camera'\)/, 'the stage says which it is');
});

test('a shared screen is contained, not cropped', () => {
  assert.match(css, /\.rec-stage\[data-capture="screen"\] video \{ object-fit: contain/);
});

// The instruction used to appear after the picker had already closed.
test('what to share is said before the picker, not after', () => {
  assert.match(portal, /Pick the window with your work in it, not this tab/);
  assert.doesNotMatch(portal, /Share the window you are working in\. Talk through/, 'the late instruction is gone');
});

test('a screen exercise is labelled a task, not a prompt', () => {
  assert.match(portal, /mode==='screen'\?'The task':'Your prompt'/);
});

// A MediaRecorder WebM carries no duration until something forces a full scan, so the player
// reports 0:00, refuses to seek, and shows black.
test('playback forces the duration to be computed', () => {
  const fn = portal.slice(portal.indexOf('recorder.onstop'), portal.indexOf('recorder.onstop') + 1800);
  assert.match(fn, /loadedmetadata/);
  assert.match(fn, /video\.currentTime=1e101/, 'seeking past the end makes the browser scan it');
  assert.match(fn, /video\.currentTime=0/, 'then back, so there is a visible first frame');
});

// A student blocked by a problem in the faster path is a student who does not apply.
test('a failed direct upload falls back rather than failing', () => {
  const fn = portal.slice(portal.indexOf('async function uploadRecording'), portal.indexOf('async function screenStream'));
  assert.match(fn, /catch\(directError\)/);
  assert.match(fn, /\/api\/video-upload/, 'the server route is the fallback');
  assert.match(fn, /TOO_LARGE/, 'except when the file is genuinely too large, which retrying cannot fix');
});

test('both paths failing says which limit was hit', () => {
  const fn = portal.slice(portal.indexOf('async function uploadRecording'), portal.indexOf('async function screenStream'));
  assert.match(fn, /too long to upload/);
  assert.match(fn, /paste a link instead/, 'and offers the route that always works');
});

test('the fallback ceiling covers a real screen share', () => {
  const api = readFileSync(new URL('../../api/video-upload.js', import.meta.url), 'utf8');
  assert.match(api, /MAX_BYTES = 95 \* 1024 \* 1024/, '30 MB would reject anything past a minute');
});
