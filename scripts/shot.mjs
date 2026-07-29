// Screenshots a page in a real browser, optionally after running some setup JS.
//
// Exists for the same reason smoke.mjs does, one step further: this build has repeatedly
// "fixed" something visual that was still visibly broken, because the fix was checked by
// reading the CSS instead of by looking at the pixels. Four rounds went into a clipped
// descender that way.
//
//   node scripts/shot.mjs out.png "document.getElementById('x').click()" [--h=1400]
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.SHOT_PORT || 9333);
const BASE = process.env.SHOT_URL || 'http://localhost:3000';
const [out = 'shot.png', setup = ''] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = n => Number((process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1]);
const width = flag('w') || 1440;
const height = flag('h') || 1000;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/covenda-shot-${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--remote-allow-origins=*', '--hide-scrollbars', `--window-size=${width},${height}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(5000);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));

let id = 0;
const pending = new Map();
const problems = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    problems.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  }
};
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `${BASE}/` });
await sleep(2600);
// Every page opens behind the intro overlay, so nothing below it is photographable until
// it is dismissed. Doing it here rather than in every caller.
await send('Runtime.evaluate', { expression: "document.getElementById('introSkip')?.click()" });
await sleep(700);
if (setup) {
  const r = await send('Runtime.evaluate', { expression: setup, awaitPromise: true, returnByValue: true });
  if (r?.exceptionDetails) problems.push('SETUP: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  await sleep(1100);
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const { writeFileSync } = await import('node:fs');
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`wrote ${out}`);
if (problems.length) { console.log('CONSOLE PROBLEMS:'); problems.forEach(p => console.log('  ' + p)); }

ws.close();
chrome.kill();
process.exit(0);
