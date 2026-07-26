import { authorizeAdmin } from './admin.js';
import { authorizeMember } from './portal.js';

export const INTAKE_CLASSIFICATIONS = new Set([
  'suitable_short_project',
  'needs_clarification',
  'better_as_internship',
  'better_for_contractor',
  'better_for_employee',
  'better_for_ai',
  'not_eligible',
]);

export const INTAKE_TRANSITIONS = Object.freeze({
  draft: new Set(['submitted']),
  submitted: new Set(['under_review', 'needs_clarification', 'classified']),
  under_review: new Set(['needs_clarification', 'classified']),
  needs_clarification: new Set(['submitted', 'under_review', 'classified']),
  classified: new Set(['brief_created', 'closed']),
  brief_created: new Set(['closed']),
  closed: new Set(),
});

export const APPROVAL_TYPES = new Set(['covenda', 'company', 'reviewer']);
export const PRIVATE_BUCKET = 'company-intake-private';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_CLASSIFICATIONS = new Set(['public', 'internal', 'confidential', 'restricted']);
const COMPANY_FIELD_KEYS = new Set([
  'companyName', 'companyWebsite', 'companyIndustry', 'companySize',
  'contactName', 'contactEmail', 'contactRole', 'delayedWorkExample',
  'delayReason', 'normalOwner', 'occurrenceFrequency', 'desiredBusinessResult',
  'finalDeliverable', 'namedReviewer', 'acceptanceCriteria',
  'companyReviewMinutes', 'employeeHoursAvoided', 'studentHours', 'budgetCents',
  'deadline', 'availableContext', 'toolsRequired', 'systemAccess',
  'dataClassification', 'confidentialityConcerns', 'aiUsePolicy',
  'restrictedInformationDeclared',
]);

export class WorkflowError extends Error {
  constructor(message, status = 400, code = 'WORKFLOW_INVALID') {
    super(message);
    this.name = 'WorkflowError';
    this.status = status;
    this.code = code;
  }
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, maxLength) : '';
}

function requiredText(value, label, maxLength = 8_000, minLength = 2) {
  const clean = text(value, maxLength);
  if (clean.length < minLength) throw new WorkflowError(`${label} is required.`);
  return clean;
}

function email(value, label = 'Email address') {
  const clean = text(value, 254).toLowerCase();
  if (!EMAIL.test(clean)) throw new WorkflowError(`Enter a valid ${label.toLowerCase()}.`);
  return clean;
}

function uuid(value, label) {
  const clean = text(value, 60);
  if (!UUID.test(clean)) throw new WorkflowError(`Choose a valid ${label}.`);
  return clean;
}

function number(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  const clean = Number(value);
  if (!Number.isFinite(clean) || clean < min || clean > max || (integer && !Number.isInteger(clean))) {
    throw new WorkflowError(`Enter a valid ${label.toLowerCase()}.`);
  }
  return clean;
}

function date(value, label = 'Deadline') {
  const clean = text(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(`${clean}T00:00:00Z`))) {
    throw new WorkflowError(`Enter a valid ${label.toLowerCase()}.`);
  }
  return clean;
}

function stringList(value, label, maxItems = 30) {
  const source = Array.isArray(value) ? value : text(value, 8_000).split(/\r?\n|,/);
  const items = [...new Set(source.map(item => text(item, 500)).filter(Boolean))].slice(0, maxItems);
  if (!items.length) throw new WorkflowError(`${label} is required.`);
  return items;
}

function milestoneList(value) {
  const source = Array.isArray(value) ? value : text(value, 8_000).split(/\r?\n/);
  const items = source.map((item, index) => {
    if (typeof item === 'string') return { title: text(item, 500) };
    if (!item || typeof item !== 'object') return null;
    const title = text(item.title, 500);
    if (!title) return null;
    const dueDate = item.dueDate ? date(item.dueDate, `Milestone ${index + 1} date`) : null;
    return { title, ...(dueDate ? { dueDate } : {}) };
  }).filter(Boolean).slice(0, 30);
  if (!items.length) throw new WorkflowError('At least one milestone is required.');
  return items;
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

async function checked(query, fallback = null) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? fallback;
}

export function assertIntakeTransition(from, to) {
  if (from === to) return true;
  if (!INTAKE_TRANSITIONS[from]?.has(to)) {
    throw new WorkflowError(`The intake cannot move from ${from} to ${to}.`, 409, 'INVALID_STATUS_TRANSITION');
  }
  return true;
}

export function validateCompanyIntake(input = {}) {
  const website = text(input.companyWebsite, 500);
  if (website) {
    let url;
    try { url = new URL(website); } catch { throw new WorkflowError('Enter a valid company website.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new WorkflowError('Enter a valid company website.');
  }
  const classification = text(input.dataClassification, 30);
  if (!DATA_CLASSIFICATIONS.has(classification)) throw new WorkflowError('Choose a data classification.');
  if (typeof input.restrictedInformationDeclared !== 'boolean') {
    throw new WorkflowError('Declare whether the work includes restricted information.');
  }
  return {
    company_name: requiredText(input.companyName, 'Company name', 160),
    company_website: website || null,
    company_industry: requiredText(input.companyIndustry, 'Company industry', 160),
    company_size: requiredText(input.companySize, 'Company size', 80),
    contact_name: requiredText(input.contactName, 'Contact name', 160),
    contact_email: email(input.contactEmail, 'contact email'),
    contact_role: requiredText(input.contactRole, 'Contact role', 160),
    delayed_work_example: requiredText(input.delayedWorkExample, 'The last real example', 8_000, 10),
    delay_reason: requiredText(input.delayReason, 'Why the work was delayed', 4_000, 5),
    normal_owner: requiredText(input.normalOwner, 'Who normally completes the work', 500),
    occurrence_frequency: requiredText(input.occurrenceFrequency, 'How frequently the work occurs', 500),
    desired_business_result: requiredText(input.desiredBusinessResult, 'Desired business result', 4_000, 5),
    final_deliverable: requiredText(input.finalDeliverable, 'Final deliverable', 4_000, 5),
    named_reviewer: requiredText(input.namedReviewer, 'Named reviewer', 500),
    acceptance_criteria: requiredText(input.acceptanceCriteria, 'Acceptance criteria', 4_000, 5),
    company_review_minutes: number(input.companyReviewMinutes, 'Company review-time budget', { min: 0, max: 10_080, integer: true }),
    employee_hours_avoided: number(input.employeeHoursAvoided, 'Estimated employee hours avoided', { min: 0, max: 100_000 }),
    student_hours: number(input.studentHours, 'Estimated student hours', { min: 0.25, max: 100_000 }),
    budget_cents: number(input.budgetCents, 'Budget', { min: 0, max: 100_000_000, integer: true }),
    deadline: date(input.deadline),
    available_context: requiredText(input.availableContext, 'Available context', 8_000, 2),
    tools_required: requiredText(input.toolsRequired, 'Tools required', 2_000, 2),
    system_access: requiredText(input.systemAccess, 'System access', 2_000, 2),
    data_classification: classification,
    confidentiality_concerns: requiredText(input.confidentialityConcerns, 'Confidentiality concerns', 4_000, 2),
    ai_use_policy: requiredText(input.aiUsePolicy, 'AI-use policy', 4_000, 2),
    restricted_information_declared: input.restrictedInformationDeclared,
  };
}

export function validateProjectBrief(input = {}) {
  return {
    objective: requiredText(input.objective, 'Objective', 8_000, 10),
    deliverables: stringList(input.deliverables, 'At least one deliverable'),
    approved_context: requiredText(input.approvedContext, 'Approved context', 8_000, 10),
    student_responsibilities: requiredText(input.studentResponsibilities, 'Student responsibilities', 8_000, 10),
    company_responsibilities: requiredText(input.companyResponsibilities, 'Company responsibilities', 8_000, 10),
    out_of_scope: requiredText(input.outOfScope, 'Out-of-scope work', 8_000),
    milestones: milestoneList(input.milestones),
    acceptance_criteria: requiredText(input.acceptanceCriteria, 'Acceptance criteria', 8_000, 10),
    compensation_cents: number(input.compensationCents, 'Compensation', { min: 0, max: 100_000_000, integer: true }),
    deadline: date(input.deadline),
    ai_policy: requiredText(input.aiPolicy, 'AI policy', 4_000),
    information_boundary: requiredText(input.informationBoundary, 'Information boundary', 8_000, 10),
    required_reviewer: requiredText(input.requiredReviewer, 'Required reviewer', 500),
    company_response_expectation: requiredText(input.companyResponseExpectation, 'Company response expectation', 2_000),
    one_revision_rule: input.oneRevisionRule !== false,
    change_summary: text(input.changeSummary, 2_000) || null,
  };
}

export function approvalState(project, approvals = []) {
  const current = Number(project?.current_version || 0);
  const reviewerId = project?.domain_reviewer_user_id || null;
  const currentApprovals = approvals.filter(item => Number(item.version_number) === current);
  const covenda = currentApprovals.some(item => item.approval_type === 'covenda');
  const company = currentApprovals.some(item => item.approval_type === 'company');
  const reviewer = Boolean(reviewerId) && currentApprovals.some(
    item => item.approval_type === 'reviewer' && item.approver_user_id === reviewerId,
  );
  return {
    covenda,
    company,
    reviewer,
    complete: current > 0 && covenda && company && reviewer,
    version: current,
  };
}

export function assertOrganizationOwnership(resource, organizationId) {
  if (!resource || resource.organization_id !== organizationId) {
    throw new WorkflowError('This record does not belong to your organization.', 403, 'ORGANIZATION_ACCESS_DENIED');
  }
  return true;
}

async function requireCompanyContext(member, { createOrganization = false } = {}) {
  const profile = await checked(
    member.supabase.from('member_profiles').select('user_id,role,display_name,organization_name').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (profile?.role !== 'company') throw new WorkflowError('A company account is required.', 403, 'COMPANY_ACCOUNT_REQUIRED');

  let membership = await checked(
    member.supabase.from('organization_members').select('organization_id,membership_role').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (!membership && createOrganization) {
    const organizationName = requiredText(profile.organization_name, 'Organization name', 160);
    const organization = await checked(
      member.supabase.from('organizations').insert({
        name: organizationName,
        created_by: member.user.id,
      }).select('*').single(),
      null,
    );
    membership = await checked(
      member.supabase.from('organization_members').insert({
        organization_id: organization.id,
        user_id: member.user.id,
        membership_role: 'owner',
      }).select('organization_id,membership_role').single(),
      null,
    );
  }
  if (!membership) throw new WorkflowError('Complete your company profile before starting an intake.', 409, 'ORGANIZATION_NOT_READY');
  const organization = await checked(
    member.supabase.from('organizations').select('*').eq('id', membership.organization_id).maybeSingle(),
    null,
  );
  if (!organization) throw new WorkflowError('Your organization record is unavailable.', 409, 'ORGANIZATION_NOT_READY');
  return { profile, organization, membership };
}

export async function createCompanyIntakeDraft(member) {
  const { organization } = await requireCompanyContext(member, { createOrganization: true });
  return checked(
    member.supabase.from('company_intakes').insert({
      organization_id: organization.id,
      created_by: member.user.id,
      status: 'draft',
    }).select('id,organization_id,status,created_at').single(),
    null,
  );
}

async function companyIntakeById(member, intakeId, { allowDraft = true } = {}) {
  const { organization } = await requireCompanyContext(member);
  const intake = await checked(
    member.supabase.from('company_intakes').select('*').eq('id', uuid(intakeId, 'intake')).maybeSingle(),
    null,
  );
  assertOrganizationOwnership(intake, organization.id);
  if (!allowDraft && intake.status === 'draft') throw new WorkflowError('Submit this intake before opening it.', 409);
  return { intake, organization };
}

export async function submitCompanyIntake(member, input) {
  const clean = validateCompanyIntake(input);
  const { organization } = await requireCompanyContext(member, { createOrganization: true });
  let intake = null;
  if (input.intakeId) {
    intake = await checked(
      member.supabase.from('company_intakes').select('*').eq('id', uuid(input.intakeId, 'intake')).maybeSingle(),
      null,
    );
    assertOrganizationOwnership(intake, organization.id);
    assertIntakeTransition(intake.status, 'submitted');
  }
  const now = new Date().toISOString();
  const changes = { ...clean, status: 'submitted', submitted_at: now, updated_at: now };
  if (intake) {
    return checked(
      member.supabase.from('company_intakes').update(changes).eq('id', intake.id).eq('status', 'draft').select('*').single(),
      null,
    );
  }
  return checked(
    member.supabase.from('company_intakes').insert({
      organization_id: organization.id,
      created_by: member.user.id,
      ...changes,
    }).select('*').single(),
    null,
  );
}

function publicProject(project, version, approvals) {
  if (!project) return null;
  return {
    id: project.id,
    status: project.status,
    currentVersion: project.current_version,
    domainReviewerName: project.domain_reviewer_name,
    version,
    approvals: approvalState(project, approvals),
  };
}

export async function loadCompanyIntake(member, intakeId) {
  const { intake } = await companyIntakeById(member, intakeId, { allowDraft: false });
  const [attachments, clarifications, project] = await Promise.all([
    checked(
      member.supabase.from('company_intake_attachments')
        .select('id,original_name,content_type,size_bytes,created_at')
        .eq('intake_id', intake.id).order('created_at', { ascending: true }),
      [],
    ),
    checked(
      member.supabase.from('company_intake_clarifications')
        .select('id,missing_fields,request_message,requested_at,company_response,responded_at,status')
        .eq('intake_id', intake.id).order('requested_at', { ascending: false }),
      [],
    ),
    checked(
      member.supabase.from('workflow_projects').select('*').eq('intake_id', intake.id).maybeSingle(),
      null,
    ),
  ]);
  let version = null;
  let approvals = [];
  if (project?.current_version) {
    [version, approvals] = await Promise.all([
      checked(
        member.supabase.from('project_brief_versions').select('*')
          .eq('project_id', project.id).eq('version_number', project.current_version).maybeSingle(),
        null,
      ),
      checked(
        member.supabase.from('project_brief_approvals').select('*')
          .eq('project_id', project.id).eq('version_number', project.current_version),
        [],
      ),
    ]);
  }
  return { intake, attachments, clarifications, project: publicProject(project, version, approvals) };
}

export async function respondToClarification(member, input) {
  const clarificationId = uuid(input.clarificationId, 'clarification request');
  const clarification = await checked(
    member.supabase.from('company_intake_clarifications').select('*').eq('id', clarificationId).maybeSingle(),
    null,
  );
  if (!clarification || clarification.status !== 'open') throw new WorkflowError('Choose an open clarification request.', 409);
  const { intake } = await companyIntakeById(member, clarification.intake_id, { allowDraft: false });
  assertIntakeTransition(intake.status, 'submitted');
  const response = requiredText(input.response, 'Clarification response', 8_000, 2);
  const now = new Date().toISOString();
  const updated = await checked(
    member.supabase.from('company_intake_clarifications').update({
      company_response: response,
      responded_by: member.user.id,
      responded_at: now,
      status: 'responded',
    }).eq('id', clarification.id).eq('status', 'open').select('*').single(),
    null,
  );
  await checked(
    member.supabase.from('company_intakes').update({
      status: 'submitted',
      classification: null,
      updated_at: now,
    }).eq('id', intake.id).select('id,status').single(),
    null,
  );
  return updated;
}

async function operatorIntakeById(admin, intakeId) {
  const intake = await checked(
    admin.supabase.from('company_intakes').select('*').eq('id', uuid(intakeId, 'intake')).maybeSingle(),
    null,
  );
  if (!intake) throw new WorkflowError('The company intake was not found.', 404, 'INTAKE_NOT_FOUND');
  return intake;
}

export async function loadOperatorIntake(admin, intakeId) {
  const intake = await operatorIntakeById(admin, intakeId);
  const [organization, attachments, notes, clarifications, project] = await Promise.all([
    checked(admin.supabase.from('organizations').select('*').eq('id', intake.organization_id).maybeSingle(), null),
    checked(
      admin.supabase.from('company_intake_attachments').select('*')
        .eq('intake_id', intake.id).order('created_at', { ascending: true }),
      [],
    ),
    checked(
      admin.supabase.from('company_intake_internal_notes').select('*')
        .eq('intake_id', intake.id).order('created_at', { ascending: false }),
      [],
    ),
    checked(
      admin.supabase.from('company_intake_clarifications').select('*')
        .eq('intake_id', intake.id).order('requested_at', { ascending: false }),
      [],
    ),
    checked(admin.supabase.from('workflow_projects').select('*').eq('intake_id', intake.id).maybeSingle(), null),
  ]);
  return { intake, organization, attachments, notes, clarifications, project };
}

export async function listOperatorIntakes(admin) {
  return checked(
    admin.supabase.from('company_intakes')
      .select('id,organization_id,status,classification,company_name,contact_name,contact_email,deadline,budget_cents,submitted_at,updated_at')
      .neq('status', 'draft')
      .order('submitted_at', { ascending: false })
      .limit(200),
    [],
  );
}

export async function addInternalNote(admin, input) {
  const intake = await operatorIntakeById(admin, input.intakeId);
  const note = requiredText(input.note, 'Internal note', 4_000);
  return checked(
    admin.supabase.from('company_intake_internal_notes').insert({
      intake_id: intake.id,
      note,
      created_by: admin.id,
      created_by_email: admin.email,
    }).select('*').single(),
    null,
  );
}

export async function requestClarification(admin, input) {
  const intake = await operatorIntakeById(admin, input.intakeId);
  assertIntakeTransition(intake.status, 'needs_clarification');
  const missingFields = [...new Set(
    (Array.isArray(input.missingFields) ? input.missingFields : [])
      .map(item => text(item, 80))
      .filter(item => COMPANY_FIELD_KEYS.has(item)),
  )].slice(0, COMPANY_FIELD_KEYS.size);
  if (!missingFields.length) throw new WorkflowError('Identify at least one missing item.');
  const requestMessage = requiredText(input.requestMessage, 'Clarification request', 4_000, 10);
  const clarification = await checked(
    admin.supabase.from('company_intake_clarifications').insert({
      intake_id: intake.id,
      missing_fields: missingFields,
      request_message: requestMessage,
      requested_by: admin.id,
      requested_by_email: admin.email,
    }).select('*').single(),
    null,
  );
  await checked(
    admin.supabase.from('company_intakes').update({
      status: 'needs_clarification',
      classification: 'needs_clarification',
      updated_at: new Date().toISOString(),
    }).eq('id', intake.id).select('id,status').single(),
    null,
  );
  return clarification;
}

export async function classifyIntake(admin, input) {
  const intake = await operatorIntakeById(admin, input.intakeId);
  const classification = text(input.classification, 60);
  if (!INTAKE_CLASSIFICATIONS.has(classification)) throw new WorkflowError('Choose a valid project classification.');
  const status = classification === 'needs_clarification' ? 'needs_clarification' : 'classified';
  assertIntakeTransition(intake.status, status);
  return checked(
    admin.supabase.from('company_intakes').update({
      status,
      classification,
      updated_at: new Date().toISOString(),
    }).eq('id', intake.id).select('*').single(),
    null,
  );
}

async function projectById(supabase, projectId) {
  const project = await checked(
    supabase.from('workflow_projects').select('*').eq('id', uuid(projectId, 'project')).maybeSingle(),
    null,
  );
  if (!project) throw new WorkflowError('The project was not found.', 404, 'PROJECT_NOT_FOUND');
  return project;
}

export async function createWorkflowProject(admin, input) {
  const intake = await operatorIntakeById(admin, input.intakeId);
  if (intake.classification !== 'suitable_short_project' || intake.status !== 'classified') {
    throw new WorkflowError('Classify this intake as a suitable short project first.', 409);
  }
  const existing = await checked(
    admin.supabase.from('workflow_projects').select('*').eq('intake_id', intake.id).maybeSingle(),
    null,
  );
  if (existing) return existing;
  const project = await checked(
    admin.supabase.from('workflow_projects').insert({
      intake_id: intake.id,
      organization_id: intake.organization_id,
      created_by: admin.id,
      status: 'draft',
    }).select('*').single(),
    null,
  );
  assertIntakeTransition(intake.status, 'brief_created');
  await checked(
    admin.supabase.from('company_intakes').update({
      status: 'brief_created',
      updated_at: new Date().toISOString(),
    }).eq('id', intake.id).select('id,status').single(),
    null,
  );
  return project;
}

export async function createProjectBriefVersion(admin, input) {
  const project = await projectById(admin.supabase, input.projectId);
  if (project.status === 'closed') throw new WorkflowError('A closed project cannot receive a new brief version.', 409);
  const brief = validateProjectBrief(input.brief);
  const { data, error } = await admin.supabase.rpc('create_workflow_project_version', {
    p_project_id: project.id,
    p_expected_current_version: Number(project.current_version || 0),
    p_objective: brief.objective,
    p_deliverables: brief.deliverables,
    p_approved_context: brief.approved_context,
    p_student_responsibilities: brief.student_responsibilities,
    p_company_responsibilities: brief.company_responsibilities,
    p_out_of_scope: brief.out_of_scope,
    p_milestones: brief.milestones,
    p_acceptance_criteria: brief.acceptance_criteria,
    p_compensation_cents: brief.compensation_cents,
    p_deadline: brief.deadline,
    p_ai_policy: brief.ai_policy,
    p_information_boundary: brief.information_boundary,
    p_required_reviewer: brief.required_reviewer,
    p_company_response_expectation: brief.company_response_expectation,
    p_one_revision_rule: brief.one_revision_rule,
    p_change_summary: brief.change_summary,
    p_created_by: admin.id,
    p_created_by_email: admin.email,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function assignDomainReviewer(admin, input) {
  const project = await projectById(admin.supabase, input.projectId);
  const reviewerUserId = uuid(input.reviewerUserId, 'domain reviewer');
  const reviewer = await checked(
    admin.supabase.from('member_profiles').select('user_id,display_name,contact_email').eq('user_id', reviewerUserId).maybeSingle(),
    null,
  );
  if (!reviewer) throw new WorkflowError('The domain reviewer needs a Covenda member account.');
  return checked(
    admin.supabase.from('workflow_projects').update({
      domain_reviewer_user_id: reviewer.user_id,
      domain_reviewer_name: text(input.reviewerName, 160) || reviewer.display_name,
      domain_reviewer_email: input.reviewerEmail ? email(input.reviewerEmail, 'reviewer email') : (reviewer.contact_email || null),
      status: project.current_version ? 'awaiting_approvals' : 'draft',
      updated_at: new Date().toISOString(),
    }).eq('id', project.id).select('*').single(),
    null,
  );
}

async function recordApproval(supabase, project, approvalType, approver) {
  if (!APPROVAL_TYPES.has(approvalType)) throw new WorkflowError('Choose a valid approval type.');
  if (!project.current_version) throw new WorkflowError('Create a project brief version before recording approval.', 409);
  const version = await checked(
    supabase.from('project_brief_versions').select('project_id,version_number')
      .eq('project_id', project.id).eq('version_number', project.current_version).maybeSingle(),
    null,
  );
  if (!version) throw new WorkflowError('The current project brief version is unavailable.', 409);
  const { data: updatedProjectData, error: approvalError } = await supabase.rpc('record_workflow_project_approval', {
    p_project_id: project.id,
    p_expected_version: project.current_version,
    p_approval_type: approvalType,
    p_approver_user_id: approver.id,
    p_approver_email: approver.email || null,
  });
  if (approvalError) throw approvalError;
  const updatedProject = Array.isArray(updatedProjectData) ? updatedProjectData[0] : updatedProjectData;
  const approvals = await checked(
    supabase.from('project_brief_approvals').select('*')
      .eq('project_id', project.id).eq('version_number', project.current_version),
    [],
  );
  const state = approvalState(updatedProject || project, approvals);
  const approval = approvals.find(item => item.approval_type === approvalType) || null;
  return { approval, state, project: updatedProject || project };
}

export async function recordCovendaApproval(admin, input) {
  const project = await projectById(admin.supabase, input.projectId);
  return recordApproval(admin.supabase, project, 'covenda', admin);
}

export async function recordCompanyApproval(member, input) {
  const { organization } = await requireCompanyContext(member);
  const project = await projectById(member.supabase, input.projectId);
  assertOrganizationOwnership(project, organization.id);
  return recordApproval(member.supabase, project, 'company', {
    id: member.user.id,
    email: member.user.email,
  });
}

export async function recordReviewerApproval(member, input) {
  const project = await projectById(member.supabase, input.projectId);
  if (project.domain_reviewer_user_id !== member.user.id) {
    throw new WorkflowError('Only the assigned domain reviewer can approve this brief.', 403, 'REVIEWER_ACCESS_DENIED');
  }
  return recordApproval(member.supabase, project, 'reviewer', {
    id: member.user.id,
    email: member.user.email,
  });
}

export async function loadOperatorProject(admin, projectId) {
  const project = await projectById(admin.supabase, projectId);
  const [intake, organization, versions, approvals] = await Promise.all([
    checked(admin.supabase.from('company_intakes').select('*').eq('id', project.intake_id).maybeSingle(), null),
    checked(admin.supabase.from('organizations').select('*').eq('id', project.organization_id).maybeSingle(), null),
    checked(
      admin.supabase.from('project_brief_versions').select('*')
        .eq('project_id', project.id).order('version_number', { ascending: false }),
      [],
    ),
    checked(
      admin.supabase.from('project_brief_approvals').select('*')
        .eq('project_id', project.id).order('approved_at', { ascending: false }),
      [],
    ),
  ]);
  return { project, intake, organization, versions, approvals, approvalState: approvalState(project, approvals) };
}

export async function loadReviewerProject(member, projectId) {
  const project = await projectById(member.supabase, projectId);
  if (project.domain_reviewer_user_id !== member.user.id) {
    throw new WorkflowError('Only the assigned domain reviewer can open this brief.', 403, 'REVIEWER_ACCESS_DENIED');
  }
  const [organization, version, approvals] = await Promise.all([
    checked(member.supabase.from('organizations').select('id,name').eq('id', project.organization_id).maybeSingle(), null),
    checked(
      member.supabase.from('project_brief_versions').select('*')
        .eq('project_id', project.id).eq('version_number', project.current_version).maybeSingle(),
      null,
    ),
    checked(
      member.supabase.from('project_brief_approvals').select('*')
        .eq('project_id', project.id).eq('version_number', project.current_version),
      [],
    ),
  ]);
  return { project, organization, version, approvalState: approvalState(project, approvals) };
}

export async function createAttachmentSignedUrl(actor, input, { operator = false } = {}) {
  const attachment = await checked(
    actor.supabase.from('company_intake_attachments').select('*')
      .eq('id', uuid(input.attachmentId, 'attachment')).maybeSingle(),
    null,
  );
  if (!attachment) throw new WorkflowError('The attachment was not found.', 404);
  if (!operator) {
    const { organization } = await requireCompanyContext(actor);
    assertOrganizationOwnership(attachment, organization.id);
  }
  const { data, error } = await actor.supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(attachment.storage_path, 60, { download: attachment.original_name });
  if (error || !data?.signedUrl) throw error || new Error('Signed URL was not created.');
  return { url: data.signedUrl, expiresIn: 60 };
}

function queryValue(req, key) {
  if (req.query && typeof req.query[key] === 'string') return req.query[key];
  try { return new URL(req.url, 'http://local').searchParams.get(key) || ''; } catch { return ''; }
}

function workflowFailure(error) {
  if (error instanceof WorkflowError) return { status: error.status, code: error.code, message: error.message };
  const message = text(error?.message, 2_000);
  if (/company_intakes|workflow_projects|project_brief|organization_members|schema cache|relation .* does not exist/i.test(message)) {
    return {
      status: 503,
      code: 'WORKFLOW_SCHEMA_UNAVAILABLE',
      message: 'The company workflow is not ready in this environment. Apply the company-project workflow migration first.',
    };
  }
  return { status: 500, code: 'WORKFLOW_UNAVAILABLE', message: 'The company workflow is temporarily unavailable.' };
}

async function requireMember(req, dependencies) {
  const authorize = dependencies.authorizeMember || authorizeMember;
  const member = await authorize(req, dependencies);
  if (!member) throw new WorkflowError('Member authentication is required.', 401, 'MEMBER_AUTH_REQUIRED');
  return member;
}

async function requireOperator(req, dependencies) {
  const authorize = dependencies.authorizeAdmin || authorizeAdmin;
  const admin = await authorize(req, dependencies);
  if (!admin) throw new WorkflowError('Operator authorization is required.', 401, 'OPERATOR_AUTH_REQUIRED');
  return admin;
}

export default async function handler(req, res, dependencies = {}) {
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const input = req.method === 'GET' ? {} : parseBody(req);
    const action = req.method === 'GET' ? queryValue(req, 'action') : text(input.action, 80);

    if (action === 'company-intake') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, ...(await loadCompanyIntake(member, queryValue(req, 'intakeId'))) });
    }
    if (action === 'operator-intake') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, ...(await loadOperatorIntake(admin, queryValue(req, 'intakeId'))) });
    }
    if (action === 'operator-intakes') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, intakes: await listOperatorIntakes(admin) });
    }
    if (action === 'operator-project') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, ...(await loadOperatorProject(admin, queryValue(req, 'projectId'))) });
    }
    if (action === 'reviewer-project') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, ...(await loadReviewerProject(member, queryValue(req, 'projectId'))) });
    }

    if (action === 'create-draft') {
      const member = await requireMember(req, dependencies);
      return res.status(201).json({ ok: true, intake: await createCompanyIntakeDraft(member) });
    }
    if (action === 'submit-intake') {
      const member = await requireMember(req, dependencies);
      return res.status(201).json({ ok: true, intake: await submitCompanyIntake(member, input) });
    }
    if (action === 'respond-clarification') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, clarification: await respondToClarification(member, input) });
    }
    if (action === 'approve-company') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, ...(await recordCompanyApproval(member, input)) });
    }
    if (action === 'approve-reviewer') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, ...(await recordReviewerApproval(member, input)) });
    }
    if (action === 'company-attachment-url') {
      const member = await requireMember(req, dependencies);
      return res.status(200).json({ ok: true, ...(await createAttachmentSignedUrl(member, input)) });
    }

    if (action === 'add-note') {
      const admin = await requireOperator(req, dependencies);
      return res.status(201).json({ ok: true, note: await addInternalNote(admin, input) });
    }
    if (action === 'request-clarification') {
      const admin = await requireOperator(req, dependencies);
      return res.status(201).json({ ok: true, clarification: await requestClarification(admin, input) });
    }
    if (action === 'classify-intake') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, intake: await classifyIntake(admin, input) });
    }
    if (action === 'create-project') {
      const admin = await requireOperator(req, dependencies);
      return res.status(201).json({ ok: true, project: await createWorkflowProject(admin, input) });
    }
    if (action === 'save-brief-version') {
      const admin = await requireOperator(req, dependencies);
      return res.status(201).json({ ok: true, version: await createProjectBriefVersion(admin, input) });
    }
    if (action === 'assign-reviewer') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, project: await assignDomainReviewer(admin, input) });
    }
    if (action === 'approve-covenda') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, ...(await recordCovendaApproval(admin, input)) });
    }
    if (action === 'operator-attachment-url') {
      const admin = await requireOperator(req, dependencies);
      return res.status(200).json({ ok: true, ...(await createAttachmentSignedUrl(admin, input, { operator: true })) });
    }

    throw new WorkflowError('Choose a valid workflow action.', 400, 'UNKNOWN_WORKFLOW_ACTION');
  } catch (error) {
    const failure = workflowFailure(error);
    if (failure.status >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Company workflow API failed',
        route: '/api/company-workflow',
        action: req.method === 'GET' ? queryValue(req, 'action') : text(req.body?.action, 80),
        code: failure.code,
        error: text(error?.message || error, 2_000),
        durationMs: Date.now() - startedAt,
      }));
    }
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
