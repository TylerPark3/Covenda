import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import workflowHandler, {
  WorkflowError,
  approvalState,
  assertIntakeTransition,
  assertOrganizationOwnership,
  createProjectBriefVersion,
  validateCompanyIntake,
  validateProjectBrief,
} from '../api/company-workflow.js';
import { adminRedirectUrl } from '../api/admin.js';
import { portalRedirectUrl } from '../api/portal.js';

const validIntake = {
  companyName: 'Example Company',
  companyWebsite: 'https://example.com',
  companyIndustry: 'Professional services',
  companySize: '11–30 employees',
  contactName: 'Avery Example',
  contactEmail: 'avery@example.com',
  contactRole: 'Operations lead',
  delayedWorkExample: 'The monthly customer research summary was delayed for three weeks.',
  delayReason: 'The operations team was handling quarter-end priorities.',
  normalOwner: 'Operations analyst',
  occurrenceFrequency: 'Monthly',
  desiredBusinessResult: 'Give the product team a cited view of repeated customer concerns.',
  finalDeliverable: 'A cited summary and issue table.',
  namedReviewer: 'Product operations manager',
  acceptanceCriteria: 'Every finding links to an approved source and follows the supplied taxonomy.',
  companyReviewMinutes: 90,
  employeeHoursAvoided: 12,
  studentHours: 16,
  budgetCents: 50000,
  deadline: '2026-09-30',
  availableContext: 'Approved interview excerpts with names removed.',
  toolsRequired: 'Google Docs and Sheets',
  systemAccess: 'None',
  dataClassification: 'internal',
  confidentialityConcerns: 'Use only the de-identified excerpts in the approved folder.',
  aiUsePolicy: 'AI may support outlining but every claim must be checked against the source.',
  restrictedInformationDeclared: false,
};

const validBrief = {
  objective: 'Produce a clear, cited summary of recurring customer concerns for product planning.',
  deliverables: ['Cited issue table', 'Two-page written summary'],
  approvedContext: 'Only the de-identified excerpts in the approved project folder.',
  studentResponsibilities: 'Review the excerpts, apply the supplied taxonomy, cite sources, and flag uncertainty.',
  companyResponsibilities: 'Provide approved excerpts, answer scope questions, and complete final review.',
  outOfScope: 'No customer contact, product decisions, or access to the CRM.',
  milestones: [{ title: 'Taxonomy check' }, { title: 'Draft review' }],
  acceptanceCriteria: 'Every finding has an approved citation and uses the supplied issue taxonomy.',
  compensationCents: 50000,
  deadline: '2026-09-30',
  aiPolicy: 'AI may support outlining; source review and final claims must be completed by the student.',
  informationBoundary: 'No names, contact details, credentials, CRM access, or unapproved source material.',
  requiredReviewer: 'Product operations manager',
  companyResponseExpectation: 'Answer questions within two business days and review the final work within 90 minutes.',
  oneRevisionRule: true,
  changeSummary: 'Initial project brief.',
};

function responseRecorder() {
  return {
    statusCode: 0,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('company intake validation covers every required workflow field without a readiness score', () => {
  const result = validateCompanyIntake(validIntake);
  assert.equal(result.status, undefined);
  assert.equal(result.company_name, 'Example Company');
  assert.equal(result.restricted_information_declared, false);
  assert.equal(result.budget_cents, 50000);
  assert.equal(Object.hasOwn(result, 'readiness_score'), false);

  assert.throws(
    () => validateCompanyIntake({ ...validIntake, restrictedInformationDeclared: undefined }),
    /Declare whether/,
  );
  assert.throws(
    () => validateCompanyIntake({ ...validIntake, dataClassification: 'secret-ish' }),
    /data classification/,
  );
});

test('organization ownership fails closed for cross-company records', () => {
  assert.equal(assertOrganizationOwnership({ organization_id: 'org-a' }, 'org-a'), true);
  assert.throws(
    () => assertOrganizationOwnership({ organization_id: 'org-b' }, 'org-a'),
    error => error instanceof WorkflowError && error.status === 403 && error.code === 'ORGANIZATION_ACCESS_DENIED',
  );
  assert.throws(
    () => assertOrganizationOwnership(null, 'org-a'),
    /does not belong to your organization/,
  );
});

test('intake status transitions reject publication-like and backwards jumps', () => {
  assert.equal(assertIntakeTransition('draft', 'submitted'), true);
  assert.equal(assertIntakeTransition('submitted', 'needs_clarification'), true);
  assert.equal(assertIntakeTransition('classified', 'brief_created'), true);
  assert.throws(
    () => assertIntakeTransition('submitted', 'brief_created'),
    error => error.code === 'INVALID_STATUS_TRANSITION' && error.status === 409,
  );
  assert.throws(() => assertIntakeTransition('brief_created', 'submitted'), /cannot move/);
  assert.throws(() => assertIntakeTransition('closed', 'classified'), /cannot move/);
});

test('brief validation preserves the one-revision rule and requires a complete bounded brief', () => {
  const result = validateProjectBrief(validBrief);
  assert.equal(result.one_revision_rule, true);
  assert.deepEqual(result.deliverables, validBrief.deliverables);
  assert.deepEqual(result.milestones, validBrief.milestones);
  assert.throws(
    () => validateProjectBrief({ ...validBrief, informationBoundary: '' }),
    /Information boundary/,
  );
});

test('creating a brief produces the next immutable version and restarts approvals', async () => {
  const project = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    current_version: 2,
    status: 'awaiting_approvals',
  };
  let rpcName = '';
  let rpcInput = null;
  const supabase = {
    from(table) {
      if (table === 'workflow_projects') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: project, error: null }; },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name, input) {
      rpcName = name;
      rpcInput = input;
      return {
        data: {
          id: 'version-3',
          project_id: project.id,
          version_number: input.p_expected_current_version + 1,
          objective: input.p_objective,
          created_by_email: input.p_created_by_email,
        },
        error: null,
      };
    },
  };
  const admin = { id: '223e4567-e89b-12d3-a456-426614174000', email: 'operator@covenda.com', supabase };
  const version = await createProjectBriefVersion(admin, { projectId: project.id, brief: validBrief });
  assert.equal(version.version_number, 3);
  assert.equal(rpcName, 'create_workflow_project_version');
  assert.equal(rpcInput.p_expected_current_version, 2);
  assert.equal(rpcInput.p_created_by_email, 'operator@covenda.com');
  assert.deepEqual(rpcInput.p_deliverables, validBrief.deliverables);
});

test('approval state counts only the current version and the currently assigned reviewer', () => {
  const project = {
    current_version: 3,
    domain_reviewer_user_id: 'reviewer-current',
  };
  const staleAndWrong = [
    { version_number: 2, approval_type: 'covenda', approver_user_id: 'operator' },
    { version_number: 2, approval_type: 'company', approver_user_id: 'company' },
    { version_number: 3, approval_type: 'reviewer', approver_user_id: 'reviewer-old' },
  ];
  assert.deepEqual(approvalState(project, staleAndWrong), {
    covenda: false,
    company: false,
    reviewer: false,
    complete: false,
    version: 3,
  });

  const complete = approvalState(project, [
    ...staleAndWrong,
    { version_number: 3, approval_type: 'covenda', approver_user_id: 'operator' },
    { version_number: 3, approval_type: 'company', approver_user_id: 'company' },
    { version_number: 3, approval_type: 'reviewer', approver_user_id: 'reviewer-current' },
  ]);
  assert.equal(complete.complete, true);
});

test('company and operator routes require server-side authentication', async () => {
  const companyResponse = responseRecorder();
  await workflowHandler({
    method: 'GET',
    url: '/api/company-workflow?action=company-intake&intakeId=123e4567-e89b-12d3-a456-426614174000',
    query: { action: 'company-intake', intakeId: '123e4567-e89b-12d3-a456-426614174000' },
    headers: { host: 'localhost' },
  }, companyResponse, { authorizeMember: async () => null });
  assert.equal(companyResponse.statusCode, 401);
  assert.equal(companyResponse.payload.code, 'MEMBER_AUTH_REQUIRED');

  const operatorResponse = responseRecorder();
  await workflowHandler({
    method: 'GET',
    url: '/api/company-workflow?action=operator-intake&intakeId=123e4567-e89b-12d3-a456-426614174000',
    query: { action: 'operator-intake', intakeId: '123e4567-e89b-12d3-a456-426614174000' },
    headers: { host: 'localhost' },
  }, operatorResponse, { authorizeAdmin: async () => null });
  assert.equal(operatorResponse.statusCode, 401);
  assert.equal(operatorResponse.payload.code, 'OPERATOR_AUTH_REQUIRED');
});

test('workflow migration keeps every private table server-only and creates a private bucket', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260726004018_company_project_workflow.sql', import.meta.url),
    'utf8',
  ).toLowerCase();
  for (const table of [
    'organizations',
    'organization_members',
    'company_intakes',
    'company_intake_attachments',
    'company_intake_internal_notes',
    'company_intake_clarifications',
    'workflow_projects',
    'project_brief_versions',
    'project_brief_approvals',
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /'company-intake-private'[\s\S]*false/);
  assert.doesNotMatch(migration, /grant [^;]* to (anon|authenticated)/);
  assert.doesNotMatch(migration, /create policy/);
  assert.match(migration, /unique \(project_id, version_number\)/);
  assert.match(migration, /approval_type in \('covenda', 'company', 'reviewer'\)/);
  assert.match(migration, /create or replace function public\.create_workflow_project_version/);
  assert.match(migration, /create or replace function public\.record_workflow_project_approval/);
  assert.match(migration, /for update/);
  assert.match(migration, /grant execute on function public\.create_workflow_project_version[\s\S]*to service_role/);
  assert.match(migration, /grant execute on function public\.record_workflow_project_approval[\s\S]*to service_role/);
});

test('requested routes and company field inventory are present without publishing or payment controls', () => {
  const companyHtml = readFileSync(
    new URL('../app/company/intakes/new/index.html', import.meta.url),
    'utf8',
  );
  const operatorIntakeHtml = readFileSync(
    new URL('../operator/intakes/detail.html', import.meta.url),
    'utf8',
  );
  const operatorProjectHtml = readFileSync(
    new URL('../operator/projects/detail.html', import.meta.url),
    'utf8',
  );
  const rewrites = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const name of [
    'companyName', 'companyWebsite', 'companyIndustry', 'companySize',
    'contactName', 'contactEmail', 'contactRole', 'delayedWorkExample',
    'delayReason', 'normalOwner', 'occurrenceFrequency', 'desiredBusinessResult',
    'finalDeliverable', 'namedReviewer', 'acceptanceCriteria',
    'companyReviewMinutes', 'employeeHoursAvoided', 'studentHours', 'budgetDollars',
    'deadline', 'availableContext', 'toolsRequired', 'systemAccess',
    'dataClassification', 'confidentialityConcerns', 'aiUsePolicy',
    'restrictedInformation',
  ]) {
    assert.match(companyHtml, new RegExp(`name="${name}"`));
  }
  assert.match(companyHtml, /does not publish a project, match a student, or create a payment/i);
  assert.match(operatorIntakeHtml, /data-operator-page="intake"/);
  assert.match(operatorProjectHtml, /data-operator-page="project"/);
  const sources = rewrites.rewrites.map(item => item.source);
  for (const route of ['/app/company/intakes/new', '/operator/intakes/:intakeId', '/operator/projects/:projectId']) {
    assert.ok(sources.includes(route), `missing rewrite for ${route}`);
  }
});

test('magic-link redirects allow only the explicit workflow route shapes', () => {
  const req = { headers: { host: 'covenda.example', 'x-forwarded-proto': 'https' } };
  assert.equal(
    portalRedirectUrl(req, {}, '/app/company/intakes/new'),
    'https://covenda.example/app/company/intakes/new',
  );
  assert.equal(
    portalRedirectUrl(req, {}, '/app/reviewer/projects/123e4567-e89b-12d3-a456-426614174000'),
    'https://covenda.example/app/reviewer/projects/123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(
    portalRedirectUrl(req, {}, '//attacker.example'),
    'https://covenda.example/portal.html',
  );
  assert.equal(
    adminRedirectUrl(req, {}, '/operator/intakes/123e4567-e89b-12d3-a456-426614174000'),
    'https://covenda.example/operator/intakes/123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(
    adminRedirectUrl(req, {}, '/operator/projects/not-a-project'),
    'https://covenda.example/admin.html',
  );
});
