import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const sql = Object.fromEntries(files.map(f => [f, readFileSync(new URL(f, dir), 'utf8')]));
const all = Object.values(sql).join('\n');

// A Postgres view runs as its OWNER, not its caller. Every view here reads tables that revoke
// anon and authenticated, so a view without security_invoker hands those roles exactly what the
// table refuses — which is what Supabase's 0010_security_definer_view lint flagged as critical
// on people_directory and people_possible_duplicates.
//
// The failure mode is quiet: the view looks ordinary, the table looks locked down, and the hole
// only exists at the join between them. Pinning it here means a new view has to be deliberate
// about it rather than inheriting the unsafe default.
const CREATE_VIEW = /create\s+(?:or\s+replace\s+)?view\s+([\w.]+)([\s\S]{0,120}?)\bas\b/gi;

test('every view runs as its caller, not its owner', () => {
  const unsafe = [];
  for (const [file, body] of Object.entries(sql)) {
    for (const [, name, opts] of body.matchAll(CREATE_VIEW)) {
      if (!/security_invoker\s*=\s*on/i.test(opts)) unsafe.push(`${name} (${file})`);
    }
  }
  assert.deepEqual(
    unsafe,
    [],
    'these views execute with owner privileges and will bypass RLS on the tables they read. '
    + `Add "with (security_invoker = on)" to each: ${unsafe.join(', ')}`,
  );
});

// security_invoker fixes execution. It does not undo a grant the view already inherited from the
// default public-schema privileges, which is the other half of how this opened.
test('the people views are revoked from the browser roles', () => {
  for (const view of ['people_directory', 'people_possible_duplicates']) {
    assert.match(
      all,
      new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${view}\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'),
      `public.${view} must revoke the roles that are revoked from public.submissions beneath it`,
    );
    assert.match(
      all,
      new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${view}\\s+to\\s+service_role`, 'i'),
      `public.${view} should still be readable by the server`,
    );
  }
});

// The protection is only meaningful while the table underneath stays locked down.
test('submissions itself stays revoked from the browser roles', () => {
  assert.match(all, /alter\s+table\s+public\.submissions\s+enable\s+row\s+level\s+security/i);
  assert.match(all, /revoke\s+all\s+on\s+table\s+public\.submissions\s+from\s+public,\s*anon,\s*authenticated/i);
});

// Every SECURITY DEFINER function must pin search_path, or a caller can shadow the objects it
// resolves and run their own code with the definer's rights (Supabase lint 0011).
test('security definer functions pin their search_path', () => {
  const missing = Object.entries(sql)
    .filter(([, body]) => /security\s+definer/i.test(body) && !/set\s+search_path/i.test(body))
    .map(([file]) => file);
  assert.deepEqual(missing, [], `SECURITY DEFINER without a pinned search_path: ${missing.join(', ')}`);
});
