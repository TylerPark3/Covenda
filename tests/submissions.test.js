import test from 'node:test';
import assert from 'node:assert/strict';

import handler, { callRecord, employerReadiness, employerRecord, studentRecord, submissionDetails } from '../api/submissions.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const validEmployer = {
  type: 'employer_intake',
  contact: { name: 'Avery Owner', email: 'avery@example.com', company: 'Example Accounting', role: 'Partner' },
  organization: {
    website: 'https://example.com',
    size: '6–20 people',
    industry: 'Accounting',
    reason: 'A recurring onboarding backlog is consuming partner time.',
    workFrequency: 'Every week',
  },
  project: {
    vertical: 'accounting',
    usefulBy: '2026-08-15',
    lastInstance: 'Five de-identified onboarding cases moved between email and workflow tools.',
    decisionSupported: 'Choose one handoff to redesign.',
    deliverable: 'Current-state map and checklist',
    reviewer: 'Operations lead',
    acceptance: 'All five cases are traceable to approved inputs.',
    reviewMinutes: 30,
    studentHours: '5–8 hours',
    internalHoursAvoided: 6,
    budget: 650,
    systemAccess: 'none',
    sources: { publicOrApproved: true, deidentified: true, clientRecords: false, restrictedJudgment: false },
    approvedContext: 'A glossary, redacted templates, and synthetic example.',
  },
};

const validStudent = {
  type: 'student_interest',
  contact: { name: 'Jordan Student', email: 'jordan@example.edu' },
  school: 'Example University',
  educationLevel: 'College sophomore',
  graduationYear: 2028,
  major: 'Accounting and information systems',
  timezone: 'Eastern',
  interest: 'Accounting operations, Research',
  interests: {
    workTypes: ['Accounting operations', 'Research'],
    industries: ['Accounting'],
    workStyle: 'Independent with clear checkpoints',
    ambiguityComfort: 'I can clarify an incomplete brief',
    avoid: '',
  },
  skills: [{ name: 'Spreadsheets', level: 'Comfortable' }],
  links: { portfolio: 'https://example.edu/work', github: '' },
  availability: 'Within 30 days',
  preferences: {
    hoursPerWeek: '6–10 hours',
    duration: 'Two weeks',
    minimumCompensation: '$300+',
    liveMeetings: 'Weekday evenings',
    screening: 'Yes',
    priorities: ['Pay', 'Employer feedback'],
    informationNeeded: 'Scope, pay, and reviewer.',
  },
  age18: true,
};

test('employerRecord accepts a bounded company problem', () => {
  const record = employerRecord(validEmployer);
  assert.equal(record.organization.website, 'https://example.com/');
  assert.equal(record.project.systemAccess, 'none');
  assert.equal(record.project.sources.clientRecords, false);
});

test('employer readiness reports scoping inputs without implying approval', () => {
  const readiness = employerReadiness(employerRecord(validEmployer));
  assert.deepEqual(readiness, {
    checks: { outcome: true, review: true, context: true, boundary: true, time: true, terms: true },
    readyCount: 6,
    total: 6,
  });

  const incomplete = structuredClone(validEmployer);
  incomplete.project.usefulBy = '';
  incomplete.project.internalHoursAvoided = 0;
  const incompleteReadiness = employerReadiness(employerRecord(incomplete));
  assert.equal(incompleteReadiness.readyCount, 4);
  assert.equal(incompleteReadiness.checks.time, false);
  assert.equal(incompleteReadiness.checks.terms, false);
});

test('employerRecord rejects unsafe access and records', () => {
  const unsafe = structuredClone(validEmployer);
  unsafe.project.systemAccess = 'production';
  unsafe.project.sources.clientRecords = true;
  assert.throws(() => employerRecord(unsafe), /remove client records, production access, and regulated decisions/i);
});

test('employerRecord rejects non-http company links', () => {
  const invalid = structuredClone(validEmployer);
  invalid.organization.website = 'javascript:alert(1)';
  assert.throws(() => employerRecord(invalid), /valid website URL/i);
});

test('studentRecord preserves structured interests, skills, and working terms', () => {
  const record = studentRecord(validStudent);
  assert.deepEqual(record.interests.workTypes, ['Accounting operations', 'Research']);
  assert.deepEqual(record.skills, [{ name: 'Spreadsheets', level: 'Comfortable' }]);
  assert.equal(record.links.portfolio, 'https://example.edu/work');
});

test('studentRecord requires a real skill claim and project preferences', () => {
  const incomplete = structuredClone(validStudent);
  incomplete.skills = [];
  assert.throws(() => studentRecord(incomplete), /at least one skill/i);
});

test('callRecord requires a dated call request', () => {
  const record = callRecord({
    contact: { name: 'Avery Owner', email: 'avery@example.com', company: 'Example Accounting' },
    topic: 'Recurring onboarding work',
    requestedDate: '2026-08-15',
    requestedTime: '11:00 AM',
    timezone: 'America/New_York',
  });
  assert.equal(record.requestedDate, '2026-08-15');
});

test('submissionDetails rejects unknown submission types', () => {
  assert.throws(() => submissionDetails({ type: 'admin_export' }), /valid submission type/i);
});

test('handler rejects non-POST and cross-origin requests before storage', async () => {
  const methodResponse = responseRecorder();
  await handler({ method: 'GET', headers: {} }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);

  const originResponse = responseRecorder();
  await handler({ method: 'POST', headers: { origin: 'https://attacker.example', host: 'proof-path.vercel.app' }, body: {} }, originResponse);
  assert.equal(originResponse.statusCode, 403);
});

test('handler absorbs honeypot submissions without writing a record', async () => {
  const response = responseRecorder();
  await handler({ method: 'POST', headers: { host: 'proof-path.vercel.app' }, body: { type: 'student_interest', website: 'spam.example' } }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.reference, 'RECEIVED');
});
