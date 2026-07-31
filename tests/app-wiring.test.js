import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../app.js', import.meta.url), 'utf8');

// app.js wires the whole page from one uninterrupted run of top-level code. That makes a missing
// element uniquely expensive: `$('#gone').addEventListener(...)` does not merely skip its own
// button, it throws, aborts the script, and leaves every listener BELOW it unattached. The page
// then renders perfectly and does nothing — no console error a user would ever see, no clue
// which line did it.
//
// This is not hypothetical. ddca447 removed [data-clear-draft] from the markup and left the
// line that required it, which killed the audience nav, the workspace tabs, the work-type
// buttons, every dialog close button, and the intro screen in one go.
//
// So: any selector reached WITHOUT optional chaining before .addEventListener has to exist in
// the markup. Guarded calls (`?.`) are free to miss — that is what the guard is for.
const UNGUARDED = /\$\(\s*'([^']+)'\s*(?:,\s*[A-Za-z_$][\w$]*\s*)?\)\s*\.addEventListener/g;

function selectorsPresentIn(markup, selector) {
  const id = selector.match(/^#([\w-]+)$/);
  if (id) return new RegExp(`id=["']${id[1]}["']`).test(markup);
  const attr = selector.match(/^\[([\w-]+)(?:[~^|$*]?=)?/);
  if (attr) return markup.includes(attr[1]);
  const cls = selector.match(/^\.([\w-]+)$/);
  if (cls) return new RegExp(`class=["'][^"']*\\b${cls[1]}\\b`).test(markup);
  return null; // shape we cannot check statically; not a failure
}

test('every unguarded listener target exists in the markup', () => {
  const missing = [];
  for (const [, selector] of script.matchAll(UNGUARDED)) {
    const present = selectorsPresentIn(html, selector);
    if (present === false) missing.push(selector);
  }
  assert.deepEqual(
    missing,
    [],
    `app.js attaches listeners to selectors absent from index.html. Each one aborts app.js at that `
    + `line and silently unwires every control below it. Add ?. if the element is genuinely `
    + `optional, or restore it to the markup: ${missing.join(', ')}`,
  );
});

// The specific line that broke the site, pinned so a future edit cannot quietly un-guard it.
test('the clear-draft listener stays optional', () => {
  assert.match(
    script,
    /\$\('\[data-clear-draft\]', form\)\?\.addEventListener/,
    '[data-clear-draft] is not in index.html, so this call must stay optional-chained',
  );
});

// The wiring below the old break point is the part users actually notice. If any of these stop
// being reachable, the page looks fine and responds to nothing.
test('the controls downstream of the break point are still wired', () => {
  for (const hook of [
    "$$('[data-audience-option]')",
    "$$('[data-workspace-tab]')",
    "$$('[data-work-type]')",
    "$$('[data-close-dialog]')",
    "$$('[data-action]')",
  ]) {
    assert.ok(script.includes(hook), `${hook} wiring is missing from app.js`);
  }
});
