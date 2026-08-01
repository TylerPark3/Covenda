// Object storage, behind one interface.
//
// Every upload path used to import @vercel/blob directly, which made the storage vendor a
// dependency of eight handlers instead of one module. This is the seam: swapping providers is
// now an edit here rather than a hunt through the API surface.
//
// It is backed by Supabase Storage, which this project already pays for and already
// authenticates against. That removes the last @vercel/* package from the codebase, so hosting
// becomes a deployment decision rather than a rewrite.
//
// ── Reading old files still works ─────────────────────────────────────────────────────
// Rows written before this change hold absolute Vercel Blob URLs. Those files still live on
// Vercel and must stay readable, or every deliverable and recording uploaded to date breaks.
// So reads accept either an absolute URL (fetched as-is) or a storage key (resolved through
// Supabase). Writes always go to Supabase. Old data is never rewritten, because a migration
// that copies files is a different, riskier change than a migration that stops writing new ones.
//
// ── Private by default ────────────────────────────────────────────────────────────────
// The bucket is private. A recording of a student is not public-but-unguessable; it is private
// and reached through a short-lived signed URL. The previous code tried `access: 'public'` and
// fell back to private only when the store refused, which meant the posture depended on a
// deployment setting rather than on a decision.

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const STORAGE_VERSION = 'storage-1.0.0';

// One bucket, prefixed paths. Separate buckets per kind would multiply the policy surface for
// no benefit, since access is decided per request by the handler that mints the signed URL.
export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

// Signed URLs are deliberately short. One that outlives the session it was minted for is a
// public URL with extra steps, and these get pasted into chat windows.
export const READ_TTL_SECONDS = 300;
export const UPLOAD_TTL_SECONDS = 600;

function serviceClient(env = process.env, createImpl = createClient) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createImpl(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** True when the value is an absolute URL rather than a storage key. */
export function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

/** True for a URL that lives on the storage this codebase no longer writes to. */
export function isLegacyBlobUrl(value) {
  return /\.public\.blob\.vercel-storage\.com\//i.test(String(value || ''))
    || /\.blob\.vercel-storage\.com\//i.test(String(value || ''));
}

/**
 * Write an object. Returns { url, key } where `url` is what callers persist.
 *
 * `url` is the storage key, not an absolute URL, because the bucket is private: an absolute
 * URL would not be fetchable anyway, and storing a key keeps the row valid if the project or
 * region ever moves. signedReadUrl() turns it back into something a browser can open.
 */
export async function putObject(key, body, { contentType, addRandomSuffix = false, client = null, env = process.env } = {}) {
  const db = client || serviceClient(env);
  if (!db) throw new Error('Storage is not configured on this deployment.');
  let path = String(key || '').replace(/^\/+/, '');
  if (!path) throw new Error('An object needs a key.');

  // The previous provider offered addRandomSuffix, and project-upload relied on it: two
  // students uploading "resume.pdf" must not collide, and upsert would silently overwrite the
  // first. Preserved rather than dropped, because dropping it turns a collision into data loss.
  if (addRandomSuffix) {
    const dot = path.lastIndexOf('.');
    const suffix = randomUUID().slice(0, 8);
    path = dot > 0 ? `${path.slice(0, dot)}-${suffix}${path.slice(dot)}` : `${path}-${suffix}`;
  }

  const { error } = await db.storage.from(BUCKET).upload(path, body, {
    contentType: contentType || 'application/octet-stream',
    // Re-uploading the same key replaces rather than 409s. Handlers derive keys from a user id
    // plus a filename, so a retry after a dropped response must not fail.
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${String(error.message || error).slice(0, 200)}`);
  return { url: path, key: path, pathname: path };
}

/**
 * Read an object as bytes. Accepts a storage key OR an absolute URL, so files written before
 * the provider swap keep working without a data migration.
 */
export async function getObject(keyOrUrl, { client = null, env = process.env } = {}) {
  const ref = String(keyOrUrl || '');
  if (!ref) throw new Error('Nothing to read.');

  if (isAbsoluteUrl(ref)) {
    // A legacy Vercel Blob URL, or any absolute URL a row already holds. Fetch it directly.
    const response = await fetch(ref);
    if (!response.ok) throw new Error(`Could not read the stored file (${response.status}).`);
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      legacy: true,
    };
  }

  const db = client || serviceClient(env);
  if (!db) throw new Error('Storage is not configured on this deployment.');
  const { data, error } = await db.storage.from(BUCKET).download(ref.replace(/^\/+/, ''));
  if (error || !data) throw new Error(`Could not read the stored file: ${String(error?.message || 'missing').slice(0, 160)}`);
  return {
    body: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || 'application/octet-stream',
    legacy: false,
  };
}

/**
 * A short-lived URL a browser may PUT directly to, so large files never pass through a
 * serverless function. Mirrors what issueSignedToken + presignUrl did.
 */
export async function signedUploadUrl(key, { client = null, env = process.env } = {}) {
  const db = client || serviceClient(env);
  if (!db) throw new Error('Storage is not configured on this deployment.');
  const path = String(key || '').replace(/^\/+/, '');
  if (!path) throw new Error('An upload needs a key.');

  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.signedUrl) {
    throw new Error(`Could not start the upload: ${String(error?.message || 'unknown').slice(0, 160)}`);
  }
  // Supabase fixes this TTL at two hours; UPLOAD_TTL_SECONDS is what callers report and what
  // handlers should enforce on their own side. Reported honestly rather than as a promise the
  // provider does not make.
  return { uploadUrl: data.signedUrl, token: data.token, key: path, pathname: path, expiresIn: UPLOAD_TTL_SECONDS };
}

/**
 * A short-lived readable URL. Accepts a key or an absolute URL; an absolute one is returned
 * unchanged, because a legacy file's URL is already the only way to reach it.
 */
export async function signedReadUrl(keyOrUrl, { ttl = READ_TTL_SECONDS, client = null, env = process.env } = {}) {
  const ref = String(keyOrUrl || '');
  if (!ref) throw new Error('Nothing to read.');
  if (isAbsoluteUrl(ref)) return { url: ref, expiresIn: null, legacy: true };

  const db = client || serviceClient(env);
  if (!db) throw new Error('Storage is not configured on this deployment.');
  const { data, error } = await db.storage.from(BUCKET)
    .createSignedUrl(ref.replace(/^\/+/, ''), Math.max(30, Math.min(3600, Number(ttl) || READ_TTL_SECONDS)));
  if (error || !data?.signedUrl) {
    throw new Error(`Could not open the file: ${String(error?.message || 'unknown').slice(0, 160)}`);
  }
  return { url: data.signedUrl, expiresIn: ttl, legacy: false };
}

/** Whether storage is usable on this deployment, for handlers that want to fail early. */
export function storageConfigured(env = process.env) {
  return Boolean((env.SUPABASE_URL) && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY));
}
