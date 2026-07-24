import { inflateRawSync } from 'node:zlib';

// Minimal, SERVER-ONLY .xlsx reader + DCF-rubric scorer (Proof Connector Framework, finance).
//
// An .xlsx file is an OOXML package — a ZIP of XML parts. Rather than add an npm dependency, we
// read the ZIP central directory and inflate the sheet parts with Node's built-in zlib, then
// score FORMULA INTEGRITY (real linked formulas vs hardcoded numbers) and DCF STRUCTURE against
// a rubric. This deliberately parses formulas, not just values — a model of pasted numbers with
// no formulas is exactly the thing this is meant to catch.
//
// This is intentionally small and defensive: any malformed input throws a friendly error rather
// than crashing, and nothing here executes workbook content — it only reads XML text.

const EOCD_SIG = 0x06054b50;
const CDIR_SIG = 0x02014b50;

// Read a ZIP archive into { filename: Buffer } via the central directory (accurate sizes/offsets).
export function unzip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  // Locate End Of Central Directory by scanning backwards (comment is usually empty).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65_536; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('That file is not a valid .xlsx workbook.');
  const entryCount = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16); // start of central directory
  const files = {};
  for (let n = 0; n < entryCount; n += 1) {
    if (buf.readUInt32LE(ptr) !== CDIR_SIG) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    // Jump to the local header to find where the compressed data actually starts.
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    try {
      files[name] = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
    } catch { /* skip an entry we can't inflate rather than failing the whole parse */ }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const DCF_TERMS = ['wacc', 'discount', 'terminal', 'npv', 'irr', 'free cash flow', 'fcf', 'ebitda', 'perpetuity', 'growth rate', 'cost of capital'];
const DISCOUNT_FNS = /\b(NPV|XNPV|IRR|XIRR|PV|FV)\s*\(/i;

// Extract formulas + a structural summary from a workbook buffer.
export function parseXlsxFormulas(buffer) {
  const files = unzip(buffer);
  const sheetNames = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n));
  if (!sheetNames.length) throw new Error('That workbook has no worksheets to analyze.');
  const sharedStrings = files['xl/sharedStrings.xml'] ? files['xl/sharedStrings.xml'].toString('utf8').toLowerCase() : '';

  let cellCount = 0, formulaCount = 0, discountFormulaCount = 0;
  const formulas = [];
  for (const name of sheetNames) {
    const xml = files[name].toString('utf8');
    // Count value cells (<c ...>) and formula cells (<f>...</f>).
    cellCount += (xml.match(/<c[\s>]/g) || []).length;
    const fMatches = xml.match(/<f[^>]*>([^<]*)<\/f>/g) || [];
    formulaCount += fMatches.length;
    for (const f of fMatches) {
      const body = f.replace(/<\/?f[^>]*>/g, '');
      if (DISCOUNT_FNS.test(body)) discountFormulaCount += 1;
      if (formulas.length < 50) formulas.push(body);
    }
  }
  const haystack = (sharedStrings + ' ' + formulas.join(' ')).toLowerCase();
  const dcfTermsHit = DCF_TERMS.filter(t => haystack.includes(t));
  return {
    sheets: sheetNames.length,
    cellCount,
    formulaCount,
    discountFormulaCount,
    formulaDensity: cellCount ? Math.round((formulaCount / cellCount) * 100) / 100 : 0,
    dcfTermsHit,
    hasDiscountingFormula: discountFormulaCount > 0,
  };
}

// Score a parsed model against a DCF rubric (0–10, anchored to hardening.js 'Financial modeling'
// anchors). Rewards LINKED formulas + real discounting + DCF structure; a hardcoded model of
// pasted numbers scores low by construction. Returns { score, band, reasons, flags }.
export function scoreModelAgainstDcfRubric(parsed) {
  const reasons = [];
  const flags = [];
  let score = 2; // a valid, openable workbook floor

  if (parsed.formulaDensity >= 0.3) { score += 2.5; reasons.push(`Formula-driven: ${Math.round(parsed.formulaDensity * 100)}% of cells are live formulas`); }
  else if (parsed.formulaDensity > 0) { score += 1; reasons.push('Some live formulas present'); }
  else { flags.push('No formulas found — the model appears to be hardcoded values, not a live model'); }

  if (parsed.hasDiscountingFormula) { score += 2.5; reasons.push(`Uses discounting functions (${parsed.discountFormulaCount} NPV/IRR/PV formula${parsed.discountFormulaCount > 1 ? 's' : ''})`); }
  else flags.push('No NPV/IRR/PV discounting formula detected');

  const termScore = Math.min(2, parsed.dcfTermsHit.length * 0.4);
  if (termScore > 0) { score += termScore; reasons.push(`DCF concepts present: ${parsed.dcfTermsHit.slice(0, 5).join(', ')}`); }

  if (parsed.sheets >= 2) { score += 1; reasons.push(`Structured across ${parsed.sheets} sheets`); }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  return { score, reasons, flags, parsed };
}

// One call: buffer → rubric result. Throws a friendly error on malformed input.
export function analyzeFinancialModel(buffer) {
  return scoreModelAgainstDcfRubric(parseXlsxFormulas(buffer));
}
