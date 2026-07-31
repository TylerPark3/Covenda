import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TIERS, presentationBand, claimsFromProfile } from '../../api/evidence.js';
import { studentEvidenceTier } from '../../api/portal.js';

const apiDir = new URL('../../api/', import.meta.url);

// RESUME.md claimed for some time that api/evidence.js had no callers and that portal.js carried
// a rival `studentEvidenceTier`, so there were "two ladders" to collapse. That claim survived
// long enough to be written into a V1 spec as a blocking requirement before anyone checked it.
//
// There is one ladder. These tests pin that, so the phantom cannot be reintroduced by a stale
// note — and so a genuine second ladder would fail loudly if one ever appeared.
test('there is exactly one tier vocabulary', () => {
  assert.deepEqual(TIERS, ['claimed', 'artifact', 'referral', 'trial']);
});

test('studentEvidenceTier delegates rather than deciding', () => {
  const src = readFileSync(new URL('portal.js', apiDir), 'utf8');
  assert.match(src, /import \{[^}]*claimsFromProfile[^}]*presentationBand[^}]*\} from '\.\/evidence\.js'/,
    'api/portal.js imports the ladder rather than defining one');
  const fn = src.slice(src.indexOf('export function studentEvidenceTier'), src.indexOf('export function rankOpportunities'));
  assert.match(fn, /return presentationBand\(claimsFromProfile\(/, 'it is a wrapper, not a second implementation');
  assert.doesNotMatch(fn, /'bronze'|'silver'|'gold'|'self_reported'/, 'it must not name bands itself');
});

// Bands are a presentation of tiers, not a competing scale. The mapping lives beside the tiers
// it maps, so the two cannot drift apart in separate files.
test('bands are derived from tiers, in the same module', () => {
  const src = readFileSync(new URL('evidence.js', apiDir), 'utf8');
  assert.match(src, /TIER_TO_BAND/);
  assert.match(src, /export function presentationBand/);
  for (const band of ['gold', 'silver', 'bronze', 'self_reported']) assert.ok(src.includes(`'${band}'`));
});

test('the band follows the strongest evidence, never an average', () => {
  const strong = claimsFromProfile({ skill_signals: { github: ['repo'] } }, { completedCount: 1 });
  assert.equal(presentationBand(strong), 'gold', 'one accepted trial outranks weaker claims');
  assert.equal(presentationBand([]), 'self_reported', 'nothing on file is self-reported, not a failure');
  assert.equal(studentEvidenceTier({ skill_signals: { github: ['repo'] } }, 0), 'bronze');
  assert.equal(studentEvidenceTier({ referral_verified: true }, 0), 'silver');
  assert.equal(studentEvidenceTier({}, 1), 'gold');
});

// The ceiling is the entire point of the module: a source cannot establish more than it can
// establish, whatever it claims. Reading a raw tier instead of the post-ceiling one would
// silently discard every ceiling.
test('the band reads the post-ceiling tier', () => {
  const src = readFileSync(new URL('evidence.js', apiDir), 'utf8');
  const fn = src.slice(src.indexOf('export function presentationBand'), src.indexOf('export function claimsFromProfile'));
  assert.match(fn, /claim\?\.verification_tier/, 'the ceiling-applied tier, not the requested one');
});

// A second module defining its own band vocabulary is what the phantom described. If one ever
// appears, this fails.
test('no other module invents a band vocabulary', () => {
  const offenders = [];
  for (const file of readdirSync(apiDir).filter(f => f.endsWith('.js') && f !== 'evidence.js')) {
    const src = readFileSync(new URL(file, apiDir), 'utf8');
    if (/TIER_TO_BAND|=\s*\[\s*'claimed'\s*,\s*'artifact'/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `these define their own ladder instead of importing evidence.js: ${offenders.join(', ')}`);
});
