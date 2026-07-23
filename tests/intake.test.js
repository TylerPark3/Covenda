import test from 'node:test';
import assert from 'node:assert/strict';

import { generateProjectBrief, IntakeConfigError, normalizeBrief } from '../api/project-intake.js';
import { uploadPolicy, validateUpload } from '../api/project-upload.js';

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

test('generateProjectBrief reads private files server-side and sends them as base64, not URLs', async () => {
  let sentBody;
  const loaded = [];
  const brief = await generateProjectBrief({
    problemText: 'We need a competitor pricing scan from public sources.',
    attachments: [
      { contentType: 'application/pdf', blobUrl: 'https://blob.example/a.pdf' },
      { contentType: 'image/png', blobUrl: 'https://blob.example/b.png' },
      { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', blobUrl: 'https://blob.example/c.docx' },
    ],
    env: { ANTHROPIC_API_KEY: 'sk-test', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' },
    loadBlob: async attachment => { loaded.push(attachment.blobUrl); return 'ZmFrZQ=='; },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      assert.equal(options.headers['x-api-key'], 'sk-test');
      sentBody = JSON.parse(options.body);
      return anthropicResponse({ summary: 'Scan competitors', structuredProblem: 'Public-source scan', candidateDeliverables: ['A cited comparison'], suggestedVerticals: ['Software & AI'], suggestedWorkTypes: ['Research'], safetyFlags: [], safeToPost: true });
    },
  });
  const content = sentBody.messages[0].content;
  // the .docx is not a Claude-readable type, so it is never fetched or sent
  assert.deepEqual(loaded, ['https://blob.example/a.pdf', 'https://blob.example/b.png']);
  assert.deepEqual(content.map(block => block.type), ['text', 'document', 'image']);
  assert.deepEqual(content[1].source, { type: 'base64', media_type: 'application/pdf', data: 'ZmFrZQ==' });
  assert.equal(content[2].source.type, 'base64');
  assert.equal(brief.safeToPost, true);
});

test('an unreadable attachment is skipped rather than sinking the whole brief', async () => {
  let sentBody;
  await generateProjectBrief({
    problemText: 'We need a competitor pricing scan from public sources.',
    attachments: [{ contentType: 'application/pdf', blobUrl: 'https://blob.example/a.pdf' }],
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    loadBlob: async () => { throw new Error('blob unreachable'); },
    fetchImpl: async (url, options) => { sentBody = JSON.parse(options.body); return anthropicResponse({ summary: 's', structuredProblem: 'p', candidateDeliverables: [], suggestedVerticals: [], suggestedWorkTypes: [], safetyFlags: [], safeToPost: true }); },
  });
  // still calls Claude with just the text block — the failed file does not throw
  assert.deepEqual(sentBody.messages[0].content.map(block => block.type), ['text']);
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

test('the intake request uses Structured Outputs (opus-4-8, schema, >=4000 tokens)', async () => {
  let body;
  await generateProjectBrief({
    problemText: 'We need a competitor pricing scan from public sources.',
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    fetchImpl: async (url, options) => { body = JSON.parse(options.body); return anthropicResponse({ title: 't', summary: 's', context: 'c', objective: 'o', scopeInclusions: [], scopeExclusions: [], candidateDeliverables: [], approvedInputs: [], suggestedVerticals: [], suggestedWorkTypes: [], estimatedEffort: '', safetyFlags: [], safeToPost: true }); },
  });
  assert.equal(body.model, 'claude-opus-4-8');
  assert.ok(body.max_tokens >= 4000);
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.format.schema.additionalProperties, false);
});

test('normalizeBrief shapes the BCG fields including deliverable cards', () => {
  const brief = normalizeBrief({
    title: 'Competitor pricing scan', summary: 's', context: 'ctx', objective: 'obj',
    scopeInclusions: ['a'], scopeExclusions: ['b'], approvedInputs: ['public pages'],
    candidateDeliverables: [{ title: 'Comparison sheet', description: 'd', acceptanceCriteria: 'cited' }, 'bare string'],
    suggestedVerticals: ['Software & AI'], suggestedWorkTypes: ['Research'], estimatedEffort: '~20 hours', safetyFlags: [], safeToPost: true,
  });
  assert.equal(brief.title, 'Competitor pricing scan');
  assert.equal(brief.context, 'ctx');
  assert.equal(brief.objective, 'obj');
  assert.deepEqual(brief.scopeInclusions, ['a']);
  assert.equal(brief.candidateDeliverables[0].acceptanceCriteria, 'cited');
  assert.equal(brief.candidateDeliverables[1].title, 'bare string'); // a bare string coerces to a card
  assert.equal(brief.estimatedEffort, '~20 hours');
});

test('a model refusal is surfaced as a safety message, not a crash', async () => {
  await assert.rejects(
    generateProjectBrief({ problemText: 'A description long enough to pass the gate', env: { ANTHROPIC_API_KEY: 'sk-test' }, fetchImpl: async () => ({ ok: true, async json() { return { stop_reason: 'refusal', content: [] }; } }) }),
    /declined to draft/,
  );
});

test('a 4xx rejection of Structured Outputs falls back to a plain call', async () => {
  const bodies = [];
  const brief = await generateProjectBrief({
    problemText: 'We need a competitor pricing scan from public sources.',
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body); bodies.push(body);
      if (body.output_config) return { ok: false, status: 400, async json() { return { error: 'unknown param' }; } };
      return anthropicResponse({ title: 't', summary: 's', context: '', objective: '', scopeInclusions: [], scopeExclusions: [], candidateDeliverables: [], approvedInputs: [], suggestedVerticals: [], suggestedWorkTypes: [], estimatedEffort: '', safetyFlags: [], safeToPost: true });
    },
  });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].output_config.format.type, 'json_schema');
  assert.equal(bodies[1].output_config, undefined);
  assert.equal(brief.safeToPost, true);
});

test('upload validation rejects unsupported types and oversized files', () => {
  assert.equal(validateUpload('application/x-msdownload', 100).ok, false);
  assert.equal(validateUpload('application/pdf', 20 * 1024 * 1024).status, 413);
  assert.equal(validateUpload('application/pdf', 0).status, 400);
  assert.equal(validateUpload('application/pdf', 1000).ok, true);
});

test('avatar uploads are image-only, capped at 5MB, and stored under their own prefix', () => {
  assert.equal(validateUpload('image/png', 1000, 'avatar').ok, true);
  assert.equal(validateUpload('application/pdf', 1000, 'avatar').status, 415); // a PDF is fine as an attachment, never as an avatar
  assert.equal(validateUpload('image/png', 6 * 1024 * 1024, 'avatar').status, 413);
  assert.equal(validateUpload('image/png', 6 * 1024 * 1024).ok, true); // same size is fine for a project attachment
  assert.equal(uploadPolicy('avatar').prefix, 'avatars');
  assert.equal(uploadPolicy('project').prefix, 'project-files');
  // project files are private (AI reads them server-side); avatars stay public so they render
  assert.equal(uploadPolicy('project').access, 'private');
  assert.equal(uploadPolicy('avatar').access, 'public');
});
