---
name: Your own style
description: Your own words for the look, turned into a full style (ground, ink, palette, type, details, motion) before the design.
---

# Style: your own

The user described the look in their own words; they are in your first message under STYLE. Before you design,
turn them into a full style, the way the built-in styles are written, and put it at the top of DESIGN.md:

- **Ground and ink:** the background and the colour of lines and text.
- **Palette with ROLES:** accent (the payoff), warn (overload, failure), ok (the healthy state), plus one or two
  supporting colours. Use the colours by role everywhere.
- **Type:** a font that fits the words, loaded from `@remotion/google-fonts`, with system fallbacks after it.
- **Line work:** outlines or flat fills, stroke widths, corner shapes.
- **Two or three details** that make the style recognisable at a glance.
- **Texture,** when the words ask for one (chalk, paper, film grain, print): drawn in code and seeded, so a frame
  always renders the same, for example an SVG `feTurbulence` filter or `@remotion/noise`.
- **A motion personality:** how things arrive, move and settle.

Keep every word the user gave you; fill in only what they left open. If a brand is set, its colours and fonts win
over anything you infer. On your first look, hold a still against their words: would they recognise their style?
