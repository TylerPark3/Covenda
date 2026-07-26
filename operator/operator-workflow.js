const $ = (selector, root = document) => root.querySelector(selector);
const TOKEN_KEY = 'covendaAdminAccessToken';
const pageType = document.body.dataset.operatorPage;

const classificationLabels = {
  suitable_short_project: 'Suitable short project',
  needs_clarification: 'Needs clarification',
  better_as_internship: 'Better as internship',
  better_for_contractor: 'Better for contractor',
  better_for_employee: 'Better for employee',
  better_for_ai: 'Better for AI',
  not_eligible: 'Not eligible',
};

const intakeFieldLabels = {
  companyName: 'Company name',
  companyWebsite: 'Company website',
  companyIndustry: 'Company industry',
  companySize: 'Company size',
  contactName: 'Contact name',
  contactEmail: 'Contact email',
  contactRole: 'Contact role',
  delayedWorkExample: 'Last real example',
  delayReason: 'Why delayed',
  normalOwner: 'Normal owner',
  occurrenceFrequency: 'Frequency',
  desiredBusinessResult: 'Desired result',
  finalDeliverable: 'Final deliverable',
  namedReviewer: 'Named reviewer',
  acceptanceCriteria: 'Acceptance criteria',
  companyReviewMinutes: 'Review-time budget',
  employeeHoursAvoided: 'Employee hours avoided',
  studentHours: 'Student hours',
  budgetCents: 'Budget',
  deadline: 'Deadline',
  availableContext: 'Available context',
  toolsRequired: 'Tools required',
  systemAccess: 'System access',
  dataClassification: 'Data classification',
  confidentialityConcerns: 'Confidentiality concerns',
  aiUsePolicy: 'AI-use policy',
  restrictedInformationDeclared: 'Restricted information declaration',
};

function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

function recordId() {
  const query = new URLSearchParams(location.search);
  const queryKey = pageType === 'intake' ? 'intakeId' : 'projectId';
  if (query.get(queryKey)) return query.get(queryKey);
  const parts = location.pathname.split('/').filter(Boolean);
  return parts.at(-1) === 'detail.html' ? '' : parts.at(-1);
}

function captureAuthRedirect() {
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  if (accessToken) sessionStorage.setItem(TOKEN_KEY, accessToken);
  const error = params.get('error_description') || params.get('error_message') || '';
  if (location.hash) history.replaceState({}, document.title, location.pathname + location.search);
  return error;
}

function showMessage(element, message, error = false) {
  element.textContent = message;
  element.className = `alert ${error ? 'error' : 'success'}`;
  element.hidden = !message;
}

function showLogin(message = '') {
  $('#operatorLogin').hidden = false;
  $('#operatorContent').hidden = true;
  if (message) showMessage($('#operatorLoginMessage'), message, true);
}

function showContent() {
  $('#operatorLogin').hidden = true;
  $('#operatorContent').hidden = false;
}

async function request(path = '', options = {}) {
  const response = await fetch(`/api/company-workflow${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'The server returned an unreadable response.' }));
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin('Your operator session ended. Request another sign-in link.');
  }
  if (!response.ok || !result.ok) throw new Error(result.error || 'The operator request failed.');
  return result;
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function sectionHeading(title, copy = '') {
  const wrapper = element('div', 'section-heading');
  wrapper.append(element('h2', '', title));
  if (copy) wrapper.append(element('p', '', copy));
  return wrapper;
}

function statusBadge(value) {
  const badge = element('span', 'status', (classificationLabels[value] || value || 'Not classified').replaceAll('_', ' '));
  badge.dataset.state = value || '';
  return badge;
}

function detailList(entries) {
  const list = element('dl', 'detail-list');
  entries.forEach(([term, value]) => {
    const row = element('div');
    const dt = element('dt', '', term);
    const dd = element('dd', '', value === null || value === undefined || value === '' ? '—' : String(value));
    row.append(dt, dd);
    list.append(row);
  });
  return list;
}

function formatMoney(cents) {
  return Number.isFinite(Number(cents))
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(cents) / 100)
    : '—';
}

function intakeEntries(intake) {
  return [
    ['Company', intake.company_name],
    ['Website', intake.company_website],
    ['Industry', intake.company_industry],
    ['Company size', intake.company_size],
    ['Contact', `${intake.contact_name || '—'} · ${intake.contact_role || '—'} · ${intake.contact_email || '—'}`],
    ['Last real example', intake.delayed_work_example],
    ['Why delayed', intake.delay_reason],
    ['Normal owner', intake.normal_owner],
    ['Frequency', intake.occurrence_frequency],
    ['Desired business result', intake.desired_business_result],
    ['Final deliverable', intake.final_deliverable],
    ['Named reviewer', intake.named_reviewer],
    ['Acceptance criteria', intake.acceptance_criteria],
    ['Company review-time budget', `${intake.company_review_minutes ?? '—'} minutes`],
    ['Employee hours avoided', intake.employee_hours_avoided],
    ['Student hours', intake.student_hours],
    ['Budget', formatMoney(intake.budget_cents)],
    ['Deadline', intake.deadline],
    ['Available context', intake.available_context],
    ['Tools required', intake.tools_required],
    ['System access', intake.system_access],
    ['Data classification', intake.data_classification],
    ['Confidentiality concerns', intake.confidentiality_concerns],
    ['AI-use policy', intake.ai_use_policy],
    ['Restricted information declared', intake.restricted_information_declared ? 'Yes' : 'No'],
  ];
}

async function openAttachment(attachment, operator = true) {
  const result = await request('', {
    method: 'POST',
    body: JSON.stringify({
      action: operator ? 'operator-attachment-url' : 'company-attachment-url',
      attachmentId: attachment.id,
    }),
  });
  window.open(result.url, '_blank', 'noopener,noreferrer');
}

function renderAttachments(attachments) {
  const list = element('ul', 'plain-list');
  (attachments || []).forEach(attachment => {
    const item = element('li');
    const button = element('button', 'button text', attachment.original_name);
    button.type = 'button';
    button.addEventListener('click', () => openAttachment(attachment));
    item.append(button, element('p', '', `${attachment.content_type} · ${Math.ceil(attachment.size_bytes / 1024)} KB · 60-second authorized link`));
    list.append(item);
  });
  if (!list.children.length) list.append(element('li', '', 'No supporting files.'));
  return list;
}

function renderNotes(notes) {
  const list = element('ol', 'timeline');
  (notes || []).forEach(note => {
    const item = element('li');
    item.append(element('strong', '', note.created_by_email), element('time', '', new Date(note.created_at).toLocaleString()), element('p', '', note.note));
    list.append(item);
  });
  if (!list.children.length) list.append(element('li', '', 'No internal notes yet.'));
  return list;
}

function renderClarifications(clarifications) {
  const list = element('ol', 'timeline');
  (clarifications || []).forEach(item => {
    const entry = element('li');
    entry.append(
      element('strong', '', item.status === 'open' ? 'Waiting for company response' : 'Company responded'),
      element('time', '', new Date(item.requested_at).toLocaleString()),
      element('p', '', item.request_message),
    );
    if (item.company_response) entry.append(element('p', '', `Response: ${item.company_response}`));
    list.append(entry);
  });
  if (!list.children.length) list.append(element('li', '', 'No clarification requests.'));
  return list;
}

function buildMissingFields() {
  const fieldset = element('fieldset', 'radio-row');
  fieldset.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  const legend = element('legend', '', 'Missing information');
  fieldset.append(legend);
  Object.entries(intakeFieldLabels).forEach(([value, label]) => {
    const item = element('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'missingFields';
    input.value = value;
    item.append(input, element('span', '', label));
    fieldset.append(item);
  });
  return fieldset;
}

function renderIntakePage(data) {
  const root = $('#operatorContent');
  root.replaceChildren();
  const heading = element('div', 'page-heading');
  const headingCopy = element('div');
  headingCopy.append(element('h1', '', data.intake.company_name || 'Company intake'), element('p', '', 'Review the original intake, record private context, and decide the right work format.'));
  heading.append(headingCopy, statusBadge(data.intake.classification || data.intake.status));
  root.append(heading);

  const layout = element('div', 'split-layout section');
  const main = element('div', 'stack');
  const original = element('article', 'object-panel');
  const originalHeader = element('header');
  originalHeader.append(element('div', '', ''), statusBadge(data.intake.status));
  originalHeader.firstChild.append(element('h2', '', 'Original intake'), element('p', '', `Submitted ${new Date(data.intake.submitted_at).toLocaleString()}`));
  const originalBody = element('div', 'panel-body');
  originalBody.append(detailList(intakeEntries(data.intake)));
  original.append(originalHeader, originalBody);
  main.append(original);

  const attachments = element('section');
  attachments.append(sectionHeading('Private attachments', 'Links expire after 60 seconds and are created only after this operator session is authorized.'), renderAttachments(data.attachments));
  main.append(attachments);

  const history = element('section');
  history.append(sectionHeading('Clarification history'), renderClarifications(data.clarifications));
  main.append(history);

  const side = element('aside', 'side-stack');
  const classification = element('article', 'object-panel');
  const classHeader = element('header');
  classHeader.append(element('div'));
  classHeader.firstChild.append(element('h3', '', 'Classify the work'), element('p', '', 'This decision does not publish a project.'));
  const classForm = element('form', 'panel-body stack');
  const selectLabel = element('label', 'field');
  selectLabel.append(element('span', '', 'Work format'));
  const select = document.createElement('select');
  select.name = 'classification';
  Object.entries(classificationLabels).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = data.intake.classification === value;
    select.append(option);
  });
  selectLabel.append(select);
  const saveClassification = element('button', 'button primary', 'Save classification');
  saveClassification.type = 'submit';
  classForm.append(selectLabel, saveClassification);
  classForm.addEventListener('submit', async event => {
    event.preventDefault();
    saveClassification.disabled = true;
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'classify-intake', intakeId: data.intake.id, classification: select.value }) });
      await load();
    } catch (error) { window.alert(error.message); saveClassification.disabled = false; }
  });
  classification.append(classHeader, classForm);
  side.append(classification);

  const clarification = element('article', 'object-panel');
  const clarificationHeader = element('header');
  clarificationHeader.append(element('div'));
  clarificationHeader.firstChild.append(element('h3', '', 'Request clarification'), element('p', '', 'The company sees the request and missing-field list, never internal notes.'));
  const clarificationForm = element('form', 'panel-body stack');
  const missing = buildMissingFields();
  const requestLabel = element('label', 'field');
  requestLabel.append(element('span', '', 'Message to the company'));
  const requestText = document.createElement('textarea');
  requestText.required = true;
  requestText.minLength = 10;
  requestText.maxLength = 4000;
  requestLabel.append(requestText);
  const requestButton = element('button', 'button secondary', 'Send clarification request');
  requestButton.type = 'submit';
  clarificationForm.append(missing, requestLabel, requestButton);
  clarificationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const missingFields = [...clarificationForm.querySelectorAll('[name="missingFields"]:checked')].map(item => item.value);
    requestButton.disabled = true;
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'request-clarification', intakeId: data.intake.id, missingFields, requestMessage: requestText.value }) });
      await load();
    } catch (error) { window.alert(error.message); requestButton.disabled = false; }
  });
  clarification.append(clarificationHeader, clarificationForm);
  side.append(clarification);

  const notes = element('article', 'object-panel');
  const notesHeader = element('header');
  notesHeader.append(element('div'));
  notesHeader.firstChild.append(element('h3', '', 'Internal notes'), element('p', '', 'Operators only.'));
  const notesBody = element('div', 'panel-body');
  notesBody.append(renderNotes(data.notes));
  const noteForm = element('form', 'panel-body stack');
  const noteLabel = element('label', 'field');
  noteLabel.append(element('span', '', 'Add note'));
  const noteText = document.createElement('textarea');
  noteText.required = true;
  noteText.maxLength = 4000;
  noteLabel.append(noteText);
  const noteButton = element('button', 'button secondary', 'Add internal note');
  noteButton.type = 'submit';
  noteForm.append(noteLabel, noteButton);
  noteForm.addEventListener('submit', async event => {
    event.preventDefault();
    noteButton.disabled = true;
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'add-note', intakeId: data.intake.id, note: noteText.value }) });
      await load();
    } catch (error) { window.alert(error.message); noteButton.disabled = false; }
  });
  notes.append(notesHeader, notesBody, noteForm);
  side.append(notes);

  if (data.project) {
    const projectLink = element('a', 'button primary', 'Open project brief');
    projectLink.href = `/operator/projects/${data.project.id}`;
    side.append(projectLink);
  } else if (data.intake.classification === 'suitable_short_project' && data.intake.status === 'classified') {
    const createProject = element('button', 'button primary', 'Create project brief');
    createProject.type = 'button';
    createProject.addEventListener('click', async () => {
      createProject.disabled = true;
      try {
        const result = await request('', { method: 'POST', body: JSON.stringify({ action: 'create-project', intakeId: data.intake.id }) });
        location.assign(`/operator/projects/${result.project.id}`);
      } catch (error) { window.alert(error.message); createProject.disabled = false; }
    });
    side.append(createProject);
  }
  layout.append(main, side);
  root.append(layout);
}

function approvalItem(label, approved) {
  const item = element('div', `approval-item${approved ? ' is-approved' : ''}`);
  item.append(element('strong', '', label), element('span', '', approved ? 'Approved' : 'Pending'));
  return item;
}

function briefValues(version) {
  return {
    objective: version?.objective || '',
    deliverables: (version?.deliverables || []).join('\n'),
    approvedContext: version?.approved_context || '',
    studentResponsibilities: version?.student_responsibilities || '',
    companyResponsibilities: version?.company_responsibilities || '',
    outOfScope: version?.out_of_scope || '',
    milestones: (version?.milestones || []).map(item => typeof item === 'string' ? item : item.title).join('\n'),
    acceptanceCriteria: version?.acceptance_criteria || '',
    compensationDollars: version ? Number(version.compensation_cents) / 100 : '',
    deadline: version?.deadline || '',
    aiPolicy: version?.ai_policy || '',
    informationBoundary: version?.information_boundary || '',
    requiredReviewer: version?.required_reviewer || '',
    companyResponseExpectation: version?.company_response_expectation || '',
    oneRevisionRule: version?.one_revision_rule !== false,
    changeSummary: '',
  };
}

function textField(name, label, value, { rows = 0, required = true, type = 'text', wide = true } = {}) {
  const field = element('label', `field${wide ? ' wide' : ''}`);
  field.append(element('span', '', label));
  const control = rows ? document.createElement('textarea') : document.createElement('input');
  control.name = name;
  control.required = required;
  if (rows) control.rows = rows;
  else control.type = type;
  control.value = value ?? '';
  field.append(control);
  return field;
}

function renderVersionHistory(versions, approvals) {
  const list = element('ol', 'timeline');
  versions.forEach(version => {
    const item = element('li');
    const count = approvals.filter(approval => approval.version_number === version.version_number).length;
    item.append(
      element('strong', '', `Version ${version.version_number}`),
      element('time', '', new Date(version.created_at).toLocaleString()),
      element('p', '', `${version.change_summary || 'Initial project brief'} · ${count} approval${count === 1 ? '' : 's'}`),
    );
    list.append(item);
  });
  if (!versions.length) list.append(element('li', '', 'No project brief version yet.'));
  return list;
}

function renderProjectPage(data) {
  const root = $('#operatorContent');
  root.replaceChildren();
  const current = data.versions.find(version => version.version_number === data.project.current_version) || null;
  const heading = element('div', 'page-heading');
  const copy = element('div');
  copy.append(element('h1', '', current?.objective || 'Build the project brief'), element('p', '', `${data.organization?.name || data.intake?.company_name || 'Company'} · sourced from one reviewed intake`));
  heading.append(copy, statusBadge(data.project.status));
  root.append(heading);

  const approvalSection = element('section', 'section');
  approvalSection.append(sectionHeading('Approvals', 'Only approvals for the current version count. A new version starts a new approval cycle.'));
  const approvalGrid = element('div', 'approval-grid');
  approvalGrid.append(
    approvalItem('Covenda approval', data.approvalState.covenda),
    approvalItem('Company approval', data.approvalState.company),
    approvalItem('Reviewer approval', data.approvalState.reviewer),
  );
  approvalSection.append(approvalGrid);
  if (data.approvalState.complete) {
    const ready = element('div', 'alert success');
    ready.innerHTML = '<strong>Approved for sourcing.</strong>The current version has all three approvals. This workflow still does not publish or match automatically.';
    approvalSection.append(ready);
  }
  root.append(approvalSection);

  const layout = element('div', 'split-layout section');
  const main = element('div', 'stack');
  const briefPanel = element('article', 'object-panel');
  const briefHeader = element('header');
  briefHeader.append(element('div'));
  briefHeader.firstChild.append(element('h2', '', current ? `Create version ${data.project.current_version + 1}` : 'Create version 1'), element('p', '', 'Saving creates an immutable version. It does not overwrite earlier approvals.'));
  const form = element('form', 'panel-body');
  const grid = element('div', 'form-grid');
  const values = briefValues(current);
  grid.append(
    textField('objective', 'Objective', values.objective, { rows: 4 }),
    textField('deliverables', 'Deliverables · one per line', values.deliverables, { rows: 5 }),
    textField('approvedContext', 'Approved context', values.approvedContext, { rows: 4 }),
    textField('studentResponsibilities', 'Student responsibilities', values.studentResponsibilities, { rows: 4 }),
    textField('companyResponsibilities', 'Company responsibilities', values.companyResponsibilities, { rows: 4 }),
    textField('outOfScope', 'Out-of-scope work', values.outOfScope, { rows: 4 }),
    textField('milestones', 'Milestones · one per line', values.milestones, { rows: 4 }),
    textField('acceptanceCriteria', 'Acceptance criteria', values.acceptanceCriteria, { rows: 4 }),
    textField('compensationDollars', 'Compensation · USD', values.compensationDollars, { type: 'number', wide: false }),
    textField('deadline', 'Deadline', values.deadline, { type: 'date', wide: false }),
    textField('aiPolicy', 'AI policy', values.aiPolicy, { rows: 4 }),
    textField('informationBoundary', 'Information boundary', values.informationBoundary, { rows: 4 }),
    textField('requiredReviewer', 'Required reviewer', values.requiredReviewer, { wide: false }),
    textField('companyResponseExpectation', 'Company response expectation', values.companyResponseExpectation, { wide: false }),
  );
  const revision = element('label', 'field wide');
  const revisionControl = document.createElement('input');
  revisionControl.type = 'checkbox';
  revisionControl.name = 'oneRevisionRule';
  revisionControl.checked = values.oneRevisionRule;
  revision.append(element('span', '', 'One-revision rule'), revisionControl, element('small', '', 'The scope includes one bounded revision after company review.'));
  grid.append(revision, textField('changeSummary', 'What changed in this version?', values.changeSummary, { rows: 3, required: false }));
  const save = element('button', 'button primary', 'Save new version');
  save.type = 'submit';
  form.append(grid, save);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    save.disabled = true;
    const entries = Object.fromEntries(new FormData(form));
    const brief = {
      objective: entries.objective,
      deliverables: entries.deliverables,
      approvedContext: entries.approvedContext,
      studentResponsibilities: entries.studentResponsibilities,
      companyResponsibilities: entries.companyResponsibilities,
      outOfScope: entries.outOfScope,
      milestones: entries.milestones,
      acceptanceCriteria: entries.acceptanceCriteria,
      compensationCents: Math.round(Number(entries.compensationDollars) * 100),
      deadline: entries.deadline,
      aiPolicy: entries.aiPolicy,
      informationBoundary: entries.informationBoundary,
      requiredReviewer: entries.requiredReviewer,
      companyResponseExpectation: entries.companyResponseExpectation,
      oneRevisionRule: revisionControl.checked,
      changeSummary: entries.changeSummary,
    };
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'save-brief-version', projectId: data.project.id, brief }) });
      await load();
    } catch (error) { window.alert(error.message); save.disabled = false; }
  });
  briefPanel.append(briefHeader, form);
  main.append(briefPanel);

  const source = element('article', 'object-panel');
  const sourceHeader = element('header');
  sourceHeader.append(element('div'));
  sourceHeader.firstChild.append(element('h2', '', 'Source intake'), element('p', '', 'The original company language stays visible beside the operator brief.'));
  const sourceBody = element('div', 'panel-body');
  sourceBody.append(detailList(intakeEntries(data.intake)));
  source.append(sourceHeader, sourceBody);
  main.append(source);

  const side = element('aside', 'side-stack');
  const reviewerPanel = element('article', 'object-panel');
  const reviewerHeader = element('header');
  reviewerHeader.append(element('div'));
  reviewerHeader.firstChild.append(element('h3', '', 'Domain reviewer'), element('p', '', 'Assign a Covenda member account. Reviewer approval is bound to that user.'));
  const reviewerForm = element('form', 'panel-body stack');
  const reviewerId = textField('reviewerUserId', 'Reviewer user ID', data.project.domain_reviewer_user_id || '', { wide: false });
  const reviewerName = textField('reviewerName', 'Reviewer name', data.project.domain_reviewer_name || '', { wide: false, required: false });
  const reviewerEmail = textField('reviewerEmail', 'Reviewer email', data.project.domain_reviewer_email || '', { wide: false, required: false, type: 'email' });
  const assign = element('button', 'button secondary', 'Assign reviewer');
  assign.type = 'submit';
  reviewerForm.append(reviewerId, reviewerName, reviewerEmail, assign);
  reviewerForm.addEventListener('submit', async event => {
    event.preventDefault();
    assign.disabled = true;
    const values = Object.fromEntries(new FormData(reviewerForm));
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'assign-reviewer', projectId: data.project.id, ...values }) });
      await load();
    } catch (error) { window.alert(error.message); assign.disabled = false; }
  });
  reviewerPanel.append(reviewerHeader, reviewerForm);
  side.append(reviewerPanel);

  if (current && !data.approvalState.covenda) {
    const approve = element('button', 'button primary', `Record Covenda approval · v${data.project.current_version}`);
    approve.type = 'button';
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      try {
        await request('', { method: 'POST', body: JSON.stringify({ action: 'approve-covenda', projectId: data.project.id }) });
        await load();
      } catch (error) { window.alert(error.message); approve.disabled = false; }
    });
    side.append(approve);
  }

  const history = element('article', 'object-panel');
  const historyHeader = element('header');
  historyHeader.append(element('div'));
  historyHeader.firstChild.append(element('h3', '', 'Version history'), element('p', '', 'Every approval remains tied to its version.'));
  const historyBody = element('div', 'panel-body');
  historyBody.append(renderVersionHistory(data.versions, data.approvals));
  history.append(historyHeader, historyBody);
  side.append(history);
  layout.append(main, side);
  root.append(layout);
}

async function load() {
  const id = recordId();
  if (!id) throw new Error(`Open this page with a valid ${pageType} ID.`);
  showContent();
  const action = pageType === 'intake' ? 'operator-intake' : 'operator-project';
  const key = pageType === 'intake' ? 'intakeId' : 'projectId';
  const data = await request(`?action=${action}&${key}=${encodeURIComponent(id)}`);
  if (pageType === 'intake') renderIntakePage(data);
  else renderProjectPage(data);
}

$('#operatorLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('button', event.currentTarget);
  button.disabled = true;
  try {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request-link',
        email: event.currentTarget.elements.email.value,
        redirectPath: location.pathname,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not request a sign-in link.');
    showMessage($('#operatorLoginMessage'), 'Check your email for a secure operator sign-in link.');
  } catch (error) {
    showMessage($('#operatorLoginMessage'), error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#operatorSignout').addEventListener('click', () => {
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin('Signed out.');
});

const authError = captureAuthRedirect();
if (authError) showLogin(authError);
else if (token()) load().catch(error => {
  $('#operatorContent').replaceChildren(element('div', 'alert error', error.message));
});
else showLogin();
