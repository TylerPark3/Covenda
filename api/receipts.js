import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

import { postgresConfiguration, supabaseConfiguration } from './submissions.js';

const MAX_BODY_BYTES = 2_000;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 20;
const lookupBuckets = new Map();
const RECEIPT_COLUMNS = 'reference,submission_type,status,created_at,updated_at';

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function cleanEmail(value) {
  const clean = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : '';
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

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

function isLookupRateLimited(req) {
  const now = Date.now();
  const rawAddress = cleanText(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown', 200);
  const key = rawAddress.split(',')[0].trim() || 'unknown';
  const recent = (lookupBuckets.get(key) || []).filter(timestamp => now - timestamp < RATE_WINDOW_MS);
  recent.push(now);
  lookupBuckets.set(key, recent);
  if (lookupBuckets.size > 1_000) {
    for (const [address, timestamps] of lookupBuckets) {
      if (!timestamps.some(timestamp => now - timestamp < RATE_WINDOW_MS)) lookupBuckets.delete(address);
    }
  }
  return recent.length > RATE_LIMIT;
}

export function receiptLookupInput(body = {}) {
  const reference = cleanText(body.reference, 40).toUpperCase();
  const email = cleanEmail(body.email);
  if (!/^(EMP|STU|CALL|UNI)-[A-Z0-9]{6,20}$/.test(reference) || !email) {
    throw new Error('Enter a valid receipt reference and the email used to submit it.');
  }
  return { reference, email };
}

function receiptFromRow(row) {
  if (!row) return null;
  return {
    reference: row.reference,
    type: row.submission_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findReceipt({ reference, email }, {
  env = process.env,
  createSupabaseClient = createClient,
  createPostgresClient = postgres,
} = {}) {
  const configuration = supabaseConfiguration(env);
  if (configuration) {
    try {
      const supabase = createSupabaseClient(configuration.url, configuration.secret, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await supabase
        .from('submissions')
        .select(RECEIPT_COLUMNS)
        .eq('reference', reference)
        .eq('submitter_email', email)
        .maybeSingle();
      if (!error) return { receipt: receiptFromRow(data), route: 'data-api' };
    } catch {
      // The independent direct Postgres path below handles Data API failures.
    }
  }

  const connectionString = postgresConfiguration(env);
  if (connectionString) {
    const sql = createPostgresClient(connectionString, {
      max: 1,
      prepare: false,
      idle_timeout: 2,
      connect_timeout: 6,
    });
    try {
      const rows = await sql`
        select reference, submission_type, status, created_at, updated_at
        from public.submissions
        where reference = ${reference}
          and lower(submitter_email) = ${email}
        limit 1
      `;
      return { receipt: receiptFromRow(rows[0]), route: 'postgres' };
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  throw new Error('Receipt lookup is temporarily unavailable.');
}

export default async function handler(req, res, { findReceiptRecord = findReceipt } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ ok: false, error: 'Lookup request is too large.' });
  if (isLookupRateLimited(req)) return res.status(429).json({ ok: false, error: 'Too many lookup attempts. Please try again later.' });

  try {
    const input = receiptLookupInput(parseBody(req));
    const result = await findReceiptRecord(input);
    if (!result.receipt) {
      return res.status(404).json({ ok: false, error: 'No matching receipt was found. Check the reference and email.' });
    }
    return res.status(200).json({ ok: true, receipt: result.receipt, route: result.route });
  } catch (error) {
    const expected = error instanceof SyntaxError || error?.message?.startsWith('Enter a valid');
    if (!expected) console.error('Receipt lookup failed', error);
    return res.status(expected ? 400 : 503).json({
      ok: false,
      error: expected ? error.message : 'Receipt lookup is temporarily unavailable.',
    });
  }
}
