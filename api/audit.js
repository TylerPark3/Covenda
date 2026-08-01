// The audit writer for the V1 spec's §7 event taxonomy.
//
// The spec names ten events and one rule that matters more than the list: "actor, subject,
// timestamp, request id. No free-text rationale or note in any event payload."
//
// That rule exists because rationale text is the most sensitive field in this product. It is an
// operator's written judgment about a named student. It belongs in matches.human_rationale,
// which is access-controlled. Audit logs get exported, forwarded, and read by people who were
// never granted access to the underlying record, so a rationale that leaks into one has left
// the boundary that was protecting it.
//
// Enforced three times over, because this will outlive whoever remembers the rule:
//   here (safeDetail strips forbidden keys), at the database (a check constraint rejects them),
//   and by size (a bounded payload cannot smuggle prose through an allowed key).
//
// Never throws. An audit write that fails must not fail the operation it was describing —
// refusing to record an introduction because its audit row would not insert is strictly worse
// than the missing row. Failures go to recordError, which is where the rest of this codebase
// already looks when something has gone quiet.

import { safeDetail, recordError } from './limits.js';

export const AUDIT_VERSION = 'audit-1.0.0';

// Mirrors the constraint in 20260801200000_audit_events.sql. Kept here as well so a typo fails
// in the test suite rather than at 3am against a live database.
export const AUDIT_EVENTS = [
  'brief.created',
  'brief.opened',
  'shortlist.candidate_added',
  'shortlist.published',
  'introduction.requested',
  'introduction.accepted',
  'introduction.declined',
  'outcome.recorded',
  'evidence.verified',
  'gap_analysis.viewed',
];

export const SUBJECT_KINDS = ['brief', 'shortlist', 'student', 'company', 'introduction', 'outcome'];

// Belt and braces over safeDetail. safeDetail's deny-list is a regex over key names and is
// shared with error logging; this is the audit-specific list, stated literally, so that
// loosening one does not silently loosen the other.
const NEVER_IN_AUDIT = ['rationale', 'note', 'notes', 'comment', 'reason', 'email', 'phone', 'token', 'secret', 'password'];

/**
 * Record one audit event. Returns true if written, false otherwise. Never throws.
 *
 * @param db          a Supabase client with the service role
 * @param eventType   one of AUDIT_EVENTS
 * @param actorUserId who did it, or null for system-originated events
 * @param subject     { kind, id } — loose pair, so the row survives the subject's deletion
 * @param detail      structured facts only; free text is stripped, not stored
 * @param requestId   correlates every event emitted by one HTTP request
 */
export async function recordAuditEvent(db, eventType, { actorUserId = null, subject = {}, detail = {}, requestId = null } = {}) {
  try {
    if (!db) return false;
    // An unknown event type is a programming error, not a runtime condition. Refusing to write
    // it keeps the taxonomy closed: a silently-accepted 'shortlist.publishd' would never be
    // found by any query looking for 'shortlist.published'.
    if (!AUDIT_EVENTS.includes(eventType)) {
      await recordError('audit', 'unknown_event_type', `Refused to write unknown audit event: ${String(eventType).slice(0, 80)}`, {}).catch(() => {});
      return false;
    }
    const kind = SUBJECT_KINDS.includes(subject?.kind) ? subject.kind : null;

    // safeDetail first (shared deny-list, string truncation, primitives only), then the
    // audit-specific list. Order matters only for clarity; both must pass.
    const scrubbed = safeDetail(detail);
    for (const key of Object.keys(scrubbed)) {
      if (NEVER_IN_AUDIT.includes(key.toLowerCase())) delete scrubbed[key];
    }

    const { error } = await db.from('audit_events').insert({
      event_type: eventType,
      actor_user_id: actorUserId || null,
      subject_kind: kind,
      subject_id: kind && subject?.id ? subject.id : null,
      request_id: requestId ? String(requestId).slice(0, 120) : null,
      detail: scrubbed,
    });
    if (error) {
      // Most likely cause by far: the migration has not been pasted yet. Code deploys
      // automatically here and migrations need a human, so this gap is routine and must stay
      // non-fatal.
      await recordError('audit', 'insert_failed', String(error.message || error).slice(0, 200), { eventType }).catch(() => {});
      return false;
    }
    return true;
  } catch (err) {
    try { await recordError('audit', 'threw', String(err?.message || err).slice(0, 200), { eventType }); } catch { /* audit must never escalate */ }
    return false;
  }
}

/**
 * Publishing a shortlist emits one candidate_added per candidate plus one published, all sharing
 * a request id so the set can be reassembled later.
 *
 * Takes candidate ids only. Passing whole candidate objects would drag rationale text to the
 * boundary of a function whose entire purpose is to keep it out.
 */
export async function recordShortlistPublished(db, { actorUserId, briefId, studentUserIds = [], requestId = null }) {
  const ids = Array.isArray(studentUserIds) ? studentUserIds : [];
  for (const studentUserId of ids) {
    await recordAuditEvent(db, 'shortlist.candidate_added', {
      actorUserId,
      subject: { kind: 'student', id: studentUserId },
      detail: { briefId: String(briefId || '').slice(0, 64) },
      requestId,
    });
  }
  return recordAuditEvent(db, 'shortlist.published', {
    actorUserId,
    subject: { kind: 'brief', id: briefId },
    // A count, not a list of names. The names are already in the candidate_added rows, where
    // they are indexed by subject and can be access-controlled per student.
    detail: { candidateCount: ids.length },
    requestId,
  });
}
