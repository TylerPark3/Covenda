import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanCode, summarizeCohort } from '../api/cohort.js';

test('cleanCode normalizes to an uppercase code token', () => {
  assert.equal(cleanCode(' ref-ab12cd '), 'REF-AB12CD');
  assert.equal(cleanCode('ref-<script>'), 'REF-SCRIPT');
  assert.equal(cleanCode(''), '');
});

test('summarizeCohort returns an honest empty cohort with no rows', () => {
  const cohort = summarizeCohort({ code: 'REF-ABC123' });
  assert.equal(cohort.endorsedCount, 0);
  assert.equal(cohort.appliedCount, 0);
  assert.equal(cohort.verifiedCount, 0);
  assert.equal(cohort.isEmpty, true);
  assert.deepEqual(cohort.industries, []);
});

test('summarizeCohort counts a real endorsed → applied → verified funnel without leaking PII', () => {
  const endorsementSubs = [
    { details: { contact: { company: 'Princeton Quant Club' }, endorsements: [
      { name: 'Ada', email: 'ada@x.edu', function: 'Accounting & finance' },
      { name: 'Grace', email: 'GRACE@x.edu', function: 'Accounting & finance' },
      { name: 'Kat', email: 'kat@x.edu', function: 'Software & AI' },
    ] } },
    // A duplicate email across submissions must not double-count.
    { details: { contact: { company: 'Princeton Quant Club' }, endorsements: [
      { name: 'Ada again', email: 'ada@x.edu', function: 'Accounting & finance' },
    ] } },
  ];
  const codedApplications = [
    { student_user_id: 'u-ada', project_id: 'p1' },
    { student_user_id: 'u-grace', project_id: 'p2' },
    { student_user_id: 'u-ada', project_id: 'p3' }, // same student twice → one applicant
  ];
  const completedStudentIds = new Set(['u-ada']);
  const cohort = summarizeCohort({ code: 'REF-ABC123', endorsementSubs, codedApplications, completedStudentIds });

  assert.equal(cohort.orgName, 'Princeton Quant Club');
  assert.equal(cohort.endorsedCount, 3, 'distinct emails, case-insensitive, deduped across submissions');
  assert.equal(cohort.appliedCount, 2, 'distinct applicant students');
  assert.equal(cohort.verifiedCount, 1, 'applicants with a completed project');
  assert.equal(cohort.isEmpty, false);
  // Industry mix is aggregate counts only — no names or emails in the output.
  const serialized = JSON.stringify(cohort);
  assert.ok(!serialized.includes('@x.edu'), 'no emails leak into the public payload');
  assert.ok(!serialized.includes('Ada'), 'no student names leak into the public payload');
  const finance = cohort.industries.find(i => i.label === 'Accounting & finance');
  assert.equal(finance.count, 3);
  assert.equal(cohort.funnel[0].count, 3);
  assert.equal(cohort.funnel[2].count, 1);
});

test('summarizeCohort counts distinct referred firms (GTM Move 3) without leaking PII', () => {
  const employerSubs = [
    { details: { referral: { code: 'REF-ABC123' }, contact: { email: 'cfo@acme.com', company: 'Acme LLC' } } },
    // Same firm submits twice → one firm.
    { details: { referral: { code: 'REF-ABC123' }, contact: { email: 'CFO@acme.com' } } },
    { details: { referral: { code: 'REF-ABC123' } }, submitter_email: 'owner@beta.co' },
  ];
  const cohort = summarizeCohort({ code: 'REF-ABC123', employerSubs });
  assert.equal(cohort.referredFirms, 2, 'distinct firm emails, case-insensitive');
  assert.equal(cohort.payingFirms, 0, 'no paying set → zero');
  assert.equal(cohort.isEmpty, false, 'a referred firm alone makes the cohort non-empty');
  const serialized = JSON.stringify(cohort);
  assert.ok(!serialized.includes('acme.com') && !serialized.includes('Acme LLC'), 'no firm PII in the public payload');
});

test('summarizeCohort counts referred firms that became paying clients', () => {
  const employerSubs = [
    { details: { referral: { code: 'REF-ABC123' }, contact: { email: 'cfo@acme.com' } } },
    { details: { referral: { code: 'REF-ABC123' } }, submitter_email: 'owner@beta.co' },
  ];
  // acme paid; beta didn't. Case-insensitive match.
  const payingFirmEmails = new Set(['cfo@acme.com', 'someone@else.com']);
  const cohort = summarizeCohort({ code: 'REF-ABC123', employerSubs, payingFirmEmails });
  assert.equal(cohort.referredFirms, 2);
  assert.equal(cohort.payingFirms, 1, 'only the referred firm that also paid counts');
});
