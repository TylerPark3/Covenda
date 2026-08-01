# Covenda design system

The visual system existed only as CSS. "Preserve the editorial identity" was a review
instruction with nothing written to check it against, so every judgment about whether a change
respected the system was a matter of taste and memory. This is the written definition.

It documents what the code already does. Where this file and `type.css` / `styles.css` /
`portal.css` disagree, **the CSS is right and this file is stale** — fix it here.

The test suite enforces the parts that can be enforced (`tests/frontend-structure.test.js`), and
those tests are named below so a reader knows which rules bite and which are conventions.

---

## The one rule

**Five sizes, three weights, nothing else, anywhere.**

Enforced. `tests/frontend-structure.test.js` scans `styles.css`, `portal.css`, `admin.css` and
`type.css` for any `font-size`, `font-weight`, `line-height` or `letter-spacing` that is not a
`var(--token)`. It fails on raw values. The only permitted raw values are `0` and `inherit`,
which are layout devices for hiding glyphs and collapsing wrappers, not typography.

This rule replaced 27 line-heights and 36 letter-spacings. It is the reason the product looks
like one product.

## Type scale

| Token | Value | Role |
|---|---|---|
| `--text-display` | `clamp(38px, 6.2vw, 72px)` | Page headline. **One per screen, at most.** |
| `--text-heading` | `clamp(26px, 3.2vw, 40px)` | Section headers |
| `--text-subhead` | `clamp(17px, 1.5vw, 20px)` | Sub-sections and card titles |
| `--text-body` | `clamp(15px, 1.1vw, 16px)` | All paragraph and list text |
| `--text-caption` | `12.5px` | Labels, metadata, footnotes |

Line-height and letter-spacing are **bound to the size**, not set per component:
`--lh-display: 1.06` → `--lh-caption: 1.45`, and `--ls-display: -.035em` → `--ls-caption: .01em`.
Tighter as it gets bigger, looser as it gets smaller. Never set them independently.

Weights: `--weight-regular: 400`, `--weight-medium: 550`, `--weight-bold: 700`. Three.

**A card title is never a section header.** Enforced by
`titles inside cards take the subhead role, not the heading role`. A selector matching
`-card`, `-tile`, `-item`, `-row`, `li`, `dd`… may not use `--text-heading` or `--text-display`.
This exists because a 40px title once landed in a 300px column and wrapped to six lines,
dwarfing the panel it labelled. Big numeric readouts (a balance, a countdown) are exempt: those
are data, not titles.

Running text is capped to `--measure: 68ch`. A column is not a measure.

## Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0e1013` | Primary text |
| `--muted` | `#5a5f66` | Secondary text |
| `--soft` | `#868d96` | Tertiary, completed, de-emphasised |
| `--gold` | `#c08a22` | The one accent |
| `--gold-deep` | `#8b5709` | Accent text, hover |
| `--gold-light` | `#e7c679` | Partial states |
| `--line` | `#dcdfe3` | Dividers |
| `--line-strong` | `#c4c9cf` | Borders that carry structure |
| `--success` | `#24753a` | Verified, held, complete |

**Gold is the only accent, and it means "act here".** One gold thing per screen. When the
journey ladder gained a next-step CTA, the welcome row's gold button had to stand down — two
primaries disagreeing about what to do first is worse than either alone.

**Colour never carries state alone.** Done states pair with a tick glyph in the text node, not
just a green. Tier and band are words before they are hues. This is a hard rule, and the reason
is simple: a student who cannot distinguish the greens still has to know what is verified.

## Hierarchy

Every screen answers, in order: **what should I look at first, second, third?**

The student overview is the worked example, because it got this wrong for a long time:

```
BEFORE                                    AFTER
greeting            (display size)        greeting          (body, muted — chrome)
├─ main column                            journey ladder    (tier 1: the next step)
│  └─ current work                        current work
└─ rail                                   standing panels
   ├─ progress ring (%)                    at a glance
   ├─ journey ladder
   ├─ verification panel
   └─ "what you can do next"
```

Four progress systems answered one question and none of them was the answer. One survives.

**Subtraction is the default.** If an element does not earn its pixels, cut it. The journey
panel lost its title and its explainer sentence because both described mechanics the list
already demonstrates. A "Do this next" label was being built on every render and hidden by
`display:none`.

## Numbers

**Never a percentage where a count will do.** "4 of 6" names what remains and what is next.
"67%" names neither.

**No universal score.** Decision D10, permanent. Not a skill score, not an employability score,
not a ranking. `tests/model/portal-overview-model.test.js` asserts against score language in
the progress surfaces. Shortlists are explicitly "listed in no particular order — nothing here
is ranked."

**Never claim completion without the data behind it.** Every step in a progress model reads
from a real field and reads false when that field is absent. Tested against `{}`, `null`,
`undefined` and malformed input.

## Motion

`--ease: cubic-bezier(.4, 0, .2, 1)`, `--dur-fast: 150ms`, `--dur: 220ms`.

Every animation has a `@media (prefers-reduced-motion: reduce)` counterpart. This is not
optional and there are no exceptions in the codebase today.

## Empty states are features

An empty state that says only "nothing here" is a dead end. It must name what the person can
do next. The no-active-work state offers two exits, and the second reads from the same ladder
as everything else rather than inventing its own idea of what is left.

Where an empty state could reveal something private, **the copy must be identical across
causes.** A shortlist emptied by the visibility gate reads exactly like one nobody has started,
because any wording that distinguished them would leak that a specific person was shortlisted.

## Accessibility floor

- Skip link first in tab order, off-screen until focused, never `display:none`
- 44px minimum for anything introduced now (ten pre-existing controls are under it and are
  logged in `TODOS.md` with measurements rather than silently restyled)
- `aria-expanded` on every disclosure; Escape closes and returns focus to the trigger
- `focus-visible` outlines in `--gold`, offset so they are visible against the control
- Colour never alone (see above)

Not yet done: a screen-reader pass. No assistive-technology harness exists here, so it cannot
be automated honestly. It needs a human.

## Illustrative content

Examples and sample opportunities must be **clearly labelled as illustrative**, everywhere,
always. A product whose whole thesis is evidence over claims cannot show invented evidence
without saying so.
