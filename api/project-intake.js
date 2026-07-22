import { get } from '@vercel/blob';

import { authorizeMember, VERTICALS, WORK_TYPES } from './portal.js';

// AI-assisted project intake. One Anthropic Messages API call reads the company's
// problem description plus any attached PDFs/images (Claude reads PDFs natively) and
// returns a STRICT-JSON structured brief. The result is an assistive DRAFT only — it
// never approves anything; the founder consult finalizes scope. If the work crosses
// Covenda's safety boundary the brief sets safeToPost=false and the portal blocks it.

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are Covenda's project intake analyst. Covenda turns a company's delayed, low-risk work into a scoped, paid, student-completed project with a reviewable deliverable.

Read the company's description (and any attached files) and produce a structured, HONEST draft understanding. You are assistive only: a human founder reviews every project and a consultation finalizes scope. Never approve anything.

Covenda's hard safety boundary — the work is NOT safe to post if it involves any of:
- client, patient, or customer records, or any personal/identifying data (PII or PHI)
- access to production systems, live credentials, or internal restricted systems
- regulated or licensed decisions (legal, medical, or financial advice, etc.)
- confidential or proprietary material a student should not hold
If any of these are present or implied, set "safeToPost" to false and explain why in "safetyFlags". Covenda prefers public sources, de-identified examples, and approved copies.

Respond with ONLY a JSON object — no prose, no markdown, no code fences — matching exactly this shape:
{
  "summary": "2-3 sentence plain-language summary of the work",
  "structuredProblem": "a short structured brief: the context, the useful outcome, and what a good finish looks like",
  "candidateDeliverables": ["2 to 4 concrete, reviewable deliverables"],
  "suggestedVerticals": ["subset of the allowed verticals"],
  "suggestedWorkTypes": ["subset of the allowed work types"],
  "safetyFlags": ["any boundary concerns; use an empty array if none"],
  "safeToPost": true
}
Allowed verticals: ${[...VERTICALS].join('; ')}.
Allowed work types: ${[...WORK_TYPES].join('; ')}.
Use those exact strings. If you are unsure of a vertical, use "Not sure yet — show me everything".`;

export class IntakeConfigError extends Error {
  constructor(message) { super(message); this.name = 'IntakeConfigError'; }
}

function buildUserPrompt(problemText) {
  return `A company described work they hope to turn into a scoped, student-completed Covenda project:\n\n"""\n${problemText}\n"""\n\nReview the description and any attached files, then return ONLY the JSON object described in your instructions.`;
}

function extractJson(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through to brace slice */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* give up */ } }
  return null;
}

// Shape + sanitize the model output. Verticals/work types are filtered to the fixed
// taxonomy so they line up exactly with the student-matching fields. safeToPost is
// treated conservatively: only an explicit true allows posting.
export function normalizeBrief(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const str = (value, max) => (typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, max) : '');
  const list = (value, max) => (Array.isArray(value) ? value.map(item => str(item, 300)).filter(Boolean).slice(0, max) : []);
  const fromSet = (value, set, max) => (Array.isArray(value) ? value.map(item => str(item, 120)).filter(item => set.has(item)) : []).slice(0, max);
  return {
    summary: str(obj.summary, 1200),
    structuredProblem: str(obj.structuredProblem, 3000),
    candidateDeliverables: list(obj.candidateDeliverables, 5),
    suggestedVerticals: fromSet(obj.suggestedVerticals, VERTICALS, 6),
    suggestedWorkTypes: fromSet(obj.suggestedWorkTypes, WORK_TYPES, 5),
    safetyFlags: list(obj.safetyFlags, 8),
    safeToPost: obj.safeToPost === true,
  };
}

// Read a private blob's bytes server-side and base64-encode them. Sending the file
// content inline means the attachment never needs to be publicly reachable — Anthropic
// never fetches a URL, so private storage works and the company's files stay private.
const AI_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
async function defaultLoadBlob(attachment, env) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token || !attachment?.blobUrl) return null;
  const result = await get(attachment.blobUrl, { access: 'private', token });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const chunks = [];
  const reader = result.stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 16 * 1024 * 1024) return null; // guard against an unexpectedly huge file
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('base64');
}

export async function generateProjectBrief({ problemText, attachments = [], env = process.env, fetchImpl = fetch, loadBlob = defaultLoadBlob }) {
  const text = typeof problemText === 'string' ? problemText.trim() : '';
  if (text.length < 10) throw new Error('Describe the problem in a bit more detail first.');
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new IntakeConfigError('AI project understanding is not configured yet. Add ANTHROPIC_API_KEY in Vercel to enable it.');
  const content = [{ type: 'text', text: buildUserPrompt(text) }];
  for (const attachment of (Array.isArray(attachments) ? attachments : []).slice(0, 6)) {
    if (!attachment || !attachment.blobUrl) continue;
    const isPdf = attachment.contentType === 'application/pdf';
    const isImage = AI_IMAGE_TYPES.has(attachment.contentType || '');
    if (!isPdf && !isImage) continue; // Claude reads PDFs + images; other docs are stored but not analysed
    let base64;
    try { base64 = await loadBlob(attachment, env); } catch { base64 = null; }
    if (!base64) continue; // a file we can't read must not sink the whole brief — process the text
    content.push(isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: attachment.contentType, data: base64 } });
  }
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1600, system: SYSTEM_PROMPT, messages: [{ role: 'user', content }] }),
  });
  if (!response || !response.ok) throw new Error('The AI intake service could not be reached. Try again, or book the consult and describe it there.');
  const data = await response.json();
  const raw = (data?.content || []).filter(block => block && block.type === 'text').map(block => block.text).join('').trim();
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('The AI intake returned an unreadable response. Try again.');
  return normalizeBrief(parsed);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}
function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ ok: false, error: 'Member authentication is required.' });
  let body;
  try { body = parseBody(req); } catch { return res.status(400).json({ ok: false, error: 'Invalid request body.' }); }
  try {
    const brief = await generateProjectBrief({
      problemText: body.problemText,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      env: dependencies.env || process.env,
      fetchImpl: dependencies.fetchImpl || fetch,
    });
    return res.status(200).json({ ok: true, brief });
  } catch (error) {
    if (error instanceof IntakeConfigError) return res.status(503).json({ ok: false, code: 'INTAKE_NOT_CONFIGURED', error: error.message });
    const message = (error && error.message) || 'AI intake failed.';
    const expected = /^(Describe|The AI)/.test(message);
    return res.status(expected ? 400 : 502).json({ ok: false, error: message });
  }
}
