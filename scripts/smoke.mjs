// Drives the real pages through their real interactions and reports anything the console says.
//
// This exists because of a bug 1168 tests could not catch. `total is not defined` was a
// ReferenceError in a top-level call: node --check passed, new Function(source) passed, every
// unit test passed, and the page rendered with its intro screen, particle field and scroll
// reveal all silently missing, because a ReferenceError aborts the rest of the file.
//
// Nothing short of running the page in a browser and reading the console finds that. Run it
// against a local server:  npm run local  (in another shell), then  npm run smoke
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const BASE = process.env.SMOKE_URL || 'http://localhost:3000';
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/covenda-probe', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(6000);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));

let id = 0;
const pending = new Map();
const problems = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    problems.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    problems.push(m.params.type.toUpperCase() + ': ' + (m.params.args[0]?.value ?? '').toString().slice(0, 120));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    // Vercel injects its analytics script in production only, so it 404s against a dev
    // server. Ignoring it here keeps a real failure visible instead of buried in noise.
    if ((m.params.entry.url || '').includes('/_vercel/insights')) return;
    problems.push('LOG: ' + m.params.entry.text.slice(0, 120));
  }
};
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = expression => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

const steps = [
  ['load home', `location.href='${BASE}/'`],
  ['skip intro', "document.getElementById('introSkip')?.click()"],
  ['audience: student', "document.querySelector('[data-audience-option=\"student\"]')?.click()"],
  ['pick an industry', "document.querySelector('.student-vertical')?.click()"],
  ['pick a specialty', "document.querySelector('.student-specialty')?.click()"],
  ['audience: company', "document.querySelector('[data-audience-option=\"company\"]')?.click()"],
  ['audience: referrals', "document.querySelector('[data-audience-option=\"university\"]')?.click()"],
  ['open roster builder', "document.querySelector('[data-action=\"roster-open\"]')?.click()"],
  ['close roster', "document.getElementById('rosterDialog')?.close()"],
  ['exchange next', "document.querySelector('.exchange-controls button:last-child')?.click()"],
];

for (const [label, js] of steps) {
  const before = problems.length;
  await evaluate(js);
  await sleep(label === 'load home' ? 3000 : 700);
  const found = problems.slice(before);
  console.log((found.length ? '  FAIL ' : '  ok   ') + label + (found.length ? '\n         ' + found.join('\n         ') : ''));
}

ws.close(); chrome.kill();
console.log('\ntotal problems:', problems.length);
process.exit(problems.length ? 1 : 0);
