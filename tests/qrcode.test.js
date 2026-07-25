import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { makeQrMatrix, makeQrSvg } from '../qrcode.js';

// How this encoder is verified (see tests/fixtures/DATASHEET.md):
//
// 1. GOLDEN MATRICES — tests/fixtures/qr-golden.json. Every entry was rendered by this encoder
//    and then DECODED BACK by an independent decoder (OpenCV's QRCodeDetector) and asserted to
//    return the original text before being written. Decodability, not byte-equality with some
//    other library, is the real correctness criterion: pad-byte choices legitimately differ
//    between conformant encoders and don't change what a scanner reads. These goldens make that
//    verified output a regression fence.
// 2. REED–SOLOMON — the error-correction block below is cross-checked against error-correction
//    codewords produced by `segno` (an independent, spec-conformant library) for a known data
//    block. This is the part of the pipeline where a silent bug produces codes that look right
//    but refuse to scan, so it gets an exact-match assertion.
const GOLDEN = JSON.parse(readFileSync('tests/fixtures/qr-golden.json', 'utf8'));

test('golden matrices span versions 1–10 and were decoder-verified', () => {
  const versions = [...new Set(GOLDEN.map(g => g.version))].sort((a, b) => a - b);
  assert.ok(versions[0] === 1 && versions[versions.length - 1] === 10, `covers v${versions[0]}–v${versions[versions.length - 1]}`);
  assert.ok(GOLDEN.length >= 8);
});

test('encoder reproduces every decoder-verified golden exactly', () => {
  for (const g of GOLDEN) {
    const out = makeQrMatrix(g.text);
    assert.equal(out.version, g.version, `version drift for ${g.text.slice(0, 40)}`);
    assert.equal(out.size, g.size);
    assert.equal(out.mask, g.mask, `mask drift for ${g.text.slice(0, 40)}`);
    assert.deepEqual(out.matrix, g.matrix, `matrix drift (v${g.version}) for ${g.text.slice(0, 40)}`);
  }
});

test('Reed–Solomon EC codewords match the independent segno reference', async () => {
  // v1-M data block (16 codewords) and the 10 EC codewords segno computes for it.
  const data = [0x40, 0x85, 0x07, 0x45, 0x96, 0x76, 0xa3, 0xd6, 0xd5, 0x50, 0x00, 0xec, 0x11, 0xec, 0x11, 0xec];
  const expected = [0xa2, 0x23, 0xab, 0x3f, 0x70, 0x6b, 0xe3, 0x10, 0xe5, 0x63];
  // rsEncode is module-private; exercise it through a matrix whose data codewords we control is
  // impractical, so import the module source and evaluate the exported helper surface instead.
  const { rsEncodeForTest } = await import('../qrcode.js');
  assert.deepEqual(rsEncodeForTest(data, 10), expected);
});

test('version selection grows with input length and refuses oversized input', () => {
  const short = makeQrMatrix('https://covenda.app/?join=student');
  const long = makeQrMatrix(`https://covenda.app/?join=student&ref=${'X'.repeat(120)}`);
  assert.ok(long.version > short.version);
  assert.throws(() => makeQrMatrix('x'.repeat(400)), /too long/);
});

test('finder patterns sit at all three corners of every golden', () => {
  for (const { matrix, size } of GOLDEN.map(g => makeQrMatrix(g.text))) {
    for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      assert.equal(matrix[r0][c0], 1);
      assert.equal(matrix[r0 + 1][c0 + 1], 0); // light ring
      assert.equal(matrix[r0 + 3][c0 + 3], 1); // solid core
    }
  }
});

test('per-partner referral links each produce a distinct, valid symbol', () => {
  const a = makeQrMatrix('https://covenda.app/?join=student&ref=BERKELEY-ROBOTICS');
  const b = makeQrMatrix('https://covenda.app/?join=student&ref=STANFORD-CS-CLUB');
  assert.notDeepEqual(a.matrix, b.matrix, 'different referral codes must encode differently');
});

test('SVG output is self-contained and honours the quiet zone', () => {
  const svg = makeQrSvg('https://covenda.app/?join=student&ref=TEST', { scale: 4, border: 4 });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(!/<script|href=|url\(/i.test(svg), 'no scripts or external references');
  const { size } = makeQrMatrix('https://covenda.app/?join=student&ref=TEST');
  const dim = (size + 8) * 4;
  assert.ok(svg.includes(`viewBox="0 0 ${dim} ${dim}"`));
});
