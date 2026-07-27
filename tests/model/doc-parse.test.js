import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentText, tidy, textQuality, MIN_USEFUL_CHARS, DOC_PARSE_VERSION } from '../../api/doc-parse.js';

const enc = new TextEncoder();
const REAL = 'Our month-end close slips by about a week every single month. '
  + 'The vendor invoices are scattered across three inboxes and nobody owns reconciling them. '
  + 'We also never wrote down the onboarding process, so every new hire learns it by shadowing someone. '
  + 'Separately the regression suite is flaky and releases keep getting delayed because of it.';

test('plain text is accepted and tidied', () => {
  const r = extractDocumentText(enc.encode(REAL), 'problems.txt');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'text');
  assert.ok(r.text.includes('month-end close'));
});

test('a file too short to work from is refused, not passed through', () => {
  const r = extractDocumentText(enc.encode('fix stuff'), 'notes.txt');
  assert.equal(r.ok, false);
  assert.match(r.reason, /not enough text/i);
});

test('an empty or oversized file is refused with a reason', () => {
  assert.equal(extractDocumentText(new Uint8Array(0), 'x.txt').ok, false);
  const huge = new Uint8Array(5 * 1024 * 1024);
  const r = extractDocumentText(huge, 'big.txt');
  assert.equal(r.ok, false);
  assert.match(r.reason, /paste the relevant section/i);
});

// The guard that matters: a scanned PDF yields noise, and noise fed to the brief generator
// produces three confident projects that have nothing to do with the company.
test('a scanned-looking PDF is refused rather than guessed at', () => {
  const noise = new Uint8Array(3000);
  noise[0] = 0x25; noise[1] = 0x50; // %P
  for (let i = 2; i < noise.length; i++) noise[i] = (i * 37) % 256;
  const r = extractDocumentText(noise, 'scan.pdf');
  assert.equal(r.ok, false);
  assert.match(r.reason, /paste it instead/i);
});

test('text quality separates prose from bytes that merely decode', () => {
  assert.equal(textQuality(REAL).usable, true);
  assert.equal(textQuality('').usable, false);
  // Printable but wordless still fails — both halves of the check have to pass.
  assert.equal(textQuality('=-=-=-'.repeat(400)).usable, false);
});

test('tidy collapses whitespace without destroying paragraphs', () => {
  assert.equal(tidy('a  \r\n\r\n\r\n  b'), 'a\n\nb');
  assert.equal(tidy('  spaced   out  '), 'spaced out');
});

test('a corrupt archive reports rather than throwing', () => {
  const fake = new Uint8Array([0x50, 0x4B, 3, 4, 9, 9, 9, 9]);
  const r = extractDocumentText(fake, 'brief.docx');
  assert.equal(r.ok, false);
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
});

test('accepted text is capped and versioned', () => {
  const long = enc.encode(REAL.repeat(400));
  const r = extractDocumentText(long, 'long.txt');
  assert.equal(r.ok, true);
  assert.ok(r.text.length <= 40_000);
  assert.equal(r.version, DOC_PARSE_VERSION);
  assert.ok(MIN_USEFUL_CHARS > 0);
});
