import { put } from '@vercel/blob';

import { authorizeMember } from './portal.js';

// Authenticated project-file upload for company/university intake. Receives one file as
// the raw request body and stores it in Vercel Blob, returning { name, blobUrl,
// contentType, sizeBytes } which the portal writes into member_projects.attachments.
// NOTE: like the video-intro upload, Vercel Blob URLs are public-but-unguessable rather
// than access-controlled; the portal API is what keeps them private, only ever returning
// an attachment URL to the project owner or the assigned student. Revisit before a broad
// launch (signed URLs / true private storage).

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 15 * 1024 * 1024; // ~15 MB ceiling per attachment
const ALLOWED = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const EXTENSIONS = {
  'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'text/plain': 'txt', 'text/csv': 'csv', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export function validateUpload(contentType, size) {
  if (!ALLOWED.has(contentType)) return { ok: false, status: 415, error: 'Unsupported file type. Upload a PDF, document, spreadsheet, or image.' };
  if (!size) return { ok: false, status: 400, error: 'The file is empty.' };
  if (size > MAX_BYTES) return { ok: false, status: 413, error: 'File is too large. Keep each attachment under 15 MB.' };
  return { ok: true };
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

function safeName(value) {
  return String(value || 'file').replace(/[^\w.\- ]+/g, '').trim().slice(0, 120) || 'file';
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin uploads are not allowed.' });

  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ error: 'Member authentication is required.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'File storage is not configured yet. Add BLOB_READ_WRITE_TOKEN in Vercel.' });

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  const declaredName = safeName(req.headers['x-file-name']);
  if (!ALLOWED.has(contentType)) return res.status(415).json({ error: 'Unsupported file type. Upload a PDF, document, spreadsheet, or image.' });

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) return res.status(413).json({ error: 'File is too large. Keep each attachment under 15 MB.' });
      chunks.push(chunk);
    }
  } catch { return res.status(400).json({ error: 'Could not read the uploaded file.' }); }

  const check = validateUpload(contentType, size);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  try {
    const ext = EXTENSIONS[contentType] || 'bin';
    const blob = await put(`project-files/${member.user.id}/attachment.${ext}`, Buffer.concat(chunks), {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ name: declaredName, blobUrl: blob.url, contentType, sizeBytes: size });
  } catch {
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}
