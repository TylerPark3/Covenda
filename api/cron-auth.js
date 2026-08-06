// Who is allowed to run a scheduled job.
//
// The three cron handlers each carried their own copy of this check, and each copy had the same
// two holes:
//
//   req.headers['x-vercel-cron'] || req.headers.authorization === `Bearer ${process.env.CRON_SECRET || ''}`
//
// The first half trusts a request header. Headers are written by whoever makes the request, so
// `curl -H 'x-vercel-cron: 1'` ran the job. The platform set that header on its own calls, which
// is what made it look like a signal; it was never a boundary. Moving hosts removes even the
// appearance — nothing on the new host sends it.
//
// The second half is worse when the secret is unset, which it was in production: the comparison
// collapses to `Bearer ` and any request sending exactly that string authenticates. An unset
// secret let everybody in rather than nobody, which is the wrong direction for a default.
//
// So: a configured secret, compared in full, or no.

import { timingSafeEqual } from 'node:crypto';

/**
 * True only if the caller presented the configured cron secret.
 *
 * No secret configured means no caller qualifies. A scheduled job that silently becomes public
 * because a variable was never set is not a failure anyone notices until it is used.
 */
export function isAuthorisedCron(req, env = process.env) {
  const secret = String(env.CRON_SECRET || '');
  if (!secret) return false;

  const presented = String(req?.headers?.authorization || '');
  const expected = `Bearer ${secret}`;
  // timingSafeEqual throws on a length mismatch, and the length itself is not a secret.
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/**
 * The call sites want "reject unless authorised, but let me curl it on my laptop".
 *
 * Local runs are the exception and must say so explicitly: NODE_ENV is set to production on the
 * deployed service, but the check keys on `development` being present rather than on production
 * being absent. An unset NODE_ENV is then a locked door instead of an open one, which matters
 * because a misconfigured deploy is exactly where NODE_ENV goes missing.
 */
export function rejectUnauthorisedCron(req, res, env = process.env) {
  if (isAuthorisedCron(req, env)) return false;
  if (env.NODE_ENV === 'development') return false;
  res.status(401).json({ ok: false, error: 'Not authorised.' });
  return true;
}
