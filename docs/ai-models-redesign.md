# AI Models screen — redesign plan (V1 polish)

> Status: **DECIDED 2026-09-16, building.** Written from Hasan's feedback while
> testing the app; the decisions in §4 were answered the same day (D1 rail, D2 the
> eight image rows, D3 five video rows AND local video becomes an engine provider,
> D4 Codex spike run — results in §3.7; D5–D9 took the recommendation). Parent list:
> `docs/UI_POLISH_PLAN.md` item 1. Companion docs: `UI_SPEC.md` (visual kit),
> `V1_RELEASE_PLAN.md` Phase C/D/H (how the page got its current shape),
> `docs/NEXT_FEATURES_DESIGN.md` Q1 (the CLI-bridge image provider pattern),
> `docs/local-video-models-research.md` (the video VRAM ladder).

## 0. What Hasan asked for (2026-09-16)

1. Maximized window: the page sits centred with empty margins instead of filling.
2. Beyond that, redesign the whole tab so it reads professional, organised, neat, clear.
3. Providers: hide **MiniMax M2.7** and **Kimi (Moonshot)** for this version; hide
   **Local Models** from the "Default LLM provider" dropdown.
4. The model-catalog cards are the weakest part — rethink the layout and the full UX.
5. Audio: the page is framed around whisper. Whisper should be *one model family* on an
   Audio page, not the page itself.
6. Images: a shorter default model list. Move the Google-subscription card out of the
   Image tab into Providers, tagged **Images** (later it may serve LLMs too).
7. Add an **OpenAI Codex** subscription provider beside it, images only.
8. Bring the **Video** tab back with a short *verified* list of 3–5 local video models
   spanning hardware tiers, so users with strong GPUs can use them.

## 1. What exists today (survey, file refs)

| Piece | Where | Note |
|---|---|---|
| Screen shell | `src/features/ai-models/components/AiModelsScreen.tsx` | `max-w-6xl mx-auto` (1152 px, centred) — the cause of item 1 |
| Sub-tab bar | `AiModelsTab.tsx`, `types.ts` `SUB_TABS` | System · Providers · Audio · Image · Video* · LLMs* · 3D · Embeddings* · Content Safety (* env-gated, absent in V1) |
| System tab | `MainContent.tsx` | Hardware rows + Library totals + "Engines" cards. The Audio/LLM engine cards read **Not available** in a release build (sherpa + node-llama-cpp are not bundled) — looks broken |
| Providers | `providers/ProvidersContent.tsx` → `ApiKeysSection.tsx` + `ModelCatalogSection.tsx`; inner tabs Providers · Usage | One panel of key rows (registry order: Fal, BytePlus, OpenRouter, Cloudflare, AssemblyAI, ElevenLabs) then LLM rows (Claude ×2, MiniMax, Kimi, custom), footer with Default LLM provider + Save |
| Preset hiding | `src/main/ipc/llm-handlers.ts` `V1_HIDDEN_PRESET_IDS = {openai, gemini, zai}` | Grandfathered (a saved config keeps working), `VITE_FF_ALL_PROVIDERS=1` restores. **MiniMax and Kimi are not in it** |
| Local Models preset | `src/engine/presets.ts` id `local`; shown only when node-llama-cpp loads (dev). Excluded from the installer by `electron-builder.yml` | Visible in dev, invisible in production today — hide it explicitly anyway |
| Catalog cards | `ModelCatalogCard.tsx` in a 1/2/3-column grid | One card per provider×category from `PROVIDER_MODEL_DEFAULTS` — **the hidden presets (OpenAI, Gemini, Z.AI) still get a card** because `getProviderModelCatalogs()` never consults the hidden set: ~14 cards, mixed sizes, every list expanded |
| Image tab | `ImageModelsContent.tsx` | Header strip (folder, sd-cli badge, 4 buttons) → sd-cli setup card → **Gemini CLI setup card (always, at top)** → Installed → "Available to download" (34 entries: 25 one-click, 6 Civitai link-only, plus companions) → image tools |
| Audio tab | `AudioTabContent.tsx` → `WhisperModelsSection.tsx` | "Transcription (whisper.cpp)" header, Engine panel, Default-model panel, 5-row model list. Sherpa section env-gated |
| Video tab | `VideoModelsContent.tsx` (flag `ai-video-models`, env-gated) | Folder strip → Generate panel (when ≥ 1 ready) → Installed → catalog of 8 (`src/local-video-engine/model-registry.ts`). **The end-to-end click test has never been run** (research doc §3.1) |
| Subscription image provider | `image-engine/providers/gemini-cli-provider.ts`, `main/services/agy-cli.ts` (+ `agy-cli-protocol.ts`), `useGeminiCliStatus`, `useActiveImageProvider` adds "Google (subscription)" | The pattern a Codex provider copies. `ImageProviderConfig.type` already reserves a second CLI slot (`'minimax-cli'`, deferred) |
| Download links | `local-image-engine/model-registry.links.test.ts` | HEAD-checks every `downloadUrl` (network test) — re-run before shipping any curated list |

## 2. Proposed information architecture

**Layout: a left section rail inside the screen** (D1). The content area then fills
the window at any width; the rail is what makes eight sections feel organised where
a row of nine pills does not. Rail groups: **Overview · Providers · Usage** /
**Image · Video · Audio · 3D** (under a "Local models" caption) / **Content Safety**.

```
┌ AI Models ───────────────────────────────────────────────────────────────┐
│ Overview     │  Providers & API keys                          [Save]     │
│ Providers  ● │  ┌────────────────────────────────────────────────────┐   │
│ Usage        │  │ Provider      Powers              Status   Key     │   │
│              │  │ Fal           Images · Video      Saved    ••••  ▾ │   │
│ LOCAL MODELS │  │ OpenRouter    Images · LLMs · STT No key   [____]  │   │
│ Image        │  │ …                                                  │   │
│ Video        │  └────────────────────────────────────────────────────┘   │
│ Audio        │  Subscriptions (no API key)                               │
│ 3D           │  Claude              LLMs     Signed in       [Check]     │
│              │  Google Antigravity  Images   Not installed   [How ▾]     │
│ Content      │  OpenAI Codex        Images   Ready           [Check]     │
│ Safety       │  Defaults   LLM: Claude (Subscription) ▾   Image: Fal ▾    │
│              │  Model catalogs   ▸ Fal · 12 image · 4 video   Defaults    │
└──────────────┴───────────────────────────────────────────────────────────┘
```

Rules that hold on every section:

- **Width.** The `max-w-6xl mx-auto` wrapper goes. Tables and lists are full-width;
  card grids are `auto-fill` with a minimum column width, so a maximized window gets
  more columns, not wider margins. Prose paragraphs cap at ~70 ch (UI_SPEC "very
  wide" rule) but never the page.
- **One template for every local-model section** (Image, Video, Audio, 3D): a status
  strip → Installed → Recommended → All models (collapsed, searchable). See §3.3.
- **Kit only.** `Panel`, `SectionHeader`, `StatusBadge`, `Select`, `TextInput`,
  `Button`, `ProgressBar`, `ErrorBanner` from `@shared/components`, UI_SPEC sizes
  (11–13 px text, 26 px inputs, 0.5 px borders). No new colours.
- **Hidden means gone.** Anything env-gated or V1-hidden must not leave a trace
  (no empty cards, no "Not available" rows for engines the build does not ship).

Fallback (D1 = A): keep the horizontal pills, apply everything else. Cheaper by
about half a session; the "organised" feel is weaker.

## 3. Section by section

### 3.1 Overview (today: "System")

- **Hardware** — GPU · VRAM (total / free) · CUDA · RAM · Disk as today, one panel.
- **Runtimes** — one table replacing the Engines cards: whisper.cpp, sd-cli
  (image + video), GPU encoder (full ffmpeg), AI runtime (Python, CPU/GPU build).
  Columns: name · what it powers · status (Installed vX / Not installed / Downloading
  n %) · size on disk · action (Install / Update / Remove). This absorbs the
  `AiRuntimeRow` and the sd-cli / whisper setup cards' install actions.
- **Storage** — models folder path with Change / Open, and per-category counts + sizes
  (image · video · audio · 3D) from `modelsScan`.
- **Drop:** the Audio Engine / LLM Engine / Embedding Engine cards (hidden engines).

### 3.2 Providers

1. **API keys** — a table, not stacked cards: Provider · Powers (capability badges) ·
   Status (Key saved / No key / Connected 812 ms) · key field (masked, eye toggle,
   inline Test / Remove). Rows: the registry order plus Claude (API key). One Save
   for the table (unchanged semantics).
2. **Subscriptions (no API key)** — a new group, one row each, same columns minus the
   key field: **Claude** (LLMs — Agent SDK login), **Google Antigravity** (Images —
   moved here from the Image tab; the same detect / sign-in / install copy, folded
   into an expander), **OpenAI Codex** (Images — new, §3.7). Status chip + "Check
   again"; instructions in an expander, never a permanent card. Capability badges are
   what let a later version add "LLMs" to a row without moving anything.
3. **Defaults** — Default LLM provider (+ its model) as today. The `local` preset is
   filtered out unless the LLMs tab flag is on (D7). Optional: Default image provider
   here too, so Image Studio's active-provider switch has a home outside the studio.
4. **Model catalogs** — an accordion, one row per *visible* provider, collapsed:
   "Fal — 12 image · 4 video models — Defaults" → expands to the editable list(s)
   with the current add / remove / dialect / gear controls. Providers without a key
   sit under a "Providers without a key" caption at the end. Hidden presets are
   filtered in `getProviderModelCatalogs()` (the same set `handleLlmProvidersGet`
   applies — one helper, both callers).
5. **Hide for V1:** `minimax` and `kimi` join `V1_HIDDEN_PRESET_IDS` (grandfathered
   like Z.AI; `VITE_FF_ALL_PROVIDERS=1` restores). `LLM_ONLY_IDS` in
   `ApiKeysSection` needs no change — the rows come from the handler. OpenRouter's
   list keeps its Kimi K3 / MiniMax M3 entries: they are OpenRouter models (D6).
6. **Usage** stays as built, as its own rail entry (D9).

### 3.3 The local-model page template (Image · Video · Audio · 3D)

```
[ Status strip ]  whisper.cpp · Installed   Models folder …\audio  [Change] [Open] [Rescan] [Import…]
[ Defaults ]      (only where the page owns one: Audio → default transcription model)
[ Installed ]     name · family · size · Fits badge · Ready / Needs n files · Use · ⚙ · Delete
[ Recommended ]   the curated short list: name · family · size · tier chip · Fits badge · Download
[ All models ▸ ]  collapsed; search; the full catalog incl. link-only entries ("Get ↗")
```

- The engine setup card becomes the status strip's first chip with an inline Install
  button (the full runtime table lives on Overview).
- **Tier chip** is a new catalog field per entry: `Laptop (≤ 4 GB)` · `6–8 GB` ·
  `12 GB` · `16 GB+`, derived from the entry's own `minVramGB` so it never
  disagrees with the Fits badge; the badge stays the per-machine truth.
- **Recommended** is a new boolean `recommended` on catalog entries (both image and
  video registries). Nothing else changes in the model library core.
- **"Tested" badge** (video, D3): entries carry `verifiedOn: 'YYYY-MM-DD'` once a clip
  was generated from them during a release pass; the chip renders only when set.

### 3.4 Image — the short list

Proposed `recommended` set (one-click entries only; the Civitai link-only rows stay
under All models). Sizes are the catalog's; the tier is where the family floor plus
file size lands — the Fits badge still decides per machine.

| Tier | Entry | Download | Why it is on the list |
|---|---|---|---|
| Try it, any GPU | BK-SDM-Tiny Q4 | 654 MB | seconds per image, the smoke test |
| Laptop ≤ 4 GB | SD 1.5 Base Q8 | 1.9 GB | the classic 512 px baseline |
| Laptop 4–6 GB | SDXL Lightning Q8 | 4.1 GB | 1024 px in 4 steps |
| 6 GB | Flux.2 Klein 4B Q4 | 2.5 GB + companions | modern quality, 4 steps |
| 8 GB | Flux.2 Klein 9B Q4 | 5.6 GB + companions | |
| 8 GB | Flux.1 Schnell Q4 | 6.9 GB + companions | prompt adherence |
| 12 GB | Flux.1 Dev Q8 | 12.8 GB + companions | the quality pick |
| 12 GB | SD 3.5 Large Turbo Q4 | 11.9 GB | text rendering, 4 steps |

Eight rows, the other 26 one search away (D2). Re-run the links test before shipping.

### 3.5 Video — the tab returns

- `ai-video-models` moves from `ENV_GATED` to `FEATURE_FLAGS: true`; the rail shows
  Video whenever sd-cli is the runtime (it already is for images).
- Short list from the existing catalog (`minVramGB / minRamGB` are the entries' own):

| Tier | Entry | Download | Does |
|---|---|---|---|
| Laptop 6 GB / 16 GB RAM | Wan 2.1 T2V 1.3B Q4 | 0.9 GB + umt5 | text → 480p, 5 s |
| 8 GB / 24 GB | Wan 2.2 TI2V 5B Q4 | 3.0 GB + VAE | text + image → 720p 24 fps |
| 12 GB / 32 GB | Wan 2.1 I2V 14B 480p Q4 | 10.2 GB + clip | image → video, high quality |
| 12 GB / 40 GB | LTX-2.3 Distilled 22B Q3 | 9.9 GB + 11 GB | audio + video, fast |
| 16 GB / 48 GB | LTX-2.3 Dev 22B Q4 | 12.7 GB + 11 GB | audio + video, 720p |

  Hidden from Recommended (still under All): Wan 1.3B Q8 (near-duplicate), LingBot
  Dense 1.3B (structured-prompt model), Wan 2.1 T2V 14B (D3: keep as a sixth?).
- **"Verified" is earned, not declared.** The dev laptop (RTX A3000, 6 GB) can run
  tiers 1–2; tiers 3–5 need the rented-GPU leg already pending for the AI runtime
  (`docs/gpu-cloud-testing-plan.md`). Each entry gets `verifiedOn` only after a
  real clip; the UI shows "Tested" on those and nothing on the rest.
- **Local video is a provider of the video engine, not a panel on this page** (D3,
  Hasan: "this is the intended use — in Videos, in agents, in Studio, in flows, like
  everything else"). The AI Models Video section manages models only, exactly like
  Image; `VideoGeneratePanel` leaves this page once the provider lands. Design:
  - `src/video-engine/providers/local-sd-video-provider.ts` implements
    `VideoProvider` (`submit` / `poll` / `cancel` / `getSupportedModels`) over the
    existing `runVideoCli` + `killActiveVideo` (`src/local-video-engine/
    video-cli-runner.ts`), one job at a time; `getSupportedModels()` lists the
    *ready* installed models and returns `[]` otherwise, so the provider is offered
    only when it can generate (the `LocalSdImageProvider` rule).
  - Registered with `videoEngine.registerInstance()` (the seam already exists in
    `video-engine.ts:93`) from `video-init.ts`, after the cloud providers so it never
    steals the active slot; re-registered when the video library rescans.
  - Everything upstream comes for free: the Videos screen lists "Local (open
    source)" through `useVideoProviders`; the Studio agent's `generate_video`, the
    Agents `generate_video` tool and the Flows video node all call the engine; the
    input-media gate and Gate B frame sampling apply to local output like any other;
    the usage row logs provider `local`, `costUsd: 0`.
  - Progress: sd-cli prints step progress; map it onto `VideoPollResult` so the job
    card fills like a cloud job.

### 3.6 Audio — whisper as one family

The Audio section adopts the template. Whisper is the family; its five sizes are the
entries; whisper.cpp is the runtime chip in the status strip; the default
transcription model is the section's Defaults row (D5). Cloud transcription
(AssemblyAI, ElevenLabs Scribe, OpenRouter whisper) is *not* on this page — a one-line
pointer under the strip: "Cloud transcription and sound generation use your provider
keys → Providers". The sherpa voice engine stays env-gated and, when on, appears as a
second family. Nothing in `useWhisper` or the whisper service changes.

### 3.7 OpenAI Codex subscription images (new provider)

**Facts (2026-09-16).** Codex CLI has a built-in image tool with `gpt-image-2` as
the default since April 2026; it runs in non-interactive `codex exec`; images are
billed to the ChatGPT plan (Plus / Pro / Business, not Free) and consume the plan's
Codex limits roughly 3–5× faster than a text turn; output lands in
`$CODEX_HOME/generated_images/` (`~/.codex/generated_images/`) unless the agent
copies it into its sandboxed working directory; a community wrapper reports 4–6 min
per image at default reasoning effort; `-i` attaches input images. Sizes on the
model: 1024², 1536×1024, 1024×1536, up to 4K (beta). Sources:
[Codex knowledge base](https://codex.danielvaughan.com/2026/04/27/codex-cli-image-generation-gpt-image-2-visual-development-workflows/),
[openai/codex imagegen SKILL.md](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md),
[gpt-image-bridge](https://github.com/oakplank/gpt-image-bridge),
[codex-imagegen-cli](https://github.com/jdmnk/codex-imagegen-cli).

**Route.** Drive the official CLI headlessly, exactly the `agy` pattern — never the
undocumented `chatgpt.com/backend-api/codex/responses` endpoint the second wrapper
uses (no stable contract, and it sidesteps the product). Files:

- `src/image-engine/providers/codex-cli-provider.ts` — type `'codex-cli'` takes the
  reserved second CLI slot in `ImageProviderConfig.type`; `getSupportedModels()`
  returns one entry, "GPT Image 2 (subscription)", only when the probe says ready;
  `registerInstance` from `image-init.ts` next to the Gemini one.
- `src/main/services/codex-cli.ts` + pure `codex-cli-protocol.ts` (tested): detect
  `codex` (PATH — npm global `%APPDATA%\npm\codex.cmd` — or `~/.codex/auth.json`),
  probe `codex login status` (cached 60 s, re-probed on window focus), generate with
  `codex exec --skip-git-repo-check -C <tmpdir> --sandbox workspace-write
  -c model_reasoning_effort=low --json "<pinned instruction>"`, harvest
  `<tmpdir>/out.png`, else the newest file written to `generated_images` after the
  start stamp (agy's non-recursive harvest rule). Concurrency 1 with a queue.
  Width/height → the nearest of the three sizes. Usage row: provider `codex-cli`,
  `costUsd: 0`. Timeout generous (10 min) until measured.
- Providers row (§3.2 group 2) with the install copy: `npm i -g @openai/codex`, then
  `codex login` in a terminal; the app detects and explains, never signs in.
- `useActiveImageProvider` adds `codex-cli` → "OpenAI Codex (subscription)".

**Spike — RUN 2026-09-16 on this machine (codex-cli 0.154.0, "Logged in using
ChatGPT", config model `gpt-6-astra`).** Three headless generations from a scratch
folder, `-c model_reasoning_effort=low --json`, stdin closed:

| Run | Ask | Wall time | Result |
|---|---|---|---|
| 1 | 1024² clapperboard, "save as out.png, run no commands" | 45 s (image at 39 s) | Image tool ran, file **1254×1254** PNG (940 KB) in `~/.codex/generated_images/<thread_id>/exec-<uuid>.png`; the agent could not copy it to the cwd because commands were forbidden — irrelevant, the app harvests from the thread folder |
| 2 | same, "landscape 1536×1024", `-s read-only`, `-o last.txt` | 38 s | **1536×1024** exactly; `last.txt` = `DONE`; 37 k input tokens (30 k cached), 0 reasoning tokens |
| 3 | edit run 1's file via `-i` (prompt first), "keep the composition, make it orange" | 45 s | 1254² PNG in its own thread folder; `DONE`; 41.6 k input tokens (32 k cached) — the reference costs ~4 k tokens on top |

What the spike settles for the build:

- **Harvest rule = thread folder.** The first JSONL event is
  `{"type":"thread.started","thread_id":"…"}`; the image is the newest
  `exec-*.png` under `$CODEX_HOME/generated_images/<thread_id>/`. No cwd copy, no
  sandbox write needed — `-s read-only` is enough (the tool writes outside the
  sandbox itself).
- **The tool call is invisible in `--json`.** The stream carries only
  `agent_message` items and `turn.completed` usage; proof of success is the file
  in the thread folder, not an event. `-o last.txt` gives the final message for
  the error path ("could not…").
- **Sizes are honoured** (1536×1024 came back exact); 1024² came back 1254² — the
  app treats the request as an aspect, not a pixel size, like agy.
- **Latency is ~40 s per image at low effort**, not the minutes the community
  wrapper reports (that was default/high reasoning). Concurrency 1 + queue holds.
- **Two spawn traps, both handled in `agy-cli.ts` already:** stdin must be closed or
  Codex reads it ("Reading additional input from stdin…"); and `-i <FILE>...` is
  greedy — a prompt placed after it is swallowed as a file path and the run exits 1
  with "No prompt provided via stdin". Prompt first, `-i` last.
- **Quota:** every run is a full agent turn on the plan (37 k input tokens, mostly
  cached, plus the image); the row's copy says so. Each run also creates a Codex
  thread the user will see in `codex resume`; try `--ephemeral` during P5 to keep
  app runs out of that list (check it still writes `generated_images`).
- Pin `codex --version` in the probe's detail; a Codex update can change any of
  this (the CLI's own README says the same about its internals).

## 4. Decisions (answered by Hasan 2026-09-16)

| # | Question | Decision |
|---|---|---|
| D1 | Left rail (§2) or keep the horizontal pills? | **Rail** ("go for it") |
| D2 | The eight image rows in §3.4 as the Recommended set, everything else under "All models" with search? | **Yes** |
| D3 | The five video rows in §3.5; where does local generation live? | **Five rows. Local video becomes a video-engine provider** so Videos, Studio, agents and flows all use it; the Generate panel leaves AI Models |
| D4 | Codex: spike on the `codex exec` route? Row names "OpenAI Codex (subscription)" / "Google Antigravity (subscription)"? | **Yes, run** — §3.7 |
| D5 | Audio keeps the default-model select in its Defaults row? | Keep (recommendation, not objected) |
| D6 | MiniMax / Kimi hidden through `V1_HIDDEN_PRESET_IDS` (a saved key keeps working; flag restores); OpenRouter keeps its Kimi / MiniMax model rows? | Yes / keep (recommendation, not objected) |
| D7 | `local` preset hidden unless the LLMs tab flag is on? | Yes (recommendation, not objected) |
| D8 | System → Overview with the Runtimes table and Storage; engine cards dropped? | Yes (recommendation, not objected) |
| D9 | Usage: rail entry, or a sub-tab under Providers? | Rail entry (recommendation, not objected) |

## 5. Work breakdown

| Phase | Scope | Size |
|---|---|---|
| P1 quick wins | full width; hide minimax / kimi / local; filter hidden presets out of the catalogs; Video flag on; `recommended` + tier fields on both registries | ½ session — **DONE 2026-09-16** (Status.md entry) |
| P2 shell + Providers | rail (or pills), key table, Subscriptions group with the Gemini card folded in, Defaults, catalogs accordion, Usage entry | 1 session — **BUILT 2026-09-16** (Status.md entry; live pass in P6) |
| P3 local-model template | shared template; Image (short list + All), Video (short list, Tested badge), Audio (whisper as a family), 3D adopts it | 1 session — **BUILT 2026-09-17** (Status.md entry; live pass in P6) |
| P3b local video provider | `LocalSdVideoProvider` over the sd-cli runner, `registerInstance` from `video-init.ts`, rescan re-registration, progress mapping, the Videos screen / Studio / agents / flows verified against it, `VideoGeneratePanel` removed from AI Models | 1 session — **BUILT 2026-09-17** (Status.md entry; the click test is P6's) |
| P4 Overview | Hardware · Runtimes table · Storage | ½ session — **BUILT 2026-09-17** (Status.md entry; live pass in P6) |
| P5 Codex provider | provider + service + protocol tests → Providers row → picker (the spike is done, §3.7) | 1 session — **BUILT 2026-09-17** (Status.md entry: `--ephemeral` verified, image still harvested; live pass in P6) |
| P6 verification | CDP screenshots at 1280×800 and 1920×1080 maximized per section; vitest for the pure bits; `check:types` at baseline; TESTING rows; video click test on the laptop tiers, the rest on the GPU-VM leg | ½ session — **RUN 2026-09-17** (§8 log; Status.md entry) |

Order: P1 → P2 → P3 → P3b → P4 → P5 → P6. P5 is independent of P2–P4 and can
run in parallel once P1 lands; P3b needs P3's `recommended` list only for its
picker order, nothing else.

## 6. Verification

- Driven over CDP (`docs/ui-automation-cdp.md`): every section screenshotted at
  1280×800 and maximized 1920×1080; no horizontal scroll; hidden presets absent from
  the Providers table, the catalogs accordion, the Studio agent picker and the Agents
  picker (all read `llmProvidersGet`).
- Unit: the hidden-set helper shared by `handleLlmProvidersGet` and
  `getProviderModelCatalogs`; `recommended` / tier derivation; the Codex protocol
  parser and harvest rule; the local-preset filter.
- Live: Google Antigravity row detects the installed `agy` here; Codex row detects the
  installed `codex`; one Codex image generated end to end from Image Studio with a
  `costUsd: 0` usage row; Wan 2.1 1.3B Q4 downloaded and a clip generated (the
  never-run click test).

## 7. Follow-ups logged, not in this pass

- Codex / Antigravity as LLM providers (the badge system is ready for it).
- HunyuanVideo 1.5, LTX-2.5 (needs an sd-cli bump), Wan 2.2 A14B (needs multi-file
  profiles) — research doc §3.2, once the five above are verified.
- Migrating audio / LLM / embeddings onto the shared model-library core (the
  Overview Storage row can only count what the core scans).

## 8. Verification log — P6, 2026-09-17 (this laptop: RTX A3000 6 GB, 64 GB RAM)

Driven over CDP (harness in the session scratchpad `p6/`; lessons appended to
`docs/ui-automation-cdp.md`). Every row is a TESTING row; "verified" means seen
in the running dev app, not inferred from code.

| Check (plan §6) | Result |
|---|---|
| Every section at 1280×800 (viewport emulation) and maximized 1920×991 inner | Overview · Providers · Usage · Image · Video · Audio · 3D · Content Safety all render; screenshots `1280-*.png` / `max-*.png` |
| No horizontal scroll | `document.documentElement.scrollWidth ≤ clientWidth` on every section at both sizes; the only elements wider than their box are Usage-table cells styled `truncate` (ellipsis, by design) |
| Hidden presets absent from the Providers table and the catalogs accordion | rows: fal · byteplus · openrouter · cloudflare · assemblyai · elevenlabs · claude-api · claude-subscription · gemini-cli · codex-cli; catalogs: claude-subscription · fal · byteplus · openrouter · cloudflare · claude-api — no openai / gemini / zai / minimax / kimi / local |
| Hidden presets absent from the Studio agent picker and the Agents picker | both read `llmProvidersGet`; `presets` = claude-subscription · claude-api · openrouter (no configs saved on this machine) |
| Google Antigravity row detects the installed `agy` | Ready — `%LOCALAPPDATA%\agy\bin\agy.exe`, signed in |
| OpenAI Codex row detects the installed `codex` | Ready · 0.154.0 — the native exe inside the npm global package, `codex login status` = Logged in using ChatGPT |
| One Codex image end to end with a `costUsd: 0` usage row | `imageGenerate({ providerId: 'codex-cli', 1536×1024 })` from the app: success in 28.7 s; usage row provider `codex-cli`, model `gpt-image-2`, `requestType: image`, `costUsd: 0`. (Submitted through the same IPC Image Studio uses, not by clicking the Studio.) `--ephemeral` trial outside the app: 38 s, image still written to `generated_images/<thread_id>/` |
| Overview: Hardware · Runtimes · Storage | Hardware rows GPU / VRAM 6 GB · 4.5 GB free / CUDA 13.0 / RAM 64 GB / Disk; Runtimes whisper.cpp Not installed (v1.8.3, Install), sd-cli, GPU encoder (ffmpeg) Installed 178 MB (Remove), AI Runtime Not installed (Install GPU runtime · 2.8 GB); Storage 0 models everywhere, folder `%APPDATA%\VidTSX Studio\ai-models` |
| Image · Video · Audio · 3D on the template | Image: sd-cli chip, Installed (empty state), Recommended 8, All models 34 collapsed, Image tools; Video: Recommended 5 with tier chips (Wan 1.3B Q4 "6–8 GB GPU · Fits"), All 8; Audio: whisper.cpp chip Not installed + Install, Defaults row (base, not downloaded), Installed 0, Recommended 3 (Base · Small · Large-v3), All 5; 3D: AI runtime chip, Installed 0, Recommended 1 (TripoSR) |
| Local video absent from the Videos picker until a model is ready | `videoProvidersGet` → `[]` before the download (no cloud key on this machine) |
| Wan 2.1 1.3B Q4 downloaded through the app | `sdVideoModelDownload`: model 866 MB + umt5 Q3_K_S 2.9 GB + VAE 254 MB at ~3.4 MB/s, all three finalized; rescan → installed, ready, fit `ok` |
| "Local (open source)" appears everywhere once a model is ready | `videoProvidersGet` → `local` "Local (open source)", active; `videoModelsGet('local')` → the Wan entry (2–5 s, 16:9 · 9:16 · 1:1, $0); Videos screen model select lists it (provider select hidden with one provider, as before); Flows `flowsNodesList` → `generate_video` available; Studio / Agents tools gate on the same engine |
| Wan 2.1 1.3B Q4 clip through "Local (open source)" — the never-run click test | **Completed and filed**: 2 s · 1:1 480×480 · 16 fps · VP8 webm 204 KB (`vid-1789627368632-9b620574.webm` in Video Studio), usage row provider `local`, `costUsd: 0`, `durationMs 1739231`. The path on this 6 GB card: attempt 1 out of memory at load (16 s) → rung 0 (weights offloaded, encoder on CPU) sampled 20/20 in ~4½ min at ~13 s/step (832×480 sampled at ~30 s/step in the earlier runs) then overflowed in the VAE decode → rung 1 (VAE on CPU too) re-sampled and decoded on the CPU (~16 min) → Gate B → filed. 29 min wall. A 16:9 832×480 clip takes the same ladder with a longer CPU decode (it ran past 25 min without finishing before the ladder existed and was not re-run to the end). `verifiedOn: 2026-09-17` now sits on the registry entry, so its row reads "Tested". |
| Job-card progress | Push events carried `step n/20` for every sampling step after the parser fix; the card itself was not screenshotted — the panel only draws cards for jobs it submitted, and the driver submitted through the IPC |

Findings fixed during the pass (all committed with P6): the video engine kept
the sd-cli path it initialized with, so an in-app sd-cli install after a first
Videos listing left "Local" empty until a restart (`refreshSdVideoBinary`); the
in-app sd-cli install is skipped when *any* sd-cli exists, and this laptop's
dev drop-in under `resources/binaries` was a lone exe without DLLs
(`0xC0000135` on start — moved aside, the app then installed the pinned
release in 13 s); Wan's umt5-xxl encoder expands to 5.9 GB in memory, so on a
6 GB card the first attempt is out of memory — the provider now climbs a retry
ladder under the same job (weights offloaded + encoder on CPU, then the VAE on
CPU too; an overflow in the decode jumps straight to that rung) and asks the
engine for a 3-hour ceiling, and the tracker cancels a provider's work when it
gives up; sd-cli's tensor-loader
progress bar (`76/242 - 2.36GB/s`) was parsed as sampling steps — the parser
now keys on the `s/it` rate.

Not verified: a clip on the 12 GB+ tiers (the rented-GPU leg), the Studio agent
and Agents `generate_video` calls themselves (their gating and model listing
were read through the engine they call), and Image Studio's own click path for
Codex (the IPC it submits on was).
