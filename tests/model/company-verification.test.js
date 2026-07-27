import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCompanyEmail, domainMatchesCompany, registrableDomain,
  companyVerificationStanding, domainOf,
} from '../../api/company-verification.js';

test('consumer mailboxes are refused with a reason a person can act on', () => {
  for (const email of ['founder@gmail.com', 'a@yahoo.co.uk', 'x@icloud.com', 'y@proton.me']) {
    const r = classifyCompanyEmail(email);
    assert.equal(r.ok, false, email);
    assert.equal(r.code, 'consumer', email);
    assert.match(r.reason, /work email/i);
  }
});

test('disposable providers are refused, including ones not on the list', () => {
  assert.equal(classifyCompanyEmail('a@mailinator.com').code, 'disposable');
  assert.equal(classifyCompanyEmail('a@10minutemail.com').code, 'disposable');
  // The shape is caught even when the exact domain is unknown — new ones appear constantly.
  assert.equal(classifyCompanyEmail('a@tempmailbox-xyz.io').code, 'disposable');
  assert.equal(classifyCompanyEmail('a@burnerthing.net').code, 'disposable');
});

// A student on the wrong tab is the common case, and a generic rejection would strand them.
test('a school address is sent to the student tab, not just rejected', () => {
  const r = classifyCompanyEmail('someone@columbia.edu');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'academic');
  assert.match(r.reason, /student tab/i);
});

test('a real corporate address passes', () => {
  for (const email of ['tyler@covenda.app', 'a@acme.co.uk', 'dev@some-startup.io']) {
    const r = classifyCompanyEmail(email);
    assert.equal(r.ok, true, email);
    assert.equal(r.code, 'corporate');
  }
});

test('malformed and empty input are distinguished from each other', () => {
  assert.equal(classifyCompanyEmail('').code, 'empty');
  assert.equal(classifyCompanyEmail('not-an-email').code, 'malformed');
  assert.equal(classifyCompanyEmail('a@b').code, 'malformed');
});

test('subdomains resolve to one company, including two-level TLDs', () => {
  assert.equal(registrableDomain('mail.acme.com'), 'acme.com');
  assert.equal(registrableDomain('smtp.eu.acme.co.uk'), 'acme.co.uk');
  assert.equal(registrableDomain('acme.io'), 'acme.io');
  assert.equal(domainOf('Person@Mail.ACME.com'), 'mail.acme.com');
});

// Advisory, never a gate: plenty of real companies mail from a domain unrelated to the name.
test('a domain that does not match the company name is flagged, not blocked', () => {
  const strong = domainMatchesCompany('a@covenda.app', 'Covenda');
  assert.equal(strong.match, true);
  assert.equal(strong.confidence, 'strong');

  const miss = domainMatchesCompany('a@getbravo.io', 'Northwind Robotics');
  assert.equal(miss.match, false);
  assert.match(miss.note, /not a problem/i);
});

test('the domain being a word of the name is strong; a shared stem is only partial', () => {
  // The distinctive word of the name, used outright as the domain.
  const strong = domainMatchesCompany('a@northwind.io', 'Northwind Robotics Inc');
  assert.equal(strong.confidence, 'strong');
  // A stem of that word, which is suggestive but much weaker.
  const partial = domainMatchesCompany('a@wind.io', 'Northwind Robotics');
  assert.equal(partial.match, true);
  assert.equal(partial.confidence, 'partial');
});

// The whole point of the module: state what the signal does NOT establish, next to what it does.
test('a confirmed work email never claims authority to hire or sign', () => {
  const held = companyVerificationStanding({ emailVerifiedAt: '2026-07-26T00:00:00Z', domain: 'acme.com' });
  const signal = held.signals.find(s => s.key === 'work_email');
  assert.equal(signal.held, true);
  assert.match(signal.doesNotProve, /authorised to hire|sign|speak for/i);
  assert.equal(signal.strength, 'floor');
  // Never described as a verified company.
  assert.doesNotMatch(held.summary, /verified company/i);
  assert.match(held.summary, /not a covenda endorsement/i);
});

test('an unverified company cannot post work', () => {
  assert.equal(companyVerificationStanding({}).canPostWork, false);
  assert.equal(companyVerificationStanding({ emailVerifiedAt: 'x' }).canPostWork, true);
});

test('colleagues on a domain prove only that, and say so', () => {
  const s = companyVerificationStanding({ emailVerifiedAt: 'x', domain: 'acme.com', teamVerifiedCount: 3 });
  const colleagues = s.signals.find(x => x.key === 'colleagues');
  assert.equal(colleagues.held, true);
  assert.match(colleagues.doesNotProve, /anything about the company itself/i);
});
