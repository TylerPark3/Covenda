import { get } from '@vercel/blob';
import { normaliseDiagnosis, diagnosisGaps, evaluateBrief, BRIEF_ENGINE_VERSION } from './brief-engine.js';

import { authorizeMember, creditBalance, VERTICALS, WORK_TYPES } from './portal.js';

// AI-brief metering. Off by default so it can't block the pilot funnel before companies hold
// credits; when COVENDA_BRIEF_METERING_ENABLED=true, each successful generation costs `fee`
// credits and the caller must have the balance. Fee is one configurable constant (default 5).
export function briefFeeConfig(env = process.env) {
  return {
    enabled: env.COVENDA_BRIEF_METERING_ENABLED === 'true',
    fee: Math.max(0, Math.round(Number(env.COVENDA_BRIEF_FEE) || 5)),
  };
}

// AI-assisted project intake. One Anthropic Messages API call reads the company's
// problem description plus any attached PDFs/images (Claude reads PDFs natively) and
// returns a STRICT-JSON structured brief. The result is an assistive DRAFT only — it
// never approves anything; the founder consult finalizes scope. If the work crosses
// Covenda's safety boundary the brief sets safeToPost=false and the portal blocks it.

const MODEL = 'claude-opus-4-8';

// Structured Outputs schema: the model is constrained to return exactly this shape, so we no
// longer parse loose text / recover braces. additionalProperties:false + every field required
// standardizes every project document. Taxonomy fields are enum-locked to the student-matching
// strings. Deliverables are titled cards with acceptance criteria (BCG-style, terse).
const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'context', 'objective', 'scopeInclusions', 'scopeExclusions', 'candidateDeliverables', 'approvedInputs', 'suggestedVerticals', 'suggestedWorkTypes', 'estimatedEffort', 'opportunityType', 'complexityRating', 'ambiguityRating', 'durationWeeks', 'hoursPerWeek', 'founderTimeMinWeek', 'followUpQuestions', 'safetyFlags', 'safeToPost'],
  properties: {
    title: { type: 'string', description: 'A short, specific project title (max ~8 words).' },
    summary: { type: 'string', description: '2-3 sentence plain-language summary of the work.' },
    context: { type: 'string', description: 'Why this work matters / the situation, in 1-2 sentences.' },
    objective: { type: 'string', description: 'The single useful outcome, in one sentence.' },
    scopeInclusions: { type: 'array', items: { type: 'string' }, description: 'Terse bullets: what IS in scope.' },
    scopeExclusions: { type: 'array', items: { type: 'string' }, description: 'Terse bullets: what is explicitly OUT of scope.' },
    candidateDeliverables: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'acceptanceCriteria'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string', description: 'How a reviewer decides it is done and correct.' },
        },
      },
      description: '2 to 4 concrete, reviewable deliverables.',
    },
    approvedInputs: { type: 'array', items: { type: 'string' }, description: 'The public / de-identified / approved inputs a student may use.' },
    suggestedVerticals: { type: 'array', items: { type: 'string', enum: [...VERTICALS] } },
    suggestedWorkTypes: { type: 'array', items: { type: 'string', enum: [...WORK_TYPES] } },
    estimatedEffort: { type: 'string', description: 'A rough effort estimate, e.g. "~15-25 hours".' },
    // Project Engine (Stage 1): the structured-opportunity fields.
    opportunityType: { type: 'string', enum: ['project', 'internship', 'part_time', 'research'], description: 'The engagement shape this work fits best. Default to "project" (a bounded work-trial) unless the description clearly implies otherwise.' },
    complexityRating: { type: 'integer', enum: [1, 2, 3, 4, 5], description: 'Technical/skill complexity of the work, 1 (simple) to 5 (hard).' },
    ambiguityRating: { type: 'integer', enum: [1, 2, 3, 4, 5], description: 'How ambiguous the scope is as described, 1 (fully specified) to 5 (open-ended).' },
    durationWeeks: { type: 'integer', description: 'Suggested project length in weeks (bounded; 2-6 is typical).' },
    hoursPerWeek: { type: 'integer', description: 'Suggested student hours per week.' },
    founderTimeMinWeek: { type: 'integer', description: 'Minutes per week the founder should budget for reviews and checkpoints. Typically 30-60. Be honest — never zero.' },
    followUpQuestions: { type: 'array', items: { type: 'string' }, description: 'Up to 3 EXTRACTIVE follow-up questions that mine what the company already said for missing specifics (e.g. "You mention a pricing sheet — which competitors does it cover today?"). NEVER advisory; never prescribe strategy.' },
    safetyFlags: { type: 'array', items: { type: 'string' }, description: 'Boundary concerns to confirm at the consult; empty if none.' },
    safeToPost: { type: 'boolean' },
  },
};

const SYSTEM_PROMPT = `You are Covenda's project intake analyst. Covenda turns a company's delayed, low-risk work into a scoped, paid, student-completed project with a reviewable deliverable.

Read the company's description (and any attached files) and produce a structured, HONEST, BCG-grade draft understanding. Be terse and concrete: short bullets, no filler, no invented facts. You are assistive only — a human founder reviews every project and a consultation finalizes scope. Never approve anything, and never fabricate context, numbers, or requirements that were not stated.

Covenda's hard safety boundary — the work is NOT safe to post if it involves any of:
- client, patient, or customer records, or any personal/identifying data (PII or PHI)
- access to production systems, live credentials, or internal restricted systems
- regulated or licensed decisions (legal, medical, or financial advice, etc.)
- confidential or proprietary material a student should not hold
If any of these are present or implied, set safeToPost to false and explain why in safetyFlags. Covenda prefers public sources, de-identified examples, and approved copies — put those in approvedInputs.

For suggestedVerticals use only: ${[...VERTICALS].join('; ')}. For suggestedWorkTypes use only: ${[...WORK_TYPES].join('; ')}. Use those exact strings; if unsure of a vertical, use "Not sure yet — show me everything".

Also emit the structured-opportunity fields: the engagement type (default "project" — a bounded work-trial), complexity and ambiguity ratings (1-5, from what was actually described), a bounded durationWeeks and hoursPerWeek, and founderTimeMinWeek — an HONEST minutes-per-week estimate of the founder's own review time (typically 30-60; never 0, never inflated). Follow-up questions must be EXTRACTIVE ONLY: mine the company's own words for missing specifics; never give advice, never prescribe strategy or priorities.`;

export class IntakeConfigError extends Error {
  constructor(message) { super(message); this.name = 'IntakeConfigError'; }
}

function buildUserPrompt(problemText) {
  return `A company described work they hope to turn into a scoped, student-completed Covenda project:\n\n"""\n${problemText}\n"""\n\nReview the description and any attached files, then return ONLY the JSON object described in your instructions.`;
}

// With Structured Outputs the model returns valid JSON, so this is a strict parse with a
// single brace-slice as a last resort for the (rare) non-structured fallback path.
function parseBriefJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* give up */ } }
  return null;
}

// Shape + sanitize the model output. Verticals/work types are filtered to the fixed
// taxonomy so they line up exactly with the student-matching fields. safeToPost is
// treated conservatively: only an explicit true allows posting. Deliverables tolerate both
// the object shape and a bare string (older responses / fallback).
export function normalizeBrief(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const str = (value, max) => (typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, max) : '');
  const list = (value, max) => (Array.isArray(value) ? value.map(item => str(item, 400)).filter(Boolean).slice(0, max) : []);
  const fromSet = (value, set, max) => (Array.isArray(value) ? value.map(item => str(item, 120)).filter(item => set.has(item)) : []).slice(0, max);
  const deliverables = (Array.isArray(obj.candidateDeliverables) ? obj.candidateDeliverables : []).slice(0, 4).map(d => {
    if (typeof d === 'string') return { title: str(d, 200), description: '', acceptanceCriteria: '' };
    const o = d && typeof d === 'object' ? d : {};
    return { title: str(o.title, 200), description: str(o.description, 800), acceptanceCriteria: str(o.acceptanceCriteria, 600) };
  }).filter(d => d.title || d.description);
  return {
    title: str(obj.title, 160),
    summary: str(obj.summary, 1200),
    context: str(obj.context, 1600),
    objective: str(obj.objective, 800),
    scopeInclusions: list(obj.scopeInclusions, 8),
    scopeExclusions: list(obj.scopeExclusions, 8),
    candidateDeliverables: deliverables,
    approvedInputs: list(obj.approvedInputs, 8),
    suggestedVerticals: fromSet(obj.suggestedVerticals, VERTICALS, 6),
    suggestedWorkTypes: fromSet(obj.suggestedWorkTypes, WORK_TYPES, 5),
    estimatedEffort: str(obj.estimatedEffort, 120),
    // Project Engine fields — clamped server-side; missing/invalid values become null (never lower a match).
    opportunityType: ['project', 'internship', 'part_time', 'research'].includes(obj.opportunityType) ? obj.opportunityType : 'project',
    complexityRating: Number.isInteger(obj.complexityRating) && obj.complexityRating >= 1 && obj.complexityRating <= 5 ? obj.complexityRating : null,
    ambiguityRating: Number.isInteger(obj.ambiguityRating) && obj.ambiguityRating >= 1 && obj.ambiguityRating <= 5 ? obj.ambiguityRating : null,
    durationWeeks: Number.isInteger(obj.durationWeeks) && obj.durationWeeks > 0 ? Math.min(obj.durationWeeks, 26) : null,
    hoursPerWeek: Number.isInteger(obj.hoursPerWeek) && obj.hoursPerWeek > 0 ? Math.min(obj.hoursPerWeek, 40) : null,
    founderTimeMinWeek: Number.isInteger(obj.founderTimeMinWeek) && obj.founderTimeMinWeek > 0 ? Math.min(obj.founderTimeMinWeek, 600) : null,
    followUpQuestions: list(obj.followUpQuestions, 3),
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
  const base = { model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages: [{ role: 'user', content }] };
  const structured = { ...base, output_config: { format: { type: 'json_schema', schema: BRIEF_SCHEMA } } };
  const call = payload => fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  // Prefer Structured Outputs. If this deployment's API rejects the output_config param
  // (4xx), fall back once to a plain call so a working feature is never broken by the flag.
  let response = await call(structured);
  if (response && !response.ok && response.status >= 400 && response.status < 500) {
    response = await call(base);
  }
  if (!response || !response.ok) throw new Error('The AI intake service could not be reached. Try again, or book the consult and describe it there.');
  const data = await response.json();
  // The model can decline work that crosses the safety boundary — treat that as a blocked
  // (not errored) result the caller can surface, rather than a mysterious failure.
  if (data?.stop_reason === 'refusal') throw new Error('The AI declined to draft this — it may cross a safety boundary. Book the consult to talk it through.');
  const raw = (data?.content || []).filter(block => block && block.type === 'text').map(block => block.text).join('').trim();
  const parsed = parseBriefJson(raw);
  if (!parsed) throw new Error('The AI intake returned an unreadable response. Try again.');
  return normalizeBrief(parsed);
}

// ---- Reverse-audit intake (delta #1) — OPT-IN, never default. -----------------------------
// The founder pastes their OWN public repo/Figma/product link; Covenda proposes THREE scoped
// draft opportunities. Strictly opt-in (the founder supplies the link themselves — we never
// scan uninvited); the proposals are labeled DRAFTS the founder edits and confirms before
// anything publishes. Uses the same Structured Outputs intake + the web_fetch server tool so
// the model can actually read the linked page.
const REVERSE_AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals', 'safeToPropose', 'safetyFlags'],
  properties: {
    proposals: {
      type: 'array',
      description: 'Up to 3 scoped draft opportunities, each grounded in something observable at the link. No invented facts.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'deliverable', 'acceptanceCriteria', 'boundary', 'estimatedHours', 'founderTimeMinWeek'],
        properties: {
          title: { type: 'string', description: 'Short, specific draft-opportunity title.' },
          summary: { type: 'string', description: '2-3 sentences: the observed gap and the scoped fix.' },
          deliverable: { type: 'string', description: 'The single concrete deliverable.' },
          acceptanceCriteria: { type: 'string', description: 'How a reviewer decides it is done and correct.' },
          boundary: { type: 'string', description: 'What is explicitly out of scope / the information boundary (no production access, no restricted data).' },
          estimatedHours: { type: 'integer', description: 'Bounded student-hours estimate (5-40).' },
          founderTimeMinWeek: { type: 'integer', description: 'Honest founder review minutes per week (typically 30-60; never 0).' },
        },
      },
    },
    safeToPropose: { type: 'boolean' },
    safetyFlags: { type: 'array', items: { type: 'string' } },
  },
};

const REVERSE_AUDIT_SYSTEM = `You are Covenda's reverse-audit analyst. A founder has OPTED IN by giving you EITHER their own public link (repo, Figma, product page) OR the text of their own document — a planning doc, a list of what keeps slipping, retro notes. Work from whichever you are given; when it is a document, do not fetch anything, and ground every proposal in what the document actually says. Fetch and read that link, then propose exactly up to THREE scoped draft opportunities a vetted student could complete as a bounded work-trial.

Rules:
- Ground every proposal in something OBSERVABLE at the link (a real file, page, gap, or rough edge). Never invent facts about the company.
- Each proposal is a DRAFT the founder edits and confirms — never a commitment.
- Stay inside Covenda's safety boundary: no production access, no client/personal data, no regulated decisions. Prefer public sources and bounded deliverables.
- Be terse and concrete. Honest founderTimeMinWeek (typically 30-60; never 0). estimatedHours bounded 5-40.
Return ONLY the JSON object described by the schema.`;

export function normalizeReverseAudit(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const str = (v, max) => (typeof v === 'string' ? v.replace(/\0/g, '').trim().slice(0, max) : '');
  const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const proposals = (Array.isArray(obj.proposals) ? obj.proposals : []).slice(0, 3).map(p => ({
    title: str(p?.title, 160),
    summary: str(p?.summary, 1000),
    deliverable: str(p?.deliverable, 600),
    acceptanceCriteria: str(p?.acceptanceCriteria, 600),
    boundary: str(p?.boundary, 600),
    estimatedHours: intIn(p?.estimatedHours, 1, 60),
    founderTimeMinWeek: intIn(p?.founderTimeMinWeek, 1, 600),
    draft: true, // always labeled — the founder edits and confirms before anything publishes
  })).filter(p => p.title && p.deliverable);
  return {
    proposals,
    safeToPropose: obj.safeToPropose === true && proposals.length > 0,
    safetyFlags: (Array.isArray(obj.safetyFlags) ? obj.safetyFlags : []).map(f => str(f, 300)).filter(Boolean).slice(0, 6),
  };
}

export async function generateReverseAudit({ linkUrl, documentText, env = process.env, fetchImpl = fetch }) {
  const url = typeof linkUrl === 'string' ? linkUrl.trim() : '';
  // A pasted or uploaded document is the other way in. Most companies have already written
  // this down somewhere; requiring a public repo excluded everyone who is not technical.
  const doc = typeof documentText === 'string' ? documentText.trim().slice(0, 40_000) : '';
  if (!doc && !/^https?:\/\/\S+$/i.test(url)) {
    throw new Error('Paste a public link of your own, or the text of a document describing what keeps slipping.');
  }
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new IntakeConfigError('AI project understanding is not configured yet. Add ANTHROPIC_API_KEY in Vercel to enable it.');
  const prompt = doc
    ? `The founder opted in and supplied their own document. Do not fetch anything — work only from this text.\n\n--- DOCUMENT ---\n${doc}\n--- END ---\n\nPropose up to 3 scoped draft opportunities as JSON, each grounded in something the document actually says.`
    : `The founder opted in and pasted their own public link: ${url}\n\nFetch it, read what is actually there, and propose up to 3 scoped draft opportunities as JSON.`;
  const base = {
    model: MODEL,
    max_tokens: 4096,
    system: REVERSE_AUDIT_SYSTEM,
    // No web_fetch on the document path: there is nothing to fetch, and offering the tool
    // invites the model to go looking beyond what the founder actually shared.
    ...(doc ? {} : { tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 }] }),
    output_config: { format: { type: 'json_schema', schema: REVERSE_AUDIT_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  };
  const call = payload => fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  let payload = base;
  let data = null;
  // Server-tool turns can pause (stop_reason: pause_turn) — resume up to 3 times by
  // re-sending with the assistant turn appended, per the API's continuation contract.
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await call(payload);
    if (!response || !response.ok) throw new Error('The AI reverse-audit could not be reached. Try again shortly.');
    data = await response.json();
    if (data?.stop_reason !== 'pause_turn') break;
    payload = { ...payload, messages: [...base.messages, { role: 'assistant', content: data.content }] };
  }
  if (data?.stop_reason === 'refusal') throw new Error('The AI declined this link — it may cross a safety boundary.');
  const raw = (data?.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('').trim();
  const parsed = parseBriefJson(raw);
  if (!parsed) throw new Error('The AI reverse-audit returned an unreadable response. Try again.');
  return normalizeReverseAudit(parsed);
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
  const env = dependencies.env || process.env;
  const { enabled: metering, fee } = briefFeeConfig(env);
  try {
    // Gate on balance BEFORE spending the API call, so a company can't run a brief it can't pay for.
    if (metering && fee > 0) {
      const balance = await creditBalance(member);
      if (balance < fee) return res.status(402).json({ ok: false, code: 'INSUFFICIENT_CREDITS', error: `Generating an AI brief costs ${fee} credits — your balance is ${balance}. Top up in Wallet first.` });
    }
    // Reverse-audit mode (opt-in): the founder pasted their OWN public link — return up to
    // 3 draft opportunities instead of one brief. Same metering, same safety posture.
    if (body.action === 'diagnose') {
      const result = await generateDiagnosedBrief({
        problemText: body.problem, traits: Array.isArray(body.traits) ? body.traits : [],
        env, fetchImpl: dependencies.fetchImpl || fetch,
      });
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'reverse-audit') {
      const audit = await generateReverseAudit({ linkUrl: body.linkUrl, documentText: body.documentText, env, fetchImpl: dependencies.fetchImpl || fetch });
      let auditCharged = 0;
      if (metering && fee > 0) {
        const { error } = await member.supabase.from('credit_ledger').insert({ user_id: member.user.id, entry_type: 'ai_brief', credits: -fee, note: `AI reverse-audit · ${fee} credits` });
        if (!error) auditCharged = fee;
      }
      return res.status(200).json({ ok: true, audit, charged: auditCharged });
    }
    const brief = await generateProjectBrief({
      problemText: body.problemText,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      env,
      fetchImpl: dependencies.fetchImpl || fetch,
    });
    // Charge only after a successful generation. Best-effort: if the ledger write fails we
    // still return the brief the company is waiting on rather than erroring after the fact.
    let charged = 0;
    if (metering && fee > 0) {
      const { error } = await member.supabase.from('credit_ledger').insert({ user_id: member.user.id, entry_type: 'ai_brief', credits: -fee, note: `AI project brief · ${fee} credits` });
      if (error) console.error(JSON.stringify({ level: 'error', message: 'AI brief charge failed', error: String(error?.message || error).slice(0, 200) }));
      else charged = fee;
    }
    return res.status(200).json({ ok: true, brief, charged });
  } catch (error) {
    if (error instanceof IntakeConfigError) return res.status(503).json({ ok: false, code: 'INTAKE_NOT_CONFIGURED', error: error.message });
    const message = (error && error.message) || 'AI intake failed.';
    const expected = /^(Describe|Paste|The AI)/.test(message);
    return res.status(expected ? 400 : 502).json({ ok: false, error: message });
  }
}

// ── Stage 1+2: diagnose the problem, then design a trial from it ──────────────────────
// Extractive only, same rule as the brief extractor: never invent a metric, budget,
// headcount or deadline the founder did not give. The engine in api/brief-engine.js decides
// whether what comes back is shippable; this only asks for it.
const DIAGNOSE_SYSTEM = `You are Covenda's diagnostic analyst. A founder has described a problem in their own words.

Do NOT accept the stated problem at face value. Founders misdiagnose — "sales are down, blame marketing" when traffic is up and the real cause is a channel conflict. Decompose it, then say where the evidence actually points.

RULES
- Extractive only. Never invent a metric, budget, headcount, deadline or customer count the founder did not state.
- If the input is too thin to diagnose, return an empty decomposition rather than guessing.
- rootCauseClass is "structural" (the process or model is wrong for the work) or "behavioral" (the process is fine, execution is not). They lead to different projects, so choose deliberately.
- statedProblem is what they said. likelyProblem is what the evidence supports. If they are the same, repeat it.
- confirmingEvidence and killingEvidence are what would settle it — usually this IS the work.

Then design ONE bounded work-trial that is both USEFUL to the company and DISCRIMINATING between candidates.
- valueToCompany: what the founder gets even if nobody is hired.
- discriminatingSignal: for each trait they named, the specific part of the task that separates strong from weak, with what each looks like. If a trait has no discriminating element, set discriminates:false and say so. Do not pretend.
- inputsRequired: each { label, kind } where kind is public, synthetic, or founder_approved. NEVER require internal or NDA'd material — early-stage founders cannot get it approved in time.
- founderTimeRequired: honest minutes per week of the founder's attention.
- estimatedHours: honest student hours.`;

const DIAGNOSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['statedProblem', 'likelyProblem', 'decomposition', 'rootCause', 'rootCauseClass', 'reasoning', 'brief'],
  properties: {
    statedProblem: { type: 'string' },
    likelyProblem: { type: 'string' },
    decomposition: {
      type: 'array', maxItems: 6,
      items: { type: 'object', additionalProperties: false, required: ['label', 'note'], properties: { label: { type: 'string' }, note: { type: 'string' } } },
    },
    rootCause: { type: 'string' },
    rootCauseClass: { type: 'string', enum: ['structural', 'behavioral'] },
    reasoning: { type: 'string' },
    confirmingEvidence: { type: 'array', maxItems: 5, items: { type: 'string' } },
    killingEvidence: { type: 'array', maxItems: 5, items: { type: 'string' } },
    brief: {
      type: 'object', additionalProperties: false,
      required: ['title', 'deliverable', 'valueToCompany', 'discriminatingSignal', 'inputsRequired', 'founderTimeRequired', 'estimatedHours'],
      properties: {
        title: { type: 'string' }, deliverable: { type: 'string' }, valueToCompany: { type: 'string' },
        discriminatingSignal: {
          type: 'array', maxItems: 6,
          items: {
            type: 'object', additionalProperties: false,
            required: ['trait', 'discriminates'],
            properties: {
              trait: { type: 'string' }, element: { type: 'string' },
              weakLooksLike: { type: 'string' }, strongLooksLike: { type: 'string' },
              discriminates: { type: 'boolean' },
            },
          },
        },
        inputsRequired: {
          type: 'array', maxItems: 6,
          items: { type: 'object', additionalProperties: false, required: ['label', 'kind'], properties: { label: { type: 'string' }, kind: { type: 'string' } } },
        },
        founderTimeRequired: { type: 'number' }, estimatedHours: { type: 'number' },
        rubricSkill: { type: 'string' },
      },
    },
  },
};

export async function generateDiagnosedBrief({ problemText, traits = [], env = process.env, fetchImpl = fetch }) {
  const text = String(problemText || '').trim();
  if (text.length < 40) {
    return { ok: false, needsMore: true, questions: diagnosisGaps(normaliseDiagnosis({})), reason: 'Tell us a bit more about the problem first.' };
  }
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new IntakeConfigError('Project drafting is not configured on this deployment yet.');

  const prompt = `The founder wrote:

${text}

${traits.length ? `Traits they said they care about: ${traits.join(', ')}` : 'They did not name specific traits — infer at most three from the problem itself and label them.'}`;
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 3000, system: DIAGNOSE_SYSTEM,
      output_config: { format: { type: 'json_schema', schema: DIAGNOSE_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response || !response.ok) throw new Error('The diagnosis could not be reached. Try again shortly.');
  const data = await response.json();
  const raw = (data?.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('').trim();
  const parsed = parseBriefJson(raw);
  if (!parsed) throw new Error('The diagnosis came back unreadable. Try again.');

  const diagnosis = normaliseDiagnosis(parsed);
  const gaps = diagnosisGaps(diagnosis);
  // Too thin to diagnose? Ask the specific questions rather than emitting a confident guess.
  if (!diagnosis.decomposition.length) {
    return { ok: false, needsMore: true, questions: gaps, diagnosis, reason: 'Not enough here to diagnose yet.' };
  }
  // The engine decides whether the trial is shippable. A refusal is returned intact.
  const verdict = evaluateBrief({ ...(parsed.brief || {}), rubricSkill: parsed.brief?.rubricSkill }, { traits });
  return {
    ok: verdict.ok,
    engineVersion: BRIEF_ENGINE_VERSION,
    diagnosis,
    openQuestions: gaps,
    brief: { ...(parsed.brief || {}), ...verdict },
    refusal: verdict.refusal,
  };
}
