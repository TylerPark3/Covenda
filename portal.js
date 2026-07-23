const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const ACCESS_KEY = 'covendaMemberAccessToken';
const REFRESH_KEY = 'covendaMemberRefreshToken';
const EXPIRY_KEY = 'covendaMemberExpiry';

const state = { dashboard: null, view: 'overview', applyProject: null, messageProjectId: null };
const roleLabels = { student: 'Student', company: 'Company', university: 'University partner' };
const statusLabels = { draft:'Draft', scoping:'In scoping', open:'Open', matched:'Matched', in_progress:'In progress', review:'In review', complete:'Complete', archived:'Archived' };
const intakeStatusLabels = { received:'Received', reviewing:'In review', needs_information:'Needs information', packet_proposed:'Packet proposed', approval_pending:'Approval pending', approved:'Approved', declined:'Declined', archived:'Archived' };
const intakeTypeLabels = { student_interest:'Student interest', employer_intake:'Company problem', university_partner:'University roster', call_request:'Call request' };
const applicationStatusLabels = { submitted:'Interest sent', reviewing:'In review', shortlisted:'Shortlisted', accepted:'Accepted', declined:'Not selected', withdrawn:'Withdrawn' };
const statusProgress = { draft:8, scoping:20, open:30, matched:42, in_progress:65, review:86, complete:100, archived:100 };

function icon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`); svg.append(use); return svg;
}
function text(value) { return value === null || value === undefined ? '' : String(value); }
function titleCase(value) { return text(value).replaceAll('_',' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }); }
function initial(name) { return text(name).trim().charAt(0).toUpperCase() || 'C'; }
function session() { return { accessToken:sessionStorage.getItem(ACCESS_KEY)||'', refreshToken:sessionStorage.getItem(REFRESH_KEY)||'', expiresAt:Number(sessionStorage.getItem(EXPIRY_KEY)||0) }; }
function saveSession(data) { if (data.accessToken) sessionStorage.setItem(ACCESS_KEY,data.accessToken); if (data.refreshToken) sessionStorage.setItem(REFRESH_KEY,data.refreshToken); if (data.expiresAt) sessionStorage.setItem(EXPIRY_KEY,String(data.expiresAt)); }
function clearSession() { sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(REFRESH_KEY); sessionStorage.removeItem(EXPIRY_KEY); }
function setLoginMessage(message, error=false) { const root=$('#memberLoginMessage'); root.textContent=message; root.classList.toggle('is-error',error); }
function setDialogMessage(id,message,error=false) { const root=$(id); root.textContent=message; root.classList.toggle('is-error',error); }

function friendlyAuthError(code, description) {
  const detail=text(description).replaceAll('+',' ');
  if (/provider.*(disabled|not enabled)|unsupported provider/i.test(`${code} ${detail}`)) return 'Google sign-in is not connected in the Covenda Supabase project yet. You can use email while an owner finishes the Google provider setup.';
  if (/redirect|not allowed/i.test(`${code} ${detail}`)) return 'Supabase rejected the return address. Confirm covenda.app/portal.html is in Authentication → URL Configuration.';
  if (/access_denied|cancel/i.test(`${code} ${detail}`)) return 'Google sign-in was cancelled. No account changes were made.';
  return detail || 'Sign-in could not be completed. Please try again.';
}

function captureAuthRedirect() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const params = hash.has('access_token') || hash.has('error') || hash.has('error_description') ? hash : query;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresAt = params.get('expires_at');
  const errorCode = params.get('error_code') || params.get('error');
  const error = params.get('error_description') || params.get('error_message');
  if (accessToken) saveSession({ accessToken, refreshToken, expiresAt });
  if (accessToken || errorCode || error) history.replaceState({},document.title,location.pathname);
  return errorCode || error ? friendlyAuthError(errorCode,error) : '';
}

async function checkAuthReadiness() {
  const button=$('#googleLogin');
  const note=$('#googleReadiness');
  try {
    const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'auth-readiness'})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok||result.googleConfigured===null)return;
    if(result.googleConfigured===false){button.disabled=true;$('span',button).textContent='Google sign-in setup pending';note.textContent='Email sign-in is available now. A Covenda owner still needs to enable Google in the connected Supabase project.';note.hidden=false;}
  } catch { /* Keep both sign-in options visible when readiness cannot be checked. */ }
}

async function refreshMemberSession() {
  const current = session();
  if (!current.refreshToken) return false;
  const response = await fetch('/api/portal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'refresh-session', refreshToken:current.refreshToken }) });
  const result = await response.json().catch(()=>({}));
  if (!response.ok || !result.ok) { clearSession(); return false; }
  saveSession(result); return true;
}

async function portalRequest(options={}, retry=true) {
  const current = session();
  if (current.expiresAt && current.expiresAt * 1000 < Date.now() + 30_000 && await refreshMemberSession()) return portalRequest(options,false);
  const response = await fetch('/api/portal', { ...options, headers:{ Authorization:`Bearer ${session().accessToken}`, 'Content-Type':'application/json', ...(options.headers||{}) } });
  const result = await response.json().catch(()=>({ ok:false,error:'The server returned an unreadable response.' }));
  if (response.status===401 && retry && await refreshMemberSession()) return portalRequest(options,false);
  if (response.status===401) { clearSession(); showAuth('Your session ended. Sign in again.',true); throw new Error('Session ended.'); }
  if (!response.ok || !result.ok) throw new Error(result.error||'The portal request failed.');
  return result;
}

function showAuth(message='',error=false) { $('#portalAuth').hidden=false; $('#portalLoading').hidden=true; $('#memberShell').hidden=true; if(message)setLoginMessage(message,error); }
function showLoading() { $('#portalAuth').hidden=true; $('#portalLoading').hidden=false; $('#memberShell').hidden=true; }
function showMember() { $('#portalAuth').hidden=true; $('#portalLoading').hidden=true; $('#memberShell').hidden=false; }

async function loadDashboard() {
  showLoading();
  try {
    const dashboard=await portalRequest(); state.dashboard=dashboard; showMember(); renderDashboard();
    if (shouldOnboard(dashboard.profile)) startOnboarding();
    else handleCheckoutReturn();
  } catch(error) { if(session().accessToken) showAuth(error.message,true); }
}

function profileCompletion(profile) {
  if (!profile) return 0;
  const values=[profile.display_name,profile.headline,profile.bio,profile.skills?.length,profile.role==='student'?profile.school_name:profile.organization_name];
  // The onboarding flow collects a student's verticals/work types, so they count toward 100%.
  if(profile.role==='student')values.push(profile.verticals?.length,profile.work_types?.length);
  return Math.round(values.filter(Boolean).length/values.length*100);
}

function setView(view) {
  const allowed=['overview','projects','activity','discover','portfolio','messages','wallet'];
  state.view=allowed.includes(view)?view:'overview';
  $$('[data-portal-view]').forEach(section=>section.classList.toggle('is-active',section.dataset.portalView===state.view));
  $$('[data-view]').forEach(button=>button.classList.toggle('is-active',button.closest('.member-nav')&&button.dataset.view===state.view));
  $('#memberBreadcrumb').textContent=`Workspace / ${titleCase(state.view)}`;
  $('.member-nav').classList.remove('is-open');
  window.scrollTo({top:0,behavior:'smooth'});
}

// Show the uploaded profile image when there is one, else fall back to the initial.
function paintAvatarSlot(el,url,letter){
  if(!el)return;
  if(url&&/^https:\/\//i.test(url)){el.textContent='';el.style.backgroundImage=`url("${encodeURI(url)}")`;el.classList.add('has-avatar');}
  else{el.textContent=letter;el.style.backgroundImage='';el.classList.remove('has-avatar');}
}

function renderIdentity(profile) {
  const name=profile?.display_name||state.dashboard.user.email||'Member';
  const letter=initial(name);
  $('#memberNavName').textContent=name; $('#memberNavRole').textContent=roleLabels[profile?.role]||'Setup needed';
  paintAvatarSlot($('#memberInitial'),profile?.avatar_url,letter); paintAvatarSlot($('#headerInitial'),profile?.avatar_url,letter); $('#headerName').textContent=name;
  $('#memberHeaderStatus').textContent=profile?`${roleLabels[profile.role]} account · Private`:'Complete setup to continue';
}

function renderDashboard() {
  const { profile,projects,opportunities,applications,intakes=[],messages=[] }=state.dashboard;
  renderIdentity(profile);
  const role=profile?.role;
  $$('[data-student-only]').forEach(el=>el.hidden=role!=='student');
  $$('[data-org-only]').forEach(el=>el.hidden=!['company','university'].includes(role));
  $('#portfolioNavLabel').textContent=role==='company'?'Student portfolios':'Portfolio';
  $('#projectCount').textContent=projects.length;
  $('#intakeCount').textContent=intakes.length;
  $('#messageCount').textContent=messages.length;
  $('#opportunityCount').textContent=opportunities.length;
  $('#newProject').hidden=!['company','university'].includes(role);
  const now=new Date(); $('#welcomeDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const first=profile?.display_name?.split(/\s+/)[0]; $('#welcomeTitle').textContent=first?`Good ${dayPart()}, ${first}.`:`Good ${dayPart()}.`;
  $('#welcomeCopy').textContent=role==='student'?'Track your current work and find the next project that fits you.':role==='company'?'Keep projects moving and discover students through real evidence.':role==='university'?'See the projects and opportunities connected to your partner account.':'Complete your member profile to open your private workspace.';
  const primary=$('#primaryAction'); $('span',primary).textContent=role==='student'?'Discover projects':role==='company'||role==='university'?'Post a project':'Complete profile';
  primary.dataset.target=role==='student'?'discover':role==='company'||role==='university'?'new-project':'profile';
  renderFocus(); renderMetrics(); renderProgress(); renderActions(); renderProjects(); renderActivity(); renderDiscover(); renderPortfolio(); renderMessages(); renderWallet();
}

function dayPart(){const hour=new Date().getHours();return hour<12?'morning':hour<17?'afternoon':'evening';}

function renderFocus(){
  const root=$('#focusProject');root.replaceChildren();const role=state.dashboard.profile?.role;
  const project=state.dashboard.projects.find(item=>!['complete','archived'].includes(item.status))||state.dashboard.projects[0];
  $('#focusTitle').textContent=role==='student'?'Your project tracker':'Project operations';
  if(role==='student')root.append(rungBadge());
  if(!project){const empty=document.createElement('div');empty.className='empty-line';const h=document.createElement('h3');h.textContent=role==='student'?'No assigned project yet.':'No project posted yet.';const p=document.createElement('p');p.textContent=role==='student'?'Discover reviewed opportunities or complete your profile while Covenda routes a fit.':'Create a private draft first, then make it visible when the scope is ready.';const button=document.createElement('button');button.type='button';button.textContent=role==='student'?'Browse open projects →':'Start a project →';button.addEventListener('click',()=>role==='student'?setView('discover'):openIntake());empty.append(h,p,button);root.append(empty);return;}
  const row=document.createElement('article');row.className='project-focus';const copy=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;const meta=document.createElement('div');meta.className='project-focus-meta';meta.append(pill(statusLabels[project.status]||project.status,'status-pill',project.status));if(project.target_date)meta.append(pill(`Due ${dateLabel(project.target_date)}`));copy.append(h,p,meta);const actions=projectActionNode(project);if(actions)copy.append(actions);const progress=document.createElement('div');progress.className='project-progress';const track=document.createElement('div');const fill=document.createElement('i');fill.style.width=`${statusProgress[project.status]||10}%`;track.append(fill);const label=document.createElement('span');label.textContent=`${statusProgress[project.status]||10}% through workflow`;progress.append(track,label);row.append(copy,progress);root.append(row);
}
function pill(label,className='skill-pill',status=''){const span=document.createElement('span');span.className=className;span.textContent=label;if(status)span.dataset.status=status;return span;}

// --- Close-the-loop UI: role- and status-aware actions on a project ---
function rungBadge(){
  const d=state.dashboard;const verified=d.verifiedCount||0;const active=(d.projects||[]).some(pr=>['in_progress','review'].includes(pr.status));
  const label=verified>=1?'Employer-Verified':active?'Role in progress':'Building proof';
  const wrap=document.createElement('div');wrap.className='rung-badge'+(verified>=1?' is-verified':'');wrap.append(icon(verified>=1?'p-check':'p-compass'));
  const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=label;const span=document.createElement('span');span.textContent=verified>=1?`${verified} verified work ${verified===1?'record':'records'} · your evidence is employer-accepted`:'Complete reviewed work to reach Employer-Verified.';box.append(strong,span);wrap.append(box);return wrap;
}
function actionButton(label,iconId,onClick){const b=document.createElement('button');b.type='button';b.className='portal-primary compact';const s=document.createElement('span');s.textContent=label;b.append(s,icon(iconId));b.addEventListener('click',onClick);return b;}
// Did this project lead to more? Captured on completion so Covenda can price a placement
// fee later on real conversion rates. No fee logic — recording only.
const CONVERSION_OPTIONS=[['none','Not yet'],['continued','More work together'],['interview','Led to an interview'],['internship','Internship offer'],['full_time','Full-time hire'],['referred_on','Referred them onward']];
const conversionLabels=Object.fromEntries(CONVERSION_OPTIONS);
function conversionControl(project){
  const wrap=document.createElement('div');wrap.className='conversion-control';
  const label=document.createElement('label');label.className='conversion-label';
  const span=document.createElement('span');span.textContent='Did working together lead to anything more?';
  const select=document.createElement('select');
  CONVERSION_OPTIONS.forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;if((project.conversion_outcome||'none')===value)o.selected=true;select.append(o);});
  label.append(span,select);
  const status=document.createElement('small');status.className='conversion-status';
  status.textContent=project.conversion_recorded_at?`Saved · ${dateLabel(project.conversion_recorded_at)}`:'This helps Covenda place students like this — it is not shared publicly.';
  select.addEventListener('change',async()=>{
    select.disabled=true;status.textContent='Saving…';
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'record-conversion',projectId:project.id,outcome:select.value})});
      project.conversion_outcome=select.value;status.textContent='Saved. Thank you — this shapes who we route to you next.';}
    catch(error){status.textContent=error.message;}
    finally{select.disabled=false;}
  });
  wrap.append(label,status);return wrap;
}
function loopNote(iconId,title,copy){const d=document.createElement('div');d.className='loop-note';d.append(icon(iconId));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;box.append(strong,small);d.append(box);return d;}
function verifiedCard(project,{full=false}={}){const card=document.createElement('div');card.className='verified-record';const head=document.createElement('div');head.className='verified-head';head.append(icon('p-check'));const badge=document.createElement('span');badge.textContent='Verified work record';head.append(badge);const h=document.createElement('h3');h.textContent=project.title;card.append(head,h);if(full&&project.summary){const s=document.createElement('p');s.className='verified-summary';s.textContent=project.summary;card.append(s);}const p=document.createElement('p');p.textContent=`Reviewer accepted${project.completed_at?` · ${dateLabel(project.completed_at)}`:''}`;card.append(p);return card;}
function projectActionNode(project){
  const d=state.dashboard;const role=d.profile?.role;const isOwner=project.owner_user_id===d.user.id;const isAssigned=project.assigned_student_user_id===d.user.id;
  const wrap=document.createElement('div');wrap.className='project-actions';
  if(role==='student'&&isAssigned&&project.status==='in_progress'){if(project.review_note){const note=document.createElement('p');note.className='revise-note';note.append(icon('p-clock'));const s=document.createElement('span');s.textContent=`Changes requested: ${project.review_note}`;note.append(s);wrap.append(note);}wrap.append(actionButton(project.review_note?'Resubmit your work':'Submit your work','p-arrow',()=>openSubmitWork(project)));return wrap;}
  if(isAssigned&&project.status==='review'){wrap.append(loopNote('p-clock','In review','Your work is with the reviewer. The decision will appear here.'));return wrap;}
  if(isAssigned&&project.status==='complete'){wrap.append(verifiedCard(project));return wrap;}
  if(isOwner&&project.status==='review'){wrap.append(loopNote('p-inbox','Deliverable submitted','A student submitted work for your review.'));wrap.append(actionButton('Review deliverable','p-check',()=>openReview(project)));return wrap;}
  if(isOwner&&project.status==='complete'){wrap.append(loopNote('p-check','Accepted','You accepted this work — the student now holds a verified record, and the escrow has been released.'));wrap.append(conversionControl(project));return wrap;}
  // Cancelling is money-moving and irreversible, so it arms on the first click and only
  // sends on the second.
  if(isOwner&&!['complete','archived'].includes(project.status)&&((Number(project.credits_held)||0)+(Number(project.platform_fee_credits)||0))>0){
    wrap.append(cancelProjectButton(project));
    return wrap;
  }
  return null;
}
function cancelProjectButton(project){
  const refund=(Number(project.credits_held)||0)+(Number(project.platform_fee_credits)||0);
  const label=`Cancel project · refund ${refund.toLocaleString()} credits`;
  const b=document.createElement('button');b.type='button';b.className='portal-ghost cancel-project';b.textContent=label;
  let armed=false,timer=0;
  b.addEventListener('click',async()=>{
    if(!armed){armed=true;b.textContent='Click again to confirm the refund';b.classList.add('is-armed');timer=window.setTimeout(()=>{armed=false;b.textContent=label;b.classList.remove('is-armed');},5000);return;}
    window.clearTimeout(timer);b.disabled=true;b.textContent='Cancelling…';
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'cancel-project',projectId:project.id})});await loadDashboard();setView('projects');}
    catch(error){b.textContent=error.message;b.disabled=false;armed=false;b.classList.remove('is-armed');}
  });
  return b;
}
async function runAcceptApplication(applicationId,button){button.disabled=true;const original=button.textContent;button.textContent='Accepting…';try{await portalRequest({method:'POST',body:JSON.stringify({action:'accept-application',applicationId})});await loadDashboard();setView('overview');}catch(error){button.textContent=error.message;button.disabled=false;setTimeout(()=>{button.textContent=original;},4000);}}

function renderMetrics(){const root=$('#memberMetrics');root.replaceChildren();const d=state.dashboard;const role=d.profile?.role;const values=role==='student'?[[d.projects.length,'Current projects'],[d.verifiedCount||0,'Verified records'],[d.applications.length,'Applications']]:[[d.projects.length,'Posted projects'],[d.applications.length,'Student applications'],[(d.intakes||[]).length,'Form submissions']];for(const [value,label] of values){const item=document.createElement('div');item.className='metric';const strong=document.createElement('strong');strong.textContent=value;const span=document.createElement('span');span.textContent=label;item.append(strong,span);root.append(item);}}

function renderProgress(){const profile=state.dashboard.profile;const score=profileCompletion(profile);$('#profileRing').style.setProperty('--progress',`${score*3.6}deg`);$('strong',$('#profileRing')).textContent=`${score}%`;$('#profileProgressTitle').textContent=score===100?'Your profile is ready':score>=60?'Add the finishing details':'Make a strong first impression';$('#profileProgressCopy').textContent=profile?.role==='student'?'Companies see only portfolios you choose to share.':'A complete organization profile adds context to every project.';}

function renderActions(){const root=$('#nextActions');root.replaceChildren();const d=state.dashboard;const actions=[];if(profileCompletion(d.profile)<100)actions.push(['p-user','Complete your member profile','Add a headline, context, and skills.']);if(d.profile?.role==='student'&&!d.applications.length)actions.push(['p-compass','Explore your first opportunity','Open projects are ready to review.']);if(['company','university'].includes(d.profile?.role)&&!d.projects.length)actions.push(['p-plus','Create a private project draft','Start with the outcome and useful deliverable.']);if(!actions.length)actions.push(['p-check','You are caught up','New project activity will appear here.']);for(const [iconId,title,copy] of actions){const li=document.createElement('li');const mark=document.createElement('span');mark.append(icon(iconId));const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;div.append(strong,small);li.append(mark,div);root.append(li);}}

function emptyList(root,iconId,title,copy){root.replaceChildren();const box=document.createElement('div');box.className='list-empty';const mark=document.createElement('span');mark.append(icon(iconId));const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=copy;box.append(mark,h,p);root.append(box);}

function renderProjects(){const root=$('#projectList');const items=state.dashboard.projects;root.replaceChildren();if(!items.length){emptyList(root,'p-project','No projects in this workspace yet.',state.dashboard.profile?.role==='student'?'Assigned work will appear here with its status and due date.':'Post a private draft when you are ready to shape the first project.');return;}for(const project of items){if(project.status==='complete'){root.append(verifiedCard(project,{full:true}));continue;}const row=document.createElement('article');row.className='list-row';const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;main.append(h,p);const status=document.createElement('div');status.className='list-cell';const statusSmall=document.createElement('small');statusSmall.textContent='Status';status.append(statusSmall,pill(statusLabels[project.status]||titleCase(project.status),'status-pill',project.status));const due=cell('Target',project.target_date?dateLabel(project.target_date):'Not scheduled');const visibility=cell('Visibility',titleCase(project.visibility));row.append(main,status,due,visibility);root.append(row);}}
function cell(label,value){const div=document.createElement('div');div.className='list-cell';const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;div.append(small,strong);return div;}

function renderActivity(){
  const d=state.dashboard;const intakes=d.intakes||[];const applications=d.applications||[];const intakeRoot=$('#intakeList');const applicationRoot=$('#applicationList');
  $('#intakeSummary').textContent=`${intakes.length} ${intakes.length===1?'submission':'submissions'}`;
  $('#applicationSummary').textContent=`${applications.length} ${applications.length===1?'application':'applications'}`;
  $('#applicationTitle').textContent=d.profile?.role==='student'?'Your project interest':'Student applications';
  intakeRoot.replaceChildren();
  if(!intakes.length){emptyList(intakeRoot,'p-inbox','No linked form submissions yet.','Use the same email on a Covenda website form and in this portal account. The receipt will appear here after it reaches Supabase.');}
  else for(const intake of intakes){const row=document.createElement('article');row.className='activity-row';const marker=document.createElement('span');marker.className='activity-marker';marker.append(icon('p-check'));const main=document.createElement('div');const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(intakeTypeLabels[intake.submission_type]||titleCase(intake.submission_type)),pill(intakeStatusLabels[intake.status]||titleCase(intake.status),'status-pill',intake.status));const h=document.createElement('h3');h.textContent=intake.summary;const details=document.createElement('p');details.textContent=`Receipt ${intake.reference} · Submitted ${dateLabel(intake.created_at)}`;main.append(meta,h,details);row.append(marker,main);intakeRoot.append(row);}
  applicationRoot.replaceChildren();
  if(!applications.length){emptyList(applicationRoot,'p-compass',d.profile?.role==='student'?'No project applications yet.':'No student applications yet.',d.profile?.role==='student'?'When you send interest in a project, its review status will appear here.':'Applications will appear after students express interest in your open projects.');return;}
  const knownProjects=[...(d.projects||[]),...(d.opportunities||[])];
  for(const application of applications){const project=knownProjects.find(item=>item.id===application.project_id);const row=document.createElement('article');row.className='activity-row';const marker=document.createElement('span');marker.className='activity-marker';marker.append(icon('p-project'));const main=document.createElement('div');const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(applicationStatusLabels[application.status]||titleCase(application.status),'status-pill',application.status));const h=document.createElement('h3');h.textContent=project?.title||'Covenda project application';const details=document.createElement('p');details.textContent=`Updated ${dateLabel(application.updated_at||application.created_at)}`;main.append(meta,h,details);if(d.profile?.role!=='student'&&project&&['open','matched'].includes(project.status)&&['submitted','reviewing','shortlisted'].includes(application.status)){const accept=document.createElement('button');accept.type='button';accept.className='row-action';accept.textContent='Accept applicant';accept.addEventListener('click',()=>runAcceptApplication(application.id,accept));main.append(accept);}row.append(marker,main);applicationRoot.append(row);}
}

// ===== Wallet & credits (company/university) =====
// 1 credit = $1. The cost model mirrors projectCreditCost() on the server exactly — if
// one changes, change both.
const REACH_FEE_TARGETED=25;
const PLATFORM_FEE_RATE=0.10;
const CREDIT_BUNDLES=[[100,100],[500,475],[1000,900]];
const ledgerLabels={purchase:'Purchase',reach_fee:'Reach fee',escrow_hold:'Escrow held',escrow_release:'Paid to student',platform_fee:'Platform fee',refund:'Refund',adjustment:'Adjustment'};
function projectCreditCost(creditsListed,targeting){
  const listed=Math.max(0,Math.round(Number(creditsListed)||0));
  const reachFee=targeting==='targeted'?REACH_FEE_TARGETED:0;
  const platformFee=Math.round(listed*PLATFORM_FEE_RATE);
  return {listed,reachFee,platformFee,total:listed+reachFee+platformFee};
}
function projectTitleFor(projectId){return (state.dashboard.projects||[]).find(p=>p.id===projectId)?.title||'';}
const PAYOUT_METHODS=['PayPal','Zelle','Bank transfer','Other'];
function renderPayout(){
  const root=$('#payoutState');if(!root)return;
  const d=state.dashboard;const balance=Number(d.walletBalance)||0;
  const open=(d.payoutRequests||[]).find(r=>r.status==='requested');
  root.replaceChildren();
  if(open){
    const card=document.createElement('div');card.className='payout-pending';
    const strong=document.createElement('strong');strong.textContent=`${Number(open.credits).toLocaleString()} credits requested`;
    const small=document.createElement('small');small.textContent=`${open.method||'—'} · ${open.handle||''} · requested ${dateLabel(open.requested_at)}. Covenda will be in touch to arrange the transfer.`;
    const cancel=document.createElement('button');cancel.type='button';cancel.className='portal-ghost';cancel.textContent='Cancel this request';
    cancel.addEventListener('click',async()=>{cancel.disabled=true;setDialogMessage('#payoutMessage','Cancelling…');
      try{await portalRequest({method:'POST',body:JSON.stringify({action:'cancel-payout',requestId:open.id})});await loadDashboard();setView('wallet');}
      catch(error){setDialogMessage('#payoutMessage',error.message,true);cancel.disabled=false;}});
    card.append(strong,small,cancel);root.append(card);return;
  }
  if(balance<=0){
    const empty=document.createElement('p');empty.className='payout-empty';
    empty.textContent='Complete a reviewed project and your earnings will appear here, ready to request.';
    root.append(empty);return;
  }
  // Payout eligibility gate: a student with earnings must pass identity verification (and be
  // 18+) before they can request a payout. Show the verify CTA in place of the form.
  const profile=d.profile||{};
  // Identity collection is off until COVENDA_IDENTITY_ENABLED is set (legal/privacy gate) —
  // when off, don't surface a verify button that leads nowhere; show a neutral note instead.
  if(profile.role==='student'&&!profile.identity_verified&&!d.identityEnabled){
    const note=document.createElement('p');note.className='payout-empty';
    note.textContent='Withdrawals are opening soon — we’ll let you know the moment you can cash out your earnings.';
    root.append(note);return;
  }
  if(profile.role==='student'&&!profile.identity_verified){
    const gate=document.createElement('div');gate.className='payout-gate';
    const g=document.createElement('strong');g.textContent='Verify your identity to receive payouts';
    const gs=document.createElement('small');gs.textContent='A quick ID check (photo of your ID + a selfie) confirms you’re a real, 18+ student. Covenda never sees your ID — Stripe handles it securely.';
    const gb=document.createElement('button');gb.type='button';gb.className='portal-primary compact';gb.textContent='Verify identity';
    gb.addEventListener('click',()=>runVerifyIdentity(gb));
    gate.append(g,gs,gb);root.append(gate);return;
  }
  if(profile.role==='student'&&profile.identity_verified&&!profile.identity_18plus){
    const note=document.createElement('p');note.className='payout-empty';
    note.textContent='Payouts are available to verified members who are 18 or older.';
    root.append(note);return;
  }
  const form=document.createElement('div');form.className='payout-form';
  const amount=document.createElement('label');amount.className='payout-field';
  const amountLabel=document.createElement('span');amountLabel.textContent='Amount (credits)';
  const amountInput=document.createElement('input');amountInput.type='number';amountInput.min='1';amountInput.max=String(balance);amountInput.value=String(balance);
  amount.append(amountLabel,amountInput);
  const method=document.createElement('label');method.className='payout-field';
  const methodLabel=document.createElement('span');methodLabel.textContent='How should we pay you?';
  const methodSelect=document.createElement('select');
  PAYOUT_METHODS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;methodSelect.append(o);});
  method.append(methodLabel,methodSelect);
  const handle=document.createElement('label');handle.className='payout-field';
  const handleLabel=document.createElement('span');handleLabel.textContent='Email or handle';
  const handleInput=document.createElement('input');handleInput.type='text';handleInput.placeholder='you@example.com';
  const handleHelp=document.createElement('small');handleHelp.textContent='Never enter a bank or card number — Covenda arranges the transfer with you directly.';
  handle.append(handleLabel,handleInput,handleHelp);
  const submit=document.createElement('button');submit.type='button';submit.className='portal-primary compact';submit.textContent='Request payout';
  submit.addEventListener('click',async()=>{
    submit.disabled=true;setDialogMessage('#payoutMessage','Sending your request…');
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'request-payout',credits:Number(amountInput.value),method:methodSelect.value,handle:handleInput.value})});await loadDashboard();setView('wallet');setDialogMessage('#payoutMessage','');}
    catch(error){setDialogMessage('#payoutMessage',error.message,true);submit.disabled=false;}
  });
  form.append(amount,method,handle,submit);root.append(form);
}
function renderWallet(){
  const d=state.dashboard;const balance=Number(d.walletBalance)||0;const role=d.profile?.role;
  const nav=$('#walletNavBalance');if(nav)nav.textContent=balance.toLocaleString();
  const balanceEl=$('#walletBalance');if(!balanceEl)return;
  balanceEl.textContent=balance.toLocaleString();
  const intro=$('#walletIntro');
  if(intro)intro.textContent=role==='student'
    ? '1 credit = $1. Credits arrive when a company accepts your work — you receive the full listed amount, never less. Request a payout whenever you like.'
    : '1 credit = $1. Posting publicly is free; a hyper-narrow post routes to matched, referred students for 25 credits. Covenda’s fee is 10% of the listed amount, charged on top — the student always receives the full amount you list.';
  const balanceLabel=$('#walletBalanceLabel');
  if(balanceLabel)balanceLabel.textContent=role==='student'?'Earned and available':'Available balance';
  const held=(d.projects||[]).reduce((sum,p)=>sum+(Number(p.credits_held)||0),0);
  $('#walletHeld').textContent=role==='student'
    ? (held?`${held.toLocaleString()} credits are held in escrow for work you have in progress.`:'Credits are released to you the moment a reviewer accepts your work.')
    : (held?`${held.toLocaleString()} credits held in escrow across active projects.`:'No credits held in escrow right now.');
  renderPayout();
  const bundles=$('#walletBundles');if(!bundles){renderWalletLedger();return;}
  bundles.replaceChildren();
  CREDIT_BUNDLES.forEach(([credits,price])=>{
    const b=document.createElement('button');b.type='button';b.className='wallet-bundle';
    const c=document.createElement('strong');c.textContent=`${credits.toLocaleString()} credits`;
    const p=document.createElement('span');p.textContent=`$${price.toLocaleString()}`;
    b.append(c,p);
    if(price<credits){const save=document.createElement('em');save.textContent=`Save ${Math.round((1-price/credits)*100)}%`;b.append(save);}
    b.addEventListener('click',()=>runBuyCredits(credits,b));
    bundles.append(b);
  });
  renderWalletLedger();
}
function renderWalletLedger(){
  const rows=state.dashboard.creditLedger||[];const root=$('#walletLedger');if(!root)return;
  root.replaceChildren();
  $('#walletLedgerCount').textContent=`${rows.length} ${rows.length===1?'entry':'entries'}`;
  if(!rows.length){emptyList(root,'p-inbox','No credit activity yet.','Buying credits or posting a project will show up here.');return;}
  // rows arrive newest-first; walk oldest-first to build the running balance, then flip back
  let running=0;
  const withRunning=[...rows].reverse().map(row=>{running+=Number(row.credits)||0;return {...row,running};}).reverse();
  const table=document.createElement('div');table.className='ledger-table';
  const head=document.createElement('div');head.className='ledger-row ledger-head';
  ['Date','Type','Project','Credits','Balance'].forEach(label=>{const s=document.createElement('span');s.textContent=label;head.append(s);});
  table.append(head);
  withRunning.forEach(row=>{
    const tr=document.createElement('div');tr.className='ledger-row';
    const date=document.createElement('span');date.textContent=dateLabel(row.created_at);
    const type=document.createElement('span');type.append(pill(ledgerLabels[row.entry_type]||titleCase(row.entry_type),'status-pill',row.entry_type));
    const proj=document.createElement('span');proj.className='ledger-project';proj.textContent=projectTitleFor(row.project_id)||'—';
    const amt=document.createElement('span');amt.className='ledger-amount'+(row.credits<0?' is-negative':' is-positive');amt.textContent=(row.credits>0?'+':'')+row.credits.toLocaleString();
    const bal=document.createElement('span');bal.className='ledger-balance';bal.textContent=row.running.toLocaleString();
    tr.append(date,type,proj,amt,bal);table.append(tr);
  });
  root.append(table);
}
async function runBuyCredits(credits,button){
  button.disabled=true;setDialogMessage('#walletMessage','Starting secure checkout…');
  try{
    // Money in: try Stripe Checkout first. Stripe hosts the card form — we never see card
    // data and only get back a URL to send the buyer to. Credits are granted later, by the
    // webhook, once Stripe confirms payment (see api/stripe-webhook.js).
    const res=await fetch('/api/stripe-checkout',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({credits})});
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.url){location.assign(data.url);return;}
    // Stripe not wired up yet (dev/test): fall back to the internal operator grant, which is
    // itself gated server-side (allowlist / feature flag) so a normal buyer can't self-grant.
    if(data.code==='STRIPE_NOT_CONFIGURED'){
      await portalRequest({method:'POST',body:JSON.stringify({action:'buy-credits',credits})});
      await loadDashboard();setView('wallet');setDialogMessage('#walletMessage','');return;
    }
    throw new Error(data.error||'Could not start checkout.');
  }
  catch(error){setDialogMessage('#walletMessage',error.message,true);button.disabled=false;}
}

// After returning from Stripe (Checkout or Identity) the URL carries a status param. Surface
// it, then strip the param so a refresh doesn't replay it. Both the credit grant and the
// identity result land asynchronously via the webhook, so we tell the member it may take a moment.
function handleCheckoutReturn(){
  const params=new URLSearchParams(location.search);
  const wallet=params.get('wallet');const identity=params.get('identity');
  if(!wallet&&!identity)return;
  history.replaceState(null,'',location.pathname);
  if(wallet==='paid'){setView('wallet');setDialogMessage('#walletMessage','Payment received — your credits will appear here within a few seconds.');}
  else if(wallet==='cancelled'){setView('wallet');setDialogMessage('#walletMessage','Checkout cancelled — no charge was made.',true);}
  else if(identity==='submitted'){setView('wallet');setDialogMessage('#payoutMessage','Thanks — your ID was submitted. Your verified badge appears once Stripe approves it (usually under a minute).');}
}

// Start Stripe Identity: photograph an ID + selfie on Stripe's hosted page. Covenda never
// sees the document — we only learn the result later, via the webhook.
async function runVerifyIdentity(button){
  button.disabled=true;setDialogMessage('#payoutMessage','Opening secure identity check…');
  try{
    const res=await fetch('/api/stripe-identity',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({})});
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.url){location.assign(data.url);return;}
    if(data.code==='STRIPE_NOT_CONFIGURED'||data.code==='IDENTITY_DISABLED'){setDialogMessage('#payoutMessage','Identity verification isn’t switched on yet.',true);button.disabled=false;return;}
    throw new Error(data.error||'Could not start identity verification.');
  }catch(error){setDialogMessage('#payoutMessage',error.message,true);button.disabled=false;}
}

function selectMessageProject(projectId){state.messageProjectId=projectId;renderMessages();}

function renderMessages(){
  const d=state.dashboard;const projects=d.projects||[];const messages=d.messages||[];const projectRoot=$('#messageProjects');const thread=$('#messageThread');const form=$('#messageForm');
  projectRoot.replaceChildren();
  if(!projects.length){state.messageProjectId=null;$('#messageProjectTitle').textContent='No project conversations yet';$('#messageProjectStatus').textContent='';form.hidden=true;emptyList(thread,'p-message','Messages begin with a project.','Once a project is posted or assigned, its private thread will appear here.');return;}
  if(!projects.some(project=>project.id===state.messageProjectId))state.messageProjectId=projects[0].id;
  for(const project of projects){const projectMessages=messages.filter(message=>message.project_id===project.id);const button=document.createElement('button');button.type='button';button.className=project.id===state.messageProjectId?'is-active':'';const title=document.createElement('strong');title.textContent=project.title;const meta=document.createElement('span');meta.textContent=`${statusLabels[project.status]||titleCase(project.status)} · ${projectMessages.length} ${projectMessages.length===1?'message':'messages'}`;button.append(title,meta);button.addEventListener('click',()=>selectMessageProject(project.id));projectRoot.append(button);}
  const project=projects.find(item=>item.id===state.messageProjectId);$('#messageProjectTitle').textContent=project.title;$('#messageProjectStatus').textContent=statusLabels[project.status]||titleCase(project.status);form.hidden=false;thread.replaceChildren();
  const projectMessages=messages.filter(message=>message.project_id===project.id);
  if(!projectMessages.length){emptyList(thread,'p-message','Start the project thread.','Share a scope question, milestone, or review note. It will remain attached to this project.');return;}
  for(const message of projectMessages){const own=message.author_user_id===d.user.id;const article=document.createElement('article');article.className=`message-bubble${own?' is-own':''}`;const author=document.createElement('strong');author.textContent=own?'You':'Project participant';const body=document.createElement('p');body.textContent=message.body;const time=document.createElement('time');time.dateTime=message.created_at;time.textContent=new Date(message.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});article.append(author,body,time);thread.append(article);}
  thread.scrollTop=thread.scrollHeight;
}

function renderDiscover(){
  const d=state.dashboard;const root=$('#opportunityList');const query=$('#discoverSearch').value.trim().toLowerCase();
  const items=d.opportunities.filter(project=>[project.title,project.summary,...(project.desired_skills||[])].join(' ').toLowerCase().includes(query));
  $('#discoverCount').textContent=`${items.length} open ${items.length===1?'project':'projects'}`;
  root.replaceChildren();
  const matchedCount=d.matchedCount||0;const verticals=(d.profile?.verticals||[]).filter(v=>v&&v!=='Not sure yet — show me everything');
  if(!query&&matchedCount>0){const hi=document.createElement('div');hi.className='discover-highlight';hi.append(icon('p-compass'));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=`${matchedCount} open ${matchedCount===1?'project':'projects'} in your ${verticals.length?'vertical':'areas'}${verticals.length?` (${verticals.join(', ')})`:''}`;const small=document.createElement('small');small.textContent='Matched to the work you chose during onboarding — shown first below.';box.append(strong,small);hi.append(box);root.append(hi);}
  if(!items.length){emptyList(root,'p-compass',query?'No projects match that search.':'No open projects right now.','Covenda will place reviewed opportunities here as companies and universities make them available.');return;}
  for(const project of items){const row=document.createElement('article');row.className='list-row'+(project.matched?' is-matched':'');const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;main.append(h);if(project.matched)main.append(pill('Matched to your vertical','match-pill'));const p=document.createElement('p');p.textContent=project.summary;main.append(p);const skills=cell('Skills',(project.desired_skills||[]).join(', ')||'Open fit');const due=cell('Target',project.target_date?dateLabel(project.target_date):'Flexible');const applied=d.applications.some(app=>app.project_id===project.id);const button=document.createElement('button');button.type='button';button.textContent=applied?'Interest sent':'View & apply';button.disabled=applied;button.addEventListener('click',()=>openApply(project));row.append(main,skills,due,button);root.append(row);}
}

// "Identity verified ✓" credibility badge — shown wherever a verified member's name appears.
function identityBadge(){const b=document.createElement('span');b.className='identity-badge';b.title='Identity verified with a government ID via Stripe';b.append(icon('p-check'));const t=document.createElement('span');t.textContent='Identity verified';b.append(t);return b;}
function renderPortfolio(){const root=$('#portfolioContent');root.replaceChildren();const {profile,studentDirectory}=state.dashboard;if(profile?.role==='company'){$('#portfolioEyebrow').textContent='Member talent';$('#portfolioTitle').textContent='Student portfolios';$('#portfolioIntro').textContent='Discover students who chose to share their profile with signed-in company members.';$('#editProfile').hidden=false;if(!studentDirectory.length){emptyList(root,'p-user','No visible student portfolios yet.','Students will appear here after they finish onboarding and opt into member discovery.');return;}const list=document.createElement('div');list.className='talent-list';for(const student of studentDirectory){const row=document.createElement('article');row.className='talent-row';const h=document.createElement('h3');h.textContent=student.display_name;if(student.identity_verified)h.append(identityBadge());const p=document.createElement('p');p.textContent=[student.headline,student.school_name,student.graduation_year&&`Class of ${student.graduation_year}`].filter(Boolean).join(' · ')||'Student member';const skills=document.createElement('div');skills.className='skills';(student.skills||[]).forEach(skill=>skills.append(pill(skill)));row.append(h,p,skills);list.append(row);}root.append(list);return;}
  $('#portfolioEyebrow').textContent=profile?.role==='student'?'Your evidence':'Partner identity';$('#portfolioTitle').textContent=profile?.role==='student'?'Portfolio':'Organization profile';$('#portfolioIntro').textContent=profile?.role==='student'?'Shape how signed-in company members understand your work.':'Keep the context behind every project accurate.';$('#editProfile').hidden=false;const article=document.createElement('article');article.className='portfolio-profile';const avatar=document.createElement('div');avatar.className='portfolio-avatar';paintAvatarSlot(avatar,profile?.avatar_url,initial(profile?.display_name));const details=document.createElement('div');const h=document.createElement('h2');h.textContent=profile?.display_name||'Complete your profile';if(profile?.identity_verified)h.append(identityBadge());const headline=document.createElement('p');headline.textContent=[profile?.headline,profile?.school_name||profile?.organization_name,profile?.graduation_year&&`Class of ${profile.graduation_year}`].filter(Boolean).join(' · ')||'Add a headline and member details.';const bio=document.createElement('p');bio.textContent=profile?.bio||'Add a short introduction to help the right people understand your work.';const skills=document.createElement('div');skills.className='skills';(profile?.skills||[]).forEach(skill=>skills.append(pill(skill)));details.append(h,headline,bio,skills);article.append(avatar,details);root.append(article);}

function updateProfileFields(){const role=$('[name="role"]:checked',$('#profileForm'))?.value||state.dashboard?.profile?.role||'student';$$('[data-profile-field="organization"]').forEach(el=>el.hidden=role==='student');$$('[data-profile-field="school"],[data-profile-field="graduation"],[data-student-profile]').forEach(el=>el.hidden=role!=='student');}
function openProfile({required=false}={}){const form=$('#profileForm');const p=state.dashboard?.profile;form.reset();if(p){form.elements.role.value=p.role;form.elements.displayName.value=p.display_name||'';form.elements.organizationName.value=p.organization_name||'';form.elements.schoolName.value=p.school_name||'';form.elements.graduationYear.value=p.graduation_year||'';form.elements.headline.value=p.headline||'';form.elements.bio.value=p.bio||'';form.elements.skills.value=(p.skills||[]).join(', ');form.elements.portfolioVisibility.checked=p.portfolio_visibility!=='private';$$('[name="role"]',form).forEach(input=>input.disabled=true);}else{$$('[name="role"]',form).forEach(input=>input.disabled=false);const inferred=state.dashboard?.user?.metadata?.full_name||state.dashboard?.user?.metadata?.name||'';form.elements.displayName.value=inferred;}form.dataset.required=required?'true':'false';$$('[data-close-dialog]',form).forEach(button=>button.hidden=required);updateProfileFields();setDialogMessage('#profileMessage','');$('#profileDialog').showModal();}
function openProject(){setDialogMessage('#projectMessage','');$('#projectForm').reset();$('#projectDialog').showModal();}
function openApply(project){state.applyProject=project;$('#applyForm').reset();$('#applyForm').elements.projectId.value=project.id;$('#applyTitle').textContent=`Apply to ${project.title}.`;$('#applySummary').textContent=project.summary;setDialogMessage('#applyMessage','');$('#applyDialog').showModal();}
function openSubmitWork(project){const form=$('#submitWorkForm');form.reset();form.elements.projectId.value=project.id;$('#submitWorkTitle').textContent=`Submit your work · ${project.title}`;setDialogMessage('#submitWorkMessage','');$('#submitWorkDialog').showModal();}
function openReview(project){const form=$('#reviewForm');form.reset();form.elements.projectId.value=project.id;$('#reviewTitle').textContent=`Review · ${project.title}`;$('#reviewDeliverable').textContent=project.deliverable||'No deliverable text was provided.';const held=Number(project.credits_held)||0;
  $('#reviewSubmittedAt').textContent=[
    project.deliverable_submitted_at?`Submitted ${dateLabel(project.deliverable_submitted_at)}`:'',
    held?`Accepting releases ${held.toLocaleString()} credits to the student`:'',
  ].filter(Boolean).join(' · ');
  setDialogMessage('#reviewMessage','');$('#reviewDialog').showModal();}

// ===== Suno-style student onboarding: one question per screen (first-run students only). =====
// Company/university keep the existing #profileDialog modal; "Edit profile" is unchanged.
const ONBOARD_VERTICALS=['Accounting & finance','Software & AI','Healthcare operations','Consumer & retail','Professional services','Not sure yet — show me everything'];
const ONBOARD_WORK_TYPES=['Research','Data & spreadsheets','Operations','QA & testing','Writing & documentation'];
const ONBOARD_SCREENS=[
  {id:'role',kind:'role',headline:'How are you joining Covenda?',sub:'This sets up the right workspace for you.'},
  {id:'profile',kind:'profile',headline:"Let's set up your profile.",sub:'You can edit this at any time.'},
  {id:'verticals',kind:'multi',field:'verticals',options:ONBOARD_VERTICALS,headline:'What do you want to work on?',sub:"We'll use this to show you the right paid projects."},
  {id:'workTypes',kind:'multi',field:'workTypes',options:ONBOARD_WORK_TYPES,headline:'What kind of work fits you?',sub:'Pick the formats you want to be known for.'},
  {id:'school',kind:'text',field:'schoolName',type:'text',autocomplete:'organization',headline:'Where do you study?',sub:'Your school or university.',placeholder:'Columbia University'},
  {id:'grad',kind:'text',field:'graduationYear',type:'number',headline:'When do you graduate?',sub:'Your expected graduation year.',placeholder:'2027'},
  {id:'headline',kind:'text',field:'headline',type:'text',headline:'One line about you.',sub:'How you want to be introduced.',placeholder:'Researcher who turns messy questions into clear decisions'},
  {id:'skills',kind:'text',field:'skills',type:'text',headline:'What are you good at?',sub:'A few skills, separated by commas.',placeholder:'Research, Excel, writing'},
  {id:'about',kind:'textarea',field:'bio',headline:'Anything else worth knowing?',sub:'A short intro — optional, but it helps.',placeholder:'What you are learning, building, or looking for next.'},
  {id:'handoff',kind:'handoff',headline:"Let's find your first project.",sub:"Takes about 3 minutes. We'll guide you through it."},
];
let onboardState={step:0,values:{role:'student',verticals:[],workTypes:[]},saving:false};
function onboardKey(){const d=state.dashboard;return 'covendaOnboard:'+(d?.user?.id||d?.user?.email||'anon');}
function persistOnboard(){try{localStorage.setItem(onboardKey(),JSON.stringify({step:onboardState.step,values:onboardState.values}));}catch{}}
function clearOnboard(){try{localStorage.removeItem(onboardKey());}catch{}}
// A brand-new member, or a student who has a row but never finished onboarding.
function shouldOnboard(profile){
  if(!profile) return true;
  return profile.role==='student' && profile.onboarding_complete===false;
}
function startOnboarding(){
  const meta=state.dashboard?.user?.metadata||{};
  const profile=state.dashboard?.profile||null;
  // Prefill from an existing profile so a half-finished student resumes rather than
  // retyping, and skip the role screen when the role is already fixed.
  onboardState={step:profile?.role?1:0,values:{
    role:profile?.role||'student',
    verticals:Array.isArray(profile?.verticals)?[...profile.verticals]:[],
    workTypes:Array.isArray(profile?.work_types)?[...profile.work_types]:[],
    displayName:profile?.display_name||meta.full_name||meta.name||'',
    schoolName:profile?.school_name||'',
    graduationYear:profile?.graduation_year||'',
    headline:profile?.headline||'',
    bio:profile?.bio||'',
    skills:Array.isArray(profile?.skills)?profile.skills.join(', '):'',
    avatarUrl:profile?.avatar_url||'',
  },saving:false};
  try{const raw=localStorage.getItem(onboardKey());if(raw){const saved=JSON.parse(raw);onboardState.values={...onboardState.values,...saved.values};onboardState.step=Math.min(Math.max(saved.step||0,0),ONBOARD_SCREENS.length-1);}}catch{}
  $('#portalAuth').hidden=true;$('#portalLoading').hidden=true;$('#memberShell').hidden=true;$('#onboardFlow').hidden=false;
  renderOnboard();
}
function onboardNext(){if(onboardState.step<ONBOARD_SCREENS.length-1){onboardState.step++;persistOnboard();renderOnboard();}}
function onboardBack(){if(onboardState.step>0){onboardState.step--;persistOnboard();renderOnboard();}}
function exitOnboardToModal(role){clearOnboard();$('#onboardFlow').hidden=true;showMember();renderDashboard();openProfile({required:true});const form=$('#profileForm');form.elements.role.value=role;$$('[name="role"]',form).forEach(i=>i.disabled=true);updateProfileFields();}
function onboardCta(label,onClick,{disabled=false}={}){const b=document.createElement('button');b.type='button';b.className='onboard-cta';const s=document.createElement('span');s.textContent=label;b.append(s,icon('p-arrow'));b.disabled=disabled;b.addEventListener('click',onClick);return b;}
function procAvatar(seed){let h=2166136261;const s=String(seed||'covenda');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h>>>=0;const hue1=32+(h%22),hue2=38+((h>>4)%18),x1=18+(h%50),y1=20+((h>>5)%50),x2=62-((h>>7)%40),y2=68-((h>>9)%38);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('class','onboard-avatar-img');svg.setAttribute('aria-hidden','true');svg.innerHTML=`<defs><radialGradient id="oa1" cx="${x1}%" cy="${y1}%" r="72%"><stop offset="0%" stop-color="hsl(${hue1},72%,84%)"/><stop offset="100%" stop-color="hsl(${hue1},58%,60%)"/></radialGradient><radialGradient id="oa2" cx="${x2}%" cy="${y2}%" r="60%"><stop offset="0%" stop-color="hsl(${hue2},78%,72%)" stop-opacity=".9"/><stop offset="100%" stop-color="hsl(${hue2},64%,54%)" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#oa1)"/><rect width="100" height="100" fill="url(#oa2)"/>`;return svg;}
// A small gold line icon per segmentation option, keyed by the exact taxonomy string.
const ONBOARD_ICONS={
  'Accounting & finance':'p-chart','Software & AI':'p-cpu','Healthcare operations':'p-pulse',
  'Consumer & retail':'p-cart','Professional services':'p-briefcase','Not sure yet — show me everything':'p-spark',
  Research:'p-search','Data & spreadsheets':'p-grid',Operations:'p-flow','QA & testing':'p-shield','Writing & documentation':'p-write',
};
function avatarImage(url){const img=document.createElement('img');img.className='onboard-avatar-img';img.src=url;img.alt='';return img;}
async function uploadAvatar(file){
  if(!/^image\//.test(file.type||''))throw new Error('Choose an image file.');
  if(file.size>5*1024*1024)throw new Error('Image is over 5 MB.');
  const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':file.type,'x-file-name':file.name,'x-upload-kind':'avatar'},body:file});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Upload failed.');
  return data.blobUrl;
}

// One render function per screen, dispatched by kind. Each receives the shared chrome
// (controls/body/msg) and returns the element to autofocus.
function renderOnboardRoleScreen({values,controls,body,msg}){
  const roles=[['student','Student','Find projects and build proof.','p-user'],['company','Company','Post work and discover talent.','p-project'],['university','University','Support students and projects.','p-compass']];
  const grid=document.createElement('div');grid.className='onboard-cards';let first=null;
  roles.forEach(([value,title,copy,ic],idx)=>{const card=document.createElement('button');card.type='button';card.className='onboard-card'+(values.role===value?' is-selected':'');card.append(icon(ic));const b=document.createElement('strong');b.textContent=title;const p=document.createElement('span');p.textContent=copy;card.append(b,p);card.addEventListener('click',()=>{onboardState.values.role=value;persistOnboard();if(value==='student')onboardNext();else exitOnboardToModal(value);});grid.append(card);if(idx===0)first=card;});
  controls.append(grid);body.append(msg);return first;
}
function renderOnboardProfileScreen({values,controls,body,msg}){
  const avatarWrap=document.createElement('div');avatarWrap.className='onboard-avatar';
  const paint=()=>{const url=onboardState.values.avatarUrl;avatarWrap.replaceChildren(url?avatarImage(url):procAvatar(onboardState.values.displayName||state.dashboard.user.email));};
  paint();
  const upload=document.createElement('label');upload.className='onboard-avatar-upload';upload.append(icon('p-plus'));
  const uploadLabel=document.createElement('span');uploadLabel.textContent='Add a profile image';
  const file=document.createElement('input');file.type='file';file.accept='image/*';file.hidden=true;
  upload.append(uploadLabel,file);
  const caption=document.createElement('p');caption.className='onboard-avatar-note';
  const restCaption=()=>{caption.textContent=onboardState.values.avatarUrl?'Profile image set — optional, and you can change it later.':'Optional — we generate one from your name until you add a photo.';};
  restCaption();
  file.addEventListener('change',async()=>{const chosen=file.files[0];file.value='';if(!chosen)return;caption.textContent='Uploading your image…';try{const url=await uploadAvatar(chosen);onboardState.values.avatarUrl=url;persistOnboard();paint();restCaption();}catch(error){caption.textContent=error.message;}});
  const label=document.createElement('label');label.className='onboard-field';const span=document.createElement('span');span.textContent='Display name';const input=document.createElement('input');input.type='text';input.autocomplete='name';input.placeholder='Your name';input.value=values.displayName||'';label.append(span,input);
  const cta=onboardCta('Continue',()=>{if(input.value.trim())onboardNext();},{disabled:!(values.displayName||'').trim()});
  input.addEventListener('input',()=>{onboardState.values.displayName=input.value;persistOnboard();cta.disabled=!input.value.trim();if(!onboardState.values.avatarUrl)paint();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(input.value.trim())onboardNext();}});
  controls.append(avatarWrap,upload,caption,label);body.append(msg,cta);return input;
}
function renderOnboardMultiScreen({screen,values,controls,body,msg}){
  const selected=new Set(values[screen.field]||[]);
  const grid=document.createElement('div');grid.className='onboard-cards onboard-cards-multi';let first=null;
  const cta=onboardCta('Continue',()=>{if(selected.size)onboardNext();},{disabled:!selected.size});
  screen.options.forEach((opt,idx)=>{const card=document.createElement('button');card.type='button';card.className='onboard-card onboard-chip'+(selected.has(opt)?' is-selected':'');card.setAttribute('aria-pressed',selected.has(opt)?'true':'false');const ic=ONBOARD_ICONS[opt];if(ic)card.append(icon(ic));const b=document.createElement('strong');b.textContent=opt;card.append(b);card.addEventListener('click',()=>{if(selected.has(opt))selected.delete(opt);else selected.add(opt);card.classList.toggle('is-selected');card.setAttribute('aria-pressed',selected.has(opt)?'true':'false');onboardState.values[screen.field]=[...selected];persistOnboard();cta.disabled=!selected.size;});grid.append(card);if(idx===0)first=card;});
  controls.append(grid);body.append(msg,cta);return first;
}
function renderOnboardTextScreen({screen,values,controls,body,msg}){
  const label=document.createElement('label');label.className='onboard-field';const span=document.createElement('span');span.className='sr-only';span.textContent=screen.headline;
  let input;
  if(screen.kind==='textarea'){input=document.createElement('textarea');input.rows=4;input.maxLength=2000;}
  else{input=document.createElement('input');input.type=screen.type||'text';if(screen.type==='number'){input.min='2020';input.max='2100';input.inputMode='numeric';}if(screen.autocomplete)input.autocomplete=screen.autocomplete;input.maxLength=180;}
  input.placeholder=screen.placeholder||'';input.value=values[screen.field]||'';label.append(span,input);
  const cta=onboardCta('Continue',()=>onboardNext());
  input.addEventListener('input',()=>{onboardState.values[screen.field]=input.value;persistOnboard();});
  if(screen.kind!=='textarea')input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onboardNext();}});
  controls.append(label);body.append(msg,cta);return input;
}
function renderOnboardHandoffScreen({values,controls,body,msg}){
  const pill=document.createElement('div');pill.className='onboard-social';const blobs=document.createElement('div');blobs.className='onboard-social-blobs';['a','b','c'].forEach(seed=>{const wrap=document.createElement('span');wrap.append(procAvatar((values.displayName||'covenda')+seed));blobs.append(wrap);});const t=document.createElement('span');t.textContent='Join the first cohort of Covenda students';pill.append(blobs,t);
  controls.append(pill);const cta=onboardCta("I'm ready",()=>finishOnboarding());body.append(msg,cta);return cta;
}
const ONBOARD_RENDERERS={role:renderOnboardRoleScreen,profile:renderOnboardProfileScreen,multi:renderOnboardMultiScreen,text:renderOnboardTextScreen,textarea:renderOnboardTextScreen,handoff:renderOnboardHandoffScreen};

function renderOnboard(){
  const screen=ONBOARD_SCREENS[onboardState.step];const values=onboardState.values;
  const inner=$('#onboardInner');inner.replaceChildren();
  const top=document.createElement('div');top.className='onboard-top';
  if(onboardState.step>0){const back=document.createElement('button');back.type='button';back.className='onboard-back';back.textContent='← Back';back.addEventListener('click',onboardBack);top.append(back);}else{top.append(document.createElement('span'));}
  const prog=document.createElement('div');prog.className='onboard-progress';prog.setAttribute('aria-hidden','true');
  ONBOARD_SCREENS.forEach((_,i)=>{const dot=document.createElement('span');dot.className='onboard-dot'+(i<onboardState.step?' is-done':i===onboardState.step?' is-current':'');prog.append(dot);});
  top.append(prog);inner.append(top);
  const body=document.createElement('div');body.className='onboard-screen';body.dataset.kind=screen.kind;
  const h=document.createElement('h1');h.className='onboard-headline';h.textContent=screen.headline;
  const sub=document.createElement('p');sub.className='onboard-sub';sub.textContent=screen.sub;body.append(h,sub);
  const controls=document.createElement('div');controls.className='onboard-controls';body.append(controls);
  const msg=document.createElement('p');msg.className='onboard-message';msg.id='onboardMessage';msg.setAttribute('aria-live','polite');
  const render=ONBOARD_RENDERERS[screen.kind];
  const focusEl=render?render({screen,values,controls,body,msg}):null;
  inner.append(body);
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce){body.classList.add('onboard-enter');requestAnimationFrame(()=>body.classList.add('onboard-enter-active'));}
  if(focusEl)setTimeout(()=>focusEl.focus?.(),reduce?0:70);
}
async function finishOnboarding(){
  if(onboardState.saving)return;onboardState.saving=true;const v=onboardState.values;const msg=$('#onboardMessage');
  if(msg){msg.textContent='Saving your profile…';msg.classList.remove('is-error');}
  try{
    const payload={action:'save-profile',role:'student',displayName:v.displayName||'',schoolName:v.schoolName||'',graduationYear:v.graduationYear||'',headline:v.headline||'',bio:v.bio||'',skills:v.skills||'',portfolioVisibility:'members',verticals:v.verticals||[],workTypes:v.workTypes||[]};
    // Only claim the avatar_url column when there is actually an image — otherwise every
    // student's save would depend on that column existing.
    if(v.avatarUrl)payload.avatarUrl=v.avatarUrl;
    await portalRequest({method:'PATCH',body:JSON.stringify(payload)});
    clearOnboard();$('#onboardFlow').hidden=true;await loadDashboard();setView('discover');
  }catch(error){onboardState.saving=false;if(msg){msg.textContent=error.message;msg.classList.add('is-error');}}
}

// ===== Company/university AI-assisted project intake (multi-step) =====
let intakeState={step:1,attachments:[],brief:null,verticals:[],workTypes:[],consultBooked:false,editedSummary:'',targeting:'public'};
function portalCalendlyUrl(){const raw=document.querySelector('meta[name="covenda-calendly-url"]')?.content?.trim()||'';try{const u=new URL(raw);if(u.protocol==='https:'&&/(^|\.)calendly\.com$/.test(u.hostname))return u.toString();}catch{}return '';}
function openIntake(){intakeState={step:1,attachments:[],brief:null,verticals:[],workTypes:[],consultBooked:false,editedSummary:'',targeting:'public'};const form=$('#intakeForm');form.reset();$('#intakeChips').replaceChildren();const brief=$('#intakeBrief');brief.replaceChildren();brief.hidden=true;$('#intakeConsultCard').classList.remove('is-booked');setDialogMessage('#intakeMessage','');setDialogMessage('#intakeStepMessage','');renderIntakeStep();$('#intakeDialog').showModal();}
function renderIntakeStep(){const s=intakeState.step;$$('.intake-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.intakeStep)===s));$$('#intakeProgress span').forEach((el,i)=>el.classList.toggle('is-active',i===s-1));$('#intakeBack').hidden=s===1;$('#intakeNext').hidden=s===4;$('#intakePost').hidden=s!==4;if(s===3){renderIntakeTargets();renderIntakeCost();}if(s===4)renderIntakeReview();}
function renderIntakeCost(){
  const form=$('#intakeForm');const root=$('#intakeCost');if(!root||!form)return;
  const cost=projectCreditCost(form.elements.creditsListed?.value,intakeState.targeting);
  const balance=Number(state.dashboard?.walletBalance)||0;
  root.replaceChildren();
  if(!cost.total){const hint=document.createElement('p');hint.className='intake-hint';hint.textContent='Add a listed amount to see what gets held.';root.append(hint);return;}
  const rows=[['Listed for the student',cost.listed],['Covenda fee (10%, on top)',cost.platformFee]];
  if(cost.reachFee)rows.push(['Hyper-narrow reach fee',cost.reachFee]);
  const dl=document.createElement('dl');dl.className='cost-list';
  rows.forEach(([label,value])=>{const w=document.createElement('div');const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value.toLocaleString();w.append(dt,dd);dl.append(w);});
  const total=document.createElement('div');total.className='cost-total';const dt=document.createElement('dt');dt.textContent='Held from your balance now';const dd=document.createElement('dd');dd.textContent=`${cost.total.toLocaleString()} credits`;total.append(dt,dd);dl.append(total);
  root.append(dl);
  const note=document.createElement('p');note.className='cost-note';
  if(balance<cost.total){note.classList.add('is-short');note.textContent=`Your balance is ${balance.toLocaleString()} — ${(cost.total-balance).toLocaleString()} short. Top up in Wallet.`;}
  else note.textContent=`Balance after posting: ${(balance-cost.total).toLocaleString()}. The student receives all ${cost.listed.toLocaleString()} credits on acceptance.`;
  root.append(note);
}
function intakeToggle(list,option,button){const i=list.indexOf(option);if(i>=0)list.splice(i,1);else list.push(option);const now=i<0;button.classList.toggle('is-selected',now);button.setAttribute('aria-pressed',now?'true':'false');}
function renderIntakeTargets(){const vRoot=$('#intakeVerticals');vRoot.replaceChildren();ONBOARD_VERTICALS.forEach(opt=>{const on=intakeState.verticals.includes(opt);const b=document.createElement('button');b.type='button';b.className='intake-toggle'+(on?' is-selected':'');b.setAttribute('aria-pressed',on?'true':'false');b.textContent=opt;b.addEventListener('click',()=>intakeToggle(intakeState.verticals,opt,b));vRoot.append(b);});const wRoot=$('#intakeWorkTypes');wRoot.replaceChildren();ONBOARD_WORK_TYPES.forEach(opt=>{const on=intakeState.workTypes.includes(opt);const b=document.createElement('button');b.type='button';b.className='intake-toggle'+(on?' is-selected':'');b.setAttribute('aria-pressed',on?'true':'false');b.textContent=opt;b.addEventListener('click',()=>intakeToggle(intakeState.workTypes,opt,b));wRoot.append(b);});}
function renderIntakeReview(){const root=$('#intakeReview');root.replaceChildren();const form=$('#intakeForm');const title=$('[name="title"]',form).value.trim()||'Untitled project';const rows=[['Title',title],['Verticals',intakeState.verticals.join(', ')||'—'],['Work types',intakeState.workTypes.join(', ')||'—'],['Files',intakeState.attachments.length?`${intakeState.attachments.length} attached`:'None'],['20-min consult',intakeState.consultBooked?'Booked':'Not yet — you can book later']];const dl=document.createElement('dl');dl.className='intake-review-list';rows.forEach(([k,v])=>{const wrap=document.createElement('div');const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;wrap.append(dt,dd);dl.append(wrap);});root.append(dl);}
function addIntakeChip(name,status){const chip=document.createElement('div');chip.className='intake-chip';const b=document.createElement('strong');b.textContent=name;const s=document.createElement('small');s.textContent=status;chip.append(b,s);$('#intakeChips').append(chip);return chip;}
async function uploadIntakeFile(file){if(file.size>15*1024*1024){setDialogMessage('#intakeStepMessage',`${file.name} is over 15 MB.`,true);return;}const chip=addIntakeChip(file.name,'Uploading…');try{const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':file.type||'application/octet-stream','x-file-name':file.name},body:file});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Upload failed.');intakeState.attachments.push(data);$('small',chip).textContent='Attached';}catch(error){$('small',chip).textContent=error.message;chip.classList.add('is-error');}}
function renderIntakeBrief(){const brief=intakeState.brief;const root=$('#intakeBrief');root.replaceChildren();root.hidden=false;
  if(brief.safeToPost===false){const warn=document.createElement('div');warn.className='intake-warn';warn.append(icon('p-close'));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent='Outside Covenda’s safe boundary';const ul=document.createElement('ul');(brief.safetyFlags||[]).forEach(f=>{const li=document.createElement('li');li.textContent=f;ul.append(li);});const p=document.createElement('p');p.textContent='Covenda can’t post this as-is. Book the 20-minute consult and we’ll find a safe, useful version.';box.append(strong,ul,p);warn.append(box);root.append(warn);return;}
  const label=document.createElement('p');label.className='intake-brief-label';label.textContent='AI draft understanding — edit before you post';root.append(label);
  const sum=document.createElement('label');sum.className='intake-field';const ss=document.createElement('span');ss.textContent='Summary';const st=document.createElement('textarea');st.rows=5;st.value=[brief.summary,brief.structuredProblem].filter(Boolean).join('\n\n');st.addEventListener('input',()=>{intakeState.editedSummary=st.value;});sum.append(ss,st);root.append(sum);intakeState.editedSummary=st.value;
  if((brief.candidateDeliverables||[]).length){const dl=document.createElement('div');dl.className='intake-deliverables';const dh=document.createElement('p');dh.textContent='Candidate deliverables';dl.append(dh);const ul=document.createElement('ul');brief.candidateDeliverables.forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.append(li);});dl.append(ul);root.append(dl);}
  if((brief.safetyFlags||[]).length){const note=document.createElement('p');note.className='intake-flags';note.textContent='Notes to confirm at the consult: '+brief.safetyFlags.join('; ');root.append(note);}
}
$('#intakeFileInput')?.addEventListener('change',async event=>{const files=[...event.target.files];for(const file of files)await uploadIntakeFile(file);event.target.value='';});
$('#intakeUnderstand')?.addEventListener('click',async()=>{const problem=$('[name="problem"]',$('#intakeForm')).value.trim();if(problem.length<10){setDialogMessage('#intakeStepMessage','Add a problem description on the first step.',true);return;}const btn=$('#intakeUnderstand');btn.disabled=true;setDialogMessage('#intakeStepMessage','Reading your description'+(intakeState.attachments.length?' and files':'')+'…');try{const res=await fetch('/api/project-intake',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({problemText:problem,attachments:intakeState.attachments})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'AI intake failed.');intakeState.brief=data.brief;intakeState.verticals=[...(data.brief.suggestedVerticals||[])];intakeState.workTypes=[...(data.brief.suggestedWorkTypes||[])];renderIntakeBrief();setDialogMessage('#intakeStepMessage','');}catch(error){setDialogMessage('#intakeStepMessage',error.message,true);}finally{btn.disabled=false;}});
$('#intakeNext')?.addEventListener('click',()=>{const s=intakeState.step;const form=$('#intakeForm');if(s===1){if($('[name="problem"]',form).value.trim().length<10){setDialogMessage('#intakeStepMessage','Describe the problem in a bit more detail.',true);return;}if(!$('[name="aiConsent"]',form).checked){setDialogMessage('#intakeStepMessage','Please consent to AI processing to continue.',true);return;}setDialogMessage('#intakeStepMessage','');}intakeState.step=Math.min(4,s+1);renderIntakeStep();});
$('#intakeBack')?.addEventListener('click',()=>{intakeState.step=Math.max(1,intakeState.step-1);renderIntakeStep();});
$$('#intakeTargeting .intake-toggle').forEach(button=>button.addEventListener('click',()=>{
  intakeState.targeting=button.dataset.targeting;
  $$('#intakeTargeting .intake-toggle').forEach(other=>{const on=other===button;other.classList.toggle('is-selected',on);other.setAttribute('aria-pressed',on?'true':'false');});
  renderIntakeCost();
}));
$('#intakeForm')?.elements?.creditsListed?.addEventListener('input',renderIntakeCost);
$('#intakeBookConsult')?.addEventListener('click',()=>{const url=portalCalendlyUrl();if(url)window.open(url,'_blank','noopener');intakeState.consultBooked=true;$('#intakeConsultCard').classList.add('is-booked');renderIntakeReview();});
$('#intakeConsultLater')?.addEventListener('click',()=>{intakeState.consultBooked=false;$('#intakeConsultCard').classList.remove('is-booked');renderIntakeReview();});
$('#intakePost')?.addEventListener('click',async()=>{const form=$('#intakeForm');const btn=$('#intakePost');const title=$('[name="title"]',form).value.trim();const problem=$('[name="problem"]',form).value.trim();const summary=(intakeState.editedSummary||problem).trim();if(title.length<3){setDialogMessage('#intakeMessage','Add a project title on the Target step.',true);intakeState.step=3;renderIntakeStep();return;}if(summary.length<10){setDialogMessage('#intakeMessage','The project needs a longer description.',true);return;}if(intakeState.brief&&intakeState.brief.safeToPost===false){setDialogMessage('#intakeMessage','This is outside the safe boundary — please book the consult instead of posting.',true);return;}const cost=projectCreditCost(form.elements.creditsListed?.value,intakeState.targeting);
  const balance=Number(state.dashboard?.walletBalance)||0;
  if(cost.total>balance){setDialogMessage('#intakeMessage',`This post holds ${cost.total.toLocaleString()} credits but your balance is ${balance.toLocaleString()}. Top up in Wallet first.`,true);return;}
  btn.disabled=true;setDialogMessage('#intakeMessage','Posting your project…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'create-project',title,summary,deliverable:(intakeState.brief?.candidateDeliverables||[]).join(' · '),desiredSkills:$('[name="skills"]',form).value,targetDate:$('[name="targetDate"]',form).value,visibility:'members',verticals:intakeState.verticals,workTypes:intakeState.workTypes,attachments:intakeState.attachments,aiBrief:intakeState.brief||undefined,problemText:problem,consultBooked:intakeState.consultBooked,creditsListed:cost.listed,targeting:intakeState.targeting})});$('#intakeDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#intakeMessage',error.message,true);}finally{btn.disabled=false;}});

$('#googleLogin').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;setLoginMessage('Opening Google sign-in…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login'})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Google sign-in could not start.');location.assign(result.url);}catch(error){setLoginMessage(error.message,true);button.disabled=false;}});
$('#memberEmailForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('button',event.currentTarget);button.disabled=true;setLoginMessage('Requesting a secure sign-in link…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:event.currentTarget.elements.email.value})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not request a sign-in link.');setLoginMessage(result.message);}catch(error){setLoginMessage(error.message,true);}finally{button.disabled=false;}});

$('#profileForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#profileMessage','Saving your workspace…');const payload={action:'save-profile',role:form.elements.role.value,displayName:form.elements.displayName.value,organizationName:form.elements.organizationName.value,schoolName:form.elements.schoolName.value,graduationYear:form.elements.graduationYear.value,headline:form.elements.headline.value,bio:form.elements.bio.value,skills:form.elements.skills.value,portfolioVisibility:form.elements.portfolioVisibility.checked?'members':'private'};try{await portalRequest({method:'PATCH',body:JSON.stringify(payload)});$('#profileDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#profileMessage',error.message,true);}finally{button.disabled=false;}});

$('#projectForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#projectMessage','Creating project…');const payload={action:'create-project',title:form.elements.title.value,summary:form.elements.summary.value,deliverable:form.elements.deliverable.value,desiredSkills:form.elements.desiredSkills.value,targetDate:form.elements.targetDate.value,visibility:form.elements.visibility.value};try{await portalRequest({method:'POST',body:JSON.stringify(payload)});$('#projectDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#projectMessage',error.message,true);}finally{button.disabled=false;}});

$('#applyForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#applyMessage','Sending your interest…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'apply',projectId:form.elements.projectId.value,note:form.elements.note.value})});$('#applyDialog').close();await loadDashboard();setView('discover');}catch(error){setDialogMessage('#applyMessage',error.message,true);}finally{button.disabled=false;}});

$('#submitWorkForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#submitWorkMessage','Submitting your work…');const notes=form.elements.workNotes.value.trim();const summary=[form.elements.workSummary.value.trim(),notes&&`\n\nNotes for the reviewer: ${notes}`].filter(Boolean).join('');const links=form.elements.workLinks.value.split(/\n/).map(link=>link.trim()).filter(Boolean);try{await portalRequest({method:'POST',body:JSON.stringify({action:'submit-deliverable',projectId:form.elements.projectId.value,deliverable:summary,deliverableLinks:links})});$('#submitWorkDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#submitWorkMessage',error.message,true);}finally{button.disabled=false;}});
$$('#reviewForm [data-decision]').forEach(button=>button.addEventListener('click',async()=>{const form=$('#reviewForm');const decision=button.dataset.decision;const note=form.elements.note.value.trim();if(decision==='revise'&&!note){setDialogMessage('#reviewMessage','Add a note so the student knows what to revise.',true);return;}const buttons=$$('#reviewForm [data-decision]');buttons.forEach(b=>b.disabled=true);setDialogMessage('#reviewMessage',decision==='accept'?'Accepting the deliverable…':'Sending the change request…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'review-deliverable',projectId:form.elements.projectId.value,decision,note})});$('#reviewDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#reviewMessage',error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}));
$('#messageForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);const status=$('#messageFormStatus');button.disabled=true;status.textContent='Sending…';status.classList.remove('is-error');try{const result=await portalRequest({method:'POST',body:JSON.stringify({action:'send-message',projectId:state.messageProjectId,message:form.elements.message.value})});state.dashboard.messages.push(result.message);form.reset();status.textContent='Sent securely.';renderMessages();}catch(error){status.textContent=error.message;status.classList.add('is-error');}finally{button.disabled=false;}});

$$('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>{const dialog=button.closest('dialog');if(dialog.id==='profileDialog'&&$('#profileForm').dataset.required==='true')return;dialog.close();}));
$$('[name="role"]',$('#profileForm')).forEach(input=>input.addEventListener('change',updateProfileFields));
$('#primaryAction').addEventListener('click',event=>{const target=event.currentTarget.dataset.target;if(target==='profile')openProfile({required:!state.dashboard.profile});else if(target==='new-project')openIntake();else setView(target);});
$('#newProject').addEventListener('click',openIntake);$('#editProfile').addEventListener('click',()=>openProfile());
$('#discoverSearch').addEventListener('input',renderDiscover);
$('#memberSignout').addEventListener('click',()=>{clearSession();state.dashboard=null;showAuth('Signed out of this browser.');});
$('#mobileMenu').addEventListener('click',()=>$('.member-nav').classList.toggle('is-open'));

const authError=captureAuthRedirect();
checkAuthReadiness();
if(authError)showAuth(authError,true);else if(session().accessToken)loadDashboard();else showAuth();
