import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { Resend } from 'resend';

// Single source of truth for what the API accepts and the reference it mints.
// The Supabase migration constraints MUST allow exactly these — a test
// (tests/submissions.test.js) fails if the two ever drift apart, so a new
// audience can never pass the API and then get rejected by the database.
export const REFERENCE_PREFIXES = {
  employer_intake: 'EMP',
  student_interest: 'STU',
  call_request: 'CALL',
  university_partner: 'UNI',
};
export const SUBMISSION_TYPES = Object.keys(REFERENCE_PREFIXES);
const TYPES = new Set(SUBMISSION_TYPES);
const MAX_BODY_BYTES = 24_000;
const MIN_FORM_TIME_MS = 1_500;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 12;
const rateBuckets = new Map();

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function email(value) {
  const clean = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : '';
}

function webUrl(value, { required = false } = {}) {
  const clean = text(value, 500);
  if (!clean && !required) return '';
  try {
    const parsed = new URL(clean);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error(required ? 'Please provide a valid website URL.' : 'Please provide valid HTTP or HTTPS links.');
  }
}

function textArray(value, { maxItems = 10, maxLength = 120 } = {}) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function number(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function employerRevisionReference(value) {
  const clean = text(value, 40).toUpperCase();
  if (!clean) return '';
  if (!/^EMP-[A-Z0-9]{6,20}$/.test(clean)) throw new Error('Please provide a valid company submission reference for this revision.');
  return clean;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isRateLimited(req) {
  const now = Date.now();
  const rawAddress = text(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown', 200);
  const key = rawAddress.split(',')[0].trim() || 'unknown';
  const recent = (rateBuckets.get(key) || []).filter(timestamp => now - timestamp < RATE_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(key, recent);
  if (rateBuckets.size > 1_000) {
    for (const [address, timestamps] of rateBuckets) {
      if (!timestamps.some(timestamp => now - timestamp < RATE_WINDOW_MS)) rateBuckets.delete(address);
    }
  }
  return recent.length > RATE_LIMIT;
}

function contact(value = {}, { companyRequired = false } = {}) {
  const result = {
    name: text(value.name, 100),
    email: email(value.email),
    company: text(value.company, 140),
    role: text(value.role, 100),
  };
  if (!result.name || !result.email || (companyRequired && !result.company)) {
    throw new Error('Please provide the required contact details.');
  }
  return result;
}

export function employerRecord(body) {
  const organization = body.organization || {};
  const project = body.project || {};
  const sources = project.sources || {};
  const record = {
    contact: contact(body.contact, { companyRequired: true }),
    organization: {
      website: webUrl(organization.website, { required: true }),
      size: text(organization.size, 80),
      industry: text(organization.industry, 100),
      reason: text(organization.reason, 1_500),
      workFrequency: text(organization.workFrequency, 80),
    },
    project: {
      vertical: text(project.vertical, 40),
      usefulBy: text(project.usefulBy, 20),
      lastInstance: text(project.lastInstance, 2_500),
      decisionSupported: text(project.decisionSupported, 1_500),
      deliverable: text(project.deliverable, 500),
      reviewer: text(project.reviewer, 200),
      acceptance: text(project.acceptance, 800),
      reviewMinutes: number(project.reviewMinutes, 0, 240),
      studentHours: text(project.studentHours, 40),
      internalHoursAvoided: number(project.internalHoursAvoided, 0, 1_000),
      budget: number(project.budget, 0, 100_000),
      systemAccess: text(project.systemAccess, 40),
      sources: {
        publicOrApproved: sources.publicOrApproved === true,
        deidentified: sources.deidentified === true,
        clientRecords: sources.clientRecords === true,
        restrictedJudgment: sources.restrictedJudgment === true,
      },
      approvedContext: text(project.approvedContext, 2_000),
    },
  };
  if (!record.organization.size || !record.organization.industry || !record.organization.reason || !record.organization.workFrequency) {
    throw new Error('Please complete the company profile fields.');
  }
  if (!record.project.lastInstance || !record.project.decisionSupported || !record.project.deliverable || !record.project.reviewer || !record.project.acceptance) {
    throw new Error('Please complete the problem, output, reviewer, and acceptance fields.');
  }
  if (record.project.systemAccess === 'production' || record.project.sources.clientRecords || record.project.sources.restrictedJudgment) {
    throw new Error('Please remove client records, production access, and regulated decisions before sending.');
  }
  return record;
}

export function employerReadiness(record) {
  const project = record.project || {};
  const sources = project.sources || {};
  const netTime = project.internalHoursAvoided - (project.reviewMinutes / 60);
  const checks = {
    outcome: Boolean(project.deliverable && project.decisionSupported),
    review: Boolean(project.reviewer && project.acceptance),
    context: Boolean(project.approvedContext && (sources.publicOrApproved || sources.deidentified)),
    boundary: project.systemAccess === 'none' && !sources.clientRecords && !sources.restrictedJudgment,
    time: Number.isFinite(netTime) && project.internalHoursAvoided > 0 && netTime > 0,
    terms: Boolean(project.studentHours && project.usefulBy && Number.isFinite(project.budget) && project.budget > 0),
  };
  const readyCount = Object.values(checks).filter(Boolean).length;
  return { checks, readyCount, total: Object.keys(checks).length };
}

export function studentRecord(body) {
  const interests = body.interests || {};
  const links = body.links || {};
  const preferences = body.preferences || {};
  const skills = Array.isArray(body.skills)
    ? body.skills.slice(0, 12).map(skill => ({ name: text(skill?.name, 100), level: text(skill?.level, 80) })).filter(skill => skill.name && skill.level)
    : [];
  const record = {
    contact: contact(body.contact),
    school: text(body.school, 160),
    educationLevel: text(body.educationLevel, 80),
    graduationYear: number(body.graduationYear, 2026, 2035),
    major: text(body.major, 160),
    timezone: text(body.timezone, 80),
    interest: text(body.interest, 240),
    interests: {
      workTypes: textArray(interests.workTypes),
      industries: textArray(interests.industries),
      workStyle: text(interests.workStyle, 120),
      ambiguityComfort: text(interests.ambiguityComfort, 120),
      avoid: text(interests.avoid, 500),
    },
    skills,
    links: {
      portfolio: webUrl(links.portfolio),
      github: webUrl(links.github),
      videoIntro: webUrl(links.videoIntro),
    },
    videoTranscript: text(body.videoTranscript, 2_000),
    availability: text(body.availability, 80),
    preferences: {
      hoursPerWeek: text(preferences.hoursPerWeek, 80),
      duration: text(preferences.duration, 80),
      minimumCompensation: text(preferences.minimumCompensation, 80),
      liveMeetings: text(preferences.liveMeetings, 100),
      screening: text(preferences.screening, 100),
      priorities: textArray(preferences.priorities),
      informationNeeded: text(preferences.informationNeeded, 1_000),
    },
    age18: body.age18 === true,
  };
  if (!record.school || !record.educationLevel || record.graduationYear === null || !record.major || !record.timezone || !record.age18) {
    throw new Error('Please complete the student profile fields and confirm you are 18 or older.');
  }
  if (!record.interests.workTypes.length || !record.interests.industries.length || !record.interests.workStyle || !record.interests.ambiguityComfort) {
    throw new Error('Please complete the student interest fields.');
  }
  if (!record.skills.length) {
    throw new Error('Please add an honest level for at least one skill.');
  }
  if (!record.availability || !record.preferences.hoursPerWeek || !record.preferences.duration || !record.preferences.minimumCompensation || !record.preferences.liveMeetings || !record.preferences.screening || !record.preferences.priorities.length) {
    throw new Error('Please complete the student availability and project preference fields.');
  }
  return record;
}

export function universityRecord(body) {
  const roster = Array.isArray(body.roster)
    ? body.roster
        .slice(0, 200)
        .map(entry => ({
          name: text(entry?.name, 100),
          email: email(entry?.email),
          interest: text(entry?.interest, 60),
        }))
        .filter(entry => entry.name && entry.email)
    : [];
  const record = {
    contact: contact(body.contact, { companyRequired: true }),
    organizationType: text(body.organizationType, 80),
    roster,
  };
  if (!record.organizationType) {
    throw new Error('Please choose an organization type.');
  }
  if (!record.roster.length) {
    throw new Error('Please add at least one student with a name and a valid email.');
  }
  return record;
}

export function callRecord(body) {
  const record = {
    contact: contact(body.contact, { companyRequired: true }),
    topic: text(body.topic, 240),
    requestedDate: text(body.requestedDate, 10),
    requestedTime: text(body.requestedTime, 20),
    timezone: text(body.timezone, 100),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.requestedDate) || !record.requestedTime || !record.topic) {
    throw new Error('Please choose a preferred date and time.');
  }
  return record;
}

export function submissionDetails(body) {
  if (!TYPES.has(body.type)) throw new Error('Please choose a valid submission type.');
  if (body.type === 'employer_intake') return employerRecord(body);
  if (body.type === 'student_interest') return studentRecord(body);
  if (body.type === 'university_partner') return universityRecord(body);
  return callRecord(body);
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

function referenceFor(type) {
  const prefix = REFERENCE_PREFIXES[type];
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

function submissionSummary(record) {
  if (record.type === 'employer_intake') {
    return record.details.project.deliverable || 'Company problem submitted for scoping.';
  }
  if (record.type === 'student_interest') {
    return record.details.interests.workTypes.join(', ') || 'Student interest profile submitted.';
  }
  if (record.type === 'university_partner') {
    const count = record.details.roster.length;
    return `${count} student${count === 1 ? '' : 's'} shared for pilot matching.`;
  }
  return record.details.topic || 'Call requested.';
}

export function submissionRow(record) {
  const contactDetails = record.details.contact;
  return {
    reference: record.reference,
    submission_type: record.type,
    status: record.status,
    source: record.source,
    revision_of: record.revisionOf || null,
    submitter_name: contactDetails.name,
    submitter_email: contactDetails.email,
    organization_name: contactDetails.company || record.details.school || null,
    summary: submissionSummary(record),
    ready_count: record.readiness?.readyCount ?? null,
    readiness_total: record.readiness?.total ?? null,
    details: record.details,
    readiness: record.readiness || null,
    consent: record.consent,
    created_at: record.createdAt,
    updated_at: record.createdAt,
  };
}

export function supabaseConfiguration(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secret ? { url, secret } : null;
}

export function supabaseDestination(url) {
  if (!url) return { provider: 'supabase', projectRef: '', table: 'public.submissions' };
  try {
    const hostname = new URL(url).hostname;
    const projectRef = hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : hostname;
    return { provider: 'supabase', projectRef, table: 'public.submissions' };
  } catch {
    return { provider: 'supabase', projectRef: '', table: 'public.submissions' };
  }
}

export function postgresConfiguration(env) {
  return env.POSTGRES_URL || env.DATABASE_URL || '';
}

function storageErrorSummary(error) {
  return {
    code: error?.code || 'unknown',
    message: error?.message || 'Unknown storage error',
    hint: error?.hint || '',
  };
}

function submissionBlobPath(record) {
  const day = record.createdAt.slice(0, 10).replaceAll('-', '/');
  const stamp = record.createdAt.replace(/[-:.]/g, '').replace('Z', 'Z');
  return `submissions/${record.type}/${day}/${stamp}-${record.reference}.json`;
}

export async function insertPostgresSubmission(record, {
  connectionString,
  createPostgresClient = postgres,
} = {}) {
  if (!connectionString) throw new Error('Postgres is not configured.');
  const sql = createPostgresClient(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 2,
    connect_timeout: 6,
  });
  const row = submissionRow(record);
  try {
    await sql`
      insert into public.submissions (
        reference,
        submission_type,
        status,
        source,
        revision_of,
        submitter_name,
        submitter_email,
        organization_name,
        summary,
        ready_count,
        readiness_total,
        details,
        readiness,
        consent,
        created_at,
        updated_at
      ) values (
        ${row.reference},
        ${row.submission_type},
        ${row.status},
        ${row.source},
        ${row.revision_of},
        ${row.submitter_name},
        ${row.submitter_email},
        ${row.organization_name},
        ${row.summary},
        ${row.ready_count},
        ${row.readiness_total},
        ${sql.json(row.details)},
        ${row.readiness ? sql.json(row.readiness) : null},
        ${row.consent},
        ${row.created_at},
        ${row.updated_at}
      )
      on conflict (reference) do nothing
    `;
    return { backend: 'supabase', route: 'postgres' };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function primaryStorageHealth({
  env = process.env,
  createSupabaseClient = createClient,
  createPostgresClient = postgres,
} = {}) {
  const configuration = supabaseConfiguration(env);
  if (configuration) {
    try {
      const supabase = createSupabaseClient(configuration.url, configuration.secret, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const requiredColumns = [
        'reference',
        'submission_type',
        'status',
        'source',
        'revision_of',
        'submitter_name',
        'submitter_email',
        'organization_name',
        'summary',
        'ready_count',
        'readiness_total',
        'details',
        'readiness',
        'consent',
        'created_at',
        'updated_at',
      ].join(',');
      const { error } = await supabase.from('submissions').select(requiredColumns, { head: true, count: 'exact' });
      if (!error) {
        return {
          status: 'ready',
          route: 'data-api',
          destination: supabaseDestination(configuration.url),
        };
      }
    } catch {
      // The direct Postgres check below is the independent recovery path.
    }
  }

  const connectionString = postgresConfiguration(env);
  if (connectionString) {
    const sql = createPostgresClient(connectionString, {
      max: 1,
      prepare: false,
      idle_timeout: 2,
      connect_timeout: 6,
    });
    try {
      const rows = await sql`select to_regclass('public.submissions')::text as table_name`;
      if (rows[0]?.table_name === 'submissions') {
        return {
          status: 'ready',
          route: 'postgres',
          destination: supabaseDestination(configuration?.url),
        };
      }
    } catch {
      // Return the safe aggregate status below; never expose connection errors.
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  return {
    status: configuration || connectionString ? 'unavailable' : 'not-configured',
    route: 'backup',
    destination: supabaseDestination(configuration?.url),
  };
}

export async function persistSubmission(record, {
  env = process.env,
  createSupabaseClient = createClient,
  insertPostgresRecord = insertPostgresSubmission,
  putBlob = put,
  logger = console,
} = {}) {
  const configuration = supabaseConfiguration(env);
  if (configuration) {
    try {
      const supabase = createSupabaseClient(configuration.url, configuration.secret, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await supabase.from('submissions').insert(submissionRow(record));
      if (!error) {
        return {
          backend: 'supabase',
          route: 'data-api',
          destination: supabaseDestination(configuration.url),
        };
      }
      logger.error('Supabase submission storage failed; using the configured Blob fallback.', {
        reference: record.reference,
        ...storageErrorSummary(error),
      });
    } catch (error) {
      logger.error('Supabase submission storage threw an error; using the configured Blob fallback.', {
        reference: record.reference,
        ...storageErrorSummary(error),
      });
    }
  }

  const connectionString = postgresConfiguration(env);
  if (connectionString) {
    try {
      const persistence = await insertPostgresRecord(record, { connectionString });
      return {
        ...persistence,
        destination: supabaseDestination(configuration?.url),
      };
    } catch (error) {
      logger.error('Direct Postgres submission storage failed; using the configured Blob fallback.', {
        reference: record.reference,
        ...storageErrorSummary(error),
      });
    }
  }

  if (!configuration && !connectionString) {
    logger.warn?.('Primary submission storage is not configured; using the configured Blob fallback.', {
      reference: record.reference,
      hasUrl: Boolean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL),
      hasSecret: Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
      hasPostgresUrl: false,
    });
  }

  await putBlob(submissionBlobPath(record), JSON.stringify(record, null, 2), {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return {
    backend: 'blob',
    route: 'blob',
    syncStatus: 'pending',
    fallbackReason: configuration || connectionString ? 'supabase-write-failed' : 'supabase-not-configured',
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function submissionLabel(type) {
  return {
    employer_intake: 'company submission',
    student_interest: 'student submission',
    call_request: 'call request',
    university_partner: 'university roster',
  }[type] || 'submission';
}

export function operatorNotification(record, { to, from, adminUrl = '' } = {}) {
  const label = submissionLabel(record.type);
  const readinessLine = record.readiness
    ? `\nProject Packet readiness: ${record.readiness.readyCount}/${record.readiness.total}`
    : '';
  const revisionLine = record.revisionOf ? `\nRevision of: ${record.revisionOf}` : '';
  const adminLine = adminUrl ? `\nReview securely: ${adminUrl}` : '';
  const textBody = `A new Covenda ${label} is ready for review.\n\nReference: ${record.reference}${readinessLine}${revisionLine}${adminLine}\n\nPrivate form answers are intentionally excluded from this email.`;
  const safeAdminUrl = escapeHtml(adminUrl);
  const readinessHtml = record.readiness
    ? `<li><strong>Project Packet readiness:</strong> ${record.readiness.readyCount}/${record.readiness.total}</li>`
    : '';
  const revisionHtml = record.revisionOf
    ? `<li><strong>Revision of:</strong> ${escapeHtml(record.revisionOf)}</li>`
    : '';
  const reviewHtml = adminUrl
    ? `<p><a href="${safeAdminUrl}">Review this submission securely</a></p>`
    : '';

  return {
    from,
    to: [to],
    subject: `New Covenda ${label} · ${record.reference}`,
    text: textBody,
    html: `<p>A new Covenda ${label} is ready for review.</p><ul><li><strong>Reference:</strong> ${escapeHtml(record.reference)}</li>${readinessHtml}${revisionHtml}</ul>${reviewHtml}<p><small>Private form answers are intentionally excluded from this email.</small></p>`,
    tags: [
      { name: 'submission_type', value: record.type },
      { name: 'source', value: 'covenda' },
    ],
  };
}

export async function notifyOperator(record, {
  env = process.env,
  createResendClient = apiKey => new Resend(apiKey),
} = {}) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.COVENDA_NOTIFICATION_EMAIL;
  const from = env.COVENDA_NOTIFICATION_FROM;
  if (!apiKey || !to || !from) return { sent: false, reason: 'not-configured' };

  const resend = createResendClient(apiKey);
  const { error } = await resend.emails.send(
    operatorNotification(record, { to, from, adminUrl: env.COVENDA_ADMIN_URL }),
    { idempotencyKey: `covenda-submission-${record.reference.toLowerCase()}` },
  );
  if (error) throw new Error(`Operator notification failed: ${error.message || 'unknown email error'}`);
  return { sent: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'GET') {
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
    const primary = await primaryStorageHealth();
    return res.status(200).json({ ok: true, primary, checkedAt: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ ok: false, error: 'Submission is too large.' });

  try {
    const body = parseBody(req);
    if (!TYPES.has(body.type)) return res.status(400).json({ ok: false, error: 'Unknown submission type.' });
    if (text(body.website, 200)) return res.status(202).json({ ok: true, reference: 'RECEIVED' });
    if (body.consent !== true) return res.status(400).json({ ok: false, error: 'Consent is required.' });
    const startedAt = number(body.startedAt, 0, Date.now());
    if (startedAt === null || Date.now() - startedAt < MIN_FORM_TIME_MS) {
      return res.status(429).json({ ok: false, error: 'Please wait a moment and try again.' });
    }
    if (isRateLimited(req)) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });

    const details = submissionDetails(body);
    const revisionOf = body.type === 'employer_intake' ? employerRevisionReference(body.revisionOf) : '';
    const readiness = body.type === 'employer_intake' ? employerReadiness(details) : null;
    const createdAt = new Date().toISOString();
    const reference = referenceFor(body.type);
    const record = {
      schemaVersion: 6,
      reference,
      type: body.type,
      source: 'covenda-web',
      createdAt,
      status: 'received',
      consent: true,
      details,
      ...(readiness ? { readiness } : {}),
      ...(revisionOf ? { revisionOf } : {}),
    };
    const persistence = await persistSubmission(record);
    res.setHeader('X-Covenda-Storage', persistence.backend);
    try {
      await notifyOperator(record);
    } catch (notificationError) {
      console.error(`Operator notification failed for ${reference}`, notificationError);
    }
    return res.status(201).json({
      ok: true,
      reference,
      createdAt,
      status: 'received',
      storage: persistence.backend,
      storageRoute: persistence.route,
      syncStatus: persistence.backend === 'supabase' ? 'synced' : 'pending',
      destination: persistence.destination || null,
      ...(readiness ? { readiness: { readyCount: readiness.readyCount, total: readiness.total } } : {}),
      ...(revisionOf ? { revisionOf } : {}),
    });
  } catch (error) {
    const expected = error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('Please'));
    if (!expected) console.error('Submission storage failed', error);
    return res.status(expected ? 400 : 503).json({
      ok: false,
      error: expected ? error.message : 'We could not save this right now. Please try again shortly.',
    });
  }
}
