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

const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

// Two upload kinds share this endpoint because auth, validation, and the Blob write are
// identical — only the accepted types, size ceiling, and key prefix differ.
export function uploadPolicy(kind) {
  return kind === 'avatar'
    ? { allowed: AVATAR_TYPES, maxBytes: AVATAR_MAX_BYTES, prefix: 'avatars', basename: 'avatar' }
    : { allowed: ALLOWED, maxBytes: MAX_BYTES, prefix: 'project-files', basename: 'attachment' };
}

export function validateUpload(contentType, size, kind = 'project') {
  const policy = uploadPolicy(kind);
  if (!policy.allowed.has(contentType)) {
    return { ok: false, status: 415, error: kind === 'avatar' ? 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.' : 'Unsupported file type. Upload a PDF, document, spreadsheet, or image.' };
  }
  if (!size) return { ok: false, status: 400, error: 'The file is empty.' };
  if (size > policy.maxBytes) {
    return { ok: false, status: 413, error: kind === 'avatar' ? 'Image is too large. Keep it under 5 MB.' : 'File is too large. Keep each attachment under 15 MB.' };
  }
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

  const kind = req.headers['x-upload-kind'] === 'avatar' ? 'avatar' : 'project';
  const policy = uploadPolicy(kind);
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  const declaredName = safeName(req.headers['x-file-name']);
  const typeCheck = validateUpload(contentType, 1, kind);
  if (!typeCheck.ok && typeCheck.status === 415) return res.status(415).json({ error: typeCheck.error });

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > policy.maxBytes) return res.status(413).json({ error: validateUpload(contentType, policy.maxBytes + 1, kind).error });
      chunks.push(chunk);
    }
  } catch { return res.status(400).json({ error: 'Could not read the uploaded file.' }); }

  const check = validateUpload(contentType, size, kind);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  try {
    const ext = EXTENSIONS[contentType] || 'bin';
    const blob = await put(`${policy.prefix}/${member.user.id}/${policy.basename}.${ext}`, Buffer.concat(chunks), {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ name: declaredName, blobUrl: blob.url, contentType, sizeBytes: size });
  } catch {
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}
