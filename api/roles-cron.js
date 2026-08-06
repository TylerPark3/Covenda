// Nightly pull of open student roles from public job boards.
//
// Runs on a schedule rather than on request, for two reasons. Fetching seven boards takes
// several seconds and would sit in front of a student loading their dashboard. And the boards
// are somebody else's servers: one request per board per night is a courteous read of a public
// endpoint, one per student page view is not.
//
// ── UPSERT, NEVER TRUNCATE ────────────────────────────────────────────────────────────
// The obvious shape is "delete everything, insert what we just fetched". That has a window,
// however short, where the table is empty and a student sees no roles. It also loses a posting
// the moment one board has a bad night. Instead every row is upserted on (source,
// external_id) and stamped with last_seen_at; the read filters on that stamp, so a board that
// fails simply stops refreshing its rows rather than deleting them.
import { createClient } from '@supabase/supabase-js';

import { BOARDS, boardUrl, parseBoard } from './roles.js';
import { rejectUnauthorisedCron } from './cron-auth.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// One board. Returns rows rather than writing, so the caller decides the transaction and a
// failing board cannot take the others down with it.
export async function fetchBoard(board, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(boardUrl(board.token), { signal: controller.signal });
    if (!res.ok) return { board: board.token, ok: false, reason: `HTTP ${res.status}`, roles: [] };
    const payload = await res.json();
    return { board: board.token, ok: true, roles: parseBoard(payload, board) };
  } catch (error) {
    // A board that times out or changes shape is reported, not thrown. Seven boards means
    // seven chances for somebody else's outage to become our 500.
    return { board: board.token, ok: false, reason: String(error?.message || error).slice(0, 120), roles: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function syncRoles(db, { boards = BOARDS, fetchImpl = fetch, now = () => new Date() } = {}) {
  const results = await Promise.all(boards.map(b => fetchBoard(b, { fetchImpl })));
  const seenAt = now().toISOString();
  const rows = results.flatMap(r => r.roles).map(role => ({
    source: role.source,
    board_token: role.board_token,
    external_id: role.external_id,
    company: role.company,
    title: role.title,
    location: role.location,
    remote: role.remote,
    url: role.url,
    posted_at: role.posted_at,
    description: role.description,
    last_seen_at: seenAt,
  }));

  let written = 0;
  let error = null;
  if (rows.length) {
    const { error: upsertError, count } = await db.from('open_roles')
      .upsert(rows, { onConflict: 'source,external_id', count: 'exact' });
    if (upsertError) error = upsertError.message;
    else written = count ?? rows.length;
  }

  return {
    boards: results.map(r => ({ board: r.board, ok: r.ok, found: r.roles.length, reason: r.reason || null })),
    found: rows.length,
    written,
    error,
    seenAt,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (rejectUnauthorisedCron(req, res)) return;

  const db = serviceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'No service credentials.' });

  try {
    const report = await syncRoles(db);
    // Logged as one structured line so a board quietly returning nothing for a week is
    // visible in the logs rather than looking like a season with no internships.
    console.log(JSON.stringify({ at: 'roles-cron', ...report }));
    return res.status(200).json({ ok: !report.error, ...report });
  } catch (error) {
    console.error(JSON.stringify({ at: 'roles-cron', error: String(error?.message || error) }));
    return res.status(500).json({ ok: false, error: 'Role sync failed.' });
  }
}
