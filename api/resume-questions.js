// Questions generated from the candidate's own résumé.
//
// ── WHY ───────────────────────────────────────────────────────────────────────────────
// Every question in the assessment so far is the same for everyone in a batch. That is fine
// for concepts — "walk me through the three statements" is a fair question and publishing it
// costs nothing. It is useless for authorship, because a shared question can be prepared once
// and reused by anyone.
//
// A question drawn from THIS person's history cannot be. "You spent a summer at a logistics
// firm — what did you actually own there?" has no answer available in advance, and the
// résumé line that prompted it was written by the candidate themselves.
//
// This is the same move as the supplied Excel exercise: stop asking the student to invent
// the material, and stop asking everyone the same thing.
//
// ── THE FAILURE MODE THIS DESIGN AVOIDS ───────────────────────────────────────────────
// A model generating questions from a résumé will, unprompted, generate questions that
// interrogate PRESTIGE — where someone worked, which university, whether the internship was
// at a name-brand firm. That is exactly the proxy the platform refuses everywhere else, and
// it would arrive here through the back door because résumés are dense with it.
//
// So the system prompt forbids it explicitly, and `stripProxies` checks the output rather
// than trusting the instruction. A model told not to do something still occasionally does it.

import { extractDocumentText } from './doc-parse.js';

export const RESUME_QUESTIONS_VERSION = 'resume-questions-1.0.0';

// Terms that indicate a question is probing prestige rather than capability. Checked against
// generated output; a hit drops the question rather than rewriting it, because a rewritten
// prestige question tends to stay a prestige question.
const PROXY_TERMS = [
  'prestigious', 'top-tier', 'tier-1', 'elite school', 'ivy', 'target school',
  'brand name', 'well-known firm', 'gpa', 'grade point', 'class rank',
  'gap year', 'why did you leave', 'why were you not',
];

export function stripProxies(questions = []) {
  const kept = [];
  const dropped = [];
  for (const q of questions) {
    const text = `${q?.question || ''} ${q?.followUp || ''}`.toLowerCase();
    const hit = PROXY_TERMS.find(t => text.includes(t));
    if (hit) dropped.push({ question: q?.question, reason: `Probes "${hit}" rather than capability.` });
    else kept.push(q);
  }
  return { questions: kept, dropped };
}

const SYSTEM = `You generate interview questions from a candidate's own résumé.

PURPOSE
The questions must be impossible to prepare in advance, because they are about this specific
person's stated experience. A generic question defeats the entire point.

HARD RULES
- Never ask about where they studied, their GPA, class rank, the reputation of an employer, or
  any gap in their history. Those are proxies for background, not evidence of capability, and
  this platform refuses them everywhere else.
- Never ask a question answerable from the résumé line itself. "You worked at X, what did X
  do?" is worthless. Ask what THEY did, decided, or changed.
- Anchor every question to a specific line. Quote the fragment you are asking about.
- Prefer the unglamorous entries. A summer job in a warehouse usually produces better answers
  than a prestigious internship, because nobody has coached them on it.

EACH QUESTION NEEDS
- question: anchored to a quoted résumé fragment.
- followUp: the second question. Preparation survives the first; it rarely survives the
  second. Prefer "why didn't you" and "what did you try that failed".
- probes: what capability this is actually reading.
- anchor: the exact résumé fragment it came from.

Return 4 to 6 questions. Fewer good ones beats more generic ones.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['questions'],
  properties: {
    questions: {
      type: 'array', minItems: 3, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        required: ['question', 'followUp', 'probes', 'anchor'],
        properties: {
          question: { type: 'string' },
          followUp: { type: 'string' },
          probes: { type: 'string' },
          anchor: { type: 'string' },
        },
      },
    },
  },
};

export async function questionsFromResume({ buffer, filename = '', vertical = null, env = process.env, fetchImpl = fetch } = {}) {
  const extracted = extractDocumentText(buffer, filename);
  if (!extracted.ok) return { ok: false, reason: extracted.reason };

  const key = env.ANTHROPIC_API_KEY;
  if (!key) {
    // Degrades to the published bank rather than blocking the application.
    return { ok: false, reason: 'Résumé questions are not switched on here — the published technical questions still apply.', fallback: true };
  }

  const prompt = `Résumé text:\n\n${extracted.text.slice(0, 12000)}`
    + (vertical ? `\n\nThey are applying to a ${vertical} batch. Weight the questions toward experience relevant to it, but do not ignore unrelated entries — those often produce the most honest answers.` : '');

  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 2000, system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response || !response.ok) return { ok: false, reason: 'Could not read that résumé. The published questions still apply.', fallback: true };

  const data = await response.json();
  const raw = (data?.content || []).filter(b => b?.type === 'text').map(b => b.text).join('').trim();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'Unreadable response.', fallback: true }; }

  // Check the output, do not trust the instruction.
  const { questions, dropped } = stripProxies(parsed?.questions || []);
  if (!questions.length) {
    return { ok: false, reason: 'Nothing usable came back. The published questions still apply.', fallback: true, dropped };
  }
  return {
    ok: true,
    version: RESUME_QUESTIONS_VERSION,
    questions,
    dropped,
    // A student should know why they are being asked something nobody else is asked.
    note: 'These come from your own résumé, so nobody else gets them. Answer from memory — we are not checking the dates.',
  };
}
