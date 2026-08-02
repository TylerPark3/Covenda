// Does the local server actually have a database behind it?
//
// `vercel env pull` cannot retrieve variables marked Sensitive in the Vercel dashboard — that
// is the whole point of the flag, and it returns the literal string [SENSITIVE] or nothing at
// all. So a local run can come up perfectly, serve every page, and then fail on the first
// query with an error that looks like a code bug.
//
// This runs before the dev server and says which it is, because "the portal is broken locally"
// and "the portal has no credentials locally" look identical from the browser.

import { readFileSync, existsSync } from 'node:fs';

const ENV_FILE = '.env.local';

// The variables the API genuinely cannot work without, and what each one breaks.
const REQUIRED = [
  ['SUPABASE_URL', 'every database read and write'],
  ['SUPABASE_SECRET_KEY', 'server-side database access', ['SUPABASE_SERVICE_ROLE_KEY']],
];
const OPTIONAL = [
  ['RESEND_API_KEY', 'sign-in emails and notifications'],
  ['COVENDA_ADMIN_EMAILS', 'operator access to /admin.html'],
];

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
// Values may arrive quoted from a host CLI and unquoted when hand-edited.
    out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// A placeholder is worse than a missing value: it satisfies a truthiness check and then fails
// at the point of use, several layers away from the cause.
const isPlaceholder = value => !value
  || /^\[SENSITIVE\]$/i.test(value)
  || /^(your|paste|xxx|todo|changeme)/i.test(value);

const env = readEnv();
const resolve = ([name, , alternates = []]) => [name, ...alternates].map(n => env[n]).find(v => !isPlaceholder(v));

const missing = REQUIRED.filter(spec => !resolve(spec));
const missingOptional = OPTIONAL.filter(([name]) => isPlaceholder(env[name]));

if (!missing.length) {
  const skipped = missingOptional.map(([name, breaks]) => `      ${name} — ${breaks}`);
  console.log('\n  Database credentials found. Starting the local server.');
  if (skipped.length) console.log('\n  Not set, so these will not work locally:\n' + skipped.join('\n'));
  console.log('');
  process.exit(0);
}

console.log(`
  The local server has no database.

  ${missing.map(([name, breaks]) => `${name} is missing or is a placeholder — breaks ${breaks}.`).join('\n  ')}

  This is not a bug in the site. Variables marked Sensitive in Vercel cannot be
  read back by \`vercel env pull\`, by design, so they never arrive locally.

  To fix it, open the Supabase dashboard for this project:
      Project Settings -> API

  Copy two values into ${ENV_FILE}:
      SUPABASE_URL=          the Project URL
      SUPABASE_SECRET_KEY=   the service_role key

  ${ENV_FILE} is gitignored, so nothing you paste there is committed or deployed.

  Pages, CSS and client JavaScript all work without this. Signing in, the portal,
  and the admin do not.

  Start anyway with:  npm run local:force
`);

// `npm run local -- --force` appends the flag to the END of the whole script string, so it
// lands on `vercel dev` rather than here and the guard never sees it. That is why the printed
// escape hatch never worked. `npm run local:force` passes it to this process, and the env var
// covers a shell that has already decided it is fine running without a database.
const forced = process.argv.includes('--force') || process.env.COVENDA_FORCE_LOCAL === '1';
process.exit(forced ? 0 : 1);
