// Test, deploy, and point covenda.app at the result.
//
// The alias used to be a separate command printed at the end for somebody to run later. It was
// forgotten repeatedly, and the failure is quiet in the worst way: the deploy succeeds, the
// tests pass, the URL is returned, and covenda.app carries on serving a build from days ago.
// Everything reports success and nothing is live.
//
// So it is one command. A deploy that cannot be aliased is a failed ship, not a partial one.

import { execFileSync } from 'node:child_process';

const run = (command, args, opts = {}) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], ...opts });

const DOMAIN = process.env.COVENDA_DOMAIN || 'covenda.app';

function main() {
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
  const inspected = run('npx', ['vercel', 'inspect', DOMAIN]);
  const live = (inspected.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g) || []).pop();

  if (live && deployment.includes(live.replace('https://', '').split('.')[0])) {
    console.log(`\n  Live. ${DOMAIN} is serving this build.\n`);
  } else {
    console.error(`\n  ${DOMAIN} does not resolve to the build just deployed.`);
    console.error(`  It points at: ${live || 'something unreadable'}\n`);
    process.exit(1);
  }
}

main();
