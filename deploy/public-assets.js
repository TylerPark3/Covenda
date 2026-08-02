// The self-hosted server and the Cloudflare build share this allowlist.
//
// Serving the repository root with express.static() also serves package.json, database
// migrations, calibration data, operational notes, and server source. A denylist will always
// miss the next sensitive file, so public delivery is an explicit list instead.

export const PUBLIC_ROOT_FILES = Object.freeze([
  '404.html',
  'admin.css',
  'admin.html',
  'admin.js',
  'app.js',
  'apple-touch-icon.png',
  'cohort.html',
  'cohort.js',
  'confirm.html',
  'favicon-192.png',
  'favicon-48.png',
  'favicon-512.png',
  'favicon-96.png',
  'favicon.svg',
  'index.html',
  'join-qr.html',
  'portal.css',
  'portal.html',
  'portal.js',
  'qrcode.js',
  'robots.txt',
  'sitemap.xml',
  'styles.css',
  'type.css',
]);

export const PUBLIC_EXTENSIONLESS_PAGES = Object.freeze([
  'admin',
  'cohort',
  'confirm',
  'join-qr',
  'portal',
]);

export const PUBLIC_DIRECTORIES = Object.freeze(['assets']);

export function isPublicAssetPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(String(pathname || '/')); } catch { return false; }
  if (decoded === '/') return true;
  if (!decoded.startsWith('/') || decoded.includes('\0') || decoded.includes('\\')) return false;

  const parts = decoded.slice(1).split('/');
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..')) return false;
  if (parts.length === 1) {
    return PUBLIC_ROOT_FILES.includes(parts[0]) || PUBLIC_EXTENSIONLESS_PAGES.includes(parts[0]);
  }
  return PUBLIC_DIRECTORIES.includes(parts[0]);
}
