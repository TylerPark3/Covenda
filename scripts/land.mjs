// Land the current branch on main, with the checks that make that safe.
//
// The manual version is `git push origin <branch>:main`, which works and skips every
// guard: it will happily push a branch with failing tests, uncommitted work still in the
// tree, or a history that has diverged from main since you last looked. This does the same
// push, in one command, after establishing that none of those are true.
//
//   npm run land              # test, verify, push current branch to main
//   npm run land -- --dry-run # everything except the push
//
// It refuses rather than forces. A non-fast-forward means someone else moved main, and the
// answer to that is to look at what they did — never --force, which is how you delete
// somebody's work while believing you shipped yours.

import { execFileSync } from 'node:child_process';

const DRY = process.argv.includes('--dry-run');

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }).trim();

function fail(message, remedy) {
  console.error(`\n  Refusing to land: ${message}`);
  if (remedy) console.error(`  ${remedy}`);
  console.error('');
  process.exit(1);
}

function main() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch === 'main' || branch === 'master') {
    fail(`you are on ${branch}.`,
      'Land runs from a feature branch. Commit your work on a branch, then run it again.');
  }

  // Uncommitted work is the most common way to ship something you did not mean to, or to
  // believe you shipped something you did not.
  const dirty = git('status', '--porcelain').split('\n').filter(l => l && !l.startsWith('??'));
  if (dirty.length) {
    fail(`${dirty.length} uncommitted change${dirty.length === 1 ? '' : 's'} in the working tree.`,
      'Commit them first — landing pushes commits, so uncommitted work would be silently left behind.');
  }

  console.log('\n  Fetching origin.');
  git('fetch', 'origin', '--quiet');

  // Fast-forward only. If main has moved, stop and look at why.
  let fastForward = true;
  try { git('merge-base', '--is-ancestor', 'origin/main', 'HEAD'); }
  catch { fastForward = false; }
  if (!fastForward) {
    const behind = git('rev-list', '--count', 'HEAD..origin/main');
    fail(`main has moved ${behind} commit${behind === '1' ? '' : 's'} ahead of this branch.`,
      'Rebase onto origin/main and re-run. Never force-push to resolve this.');
  }

  const landing = git('log', '--oneline', 'origin/main..HEAD').split('\n').filter(Boolean);
  if (!landing.length) fail('this branch has nothing main does not already have.');

  const files = git('diff', '--name-only', 'origin/main', 'HEAD').split('\n').filter(Boolean);
  const touchesLive = files.some(f => !f.startsWith('docs/') && !f.startsWith('tests/'));

  console.log(`\n  Landing ${landing.length} commit${landing.length === 1 ? '' : 's'} from ${branch}:\n`);
  for (const line of landing) console.log(`    ${line}`);
  console.log(`\n  ${files.length} file${files.length === 1 ? '' : 's'} changed.`);
  console.log(touchesLive
    ? '  This touches live code paths — the site will change.'
    : '  Docs and tests only — the site will not change.');

  console.log('\n  Running the test suite.\n');
  execFileSync('npm', ['run', 'check'], { stdio: 'inherit' });

  if (DRY) {
    console.log('\n  --dry-run: everything passed, nothing pushed.\n');
    return;
  }

  console.log('\n  Pushing to main.\n');
  execFileSync('git', ['push', 'origin', `${branch}:main`], { stdio: 'inherit' });

  console.log(`\n  Landed. main is now at ${git('rev-parse', '--short', 'HEAD')}.`);
  console.log(touchesLive
    ? '  Deploy it with `npm run ship`, which tests, deploys and re-points covenda.app.\n'
    : '  No deploy needed.\n');
}

main();
