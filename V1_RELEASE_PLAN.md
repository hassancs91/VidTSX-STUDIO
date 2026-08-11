# V1 Release Plan — Pre-release cleanup & Providers restructure

> Working doc for the v1 public release tasks. Each phase is independently shippable and
> sized for one session. Update the checkboxes + "Session log" at the bottom as work
> progresses so any session can pick up where the last one stopped.
>
> Companion docs: `PLAN.md` (master architecture), `STATUS.md` (overall progress),
> `UI_SPEC.md` (visual language). This file supersedes nothing — it is the tactical plan
> for the 6 pre-release items only.

## Goals (from Hasan)

1. Local models must NOT run or load automatically on app start.
2. Hide the Tools page; show it in development via a `.env` value.
3. Hide Video, LLMs, 3D, and Embeddings sub-tabs from Local Models on the AI page.
4. Hide the Flows and Videos sidebar tabs; show them in development via `.env` (same mechanism as Tools).
5. Polish the AI Providers and Local Models (Images, Audio) pages — professional, clean, full-page width.
6. Restructure the AI Providers page: one unified section for API keys (one key per provider,
   used for all model types), plus per-provider editable model catalogs (defaults + add/remove/reset).

---

## Current-state map (verified 2026-08-11)

### Startup (main process) — what loads eagerly today

Everything runs inside `app.whenReady()` in `src/main/index.ts:110`, **before** `createWindow()` at `:185`:

| Line | Call | Cost at startup |
|---|---|---|
| `index.ts:142` | `initLLMEngine()` | Cheap — registers cloud providers + `local` preset. OK to keep. |
| `index.ts:145` | `initImageEngine()` | Cheap registration, but always registers `LocalSdImageProvider` (`image-init.ts:18,49`). |
| `index.ts:148` | `initAudioEngine()` | **Loads `sherpa-onnx-node` native addon** via `isSherpaAvailable()` (`audio-init.ts:17`, `src/audio-engine/audio-engine.ts:60`). |
| `index.ts:151` | `initSttEngine()` | Cheap — registers `local-whisper` provider, no spawn. OK. |
| `index.ts:154` | `initSdImageEngine()` | **Full disk scan** of image models folder (`sdimage-init.ts:21` → `scanImageLibrary()`) + restores active SD model metadata. |
| `index.ts:157` | `initVideoEngine()` | **Full disk scan** of video models folder (`sdvideo-library.ts:296`). |
| `index.ts:160` | `initLocalLlmEngine()` | **`await import('node-llama-cpp')` + `detectGpu()` → `getLlama({gpu:'auto'})` GPU probe** (`llm-local-init.ts:12,21`, `src/llm-engine/llm-local-engine.ts:19-28,89`). |
| `index.ts:183` | `tsxJobEngine.restore()` | **Can auto-`start()` persisted queued TSX jobs → spawns Claude Agent SDK / claude.exe processes at launch** (`tsx-job-engine.ts:149-162`). |
| `index.ts:199` | `initSystemMonitor(win)` | `nvidia-smi` every 2 s (`system-monitor.ts:19,64`). Low cost; out of scope unless trivial. |

Already lazy (no change needed): whisper.cpp spawn (`whisper.ts:322,451`), sd-cli runners,
embedding worker thread (`embedding-engine.ts:27`, spawned only on `EMBEDDING_LOAD_MODEL`),
Python detection (triggered by AI screen mount), module server (on demand).
Downloads restore as `paused` (`download-engine.ts:74-78`) — already correct.

### Navigation & feature flags

- Screen map: `src/renderer/App.tsx:18-30` (keep-alive rendering `:69-81`).
- Sidebar items: `src/renderer/components/Sidebar.tsx:32-46`; visibility filter `:90-94`.
- Flags: `src/shared/feature-flags.ts` — `isFeatureEnabled()` at `:39-43` returns
  `import.meta.env.DEV ? true : flag`. **Everything is visible in dev; no env override exists.**
- `src/renderer/routes.tsx` is a dead stub — nav truth lives in App.tsx + Sidebar.tsx + feature-flags.
- `.env` at repo root is **unwired** (no `loadEnv`, no `VITE_*` usage anywhere) and currently
  contains live secrets. See "Security cleanups" below.

### AI page (`ai-models` screen)

- Shell: `src/features/ai-models/components/AiModelsScreen.tsx:8` — content wrapped in `max-w-[760px]`.
- Sub-tab source of truth: `src/features/ai-models/types.ts:3-12` (`SUB_TABS`) —
  System, Providers, Audio, Image, Video, LLMs, 3D, Embeddings.
- Tab bar + content switch: `src/features/ai-models/components/AiModelsTab.tsx:15-67`
  (`RENDERED_TABS` at `:13`; 3D already falls through to `ComingSoonPlaceholder`).
- Prod gating today (via flags): `ai-video-models`, `ai-llm-models`, `ai-embedding-models` hidden in prod.

### Providers sub-tab (current)

- Container: `src/features/ai-models/components/providers/ProvidersContent.tsx:15` —
  2-column grid `:42-51`: "LLM Providers" (`ProviderSettings.tsx`) | "Image Providers"
  (`ImageProviderSettings.tsx`). **Split by model type — this is what item 6 removes.**
- API keys card: `providers/ApiKeysCard.tsx:13-38` — rows for `fal`, `openrouter`,
  `assemblyai`, `zai`. Renderer only sees booleans (good).
- Key storage: plaintext JSON in SQLite `app_settings` under `providerCredentials`
  (`src/main/services/settings.ts:264-284`). PLAN.md calls for `safeStorage` — not implemented.
- IPC: `PROVIDER_KEYS_GET/SAVE` (`src/shared/ipc/channels.ts:63-64`,
  `src/main/ipc/provider-keys-handlers.ts:25,38`; save re-runs engine inits `:46-48`).
- LLM presets: `src/engine/presets.ts:3-66` (claude-subscription, claude-api, minimax,
  openrouter, openai, gemini, zai, local). Hook `useLlmProviders.ts`.
- Image model lists are **triplicated**: `ImageProviderSettings.tsx:6-17` (`MODELS_BY_TYPE`),
  `src/image-engine/providers/fal-provider.ts:20`, `src/image-engine/providers/openrouter-provider.ts:20`
  (+ a third shape in `src/shared/presets/image-models.ts:7`).
- Cloud video reads the `fal` credential directly (`src/main/services/video-generation.ts:33-36`) —
  already "one key, all model types" on the backend; the UI just doesn't reflect it.
- STT provider config lives in the Transcription feature, not here (leave as is for v1).

---

## Phase A — Env-driven feature flags + hide pages/tabs (items 2, 3, 4)

> **STATUS: code complete (2026-08-11).** Implemented: `.env.example`, `src/shared/env.d.ts`
> (typed `VITE_FF_*` + `ImportMeta.env` for the check configs), rewritten
> `feature-flags.ts` (ENV_GATED map, no blanket DEV=on), `AiModelsTab.tsx` filters gated
> sub-tabs out of the tab bar, `App.tsx` guards `vidtsx:navigate` against hidden screens.
> `npm run check:types` at baseline (web 27 / node 22).
> **Remaining:** manual dev-run acceptance check (empty `.env` → hidden; `VITE_FF_TOOLS=1`
> → Tools back) — deferred because a parallel session was using the working tree.
> Note: real script names are `check:types` (no lint script); CLAUDE.md's `type-check`/`lint`
> are stale.

**Outcome:** Tools, Flows, Videos (video-studio), and the AI sub-tabs Video / LLMs / 3D /
Embeddings are hidden in ALL builds (including dev) unless explicitly enabled via `.env`.

### A1. Wire `.env` into electron-vite

- [ ] electron-vite already loads root `.env` files per Vite convention; renderer receives
      only `RENDERER_VITE_*` and `VITE_*` prefixed vars via `import.meta.env`. Verify with a
      probe log in dev, then delete the probe. No `envPrefix` config needed unless the probe fails.
- [ ] Create `.env.example` (checked in) documenting the flags:
  ```bash
  # Dev-only feature toggles — all default OFF. Never set these in a release build env.
  VITE_FF_TOOLS=0
  VITE_FF_FLOWS=0
  VITE_FF_VIDEO_STUDIO=0
  VITE_FF_AI_VIDEO=0
  VITE_FF_AI_LLM=0
  VITE_FF_AI_3D=0
  VITE_FF_AI_EMBEDDINGS=0
  VITE_FF_AI_AUDIO_ENGINE=0   # sherpa voice-engine section inside Audio tab
  ```
- [ ] Because `VITE_*` values are baked into the renderer bundle at build time, add a note in
      the release checklist: production builds must be made from a shell/env without these vars
      (or with them =0). `.env` is gitignored so CI/clean checkouts are safe by default.

### A2. Rework `src/shared/feature-flags.ts`

- [ ] Replace the blanket `import.meta.env.DEV ? true : flag` with per-flag resolution:
      - Each flag declares a default (`true` / `false`) and an optional env var name.
      - `isFeatureEnabled(flag)`: if the env var is set (`'1'`/`'true'`) → enabled;
        otherwise → the default. **Dev no longer force-enables anything.**
- [ ] Flag table for v1:
      | Flag | Default | Env override |
      |---|---|---|
      | `tools` | off | `VITE_FF_TOOLS` |
      | `flows-editor` (+ Flows nav item) | off | `VITE_FF_FLOWS` |
      | `video-studio` | off | `VITE_FF_VIDEO_STUDIO` |
      | `ai-video-models` | off | `VITE_FF_AI_VIDEO` |
      | `ai-llm-models` | off | `VITE_FF_AI_LLM` |
      | `ai-3d-models` (new flag) | off | `VITE_FF_AI_3D` |
      | `ai-embedding-models` | off | `VITE_FF_AI_EMBEDDINGS` |
      | `audio-engine` | off | `VITE_FF_AI_AUDIO_ENGINE` |
      | `studio-editor`, `license-ui`, others | keep current behavior — decide per flag while editing; do not silently change what v1 ships |
- [ ] This file is imported by renderer code only today; keep it renderer-safe
      (`import.meta.env` guarded) so nothing in `src/main/` breaks if it ever gets imported there.

### A3. Apply flags to nav + AI sub-tabs

- [ ] `Sidebar.tsx:32-46` / `:90-94` — confirm Tools, Flows, Videos rows respect the new flags
      (filter already exists; verify it covers all three and that no hidden screen is reachable
      via the `vidtsx:navigate` event in `App.tsx:40-49` — add a guard there if it is).
- [ ] `AiModelsTab.tsx:24-39` — hide Video, LLMs, 3D, Embeddings tab buttons behind their flags
      (today some render a ComingSoon placeholder; for v1 they should not appear at all).
- [ ] `App.tsx:18-30` — hidden screens must not be mounted/prefetched (keep-alive only mounts
      visited screens, so this should already hold; verify).
- [ ] Grep for direct navigation into hidden screens from visible ones (e.g. buttons that jump
      to Tools/Flows) and gate or remove them.

**Acceptance:** fresh `npm run dev` with empty `.env` → sidebar shows only TSX, Studio(?),
Images, Transcribe, Assets, AI, Queue; AI page shows only System, Providers, Audio, Image.
Setting `VITE_FF_TOOLS=1` and restarting dev brings Tools back. `npm run build:win` artifact
shows no hidden pages.

---

## Phase B — No local models load at startup (item 1)

**Outcome:** app start does zero native-addon loading, zero GPU probing, zero model-folder
disk scans, and never spawns AI processes. Engines initialize lazily on first real use.
Window appears faster as a side effect.

Pattern: give each engine an idempotent `ensureInitialized()` (memoized promise) called at
its IPC entry points, instead of init at `app.whenReady()`. Registration-only steps that are
genuinely cheap (registering a provider descriptor, mkdir) may stay at startup.

### B1. Audio engine (`src/main/services/audio-init.ts`)

- [ ] Remove the startup `isSherpaAvailable()` call (`audio-init.ts:17`) — this is what
      `require`s `sherpa-onnx-node` at boot (`audio-engine.ts:60`).
- [ ] Move addon load + availability check into a lazy `ensureAudioEngine()` invoked from the
      audio IPC handlers (availability query, TTS/voice ops). The AI page Audio tab already
      queries availability on mount — that becomes the first trigger, which is fine.
- [ ] Keep the models-dir mkdir at startup (cheap, harmless).

### B2. Local LLM engine (`src/main/services/llm-local-init.ts`)

- [ ] Remove startup `llmLocalEngine.isAvailable()` (dynamic-imports node-llama-cpp) and
      `detectGpu()` (`getLlama({gpu:'auto'})`) — `:12,21`.
- [ ] Lazy-init on first local-LLM IPC call. Tab is hidden in v1 (Phase A) so in practice
      this never runs for release users.

### B3. Local image models (`src/main/services/sdimage-init.ts`)

- [ ] Keep `registerImageCategory()` at startup (cheap registry entry).
- [ ] Defer `scanImageLibrary()` disk scan + active-model restore (`:21,41-43`) to first
      access: AI page Image tab mount, Image Studio local-generation panel, or any
      model-library IPC for the `image` category. Memoize so it scans once per session.
- [ ] Verify `LocalSdImageProvider` registration in `image-init.ts:18,49` is metadata-only
      (no fs/process work in its constructor). If it does work, make that lazy too.

### B4. Local video models (`src/main/services/sdvideo-init.ts`)

- [ ] Same treatment: keep category registration + mkdir, defer `scanVideoLibrary()`.
      Feature is hidden in v1, so lazy init means it simply never runs.

### B5. TSX job engine restore (`src/main/index.ts:183`)

- [ ] `tsxJobEngine.restore()` currently re-`start()`s persisted queued jobs → spawns
      Claude Agent SDK processes with no user action (`tsx-job-engine.ts:149-162`).
      Change restore to bring jobs back as **paused/queued-not-running**; user resumes from
      the Queue screen. Mirrors what `restoreDownloads()` already does for downloads.
      *(Decision needed — see Open questions Q3.)*

### B6. Verify & measure

- [ ] Add a one-line startup timing log (ready → window shown) before/after to confirm the win.
- [ ] Full manual pass: Transcribe (whisper download+run), Image Studio cloud + local generation,
      AI page System/Audio/Image tabs, downloads pause/resume, app quit disposes engines cleanly
      (`index.ts:202-249` `will-quit` must tolerate never-initialized engines — guard disposals).
- [ ] With dev flags ON, verify Video/LLM/Embeddings tabs still work end-to-end via lazy init.

**Acceptance:** process monitor shows no sherpa/llama/GPU activity and no model-folder reads
until the user opens a feature that needs them. No claude.exe spawns at launch.

---

## Phase C — Providers page restructure (item 6)

**Outcome:** one Providers experience: a single API-keys section (one key per provider,
powering every model type), and a model-catalog manager per provider. No more
"LLM Providers" vs "Image Providers" columns.

### Proposed UX (agreed direction — refine while building)

```
Providers (AI page sub-tab)                                [ Providers | Usage ]

┌─ API Keys ────────────────────────────────────────────────────────────────┐
│  fal            [Images] [Video]            key: ●●●● set    [Change] [×] │
│  OpenRouter     [Images] [LLMs]             key: not set     [Add key]    │
│  AssemblyAI     [Transcription]             key: ●●●● set    [Change] [×] │
│  Z.ai           [LLMs]                      key: not set     [Add key]    │
│  OpenAI / Gemini / MiniMax / Claude API …   (LLM presets — same table)    │
│  + Custom OpenAI-compatible endpoint…                                     │
└───────────────────────────────────────────────────────────────────────────┘
   One key per provider. Capability badges show everything the key unlocks.

┌─ Model Catalogs ──────────────────────────────────────────────────────────┐
│  fal — Images                 OpenRouter — Images        OpenRouter — LLMs│
│  ┌─────────────────────┐      ┌─────────────────────┐    ┌──────────────┐ │
│  │ flux/schnell        │      │ google/gemini-…     │    │ …            │ │
│  │ flux-pro/v1.1       │      │ …                   │    │              │ │
│  │ recraft-v3       [×]│      │                     │    │              │ │
│  └─────────────────────┘      └─────────────────────┘    └──────────────┘ │
│  [ + Add model id ]  [ Reset defaults ]        (per list)                 │
└───────────────────────────────────────────────────────────────────────────┘
   Lists seed from shipped defaults; add/remove freely; reset restores defaults.
   Every model picker in the app (Image Studio, tools, video) reads these lists.
```

Principles: key management is a flat scannable table (status at a glance); model curation is
a separate concern below it; capability badges (not page sections) express "this key powers
images + video + LLMs". Providers without editable catalogs (AssemblyAI) simply have no
catalog card.

### C1. Data model + persistence (main process)

- [ ] New settings entry `providerModels` in `src/main/services/settings.ts`:
      `{ [providerId: string]: { [category in 'image'|'llm'|'video']?: string[] } }`.
- [ ] Shipped defaults in ONE place: `src/shared/presets/provider-model-defaults.ts`
      (seed from the current `FAL_MODELS`, `OPENROUTER_MODELS`, LLM preset model lists).
- [ ] Service: `src/main/services/provider-models.ts` — get (merged with defaults on first
      read), save, resetToDefaults(providerId, category).

### C2. IPC

- [ ] Channels `PROVIDER_MODELS_GET / PROVIDER_MODELS_SAVE / PROVIDER_MODELS_RESET` in
      `src/shared/ipc/channels.ts`, types in `src/shared/ipc/types.ts`, handler
      `src/main/ipc/provider-models-handlers.ts`, preload exposure, register in
      `src/main/ipc/register.ts`. (Follow CLAUDE.md "Adding a new IPC channel".)

### C3. Engines read the store (kill the triplication)

- [ ] `src/image-engine/providers/fal-provider.ts:20` and
      `openrouter-provider.ts:20` — replace hardcoded model arrays with lists injected from
      `provider-models.ts` (via `initImageEngine`, re-run on save like keys already are).
- [ ] Delete `MODELS_BY_TYPE` from `ImageProviderSettings.tsx:6-17`.
- [ ] Reconcile `src/shared/presets/image-models.ts` and `video-models.ts` with the new
      defaults file — one source of truth; the others re-export or die.
- [ ] Model *selection* (which model is active for a task) stays where it's consumed
      (Image Studio panel, etc.) — pickers just read the curated list.

### C4. New UI (`src/features/ai-models/components/providers/`)

- [ ] `ApiKeysSection.tsx` — evolve `ApiKeysCard.tsx`: full-width table, capability badges,
      absorb the LLM preset providers (from `useLlmProviders`) and the custom-endpoint form
      (`CustomProviderForm.tsx`) so keys live in ONE section.
- [ ] `ModelCatalogSection.tsx` + `ModelCatalogCard.tsx` (one card per provider×category):
      list box, remove per row, add-by-id input with light validation, "Reset defaults" with
      confirm. Hook: `hooks/useProviderModels.ts`.
- [ ] Rewrite `ProvidersContent.tsx` as the two stacked sections; delete
      `ProviderSettings.tsx` / `ImageProviderSettings.tsx` once their remaining logic
      (active LLM provider selection) is rehomed — likely into the API-keys row expansion
      or a compact "Default LLM" control in the keys section. *(Q2 below.)*
- [ ] Keep the Providers | Usage inner tabs; Usage dashboard untouched.

### C5. Migration

- [ ] First run after update: if user had implicit hardcoded models, seeding defaults is
      enough (no user-curated data exists yet). No migration script needed beyond the
      defaults merge in C1. Verify existing saved keys + active LLM provider survive.

**Acceptance:** set a fal key once → both Image Studio cloud generation and (dev-flagged)
video generation work. Add a custom fal model id → it appears in Image Studio's model picker.
Remove it, reset defaults → back to shipped list. `npm run type-check` + `npm run lint` clean.

---

## Phase D — Visual polish: Providers + Local Models Images/Audio (item 5)

**Outcome:** the three v1-visible AI surfaces (Providers, Image, Audio) look professional,
consistent, and use the full page width.

- [ ] `AiModelsScreen.tsx:8` — drop `max-w-[760px]`; adopt a full-width layout with sane
      max (e.g. `max-w-6xl` or fluid with page-level padding per `UI_SPEC.md` layout rules).
      Applies to ALL sub-tabs — check System tab doesn't degrade.
- [ ] Define the shared visual kit for this page (aligned to `UI_SPEC.md` colors/spacing):
      section header pattern, card pattern, status badge (set/not-set, installed/available,
      downloading), consistent button hierarchy. Reuse existing shared components where
      they exist; do not invent a second design system.
- [ ] **Providers**: styling lands as part of Phase C build-out (C4) — full-width table +
      catalog card grid (responsive: 3/2/1 columns).
- [ ] **Image tab** (`ImageModelsContent.tsx`, `ImageLibraryHeader`, `InstalledModelsList`,
      `ProfileCatalogList`, `ModelSetupDialog`): align to the kit — clear split between
      "Installed" and "Available to download", progress states, empty states with a short
      explainer + CTA.
- [ ] **Audio tab** (`AudioTabContent.tsx`, `WhisperModelsSection.tsx`): same kit; whisper
      model list with size/status/download states; sherpa section stays env-flagged off.
- [ ] Empty/error states everywhere a list can be empty (no key set, no models installed,
      no GPU found).
- [ ] Screenshot pass at 1280×800 and maximized; light QA on long model names/overflow.

**Acceptance:** side-by-side before/after screenshots; no horizontal scroll at 1280 wide;
all three tabs visually consistent.

---

## Phase E — Release hardening & checklist

### Security cleanups (do these regardless)

- [ ] **Rotate the secrets currently sitting in root `.env`** (AssemblyAI, ElevenLabs,
      Gemini, Notion, Fal). The file is gitignored and unread by code, but the keys are live
      on disk; after rotating, strip it down to feature flags only (per `.env.example`).
- [ ] Consider `safeStorage` encryption for `providerCredentials`
      (`settings.ts:264-284`) as called for in `PLAN.md:398,476`. If deferred past v1,
      record it in STATUS.md "Known issues / tech debt". *(Q4.)*

### Final checklist

- [ ] `npm run type-check`, `npm run lint`, `npm run build:win`; install the artifact on a
      clean Windows profile.
- [ ] Cold-start check on the installed build: no model loads, no GPU probe, no spawned
      AI processes (Task Manager + startup log).
- [ ] Hidden surfaces absent in the artifact; env flags verified OFF in the build env.
- [ ] Update `STATUS.md` (v1 scope section at `:264` + tech-debt list) when phases land.

---

## Open questions (decide before/while building — defaults proposed)

- **Q1 — Env flag granularity:** plan uses per-feature flags (`VITE_FF_TOOLS`, …).
  Alternative: one `VITE_DEV_FEATURES=1` master switch. **Default: per-feature** (lets you
  demo one hidden feature without exposing all).
- **Q2 — Where does "active LLM provider" selection live** after the restructure? Proposed:
  compact "Default LLM provider" select at the top of the API Keys section. Alternative:
  move it next to where LLMs are used (TSX creator settings).
- **Q3 — TSX job restore behavior (B5):** restore queued jobs as paused (proposed) vs keep
  auto-resume. Auto-resume contradicts "nothing runs on start", but changes current behavior
  for existing users.
- **Q4 — safeStorage for API keys:** in v1 or deferred? Proposed: in v1 if it's a
  contained change to `settings.ts` (+ transparent migration of existing plaintext keys);
  defer if it drags.
- **Q5 — Sidebar order after hiding** Flows/Videos/Tools: keep remaining order as-is, or
  regroup? Proposed: keep as-is, zero-risk.

## Suggested execution order

A (flags/hiding, small & unblocks everything) → B (startup, isolated main-process work)
→ C (providers restructure, biggest) → D (polish, rides on C) → E (hardening/release).
A and B are independent and could be done in either order.

## Session log

| Date | Phase | What was done | Next step |
|---|---|---|---|
| 2026-08-11 | — | Plan created; codebase audited (file refs above verified). | Start Phase A. |
| 2026-08-11 | A | A1–A3 implemented (see STATUS note under Phase A); type-check at baseline. Incident: a `git stash` verification round-trip collided with parallel uncommitted Studio work — recovered everything; `stash@{0}` kept as backup because `EditorShell.tsx` on disk (no auto-cut wiring) diverges from the stashed copy (has auto-cut wiring) — reconcile before dropping the stash. | Dev-run acceptance check for Phase A, then Phase B. |
