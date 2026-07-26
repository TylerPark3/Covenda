const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  audience: 'home',
  surface: 'site',
  workType: 'Research',
  toastTimer: null,
};
let selectorFxController = null;
let deliveryHealthRequest = null;
// Set by initIcosahedron(): re-measures + redraws the hero icosahedron. The canvas
// lives in the home-only section, so when we switch TO home we call this to size the
// canvas against its now-visible box (otherwise it stays blank until a window resize).
let icoRemeasure = null;

// Single config spot for the "Schedule a demo" flow. Set the event URL in the
// <meta name="covenda-calendly-url"> tag in index.html. Must be an https
// calendly.com link; anything else disables the popup and falls back to intake.
function calendlyUrl() {
  const raw = document.querySelector('meta[name="covenda-calendly-url"]')?.content?.trim() || '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && /(^|\.)calendly\.com$/.test(parsed.hostname)) return parsed.toString();
  } catch {
    // Unset placeholder or malformed value — treated as "not configured".
  }
  return '';
}

let calendlyAssetsLoading = null;
function loadCalendlyAssets() {
  if (window.Calendly) return Promise.resolve();
  if (calendlyAssetsLoading) return calendlyAssetsLoading;
  calendlyAssetsLoading = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-calendly]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://assets.calendly.com/assets/external/widget.css';
      link.dataset.calendly = 'true';
      document.head.append(link);
    }
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.dataset.calendly = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Calendly could not load.'));
    document.head.append(script);
  });
  return calendlyAssetsLoading;
}

function scheduleDemoPrefill() {
  const draft = readStorage(draftKeys.companyForm, null);
  const name = formValue(companyForm, 'companyContactName') || draftValue(draft, 'companyContactName');
  const email = formValue(companyForm, 'companyContactEmail') || draftValue(draft, 'companyContactEmail');
  const problem = ($('#companyProblemSeed')?.value.trim())
    || formValue(companyForm, 'companyProblem')
    || draftValue(draft, 'companyProblem');
  const prefill = {};
  if (name) prefill.name = name;
  if (email) prefill.email = email;
  if (problem) prefill.customAnswers = { a1: problem.slice(0, 800) };
  return prefill;
}

async function scheduleDemo() {
  const url = calendlyUrl();
  if (!url) {
    showToast('Demo booking isn’t connected yet — start a Project Packet and Covenda will reach out.');
    openDialog(companyDialog, companyForm);
    const seed = $('#companyProblemSeed')?.value.trim();
    if (seed && !formValue(companyForm, 'companyProblem')) {
      $('[name="companyProblem"]', companyForm).value = seed;
      saveDraft(companyForm);
    }
    return;
  }
  try {
    await loadCalendlyAssets();
    window.Calendly.initPopupWidget({ url, prefill: scheduleDemoPrefill() });
  } catch {
    showToast('Could not open the scheduler. Please try again, or start a Project Packet.');
  }
}

const storageKey = 'covendaPilotSubmissions';
const introStorageKey = 'covendaIntroSeen';
const audienceStorageKey = 'covendaAudience';
const workTypeStorageKey = 'covendaSelectedWorkType';
const draftKeys = {
  studentForm: 'covendaStudentInterestDraft',
  companyForm: 'covendaCompanyProblemDraft',
};
const universityDraftKey = 'covendaUniversityRosterDraft';

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Local draft storage is an enhancement; submission remains available.
  }
}

// Marketing top-right nav reflects sign-in state. The portal (same origin) stores its
// session + a non-sensitive summary in localStorage, so we paint "Signed in" + avatar
// instantly from cache, then verify/refresh in the background and revert if the session
// is dead. Token keys mirror portal.js. expiresAt is a Unix timestamp in SECONDS.
const MEMBER_ACCESS_KEY = 'covendaMemberAccessToken';
const MEMBER_REFRESH_KEY = 'covendaMemberRefreshToken';
const MEMBER_EXPIRY_KEY = 'covendaMemberExpiry';
const MEMBER_SUMMARY_KEY = 'covendaMemberSummary';

function memberNavAvatar(summary) {
  const node = document.createElement('span');
  node.className = 'member-nav-avatar';
  const url = summary && summary.avatarUrl;
  if (url && /^https:\/\//i.test(url)) {
    node.style.backgroundImage = `url("${encodeURI(url)}")`;
    node.classList.add('has-avatar');
  } else {
    node.textContent = ((summary && summary.displayName) || 'C').trim().charAt(0).toUpperCase() || 'C';
  }
  return node;
}

function paintMemberSignedIn(link, summary) {
  link.classList.add('is-signed-in');
  link.setAttribute('aria-label', 'Open your Covenda workspace');
  const label = document.createElement('span');
  label.textContent = 'Signed in';
  link.replaceChildren(memberNavAvatar(summary), label);
}

function paintMemberSignedOut(link) {
  link.classList.remove('is-signed-in');
  link.setAttribute('aria-label', 'Member sign in');
  link.innerHTML = '<svg><use href="#icon-lock"/></svg><span>Member sign in</span>';
}

// Returns true if we hold (or can refresh to) a live session. Silent — never blocks paint.
async function verifyMemberSession() {
  const expiry = Number(localStorage.getItem(MEMBER_EXPIRY_KEY) || 0);
  if (expiry * 1000 > Date.now() + 30000) return true; // still valid, no network needed
  const refreshToken = localStorage.getItem(MEMBER_REFRESH_KEY) || '';
  if (!refreshToken) return false;
  try {
    const response = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh-session', refreshToken }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok && result.accessToken) {
      localStorage.setItem(MEMBER_ACCESS_KEY, result.accessToken);
      if (result.refreshToken) localStorage.setItem(MEMBER_REFRESH_KEY, result.refreshToken);
      if (result.expiresAt) localStorage.setItem(MEMBER_EXPIRY_KEY, String(result.expiresAt));
      return true;
    }
  } catch {
    // Network hiccup — keep the cached signed-in paint rather than falsely signing out.
    return true;
  }
  return false;
}

function initMemberNav() {
  const link = document.querySelector('.member-login-link');
  if (!link) return;
  let token = '';
  let summary = null;
  try {
    token = localStorage.getItem(MEMBER_ACCESS_KEY) || '';
    summary = JSON.parse(localStorage.getItem(MEMBER_SUMMARY_KEY) || 'null');
  } catch { /* fall back to signed-out */ }
  if (!token) return; // leave the default "Member sign in"
  paintMemberSignedIn(link, summary);
  verifyMemberSession().then(alive => {
    if (alive) return;
    // Session is truly dead — clear the stale keys and revert the nav.
    [MEMBER_ACCESS_KEY, MEMBER_REFRESH_KEY, MEMBER_EXPIRY_KEY, MEMBER_SUMMARY_KEY].forEach(removeStorage);
    paintMemberSignedOut(link);
  });
}

let introRun = 0;
let introTimers = [];

function clearIntroTimers() {
  introTimers.forEach(window.clearTimeout);
  introTimers = [];
}

function introLater(callback, delay) {
  introTimers.push(window.setTimeout(callback, delay));
}

function restoreIntroCopy() {
  $$('.intro-line').forEach(line => {
    line.textContent = line.dataset.introCopy;
    line.classList.remove('is-typing');
  });
}

function openIntro({ force = false } = {}) {
  const intro = $('#introScreen');
  if (!force && readStorage(introStorageKey, false) === true) return;
  introRun += 1;
  const run = introRun;
  clearIntroTimers();
  intro.classList.remove('is-leaving');
  if (!intro.open) intro.showModal();
  document.documentElement.classList.add('intro-open');

  const lines = $$('.intro-line', intro);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    restoreIntroCopy();
    $('#introEnter').focus();
    return;
  }

  lines.forEach(line => {
    line.textContent = '';
    line.classList.remove('is-typing');
  });
  let lineIndex = 0;
  let characterIndex = 0;
  const typeIntro = () => {
    if (run !== introRun || !intro.open) return;
    const line = lines[lineIndex];
    const copy = line.dataset.introCopy;
    line.classList.add('is-typing');
    characterIndex += 1;
    line.textContent = copy.slice(0, characterIndex);
    line.classList.add('is-typing');
    if (characterIndex < copy.length) {
      introLater(typeIntro, copy[characterIndex - 1] === '.' ? 110 : 34);
      return;
    }
    line.classList.remove('is-typing');
    if (lineIndex < lines.length - 1) {
      lineIndex += 1;
      characterIndex = 0;
      introLater(typeIntro, 180);
      return;
    }
    $('#introEnter').focus();
  };
  introLater(typeIntro, 220);
}

function dismissIntro({ fast = false } = {}) {
  const intro = $('#introScreen');
  if (!intro.open || intro.classList.contains('is-leaving')) return;
  introRun += 1;
  clearIntroTimers();
  restoreIntroCopy();
  writeStorage(introStorageKey, true);
  intro.classList.add('is-leaving');
  introLater(() => {
    intro.close();
    intro.classList.remove('is-leaving');
    document.documentElement.classList.remove('intro-open');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, fast ? 80 : 620);
}

function draftValue(draft, name, fallback = '') {
  const value = draft?.values?.[name];
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  return value || fallback;
}

function applyFormValues(form, values = {}) {
  for (const field of $$('[name]', form)) {
    if (!(field.name in values)) continue;
    const value = values[field.name];
    if (field.type === 'checkbox') field.checked = Array.isArray(value) && value.includes(field.value);
    else field.value = value;
  }
}

function serializeDraft(form) {
  const values = {};
  for (const field of $$('[name]', form)) {
    if (field.name === 'website' || field.name.endsWith('Consent')) continue;
    if (field.type === 'checkbox') {
      if (!Array.isArray(values[field.name])) values[field.name] = [];
      if (field.checked) values[field.name].push(field.value);
    } else {
      values[field.name] = field.value;
    }
  }
  return {
    values,
    step: Number(form.dataset.step || 0),
    updatedAt: new Date().toISOString(),
    ...(form.id === 'companyForm' && form.dataset.revisionOf ? { revisionOf: form.dataset.revisionOf } : {}),
  };
}

function hasMeaningfulDraft(draft) {
  if (!draft?.values) return false;
  return Object.entries(draft.values).some(([name, value]) => {
    if (name === 'companyPublic') return false;
    return Array.isArray(value) ? value.length > 0 : Boolean(String(value).trim());
  });
}

function restoreDraft(form) {
  const draft = readStorage(draftKeys[form.id], null);
  if (!hasMeaningfulDraft(draft)) return 0;
  applyFormValues(form, draft.values);
  if (form.id === 'companyForm') {
    if (draft.revisionOf) form.dataset.revisionOf = draft.revisionOf;
    else delete form.dataset.revisionOf;
    renderRevisionContext();
  }
  return Math.max(0, Math.min(Number(draft.step || 0), $$('.form-step', form).length - 1));
}

function saveDraft(form) {
  const draft = serializeDraft(form);
  if (!hasMeaningfulDraft(draft)) return;
  const saved = writeStorage(draftKeys[form.id], draft);
  const status = $('[data-draft-status]', form);
  if (status) status.textContent = saved ? 'Draft saved on this device' : 'Draft could not be saved';
  renderWorkspaceDrafts();
}

function discardDraft(form, { reset = true } = {}) {
  removeStorage(draftKeys[form.id]);
  if (form.id === 'companyForm') {
    delete form.dataset.revisionOf;
    renderRevisionContext();
  }
  if (reset) {
    form.reset();
    setFormStep(form, 0);
    if (form.id === 'studentForm') selectWorkType(state.workType);
    if (form.id === 'companyForm') renderCompanyBoundaryGuidance(form);
  }
  const status = $('[data-draft-status]', form);
  if (status) status.textContent = 'Draft saves on this device';
  renderWorkspaceDrafts();
}

function renderRevisionContext() {
  const form = $('#companyForm');
  const context = $('#companyRevisionContext');
  if (!form || !context) return;
  const reference = form.dataset.revisionOf || '';
  context.hidden = !reference;
  $('#companyRevisionReference').textContent = reference
    ? 'Revision of ' + reference + ' · the original submission remains unchanged.'
    : 'The original submission remains unchanged.';
  const submit = $('[data-form-submit]', form);
  if (submit) submit.innerHTML = (reference ? 'Send revised company problem ' : 'Send company problem ') + iconUse('icon-arrow-right');
}

function renderDefinitionList(root, rows) {
  root.replaceChildren();
  for (const [term, detail] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = detail || 'Not provided';
    row.append(dt, dd);
    root.append(row);
  }
}

function iconUse(id) {
  return '<svg aria-hidden="true"><use href="#' + id + '"></use></svg>';
}

function createIcon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#' + id);
  svg.append(use);
  return svg;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

const audienceTitles = {
  home: 'Covenda · Real work becomes credible proof',
  student: 'Covenda · Real work becomes credible evidence',
  company: 'Covenda for startups · Run a work-trial with vouched talent',
  university: 'Covenda · Vouch for the students you believe in',
};

function setAudience(audience) {
  if (!['home', 'student', 'company', 'university'].includes(audience)) return;
  state.audience = audience;
  writeStorage(audienceStorageKey, audience);
  document.body.dataset.audience = audience;
  $$('[data-audience-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.audienceOption === audience));
  });
  $$('[data-student-label]').forEach(label => {
    label.textContent = audience === 'student' ? label.dataset.studentLabel : label.dataset.companyLabel;
  });
  document.title = audienceTitles[audience] || audienceTitles.student;
  // The icosahedron's section is only shown on "home"; re-measure now that its box
  // exists so the shape renders on the first visit, not only after a reload/resize.
  if (audience === 'home' && icoRemeasure) icoRemeasure();
  renderSubmissionHistory();
}

function setSurface(surface) {
  state.surface = surface;
  document.body.dataset.surface = surface;
  const workspace = surface === 'workspace';
  if (workspace && $('#introScreen').open) dismissIntro({ fast: true });
  $('#siteShell').hidden = workspace;
  $('#workspaceShell').hidden = !workspace;
  setWorkspaceTab('overview');
  if (workspace) refreshDeliveryHealth();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function selectWorkType(workType) {
  if (!workType) return;
  state.workType = workType;
  writeStorage(workTypeStorageKey, workType);
  $$('.work-option').forEach(button => {
    const selected = button.dataset.workType === workType;
    const newlySelected = selected && !button.classList.contains('is-selected');
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    if (newlySelected) {
      button.classList.remove('just-selected');
      window.requestAnimationFrame(() => button.classList.add('just-selected'));
      window.setTimeout(() => button.classList.remove('just-selected'), 460);
      selectorFxController?.pulse(button);
    }
  });
  $('#workspacePrimaryPath').textContent = workType;
  $$('input[name="workType"]', $('#studentForm')).forEach(input => {
    if (input.value === workType) input.checked = true;
  });
}

function setWorkspaceTab(tabName) {
  $$('[data-workspace-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.workspaceTab === tabName));
  $$('[data-workspace-view]').forEach(view => view.classList.toggle('is-active', view.dataset.workspaceView === tabName));
}

function openDialog(dialog, form) {
  form.dataset.startedAt = String(Date.now());
  const savedStep = restoreDraft(form);
  // Re-render the optional video-intro preview when a draft is restored
  // (applyFormValues sets values without firing input events). No-op elsewhere.
  form.querySelector('[data-video-intro-input]')?.dispatchEvent(new Event('input', { bubbles: true }));
  setFormStep(form, savedStep);
  $('.form-message', form).textContent = '';
  $('.form-message', form).classList.remove('is-success');
  dialog.showModal();
  window.setTimeout(() => $('input, textarea, select', $('.form-step.is-active', form))?.focus(), 60);
}

function setFormStep(form, index) {
  const steps = $$('.form-step', form);
  const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
  form.dataset.step = String(safeIndex);
  steps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === safeIndex));
  $$('.form-progress span', form).forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === safeIndex));
  $('[data-form-back]', form).hidden = safeIndex === 0;
  $('[data-form-next]', form).hidden = safeIndex === steps.length - 1;
  $('[data-form-submit]', form).hidden = safeIndex !== steps.length - 1;
  if (safeIndex === steps.length - 1) renderReview(form);
  $('.form-step.is-active', form)?.scrollTo({ top: 0, behavior: 'instant' });
}

function validateStep(form) {
  const step = $('.form-step.is-active', form);
  const message = $('.form-message', form);
  message.textContent = '';
  for (const field of $$('input, textarea, select', step)) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  if (form.id === 'studentForm' && step.dataset.studentStep === '2') {
    if (!$$('input[name="studentIndustry"]:checked', form).length) {
      message.textContent = 'Choose at least one industry.';
      return false;
    }
  }
  return true;
}

function initSteppedForm(form) {
  $('[data-form-next]', form).addEventListener('click', () => {
    if (!validateStep(form)) return;
    setFormStep(form, Number(form.dataset.step || 0) + 1);
    saveDraft(form);
  });
  $('[data-form-back]', form).addEventListener('click', () => {
    setFormStep(form, Number(form.dataset.step || 0) - 1);
    saveDraft(form);
  });
}

function formValue(form, name) {
  return new FormData(form).get(name)?.toString().trim() || '';
}

function checkedValues(form, name) {
  return new FormData(form).getAll(name).map(value => value.toString());
}

function companyTimeCase(form) {
  const avoidedRaw = formValue(form, 'companyInternalHours');
  const reviewRaw = formValue(form, 'companyReviewMinutes');
  if (!avoidedRaw || !reviewRaw) return null;
  const avoided = Number(avoidedRaw);
  const reviewHours = Number(reviewRaw) / 60;
  if (!Number.isFinite(avoided) || !Number.isFinite(reviewHours)) return null;
  return { avoided, reviewHours, net: avoided - reviewHours };
}

function draftChecked(draft, name) {
  return Array.isArray(draft?.values?.[name]) && draft.values[name].length > 0;
}

function companyReadinessInputFromForm(form) {
  return {
    decision: formValue(form, 'companyDecision'),
    deliverable: formValue(form, 'companyDeliverable'),
    reviewer: formValue(form, 'companyReviewer'),
    acceptance: formValue(form, 'companyAcceptance'),
    approvedContext: formValue(form, 'companyContext'),
    publicOrApproved: $('[name="companyPublic"]', form).checked,
    deidentified: $('[name="companyDeidentified"]', form).checked,
    clientRecords: $('[name="companyClientRecords"]', form).checked,
    restrictedJudgment: $('[name="companyRestricted"]', form).checked,
    systemAccess: formValue(form, 'companyAccess'),
    internalHoursAvoided: Number(formValue(form, 'companyInternalHours')),
    reviewMinutes: Number(formValue(form, 'companyReviewMinutes')),
    studentHours: formValue(form, 'companyStudentHours'),
    deadline: formValue(form, 'companyDeadline'),
    budget: Number(formValue(form, 'companyBudget')),
  };
}

function companyReadinessInputFromDraft(draft) {
  return {
    decision: draftValue(draft, 'companyDecision'),
    deliverable: draftValue(draft, 'companyDeliverable'),
    reviewer: draftValue(draft, 'companyReviewer'),
    acceptance: draftValue(draft, 'companyAcceptance'),
    approvedContext: draftValue(draft, 'companyContext'),
    publicOrApproved: draftChecked(draft, 'companyPublic'),
    deidentified: draftChecked(draft, 'companyDeidentified'),
    clientRecords: draftChecked(draft, 'companyClientRecords'),
    restrictedJudgment: draftChecked(draft, 'companyRestricted'),
    systemAccess: draftValue(draft, 'companyAccess'),
    internalHoursAvoided: Number(draftValue(draft, 'companyInternalHours', 0)),
    reviewMinutes: Number(draftValue(draft, 'companyReviewMinutes', 0)),
    studentHours: draftValue(draft, 'companyStudentHours'),
    deadline: draftValue(draft, 'companyDeadline'),
    budget: Number(draftValue(draft, 'companyBudget', 0)),
  };
}

function companyPacketReadiness(input) {
  const netTime = input.internalHoursAvoided - (input.reviewMinutes / 60);
  const checks = [
    {
      key: 'outcome',
      label: 'Useful output is defined',
      detail: 'The deliverable and the decision it supports are both clear.',
      ready: Boolean(input.deliverable && input.decision),
    },
    {
      key: 'review',
      label: 'Review ownership is defined',
      detail: 'A company reviewer and fair acceptance criteria are named.',
      ready: Boolean(input.reviewer && input.acceptance),
    },
    {
      key: 'context',
      label: 'Approved context is portable',
      detail: 'The packet identifies usable context and at least one safe source type.',
      ready: Boolean(input.approvedContext && (input.publicOrApproved || input.deidentified)),
    },
    {
      key: 'boundary',
      label: 'Information boundary is safe',
      detail: 'No production access, protected records, or regulated judgment is requested.',
      ready: input.systemAccess === 'none' && !input.clientRecords && !input.restrictedJudgment,
    },
    {
      key: 'time',
      label: 'Time-saving case is positive',
      detail: 'Estimated employee time avoided is greater than the proposed review burden.',
      ready: Number.isFinite(netTime) && input.internalHoursAvoided > 0 && netTime > 0,
    },
    {
      key: 'terms',
      label: 'Working terms are concrete',
      detail: 'Student effort, a useful-by date, and a positive possible budget are supplied.',
      ready: Boolean(input.studentHours && input.deadline && Number.isFinite(input.budget) && input.budget > 0),
    },
  ];
  const readyCount = checks.filter(check => check.ready).length;
  return { checks, readyCount, total: checks.length, allReady: readyCount === checks.length };
}

function companyBoundaryBlockers(form) {
  const blockers = [];
  const access = $('[name="companyAccess"]', form);
  const records = $('[name="companyClientRecords"]', form);
  const restricted = $('[name="companyRestricted"]', form);
  if (access.value === 'production') {
    blockers.push({ field: access, message: 'change System access from production/client systems' });
  }
  if (records.checked) {
    blockers.push({ field: records, message: 'uncheck client, patient, or customer records' });
  }
  if (restricted.checked) {
    blockers.push({ field: restricted, message: 'uncheck regulated or licensed decisions' });
  }
  return blockers;
}

function renderCompanyBoundaryGuidance(form) {
  const panel = $('#companyBoundaryGuidance');
  const access = $('[name="companyAccess"]', form);
  const blockers = companyBoundaryBlockers(form);
  $$('[name="companyAccess"], [name="companyClientRecords"], [name="companyRestricted"]', form).forEach(field => {
    field.removeAttribute('aria-invalid');
    field.closest('label')?.classList.remove('is-blocked');
  });
  panel.classList.remove('is-warning', 'is-blocked');

  if (blockers.length) {
    blockers.forEach(({ field }) => {
      field.setAttribute('aria-invalid', 'true');
      field.closest('label')?.classList.add('is-blocked');
    });
    panel.classList.add('is-blocked');
    $('strong', panel).textContent = 'Change ' + blockers.length + ' safety selection' + (blockers.length === 1 ? '' : 's') + ' before sending';
    $('span', panel).textContent = blockers.map(({ message }) => message).join('; ') + '.';
  } else if (access.value === 'temporary') {
    panel.classList.add('is-warning');
    $('strong', panel).textContent = 'This access plan needs redesign';
    $('span', panel).textContent = 'You can send the inquiry, but Covenda must replace temporary access with approved copies before a project can proceed.';
  } else {
    $('strong', panel).textContent = 'Safe boundary selected';
    $('span', panel).textContent = 'Approved copies and de-identified examples can be reviewed. Red “not eligible” choices must stay unselected.';
  }
  return blockers;
}

function renderCompanyReadiness(readiness) {
  const status = $('#companyReadinessStatus');
  const list = $('#companyReadinessChecks');
  status.textContent = readiness.readyCount + ' of ' + readiness.total + ' inputs ready';
  status.classList.toggle('is-complete', readiness.allReady);
  list.replaceChildren();
  readiness.checks.forEach(check => {
    const item = document.createElement('li');
    const marker = document.createElement('i');
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    const detail = document.createElement('span');
    item.className = check.ready ? 'is-ready' : 'needs-input';
    marker.append(check.ready ? createIcon('icon-check') : document.createTextNode('—'));
    heading.textContent = check.label;
    detail.textContent = check.detail;
    copy.append(heading, detail);
    item.append(marker, copy);
    list.append(item);
  });
}

function renderReview(form) {
  if (form.id === 'studentForm') {
    renderDefinitionList($('#studentReviewSummary'), [
      ['Student', [formValue(form, 'studentName'), formValue(form, 'studentSchool')].filter(Boolean).join(' · ')],
      ['Industries', studentIndustries(form).join(', ')],
      ['Work paths', derivedWorkTypes(form).join(', ')],
      ['Strongest skill', [formValue(form, 'studentSkill'), formValue(form, 'studentSkillLevel')].filter(Boolean).join(' · ')],
      ['Availability', [formValue(form, 'studentAvailability'), formValue(form, 'studentHours'), formValue(form, 'studentDuration')].filter(Boolean).join(' · ')],
      ['Project terms', [formValue(form, 'studentCompensation'), formValue(form, 'studentPriority')].filter(Boolean).join(' · ')],
      ['Video intro', videoIntroReviewLabel(formValue(form, 'studentVideoIntro'))],
      ['Batch', formValue(form, 'studentBatch') || 'Not joined via a batch'],
    ]);
    return;
  }

  renderDefinitionList($('#companyReviewSummary'), [
    ['Company', [formValue(form, 'companyName'), formValue(form, 'companyIndustry')].filter(Boolean).join(' · ')],
    ['Delayed work', formValue(form, 'companyProblem')],
    ['Useful finish', formValue(form, 'companyDecision')],
    ['Deliverable', formValue(form, 'companyDeliverable')],
    ['Reviewer + acceptance', [formValue(form, 'companyReviewer'), formValue(form, 'companyAcceptance')].filter(Boolean).join(' · ')],
    ['Approved context', formValue(form, 'companyContext')],
    ['Information boundary', formValue(form, 'companyAccess') === 'none' ? 'Approved copies only · no system access' : formValue(form, 'companyAccess')],
    ['Effort + budget', [formValue(form, 'companyStudentHours'), formValue(form, 'companyBudget') ? '$' + formValue(form, 'companyBudget') + ' possible budget' : ''].filter(Boolean).join(' · ')],
  ]);

  renderCompanyReadiness(companyPacketReadiness(companyReadinessInputFromForm(form)));

  const timeCase = companyTimeCase(form);
  const panel = $('#companyTimeCase');
  const heading = $('strong', panel);
  const detail = $('span', panel);
  panel.classList.remove('is-positive', 'is-warning');
  heading.textContent = 'Estimated time-saving case';
  if (!timeCase) {
    detail.textContent = 'Add employee time avoided and review minutes to calculate it.';
  } else if (timeCase.net > 0) {
    panel.classList.add('is-positive');
    detail.textContent = 'About ' + timeCase.net.toFixed(1) + ' internal hours remain after the proposed review burden. Covenda still validates this estimate.';
  } else {
    panel.classList.add('is-warning');
    detail.textContent = 'The proposed review burden may equal or exceed the time avoided. Covenda would redesign or stop this project.';
  }
}

// Feature 1 — make credibility legible on the student profile: show WHO endorsed you
// (from the ?ref= partner referral), or an honest "earn it through work" state. Reuses
// the existing referral data — no new model.
function renderProfileCredibility() {
  const host = $('#profileCredibility');
  if (!host) return;
  host.innerHTML = '';
  const ref = activeReferral();
  const kicker = document.createElement('p');
  kicker.className = 'profile-cred-kicker';
  kicker.textContent = 'Credibility';
  host.append(kicker);
  const card = document.createElement('div');
  card.className = 'profile-cred-card' + (ref && ref.via ? ' is-endorsed' : ' is-open');
  if (ref && ref.via) {
    const tag = document.createElement('span');
    tag.className = 'cred-tag cred-tag-endorsed';
    tag.innerHTML = '<svg><use href="#icon-shield"/></svg>Endorsed';
    const who = document.createElement('p');
    who.className = 'profile-cred-who';
    who.append(document.createTextNode('Endorsed by '));
    const b = document.createElement('b');
    b.textContent = ref.via;
    who.append(b);
    const note = document.createElement('p');
    note.className = 'profile-cred-note';
    note.textContent = 'A trust head-start, not a placement. Reviewed work earns the verified rungs.';
    card.append(tag, who, note);
  } else {
    const who = document.createElement('p');
    who.className = 'profile-cred-who';
    who.textContent = 'No endorsement yet — everyone can still earn credibility.';
    const note = document.createElement('p');
    note.className = 'profile-cred-note';
    note.textContent = 'Ask a professor, club, or career center to vouch for you — or build proof through reviewed work.';
    card.append(who, note);
  }
  host.append(card);
}

// Step 1 — club affiliations (with company track record) on the student profile.
// Illustrative until real club track records exist.
function renderProfileAffiliations() {
  const host = $('#profileAffiliations');
  if (!host) return;
  host.innerHTML = '';
  const kicker = document.createElement('p');
  kicker.className = 'profile-cred-kicker';
  kicker.textContent = 'Clubs & affiliations';
  host.append(kicker);
  const ref = activeReferral();
  const card = document.createElement('div');
  card.className = 'profile-cred-card' + (ref && ref.via ? ' is-endorsed' : '');
  if (ref && ref.via) {
    const who = document.createElement('p');
    who.className = 'profile-cred-who';
    who.append(document.createTextNode('Member · '));
    const b = document.createElement('b');
    b.textContent = ref.via;
    who.append(b);
    const note = document.createElement('p');
    note.className = 'profile-cred-note';
    note.textContent = 'A club’s track record grows as it places students with companies — its trust indicator ("worked with …") shows here once verified.';
    card.append(who, note);
  } else {
    const who = document.createElement('p');
    who.className = 'profile-cred-who';
    who.textContent = 'No club affiliations yet.';
    const note = document.createElement('p');
    note.className = 'profile-cred-note';
    note.textContent = 'Join a club or get referred by one — clubs that have worked with companies lend their track record to your profile.';
    card.append(who, note);
  }
  host.append(card);
}

// Step 1 — work history / objective evidence on the student profile.
function renderProfileEvidence() {
  const host = $('#profileEvidence');
  if (!host) return;
  host.innerHTML = '';
  const kicker = document.createElement('p');
  kicker.className = 'profile-cred-kicker';
  kicker.textContent = 'Work history & evidence';
  host.append(kicker);
  const draft = readStorage(draftKeys.studentForm, null);
  const skill = draftValue(draft, 'studentSkill');
  const level = draftValue(draft, 'studentSkillLevel');
  const card = document.createElement('div');
  card.className = 'profile-cred-card';
  const dl = document.createElement('dl');
  dl.className = 'profile-evidence-list';
  const rows = [];
  if (skill) rows.push(['Declared skill', skill + (level ? ' · ' + level : '') + ' (self-reported)']);
  rows.push(['Reviewed work', 'None yet — join a batch to complete bounded, reviewed projects.']);
  rows.push(['Verified record', 'Earned when an employer reviewer accepts your work.']);
  for (const [k, v] of rows) {
    const wrap = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    wrap.append(dt, dd);
    dl.append(wrap);
  }
  card.append(dl);
  host.append(card);
}

function renderWorkspaceDrafts() {
  const studentDraft = readStorage(draftKeys.studentForm, null);
  const companyDraft = readStorage(draftKeys.companyForm, null);
  const hasStudentDraft = hasMeaningfulDraft(studentDraft);
  const hasCompanyDraft = hasMeaningfulDraft(companyDraft);

  $('#studentDraftBanner').hidden = !hasStudentDraft;
  $('#companyDraftBanner').hidden = !hasCompanyDraft;

  if (hasStudentDraft) {
    const paths = draftValue(studentDraft, 'workType', state.workType);
    const primaryPath = paths.split(', ')[0] || state.workType;
    $('#workspacePrimaryPath').textContent = primaryPath;
    $('#studentDraftMeta').textContent = [paths, draftValue(studentDraft, 'studentAvailability')].filter(Boolean).join(' · ') || 'Continue where you left off on this device.';
    $('#studentWorkspaceSummaryTitle').textContent = draftValue(studentDraft, 'studentName', 'Interest profile in progress');
    renderDefinitionList($('#studentWorkspaceSummary'), [
      ['Work paths', paths],
      ['Strongest skill', [draftValue(studentDraft, 'studentSkill'), draftValue(studentDraft, 'studentSkillLevel')].filter(Boolean).join(' · ')],
      ['Availability', [draftValue(studentDraft, 'studentAvailability'), draftValue(studentDraft, 'studentHours')].filter(Boolean).join(' · ')],
    ]);
    renderVideoIntroCard($('#studentVideoIntroWorkspace'), draftValue(studentDraft, 'studentVideoIntro'), {
      context: 'workspace',
      onReplace: () => $('[data-action="student-form"]')?.click(),
      onRemove: () => {
        const draft = readStorage(draftKeys.studentForm, null);
        if (draft?.values) { draft.values.studentVideoIntro = ''; writeStorage(draftKeys.studentForm, draft); }
        renderWorkspaceDrafts();
      },
    });
  } else {
    $('#studentWorkspaceSummaryTitle').textContent = 'No draft details yet';
    renderDefinitionList($('#studentWorkspaceSummary'), [
      ['Work paths', 'Choose the work you want to prove.'],
      ['Strongest skill', 'Add an honest current level.'],
      ['Availability', 'Set your preferred timing.'],
    ]);
    const workspaceCard = $('#studentVideoIntroWorkspace');
    if (workspaceCard) workspaceCard.hidden = true;
  }
  renderProfileCredibility();
  renderProfileAffiliations();
  renderProfileEvidence();

  if (hasCompanyDraft) {
    const deliverable = draftValue(companyDraft, 'companyDeliverable', 'Working Project Packet');
    const readiness = companyPacketReadiness(companyReadinessInputFromDraft(companyDraft));
    const avoided = Number(draftValue(companyDraft, 'companyInternalHours', 0));
    const review = Number(draftValue(companyDraft, 'companyReviewMinutes', 0)) / 60;
    const net = avoided || review ? avoided - review : null;
    $('#companyDraftMeta').textContent = [draftValue(companyDraft, 'companyName'), readiness.readyCount + ' of ' + readiness.total + ' scoping inputs ready'].filter(Boolean).join(' · ');
    $('#companyWorkspaceSummaryTitle').textContent = draftValue(companyDraft, 'companyName', 'Project Packet in progress');
    renderDefinitionList($('#companyWorkspaceSummary'), [
      ['Deliverable', deliverable],
      ['Information boundary', draftValue(companyDraft, 'companyAccess') === 'none' ? 'Approved copies only · no production access' : draftValue(companyDraft, 'companyAccess', 'Not set')],
      ['Time-saving case', net === null ? 'Add employee time avoided and review minutes.' : net.toFixed(1) + ' estimated net internal hours'],
      ['Scoping readiness', readiness.allReady ? '6 of 6 inputs ready · human review still required' : readiness.readyCount + ' of ' + readiness.total + ' inputs ready'],
    ]);
  } else {
    $('#companyWorkspaceSummaryTitle').textContent = 'No company problem draft yet';
    renderDefinitionList($('#companyWorkspaceSummary'), [
      ['Deliverable', 'Describe a useful finish.'],
      ['Information boundary', 'Identify safe approved inputs.'],
      ['Time-saving case', 'Estimate employee time avoided.'],
      ['Scoping readiness', 'Complete six checks before human scoping.'],
    ]);
  }

  const submissions = savedSubmissions();
  if (!submissions.some(item => item.type === 'student_interest')) {
    $('#studentProfileStatus').textContent = hasStudentDraft ? 'Draft in progress' : 'Ready to submit';
  }
  if (!submissions.some(item => item.type === 'employer_intake')) {
    $('#companyProblemStatus').textContent = hasCompanyDraft ? 'Draft in progress' : 'Ready to submit';
  }
}

async function sendSubmission(payload) {
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'The server returned an unreadable response.' }));
  if (!response.ok || !result.ok) throw new Error(result.error || 'We could not save this right now.');
  return result;
}

async function findServerReceipt(reference, email) {
  const response = await fetch('/api/receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, email }),
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'The server returned an unreadable response.' }));
  if (!response.ok || !result.ok) throw new Error(result.error || 'We could not find that receipt right now.');
  return result;
}

function submissionDeliveryMessage(result) {
  return result.syncStatus === 'synced' || result.storage === 'supabase'
    ? ' · synced to Covenda’s primary inbox.'
    : ' · saved securely; primary inbox sync is pending.';
}

function applyDeliveryHealth(primary, { checkedAt = '' } = {}) {
  const status = primary?.status || 'unavailable';
  const sidebar = $('#deliveryStatus');
  const sidebarCopy = $('small', sidebar);
  const badge = $('#deliveryStatusBadge');
  const details = $('#deliveryDetails');
  const detailsTitle = $('#deliveryDetailsTitle');
  const detailsHelp = $('#deliveryDetailsHelp');
  const projectRef = $('#deliveryProjectRef');
  const copy = {
    ready: 'Primary inbox connected',
    unavailable: 'Backup-only mode · primary inbox needs attention',
    'not-configured': 'Primary inbox is not configured',
    checking: 'Checking primary inbox…',
  }[status] || 'Delivery status unavailable';
  if (sidebar) sidebar.dataset.status = status;
  if (sidebarCopy) sidebarCopy.textContent = copy;
  if (badge) {
    badge.classList.toggle('is-ready', status === 'ready');
    badge.classList.toggle('is-pending', status !== 'ready');
    badge.lastChild.textContent = status === 'ready' ? ' Primary inbox connected' : ' Primary sync needs attention';
  }
  if (details) details.dataset.status = status;
  if (detailsTitle) {
    detailsTitle.textContent = status === 'ready'
      ? 'Submission saved securely'
      : status === 'checking'
        ? 'Checking the primary inbox…'
        : 'Primary inbox needs attention';
  }
  if (projectRef) projectRef.textContent = primary?.destination?.projectRef || (status === 'checking' ? 'Checking…' : 'Unavailable');
  if (detailsHelp) {
    const checkedCopy = checkedAt ? ' Last checked ' + receiptDate(checkedAt) + '.' : '';
    detailsHelp.textContent = status === 'ready'
      ? 'New server-confirmed receipts are written to this project and table.' + checkedCopy
      : status === 'checking'
        ? 'A server check is running. Your private answers are never returned by this status check.'
        : 'New receipts may use private backup storage until the primary connection is repaired.' + checkedCopy;
  }
}

function refreshDeliveryHealth({ force = false } = {}) {
  if (deliveryHealthRequest) return deliveryHealthRequest;
  applyDeliveryHealth({ status: 'checking' });
  const refreshButton = $('#deliveryRefresh');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Checking…';
  }
  deliveryHealthRequest = fetch('/api/submissions', { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error('Delivery check failed.');
      return response.json();
    })
    .then(result => {
      applyDeliveryHealth(result.primary, { checkedAt: result.checkedAt });
      return result.primary;
    })
    .catch(() => {
      applyDeliveryHealth({ status: 'unavailable' }, { checkedAt: new Date().toISOString() });
      return { status: 'unavailable' };
    })
    .finally(() => {
      deliveryHealthRequest = null;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Check again';
      }
    });
  return deliveryHealthRequest;
}

function applySubmissionDelivery(result) {
  applyDeliveryHealth({
    status: result.storage === 'supabase' ? 'ready' : 'unavailable',
    route: result.storageRoute,
    destination: result.destination,
  }, { checkedAt: result.createdAt });
}

function savedSubmissions() {
  const items = readStorage(storageKey, []);
  return Array.isArray(items) ? items : [];
}

function saveSubmission(submission) {
  const item = {
    schemaVersion: 1,
    status: 'received',
    createdAt: new Date().toISOString(),
    ...submission,
  };
  const items = savedSubmissions().filter(existing => existing.reference !== item.reference);
  items.unshift(item);
  writeStorage(storageKey, items.slice(0, 12));
  renderLocalSubmissionState();
}

function submissionAudience(item) {
  if (item.type === 'employer_intake') return 'company';
  if (item.type === 'university_partner' || item.type === 'referrer_endorsement') return 'university';
  if (item.type === 'call_request') return 'company';
  return 'student';
}

function submissionLabel(item) {
  if (item.type === 'employer_intake') return 'Company problem intake';
  if (item.type === 'university_partner') return 'Student roster';
  if (item.type === 'referrer_endorsement') return 'Student endorsements';
  if (item.type === 'call_request') return 'Call request';
  return 'Student interest profile';
}

function submissionStatusLabel(status) {
  return {
    received: 'Queued for human review',
    reviewing: 'In human review',
    needs_information: 'More information requested',
    packet_proposed: 'Project Packet proposed',
    approval_pending: 'Approval pending',
    approved: 'Approved',
    declined: 'Closed',
    archived: 'Archived',
  }[status] || 'Status available by email';
}

function submissionStorageLabel(item) {
  if (item.storage === 'supabase') return 'Primary inbox';
  if (item.storage === 'blob') return 'Backup · sync pending';
  return 'Delivery unverified';
}

function submissionProgress(item) {
  if (item.type === 'employer_intake') {
    return [
      ['Received', 'Your problem and company context are saved.'],
      ['Human scoping', 'Covenda checks value, boundaries, and review burden.'],
      ['Packet decision', 'You receive questions or a proposed Project Packet.'],
    ];
  }
  if (item.type === 'university_partner') {
    return [
      ['Received', 'Your roster and organization details are saved.'],
      ['Pilot review', 'Covenda reviews interest coverage for open pilot work.'],
      ['Follow-up', 'Covenda contacts you as safe projects become available.'],
    ];
  }
  if (item.type === 'referrer_endorsement') {
    return [
      ['Received', 'Your endorsements and role are saved.'],
      ['Credibility applied', 'Endorsed students carry your vouch into the pilot.'],
      ['Follow-up', 'Covenda contacts you as safe projects become available.'],
    ];
  }
  return [
    ['Received', 'Your interests and working preferences are saved.'],
    ['Pilot-fit review', 'Covenda reviews fit for the current pilot.'],
    ['Follow-up', 'Covenda contacts you if a suitable next step exists.'],
  ];
}

function receiptDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function receiptSummary(item) {
  if (item.summary) return item.summary;
  if (item.recovered) return 'This server-confirmed receipt was recovered on this device. Private form answers were not downloaded.';
  if (item.type === 'employer_intake') return 'A company problem was received for human scoping.';
  if (item.type === 'university_partner') return 'A student roster was received for pilot review.';
  if (item.type === 'referrer_endorsement') return 'Your student endorsements were received for pilot review.';
  return 'A student interest profile was received for pilot-fit review.';
}

function companyPacketSnapshot(form, readiness) {
  return {
    schemaVersion: 1,
    values: serializeDraft(form).values,
    readiness: {
      readyCount: readiness.readyCount,
      total: readiness.total,
      checks: readiness.checks.map(({ key, label, detail, ready }) => ({ key, label, detail, ready })),
    },
  };
}

function companySnapshotRows(snapshot) {
  const input = companyReadinessInputFromDraft(snapshot);
  const netTime = input.internalHoursAvoided - (input.reviewMinutes / 60);
  const boundary = input.systemAccess === 'none' && !input.clientRecords && !input.restrictedJudgment
    ? 'Approved copies only · no production access or restricted records'
    : 'Requires boundary review';
  return [
    ['Delayed work', draftValue(snapshot, 'companyProblem')],
    ['Useful finish', input.decision],
    ['Deliverable', input.deliverable],
    ['Reviewer', input.reviewer],
    ['Acceptance criteria', input.acceptance],
    ['Approved context', input.approvedContext],
    ['Information boundary', boundary],
    ['Working terms', [input.studentHours, input.deadline, input.budget > 0 ? '$' + input.budget + ' possible budget' : ''].filter(Boolean).join(' · ')],
    ['Estimated time case', Number.isFinite(netTime) ? netTime.toFixed(1) + ' net internal hours before Covenda validation' : 'Not calculated'],
  ];
}

function renderReceiptPacket(item) {
  const section = document.createElement('section');
  const header = document.createElement('header');
  const heading = document.createElement('div');
  const label = document.createElement('small');
  const title = document.createElement('h3');
  const note = document.createElement('p');
  const summary = document.createElement('dl');
  const readiness = document.createElement('ul');
  section.className = 'receipt-packet';
  section.id = 'packet-' + item.reference.replace(/[^a-z0-9-]/gi, '');
  section.hidden = true;
  label.textContent = 'Private local snapshot';
  title.textContent = 'Working packet as submitted';
  note.textContent = 'This is the intake version Covenda received. It remains unapproved until human scoping is complete.';
  heading.append(label, title);
  header.append(heading, note);
  summary.className = 'receipt-packet-summary';
  renderDefinitionList(summary, companySnapshotRows(item.packetSnapshot));
  readiness.className = 'receipt-packet-checks';
  const checks = item.packetSnapshot.readiness?.checks || [];
  checks.forEach(check => {
    const entry = document.createElement('li');
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    const detail = document.createElement('span');
    entry.className = check.ready ? 'is-ready' : 'needs-input';
    entry.append(check.ready ? createIcon('icon-check') : createIcon('icon-clock'));
    strong.textContent = check.label;
    detail.textContent = check.detail;
    copy.append(strong, detail);
    entry.append(copy);
    readiness.append(entry);
  });
  section.append(header, summary, readiness);
  return section;
}

function newerRevisionFor(reference) {
  return savedSubmissions().find(item => item.revisionOf === reference);
}

function appendMeta(list, term, detail) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = term;
  dd.textContent = detail;
  row.append(dt, dd);
  list.append(row);
}

function renderReceipt(item) {
  const article = document.createElement('article');
  article.className = 'receipt-card';
  article.dataset.reference = item.reference;

  const header = document.createElement('header');
  const heading = document.createElement('div');
  const category = document.createElement('small');
  const title = document.createElement('h2');
  const status = document.createElement('span');
  category.textContent = item.revisionOf ? 'Company problem revision' : submissionLabel(item);
  title.textContent = item.title || submissionLabel(item);
  status.className = 'receipt-status';
  const primaryPending = item.storage !== 'supabase' || item.syncStatus === 'pending';
  if (primaryPending) status.classList.add('is-pending');
  status.append(
    createIcon(primaryPending ? 'icon-clock' : 'icon-check'),
    document.createTextNode(primaryPending ? 'Primary sync pending' : item.status === 'received' ? 'Received' : submissionStatusLabel(item.status)),
  );
  heading.append(category, title);
  header.append(heading, status);

  const summary = document.createElement('p');
  summary.className = 'receipt-summary';
  summary.textContent = receiptSummary(item);

  const lineage = document.createElement('p');
  const newerRevision = item.type === 'employer_intake' ? newerRevisionFor(item.reference) : null;
  if (item.revisionOf || newerRevision) {
    lineage.className = 'receipt-lineage';
    lineage.append(createIcon('icon-file'));
    lineage.append(document.createTextNode(item.revisionOf
      ? 'Revision of ' + item.revisionOf + ' · the earlier receipt remains unchanged.'
      : 'A newer revision was received as ' + newerRevision.reference + '.'));
  }

  const readiness = item.type === 'employer_intake' && item.packetReadiness;
  const readinessNote = document.createElement('p');
  if (readiness) {
    readinessNote.className = 'receipt-readiness';
    readinessNote.append(createIcon(readiness.readyCount === readiness.total ? 'icon-check' : 'icon-clock'));
    readinessNote.append(document.createTextNode(readiness.readyCount + ' of ' + readiness.total + ' scoping inputs supplied · Human review still required.'));
  }

  const meta = document.createElement('dl');
  meta.className = 'receipt-meta';
  appendMeta(meta, 'Reference', item.reference || 'Unavailable');
  appendMeta(meta, 'Received', receiptDate(item.createdAt));
  appendMeta(meta, 'Server record', submissionStorageLabel(item));
  appendMeta(meta, 'Current state', submissionStatusLabel(item.status));

  const progress = document.createElement('ol');
  progress.className = 'receipt-progress';
  submissionProgress(item).forEach(([label, detail], index) => {
    const step = document.createElement('li');
    const marker = document.createElement('i');
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    const description = document.createElement('span');
    step.className = index === 0 ? 'is-complete' : index === 1 ? 'is-current' : '';
    marker.append(index === 0 ? createIcon('icon-check') : document.createTextNode(String(index + 1)));
    strong.textContent = label;
    description.textContent = detail;
    copy.append(strong, description);
    step.append(marker, copy);
    progress.append(step);
  });

  const footer = document.createElement('footer');
  const boundary = document.createElement('p');
  const actions = document.createElement('div');
  boundary.textContent = item.type === 'employer_intake'
    ? 'This receipt does not publish, fund, or assign the project. Covenda reviews it first.'
    : item.type === 'university_partner'
      ? 'This receipt does not create accounts or guarantee placement. Covenda reviews the roster first.'
      : 'This receipt is not a job application, match, or work guarantee. Covenda reviews pilot fit first.';
  actions.className = 'receipt-actions';
  const receiptActions = [['verify', 'Refresh status', 'icon-search'], ['copy', 'Copy reference', 'icon-copy'], ['download', 'Download receipt', 'icon-download']];
  if (item.type === 'employer_intake' && item.packetSnapshot) {
    receiptActions.unshift(['packet', 'View packet', 'icon-file'], ['revise', 'Revise packet', 'icon-arrow-right']);
  }
  // F5: a student receipt is proof — offer a shareable credential card.
  if (item.type === 'student_interest') {
    receiptActions.unshift(['credential', 'Share credential', 'icon-shield']);
  }
  for (const [action, label, icon] of receiptActions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'receipt-action';
    button.dataset.receiptAction = action;
    button.dataset.reference = item.reference;
    if (action === 'packet') {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'packet-' + item.reference.replace(/[^a-z0-9-]/gi, ''));
    }
    button.append(createIcon(icon), document.createTextNode(label));
    actions.append(button);
  }
  footer.append(boundary, actions);
  article.append(header, summary);
  if (item.revisionOf || newerRevision) article.append(lineage);
  if (readiness) article.append(readinessNote);
  article.append(meta);
  if (item.packetSnapshot) article.append(renderReceiptPacket(item));
  article.append(progress, footer);
  return article;
}

function renderSubmissionHistory() {
  const history = $('#submissionHistory');
  if (!history) return;
  const submissions = savedSubmissions().filter(item => submissionAudience(item) === state.audience);
  history.replaceChildren();
  if (submissions.length) {
    submissions.forEach(item => history.append(renderReceipt(item)));
    return;
  }

  const empty = document.createElement('div');
  const heading = document.createElement('h2');
  const detail = document.createElement('p');
  const action = document.createElement('button');
  empty.className = 'submission-empty';
  const emptyCopy = {
    student: {
      heading: 'No student receipt yet',
      detail: 'Complete an interest profile and its server-confirmed reference will appear here.',
      action: 'Build interest profile',
    },
    company: {
      heading: 'No company receipt yet',
      detail: 'Submit a bounded company problem and its server-confirmed reference will appear here.',
      action: 'Start company intake',
    },
    university: {
      heading: 'No roster receipt yet',
      detail: 'Send a student roster and its server-confirmed reference will appear here.',
      action: 'Build your roster',
    },
  }[state.audience] || {};
  heading.textContent = emptyCopy.heading;
  detail.textContent = emptyCopy.detail;
  action.type = 'button';
  action.className = 'outline-button compact';
  action.dataset.receiptAction = 'start';
  action.append(document.createTextNode(emptyCopy.action), createIcon('icon-arrow-right'));
  empty.append(createIcon('icon-file'), heading, detail, action);
  history.append(empty);
}

function submissionForReference(reference) {
  return savedSubmissions().find(item => item.reference === reference);
}

function toggleReceiptPacket(button, item) {
  const packet = $('#packet-' + item.reference.replace(/[^a-z0-9-]/gi, ''));
  if (!packet) return;
  const expanding = packet.hidden;
  packet.hidden = !expanding;
  button.setAttribute('aria-expanded', String(expanding));
  button.replaceChildren(createIcon('icon-file'), document.createTextNode(expanding ? 'Hide packet' : 'View packet'));
}

function startPacketRevision(item) {
  if (!item.packetSnapshot?.values) {
    showToast('This older receipt does not include a revisable local packet.');
    return;
  }
  companyForm.reset();
  applyFormValues(companyForm, item.packetSnapshot.values);
  companyForm.dataset.revisionOf = item.reference;
  companyForm.dataset.step = '0';
  saveDraft(companyForm);
  renderRevisionContext();
  openDialog(companyDialog, companyForm);
  showToast('Revision started. Review every field before sending.');
}

async function copyReceiptReference(reference) {
  try {
    await navigator.clipboard.writeText(reference);
    showToast('Reference copied.');
  } catch {
    showToast('Copy is unavailable. Reference: ' + reference);
  }
}

function downloadReceipt(item) {
  const receipt = {
    reference: item.reference,
    type: item.type,
    status: item.status || 'received',
    receivedAt: item.createdAt,
    title: item.title || submissionLabel(item),
    summary: receiptSummary(item),
    ...(item.revisionOf ? { revisionOf: item.revisionOf } : {}),
    ...(item.packetReadiness ? { scopingInputs: item.packetReadiness } : {}),
    boundary: item.type === 'employer_intake'
      ? 'Human scoping is required before publication, funding, or assignment.'
      : 'Pilot-fit review is required before any project opportunity.',
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'covenda-' + item.reference.toLowerCase() + '-receipt.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('Receipt downloaded.');
}

function openReceiptRecovery(item) {
  const recovery = $('#receiptRecovery');
  const reference = $('[name="receiptReference"]', recovery);
  const email = $('[name="receiptEmail"]', recovery);
  recovery.open = true;
  reference.value = item.reference;
  recovery.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => email.focus(), 260);
}

function renderLocalSubmissionState() {
  const submissions = savedSubmissions();
  const student = submissions.find(item => item.type === 'student_interest');
  const company = submissions.find(item => item.type === 'employer_intake');
  if (student) {
    $('#studentProfileStatus').textContent = 'Received · ' + student.reference;
    $('#studentProfileStatus').classList.add('ready');
    $('#studentReviewStatus').replaceChildren(createIcon('icon-clock'), document.createTextNode('Human review pending'));
  }
  if (company) {
    $('#companyProblemStatus').textContent = 'Received · ' + company.reference;
    $('#companyProblemStatus').classList.add('ready');
    $('#companyScopingStatus').replaceChildren(createIcon('icon-clock'), document.createTextNode('Human scoping queued'));
  }
  renderSubmissionHistory();
  renderWorkspaceDrafts();
  renderUniversityWorkspace();
  renderProofRecord();
}

// §8 industry-first cascading. Canonical verticals (matching the portal/matching taxonomy) →
// specializations, each mapped to a work type so work_types stay DERIVABLE for matching even
// though students no longer pick them directly. One editable source of truth.
const INDUSTRY_TREE = {
  'Accounting & finance': [
    { label: 'Month-end close & reconciliation', workType: 'Data & spreadsheets' },
    { label: 'Financial modeling & analysis', workType: 'Data & spreadsheets' },
    { label: 'Bookkeeping & AP/AR cleanup', workType: 'Operations' },
    { label: 'Market & pricing research', workType: 'Research' },
  ],
  'Software & AI': [
    { label: 'Product & market research', workType: 'Research' },
    { label: 'QA & test cases', workType: 'QA & testing' },
    { label: 'Data cleanup & analysis', workType: 'Data & spreadsheets' },
    { label: 'Docs & knowledge base', workType: 'Writing & documentation' },
  ],
  'Healthcare operations': [
    { label: 'Process & workflow mapping', workType: 'Operations' },
    { label: 'Research & literature synthesis', workType: 'Research' },
    { label: 'SOPs & documentation', workType: 'Writing & documentation' },
  ],
  'Consumer & retail': [
    { label: 'Customer & market research', workType: 'Research' },
    { label: 'Operations & CRM hygiene', workType: 'Operations' },
    { label: 'Reporting & data cleanup', workType: 'Data & spreadsheets' },
  ],
  'Professional services': [
    { label: 'Research & briefs', workType: 'Research' },
    { label: 'Process documentation', workType: 'Writing & documentation' },
    { label: 'Operations support', workType: 'Operations' },
  ],
  'Not sure yet — show me everything': [
    { label: 'Open to any safe project', workType: 'Research' },
  ],
};
function studentIndustries(form) { return checkedValues(form, 'studentIndustry'); }
function derivedWorkTypes(form) {
  const set = new Set();
  for (const industry of studentIndustries(form)) for (const spec of (INDUSTRY_TREE[industry] || [])) set.add(spec.workType);
  return [...set];
}
// Show, derived from the picked industries, the concrete work a student would end up on — the
// "cascade" without a second required input, so drafts stay simple to restore.
function renderStudentSpecializations(form) {
  const el = $('#studentSpecializations', form) || $('#studentSpecializations');
  if (!el) return;
  const specs = [];
  for (const industry of studentIndustries(form)) for (const spec of (INDUSTRY_TREE[industry] || [])) if (!specs.includes(spec.label)) specs.push(spec.label);
  el.textContent = specs.length ? `We’ll surface projects like: ${specs.slice(0, 6).join(' · ')}` : '';
}

function studentPayload(form) {
  const industries = studentIndustries(form);
  const workTypes = derivedWorkTypes(form);
  return {
    type: 'student_interest',
    startedAt: Number(form.dataset.startedAt),
    website: formValue(form, 'website'),
    consent: $('[name="studentConsent"]', form).checked,
    contact: {
      name: formValue(form, 'studentName'),
      email: formValue(form, 'studentEmail'),
    },
    school: formValue(form, 'studentSchool'),
    educationLevel: formValue(form, 'studentEducation'),
    graduationYear: Number(formValue(form, 'studentGraduation')),
    major: formValue(form, 'studentMajor'),
    timezone: formValue(form, 'studentTimezone'),
    interest: (industries.length ? industries : workTypes).join(', '),
    interests: {
      workTypes,
      industries,
      workStyle: formValue(form, 'studentWorkStyle'),
      ambiguityComfort: formValue(form, 'studentAmbiguity'),
      avoid: '',
    },
    skills: [{
      name: formValue(form, 'studentSkill'),
      level: formValue(form, 'studentSkillLevel'),
    }],
    links: {
      portfolio: formValue(form, 'studentPortfolio'),
      github: '',
      videoIntro: formValue(form, 'studentVideoIntro'),
    },
    videoTranscript: formValue(form, 'studentVideoTranscript'),
    batch: formValue(form, 'studentBatch'),
    referral: activeReferralPayload(),
    stage: 'profile_completed',
    linkedQuickRef: (readStorage(QUICK_KEY, null) || {}).reference || '',
    availability: formValue(form, 'studentAvailability'),
    preferences: {
      hoursPerWeek: formValue(form, 'studentHours'),
      duration: formValue(form, 'studentDuration'),
      minimumCompensation: formValue(form, 'studentCompensation'),
      liveMeetings: formValue(form, 'studentMeetings'),
      screening: formValue(form, 'studentScreening'),
      priorities: [formValue(form, 'studentPriority')],
      informationNeeded: 'Scope, fixed pay, deadline, approved inputs, and named reviewer.',
    },
    age18: $('[name="studentAge"]', form).checked,
  };
}

function companyPayload(form) {
  return {
    type: 'employer_intake',
    ...(form.dataset.revisionOf ? { revisionOf: form.dataset.revisionOf } : {}),
    startedAt: Number(form.dataset.startedAt),
    // Employer-side referral attribution (GTM Move 3): if the firm arrived through a partner's
    // ?ref= link, the code rides along so the partner's track record credits the intro.
    referral: activeReferralPayload(),
    website: formValue(form, 'website'),
    consent: $('[name="companyConsent"]', form).checked,
    contact: {
      name: formValue(form, 'companyContactName'),
      email: formValue(form, 'companyContactEmail'),
      company: formValue(form, 'companyName'),
      role: formValue(form, 'companyRole'),
    },
    organization: {
      website: formValue(form, 'companyWebsite'),
      size: formValue(form, 'companySize'),
      industry: formValue(form, 'companyIndustry'),
      reason: formValue(form, 'companyReason'),
      workFrequency: formValue(form, 'companyFrequency'),
    },
    project: {
      vertical: formValue(form, 'companyIndustry'),
      usefulBy: formValue(form, 'companyDeadline'),
      lastInstance: formValue(form, 'companyProblem'),
      decisionSupported: formValue(form, 'companyDecision'),
      deliverable: formValue(form, 'companyDeliverable'),
      reviewer: formValue(form, 'companyReviewer'),
      acceptance: formValue(form, 'companyAcceptance'),
      reviewMinutes: Number(formValue(form, 'companyReviewMinutes')),
      studentHours: formValue(form, 'companyStudentHours'),
      internalHoursAvoided: Number(formValue(form, 'companyInternalHours')),
      budget: Number(formValue(form, 'companyBudget')),
      systemAccess: formValue(form, 'companyAccess'),
      sources: {
        publicOrApproved: $('[name="companyPublic"]', form).checked,
        deidentified: $('[name="companyDeidentified"]', form).checked,
        clientRecords: $('[name="companyClientRecords"]', form).checked,
        restrictedJudgment: $('[name="companyRestricted"]', form).checked,
      },
      approvedContext: formValue(form, 'companyContext'),
    },
  };
}

const studentForm = $('#studentForm');
const companyForm = $('#companyForm');
const studentDialog = $('#studentDialog');
const companyDialog = $('#companyDialog');

initSteppedForm(studentForm);
initSteppedForm(companyForm);

// §8: reflect the picked industries as a derived specialization line, and keep it in sync.
studentForm.addEventListener('change', event => { if (event.target && event.target.name === 'studentIndustry') renderStudentSpecializations(studentForm); });
renderStudentSpecializations(studentForm);

for (const form of [studentForm, companyForm]) {
  restoreDraft(form);
  if (form === studentForm) renderStudentSpecializations(form);
  form.addEventListener('input', () => saveDraft(form));
  form.addEventListener('change', () => saveDraft(form));
  $('[data-clear-draft]', form).addEventListener('click', () => {
    discardDraft(form);
    showToast('Local draft cleared.');
  });
}

renderCompanyBoundaryGuidance(companyForm);
companyForm.addEventListener('input', () => renderCompanyBoundaryGuidance(companyForm));
companyForm.addEventListener('change', () => renderCompanyBoundaryGuidance(companyForm));

// ---- Quick join (low-friction name + email) ------------------------------
// Primary student entry point: get on the pilot list in seconds, then optionally
// complete the full profile now (inline) or later (banner). Matched on email; the
// full submission carries stage='profile_completed' + linkedQuickRef for status.
const quickJoinDialog = $('#quickJoinDialog');
const quickJoinForm = $('#quickJoinForm');
const QUICK_KEY = 'covendaQuickJoin';

function hasCompletedProfile() {
  const subs = readStorage(storageKey, []);
  return Array.isArray(subs) && subs.some(s => s.type === 'student_interest');
}
function openFullProfilePrefilled() {
  const saved = readStorage(QUICK_KEY, null);
  openDialog(studentDialog, studentForm);
  if (saved) {
    const set = (name, val) => { const el = $('[name="' + name + '"]', studentForm); if (el && !el.value && val) el.value = val; };
    set('studentName', saved.name); set('studentEmail', saved.email); set('studentSchool', saved.school);
    // Carry the interest domains tapped at quick-join into the long form, so the student
    // doesn't re-pick them. Dispatch change so the vertical-first cascade re-derives.
    if (Array.isArray(saved.industries) && saved.industries.length) {
      saved.industries.forEach(val => {
        const cb = $$('[name="studentIndustry"]', studentForm).find(el => el.value === val);
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    }
    saveDraft(studentForm);
  }
}
function renderProfileBanner() {
  const saved = readStorage(QUICK_KEY, null);
  let banner = $('#quickProfileBanner');
  if (!saved || hasCompletedProfile()) { if (banner) banner.remove(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'quickProfileBanner';
    banner.className = 'quick-profile-banner';
    (document.querySelector('.hero-student .hero-copy') || document.body).prepend(banner);
  }
  banner.innerHTML = '';
  const txt = document.createElement('span');
  txt.textContent = 'You’re on the pilot list. Complete your full profile to be matched to real work.';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'gold-button compact'; btn.textContent = 'Complete profile';
  btn.addEventListener('click', openFullProfilePrefilled);
  banner.append(txt, btn);
}
// The quick-join interest chips are the same industry domains the full profile uses, so a
// tap here pre-selects the long form later. Rendered from INDUSTRY_TREE so they never drift.
function renderQuickInterests() {
  const host = $('#quickJoinInterests');
  if (!host) return;
  host.innerHTML = '';
  Object.keys(INDUSTRY_TREE).forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'quick-chip'; chip.textContent = name;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      chip.classList.toggle('is-on', !on);
    });
    host.append(chip);
  });
}
function selectedQuickInterests() {
  return $$('#quickJoinInterests .quick-chip[aria-pressed="true"]').map(chip => chip.textContent);
}
function openQuickJoin() {
  const done = $('#quickJoinDone');
  done.hidden = true; done.textContent = '';
  quickJoinForm.hidden = false;
  $('#quickJoinMessage').textContent = '';
  renderQuickInterests();
  quickJoinForm.dataset.startedAt = String(Date.now());
  quickJoinDialog.showModal();
  window.setTimeout(() => $('[name="quickName"]', quickJoinForm)?.focus(), 60);
}
function renderQuickJoinDone(reference) {
  quickJoinForm.hidden = true;
  const done = $('#quickJoinDone');
  done.hidden = false; done.innerHTML = '';
  const head = document.createElement('div'); head.className = 'quick-done-head';
  head.innerHTML = '<svg class="quick-done-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><div><h3>You’re on the list.</h3><p>Reference ' + reference + '. We’ll be in touch about the pilot.</p></div>';
  const prompt = document.createElement('p'); prompt.className = 'quick-done-prompt';
  prompt.textContent = 'Want to finish your full profile now? A few minutes now helps us match you to the right work.';
  const actions = document.createElement('div'); actions.className = 'quick-join-actions';
  const now = document.createElement('button'); now.type = 'button'; now.className = 'gold-button'; now.textContent = 'Complete full profile';
  now.addEventListener('click', () => { quickJoinDialog.close(); openFullProfilePrefilled(); });
  const later = document.createElement('button'); later.type = 'button'; later.className = 'quiet-link'; later.textContent = 'I’ll do it later';
  later.addEventListener('click', () => quickJoinDialog.close());
  actions.append(now, later);
  done.append(head, prompt, actions);
}
if (quickJoinForm) {
  quickJoinForm.addEventListener('submit', async event => {
    event.preventDefault();
    const name = formValue(quickJoinForm, 'quickName');
    const emailVal = formValue(quickJoinForm, 'quickEmail');
    const consent = $('[name="quickConsent"]', quickJoinForm).checked;
    const message = $('#quickJoinMessage');
    message.classList.remove('is-success');
    if (!name || !emailVal || !consent) { message.textContent = 'Please add your name, email, and agree to be contacted.'; return; }
    const submit = $('button[type="submit"]', quickJoinForm);
    submit.disabled = true; submit.textContent = 'Joining…';
    const industries = selectedQuickInterests();
    try {
      const result = await sendSubmission({
        type: 'student_quick',
        startedAt: Number(quickJoinForm.dataset.startedAt),
        website: formValue(quickJoinForm, 'website'),
        consent: true,
        contact: { name, email: emailVal },
        school: formValue(quickJoinForm, 'quickSchool'),
        industries,
        interest: industries.join(', ') || state.workType || '',
      });
      writeStorage(QUICK_KEY, { name, email: emailVal, school: formValue(quickJoinForm, 'quickSchool'), industries, reference: result.reference, stage: 'quick_added', at: new Date().toISOString() });
      saveSubmission({
        type: 'student_quick', reference: result.reference, status: result.status || 'received',
        storage: result.storage || 'confirmed', createdAt: result.createdAt || new Date().toISOString(),
        title: name + ' · quick join', summary: industries.length ? 'Interested in ' + industries.join(', ') : (state.workType ? 'Interested in ' + state.workType : 'Full profile pending'),
      });
      renderQuickJoinDone(result.reference);
      renderProfileBanner();
      showToast('You’re on the pilot list.');
    } catch (error) {
      message.textContent = (error && error.message) || 'Could not join. Please try again.';
    } finally {
      submit.disabled = false; submit.innerHTML = 'Join the list ' + iconUse('icon-arrow-right');
    }
  });
  renderProfileBanner();
}

studentForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateStep(studentForm)) return;
  const submit = $('[data-form-submit]', studentForm);
  const message = $('#studentFormMessage');
  submit.disabled = true;
  submit.textContent = 'Sending…';
  message.textContent = '';
  try {
    const result = await sendSubmission(studentPayload(studentForm));
    applySubmissionDelivery(result);
    message.classList.add('is-success');
    message.textContent = 'Interest profile received. Reference ' + result.reference + submissionDeliveryMessage(result);
    discardDraft(studentForm, { reset: false });
    saveSubmission({
      type: 'student_interest',
      reference: result.reference,
      status: result.status || 'received',
      storage: result.storage || 'confirmed',
      storageRoute: result.storageRoute || '',
      syncStatus: result.syncStatus || (result.storage === 'supabase' ? 'synced' : 'pending'),
      destination: result.destination || null,
      createdAt: result.createdAt || new Date().toISOString(),
      title: formValue(studentForm, 'studentName') + ' · interest profile',
      summary: [checkedValues(studentForm, 'workType').join(', '), formValue(studentForm, 'studentAvailability')].filter(Boolean).join(' · '),
    });
    showToast('Your interest profile was received.');
    window.setTimeout(() => {
      studentDialog.close();
      setAudience('student');
      setSurface('workspace');
      setWorkspaceTab('submissions');
    }, 900);
  } catch (error) {
    message.classList.remove('is-success');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Send interest profile ' + iconUse('icon-arrow-right');
  }
});

companyForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateStep(companyForm)) return;
  const message = $('#companyFormMessage');
  const blockers = renderCompanyBoundaryGuidance(companyForm);
  if (blockers.length) {
    message.classList.remove('is-success');
    message.textContent = 'Before sending, ' + blockers.map(({ message: blockerMessage }) => blockerMessage).join('; ') + '.';
    setFormStep(companyForm, 2);
    renderCompanyBoundaryGuidance(companyForm);
    blockers[0].field.focus();
    return;
  }
  const submit = $('[data-form-submit]', companyForm);
  submit.disabled = true;
  submit.textContent = 'Sending…';
  message.textContent = '';
  try {
    const localReadiness = companyPacketReadiness(companyReadinessInputFromForm(companyForm));
    const packetSnapshot = companyPacketSnapshot(companyForm, localReadiness);
    const payload = companyPayload(companyForm);
    const revisionOf = payload.revisionOf || '';
    const result = await sendSubmission(payload);
    applySubmissionDelivery(result);
    message.classList.add('is-success');
    message.textContent = (revisionOf ? 'Revised company problem received. Reference ' : 'Company problem received. Reference ') + result.reference + submissionDeliveryMessage(result);
    discardDraft(companyForm, { reset: false });
    saveSubmission({
      type: 'employer_intake',
      reference: result.reference,
      status: result.status || 'received',
      storage: result.storage || 'confirmed',
      storageRoute: result.storageRoute || '',
      syncStatus: result.syncStatus || (result.storage === 'supabase' ? 'synced' : 'pending'),
      destination: result.destination || null,
      createdAt: result.createdAt || new Date().toISOString(),
      title: formValue(companyForm, 'companyName') + ' · company problem',
      summary: [formValue(companyForm, 'companyDeliverable'), formValue(companyForm, 'companyDeadline')].filter(Boolean).join(' · '),
      packetReadiness: result.readiness || { readyCount: localReadiness.readyCount, total: localReadiness.total },
      packetSnapshot,
      ...(result.revisionOf || revisionOf ? { revisionOf: result.revisionOf || revisionOf } : {}),
    });
    showToast(revisionOf ? 'Your revision was received as a new packet.' : 'Your company problem was received for scoping.');
    window.setTimeout(() => {
      companyDialog.close();
      companyForm.reset();
      renderCompanyBoundaryGuidance(companyForm);
      setFormStep(companyForm, 0);
      setAudience('company');
      setSurface('workspace');
      setWorkspaceTab('submissions');
    }, 900);
  } catch (error) {
    message.classList.remove('is-success');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    renderRevisionContext();
  }
});

// ---- University / partner roster builder ---------------------------
const universityInterests = ['Research', 'Data & spreadsheets', 'Operations', 'QA & testing', 'Writing & documentation'];
let universityRoster = [];

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function partnerFieldValues() {
  return {
    contactName: $('#uniContactName')?.value.trim() || '',
    contactEmail: $('#uniContactEmail')?.value.trim() || '',
    orgName: $('#uniOrgName')?.value.trim() || '',
    orgType: $('#uniOrgType')?.value || '',
  };
}

function saveRosterDraft() {
  writeStorage(universityDraftKey, { partner: partnerFieldValues(), roster: universityRoster, updatedAt: new Date().toISOString() });
  renderUniversityWorkspace();
}

function clearRosterDraft() {
  removeStorage(universityDraftKey);
  renderUniversityWorkspace();
}

function addRosterEntry(name, email, interest) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanInterest = universityInterests.includes(interest) ? interest : universityInterests[0];
  if (!cleanName || !isEmail(cleanEmail)) return false;
  if (universityRoster.some(entry => entry.email === cleanEmail)) return false;
  universityRoster.push({ name: cleanName, email: cleanEmail, interest: cleanInterest });
  return true;
}

function parsePastedRoster(raw, interest) {
  let added = 0;
  let skipped = 0;
  raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const angle = line.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
    let name = '';
    let email = '';
    if (angle) {
      name = angle[1];
      email = angle[2];
    } else {
      const parts = line.split(/[,;\t]+/).map(part => part.trim()).filter(Boolean);
      const emailPart = parts.find(part => isEmail(part.toLowerCase()));
      email = emailPart || '';
      name = parts.filter(part => part !== emailPart).join(' ');
      if (!name && email) name = email.split('@')[0].replace(/[._]+/g, ' ');
    }
    if (addRosterEntry(name, email, interest)) added += 1;
    else skipped += 1;
  });
  return { added, skipped };
}

function removeRosterEntry(email) {
  universityRoster = universityRoster.filter(entry => entry.email !== email);
}

function renderRoster() {
  const list = $('#rosterList');
  const empty = $('#rosterEmpty');
  const count = $('#rosterCount');
  const clear = $('#rosterClear') || $('[data-action="roster-clear"]');
  if (!list) return;
  list.replaceChildren();
  universityRoster.forEach(entry => {
    const row = document.createElement('li');
    row.className = 'roster-row';
    const main = document.createElement('div');
    const name = document.createElement('span');
    const email = document.createElement('span');
    const tag = document.createElement('span');
    const remove = document.createElement('button');
    main.className = 'roster-row-main';
    name.className = 'roster-row-name';
    email.className = 'roster-row-email';
    tag.className = 'roster-tag';
    name.textContent = entry.name;
    email.textContent = entry.email;
    tag.textContent = entry.interest;
    main.append(name, email);
    remove.type = 'button';
    remove.className = 'roster-remove';
    remove.dataset.rosterRemove = entry.email;
    remove.setAttribute('aria-label', 'Remove ' + entry.name);
    remove.append(createIcon('icon-close'));
    row.append(main, tag, remove);
    list.append(row);
  });
  const total = universityRoster.length;
  if (count) count.textContent = total + (total === 1 ? ' student' : ' students');
  if (empty) empty.hidden = total > 0;
  if (clear) clear.hidden = total === 0;
  renderCohortDashboard();
}

function universityPayload() {
  const partner = partnerFieldValues();
  return {
    type: 'university_partner',
    startedAt: Number($('#rosterAddForm')?.dataset.startedAt || Date.now() - 4000),
    website: '',
    consent: $('#uniConsent')?.checked === true,
    contact: {
      name: partner.contactName,
      email: partner.contactEmail,
      company: partner.orgName,
    },
    organizationType: partner.orgType,
    roster: universityRoster.map(entry => ({ name: entry.name, email: entry.email, interest: entry.interest })),
  };
}

async function submitRoster() {
  const message = $('#rosterMessage');
  const submit = $('[data-action="roster-submit"]');
  const partner = partnerFieldValues();
  message.classList.remove('is-success');
  if (!partner.contactName || !isEmail(partner.contactEmail.toLowerCase()) || !partner.orgName || !partner.orgType) {
    message.textContent = 'Add your name, a valid work email, your organization, and its type first.';
    return;
  }
  if (!universityRoster.length) {
    message.textContent = 'Add at least one student with a name and a valid email.';
    return;
  }
  if (!$('#uniConsent')?.checked) {
    message.textContent = 'Please confirm you can share these details with Covenda.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    const result = await sendSubmission(universityPayload());
    applySubmissionDelivery(result);
    message.classList.add('is-success');
    message.textContent = 'Roster received. Reference ' + result.reference + submissionDeliveryMessage(result);
    saveSubmission({
      type: 'university_partner',
      reference: result.reference,
      status: result.status || 'received',
      storage: result.storage || 'confirmed',
      storageRoute: result.storageRoute || '',
      syncStatus: result.syncStatus || (result.storage === 'supabase' ? 'synced' : 'pending'),
      destination: result.destination || null,
      createdAt: result.createdAt || new Date().toISOString(),
      title: partner.orgName + ' · student roster',
      summary: universityRoster.length + (universityRoster.length === 1 ? ' student · ' : ' students · ') + partner.orgType,
    });
    universityRoster = [];
    if ($('#uniConsent')) $('#uniConsent').checked = false;
    renderRoster();
    clearRosterDraft();
    showToast('Your roster was received for pilot review.');
    window.setTimeout(() => {
      setAudience('university');
      setSurface('workspace');
      setWorkspaceTab('submissions');
    }, 900);
  } catch (error) {
    message.classList.remove('is-success');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Send roster to Covenda ' + iconUse('icon-arrow-right');
  }
}

function endorsementPayload() {
  const partner = partnerFieldValues();
  const note = $('#endorsementNote')?.value.trim() || '';
  return {
    type: 'referrer_endorsement',
    startedAt: Number($('#rosterAddForm')?.dataset.startedAt || Date.now() - 4000),
    website: '',
    consent: $('#uniConsent')?.checked === true,
    contact: { name: partner.contactName, email: partner.contactEmail, company: partner.orgName },
    referrerType: partner.orgType,
    // Same stable code the partner's shareable referral link carries, so a student who
    // arrives via that link (F3) can be matched back to this endorsement.
    attributionCode: makeReferralCode(partner.orgName, partner.contactEmail),
    endorsements: universityRoster.map(entry => ({ name: entry.name, email: entry.email, function: entry.interest, note })),
  };
}

async function submitEndorsement() {
  const message = $('#rosterMessage');
  const submit = $('[data-action="roster-endorse"]');
  const partner = partnerFieldValues();
  message.classList.remove('is-success');
  if (!partner.contactName || !isEmail(partner.contactEmail.toLowerCase()) || !partner.orgName || !partner.orgType) {
    message.textContent = 'Add your name, a valid work email, your organization, and your role first.';
    return;
  }
  if (!universityRoster.length) {
    message.textContent = 'Add at least one student to endorse.';
    return;
  }
  if (!$('#uniConsent')?.checked) {
    message.textContent = 'Please confirm you can share these details with Covenda.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Sending…';
  try {
    const result = await sendSubmission(endorsementPayload());
    applySubmissionDelivery(result);
    message.classList.add('is-success');
    message.textContent = 'Endorsements received. Reference ' + result.reference + submissionDeliveryMessage(result);
    saveSubmission({
      type: 'referrer_endorsement',
      reference: result.reference,
      status: result.status || 'received',
      storage: result.storage || 'confirmed',
      storageRoute: result.storageRoute || '',
      syncStatus: result.syncStatus || (result.storage === 'supabase' ? 'synced' : 'pending'),
      destination: result.destination || null,
      createdAt: result.createdAt || new Date().toISOString(),
      title: partner.orgName + ' · student endorsements',
      summary: universityRoster.length + (universityRoster.length === 1 ? ' student endorsed · ' : ' students endorsed · ') + partner.orgType,
    });
    universityRoster = [];
    if ($('#uniConsent')) $('#uniConsent').checked = false;
    if ($('#endorsementNote')) $('#endorsementNote').value = '';
    renderRoster();
    clearRosterDraft();
    showToast('Your endorsements were received for pilot review.');
    window.setTimeout(() => {
      setAudience('university');
      setSurface('workspace');
      setWorkspaceTab('submissions');
    }, 900);
  } catch (error) {
    message.classList.remove('is-success');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Endorse these students ' + iconUse('icon-shield');
  }
}

function openUniversityRoster() {
  setSurface('site');
  setAudience('university');
  const builder = $('.roster-builder');
  builder?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => $('#rosterName')?.focus(), 320);
}

function renderUniversityWorkspace() {
  const partner = partnerFieldValues();
  const draft = readStorage(universityDraftKey, null);
  const rosterCount = universityRoster.length || (Array.isArray(draft?.roster) ? draft.roster.length : 0);
  const orgName = partner.orgName || draft?.partner?.orgName || '';
  const orgType = partner.orgType || draft?.partner?.orgType || '';
  const lastSubmission = savedSubmissions().find(item => item.type === 'university_partner');

  const workspaceCount = $('#workspaceRosterCount');
  if (workspaceCount) workspaceCount.textContent = rosterCount + (rosterCount === 1 ? ' student on your roster' : ' students on your roster');
  const workspaceOrg = $('#workspaceRosterOrg');
  if (workspaceOrg) workspaceOrg.textContent = [orgName, orgType].filter(Boolean).join(' · ') || 'Add your organization details';
  const workspaceReference = $('#workspaceRosterReference');
  if (workspaceReference) workspaceReference.textContent = lastSubmission ? 'Received · ' + lastSubmission.reference : 'Nothing sent yet';

  const summaryTitle = $('#universityWorkspaceSummaryTitle');
  if (summaryTitle) summaryTitle.textContent = orgName || (rosterCount ? 'Roster in progress' : 'No roster shared yet');
  const summary = $('#universityWorkspaceSummary');
  if (summary) {
    renderDefinitionList(summary, [
      ['Organization', [orgName, orgType].filter(Boolean).join(' · ') || 'Add your organization and type.'],
      ['Students', rosterCount ? rosterCount + (rosterCount === 1 ? ' student added' : ' students added') : 'Add students by interest area.'],
      ['Last sent', lastSubmission ? lastSubmission.reference : 'Nothing sent yet.'],
    ]);
  }
  renderCohortDashboard();
  renderReferralLink();
}

function restoreRosterDraft() {
  const draft = readStorage(universityDraftKey, null);
  if (!draft) { renderRoster(); renderUniversityWorkspace(); return; }
  if (draft.partner) {
    if ($('#uniContactName')) $('#uniContactName').value = draft.partner.contactName || '';
    if ($('#uniContactEmail')) $('#uniContactEmail').value = draft.partner.contactEmail || '';
    if ($('#uniOrgName')) $('#uniOrgName').value = draft.partner.orgName || '';
    if ($('#uniOrgType')) $('#uniOrgType').value = draft.partner.orgType || '';
  }
  if (Array.isArray(draft.roster)) {
    universityRoster = draft.roster
      .filter(entry => entry && entry.name && isEmail(String(entry.email || '').toLowerCase()))
      .map(entry => ({ name: entry.name, email: String(entry.email).toLowerCase(), interest: universityInterests.includes(entry.interest) ? entry.interest : universityInterests[0] }));
  }
  renderRoster();
  renderUniversityWorkspace();
}

const rosterAddForm = $('#rosterAddForm');
if (rosterAddForm) {
  rosterAddForm.dataset.startedAt = String(Date.now());
  rosterAddForm.addEventListener('submit', event => {
    event.preventDefault();
    const nameField = $('#rosterName');
    const emailField = $('#rosterEmail');
    const interest = $('#rosterInterest')?.value || universityInterests[0];
    const message = $('#rosterMessage');
    message.classList.remove('is-success');
    if (!nameField.value.trim() || !isEmail(emailField.value.trim().toLowerCase())) {
      message.textContent = 'Add a student name and a valid email.';
      return;
    }
    if (!addRosterEntry(nameField.value, emailField.value, interest)) {
      message.textContent = 'That student is already on the roster.';
      return;
    }
    message.textContent = '';
    nameField.value = '';
    emailField.value = '';
    nameField.focus();
    renderRoster();
    saveRosterDraft();
  });
}

for (const field of ['#uniContactName', '#uniContactEmail', '#uniOrgName', '#uniOrgType']) {
  $(field)?.addEventListener('change', () => { saveRosterDraft(); renderReferralLink(); });
}
// Org name shapes the referral link as it is typed; note toggles the cohort entry rung.
$('#uniOrgName')?.addEventListener('input', renderReferralLink);
$('#endorsementNote')?.addEventListener('input', renderCohortDashboard);

$('#rosterList')?.addEventListener('click', event => {
  const button = event.target.closest('[data-roster-remove]');
  if (!button) return;
  removeRosterEntry(button.dataset.rosterRemove);
  renderRoster();
  saveRosterDraft();
});

$$('[data-audience-option]').forEach(button => button.addEventListener('click', () => {
  setAudience(button.dataset.audienceOption);
  // The core-story demo only belongs to the opening/default home view.
  document.body.dataset.audienceSwitched = 'true';
  // Land on the new audience's hero, not mid-page in its content.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
}));
$$('[data-workspace-tab]').forEach(button => button.addEventListener('click', () => setWorkspaceTab(button.dataset.workspaceTab)));
// ---- Work-type explore: per-niche detail panels (explore before the form) ----
const workNiches = {
  'Research': {
    icon: 'icon-search',
    desc: 'Source review, market maps, competitor scans, and customer synthesis — turn scattered signals into a clear read.',
    roles: ['Competitor landscape scan', 'Customer-interview synthesis brief'],
    flow: ['Get the question + approved sources', 'Scan, tag, and synthesize the findings', 'Deliver an evidence-backed brief'],
  },
  'Data & spreadsheets': {
    icon: 'icon-data',
    desc: 'Cleanup, validation, analysis, and clear models — make messy data trustworthy and easy to use.',
    roles: ['Dataset cleanup + validation', 'Financial model build'],
    flow: ['Receive the raw, messy dataset', 'Clean, validate, and model it', 'Hand back a trustworthy sheet'],
  },
  'Operations': {
    icon: 'icon-operations',
    desc: 'Workflow mapping, documentation, and CRM hygiene — make a recurring process run without you.',
    roles: ['Onboarding workflow map', 'CRM cleanup pass'],
    flow: ['Map the current process end to end', 'Document and tidy the system', 'Deliver a repeatable playbook'],
  },
  'QA & testing': {
    icon: 'icon-shield',
    desc: 'Manual testing, test cases, and issue reproduction — catch what breaks before customers do.',
    roles: ['Manual test pass + report', 'Bug reproduction set'],
    flow: ['Get the build + test scope', 'Run cases and log every issue', 'Deliver a reproducible report'],
  },
  'Writing & documentation': {
    icon: 'icon-write',
    desc: 'Knowledge bases, playbooks, and structured briefs — turn know-how into something the team can reuse.',
    roles: ['Knowledge-base article set', 'Process playbook'],
    flow: ['Gather the source material', 'Structure and draft it', 'Deliver a reusable document'],
  },
};
let flowStep = 0;

function renderFlowStep() {
  const data = workNiches[state.workType];
  if (!data) return;
  const count = data.flow.length;
  flowStep = ((flowStep % count) + count) % count;
  const frame = $('#workFlowFrame');
  const tag = document.createElement('span');
  tag.className = 'work-flow-frame-tag';
  tag.textContent = 'Workflow · step ' + (flowStep + 1) + ' of ' + count;
  const line = document.createElement('p');
  line.textContent = data.flow[flowStep];
  frame.replaceChildren(tag, line);
  $('#workDetailStep').textContent = 'Step ' + (flowStep + 1) + ' of ' + count;
  const dots = $('#workFlowDots');
  dots.replaceChildren();
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('i');
    if (i === flowStep) dot.className = 'is-active';
    dots.append(dot);
  }
}

function openWorkDetail(niche) {
  const data = workNiches[niche];
  if (!data) return;
  selectWorkType(niche);
  const tag = $('#workDetailTag');
  const strong = document.createElement('b');
  strong.textContent = niche;
  tag.replaceChildren(createIcon(data.icon), strong);
  $('#workDetailDesc').textContent = data.desc;
  const roles = $('#workDetailRoles');
  roles.replaceChildren();
  data.roles.forEach(role => {
    const li = document.createElement('li');
    li.textContent = role;
    roles.append(li);
  });
  flowStep = 0;
  renderFlowStep();
  $('#workDetail').hidden = false;
  $('.selector-orbit')?.classList.add('is-exploring');
}

function closeWorkDetail() {
  $('#workDetail').hidden = true;
  $('.selector-orbit')?.classList.remove('is-exploring');
}

$$('[data-work-type]').forEach(button => button.addEventListener('click', () => {
  const niche = button.dataset.workType;
  if (button.classList.contains('work-option')) {
    openWorkDetail(niche);
    saveDraft(studentForm);
  } else {
    selectWorkType(niche);
  }
  if (button.closest('.work-types')) openDialog(studentDialog, studentForm);
}));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('.form-dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) dialog.close();
}));

// Step 4 — roles + applications foundation. Illustrative company roles a student can
// apply to; the application persists as a role_application submission. The
// compatibility score (Step 5) plugs into the apply dialog. NOT a marketplace yet.
const ROLES = [
  { id: 'acct-recon', company: 'A finance-ops team', function: 'Accounting Operations', title: 'Month-end reconciliation cleanup', skills: ['Spreadsheets', 'Reconciliation', 'Attention to detail'], term: 'short', description: 'Reconcile and document a recurring month-end close step from de-identified data.' },
  { id: 'research-scan', company: 'A seed startup', function: 'Research & Synthesis', title: 'Competitor landscape scan', skills: ['Research', 'Synthesis', 'Writing'], term: 'short', description: 'Public-source scan of the top competitors with pricing and positioning.' },
  { id: 'qa-pass', company: 'A Series A product team', function: 'QA & Testing', title: 'Manual test pass + bug reports', skills: ['QA', 'Test cases', 'Bug reproduction'], term: 'short', description: 'Run a structured manual test pass and file reproducible bug reports.' },
  { id: 'ops-map', company: 'An operations team', function: 'Operations', title: 'Onboarding workflow map', skills: ['Operations', 'Documentation', 'Process'], term: 'long', description: 'Map and document a recurring internal onboarding workflow.' },
];
const roleApplyDialog = $('#roleApplyDialog');
const roleApplyForm = $('#roleApplyForm');
let activeRole = null;

function renderRoles() {
  const grid = $('[data-roles-grid]');
  if (!grid) return;
  grid.textContent = '';
  for (const role of ROLES) {
    const card = document.createElement('article');
    card.className = 'role-card glass-panel';
    const fn = document.createElement('p'); fn.className = 'role-function'; fn.textContent = role.function;
    const title = document.createElement('h3'); title.className = 'role-title'; title.textContent = role.title;
    const company = document.createElement('p'); company.className = 'role-company'; company.textContent = role.company + ' · ' + (role.term === 'short' ? 'Short-term' : 'Longer-term');
    const desc = document.createElement('p'); desc.className = 'role-desc'; desc.textContent = role.description;
    const skills = document.createElement('div'); skills.className = 'role-skills';
    for (const s of role.skills) { const chip = document.createElement('span'); chip.className = 'role-skill'; chip.textContent = s; skills.append(chip); }
    const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'gold-button role-apply'; apply.textContent = 'Apply to this role';
    apply.addEventListener('click', () => openRoleApply(role));
    card.append(fn, title, company, desc, skills, apply);
    grid.append(card);
  }
}

function openRoleApply(role) {
  if (!roleApplyForm) return;
  activeRole = role;
  const done = $('#roleApplyDone'); done.hidden = true; done.textContent = '';
  roleApplyForm.hidden = false;
  $('#roleApplyMessage').textContent = '';
  $('#roleApplyTitle').textContent = 'Apply · ' + role.title;
  const summary = $('#roleApplySummary');
  summary.textContent = '';
  const s1 = document.createElement('p'); s1.className = 'role-apply-role';
  s1.append(document.createTextNode(role.function + ' · '));
  const b = document.createElement('b'); b.textContent = role.title; s1.append(b);
  const s2 = document.createElement('p'); s2.className = 'role-apply-desc'; s2.textContent = role.description;
  summary.append(s1, s2, renderFitBlock(role));
  const quick = readStorage('covendaQuickJoin', null);
  const draft = readStorage(draftKeys.studentForm, null);
  const name = (quick && quick.name) || draftValue(draft, 'studentName');
  const emailVal = (quick && quick.email) || draftValue(draft, 'studentEmail');
  if (name) $('[name="applyName"]', roleApplyForm).value = name;
  if (emailVal) $('[name="applyEmail"]', roleApplyForm).value = emailVal;
  roleApplyForm.dataset.startedAt = String(Date.now());
  roleApplyDialog.showModal();
}

if (roleApplyForm) {
  roleApplyForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (formValue(roleApplyForm, 'website')) { roleApplyDialog.close(); return; }
    const name = formValue(roleApplyForm, 'applyName');
    const emailVal = formValue(roleApplyForm, 'applyEmail');
    const msg = $('#roleApplyMessage');
    if (!name || !emailVal || !activeRole) { msg.textContent = 'Please add your name and email.'; return; }
    const submit = $('button[type="submit"]', roleApplyForm);
    submit.disabled = true; submit.textContent = 'Submitting…';
    try {
      const result = await sendSubmission({
        type: 'role_application',
        startedAt: Number(roleApplyForm.dataset.startedAt) || (Date.now() - 3000),
        website: '',
        consent: true,
        contact: { name, email: emailVal },
        roleId: activeRole.id,
        roleTitle: activeRole.title,
        roleFunction: activeRole.function,
        note: formValue(roleApplyForm, 'applyNote'),
      });
      saveSubmission({
        type: 'role_application', reference: result.reference, status: result.status || 'received',
        storage: result.storage || 'confirmed', createdAt: result.createdAt || new Date().toISOString(),
        title: name + ' · ' + activeRole.title, summary: 'Applied to ' + activeRole.title,
      });
      roleApplyForm.hidden = true;
      const doneEl = $('#roleApplyDone'); doneEl.hidden = false; doneEl.innerHTML = '';
      const h = document.createElement('p'); h.className = 'quick-done-prompt'; h.style.fontWeight = '640'; h.style.color = 'var(--ink)';
      h.textContent = 'Application received · ' + result.reference;
      const p = document.createElement('p'); p.className = 'quick-done-prompt';
      p.textContent = 'Covenda reviews fit before anything moves forward. An application is not a match or a guarantee.';
      const close = document.createElement('button'); close.type = 'button'; close.className = 'gold-button'; close.textContent = 'Done';
      close.addEventListener('click', () => roleApplyDialog.close());
      const actions = document.createElement('div'); actions.className = 'quick-join-actions'; actions.append(close);
      doneEl.append(h, p, actions);
      if (typeof showToast === 'function') showToast('Application received.');
    } catch (error) {
      msg.textContent = (error && error.message) || 'Could not submit. Please try again.';
    } finally {
      submit.disabled = false; submit.innerHTML = 'Submit application ' + iconUse('icon-arrow-right');
    }
  });
}
renderRoles();

// Step 2 — student requests an endorsement from a professor/club (stored locally;
// Covenda facilitates the vouch). Honest: an endorsement is a signal, not a placement.
const requestEndorseDialog = $('#requestEndorseDialog');
const requestEndorseForm = $('#requestEndorseForm');
function openRequestEndorse() {
  if (!requestEndorseForm) return;
  const done = $('#requestEndorseDone');
  done.hidden = true; done.textContent = '';
  requestEndorseForm.hidden = false;
  $('#requestEndorseMessage').textContent = '';
  requestEndorseDialog.showModal();
  window.setTimeout(() => $('[name="endorserName"]', requestEndorseForm)?.focus(), 60);
}
if (requestEndorseForm) {
  requestEndorseForm.addEventListener('submit', event => {
    event.preventDefault();
    if (formValue(requestEndorseForm, 'website')) { requestEndorseDialog.close(); return; }
    const name = formValue(requestEndorseForm, 'endorserName');
    const msg = $('#requestEndorseMessage');
    if (!name) { msg.textContent = 'Please add who you’d like to endorse you.'; return; }
    const list = readStorage('covendaEndorseRequests', []);
    list.push({
      name,
      role: formValue(requestEndorseForm, 'endorserRole'),
      email: formValue(requestEndorseForm, 'endorserEmail'),
      note: formValue(requestEndorseForm, 'endorserNote'),
      at: new Date().toISOString(),
    });
    writeStorage('covendaEndorseRequests', list);
    requestEndorseForm.hidden = true;
    const done = $('#requestEndorseDone');
    done.hidden = false; done.innerHTML = '';
    const h = document.createElement('p'); h.className = 'quick-done-prompt'; h.style.fontWeight = '640'; h.style.color = 'var(--ink)';
    h.textContent = 'Request noted for ' + name + '.';
    const p = document.createElement('p'); p.className = 'quick-done-prompt';
    p.textContent = 'Covenda will help them add a vouch to your profile. You can also earn credibility through reviewed batch work in the meantime.';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'gold-button'; close.textContent = 'Done';
    close.addEventListener('click', () => requestEndorseDialog.close());
    const actions = document.createElement('div'); actions.className = 'quick-join-actions'; actions.append(close);
    done.append(h, p, actions);
    if (typeof showToast === 'function') showToast('Endorsement request noted.');
  });
}

// ============================================================================
// Reusable gold "square" motif + credibility framework Steps 5 / 6 / 3.
// ============================================================================

// The gold square from the feature band, reused as a plain gradient field with a
// single label — no figure inside. (The interactive icosahedron stays on the feature
// panel itself; these reused tiles are just the colour and the words.)
function renderGoldTiles() {
  $$('[data-gold-tile]').forEach(tile => {
    if (tile.dataset.tiled) return;
    tile.dataset.tiled = '1';
    const kicker = document.createElement('span');
    kicker.className = 'gold-tile-kicker';
    kicker.textContent = tile.dataset.kicker || 'Rethinking Internships';
    tile.append(kicker);
  });
}

// ---- Step 5: transparent compatibility stub (NOT a model). A weighted overlap of
// the student's declared signals against a role's requirements. Illustrative until
// validated on real outcomes (see DATA_SCHEMA.md in the covenda-skill-score repo). ----
const FUNCTION_WORKTYPES = {
  'Accounting Operations': ['data & spreadsheets', 'operations'],
  'Research & Synthesis': ['research', 'writing & documentation'],
  'QA & Testing': ['qa & testing'],
  'Operations': ['operations', 'data & spreadsheets'],
};
function studentSignalString() {
  const draft = readStorage(draftKeys.studentForm, null);
  return [
    draftValue(draft, 'studentSkill', ''),
    draftValue(draft, 'studentSkillLevel', ''),
    draftValue(draft, 'workType', '') || (typeof state === 'object' ? state.workType : ''),
  ].filter(Boolean).join(' ').toLowerCase();
}
function skillMatches(skill, sig) {
  return skill.toLowerCase().split(/[^a-z]+/).filter(t => t.length > 3).some(t => sig.includes(t));
}
function roleCompatibility(role) {
  const sig = studentSignalString();
  const ref = activeReferral();
  const endorsed = !!(ref && ref.code);
  const worked = false; // no completed reviewed work yet — kept explicit and honest
  const skillsTotal = role.skills.length;
  const skillsMatched = role.skills.filter(s => skillMatches(s, sig)).length;
  const skillFrac = skillsTotal ? skillsMatched / skillsTotal : 0;
  const domainMatch = (FUNCTION_WORKTYPES[role.function] || []).some(k => sig.includes(k));
  const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
  // Short-term leans on skills + function fit; long-term leans on endorsement + track record.
  const shortScore = clamp(8 + skillFrac * 50 + (domainMatch ? 22 : 0) + (endorsed ? 12 : 0) + (worked ? 8 : 0));
  const longScore = clamp(8 + skillFrac * 32 + (domainMatch ? 16 : 0) + (endorsed ? 26 : 0) + (worked ? 18 : 0));
  const shortEvidence = [
    skillsMatched + ' of ' + skillsTotal + ' required skills',
    domainMatch ? 'function match' : 'function differs',
    endorsed ? 'endorsed' : 'no endorsement yet',
  ].join(' · ');
  const longEvidence = [
    endorsed ? 'endorsed' : 'not yet endorsed',
    worked ? 'has reviewed work' : 'no reviewed work yet',
    domainMatch ? 'function match' : 'function gap',
  ].join(' · ');
  return { shortScore, longScore, shortEvidence, longEvidence, hasSignals: sig.trim().length > 0 };
}
function renderFitBlock(role) {
  const c = roleCompatibility(role);
  const block = document.createElement('div');
  block.className = 'fit-block';
  const tag = document.createElement('p');
  tag.className = 'fit-illustrative';
  tag.append(createIcon('icon-spark'), document.createTextNode('Illustrative fit · not validated yet'));
  block.append(tag);
  const scores = document.createElement('div');
  scores.className = 'fit-scores';
  const fills = [];
  [['Short-term', c.shortScore, c.shortEvidence], ['Long-term', c.longScore, c.longEvidence]].forEach(([term, val, ev]) => {
    const card = document.createElement('div'); card.className = 'fit-score';
    const head = document.createElement('div'); head.className = 'fit-score-head';
    const t = document.createElement('span'); t.className = 'fit-score-term'; t.textContent = term;
    const v = document.createElement('span'); v.className = 'fit-score-value'; v.textContent = String(val);
    const small = document.createElement('small'); small.textContent = '/100'; v.append(small);
    head.append(t, v);
    const meter = document.createElement('div'); meter.className = 'fit-meter';
    const fill = document.createElement('div'); fill.className = 'fit-meter-fill'; meter.append(fill);
    fills.push([fill, val]);
    const evp = document.createElement('p'); evp.className = 'fit-evidence'; evp.textContent = ev;
    card.append(head, meter, evp);
    scores.append(card);
  });
  block.append(scores);
  const note = document.createElement('p');
  note.className = 'fit-note';
  note.append(createIcon('icon-shield'), document.createTextNode(c.hasSignals
    ? 'A score is a signal from your declared skills and interests — not a match or guarantee. Reviewed work earns the verified rungs.'
    : 'Add your skills and work interests to your profile to sharpen this — a score is a signal, not a match or guarantee.'));
  block.append(note);
  window.requestAnimationFrame(() => fills.forEach(([fill, val]) => { fill.style.width = val + '%'; }));
  return block;
}

// ---- Step 6: illustrative candidate browser for companies (referral tracing). ----
const REFERRERS = {
  chen: { name: 'Prof. R. Chen', role: 'Professor', institution: 'Columbia Robotics', vouches: [
    { name: 'Maya T.', outcome: 'verified' }, { name: 'Devin K.', outcome: 'working' }, { name: 'Amir S.', outcome: 'endorsed' }] },
  qfinance: { name: 'Quant Finance Club', role: 'Student club', institution: 'Columbia', vouches: [
    { name: 'Priya R.', outcome: 'verified' }, { name: 'Jordan L.', outcome: 'working' }] },
  career: { name: 'SEAS Career Center', role: 'Career center', institution: 'Columbia', vouches: [
    { name: 'Sam W.', outcome: 'working' }, { name: 'Lena M.', outcome: 'endorsed' }] },
  wic: { name: 'Women in CS', role: 'Student club', institution: 'Columbia', vouches: [
    { name: 'Nina P.', outcome: 'verified' }, { name: 'Grace H.', outcome: 'endorsed' }] },
};
const CANDIDATES = [
  { handle: 'Maya T.', function: 'Research & Synthesis', skills: ['Research', 'Synthesis', 'Writing'], referrer: 'chen', club: 'Columbia Robotics', clubRecord: true, score: 88 },
  { handle: 'Devin K.', function: 'QA & Testing', skills: ['QA', 'Test cases', 'Bug reproduction'], referrer: 'chen', club: 'Columbia Robotics', clubRecord: true, score: 79 },
  { handle: 'Priya R.', function: 'Accounting Operations', skills: ['Spreadsheets', 'Reconciliation', 'Attention to detail'], referrer: 'qfinance', club: 'Quant Finance Club', clubRecord: true, score: 91 },
  { handle: 'Jordan L.', function: 'Operations', skills: ['Operations', 'Documentation', 'Process'], referrer: 'qfinance', club: 'Quant Finance Club', clubRecord: true, score: 72 },
  { handle: 'Sam W.', function: 'Research & Synthesis', skills: ['Research', 'Data', 'Writing'], referrer: 'career', club: 'Independent', clubRecord: false, score: 66 },
  { handle: 'Nina P.', function: 'QA & Testing', skills: ['QA', 'Automation', 'Bug reproduction'], referrer: 'wic', club: 'Women in CS', clubRecord: true, score: 84 },
  { handle: 'Amir S.', function: 'Operations', skills: ['Operations', 'Spreadsheets', 'Process'], referrer: 'chen', club: 'Columbia Robotics', clubRecord: true, score: 69 },
  { handle: 'Grace H.', function: 'Accounting Operations', skills: ['Spreadsheets', 'Reconciliation', 'Reporting'], referrer: 'wic', club: 'Women in CS', clubRecord: false, score: 61 },
];
const candFilters = { referrer: '', club: '', minScore: 0, function: '', skill: '' };
function buildCandidateFilters() {
  const bar = $('#candToolbar');
  if (!bar) return;
  bar.textContent = '';
  const functions = Array.from(new Set(CANDIDATES.map(c => c.function))).sort();
  const skills = Array.from(new Set(CANDIDATES.flatMap(c => c.skills))).sort();
  const referrerOpts = Object.keys(REFERRERS).map(id => [id, REFERRERS[id].name]);
  const addFilter = (labelText, key, options) => {
    const wrap = document.createElement('label'); wrap.className = 'cand-filter';
    const span = document.createElement('span'); span.textContent = labelText;
    const select = document.createElement('select');
    options.forEach(([value, label]) => { const o = document.createElement('option'); o.value = value; o.textContent = label; select.append(o); });
    select.value = String(candFilters[key]);
    select.addEventListener('change', () => { candFilters[key] = key === 'minScore' ? Number(select.value) : select.value; renderCandidates(); });
    wrap.append(span, select);
    bar.append(wrap);
  };
  addFilter('Referral source', 'referrer', [['', 'Any referrer'], ...referrerOpts]);
  addFilter('Club track record', 'club', [['', 'Any club'], ['record', 'Positive track record only']]);
  addFilter('Min compatibility', 'minScore', [['0', 'Any score'], ['60', '60+'], ['75', '75+'], ['85', '85+']]);
  addFilter('Function', 'function', [['', 'Any function'], ...functions.map(f => [f, f])]);
  addFilter('Skill', 'skill', [['', 'Any skill'], ...skills.map(s => [s, s])]);
}
function candidateCard(c) {
  const ref = REFERRERS[c.referrer];
  const card = document.createElement('article'); card.className = 'candidate-card';
  const head = document.createElement('div'); head.className = 'cand-card-head';
  const idwrap = document.createElement('div');
  const h = document.createElement('p'); h.className = 'cand-handle'; h.textContent = c.handle;
  const fn = document.createElement('p'); fn.className = 'cand-function'; fn.textContent = c.function;
  idwrap.append(h, fn);
  const score = document.createElement('div'); score.className = 'cand-score';
  const sb = document.createElement('b'); sb.textContent = String(c.score);
  const ss = document.createElement('span'); ss.textContent = 'fit';
  score.append(sb, ss);
  head.append(idwrap, score);
  const endorser = document.createElement('p'); endorser.className = 'cand-endorser';
  endorser.append(createIcon('icon-shield'));
  const espan = document.createElement('span');
  espan.append(document.createTextNode('Endorsed by '));
  const eb = document.createElement('b'); eb.textContent = ref.name;
  espan.append(eb, document.createTextNode(' · ' + ref.role + ', ' + ref.institution));
  endorser.append(espan);
  const club = document.createElement('p'); club.className = 'cand-club';
  club.append(document.createTextNode('Club: '));
  const cb = document.createElement('b'); cb.textContent = c.club;
  club.append(cb);
  if (c.clubRecord) { const rec = document.createElement('span'); rec.className = 'cand-club-record'; rec.textContent = ' · positive track record'; club.append(rec); }
  const skills = document.createElement('div'); skills.className = 'cand-skills';
  c.skills.forEach(s => { const chip = document.createElement('span'); chip.className = 'cand-skill' + (candFilters.skill && s === candFilters.skill ? ' is-match' : ''); chip.textContent = s; skills.append(chip); });
  const trace = document.createElement('button'); trace.type = 'button'; trace.className = 'outline-button compact cand-trace';
  trace.append(document.createTextNode('Trace referral'), createIcon('icon-route'));
  trace.addEventListener('click', () => openTrace(c));

  // Expandable detail — opens the card into an illustrative mini-profile built ONLY from the
  // candidate's own sample fields (the section is already labeled illustrative). Explainable,
  // decision-support framing: why the fit, the evidence shape, and one honest concern.
  const detail = document.createElement('div'); detail.className = 'cand-detail'; detail.hidden = true;
  const why = document.createElement('div'); why.className = 'cand-detail-block';
  const whyH = document.createElement('h4'); whyH.textContent = 'Why this fit';
  const whyList = document.createElement('ul');
  [
    c.function + ' matches the requested function',
    'Vouched by ' + ref.name + ' (' + ref.role + ') — a staked referral',
    c.clubRecord ? c.club + ' has a positive track record on Covenda' : 'No club track record yet — individual signal only',
  ].forEach(t => { const li = document.createElement('li'); li.textContent = t; whyList.append(li); });
  why.append(whyH, whyList);
  const ev = document.createElement('div'); ev.className = 'cand-detail-block';
  const evH = document.createElement('h4'); evH.textContent = 'Evidence shape';
  const evList = document.createElement('ul');
  c.skills.forEach(s => { const li = document.createElement('li'); li.textContent = s + ' — demonstrated in reviewed sample work'; evList.append(li); });
  ev.append(evH, evList);
  const concern = document.createElement('p'); concern.className = 'cand-detail-concern';
  concern.textContent = 'One concern to check: confirm ' + (c.skills[0] || 'the core skill') + ' depth on a bounded Stage 1 work-trial before deeper access. A score is a signal, not a guarantee.';
  detail.append(why, ev, concern);

  const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'outline-button compact cand-expand';
  expand.setAttribute('aria-expanded', 'false');
  expand.append(document.createTextNode('View profile'), createIcon('icon-chevron'));
  expand.addEventListener('click', () => {
    const open = detail.hidden;
    detail.hidden = !open;
    expand.setAttribute('aria-expanded', String(open));
    expand.replaceChildren(document.createTextNode(open ? 'Close profile' : 'View profile'), createIcon('icon-chevron'));
    card.classList.toggle('is-open', open);
  });

  const actions = document.createElement('div'); actions.className = 'cand-actions';
  actions.append(expand, trace);
  card.append(head, endorser, club, skills, actions, detail);
  return card;
}
function renderCandidates() {
  const grid = $('#candGrid');
  if (!grid) return;
  const filtered = CANDIDATES.filter(c =>
    (!candFilters.referrer || c.referrer === candFilters.referrer)
    && (candFilters.club !== 'record' || c.clubRecord)
    && (c.score >= candFilters.minScore)
    && (!candFilters.function || c.function === candFilters.function)
    && (!candFilters.skill || c.skills.includes(candFilters.skill)));
  const count = $('#candCount');
  if (count) {
    count.textContent = '';
    const b = document.createElement('b'); b.textContent = String(filtered.length);
    count.append(b, document.createTextNode(' of ' + CANDIDATES.length + ' candidates match your filters'));
  }
  grid.textContent = '';
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'cand-empty';
    empty.textContent = 'No candidates match these filters yet. Loosen a filter to see more.';
    grid.append(empty);
    return;
  }
  filtered.forEach(c => grid.append(candidateCard(c)));
}
function traceNode(label, name, detail, isCandidate) {
  const n = document.createElement('div'); n.className = 'trace-node' + (isCandidate ? ' is-candidate' : '');
  const s = document.createElement('small'); s.textContent = label;
  const b = document.createElement('b'); b.textContent = name;
  n.append(s, b);
  if (detail) { const p = document.createElement('p'); p.textContent = detail; n.append(p); }
  return n;
}
function openTrace(c) {
  const dialog = $('#traceDialog');
  if (!dialog) return;
  const ref = REFERRERS[c.referrer];
  $('#traceIntro').textContent = 'How ' + c.handle + ' reached this list — and who else ' + ref.name + ' has vouched for. Illustrative outcomes; a referral is a signal, not a guarantee.';
  const chain = $('#traceChain');
  chain.textContent = '';
  chain.append(traceNode('Candidate', c.handle, c.function + ' · illustrative fit ' + c.score, true));
  const arrow = document.createElement('div'); arrow.className = 'trace-arrow'; arrow.append(createIcon('icon-arrow-down'));
  chain.append(arrow);
  const verified = ref.vouches.filter(v => v.outcome === 'verified').length;
  const working = ref.vouches.filter(v => v.outcome === 'working').length;
  const node = traceNode('Referred by', ref.name, ref.role + ', ' + ref.institution + ' · ' + verified + ' verified · ' + working + ' working of ' + ref.vouches.length + ' vouched (illustrative)', false);
  const vh = document.createElement('small'); vh.textContent = 'Also vouched for'; vh.style.marginTop = '12px';
  const list = document.createElement('ul'); list.className = 'trace-vouches';
  ref.vouches.forEach(v => {
    const li = document.createElement('li'); li.className = 'trace-vouch';
    const nm = document.createElement('span'); nm.textContent = v.name + (v.name === c.handle ? ' (this candidate)' : '');
    const cls = v.outcome === 'verified' ? 'is-verified' : v.outcome === 'working' ? 'is-working' : 'is-progress';
    const pill = document.createElement('span'); pill.className = 'outcome-pill ' + cls;
    pill.textContent = v.outcome === 'verified' ? 'Verified' : v.outcome === 'working' ? 'Working' : 'Endorsed';
    li.append(nm, pill); list.append(li);
  });
  node.append(vh, list);
  chain.append(node);
  dialog.showModal();
}

// ---- Step 3: referrer credibility + dashboard (educator/university surface). ----
const REFERRER_DASHBOARD = {
  name: 'Prof. R. Chen', role: 'Professor', institution: 'Columbia Robotics', founding: true,
  students: [
    { name: 'Maya T.', fn: 'Research & Synthesis', status: 'verified' },
    { name: 'Devin K.', fn: 'QA & Testing', status: 'working' },
    { name: 'Ravi N.', fn: 'Data & spreadsheets', status: 'working' },
    { name: 'Amir S.', fn: 'Operations', status: 'endorsed' },
    { name: 'Ola B.', fn: 'Research & Synthesis', status: 'endorsed' },
  ],
};
function renderReferrerDashboard() {
  const host = $('#referrerDashboardBody');
  if (!host) return;
  const data = REFERRER_DASHBOARD;
  const ref = activeReferral();
  const name = (ref && ref.via) || data.name; // personalize the identity if referred by a named partner
  const students = data.students;
  const counts = { endorsed: 0, working: 0, verified: 0 };
  students.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  const total = students.length;
  // Derived, illustrative credibility weight from outcomes — never a fabricated validated number.
  const weight = total ? Math.round(((counts.verified * 1 + counts.working * 0.6 + counts.endorsed * 0.3) / total) * 100) : 0;
  host.textContent = '';

  const card = document.createElement('div'); card.className = 'referrer-cred-card';
  const top = document.createElement('div'); top.className = 'referrer-cred-top';
  const idy = document.createElement('div'); idy.className = 'referrer-identity';
  const h3 = document.createElement('h3'); h3.textContent = name;
  const p = document.createElement('p'); p.textContent = data.role + ' · ' + data.institution;
  idy.append(h3, p);
  top.append(idy);
  if (data.founding) {
    const badge = document.createElement('span'); badge.className = 'referrer-badge';
    badge.append(createIcon('icon-shield'), document.createTextNode('Founding referring faculty'));
    top.append(badge);
  }
  card.append(top);
  const mw = document.createElement('div'); mw.className = 'referrer-meter-wrap';
  const mh = document.createElement('div'); mh.className = 'referrer-meter-head';
  const mb = document.createElement('b'); mb.textContent = 'Endorsement weight';
  const ms = document.createElement('span'); ms.textContent = 'Illustrative · derived from your referrals’ outcomes';
  mh.append(mb, ms);
  const meter = document.createElement('div'); meter.className = 'referrer-meter';
  const fill = document.createElement('div'); fill.className = 'referrer-meter-fill'; meter.append(fill);
  mw.append(mh, meter);
  card.append(mw);
  const stats = document.createElement('div'); stats.className = 'referrer-stats';
  [['Endorsed', counts.endorsed], ['Working', counts.working], ['Verified', counts.verified]].forEach(([label, n]) => {
    const st = document.createElement('div'); st.className = 'referrer-stat';
    const b = document.createElement('b'); b.textContent = String(n);
    const sp = document.createElement('span'); sp.textContent = label;
    st.append(b, sp); stats.append(st);
  });
  card.append(stats);
  host.append(card);

  const table = document.createElement('div'); table.className = 'referrer-students';
  const thead = document.createElement('div'); thead.className = 'referrer-students-head';
  const th = document.createElement('h3'); th.textContent = 'Students you referred';
  const tc = document.createElement('span'); tc.textContent = total + ' students';
  thead.append(th, tc); table.append(thead);
  students.forEach(s => {
    const row = document.createElement('div'); row.className = 'referrer-row';
    const nm = document.createElement('div'); nm.className = 'r-name'; nm.textContent = s.name;
    const fnEl = document.createElement('div'); fnEl.className = 'r-fn'; fnEl.textContent = s.fn;
    const pill = document.createElement('span'); pill.className = 'status-pill is-' + s.status;
    pill.textContent = s.status.charAt(0).toUpperCase() + s.status.slice(1);
    row.append(nm, fnEl, pill); table.append(row);
  });
  host.append(table);

  const note = document.createElement('p'); note.className = 'referrer-note';
  note.append(createIcon('icon-lock'));
  const ns = document.createElement('span');
  ns.append(document.createTextNode('An endorsement is an appreciating reputation asset: as your referred students complete reviewed, verified work, your endorsements carry more weight. '));
  const nb = document.createElement('b'); nb.textContent = 'Verified rungs are earned through reviewed work — never assigned.';
  ns.append(nb);
  note.append(ns);
  host.append(note);
  const deferred = document.createElement('p'); deferred.className = 'referrer-deferred';
  deferred.textContent = 'Cash or revenue-share to referrers is a deferred decision — not part of this pilot.';
  host.append(deferred);

  window.requestAnimationFrame(() => { fill.style.width = weight + '%'; });
}

// Top-nav links work from EVERY audience: switch to the audience where the target
// section lives (home for the brand story), then smooth-scroll to it. Fixes the dead
// "How it works" / "Why Covenda" links on the company/university tabs.
$$('.site-nav [data-nav-target]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  if (link.dataset.navAudience) setAudience(link.dataset.navAudience);
  setSurface('site');
  const target = document.getElementById(link.dataset.navTarget);
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), 60);
}));

$$('[data-action]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'home') { setAudience('home'); setSurface('site'); window.scrollTo({ top: 0, behavior: 'instant' }); }
  if (action === 'site') setSurface('site');
  if (action === 'workspace') setSurface('workspace');
  if (action === 'workspace-submissions') {
    setAudience('student');
    setSurface('workspace');
    setWorkspaceTab('submissions');
  }
  if (action === 'student-quick') openQuickJoin();
  if (action === 'request-endorsement') openRequestEndorse();
  if (action === 'refresh-delivery') {
    refreshDeliveryHealth({ force: true }).then(primary => {
      showToast(primary.status === 'ready' ? 'Primary inbox is connected.' : 'Primary inbox still needs attention.');
    });
  }
  if (action === 'student-form') {
    selectWorkType(state.workType);
    // §8: mirror the hero narrowing picks into the account form EVERY time it opens —
    // additively (checks are only ever added, never removed), so the first page always shows
    // all the buttons the student tapped without clobbering anything they checked by hand.
    let seeded = false;
    narrowPicks().industries.forEach(ind => {
      const cb = studentForm.querySelector('input[name="studentIndustry"][value="' + ind.replace(/"/g, '') + '"]');
      if (cb && !cb.checked) { cb.checked = true; seeded = true; }
    });
    if (seeded) renderStudentSpecializations(studentForm);
    openDialog(studentDialog, studentForm);
  }
  if (action === 'company-form') {
    const seed = $('#companyProblemSeed').value.trim();
    openDialog(companyDialog, companyForm);
    if (seed && !formValue(companyForm, 'companyProblem')) {
      $('[name="companyProblem"]', companyForm).value = seed;
      saveDraft(companyForm);
    }
  }
  // "Create Project" routes into the member portal, where a company account is created/signed
  // in and the project is actually posted. The typed brief rides along so the portal can
  // prefill it once you're a company.
  if (action === 'portal-create-project') {
    const seed = $('#companyProblemSeed')?.value.trim() || '';
    try { if (seed) localStorage.setItem('covendaProjectSeed', seed); } catch (_) {}
    window.location.href = 'portal.html?intent=create-project';
  }
  if (action === 'schedule-demo') scheduleDemo();
  if (action === 'university-roster') openUniversityRoster();
  if (action === 'roster-paste') {
    const textarea = $('#rosterPaste');
    const interest = $('#rosterInterest')?.value || universityInterests[0];
    const message = $('#rosterMessage');
    const result = parsePastedRoster(textarea.value, interest);
    textarea.value = '';
    renderRoster();
    saveRosterDraft();
    message.classList.remove('is-success');
    message.textContent = result.added
      ? 'Added ' + result.added + (result.added === 1 ? ' student' : ' students') + (result.skipped ? ' · ' + result.skipped + ' skipped (duplicate or invalid).' : '.')
      : 'No students added. Use one per line as “Name, email”.';
  }
  if (action === 'roster-clear') {
    universityRoster = [];
    renderRoster();
    saveRosterDraft();
  }
  if (action === 'roster-submit') submitRoster();
  if (action === 'roster-endorse') submitEndorsement();
  if (action === 'focus-pathfinder') {
    $('#studentPathfinder').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => $('.work-option.is-selected')?.focus(), 420);
  }
  if (action === 'explore-back') closeWorkDetail();
  if (action === 'flow-prev') { flowStep -= 1; renderFlowStep(); }
  if (action === 'flow-next') { flowStep += 1; renderFlowStep(); }
  if (action === 'project-fit') $('#projectFit').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (action === 'readiness-check') window.openReadinessCheck?.();
  if (action === 'replay-intro') {
    setSurface('site');
    openIntro({ force: true });
  }
  // F3 partner referral
  if (action === 'referral-start') { setAudience('student'); selectWorkType(state.workType); openDialog(studentDialog, studentForm); }
  if (action === 'referral-dismiss') dismissReferralBanner();
  if (action === 'referral-copy') copyReferralLink();
  // F5 credential card
  if (action === 'credential-image' && credentialItem) downloadCredentialImage(credentialItem);
  if (action === 'credential-copy' && credentialItem) copyCredentialText(credentialItem);
  if (action === 'credential-json' && credentialItem) downloadReceipt(credentialItem);
  // F4 student proof record → open the credential card for the latest receipt
  if (action === 'proof-credential') {
    const item = studentLatestReceipt();
    if (item) openCredentialCard(item);
    else showToast('Build your interest profile first to create a shareable credential.');
  }
}));

$$('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  const textarea = $('#companyProblemSeed');
  if (!textarea.value.trim()) textarea.value = button.dataset.prompt;
  else if (!textarea.value.includes(button.dataset.prompt)) textarea.value = textarea.value.trim() + '\n' + button.dataset.prompt;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}));

// Live project-fit signal for the company hero. Mirrors the #projectFit table so
// the composer visibly does something as the visitor types — and teaches the
// safety boundary before they invest effort. Same text also prefills the demo.
const FIT_BLOCKERS = [
  /production\b/i, /client (records|data|files)/i, /customer (records|data)/i,
  /patient/i, /\bpii\b/i, /\bssn\b/i, /social security/i, /health record/i,
  /medical record/i, /regulated/i, /restricted/i, /proprietary/i, /confidential/i,
  /credential|password|api key|secret/i, /financial account/i, /bank account/i,
];
const FIT_REDESIGN = [
  /supervis/i, /real[- ]?time/i, /on[- ]?call/i, /\basap\b/i, /urgent/i,
  /live (access|support)/i, /shadow/i,
];
function classifyProblemFit(text) {
  const clean = text.trim();
  if (clean.length < 12) return { state: 'empty', label: 'Start typing — we’ll show project fit' };
  if (FIT_BLOCKERS.some(re => re.test(clean))) return { state: 'blocked', label: 'Not eligible — involves restricted access or records' };
  if (clean.length < 45 || FIT_REDESIGN.some(re => re.test(clean))) return { state: 'redesign', label: 'Needs redesign — add a clear, safe deliverable' };
  return { state: 'good', label: 'Good first fit — safe to scope' };
}
(() => {
  const seed = $('#companyProblemSeed');
  const chip = $('#companyFitChip');
  if (!seed || !chip) return;
  const update = () => {
    const { state, label } = classifyProblemFit(seed.value);
    chip.dataset.fit = state;
    chip.textContent = label;
  };
  seed.addEventListener('input', update);
  update();
})();

// ---- Optional one-minute student video intro -----------------------------
// Link-based MVP: accept an already-hosted Loom / YouTube / Vimeo URL and show a
// polished, click-to-load player. No third-party iframe/script loads until the
// student clicks play — privacy-friendly, reduced-motion safe, and keeps the
// page fast. The card renders in the intake dialog and the workspace profile.
const VIDEO_HOSTS = [
  {
    name: 'Loom',
    test: host => /(^|\.)loom\.com$/.test(host),
    embed: u => { const id = u.pathname.split('/').filter(Boolean).pop(); return id ? 'https://www.loom.com/embed/' + encodeURIComponent(id) : null; },
  },
  {
    name: 'YouTube',
    test: host => /(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host),
    embed: u => {
      let id = '';
      if (/youtu\.be$/.test(u.hostname)) id = u.pathname.split('/').filter(Boolean)[0] || '';
      else if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) id = u.pathname.split('/').filter(Boolean)[1] || '';
      else id = u.searchParams.get('v') || '';
      return /^[\w-]{6,20}$/.test(id) ? 'https://www.youtube-nocookie.com/embed/' + id : null;
    },
  },
  {
    name: 'Vimeo',
    test: host => /(^|\.)vimeo\.com$/.test(host),
    embed: u => { const id = u.pathname.split('/').filter(Boolean).pop(); return /^\d+$/.test(id) ? 'https://player.vimeo.com/video/' + id : null; },
  },
];
function detectVideoHost(raw) {
  const clean = (raw || '').trim();
  if (!clean) return null;
  let u;
  try { u = new URL(clean); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  // A recording we stored (Vercel Blob) or a direct video file plays natively.
  if (/\.blob\.vercel-storage\.com$/.test(u.hostname) || /\.(webm|mp4|mov|m4v)$/i.test(u.pathname)) {
    return { name: 'Recording', native: true, src: u.toString() };
  }
  for (const host of VIDEO_HOSTS) {
    if (host.test(u.hostname)) {
      const embed = host.embed(u);
      if (embed) return { name: host.name, embed, watch: u.toString() };
    }
  }
  return null;
}
function videoIntroReviewLabel(raw) {
  if (!(raw || '').trim()) return 'Not added';
  const host = detectVideoHost(raw);
  return host ? host.name + ' intro added' : 'Link needs a valid Loom, YouTube, or Vimeo URL';
}
function renderVideoIntroCard(container, rawUrl, opts = {}) {
  if (!container) return;
  const host = detectVideoHost(rawUrl);
  const hasText = Boolean((rawUrl || '').trim());
  container.textContent = '';
  container.dataset.state = host ? 'added' : (hasText ? 'invalid' : 'empty');
  if (!host) {
    // In the workspace there is no input, so hide entirely when nothing valid.
    if (opts.context === 'workspace') { container.hidden = true; return; }
    if (!hasText) { container.hidden = true; return; }
    container.hidden = false;
    const warn = document.createElement('p');
    warn.className = 'video-intro-warn';
    warn.setAttribute('role', 'status');
    warn.textContent = 'That link isn’t a Loom, YouTube, or Vimeo video yet.';
    container.append(warn);
    return;
  }
  container.hidden = false;
  const card = document.createElement('div');
  card.className = 'video-intro-player';
  if (host.native) {
    const vid = document.createElement('video');
    vid.className = 'video-frame';
    vid.src = host.src;
    vid.controls = true;
    vid.playsInline = true;
    vid.preload = 'metadata';
    card.append(vid);
  } else {
    const poster = document.createElement('div');
    poster.className = 'video-poster';
    poster.innerHTML =
      '<button type="button" class="video-play" aria-label="Play video introduction">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>'
      + '<span class="video-duration">≈ 1 min</span>'
      + '<span class="video-host">' + host.name + '</span>';
    poster.querySelector('.video-play').addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = host.embed;
      frame.title = 'Video introduction';
      frame.className = 'video-frame';
      frame.loading = 'lazy';
      frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
      frame.setAttribute('allowfullscreen', '');
      poster.replaceWith(frame);
    });
    card.append(poster);
  }
  const actions = document.createElement('div');
  actions.className = 'video-actions';
  const replace = document.createElement('button');
  replace.type = 'button';
  replace.className = 'outline-button';
  replace.textContent = 'Replace';
  replace.addEventListener('click', () => opts.onReplace && opts.onReplace());
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'quiet-link video-remove';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => opts.onRemove && opts.onRemove());
  actions.append(replace, remove);
  card.append(actions);
  const privacy = document.createElement('p');
  privacy.className = 'video-privacy';
  privacy.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2m-13 0h14v10H5z"/></svg>'
    + 'Shared only with Covenda’s pilot team unless you choose otherwise.';
  card.append(privacy);
  container.append(card);
}
(() => {
  const input = document.querySelector('[data-video-intro-input]');
  const card = document.querySelector('#studentVideoIntroCard');
  const transcriptField = document.querySelector('[data-video-transcript-field]');
  if (!input || !card) return;
  const sync = () => {
    const host = detectVideoHost(input.value);
    renderVideoIntroCard(card, input.value, {
      onReplace: () => { input.focus(); input.select(); },
      onRemove: () => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      },
    });
    if (transcriptField) transcriptField.hidden = !host;
  };
  input.addEventListener('input', sync);
  sync();
})();

// ---- In-browser video-intro recorder (full-screen overlay) ---------------
// Opens a large, focused recorder as a modal <dialog> (so it stacks above the
// intake form): big camera, a standard 3-2-1 pre-roll countdown, a clean mono
// timer, then Retake / Use. Uploads to /api/video-upload and saves the returned
// URL as the video intro. Degrades gracefully when recording/camera is unavailable.
(() => {
  const toggle = document.querySelector('[data-video-record-toggle]');
  const input = document.querySelector('[data-video-intro-input]');
  if (!toggle || !input) return;
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof MediaRecorder !== 'undefined';
  // No camera/MediaRecorder here — hide the recorder and open the paste-a-link fallback
  // so the option is never simply missing.
  if (!canRecord) { toggle.hidden = true; document.querySelector('.video-link-fallback')?.setAttribute('open', ''); return; }

  const MAX_SECONDS = 60;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = s => '0:' + String(s).padStart(2, '0');
  let overlay = null, body = null, stream = null, recorder = null, chunks = [], timer = null, seconds = 0, recordedBlob = null;

  function teardown() {
    if (timer) clearInterval(timer);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = recorder = null;
    if (overlay) overlay.remove();
    overlay = body = null;
  }
  function closeRec() { if (overlay && overlay.open) overlay.close(); else teardown(); }

  function ensureOverlay() {
    overlay = document.createElement('dialog');
    overlay.className = 'rec-overlay';
    overlay.setAttribute('aria-label', 'Record a one-minute video intro');
    const panel = document.createElement('div'); panel.className = 'rec-panel';
    const head = document.createElement('div'); head.className = 'rec-head';
    const heading = document.createElement('div');
    heading.innerHTML = '<p class="rec-kicker">Video intro</p><h3 class="rec-title">Record a 1-minute intro</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.className = 'rec-close'; closeBtn.setAttribute('aria-label', 'Close recorder'); closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeRec);
    head.append(heading, closeBtn);
    body = document.createElement('div'); body.className = 'rec-body';
    panel.append(head, body);
    overlay.append(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeRec(); });
    overlay.addEventListener('close', teardown);
    document.body.append(overlay);
    overlay.showModal();
  }
  function status(cls, text) {
    body.innerHTML = '';
    const p = document.createElement('p'); p.className = cls; p.setAttribute('role', 'status'); p.textContent = text;
    body.append(p);
  }
  async function open() {
    if (!overlay) ensureOverlay();
    status('rec-status', 'Requesting camera…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true });
    } catch {
      body.innerHTML = '';
      const p = document.createElement('p'); p.className = 'rec-error';
      p.textContent = 'Camera access was blocked. Allow the camera in your browser, or close this and paste a video link instead.';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'outline-button'; b.textContent = 'Close'; b.addEventListener('click', closeRec);
      body.append(p, b);
      return;
    }
    renderLive();
  }
  function renderLive() {
    body.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'rec-stage';
    const preview = document.createElement('video'); preview.className = 'rec-video is-mirror'; preview.autoplay = true; preview.muted = true; preview.playsInline = true; preview.srcObject = stream;
    const timerEl = document.createElement('div'); timerEl.className = 'rec-timer';
    timerEl.innerHTML = '<span class="rec-dot"></span><span class="rec-time">0:00</span><span class="rec-max">/ 1:00</span>';
    const count = document.createElement('div'); count.className = 'rec-count'; count.hidden = true;
    stage.append(preview, timerEl, count);
    const controls = document.createElement('div'); controls.className = 'rec-controls';
    const recBtn = document.createElement('button'); recBtn.type = 'button'; recBtn.className = 'gold-button rec-record'; recBtn.textContent = 'Record';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'quiet-link'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', closeRec);
    controls.append(recBtn, cancel);
    body.append(stage, controls);
    let recording = false;
    recBtn.addEventListener('click', () => {
      if (recording) { stop(); return; }
      recording = true; recBtn.disabled = true;
      countdown(count, () => { recBtn.disabled = false; recBtn.textContent = 'Stop'; recBtn.classList.add('is-recording'); startRec(timerEl); });
    });
  }
  function countdown(el, done) {
    if (reduce) { done(); return; }  // reduced motion: no animated pre-roll
    let n = 3;
    el.hidden = false; el.textContent = n; el.classList.add('pop');
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(iv); el.hidden = true; done(); return; }
      el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }, 1000);
  }
  function startRec(timerEl) {
    chunks = []; seconds = 0; recordedBlob = null;
    timerEl.querySelector('.rec-dot').classList.add('is-live');
    const time = timerEl.querySelector('.rec-time');
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => { recordedBlob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'video/webm' }); renderReview(); };
    recorder.start();
    timer = setInterval(() => { seconds += 1; time.textContent = fmt(seconds); if (seconds >= MAX_SECONDS) stop(); }, 1000);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }
  function renderReview() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    body.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'rec-stage';
    const vid = document.createElement('video'); vid.className = 'rec-video'; vid.src = URL.createObjectURL(recordedBlob); vid.controls = true; vid.playsInline = true;
    stage.append(vid);
    const controls = document.createElement('div'); controls.className = 'rec-controls';
    const retake = document.createElement('button'); retake.type = 'button'; retake.className = 'outline-button'; retake.textContent = 'Retake'; retake.addEventListener('click', open);
    const use = document.createElement('button'); use.type = 'button'; use.className = 'gold-button'; use.textContent = 'Use this intro';
    const st = document.createElement('p'); st.className = 'rec-status'; st.setAttribute('role', 'status');
    use.addEventListener('click', () => upload(st, use, retake));
    controls.append(retake, use);
    body.append(stage, controls, st);
  }
  async function upload(st, use, retake) {
    use.disabled = true; retake.disabled = true; st.textContent = 'Saving your intro…';
    try {
      const res = await fetch('/api/video-upload', { method: 'POST', headers: { 'Content-Type': recordedBlob.type || 'video/webm' }, body: recordedBlob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not save the recording.');
      input.value = data.url; input.dispatchEvent(new Event('input', { bubbles: true }));
      closeRec();
      if (typeof showToast === 'function') showToast('Video intro saved.');
    } catch (e) {
      use.disabled = false; retake.disabled = false;
      st.textContent = (e && e.message) ? e.message : 'Could not save. You can paste a link instead.';
    }
  }
  toggle.addEventListener('click', open);
})();

// ---- University school-logo marquee --------------------------------------
// The <li> logos in index.html are the single editable source (placeholder,
// illustrative marks — real logos need trademark permission). Without JS the row
// renders statically; with reduced-motion it stays static; otherwise we clone the
// row once (aria-hidden) so translateX(-50%) loops seamlessly.
(() => {
  const track = document.querySelector('[data-school-track]');
  if (!track) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    track.dataset.mode = 'static';
    return;
  }
  for (const item of [...track.children]) {
    const clone = item.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);
  }
  track.dataset.mode = 'marquee';
})();

// ---- Student batches -----------------------------------------------------
// Pilot cohorts by INDUSTRY (not function): anyone can run a test or clean a
// sheet, so credibility is industry-specific — a batch builds a track record in
// one industry, the same reason a professor's endorsement matters. SINGLE editable
// source — add/remove/edit entries here to control which batches appear. A batch
// is an interest + credibility signal built through completed reviewed work, NOT a
// placement, job, ranking, or guarantee. NOTE: the batch a student joins is
// captured on the student submission (details.batch) — this structured batch +
// outcome data is the intended future training-data source for a per-industry
// capability assessment (no model or scoring is built yet).
const BATCHES = [
  { id: 'accounting-finance', industry: 'Accounting & finance', title: 'Accounting & finance', description: 'Reconciliations, close-prep checklists, cleanups, and workflow docs from real, de-identified finance work.', status: 'Pilot cohort · limited seats' },
  { id: 'software-ai', industry: 'Software & AI', title: 'Software & AI', description: 'QA passes, reproducible bug reports, docs, and data cleanups for software and AI teams.', status: 'Pilot cohort · limited seats' },
  { id: 'healthcare-ops', industry: 'Healthcare operations', title: 'Healthcare operations', description: 'Process mapping, documentation, and public-source research — never any patient records.', status: 'Forming' },
  { id: 'consumer-retail', industry: 'Consumer & retail', title: 'Consumer & retail', description: 'Customer-research synthesis, competitor scans, and approved catalog/data cleanups.', status: 'Forming' },
  { id: 'professional-services', industry: 'Professional services', title: 'Professional services', description: 'Research briefs, playbooks, and operations docs for consulting, legal, and agency teams.', status: 'Forming' },
];
function joinBatch(batch) {
  const field = $('#studentBatch');
  if (field) field.value = batch.id + ' \u00b7 ' + batch.industry;
  openDialog(studentDialog, studentForm);
  if (field) saveDraft(studentForm);
}

// The public batch board. Renders the SAME brief the portal renders — fetched from
// api/batches.js via the pre-auth 'batch-briefs' action — so the bar a visitor reads here
// and the bar the portal checks them against can never drift apart.
//
// Selection state for the board. A student is usually weighing two or three benches, so the
// card is a CHOICE, not a commit — the old per-card "Join this batch" button asked for a
// decision before showing what the bench actually requires.
const batchPicks = new Set();
const batchBriefIndex = new Map();

function renderBatchCard(grid, entry, brief) {
  const card = document.createElement('article');
  card.className = 'batch-card glass-panel is-pickable';
  card.append(
    Object.assign(document.createElement('p'), { className: 'batch-function', textContent: entry.industry }),
    Object.assign(document.createElement('h3'), { className: 'batch-title', textContent: entry.title }),
    Object.assign(document.createElement('p'), { className: 'batch-desc', textContent: brief ? brief.summary : entry.description }),
    Object.assign(document.createElement('span'), { className: 'batch-status', textContent: entry.status }),
  );
  if (brief) batchBriefIndex.set(entry.id, { entry, brief });

  // The whole card is the target. A separate "Select" button asked the reader to find a
  // small control on a big obvious box — the box IS the control. Kept keyboard-operable and
  // announced as a toggle rather than faking it with a click handler on a div.
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-pressed', 'false');
  card.dataset.batchPick = entry.id;

  const mark = document.createElement('span');
  mark.className = 'batch-mark';
  mark.append(createIcon('icon-check'));
  card.append(mark);

  const toggle = () => {
    const on = !batchPicks.has(entry.id);
    if (on) batchPicks.add(entry.id); else batchPicks.delete(entry.id);
    card.setAttribute('aria-pressed', String(on));
    card.classList.toggle('is-picked', on);
    if (on) {
      // A short, one-shot confirmation. Restarted by hand so rapid re-selection still reads.
      card.classList.remove('just-picked');
      void card.offsetWidth;
      card.classList.add('just-picked');
    }
    syncBatchPickBar();
    batchWeb?.animate();
  };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); // Space would scroll the page
    toggle();
  });

  grid.append(card);
}

function syncBatchPickBar() {
  const bar = $('#batchPickBar');
  if (!bar) return;
  const n = batchPicks.size;
  bar.hidden = n === 0;
  $('#batchPickCount').textContent = n === 1 ? '1 bench selected' : n + ' benches selected';
}

// A labelled flow diagram per bench: the vetting rails feeding the bar, the bar feeding
// review, review feeding the bench. Built from the brief so it can never describe a rail
// the batch does not actually use.
function batchDiagram(brief) {
  const fig = document.createElement('figure');
  fig.className = 'bd-figure';
  fig.setAttribute('role', 'group');
  fig.setAttribute('aria-label',
    brief.name + ' vetting flow: ' + brief.vetting.rails.map(r => r.label).join(', ')
    + ' produce evidence, which is checked against ' + brief.requirements.length
    + ' published requirements, then reviewed by an operator before admission to the bench.');

  const rails = document.createElement('div');
  rails.className = 'bd-rails';
  brief.vetting.rails.forEach(rail => {
    const node = document.createElement('div');
    node.className = 'bd-node bd-rail';
    node.append(
      Object.assign(document.createElement('b'), { textContent: rail.label }),
      Object.assign(document.createElement('span'), { textContent: rail.how }),
    );
    rails.append(node);
  });
  fig.append(rails);
  fig.append(Object.assign(document.createElement('div'), { className: 'bd-arrow', ariaHidden: 'true' }));

  const bar = document.createElement('div');
  bar.className = 'bd-node bd-bar';
  bar.append(
    Object.assign(document.createElement('b'), { textContent: 'The published bar' }),
    Object.assign(document.createElement('span'), { textContent: brief.requirements.length + ' requirements, each one stated up front' }),
  );
  fig.append(bar);
  fig.append(Object.assign(document.createElement('div'), { className: 'bd-arrow', ariaHidden: 'true' }));

  const review = document.createElement('div');
  review.className = 'bd-node bd-review';
  review.append(
    Object.assign(document.createElement('b'), { textContent: 'Operator review' }),
    Object.assign(document.createElement('span'), { textContent: 'Clearing the bar is a recommendation. A human decides and records why.' }),
  );
  fig.append(review);
  fig.append(Object.assign(document.createElement('div'), { className: 'bd-arrow', ariaHidden: 'true' }));

  const bench = document.createElement('div');
  bench.className = 'bd-node bd-bench';
  bench.append(
    Object.assign(document.createElement('b'), { textContent: 'The bench' }),
    Object.assign(document.createElement('span'), { textContent: 'Companies unlock it and see your evidence, not your résumé.' }),
  );
  fig.append(bench);
  return fig;
}

const HOW_TO_APPLY = [
  ['Check where you stand', 'Every requirement below is public. Work out which ones you already clear before you write anything.'],
  ['Close the nearest gap', 'One artifact or one connected account usually moves two requirements at once.'],
  ['Record a short walkthrough', 'Five minutes on work you did, unscripted. This is the authorship check, and it is the part that cannot be faked.'],
  ['Apply', 'A few written answers about why this field. You can apply before you clear everything — the bar is guidance, not a gate.'],
  ['Operator review', 'A person reads it and records a reason either way. A miss comes back with the specific gap, not a rejection.'],
];

// The deep dive: one full-width walkthrough per selected bench.
function renderBatchDeepDive() {
  const host = $('#batchDeep');
  if (!host) return;
  host.replaceChildren();
  const picked = [...batchPicks].map(id => batchBriefIndex.get(id)).filter(Boolean);
  if (!picked.length) { host.hidden = true; return; }

  picked.forEach(({ brief }) => {
    const panel = document.createElement('article');
    panel.className = 'bd-panel';

    const head = document.createElement('header');
    head.className = 'bd-head';
    head.append(
      Object.assign(document.createElement('p'), { className: 'feature-kicker', textContent: brief.tier === 'elite' ? 'Elite bench' : 'Open bench' }),
      Object.assign(document.createElement('h3'), { textContent: brief.name }),
      Object.assign(document.createElement('p'), { className: 'bd-lede', textContent: brief.description }),
    );
    panel.append(head);
    panel.append(batchDiagram(brief));

    const railBadge = document.createElement('span');
    railBadge.className = 'pb-badge' + (brief.vetting.apiVerified ? ' is-api' : '');
    railBadge.textContent = brief.vetting.apiVerified
      ? 'Platform-verified evidence' : 'Human rail — no API can prove this work';
    panel.append(railBadge);

    const reqs = document.createElement('section');
    reqs.className = 'bd-block';
    reqs.append(Object.assign(document.createElement('h4'), { textContent: 'What this bench asks of you' }));
    const list = document.createElement('ol');
    list.className = 'bd-reqs';
    brief.requirements.forEach((req, i) => {
      const li = document.createElement('li');
      li.append(Object.assign(document.createElement('span'), { className: 'bd-n', textContent: String(i + 1) }));
      const body = document.createElement('div');
      body.append(Object.assign(document.createElement('strong'), { textContent: req.label }));
      if (req.detail) body.append(Object.assign(document.createElement('p'), { textContent: req.detail }));
      li.append(body);
      list.append(li);
    });
    reqs.append(list);
    panel.append(reqs);

    const how = document.createElement('section');
    how.className = 'bd-block';
    how.append(Object.assign(document.createElement('h4'), { textContent: 'How to apply' }));
    const steps = document.createElement('ol');
    steps.className = 'bd-steps';
    HOW_TO_APPLY.forEach(([title, detail], i) => {
      const li = document.createElement('li');
      li.append(Object.assign(document.createElement('span'), { className: 'bd-n', textContent: String(i + 1) }));
      const body = document.createElement('div');
      body.append(
        Object.assign(document.createElement('strong'), { textContent: title }),
        Object.assign(document.createElement('p'), { textContent: detail }),
      );
      li.append(body);
      steps.append(li);
    });
    how.append(steps);
    panel.append(how);

    const cta = document.createElement('div');
    cta.className = 'bd-cta';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'gold-button';
    apply.append(document.createTextNode('Apply to ' + brief.name), createIcon('icon-arrow-right'));
    apply.addEventListener('click', () => joinBatch({ id: brief.slug, industry: brief.discipline }));
    cta.append(apply);
    panel.append(cta);
    host.append(panel);
  });

  host.hidden = false;
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Declared before the IIFE that assigns it: a `let` assigned above its own declaration is
// a temporal-dead-zone ReferenceError, which kills a classic script dead at that line.
let batchWeb = null;

(() => {
  const grid = document.querySelector('[data-batch-grid]');
  if (!grid) return;
  const paint = briefs => {
    grid.textContent = '';
    batchBriefIndex.clear();
    for (const entry of BATCHES) {
      // Match on slug; the old hardcoded ids drifted from the catalogue (healthcare-ops vs
      // healthcare-operations), so fall back to the discipline name.
      const brief = (briefs || []).find(b => b.slug === entry.id)
        || (briefs || []).find(b => b.name === entry.industry)
        || null;
      renderBatchCard(grid, entry, brief);
    }
    // The fetch repaints over the fallback cards; re-apply any selection made in between so
    // a fast clicker does not have their choice silently dropped.
    $$('[data-batch-pick]').forEach(b => {
      if (!batchPicks.has(b.dataset.batchPick)) return;
      b.setAttribute('aria-pressed', 'true');
      b.classList.add('is-picked');
    });
    syncBatchPickBar();
  };
  paint(null); // Static-preview safe: cards render before (and without) the serverless call.
  batchWeb = initBatchWeb();
  $('#batchLearnMore')?.addEventListener('click', renderBatchDeepDive);
  $('#batchPickClear')?.addEventListener('click', () => {
    batchPicks.clear();
    $$('[data-batch-pick]').forEach(b => {
      b.setAttribute('aria-pressed', 'false');
      b.classList.remove('is-picked', 'just-picked');
    });
    syncBatchPickBar();
    batchWeb?.redraw();
    const host = $('#batchDeep');
    if (host) { host.replaceChildren(); host.hidden = true; }
  });
  fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batch-briefs' }),
  })
    .then(res => (res.ok ? res.json() : null))
    .then(data => { if (data && data.ok && Array.isArray(data.batches)) paint(data.batches); })
    .catch(() => { /* No serverless in static preview — the plain cards above still stand. */ });
})();

$('#submissionHistory').addEventListener('click', event => {
  const button = event.target.closest('[data-receipt-action]');
  if (!button) return;
  const action = button.dataset.receiptAction;
  if (action === 'start') {
    if (state.audience === 'university') openUniversityRoster();
    else if (state.audience === 'student') openDialog(studentDialog, studentForm);
    else openDialog(companyDialog, companyForm);
    return;
  }
  const item = submissionForReference(button.dataset.reference);
  if (!item) {
    showToast('This receipt is no longer available on this device.');
    return;
  }
  if (action === 'copy') copyReceiptReference(item.reference);
  if (action === 'download') downloadReceipt(item);
  if (action === 'verify') openReceiptRecovery(item);
  if (action === 'packet') toggleReceiptPacket(button, item);
  if (action === 'revise') startPacketRevision(item);
  if (action === 'credential') openCredentialCard(item);
});

const receiptRecoveryForm = $('#receiptRecoveryForm');
const receiptReferenceInput = $('[name="receiptReference"]', receiptRecoveryForm);
receiptReferenceInput.addEventListener('input', () => {
  receiptReferenceInput.value = receiptReferenceInput.value.toUpperCase().replace(/\s/g, '');
});
receiptRecoveryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!receiptRecoveryForm.reportValidity()) return;
  const submit = $('button[type="submit"]', receiptRecoveryForm);
  const message = $('#receiptRecoveryMessage');
  submit.disabled = true;
  submit.textContent = 'Looking up…';
  message.className = 'receipt-recovery-message';
  message.textContent = 'Checking Covenda’s private server inbox…';
  try {
    const result = await findServerReceipt(
      formValue(receiptRecoveryForm, 'receiptReference'),
      formValue(receiptRecoveryForm, 'receiptEmail'),
    );
    const receipt = result.receipt;
    const existing = submissionForReference(receipt.reference);
    setAudience(submissionAudience(receipt));
    saveSubmission({
      ...(existing || {}),
      type: receipt.type,
      reference: receipt.reference,
      status: receipt.status,
      storage: 'supabase',
      storageRoute: result.route,
      syncStatus: 'synced',
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
      recovered: existing?.recovered || !existing,
      title: existing?.title || submissionLabel(receipt) + ' · ' + receipt.reference,
      summary: existing?.summary || '',
    });
    setSurface('workspace');
    setWorkspaceTab('submissions');
    message.classList.add('is-success');
    message.textContent = 'Receipt recovered. Its current server status is “' + submissionStatusLabel(receipt.status) + '.”';
    receiptRecoveryForm.reset();
    showToast('Server receipt recovered on this device.');
    window.setTimeout(() => $('[data-reference="' + receipt.reference + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  } catch (error) {
    message.classList.add('is-error');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Recover receipt ' + iconUse('icon-arrow-right');
  }
});

$('#introEnter').addEventListener('click', () => dismissIntro());
$('#introSkip').addEventListener('click', () => dismissIntro({ fast: true }));
$('#introScreen').addEventListener('cancel', event => {
  event.preventDefault();
  dismissIntro({ fast: true });
});

const restoredAudience = readStorage(audienceStorageKey, 'home');
if (['home', 'student', 'company', 'university'].includes(restoredAudience)) state.audience = restoredAudience;
const restoredWorkTypes = checkedValues(studentForm, 'workType');
const rememberedWorkType = readStorage(workTypeStorageKey, 'Research');
if (restoredWorkTypes.length) state.workType = restoredWorkTypes[0];
else if (rememberedWorkType) state.workType = rememberedWorkType;
// ---- Motion (adapted from design_handoff_covenda_motion/covenda-motion.js) ----
// Vanilla helper: play anything marked [data-animate] once it scrolls into view.
function initCovendaMotion(root = document) {
  const els = $$('[data-animate]:not([data-play])', root);
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.setAttribute('data-play', ''));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.setAttribute('data-play', '');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  els.forEach(el => observer.observe(el));
}

// Demo 2: coordinated Problem -> Packet -> Proof sequence. Armed only when
// motion is allowed, so no-JS and reduced-motion visitors keep static content.
function initFlowDemo() {
  const demo = $('#flowDemo');
  if (!demo) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  demo.classList.add('is-armed');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        demo.classList.add('is-playing');
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(demo);
}

function initSelectorFx() {
  const canvas = $('#selectorFxCanvas');
  const field = canvas?.closest('.selector-fx');
  const orbit = canvas?.closest('.selector-orbit');
  if (!canvas || !field || !orbit) return null;
  const context = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = [];
  const pointer = { x: 0, y: 0, active: false };
  const pulse = { x: 0, y: 0, strength: 0 };
  let width = 0;
  let height = 0;
  let previousTime = 0;

  function seedParticles() {
    particles.length = 0;
    const count = Math.max(22, Math.min(38, Math.round(width / 34)));
    for (let index = 0; index < count; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: 54 + Math.random() * Math.max(40, height - 108),
        vx: (Math.random() - .5) * .12,
        vy: (Math.random() - .5) * .09,
        radius: .8 + Math.random() * 1.7,
        alpha: .16 + Math.random() * .34,
      });
    }
  }

  function draw(time = 0) {
    const elapsed = Math.min(32, time - previousTime || 16);
    previousTime = time;
    context.clearRect(0, 0, width, height);
    const influenceX = pointer.active ? pointer.x : width * .5;
    const influenceY = pointer.active ? pointer.y : height * .52;

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!reduceMotion) {
        const dx = influenceX - particle.x;
        const dy = influenceY - particle.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 180) {
          particle.vx += (dx / distance) * .0008 * elapsed;
          particle.vy += (dy / distance) * .0008 * elapsed;
        }
        particle.vx *= .992;
        particle.vy *= .992;
        particle.x += particle.vx * elapsed;
        particle.y += particle.vy * elapsed;
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < 38) particle.y = height - 38;
        if (particle.y > height - 32) particle.y = 38;
      }

      for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
        const other = particles[otherIndex];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
        if (distance > 112) continue;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = `rgba(180,123,32,${(1 - distance / 112) * .12})`;
        context.lineWidth = .7;
        context.stroke();
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(159,101,10,${particle.alpha})`;
      context.fill();
    }

    if (pulse.strength > .01) {
      const radius = 28 + (1 - pulse.strength) * 100;
      const gradient = context.createRadialGradient(pulse.x, pulse.y, 0, pulse.x, pulse.y, radius);
      gradient.addColorStop(0, `rgba(231,198,121,${pulse.strength * .34})`);
      gradient.addColorStop(1, 'rgba(231,198,121,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(pulse.x, pulse.y, radius, 0, Math.PI * 2);
      context.fill();
      if (!reduceMotion) pulse.strength *= .94;
    }

    if (!reduceMotion) window.requestAnimationFrame(draw);
  }

  function resize() {
    const bounds = field.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    seedParticles();
    if (reduceMotion) draw();
  }

  orbit.addEventListener('pointermove', event => {
    const bounds = field.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  });
  orbit.addEventListener('pointerleave', () => { pointer.active = false; });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(field);
  else window.addEventListener('resize', resize);
  resize();
  if (!reduceMotion) window.requestAnimationFrame(draw);

  return {
    pulse(button) {
      const fieldBounds = field.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      pulse.x = buttonBounds.left + buttonBounds.width / 2 - fieldBounds.left;
      pulse.y = buttonBounds.top + buttonBounds.height / 2 - fieldBounds.top;
      pulse.strength = 1;
      if (reduceMotion) draw();
    },
  };
}

function initButtonFeedback() {
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('button:not(:disabled)');
    if (button) button.classList.add('is-pressing');
  });
  for (const eventName of ['pointerup', 'pointercancel']) {
    document.addEventListener(eventName, () => {
      $$('.is-pressing').forEach(button => button.classList.remove('is-pressing'));
    });
  }
}

// ============================================================================
// F3 — Partner referral attribution (?ref= landing + partner's shareable link)
// ============================================================================
const referralStorageKey = 'covendaReferral';

// Deterministic 6-char code from a partner's org + email, so one partner keeps one
// stable link. Shape matches the REF- reference format used across the API/migration.
function makeReferralCode(org, email) {
  const seed = (String(org || '') + '|' + String(email || '')).trim().toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const body = (hash.toString(36).toUpperCase() + 'COVENDA').replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return 'REF-' + body;
}

function referralBaseUrl() {
  const origin = location.origin && location.origin !== 'null' ? location.origin : 'https://covenda.app';
  return origin + location.pathname.replace(/index\.html?$/, '');
}

function partnerReferralLink() {
  const partner = partnerFieldValues();
  const org = (partner.orgName || '').trim();
  if (!org) return '';
  return referralBaseUrl() + '?ref=' + makeReferralCode(org, partner.contactEmail) + '&via=' + encodeURIComponent(org);
}

// Untrusted URL input — sanitized before display/storage; `via` is rendered with
// textContent only (never innerHTML), and is a partner's own public label, not PII.
function readReferralFromUrl() {
  let params;
  try { params = new URLSearchParams(location.search); } catch { return null; }
  const raw = (params.get('ref') || '').trim();
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  if (!code) return null;
  const via = (params.get('via') || '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return { code, via, at: new Date().toISOString() };
}

function activeReferral() {
  const stored = readStorage(referralStorageKey, null);
  return stored && stored.code ? stored : null;
}

function activeReferralPayload() {
  const ref = activeReferral();
  return { code: ref ? ref.code : '', via: ref ? ref.via : '' };
}

function renderReferralBanner() {
  const banner = $('#referralBanner');
  if (!banner) return;
  const ref = activeReferral();
  if (!ref || ref.dismissed) { banner.hidden = true; return; }
  const text = $('#referralBannerText');
  if (text) text.textContent = 'Referred by ' + (ref.via || 'a Covenda partner')
    + '. Your partner endorsement is noted — build your proof profile to carry it into the pilot.';
  banner.hidden = false;
}

// Dismiss only hides the banner — the attribution is kept so the student's submission,
// credential (F5), and proof record (F4) still reflect the partner endorsement.
function dismissReferralBanner() {
  const stored = readStorage(referralStorageKey, null);
  if (stored) { stored.dismissed = true; writeStorage(referralStorageKey, stored); }
  const banner = $('#referralBanner');
  if (banner) banner.hidden = true;
}

function partnerCohortLink() {
  const partner = partnerFieldValues();
  const org = (partner.orgName || '').trim();
  if (!org) return '';
  return referralBaseUrl() + 'cohort.html?ref=' + makeReferralCode(org, partner.contactEmail) + '&via=' + encodeURIComponent(org);
}

function renderReferralLink() {
  const section = $('#referralLinkSection');
  const input = $('#referralLinkInput');
  if (!section || !input) return;
  const link = partnerReferralLink();
  if (!link) { section.hidden = true; return; }
  input.value = link;
  const cohortInput = $('#cohortLinkInput');
  const cohortOpen = $('#cohortLinkOpen');
  const cohortLink = partnerCohortLink();
  if (cohortInput) cohortInput.value = cohortLink;
  if (cohortOpen) cohortOpen.href = cohortLink || '#';
  renderReferralQr(link);
  section.hidden = false;
}

// The referral link as a scannable code, for handing out in person. The encoder arrives on
// window.CovendaQR from the module bridge in index.html (app.js must stay classic). Degrades
// silently: no encoder, no QR block — the copyable link is unaffected.
function renderReferralQr(link) {
  const wrap = $('#referralQr');
  const holder = $('#referralQrCode');
  const download = $('#referralQrDownload');
  if (!wrap || !holder) return;
  const qr = window.CovendaQR;
  if (!qr || !link) { wrap.hidden = true; return; }
  try {
    holder.innerHTML = qr.makeQrSvg(link, { scale: 5, border: 3, dark: '#1a1a17' });
    if (download) {
      download.href = referralQrPng(qr, link);
      const code = (/[?&]ref=([^&]+)/.exec(link) || [])[1];
      download.setAttribute('download', code ? 'covenda-referral-' + code.toLowerCase() + '.png' : 'covenda-referral-qr.png');
    }
    wrap.hidden = false;
  } catch (_) {
    wrap.hidden = true; // an over-long link (or any encoder error) simply hides the code
  }
}

// Rasterize to PNG so the download saves to a phone's photos and prints cleanly; an SVG
// download lands as a file most photo apps won't preview.
function referralQrPng(qr, link, modulePx = 10, border = 4) {
  const out = qr.makeQrMatrix(link);
  const dim = (out.size + border * 2) * modulePx;
  const canvas = document.createElement('canvas');
  canvas.width = dim; canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#1a1a17';
  for (let r = 0; r < out.size; r += 1) {
    for (let c = 0; c < out.size; c += 1) {
      if (out.matrix[r][c]) ctx.fillRect((c + border) * modulePx, (r + border) * modulePx, modulePx, modulePx);
    }
  }
  return canvas.toDataURL('image/png');
}

// The encoder module may finish loading after the link is already on screen.
document.addEventListener('covenda-qr-ready', function () {
  const section = $('#referralLinkSection');
  if (section && !section.hidden) renderReferralQr(partnerReferralLink());
});

async function copyReferralLink() {
  const link = partnerReferralLink();
  if (!link) { showToast('Add your organization name first to generate a link.'); return; }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Referral link copied.');
  } catch {
    const input = $('#referralLinkInput');
    if (input) { input.focus(); input.select(); }
    showToast('Copy is unavailable. Select the link to copy it.');
  }
}

// ============================================================================
// F5 — Shareable milestone credential card (drawn to canvas for image export)
// ============================================================================
let credentialItem = null;

function credentialHolderName(item) {
  const name = String(item.title || '').split('·')[0].trim();
  return name || 'Covenda member';
}

// Honest mapping: standing is derived from the receipt's real status; verified rungs
// only appear once the server marks the work reviewed/approved.
function credentialMilestone(item) {
  const status = item.status || 'received';
  if (status === 'approved') return { label: 'Employer-Verified', index: 2 };
  if (status === 'packet_proposed' || status === 'approval_pending') return { label: 'Role-Qualified', index: 1 };
  if (activeReferral()) return { label: 'Endorsed', index: 0 };
  return { label: 'Building proof', index: 0 };
}

function drawFittedText(ctx, textValue, x, y, maxWidth, weight, family, sizePx, color) {
  let size = sizePx;
  ctx.fillStyle = color;
  while (size > 24) {
    ctx.font = weight + ' ' + size + 'px ' + family;
    if (ctx.measureText(textValue).width <= maxWidth) break;
    size -= 4;
  }
  ctx.fillText(textValue, x, y);
}

function drawCredentialCard(item) {
  const canvas = $('#credentialCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const serif = 'Georgia, "Times New Roman", serif';
  const sans = 'Arial, "Helvetica Neue", sans-serif';
  const milestone = credentialMilestone(item);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#17130d');
  bg.addColorStop(1, '#2c2114');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(201,164,90,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  ctx.fillStyle = '#e9c877';
  ctx.font = '600 44px ' + serif;
  ctx.fillText('Covenda', 72, 108);
  ctx.fillStyle = 'rgba(233,200,119,0.72)';
  ctx.font = '700 22px ' + sans;
  ctx.fillText('P R O O F   C R E D E N T I A L', 74, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '400 26px ' + sans;
  ctx.fillText('This record certifies that', 72, 262);
  drawFittedText(ctx, credentialHolderName(item), 72, 348, W - 150, '700', serif, 82, '#ffffff');

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '400 26px ' + sans;
  ctx.fillText('is building verifiable proof of real work. Current standing:', 72, 424);
  ctx.fillStyle = '#e9c877';
  ctx.font = '700 52px ' + serif;
  ctx.fillText(milestone.label, 72, 486);

  // Credibility rungs, current one lit. Sits higher up so the labels stay well
  // clear of the footer line below (they used to collide with the reference).
  const rungs = ['Endorsed / Building', 'Role-Qualified', 'Employer-Verified', 'Proven'];
  const pipY = 524, pipX0 = 74, gap = (W - 148) / rungs.length;
  rungs.forEach((label, i) => {
    const cx = pipX0 + gap * i + 18;
    const lit = i <= milestone.index;
    ctx.beginPath();
    ctx.arc(cx, pipY, 9, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#e9c877' : 'rgba(255,255,255,0.22)';
    ctx.fill();
    if (i < rungs.length - 1) {
      ctx.strokeStyle = i < milestone.index ? '#e9c877' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 12, pipY);
      ctx.lineTo(cx + gap - 12, pipY);
      ctx.stroke();
    }
    ctx.fillStyle = lit ? 'rgba(233,200,119,0.9)' : 'rgba(255,255,255,0.4)';
    ctx.font = '600 17px ' + sans;
    ctx.fillText(label, cx - 12, pipY + 30);
  });

  // Single footer line: reference · date · site — one row keeps it clear of the
  // rung labels above at every card size.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '400 22px ' + sans;
  ctx.fillText([item.reference || '', receiptDate(item.createdAt), 'covenda.app'].filter(Boolean).join('   ·   '), 72, H - 50);
}

function openCredentialCard(item) {
  credentialItem = item;
  const dialog = $('#credentialDialog');
  if (!dialog) return;
  const message = $('#credentialMessage');
  if (message) message.textContent = '';
  drawCredentialCard(item);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function downloadCredentialImage(item) {
  const canvas = $('#credentialCanvas');
  if (!canvas || !canvas.toBlob) { showToast('Image export is unavailable on this device.'); return; }
  canvas.toBlob(blob => {
    if (!blob) { showToast('Could not render the image.'); return; }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'covenda-credential-' + String(item.reference || 'card').toLowerCase() + '.png';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Credential image downloaded.');
  }, 'image/png');
}

async function copyCredentialText(item) {
  const milestone = credentialMilestone(item);
  const shareText = 'I’m building verifiable proof of my work with Covenda — current standing: '
    + milestone.label + '. Reference ' + item.reference + ' · covenda.app';
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('Share text copied.');
  } catch {
    const message = $('#credentialMessage');
    if (message) message.textContent = shareText;
    showToast('Copy is unavailable — the text is shown above.');
  }
}

// ============================================================================
// F4 — Student proof record ("where you stand"): the student's own position on
// the credibility ladder, endorsement status (from an F3 referral), and a
// shortcut to their shareable credential (F5). Same ladder the educators see.
// ============================================================================
function studentLatestReceipt() {
  return savedSubmissions().find(item => item.type === 'student_interest');
}

function studentStanding() {
  const receipt = studentLatestReceipt();
  if (receipt) {
    const milestone = credentialMilestone(receipt); // honest: derived from receipt status
    return { label: milestone.label, index: milestone.index, started: true, receipt };
  }
  // Referred but not yet submitted — a partner head-start still puts them at Endorsed.
  if (activeReferral()) return { label: 'Endorsed', index: 0, started: false, receipt: null };
  return { label: 'Not started', index: -1, started: false, receipt: null };
}

function renderProofRecord() {
  const panel = $('#proofRecord');
  if (!panel) return;
  const ladder = $('#proofRecordLadder');
  const standingEl = $('#proofRecordStanding');
  const endorsementEl = $('#proofRecordEndorsement');
  const shareBtn = $('#proofRecordShare');
  const standing = studentStanding();
  const ref = activeReferral();

  if (standingEl) {
    standingEl.textContent = standing.label;
    standingEl.dataset.started = String(standing.started || standing.index >= 0);
  }
  if (endorsementEl) {
    if (ref) {
      endorsementEl.hidden = false;
      endorsementEl.replaceChildren(
        createIcon('icon-shield'),
        document.createTextNode('Endorsed by ' + (ref.via || 'a Covenda partner') + ' — a partner referral head-start.'),
      );
    } else {
      endorsementEl.hidden = true;
    }
  }
  if (ladder) {
    const rungs = ['Endorsed / Building proof', 'Role-Qualified', 'Employer-Verified', 'Proven'];
    ladder.replaceChildren();
    rungs.forEach((label, index) => {
      const reached = standing.index >= 0 && standing.index >= index;
      const current = standing.index === index;
      const cell = document.createElement('div');
      cell.className = 'proof-rung' + (reached ? ' is-reached' : '') + (current ? ' is-current' : '');
      const dot = document.createElement('span');
      dot.className = 'proof-rung-dot';
      dot.append(reached ? createIcon('icon-check') : document.createTextNode(String(index + 1)));
      const text = document.createElement('span');
      text.className = 'proof-rung-label';
      text.textContent = label;
      cell.append(dot, text);
      ladder.append(cell);
    });
  }
  if (shareBtn) shareBtn.hidden = !standing.receipt;
}

// ============================================================================
// F6 — Feeder cohort dashboard (educators workspace), driven by the live roster
// ============================================================================
function renderCohortDashboard() {
  const body = $('#cohortBody');
  const ladder = $('#cohortLadder');
  const bars = $('#cohortBars');
  if (!body || !ladder || !bars) return;
  const total = $('#cohortTotal');
  const empty = $('#cohortEmpty');
  const roster = universityRoster;
  const count = roster.length;
  if (total) total.textContent = count + (count === 1 ? ' student' : ' students');
  if (count === 0) {
    if (empty) empty.hidden = false;
    body.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  body.hidden = false;

  // Entry rung: an attached vouch note enters the cohort as "Endorsed"; otherwise the
  // open path, "Building proof". Verified rungs stay at zero — earned, never assigned.
  const endorsed = ($('#endorsementNote')?.value || '').trim().length > 0;
  const rungs = [
    { label: endorsed ? 'Endorsed' : 'Building proof', value: count, active: true },
    { label: 'Role-Qualified', value: 0, active: false },
    { label: 'Employer-Verified', value: 0, active: false },
    { label: 'Proven', value: 0, active: false },
  ];
  ladder.replaceChildren();
  rungs.forEach(rung => {
    const cell = document.createElement('div');
    cell.className = 'cohort-rung' + (rung.active ? ' is-active' : '');
    const value = document.createElement('span');
    value.className = 'cohort-rung-count';
    value.textContent = String(rung.value);
    const label = document.createElement('span');
    label.className = 'cohort-rung-label';
    label.textContent = rung.label;
    cell.append(value, label);
    ladder.append(cell);
  });

  const byInterest = {};
  roster.forEach(entry => { byInterest[entry.interest] = (byInterest[entry.interest] || 0) + 1; });
  bars.replaceChildren();
  universityInterests.filter(interest => byInterest[interest]).forEach(interest => {
    const value = byInterest[interest];
    const pct = Math.round((value / count) * 100);
    const row = document.createElement('li');
    row.className = 'cohort-bar';
    const head = document.createElement('div');
    head.className = 'cohort-bar-head';
    const name = document.createElement('span');
    name.textContent = interest;
    const num = document.createElement('span');
    num.className = 'cohort-bar-value';
    num.textContent = value + ' · ' + pct + '%';
    head.append(name, num);
    const track = document.createElement('div');
    track.className = 'cohort-bar-track';
    const fill = document.createElement('i');
    fill.style.width = Math.max(pct, 5) + '%';
    track.append(fill);
    row.append(head, track);
    bars.append(row);
  });
}

// F3: a partner referral link (?ref=) lands the visitor as a prospective student.
const incomingReferral = readReferralFromUrl();
if (incomingReferral) {
  writeStorage(referralStorageKey, incomingReferral);
  state.audience = 'student';
}

// QR / shareable deep-link: covenda.app/?join=student lands on the student surface and pops
// the 30-second quick join immediately — the frictionless path for handing out a QR code.
// setTimeout lets the rest of boot (audience + dialog wiring) finish before we open it.
let joinIntent = null;
try { joinIntent = new URLSearchParams(location.search).get('join'); } catch { joinIntent = null; }
if (joinIntent === 'student') {
  state.audience = 'student';
  setTimeout(() => { try { openQuickJoin(); } catch (_) { /* dialog not ready — ignore */ } }, 150);
}

// ---- Vertical-first narrowing -----------------------------------------------
// Industry → focus area → the specific work. Each round is derived from the previous
// pick, so a student lands on "Month-end close · reconciliation cleanup" instead of
// declaring "I can do research". Every leaf maps to one of the five work types, which
// is what the rest of the app already understands, so nothing downstream changes.
// §8/§12-B: industry → real SUB-INDUSTRY (a student's domain expertise) → a concrete work
// item. Level 2 is genuine specialization (Asset management, Equity research, Neuroscience…),
// not a project chore; the leaf still carries a work_type so matching data stays derivable.
const NARROW_TREE = {
  'Accounting & finance': {
    'Investment banking': [['M&A analysis', 'Research'], ['Comps & valuation', 'Data & spreadsheets'], ['Pitch materials', 'Writing & documentation']],
    'Asset management': [['Portfolio analysis', 'Data & spreadsheets'], ['Fund & manager research', 'Research'], ['Performance reporting', 'Data & spreadsheets']],
    'Equity research': [['Company deep-dives', 'Research'], ['Financial modeling', 'Data & spreadsheets'], ['Research notes', 'Writing & documentation']],
    'Private equity / VC': [['Market mapping', 'Research'], ['Diligence support', 'Research'], ['Portfolio operations', 'Operations']],
    'Corporate finance / FP&A': [['Budget modeling', 'Data & spreadsheets'], ['Variance analysis', 'Data & spreadsheets'], ['Month-end close support', 'Operations']],
    'Accounting & audit': [['Reconciliation', 'Data & spreadsheets'], ['AP/AR cleanup', 'Operations'], ['Audit prep', 'Writing & documentation']],
  },
  'Software & AI': {
    'Machine learning / LLMs': [['Data labeling & eval', 'QA & testing'], ['Eval / prompt sets', 'Research'], ['Model & API docs', 'Writing & documentation']],
    'Physical AI / robotics': [['Sensor data review', 'Data & spreadsheets'], ['Test-case authoring', 'QA & testing'], ['Field research', 'Research']],
    'Autonomy / self-driving': [['Scenario labeling', 'QA & testing'], ['Edge-case research', 'Research'], ['Data QA', 'QA & testing']],
    'Web & full-stack': [['Manual QA passes', 'QA & testing'], ['Bug reproduction', 'QA & testing'], ['Docs & guides', 'Writing & documentation']],
    'Data & analytics': [['Data cleanup', 'Data & spreadsheets'], ['Dashboards & reporting', 'Data & spreadsheets'], ['Analysis memos', 'Research']],
    'Security': [['Test-case authoring', 'QA & testing'], ['Threat / policy research', 'Research'], ['Runbook docs', 'Writing & documentation']],
  },
  'Healthcare operations': {
    'Neuroscience / biotech': [['Literature synthesis', 'Research'], ['Data cleanup', 'Data & spreadsheets'], ['Findings memo', 'Writing & documentation']],
    'Clinical operations': [['Workflow mapping', 'Operations'], ['Scheduling analysis', 'Data & spreadsheets'], ['SOP authoring', 'Writing & documentation']],
    'Digital health': [['Product research', 'Research'], ['QA passes', 'QA & testing'], ['Onboarding docs', 'Writing & documentation']],
    'Medical devices': [['Test documentation', 'QA & testing'], ['Vendor comparison', 'Research'], ['Process mapping', 'Operations']],
    'Pharma / life sciences': [['Public-source research', 'Research'], ['Data extraction', 'Data & spreadsheets'], ['Briefing memo', 'Writing & documentation']],
  },
  'Consumer & retail': {
    'E-commerce': [['Catalog cleanup', 'Data & spreadsheets'], ['Conversion research', 'Research'], ['Ops process map', 'Operations']],
    'Brand & marketing': [['Competitor teardown', 'Research'], ['Content QA', 'QA & testing'], ['Campaign briefs', 'Writing & documentation']],
    'Consumer packaged goods': [['Category research', 'Research'], ['Sales data cleanup', 'Data & spreadsheets'], ['Retail process map', 'Operations']],
    'Supply chain & ops': [['Inventory analysis', 'Data & spreadsheets'], ['Returns analysis', 'Data & spreadsheets'], ['Workflow map', 'Operations']],
  },
  'Professional services': {
    'Management consulting': [['Market research', 'Research'], ['Model / slide build', 'Data & spreadsheets'], ['Findings deck', 'Writing & documentation']],
    'Legal': [['Legal research', 'Research'], ['Document review', 'QA & testing'], ['Summaries & memos', 'Writing & documentation']],
    'Marketing & advertising': [['Audience research', 'Research'], ['Creative QA', 'QA & testing'], ['Brief writing', 'Writing & documentation']],
    'Real estate': [['Market comps', 'Research'], ['Financial modeling', 'Data & spreadsheets'], ['Listing documentation', 'Writing & documentation']],
  },
};
const NARROW_ANY = 'Not sure yet — show me everything';
// §8 Pinterest-style progressive narrowing: a MULTI-SELECT additive tile grid. Picking an
// industry reveals its focus tiles inline (flex-wrap → same row until full, then wrap);
// picking a focus reveals its specific tiles. Selections persist and pre-fill the account.
const narrowStorageKey = 'covendaNarrowPicks';
const narrowSel = new Set((readStorage(narrowStorageKey, []) || []).filter(k => typeof k === 'string'));
function persistNarrow() { writeStorage(narrowStorageKey, [...narrowSel]); }
function toggleNarrow(key) {
  if (narrowSel.has(key)) {
    narrowSel.delete(key);
    for (const k of [...narrowSel]) if (k.startsWith(key + '>')) narrowSel.delete(k); // drop hidden descendants
  } else {
    narrowSel.add(key);
  }
}
// Map the selection back to the taxonomy for the account payload. Keys are '>'-joined paths
// (industry / industry>focus / industry>focus>specific); no label contains '>'.
function narrowPicks() {
  const industries = []; const subIndustries = []; const workTypes = new Set();
  for (const key of narrowSel) {
    const parts = key.split('>');
    // Any pick — top-level chip OR a deeper focus/specific — counts its parent industry, so
    // the account form mirrors every button the student tapped in the hero.
    if (!industries.includes(parts[0])) industries.push(parts[0]);
    if (parts.length === 1) continue;
    const label = parts[parts.length - 1];
    if (!subIndustries.includes(label)) subIndustries.push(label);
    if (parts.length === 3) {
      const leaf = (NARROW_TREE[parts[0]]?.[parts[1]] || []).find(l => l[0] === parts[2]);
      if (leaf) workTypes.add(leaf[1]);
    }
  }
  return { industries, subIndustries, workTypes: [...workTypes] };
}
function narrowTile(label, key, level) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'narrow-tile narrow-l' + level + (narrowSel.has(key) ? ' is-selected' : '');
  button.setAttribute('aria-pressed', narrowSel.has(key) ? 'true' : 'false');
  button.textContent = label;
  button.addEventListener('click', () => { toggleNarrow(key); persistNarrow(); renderNarrowFlow(); });
  return button;
}
function renderNarrowFlow() {
  const root = document.querySelector('[data-narrow-flow]');
  if (!root) return;
  root.textContent = '';
  const grid = document.createElement('div');
  grid.className = 'narrow-grid';
  for (const industry of Object.keys(NARROW_TREE)) {
    grid.append(narrowTile(industry, industry, 1));
    if (!narrowSel.has(industry)) continue;
    for (const focus of Object.keys(NARROW_TREE[industry])) {
      const fKey = industry + '>' + focus;
      grid.append(narrowTile(focus, fKey, 2));
      if (!narrowSel.has(fKey)) continue;
      for (const [leaf] of NARROW_TREE[industry][focus]) grid.append(narrowTile(leaf, fKey + '>' + leaf, 3));
    }
  }
  root.append(grid);
  const picks = narrowPicks();
  if (picks.industries.length || picks.subIndustries.length) {
    const note = document.createElement('p');
    note.className = 'narrow-note';
    note.textContent = 'Covenda will show you paid projects that look like this. Make a student account to save it.';
    root.append(note);
  }
}

restoreRosterDraft();
renderLocalSubmissionState();
renderNarrowFlow();
selectWorkType(state.workType);
setAudience(state.audience);
renderReferralBanner();
renderReferralLink();
// Steps 5/6/3 + gold-tile motif — run here (not at definition time) so the referral
// storage key and other late consts are initialized before activeReferral() is read.
renderGoldTiles();
buildCandidateFilters();
renderCandidates();
renderReferrerDashboard();
selectorFxController = initSelectorFx();
selectorFxController?.pulse($('.work-option.is-selected'));
initButtonFeedback();
// ---- Interactive gold icosahedron (decorative accent; drag to spin) ----
function initIcosahedron() {
  const canvas = document.getElementById('icoCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const panel = canvas.closest('.feature-panel') || canvas;
  const hint = document.getElementById('icoHint');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Icosahedron: 12 golden-ratio vertices, 30 minimum-distance edges.
  const t = (1 + Math.sqrt(5)) / 2;
  const norm = Math.hypot(1, t);
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => ({ x: x / norm, y: y / norm, z: z / norm }));
  const edges = [];
  let minD2 = Infinity;
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const dx = verts[i].x - verts[j].x, dy = verts[i].y - verts[j].y, dz = verts[i].z - verts[j].z;
    minD2 = Math.min(minD2, dx * dx + dy * dy + dz * dz);
  }
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const dx = verts[i].x - verts[j].x, dy = verts[i].y - verts[j].y, dz = verts[i].z - verts[j].z;
    if (dx * dx + dy * dy + dz * dz < minD2 * 1.05) edges.push([i, j]);
  }

  // Adjacency for path-following light "signals" that travel student -> student.
  const adj = verts.map(() => []);
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  function newTraveler(from) {
    const f = from ?? Math.floor(Math.random() * verts.length);
    const to = adj[f][Math.floor(Math.random() * adj[f].length)];
    return { from: f, to, t: Math.random(), speed: 0.005 + Math.random() * 0.004 };
  }
  const travelers = [newTraveler(), newTraveler(), newTraveler(), newTraveler()];
  function updateTravelers() {
    travelers.forEach(tr => {
      tr.t += tr.speed;
      if (tr.t >= 1) {
        const prev = tr.from;
        tr.from = tr.to;
        let choices = adj[tr.from].filter(n => n !== prev);
        if (!choices.length) choices = adj[tr.from];
        tr.to = choices[Math.floor(Math.random() * choices.length)];
        tr.t = 0;
        tr.speed = 0.005 + Math.random() * 0.004;
      }
    });
  }

  let w = 0, h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let rotX = 0.5, rotY = 0.4, velX = 0.0012, velY = 0.004;
  const autoX = 0.0012, autoY = 0.004;
  let dragging = false, lastX = 0, lastY = 0, running = false, raf = 0, hinted = false;

  function rotate(p) {
    const cxr = Math.cos(rotX), sxr = Math.sin(rotX);
    const y1 = p.y * cxr - p.z * sxr, z1 = p.y * sxr + p.z * cxr;
    const cyr = Math.cos(rotY), syr = Math.sin(rotY);
    return { x: p.x * cyr + z1 * syr, y: y1, z: -p.x * syr + z1 * cyr };
  }
  const activeNodes = new Set([0, 4, 8]); // a few "active" students that gently pulse
  function draw(time = 0) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.32, persp = 2.8;
    const pts = verts.map(v => {
      const r = rotate(v), f = persp / (persp - r.z);
      return { sx: cx + r.x * scale * f, sy: cy - r.y * scale * f, z: r.z };
    });
    // edges = connections between students (thinner so the student nodes stand out)
    edges.map(([a, b]) => ({ a, b, z: (pts[a].z + pts[b].z) / 2 }))
      .sort((m, n) => m.z - n.z)
      .forEach(e => {
        const depth = (e.z + 1) / 2;
        ctx.beginPath();
        ctx.moveTo(pts[e.a].sx, pts[e.a].sy);
        ctx.lineTo(pts[e.b].sx, pts[e.b].sy);
        ctx.strokeStyle = `rgba(169,130,47,${(0.20 + depth * 0.46).toFixed(3)})`;
        ctx.lineWidth = 0.7 + depth * 0.7;
        ctx.stroke();
      });
    // vertices = students: all 12 as gold nodes (depth-scaled), a few gently pulsing
    pts.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z).forEach(({ p, i }) => {
      const depth = (p.z + 1) / 2;
      const pulse = activeNodes.has(i) ? 0.5 + 0.5 * Math.sin(time * 0.0022 + i) : 0;
      const nodeR = 1.7 + depth * 2.5;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, nodeR + 2.6 + pulse * 3.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,162,75,${(0.05 + depth * 0.09 + pulse * 0.11).toFixed(3)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(169,130,47,${(0.5 + depth * 0.45).toFixed(3)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.sx - nodeR * 0.28, p.sy - nodeR * 0.28, nodeR * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,250,238,${(0.45 * depth).toFixed(3)})`;
      ctx.fill();
    });
    // traveling "signal" lights routing student -> student (globe-flight feel)
    ctx.lineCap = 'round';
    travelers.forEach(tr => {
      const a = pts[tr.from], b = pts[tr.to];
      const dim = 0.3 + (((a.z + b.z) / 2 + 1) / 2) * 0.7;
      const hx = a.sx + (b.sx - a.sx) * tr.t, hy = a.sy + (b.sy - a.sy) * tr.t;
      const tailT = Math.max(0, tr.t - 0.32);
      const tx = a.sx + (b.sx - a.sx) * tailT, ty = a.sy + (b.sy - a.sy) * tailT;
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, 'rgba(233,198,121,0)');
      grad.addColorStop(1, `rgba(255,241,205,${(0.9 * dim).toFixed(3)})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(231,198,121,${(0.22 * dim).toFixed(3)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,248,230,${(0.95 * dim).toFixed(3)})`; ctx.fill();
    });
    ctx.lineCap = 'butt';
  }
  function frame() {
    if (!dragging) {
      rotX += velX; rotY += velY;
      velX += (autoX - velX) * 0.03;
      velY += (autoY - velY) * 0.03;
    }
    updateTravelers();
    draw(performance.now());
    raf = requestAnimationFrame(frame);
  }
  // Re-measure on start: the panel may have been hidden / not laid out at init (0×0), so the
  // first correct size is only known once it scrolls into view. Without this the shape stays
  // blank until a window resize — which is why it "only appeared after reload" before.
  function start() { if (running) return; resize(); draw(); running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function panelVisible() {
    const r = panel.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  resize();
  draw(); // render one static frame immediately so the shape is never blank
  window.addEventListener('resize', () => { resize(); if (!running) draw(); });

  // The canvas lives in an audience-gated section that is display:none until the
  // "home" surface is shown, so its first real size only exists once it's revealed.
  // Expose a re-measure hook (called by setAudience on the switch to "home") and add a
  // ResizeObserver backstop — together they make the shape appear (even the static
  // reduced-motion frame) on first view instead of only after a reload/window-resize.
  // These are set BEFORE the reduced-motion early return on purpose.
  icoRemeasure = () => { resize(); if (!running) draw(); };
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(canvas);
  }

  if (reduceMotion) {
    hint?.classList.add('is-hidden');
    return;
  }

  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    if (!hinted && hint) { hint.classList.add('is-hidden'); hinted = true; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    rotY += dx * 0.008; rotX += dy * 0.008;
    velY = dx * 0.008; velX = dy * 0.008;
  });
  const release = e => { dragging = false; canvas.releasePointerCapture?.(e.pointerId); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      entries.forEach(en => (en.isIntersecting ? start() : stop()));
    }, { threshold: 0.05 }).observe(panel);
  } else {
    start();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (panelVisible()) start();
  });
}

// ---- Site-wide scroll reveal: sections/cards animate in as you scroll down ----
function initScrollReveal() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Bail (leave everything visible) for reduced-motion, no-IO, or a glitched/tiny
  // viewport — never risk hiding content when we can't reliably reveal it.
  if (reduce || !('IntersectionObserver' in window) || window.innerHeight < 300) return;
  const selector = [
    '.how-section .section-heading',
    '.proof-rail > li', '.company-rail > li',
    '.work-record', '.packet', '.risk-note',
    '.feature-copy', '.feature-panel',
    '.value-col',
    '.why-section .why-copy', '.why-section .fit-table',
    '.batches-section .section-heading', '.batch-card',
    '.final-cta .audience-content',
  ].join(',');
  document.documentElement.classList.add('js-reveal');
  const revealed = new WeakSet();
  const reveal = el => { el.classList.add('is-revealed'); revealed.add(el); };
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
  const vh = window.innerHeight;
  const targets = [];
  [...document.querySelectorAll(selector)].forEach(el => {
    const r = el.getBoundingClientRect();
    // leave anything already in view visible (no flash); only reveal what's below.
    if (r.bottom > 0 && r.top < vh * 0.85) return;
    el.classList.add('reveal');
    const sibs = [...el.parentElement.children].filter(c => c.matches(selector));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--reveal-i', String(Math.min(i, 6)));
    io.observe(el);
    targets.push(el);
  });
  // Safety net: if the observer never fires for something, reveal it anyway so
  // content can never stay permanently hidden.
  window.setTimeout(() => targets.forEach(el => { if (!revealed.has(el)) reveal(el); }), 4000);
}

// ---- Home-hero background: a subtle gold "signal from noise" field. -----------------------
// Many faint gold motes drift in from the left (the mass, the noise). At a soft filter line
// most dim and fade out; a few brighten to solid gold and converge toward a focal cluster on
// the right (the curated few), lightly linked like a bench. Deliberately low-contrast and
// non-intrusive — it lives BEHIND the hero copy and never competes with it. It quietly
// dramatizes Covenda's whole thesis: curation pulls signal out of the pile.
function initHeroField() {
  const canvas = document.getElementById('heroFieldCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GOLD = '180,123,32';
  let W = 0, H = 0, motes = [], running = false, raf = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }
  const focal = () => ({ x: W * 0.76, y: H * 0.46 });
  // Pointer in canvas space; null when the cursor is elsewhere so the field relaxes back.
  let pointer = null;
  function spawn(seed = false) {
    return {
      x: seed ? Math.random() * W : -12 - Math.random() * 40,
      y: Math.random() * H,
      vx: 0.18 + Math.random() * 0.34,
      r: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      state: 'drift', alpha: 0.05 + Math.random() * 0.06, judged: false,
      // each selected mote settles near, but not exactly on, the focal point
      tx: 0, ty: 0,
    };
  }
  function build() {
    const count = Math.round(Math.min(90, Math.max(26, W / 20)));
    motes = Array.from({ length: count }, () => spawn(true));
  }
  function step(mote) {
    const gate = W * 0.44;
    if (mote.state === 'drift') {
      mote.x += mote.vx;
      mote.y += Math.sin(mote.phase + mote.x * 0.01) * 0.15;
      mote.alpha = Math.min(0.14, mote.alpha + 0.002);
      if (!mote.judged && mote.x > gate) {
        mote.judged = true;
        if (Math.random() < 0.16) {
          const f = focal();
          mote.state = 'selected';
          mote.tx = f.x + (Math.random() - 0.5) * W * 0.16;
          mote.ty = f.y + (Math.random() - 0.5) * H * 0.42;
        } else { mote.state = 'fade'; }
      }
    } else if (mote.state === 'fade') {
      mote.x += mote.vx * 0.6;
      mote.alpha -= 0.004;
      if (mote.alpha <= 0 || mote.x > W + 10) Object.assign(mote, spawn(false));
    } else if (mote.state === 'selected') {
      mote.x += (mote.tx - mote.x) * 0.03;
      mote.y += (mote.ty - mote.y) * 0.03;
      mote.phase += 0.01;
      mote.tx += Math.cos(mote.phase) * 0.15; // gentle drift so the cluster breathes
      mote.ty += Math.sin(mote.phase * 0.8) * 0.15;
      mote.alpha = Math.min(0.42, mote.alpha + 0.006);
      mote.r = Math.min(2.9, mote.r + 0.012);
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const selected = [];
    for (const m of motes) {
      if (m.state === 'selected') selected.push(m);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GOLD},${m.alpha})`;
      ctx.fill();
    }
    // faint links between the curated few — a light "bench" constellation
    ctx.lineWidth = 1;
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i], b = selected[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 118) {
          ctx.strokeStyle = `rgba(${GOLD},${0.07 * (1 - d / 118)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
  }
  // The reader's cursor becomes another node: nearby motes link to it and lift, so the
  // "vouched, connected" motif responds to the person reading it. Purely additive — the
  // ambient field is unchanged when the pointer is away.
  function drawPointerLinks() {
    if (!pointer) return;
    const REACH = 132;
    ctx.lineWidth = 1;
    for (const m of motes) {
      const dx = m.x - pointer.x, dy = m.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d > REACH) continue;
      const t = 1 - d / REACH;
      ctx.strokeStyle = `rgba(${GOLD},${0.20 * t})`;
      ctx.beginPath(); ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.fillStyle = `rgba(${GOLD},${0.28 * t})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 1.1 * t, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = `rgba(${GOLD},.20)`;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  function frame() { for (const m of motes) step(m); draw(); drawPointerLinks(); raf = requestAnimationFrame(frame); }
  function start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  draw(); // one static frame immediately (and the only frame under reduced-motion)
  window.addEventListener('resize', () => { resize(); if (!running) draw(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(canvas);
  if (reduce) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { threshold: 0.02 }).observe(canvas);
  } else { start(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const hero = canvas.closest('.hero') || canvas.parentElement;
  if (hero && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', event => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - r.left, y: event.clientY - r.top };
    });
    hero.addEventListener('pointerleave', () => { pointer = null; });
  }
}

// Covenda tree: arm the grow-from-the-roots animation, fired when the tree enters view.
// No-JS / no-IO / reduced-motion paths never hide the tree (classes are simply not added).
(function initTreeGrow() {
  const tree = document.getElementById('covendaModel');
  if (!tree) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  tree.classList.add('ct-pre');
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      tree.classList.add('ct-grow');
      io.disconnect();
    });
  }, { threshold: 0.3 });
  io.observe(tree);
})();

// How proof is verified per vertical, straight from the connector registry. Deliberately shows
// ONLY mechanisms that are actually built (status 'live') plus the honest-limits verticals —
// a planned-but-gated connector (e.g. Alpaca, pending terms) is never advertised as available.
(function initVerifyMethods() {
  var section = document.getElementById('verifyMethods');
  var machineList = document.getElementById('verifyMachineList');
  var humanList = document.getElementById('verifyHumanList');
  if (!section || !machineList || !humanList || typeof fetch !== 'function') return;

  function row(label, note) {
    var li = document.createElement('li');
    var strong = document.createElement('strong');
    strong.textContent = label;
    var span = document.createElement('span');
    span.textContent = note;
    li.append(strong, span);
    return li;
  }

  fetch('/api/proof-methods').then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
    var methods = (data && data.methods) || [];
    var live = methods.filter(function (m) { return m.status === 'live'; });
    var rails = methods.filter(function (m) { return m.status === 'human_rail'; });
    if (!live.length && !rails.length) return; // nothing real to show — stay hidden

    live.forEach(function (m) {
      // Say what the mechanism actually proves, in plain terms.
      var note = m.ownership === 'oauth'
        ? 'You connect the account, so the work is provably yours — and the timeline shows how it accumulated.'
        : m.ownership === 'artifact'
          ? 'The file itself is parsed, not eyeballed — structure and formulas, not a screenshot.'
          : 'Scored on the record by two independent raters against published anchors.';
      // Verification differs per vertical, so show a concrete company + what they see
      // rather than one generic sentence that flatters the weak rails and undersells the
      // strong ones. Falls back to the plain note when a connector has no example.
      machineList.append(row(m.label, m.example ? m.example.company + ' sees ' + m.example.sees : note));
    });

    rails.forEach(function (m) {
      var note = m.rail === 'instrumented_trial'
        ? 'No API can confirm outreach really landed, so proof comes from an instrumented trial run through Covenda.'
        : 'Bench skills cannot be checked remotely, so a supervisor’s structured referral is the primary mechanism — by design.';
      humanList.append(row(m.label, m.example ? m.example.company + ' sees ' + m.example.sees : note));
    });

    section.hidden = false;
  }).catch(function () { /* endpoint unavailable — section stays hidden */ });
})();

// Student of the Week — real, consented data only. Empty response hides the section.
(function initSpotlight() {
  var section = document.getElementById('studentOfWeek');
  var body = document.getElementById('spotlightBody');
  if (!section || !body || typeof fetch !== 'function') return;
  fetch('/api/featured-student').then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
    var s = data && data.featured;
    if (!s || !s.name) return; // stays hidden — never a placeholder person
    var card = document.createElement('article'); card.className = 'spotlight-card';
    var head = document.createElement('div'); head.className = 'spotlight-head';
    var avatar = document.createElement('div'); avatar.className = 'spotlight-avatar';
    if (s.avatarUrl && /^https:\/\//.test(s.avatarUrl)) { var img = document.createElement('img'); img.src = s.avatarUrl; img.alt = s.name; avatar.append(img); }
    else avatar.textContent = (s.name || 'C').slice(0, 1);
    var id = document.createElement('div'); id.className = 'spotlight-id';
    var h3 = document.createElement('h3'); h3.textContent = s.name;
    if (s.identityVerified) { var v = document.createElement('span'); v.className = 'spotlight-verified'; v.textContent = 'Identity verified'; h3.append(v); }
    var sub = document.createElement('p'); sub.textContent = [s.headline, s.school, s.graduationYear ? 'Class of ' + s.graduationYear : ''].filter(Boolean).join(' · ');
    id.append(h3, sub);
    if (s.evidenceTier) { var tier = document.createElement('span'); tier.className = 'spotlight-tier is-' + s.evidenceTier; tier.textContent = s.evidenceTier + ' evidence'; id.append(tier); }
    head.append(avatar, id); card.append(head);
    if (s.skills && s.skills.length) { var sk = document.createElement('div'); sk.className = 'spotlight-skills'; s.skills.forEach(function (x) { var c = document.createElement('span'); c.textContent = x; sk.append(c); }); card.append(sk); }
    var stats = document.createElement('p'); stats.className = 'spotlight-stats';
    stats.textContent = (s.verifiedRecords || 0) + ' verified work record' + (s.verifiedRecords === 1 ? '' : 's') + ' on Covenda';
    card.append(stats);
    (s.projects || []).forEach(function (p) {
      var pr = document.createElement('div'); pr.className = 'spotlight-project';
      var t = document.createElement('strong'); t.textContent = p.title; pr.append(t);
      var m = document.createElement('span'); m.textContent = [p.vertical, p.shipped ? 'shipped ✓' : '', p.outcome ? 'led to: ' + p.outcome.replace(/_/g, ' ') : ''].filter(Boolean).join(' · '); pr.append(m);
      card.append(pr);
    });
    var cta = document.createElement('a'); cta.className = 'gold-button compact'; cta.href = 'portal.html?intent=request-intro';
    cta.textContent = 'Request an intro through Covenda';
    card.append(cta);
    body.replaceChildren(card);
    section.hidden = false;
  }).catch(function () { /* stays hidden */ });
})();

initCovendaMotion();
initFlowDemo();
initIcosahedron();
initHeroField();
initScrollReveal();

// ---- Stat count-up: "Why now" band numbers rise 0 -> value when they scroll into view. ----
// Parses the existing text (e.g. "52%") so the markup stays the single source of truth.
// Reduced-motion or no IntersectionObserver: numbers just stay as authored.
(function initStatCountUp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  const stats = $$('.stat-list b');
  if (!stats.length) return;
  const animate = el => {
    const raw = el.textContent.trim();
    const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const target = parseFloat(match[1]);
    const suffix = match[2] || '';
    const decimals = (match[1].split('.')[1] || '').length;
    const t0 = performance.now();
    const dur = 1200;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic — fast rise, gentle landing
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = raw; // land exactly on the authored value
    };
    el.textContent = (0).toFixed(decimals) + suffix;
    requestAnimationFrame(tick);
  };
  const seen = new WeakSet();
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting || seen.has(en.target)) return;
      seen.add(en.target);
      animate(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.6 });
  stats.forEach(el => io.observe(el));
})();
// ---------------------------------------------------------------------------
// A4 — Talent Readiness Assessment (free, pre-auth company diagnostic).
// Posts the visitor's own answers to readiness-1.0.0 and renders the three axes
// with their reasons, concerns, and uncertainty bands. Nothing is stored: the
// endpoint is a pure function with no DB write, so there is no receipt to keep.
// ---------------------------------------------------------------------------
function readinessPayload(form) {
  const data = new FormData(form);
  const num = name => {
    const raw = String(data.get(name) || '').trim();
    return raw === '' ? null : Number(raw);
  };
  return {
    action: 'readiness-check',
    goal: String(data.get('goal') || '').trim(),
    blocked: String(data.get('blocked') || '').trim(),
    skills: String(data.get('skills') || '').trim(),
    supervisionHoursWeekly: num('supervisionHoursWeekly'),
    projectWeeks: num('projectWeeks'),
    budget: num('budget'),
    systemsAccess: data.get('systemsAccess') === 'on',
    hireIntent: data.get('hireIntent') === 'on',
  };
}

// Each axis renders as: score + band, what is working, what to tighten. The band
// is always shown — a bare number would overstate what self-reported answers know.
function renderReadinessAxis(title, axis) {
  const card = document.createElement('article');
  card.className = 'readiness-axis';
  const band = axis.presentation?.band;
  const head = document.createElement('header');
  const name = document.createElement('h3');
  name.textContent = title;
  const score = document.createElement('strong');
  score.textContent = String(axis.presentation?.value ?? axis.score);
  head.append(name, score);
  card.append(head);
  if (band) {
    const bandLine = document.createElement('p');
    bandLine.className = 'readiness-band';
    bandLine.textContent = band.label + ' · likely ' + band.low + '–' + band.high;
    card.append(bandLine);
  }
  const list = document.createElement('ul');
  (axis.reasons || []).forEach(reason => {
    const li = document.createElement('li');
    li.className = 'is-reason';
    li.append(createIcon('icon-check'), Object.assign(document.createElement('span'), { textContent: reason }));
    list.append(li);
  });
  (axis.concerns || []).forEach(concern => {
    const li = document.createElement('li');
    li.className = 'is-concern';
    li.append(createIcon('icon-chevron'), Object.assign(document.createElement('span'), { textContent: concern }));
    list.append(li);
  });
  card.append(list);
  return card;
}

function renderReadiness(readiness) {
  const axes = $('#readinessAxes');
  axes.replaceChildren(
    renderReadinessAxis('Project clarity', readiness.projectClarity),
    renderReadinessAxis('Talent accessibility', readiness.talentAccessibility),
    renderReadinessAxis('Fit for emerging talent', readiness.suitabilityForEmergingTalent),
  );
  const profile = $('#readinessProfile');
  profile.replaceChildren();
  profile.append(
    Object.assign(document.createElement('small'), { textContent: 'Recommended shape' }),
    Object.assign(document.createElement('strong'), { textContent: readiness.recommendedTalentProfile }),
  );
  $('#readinessVersion').textContent = 'Scored by ' + readiness.readinessVersion + ' · your answers were not stored.';
  $('#readinessForm').hidden = true;
  $('#readinessResult').hidden = false;
}

(function initReadinessCheck() {
  const dialog = $('#readinessDialog');
  const form = $('#readinessForm');
  if (!dialog || !form) return;
  const message = $('#readinessMessage');

  function reset() {
    form.hidden = false;
    $('#readinessResult').hidden = true;
    message.textContent = '';
    message.classList.remove('is-success');
  }

  window.openReadinessCheck = function openReadinessCheck() {
    reset();
    // Carry over whatever the visitor already typed into the company composer so
    // the diagnostic never asks twice for the same sentence.
    const seed = $('#companyProblemSeed')?.value.trim();
    if (seed && !form.elements.goal.value.trim()) form.elements.goal.value = seed;
    dialog.showModal();
    window.setTimeout(() => form.elements.goal?.focus(), 60);
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = readinessPayload(form);
    if (!payload.goal && !payload.blocked) {
      message.textContent = 'Describe the goal or what is blocked — the score needs at least one of them.';
      message.classList.remove('is-success');
      return;
    }
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    message.classList.remove('is-success');
    message.textContent = 'Scoring…';
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'The readiness check is unavailable right now.');
      renderReadiness(body.readiness);
    } catch (error) {
      message.textContent = error.message || 'The readiness check is unavailable right now.';
    } finally {
      submit.disabled = false;
    }
  });

  $('[data-action="readiness-restart"]')?.addEventListener('click', () => {
    reset();
    window.setTimeout(() => form.elements.goal?.focus(), 60);
  });

  // The next step is always an invitation: hand the answers to the real intake.
  $('[data-action="readiness-submit-project"]')?.addEventListener('click', () => {
    const goal = form.elements.goal.value.trim();
    const blocked = form.elements.blocked.value.trim();
    dialog.close();
    setAudience('company');
    const seed = $('#companyProblemSeed');
    if (seed && !seed.value.trim()) {
      seed.value = [blocked, goal].filter(Boolean).join('\n\n');
      seed.dispatchEvent(new Event('input', { bubbles: true }));
    }
    seed?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => seed?.focus(), 420);
  });
})();


// Club registration — the referral layer's new front door. The verification ladder is
// fetched rather than hardcoded so the bar a club reads here is the same one api/clubs.js
// actually enforces. Submits through the existing /api/submissions intake (type
// referrer_endorsement), so there is no new storage path and no new inbox.
(function initClubRegister() {
  var form = document.getElementById('clubRegisterForm');
  var tiersHost = document.getElementById('clubTiers');
  var select = document.getElementById('clubVerticalSelect');
  if (!form || !tiersHost || !select) return;

  fetch('/api/portal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'club-tiers' }),
  }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
    if (!data || !data.ok) return;
    (data.verticals || []).forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.slug; o.textContent = v.name; select.append(o);
    });
    (data.tiers || []).forEach(function (tier) {
      var li = document.createElement('li');
      var head = document.createElement('strong'); head.textContent = tier.label;
      var need = document.createElement('span'); need.className = 'club-tier-need';
      need.textContent = tier.minAdmitted + ' members admitted'
        + (tier.minAccepted ? ' · ' + tier.minAccepted + ' with accepted work' : '');
      var grants = document.createElement('p'); grants.textContent = tier.grants;
      li.append(head, need, grants);
      tiersHost.append(li);
    });
  }).catch(function () { /* endpoint unavailable — the form still submits */ });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var message = document.getElementById('clubFormMessage');
    var data = new FormData(form);
    var name = String(data.get('clubName') || '').trim();
    var email = String(data.get('clubEmail') || '').trim();
    if (!name || !email) {
      message.textContent = 'Club name and a contact email are needed.';
      message.classList.remove('is-success');
      return;
    }
    if (!data.get('clubConsent')) {
      message.textContent = 'Tick the consent box so we can reply.';
      message.classList.remove('is-success');
      return;
    }
    message.classList.remove('is-success');
    message.textContent = 'Sending…';
    fetch('/api/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'referrer_endorsement',
        organizationType: 'Student club',
        organization: name,
        contactName: String(data.get('clubRole') || '').trim(),
        email: email,
        consent: true,
        website: String(data.get('website') || ''),
        details: {
          club: name,
          school: String(data.get('clubSchool') || '').trim(),
          role: String(data.get('clubRole') || '').trim(),
          vertical: String(data.get('clubVertical') || ''),
          memberCount: String(data.get('clubSize') || ''),
          intent: 'club_verification',
        },
      }),
    }).then(function (res) { return res.json().catch(function () { return null; }); })
      .then(function (body) {
        if (body && body.reference) {
          message.textContent = 'Registered — reference ' + body.reference + '. We will be in touch about verifying this club.';
          message.classList.add('is-success');
          form.reset();
        } else {
          message.textContent = (body && body.error) || 'That did not go through. Try again shortly.';
        }
      }).catch(function () { message.textContent = 'That did not go through. Try again shortly.'; });
  });
})();


// "Build the intern you need" — the company-side counterpart to the student's narrowing.
// Posts to the pre-auth talent-requirement action, which runs the same buildTalentRequirement
// the matcher consumes, so what a company sees here is what the engine will actually rank on.
// Nothing is stored: the endpoint is pure and needs no account.
(function initIdealBuilder() {
  var form = document.getElementById('idealBuilder');
  var result = document.getElementById('ibResult');
  if (!form || !result) return;
  var message = document.getElementById('ibMessage');
  var picked = { verticals: new Set(), workTypes: new Set() };

  function chipInto(host, value, bucket) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ib-chip';
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = value;
    chip.addEventListener('click', function () {
      var on = !bucket.has(value);
      if (on) bucket.add(value); else bucket.delete(value);
      chip.setAttribute('aria-pressed', String(on));
    });
    host.append(chip);
  }

  // Taxonomy comes from the server so the chips can never offer a vertical the matcher
  // would silently drop.
  fetch('/api/portal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'talent-requirement' }),
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data || !data.ok) return;
    var vHost = document.getElementById('ibVerticals');
    var wHost = document.getElementById('ibWorkTypes');
    (data.taxonomy.verticals || []).forEach(function (v) { chipInto(vHost, v, picked.verticals); });
    (data.taxonomy.workTypes || []).forEach(function (w) { chipInto(wHost, w, picked.workTypes); });
  }).catch(function () { /* no serverless in static preview — the rest of the form still posts */ });

  function line(label, value) {
    var row = document.createElement('div');
    row.className = 'ib-line';
    row.append(
      Object.assign(document.createElement('span'), { textContent: label }),
      Object.assign(document.createElement('strong'), { textContent: value }),
    );
    return row;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    if (!picked.verticals.size && !String(data.get('requiredSkills') || '').trim()) {
      message.textContent = 'Pick a field or name one must-have skill — that is enough to start.';
      return;
    }
    message.textContent = 'Building…';
    fetch('/api/portal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'talent-requirement',
        verticals: [].concat(Array.from(picked.verticals)),
        workTypes: [].concat(Array.from(picked.workTypes)),
        requiredSkills: String(data.get('requiredSkills') || ''),
        hoursPerWeek: data.get('hoursPerWeek'),
        durationWeeks: data.get('durationWeeks'),
        reviewMinutesPerWeek: data.get('reviewMinutesPerWeek'),
        problem: String(data.get('problem') || ''),
      }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (body) {
      if (!body || !body.ok) { message.textContent = 'That did not go through. Try again shortly.'; return; }
      message.textContent = '';
      var req = body.requirement;
      result.replaceChildren();

      var head = document.createElement('div');
      head.className = 'ib-result-head';
      head.append(
        Object.assign(document.createElement('p'), { className: 'feature-kicker', textContent: 'Your talent requirement' }),
        Object.assign(document.createElement('h3'), { textContent: req.title }),
      );
      result.append(head);

      var facts = document.createElement('div');
      facts.className = 'ib-lines';
      if (req.verticals.length) facts.append(line('Field', req.verticals.join(', ')));
      if (req.work_types.length) facts.append(line('Work', req.work_types.join(', ')));
      if (req.required_skills.length) facts.append(line('Must-have', req.required_skills.join(', ')));
      if (req.hours_week) facts.append(line('Commitment', req.hours_week + ' hrs/week'));
      if (req.duration_weeks) facts.append(line('Length', req.duration_weeks + ' weeks'));
      if (req.founder_time_budget_min_week) facts.append(line('Your review time', req.founder_time_budget_min_week + ' min/week'));
      result.append(facts);

      // The trial IS the fit test — that is the whole reframe away from a job post.
      var next = document.createElement('div');
      next.className = 'ib-next';
      next.append(
        Object.assign(document.createElement('h4'), { textContent: 'What happens next' }),
        Object.assign(document.createElement('p'), { textContent: 'Covenda designs a paid trial from this — real work that is useful to you on its own, and that shows how this person actually operates before either side commits.' })
      );
      result.append(next);

      if (req.completeness.gaps.length) {
        var gaps = document.createElement('div');
        gaps.className = 'ib-gaps';
        gaps.append(Object.assign(document.createElement('h4'), { textContent: 'Sharpen the match' }));
        var ul = document.createElement('ul');
        req.completeness.gaps.forEach(function (g) {
          ul.append(Object.assign(document.createElement('li'), { textContent: g.gain }));
        });
        gaps.append(ul);
        result.append(gaps);
      }

      var cta = document.createElement('div');
      cta.className = 'ib-cta';
      var send = document.createElement('button');
      send.type = 'button'; send.className = 'gold-button';
      send.append(document.createTextNode('Send this to Covenda'), createIcon('icon-arrow-right'));
      send.addEventListener('click', function () {
        var seed = document.getElementById('companyProblemSeed');
        if (seed && !seed.value.trim()) {
          seed.value = 'Ideal profile: ' + [req.verticals.join(', '), req.required_skills.join(', ')].filter(Boolean).join(' · ')
            + (req.problem ? '\n\n' + req.problem : '');
          seed.dispatchEvent(new Event('input', { bubbles: true }));
        }
        openDialog(companyDialog, companyForm);
      });
      cta.append(send);
      result.append(cta);

      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch(function () { message.textContent = 'That did not go through. Try again shortly.'; });
  });
})();


// The selection web. Covenda's whole thesis is nodes and links — people vouched into a
// network — so selecting benches draws the link. Hairline gold between every selected pair,
// animated in once, redrawn on resize. Decorative and aria-hidden: the canvas says nothing a
// screen reader needs, because the cards already announce their pressed state.
function initBatchWeb() {
  const canvas = document.getElementById('batchWebCanvas');
  const host = document.getElementById('batchWeb');
  if (!canvas || !host) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress = 1, raf = 0;

  function size() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function points() {
    const origin = host.getBoundingClientRect();
    return $$('[data-batch-pick]')
      .filter(card => card.classList.contains('is-picked'))
      .map(card => {
        const r = card.getBoundingClientRect();
        return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2 };
      });
  }

  function draw() {
    const r = host.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    const nodes = points();
    if (nodes.length < 1) return;
    // Node dots first, so links appear to run underneath them.
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        ctx.strokeStyle = 'rgba(180,123,32,' + (0.34 * progress) + ')';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // Draw only `progress` of the way along, so the web knits itself together.
        ctx.lineTo(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress);
        ctx.stroke();
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = 'rgba(180,123,32,' + (0.55 * progress) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animate() {
    if (reduce) { progress = 1; draw(); return; }
    cancelAnimationFrame(raf);
    progress = 0;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / 380);
      progress = 1 - Math.pow(1 - p, 3); // ease-out cubic
      draw();
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  size();
  const refresh = () => { size(); draw(); };
  window.addEventListener('resize', refresh);
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(host);
  return { animate, redraw: refresh };
}


// The reading spine: one node per major section, filled by scroll position. Decorative —
// it duplicates no navigation, so it is aria-hidden and never focusable. Positions are
// measured from the sections themselves, so adding or removing a section needs no edit here.
(function initPageSpine() {
  const spine = document.getElementById('pageSpine');
  const fill = document.getElementById('psFill');
  if (!spine || !fill) return;
  const track = spine.querySelector('.ps-track');
  const sections = $$('main > section').filter(el => el.offsetParent !== null || el.getClientRects().length);
  if (sections.length < 3) { spine.style.display = 'none'; return; }

  const nodes = sections.map(() => {
    const dot = document.createElement('i');
    dot.className = 'ps-node';
    track.append(dot);
    return dot;
  });

  let ticking = false;
  function place() {
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight - window.innerHeight);
    sections.forEach((section, i) => {
      const top = section.offsetTop;
      nodes[i].style.top = Math.min(100, Math.max(0, (top / Math.max(1, doc.scrollHeight)) * 100)) + '%';
    });
    update(total);
  }
  function update(total) {
    const progress = Math.min(1, Math.max(0, window.scrollY / (total || (document.documentElement.scrollHeight - window.innerHeight) || 1)));
    fill.style.height = (progress * 100) + '%';
    const mark = window.scrollY + window.innerHeight * 0.5;
    sections.forEach((section, i) => nodes[i].classList.toggle('is-passed', section.offsetTop <= mark));
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', place);
  place();
})();


// The per-vertical demo. Tabs across the five benches; each one walks the same six beats so
// a company can compare shapes, while the substance stays specific to their field. Fed from
// api/batches.js, so a beat can never describe a rail the batch does not actually use.
(function initVerticalDemo() {
  var section = document.getElementById('verticalDemo');
  var tabs = document.getElementById('vdemoTabs');
  var body = document.getElementById('vdemoBody');
  if (!section || !tabs || !body || typeof fetch !== 'function') return;

  fetch('/api/portal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vertical-demo' }),
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data || !data.ok || !(data.demos || []).length) return; // nothing real to show
    var demos = data.demos;

    function show(index) {
      Array.prototype.forEach.call(tabs.children, function (t, i) {
        t.setAttribute('aria-selected', String(i === index));
        t.tabIndex = i === index ? 0 : -1;
      });
      var demo = demos[index];
      body.replaceChildren();

      var head = document.createElement('div');
      head.className = 'vdemo-head';
      head.append(
        Object.assign(document.createElement('p'), { className: 'vdemo-company', textContent: demo.company }),
        Object.assign(document.createElement('p'), { className: 'vdemo-need', textContent: demo.need }),
      );
      body.append(head);

      var ol = document.createElement('ol');
      ol.className = 'vdemo-beats';
      demo.beats.forEach(function (beat) {
        var li = document.createElement('li');
        li.append(Object.assign(document.createElement('span'), { className: 'vdemo-n', textContent: String(beat.step) }));
        var div = document.createElement('div');
        div.append(
          Object.assign(document.createElement('strong'), { textContent: beat.title }),
          Object.assign(document.createElement('p'), { textContent: beat.detail }),
        );
        li.append(div);
        ol.append(li);
      });
      body.append(ol);
    }

    demos.forEach(function (demo, i) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'vdemo-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === 0));
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.textContent = demo.name;
      tab.addEventListener('click', function () { show(i); });
      // Arrow keys move between tabs, as a tablist is expected to.
      tab.addEventListener('keydown', function (event) {
        var next = event.key === 'ArrowRight' ? i + 1 : event.key === 'ArrowLeft' ? i - 1 : null;
        if (next === null) return;
        event.preventDefault();
        var target = (next + demos.length) % demos.length;
        show(target);
        tabs.children[target].focus();
      });
      tabs.append(tab);
    });
    show(0);
    section.hidden = false;
  }).catch(function () { /* endpoint unavailable — section stays hidden */ });
})();

initMemberNav();
window.requestAnimationFrame(() => openIntro());
