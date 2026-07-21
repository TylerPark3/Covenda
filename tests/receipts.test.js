import test from 'node:test';
import assert from 'node:assert/strict';

import handler, { findReceipt, receiptLookupInput } from '../api/receipts.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('receipt lookup normalizes a valid reference and email', () => {
  assert.deepEqual(receiptLookupInput({ reference: ' stu-ab12cd34 ', email: ' Student@Example.EDU ' }), {
    reference: 'STU-AB12CD34',
    email: 'student@example.edu',
  });
  assert.throws(
    () => receiptLookupInput({ reference: 'STU-bad', email: 'not-an-email' }),
    /valid receipt reference/,
  );
});

test('receipt lookup returns only minimal server state through the Data API', async () => {
  const sourceRow = {
    reference: 'STU-AB12CD34',
    submission_type: 'student_interest',
    status: 'reviewing',
    created_at: '2026-07-21T12:00:00.000Z',
    updated_at: '2026-07-22T12:00:00.000Z',
    details: { privateAnswer: 'must not leave the server' },
    submitter_email: 'student@example.edu',
  };
  const filters = [];
  const result = await findReceipt({ reference: 'STU-AB12CD34', email: 'student@example.edu' }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
    createSupabaseClient(url, secret, options) {
      assert.equal(url, 'https://project.supabase.co');
      assert.equal(secret, 'sb_secret_test');
      assert.equal(options.auth.persistSession, false);
      return {
        from(table) {
          assert.equal(table, 'submissions');
          return {
            select(columns) {
              assert.equal(columns, 'reference,submission_type,status,created_at,updated_at');
              return this;
            },
            eq(column, value) { filters.push([column, value]); return this; },
            async maybeSingle() { return { data: sourceRow, error: null }; },
          };
        },
      };
    },
  });
  assert.deepEqual(filters, [
    ['reference', 'STU-AB12CD34'],
    ['submitter_email', 'student@example.edu'],
  ]);
  assert.deepEqual(result, {
    route: 'data-api',
    receipt: {
      reference: 'STU-AB12CD34',
      type: 'student_interest',
      status: 'reviewing',
      createdAt: '2026-07-21T12:00:00.000Z',
      updatedAt: '2026-07-22T12:00:00.000Z',
    },
  });
  assert.equal(JSON.stringify(result).includes('privateAnswer'), false);
  assert.equal(JSON.stringify(result).includes('student@example.edu'), false);
});

test('receipt lookup falls back to the server-only Postgres connection', async () => {
  let ended = false;
  const sql = async () => [{
    reference: 'EMP-AB12CD34',
    submission_type: 'employer_intake',
    status: 'received',
    created_at: '2026-07-21T12:00:00.000Z',
    updated_at: '2026-07-21T12:00:00.000Z',
  }];
  sql.end = async () => { ended = true; };
  const result = await findReceipt({ reference: 'EMP-AB12CD34', email: 'owner@example.com' }, {
    env: {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      POSTGRES_URL: 'postgres://pooled.example/db',
    },
    createSupabaseClient() { throw new Error('Data API unavailable'); },
    createPostgresClient(connectionString, options) {
      assert.equal(connectionString, 'postgres://pooled.example/db');
      assert.equal(options.max, 1);
      return sql;
    },
  });
  assert.equal(result.route, 'postgres');
  assert.equal(result.receipt.reference, 'EMP-AB12CD34');
  assert.equal(ended, true);
});

test('receipt handler recovers a matching receipt without private answers', async () => {
  const response = responseRecorder();
  await handler({
    method: 'POST',
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '198.51.100.42' },
    body: { reference: 'STU-AB12CD34', email: 'student@example.edu' },
  }, response, {
    async findReceiptRecord(input) {
      assert.equal(input.email, 'student@example.edu');
      return {
        route: 'data-api',
        receipt: {
          reference: input.reference,
          type: 'student_interest',
          status: 'reviewing',
          createdAt: '2026-07-21T12:00:00.000Z',
          updatedAt: '2026-07-22T12:00:00.000Z',
        },
      };
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.receipt.status, 'reviewing');
  assert.deepEqual(Object.keys(response.body.receipt).sort(), ['createdAt', 'reference', 'status', 'type', 'updatedAt']);
});

test('receipt handler keeps lookup private and returns generic not-found state', async () => {
  const crossOrigin = responseRecorder();
  await handler({
    method: 'POST',
    headers: { origin: 'https://attacker.example', host: 'proof-path.vercel.app' },
    body: { reference: 'STU-AB12CD34', email: 'student@example.edu' },
  }, crossOrigin);
  assert.equal(crossOrigin.statusCode, 403);

  const notFound = responseRecorder();
  await handler({
    method: 'POST',
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '198.51.100.43' },
    body: { reference: 'STU-AB12CD34', email: 'student@example.edu' },
  }, notFound, { async findReceiptRecord() { return { receipt: null, route: 'data-api' }; } });
  assert.equal(notFound.statusCode, 404);
  assert.match(notFound.body.error, /No matching receipt/);
  assert.equal('receipt' in notFound.body, false);
});
