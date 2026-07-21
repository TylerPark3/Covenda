const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  audience: 'student',
  surface: 'site',
  workType: 'Research',
  toastTimer: null,
};

const storageKey = 'covendaPilotSubmissions';
const introStorageKey = 'covendaIntroSeen';
const audienceStorageKey = 'covendaAudience';
const workTypeStorageKey = 'covendaSelectedWorkType';
const draftKeys = {
  studentForm: 'covendaStudentInterestDraft',
  companyForm: 'covendaCompanyProblemDraft',
};

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

function setAudience(audience) {
  if (!['student', 'company'].includes(audience)) return;
  state.audience = audience;
  writeStorage(audienceStorageKey, audience);
  document.body.dataset.audience = audience;
  $$('[data-audience-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.audienceOption === audience));
  });
  $$('[data-student-label]').forEach(label => {
    label.textContent = audience === 'student' ? label.dataset.studentLabel : label.dataset.companyLabel;
  });
  document.title = audience === 'student'
    ? 'Covenda · Real work becomes credible evidence'
    : 'Covenda for companies · Turn delayed work into a project';
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
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function selectWorkType(workType) {
  if (!workType) return;
  state.workType = workType;
  writeStorage(workTypeStorageKey, workType);
  $$('.work-option').forEach(button => {
    const selected = button.dataset.workType === workType;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
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
  } else {
    $('#studentWorkspaceSummaryTitle').textContent = 'No draft details yet';
    renderDefinitionList($('#studentWorkspaceSummary'), [
      ['Work paths', 'Choose the work you want to prove.'],
      ['Strongest skill', 'Add an honest current level.'],
      ['Availability', 'Set your preferred timing.'],
    ]);
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
  return item.type === 'employer_intake' ? 'company' : 'student';
}

function submissionLabel(item) {
  return item.type === 'employer_intake' ? 'Company problem intake' : 'Student interest profile';
}

function submissionProgress(item) {
  return item.type === 'employer_intake'
    ? [
        ['Received', 'Your problem and company context are saved.'],
        ['Human scoping', 'Covenda checks value, boundaries, and review burden.'],
        ['Packet decision', 'You receive questions or a proposed Project Packet.'],
      ]
    : [
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
  return item.type === 'employer_intake'
    ? 'A company problem was received for human scoping.'
    : 'A student interest profile was received for pilot-fit review.';
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
  status.append(createIcon('icon-check'), document.createTextNode('Received'));
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
  appendMeta(meta, 'Current state', 'Queued for human review');

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
    : 'This receipt is not a job application, match, or work guarantee. Covenda reviews pilot fit first.';
  actions.className = 'receipt-actions';
  const receiptActions = [['copy', 'Copy reference', 'icon-copy'], ['download', 'Download receipt', 'icon-download']];
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
  heading.textContent = state.audience === 'student' ? 'No student receipt yet' : 'No company receipt yet';
  detail.textContent = state.audience === 'student'
    ? 'Complete an interest profile and its server-confirmed reference will appear here.'
    : 'Submit a bounded company problem and its server-confirmed reference will appear here.';
  action.type = 'button';
  action.className = 'outline-button compact';
  action.dataset.receiptAction = 'start';
  action.append(document.createTextNode(state.audience === 'student' ? 'Build interest profile' : 'Start company intake'), createIcon('icon-arrow-right'));
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
    },
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
    message.classList.add('is-success');
    message.textContent = 'Interest profile received. Reference ' + result.reference + '.';
    discardDraft(studentForm, { reset: false });
    saveSubmission({
      type: 'student_interest',
      reference: result.reference,
      status: result.status || 'received',
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
  const unsafe = $('[name="companyAccess"]', companyForm).value === 'production'
    || $('[name="companyClientRecords"]', companyForm).checked
    || $('[name="companyRestricted"]', companyForm).checked;
  const message = $('#companyFormMessage');
  if (unsafe) {
    message.textContent = 'Remove production access, restricted records, and regulated decisions before sending.';
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
    message.classList.add('is-success');
    message.textContent = (revisionOf ? 'Revised company problem received. Reference ' : 'Company problem received. Reference ') + result.reference + '.';
    discardDraft(companyForm, { reset: false });
    saveSubmission({
      type: 'employer_intake',
      reference: result.reference,
      status: result.status || 'received',
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

$$('[data-audience-option]').forEach(button => button.addEventListener('click', () => setAudience(button.dataset.audienceOption)));
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
  textarea.focus();
}));

$('#submissionHistory').addEventListener('click', event => {
  const button = event.target.closest('[data-receipt-action]');
  if (!button) return;
  const action = button.dataset.receiptAction;
  if (action === 'start') {
    if (state.audience === 'student') openDialog(studentDialog, studentForm);
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
  if (action === 'packet') toggleReceiptPacket(button, item);
  if (action === 'revise') startPacketRevision(item);
});

$('#introEnter').addEventListener('click', () => dismissIntro());
$('#introSkip').addEventListener('click', () => dismissIntro({ fast: true }));
$('#introScreen').addEventListener('cancel', event => {
  event.preventDefault();
  dismissIntro({ fast: true });
});

const restoredAudience = readStorage(audienceStorageKey, 'student');
if (['student', 'company'].includes(restoredAudience)) state.audience = restoredAudience;
const restoredWorkTypes = checkedValues(studentForm, 'workType');
const rememberedWorkType = readStorage(workTypeStorageKey, 'Research');
if (restoredWorkTypes.length) state.workType = restoredWorkTypes[0];
else if (rememberedWorkType) state.workType = rememberedWorkType;
renderLocalSubmissionState();
selectWorkType(state.workType);
setAudience(state.audience);
window.requestAnimationFrame(() => openIntro());
