const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const ACCESS_KEY = 'covendaMemberAccessToken';
const REFRESH_KEY = 'covendaMemberRefreshToken';
const EXPIRY_KEY = 'covendaMemberExpiry';
// Non-sensitive display cache (name/avatar/role) so the marketing nav can paint a
// "Signed in" state instantly on same-origin loads. Never holds tokens.
const SUMMARY_KEY = 'covendaMemberSummary';

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
// "Remember me": the session lives in localStorage so it survives a browser restart
// (was sessionStorage, which was wiped on close). Persisting the refresh token in
// localStorage is the standard remember-me tradeoff; httpOnly-cookie is a someday item.
function session() { return { accessToken:localStorage.getItem(ACCESS_KEY)||'', refreshToken:localStorage.getItem(REFRESH_KEY)||'', expiresAt:Number(localStorage.getItem(EXPIRY_KEY)||0) }; }
function saveSession(data) { if (data.accessToken) localStorage.setItem(ACCESS_KEY,data.accessToken); if (data.refreshToken) localStorage.setItem(REFRESH_KEY,data.refreshToken); if (data.expiresAt) localStorage.setItem(EXPIRY_KEY,String(data.expiresAt)); }
function clearSession() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(EXPIRY_KEY); localStorage.removeItem(SUMMARY_KEY); }
function cacheMemberSummary(profile,fallbackName) { try{ localStorage.setItem(SUMMARY_KEY,JSON.stringify({ displayName:profile?.display_name||fallbackName||'', avatarUrl:profile?.avatar_url||'', role:profile?.role||'' })); }catch{} }
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
    const dashboard=await portalRequest(); state.dashboard=dashboard; showMember(); renderDashboard(); startMessagePolling(); consumeProjectSeed();
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
  const allowed=['overview','projects','activity','discover','batches','portfolio','messages','wallet'];
  state.view=allowed.includes(view)?view:'overview';
  $$('[data-portal-view]').forEach(section=>section.classList.toggle('is-active',section.dataset.portalView===state.view));
  $$('[data-view]').forEach(button=>button.classList.toggle('is-active',button.closest('.member-nav')&&button.dataset.view===state.view));
  $('#memberBreadcrumb').textContent=`Workspace / ${titleCase(state.view)}`;
  $('.member-nav').classList.remove('is-open');
  // Opening Messages clears the unread indicator and pulls the latest immediately.
  if(state.view==='messages'){state.unreadMessages=0;paintUnread();pollMessages();}
  window.scrollTo({top:0,behavior:'smooth'});
  revealify();
}

// ---- Scroll-reveal: portal modules rise in as they enter the viewport, on every view. ----
// Purely presentational; reduced-motion (or no IntersectionObserver) leaves everything visible.
const prvIO=('IntersectionObserver' in window)&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('prv-in');prvIO.unobserve(e.target);}}),{threshold:.08})
  : null;
function revealify(){
  if(!prvIO)return;
  $$('.overview-grid > section, .focus-section, .list-row, .packet-card, .verified-record, .activity-row, .discover-card, .opportunity-card, .batch-card, .talent-card, .pow-card, .cred-meter, .proof-of-work, .wallet-grid > section, .wallet-ledger, .portfolio-profile, .work-trial-ladder, .request-list > *').forEach(el=>{
    if(el.dataset.prv)return;
    el.dataset.prv='1';
    el.classList.add('prv');
    prvIO.observe(el);
  });
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
  cacheMemberSummary(profile,name);
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
  const openBatches=(state.dashboard.batches||[]).filter(b=>b.status==='open').length;
  const bc=$('#batchCount'); if(bc)bc.textContent=openBatches;
  const batchesNav=$('#batchesNav'); if(batchesNav)batchesNav.hidden=!['student','company'].includes(role);
  $('#newProject').hidden=!['company','university'].includes(role);
  const now=new Date(); $('#welcomeDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const first=profile?.display_name?.split(/\s+/)[0]; $('#welcomeTitle').textContent=first?`Good ${dayPart()}, ${first}.`:`Good ${dayPart()}.`;
  $('#welcomeCopy').textContent=role==='student'?'Track your current work and find the next project that fits you.':role==='company'?'Keep projects moving and discover students through real evidence.':role==='university'?'See the projects and opportunities connected to your partner account.':'Complete your member profile to open your private workspace.';
  const primary=$('#primaryAction'); $('span',primary).textContent=role==='student'?'Discover projects':role==='company'||role==='university'?'Post a project':'Complete profile';
  primary.dataset.target=role==='student'?'discover':role==='company'||role==='university'?'new-project':'profile';
  renderCompanySegments(role); renderFocus(); renderMetrics(); renderProgress(); renderActions(); renderProjects(); renderRequests(); renderActivity(); renderDiscover(); renderBatches(); renderPortfolio(); renderMessages(); renderWallet(); revealify();
}

function dayPart(){const hour=new Date().getHours();return hour<12?'morning':hour<17?'afternoon':'evening';}
// Company home leads with the two jobs it does: delegate stuck work, and find elite talent.
function renderCompanySegments(role){
  const root=$('#companySegments');if(!root)return;
  if(role!=='company'){root.hidden=true;root.replaceChildren();return;}
  root.replaceChildren();
  const seg=(iconId,title,copy,actions)=>{
    const card=document.createElement('article');card.className='company-segment';
    const mark=document.createElement('span');mark.className='company-segment-icon';mark.append(icon(iconId));
    const h=document.createElement('h2');h.textContent=title;
    const p=document.createElement('p');p.textContent=copy;
    const row=document.createElement('div');row.className='company-segment-actions';
    actions.forEach(([label,run,primary])=>{const b=document.createElement('button');b.type='button';b.className=primary?'portal-primary compact':'portal-ghost compact';b.textContent=label;b.addEventListener('click',run);row.append(b);});
    card.append(mark,h,p,row);return card;
  };
  root.append(
    seg('p-clock','Work that keeps getting pushed back','That task that slips every week — hand it off as a scoped, reviewed project. Covenda carries the scoping; you only approve the result.',[['Post a project',()=>openIntake(),true],['Ask Covenda to scope it',()=>openRequest()]]),
    seg('p-spark','Find elite talent','Vetted, referral-backed students. Search the talent base, or browse curated elite batches.',[['Browse talent',()=>setView('portfolio'),true],['Elite batches',()=>setView('batches')]]),
  );
  root.hidden=false;
}

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
function verifiedCard(project,{full=false}={}){const card=document.createElement('div');card.className='verified-record';const head=document.createElement('div');head.className='verified-head';head.append(icon('p-check'));const badge=document.createElement('span');badge.textContent='Verified work record';head.append(badge);const h=document.createElement('h3');h.textContent=project.title;card.append(head,h);if(full&&project.summary){const s=document.createElement('p');s.className='verified-summary';s.textContent=project.summary;card.append(s);}const p=document.createElement('p');p.textContent=`Reviewer accepted${project.completed_at?` · ${dateLabel(project.completed_at)}`:''}`;card.append(p);const earned=document.createElement('p');earned.className='verified-earned';earned.textContent='Stage 1 cleared — eligible for deeper, higher-access work.';card.append(earned);return card;}
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
// Deleting a draft is safe (no escrow, no applicants) but still irreversible, so it arms on
// the first click like the cancel button.
function deleteDraftButton(project){
  const label='Delete draft';
  const b=document.createElement('button');b.type='button';b.className='portal-ghost cancel-project';b.textContent=label;
  let armed=false,timer=0;
  b.addEventListener('click',async()=>{
    if(!armed){armed=true;b.textContent='Click again to delete';b.classList.add('is-armed');timer=window.setTimeout(()=>{armed=false;b.textContent=label;b.classList.remove('is-armed');},5000);return;}
    window.clearTimeout(timer);b.disabled=true;b.textContent='Deleting…';
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'delete-project',projectId:project.id})});await loadDashboard();setView('projects');}
    catch(error){b.textContent=error.message;b.disabled=false;armed=false;b.classList.remove('is-armed');}
  });
  return b;
}
// A student withdraws (removes) an application they haven't been accepted into; arms once.
function withdrawApplicationButton(application){
  const label='Withdraw';
  const b=document.createElement('button');b.type='button';b.className='row-action';b.textContent=label;
  let armed=false,timer=0;
  b.addEventListener('click',async()=>{
    if(!armed){armed=true;b.textContent='Click to confirm';timer=window.setTimeout(()=>{armed=false;b.textContent=label;},5000);return;}
    window.clearTimeout(timer);b.disabled=true;b.textContent='Withdrawing…';
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'withdraw-application',applicationId:application.id})});await loadDashboard();setView('activity');}
    catch(error){b.textContent=error.message;b.disabled=false;armed=false;}
  });
  return b;
}
async function runAcceptApplication(applicationId,button){button.disabled=true;const original=button.textContent;button.textContent='Accepting…';try{await portalRequest({method:'POST',body:JSON.stringify({action:'accept-application',applicationId})});await loadDashboard();setView('overview');}catch(error){button.textContent=error.message;button.disabled=false;setTimeout(()=>{button.textContent=original;},4000);}}
async function runDeclineApplication(applicationId,button){button.disabled=true;const original=button.textContent;button.textContent='Declining…';try{await portalRequest({method:'POST',body:JSON.stringify({action:'decline-application',applicationId})});await loadDashboard();setView('activity');}catch(error){button.textContent=error.message;button.disabled=false;setTimeout(()=>{button.textContent=original;},4000);}}
// §4b Greenhouse-style candidate card — the owner's view of an applicant: profile, fit score
// + reasons, self-rated skills (matched to the ask), referral, work sample + intro video,
// note, and Accept / Decline. Only ever rendered for the project owner.
function applicantCard(application,project){
  const a=application.applicant;const card=document.createElement('article');card.className='applicant-card';
  const head=document.createElement('div');head.className='applicant-head';
  const av=document.createElement('div');av.className='applicant-avatar';paintAvatarSlot(av,a?.avatar_url,initial(a?.display_name||'C'));head.append(av);
  const id=document.createElement('div');id.className='applicant-id';const name=document.createElement('h3');name.textContent=a?.display_name||'Student applicant';if(a?.identity_verified)name.append(identityBadge());const sub=document.createElement('p');sub.textContent=[a?.headline,a?.school_name,a?.graduation_year&&`Class of ${a.graduation_year}`].filter(Boolean).join(' · ')||'Student member';id.append(name,sub);head.append(id);
  if(application.fit_score!=null)head.append(fitPill(application.fit_score,application.fit&&application.fit.presentation));
  if(application.fit)card.append(fitWhyBlock({reasons:application.fit.reasons,concerns:application.fit.concerns,approach:application.fit.recommendedApproach}));
  card.append(head);
  const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(applicationStatusLabels[application.status]||titleCase(application.status),'status-pill',application.status));if(project)meta.append(pill(project.title,'status-pill'));card.append(meta);
  if((application.fit_reasons||[]).length){const rs=document.createElement('div');rs.className='fit-reasons';application.fit_reasons.slice(0,3).forEach(r=>{const s=document.createElement('span');s.textContent=r;rs.append(s);});card.append(rs);}
  if((application.skills||[]).length){const ask=new Set((Array.isArray(project?.desired_skills)?project.desired_skills:String(project?.desired_skills||'').split(',')).map(s=>String(s).toLowerCase().trim()).filter(Boolean));const sk=document.createElement('div');sk.className='applicant-skills';application.skills.forEach(s=>sk.append(pill(s,ask.has(String(s).toLowerCase().trim())?'skill-pill is-matched':'skill-pill')));card.append(sk);}
  if(application.note){const n=document.createElement('p');n.className='applicant-note';n.textContent=application.note;card.append(n);}
  const ref=application.referral||{};if(ref.name||ref.code){const rr=document.createElement('p');rr.className='applicant-referral'+(ref.verified?' is-verified':'');const who=ref.verified?(ref.partner||ref.name):(ref.name||'—');rr.textContent=ref.verified?`Endorsed by ${who} · Covenda-certified`:`Referred by ${who}${ref.code?` (${ref.code})`:''} · referral pending`;card.append(rr);}
  const links=document.createElement('div');links.className='applicant-links';
  if(application.demonstration){if(/^https?:\/\//i.test(application.demonstration)){const dl=document.createElement('a');dl.href=application.demonstration;dl.target='_blank';dl.rel='noopener';dl.textContent='View work sample';links.append(dl);}else{const p=document.createElement('p');p.className='applicant-note';p.textContent=application.demonstration;card.append(p);}}
  if(application.video_url){const vl=document.createElement('a');vl.href=application.video_url;vl.target='_blank';vl.rel='noopener';vl.textContent='Watch intro video';links.append(vl);}
  if(links.children.length)card.append(links);
  if(project&&['open','matched'].includes(project.status)&&['submitted','reviewing','shortlisted'].includes(application.status)){const actions=document.createElement('div');actions.className='applicant-actions';const accept=document.createElement('button');accept.type='button';accept.className='portal-primary compact';accept.textContent='Accept';accept.addEventListener('click',()=>runAcceptApplication(application.id,accept));const decline=document.createElement('button');decline.type='button';decline.className='portal-secondary compact';decline.textContent='Decline';decline.addEventListener('click',()=>runDeclineApplication(application.id,decline));actions.append(accept,decline);card.append(actions);}
  return card;
}

// §11: metric tiles are real buttons that jump to the matching view and scroll-highlight it.
function pulse(selector){const el=selector&&$(selector);if(!el)return;el.classList.add('is-highlighted');el.scrollIntoView({behavior:'smooth',block:'nearest'});setTimeout(()=>el.classList.remove('is-highlighted'),1500);}
function renderMetrics(){
  const root=$('#memberMetrics');root.replaceChildren();const d=state.dashboard;const role=d.profile?.role;
  const values=role==='student'
    ?[[d.projects.length,'Current projects','projects','#projectList'],[d.verifiedCount||0,'Verified records','projects','#projectList'],[d.applications.length,'Applications','activity','#applicationList']]
    :[[d.projects.length,'Posted projects','projects','#projectList'],[d.applications.length,'Student applications','activity','#applicationList'],[(d.intakes||[]).length,'Form submissions','activity','#intakeList']];
  for(const [value,label,target,highlight] of values){
    const item=document.createElement('button');item.type='button';item.className='metric';item.setAttribute('aria-label',`${value} ${label} — open`);
    const strong=document.createElement('strong');strong.textContent=value;const span=document.createElement('span');span.textContent=label;item.append(strong,span);
    item.addEventListener('click',()=>{setView(target);pulse(highlight);});
    root.append(item);
  }
}
// §6 brokered requests: the company's transparent list of what they've asked Covenda to package.
const requestTypeLabels={new_project:'New project',more_students:'More students',scope_change:'Scope change',revision:'Revision',consult:'Consult',question:'Question',specific_student:'Specific student'};
const requestStatusLabels={submitted:'Submitted',in_packaging:'Being packaged',packaged:'Packaged',declined:'Declined',closed:'Closed'};
function renderRequests(){
  const root=$('#requestList');if(!root)return;root.replaceChildren();
  const d=state.dashboard;const requests=d.projectRequests||[];
  if(d.profile?.role==='student'||!requests.length)return;
  const head=document.createElement('p');head.className='request-list-head';head.textContent=`Your requests to Covenda · ${requests.length}`;root.append(head);
  for(const r of requests){
    const row=document.createElement('article');row.className='request-row';const main=document.createElement('div');
    const top=document.createElement('div');top.className='request-top';top.append(pill(requestTypeLabels[r.request_type]||titleCase(r.request_type),'status-pill'),pill(requestStatusLabels[r.status]||titleCase(r.status),'status-pill',r.status));main.append(top);
    if(r.subject){const h=document.createElement('h3');h.textContent=r.subject;main.append(h);}
    const p=document.createElement('p');p.className='request-details';p.textContent=r.details;main.append(p);
    if(r.resolution_note){const rn=document.createElement('p');rn.className='request-resolution';rn.textContent=`Covenda: ${r.resolution_note}`;main.append(rn);}
    const time=document.createElement('small');time.className='request-time';time.textContent=`Requested ${dateLabel(r.created_at)}`;main.append(time);
    row.append(main);root.append(row);
  }
}
function openRequest(){const form=$('#requestForm');if(form)form.reset();setDialogMessage('#requestMessage','');$('#requestDialog').showModal();}

function renderProgress(){const profile=state.dashboard.profile;const score=profileCompletion(profile);$('#profileRing').style.setProperty('--progress',`${score*3.6}deg`);$('strong',$('#profileRing')).textContent=`${score}%`;$('#profileProgressTitle').textContent=score===100?'Your profile is ready':score>=60?'Add the finishing details':'Make a strong first impression';$('#profileProgressCopy').textContent=profile?.role==='student'?'Companies see only portfolios you choose to share.':'A complete organization profile adds context to every project.';}

function renderActions(){const root=$('#nextActions');root.replaceChildren();const d=state.dashboard;const actions=[];if(profileCompletion(d.profile)<100)actions.push(['p-user','Complete your member profile','Add a headline, context, and skills.']);if(d.profile?.role==='student'&&!d.applications.length)actions.push(['p-compass','Explore your first opportunity','Open projects are ready to review.']);if(['company','university'].includes(d.profile?.role)&&!d.projects.length)actions.push(['p-plus','Create a private project draft','Start with the outcome and useful deliverable.']);if(!actions.length)actions.push(['p-check','You are caught up','New project activity will appear here.']);for(const [iconId,title,copy] of actions){const li=document.createElement('li');const mark=document.createElement('span');mark.append(icon(iconId));const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;div.append(strong,small);li.append(mark,div);root.append(li);}}

function emptyList(root,iconId,title,copy,action){root.replaceChildren();const box=document.createElement('div');box.className='list-empty';const mark=document.createElement('span');mark.append(icon(iconId));const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=copy;box.append(mark,h,p);if(action&&action.label&&typeof action.run==='function'){const b=document.createElement('button');b.type='button';b.className='empty-cta';b.textContent=action.label;b.addEventListener('click',action.run);box.append(b);}root.append(box);}

function renderProjects(){const root=$('#projectList');const items=state.dashboard.projects;root.replaceChildren();if(!items.length){const isStudent=state.dashboard.profile?.role==='student';emptyList(root,'p-project','No projects in this workspace yet.',isStudent?'Assigned work will appear here with its status and due date.':'Post a private draft when you are ready to shape the first project.',isStudent?{label:'Discover projects →',run:()=>setView('discover')}:{label:'Post a project →',run:openIntake});return;}for(const project of items){if(project.status==='archived')continue;if(project.status==='complete'){root.append(verifiedCard(project,{full:true}));continue;}if(project.status==='proposed'){root.append(packetCard(project));continue;}const row=document.createElement('article');row.className='list-row';const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;main.append(h,p);const status=document.createElement('div');status.className='list-cell';const statusSmall=document.createElement('small');statusSmall.textContent='Status';status.append(statusSmall,pill(statusLabels[project.status]||titleCase(project.status),'status-pill',project.status));const due=cell('Target',project.target_date?dateLabel(project.target_date):'Not scheduled');const visibility=cell('Visibility',titleCase(project.visibility));row.append(main,status,due,visibility);if(project.status==='draft'&&['company','university'].includes(state.dashboard.profile?.role))row.append(deleteDraftButton(project));root.append(row);}}
function cell(label,value){const div=document.createElement('div');div.className='list-cell';const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;div.append(small,strong);return div;}
// Packet-first intake (GTM Move 1): a Covenda-scoped packet the company accepts (funds it) or declines.
function packetCard(project){
  const card=document.createElement('article');card.className='packet-card';
  const top=document.createElement('div');top.className='packet-card-top';
  const eyebrow=document.createElement('p');eyebrow.className='packet-eyebrow';eyebrow.textContent='Stage 1 · Work-trial — scoped by Covenda, no systems access';
  const h=document.createElement('h3');h.textContent=project.title;
  top.append(eyebrow,h);card.append(top);
  const rows=[['Deliverable',project.deliverable],['Acceptance criteria',project.acceptance_criteria],['Target',project.target_date?dateLabel(project.target_date):'Flexible']];
  const dl=document.createElement('dl');dl.className='packet-dl';
  rows.filter(([,v])=>v).forEach(([k,v])=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;dl.append(dt,dd);});
  card.append(dl);
  const price=Number(project.credits_listed)||0;
  const priceRow=document.createElement('div');priceRow.className='packet-price';
  const strong=document.createElement('strong');strong.textContent=price?`${price.toLocaleString()} credits`:'Free';const small=document.createElement('span');small.textContent='pay-on-acceptance · a 10% platform fee applies on top';priceRow.append(strong,small);card.append(priceRow);
  const msg=document.createElement('p');msg.className='packet-msg';msg.setAttribute('aria-live','polite');card.append(msg);
  const actions=document.createElement('div');actions.className='packet-actions';
  const accept=document.createElement('button');accept.type='button';accept.className='portal-primary compact';accept.textContent='Accept & fund';
  const decline=document.createElement('button');decline.type='button';decline.className='portal-ghost compact';decline.textContent='Decline';
  accept.addEventListener('click',()=>respondPacket(project.id,'accept',accept,msg));
  decline.addEventListener('click',()=>{if(confirm('Decline this packet?'))respondPacket(project.id,'decline',decline,msg);});
  actions.append(accept,decline);card.append(actions);
  return card;
}
async function respondPacket(projectId,decision,button,msg){
  button.disabled=true;const original=button.textContent;button.textContent=decision==='accept'?'Funding…':'Declining…';if(msg){msg.textContent='';msg.classList.remove('is-error');}
  try{
    await portalRequest({method:'POST',body:JSON.stringify({action:'respond-packet',projectId,decision})});
    await loadDashboard();setView('projects');
  }catch(error){if(msg){msg.textContent=error.message;msg.classList.add('is-error');}button.disabled=false;button.textContent=original;}
}

function renderActivity(){
  const d=state.dashboard;const intakes=d.intakes||[];const applications=d.applications||[];const intakeRoot=$('#intakeList');const applicationRoot=$('#applicationList');
  $('#intakeSummary').textContent=`${intakes.length} ${intakes.length===1?'submission':'submissions'}`;
  $('#applicationSummary').textContent=`${applications.length} ${applications.length===1?'application':'applications'}`;
  $('#applicationTitle').textContent=d.profile?.role==='student'?'Your project interest':'Student applications';
  intakeRoot.replaceChildren();
  if(!intakes.length){emptyList(intakeRoot,'p-inbox','No linked form submissions yet.','Use the same email on a Covenda website form and in this portal account. The receipt will appear here after it reaches Supabase.');}
  else for(const intake of intakes){const row=document.createElement('article');row.className='activity-row';const marker=document.createElement('span');marker.className='activity-marker';marker.append(icon('p-check'));const main=document.createElement('div');const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(intakeTypeLabels[intake.submission_type]||titleCase(intake.submission_type)),pill(intakeStatusLabels[intake.status]||titleCase(intake.status),'status-pill',intake.status));const h=document.createElement('h3');h.textContent=intake.summary;const details=document.createElement('p');details.textContent=`Receipt ${intake.reference} · Submitted ${dateLabel(intake.created_at)}`;main.append(meta,h,details);row.append(marker,main);intakeRoot.append(row);}
  applicationRoot.replaceChildren();
  if(!applications.length){const isStudent=d.profile?.role==='student';emptyList(applicationRoot,'p-compass',isStudent?'No project applications yet.':'No student applications yet.',isStudent?'When you send interest in a project, its review status will appear here.':'Applications will appear after students express interest in your open projects.',isStudent?{label:'Explore open projects →',run:()=>setView('discover')}:null);return;}
  const knownProjects=[...(d.projects||[]),...(d.opportunities||[])];
  for(const application of applications){const project=knownProjects.find(item=>item.id===application.project_id);if(d.profile?.role!=='student'){applicationRoot.append(applicantCard(application,project));continue;}const row=document.createElement('article');row.className='activity-row';const marker=document.createElement('span');marker.className='activity-marker';marker.append(icon('p-project'));const main=document.createElement('div');const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(applicationStatusLabels[application.status]||titleCase(application.status),'status-pill',application.status));const h=document.createElement('h3');h.textContent=project?.title||'Covenda project application';const details=document.createElement('p');details.textContent=`Updated ${dateLabel(application.updated_at||application.created_at)}`;main.append(meta,h,details);if(d.profile?.role==='student'&&['submitted','reviewing','shortlisted'].includes(application.status))main.append(withdrawApplicationButton(application));if(d.profile?.role!=='student'&&project&&['open','matched'].includes(project.status)&&['submitted','reviewing','shortlisted'].includes(application.status)){const accept=document.createElement('button');accept.type='button';accept.className='row-action';accept.textContent='Accept applicant';accept.addEventListener('click',()=>runAcceptApplication(application.id,accept));main.append(accept);}row.append(marker,main);applicationRoot.append(row);}
}

// ===== Wallet & credits (company/university) =====
// 1 credit = $1. The cost model mirrors projectCreditCost() on the server exactly — if
// one changes, change both.
const REACH_FEE_TARGETED=25;
const PLATFORM_FEE_RATE=0.10;
// Mirror of the server pricing (api/portal.js creditPriceCents): 1 credit = $1, 5% off at 500,
// 10% off at 1000. The server re-validates + re-prices, so this is only for the live display.
const CREDIT_MIN=50,CREDIT_MAX=100000;
function creditRate(n){return n>=1000?0.90:n>=500?0.95:1.00;}
function creditPriceUsd(n){return Math.round(n*creditRate(n)*100)/100;}
const ledgerLabels={purchase:'Purchase',reach_fee:'Reach fee',escrow_hold:'Escrow held',escrow_release:'Paid to student',platform_fee:'Platform fee',refund:'Refund',adjustment:'Adjustment',payout:'Payout',ai_brief:'AI brief',promo:'Welcome bonus'};
function projectCreditCost(creditsListed,targeting){
  const listed=Math.max(0,Math.round(Number(creditsListed)||0));
  const reachFee=targeting==='targeted'?REACH_FEE_TARGETED:0;
  // Use the deployment's fee rate from the dashboard so the displayed cost always matches what
  // the server charges; fall back to the code default before the dashboard has loaded.
  const rate=state.dashboard?.platformFeeRate??PLATFORM_FEE_RATE;
  const platformFee=Math.round(listed*rate);
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
  renderCreditPicker(bundles);
  renderWalletLedger();
}
// Choose-your-own credit amount with live, volume-discounted pricing.
function renderCreditPicker(root){
  root.replaceChildren();
  const wrap=document.createElement('div');wrap.className='credit-picker';
  const label=document.createElement('label');label.className='credit-picker-label';label.setAttribute('for','creditAmountInput');label.textContent='How many credits?';
  const inputRow=document.createElement('div');inputRow.className='credit-input-row';
  const input=document.createElement('input');input.type='number';input.id='creditAmountInput';input.min=String(CREDIT_MIN);input.max=String(CREDIT_MAX);input.step='50';input.value='500';input.setAttribute('inputmode','numeric');
  const unit=document.createElement('span');unit.className='credit-input-unit';unit.textContent='credits';
  inputRow.append(input,unit);
  const chips=document.createElement('div');chips.className='credit-chips';
  [250,500,1000,2500].forEach(v=>{const c=document.createElement('button');c.type='button';c.className='credit-chip';c.textContent=v.toLocaleString();c.addEventListener('click',()=>{input.value=String(v);update();input.focus();});chips.append(c);});
  const price=document.createElement('div');price.className='credit-price';
  const buy=document.createElement('button');buy.type='button';buy.className='wallet-buy-btn';buy.textContent='Buy credits';
  const hint=document.createElement('p');hint.className='credit-hint';hint.textContent='1 credit = $1. 500+ save 5% · 1,000+ save 10%.';
  const currentAmount=()=>Math.round(Number(input.value)||0);
  function update(){
    const n=currentAmount();
    price.replaceChildren();
    if(!Number.isFinite(n)||n<CREDIT_MIN||n>CREDIT_MAX){const warn=document.createElement('span');warn.className='credit-price-warn';warn.textContent=`Enter ${CREDIT_MIN.toLocaleString()}–${CREDIT_MAX.toLocaleString()} credits.`;price.append(warn);buy.disabled=true;return;}
    buy.disabled=false;
    const usd=creditPriceUsd(n);const save=Math.round((1-creditRate(n))*100);
    const amt=document.createElement('strong');amt.textContent=`$${usd.toLocaleString(undefined,{minimumFractionDigits:usd%1?2:0,maximumFractionDigits:2})}`;price.append(amt);
    if(save>0){const em=document.createElement('em');em.textContent=`Save ${save}%`;price.append(em);}
  }
  input.addEventListener('input',update);
  buy.addEventListener('click',()=>{const n=currentAmount();if(!Number.isFinite(n)||n<CREDIT_MIN||n>CREDIT_MAX){setDialogMessage('#walletMessage',`Choose between ${CREDIT_MIN} and ${CREDIT_MAX.toLocaleString()} credits.`,true);return;}runBuyCredits(n,buy);});
  wrap.append(label,inputRow,chips,price,buy,hint);
  root.append(wrap);
  update();
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

let messageDraftAttachments=[];
// Switching threads must not carry a half-typed draft or staged files into another project.
function clearMessageDraft(){messageDraftAttachments=[];const ta=$('#messageBody');if(ta){ta.value='';ta.style.height='auto';}renderMessageAttachments();const status=$('#messageFormStatus');if(status){status.textContent='';status.classList.remove('is-error');}}
function selectMessageProject(projectId){if(projectId!==state.messageProjectId)clearMessageDraft();state.messageProjectId=projectId;renderMessages();}
// §4c live messages: poll for new messages across the caller's projects and merge them in.
function latestMessageTimestamp(){let latest='';for(const m of (state.dashboard?.messages||[])){if(!latest||new Date(m.created_at)>new Date(latest))latest=m.created_at;}return latest;}
let messagePollTimer=null;
async function pollMessages(){
  if(!session().accessToken||!state.dashboard)return;
  let result;try{result=await portalRequest({method:'POST',body:JSON.stringify({action:'get-messages',since:latestMessageTimestamp()})});}catch{return;}
  const incoming=result.messages||[];if(!incoming.length)return;
  const seen=new Set((state.dashboard.messages||[]).map(m=>m.id));
  const fresh=incoming.filter(m=>m.id&&!seen.has(m.id));
  if(!fresh.length)return;
  state.dashboard.messages.push(...fresh);
  const fromOthers=fresh.filter(m=>m.author_user_id!==state.dashboard.user.id);
  if(state.view==='messages')renderMessages();
  if(fromOthers.length&&state.view!=='messages'){state.unreadMessages=(state.unreadMessages||0)+fromOthers.length;paintUnread();}
}
function paintUnread(){const btn=$('.member-nav [data-view="messages"]');if(btn)btn.classList.toggle('has-unread',(state.unreadMessages||0)>0);}
function startMessagePolling(){if(messagePollTimer)return;messagePollTimer=setInterval(()=>{if(document.visibilityState==='visible')pollMessages();},9000);}

function renderMessages(){
  const d=state.dashboard;const projects=d.projects||[];const messages=d.messages||[];const projectRoot=$('#messageProjects');const thread=$('#messageThread');const form=$('#messageForm');
  projectRoot.replaceChildren();
  if(!projects.length){state.messageProjectId=null;$('#messageProjectTitle').textContent='No project conversations yet';$('#messageProjectStatus').textContent='';form.hidden=true;emptyList(thread,'p-message','Messages begin with a project.','Once a project is posted or assigned, its private thread will appear here.');return;}
  if(!projects.some(project=>project.id===state.messageProjectId))state.messageProjectId=projects[0].id;
  for(const project of projects){const projectMessages=messages.filter(message=>message.project_id===project.id);const button=document.createElement('button');button.type='button';button.className=project.id===state.messageProjectId?'is-active':'';const title=document.createElement('strong');title.textContent=project.title;const meta=document.createElement('span');meta.textContent=`${statusLabels[project.status]||titleCase(project.status)} · ${projectMessages.length} ${projectMessages.length===1?'message':'messages'}`;button.append(title,meta);button.addEventListener('click',()=>selectMessageProject(project.id));projectRoot.append(button);}
  const project=projects.find(item=>item.id===state.messageProjectId);$('#messageProjectTitle').textContent=project.title;$('#messageProjectStatus').textContent=statusLabels[project.status]||titleCase(project.status);form.hidden=false;
  // Only auto-scroll to the newest message if the reader was already at the bottom (or just
  // switched threads), so a poll can't yank them away from something they're reading.
  const wasAtBottom=thread.scrollHeight-thread.scrollTop-thread.clientHeight<40;const switched=state._lastMsgProject!==state.messageProjectId;state._lastMsgProject=state.messageProjectId;
  thread.replaceChildren();
  const projectMessages=messages.filter(message=>message.project_id===project.id);
  if(!projectMessages.length){emptyList(thread,'p-message','Start the project thread.','Share a scope question, milestone, or review note. It will remain attached to this project.');return;}
  const pinned=projectMessages.filter(m=>m.pinned);
  if(pinned.length){
    const strip=document.createElement('div');strip.className='message-pinned';
    const head=document.createElement('p');head.className='message-pinned-head';head.append(icon('p-spark'));const ht=document.createElement('span');ht.textContent=`Pinned · ${pinned.length}`;head.append(ht);strip.append(head);
    for(const message of pinned)strip.append(messageBubble(message,d.user.id,true));
    thread.append(strip);
  }
  for(const message of projectMessages)thread.append(messageBubble(message,d.user.id,false));
  if(wasAtBottom||switched)thread.scrollTop=thread.scrollHeight;
}
function messageBubble(message,ownId,inPinnedStrip){
  const own=message.author_user_id===ownId;
  const article=document.createElement('article');article.className=`message-bubble${own?' is-own':''}${message.pinned?' is-pinned':''}`;
  const author=document.createElement('strong');author.textContent=own?'You':'Project participant';article.append(author);
  if(message.body){const body=document.createElement('p');body.textContent=message.body;article.append(body);}
  const files=Array.isArray(message.attachments)?message.attachments:[];
  if(files.length){const wrap=document.createElement('div');wrap.className='message-files';files.forEach(f=>wrap.append(messageFileLink(f)));article.append(wrap);}
  const foot=document.createElement('div');foot.className='message-bubble-foot';
  const time=document.createElement('time');time.dateTime=message.created_at;time.textContent=new Date(message.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});foot.append(time);
  // Pin toggle only in the main thread (not duplicated inside the pinned strip).
  if(!inPinnedStrip){const pin=document.createElement('button');pin.type='button';pin.className='message-pin'+(message.pinned?' is-pinned':'');pin.textContent=message.pinned?'★ Unpin':'☆ Pin';pin.addEventListener('click',()=>togglePinMessage(message,pin));foot.append(pin);}
  article.append(foot);
  return article;
}
function messageFileLink(file){
  const a=document.createElement('a');a.className='message-file';a.href=file.blobUrl||'#';a.target='_blank';a.rel='noopener noreferrer';
  a.append(icon('p-inbox'));const name=document.createElement('span');name.textContent=file.name||'Attachment';a.append(name);
  if(Number(file.sizeBytes)>0){const size=document.createElement('small');size.textContent=formatBytes(Number(file.sizeBytes));a.append(size);}
  return a;
}
function formatBytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(0)} KB`;return `${(n/1048576).toFixed(1)} MB`;}
async function togglePinMessage(message,button){
  button.disabled=true;const original=button.textContent;button.textContent='…';
  try{
    const result=await portalRequest({method:'POST',body:JSON.stringify({action:'pin-message',messageId:message.id,pinned:!message.pinned})});
    const i=(state.dashboard.messages||[]).findIndex(m=>m.id===message.id);
    if(i>=0)state.dashboard.messages[i]={...state.dashboard.messages[i],...result.message};
    renderMessages();
  }catch(error){button.textContent=error.message;button.disabled=false;setTimeout(()=>{button.textContent=original;},2600);}
}
function renderMessageAttachments(){
  const root=$('#messageAttachments');if(!root)return;root.replaceChildren();
  root.hidden=!messageDraftAttachments.length;
  messageDraftAttachments.forEach((f,idx)=>{
    const chip=document.createElement('span');chip.className='message-attach-chip';
    const name=document.createElement('span');name.textContent=f.name||'Attachment';chip.append(name);
    const remove=document.createElement('button');remove.type='button';remove.setAttribute('aria-label',`Remove ${f.name||'attachment'}`);remove.textContent='×';remove.addEventListener('click',()=>{messageDraftAttachments.splice(idx,1);renderMessageAttachments();});chip.append(remove);
    root.append(chip);
  });
}
async function uploadMessageFile(file){
  const status=$('#messageFormStatus');
  const prepared=/^image\//.test(file.type||'')?await downscaleImage(file,1600,'image/webp',0.85):file;
  if(prepared.size>DIRECT_UPLOAD_LIMIT){if(status){status.textContent=`${file.name} is too large (over ~4 MB). Compress it or share a link.`;status.classList.add('is-error');}return;}
  if(messageDraftAttachments.length>=6){if(status){status.textContent='Up to 6 files per message.';status.classList.add('is-error');}return;}
  if(status){status.textContent=`Uploading ${file.name}…`;status.classList.remove('is-error');}
  try{
    const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':prepared.type||'application/octet-stream','x-file-name':encodeURIComponent(prepared.name)},body:prepared});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Upload failed.');
    messageDraftAttachments.push(data);renderMessageAttachments();if(status)status.textContent='';
  }catch(error){if(status){status.textContent=error.message;status.classList.add('is-error');}}
}

// §3 discovery: tabs (best match / all open / saved), a filter rail, fit-scored cards, and a
// side-panel detail that renders the stored §2 brief. Saved projects persist in localStorage.
const SAVED_KEY='covendaSavedProjects';
function loadSavedProjects(){try{return new Set(JSON.parse(localStorage.getItem(SAVED_KEY)||'[]'));}catch{return new Set();}}
const discoverState={tab:'best',saved:loadSavedProjects()};
function persistSavedProjects(){try{localStorage.setItem(SAVED_KEY,JSON.stringify([...discoverState.saved]));}catch{}}
function discoverFilters(){return{query:($('#discoverSearch')?.value||'').trim().toLowerCase(),vertical:$('#filterVertical')?.value||'',workType:$('#filterWorkType')?.value||'',minCredits:Number($('#filterMinCredits')?.value)||0,within:Number($('#filterWithin')?.value)||0,matchedOnly:$('#filterMatched')?.checked||false};}
// P1 hardening: a fit score is shown with its uncertainty band and evidence tier, never as a
// bare number — a wide band on thin evidence is the honest display.
function fitPill(score,pres){const s=Math.round(Number(score)||0);const el=document.createElement('span');el.className='fit-pill '+(s>=70?'is-high':s>=40?'is-mid':'is-low');el.textContent=`${s}% fit`;
  if(pres&&pres.band){const b=document.createElement('small');b.className='fit-band';b.textContent=`${pres.band.low}–${pres.band.high}`;el.append(b);el.title=`${pres.evidenceTier.replace('_','-')} evidence · likely range ${pres.band.low}–${pres.band.high} — the band tightens as verification hardens`;}
  return el;}
// A5: explainable fit card — ✓ reasons, △ concerns, a recommended approach, and the honest
// early-signal + decision-support label. Same block on student Discover and applicant review.
function fitWhyBlock({reasons=[],concerns=[],approach=''}={}){
  const wrap=document.createElement('details');wrap.className='fit-why';
  const sum=document.createElement('summary');sum.textContent='Why this fits';wrap.append(sum);
  const box=document.createElement('div');box.className='fit-why-body';
  reasons.slice(0,4).forEach(t=>{const p=document.createElement('p');p.className='fit-why-line is-good';p.textContent=`✓ ${t}`;box.append(p);});
  concerns.slice(0,2).forEach(t=>{const p=document.createElement('p');p.className='fit-why-line is-gap';p.textContent=`△ ${t}`;box.append(p);});
  if(approach){const p=document.createElement('p');p.className='fit-why-approach';p.textContent=`How to run it: ${approach}`;box.append(p);}
  const note=document.createElement('p');note.className='fit-why-note';note.textContent='Early compatibility signal — improves as projects complete. Decision support; you decide.';box.append(note);
  wrap.append(box);return wrap;
}
function discoverChip(label,value){const c=document.createElement('div');c.className='discover-chip';const s=document.createElement('small');s.textContent=label;const b=document.createElement('span');b.textContent=value;c.append(s,b);return c;}
function skillsText(project){const s=project.desired_skills;return Array.isArray(s)?s.join(', '):(s||'');}
function renderDiscover(){
  const d=state.dashboard;const root=$('#opportunityList');if(!root)return;
  const f=discoverFilters();const saved=discoverState.saved;
  let items=(d.opportunities||[]).slice();
  if(discoverState.tab==='saved')items=items.filter(p=>saved.has(p.id));
  items=items.filter(p=>{
    const hay=[p.title,p.summary,skillsText(p)].join(' ').toLowerCase();
    if(f.query&&!hay.includes(f.query))return false;
    if(f.vertical&&!(p.verticals||[]).includes(f.vertical))return false;
    if(f.workType&&!(p.work_types||[]).includes(f.workType))return false;
    if(f.minCredits&&(Number(p.credits_listed)||0)<f.minCredits)return false;
    if(f.within){const due=p.target_date?new Date(p.target_date):null;if(!due||Number.isNaN(due.getTime()))return false;const days=(due.getTime()-Date.now())/86400000;if(days<0||days>f.within)return false;}
    if(f.matchedOnly&&!p.matched)return false;
    return true;
  });
  if(discoverState.tab==='all')items.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  else items.sort((a,b)=>(b.fitScore||0)-(a.fitScore||0));
  const openCount=(d.opportunities||[]).length;const matchedCount=d.matchedCount||0;
  $('#discoverCount').textContent=`${openCount} open · ${matchedCount} matched to you`;
  const savedCountEl=$('#savedCount');if(savedCountEl)savedCountEl.textContent=saved.size;
  $('#discoverSummary').textContent=`${items.length} ${items.length===1?'project':'projects'} shown`;
  root.replaceChildren();
  if(!items.length){const savedTab=discoverState.tab==='saved';const filtered=!savedTab&&(d.opportunities||[]).length>0;emptyList(root,'p-compass',savedTab?'No saved projects yet.':filtered?'No projects match your filters.':'No open projects yet.',savedTab?'Tap Save on any project to keep it here.':filtered?'Try clearing a filter, or check back as new projects are posted.':'New reviewed opportunities appear here as companies post them. Complete your profile so Covenda can route the right fit.',filtered?{label:'Reset filters',run:()=>$('#filterReset')?.click()}:savedTab?null:{label:'Complete your profile →',run:()=>setView('portfolio')});return;}
  const applied=new Set((d.applications||[]).map(a=>a.project_id));
  for(const project of items)root.append(discoverCard(project,applied.has(project.id)));
}
function discoverCard(project,isApplied){
  const row=document.createElement('article');row.className='discover-card'+(project.matched?' is-matched':'');
  const top=document.createElement('div');top.className='discover-card-top';const h=document.createElement('h3');h.textContent=project.title;top.append(h,fitPill(project.fitScore,project.fitPresentation));row.append(top);
  const meta=document.createElement('div');meta.className='discover-meta';const pay=Number(project.credits_listed)||0;meta.append(discoverChip('Payout',pay?`${pay.toLocaleString()} credits`:'—'),discoverChip('Target',project.target_date?dateLabel(project.target_date):'Flexible'));if((project.verticals||[]).length)meta.append(discoverChip('Vertical',project.verticals[0]));row.append(meta);
  const p=document.createElement('p');p.className='discover-card-summary';p.textContent=project.summary;row.append(p);
  if((project.fitReasons||[]).length){const rs=document.createElement('div');rs.className='fit-reasons';project.fitReasons.slice(0,3).forEach(r=>{const s=document.createElement('span');s.textContent=r;rs.append(s);});row.append(rs);}
  if((project.fitConcerns||[]).length||project.fitApproach)row.append(fitWhyBlock({reasons:project.fitReasons||[],concerns:project.fitConcerns||[],approach:project.fitApproach||''}));
  const actions=document.createElement('div');actions.className='discover-actions';
  const view=document.createElement('button');view.type='button';view.className='portal-secondary compact';view.textContent='View details';view.addEventListener('click',()=>openDiscoverDetail(project,isApplied));
  const apply=document.createElement('button');apply.type='button';apply.className='portal-primary compact';apply.textContent=isApplied?'Interest sent':'Apply';apply.disabled=isApplied;apply.addEventListener('click',()=>openApply(project));
  const save=document.createElement('button');const isSaved=discoverState.saved.has(project.id);save.type='button';save.className='save-toggle'+(isSaved?' is-saved':'');save.setAttribute('aria-pressed',isSaved?'true':'false');save.setAttribute('aria-label',isSaved?'Unsave project':'Save project');save.textContent=isSaved?'★ Saved':'☆ Save';save.addEventListener('click',()=>{if(discoverState.saved.has(project.id))discoverState.saved.delete(project.id);else discoverState.saved.add(project.id);persistSavedProjects();renderDiscover();});
  actions.append(view,apply,save);row.append(actions);return row;
}
const BATCH_STATUS_LABELS={submitted:'Applied',reviewing:'In review',accepted:'Accepted',waitlisted:'Waitlisted',declined:'Not selected'};
const batchRosters=new Map(); // batchId -> loaded accepted-student array (company view cache)
function renderBatches(){
  const root=$('#batchList');if(!root)return;
  const role=state.dashboard?.profile?.role;
  if(role==='company'){renderCompanyBatches(root);return;}
  const batches=(state.dashboard.batches||[]).filter(b=>b.status==='open'||b.status==='reviewing');
  const appByBatch=new Map((state.dashboard.batchApplications||[]).map(a=>[a.batch_id,a]));
  root.replaceChildren();
  if(!batches.length){emptyList(root,'p-spark','No batches are open right now.','Curated cohorts open a few times a season. Check back — admitted students are surfaced directly to partner companies.');return;}
  for(const batch of batches)root.append(batchCard(batch,appByBatch.get(batch.id)));
}
function renderCompanyBatches(root){
  const intro=$('#batchIntro');if(intro)intro.textContent='Curated, operator-reviewed cohorts of vetted students. Unlock a batch to see its admitted roster and reach out.';
  const batches=(state.dashboard.batches||[]).filter(b=>b.status==='open'||b.status==='reviewing');
  const unlocked=new Map((state.dashboard.batchAccess||[]).map(a=>[a.batch_id,a]));
  const admitted=state.dashboard.batchAdmitted||{};
  root.replaceChildren();
  if(!batches.length){emptyList(root,'p-spark','No batches are open yet.','Curated cohorts open a few times a season. When one does, you can unlock its admitted roster here.');return;}
  for(const batch of batches)root.append(companyBatchCard(batch,unlocked.get(batch.id),admitted[batch.id]||0));
}
function companyBatchCard(batch,access,admittedCount){
  const card=document.createElement('article');card.className='batch-card'+(batch.tier==='elite'?' is-elite':'');
  const top=document.createElement('div');top.className='batch-card-top';
  const h=document.createElement('h3');h.textContent=batch.name;top.append(h);
  top.append(pill(batch.tier==='elite'?'Elite':'Open',batch.tier==='elite'?'batch-tier is-elite':'batch-tier'));
  card.append(top);
  const meta=document.createElement('div');meta.className='discover-meta';
  if(batch.discipline)meta.append(discoverChip('Discipline',batch.discipline));
  if(batch.partner_org)meta.append(discoverChip('Partner',batch.partner_org));
  meta.append(discoverChip('Admitted',`${admittedCount} ${admittedCount===1?'student':'students'}`));
  if(meta.childElementCount)card.append(meta);
  if(batch.description){const p=document.createElement('p');p.className='discover-card-summary';p.textContent=batch.description;card.append(p);}
  const price=Math.max(0,Math.round(Number(batch.access_credits)||0));
  const actions=document.createElement('div');actions.className='discover-actions';
  if(access){
    const badge=pill('Unlocked','status-pill','accepted');actions.append(badge);
    const view=document.createElement('button');view.type='button';view.className='portal-primary compact';view.textContent='View roster';
    view.addEventListener('click',()=>toggleBatchRoster(batch,card,view));
    actions.append(view);
  }else{
    const price_label=document.createElement('span');price_label.className='batch-price';price_label.textContent=price?`${price.toLocaleString()} credits`:'Free';actions.append(price_label);
    const unlock=document.createElement('button');unlock.type='button';unlock.className='portal-primary compact';unlock.textContent=admittedCount?`Unlock roster`:'No roster yet';unlock.disabled=!admittedCount;
    unlock.addEventListener('click',()=>unlockBatchAccess(batch,unlock));
    actions.append(unlock);
  }
  card.append(actions);
  const rosterHost=document.createElement('div');rosterHost.className='batch-roster';rosterHost.hidden=true;card.append(rosterHost);
  return card;
}
async function unlockBatchAccess(batch,button){
  const price=Math.max(0,Math.round(Number(batch.access_credits)||0));
  const balance=state.dashboard?.walletBalance||0;
  if(price>balance){setView('wallet');return;}
  const original=button.textContent;button.disabled=true;button.textContent='Unlocking…';
  try{
    await portalRequest({method:'POST',body:JSON.stringify({action:'unlock-batch',batchId:batch.id})});
    await loadDashboard();setView('batches');
  }catch(error){button.textContent=error.message;setTimeout(()=>{button.textContent=original;button.disabled=false;},3200);}
}
async function toggleBatchRoster(batch,card,button){
  const host=$('.batch-roster',card);if(!host)return;
  if(!host.hidden){host.hidden=true;button.textContent='View roster';return;}
  button.disabled=true;const original=button.textContent;button.textContent='Loading…';
  try{
    let roster=batchRosters.get(batch.id);
    if(!roster){const result=await portalRequest({method:'POST',body:JSON.stringify({action:'batch-roster',batchId:batch.id})});roster=result.roster||[];batchRosters.set(batch.id,roster);}
    host.replaceChildren();
    if(!roster.length){const p=document.createElement('p');p.className='batch-roster-empty';p.textContent='No students have been admitted to this batch yet. Check back after the operator finishes review.';host.append(p);}
    else{const grid=document.createElement('div');grid.className='batch-roster-grid';roster.forEach(s=>grid.append(talentCard(s)));host.append(grid);}
    host.hidden=false;button.textContent='Hide roster';
  }catch(error){button.textContent=error.message;setTimeout(()=>{button.textContent=original;},3200);}
  finally{button.disabled=false;}
}
// ---- Batch content generators ----
// Batches carry a name + optional discipline/description from the operator. The rest of the
// student-facing detail (who it's for, the kind of teams it feeds, the video prompt, the
// interest questions) is generated from those fields so a batch reads richly without the
// operator hand-filling everything. Admin-entered overrides (batch.student_profile,
// batch.sample_companies) win when present. We describe partner companies by TYPE only —
// never inventing named partnerships — and frame them honestly for a pilot stage.
function batchVertical(batch){return (batch.discipline||batch.name||'this field').trim();}
function batchStudentProfile(batch){
  return (batch.student_profile||'').trim()||`Students who can already ship in ${batchVertical(batch)} — not learning it from scratch on the job. We look for a track record you can point to (projects, research, competitions, or real deliverables), a professor or club who'll vouch for you, and the judgment to work with little hand-holding. Drive and follow-through count more than a specific GPA or title.`;
}
function batchSampleCompanies(batch){
  return (batch.sample_companies||'').trim()||`The kind of teams this cohort is built for: seed and Series-A startups working in ${batchVertical(batch)}, and small operator-led companies that need senior-quality work without a full-time hire. Exact companies vary each season — admitted students are surfaced directly to the partners hiring that cohort.`;
}
// A small bank of prompts. One is assigned at random when a student opens the application, so
// the video answer is spontaneous rather than over-rehearsed. {v} = the batch's vertical.
const BATCH_VIDEO_PROMPTS=[
  'Walk us through something you built or figured out in {v} that you are genuinely proud of — what was hard about it, and what would you do differently now?',
  'Pick a real problem a small team in {v} is likely facing today. How would you approach it in your first two weeks, with limited context and little hand-holding?',
  'Teach us one non-obvious thing about {v} — explain it so a smart person outside the field could follow.',
  'Tell us about a time you shipped something with an unclear spec. How did you decide what "done" meant, and were you right?',
  'What is a strong opinion you hold about {v} that a lot of people would disagree with — and what convinced you?',
  'Describe the last thing in {v} you taught yourself without being told to. Why that, and how did you go about it?',
];
function pickBatchPrompt(batch){
  const v=batchVertical(batch);
  const raw=BATCH_VIDEO_PROMPTS[Math.floor(Math.random()*BATCH_VIDEO_PROMPTS.length)];
  return raw.replace(/\{v\}/g,v);
}
// Short questions that gauge genuine interest in the batch's vertical (not generic fit).
function batchInterestQuestions(batch){
  const v=batchVertical(batch);
  return [
    {id:'why',label:`Why ${v}? What pulls you toward this vertical specifically?`,type:'text',placeholder:'A sentence or two — be honest, not polished.'},
    {id:'depth',label:`How deep are you in ${v} today?`,type:'select',options:['Just starting to explore it','Actively building or studying it','Worked on real projects in it','Deep — it is my main focus']},
    {id:'commit',label:`If admitted, how set are you on working in ${v}?`,type:'select',options:['Just curious','Interested','Strongly interested','It is the plan']},
  ];
}
function batchDetailSection(title,body){
  const wrap=document.createElement('div');wrap.className='batch-detail-block';
  const h=document.createElement('h4');h.textContent=title;wrap.append(h);
  const p=document.createElement('p');p.textContent=body;wrap.append(p);
  return wrap;
}

function batchCard(batch,application){
  const card=document.createElement('article');card.className='batch-card batch-card-lg'+(batch.tier==='elite'?' is-elite':'');
  const top=document.createElement('div');top.className='batch-card-top';
  const h=document.createElement('h3');h.textContent=batch.name;top.append(h);
  top.append(pill(batch.tier==='elite'?'Elite':'Open',batch.tier==='elite'?'batch-tier is-elite':'batch-tier'));
  card.append(top);
  const meta=document.createElement('div');meta.className='discover-meta';
  if(batch.discipline)meta.append(discoverChip('Discipline',batch.discipline));
  if(batch.partner_org)meta.append(discoverChip('Partner',batch.partner_org));
  if(batch.season)meta.append(discoverChip('Season',batch.season));
  if(meta.childElementCount)card.append(meta);
  if(batch.description){const p=document.createElement('p');p.className='discover-card-summary';p.textContent=batch.description;card.append(p);}

  // Expandable detail panel: who it's for, the kind of teams it feeds, and how the application works.
  const detail=document.createElement('div');detail.className='batch-detail';detail.hidden=true;
  detail.append(batchDetailSection('Who this cohort is for',batchStudentProfile(batch)));
  detail.append(batchDetailSection('Where admitted students go',batchSampleCompanies(batch)));
  detail.append(batchDetailSection('How the application works',`Two parts, about 15 minutes total: a short ~5-minute video answering a prompt we assign you when you start (so it stays spontaneous), and a few written questions about your interest in ${batchVertical(batch)}. An operator reviews every application by hand.`));

  const actions=document.createElement('div');actions.className='discover-actions batch-actions';
  const expand=document.createElement('button');expand.type='button';expand.className='portal-ghost compact batch-expand';expand.setAttribute('aria-expanded','false');
  expand.append(document.createTextNode('Expand'));
  expand.addEventListener('click',()=>{const open=detail.hidden;detail.hidden=!open;expand.setAttribute('aria-expanded',String(open));expand.firstChild.textContent=open?'Show less':'Expand';});
  actions.append(expand);
  if(application){
    actions.append(pill(BATCH_STATUS_LABELS[application.status]||titleCase(application.status),'status-pill',application.status));
  }else{
    const learn=document.createElement('button');learn.type='button';learn.className='portal-primary compact';learn.textContent='Learn more & apply';learn.disabled=batch.status!=='open';if(batch.status!=='open')learn.title='Applications are closed for this batch.';learn.addEventListener('click',()=>openBatchApply(batch));actions.append(learn);
  }
  card.append(actions,detail);return card;
}
let batchResumeUrl='';
function renderBatchResumeChip(name){const chip=$('#batchResumeChip');if(!chip)return;if(!name){chip.hidden=true;chip.textContent='';return;}chip.hidden=false;chip.replaceChildren();const s=document.createElement('span');s.textContent=name;const x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove résumé');x.textContent='×';x.addEventListener('click',()=>{batchResumeUrl='';renderBatchResumeChip('');});chip.append(s,x);}
let currentBatchPrompt='';
let batchInterestSpec=[];
function renderBatchInterest(batch){
  const host=$('#batchInterestQuestions');if(!host)return;host.replaceChildren();
  batchInterestSpec=batchInterestQuestions(batch);
  batchInterestSpec.forEach(q=>{
    const label=document.createElement('label');label.className='batch-interest-q';
    const span=document.createElement('span');span.className='batch-interest-label';span.textContent=q.label;label.append(span);
    let field;
    if(q.type==='select'){field=document.createElement('select');const ph=document.createElement('option');ph.value='';ph.textContent='Choose one…';field.append(ph);(q.options||[]).forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;field.append(opt);});}
    else{field=document.createElement('textarea');field.rows=2;field.maxLength=600;field.placeholder=q.placeholder||'';}
    field.name='interest_'+q.id;label.append(field);host.append(label);
  });
}
function readBatchInterest(form){
  return batchInterestSpec.map(q=>({id:q.id,question:q.label,answer:(form.elements['interest_'+q.id]?.value||'').trim()})).filter(a=>a.answer);
}
function openBatchApply(batch){
  const form=$('#batchApplyForm');if(!form)return;
  form.reset();batchResumeUrl='';renderBatchResumeChip('');
  form.elements.batchId.value=batch.id;
  $('#batchApplyTitle').textContent=`Apply to ${batch.name}.`;
  $('#batchApplySummary').textContent=[batch.tier==='elite'?'Elite cohort':'Cohort',batch.discipline,batch.partner_org].filter(Boolean).join(' · ');
  // Open the application "inside" the batch: recap who it's for and where students go, then the
  // assigned video prompt and the interest questions, so it doesn't feel like a bare form.
  const who=$('#batchApplyWho');if(who)who.textContent=batchStudentProfile(batch);
  const samples=$('#batchApplySamples');if(samples)samples.textContent=batchSampleCompanies(batch);
  currentBatchPrompt=pickBatchPrompt(batch); // a fresh random prompt each time the form opens
  const promptEl=$('#batchVideoPrompt');if(promptEl)promptEl.textContent=currentBatchPrompt;
  renderBatchInterest(batch);
  setDialogMessage('#batchApplyMessage','');
  $('#batchApplyDialog').showModal();
}
function renderBriefDocument(root,brief,fallbackSummary){
  root.replaceChildren();
  const add=(title,text)=>{if(!text)return;const s=briefSection(title);const p=document.createElement('p');p.className='brief-text';p.textContent=text;s.append(p);root.append(s);};
  add('Summary',(brief&&brief.summary)||fallbackSummary);
  if(!brief)return;
  add('Context',brief.context);add('Objective',brief.objective);
  if((brief.scopeInclusions||[]).length||(brief.scopeExclusions||[]).length){const s=briefSection('Scope');if(brief.scopeInclusions?.length){const t=document.createElement('p');t.className='brief-subtitle';t.textContent='In scope';s.append(t,briefBullets(brief.scopeInclusions));}if(brief.scopeExclusions?.length){const t=document.createElement('p');t.className='brief-subtitle';t.textContent='Out of scope';s.append(t,briefBullets(brief.scopeExclusions));}root.append(s);}
  if((brief.candidateDeliverables||[]).length){const s=briefSection('Deliverables');brief.candidateDeliverables.forEach(dd=>{const card=document.createElement('div');card.className='deliverable-card';const st=document.createElement('strong');st.textContent=(dd&&dd.title)||dd||'Deliverable';card.append(st);if(dd&&dd.description){const p=document.createElement('p');p.textContent=dd.description;card.append(p);}if(dd&&dd.acceptanceCriteria){const ac=document.createElement('p');ac.className='deliverable-ac';const b=document.createElement('span');b.textContent='Done when: ';ac.append(b,document.createTextNode(dd.acceptanceCriteria));card.append(ac);}s.append(card);});root.append(s);}
  if((brief.approvedInputs||[]).length){const s=briefSection('Approved inputs');s.append(briefBullets(brief.approvedInputs));root.append(s);}
  add('Estimated effort',brief.estimatedEffort);
  // Founder time required — disclosed on every generated brief (kills the management-overhead
  // objection at the point of sale; ~30-60 min/week is typical).
  if(brief.founderTimeMinWeek)add('Founder time required',`~${brief.founderTimeMinWeek} min/week of your review time — bounded checkpoints, not babysitting.`);
  if(brief.followUpQuestions&&brief.followUpQuestions.length){const s=briefSection('To sharpen the scope');s.append(briefBullets(brief.followUpQuestions));root.append(s);}
}
function openDiscoverDetail(project,isApplied){
  $('#discoverDetailTitle').textContent=project.title;const body=$('#discoverDetailBody');
  renderBriefDocument(body,project.ai_brief,project.summary);
  const head=document.createElement('div');head.className='detail-head';head.append(fitPill(project.fitScore,project.fitPresentation));const pay=Number(project.credits_listed)||0;const payS=document.createElement('span');payS.className='detail-pay';payS.textContent=pay?`${pay.toLocaleString()} credits payout`:'Payout TBD';head.append(payS);body.prepend(head);
  if((project.fitReasons||[]).length){const rs=document.createElement('div');rs.className='fit-reasons';project.fitReasons.forEach(r=>{const s=document.createElement('span');s.textContent=r;rs.append(s);});body.insertBefore(rs,head.nextSibling);}
  const footer=$('#discoverDetailFooter');footer.replaceChildren();const apply=document.createElement('button');apply.type='button';apply.className='portal-primary';apply.textContent=isApplied?'Interest already sent':'Apply to this project';apply.disabled=isApplied;apply.addEventListener('click',()=>{$('#discoverDetail').close();openApply(project);});footer.append(apply);
  $('#discoverDetail').showModal();
}

// "Identity verified ✓" credibility badge — shown wherever a verified member's name appears.
function identityBadge(){const b=document.createElement('span');b.className='identity-badge';b.title='Identity verified with a government ID via Stripe';b.append(icon('p-check'));const t=document.createElement('span');t.textContent='Identity verified';b.append(t);return b;}
// The profile-card avatar doubles as an uploader: click (or keyboard-activate) → picker →
// uploadAvatar() → persist avatar_url via save-profile (all existing fields resent so nothing
// is wiped) → repaint. `note` is an aria-live status line for progress/errors.
function portfolioAvatar(profile,note){
  const btn=document.createElement('button');
  btn.type='button';btn.className='portfolio-avatar is-editable';
  btn.setAttribute('aria-label','Change your profile photo');
  paintAvatarSlot(btn,profile?.avatar_url,initial(profile?.display_name));
  const overlay=document.createElement('span');overlay.className='avatar-overlay';overlay.textContent='Change';btn.append(overlay);
  const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.className='visually-hidden';btn.append(file);
  btn.addEventListener('click',()=>{ if(!profile?.display_name){ if(note){note.textContent='Add your name first, then you can upload a photo.';note.classList.add('is-error');} openProfile({required:true}); return; } file.click(); });
  file.addEventListener('change',async()=>{
    const chosen=file.files[0];file.value='';if(!chosen)return;
    if(note){note.textContent='Uploading your photo…';note.classList.remove('is-error');}
    btn.classList.add('is-busy');
    try{
      const url=await uploadAvatar(chosen);
      // Resend every column save-profile writes (it upserts) so the avatar update never blanks
      // the rest of the profile; additive fields (verticals/work_types) are left untouched.
      const payload={action:'save-profile',role:profile.role,displayName:profile.display_name||'',organizationName:profile.organization_name||'',schoolName:profile.school_name||'',graduationYear:profile.graduation_year||'',headline:profile.headline||'',bio:profile.bio||'',skills:(profile.skills||[]).join(', '),portfolioVisibility:profile.portfolio_visibility==='private'?'private':'members',avatarUrl:url};
      await portalRequest({method:'PATCH',body:JSON.stringify(payload)});
      await loadDashboard();setView('portfolio');
    }catch(error){btn.classList.remove('is-busy');if(note){note.textContent=error.message||'Upload failed — please try again.';note.classList.add('is-error');}}
  });
  return btn;
}
// §0/§3: the company's primary surface — a curated, searchable talent directory of vetted
// students. Filter state lives module-level so only the card list re-renders on a keystroke
// (keeps the search input focused). Hiring still flows through projects (§6 anti-bypass).
const talentFilters={query:'',vertical:'',verifiedOnly:false,skill:'',minScore:0};
const TALENT_VERTICALS=['Accounting & finance','Software & AI','Healthcare operations','Consumer & retail','Professional services'];
// Flatten a student's GitHub skill scores (from skill_signals) to the best score per skill —
// this is what makes founder discovery filter on proven skill, not self-declared tags.
function githubSkills(s){
  const g=(s&&s.skill_signals&&Array.isArray(s.skill_signals.github))?s.skill_signals.github:[];
  const map=new Map();
  g.forEach(a=>(a.skills||[]).forEach(sk=>{const cur=map.get(sk.skill);if(!cur||Number(sk.score)>cur.score)map.set(sk.skill,{skill:sk.skill,score:Number(sk.score)});}));
  return [...map.values()].sort((a,b)=>b.score-a.score);
}
function talentCard(s){
  const card=document.createElement('article');card.className='talent-card';
  const head=document.createElement('div');head.className='talent-card-head';
  const av=document.createElement('div');av.className='talent-avatar';paintAvatarSlot(av,s.avatar_url,initial(s.display_name||'C'));head.append(av);
  const id=document.createElement('div');id.className='talent-card-id';const h=document.createElement('h3');h.textContent=s.display_name||'Student member';if(s.identity_verified)h.append(identityBadge());const sub=document.createElement('p');sub.textContent=[s.headline,s.school_name,s.graduation_year&&`Class of ${s.graduation_year}`].filter(Boolean).join(' · ')||'Student member';id.append(h,sub);head.append(id);card.append(head);
  if((s.verticals||[]).length){const v=document.createElement('div');v.className='talent-verticals';s.verticals.forEach(x=>v.append(pill(x,'status-pill')));card.append(v);}
  if(s.bio){const b=document.createElement('p');b.className='talent-bio';b.textContent=s.bio;card.append(b);}
  if((s.skills||[]).length){const sk=document.createElement('div');sk.className='skills';s.skills.forEach(x=>sk.append(pill(x)));card.append(sk);}
  const gs=githubSkills(s).slice(0,3);
  if(gs.length){const g=document.createElement('div');g.className='talent-scores';gs.forEach(x=>{const chip=document.createElement('span');chip.className='talent-score-chip';const nm=document.createElement('b');nm.textContent=x.skill;const sc=document.createElement('i');sc.textContent=x.score.toFixed(1);chip.append(nm,sc);g.append(chip);});card.append(g);}
  return card;
}
function renderTalentCards(){
  const root=$('#talentResults');if(!root)return;root.replaceChildren();
  const f=talentFilters;const dir=state.dashboard?.studentDirectory||[];
  const filtered=dir.filter(s=>{
    if(f.query){const hay=[s.display_name,s.headline,s.school_name,...(s.skills||[]),...(s.verticals||[]),...githubSkills(s).map(x=>x.skill)].join(' ').toLowerCase();if(!hay.includes(f.query))return false;}
    if(f.vertical&&!(s.verticals||[]).includes(f.vertical))return false;
    if(f.verifiedOnly&&!s.identity_verified)return false;
    if(f.skill){const needle=f.skill.toLowerCase();const names=[...(s.skills||[]).map(x=>String(x).toLowerCase()),...githubSkills(s).map(x=>x.skill.toLowerCase())];if(!names.some(n=>n.includes(needle)))return false;}
    if(f.minScore){const gs=githubSkills(s);const relevant=f.skill?gs.filter(x=>x.skill.toLowerCase().includes(f.skill.toLowerCase())):gs;if(!relevant.some(x=>x.score>=f.minScore))return false;}
    return true;
  });
  const count=$('#talentCount');if(count)count.textContent=`${filtered.length} ${filtered.length===1?'student':'students'}`;
  if(!filtered.length){emptyList(root,'p-user',dir.length?'No students match your filters.':'No students in the directory yet.',dir.length?'Try clearing a filter.':'Students appear here after they finish onboarding and opt into discovery.');return;}
  for(const s of filtered)root.append(talentCard(s));
}
function renderPortfolio(){const root=$('#portfolioContent');root.replaceChildren();const {profile,studentDirectory}=state.dashboard;if(profile?.role==='company'){
  $('#portfolioEyebrow').textContent='Vetted talent';$('#portfolioTitle').textContent='Talent directory';$('#portfolioIntro').textContent='Browse students who opted into discovery — startup-fit, building real evidence. Hire by inviting them to a scoped project.';$('#editProfile').hidden=true;
  const bar=document.createElement('div');bar.className='talent-bar';
  const search=document.createElement('input');search.type='search';search.className='talent-search';search.placeholder='Search name, skill, school…';search.value=talentFilters.query;search.addEventListener('input',()=>{talentFilters.query=search.value.trim().toLowerCase();renderTalentCards();});
  const vsel=document.createElement('select');vsel.className='talent-vsel';const anyOpt=document.createElement('option');anyOpt.value='';anyOpt.textContent='Any vertical';vsel.append(anyOpt);TALENT_VERTICALS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===talentFilters.vertical)o.selected=true;vsel.append(o);});vsel.addEventListener('change',()=>{talentFilters.vertical=vsel.value;renderTalentCards();});
  const skl=document.createElement('input');skl.type='search';skl.className='talent-search talent-skill';skl.placeholder='Proven skill (e.g. Python)';skl.value=talentFilters.skill;skl.addEventListener('input',()=>{talentFilters.skill=skl.value.trim();renderTalentCards();});
  const msel=document.createElement('select');msel.className='talent-vsel';[['0','Any score'],['6','Score ≥ 6'],['7','Score ≥ 7'],['8','Score ≥ 8']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(Number(v)===talentFilters.minScore)o.selected=true;msel.append(o);});msel.addEventListener('change',()=>{talentFilters.minScore=Number(msel.value);renderTalentCards();});
  const vchk=document.createElement('label');vchk.className='talent-check';const cb=document.createElement('input');cb.type='checkbox';cb.checked=talentFilters.verifiedOnly;cb.addEventListener('change',()=>{talentFilters.verifiedOnly=cb.checked;renderTalentCards();});const cbt=document.createElement('span');cbt.textContent='Identity-verified only';vchk.append(cb,cbt);
  const count=document.createElement('span');count.className='talent-count';count.id='talentCount';
  bar.append(search,vsel,skl,msel,vchk,count);
  const results=document.createElement('div');results.className='talent-grid';results.id='talentResults';
  root.append(bar,results);renderTalentCards();return;}
  $('#portfolioEyebrow').textContent=profile?.role==='student'?'Your evidence':'Partner identity';$('#portfolioTitle').textContent=profile?.role==='student'?'Portfolio':'Organization profile';$('#portfolioIntro').textContent=profile?.role==='student'?'Shape how signed-in company members understand your work.':'Keep the context behind every project accurate.';$('#editProfile').hidden=false;const article=document.createElement('article');article.className='portfolio-profile';const avatarNote=document.createElement('p');avatarNote.className='avatar-note';avatarNote.setAttribute('aria-live','polite');const avatar=portfolioAvatar(profile,avatarNote);const details=document.createElement('div');const h=document.createElement('h2');h.textContent=profile?.display_name||'Complete your profile';if(profile?.identity_verified)h.append(identityBadge());const headline=document.createElement('p');headline.textContent=[profile?.headline,profile?.school_name||profile?.organization_name,profile?.graduation_year&&`Class of ${profile.graduation_year}`].filter(Boolean).join(' · ')||'Add a headline and member details.';const bio=document.createElement('p');bio.textContent=profile?.bio||'Add a short introduction to help the right people understand your work.';const skills=document.createElement('div');skills.className='skills';(profile?.skills||[]).forEach(skill=>skills.append(pill(skill)));details.append(h,headline,bio,skills,avatarNote);article.append(avatar,details);root.append(article);if(profile?.role==='student'){renderCredibility(root,state.dashboard);renderProofOfWork(root,profile);}}

// Live credibility meter — a checklist of REAL, earned signals (identity, completeness, proven
// GitHub skills, completed reviewed work-trials). Not a black-box score; each rung is concrete
// and links to how to earn it. Honest by construction: it only counts things that actually happened.
function renderCredibility(root,d){
  const p=d?.profile; if(p?.role!=='student') return;
  const completed=(d.projects||[]).filter(x=>x.status==='complete').length;
  const ghSkills=githubSkills(p).length;
  const signals=[
    {ok:!!p.identity_verified,label:'Identity verified',hint:'Verify your identity to add trust.'},
    {ok:profileCompletion(p)>=100,label:'Profile complete',hint:'Fill out your headline, bio, and skills.'},
    {ok:ghSkills>0,label:ghSkills?`${ghSkills} proven skill${ghSkills===1?'':'s'} from real work`:'Proven skills from real work',hint:'Analyze a GitHub repo below.'},
    {ok:completed>0,label:completed?`${completed} completed work-trial${completed===1?'':'s'}`:'Completed a reviewed work-trial',hint:'Clear a Stage 1 work-trial to compound your record.'},
  ];
  const met=signals.filter(s=>s.ok).length;
  const sec=document.createElement('section');sec.className='cred-meter';
  const head=document.createElement('div');head.className='cred-meter-head';
  const h=document.createElement('h3');h.textContent='Your credibility';
  const tag=document.createElement('span');tag.className='cred-meter-tag';tag.textContent=`${met} of ${signals.length} signals`;
  head.append(h,tag);sec.append(head);
  const track=document.createElement('div');track.className='cred-meter-track';const fill=document.createElement('i');fill.style.width=`${(met/signals.length)*100}%`;track.append(fill);sec.append(track);
  const list=document.createElement('ul');list.className='cred-meter-list';
  signals.forEach(s=>{const li=document.createElement('li');li.className=s.ok?'is-met':'';const mark=document.createElement('span');mark.className='cred-mark';mark.textContent=s.ok?'✓':'○';const txt=document.createElement('div');const strong=document.createElement('strong');strong.textContent=s.label;txt.append(strong);if(!s.ok){const hint=document.createElement('small');hint.textContent=s.hint;txt.append(hint);}li.append(mark,txt);list.append(li);});
  sec.append(list);
  const note=document.createElement('p');note.className='cred-meter-note';note.textContent='Not a black-box score — every signal is something you earned through real work or a vouch.';sec.append(note);
  root.append(sec);
}

// Skill-inference (GitHub): link a public repo -> per-skill scores with evidence. Scores from
// code alone are anchored by trials + referrals, never proof on their own (anti-gaming).
function renderProofOfWork(root,profile){
  const sec=document.createElement('section');sec.className='proof-of-work';
  const h=document.createElement('h3');h.textContent='Proof of work · GitHub';
  const sub=document.createElement('p');sub.className='pow-sub';sub.textContent='Link a public repo. Covenda reads the code and commit history and scores the skills it actually demonstrates — per skill, with the evidence behind each. Code alone is anchored by your trials and referrals, never proof on its own.';
  sec.append(h,sub);
  const row=document.createElement('div');row.className='pow-row';
  const input=document.createElement('input');input.type='url';input.className='pow-input';input.placeholder='github.com/you/project';input.setAttribute('aria-label','GitHub repository URL');
  const btn=document.createElement('button');btn.type='button';btn.className='portal-primary compact';btn.textContent='Analyze repo';
  row.append(input,btn);sec.append(row);
  const status=document.createElement('p');status.className='pow-status';status.setAttribute('aria-live','polite');sec.append(status);
  const results=document.createElement('div');results.className='pow-results';sec.append(results);
  const prior=(profile?.skill_signals&&Array.isArray(profile.skill_signals.github))?profile.skill_signals.github:[];
  prior.forEach(a=>results.append(githubAnalysisCard(a)));
  btn.addEventListener('click',async()=>{
    const url=input.value.trim();if(!url){status.textContent='Paste a public GitHub repo URL.';status.classList.add('is-error');return;}
    btn.disabled=true;status.textContent='Reading the repository…';status.classList.remove('is-error');
    try{
      const {analysis}=await portalRequest({method:'POST',body:JSON.stringify({action:'analyze-github',repoUrl:url})});
      status.textContent=analysis.persisted?'Added to your profile.':'Analyzed. Run the skill_signals migration to keep it on your profile.';
      const card=githubAnalysisCard({repo:analysis.repo.name,url:analysis.repo.url,skills:analysis.skills,flags:analysis.flags,needsReview:analysis.needsReview});
      const dup=[...results.children].find(c=>c.dataset.repo===analysis.repo.name);if(dup)dup.remove();
      results.prepend(card);input.value='';
    }catch(e){status.textContent=(e&&e.message)||'Could not analyze that repo.';status.classList.add('is-error');}
    finally{btn.disabled=false;}
  });
  root.append(sec);
}
function githubAnalysisCard(a){
  const card=document.createElement('article');card.className='pow-card';card.dataset.repo=a.repo||'';
  const top=document.createElement('div');top.className='pow-card-top';
  const name=document.createElement('h4');if(a.url){const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener';link.textContent=a.repo;name.append(link);}else name.textContent=a.repo||'repository';
  top.append(name);if(a.needsReview)top.append(pill('Needs review','status-pill','revise'));card.append(top);
  (a.flags||[]).forEach(f=>{const p=document.createElement('p');p.className='pow-flag';p.textContent=f;card.append(p);});
  const grid=document.createElement('div');grid.className='pow-skill-grid';
  (a.skills||[]).forEach(s=>{
    const sk=document.createElement('div');sk.className='pow-skill';
    const line=document.createElement('div');line.className='pow-skill-line';
    const nm=document.createElement('strong');nm.textContent=s.skill;
    const sc=document.createElement('span');sc.className='pow-score';sc.textContent=`${Number(s.score).toFixed(1)}/10`;
    line.append(nm,sc);sk.append(line);
    const conf=document.createElement('span');conf.className='pow-conf';conf.dataset.conf=s.confidence||'low';conf.textContent=`${s.confidence||'low'} confidence · from ${s.source||'github'}`;sk.append(conf);
    const ev=document.createElement('p');ev.className='pow-evidence';ev.textContent=s.evidence||'';sk.append(ev);
    grid.append(sk);
  });
  if(!(a.skills||[]).length){const none=document.createElement('p');none.className='pow-evidence';none.textContent='No scored skills — the repo may be empty, tiny, or unreadable.';card.append(none);}
  card.append(grid);return card;
}

function updateProfileFields(){const role=$('[name="role"]:checked',$('#profileForm'))?.value||state.dashboard?.profile?.role||'student';$$('[data-profile-field="organization"]').forEach(el=>el.hidden=role==='student');$$('[data-profile-field="school"],[data-profile-field="graduation"],[data-student-profile]').forEach(el=>el.hidden=role!=='student');}
function openProfile({required=false}={}){const form=$('#profileForm');const p=state.dashboard?.profile;form.reset();if(p){form.elements.role.value=p.role;form.elements.displayName.value=p.display_name||'';form.elements.organizationName.value=p.organization_name||'';form.elements.schoolName.value=p.school_name||'';form.elements.graduationYear.value=p.graduation_year||'';form.elements.headline.value=p.headline||'';form.elements.bio.value=p.bio||'';form.elements.skills.value=(p.skills||[]).join(', ');form.elements.portfolioVisibility.checked=p.portfolio_visibility!=='private';if(form.elements.emailNotifications)form.elements.emailNotifications.checked=p.email_opt_out!==true;if(form.elements.spotlightConsent)form.elements.spotlightConsent.checked=p.spotlight_consent===true;
  const appealBtn=document.getElementById('appealSubmitBtn');
  if(appealBtn&&!appealBtn.dataset.wired){appealBtn.dataset.wired='1';appealBtn.addEventListener('click',async()=>{
    const subject=form.elements.appealSubject?form.elements.appealSubject.value.trim():'';
    const evidence=form.elements.appealEvidence?form.elements.appealEvidence.value.trim():'';
    const status=document.getElementById('appealStatus');
    appealBtn.disabled=true;if(status)status.textContent='Submitting…';
    try{
      await portalRequest({method:'PATCH',body:JSON.stringify({action:'appeal-score',subject,evidence})});
      if(status)status.textContent='Appeal filed — an operator will review it and write a resolution.';
      if(form.elements.appealSubject)form.elements.appealSubject.value='';
      if(form.elements.appealEvidence)form.elements.appealEvidence.value='';
    }catch(error){if(status)status.textContent=error.message;}
    appealBtn.disabled=false;
  });}$$('[name="role"]',form).forEach(input=>input.disabled=true);}else{$$('[name="role"]',form).forEach(input=>input.disabled=false);const inferred=state.dashboard?.user?.metadata?.full_name||state.dashboard?.user?.metadata?.name||'';form.elements.displayName.value=inferred;}form.dataset.required=required?'true':'false';$$('[data-close-dialog]',form).forEach(button=>button.hidden=required);updateProfileFields();setDialogMessage('#profileMessage','');$('#profileDialog').showModal();}
function openProject(){setDialogMessage('#projectMessage','');$('#projectForm').reset();$('#projectDialog').showModal();}
// A "Create Project" click on the marketing site stashes the typed brief and routes here. Once
// the visitor is signed in as a COMPANY, open the project intake pre-filled with that brief.
// If they aren't a company yet (new signup picking a role, or a student account), we keep the
// brief so it opens the moment they have a company account — the "make a company account" step.
function consumeProjectSeed(){
  let seed=''; try{ seed=localStorage.getItem('covendaProjectSeed')||''; }catch(_){ seed=''; }
  if(!seed) return;
  const role=state.dashboard?.profile?.role;
  if(role==='company'){
    try{ localStorage.removeItem('covendaProjectSeed'); }catch(_){}
    setView('projects');
    openIntake();
    const ta=$('#intakeForm [name="problem"]'); if(ta){ ta.value=seed; ta.dispatchEvent(new Event('input',{bubbles:true})); }
  } else if(role && role!=='company'){
    // Signed in, but not a company — a project needs a company account. Drop the brief quietly.
    try{ localStorage.removeItem('covendaProjectSeed'); }catch(_){}
  }
  // No profile yet (brand-new signup mid-onboarding): keep the brief until a company profile exists.
}
function openApply(project){state.applyProject=project;const form=$('#applyForm');form.reset();form.elements.projectId.value=project.id;$('#applyTitle').textContent=`Apply to ${project.title}.`;$('#applySummary').textContent=project.summary;const ds=project.desired_skills;if(form.elements.skills)form.elements.skills.value=Array.isArray(ds)?ds.join(', '):(ds||'');setDialogMessage('#applyMessage','');$('#applyDialog').showModal();}
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
// Downscale an image in-browser before upload. This is the fix for "upload failed" on big
// photos: it keeps the request body well under Vercel's ~4.5 MB serverless cap and
// normalizes odd formats (e.g. HEIC on Safari) to WebP. Animated GIFs are left untouched so
// they don't flatten to a single frame; anything the browser can't decode passes through
// unchanged (the server then validates it).
async function downscaleImage(file,maxDim=512,type='image/webp',quality=0.85){
  if(!/^image\//.test(file.type||'')||file.type==='image/gif')return file;
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(bitmap,0,0,w,h);bitmap.close&&bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    if(!blob)return file;
    const base=(file.name||'image').replace(/\.[^.]+$/,'');
    return new File([blob],`${base}.webp`,{type});
  }catch{return file;}
}
const DIRECT_UPLOAD_LIMIT=4.3*1024*1024; // just under Vercel's serverless request-body cap
async function uploadAvatar(file){
  if(!/^image\//.test(file.type||''))throw new Error('Choose an image file (PNG, JPEG, WebP, or GIF).');
  const prepared=await downscaleImage(file,512,'image/webp',0.9);
  if(prepared.size>DIRECT_UPLOAD_LIMIT)throw new Error('That image is too large to process here. Try a JPEG or PNG under 4 MB.');
  const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':prepared.type,'x-file-name':encodeURIComponent(prepared.name),'x-upload-kind':'avatar'},body:prepared});
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
  const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.hidden=true;
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
function openIntake(){intakeState={step:1,attachments:[],brief:null,verticals:[],workTypes:[],consultBooked:false,editedSummary:'',targeting:'public'};const form=$('#intakeForm');form.reset();$('#intakeChips').replaceChildren();const brief=$('#intakeBrief');brief.replaceChildren();brief.hidden=true;$('#intakeConsultCard').classList.remove('is-booked');setDialogMessage('#intakeMessage','');setDialogMessage('#intakeStepMessage','');
  // Show the AI-brief credit cost up front when metering is enabled for this deployment.
  const costHint=$('#intakeBriefCost');const d=state.dashboard;if(costHint){if(d?.briefMeteringEnabled&&d?.briefFee>0){costHint.textContent=`Generating a brief costs ${d.briefFee} credits.`;costHint.hidden=false;}else{costHint.hidden=true;}}
  renderIntakeStep();$('#intakeDialog').showModal();}
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
function addIntakeChip(name,status){const chip=document.createElement('div');chip.className='intake-chip';const b=document.createElement('strong');b.textContent=name;const s=document.createElement('small');s.textContent=status;s.setAttribute('aria-live','polite');chip.append(b,s);$('#intakeChips').append(chip);return chip;}
async function uploadIntakeFile(file){
  // Images are downscaled (bigger max than avatars so they stay legible for the AI brief);
  // other files (PDF/doc) can't be shrunk here, so we surface a clear over-limit message
  // rather than letting Vercel's ~4.5 MB request cap fail the upload cryptically.
  const prepared=/^image\//.test(file.type||'')?await downscaleImage(file,1600,'image/webp',0.85):file;
  if(prepared.size>DIRECT_UPLOAD_LIMIT){setDialogMessage('#intakeStepMessage',`${file.name} is too large to upload directly (over ~4 MB). Compress it or share a link instead.`,true);return;}
  const chip=addIntakeChip(prepared.name,'Uploading…');
  try{const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':prepared.type||'application/octet-stream','x-file-name':encodeURIComponent(prepared.name)},body:prepared});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Upload failed.');intakeState.attachments.push(data);$('small',chip).textContent='Attached';}catch(error){$('small',chip).textContent=error.message;chip.classList.add('is-error');}
}
// Auto-grow a textarea to fit its content so the summary is never clipped in a fixed box.
function autoGrow(ta){ta.style.height='auto';ta.style.height=(ta.scrollHeight+2)+'px';}
function briefSection(title){const s=document.createElement('section');s.className='brief-section';const h=document.createElement('p');h.className='brief-section-title';h.textContent=title;s.append(h);return s;}
function briefBullets(items){const ul=document.createElement('ul');ul.className='brief-bullets';items.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.append(li);});return ul;}
// Sectioned, document-like brief: one labelled, fully-visible section per field; the summary
// is an auto-growing (never clipped) editable textarea; deliverables are titled cards with
// acceptance criteria; consult notes are a bulleted list, not a run-on.
function renderIntakeBrief(){const brief=intakeState.brief;const root=$('#intakeBrief');root.replaceChildren();root.hidden=false;
  if(brief.safeToPost===false){const warn=document.createElement('div');warn.className='intake-warn';warn.append(icon('p-close'));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent='Outside Covenda’s safe boundary';const ul=document.createElement('ul');(brief.safetyFlags||[]).forEach(f=>{const li=document.createElement('li');li.textContent=f;ul.append(li);});const p=document.createElement('p');p.textContent='Covenda can’t post this as-is. Book the 20-minute consult and we’ll find a safe, useful version.';box.append(strong,ul,p);warn.append(box);root.append(warn);return;}
  const titleInput=$('[name="title"]',$('#intakeForm'));if(titleInput&&!titleInput.value.trim()&&brief.title)titleInput.value=brief.title;
  const head=document.createElement('div');head.className='brief-head';const label=document.createElement('p');label.className='intake-brief-label';label.textContent='AI draft understanding — edit before you post';const reset=document.createElement('button');reset.type='button';reset.className='brief-reset';reset.textContent='Reset to AI draft';head.append(label,reset);root.append(head);
  const sum=briefSection('Summary');const st=document.createElement('textarea');st.className='brief-textarea';st.value=intakeState.editedSummary||brief.summary||'';const grow=()=>autoGrow(st);st.addEventListener('input',()=>{intakeState.editedSummary=st.value;grow();});sum.append(st);root.append(sum);intakeState.editedSummary=st.value;requestAnimationFrame(grow);
  reset.addEventListener('click',()=>{st.value=brief.summary||'';intakeState.editedSummary=st.value;grow();});
  if(brief.context){const s=briefSection('Context');const p=document.createElement('p');p.className='brief-text';p.textContent=brief.context;s.append(p);root.append(s);}
  if(brief.objective){const s=briefSection('Objective');const p=document.createElement('p');p.className='brief-text';p.textContent=brief.objective;s.append(p);root.append(s);}
  if((brief.scopeInclusions||[]).length||(brief.scopeExclusions||[]).length){const s=briefSection('Scope');if(brief.scopeInclusions?.length){const t=document.createElement('p');t.className='brief-subtitle';t.textContent='In scope';s.append(t,briefBullets(brief.scopeInclusions));}if(brief.scopeExclusions?.length){const t=document.createElement('p');t.className='brief-subtitle';t.textContent='Out of scope';s.append(t,briefBullets(brief.scopeExclusions));}root.append(s);}
  if((brief.candidateDeliverables||[]).length){const s=briefSection('Candidate deliverables');brief.candidateDeliverables.forEach(d=>{const card=document.createElement('div');card.className='deliverable-card';const h=document.createElement('strong');h.textContent=d.title||'Deliverable';card.append(h);if(d.description){const p=document.createElement('p');p.textContent=d.description;card.append(p);}if(d.acceptanceCriteria){const ac=document.createElement('p');ac.className='deliverable-ac';const b=document.createElement('span');b.textContent='Done when: ';ac.append(b,document.createTextNode(d.acceptanceCriteria));card.append(ac);}s.append(card);});root.append(s);}
  if((brief.approvedInputs||[]).length){const s=briefSection('Approved inputs');s.append(briefBullets(brief.approvedInputs));root.append(s);}
  if(brief.estimatedEffort){const s=briefSection('Estimated effort');const p=document.createElement('p');p.className='brief-text';p.textContent=brief.estimatedEffort;s.append(p);root.append(s);}
  if((brief.safetyFlags||[]).length){const s=briefSection('Confirm at the consult');s.append(briefBullets(brief.safetyFlags));root.append(s);}
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
  btn.disabled=true;setDialogMessage('#intakeMessage','Posting your project…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'create-project',title,summary,deliverable:(intakeState.brief?.candidateDeliverables||[]).map(d=>d&&d.title?d.title:d).filter(Boolean).join(' · '),desiredSkills:$('[name="skills"]',form).value,targetDate:$('[name="targetDate"]',form).value,visibility:'members',verticals:intakeState.verticals,workTypes:intakeState.workTypes,attachments:intakeState.attachments,aiBrief:intakeState.brief||undefined,problemText:problem,consultBooked:intakeState.consultBooked,creditsListed:cost.listed,targeting:intakeState.targeting})});$('#intakeDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#intakeMessage',error.message,true);}finally{btn.disabled=false;}});

$('#googleLogin').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;setLoginMessage('Opening Google sign-in…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login'})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Google sign-in could not start.');location.assign(result.url);}catch(error){setLoginMessage(error.message,true);button.disabled=false;}});
$('#memberEmailForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('button',event.currentTarget);button.disabled=true;setLoginMessage('Requesting a secure sign-in link…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:event.currentTarget.elements.email.value})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not request a sign-in link.');setLoginMessage(result.message);}catch(error){setLoginMessage(error.message,true);}finally{button.disabled=false;}});

$('#profileForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#profileMessage','Saving your workspace…');const payload={action:'save-profile',role:form.elements.role.value,displayName:form.elements.displayName.value,organizationName:form.elements.organizationName.value,schoolName:form.elements.schoolName.value,graduationYear:form.elements.graduationYear.value,headline:form.elements.headline.value,bio:form.elements.bio.value,skills:form.elements.skills.value,portfolioVisibility:form.elements.portfolioVisibility.checked?'members':'private',emailOptOut:form.elements.emailNotifications?!form.elements.emailNotifications.checked:undefined,spotlightConsent:form.elements.spotlightConsent?form.elements.spotlightConsent.checked:undefined};try{await portalRequest({method:'PATCH',body:JSON.stringify(payload)});$('#profileDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#profileMessage',error.message,true);}finally{button.disabled=false;}});

$('#projectForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#projectMessage','Creating project…');const payload={action:'create-project',title:form.elements.title.value,summary:form.elements.summary.value,deliverable:form.elements.deliverable.value,desiredSkills:form.elements.desiredSkills.value,targetDate:form.elements.targetDate.value,visibility:form.elements.visibility.value,accessStage:form.elements.accessStage?Number(form.elements.accessStage.value):1,engagementRung:form.elements.engagementRung?form.elements.engagementRung.value:'',opportunityType:form.elements.opportunityType?form.elements.opportunityType.value:undefined,experienceRequirement:form.elements.experienceRequirement?form.elements.experienceRequirement.value:undefined,referralRequirement:form.elements.referralRequirement?form.elements.referralRequirement.value:undefined,founderTimeBudgetMinWeek:form.elements.founderTimeBudgetMinWeek&&form.elements.founderTimeBudgetMinWeek.value!==''?Number(form.elements.founderTimeBudgetMinWeek.value):undefined,talentSources:[...form.querySelectorAll('input[name="talentSource"]:checked')].map(el=>el.value)};try{await portalRequest({method:'POST',body:JSON.stringify(payload)});$('#projectDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#projectMessage',error.message,true);}finally{button.disabled=false;}});

$('#applyForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#applyMessage','Sending your interest…');const skills=form.elements.skills.value.split(',').map(s=>s.trim()).filter(Boolean);const referral={name:form.elements.referralName.value.trim(),code:form.elements.referralCode.value.trim()};try{await portalRequest({method:'POST',body:JSON.stringify({action:'apply',projectId:form.elements.projectId.value,note:form.elements.note.value,skills,demonstration:form.elements.demonstration.value.trim(),videoUrl:form.elements.videoUrl.value.trim(),referral})});$('#applyDialog').close();await loadDashboard();setView('activity');}catch(error){setDialogMessage('#applyMessage',error.message,true);}finally{button.disabled=false;}});
$('#batchApplyForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);const e=form.elements;
  if(e.note.value.trim().length<40){setDialogMessage('#batchApplyMessage','Tell us why this cohort fits you — a few sentences at least.',true);e.note.focus();return;}
  if(!e.videoUrl.value.trim()){setDialogMessage('#batchApplyMessage','Add the link to your ~5-minute video answering the prompt above.',true);e.videoUrl.focus();return;}
  button.disabled=true;setDialogMessage('#batchApplyMessage','Submitting your application…');
  const skills=e.skills.value.split(',').map(s=>s.trim()).filter(Boolean);
  try{
    await portalRequest({method:'POST',body:JSON.stringify({action:'apply-batch',batchId:e.batchId.value,note:e.note.value.trim(),experience:e.experience.value.trim(),skills,hoursPerWeek:e.hoursPerWeek.value,startDate:e.startDate.value,workSample1:e.workSample1.value.trim(),workSample2:e.workSample2.value.trim(),videoUrl:e.videoUrl.value.trim(),videoPrompt:currentBatchPrompt,interest:readBatchInterest(form),resumeUrl:batchResumeUrl,referral:{name:e.referralName.value.trim(),code:e.referralCode.value.trim()}})});
    $('#batchApplyDialog').close();await loadDashboard();setView('batches');
  }catch(error){setDialogMessage('#batchApplyMessage',error.message,true);}finally{button.disabled=false;}
});
$('#batchResumeBtn')?.addEventListener('click',()=>$('#batchResumeInput')?.click());
$('#batchResumeInput')?.addEventListener('change',async event=>{
  const file=event.currentTarget.files[0];event.currentTarget.value='';if(!file)return;
  if(file.size>DIRECT_UPLOAD_LIMIT){setDialogMessage('#batchApplyMessage',`${file.name} is too large (over ~4 MB). Compress it or share a link instead.`,true);return;}
  setDialogMessage('#batchApplyMessage',`Uploading ${file.name}…`);renderBatchResumeChip('Uploading…');
  try{
    const res=await fetch('/api/project-upload',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':file.type||'application/octet-stream','x-file-name':encodeURIComponent(file.name)},body:file});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Upload failed.');
    batchResumeUrl=data.blobUrl||'';renderBatchResumeChip(file.name);setDialogMessage('#batchApplyMessage','');
  }catch(error){batchResumeUrl='';renderBatchResumeChip('');setDialogMessage('#batchApplyMessage',error.message,true);}
});

$('#submitWorkForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#submitWorkMessage','Submitting your work…');const notes=form.elements.workNotes.value.trim();const summary=[form.elements.workSummary.value.trim(),notes&&`\n\nNotes for the reviewer: ${notes}`].filter(Boolean).join('');const links=form.elements.workLinks.value.split(/\n/).map(link=>link.trim()).filter(Boolean);try{await portalRequest({method:'POST',body:JSON.stringify({action:'submit-deliverable',projectId:form.elements.projectId.value,deliverable:summary,deliverableLinks:links})});$('#submitWorkDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#submitWorkMessage',error.message,true);}finally{button.disabled=false;}});
$$('#reviewForm [data-decision]').forEach(button=>button.addEventListener('click',async()=>{const form=$('#reviewForm');const decision=button.dataset.decision;const note=form.elements.note.value.trim();if(decision==='revise'&&!note){setDialogMessage('#reviewMessage','Add a note so the student knows what to revise.',true);return;}const buttons=$$('#reviewForm [data-decision]');buttons.forEach(b=>b.disabled=true);setDialogMessage('#reviewMessage',decision==='accept'?'Accepting the deliverable…':'Sending the change request…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'review-deliverable',projectId:form.elements.projectId.value,decision,note})});$('#reviewDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#reviewMessage',error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}));
$('#messageForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);const status=$('#messageFormStatus');
  const bodyText=form.elements.message.value.trim();
  if(!bodyText&&!messageDraftAttachments.length){status.textContent='Write a message or attach a file first.';status.classList.add('is-error');return;}
  button.disabled=true;status.textContent='Sending…';status.classList.remove('is-error');
  try{
    const result=await portalRequest({method:'POST',body:JSON.stringify({action:'send-message',projectId:state.messageProjectId,message:form.elements.message.value,attachments:messageDraftAttachments})});
    state.dashboard.messages.push(result.message);
    form.reset();messageDraftAttachments=[];renderMessageAttachments();$('#messageBody').style.height='auto';
    status.textContent='Sent securely.';renderMessages();$('#messageThread').scrollTop=$('#messageThread').scrollHeight;
  }catch(error){status.textContent=error.message;status.classList.add('is-error');}finally{button.disabled=false;}
});
// Compose upgrades: auto-grow, Enter-to-send (Shift+Enter = newline), and the attach control.
(()=>{
  const ta=$('#messageBody');const form=$('#messageForm');
  if(ta){
    ta.addEventListener('input',()=>autoGrow(ta));
    ta.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  }
  const attachBtn=$('#messageAttachBtn');const fileInput=$('#messageFileInput');
  if(attachBtn&&fileInput){
    attachBtn.addEventListener('click',()=>fileInput.click());
    fileInput.addEventListener('change',async()=>{const chosen=fileInput.files[0];fileInput.value='';if(chosen)await uploadMessageFile(chosen);});
  }
})();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollMessages();});
window.addEventListener('focus',pollMessages);

$$('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>{const dialog=button.closest('dialog');if(dialog.id==='profileDialog'&&$('#profileForm').dataset.required==='true')return;dialog.close();}));
$$('[name="role"]',$('#profileForm')).forEach(input=>input.addEventListener('change',updateProfileFields));
$('#primaryAction').addEventListener('click',event=>{const target=event.currentTarget.dataset.target;if(target==='profile')openProfile({required:!state.dashboard.profile});else if(target==='new-project')openIntake();else setView(target);});
$('#newProject').addEventListener('click',openIntake);$('#editProfile').addEventListener('click',()=>openProfile());
$('#requestWork')?.addEventListener('click',openRequest);
$('#requestForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#requestMessage','Sending your request…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'create-request',requestType:form.elements.requestType.value,subject:form.elements.subject.value,details:form.elements.details.value})});$('#requestDialog').close();await loadDashboard();setView('projects');pulse('#requestList');}catch(error){setDialogMessage('#requestMessage',error.message,true);}finally{button.disabled=false;}});
$('#discoverSearch')?.addEventListener('input',renderDiscover);
['#filterVertical','#filterWorkType','#filterMinCredits','#filterWithin','#filterMatched'].forEach(sel=>$(sel)?.addEventListener('input',renderDiscover));
$('#filterReset')?.addEventListener('click',()=>{const ids=['#discoverSearch','#filterVertical','#filterWorkType','#filterMinCredits','#filterWithin'];ids.forEach(id=>{const el=$(id);if(el)el.value='';});const m=$('#filterMatched');if(m)m.checked=false;renderDiscover();});
$$('#discoverTabs .discover-tab').forEach(tab=>tab.addEventListener('click',()=>{discoverState.tab=tab.dataset.tab;$$('#discoverTabs .discover-tab').forEach(t=>t.classList.toggle('is-active',t===tab));renderDiscover();}));
$('#memberSignout').addEventListener('click',()=>{clearSession();state.dashboard=null;showAuth('Signed out of this browser.');});
$('#mobileMenu').addEventListener('click',()=>$('.member-nav').classList.toggle('is-open'));

const authError=captureAuthRedirect();
checkAuthReadiness();
if(authError)showAuth(authError,true);else if(session().accessToken)loadDashboard();else showAuth();

// ---- Reverse-audit (opt-in): founder's own link -> 3 editable draft opportunities. --------
$('#reverseAuditBtn')?.addEventListener('click',async()=>{
  const url=($('#reverseAuditUrl')?.value||'').trim();
  const status=$('#reverseAuditStatus');const results=$('#reverseAuditResults');const btn=$('#reverseAuditBtn');
  if(!/^https?:\/\/\S+$/i.test(url)){status.textContent='Paste a valid public link first.';status.classList.add('is-error');return;}
  if(!$('#intakeForm [name="aiConsent"]')?.checked){status.textContent='Tick the AI consent box above first — the audit uses AI to read your link.';status.classList.add('is-error');return;}
  btn.disabled=true;status.classList.remove('is-error');status.textContent='Reading your link and drafting…';results.replaceChildren();
  try{
    const res=await fetch('/api/project-intake',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'reverse-audit',linkUrl:url})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Reverse-audit failed.');
    const audit=data.audit||{};
    if(!audit.safeToPropose||!(audit.proposals||[]).length){
      status.textContent=(audit.safetyFlags||[])[0]||'Nothing safely proposable was found at that link.';
      return;
    }
    status.textContent=`${audit.proposals.length} draft${audit.proposals.length===1?'':'s'} — edit anything, then use one to start the intake.`;
    audit.proposals.forEach(p=>{
      const card=document.createElement('article');card.className='ra-card';
      const h=document.createElement('strong');h.textContent=`DRAFT · ${p.title}`;card.append(h);
      const s=document.createElement('p');s.textContent=p.summary;card.append(s);
      const meta=document.createElement('p');meta.className='ra-meta';meta.textContent=[`Deliverable: ${p.deliverable}`,p.estimatedHours?`~${p.estimatedHours} hrs`:'',p.founderTimeMinWeek?`~${p.founderTimeMinWeek} min/week of your time`:''].filter(Boolean).join(' · ');card.append(meta);
      const use=document.createElement('button');use.type='button';use.className='portal-primary compact';use.textContent='Use this draft';
      use.addEventListener('click',()=>{
        const ta=$('#intakeForm [name="problem"]');
        ta.value=`${p.summary}\n\nDeliverable: ${p.deliverable}\nDone when: ${p.acceptanceCriteria}\nOut of scope: ${p.boundary}`;
        ta.dispatchEvent(new Event('input',{bubbles:true}));ta.focus();
        status.textContent='Draft loaded into the description — edit it, then continue to Understand.';
      });
      card.append(use);results.append(card);
    });
  }catch(error){status.textContent=error.message;status.classList.add('is-error');}
  finally{btn.disabled=false;}
});
