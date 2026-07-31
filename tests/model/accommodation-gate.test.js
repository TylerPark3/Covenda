import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const transcripts = readFileSync(new URL('../../api/transcripts.js', import.meta.url), 'utf8');

function lift(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = src.indexOf('{', start);
  for (let i = end; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i; break; }
  }
  return src.slice(start, end + 1);
}

// The product promised this in two places and did the opposite in a third. The accommodation
// panel says "applying is not blocked while you wait"; requestAccommodation returns the same
// sentence; and the batch submit handler refused to submit without a video regardless. A
// student who cannot record was told to ask, told asking would not block them, and then blocked.
test('the promise is actually made, in both places', () => {
  assert.match(portal, /applying is not blocked while you wait/, 'the panel says it');
  assert.match(transcripts, /applying is not blocked while you wait/, 'the server repeats it');
});

test('the submit gate honours an open accommodation', () => {
  const guard = portal.slice(portal.indexOf("if(!e.videoUrl.value.trim()"), portal.indexOf("button.disabled=true;setDialogMessage('#batchApplyMessage','Submitting"));
  assert.match(guard, /hasOpenAccommodation\('batch_application'/, 'an open request lifts the video requirement');
});

test('the block still applies to someone who simply has not recorded yet', () => {
  const fn = lift(portal, 'hasOpenAccommodation');
  assert.match(fn, /accommodationsSentThisVisit\.has/, 'requests made this visit count');
  assert.match(fn, /state\.dashboard\?\.accommodations/, 'and requests made earlier count');
  // With neither, the guard's !hasOpenAccommodation is true and the block stands.
  assert.doesNotMatch(fn, /return true;\s*}\s*$/, 'it must not short-circuit to always-open');
});

// A student who asks for an accommodation and returns tomorrow must not be blocked by a page
// that forgot. That requires the server to say so, not just this session's memory.
test('open requests survive a reload', () => {
  assert.match(api, /export async function loadOpenAccommodations/);
  assert.match(api, /\.in\('status', \['open', 'arranged'\]\)/, 'open and arranged both still count');
  assert.match(api, /accommodations,/, 'and reach the dashboard payload');
});

// The need text can describe a disability. It belongs on the operator surface and nowhere else.
test('the free-text need never reaches the client', () => {
  const fn = lift(api, 'loadOpenAccommodations');
  assert.match(fn, /\.select\('context, reference, status'\)/, 'only the three fields the gate needs');
  assert.doesNotMatch(fn, /need/, 'the need text is not selected');
});

// A dashboard must still render for a member whose database predates the table.
test('a missing table degrades instead of breaking the dashboard', () => {
  const fn = lift(api, 'loadOpenAccommodations');
  assert.match(fn, /if \(error\) return \[\]/);
});

test('the message points at the accommodation route instead of just refusing', () => {
  assert.match(portal, /If recording will not work for you, use "Need a different way to do this\?" above/);
});
