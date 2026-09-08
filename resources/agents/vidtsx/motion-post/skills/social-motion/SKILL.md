---
name: Social motion
description: How a 3–15 second social post is timed, laid out and eased. Read it before briefing a composition — it is what turns "make a promo" into a brief the composition tool can build from, and it is the source of the palette, type and safe-margin notes that go into styleNotes.
when_to_use: Every time you brief or edit a composition for a social platform.
---

# Social motion

A social post is watched once, small, muted, and while scrolling. Everything
below follows from that.

## Timing

- **4–8 seconds** is the working range. Under 3 s nothing lands; over 15 s it is
  not a post any more. Pick a length that fits the words, then keep them.
- **Something moves in the first 8 frames.** No held title card at frame 0.
- **Beats, not a stream.** Split the text into 2–4 beats and give each one its
  own entrance. A beat is on screen at least 1.2 s — read it aloud at half speed
  and if you cannot finish, it is too short.
- **Stagger by 3–6 frames** inside a beat (line, then underline, then icon).
  Simultaneous entrances read as one flat pop.
- **Land 10–15 frames before the end.** A post that is still animating when it
  loops looks broken. The last beat holds.
- **Loop clean** when the piece is a loop: the last frame should be able to cut
  to the first without a jump. Say so in the brief when you want it.

## Text hierarchy

- **One hook, eight words or fewer**, and it is the largest thing on screen.
- At most **three type sizes**: hook, support, tag. A fourth is noise.
- **Two lines maximum per beat**, ~24 characters a line on vertical.
- Vertical (1080×1920): hook around **96–120 px**, support **48–56 px**.
  Square and wide: hook **72–88 px**, support **36–44 px**. Muted autoplay
  means the text carries the whole message, so err large.
- **Weight and colour carry emphasis, not italics.** One accent colour, used
  two or three times at most.
- Line-height 1.1 for the hook, 1.35 for support text.

## Safe zones

- Vertical 9:16: keep everything inside a **12 % margin** top and bottom — the
  platform's own UI (caption, buttons, handle) sits there. Centre the hook in
  the middle third; a hook at the bottom is covered by the caption.
- Square 1:1: **8 %** all round.
- Wide 16:9: **6 %** all round, and keep the lower right clear of the duration
  chip.
- Never put meaning in the last 8 % of any edge.

## Easing

Vocabulary the composition tool understands, and when each is right:

- **`Easing.bezier(0.16, 1, 0.3, 1)`** — the default entrance. Fast out, long
  settle. Text, cards, anything arriving.
- **`Easing.out(Easing.cubic)`** — a softer arrival for large shapes and
  background wipes.
- **`Easing.inOut(Easing.cubic)`** — anything that both starts and stops on
  screen: a slide between two positions, a colour change.
- **`spring({ fps, frame, config: { damping: 200 } })`** — a single accent that
  should feel physical: a badge landing, a counter snapping. Damping under 100
  wobbles, which reads as cheap on text.
- **Linear only for continuous motion** — a marquee, a rotation, a progress
  bar. Never for an entrance.
- Entrances travel **20–60 px**, never more. A long slide is a distraction, and
  on vertical it fights the scroll.
- Fade alone is flat: pair every fade with a small move or a scale from 0.94.

## Palette and surface

- Dark ground, light type, one accent — unless the user gives brand colours,
  and then use theirs and say so.
- Flat. No drop shadows, no gradients on text, no glow. A single soft
  background gradient behind everything is fine.
- Contrast the hook against its ground at 7:1 or better; it is being watched on
  a phone in daylight.

## What goes in the brief

Give the composition tool the words verbatim, the beat order with a frame or a
second for each, the motion in one sentence per beat, and the size. Put the
palette, the type sizes, the safe margin and the easing choice in
`styleNotes`. Do not send it a paragraph of mood — it builds what it is told.
