const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const ACCESS_KEY = 'covendaMemberAccessToken';
const REFRESH_KEY = 'covendaMemberRefreshToken';
const EXPIRY_KEY = 'covendaMemberExpiry';

const state = { dashboard: null, view: 'overview', applyProject: null };
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
    if (!dashboard.profile) openProfile({ required:true });
  } catch(error) { if(session().accessToken) showAuth(error.message,true); }
}

function profileCompletion(profile) {
  if (!profile) return 0;
  const values=[profile.display_name,profile.headline,profile.bio,profile.skills?.length,profile.role==='student'?profile.school_name:profile.organization_name];
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

function renderIdentity(profile) {
  const name=profile?.display_name||state.dashboard.user.email||'Member';
  const letter=initial(name);
  $('#memberNavName').textContent=name; $('#memberNavRole').textContent=roleLabels[profile?.role]||'Setup needed';
  $('#memberInitial').textContent=letter; $('#headerInitial').textContent=letter; $('#headerName').textContent=name;
  $('#memberHeaderStatus').textContent=profile?`${roleLabels[profile.role]} account · Private`:'Complete setup to continue';
}

function renderDashboard() {
  const { profile,projects,opportunities,applications,intakes=[] }=state.dashboard;
  renderIdentity(profile);
  const role=profile?.role;
  $$('[data-student-only]').forEach(el=>el.hidden=role!=='student');
  $('#portfolioNavLabel').textContent=role==='company'?'Student portfolios':'Portfolio';
  $('#projectCount').textContent=projects.length;
  $('#intakeCount').textContent=intakes.length;
  $('#opportunityCount').textContent=opportunities.length;
  $('#newProject').hidden=!['company','university'].includes(role);
  const now=new Date(); $('#welcomeDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const first=profile?.display_name?.split(/\s+/)[0]; $('#welcomeTitle').textContent=first?`Good ${dayPart()}, ${first}.`:`Good ${dayPart()}.`;
  $('#welcomeCopy').textContent=role==='student'?'Track your current work and find the next project that fits you.':role==='company'?'Keep projects moving and discover students through real evidence.':role==='university'?'See the projects and opportunities connected to your partner account.':'Complete your member profile to open your private workspace.';
  const primary=$('#primaryAction'); $('span',primary).textContent=role==='student'?'Discover projects':role==='company'||role==='university'?'Post a project':'Complete profile';
  primary.dataset.target=role==='student'?'discover':role==='company'||role==='university'?'new-project':'profile';
  renderFocus(); renderMetrics(); renderProgress(); renderActions(); renderProjects(); renderActivity(); renderDiscover(); renderPortfolio();
}

function dayPart(){const hour=new Date().getHours();return hour<12?'morning':hour<17?'afternoon':'evening';}

function renderFocus(){
  const root=$('#focusProject');root.replaceChildren();const role=state.dashboard.profile?.role;
  const project=state.dashboard.projects.find(item=>!['complete','archived'].includes(item.status))||state.dashboard.projects[0];
  $('#focusTitle').textContent=role==='student'?'Your project tracker':'Project operations';
  if(!project){const empty=document.createElement('div');empty.className='empty-line';const h=document.createElement('h3');h.textContent=role==='student'?'No assigned project yet.':'No project posted yet.';const p=document.createElement('p');p.textContent=role==='student'?'Discover reviewed opportunities or complete your profile while Covenda routes a fit.':'Create a private draft first, then make it visible when the scope is ready.';const button=document.createElement('button');button.type='button';button.textContent=role==='student'?'Browse open projects →':'Start a project →';button.addEventListener('click',()=>role==='student'?setView('discover'):openProject());empty.append(h,p,button);root.append(empty);return;}
  const row=document.createElement('article');row.className='project-focus';const copy=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;const meta=document.createElement('div');meta.className='project-focus-meta';meta.append(pill(statusLabels[project.status]||project.status,'status-pill',project.status));if(project.target_date)meta.append(pill(`Due ${dateLabel(project.target_date)}`));copy.append(h,p,meta);const progress=document.createElement('div');progress.className='project-progress';const track=document.createElement('div');const fill=document.createElement('i');fill.style.width=`${statusProgress[project.status]||10}%`;track.append(fill);const label=document.createElement('span');label.textContent=`${statusProgress[project.status]||10}% through workflow`;progress.append(track,label);row.append(copy,progress);root.append(row);
}
function pill(label,className='skill-pill',status=''){const span=document.createElement('span');span.className=className;span.textContent=label;if(status)span.dataset.status=status;return span;}

function renderMetrics(){const root=$('#memberMetrics');root.replaceChildren();const d=state.dashboard;const role=d.profile?.role;const values=role==='student'?[[d.projects.length,'Current projects'],[d.applications.length,'Applications'],[(d.intakes||[]).length,'Form submissions']]:[[d.projects.length,'Posted projects'],[d.applications.length,'Student applications'],[(d.intakes||[]).length,'Form submissions']];for(const [value,label] of values){const item=document.createElement('div');item.className='metric';const strong=document.createElement('strong');strong.textContent=value;const span=document.createElement('span');span.textContent=label;item.append(strong,span);root.append(item);}}

function renderProgress(){const profile=state.dashboard.profile;const score=profileCompletion(profile);$('#profileRing').style.setProperty('--progress',`${score*3.6}deg`);$('strong',$('#profileRing')).textContent=`${score}%`;$('#profileProgressTitle').textContent=score===100?'Your profile is ready':score>=60?'Add the finishing details':'Make a strong first impression';$('#profileProgressCopy').textContent=profile?.role==='student'?'Companies see only portfolios you choose to share.':'A complete organization profile adds context to every project.';}

function renderActions(){const root=$('#nextActions');root.replaceChildren();const d=state.dashboard;const actions=[];if(profileCompletion(d.profile)<100)actions.push(['p-user','Complete your member profile','Add a headline, context, and skills.']);if(d.profile?.role==='student'&&!d.applications.length)actions.push(['p-compass','Explore your first opportunity','Open projects are ready to review.']);if(['company','university'].includes(d.profile?.role)&&!d.projects.length)actions.push(['p-plus','Create a private project draft','Start with the outcome and useful deliverable.']);if(!actions.length)actions.push(['p-check','You are caught up','New project activity will appear here.']);for(const [iconId,title,copy] of actions){const li=document.createElement('li');const mark=document.createElement('span');mark.append(icon(iconId));const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;div.append(strong,small);li.append(mark,div);root.append(li);}}

function emptyList(root,iconId,title,copy){root.replaceChildren();const box=document.createElement('div');box.className='list-empty';const mark=document.createElement('span');mark.append(icon(iconId));const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=copy;box.append(mark,h,p);root.append(box);}

function renderProjects(){const root=$('#projectList');const items=state.dashboard.projects;root.replaceChildren();if(!items.length){emptyList(root,'p-project','No projects in this workspace yet.',state.dashboard.profile?.role==='student'?'Assigned work will appear here with its status and due date.':'Post a private draft when you are ready to shape the first project.');return;}for(const project of items){const row=document.createElement('article');row.className='list-row';const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;main.append(h,p);const status=document.createElement('div');status.className='list-cell';const statusSmall=document.createElement('small');statusSmall.textContent='Status';status.append(statusSmall,pill(statusLabels[project.status]||titleCase(project.status),'status-pill',project.status));const due=cell('Target',project.target_date?dateLabel(project.target_date):'Not scheduled');const visibility=cell('Visibility',titleCase(project.visibility));row.append(main,status,due,visibility);root.append(row);}}
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
  for(const application of applications){const project=knownProjects.find(item=>item.id===application.project_id);const row=document.createElement('article');row.className='activity-row';const marker=document.createElement('span');marker.className='activity-marker';marker.append(icon('p-project'));const main=document.createElement('div');const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(applicationStatusLabels[application.status]||titleCase(application.status),'status-pill',application.status));const h=document.createElement('h3');h.textContent=project?.title||'Covenda project application';const details=document.createElement('p');details.textContent=`Updated ${dateLabel(application.updated_at||application.created_at)}`;main.append(meta,h,details);row.append(marker,main);applicationRoot.append(row);}
}

function renderDiscover(){const root=$('#opportunityList');const query=$('#discoverSearch').value.trim().toLowerCase();const items=state.dashboard.opportunities.filter(project=>[project.title,project.summary,...(project.desired_skills||[])].join(' ').toLowerCase().includes(query));$('#discoverCount').textContent=`${items.length} open ${items.length===1?'project':'projects'}`;root.replaceChildren();if(!items.length){emptyList(root,'p-compass',query?'No projects match that search.':'No open projects right now.','Covenda will place reviewed opportunities here as companies and universities make them available.');return;}for(const project of items){const row=document.createElement('article');row.className='list-row';const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;main.append(h,p);const skills=cell('Skills',(project.desired_skills||[]).join(', ')||'Open fit');const due=cell('Target',project.target_date?dateLabel(project.target_date):'Flexible');const applied=state.dashboard.applications.some(app=>app.project_id===project.id);const button=document.createElement('button');button.type='button';button.textContent=applied?'Interest sent':'View & apply';button.disabled=applied;button.addEventListener('click',()=>openApply(project));row.append(main,skills,due,button);root.append(row);}}

function renderPortfolio(){const root=$('#portfolioContent');root.replaceChildren();const {profile,studentDirectory}=state.dashboard;if(profile?.role==='company'){$('#portfolioEyebrow').textContent='Member talent';$('#portfolioTitle').textContent='Student portfolios';$('#portfolioIntro').textContent='Discover students who chose to share their profile with signed-in company members.';$('#editProfile').hidden=false;if(!studentDirectory.length){emptyList(root,'p-user','No visible student portfolios yet.','Students will appear here after they finish onboarding and opt into member discovery.');return;}const list=document.createElement('div');list.className='talent-list';for(const student of studentDirectory){const row=document.createElement('article');row.className='talent-row';const h=document.createElement('h3');h.textContent=student.display_name;const p=document.createElement('p');p.textContent=[student.headline,student.school_name,student.graduation_year&&`Class of ${student.graduation_year}`].filter(Boolean).join(' · ')||'Student member';const skills=document.createElement('div');skills.className='skills';(student.skills||[]).forEach(skill=>skills.append(pill(skill)));row.append(h,p,skills);list.append(row);}root.append(list);return;}
  $('#portfolioEyebrow').textContent=profile?.role==='student'?'Your evidence':'Partner identity';$('#portfolioTitle').textContent=profile?.role==='student'?'Portfolio':'Organization profile';$('#portfolioIntro').textContent=profile?.role==='student'?'Shape how signed-in company members understand your work.':'Keep the context behind every project accurate.';$('#editProfile').hidden=false;const article=document.createElement('article');article.className='portfolio-profile';const avatar=document.createElement('div');avatar.className='portfolio-avatar';avatar.textContent=initial(profile?.display_name);const details=document.createElement('div');const h=document.createElement('h2');h.textContent=profile?.display_name||'Complete your profile';const headline=document.createElement('p');headline.textContent=[profile?.headline,profile?.school_name||profile?.organization_name,profile?.graduation_year&&`Class of ${profile.graduation_year}`].filter(Boolean).join(' · ')||'Add a headline and member details.';const bio=document.createElement('p');bio.textContent=profile?.bio||'Add a short introduction to help the right people understand your work.';const skills=document.createElement('div');skills.className='skills';(profile?.skills||[]).forEach(skill=>skills.append(pill(skill)));details.append(h,headline,bio,skills);article.append(avatar,details);root.append(article);}

function updateProfileFields(){const role=$('[name="role"]:checked',$('#profileForm'))?.value||state.dashboard?.profile?.role||'student';$$('[data-profile-field="organization"]').forEach(el=>el.hidden=role==='student');$$('[data-profile-field="school"],[data-profile-field="graduation"],[data-student-profile]').forEach(el=>el.hidden=role!=='student');}
function openProfile({required=false}={}){const form=$('#profileForm');const p=state.dashboard?.profile;form.reset();if(p){form.elements.role.value=p.role;form.elements.displayName.value=p.display_name||'';form.elements.organizationName.value=p.organization_name||'';form.elements.schoolName.value=p.school_name||'';form.elements.graduationYear.value=p.graduation_year||'';form.elements.headline.value=p.headline||'';form.elements.bio.value=p.bio||'';form.elements.skills.value=(p.skills||[]).join(', ');form.elements.portfolioVisibility.checked=p.portfolio_visibility!=='private';$$('[name="role"]',form).forEach(input=>input.disabled=true);}else{$$('[name="role"]',form).forEach(input=>input.disabled=false);const inferred=state.dashboard?.user?.metadata?.full_name||state.dashboard?.user?.metadata?.name||'';form.elements.displayName.value=inferred;}form.dataset.required=required?'true':'false';$$('[data-close-dialog]',form).forEach(button=>button.hidden=required);updateProfileFields();setDialogMessage('#profileMessage','');$('#profileDialog').showModal();}
function openProject(){setDialogMessage('#projectMessage','');$('#projectForm').reset();$('#projectDialog').showModal();}
function openApply(project){state.applyProject=project;$('#applyForm').reset();$('#applyForm').elements.projectId.value=project.id;$('#applyTitle').textContent=`Apply to ${project.title}.`;$('#applySummary').textContent=project.summary;setDialogMessage('#applyMessage','');$('#applyDialog').showModal();}

$('#googleLogin').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;setLoginMessage('Opening Google sign-in…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login'})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Google sign-in could not start.');location.assign(result.url);}catch(error){setLoginMessage(error.message,true);button.disabled=false;}});
$('#memberEmailForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('button',event.currentTarget);button.disabled=true;setLoginMessage('Requesting a secure sign-in link…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:event.currentTarget.elements.email.value})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not request a sign-in link.');setLoginMessage(result.message);}catch(error){setLoginMessage(error.message,true);}finally{button.disabled=false;}});

$('#profileForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#profileMessage','Saving your workspace…');const payload={action:'save-profile',role:form.elements.role.value,displayName:form.elements.displayName.value,organizationName:form.elements.organizationName.value,schoolName:form.elements.schoolName.value,graduationYear:form.elements.graduationYear.value,headline:form.elements.headline.value,bio:form.elements.bio.value,skills:form.elements.skills.value,portfolioVisibility:form.elements.portfolioVisibility.checked?'members':'private'};try{await portalRequest({method:'PATCH',body:JSON.stringify(payload)});$('#profileDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#profileMessage',error.message,true);}finally{button.disabled=false;}});

$('#projectForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#projectMessage','Creating project…');const payload={action:'create-project',title:form.elements.title.value,summary:form.elements.summary.value,deliverable:form.elements.deliverable.value,desiredSkills:form.elements.desiredSkills.value,targetDate:form.elements.targetDate.value,visibility:form.elements.visibility.value};try{await portalRequest({method:'POST',body:JSON.stringify(payload)});$('#projectDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#projectMessage',error.message,true);}finally{button.disabled=false;}});

$('#applyForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#applyMessage','Sending your interest…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'apply',projectId:form.elements.projectId.value,note:form.elements.note.value})});$('#applyDialog').close();await loadDashboard();setView('discover');}catch(error){setDialogMessage('#applyMessage',error.message,true);}finally{button.disabled=false;}});

$$('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>{const dialog=button.closest('dialog');if(dialog.id==='profileDialog'&&$('#profileForm').dataset.required==='true')return;dialog.close();}));
$$('[name="role"]',$('#profileForm')).forEach(input=>input.addEventListener('change',updateProfileFields));
$('#primaryAction').addEventListener('click',event=>{const target=event.currentTarget.dataset.target;if(target==='profile')openProfile({required:!state.dashboard.profile});else if(target==='new-project')openProject();else setView(target);});
$('#newProject').addEventListener('click',openProject);$('#editProfile').addEventListener('click',()=>openProfile());
$('#discoverSearch').addEventListener('input',renderDiscover);
$('#memberSignout').addEventListener('click',()=>{clearSession();state.dashboard=null;showAuth('Signed out of this browser.');});
$('#mobileMenu').addEventListener('click',()=>$('.member-nav').classList.toggle('is-open'));

const authError=captureAuthRedirect();
checkAuthReadiness();
if(authError)showAuth(authError,true);else if(session().accessToken)loadDashboard();else showAuth();
