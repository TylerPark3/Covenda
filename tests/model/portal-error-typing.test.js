// How a failure is classified decides what the member is told to do. Getting it wrong is not
// cosmetic: 503 means "retry shortly", so a member retries a permission error forever.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PortalInputError, PortalForbiddenError, PortalOperationalError } from '../../api/portal.js';

const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const code = portal.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

test('input errors carry their message and optional field', () => {
  const e = new PortalInputError('Pick a project first.', 'projectId');
  assert.equal(e.publicMessage, 'Pick a project first.');
  assert.equal(e.field, 'projectId');
  assert.ok(e instanceof Error);
});

test('forbidden is its own type — refusal is not unavailability', () => {
  const e = new PortalForbiddenError('Only the owner can cancel this project.');
  assert.equal(e.publicMessage, 'Only the owner can cancel this project.');
  assert.ok(!(e instanceof PortalInputError));
});

test('typed errors are checked BEFORE the English-prefix fallback', () => {
  const catchBlock = code.slice(code.lastIndexOf('} catch (error) {'));
  const forbidden = catchBlock.indexOf('PortalForbiddenError');
  const input = catchBlock.indexOf('PortalInputError');
  const prefixGuess = catchBlock.indexOf('/^(Enter|Choose|Only');
  assert.ok(forbidden > -1 && input > -1 && prefixGuess > -1);
  assert.ok(forbidden < prefixGuess, 'forbidden must be classified before guessing at words');
  assert.ok(input < prefixGuess, 'input must be classified before guessing at words');
});

test('forbidden answers 403 and input answers 400', () => {
  const catchBlock = code.slice(code.lastIndexOf('} catch (error) {'));
  assert.match(catchBlock, /PortalForbiddenError[\s\S]{0,200}status\(403\)/);
  assert.match(catchBlock, /PortalInputError[\s\S]{0,200}status\(400\)/);
});

test('a programming fault answers 500, not 503 — retrying a TypeError never helps', () => {
  const fn = code.slice(code.indexOf('function portalFailure(error)'),
                        code.indexOf('function portalFailure(error)') + 1600);
  assert.match(fn, /TypeError/);
  assert.match(fn, /status: 500/);
  assert.match(fn, /PORTAL_BUG/);
});

test('operational errors still answer 503 — a dependency being down IS temporary', () => {
  const fn = code.slice(code.indexOf('function portalFailure(error)'),
                        code.indexOf('function portalFailure(error)') + 1600);
  assert.match(fn, /PortalOperationalError.*status: 503/s);
  assert.ok(new PortalOperationalError('X', 'msg') instanceof Error);
});

// refresh-roles was the action that produced an undiagnosable 503 for a real student.
test('refresh-roles reports a verdict, not just a per-board report', () => {
  const fn = code.slice(code.indexOf('export async function refreshOpenRoles'),
                        code.indexOf('export async function matchResumeToRoles'));
  assert.match(fn, /outcome:/, 'the caller gets a stated outcome');
  assert.match(fn, /no_boards_reachable/, 'zero reachable boards is a named outcome, not silence');
  assert.match(fn, /summary:/, 'and a sentence the UI can show verbatim');
});

test('a failed write throws instead of being reported as a successful refresh', () => {
  const fn = code.slice(code.indexOf('export async function refreshOpenRoles'),
                        code.indexOf('export async function matchResumeToRoles'));
  assert.match(fn, /if \(report\.error\)[\s\S]{0,220}throw new PortalOperationalError/,
    'the handler wraps the return in {ok:true}, so a failed write must not return normally');
  assert.match(fn, /ROLES_WRITE_FAILED/);
});
