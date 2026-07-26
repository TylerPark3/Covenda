import { connectorDirectory } from './connectors.js';

// Public, honest map of how Covenda verifies proof per vertical — INCLUDING where API proof
// cannot reach. This is the "honest-limits routing" surface: sales and biotech are marked
// non-verifiable and routed to a human rail, on purpose. No secrets/scopes/terms leak (the
// directory view is already sanitized in connectors.js). Cached; never errors the caller.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  try {
    const methods = connectorDirectory();
    const verifiable = methods.filter(m => m.verifiable);
    const human_rail = methods.filter(m => m.rail);
    return res.status(200).json({ ok: true, methods, summary: { verifiable: verifiable.length, human_rail: human_rail.length } });
  } catch {
    return res.status(200).json({ ok: true, methods: [], summary: { verifiable: 0, human_rail: 0 } });
  }
}
