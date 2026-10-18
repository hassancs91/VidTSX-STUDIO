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

> **P2 DONE 10-13** (one part at a time with Hasan's go; parts 1-6 done; next = P3 on his go; still open, his calls:
> the network-off run of the packaged probe app, where Remotion's render Chrome downloads): 1 library set · 2 3D (GPU
> stills) · 3 frame-pure physics · 4 builder assets · 5 packaged app + offline · 6 exit (B1–B7).
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
> - **Part 4b DONE `8db5a87`** (found running the app on Hasan's ask): the Creator PREVIEW never played a 3D builder
>   piece (parts 2-4 checked stills and exports only). (1) "dispatcher.getOwner is not a function": the preview runtime
>   bundled React's development flavour (esbuild's default without minify) while a builder piece inlines R3F's
>   production reconciler, which swaps a production dispatcher into the shared React during a 3D render;
>   `build-vendor.mjs` now builds every vendor bundle in production (preview-runtime 1.48 → 0.96 MB), the same React as
>   the render path. (2) Preview quality Low / Medium scaled EVERY `gl.viewport` / `scissor`, render targets
>   included: no shadows, black HDR environments, broken post-processing in every 3D preview; only the canvas is scaled
>   now. Verified in the dev app at Low on six projects. Left: the Studio editor's player runs in the main window with
>   the app's own React (development under `npm run dev`), so a 3D builder shot there would still hit (1) in dev only.
> - **Part 5 DONE `7d706c9`**: packaged app + offline. **Hasan's calls (10-13):** webpack cache off everywhere;
>   bundle-cache = a builder run deletes its look bundles at its end + a start-up prune of folders unused for 7 days;
>   `check` refuses drei helpers that download at render; the network-off run "later" (his Wi-Fi is on Windows'
>   Public profile with the firewall off: a per-app block needs it turned on).
>   **Webpack cache** (measured on a 2.1 MB piece): Remotion's persistent cache keys on the entry path and every
>   builder entry is new (the wrapper is named by content hash), so it wrote **164 MB per piece that nothing read
>   back**; cold 5.1 s with it, 3.0 s without, an identical re-bundle 0.8 s. Packaged it sat in
>   `<install>/resources/.cache` (bundle() chdirs there; no package.json above), deleted by an update. Now
>   `enableCaching: false`. **bundle-cache** (`bundle-cache-prune.ts`; ~10-25 MB per bundle with its source map; 320 MB
>   in a real profile, never pruned): the bundler records every bundle made this run (`madeBundles`) — its map keeps
>   only the newest per entry path and a look re-bundles one entry per build, so the older folders leaked (found by the
>   packaged smoke: 1 left); `releaseBundlesUnder(runDir)` at the end of every builder run (free fixture
>   `releaseProbe`: 2 bundles of one entry made, 2 released, 0 left); a cache hit touches its folder; `main/index.ts`
>   prunes folders unused for 7 days at start-up, keeping every render-queue `bundleUrl` (queue unreadable → nothing
>   pruned; verified live on two planted 10-day-old folders).
>   **asar**: `check` bundles with esbuild, a native binary that reads only `app.asar.unpacked`; 1.1.0 unpacked only
>   the compositor, so an installed app's `check` could not resolve any library (read in the code, not run on 1.1.0).
>   `scripts/builder-unpack.mjs` walks the one list's closure (dependencies + optional + peer, minus react and
>   @types: 138 packages, 332 MB, 19k files, `remotion` included: @remotion/three imports `remotion/no-react`, which
>   the bundle step inlines — stateless, its state on shared `window.remotion_*` globals, so part 3's "remotion
>   inlined" note is harmless) into a generated asarUnpack block of `electron-builder.yml`, one
>   `**/node_modules/<name>/**` per package: electron-builder rebuilds the production tree and hoists differently
>   from npm's dev layout (d3's own d3-geo@3 lands at the top), so dev paths missed 4 packages. A vitest test runs
>   `--check`. **`afterPack: scripts/after-pack-check.cjs`** fails the build unless every name@version is unpacked and
>   every folder a package's `exports` points into survived. It caught electron-builder dropping every package's
>   top-level `examples/` — three's addons (GLTFLoader, HDRLoader, postprocessing passes), so n8ao and
>   `@vidtsx/three-assets` could not resolve in a packaged `check` → **`onNodeModuleFile:
>   scripts/node-module-file.cjs`** keeps `three/examples`. **Size:** installer 420.6 MB vs 1.1.0's 375.1 MB (+45 MB with
>   all of P2's libraries); app.asar 754 → 561 MB, app.asar.unpacked 507 → 817 MB, 160 → 16,004 files.
>   **Offline:** `build-offline.ts` (the piece's own files, not the libraries): Environment / useEnvironment `preset`,
>   clouds without `<Clouds texture>` (a bare `<Cloud>` makes a default `<Clouds>`), matcap / normal textures, Text
>   (troika's CDN font resolver), Text3D (suspends on its font), KTX2, face tracking → a check error with the local
>   way; prompt + catalogue say so. Google Fonts: both paths rewrite gstatic literals to the font proxy + cache (the
>   packaged preview filled `font-cache`), so **T5 stays as built** (fonts offline after their first use). **Not yet run
>   with the network off.** **Probe build:** `electron-vite build --mode probe` keeps the dev spike entry in a packaged
>   build (a release's MODE folds the gate to `!app.isPackaged`); output outside the repo (C:/vidtsx-probe), never
>   `dist/` (the shipped installer + latest.yml); NODE_OPTIONS 8 GB as CI (the renderer build runs out of heap).
>   **Packaged results** (throwaway profile, cwd outside any package, online): libraries 11/11 (+ a drei-network
>   source refused), purity 5/5, assets 6/6 (exports included), GL probe → angle in 0.8 s, no webpack cache anywhere,
>   the Creator preview played avocado-turntable (GLB, HDRI, shadow, Poppins). Quick smoke through the packaged app
>   (Sonnet 5.5, the avocado turntable with the GLB attached): finished, 63 s, 1 round, 4 checks, 6 API turns, 3.4k
>   output tokens, $0.48 API-eq, seamOk. **Found, not fixed (Hasan's call):** Remotion downloads its render Chrome
>   (chrome-headless-shell, 256 MB on disk) on the first render into `.remotion` under the PROCESS cwd: packaged, that
>   is wherever the app was started from (the install folder from the Start menu, so an update deletes it and the next
>   render downloads again). An offline first run cannot render at all.
> - **Part 6 DONE (the exit, 10-13; `ai-video-lab/experiments/studio-unlock-01/FINDINGS-P2.md`)**: B1–B4 unchanged + new
>   B5 GPS (3D loop), B6 Galton board (2D physics), B7 domino chain (3D + physics), each through a `build` job in the dev
>   app at Craft on Opus 5.5 with the three packs, no files attached; wall `P2-B1..B7` (Studio :3920). **7 of 7 finished,
>   72 checks / 0 failed, 0 finish refusals, seamOk on the five loops, B6 PURE first try; $16.62 API-eq, 59 min.**
>   Bundle-cache 0 → 0 folders on every run (part 5's release holds on 3D runs). Every look on `angle`. B1–B4 vs the P1
>   exit: 25.1 vs 31.5 min, $8.05 vs $7.86, looks 9–15 % of a run (was 19–29 %); quality equal or better (B2 drew F2's
>   coin piles; B4 chose roughjs). B5–B7: 8.6–13.6 min, $2.29–3.40, the time is the model writing (54–65k output tokens).
>   **Verdict on the exit**: 2D still pass; 3D + physics reach real3d's craft (directed light, contact shadows, DoF / AO,
>   frame-pure motion, a near-binomial Galton pile 107 vs 113) but not its materials: everything was painted in code
>   (empty library, no working image provider); files are the lever (part 4), not measured on a Craft brief. Packaged =
>   part 5's probes + smoke only; offline = the open network-off run. **Problems for P3** (none fixed here): (1)
>   `contact_sheet` on a 3D piece with post-processing loses a WebGL context at 12 tiles ("reading 'alpha'" of null);
>   (2) B6 changed its physics after its 6/6 look round and finished on phone_view + PURE only: `finish` does not ask for
>   a look at the final build's motion; (3) `generate_image` is offered when the active image provider cannot run
>   (sd-cli not installed: 4 calls, $0); (4) B7 animated the fall in closed form, no engine; (5) a chaotic sim runs
>   byte-identically on Remotion's headless 144 / 149 but differently on Chrome 154, so a physics piece's Creator preview
>   (Electron 41 = Chromium 146, untested) may differ from its export; (6) 3D pieces need production React wherever
>   they play (the wall's Studio needed React 19 production; the app's Studio editor player under `npm run dev` still).

> **P3 split agreed 2026-10-14** (Hasan: "Ok" on the split and on every recommendation below; one part at a time, his
> go on each). Parts: **1** builder fixes + caller plumbing (P2 problems 1-3; a build into a reserved empty folder; one
> main-side "start a build job and wait"; usage attribution per caller) · **2** Creator composer A: the first message
> builds (budget picker, loop toggle, Auto length = builder decides, progress panel with live stills, kind `build` in the
> library / auto-open / stream) · **3** Creator composer B: later messages and "Fix with AI" are builder edits, chat
> thread, Agent tab out, Optimize + Thinking out; P2 problem 5 measured · **4** agents' generate / edit_composition
> through build jobs (first: probe the Agent SDK's in-process tool timeout with a ~15 min call) · **5** Studio shots +
> assistant + Refine, 2D · **6** 3D in Studio (P2 problem 6, per-shot `vN.assets`) · **7** the flow node · **8** the
> pipeline deleted from generation · **9** exit.
> Decisions: **D1** `finish` refuses a build whose code changed after the last look (render_stills / contact_sheet)
> until one look of that exact build, allowed past the round cap · **D2** no pack picker in P3 (P4 builds it once, over
> real packs); P3's Creator exit types the style in words · **D3** composer: budget default Standard, Loop shown,
> Optimize + Thinking removed · **D4** the Agent tab leaves the Creator in part 3; tsx-composer stays an installed agent
> until P4 · **D5** agent output = `compositions/<slug>/vN.tsx` + the builder's sidecars, an edit = the next version in
> that folder · **D6** the agent tool result carries 2-3 final stills · **D7** builds stay one at a time app-wide in P3 ·
> **D8** 3D files in Studio shots through a per-shot `vN.assets` lookup (no new Studio media kinds) · **D9** an opt-in
> dev switch runs the renderer on production React for 3D shots under `npm run dev` · **D10** conform / Convert for
> Studio: verify the bundle step now inlines CONFORMABLE_MODULES without a model, drop those LLM passes, route what is
> left through a Quick builder edit · **D11** exit at each caller's default budget (Standard): Creator = B2 typed in the
> composer; agents = the lab's Infographic Loop v0.1 agent on B2 (R0's column-1 setup, builder behind the tool); Studio =
> a new cutaway brief; flow = explainer-30s; a miss gets one Craft re-run of that brief. P2 problem 4 (B7 no engine):
> nothing to fix. Problem 5: measured in part 3, any fix later.
> - **Part 1 DONE `ed551e0`** (builder fixes + caller plumbing). **contact_sheet on a WebGL piece** (check inlined a 3D
>   library, `isWebGlLibrary`): each frame renders alone in its own page at tile size, then `tileSheetSource` lays the
>   images out with the 2D sheet's grid and labels; the 2D sheet is unchanged. Free probe (`runs/P3/sheet3d-p1`): B7's
>   12-tile sheet OK tile by tile and still "reading 'alpha'" when mounted in one page; B5 OK; B4 (2D) mounted, 4 s. Cost:
>   a 12-tile 3D sheet takes as long as 12 stills (B7 91 s, B5 80 s; B7 paints its textures in code per page).
>   **D1:** `state.lastLook` = the build the last render_stills / contact_sheet showed; `finish` refuses another build
>   ("the code changed after your last look") before the free checks, and a look at a changed build is allowed past the
>   budget (`VERIFY_LOOK_ALLOWANCE` 2, label `rNNvK` so the last round's stills are kept); after those, an unseen build
>   finishes, logged `looked: false`. Prompt step 6 + tool descriptions. **Image readiness:** optional
>   `ImageProvider.readiness()` (sd-cli + a ready model; agy / codex installed and signed in), `imageEngine.checkReady()`;
>   the builder's first message says why generate_image is off. **Plumbing:** `BuildRequest.into` (v1 in an empty folder
>   the caller made; refused before the model when missing, holding a version, or with editOf) and `usage` (feature
>   source + agentId). `tsxJobEngine.start(request, owner)` for builds from main (origin agent / studio / flow, `into`,
>   `usage`; never over IPC): one shared build queue, runs while restored Creator jobs are held without releasing them,
>   never persisted; snapshot `origin`. `startBuildAndWait()` (tsx-jobs/build-and-wait.ts) = start + follow + cancel by
>   the caller's signal; the dev entry's followJob runs on it. Quick smoke (`runs/P3/smoke-p1`, Sonnet 5.5): finished,
>   50 s, 1 round, $0.64 API-eq, seamOk; it changed nothing after its look, so the D1 refusal is proven by unit tests
>   only. Gates: types 26/10; vitest 373 files / 3192 tests (2 load-flake timeouts pass alone).
> - **Part 2 DONE `3f6fc97`** (Creator composer A; Hasan "Ok" on the plan: the build takes the centre panel, other
>   callers' jobs hidden, button "Build"). Prompt mode starts a `build` job: aspect (4:5 incl.), fps, Auto length = no
>   `durationInFrames`, Loop, Budget (default Standard; hint from BUDGET_ROUNDS / BUDGET_CAPS, moved to
>   `src/shared/tsx-engine/build-budgets.ts`), brand, reference images, provider + model. The centre panel shows the
>   WATCHED build (started here, or its library row / strip chip clicked; else, nothing open, the newest running):
>   round · phase, format line, elapsed (local tick), checks, tokens, seam / purity chips, the latest look's stills
>   (file URLs), the builder's notes, Cancel; a queued build names whose build it waits for. A finished new build opens
>   when nothing is open OR when it was watched, else a toast offers it. Library placeholders + stream learn `build`;
>   `TsxJobsContext` drops jobs whose origin is not the Creator (keeps only `otherBuildActive`). Snapshot gains
>   `format`. Pure services + tests (`creator-jobs`, `build-panel-view`, `build-job-request`); MotionScreen's job side
>   moved to `useCreatorJobs` (525 → 496 lines). Optimize (now inert) + Thinking stay until part 3; edit / fix still
>   run the pipeline until part 3. Live check in the dev app over CDP (`runs/P3/ui-p2/`): with "bounce" open, Build →
>   panel took the centre; a second build showed "Waiting for the build in progress", cancelled while queued ($0);
>   Close → back to "bounce"; the library row brought the build back; 6 stills at 4:5 in the panel; finished →
>   auto-opened `bounce-2` and played. Quick on Sonnet 5.5: 76 s, 1 round, 6 checks, 7 API turns, 2.5k output tokens,
>   **$0.47 API-eq**, seamOk; it saw the ball on the title and moved it. Found: a fresh profile's Providers page shows
>   Claude (Subscription) On + default, yet `llmProvidersGet` returns no providers until Save, so the Creator says
>   "No providers configured" (pre-existing, not fixed). Gates: types 26/10; vitest 375 files green + 1 load flake
>   (shot-module-resolver, passes alone).
> - **Part 3 DONE `4a455d8`** (Creator composer B; Hasan "OK" on the plan: hand edits as a diff, builder edits in Studio
>   shot folders too, the thread above the Edit box, Edit row budget default Standard, Fix = Quick, a watched edit opens
>   its result). The Edit box and "Fix with AI" start `build` jobs with `editOf` (open folder + version); the watched edit
>   takes the centre ("Edit · bounce-2 · v2"); left, its result is offered in a toast. `openProjectJob` matches builder
>   edits: the project is busy (no hand save, no second fix) but the player stays; the Edit box shows round · phase,
>   "Show progress", Cancel. **Thread** = chat.json above the Edit box (latest exchange, "N earlier"); a build reply now
>   stores `version` + the builder's `summary`; a fix stores `threadText` "Fix with AI: <error>". Fix = Quick with the
>   error and the saved file's lines around it. Agent tab out (D4: MotionAgentPanel + useMotionAgent deleted),
>   Thinking + Optimize out (D3). Studio shot folders: next version, append-only kept, the Studio section rescans and
>   the toast says where it went (`studioSaveNotice`, shared with hand saves). Known limits until parts 5-6: a kit shot
>   fails `check` (the Creator lint refuses `@vidtsx/kit`), 3D / `vN.assets` output will not play in Studio yet.
>   **Hand-edited builder versions** (`build-seed.ts`): vN.tsx is the bundle (galton-bell 326 KB vs 16 KB of source), and
>   Overwrite / the Code tab's auto-save / Save as new change it without vN.src/. Seeds: `src` (vN.tsx still matches
>   vN.debug.json `artifactSha256`, new; older versions taken as unchanged), `hand-edits` (newest vK.src/ + vK.assets/
>   + HAND-EDITS.diff = line diff of vK's bundle vs vN.tsx, esbuild path comments normalised; a bundle changed in place
>   is remade from vK.src/ by `check`), `file` (pre-builder, or > 400 changed lines: the file + vK's DESIGN.md + the files
>   it names). HAND-EDITS.diff is never saved into vN.src/. Live (`runs/P3/ui-p3/`, dev app over CDP): Standard edit of a
>   hand-saved bounce-2 v2 (title "Bounce!" navy) on Sonnet 5.5: seed `hand-edits` (2 lines), kept the hand change, blue
>   ball + 5-ghost trail, seam OK, finished, 1 round, 5 checks, 77 s, **$0.70 API-eq**; thread showed the reply with its
>   summary. Fix with AI on a broken copy: Quick, error excerpt lines 891-895, cancelled at 31 ms before any API turn
>   ($0). Not seen live (the edit ended in 77 s while another project was open): the watched edit opening its result and
>   the Edit box's busy row; both unit-tested. **P2 problem 5 measured ($0):** galton-bell v1 in the Creator preview
>   (Electron, Chromium 146.0.7680.72) = the headless shell exactly: frame 150 slots `1 1 2 9 22 29 31 32 20 6 2 2 1`
>   (158 landed), frame 299 `1 1 5 24 72 89 107 100 67 21 6 2 2` (497); seeking 299 → 0 → 150 repeats. Nothing to fix for
>   the preview (Chrome 154 is still the odd one). The saved `r06-f150.jpg` predates B6's last physics change, so the
>   reference was rendered fresh (`runs/P3/p5-galton`). Gates: types 26/10; vitest 380 files / 3252 tests.
> - **Part 4 DONE `c5a1e10`** (agents' generate / edit_composition; Hasan "Ok for all" on the probe A-D and picks 1-7).
>   **Probe first** (dev-only spike mode `toolwait`, `runs/P3/toolwait-p4/report.json`; one Haiku 5.5 turn through
>   `runLlmGenerate` with a probe tool on the agents' own `buildAgentToolServer`, our progress lines only): **A** a call
>   blocked 900 s, then the model quoted its text word for word and described its image (images arrive after a long
>   call); **D** 3,900 s (65 min), same; **B** server `timeout: 60_000` → the model got `MCP server "vidtsx" tool
>   "wait_probe" timed out after 60s` at ~62 s and no image, while our handler ran on to 120 s (a timeout does not stop
>   the work); **C** an abort at 60 s stopped the tool in 1 ms, the run returned "Request cancelled", cancelled.
>   Cost **$0.47 + $0.50 + C unreported + $0.59** API-eq: every case writes the session's whole prompt into the cache,
>   twice when the wait outlives the 5 min cache (the estimate was < $0.05). → **pick 2:** `AGENT_TOOL_TIMEOUT_MS` = 3 h
>   on `createSdkMcpServer` (a queued Craft + its own Craft + margin), the probe cited in tool-server.ts.
>   **generate_composition** = one `build` job through `startBuildAndWait` into a reserved `compositions/<slug>/`
>   (mkdir-claimed, -2…; released if the build fails), owner origin agent | flow, usage = feature source + agentId;
>   `budget` (default Standard) + `loop`; `durationSeconds` → frames only when given (else the builder decides); prompt
>   = brief + style notes + file notes, brand in `brand`; image port → ≤4 reference images (JPEG ≤1024 px) + the first in
>   assets/, video port → assets/ (a same-stem clash renamed `-video`); no `imports: 'strict'`, no absolute-path
>   staticFile notes (`staticFileExpression` deleted). Progress = `<title>: <job label>` once per change (queued: "queued
>   (one build runs at a time)"). Result = `build-result.ts`: head + "Built on Standard: N looks, N checks, finished;
>   loop seam OK" + notice + the builder's summary + which frames; up to 3 frames of the builder's LAST look as image
>   blocks (none for flows). **edit_composition** = `editOf` the artifact's folder + N (a flat legacy file is copied in
>   as `<slug>/v1.tsx` first, seed `file`); `budget`, `loop` (sends the version's size + fps + loop, never a length).
>   **Copies** (`agents/composition-copy.ts`): vN.tsx + vN.src/ + vN.assets/ + vN.debug.json into `<parent>/<slug>/`
>   for run_agent context in / output out and flow outputs; library saves (tool + stage action) carry `<slug>.assets/`,
>   and the library walker skips an `X.assets/` beside `X.tsx`; Open in Creator copies the whole folder (every version,
>   stills, chat.json) and opens the artifact's version. **Players**: agent + flow-run resolve return `assets`
>   (`compositionAssetsIn`), CompositionViewer passes them as inputProps. **Sink deleted** (module + test, the runner's
>   `prepareArtifact` seam, `motionSink` on create-session, Home's `motionProjectId`; the `payload.motion?.versionPath`
>   reads stay for old artifacts). **Live** (dev app, `tsx-composer` session on Sonnet 5.5, `runs/P3/agents-p4/`
>   screenshots 04-10): **V1** Quick generate "coral ball bounces under Bounce, 4:5 loop": 2.1 min, 1 round,
>   `compositions/bounce-loop/v1.*`, progress rows in the chat, the stage player plays the kept build (ball clear of the
>   title), **$1.03 API-eq** (build $0.74 + agent $0.30, both rows `agent` / `vidtsx/tsx-composer`). The agent described
>   the frames but said they were "from before the fix": a look at the changed build after the budget (`r01v1`) has the
>   round of the look before it, and the pick grouped by round → fixed (group by look label; test from this case), app
>   restarted. **V2** Standard edit "blue ball + short fading trail" in the same session after the restart (the session
>   and its stage came back): 1.4 min, 1 of 3 rounds, `v2.*` beside v1 (v1 untouched), filmstrip v1 + v2, plays,
>   **$1.04 API-eq** (build $0.74 + agent $0.31). The agent: "These are the builder's round-1 frames, which here are also
>   its last look, so they match the delivered version" — right; it also said the trail sits above the ball at frame
>   90, where the still shows it below (correct for the rise): it read the image and got one direction wrong. Flow node:
>   unit tests only (flow-render runs the five-node flow on a fake engine). Noted, not changed: the progress rows are
>   chatty (~20 for one Quick build); tsx-composer's AGENT.md still describes the Creator Agent mode ("saved as the next
>   version of the open project", "a minute or more") and tsx-craft calls itself the tool's own text (P4 retires it from
>   the Creator); `tsx-deps.ts` has no caller now (part 8); a cancelled agent run logs no usage row (pre-existing). Gates:
>   types 26/10; vitest 381 files / 3273 tests.
> - **Part 5 DONE `8ec08b3`** (Studio shots + the Studio assistant + Refine, 2D; Hasan's answers 10-15: 1(b), 2a, 3a,
>   4a, 5a, 6a, 7 = a budget picker in the Inspector too, 8 = reword the skill). Every shot op is ONE `build` job through
>   `startBuildAndWait` (origin `studio`, usage `studio-tsx-shot`): **generate** `into` the reserved `shots/<id>/`;
>   **regenerate** = a fresh build into the same folder (`BuildRequest.retake`: `checkIntoFolder` lets it hold versions,
>   saved as N+1, a new build's round floor); **edit** = `editOf` the active version at the Inspector's budget (default
>   Standard); **Refine** = a Quick builder edit ("look, fix only what the frames show"; the old refine constraints minus
>   "keep imports exactly"). `shot-generator.ts` rewritten (the 4 slots, the pipeline calls and renderShotStills gone;
>   `validateShotCode` + `buildShotEngineDeps` stay for conform / import / reconcile / package import until part 8).
>   **Cancel (6a):** the generator owns one controller per shot, chained to the caller's signal; IPC cancel and the
>   assistant's turn both reach it, queued or running. A cancelled new shot leaves the registry through `shots-adopt`
>   (no undo step) and its empty folder is released; a failed new shot stays an error shot (Regenerate builds into its
>   empty folder); a cancelled or failed retake / edit / refine leaves the shot (a retake sends no registry snapshot
>   until it is ready). **What it is asked (4a, `shot-build-request.ts`):** the built-in pack `studio-shot` (shot craft
>   reworded for a builder, the contract, the kit MANIFEST; exemplars dropped) + an intent per op (kind + background
>   rule, brief, the WORDS block verbatim, learned style, media as `assets/<key><ext>` with staticFile); brand = the
>   request's brand text. **Media (2a, `shot-build-media.ts`):** the shot's media copied into assets/ as `<key><ext>`
>   (an edit copies only what no `vK.assets/` carries); on save the version's image / video / audio are registered as
>   project media in place (`attachVersionMedia`, now shared with Import TSX, behaviour unchanged there) and sent as
>   `importedAssets` + `assetRefs`; keys the shot had keep their asset ids; an edit's new keys are ADDED in the renderer.
>   A Studio build's `check` refuses other kinds ("cannot play in a Studio shot yet; draw it in code") until part 6.
>   **Kit (3a):** `check` inlines `@vidtsx/kit` from `getShotKitDir()/core` for EVERY builder build (`bundleShotSource`
>   `kitDir`; the kit files count as a package; Import TSX keeps it external). It bundles under esbuild (14.6 KB
>   tree-shaken, 12 inputs). **Behind a transparent shot (1(b), `look-backdrop.ts`):** render_stills, contact_sheet and
>   phone_view of an overlay / title render a wrapper: `<OffthreadVideo trimBefore={start × fps} muted>` of the footage
>   (served from the look bundle's asset root, prop `__vidtsxBackdropSrc`, entry `look.tsx`) under the piece, or a grey
>   checkerboard; loop_seam / purity_check and everything `finish` compares stay on the piece. Footage = the anchor
>   asset from `sourceStart`; else the master-lane clip the renderer finds (`features/studio/services/shot-footage.ts`)
>   under the playhead (pool Generate) or **under the clip's start (Inspector ops: applied as the natural extension of
>   the default, report)**; the asset's proxy when ready, else the original. The first message says what is behind.
>   Looks also hand every file in assets/ by key (an old D12 shot reading `props.assets.logo` shows its media).
>   **Assistant:** `generate_tsx_shot` takes `budget` (part 4's schema text), its chip updates per progress label
>   (`emitProgress`), the result = head + part 4's outcome lines + up to 3 stills of the last look (D6); a pool cancel
>   returns "cancelled … carry on", not an error. Studio tool server `timeout` = `AGENT_TOOL_TIMEOUT_MS` (3 h); the
>   private `resolveToolSupport` replaced by the shared one; `studio-make-tsx` reworded for the builder (minutes per
>   shot, budget, one build at a time, read the returned frames, a pool cancel). **Renderer:** Budget select in the pool
>   form and the Inspector (`BUDGET_CHOICES` / `budgetHint` moved to `build-budgets.ts`, re-exported for the Creator),
>   Cancel on the pool card while building and in the Inspector for every op, the footage sent with each op; the
>   queued card says "Waiting for another build to finish". Seam: `tsx-jobs/build-engine.ts` (`getBuildEngine` +
>   `setBuildEngineForTests`, shared with the agents' tools). Dev-only free spike mode `backdrop`.
>   **Live** (dev app over CDP, throwaway profile's Studio root pointed at `runs/P3/studio-p5/` FIRST (it had none, so
>   the app would have used his real Videos folder), a copy of s3-autocut with the talk put on V1; screenshots
>   `runs/P3/ui-p5/00-12`): **L0** $0 (`runs/P3/backdrop-p5` + `-clock`): a JPEG look of a transparent overlay shows
>   **black** behind it today; the wrapper shows the footage frame at the same moment (a testsrc clock clip read 5, 5,
>   6, 7 at frames 0/20/45/85 from 5.0 s, on stills and inside contact-sheet tiles), the checkerboard reads as
>   transparent; test-2's kit shot (copied) passes a Studio check with the kit inlined (21 KB). The s3 talk itself is a
>   flat blue frame. **L1** pool Generate, cutaway 5 s Quick: card progress + Cancel, 53 s, 1 round, landed at the
>   playhead on a new overlay lane, plays, Inspector v1, **$0.72**. **L2** a second (overlay) Generate cancelled 1.0 s in,
>   during its first turn: card gone, folder released, no usage row (a cancelled run logs none, pre-existing). **L3**
>   Refine L1 (Quick edit, seed src): 48 s, v2 adopted, picker v1 + v2, "re-centred vertically … cards enlarged … icons
>   scaled 1.35", **$0.25** (warm cache). **L4** assistant (fresh session): read the transcript, anchored a title to
>   "Today we are building the AutoCut feature" (2.38-4.4 s), the chip showed "Generating shot — 90% Round 1/1 ·
>   Designing and writing", built 70 s with the talk frame behind it in `v1.stills`, proposed; said "a lower-third that
>   lands in the bottom band over the footage. Each word pops in as it's spoken…" and flagged its own estimate of the
>   last word's end; **$0.94** (build $0.22 + assistant $0.72, the latter tagged `auto-cut`). Placed and played over the
>   talk. **Found, not part 5 (apply-shot-proposal.ts, unchanged):** the one overlay lane held L1's cutaway at 0-5 s,
>   so "Place 1 shot" put the word-synced title at 5.0 s instead of its anchor 2.38 s: off its words. **L5** Inspector
>   Apply edit at Standard on the title: 76 s, 1 of 3 rounds, v2 adopted, dark band behind the line checked over the
>   talk frame, **$0.20**. Live total **$2.11 API-eq** + L2's unlogged partial turn. Fixed during the checks: the
>   Inspector's Budget select was too narrow ("Stanc"). Notes: the grid card's progress strip covers the kind chip
>   (pre-existing layout); a renderer edit under `npm run dev` reloads the page to Home. Gates: types 26/10; vitest
>   387 files / 3323 tests (no flakes this run).
> - **Part 6 DONE `2846aa7`** (3D in Studio: D9 dev switch + D8 per-shot `vN.assets`; Hasan 10-15 "go with
>   recommended" = 1(a), 2(a), 3(a), 4(a) and the defaults). **D9:** `VIDTSX_DEV_PROD_REACT=1` (renderer config:
>   optimizer `define` NODE_ENV "production", `esbuild.jsxDev: false`, its own dep cache `node_modules/.vite-prod-react`
>   as an ABSOLUTE path: a relative `cacheDir` resolves against the renderer root and first landed in
>   `src/renderer/node_modules`); `import.meta.env.DEV` stays true; packaged builds unchanged. Switch off + a 3D shot →
>   the tile says "This 3D shot needs production React under npm run dev…" (`features/studio/services/shot-error-hint.ts`).
>   R3F throws `dispatcher.getOwner is not a function` inside its own reconciler root, NOT through the shot's error
>   boundary, so `ShotErrorBoundary` also takes the shot's `moduleUrl` and claims an uncaught window error whose stack
>   names it (`windowErrorHint`). **D8 preview:** `StudioShotModuleResponse.assets` = `versionAssetsProp` of the
>   version's folder (roots registered on every load, so a restart is fine); the handler moved to
>   `ipc/studio-shot-module-handler.ts` (studio-shot-handlers.ts 331 → 279 lines). The merge (`assetRefs` win) is
>   `mergeVersionAssets` in **`src/shared/studio/shot-version-assets.ts`**, not features/studio/services as planned:
>   the renderer AND the export use it. **D8 export:** `studio/shot-version-files.ts` merges each used shot's files
>   (looked up on its ORIGINAL version path) into every tsx clip of that shot in TIMELINE, lists the folders in the
>   sidecar (`StudioExportEntry.assetRoots`) and refuses a builder shot whose code names a file no `vK.assets/` holds
>   ("Shot "X" (v3): robot.glb is missing from the shot folder (shots/x/v3.assets/)…"); with no `vK.assets/` anywhere
>   the timeline object comes back unchanged (pre-builder entries byte-identical); `run-export.ts` registers the roots
>   before any engine (a queued export after a restart). **Builder:** `studioMediaErrors` + `CheckOptions` deleted
>   (`checkBuild(workDir, expect?)`); the shot pack's media line lists every kind, plus "a 3D overlay or title keeps its
>   canvas transparent". **Copies (1a, 3a):** `studio/shot-import-files.ts` `carryBuilderFiles`: the non-media files the
>   code names → the new shot's `v1.assets/` (relPath kept; a .gltf's .bin + textures too), `vN.src/` → `v1.src/`,
>   `vN.debug.json` → `v1.debug.json`; `ShotImportReport.copiedFiles` (was `unsupportedMedia`), notice "Copied into the
>   shot's folder: avocado.glb, studio.hdr (they play from there; they are not project media)." **(2a, 3a):** packages
>   carry `vN.assets/**` (media size cap) and `vN.src/**`, `vN.debug.json` only with the chat opt-in. **Fixed
>   (pre-existing):** a clean Import TSX returned `{ shotId }` before its report existed (its gate-pass branch called
>   `onReserved`), so the import panel never showed the notice (part 5's unsupported-media line never showed either);
>   now only the conform run reserves. Dev-only free spike mode `studio-stills` (`builder-spike-studio.ts`).
>   **Live** (dev app over CDP, studio root `runs/P3/studio-p5`, the s3-autocut copy, screenshots `runs/P3/ui-p6/`):
>   **L0a** $0, switch off: Import TSX of `probe-three-avocado` v1 → `v1.assets/` = avocado.glb (8.1 MB) + studio.hdr,
>   `v1.src/` + `v1.debug.json` copied, wood.jpg + logo.png registered in place; the tile shows the hint (after the
>   window-error fix). **L0b** $0, switch on: the window's React 19.2.4 is production (`createElement` has no
>   `getOwner`); the avocado plays in the editor (model, HDR light, wood texture, logo chip) and turns across three
>   scrubs; console: only THREE's PCFSoftShadowMap deprecation and "Multiple instances of Three.js being imported" (the
>   shot's inlined three + another copy in the page; harmless so far); a re-import showed the copied-files notice (the
>   fix, seen live); Home, the Creator preview of the same piece and the Studio timeline work. **L0c** $0:
>   createExportEntry → `clearAssetRoots()` → re-register from the sidecar → bundle → PNG stills: TIMELINE hands the
>   avocado clip avocado + studio as `/asset-root/…` and wood + logo as `/asset?path=`; frames 215/255/295 show the
>   avocado, 160 part 5's title over the talk; 98 s (bundle 63 s). **L1** pool Generate, OVERLAY 5 s Quick, Sonnet
>   5.5, playhead in the talk, "a small glossy 3D trophy turning in the top-right corner, transparent around it": 2.1
>   min, 1 round, 4 checks, 8 API turns, 3.7k output tokens; render_stills, a tile-by-tile contact sheet
>   (`tiles: separate`) and a phone view, all over the talk frame. It saw its round-1 trophy cropped at the top edge,
>   scaled it to 0.6, moved it down and looked again (D1's verify look); `ThreeCanvas gl={{ alpha: true }}`, no
>   background. Landed on O1 at 15.9 s, plays over the talk in the preview; **$0.60 API-eq** (one `studio-tsx-shot`
>   row). L0c stills of it: frames 500/540/600 over the talk; the `{ layer: 'shots' }` still is 98.1 % transparent /
>   1.8 % opaque. (The spike first reused the composition selected with `{}` and got the whole timeline in the layer
>   still: renderStill takes the props resolved at select time. The spike now selects again; the export engine already
>   hands them to renderComposition. L0c's avocado could not show it: a cutaway covers the frame.) L2 not run.
>   **Noted, not changed:** re-importing the same Creator piece registers its media again (4 image assets for 2 files);
>   a pool Remove keeps the folder, and the reconcile on the next open adopts it again (Q1c), so a Remove does not
>   survive a reopen; `shot-generator.test.ts` fails 3 cancel / fail tests even alone on a quiet machine (pre-existing:
>   the first checks `isRunning` after one `setTimeout(0)` while generate still awaits `fs.mkdir`, the next two hit the
>   run it leaves, "already building"; test unchanged). Gates: types 26/10; vitest 397 files, all green alone except
>   that file (full run: 6 more load flakes, timeouts + temp ENOENT).
> - **Part 7 DONE `2496181`** (the flow node; Hasan 10-16 "lets go with the recommendation" = D-1..D-6 all (a)).
>   **D-1:** Generate Composition gains Budget (Quick / Standard / Craft, labels from `budgetHint`), Loop on/off,
>   Seconds min 0 (= the builder picks); Edit Composition gains Budget + Loop Keep / On / Off. Inspector selects send
>   strings and node args reach zod as-is, so `loop` takes boolean | 'on' | 'off' (`onOff` / `isOn`, generate-audio's
>   pattern). NodeInspector shows `{ ...defaultConfig, ...config }`, so a node saved before a field existed shows what
>   its tool does with the key absent (a select showed its FIRST option). **D-2:** "Generated images" Off / On: in a
>   flow, absent or Off → `maxGeneratedImages: 0`; an agent keeps the per-budget default. Edit Composition has no such
>   select (D-1 listed Budget + Loop only): in a flow it may still buy images when an image provider is ready (asked).
>   **D-3:** `ToolPorts.reviseOnRetry { artifactKey, noteKey }` (generate: `reviseOf` + `revision`, flows-only schema
>   keys; edit: `artifactId` + `instruction`); the runner's `retryArgs` (flow-pause.ts) puts the REJECTED output and
>   the trimmed note there, so the builder edits the rejected version at the node's budget through the shared edit core
>   `tools/composition-edit.ts` (`runCompositionEdit`), and the result supersedes it (version + 1). An empty note (an
>   approve-card ✗) reruns from scratch as before. `NodeSpec.revisesOnRetry` → PauseCard "What to change (the builder
>   edits this version)". **D-4:** each progress line emits a node-status event with `FlowNodeRunState.progress` (event
>   only; run.json keeps `notes`) → the running step's line in StepsStrip and on CustomNode (every node, e.g. generate
>   _text's too); `flows/composition-preview.ts` = the middle frame of `pickResultStills` over `vN.debug.json`'s stills
>   → `flow-service.get` assetUrls → the approve card's thumb + the strip. **D-5:** explainer-30s + product-ad 1.1.0:
>   budget standard, loop off, images off, a run-form Budget param, descriptions. Split: `tools/composition-media.ts`
>   (port media, out of generate-composition.ts, now 278 lines). **Signing (10-17):** the vidtsx-1 private key was
>   lost; Hasan made vidtsx-2 in his own terminal (file outside every repo + password manager) and re-signed all five
>   (`9020062`); the packers now take a key's name from publishers.ts and `--genkey` writes to a file
>   (`scripts/signing-key.mjs`, `d2cef6c`); vidtsx-1 retired (`67d7d50`). **Live** (`runs/P3/ui-p7/`): **L0** $0: all
>   five built-ins `verified` / vidtsx-2; the cached rows rewritten (not pruned); fields and defaults as above.
>   **L1** explainer-30s, Checkpoints, Budget Quick on the run form, "How a rainbow forms, for 10-year-olds.":
>   script $0.21; build 3 min, 1 round, card with the v1 frame (its last look was a contact sheet, so the 56×36 thumb
>   is a 2×2 grid); Retry with note "Make the step titles twice as big." → an EDIT of v1 at Quick (1.6 min, v2 in the
>   same folder, titles ~2×) $0.30; card with the v2 frame; Stop run → cancelled, render 0 attempts, no MP4. Build
>   $0.85; total **$1.36 API-eq** (Sonnet 5.5, all `flows`). Gates: types 26/10; vitest 393 / 400 files (3 failed:
>   agent-memory = load flake, passes alone; shot-generator = the known 3; save-flow = the new Seconds label, fixed).
>   **Noted, not changed:** a sheet as the card's picture reads poorly at 56×36 (prefer a model frame of that look?);
>   the card still covers the viewer; "Round 0/1" before the first look (part 2's nit).
> - **Part 7 follow-ups DONE `f908815`** (Hasan 10-17 "1. yes 2. ok 3. ok"). **1** Edit Composition gets Generate's
>   "Generated images" Off / On (shared `GENERATED_IMAGES_FIELD` + `generatedImagesSchema`, default Off;
>   `generatedImagesOff()`: in a flow absent / Off → `maxGeneratedImages: 0` through `runCompositionEdit`; an agent
>   keeps the per-budget default). **2** A contact-sheet look as the card / strip picture: a look is frames OR one sheet
>   (one slot label each), so "pick that look's model frames by label" can never find any; `composition-preview` cuts
>   the sheet's middle tile instead (`contactSheetLayout` + new `sheetTileRect`, nativeImage, once, saved beside the
>   sheet as `rNN[vK]-sheet-fNNN.jpg`); a sheet not the layout's size stays the picture. $0 live: part 7's L1
>   composition-1 → `r01v1-sheet-f780.jpg` (500×281). **3(b)** `buildProgressLabel` names no round before the first
>   look ("Designing and writing", not "Round 0/1 · …"; Creator, Studio chips, flows); not seen live (needs a paid
>   build). Gates: types 26/10; vitest 396 files green + shot-generator's known 3.
> - **3(a) DONE `0975d4a`** (layout A, agreed 10-17). While a checkpoint waits, the PauseCard (card + retry row) takes
>   the params' place in the run form's 340 px left column; the brand / mode / Cancel footer stays; the 90 % overlay
>   over the viewer is gone. The viewer auto-selects the piece under review (the first pick candidate / approve item
>   with an artifact: a paused composition is not a declared output); the user's own strip pick wins, a new run or a
>   new card resets it, a card clearing keeps it; a form card leaves the viewer as it is. The retry row stacks (line,
>   full-width note, button). Rules in `features/flows/services/pending-artifact.ts` (`reviewItems`,
>   `pendingArtifactId`, `viewerArtifactId`; 7 tests; PauseCard reuses `reviewItems`). $0 live (`runs/P3/ui-p7fu/a3-*`,
>   user flow "3a check — card beside the viewer": Upload Image A = output, Upload Image B paused, Text paused): the
>   approve card in the left column with B in the viewer (not A), no overlay; the form card with A in the viewer; B
>   picked in the strip wins and stays after the run. Gates: types 26/10; vitest 391 + load flakes that pass alone +
>   the known 3.
> - **Part 8 DONE `a1c7b76` `27c5528` `3b0157f`** (the pipeline deleted, D10; Hasan 10-17 "go with recommendations" =
>   P8-1..P8-9 all (a)). **(i) the bundler first** (P8-3): wherever a shot already has a folder, a gate failure is
>   bundled in place before any model: `shot-bundle-in-place.ts` bundles the folder's vN.tsx with Import TSX's bundler
>   (local files + the library set inline), gates the one file and lands it as vN+1 in the SAME folder (id and clips
>   stay; the first `original.tsx` kept); its `staticFile()` media become project assets (`shot-bundle-media.ts`,
>   shared with Import TSX). Callers: Convert on a project shot (`conformShot`), the package import's `gateShots`, the
>   reconcile scan (a drop-in the bundler fixes is adopted at vN+1, never reported). Tests: the Creator 2D set
>   (chroma-js, @remotion/paths, transitions, google-fonts) inlines; `tone` is refused by name; in-place (5, real
>   esbuild); reconcile +2, package import +1. **(ii) Convert = a Quick builder edit** (P8-4/5/6):
>   `shotGenerator.convert` = `editVersion` with op `import`, Quick, `editOf` the version, `convertIntent` = the gate's
>   and the bundler's words + "make it pass check with the fewest changes; keep its look, timing and
>   compositionConfig; no synthesized audio"; tracked (the shot's cancel stops it), queued, chip progress. `conformShot`
>   = gate → bundler in place → convert at the project's shot default (`shotDefaults`: provider + `shotModel || model`;
>   the conform IPC drops `providerId`). Import TSX: the bundler first on both passes; Convert lands the source as
>   v1.tsx + original.tsx, registers it, converts to v2 (`shot-import-convert.ts`). `classifyShotImport`: Convert for
>   any gate failure the bundler could not fix, except a syntax error (`validateShotCode` flags `syntaxError`) and a
>   source importing local files (Convert edits one file; stays manual); three / R3F / d3 are no longer "blocking";
>   `describeImportFailure` names the bundler's reason and says Convert is a paid run. **A failed or cancelled convert
>   leaves an error shot with its source.** `shot-import-land.ts` = the landing helpers (no cycle). **(iii) P8-8:**
>   Convert on a reconcile drop-in bundles in place, else adopts the folder and converts it as vN+1: no `<id>-2` copy.
>   **(iv) deleted** (P8-1 / P8-2 / P8-7, 49 files, −3,593 lines): `TsxJobKind` is `build` only (the engine refuses
>   any other kind; `restore()` drops a queued generate / edit / fix from an older app with a log line); `generateTsx`
>   = the builder or a refusal (no engine / mode / fallback; `pipeline-fallback.ts` and the spike's mode3d probe
>   gone); shared/tsx-engine's generation service, prompt-builder, mode-parser and the pipeline prompts gone; also
>   `buildAgentTsxDeps`, `buildShotEngineDeps`, `buildShotExtraInstructions`, the dead `buildRefineInstruction`,
>   `CHAT_CONTEXT_LIMIT`, `useSmoothProgress`, the Creator preview's pipeline live-output view. Stays: `THINKING_*`,
>   `TSX_CRAFT_RULES` + the tsx-craft render (the signed SKILL.md unchanged, no signing), creator-imports (the
>   builder's check), `validateShotCode`, `validateAgentCompositionCode`, the step-log types the Creator still shows
>   for old debug sidecars (P8-7). The engine's 3 pipeline-only tests ported to builds (queue, cancel a queued job,
>   empty prompt) + restore drops old kinds. Gates: types 26/10; vitest 397 files green + shot-generator's known 3.
>   **L0** $0 (`runs/P3/ui-p8/01-09`, usage rows 0): Import TSX of a chroma-js + transitions shot → v1 bundled; a
>   `tone` shot → refused, conformable, new wording. chroma drop-in (`shots/chroma-drop/v1.tsx` + window focus) →
>   adopted at v2 (193 KB bundle), v1 + original kept, placed, plays. `tone` drop-in → banner + Convert → registered in
>   place (no `-2`) → cancel during "Preparing" → job `cancelled` (> 3 s to land), error shot "Conversion cancelled:
>   v1 is the source as imported…". Package of a project with a chroma shot → import: ready at v2, original kept. A
>   part 5 pipeline sidecar copied into the library shows in the Debug tab; the Creator loads, 0 "Uncaught".
>   **L1** (10-17, Hasan's go): the banner's Convert on a reconcile drop-in `shots/gsap-drop/v1.tsx` (a gsap timeline:
>   title from opacity 0 / y 40 over 0.6 s power2.out, dot from scale 0 back.out(2) at −0.2 s, then a 0.5 s scale 1.25
>   yoyo × 4; 90 frames, 1920×1080). Banner: "Package "gsap" is refused: it animates on its own clock. Animate from
>   useCurrentFrame() instead. (v1.tsx:7)" + the paid-run line. Converted in place, **ready at v2 in 90.6 s**, 1 round,
>   3 checks, 7 API turns (look: frames 0/15/25/45/60/89 + a phone view), Sonnet 5.5 (the project's shot default),
>   **$0.73 API-eq** (one `studio-tsx-shot` row; cache write 164k tokens). No `gsap-drop-2`; v1 + original kept. v2:
>   no gsap, the same timeline computed from `useCurrentFrame()` with inline power2.out / back.out(2) / sine.inOut,
>   compositionConfig unchanged, the 4 legs ending at 2.9 s. Placed at 30.30 s: in the Studio preview the title is
>   fading in at 0.17 s with no dot, the dot overshoots at 0.8 s and peaks at 1.4 s (`runs/P3/ui-p8/10-13`).
>   **Noted, not changed:** the bundler's "not allowed" reason lists every allowed package, so a `tone` banner is long
>   (gsap's named refusal is short); a cancel during "Preparing" takes seconds to land; every Studio job's card reads
>   "Waiting for another build to finish" for ~0.1 s even with an empty queue (a job is `queued` for an instant;
>   shot-generator.ts:294, since part 5).
> - **Part 9 DONE `82b1dbf` + the exit runs** (D11; Hasan 10-17 "all (a)" = P9-1..P9-5 (a): each caller's default
>   model = Sonnet 5.5, B-a + B-b fixed first, B2 typed with "Flat bold" in words, a miss gets one Craft re-run on the
>   same model, walls as below). **B-a:** agent-runner resolves the turn's model once ('' = the provider default,
>   absent = the session's) for the LLM and the tools alike, and the service forwards ''; before, a turn started by a
>   card reply ran on the provider default while the builder ran on the picked model. **B-b:** studio-shot-handlers
>   `shotChoice` fills `shotDefaults` when an Inspector op names no provider / model. **Exit runs** through the real UI
>   (dev app over CDP, throwaway profile, Studio root `runs/P3/studio-p5/`; every row `claude-sonnet-5-5`; no MP4):
>   Creator Standard 1.9 min 2/3 rounds $0.51 · Studio cutaway (pool Generate, 5 s) 1.0 min 2/3 $0.64 · flow
>   explainer-30s "Why ice floats on water, for 10-year-olds." to the checkpoint 2.7 min 3/3 $0.93 + script $0.21, Stop
>   run → cancelled, render 0 attempts · agent Infographic Loop v0.1 (unsigned, "Unverified") on B2 idea a, build 1.9
>   min 2/3 $0.63 + turns $0.76, stopped at its approve card · Craft re-runs of the two misses: Creator 2.6 min 4/6
>   $0.93; agent (same session, "Skip and chat", then the agent's own form answered "Change something first" with the
>   line) a new composition 3.6 min 4/6 $0.74 + turns $0.80, stopped at the new approve card. All six `finished`,
>   every loop seam OK. Total **$6.14 API-eq**. Walls `P3-B2`, `P3-B2-agent`, `P3-B2-craft`, `P3-B2-agent-craft`,
>   `P3-cutaway`, `P3-explainer` on :3920. Details: `ai-video-lab/experiments/studio-unlock-01/FINDINGS-P3.md`.
>   **Quality:** Studio and flow pass. The Creator and the agent miss column 3 on B2, Standard and Craft alike. The
>   Creator's Craft piece has coins at true scale split by origin with the payoff on frame 0, but no ghost slots or
>   per-year delta. The agent's Craft piece has a "Not earned" ghost but is still liquid bands, with a "+$24,000
>   interest" label fixed at its year-30 value. **Found:** Sonnet 5.5 finished every B2 build at the round floor
>   (`MIN_ROUNDS` 2 / 4, builder-prompt.ts:18), while P2's Opus Craft runs went past it in 5 of 7; the builder's
>   look passed a wrong on-screen number; a chat message sent while an agent card waits would make the agent's next
>   `ask_user` fail (interaction-broker.ts:45-51; the composer stays enabled); asked to rebuild "from the same
>   sheet", the agent wrote a new one. **Noted, not changed:** the agent's approve card covers its viewer; the flow's
>   compose node reads "skipped" after Stop run.
>
> **P3 exit (10-17): machinery met, quality on two of four callers.** No caller reaches the one-shot pipeline (code +
> six build jobs). Each entry point produces column-3 class on its brief: **yes** for Studio shots and the flow node,
> **no** for the TSX Creator and agents on B2 at the defaults (Sonnet 5.5, Standard, plus one Craft re-run each).

> **P4 plan agreed 10-18** (Hasan closed P3 on 10-17 with the Creator and the agent missing B2; "go with the
> recommendation" = P4-1..P4-11 all (a); one part per go). Planning fact: P3's four B2 builds ran on Sonnet 5.5 with
> `packs: []`, while every earlier column-3 B2 (P0 run 2, P1 ink, P2) was Opus 5.5 at Craft with the three lab skills
> as packs, so P3 changed the model and the packs at once. Decisions: **P4-1** a `craft` kind of the pack container,
> built-in root only · **P4-2** seven packs rewritten for the builder; the one-clock rule goes into METHOD (part 2) ·
> **P4-3** Creator Kind + Style beside Brand, a form applies its suggestions visibly, ids sent and resolved in main,
> edits keep their packs · **P4-4** every look returns each frame's text (a $0 spike first; fallback the one-clock rule
> alone) · **P4-5** no floor change; the moves go in round 1, a PACK: line per round · **P4-6** generate_composition
> `packs` + `from`, edit_composition keeps packs, the flow node's Packs select, `builder: true` agent skills travel ·
> **P4-7** a chat message answers a pending card (Skip and chat starts no turn) · **P4-8** agent v0.2 as a new unsigned
> lab folder, v0.1 untouched · **P4-9** tsx-composer removed · **P4-10** built-in flows unchanged (no signed file) ·
> **P4-11** exit on the Sonnet 5.5 default: E1 Creator B2 + Infographic loop + Flat bold (the gate), E2 B1 + Blueprint,
> E3 agent v0.2 on B2; an Opus 5.5 control only if E1 misses. Parts: 1 craft kind + packs + ids + picker + edits keep
> packs · 2 one clock + frame text · 3 agents + flows + the card trap + tsx-composer out · 4 v0.2 · 5 exit.
> - **Part 1 DONE `5889091`** (no signed file). **Format:** `resources/packs/core/pack.json` `craft[]` (id, name, role
>   `form` | `method` | `style`, description, `with` = full ids it brings, `suggest` = aspectRatio / seconds / loop /
>   budget), texts `craft/<id>.md` in SKILL.md format, ids `core/<id>`; pure half `shared/studio/craft-pack.ts`
>   (entries, `expandCraftIds`: each pack then what it brings, nested, once). Main `tsx-builder/craft-packs.ts` reads
>   the BUILT-IN packs only, once, cached and synchronous (start() checks ids before anything queues); a text missing or
>   over 64 KB drops that entry. **Craft is not in `PACK_KINDS`**: adding it there would make a `.vidtsxpack` import
>   install craft texts nothing reads (that is P4-1 (b)) and pull in the Studio import dialog. **The seven** (lifted
>   from the lab's three skills and rewritten for the builder; the build-sheet section is gone): Infographic loop (form;
>   brings Concept to picture; suggests 4:5 · 8 s · Loop · Craft; the form, the loop, **the four moves planned before
>   the first `check`**: countable marks at a stated unit with exact counts, ghost slots of the final shape on every
>   frame, the step's delta beside each side in the marks' unit, a labelled band / area / bar with a ruler is a chart;
>   layout + legibility; a look check list; a **PACK:** line in each round-log entry), Concept to picture (method;
>   three metaphors, pick the one only this idea has), Blueprint, Flat bold, Neon dark, Editorial (each font named from
>   `@remotion/google-fonts`), Your own style (turns the user's words into a full style in DESIGN.md first). A test keeps
>   every brief's topic out of the texts. **Ids over IPC:** `TsxBuildJobRequestIpc.packs: string[]` + `style` (the
>   user's own words); an unknown id or a wrong shape is refused at start; Studio's code-built studio-shot pack moved to
>   the main-only `TsxJobOwner.packs`; channel `tsxjob:craft-packs` lists them; the dev spike takes `packs` ids and
>   refuses `packsDir`. **The builder** resolves ids after the seed, puts their texts before a caller's own, records
>   `craftPacks` (expanded) + `style` in vN.debug.json, and the first message gets a `STYLE (the user's own words; keep
>   every one)` block. **Edits keep their packs:** an edit that names none (the Creator's Edit box, Fix with AI, any
>   caller) gets its version's `craftPacks` + `style` (`SeededBuild.craft`; a copy saved by hand keeps vK's); `[]` =
>   none; an id this app no longer has is skipped and logged. **Creator:** `MotionCraftFields` (Kind = forms, Style =
>   styles + "Your own…" opening a words box; empty words send no style) above Brand; a Kind sets its suggestions on the
>   controls and says so under the picker ("Set 4:5 · 8 s · Loop · Craft above; change any of them"); None changes
>   nothing back (D3's Standard holds without a form); state in `useMotionGenerator`, MotionScreen passes one prop, no
>   EditorShell. Gates: types 26/10; full vitest green with temp on D: (on C:'s temp, three esbuild test files fail alone
>   with "Cannot read directory ../../../..: used by another process", a lock in the AppData tree, unrelated); the
>   known 3 in shot-generator intermittent. **L0 $0** (dev app over CDP, throwaway profile, 0 usage rows since launch,
>   `ai-video-lab/.../runs/P4/ui-p4-1`): (a) Kind Infographic loop + Flat bold, B2 typed: the controls went Standard ·
>   16:9 · Auto · no loop → Craft · 4:5 · 8 s · Loop; Build → cancelled at turn 0 (0 tokens); the kept system-prompt.md
>   = METHOD + `CRAFT: 6 look rounds … before round 4` + `# Craft packs` + Infographic loop, Concept to picture, Flat bold
>   in that order, no frontmatter. (b) Style "Your own…" + chalkboard words, no Kind: only the Your own style pack.
>   (c) an Edit ("Make the title twice as big.") of a copy whose v1.debug.json names three packs: its system prompt
>   holds the same three, edit floor 1. (d) `tsxJobStart` with `core/style-chalk` → "Unknown craft pack …", nothing
>   queued. **Noted:** a page script's waits crawl while the hidden dev window is minimised (Chromium throttles hidden
>   timers); restore it first (`runs/P3/ui-p6/restore-window.ps1`).
> - **Part 2 DONE `f83d03a` + `644d0c5`** (no signed file; the second keeps each look's text per frame in the
>   look's event, so vN.debug.json shows what the builder read — the transcript keeps only its narration). **One clock** in METHOD step 1, for every caller: every number and
>   label on screen comes from the state the picture draws at that frame; a step label and its values from ONE integer
>   step (never `Math.round(t)` beside values from the continuous `t`); a result, total or badge only on frames where
>   the marks and counters show it; no changing number typed in at a fixed value. Step 4: "Read each frame's text
>   (listed under its label in every look) against your model at that frame". **Frame text in every look (P4-4 a):**
>   `frame-text.ts` = a page probe that `prepareBuildRender` appends to every look entry (the looks still share one
>   bundle); after each DOM change it walks the visible HTML and SVG text nodes (opacity along the tree, visibility,
>   fill / colour alpha, gradient text, inside the frame or the tile) and logs them with their boxes behind a mark;
>   renderStill's `onBrowserLog` keeps the page's last report (a still is one page, closed right after its screenshot;
>   a plain log reaches Remotion's console only at verbose). Node merges the boxes into reading-order strings: rows
>   seeded by the tallest text (a node joins when ≥ 60 % of the shorter height lies inside), close nodes joined, a
>   stacked line or a wide gap starts a new string, a shadow copy counts once, "(faint)" under 0.35 opacity, ≤ 40 per
>   frame. render_stills: `Frame N:` + `Text: "…" · "…"` under each label; contact_sheet: a `Frame N: …` line per
>   tile (a mounted sheet tags each tile `data-vidtsx-frame`; a WebGL sheet reads its per-tile pages). Text on a
>   canvas, in WebGL or in an image is not listed, and the tool says so. Free, not enforced. Split for size: loop_seam +
>   purity_check → `builder-measure-tools.ts`, `renderPreparedInOrder` → `build-in-order.ts`. **Spike, $0** (mode
>   `frametext`, `builder-spike-text.ts`; `ai-video-lab/.../runs/P4/frametext-p2`, `-p2b`): a synthetic piece (split
>   spans, a tspan, two labels on one row, a shadow copy, a fade-in, a faint label; never listed: `<style>`, SVG
>   `<title>`, fill-opacity 0, a group at opacity 0, display:none, visibility:hidden, off the frame, a parent at
>   opacity 0, a canvas) is exact on every frame through stills, the mounted sheet and the tile sheet; the P1 fixture
>   (F2), B4 chalk, B5 (3D + SVG overlay, tile-by-tile sheet) and P3's agent Craft piece give the same text on two
>   renders, and sheet = stills (B5 after one fix: rows grouped by centres flipped at tile scale). P3's miss reads
>   `"YEAR 19" · "$25,000" · … · "+$24,000 interest"` at frame 180 and "YEAR 30" from frame 0. Pixels with vs without
>   the probe, 3 interleaved renders a side: unchanged or within the render's own noise (WebGL ~300 bytes either way),
>   except ONE pixel by ≤ 8/255 at B4 frame 65 (every time with, never without). The in-order render (purity_check's
>   pass) 11.1 vs 11.4 s for 90 frames, 38.1 vs 39.8 s for 240. Gates: types 26/10; full vitest = shot-generator's
>   known 3 + load flakes that pass alone (temp on D:). Not yet seen through a model (that needs a paid build): the
>   exit runs (part 5) show whether the builder reads it.
> - **Part 3 DONE `7ff36dc`** (no signed file; no flow.json touched). **P4-6 (a):** generate-composition.ts split first
>   (288 → 218 lines: `composition-args.ts` = the shared budget / loop / images args, `composition-packs.ts`,
>   `composition-plan.ts` = the two request planners, `composition-rebuild.ts`). `packs` = craft pack ids, checked
>   against the built-in packs BEFORE a folder is reserved (an unknown id names the ones the app has; one style at most;
>   `core/style-custom` takes the user's words from `styleNotes` and sends them as the builder's STYLE block, not as a
>   "Style notes:" line). `from` = a composition artifact built again from its own vN.debug.json request: intent
>   verbatim, `craftPacks`, `style`, format with its loop, brand; budget = the call's or the recorded one; images stay
>   off when the build had them off; a version that is an edit (its record holds the instruction) walks `editOf` back to
>   the first build and the result says "That is v1's request: the edits up to vN are not in this build"; refused: any
>   other shaping argument beside title + budget (named), a build from session media (its record keeps names only), a
>   flat pre-builder file. Result line: "Rebuilt from X's request, unchanged (its brief, packs, style, format and loop),
>   at the Craft budget." The flow node: **Kind** + **Style** selects after Loop (`kindPack` / `stylePack`, value
>   `none` by default; "Your own — the words in Style notes"), configSchema only, so explainer-30s and product-ad build as
>   before; their options are a fixed list that a test pins to resources/packs (a new built-in pack fails it until it is
>   offered). **`builder: true`** in a skill's SKILL.md frontmatter (`AgentSkill.builder`): the runner hands those skills
>   to the tool server as `builderPacks`, every composition build and edit sends them as the owner's packs (after the
>   craft packs), and the agent's own prompt gets only a "Builder packs" list (name: description), not the body; also in
>   AGENT_PACKAGE_SPEC.md. Brief + tool description now say what and why, the builder designs (no layouts, coordinates,
>   pixel sizes or frame-by-frame sheets). **Proved through the tool** (`packs-through-tools.test.ts`: the REAL job
>   engine and builder, a scripted model, the real pack texts): generate's packs reach the system prompt expanded and in
>   order, then the builder skill; edit_composition names none and its build still has the same three + the skill +
>   the STYLE words, v2.debug.json the same `craftPacks`; `from` the edit = v1's intent, packs and style in a new folder.
>   **P4-7 (a):** "Skip and chat" closes the card, focuses the box and starts NO turn (Agents workspace and the flows
>   Builder panel; `useAgentRun.skipInteraction`, the chat says "You skipped the question: your next message answers
>   it."); reopening the session shows the card again. A message the user TYPES (only the chat box's IPC path:
>   `AgentService.sendFromUser`) while a question waits, skipped or not, answers it in main: `[Answer to question q-…] The
>   user skipped the card and wrote: <text>` (`InteractionBroker.skipWith`; the lineage log records `cancelled`); job
>   notes, card replies, run_agent and a freeze keep plain `send` and never touch the card. While a turn runs nothing is
>   skipped. **P4-9 (a):** removed `resources/agents/vidtsx/tsx-composer/`, `src/shared/tsx-engine/prompts/` (tsx-craft.ts
>   = TSX_CRAFT_RULES, tsx-craft-skill(.test).ts) and `scripts/gen-tsx-craft-skill.mjs`; motion-post untouched. Gates:
>   types 26/10; full vitest (temp on D:) = shot-generator's known 3 + four 5 s timeouts (agent-package, agent-store,
>   project-package, project-package-import) that pass alone. **$0 UI** (dev app, throwaway profile,
>   `ai-video-lab/.../runs/P4/ui-p4-3`, 0 usage rows since launch): agents = assistant, flow-builder, lwh/infographic-loop
>   0.1.0 "Unverified", motion-post, web-designer; Home's sessions hold only s-23ef7a41 (the profile's old tsx-composer
>   session s-2c3ed9cb drops out, nothing errors); the node list carries Kind / Style; a NEW Assistant session
>   (s-2588ed17) with a pick question planted in session.json shows the card → Skip and chat → card gone, the skipped
>   line, cursor in the box, no Stop button, no chat.json, question still on disk → back and in again → the card again.
>   s-23ef7a41 not opened. The typed-answer half is unit-tested only (sending starts a paid turn): it rides on E3.
>   **Judgment calls, reported:** (1) the node has two selects (Kind + Style, as the Creator), not one; (2) a builder
>   skill leaves the agent's prompt (named only); (3) `from` on an edit rebuilds the first build's request and says so,
>   rather than refusing; (4) a skipped card comes back when the session is reopened (the question still waits).

Each phase ends by re-running the `studio-unlock-01` briefs (B1–B4) through the new entry
point and putting the result on the wall beside R0b column 3, with time, rounds and tokens.

| Phase | Scope | Exit |
|---|---|---|
| **P0 spike** (no UI, dev-only IPC or script, behind flag `tsx-builder`) | builder session in main: guarded file tools + `check` + `render_stills` + `finish`; budget Craft; brief B2 | B2 reaches column-3 class from inside the app process, on Windows, with no shell. Also answered: the allowedTools hole; bundle passes the gates (T3); font route works in the isolated `/preview` page; stills time per round on the 1650 Ti laptop |
| **P1 builder service** | request/result types, build folders + versions (`vN.tsx`, `vN.src/`, debug), all T2 tools except `text_overlaps`, budgets + caps, cancel, progress events, the `generateTsx()` dispatcher, tsx-job hosting (builder only; providers without tools → clear error; OpenRouter models must have tools + image input), unit tests | all four briefs through the job engine at Craft on the wall (`P1-B1..B4`) + one Standard edit of B2 |
| **P2 no limits** (Rev 2) | T4 Rev 2: the curated library set behind one constant, GPU stills + export, frame-pure physics helper + rule, builder assets folder, packaged-app resolution (asar), no network at render; plus T5 fonts, kit on the render path, prompts aligned | new 3D + physics briefs reach the lab's real3d quality; the four 2D briefs still pass; dev and packaged, offline after the first run |
| **P3 callers** | Creator merged composer (+4:5, budget, packs, live stills, 3D through the builder), then agents' generate/edit_composition, then Studio shots + assistant + Refine, then the flow node; **then `generateTsxPipeline` is deleted from generation** (Rev 2; conform/import repair passes decided then) | each entry point produces column-3 class on its brief; no caller reaches the one-shot pipeline. **Ran 10-17 (Sonnet 5.5 defaults):** no caller reaches the pipeline (met); column-3 class on Studio + flow, not on the Creator or the agent (B2, Standard + one Craft re-run each); FINDINGS-P3.md |
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
