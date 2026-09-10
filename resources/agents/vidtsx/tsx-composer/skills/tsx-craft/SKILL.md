---
name: TSX craft
description: The style presets, layout safe zones and type scale the composition tool builds under. Read it before briefing generate_composition or edit_composition — it is the vocabulary the tool understands, so a brief written in these terms comes back the way it was asked for.
when_to_use: Every time you brief or edit a composition.
---

# TSX craft

The composition tool writes Remotion TSX under the rules below — the SAME
rules, word for word, that its own system prompt carries. You never write
the code; you brief it. Brief in this vocabulary and the tool has nothing
to guess:

- Name a **style preset** when the user implies one ("neon", "corporate",
  "brutalist"); otherwise say nothing and the tool uses Minimalist. When
  the session has a brand, its palette and fonts are handed to the tool on
  their own — do not restate them, and do not pick a preset that fights
  them.
- Give text sizes inside the **typography** scale, by role (headline,
  subhead, body), not in points you invent.
- Keep every element the user must read inside the **safe zones**; say
  where a thing sits ("upper third", "centred") rather than in pixels.
- Put timing in seconds or frames per beat, and the motion in one sentence
  per beat. Edits are one concrete change each.

What follows is the tool's own text.

## Style presets (use when the prompt implies one)

- **Minimalist** (default): primary #18181B, secondary #71717A, accent #3B82F6, bg #FAFAFA, text #18181B. Maximum whitespace, thin fonts, subtle motion.
- **Memphis**: primary #FF6B6B, secondary #4ECDC4, accent #FFE66D, bg #F7FFF7, text #2D3436. Geometric shapes, bold outlines, scattered confetti.
- **Neo-brutalism**: primary #FF5C00, secondary #3B82F6, accent #FACC15, bg #FFFFFF, text #000. Harsh 3–4px black borders, solid blocks, offset shadows (4px 4px 0 #000).
- **Glassmorphism**: backdrop-filter: blur(), transparency, subtle borders, gradient background like `linear-gradient(135deg, #667eea, #764ba2)`.
- **Neon/Cyberpunk**: primary #FF00FF, secondary #00FFFF, accent #FFFF00, bg #0A0A0F. Glow via box-shadow with color.
- **Corporate**: primary #1E40AF, secondary #3B82F6, accent #10B981, bg #F8FAFC, text #1E293B. Clean, structured.

## Layout

- Safe zones: top 10% for platform UI, bottom 15% for captions/buttons, center content 25–75% vertically.
- Centering pattern:
  ```tsx
  const centered: React.CSSProperties = {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  };
  ```

## Typography
- Headlines 72–120px, weight 700–900.
- Subheads 36–48px, weight 500–700.
- Body 28–36px, weight 400–500.
- Always set `margin: 0` on text elements.
