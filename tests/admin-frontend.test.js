import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../admin.css', import.meta.url), 'utf8');

test('operator inbox has passwordless sign-in and a complete review surface', () => {
  assert.match(html, /Private operator inbox/);
  assert.match(html, /id="adminLoginForm"/);
  assert.match(html, /COVENDA_ADMIN_EMAILS/);
  assert.match(html, /custom SMTP/);
  assert.match(html, /id="adminRows"/);
  assert.match(html, /id="adminDetail"/);
  assert.match(html, /Students/);
  assert.match(html, /Companies/);
  assert.match(html, /Universities/);
  assert.match(html, /Referral endorsements/);
  assert.match(html, /Trusted Talent access/);
  assert.match(html, /id="adminMetricReceived"/);
  assert.match(html, /id="adminRefresh"/);
  assert.match(html, /id="adminSort"/);
  assert.match(html, /id="adminResultsCount"/);
  assert.match(script, /sessionStorage/);
  assert.match(script, /result\.requestId/);
  assert.match(script, /Authorization: `Bearer/);
  assert.match(script, /renderDetail/);
  assert.match(script, /method:'PATCH'/);
  assert.match(script, /updateQueueSummary/);
  assert.match(script, /attentionOrder/);
  assert.match(script, /No matching submission/);
  assert.match(script, /rows\.find\(item => item\.reference === selectedReference\)/);
  assert.match(script, /loadInbox\(\{ announce:true \}\)/);
  assert.match(script, /Operator workspace/);
  assert.match(script, /internal_note/);
  assert.match(script, /follow_up_at/);
  assert.match(script, /Save operator update/);
  assert.match(script, /Referral source/);
  assert.match(script, /Roles or skills/);
  assert.match(styles, /\.admin-main/);
  assert.match(styles, /\.admin-detail/);
  assert.match(styles, /\.admin-summary/);
  assert.match(styles, /\.detail-workflow/);
});

test('operator UI stays code-native and contains no server credentials', () => {
  assert.doesNotMatch(html + script, /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/i);
  assert.doesNotMatch(script, /innerHTML\s*=/);
  assert.match(script, /textContent/);
  assert.match(html, /noindex,nofollow/);
});

test('admin HTML ids are unique and mobile layout is explicit', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /tbody tr/);
});
