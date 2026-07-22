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
    if (!dashboard.profile) startOnboarding();
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
  const allowed=['overview','projects','activity','discover','portfolio','messages'];
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
  renderFocus(); renderMetrics(); renderProgress(); renderActions(); renderProjects(); renderActivity(); renderDiscover(); renderPortfolio(); renderMessages();
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
function loopNote(iconId,title,copy){const d=document.createElement('div');d.className='loop-note';d.append(icon(iconId));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;box.append(strong,small);d.append(box);return d;}
function verifiedCard(project,{full=false}={}){const card=document.createElement('div');card.className='verified-record';const head=document.createElement('div');head.className='verified-head';head.append(icon('p-check'));const badge=document.createElement('span');badge.textContent='Verified work record';head.append(badge);const h=document.createElement('h3');h.textContent=project.title;card.append(head,h);if(full&&project.summary){const s=document.createElement('p');s.className='verified-summary';s.textContent=project.summary;card.append(s);}const p=document.createElement('p');p.textContent=`Reviewer accepted${project.completed_at?` · ${dateLabel(project.completed_at)}`:''}`;card.append(p);return card;}
function projectActionNode(project){
  const d=state.dashboard;const role=d.profile?.role;const isOwner=project.owner_user_id===d.user.id;const isAssigned=project.assigned_student_user_id===d.user.id;
  const wrap=document.createElement('div');wrap.className='project-actions';
  if(role==='student'&&isAssigned&&project.status==='in_progress'){if(project.review_note){const note=document.createElement('p');note.className='revise-note';note.append(icon('p-clock'));const s=document.createElement('span');s.textContent=`Changes requested: ${project.review_note}`;note.append(s);wrap.append(note);}wrap.append(actionButton(project.review_note?'Resubmit your work':'Submit your work','p-arrow',()=>openSubmitWork(project)));return wrap;}
  if(isAssigned&&project.status==='review'){wrap.append(loopNote('p-clock','In review','Your work is with the reviewer. The decision will appear here.'));return wrap;}
  if(isAssigned&&project.status==='complete'){wrap.append(verifiedCard(project));return wrap;}
  if(isOwner&&project.status==='review'){wrap.append(loopNote('p-inbox','Deliverable submitted','A student submitted work for your review.'));wrap.append(actionButton('Review deliverable','p-check',()=>openReview(project)));return wrap;}
  if(isOwner&&project.status==='complete'){wrap.append(loopNote('p-check','Accepted','You accepted this work — the student now holds a verified record.'));return wrap;}
  return null;
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

function renderPortfolio(){const root=$('#portfolioContent');root.replaceChildren();const {profile,studentDirectory}=state.dashboard;if(profile?.role==='company'){$('#portfolioEyebrow').textContent='Member talent';$('#portfolioTitle').textContent='Student portfolios';$('#portfolioIntro').textContent='Discover students who chose to share their profile with signed-in company members.';$('#editProfile').hidden=false;if(!studentDirectory.length){emptyList(root,'p-user','No visible student portfolios yet.','Students will appear here after they finish onboarding and opt into member discovery.');return;}const list=document.createElement('div');list.className='talent-list';for(const student of studentDirectory){const row=document.createElement('article');row.className='talent-row';const h=document.createElement('h3');h.textContent=student.display_name;const p=document.createElement('p');p.textContent=[student.headline,student.school_name,student.graduation_year&&`Class of ${student.graduation_year}`].filter(Boolean).join(' · ')||'Student member';const skills=document.createElement('div');skills.className='skills';(student.skills||[]).forEach(skill=>skills.append(pill(skill)));row.append(h,p,skills);list.append(row);}root.append(list);return;}
  $('#portfolioEyebrow').textContent=profile?.role==='student'?'Your evidence':'Partner identity';$('#portfolioTitle').textContent=profile?.role==='student'?'Portfolio':'Organization profile';$('#portfolioIntro').textContent=profile?.role==='student'?'Shape how signed-in company members understand your work.':'Keep the context behind every project accurate.';$('#editProfile').hidden=false;const article=document.createElement('article');article.className='portfolio-profile';const avatar=document.createElement('div');avatar.className='portfolio-avatar';paintAvatarSlot(avatar,profile?.avatar_url,initial(profile?.display_name));const details=document.createElement('div');const h=document.createElement('h2');h.textContent=profile?.display_name||'Complete your profile';const headline=document.createElement('p');headline.textContent=[profile?.headline,profile?.school_name||profile?.organization_name,profile?.graduation_year&&`Class of ${profile.graduation_year}`].filter(Boolean).join(' · ')||'Add a headline and member details.';const bio=document.createElement('p');bio.textContent=profile?.bio||'Add a short introduction to help the right people understand your work.';const skills=document.createElement('div');skills.className='skills';(profile?.skills||[]).forEach(skill=>skills.append(pill(skill)));details.append(h,headline,bio,skills);article.append(avatar,details);root.append(article);}

function updateProfileFields(){const role=$('[name="role"]:checked',$('#profileForm'))?.value||state.dashboard?.profile?.role||'student';$$('[data-profile-field="organization"]').forEach(el=>el.hidden=role==='student');$$('[data-profile-field="school"],[data-profile-field="graduation"],[data-student-profile]').forEach(el=>el.hidden=role!=='student');}
function openProfile({required=false}={}){const form=$('#profileForm');const p=state.dashboard?.profile;form.reset();if(p){form.elements.role.value=p.role;form.elements.displayName.value=p.display_name||'';form.elements.organizationName.value=p.organization_name||'';form.elements.schoolName.value=p.school_name||'';form.elements.graduationYear.value=p.graduation_year||'';form.elements.headline.value=p.headline||'';form.elements.bio.value=p.bio||'';form.elements.skills.value=(p.skills||[]).join(', ');form.elements.portfolioVisibility.checked=p.portfolio_visibility!=='private';$$('[name="role"]',form).forEach(input=>input.disabled=true);}else{$$('[name="role"]',form).forEach(input=>input.disabled=false);const inferred=state.dashboard?.user?.metadata?.full_name||state.dashboard?.user?.metadata?.name||'';form.elements.displayName.value=inferred;}form.dataset.required=required?'true':'false';$$('[data-close-dialog]',form).forEach(button=>button.hidden=required);updateProfileFields();setDialogMessage('#profileMessage','');$('#profileDialog').showModal();}
function openProject(){setDialogMessage('#projectMessage','');$('#projectForm').reset();$('#projectDialog').showModal();}
function openApply(project){state.applyProject=project;$('#applyForm').reset();$('#applyForm').elements.projectId.value=project.id;$('#applyTitle').textContent=`Apply to ${project.title}.`;$('#applySummary').textContent=project.summary;setDialogMessage('#applyMessage','');$('#applyDialog').showModal();}
function openSubmitWork(project){const form=$('#submitWorkForm');form.reset();form.elements.projectId.value=project.id;$('#submitWorkTitle').textContent=`Submit your work · ${project.title}`;setDialogMessage('#submitWorkMessage','');$('#submitWorkDialog').showModal();}
function openReview(project){const form=$('#reviewForm');form.reset();form.elements.projectId.value=project.id;$('#reviewTitle').textContent=`Review · ${project.title}`;$('#reviewDeliverable').textContent=project.deliverable||'No deliverable text was provided.';$('#reviewSubmittedAt').textContent=project.deliverable_submitted_at?`Submitted ${dateLabel(project.deliverable_submitted_at)}`:'';setDialogMessage('#reviewMessage','');$('#reviewDialog').showModal();}

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
function startOnboarding(){
  const meta=state.dashboard?.user?.metadata||{};
  onboardState={step:0,values:{role:'student',verticals:[],workTypes:[],displayName:meta.full_name||meta.name||''},saving:false};
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
    await portalRequest({method:'PATCH',body:JSON.stringify({action:'save-profile',role:'student',displayName:v.displayName||'',schoolName:v.schoolName||'',graduationYear:v.graduationYear||'',headline:v.headline||'',bio:v.bio||'',skills:v.skills||'',portfolioVisibility:'members',verticals:v.verticals||[],workTypes:v.workTypes||[],avatarUrl:v.avatarUrl||''})});
    clearOnboard();$('#onboardFlow').hidden=true;await loadDashboard();setView('discover');
  }catch(error){onboardState.saving=false;if(msg){msg.textContent=error.message;msg.classList.add('is-error');}}
}

// ===== Company/university AI-assisted project intake (multi-step) =====
let intakeState={step:1,attachments:[],brief:null,verticals:[],workTypes:[],consultBooked:false,editedSummary:''};
function portalCalendlyUrl(){const raw=document.querySelector('meta[name="covenda-calendly-url"]')?.content?.trim()||'';try{const u=new URL(raw);if(u.protocol==='https:'&&/(^|\.)calendly\.com$/.test(u.hostname))return u.toString();}catch{}return '';}
function openIntake(){intakeState={step:1,attachments:[],brief:null,verticals:[],workTypes:[],consultBooked:false,editedSummary:''};const form=$('#intakeForm');form.reset();$('#intakeChips').replaceChildren();const brief=$('#intakeBrief');brief.replaceChildren();brief.hidden=true;$('#intakeConsultCard').classList.remove('is-booked');setDialogMessage('#intakeMessage','');setDialogMessage('#intakeStepMessage','');renderIntakeStep();$('#intakeDialog').showModal();}
function renderIntakeStep(){const s=intakeState.step;$$('.intake-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.intakeStep)===s));$$('#intakeProgress span').forEach((el,i)=>el.classList.toggle('is-active',i===s-1));$('#intakeBack').hidden=s===1;$('#intakeNext').hidden=s===4;$('#intakePost').hidden=s!==4;if(s===3)renderIntakeTargets();if(s===4)renderIntakeReview();}
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
$('#intakeBookConsult')?.addEventListener('click',()=>{const url=portalCalendlyUrl();if(url)window.open(url,'_blank','noopener');intakeState.consultBooked=true;$('#intakeConsultCard').classList.add('is-booked');renderIntakeReview();});
$('#intakeConsultLater')?.addEventListener('click',()=>{intakeState.consultBooked=false;$('#intakeConsultCard').classList.remove('is-booked');renderIntakeReview();});
$('#intakePost')?.addEventListener('click',async()=>{const form=$('#intakeForm');const btn=$('#intakePost');const title=$('[name="title"]',form).value.trim();const problem=$('[name="problem"]',form).value.trim();const summary=(intakeState.editedSummary||problem).trim();if(title.length<3){setDialogMessage('#intakeMessage','Add a project title on the Target step.',true);intakeState.step=3;renderIntakeStep();return;}if(summary.length<10){setDialogMessage('#intakeMessage','The project needs a longer description.',true);return;}if(intakeState.brief&&intakeState.brief.safeToPost===false){setDialogMessage('#intakeMessage','This is outside the safe boundary — please book the consult instead of posting.',true);return;}btn.disabled=true;setDialogMessage('#intakeMessage','Posting your project…');const budget=Number($('[name="budget"]',form).value)||0;try{await portalRequest({method:'POST',body:JSON.stringify({action:'create-project',title,summary,deliverable:(intakeState.brief?.candidateDeliverables||[]).join(' · '),desiredSkills:$('[name="skills"]',form).value,targetDate:$('[name="targetDate"]',form).value,visibility:'members',verticals:intakeState.verticals,workTypes:intakeState.workTypes,attachments:intakeState.attachments,aiBrief:intakeState.brief||undefined,problemText:problem,consultBooked:intakeState.consultBooked,budgetCents:budget?budget*100:undefined})});$('#intakeDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#intakeMessage',error.message,true);}finally{btn.disabled=false;}});

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
