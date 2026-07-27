// Route for `resume-questions.js`. The engine was built and never wired, so a student attached
// a résumé and nothing happened with it.
//
// ── WHAT THIS IS FOR ──────────────────────────────────────────────────────────────────
// Every other question in the application is the same for everyone in the batch. That is fine
// for concepts, and useless for authorship: a shared question can be prepared once and reused
// by anyone. A question drawn from THIS person's history cannot be.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────
// It does not store the résumé text, and it does not score anything. It returns questions for
// a human to ask. `stripProxies` runs on the model's output because a model told not to probe
// prestige still occasionally does, and a résumé is dense with the temptation.

import { checkLimit, limitResponse, recordError } from './limits.js';
import { authorizeMember } from './portal.js';
import { questionsFromResume } from './resume-questions.js';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

async function readBody(req, limit) {
  if (Buffer.isBuffer(req.body)) return req.body.length > limit ? null : req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Cross-origin requests are not allowed.' });

  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ ok: false, error: 'Sign in first.' });

  // This route calls the Anthropic API on every upload, so the cap is about cost, not abuse.
  const limit = await checkLimit('resume-interview', member.user.id);
  if (!limit.allowed) return limitResponse(res, limit, 'résumés');

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!ALLOWED.has(contentType)) {
    return res.status(415).json({ ok: false, error: 'Upload a PDF, Word document, or plain text résumé.' });
  }

  const body = await readBody(req, MAX_BYTES).catch(() => null);
  if (!body || !body.length) return res.status(400).json({ ok: false, error: 'Could not read that file.' });

  const filename = decodeURIComponent(String(req.headers['x-file-name'] || 'resume'));
  const vertical = String(req.headers['x-vertical'] || '').slice(0, 80) || null;

  try {
    const result = await questionsFromResume({ buffer: body, filename, vertical });
    // A failure here is never fatal to the application. The published technical questions
    // still apply, so the student is told that rather than shown an error they cannot act on.
    if (!result.ok) return res.status(200).json({ ok: false, fallback: true, reason: result.reason });
    return res.status(200).json({ ok: true, questions: result.questions, note: result.note, droppedCount: (result.dropped || []).length });
  } catch (error) {
    await recordError('resume-interview', 'error', error?.message || 'unknown', { userId: member.user.id, detail: { vertical } });
    return res.status(200).json({ ok: false, fallback: true, reason: 'Could not read that résumé. The published questions still apply.' });
  }
}
