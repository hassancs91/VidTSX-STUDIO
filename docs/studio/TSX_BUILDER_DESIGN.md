# TSX Builder: Claude-Code-grade TSX generation for the whole app

> Written 2026-10-10 from Hasan's brief: **"I want to have it generate any kind of TSX the same
> we create here"**, meaning the same way Claude Code builds TSX in `ai-video-lab`, and **for
> every caller**: the TSX Creator, Studio shots, the Studio assistant, agents and flows. The
> pattern is the same as `RECORDER_DESIGN.md`: evidence and verified facts first, then the
> decisions, each with a named recommendation, then a checklist to answer inline.
> **Nothing here is DECIDED until Hasan marks it. No code has been written.**
>
> This doc absorbs proposals P1–P5 of `CLAUDE_CODE_PARITY_AUDIT.md` (file tools, eyes,
> multi-file, import tiers, session continuity), now backed by measured runs. The audit's
> §6 checklist is superseded by §6 here.
>
> Facts marked **[verified]** were read from the code on 2026-10-10. Facts marked **[measured]**
> come from real runs in the `studio-unlock-01` experiment (§1). Facts marked **[spike]** are
> expected but not yet proven in our runtime; P0 exists to prove them.

> **Rev 2 — DECIDED by Hasan 2026-10-12** (after P1 part 5). Where this block and the text below
> disagree, this block wins.
> 1. **The builder is the only generator.** The one-shot `generateTsxPipeline` is deleted from
>    generation in P3, once the builder does 3D (P2). Reasons: there are no users yet; V1 ships
>    three LLM providers (Claude Subscription, Claude API key, OpenRouter) and all three are
>    `agent-sdk` (OpenAI, Gemini, Z.AI, MiniMax, Kimi are hidden presets,
>    `llm-preset-visibility.ts`; `local` is dev-only); and a non-Claude model passed the builder
>    through OpenRouter (§5, P1 part 5). Until P3 the pipeline is frozen: no new work on it, and
>    it serves only Creator 3D. Providers without tools get a clear error, not a second path.
> 2. **No library limits (T4 Rev 2, option A): a broad curated set built into the app**, not
>    tiers. Option B (download any npm package at build time) was rejected for now: a new
>    outbound network class and unknown package code inside the renderer.
> 3. **"No limits" also covers what is not a library:** GPU rendering for 3D stills and export,
>    frame-pure physics, an assets folder for the builder, package resolution in the packaged
>    app, and no network at render (T4 Rev 2).
> 4. **Order unchanged:** P1 part 6 → part 7 (exit) → P2 "no limits" → P3 callers + pipeline
>    deleted → P4 → P5. Hasan: "anyway, I will finish everything".

---

## 0. The one property that must survive

> **Whoever designs the picture must be able to see it.** In today's app the picture is
> decided blind: a planner or agent writes a brief, and a second model writes the code
> without ever seeing a frame. The builder is ONE model that designs, writes the code, renders
> frames, looks at them, and redesigns, as many rounds as its budget allows. Every caller hands
> it intent (what and why), never pixel coordinates. Every caller gets the same builder.

---

## 1. Evidence: the `studio-unlock-01` experiment [measured]

Location: `D:\repos\ai-video-lab\experiments\studio-unlock-01\` (private lab repo).
`reference/` and `runs/` are gitignored and exist on Hasan's PC only.
- Read `FINDINGS-R0.md` and `FINDINGS-R0b.md` there.
- The wall is a Remotion Studio: `cd reference && npx remotion studio src/index.ts --port 3920 --no-open`.
  Compositions `R0b-B1`..`R0b-B4` (three columns), `WallB1..B4`, `WallT1`.

**Setup.** The test client was an installable agent, "Infographic Loop" (`agent/`, packed as
`lwh.infographic-loop-0.1.0.vidtsxagent`). It makes animated infographic posts: 4:5, an
8-second seamless loop, one picture whole on every frame. It has three skills: the form,
concept to picture, and four styles (Blueprint, Flat bold, Neon dark, Editorial) plus a
custom style. Four fixed briefs are in `briefs.md`; B4 uses a custom chalkboard style. The
dev app ran on a throwaway profile and was driven over CDP (`driver/`).

| Column | What it is | Time per piece | Tokens |
|---|---|---|---|
| 1 · Studio today | the agent's blind build sheet (4.5–6.9k chars) → `generate_composition` | 6–8 min | ~40k out per composition |
| 2 · Claude Code, same sheet | executes the identical sheet, looks at stills, fixes | 11–25 min, 3 rounds | 120–145k |
| 3 · Claude Code, free design | idea + skills only, designs while looking | 27–40 min, 5–7 rounds | 170–210k |

**Findings that drive this doc:**
1. **Column 1 ≈ column 2.** From a precise sheet, the one-shot generator executes well. The
   gap is polish, not kind.
2. **Column 3 is a different class of picture** in all four briefs, from the same model,
   skills and request. Numbers are drawn as countable things at true scale (1,024 painted
   cells against 20 cuts; 34 coins against 100.6). Actors' faces carry the state. The cause is
   shown, and payoffs are held long. Every design improvement in the round logs came from
   looking at a still, not from the code.
3. **Errors pass straight through column 1.** "100,000× faster" should be 1,000×. B2's
   crossover is impossible under its own formulas. B3's antibody keys cannot reach their
   notch. Labels collide. The column 2 and 3 builders caught all of these by running the
   numbers and looking.
4. **Fonts fall back without warning.** Every font the agent named fell back. Only one looked
   right, because it happened to be installed on the PC.
5. **Loop seams.** Two of four column-1 loops jump at the wrap (measured by pixel diff). The
   builders fixed theirs.
6. **No texture.** The chalk style came out as vector lines. The builder used
   `@remotion/noise` plus SVG filters, tuned by eye.
7. **TSX Creator Prompt mode:**
   - There is no 4:5 preset.
   - The default model is `claude-sonnet-4-6` and thinking is off.
   - From a plain prompt it made a rich picture with ~10 px text, and frame 0 showed the
     pre-payoff state.
8. **The agent narrated results it never saw** ("the teal overtakes the yellow around year 22").

**Conclusion.** Adding eyes to the one-shot generator would move column 1 toward column 2.
Only a builder loop reaches column 3.

---

## 2. Verified facts (2026-10-10)

### 2.1 The pipeline today [verified]
- **Entry point.** `generateTsxPipeline(options, deps = rendererDeps)` is at
  `src/shared/tsx-engine/tsx-generation-service.ts:259`. `TsxEngineDeps` has exactly two
  members, `llmGenerate` and `tsxValidate` (`:34-37`). Every caller passes main-process
  deps; `rendererDeps` is unused.
- **Steps:**
  1. PLAN if `optimize` (`:292-321`), otherwise CLASSIFY with thinking off (`:322-348`).
  2. GENERATE (`:350-390`).
  3. VERIFY: one LLM call that re-emits the file (`:392-418`).
  4. Transpile + gate, then a FIX loop, `maxFixRetries ?? 3` (`:197-257, :268`).
- **Defaults.** Thinking defaults to off (`:95`). `maxTurns` maps to "reflection loops",
  not SDK turns (`:104`). `editTsxPipeline` is the edit sibling (with chat history).
- **System prompt.** `prompt-builder.ts` → `prompts/generate-2d-prompt.ts`
  (`TSX_CRAFT_RULES` `:273`, `extraInstructions` `:275-276`).

### 2.2 Callers [verified]

| Caller | Process | Gate | Output |
|---|---|---|---|
| TSX Creator Prompt mode: `useMotionGenerator` → `tsxJobStart` → `tsx-job-engine.ts:248-275` | main (job engine) | **esbuild transform only, no import lint** (`:273`) | `userData/projects/<name>/vN.tsx` + `vN.debug.json` + `chat.json` |
| Studio shots: `shotGenerator.generate` (`shot-generator.ts:334-370`) | main | transpile + `lintShotSource` + config parse (`:117-131`) | `<project>/shots/<id>/vN.tsx` + debug + chat |
| Studio assistant `generate_tsx_shot` (`studio/agent-tools/shot-tools.ts:25-110`) | main | same as shots | same as shots |
| `shot-conform.ts:131`, `shot-import.ts:312` | main | uses `editTsxPipeline` | shot `vN.tsx` |
| Agents `generate_composition` / `edit_composition`, also flow nodes (`generate-composition.ts:174-189`) | main | `validateAgentCompositionCode` (`agents/tsx-deps.ts:23-36`) | `<session>/work/compositions/<slug>.tsx`; no debug sidecar |
| Agent mode → Motion sink (`motion-project-sink.ts:55-87`) | main | — | mirrors to a Motion project `vN.tsx` |

### 2.3 Eyes that already exist [verified]
- **Refine.** `refine()` (`shot-generator.ts:478-590`) → `renderShotStills(…, 3)` →
  `editTsxPipeline` with `images`. Q5 measured about 110 s per round.
- **Stills.** `shot-stills.ts`: `createExportEntry` → `bundleComposition` (webpack in a
  utility process, content-hash cache) → `selectComposition` → `renderStill`, JPEG q85.
- **Refine's gaps:**
  - no cancel signal (`studio-shot-handlers.ts:111-123`);
  - the stills may render a different version than the one being edited (`:89-91` vs
    `shot-generator.ts:479`);
  - one global `currentBundlePath` (`remotion-bundler.ts:48, 119, 159`), so concurrent
    bundles clash.
- **Images into the model.** An LLM request can carry images: `LlmGenerateRequest.images`
  becomes image blocks (`claude-provider.ts:100-113`).
- **Images from tools.** An agent tool can return images: `AgentToolResult.images` becomes
  MCP image blocks (`tool-server.ts:165-167`). `capture_page` already does this (1024 px,
  JPEG q80).

### 2.4 Agent runtime pieces a builder can reuse [verified]
- **Provider.** `claude-provider.ts` runs the Agent SDK with `tools: agentTools || []`,
  `settingSources: []`, and `maxTurns` 10 when tools are present. `mcpServers`, `cwd` and
  `canUseTool` pass through. Sessions are hot by `sessionScope` (idle 120 s, max 8). There
  is **no `resume` anywhere**.
- **Runner and tool server.** `agent-runner.ts` provides one run per session, cancel via
  AbortController, and an in-process MCP server (`tool-server.ts`, `createSdkMcpServer`, tool
  names `mcp__vidtsx__<id>`).
- **File guard.** `file-tool-guard.ts`: Read/Write/Edit/Glob/Grep are realpath-checked
  against the workspace. Everything else is denied, Bash included and always.
- **⚠ Possible hole, verify in P0.** The runner adds `sdkTools` to `allowedTools`
  (`agent-runner.ts:217`). Under SDK rules, allow-listed tools may skip `canUseTool`, which
  would bypass the guard.
- **Tool support.** `agent-sdk` providers can run tools: claude-subscription, claude-api,
  openrouter, minimax, zai, kimi. openai, gemini and local cannot (`agents/tool-support.ts:25-37`,
  `engine/presets.ts`).

### 2.5 Imports, preview, export [verified]
- **One import rule.** `lintShotSource` allows exactly `react`, `remotion` and `@vidtsx/kit`,
  and rejects any relative import (`shot-lint.ts:12, 57-60`). Every gate injects
  `validateAgentCompositionCode`, so changing the allowlist changes every gate: Studio,
  agents, templates D14, agent `assets/*.tsx`.
- **Drifting copies of the rule:**
  - `shot-import.ts:20-30` (`CONFORMABLE_MODULES`)
  - `shot-bundle.ts:21-25`
  - `generate-2d-prompt.ts:76-85`, which tells the model chroma-js and @remotion/* are fine;
    the agent gate then rejects them.
  - `shot-prompt.ts:186-190` / `brand-instructions.ts:25` ("no font packages")
  - the `generate_composition` tool description
- **Already installed at 4.0.435 (`package.json`):**
  - @remotion/google-fonts, paths, shapes, noise, transitions, media-utils, lottie, three
  - tone, three 0.183
  - chroma-js is a **devDependency**, so it likely fails in packaged builds
  - d3: transitive only
- **Preview.** It transpiles ONE file with `esbuild.transform` (`tsx-transpiler.ts:293-301`)
  and rewrites imports:
  - react/remotion → `/virtual/*`
  - kit → `/virtual/vidtsx-kit.js`
  - three/r3f/drei → `/vendor/*`
  - **every other package → `https://esm.sh/<pkg>@<pinned>`**, which needs the network
  - Relative imports 404. The caches key on the entry only.
- **Export.** `bundleComposition` (`remotion-bundler.ts:207`) writes a wrapper beside the file
  and runs `@remotion/bundler` (webpack). Bare imports resolve from node_modules, and
  relative siblings would resolve, but the cache keys on the entry's md5 only (`:216-220`).
  **`@vidtsx/kit` is unresolvable on this path** (no alias), so a kit import fails to render.
  Studio export copies single-file shots and pins the kit (`export-entry.ts:191+, 256-270`).

### 2.6 Fonts [verified]
- **Proxy.** `font-proxy.ts` serves `/fonts?u=` for Google hosts only, caches in
  `userData/font-cache`, and is mounted on both the module server and the bundle server.
- **Brand fonts.** They reach Studio preview (`useBrandFonts`, `<link>`s) and Studio export
  (`buildBrandFontLoaderSource`: `delayRender` + `document.fonts.load`, 8 s cap). The Motion
  preview and the Creator/agent render path get none of this.
- **`@remotion/google-fonts`.** It fetches directly from gstatic, bypassing the proxy and its
  cache.

### 2.7 UI and defaults [verified]
- **Creator presets.** Aspect is 16:9 / 9:16 / 1:1 only (`features/motion/types.ts:3,12-16`).
  FPS options are 25–240. Duration runs 3–60 s with Auto on by default.
- **Creator defaults.** Thinking defaults to off and Optimize (plan) to on
  (`useMotionGenerator.ts:25,33`).
- **Agent tab.** `vidtsx/tsx-composer` with `motionSink: true` (`useMotionAgent.ts:27,98`).
- **Default model.** `claude-sonnet-4-6` from `engine/presets.ts:9` / `claude-provider.ts:59`;
  a saved `llmProviders[].defaultModel` overrides it.

### 2.8 Safety [verified]
- No moderation runs on TSX or LLM text, by design. `llm-hook-absence.test.ts` forbids it.
- Image generation and captures are gated (prompt blocklist plus an NSFW classifier, failing
  closed). The builder must route any image it needs through the existing gated tools.

---

## 3. Architecture: three layers

| Layer | What it is | Who uses it |
|---|---|---|
| **Builder** | the craft: designs, writes files, renders, looks, fixes, within a budget | every caller |
| **Craft packs** | know-how the builder loads: the infographic method, styles, a domain's rules | the Creator (picked by the user), agents (picked for them), flows (node config) |
| **Agents** | a process, approval gates, other tools (images, voice, captions, render, flows), multiple pieces | the Agents section, flows |

"The builder is the animator; the agent is the art director."
- **TSX Creator:** one box that talks straight to the builder. The first message builds;
  later messages edit.
- **Agents:** pass **intent** (idea, chosen picture, audience, style, what frame 0 must
  show, the pack ids), never pixel boxes.
- **Fallback:** ~~providers without tool use keep today's one-shot pipeline.~~ Rev 2: none.
  The builder is the only generator; a provider without tools gets a clear error.

---

## 4. Decisions

### T1 — What the builder is
Options:
- (a) Extend `generateTsxPipeline` with an "eyes" round.
- (b) **A new main-process service, `tsx-builder`, that runs one Agent SDK session** with an
  in-process MCP tool server, file tools scoped to a build folder, a builder system prompt and
  a budget.

**Recommendation: (b).** (a) reaches column 2 at best (§1). (b) reuses the runner, tool
server and file guard (§2.4).
- **Single entry point:** `buildComposition(request) → BuildResult`. The request carries:
  - `intent`, format, fps, duration (or "builder decides")
  - brand, craft packs, reference images/video
  - `editOf` (an existing build to change) and `budget`
  - provider/model, `signal`, `onProgress`
- **The result** carries the bundled code (§T3), the source folder, versions, the stills
  taken, rounds, usage and a short summary.
- **One dispatcher, `generateTsx()`,** picks the builder when the provider can run tools,
  and otherwise falls back to `generateTsxPipeline`.

### T2 — The builder's tools (MCP, in-process; never a shell)

| Tool | Does | Notes |
|---|---|---|
| Read / Write / Edit / Glob / Grep | the SDK's own tools, guarded to the build folder | reuse `file-tool-guard`; fix the allowedTools hole (§2.4) first |
| `check` | bundle (§T3) + import gate + config parse + a frame-0 smoke render; returns errors verbatim | the builder's "compile" |
| `render_stills { frames[], scale? }` | renders frames and returns them as images (≤1024 px) | reuse the `shot-stills` machinery; per-build bundle path (fix the global `currentBundlePath`) |
| `contact_sheet { frames[] }` | one image: N frames in a grid (a wrapper composition of `<Freeze>` copies, one `renderStill`) | the random-frame test; cheaper than N stills |
| `phone_view { frame }` | renders at the phone display size | the legibility check |
| `loop_seam` | pixel diff of last frame → frame 0 against neighbouring frames; returns numbers | `nativeImage.toBitmap()`; no new dependency |
| `finish { summary }` | final check, bundle, save a version, end the run | the only way to end successfully |
| (later) `text_overlaps` | measures text boxes against drawn shapes in a probe render | P5 |

Reference images arrive as image blocks on the first turn. Any image the builder needs to
*generate* goes through the existing gated `generate_image` (only when the caller allows paid
tools).

### T3 — Multi-file source, single-file artifact
Options:
- (a) Teach preview, export, Studio shots, templates and agents to load folders.
- (b) **Keep a source folder for the builder and bundle it into ONE file at save** (esbuild
  `build({ bundle: true })`), with the same externals the import rewriter uses.

**Recommendation: (b).** Every consumer stays single-file, and the D14 and agent gates run on
the bundle.
- **Storage:** `vN.tsx` (the bundle, which every consumer uses), plus `vN.src/` (the
  builder's files), plus `vN.debug.json` (rounds, stills, usage).
- **Edits** copy the latest `vN.src/` into a working folder and continue.
- **[spike] The bundle must still satisfy `lintShotSource`'s `export default` and
  `export const compositionConfig =` literal rules.** Plan: the entry's literal config is
  copied verbatim into the bundle head. P0 proves it.

### T4 Rev 2 — No library limits (DECIDED 2026-10-12, option A; replaces the tiers below)

Hasan: "I want to add to the builder everything needed to build any complex 3d and 2d and
physics and so on. I dont want limitation due to libraries."

**Why it is a bundle-step question [verified 10-12].** The builder's artifact is ONE file with
everything inlined except react, remotion and @vidtsx/kit (`shot-bundle.ts:21-25`,
`EXTERNAL` / `INLINE_ALLOWED`). So any pure-JS package works in every consumer once it is
(1) installed in the app and (2) allowed by the bundle step. Today `INLINE_ALLOWED` is
lucide-react, chroma-js and `@remotion/*` only: three.js is installed but blocked ("Package
"three" is not available").

**Installed already [verified 10-12, `package.json`]:** three 0.183.2, @react-three/fiber 9.5.0,
@react-three/drei 10.7.7, @remotion/three, @remotion/lottie, @remotion/gif,
@remotion/animated-emoji, @remotion/noise, paths, shapes, transitions, google-fonts,
media-utils, chroma-js, lucide-react, tone. **Missing:** every physics engine, d3,
postprocessing, katex, a code highlighter, roughjs, opentype.js, map data, @remotion/
layout-utils / motion-blur / light-leaks.

**The set (option A; adding one later = one line + `npm install` + a release):**

| Area | Packages |
|---|---|
| 3D | three, @react-three/fiber, @react-three/drei (minus helpers that fetch from CDNs), @react-three/postprocessing + postprocessing, @remotion/three |
| Physics | @dimforge/rapier3d-compat + rapier2d-compat (WASM inlined, deterministic), cannon-es, matter-js, planck |
| 2D, vector, texture | d3 modules (scale, shape, force, geo, hierarchy…), roughjs (hand-drawn / chalk, the R0 gap), simplex-noise, opentype.js (text as paths), all @remotion/* incl. layout-utils, motion-blur, light-leaks |
| Data, maps, text | topojson-client + world-atlas (offline maps), katex (math), prism-react-renderer (code) |
| Formats, color, icons | @remotion/lottie + lottie, @remotion/gif, chroma-js / culori, lucide-react |
| Banned by rule | gsap, framer-motion, CSS animations, timers: time-based, not frame-pure |

Exact versions pinned at install; the final list is checked against licences
(THIRD_PARTY_NOTICES) and installer size when P2 starts.

**One constant** (in `src/shared/`) is the list: the bundle step's `INLINE_ALLOWED`, the
builder prompt's package catalogue ("use X for Y"), the packaging config and the tests all
read it. The drifting copies of §2.5 go.

**What else "no limits" needs (all P2):**
1. **GPU rendering.** The default GL backend is `swangle` (software, `settings.ts:113`):
   complex 3D is slow. Builder stills and export use ANGLE on the GPU (the lab's recipe:
   `--use-angle=d3d11 --ignore-gpu-blocklist` reached RTX at 60 fps headless), with software
   as the fallback on weak machines.
2. **Frame-pure physics.** Remotion renders frames out of order and in parallel. A simulation
   steps at a fixed dt from frame 0, memoised per composition; a small helper plus a prompt
   rule, or every physics piece jitters.
3. **Assets.** `check` refuses `staticFile()` today ("not available to the builder yet"). 3D
   needs GLB models, textures, HDRIs; 2D needs images. The builder gets an assets folder (the
   user's library, generated images through the gated tools, its own files) that travels with
   the version.
4. **Packaged app.** esbuild cannot read inside `app.asar` (P0): `asarUnpack` the set, or an
   esbuild onLoad plugin that reads through Electron's fs.
5. **No network at render.** Helpers that fetch at render time (drei's `Environment` presets
   download HDRs from a CDN) are vendored or banned; fonts per T5.
6. **Craft.** The builder prompt gets the catalogue; 3D and physics craft knowledge comes from
   the lab: `remotion-three-asset-loading` (continueRender after R3F advance(), DoF before
   N8AO, no MSAA) and the real3d-lab pieces as the quality bar.

**P2 exit:** new briefs that need 3D and physics (plus the four 2D briefs, unchanged) reach the
lab's real3d quality, in the dev app and in a packaged build, offline after the first run.

### T4 — Import tier 1 (no new dependencies) — SUPERSEDED by T4 Rev 2
- **Tier 1** is what is already installed at 4.0.435: `@remotion/paths`, `@remotion/shapes`,
  `@remotion/noise`, `@remotion/transitions`, `@remotion/media-utils`, plus the font route of
  §T5.
- **Tier 2** later: three/R3F (already vendored for 3D mode), d3 modules (needs real
  dependencies), lottie.
- **One allowlist constant in `src/shared/`.** The gate, the bundle externals, `shot-bundle`,
  `shot-import`, the generation prompts and the tool descriptions all read it. Delete the
  copies listed in §2.5.
- **Preview offline:** vendor tier 1 in `scripts/build-vendor.mjs` / `LOCAL_VENDOR_PACKAGES`
  instead of esm.sh (the app is local-first).
- **Fix while there:** move chroma-js to dependencies or drop it, resolve `@vidtsx/kit` on the
  Creator/agent render path, and add the import lint to Creator Prompt mode.

### T5 — Fonts
Options:
- (a) Allow `@remotion/google-fonts/<Family>`. Familiar to the model, but it bypasses the
  proxy and its cache.
- (b) **Generated compositions declare `compositionConfig.fonts: ['Poppins:600,800', …]`**,
  and the app loads them through the brand-font pipeline (proxy + cache + `delayRender`
  loader) in the Motion preview, the Creator/agent render path and Studio export.

**Recommendation: (b).** One font path for brand and generated fonts, cached, and working
offline after the first use. The builder prompt teaches the field. `check` warns when a
`fontFamily` is used that isn't declared.

### T6 — Budget and loop policy
- **Budgets:**
  - **Quick:** one build, one look.
  - **Standard:** up to 3 look rounds.
  - **Craft:** up to 6 rounds, the column-3 setting.
- **Hard caps** on SDK turns, wall-clock time and tokens. On a cap, the run ends with the
  last version that passed `check`, never with nothing.
- **Builder system prompt** (the house build skill): design → build → `check` → look →
  improve design *and* fix bugs. Verify every number and ratio, the phone view, the loop seam
  and the random-frame test. Only Craft offers three picture ideas before building (inside the
  run, no user gate).
- **Thinking** on (medium) for the builder.
- **Expected cost [measured]:** Craft ≈ 30–40 min and 170–210k tokens per piece. The UI must
  show elapsed time, rounds and tokens; on an API key, show the estimated cost before
  starting.

### T7 — Callers
- **TSX Creator:**
  - Merge the Prompt and Agent tabs into one composer: the first message builds, later
    messages edit the same build. Templates stays as its own tab.
  - Add **4:5 (1080 × 1350)**, a budget picker and a craft-pack picker.
  - Live progress shows the builder's stills as it takes them.
  - **The `vidtsx/tsx-composer` agent is retired from the Creator.** Its job (writing a good
    brief for a blind generator) no longer exists.
- **Agents:**
  - `generate_composition` / `edit_composition` keep their ids (append-only, §11); the handler
    switches to the builder.
  - The tool description becomes "describe what and why; the builder designs".
  - New optional args: `budget` and `packs`. An agent's own `skills/` can be marked as
    builder packs (T8).
- **Studio shots and the Studio assistant:** `generate_tsx_shot` goes through the builder
  (Standard). Refine becomes "another look round" on the same build. conform/import stay on
  `editTsxPipeline` for now.
- **Flows:** the TSX node config gets `budget` + `packs`.
- **Hosting:** builder runs are **tsx-jobs**, so every caller gets the queue, cancel, progress
  and persistence the Creator already has.

### T8 — Craft packs
- **Format:** a content pack under the existing convention (`PACKS_DESIGN.md`, `pack.json`),
  kind `craft`, holding one or more `SKILL.md` files (same format as `docs/SKILLS.md`).
  Sellable later as content, like the other pack kinds.
- **Built-in first packs:** Infographic loop (the form), Concept to picture, and Styles
  (Blueprint, Flat bold, Neon dark, Editorial, Custom-style guidance). They are lifted from
  the experiment's agent.
- **How they reach the builder:** pack bodies are composed into the builder's system prompt,
  fixed for the run so the prompt cache survives. An agent package can mark its own skills
  `"builder": true` in the manifest so they travel with its calls.

### T9 — Small fixes that ship regardless (1.1.x candidates)
1. Add the 4:5 preset to the Creator.
2. Change the subscription default model from `claude-sonnet-4-6` to a current one. Migrate
   saved `defaultModel` only where it equals the old preset value.
3. Make the generation prompt's import list match the gate (until T4 lands, stop promising
   packages the gate rejects).
4. Add the import lint to Creator Prompt mode.
5. Move chroma-js out of devDependencies (or drop it).
6. Give Refine a cancel signal and use the right version for stills.
7. Verify and close the `allowedTools` / `canUseTool` hole (security).

---

## 5. Build order

> **P0 DONE 2026-10-10 — exit met on B2** (details: `ai-video-lab/experiments/studio-unlock-01/FINDINGS-P0.md`;
> code `src/main/services/tsx-builder/`, dev-only entry `VIDTSX_TSX_BUILDER_SPIKE=<request.json>`):
> - Machinery: multi-file → one file via Import TSX's bundle step passes every gate (T3 spike ✔);
>   in-app stills pixel-identical to R0b; no shell; file tools guarded and NOT allow-listed.
> - Stills on this PC: first bundle 54 s, later 16–25 s, a look round ~15–50 s. Laptop not measured.
> - Quality: run 1 stopped at 3/6 rounds with a clean chart (column 2). Run 2, after adding the
>   art-director questions to the prompt and refusing `finish` before round 4 on Craft, reached
>   column 3's class: coins at true scale coloured by origin, the cause drawn, ghost slots — 7.7 min,
>   6 rounds, 32.6k output tokens, $2.23 API-equivalent. Wall `P0-B2` on :3920.
> - **T5 to re-decide:** a bundled `@remotion/google-fonts` import already goes through the font proxy
>   + cache on the render path (Poppins woff2s landed in `font-cache`). Check the preview path first.
> - **New P2 risk:** esbuild cannot read inside `app.asar`, so the bundle step's package resolution
>   needs an Electron-fs onLoad plugin (or unpacked tier-1 packages) in the installed app.

> **P1 DONE 2026-10-12 — exit met** (branch `tsx-builder-p0`, unpushed; details:
> `ai-video-lab/experiments/studio-unlock-01/FINDINGS-P1.md`, per part: `NEXT-SESSION-PROMPT.md`).
> - Exit through a `build` job on the app's job engine, Craft on Opus 5.5: B1 7.3 min 4/6 rounds $1.77 ·
>   B2 8.6 min 6/6 $2.42 · B3 7.0 min 5/6 $2.12 · B4 8.6 min 5/6 $1.55 (API-eq); the Standard edit of B2
>   through `editOf` (8% → 6%) 3.1 min 3/3 $0.79, v2 beside an untouched v1. All `finished`, all
>   `seamOk`, 0 finish refusals, 0 failed checks in 45. Wall `P1-B1..B4` + `P1-B2-edit` on :3920.
> - Quality: every number right in all five; column 3's class on B4 only. B1–B3 are strong charts
>   with an actor: the design PICK, not the round count, is the gap (the "numbers as ink" metaphor
>   was a chart in B2 and B3). **Ink line `8ac3261`** (ink = countable marks at true scale; a labelled
>   line/area/bar is a chart and needs a reason): B2 and B3 re-run in column 3's class (coins at one
>   scale with sleeping/working faces, $1.99; antibody Ys per day, $1.66). Walls `P1-B2-ink`, `P1-B3-ink`.
> - Looks are 19–29 % of a Craft run; narration is 2–5 chunks a run, so P3's progress UI reads the
>   snapshot. Open: leftover `work/` per saved run, bundle-cache never pruned (~54 MB a run).
>
> Parts:
> 1 types + build store + edits `503fd3a` · 2 caps, cancel, progress `f4c6602` · 3 per-build bundle
> serving `048e3e5` · 4 contact_sheet / phone_view / loop_seam `5b71a37` · 4b finish gate (phone view +
> loop seam on the finished build) `e43b38b` · 5 `generateTsx()` dispatcher + pipeline fallback
> `97c9e4a` (+ `34b55d9` dev entry: BYOK preset key from env; OpenRouter GPT passed) · 6 tsx-job
> kind `build` (builder only: a provider without tools is refused, an OpenRouter model without tool
> use or image input is refused before the run from its public model list; snapshot carries phase,
> rounds, checks, tokens, latest stills; builds run one at a time) `2a8a166` ·
> 7 dev entry through the job engine `275ca59` + the exit above · ink line `8ac3261`.

> **P2 in progress** (one part at a time with Hasan's go): 1 library set · 2 3D (GPU stills) ·
> 3 frame-pure physics · 4 builder assets · 5 packaged app + offline · 6 exit (B1–B7).
> D1 decided 10-12: **inline everything** (option A), so every consumer takes 3D unchanged.
> Measured 10-12: builder stills with no `gl` render WebGL on SwiftShader (CPU); `gl: 'angle'` gets the
> GPU (RTX A3000, D3D11).
> - **Part 1 DONE `447e7cd`**: the set installed exact (~96 MB in node_modules; licences MIT / ISC /
>   Zlib / Apache-2.0, light-leaks Remotion License), `shared/tsx-engine/builder-libraries.ts` = the one
>   list (bundle allowlist + prompt catalogue + banned clock-driven packages). Two bundle fixes the probe
>   found: CommonJS `require('react')` (use-sync-external-store under R3F, react-dom under
>   @remotion/shapes — a latent bug, shapes was allowed before) now served from the shared react;
>   `process.env.NODE_ENV` defined as production. Free probe (spike mode `libraries`, 10 sources): 10/10,
>   every area renders through the builder's stills. Not minified: the finisher needs esbuild's plain
>   output, so files are 0.1–0.6 MB for 2D/data, 2.3 MB for three + drei + postprocessing, 4.2 MB with
>   Rapier's inlined WASM. 3D stills on SwiftShader: 13 s for 2 frames with N8AO + Bloom.
>   Deferred to part 4: opentype.js, lottie-web, @remotion/gif (need asset files).
> - **Part 2 DONE `9bb3452` + `916f4c6`**: GPU stills. `gl-backend-probe.ts` opens Remotion's browser on
>   `angle` once per app run and reads WebGL's renderer (no bundle, ~3 s): a GPU → `angle`, SwiftShader /
>   WARP / no WebGL → `swangle`. Every builder look renders on it. The prompt has a "## 3D" block (ThreeCanvas,
>   frame-driven, fixed Canvas `camera` prop: R3F 9.5 rebuilds the camera without its lookAt when it changes,
>   so stills and exports disagree; DoF → N8AO → Bloom → SMAA, multisampling 0; nothing that loads a file).
>   Measured (spike mode `gl`): stills 2.1–2.8× faster on 3D; 120-frame exports 13× (heavy 3D, 31 s vs
>   7.0 min) and 9× (SVG-filter 2D); backends match to the eye, each repeats itself exactly. **Export default
>   = `auto`** (Hasan's option c): the probed backend unless the user picks one. 3D Quick smoke (Sonnet 5.5):
>   finished, 3.2 min, $0.74 API-eq, seamOk, every look on `angle`, followed the camera rule.
> - **Part 3 DONE**: frame-pure physics. **`@vidtsx/sim`** (`shared/tsx-engine/vidtsx-sim.ts`, a `builtIn` entry of
>   the one list): `useSimulation({ id, setup, step, read, substeps, seed, deps, init })` builds the world once per
>   page, steps it at a fixed dt from frame 0 and keeps a COPY of every frame's read-out, so frame N+1 is one step
>   and any earlier frame a lookup; it never rewinds (cannon / matter / planck cannot restore a snapshot exactly);
>   `init` (Rapier) holds the frame through delayRender; seeded `random`. The bundle step inlines its source,
>   embedded in main through Vite `?raw`: nothing on disk, so the packaged app needs nothing for it. Prompt
>   "## Physics" after "## 3D" + engine lines in the catalogue. New free look **`purity_check`**: sample frames
>   rendered IN ORDER in one page (renderFrames, concurrency 1) and ALONE in fresh pages (last first), 540 px,
>   compared (`frame-purity.ts`; a visible pixel change or mean ≥ 0.01 = IMPURE). **Gate (Hasan's pick):** on a
>   piece whose check inlined a physics engine, `finish` is refused until purity_check measured that exact build
>   and said PURE; 3 IMPURE builds let it through as `pureOk: false`. Free probe (spike mode `purity`): the part 1
>   probes on the helper + a 16-body Rapier 3D pile in R3F + the rebuild-per-frame control = exactly 0; a world
>   stepped per render and a Math.random setup caught at mean 3.7–6.1. A check costs ~0.08 s/frame up to the last
>   sample + ~1 s per fresh still (~21 s for 150 frames, cold bundle included). Physics Quick smoke (Sonnet 5.5):
>   finished, 2.1 min, $0.62 API-eq, `pureOk: true`; finish refused once live (purity measured an earlier build),
>   then passed. It showed one gap, fixed in the prompt after: `step` runs per substep, so a one-off keys on
>   `substep === 0`.
> - **Part 4 DONE**: builder assets. **Sources (Hasan's pick 10-13: "c")**: the builder's own files, the user's asset
>   library and generated images. The build's work folder has an **`assets/` folder**; `staticFile('robot.glb')` names a
>   path inside it. `check` resolves every literal staticFile (the bundle step already turns them into lookups in the
>   `assets` prop) against assets/: a missing name (with the folder listed and an "assets/" prefix hint), a kind the
>   renderer does not serve, two names that share a lookup key (logo.png / logo.svg), a computed name, a Draco or KTX2
>   model (decoders download at render) and a .gltf whose .bin or textures are not beside it all fail `check`.
>   **Serving**: a new route `/asset-root/<token>/<path>` on both local servers (`asset-roots.ts`) serves only folders
>   the app registered, by path, so a loader that picks its parser by extension works and a .gltf finds its neighbours.
>   Not `/asset?path=`: the module server answers every origin, and widening that route's list to .json / fonts / .hdr
>   would let any web page read those files anywhere on the disk. **Looks**: every look (stills, sheet, phone, seam,
>   purity) renders with `inputProps.assets` = key → URL on the bundle server; the contact sheet passes props to its
>   tiles. **Saved** as `vN.assets/` beside `vN.src/` (never inside it); a file the previous version had byte for byte
>   is a hard link (saved versions are never written again); a stale `vN.assets/` from a deleted version is cleared;
>   an edit is seeded with COPIES. **Played and exported** (`version-assets.ts`): a name is looked up in the version's
>   own `vN.assets/`, then in earlier versions' folders, newest first (a Creator Save / Apply / Fix writes vN+1 with
>   the same code and no folder). Hooked: Creator preview (the transpile IPC returns `assets`, MotionPreviewPanel and
>   the Files screen merge it into inputProps), Creator Render (`render-handlers.ts`, computed per render so a queued
>   job never carries a dead port), flows / agent renders (`media/remotion-render.ts`), Studio import (the fast path
>   registers images / video / audio from vN.assets as project media and keys them; models, HDRIs, fonts and data are
>   named in the import report as not loadable in a shot yet — Studio media kinds are video / audio / image).
>   **Request**: `assets: [{ path | 'library:<path>', name? }]` copied in before the session (an edit's files first; a
>   clash is an error); the first message lists assets/ and says whether generate_image is available. **Tools**:
>   `library_search` + `library_use` (free; a .gltf brings its files), `generate_image` (PAID: the active image
>   provider, filed into the library's generated/ like Studio's tool, copied into assets/; capped per run, default
>   quick 2 / standard 4 / craft 6, request `maxGeneratedImages`; each image's catalog price is logged and the result,
>   debug and job snapshot carry `images { count, costUsd }`). **Built-ins** (inlined like `@vidtsx/sim`):
>   `@vidtsx/assets` (`useLoaded`, `useJson`, `useText`, `useArrayBuffer`, `useImage`: one load per page, the frame held
>   until the commit that shows the file) and `@vidtsx/three-assets` (`useModel` → this component's own copy of the
>   scene, meshopt decoded offline; `useModelAnimation(model, clip, frame / fps)` sets the mixer's time, never a delta;
>   `<FileEnvironment>` / `useEnvironmentMap` for .hdr / .exr; `useImageTexture`; each holds the frame until R3F has
>   DRAWN the file: commit → one task → `advance()` → continueRender, the lab recipe). Libraries deferred from part 1:
>   `lottie-web` 5.13.0 (the peer @remotion/lottie lacked), `opentype.js` 2.0.0, `@remotion/fonts` 4.0.435 (a font
>   FILE); catalogue area "Files". Prompt: "## Files" block; the 3D block's "nothing that loads a file" became the
>   loading rules. The import lint no longer reads `require("fs")` inside a string as an import (opentype.js has one in
>   a deprecation message). **Free probe** (spike mode `assets`, 6 sources, 4.1 min): a meshopt GLB (CC0 Khronos
>   Avocado) + Poly Haven HDRI + wood texture + PNG logo on a turntable loop; a generated GLB with a clip, two copies;
>   PNG + GIF + Lottie + font file + opentype paths + CSV in 2D; a missing name and a Draco GLB (both refused by
>   `check` with the right message); drei's `useGLTF` on a local file (observed). **6/6**: every look renders the
>   files, seam OK, purity exactly 0 on all four rendered pieces, each saved version's files fetched from the module
>   server byte for byte, two 30-frame exports through the flows path. The probe's first run found two bugs in the
>   helpers, both fixed: `useModel` returned a new object per render (a piece's `useMemo([model])` re-measured an
>   already scaled model each frame and shrank it: IMPURE 18-24); and a file that arrived between a component's render
>   and its effect never re-rendered it (a 4- and 5-tile contact sheet hung on its last tiles). **Observed**: drei's
>   `useGLTF` on a local file is correct in this stack (R3F 9.5 + @remotion/three 4.0.435: stills, sheet, PURE), so the
>   lab's "never drei loaders" rule (R3F 8) is out of date; the prompt now prefers the helpers and forbids only what
>   downloads (`<Environment preset>`, Text / Text3D) or runs on a clock (`useAnimations`). **Disk**: the webpack
>   cache (`node_modules/.cache`) grew ~3 GB per probe run (to 4.9 GB; D: hit 0 once mid-run). Nothing prunes it;
>   where a packaged app's copy lives and how big it gets is a part 5 question.
>   Assets Quick smoke (Sonnet 5.5, the Avocado GLB attached through the request, "product turntable" loop
>   1080x1350x120): finished, 1.5 min, 1 round, 4 checks, 6 API turns, 5.1k output tokens, $0.74 API-eq, seamOk.
>   It used `useModel`, measured the model with Box3 and seated it on the pedestal (the prompt's rule), and fixed the
>   fruit overlapping the headline after its look (confirmed on the phone view only: the one round was spent).
>   `v1.assets/avocado.glb` saved beside `v1.src/`.

Each phase ends by re-running the `studio-unlock-01` briefs (B1–B4) through the new entry
point and putting the result on the wall beside R0b column 3, with time, rounds and tokens.

| Phase | Scope | Exit |
|---|---|---|
| **P0 spike** (no UI, dev-only IPC or script, behind flag `tsx-builder`) | builder session in main: guarded file tools + `check` + `render_stills` + `finish`; budget Craft; brief B2 | B2 reaches column-3 class from inside the app process, on Windows, with no shell. Also answered: the allowedTools hole; bundle passes the gates (T3); font route works in the isolated `/preview` page; stills time per round on the 1650 Ti laptop |
| **P1 builder service** | request/result types, build folders + versions (`vN.tsx`, `vN.src/`, debug), all T2 tools except `text_overlaps`, budgets + caps, cancel, progress events, the `generateTsx()` dispatcher, tsx-job hosting (builder only; providers without tools → clear error; OpenRouter models must have tools + image input), unit tests | all four briefs through the job engine at Craft on the wall (`P1-B1..B4`) + one Standard edit of B2 |
| **P2 no limits** (Rev 2) | T4 Rev 2: the curated library set behind one constant, GPU stills + export, frame-pure physics helper + rule, builder assets folder, packaged-app resolution (asar), no network at render; plus T5 fonts, kit on the render path, prompts aligned | new 3D + physics briefs reach the lab's real3d quality; the four 2D briefs still pass; dev and packaged, offline after the first run |
| **P3 callers** | Creator merged composer (+4:5, budget, packs, live stills, 3D through the builder), then agents' generate/edit_composition, then Studio shots + assistant + Refine, then the flow node; **then `generateTsxPipeline` is deleted from generation** (Rev 2; conform/import repair passes decided then) | each entry point produces column-3 class on its brief; no caller reaches the one-shot pipeline |
| **P4 craft packs + agents** | pack kind `craft`, built-in packs, picker; Infographic Loop agent v0.2 as a thin director (intent + packs, no pixel sheets); tsx-composer retired from the Creator | a user picks Infographic loop + Blueprint in the Creator and gets the column-3 result without an agent |
| **P5 polish** | `text_overlaps`, cost estimate on API keys, AGENT_PACKAGE_SPEC tool semantics, TESTING.md, release notes | stability gate |

Rules: CLAUDE.md applies (feature isolation, IPC only, services hold logic, ~300 lines per
file, Remotion pinned to 4.0.435 with no `^`, `check:types` against the baseline, `npx vitest
run`). The T9 items can land independently and early.

---

## 6. Checklist — answer inline

> **Answered 2026-10-10 (Hasan: "ok, lets start", on Claude's recommendation for every item):**
> 1 yes · 2 yes · 3 yes · 4 yes (`compositionConfig.fonts` only) · 5 Standard for Creator and
> agents · 6 yes · 7 yes (in P3) · 8 yes · 9 later · 10 yes · 11 yes · 12 yes, T9 first ·
> 13 yes, B2 at Craft. The boxes below are left as written.
>
> **T9 progress (2026-10-10, branch `t9-small-fixes`):** ALL SEVEN DONE.
> 7 allowedTools hole fixed + verified against SDK 0.3.286 (committed `61eae5d`) · 1 4:5 preset ·
> 2 Claude presets default `claude-sonnet-5-5` + one-shot migration (OpenRouter's default left:
> no verified 5.5 id) · 3 prompt promises match the gate: `TsxPromptContext.imports`
> (`'open'` Creator, byte-identical to before; `'strict'` for Studio shots + agent
> compositions, which drops chroma/@remotion/tone from the prompt) · 4 Creator lint:
> `lintCreatorImports` in `tsx-engine/creator-imports.ts`, the single list
> `CREATOR_IMPORT_PACKAGES` (a test ties the prompts to it; `@vidtsx/kit` and relative imports
> rejected) wired into the job engine's validate · 5 chroma-js moved to `dependencies` (the
> shipped 1.1.0 asar did NOT contain it, so a Creator comp importing it rendered in preview and
> failed in the installed app) · 6 Refine/Edit cancel: `studio:shot:cancel`, run registry in
> `studio-shot-handlers.ts`, `canceled` job event, Cancel button in `ShotClipSection`; stills
> now render the version being edited (`renderShotStills(..., version)`).
> Not yet exercised in the live app: items 3-4 against a real model run, and 6's button.

1. **T1** Builder as a new SDK-session service with a dispatcher that falls back to the
   one-shot pipeline. ☐ yes ☐ change: ___
2. **T3** Multi-file source, bundled to a single `vN.tsx` at save, with `vN.src/` kept. ☐ yes ☐ change: ___
3. **T4** Tier 1 = the @remotion/* packages already installed, vendored for offline preview;
   tier 2 (three, d3, lottie) later. ☐ yes ☐ change: ___
4. **T5** Fonts declared in `compositionConfig.fonts` through the brand-font pipeline (not
   `@remotion/google-fonts` imports). ☐ yes ☐ allow both ☐ change: ___
5. **T6** Budgets Quick / Standard / Craft. Default for the Creator: ☐ Standard ☐ Craft ☐ ___.
   Default for agents: ☐ Standard ☐ ___
6. **T6** Show elapsed time, rounds and tokens during a run, and a cost estimate before
   starting on API keys. ☐ yes ☐ change: ___
7. **T7** Merge the Creator's Prompt and Agent tabs into one composer (build, then talk to
   edit); retire tsx-composer from the Creator. ☐ yes ☐ keep both ☐ change: ___
8. **T7** Show the builder's stills live to the user while it works. ☐ yes ☐ final only
9. **T7** Studio shots and the assistant go through the builder (Standard); Refine = one more
   look round. ☐ yes ☐ later
10. **T8** Craft packs as a content-pack kind (`pack.json`, sellable later). Agents can mark
    their skills as builder packs. ☐ yes ☐ change: ___
11. **T8** The first built-in packs are the Infographic loop + Concept to picture + the four
    styles from the experiment (not the paper look). ☐ yes ☐ change: ___
12. **T9** Ship the small fixes first as 1.1.1 (4:5, default model, prompt/gate alignment,
    Creator lint, chroma-js, Refine cancel, allowedTools hole). ☐ yes ☐ fold into the
    builder release
13. **P0** Spike on brief B2 (compound interest, Flat bold), Craft budget, measured against
    R0b F2. ☐ yes ☐ other brief: ___

---

## 7. Still missing / risks

- **Time.** Craft is 30–40 min per piece on this PC. It may be slower on the 1650 Ti
  laptop, because stills render through webpack bundling. P0 measures it. Mitigations:
  per-build bundle reuse between rounds (rebundle only on change), contact sheets instead of
  many stills, Quick and Standard budgets.
- **Cost on API keys.** About 200k tokens for a Craft piece. That is fine on the
  subscription and real money on Anthropic or OpenRouter keys, so the estimate must come
  before the run.
- **Bundle cache keys.** Today the preview transpile cache and the export bundle cache key on
  the entry file only. Multi-file sources need keys over every file (or the bundled artifact
  only, per T3).
- **Concurrency.** The global `currentBundlePath` must become per-build before two builds
  (or a build and a Refine) can run at once.
- **Session continuity.** There is no SDK `resume`. Edits in a later turn start a fresh
  session with the source folder plus `vN.debug.json`, which is enough because the files are
  the memory. Revisit if quality drops on long edit chains.
- **[Rev 2, 10-12] OpenRouter with a non-Claude model PASSED** (`openai/gpt-6.1-sol`, Quick smoke,
  finished with seam OK, ~$0.14). Other models through OpenRouter untested; a model without
  tools or image input must be refused before the run (P1 part 6). Original note:
- **Non-Claude tool providers** (openrouter, minimax, zai, kimi) are untested with image
  tool results. P1 checks openrouter at least.
- **Prompt-cache hygiene.** The builder's system prompt plus packs must be fixed for the run.
- **Tests.** Tool handlers (check, stills, seam), the dispatcher's fallback, budget caps,
  bundle-gate compatibility, and the guard (no write outside the build folder).
- **Docs to update when built:** `AGENT_PACKAGE_SPEC.md` (generate/edit_composition
  semantics, `budget`, `packs`, builder skills), `docs/SKILLS.md`, `PACKS_DESIGN.md` (kind
  `craft`), `TESTING.md`, STATUS.md.

---

## 8. Picking this up cold (next session)

1. Read, in order: this file; `ai-video-lab/experiments/studio-unlock-01/FINDINGS-R0.md` and
   `FINDINGS-R0b.md`; `CLAUDE.md`; `STATUS.md`; `CLAUDE_CODE_PARITY_AUDIT.md` (background
   only).
2. **Walk Hasan through §6 first.** He wants to understand before anything is built. No code
   until the checklist is answered.
3. Look at the wall (§1) to see the target: R0b column 3.
4. **Driving the dev app without touching his real profile.**
   - Launch with `--user-data-dir=<scratch>/vt-profile` after copying `settings/settings.db`
     and `Local State` from `%APPDATA%\VidTSX Studio`.
   - Use the launch recipe in `docs/ui-automation-cdp.md`: a script file,
     `ELECTRON_RUN_AS_NODE` unset, the occlusion flags.
   - The CDP driver used for R0 is in `ai-video-lab/experiments/studio-unlock-01/driver/`
     (`lib.mjs`, `starter.mjs`, `pick.mjs`, `approve.mjs`, `watch.mjs`, `collect.sh`).
5. Start with the T9 items if Hasan wants 1.1.1 first, otherwise P0.
