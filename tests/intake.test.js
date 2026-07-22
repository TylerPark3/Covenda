import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { generateProjectBrief, IntakeConfigError, normalizeBrief } from '../api/project-intake.js';
import { blobUploadFailure, readUploadBody, uploadPolicy, validateUpload } from '../api/project-upload.js';

function anthropicResponse(object) {
  return { ok: true, async json() { return { content: [{ type: 'text', text: JSON.stringify(object) }] }; } };
}

test('normalizeBrief keeps only whitelisted taxonomy and blocks posting unless safeToPost is exactly true', () => {
  const brief = normalizeBrief({
    summary: 'x', structuredProblem: 'y', candidateDeliverables: ['a', 'b'],
    suggestedVerticals: ['Software & AI', 'Made up vertical'], suggestedWorkTypes: ['Research', 'Nonsense'],
    safetyFlags: [], safeToPost: 'yes',
  });
  assert.deepEqual(brief.suggestedVerticals, ['Software & AI']);
  assert.deepEqual(brief.suggestedWorkTypes, ['Research']);
  assert.equal(brief.safeToPost, false); // a non-true value must not allow posting
});

test('generateProjectBrief sends PDF + image content blocks and parses the JSON brief', async () => {
  let sentBody;
  const brief = await generateProjectBrief({
    problemText: 'We need a competitor pricing scan from public sources.',
    attachments: [
      { contentType: 'application/pdf', blobUrl: 'https://blob.example/a.pdf' },
      { contentType: 'image/png', blobUrl: 'https://blob.example/b.png' },
    ],
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      assert.equal(options.headers['x-api-key'], 'sk-test');
      sentBody = JSON.parse(options.body);
      return anthropicResponse({ summary: 'Scan competitors', structuredProblem: 'Public-source scan', candidateDeliverables: ['A cited comparison'], suggestedVerticals: ['Software & AI'], suggestedWorkTypes: ['Research'], safetyFlags: [], safeToPost: true });
    },
  });
  assert.equal(sentBody.model, 'claude-sonnet-5');
  assert.deepEqual(sentBody.messages[0].content.map(block => block.type), ['text', 'document', 'image']);
  assert.equal(brief.safeToPost, true);
  assert.deepEqual(brief.suggestedVerticals, ['Software & AI']);
});

test('generateProjectBrief surfaces a restricted-work safety flag and blocks posting', async () => {
  const brief = await generateProjectBrief({
    problemText: 'Clean up our patient medical records database.',
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    fetchImpl: async () => anthropicResponse({ summary: 's', structuredProblem: 'p', candidateDeliverables: [], suggestedVerticals: [], suggestedWorkTypes: [], safetyFlags: ['Involves patient records (PHI)'], safeToPost: false }),
  });
  assert.equal(brief.safeToPost, false);
  assert.match(brief.safetyFlags[0], /patient records/);
});

test('generateProjectBrief requires an Anthropic key and a real description', async () => {
  await assert.rejects(generateProjectBrief({ problemText: 'A valid enough description here', env: {}, fetchImpl: async () => anthropicResponse({}) }), IntakeConfigError);
  await assert.rejects(generateProjectBrief({ problemText: 'too short', env: { ANTHROPIC_API_KEY: 'sk' }, fetchImpl: async () => anthropicResponse({}) }), /Describe the problem/);
});

test('upload validation rejects unsupported types and oversized files', () => {
  assert.equal(validateUpload('application/x-msdownload', 100).ok, false);
  assert.equal(validateUpload('application/pdf', 5 * 1024 * 1024).status, 413);
  assert.equal(validateUpload('application/pdf', 0).status, 400);
  assert.equal(validateUpload('application/pdf', 1000).ok, true);
});

test('avatar and project uploads are capped at 4MB and use separate prefixes', () => {
  assert.equal(validateUpload('image/png', 1000, 'avatar').ok, true);
  assert.equal(validateUpload('application/pdf', 1000, 'avatar').status, 415); // a PDF is fine as an attachment, never as an avatar
  assert.equal(validateUpload('image/png', 5 * 1024 * 1024, 'avatar').status, 413);
  assert.equal(validateUpload('image/png', 5 * 1024 * 1024).status, 413);
  assert.equal(uploadPolicy('avatar').prefix, 'avatars');
  assert.equal(uploadPolicy('project').prefix, 'project-files');
});

test('upload body reader accepts both a pre-buffered runtime body and a raw stream', async () => {
  const buffered = await readUploadBody({ body: Buffer.from('buffered'), headers: {} }, 100);
  assert.equal(buffered.toString(), 'buffered');
  const stream = Readable.from([Buffer.from('raw '), Buffer.from('stream')]);
  stream.headers = {};
  const streamed = await readUploadBody(stream, 100);
  assert.equal(streamed.toString(), 'raw stream');
});

test('upload body reader identifies a consumed stream and enforces the ceiling', async () => {
  await assert.rejects(readUploadBody({ body: null, readableEnded: true, headers: { 'content-length': '12' } }, 100), error => error.code === 'UPLOAD_STREAM_CONSUMED');
  await assert.rejects(readUploadBody({ body: Buffer.alloc(101), headers: {} }, 100), error => error.code === 'UPLOAD_TOO_LARGE');
});

test('Blob failures tell an operator whether the token, store, or provider write failed', () => {
  assert.deepEqual(blobUploadFailure(new Error('Unauthorized token')).code, 'BLOB_TOKEN_INVALID');
  assert.deepEqual(blobUploadFailure(new Error('Blob store not found')).code, 'BLOB_STORE_MISSING');
  const unknown=blobUploadFailure(new Error('network reset'));
  assert.equal(unknown.code, 'BLOB_WRITE_FAILED');
  assert.doesNotMatch(unknown.error,/network reset/);
});
