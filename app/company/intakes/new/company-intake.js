const $ = (selector, root = document) => root.querySelector(selector);
const ACCESS_KEY = 'covendaMemberAccessToken';
const REFRESH_KEY = 'covendaMemberRefreshToken';
const EXPIRY_KEY = 'covendaMemberExpiry';
const LAST_INTAKE_KEY = 'covendaCompanyIntakeId';

function session() {
  return {
    accessToken: sessionStorage.getItem(ACCESS_KEY) || '',
    refreshToken: sessionStorage.getItem(REFRESH_KEY) || '',
    expiresAt: Number(sessionStorage.getItem(EXPIRY_KEY) || 0),
  };
}

function saveSession(data) {
  if (data.accessToken) sessionStorage.setItem(ACCESS_KEY, data.accessToken);
  if (data.refreshToken) sessionStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.expiresAt) sessionStorage.setItem(EXPIRY_KEY, String(data.expiresAt));
}

function captureAuthRedirect() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const params = hash.has('access_token') ? hash : query;
  const accessToken = params.get('access_token');
  if (accessToken) {
    saveSession({
      accessToken,
      refreshToken: params.get('refresh_token'),
      expiresAt: params.get('expires_at'),
    });
    history.replaceState({}, document.title, location.pathname);
  }
  return params.get('error_description') || params.get('error_message') || '';
}

async function refreshSession() {
  const current = session();
  if (!current.refreshToken) return false;
  const response = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh-session', refreshToken: current.refreshToken }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) return false;
  saveSession(result);
  return true;
}

async function workflowRequest(path = '', options = {}, retry = true) {
  const current = session();
  if (current.expiresAt && current.expiresAt * 1000 < Date.now() + 30_000) await refreshSession();
  const response = await fetch(`/api/company-workflow${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session().accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'The server returned an unreadable response.' }));
  if (response.status === 401 && retry && await refreshSession()) return workflowRequest(path, options, false);
  if (!response.ok || !result.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function showMessage(selector, message, error = false) {
  const element = $(selector);
  element.textContent = message;
  element.className = `alert ${error ? 'error' : 'success'}`;
  element.hidden = !message;
}

function showAuthenticated() {
  $('#companyLogin').hidden = true;
  $('#companyWorkflow').hidden = false;
}

function showLogin(message = '') {
  $('#companyLogin').hidden = false;
  $('#companyWorkflow').hidden = true;
  if (message) showMessage('#companyLoginMessage', message, true);
}

function formPayload(form) {
  const data = Object.fromEntries(new FormData(form));
  return {
    action: 'submit-intake',
    companyName: data.companyName,
    companyWebsite: data.companyWebsite,
    companyIndustry: data.companyIndustry,
    companySize: data.companySize,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactRole: data.contactRole,
    delayedWorkExample: data.delayedWorkExample,
    delayReason: data.delayReason,
    normalOwner: data.normalOwner,
    occurrenceFrequency: data.occurrenceFrequency,
    desiredBusinessResult: data.desiredBusinessResult,
    finalDeliverable: data.finalDeliverable,
    namedReviewer: data.namedReviewer,
    acceptanceCriteria: data.acceptanceCriteria,
    companyReviewMinutes: Number(data.companyReviewMinutes),
    employeeHoursAvoided: Number(data.employeeHoursAvoided),
    studentHours: Number(data.studentHours),
    budgetCents: Math.round(Number(data.budgetDollars) * 100),
    deadline: data.deadline,
    availableContext: data.availableContext,
    toolsRequired: data.toolsRequired,
    systemAccess: data.systemAccess,
    dataClassification: data.dataClassification,
    confidentialityConcerns: data.confidentialityConcerns,
    aiUsePolicy: data.aiUsePolicy,
    restrictedInformationDeclared: data.restrictedInformation === 'true',
  };
}

async function uploadFile(file, intakeId) {
  const response = await fetch('/api/company-workflow-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session().accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
      'x-intake-id': intakeId,
    },
    body: file,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(`${file.name}: ${result.error || 'Upload failed.'}`);
  return result.attachment;
}

function approvalItem(label, approved) {
  const item = document.createElement('div');
  item.className = `approval-item${approved ? ' is-approved' : ''}`;
  const strong = document.createElement('strong');
  const status = document.createElement('span');
  strong.textContent = label;
  status.textContent = approved ? 'Approved' : 'Pending';
  item.append(strong, status);
  return item;
}

function detailRow(term, value) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = term;
  dd.textContent = Array.isArray(value) ? value.join('\n') : (value ?? '—');
  row.append(dt, dd);
  return row;
}

function renderClarifications(items) {
  const root = $('#companyClarifications');
  const open = (items || []).filter(item => item.status === 'open');
  root.hidden = !open.length;
  root.replaceChildren();
  if (!open.length) return;
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.innerHTML = '<h2>Covenda needs more information</h2><p>Answer the open request below. Your response returns the intake to the review queue.</p>';
  root.append(heading);
  open.forEach(item => {
    const panel = document.createElement('article');
    panel.className = 'object-panel';
    const header = document.createElement('header');
    const title = document.createElement('div');
    const h3 = document.createElement('h3');
    const p = document.createElement('p');
    h3.textContent = 'Clarification request';
    p.textContent = item.request_message;
    title.append(h3, p);
    header.append(title);
    const form = document.createElement('form');
    form.className = 'panel-body stack';
    const label = document.createElement('label');
    label.className = 'field';
    label.innerHTML = '<span>Your response</span>';
    const textarea = document.createElement('textarea');
    textarea.required = true;
    textarea.maxLength = 8000;
    label.append(textarea);
    const button = document.createElement('button');
    button.className = 'button primary';
    button.type = 'submit';
    button.textContent = 'Send response';
    form.append(label, button);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      button.disabled = true;
      try {
        await workflowRequest('', {
          method: 'POST',
          body: JSON.stringify({ action: 'respond-clarification', clarificationId: item.id, response: textarea.value }),
        });
        await loadIntake(sessionStorage.getItem(LAST_INTAKE_KEY));
      } catch (error) {
        window.alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
    panel.append(header, form);
    root.append(panel);
  });
}

function renderApproval(project) {
  const root = $('#companyApprovalPanel');
  root.hidden = !project?.version;
  root.replaceChildren();
  if (!project?.version) return;
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.innerHTML = `<h2>Project brief · version ${project.currentVersion}</h2><p>Approve only if this version matches the work, boundary, timing, and company responsibilities you accept.</p>`;
  const panel = document.createElement('article');
  panel.className = 'object-panel';
  const header = document.createElement('header');
  const title = document.createElement('div');
  title.innerHTML = `<h3>${project.version.objective}</h3><p>Deadline ${new Date(`${project.version.deadline}T00:00:00`).toLocaleDateString()}</p>`;
  const status = document.createElement('span');
  status.className = 'status';
  status.dataset.state = project.status;
  status.textContent = project.status.replaceAll('_', ' ');
  header.append(title, status);
  const body = document.createElement('div');
  body.className = 'panel-body';
  const details = document.createElement('dl');
  details.className = 'detail-list';
  [
    ['Deliverables', project.version.deliverables],
    ['Approved context', project.version.approved_context],
    ['Company responsibilities', project.version.company_responsibilities],
    ['Out of scope', project.version.out_of_scope],
    ['Acceptance criteria', project.version.acceptance_criteria],
    ['Information boundary', project.version.information_boundary],
    ['AI policy', project.version.ai_policy],
    ['One revision', project.version.one_revision_rule ? 'Included' : 'Not included'],
  ].forEach(([term, value]) => details.append(detailRow(term, value)));
  const approvalGrid = document.createElement('div');
  approvalGrid.className = 'approval-grid';
  approvalGrid.append(
    approvalItem('Covenda', project.approvals.covenda),
    approvalItem('Company', project.approvals.company),
    approvalItem('Domain reviewer', project.approvals.reviewer),
  );
  body.append(details, approvalGrid);
  const footer = document.createElement('footer');
  if (!project.approvals.company) {
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'button primary';
    approve.textContent = `Approve version ${project.currentVersion}`;
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      try {
        await workflowRequest('', {
          method: 'POST',
          body: JSON.stringify({ action: 'approve-company', projectId: project.id }),
        });
        await loadIntake(sessionStorage.getItem(LAST_INTAKE_KEY));
      } catch (error) {
        window.alert(error.message);
        approve.disabled = false;
      }
    });
    footer.append(approve);
  } else {
    footer.textContent = `Your organization approved version ${project.currentVersion}.`;
  }
  panel.append(header, body, footer);
  root.append(heading, panel);
}

async function loadIntake(intakeId) {
  if (!intakeId) return false;
  try {
    const result = await workflowRequest(`?action=company-intake&intakeId=${encodeURIComponent(intakeId)}`);
    $('#companyIntakeForm').hidden = true;
    $('#companyConfirmation').hidden = false;
    renderClarifications(result.clarifications);
    renderApproval(result.project);
    return true;
  } catch {
    sessionStorage.removeItem(LAST_INTAKE_KEY);
    return false;
  }
}

$('#companyLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('button', event.currentTarget);
  button.disabled = true;
  try {
    const response = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request-link',
        email: event.currentTarget.elements.email.value,
        redirectPath: '/app/company/intakes/new',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not request a sign-in link.');
    showMessage('#companyLoginMessage', 'Check your email for a secure sign-in link.');
  } catch (error) {
    showMessage('#companyLoginMessage', error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#companyIntakeForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  showMessage('#companyFormMessage', 'Submitting your intake…');
  try {
    const files = [...$('#companyAttachments').files];
    let intakeId = '';
    if (files.length) {
      const draft = await workflowRequest('', {
        method: 'POST',
        body: JSON.stringify({ action: 'create-draft' }),
      });
      intakeId = draft.intake.id;
      for (const file of files) await uploadFile(file, intakeId);
    }
    const payload = formPayload(form);
    if (intakeId) payload.intakeId = intakeId;
    const result = await workflowRequest('', { method: 'POST', body: JSON.stringify(payload) });
    sessionStorage.setItem(LAST_INTAKE_KEY, result.intake.id);
    await loadIntake(result.intake.id);
    window.scrollTo({ top: 0 });
  } catch (error) {
    showMessage('#companyFormMessage', error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#startAnotherIntake').addEventListener('click', () => {
  sessionStorage.removeItem(LAST_INTAKE_KEY);
  $('#companyConfirmation').hidden = true;
  $('#companyIntakeForm').hidden = false;
  $('#companyIntakeForm').reset();
  window.scrollTo({ top: 0 });
});

const authError = captureAuthRedirect();
if (authError) {
  showLogin(authError);
} else if (session().accessToken) {
  showAuthenticated();
  loadIntake(sessionStorage.getItem(LAST_INTAKE_KEY));
} else {
  showLogin();
}
