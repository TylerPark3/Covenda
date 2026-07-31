import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

// Three panels carried the same gold gradient stack, copy-pasted, one of them with a comment
// saying "lifted verbatim so the two golds are the same gold". That arrangement is what
// guarantees they stop being the same gold, and they had already diverged.
test('the gold surface is defined once and reused', () => {
  const literal = (css.match(/radial-gradient\(130% 130% at 78% 88%/g) || []).length;
  assert.equal(literal, 1, `the gold stack is written out ${literal} times instead of once`);
  assert.match(css, /--gold-surface:/);
  const callers = (css.match(/background: var\(--gold-surface\)/g) || []).length;
  assert.ok(callers >= 3, `only ${callers} panels use the shared surface`);
});

test('shape-specific gold is a single overridden layer, not a second stack', () => {
  // A tall band needs its deep stops top and bottom; a short wide panel needs them at the
  // sides. That difference is one layer, so it is one custom property rather than a fork.
  assert.match(css, /--gold-surface-edge: none;/, 'the edge layer has no default');
  assert.match(css, /--gold-surface-edge:\s*\n?\s*radial-gradient\(150% 60% at 50% -8%/,
    'the tall band no longer sets its own edge gold');
  // And the override does not restate the rest of the stack.
  const band = css.slice(css.indexOf('.made-by {'), css.indexOf('.made-by-copy'));
  assert.ok(!/at 18% 18%/.test(band), 'the band restates layers it should inherit');
});

test('the shadow travels with the surface', () => {
  assert.match(css, /--gold-surface-shadow:/);
  assert.ok((css.match(/box-shadow: var\(--gold-surface-shadow\)/g) || []).length >= 2);
});
