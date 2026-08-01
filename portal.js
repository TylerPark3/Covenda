// Theme. Stored per browser rather than per account: it is a property of where someone is
// sitting, not who they are, and syncing it would fight a user who wants dark at night and
// light in a bright office.
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

(function initTheme(){
  const KEY='covenda-theme';
  const apply=t=>{ document.documentElement.dataset.theme=t; };
  const saved=(()=>{ try{ return localStorage.getItem(KEY); }catch{ return null; } })();
  // Respect the OS when nothing has been chosen; a deliberate choice always wins after that.
  apply(saved || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day'));
  document.getElementById('themeToggle')?.addEventListener('click',()=>{
    const next=document.documentElement.dataset.theme==='night'?'day':'night';
    apply(next);
    try{ localStorage.setItem(KEY,next); }catch{ /* private browsing */ }
  });
})();

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
    if(result.googleConfigured===false){button.disabled=true;$('span',button).textContent='Google sign-in setup pending';note.textContent='Email sign-in works. Google needs enabling in Supabase first.';note.hidden=false;}
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

// The failing line, lifted out of the stack and put on screen next to the message. Telling
// someone to open developer tools asks for a step that mostly does not happen; a screenshot of
// the error is what actually arrives. This same crash came back three times carrying no
// location, which cost more than printing twelve characters ever would.
function errorSite(error){
  const frames=String(error&&error.stack||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const hit=frames.find(l=>/portal\.js:\d+/.test(l))||frames[1]||'';
  const at=hit.match(/portal\.js:(\d+):(\d+)/);
  return at?`portal.js:${at[1]}:${at[2]}`:(hit.slice(0,120)||'no stack available');
}

async function loadDashboard() {
  showLoading();
  try {
    const dashboard=await portalRequest(); state.dashboard=dashboard; showMember(); renderDashboard(); startMessagePolling(); consumeProjectSeed();
    if (shouldOnboard(dashboard.profile)) startOnboarding();
    else handleCheckoutReturn();
  } catch(error) {
    if(!session().accessToken) return;
    // Always leave the real fault somewhere a person can read it. An earlier version of this
    // catch replaced the message with friendlier wording and swallowed the only evidence of
    // what actually broke, which made the next failure undiagnosable from the outside — the
    // exact situation this line exists to prevent.
    console.error('[covenda] portal failed to load', error);
    // A crash while rendering is not an authentication failure. Sending a signed-in member to
    // the sign-in screen asks them to fix, by signing in again, the one thing signing in again
    // cannot touch. Saved onboarding progress is the state most likely to be bad and the only
    // part safe to drop, so clear it — but say what actually went wrong alongside, because a
    // reload only helps when the saved progress really was the cause.
    if(error instanceof TypeError||error instanceof RangeError||error instanceof ReferenceError){
      clearOnboard();
      showAuth(`The portal hit an error while loading: ${error.message} — at ${errorSite(error)}. Saved progress was cleared; reload to retry.`,true);
      return;
    }
    showAuth(error.message,true);
  }
}

function profileCompletion(profile) {
  if (!profile) return 0;
  const values=[profile.display_name,profile.headline,profile.bio,profile.skills?.length,profile.role==='student'?profile.school_name:profile.organization_name];
  // The onboarding flow collects a student's verticals/work types, so they count toward 100%.
  if(profile.role==='student')values.push(profile.verticals?.length,profile.work_types?.length);
  return Math.round(values.filter(Boolean).length/values.length*100);
}

function setView(view, opts) {
  const allowed=['overview','projects','activity','discover','batches','portfolio','messages','wallet'];
  // Aliases for the renamed destinations. The labels changed; the view keys did not, so nothing
  // that already calls setView('discover') breaks. 'opportunities' is accepted because the nav
  // now says Opportunities and somebody will reasonably type it.
  const alias={ home:'overview', opportunities:'discover', profile:'portfolio', earnings:'wallet', work:'projects' };
  const wanted=alias[view]||view;
  state.view=allowed.includes(wanted)?wanted:'overview';
  $$('[data-portal-view]').forEach(section=>section.classList.toggle('is-active',section.dataset.portalView===state.view));
  // A hidden button must never carry .is-active. renderDashboard reads the active nav item to
  // decide whether the current view is still available, so a hidden-but-active button reads
  // as "this view is gone" and ejects the member.
  $$('[data-view]').forEach(button=>button.classList.toggle('is-active',
    button.closest('.member-nav')&&!button.hidden&&button.dataset.view===state.view));
  $('#memberBreadcrumb').textContent=`Workspace / ${titleCase(state.view)}`;
  $('.member-nav').classList.remove('is-open');
  // Opening Messages clears the unread indicator and pulls the latest immediately.
  if(state.view==='messages'){state.unreadMessages=0;paintUnread();pollMessages();}
  // Keep the tab strip honest however the panel was reached — nav item, deep link or tab.
  if(state.view==='discover'||state.view==='batches')paintOppTabs(state.view);
  window.scrollTo({top:0,behavior:'smooth'});
  revealify();
  // Deep-link target. Never throws when the selector is absent: a missing focus target should
  // land the student on the right panel, not break the navigation that got them there.
  if(opts&&opts.focus){
    const el=$(opts.focus);
    if(el){
      const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({block:'center',behavior:reduce?'instant':'smooth'});
      if(typeof el.focus==='function')el.focus({preventScroll:true});
    }
  }
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
  // Every nav item declares the roles it is for. Before this only Discover was gated, so a
  // student saw Submissions (an operator inbox) and companies saw views built for students.
  $$('[data-student-only]').forEach(el=>el.hidden=role!=='student');
  $$('nav [data-roles]').forEach(el=>{
    const roles=(el.dataset.roles||'').split(/\s+/).filter(Boolean);
    el.hidden = roles.length ? !roles.includes(role) : false;
  });
  // The same view means different things to different people, so it is named for the reader
  // rather than for the data model.
  // One naming system. The redesign briefly had two: this map, plus a second block below that
  // painted #portfolioNavLabel / #walletNavLabel / #projectsNavLabel directly. Both ran every
  // render and disagreed, and order decided the winner — so a student saw "Explore" and "Chats"
  // from here (no id to overwrite) but "Profile" and "Earnings" from there. Exactly the mistake
  // that produced a duplicate progress ladder earlier on this branch, made twice.
  const NAV_LABELS = {
    student: { projects: 'My work', batches: 'Batches', portfolio: 'Profile', messages: 'Messages', wallet: 'Earnings', discover: 'Opportunities' },
    company: { projects: 'My projects', batches: 'Batches', portfolio: 'Talent', messages: 'Messages', wallet: 'Wallet' },
    university: { projects: 'My projects', messages: 'Messages', wallet: 'Wallet' },
  };
  const labels = NAV_LABELS[role] || {};
  $$('nav [data-view]').forEach(el=>{
    const key = el.dataset.view;
    const span = $('span', el);
    if (span && labels[key]) span.textContent = labels[key];
  });
  // If the current view is no longer available to this role, fall back rather than showing
  // an empty pane.
  // Reachability is not the same as having a nav item. This fallback exists so a role that
  // loses a view does not stare at an empty pane — but the redesign gave students routes to
  // views with no nav button of their own, and inferring reachability from the nav ejected them.
  //
  // A student reaches Batches through the Opportunities tab strip, and Activity through the
  // "Applications" metric on the overview. Both were bounced to Home by the next dashboard
  // reload: open a batch simulation, close it, and you are on Home with no explanation and a
  // stale tab. The ladder's own "Apply to a batch" step is the main route into it, which made
  // the most prominent CTA on the redesigned overview a trap.
  const REACHABLE_WITHOUT_NAV = {
    student: ['batches', 'activity'],
    company: [],
    university: [],
  };
  const reachable = new Set(REACHABLE_WITHOUT_NAV[role] || []);
  const navButton = $(`nav [data-view="${state.view}"]`);
  const strandedView = navButton && navButton.hidden && !reachable.has(state.view);
  if (strandedView) setView('overview');
  $$('[data-org-only]').forEach(el=>el.hidden=!['company','university'].includes(role));
  // Every one of these is optional now. The count badges were removed from the nav, and an
  // unguarded $('#gone').textContent is exactly the null deref that aborted app.js and took the
  // whole homepage down this morning. Optional chaining, not assumption.
  // Messages keeps its badge: unread is the one count a student can act on. Zero reads as
  // clutter, so it hides itself rather than showing a nought.
  const mc=$('#messageCount');
  if(mc){ mc.textContent=messages.length; mc.hidden=!messages.length; }
  // Batches is a tab inside Opportunities for students; only companies get it as a destination.
  const batchesNav=$('#batchesNav'); if(batchesNav)batchesNav.hidden=role!=='company';
  $('#newProject').hidden=!['company','university'].includes(role);
  const now=new Date(); $('#welcomeDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  const first=profile?.display_name?.split(/\s+/)[0]; $('#welcomeTitle').textContent=first?`Good ${dayPart()}, ${first}.`:`Good ${dayPart()}.`;
  // The student line said "Track your current work and find the next project that fits you" —
  // a description of the nav, next to a nav. Dropped so the NEXT card is the first thing with
  // something to say. Other roles keep theirs; their dashboards have no NEXT card.
  const copyEl=$('#welcomeCopy');
  if(copyEl){
    const copy=role==='company'?'Keep projects moving and discover students through real evidence.':role==='university'?'See the projects and opportunities connected to your partner account.':role==='student'?'':'Complete your member profile to open your private workspace.';
    copyEl.textContent=copy; copyEl.hidden=!copy;
  }
  const primary=$('#primaryAction'); $('span',primary).textContent=role==='student'?'Discover projects':role==='company'||role==='university'?'Post a project':'Complete profile';
  primary.dataset.target=role==='student'?'discover':role==='company'||role==='university'?'new-project':'profile';
  renderCompanySegments(role); renderBriefing(); renderFocus(); renderMetrics(); renderPipeline();renderIntroductions();renderTrialStart();renderJourney();renderVerification();renderMilestones(); renderProjects(); renderRequests(); renderActivity(); renderDiscover(); renderBatches(); renderPortfolio(); renderMessages(); renderWallet(); revealify();
}

function dayPart(){const hour=new Date().getHours();return hour<12?'morning':hour<17?'afternoon':'evening';}
// Company home leads with the two jobs it does: delegate stuck work, and find elite talent.

// The company briefing. `companyBriefing()` has answered these four questions since it was
// written and nothing ever asked it. Ordered by who is waiting: what is blocked on this
// company first, because that is the only list where inaction costs somebody else something.
function renderBriefing(){
  const host=$('#briefingPanel');
  if(!host)return;
  const d=state.dashboard;
  const b=d&&d.briefing;
  if(d?.profile?.role!=='company'||!b){host.hidden=true;host.replaceChildren();return;}
  host.replaceChildren();

  if(b.emptyReason){
    // An empty dashboard full of zeros reads as failure. Say what is actually true instead.
    const empty=document.createElement('p');empty.className='brf-empty';empty.textContent=b.emptyReason;
    host.append(empty);host.hidden=false;return;
  }

  const wait=n=>!Number.isFinite(n)?'':n<=0?'today':n===1?'1 day':`${n} days`;

  if((b.blocking||[]).length){
    const sec=document.createElement('section');sec.className='brf-block is-urgent';
    const h=document.createElement('h3');h.textContent='Waiting on you';
    sec.append(h);
    const list=document.createElement('ul');list.className='brf-list';
    b.blocking.forEach(item=>{
      const li=document.createElement('li');
      const main=document.createElement('div');
      const t=document.createElement('strong');
      t.textContent=item.title||(item.kind==='applications'?'New applications':'Needs your attention');
      const note=document.createElement('span');note.textContent=item.note||'';
      main.append(t,note);
      li.append(main);
      const days=wait(item.waitingDays);
      if(days){const d2=document.createElement('em');d2.className='brf-wait';d2.textContent=days;li.append(d2);}
      if(item.projectId){
        const go=document.createElement('button');go.type='button';go.className='brf-go';
        go.textContent='Open';
        go.addEventListener('click',()=>{setView('projects');});
        li.append(go);
      }
      list.append(li);
    });
    sec.append(list);host.append(sec);
  }

  if((b.running||[]).length){
    const sec=document.createElement('section');sec.className='brf-block';
    const h=document.createElement('h3');h.textContent='Running without you';
    sec.append(h);
    const list=document.createElement('ul');list.className='brf-list';
    b.running.forEach(r=>{
      const li=document.createElement('li');
      const main=document.createElement('div');
      const t=document.createElement('strong');t.textContent=r.title;
      const note=document.createElement('span');note.textContent=r.note||'';
      main.append(t,note);li.append(main);
      const days=wait(r.startedDays);
      if(days){const d2=document.createElement('em');d2.className='brf-wait';d2.textContent=days;li.append(d2);}
      list.append(li);
    });
    sec.append(list);host.append(sec);
  }

  const m=b.money||{};
  const money=document.createElement('section');money.className='brf-block brf-money';
  const mh=document.createElement('h3');mh.textContent='What it has cost';
  money.append(mh);
  const grid=document.createElement('div');grid.className='brf-figures';
  // Held before released: a founder wants to know what is committed, not only what is gone.
  [['Held in escrow',m.heldInEscrow],['Released on completed work',m.releasedOnCompletedWork],['Projects completed',m.completedProjects]]
    .forEach(([label,value])=>{
      const cell=document.createElement('div');
      const n=document.createElement('strong');n.textContent=String(Number(value)||0);
      const l=document.createElement('span');l.textContent=label;
      cell.append(n,l);grid.append(cell);
    });
  money.append(grid);host.append(money);

  const learned=document.createElement('section');learned.className='brf-block';
  const lh=document.createElement('h3');lh.textContent='What we learned';
  learned.append(lh);
  if(b.learned){
    const p=document.createElement('p');p.className='brf-learned';
    const l=b.learned;
    p.textContent=`${l.answered} ${l.answered===1?'survey':'surveys'} answered · ${l.wouldUseAgain} would use Covenda again`
      +(Number.isFinite(l.avgShortlistRelevance)?` · shortlist relevance ${l.avgShortlistRelevance}/5`:'');
    learned.append(p);
  }else{
    // No outcomes yet, and saying so beats rendering zeros that look like a bad result.
    const p=document.createElement('p');p.className='brf-empty';
    p.textContent='Nothing yet. This fills in after your first completed trial.';
    learned.append(p);
  }
  host.append(learned);
  host.hidden=false;
}

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
    seg('p-clock','Work that keeps getting pushed back','That task that slips every week, hand it off as a scoped, reviewed project. Covenda carries the scoping; you only approve the result.',[['Post a project',()=>openIntake(),true],['Ask Covenda to scope it',()=>openRequest()]]),
    seg('p-spark','Find elite talent','Vetted, referral-backed students. Search the talent base, or browse curated elite batches.',[['Browse talent',()=>setView('portfolio'),true],['Elite batches',()=>setView('batches')]]),
  );
  root.hidden=false;
}

function renderFocus(){
  // A proposed trial waiting on the founder outranks everything else on this page.

  const root=$('#focusProject');root.replaceChildren();const role=state.dashboard.profile?.role;
  const project=state.dashboard.projects.find(item=>!['complete','archived'].includes(item.status))||state.dashboard.projects[0];
  $('#focusTitle').textContent=role==='student'?'Your project tracker':'Project operations';
  if(role==='student')root.append(rungBadge());
  if(!project){
    const empty=document.createElement('div');empty.className='empty-line work-empty';
    const h=document.createElement('h3');h.textContent=role==='student'?'No assigned project yet.':'No project posted yet.';
    const p=document.createElement('p');
    p.textContent=role==='student'
      ?'Two things move this forward: browsing work that is open now, and finishing the profile a founder reads before they shortlist you.'
      :'Create a private draft first, then make it visible when the scope is ready.';
    empty.append(h,p);
    const actions=document.createElement('div');actions.className='work-empty-actions';
    const button=document.createElement('button');button.type='button';button.className='portal-primary';
    button.textContent=role==='student'?'Browse open work':'Start a project';
    button.addEventListener('click',()=>role==='student'?setView('discover'):openIntake());
    actions.append(button);
    // Second exit, and only when it is true: no dead end, but no invented task either. If setup
    // is finished this stays a single-CTA empty state rather than inventing something to nag about.
    if(role==='student'){
      // studentJourney is the single model of "what is left" — the same one the journey panel
      // renders. A second definition here is how a dashboard ends up disagreeing with itself.
      const steps=asList(studentJourney(state.dashboard));
      const next=steps.find(x=>!x.done);
      if(next){
        const second=document.createElement('button');second.type='button';second.className='portal-secondary';
        second.textContent=`${next.title} (${steps.filter(x=>x.done).length} of ${steps.length} done)`;
        second.addEventListener('click',next.go);
        actions.append(second);
      }
    }
    empty.append(actions);root.append(empty);return;
  }
  if(role==='company'){
    renderBriefReview(root,project);
    // Describing the person shapes what the trial tests, so it sits with the brief.
    const ideal=document.createElement('button');ideal.type='button';ideal.className='ideal-link';
    ideal.textContent=project.ideal_memo?'Edit who you need':'Describe who you need →';
    ideal.addEventListener('click',()=>openIdealIntern(project));
    root.append(ideal);
  }
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
  status.textContent=project.conversion_recorded_at?`Saved · ${dateLabel(project.conversion_recorded_at)}`:'Helps us place students like this. Never shared publicly.';
  // Ask what they learned once, right where they are already reflecting on the outcome.
  if(!project.outcome_survey_at&&(state.dashboard?.outcomeQuestions||[]).length){
    const more=document.createElement('button');more.type='button';more.className='conversion-survey';
    more.textContent='Tell us how it went →';
    more.addEventListener('click',()=>openOutcomeSurvey(project));
    wrap.append(more);
  }
  select.addEventListener('change',async()=>{
    select.disabled=true;status.textContent='Saving…';
    try{await portalRequest({method:'POST',body:JSON.stringify({action:'record-conversion',projectId:project.id,outcome:select.value})});
      project.conversion_outcome=select.value;status.textContent='Saved. Thank you, this shapes who we route to you next.';}
    catch(error){status.textContent=error.message;}
    finally{select.disabled=false;}
  });
  wrap.append(label,status);return wrap;
}
function loopNote(iconId,title,copy){const d=document.createElement('div');d.className='loop-note';d.append(icon(iconId));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=copy;box.append(strong,small);d.append(box);return d;}
function verifiedCard(project,{full=false}={}){const card=document.createElement('div');card.className='verified-record';const head=document.createElement('div');head.className='verified-head';head.append(icon('p-check'));const badge=document.createElement('span');badge.textContent='Verified work record';head.append(badge);const h=document.createElement('h3');h.textContent=project.title;card.append(head,h);if(full&&project.summary){const s=document.createElement('p');s.className='verified-summary';s.textContent=project.summary;card.append(s);}const p=document.createElement('p');p.textContent=`Reviewer accepted${project.completed_at?` · ${dateLabel(project.completed_at)}`:''}`;card.append(p);const earned=document.createElement('p');earned.className='verified-earned';earned.textContent='Stage 1 cleared, eligible for deeper, higher-access work.';card.append(earned);return card;}
function projectActionNode(project){
  const d=state.dashboard;const role=d.profile?.role;const isOwner=project.owner_user_id===d.user.id;const isAssigned=project.assigned_student_user_id===d.user.id;
  const wrap=document.createElement('div');wrap.className='project-actions';
  if(role==='student'&&isAssigned&&project.status==='in_progress'){if(project.review_note){const note=document.createElement('p');note.className='revise-note';note.append(icon('p-clock'));const s=document.createElement('span');s.textContent=`Changes requested: ${project.review_note}`;note.append(s);wrap.append(note);}wrap.append(actionButton(project.review_note?'Resubmit your work':'Submit your work','p-arrow',()=>openSubmitWork(project)));return wrap;}
  if(isAssigned&&project.status==='review'){wrap.append(loopNote('p-clock','In review','Your work is with the reviewer. The decision will appear here.'));return wrap;}
  if(isAssigned&&project.status==='complete'){wrap.append(verifiedCard(project));return wrap;}
  if(isOwner&&project.status==='review'){wrap.append(loopNote('p-inbox','Deliverable submitted','A student submitted work for your review.'));wrap.append(actionButton('Review deliverable','p-check',()=>openReview(project)));return wrap;}
  if(isOwner&&project.status==='complete'){wrap.append(loopNote('p-check','Accepted','You accepted this work, the student now holds a verified record, and the escrow has been released.'));wrap.append(conversionControl(project));return wrap;}
  // Cancelling is money-moving and irreversible, so it arms on the first click and only
  // sends on the second.
  if(isOwner&&!['complete','archived'].includes(project.status)){
    wrap.append(endProjectControl(project));
    return wrap;
  }
  return null;
}
// Ending a live project. Which server action applies depends on what the project is carrying,
// and a company should not have to know that: a bare draft is deleted, anything else is ended
// and its escrow refunded. The label states the consequence rather than naming the verb.
function endProjectControl(project){
  const held=(Number(project.credits_held)||0)+(Number(project.platform_fee_credits)||0);
  const applicants=(state.dashboard.applications||[]).filter(a=>a.project_id===project.id).length;
  const assigned=Boolean(project.assigned_student_user_id);
  const deletable=project.status==='draft'&&held===0&&!applicants;
  if(deletable)return deleteDraftButton(project);

  const label=held>0?`End project · refund ${held.toLocaleString()} credits`:'End project';
  // Says what actually happens to the other people involved. A student mid-work finding out
  // by the project vanishing is the failure this wording exists to prevent.
  const confirm=assigned
    ? 'Click again — this ends the work a student has started'
    : applicants
      ? `Click again — ${applicants} applicant${applicants===1?'':'s'} will be closed out`
      : 'Click again to end it';
  return armedButton({
    label, confirm, busy:'Ending…',
    run:()=>portalRequest({method:'POST',body:JSON.stringify({action:'cancel-project',projectId:project.id})}),
  });
}
// Two-step confirm for anything irreversible. Extracted because cancel, delete and end all had
// their own copy of this and they had already drifted apart — the withdraw copy, for one, had
// quietly stopped setting is-armed. Every arming control routes through here now, so there is a
// single place a confirmation can be got wrong.
function armedButton({label,confirm,busy,run,className='portal-ghost cancel-project',view='projects'}){
  const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;
  let armed=false,timer=0;
  b.addEventListener('click',async()=>{
    if(!armed){armed=true;b.textContent=confirm;b.classList.add('is-armed');timer=window.setTimeout(()=>{armed=false;b.textContent=label;b.classList.remove('is-armed');},5000);return;}
    window.clearTimeout(timer);b.disabled=true;b.textContent=busy;
    try{await run();await loadDashboard();setView(view);}
    catch(error){b.textContent=error.message;b.disabled=false;armed=false;b.classList.remove('is-armed');}
  });
  return b;
}
// Deleting a draft is safe (no escrow, no applicants) but still irreversible, so it arms first.
function deleteDraftButton(project){
  return armedButton({
    label:'Delete draft', confirm:'Click again to delete', busy:'Deleting…',
    run:()=>portalRequest({method:'POST',body:JSON.stringify({action:'delete-project',projectId:project.id})}),
  });
}
// A student withdraws (removes) an application they haven't been accepted into; arms once.
function withdrawApplicationButton(application){
  return armedButton({
    label:'Withdraw', confirm:'Click to confirm', busy:'Withdrawing…', className:'row-action', view:'activity',
    run:()=>portalRequest({method:'POST',body:JSON.stringify({action:'withdraw-application',applicationId:application.id})}),
  });
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
  if(application.fit_score!=null)head.append(fitTier(application.fit_score,application.fit&&application.fit.presentation));
  if(application.fit)card.append(fitWhyBlock({reasons:application.fit.reasons,concerns:application.fit.concerns,approach:application.fit.recommendedApproach}));
  card.append(head);
  const meta=document.createElement('div');meta.className='activity-meta';meta.append(pill(applicationStatusLabels[application.status]||titleCase(application.status),'status-pill',application.status));if(project)meta.append(pill(project.title,'status-pill'));card.append(meta);
  if(application.fit_score!=null){
    card.append(scoreBreakdown({
      score:application.fit_score, precise:application.fit_precise, comparedOn:application.fit_compared_on,
      reasons:application.fit_reasons||[], concerns:application.fit_concerns||[],
    }));
  }
  if((application.skills||[]).length){const ask=new Set((Array.isArray(project?.desired_skills)?project.desired_skills:String(project?.desired_skills||'').split(',')).map(s=>String(s).toLowerCase().trim()).filter(Boolean));const sk=document.createElement('div');sk.className='applicant-skills';application.skills.forEach(s=>sk.append(pill(s,ask.has(String(s).toLowerCase().trim())?'skill-pill is-matched':'skill-pill')));card.append(sk);}
  if(application.note){const n=document.createElement('p');n.className='applicant-note';n.textContent=application.note;card.append(n);}
  const ref=application.referral||{};if(ref.name||ref.code){const rr=document.createElement('p');rr.className='applicant-referral'+(ref.verified?' is-verified':'');const who=ref.verified?(ref.partner||ref.name):(ref.name||', ');rr.textContent=ref.verified?`Endorsed by ${who} · Covenda-certified`:`Referred by ${who}${ref.code?` (${ref.code})`:''} · referral pending`;card.append(rr);}
  const links=document.createElement('div');links.className='applicant-links';
  if(application.demonstration){if(/^https?:\/\//i.test(application.demonstration)){const dl=document.createElement('a');dl.href=application.demonstration;dl.target='_blank';dl.rel='noopener';dl.textContent='View work sample';links.append(dl);}else{const p=document.createElement('p');p.className='applicant-note';p.textContent=application.demonstration;card.append(p);}}
  if(application.video_url){const vl=document.createElement('a');vl.href=application.video_url;vl.target='_blank';vl.rel='noopener';vl.textContent='Watch intro video';links.append(bindDownload(vl,application.video_url));}
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
    // Tyler, 26 July: a company dashboard should say who is working, what is live, and what
    // is waiting on them. "Posted projects" answered none of those — it counted drafts and
    // finished work together and pointed at nothing to act on.
    :(()=>{
      const projects=d.projects||[];
      const live=projects.filter(p=>['open','matched','in_progress','review'].includes(p.status));
      const working=projects.filter(p=>['matched','in_progress','review'].includes(p.status)&&p.assigned_student_user_id);
      const awaiting=projects.filter(p=>p.status==='review');
      const newApps=(d.applications||[]).filter(a=>a.status==='submitted');
      return [
        [working.length,'Students working now','projects','#projectList'],
        [live.length,'Live projects','projects','#projectList'],
        [newApps.length,'Applications to review','activity','#applicationList'],
        [awaiting.length,'Deliverables awaiting you','projects','#projectList'],
      ];
    })();
  for(const [value,label,target,highlight] of values){
    const item=document.createElement('button');item.type='button';item.className='metric';item.setAttribute('aria-label',`${value} ${label}, open`);
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

// ---- Student: verification standing and live milestones -----------------------------
// Both are computed server-side and were invisible in the portal — a student had no way to
// see how verified they were, or where their current work stood against its schedule.

// ── Verification steps ────────────────────────────────────────────────────────────────
// Each row of the verification panel opens the thing that actually satisfies it. School email
// sends a code; a club claim files against a real organisation and waits for an officer; a
// referral is a request you send to a human, so all we can do is write it for you.
const VERIF_STEPS={
  school_email:{ cta:'Verify', title:'Verify your school email' },
  club:{ cta:'Claim', title:'Claim your club membership' },
  referral:{ cta:'Request', title:'Ask for a named referral' },
};

function verifDialog(title,intro){
  const dlg=document.createElement('dialog'); dlg.className='verif-dialog';
  const shell=document.createElement('form'); shell.method='dialog'; shell.className='verif-form';
  // Pressing Enter in any input implicitly submits, and a method="dialog" form submitting
  // CLOSES the dialog — so typing an email and hitting Enter silently dismissed the whole
  // thing without ever calling the API. Enter now runs the primary action instead, which is
  // what someone pressing it is asking for anyway.
  shell.addEventListener('submit',event=>{
    event.preventDefault();
    const primary=shell.querySelector('footer .portal-primary:not([disabled])');
    if(primary)primary.click();
  });
  const head=document.createElement('header');
  const box=document.createElement('div');
  const eyebrow=document.createElement('p'); eyebrow.className='eyebrow'; eyebrow.textContent='Verification';
  const h=document.createElement('h2'); h.textContent=title;
  box.append(eyebrow,h);
  const close=document.createElement('button'); close.type='button'; close.setAttribute('aria-label','Close'); close.append(icon('p-close'));
  close.addEventListener('click',()=>{dlg.close();dlg.remove();});
  head.append(box,close);
  const body=document.createElement('div'); body.className='dialog-body';
  if(intro){const p=document.createElement('p'); p.className='verif-intro'; p.textContent=intro; body.append(p);}
  const msg=document.createElement('p'); msg.className='dialog-message'; msg.setAttribute('aria-live','polite');
  const foot=document.createElement('footer');
  shell.append(head,body,msg,foot);
  dlg.append(shell);
  dlg.addEventListener('cancel',()=>{dlg.close();dlg.remove();});
  document.body.append(dlg);
  const say=(text,bad)=>{msg.textContent=text||''; msg.classList.toggle('is-error',Boolean(bad));};
  return { dlg, body, foot, say, open:()=>dlg.showModal(), close:()=>{dlg.close();dlg.remove();} };
}
function verifField(labelText,hintText,attrs={}){
  const label=document.createElement('label');
  const span=document.createElement('span'); span.textContent=labelText;
  if(hintText){const small=document.createElement('small'); small.textContent=hintText; span.append(' ',small);}
  const input=document.createElement('input');
  Object.entries(attrs).forEach(([k,v])=>{input[k]=v;});
  label.append(span,input);
  return { label, input };
}

function openVerificationStep(key){
  if(key==='school_email')return openSchoolEmailStep();
  if(key==='club')return openClubStep();
  return openReferralStep();
}

function openSchoolEmailStep(){
  const held=Boolean(asList(state.dashboard?.verification?.signals).find(s=>s.key==='school_email')?.held);
  const d=verifDialog('Verify your school email',
    held?'This is already confirmed. Verifying a different address replaces the one on file.'
        :'We send a six-digit code to your university address. This proves you control the address, it is the floor, not the proof.');
  const email=verifField('School email','ends in .edu, .ac.uk, or your university’s domain',{type:'email',required:true,placeholder:'you@university.edu',autocomplete:'email'});
  d.body.append(email.label);

  const send=document.createElement('button'); send.type='button'; send.className='portal-primary'; send.textContent='Send me a code';
  d.foot.append(send);
  send.addEventListener('click',async()=>{
    const value=email.input.value.trim();
    if(!value){d.say('Enter your school email.',true); email.input.focus(); return;}
    send.disabled=true; d.say('Sending…');
    try{
      await portalRequest({method:'POST',body:JSON.stringify({action:'verify-school-email',schoolEmail:value})});
      d.say('Code sent. It expires in 20 minutes.');
      email.input.disabled=true; send.remove();
      const code=verifField('Six-digit code','from the email we just sent',{type:'text',inputMode:'numeric',maxLength:6,placeholder:'000000',autocomplete:'one-time-code'});
      d.body.append(code.label); code.input.focus();
      const confirm=document.createElement('button'); confirm.type='button'; confirm.className='portal-primary'; confirm.textContent='Confirm';
      d.foot.append(confirm);
      confirm.addEventListener('click',async()=>{
        const entered=code.input.value.trim();
        if(entered.length<6){d.say('Enter all six digits.',true); return;}
        confirm.disabled=true; d.say('Checking…');
        try{
          await portalRequest({method:'POST',body:JSON.stringify({action:'confirm-school-email',code:entered})});
          d.say('Verified.');
          await loadDashboard();
          setTimeout(()=>d.close(),700);
        }catch(error){ confirm.disabled=false; d.say(error.message,true); }
      });
    }catch(error){
      send.disabled=false; d.say(error.message,true);
      if(/not switched on yet/i.test(error.message||'')&&!d.foot.querySelector('.verif-alt')){
        const alt=document.createElement('button'); alt.type='button'; alt.className='portal-secondary verif-alt';
        alt.textContent='Claim a club instead';
        alt.addEventListener('click',()=>{ d.close(); openClubStep(); });
        d.foot.prepend(alt);
      }
    }
  });
  d.open(); email.input.focus();
}

function openClubStep(){
  const d=verifDialog('Claim your club membership',
    'Name the club you are a member of. An officer confirms it before it counts, a claim on its own proves nothing, and companies only ever see confirmed memberships.');
  const name=verifField('Club name','e.g. Columbia Robotics Club',{type:'text',required:true,placeholder:'Columbia Robotics Club'});
  const school=verifField('School',null,{type:'text',placeholder:'Columbia University'});
  const site=verifField('Club website','optional if you add Instagram',{type:'url',placeholder:'https://…'});
  const social=verifField('Club Instagram','optional if you add a website',{type:'url',placeholder:'https://instagram.com/…'});
  const officer=verifField('Officer email','who can confirm you, president, captain, or faculty advisor',{type:'email',placeholder:'president@club.org'});
  const role=verifField('Your role in the club','optional',{type:'text',placeholder:'Member, project lead, treasurer'});
  d.body.append(name.label,school.label,site.label,social.label,officer.label,role.label);

  const submit=document.createElement('button'); submit.type='button'; submit.className='portal-primary'; submit.textContent='File my claim';
  d.foot.append(submit);
  submit.addEventListener('click',async()=>{
    if(name.input.value.trim().length<2){d.say('Enter the club name.',true); name.input.focus(); return;}
    // One of the two is required — a club nobody can look up is a club nobody can confirm.
    if(!site.input.value.trim()&&!social.input.value.trim()){
      d.say('Add the club’s website or Instagram. We need somewhere to check it is real.',true); site.input.focus(); return;
    }
    submit.disabled=true; d.say('Filing…');
    try{
      // Registering first means a club nobody has entered yet still gets a record to claim
      // against; a repeat registration updates rather than forks it.
      const reg=await portalRequest({method:'POST',body:JSON.stringify({action:'register-club',clubName:name.input.value.trim(),school:school.input.value.trim(),websiteUrl:site.input.value.trim(),socialUrl:social.input.value.trim(),email:officer.input.value.trim(),role:role.input.value.trim()})});
      await portalRequest({method:'POST',body:JSON.stringify({action:'claim-club',clubId:reg.club.id})});
      // The claim alone counts for nothing, so hand them the thing that makes it count.
      d.say('Filed. Now get it confirmed, that is what makes it count.');
      await loadDashboard();
      d.body.replaceChildren();
      const done=document.createElement('p');done.className='verif-intro';
      done.textContent='Send to a club officer. Thirty seconds, no account.';
      d.body.append(done);
      d.foot.replaceChildren();
      try{
        const out=await portalRequest({method:'POST',body:JSON.stringify({action:'club-confirmation-link',clubId:reg.club.id})});
        const url=location.origin+'/confirm.html?token='+encodeURIComponent(out.token);
        const box=document.createElement('input');box.className='verif-link';box.readOnly=true;box.value=url;
        box.addEventListener('focus',()=>box.select());
        d.body.append(box);
        const copy=document.createElement('button');copy.type='button';copy.className='portal-primary';copy.textContent='Copy the link';
        copy.addEventListener('click',async()=>{
          try{ await navigator.clipboard.writeText(url); copy.textContent='Copied'; }
          catch{ box.select(); d.say('Select-all and copy, your browser blocked the clipboard.',true); }
        });
        const mail=document.createElement('button');mail.type='button';mail.className='portal-secondary';mail.textContent='Open in email';
        mail.addEventListener('click',()=>{
          window.location.href='mailto:?subject='+encodeURIComponent('Quick confirmation for Covenda')
            +'&body='+encodeURIComponent('Hi,\n\nI listed our club on Covenda, which places undergraduates on paid project work. Could you confirm I am a member? It takes about thirty seconds and does not need an account:\n\n'+url+'\n\nThank you.');
        });
        d.foot.append(copy,mail);
      }catch(error){ d.say(error.message,true); }
    }catch(error){ submit.disabled=false; d.say(error.message,true); }
  });
  d.open(); name.input.focus();
}

function openReferralStep(){
  const who=state.dashboard?.profile?.display_name||'me';
  const d=verifDialog('Ask for a named referral',
    'A referral is one person putting their own name behind your work. We cannot generate one, but we can write the ask, and it is the single strongest signal on your profile.');
  const draft=
    'Hi [name],\n\n'
    +'I’m applying through Covenda, which places undergraduates on scoped, paid project work with startups. '
    +'Companies there weigh referrals from people who have actually seen someone work, over résumés.\n\n'
    +'Would you be willing to vouch for me? It takes about two minutes, you confirm who you are, how you know my work, and what you saw me do. '
    +'If you’d rather not, no hard feelings at all.\n\n'
    +'Thanks,\n'+who;
  const label=document.createElement('label');
  const cap=document.createElement('span'); cap.textContent='Copy this, edit it, send it';
  const area=document.createElement('textarea'); area.className='draft-area'; area.rows=14; area.value=draft;
  label.append(cap,area); d.body.append(label);
  const tips=document.createElement('ul'); tips.className='verif-tips';
  [['Ask someone who saw the work','A supervisor, research PI, club officer, or the founder you shipped for. A friend does not count.'],
   ['One is enough to start','A single named referral outweighs a wall of self-reported skills.'],
   ['They confirm under their own name','That is what makes it worth anything, anonymous praise is not a referral.']]
    .forEach(([t,body])=>{const li=document.createElement('li');const strong=document.createElement('strong');strong.textContent=t;const small=document.createElement('small');small.textContent=body;li.append(strong,small);tips.append(li);});
  d.body.append(tips);

  const copy=document.createElement('button'); copy.type='button'; copy.className='portal-primary'; copy.textContent='Copy the ask';
  copy.addEventListener('click',async()=>{
    try{ await navigator.clipboard.writeText(area.value); copy.textContent='Copied'; d.say('Send it to whoever knows your work best.'); }
    catch{ area.select(); d.say('Select-all and copy, your browser blocked the clipboard.',true); }
  });
  const mail=document.createElement('button'); mail.type='button'; mail.className='portal-secondary'; mail.textContent='Open in email';
  mail.addEventListener('click',()=>{ window.location.href='mailto:?subject='+encodeURIComponent('A quick referral ask')+'&body='+encodeURIComponent(area.value); });
  d.foot.append(copy,mail);
  d.open();
}

// ── The student workflow, made explicit ───────────────────────────────────────────────
// Six steps, in the order they actually happen. Every one is computed from real state — a
// step is done because the row exists, never because someone ticked it — and every one is
// clickable to the exact place that advances it. The point is that a student can always
// answer "what now?" without guessing which tab holds the answer.
function studentJourney(d){
  // asList, not `||[]`: a truthiness guard passes any non-empty object straight through to
  // .filter and throws. This ladder is now the first thing on the overview, so a malformed
  // payload would take the whole page rather than one buried rail panel.
  const profile=(d&&d.profile)||{};
  const v=(d&&d.verification)||{};
  const signals=asList(v.signals);
  const held=key=>Boolean(signals.find(s=>s.key===key)?.held);
  const apps=asList(d.applications);
  const batchApps=asList(d.batchApplications);
  const projects=asList(d.projects);
  const assigned=projects.filter(p=>['assigned','in_progress','review','complete'].includes(p.status));
  const submitted=projects.filter(p=>['review','complete'].includes(p.status));
  const complete=projects.filter(p=>p.status==='complete');
  const messages=asList(d.messages);

  return [
    { key:'verify', title:'Get verified',
      done:v.isStudentVerified===true,
      partial:held('school_email'),
      now:v.isStudentVerified?'A club or referral stands behind you.'
         :held('school_email')?'School email confirmed, that is the floor. A club or referral is what companies weigh.'
         :'Confirm your school email, then claim a club or ask for a referral.',
      cta:v.isStudentVerified?'Review':'Verify', go:()=>openVerificationStep(held('school_email')?'club':'school_email') },

    { key:'referral', title:'Get someone to vouch',
      done:held('referral')||held('club'),
      now:held('referral')?'A named referral is on your profile.'
         :held('club')?'A club confirmed you. A named referral is the stronger version of the same thing.'
         :'One person who has seen you work outweighs a page of self-reported skills.',
      cta:held('referral')?'Manage':'Ask', go:()=>openReferralStep() },

    { key:'profile', title:'Build the profile companies read',
      done:profileCompletion(profile)>=100,
      now:profileCompletion(profile)>=100?'Complete. Companies see it as written.'
         :`${profileCompletion(profile)}% complete, headline, context, skills, and a 60-second intro.`,
      cta:'Open', go:()=>setView('portfolio') },

    { key:'apply', title:'Apply to a batch or a project',
      done:batchApps.length>0||apps.length>0,
      now:batchApps.length?`${batchApps.length} batch ${batchApps.length===1?'application':'applications'} in.`
         :apps.length?`${apps.length} project ${apps.length===1?'application':'applications'} in.`
         :'Batches are the curated route. Open projects are the direct one. Both are open to you.',
      cta:batchApps.length||apps.length?'Track':'Start', go:()=>setView(batchApps.length||!apps.length?'batches':'discover') },

    { key:'deliver', title:'Do the work and submit it',
      done:submitted.length>0,
      partial:assigned.length>0,
      now:complete.length?`${complete.length} accepted ${complete.length===1?'deliverable':'deliverables'}, this is the evidence companies weigh.`
         :submitted.length?'Submitted and waiting on review.'
         :assigned.length?'You have work assigned. Hit the checkpoints; silence is what costs people the role.'
         :'Nothing assigned yet. This is where evidence gets made.',
      cta:assigned.length?'Open':'View', go:()=>setView('projects') },

    { key:'talk', title:'Stay in the conversation',
      done:messages.length>0,
      now:messages.length?`${messages.length} ${messages.length===1?'message':'messages'} on your projects.`
         :'Questions, scope changes, and check-ins all live on the project thread, not in your inbox.',
      cta:'Open', go:()=>setView('messages') },
  ];
}

function renderJourney(){
  const host=$('#journeyPanel');
  if(!host) return;
  const d=state.dashboard;
  if(d?.profile?.role!=='student'){ host.hidden=true; host.replaceChildren(); return; }
  host.replaceChildren();
  const steps=studentJourney(d);
  const doneCount=steps.filter(s=>s.done).length;
  // The next thing to do is the first unfinished step — highlighted, so there is exactly one
  // obvious move at any moment.
  const nextIndex=steps.findIndex(s=>!s.done);

  // One line of chrome, not three. This panel used to open with an h3 ("How this works for
  // you") and an explainer ("Six steps, in order. Each opens where it gets done.") sitting
  // above the only thing a student came to read. Both described mechanics the list already
  // demonstrates. Now that the panel is the first thing on the overview rather than a rail
  // card, it needs no label at all beyond what it is showing.
  const head=document.createElement('div'); head.className='journey-head';
  const label=document.createElement('p'); label.className='eyebrow';
  label.textContent=nextIndex<0?'All six done. Keep the evidence current.':'Next step';
  const count=document.createElement('span'); count.className='journey-count';
  count.textContent=`${doneCount} of ${steps.length}`;
  head.append(label,count); host.append(head);

  // Only the next step is shown. Six expanded rows with six buttons is a chore list, and it
  // was the first thing on the dashboard every single visit, including the five visits after
  // you had already read it. The rest fold away behind one line.
  const ol=document.createElement('ol'); ol.className='journey-list';
  const rest=document.createElement('details'); rest.className='journey-rest';
  const restCap=document.createElement('summary');
  restCap.textContent=nextIndex<0?'All six steps':`The other ${steps.length-1} steps`;
  rest.append(restCap);
  const restList=document.createElement('ol'); restList.className='journey-list';
  rest.append(restList);

  steps.forEach((step,i)=>{
    const li=document.createElement('li');
    li.className=step.done?'is-done':i===nextIndex?'is-next':step.partial?'is-partial':'is-open';
    const row=document.createElement('button'); row.type='button'; row.className='journey-row';
    const mark=document.createElement('span'); mark.className='journey-mark';
    if(step.done) mark.append(icon('p-check')); else mark.textContent=String(i+1);
    const div=document.createElement('div');
    const strong=document.createElement('strong'); strong.textContent=step.title;
    const small=document.createElement('small'); small.textContent=step.now;
    div.append(strong,small);
    const go=document.createElement('span'); go.className='journey-go'; go.textContent=step.cta;
    row.append(mark,div,go);
    row.addEventListener('click',step.go);
    li.append(row);
    // The next step leads; everything else, done or not yet reached, goes in the fold.
    (i===nextIndex?ol:restList).append(li);
  });
  host.append(ol);
  if(restList.childElementCount)host.append(rest);
  host.hidden=false;
  // Exactly one primary CTA on the page. The welcome row's button is a reasonable next
  // step only when the ladder has none left to name.
  const primary=$('#primaryAction');
  if(primary)primary.hidden=nextIndex>=0;
}

// Approved, but not started. The company has committed and the payment is held; nothing is
// running against the student until they say they are beginning. Doing work for a company
// that never actually committed is the failure this exists to prevent, so the panel states
// the commitment in the same breath as the button.
function renderTrialStart(){
  const host=$('#trialStartPanel');
  if(!host)return;
  const d=state.dashboard;
  if(d?.profile?.role!=='student'){host.hidden=true;host.replaceChildren();return;}
  const waiting=(d.projects||[]).filter(p=>p.status==='matched'&&p.assigned_student_user_id===d.profile?.user_id);
  if(!waiting.length){host.hidden=true;host.replaceChildren();return;}
  host.replaceChildren();
  const h=document.createElement('h3');h.textContent=waiting.length===1?'You have been approved':'You have been approved for '+waiting.length+' projects';
  host.append(h);
  waiting.forEach(project=>{
    const card=document.createElement('article');card.className='trial-start';
    const t=document.createElement('strong');t.textContent=project.title;
    const sum=document.createElement('p');sum.textContent=project.summary||'';
    const facts=document.createElement('ul');facts.className='trial-start-facts';
    const pay=Number(project.credits_listed)||0;
    [[pay?`${pay.toLocaleString()} credits held for you`:'Unpaid, no payment is attached to this project',pay>0],
     ['The clock starts when you start, not now',true],
     [project.target_date?`Target date ${dateLabel(project.target_date)}`:'No target date set',true]]
      .forEach(([text,good])=>{const li=document.createElement('li');li.className=good?'is-good':'is-warn';li.textContent=text;facts.append(li);});
    const go=document.createElement('button');go.type='button';go.className='portal-primary';
    go.textContent='Start this work';
    const msg=document.createElement('p');msg.className='dialog-message';msg.setAttribute('aria-live','polite');
    go.addEventListener('click',async()=>{
      go.disabled=true;msg.textContent='Starting…';
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'start-trial',projectId:project.id})});
        await loadDashboard();
      }catch(error){go.disabled=false;msg.textContent=error.message;msg.classList.add('is-error');}
    });
    card.append(t,sum,facts,go,msg);host.append(card);
  });
  host.hidden=false;
}

// ── Introductions ─────────────────────────────────────────────────────────────────────
// A company reached out. The terms come with the ask, and declining or reporting is as
// prominent as accepting — a student who feels pressured needs an obvious exit.
function renderIntroductions(){
  const host=$('#introPanel');
  if(!host)return;
  const d=state.dashboard;
  const intros=(d?.introductions||[]).filter(i=>i.status==='sent'||i.status==='question');
  if(d?.profile?.role!=='student'||!intros.length){host.hidden=true;host.replaceChildren();return;}
  host.replaceChildren();
  const h=document.createElement('h3');
  h.textContent=intros.length===1?'A company reached out':intros.length+' companies reached out';
  host.append(h);

  intros.forEach(intro=>{
    const card=document.createElement('article');card.className='intro-card';
    const role=document.createElement('strong');role.textContent=intro.role_summary;card.append(role);

    const terms=document.createElement('dl');terms.className='intro-terms';
    [['Pay',intro.compensation],['Time',intro.time_commitment],['Next',intro.next_step]].forEach(([k,v])=>{
      if(!v)return;
      const dt=document.createElement('dt');dt.textContent=k;
      const dd=document.createElement('dd');dd.textContent=v;
      terms.append(dt,dd);
    });
    card.append(terms);

    if(intro.why_relevant){
      const why=document.createElement('p');why.className='intro-why';why.textContent='Why you: '+intro.why_relevant;card.append(why);
    }
    if(intro.message){
      const msg=document.createElement('p');msg.className='intro-msg';msg.textContent=intro.message;card.append(msg);
    }

    const msgLine=document.createElement('p');msgLine.className='dialog-message';msgLine.setAttribute('aria-live','polite');
    const act=async(response,note)=>{
      msgLine.textContent='Sending…';
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'respond-introduction',introductionId:intro.id,response,note:note||''})});
        await loadDashboard();
      }catch(error){ msgLine.textContent=error.message; }
    };

    const row=document.createElement('div');row.className='intro-actions';
    const yes=document.createElement('button');yes.type='button';yes.className='portal-primary compact';yes.textContent='Interested';
    yes.addEventListener('click',()=>act('accepted'));
    const ask=document.createElement('button');ask.type='button';ask.className='portal-secondary compact';ask.textContent='Ask a question';
    ask.addEventListener('click',()=>{
      const q=prompt('What do you want to know?');
      if(q&&q.trim())act('question',q.trim());
    });
    const no=document.createElement('button');no.type='button';no.className='intro-decline';no.textContent='Not for me';
    no.addEventListener('click',()=>act('declined'));
    const flag=document.createElement('button');flag.type='button';flag.className='intro-report';flag.textContent='Report';
    flag.title='Tell Covenda if this felt misleading or inappropriate.';
    flag.addEventListener('click',()=>{
      const why=prompt('What was wrong with it? Covenda reads every one of these.');
      if(why&&why.trim())act('reported',why.trim());
    });
    row.append(yes,ask,no,flag);
    card.append(row,msgLine);
    host.append(card);
  });
  host.hidden=false;
}

function renderVerification(){
  const host=$('#verificationPanel'); if(!host)return;
  const v=state.dashboard?.verification;
  if(!host) return;
  if(state.dashboard?.profile?.role!=='student'||!v){ host.hidden=true; return; }
  host.replaceChildren();
  const head=document.createElement('div'); head.className='verif-head';
  const h=document.createElement('h3'); h.textContent='Your verification';
  const sum=document.createElement('p'); sum.textContent=v.summary;
  head.append(h,sum); host.append(head);

  // Every row is a door. A checklist you cannot act on is just a list of things you lack.
  const list=document.createElement('ul'); list.className='verif-list';
  asList(v.signals).forEach(sig=>{
    const step=VERIF_STEPS[sig.key]||{};
    const li=document.createElement('li'); li.className=sig.held?'is-held':'';
    const row=document.createElement('button'); row.type='button'; row.className='verif-row';
    const mark=document.createElement('span'); mark.className='verif-mark';
    if(sig.held) mark.append(icon('p-verified')); else mark.textContent='○';
    const div=document.createElement('div');
    const strong=document.createElement('strong'); strong.textContent=sig.label;
    const small=document.createElement('small'); small.textContent=sig.proves;
    div.append(strong,small);
    const go=document.createElement('span'); go.className='verif-go';
    go.textContent=sig.held?'Manage':(step.cta||'Start');
    row.append(mark,div,go);
    row.addEventListener('click',()=>openVerificationStep(sig.key));
    li.append(row); list.append(li);
  });
  host.append(list);
  // School email is the floor and must never read as the proof — said here, not just in the API.
  if(!v.isStudentVerified){
    const note=document.createElement('p'); note.className='verif-note';
    note.textContent='A school email is the floor, not the proof. Companies weigh a confirmed club or a named referral.';
    host.append(note);
  }
  host.hidden=false;
}

function renderMilestones(){
  const host=$('#milestonePanel');
  if(!host) return;
  const d=state.dashboard;
  const project=(d?.projects||[]).find(p=>p.status==='in_progress'&&Array.isArray(p.milestones)&&p.milestones.length);
  if(d?.profile?.role!=='student'||!project){ host.hidden=true; return; }
  host.replaceChildren();
  const h=document.createElement('h3'); h.textContent='Where your work stands';
  const sub=document.createElement('p'); sub.className='ms-sub'; sub.textContent=project.title||'Current project';
  host.append(h,sub);

  const now=Date.now();
  const ol=document.createElement('ol'); ol.className='ms-list';
  project.milestones.forEach((m,i)=>{
    const submitted=Boolean(m.submitted_at);
    const due=m.due_at?Date.parse(m.due_at):null;
    const overdue=!submitted&&due&&now>due;
    const li=document.createElement('li');
    li.className=submitted?'is-done':overdue?'is-late':'is-open';
    const mark=document.createElement('span'); mark.className='ms-mark';
    mark.textContent=submitted?'✓':String(i+1);
    const div=document.createElement('div');
    const strong=document.createElement('strong'); strong.textContent=m.title||('Checkpoint '+(i+1));
    const small=document.createElement('small');
    small.textContent=submitted
      ? (m.on_time===false?'Submitted late':'Submitted on time')
      : due ? (overdue?'Overdue, tell your reviewer if you need more time':'Due '+new Date(due).toLocaleDateString())
            : 'No date set';
    div.append(strong,small);
    li.append(mark,div); ol.append(li);
  });
  host.append(ol);
  // The rule stated where the student will actually read it.
  const note=document.createElement('p'); note.className='verif-note';
  note.textContent='Running late is fine, say so. Going quiet is what loses the work.';
  host.append(note);
  host.hidden=false;
}

function emptyList(root,iconId,title,copy,action){root.replaceChildren();const box=document.createElement('div');box.className='list-empty';const mark=document.createElement('span');mark.append(icon(iconId));const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=copy;box.append(mark,h,p);if(action&&action.label&&typeof action.run==='function'){const b=document.createElement('button');b.type='button';b.className='empty-cta';b.textContent=action.label;b.addEventListener('click',action.run);box.append(b);}root.append(box);}

// ── R-02: the shortlist, as the company sees it ───────────────────────────────────────
// The money surface. A founder decides here whether Covenda is worth a second brief, so the
// hierarchy is deliberate: evidence band, then the operator's reasoning, then who the person is.
// Not a profile card with the reasoning buried under it.
//
// No score and no rank. Five candidates in any order will be read as a ranking, so the page says
// outright that the order means nothing — a disclaimer is cheaper than a wrong inference.
function shortlistSection(list){
  const box=document.createElement('section');box.className='shortlist';
  const head=document.createElement('div');head.className='shortlist-head';
  const h=document.createElement('h3');h.textContent=`Shortlist · ${list.title}`;
  const note=document.createElement('p');note.className='shortlist-note';
  const candidates=asList(list.candidates);
  // An empty shortlist is not the same as no shortlist, and until now both rendered as nothing
  // at all. A company sat in front of a void, unable to tell whether to wait or to chase.
  //
  // The sentence is identical whether the operator has picked nobody yet or picked only students
  // whose portfolios are private. That is deliberate: any wording that distinguished the two
  // would tell the company that a specific person had been shortlisted, which is precisely what
  // the Ch. 29.5 visibility gate withholds.
  note.textContent=candidates.length
    ? `${candidates.length} ${candidates.length===1?'candidate':'candidates'}, chosen by hand. Listed in no particular order — nothing here is ranked.`
    : 'Being prepared. Every candidate is read and chosen by a person, so this takes a little time.';
  head.append(h,note);box.append(head);
  for(const c of candidates) box.append(shortlistCard(c));
  return box;
}

function shortlistCard(c){
  const card=document.createElement('article');card.className='shortlist-card';

  // Evidence first: what this person has actually shown.
  const band=document.createElement('span');
  band.className='shortlist-band is-'+(c.evidenceBand||'self_reported');
  band.textContent=titleCase(c.evidenceBand||'self_reported')+' evidence';
  card.append(band);

  // The reasoning is the product, so it is the largest thing on the card.
  if(c.rationale){
    const why=document.createElement('p');why.className='shortlist-why';why.textContent=c.rationale;
    card.append(why);
  }

  const who=document.createElement('div');who.className='shortlist-who';
  const nm=document.createElement('strong');nm.textContent=c.name;
  who.append(nm);
  if(c.headline){const hl=document.createElement('span');hl.textContent=c.headline;who.append(hl);}
  if(c.school){const sc=document.createElement('small');sc.textContent=c.school;who.append(sc);}
  card.append(who);

  // The engine's own explanation, kept secondary: it is context for the operator's judgement,
  // not a second opinion competing with it.
  if(c.explanation){
    const det=document.createElement('details');det.className='shortlist-detail';
    const sum=document.createElement('summary');sum.textContent='How this was assembled';
    const pre=document.createElement('p');pre.textContent=c.explanation;
    det.append(sum,pre);card.append(det);
  }
  return card;
}

function renderProjects(){const root=$('#projectList');const items=state.dashboard.projects;root.replaceChildren();for(const list of asList(state.dashboard.shortlists))root.append(shortlistSection(list));if(!items.length&&!asList(state.dashboard.shortlists).length){const isStudent=state.dashboard.profile?.role==='student';emptyList(root,'p-project','No projects in this workspace yet.',isStudent?'Assigned work will appear here with its status and due date.':'Post a private draft when you are ready to shape the first project.',isStudent?{label:'Discover projects →',run:()=>setView('discover')}:{label:'Post a project →',run:openIntake});return;}for(const project of items){if(project.status==='archived')continue;if(project.status==='complete'){root.append(verifiedCard(project,{full:true}));continue;}if(project.status==='proposed'){root.append(packetCard(project));continue;}const row=document.createElement('article');row.className='list-row';const main=document.createElement('div');const h=document.createElement('h3');h.textContent=project.title;const p=document.createElement('p');p.textContent=project.summary;main.append(h,p);const status=document.createElement('div');status.className='list-cell';const statusSmall=document.createElement('small');statusSmall.textContent='Status';status.append(statusSmall,pill(statusLabels[project.status]||titleCase(project.status),'status-pill',project.status));const due=cell('Target',project.target_date?dateLabel(project.target_date):'Not scheduled');const visibility=cell('Visibility',titleCase(project.visibility));row.append(main,status,due,visibility);if(['company','university'].includes(state.dashboard.profile?.role)&&project.owner_user_id===state.dashboard.user.id&&!['complete','archived'].includes(project.status))row.append(endProjectControl(project));root.append(row);}}
function cell(label,value){const div=document.createElement('div');div.className='list-cell';const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;div.append(small,strong);return div;}
// Packet-first intake (GTM Move 1): a Covenda-scoped packet the company accepts (funds it) or declines.
function packetCard(project){
  const card=document.createElement('article');card.className='packet-card';
  const top=document.createElement('div');top.className='packet-card-top';
  const eyebrow=document.createElement('p');eyebrow.className='packet-eyebrow';eyebrow.textContent='Stage 1 · Work-trial, scoped by Covenda, no systems access';
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

// ── The applicant pipeline ────────────────────────────────────────────────────────────
// A flat list of applications answers "how many" and not "what do I do next". Grouped by
// stage, a company sees where everyone actually is and which column is theirs to move.
const PIPELINE_STAGES=[
  {key:'submitted',label:'New',blurb:'Waiting on you.'},
  {key:'reviewing',label:'Reviewing',blurb:'You have opened these.'},
  {key:'shortlisted',label:'Shortlisted',blurb:'Worth a conversation.'},
  {key:'accepted',label:'Accepted',blurb:'Approved to start.'},
  {key:'declined',label:'Declined',blurb:'Closed out.'},
];
function renderPipeline(){
  const host=$('#pipelinePanel');
  if(!host)return;
  const d=state.dashboard;
  if(d?.profile?.role!=='company'){host.hidden=true;host.replaceChildren();return;}
  const apps=d.applications||[];
  if(!apps.length){host.hidden=true;host.replaceChildren();return;}
  host.replaceChildren();

  const head=document.createElement('div');head.className='pipe-head';
  const h=document.createElement('h3');h.textContent='Your pipeline';
  const waiting=apps.filter(a=>a.status==='submitted').length;
  const sub=document.createElement('p');
  sub.textContent=waiting?`${waiting} waiting on you.`:'Nothing waiting on you right now.';
  head.append(h,sub);host.append(head);

  const grid=document.createElement('div');grid.className='pipe-grid';
  PIPELINE_STAGES.forEach(stage=>{
    const col=document.createElement('div');col.className='pipe-col';col.dataset.stage=stage.key;
    const inStage=apps.filter(a=>(a.status||'submitted')===stage.key);
    const top=document.createElement('div');top.className='pipe-col-top';
    const name=document.createElement('strong');name.textContent=stage.label;
    const n=document.createElement('span');n.textContent=inStage.length;
    top.append(name,n);
    const blurb=document.createElement('small');blurb.textContent=stage.blurb;
    col.append(top,blurb);
    if(!inStage.length){
      const empty=document.createElement('p');empty.className='pipe-empty';empty.textContent=', ';col.append(empty);
    }
    inStage.slice(0,12).forEach(app=>{
      const card=document.createElement('button');card.type='button';card.className='pipe-card';
      const who=document.createElement('strong');
      who.textContent=app.applicant?.display_name||'Applicant';
      card.append(who);
      const meta=document.createElement('small');
      // School name is a banned input for scoring and has no business on a talent card either.
      meta.textContent=[app.fit?.presentation?.band?.label?app.fit.presentation.band.label.replace(/^./,c=>c.toUpperCase()):''].filter(Boolean).join(' · ');
      if(meta.textContent)card.append(meta);
      card.addEventListener('click',()=>{setView('activity');pulse('#applicationList');});
      col.append(card);
    });
    if(inStage.length>12){
      const more=document.createElement('small');more.className='pipe-more';more.textContent=`+${inStage.length-12} more`;col.append(more);
    }
    grid.append(col);
  });
  host.append(grid);
  host.hidden=false;
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
    const small=document.createElement('small');small.textContent=`${open.method||', '} · ${open.handle||''} · requested ${dateLabel(open.requested_at)}. Covenda will be in touch to arrange the transfer.`;
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
    note.textContent='Withdrawals open soon. We’ll tell you the moment you can cash out.';
    root.append(note);return;
  }
  if(profile.role==='student'&&!profile.identity_verified){
    const gate=document.createElement('div');gate.className='payout-gate';
    const g=document.createElement('strong');g.textContent='Verify your identity to receive payouts';
    const gs=document.createElement('small');gs.textContent='A quick ID check (photo of your ID + a selfie) confirms you’re a real, 18+ student. Covenda never sees your ID. Stripe handles it securely.';
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
  const handleHelp=document.createElement('small');handleHelp.textContent='Never enter a bank or card number. We arrange the transfer directly.';
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
    ? '1 credit = $1. Credits arrive when a company accepts your work, you receive the full listed amount, never less. Request a payout whenever you like.'
    : '1 credit = $1. Posting publicly is free; a hyper-narrow post routes to matched, referred students for 25 credits. Covenda’s fee is 10% of the listed amount, charged on top, the student always receives the full amount you list.';
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
    const proj=document.createElement('span');proj.className='ledger-project';proj.textContent=projectTitleFor(row.project_id)||', ';
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
  const wallet=params.get('wallet');const identity=params.get('identity');const connected=params.get('connected');
  if(connected==='github'){history.replaceState(null,'',location.pathname);setView('profile');setDialogMessage('#profileMessage','GitHub account verified, repos you own now read as a verified account.');return;}
  if(!wallet&&!identity)return;
  history.replaceState(null,'',location.pathname);
  if(wallet==='paid'){setView('wallet');setDialogMessage('#walletMessage','Payment received, your credits will appear here within a few seconds.');}
  else if(wallet==='cancelled'){setView('wallet');setDialogMessage('#walletMessage','Checkout cancelled, no charge was made.',true);}
  else if(identity==='submitted'){setView('wallet');setDialogMessage('#payoutMessage','Thanks, your ID was submitted. Your verified badge appears once Stripe approves it (usually under a minute).');}
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
function latestMessageTimestamp(){let latest='';for(const m of asList(state.dashboard?.messages)){if(!latest||new Date(m.created_at)>new Date(latest))latest=m.created_at;}return latest;}
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
// SPEC §4: an employer sees a tier, never a raw percentage. A number invites arithmetic the
// score cannot support — a company comparing 71 against 68 is reading precision that is not
// there. The band label already exists on every score; this is the surface that uses it.
function fitTier(score,pres){
  const s=Number(score);
  const label=pres&&pres.band&&pres.band.label
    ? pres.band.label
    : s>=70?'strong signal':s>=40?'promising':'early signal';
  const el=document.createElement('span');
  el.className='fit-pill '+(s>=70?'is-high':s>=40?'is-mid':'is-low');
  el.textContent=label.replace(/^./,c=>c.toUpperCase());
  // The number stays available to the operator, never rendered to the company.
  el.dataset.score=Number.isFinite(s)?String(Math.round(s)):'';
  return el;
}
function fitPill(score,pres){const s=Math.round(Number(score)||0);const el=document.createElement('span');el.className='fit-pill '+(s>=70?'is-high':s>=40?'is-mid':'is-low');el.textContent=`${s}% fit`;
  if(pres&&pres.band){const b=document.createElement('small');b.className='fit-band';b.textContent=`${pres.band.low}–${pres.band.high}`;el.append(b);el.title=`${pres.evidenceTier.replace('_','-')} evidence · likely range ${pres.band.low}–${pres.band.high}, the band tightens as verification hardens`;}
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
  const note=document.createElement('p');note.className='fit-why-note';note.textContent='Early compatibility signal, improves as projects complete. Decision support; you decide.';box.append(note);
  wrap.append(box);return wrap;
}
function discoverChip(label,value){const c=document.createElement('div');c.className='discover-chip';const s=document.createElement('small');s.textContent=label;const b=document.createElement('span');b.textContent=value;c.append(s,b);return c;}
function skillsText(project){const s=project.desired_skills;return Array.isArray(s)?s.join(', '):(s||'');}
function renderDiscover(){
  // Open roles leads this tab. A student with an empty profile can paste a resume here and get
  // something back immediately, which is the one path that works before they have built
  // anything on Covenda at all.
  const rolesHost=$('#openRolesHost');
  if(rolesHost){ rolesHost.replaceChildren(); renderOpenRoles(rolesHost,state.dashboard); }

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
  if(!items.length){const savedTab=discoverState.tab==='saved';const filtered=!savedTab&&(d.opportunities||[]).length>0;emptyList(root,'p-compass',savedTab?'No saved projects yet.':filtered?'No projects match your filters.':'No open projects yet.',savedTab?'Tap Save on any project to keep it here.':filtered?'Try clearing a filter, or check back as new projects are posted.':'New work appears as companies post it. Finish your profile so we can route it.',filtered?{label:'Reset filters',run:()=>$('#filterReset')?.click()}:savedTab?null:{label:'Complete your profile →',run:()=>setView('portfolio')});return;}
  const applied=new Set((d.applications||[]).map(a=>a.project_id));
  // One sorted list buries everything past the top few, which trains a student to only ever
  // look at what they already qualify for. Bands keep a stretch visible without dressing it
  // up as a match. Sorting tabs (best match) stay one flat list, since that IS the sort.
  if(discoverState.tab==='all'&&items.some(p=>p.category)){
    for(const band of DISCOVER_BANDS){
      const inBand=items.filter(p=>(p.category||'stretch')===band.key);
      if(!inBand.length)continue;
      const head=document.createElement('div');head.className='discover-band';
      const h=document.createElement('h3');h.textContent=band.label;
      const c=document.createElement('span');c.textContent=inBand.length;
      const p=document.createElement('p');p.textContent=band.blurb;
      const top=document.createElement('div');top.className='discover-band-top';top.append(h,c);
      head.append(top,p);root.append(head);
      for(const project of inBand)root.append(discoverCard(project,applied.has(project.id)));
    }
    return;
  }
  for(const project of items)root.append(discoverCard(project,applied.has(project.id)));
}
// Mirrors OPPORTUNITY_CATEGORIES in api/readiness.js; portal.js is a classic script and
// cannot import, so the labels live here and the banding decision stays on the server.
const DISCOVER_BANDS=[
  {key:'strong',label:'Strong matches',blurb:'You meet the bar. These are worth your best effort.'},
  {key:'growth',label:'Growth opportunities',blurb:'Close, and what is missing is closeable. The fastest way to level up.'},
  {key:'stretch',label:'Stretch',blurb:'Beyond you today. Worth knowing what they ask for.'},
  {key:'explore',label:'Worth a look',blurb:'Outside what you said you wanted, sometimes that is the point.'},
];
function discoverCard(project,isApplied){
  const row=document.createElement('article');row.className='discover-card'+(project.matched?' is-matched':'');
  const top=document.createElement('div');top.className='discover-card-top';const head=document.createElement('div');head.className='discover-card-head';const h=document.createElement('h3');h.textContent=project.title;head.append(h);
  // Who is hiring. Without this every card read as though Covenda posted it.
  if(project.posterName){const by=document.createElement('button');by.type='button';by.className='discover-poster';const mark=document.createElement('span');mark.className='discover-poster-mark';mark.textContent=String(project.posterName).trim().charAt(0).toUpperCase()||'C';const name=document.createElement('strong');name.textContent=project.posterName;by.append(mark,name);if(project.posterHeadline){const sep=document.createElement('small');sep.textContent=project.posterHeadline;by.append(sep);}
  // Clicking the company opens what they published about themselves.
  by.addEventListener('click',e=>{e.stopPropagation();openCompanyProfile(project.owner_user_id,project.posterName);});
  head.append(by);}
  top.append(head,fitPill(project.fitScore,project.fitPresentation));row.append(top);
  const meta=document.createElement('div');meta.className='discover-meta';const pay=Number(project.credits_listed)||0;meta.append(discoverChip('Payout',pay?`${pay.toLocaleString()} credits`:', '),discoverChip('Target',project.target_date?dateLabel(project.target_date):'Flexible'));if((project.verticals||[]).length)meta.append(discoverChip('Vertical',project.verticals[0]));row.append(meta);
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
// How each batch lines up with the skills a student actually listed. Browsing help — the
// admission bar is unchanged and unaffected by this number, which the copy says out loud.
let batchMinFit=0;
// compatPill used to render "{n}% match" here. A percentage reads as a measurement, and this one
// comes off a transparent weighted model with no completed outcomes behind it: the numbers it
// produced (1%, 25%) invited a precision it cannot support and a sort order it should not have.
// The reason in words survives below, which is the part a student can argue with.
function batchFitOf(batch){
  const c=batch&&batch.compatibility;
  return c&&c.score!==null?c.score:null;
}
// The one minimum-match control. There used to be a second on the marketing site: static
// markup with no handler and no skills data to compute a match against, so it moved and did
// nothing. Two controls doing the same job in two files is how they drifted apart; this is
// the only one, and it is the only one that can work, because it needs a signed-in profile.
// Match filter.
//
// This was a range slider: you dragged, guessed at a threshold, and the entire list re-rendered
// on every pixel of movement. It also never said what a threshold would cost you, so picking
// one meant discovering afterwards that it hid everything.
//
// Tap targets instead, each carrying its own live count. One tap, no dragging, the consequence
// visible before you commit, and it works on a phone.
// Steps derived from the scores actually present, not guessed at.
//
// Hardcoded 40/60/80 assumed a distribution the data does not have: with every batch scoring
// under 40, three of the four buttons showed zero and were disabled, so the control looked
// broken. Quartiles of the real range always partition into something clickable, whatever the
// scores turn out to be.
function batchFitSteps(fits){
  const values=fits.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
  if(values.length<4)return [{value:0,label:'All'}];

  // Fixed, meaningful thresholds rather than quartiles of this student's own distribution.
  //
  // Quartiles produced "1%+", "5%+", "20%+" for anybody whose scores clustered low, and a 1%
  // match is not a filter anybody would choose: nobody thinks "show me the batches I match at
  // least one percent of". The number has to mean something on its own, independently of who
  // is looking at it, or the control is just three arbitrary cuts through the same list.
  //
  // 25/50/75 reads as weak / real / strong, which is what somebody is actually deciding
  // between.
  const MARKS=[25,50,75];

  // A threshold nobody clears is a dead button, and two thresholds hiding the same batches are
  // one filter wearing two labels. Both are dropped rather than shown greyed out.
  const seen=new Set([values.length]);
  const kept=[];
  for(const v of MARKS){
    const count=values.filter(f=>f>=v).length;
    if(count===0||seen.has(count))continue;
    seen.add(count);kept.push(v);
  }
  return [{value:0,label:'All'},...kept.map(v=>({value:v,label:`${v}%+`}))];
}


// ── The simulation runner ─────────────────────────────────────────────────────────────
// A scenario is a sitting rather than a form. State lives on the server, so leaving is safe
// and resuming is exact, and the client never posts its own state: it posts a decision and is
// told what happens next. A client that could post state could post a state where it decided
// differently.
let simRun=null;

async function openSimulation({specialization,scenarioId,batchId}={}){
  const dlg=$('#simDialog'); if(!dlg)return;
  $('#simBody').replaceChildren();
  $('#simTitle').textContent='Starting…';
  setDialogMessage('#simMessage','');
  dlg.showModal();
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({action:'start-simulation',specialization,scenarioId,batchId})});
    simRun={id:out.id,view:out.view};
    if(out.resumed)setDialogMessage('#simMessage','Picked up where you left off.');
    paintSimulation();
  }catch(error){ setDialogMessage('#simMessage',error.message,true); }
}

function paintSimulation(){
  if(!simRun)return;
  const v=simRun.view;
  $('#simTitle').textContent=v.title||'Simulation';
  $('#simEyebrow').textContent=v.minutes?`Simulation · about ${v.minutes} minutes`:'Simulation';
  $('#simBrief').textContent=v.brief||'';
  const pct=v.stepsTotal?Math.round((v.stepsDone/v.stepsTotal)*100):0;
  $('#simProgressFill').style.width=pct+'%';
  $('#simCount').textContent=v.done?'Finished':`Step ${Math.min(v.stepsDone+1,v.stepsTotal)} of ${v.stepsTotal}`;

  const body=$('#simBody'); body.replaceChildren();
  const next=$('#simNext');

  if(v.done){
    const done=document.createElement('div'); done.className='sim-done';
    const h=document.createElement('strong'); h.textContent='Submitted.';
    const p=document.createElement('p');
    p.textContent='A reviewer reads your decisions alongside your answers. What you did is recorded with what it shows and what it does not, and nothing here is scored automatically.';
    done.append(h,p); body.append(done);
    next.textContent='Close'; next.onclick=()=>{ $('#simDialog').close(); loadDashboard(); };
    return;
  }

  const step=v.step; if(!step)return;
  const h=document.createElement('h3'); h.className='sim-step-title'; h.textContent=step.title||'';
  body.append(h);
  if(step.body){ const p=document.createElement('p'); p.className='sim-step-body'; p.textContent=step.body; body.append(p); }

  if(step.kind==='decide'){
    // Radio rather than buttons: a decision should be selectable and changeable before it is
    // committed. Committing on click would make a misclick a permanent part of the record.
    const list=document.createElement('div'); list.className='sim-options';
    step.options.forEach(o=>{
      const lab=document.createElement('label'); lab.className='sim-option';
      const input=document.createElement('input'); input.type='radio'; input.name='sim-option'; input.value=o.id;
      const txt=document.createElement('span'); txt.textContent=o.label;
      lab.append(input,txt); list.append(lab);
    });
    body.append(list);
    next.textContent='Commit this decision';
    next.onclick=()=>{
      const picked=body.querySelector('input[name="sim-option"]:checked');
      if(!picked){ setDialogMessage('#simMessage','Choose one before continuing.',true); return; }
      stepSimulation({optionId:picked.value});
    };
  }else if(step.kind==='produce'){
    const area=document.createElement('textarea'); area.className='sim-input'; area.rows=3;
    area.placeholder='A link to the work, or paste it here.';
    body.append(area);
    next.textContent='Submit the work';
    next.onclick=()=>{
      if(!area.value.trim()){ setDialogMessage('#simMessage','Add the work, or a link to it.',true); return; }
      stepSimulation({artifact:area.value.trim()});
    };
  }else if(step.kind==='defend'){
    const note=document.createElement('p'); note.className='sim-step-body';
    note.textContent='These come from the choices you actually made, so nobody else gets them.';
    body.append(note);
    const area=document.createElement('textarea'); area.className='sim-input'; area.rows=5;
    area.placeholder='Answer in your own words.';
    body.append(area);
    next.textContent='Submit and finish';
    next.onclick=()=>stepSimulation({answer:area.value.trim()});
  }else{
    next.textContent='Continue';
    next.onclick=()=>stepSimulation({});
  }
}

async function stepSimulation(input){
  const next=$('#simNext'); next.disabled=true;
  setDialogMessage('#simMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({action:'advance-simulation',runId:simRun.id,...input})});
    simRun.view=out.view;
    // The defense questions arrive with the final step, so they are asked about decisions that
    // are already on the record rather than ones the candidate could still change.
    if(out.defense&&out.defense.length)simRun.defense=out.defense;
    paintSimulation();
    if(simRun.defense&&simRun.view.step&&simRun.view.step.kind==='defend')paintDefense();
  }catch(error){ setDialogMessage('#simMessage',error.message,true); }
  next.disabled=false;
}

function paintDefense(){
  const body=$('#simBody');
  (simRun.defense||[]).forEach(q=>{
    const wrap=document.createElement('div'); wrap.className='sim-defense';
    const qs=document.createElement('p'); qs.className='sim-defense-q'; qs.textContent=q.question;
    wrap.append(qs); body.insertBefore(wrap,body.querySelector('.sim-input'));
  });
}

function renderBatchFilter(root){
  const d=state.dashboard;
  const open=(d.batches||[]).filter(b=>b.status==='open'||b.status==='reviewing');
  const withFit=open.filter(b=>batchFitOf(b)!==null);
  const bar=document.createElement('div');bar.className='batch-filter';

  if(!withFit.length){
    // Nothing to filter by yet, so say what unlocks it instead of showing a dead control.
    const p=document.createElement('p');p.className='batch-filter-empty';
    p.textContent='Add skills and every batch shows how it lines up.';
    const go=document.createElement('button');go.type='button';go.className='portal-ghost compact';
    go.textContent='Add your skills';go.addEventListener('click',()=>setView('portfolio'));
    bar.append(p,go);root.append(bar);return;
  }

  const cap=document.createElement('span');cap.className='batch-filter-cap';
  cap.textContent='Match';
  const group=document.createElement('div');group.className='batch-fit-steps';
  group.setAttribute('role','group');
  group.setAttribute('aria-label','Filter batches by how well they match your skills');

  batchFitSteps(open.map(batchFitOf)).forEach(step=>{
    // The count is the point: a threshold that would leave nothing should say so before it is
    // chosen, not after.
    const count=open.filter(b=>{const f=batchFitOf(b);return f===null||f>=step.value;}).length;
    const b=document.createElement('button');
    b.type='button';
    b.className='batch-fit-step'+(batchMinFit===step.value?' is-on':'');
    b.setAttribute('aria-pressed',String(batchMinFit===step.value));
    const t=document.createElement('span');t.textContent=step.label;
    const n=document.createElement('b');n.textContent=String(count);
    b.append(t,n);
    if(count===0&&step.value>0){ b.disabled=true; b.title='No batch reaches this yet'; }
    b.addEventListener('click',()=>{ batchMinFit=step.value; renderBatches(); });
    group.append(b);
  });

  const note=document.createElement('small');note.className='batch-filter-note';
  note.textContent='Sorted against your listed skills. Admission is decided by the vetting process, not by this.';
  bar.append(cap,group,note);root.append(bar);
}
function renderBatches(){
  const root=$('#batchList');if(!root)return;
  const role=state.dashboard?.profile?.role;
  if(role==='company'){renderCompanyBatches(root);return;}
  // Simulations render at the foot of this tab rather than in the portfolio. A sitting is what
  // a batch puts you through, so it belongs next to the batches, not filed under evidence.
  const afterList=()=>{
    const host=$('#batchList')?.parentElement; if(!host)return;
    host.querySelector('.sim-host')?.remove();
    const box=document.createElement('div');box.className='sim-host';
    renderSimulations(box,state.dashboard);
    if(box.childElementCount)host.append(box);
  };
  window.setTimeout(afterList,0);
  let batches=(state.dashboard.batches||[]).filter(b=>b.status==='open'||b.status==='reviewing');
  const appByBatch=new Map((state.dashboard.batchApplications||[]).map(a=>[a.batch_id,a]));
  root.replaceChildren();
  if(state.dashboard?.batchApplicationsOpen===false){
    const notice=document.createElement('div');notice.className='batch-closed-notice';
    const b=document.createElement('b');b.textContent='Batches are not open yet';
    const p=document.createElement('p');
    p.textContent=state.dashboard?.batchesClosedMessage||'Batch applications are paused while we rebuild how each one is vetted.';
    notice.append(b,p);root.append(notice);
  }
  renderBatchFilter(root);
  if(batchMinFit>0)batches=batches.filter(b=>{const f=batchFitOf(b);return f===null||f>=batchMinFit;});
  // Best fit first when we have anything to sort by; otherwise leave the curated order alone.
  if(batches.some(b=>batchFitOf(b)!==null))batches=batches.slice().sort((a,b)=>(batchFitOf(b)??-1)-(batchFitOf(a)??-1));
  if(!batches.length&&batchMinFit>0){
    const empty=document.createElement('p');empty.className='batch-filter-none';
    empty.textContent=`No batch matches your skills at ${batchMinFit}% or above. Lower the bar, or add more skills to your profile.`;
    root.append(empty);return;
  }
  if(!batches.length){emptyList(root,'p-spark','No batches are open right now.','Cohorts open a few times a season. Check back.');return;}
  for(const batch of batches)root.append(batchCard(batch,appByBatch.get(batch.id)));
}
function renderCompanyBatches(root){
  const intro=$('#batchIntro');if(intro)intro.textContent='Reviewed cohorts of vetted students. Unlock one to see the roster.';
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
  const marks=document.createElement('div');marks.className='batch-card-marks';
  marks.append(pill(batch.tier==='elite'?'Elite':'Open',batch.tier==='elite'?'batch-tier is-elite':'batch-tier'));
  top.append(marks);
  card.append(top);
  // Why it matched, in words — a number nobody can interrogate is the thing this product
  // says it is not.
  if(batch.compatibility&&batch.compatibility.score!==null&&batch.compatibility.why){
    const why=document.createElement('p');why.className='compat-why';why.textContent=batch.compatibility.why;card.append(why);
  }
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
    if(!roster.length){const p=document.createElement('p');p.className='batch-roster-empty';p.textContent='Nobody admitted yet. Check back after review.';host.append(p);}
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
  return (batch.student_profile||'').trim()||`Students who can already ship in ${batchVertical(batch)}, not learning it from scratch on the job. We look for a track record you can point to (projects, research, competitions, or real deliverables), a professor or club who'll vouch for you, and the judgment to work with little hand-holding. Drive and follow-through count more than a specific GPA or title.`;
}
function batchSampleCompanies(batch){
  return (batch.sample_companies||'').trim()||`The kind of teams this cohort is built for: seed and Series-A startups working in ${batchVertical(batch)}, and small operator-led companies that need senior-quality work without a full-time hire. Exact companies vary each season, admitted students are surfaced directly to the partners hiring that cohort.`;
}
// A small bank of prompts. One is assigned at random when a student opens the application, so
// the video answer is spontaneous rather than over-rehearsed. {v} = the batch's vertical.
const BATCH_VIDEO_PROMPTS=[
  'Walk us through something you built or figured out in {v} that you are genuinely proud of, what was hard about it, and what would you do differently now?',
  'Pick a real problem a small team in {v} is likely facing today. How would you approach it in your first two weeks, with limited context and little hand-holding?',
  'Teach us one non-obvious thing about {v}, explain it so a smart person outside the field could follow.',
  'Tell us about a time you shipped something with an unclear spec. How did you decide what "done" meant, and were you right?',
  'What is a strong opinion you hold about {v} that a lot of people would disagree with, and what convinced you?',
  'Describe the last thing in {v} you taught yourself without being told to. Why that, and how did you go about it?',
];
function pickBatchPrompt(batch){
  const v=batchVertical(batch);
  const raw=BATCH_VIDEO_PROMPTS[Math.floor(Math.random()*BATCH_VIDEO_PROMPTS.length)];
  return raw.replace(/\{v\}/g,v);
}
// Short questions that gauge genuine interest in the batch's vertical (not generic fit).
// The application asks the batch's REAL screening questions, pulled from api/batches.js.
//
// What was here before: "Why this vertical?", then two self-rated scales asking how deep
// the student was in the field and how committed. Everyone selects the top option, so they carried no
// signal at all, and a self-rating is the exact thing this platform says never counts as
// evidence. A student who can answer "depreciation goes up $10, walk the three statements"
// has told us something; a student who ticks "Deep — it is my main focus" has not.
function batchInterestQuestions(batch){
  const brief=batchBriefFor(batch);
  const qs=(brief&&brief.questions)||[];
  if(qs.length){
    // Two written answers here; the rest are asked live in the recorded walkthrough, where
    // they cannot be looked up.
    return qs.slice(0,2).map((q,i)=>({
      id:'q'+(i+1),
      label:q.question,
      hint:q.kind==='technical'
        ?'Show your reasoning. Getting there matters more than landing exactly right.'
        :'No right answer. How you bound the problem is the point.',
      type:'text',
      placeholder:q.kind==='technical'?'Work through it in a few sentences.':'A few sentences.',
    }));
  }
  // No published questions for this batch yet — ask the one thing that is always specific.
  return [{
    id:'why',
    label:`What have you actually built or worked on in ${batchVertical(batch)}?`,
    hint:'Name the thing. Not an interest, a piece of work.',
    type:'text',
    placeholder:'What it was, what you did, what went wrong.',
  }];
}
function batchDetailSection(title,body){
  const wrap=document.createElement('div');wrap.className='batch-detail-block';
  const h=document.createElement('h4');h.textContent=title;wrap.append(h);
  const p=document.createElement('p');p.textContent=body;wrap.append(p);
  return wrap;
}

// §13 slice 4 — the batch detail is audience-split on purpose: a student needs the BAR
// (what it takes and where they stand), a company needs the WALKTHROUGH (how evaluating
// this batch actually goes). Both come from the published brief in api/batches.js.
function batchBriefFor(batch){const briefs=state.dashboard?.batchBriefs||[];return briefs.find(b=>b.slug===batch.slug)||briefs.find(b=>b.name===batch.name)||null;}
function batchStandingFor(batch){const rows=state.dashboard?.batchStanding||[];return rows.find(r=>r.slug===batch.slug)||rows.find(r=>r.name===batch.name)||null;}

function batchVettingBlock(brief){
  const wrap=document.createElement('div');wrap.className='batch-detail-block batch-vetting';
  const h=document.createElement('h4');h.textContent='How this industry is vetted';wrap.append(h);
  const badge=document.createElement('span');
  badge.className='batch-rail-badge'+(brief.vetting.apiVerified?' is-api':'');
  badge.textContent=brief.vetting.apiVerified?'Platform-verified evidence':'Human rail, no API can prove this work';
  wrap.append(badge);
  for(const rail of asList(brief.vetting.rails)){
    const row=document.createElement('div');row.className='batch-rail';
    const name=document.createElement('strong');name.textContent=rail.label;
    const how=document.createElement('p');how.textContent=rail.how;
    const beats=document.createElement('p');beats.className='batch-rail-defeats';beats.textContent=rail.defeats;
    row.append(name,how,beats);wrap.append(row);
  }
  return wrap;
}

// "Strong fit today" versus "could become one" — and what closes the difference.
function readinessBlock(standing){
  const r=standing.readiness;
  const box=document.createElement('div');box.className='readiness';box.dataset.state=r.state;
  const top=document.createElement('div');top.className='readiness-top';
  const lab=document.createElement('strong');lab.textContent=r.label;
  const cnt=document.createElement('span');cnt.textContent=standing.metCount+' of '+standing.total+' requirements met';
  top.append(lab,cnt);
  const sum=document.createElement('p');sum.className='readiness-sum';sum.textContent=r.summary;
  box.append(top,sum);
  if((r.steps||[]).length){
    const head=document.createElement('p');head.className='readiness-steps-head';
    head.textContent=r.steps.length===1?'What closes it':'What closes it, cheapest first';
    const ol=document.createElement('ol');ol.className='readiness-steps';
    r.steps.forEach(step=>{
      const li=document.createElement('li');
      const t=document.createElement('strong');t.textContent=step.label;
      const eff=document.createElement('em');eff.className='readiness-effort';eff.textContent=step.effort;
      const how=document.createElement('span');how.textContent=step.how;
      li.append(t,eff,how);ol.append(li);
    });
    box.append(head,ol);
  }
  const dis=document.createElement('p');dis.className='readiness-disclaimer';dis.textContent=r.disclaimer;
  box.append(dis);
  return box;
}

function batchRequirementsBlock(brief,standing){
  const wrap=document.createElement('div');wrap.className='batch-detail-block batch-requirements';
  const h=document.createElement('h4');h.textContent='What it takes to get in';wrap.append(h);
  // Where you stand, whether that is fixed, and the cheapest thing that closes it. A score
  // with no path attached is a rejection with extra words.
  if(standing&&standing.readiness){
    wrap.append(readinessBlock(standing));
  }else if(standing){
    const sum=document.createElement('p');sum.className='batch-standing-line';
    sum.textContent=standing.metCount+' of '+standing.total+' met'+(standing.meetsThreshold?', you clear the bar.':', here is the rest.');
    wrap.append(sum);
  }
  const list=document.createElement('ul');list.className='batch-req-list';
  for(const req of asList(brief.requirements)){
    const check=standing?.checks?.find(c=>c.key===req.key)||null;
    const li=document.createElement('li');li.className=check?(check.met?'is-met':'is-open'):'is-unknown';
    const label=document.createElement('strong');label.textContent=req.label;li.append(label);
    if(req.detail){const d=document.createElement('p');d.textContent=req.detail;li.append(d);}
    if(check&&!check.met&&check.gap){const g=document.createElement('p');g.className='batch-req-gap';g.textContent=check.gap;li.append(g);}
    list.append(li);
  }
  wrap.append(list);
  const note=document.createElement('p');note.className='batch-req-note';note.textContent='Clearing the bar is a recommendation. A person reviews every application.';
  wrap.append(note);
  return wrap;
}

function batchWorkflowBlock(brief){
  const wrap=document.createElement('div');wrap.className='batch-detail-block batch-workflow';
  const h=document.createElement('h4');h.textContent='How you evaluate this batch';wrap.append(h);
  const ol=document.createElement('ol');ol.className='batch-workflow-list';
  for(const step of asList(brief.companyWorkflow)){
    const li=document.createElement('li');
    const n=document.createElement('span');n.className='batch-step-n';n.textContent=String(step.step);
    const body=document.createElement('div');
    const t=document.createElement('strong');t.textContent=step.title;
    const d=document.createElement('p');d.textContent=step.detail;
    body.append(t,d);li.append(n,body);ol.append(li);
  }
  wrap.append(ol);return wrap;
}

// Skill coverage, as one line instead of a block.
//
// This replaced a caption, a wrapped list of pills, and a sentence underneath that restated the
// pills in prose ("Covers 1 of its 4 core skills. Still wants Financial modeling and Writing &
// documentation."). Three elements saying one thing. Across twenty-five cards that was most of
// what made the grid unreadable.
//
// What survives is the part a student can act on: how many they have, and the single next skill
// that would move it. The full list still exists, one click away, where someone comparing two
// batches will actually read it.
function batchCoverage(batch){
  const c=batch.compatibility;
  const core=batch.coreSkills||[];
  if(!core.length||!c||c.score===null)return null;
  const missing=new Set((c.missing||[]).map(s=>String(s).toLowerCase()));
  const held=core.filter(s=>!missing.has(s.toLowerCase()));
  const next=core.find(s=>missing.has(s.toLowerCase()))||null;

  const wrap=document.createElement('div');wrap.className='batch-cover';
  // The meter is decoration over the number, so it is hidden from screen readers and the whole
  // row carries one sentence instead of leaking four empty list items.
  const meter=document.createElement('span');meter.className='batch-cover-meter';meter.setAttribute('aria-hidden','true');
  for(let i=0;i<core.length;i+=1){
    const seg=document.createElement('i');
    if(i<held.length)seg.className='is-on';
    meter.append(seg);
  }
  const label=document.createElement('span');label.className='batch-cover-label';
  label.textContent=`${held.length} of ${core.length}`;
  wrap.append(meter,label);
  if(next){
    const add=document.createElement('span');add.className='batch-cover-next';
    add.textContent='Add '+next;
    wrap.append(add);
  }
  wrap.setAttribute('role','group');
  wrap.setAttribute('aria-label',`${held.length} of ${core.length} core skills on your profile.`+(next?` Next: ${next}.`:''));
  return wrap;
}

// The full skill list. Lives inside the expanded panel now rather than on the card face.
function batchSkillLedger(batch){
  const c=batch.compatibility;
  const core=batch.coreSkills||[];
  if(!core.length||!c||c.score===null)return null;
  const missing=new Set((c.missing||[]).map(s=>String(s).toLowerCase()));
  const list=document.createElement('ul');list.className='batch-ledger-list';
  for(const skill of core){
    const li=document.createElement('li');
    const held=!missing.has(skill.toLowerCase());
    li.className='batch-ledger-skill'+(held?' is-have':'');
    const mark=document.createElement('i');mark.setAttribute('aria-hidden','true');
    mark.textContent=held?'✓':'·';
    const t=document.createElement('span');t.textContent=skill;
    li.append(mark,t);
    li.title=held?'On your profile':'Not on your profile yet';
    list.append(li);
  }
  return list;
}

// ── The card ──────────────────────────────────────────────────────────────────────────
// It carried eight blocks: name, three meta chips, "Tests:", a description paragraph, a skill
// caption with a pill list, a sentence restating the pills, "The sitting:", and three buttons.
// Every card looked identical in weight, so nothing was scannable and the grid read as a wall.
//
// The face is now four things, in the order a student decides in: which batch, what it tests,
// where they stand, what to do. Three of the four differ per batch or per student; the
// description and the sitting did not differ enough to earn the space, so they moved one click
// away rather than being deleted.
function batchCard(batch,application){
  const card=document.createElement('article');card.className='batch-card batch-card-lg'+(batch.tier==='elite'?' is-elite':'');
  const top=document.createElement('div');top.className='batch-card-top';
  const h=document.createElement('h3');h.textContent=batch.name;top.append(h);
  const marks=document.createElement('div');marks.className='batch-card-marks';
  marks.append(pill(batch.tier==='elite'?'Elite':'Open',batch.tier==='elite'?'batch-tier is-elite':'batch-tier'));
  top.append(marks);
  card.append(top);

  // One sentence, and the only prose on the face. It is what the hour asks of you, which is the
  // thing a subject name cannot tell you.
  if(batch.evaluates){
    const ev=document.createElement('p');ev.className='batch-evaluates';
    const k=document.createElement('b');k.textContent='Tests: ';
    ev.append(k,document.createTextNode(batch.evaluates));
    card.append(ev);
  }

  const cover=batchCoverage(batch);if(cover)card.append(cover);

  // Everything that describes the batch rather than the student's position in it.
  const detail=document.createElement('div');detail.className='batch-detail';detail.hidden=true;

  const meta=document.createElement('div');meta.className='discover-meta';
  if(batch.discipline)meta.append(discoverChip('Discipline',batch.discipline));
  if(batch.partner_org)meta.append(discoverChip('Partner',batch.partner_org));
  if(batch.season)meta.append(discoverChip('Season',batch.season));
  if(meta.childElementCount)detail.append(meta);

  if(batch.description){const p=document.createElement('p');p.className='discover-card-summary';p.textContent=batch.description;detail.append(p);}
  const ledger=batchSkillLedger(batch);
  if(ledger)detail.append(batchDetailSection('Core skills this batch reads for',ledger));
  // The number on the face, itemised. Shown where it is, rather than in a tooltip.
  const breakdown=batchScoreBreakdown(batch);
  if(breakdown)detail.append(batchDetailSection('How this score is built',breakdown));
  const readiness=batchReadinessBlock(batch);
  if(readiness)detail.append(batchDetailSection('What to work on for this batch',readiness));
  if(batch.simulation){
    const sim=document.createElement('p');sim.className='batch-sim';
    const k=document.createElement('b');k.textContent='The sitting: ';
    sim.append(k,document.createTextNode(batch.simulation));
    detail.append(sim);
  }
  detail.append(batchDetailSection('Who this cohort is for',batchStudentProfile(batch)));
  const brief=batchBriefFor(batch);
  const role=state.dashboard?.profile?.role;
  if(brief){
    detail.append(batchVettingBlock(brief));
    if(role==='student')detail.append(batchRequirementsBlock(brief,batchStandingFor(batch)));
    else detail.append(batchWorkflowBlock(brief));
  }
  detail.append(batchDetailSection('Where admitted students go',batchSampleCompanies(batch)));
  detail.append(batchDetailSection('How the application works',`Two parts, about 10 minutes total: a 90-second video answering a prompt we assign you when you start (so it stays spontaneous), and a few written questions about your interest in ${batchVertical(batch)}. An operator reviews every application by hand.`));

  // Moved off the face and into the panel. It was a third button competing with the two that
  // decide anything, and a student reads it once while comparing, not on every card.
  const what=document.createElement('button');
  what.type='button';what.className='portal-ghost compact';
  what.textContent='What you are assessed on';
  what.addEventListener('click',()=>openAssessmentDisclosure(batch));
  detail.append(what);

  const actions=document.createElement('div');actions.className='discover-actions batch-actions';
  const expand=document.createElement('button');expand.type='button';expand.className='portal-ghost compact batch-expand';expand.setAttribute('aria-expanded','false');
  expand.append(document.createTextNode('Details'));
  expand.addEventListener('click',()=>{const open=detail.hidden;detail.hidden=!open;expand.setAttribute('aria-expanded',String(open));expand.firstChild.textContent=open?'Hide':'Details';});
  actions.append(expand);
  if(application){
    const done=document.createElement('span');
    done.className='batch-applied is-'+application.status;
    const mark=document.createElement('i');mark.setAttribute('aria-hidden','true');
    mark.textContent=['accepted','submitted','reviewing'].includes(application.status)?'✓':'·';
    const text=document.createElement('span');
    text.textContent=BATCH_STATUS_LABELS[application.status]||titleCase(application.status);
    done.append(mark,text);
    actions.append(done);
  }else{
    // While the vetting is being rebuilt nobody can apply, so the button says so instead of
    // being a live control that fails on submit.
    const closed=state.dashboard?.batchApplicationsOpen===false;
    const learn=document.createElement('button');learn.type='button';
    learn.className=closed?'portal-ghost compact':'portal-primary compact';
    learn.textContent=closed?'Opens soon':'Learn more & apply';
    learn.disabled=closed||batch.status!=='open';
    if(closed)learn.title=state.dashboard?.batchesClosedMessage||'Batches are not open yet.';
    else if(batch.status!=='open')learn.title='Applications are closed for this batch.';
    learn.addEventListener('click',()=>openBatchApply(batch));
    actions.append(learn);
  }
  card.append(actions,detail);return card;
}
let batchResumeUrl='';
let batchResumeQuestions=[];
function renderResumeQuestions(payload){
  const host=$('#batchResumeQuestions');
  if(!host)return;
  host.replaceChildren();
  batchResumeQuestions=[];
  if(!payload||!payload.ok||!(payload.questions||[]).length){
    // Never fatal. The published technical questions still apply, so say that rather than
    // show an error nobody can act on.
    if(payload&&payload.reason){
      host.hidden=false;
      const note=document.createElement('p'); note.className='ba-rq-note';
      note.textContent=payload.reason;
      host.append(note);
    } else { host.hidden=true; }
    return;
  }
  host.hidden=false;
  const head=document.createElement('p'); head.className='ba-rq-head'; head.textContent='From your résumé';
  const why=document.createElement('p'); why.className='ba-rq-why';
  why.textContent=payload.note||'These come from your own résumé, so nobody else gets them. Answer from memory, we are not checking the dates.';
  host.append(head,why);
  payload.questions.forEach((q,i)=>{
    const wrap=document.createElement('label'); wrap.className='ba-rq-item';
    const cap=document.createElement('span'); cap.className='ba-rq-q'; cap.textContent=q.question;
    const area=document.createElement('textarea'); area.rows=3; area.maxLength=1500;
    area.placeholder='A few sentences.';
    area.dataset.rq=String(i);
    wrap.append(cap,area);
    // The follow-up is shown up front rather than sprung later; it is the second question that
    // preparation rarely survives, and hiding it just wastes the student's first answer.
    if(q.followUp){ const f=document.createElement('small'); f.className='ba-rq-follow'; f.textContent='Then: '+q.followUp; wrap.append(f); }
    host.append(wrap);
    batchResumeQuestions.push({question:q.question,followUp:q.followUp||'',anchor:q.anchor||'',probes:q.probes||''});
  });
}
function readResumeAnswers(){
  const host=$('#batchResumeQuestions'); if(!host)return [];
  return batchResumeQuestions.map((q,i)=>{
    const area=host.querySelector(`textarea[data-rq="${i}"]`);
    return {question:q.question,followUp:q.followUp,anchor:q.anchor,answer:(area&&area.value.trim())||''};
  }).filter(a=>a.answer);
}


function renderBatchResumeChip(name){const chip=$('#batchResumeChip');if(!chip)return;if(!name){chip.hidden=true;chip.textContent='';return;}chip.hidden=false;chip.replaceChildren();const s=document.createElement('span');s.textContent=name;const x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove résumé');x.textContent='×';x.addEventListener('click',()=>{batchResumeUrl='';renderBatchResumeChip('');});chip.append(s,x);}
let currentBatchPrompt='';
let currentBatchVertical='';
let batchInterestSpec=[];
// Step 2: questions one at a time.
//
// All of them at once is a wall of textareas — a student skims, writes short answers to
// everything, and the answers get worse the further down the page they are. One question,
// one answer, then the next. The count is visible so nobody feels trapped.

// Concept and reasoning questions. Both banks have existed in api/assessments.js for all 25
// specialisations, reached the client on the brief, and were never rendered.
//
// They are published deliberately. A question that only works while it is secret is not
// measuring much, and every distractor here is a real misconception rather than a filler
// option, so recognising the right answer still requires knowing why the others are wrong.
//
// Nothing is marked for the student. batch-score.js keeps the composite operator-only and
// non-binding, and showing a running score here would quietly turn the application into a
// test people abandon halfway.
let batchConceptSpec=[], batchReasoningSpec=[];
function renderAssessmentQuestions(batch){
  const brief=batchBriefFor(batch);
  const a=brief&&brief.assessment;
  batchConceptSpec=(a&&a.concepts)||[];
  batchReasoningSpec=(a&&a.reasoning)||[];

  const ch=$('#batchConcepts');
  if(ch){
    ch.replaceChildren();
    if(!batchConceptSpec.length){ch.hidden=true;}
    else{
      ch.hidden=false;
      ch.append(quizHead('Concepts',`${batchConceptSpec.length} multiple choice. Pick the one you would defend.`));
      batchConceptSpec.forEach((c,i)=>{
        const item=document.createElement('fieldset');item.className='ba-quiz-item';
        const legend=document.createElement('legend');legend.textContent=c.q;
        item.append(legend);
        (c.options||[]).forEach((opt,oi)=>{
          const lab=document.createElement('label');lab.className='ba-quiz-opt';
          const radio=document.createElement('input');
          radio.type='radio';radio.name=`concept-${i}`;radio.value=String(oi);
          const txt=document.createElement('span');txt.textContent=opt;
          lab.append(radio,txt);item.append(lab);
        });
        ch.append(item);
      });
    }
  }

  const rh=$('#batchReasoning');
  if(rh){
    rh.replaceChildren();
    if(!batchReasoningSpec.length){rh.hidden=true;}
    else{
      rh.hidden=false;
      rh.append(quizHead('Reasoning',`${batchReasoningSpec.length} short answers. An approach you can defend beats a right answer nobody can follow.`));
      batchReasoningSpec.forEach((r,i)=>{
        const wrap=document.createElement('label');wrap.className='ba-quiz-written';
        const q=document.createElement('span');q.className='ba-quiz-q';q.textContent=r.q;
        const area=document.createElement('textarea');area.rows=4;area.maxLength=2000;
        area.placeholder='Think out loud. Partial reasoning is worth more than a guess.';
        area.dataset.reasoning=String(i);
        wrap.append(q,area);rh.append(wrap);
      });
    }
  }
}
function quizHead(title,sub){
  const head=document.createElement('div');head.className='ba-quiz-head';
  const h=document.createElement('p');h.className='ba-quiz-cap';h.textContent=title;
  const p=document.createElement('p');p.className='ba-quiz-sub';p.textContent=sub;
  head.append(h,p);return head;
}
function readConceptAnswers(){
  return batchConceptSpec.map((c,i)=>{
    const picked=document.querySelector(`input[name="concept-${i}"]:checked`);
    // Number(null) is 0, which would read as "picked the first option". Send null instead.
    return {question:c.q,choice:picked?Number(picked.value):null};
  }).filter(a=>a.choice!==null);
}
function readReasoningAnswers(){
  const host=$('#batchReasoning');if(!host)return [];
  return batchReasoningSpec.map((r,i)=>{
    const area=host.querySelector(`textarea[data-reasoning="${i}"]`);
    return {id:r.id||'',question:r.q,answer:(area&&area.value.trim())||''};
  }).filter(a=>a.answer);
}

let baQIndex = 0;
function renderBatchInterest(batch){
  const host=$('#batchInterestQuestions');if(!host)return;
  batchInterestSpec=batchInterestQuestions(batch);
  baQIndex=0;
  paintBatchQuestion();
}
function paintBatchQuestion(){
  const host=$('#batchInterestQuestions');if(!host)return;
  host.replaceChildren();
  const total=batchInterestSpec.length;
  if(!total)return;
  baQIndex=Math.max(0,Math.min(baQIndex,total-1));
  const q=batchInterestSpec[baQIndex];

  const bar=document.createElement('div');bar.className='bq-bar';
  const count=document.createElement('span');count.textContent=`Question ${baQIndex+1} of ${total}`;
  const dots=document.createElement('div');dots.className='bq-dots';
  batchInterestSpec.forEach((_,i)=>{
    const d=document.createElement('i');
    d.className=i===baQIndex?'is-current':(answeredAt(i)?'is-done':'');
    dots.append(d);
  });
  bar.append(count,dots);host.append(bar);

  const wrap=document.createElement('div');wrap.className='bq-card';
  const label=document.createElement('label');label.className='bq-q';
  const span=document.createElement('span');span.className='bq-label';span.textContent=q.label;label.append(span);
  // How the answer is judged, said up front — a student should never be guessing whether
  // we want a right answer or a way of thinking.
  if(q.hint){const hint=document.createElement('small');hint.className='bq-hint';hint.textContent=q.hint;label.append(hint);}
  let field;
  if(q.type==='select'){
    field=document.createElement('select');
    const ph=document.createElement('option');ph.value='';ph.textContent='Choose one…';field.append(ph);
    (q.options||[]).forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;field.append(opt);});
  }else{
    field=document.createElement('textarea');field.rows=6;field.maxLength=900;field.placeholder=q.placeholder||'';
  }
  field.name='interest_'+q.id;
  field.value=batchAnswers[q.id]||'';
  field.addEventListener('input',()=>{batchAnswers[q.id]=field.value;});
  label.append(field);wrap.append(label);host.append(wrap);

  const nav=document.createElement('div');nav.className='bq-nav';
  if(baQIndex>0){
    const back=document.createElement('button');back.type='button';back.className='portal-secondary compact';back.textContent='Previous';
    back.addEventListener('click',()=>{baQIndex-=1;paintBatchQuestion();});
    nav.append(back);
  }
  if(baQIndex<total-1){
    const next=document.createElement('button');next.type='button';next.className='portal-primary compact';next.textContent='Next question';
    next.addEventListener('click',()=>{baQIndex+=1;paintBatchQuestion();});
    nav.append(next);
  }else{
    const done=document.createElement('p');done.className='bq-done';done.textContent='That is the last one, continue when you are ready.';
    nav.append(done);
  }
  host.append(nav);
  setTimeout(()=>field.focus(),0);
}
function answeredAt(i){
  const q=batchInterestSpec[i];
  return Boolean(q && (batchAnswers[q.id]||'').trim());
}
let batchAnswers={};

function readBatchInterest(){
  // Read from the answer store, not the form — only one question is mounted at a time.
  return batchInterestSpec.map(q=>({id:q.id,question:q.label,answer:(batchAnswers[q.id]||'').trim()})).filter(a=>a.answer);
}
// The batch application, one step at a time.
//
// Everything visible at once made a real application read as a wall — the founder-facing
// version of the same complaint. A student now sees where they are, one thing to do, and
// how much is left. Step 0 is the cohort context, so nobody starts answering before they
// know what they are applying to.
const BA_STEPS=['What this is','Your walkthrough','Your interest','About you'];
let baStep=0;
function baPanels(){ return $$('#batchApplyDialog [data-ba-step]'); }

// ── Draft persistence ─────────────────────────────────────────────────────────────────
// A student can spend twenty minutes on this: a recorded walkthrough, a screen share, six
// written answers. Closing the dialog threw all of it away, which is the kind of thing people
// do not come back from. Saved locally on every change, restored on open, cleared on submit.
//
// Local only, never the server: a half-finished application is not something an operator
// should be able to read, and nobody consented to it being stored.
const BA_DRAFT_KEY = 'covenda:batch-draft:';
function baDraftKey(batchId){ return BA_DRAFT_KEY + (batchId || 'unknown'); }

function saveBatchDraft(batchId){
  const form=$('#batchApplyForm'); if(!form||!batchId)return;
  try{
    const values={};
    ['note','experience','skills','hoursPerWeek','startDate','workSample1','workSample2','videoUrl','referralName','referralCode']
      .forEach(k=>{ if(form.elements[k])values[k]=form.elements[k].value; });
    const exercise=$('#batchExerciseUrl'); if(exercise)values.exerciseUrl=exercise.value;
    localStorage.setItem(baDraftKey(batchId), JSON.stringify({
      values, interest:readBatchInterest(), concepts:readConceptAnswers(),
      reasoning:readReasoningAnswers(), step:baStep, at:Date.now(),
    }));
  }catch{ /* private browsing, or the quota is full. Losing a draft must not break the form. */ }
}

function loadBatchDraft(batchId){
  try{ return JSON.parse(localStorage.getItem(baDraftKey(batchId))||'null'); }catch{ return null; }
}
function clearBatchDraft(batchId){
  try{ localStorage.removeItem(baDraftKey(batchId)); }catch{}
}

// Restores what can be restored and says what cannot. A recording lives on the server once
// uploaded, so its URL comes back; anything mid-record does not, and pretending otherwise
// would be worse than saying so.
function restoreBatchDraft(batchId){
  const draft=loadBatchDraft(batchId); if(!draft)return null;
  const form=$('#batchApplyForm'); if(!form)return null;
  Object.entries(draft.values||{}).forEach(([k,v])=>{ if(form.elements[k])form.elements[k].value=v; });
  const exercise=$('#batchExerciseUrl'); if(exercise&&draft.values?.exerciseUrl)exercise.value=draft.values.exerciseUrl;
  (draft.interest||[]).forEach(a=>{
    const el=document.querySelector(`#batchInterestQuestions [data-interest="${a.id}"]`);
    if(el)el.value=a.answer;
  });
  (draft.reasoning||[]).forEach((a,i)=>{
    const el=document.querySelector(`#batchReasoning textarea[data-reasoning="${i}"]`);
    if(el)el.value=a.answer;
  });
  (draft.concepts||[]).forEach((a,i)=>{
    const el=document.querySelector(`input[name="concept-${i}"][value="${a.choice}"]`);
    if(el)el.checked=true;
  });
  return draft;
}

// ── What is actually finished ─────────────────────────────────────────────────────────
// "Step 2 of 4" tells a student where they are and nothing about what is left. This reports
// completion rather than position, so the rail stops being a page counter.
function baStepDone(index){
  const form=$('#batchApplyForm'); if(!form)return false;
  if(index===0)return true;                                     // reading it is doing it
  if(index===1){
    const video=(form.elements.videoUrl?.value||'').trim();
    const part=$('#baPartExercise');
    const exerciseNeeded=part&&!part.hidden;
    const exercise=($('#batchExerciseUrl')?.value||'').trim();
    return Boolean(video)&&(!exerciseNeeded||Boolean(exercise));
  }
  if(index===2)return readBatchInterest().length>0;
  if(index===3)return (form.elements.note?.value||'').trim().length>=40;
  return false;
}

function renderBatchWizard(){
  const dlg=$('#batchApplyDialog'); if(!dlg) return;
  const panels=baPanels(); if(!panels.length) return;
  const last=panels.length-1;
  baStep=Math.max(0,Math.min(baStep,last));
  panels.forEach(p=>{ p.hidden=Number(p.dataset.baStep)!==baStep; });

  const rail=$('#baProgress');
  if(rail){
    rail.replaceChildren();
    BA_STEPS.slice(0,panels.length).forEach((label,i)=>{
      const li=document.createElement('li');
      // Done means finished, not visited. A student who skipped past step 2 has not done it.
      const done=baStepDone(i);
      li.className=[i===baStep?'is-current':'', done?'is-done':''].filter(Boolean).join(' ');
      const b=document.createElement('button');b.type='button';
      b.textContent=label;
      if(done&&i!==baStep)b.setAttribute('aria-label',`${label}, complete`);
      // Going back is always allowed; jumping ahead is not, so nobody skips the recording.
      b.disabled=i>baStep;
      b.addEventListener('click',()=>{baStep=i;renderBatchWizard();});
      li.append(b);rail.append(li);
    });
  }
  const back=$('#baBack'),next=$('#baNext'),submit=$('#baSubmit'),count=$('#baCount');
  if(back)back.hidden=baStep===0;
  if(next)next.hidden=baStep===last;
  if(submit)submit.hidden=baStep!==last;
  if(count){
    const left=BA_STEPS.slice(0,panels.length).filter((_,i)=>!baStepDone(i)).length;
    // "Step 2 of 4" is a page number. This is the question a student is actually asking.
    count.textContent=left===0?'Everything done, ready to send'
      :`${left} thing${left===1?'':'s'} left`;
  }
  // Autosave on every render, so a draft survives a closed tab or a lost connection.
  saveBatchDraft($('#batchApplyForm')?.elements?.batchId?.value);
  const body=$('#batchApplyDialog .dialog-body'); if(body)body.scrollTop=0;
}
// Saved as they type. Waiting for a step change loses everything typed on the current one.
$('#batchApplyForm')?.addEventListener('input',()=>{
  saveBatchDraft($('#batchApplyForm')?.elements?.batchId?.value);
},{passive:true});

$('#baNext')?.addEventListener('click',()=>{
  // The walkthrough is the one thing a model cannot do for you, so it is the one gate.
  if(baStep===1){
    const url=$('#batchVideoUrl');
    if(url&&!url.value.trim()){
      setDialogMessage('#batchApplyMessage','Record your walkthrough, or pick one you already made.',true);
      return;
    }
  }
  setDialogMessage('#batchApplyMessage','');
  baStep+=1;renderBatchWizard();
});
$('#baBack')?.addEventListener('click',()=>{ baStep-=1; setDialogMessage('#batchApplyMessage',''); renderBatchWizard(); });

// The vetting process for THIS batch's vertical, shown before anything is asked. A student
// meeting a video prompt with no context assumes the video IS the process; it is one stage of
// four, and which four depends on the industry.
// The supplied exercise, screen-recorded. This is the Litmus mechanism: hand over real work,
// let them use their own tools, and capture the PROCESS rather than only the artifact.
function renderExercise(batch){
  const host=$('#batchExercise');
  const part=$('#baPartExercise');
  if(!host)return;
  const brief=batchBriefFor(batch);
  const a=brief&&brief.assessment;
  if(!a||!a.exercise){ if(part)part.hidden=true; return; }
  host.replaceChildren();

  const head=document.createElement('div');head.className='ex-head';
  const h=document.createElement('h4');h.textContent=a.exercise.title;
  const meta=document.createElement('p');meta.className='ex-meta';
  meta.textContent=`${a.exercise.minutes} minutes · we supply everything`;
  head.append(h,meta);host.append(head);

  const supplied=document.createElement('div');supplied.className='ex-block';
  const st=document.createElement('strong');st.textContent='What you get';
  const sp=document.createElement('p');sp.textContent=a.exercise.supplied;
  supplied.append(st,sp);host.append(supplied);

  const task=document.createElement('div');task.className='ex-block is-task';
  const tt=document.createElement('strong');tt.textContent='What to do';
  const tp=document.createElement('p');tp.textContent=a.exercise.task;
  task.append(tt,tp);host.append(task);

  // The material itself. The card claimed "we supply everything" and supplied nothing, which
  // made the whole exercise a description rather than a task.
  const grab=document.createElement('button');grab.type='button';grab.className='ex-file';
  grab.textContent='Download the files';
  grab.addEventListener('click',async()=>{
    grab.disabled=true;const was=grab.textContent;grab.textContent='Preparing…';
    try{
      const r=await fetch(`/api/exercise-file?slug=${encodeURIComponent(batch.slug)}`,{headers:{Authorization:`Bearer ${session().accessToken}`}});
      if(!r.ok)throw new Error('Could not fetch the files.');
      const name=(r.headers.get('content-disposition')||'').match(/filename="(.+?)"/)?.[1]||`${batch.slug}.txt`;
      const url=URL.createObjectURL(await r.blob());
      const link=document.createElement('a');link.href=url;link.download=name;link.click();
      URL.revokeObjectURL(url);
      grab.textContent='Downloaded · get them again';
    }catch(err){ grab.textContent=err.message||'Download failed.'; }
    grab.disabled=false;
  });
  host.append(grab);

  // Said before they start, because a student who thinks the answer is what counts will
  // work silently and score badly for the wrong reason.
  const how=document.createElement('p');how.className='ex-how';
  how.textContent='Talk through what you are doing. Reviewers score the method, a sound approach that runs out of time beats a right answer nobody can follow.';
  host.append(how);

  const state=document.createElement('p');state.className='ex-state';state.setAttribute('aria-live','polite');
  const go=document.createElement('button');go.type='button';go.className='portal-primary';
  go.textContent=`Share screen and start the ${a.exercise.minutes}-minute exercise`;
  if(!videoStudio.canShareScreen){
    go.disabled=true;
    state.textContent='This browser cannot share a screen. Use Chrome, Edge or Safari to do the exercise.';
  }
  go.addEventListener('click',async()=>{
    go.disabled=true;state.textContent='Waiting for you to pick a window…';
    const script=a.script||null;
    const out=await videoStudio.record({
      // Robotics and clinical ops are conversations, not screen shares — the work happened
      // on hardware months ago and there is nothing useful to share.
      mode:script&&script.capture==='camera'?'camera':'screen',
      maxSeconds:a.exercise.minutes*60,
      prompt:a.exercise.task,
      label:`${batch.name} · ${a.exercise.title}`,
      script,
    });
    go.disabled=false;
    if(out&&out.error){ state.textContent=out.error; state.classList.add('is-warn'); return; }
    state.classList.remove('is-warn');
    if(out&&out.url){
      const input=$('#batchExerciseUrl');if(input)input.value=out.url;
      state.textContent='Recorded and attached.';
      go.textContent='Record again';
    }else{
      state.textContent='Nothing recorded.';
    }
  });
  host.append(go,state);
  if(part)part.hidden=false;
}


// How a score was arrived at, shown where the score is shown.
//
// The marketing page promises a number you can interrogate. Until now the product showed the
// number and three reasons, which is not the same thing — a student could not tell whether a
// 78 came from eight matched axes or from two, and those are different claims.
//
// Three things go on the record here:
//   * the basis      how many axes both sides actually answered, out of eight
//   * the matches    named, and the gaps named separately rather than folded into "reasons"
//   * the method     which scoring stage produced it, so nobody has to guess whether a model
//                    touched the number
function scoreBreakdown({score, precise, comparedOn, axes=8, reasons=[], concerns=[], stage='rules'}={}){
  const box=document.createElement('div'); box.className='sbd';

  const head=document.createElement('div'); head.className='sbd-head';
  const n=document.createElement('strong');
  n.textContent=Number.isFinite(precise)?precise.toFixed(1):String(score??'—');
  const cap=document.createElement('span'); cap.textContent='match';
  head.append(n,cap);

  // The honesty line. A confident number built on almost nothing is the failure this prevents.
  const basis=document.createElement('small'); basis.className='sbd-basis';
  const on=Number(comparedOn);
  basis.textContent=Number.isFinite(on)
    ? on===0
      ? `No work-style axes compared yet. Fill in your preferences and this gets sharper.`
      : `Compared on ${on} of ${axes} axes`
    : '';
  if(on===0)basis.classList.add('is-thin');
  head.append(basis);
  box.append(head);

  const list=document.createElement('ul'); list.className='sbd-list';
  reasons.forEach(r=>{const li=document.createElement('li'); li.className='is-match'; li.textContent=r; list.append(li);});
  // Gaps are listed, not hidden. A score that only shows what went right is a score nobody
  // can argue with, which is the thing the product is supposed to be against.
  concerns.filter(c=>!/No major concern/.test(c)).forEach(c=>{
    const li=document.createElement('li'); li.className='is-gap'; li.textContent=c; list.append(li);
  });
  if(list.children.length)box.append(list);

  const how=document.createElement('p'); how.className='sbd-how';
  how.textContent=stage==='bounded'
    ? 'Weighted model, adjusted by the outcome model within a capped range.'
    : stage==='shadow'
      ? 'Weighted model. An outcome model is running alongside it and is not affecting this number.'
      : 'Transparent weighted model. No learned model is affecting this number.';
  box.append(how);
  return box;
}

// Who set the bar this cohort is judged against. Shown in step 0, where a student decides
// whether this is worth twenty minutes, and stated honestly: a vertical nobody has signed off
// says so rather than showing nothing, because an absent badge reads as an oversight.
function renderReviewerLine(batch){
  const host=$('#batchReviewer'); if(!host)return;
  const brief=batchBriefFor(batch);
  const line=brief&&brief.reviewer;
  if(!line){host.hidden=true;return;}
  host.replaceChildren();
  host.hidden=false;
  host.className='batch-reviewer is-'+(line.state||'none');
  const h=document.createElement('strong');h.textContent=line.headline;
  const p=document.createElement('p');p.textContent=line.detail;
  host.append(h,p);
}

function renderVettingSteps(batch){
  const host=$('#batchVetting');
  if(!host)return;
  const brief=batchBriefFor(batch);
  const v=brief&&brief.vettingProcess;
  const stages=(brief&&brief.vettingStages)||[];
  if(!v||!stages.length){host.hidden=true;return;}
  host.replaceChildren();

  const head=document.createElement('div');head.className='vet-head';
  const h=document.createElement('h4');h.textContent='How '+v.vertical+' is vetted';
  const meta=document.createElement('p');meta.className='vet-meta';
  meta.textContent=`${stages.length} steps · about ${v.minutes} minutes of your time`;
  head.append(h,meta);host.append(head);

  const ol=document.createElement('ol');ol.className='vet-steps';
  stages.forEach((st,i)=>{
    const li=document.createElement('li');li.dataset.kind=st.kind;
    const n=document.createElement('span');n.className='vet-n';n.textContent=String(i+1);
    const box=document.createElement('div');
    const t=document.createElement('strong');t.textContent=st.label;
    const tag=document.createElement('em');tag.className='vet-kind';
    tag.textContent=st.kind==='automated'?'checked by machine':'judged by people';
    const why=document.createElement('small');why.textContent=st.why;
    box.append(t,tag,why);
    li.append(n,box);ol.append(li);
  });
  host.append(ol);

  // What the machine can and cannot establish here — different per vertical, and the part
  // that stops the automated stages reading as the whole judgement.
  const honest=document.createElement('p');honest.className='vet-honest';
  honest.textContent=v.honesty;
  host.append(honest);
  host.hidden=false;
}

// The work sample upload. Step 1 asked for a model and offered no way to give us one — the
// same gap as the intro video before the recorder existed.
let batchArtifacts=[];
function renderBatchArtifacts(){
  const list=$('#batchArtifactList');if(!list)return;
  list.replaceChildren();
  batchArtifacts.forEach((f,i)=>{
    const li=document.createElement('li');
    li.className=f.url?'is-done':(f.error?'is-error':'is-busy');
    const name=document.createElement('span');name.textContent=f.name;
    const state=document.createElement('small');
    state.textContent=f.error||(f.url?`${Math.round(f.sizeBytes/1024)} KB`:'Uploading…');
    li.append(name,state);
    if(f.url||f.error){
      const x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove '+f.name);x.textContent='×';
      x.addEventListener('click',()=>{batchArtifacts.splice(i,1);renderBatchArtifacts();});
      li.append(x);
    }
    list.append(li);
  });
}
$('#batchArtifactInput')?.addEventListener('change',async event=>{
  const picked=[...(event.target.files||[])];
  event.target.value='';
  const status=$('#batchArtifactStatus');
  for(const file of picked){
    const entry={name:file.name,sizeBytes:file.size,url:null,error:null};
    batchArtifacts.push(entry);renderBatchArtifacts();
    try{
      const res=await fetch('/api/file-upload',{
        method:'POST',
        headers:{'Content-Type':file.type||'application/octet-stream','X-Covenda-Filename':file.name},
        body:file,
      });
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||'Upload failed.');
      entry.url=body.url;entry.sizeBytes=body.sizeBytes;
    }catch(err){ entry.error=err.message||'Upload failed.'; }
    renderBatchArtifacts();
  }
  // A .pdf where a workbook was asked for is the one mistake worth naming immediately: the
  // parse reads formulas, and a PDF has none.
  if(status){
    const pdf=batchArtifacts.some(f=>/\.pdf$/i.test(f.name));
    status.textContent=pdf
      ? 'A PDF cannot be read for formulas. If you have the spreadsheet, add it too.'
      : (batchArtifacts.some(f=>f.error)?'Some files did not upload.':'');
  }
});

function openBatchApply(batch){
  baStep=0;
  batchAnswers={};
  batchArtifacts=[];
  renderBatchArtifacts();
  const form=$('#batchApplyForm');if(!form)return;
  form.reset();batchResumeUrl='';renderBatchResumeChip('');renderResumeQuestions(null);
  form.elements.batchId.value=batch.id;
  $('#batchApplyTitle').textContent=`Apply to ${batch.name}.`;
  $('#batchApplySummary').textContent=[batch.tier==='elite'?'Elite cohort':'Cohort',batch.discipline,batch.partner_org].filter(Boolean).join(' · ');
  // Open the application "inside" the batch: recap who it's for and where students go, then the
  // assigned video prompt and the interest questions, so it doesn't feel like a bare form.
  const who=$('#batchApplyWho');if(who)who.textContent=batchStudentProfile(batch);
  const samples=$('#batchApplySamples');if(samples)samples.textContent=batchSampleCompanies(batch);
  renderReviewerLine(batch);
  currentBatchPrompt=pickBatchPrompt(batch); // a fresh random prompt each time the form opens
  // Weights the résumé questions toward this batch's field without ignoring the rest.
  currentBatchVertical=[batch.discipline,batch.name].filter(Boolean)[0]||'';
  renderAssessmentQuestions(batch);
  const restored=restoreBatchDraft(batch.id);
  if(restored){
    baStep=Number.isInteger(restored.step)?restored.step:0;
    const when=restored.at?dateLabel(new Date(restored.at).toISOString()):'earlier';
    setDialogMessage('#batchApplyMessage',`Picked up where you left off (saved ${when}). Nothing was sent.`);
  }
  const accom=$('#batchAccommodation');
  if(accom){accom.replaceChildren(accommodationLink('batch_application',batch.slug||batch.id));}
  const promptEl=$('#batchVideoPrompt');if(promptEl)promptEl.textContent=currentBatchPrompt;
  const batchVideoInput=$('#batchVideoUrl');
  if(batchVideoInput){batchVideoInput.value='';
    // Requiredness lives on the hidden input, so the picker has to clear the message itself.
    videoStudio.mountPicker($('#batchVideoPicker'),batchVideoInput,{prompt:currentBatchPrompt,maxSeconds:90,label:(batch&&batch.name?batch.name+' · walkthrough':'Batch walkthrough'),
      onChange:url=>{const st=$('#batchVideoState');if(st)st.textContent=url?'Attached to this application.':'';}});}
  renderBatchInterest(batch);
  setDialogMessage('#batchApplyMessage','');
  renderVettingSteps(batch);
  renderExercise(batch);
  renderBatchWizard();
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
  if(brief.founderTimeMinWeek)add('Founder time required',`~${brief.founderTimeMinWeek} min/week of your review time, bounded checkpoints, not babysitting.`);
  if(brief.followUpQuestions&&brief.followUpQuestions.length){const s=briefSection('To sharpen the scope');s.append(briefBullets(brief.followUpQuestions));root.append(s);}
}
function openDiscoverDetail(project,isApplied){
  $('#discoverDetailTitle').textContent=project.title;const body=$('#discoverDetailBody');
  // The company name belongs at the top of the detail too, not only on the card.
  const eyebrow=$('#discoverDetail .eyebrow');if(eyebrow)eyebrow.textContent=project.posterName?('Posted by '+project.posterName):'Project detail';
  renderBriefDocument(body,project.ai_brief,project.summary);
  const head=document.createElement('div');head.className='detail-head';head.append(fitPill(project.fitScore,project.fitPresentation));const pay=Number(project.credits_listed)||0;const payS=document.createElement('span');payS.className='detail-pay';payS.textContent=pay?`${pay.toLocaleString()} credits payout`:'Payout TBD';head.append(payS);body.prepend(head);
  if(project.fitScore!=null){
    body.insertBefore(scoreBreakdown({
      score:project.fitScore, precise:project.fitPrecise, comparedOn:project.fitComparedOn,
      axes:project.fitAxes||8, reasons:project.fitReasons||[], concerns:project.fitConcerns||[],
      stage:project.fitStage||'rules',
    }),head.nextSibling);
  }
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
    }catch(error){btn.classList.remove('is-busy');if(note){note.textContent=error.message||'Upload failed, please try again.';note.classList.add('is-error');}}
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
// Sending an introduction. The terms are fields, not optional extras — the API refuses
// without them, and asking here rather than rejecting later is the difference between a
// form that teaches and one that scolds.
// The ideal intern, in the founder's own words. Traits and skills stay in separate fields
// because they are not the same kind of claim — one can be evidenced, the other cannot.
function openIdealIntern(project){
  const d=verifDialog('The person you actually need',
    'This shapes the trial. The memo matters most, a skills list says what to filter on, the memo says what the work is for.');
  const traits=verifField('Traits','comma-separated. Not testable from an artifact, but worth saying.',{type:'text',placeholder:'Comfortable with ambiguity, writes clearly'});
  const skills=verifField('Skills','comma-separated. These can be evidenced.',{type:'text',placeholder:'Python, SQL'});
  const memoWrap=document.createElement('label');
  const cap=document.createElement('span');cap.textContent='Why do you need this person?';
  const area=document.createElement('textarea');area.rows=5;
  area.placeholder='What the work is for, and what changes once it is done.';
  memoWrap.append(cap,area);
  if(project.ideal_traits)traits.input.value=(project.ideal_traits||[]).join(', ');
  if(project.ideal_skills)skills.input.value=(project.ideal_skills||[]).join(', ');
  if(project.ideal_memo)area.value=project.ideal_memo;
  d.body.append(traits.label,skills.label,memoWrap);

  const save=document.createElement('button');save.type='button';save.className='portal-primary';save.textContent='Save';
  d.foot.append(save);
  save.addEventListener('click',async()=>{
    save.disabled=true;d.say('Saving…');
    try{
      await portalRequest({method:'POST',body:JSON.stringify({
        action:'ideal-intern',projectId:project.id,
        traits:traits.input.value,skills:skills.input.value,memo:area.value.trim(),
      })});
      d.say('Saved. This shapes what the trial tests.');
      await loadDashboard();
      setTimeout(()=>d.close(),1000);
    }catch(error){ save.disabled=false; d.say(error.message,true); }
  });
  d.open();area.focus();
}

function openIntroduction(student){
  const d=verifDialog('Reach out to '+(student.display_name||'this student'),
    'They see these terms with your message, and can accept, ask a question, or decline.');
  const role=verifField('What is the work?',null,{type:'text',placeholder:'Two-week data cleanup'});
  const why=verifField('Why them?','they see this',{type:'text',placeholder:'You shipped a similar pipeline'});
  const pay=verifField('What it pays','a number, a range, or “unpaid”. Not “competitive”.',{type:'text',placeholder:'$600 flat'});
  const time=verifField('Time commitment',null,{type:'text',placeholder:'10 hrs/week for 2 weeks'});
  const next=verifField('Next step',null,{type:'text',placeholder:'A 20-minute call'});
  const note=document.createElement('label');
  const cap=document.createElement('span');cap.textContent='Personal message';
  const small=document.createElement('small');small.textContent=' optional';cap.append(small);
  const area=document.createElement('textarea');area.rows=3;
  note.append(cap,area);
  d.body.append(role.label,why.label,pay.label,time.label,next.label,note);

  const send=document.createElement('button');send.type='button';send.className='portal-primary';send.textContent='Send introduction';
  d.foot.append(send);
  send.addEventListener('click',async()=>{
    send.disabled=true;d.say('Sending…');
    try{
      await portalRequest({method:'POST',body:JSON.stringify({
        action:'request-introduction',
        studentUserId:student.user_id,
        roleSummary:role.input.value.trim(),whyRelevant:why.input.value.trim(),
        compensation:pay.input.value.trim(),timeCommitment:time.input.value.trim(),
        nextStep:next.input.value.trim(),message:area.value.trim(),
      })});
      d.say('Sent. They decide from here.');
      await loadDashboard();
      setTimeout(()=>d.close(),1100);
    }catch(error){ send.disabled=false; d.say(error.message,true); }
  });
  d.open();role.input.focus();
}

// What the company learned. Asked once, after a project completes, because the answers are
// the only thing that will tell us whether the matching works.
function openOutcomeSurvey(project){
  const qs=state.dashboard?.outcomeQuestions||[];
  if(!qs.length)return;
  const d=verifDialog('How did that go?','Two answers are required; the rest help and are optional.');
  const fields={};
  qs.forEach(q=>{
    const wrap=document.createElement('label');
    const cap=document.createElement('span');cap.textContent=q.prompt;
    let input;
    if(q.kind==='yesno'){
      input=document.createElement('select');
      [['',', '],['yes','Yes'],['no','No']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);});
    }else if(q.kind==='scale'){
      input=document.createElement('select');
      [['',', '],['1','1, not at all'],['2','2'],['3','3'],['4','4'],['5','5, completely']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);});
    }else if(q.kind==='number'){
      input=document.createElement('input');input.type='number';input.min='0';
    }else{
      input=document.createElement('input');input.type='text';
    }
    fields[q.key]=input;
    wrap.append(cap,input);d.body.append(wrap);
  });
  const save=document.createElement('button');save.type='button';save.className='portal-primary';save.textContent='Save';
  d.foot.append(save);
  save.addEventListener('click',async()=>{
    const answers={};
    Object.entries(fields).forEach(([k,el])=>{ if(el.value!=='')answers[k]=el.value; });
    save.disabled=true;d.say('Saving…');
    try{
      await portalRequest({method:'POST',body:JSON.stringify({action:'outcome-survey',projectId:project.id,answers})});
      d.say('Thank you, this is what makes the next shortlist better.');
      await loadDashboard();
      setTimeout(()=>d.close(),1100);
    }catch(error){ save.disabled=false; d.say(error.message,true); }
  });
  d.open();
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
  const act=document.createElement('div');act.className='talent-actions';
  const reach=document.createElement('button');reach.type='button';reach.className='portal-primary compact';reach.textContent='Reach out';
  reach.addEventListener('click',()=>openIntroduction(s));
  act.append(reach);card.append(act);
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

// Your intro takes live on your account, not in an application. Record here once, and every
// application after that is a two-click pick instead of a scramble for a share link.
// Private-store playback. A stored blob URL is not directly viewable, so anything pointing at
// one has to swap in a short-lived signed URL first. Signed on demand rather than at page load,
// because minting a URL nobody watches leaves a live URL sitting in a log for no reason.
function isPrivateMedia(url){ return /\.private\.blob\.vercel-storage\.com\//.test(String(url||'')); }
async function playableUrl(url){
  if(!url)return null;
  if(!isPrivateMedia(url))return url;
  try{
    const res=await fetch('/api/media',{
      method:'POST',
      headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({url}),
    });
    const body=await res.json().catch(()=>({}));
    return body.ok?body.url:null;
  }catch{ return null; }
}
// An explicit Play button rather than a bare <video>: a <video> with no src does not reliably
// fire a play event, so there would be nothing to hang the signing on.
function bindPlayback(video,url){
  const shell=document.createElement('div'); shell.className='video-shell';
  const play=document.createElement('button'); play.type='button'; play.className='video-play-gate';
  play.textContent='Play';
  const note=document.createElement('p'); note.className='video-note'; note.hidden=true;
  video.hidden=true;
  shell.append(play,video,note);
  play.addEventListener('click',async()=>{
    play.disabled=true; play.textContent='Opening…';
    const playable=await playableUrl(url);
    if(!playable){ play.hidden=true; note.hidden=false; note.textContent='That recording could not be opened. It may not be shared with you.'; return; }
    play.remove(); video.hidden=false; video.src=playable; video.play().catch(()=>{});
  });
  return shell;
}
// For anything that is a link rather than a player: résumés, work samples, exercise files.
function bindDownload(anchor,url){
  if(!isPrivateMedia(url))return anchor;
  anchor.href='#';
  anchor.addEventListener('click',async event=>{
    event.preventDefault();
    const was=anchor.textContent; anchor.textContent='Opening…';
    const playable=await playableUrl(url);
    anchor.textContent=was;
    if(playable)window.open(playable,'_blank','noopener');
    else anchor.insertAdjacentHTML('afterend','<span class="video-note is-warn">Not shared with you.</span>');
  });
  return anchor;
}


// A written alternative to every recording. Primary, not a fallback: it needs no transcription
// service, it works today, and a student's own words are authoritative because they wrote them.
// It serves reviewers as much as applicants — a rater who cannot hear a submission cannot
// score it, and the method depends on two raters reading the same artifact.
function transcriptEditor(video){
  const box=document.createElement('details'); box.className='vtx';
  const sum=document.createElement('summary');
  sum.textContent=video.transcript?'Transcript attached':'Add a transcript';
  const why=document.createElement('p'); why.className='vtx-why';
  why.textContent='Type or paste what you said. Companies read it alongside the recording, and it is what makes your work reviewable by someone who cannot hear it.';
  const area=document.createElement('textarea'); area.rows=6; area.maxLength=20000;
  area.value=video.transcript||'';
  area.placeholder='What you said, in your own words.';
  const row=document.createElement('div'); row.className='vtx-row';
  const save=document.createElement('button'); save.type='button'; save.className='portal-primary compact'; save.textContent='Save transcript';
  const state=document.createElement('span'); state.className='vtx-state'; state.setAttribute('aria-live','polite');
  save.addEventListener('click',async()=>{
    save.disabled=true; state.textContent='Saving…';
    try{
      await portalRequest({method:'POST',body:JSON.stringify({action:'save-transcript',videoId:video.id,text:area.value,source:'student'})});
      video.transcript=area.value.trim();
      sum.textContent=video.transcript?'Transcript attached':'Add a transcript';
      state.textContent='Saved.';
    }catch(error){ state.textContent=error.message; }
    save.disabled=false;
  });
  row.append(save,state);
  box.append(sum,why,area,row);
  return box;
}

// A route to a person, for everything a text box cannot cover. Never asks for a diagnosis:
// requiring someone to classify their own disability to apply for work is its own barrier.
// Requests sent during this visit. The dashboard carries the ones made earlier, so a student who
// asks for an accommodation and comes back tomorrow is not blocked again by a page that forgot.
const accommodationsSentThisVisit=new Set();
function accommodationKey(context,reference){return `${context}:${reference||''}`;}
function hasOpenAccommodation(context,reference){
  if(accommodationsSentThisVisit.has(accommodationKey(context,reference)))return true;
  return asList(state.dashboard?.accommodations)
    .some(a=>a&&a.context===context&&(!a.reference||!reference||String(a.reference)===String(reference)));
}

function accommodationLink(context,reference){
  const wrap=document.createElement('div'); wrap.className='accom';
  const btn=document.createElement('button'); btn.type='button'; btn.className='accom-open';
  btn.textContent='Need a different way to do this?';
  const panel=document.createElement('div'); panel.className='accom-panel'; panel.hidden=true;
  const p=document.createElement('p');
  p.textContent='Tell us what would help and a person will arrange it. No diagnosis needed, and applying is not blocked while you wait.';
  const area=document.createElement('textarea'); area.rows=3; area.maxLength=2000;
  area.placeholder='For example: I would rather answer in writing, or I need longer than the timer allows.';
  const send=document.createElement('button'); send.type='button'; send.className='portal-secondary compact'; send.textContent='Send';
  const state=document.createElement('p'); state.className='accom-state'; state.setAttribute('aria-live','polite');
  send.addEventListener('click',async()=>{
    send.disabled=true; state.textContent='Sending…';
    try{
      const out=await portalRequest({method:'POST',body:JSON.stringify({action:'request-accommodation',context,reference,need:area.value})});
      accommodationsSentThisVisit.add(accommodationKey(context,reference));
      state.textContent=out.result?.note||'Sent.'; area.hidden=true; send.hidden=true;
    }catch(error){ state.textContent=error.message; send.disabled=false; }
  });
  btn.addEventListener('click',()=>{ panel.hidden=!panel.hidden; if(!panel.hidden)area.focus(); });
  panel.append(p,area,send,state);
  wrap.append(btn,panel);
  return wrap;
}

function renderVideoLibrary(root){
  const sec=document.createElement('section'); sec.className='video-library';
  const head=document.createElement('div'); head.className='video-library-head';
  const box=document.createElement('div');
  const h=document.createElement('h3'); h.textContent='Your intro videos';
  const p=document.createElement('p');
  p.textContent='Record once, reuse anywhere. Seen only where you attach it.';
  box.append(h,p);
  const add=document.createElement('button'); add.type='button'; add.className='portal-primary compact';
  add.textContent='Record a take';
  if(!videoStudio.canRecord){ add.disabled=true; add.title='This browser cannot record video.'; }
  add.addEventListener('click',async()=>{
    add.disabled=true;
    const out=await videoStudio.record({maxSeconds:60,label:'Intro'});
    add.disabled=false;
    if(out&&out.url)renderPortfolio();
  });
  head.append(box,add); sec.append(head);

  const takes=videoStudio.library();
  if(!takes.length){
    const empty=document.createElement('p'); empty.className='video-library-empty';
    empty.textContent='Nothing yet. Sixty seconds on what you built.';
    sec.append(empty); root.append(sec); return;
  }
  const list=document.createElement('div'); list.className='video-library-list';
  takes.forEach(v=>{
    const card=document.createElement('article'); card.className='video-library-item';
    const player=document.createElement('video'); player.controls=true; player.preload='none'; player.playsInline=true;
    const playerShell=bindPlayback(player,v.url);
    const meta=document.createElement('div');
    const t=document.createElement('strong'); t.textContent=v.label||'Intro take';
    const when=document.createElement('small');
    when.textContent=[Number(v.duration_seconds)?Math.floor(v.duration_seconds/60)+':'+String(v.duration_seconds%60).padStart(2,'0'):'',v.created_at?dateLabel(v.created_at):''].filter(Boolean).join(' · ');
    meta.append(t,when);
    if(v.prompt){const pr=document.createElement('small'); pr.className='video-library-prompt'; pr.textContent='Prompt: '+v.prompt; meta.append(pr);}
    const del=document.createElement('button'); del.type='button'; del.className='video-delete'; del.textContent='Delete';
    del.addEventListener('click',async()=>{
      del.disabled=true; del.textContent='Deleting…';
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'delete-video',videoId:v.id})});
        state.dashboard.videos=(state.dashboard.videos||[]).filter(x=>x.id!==v.id);
        renderPortfolio();
      }catch(error){ del.disabled=false; del.textContent='Delete'; alert(error.message); }
    });
    card.append(playerShell,meta,transcriptEditor(v),del); list.append(card);
  });
  sec.append(list); root.append(sec);
}
// ── Company verification + profile ────────────────────────────────────────────────────
// Mirrors the student side, including the caveat. A confirmed work email means someone reads
// mail at that domain; it is never rendered as "verified company".
function openWorkEmailStep(){
  const d=verifDialog('Confirm your work email',
    'We send a six-digit code to your company address. It confirms you read mail at that domain, it is not a Covenda endorsement of the company.');
  const name=verifField('Company name',null,{type:'text',placeholder:'Northwind Robotics'});
  const email=verifField('Work email','not gmail, outlook, or a temporary address',{type:'email',required:true,placeholder:'you@company.com',autocomplete:'email'});
  const cp=state.dashboard?.companyProfile;
  if(cp&&cp.company_name)name.input.value=cp.company_name;
  d.body.append(name.label,email.label);

  const send=document.createElement('button');send.type='button';send.className='portal-primary';send.textContent='Send me a code';
  d.foot.append(send);
  send.addEventListener('click',async()=>{
    const value=email.input.value.trim();
    if(!value){d.say('Enter your work email.',true);email.input.focus();return;}
    send.disabled=true;d.say('Sending…');
    try{
      const out=await portalRequest({method:'POST',body:JSON.stringify({action:'verify-work-email',workEmail:value,companyName:name.input.value.trim()})});
      d.say('Code sent. It expires in 20 minutes.');
      // A domain unrelated to the trading name is common — worth saying, never worth blocking.
      if(out.match&&out.match.match===false&&out.match.note){
        const note=document.createElement('p');note.className='verif-intro';note.textContent=out.match.note;d.body.append(note);
      }
      email.input.disabled=true;name.input.disabled=true;send.remove();
      const code=verifField('Six-digit code','from the email we just sent',{type:'text',inputMode:'numeric',maxLength:6,placeholder:'000000',autocomplete:'one-time-code'});
      d.body.append(code.label);code.input.focus();
      const confirm=document.createElement('button');confirm.type='button';confirm.className='portal-primary';confirm.textContent='Confirm';
      d.foot.append(confirm);
      confirm.addEventListener('click',async()=>{
        if(code.input.value.trim().length<6){d.say('Enter all six digits.',true);return;}
        confirm.disabled=true;d.say('Checking…');
        try{
          await portalRequest({method:'POST',body:JSON.stringify({action:'confirm-work-email',code:code.input.value.trim()})});
          d.say('Confirmed.');await loadDashboard();setTimeout(()=>d.close(),700);
        }catch(error){confirm.disabled=false;d.say(error.message,true);}
      });
    }catch(error){send.disabled=false;d.say(error.message,true);}
  });
  d.open();email.input.focus();
}

function renderCompanyVerification(root){
  const v=state.dashboard?.companyVerification;
  if(!v)return;
  const sec=document.createElement('section');sec.className='panel-card company-verif';
  const head=document.createElement('div');head.className='verif-head';
  const h=document.createElement('h3');h.textContent='Your company account';
  const sum=document.createElement('p');sum.textContent=v.summary;
  head.append(h,sum);sec.append(head);

  const list=document.createElement('ul');list.className='verif-list';
  asList(v.signals).forEach(sig=>{
    const li=document.createElement('li');li.className=sig.held?'is-held':'';
    const row=document.createElement('button');row.type='button';row.className='verif-row';
    const mark=document.createElement('span');mark.className='verif-mark';
    if(sig.held)mark.append(icon('p-verified'));else mark.textContent='○';
    const div=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=sig.label;
    const small=document.createElement('small');small.textContent=sig.proves;
    // What it does NOT establish, said in the UI and not only in the API.
    const caveat=document.createElement('small');caveat.className='verif-caveat';
    caveat.textContent='Does not prove: '+sig.doesNotProve;
    div.append(strong,small,caveat);
    const go=document.createElement('span');go.className='verif-go';
    go.textContent=sig.held?'Manage':'Confirm';
    row.append(mark,div,go);
    if(sig.key==='work_email')row.addEventListener('click',openWorkEmailStep);
    else row.disabled=true;
    li.append(row);list.append(li);
  });
  sec.append(list);
  root.append(sec);
}

// The public profile a student reaches from a posted project. Long, because the plan asks for
// it to be — but grouped, so it is answerable in passes rather than one wall.
const COMPANY_FORM_GROUPS=[
  ['The basics',[
    ['companyName','Company name','text',null],
    ['websiteUrl','Website','url','https://…'],
    ['logoUrl','Logo URL','url','https://…'],
    ['location','Location','text','New York, NY'],
    ['remotePolicy','Remote or in person','text','Hybrid, 2 days in office'],
    ['teamSize','Team size','text','8'],
    ['stage','Stage and funding','text','Seed'],
  ]],
  ['What you build',[
    ['oneLiner','One line on what you build','text','What it is, in a sentence.'],
    ['industry','Industry','text','Robotics'],
    ['idealCustomer','Ideal customer','textarea','Who buys this, and why.'],
    ['currentPriorities','Current priorities','textarea','What the team is pushing on right now.'],
  ]],
  ['Why a student would join',[
    ['studentGain','What a student gains','textarea','What they will actually learn or be able to show afterwards.'],
    ['workExamples','What they would work on','textarea','Real examples, not a job description.'],
    ['workEnvironment','Work environment','textarea','How the team runs day to day.'],
  ]],
  ['Technical shape',[
    ['techStack','Tech stack','list','Python, Postgres, ROS'],
    ['departments','Departments','list','Engineering, Ops'],
    ['commonTools','Common tools','list','Linear, Figma'],
    ['capabilityAreas','Capability areas','list','Perception, controls'],
  ]],
  ['Engagement terms',[
    ['weeklyHours','Weekly hours','text','10–15'],
    ['engagementTypes','Engagement types','list','Trial project, internship'],
    ['compensationApproach','Compensation approach','textarea','How you pay, and roughly what.'],
    ['workAuthorization','Work authorization','text','US work authorization required'],
    ['hiringTimeline','Typical hiring timeline','text','Two weeks from trial to decision'],
    ['links','Links','list','https://…, https://…'],
  ]],
];

function renderCompanyProfileForm(root){
  const cp=state.dashboard?.companyProfile||{};
  const sec=document.createElement('section');sec.className='company-form';
  const head=document.createElement('div');head.className='company-form-head';
  const box=document.createElement('div');
  const h=document.createElement('h3');h.textContent='Your company profile';
  const p=document.createElement('p');
  p.textContent='What students see. Drafts stay private.';
  box.append(h,p);
  const state_=document.createElement('span');state_.className='company-form-state';
  state_.textContent=cp.published?'Published':'Draft, not visible to students';
  state_.dataset.published=cp.published?'yes':'no';
  head.append(box,state_);sec.append(head);

  const form=document.createElement('form');form.className='company-form-body';
  const val=key=>{
    const col=key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
    const v=cp[col];
    return Array.isArray(v)?v.join(', '):(v==null?'':String(v));
  };
  COMPANY_FORM_GROUPS.forEach(([title,fields])=>{
    const group=document.createElement('fieldset');group.className='company-form-group';
    const legend=document.createElement('legend');legend.textContent=title;group.append(legend);
    const grid=document.createElement('div');grid.className='company-form-grid';
    fields.forEach(([key,label,kind,placeholder])=>{
      const wrap=document.createElement('label');
      wrap.className='company-field'+(kind==='textarea'?' is-wide':'');
      const cap=document.createElement('span');cap.textContent=label;
      if(kind==='list'){const hint=document.createElement('small');hint.textContent='Comma-separated';cap.append(' ',hint);}
      const input=kind==='textarea'?document.createElement('textarea'):document.createElement('input');
      if(kind==='textarea')input.rows=3;else input.type=kind==='url'?'url':'text';
      input.name=key;if(placeholder)input.placeholder=placeholder;
      input.value=val(key);
      wrap.append(cap,input);grid.append(wrap);
    });
    group.append(grid);form.append(group);
  });

  const actions=document.createElement('div');actions.className='company-form-actions';
  const save=document.createElement('button');save.type='submit';save.className='portal-primary';save.textContent='Save';
  const pub=document.createElement('button');pub.type='button';pub.className='portal-secondary';
  pub.textContent=cp.published?'Unpublish':'Save and publish';
  const msg=document.createElement('p');msg.className='dialog-message';msg.setAttribute('aria-live','polite');
  actions.append(save,pub);form.append(actions,msg);

  const collect=published=>{
    const out={action:'save-company-profile'};
    COMPANY_FORM_GROUPS.forEach(([,fields])=>fields.forEach(([key,,kind])=>{
      const el=form.elements[key];if(!el)return;
      out[key]=kind==='list'?el.value.split(',').map(v=>v.trim()).filter(Boolean):el.value.trim();
    }));
    if(published!==undefined)out.published=published;
    return out;
  };
  const submit=async published=>{
    save.disabled=true;pub.disabled=true;msg.textContent='Saving…';msg.classList.remove('is-error');
    try{
      const out=await portalRequest({method:'POST',body:JSON.stringify(collect(published))});
      state.dashboard.companyProfile=out.companyProfile;
      msg.textContent=out.companyProfile.published?'Saved and published.':'Saved as a draft.';
      renderPortfolio();
    }catch(error){msg.textContent=error.message;msg.classList.add('is-error');}
    finally{save.disabled=false;pub.disabled=false;}
  };
  form.addEventListener('submit',e=>{e.preventDefault();submit(undefined);});
  pub.addEventListener('click',()=>submit(!cp.published));

  sec.append(form);root.append(sec);
}

// Student side: the company behind a project.
async function openCompanyProfile(ownerUserId,fallbackName){
  const d=verifDialog(fallbackName||'Company','');
  d.say('Loading…');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({action:'company-profile',ownerUserId})});
    d.say('');
    if(!out.profile){
      const p=document.createElement('p');p.className='verif-intro';p.textContent=out.reason;d.body.append(p);
      d.open();return;
    }
    const c=out.profile;
    const title=d.dlg.querySelector('h2');if(title)title.textContent=c.company_name;
    if(out.workEmailConfirmed){
      const seal=document.createElement('p');seal.className='company-seal';
      seal.append(icon('p-verified'));
      const t=document.createElement('span');
      t.textContent=`Work email confirmed at ${out.domain}. That is not a Covenda endorsement of the company.`;
      seal.append(t);d.body.append(seal);
    }
    const line=(label,value)=>{
      if(!value||(Array.isArray(value)&&!value.length))return;
      const row=document.createElement('div');row.className='company-line';
      const k=document.createElement('strong');k.textContent=label;
      const v=document.createElement('p');v.textContent=Array.isArray(value)?value.join(' · '):String(value);
      row.append(k,v);d.body.append(row);
    };
    line('What they build',c.one_liner);
    line('Industry',c.industry);
    line('Who they sell to',c.ideal_customer);
    line('Right now',c.current_priorities);
    line('What you would gain',c.student_gain);
    line('What you would work on',c.work_examples);
    line('How the team runs',c.work_environment);
    line('Stack',c.tech_stack);
    line('Tools',c.common_tools);
    line('Capability areas',c.capability_areas);
    line('Weekly hours',c.weekly_hours);
    line('Engagement types',c.engagement_types);
    line('Compensation',c.compensation_approach);
    line('Work authorization',c.work_authorization);
    line('Hiring timeline',c.hiring_timeline);
    line('Location',[c.location,c.remote_policy].filter(Boolean).join(', '));
    line('Team',[c.team_size&&`${c.team_size} people`,c.stage].filter(Boolean).join(' · '));
    line('Links',c.links);
    if(c.website_url){
      const a=document.createElement('a');a.className='company-link';a.href=c.website_url;a.target='_blank';a.rel='noopener noreferrer';
      a.textContent='Visit their site →';d.body.append(a);
    }
    d.open();
  }catch(error){ d.say(error.message,true); d.open(); }
}

// ── The proposed brief, and the founder's right to change it ──────────────────────────
// Shown with the diagnosis and the discriminating signals visible, so a founder can see WHY
// each part is there rather than approving a black box. Every edit demands a reason before
// it saves — those reasons are the point, not paperwork.
function briefField(label,value,onSave){
  const wrap=document.createElement('div');wrap.className='brief-field';
  const cap=document.createElement('strong');cap.textContent=label;
  const val=document.createElement('p');val.textContent=value||', ';
  const edit=document.createElement('button');edit.type='button';edit.className='brief-edit';edit.textContent='Change';
  wrap.append(cap,val,edit);
  edit.addEventListener('click',()=>{
    if(wrap.querySelector('.brief-editor'))return;
    const box=document.createElement('div');box.className='brief-editor';
    const ta=document.createElement('textarea');ta.rows=3;ta.value=value||'';
    const why=document.createElement('input');why.type='text';why.placeholder='Why are you changing it? (required)';
    const save=document.createElement('button');save.type='button';save.className='portal-primary compact';save.textContent='Save change';
    const msg=document.createElement('p');msg.className='brief-msg';
    save.addEventListener('click',async()=>{
      if(!why.value.trim()){msg.textContent='Say why. The reason is the part worth keeping.';return;}
      save.disabled=true;msg.textContent='Saving…';
      try{ await onSave(ta.value.trim(),why.value.trim()); }
      catch(error){ save.disabled=false; msg.textContent=error.message; }
    });
    box.append(ta,why,save,msg);wrap.append(box);ta.focus();
  });
  return wrap;
}

function renderBriefReview(root,project){
  if(!project||!project.value_to_company)return;
  const sec=document.createElement('section');sec.className='brief-review';
  const head=document.createElement('div');head.className='brief-review-head';
  const box=document.createElement('div');
  const h=document.createElement('h3');h.textContent='Your proposed trial';
  const p=document.createElement('p');
  p.textContent=project.brief_approved_at?'Approved. Any edit returns it here.':'Nothing goes out until you approve it.';
  box.append(h,p);
  const ver=document.createElement('span');ver.className='brief-version';ver.textContent='v'+(project.brief_version||1);
  head.append(box,ver);sec.append(head);

  // The diagnosis first — a founder should see what we think the problem is before what we
  // propose doing about it, and be able to say we are wrong.
  if(project.stated_problem||project.likely_problem){
    const dg=document.createElement('div');dg.className='brief-diagnosis';
    const t=document.createElement('p');t.className='brief-diagnosis-tag';t.textContent='What we think is going on';
    dg.append(t);
    if(project.stated_problem&&project.likely_problem&&project.stated_problem!==project.likely_problem){
      const note=document.createElement('p');note.className='brief-diverge';
      note.textContent='The evidence points elsewhere. You can overrule us.';
      dg.append(note);
    }
    dg.append(briefField('You said',project.stated_problem,(v,r)=>saveBriefEdit(project,'statedProblem',v,r)));
    dg.append(briefField('We think',project.likely_problem,(v,r)=>saveBriefEdit(project,'likelyProblem',v,r)));
    if(project.root_cause_class){
      const cls=document.createElement('p');cls.className='brief-cause';
      cls.textContent=project.root_cause_class==='structural'
        ? 'Structural, the process is wrong for the work, so the trial redesigns it.'
        : 'Behavioural, the process is fine, so the trial instruments it.';
      dg.append(cls);
    }
    sec.append(dg);
  }

  sec.append(briefField('What you get out of it',project.value_to_company,(v,r)=>saveBriefEdit(project,'valueToCompany',v,r)));

  // What separates a strong candidate from a weak one, stated per trait — including the
  // traits this brief honestly does not test.
  const signals=project.discriminating_signal||[];
  if(signals.length){
    const sg=document.createElement('div');sg.className='brief-signals';
    const t=document.createElement('p');t.className='brief-diagnosis-tag';t.textContent='What this actually tests';
    sg.append(t);
    signals.forEach(sig=>{
      const li=document.createElement('div');li.className='brief-signal'+(sig.discriminates===false?' is-off':'');
      const name=document.createElement('strong');name.textContent=sig.trait;
      li.append(name);
      if(sig.discriminates===false){
        const off=document.createElement('small');off.textContent='This brief does not test it.';li.append(off);
      }else{
        const el=document.createElement('small');el.textContent=sig.element;li.append(el);
        const w=document.createElement('small');w.className='brief-weak';w.textContent='Weak: '+sig.weakLooksLike;
        const st=document.createElement('small');st.className='brief-strong';st.textContent='Strong: '+sig.strongLooksLike;
        li.append(w,st);
      }
      sg.append(li);
    });
    sec.append(sg);
  }

  if(!project.brief_approved_at){
    const foot=document.createElement('div');foot.className='brief-approve';
    const go=document.createElement('button');go.type='button';go.className='portal-primary';go.textContent='Approve and send it out';
    const msg=document.createElement('p');msg.className='brief-msg';
    go.addEventListener('click',async()=>{
      go.disabled=true;msg.textContent='Approving…';
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'approve-brief',projectId:project.id})});
        await loadDashboard();
      }catch(error){ go.disabled=false; msg.textContent=error.message; }
    });
    foot.append(go,msg);sec.append(foot);
  }
  root.append(sec);
}

async function saveBriefEdit(project,field,value,reason){
  await portalRequest({method:'POST',body:JSON.stringify({action:'revise-brief',projectId:project.id,field,value,reason})});
  await loadDashboard();
}

// ── Payout setup, company referrals, ATS ──────────────────────────────────────────────
// Three backends that shipped without a way to reach them.

// Students: set up where the money goes. Stripe's hosted flow, so we never see bank details.
function renderPayoutSetup(root){
  const d=state.dashboard;
  if(d?.profile?.role!=='student')return;
  const sec=document.createElement('section');sec.className='payout-setup';
  const h=document.createElement('h3');h.textContent='Getting paid';
  const p=document.createElement('p');p.id='payoutSetupNote';p.textContent='Checking…';
  const go=document.createElement('button');go.type='button';go.className='portal-primary compact';go.hidden=true;
  sec.append(h,p,go);root.append(sec);

  fetch('/api/stripe-connect').then(r=>r.json()).then(mode=>{
    if(!mode.automated){ p.textContent=mode.note; return; }
    return fetch('/api/stripe-connect',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'status'})})
      .then(r=>r.json()).then(st=>{
        p.textContent=st.message||'';
        if(!st.canReceive){
          go.hidden=false;go.textContent=st.state==='none'?'Set up payouts':'Finish setup';
          go.addEventListener('click',async()=>{
            go.disabled=true;
            try{
              const r=await fetch('/api/stripe-connect',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'start'})});
              const out=await r.json();
              if(out.url)window.location.href=out.url;else throw new Error(out.error||'Could not start setup.');
            }catch(err){go.disabled=false;p.textContent=err.message;}
          });
        }
      });
  }).catch(()=>{ p.textContent='Could not check your payout setup. Try again shortly.'; });
}

// Companies: refer another company. Rewarded only after they do something real.
function renderCompanyReferrals(root){
  const d=state.dashboard;
  if(d?.profile?.role!=='company')return;
  const refs=d.companyReferrals||[];
  const sec=document.createElement('section');sec.className='coref';
  const head=document.createElement('div');head.className='coref-head';
  const box=document.createElement('div');
  const h=document.createElement('h3');h.textContent='Refer another startup';
  const p=document.createElement('p');p.textContent='Pays out once they confirm a work email, post a real brief, reach out to someone, and hire or pay.';
  box.append(h,p);
  const make=document.createElement('button');make.type='button';make.className='portal-primary compact';make.textContent='Create a link';
  make.addEventListener('click',async()=>{
    make.disabled=true;
    try{ await portalRequest({method:'POST',body:JSON.stringify({action:'create-company-referral'})}); await loadDashboard(); }
    catch(error){ make.disabled=false; alert(error.message); }
  });
  head.append(box,make);sec.append(head);

  refs.forEach(r=>{
    const row=document.createElement('article');row.className='coref-row';
    const code=document.createElement('input');code.readOnly=true;code.className='verif-link';
    code.value=location.origin+'/?ref='+r.code;
    code.addEventListener('focus',()=>code.select());
    const bar=document.createElement('div');bar.className='coref-gates';
    // Four gates, shown as gates — a founder can see exactly what is still outstanding.
    [['Verified',r.verified_at],['Brief',r.brief_at],['Intro',r.introduced_at],['Hired or paid',r.converted_at]]
      .forEach(([label,at])=>{
        const g=document.createElement('span');g.className='coref-gate'+(at?' is-done':'');g.textContent=label;bar.append(g);
      });
    const note=document.createElement('small');note.textContent=r.standing?.summary||'';
    row.append(code,bar,note);sec.append(row);
  });
  if(!refs.length){
    const empty=document.createElement('p');empty.className='coref-empty';
    empty.textContent='No referral links yet.';sec.append(empty);
  }
  root.append(sec);
}

// Companies: push a candidate into the ATS they already use.
function renderAtsPanel(root){
  if(state.dashboard?.profile?.role!=='company')return;
  const sec=document.createElement('section');sec.className='ats-panel';
  const h=document.createElement('h3');h.textContent='Your ATS';
  const p=document.createElement('p');p.textContent='Checking…';
  const row=document.createElement('div');row.className='ats-actions';
  sec.append(h,p,row);root.append(sec);

  fetch('/api/ats-push',{headers:{Authorization:`Bearer ${session().accessToken}`}})
    .then(r=>r.json()).then(out=>{
      p.textContent=out.note||'';
      if(out.connected)return;
      (out.providers||[]).forEach(prov=>{
        const b=document.createElement('button');b.type='button';b.className='portal-secondary compact';b.textContent=prov.label;
        b.addEventListener('click',async()=>{
          b.disabled=true;
          try{
            const r=await fetch('/api/ats-push',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'connect',provider:prov.id})});
            const res=await r.json();
            p.textContent=res.note||res.error||'';
            row.replaceChildren();
          }catch(err){ b.disabled=false; p.textContent=err.message; }
        });
        row.append(b);
      });
    }).catch(()=>{ p.textContent='Could not check your ATS connection.'; });
}

function renderPortfolio(){const root=$('#portfolioContent');root.replaceChildren();const {profile,studentDirectory}=state.dashboard;if(profile?.role==='company'){
  $('#portfolioEyebrow').textContent='Vetted talent';$('#portfolioTitle').textContent='Talent';$('#portfolioIntro').textContent='Students who opted into discovery.';$('#editProfile').hidden=true;renderBatchBuilder(root,state.dashboard);renderEvidenceRequests(root,state.dashboard);
  const batches=document.createElement('section');batches.className='talent-batches';
  const bh=document.createElement('div');bh.className='talent-batches-head';
  bh.append(Object.assign(document.createElement('h3'),{textContent:'Vetted batches'}));
  bh.append(Object.assign(document.createElement('p'),{textContent:'Every student below opted into discovery. A batch is the vetted subset \u2014 unlock one with credits to see who was admitted.'}));
  batches.append(bh);
  const batchGrid2=document.createElement('div');batchGrid2.className='talent-batch-grid';
  const openBatches=state.dashboard.batches||[];
  const unlockedMap=new Map((state.dashboard.batchAccess||[]).map(a=>[a.batch_id,a]));
  const admittedMap=state.dashboard.batchAdmitted||{};
  if(openBatches.length){
    for(const batch of openBatches)batchGrid2.append(companyBatchCard(batch,unlockedMap.get(batch.id),admittedMap[batch.id]||0));
  }else{
    batchGrid2.append(Object.assign(document.createElement('p'),{className:'batch-roster-empty',textContent:'No batches are open yet. When one opens you can unlock its admitted roster here.'}));
  }
  batches.append(batchGrid2);
  root.append(batches);
  const dirHead=document.createElement('div');dirHead.className='talent-batches-head';
  dirHead.append(Object.assign(document.createElement('h3'),{textContent:'Everyone who opted in'}));
  dirHead.append(Object.assign(document.createElement('p'),{textContent:'The full directory \u2014 not batch-vetted. Filter by proven skill and evidence.'}));
  root.append(dirHead);
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
  $('#portfolioEyebrow').textContent=profile?.role==='student'?'Your evidence':'Partner identity';$('#portfolioTitle').textContent=profile?.role==='student'?'Portfolio':'Organization profile';$('#portfolioIntro').textContent=profile?.role==='student'?'Shape how signed-in company members understand your work.':'Keep the context behind every project accurate.';$('#editProfile').hidden=false;const article=document.createElement('article');article.className='portfolio-profile';const avatarNote=document.createElement('p');avatarNote.className='avatar-note';avatarNote.setAttribute('aria-live','polite');const avatar=portfolioAvatar(profile,avatarNote);const details=document.createElement('div');const h=document.createElement('h2');h.textContent=profile?.display_name||'Complete your profile';if(profile?.identity_verified)h.append(identityBadge());const headline=document.createElement('p');headline.textContent=[profile?.headline,profile?.school_name||profile?.organization_name,profile?.graduation_year&&`Class of ${profile.graduation_year}`].filter(Boolean).join(' · ')||'Add a headline and member details.';const bio=document.createElement('p');bio.textContent=profile?.bio||'Add a short introduction to help the right people understand your work.';const skills=document.createElement('div');skills.className='skills';(profile?.skills||[]).forEach(skill=>skills.append(pill(skill)));details.append(h,headline,bio,skills,avatarNote);article.append(avatar,details);root.append(article);if(profile?.role==='student'){
    // Where you stand, open and first. It is the one panel that answers "how am I doing",
    // which is the question the tab gets opened for.
    renderCompatibility(root,state.dashboard);
    // Everything that IS the evidence, open by default because it is the work.
    portalGroup(root,'Your evidence','What you have shown, and what still needs showing',body=>{
      renderTechnicalProfile(body,state.dashboard);
      renderTechnicalVertical(body,state.dashboard);
      renderFinanceProfile(body,state.dashboard);
      renderCoursework(body,state.dashboard);
    },{open:true});
    // Standing and recordings: read occasionally, not on every visit.
    portalGroup(root,'Standing and recordings','Credibility, proof of work, and your video library',body=>{
      renderCredibility(body,state.dashboard);
      renderProofOfWork(body,profile);
      renderVideoLibrary(body);
    });
    // Money. Touched once, then never again until something lands.
    portalGroup(root,'Getting paid','Where payouts go',body=>{ renderPayoutSetup(body); });
  }
  if(profile?.role==='company'){renderCompanyVerification(root);renderAtsPanel(root);renderCompanyReferrals(root);renderCompanyProfileForm(root);}}

// Live credibility meter — a checklist of REAL, earned signals (identity, completeness, proven
// GitHub skills, completed reviewed work-trials). Not a black-box score; each rung is concrete
// and links to how to earn it. Honest by construction: it only counts things that actually happened.
// This panel used to be a third to-do list: profile completion is already the ring on the
// overview and step 3 of the journey, and the work-trial is step 5. Restating them here
// told a student nothing new and made the portal feel like homework in triplicate.
//
// It has one job nothing else does. It lives on the portfolio page — the page about how you
// are presented — so it answers the question that page raises: what does a company actually
// see when they open this? Facts about the profile as it stands, strongest first, and an
// honest line about what is missing rather than an instruction to go fix it. The journey rail
// owns "what to do next"; this owns "how you read right now".
// ── What you would actually be assessed on (student side) ─────────────────────────────
// A student is owed this BEFORE they spend ninety minutes, not after. Every component, what it
// measures, how long it takes, and the explicit list of what is not done with the result.
//
// The last part matters most. "No composite score, no ranking, no automated rejection" is the
// difference between this and the black box every other application is, and a student has no
// way to know it unless it is written down where they can read it.
const assessmentCache=new Map();

async function openAssessmentDisclosure(batch){
  const dlg=$('#assessmentDialog'); if(!dlg)return;
  $('#assessmentTitle').textContent=batch.name;
  $('#assessmentBody').replaceChildren();
  setDialogMessage('#assessmentMessage','');
  dlg.showModal();

  try{
    let data=assessmentCache.get(batch.slug);
    if(!data){
      data=await portalRequest({method:'POST',body:JSON.stringify({action:'assessment-disclosure',batchSlug:batch.slug})});
      assessmentCache.set(batch.slug,data);
    }
    paintAssessmentDisclosure(data,batch);
  }catch(error){ setDialogMessage('#assessmentMessage',error.message,true); }
}

function paintAssessmentDisclosure(data,batch){
  const host=$('#assessmentBody'); host.replaceChildren();
  const plan=data.plan||{};
  const disclosure=data.disclosure||{};

  const head=document.createElement('p');head.className='asd-head';
  head.textContent=`${plan.minutes} minutes in total, in ${(plan.components||[]).length} parts.`;
  host.append(head);

  // Said plainly when nothing is company-specific yet, rather than presenting a template as
  // though a real team had asked for it.
  if(data.provisional){
    const prov=document.createElement('p');prov.className='asd-provisional';
    prov.textContent='No company has described its environment for this batch yet, so this is what the vertical would ask for. It changes once one does.';
    host.append(prov);
  }

  const list=document.createElement('ol');list.className='asd-steps';
  for(const c of asList(plan.components)){
    const li=document.createElement('li');
    const top=document.createElement('div');top.className='asd-step-top';
    const n=document.createElement('b');n.textContent=c.label;
    const m=document.createElement('span');m.className='asd-min';m.textContent=c.minutes+'m';
    top.append(n,m);
    const w=document.createElement('small');w.textContent=c.why;
    li.append(top,w);list.append(li);
  }
  host.append(list);

  // What is NOT done with the result. The whole point.
  const not=document.createElement('div');not.className='asd-not';
  const cap=document.createElement('b');cap.textContent='What we do not do';
  not.append(cap);
  const ul=document.createElement('ul');
  for(const item of asList(disclosure.notUsed)){const li=document.createElement('li');li.textContent=item;ul.append(li);}
  not.append(ul);
  host.append(not);

  if((disclosure.rights||[]).length){
    const rights=document.createElement('div');rights.className='asd-rights';
    const rc=document.createElement('b');rc.textContent='Either way';
    rights.append(rc);
    const rl=document.createElement('ul');
    for(const r of asList(disclosure.rights)){const li=document.createElement('li');li.textContent=r;rl.append(li);}
    rights.append(rl);host.append(rights);
  }

  const deferred=plan.deferredToTrial||[];
  if(deferred.length){
    const note=document.createElement('p');note.className='asd-deferred';
    note.textContent='Not part of this screen, and part of the paid trial if you get one: '+deferred.map(c=>c.label).join(', ')+'.';
    host.append(note);
  }

  // Only offered when applications are open. A live Start button behind a closed door is the
  // control that fails on submit.
  const foot=$('#assessmentFoot'); foot.replaceChildren();
  if(state.dashboard?.batchApplicationsOpen===false){
    const closed=document.createElement('p');closed.className='asd-closed';
    closed.textContent='Batches are not open yet. The first ones open soon.';
    foot.append(closed);
  } else if(plan.id){
    const go=document.createElement('button');go.type='button';go.className='portal-primary';
    go.textContent='Start the assessment';
    go.addEventListener('click',async()=>{
      go.disabled=true;
      try{
        const out=await portalRequest({method:'POST',body:JSON.stringify({action:'start-assessment',planId:plan.id})});
        setDialogMessage('#assessmentMessage',out.resumed?'Picked up where you left off.':'Started. You can leave and come back.');
        await loadDashboard();
      }catch(error){ setDialogMessage('#assessmentMessage',error.message,true); go.disabled=false; }
    });
    foot.append(go);
  }
  void batch;
}

// ── The batch builder (company side) ──────────────────────────────────────────────────
// The reverse audit, and the plan it produces. Both the questions and the autonomy levels come
// from the server so the form and the engine cannot describe the same thing differently.
const AUTONOMY_LABELS={guided:'Guided — someone checks the work',semi_autonomous:'Semi-autonomous — checks in, works alone between',autonomous:'Autonomous — owns a piece end to end',high_agency:'High agency — finds the work as well as doing it'};

function paintReverseAudit(){
  const host=$('#envAudit'); if(!host)return;
  host.replaceChildren();
  const questions=state.dashboard?.superIntern?.questions||[];
  if(!questions.length)return;
  const cap=document.createElement('p');cap.className='env-audit-cap';
  cap.textContent='What a student actually has to do here';
  const why=document.createElement('p');why.className='env-audit-why';
  why.textContent='Answer what you can. Each one builds a different part of the assessment, and what you leave blank makes it more generic.';
  host.append(cap,why);
  for(const q of questions){
    const wrap=document.createElement('label');wrap.className='env-q';
    const ask=document.createElement('span');ask.className='env-q-ask';ask.textContent=q.ask;
    const builds=document.createElement('small');builds.className='env-q-builds';builds.textContent='Builds: '+q.builds;
    const area=document.createElement('textarea');area.rows=2;area.maxLength=600;area.dataset.audit=q.id;
    wrap.append(ask,builds,area);host.append(wrap);
  }
}

function openEnvironment(){
  const dlg=$('#environmentDialog'); if(!dlg)return;
  $('#environmentForm').reset();
  const v=$('#envVertical');
  if(v&&!v.options.length){
    // Verticals from the batch briefs already on the dashboard, so the list cannot drift.
    const seen=new Set();
    for(const b of asList(state.dashboard?.batchBriefs)){
      const slug=b.verticalSlug; if(!slug||seen.has(slug))continue; seen.add(slug);
      const o=document.createElement('option');o.value=slug;o.textContent=b.vertical||b.discipline||slug;v.append(o);
    }
  }
  const a=$('#envAutonomy');
  if(a&&!a.options.length){
    for(const level of asList(state.dashboard?.superIntern?.autonomyLevels)){
      const o=document.createElement('option');o.value=level;o.textContent=AUTONOMY_LABELS[level]||level;a.append(o);
    }
    a.value='semi_autonomous';
  }
  paintReverseAudit();
  setDialogMessage('#environmentMessage','');
  dlg.showModal();
}

$('#environmentForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.target;
  const data=Object.fromEntries(new FormData(form).entries());
  const reverseAudit={};
  $$('#envAudit textarea[data-audit]').forEach(t=>{ if(t.value.trim())reverseAudit[t.dataset.audit]=t.value.trim(); });
  setDialogMessage('#environmentMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({
      action:'save-company-environment',
      vertical:data.vertical,
      autonomy:data.autonomy,
      seniorHoursPerWeek:data.seniorHoursPerWeek,
      domainKnowledge:Boolean(data.domainKnowledge),
      reverseAudit,
    })});
    $('#environmentDialog').close();
    await loadDashboard();
    lastBuiltPlan=out.plan||null;
    renderPortfolio();
  }catch(error){ setDialogMessage('#environmentMessage',error.message,true); }
});

let lastBuiltPlan=null;

function renderBatchBuilder(root,d){
  if(d?.profile?.role!=='company')return;
  const engine=d.superIntern||{};
  const plans=engine.plans||[];

  const sec=document.createElement('section');sec.className='panel-card sib-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Batch builder';
  const sub=document.createElement('p');
  sub.textContent='Describe how your team actually works and we build the assessment that environment calls for. Senior hours a week changes it more than anything else you tell us.';
  head.append(h,sub);sec.append(head);

  const plan=lastBuiltPlan||plans[0];
  if(plan){
    const built=document.createElement('div');built.className='sib-plan';
    const cap=document.createElement('p');cap.className='sib-cap';
    const minutes=plan.total_minutes||plan.minutes;
    cap.textContent=`${minutes} minutes of ${engine.budgetMinutes||90}`;
    built.append(cap);

    const list=document.createElement('ol');list.className='sib-steps';
    for(const c of asList(plan.components)){
      const li=document.createElement('li');
      const n=document.createElement('b');n.textContent=c.label;
      const m=document.createElement('span');m.className='sib-min';m.textContent=c.minutes+'m';
      const w=document.createElement('small');w.textContent=c.why;
      li.append(n,m,w);list.append(li);
    }
    built.append(list);

    // Why this shape, in the company's own stated constraints. A plan nobody can interrogate
    // is the black box this product exists to replace.
    const because=plan.because||[];
    if(because.length){
      const bl=document.createElement('ul');bl.className='sib-because';
      because.forEach(b=>{const li=document.createElement('li');li.textContent=b;bl.append(li);});
      built.append(bl);
    }
    const deferred=plan.deferred_to_trial||plan.deferredToTrial||[];
    if(deferred.length){
      const note=document.createElement('p');note.className='sib-deferred';
      note.textContent='Held back to the paid trial so the screen stays under ninety minutes: '+deferred.map(c=>c.label).join(', ')+'.';
      built.append(note);
    }
    sec.append(built);
  } else {
    const none=document.createElement('p');none.className='evreq-none';
    none.textContent='Nothing built yet. Eight questions about how your team works, and we build the assessment from your answers rather than from a template.';
    sec.append(none);
  }

  const add=document.createElement('button');
  add.type='button';add.className=plan?'portal-ghost compact':'portal-primary compact';
  add.textContent=plan?'Build another':'Describe your environment';
  add.addEventListener('click',openEnvironment);
  sec.append(add);
  root.append(sec);
}

// ── What a team wants to see (§9) ─────────────────────────────────────────────────────
// Distinct from the ideal-intern skill list, which says what to FILTER on. This says what a
// student should go and build to be worth talking to, and the difference matters: a filter
// excludes people who have not listed a word, an evidence request tells them what to do about
// it.
//
// The panel shows the company its own request read back as a student would receive it, so a
// vague ask is visible as a vague ask before anyone acts on it.
function renderEvidenceRequests(root,d){
  if(d?.profile?.role!=='company')return;
  const requests=d.evidenceRequests||[];

  const sec=document.createElement('section');sec.className='panel-card evreq-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='What you want to see';
  const sub=document.createElement('p');
  sub.textContent='Your skills list decides who is shown to you. This decides what they go and build. Students see it as a next step rather than a filter they failed.';
  head.append(h,sub);sec.append(head);

  if(requests.length){
    const list=document.createElement('ul');list.className='evreq-list';
    for(const request of requests){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='evreq-top';
      const title=document.createElement('b');title.textContent=request.headline;
      top.append(title);
      const remove=document.createElement('button');
      remove.type='button';remove.className='tech-entry-remove';remove.textContent='Remove';
      remove.addEventListener('click',async()=>{
        try{
          await portalRequest({method:'POST',body:JSON.stringify({action:'delete-evidence-request',id:request.id})});
          await loadDashboard();
        }catch(error){ remove.textContent=error.message||'Could not remove'; remove.disabled=true; }
      });
      top.append(remove);
      li.append(top);
      const chips=document.createElement('div');chips.className='evreq-chips';
      for(const priority of asList(request.priorities)){
        const chip=document.createElement('span');chip.className='evreq-chip';chip.textContent=priority;chips.append(chip);
      }
      li.append(chips);
      if(request.batch_slug){
        const ctx=document.createElement('small');ctx.className='sim-ctx';ctx.textContent='For the '+request.batch_slug.replace(/-/g,' ')+' batch';li.append(ctx);
      }
      list.append(li);
    }
    sec.append(list);
  } else {
    const none=document.createElement('p');none.className='evreq-none';
    none.textContent='Nothing posted yet. Say what a strong candidate would have already built, and students see it as a concrete next step.';
    sec.append(none);
  }

  const add=document.createElement('button');
  add.type='button';add.className=requests.length?'portal-ghost compact':'portal-primary compact';
  add.textContent=requests.length?'Post another':'Post what you want to see';
  add.addEventListener('click',openEvidenceRequest);
  sec.append(add);
  root.append(sec);
}

function openEvidenceRequest(){
  const dlg=$('#evidenceRequestDialog'); if(!dlg)return;
  $('#evidenceRequestForm').reset();
  setDialogMessage('#evidenceRequestMessage','');
  $('#evreqGuidance').replaceChildren();
  dlg.showModal();
}

// Read the company's words back as recommendations before they post, so a priority that maps
// onto nothing is visible immediately rather than after a student fails to act on it.
function previewEvidenceGuidance(){
  const host=$('#evreqGuidance'); if(!host)return;
  host.replaceChildren();
  const raw=$('#evreqPriorities')?.value||'';
  const priorities=raw.split(',').map(x=>x.trim()).filter(Boolean);
  if(!priorities.length)return;
  const guide=state.dashboard?.evidenceTypeGuide||{};
  const cap=document.createElement('p');cap.className='evreq-guide-cap';
  cap.textContent='Students will be told to bring:';
  host.append(cap);
  const list=document.createElement('ul');list.className='evreq-guide';
  // Mirrors the server's mapping loosely for preview only; the server's answer is authoritative
  // and is shown after posting.
  const wanted=new Set();
  for(const p of priorities){
    const key=p.toLowerCase();
    if(/ai|ml|machine|model/.test(key))['shipped_product','research'].forEach(t=>wanted.add(t));
    else if(/infra|cloud|deploy|kubernetes|distributed|system/.test(key))['shipped_product','open_source'].forEach(t=>wanted.add(t));
    else if(/security/.test(key))['open_source','research'].forEach(t=>wanted.add(t));
    else ['shipped_product','independent_project'].forEach(t=>wanted.add(t));
  }
  for(const type of wanted){
    if(!guide[type])continue;
    const li=document.createElement('li');
    const name=document.createElement('b');name.textContent=guide[type].label;
    const why=document.createElement('small');why.textContent=guide[type].demonstrates;
    li.append(name,why);list.append(li);
  }
  host.append(list);
}

$('#evreqPriorities')?.addEventListener('input',previewEvidenceGuidance);

$('#evidenceRequestForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target).entries());
  setDialogMessage('#evidenceRequestMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({
      action:'save-evidence-request',
      headline:data.headline,
      priorities:String(data.priorities||'').split(',').map(x=>x.trim()).filter(Boolean),
      batchSlug:data.batchSlug||null,
      notes:data.notes||null,
    })});
    // Anything that mapped onto no technical domain is named rather than dropped, because a
    // priority nobody can act on is worse than one nobody wrote.
    const unmapped=out.guidance?.unmapped||[];
    if(unmapped.length){
      setDialogMessage('#evidenceRequestMessage','Posted. Not mapped to a technical domain: '+unmapped.join(', ')+'. Those still show on the request.');
      window.setTimeout(()=>$('#evidenceRequestDialog').close(),3200);
    } else { $('#evidenceRequestDialog').close(); }
    await loadDashboard();
  }catch(error){ setDialogMessage('#evidenceRequestMessage',error.message,true); }
});

// ── Offering a sitting ────────────────────────────────────────────────────────────────
// openSimulation existed, worked, and had no caller anywhere. Twenty-six scenarios, a working
// engine and a working route, reachable by nobody. This is the part that was missing.
//
// A sitting is not an assessment a student passes. The card says what it costs in minutes and
// what it is for, because the honest reason to sit one is that it produces evidence no
// artifact can: what you did when the requirements moved.
function renderSimulations(root,d){
  const offers=d?.availableSimulations||[];
  if(d?.profile?.role!=='student'||!offers.length)return;
  const runs=new Map((d.simulations||[]).map(r=>[r.scenario_id,r]));

  const sec=document.createElement('section');sec.className='panel-card simoffer-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Simulations';
  const sub=document.createElement('p');
  sub.textContent='A scenario, not a test. You make decisions with incomplete information and then account for them. Nothing here is scored by the software.';
  head.append(h,sub);sec.append(head);

  const list=document.createElement('ul');list.className='simoffer-list';
  for(const offer of offers){
    const run=runs.get(offer.id);
    const li=document.createElement('li');li.className='simoffer-card'+(offer.optional?' is-optional':'');

    const top=document.createElement('div');top.className='simoffer-top';
    const name=document.createElement('b');name.textContent=offer.title;
    top.append(name);
    if(offer.optional){const tag=document.createElement('span');tag.className='simoffer-tag';tag.textContent='Optional';top.append(tag);}
    const mins=document.createElement('span');mins.className='simoffer-mins';mins.textContent=offer.minutes+' min';
    top.append(mins);
    li.append(top);

    const why=document.createElement('p');why.className='simoffer-brief';why.textContent=offer.brief;
    li.append(why);

    if(offer.forBatch){
      const ctx=document.createElement('small');ctx.className='simoffer-ctx';
      ctx.textContent='The sitting behind '+offer.forBatch;
      li.append(ctx);
    }
    if((offer.skills||[]).length){
      const skills=document.createElement('small');skills.className='simoffer-ctx';
      skills.textContent='Reads for: '+offer.skills.join(', ');
      li.append(skills);
    }

    const go=document.createElement('button');
    go.type='button';
    // Resuming is the common case for a 55-minute sitting, and a button that says Start when
    // there is a half-finished run behind it reads as though the work was lost.
    const inProgress=run&&run.status==='in_progress';
    go.className=inProgress?'portal-primary compact':'portal-ghost compact';
    go.textContent=inProgress?'Resume':(run?'Sit it again':'Start');
    go.addEventListener('click',()=>openSimulation({scenarioId:offer.id,specialization:offer.specialization}));
    li.append(go);

    if(run&&run.status!=='in_progress'){
      const done=document.createElement('small');done.className='simoffer-done';done.textContent='Completed';li.append(done);
    }
    list.append(li);
  }
  sec.append(list);root.append(sec);
}

// ── Adding technical evidence (§3, §4, §5) ────────────────────────────────────────────
// The type is chosen first because it decides which questions are worth asking. Showing every
// field for every type is how a form stops being filled in, so the type-specific blocks are
// revealed rather than all present at once.
//
// The labels and limits here are the server's, fetched with the dashboard, so the two cannot
// describe the same evidence type differently.
const TE_TYPES=[
  ['shipped_product','Shipped product'],
  ['independent_project','Independent project'],
  ['hackathon','Hackathon project'],
  ['open_source','Open-source contribution'],
  ['research','Research work'],
  ['technical_writing','Technical writing'],
  ['community','Technical community'],
  ['coursework','Coursework project'],
];
const TE_OWNERSHIP=[
  ['sole','I built it alone'],
  ['primary','I made the decisions and did most of the building'],
  ['substantial','I owned a named part of it end to end'],
  ['contributor','I worked on it, others shaped it'],
];

function paintTechTypeFields(){
  const type=$('#techType')?.value;
  $$('#techEvidenceForm [data-te-for]').forEach(block=>{
    block.hidden=block.dataset.teFor!==type;
  });
  const explain=$('#techTypeExplain');
  const brief=state.dashboard?.technical?.typeGuide?.[type];
  if(explain){
    explain.replaceChildren();
    if(brief){
      const what=document.createElement('span');what.textContent=brief.demonstrates;
      const limit=document.createElement('small');limit.textContent='Does not show: '+brief.cannotShow;
      explain.append(what,limit);
    }
  }
}

function openTechEvidence(){
  const dlg=$('#techEvidenceDialog'); if(!dlg)return;
  const form=$('#techEvidenceForm'); form.reset();
  const typeSelect=$('#techType');
  if(typeSelect&&!typeSelect.options.length){
    for(const [value,label] of TE_TYPES){const o=document.createElement('option');o.value=value;o.textContent=label;typeSelect.append(o);}
  }
  const own=$('#techOwnership');
  if(own&&!own.options.length){
    for(const [value,label] of TE_OWNERSHIP){const o=document.createElement('option');o.value=value;o.textContent=label;own.append(o);}
  }
  setDialogMessage('#techEvidenceMessage','');
  paintTechTypeFields();
  dlg.showModal();
}

function readTechEvidence(form){
  const data=Object.fromEntries(new FormData(form).entries());
  const ai=['aiTools','aiGenerated','aiChanged','aiVerified'].some(k=>String(data[k]||'').trim());
  return {
    action:'save-technical-evidence',
    type:data.type,
    title:data.title,
    skills:String(data.skills||'').split(',').map(x=>x.trim()).filter(Boolean),
    repoUrl:data.repoUrl||null,
    deploymentUrl:data.deploymentUrl||null,
    ownership:data.ownership,
    monthsOperated:data.monthsOperated||0,
    iterations:data.iterations||0,
    usage:data.usage||null,
    whatIBuilt:data.whatIBuilt||null,
    learnedForThis:data.learnedForThis||null,
    mergeStatus:data.mergeStatus||null,
    hackathon:data.hackathonName?{name:data.hackathonName,teamSize:Number(data.teamSize)||null}:null,
    // Sent only when something was actually written. An empty disclosure object would read as
    // "disclosed nothing" rather than "did not disclose", and those are different.
    aiDisclosure:ai?{tools:data.aiTools||'',generated:data.aiGenerated||'',changed:data.aiChanged||'',verified:data.aiVerified||''}:null,
  };
}

$('#techType')?.addEventListener('change',paintTechTypeFields);

$('#techEvidenceForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.target;
  setDialogMessage('#techEvidenceMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify(readTechEvidence(form))});
    // The questions come back from the server so a student sees straight away what a reviewer
    // will ask about this entry. Nothing is scored; these are what the defense covers. Shown
    // in the dialog before it closes, because a message that appears after it is gone is a
    // message nobody reads.
    if((out.questions||[]).length){
      setDialogMessage('#techEvidenceMessage','Added. At defense you will be asked: '+out.questions[0]);
      window.setTimeout(()=>$('#techEvidenceDialog').close(),2600);
    } else { $('#techEvidenceDialog').close(); }
    await loadDashboard();
  }catch(error){ setDialogMessage('#techEvidenceMessage',error.message,true); }
});

function renderTechEntries(root,d){
  const entries=d?.technical?.entries||[];
  if(!entries.length)return;
  const sec=document.createElement('div');sec.className='tech-section';
  const cap=document.createElement('h4');cap.textContent='Evidence you added';
  sec.append(cap);
  const list=document.createElement('ul');list.className='tech-entries';
  for(const entry of entries){
    const li=document.createElement('li');
    const top=document.createElement('div');top.className='tech-entry-top';
    const name=document.createElement('b');name.textContent=entry.title||'Untitled';
    top.append(name,techTierChip(entry.verification_level));
    const meta=document.createElement('small');
    const typeLabel=state.dashboard?.technical?.typeGuide?.[entry.evidence_type]?.label
      ||(entry.evidence_type||'').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
    meta.textContent=[typeLabel,(entry.skills||[]).join(', ')].filter(Boolean).join(' · ');
    const remove=document.createElement('button');
    remove.type='button';remove.className='tech-entry-remove';remove.textContent='Remove';
    remove.addEventListener('click',async()=>{
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'delete-technical-evidence',id:entry.id})});
        await loadDashboard();
      }catch(error){ remove.textContent=error.message||'Could not remove'; remove.disabled=true; }
    });
    li.append(top,meta,remove);
    list.append(li);
  }
  sec.append(list);root.append(sec);
}

// ── The technical profile (§10) ───────────────────────────────────────────────────────
// Breadth, depth, agency, gaps. Deliberately no headline number: a single "engineering
// quality" figure is the artifact this product exists to replace, and it would sit here more
// naturally than anywhere else on the page, which is exactly why it is worth refusing.
//
// Every row states what backs it, so a company reading over a student's shoulder can see the
// difference between a skill that was typed and one that came out of a connected repo.
const TIER_LABEL={trial:'Accepted trial',referral:'Referred',artifact:'Artifact',claimed:'Self-reported'};

function techTierChip(tier){
  const el=document.createElement('span');
  el.className='tech-tier is-'+tier;
  el.textContent=TIER_LABEL[tier]||tier;
  return el;
}

// ── Finance evidence (§20) ────────────────────────────────────────────────────────────
// The graph, the table and the routes shipped without this, so a finance student could not add
// a single artifact. The server accepted it; nothing asked for it.
//
// The artifact list comes from the dashboard payload rather than being duplicated here. Twelve
// type names in two files is how the limit shown to a student stops matching the one a reviewer
// reads, which is the exact drift the type guide was added to prevent.
function financeGuide(){ return state.dashboard?.finance?.artifactGuide||{}; }

function paintFinanceType(){
  const guide=financeGuide();
  const entry=guide[$('#financeType')?.value];
  const explain=$('#financeTypeExplain');
  const limit=$('#financeTypeLimit');
  if(explain) explain.textContent=entry?.demonstrates||'';
  // The limit is shown next to the field, not buried in a footnote. Every artifact type has one
  // and a student who knows it going in defends better than one who is told afterwards.
  if(limit) limit.textContent=entry?.cannotShow?('What it cannot show: '+entry.cannotShow):'';
}

function openFinanceEvidence(){
  const dlg=$('#financeEvidenceDialog'); if(!dlg)return;
  const typeSelect=$('#financeType');
  const guide=financeGuide();
  if(typeSelect){
    typeSelect.replaceChildren();
    for(const [value,entry] of Object.entries(guide)){
      const o=document.createElement('option');o.value=value;o.textContent=entry.label;typeSelect.append(o);
    }
  }
  setDialogMessage('#financeEvidenceMessage','');
  paintFinanceType();
  dlg.showModal();
}

function readFinanceEvidence(form){
  const data=Object.fromEntries(new FormData(form).entries());
  return {
    action:'save-finance-evidence',
    type:data.type,
    subject:data.subject,
    title:data.title||null,
    pointer:data.pointer||null,
    asOf:data.asOf||null,
    skills:String(data.skills||'').split(',').map(x=>x.trim()).filter(Boolean),
    thesis:data.thesis||null,
    downside:data.downside||null,
    published:Boolean(data.published),
  };
}

$('#financeType')?.addEventListener('change',paintFinanceType);

$('#financeEvidenceForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.target;
  setDialogMessage('#financeEvidenceMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify(readFinanceEvidence(form))});
    // Same as the technical dialog: the ownership questions come back from the server so the
    // student sees what a reviewer will ask before the dialog closes.
    if((out.questions||[]).length){
      setDialogMessage('#financeEvidenceMessage','Added. At defense you will be asked: '+out.questions[0]);
      window.setTimeout(()=>$('#financeEvidenceDialog').close(),2600);
    } else { $('#financeEvidenceDialog').close(); }
    await loadDashboard();
  }catch(error){ setDialogMessage('#financeEvidenceMessage',error.message,true); }
});

function renderFinanceEntries(root,d){
  const entries=d?.finance?.entries||[];
  if(!entries.length)return;
  const guide=financeGuide();
  const sec=document.createElement('div');sec.className='tech-section';
  const cap=document.createElement('h4');cap.textContent='Work you added';
  sec.append(cap);
  const list=document.createElement('ul');list.className='tech-entries';
  for(const entry of entries){
    const li=document.createElement('li');
    const top=document.createElement('div');top.className='tech-entry-top';
    const name=document.createElement('b');name.textContent=entry.title||entry.subject||'Untitled';
    top.append(name,techTierChip(entry.verification_level));
    const meta=document.createElement('small');
    meta.textContent=[guide[entry.artifact_type]?.label,entry.subject,entry.as_of].filter(Boolean).join(' · ');
    const remove=document.createElement('button');
    remove.type='button';remove.className='tech-entry-remove';remove.textContent='Remove';
    remove.addEventListener('click',async()=>{
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'delete-finance-evidence',id:entry.id})});
        await loadDashboard();
      }catch(error){ remove.textContent=error.message||'Could not remove'; remove.disabled=true; }
    });
    li.append(top,meta,remove);
    list.append(li);
  }
  sec.append(list);root.append(sec);
}

// ── Live open roles (§30) ─────────────────────────────────────────────────────────────
// The first thing in this portal that is not Covenda's own inventory. Pulled nightly from
// company job boards, ranked against what the student has listed and shown.
//
// The fit number gets the same treatment as everywhere else: it is stated to be arithmetic
// rather than a model, the components are one click away, and there is no probability of any
// kind attached to it, because nothing has been placed yet and a probability would be invented.
// The company's own mark, with initials behind it.
//
// Source is Google's favicon service rather than Clearbit: Clearbit's logo API is gone (the
// endpoint no longer resolves), and a company's own favicon is the one asset that is reliably
// public, correctly sized, and served by somebody whose job is serving it.
//
// referrerpolicy="no-referrer" so the request does not tell Google which page a student is on.
//
// ── DECIDED: real marks stay ──────────────────────────────────────────────────────────
// This was raised twice and settled twice, so it is not an open question. The blueprint's
// rule 14 says not to imply a company is a partner without a relationship; the founder's call
// is that real marks stay, and the line under the list ("These are public postings, not
// Covenda partners") is what keeps that rule satisfied rather than the absence of logos.
// That sentence is therefore load-bearing, not decoration: it is the reason this is allowed.
// A test asserts it survives. Do not remove either half without raising it again.
//
// The monogram is not a fallback bolted on afterwards; it is what the tile IS, with the logo
// painted over it. So a blocked request, an ad blocker, or a company with no favicon degrades
// to the initial rather than to an empty square.
function companyMark(name, domain){
  const el=document.createElement('span');el.className='role-mark';
  const words=String(name||'?').replace(/[^A-Za-z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  const initials=(words.length>1?words[0][0]+words[1][0]:(words[0]||'?')[0]||'?').toUpperCase();
  el.textContent=initials;
  el.setAttribute('aria-hidden','true');
  if(!domain)return el;
  const img=document.createElement('img');
  img.className='role-logo';
  img.src=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  img.alt='';
  img.width=22;img.height=22;
  img.loading='lazy';
  img.decoding='async';
  img.referrerPolicy='no-referrer';
  img.addEventListener('error',()=>img.remove(),{once:true});
  el.append(img);
  return el;
}

// One row builder, used by the default list and by the resume result. Two builders is how the
// two lists start disagreeing about what a role looks like.
function roleRow(role,r){
  const li=document.createElement('li');li.className='role';
  const a=document.createElement('a');a.className='role-link';
  a.href=role.url||'#';a.target='_blank';a.rel='noopener noreferrer';
  a.append(companyMark(role.company,(r.domains||{})[role.board_token]));
  const body=document.createElement('span');body.className='role-body';
  const title=document.createElement('span');title.className='role-title';title.textContent=role.title;
  const meta=document.createElement('small');meta.className='role-meta';
  const where=String(role.location||'').split(/;|\u2022/)[0].trim();
  meta.textContent=[role.company,where,role.remote?'Remote':null].filter(Boolean).join(' · ');
  if(role.location&&role.location!==where)meta.title=role.location;
  body.append(title,meta);a.append(body);
  if(role.fit&&role.fit.score!==null&&role.fit.score!==undefined){
    const fit=document.createElement('span');fit.className='role-fit';
    const num=document.createElement('b');num.textContent=String(role.fit.score);
    const cap=document.createElement('small');cap.textContent='fit';
    fit.append(num,cap);fit.title=role.fit.why||'';
    a.append(fit);
  }
  li.append(a);return li;
}

function renderOpenRoles(root,d){
  const r=d?.roles; if(!r)return;
  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Open roles';
  const sub=document.createElement('p');
  head.append(h,sub);panel.append(head);

  const items=r.items||[];
  if(!items.length){
    sub.textContent=r.note||'Nothing on the boards right now.';
    // An empty list with no way to act on it reads as broken. This pulls the boards now rather
    // than waiting for the overnight job, which is the difference between "nothing yet" and
    // "nothing, and no way to find out".
    // The empty state was a large blank card with a lone centred button and an error line
    // floating under it, which read as breakage rather than as "nothing yet". Grouped into one
    // block so the sentence, the action and any result sit together and the card sizes to them.
    const empty=document.createElement('div');empty.className='role-empty';
    const pull=document.createElement('button');
    pull.type='button';pull.className='portal-secondary compact';pull.textContent='Check the boards now';
    const note=document.createElement('p');note.className='role-match-msg';note.setAttribute('aria-live','polite');
    empty.append(pull,note);
    pull.addEventListener('click',async()=>{
      pull.disabled=true;note.textContent='Reading the boards…';
      try{
        const out=await portalRequest({method:'POST',body:JSON.stringify({action:'refresh-roles'})});
        if(out.skipped){ note.textContent=out.reason; pull.disabled=false; return; }
        note.textContent=`Found ${out.found}, wrote ${out.written}.`;
        await loadDashboard();
      }catch(error){ note.textContent=error.message; pull.disabled=false; }
    });
    panel.append(empty);
    root.append(panel);return;
  }
  sub.textContent=`${r.total} open student ${r.total===1?'role':'roles'} on the boards we watch.`;

  // Paste a resume and the list re-ranks against it. This is the entry point the panel was
  // missing: fit was computed from skills a student had already typed into their profile, so a
  // student who had typed nothing saw nothing, which is exactly the student it should help.
  const box=document.createElement('div');box.className='role-match';
  const ta=document.createElement('textarea');
  ta.className='role-match-input';ta.rows=3;ta.maxLength=20000;
  ta.placeholder='Paste your resume to see which of these you already line up with.';
  const go=document.createElement('button');go.type='button';go.className='portal-ghost compact';
  go.textContent='Find matches';
  const msg=document.createElement('p');msg.className='role-match-msg';msg.setAttribute('aria-live','polite');
  box.append(ta,go,msg);
  panel.append(box);

  const list=document.createElement('ul');list.className='role-list';

  go.addEventListener('click',async()=>{
    msg.textContent='Reading…';
    try{
      const out=await portalRequest({method:'POST',body:JSON.stringify({action:'match-resume',text:ta.value})});
      // What it read is shown before what it concluded. A student who disagrees with the list
      // can see the reason in one line rather than guessing at it.
      msg.textContent=`Read: ${out.skills.join(', ')}. ${out.note}`;
      list.replaceChildren();
      const found=out.matches||[];
      if(!found.length){ msg.textContent+=' Nothing on the boards lines up with that yet.'; return; }
      for(const role of found) list.append(roleRow(role,r));
    }catch(error){ msg.textContent=error.message; }
  });

  for(const role of items) list.append(roleRow(role,r));

  panel.append(list);

  const note=document.createElement('p');note.className='tech-note-line';
  // Stated plainly, because a row of real company marks on a Covenda page reads as a roster of
  // partners and none of these companies has agreed to anything.
  note.textContent=(r.note||'')+' These are public postings, not Covenda partners.';
  panel.append(note);
  root.append(panel);
}


// ── Grouping the student portfolio (§27) ──────────────────────────────────────────────
// It rendered nine panels in a flat stack: credibility, technical evidence, finance evidence,
// compatibility, coursework, simulations, video library, payouts, proof of work. Every one of
// them the same weight, so the tab opened as an undifferentiated column and the thing a
// student actually came for was somewhere down it.
//
// Native <details> rather than a JS accordion: it is keyboard operable, screen-reader
// announced, and findable by browser find-in-page even while closed, none of which a
// div-and-click-handler gets for free.
// One bad field should cost its own section, not the page. The dashboard renders as a single
// uninterrupted pass, so until now a throw anywhere below the first section aborted every
// section after it — that is how `for(const sig of (t.unprompted||[]))` on one profile took the
// whole portal down and surfaced as a sign-in failure.
//
// The section is left visibly broken rather than silently dropped. A section that quietly
// disappears looks like "you have nothing here", which is a lie the student cannot detect and
// nobody reports. The console keeps the real error.
function buildSection(body,build,label){
  try{ build(body); return true; }
  catch(error){
    console.error(`[covenda] section "${label}" failed to render`,error);
    const p=document.createElement('p');p.className='section-error';
    p.textContent='This section could not be displayed. The rest of the page is unaffected.';
    body.append(p);
    return false;
  }
}

function portalGroup(root,title,detail,build,{open=false}={}){
  const box=document.createElement('details');box.className='portal-group';box.open=open;
  const head=document.createElement('summary');
  const label=document.createElement('span');label.className='portal-group-title';label.textContent=title;
  head.append(label);
  if(detail){const d=document.createElement('span');d.className='portal-group-note';d.textContent=detail;head.append(d);}
  box.append(head);
  const body=document.createElement('div');box.append(body);
  buildSection(body,build,title);
  // A group that produced nothing is not shown at all. An empty accordion is worse than a
  // missing one: it reads as broken rather than as not applicable yet.
  if(!body.childElementCount)return;
  root.append(box);
}

// ── Compatibility standing (§26) ──────────────────────────────────────────────────────
// The score was computed, filtered on, and sorted by, and a student could see it only as a
// number on a card with a sentence under it. This is the panel that explains it.
//
// It shows the arithmetic because the arithmetic is the honest part: four components, fixed
// weights, no model. `api/compatibility.js` says in its own header that it is "deterministic
// arithmetic over hand-calibrated constants", so there is nothing to hide behind.
//
// ── WHY THERE IS NO TREND LINE ────────────────────────────────────────────────────────
// Nothing stores a score over time. A chart of the last six weeks would be drawn from data
// that does not exist, so there isn't one. What moves instead, and what this tracks, is the
// split between points bought with typed skills and points bought with evidence.
//
// That split is the whole point. Three of the four components are earned by typing, and a
// tracker that just said "raise your score" would be coaching students to type more skills.
// The evidenced component is the one a company weights, so the panel surfaces the skills
// earning points with nothing behind them, and routes to the evidence forms.
function renderCompatibility(root,d){
  const c=d?.compatibility; if(!c)return;
  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='How you line up';
  const sub=document.createElement('p');
  head.append(h,sub);panel.append(head);

  if(!c.scored){
    sub.textContent=c.note||'Add skills to your profile and every batch will show how it lines up.';
    root.append(panel);return;
  }

  sub.textContent=`Scored against ${c.scored} ${c.scored===1?'batch':'batches'}. Best is ${c.best.name} at ${c.best.score}, median ${c.median}.`;

  // The split. This is the headline, not the score: a student with 80 points of typed skills
  // and 0 of evidence is in a much weaker position than the number suggests.
  const split=document.createElement('div');split.className='compat-split';
  const bar=document.createElement('div');bar.className='compat-bar';bar.setAttribute('aria-hidden','true');
  const total=c.statedPoints+c.evidencedPoints;
  const shown=document.createElement('i');shown.className='is-evidence';
  const typed=document.createElement('i');typed.className='is-stated';
  shown.style.flexGrow=String(c.evidencedPoints||0);
  typed.style.flexGrow=String(c.statedPoints||0);
  bar.append(shown,typed);
  const legend=document.createElement('p');legend.className='compat-legend';
  legend.textContent=total
    ? `${c.evidencedPoints} of your ${total} points are backed by evidence. The rest come from skills you typed.`
    : 'No points yet.';
  split.append(bar,legend);
  panel.append(split);

  // The ceiling, stated plainly. A student should know the evidence component is capped and
  // where they sit against that cap, rather than assuming more evidence always adds more score.
  const ceiling=document.createElement('p');ceiling.className='tech-note-line';
  ceiling.textContent=`Evidence can contribute at most ${c.evidenceCeiling} points across these batches, and you are at ${c.evidencedPoints}. The score is fixed arithmetic over four components, not a model, and no company sees it.`;

  // The route. Each skill here is already earning coverage points on batches with nothing
  // behind it, so one artifact moves several cards at once.
  if(c.unbacked.length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Matched, but nothing behind it';
    const list=document.createElement('ul');list.className='tech-entries';
    for(const item of asList(c.unbacked)){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='tech-entry-top';
      const b=document.createElement('b');b.textContent=item.skill;
      top.append(b,techTierChip('claimed'));
      const meta=document.createElement('small');
      meta.textContent=`Earning points on ${item.batches} ${item.batches===1?'batch':'batches'}. One artifact covers all of them.`;
      li.append(top,meta);list.append(li);
    }
    sec.append(cap,list);panel.append(sec);
  }

  panel.append(ceiling);
  root.append(panel);
}

// ── What to work on, per batch (§39) ──────────────────────────────────────────────────
// Sits directly under "How this score is built", because the score is the claim and this is
// what to do about it. Separating them would mean reading a number on one screen and its
// remedy on another.
//
// Top three expanded, the rest folded. The list is ordered by the batch's own weighting, so
// the first three are the ones that move the number most; twelve rows would be a wall.
function batchReadinessBlock(batch){
  const plan=batch?.readiness;
  if(!plan||!plan.items||!plan.items.length)return null;
  const wrap=document.createElement('div');wrap.className='readiness';

  const head=document.createElement('p');head.className='readiness-standing';
  head.textContent=`${plan.standing.evidenced} of ${plan.standing.total} shown with evidence, ${plan.standing.covered} listed.`;
  wrap.append(head);

  const row=item=>{
    const li=document.createElement('li');li.className='readiness-item is-'+item.have;
    const top=document.createElement('div');top.className='tech-entry-top';
    const b=document.createElement('b');b.textContent=item.skill;
    // "Listed, not shown" is a different job from "not yet", so the chip says which.
    top.append(b,pill(item.have==='stated'?'Listed, not shown':'Not yet','artifact-pill'));
    const build=document.createElement('small');build.className='readiness-build';
    build.textContent=item.build;
    const why=document.createElement('small');why.className='readiness-why';why.textContent=item.why;
    li.append(top,build,why);
    return li;
  };

  const lead=document.createElement('ul');lead.className='tech-entries';
  for(const item of plan.items.slice(0,3)) lead.append(row(item));
  wrap.append(lead);

  const rest=plan.items.slice(3);
  if(rest.length){
    const more=document.createElement('details');more.className='readiness-more';
    const cap=document.createElement('summary');cap.textContent=`${rest.length} more`;
    const list=document.createElement('ul');list.className='tech-entries';
    for(const item of rest) list.append(row(item));
    more.append(cap,list);wrap.append(more);
  }

  const note=document.createElement('p');note.className='readiness-note';
  note.textContent=plan.note;
  wrap.append(note);
  return wrap;
}

// The per-batch breakdown, shown inside a batch's Details panel where the number it explains
// is on screen. Four rows, each with its points, its ceiling, and whether it was bought with
// a typed skill or with evidence.
function batchScoreBreakdown(batch){
  const parts=batch?.compatibility?.components||[];
  if(!parts.length)return null;
  const list=document.createElement('ul');list.className='compat-parts';
  for(const part of parts){
    const li=document.createElement('li');li.className='compat-part is-'+part.backed;
    const top=document.createElement('div');top.className='compat-part-top';
    const name=document.createElement('b');name.textContent=part.label;
    const pts=document.createElement('span');pts.className='compat-part-pts';
    pts.textContent=`${part.points} / ${part.max}`;
    top.append(name,pts);
    const track=document.createElement('span');track.className='compat-part-track';track.setAttribute('aria-hidden','true');
    const fill=document.createElement('i');
    fill.style.width=(part.max?Math.round((part.points/part.max)*100):0)+'%';
    track.append(fill);
    const detail=document.createElement('small');detail.textContent=part.detail;
    li.append(top,track,detail);list.append(li);
  }
  return list;
}

// ── Coursework (§25) ──────────────────────────────────────────────────────────────────
// The panel a student sees for the thing they already have. It leads with the to-build list
// rather than the course list, because the courses are the input and the build list is the
// product. A panel that led with "6 courses" would be a transcript with a nicer font.
//
// No grade field anywhere in here, and none is asked for. The model has no way to check one
// and the table has no column to hold it, so a field for it would be collecting something
// that could only ever be decoration or a lie.
function courseGuide(){ return state.dashboard?.coursework?.courseGuide||{}; }

// Populates the datalist from the payload rather than a second copy of the course list here.
// Thirty-two course names in two files is how the list a student picks from stops matching
// the one the server accepts.
function paintCourseOptions(){
  const list=$('#courseTitleOptions'); if(!list)return;
  list.replaceChildren();
  for(const entry of Object.values(courseGuide())){
    const o=document.createElement('option');o.value=entry.label;list.append(o);
  }
}

// Fires on change rather than on input: one request when an entry is finished, not one per
// keystroke. The student learns what the course cannot show BEFORE they save it, which is the
// whole point of showing it at all.
async function previewCourseTitle(){
  const input=$('#courseTitle');
  const explain=$('#courseExplain');
  const limit=$('#courseLimit');
  if(!input||!explain||!limit)return;
  const title=input.value.trim();
  explain.textContent='';limit.textContent='';
  if(!title)return;
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({action:'preview-course',title})});
    if(!out.matched){
      explain.textContent='Covenda has no mapping for that one yet, so it cannot be added.';
      return;
    }
    explain.textContent=out.demonstrates||'';
    limit.textContent=out.cannotShow?('What it cannot show: '+out.cannotShow):'';
  }catch(error){ explain.textContent=error.message; }
}

function openCoursework(){
  const dlg=$('#courseworkDialog'); if(!dlg)return;
  paintCourseOptions();
  const input=$('#courseTitle'); if(input) input.value='';
  $('#courseExplain').textContent='';
  $('#courseLimit').textContent='';
  setDialogMessage('#courseworkMessage','');
  dlg.showModal();
}

$('#courseTitle')?.addEventListener('change',previewCourseTitle);

$('#courseworkForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target).entries());
  setDialogMessage('#courseworkMessage','');
  try{
    const out=await portalRequest({method:'POST',body:JSON.stringify({action:'save-coursework',title:data.title})});
    // The limit is repeated on the way out, not only on the way in. It is the sentence a
    // student needs when a company asks about the course, so it is worth reading twice.
    if(out.cannotShow){
      setDialogMessage('#courseworkMessage','Added. What it cannot show: '+out.cannotShow);
      window.setTimeout(()=>$('#courseworkDialog').close(),3200);
    } else { $('#courseworkDialog').close(); }
    await loadDashboard();
  }catch(error){ setDialogMessage('#courseworkMessage',error.message,true); }
});

function renderCoursework(root,d){
  const c=d?.coursework; if(!c)return;
  const courses=c.courses||[];
  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Coursework';
  const sub=document.createElement('p');
  head.append(h,sub);panel.append(head);

  if(!courses.length){
    sub.textContent='Add the courses you have taken and Covenda turns each one into the work that would prove it.';
    const add=document.createElement('button');
    add.type='button';add.className='portal-primary compact tech-add';
    add.textContent='Add your first course';
    add.addEventListener('click',openCoursework);
    panel.append(add);root.append(panel);return;
  }

  const plan=c.proving?.plan||[];
  const total=c.proving?.total||0;
  sub.textContent=`${courses.length} ${courses.length===1?'course':'courses'}, none of which counts as evidence yet. That is what the list below is for.`;

  // The to-build list first. This is the output the ontology exists to produce: every
  // competency a course exposed, and the specific work that would move it off self-reported.
  if(plan.length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='What would prove it';
    const list=document.createElement('ul');list.className='tech-entries';
    for(const item of plan){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='tech-entry-top';
      const b=document.createElement('b');b.textContent=item.label;
      top.append(b,techTierChip('claimed'));
      const build=document.createElement('small');build.textContent=item.build;
      li.append(top,build);list.append(li);
    }
    sec.append(cap,list);
    if(total>plan.length){
      // Never a silent truncation. A list that quietly stopped at eight would read as the
      // whole gap when it is not.
      const more=document.createElement('small');more.className='tech-more';
      more.textContent=`Showing ${plan.length} of ${total}.`;
      sec.append(more);
    }
    panel.append(sec);
  }

  // The courses themselves, second and plainer. They are the input, not the achievement.
  const guide=courseGuide();
  const sec=document.createElement('div');sec.className='tech-section';
  const cap=document.createElement('h4');cap.textContent='Courses you listed';
  const list=document.createElement('ul');list.className='tech-entries';
  for(const course of courses){
    const li=document.createElement('li');
    const top=document.createElement('div');top.className='tech-entry-top';
    const name=document.createElement('b');name.textContent=course.course_title;
    top.append(name,techTierChip('claimed'));
    const meta=document.createElement('small');
    meta.textContent=guide[course.course_kind]?.cannotShow?('Cannot show: '+guide[course.course_kind].cannotShow):'';
    const remove=document.createElement('button');
    remove.type='button';remove.className='tech-entry-remove';remove.textContent='Remove';
    remove.addEventListener('click',async()=>{
      try{
        await portalRequest({method:'POST',body:JSON.stringify({action:'delete-coursework',id:course.id})});
        await loadDashboard();
      }catch(error){ remove.textContent=error.message||'Could not remove'; remove.disabled=true; }
    });
    li.append(top,meta,remove);list.append(li);
  }
  sec.append(cap,list);panel.append(sec);

  const note=document.createElement('p');note.className='tech-note-line';
  note.textContent=c.profile?.note||'';
  panel.append(note);

  const add=document.createElement('button');
  add.type='button';add.className='portal-ghost compact tech-add';
  add.textContent='Add another course';
  add.addEventListener('click',openCoursework);
  panel.append(add);
  root.append(panel);
}

// The same artifacts read differently depending on who is reading. This is the one place a
// student can see that: pick a firm type and the profile reorders, with nothing hidden.
function renderFinanceProfile(root,d){
  const f=d?.finance; if(!f)return;
  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Finance evidence';
  const sub=document.createElement('p');
  head.append(h,sub);panel.append(head);

  if(!f.artifactCount){
    sub.textContent='Nothing here yet. A stock pitch with a stated downside is the fastest thing to add.';
    const add=document.createElement('button');
    add.type='button';add.className='portal-primary compact tech-add';
    add.textContent='Add your first artifact';
    add.addEventListener('click',openFinanceEvidence);
    panel.append(add);root.append(panel);return;
  }

  sub.textContent=`${f.artifactCount} ${f.artifactCount===1?'artifact':'artifacts'}, covering ${f.disciplinesCovered} of ${f.disciplinesAvailable} disciplines. ${f.defended} defended on the record.`;

  // Who is reading. Non-binding by construction: it changes the order, never eligibility.
  const firmRow=document.createElement('div');firmRow.className='tech-section';
  const firmCap=document.createElement('h4');firmCap.textContent='Read it as';
  const select=document.createElement('select');select.className='finance-firm-select';
  const none=document.createElement('option');none.value='';none.textContent='As I built it';select.append(none);
  for(const firm of asList(f.firmTypes)){
    const o=document.createElement('option');o.value=firm.id;o.textContent=firm.label;
    if(firm.id===f.targetFirmType)o.selected=true;
    select.append(o);
  }
  select.addEventListener('change',async()=>{
    try{
      await portalRequest({method:'POST',body:JSON.stringify({action:'target-firm-type',firmType:select.value||null})});
      await loadDashboard();
    }catch(error){ sub.textContent=error.message; }
  });
  const firmNote=document.createElement('small');
  firmNote.textContent=f.emphasis?.note||'';
  firmRow.append(firmCap,select,firmNote);panel.append(firmRow);

  // What that firm reads first, then everything else. Nothing is hidden by the reordering: an
  // artifact a firm does not weight still appears, it just stops being the headline.
  if((f.emphasis?.leads||[]).length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Read first';
    const list=document.createElement('ul');list.className='tech-entries';
    for(const lead of asList(f.emphasis.leads)){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='tech-entry-top';
      const b=document.createElement('b');b.textContent=`${lead.label}${lead.count>1?` × ${lead.count}`:''}`;
      top.append(b);
      const why=document.createElement('small');why.textContent=lead.why;
      li.append(top,why);list.append(li);
    }
    sec.append(cap,list);panel.append(sec);
  }
  if((f.emphasis?.alsoHas||[]).length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Also on your profile';
    const chips=document.createElement('div');chips.className='skills';
    for(const item of asList(f.emphasis.alsoHas)) chips.append(pill(`${item.label}${item.count>1?` × ${item.count}`:''}`,'artifact-pill'));
    sec.append(cap,chips);panel.append(sec);
  }

  // Gaps name the next artifact to build. A gap with no route attached is a rejection with
  // extra words, which is why every one of these carries an ask.
  if((f.gaps||[]).length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='What to add next';
    const list=document.createElement('ul');list.className='tech-gaps';
    for(const gap of asList(f.gaps)){const li=document.createElement('li');li.textContent=gap.ask;list.append(li);}
    sec.append(cap,list);panel.append(sec);
  }

  renderFinanceEntries(panel,d);

  const add=document.createElement('button');
  add.type='button';add.className='portal-ghost compact tech-add';
  add.textContent='Add another artifact';
  add.addEventListener('click',openFinanceEvidence);
  panel.append(add);
  root.append(panel);
}

// ── Software & AI vertical dashboard (§36) ────────────────────────────────────────────
// The reference implementation the blueprint asks for: breadth, depth, agency, builder
// history, AI engineering, collaboration, verification, gaps, and the next thing to build.
//
// There is deliberately no engineering quality score. Nine dimensions reported separately is
// the whole point: a single number would be the thing the document forbids, and it would also
// be unearned, because nothing has been placed and there is no outcome to calibrate against.
//
// Every section states its own absence rather than disappearing when empty. A dashboard that
// hides what you have not done yet reads as complete when it is not.
function techSection(title, build, emptyText){
  const sec=document.createElement('div');sec.className='tech-section';
  const cap=document.createElement('h4');cap.textContent=title;
  sec.append(cap);
  const body=document.createElement('div');
  // A failed section must not be mistaken for an empty one: emptyText says "nothing here yet",
  // which is the opposite of what a crash means. Only fall through to it when the build
  // actually succeeded and produced nothing.
  const built=buildSection(body,build,title);
  if(built&&!body.childElementCount){
    const p=document.createElement('p');p.className='tech-empty';p.textContent=emptyText;
    body.append(p);
  }
  sec.append(body);
  return sec;
}

function renderTechnicalVertical(root,d){
  const t=d?.technical;
  if(!t||d?.profile?.role!=='student')return;
  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Technical profile';
  const sub=document.createElement('p');
  sub.textContent='Nine readings, reported separately. There is no single engineering score, and there will not be one.';
  head.append(h,sub);panel.append(head);

  // Breadth: surface area, not a rank. Covenda has no population to rank against.
  panel.append(techSection('Technical breadth',body=>{
    if(!(t.breadth||[]).length)return;
    const chips=document.createElement('div');chips.className='skills';
    for(const dom of asList(t.breadth)) chips.append(pill(`${dom.label} · ${dom.evidencedCount||dom.count||0}`,'artifact-pill'));
    body.append(chips);
    const n=document.createElement('small');n.className='tech-sub';
    n.textContent=`${t.domainsTouched} of ${t.domainsAvailable} domains touched.`;
    body.append(n);
  },'No domains evidenced yet.'));

  // Depth: the strongest verified capabilities, with the tier that backs each one.
  panel.append(techSection('Technical depth',body=>{
    const list=document.createElement('ul');list.className='tech-entries';
    for(const item of (t.depth||[]).slice(0,6)){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='tech-entry-top';
      const b=document.createElement('b');b.textContent=item.skill||item.label;
      top.append(b,techTierChip(item.tier||'claimed'));
      li.append(top);
      if(item.why){const s2=document.createElement('small');s2.textContent=item.why;li.append(s2);}
      list.append(li);
    }
    if(list.childElementCount)body.append(list);
  },'Nothing has risen above self-reported yet.'));

  // Agency: what was started without being asked.
  panel.append(techSection('Agency',body=>{
    const bits=[];
    if(t.repeatedBuilder)bits.push('Built more than once');
    if(t.ownedOutright)bits.push(`${t.ownedOutright} owned outright`);
    // unpromptedBuild returns ONE object describing the agency dimension — { tier, band, count,
    // repeated, ... } — not a list of signals. Iterating it threw, and threw for every student
    // who reached this section, not just one with odd data. asList() stopped the crash but read
    // the object as an empty list, so the section went quietly blank instead. Neither is right:
    // the data was always there and always shaped like this.
    const u=t.unprompted;
    if(u&&u.tier&&u.tier!=='none'){
      if(u.band&&u.band.label)bits.push(u.band.label);
      // `repeated` duplicates repeatedBuilder above, so it is deliberately not repeated here.
      if(u.count)bits.push(`${u.count} built without being asked`);
    }
    if(!bits.length)return;
    const chips=document.createElement('div');chips.className='skills';
    for(const b of bits) chips.append(pill(b,'artifact-pill'));
    body.append(chips);
  },'Nothing yet shows work started without being asked.'));

  // Builder history: the sequence, which is what shows whether somebody kept going.
  panel.append(techSection('Builder history',body=>{
    const items=t.history?.items||[];
    if(!items.length)return;
    const list=document.createElement('ul');list.className='tech-entries';
    for(const item of items.slice(0,10)){
      const li=document.createElement('li');
      const top=document.createElement('div');top.className='tech-entry-top';
      const b=document.createElement('b');b.textContent=item.title;
      top.append(b,techTierChip(item.tier));
      const meta=document.createElement('small');
      meta.textContent=[item.typeLabel,item.at?new Date(item.at).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'No date given'].join(' · ');
      li.append(top,meta);list.append(li);
    }
    body.append(list);
  },'Nothing shipped has been recorded yet.'));

  // AI engineering: what was AI-assisted and whether the student can account for it.
  panel.append(techSection('AI engineering',body=>{
    if(!t.aiAssisted)return;
    const p=document.createElement('p');p.className='tech-sub';
    p.textContent=`${t.aiAssisted} ${t.aiAssisted===1?'entry discloses':'entries disclose'} AI assistance. What counts is the account of what you changed and why, not whether a tool was used.`;
    body.append(p);
  },'No AI-assisted work disclosed. Disclosing it is not a penalty.'));

  // Collaboration: derived from the evidence, not asked for as a checkbox.
  panel.append(techSection('Collaboration',body=>{
    const kinds=t.collaboration?.kinds||[];
    if(!kinds.length)return;
    const chips=document.createElement('div');chips.className='skills';
    for(const k of kinds) chips.append(pill(`${k.label} · ${k.count}`,'artifact-pill'));
    body.append(chips);
  },(t.collaboration&&t.collaboration.note)||'Nothing here yet shows work done with other people.'));

  // Verification: the honest split.
  panel.append(techSection('Verification',body=>{
    const p=document.createElement('p');p.className='tech-sub';
    const total=(t.entries||[]).length||t.history?.count||0;
    p.textContent=`${t.unverified||0} of your claims are still self-reported. Self-reported is excluded from matching.`;
    body.append(p);
  },'Nothing recorded yet.'));

  // Gaps: every one carries a route, or it is a rejection with extra words.
  panel.append(techSection('Current gaps',body=>{
    const gaps=t.gaps||[];
    if(!gaps.length)return;
    const list=document.createElement('ul');list.className='tech-gaps';
    for(const g of gaps){const li=document.createElement('li');li.textContent=g.ask||g;list.append(li);}
    body.append(list);
  },'No gaps identified yet, which usually means there is not enough here to read.'));

  const note=document.createElement('p');note.className='tech-note-line';
  note.textContent='Reported as nine separate readings on purpose. A single score would hide which part of it you would need to argue with.';
  panel.append(note);
  root.append(panel);
}

function renderTechnicalProfile(root,d){
  const t=d?.technical;
  if(!t||d?.profile?.role!=='student')return;
  // An empty framework reads as a broken feature, so when there is nothing yet the panel
  // collapses to the one thing that matters: the way to add the first piece. Returning early
  // here would have hidden the Add button from exactly the students who need it.
  const empty=!t.breadth.length&&!t.depth.length&&!(t.entries||[]).length;

  const panel=document.createElement('section');panel.className='panel-card tech-panel';
  const head=document.createElement('div');head.className='tech-head';
  const h=document.createElement('h3');h.textContent='Technical profile';
  const sub=document.createElement('p');
  sub.textContent=`Built from what you have connected, not from what you listed. ${t.domainsTouched} of ${t.domainsAvailable} domains have evidence behind them.`;
  head.append(h,sub);panel.append(head);

  if(empty){
    sub.textContent='Nothing here yet. Add a project, a hackathon, or a pull request and this fills in.';
    const add=document.createElement('button');
    add.type='button';add.className='portal-primary compact tech-add';
    add.textContent='Add your first evidence';
    add.addEventListener('click',openTechEvidence);
    panel.append(add);root.append(panel);return;
  }

  // Breadth: the surface area, as a bar per domain. Not a ranking against anyone.
  if(t.breadth.length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Surface area';
    sec.append(cap);
    const list=document.createElement('ul');list.className='tech-domains';
    // Drawn from EVIDENCED skills only, so typing more never widens the bar.
    const widest=Math.max(1,...t.breadth.map(x=>x.evidencedCount));
    for(const domain of asList(t.breadth)){
      const li=document.createElement('li');li.className='tech-domain is-'+domain.best;
      const name=document.createElement('b');name.textContent=domain.domain;
      const bar=document.createElement('span');bar.className='tech-bar';
      const fill=document.createElement('i');
      fill.style.width=Math.round((domain.evidencedCount/widest)*100)+'%';
      bar.append(fill);
      const skills=document.createElement('small');
      // A domain reports its BEST tier, so a mixed list would make a typed skill look backed
      // by standing next to a verified one. The two are labelled apart.
      if(domain.evidenced.length){
        const shown=document.createElement('span');shown.textContent=domain.evidenced.join(', ');
        skills.append(shown);
      }
      if(domain.claimedOnly.length){
        const only=document.createElement('span');only.className='tech-listed';
        only.textContent=(domain.evidenced.length?' · ':'')+'listed only: '+domain.claimedOnly.join(', ');
        skills.append(only);
      }
      li.append(name,bar,techTierChip(domain.best),skills);
      list.append(li);
    }
    sec.append(list);panel.append(sec);
  }

  // Depth: strongest evidence per skill. Self-reported never appears here by construction.
  if(t.depth.length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Backed by evidence';
    const why=document.createElement('p');why.className='tech-why';
    why.textContent='Skills something can be pointed at. A skill you listed but have not shown does not appear here.';
    sec.append(cap,why);
    const list=document.createElement('ul');list.className='tech-depth';
    for(const item of t.depth.slice(0,12)){
      const li=document.createElement('li');
      const name=document.createElement('b');name.textContent=item.skill;
      li.append(name,techTierChip(item.tier));
      if(item.type){const from=document.createElement('small');from.textContent=item.type.replace(/_/g,' ');li.append(from);}
      list.append(li);
    }
    sec.append(list);panel.append(sec);
  }

  // Builder history, as counts of PROJECTS rather than of skills.
  const types=Object.entries(t.evidenceTypes||{});
  if(types.length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='What you have built';
    sec.append(cap);
    const row=document.createElement('div');row.className='tech-types';
    for(const [type,count] of types.sort((a,b)=>b[1]-a[1])){
      const chip=document.createElement('span');chip.className='tech-type';
      const n=document.createElement('b');n.textContent=String(count);
      const label=document.createElement('span');label.textContent=type.replace(/_/g,' ');
      chip.append(n,label);row.append(chip);
    }
    sec.append(row);
    if(t.repeatedBuilder){
      const note=document.createElement('p');note.className='tech-note is-good';
      note.textContent='More than one thing built and finished. That is a pattern rather than a single good term.';
      sec.append(note);
    }
    panel.append(sec);
  }

  renderTechEntries(panel,d);

  // Always available, including when the panel is otherwise empty, because adding the first
  // piece of evidence is the whole point of the panel existing.
  const add=document.createElement('button');
  add.type='button';add.className='portal-ghost compact tech-add';
  add.textContent='Add evidence';
  add.addEventListener('click',openTechEvidence);
  panel.append(add);

  // Gaps, phrased as the next thing to get.
  if((t.gaps||[]).length){
    const sec=document.createElement('div');sec.className='tech-section';
    const cap=document.createElement('h4');cap.textContent='Not shown yet';
    const why=document.createElement('p');why.className='tech-why';
    why.textContent='Nothing here counts against you. It is what a company cannot see yet.';
    sec.append(cap,why);
    const list=document.createElement('ul');list.className='tech-gaps';
    for(const gap of asList(t.gaps)){const li=document.createElement('li');li.textContent=gap.ask;list.append(li);}
    sec.append(list);panel.append(sec);
  }

  root.append(panel);
}

function renderCredibility(root,d){
  const p=d?.profile; if(p?.role!=='student') return;
  const completed=(d.projects||[]).filter(x=>x.status==='complete').length;
  const ghSkills=githubSkills(p).length;
  const v=d.verification||{};
  const held=key=>Boolean(asList(v.signals).find(x=>x.key===key)?.held);
  const vouched=held('club')||held('referral');

  // Ordered by what a company weighs, not by what is easy to get. `weight` is that ordering
  // made visible, and `action` is what the row is for — a list of things you are missing with
  // no way to act on any of them is just a scolding.
  const signals=[
    { key:'work', weight:5,
      ok:completed>0,
      on:`${completed} accepted ${completed===1?'deliverable':'deliverables'}`,
      off:'No accepted work yet',
      todo:'Complete a trial',
      note:completed>0?'A company reviewed this work and accepted it. It is the strongest thing on your profile.'
                      :'This is what companies look for first. Everything else is a proxy for it.',
      go:{view:'discover',label:'Find a project'} },
    { key:'vouch', weight:4,
      ok:vouched,
      on:held('referral')?'A named referral stands behind you':'A club confirmed you',
      off:'Nobody has vouched for you yet',
      todo:'Get one vouch',
      note:vouched?'Someone put their own name behind you, and companies can see whose.'
                  :'A profile with no vouch reads as unverified, whatever else is on it.',
      go:{view:'portfolio',label:'Add a referral'} },
    { key:'code', weight:3,
      ok:ghSkills>0,
      on:`${ghSkills} skill${ghSkills===1?'':'s'} evidenced from real code`,
      off:'No code analysed',
      todo:'Link a repository',
      note:ghSkills>0?'Drawn from repositories you linked, not self-reported.'
                     :'Self-reported skills carry no weight here. Analysed code does.',
      go:{view:'portfolio',label:'Link GitHub'} },
    { key:'profile', weight:2,
      ok:profileCompletion(p)>=100,
      on:'Profile reads complete',
      off:`Profile is ${profileCompletion(p)}% filled in`,
      todo:'Finish your profile',
      note:profileCompletion(p)>=100?'Headline, context, and skills are all there.'
                                    :'Gaps here are the first thing a reader notices.',
      go:{view:'portfolio',label:'Edit profile'} },
  ];
  const met=signals.filter(x=>x.ok).length;
  const earned=signals.filter(x=>x.ok).reduce((n,x)=>n+x.weight,0);
  const total=signals.reduce((n,x)=>n+x.weight,0);
  // The single highest-weight thing still missing. One next step beats four.
  const next=signals.filter(x=>!x.ok).sort((a,b)=>b.weight-a.weight)[0]||null;

  const sec=document.createElement('section');sec.className='cred-meter';
  const head=document.createElement('div');head.className='cred-meter-head';
  const box=document.createElement('div');
  const h=document.createElement('h3');h.textContent='What a company sees';
  const sub=document.createElement('p');sub.className='cred-meter-sub';
  sub.textContent=met===0
    ? 'Nothing on your profile is verified yet. One thing changes that.'
    : met===signals.length ? 'Everything a company checks, you have.'
    : 'How your profile reads today.';
  box.append(h,sub);

  // A ring rather than a fraction: weighted, so finishing the profile does not look like the
  // same win as landing accepted work.
  const ring=document.createElement('div');ring.className='cred-ring';
  const pct=Math.round((earned/total)*100);
  ring.style.setProperty('--pct',String(pct));
  const rn=document.createElement('strong');rn.textContent=`${met}/${signals.length}`;
  ring.append(rn);
  head.append(box,ring);sec.append(head);

  if(next){
    // The quest. Promoted out of the list because a ranked list still reads as four chores.
    const up=document.createElement('div');up.className='cred-next';
    const cap=document.createElement('p');cap.className='cred-next-cap';cap.textContent='Do this next';
    const t=document.createElement('strong');t.textContent=next.todo;
    const why=document.createElement('p');why.className='cred-next-why';why.textContent=next.note;
    const btn=document.createElement('button');btn.type='button';btn.className='cred-next-go';
    btn.textContent=next.go.label;
    btn.addEventListener('click',()=>setView(next.go.view));
    // Weight, stated. A student deserves to know why this one is first.
    const w=document.createElement('span');w.className='cred-next-weight';
    w.textContent=`Counts most${signals.filter(x=>!x.ok).length>1?` of the ${signals.filter(x=>!x.ok).length} left`:''}`;
    up.append(cap,t,why,btn,w);
    sec.append(up);
  }

  const list=document.createElement('ul');list.className='cred-meter-list';
  signals.forEach(sig=>{
    const li=document.createElement('li');li.className=sig.ok?'is-met':'';
    if(next&&sig.key===next.key)li.classList.add('is-next');
    const mark=document.createElement('span');mark.className='cred-mark';
    mark.textContent=sig.ok?'✓':'';
    const div=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=sig.ok?sig.on:sig.off;
    const small=document.createElement('small');small.textContent=sig.note;
    div.append(strong,small);
    li.append(mark,div);
    // Every row goes somewhere. Even a met one — a student who landed a deliverable should be
    // able to click through and look at it.
    const go=document.createElement('button');go.type='button';go.className='cred-row-go';
    go.setAttribute('aria-label',`${sig.ok?sig.on:sig.todo} — open`);
    go.textContent='›';
    go.addEventListener('click',()=>setView(sig.go.view));
    li.append(go);
    list.append(li);
  });
  sec.append(list);

  const note=document.createElement('p');note.className='cred-meter-note';
  note.textContent='Every line is a fact a company can check.';
  sec.append(note);
  root.append(sec);
}

// Skill-inference (GitHub): link a public repo -> per-skill scores with evidence. Scores from
// code alone are anchored by trials + referrals, never proof on their own (anti-gaming).
// Call the GitHub connector endpoint with the member's auth (separate route from /api/portal).
async function connectGithubRequest(action, options={}){
  const response=await fetch(`/api/connect-github?action=${action}`,{...options,headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});
  const result=await response.json().catch(()=>({ok:false,error:'Unreadable response.'}));
  if(!response.ok||!result.ok)throw new Error(result.error||'GitHub connection failed.');
  return result;
}
// OWNERSHIP banner: connect your own GitHub account so owned repos read as "verified account"
// rather than just a "linked repo". Read-only, revocable.
function githubConnectBanner(){
  const banner=document.createElement('div');banner.className='gh-connect';
  const paint=(connected,login)=>{
    banner.replaceChildren();banner.dataset.connected=connected?'1':'0';
    const left=document.createElement('div');left.className='gh-connect-copy';
    const badge=document.createElement('span');badge.className='gh-badge '+(connected?'is-verified':'is-linked');badge.textContent=connected?'✓ Verified account':'Linked repos only';
    const txt=document.createElement('p');txt.textContent=connected?`Connected as @${login}. Repos you own read as verified, proof you can't fake by pasting someone else's link.`:'Connect your own GitHub account so repos you own are ownership-verified, not just linked. Read-only, revocable anytime.';
    left.append(badge,txt);
    const btn=document.createElement('button');btn.type='button';btn.className=connected?'portal-secondary compact':'portal-primary compact';btn.textContent=connected?'Disconnect':'Verify with GitHub';
    btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try{
        if(connected){await connectGithubRequest('disconnect',{method:'GET'});paint(false,null);}
        else{const {url}=await connectGithubRequest('start',{method:'GET'});window.location.href=url;}
      }catch(e){txt.textContent=(e&&e.message)||'GitHub connection is not configured yet.';btn.disabled=false;}
    });
    banner.append(left,btn);
  };
  paint(false,null);
  connectGithubRequest('status',{method:'GET'}).then(r=>paint(r.connected,r.login)).catch(()=>{});
  return banner;
}
function renderProofOfWork(root,profile){
  const sec=document.createElement('section');sec.className='proof-of-work';
  const h=document.createElement('h3');h.textContent='Proof of work · GitHub';
  const sub=document.createElement('p');sub.className='pow-sub';sub.textContent='Link a public repo. We score each skill it demonstrates, with the evidence.'
  sec.append(h,sub,githubConnectBanner());
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
      const card=githubAnalysisCard({repo:analysis.repo.name,url:analysis.repo.url,skills:analysis.skills,flags:analysis.flags,needsReview:analysis.needsReview,ownershipVerified:analysis.ownershipVerified});
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
  top.append(name);
  // Ownership honesty: a repo owned by the connected account is "verified account"; otherwise
  // it's a "linked repo" — the anti-slop distinction made visible.
  top.append(pill(a.ownershipVerified?'✓ Verified account':'Linked repo','gh-owner-pill',a.ownershipVerified?'verified':'linked'));
  if(a.needsReview)top.append(pill('Needs review','status-pill','revise'));card.append(top);
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
  if(!(a.skills||[]).length){const none=document.createElement('p');none.className='pow-evidence';none.textContent='No scored skills, the repo may be empty, tiny, or unreadable.';card.append(none);}
  card.append(grid);return card;
}


// The eight comparison axes, shared by both forms. Company answers what the ROLE is like,
// student answers what THEY like; computeFitScore walks the pairs. A blank on either side is
// skipped rather than penalised, so an incomplete profile never reads as a bad one.
const FIT_AXES=['structure','autonomy','pace','collaboration','feedback','communication','scope','stage'];
const TRAIT_OPTIONS=[
  'comfortable with ambiguity','ships fast','detail-obsessed','asks questions early',
  'works well unsupervised','strong writer','enjoys unglamorous work','learns a new tool quickly',
  'pushes back when something is wrong','finishes what they start',
];
function fieldName(prefix,key){return prefix+key[0].toUpperCase()+key.slice(1);}
function readAxes(form,prefix){
  const out={};
  FIT_AXES.forEach(k=>{
    const el=form.elements[fieldName(prefix,k)];
    if(el&&el.value)out[k]=el.value;
  });
  return Object.keys(out).length?out:null;
}
function fillAxes(form,prefix,values){
  const v=values&&typeof values==='object'?values:{};
  FIT_AXES.forEach(k=>{const el=form.elements[fieldName(prefix,k)];if(el)el.value=v[k]||'';});
}
// Chips rather than a free-text box: a fixed list is the only way both sides can be compared
// at all, and it stops "self-starter" and "self starter" reading as different traits.
function mountTraitChips(hostId,name,selected){
  const host=document.getElementById(hostId);if(!host)return;
  host.replaceChildren();
  const picked=new Set((selected||[]).map(t=>String(t).toLowerCase()));
  TRAIT_OPTIONS.forEach(t=>{
    const lab=document.createElement('label');lab.className='chip-check';
    const box=document.createElement('input');box.type='checkbox';box.name=name;box.value=t;box.checked=picked.has(t);
    const span=document.createElement('span');span.textContent=t;
    lab.append(box,span);host.append(lab);
  });
}
function readTraits(form,name){
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(el=>el.value).slice(0,6);
}

function updateProfileFields(){const role=$('[name="role"]:checked',$('#profileForm'))?.value||state.dashboard?.profile?.role||'student';$$('[data-profile-field="organization"]').forEach(el=>el.hidden=role==='student');$$('[data-profile-field="school"],[data-profile-field="graduation"],[data-student-profile]').forEach(el=>el.hidden=role!=='student');}
function openProfile({required=false}={}){const form=$('#profileForm');const p=state.dashboard?.profile;form.reset();mountTraitChips('studentTraitRow','studentTrait',[]);if(p){form.elements.role.value=p.role;form.elements.displayName.value=p.display_name||'';form.elements.organizationName.value=p.organization_name||'';form.elements.schoolName.value=p.school_name||'';form.elements.graduationYear.value=p.graduation_year||'';form.elements.headline.value=p.headline||'';form.elements.bio.value=p.bio||'';form.elements.skills.value=(p.skills||[]).join(', ');form.elements.portfolioVisibility.checked=p.portfolio_visibility!=='private';fillAxes(form,'ws',p.work_style);mountTraitChips('studentTraitRow','studentTrait',p.traits);if(form.elements.emailNotifications)form.elements.emailNotifications.checked=p.email_opt_out!==true;if(form.elements.spotlightConsent)form.elements.spotlightConsent.checked=p.spotlight_consent===true;
  const appealBtn=document.getElementById('appealSubmitBtn');
  if(appealBtn&&!appealBtn.dataset.wired){appealBtn.dataset.wired='1';appealBtn.addEventListener('click',async()=>{
    const subject=form.elements.appealSubject?form.elements.appealSubject.value.trim():'';
    const evidence=form.elements.appealEvidence?form.elements.appealEvidence.value.trim():'';
    const status=document.getElementById('appealStatus');
    appealBtn.disabled=true;if(status)status.textContent='Submitting…';
    try{
      await portalRequest({method:'PATCH',body:JSON.stringify({action:'appeal-score',subject,evidence})});
      if(status)status.textContent='Appeal filed, an operator will review it and write a resolution.';
      if(form.elements.appealSubject)form.elements.appealSubject.value='';
      if(form.elements.appealEvidence)form.elements.appealEvidence.value='';
    }catch(error){if(status)status.textContent=error.message;}
    appealBtn.disabled=false;
  });}$$('[name="role"]',form).forEach(input=>input.disabled=true);}else{$$('[name="role"]',form).forEach(input=>input.disabled=false);const inferred=state.dashboard?.user?.metadata?.full_name||state.dashboard?.user?.metadata?.name||'';form.elements.displayName.value=inferred;}form.dataset.required=required?'true':'false';$$('[data-close-dialog]',form).forEach(button=>button.hidden=required);updateProfileFields();setDialogMessage('#profileMessage','');$('#profileDialog').showModal();}
function openProject(){setDialogMessage('#projectMessage','');$('#projectForm').reset();mountTraitChips('idealTraitRow','idealTrait',[]);$('#projectDialog').showModal();}
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
function openApply(project){state.applyProject=project;const form=$('#applyForm');form.reset();form.elements.projectId.value=project.id;$('#applyTitle').textContent=`Apply to ${project.title}.`;$('#applySummary').textContent=project.summary;const ds=project.desired_skills;if(form.elements.skills)form.elements.skills.value=Array.isArray(ds)?ds.join(', '):(ds||'');setDialogMessage('#applyMessage','');form.elements.videoUrl.value='';videoStudio.mountPicker($('#applyVideoPicker'),form.elements.videoUrl,{maxSeconds:60,label:'Intro · '+project.title});$('#applyDialog').showModal();}
function openSubmitWork(project){const form=$('#submitWorkForm');form.reset();workFiles=[];renderWorkFiles();form.elements.projectId.value=project.id;$('#submitWorkTitle').textContent=`Submit your work · ${project.title}`;setDialogMessage('#submitWorkMessage','');$('#submitWorkDialog').showModal();}
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
  {id:'about',kind:'textarea',field:'bio',headline:'Anything else worth knowing?',sub:'A short intro, optional, but it helps.',placeholder:'What you are learning, building, or looking for next.'},
  {id:'handoff',kind:'handoff',headline:"Let's find your first project.",sub:"Takes about 3 minutes. We'll guide you through it."},
];
let onboardState={step:0,values:{role:'student',verticals:[],workTypes:[]},saving:false};
function onboardKey(){const d=state.dashboard;return 'covendaOnboard:'+(d?.user?.id||d?.user?.email||'anon');}
function persistOnboard(){try{localStorage.setItem(onboardKey(),JSON.stringify({step:onboardState.step,values:onboardState.values}));}catch{}}
function clearOnboard(){try{localStorage.removeItem(onboardKey());}catch{}}
// Restore saved answers only where they still match the shape this flow expects. The old
// spread merge trusted localStorage completely, so a payload written by an earlier build — an
// object where a list belongs — replaced a guarded array and reached `new Set(...)`, which
// throws. That TypeError escaped loadDashboard and rendered as a sign-in error, so a signed-in
// member was told to sign in again by a bug their session could not fix and a reload could not
// clear. Unknown keys are dropped rather than carried along.
function mergeSavedOnboard(base,saved){
  const out={...base};
  for(const [key,value] of Object.entries(saved||{})){
    if(!(key in base))continue;
    if(Array.isArray(base[key])){if(Array.isArray(value))out[key]=[...value];continue;}
    if(value===null||['string','number','boolean'].includes(typeof value))out[key]=value;
  }
  return out;
}
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
  try{const raw=localStorage.getItem(onboardKey());if(raw){const saved=JSON.parse(raw);onboardState.values=mergeSavedOnboard(onboardState.values,saved.values);onboardState.step=Math.min(Math.max(saved.step||0,0),ONBOARD_SCREENS.length-1);}}catch{}
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
  const restCaption=()=>{caption.textContent=onboardState.values.avatarUrl?'Profile image set, optional, and you can change it later.':'Optional, we generate one from your name until you add a photo.';};
  restCaption();
  file.addEventListener('change',async()=>{const chosen=file.files[0];file.value='';if(!chosen)return;caption.textContent='Uploading your image…';try{const url=await uploadAvatar(chosen);onboardState.values.avatarUrl=url;persistOnboard();paint();restCaption();}catch(error){caption.textContent=error.message;}});
  const label=document.createElement('label');label.className='onboard-field';const span=document.createElement('span');span.textContent='Display name';const input=document.createElement('input');input.type='text';input.autocomplete='name';input.placeholder='Your name';input.value=values.displayName||'';label.append(span,input);
  const cta=onboardCta('Continue',()=>{if(input.value.trim())onboardNext();},{disabled:!(values.displayName||'').trim()});
  input.addEventListener('input',()=>{onboardState.values.displayName=input.value;persistOnboard();cta.disabled=!input.value.trim();if(!onboardState.values.avatarUrl)paint();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(input.value.trim())onboardNext();}});
  controls.append(avatarWrap,upload,caption,label);body.append(msg,cta);return input;
}
function renderOnboardMultiScreen({screen,values,controls,body,msg}){
  // `||[]` only catches falsy values, so anything truthy and non-iterable used to reach the
  // Set constructor and throw. The shape is what matters here, not the truthiness.
  const selected=new Set(Array.isArray(values[screen.field])?values[screen.field]:[]);
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
  if(balance<cost.total){note.classList.add('is-short');note.textContent=`Your balance is ${balance.toLocaleString()}, ${(cost.total-balance).toLocaleString()} short. Top up in Wallet.`;}
  else note.textContent=`Balance after posting: ${(balance-cost.total).toLocaleString()}. The student receives all ${cost.listed.toLocaleString()} credits on acceptance.`;
  root.append(note);
}
function intakeToggle(list,option,button){const i=list.indexOf(option);if(i>=0)list.splice(i,1);else list.push(option);const now=i<0;button.classList.toggle('is-selected',now);button.setAttribute('aria-pressed',now?'true':'false');}
function renderIntakeTargets(){const vRoot=$('#intakeVerticals');vRoot.replaceChildren();ONBOARD_VERTICALS.forEach(opt=>{const on=intakeState.verticals.includes(opt);const b=document.createElement('button');b.type='button';b.className='intake-toggle'+(on?' is-selected':'');b.setAttribute('aria-pressed',on?'true':'false');b.textContent=opt;b.addEventListener('click',()=>intakeToggle(intakeState.verticals,opt,b));vRoot.append(b);});const wRoot=$('#intakeWorkTypes');wRoot.replaceChildren();ONBOARD_WORK_TYPES.forEach(opt=>{const on=intakeState.workTypes.includes(opt);const b=document.createElement('button');b.type='button';b.className='intake-toggle'+(on?' is-selected':'');b.setAttribute('aria-pressed',on?'true':'false');b.textContent=opt;b.addEventListener('click',()=>intakeToggle(intakeState.workTypes,opt,b));wRoot.append(b);});}
function renderIntakeReview(){const root=$('#intakeReview');root.replaceChildren();const form=$('#intakeForm');const title=$('[name="title"]',form).value.trim()||'Untitled project';const rows=[['Title',title],['Verticals',intakeState.verticals.join(', ')||'—'],['Work types',intakeState.workTypes.join(', ')||'—'],['Files',intakeState.attachments.length?`${intakeState.attachments.length} attached`:'None'],['20-min consult',intakeState.consultBooked?'Booked':'Not yet, you can book later']];const dl=document.createElement('dl');dl.className='intake-review-list';rows.forEach(([k,v])=>{const wrap=document.createElement('div');const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;wrap.append(dt,dd);dl.append(wrap);});root.append(dl);}
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
  if(brief.safeToPost===false){const warn=document.createElement('div');warn.className='intake-warn';warn.append(icon('p-close'));const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent='Outside Covenda’s safe boundary';const ul=document.createElement('ul');(brief.safetyFlags||[]).forEach(f=>{const li=document.createElement('li');li.textContent=f;ul.append(li);});const p=document.createElement('p');p.textContent='We can’t post this as-is. Book a 20-minute consult and we’ll find a version that works.';box.append(strong,ul,p);warn.append(box);root.append(warn);return;}
  const titleInput=$('[name="title"]',$('#intakeForm'));if(titleInput&&!titleInput.value.trim()&&brief.title)titleInput.value=brief.title;
  const head=document.createElement('div');head.className='brief-head';const label=document.createElement('p');label.className='intake-brief-label';label.textContent='AI draft understanding, edit before you post';const reset=document.createElement('button');reset.type='button';reset.className='brief-reset';reset.textContent='Reset to AI draft';head.append(label,reset);root.append(head);
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
$('#intakePost')?.addEventListener('click',async()=>{const form=$('#intakeForm');const btn=$('#intakePost');const title=$('[name="title"]',form).value.trim();const problem=$('[name="problem"]',form).value.trim();const summary=(intakeState.editedSummary||problem).trim();if(title.length<3){setDialogMessage('#intakeMessage','Add a project title on the Target step.',true);intakeState.step=3;renderIntakeStep();return;}if(summary.length<10){setDialogMessage('#intakeMessage','The project needs a longer description.',true);return;}if(intakeState.brief&&intakeState.brief.safeToPost===false){setDialogMessage('#intakeMessage','This is outside the safe boundary. Book the consult instead of posting.',true);return;}const cost=projectCreditCost(form.elements.creditsListed?.value,intakeState.targeting);
  const balance=Number(state.dashboard?.walletBalance)||0;
  if(cost.total>balance){setDialogMessage('#intakeMessage',`This post holds ${cost.total.toLocaleString()} credits but your balance is ${balance.toLocaleString()}. Top up in Wallet first.`,true);return;}
  btn.disabled=true;setDialogMessage('#intakeMessage','Posting your project…');try{await portalRequest({method:'POST',body:JSON.stringify({action:'create-project',title,summary,deliverable:(intakeState.brief?.candidateDeliverables||[]).map(d=>d&&d.title?d.title:d).filter(Boolean).join(' · '),desiredSkills:$('[name="skills"]',form).value,targetDate:$('[name="targetDate"]',form).value,visibility:'members',verticals:intakeState.verticals,workTypes:intakeState.workTypes,attachments:intakeState.attachments,aiBrief:intakeState.brief||undefined,problemText:problem,consultBooked:intakeState.consultBooked,creditsListed:cost.listed,targeting:intakeState.targeting})});$('#intakeDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#intakeMessage',error.message,true);}finally{btn.disabled=false;}});

$('#googleLogin').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;setLoginMessage('Opening Google sign-in…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'google-login'})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Google sign-in could not start.');location.assign(result.url);}catch(error){setLoginMessage(error.message,true);button.disabled=false;}});
$('#memberEmailForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('button',event.currentTarget);button.disabled=true;setLoginMessage('Requesting a secure sign-in link…');try{const response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-link',email:event.currentTarget.elements.email.value})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not request a sign-in link.');setLoginMessage(result.message);}catch(error){setLoginMessage(error.message,true);}finally{button.disabled=false;}});

$('#profileForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#profileMessage','Saving your workspace…');const payload={action:'save-profile',role:form.elements.role.value,displayName:form.elements.displayName.value,organizationName:form.elements.organizationName.value,schoolName:form.elements.schoolName.value,graduationYear:form.elements.graduationYear.value,headline:form.elements.headline.value,bio:form.elements.bio.value,skills:form.elements.skills.value,portfolioVisibility:form.elements.portfolioVisibility.checked?'members':'private',emailOptOut:form.elements.emailNotifications?!form.elements.emailNotifications.checked:undefined,spotlightConsent:form.elements.spotlightConsent?form.elements.spotlightConsent.checked:undefined,workStyle:readAxes(form,'ws'),traits:readTraits(form,'studentTrait')};try{await portalRequest({method:'PATCH',body:JSON.stringify(payload)});$('#profileDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#profileMessage',error.message,true);}finally{button.disabled=false;}});

$('#projectForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#projectMessage','Creating project…');const payload={action:'create-project',title:form.elements.title.value,summary:form.elements.summary.value,deliverable:form.elements.deliverable.value,desiredSkills:form.elements.desiredSkills.value,targetDate:form.elements.targetDate.value,visibility:form.elements.visibility.value,accessStage:form.elements.accessStage?Number(form.elements.accessStage.value):1,engagementRung:form.elements.engagementRung?form.elements.engagementRung.value:'',opportunityType:form.elements.opportunityType?form.elements.opportunityType.value:undefined,experienceRequirement:form.elements.experienceRequirement?form.elements.experienceRequirement.value:undefined,referralRequirement:form.elements.referralRequirement?form.elements.referralRequirement.value:undefined,founderTimeBudgetMinWeek:form.elements.founderTimeBudgetMinWeek&&form.elements.founderTimeBudgetMinWeek.value!==''?Number(form.elements.founderTimeBudgetMinWeek.value):undefined,talentSources:[...form.querySelectorAll('input[name="talentSource"]:checked')].map(el=>el.value),environment:readAxes(form,'env'),idealTraits:readTraits(form,'idealTrait'),idealSkills:form.elements.idealSkills?form.elements.idealSkills.value:'',idealMemo:form.elements.idealMemo?form.elements.idealMemo.value:''};try{await portalRequest({method:'POST',body:JSON.stringify(payload)});$('#projectDialog').close();await loadDashboard();setView('projects');}catch(error){setDialogMessage('#projectMessage',error.message,true);}finally{button.disabled=false;}});

$('#applyForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#applyMessage','Sending your interest…');const skills=form.elements.skills.value.split(',').map(s=>s.trim()).filter(Boolean);const referral={name:form.elements.referralName.value.trim(),code:form.elements.referralCode.value.trim()};try{await portalRequest({method:'POST',body:JSON.stringify({action:'apply',projectId:form.elements.projectId.value,note:form.elements.note.value,skills,demonstration:form.elements.demonstration.value.trim(),videoUrl:form.elements.videoUrl.value.trim(),referral})});$('#applyDialog').close();await loadDashboard();setView('activity');}catch(error){setDialogMessage('#applyMessage',error.message,true);}finally{button.disabled=false;}});
$('#batchApplyForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);const e=form.elements;
  if(e.note.value.trim().length<40){setDialogMessage('#batchApplyMessage','Tell us why this cohort fits you, a few sentences at least.',true);e.note.focus();return;}
  // The accommodation panel and the server both promise "applying is not blocked while you
  // wait", and this gate used to block anyway — the student was told one thing by the panel and
  // another by the button. An open request is the student saying the default route does not work
  // for them, which is exactly the case the promise was written for.
  if(!e.videoUrl.value.trim()&&!hasOpenAccommodation('batch_application',e.batchId.value)){setDialogMessage('#batchApplyMessage','Record your walkthrough, or pick one you already made. If recording will not work for you, use "Need a different way to do this?" above.',true);e.videoUrl.focus();return;}
  // The exercise carries a Required badge, so it has to actually gate. A badge that does not
  // block is worse than no badge.
  const exercisePart=$('#baPartExercise');
  if(exercisePart&&!exercisePart.hidden&&!($('#batchExerciseUrl')?.value||'').trim()){
    setDialogMessage('#batchApplyMessage','The exercise is still to do. It is the second recording, below your walkthrough.',true);
    exercisePart.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  button.disabled=true;setDialogMessage('#batchApplyMessage','Submitting your application…');
  const skills=e.skills.value.split(',').map(s=>s.trim()).filter(Boolean);
  try{
    await portalRequest({method:'POST',body:JSON.stringify({action:'apply-batch',batchId:e.batchId.value,note:e.note.value.trim(),experience:e.experience.value.trim(),skills,hoursPerWeek:e.hoursPerWeek.value,startDate:e.startDate.value,workSample1:e.workSample1.value.trim(),workSample2:e.workSample2.value.trim(),videoUrl:e.videoUrl.value.trim(),videoPrompt:currentBatchPrompt,interest:readBatchInterest(),conceptAnswers:readConceptAnswers(),reasoningAnswers:readReasoningAnswers(),resumeAnswers:readResumeAnswers(),resumeUrl:batchResumeUrl,workSampleFiles:batchArtifacts.filter(f=>f.url).map(f=>({name:f.name,url:f.url})),exerciseUrl:($('#batchExerciseUrl')?.value||'').trim(),referral:{name:e.referralName.value.trim(),code:e.referralCode.value.trim()}})});
    clearBatchDraft(e.batchId.value);
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
    // The résumé used to be stored and never read. Now it generates the questions only this
    // applicant gets. Best-effort: the application does not depend on it.
    const rqHost=$('#batchResumeQuestions');
    if(rqHost){ rqHost.hidden=false; rqHost.replaceChildren(Object.assign(document.createElement('p'),{className:'ba-rq-note',textContent:'Reading your résumé…'})); }
    try{
      const qr=await fetch('/api/resume-interview',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':file.type||'application/octet-stream','x-file-name':encodeURIComponent(file.name),'x-vertical':encodeURIComponent(currentBatchVertical||'')},body:file});
      renderResumeQuestions(await qr.json().catch(()=>null));
    }catch{ renderResumeQuestions(null); }
  }catch(error){batchResumeUrl='';renderBatchResumeChip('');setDialogMessage('#batchApplyMessage',error.message,true);}
});

// Deliverable uploads. Work is a video, a CSV, a deck, a zip of code — telling a student to
// go host it somewhere first is where submissions get lost. Files upload as they are chosen
// so pressing Submit is never a two-minute wait.
let workFiles=[];
function renderWorkFiles(){
  const list=$('#workFileList');if(!list)return;
  list.replaceChildren();
  workFiles.forEach((f,i)=>{
    const li=document.createElement('li');
    li.className=f.url?'is-done':(f.error?'is-error':'is-busy');
    const name=document.createElement('span');name.textContent=f.name;
    const state=document.createElement('small');
    state.textContent=f.error?f.error:(f.url?`${Math.round(f.sizeBytes/1024)} KB`:'Uploading…');
    li.append(name,state);
    if(f.url||f.error){
      const x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Remove '+f.name);x.textContent='×';
      x.addEventListener('click',()=>{workFiles.splice(i,1);renderWorkFiles();});
      li.append(x);
    }
    list.append(li);
  });
}
$('#workFileInput')?.addEventListener('change',async event=>{
  const picked=[...(event.target.files||[])];
  event.target.value='';
  const status=$('#workFileStatus');
  for(const file of picked){
    const entry={name:file.name,sizeBytes:file.size,url:null,error:null};
    workFiles.push(entry);renderWorkFiles();
    try{
      const res=await fetch('/api/file-upload',{
        method:'POST',
        headers:{'Content-Type':file.type||'application/octet-stream','X-Covenda-Filename':file.name},
        body:file,
      });
      const body=await res.json();
      if(!res.ok||!body.ok)throw new Error(body.error||'Upload failed.');
      entry.url=body.url;entry.sizeBytes=body.sizeBytes;
    }catch(err){ entry.error=err.message||'Upload failed.'; }
    renderWorkFiles();
  }
  if(status)status.textContent=workFiles.some(f=>f.error)?'Some files did not upload. Remove them or try again.':'';
});

$('#submitWorkForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;setDialogMessage('#submitWorkMessage','Submitting your work…');const notes=form.elements.workNotes.value.trim();const summary=[form.elements.workSummary.value.trim(),notes&&`\n\nNotes for the reviewer: ${notes}`].filter(Boolean).join('');const links=form.elements.workLinks.value.split(/\n/).map(link=>link.trim()).filter(Boolean);const pending=workFiles.filter(f=>!f.url&&!f.error);if(pending.length){setDialogMessage('#submitWorkMessage','Wait for the uploads to finish.',true);button.disabled=false;return;}const deliverableFiles=workFiles.filter(f=>f.url).map(f=>({name:f.name,url:f.url}));try{await portalRequest({method:'POST',body:JSON.stringify({action:'submit-deliverable',projectId:form.elements.projectId.value,deliverable:summary,deliverableLinks:links})});$('#submitWorkDialog').close();await loadDashboard();setView('overview');}catch(error){setDialogMessage('#submitWorkMessage',error.message,true);}finally{button.disabled=false;}});
// Accepting is gated on one question. It is not a nicety: the answer is what issues the
// student's verified work record, and it is the only supervision the scorer will ever get.
// A skip option here would quietly empty the training set, so there is not one.
async function sendReview(decision,note,wouldRequestAgain){
  const form=$('#reviewForm');
  const buttons=$$('#reviewForm [data-decision], #closeoutGate button');
  buttons.forEach(b=>b.disabled=true);
  setDialogMessage('#reviewMessage',decision==='accept'?'Accepting the deliverable…':'Sending the change request…');
  try{
    await portalRequest({method:'POST',body:JSON.stringify({action:'review-deliverable',projectId:form.elements.projectId.value,decision,note,wouldRequestAgain})});
    $('#reviewDialog').close();$('#closeoutGate').hidden=true;
    await loadDashboard();setView('overview');
  }catch(error){ setDialogMessage('#reviewMessage',error.message,true); }
  finally{ buttons.forEach(b=>b.disabled=false); }
}
$$('#reviewForm [data-decision]').forEach(button=>button.addEventListener('click',()=>{
  const form=$('#reviewForm');const decision=button.dataset.decision;const note=form.elements.note.value.trim();
  if(decision==='revise'&&!note){setDialogMessage('#reviewMessage','Add a note so the student knows what to revise.',true);return;}
  if(decision!=='accept'){ sendReview(decision,note,undefined); return; }
  // Reveal the question rather than sending; the server refuses an accept without it.
  const gate=$('#closeoutGate'); gate.hidden=false;
  setDialogMessage('#reviewMessage','');
  gate.scrollIntoView({behavior:'smooth',block:'nearest'});
  $$('#closeoutGate button').forEach(b=>{
    b.onclick=()=>sendReview('accept',note,b.dataset.closeout==='yes');
  });
}));
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
$('#memberSignout')?.addEventListener('click',()=>{clearSession();state.dashboard=null;showAuth('Signed out of this browser.');});

// Opportunities tabs. Students reach Batches from inside Opportunities rather than from a
// seventh nav destination. Uses setView, so every existing batch render path is untouched.
// The strip is duplicated into both panels because setView swaps the whole panel: a strip that
// lived only in Discover would vanish the moment it was used. Selection is painted by target,
// not by which button was pressed, so both copies always agree.
function paintOppTabs(target){
  $$('[data-opp-tab]').forEach(t=>{
    const on=t.dataset.oppTab===target;
    t.classList.toggle('is-active',on); t.setAttribute('aria-selected',String(on));
  });
}
$$('[data-opp-tab]').forEach(tab=>tab.addEventListener('click',()=>{
  const target=tab.dataset.oppTab;
  paintOppTabs(target);
  setView(target==='batches'?'batches':'discover');
}));

// Account menu. A real disclosure with aria-expanded, not a div that hides content, so a screen
// reader is told the state rather than left to infer it from what vanished.
(function accountMenu(){
  const btn=$('#memberIdentity'), menu=$('#memberAccountMenu');
  if(!btn||!menu)return;
  const close=()=>{ menu.hidden=true; btn.setAttribute('aria-expanded','false'); };
  const open=()=>{ menu.hidden=false; btn.setAttribute('aria-expanded','true'); $('button',menu)?.focus(); };
  btn.addEventListener('click',()=>{ menu.hidden?open():close(); });
  // Escape returns focus to the trigger; clicking away just closes. Both are the behaviours a
  // keyboard user expects and neither exists by default.
  menu.addEventListener('keydown',e=>{ if(e.key==='Escape'){ close(); btn.focus(); } });
  document.addEventListener('click',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn&&!btn.contains(e.target))close(); });
  $$('button',menu).forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.view)close(); }));
})();
$('#mobileMenu').addEventListener('click',()=>$('.member-nav').classList.toggle('is-open'));

const authError=captureAuthRedirect();
checkAuthReadiness();
if(authError)showAuth(authError,true);else if(session().accessToken)loadDashboard();else showAuth();

// ---- Reverse-audit (opt-in): founder's own link -> 3 editable draft opportunities. --------
// The document path. The file goes up, the text is extracted server-side, and only the
// drafts come back — a company planning doc is confidential and should not round-trip
// through the browser to get read.
// Same trap as the verification dialogs: Enter in any of the intake's text inputs implicitly
// submits, and a method="dialog" form submitting closes the dialog — taking everything the
// founder had typed with it. Enter advances the step instead.
$('#intakeForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  const next=$('#intakeNext'),post=$('#intakePost');
  if(post&&!post.hidden&&!post.disabled)post.click();
  else if(next&&!next.hidden&&!next.disabled)next.click();
});

$('#reverseAuditFileBtn')?.addEventListener('click',async()=>{
  const input=$('#reverseAuditFile');const file=input&&input.files&&input.files[0];
  const status=$('#reverseAuditStatus');const results=$('#reverseAuditResults');const btn=$('#reverseAuditFileBtn');
  if(!file){status.textContent='Choose a file first.';return;}
  const consent=$('#intakeForm')?.elements?.aiConsent;
  if(consent&&!consent.checked){status.textContent='Tick the AI consent box first, we read the file to draft from it.';return;}
  btn.disabled=true;status.textContent='Reading '+file.name+'…';results.replaceChildren();
  try{
    const res=await fetch('/api/project-doc',{
      method:'POST',
      headers:{'Content-Type':'application/octet-stream','X-Covenda-Filename':file.name},
      body:file,
    });
    const body=await res.json();
    if(!res.ok||!body.ok)throw new Error(body.error||'That did not go through.');
    status.textContent='';
    renderReverseAuditDrafts(body.audit||body,results,status);
  }catch(error){ status.textContent=error.message; }
  finally{ btn.disabled=false; }
});

// Drafts render identically whether they came from a link or an uploaded document — one
// renderer, so the two paths cannot drift.
function renderReverseAuditDrafts(audit,results,status){
  results.replaceChildren();
  if(!audit.safeToPropose||!(audit.proposals||[]).length){
    status.textContent=(audit.safetyFlags||[])[0]||'Nothing safely proposable was found in that.';
    status.classList.add('is-error');return;
  }
  status.classList.remove('is-error');
  status.textContent=`${audit.proposals.length} draft${audit.proposals.length===1?'':'s'}, edit anything, then use one to start the intake.`;
  audit.proposals.forEach(p=>{
    const card=document.createElement('article');card.className='ra-card';
    const h=document.createElement('strong');h.textContent=`DRAFT · ${p.title}`;card.append(h);
    const sm=document.createElement('p');sm.textContent=p.summary;card.append(sm);
    const meta=document.createElement('p');meta.className='ra-meta';
    meta.textContent=[`Deliverable: ${p.deliverable}`,p.estimatedHours?`~${p.estimatedHours} hrs`:'',p.founderTimeMinutes?`${p.founderTimeMinutes} min of your time`:''].filter(Boolean).join(' · ');
    card.append(meta);
    const use=document.createElement('button');use.type='button';use.className='portal-primary compact';use.textContent='Use this draft';
    use.addEventListener('click',()=>{
      const ta=$('#intakeForm [name="problem"]');
      ta.value=`${p.summary}\n\nDeliverable: ${p.deliverable}\nDone when: ${p.acceptanceCriteria}\nOut of scope: ${p.boundary}`;
      ta.dispatchEvent(new Event('input',{bubbles:true}));ta.focus();
      status.textContent='Draft loaded into the description, edit it, then continue to Understand.';
    });
    card.append(use);results.append(card);
  });
}

$('#reverseAuditBtn')?.addEventListener('click',async()=>{
  const url=($('#reverseAuditUrl')?.value||'').trim();
  const status=$('#reverseAuditStatus');const results=$('#reverseAuditResults');const btn=$('#reverseAuditBtn');
  if(!/^https?:\/\/\S+$/i.test(url)){status.textContent='Paste a valid public link first.';status.classList.add('is-error');return;}
  if(!$('#intakeForm [name="aiConsent"]')?.checked){status.textContent='Tick the AI consent box first. We read your link to draft from it.';status.classList.add('is-error');return;}
  btn.disabled=true;status.classList.remove('is-error');status.textContent='Reading your link and drafting…';results.replaceChildren();
  try{
    const res=await fetch('/api/project-intake',{method:'POST',headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'reverse-audit',linkUrl:url})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Reverse-audit failed.');
    renderReverseAuditDrafts(data.audit||{},results,status);
  }catch(error){status.textContent=error.message;status.classList.add('is-error');}
  finally{btn.disabled=false;}
});

// In-page walkthrough recorder for the batch application. The form previously accepted only
// a pasted URL, which asks a student to go away, record somewhere else, host it, and come
// back — the single biggest drop-off in the flow. Records here and uploads to the same
// /api/video-upload the marketing site uses, then fills the URL field so the rest of the
// form is unchanged. Paste-a-link stays for anyone whose browser or camera says no.
// ── Video studio ──────────────────────────────────────────────────────────────────────
// The old ask was "paste a Loom / YouTube / Drive link", which quietly assumed the student
// already had a video of themselves talking sitting on a share link somewhere. Practically
// nobody does, so the field read as a wall. This inverts it: you record a take in the portal,
// it is saved to your account, and every later application picks from what you already made.
//
// A pasted link still works — it is the fallback, not the default.
const videoStudio=(function(){
  const canRecord=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&typeof MediaRecorder!=='undefined';
  const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');

  // Opens the recorder and resolves with {url,durationSeconds} once a take is kept, or null
  // if the student backs out. Uploads then registers the take in their library.
  // Screen capture, for assessments where the work happens on screen rather than on a face.
  // Litmus's insight applies directly: what a candidate DOES — which shortcut, which file
  // they open first, whether they sanity-check — is the signal, and a finished artifact
  // hides all of it.
  //
  // Audio comes from the microphone as well as the tab, because thinking aloud is half of
  // what a rater is reading. A silent screen recording of correct answers tells you much
  // less than a narrated one that goes wrong twice.
  // getDisplayMedia and getUserMedia reject with a DOMException whose NAME is the only
  // reliable signal — the message is browser-specific and often empty. Each of these needs
  // different advice, and collapsing them into one string is what made this undiagnosable.
  function captureReason(err,mode){
    const name=err&&err.name||'';
    const screen=mode==='screen';
    if(name==='NotAllowedError'){
      return screen
        ? 'Screen sharing was blocked or dismissed. Press the button again and pick a window or tab. On macOS you may also need to allow your browser under System Settings, Privacy & Security, Screen Recording.'
        : 'Camera or microphone access was blocked. Allow it from your browser address bar, then try again.';
    }
    if(name==='NotFoundError'||name==='DevicesNotFoundError'){
      return screen?'No screen source was available to share.':'No camera or microphone was found on this device.';
    }
    if(name==='NotReadableError')return 'Something else is already using it. Close any other call or recorder, then try again.';
    if(name==='NotSupportedError'||name==='TypeError'){
      return screen?'This browser cannot share a screen. Use Chrome, Edge or Safari on a computer, iPhone and iPad cannot do it.':'This browser cannot record. Try Chrome or Safari.';
    }
    if(name==='AbortError')return 'The capture stopped before it started. Try again.';
    return (err&&err.message)||'Could not start the recording.';
  }

  // Uploads the recording straight to Blob storage. The old path POSTed the file through a
  // serverless function that buffered it in memory and capped at 30 MB, so anything longer
  // than about a minute had its connection cut mid-body — which surfaces as "Failed to fetch",
  // with no status code and nothing in the logs.
  async function uploadRecording(blob,kind='video'){
    const contentType=(blob.type||'video/webm').split(';')[0].trim();

    // Preferred path: a short-lived PUT URL, so the file goes straight to storage and its size
    // stops mattering. The old route buffered the whole thing in a serverless function and cut
    // the connection past 30 MB.
    try{
      const token=await fetch('/api/upload-token',{
        method:'POST',
        headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':'application/json'},
        body:JSON.stringify({kind,contentType}),
      });
      const grant=await token.json().catch(()=>({}));
      if(!token.ok||!grant.uploadUrl)throw new Error(grant.error||'No upload URL.');

      const put=await fetch(grant.uploadUrl,{method:'PUT',headers:{'Content-Type':contentType},body:blob});
      if(!put.ok){
        if(put.status===413)throw new Error('TOO_LARGE');
        throw new Error(`Direct upload rejected (${put.status}).`);
      }
      const stored=await put.json().catch(()=>({}));
      if(stored.url)return stored.url;
      throw new Error('Direct upload returned no URL.');
    }catch(directError){
      if(String(directError.message)==='TOO_LARGE'){
        throw new Error('That recording is too large to upload. Record a shorter take.');
      }
      // Falling back rather than failing. The server route works for anything under about
      // 30 MB, which covers every camera take and most short screen shares, so a student is
      // not blocked by a problem in the faster path.
      console.warn('Direct upload failed, falling back to the server route:', directError.message);
      const res=await fetch('/api/video-upload',{
        method:'POST',
        headers:{Authorization:`Bearer ${session().accessToken}`,'Content-Type':contentType},
        body:blob,
      });
      const body=await res.json().catch(()=>({}));
      if(res.ok&&body.url)return body.url;
      // Both paths failed, so say which limit was hit rather than a generic failure.
      if(res.status===413)throw new Error('That recording is too long to upload. Record a shorter take, or share a link instead.');
      throw new Error(body.error||`Upload failed (${res.status}). Try again, or paste a link instead.`);
    }
  }

  async function screenStream(){
    if(!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser cannot share a screen. Use Chrome, Edge or Safari.');
    const display=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:12,max:15}},   // technique is legible at 12fps; 60 is wasted bytes
      audio:true,
    });
    let mic=null;
    try{ mic=await navigator.mediaDevices.getUserMedia({audio:true}); }catch{ /* screen only */ }
    if(!mic)return display;
    // Merge the mic into the display stream so one MediaRecorder captures both.
    const ctx=new AudioContext();
    const dest=ctx.createMediaStreamDestination();
    [display,mic].forEach(st=>{ if(st.getAudioTracks().length)ctx.createMediaStreamSource(st).connect(dest); });
    const merged=new MediaStream([...display.getVideoTracks(),...dest.stream.getAudioTracks()]);
    // If they stop sharing from the browser's own bar, the recording has to end with it.
    display.getVideoTracks()[0]?.addEventListener('ended',()=>{
      merged.getTracks().forEach(t=>t.stop());
    });
    merged.__sources=[display,mic];
    return merged;
  }

  function record({prompt='',maxSeconds=90,label='',mode='camera',script=null}={}){
    return new Promise(resolve=>{
      let overlay=null,stream=null,recorder=null,chunks=[],timer=null,secs=0,blob=null,kept=0,settled=false,failure=null;
      const done=value=>{ if(settled)return; settled=true; cleanup(); resolve(value===null&&failure?{error:failure}:value); };
      function stopStream(){
        if(!stream)return;
        stream.getTracks().forEach(t=>t.stop());
        // A merged stream holds the originals; stopping only the merge leaves the browser
        // showing "sharing your screen" after the recording has finished.
        (stream.__sources||[]).forEach(src=>src&&src.getTracks().forEach(t=>t.stop()));
        stream=null;
      }
      function cleanup(){ clearInterval(timer); stopStream(); if(overlay){overlay.close();overlay.remove();overlay=null;} }
      const el=id=>overlay.querySelector('#'+id);

      overlay=document.createElement('dialog');
      overlay.className='rec-overlay';
      overlay.innerHTML=
        '<div class="rec-shell">'
        +(prompt?'<div class="rec-prompt"><span>'+(mode==='screen'?'The task':'Your prompt')+'</span><p>'+prompt.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</p></div>':'')
        +'<div class="rec-stage" data-capture="'+(mode==='screen'?'screen':'camera')+'"><video id="recPreview" playsinline muted></video><span class="rec-count" id="recCount" hidden></span>'
        +'<span class="rec-timer" id="recTimer" hidden>0:00</span>'
        +'<p class="rec-beat" id="recBeat" hidden></p></div>'
        +'<p class="rec-hint" id="recHint">'+(mode==='screen'
        ?'Pick the window with your work in it, not this tab. Tick “Also share tab audio” if the picker offers it.'
        :'Camera starting…')+'</p>'
        +'<div class="rec-actions">'
        +'<button type="button" class="portal-primary" id="recStart" disabled>Start recording</button>'
        +'<button type="button" class="portal-ghost" id="recRetake" hidden>Retake</button>'
        +'<button type="button" class="portal-primary" id="recUse" hidden>Use this take</button>'
        +'<button type="button" class="portal-ghost" id="recCancel">Cancel</button>'
        +'</div></div>';
      // Started BEFORE the dialog opens and before any await, so the click that got us here is
      // still the browser's transient user activation. Opening a <dialog> and then asking is
      // what made screen sharing fail outright: by then the activation is spent and Chrome
      // rejects with NotAllowedError, which surfaced as "Nothing recorded."
      const pending=mode==='screen'
        ? screenStream()
        : navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:true});
      pending.catch(()=>{});  // handled below; attached now so it is never an unhandled rejection

      document.body.append(overlay);
      overlay.showModal();
      overlay.addEventListener('cancel',e=>{e.preventDefault();done(null);});
      el('recCancel').addEventListener('click',()=>done(null));

      const video=el('recPreview');
      const hint=el('recHint');
      (async()=>{
        try{
          stream=await pending;
        }catch(err){
          // The reason travels out. "Nothing recorded" made a blocked permission and a
          // deliberate cancel look identical, which is why this looked like a missing feature.
          failure=captureReason(err,mode);
          hint.textContent=failure;
          hint.classList.add('is-warn');
          const back=el('recCancel'); if(back)back.textContent='Close';
          return;
        }
        video.srcObject=stream; video.muted=true; await video.play().catch(()=>{});
        hint.textContent=mode==='screen'
          ? 'Sharing. Press Start, then talk through what you are doing as you work. Reviewers score the method, so thinking out loud counts for more than finishing.'
          : 'Up to '+maxSeconds+' seconds, unscripted. Reviewers listen for how you think.';
        const start=el('recStart'); start.disabled=false;
        start.addEventListener('click',()=>countIn());
      })();

      function countIn(){
        const count=el('recCount'),start=el('recStart');
        start.hidden=true;
        let n=3; count.hidden=false; count.textContent=n;
        const pre=setInterval(()=>{
          n-=1;
          if(n>0){count.textContent=n;return;}
          clearInterval(pre); count.hidden=true; run();
        },900);
      }

      function run(){
        const timerEl=el('recTimer');
        const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9'
          :MediaRecorder.isTypeSupported('video/webm')?'video/webm':'';
        chunks=[]; secs=0;
        // Capped bitrate. A screen share at source quality is enormous for what it has to
        // show — technique is legible far below broadcast, and the smaller file is the
        // difference between an upload that finishes on a home connection and one that does
        // not. A camera take gets more, because faces need it and they are only 90 seconds.
        const rate=mode==='screen'?900_000:1_800_000;
        recorder=new MediaRecorder(stream,{
          ...(mime?{mimeType:mime}:{}),
          videoBitsPerSecond:rate,
          audioBitsPerSecond:96_000,
        });
        recorder.ondataavailable=e=>{ if(e.data&&e.data.size)chunks.push(e.data); };
        recorder.onstop=()=>{
          clearInterval(timer); kept=secs;
          blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
          stopStream();
          video.srcObject=null; video.src=URL.createObjectURL(blob); video.muted=false; video.controls=true;
          // A MediaRecorder WebM carries no duration in its header until something forces the
          // browser to scan the whole file, so the player reports 0:00, will not seek, and
          // shows a black frame. Seeking past the end makes it compute the real duration; then
          // seek back to the start so there is a visible first frame to look at.
          video.addEventListener('loadedmetadata',()=>{
            if(video.duration!==Infinity&&!Number.isNaN(video.duration))return;
            const settle=()=>{ video.removeEventListener('timeupdate',settle); video.currentTime=0; };
            video.addEventListener('timeupdate',settle);
            video.currentTime=1e101;
          },{once:true});
          timerEl.hidden=true;
          hint.textContent='Watch it back. Retake as often as you like, only the take you keep is uploaded.';
          el('recRetake').hidden=false; el('recUse').hidden=false;
        };
        // Scripted prompts. They fire on elapsed seconds and stay long enough to answer
        // without covering the work.
        const beats=(script&&script.beats)||[];
        let beatIndex=0;
        const beatEl=overlay.querySelector('#recBeat');
        recorder.start();
        timerEl.hidden=false; timerEl.textContent='0:00';
        hint.textContent='Recording…';
        const stopBtn=el('recStart');
        stopBtn.hidden=false; stopBtn.textContent='Stop'; stopBtn.disabled=false;
        stopBtn.onclick=()=>{ if(recorder&&recorder.state==='recording')recorder.stop(); stopBtn.hidden=true; };
        timer=setInterval(()=>{
          secs+=1; timerEl.textContent=fmt(secs);
          while(beatIndex<beats.length&&secs>=beats[beatIndex].atSeconds){
            const b=beats[beatIndex++];
            if(beatEl){
              beatEl.textContent=b.say;
              beatEl.hidden=false;
              // Long enough to hear and answer, short enough not to sit over the work.
              clearTimeout(beatEl.__t);
              beatEl.__t=setTimeout(()=>{beatEl.hidden=true;},14000);
            }
          }
          if(secs>=maxSeconds&&recorder.state==='recording'){recorder.stop();stopBtn.hidden=true;}
        },1000);

        el('recRetake').onclick=async()=>{
          el('recRetake').hidden=true; el('recUse').hidden=true;
          video.controls=false; video.src=''; blob=null;
          try{
            stream=mode==='screen'
              ? await screenStream()
              : await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:true});
          }catch(err){ hint.textContent=captureReason(err,mode); hint.classList.add('is-warn'); return; }
          video.srcObject=stream; video.muted=true; await video.play().catch(()=>{});
          countIn();
        };
        el('recUse').onclick=async()=>{
          const use=el('recUse');
          use.disabled=true; use.textContent='Saving…';
          try{
            const url=await uploadRecording(blob,mode==='screen'?'exercise':'video');
            // Register it on the account so the next application can just pick it.
            let saved=null,libraryError='';
            try{
              const out=await portalRequest({method:'POST',body:JSON.stringify({action:'save-video',url,prompt,label,durationSeconds:kept})});
              saved=out.video||null;
              if(saved)state.dashboard.videos=[saved,...(state.dashboard.videos||[])];
            }catch(err){
              // The take still works for this application, but saying nothing would let the
              // student believe it is in their library when it is not.
              libraryError=err.message||'It could not be saved to your library.';
            }
            done({url,durationSeconds:kept,video:saved,libraryError});
          }catch(err){
            use.disabled=false; use.textContent='Use this take';
            hint.textContent=err.message||'That upload did not go through. Try again, or paste a link.';
          }
        };
      }
    });
  }

  function library(){ return (state.dashboard&&state.dashboard.videos)||[]; }

  // The picker: your saved takes as selectable cards, a record button, and a link fallback
  // tucked behind a toggle so it never reads as the expected path.
  function mountPicker(host,input,{prompt='',maxSeconds=90,label='',onChange=null}={}){
    if(!host||!input)return;
    let mode=input.value&&!library().some(v=>v.url===input.value)?'link':'pick';
    function paint(){
      host.replaceChildren();
      const takes=library();
      if(takes.length){
        const list=document.createElement('div'); list.className='video-takes';
        takes.forEach((v,i)=>{
          const card=document.createElement('button');
          card.type='button';
          card.className='video-take'+(input.value===v.url?' is-picked':'');
          const thumb=document.createElement('span'); thumb.className='video-take-play'; thumb.textContent='▸';
          const body=document.createElement('span'); body.className='video-take-body';
          const t=document.createElement('strong');
          t.textContent=v.label||(v.prompt?'Answer · '+String(v.prompt).slice(0,44)+(String(v.prompt).length>44?'…':''):'Take '+(takes.length-i));
          const meta=document.createElement('small');
          const when=v.created_at?dateLabel(v.created_at):'';
          const len=Number(v.duration_seconds)?fmt(Number(v.duration_seconds)):'';
          meta.textContent=[len,when].filter(Boolean).join(' · ')||'Recorded in Covenda';
          body.append(t,meta);
          const mark=document.createElement('span'); mark.className='video-take-mark'; mark.textContent=input.value===v.url?'Selected':'Use';
          card.append(thumb,body,mark);
          card.addEventListener('click',()=>{
            input.value=input.value===v.url?'':v.url;
            mode='pick'; paint(); onChange&&onChange(input.value);
          });
          list.append(card);
        });
        host.append(list);
      }
      const row=document.createElement('div'); row.className='video-picker-actions';
      const rec=document.createElement('button'); rec.type='button'; rec.className='portal-primary compact';
      rec.textContent=takes.length?'Record a new one':'Record it here';
      if(!canRecord){ rec.disabled=true; rec.title='This browser cannot record video.'; }
      rec.addEventListener('click',async()=>{
        rec.disabled=true;
        const out=await record({prompt,maxSeconds,label});
        rec.disabled=false;
        if(out&&out.url){
          input.value=out.url; mode='pick'; paint(); onChange&&onChange(input.value);
          if(out.libraryError){
            const warn=document.createElement('p'); warn.className='video-note is-warn';
            warn.textContent='Attached to this application, but not saved to your library, '+out.libraryError;
            host.append(warn);
          }
        }
      });
      const alt=document.createElement('button'); alt.type='button'; alt.className='video-link-toggle';
      alt.textContent=mode==='link'?'Record one instead':'I already have a link';
      alt.addEventListener('click',()=>{ mode=mode==='link'?'pick':'link'; paint(); });
      row.append(rec,alt); host.append(row);

      if(mode==='link'){
        const wrap=document.createElement('label'); wrap.className='video-link-field';
        const cap=document.createElement('span'); cap.textContent='Paste a shareable link';
        const box=document.createElement('input'); box.type='url'; box.placeholder='https://…'; box.value=input.value||'';
        box.addEventListener('input',()=>{ input.value=box.value.trim(); onChange&&onChange(input.value); });
        wrap.append(cap,box); host.append(wrap);
      }
      if(!canRecord&&mode!=='link'){
        const note=document.createElement('p'); note.className='video-note';
        note.textContent='This browser cannot record. Paste a link, or use Chrome or Safari.';
        host.append(note);
      }
    }
    paint();
    return { refresh:paint };
  }

  return { record, mountPicker, canRecord, library, canShareScreen: Boolean(navigator.mediaDevices?.getDisplayMedia) };
})();

// Ambient gold particles across the header strip.
//
// Purely decorative, so it earns its place only by costing almost nothing: it stops entirely
// when the tab is hidden, never starts under prefers-reduced-motion, and holds a fixed number
// of points regardless of screen width.
//
// The points drift and link to near neighbours, so the shapes are emergent rather than drawn —
// constellations that form and dissolve. It reads as a network, which is what the product is.
(function headerField(){
  const canvas=document.getElementById('headerField');
  if(!canvas)return;
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce&&reduce.matches)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;

  const COUNT=26, LINK=104;
  let w=0,h=0,dpr=1,points=[],raf=0,running=false;

  function size(){
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return false;
    dpr=Math.min(window.devicePixelRatio||1,2);
    w=r.width;h=r.height;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return true;
  }
  function seed(){
    points=Array.from({length:COUNT},(_,i)=>({
      x:(i+0.5)/COUNT*w+(i%3-1)*9,
      y:h*(0.22+((i*0.37)%1)*0.56),
      vx:((i%5)-2)*0.045||0.03,
      vy:((i%3)-1)*0.028||0.02,
      r:i%7===0?1.9:1.15,
    }));
  }
  function frame(){
    if(!running)return;
    ctx.clearRect(0,0,w,h);
    const night=document.documentElement.dataset.theme==='night';
    const dot=night?'217,169,78':'192,138,34';
    for(const p of points){
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<-20)p.x=w+20; else if(p.x>w+20)p.x=-20;
      if(p.y<2||p.y>h-2)p.vy*=-1;
    }
    for(let i=0;i<points.length;i++){
      for(let j=i+1;j<points.length;j++){
        const a=points[i],b=points[j];
        const dx=a.x-b.x,dy=a.y-b.y;
        const d=Math.hypot(dx,dy);
        if(d>LINK)continue;
        // Fades with distance, so a link appears and dissolves rather than snapping on.
        ctx.strokeStyle=`rgba(${dot},${(1-d/LINK)*(night?0.30:0.20)})`;
        ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    }
    for(const p of points){
      ctx.fillStyle=`rgba(${dot},${night?0.62:0.42})`;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
    raf=requestAnimationFrame(frame);
  }
  function start(){
    if(running)return;
    if(!size())return;
    if(!points.length||points.length!==COUNT)seed();
    running=true;raf=requestAnimationFrame(frame);
  }
  function stop(){ running=false; if(raf)cancelAnimationFrame(raf); raf=0; }

  // A decorative canvas that keeps painting behind a hidden tab is a battery bug.
  document.addEventListener('visibilitychange',()=>{document.hidden?stop():start();});
  window.addEventListener('resize',()=>{ if(size())seed(); },{passive:true});
  if(reduce&&reduce.addEventListener)reduce.addEventListener('change',e=>{e.matches?stop():start();});
  start();
})();
