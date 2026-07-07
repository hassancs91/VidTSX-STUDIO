# CAPTION_STYLES_PLAN.md

A running plan for the Studio caption-style library. Hand this file back to Claude when you want to add new styles — it has the recipe, the architecture pointers, and the queue of styles we've discussed.

## How to add a new style (the recipe)

Adding a style is fully data-driven now — picker UI, settings tab, persistence, and Player wiring all extend automatically once a style is registered. Four mechanical steps:

1. **Declare the settings shape + defaults** in [src/shared/captions/types.ts](src/shared/captions/types.ts):
   ```ts
   export interface MyStyleSettings { /* whatever the style needs */ }
   export const DEFAULT_MY_STYLE_SETTINGS: MyStyleSettings = { /* ... */ };
   ```
2. **Add the literal** to the `CaptionStyleId` union in the same file.
3. **Create the template file** at [src/shared/captions/templates/MyStyleCaptions.tsx](src/shared/captions/templates/) exporting:
   - `MyStyleCaptions` — the Remotion component (`CaptionTemplateProps<MyStyleSettings>`)
   - `MyStyleConfigPanel` — the settings UI (`CaptionConfigPanelProps<MyStyleSettings>`). Use the shared field primitives in [config-primitives.tsx](src/shared/captions/templates/config-primitives.tsx) (`ColorField`, `NumberField`, `SelectField`).
4. **Register** in [src/shared/captions/templates/index.ts](src/shared/captions/templates/index.ts) — one entry in the `CAPTION_STYLES` array.

That's it. **Don't edit** the picker, settings tab, storage, or Player wiring — they consume the registry.

### Conventions worth keeping

- **Use real word timestamps** when the style does anything per-word — import `getWordTimings(segment)` from [word-timing.ts](src/shared/captions/templates/word-timing.ts). It returns real `analysis.utterances[].words[]` when available, falls back to character-distribution otherwise. Never inline the fallback.
- **Stroke text** via the 8-direction `textShadow` trick (see `buildTextShadow` in HormoziCaptions / HighlightBoxCaptions / WordPopCaptions). Pull it out into a shared helper if a third style needs it.
- **Position + fontSize live in `baseSettings`**, not in the style's own settings. Per-style settings should only be visual concerns the style cares about (colours, accents, animation knobs).
- **Defaults must be complete** — every key in `MyStyleSettings` needs a value in `DEFAULT_MY_STYLE_SETTINGS`. `resolveStyleSettings()` merges stored values over defaults; missing-from-defaults keys become `undefined` in templates.

---

## Shipped styles

- [x] **Bold Pop** — large pop-in text, optional every-Nth accent ([BoldPopCaptions.tsx](src/shared/captions/templates/BoldPopCaptions.tsx))
- [x] **Hormozi** — uppercase + thick stroke, per-word pop, longest-word accent ([HormoziCaptions.tsx](src/shared/captions/templates/HormoziCaptions.tsx))
- [x] **Highlight Box** — coloured pill behind the active word ([HighlightBoxCaptions.tsx](src/shared/captions/templates/HighlightBoxCaptions.tsx))
- [x] **Word Pop** — one word at a time, huge, centred, spring entry ([WordPopCaptions.tsx](src/shared/captions/templates/WordPopCaptions.tsx))
- [x] **Karaoke** — word-by-word colour swap, real word timing ([KaraokeCaptions.tsx](src/shared/captions/templates/KaraokeCaptions.tsx))
- [x] **Minimal** — clean bottom subtitle with optional bar ([MinimalCaptions.tsx](src/shared/captions/templates/MinimalCaptions.tsx))

---

## Queue — Tier 2 (popular, strong creative options)

- [ ] **MrBeast / Color-Coded** — whole-segment colour rules: numbers in red, `$`/money in green, exclamatory or all-caps source words in yellow. Heavy stroke, slight wobble entry. Riskier because the keyword-detection rule needs to be good; start with `$`, numerics, ALLCAPS source tokens.
- [ ] **Typewriter** — characters reveal one-by-one at a controlled chars-per-second rate. Monospaced or sans. Great for documentary / educational / tutorial content. Settings: `cps`, font family (mono vs sans), caret on/off.
- [ ] **Cinematic Bar** — small sans-serif, low-opacity black bar across full width at the bottom. Netflix-style. Settings: bar opacity, bar height, text colour, optional side-accent strip.

## Queue — Tier 3 (niche / experimental)

- [ ] **Glitch / RGB-Split** — segment enters with brief RGB-split + jitter. Settings: split distance, jitter amount, entry duration.
- [ ] **Bubble / Chip** — text inside a rounded pill (whole segment, not per-word). Vlog-style. Settings: pill colour, pill radius, text colour.
- [ ] **Word Stack** — words stack vertically, one per line, animate in from below. Best for 9:16. Settings: gap, per-word delay, entry direction.
- [ ] **Quote / Italic** — small italic with quote marks, fades in, fades out. Cinematic. Settings: text colour, show quote marks toggle, italic toggle.

## Backlog ideas (no commitment, brainstorm parking lot)

- [ ] **Active Underline** — like Highlight Box but the active word gets an animated underline that grows left-to-right with its duration.
- [ ] **Twitter / X-style** — white card on a coloured background with avatar slot. (Probably out of scope without a face/handle source.)
- [ ] **Comic Pop** — comic-book bubble outline around segments, with optional speech-bubble tail.
- [ ] **Caption Stickers** — auto-insert emoji per keyword detection (😂 for laughter cues, 💰 for "money" etc.). Needs a keyword→emoji map and would likely live as a *layer on top of* existing styles rather than its own style.

---

## How to invoke this with Claude

When you want to add the next batch, say something like:

- "Add the next batch from CAPTION_STYLES_PLAN.md" → I'll pull the first ~3 unchecked Tier 2 items and ship them.
- "Add Typewriter and Cinematic Bar from the plan" → I'll do just those two.
- "Add MrBeast style" → I'll pull only that one and ask before committing if its keyword rules need clarification.

After shipping, I'll check the boxes here so the file stays the source of truth.
