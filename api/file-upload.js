// Uploading the actual work.
//
// Deliverables accepted links only, which quietly assumed the work lived somewhere shareable.
// Tyler's point on 26 July: a deliverable is a video, a CSV, a spreadsheet, a slide deck, a
// zip of code — and telling a student to go host it first is where submissions get lost.
//
// Deliberately NOT a general-purpose file store. It accepts the formats real deliverables
// come in, caps them, and returns an unguessable URL. Anything else is refused rather than
// silently accepted and then unopenable.

import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 50 * 1024 * 1024;

// What work actually arrives as. Kept explicit — a permissive allowlist here is how a file
// store becomes a malware host.
const ALLOWED = new Map([
  ['application/pdf', 'pdf'],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
  ['application/json', 'json'],
  ['application/zip', 'zip'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['video/webm', 'webm'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
]);

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

// Never trust the client's filename into a path. Strip everything but a safe stem.
function safeName(raw, ext) {
  const base = String(raw || 'deliverable').split(/[\\/]/).pop() || 'deliverable';
  const stem = base.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 60) || 'deliverable';
  return `${stem}.${ext}`;
}

// The Blob store's access mode is a deployment setting, not something this code should
// assume. Asking for `public` on a private store throws outright — which is exactly how the
// video recorder broke — so try the configured default and fall back rather than hardcoding.
//
// Consequence worth knowing: on a private store the returned URL is not publicly fetchable,
// so a reviewer needs a signed URL to watch a recording. That is stricter than the previous
// public-but-unguessable posture and better for student privacy, but it means playback has
// to go through a signing step.
async function putEither(key, body, contentType) {
  try {
    return await put(key, body, { access: 'public', contentType });
  } catch (error) {
    if (!/private access|public access/i.test(String(error?.message || ''))) throw error;
    return put(key, body, { access: 'private', contentType });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Cross-origin uploads are not allowed.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ ok: false, error: 'File storage is not configured yet. Paste a link instead.' });
  }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = ALLOWED.get(contentType);
  if (!ext) {
    return res.status(415).json({
      ok: false,
      error: 'That file type is not supported. Documents, spreadsheets, slides, CSV, images, video, or a zip of code.',
    });
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) {
        return res.status(413).json({ ok: false, error: `Files are capped at ${MAX_BYTES / 1024 / 1024}MB. Link to anything larger.` });
      }
      chunks.push(chunk);
    }
  } catch {
    return res.status(400).json({ ok: false, error: 'Could not read that upload.' });
  }
  if (!size) return res.status(400).json({ ok: false, error: 'That file was empty.' });

  const name = safeName(req.headers['x-covenda-filename'], ext);
  try {
    // Unique key built here rather than relying on addRandomSuffix.
    const key = `deliverables/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`;
    const blob = await putEither(key, Buffer.concat(chunks), contentType);
    return res.status(200).json({ ok: true, url: blob.url, name, contentType, sizeBytes: size });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'File upload failed', error: String(error?.message || error) }));
    return res.status(502).json({ ok: false, error: `That upload did not go through: ${String(error?.message || 'unknown error')}` });
  }
}
