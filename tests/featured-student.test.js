import test from 'node:test';
import assert from 'node:assert/strict';

import { loadFeaturedStudent } from '../api/featured-student.js';

// Minimal supabase mock: table -> canned response for the query chains the loader uses.
function mockSupabase({ profile, claims = [], projects = [], count = null }) {
  const chain = (result) => {
    const q = {};
    for (const m of ['select', 'eq', 'not', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => ({ data: result });
    q.then = (resolve) => resolve({ data: result, count });
    return q;
  };
  return {
    from(table) {
      if (table === 'member_profiles') return chain(profile);
      if (table === 'skill_claim') return chain(claims);
      if (table === 'member_projects') return chain(projects);
      return chain(null);
    },
  };
}

test('featured student endpoint returns ONLY whitelisted public fields — no PII', async () => {
  const featured = await loadFeaturedStudent(mockSupabase({
    profile: {
      user_id: 'secret-uuid', display_name: 'Jordan P.', headline: 'Builds data tools',
      school_name: 'UC Davis', graduation_year: 2027, avatar_url: '', identity_verified: true,
      skills: ['Python', 'SQL'], verticals: ['software'], work_types: ['data'],
      spotlight_consent: true, featured_at: '2026-07-20T00:00:00Z',
      email: 'leak@example.com', phone: '555-1234',
    },
    claims: [{ verification_tier: 'referral' }, { verification_tier: 'artifact' }],
    projects: [{ title: 'Churn dashboard', verticals: ['software'], status: 'complete', conversion_outcome: 'paid_extension' }],
    count: 3,
  }));
  assert.deepEqual(Object.keys(featured).sort(), [
    'avatarUrl', 'evidenceTier', 'graduationYear', 'headline', 'identityVerified',
    'name', 'projects', 'school', 'skills', 'verifiedRecords', 'verticals', 'workTypes',
  ]);
  const json = JSON.stringify(featured);
  assert.ok(!json.includes('secret-uuid') && !json.includes('leak@example.com') && !json.includes('555-1234'));
  assert.equal(featured.evidenceTier, 'silver'); // best tier is referral
  assert.equal(featured.verifiedRecords, 3);
  assert.equal(featured.projects[0].outcome, 'paid_extension');
});

test('no consented+featured student -> null, so the homepage section stays hidden', async () => {
  assert.equal(await loadFeaturedStudent(mockSupabase({ profile: null })), null);
});

test('spotlight migration adds consent (default OFF) and featured_at', async () => {
  const fs = await import('node:fs');
  const sql = fs.readFileSync('supabase/migrations/20260726350000_spotlight.sql', 'utf8');
  assert.match(sql, /spotlight_consent boolean not null default false/);
  assert.match(sql, /featured_at timestamptz/);
  assert.match(sql, /notify pgrst/);
});
