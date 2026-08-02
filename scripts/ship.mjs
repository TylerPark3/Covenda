// Test, deploy, and point covenda.app at the result.
//
// The alias used to be a separate command printed at the end for somebody to run later. It was
// forgotten repeatedly, and the failure is quiet in the worst way: the deploy succeeds, the
// tests pass, the URL is returned, and covenda.app carries on serving a build from days ago.
// Everything reports success and nothing is live.
//
// So it is one command. A deploy that cannot be aliased is a failed ship, not a partial one.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (command, args, opts = {}) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], ...opts });

const DOMAIN = process.env.COVENDA_DOMAIN || 'covenda.app';

// The project this directory is linked to. Getting this wrong is not a small mistake:
// `vercel` auto-creates a project named after the CURRENT DIRECTORY when none is linked,
// and a fresh project has NO environment variables. Ship from a git worktree and you get a
// project called e.g. "portal-onboard-lockout", a build with no Supabase URL, no admin
// allowlist and no mail key — and then the alias step points covenda.app at it. Everything
// reports success. Member sign-in is down. That happened on 2026-08-01.
//
// So: the linked project is checked BEFORE the deploy, and an unexpected one stops the ship.
const EXPECTED_PROJECT = process.env.COVENDA_VERCEL_PROJECT || 'covenda';

function linkedProject() {
  try {
    const raw = readFileSync(new URL('../.vercel/project.json', import.meta.url), 'utf8');
    return JSON.parse(raw).projectName || null;
  } catch { return null; }
}

function assertCorrectProject() {
  const linked = linkedProject();
  if (!linked) {
    console.error('\n  This directory is not linked to a Vercel project.');
    console.error(`  Run \`npx vercel link\` and pick "${EXPECTED_PROJECT}" — do NOT let it create a new one,`);
    console.error('  because a new project has none of the environment variables the site needs.\n');
    process.exit(1);
  }
  if (linked !== EXPECTED_PROJECT) {
    console.error(`\n  Refusing to ship: this directory is linked to "${linked}", not "${EXPECTED_PROJECT}".`);
    console.error('  A deploy to the wrong project builds without any environment variables, and the');
    console.error('  alias step would then point covenda.app at that broken build.\n');
    console.error(`  Fix it:  cp <main-checkout>/.vercel/project.json .vercel/project.json`);
    console.error(`  Or set:  COVENDA_VERCEL_PROJECT=${linked} npm run ship   (only if that is truly intended)\n`);
    process.exit(1);
  }
  console.log(`\n  Vercel project: ${linked}`);
}

function main() {
  assertCorrectProject();
  console.log('\n  Running the test suite.\n');
  // Inherits stdio so a failure shows which test broke rather than a bare exit code.
  execFileSync('npm', ['run', 'check'], { stdio: 'inherit' });

  console.log('\n  Deploying to production.\n');
  const output = run('npx', ['vercel', '--prod', '--yes']);

  // The CLI prints progress as well as the URL, so take the last deployment URL it emitted.
  const urls = output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g) || [];
  const deployment = urls[urls.length - 1];
  if (!deployment) {
    console.error('\n  Deployed, but no deployment URL could be read from the CLI output.');
    console.error(`  Alias it by hand once you have the URL:  npx vercel alias set <url> ${DOMAIN}\n`);
    process.exit(1);
  }

  console.log(`\n  Pointing ${DOMAIN} at ${deployment}\n`);
  run('npx', ['vercel', 'alias', 'set', deployment, DOMAIN]);

  // Verified against Vercel rather than by fetching the site: an intercepting proxy on a guest
  // network fails the fetch while the alias is perfectly fine, and that false alarm is worse
  // than no check at all.
  //
  // `vercel inspect` lists the deployment URL first and then EVERY alias pointing at it, so
  // reading the last URL in the output picked up an unrelated alias and reported a healthy
  // ship as broken. What matters is that the deployment just made appears in that set at all.
  //
  // `vercel inspect` writes its detail to STDERR, not stdout. execFileSync returns stdout
  // only, so the first version of this check compared against an empty string and reported a
  // ship that had actually worked as broken. spawnSync exposes both streams.
  const probe = spawnSync('npx', ['vercel', 'inspect', DOMAIN], { encoding: 'utf8' });
  const inspected = `${probe.stdout || ''}${probe.stderr || ''}`;
  const host = deployment.replace('https://', '');

  if (inspected.includes(host)) {
    console.log(`\n  Live. ${DOMAIN} is serving this build.\n`);
  } else {
    const listed = [...new Set(inspected.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/g) || [])];
    console.error(`\n  ${DOMAIN} does not resolve to the build just deployed.`);
    console.error(`  Expected: ${host}`);
    console.error(`  It points at: ${listed.join(', ') || 'something unreadable'}\n`);
    process.exit(1);
  }
}

main();
