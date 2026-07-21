const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOKEN_KEY = 'covendaAdminAccessToken';
const statusLabels = { received:'Received', reviewing:'In human review', needs_information:'Needs information', packet_proposed:'Packet proposed', approval_pending:'Approval pending', approved:'Approved', declined:'Closed', archived:'Archived' };
const typeLabels = { student_interest:'Student', employer_intake:'Company', university_partner:'University', call_request:'Call request' };
let submissions = [];
let selectedReference = '';
let activeType = 'all';

function icon(id) { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); const use = document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href','#'+id); svg.append(use); return svg; }
function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
function setMessage(text, error = false) { const message = $('#adminLoginMessage'); message.textContent = text; message.classList.toggle('is-error', error); }
function textValue(value) { if (value === null || value === undefined || value === '') return '—'; if (Array.isArray(value)) return value.map(textValue).join(', '); if (typeof value === 'boolean') return value ? 'Yes' : 'No'; if (typeof value === 'object') return Object.entries(value).map(([key,val]) => `${labelize(key)}: ${textValue(val)}`).join(' · '); return String(value); }
function labelize(value) { return String(value).replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./, char => char.toUpperCase()); }
function dateLabel(value, full = false) { const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; return date.toLocaleString([], full ? { dateStyle:'medium', timeStyle:'short' } : { month:'short', day:'numeric' }); }
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

function filteredSubmissions() {
  const status = $('#adminStatusFilter').value;
  const query = $('#adminSearch').value.trim().toLowerCase();
  return submissions.filter(item => {
    const typeMatch = activeType === 'all' || item.submission_type === activeType;
    const statusMatch = status === 'all' || item.status === status;
    const haystack = [item.reference,item.submitter_name,item.submitter_email,item.organization_name,item.summary].join(' ').toLowerCase();
    return typeMatch && statusMatch && (!query || haystack.includes(query));
  });
}

function renderRows() {
  const tbody = $('#adminRows');
  const rows = filteredSubmissions();
  tbody.replaceChildren();
  $('#adminEmpty').hidden = rows.length > 0;
  rows.forEach(item => {
    const row = document.createElement('tr'); row.tabIndex = 0; row.dataset.reference = item.reference; row.classList.toggle('is-selected', item.reference === selectedReference);
    const values = [item.reference, item.submitter_name, typeLabels[item.submission_type] || labelize(item.submission_type), statusLabels[item.status] || labelize(item.status), dateLabel(item.created_at)];
    const labels = ['Reference','Submitter','Type','Status','Received'];
    values.forEach((value,index) => { const cell = document.createElement('td'); cell.dataset.label = labels[index]; if (index === 3) { const status = document.createElement('span'); status.className='admin-status'; status.dataset.status=item.status; status.textContent=value; cell.append(status); } else cell.textContent=value || '—'; row.append(cell); });
    const select = () => { selectedReference=item.reference; renderRows(); renderDetail(item); };
    row.addEventListener('click',select); row.addEventListener('keydown',event => { if (event.key==='Enter'||event.key===' ') { event.preventDefault(); select(); } });
    tbody.append(row);
  });
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

function renderDetail(item) {
  const detail=$('#adminDetail'); detail.replaceChildren(); const head=document.createElement('header'); head.className='detail-head'; const row=document.createElement('div'); row.className='detail-head-row'; const title=document.createElement('h2'); title.textContent=item.reference; const copy=document.createElement('button'); copy.type='button'; copy.className='copy-admin-reference'; copy.append(icon('a-copy'),document.createTextNode('Copy reference')); copy.addEventListener('click',async()=>{ await navigator.clipboard.writeText(item.reference); copy.lastChild.textContent=' Copied'; }); row.append(title,copy);
  const label=document.createElement('label'); label.className='detail-status-label'; label.append(document.createTextNode('Status')); const select=document.createElement('select'); Object.entries(statusLabels).forEach(([value,text])=>{ const option=document.createElement('option'); option.value=value; option.textContent=text; option.selected=value===item.status; select.append(option); }); select.addEventListener('change',async()=>{ select.disabled=true; try { const result=await adminRequest({method:'PATCH',body:JSON.stringify({reference:item.reference,status:select.value})}); const index=submissions.findIndex(entry=>entry.reference===item.reference); submissions[index]=result.submission; renderRows(); renderDetail(result.submission); } catch(error) { alert(error.message); select.value=item.status; } finally { select.disabled=false; } }); label.append(select); head.append(row,label); detail.append(head,...detailSections(item));
  const timeline=document.createElement('section'); timeline.className='detail-section'; const timelineTitle=document.createElement('h3'); timelineTitle.textContent='Timeline'; const list=document.createElement('ol'); list.className='detail-timeline'; [['Submitted',item.created_at],['Last updated',item.updated_at]].forEach(([name,date])=>{ const li=document.createElement('li'); const strong=document.createElement('strong'); const span=document.createElement('span'); strong.textContent=name; span.textContent=dateLabel(date,true); li.append(strong,span); list.append(li); }); timeline.append(timelineTitle,list); detail.append(timeline);
}

async function loadInbox() { showInbox(); const result=await adminRequest(); submissions=result.submissions; $('#operatorEmail').textContent=result.operator.email; if (!selectedReference && submissions[0]) selectedReference=submissions[0].reference; renderRows(); const selected=submissions.find(item=>item.reference===selectedReference); if (selected) renderDetail(selected); }

$('#adminLoginForm').addEventListener('submit',async event=>{ event.preventDefault(); const button=$('button',event.currentTarget); button.disabled=true; setMessage('Requesting a secure sign-in link…'); try { const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:$('[name="email"]',event.currentTarget).value})}); const result=await response.json(); if (!response.ok||!result.ok) throw new Error(result.error||'Could not request a link.'); setMessage(result.message); } catch(error) { setMessage(error.message,true); } finally { button.disabled=false; } });
$$('[data-admin-type]').forEach(button=>button.addEventListener('click',()=>{ activeType=button.dataset.adminType; $('#adminTypeFilter').value=activeType; $$('[data-admin-type]').forEach(item=>item.classList.toggle('is-active',item===button)); renderRows(); }));
$('#adminTypeFilter').addEventListener('change',event=>{ activeType=event.target.value; $$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminType===activeType)); renderRows(); });
$('#adminStatusFilter').addEventListener('change',renderRows); $('#adminSearch').addEventListener('input',renderRows);
$('#adminSignout').addEventListener('click',()=>{ sessionStorage.removeItem(TOKEN_KEY); selectedReference=''; submissions=[]; showLogin('Signed out of this browser.'); });

const authError=captureMagicLink();
if (authError) showLogin(authError,true); else if (token()) loadInbox().catch(error=>showLogin(error.message,true)); else showLogin();
