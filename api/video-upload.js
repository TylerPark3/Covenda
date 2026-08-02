import { putObject, storageConfigured } from './storage.js';

// Optional student video-intro upload. Receives a recorded clip (webm/mp4) as the
// raw request body and stores it in the private object store. The returned storage key is
// saved as links.videoIntro and is only turned into a short-lived URL after authorization.

export const config = { api: { bodyParser: false } };

// Raised from 30 MB. This is the FALLBACK path now, used when the direct-to-Blob presign
// fails, so it has to cover a real screen share rather than only a short camera take.
// Vercel functions accept request bodies up to 100 MB.
const MAX_BYTES = 95 * 1024 * 1024;

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req, res, dependencies = {}) {
  const env = dependencies.env || process.env;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Cross-origin uploads are not allowed.' });
    return;
  }
  if (!storageConfigured(env)) {
    res.status(503).json({ error: 'Video recording storage is not configured yet. Paste a video link instead.' });
    return;
  }

  const contentType = (req.headers['content-type'] || 'video/webm').split(';')[0].trim();
  if (!/^video\/(webm|mp4|quicktime|x-matroska)$/.test(contentType)) {
    res.status(415).json({ error: 'Unsupported recording format.' });
    return;
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) {
        res.status(413).json({ error: 'Recording is too large. Keep it under a minute.' });
        return;
      }
      chunks.push(chunk);
    }
  } catch {
    res.status(400).json({ error: 'Could not read the recording.' });
    return;
  }
  if (!size) {
    res.status(400).json({ error: 'Empty recording.' });
    return;
  }

  const ext = contentType === 'video/mp4' ? 'mp4' : contentType === 'video/quicktime' ? 'mov' : 'webm';
  try {
    // Unique key built here rather than relying on addRandomSuffix, whose behaviour has
    // changed across storage providers.
    const key = `video-intros/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const blob = await putObject(key, Buffer.concat(chunks), { contentType, env });
    res.status(200).json({ url: blob.url });
  } catch (error) {
    // A bare catch made every failure identical and undebuggable. The real reason goes to
    // the logs, and a usable version goes to the student.
    console.error(JSON.stringify({ level: 'error', message: 'Video upload failed', error: String(error?.message || error) }));
    res.status(500).json({ error: `Upload failed: ${String(error?.message || 'unknown error')}. Paste a link instead if this keeps happening.` });
  }
}
