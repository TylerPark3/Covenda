import test from 'node:test';
import assert from 'node:assert/strict';

import { generateProjectBrief, IntakeConfigError, normalizeBrief } from '../api/project-intake.js';
import { validateUpload } from '../api/project-upload.js';

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
  assert.equal(validateUpload('application/pdf', 20 * 1024 * 1024).status, 413);
  assert.equal(validateUpload('application/pdf', 0).status, 400);
  assert.equal(validateUpload('application/pdf', 1000).ok, true);
});
