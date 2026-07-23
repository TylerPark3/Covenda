const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOKEN_KEY = 'covendaAdminAccessToken';
const statusLabels = { received:'Received', reviewing:'In human review', needs_information:'Needs information', packet_proposed:'Packet proposed', approval_pending:'Approval pending', approved:'Approved', declined:'Closed', archived:'Archived' };
const typeLabels = { student_interest:'Student', employer_intake:'Company', university_partner:'University', call_request:'Call request' };
let submissions = [];
let requests = [];
let batches = [];
let companies = [];
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
function authHeaders() { return { Authorization: `Bearer ${token()}`, 'Content-Type':'application/json' }; }

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

function showLogin(message = '', error = false) { $('#adminLogin').hidden = false; $('#adminShell').hidden = true; if (message) setMessage(message, error); }
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
  if (materials.experience) field('Relevant experience', materials.experience);
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
  if (links.length) { const lw = document.createElement('div'); lw.className = 'admin-batch-app-links'; links.forEach(([label, url]) => { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; lw.append(a); }); who.append(lw); }
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
  const refresh=$('#adminRefresh'); refresh.disabled=true; refresh.classList.add('is-loading');
  if (announce) $('#adminSyncStatus').textContent='Refreshing…';
  try {
    const result=await adminRequest(); submissions=result.submissions; requests=result.requests||[]; batches=result.batches||[]; companies=result.companies||[]; $('#operatorEmail').textContent=result.operator.email;
    if (!selectedReference && submissions[0]) selectedReference=submissions[0].reference;
    if (selectedReference && !submissions.some(item=>item.reference===selectedReference)) selectedReference=submissions[0]?.reference || '';
    updateQueueSummary(); renderRows(); renderRequests(); renderBatches(); renderMetrics(result.metrics); renderPacketCompanies();
    $('#adminSyncStatus').textContent=`Updated ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
  } finally { refresh.disabled=false; refresh.classList.remove('is-loading'); }
}

$('#adminLoginForm').addEventListener('submit',async event=>{ event.preventDefault(); const button=$('button',event.currentTarget); button.disabled=true; setMessage('Requesting a secure sign-in link…'); try { const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:$('[name="email"]',event.currentTarget).value})}); const result=await response.json(); if (!response.ok||!result.ok) throw new Error(result.error||'Could not request a link.'); const reference=result.requestId ? ` Reference: ${result.requestId}.` : ''; setMessage(result.message+reference); } catch(error) { setMessage(error.message,true); } finally { button.disabled=false; } });
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
  const tiles=[
    ['Submissions',n(f.submissions),w.submissions?`+${w.submissions} this week`:'',''],
    ['Member profiles',n(f.profiles),'',''],
    ['Applications',n(f.applications),w.applications?`+${w.applications} this week`:'',''],
    ['Accepted',n(f.accepted),'',''],
    ['Completed',n(f.completed),w.completed?`+${w.completed} this week`:'','good'],
    ['Active batches',n(b.active),'',''],
    ['Credits purchased',n(c.purchased),'money in','money'],
    ['Platform revenue',n(c.platformRevenue),'earned','money'],
    ['Paid to students',n(c.toStudents),'money out','money'],
    ['Payouts pending',n(p.pending),p.pending?'needs review':'','warn'],
    // GTM Move 5 — the willingness-to-pay / case-study metrics.
    ['Acceptance rate',`${n(cs.acceptanceRate)}%`,'of applications','good'],
    ['Repeat rate',`${n(cs.repeatRate)}%`,'companies with 2+ delivered','good'],
    ['Avg project value',n(cs.avgDeliveredCredits),'credits / delivered','money'],
  ];
  tiles.forEach(([l,v,s,g])=>band.append(metricTile(l,v,s,g)));
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
