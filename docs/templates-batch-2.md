# Templates batch 2 — nine more built-ins

> Status: **BUILT 2026-09-17** — all nine, plus T1, H1, C1 and C2; the build
> log, the deviations from this spec and what is still unverified are in §9.
> Read `docs/templates-plan.md` first (the manifest is §2, the working copy §4,
> authoring §6). Source of every template:
> `D:\repos\vidtsx-addons\templates\<slug>\`.

Batch 1 was one template (`vidtsx/youtube-subs`) to prove the pipeline. Batch 2
takes the gallery to ten, across five categories, and deliberately picks
templates that exercise what batch 1 did not: `textarea`, `select`, bounded
numbers, webfonts, several images in one form, and **overlays**.

## 1. What the library looks like (surveyed 2026-09-17)

90 templates in the addons repo. Sorted by what the form can drive **today**:

| Bucket | Count | What blocks it |
|--------|------:|----------------|
| Built | 1 | `youtube-subs` |
| **Form-ready now** | **19** | nothing — flat scalar props, no audio |
| List content, no audio | 8 | a `list`/`table` control (plan §7): `bar-chart-race-clean`, `donut-breakdown`, `line-chart-grow`, `numbered-steps`, `process-flow`, `stat-dashboard`, `timeline-horizontal`, `top-5-countdown` |
| Take audio props | 62 | an **`audio` control** (`tickSound`, `musicFile`, `hitSound`… + `volume`). About a dozen of these are otherwise flat and unlock with that control alone (`flip-clock-transition`, `modern-countdown-timer`, `futuristic-countdown`, `cinematic-gradient-text`, `documentary-typewriter`, `kinetic-word-swap`, `title-animations`, `search-reveal-animation`, `tweet-highlighter`, `percentage-dot-grid`, `soft-new-year-countdown`, `animator-reveal` — judged from prop lists, verify each); the rest also need list controls |

Smaller gaps inside the 62: 10 use an **empty-string colour meaning "auto"**
(the `color` control requires `#hex` today), 2 import **three.js**
(`app-icon-intro-cinematic`, `battle-map-3d`), 1 takes a **video file**
(`aura-brand-reveal`).

**The takeaway for prioritising app work:** an `audio` control unlocks more of
the library than list controls do, and it is the smaller job (a file picker with
an audio filter, a play button, `''` = silent; both `/asset` routes already
serve audio). It should be the first capability after this batch.

The 19 form-ready, so a swap is cheap — full-frame: `github-stars`,
`quote-card`, `social-post-card`, `before-after`, `app-launch-teaser`,
`subscribe-bumper`, `channel-intro-kinetic`, `logo-reveal-mask`,
`endscreen-grid`, `countdown-3-2-1`\*. Overlays: `name-title-third`,
`social-handle-bug`, `key-point-callout`, `countdown-timer`\*, `alert-toast`,
`topic-chip`, `logo-bug`\*, `step-badge`, `chapter-progress`\*.

\* wants a **length** control to be really useful (§5 C3): `countdown-3-2-1`'s
README says raising the count "needs a longer composition"; a corner bug or a
chapter bar is meant to run the length of the video, not 8–10 s.

## 2. The nine

| # | Template | Category | Len | Why it is in |
|---|----------|----------|----:|--------------|
| 1 | `github-stars` | `milestones` | 10 s | Sibling of `youtube-subs`; makes Milestones a real category. Simplest form — a good first one to add. |
| 2 | `quote-card` | `social` | 9 s | First `textarea`. Universal use (testimonials). A `theme` select that changes the whole look. |
| 3 | `before-after` | `product` | 9 s | Two images that ARE the content; a bounded number (`finalSplit` 0.2–0.8). |
| 4 | `app-launch-teaser` | `product` | 10 s | The biggest form (11 controls, 4 groups) — tests grouping and scroll. `device` select redraws the mockup. |
| 5 | `subscribe-bumper` | `openers` | 4 s | First **webfont** built-in (Archivo). Two selects, no images, no assets. |
| 6 | `logo-reveal-mask` | `openers` | 4 s | Webfont + `maskShape` select with four visibly different results — the best demo of what a form can do. |
| 7 | `name-title-third` | `overlays` | 4 s | The lower third: the most reused thing in the catalogue. Three designs behind one select. |
| 8 | `social-handle-bug` | `overlays` | 8 s | Corner bug; a 7-option `platform` select; two bounded numbers. |
| 9 | `key-point-callout` | `overlays` | 5 s | Annotation; `targetX`/`targetY` percentages make the case for a slider (§5 C1). |

Left for batch 3, in rough order: `social-post-card` (close twin of
`quote-card`), `channel-intro-kinetic`, `endscreen-grid`, `alert-toast`,
`topic-chip`, `step-badge`, then the four starred ones once C3 exists.

## 3. Order of work

**Step 0 — before adding anything.**
1. **Commit batch 1.** P0–P3 is still uncommitted and other sessions are waiting
   on those files (`Status.md`, `MotionScreen.tsx`…). Commit by pathspec — the
   tree holds other sessions' work; never `git add -A`.
2. **Do the UI click-through that batch 1 never got** (plan §8). Nine more
   templates on an unverified UI is the wrong order. Restart the dev app (new
   IPC), or use the isolated-second-instance recipe now in
   `docs/ui-automation-cdp.md`. Check: mode toggle, gallery, open, every control
   type, a preset, a format switch (canvas and layout flip together), autosave
   across a restart, Render → the Rendered tab, and opening a library project
   from Templates mode. Fix what it finds first.

**Step 1 — tooling (§5 T1, H1).** Promote the verify harness to a script that
also makes thumbnails; add the reverse-asset test. Nine thumbnails by hand is
how mistakes get in.

**Step 2 — the six full-frame templates**, in table order. No app changes. One
at a time: copy → manifest → thumb → tests → look at it.

**Step 3 — overlay support (§5 C2).** Required before any overlay ships:
without it an overlay previews as a dark plate on a near-black page and renders
as an opaque black MP4.

**Step 4 — the three overlays.**

**Step 5 — C1 (slider)**, then gates, the plan log, and a CDP pass over all ten.
C1 is last because it is polish: every template works without it.

## 4. Conventions for this batch

- **id** `vidtsx/<slug>`, **`minAppVersion`** `1.1.0`, **`version`** `1.0.0`,
  author and license as `youtube-subs`. **formats**: all nine take `format` with
  the standard three (16:9 1920×1080 · 9:16 1080×1920 · 1:1 1080×1080), default
  `landscape`.
- **Categories** (slugs → the gallery title-cases them): `milestones`, `social`,
  `product`, `openers`, `overlays`. `categoryLabel()` turns `openers` into
  "Openers"; if "Openers & outros" is wanted, that is a label map in
  `template-labels.ts`, not a longer slug.
- **Defaults equal the TSX defaults**, read from the default export's
  destructuring — not from `preview-props.json`, which holds showcase values.
- **Image defaults.** An image that is *decoration* (a background) defaults to
  `''` and the bundled artwork is offered through a preset. An image that is the
  user's *content* defaults to `''` too when the stand-in is graceful (an
  initials disc beats a stranger's face) — but to the bundled sample when the
  procedural stand-in undersells the template (`before-after`'s pair). Decide
  from a render, per template.
- **Ship only what is referenced.** Copy an asset only if a default or a preset
  names it. Never copy `_prompt-*.txt` or `*.json` sidecars. (`youtube-subs`
  ships an unreferenced 339 KB `avatar.jpg` — H1 removes it.)
- **Presets are complete looks** *of the style controls only*. Where a
  background image is part of the look, every preset sets it (to a path or
  `''`). Where images are the user's content (`before-after`), no preset touches
  them. 4–6 per template; the first matches the defaults so it shows as active.
- **`maxLength`** on every text control, from the README's guidance where it
  gives one; **`help`** only where it says something the label does not —
  especially "empty hides this".
- **Select labels** are human (`'top-right'` → "Top right"); values stay the
  TSX's literals.
- **Thumbnail** `thumb.jpg`, 640×360, JPEG ~q86, from the poster frame in §6,
  rendered with the manifest defaults. Overlays are rendered over a backdrop —
  on black there is nothing to see.

## 5. App changes

**C1 — slider for bounded numbers** *(small; `ParamField` only).* When a
`number` control has both `min` and `max`, render a range input beside the text
field, sharing the value; `step` applies to both. Helps `finalSplit`,
`restOpacity`, `targetX`/`targetY`, `contributorCount`, `collapseAfter`. No
manifest change.

**C2 — overlay support** *(required for #7–9).* `manifest.overlay` already
exists and already badges the card. Two things are missing:
1. *Render defaults.* `RenderSettingsModal` starts at `transparent: false` and
   has no way in. Add an optional `initial?: { codec?: RenderCodec;
   transparent?: boolean }` prop (applied once per open, below the user's own
   persisted defaults only when given); `TemplatePreviewPanel` passes
   `{ codec: 'vp9', transparent: true }` for an overlay, plus one line of help in
   the form ("Renders with a transparent background — WebM or ProRes").
2. *Preview backdrop.* The preview page is `#0a0a0e` (`preview-html.ts`). Add a
   `setBackdrop` preview command (`none | checker | soft | dark | warm`) that
   paints BEHIND the Player — page CSS, never the composition — and an
   `IsolatedPreview` `backdrop` prop. `TemplatePreviewPanel` shows a small
   Backdrop picker for overlays, default `soft`. Preview-only by construction:
   the staged file is untouched, so "preview == render" still holds for the
   composition itself. The three stand-ins can be ported from the addons
   harness (`tools/render.mjs`, "Demo backdrops for --stage").

**C3 — length** *(optional; NOT needed for the nine — do after, it unlocks
four more).* A first-class manifest field beside `formats`:
`"length": { "default": 8, "min": 4, "max": 600 }` (seconds), opt-in per
template because the TSX must be safe at any length (true where every beat is
relative to the start and the rest is a hold). Staging rewrites
`durationInFrames` exactly as it rewrites the canvas — `applyCanvasToConfig`
generalises to `applyConfigNumbers`. A computed form
(`"fromControls": "from * secondsPerCount + 2"`) is what `countdown-3-2-1` needs;
start with the plain number and see if the computed one is still wanted.

**H1 — asset hygiene.** Add to `manifest.test.ts`' built-ins block: every file
under a template's `assets/` is named by a default or a preset. Then delete
`resources/templates/vidtsx/youtube-subs/assets/avatar.jpg`.

**T1 — `scripts/template-verify.mjs`.** Promote
`.vidtsx-temp/templates-verify/` (harness + electron stub + esbuild runner).
- `--id vidtsx/<slug> [--format all]` — today's assertions (bundle reports the
  staged canvas; every image prop fetched 200), using the manifest **defaults**
  and then each **preset**, so a preset naming a missing file fails here.
- `--thumb --frame N [--backdrop soft]` — `renderStill` with
  `scale: 1/3, imageFormat: 'jpeg', jpegQuality: 86` straight to
  `<template>/thumb.jpg`. No PowerShell downscale step. `--backdrop` swaps the
  app's wrapper for one that paints a stand-in under the component.
- Keep `enableCaching: false` — it must never touch a running dev app's cache.
- Pass `fontProxyBaseUrl` only if the font proxy can be mounted without
  Electron; otherwise the webfont templates fetch Google Fonts directly, which
  is fine for verification on a connected machine — say so in the output.

## 6. The nine, specified

Types: **T** text · **TA** textarea · **N** number · **C** color · **S** select ·
**B** boolean · **I** image. `max` = `maxLength`. Poster = thumbnail frame, a
starting point — judge it from the render.

### 6.1 `github-stars` — milestones · poster f270
Ships `assets/bg-space.jpg`.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Repository | `repo` | T | `vidtsx/studio` | max 60 · help: "owner/repo — the owner is muted, the repo bold" |
| | `description` | T | `Desktop studio for TSX video compositions.` | max 90 |
| | `language` | T | `TypeScript` | max 24 · help: "Sets the dot colour for common languages" (17 known names in `LANGUAGE_COLORS`; others fall back to the accent — so text, not select) |
| Milestone | `stars` | N | `10000` | 0–9999999, step 1 |
| | `since` | T | `in 6 months` | max 40 |
| | `contributorCount` | N | `12` | 0–24, step 1 · help: "Avatars in the orbit ring" |
| Style | `accent` | C | `#FFD166` | |
| | `backgroundImage` | I | `''` | help: "Empty draws a starfield" |

Looks: **Gold** (`#FFD166`, `''`) · **Deep Space** (`#FFD166`, `assets/bg-space.jpg`) · **Violet** `#7C5CFF` · **Cyan** `#22D3EE` · **Mint** `#3DD68C` (all `''`).

### 6.2 `quote-card` — social · poster f250
Ships `assets/bg-studio.jpg`. Not `portrait.jpg` (the initials disc is the better default).

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Quote | `quote` | TA | `The best way to predict the future is to build it.` | max 320 · help: "12–40 words fits best; the type resizes to suit" |
| Author | `author` | T | `Hasan Aboul Hasan` | max 40 |
| | `role` | T | `Founder, VidTSX` | max 48 |
| | `portrait` | I | `''` | help: "Square. Empty draws initials" |
| Style | `theme` | S | `dark` | Dark studio / Light paper |
| | `accent` | C | `#FFD166` | |
| | `textColor` | C | **`#F5F1E8`** | help: "Leave as is and the theme picks cream or ink" |
| | `backgroundImage` | I | `''` | |

**Gotcha — a sentinel default.** The TSX has `textColor = DEFAULT_TEXT`
(`'#F5F1E8'`) and `light && textColor.toUpperCase() === DEFAULT_TEXT ? INK :
textColor`. The manifest default must be exactly `#F5F1E8`, and **no preset may
set `textColor`**, or Light paper renders cream on cream. Verify by rendering the
Light look.
Looks: **Studio** (dark, `#FFD166`, `''`) · **Studio Backdrop** (dark, `#FFD166`, `assets/bg-studio.jpg`) · **Paper** (light, `#C2410C`, `''`) · **Paper Blue** (light, `#2563EB`, `''`).

### 6.3 `before-after` — product · poster f250
Ships `assets/before.jpg`, `assets/after.jpg` **if** they become the defaults (recommended — decide from a render of the procedural stand-in).

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Images | `beforeImage` | I | `assets/before.jpg` *(TSX: `''`)* | help: "Use a matched pair — same camera, same framing" |
| | `afterImage` | I | `assets/after.jpg` *(TSX: `''`)* | |
| Labels | `beforeLabel` | T | `Before` | max 16 |
| | `afterLabel` | T | `After` | max 16 |
| | `title` | T | `One prompt. Ten seconds.` | max 48 |
| | `caption` | T | `Same footage, restyled in VidTSX Studio.` | max 80 |
| Style | `finalSplit` | N | `0.55` | 0.2–0.8, step 0.01 · help: "Where the divider comes to rest" |
| | `accent` | C | `#22D3EE` | |
| | `showHandle` | B | `true` | |

The one deliberate break from "defaults equal the TSX defaults" — note it in the
manifest's neighbours (the README row) so nobody "fixes" it.
Looks (accent only — the images are content): **Cyan** `#22D3EE` · **Amber** `#F5B02E` · **Rose** `#FB7185` · **Lime** `#A3E635`.

### 6.4 `app-launch-teaser` — product · poster f280
Ships `assets/bg-glow.jpg`. `screenshot.jpg` (140 KB) only if it becomes the default — the procedural UI is drawn in the accent, the JPEG is not, so probably keep `''`.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| App | `appName` | T | `VidTSX Studio` | max 28 |
| | `tagline` | T | `AI video, rendered on your machine` | max 60 |
| | `device` | S | `laptop` | Laptop / Phone / Browser |
| | `screenshot` | I | `''` | help: "Shown inside the screen. Empty draws a stand-in UI" |
| Features | `feature1` | T | `TSX compositions from a prompt` | max 40 · help: "Leave one empty to show fewer" |
| | `feature2` | T | `Auto Cut talking-head footage` | max 40 |
| | `feature3` | T | `Local image & speech models` | max 40 |
| Call to action | `cta` | T | `Free download` | max 24 |
| | `ctaColor` | C | `#FFFFFF` | help: "The text flips dark or light to suit" |
| Style | `accent` | C | `#7C5CFF` | |
| | `backgroundImage` | I | `''` | |

Looks (accent · ctaColor · background): **Violet** (`#7C5CFF` · `#FFFFFF` · `''`) · **Violet Glow** (… · `assets/bg-glow.jpg`) · **Ocean** (`#22D3EE` · `#FFFFFF` · `''`) · **Sunset** (`#FB7185` · `#FFD166` · `''`).

### 6.5 `subscribe-bumper` — openers · poster f110 · WEBFONT
No assets. First webfont built-in: confirm Archivo really loads in the **app**
preview (font proxy) and in a render — a fallback face is the failure to look for.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Channel | `channelName` | T | `Learn With Hasan` | max 32 · help: "Empty hides the row" |
| | `handle` | T | `@learnwithhasan` | max 32 |
| | `note` | T | `New video every Tuesday` | max 40 · help: "Empty hides it" |
| Button | `action` | S | `Subscribe` | Subscribe / Follow / Join |
| | `platform` | S | `youtube` | YouTube / X / Instagram / TikTok / LinkedIn / Generic |
| | `showCursor` | B | `true` | |
| Style | `accentColor` | C | `#E11D48` | |
| | `bgColor` | C | `#0B0B12` | |
| | `textColor` | C | `#FFFFFF` | |

Looks (accent · bg · text): **Crimson** (`#E11D48` · `#0B0B12` · `#FFFFFF`) · **Violet** (`#7C5CFF` · …) · **Ocean** (`#0EA5E9` · …) · **Daylight** (`#E11D48` · `#F7F7FA` · `#0B0B12`).

### 6.6 `logo-reveal-mask` — openers · poster f110 · WEBFONT
Ships `assets/field.jpg`. Not `mark.jpg` (the monogram tile is the better default).

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Brand | `logo` | I | `''` | help: "Square works best. Empty draws a monogram" |
| | `brandName` | T | `VidTSX` | max 24 |
| | `tagline` | T | `Video, in TSX` | max 40 |
| | `showTagline` | B | `true` | |
| Reveal | `maskShape` | S | `circle` | Circle / Wipe / Blinds / Diagonal |
| Style | `accentColor` | C | `#7C5CFF` | |
| | `bgColor` | C | `#0B0B12` | |
| | `textColor` | C | `#FFFFFF` | |
| | `bgImage` | I | `''` | |

Looks (accent · bg · text · bgImage): **Violet** (defaults) · **Violet Field** (… · `assets/field.jpg`) · **Ember** (`#F97316` · `#0F0A07` · `#FFFFFF` · `''`) · **Mono** (`#FFFFFF` · `#0A0A0A` · `#FFFFFF` · `''`) · **Daylight** (`#7C5CFF` · `#F7F7FA` · `#0B0B12` · `''`).

### 6.7 `name-title-third` — overlays · poster f60 over `soft` · `overlay: true`
No assets.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Person | `name` | T | `Hasan Aboul Hasan` | max 40 |
| | `role` | T | `Founder, VidTSX Studio` | max 48 |
| | `handle` | T | `''` | max 40 · help: "Optional third line. Empty hides it" |
| | `avatar` | I | `''` | help: "Empty draws initials" |
| | `showAvatar` | B | `true` | |
| Design | `variant` | S | `bar` | Bar / Plate / Minimal |
| | `side` | S | `left` | Left / Right |
| Style | `accent` | C | `#FFD166` | |
| | `plateColor` | C | `#0E1116` | |
| | `textColor` | C | `#FFFFFF` | |

Looks (accent · plate · text): **Gold** (defaults) · **Violet** (`#7C5CFF` · …) · **Cyan** (`#22D3EE` · …) · **Light plate** (`#E11D48` · `#F5F5F2` · `#0E1116`).

### 6.8 `social-handle-bug` — overlays · poster f120 over `soft` · `overlay: true`
No assets. 8 s and then it rests forever — the first customer for C3.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Handle | `handle` | T | `@learnwithhasan` | max 32 |
| | `tagline` | T | `''` | max 32 · help: "Empty hides it" |
| | `platform` | S | `none` | None / X / YouTube / Instagram / TikTok / LinkedIn / GitHub |
| | `logo` | I | `''` | help: "Empty draws a mark from the handle's first letter" |
| Placement | `variant` | S | `pill` | Pill / Bar |
| | `position` | S | `top-right` | Top left / Top right / Bottom left / Bottom right |
| | `collapseAfter` | N | `0` | 0–7, step 0.5 · help: "Seconds until it folds to the mark. 0 stays open" |
| | `restOpacity` | N | `0.92` | 0.3–1, step 0.01 |
| Style | `accent` | C | `#7C5CFF` | |
| | `plateColor` | C | `#0B0E14` | |
| | `textColor` | C | `#FFFFFF` | |

Looks (accent · plate · text): **Violet** (defaults) · **Crimson** (`#E11D48` · …) · **Cyan** (`#22D3EE` · …) · **Light plate** (`#7C5CFF` · `#F5F5F2` · `#0B0E14`).

### 6.9 `key-point-callout` — overlays · poster f75 over `soft` · `overlay: true`
No assets. With the default `targetX/Y` the mark points at nothing in a
thumbnail — aim it at the backdrop's bright spot so the card reads.

| Group | key | Type | Default | Notes |
|-------|-----|------|---------|-------|
| Text | `label` | T | `Tap here` | max 28 · help: "1–4 words reads best" |
| | `detail` | T | `The one setting nobody changes` | max 60 · help: "Empty for a bare label" |
| Target | `targetX` | N | `63` | 0–100, step 1 · help: "% of the frame width" |
| | `targetY` | N | `41` | 0–100, step 1 · help: "% of the frame height" |
| | `direction` | S | `right` | Right / Left / Up / Down · help: "Which way the line leaves the mark" |
| | `targetStyle` | S | `ring` | Ring / Dot / Crosshair |
| Style | `plateStyle` | S | `solid` | Solid / Outline |
| | `accent` | C | `#22D3EE` | |
| | `plateColor` | C | `#0B0E14` | |
| | `textColor` | C | `#FFFFFF` | |

Looks (accent · plateStyle): **Cyan** (defaults) · **Amber** (`#F5B02E` · solid) · **Rose** (`#FB7185` · solid) · **Outline** (`#FFFFFF` · outline).

## 7. Per-template procedure

1. Copy `composition.tsx` unchanged, plus only the assets §6 names, into
   `resources/templates/vidtsx/<slug>/`.
2. Write `template.json` from §6. **Re-read the default export's destructuring
   first** — this doc was written from a survey; the source wins.
3. `npx vitest run src/shared/templates src/main/services/templates` — the
   built-ins block checks the manifest, the files, that every key appears in the
   source, and that it stages and transpiles in all three formats.
4. `node scripts/template-verify.mjs --id vidtsx/<slug> --format all`, then
   `--thumb`. **Open the thumbnail and one portrait still** — a passing log is
   not a correct picture.
5. Render each Look once and look at it (a preset is a claim about how the
   template looks; nobody has checked it until it is rendered).

## 8. Done when

- Ten cards in the gallery, five category pills, every card with a thumbnail.
- Gates: `check:types` at baseline; full vitest green; `template-verify` passes
  for all ten in all three formats, defaults and every preset.
- An overlay opens with a backdrop in preview and its Render dialog opens on a
  transparent codec; the rendered file really has alpha (check it over footage
  in Studio, not by eye on black).
- A CDP pass over all ten: open each, change one control of each type it has,
  apply a preset, switch format, render one.
- `docs/templates-plan.md` §8 gains the log entry; this file's status line
  changes to BUILT; `Status.md` gets its entry.

## 9. Build log — 2026-09-17

**Step 0.** Batch 1 committed by pathspec as `560ea19` (47 files, every hunk
checked as templates-only; the unreferenced `avatar.jpg` left out). UI
click-through over CDP on a restarted dev app (`.vidtsx-temp/templates-cdp/`,
steps 1–5): mode toggle, gallery + thumbnail, open, text / number (typed and
out-of-range clamp) / boolean / colour / image Remove, a colour that lights its
matching preset, a preset that sets an image (the field thumbnail loads), 16:9 →
9:16 (canvas and layout flip together), a Prompt ↔ Templates round trip keeps
the open template, Reset, Render → queue → the Rendered tab (frame pulled from
the MP4: the form's values are in it), and opening a library project from
Templates mode leaves the mode. Autosave across a real app restart: text, a
slider number and the format all came back. Nothing needed fixing.

**T1 — `scripts/template-verify.mjs`** (+ `scripts/template-verify/`: `harness.ts`,
`server.ts`, `backdrop-wrapper.ts`, `electron-stub.cjs`). As §5 specified, with
three additions: the **font proxy is mounted** (the stub's userData holds its
cache, so webfont templates go through the app's real proxy); a failed image
load no longer aborts the run — the look is reported FAIL with the 404 and the
rest carry on (checked by hiding `bg-glow.jpg`); every still lands in
`.vidtsx-temp/template-verify/out/<ns>-<name>/<format>-<look>.jpg`. Overlays get
the `soft` backdrop unless `--backdrop` says otherwise. One template, three
formats, all looks: about a minute.

**H1.** The built-ins test now fails on any file under `assets/` that no default
or preset names; `youtube-subs/assets/avatar.jpg` is deleted.

**C2 — overlays.** `RenderSettingsModal` takes `initial` (applied on every
open); an overlay opens on WebM with transparency on. The preview page has a
`#backdrop` layer sized to the Player's letterboxed frame and a `setBackdrop`
command; `IsolatedPreview` takes `backdrop`; `TemplatePreviewPanel` shows a
Backdrop select for overlays (None / Checker / Daylight / Night / Warm, default
Daylight = `soft`, remembered in localStorage) and the form says "Renders with a
transparent background — WebM or ProRes". The stand-ins live in
`shared/templates/backdrops.ts` as ONE CSS background each — an SVG data URI in
the frame's units, so blur and grain scale with the frame — and the verify
script paints the very same value under the component, so a thumbnail and the
preview show the identical backdrop. The addons harness's drift is dropped.

**C1 — slider.** A range input beside the text field when a number has `min`
and `max` **and at most 1000 stops** (`(max − min) / step`). The step cap is not
in §5: without it `youtube-subs`' subscribers (0–999 999 999) and
`github-stars`' stars would get a slider nobody can land a value with.

**Deviations from §6, each decided from a render:**
- `before-after` defaults to the bundled pair, as recommended: the procedural
  stand-in (a flat landscape) undersells a restyle. This is the one manifest
  default that differs from the TSX default — deliberate, do not "fix" it.
- `subscribe-bumper`'s thumbnail is **f64**, not f110: f110 is the grey
  "Subscribed" state; f64 is the red button with the pointer on it.
- `key-point-callout` keeps its default target for the thumbnail: over the soft
  backdrop, 63 % / 41 % lands on the stand-in's head, which reads as intended.
- The built-in staging test only expects the asset helper when the source calls
  `staticFile(` (`subscribe-bumper` has no images), and its timeout is 60 s — it
  transpiles every built-in in every format and passed 5 s under full-suite load.

**Verified.**
- `template-verify` passes for all ten, three formats each, defaults plus every
  preset; every look was looked at as a contact sheet
  (`.vidtsx-temp/template-verify/sheet.py`). `quote-card`'s Light paper looks
  render ink, not cream on cream (the sentinel holds). Archivo is in the proxy's
  cache and on the frames.
- CDP pass over all ten in the app (`step6-all.mjs`): 73/73 — preview loads,
  one control of each type the template has is changed and autosaved
  (sliders driven as sliders), a preset applies (the image-setting preset where
  one exists, with the field thumbnail loading), 9:16 shows its canvas without
  an error, overlays have the Backdrop select and a painted `#backdrop` layer in
  the webview, and **Archivo reports `loaded` (700 and 900) inside the app
  preview** for both webfont templates. Inside the guest, the lower third is
  hit-tested above `#backdrop`.
- An overlay render from the UI (`name-title-third`): the dialog opened on WebM
  with transparency on; the file is VP9 with `alpha_mode=1`; decoded with
  libvpx-vp9 its frame at 2 s is 90 % fully transparent with a translucent
  plate, and composited over a photo it sits correctly on the footage.
- Gates: `check:types` at baseline (web 26, node 10), no error in a touched
  file; vitest 307 files / 2714 tests — the full run had 9 timeouts in
  disk-heavy suites (the known load flake), all 5 files green on a rerun.

**Not verified / left open.**
- The WebM was checked over a photo with ffmpeg + PIL, **not over footage in a
  Studio project** as §8 asks.
- Window screenshots of the live preview over a backdrop timed out once the
  window was covered; the backdrop was proven through the webview's DOM and the
  harness stills, which paint the same CSS.
- The addons repo is still untouched: its `templates/AUTHORING.md` needs the
  `template.json` section.
- Seen on the way, not templates code: the Rendered tab labels a 486×864 render
  "720p" (`formatResolution` labels portrait by height while the Render dialog
  called that size "480p"); the dev-only preview-quality HUD overlaps the
  player's controls.
- Next per §2: batch 3 (`social-post-card` first), then C3 (length) for the four
  starred templates; the `audio` control is still the larger unlock (§1).
