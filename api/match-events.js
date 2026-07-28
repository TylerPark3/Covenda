/**
 * Match event logging and training-label materialization.
 *
 * THIS IS THE MOST IMPORTANT FILE IN THE BUILD.
 *
 * The scorer is replaceable — anyone can write scoring rules. What no
 * competitor can copy is a record of which students delivered accepted paid
 * work and which employers came back. LinkedIn knows who connected.
 * Handshake knows who applied. This table is the moat.
 *
 * Two invariants:
 *   1. Append-only. Never update or delete an event.
 *   2. Every event carries the FEATURE VECTOR AT SCORING TIME. Features
 *      drift as students add evidence; a label paired with today's features
 *      instead of the ones that produced the recommendation is worthless.
 */

export const EVENT_TYPES = [
  "match_shown",
  "employer_viewed",
  "employer_shortlisted",
  "trial_funded",
  "deliverable_submitted",
  "revision_requested",
  "deliverable_accepted",
  "deliverable_rejected",
  "trial_abandoned",
  "closeout_rating",
  "repeat_within_30d",
];

/**
 * @param {object} db        your existing DB handle
 * @param {string} type      one of EVENT_TYPES
 * @param {object} payload   { matchId, studentId, projectId, featureVector, ... }
 */
export async function logMatchEvent(db, type, payload) {
  if (!EVENT_TYPES.includes(type)) {
    throw new Error(`Unknown match event type: ${type}`);
  }
  if (type === "match_shown" && !payload.featureVector) {
    throw new Error(
      "match_shown must carry the feature vector at scoring time — " +
        "a label without its originating features cannot train anything"
    );
  }
  const { error } = await db.from('match_events').insert({
    event_type: type,
    match_id: payload.matchId || null,
    student_user_id: payload.studentId || null,
    project_id: payload.projectId || null,
    features: payload.featureVector || null,
    fit_score: payload.score ?? null,
    tier: payload.tier ?? null,
    meta: payload.meta || {},
  });
  // Losing an event silently would leave a trial with a label and no features, which is
  // worse than no row at all — so this throws rather than degrading.
  if (error) throw new Error(`Could not log ${type}: ${error.message}`);
  return { logged: type };
}

/**
 * Server-enforced close-out gate.
 *
 * The employer cannot close a trial, and the student's verified work record
 * is not issued, until the one-tap rating is answered. The coupling is
 * deliberate: the employer's rating is what unlocks the student's credential,
 * which is why completion approaches 100%.
 *
 * Do not add a bypass. A "skip for now" option here quietly destroys the
 * label pipeline.
 */
export async function closeOutTrial(db, { matchId, accepted, wouldRequestAgain }) {
  if (typeof wouldRequestAgain !== "boolean") {
    const err = new Error(
      "Close-out requires an answer to: Would you request this student for future work?"
    );
    err.code = "CLOSEOUT_RATING_REQUIRED";
    throw err;
  }

  await logMatchEvent(
    db,
    accepted ? "deliverable_accepted" : "deliverable_rejected",
    { matchId }
  );
  await logMatchEvent(db, "closeout_rating", {
    matchId,
    meta: { wouldRequestAgain },
  });

  if (accepted) {
    await issueVerifiedWorkRecord(db, matchId);
  }
  return { closed: true, workRecordIssued: accepted };
}

async function issueVerifiedWorkRecord(db, matchId) {
  // The existing issuance path: a project reaching 'complete' IS the verified work record in
  // this repo. Kept as a named function so the close-out gate is obviously the only route.
  const { error } = await db.from('member_projects')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', matchId);
  if (error) throw new Error(`Could not issue the work record: ${error.message}`);
  return { issued: true, matchId };
}

/**
 * Nightly job. Materializes one labeled row per completed trial.
 *
 * label = 1 iff the deliverable was accepted AND the employer said they
 * would request the student again. Everything else is 0. Acceptance alone
 * is not enough — employers accept mediocre work to be polite, and a label
 * that cannot tell "fine" from "excellent" cannot train a useful model.
 */
export async function materializeLabels(db) {
  const TERMINAL = ['deliverable_accepted', 'deliverable_rejected', 'trial_abandoned'];
  const { data: terminal } = await db.from('match_events')
    .select('match_id').in('event_type', TERMINAL).not('match_id', 'is', null);
  const { data: labelled } = await db.from('training_labels')
    .select('match_id').eq('source', 'real_trial');

  const done = new Set((labelled || []).map(r => r.match_id));
  const pending = [...new Set((terminal || []).map(r => r.match_id))].filter(id => !done.has(id));
  const written = [];

  for (const matchId of pending) {
    const { data: events } = await db.from('match_events')
      .select('*').eq('match_id', matchId).order('created_at', { ascending: true });
    const rows = events || [];

    const shown = rows.find(e => e.event_type === 'match_shown');
    const accepted = rows.some(e => e.event_type === 'deliverable_accepted');
    const rating = rows.find(e => e.event_type === 'closeout_rating');
    const positive = rating?.meta?.wouldRequestAgain === true;

    // The gate should make this impossible. If it happens anyway, skip rather than guess:
    // an invented label is worse than a missing one, because it looks like data.
    if (accepted && !rating) continue;

    const { error } = await db.from('training_labels').insert({
      match_id: matchId,
      label: accepted && positive ? 1 : 0,
      feature_vector_at_scoring: shown?.features || null,
      source: 'real_trial',
    });
    if (!error) written.push(matchId);
  }
  return { written: written.length, pending: pending.length };
}

/**
 * Founder weak labels. Tyler or Dylan rate expected fit 1-5 before any real
 * outcome exists. Under ten seconds per rating. These are judgment, not
 * evidence — hence a separate source tag, never silently pooled with
 * real_trial rows.
 */
export async function recordFounderRating(db, { matchId, rating, rationale, ratedBy }) {
  if (rating < 1 || rating > 5) throw new Error("Rating must be 1-5");
  const { error } = await db.from('training_labels').insert({
    match_id: matchId,
    label: rating >= 4 ? 1 : 0,
    founder_rating: rating,
    rationale: rationale || null,
    rated_by: ratedBy,
    source: 'founder_rating',
  });
  if (error) throw new Error(`Could not record the rating: ${error.message}`);
  return { recorded: true, matchId };
}

