import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
const fn = portal.slice(portal.indexOf('function renderBatchFilter'), portal.indexOf('function renderBatches'));

// Dragging a slider re-rendered the entire list on every pixel of movement.
test('the slider is gone', () => {
  assert.doesNotMatch(fn, /type='range'|type="range"/);
  assert.doesNotMatch(css, /\.batch-filter-range/);
});

// A threshold that would leave nothing should say so before it is chosen, not after.
test('every step shows how many batches it would leave', () => {
  assert.match(fn, /const count=open\.filter/);
  assert.match(fn, /b\.append\(t,n\)/, 'the count renders alongside the label');
});

test('a step that would empty the list is disabled, not silently destructive', () => {
  assert.match(fn, /if\(count===0&&step\.value>0\)\{ b\.disabled=true/);
});

test('All is always available, even at zero matches', () => {
  // The guard is `step.value > 0`, so All never disables and a student is never stranded.
  assert.match(fn, /step\.value>0/);
});

test('the control is reachable without a mouse', () => {
  assert.match(fn, /aria-pressed/);
  assert.match(fn, /role','group'/);
  assert.match(fn, /aria-label','Filter batches/);
  assert.match(css, /\.batch-fit-step:focus-visible/);
});

test('targets are big enough for a thumb', () => {
  assert.match(css, /\.batch-fit-step \{[\s\S]*?min-height:38px/);
});

test('the empty state still explains what unlocks the filter', () => {
  assert.match(fn, /Add skills and every batch shows how it lines up/);
});
