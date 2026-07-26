const $ = selector => document.querySelector(selector);
const ACCESS_KEY = 'covendaMemberAccessToken';
const REFRESH_KEY = 'covendaMemberRefreshToken';
const EXPIRY_KEY = 'covendaMemberExpiry';

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

function projectId() {
  const query = new URLSearchParams(location.search);
  if (query.get('projectId')) return query.get('projectId');
  const last = location.pathname.split('/').filter(Boolean).at(-1);
  return last === 'detail.html' ? '' : last;
}

function captureAuth() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('access_token')) {
    saveSession({
      accessToken: params.get('access_token'),
      refreshToken: params.get('refresh_token'),
      expiresAt: params.get('expires_at'),
    });
    history.replaceState({}, document.title, location.pathname + location.search);
  }
  return params.get('error_description') || '';
}

function showMessage(message, error = false) {
  const root = $('#reviewerLoginMessage');
  root.textContent = message;
  root.className = `alert ${error ? 'error' : 'success'}`;
  root.hidden = !message;
}

async function refreshSession() {
  if (!session().refreshToken) return false;
  const response = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh-session', refreshToken: session().refreshToken }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) return false;
  saveSession(result);
  return true;
}

async function request(path = '', options = {}, retry = true) {
  const response = await fetch(`/api/company-workflow${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session().accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 && retry && await refreshSession()) return request(path, options, false);
  if (!response.ok || !result.ok) throw new Error(result.error || 'The reviewer request failed.');
  return result;
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

function approvalItem(label, approved) {
  const item = document.createElement('div');
  item.className = `approval-item${approved ? ' is-approved' : ''}`;
  const strong = document.createElement('strong');
  const span = document.createElement('span');
  strong.textContent = label;
  span.textContent = approved ? 'Approved' : 'Pending';
  item.append(strong, span);
  return item;
}

function render(data) {
  $('#reviewerLogin').hidden = true;
  const root = $('#reviewerContent');
  root.hidden = false;
  root.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'page-heading';
  const copy = document.createElement('div');
  const h1 = document.createElement('h1');
  const p = document.createElement('p');
  h1.textContent = data.version.objective;
  p.textContent = `${data.organization?.name || 'Company'} · project brief version ${data.project.current_version}`;
  copy.append(h1, p);
  const status = document.createElement('span');
  status.className = 'status';
  status.dataset.state = data.project.status;
  status.textContent = data.project.status.replaceAll('_', ' ');
  heading.append(copy, status);
  root.append(heading);

  const section = document.createElement('section');
  section.className = 'section';
  const panel = document.createElement('article');
  panel.className = 'object-panel';
  const header = document.createElement('header');
  const title = document.createElement('div');
  title.innerHTML = '<h2>Review the current version</h2><p>Confirm that the work is reviewable, bounded, and appropriate for the stated domain.</p>';
  header.append(title);
  const body = document.createElement('div');
  body.className = 'panel-body';
  const details = document.createElement('dl');
  details.className = 'detail-list';
  [
    ['Deliverables', data.version.deliverables],
    ['Approved context', data.version.approved_context],
    ['Student responsibilities', data.version.student_responsibilities],
    ['Company responsibilities', data.version.company_responsibilities],
    ['Out of scope', data.version.out_of_scope],
    ['Milestones', data.version.milestones.map(item => item.title || item)],
    ['Acceptance criteria', data.version.acceptance_criteria],
    ['AI policy', data.version.ai_policy],
    ['Information boundary', data.version.information_boundary],
    ['Required reviewer', data.version.required_reviewer],
    ['Company response expectation', data.version.company_response_expectation],
    ['One revision', data.version.one_revision_rule ? 'Included' : 'Not included'],
  ].forEach(([term, value]) => details.append(detailRow(term, value)));
  const approvals = document.createElement('div');
  approvals.className = 'approval-grid';
  approvals.append(
    approvalItem('Covenda', data.approvalState.covenda),
    approvalItem('Company', data.approvalState.company),
    approvalItem('Domain reviewer', data.approvalState.reviewer),
  );
  body.append(details, approvals);
  const footer = document.createElement('footer');
  if (!data.approvalState.reviewer) {
    const approve = document.createElement('button');
    approve.className = 'button primary';
    approve.type = 'button';
    approve.textContent = `Approve version ${data.project.current_version}`;
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      try {
        await request('', {
          method: 'POST',
          body: JSON.stringify({ action: 'approve-reviewer', projectId: data.project.id }),
        });
        await load();
      } catch (error) {
        window.alert(error.message);
        approve.disabled = false;
      }
    });
    footer.append(approve);
  } else {
    footer.textContent = `You approved version ${data.project.current_version}.`;
  }
  panel.append(header, body, footer);
  section.append(panel);
  root.append(section);
}

async function load() {
  const id = projectId();
  if (!id) throw new Error('Open this route with a valid project ID.');
  const data = await request(`?action=reviewer-project&projectId=${encodeURIComponent(id)}`);
  render(data);
}

$('#reviewerLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/portal', {
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
    showMessage('Check your email for a secure reviewer sign-in link.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

const authError = captureAuth();
if (authError) showMessage(authError, true);
else if (session().accessToken) load().catch(error => showMessage(error.message, true));
