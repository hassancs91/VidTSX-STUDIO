---
name: Infographic loop
description: An animated infographic post: one whole picture on every frame, frame 0 is the poster, a seamless loop, and numbers made of countable marks.
---

# Infographic loop

This piece is an animated infographic post. It is seen small, muted and mid-scroll, often only as a still: the
feed's thumbnail is frame 0, and a scroller may stop on any frame. So the picture explains the idea on its own, at
every moment. The Concept to picture pack says how to find the picture; this one says what form it takes and what
makes it good.

## The form

- **One picture, whole on every frame.** Everything that explains the idea is on the canvas from frame 0 to the
  last frame. Nothing enters later and nothing leaves, except the moving items themselves. No scenes, no cuts, no
  camera moves, no zooms, no title card. If you are sequencing ("first X, then Y"), you are making a video:
  redesign it as one canvas.
- **Motion lives inside the elements.** Counters climb, piles grow, timers refill, things travel along drawn paths,
  a gauge rises into the red, an actor reacts in its own spot. Every motion means something in the idea; motion
  for decoration is noise.
- **The layout is the reasoning.** Read top to bottom: cause above effect, problem above fix, input above output.
- **The shock comes from scale on one canvas.** Put the things being compared side by side or one above the other,
  at ONE scale, so the eye measures them.
- **A race runs on one clock.** When two sides race (a scan against an index, walking against driving), both run
  from the same `t` at the same rate: shown time = t × one rate for both sides. The slower side's length sets the
  run; a side 1,000× faster finishes on its first frame, and that instant finish IS the payoff. Two sides that
  take 6 s and 2 s on screen while their counters say 2 s and 2 ms tell two stories.
- **Frame 0 is the poster.** At frame 0 every payoff is already visible: counters at their final numbers, piles at
  full height, the result shown. The loop then plays the mechanism and comes back to that state.
- **Any frame reads.** Hold each payoff for at least 40 % of the loop, and stagger the zones so one zone's payoff
  shows while another builds.

## The loop

- Every repeating motion has a period that divides the length in frames (for 240 frames: 240, 120, 80, 60, 48,
  40, 30, 24, 20). That is what makes the loop seamless.
- Anything that accumulates is back in its frame-0 state by the last frame: either it always shows its final value
  and only pulses as an item lands, or it replays inside the loop while another zone holds the eye.
- No motion jumps at the wrap: the last frame flows into frame 0.

## The four moves (plan them before the first build)

These turn a correct picture into one that explains. Decide each one in DESIGN.md before your first `check`: the
unit, where the ghosts sit, what a step shows. Later rounds refine them; they are not polish for the end.

1. **Countable marks at a stated unit.** The numbers are made of things you can count: one mark = one unit, the
   same size on both sides, so the ink ratio IS the number ratio. When the numbers are too big for one mark each,
   pick a bigger unit and say it on the canvas ("■ = 100 people"). The count must come out exact: unit × marks =
   the number printed beside them; a part of a unit is a part of a mark, drawn as one.
2. **Ghost slots.** Anything that grows, fills or replays keeps its final shape drawn on EVERY frame, as faint empty
   outlines (dashed, 15-25 % ink). On a mid frame the eye sees where each side is going and how much is still
   missing, so the payoff reads even while the counters are low.
3. **The step's delta.** When two things change at different rates, show beside each side what THIS step adds, in
   the same unit as the marks: the new marks light up as they land, with "+N" beside them. The totals show where
   they end; the deltas show why they part. If one side's step grows and the other's does not, that difference is
   the idea: make it the loudest motion on the canvas.
4. **A labelled band is a chart.** A liquid level, a filled area, a bar, or a line with a tick ruler is a chart,
   even with faces on it. Use one only when no countable thing can carry the number, and write in DESIGN.md why
   not.

## Layout and legibility (a canvas 1080 px wide; scale with the width)

- **Header:** a title of at most six words with ONE accent word, 64-76 px, at the top; a one-line subtitle under
  it, 28-32 px. Everything below the header is the picture.
- **Margins:** 60 px on every side; on 9:16 keep 12 % clear at the top and the bottom.
- **Labels:** at most four words, at least 26 px, ON or right beside the thing they name, never in a legend.
- **Big numbers** are the loudest text after the title: 80-140 px.
- **Text never covers a drawn object**, and no two labels touch.
- **Actors** (people, servers, cells, coins with faces) are simple shapes with dot eyes and a mouth; the face
  carries the state. An overloaded one sweats and sags; a relaxed one breathes.
- At most three type sizes besides the title. One accent colour, kept for the payoff and the failure.

## Look check list (every round)

Run it on your stills and write what you found in the round log.

- Frame 0: is every payoff visible, as it will be in the feed's thumbnail?
- A mid frame (from the contact sheet): is the message readable? Are the ghost slots there? Can you see this
  step's delta on each side?
- Count the marks on one still: does unit × count equal the number printed beside them on that frame?
- Read every number and label on a mid frame against what the picture shows there: a step label, a counter and a
  pile must agree.
- Is anything a band, an area or a bar with a ruler where countable marks could be?
- At phone size (`phone_view`), is every label readable?

## The round log

Each round's entry in DESIGN.md gets a fourth line after Saw, DESIGN and BUG: **PACK:** which of the four moves and
which check-list items this round looked at, what the stills showed for each, and what you changed because of them.
