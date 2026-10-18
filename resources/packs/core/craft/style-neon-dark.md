---
name: Neon dark
description: A dark control room where the data glows: cyan lines, a magenta payoff, particles along paths.
---

# Style: Neon dark

A dark control room where the data glows. Use the colours by their ROLE everywhere: the accent marks the payoff,
warn marks overload or failure, ok marks the healthy state.

- **Ground:** #0A0E1A with a soft radial vignette to #05070D at the edges.
- **Lines:** 2-3 px strokes that glow (an SVG drop-shadow, 0 0 8 px, in the line's own colour). Shapes are mostly
  outlines with 8 % fills of their colour.
- **Palette:** cyan #00E5FF (ink and main lines), magenta #FF2E88 (accent), lime #B6FF3B (ok), amber #FFB020
  (warn), dim grid #1A2338.
- **Type:** JetBrains Mono from `@remotion/google-fonts/JetBrainsMono` for numbers; Inter from
  `@remotion/google-fonts/Inter` (600) for titles and labels; monospace and sans-serif fallbacks after each.
- **Details:** small particles travelling along drawn paths, scanlines at 4 % opacity, a dim background grid.
- **Motion:** pulses and flows: data moves as particles along paths, hits flash then decay, warnings flicker twice.
