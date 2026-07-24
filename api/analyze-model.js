import { authorizeMember } from './portal.js';
import { analyzeFinancialModel } from './xlsx-parse.js';
import { modelClaim } from './finance.js';

// Proof Connector Framework — finance Connector B, live endpoint: a student uploads a financial
// model (.xlsx, base64) → we parse FORMULAS server-side and score against the DCF rubric → emit
// an artifact-tier skill_claim. No raw dump is stored — only the derived rubric result + a claim.

const MAX_BYTES = 6 * 1024 * 1024; // ~6MB workbook ceiling

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export default async function handler(req, res, dependencies = {}) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  try {
    const member = await authorizeMember(req, { env: dependencies.env || process.env, createSupabaseClient: dependencies.createSupabaseClient });
    if (!member) return res.status(401).json({ ok: false, error: 'Sign in to submit a model.' });
    const profile = await member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle();
    if (profile.data?.role !== 'student') return res.status(403).json({ ok: false, error: 'Only students can submit a model for scoring.' });

    const body = readBody(req);
    const b64 = String(body.fileBase64 || '').replace(/^data:.*;base64,/, '');
    if (!b64) return res.status(400).json({ ok: false, error: 'Attach an .xlsx model to score.' });
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(400).json({ ok: false, error: 'The file is empty or too large (6MB max).' });

    const rubric = analyzeFinancialModel(buffer); // throws a friendly error on malformed input
    const evidencePointer = String(body.evidencePointer || '').trim().slice(0, 500) || `xlsx://${(body.filename || 'model').toString().slice(0, 120)}`;

    // Emit the claim best-effort; degrade gracefully before the Stage-0 / evidence_meta migrations.
    try {
      const row = modelClaim({ studentUserId: member.user.id, rubric, evidencePointer });
      let { error } = await member.supabase.from('skill_claim').insert(row);
      if (error) { const { evidence_meta, ...bare } = row; await member.supabase.from('skill_claim').insert(bare); }
    } catch { /* skill_claim not migrated yet — still return the rubric result for display */ }

    return res.status(200).json({ ok: true, rubric: { score: rubric.score, reasons: rubric.reasons, flags: rubric.flags, parsed: rubric.parsed } });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || error).slice(0, 200) });
  }
}
