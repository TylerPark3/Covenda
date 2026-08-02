// Truthiness is the wrong test for "is this a list". An object where an array belongs is truthy,
// so `x||[]` hands it straight to for-of, which throws — and because the render is one
// uninterrupted pass, that throw takes the whole page with it, not just the one section. This
// crashed the portal on t.unprompted, which was never a list at all — see agency-section. Shape
// is what matters, so the check is on shape. Real iterables (Set, Map) pass through untouched; everything else becomes
// an empty list and the section simply renders nothing.
function asList(value){
  if(Array.isArray(value))return value;
  if(value&&typeof value!=='string'&&typeof value[Symbol.iterator]==='function')return value;
  return [];
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOKEN_KEY = 'covendaAdminAccessToken';
const statusLabels = { received:'Received', reviewing:'In human review', needs_information:'Needs information', packet_proposed:'Packet proposed', approval_pending:'Approval pending', approved:'Approved', declined:'Closed', archived:'Archived' };
const typeLabels = { student_interest:'Student', employer_intake:'Company', university_partner:'University', call_request:'Call request' };
let submissions = [];
let requests = [];
let batches = [];
let companies = [];
let members = [];
let projects = [];
let appeals=[];
const batchTierLabels = { open:'Open', elite:'Elite' };
const batchStatusLabels = { draft:'Draft', open:'Open', reviewing:'Reviewing', closed:'Closed', archived:'Archived' };
const batchAppStatusLabels = { submitted:'Applied', reviewing:'In review', accepted:'Accepted', waitlisted:'Waitlisted', declined:'Declined' };
const requestTypeLabels = { new_project:'New project', more_students:'More students', scope_change:'Scope change', revision:'Revision', consult:'Consult', question:'Question', specific_student:'Specific student' };
const requestStatusLabels = { submitted:'Submitted', in_packaging:'Being packaged', packaged:'Packaged', declined:'Declined', closed:'Closed' };
let selectedReference = '';
let activeType = 'all';
const attentionOrder = { needs_information:0, received:1, reviewing:2, approval_pending:3, packet_proposed:4, approved:5, declined:6, archived:7 };

function icon(id) { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); const use = document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href','#'+id); svg.append(use); return svg; }
function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
function setMessage(text, error = false) { const message = $('#adminLoginMessage'); message.textContent = text; message.classList.toggle('is-error', error); }
function textValue(value) { if (value === null || value === undefined || value === '') return '—'; if (Array.isArray(value)) return value.map(textValue).join(', '); if (typeof value === 'boolean') return value ? 'Yes' : 'No'; if (typeof value === 'object') return Object.entries(value).map(([key,val]) => `${labelize(key)}: ${textValue(val)}`).join(' · '); return String(value); }
function labelize(value) { return String(value).replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./, char => char.toUpperCase()); }
function dateLabel(value, full = false) { const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; return date.toLocaleString([], full ? { dateStyle:'medium', timeStyle:'short' } : { month:'short', day:'numeric' }); }
function localDateTimeValue(value) { const date = new Date(value); if (!value || Number.isNaN(date.getTime())) return ''; return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0,16); }
// Private-store media. A blob URL on the private store 403s if opened directly, so a reviewer
// link has to exchange it for a short-lived signed URL at click time.
function isPrivateMedia(url){ return /\.private\.blob\.vercel-storage\.com\//.test(String(url||''))||/^(video-intros|exercise-recordings|project-files)\//.test(String(url||'')); }
function bindPrivateLink(anchor, url) {
  if (!isPrivateMedia(url)) return anchor;
  anchor.href = '#';
  anchor.addEventListener('click', async event => {
    event.preventDefault();
    const was = anchor.textContent;
    anchor.textContent = 'Opening…';
    try {
      const res = await fetch('/api/media', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url }) });
      const body = await res.json().catch(() => ({}));
      anchor.textContent = was;
      if (body.ok && body.url) window.open(body.url, '_blank', 'noopener');
      else anchor.insertAdjacentText('afterend', ' — could not open');
    } catch { anchor.textContent = was; anchor.insertAdjacentText('afterend', ' — could not open'); }
  });
  return anchor;
}

function authHeaders() { return { Authorization: `Bearer ${token()}`, 'Content-Type':'application/json' }; }


// Delivery health. The failure this exists for is silence: with no RESEND_API_KEY every
// notification returns not-configured and the product behaves normally, so the first anyone
// learns of it is a company saying they never heard back.

// Completed simulation runs, for review.
//
// The rater reads decisions in order, each with what that choice was authored to reveal. The
// reveal text was written when the scenario was designed, not invented while reading a
// transcript, which is what stops two raters inventing two different standards.

// Who is actually on the platform, grouped by vertical.
//
// The submissions table has one row per click, so reading it as a list of people gives a wrong
// count and a wrong picture. This reads the people_directory view instead: one row per email,
// with every vertical that person has expressed across every form they filled in.
// ── The review queue ──────────────────────────────────────────────────────────────────
// Where a human decides what the evidence is worth. Nothing else in the system does, and this
// is deliberately the only place it happens.
//
// A reviewer places a BAND and writes why. Never a number: a score here would eventually be
// averaged with a score somewhere else, and the composite that produces is the thing the whole
// design refuses.
let reviewData = null;

// ── Outcome worklist ──────────────────────────────────────────────────────────────────
// placement_outcomes has existed since 20260729100000 and api/admin.js has had a
// `record-outcome` action almost as long. Nothing has ever called it, so the table is empty and
// every system downstream of it — compatibility calibration, hiring memory, the ML export —
// reads from a table nothing writes to.
//
// An accepted introduction with no recorded outcome is not a neutral gap. It is a student who
// agreed to be contacted and a company that may have gone quiet, and nobody finds out unless
// somebody looks. Oldest first: the ones most likely to have been forgotten are the ones most
// worth chasing.
const OUTCOME_RESULTS = [
  ['interviewed', 'They spoke'],
  ['no_response', 'No response'],
  ['no_fit', 'Not a fit'],
  ['project', 'Project started'],
  ['trial', 'Paid trial started'],
  ['hired', 'Hired'],
  ['withdrawn', 'Student withdrew'],
];

async function renderOutcomeWorklist() {
  const host = document.getElementById('adminOutcomes');
  if (!host) return;
  let data;
  try {
    data = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'outcome-worklist' }) });
  } catch (error) {
    host.hidden = false;
    host.replaceChildren();
    const box = document.createElement('div');
    box.className = 'people-error';
    const cap = document.createElement('strong');
    cap.textContent = 'The outcome worklist could not load';
    const why = document.createElement('p');
    why.textContent = error.message || 'Try refreshing.';
    box.append(cap, why);
    host.append(box);
    return;
  }

  host.hidden = false;
  host.replaceChildren();

  const head = document.createElement('div');
  head.className = 'people-head';
  const h = document.createElement('h3');
  h.textContent = 'Outcomes to record';
  const count = document.createElement('span');
  const outstanding = data.outstanding || [];
  // Reported even when it is bad. The ratio only becomes useful once somebody has to look at it.
  count.textContent = `${data.recorded || 0} of ${data.accepted || 0} accepted introductions closed out`;
  head.append(h, count);
  host.append(head);

  if (!outstanding.length) {
    const p = document.createElement('p');
    p.className = 'people-empty';
    p.textContent = data.accepted
      ? 'Every accepted introduction has an outcome recorded.'
      : 'No accepted introductions yet.';
    host.append(p);
    return;
  }

  for (const item of outstanding) host.append(outcomeRow(item));
}

function outcomeRow(item) {
  const row = document.createElement('article');
  row.className = 'outcome-row';

  const main = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.roleSummary || 'Introduction';
  const meta = document.createElement('p');
  meta.className = 'outcome-meta';
  // Days waiting is the whole point of the queue, so it leads.
  meta.textContent = `${item.daysWaiting} day${item.daysWaiting === 1 ? '' : 's'} since accepted`;
  if (item.daysWaiting >= 14) row.classList.add('is-stale');
  main.append(title, meta);

  const form = document.createElement('div');
  form.className = 'outcome-form';

  const select = document.createElement('select');
  select.className = 'outcome-result';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'What happened?';
  select.append(placeholder);
  for (const [value, label] of OUTCOME_RESULTS) {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    select.append(opt);
  }

  const again = document.createElement('label');
  again.className = 'outcome-again';
  const box = document.createElement('input');
  box.type = 'checkbox';
  const againText = document.createElement('span');
  againText.textContent = 'Would work together again';
  again.append(box, againText);

  const note = document.createElement('input');
  note.type = 'text';
  note.className = 'outcome-note';
  note.placeholder = 'Anything worth remembering (optional)';
  note.maxLength = 2000;

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'outcome-save';
  save.textContent = 'Record';

  const status = document.createElement('p');
  status.className = 'outcome-status';
  status.setAttribute('aria-live', 'polite');

  // Only "what happened" is required. Asking a founder for days-to-contribution and senior-hours
  // they never measured produces invented numbers, which is worse than absent ones for a product
  // whose whole claim is evidence quality.
  save.addEventListener('click', async () => {
    if (!select.value) { status.textContent = 'Pick what happened first.'; select.focus(); return; }
    save.disabled = true;
    status.textContent = 'Recording…';
    try {
      await adminRequest({ method: 'POST', body: JSON.stringify({
        action: 'record-outcome',
        introductionId: item.introductionId,
        studentUserId: item.studentUserId,
        companyUserId: item.companyUserId,
        result: select.value,
        wouldContinue: box.checked,
        note: note.value,
      }) });
      await renderOutcomeWorklist();
    } catch (error) {
      save.disabled = false;
      status.textContent = error.message || 'Could not record that outcome.';
    }
  });

  form.append(select, again, note, save);
  row.append(main, form, status);
  return row;
}

async function renderReviewQueue() {
  const host = document.getElementById('adminReview');
  if (!host) return;
  try {
    reviewData = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'assessment-queue' }) });
  } catch (error) {
    host.hidden = false;
    host.replaceChildren();
    const box = document.createElement('div');
    box.className = 'people-error';
    const cap = document.createElement('strong');
    cap.textContent = 'The review queue could not load';
    const why = document.createElement('p');
    why.textContent = error?.message || 'The request failed.';
    box.append(cap, why);
    host.append(box);
    return;
  }

  host.hidden = false;
  host.replaceChildren();

  const head = document.createElement('div');
  head.className = 'people-head';
  const h = document.createElement('h3');
  h.textContent = reviewData.awaiting ? `${reviewData.awaiting} awaiting review` : 'Nothing awaiting review';
  const note = document.createElement('span');
  note.textContent = 'A band and a reason. No scores, and nothing here is decided automatically.';
  head.append(h, note);
  host.append(head);

  // Shown above the queue, because a process leaning on a proxy is a problem with every
  // judgement below it rather than with any one of them.
  const proxies = reviewData.proxies;
  if (proxies && !proxies.clean) {
    const warn = document.createElement('div');
    warn.className = 'review-proxies';
    const cap = document.createElement('strong');
    cap.textContent = 'Signals that can stand in for a protected characteristic';
    warn.append(cap);
    const list = document.createElement('ul');
    for (const flag of asList(proxies.flagged)) {
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = flag.signal;
      const why = document.createElement('span');
      why.textContent = `proxy for ${flag.proxyFor}`;
      li.append(name, why);
      list.append(li);
    }
    warn.append(list);
    const note = document.createElement('p');
    // Deliberately not a verdict: adverse impact is measured against outcomes, and there are none.
    note.textContent = proxies.note;
    warn.append(note);
    host.append(warn);
  }

  if (!(reviewData.queue || []).length) {
    const none = document.createElement('p');
    none.className = 'evreq-none';
    none.textContent = 'No sittings yet. They appear here as students submit them.';
    host.append(none);
    return;
  }

  for (const run of asList(reviewData.queue)) {
    host.append(reviewRunCard(run));
  }
}

function reviewRunCard(run) {
  const card = document.createElement('article');
  card.className = 'review-run' + (run.complete ? ' is-done' : '');

  const top = document.createElement('div');
  top.className = 'review-run-top';
  const who = document.createElement('b');
  who.textContent = [run.vertical, run.autonomy && run.autonomy.replace(/_/g, ' ')].filter(Boolean).join(' · ') || 'Sitting';
  const state = document.createElement('span');
  state.className = 'review-state';
  state.textContent = run.complete ? 'Reviewed' : `${run.awaiting.length} to judge`;
  top.append(who, state);
  card.append(top);

  for (const component of asList(run.components)) {
    const observation = (run.observations || {})[component.id] || {};
    // Only what the student has actually answered. A component they have not reached is not
    // work for a reviewer.
    if (!observation.answer) continue;
    card.append(reviewComponent(run, component, observation));
  }
  return card;
}

// Which vocabulary this component is judged in. A blocker account is placed in agency bands, a
// verification test in AI bands; offering all of them everywhere is how a reviewer picks the
// wrong one.
function bandsForComponent(componentId) {
  const bands = reviewData?.bands || {};
  if (componentId === 'blocker') return bands.agency || [];
  if (componentId === 'verification') return bands.ai || [];
  if (componentId === 'take_home') return bands.takeHome || [];
  return [];
}

function reviewComponent(run, component, observation) {
  const wrap = document.createElement('div');
  wrap.className = 'review-comp' + (observation.band ? ' is-judged' : '');

  const label = document.createElement('b');
  label.textContent = component.label;
  wrap.append(label);

  const answer = document.createElement('p');
  answer.className = 'review-answer';
  answer.textContent = observation.answer;
  wrap.append(answer);

  if (observation.band) {
    const done = document.createElement('p');
    done.className = 'review-placed';
    done.textContent = `${observation.band} · ${observation.reviewer || 'operator'}`;
    const why = document.createElement('small');
    why.textContent = observation.note || '';
    done.append(document.createElement('br'), why);
    wrap.append(done);
    return wrap;
  }

  const bands = bandsForComponent(component.id);
  if (!bands.length) {
    // Not every component has a band vocabulary. Saying so beats offering an empty control.
    const none = document.createElement('p');
    none.className = 'review-nobands';
    none.textContent = 'Read alongside the rest of the sitting. No band for this one.';
    wrap.append(none);
    return wrap;
  }

  const choices = document.createElement('div');
  choices.className = 'review-bands';
  let chosen = null;
  for (const band of bands) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'review-band';
    const name = document.createElement('b');
    name.textContent = band.label;
    const reads = document.createElement('small');
    reads.textContent = band.reads;
    b.append(name, reads);
    b.addEventListener('click', () => {
      chosen = band.id;
      [...choices.children].forEach(c => c.classList.toggle('is-on', c === b));
    });
    choices.append(b);
  }
  wrap.append(choices);

  const why = document.createElement('textarea');
  why.className = 'review-why';
  why.rows = 2;
  why.placeholder = 'Why this band. One sentence is enough, and it is what stops two reviewers drifting apart.';
  wrap.append(why);

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'admin-primary compact';
  save.textContent = 'Record';
  save.addEventListener('click', async () => {
    if (!chosen) { save.textContent = 'Pick a band first'; return; }
    save.disabled = true;
    try {
      await adminRequest({ method: 'POST', body: JSON.stringify({
        action: 'record-observation', runId: run.id, componentId: component.id, band: chosen, note: why.value,
      }) });
      await renderReviewQueue();
    } catch (error) {
      save.disabled = false;
      save.textContent = error.message || 'Could not record';
    }
  });
  wrap.append(save);
  return wrap;
}

// Which migrations have landed. Sits above the directory because a missing table is the most
// common reason anything below it looks broken, and an operator should see the cause before
// the symptom.
async function renderSchemaHealth() {
  const host = document.getElementById('adminSchema');
  if (!host) return;
  let data;
  try {
    data = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'schema-health' }) });
  } catch (error) {
    host.hidden = false;
    host.replaceChildren();
    const box = document.createElement('div');
    box.className = 'people-error';
    const cap = document.createElement('strong');
    cap.textContent = 'Could not check the schema';
    const why = document.createElement('p');
    why.textContent = error?.message || 'The request failed.';
    box.append(cap, why);
    host.append(box);
    return;
  }

  host.hidden = false;
  host.replaceChildren();

  const head = document.createElement('div');
  head.className = 'people-head';
  const h = document.createElement('h3');
  h.textContent = data.healthy ? 'Schema up to date' : 'Migrations outstanding';
  const note = document.createElement('span');
  note.textContent = data.summary;
  head.append(h, note);
  host.append(head);

  // Only the missing ones are listed by default. A list of everything that works is noise
  // when the question is what does not.
  const missing = (data.tables || []).filter(t => t.missing);
  if (missing.length) {
    const list = document.createElement('ul');
    list.className = 'schema-missing';
    for (const t of missing) {
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = t.table;
      const breaks = document.createElement('span');
      breaks.textContent = t.breaks;
      const mig = document.createElement('code');
      mig.textContent = t.migration;
      li.append(name, breaks, mig);
      list.append(li);
    }
    host.append(list);
  }

  // A permission or connection error is not a missing table, and treating them the same sends
  // somebody to re-run a migration that already landed.
  const errored = (data.tables || []).filter(t => t.error);
  for (const t of errored) {
    const p = document.createElement('p');
    p.className = 'schema-error';
    p.textContent = `${t.table}: ${t.error}`;
    host.append(p);
  }
}

async function renderPeopleDirectory() {
  const host = document.getElementById('adminPeople');
  if (!host) return;
  let data;
  try {
    data = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'people-directory' }) });
  } catch (error) {
    // Hiding the panel on failure is why this read as "the admin is broken": no directory, no
    // error, nothing to click. An operator cannot fix what the page will not tell them.
    host.replaceChildren();
    host.hidden = false;
    const box = document.createElement('div');
    box.className = 'people-error';
    const cap = document.createElement('strong');
    cap.textContent = 'The people directory could not load';
    const why = document.createElement('p');
    why.textContent = error?.message || 'The request failed.';
    box.append(cap, why);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'ghost compact';
    retry.textContent = 'Try again';
    retry.addEventListener('click', renderPeopleDirectory);
    box.append(retry);
    host.append(box);
    return;
  }
  if (!data || !data.groups) { host.hidden = true; return; }

  host.replaceChildren();
  host.hidden = false;

  const head = document.createElement('div');
  head.className = 'people-head';
  const h = document.createElement('h3');
  h.textContent = `${data.total} ${data.total === 1 ? 'person' : 'people'}`;
  const note = document.createElement('span');
  // Both numbers, because the gap between them is the thing that was confusing.
  note.textContent = `${data.submissions} submissions · one row per person here, not per click`;
  head.append(h, note);
  host.append(head);

  // Same name, different emails. Surfaced, never merged: two real people do share names.
  if (data.duplicates?.length) {
    const warn = document.createElement('div');
    warn.className = 'people-dupes';
    const cap = document.createElement('strong');
    cap.textContent = `${data.duplicates.length} possible duplicate${data.duplicates.length === 1 ? '' : 's'}`;
    const why = document.createElement('p');
    why.textContent = 'Same name, different email addresses. Nothing is merged automatically, because two real people do share a name.';
    warn.append(cap, why);
    data.duplicates.forEach(d => {
      const row = document.createElement('p');
      row.className = 'people-dupe';
      row.textContent = `${d.name} — ${(d.emails || []).join(' · ')}`;
      warn.append(row);
    });
    host.append(warn);
  }

  data.groups.forEach(group => {
    const section = document.createElement('div');
    section.className = 'people-group' + (group.vertical === 'Not stated' ? ' is-unstated' : '');
    const gh = document.createElement('div');
    gh.className = 'people-group-head';
    const name = document.createElement('strong');
    name.textContent = group.vertical;
    const count = document.createElement('span');
    count.textContent = group.count;
    gh.append(name, count);
    section.append(gh);

    // Rows need their own container so they can lay out as a grid without the group heading
    // becoming a grid item alongside them.
    const rows = document.createElement('div');
    rows.className = 'person-rows';

    group.members.forEach(person => {
      const row = document.createElement('div');
      row.className = 'person-row';
      const who = document.createElement('div');
      const nm = document.createElement('strong');
      nm.textContent = person.name || person.email;
      const meta = document.createElement('span');
      meta.textContent = [person.organisation, person.email].filter(Boolean).join(' · ');
      who.append(nm, meta);
      row.append(who);

      if (person.latest_interest) {
        const interest = document.createElement('span');
        interest.className = 'person-interest';
        interest.textContent = person.latest_interest;
        row.append(interest);
      }
      // Shown because more than one means they came back, which is worth noticing.
      if (Number(person.submissions) > 1) {
        const n = document.createElement('span');
        n.className = 'person-count';
        n.textContent = `${person.submissions}×`;
        n.title = 'Submitted more than once';
        row.append(n);
      }
      rows.append(row);
    });
    section.append(rows);
    host.append(section);
  });
}

async function renderSimulationRuns() {
  const host = document.getElementById('adminSims');
  if (!host) return;
  let runs;
  try {
    const result = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'simulation-runs' }) });
    runs = result.runs || [];
  } catch { host.hidden = true; return; }
  if (!runs.length) { host.hidden = true; return; }

  host.replaceChildren();
  host.hidden = false;
  const head = document.createElement('div');
  head.className = 'sims-head';
  const h = document.createElement('h3');
  h.textContent = `Simulation runs to review (${runs.length})`;
  head.append(h);
  host.append(head);

  runs.forEach(run => {
    const card = document.createElement('article');
    card.className = 'sim-run';

    const top = document.createElement('div');
    top.className = 'sim-run-top';
    const title = document.createElement('strong');
    title.textContent = run.title;
    const meta = document.createElement('span');
    meta.textContent = [run.specialization, run.minutes != null ? `${run.minutes} min` : null].filter(Boolean).join(' · ');
    top.append(title, meta);
    card.append(top);

    // Decisions in order. Time is shown because it is context, never because it is a score.
    run.decisions.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'sim-run-decision';
      const q = document.createElement('p');
      q.className = 'srd-q';
      q.textContent = `${i + 1}. ${d.question}`;
      const chose = document.createElement('p');
      chose.className = 'srd-chose';
      chose.textContent = d.chose + (d.secondsTaken != null ? ` · ${d.secondsTaken}s` : '');
      row.append(q, chose);
      if (d.reveals) {
        const reveals = document.createElement('p');
        reveals.className = 'srd-reveals';
        reveals.textContent = d.reveals;
        row.append(reveals);
      }
      card.append(row);
    });

    (run.defense || []).forEach((entry, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'sim-run-defense';
      const q = document.createElement('p');
      q.className = 'srd-q';
      q.textContent = entry.question;
      wrap.append(q);
      if (entry.reads) {
        const reads = document.createElement('p');
        reads.className = 'srd-reveals';
        reads.textContent = `Reading for: ${entry.reads}`;
        wrap.append(reads);
      }
      card.append(wrap);
    });

    (run.artifacts || []).forEach(a => {
      if (!a.ref && !a.answer) return;
      const p = document.createElement('p');
      p.className = 'srd-artifact';
      p.textContent = a.ref ? `Submitted: ${a.ref}` : a.answer;
      card.append(p);
    });

    // Said on every card, because a reviewer under time pressure will otherwise read a
    // simulation as a track record.
    const note = document.createElement('p');
    note.className = 'srd-limit';
    note.textContent = 'Observed under conditions we set. It shows how they decided here, not that they have done this work in a real role.';
    card.append(note);

    host.append(card);
  });
}

async function renderDeliveryHealth() {
  const host = document.getElementById('adminHealth');
  if (!host) return;
  let health;
  try {
    const result = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'delivery-health' }) });
    health = result.health;
  } catch { host.hidden = true; return; }
  if (!health) { host.hidden = true; return; }

  host.replaceChildren();
  host.hidden = false;
  host.classList.toggle('is-broken', !health.configured);
  host.classList.toggle('is-degraded', health.configured && health.failuresLast7Days > 0);

  const head = document.createElement('div');
  head.className = 'health-head';
  const dot = document.createElement('span');
  dot.className = 'health-dot';
  const title = document.createElement('h3');
  title.textContent = !health.configured
    ? 'Notifications are switched off'
    : health.failuresLast7Days
      ? 'Notifications configured, some not delivered'
      : 'Notifications working';
  head.append(dot, title);
  host.append(head);

  // The consequence, not the config state. "Not configured" reads as a minor warning.
  if (health.consequence) {
    const why = document.createElement('p');
    why.className = 'health-why';
    why.textContent = health.consequence;
    host.append(why);
  }

  if (health.missing?.length) {
    const fix = document.createElement('p');
    fix.className = 'health-fix';
    fix.textContent = `Set ${health.missing.join(' and ')} in Vercel, then redeploy.`;
    host.append(fix);
  }

  if (health.failuresLast7Days) {
    const list = document.createElement('ul');
    list.className = 'health-reasons';
    Object.entries(health.byReason).forEach(([reason, count]) => {
      const li = document.createElement('li');
      li.textContent = `${count} × ${reason}`;
      list.append(li);
    });
    host.append(list);
  }

  const meta = document.createElement('p');
  meta.className = 'health-meta';
  meta.textContent = [
    health.from ? `Sending as ${health.from}` : null,
    `${health.failuresLast7Days} undelivered in 7 days`,
  ].filter(Boolean).join(' · ');
  host.append(meta);
}

async function adminRequest(options = {}) {
  const response = await fetch('/api/admin', { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({ ok:false, error:'The server returned an unreadable response.' }));
  if (response.status === 401) { sessionStorage.removeItem(TOKEN_KEY); showLogin('Your operator session expired. Request a new link.', true); throw new Error('Session expired.'); }
  if (!response.ok || !result.ok) throw new Error(result.error || 'The operator request failed.');
  return result;
}

function captureMagicLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  if (accessToken) sessionStorage.setItem(TOKEN_KEY, accessToken);
  const error = params.get('error_description');
  if (location.hash) history.replaceState({}, document.title, location.pathname);
  return error;
}

function showLogin(message = '', error = false) { $('#adminLogin').hidden = false; $('#adminShell').hidden = true; const cf = $('#adminCodeForm'); if (cf) cf.hidden = true; const lf = $('#adminLoginForm'); if (lf) lf.hidden = false; if (message) setMessage(message, error); }
function showInbox() { $('#adminLogin').hidden = true; $('#adminShell').hidden = false; }

function updateQueueSummary() {
  const count = status => submissions.filter(item => item.status === status).length;
  const metrics = { Received:count('received'), Reviewing:count('reviewing'), NeedsInfo:count('needs_information'), Approved:count('approved') };
  Object.entries(metrics).forEach(([key,value]) => { $(`#adminMetric${key}`).textContent = value; });
  $('#adminQueueTotal').textContent = `${submissions.length} ${submissions.length === 1 ? 'record' : 'records'}`;
  $$('[data-admin-count]').forEach(element => {
    const type = element.dataset.adminCount;
    element.textContent = type === 'all' ? submissions.length : submissions.filter(item => item.submission_type === type).length;
  });
}

function filtersAreActive() {
  return activeType !== 'all' || $('#adminStatusFilter').value !== 'all' || Boolean($('#adminSearch').value.trim()) || $('#adminSort').value !== 'newest';
}

function filteredSubmissions() {
  const status = $('#adminStatusFilter').value;
  const query = $('#adminSearch').value.trim().toLowerCase();
  const sort = $('#adminSort').value;
  const rows = submissions.filter(item => {
    const typeMatch = activeType === 'all' || item.submission_type === activeType;
    const statusMatch = status === 'all' || item.status === status;
    const haystack = [item.reference,item.submitter_name,item.submitter_email,item.organization_name,item.summary,item.internal_note].join(' ').toLowerCase();
    return typeMatch && statusMatch && (!query || haystack.includes(query));
  });
  return rows.sort((a,b) => {
    if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'attention') {
      const due = item => item.follow_up_at && new Date(item.follow_up_at).getTime() <= Date.now() ? 0 : 1;
      return due(a) - due(b) || (attentionOrder[a.status] ?? 99) - (attentionOrder[b.status] ?? 99) || new Date(b.created_at) - new Date(a.created_at);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderRows() {
  const tbody = $('#adminRows');
  const rows = filteredSubmissions();
  if (rows.length && !rows.some(item => item.reference === selectedReference)) selectedReference = rows[0].reference;
  if (!rows.length) selectedReference = '';
  tbody.replaceChildren();
  $('#adminEmpty').hidden = rows.length > 0;
  $('#adminResultsCount').textContent = `${rows.length} of ${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}`;
  $('#adminClearFilters').hidden = !filtersAreActive();
  rows.forEach(item => {
    const row = document.createElement('tr'); row.tabIndex = 0; row.dataset.reference = item.reference; row.classList.toggle('is-selected', item.reference === selectedReference);
    const values = [item.reference, item.submitter_name, typeLabels[item.submission_type] || labelize(item.submission_type), statusLabels[item.status] || labelize(item.status), dateLabel(item.created_at)];
    const labels = ['Reference','Submitter','Type','Status','Received'];
    values.forEach((value,index) => { const cell = document.createElement('td'); cell.dataset.label = labels[index]; if (index === 3) { const status = document.createElement('span'); status.className='admin-status'; status.dataset.status=item.status; status.textContent=value; cell.append(status); } else cell.textContent=value || '—'; row.append(cell); });
    const select = () => { selectedReference=item.reference; renderRows(); if (matchMedia('(max-width: 1000px)').matches) $('#adminDetail').scrollIntoView({ behavior:'smooth', block:'start' }); };
    row.addEventListener('click',select); row.addEventListener('keydown',event => { if (event.key==='Enter'||event.key===' ') { event.preventDefault(); select(); } });
    tbody.append(row);
  });
  const selected = rows.find(item => item.reference === selectedReference);
  if (selected) renderDetail(selected); else renderEmptyDetail('No matching submission', 'Change or clear the current filters to inspect another record.');
}

function renderEmptyDetail(title, message) {
  const detail=$('#adminDetail'); detail.replaceChildren(); const wrapper=document.createElement('div'); wrapper.className='admin-detail-empty'; wrapper.append(icon('a-inbox')); const heading=document.createElement('h2'); const paragraph=document.createElement('p'); heading.textContent=title; paragraph.textContent=message; wrapper.append(heading,paragraph); detail.append(wrapper);
}

function section(title, entries) {
  const wrapper=document.createElement('section'); wrapper.className='detail-section'; const heading=document.createElement('h3'); heading.textContent=title; const list=document.createElement('dl');
  entries.filter(([,value]) => value !== undefined).forEach(([term,value]) => { const row=document.createElement('div'); const dt=document.createElement('dt'); const dd=document.createElement('dd'); dt.textContent=term; dd.textContent=textValue(value); row.append(dt,dd); list.append(row); });
  wrapper.append(heading,list); return wrapper;
}

function detailSections(item) {
  const details=item.details || {}; const contact=details.contact || {}; const common=[section('Contact',[['Name',contact.name],['Email',contact.email],['Organization',contact.company || item.organization_name],['Role',contact.role]])];
  if (item.submission_type==='student_interest') return [...common,section('Student profile',[['School',details.school],['Education level',details.educationLevel],['Graduation year',details.graduationYear],['Major',details.major],['Timezone',details.timezone]]),section('Interests',[['Work types',details.interests?.workTypes],['Industries',details.interests?.industries],['Work style',details.interests?.workStyle],['Skills',details.skills]]),section('Availability',[['Start',details.availability],['Hours per week',details.preferences?.hoursPerWeek],['Duration',details.preferences?.duration],['Minimum compensation',details.preferences?.minimumCompensation]])];
  if (item.submission_type==='employer_intake') return [...common,section('Organization',[['Website',details.organization?.website],['Size',details.organization?.size],['Industry',details.organization?.industry],['Reason now',details.organization?.reason],['Frequency',details.organization?.workFrequency]]),section('Project',[['Useful by',details.project?.usefulBy],['Last instance',details.project?.lastInstance],['Decision supported',details.project?.decisionSupported],['Deliverable',details.project?.deliverable],['Reviewer',details.project?.reviewer],['Acceptance',details.project?.acceptance],['Approved context',details.project?.approvedContext]]),section('Working terms',[['Student hours',details.project?.studentHours],['Budget',details.project?.budget],['Internal hours avoided',details.project?.internalHoursAvoided],['System access',details.project?.systemAccess]])];
  if (item.submission_type==='university_partner') return [...common,section('Partner',[['Organization type',details.organizationType],['Students shared',details.roster?.length]]),section('Roster',(details.roster||[]).map((student,index)=>[`Student ${index+1}`,`${student.name} · ${student.email} · ${student.interest}`]))];
  return [...common,section('Request',[['Topic',details.topic],['Date',details.requestedDate],['Time',details.requestedTime],['Timezone',details.timezone]])];
}

function workflowSection(item) {
  const wrapper=document.createElement('section'); wrapper.className='detail-section detail-workflow';
  const heading=document.createElement('h3'); heading.textContent='Operator workspace';
  const intro=document.createElement('p'); intro.className='workflow-intro'; intro.textContent='Keep private context and the next follow-up with this submission.';
  const form=document.createElement('form');
  const noteLabel=document.createElement('label'); noteLabel.append(document.createTextNode('Private note'));
  const note=document.createElement('textarea'); note.name='internal_note'; note.maxLength=2000; note.rows=5; note.placeholder='Add the context another operator should know…'; note.value=item.internal_note || '';
  const noteMeta=document.createElement('span'); noteMeta.className='workflow-note-meta'; const count=document.createElement('span'); count.textContent=`${note.value.length} / 2,000`; const privacy=document.createElement('span'); privacy.textContent='Operators only'; noteMeta.append(privacy,count); note.addEventListener('input',()=>{ count.textContent=`${note.value.length} / 2,000`; }); noteLabel.append(note,noteMeta);
  const followLabel=document.createElement('label'); followLabel.append(document.createTextNode('Follow-up date'));
  const followUp=document.createElement('input'); followUp.name='follow_up_at'; followUp.type='datetime-local'; followUp.value=localDateTimeValue(item.follow_up_at); followLabel.append(followUp);
  const actions=document.createElement('div'); actions.className='workflow-actions'; const feedback=document.createElement('span'); feedback.dataset.workflowMessage=''; feedback.setAttribute('aria-live','polite');
  const save=document.createElement('button'); save.type='submit'; save.textContent='Save operator update'; actions.append(feedback,save);
  form.append(noteLabel,followLabel,actions);
  form.addEventListener('submit',async event=>{
    event.preventDefault(); save.disabled=true; save.textContent='Saving…'; feedback.textContent='';
    try {
      const result=await adminRequest({method:'PATCH',body:JSON.stringify({reference:item.reference,internal_note:note.value,follow_up_at:followUp.value ? new Date(followUp.value).toISOString() : null})});
      const index=submissions.findIndex(entry=>entry.reference===item.reference); submissions[index]=result.submission; updateQueueSummary(); renderRows();
      const message=$('[data-workflow-message]',$('#adminDetail')); if (message) message.textContent='Saved just now';
    } catch(error) { feedback.textContent=error.message; feedback.classList.add('is-error'); save.disabled=false; save.textContent='Save operator update'; }
  });
  wrapper.append(heading,intro,form);
  if (item.reviewed_at) { const audit=document.createElement('p'); audit.className='workflow-audit'; audit.textContent=`Last saved ${dateLabel(item.reviewed_at,true)}${item.reviewed_by ? ` by ${item.reviewed_by}` : ''}.`; wrapper.append(audit); }
  return wrapper;
}

function renderDetail(item) {
  const detail=$('#adminDetail'); detail.replaceChildren();
  const head=document.createElement('header'); head.className='detail-head';
  const row=document.createElement('div'); row.className='detail-head-row';
  const title=document.createElement('h2'); title.textContent=item.reference;
  const copy=document.createElement('button'); copy.type='button'; copy.className='copy-admin-reference'; copy.append(icon('a-copy'),document.createTextNode('Copy reference')); copy.addEventListener('click',async()=>{ await navigator.clipboard.writeText(item.reference); copy.lastChild.textContent=' Copied'; }); row.append(title,copy);
  const label=document.createElement('label'); label.className='detail-status-label'; label.append(document.createTextNode('Status'));
  const select=document.createElement('select'); Object.entries(statusLabels).forEach(([value,text])=>{ const option=document.createElement('option'); option.value=value; option.textContent=text; option.selected=value===item.status; select.append(option); });
  select.addEventListener('change',async()=>{ select.disabled=true; try { const result=await adminRequest({method:'PATCH',body:JSON.stringify({reference:item.reference,status:select.value})}); const index=submissions.findIndex(entry=>entry.reference===item.reference); submissions[index]=result.submission; updateQueueSummary(); renderRows(); } catch(error) { alert(error.message); select.value=item.status; } finally { select.disabled=false; } });
  label.append(select); head.append(row,label); detail.append(head,...detailSections(item),workflowSection(item));
  const timeline=document.createElement('section'); timeline.className='detail-section'; const timelineTitle=document.createElement('h3'); timelineTitle.textContent='Timeline'; const list=document.createElement('ol'); list.className='detail-timeline';
  const events=[['Submitted',item.created_at],['Last updated',item.updated_at],['Follow-up',item.follow_up_at]].filter(([,date])=>date);
  events.forEach(([name,date])=>{ const li=document.createElement('li'); const strong=document.createElement('strong'); const span=document.createElement('span'); strong.textContent=name; span.textContent=dateLabel(date,true); li.append(strong,span); list.append(li); }); timeline.append(timelineTitle,list); detail.append(timeline);
}

// §6 slice B: operator triage of company brokered requests — set status + reply the company sees.
function renderRequests() {
  const root = $('#adminRequests'); if (!root) return; root.replaceChildren();
  const count = $('#adminRequestsCount'); if (count) count.textContent = requests.length;
  if (!requests.length) { const p = document.createElement('p'); p.className = 'admin-requests-empty'; p.textContent = 'No brokered work requests yet.'; root.append(p); return; }
  for (const r of requests) {
    const card = document.createElement('article'); card.className = 'admin-request-card';
    const head = document.createElement('div'); head.className = 'admin-request-head';
    const who = document.createElement('strong'); who.textContent = (r.company && (r.company.organization_name || r.company.display_name)) || 'Company';
    const type = document.createElement('span'); type.className = 'admin-request-type'; type.textContent = requestTypeLabels[r.request_type] || r.request_type;
    head.append(who, type); card.append(head);
    if (r.subject) { const s = document.createElement('h3'); s.textContent = r.subject; card.append(s); }
    const details = document.createElement('p'); details.className = 'admin-request-details'; details.textContent = r.details; card.append(details);
    const time = document.createElement('small'); time.className = 'admin-request-time'; time.textContent = `Requested ${dateLabel(r.created_at, true)}`; card.append(time);
    const controls = document.createElement('div'); controls.className = 'admin-request-controls';
    const select = document.createElement('select');
    Object.entries(requestStatusLabels).forEach(([val, label]) => { const o = document.createElement('option'); o.value = val; o.textContent = label; if (val === r.status) o.selected = true; select.append(o); });
    const note = document.createElement('textarea'); note.rows = 2; note.placeholder = 'Reply the company will see…'; note.value = r.resolution_note || '';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'admin-request-save'; save.textContent = 'Save';
    save.addEventListener('click', async () => {
      const original = save.textContent; save.disabled = true; save.textContent = 'Saving…';
      try {
        const result = await adminRequest({ method: 'PATCH', body: JSON.stringify({ action: 'update-request', id: r.id, status: select.value, resolution_note: note.value }) });
        const i = requests.findIndex(x => x.id === r.id); if (i >= 0) requests[i] = { ...requests[i], ...result.request };
        save.textContent = 'Saved'; setTimeout(() => renderRequests(), 800);
      } catch (error) { save.textContent = error.message; setTimeout(() => { save.textContent = original; save.disabled = false; }, 3000); }
    });
    controls.append(select, note, save); card.append(controls);
    root.append(card);
  }
}

// §13 slice 2: operator batch management — create cohorts and review each application.
function renderBatches() {
  const root = $('#adminBatches'); if (!root) return; root.replaceChildren();
  const count = $('#adminBatchesCount'); if (count) count.textContent = batches.length;
  if (!batches.length) { const p = document.createElement('p'); p.className = 'admin-requests-empty'; p.textContent = 'No batches yet. Create one above to open a cohort.'; root.append(p); return; }
  for (const batch of batches) root.append(batchCard(batch));
}

function batchCard(batch) {
  const card = document.createElement('article'); card.className = 'admin-batch-card' + (batch.tier === 'elite' ? ' is-elite' : '');
  const head = document.createElement('div'); head.className = 'admin-batch-head';
  const title = document.createElement('div');
  const name = document.createElement('strong'); name.textContent = batch.name;
  const meta = document.createElement('small'); meta.textContent = [batchTierLabels[batch.tier] || batch.tier, batch.discipline, batch.partner_org, batch.season].filter(Boolean).join(' · ');
  title.append(name, meta);
  const statusLabel = document.createElement('label'); statusLabel.className = 'admin-batch-status';
  statusLabel.append(document.createTextNode('Status'));
  const statusSelect = document.createElement('select');
  Object.entries(batchStatusLabels).forEach(([val, label]) => { const o = document.createElement('option'); o.value = val; o.textContent = label; if (val === batch.status) o.selected = true; statusSelect.append(o); });
  statusSelect.addEventListener('change', async () => {
    statusSelect.disabled = true;
    try {
      const result = await adminRequest({ method: 'PATCH', body: JSON.stringify({ action: 'update-batch', id: batch.id, status: statusSelect.value }) });
      const i = batches.findIndex(b => b.id === batch.id); if (i >= 0) batches[i] = { ...batches[i], ...result.batch };
    } catch (error) { alert(error.message); statusSelect.value = batch.status; } finally { statusSelect.disabled = false; }
  });
  statusLabel.append(statusSelect);
  head.append(title, statusLabel); card.append(head);
  if (batch.description) { const desc = document.createElement('p'); desc.className = 'admin-batch-description'; desc.textContent = batch.description; card.append(desc); }

  const apps = batch.applications || [];
  const tally = document.createElement('div'); tally.className = 'admin-batch-tally';
  const accepted = apps.filter(a => a.status === 'accepted').length;
  const price = Number.isFinite(Number(batch.access_credits)) ? `${Number(batch.access_credits)} cr company access` : '';
  const appsText = apps.length
    ? `${apps.length} ${apps.length === 1 ? 'application' : 'applications'} · ${accepted} accepted${batch.capacity ? ` of ${batch.capacity} seats` : ''}`
    : 'No applications yet.';
  tally.textContent = [appsText, price].filter(Boolean).join('  ·  ');
  card.append(tally);

  if (apps.length) {
    const list = document.createElement('div'); list.className = 'admin-batch-apps';
    for (const app of apps) list.append(batchApplicationRow(batch, app));
    card.append(list);
  }
  return card;
}

function batchApplicationRow(batch, app) {
  const row = document.createElement('div'); row.className = 'admin-batch-app';
  const who = document.createElement('div'); who.className = 'admin-batch-app-who';
  const student = app.student || {};
  const nm = document.createElement('strong'); nm.textContent = student.display_name || 'Student'; who.append(nm);
  const sub = document.createElement('small'); sub.textContent = [student.headline, student.school_name].filter(Boolean).join(' · '); if (sub.textContent) who.append(sub);
  const signals = [ ...(student.verticals || []), ...(student.work_types || []) ];
  if (signals.length) { const tags = document.createElement('div'); tags.className = 'admin-batch-app-tags'; signals.slice(0, 6).forEach(s => { const t = document.createElement('span'); t.textContent = s; tags.append(t); }); who.append(tags); }
  const materials = app.materials || {};
  const field = (label, value) => { const wrap = document.createElement('div'); wrap.className = 'admin-batch-app-field'; const l = document.createElement('span'); l.className = 'admin-batch-app-flabel'; l.textContent = label; const p = document.createElement('p'); p.className = 'admin-batch-app-ftext'; p.textContent = value; wrap.append(l, p); who.append(wrap); };
  if (materials.note) field('Why this cohort', materials.note);
  if (materials.videoPrompt) field('Video prompt (assigned)', materials.videoPrompt);
  (materials.interest || []).forEach(a => { if (a && a.answer) field(a.question || 'Interest', a.answer); });
  if (materials.experience) field('Relevant experience', materials.experience);
  // Concept answers, marked here rather than in the browser: the client never learns whether
  // it was right, so it cannot be the thing that decides.
  (materials.conceptAnswers || []).forEach(a => {
    if (a && Number.isInteger(a.choice)) field(a.question, `Chose option ${a.choice + 1}`);
  });
  (materials.reasoningAnswers || []).forEach(a => { if (a && a.answer) field(a.question, a.answer); });
  // Résumé-anchored questions. Shown with the fragment that prompted them, so a reviewer can
  // tell a specific answer from a general one.
  (materials.resumeAnswers || []).forEach(a => {
    if (a && a.answer) field(a.anchor ? `${a.question} (from: ${a.anchor})` : a.question, a.answer);
  });
  if ((materials.skills || []).length) { const wrap = document.createElement('div'); wrap.className = 'admin-batch-app-tags'; materials.skills.slice(0, 12).forEach(s => { const t = document.createElement('span'); t.className = 'is-skill'; t.textContent = s; wrap.append(t); }); who.append(wrap); }
  const av = materials.availability || {};
  const avText = [av.hoursPerWeek ? `${av.hoursPerWeek} hrs/week` : '', av.startDate ? `starts ${av.startDate}` : ''].filter(Boolean).join(' · ');
  if (avText) field('Availability', avText);
  if (materials.referral && materials.referral.name) field('Referred by', `${materials.referral.name}${materials.referral.code ? ` · ${materials.referral.code}` : ''}${materials.referral.verified ? ' ✓ verified' : ''}`);
  // Links: work samples + video + résumé.
  const linkDefs = [];
  (materials.workSamples || []).forEach((u, i) => linkDefs.push([`Work sample ${i + 1}`, u]));
  if (materials.videoUrl) linkDefs.push(['Video', materials.videoUrl]);
  if (materials.resumeUrl) linkDefs.push(['Résumé', materials.resumeUrl]);
  const links = linkDefs.filter(([, u]) => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (links.length) { const lw = document.createElement('div'); lw.className = 'admin-batch-app-links'; links.forEach(([label, url]) => { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; lw.append(bindPrivateLink(a, url)); }); who.append(lw); }
  row.append(who);

  const controls = document.createElement('div'); controls.className = 'admin-batch-app-controls';
  const select = document.createElement('select');
  Object.entries(batchAppStatusLabels).forEach(([val, label]) => { const o = document.createElement('option'); o.value = val; o.textContent = label; if (val === app.status) o.selected = true; select.append(o); });
  select.dataset.status = app.status;
  select.addEventListener('change', async () => {
    select.disabled = true;
    try {
      const result = await adminRequest({ method: 'PATCH', body: JSON.stringify({ action: 'review-batch-application', id: app.id, status: select.value }) });
      const bi = batches.findIndex(b => b.id === batch.id);
      if (bi >= 0) { const ai = (batches[bi].applications || []).findIndex(a => a.id === app.id); if (ai >= 0) batches[bi].applications[ai] = { ...batches[bi].applications[ai], ...result.application }; }
      renderBatches();
    } catch (error) { alert(error.message); select.value = app.status; select.disabled = false; }
  });
  controls.append(select);
  row.append(controls);
  return row;
}

async function loadInbox({ announce = false } = {}) {
  showInbox();
  // Never awaited into the main load: a health check failing must not stop the inbox rendering.
  renderDeliveryHealth().catch(() => {});
  renderSimulationRuns().catch(() => {});
  renderSchemaHealth().catch(() => {});
  renderOutcomeWorklist().catch(() => {});
  renderReviewQueue().catch(() => {});
  renderPeopleDirectory().catch(() => {});
  const refresh=$('#adminRefresh'); refresh.disabled=true; refresh.classList.add('is-loading');
  if (announce) $('#adminSyncStatus').textContent='Refreshing…';
  try {
    const result=await adminRequest(); submissions=result.submissions; requests=result.requests||[]; batches=result.batches||[]; companies=result.companies||[]; members=result.users||[]; projects=result.projects||[]; appeals=result.appeals||[]; $('#operatorEmail').textContent=result.operator.email;
    if (!selectedReference && submissions[0]) selectedReference=submissions[0].reference;
    if (selectedReference && !submissions.some(item=>item.reference===selectedReference)) selectedReference=submissions[0]?.reference || '';
    updateQueueSummary(); renderRows(); renderRequests(); renderBatches(); renderMetrics(result.metrics); renderPacketCompanies(); renderMembers(); renderProjects(); renderMatcherOptions(); renderAppeals();
    $('#adminSyncStatus').textContent=`Updated ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
  } finally { refresh.disabled=false; refresh.classList.remove('is-loading'); }
}

let pendingOperatorEmail='';
function setCodeMessage(text,error=false){const m=$('#adminCodeMessage');if(!m)return;m.textContent=text;m.classList.toggle('is-error',error);}
$('#adminLoginForm').addEventListener('submit',async event=>{ event.preventDefault(); const button=$('button[type="submit"]',event.currentTarget); button.disabled=true; setMessage('Requesting a secure sign-in code…'); const emailVal=$('[name="email"]',event.currentTarget).value; try { const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:emailVal})}); const result=await response.json(); if (!response.ok||!result.ok) throw new Error(result.error||'Could not request a code.'); pendingOperatorEmail=emailVal; setMessage(''); $('#adminLoginForm').hidden=true; $('#adminCodeForm').hidden=false; setCodeMessage('Code sent. Check your email — it may take a minute.'+(result.requestId?` (ref ${result.requestId})`:'')); $('#adminCodeForm [name="code"]').focus(); } catch(error) { setMessage(error.message,true); } finally { button.disabled=false; } });
$('#adminCodeForm')?.addEventListener('submit',async event=>{ event.preventDefault(); const button=$('button[type="submit"]',event.currentTarget); const code=$('[name="code"]',event.currentTarget).value.replace(/\D/g,''); if(code.length<6){setCodeMessage('Enter the 6-digit code.',true);return;} button.disabled=true; setCodeMessage('Signing you in…'); try { const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify-code',email:pendingOperatorEmail,code})}); const result=await response.json(); if(!response.ok||!result.ok||!result.accessToken) throw new Error(result.error||'That code did not work.'); sessionStorage.setItem(TOKEN_KEY,result.accessToken); await loadInbox().catch(err=>{throw err;}); } catch(error){ setCodeMessage(error.message,true); button.disabled=false; } });
$('#adminCodeBack')?.addEventListener('click',()=>{ $('#adminCodeForm').hidden=true; $('#adminLoginForm').hidden=false; setCodeMessage(''); pendingOperatorEmail=''; });
$$('[data-admin-type]').forEach(button=>button.addEventListener('click',()=>{ activeType=button.dataset.adminType; $('#adminTypeFilter').value=activeType; $$('[data-admin-type]').forEach(item=>item.classList.toggle('is-active',item===button)); renderRows(); }));
$('#adminTypeFilter').addEventListener('change',event=>{ activeType=event.target.value; $$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminType===activeType)); renderRows(); });
$('#adminStatusFilter').addEventListener('change',renderRows); $('#adminSearch').addEventListener('input',renderRows);
$('#adminSort').addEventListener('change',renderRows);
$('#adminRefresh').addEventListener('click',()=>loadInbox({ announce:true }).catch(error=>{ $('#adminSyncStatus').textContent='Refresh failed'; alert(error.message); }));
$('#adminClearFilters').addEventListener('click',()=>{ activeType='all'; $('#adminTypeFilter').value='all'; $('#adminStatusFilter').value='all'; $('#adminSort').value='newest'; $('#adminSearch').value=''; $$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminType==='all')); renderRows(); });
$$('[data-summary-status]').forEach(button=>button.addEventListener('click',()=>{ $('#adminStatusFilter').value=button.dataset.summaryStatus; renderRows(); $('#adminRows').closest('.admin-table-wrap').scrollIntoView({ behavior:'smooth', block:'start' }); }));
$('#adminSignout').addEventListener('click',()=>{ sessionStorage.removeItem(TOKEN_KEY); selectedReference=''; submissions=[]; batches=[]; showLogin('Signed out of this browser.'); });
// §B operator analytics: a live metrics band across the top of the console.
function metricTile(label, value, sub, group){
  const tile=document.createElement('div');tile.className='admin-metric'+(group?` is-${group}`:'');
  const v=document.createElement('strong');v.textContent=value;
  const l=document.createElement('span');l.textContent=label;
  tile.append(v,l);
  if(sub){const s=document.createElement('small');s.textContent=sub;tile.append(s);}
  return tile;
}
function renderMetrics(m){
  const section=$('#adminMetricsSection');const band=$('#adminMetricsBand');
  if(!band)return;
  if(!m){if(section)section.hidden=true;return;}
  const f=m.funnel||{},w=m.thisWeek||{},c=m.credits||{},b=m.batches||{},p=m.payouts||{},cs=m.caseStudy||{};
  const n=x=>String(x==null?0:x);
  band.replaceChildren();
  // Grouped into three labelled clusters so the band reads as sections, not a wall of numbers.
  const groups=[
    ['Pipeline',[
      ['Submissions',n(f.submissions),w.submissions?`+${w.submissions} wk`:'',''],
      ['Member profiles',n(f.profiles),'',''],
      ['Applications',n(f.applications),w.applications?`+${w.applications} wk`:'',''],
      ['Accepted',n(f.accepted),'',''],
      ['Completed',n(f.completed),w.completed?`+${w.completed} wk`:'','good'],
    ]],
    ['Money',[
      ['Credits purchased',n(c.purchased),'in','money'],
      ['Platform revenue',n(c.platformRevenue),'earned','money'],
      ['Paid to students',n(c.toStudents),'out','money'],
      ['Payouts pending',n(p.pending),p.pending?'review':'','warn'],
    ]],
    ['Quality & demand',[
      // A6 wedge metrics: north star + primary early metric, straight from matchQuality.
      ['Match success',`${Math.round(((m.matchQuality||{}).successRate||0)*100)}%`,'accepted ÷ matched','good'],
      ['Repeat companies',`${Math.round((((m.matchQuality||{}).repeat||{}).rate||0)*100)}%`,`${((m.matchQuality||{}).repeat||{}).companiesWithRepeat||0} of ${((m.matchQuality||{}).repeat||{}).companiesWithOne||0}`,'good'],
      ['Acceptance rate',`${n(cs.acceptanceRate)}%`,'of applications','good'],
      ['Avg project value',n(cs.avgDeliveredCredits),'credits','money'],
      ['Active batches',n(b.active),'',''],
    ]],
    ['Score credibility',[
      ['Rater agreement κ',(m.hardening&&m.hardening.irr&&m.hardening.irr.kappa!=null)?String(m.hardening.irr.kappa):'—',(m.hardening&&m.hardening.irr&&m.hardening.irr.n)?`${m.hardening.irr.n} pairs`:'no pairs yet',''],
      ['Labeled rows',n(m.hardening&&m.hardening.labeledRows),'adjudicated',''],
      ['Scorer review',m.hardening&&m.hardening.scorerReview&&m.hardening.scorerReview.ready?'READY':'gated',`${(m.hardening&&m.hardening.scorerReview&&m.hardening.scorerReview.have)||0}/${(m.hardening&&m.hardening.scorerReview&&m.hardening.scorerReview.needed)||50} outcomes`,''],
    ]],
  ];
  for(const [label,tiles] of groups){
    const group=document.createElement('section');group.className='admin-metric-group';
    const gl=document.createElement('p');gl.className='admin-metric-group-label';gl.textContent=label;
    const grid=document.createElement('div');grid.className='admin-metric-group-tiles';
    tiles.forEach(([l,v,s,g])=>grid.append(metricTile(l,v,s,g)));
    group.append(gl,grid);band.append(group);
  }
  if(section)section.hidden=false;
}

// §9 partner digests: operator-triggered preview + send.
function renderDigests(result){
  const root=$('#adminDigests');if(!root)return;root.replaceChildren();
  const rows=result?.results||[];
  const send=$('#digestSendBtn');if(send)send.disabled=!result?.configured;
  const status=$('#digestStatus');
  if(status){
    if(!rows.length)status.textContent='No partner cohorts to summarize yet.';
    else if(result.sent)status.textContent=`Sent ${result.sent} of ${rows.length}.`;
    else status.textContent=result.configured?`${rows.length} ready to send.`:`${rows.length} previewed · sending is off until Resend + COVENDA_DIGEST_ENABLED are set.`;
  }
  if(!rows.length){const p=document.createElement('p');p.className='admin-requests-empty';p.textContent='No referral partners with a cohort yet. Partners appear here after they endorse students.';root.append(p);return;}
  for(const r of rows){
    const card=document.createElement('article');card.className='admin-digest-card';
    const head=document.createElement('div');head.className='admin-digest-head';
    const who=document.createElement('strong');who.textContent=r.orgName||r.code;
    const to=document.createElement('span');to.className='admin-digest-to';to.textContent=r.to||'no partner email';if(!r.to)to.classList.add('is-missing');
    head.append(who,to);card.append(head);
    const subject=document.createElement('p');subject.className='admin-digest-subject';subject.textContent=r.subject;card.append(subject);
    const stats=document.createElement('div');stats.className='admin-digest-stats';
    const c=r.cohort||{};const n=r.newThisPeriod||{};
    stats.textContent=`${c.endorsedCount||0} endorsed · ${c.appliedCount||0} applied · ${c.verifiedCount||0} verified   —   this month: +${n.endorsed||0} / +${n.applied||0} / +${n.verified||0}`;
    card.append(stats);
    if(r.reason&&r.reason!=='dry-run'&&r.reason!=='sent'&&r.reason!=='ready'){const tag=document.createElement('span');tag.className='admin-digest-reason'+(r.sent?' is-sent':'');tag.textContent=r.reason;card.append(tag);}
    if(r.sent){const tag=document.createElement('span');tag.className='admin-digest-reason is-sent';tag.textContent='sent';card.append(tag);}
    root.append(card);
  }
}
async function runDigests(send){
  const status=$('#digestStatus');const pv=$('#digestPreviewBtn');const sd=$('#digestSendBtn');
  pv.disabled=true;sd.disabled=true;if(status)status.textContent=send?'Sending…':'Building preview…';
  try{const result=await adminRequest({method:'POST',body:JSON.stringify({action:'partner-digests',send})});renderDigests(result.digest);}
  catch(error){if(status)status.textContent=error.message;}
  finally{pv.disabled=false;}
}
$('#digestPreviewBtn')?.addEventListener('click',()=>runDigests(false));
$('#digestSendBtn')?.addEventListener('click',()=>{if(confirm('Send the monthly digest to every partner with an email on file?'))runDigests(true);});
// Member management: filterable list of every account, with delete.
const memberRoleLabels={student:'Student',company:'Company',university:'University'};
function filteredMembers(){
  const q=($('#adminUsersSearch')?.value||'').trim().toLowerCase();
  const role=$('#adminUsersRole')?.value||'';
  return members.filter(m=>{
    if(role==='none'){if(m.role)return false;}else if(role&&m.role!==role)return false;
    if(q){const hay=[m.name,m.email].join(' ').toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
}
function renderMembers(){
  const root=$('#adminUsers');if(!root)return;root.replaceChildren();
  const count=$('#adminUsersCount');if(count)count.textContent=members.length;
  const rows=filteredMembers();
  const shown=$('#adminUsersShown');if(shown)shown.textContent=`${rows.length} of ${members.length}`;
  if(!members.length){const p=document.createElement('p');p.className='admin-requests-empty';p.textContent='No member accounts yet.';root.append(p);return;}
  if(!rows.length){const p=document.createElement('p');p.className='admin-requests-empty';p.textContent='No members match this filter.';root.append(p);return;}
  for(const m of rows){
    const row=document.createElement('div');row.className='admin-user-row';
    const info=document.createElement('div');info.className='admin-user-info';
    const nm=document.createElement('strong');nm.textContent=m.name||'(no name)';const em=document.createElement('span');em.className='admin-user-email';em.textContent=m.email||'(no email)';info.append(nm,em);
    const meta=document.createElement('div');meta.className='admin-user-meta';
    const rolePill=document.createElement('span');rolePill.className='admin-user-role';rolePill.textContent=m.role?(memberRoleLabels[m.role]||m.role):'No profile';if(!m.role)rolePill.classList.add('is-none');meta.append(rolePill);
    if(m.created_at){const d=document.createElement('small');d.textContent=`Joined ${dateLabel(m.created_at)}`;meta.append(d);}
    const del=document.createElement('button');del.type='button';del.className='admin-user-delete';del.textContent='Delete';
    del.addEventListener('click',()=>deleteMember(m,del));
    // Student of the Week: only consented students are featureable (consent is the gate).
    if(m.role==='student'&&m.spotlight_consent){
      const feat=document.createElement('button');feat.type='button';feat.className='admin-user-feature'+(m.featured?' is-featured':'');
      feat.textContent=m.featured?'★ Featured — clear':'☆ Feature';
      feat.addEventListener('click',async()=>{
        feat.disabled=true;
        try{
          await adminRequest({method:'PATCH',body:JSON.stringify(m.featured?{action:'set-featured',clear:true}:{action:'set-featured',userId:m.id})});
          await loadInbox();
        }catch(error){alert(error.message);feat.disabled=false;}
      });
      row.append(info,meta,feat,del);root.append(row);continue;
    }
    row.append(info,meta,del);root.append(row);
  }
}
async function deleteMember(m,button){
  const label=m.name||m.email||'this member';
  if(!confirm(`Delete ${label}? This permanently removes their account, profile, projects, and applications. This cannot be undone.`))return;
  button.disabled=true;const original=button.textContent;button.textContent='Deleting…';
  try{
    await adminRequest({method:'PATCH',body:JSON.stringify({action:'delete-user',userId:m.id})});
    members=members.filter(x=>x.id!==m.id);renderMembers();
  }catch(error){alert(error.message);button.disabled=false;button.textContent=original;}
}
$('#adminUsersSearch')?.addEventListener('input',renderMembers);
$('#adminUsersRole')?.addEventListener('change',renderMembers);

const projectStatusLabels={draft:'Draft',scoping:'In scoping',open:'Open',matched:'Matched',in_progress:'In progress',review:'In review',complete:'Complete',archived:'Archived',proposed:'Proposed',proposal_declined:'Proposal declined'};
function filteredProjects(){
  const q=($('#adminProjectsSearch')?.value||'').trim().toLowerCase();
  const status=$('#adminProjectsStatus')?.value||'';
  return projects.filter(p=>{
    if(status==='active'){if(['complete','archived'].includes(p.status))return false;}
    else if(status&&p.status!==status)return false;
    if(q&&!String(p.title||'').toLowerCase().includes(q))return false;
    return true;
  });
}
function renderProjects(){
  const root=$('#adminProjects');if(!root)return;root.replaceChildren();
  const count=$('#adminProjectsCount');if(count)count.textContent=projects.length;
  const rows=filteredProjects();
  const shown=$('#adminProjectsShown');if(shown)shown.textContent=`${rows.length} of ${projects.length}`;
  if(!projects.length){const p=document.createElement('p');p.className='admin-requests-empty';p.textContent='No projects yet.';root.append(p);return;}
  if(!rows.length){const p=document.createElement('p');p.className='admin-requests-empty';p.textContent='No projects match this filter.';root.append(p);return;}
  for(const pr of rows){
    const row=document.createElement('div');row.className='admin-user-row';
    const info=document.createElement('div');info.className='admin-user-info';
    const nm=document.createElement('strong');nm.textContent=pr.title||'(untitled project)';const em=document.createElement('span');em.className='admin-user-email';em.textContent=`${(Number(pr.credits_listed)||0).toLocaleString()} credits listed${Number(pr.credits_held)?` · ${Number(pr.credits_held).toLocaleString()} held in escrow`:''}`;info.append(nm,em);
    const meta=document.createElement('div');meta.className='admin-user-meta';
    const statusPill=document.createElement('span');statusPill.className='admin-user-role';statusPill.textContent=projectStatusLabels[pr.status]||pr.status||'—';meta.append(statusPill);
    if(pr.created_at){const d=document.createElement('small');d.textContent=`Created ${dateLabel(pr.created_at)}`;meta.append(d);}
    const del=document.createElement('button');del.type='button';del.className='admin-user-delete';del.textContent='Delete';
    del.addEventListener('click',()=>deleteProject(pr,del));
    const harden=document.createElement('button');harden.type='button';harden.className='admin-user-feature';
    const adjNeeded=Object.values(pr.rubric_scores||{}).some(e=>{const s=Object.values(e?.raters||{}).map(r=>r.score);return s.length===2&&Math.abs(s[0]-s[1])>1&&!e.adjudicated;});
    harden.textContent=adjNeeded?'Rubric ⚠ adjudicate':'Rubric & defense';
    harden.addEventListener('click',()=>toggleHardenPanel(row,pr));
    row.append(info,meta,harden,del);root.append(row);
  }
}

// P2/P3 operator console: dual-rater rubric scoring (independent, anchored), adjudication
// when raters disagree by >1, and the ownership-defense record. Lives inline on the project
// row so scoring happens where the operator already works.
function toggleHardenPanel(row,pr){
  const existing=row.nextElementSibling;
  if(existing&&existing.classList.contains('admin-harden-panel')){existing.remove();return;}
  document.querySelectorAll('.admin-harden-panel').forEach(x=>x.remove());
  const panel=document.createElement('div');panel.className='admin-harden-panel';
  panel.append(hardenRubricBlock(pr,panel),hardenDefenseBlock(pr));
  row.after(panel);
}
function hardenRubricBlock(pr,panel){
  const box=document.createElement('div');box.className='harden-block';
  const h=document.createElement('h4');h.textContent='Anchored rubric — two independent raters';box.append(h);
  const state=document.createElement('div');state.className='harden-state';box.append(state);
  const paint=()=>{
    state.replaceChildren();
    const book=pr.rubric_scores||{};
    if(!Object.keys(book).length){const p=document.createElement('p');p.className='harden-empty';p.textContent='No rubric scores yet. Each rater scores 0–10 against the anchors without seeing the other\u2019s number.';state.append(p);return;}
    for(const [skill,entry] of Object.entries(book)){
      const line=document.createElement('p');line.className='harden-line';
      const raters=Object.entries(entry.raters||{});
      const adj=entry.adjudicated;
      const delta=raters.length===2?Math.abs(raters[0][1].score-raters[1][1].score):null;
      line.textContent=`${skill}: ${raters.map(([n,r])=>`${n} ${r.score}`).join(' · ')}`+(adj?` → label ${adj.score} (${adj.method})`:delta!=null&&delta>1?' → DISAGREE — adjudicate below':raters.length<2?' — awaiting second rater':'');
      if(adj)line.classList.add('is-labeled');else if(delta!=null&&delta>1)line.classList.add('is-conflict');
      state.append(line);
    }
  };
  paint();
  const form=document.createElement('div');form.className='harden-form';
  const skill=inputEl('text','Skill (e.g. Financial modeling)');const rater=inputEl('text','Rater name');
  const score=inputEl('number','0–10');score.min=0;score.max=10;const notes=inputEl('text','Notes (optional)');
  const send=miniBtn('Submit rating');
  send.addEventListener('click',async()=>{
    send.disabled=true;
    try{
      const out=await adminRequest({method:'PATCH',body:JSON.stringify({action:'rubric-score',projectId:pr.id,skill:skill.value.trim(),rater:rater.value.trim(),score:Number(score.value),notes:notes.value.trim()})});
      pr.rubric_scores=out.result.rubric_scores;paint();score.value='';notes.value='';
      if(out.result.anchors){anchors.textContent=`Anchors — 4: ${out.result.anchors[4]} | 6: ${out.result.anchors[6]} | 9: ${out.result.anchors[9]}`;anchors.hidden=false;}
    }catch(error){alert(error.message);}
    send.disabled=false;
  });
  form.append(skill,rater,score,notes,send);box.append(form);
  const anchors=document.createElement('p');anchors.className='harden-anchors';anchors.hidden=true;box.append(anchors);
  const adjForm=document.createElement('div');adjForm.className='harden-form';
  const aSkill=inputEl('text','Skill to adjudicate');const aScore=inputEl('number','Adjudicated 0–10');aScore.min=0;aScore.max=10;aScore.step='0.5';
  const aWho=inputEl('text','Adjudicator');const aNote=inputEl('text','Why (short)');
  const aBtn=miniBtn('Adjudicate');
  aBtn.addEventListener('click',async()=>{
    aBtn.disabled=true;
    try{
      const out=await adminRequest({method:'PATCH',body:JSON.stringify({action:'rubric-adjudicate',projectId:pr.id,skill:aSkill.value.trim(),score:Number(aScore.value),adjudicator:aWho.value.trim(),note:aNote.value.trim()})});
      pr.rubric_scores=out.result.rubric_scores;paint();
    }catch(error){alert(error.message);}
    aBtn.disabled=false;
  });
  adjForm.append(aSkill,aScore,aWho,aNote,aBtn);box.append(adjForm);
  return box;
}
function hardenDefenseBlock(pr){
  const box=document.createElement('div');box.className='harden-block';
  const h=document.createElement('h4');h.textContent='Ownership defense — recorded walkthrough';box.append(h);
  const d=pr.ownership_defense;
  const cur=document.createElement('p');cur.className='harden-line';
  cur.textContent=d?`Recorded: verdict ${d.verdict} · communication ${d.communication}/10 · depth ${d.depth}/10${d.forensics&&d.forensics.anomaly?' · forensics anomaly (human-reviewed)':''}`:'Not recorded yet. Anomalous commit timelines are NEVER auto-scored — they land here.';
  if(d)cur.classList.add('is-labeled');box.append(cur);
  const form=document.createElement('div');form.className='harden-form';
  const url=inputEl('url','Recording link (https…)');const comm=inputEl('number','Communication 0–10');comm.min=0;comm.max=10;
  const depth=inputEl('number','Depth 0–10');depth.min=0;depth.max=10;
  const verdict=document.createElement('select');[['verified','Verified — genuine author'],['inconclusive','Inconclusive'],['flagged','Flagged — needs follow-up']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;verdict.append(o);});
  const btn=miniBtn('Record defense');
  btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try{
      const out=await adminRequest({method:'PATCH',body:JSON.stringify({action:'record-defense',projectId:pr.id,url:url.value.trim(),communication:Number(comm.value),depth:Number(depth.value),verdict:verdict.value})});
      pr.ownership_defense=out.result.ownership_defense;
      cur.textContent=`Recorded: verdict ${pr.ownership_defense.verdict} · communication ${pr.ownership_defense.communication}/10 · depth ${pr.ownership_defense.depth}/10`;cur.classList.add('is-labeled');
    }catch(error){alert(error.message);}
    btn.disabled=false;
  });
  form.append(url,comm,depth,verdict,btn);box.append(form);
  return box;
}
function inputEl(type,ph){const i=document.createElement('input');i.type=type;i.placeholder=ph;i.className='harden-input';return i;}
function miniBtn(label){const b=document.createElement('button');b.type='button';b.className='admin-primary compactish';b.textContent=label;return b;}

// M8: score appeals — students contesting with new evidence. Never closed silently.
function renderAppeals(){
  const section=$('#adminAppealsSection');const root=$('#adminAppeals');if(!root)return;
  root.replaceChildren();
  const count=$('#adminAppealsCount');if(count)count.textContent=appeals.length;
  if(section)section.hidden=!appeals.length;
  for(const ap of appeals){
    const row=document.createElement('div');row.className='admin-user-row';
    const info=document.createElement('div');info.className='admin-user-info';
    const nm=document.createElement('strong');nm.textContent=ap.subject;
    const em=document.createElement('span');em.className='admin-user-email';em.textContent=ap.evidence.length>140?ap.evidence.slice(0,140)+'…':ap.evidence;
    info.append(nm,em);
    const meta=document.createElement('div');meta.className='admin-user-meta';
    const pill=document.createElement('span');pill.className='admin-user-role';pill.textContent=ap.status;meta.append(pill);
    if(ap.created_at){const dd=document.createElement('small');dd.textContent=dateLabel(ap.created_at);meta.append(dd);}
    row.append(info,meta);
    if(ap.status==='open'){
      const sel=document.createElement('select');[['revised','Revise score'],['upheld','Uphold score'],['dismissed','Dismiss']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;sel.append(o);});
      const rez=inputEl('text','Written resolution (required)');
      const btn=miniBtn('Resolve');
      btn.addEventListener('click',async()=>{
        if(!rez.value.trim()){rez.focus();return;}
        btn.disabled=true;
        try{
          const out=await adminRequest({method:'PATCH',body:JSON.stringify({action:'resolve-appeal',appealId:ap.id,status:sel.value,resolution:rez.value.trim()})});
          Object.assign(ap,out.result);renderAppeals();
        }catch(error){alert(error.message);btn.disabled=false;}
      });
      row.append(sel,rez,btn);
    }
    root.append(row);
  }
}

async function deleteProject(pr,button){
  const label=pr.title||'this project';
  const heldWarn=Number(pr.credits_held)?` It still holds ${Number(pr.credits_held).toLocaleString()} credits in escrow.`:'';
  if(!confirm(`Delete "${label}"? This permanently removes the project and all its applications and messages.${heldWarn} This cannot be undone.`))return;
  button.disabled=true;const original=button.textContent;button.textContent='Deleting…';
  try{
    await adminRequest({method:'PATCH',body:JSON.stringify({action:'delete-project',projectId:pr.id})});
    projects=projects.filter(x=>x.id!==pr.id);renderProjects();
  }catch(error){alert(error.message);button.disabled=false;button.textContent=original;}
}
$('#adminProjectsSearch')?.addEventListener('input',renderProjects);
$('#adminProjectsStatus')?.addEventListener('change',renderProjects);

// ---- Compatibility Engine Stage 2: operator-as-matcher panel. The system drafts, the
// operator decides — and every decision requires a rationale (the training labels).
function renderMatcherOptions(){
  const sel=$('#matchOpportunity');if(!sel)return;
  const current=sel.value;sel.replaceChildren();
  const ph=document.createElement('option');ph.value='';ph.textContent='Choose an opportunity…';sel.append(ph);
  projects.filter(p=>!['archived'].includes(p.status)).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.title||'(untitled)'} · ${p.status}`;if(p.id===current)o.selected=true;sel.append(o);});
}
function matchCandidateCard(entry){
  const card=document.createElement('article');card.className='match-card';
  const top=document.createElement('div');top.className='match-card-top';
  const nm=document.createElement('strong');nm.textContent=entry.name||entry.candidate_id;
  const sc=document.createElement('span');sc.className='match-score';
  const pres=entry.presentation;
  sc.textContent=pres?`${pres.value} · band ${pres.band.low}–${pres.band.high}`:`${entry.score}`;
  if(pres){const tier=document.createElement('span');tier.className='match-tier is-'+pres.evidenceTier;tier.textContent=pres.evidenceTier.replace('_',' ')+' evidence';sc.append(tier);}
  top.append(nm,sc);card.append(top);
  const why=document.createElement('pre');why.className='match-why';why.textContent=entry.explanation;card.append(why);
  const row=document.createElement('div');row.className='match-decide';
  if(!entry.match_id){
    const note=document.createElement('p');note.className='match-note';note.textContent='Run the Stage-0 migration to record decisions (this draft was not persisted).';row.append(note);
  }else{
    const sel=document.createElement('select');[['selected','Select'],['rejected','Reject'],['proposed','Keep proposed']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;sel.append(o);});
    const why2=document.createElement('input');why2.type='text';why2.placeholder='Rationale (required — this is a training label)';why2.className='match-rationale';
    const save=document.createElement('button');save.type='button';save.className='admin-primary compactish';save.textContent='Record decision';
    save.addEventListener('click',async()=>{
      if(!why2.value.trim()){why2.focus();why2.classList.add('is-missing');return;}
      save.disabled=true;save.textContent='Recording…';
      try{
        await adminRequest({method:'PATCH',body:JSON.stringify({action:'decide-match',matchId:entry.match_id,decision:sel.value,rationale:why2.value.trim()})});
        save.textContent='Recorded ✓';card.classList.add('is-decided');
      }catch(error){alert(error.message);save.disabled=false;save.textContent='Record decision';}
    });
    row.append(sel,why2,save);
  }
  card.append(row);return card;
}
async function runMatch(){
  const oppId=$('#matchOpportunity')?.value;const status=$('#matchStatus');const results=$('#matchResults');const btn=$('#runMatchBtn');
  if(!oppId){status.textContent='Pick an opportunity first.';return;}
  btn.disabled=true;status.textContent='Drafting shortlist…';results.replaceChildren();
  try{
    const out=await adminRequest({method:'PATCH',body:JSON.stringify({action:'run-match',opportunityId:oppId})});
    const m=out.match;
    $('#adminMatchVersion').textContent=m.scorer_version||'';
    if(m.refused){
      const card=document.createElement('article');card.className='match-card match-refusal';
      const h=document.createElement('strong');h.textContent=m.message;
      const ul=document.createElement('ul');(m.reasons||[]).forEach(r=>{const li=document.createElement('li');li.textContent=r;ul.append(li);});
      card.append(h,ul);results.append(card);
      status.textContent='Refused — honestly.';
    }else{
      m.shortlist.forEach(entry=>results.append(matchCandidateCard(entry)));
      status.textContent=`${m.shortlist.length} candidate${m.shortlist.length===1?'':'s'} — evidence-cited, capped at 3.`;
    }
  }catch(error){status.textContent=error.message;}
  finally{btn.disabled=false;}
}
$('#runMatchBtn')?.addEventListener('click',runMatch);
// Packet-first intake (GTM Move 1): operator scopes a packet for a company.
function renderPacketCompanies(){
  const sel=$('#packetCompany');if(!sel)return;
  const current=sel.value;
  sel.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent=companies.length?'Select a company…':'No company accounts yet';sel.append(first);
  for(const c of companies){const o=document.createElement('option');o.value=c.user_id;o.textContent=(c.organization_name||c.display_name||'Company')+(c.display_name&&c.organization_name?` · ${c.display_name}`:'');sel.append(o);}
  if(current)sel.value=current;
}
$('#adminPacketForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);const message=$('#adminPacketMessage');
  button.disabled=true;const original=button.textContent;button.textContent='Sending…';if(message){message.textContent='';message.classList.remove('is-error');}
  try{
    const payload={action:'create-packet',companyUserId:form.elements.companyUserId.value,title:form.elements.title.value,deliverable:form.elements.deliverable.value,acceptance:form.elements.acceptance.value,credits:form.elements.credits.value,targetDate:form.elements.targetDate.value};
    await adminRequest({method:'POST',body:JSON.stringify(payload)});
    form.reset();if(message)message.textContent='Packet sent — it now shows in their portal to accept or decline.';
  }catch(error){if(message){message.textContent=error.message;message.classList.add('is-error');}}
  finally{button.disabled=false;button.textContent=original;}
});
$('#adminBatchForm')?.addEventListener('submit',async event=>{
  event.preventDefault(); const form=event.currentTarget; const button=$('button[type="submit"]',form); const message=$('#adminBatchFormMessage');
  button.disabled=true; const original=button.textContent; button.textContent='Creating…'; if (message) { message.textContent=''; message.classList.remove('is-error'); }
  try {
    const payload={ action:'create-batch', name:form.elements.name.value, discipline:form.elements.discipline.value, partner_org:form.elements.partner_org.value, season:form.elements.season.value, tier:form.elements.tier.value, capacity:form.elements.capacity.value, access_credits:form.elements.access_credits.value, status:form.elements.status.value, description:form.elements.description.value };
    const result=await adminRequest({ method:'POST', body:JSON.stringify(payload) });
    batches=[result.batch, ...batches]; renderBatches(); form.reset();
    if (message) message.textContent='Batch created.';
  } catch(error) { if (message) { message.textContent=error.message; message.classList.add('is-error'); } }
  finally { button.disabled=false; button.textContent=original; }
});

const authError=captureMagicLink();
if (authError) showLogin(authError,true); else if (token()) loadInbox().catch(error=>showLogin(error.message,true)); else showLogin();

// ── Who is actually on the platform ───────────────────────────────────────────────────
// The inbox answers "who filled in a form". This answers "who is in, and is it real" —
// which previously meant querying Supabase by hand. Every population leads with the number
// that decides whether it counts: a student with a confirmed club, a club with confirmed
// members, a company that has posted funded work. Signups are the vanity number and are
// shown second on purpose.
(function initRoster(){
  const nav=document.getElementById('rosterNav');
  const panel=document.getElementById('adminRoster');
  const queue=document.querySelector('.admin-queue');
  if(!nav||!panel)return;
  let roster=null,tab='students',filter='';

  const el=(t,c,txt)=>{const n=document.createElement(t);if(c)n.className=c;if(txt!=null)n.textContent=txt;return n;};

  function totals(){
    const host=document.getElementById('rosterTotals');host.replaceChildren();
    const t=roster.totals;
    // Real first, signups second — a signup count nobody has verified flatters the pilot.
    [['Verified students',t.studentsVerified,`${t.students} signed up`],
     ['Clubs with confirmed members',t.clubsWithConfirmedMembers,`${t.clubs} registered`],
     ['Companies with funded work',t.companiesActive,`${t.companies} signed up`],
     ['Projects live',t.projectsLive,`${t.projectsCompleted} completed`]]
      .forEach(([label,value,sub])=>{
        const card=el('div','roster-total');
        card.append(el('b',null,String(value)),el('span',null,label),el('small',null,sub));
        host.append(card);
      });
  }

  function table(cols,rows){
    const wrap=el('div','roster-scroll');
    const tbl=document.createElement('table');tbl.className='roster-table';
    const thead=document.createElement('thead');const hr=document.createElement('tr');
    cols.forEach(c=>hr.append(el('th',null,c.label)));thead.append(hr);
    const tbody=document.createElement('tbody');
    if(!rows.length){
      const tr=document.createElement('tr');const td=el('td','roster-empty','Nothing here yet.');
      td.colSpan=cols.length;tr.append(td);tbody.append(tr);
    }
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      cols.forEach(c=>{
        const td=document.createElement('td');
        const v=c.get(row);
        if(v&&typeof v==='object'&&v.pill){
          const s=el('span','roster-pill',v.pill);s.dataset.tone=v.tone||'';td.append(s);
        }else td.textContent=v==null||v===''?'—':String(v);
        tr.append(td);
      });
      tbody.append(tr);
    });
    tbl.append(thead,tbody);wrap.append(tbl);return wrap;
  }

  const COLS={
    students:[
      {label:'Student',get:r=>r.name},
      {label:'School',get:r=>r.school},
      {label:'Verified',get:r=>({pill:r.verified?'Club confirmed':(r.schoolEmailVerified?'School email only':'No'),tone:r.verified?'good':(r.schoolEmailVerified?'warn':'')})},
      {label:'Clubs',get:r=>r.clubs.join(', ')||(r.clubsClaimedUnconfirmed?`${r.clubsClaimedUnconfirmed} unconfirmed`:'')},
      {label:'Batches',get:r=>`${r.batchesAdmitted}/${r.batchesApplied}`},
      {label:'Projects',get:r=>`${r.projectsCompleted}/${r.projectsAssigned}`},
    ],
    clubs:[
      {label:'Club',get:r=>r.name},
      {label:'School',get:r=>r.school},
      {label:'Link',get:r=>r.link?r.link.replace(/^https?:\/\//,'').slice(0,40):''},
      {label:'Confirmed',get:r=>({pill:String(r.confirmed),tone:r.confirmed?'good':''})},
      {label:'Claimed',get:r=>r.claimed},
      {label:'Officer confirmed',get:r=>r.lastOfficer||(r.officerConfirmed?`${r.officerConfirmed}`:'—')},
      {label:'Admitted to batches',get:r=>r.admitted},
    ],
    companies:[
      {label:'Company',get:r=>r.name},
      {label:'Contact',get:r=>r.contactName},
      {label:'Work email',get:r=>({pill:r.workEmailVerified?(r.domain||'Confirmed'):'Unconfirmed',tone:r.workEmailVerified?'good':'warn'})},
      {label:'Posted',get:r=>r.projectsPosted},
      {label:'Funded',get:r=>({pill:String(r.projectsFunded),tone:r.projectsFunded?'good':''})},
      {label:'Credits held',get:r=>r.creditsHeld},
    ],
  };

  function paint(){
    const body=document.getElementById('rosterBody');body.replaceChildren();
    if(!roster){body.append(el('p','roster-empty','Loading…'));return;}
    totals();
    const q=filter.trim().toLowerCase();
    const rows=(roster[tab]||[]).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
    body.append(table(COLS[tab],rows));
  }

  async function load(){
    try{
      const out=await adminRequest({method:'POST',body:JSON.stringify({action:'platform-roster'})});
      roster=out.roster;paint();
    }catch(error){
      const body=document.getElementById('rosterBody');
      body.replaceChildren(el('p','roster-empty',error.message));
    }
  }

  nav.addEventListener('click',()=>{
    document.querySelectorAll('.admin-nav nav button').forEach(b=>b.classList.remove('is-active'));
    nav.classList.add('is-active');
    if(queue)queue.hidden=true;
    panel.hidden=false;
    if(!roster)load();else paint();
  });
  document.querySelectorAll('.admin-nav nav [data-admin-type]').forEach(b=>b.addEventListener('click',()=>{
    nav.classList.remove('is-active');panel.hidden=true;if(queue)queue.hidden=false;
  }));
  document.getElementById('rosterRefresh')?.addEventListener('click',load);
  document.getElementById('rosterSearch')?.addEventListener('input',e=>{filter=e.target.value;paint();});
  document.querySelectorAll('[data-roster-tab]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-roster-tab]').forEach(x=>x.classList.remove('is-active'));
    b.classList.add('is-active');tab=b.dataset.rosterTab;paint();
  }));
})();
