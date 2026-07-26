import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { authorizeMember } from './portal.js';

// Proof Connector Framework — Connector A, the GitHub OAuth (ownership) rail.
//
// OAuth proves OWNERSHIP: a student connects their OWN GitHub account (read-only, minimal
// scopes, revocable). We record only the connected login + that a connection exists — never the
// access token in our DB, and never a raw repo dump. Ownership is then established by matching
// the connected login against a repo's owner at analysis time (see api/portal.js analyzeGithub).
//
// CSRF is handled with an HMAC-signed, time-bounded `state` (no server-side session table): the
// state binds the student's user id to a nonce and an expiry, signed with a server secret. The
// GitHub callback carries no member auth, so the signed state is how we know who connected.
//
// Secrets are OPERATOR-provisioned in the environment; this module never handles them directly:
//   GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, CONNECTOR_STATE_SECRET, APP_BASE_URL

const STATE_TTL_MS = 10 * 60 * 1000; // a connect attempt must complete within 10 minutes
const GITHUB_SCOPES = ['read:user', 'public_repo']; // READ-ONLY, minimal

function stateSecret(env) {
  return env.CONNECTOR_STATE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET || '';
}

// state = base64url(userId.expiry.nonce).base64url(hmac). Pure + exported for tests.
export function signState(userId, secret, { now = Date.now(), nonce = randomBytes(8).toString('hex') } = {}) {
  const body = `${userId}.${now + STATE_TTL_MS}.${nonce}`;
  const b64 = Buffer.from(body).toString('base64url');
  const sig = createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyState(state, secret, { now = Date.now() } = {}) {
  const parts = String(state || '').split('.');
  if (parts.length !== 2 || !secret) return null;
  const [b64, sig] = parts;
  const expected = createHmac('sha256', secret).update(b64).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, expiry] = Buffer.from(b64, 'base64url').toString().split('.');
  if (!userId || !expiry || Number(expiry) < now) return null;
  return { userId };
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_SCOPES.join(' '),
    state,
    allow_signup: 'false',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function baseUrl(env, req) {
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function serviceClient(env, make = createClient) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET;
  return make(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// Exchange the OAuth code for the connected account's login. Returns { login } or throws.
async function exchangeAndFetchLogin(code, env, fetchImpl = fetch) {
  const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });
  const token = (await tokenRes.json())?.access_token;
  if (!token) throw new Error('GitHub did not return an access token.');
  // Use the token transiently to read the login, then discard it — we never store it.
  const userRes = await fetchImpl('https://api.github.com/user', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'covenda-connect', Authorization: `Bearer ${token}` },
  });
  const login = (await userRes.json())?.login;
  if (!login) throw new Error('Could not read the connected GitHub account.');
  return { login };
}

export default async function handler(req, res, dependencies = {}) {
  const env = dependencies.env || process.env;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const action = (req.query?.action || '').toString();

  try {
    // ---- OAuth callback (no member auth — identified via the signed state) ----------------
    if (action === 'callback') {
      const parsed = verifyState(req.query?.state, stateSecret(env));
      if (!parsed) return res.status(400).send('This GitHub connection link is invalid or expired. Please try again from your profile.');
      const code = (req.query?.code || '').toString();
      if (!code) return res.status(400).send('Missing authorization code.');
      const { login } = await exchangeAndFetchLogin(code, env, fetchImpl);
      const supabase = serviceClient(env, dependencies.createSupabaseClient || createClient);
      await supabase.from('connector_accounts').upsert({
        student_user_id: parsed.userId,
        connector_id: 'github',
        external_login: login,
        ownership_verified: true,
        scopes: GITHUB_SCOPES,
        last_synced_at: new Date().toISOString(),
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_user_id,connector_id' });
      res.setHeader('Location', `${baseUrl(env, req)}/portal.html?connected=github`);
      return res.status(302).end();
    }

    // ---- Everything else requires the member's session ------------------------------------
    const member = await authorizeMember(req, { env, createSupabaseClient: dependencies.createSupabaseClient });
    if (!member) return res.status(401).json({ ok: false, error: 'Sign in to connect an account.' });

    if (action === 'status') {
      const { data } = await member.supabase.from('connector_accounts')
        .select('external_login, ownership_verified, revoked_at, last_synced_at')
        .eq('student_user_id', member.user.id).eq('connector_id', 'github').maybeSingle();
      const connected = !!(data && !data.revoked_at && data.ownership_verified);
      return res.status(200).json({ ok: true, connected, login: connected ? data.external_login : null });
    }

    if (action === 'disconnect') {
      // Revocable by design: flip revoked_at; future analyses fall back to the paste (unverified)
      // path. We keep the row for the audit trail rather than hard-deleting.
      await member.supabase.from('connector_accounts')
        .update({ revoked_at: new Date().toISOString(), ownership_verified: false, updated_at: new Date().toISOString() })
        .eq('student_user_id', member.user.id).eq('connector_id', 'github');
      return res.status(200).json({ ok: true, connected: false });
    }

    if (action === 'start') {
      const clientId = env.GITHUB_OAUTH_CLIENT_ID;
      if (!clientId || !stateSecret(env)) {
        return res.status(503).json({ ok: false, error: 'GitHub connection is not configured yet.' });
      }
      const state = signState(member.user.id, stateSecret(env));
      const url = buildAuthorizeUrl({ clientId, redirectUri: `${baseUrl(env, req)}/api/connect-github?action=callback`, state });
      return res.status(200).json({ ok: true, url });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error?.message || error).slice(0, 200) });
  }
}
