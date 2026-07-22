import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import handler, {
  callRecord,
  employerReadiness,
  employerRecord,
  employerRevisionReference,
  notifyOperator,
  networkAccessRecord,
  operatorNotification,
  partnerAffiliationMatch,
  persistSubmission,
  postgresConfiguration,
  primaryStorageHealth,
  REFERENCE_PREFIXES,
  referrerRecord,
  studentRecord,
  submissionDetails,
  submissionRow,
  SUBMISSION_TYPES,
  supabaseConfiguration,
  supabaseDestination,
  universityRecord,
  verifyPartnerAffiliation,
} from '../api/submissions.js';

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
    subIndustries: ['Reconciliations & close prep'],
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

function employerSubmissionRecord() {
  const details = employerRecord(validEmployer);
  return {
    schemaVersion: 6,
    reference: 'EMP-QA2026',
    type: 'employer_intake',
    source: 'covenda-web',
    createdAt: '2026-07-21T12:00:00.000Z',
    status: 'received',
    consent: true,
    details,
    readiness: employerReadiness(details),
  };
}

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

test('company revision lineage accepts only bounded employer references', () => {
  assert.equal(employerRevisionReference('emp-qa2026'), 'EMP-QA2026');
  assert.equal(employerRevisionReference(''), '');
  assert.throws(() => employerRevisionReference('STU-QA2026'), /valid company submission reference/i);
  assert.throws(() => employerRevisionReference('../EMP-QA2026'), /valid company submission reference/i);
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
  assert.deepEqual(record.interests.subIndustries, ['Reconciliations & close prep']);
  assert.deepEqual(record.skills, [{ name: 'Spreadsheets', level: 'Comfortable' }]);
  assert.equal(record.links.portfolio, 'https://example.edu/work');
});

test('studentRecord requires a real skill claim and project preferences', () => {
  const incomplete = structuredClone(validStudent);
  incomplete.skills = [];
  assert.throws(() => studentRecord(incomplete), /at least one skill/i);
});

test('studentRecord keeps an optional video intro link and transcript', () => {
  const withVideo = structuredClone(validStudent);
  withVideo.links = { ...validStudent.links, videoIntro: 'https://www.loom.com/share/abc123def456' };
  withVideo.videoTranscript = 'Hi, I am Jordan — a quick hello and what I want to prove.';
  const record = studentRecord(withVideo);
  assert.equal(record.links.videoIntro, 'https://www.loom.com/share/abc123def456');
  assert.equal(record.videoTranscript, 'Hi, I am Jordan — a quick hello and what I want to prove.');
});

test('studentRecord stays valid with no video intro (optional)', () => {
  const record = studentRecord(validStudent);
  assert.equal(record.links.videoIntro, '');
  assert.equal(record.videoTranscript, '');
});

test('studentRecord rejects a non-http video intro link', () => {
  const badVideo = structuredClone(validStudent);
  badVideo.links = { ...validStudent.links, videoIntro: 'ftp://sketchy.example/video' };
  assert.throws(() => studentRecord(badVideo), /valid HTTP or HTTPS/i);
});

test('studentRecord captures an optional partner referral attribution', () => {
  const referred = structuredClone(validStudent);
  referred.referral = { code: 'REF-AB12CD', via: 'Riverton University · Robotics Lab', verified: true };
  referred.affiliation = {
    referrerName: 'Professor Rivera',
    organization: 'Riverton University · Robotics Lab',
    referralCode: 'REF-AB12CD',
    verified: true,
  };
  const record = studentRecord(referred);
  assert.equal(record.referral.code, 'REF-AB12CD');
  assert.equal(record.referral.via, 'Riverton University · Robotics Lab');
  assert.equal(record.referral.verified, false);
  assert.equal(record.affiliation.verified, false);
  assert.equal(record.affiliation.verificationStatus, 'pending verification');
});

test('studentRecord stays valid with no referral (optional, defaults to empty)', () => {
  const record = studentRecord(validStudent);
  assert.equal(record.referral.code, '');
  assert.equal(record.referral.via, '');
  assert.equal(record.affiliation.verificationStatus, 'not provided');
});

test('partner affiliation matching accepts only approved and founder-confirmed records', () => {
  const rows = [
    {
      reference: 'REF-APPROVED1',
      submission_type: 'referrer_endorsement',
      status: 'approved',
      partner_verified: true,
      organization_name: 'Riverton Robotics Lab',
      details: { attributionCode: 'REF-AB12CD' },
    },
    {
      reference: 'UNI-PENDING1',
      submission_type: 'university_partner',
      status: 'received',
      organization_name: 'Pending University',
      details: {},
    },
    {
      reference: 'UNI-APPROVED2',
      submission_type: 'university_partner',
      status: 'approved',
      partner_verified: false,
      organization_name: 'Approved But Unconfirmed University',
      details: {},
    },
  ];
  assert.equal(partnerAffiliationMatch(rows, { code: 'ref-ab12cd' }), true);
  assert.equal(partnerAffiliationMatch(rows, { organization: 'Riverton Robotics Lab' }), true);
  assert.equal(partnerAffiliationMatch(rows, { organization: 'Pending University' }), false);
  assert.equal(partnerAffiliationMatch(rows, { organization: 'Approved But Unconfirmed University' }), false);
});

test('partner verification uses a server secret and fails closed to pending', async () => {
  const calls = [];
  const verified = await verifyPartnerAffiliation({ code: 'REF-AB12CD' }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient(url, secret, options) {
      assert.equal(url, 'https://project.supabase.co');
      assert.equal(secret, 'sb_secret_test');
      assert.equal(options.auth.persistSession, false);
      return {
        from(table) {
          calls.push(['from', table]);
          return {
            select(columns) {
              calls.push(['select', columns]);
              return {
                eq(column, value) {
                  calls.push(['eq', column, value]);
                  return {
                    in(inColumn, values) {
                      calls.push(['in', inColumn, values]);
                      return {
                        async limit(valueLimit) {
                          calls.push(['limit', valueLimit]);
                          return { data: [{
                            reference: 'REF-RECORD1',
                            submission_type: 'referrer_endorsement',
                            status: 'approved',
                            partner_verified: true,
                            organization_name: 'Riverton Robotics Lab',
                            details: { attributionCode: 'REF-AB12CD' },
                          }], error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  });
  assert.deepEqual(verified, { verified: true, verificationStatus: 'verified' });
  assert.deepEqual(calls[0], ['from', 'submissions']);

  const unavailable = await verifyPartnerAffiliation({ organization: 'Any Lab' }, { env: {} });
  assert.deepEqual(unavailable, { verified: false, verificationStatus: 'pending verification' });
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

test('API accepted types + reference prefixes stay in sync with the DB migration', () => {
  // Guardrail for the Point-1 bug class: the API must never accept a type (or
  // mint a reference prefix) that the database's constraints would reject.
  // Read the most recent migration that (re)defines the full allowed set.
  const migration = readFileSync(
    new URL('../supabase/migrations/20260726000000_trusted_talent_network.sql', import.meta.url),
    'utf8',
  );

  // Every type the API accepts must appear in the type-allowed constraint.
  for (const type of SUBMISSION_TYPES) {
    assert.match(migration, new RegExp(`'${type}'`), `migration is missing submission type: ${type}`);
  }

  // Every reference prefix the API mints must be in the reference-format regex,
  // e.g. ^(EMP|STU|CALL|UNI)-[A-Z0-9]{6,20}$
  const allowedPrefixes = migration.match(/\^\(([A-Z|]+)\)-/)?.[1]?.split('|') ?? [];
  for (const type of SUBMISSION_TYPES) {
    assert.ok(
      allowedPrefixes.includes(REFERENCE_PREFIXES[type]),
      `migration reference format is missing prefix ${REFERENCE_PREFIXES[type]} (for ${type})`,
    );
  }
});

test('network access requests require a company contact and a meaningful reason', () => {
  const record = networkAccessRecord({
    contact: { name: 'Avery Owner', email: 'avery@example.com', company: 'Strength Robotics' },
    reason: 'We need students referred by robotics labs who can test a changing hardware workflow.',
    rolesNeeded: ['Robotics', 'QA testing', 'Robotics'],
    hiringTimeline: 'Within one month',
  });
  assert.equal(record.contact.company, 'Strength Robotics');
  assert.deepEqual(record.rolesNeeded, ['Robotics', 'QA testing']);
  assert.equal(record.stage, 'access_requested');
  assert.throws(() => networkAccessRecord({
    contact: { name: 'Avery', email: 'avery@example.com', company: 'Strength Robotics' },
    reason: 'Too short',
  }), /describe the kind of student talent/i);
});

test('referrerRecord keeps validated endorsements and requires a referrer role', () => {
  const record = referrerRecord({
    type: 'referrer_endorsement',
    contact: { name: 'Dr. Rivera', email: 'rivera@school.edu', company: 'Example University' },
    referrerType: 'Professor',
    attributionCode: 'ROBOTICS-PILOT',
    endorsements: [
      { name: 'Jordan Lee', email: 'jordan@school.edu', function: 'Robotics', note: 'Top of my lab.' },
      { name: 'No Email', email: 'not-an-email', function: 'Ops' },
    ],
  });
  assert.equal(record.contact.company, 'Example University');
  assert.equal(record.referrerType, 'Professor');
  assert.equal(record.attributionCode, 'ROBOTICS-PILOT');
  assert.equal(record.endorsements.length, 1);
  assert.deepEqual(record.endorsements[0], { name: 'Jordan Lee', email: 'jordan@school.edu', function: 'Robotics', note: 'Top of my lab.' });
});

test('referrerRecord requires a role and at least one valid endorsement', () => {
  const base = {
    type: 'referrer_endorsement',
    contact: { name: 'Dr. Rivera', email: 'rivera@school.edu', company: 'Example University' },
    referrerType: 'Professor',
    endorsements: [{ name: 'Jordan Lee', email: 'jordan@school.edu', function: 'Robotics' }],
  };
  assert.throws(() => referrerRecord({ ...base, referrerType: '' }), /professor, club, or career center/i);
  assert.throws(() => referrerRecord({ ...base, endorsements: [] }), /at least one student/i);
});

test('universityRecord keeps a validated student roster and drops invalid rows', () => {
  const record = universityRecord({
    type: 'university_partner',
    contact: { name: 'Dana Advisor', email: 'dana@school.edu', company: 'Example University' },
    organizationType: 'University / department',
    roster: [
      { name: 'Jordan Lee', email: 'jordan@school.edu', interest: 'Research' },
      { name: 'No Email', email: 'not-an-email', interest: 'Operations' },
      { name: '', email: 'blank@school.edu', interest: 'Research' },
    ],
  });
  assert.equal(record.contact.company, 'Example University');
  assert.equal(record.roster.length, 1);
  assert.deepEqual(record.roster[0], { name: 'Jordan Lee', email: 'jordan@school.edu', interest: 'Research' });
});

test('universityRecord requires an organization type and at least one student', () => {
  const base = {
    type: 'university_partner',
    contact: { name: 'Dana Advisor', email: 'dana@school.edu', company: 'Example University' },
    organizationType: 'Career center',
    roster: [{ name: 'Jordan Lee', email: 'jordan@school.edu', interest: 'Research' }],
  };
  assert.throws(() => universityRecord({ ...base, roster: [] }), /at least one student/i);
  assert.throws(() => universityRecord({ ...base, organizationType: '' }), /organization type/i);
});

test('submissionRow maps a private intake into queryable database fields', () => {
  const row = submissionRow(employerSubmissionRecord());
  assert.equal(row.reference, 'EMP-QA2026');
  assert.equal(row.submission_type, 'employer_intake');
  assert.equal(row.submitter_email, 'avery@example.com');
  assert.equal(row.organization_name, 'Example Accounting');
  assert.equal(row.summary, 'Current-state map and checklist');
  assert.equal(row.ready_count, 6);
  assert.equal(row.readiness_total, 6);
  assert.equal(row.details.project.systemAccess, 'none');
});

test('submissionRow maps a university roster into queryable database fields', () => {
  const details = universityRecord({
    type: 'university_partner',
    contact: { name: 'Dana Advisor', email: 'dana@school.edu', company: 'Example University' },
    organizationType: 'Career center',
    roster: [
      { name: 'Jordan Lee', email: 'jordan@school.edu', interest: 'Research' },
      { name: 'Priya Shah', email: 'priya@school.edu', interest: 'Operations' },
    ],
  });
  const reference = 'UNI-ABC123';
  assert.match(reference, /^UNI-[A-Z0-9]{6,20}$/);
  const row = submissionRow({
    schemaVersion: 6,
    reference,
    type: 'university_partner',
    source: 'covenda-web',
    createdAt: '2026-07-21T12:00:00.000Z',
    status: 'received',
    consent: true,
    details,
  });
  assert.equal(row.submission_type, 'university_partner');
  assert.equal(row.submitter_email, 'dana@school.edu');
  assert.equal(row.organization_name, 'Example University');
  assert.equal(row.consent, true);
  assert.equal(row.details.roster.length, 2);
  assert.equal(row.details.roster[0].email, 'jordan@school.edu');
  assert.match(row.summary, /2 students/);
});

test('Supabase configuration accepts Vercel integration variable names', () => {
  assert.deepEqual(supabaseConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: 'https://integration.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  }), {
    url: 'https://integration.supabase.co',
    secret: 'sb_secret_test',
  });
  assert.equal(supabaseConfiguration({ NEXT_PUBLIC_SUPABASE_URL: 'https://integration.supabase.co' }), null);
});

test('Supabase destination safely identifies the operator inbox', () => {
  assert.deepEqual(supabaseDestination('https://covenda-project.supabase.co'), {
    provider: 'supabase',
    projectRef: 'covenda-project',
    table: 'public.submissions',
  });
  assert.deepEqual(supabaseDestination('not a url'), {
    provider: 'supabase',
    projectRef: '',
    table: 'public.submissions',
  });
});

test('persistSubmission prefers Supabase when the server secret is configured', async () => {
  let insertedTable = '';
  let insertedRow;
  let blobCalled = false;
  const result = await persistSubmission(employerSubmissionRecord(), {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient(url, secret, options) {
      assert.equal(url, 'https://project.supabase.co');
      assert.equal(secret, 'sb_secret_test');
      assert.equal(options.auth.persistSession, false);
      return {
        from(table) {
          insertedTable = table;
          return {
            async insert(row) {
              insertedRow = row;
              return { error: null };
            },
          };
        },
      };
    },
    async putBlob() { blobCalled = true; },
  });
  assert.equal(result.backend, 'supabase');
  assert.equal(result.route, 'data-api');
  assert.equal(insertedTable, 'submissions');
  assert.equal(insertedRow.reference, 'EMP-QA2026');
  assert.equal(blobCalled, false);
});

test('Postgres configuration uses the server-only Vercel integration URL', () => {
  assert.equal(postgresConfiguration({ POSTGRES_URL: 'postgres://pooled.example/db' }), 'postgres://pooled.example/db');
  assert.equal(postgresConfiguration({ DATABASE_URL: 'postgres://fallback.example/db' }), 'postgres://fallback.example/db');
  assert.equal(postgresConfiguration({}), '');
});

test('persistSubmission reaches the Supabase table through Postgres when the Data API fails', async () => {
  let directRecord;
  let directUrl;
  let blobCalled = false;
  const result = await persistSubmission(employerSubmissionRecord(), {
    env: {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      POSTGRES_URL: 'postgres://pooled.example/db',
    },
    createSupabaseClient() {
      return { from: () => ({ insert: async () => ({ error: { code: '42501', message: 'permission denied' } }) }) };
    },
    async insertPostgresRecord(record, { connectionString }) {
      directRecord = record;
      directUrl = connectionString;
      return { backend: 'supabase', route: 'postgres' };
    },
    async putBlob() { blobCalled = true; },
    logger: { error() {} },
  });
  assert.equal(result.backend, 'supabase');
  assert.equal(result.route, 'postgres');
  assert.equal(directRecord.reference, 'EMP-QA2026');
  assert.equal(directUrl, 'postgres://pooled.example/db');
  assert.equal(blobCalled, false);
});

test('primary storage health prefers the Data API without exposing submission data', async () => {
  const health = await primaryStorageHealth({
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient() {
      return {
        from(table) {
          assert.equal(table, 'submissions');
          return {
            async select(column, options) {
              assert.match(column, /^reference,submission_type,status,source,/);
              assert.match(column, /details,readiness,consent,created_at,updated_at$/);
              assert.deepEqual(options, { head: true, count: 'exact' });
              return { error: null };
            },
          };
        },
      };
    },
  });
  assert.deepEqual(health, {
    status: 'ready',
    route: 'data-api',
    destination: {
      provider: 'supabase',
      projectRef: 'project',
      table: 'public.submissions',
    },
  });
});

test('persistSubmission falls back to private Blob storage if Supabase is unavailable', async () => {
  let blobPath = '';
  let blobBody = '';
  let blobOptions;
  const result = await persistSubmission(employerSubmissionRecord(), {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient() {
      return { from: () => ({ insert: async () => ({ error: { message: 'temporary outage' } }) }) };
    },
    async putBlob(path, body, options) {
      blobPath = path;
      blobBody = body;
      blobOptions = options;
    },
    logger: { error() {} },
  });
  assert.equal(result.backend, 'blob');
  assert.equal(result.fallbackReason, 'supabase-write-failed');
  assert.match(blobPath, /^submissions\/employer_intake\/2026\/07\/21\/.+EMP-QA2026\.json$/);
  assert.equal(JSON.parse(blobBody).reference, 'EMP-QA2026');
  assert.equal(blobOptions.access, 'private');
});

test('persistSubmission also falls back when the database client throws', async () => {
  let stored = false;
  const result = await persistSubmission(employerSubmissionRecord(), {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient() { throw new Error('network failure'); },
    async putBlob() { stored = true; },
    logger: { error() {} },
  });
  assert.equal(result.backend, 'blob');
  assert.equal(stored, true);
});

test('persistSubmission keeps Blob as the default before Supabase is connected', async () => {
  let stored = false;
  const result = await persistSubmission(employerSubmissionRecord(), {
    env: {},
    createSupabaseClient() { throw new Error('Supabase should not be called'); },
    async putBlob() { stored = true; },
    logger: { warn() {} },
  });
  assert.equal(result.backend, 'blob');
  assert.equal(result.fallbackReason, 'supabase-not-configured');
  assert.equal(stored, true);
});

test('operator email includes a secure reference but excludes private form answers', () => {
  const notification = operatorNotification(employerSubmissionRecord(), {
    to: 'ops@covenda.example',
    from: 'Covenda <submissions@covenda.example>',
    adminUrl: 'https://admin.covenda.example/submissions',
  });
  assert.match(notification.subject, /EMP-QA2026/);
  assert.match(notification.text, /Project Packet readiness: 6\/6/);
  assert.match(notification.text, /https:\/\/admin\.covenda\.example\/submissions/);
  assert.doesNotMatch(notification.text, /avery@example\.com/);
  assert.doesNotMatch(notification.html, /recurring onboarding backlog/i);
  assert.doesNotMatch(notification.html, /Current-state map and checklist/);
});

test('operator notification is optional and uses an idempotent send when enabled', async () => {
  const unconfigured = await notifyOperator(employerSubmissionRecord(), {
    env: {},
    createResendClient() { throw new Error('Email should not be called'); },
  });
  assert.deepEqual(unconfigured, { sent: false, reason: 'not-configured' });

  let sentPayload;
  let sendOptions;
  const configured = await notifyOperator(employerSubmissionRecord(), {
    env: {
      RESEND_API_KEY: 're_test',
      COVENDA_NOTIFICATION_EMAIL: 'ops@covenda.example',
      COVENDA_NOTIFICATION_FROM: 'Covenda <submissions@covenda.example>',
    },
    createResendClient(apiKey) {
      assert.equal(apiKey, 're_test');
      return {
        emails: {
          async send(payload, options) {
            sentPayload = payload;
            sendOptions = options;
            return { data: { id: 'email_123' }, error: null };
          },
        },
      };
    },
  });
  assert.deepEqual(configured, { sent: true });
  assert.equal(sentPayload.to[0], 'ops@covenda.example');
  assert.equal(sendOptions.idempotencyKey, 'covenda-submission-emp-qa2026');
});

test('handler exposes safe delivery health and rejects unsupported or cross-origin requests', async () => {
  const healthResponse = responseRecorder();
  await handler({ method: 'GET', headers: {} }, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(healthResponse.body.ok, true);
  assert.ok(['ready', 'unavailable', 'not-configured'].includes(healthResponse.body.primary.status));
  assert.match(healthResponse.body.checkedAt, /^\d{4}-\d{2}-\d{2}T/);

  const methodResponse = responseRecorder();
  await handler({ method: 'PUT', headers: {} }, methodResponse);
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
