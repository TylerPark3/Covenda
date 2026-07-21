import { put } from '@vercel/blob';

// Optional student video-intro upload. Receives a recorded clip (webm/mp4) as the
// raw request body and stores it in Vercel Blob, returning an unguessable URL that
// is saved as links.videoIntro. Requires BLOB_READ_WRITE_TOKEN; if it is not set the
// endpoint reports "not configured" and the client keeps the paste-a-link path.
// NOTE: Vercel Blob URLs are public-but-unguessable, not access-controlled. That is
// acceptable for a founder-led pilot intro; revisit before any broad launch.

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 30 * 1024 * 1024; // ~30 MB ceiling for a ~1 minute clip

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Cross-origin uploads are not allowed.' });
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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
    const blob = await put(`video-intros/intro.${ext}`, Buffer.concat(chunks), {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    res.status(200).json({ url: blob.url });
  } catch {
    res.status(500).json({ error: 'Upload failed. Please try again, or paste a link.' });
  }
}
