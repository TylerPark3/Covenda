// Serves the material an exercise supplies.
//
// Generated on request rather than stored: the content is a pure function of the slug, so
// there is nothing to keep in sync and a rater can regenerate exactly what a student saw.
// Every applicant to the same batch gets a byte-identical file, which is the only way two
// submissions are comparable.

import { assessmentFor } from './assessments.js';
import { BATCH_CATALOG } from './batches.js';
import { fileFor } from './exercise-files.js';
import { authorizeMember } from './portal.js';

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }

  // Signed in only. The material is published in the sense that it is not a secret, but it is
  // not something to leave open to a scraper either.
  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ error: 'Sign in first.' });

  const slug = String(req.query?.slug || '').slice(0, 60);
  const batch = BATCH_CATALOG.find(b => b.slug === slug);
  if (!batch) return res.status(404).json({ error: 'No such exercise.' });

  const assessment = assessmentFor(batch.discipline, batch.slug);
  const file = fileFor(slug, assessment?.exercise);
  if (!file) return res.status(404).json({ error: 'This exercise has no supplied file.' });

  res.setHeader('Content-Type', `${file.type}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  return res.status(200).send(file.body);
}
