import { put } from '@vercel/blob';

const TYPES = new Set(['employer_intake', 'student_interest', 'call_request']);
const MAX_BODY_BYTES = 24_000;
const MIN_FORM_TIME_MS = 1_500;

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function email(value) {
  const clean = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : '';
}

function number(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
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

function employerRecord(body) {
  const project = body.project || {};
  const sources = project.sources || {};
  const record = {
    contact: contact(body.contact, { companyRequired: true }),
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
  if (!record.project.lastInstance || !record.project.decisionSupported || !record.project.deliverable || !record.project.reviewer || !record.project.acceptance) {
    throw new Error('Please complete the problem, output, reviewer, and acceptance fields.');
  }
  if (record.project.systemAccess === 'production' || record.project.sources.clientRecords || record.project.sources.restrictedJudgment) {
    throw new Error('Please remove client records, production access, and regulated decisions before sending.');
  }
  return record;
}

function studentRecord(body) {
  const record = {
    contact: contact(body.contact),
    school: text(body.school, 160),
    educationLevel: text(body.educationLevel, 80),
    interest: text(body.interest, 240),
    availability: text(body.availability, 80),
    age18: body.age18 === true,
  };
  if (!record.school || !record.educationLevel || !record.interest || !record.age18) {
    throw new Error('Please complete the student interest fields and confirm you are 18 or older.');
  }
  return record;
}

function callRecord(body) {
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

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

function referenceFor(type) {
  const prefix = { employer_intake: 'EMP', student_interest: 'STU', call_request: 'CALL' }[type];
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

    const details = body.type === 'employer_intake'
      ? employerRecord(body)
      : body.type === 'student_interest'
        ? studentRecord(body)
        : callRecord(body);
    const createdAt = new Date().toISOString();
    const reference = referenceFor(body.type);
    const record = {
      schemaVersion: 1,
      reference,
      type: body.type,
      source: 'proof-path.vercel.app',
      createdAt,
      consent: true,
      details,
    };
    const day = createdAt.slice(0, 10).replaceAll('-', '/');
    const stamp = createdAt.replace(/[-:.]/g, '').replace('Z', 'Z');
    await put(`submissions/${body.type}/${day}/${stamp}-${reference}.json`, JSON.stringify(record, null, 2), {
      access: 'private',
      addRandomSuffix: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
    return res.status(201).json({ ok: true, reference });
  } catch (error) {
    const expected = error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('Please'));
    if (!expected) console.error('Submission storage failed', error);
    return res.status(expected ? 400 : 503).json({
      ok: false,
      error: expected ? error.message : 'We could not save this right now. Please try again shortly.',
    });
  }
}
