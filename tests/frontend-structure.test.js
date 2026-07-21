import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('inline JavaScript parses', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
});

test('HTML ids remain unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('both live intake paths have five progressive steps and a receipt', () => {
  assert.equal((html.match(/data-employer-step=/g) || []).length, 5);
  assert.equal((html.match(/data-student-step=/g) || []).length, 5);
  for (const id of ['employerReceipt', 'studentReceipt', 'employerReviewSummary', 'studentReviewSummary']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('intro types once per browser, stays skippable, and respects reduced motion', () => {
  assert.match(html, /id="introSkip"/);
  assert.match(html, /data-intro-type="Students get paid\."/);
  assert.match(html, /data-intro-type="Employers get work done\."/);
  assert.match(html, /localStorage\.getItem\(introStorageKey\)/);
  assert.match(html, /localStorage\.setItem\(introStorageKey,'1'\)/);
  assert.doesNotMatch(html, /sessionStorage/);
  assert.match(html, /const typeIntro=/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test('homepage avoids fake logo and traction treatments', () => {
  assert.doesNotMatch(html, /upload\.wikimedia\.org/);
  assert.doesNotMatch(html, /id="networkTally"/);
  assert.doesNotMatch(html, /<button[^>]+data-view="ops"/);
});

test('How it works shows the managed boomerang in the operating order', () => {
  const stages = [...html.matchAll(/data-boomerang-stage="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(stages, [
    'company-problem',
    'proofpath-scope',
    'student-work',
    'proofpath-review',
    'company-decision'
  ]);
  assert.match(html, /company-ready presentation/);
  assert.match(html, /No raw handoff\./);
});

test('overview is concise, restores honest tickers, and keeps display typography consistent', () => {
  assert.match(html, /<section class="view" id="processView">/);
  assert.match(html, /<button data-view="process">How it works<\/button>/);
  assert.equal((html.match(/class="campus-ticker /g) || []).length, 2);
  assert.match(html, /<b>Companies<\/b>/);
  assert.match(html, /<b>Talent<\/b>/);
  assert.match(html, /No company or university partnership claimed/);
  assert.doesNotMatch(html, /class="foundation-section"/);
  assert.doesNotMatch(html, /class="current-stage reveal"/);
  assert.match(html, /<p class="marketing-subhead">We shape the safe work unit\.<\/p>/);
  assert.match(html, /<button class="secondary" data-schedule>Discuss a real problem<\/button>/);
  assert.match(html, /\.audience-panel \.marketing-subhead\{[^}]*var\(--serif\)/);
});

test('employer product loop preserves the full boomerang order and ownership', () => {
  const stages = [...html.matchAll(/data-product-loop-tab="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(stages, [
    'problem',
    'scope',
    'approval',
    'sourcing',
    'applications',
    'review',
    'shortlist',
    'selection',
    'work',
    'qa',
    'decision'
  ]);
  assert.match(html, /AI-assisted, founder-reviewed project design\./);
  assert.match(html, /The employer—not Covenda—chooses\./);
  assert.match(html, /Completed work returns to Covenda first\./);
});

test('product loop states launch, memo, payment, and scoring boundaries', () => {
  const loop = html.match(/<section class="system-section product-loop"[\s\S]*?<section id="intake">/i)?.[0] || '';
  assert.match(loop, /Payment setup pending · illustrative control/);
  assert.match(loop, /150–450 words/);
  assert.match(loop, /45-minute cap/);
  assert.match(loop, /3\+ public sources/);
  assert.match(loop, /Fictional composites · not applicants/);
  assert.match(loop, /No raw handoff/);
  assert.match(loop, /Not a universal employability score/);
  assert.match(loop, /No automatic match\. No employment guarantee\./);
  const weights = [...loop.matchAll(/data-composite-weight="(\d+)"/g)].map(match => Number(match[1]));
  assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 100);
});

test('overview keeps market context compact and beside each audience', () => {
  const proofs = [...html.matchAll(/data-overview-proof="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(proofs, [
    'company-capacity',
    'company-low-value-work',
    'student-skills-hiring',
    'student-intern-conversion'
  ]);
  assert.match(html, /Context, not traction/);
  assert.doesNotMatch(html, /class="evidence-quotes"/);
  assert.doesNotMatch(html, /class="evidence-quote-list"/);
});

test('Calendly is the configured booking outcome with the call-request form as fallback', () => {
  assert.match(html, /name="proofpath-calendly-url" content=""/);
  assert.match(html, /url\.hostname==='calendly\.com'\|\|url\.hostname\.endsWith\('\.calendly\.com'\)/);
  assert.match(html, /if\(calendlyUrl\).*window\.open\(calendlyUrl,'_blank','noopener,noreferrer'\)/s);
  assert.match(html, /resetSchedule\(\);scheduleDialog\.showModal\(\)/);
});

test('project packet renders submitted facts without assigning raw input to innerHTML', () => {
  assert.doesNotMatch(html, /\$\('#packetFacts'\)\.innerHTML/);
  assert.match(html, /safeList\(\$\('#packetFacts'\)/);
});
