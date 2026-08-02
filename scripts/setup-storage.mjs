// Plan or apply the two Covenda Storage buckets through Supabase's supported Storage API.
// The Storage metadata schema is read-only by contract, so this deliberately does not write
// storage.buckets with SQL. Running without --apply is a read-only plan.

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function localEnv() {
  if (!existsSync('.env.local')) return {};
  const values = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = { ...localEnv(), ...process.env };
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and a server-side Supabase secret are required.');

const configuredLimit = Number(env.COVENDA_UPLOAD_MAX_BYTES);
const privateLimit = Number.isFinite(configuredLimit)
  ? Math.max(5 * 1024 * 1024, Math.min(400 * 1024 * 1024, Math.floor(configuredLimit)))
  : 400 * 1024 * 1024;

const definitions = [
  {
    id: env.SUPABASE_STORAGE_BUCKET || 'uploads',
    options: {
      public: false,
      fileSizeLimit: privateLimit,
      allowedMimeTypes: [
        'application/json', 'application/msword', 'application/pdf', 'application/zip',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/gif', 'image/jpeg', 'image/png', 'image/webp',
        'text/csv', 'text/markdown', 'text/plain',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
      ],
    },
  },
  {
    id: env.SUPABASE_PUBLIC_STORAGE_BUCKET || 'avatars',
    options: {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/gif', 'image/jpeg', 'image/png', 'image/webp'],
    },
  },
];

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw new Error(`Could not inspect Storage: ${listError.message}`);

const existing = new Set((buckets || []).map(bucket => bucket.id));
const apply = process.argv.includes('--apply');
for (const definition of definitions) {
  const action = existing.has(definition.id) ? 'update restrictions on' : 'create';
  console.log(`${apply ? 'Applying' : 'Would'} ${action} ${definition.id} (${definition.options.public ? 'public avatars' : 'private files'}, max ${definition.options.fileSizeLimit} bytes)`);
  if (!apply) continue;
  const result = existing.has(definition.id)
    ? await supabase.storage.updateBucket(definition.id, definition.options)
    : await supabase.storage.createBucket(definition.id, definition.options);
  if (result.error) throw new Error(`${definition.id}: ${result.error.message}`);
}

console.log(apply ? 'Storage bucket setup complete.' : 'Dry run only. Re-run with --apply after reviewing the plan.');
