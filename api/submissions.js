import { put } from '@vercel/blob';

const TYPES = new Set(['employer_intake', 'student_interest', 'call_request']);
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
    },
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
  return body.type === 'employer_intake'
    ? employerRecord(body)
    : body.type === 'student_interest'
      ? studentRecord(body)
      : callRecord(body);
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
    if (isRateLimited(req)) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });

    const details = submissionDetails(body);
    const createdAt = new Date().toISOString();
    const reference = referenceFor(body.type);
    const record = {
      schemaVersion: 2,
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
