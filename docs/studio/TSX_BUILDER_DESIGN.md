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
- **Fallback:** providers without tool use keep today's one-shot pipeline.

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

### T4 — Import tier 1 (no new dependencies)
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

Each phase ends by re-running the `studio-unlock-01` briefs (B1–B4) through the new entry
point and putting the result on the wall beside R0b column 3, with time, rounds and tokens.

| Phase | Scope | Exit |
|---|---|---|
| **P0 spike** (no UI, dev-only IPC or script, behind flag `tsx-builder`) | builder session in main: guarded file tools + `check` + `render_stills` + `finish`; budget Craft; brief B2 | B2 reaches column-3 class from inside the app process, on Windows, with no shell. Also answered: the allowedTools hole; bundle passes the gates (T3); font route works in the isolated `/preview` page; stills time per round on the 1650 Ti laptop |
| **P1 builder service** | request/result types, build folders + versions (`vN.tsx`, `vN.src/`, debug), all T2 tools except `text_overlaps`, budgets + caps, cancel, progress events, tsx-job hosting, unit tests | all four briefs through a dev entry; fallback path for non-tool providers |
| **P2 imports + fonts** | single allowlist constant, tier 1 vendored for preview, export resolution, `compositionConfig.fonts` through the brand-font pipeline, prompts aligned; kit on the render path, chroma-js | the four briefs render with real fonts, offline after the first run |
| **P3 callers** | Creator merged composer (+4:5, budget, packs, live stills), then agents' generate/edit_composition, then Studio shots + assistant + Refine, then the flow node | each entry point produces column-3 class on its brief |
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
