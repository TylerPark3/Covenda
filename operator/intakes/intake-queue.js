const $ = selector => document.querySelector(selector);
const TOKEN_KEY = 'covendaAdminAccessToken';

function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

function captureAuth() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('access_token')) {
    sessionStorage.setItem(TOKEN_KEY, params.get('access_token'));
    history.replaceState({}, document.title, location.pathname);
  }
  return params.get('error_description') || '';
}

function showMessage(message, error = false) {
  const root = $('#queueLoginMessage');
  root.textContent = message;
  root.className = `alert ${error ? 'error' : 'success'}`;
  root.hidden = !message;
}

async function request(path) {
  const response = await fetch(`/api/company-workflow${path}`, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) sessionStorage.removeItem(TOKEN_KEY);
  if (!response.ok || !result.ok) throw new Error(result.error || 'The intake queue could not be loaded.');
  return result;
}

function render(intakes) {
  $('#queueLogin').hidden = true;
  $('#queueContent').hidden = false;
  $('#queueCount').textContent = `${intakes.length} ${intakes.length === 1 ? 'intake' : 'intakes'}`;
  const root = $('#intakeQueue');
  root.replaceChildren();
  const list = document.createElement('ul');
  list.className = 'plain-list';
  intakes.forEach(intake => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/operator/intakes/${intake.id}`;
    link.textContent = intake.company_name || 'Company intake';
    link.style.fontWeight = '750';
    const meta = document.createElement('p');
    const deadline = intake.deadline ? new Date(`${intake.deadline}T00:00:00`).toLocaleDateString() : 'No deadline';
    meta.textContent = `${intake.status.replaceAll('_', ' ')} · ${deadline} · submitted ${new Date(intake.submitted_at).toLocaleString()}`;
    item.append(link, meta);
    list.append(item);
  });
  if (!intakes.length) {
    const item = document.createElement('li');
    item.innerHTML = '<strong>No submitted company intakes.</strong><p>New authenticated company submissions will appear here.</p>';
    list.append(item);
  }
  root.append(list);
}

async function load() {
  const result = await request('?action=operator-intakes');
  render(result.intakes || []);
}

$('#queueLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request-link',
        email: event.currentTarget.elements.email.value,
        redirectPath: '/operator/intakes',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not request a sign-in link.');
    showMessage('Check your email for a secure operator sign-in link.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

const authError = captureAuth();
if (authError) showMessage(authError, true);
else if (token()) load().catch(error => showMessage(error.message, true));
