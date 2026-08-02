#!/usr/bin/env node
// Preview the site without Vercel in the loop.
//
// `npm run local` runs `vercel dev`, which needs a Vercel login, a linked project, and a
// network round trip before you can look at a CSS change. That is a lot of vendor for
// "did the spacing land". This serves the same files from the same repo over plain Node —
// the static pages work fully, and API routes are served by server.js when it can boot.
//
//   npm run preview                # http://localhost:4000
//   npm run preview -- --port 5000
//   npm run preview -- --no-api    # static only, never tries to load api handlers
//   npm run preview -- --pretty    # allow /portal -> portal.html (production does NOT)
//
// ROUTING PARITY. This served extensionless URLs (/portal -> portal.html) in its first
// version. Production does not: covenda.app/portal is a 404 and covenda.app/portal.html is
// the real page. A preview that is MORE forgiving than production is the wrong way round —
// it lets you build a link that works locally and 404s live, which is the exact failure a
// preview is supposed to catch. So the default now matches production exactly, and the 404
// page names the file you probably meant. --pretty restores the old behaviour if you want
// it, and says so on startup.
//
// It deliberately does NOT mock authenticated state. A page that needs a session shows the
// signed-out view, which is the honest thing to preview.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 4000);
const NO_API = args.includes('--no-api');
const PRETTY = args.includes('--pretty');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Resolve a URL path to a file inside ROOT, or null. Rejects traversal.
export function resolvePath(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0]);
  let rel = normalize(clean).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '');
  if (rel === '' ) rel = 'index.html';
  const full = join(ROOT, rel);
  if (!full.startsWith(ROOT)) return null;      // traversal attempt
  return full;
}

// Production (Vercel static) serves exact filenames only. Parity is the default; --pretty
// opts into extensionless resolution for local convenience.
export function candidatesFor(full, { pretty = false } = {}) {
  if (extname(full)) return [full];
  // A bare directory still resolves to its index.html in production, so that stays.
  const base = [join(full, 'index.html')];
  return pretty ? [`${full}.html`, ...base, full] : base;
}

async function readFirst(paths) {
  for (const p of paths) {
    try {
      const st = await stat(p);
      if (st.isFile()) return { path: p, body: await readFile(p) };
    } catch { /* try next */ }
  }
  return null;
}

// API handlers are loaded lazily and never fatally: a preview that dies because a handler
// wants an env var is worse than a preview with no API.
let apiHandlers = null;
async function loadApi() {
  if (NO_API || apiHandlers) return apiHandlers;
  apiHandlers = new Map();
  try {
    const { readdir } = await import('node:fs/promises');
    for (const file of await readdir(join(ROOT, 'api'))) {
      if (!file.endsWith('.js')) continue;
      const route = `/api/${file.replace(/\.js$/, '')}`;
      try {
        const mod = await import(join(ROOT, 'api', file));
        if (typeof mod.default === 'function') apiHandlers.set(route, mod.default);
      } catch (error) {
        // Loud but not fatal — you still get the pages.
        console.warn(`  api ${route} unavailable: ${error.message.split('\n')[0]}`);
      }
    }
  } catch { /* no api dir */ }
  return apiHandlers;
}

const server = createServer(async (req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/api/')) {
    const handlers = await loadApi();
    const route = url.split('?')[0].replace(/\/$/, '');
    const handler = handlers && handlers.get(route);
    if (!handler) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        error: NO_API ? 'API disabled (--no-api)' : 'Handler not loaded in preview',
        hint: 'Static preview only. Run `npm run serve` for the full Express host.',
      }));
      return;
    }
    try {
      await handler(req, res);
      if (!res.writableEnded) res.end();
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const full = resolvePath(url);
  if (!full) { res.writeHead(403); res.end('Forbidden'); return; }
  const found = await readFirst(candidatesFor(full, { pretty: PRETTY }));
  if (!found) {
    // Name the file they probably meant. This 404 is the point of the parity default:
    // seeing it here is the whole reason it does not surprise you on covenda.app.
    const guess = !extname(full) ? `${url.split('?')[0].replace(/\/$/, '')}.html` : null;
    const hint = guess
      ? `\nProduction serves exact filenames. Did you mean ${guess} ?`
        + `\n(covenda.app/portal is a 404; covenda.app/portal.html is the page.)`
        + `\n\nRun with --pretty to resolve extensionless URLs locally.`
      : '';
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<pre>404 — ${url}${hint}\n\nServing from ${ROOT}</pre>`);
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(found.path)] || 'application/octet-stream',
    'cache-control': 'no-store', // previewing means you want the edit you just made
  });
  res.end(found.body);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => {
    console.log(`\n  Covenda preview — no Vercel in the loop`);
    console.log(`  http://localhost:${PORT}\n`);
    console.log(`  /                 the marketing site`);
    console.log(`  /portal.html      the member portal (signed-out view)`);
    console.log(`  /admin.html       the operator console\n`);
    console.log(PRETTY
      ? '  --pretty: /portal resolves to portal.html. PRODUCTION DOES NOT DO THIS.\n'
      : '  Routing matches production: exact filenames only.\n');
    if (NO_API) console.log('  API disabled (--no-api). Static files only.\n');
    else console.log('  API routes load lazily; failures warn and do not stop the server.\n');
  });
  process.on('SIGINT', () => { server.close(); process.exit(0); });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

export { server };
