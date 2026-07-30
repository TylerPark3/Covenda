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
import { rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const BASE = process.env.SMOKE_URL || 'http://localhost:3000';
// A fresh profile every run. Reusing one let a previous run's saved form values reappear in a
// later run, which turned an assertion about an empty form into an assertion about leftover
// browser state, and made the results depend on run order.
const PROFILE = '/tmp/covenda-probe';
rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--disable-features=AutofillServerCommunication', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--window-size=1600,900', 'about:blank',
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

  // The sign-up flow, walked the way a person walks it. Console silence is not enough here:
  // the form can advance a step and still be wrong, so each step asserts where it ended up.
  //
  // This section exists because clicking Continue used to CLOSE the dialog. The backdrop check
  // compared pointer coordinates to the dialog's box, and a keyboard-activated click reports
  // 0,0, which read as outside. Every unit test passed and the console said nothing.
  // Through openDialog, not showModal: that is the path a real click takes, and it is what
  // restores the draft and initialises the step. Calling showModal directly left dataset.step
  // unset and made the next assertion test the harness instead of the form.
  // The draft is cleared first. Chrome reuses its profile between runs, so a previous run's
  // draft made the form resume on step 3 -- correct behaviour, but it turned the walk below
  // into a test of leftover state.
  ['open sign-up', `(() => {
    localStorage.removeItem(draftKeys.studentForm);
    openDialog(studentDialog, studentForm);
    if (!studentDialog.open) return 'the dialog did not open';
    return studentForm.dataset.step === '0' ? true : 'opened on step ' + studentForm.dataset.step;
  })()`],
  ['timezone arrives pre-filled', `(() => {
    const chosen = document.querySelector('#studentForm [name="studentTimezone"]:checked');
    return chosen ? true : 'no timezone was derived from the device';
  })()`],
  ['step 1 refuses to advance while empty', `(() => {
    const f = document.getElementById('studentForm');
    // Reset to the HTML defaults so this tests the validation and not whatever the browser or a
    // stored draft happened to leave behind.
    f.reset();
    const before = [...f.querySelector('.form-step.is-active').querySelectorAll('input,select,textarea')]
      .map(x => x.name + '=' + JSON.stringify(x.value)).join(' ');
    f.querySelector('[data-form-next]').click();
    const step = f.dataset.step;
    return step === '0' ? true : 'an empty step 1 advanced to ' + step + ' | fields were: ' + before;
  })()`],
  ['step 1 -> 2', `(() => {
    const f = document.getElementById('studentForm');
    const set = (n, v) => { f.querySelector('[name="' + n + '"]').value = v; };
    set('studentName', 'Smoke Test'); set('studentEmail', 'smoke@example.edu');
    set('studentSchool', 'Test University'); set('studentMajor', 'Finance');
    const year = f.querySelector('[name="studentGraduation"]');
    year.value = '2029';
    year.dispatchEvent(new Event('change', { bubbles: true }));
    // The education chip should now be set from the graduation year rather than by hand.
    if (!f.querySelector('[name="studentEducation"]:checked')) return 'education was not derived';
    f.querySelector('[data-form-next]').click();
    return f.dataset.step === '1' ? true : 'stuck on step ' + f.dataset.step;
  })()`],
  ['a missing chip group names itself', `(() => {
    const f = document.getElementById('studentForm');
    f.querySelector('[name="studentSkill"]').value = 'Financial modelling';
    f.querySelectorAll('[name="studentIndustry"]')[0].checked = true;
    f.querySelector('[data-form-next]').click();
    const msg = document.getElementById('studentFormMessage').textContent;
    if (f.dataset.step !== '1') return 'advanced without the level chip';
    return /honest current level/i.test(msg) ? true : 'unhelpful message: ' + JSON.stringify(msg);
  })()`],
  ['step 2 -> 3', `(() => {
    const f = document.getElementById('studentForm');
    const chip = f.querySelector('[name="studentSkillLevel"][value="Can work independently"]');
    chip.checked = true;
    chip.dispatchEvent(new Event('change', { bubbles: true }));
    // Picking the answer must clear the error, not leave it arguing with the student.
    if (document.getElementById('studentFormMessage').textContent) return 'the error message survived the answer';
    f.querySelector('[data-form-next]').click();
    return f.dataset.step === '2' ? true : 'stuck on step ' + f.dataset.step;
  })()`],
  ['step 3 -> review, and the dialog is still open', `(() => {
    const f = document.getElementById('studentForm');
    for (const [name, value] of [
      ['studentWorkStyle', 'Independent with clear checkpoints'],
      ['studentAmbiguity', 'I ask focused questions before starting'],
      ['studentAvailability', 'Within 30 days'], ['studentHours', '6–10 hours'],
      ['studentDuration', 'Two weeks'], ['studentCompensation', '$300+'],
      ['studentScreening', 'Yes'], ['studentPriority', 'Paid work and employer feedback'],
      // Set by hand here rather than relying on the derived value: the reset above cleared it,
      // and a walk that depends on the prefill would stop covering the manual path.
      ['studentTimezone', 'Eastern'],
    ]) {
      const el = f.querySelector('[name="' + name + '"][value="' + value + '"]');
      if (!el) return 'no chip for ' + name + ' = ' + value;
      el.checked = true;
    }
    f.querySelector('[name="studentMeetings"]').value = 'Weekday evenings';
    f.querySelector('[name="studentAge"]').checked = true;
    f.querySelector('[name="studentConsent"]').checked = true;
    f.querySelector('[data-form-next]').click();
    if (f.dataset.step !== '3') return 'stuck on step ' + f.dataset.step;
    if (!document.getElementById('studentDialog').open) return 'the dialog closed on Continue';
    return true;
  })()`],
  ['the review lists what was entered', `(() => {
    const text = document.getElementById('studentReviewSummary').textContent;
    for (const expected of ['Smoke Test', 'Financial modelling', 'Within 30 days']) {
      if (!text.includes(expected)) return 'the review omits ' + expected;
    }
    return true;
  })()`],
  ['a draft round-trip keeps the chips, not the last answer', `(() => {
    const f = document.getElementById('studentForm');
    const before = new FormData(f).get('studentHours');
    saveDraft(f);
    // Every chip group cleared, then restored from the draft. Before radios were handled,
    // applyFormValues overwrote each radio's own value attribute and this came back wrong.
    f.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
    applyFormValues(f, readStorage(draftKeys.studentForm, {}).values || {});
    const after = new FormData(f).get('studentHours');
    if (after !== before) return 'hours came back as ' + after + ' instead of ' + before;
    const tz = new FormData(f).get('studentTimezone');
    return tz ? true : 'the timezone chip did not survive the round-trip';
  })()`],
  ['close sign-up', "document.getElementById('studentDialog').close()"],

  // No unit test can see text wrapping, and this is how the type conversion went wrong: card
  // titles were bucketed by their old max size into the heading role, so "Talent vouched for by
  // people who know them" set at up to 40px in a 200px column and wrapped to six lines,
  // dwarfing the panel it pointed at. Four lines in a heading means the wrong role.
  // Clicking a step must swap the panel beside it, and must not touch the product-lens buttons
  // further up the page: those already owned data-proof-step, and an unscoped query collected
  // all seven controls into one tablist.
  ['proof rail: each step shows its own panel', `(() => {
    document.querySelector('[data-audience-option="student"]')?.click();
    const tabs = [...document.querySelectorAll('.proof-rail[role="tablist"] [data-rail-step]')];
    if (tabs.length !== 3) return 'found ' + tabs.length + ' rail tabs';
    for (const tab of tabs) {
      tab.click();
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (!panel) return 'no panel for ' + tab.id;
      if (panel.hidden) return tab.id + ' did not reveal its panel';
      const others = tabs.filter(t => t !== tab)
        .map(t => document.getElementById(t.getAttribute('aria-controls')))
        .filter(p => p && !p.hidden);
      if (others.length) return others.length + ' other panels stayed open';
      if (tab.getAttribute('aria-selected') !== 'true') return tab.id + ' is not marked selected';
      if (!tab.closest('li').classList.contains('is-current')) return tab.id + ' step is not marked current';
    }
    return true;
  })()`],
  ['proof rail: arrows move between steps', `(() => {
    const tabs = [...document.querySelectorAll('.proof-rail[role="tablist"] [data-rail-step]')];
    tabs[0].click(); tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    if (document.activeElement !== tabs[1]) return 'ArrowRight did not move focus';
    if (tabs[1].getAttribute('aria-selected') !== 'true') return 'ArrowRight did not select';
    // Only the selected tab is in the tab order, so Tab leaves the group instead of walking it.
    if (tabs[0].tabIndex !== -1 || tabs[1].tabIndex !== 0) return 'the roving tabindex is wrong';
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    if (document.activeElement !== tabs[2]) return 'End did not reach the last step';
    return true;
  })()`],
  ['the product lens still owns its own buttons', `(() => {
    const lens = [...document.querySelectorAll('.proof-product-step[data-proof-step]')];
    if (lens.length !== 4) return 'found ' + lens.length + ' product-lens buttons';
    for (const b of lens) {
      if (b.hasAttribute('aria-selected')) return 'the rail tablist set aria-selected on a lens button';
      if (!b.hasAttribute('aria-pressed')) return 'a lens button lost aria-pressed';
    }
    return true;
  })()`],

  ['no heading wraps past three lines', `(() => {
    const bad = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4')) {
      if (el.offsetParent === null) continue;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const lines = Math.round(el.getBoundingClientRect().height / lh);
      if (lines >= 4) bad.push(Math.round(parseFloat(cs.fontSize)) + 'px x' + lines + ' "' + el.textContent.trim().slice(0, 34) + '"');
    }
    return bad.length ? bad.join(' | ') : true;
  })()`],

  // Same layout, and the one safety check that a radio group could have silently broken.
  ['company form: production access is still blocked', `(() => {
    document.getElementById('companyDialog').showModal();
    const f = document.getElementById('companyForm');
    const prod = f.querySelector('[name="companyAccess"][value="production"]');
    prod.checked = true;
    prod.dispatchEvent(new Event('change', { bubbles: true }));
    const panel = document.getElementById('companyBoundaryGuidance');
    if (!panel.classList.contains('is-blocked')) return 'production access did not raise a blocker';
    if (!prod.closest('label').classList.contains('is-blocked')) return 'the blocked chip is not marked';
    const none = f.querySelector('[name="companyAccess"][value="none"]');
    none.checked = true;
    none.dispatchEvent(new Event('change', { bubbles: true }));
    if (panel.classList.contains('is-blocked')) return 'the blocker survived going back to approved copies';
    document.getElementById('companyDialog').close();
    return true;
  })()`],
];

for (const [label, js] of steps) {
  const before = problems.length;
  const result = await evaluate(js);
  await sleep(label === 'load home' ? 3000 : 700);
  // A step can leave the console clean and still be wrong, so a step that returns a string
  // reports that string as the failure. Anything else is judged on console output alone.
  // A step opts into assertions by being an IIFE that returns true or an explanation. Plain
  // action steps (a click, a navigation) return whatever they return and are judged on the
  // console alone -- `location.href='...'` evaluates to the URL, not to a failure.
  const asserting = js.trimStart().startsWith('(() =>');
  const returned = result?.result?.value;
  if (asserting && returned !== true) problems.push(`${label}: ${returned ?? 'returned nothing'}`);
  const found = problems.slice(before);
  console.log((found.length ? '  FAIL ' : '  ok   ') + label + (found.length ? '\n         ' + found.join('\n         ') : ''));
}

ws.close(); chrome.kill();
console.log('\ntotal problems:', problems.length);
process.exit(problems.length ? 1 : 0);
