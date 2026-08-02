// Build the browser-only half of Covenda for Cloudflare Pages.
//
// The application historically kept public pages beside server code. Copying the repository
// root would publish API source, migrations, tests and operational notes. This build shares the
// same explicit allowlist as server.js, so a newly added file stays private until reviewed.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_DIRECTORIES, PUBLIC_ROOT_FILES } from '../deploy/public-assets.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'dist');

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of PUBLIC_ROOT_FILES) cpSync(join(root, file), join(output, file));
for (const directory of PUBLIC_DIRECTORIES) {
  cpSync(join(root, directory), join(output, directory), { recursive: true });
}

cpSync(join(root, 'deploy', 'cloudflare', '_headers'), join(output, '_headers'));
cpSync(join(root, 'deploy', 'cloudflare', '_redirects'), join(output, '_redirects'));
cpSync(join(root, 'deploy', 'cloudflare', '_routes.json'), join(output, '_routes.json'));
writeFileSync(join(output, 'build-manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  files: PUBLIC_ROOT_FILES,
  directories: PUBLIC_DIRECTORIES,
}, null, 2)}\n`);

console.log(`[covenda] static build: ${PUBLIC_ROOT_FILES.length} root files + ${PUBLIC_DIRECTORIES.join(', ')} -> dist/`);
