import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cancelProject, deleteProject } from '../../api/portal.js';

// A real UUID: PROJECT_ID_PATTERN rejects anything else before the ownership check runs, which
// is what made an earlier version of this file fail for the wrong reason.
const PROJECT_ID = '3f2a1b4c-9d8e-4f7a-b6c5-1e2d3f4a5b6c';

function db({ project = null, applicants = [] } = {}) {
  return {
    from(name) {
      const q = {
        select: () => q, eq: () => q,
        limit: () => Promise.resolve({ data: applicants, error: null }),
        maybeSingle: () => Promise.resolve({ data: name === 'member_projects' ? project : null, error: null }),
        delete: () => q,
      };
      return q;
    },
    rpc: () => Promise.resolve({ data: [{ refunded: 0 }], error: null }),
  };
}
const owner = { user: { id: 'co1' } };

test('only the owner can end a project', async () => {
  const supabase = db({ project: { id: PROJECT_ID, owner_user_id: 'someone-else', status: 'open' } });
  await assert.rejects(() => cancelProject({ ...owner, supabase }, { projectId: PROJECT_ID }), /Only the project owner/);
});

// Ending is about stopping the work, not about the money — a live project holding no escrow
// still has to be endable, which is exactly what the UI gate used to prevent.
test('a live project with no escrow can still be ended', async () => {
  const supabase = db({ project: { id: PROJECT_ID, owner_user_id: 'co1', status: 'open', credits_held: 0 } });
  const result = await cancelProject({ ...owner, supabase }, { projectId: PROJECT_ID });
  assert.ok(result, 'cancel must succeed with nothing held');
});

test('a finished project cannot be ended again', async () => {
  for (const status of ['complete', 'archived']) {
    const supabase = db({ project: { id: PROJECT_ID, owner_user_id: 'co1', status } });
    await assert.rejects(() => cancelProject({ ...owner, supabase }, { projectId: PROJECT_ID }), /already finished/);
  }
});

// Deleting a project with applicants would strand people who applied in good faith.
test('delete refuses anything that is not a bare draft', async () => {
  const live = db({ project: { id: PROJECT_ID, owner_user_id: 'co1', status: 'open' } });
  await assert.rejects(() => deleteProject({ ...owner, supabase: live }, { projectId: PROJECT_ID }), /Only a draft/);

  const holding = db({ project: { id: PROJECT_ID, owner_user_id: 'co1', status: 'draft', credits_held: 500 } });
  await assert.rejects(() => deleteProject({ ...owner, supabase: holding }, { projectId: PROJECT_ID }), /holding credits/);

  const withApplicants = db({ project: { id: PROJECT_ID, owner_user_id: 'co1', status: 'draft', credits_held: 0 }, applicants: [{ id: 'a1' }] });
  await assert.rejects(() => deleteProject({ ...owner, supabase: withApplicants }, { projectId: PROJECT_ID }), /already has applicants/);
});

test('the control names the consequence for whoever else is involved', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function endProjectControl'), src.indexOf('function armedButton'));
  // A student mid-work finding out by the project vanishing is the failure this prevents.
  assert.match(fn, /ends the work a student has started/);
  assert.match(fn, /applicant\$\{applicants===1\?'':'s'\} will be closed out/);
  assert.match(fn, /refund \$\{held\.toLocaleString\(\)\} credits/);
  // It picks the action so a company never has to know which verb the backend wants.
  assert.match(fn, /deletable\)return deleteDraftButton/);
});

test('every irreversible action arms before it fires', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function armedButton'), src.indexOf('function cancelProjectButton'));
  assert.match(fn, /if\(!armed\)/, 'the first click must only arm');
  assert.match(fn, /setTimeout/, 'and disarm on its own so a stray click does not linger');
});
