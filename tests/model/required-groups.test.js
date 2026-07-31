import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const validateStep = app.slice(app.indexOf('function validateStep(form)'), app.indexOf('function selectChip'));

// Reported by a real user: "trying to make a profile and send it doesn't work, says I didn't
// fill out all the fields even though I did."
//
// He had. The industry group was the one required answer whose check was hard-coded in
// validateStep rather than declared on the markup, and that branch set a message and did nothing
// else — no is-missing highlight, no scrollIntoView. Every other group does both. So the student
// saw a sentence, possibly off-screen, and no indication of which control it meant. The group's
// legend is visually-hidden, so there was not even a question next to the cards to re-read.
test('every required group declares itself on the markup', () => {
  assert.doesNotMatch(validateStep, /studentIndustry/,
    'no group may be special-cased in validateStep — that is how this one drifted');
  assert.match(html, /class="industry-fieldset" data-require-group="Choose at least one industry\."/);
});

test('one mechanism handles every group, and it both highlights and scrolls', () => {
  assert.match(validateStep, /for \(const group of \$\$\('\[data-require-group\]', step\)\)/);
  assert.match(validateStep, /group\.classList\.add\('is-missing'\)/, 'the control is marked');
  assert.match(validateStep, /group\.scrollIntoView/, 'and brought into view');
  assert.match(validateStep, /message\.textContent = group\.dataset\.requireGroup/, 'with its own message');
});

// A highlight that styles nothing is not a highlight. The industry group is a fieldset of cards,
// not a .chip-field, so the existing rule did not reach it.
test('the highlight is visible on every kind of group', () => {
  assert.match(css, /\.chip-field\.is-missing/, 'chip groups');
  assert.match(css, /\.industry-fieldset\.is-missing \.industry-card/, 'and the card grid');
});

test('the student form still requires an industry', () => {
  // The requirement is not being removed — only moved to where it can be seen and reported.
  assert.match(html, /data-require-group="Choose at least one industry\."/);
  assert.match(html, /name="studentIndustry"/);
});

// Guard the general shape: any group that can block a step must be declarable, so the next
// person adding one does not have to remember to edit validateStep too.
test('no other form hard-codes a group check', () => {
  const hardCoded = validateStep.match(/input\[name="[a-zA-Z]+"\]:checked/g) || [];
  assert.deepEqual(hardCoded, [], `these bypass the declared mechanism: ${hardCoded.join(', ')}`);
});

// Design review, live: 19 of 23 controls on the public student form are required and not one of
// them said so. Badging every field would be noise; badging none is what let a student fill in
// everything he could see and still be told he had missed something. The default is stated once,
// on the rail, and the exceptions carry their own mark.
test('the form says that answers are required by default', () => {
  assert.match(html, /Everything is required unless marked optional\./);
  assert.match(css, /\.form-rail-required/);
});

test('every genuinely optional field is marked, and the honeypot is not', () => {
  const form = html.slice(html.indexOf('id="studentForm"'), html.indexOf('</form>', html.indexOf('id="studentForm"')));
  for (const label of ['Portfolio or work sample URL', 'Record a 1-minute intro', 'Video transcript or captions']) {
    const at = form.indexOf(label);
    assert.notEqual(at, -1, `${label} exists`);
    assert.match(form.slice(at, at + 260), /Optional/i, `${label} is marked optional`);
  }
  // The honeypot must stay unmarked and unlabelled — it is a spam trap, not a question.
  const honey = form.slice(form.indexOf('class="honeypot"'), form.indexOf('class="honeypot"') + 200);
  assert.doesNotMatch(honey, /field-optional/, 'the honeypot is never dressed up as a real field');
});

