// Run Covenda anywhere Node runs.
//
// Every file in api/ exports `default async function handler(req, res)`. That is close enough
// to a plain Node handler that Express can call them unmodified — no rewrite, no per-route
// registration, no framework in the handlers themselves. This file is the entire adapter.
//
// Why this exists: hosting was costing $40/month, $20 of which bought a seat rather than
// compute. A server has no seat pricing. api/storage.js already removed the last @vercel/*
// package, so nothing in the application knows or cares where it runs.
//
// ── Handlers are loaded at boot, not on demand ────────────────────────────────────────
// The platform this replaces imported each function lazily, so a broken import surfaced as a
// 500 on the first request that touched it — possibly days later, possibly to a customer. Here
// every handler is imported during startup. A bad import stops the process immediately, which
// is the correct time to find out.
//
// ── Raw bodies ────────────────────────────────────────────────────────────────────────
// Six handlers set `export const config = { api: { bodyParser: false } }` because they read
// uploads or verify a Stripe signature over the exact bytes. That flag is honoured by reading
// the same export, so the list cannot drift out of sync with the handlers.

import express from 'express';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable('x-powered-by');

// Behind Caddy. Without this, req.ip and any protocol check see the proxy rather than the
// caller, which breaks rate limiting by subject and any same-origin test.
app.set('trust proxy', 1);

// ── Load every handler up front ───────────────────────────────────────────────────────
const handlers = new Map();
const rawBody = new Set();

for (const file of readdirSync(join(root, 'api')).filter(f => f.endsWith('.js'))) {
  const name = file.replace(/\.js$/, '');
  const mod = await import(`./api/${file}`);
  // Modules that export helpers but no handler (limits.js, storage.js, evidence.js…) are
  // libraries, not routes. Skipping them keeps the URL space equal to the route space.
  if (typeof mod.default !== 'function') continue;
  handlers.set(name, mod.default);
  if (mod.config?.api?.bodyParser === false) rawBody.add(name);
}
console.log(`[covenda] ${handlers.size} routes, ${rawBody.size} taking a raw body`);

// ── Body parsing, matching what the previous platform did ─────────────────────────────
// It parsed JSON automatically and left req.body undefined when there was none. Express does
// the same with these two, except that it must be skipped for the raw-body routes.
const parseJson = express.json({ limit: '10mb' });
const parseForm = express.urlencoded({ extended: false, limit: '10mb' });

app.use('/api/:name', (req, res, next) => {
  if (rawBody.has(req.params.name)) return next();
  parseJson(req, res, err => (err ? next(err) : parseForm(req, res, next)));
});

// ── The routes ────────────────────────────────────────────────────────────────────────
app.all('/api/:name', async (req, res) => {
  const handler = handlers.get(req.params.name);
  if (!handler) return res.status(404).json({ ok: false, error: 'No such endpoint.' });
  try {
    await handler(req, res);
  } catch (error) {
    // A handler that throws must not take the process with it. Logged with the route so the
    // line is actionable, and answered with the same shape the API uses everywhere else.
    console.error(`[covenda] /api/${req.params.name} threw:`, error);
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Something went wrong on our side.' });
  }
});

// ── Static site ───────────────────────────────────────────────────────────────────────
// index.html is served for "/", and .html is reachable without the extension so existing links
// like /portal.html and /portal both work.
app.use(express.static(root, {
  extensions: ['html'],
  dotfiles: 'ignore',
  setHeaders(res, path) {
    // Hashless asset names mean a long cache would pin users to a stale build. HTML is never
    // cached; everything else gets a short window that a deploy clears within the hour.
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=600');
  },
}));

// Health check for the process supervisor and for uptime monitoring. Deliberately does not
// touch the database: this answers "is the process up", and a health check that fails when
// Supabase blips would restart a perfectly good server.
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, routes: handlers.size }));

app.use((req, res) => res.status(404).send('Not found'));

const server = app.listen(PORT, () => console.log(`[covenda] listening on ${PORT}`));

// Finish in-flight requests before exiting, so a deploy does not cut somebody off mid-upload.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[covenda] ${signal}, draining`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
