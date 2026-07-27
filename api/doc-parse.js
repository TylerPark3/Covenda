// Turning a company's own document into project drafts.
//
// "Not sure where to start?" only accepted a URL — a repo, Figma, or product page. That
// suits a technical founder with public code and nobody else. Most companies already have
// the answer written down: a planning doc, a list of things that keep slipping, notes from a
// retro. This reads that instead.
//
// Dependency-free by reusing the OOXML unzip already written for .xlsx parsing. A .docx is
// the same container format, so the same code opens it.
//
// ── ON PDF ────────────────────────────────────────────────────────────────────────────
// PDFs are extracted best-effort and then CHECKED. A text-layer PDF gives clean text; a
// scanned one gives noise. Feeding noise to the brief generator produces confident nonsense
// — three plausible projects that have nothing to do with the company — which is worse than
// refusing. So extraction runs, quality is measured, and a poor result asks the user to paste
// instead of pretending it worked.

import { unzip } from './xlsx-parse.js';

export const DOC_PARSE_VERSION = 'doc-parse-1.0.0';
export const MAX_DOC_BYTES = 4 * 1024 * 1024;
export const MIN_USEFUL_CHARS = 120;

const decoder = new TextDecoder('utf-8', { fatal: false });

function stripXmlTags(xml) {
  return xml
    // Paragraph and line breaks become real newlines before tags are stripped, or the whole
    // document collapses into one unreadable line.
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

export function tidy(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(line => line.trim()).join('\n')
    .trim();
}

// Is this actually readable prose, or bytes that happen to decode? Guards the PDF path.
export function textQuality(text) {
  const sample = String(text || '').slice(0, 4000);
  if (!sample) return { ratio: 0, usable: false };
  const printable = sample.replace(/[^\x20-\x7E\n\t -ɏ]/g, '').length;
  const words = (sample.match(/[A-Za-z]{3,}/g) || []).length;
  const ratio = printable / sample.length;
  // Both tests matter: bytes can be printable and still not be words.
  return { ratio: Math.round(ratio * 100) / 100, words, usable: ratio > 0.85 && words > 25 };
}

export function parseDocx(buffer) {
  const files = unzip(buffer);
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('That .docx could not be read — it may be corrupt or password-protected.');
  return tidy(stripXmlTags(decoder.decode(doc)));
}

// Best-effort PDF text. Pulls text-showing operators out of any stream we can inflate.
// Deliberately simple: this is a triage step, and textQuality() decides whether to trust it.
export function parsePdf(buffer) {
  const raw = decoder.decode(buffer);
  const chunks = [];
  // Text between BT/ET blocks, in ( ) or < > show operators.
  for (const m of raw.matchAll(/BT([\s\S]*?)ET/g)) {
    for (const t of m[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      chunks.push(t[0].slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\[rn]/g, ' '));
    }
  }
  return tidy(chunks.join(' '));
}

// One entry point. Returns text plus an honest verdict about whether it is usable.
export function extractDocumentText(buffer, filename = '') {
  if (!buffer || !buffer.length) return { ok: false, reason: 'That file was empty.' };
  if (buffer.length > MAX_DOC_BYTES) {
    return { ok: false, reason: `That file is over ${Math.round(MAX_DOC_BYTES / 1024 / 1024)}MB. Paste the relevant section instead.` };
  }
  const name = String(filename || '').toLowerCase();
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;               // PK
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50;               // %P

  let text = '';
  let kind = 'text';
  try {
    if (isZip || name.endsWith('.docx')) { text = parseDocx(buffer); kind = 'docx'; }
    else if (isPdf || name.endsWith('.pdf')) { text = parsePdf(buffer); kind = 'pdf'; }
    else { text = tidy(decoder.decode(buffer)); kind = 'text'; }
  } catch (error) {
    return { ok: false, reason: String(error?.message || 'That file could not be read.') };
  }

  if (text.length < MIN_USEFUL_CHARS) {
    return {
      ok: false, kind,
      reason: kind === 'pdf'
        ? 'No readable text came out of that PDF — it is probably a scan. Copy the text and paste it instead.'
        : 'There was not enough text in that file to work from.',
    };
  }
  const quality = textQuality(text);
  if (kind === 'pdf' && !quality.usable) {
    // Refusing beats guessing: noise in produces three confident, wrong projects.
    return {
      ok: false, kind, quality,
      reason: 'That PDF did not extract cleanly — it is likely scanned or image-based. Copy the text and paste it instead.',
    };
  }
  return { ok: true, kind, text: text.slice(0, 40_000), chars: text.length, quality, version: DOC_PARSE_VERSION };
}
