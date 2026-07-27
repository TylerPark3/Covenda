// A company's own document, turned into draft opportunities.
//
// The reverse audit already accepted `documentText`, but nothing ever sent it — the UI only
// offered a URL, which quietly assumed a technical founder with public code. Dylan's point in
// the 26 July session is the right one: startups differ enormously, and the thing they can
// actually hand you is a planning doc, a retro, a list of what keeps slipping.
//
// The file is parsed HERE and never returns to the browser. A company planning document is
// confidential by default, so the round trip is upload → extract → audit → drafts. Only the
// drafts come back.

import { extractDocumentText, MAX_DOC_BYTES } from './doc-parse.js';
import { generateReverseAudit } from './project-intake.js';

export const config = { api: { bodyParser: false } };

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Cross-origin uploads are not allowed.' });

  // Reading the document requires a model; say so rather than failing opaquely.
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: 'Document reading is not configured on this deployment yet.' });
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_DOC_BYTES) {
        return res.status(413).json({ ok: false, error: `That file is over ${Math.round(MAX_DOC_BYTES / 1024 / 1024)}MB. Paste the relevant section instead.` });
      }
      chunks.push(chunk);
    }
  } catch {
    return res.status(400).json({ ok: false, error: 'Could not read that upload.' });
  }
  if (!size) return res.status(400).json({ ok: false, error: 'That file was empty.' });

  const filename = String(req.headers['x-covenda-filename'] || '').slice(0, 200);
  const extracted = extractDocumentText(Buffer.concat(chunks), filename);
  // A scanned PDF yields noise, and noise produces three confident proposals about a company
  // that does not exist. Refusing is the honest outcome.
  if (!extracted.ok) return res.status(422).json({ ok: false, error: extracted.reason });

  try {
    const audit = await generateReverseAudit({ documentText: extracted.text, env: process.env });
    // Same envelope as the link path so the client has one shape to render.
    return res.status(200).json({
      ok: true,
      audit,
      source: { kind: extracted.kind, chars: extracted.chars },
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: String(error?.message || 'Could not draft from that document.') });
  }
}
