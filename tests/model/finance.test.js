import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import { unzip, parseXlsxFormulas, scoreModelAgainstDcfRubric, analyzeFinancialModel } from '../../api/xlsx-parse.js';
import { computeTrackRecordFeatures, modelClaim, trackRecordClaim } from '../../api/finance.js';

// Build a real (deflated) ZIP so the parser is exercised against genuine OOXML bytes, not a mock.
function makeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const uncomp = Buffer.from(content, 'utf8');
    const comp = deflateRawSync(uncomp);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 14); // method=deflate, crc=0 (parser ignores crc)
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(uncomp.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(8, 10); cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(uncomp.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const body = Buffer.concat(parts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, cdBuf, eocd]);
}

const DCF_SHEET = `<worksheet><sheetData>
  <row><c r="A1"><v>100</v></c><c r="B1"><f>A1*1.05</f><v>105</v></c></row>
  <row><c r="A2"><f>NPV(B5,B1:B4)</f><v>420</v></c><c r="A3"><f>IRR(B1:B4)</f><v>0.12</v></c></row>
  <row><c r="A4"><f>B1/(1+WACC)</f><v>95</v></c></row>
</sheetData></worksheet>`;
const SHARED = `<sst><si><t>WACC</t></si><si><t>Terminal value</t></si><si><t>Free cash flow</t></si></sst>`;

test('unzip reads OOXML parts from a real deflated archive', () => {
  const buf = makeZip({ 'xl/worksheets/sheet1.xml': DCF_SHEET, 'xl/sharedStrings.xml': SHARED });
  const files = unzip(buf);
  assert.ok(files['xl/worksheets/sheet1.xml'].toString('utf8').includes('NPV'));
});

test('parseXlsxFormulas finds linked formulas + DCF concepts + discounting', () => {
  const buf = makeZip({ 'xl/worksheets/sheet1.xml': DCF_SHEET, 'xl/sharedStrings.xml': SHARED });
  const parsed = parseXlsxFormulas(buf);
  assert.ok(parsed.formulaCount >= 4);
  assert.equal(parsed.hasDiscountingFormula, true);
  assert.ok(parsed.dcfTermsHit.includes('wacc'));
  assert.ok(parsed.formulaDensity > 0);
});

test('a formula-driven DCF scores well; a hardcoded model of pasted values scores low', () => {
  const good = analyzeFinancialModel(makeZip({ 'xl/worksheets/sheet1.xml': DCF_SHEET, 'xl/sharedStrings.xml': SHARED }));
  const hard = analyzeFinancialModel(makeZip({ 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1"><v>100</v></c><c r="A2"><v>200</v></c></row></sheetData></worksheet>' }));
  assert.ok(good.score > hard.score, `formula model (${good.score}) should beat hardcoded (${hard.score})`);
  assert.ok(hard.flags.some(f => /hardcoded/.test(f)), 'hardcoded model is flagged');
  assert.ok(good.reasons.some(r => /discounting/.test(r)));
});

test('a non-xlsx buffer fails with a friendly error, never a crash', () => {
  assert.throws(() => analyzeFinancialModel(Buffer.from('not a zip at all')), /not a valid \.xlsx/);
});

test('modelClaim carries an xlsx-connector evidence_meta at artifact tier', () => {
  const rubric = analyzeFinancialModel(makeZip({ 'xl/worksheets/sheet1.xml': DCF_SHEET, 'xl/sharedStrings.xml': SHARED }));
  const claim = modelClaim({ studentUserId: 'u1', rubric, evidencePointer: 'xlsx://valuation' });
  assert.equal(claim.verification_tier, 'artifact');
  assert.equal(claim.skill_canonical, 'Financial modeling');
  assert.equal(claim.evidence_meta.source_connector, 'xlsx_model');
  assert.equal(claim.evidence_meta.ownership_verified, false);
});

// ---- Alpaca track record (gated on terms; the extractor is pure + ready) -------------------

test('computeTrackRecordFeatures scores the timestamped RECORD, not returns', () => {
  const DAY = 86_400_000; const now = Date.UTC(2026, 5, 1);
  const orders = Array.from({ length: 20 }, (_, i) => ({
    filled_at: new Date(now - (60 - i * 3) * DAY).toISOString(),
    side: i % 2 ? 'sell' : 'buy', symbol: 'AAPL', filled_avg_price: 100 + i, qty: 1,
  }));
  const f = computeTrackRecordFeatures(orders, { now });
  assert.equal(f.trades, 20);
  assert.ok(f.span_days >= 40);
  assert.equal(f.forensics.anomaly, false); // spread over months → not a backfill
  const claim = trackRecordClaim({ studentUserId: 'u1', features: f });
  assert.equal(claim.evidence_meta.source_connector, 'alpaca_track_record');
  assert.equal(claim.evidence_meta.ownership_verified, true);
});

test('a same-day burst of trades is flagged by the shared forensics (cannot fake history)', () => {
  const now = Date.UTC(2026, 5, 1);
  const orders = Array.from({ length: 10 }, (_, i) => ({ filled_at: new Date(now - i * 60_000).toISOString(), side: 'buy', symbol: 'X', filled_avg_price: 10, qty: 1 }));
  const f = computeTrackRecordFeatures(orders, { now });
  assert.equal(f.forensics.anomaly, true);
});
