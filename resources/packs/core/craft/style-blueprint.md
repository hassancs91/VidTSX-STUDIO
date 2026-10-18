---
name: Blueprint
description: A technical drawing come to life: blueprint blue, a fine grid, white outlines, an amber payoff, monospace type, precise motion.
---

# Style: Blueprint

A technical drawing come to life. Use the colours by their ROLE everywhere: the accent marks the payoff, warn marks
overload or failure, ok marks the healthy state.

- **Ground:** blueprint blue #1D4F91 with a fine grid: minor lines #2A63AA every 30 px, major lines #3A74BE every
  150 px, 1 px.
- **Ink:** #EAF2FF for every line and every piece of text. Shapes are OUTLINES, 3 px strokes, square line caps;
  fills only as 12 % white tints.
- **Accent:** amber #FFC857 (the payoff). **Warn:** #FF6B6B. **Ok:** #7CF0C5.
- **Type:** IBM Plex Mono from `@remotion/google-fonts/IBMPlexMono` (weights 400, 600, 700), with Consolas,
  'Courier New', monospace after it. Titles uppercase with 0.08 em letter spacing; labels uppercase.
- **What makes it Blueprint:** dimension lines with arrowheads and small measurements, leader lines from labels to
  parts, a title block box in a corner, cross-hatching for "full" areas.
- **Motion:** precise and mechanical. Lines draw on (stroke-dashoffset), counters tick, parts slide on rails with
  `Easing.inOut(Easing.cubic)`. No bounce.
