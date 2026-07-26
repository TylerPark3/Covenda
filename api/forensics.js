// Shared timestamp-forensics service (Proof Connector Framework).
//
// Every connector's second forgery defense is the same: platform TIMESTAMPS prove HISTORY.
// Months of accumulated activity can't be fabricated in an afternoon. This service generalizes
// the GitHub burst-pattern detector (api/github.js oneShot flag) to ANY connector — given a
// list of event timestamps (commits, trades, file versions, ...), it derives the history span,
// the accumulation cadence, and single-dump / backfill anomalies.
//
// HARD RULE (unchanged across the platform): an anomalous timeline routes to HUMAN review and
// is NEVER auto-credited — in either direction. A slick single-session dump doesn't read as
// proof, and the service refuses to score it rather than guessing.

export const FORENSICS_VERSION = 'forensics-1.0.0';

const DAY = 86_400_000;
const round = n => Math.round(n * 100) / 100;
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Normalize a mixed list of Date | ISO string | epoch-ms into sorted epoch millis.
function toMillis(timestamps) {
  return (timestamps || [])
    .map(t => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : new Date(t).getTime()))
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);
}

// Analyze a timeline of event timestamps. Returns the shape connectors attach as evidence_meta.
export function analyzeTimeline(timestamps, { now = Date.now() } = {}) {
  const ms = toMillis(timestamps);
  if (!ms.length) {
    return { events: 0, history_span_days: 0, cadence_features: null, backfill_flags: ['no_history'], anomaly: true, needsReview: true };
  }
  const events = ms.length;
  const spanDays = (ms[ms.length - 1] - ms[0]) / DAY;
  const activeDays = new Set(ms.map(t => Math.floor(t / DAY))).size;

  // Per-day counts → the largest single-day share exposes a dump.
  const perDay = new Map();
  for (const t of ms) { const d = Math.floor(t / DAY); perDay.set(d, (perDay.get(d) || 0) + 1); }
  const maxDayShare = Math.max(...perDay.values()) / events;

  // Inter-event gaps → a real cadence has spacing; a backfill is suspiciously uniform/clustered.
  const gaps = [];
  for (let i = 1; i < ms.length; i += 1) gaps.push((ms[i] - ms[i - 1]) / DAY);
  const medianGapDays = median(gaps);
  const recencyDays = (now - ms[ms.length - 1]) / DAY;

  // Anomaly detection — the generalized burst/backfill flags.
  const backfill_flags = [];
  if (spanDays < 1) backfill_flags.push('single_session');            // all events inside one day
  if (events >= 4 && maxDayShare >= 0.8) backfill_flags.push('single_dump'); // one day holds ~everything
  if (events >= 6 && spanDays < 3) backfill_flags.push('compressed_history'); // lots of activity, no time
  const anomaly = backfill_flags.length > 0;

  const cadence_features = {
    events,
    active_days: activeDays,
    span_days: round(spanDays),
    median_gap_days: round(medianGapDays),
    max_day_share: round(maxDayShare),
    recency_days: round(recencyDays),
    // The hardest-to-fake signal: real months of accumulation across multiple active days.
    sustained: spanDays >= 30 && activeDays >= 4 && !anomaly,
  };

  return { events, history_span_days: round(spanDays), cadence_features, backfill_flags, anomaly, needsReview: anomaly };
}
