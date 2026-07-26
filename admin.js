const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOKEN_KEY = 'covendaAdminAccessToken';
const statusLabels = { received:'Received', reviewing:'In human review', needs_information:'Needs information', packet_proposed:'Packet proposed', approval_pending:'Approval pending', approved:'Approved', declined:'Closed', archived:'Archived' };
const typeLabels = { student_interest:'Student', employer_intake:'Company', university_partner:'University', referrer_endorsement:'Referral endorsement', network_access_request:'Trusted Talent access', call_request:'Call request' };
let submissions = [];
let projectRequests = [];
let selectedReference = '';
let selectedProjectRequest = '';
let packagingFilter = 'submitted';
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
  if (item.submission_type==='referrer_endorsement') return [...common,section('Referral source',[['Referrer type',details.referrerType],['Attribution code',details.attributionCode],['Students endorsed',details.endorsements?.length]]),section('Endorsements',(details.endorsements||[]).map((student,index)=>[`Student ${index+1}`,`${student.name} · ${student.email}${student.function ? ` · ${student.function}` : ''}${student.note ? ` · ${student.note}` : ''}`]))];
  if (item.submission_type==='network_access_request') return [...common,section('Trusted Talent access',[['Reason',details.reason],['Roles or skills',details.rolesNeeded],['Hiring timeline',details.hiringTimeline],['Access stage',details.stage]])];
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

function partnerVerificationSection(item) {
  if (!['university_partner','referrer_endorsement'].includes(item.submission_type)) return null;
  const wrapper=document.createElement('section');wrapper.className='detail-section partner-verification';
  const heading=document.createElement('h3');heading.textContent='Partner verification';
  const intro=document.createElement('p');intro.className='partner-verification-intro';intro.textContent='Submission approval accepts this intake. Partner verification separately confirms Covenda has checked the source.';
  const form=document.createElement('form');
  const verifiedLabel=document.createElement('label');const verified=document.createElement('input');verified.type='checkbox';verified.name='partner_verified';verified.checked=item.partner_verified===true;const verifiedText=document.createElement('span');verifiedText.append(document.createElement('strong'),document.createElement('small'));verifiedText.firstChild.textContent='Founder-confirmed partner';verifiedText.lastChild.textContent='Allows verified referral language and certification.';verifiedLabel.append(verified,verifiedText);
  const foundingLabel=document.createElement('label');const founding=document.createElement('input');founding.type='checkbox';founding.name='founding_partner';founding.checked=item.founding_partner===true;const foundingText=document.createElement('span');foundingText.append(document.createElement('strong'),document.createElement('small'));foundingText.firstChild.textContent='Founding faculty designation';foundingText.lastChild.textContent='Reserved for the consented founding partner program.';foundingLabel.append(founding,foundingText);
  const canVerify=item.status==='approved'||item.partner_verified===true;verified.disabled=!canVerify;founding.disabled=!verified.checked||!canVerify;verified.addEventListener('change',()=>{founding.disabled=!verified.checked;if(!verified.checked)founding.checked=false;});
  const feedback=document.createElement('p');feedback.className='partner-verification-message';feedback.setAttribute('aria-live','polite');if(!canVerify)feedback.textContent='Approve this submission before confirming the partner.';
  const save=document.createElement('button');save.type='submit';save.textContent='Save partner verification';save.disabled=!canVerify;
  form.append(verifiedLabel,foundingLabel,feedback,save);
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;save.textContent='Saving…';feedback.textContent='';try{const result=await adminRequest({method:'POST',body:JSON.stringify({action:'verify-partner',reference:item.reference,partnerVerified:verified.checked,foundingPartner:founding.checked})});const index=submissions.findIndex(entry=>entry.reference===item.reference);submissions[index]=result.submission;renderRows();}catch(error){feedback.textContent=error.message;feedback.classList.add('is-error');save.disabled=false;save.textContent='Save partner verification';}});
  wrapper.append(heading,intro,form);
  if(item.partner_verified_at){const audit=document.createElement('p');audit.className='partner-verification-audit';audit.textContent=`Confirmed ${dateLabel(item.partner_verified_at,true)}${item.partner_verified_by?` by ${item.partner_verified_by}`:''}.`;wrapper.append(audit);}
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
  label.append(select); head.append(row,label);const partnerVerification=partnerVerificationSection(item);detail.append(head,...detailSections(item),...(partnerVerification?[partnerVerification]:[]),workflowSection(item));
  const timeline=document.createElement('section'); timeline.className='detail-section'; const timelineTitle=document.createElement('h3'); timelineTitle.textContent='Timeline'; const list=document.createElement('ol'); list.className='detail-timeline';
  const events=[['Submitted',item.created_at],['Last updated',item.updated_at],['Follow-up',item.follow_up_at]].filter(([,date])=>date);
  events.forEach(([name,date])=>{ const li=document.createElement('li'); const strong=document.createElement('strong'); const span=document.createElement('span'); strong.textContent=name; span.textContent=dateLabel(date,true); li.append(strong,span); list.append(li); }); timeline.append(timelineTitle,list); detail.append(timeline);
}

const requestTypeLabels={new_project:'New project',more_students:'More students',scope_change:'Scope change',revision:'Revision',consult:'Consult',question:'Question',specific_student:'Specific student'};
const requestStatusLabels={submitted:'Submitted',in_packaging:'In packaging',packaged:'Packaged',declined:'Declined',closed:'Closed'};
const packetVerticals=['Accounting & finance','Software & AI','Healthcare operations','Consumer & retail','Professional services','Not sure yet — show me everything'];
const packetWorkTypes=['Research','Data & spreadsheets','Operations','QA & testing','Writing & documentation'];

function setAdminView(view){const packaging=view==='packaging';$('#adminInboxMain').hidden=packaging;$('#adminPackagingMain').hidden=!packaging;$('#adminPackagingNav').classList.toggle('is-active',packaging);$$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',!packaging&&button.dataset.adminType===activeType));$('#adminRefresh').lastChild.textContent=packaging?'Refresh queue':'Refresh inbox';if(packaging)renderPackaging();}
function packagingItems(){return projectRequests.filter(item=>item.status===packagingFilter);}
function packetField(label,name,value,{rows=0,type='text',placeholder=''}={}){const wrapper=document.createElement('label');wrapper.className='packet-field';wrapper.append(document.createTextNode(label));const control=rows?document.createElement('textarea'):document.createElement('input');control.name=name;control.value=value||'';control.placeholder=placeholder;if(rows)control.rows=rows;else control.type=type;wrapper.append(control);return wrapper;}
function packetMulti(label,name,options,selected=[]){const wrapper=document.createElement('label');wrapper.className='packet-field';wrapper.append(document.createTextNode(label));const select=document.createElement('select');select.name=name;select.multiple=true;options.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;option.selected=selected.includes(value);select.append(option);});wrapper.append(select);const help=document.createElement('small');help.textContent='Hold Command or Ctrl to select more than one.';wrapper.append(help);return wrapper;}
function packetFromForm(form){const values=name=>[...form.elements[name].selectedOptions].map(option=>option.value);return {title:form.elements.title.value,summary:form.elements.summary.value,deliverable:form.elements.deliverable.value,acceptanceCriteria:form.elements.acceptanceCriteria.value,safeInputs:form.elements.safeInputs.value,credits:form.elements.credits.value,verticals:values('verticals'),workTypes:values('workTypes'),desiredSkills:form.elements.desiredSkills.value,targetDate:form.elements.targetDate.value};}
function replaceProjectRequest(next){const index=projectRequests.findIndex(item=>item.id===next.id);if(index>=0)projectRequests[index]=next;else projectRequests.unshift(next);$('#adminPackagingCount').textContent=projectRequests.filter(item=>['submitted','in_packaging'].includes(item.status)).length;renderPackaging();}
function renderPacketEditor(item){const root=$('#packetEditor');root.replaceChildren();if(!item){const empty=document.createElement('div');empty.className='packet-editor-empty';empty.append(icon('a-packet'));const h=document.createElement('h2');h.textContent='Select a request';const p=document.createElement('p');p.textContent='Choose a row to inspect the original need and build its Project Packet.';empty.append(h,p);root.append(empty);return;}const head=document.createElement('header');const top=document.createElement('div');const eye=document.createElement('p');eye.textContent=requestTypeLabels[item.request_type]||labelize(item.request_type);const h=document.createElement('h2');h.textContent='Build the Project Packet';const status=document.createElement('span');status.className='admin-status';status.dataset.status=item.status;status.textContent=requestStatusLabels[item.status]||labelize(item.status);top.append(eye,h);head.append(top,status);const original=document.createElement('section');original.className='packet-original';const originalTitle=document.createElement('strong');originalTitle.textContent='Original request';const body=document.createElement('p');body.textContent=item.body;original.append(originalTitle,body);if((item.attachments||[]).length){const files=document.createElement('div');item.attachments.forEach(file=>{const a=document.createElement('a');a.href=file.blobUrl;a.target='_blank';a.rel='noopener';a.textContent=file.name||'Attachment';files.append(a);});original.append(files);}const draft=item.packet_draft||{};const ai=item.ai_brief||{};const form=document.createElement('form');form.className='packet-form';form.append(packetField('Packet title','title',draft.title||''),packetField('Summary','summary',draft.summary||ai.summary||item.body,{rows:4}),packetField('Useful deliverable','deliverable',draft.deliverable||(ai.candidateDeliverables||[])[0]||'',{rows:3}),packetField('Acceptance criteria','acceptanceCriteria',draft.acceptanceCriteria||'',{rows:3,placeholder:'What must be true for the company to accept the work?'}),packetField('Safe inputs','safeInputs',draft.safeInputs||'',{rows:3,placeholder:'Public sources, provided template, synthetic data…'}));const grid=document.createElement('div');grid.className='packet-grid';grid.append(packetField('Student payout · credits','credits',draft.credits||'',{type:'number'}),packetField('Useful by','targetDate',draft.targetDate||'',{type:'date'}));form.append(grid,packetMulti('Industry','verticals',packetVerticals,draft.verticals||ai.suggestedVerticals||[]),packetMulti('Work type','workTypes',packetWorkTypes,draft.workTypes||ai.suggestedWorkTypes||[]),packetField('Desired skills · comma separated','desiredSkills',Array.isArray(draft.desiredSkills)?draft.desiredSkills.join(', '):(draft.desiredSkills||'')));
  const safety=document.createElement('fieldset');safety.className='packet-safety';const legend=document.createElement('legend');legend.append(icon('a-shield'),document.createTextNode(' Safety boundary'));const intro=document.createElement('p');intro.textContent='Explicitly clear all four boundaries before publishing.';safety.append(legend,intro);[['clientRecords','No client or patient records'],['pii','No personal or identifying information'],['productionAccess','No production or live-system access'],['regulatedDecisions','No regulated decisions or judgment']].forEach(([name,label])=>{const l=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name=name;const span=document.createElement('span');span.textContent=label;l.append(input,span);safety.append(l);});form.append(safety);const message=document.createElement('p');message.className='packet-message';message.setAttribute('aria-live','polite');const actions=document.createElement('div');actions.className='packet-actions';const decline=document.createElement('button');decline.type='button';decline.className='packet-decline';decline.textContent='Decline with reason';const save=document.createElement('button');save.type='button';save.className='packet-save';save.textContent='Save packaging draft';const publish=document.createElement('button');publish.type='button';publish.className='packet-publish';publish.append(document.createTextNode('Publish to students'),icon('a-check'));actions.append(decline,save,publish);form.append(message,actions);const declineBox=document.createElement('div');declineBox.className='packet-decline-box';declineBox.hidden=true;const reason=document.createElement('textarea');reason.rows=3;reason.placeholder='Explain what cannot move forward and what would make it workable.';const sendDecline=document.createElement('button');sendDecline.type='button';sendDecline.textContent='Send decline reason';declineBox.append(reason,sendDecline);form.append(declineBox);
  save.addEventListener('click',async()=>{save.disabled=true;message.textContent='Saving draft…';try{const result=await adminRequest({method:'POST',body:JSON.stringify({action:'save-packaging',requestId:item.id,packet:packetFromForm(form)})});message.textContent='Draft saved.';replaceProjectRequest(result.request);}catch(error){message.textContent=error.message;message.classList.add('is-error');}finally{save.disabled=false;}});
  decline.addEventListener('click',()=>{declineBox.hidden=!declineBox.hidden;if(!declineBox.hidden)reason.focus();});
  sendDecline.addEventListener('click',async()=>{sendDecline.disabled=true;message.textContent='Closing request…';try{const result=await adminRequest({method:'POST',body:JSON.stringify({action:'decline-request',requestId:item.id,reason:reason.value})});packagingFilter='declined';replaceProjectRequest(result.request);}catch(error){message.textContent=error.message;message.classList.add('is-error');sendDecline.disabled=false;}});
  publish.addEventListener('click',async()=>{publish.disabled=true;message.textContent='Publishing packet and holding escrow…';const safetyInput={clientRecords:!form.elements.clientRecords.checked,pii:!form.elements.pii.checked,productionAccess:!form.elements.productionAccess.checked,regulatedDecisions:!form.elements.regulatedDecisions.checked};try{await adminRequest({method:'POST',body:JSON.stringify({action:'publish-request',requestId:item.id,packet:packetFromForm(form),safety:safetyInput})});packagingFilter='packaged';await loadInbox();setAdminView('packaging');}catch(error){message.textContent=error.message;message.classList.add('is-error');publish.disabled=false;}});
  root.append(head,original,form);}
function renderPackaging(){const items=packagingItems();$('#packagingTotal').textContent=`${projectRequests.length} ${projectRequests.length===1?'request':'requests'}`;$('#adminPackagingCount').textContent=projectRequests.filter(item=>['submitted','in_packaging'].includes(item.status)).length;$$('[data-packaging-filter]').forEach(button=>button.classList.toggle('is-active',button.dataset.packagingFilter===packagingFilter));if(!items.some(item=>item.id===selectedProjectRequest))selectedProjectRequest=items[0]?.id||'';const root=$('#packagingList');root.replaceChildren();if(!items.length){const empty=document.createElement('div');empty.className='packaging-empty';empty.append(icon('a-check'));const h=document.createElement('h2');h.textContent='Queue is clear';const p=document.createElement('p');p.textContent='No requests are in this stage.';empty.append(h,p);root.append(empty);renderPacketEditor(null);return;}items.forEach(item=>{const row=document.createElement('button');row.type='button';row.className='packaging-row'+(item.id===selectedProjectRequest?' is-selected':'');const summary=document.createElement('span');const strong=document.createElement('strong');strong.textContent=(item.packet_draft?.title||item.body).slice(0,100);const small=document.createElement('small');small.textContent=item.body;summary.append(strong,small);const type=document.createElement('span');type.textContent=requestTypeLabels[item.request_type]||labelize(item.request_type);const status=document.createElement('span');status.className='admin-status';status.dataset.status=item.status;status.textContent=requestStatusLabels[item.status];const date=document.createElement('span');date.textContent=dateLabel(item.created_at);row.append(summary,type,status,date);row.addEventListener('click',()=>{selectedProjectRequest=item.id;renderPackaging();});root.append(row);});renderPacketEditor(items.find(item=>item.id===selectedProjectRequest));}

async function loadInbox({ announce = false } = {}) {
  showInbox();
  const refresh=$('#adminRefresh'); refresh.disabled=true; refresh.classList.add('is-loading');
  if (announce) $('#adminSyncStatus').textContent='Refreshing…';
  try {
    const result=await adminRequest(); submissions=result.submissions; projectRequests=result.projectRequests||[]; $('#operatorEmail').textContent=result.operator.email;
    if (!selectedReference && submissions[0]) selectedReference=submissions[0].reference;
    if (selectedReference && !submissions.some(item=>item.reference===selectedReference)) selectedReference=submissions[0]?.reference || '';
    updateQueueSummary(); renderRows(); renderPackaging();
    $('#adminSyncStatus').textContent=`Updated ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
  } finally { refresh.disabled=false; refresh.classList.remove('is-loading'); }
}

$('#adminLoginForm').addEventListener('submit',async event=>{ event.preventDefault(); const button=$('button',event.currentTarget); button.disabled=true; setMessage('Requesting a secure sign-in link…'); try { const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:$('[name="email"]',event.currentTarget).value})}); const result=await response.json(); if (!response.ok||!result.ok) throw new Error(result.error||'Could not request a link.'); const reference=result.requestId ? ` Reference: ${result.requestId}.` : ''; setMessage(result.message+reference); } catch(error) { setMessage(error.message,true); } finally { button.disabled=false; } });
$$('[data-admin-type]').forEach(button=>button.addEventListener('click',()=>{ activeType=button.dataset.adminType; $('#adminTypeFilter').value=activeType; setAdminView('inbox'); $$('[data-admin-type]').forEach(item=>item.classList.toggle('is-active',item===button)); renderRows(); }));
$('#adminPackagingNav').addEventListener('click',()=>setAdminView('packaging'));
$$('[data-packaging-filter]').forEach(button=>button.addEventListener('click',()=>{packagingFilter=button.dataset.packagingFilter;selectedProjectRequest='';renderPackaging();}));
$('#adminTypeFilter').addEventListener('change',event=>{ activeType=event.target.value; $$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminType===activeType)); renderRows(); });
$('#adminStatusFilter').addEventListener('change',renderRows); $('#adminSearch').addEventListener('input',renderRows);
$('#adminSort').addEventListener('change',renderRows);
$('#adminRefresh').addEventListener('click',()=>loadInbox({ announce:true }).catch(error=>{ $('#adminSyncStatus').textContent='Refresh failed'; alert(error.message); }));
$('#adminClearFilters').addEventListener('click',()=>{ activeType='all'; $('#adminTypeFilter').value='all'; $('#adminStatusFilter').value='all'; $('#adminSort').value='newest'; $('#adminSearch').value=''; $$('[data-admin-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminType==='all')); renderRows(); });
$('#adminEmptyReset').addEventListener('click',()=>$('#adminClearFilters').click());
$$('[data-summary-status]').forEach(button=>button.addEventListener('click',()=>{ $('#adminStatusFilter').value=button.dataset.summaryStatus; renderRows(); $('#adminRows').closest('.admin-table-wrap').scrollIntoView({ behavior:'smooth', block:'start' }); }));
$('#adminSignout').addEventListener('click',()=>{ sessionStorage.removeItem(TOKEN_KEY); selectedReference=''; selectedProjectRequest=''; submissions=[]; projectRequests=[]; showLogin('Signed out of this browser.'); });

const authError=captureMagicLink();
if (authError) showLogin(authError,true); else if (token()) loadInbox().catch(error=>showLogin(error.message,true)); else showLogin();
