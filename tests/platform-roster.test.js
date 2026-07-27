import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlatformRoster } from '../api/admin.js';

// A tiny fake: every .from() returns the rows staged for that table.
function fakeSupabase(tables) {
  return { from: name => ({ select: () => Promise.resolve({ data: tables[name] || [], error: null }) }) };
}

const BASE = {
  member_profiles: [
    { user_id: 's1', role: 'student', display_name: 'Ada', school_name: 'Columbia', school_email_verified_at: '2026-01-01' },
    { user_id: 's2', role: 'student', display_name: 'Bo', school_name: 'NYU' },
    { user_id: 'c1', role: 'company', display_name: 'Ren', organization_name: 'Northwind', work_email_verified_at: '2026-01-02', work_email_domain: 'northwind.io' },
    { user_id: 'c2', role: 'company', display_name: 'Kim', organization_name: 'Quiet Co' },
  ],
  clubs: [{ id: 'k1', name: 'Robotics Club', school: 'Columbia', status: 'active' }],
  club_members: [
    { id: 'm1', club_id: 'k1', student_user_id: 's1', status: 'confirmed' },
    { id: 'm2', club_id: 'k1', student_user_id: 's2', status: 'claimed' },
  ],
  batch_applications: [{ batch_id: 'b1', student_user_id: 's1', status: 'accepted' }],
  member_projects: [
    { id: 'p1', owner_user_id: 'c1', assigned_student_user_id: 's1', status: 'in_progress', credits_listed: 300, credits_held: 300 },
    { id: 'p2', owner_user_id: 'c2', status: 'draft', credits_listed: 0, credits_held: 0 },
  ],
  club_confirmations: [{ club_id: 'k1', status: 'confirmed', officer_name: 'Officer Yu' }],
};

test('a school email alone never counts a student as verified', async () => {
  const r = await loadPlatformRoster(fakeSupabase(BASE));
  const ada = r.students.find(s => s.name === 'Ada');
  const bo = r.students.find(s => s.name === 'Bo');
  assert.equal(ada.verified, true, 'confirmed club membership');
  assert.equal(bo.verified, false);
  assert.equal(bo.schoolEmailVerified, false);
  assert.equal(r.totals.studentsVerified, 1);
  assert.equal(r.totals.students, 2, 'signups are still reported, just separately');
});

// A claim nobody confirmed is not evidence, and the roster must not let it look like it is.
test('unconfirmed club claims are counted apart from confirmed ones', async () => {
  const r = await loadPlatformRoster(fakeSupabase(BASE));
  const club = r.clubs[0];
  assert.equal(club.confirmed, 1);
  assert.equal(club.claimed, 2);
  assert.equal(club.lastOfficer, 'Officer Yu');
  assert.equal(r.totals.clubsWithConfirmedMembers, 1);
});

// Signing up is not using the product. Posting funded work is.
test('a company only counts as active once it has funded work', async () => {
  const r = await loadPlatformRoster(fakeSupabase(BASE));
  const north = r.companies.find(c => c.name === 'Northwind');
  const quiet = r.companies.find(c => c.name === 'Quiet Co');
  assert.equal(north.active, true);
  assert.equal(north.creditsHeld, 300);
  assert.equal(quiet.active, false, 'a draft with no credits is not activity');
  assert.equal(r.totals.companiesActive, 1);
  assert.equal(r.totals.companies, 2);
});

test('an empty platform returns zeroes rather than throwing', async () => {
  const r = await loadPlatformRoster(fakeSupabase({}));
  assert.equal(r.totals.students, 0);
  assert.deepEqual(r.students, []);
  assert.ok(r.generatedAt);
});

test('a failed table read degrades to empty instead of taking the whole view down', async () => {
  const supabase = { from: name => ({ select: () => Promise.resolve(
    name === 'clubs' ? { data: null, error: new Error('nope') } : { data: BASE[name] || [], error: null }) }) };
  const r = await loadPlatformRoster(supabase);
  assert.deepEqual(r.clubs, []);
  assert.equal(r.totals.students, 2, 'the rest of the view still works');
});
