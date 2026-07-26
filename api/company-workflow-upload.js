import { randomUUID } from 'node:crypto';

import { authorizeMember } from './portal.js';
import { PRIVATE_BUCKET, WorkflowError, assertOrganizationOwnership } from './company-workflow.js';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);

function text(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, maxLength) : '';
}

function safeName(value) {
  return text(value, 180).replace(/[^\p{L}\p{N}._()\- ]/gu, '') || 'attachment';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value);
  return null;
}

export async function readPrivateUpload(req, maxBytes = MAX_BYTES) {
  const declaredLength = Number(req.headers?.['content-length'] || 0);
  if (declaredLength > maxBytes) throw new WorkflowError('File is too large. Keep each attachment under 10 MB.', 413, 'ATTACHMENT_TOO_LARGE');
  const buffered = req.body == null ? null : asBuffer(req.body);
  if (buffered) {
    if (!buffered.length) throw new WorkflowError('The file is empty.');
    if (buffered.length > maxBytes) throw new WorkflowError('File is too large. Keep each attachment under 10 MB.', 413, 'ATTACHMENT_TOO_LARGE');
    return buffered;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = asBuffer(chunk);
    if (!bytes) throw new WorkflowError('The upload body could not be read.');
    size += bytes.length;
    if (size > maxBytes) throw new WorkflowError('File is too large. Keep each attachment under 10 MB.', 413, 'ATTACHMENT_TOO_LARGE');
    chunks.push(bytes);
  }
  const body = Buffer.concat(chunks, size);
  if (!body.length) throw new WorkflowError('The file is empty.');
  return body;
}

async function checked(query, fallback = null) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? fallback;
}

export async function storePrivateAttachment(member, {
  intakeId,
  originalName,
  contentType,
  body,
}) {
  if (!UUID.test(intakeId)) throw new WorkflowError('Choose a valid draft intake.');
  const profile = await checked(
    member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (profile?.role !== 'company') throw new WorkflowError('A company account is required.', 403, 'COMPANY_ACCOUNT_REQUIRED');
  const membership = await checked(
    member.supabase.from('organization_members').select('organization_id').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (!membership) throw new WorkflowError('Complete your company profile before uploading files.', 409);
  const intake = await checked(
    member.supabase.from('company_intakes').select('id,organization_id,status').eq('id', intakeId).maybeSingle(),
    null,
  );
  assertOrganizationOwnership(intake, membership.organization_id);
  if (intake.status !== 'draft') throw new WorkflowError('Attachments can only be added before the intake is submitted.', 409);

  const extension = ALLOWED_TYPES.get(contentType);
  if (!extension) throw new WorkflowError('Unsupported file type.', 415, 'ATTACHMENT_TYPE_NOT_ALLOWED');
  if (!body?.length || body.length > MAX_BYTES) throw new WorkflowError('Choose a file under 10 MB.', body?.length ? 413 : 400);

  const storagePath = `${intake.organization_id}/${intake.id}/${member.user.id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await member.supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(storagePath, body, {
      contentType,
      cacheControl: '60',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  try {
    return await checked(
      member.supabase.from('company_intake_attachments').insert({
        intake_id: intake.id,
        organization_id: intake.organization_id,
        storage_path: storagePath,
        original_name: safeName(originalName),
        content_type: contentType,
        size_bytes: body.length,
        uploaded_by: member.user.id,
      }).select('id,original_name,content_type,size_bytes,created_at').single(),
      null,
    );
  } catch (error) {
    await member.supabase.storage.from(PRIVATE_BUCKET).remove([storagePath]).catch(() => {});
    throw error;
  }
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  try {
    const authorize = dependencies.authorizeMember || authorizeMember;
    const member = await authorize(req, dependencies);
    if (!member) throw new WorkflowError('Member authentication is required.', 401, 'MEMBER_AUTH_REQUIRED');
    const contentType = text(req.headers['content-type']?.split(';')[0], 160);
    if (!ALLOWED_TYPES.has(contentType)) throw new WorkflowError('Unsupported file type.', 415, 'ATTACHMENT_TYPE_NOT_ALLOWED');
    const body = await readPrivateUpload(req);
    const attachment = await storePrivateAttachment(member, {
      intakeId: text(req.headers['x-intake-id'], 60),
      originalName: req.headers['x-file-name'],
      contentType,
      body,
    });
    return res.status(201).json({ ok: true, attachment });
  } catch (error) {
    const status = error instanceof WorkflowError ? error.status : 500;
    const code = error instanceof WorkflowError ? error.code : 'ATTACHMENT_UPLOAD_FAILED';
    if (status >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Private company attachment upload failed',
        code,
        error: text(error?.message || error, 1_000),
      }));
    }
    return res.status(status).json({
      ok: false,
      code,
      error: error instanceof WorkflowError ? error.message : 'The private attachment could not be stored.',
    });
  }
}
