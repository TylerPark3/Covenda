import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordAuditEvent, recordShortlistPublished, AUDIT_EVENTS, SUBJECT_KINDS } from '../../api/audit.js';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260801200000_audit_events.sql', import.meta.url), 'utf8');
const spec = readFileSync(new URL('../../docs/v1-planning/03_V1_SPEC.md', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const apiPortal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');

// A fake Supabase client that records what would have been written.
function fakeDb(behaviour = {}) {
  const rows = [];
  return {
    rows,
    from() {
      return {
        insert: async row => {
          if (behaviour.fail) return { error: new Error('relation "audit_events" does not exist') };
          if (behaviour.throw) throw new Error('connection reset');
          rows.push(row);
          return { error: null };
        },
      };
    },
  };
}

// ── The rule that matters more than the list ───────────────────────────────────────────
// "No free-text rationale or note in any event payload." Rationale is an operator's written
// judgment about a named student. It belongs in matches.human_rationale, which is
// access-controlled. Audit logs get exported, forwarded, and read by people who were never
// granted access to the underlying record.

test('free text never reaches an audit row, whatever the caller passes', async () => {
  const db = fakeDb();
  await recordAuditEvent(db, 'shortlist.candidate_added', {
    actorUserId: 'op-1',
    subject: { kind: 'student', id: 'stu-1' },
    detail: {
      briefId: 'brief-1',
      rationale: 'Strong systems thinker, best of the five',
      note: 'call her first',
      notes: 'second thoughts',
      comment: 'nice person',
      reason: 'because',
      email: 'veer@example.com',
      phone: '+1 555 0100',
      token: 'sk_live_abc',
      secret: 'hunter2',
      password: 'hunter2',
    },
  });
  assert.equal(db.rows.length, 1);
  const detail = db.rows[0].detail;
  assert.deepEqual(Object.keys(detail), ['briefId'], 'only the structured fact survives');
  const serialised = JSON.stringify(db.rows[0]);
  for (const leak of ['Strong systems thinker', 'call her first', 'veer@example.com', '555 0100', 'sk_live_abc', 'hunter2']) {
    assert.ok(!serialised.includes(leak), `"${leak}" must not appear anywhere in the row`);
  }
});

test('the database refuses the forbidden keys too, not just the helper', () => {
  // Three enforcement points on purpose: this table will outlive whoever remembers the rule,
  // and the caller who bypasses api/audit.js is the caller that eventually exists.
  assert.match(migration, /constraint audit_events_no_free_text check/);
  for (const key of ['rationale', 'note', 'comment', 'reason', 'email', 'phone', 'token', 'secret', 'password']) {
    assert.ok(migration.includes(`'${key}'`), `${key} is rejected at the database boundary`);
  }
  assert.match(migration, /pg_column_size\(detail\) <= 4096/,
    'and a payload cannot smuggle prose through an allowed key by sheer size');
});

// ── The taxonomy is closed ─────────────────────────────────────────────────────────────
test('the event list matches the spec exactly', () => {
  const section = spec.slice(spec.indexOf('## 7. Event taxonomy'), spec.indexOf('## 7. Event taxonomy') + 700);
  for (const type of AUDIT_EVENTS) {
    assert.ok(section.includes(`\`${type}\``), `${type} is named in the V1 spec`);
  }
  // And the database agrees with the module, so a typo fails in CI rather than at 3am.
  for (const type of AUDIT_EVENTS) {
    assert.ok(migration.includes(`'${type}'`), `${type} is allowed by the check constraint`);
  }
});

test('an unknown event type is refused, not silently written', async () => {
  const db = fakeDb();
  const ok = await recordAuditEvent(db, 'shortlist.publishd', { subject: { kind: 'brief', id: 'b1' } });
  assert.equal(ok, false);
  assert.equal(db.rows.length, 0, 'a typo must not create an event class no query looks for');
});

test('an unknown subject kind degrades to null rather than being invented', async () => {
  const db = fakeDb();
  await recordAuditEvent(db, 'brief.opened', { subject: { kind: 'wormhole', id: 'x' }, detail: {} });
  assert.equal(db.rows[0].subject_kind, null);
  assert.equal(db.rows[0].subject_id, null, 'no orphan id without a kind to interpret it');
  for (const kind of SUBJECT_KINDS) {
    assert.ok(migration.includes(`'${kind}'`), `${kind} is an allowed subject kind in the schema`);
  }
});

// ── Audit must never break the thing it describes ──────────────────────────────────────
// Code deploys automatically here; migrations need a human to paste SQL. So "the table does not
// exist yet" is a routine state, not an exceptional one.

test('a failed audit write never fails the operation', async () => {
  assert.equal(await recordAuditEvent(fakeDb({ fail: true }), 'outcome.recorded', {}), false);
  assert.equal(await recordAuditEvent(fakeDb({ throw: true }), 'outcome.recorded', {}), false);
  assert.equal(await recordAuditEvent(null, 'outcome.recorded', {}), false);
  // Refusing to record an introduction because its audit row would not insert is strictly worse
  // than the missing row.
});

// ── Publishing a shortlist ─────────────────────────────────────────────────────────────
test('publishing emits one row per candidate plus a published row, correlated', async () => {
  const db = fakeDb();
  await recordShortlistPublished(db, {
    actorUserId: 'op-1', briefId: 'brief-9',
    studentUserIds: ['s1', 's2', 's3'], requestId: 'req-42',
  });
  assert.equal(db.rows.length, 4);
  assert.equal(db.rows.filter(r => r.event_type === 'shortlist.candidate_added').length, 3);
  const published = db.rows.find(r => r.event_type === 'shortlist.published');
  assert.equal(published.detail.candidateCount, 3);
  // A count, not names. The names are in the candidate_added rows, indexed by subject so they
  // can be access-controlled per student.
  assert.ok(!JSON.stringify(published.detail).includes('s1'));
  assert.ok(db.rows.every(r => r.request_id === 'req-42'), 'one request id ties the set together');
});

test('a malformed candidate list does not throw', async () => {
  for (const junk of [null, undefined, 'three', 42, {}]) {
    const db = fakeDb();
    await recordShortlistPublished(db, { actorUserId: 'op', briefId: 'b', studentUserIds: junk });
    assert.equal(db.rows.length, 1, 'the published row still lands, with zero candidates');
    assert.equal(db.rows[0].detail.candidateCount, 0);
  }
});

// ── Wiring ─────────────────────────────────────────────────────────────────────────────
test('the four lifecycle events are actually emitted from real code paths', () => {
  assert.match(admin, /recordAuditEvent\(operator\.supabase, 'outcome\.recorded'/);
  assert.match(admin, /recordAuditEvent\(supabase, 'shortlist\.candidate_added'/);
  assert.match(apiPortal, /recordAuditEvent\(member\.supabase, 'introduction\.requested'/);
  assert.match(apiPortal, /recordAuditEvent\(member\.supabase, `introduction\.\$\{status\}`/);
});

test('no call site passes rationale, note or message into an event', () => {
  for (const [name, src] of [['api/admin.js', admin], ['api/portal.js', apiPortal]]) {
    let at = 0;
    while ((at = src.indexOf('recordAuditEvent(', at + 1)) !== -1) {
      const call = src.slice(at, src.indexOf('});', at) + 3);
      const detail = call.slice(call.indexOf('detail:'));
      assert.doesNotMatch(detail, /\b(rationale|note|message|comment)\s*[,:}]/,
        `${name} passes free text into an audit event: ${call.slice(0, 120)}`);
    }
  }
});

// ── Access ─────────────────────────────────────────────────────────────────────────────
test('no browser role can read the audit log', () => {
  assert.match(migration, /revoke all on table public\.audit_events from public, anon, authenticated/);
  assert.match(migration, /enable row level security/);
  // A signed-in student who could read this would learn which companies were shown which
  // candidates, which is a worse leak than the one closed in 20260730300000.
});

test('the migration is safe to run twice', () => {
  assert.match(migration, /create table if not exists/);
  const bare = migration.match(/^\s*create index (?!if not exists)/m);
  assert.equal(bare, null, 'every index is if-not-exists, since the bundle re-runs all migrations');
});
