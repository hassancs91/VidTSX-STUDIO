---
name: Editorial
description: A newspaper's information graphic: newsprint, black rules, one red accent, a serif headline, restrained motion.
---

# Style: Editorial

A newspaper's information graphic: calm, precise, authoritative. Use the colours by their ROLE everywhere: the
accent marks the payoff and the failure.

- **Ground:** newsprint #F4F1EA.
- **Ink:** #1A1A1A, 1.5 px rules; fills as hatching or a 30 % grey #8C8C8C.
- **Accent:** one red #D7263D, used two or three times only. **Soft:** #D9D3C7 for panels.
- **Type:** Playfair Display from `@remotion/google-fonts/PlayfairDisplay` (bold) for the title and big numbers;
  Inter from `@remotion/google-fonts/Inter` for labels, in small caps with 0.06 em letter spacing; Georgia, serif
  and Arial, sans-serif fallbacks after them.
- **Details:** thin column rules, a small "SOURCE / NOTE" line at the bottom, dot-matrix (halftone) shading, labels
  with hairline leaders.
- **Motion:** restrained: ink draws on, numbers count, marks fill in with `Easing.out(Easing.cubic)`. Nothing
  bounces, nothing glows.
