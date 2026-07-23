import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applicationReceivedEmail, applicationDecisionEmail, payoutRequestedEmail,
  notifyMember, notifyOperatorEvent,
} from '../api/notify.js';

test('applicationReceivedEmail addresses the owner with the project + applicant', () => {
  const email = applicationReceivedEmail({ to: 'co@x.com', from: 'hello@covenda.app', projectTitle: 'Pricing scan', studentName: 'Ada', portalUrl: 'https://covenda.app/portal.html' });
  assert.deepEqual(email.to, ['co@x.com']);
  assert.match(email.subject, /Pricing scan/);
  assert.match(email.html, /Ada/);
  assert.match(email.html, /portal\.html/);
});

test('applicationDecisionEmail differs by outcome', () => {
  const yes = applicationDecisionEmail({ to: 's@x.com', from: 'h@c.app', projectTitle: 'Pricing scan', accepted: true });
  const no = applicationDecisionEmail({ to: 's@x.com', from: 'h@c.app', projectTitle: 'Pricing scan', accepted: false });
  assert.match(yes.subject, /You're in/);
  assert.match(no.subject, /Update on your application/);
  assert.notEqual(yes.html, no.html);
});

test('payoutRequestedEmail is tagged as operator mail', () => {
  const email = payoutRequestedEmail({ to: 'ops@covenda.app', from: 'h@c.app', memberName: 'Grace', credits: 120, method: 'PayPal' });
  assert.match(email.subject, /120 credits/);
  assert.ok(email.tags.some(t => t.name === 'kind' && t.value === 'operator'));
});

function fakeSupabase({ email = 'user@x.com', optOut = false } = {}) {
  return {
    auth: { admin: { getUserById: async () => ({ data: { user: { email } } }) } },
    from() {
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { email_opt_out: optOut }, error: null }) };
    },
  };
}

test('notifyMember no-ops when Resend is not configured', async () => {
  let sends = 0;
  const out = await notifyMember(fakeSupabase(), {
    toUserId: 'u1', build: () => ({}), env: {},
    createResendClient: () => ({ emails: { send: async () => { sends += 1; return { error: null }; } } }),
  });
  assert.equal(out.sent, false);
  assert.equal(out.reason, 'not-configured');
  assert.equal(sends, 0);
});

test('notifyMember respects a member opt-out', async () => {
  let sends = 0;
  const out = await notifyMember(fakeSupabase({ optOut: true }), {
    toUserId: 'u1', build: () => ({ from: 'a', to: ['b'], subject: 's', text: 't', html: 'h' }),
    env: { RESEND_API_KEY: 'k', COVENDA_NOTIFICATION_FROM: 'h@c.app' },
    createResendClient: () => ({ emails: { send: async () => { sends += 1; return { error: null }; } } }),
  });
  assert.equal(out.sent, false);
  assert.equal(out.reason, 'opted-out');
  assert.equal(sends, 0);
});

test('notifyMember sends when configured, opted-in, and a real email resolves', async () => {
  let payload = null;
  const out = await notifyMember(fakeSupabase({ email: 'real@x.com' }), {
    toUserId: 'u1', idempotencyKey: 'key-1',
    build: ({ to, from, portalUrl }) => ({ from, to: [to], subject: `hi ${portalUrl}`, text: 't', html: 'h' }),
    env: { RESEND_API_KEY: 'k', COVENDA_NOTIFICATION_FROM: 'h@c.app', COVENDA_SITE_URL: 'https://covenda.app' },
    createResendClient: () => ({ emails: { send: async (p, opts) => { payload = { p, opts }; return { error: null }; } } }),
  });
  assert.equal(out.sent, true);
  assert.deepEqual(payload.p.to, ['real@x.com']);
  assert.match(payload.p.subject, /portal\.html/);
  assert.equal(payload.opts.idempotencyKey, 'key-1');
});

test('notifyMember reports a missing email without throwing', async () => {
  const out = await notifyMember(fakeSupabase({ email: '' }), {
    toUserId: 'u1', build: () => ({ from: 'a', to: ['b'], subject: 's', text: 't', html: 'h' }),
    env: { RESEND_API_KEY: 'k', COVENDA_NOTIFICATION_FROM: 'h@c.app' },
    createResendClient: () => ({ emails: { send: async () => ({ error: null }) } }),
  });
  assert.equal(out.sent, false);
  assert.equal(out.reason, 'no-email');
});

test('notifyOperatorEvent needs a configured operator inbox', async () => {
  const off = await notifyOperatorEvent({ build: () => ({}), env: {} });
  assert.equal(off.reason, 'not-configured');
  let sent = false;
  const on = await notifyOperatorEvent({
    build: ({ to, from, adminUrl }) => ({ from, to: [to], subject: `s ${adminUrl}`, text: 't', html: 'h' }),
    env: { RESEND_API_KEY: 'k', COVENDA_NOTIFICATION_FROM: 'h@c.app', COVENDA_NOTIFICATION_EMAIL: 'ops@c.app', COVENDA_ADMIN_URL: 'https://covenda.app/admin.html' },
    createResendClient: () => ({ emails: { send: async () => { sent = true; return { error: null }; } } }),
  });
  assert.equal(on.sent, true);
  assert.equal(sent, true);
});
