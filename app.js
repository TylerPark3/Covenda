const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  audience: 'student',
  surface: 'site',
  workType: 'Research',
  toastTimer: null,
};

const storageKey = 'covendaPilotSubmissions';
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

function draftValue(draft, name, fallback = '') {
  const value = draft?.values?.[name];
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  return value || fallback;
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
  for (const field of $$('[name]', form)) {
    if (!(field.name in draft.values)) continue;
    const value = draft.values[field.name];
    if (field.type === 'checkbox') field.checked = Array.isArray(value) && value.includes(field.value);
    else field.value = value;
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
  if (reset) {
    form.reset();
    setFormStep(form, 0);
    if (form.id === 'studentForm') selectWorkType(state.workType);
  }
  const status = $('[data-draft-status]', form);
  if (status) status.textContent = 'Draft saves on this device';
  renderWorkspaceDrafts();
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
}

function setSurface(surface) {
  state.surface = surface;
  document.body.dataset.surface = surface;
  const workspace = surface === 'workspace';
  $('#siteShell').hidden = workspace;
  $('#workspaceShell').hidden = !workspace;
  setWorkspaceTab('overview');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function selectWorkType(workType) {
  if (!workType) return;
  state.workType = workType;
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
    const avoided = Number(draftValue(companyDraft, 'companyInternalHours', 0));
    const review = Number(draftValue(companyDraft, 'companyReviewMinutes', 0)) / 60;
    const net = avoided || review ? avoided - review : null;
    $('#companyDraftMeta').textContent = [draftValue(companyDraft, 'companyName'), deliverable].filter(Boolean).join(' · ');
    $('#companyWorkspaceSummaryTitle').textContent = draftValue(companyDraft, 'companyName', 'Project Packet in progress');
    renderDefinitionList($('#companyWorkspaceSummary'), [
      ['Deliverable', deliverable],
      ['Information boundary', draftValue(companyDraft, 'companyAccess') === 'none' ? 'Approved copies only · no production access' : draftValue(companyDraft, 'companyAccess', 'Not set')],
      ['Time-saving case', net === null ? 'Add employee time avoided and review minutes.' : net.toFixed(1) + ' estimated net internal hours'],
    ]);
  } else {
    $('#companyWorkspaceSummaryTitle').textContent = 'No company problem draft yet';
    renderDefinitionList($('#companyWorkspaceSummary'), [
      ['Deliverable', 'Describe a useful finish.'],
      ['Information boundary', 'Identify safe approved inputs.'],
      ['Time-saving case', 'Estimate employee time avoided.'],
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
  return readStorage(storageKey, []);
}

function saveSubmission(submission) {
  const items = savedSubmissions();
  items.unshift(submission);
  writeStorage(storageKey, items.slice(0, 8));
  renderLocalSubmissionState();
}

function renderLocalSubmissionState() {
  const submissions = savedSubmissions();
  const student = submissions.find(item => item.type === 'student_interest');
  const company = submissions.find(item => item.type === 'employer_intake');
  if (student) {
    $('#studentProfileStatus').textContent = 'Submitted · ' + student.reference;
    $('#studentProfileStatus').classList.add('ready');
  }
  if (company) {
    $('#companyProblemStatus').textContent = 'Submitted · ' + company.reference;
    $('#companyProblemStatus').classList.add('ready');
  }
  const history = $('#submissionHistory');
  history.replaceChildren();
  if (!submissions.length) {
    history.textContent = 'No locally confirmed submissions yet. After a successful form submission, its reference will appear here on this device.';
    renderWorkspaceDrafts();
    return;
  }
  for (const item of submissions) {
    const label = item.type === 'student_interest' ? 'Student interest profile' : 'Company problem intake';
    const row = document.createElement('span');
    const title = document.createElement('strong');
    row.className = 'submission-line';
    title.textContent = label;
    row.append(title, document.createTextNode(' ' + item.reference + ' · ' + new Date(item.createdAt).toLocaleDateString()));
    history.append(row);
  }
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
    saveSubmission({ type: 'student_interest', reference: result.reference, createdAt: new Date().toISOString() });
    showToast('Your interest profile was received.');
    window.setTimeout(() => studentDialog.close(), 900);
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
    const result = await sendSubmission(companyPayload(companyForm));
    message.classList.add('is-success');
    message.textContent = 'Company problem received. Reference ' + result.reference + '.';
    discardDraft(companyForm, { reset: false });
    saveSubmission({ type: 'employer_intake', reference: result.reference, createdAt: new Date().toISOString() });
    showToast('Your company problem was received for scoping.');
    window.setTimeout(() => companyDialog.close(), 900);
  } catch (error) {
    message.classList.remove('is-success');
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Send company problem ' + iconUse('icon-arrow-right');
  }
});

$$('[data-audience-option]').forEach(button => button.addEventListener('click', () => setAudience(button.dataset.audienceOption)));
$$('[data-workspace-tab]').forEach(button => button.addEventListener('click', () => setWorkspaceTab(button.dataset.workspaceTab)));
$$('[data-work-type]').forEach(button => button.addEventListener('click', () => {
  selectWorkType(button.dataset.workType);
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
}));

$$('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  const textarea = $('#companyProblemSeed');
  if (!textarea.value.trim()) textarea.value = button.dataset.prompt;
  else if (!textarea.value.includes(button.dataset.prompt)) textarea.value = textarea.value.trim() + '\n' + button.dataset.prompt;
  textarea.focus();
}));

const restoredWorkTypes = checkedValues(studentForm, 'workType');
if (restoredWorkTypes.length) state.workType = restoredWorkTypes[0];
renderLocalSubmissionState();
selectWorkType(state.workType);
setAudience(state.audience);
