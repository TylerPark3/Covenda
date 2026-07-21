const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  audience: 'student',
  surface: 'site',
  workType: 'Research',
  toastTimer: null,
};
let selectorFxController = null;
let deliveryHealthRequest = null;

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
  const status = $('[data-draft-status]', form);
  if (status) status.textContent = 'Draft restored from this device';
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
  student: 'Covenda · Real work becomes credible evidence',
  company: 'Covenda for companies · Turn delayed work into a project',
  university: 'Covenda for universities · Share your students with the pilot',
};

function setAudience(audience) {
  if (!['student', 'company', 'university'].includes(audience)) return;
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
    if (!$$('input[name="workType"]:checked', form).length) {
      message.textContent = 'Choose at least one type of work.';
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
      ['Work paths', checkedValues(form, 'workType').join(', ')],
      ['Strongest skill', [formValue(form, 'studentSkill'), formValue(form, 'studentSkillLevel')].filter(Boolean).join(' · ')],
      ['Industry interest', formValue(form, 'studentIndustry')],
      ['Availability', [formValue(form, 'studentAvailability'), formValue(form, 'studentHours'), formValue(form, 'studentDuration')].filter(Boolean).join(' · ')],
      ['Project terms', [formValue(form, 'studentCompensation'), formValue(form, 'studentPriority')].filter(Boolean).join(' · ')],
      ['Video intro', videoIntroReviewLabel(formValue(form, 'studentVideoIntro'))],
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
      ? 'Supabase inbox connected'
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
  if (item.type === 'university_partner') return 'university';
  if (item.type === 'call_request') return 'company';
  return 'student';
}

function submissionLabel(item) {
  if (item.type === 'employer_intake') return 'Company problem intake';
  if (item.type === 'university_partner') return 'Student roster';
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
}

function studentPayload(form) {
  const workTypes = checkedValues(form, 'workType');
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
    interest: workTypes.join(', '),
    interests: {
      workTypes,
      industries: [formValue(form, 'studentIndustry')],
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

for (const form of [studentForm, companyForm]) {
  restoreDraft(form);
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
  $(field)?.addEventListener('change', saveRosterDraft);
}

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
$$('[data-work-type]').forEach(button => button.addEventListener('click', () => {
  selectWorkType(button.dataset.workType);
  if (button.classList.contains('work-option')) saveDraft(studentForm);
  if (button.closest('.work-types')) openDialog(studentDialog, studentForm);
}));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('.form-dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) dialog.close();
}));

$$('[data-action]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'home' || action === 'site') setSurface('site');
  if (action === 'workspace') setSurface('workspace');
  if (action === 'workspace-submissions') {
    setAudience('student');
    setSurface('workspace');
    setWorkspaceTab('submissions');
  }
  if (action === 'refresh-delivery') {
    refreshDeliveryHealth({ force: true }).then(primary => {
      showToast(primary.status === 'ready' ? 'Primary inbox is connected.' : 'Primary inbox still needs attention.');
    });
  }
  if (action === 'student-form') {
    selectWorkType(state.workType);
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
  if (action === 'focus-pathfinder') {
    $('#studentPathfinder').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => $('.work-option.is-selected')?.focus(), 420);
  }
  if (action === 'explore-work') $('#workTypes').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (action === 'project-fit') $('#projectFit').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (action === 'replay-intro') {
    setSurface('site');
    openIntro({ force: true });
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

const restoredAudience = readStorage(audienceStorageKey, 'student');
if (['student', 'company', 'university'].includes(restoredAudience)) state.audience = restoredAudience;
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

restoreRosterDraft();
renderLocalSubmissionState();
selectWorkType(state.workType);
setAudience(state.audience);
selectorFxController = initSelectorFx();
selectorFxController?.pulse($('.work-option.is-selected'));
initButtonFeedback();
initCovendaMotion();
initFlowDemo();
window.requestAnimationFrame(() => openIntro());
