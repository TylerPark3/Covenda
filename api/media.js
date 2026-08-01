// Playback for private blobs.
//
// The Blob store is private, which is the right posture — a recording of a student talking
// through their own work is more personal than a résumé, and it should not be fetchable by
// anyone who guesses a URL. The consequence is that the stored URL is not directly viewable,
// so every read has to be signed, and signing has to be gated on whether the caller is
// entitled to watch.
//
// ── WHO IS ENTITLED ───────────────────────────────────────────────────────────────────
// Deliberately narrow, and it mirrors the consent model already used everywhere else: consent
// is per-submission, never blanket.
//
//   owner      the student who recorded it. Always.
//   recipient  a company, only for a recording attached to an application to THEIR project.
//              Not because they have an account, and not because the recording exists. A
//              company that once received an application does not thereby get a library.
//   operator   reviewing a batch application.
//
// ── WHY PRESIGN RATHER THAN PROXY ─────────────────────────────────────────────────────
// The function could stream the bytes back itself, but video playback needs Range requests to
// seek, and the blob store already handles those. Presigning hands the browser a short-lived
// URL and stays out of the data path.

import { createClient } from '@supabase/supabase-js';

import { checkLimit, limitResponse, recordError } from './limits.js';
import { signedReadUrl } from './storage.js';

// Short. A signed URL that outlives the session it was minted for is a public URL with extra
// steps, and these end up pasted into chat windows.
export const TTL_SECONDS = 60 * 15;

const BLOB_HOST = /^https:\/\/([a-z0-9]+)\.(private|public)\.blob\.vercel-storage\.com\/(.+)$/i;

// The hostname carries the access level, so a public blob needs no signing at all — the
// uploader falls back to public when the store allows it.
export function parseBlobUrl(url) {
  const match = BLOB_HOST.exec(String(url || '').split('?')[0]);
  if (!match) return null;
  return { storeId: match[1], access: match[2].toLowerCase(), pathname: decodeURIComponent(match[3]) };
}

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Media playback is not configured on this deployment.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function userFrom(req, supabase) {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data?.user || null;
}

function operatorEmails(env) {
  return String(env.COVENDA_ADMIN_EMAILS || env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Authorisation is checked against rows, never against the shape of the URL. An unguessable
// path is not an access-control model.
export async function mayView(supabase, user, url, env = process.env) {
  const parsed = parseBlobUrl(url);
  if (!parsed) return { ok: false, reason: 'That is not a Covenda media URL.' };
  const clean = String(url).split('?')[0];

  if (user?.email && operatorEmails(env).includes(String(user.email).toLowerCase())) {
    return { ok: true, as: 'operator', parsed };
  }

  // Their own recording, from their library.
  const own = await maybe(supabase.from('member_videos').select('id').eq('user_id', user.id).eq('url', clean).maybeSingle());
  if (own) return { ok: true, as: 'owner', parsed };

  // Attached to an application. Two ways to be entitled: they sent it, or it was sent to them.
  const apps = await maybe(supabase.from('project_applications')
    .select('id,project_id,student_user_id,video_url').eq('video_url', clean).limit(10), []);
  for (const app of apps || []) {
    if (app.student_user_id === user.id) return { ok: true, as: 'owner', parsed };
    const project = await maybe(supabase.from('member_projects').select('owner_user_id').eq('id', app.project_id).maybeSingle());
    // The company sees it because this student sent it to them, not because it exists.
    if (project?.owner_user_id === user.id) return { ok: true, as: 'recipient', parsed };
  }

  // Batch application materials. Scoped to this caller's own rows — a scan of every batch
  // application would be a scan of every applicant's media.
  const mine = await maybe(supabase.from('batch_applications')
    .select('materials').eq('student_user_id', user.id).limit(50), []);
  for (const row of mine || []) {
    if (materialUrls(row.materials).includes(clean)) return { ok: true, as: 'owner', parsed };
  }

  return { ok: false, reason: 'That recording is not shared with you.' };
}

export function materialUrls(materials) {
  const m = materials || {};
  return [
    m.videoUrl,
    m.exerciseUrl,
    ...(Array.isArray(m.workSamples) ? m.workSamples : []),
    ...(Array.isArray(m.workSampleFiles) ? m.workSampleFiles.map(f => f?.url) : []),
  ].filter(Boolean).map(u => String(u).split('?')[0]);
}

// Degrades on a missing table rather than 500ing the whole playback — the same posture as
// `optional()` in the portal, which exists because reads shipped ahead of a migration once.
async function maybe(query, fallback = null) {
  try {
    const { data, error } = await query;
    if (error) { console.warn(`Media lookup skipped: ${error.message}`); return fallback; }
    return data ?? fallback;
  } catch (error) {
    console.warn(`Media lookup skipped: ${String(error?.message || error)}`);
    return fallback;
  }
}

// One signed read URL, scoped to this object and expiring on its own. A leaked URL cannot
// write or delete: Supabase signs reads separately from uploads, so the read grant carries no
// write capability at all, which is stricter than the delegate-then-sign token it replaces.
//
// `parsed.access === 'public'` still short-circuits, because recordings uploaded before the
// provider swap live on a public Vercel URL and rebuild() is the only way to reach them.
export async function signPlayback(parsed, { now = Date.now(), ttl = TTL_SECONDS } = {}) {
  if (parsed.access === 'public') return { url: rebuild(parsed), signed: false, expiresIn: null };
  const { url, legacy } = await signedReadUrl(parsed.pathname, { ttl });
  return { url, signed: !legacy, expiresIn: legacy ? null : ttl };
}

function rebuild(parsed) {
  return `https://${parsed.storeId}.${parsed.access}.blob.vercel-storage.com/${parsed.pathname.split('/').map(encodeURIComponent).join('/')}`;
}

export default async function handler(req, res) {
  const env = process.env;
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    const supabase = serviceClient(env);
    const user = await userFrom(req, supabase);
    if (!user) return res.status(401).json({ ok: false, error: 'Sign in first.' });

    const limit = await checkLimit('media-sign', user.id, { env, client: supabase });
    if (!limit.allowed) return limitResponse(res, limit, 'playback requests');

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const verdict = await mayView(supabase, user, body.url, env);
    if (!verdict.ok) return res.status(403).json({ ok: false, error: verdict.reason });

    const playback = await signPlayback(verdict.parsed);
    // Never cached at the edge: the URL is per-caller and short-lived.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, ...playback, as: verdict.as });
  } catch (error) {
    // Named rather than swallowed. The last upload bug cost an hour precisely because a bare
    // catch made every failure look identical.
    await recordError('media', 'error', error?.message || 'unknown', { env });
    return res.status(500).json({ ok: false, error: 'Could not prepare playback. Try reloading.' });
  }
}
