// The craft rules — style presets, layout and typography (V1 completion plan
// §2.7, W7). Once the craft half of the one-shot pipeline's 2D prompt (deleted
// in P3 part 8); now read by `renderTsxCraftSkill`, which wraps it as the
// tsx-composer agent's `tsx-craft` skill, so the agent that BRIEFS the
// composition tool speaks one vocabulary (preset names, the type scale, the
// safe zones). `scripts/gen-tsx-craft-skill.mjs` rewrites the SKILL.md, and
// `tsx-craft-skill.test.ts` fails when the two drift.

export const TSX_CRAFT_RULES = `## Style presets (use when the prompt implies one)

- **Minimalist** (default): primary #18181B, secondary #71717A, accent #3B82F6, bg #FAFAFA, text #18181B. Maximum whitespace, thin fonts, subtle motion.
- **Memphis**: primary #FF6B6B, secondary #4ECDC4, accent #FFE66D, bg #F7FFF7, text #2D3436. Geometric shapes, bold outlines, scattered confetti.
- **Neo-brutalism**: primary #FF5C00, secondary #3B82F6, accent #FACC15, bg #FFFFFF, text #000. Harsh 3–4px black borders, solid blocks, offset shadows (4px 4px 0 #000).
- **Glassmorphism**: backdrop-filter: blur(), transparency, subtle borders, gradient background like \`linear-gradient(135deg, #667eea, #764ba2)\`.
- **Neon/Cyberpunk**: primary #FF00FF, secondary #00FFFF, accent #FFFF00, bg #0A0A0F. Glow via box-shadow with color.
- **Corporate**: primary #1E40AF, secondary #3B82F6, accent #10B981, bg #F8FAFC, text #1E293B. Clean, structured.

## Layout

- Safe zones: top 10% for platform UI, bottom 15% for captions/buttons, center content 25–75% vertically.
- Centering pattern:
  \`\`\`tsx
  const centered: React.CSSProperties = {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  };
  \`\`\`

## Typography
- Headlines 72–120px, weight 700–900.
- Subheads 36–48px, weight 500–700.
- Body 28–36px, weight 400–500.
- Always set \`margin: 0\` on text elements.`;
