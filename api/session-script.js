// What happens DURING the recording.
//
// ── THE PROBLEM WITH A BARE SCREEN SHARE ──────────────────────────────────────────────
// Handing someone a task and a record button produces twenty silent minutes of clicking.
// The recording is longer than a written answer and tells a rater less, because the thing
// worth reading — why they went there, what they ruled out, what surprised them — never gets
// said out loud.
//
// So the session is scripted. Prompts appear at set points and ask for something specific.
// It is closer to an examiner sitting beside you than to a proctor watching you.
//
// ── AND IT IS NOT ONE FORMAT ──────────────────────────────────────────────────────────
// A screen share is right when the work happens on a screen: a model, a codebase, a dataset.
// It is wrong for robotics, where the interesting work happened on hardware months ago and
// there is nothing to share. Asking a robotics candidate to screen-share is asking them to
// perform the least representative part of their discipline.
//
// So there are three modes, and the mode is a property of the specialisation:
//
//   screen        — do the supplied work, narrated. Software, finance, data.
//   conversation  — no screen. Specific anecdotes about work already done, probed for the
//                   detail only someone who was there would have. Robotics, clinical ops.
//   hybrid        — start on screen with an artifact, then move off it to the story behind
//                   the artifact. Consulting, research.

export const SESSION_SCRIPT_VERSION = 'session-script-1.0.0';

export const MODES = ['screen', 'conversation', 'hybrid'];

// Which mode each specialisation runs. Chosen by where the work actually lives.
export const MODE_BY_SLUG = {
  // The work is on a screen and can be done now.
  'ai-ml': 'screen', 'infrastructure-data': 'screen', 'product-engineering': 'screen',
  'security-reliability': 'screen',
  'investment-banking': 'screen', 'private-equity': 'screen', 'accounting-audit': 'screen',
  'asset-wealth-management': 'screen',
  'growth-performance': 'screen', 'merchandising': 'screen', 'supply-chain': 'screen',
  'ecommerce-marketplace': 'screen', 'health-analytics': 'screen', 'revenue-cycle': 'screen',

  // The work happened elsewhere, on hardware or with people. Nothing useful to share.
  'physical-ai': 'conversation',
  'clinical-operations': 'conversation',
  'regulatory-quality': 'conversation',

  // An artifact exists, but the reasoning behind it is the point.
  'venture-capital': 'hybrid', 'management-consulting': 'hybrid', 'strategy-research': 'hybrid',
  'market-intelligence': 'hybrid', 'legal-operations': 'hybrid', 'technical-writing': 'hybrid',
  'brand-content': 'hybrid', 'digital-health-product': 'hybrid',
};

// Prompts fire at a fraction of elapsed time rather than a fixed clock, so a 20-minute and a
// 30-minute exercise both get the same shape.
const SCREEN_BEATS = [
  { at: 0.00, say: 'Before you touch anything: what do you expect to find?', why: 'A stated expectation makes the later surprise legible. Someone who predicts nothing cannot be surprised.' },
  { at: 0.15, say: 'What are you looking at right now, and why there first?', why: 'Where someone starts is the strongest early signal of whether they have done this before.' },
  { at: 0.40, say: 'What have you ruled out?', why: 'Elimination is invisible in a recording unless it is spoken. This is usually where the real work shows.' },
  { at: 0.70, say: 'Anything surprised you yet?', why: 'A genuine investigation has at least one. A rehearsed one has none.' },
  { at: 0.90, say: 'If you had to stop now, what would you tell the person who asked for this?', why: 'Reads whether they can summarise under time pressure rather than only finish.' },
];

const CONVERSATION_BEATS = [
  { at: 0.00, say: 'Pick one thing you built or ran. Not the most impressive — the one you remember best.', why: 'Memory beats prestige. The best-remembered project is the one they actually did.' },
  { at: 0.12, say: 'Walk me to the moment it first did not work.', why: 'Every real project has one. A described-from-a-writeup project does not.' },
  { at: 0.35, say: 'How did you find out? What were you actually looking at?', why: 'The instrument, the log, the noise it made. Specifics here are almost impossible to invent.' },
  { at: 0.55, say: 'What did you try that did not fix it?', why: 'Dead ends are the clearest authorship signal there is.' },
  { at: 0.75, say: 'Who else was involved, and what did they do?', why: 'Separates the person who did the work from the person who watched it.' },
  { at: 0.90, say: 'What would you do differently, and why did you not do that then?', why: 'The second half is the discriminator. An author has a reason; time, ignorance, a different priority.' },
];

const HYBRID_BEATS = [
  { at: 0.00, say: 'Show me the piece you are least sure about.', why: 'Opening on their own doubt beats opening on their best work.' },
  { at: 0.20, say: 'Where did that number or claim come from?', why: 'Provenance. The one question a generated artifact cannot answer.' },
  { at: 0.45, say: 'Now stop sharing. Tell me how you got to the question in the first place.', why: 'Moving off the screen changes the register from demonstrating to explaining.' },
  { at: 0.70, say: 'What did you look for and fail to find?', why: 'The seam probe. Real work has gaps; generated work is seamless.' },
  { at: 0.90, say: 'What is the strongest argument against your own conclusion?', why: 'Reads whether they have held both sides or only defended one.' },
];

const BEATS = { screen: SCREEN_BEATS, conversation: CONVERSATION_BEATS, hybrid: HYBRID_BEATS };

// Anecdote probes for the conversation mode, per specialisation. Generic "tell me about a
// project" invites a rehearsed answer; these ask for something only a participant holds.
export const ANECDOTE_PROBES = {
  'physical-ai': [
    'Something that worked in simulation and did not survive contact with hardware.',
    'A sensor reading you did not believe, and what you did about it.',
    'The first time you damaged something. What you changed afterwards.',
  ],
  'clinical-operations': [
    'A process you changed that somebody resisted, and whether they were right.',
    'The exception that kept happening until you redesigned around it.',
    'A time the data said one thing and the floor said another.',
  ],
  'regulatory-quality': [
    'A control that looked fine on paper and had no evidence behind it.',
    'An audit finding you disagreed with.',
    'Something you had to prove happened months after it did.',
  ],
};

export function scriptFor(slug, { minutes = 25 } = {}) {
  const mode = MODE_BY_SLUG[slug] || 'screen';
  const beats = BEATS[mode];
  const total = Math.max(5, Number(minutes) || 25);
  return {
    version: SESSION_SCRIPT_VERSION,
    slug,
    mode,
    minutes: total,
    // Absolute seconds, so the client only has to compare a timer.
    beats: beats.map(b => ({ atSeconds: Math.round(b.at * total * 60), say: b.say, why: b.why })),
    probes: ANECDOTE_PROBES[slug] || null,
    capture: mode === 'conversation' ? 'camera' : 'screen',
    // Said before recording starts, because a candidate expecting a silent test will work
    // silently and score badly for the wrong reason.
    brief: mode === 'conversation'
      ? 'No screen share. Pick one thing you actually did and be specific — names of tools, what broke, what you tried. We are listening for detail only someone who was there would have.'
      : mode === 'hybrid'
        ? 'Start by sharing your work. Partway through we will ask you to stop sharing and just talk.'
        : 'Share the window you are working in and think out loud. Prompts will appear as you go; answer them aloud and keep working.',
  };
}

// A rater reads answers against the beat that produced them, not against a transcript blob.
export function raterView(script) {
  return {
    mode: script.mode,
    checkpoints: script.beats.map(b => ({
      at: b.atSeconds, asked: b.say, reading: b.why,
      // Silence at a prompt is itself an observation and should be recorded as one rather
      // than left as a gap in the notes.
      ifSilent: 'Note it. A prompt nobody answers is data, not a missing field.',
    })),
  };
}
