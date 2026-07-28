// Text alternatives for recorded work.
//
// ── WHY THE STUDENT-WRITTEN PATH COMES FIRST ──────────────────────────────────────────
// Automatic transcription needs a paid API key this deployment does not have. Waiting for one
// would mean shipping nothing, and the accessibility gap is real today. So the primary path
// needs no key at all: the student writes or pastes their own transcript, and that version is
// authoritative because they wrote it.
//
// Machine transcription is added underneath as a convenience when a key exists. It is never
// allowed to overwrite a student's own text — a wrong machine transcript replacing an accurate
// human one is worse than having no transcript.
//
// ── WHO THIS IS ACTUALLY FOR ──────────────────────────────────────────────────────────
// Both sides. A deaf or hard-of-hearing RATER cannot assess an uncaptioned recording, and the
// method depends on two raters scoring the same artifact. Fixing this fixes reviewing as much
// as applying.

export const TRANSCRIPTS_VERSION = 'transcripts-1.0.0';

export const SOURCES = ['student', 'auto'];

export function cleanTranscript(text) {
  const value = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!value) return null;
  return value.slice(0, 20_000);
}

// A student's own words are authoritative. A machine pass may fill an empty transcript and
// must never replace one somebody wrote.
export function mayReplace(existingSource, incomingSource) {
  if (!existingSource) return true;
  if (incomingSource === 'student') return true;
  return false;
}

export async function saveTranscript(member, { videoId, text, source = 'student' } = {}) {
  if (!SOURCES.includes(source)) throw new Error('Unknown transcript source.');
  const clean = cleanTranscript(text);
  if (source === 'student' && !clean) throw new Error('Add the transcript text, or leave it blank to remove one.');

  const { data: video, error: readError } = await member.supabase
    .from('member_videos').select('id,user_id,transcript_source')
    .eq('id', videoId).eq('user_id', member.user.id).maybeSingle();
  if (readError) throw new Error('Could not find that recording.');
  if (!video) throw new Error('That recording is not yours.');

  if (!mayReplace(video.transcript_source, source)) {
    return { saved: false, reason: 'A transcript you wrote is already attached; automatic text will not replace it.' };
  }

  const { error } = await member.supabase.from('member_videos').update({
    transcript: clean,
    transcript_source: clean ? source : null,
    transcript_at: clean ? new Date().toISOString() : null,
  }).eq('id', videoId).eq('user_id', member.user.id);
  if (error) throw new Error('Could not save the transcript.');
  return { saved: true, source, length: clean ? clean.length : 0 };
}

// An accommodation is a request to a person, never a toggle. The point is that somebody reads
// it and arranges an alternative — which is the only thing that covers the cases nobody
// anticipated, and there are always cases nobody anticipated.
//
// It never asks for a diagnosis or a category. Requiring someone to classify their own
// disability in order to apply for work is its own barrier.
export async function requestAccommodation(member, { context, reference, need } = {}) {
  const text = String(need || '').trim();
  if (text.length < 10) throw new Error('Tell us what would help, in a sentence or two.');
  const allowed = ['batch_application', 'project_application', 'general'];
  const ctx = allowed.includes(context) ? context : 'general';

  const { error } = await member.supabase.from('accommodation_requests').insert({
    user_id: member.user.id,
    context: ctx,
    reference: reference ? String(reference).slice(0, 80) : null,
    need: text.slice(0, 2000),
  });
  if (error) throw new Error('Could not send that request. Email us instead and it will reach the same place.');
  return {
    sent: true,
    // Says what happens next, because "request submitted" tells someone nothing about whether
    // they should keep waiting or go and do something else.
    note: 'A person reads this, not a queue. We reply within two working days, and applying is not blocked while you wait.',
  };
}
