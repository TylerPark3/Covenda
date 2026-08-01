// Direct-to-Blob uploads for recordings.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────
// Recordings used to be POSTed through a serverless function, which buffered the whole file
// in memory and capped at 30 MB. That is fine for a 60-second intro and hopeless for a
// 25-minute screen share, which routinely runs past 100 MB. The upload did not fail cleanly
// either: the connection was cut mid-body, so the browser reported "Failed to fetch" with no
// status and no server log, which is about the least diagnosable failure available.
//
// This issues a short-lived, single-pathname, PUT-only URL. The browser sends the file
// straight to Blob storage and the function never touches the bytes, so size stops mattering.
//
// ── WHY THE DELEGATION IS SO NARROW ───────────────────────────────────────────────────
// The URL is a bearer credential: whoever holds it can write. So it is scoped to exactly one
// pathname the client cannot choose, expires in ten minutes, carries its own size ceiling
// enforced by the storage layer rather than by us, and permits nothing but `put`.

import { signedUploadUrl } from './storage.js';

import { checkLimit, limitResponse, recordError } from './limits.js';
import { authorizeMember } from './portal.js';

export const MAX_BYTES = 400 * 1024 * 1024;   // a long screen share, with room to spare
export const TTL_SECONDS = 60 * 10;

const KINDS = {
  video: { prefix: 'video-intros', types: ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska'] },
  exercise: { prefix: 'exercise-recordings', types: ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska'] },
};

function extFor(contentType) {
  if (contentType === 'video/mp4') return 'mp4';
  if (contentType === 'video/quicktime') return 'mov';
  if (contentType === 'video/x-matroska') return 'mkv';
  return 'webm';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Cross-origin uploads are not allowed.' });

  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ ok: false, error: 'Sign in first.' });

  const limit = await checkLimit('upload-token', member.user.id);
  if (!limit.allowed) return limitResponse(res, limit, 'uploads');

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const kind = KINDS[body.kind] ? body.kind : 'video';
  const contentType = String(body.contentType || 'video/webm').split(';')[0].trim();
  // Request shape before deployment state: a malformed request gets its own error rather than
  // being told what this deployment does or does not have configured.
  if (!KINDS[kind].types.includes(contentType)) {
    return res.status(415).json({ ok: false, error: 'That is not a recording format we accept.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ ok: false, error: 'File storage is not configured on this deployment.' });
  }

  // The client never picks the path. It is derived from the caller's own id, so a token cannot
  // be aimed at somebody else's key.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pathname = `${KINDS[kind].prefix}/${member.user.id}/${stamp}.${extFor(contentType)}`;

  try {
    // One call now instead of delegate-then-sign. Worth stating what changed: the previous
    // provider let the token itself carry maximumSizeInBytes and allowedContentTypes, so the
    // storage service refused an oversized or wrong-typed upload. Supabase signed upload URLs
    // carry neither, so those two limits are no longer enforced at the storage boundary.
    //
    // They are still enforced here — the handler validates contentType against KINDS and the
    // client is told MAX_BYTES — but a caller who ignores the response could push a larger
    // object. Tracked in TODOS rather than left as a silent downgrade.
    const { uploadUrl, key } = await signedUploadUrl(pathname);
    return res.status(200).json({ ok: true, uploadUrl, pathname: key, expiresIn: TTL_SECONDS });
  } catch (error) {
    await recordError('upload-token', 'error', error?.message || 'unknown', { userId: member.user.id, detail: { kind } });
    return res.status(500).json({ ok: false, error: 'Could not start the upload. Try again, or paste a link.' });
  }
}
