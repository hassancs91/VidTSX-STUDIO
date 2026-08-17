# V1 Release Plan — Pre-release cleanup & Providers restructure

> Working doc for the v1 public release tasks. Each phase is independently shippable and
> sized for one session. Update the checkboxes + "Session log" at the bottom as work
> progresses so any session can pick up where the last one stopped.
>
> Companion docs: `PLAN.md` (master architecture), `STATUS.md` (overall progress),
> `UI_SPEC.md` (visual language). This file supersedes nothing — it is the tactical plan
> for the pre-release items only.

## Goals (from Hasan)

1. Local models must NOT run or load automatically on app start.
2. Hide the Tools page; show it in development via a `.env` value.
3. Hide Video, LLMs, 3D, and Embeddings sub-tabs from Local Models on the AI page.
4. Hide the Flows and Videos sidebar tabs; show them in development via `.env` (same mechanism as Tools).
5. Polish the AI Providers and Local Models (Images, Audio) pages — professional, clean, full-page width.
6. Restructure the AI Providers page: one unified section for API keys (one key per provider,
   used for all model types), plus per-provider editable model catalogs (defaults + add/remove/reset).
7. **Agent memory** — the Studio agent should get better at editing *your* videos over time by
   accumulating a small, inspectable set of preferences you told it. *(Added 2026-08-16.)*
8. **Narrow the V1 provider surface** to a small set we can actually support and learn from,
   with the rest re-enabled after feedback. *(Added 2026-08-16. Decided 2026-08-16: six
   `agent-sdk` presets — Claude ×2, Z.AI, MiniMax, OpenRouter, Kimi. See Phase H.)*
9. **In-app announcements feed** — a dismissible card fed from a static JSON on vidtsx.com,
   so Hasan can change in-app messaging (news, template drops, links to his sites) anytime
   without shipping a release. *(Added 2026-08-16. See Phase I.)*
10. **License + repo prep before going public** — FSL-1.1-MIT, CLA, Remotion note,
    "source-available" language. *(Decided 2026-08-16. See "Licensing & repo prep".)*

## Post-V1 backlog (recorded, not scheduled)

- **Gemini + OpenAI providers (V2).** Not preset rows — each needs a real
  tool-translation layer so the Studio agent's six in-process tools work, plus its own
  caching story. Likely dedicated SDKs rather than stretching `ProviderConfig`. Decide
  the shape when we get there; Phase H's "what this buys" note has the asymmetry.
- **Custom OpenAI/Anthropic-compatible endpoint form**, un-flagged (H5).
- **vidtsx.com relaunch (discussed 2026-08-16 — Hasan works on the site later).** Goals for
  this whole track are **email list, traffic, GitHub stars — explicitly not revenue for now**.
  No hosted APIs, no cloud rendering, no backend services (out of scope for a solo builder).
  - Download page on vidtsx.com (mirroring GitHub Releases) with *optional* email capture —
    never hard-gate the download; a lead magnet converts better than a gate.
  - Lead magnet: a **free template pack** ("N motion graphics templates for VidTSX — free,
    enter email"). Doubles as the seed of a later paid catalog.
  - **Monthly template drops** as the recurring touchpoint: one drop = email + YouTube video
    + tweet + changelog release. Paid packs/addons come much later, once the list is large
    (FSL makes Hasan the only party who can sell commercially in the ecosystem).
  - Free **client-side** web tools on vidtsx.com for SEO top-of-funnel (caption styler,
    browser template gallery via Remotion Player) — nothing that needs backend maintenance.
  - **Launch week, all in one week** (stars compound early; a staggered rollout wastes the
    spike): email the existing ~7k vidtsx.com users, YouTube video, Show HN
    ("Show HN: VidTSX — a free AI video editor with local models"), Product Hunt.
    README doubles as the landing page: demo GIF above the fold, 30-second feature list.
  - Upload the first `feed.json` (Phase I ships the client inert until the site has the file).
- **Skills tuning surface.** The agent's editorial judgment is an editable markdown file
  in a shipped build (`resources/skills/*/SKILL.md`, copied to `resources/skills` next to
  the .exe by `electron-builder.yml:32-33`), but a change needs an app restart and there
  is no UI. `clearSkillCache()` (`skills-registry.ts:206`) exists and is called by
  nothing; `SKILLS_LIST` IPC exists and is consumed only by the flagged-off Tools chat.
  A list/edit/save screen is wiring, not architecture. Pairs with moving workflow prose
  out of the hardcoded `studio-agent-prompt.ts` into the skill so more of the flow is
  tunable without a build. Full analysis: `AGENT_MEMORY_DESIGN.md` §Rev 2.9.

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

> **STATUS: DONE — verified & committed as `479fe4c` (2026-08-11).** Acceptance verified
> live: dev server injects no VITE_FF_* keys with an empty .env (all gated surfaces
> hidden), and a production build with VITE_FF_TOOLS=1 inlines `tools: "1"` into the
> renderer bundle (flag flips the feature on). Full-UI click-through was blocked by the
> single-instance lock (another dev instance was running) — the running app picks the
> same code up via HMR.
>
> Original implementation notes: Implemented: `.env.example`, `src/shared/env.d.ts`
> (typed `VITE_FF_*` + `ImportMeta.env` for the check configs), rewritten
> `feature-flags.ts` (ENV_GATED map, no blanket DEV=on), `AiModelsTab.tsx` filters gated
> sub-tabs out of the tab bar, `App.tsx` guards `vidtsx:navigate` against hidden screens.
> `npm run check:types` at baseline (web 27 / node 22).
> **Remaining:** manual dev-run acceptance check (empty `.env` → hidden; `VITE_FF_TOOLS=1`
> → Tools back) — deferred because a parallel session was using the working tree.
> Note: real script names are `check:types` (no lint script); CLAUDE.md's `type-check`/`lint`
> are stale. `.gitignore` got a `!src/shared/env.d.ts` exception (src/**/*.d.ts is ignored).

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

> **STATUS: code complete (2026-08-12).** All four engines lazy-init via memoized
> `ensure*()` functions in their init services, wired through a `lazily()` wrapper in
> `src/main/ipc/registrations/lazy.ts` at IPC registration time (audio, local-llm,
> sd-image, sd-video, and the cloud-image channels that serve the local provider).
> Startup registers only the image/video model-library categories (no scans). TSX jobs
> restore held (queued but not running) until the next user-initiated `start()`.
> Startup timing log added to `src/main/index.ts`. Type gate at baseline; tsx-job-engine
> tests pass (9/9). Before-evidence from the 2026-08-11 log: sherpa + node-llama-cpp
> init took ~8.6 s of startup plus a 4.4 s GPU probe.
> **Remaining:** live cold-start verification (blocked by the single-instance lock while
> another dev instance runs): fresh log must show no Audio/SdImage/SdVideo/LocalLLM init
> lines at boot, and AI-page tabs / Image Studio must lazily init on first use.
> Design decisions taken: Q3 resolved as "restore held"; llm-handlers'
> `handleLlmProvidersGet` still calls `llmLocalEngine.isAvailable()` on Creator mount —
> that imports node-llama-cpp's JS but does NOT probe the GPU or load native GGML libs
> (acceptable; absent module in packaged builds fails fast).

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

> **STATUS: code complete (2026-08-12).** Implemented as planned with these decisions:
> - **Catalogs cover image models only** (fal + OpenRouter). Video models keep their
>   code-curated catalog — each needs a bespoke request payload (video-payloads.ts), so
>   arbitrary user-added ids can't work. LLM default models stay free-text per provider.
> - **"One key unlocks the provider":** image providers register whenever their shared
>   BYOK credential (or legacy per-provider key) exists — the legacy `enabled` toggle is
>   gone from UI and registration (`image-init.ts`, `handleImageProvidersGet` now reports
>   presets merged with saved overrides, enabled ≡ hasApiKey).
> - Q2 resolved: "Default LLM provider" select lives in the unified section's footer.
> - Custom fal ids map to generic endpoints (`fal-ai/<id>`, `/edit` for image input,
>   `image_size` param); the three shipped models keep their rich defs. OpenRouter ids
>   are fully generic (chat/completions).
> - New: `shared/presets/provider-model-defaults.ts`, `main/services/provider-models.ts`,
>   PROVIDER_MODELS_GET/SAVE/RESET IPC, `useProviderModels`, `ApiKeysSection`,
>   `ModelCatalogSection`/`Card`, `CapabilityBadge`, `LlmProviderRow`. Deleted:
>   `ApiKeysCard`, `ProviderSettings`, `ImageProviderSettings`, `useImageProviders`.
> - Verified: type gate at baseline (web 26 / node 22), 139 unit tests pass, full
>   `electron-vite build` clean, new modules transform in the live dev server.
> **Remaining:** live UI walkthrough (blocked by single-instance lock — the running dev
> app's main process predates the new IPC; restart it to exercise the catalog flow), and
> the C-acceptance checks (add fal model → appears in Image Studio picker; reset works).

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

> **STATUS: code complete + CDP-verified (2026-08-13).** Kit decision: reuse the existing
> `@shared/components` library and add ONE new primitive — `StatusBadge` (tinted pill,
> tones success/warn/error/accent/info/neutral) — instead of a second design system.
> All ad-hoc status pills now route through it (key saved, sd-cli ready, Active, fit,
> Defaults/Customized, whisper Installed/Downloaded, Subscription/Custom); `Panel`
> replaces hand-rolled `bg-app-surface border` cards (0.5px borders per spec); raw
> `<select>`/`<input>` swapped for shared `Select`/`TextInput`; uppercase list headers
> (spec violation) → 11px muted headers; `FamilyBadge` deduped into its own component.
> Layout: screen cap 760px → `max-w-6xl mx-auto`; System tab 2-column at `lg:`
> (System+Library | Engines+Python); whisper Engine + Default-model cards side-by-side
> at `md:`; catalog grid 1/2/3-col; Image tab renamed to an explicit "Installed" /
> "Available to download" split with a real empty state.
> Verified: type gate at baseline (web 26 / node 22), 374 unit tests pass, CDP
> screenshots of all four tabs at 1188px and emulated 1280×800 — no horizontal scroll
> anywhere (scrollWidth === clientWidth probed per tab).
> **Remaining:** the Providers catalog-section visual + Phase C acceptance clicks need
> the restarted dev app (running main process predates the PROVIDER_MODELS IPC).

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

## Phase F — sd-cli install flow (local image generation is v1 scope)

> **STATUS: code complete (2026-08-13).** Implemented as planned:
> - `src/main/services/sdcli-install.ts` — pinned release URL + SHA-256
>   (`d7b6729c…1935`, hash computed from the upstream asset this session; byte size
>   matches the documented 37,696,851 exactly). Download runs through the download
>   manager (`id: 'sdcli-binary'`) with engine-side SHA-256 verify + full-zip extract
>   into `userData/sd-cli/` (matched-set rule); `sd-server.exe` deleted post-extract.
> - `getSdCliBinaryPath()` resolves `userData/sd-cli/` first, `resources/binaries/`
>   dev drop-in fallback. New `SDIMAGE_CLI_INSTALL` IPC + `installing` on CLI status;
>   after install the handler resets the memoized sd-image engine init so the new
>   binary is picked up without an app restart (video engine hidden in v1 — untouched).
> - UI: `SdCliSetupCard` on the Image tab when `!cliInstalled` (copy per plan, progress
>   via the global DOWNLOAD_PROGRESS broadcast, survives remount via downloadGetAll).
> - `missing-dll` classifier hint now points at the in-app Set up + VC++ redist link.
> - Cleanup done: the 17 committed DLLs removed from `resources/binaries` (nothing
>   else links them — verified: only sdimage-models uses getBinariesDir, libwebp only
>   appears in a comment); electron-builder filter now excludes `*.dll`/`sd-cli.exe`/
>   `sd-server.exe` so dev drop-ins never ship.
> - Verified: type gate at baseline (web 26 / node 22), 374 tests, full electron-vite
>   build clean. **Remaining:** live end-to-end install click (needs restarted dev app
>   — pairs with the Phase C walkthrough), then a real generation on the installed
>   engine.

Provenance (verified in `docs/local-image-models-implementation.md:318-338`): sd-cli IS
the official `leejet/stable-diffusion.cpp` release binary. Current pinned build on this
machine: release `master-778-c00a9e9`, asset `sd-master-c00a9e9-bin-win-vulkan-x64.zip`
(37,696,851 bytes). Vulkan backend = vendor-neutral GPU + built-in CPU fallback.
**Matched-set rule:** exe + ALL DLLs must come from the same zip.

- [ ] Constants: pinned release URL + SHA-256 in `src/main/services/sdcli-install.ts`
      (new service; pattern: `whisper.ts:172` `downloadWhisperBinary`).
- [ ] Download via the download manager → extract FULL zip to `userData/sd-cli/`
      (never mix DLLs across releases). Windows-only for v1 (same stance as whisper).
- [ ] `getSdCliBinaryPath()` (`sdimage-models.ts`) resolves `userData/sd-cli/` first,
      `resources/binaries/` fallback for dev drop-ins.
- [ ] IPC: SDCLI_INSTALL channel (+ progress via existing download broadcast);
      SDIMAGE_CLI_STATUS response gains an `installing` state if needed.
- [ ] UI: Image tab setup card when `!cliInstalled` — copy: "Local image generation runs
      on your GPU (~36 MB one-time engine download)" → Set up → progress → ready badge.
      Video tab shares binary/status automatically.
- [ ] Error mapping: missing VC++ redist hint (copy whisper's `whisper.ts:489` message).
- [ ] Cleanup: remove the committed ggml/stable-diffusion/webp/webm DLLs from
      `resources/binaries` + electron-builder extraResources once install flow lands
      (they're the same zip's contents; keeping them risks mixed DLL sets).
      First verify nothing else links `libwebp*/webm.dll` from that folder.
- [ ] Optional later: mirror the zip on a public repo release as fallback URL
      (upstream is rolling-release; pin + checksum covers v1).

## Phase G — Agent memory: the editor that learns how you work (item 7)

> **Full design: `docs/studio/AGENT_MEMORY_DESIGN.md` (M1–M8, plus §Rev 2).**
> This section is the tactical slice; the design doc holds the record shape,
> the prompt block, and the reasoning. Decisions 1–4 there are ANSWERED
> (Hasan, 2026-08-16).
>
> **Rev 2 (2026-08-16) — grilled with a spike before any code.** Four arms ×
> 3 runs on `claude-opus-5` through the real Agent-SDK options object:
> a memory block suppressed fluff cuts in **9/9** runs where the baseline
> proposed them in **3/3**, and forced a note format in **36/36** cut notes
> where the baseline managed **0/13**. `propose_memory` fired once on a general
> preference in **3/3** and stayed silent on a one-off in **3/3**. Citation
> works as prose (**9/9**) but is **not parseable into a signal** — so
> `lastCitedAt` is cut. Full evidence in the design doc §Rev 2.

The only product feature in this plan — the other six items are release
hygiene. It is here because "the app gets better the more I use it" is a v1
selling point, not a v2 nicety.

**Shape**: three tiers of memory (`rule` — imperatives the agent obeys;
`vocabulary` — proper nouns and their manglings; `profile` — durable facts
about the channel), app-wide by default with optional **brand** scope, read
by the **Studio editing agent only** in v1.

**Almost no new machinery.** `composeSystemPrompt` (`skills-registry.ts:164`)
already appends composed blocks to the agent's system prompt and the agent
already passes `skillIds` (`studio-agent.ts:92`) — memory is one more block.
`propose_memory` is a sibling of the existing `propose_cuts` / `propose_shots`
in-process tools, riding the agent event stream rather than a new channel.

**The load-bearing rule**: *nothing enters memory the user did not see and
accept.* Capture has two doors — you write it, or the agent proposes it and it
lands as a pending card you accept / edit / reject. **Silent inference is
rejected outright**, not deferred: a rejected cut plan is an ambiguous signal,
and guessing wrong writes a permanent rule from a misreading. This is the same
review gate as shot-plan, cut-plan and library organize.

**The value half is G1+G2+G5.** Arm B of the spike used a *hand-written* memory
block with no tool involved and got the entire measured behaviour change. G3+G4
make capture effortless; they do not make it work. Build in that order.

- [x] **G1. Store + types. DONE 2026-08-16.** `shared/types/studio-memory.ts`;
      `main/services/studio/agent-memory.ts` at `userData/studio/memory.json`,
      atomic tmp+rename (project-store precedent). *Not* the assets root —
      that holds content and is relocatable; memory is behaviour.
      **Rev 2**: no `lastCitedAt` field. `brandId` on the record, no UI.
      As built: `listMemories`/`upsertMemory`/`setMemoryActive`/`deleteMemory`;
      cap enforced in the store (create + re-activate paths); profile singleton
      (QM1) enforced on upsert; corrupt file set aside as `.corrupt`, never
      silently overwritten; provenance immutable on update.
- [x] **G2. Prompt composition (PURE). DONE 2026-08-16.** `agent-memory-prompt.ts`: scope
      filter → tier order (rules → vocabulary → profile) → char budget.
      Truncation drops profile first, then vocabulary; **rules are
      never silently dropped**. Unit-tested with no fs and no provider.
      **DECIDED**: budget **7000** chars / **50** rules (the original 2000/40 was
      arithmetically impossible — design doc §Rev 2.6; 50 because the two skills
      already inject 10,508 chars per turn, so a 7,000-char memory block is the
      smaller half of what already ships), and the block is appended **after** the composed
      skills, not folded into the base prompt — otherwise every memory edit
      re-writes 10.5 KB of skill text out of cache. Needs
      `composeSystemPrompt(base, skillIds, trailing?)`.
      As built: `composeMemoryBlock(memories, {brandId?, budget?})` returns
      `{block, droppedProfile, droppedVocabulary, rulesOverflowBy}`; ordering
      tier → createdAt → id (updatedAt proven irrelevant by test); trailing
      param added to `composeSystemPrompt` and threaded through
      `runLlmGenerate` via `extras.trailingSystemPrompt` (in-process only —
      the renderer can never inject trailing prompt text); `studio-agent.send`
      composes the block per turn (brand from the open project, failure never
      breaks a turn). 26 new tests incl. cache-stability byte-identity,
      budget coherence at the 50/7000 constants, and the block-after-skills
      ordering invariant (Rev 2.8).
- [x] **G3. `propose_memory` tool + pending queue. DONE 2026-08-17.** One
      proposal per turn, general preferences only ("I always want tight cuts"
      yes; "make this one shorter" no), never a duplicate of an active memory.
      Proposals persist until answered so navigation doesn't lose one.
      **Rev 2**: the prose policy tested clean untuned (3/3 and 0/3) — ship it
      as written in M2, don't redesign it.
      As built: `agent-memory-proposals.ts` in-memory queue in main (survives
      renderer navigation; ONE pending per project — the tool refuses a second
      until the user answers, so cards can't stack into reflex-rejection);
      `propose_memory` tool in `studio-agent.buildTools` with its own per-turn
      flag (independent of the cuts/shots review panel), server-side duplicate
      guard vs the active set, and text-limit check; M2's three policy bullets
      verbatim in `studio-agent-prompt.ts`; proposals ride the existing
      `STUDIO_AGENT_EVENT` stream as a new `memory-proposal` event kind.
- [x] **G4. Studio surface. DONE 2026-08-17.** Proposal card in the assistant
      panel, where the correction happened — accept / edit-then-accept /
      reject, with same-kind active memories shown inline so conflicts are
      visible. **Rev 2**: no "replaces →" picker — showing the list does the work.
      As built: `MemoryProposalCard` + `useMemoryProposals` (fetches pending
      on mount via `MEMORY_PROPOSALS_GET`, folds `memory-proposal` events in
      live); resolve via `MEMORY_PROPOSAL_RESOLVE` — accept stamps
      `{ by: 'agent', projectId, acceptedAt }` in MAIN from the queued
      proposal (kind is not renderer-editable; only text/aliases are), and a
      store refusal (rule cap) leaves the proposal PENDING so the user can
      make room and retry. M2's degraded-provider note ships: chat-only
      providers surface "your AI provider can't propose memories — add them
      yourself" in the MemoryDialog (via `toolsAvailable` from the last turn).
      10 new tests (queue semantics + all resolve paths); suite 766 green;
      gate at baseline.
- [x] **G5. Management surface — in Studio, not Assets. DONE 2026-08-17.**
      A `MemoryDialog` off the assistant panel: browse by tier, edit, toggle
      active, delete, with provenance. **Rev 2**: moved off the Assets screen
      (design doc M6 Rev 2) — memory is app state, not library content (M7's
      own argument), and the Assets toolbar is already Brands · Describe ·
      Organize · Refresh. `asset-library` stays untouched.
      As built: `MEMORY_LIST/SAVE/DELETE/SET_ACTIVE` channels →
      `memory-handlers.ts` (+ `registrations/memory.ts`) → `preload/api/memory.ts`
      → `window.api` (ElectronAPI mirror updated by hand). The save handler
      hardcodes `{ by: 'user' }` provenance — the request carries no source
      field, so the renderer cannot forge agent provenance (handler test).
      UI: Brain button in `AgentPanel` → `MemoryDialog` + `MemoryEntryForm` +
      `useAgentMemory`; sections ordered tier → createdAt → id so the list the
      user reads is the list the agent reads; G6 residue landed here (cap
      count + at-cap notice with add disabled, On/Off toggle, provenance line,
      profile as one free-text box per QM1). 8 new handler tests; suite 756
      green; type gate at baseline.
- [ ] **G6. Hygiene.** `MAX_ACTIVE_RULES` (50) — at the cap, accepting requires
      deactivating something; toggle-off rather than delete; **"applied
      because"** — the agent cites the memories it followed in its reply.
      **Rev 2**: citation is a user-facing trust feature only. No
      `lastCitedAt` stamp, no staleness pruning — the citations are prose and
      cannot be mapped to ids reliably (§Rev 2.3).
      **Update 2026-08-16: mostly absorbed.** The cap (create + re-activate
      paths) and toggle-off landed in the G1 store; citation needs no prompt
      work (the spike hit 9/9 with the plain M4 block). G6's residue is G5 UI
      affordances (cap message, toggle control, provenance display).
      **Update 2026-08-17: residue landed with G5** — nothing left in G6.
- [x] **G-spike. Dilution spike — RAN 2026-08-16, PASSED 6/6.**
      `.vidtsx-temp/spike/dilution-spike.mjs`, `claude-opus-5`, 3× control
      (2 rules, 571-char block) vs 3× diluted (42 rules — the two measured
      rules buried at positions 15 and 30 among 40 orthogonal fillers,
      3,314-char block, exact shipped-composer shape incl. preamble).
      Result: identical, perfect adherence in both arms — 0 fluff cuts,
      4/4 segment-numbered notes, correct brand spelling, citation present,
      every run. The diluted agent still listed would-be fluff spots in
      prose unprompted (arm-B behavior preserved). **The 50-rule cap holds
      at ~42 rules with no measurable dilution.** En route the harness
      exposed that the proven block carries an instruction preamble the M4
      sketch omitted — composer fixed to match (`b98aa4f`).
- [ ] **G7. Live CDP acceptance.** State a general preference → one proposal →
      accept → visible in the memory dialog with agent provenance → next turn
      **behaves** differently and says why → toggle off → the behaviour
      reverts → a one-off instruction produces NO proposal.
      **Rev 2**: assert behaviour, not citation, on the toggle-off leg.

**Explicitly out of v1** (M8): semantic retrieval (embeddings exist, but only
earn their cost past the budget), the STT vocabulary feed (no word-boost hook
exists in the transcriber today — real new scope, high value, separate slice),
and any reach beyond the Studio agent.

---

## Phase H — Narrow the V1 provider surface (item 8)

Ship fewer providers than the engine supports, so V1 has a support surface we can
actually stand behind, then re-enable the rest on feedback. Same instinct as Phase A's
hiding of Tools/Flows/Videos, applied to `src/engine/presets.ts`.

**Two facts settle which providers are worth keeping** (verified 2026-08-16):

| Preset | `type` | Agent SDK path | Prompt caching | Studio agent tools |
|---|---|---|---|---|
| `claude-subscription`, `claude-api` | `agent-sdk` | ✅ | ✅ automatic | ✅ |
| `zai` (Z.AI GLM) | `agent-sdk` | ✅ | ✅ automatic | ✅ |
| `minimax`, `openrouter` | `agent-sdk` | ✅ | ✅ automatic | ✅ |
| `openai` | `openai-compat` | ❌ | ❌ none | ❌ |
| `gemini` | `gemini` | ❌ | ❌ none | ❌ |
| `local` | `local` | ❌ | ❌ none | ❌ | 

1. **Caching is a property of the `agent-sdk` path, not of each provider.**
   `claude-provider.ts` calls `query()` from `@anthropic-ai/claude-agent-sdk`, which places
   cache breakpoints itself — the repo contains **no `cache_control` at all**, yet the
   Studio agent logs ~95% of input tokens as cache reads. Every `agent-sdk` preset
   inherits that; `gemini` / `openai-compat` / `local` get nothing and don't even report
   `cacheReadInputTokens`. So "compare caching across providers" has only **two** possible
   answers (agent-sdk: yes; everything else: no) no matter how many presets ship.
2. **Tools are `agent-sdk`-only** — `resolveToolSupport` returns
   `config.type === 'agent-sdk'` (`studio-agent.ts:124`). On `gemini` the Studio agent is
   built with no MCP server: no `propose_cuts`, no `propose_shots`, no
   `generate_tsx_shot`, and (Phase G) **no `propose_memory`**. It can still chat, and the
   non-agentic AI features (describe, organize, TSX generation) work fine.

> **DECIDED (Hasan, 2026-08-16) — read H1 first; it supersedes the framing below.**
> V1 ships **six `agent-sdk` presets and nothing else**: Claude ×2, Z.AI, MiniMax,
> OpenRouter, Kimi. `openai` and `gemini` move to V2, where they want dedicated SDKs
> or a real tool-translation layer rather than a preset row. The custom-endpoint form
> is flagged off (H5). Net effect: **one engine path in V1**, every provider with tools
> and caching, nothing shipped degraded — which cuts H3 almost entirely and makes H6
> (smoke-test each one) the only real remaining work.

> **Rev 2 (2026-08-16) — one verified fact reframes this whole phase.**
> **Hiding presets does not narrow the shipped engine surface.**
> `CustomProviderForm.tsx:9,37` lets any user create a provider with
> `protocol: 'openai-compat' | 'anthropic-compat'` against an arbitrary base
> URL, and C4 deliberately kept that form in the unified API-keys section. So
> **both compat engine paths ship in V1 whether or not the `openai` preset is
> visible** — and `anthropic-compat` isn't even in the table below. Hiding
> presets narrows the *supported, documented* surface (a real goal), not the
> *reachable code* (which is what "a support surface we can stand behind"
> sounds like it means). Decide which one you want; see H5.

- [x] **H1. Pick the set. DECIDED (Hasan, 2026-08-16): V1 is 100% `agent-sdk`.**
      Every shipped provider gets tools *and* prompt caching; no provider ships degraded.

      | Ship in V1 | `baseURL` | default model | status |
      |---|---|---|---|
      | `claude-subscription` | — (native) | `claude-sonnet-4-6` | exists |
      | `claude-api` | — (native) | `claude-sonnet-4-6` | exists |
      | `zai` (Z.AI GLM) | `https://api.z.ai/api/anthropic` | `glm-5.2` | exists |
      | `minimax` | `https://api.minimax.io/anthropic` | `MiniMax-M2.7` | exists |
      | `openrouter` | `https://openrouter.ai/api` | `anthropic/claude-sonnet-4-6` | exists — **verify, see H6** |
      | `kimi` (Moonshot) | `https://api.moonshot.ai/anthropic` | `kimi-k3` | **NEW — add preset** |

      **Deferred to V2**: `openai`, `gemini` (each wants a dedicated SDK / a real
      tool-translation layer, not a preset), and the custom-endpoint form (H5).
      `local` already self-hides when node-llama-cpp isn't loadable
      (`llm-handlers.ts:32`) — leave it exactly as is.

- [x] **H1a. Add the `kimi` preset — DONE 2026-08-16** (one entry in
      `PROVIDER_PRESETS`, exactly as predicted below; endpoint answers are H6's job).
      Original verification notes:
      Moonshot ships an Anthropic-compatible endpoint (`POST /anthropic/v1/messages`)
      specifically so Claude Code works against it unmodified. Confirmed 2026-08-16:
      base URL `https://api.moonshot.ai/anthropic`, model id `kimi-k3`, auth via
      `ANTHROPIC_AUTH_TOKEN`, and Moonshot explicitly requires `ANTHROPIC_API_KEY` to be
      unset because the two conflict.
      **Our `buildEnv()` already does exactly this** — `claude-provider.ts:71-89` sets
      `ANTHROPIC_BASE_URL`, forces `ANTHROPIC_API_KEY = ''` ("must be empty when using
      custom base URL") and puts the key in `ANTHROPIC_AUTH_TOKEN` whenever a `baseURL`
      is present. So Kimi is **one entry in `PROVIDER_PRESETS` plus a credential row** —
      no provider class, no engine branch, no new code path.
      (Sources: [platform.kimi.ai — Use Kimi in Claude Code](https://platform.kimi.ai/docs/guide/claude-code-kimi),
      [Kimi Code docs — Claude Code](https://www.kimi.com/code/docs/en/third-party-tools/claude-code.html),
      [MoonshotAI/Kimi-K2 #129 — canonical `/anthropic/v1/messages` reference](https://github.com/MoonshotAI/Kimi-K2/issues/129).)
- [x] **H2. Hide presets without stranding existing configs. DONE 2026-08-16.**
      As built: `V1_HIDDEN_PRESET_IDS = {openai, gemini}` filters `presets` only in
      `handleLlmProvidersGet`; saved configs never filtered (unit-tested); active
      pointer at a filtered preset with no saved config falls back to the first
      usable returned provider (renderer display only — main still reads settings
      unfiltered). Per-project `agent.providerId`: unknown ids render as
      "(unavailable — agent uses the app default)" via pure
      `buildAgentProviderOptions` (tested), and `studio-agent.send` now actually
      falls back to the app default for unregistered ids (+ threads the resolved
      id into `generate_tsx_shot`), so the label is honest. 8 new tests.
      **Rev 2 — the rule is
      one line: filter `presets`, NEVER `providers`.** The local filter at
      `llm-handlers.ts:32-38` filters *both* (its own comment says "and any stale saved
      config") — correct for `local`, which genuinely cannot run, and **exactly the bug
      to avoid here**. `handleLlmProvidersGet` returns three lists; only `presets` (the
      "add a new one" menu) may shrink.
      Two stranding vectors to close, one of them not previously named:
      - `llmActiveProvider` pointing at a hidden preset with no saved config → migrate
        to the first usable provider, mirroring `useActiveImageProvider`'s fix in
        `01d717c`. Note `resolveToolSupport` (`studio-agent.ts:118`) reads
        `getLlmProviders()` from settings **unfiltered**, so main keeps the truth — the
        divergence is renderer-only, which is why filtering in the handler is safe.
      - **Per-project `project.settings.agent.providerId`** (`InspectorPanel.tsx:187`).
        This is persisted per Studio project, and the Select's options come from
        `llmProvidersGet().providers.filter(p => p.enabled)`. If that list ever loses a
        provider a project still points at, the dropdown renders blank while the project
        keeps *sending* that providerId every turn — the UI and the run silently
        disagree. Following the filter-presets-only rule prevents this; add a test that
        an unknown/hidden `agent.providerId` renders as an explicit
        "(unavailable — using app default)" option rather than an empty select.
- [x] **H3. Say what a provider can't do, in the UI. — MOSTLY CUT by H1's decision.**
      With V1 100% `agent-sdk`, nothing shipped is degraded, so there is no warning to
      write and no half-available memory to explain. **Keep the code** — the no-tools
      branch in `buildAgentSystemPrompt` and `resolveToolSupport`'s
      `config.type === 'agent-sdk'` check stay exactly as they are; they are the correct
      fallback for an unknown config and they are what V2's Gemini/OpenAI work builds on.
      **Residual, one line**: a user who somehow ends up on a non-agent-sdk config (a
      grandfathered install, a hand-edited settings row) still gets a tool-less agent.
      The existing prompt branch already tells them so in chat. That is enough for V1 —
      this app has no released installs yet, so the grandfathered case is theoretical.
      Revisit when V2 re-introduces Gemini.
- [x] **H4. Re-enable behind a flag, not a rebuild. DONE 2026-08-16** —
      `VITE_FF_ALL_PROVIDERS=1` restores the hidden presets, read main-side in the
      handler (unit-tested via stubEnv); `VITE_FF_CUSTOM_PROVIDER=1` restores the
      custom form (H5). Both in `.env.example` + typed in `env.d.ts`.
      Original note: Hidden presets come back via the
      Phase A env-flag mechanism so a dev build can demo any provider without a release.
      **Verified 2026-08-16:** the preset filter lives in the MAIN process
      (`llm-handlers.ts`), and the shared `VITE_` prefix does reach main-process
      `import.meta.env` (precedent: `crash-reporting.ts` reads `VITE_SENTRY_DSN` in
      main), so the mechanism works there unchanged — read the flag in the handler,
      not in renderer `feature-flags.ts`.
- [x] **H5. Compat paths — DECIDED (Hasan, 2026-08-16): option (b), flag the
      custom-endpoint form off for V1. IMPLEMENTED 2026-08-16** — entry point gated
      behind `VITE_FF_CUSTOM_PROVIDER` in `ApiKeysSection`; already-saved custom
      providers still render and work (only NEW ones are gated). With H1 narrowing to six `agent-sdk` presets,
      `CustomProviderForm` (`CustomProviderForm.tsx:9,37`) would be the *only* way to
      reach `openai-compat` or `anthropic-compat` — i.e. the single remaining untested
      engine path in an otherwise uniform release. Flagging it off (Phase A mechanism,
      `VITE_FF_CUSTOM_PROVIDER`) makes V1 genuinely one code path with zero untested
      engines, and nothing to smoke-test beyond H6.
      Cost, stated: power users lose custom endpoints for one release. It returns in V2
      with `openai` and `gemini`. The form itself is untouched — only its entry point is
      gated, so re-enabling is a flag flip, not a rebuild of the feature.

      > **Update (Hasan, 2026-08-17): Z.AI is CUT from V1** — the shipped set is
      > five presets: Claude ×2, OpenRouter, MiniMax, Kimi. `zai` joined
      > `V1_HIDDEN_PRESET_IDS` (same grandfathering rule; returns via
      > `VITE_FF_ALL_PROVIDERS` or in V2).

- [~] **H6. Smoke-test every shipped provider once. (Rev 2 — new, and non-optional.)**
      **PRE-FLIGHT PASSED 2026-08-17 for openrouter + minimax; kimi functional
      with a caching caveat.** Headless spike (`.vidtsx-temp/spike/h6-provider-smoke.mjs`)
      mirroring `createSession()`'s routed path exactly (env-based baseURL +
      AUTH_TOKEN, no `model` in options, real skills + takes-view fixture,
      in-process MCP `get_transcript`/`propose_cuts`), keys from `.env`:
      - **openrouter PASS** — the suspect suffix-less `baseURL` DOES serve
        Anthropic-shape messages: text + both tools + 5 cuts, cache reads on
        both turns (13,905 t1 / 4,460 t2). The phase's biggest unknown is closed.
      - **minimax PASS** — text + both tools + 5 cuts, cache reads both turns
        (10,302 t1 / 3,691 t2).
      - **kimi FUNCTIONAL, caching unproven on multi-turn (2/2 runs)** — text +
        both tools + 5 good cuts every run, and turn-1 cache reads prove
        Moonshot's cache exists (hits on repeated identical requests), but the
        immediate turn-2 with the same system prefix reports 0 cache reads and
        an input count (~3.7k) that doesn't even cover the ~13k prompt — their
        `/anthropic` usage reporting may simply differ. Functional contract
        fully met; the economics leg is ambiguous, not failed. **Ship it** —
        hiding a working provider over an unproven usage report would trade a
        real feature for bookkeeping. Revisit if users report runaway Kimi costs.
      Remaining in-app leg (fold into the G7 live session): configure each key
      in the Providers UI and run one Studio agent turn per provider, confirming
      the ai-usage DB logs the run.
      The ai-usage DB is unambiguous: across 27 logged runs from 2026-08-11 to
      2026-08-16, **`claude-subscription` is the only provider that has ever executed in
      this app.** `zai`, `minimax`, `openrouter` and `kimi` are config assertions, not
      evidence — "typed `agent-sdk`" says the request will be *built*, not that the
      endpoint answers it. That is the same class of assumption this session already
      caught twice elsewhere.
      Per provider, before release: one Studio agent turn that (a) returns text and
      (b) successfully calls `get_transcript` + `propose_cuts`, and one check that
      `cacheReadInputTokens` comes back non-zero on the second turn.
      **`openrouter` is the one to test first** — its `baseURL` is
      `https://openrouter.ai/api`, with no `/anthropic` suffix, unlike every other
      routed preset. Either it exposes `/api/v1/messages` in Anthropic shape or the
      preset is wrong; nothing in this repo proves which.
      Any provider that fails H6 ships hidden and moves to V2. Better a set of four that
      works than six that were assumed.
      **Logistics (flagged 2026-08-16): H6 needs funded accounts + API keys for
      Z.AI, MiniMax, OpenRouter, and Kimi** — none has ever executed in this app.
      Hasan sets these up ahead of the test session so H6 isn't a release-day stall.

**What this does and does not buy.** It buys a smaller *supported* surface and a real
feedback loop — the honest reasons. It does **not** buy per-provider caching data
(fact 1); six `agent-sdk` presets are still **one** caching data point, not six.
~~If we also want the `openai-compat` engine path covered before scaling, `openai` is
the only preset that exercises it~~ — superseded twice: the custom form exercises it
too (Rev 2), and with H5 flagging that form off, no compat path ships at all.

**Why adding four providers is not "adding four providers."** `zai`, `minimax`,
`openrouter` and `kimi` are all the same code: `ClaudeProvider` with a `baseURL`, which
`buildEnv()` turns into `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`
(`claude-provider.ts:71-89`). They cost a preset row and a credential row each, and they
inherit tools, caching, thinking and the session pool for free. That asymmetry is the
whole reason `openai`/`gemini` are the ones deferred: those need a provider class, a
tool-translation layer, and their own caching story — days of work, not rows in an array.
Expect V2 to argue for dedicated SDKs there rather than stretching the preset shape.

---

## Phase I — Announcements feed (item 9)

**Outcome:** the app shows a dismissible announcements card (news, template drops, links to
Hasan's sites) whose content is a **static JSON file fetched from
`https://vidtsx.com/app/feed.json`** — no backend, no API, no release needed to change the
message. Upload a new file → every running app picks it up next launch.

**Why static-file over GitHub raw or an API** (discussed 2026-08-16): vidtsx.com is already
owned and will serve the auto-update feed anyway — one trusted domain for everything the app
phones. GitHub raw would make every copy change a public commit and caches ~5 min. An API is
maintenance/scaling burden for zero benefit; if fancier targeting is ever wanted, the static
file can be swapped for a dynamic endpoint without touching the app (the app only knows a URL).

**Implementation mirrors the updater pattern** (feed service in main → IPC → hook →
chip/card), so it should feel native next to `UpdateChip`/`useUpdater`.

### Trust rules (non-negotiable for a source-available app — auditors must come away *more* confident)

1. **Data only, never code or HTML.** JSON with plain-text fields + a URL, rendered into
   predefined card layouts. Nothing remote is evaluated or rendered as markup — a
   compromised feed can at worst show a weird sentence.
2. **Schema-validate and clamp in main**: cap string lengths, accept `https://` links only,
   open them externally via the existing shell-open IPC — never in the app window.
3. **Dismissible + opt-out**: every message has an `id`; dismissed ids persist locally and
   never reshow. Settings checkbox "Show news and announcements" (default on) turns the
   whole feature off.
4. **Polite fetch**: once per launch (or 24 h), cache last-good response, fail silently when
   offline/404. Plain GET, no query params, nothing about the user in the request.
5. **Disclose it**: one line in README/privacy — "On launch the app fetches
   `vidtsx.com/app/feed.json` to show announcements; no user data is sent; disable in
   Settings."

### Feed schema (v1)

```json
{
  "messages": [
    {
      "id": "2026-08-template-pack",
      "type": "announcement",        // announcement | tip | promo — styling hook only
      "title": "New: 20 free motion graphics templates",
      "body": "Grab the August template drop.",
      "url": "https://vidtsx.com/templates",
      "cta": "Get templates",
      "startsAt": "2026-08-20",      // optional — schedule campaigns by uploading once
      "endsAt": "2026-09-20",        // optional
      "minAppVersion": "1.0.0"       // optional — target by version
    }
  ]
}
```

### Tasks

- [x] **I1. Feed service — DONE 2026-08-16.** `shared/types/news-feed.ts`
      (renderer-facing message shape — raw feed JSON never crosses IPC),
      `news-feed-validate.ts` (PURE: clamps incl. 20-message array cap, https-only
      links with the CTA dropped alongside a bad url, date windows where an
      unparseable date drops the message, `compareVersions` returning NaN on junk,
      id dedup), `news-feed.ts` (once-per-launch memoized GET with 10 s timeout +
      256 KB body cap, atomic last-good cache that is RE-validated at serve time so
      expired campaigns die in cache too, `NEWS_FEED_URL` constant in one place,
      never throws). 16 tests. I2/I3 layer on `getNewsMessages()` once the updater
      session frees settings.ts/channels.ts.
- [x] **I2. Settings — DONE 2026-08-17.** `newsEnabled` (default true) +
      `newsDismissedIds` in the existing settings service; dismissed list
      capped at 200 (oldest dropped — long-expired ids anyway).
- [x] **I3. IPC — DONE 2026-08-17.** `NEWS_GET` (validated messages minus
      dismissed; empty when disabled, and disabled means NO fetch at all —
      off = the app doesn't phone), `NEWS_DISMISS`, plus `NEWS_SET_ENABLED`
      (the I5 toggle needs a write path; kept cohesive with the news channels
      rather than growing the SETTINGS_* surface). 6 handler tests.
- [x] **I4. UI — DONE 2026-08-17.** `useNews` + `NewsCard` mounted app-level
      in `App.tsx` beside `CaptureChip` (the default screen is Creator, not a
      start screen — app-level chrome shows regardless of screen and touches
      no feature module). Bottom-right toast idiom, type-colored left accent,
      one message at a time (dismissing reveals the next), CTA opens
      externally via the existing shell-open IPC. StatusBar unread chip
      skipped — the card already is the unobtrusive surface.
- [x] **I5. Settings toggle — DONE 2026-08-17.** Self-contained `NewsRow`
      (UpdateSection precedent) under Settings → General → Privacy.
- [x] **I6. README disclosure — DONE 2026-08-17.** "Launch-time network
      requests" section covering BOTH fetches (update check + feed) plus the
      provider/binary-download carve-out, above the crash-reporting section.

**vidtsx.com isn't ready yet — that's fine.** The site work is post-V1 (see backlog); the
client ships inert (404/offline → silently nothing) and lights up whenever the first
`feed.json` is uploaded. That's why this can land in V1 without any site dependency.

**Acceptance:** point the URL constant at a local test file → card renders; dismiss persists
across restart; Settings toggle hides everything; offline/404/garbage JSON → silent, no
errors surfaced; a message with `endsAt` in the past never renders; link opens in the
default browser, not in-app.

---

## Licensing & repo prep (item 10 — decided 2026-08-16, must land before the repo goes public)

**License: FSL-1.1-MIT** (Functional Source License — Sentry's, also used by GitButler).
Free to use/modify/fork including for commercial video work; nobody may build a competing
product/service from the code; each release auto-converts to **MIT after 2 years**. Chosen
over: BUSL (heavier, corporate), n8n's Sustainable Use License (more restrictive),
Elastic 2.0 (aimed at SaaS protection, wrong fit for a desktop app), PolyForm Noncommercial
(would technically forbid freelancers editing client videos — avoid). Full rationale in
`PLAN.md` § "Source license".

- [x] Add `LICENSE.md` — DONE 2026-08-16: verbatim FSL-1.1-MIT template fetched from
      the canonical getsentry/fsl.software repo, copyright 2026 Hasan Aboul Hasan.
- [x] README language — DONE 2026-08-16: "free and source-available", fair-source
      framing with the "why not open source" note, MIT-after-2-years stated. Also
      fixed en route: the stale `[MIT](LICENSE)` footer, an "open source" claim, a
      **`safeStorage` encryption claim that isn't true yet** (Q4 open — keys are
      plaintext today; restore the claim if/when Q4 lands), the provider list
      (OpenAI/Gemini/custom removed per H2/H5, Kimi added), the "visible as
      previews" line (Phase A hid them), and a PLAN.md link (private post-flip).
- [x] README Remotion note — DONE 2026-08-16 (≤3-person rule, licenses-the-user
      point, link to remotion.dev/license). Still to do pre-launch: talk to the
      Remotion team — they actively promote apps built on Remotion.
- [ ] CLA via cla-assistant (GitHub app, ~5 min setup) **before merging any outside PR**,
      so relicensing rights are retained. Cannot be added retroactively.
- [ ] Keep the non-forkable identity under Hasan's control: the VidTSX name, vidtsx.com,
      the update feed, and the announcements feed (Phase I). Trademark registration is a
      later, optional step — note it and move on.
- [ ] **DECIDED (Hasan, 2026-08-16): prune before the flip — the public repo starts
      fresh.** V1 goes out as a single initial push (re-rooted, no history), and all
      private docs and plans are gitignored in the public repo. This repo stays
      private forever, keeping the full history and the versioned working docs, so
      parallel sessions keep working exactly as today. (Context: verified 2026-08-16
      that no secrets exist anywhere in history — the prune is positioning, not
      security.) Mechanics at flip time:
      - [ ] **Triage the tracked .md set.** Private (excluded + gitignored in the
            public repo): all root-level working docs — `V1_RELEASE_PLAN.md`,
            `PLAN.md`, `Status.md`, `UI_SPEC.md`, `BUGS.md`, `DESIGN_PLAN.md`,
            `CAPTION_STYLES_PLAN.md`, `FLOWS.md`, `STEP-3.2b-WRAPPER-GENERATION.md`,
            `llm-engine-spec-v2.md`, `mac-check.md`, `my_notes.md` — plus the whole
            `docs/` tree (plans, design docs, release checklists). Public:
            `README.md`, `LICENSE.md`, `resources/skills/**` (app content, ships in
            builds), `src/main/services/download-manager/README.md` (code-adjacent),
            vendored license files. Anything borderline defaults to private — it can
            be published deliberately later; it cannot be unpublished.
      - [ ] **`CLAUDE.md` references break.** It opens with "Read PLAN.md /
            UI_SPEC.md / STATUS.md first" — all private post-flip. Either keep
            `CLAUDE.md` private too (and ship a public `CONTRIBUTING.md` later) or
            rewrite it standalone. Default: private.
      - [ ] **Flip procedure:** finalize v1 in this private repo → new empty public
            repo → copy the working tree minus private docs → add the private-docs
            section to the public `.gitignore` (so a future `git add -A` in a public
            clone can never re-add them) → single initial commit, tag `v1.0.0` →
            push public.
      - [ ] **Post-flip workflow (small open question, decide at flip):** where
            day-to-day work happens once outside PRs arrive — keep developing here
            and sync releases out, or develop in the public repo with private docs
            on disk untracked (they lose git versioning there; this private repo
            can remain their archive).

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

- [ ] `npm run check:types` (the real gate — `type-check` and `lint` scripts do NOT
      exist; baseline-checked via `scripts/check-types.mjs`), `npx vitest run`,
      `npm run build:win`; install the artifact on a clean Windows profile.
- [ ] Cold-start check on the installed build: no model loads, no GPU probe, no spawned
      AI processes (Task Manager + startup log).
- [ ] Hidden surfaces absent in the artifact; env flags verified OFF in the build env.
- [ ] `LICENSE.md` (FSL-1.1-MIT) present; README says "source-available" (not "open source")
      and carries the Remotion note + the feed disclosure line (I6).
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
- **Q6 — Agent memory (G) vs the release date:** G is the one *feature* in an otherwise
  hygiene-only plan, and it is the largest remaining item. If the release date tightens,
  G1+G2+G5 (store, prompt composition, manual entry) still ship a real
  "preferences the agent follows" feature; G3+G4 (agent-proposed capture) are what make it
  *learn*, and are the half to defer. ~~Proposed: ship G whole — the learning half is the
  selling point~~
  **ANSWERED Rev 2 (2026-08-16), and the framing was backwards.** The spike separates
  *value* from *narrative* cleanly:
  - **All of the measured behaviour change comes from G1+G2+G5.** Arm B injected a
    hand-written block and got 9/9 fluff suppression, 36/36 note-format compliance and
    3/3 citation — with no `propose_memory` tool in the run at all. Injection is the
    product.
  - **G3+G4 is convenience, not capability.** It works (3/3 correct, 0/3 false
    positives, untuned), and it is what makes the feature *feel* like learning rather
    than like a settings page. That is a real marketing difference and a small
    engineering one — a tool definition plus one card.
  - **So: what does V1 lose if memory ships in V1.1?** Nothing structural. Every other
    item in this plan is hygiene, and none depends on G. What V1 loses is its only
    reason for an existing user to notice the release. That is a positioning cost, not
    a technical one, and it is Hasan's call — but it is now a call made against
    evidence rather than a guess about whether the feature works.
  - **Recommendation: ship G1+G2+G5 in V1 as non-negotiable, and G3+G4 in V1 if H and E
    are on schedule when G lands.** The pressure valve stays, but it is now cutting the
    cheap half rather than the valuable one.
- **QM1 / QM2** — ~~two smaller open questions~~ **both answered in Rev 2** of
  `docs/studio/AGENT_MEMORY_DESIGN.md`: profile is one free-text box (QM1);
  QM2 is moot because `lastCitedAt` is cut.

## Suggested execution order

A (flags/hiding, small & unblocks everything) → B (startup, isolated main-process work)
→ C (providers restructure, biggest) → D (polish, rides on C) → F (sd-cli install flow,
pairs naturally with D's Image-tab polish) → **G (agent memory)** → **H (narrow the provider surface)**
→ **I (announcements feed — small, independent, mirrors the updater; can slot anywhere after
the updater work)** → **Licensing & repo prep** (files + README, zero code risk, must precede
the public repo) → E (hardening/release).
A and B are independent and could be done in either order.

**Rev 2 note on ordering**: G's spike is done, so G1→G2 can start cold. H2's
filter-presets-only rule and H5's compat-path decision are independent of G and could be
taken any time; only H3's copy needs G's degradation to be real.

H comes after G on purpose: Phase G is the thing whose provider behaviour differs most
(agent-proposed capture needs `agent-sdk` tools), so pick the shipping set once memory
exists and its degradation on `gemini` is visible rather than predicted. H is small and
could slip to just before E if G runs long.

G sits late but before E on purpose: it is the only item that changes product behaviour, so
it wants the most soak time before the release checklist — but it depends on nothing in
A–F, so it can move earlier if the Studio agent work is fresh in mind. Within G, G1→G2 are
the foundation (store + pure prompt composition) and G3→G4 are the half that makes it learn.

## Session log

| Date | Phase | What was done | Next step |
|---|---|---|---|
| 2026-08-11 | — | Plan created; codebase audited (file refs above verified). | Start Phase A. |
| 2026-08-11 | A | A1–A3 implemented (see STATUS note under Phase A); type-check at baseline. Incident: a `git stash` verification round-trip collided with parallel uncommitted Studio work — recovered everything; `stash@{0}` kept as backup because `EditorShell.tsx` on disk (no auto-cut wiring) diverges from the stashed copy (has auto-cut wiring) — reconcile before dropping the stash. | Dev-run acceptance check for Phase A, then Phase B. |
| 2026-08-11 | A | Verified (dev-server env injection OFF-state + prod build with VITE_FF_TOOLS=1 inlines the flag) and committed as `479fe4c`. | Phase B. |
| 2026-08-12 | B | Implemented lazy engine init + held TSX-job restore (see STATUS note under Phase B). | Live cold-start check once the running dev instance closes; then Phase C. |
| 2026-08-12 | B | Cold start verified live: 306 ms main init (was ~13.7 s), zero engine loads, lazy sd-image init fired on Image-tab click. Committed `76a0ca2`. | Phase C. |
| 2026-08-12 | F | Planned sd-cli install flow (upstream zip, whisper-style). Committed `b5e652a`. | Implement after D. |
| 2026-08-12 | C | Providers restructure implemented + statically verified (see STATUS note under Phase C). | User restarts dev app → live walkthrough of keys section + catalogs; then Phase D polish. |
| 2026-08-13 | D | Visual kit (`StatusBadge` + Panel/Select/TextInput adoption), full-width `max-w-6xl` layout, 2-col System tab, Image installed/available split, Audio side-by-side cards. Type gate + 374 tests green; CDP screenshot sweep at 1188 + 1280×800, no h-scroll. Committed `ec498a2`. | Phase F (sd-cli install flow); Phase C walkthrough still pending app restart. |
| 2026-08-13 | F | sd-cli install flow implemented (see STATUS under Phase F): pinned+hashed upstream zip via download manager → userData/sd-cli, SDIMAGE_CLI_INSTALL IPC, Image-tab setup card, DLL cleanup from resources/binaries. Type gate/tests/build green. | After app restart: Phase C acceptance walkthrough + live sd-cli install click + a real local generation. Then Phase E (hardening). |
| 2026-08-16 | G | Agent memory added to v1 scope (item 7) and designed with Hasan — full design in `docs/studio/AGENT_MEMORY_DESIGN.md` (M1–M8). Four decisions answered: gated capture (manual + agent-proposed, silent inference rejected), app-wide scope with optional brand, all three tiers (rule/vocabulary/profile), Studio agent only. Rides existing seams: `composeSystemPrompt` for injection, `propose_memory` as a sibling of `propose_cuts`/`propose_shots`, the shot/cut-plan review gate for capture. Nothing implemented yet. | Implement G1 (store + types) → G2 (pure prompt composition). |
| 2026-08-16 | G+H | **Design session only — no feature code.** Grilled both plans and revised them (`AGENT_MEMORY_DESIGN.md` §Rev 2, Phase G/H/Q6 above). Ran a 12-run spike through the real Agent-SDK options object on `claude-opus-5`: injection changes behaviour decisively (fluff cuts 2,2,2 baseline vs 0×9 with memory; note format 0/13 vs 36/36), `propose_memory` triggers 3/3 on general preferences and 0/3 on one-offs, citation works as prose 9/9 but is unparseable to ids. Verified in code: Studio agent passes no `sessionScope` so there is no hot session to evict; the SDK exposes no mid-conversation system message (`SDKUserMessage` is `MessageParam`); a string `systemPrompt` is taken verbatim; `composeSystemPrompt` puts skills *after* base so memory must be appended last. **Cut**: `lastCitedAt` + staleness pruning, brand-scope UI, the Assets memory section (→ a Studio dialog), the "replaces →" picker, profile-as-list. **Fixed**: budget 2000/cap 40 didn't fit → 4000/25. **New H finding**: `CustomProviderForm` ships both compat engine paths regardless of preset hiding (H5). | Implement G1 (store + types) → G2 (pure prompt composition, block appended last). |
| 2026-08-16 | I + licensing | **Strategy session with Hasan — plan updates only, no code.** Direction set: goals are **email list, traffic, GitHub stars — no revenue work now**; no hosted APIs/cloud rendering (solo scope); learnwithhasan API integration is out, site is **vidtsx.com** (~7k existing users). License decided: **FSL-1.1-MIT** + CLA + "source-available" language + Remotion README note (new section above + `PLAN.md` § Source license). Announcements feed designed and added as **Phase I** (static `feed.json` on vidtsx.com, updater-pattern client, trust rules). vidtsx.com relaunch work (download page w/ optional email, free template-pack lead magnet, monthly drops, client-side web tools, one-week launch) recorded in the post-V1 backlog. | Implement G1 (store + types) → G2 (prompt composition). Phase I can slot in anytime. |
| 2026-08-16 | G | **G1+G2 implemented.** Store (`agent-memory.ts` at `userData/studio/memory.json`, atomic write, cap + profile-singleton enforcement, corrupt-file set-aside), pure composition (`agent-memory-prompt.ts`, tier → createdAt → id, profile-then-vocab truncation, rules never dropped), `composeSystemPrompt` trailing param, injection wired into `studio-agent.send` via `extras.trailingSystemPrompt` (block appended after skills). 26 new tests; full suite 709 green; type gate at baseline (web 26 / node 22). Injection is live but inert until G5 gives memories a way to exist. | G5 (manual entry + MemoryDialog in Studio) — the remaining piece of the value half; then G3+G4 (propose_memory + proposal card). |
| 2026-08-16 | G (grill) | **Adversarial review of G1+G2 + the remaining plan; 3 confirmed defects fixed with regression tests.** D1: truncation could emit a bare header block and silently vanish an oversized profile (now returns empty + truncation logged in studio-agent). D2: concurrent upserts lost records — read-modify-write race (mutations now serialized through a queue). D3: multi-line text broke the block's markdown list / could fake a `###` section (whitespace collapsed in store AND composer; profile keeps paragraphs). Also: fixed-epoch backfill for hand-edited records missing timestamps (determinism), per-kind text limits + alias cap (`MEMORY_TEXT_LIMITS`), 7 new tests (33 total for memory). Plan updated: dilution spike now an explicit G checkbox; G6 marked mostly-absorbed; H4 main-process flag mechanism verified; H6 keys logistics flagged; I1/I6 small print; licensing gains the "what goes public" decision (history verified secret-free); Phase E checklist commands corrected (`check:types`, no lint). | G5 after the updater session lands its dirty files (channels.ts, preload, settings.ts, StatusBar all collide). Hasan: H6 keys + the public-docs decision. |
| 2026-08-16 | G-spike + H | **Dilution spike PASSED 6/6** (control vs 42-rule diluted block on `claude-opus-5`: 0 fluff cuts, 4/4 `#N` notes, brand + citation, both arms — the 50 cap holds; composer preamble gap found+fixed en route, `b98aa4f`). **Phase H code complete minus H6**: `kimi` preset (H1a), preset narrowing to the six agent-sdk rows with filter-presets-only + active-pointer fallback + per-project "(unavailable)" option + studio-agent default fallback (H2), `VITE_FF_ALL_PROVIDERS` / `VITE_FF_CUSTOM_PROVIDER` flags (H4/H5). 8 new tests; suite 724 green; type gate back at baseline after adding the two env vars to `env.d.ts`. | H6 smoke tests once Hasan has the four provider keys. G5 after the updater session lands. |
| 2026-08-16 | Licensing + I1 | **LICENSE.md landed** (verbatim FSL-1.1-MIT from getsentry/fsl.software, © 2026 Hasan Aboul Hasan) + README rewritten honest: "free and source-available" + fair-source note, MIT-after-2-years, Remotion ≤3-person note; fixed stale claims (MIT footer, "open source", unimplemented safeStorage encryption claim, V1 provider list, hidden-previews line, PLAN.md link). **Phase I1 feed service built + tested** (pure validator + once-per-launch fetch with re-validated last-good cache; 16 tests). Suite 740 green, gate at baseline. | I2–I5 wiring + G5 once the updater session lands; CLA setup + Remotion-team outreach at flip time. |
| 2026-08-17 | Updater landed | **Verified + landed the parallel updater session's work** (`9117a19`): reviewed all 28 files against its own plan (docs/auto-update-plan.md — Phases A–D complete), confirmed the will-quit race fix, ran suite (740 green), type gate (baseline), and a clean production build. Vendor-file line-ending noise dropped; `my_notes.md` left untracked. Cosmetic gap noted: toast has no "Later" action so `updateSkippedVersion` is UI-unreachable. **License reconciled to FSL-1.1-MIT everywhere** (`ab4bb3b`): package.json SPDX id, LICENSE.txt (NSIS EULA) now FSL, duplicate MIT LICENSE removed — LICENSE.md is canonical. **The dirty-files blockade is over: G5, G3/G4, G7 and I2–I5 are now unblocked.** | G5 (MemoryDialog + memory IPC) next; then I2–I5; H6 still awaits provider keys. |
| 2026-08-17 | Updater E2E | **Auto-update E2E test PASSED — all 7 matrix items** (docs/auto-update-e2e-test-plan.md; results in auto-update-plan.md §12). Throwaway releases-only public repo `vidtsx-update-test` (created + deleted same day, zero source pushed). Three local builds (0.9.0/0.9.1/0.9.2) on a local-only branch, since deleted; main untouched. Proven for real: silent check at +30 s, **differential download (15.6 MB of 302 MB, 5%)**, busy gate (refusal reason + chip suppression + 20 s unblock), 600 ms manual-check spinner + "You're on the latest version.", Restart chip → silent NSIS (no installer window, 300 ms monitor) → relaunch as new version in ~45 s, install-on-quit (~30 s, no auto-relaunch), one-toast rule, feed-down 404 → error only in Settings. Draft-then-publish valve rehearsed 3×. **Two findings: (1) BUG to fix pre-V1 — Settings "What's new" shows escaped literal HTML (GitHub feeds HTML, UpdateSection renders via ReactMarkdown); (2) minor — transcription.db WAL sidecars survive shutdown (0-byte, harmless).** Env notes recorded in §12: winCodeSign cache needs one-time manual extract; clear ELECTRON_RUN_AS_NODE when launching the packaged exe from a dev shell. gh CLI installed (user-scope) + authed with repo/delete_repo. | Fix the release-notes rendering bug; then the real flip only repeats a proven flow. G5 (MemoryDialog) next per previous entry. |
| 2026-08-17 | Updater E2E fixes | **Both E2E findings resolved (`122498f`).** (1) Release-notes bug FIXED: `normalizeReleaseNotes` → `services/updater/release-notes.ts` with a dependency-free HTML→markdown converter (GitHub provider feeds HTML; markdown feeds pass through untouched); 8 unit tests incl. the exact HTML captured in the E2E run. (2) transcription.db WAL finding downgraded to NOT-a-bug: sidecars were stale debris from an Aug 13 force-kill (file mtimes prove it); the DB is lazily opened, no session since had opened it, `closeDb` correctly no-ops. Suite 748 green; type gate at baseline (web 26 / node 22). | G5 (MemoryDialog + memory IPC). The real flip now repeats a fully proven flow. |
| 2026-08-17 | G | **G5 implemented — manual entry + MemoryDialog; the value half (G1+G2+G5) is now complete.** Memory IPC surface per the CLAUDE.md recipe: `MEMORY_LIST/SAVE/DELETE/SET_ACTIVE` in channels.ts, req/res types in `shared/ipc/types/studio-memory.ts`, `memory-handlers.ts` + `registrations/memory.ts`, `preload/api/memory.ts`, ElectronAPI mirror updated by hand (gate stayed at baseline). Save handler stamps `{ by: 'user' }` provenance itself — the request has no source field, so the renderer cannot forge agent provenance (asserted in the 8 new handler tests). UI: Brain button in `AgentPanel` opens `MemoryDialog` (Modal, UI_SPEC idiom via the BrandsDialog precedent): Rules with `n/50 active` + at-cap notice + add disabled at cap, Names & spellings with aliases, profile as one free-text box (QM1) with dirty-save; every row shows provenance + On/Off toggle + edit/delete; list order matches the composed block (tier → createdAt → id). G6 residue absorbed — G6 is now empty. Suite 756 green; type gate web 26 / node 22. | G3 (`propose_memory` + pending queue) → G4 (proposal card) → G7 (live CDP acceptance). I2–I5 also unblocked. |
| 2026-08-17 | G | **G3+G4 implemented — Phase G is code-complete; only G7 (live CDP acceptance) remains.** G3: `agent-memory-proposals.ts` (in-memory main-process queue, one pending per project, survives navigation), `propose_memory` tool in the studio MCP server (own per-turn flag, duplicate guard vs active set, text-limit check), M2 policy prose verbatim in the agent prompt, new `memory-proposal` agent event kind. G4: `MemoryProposalCard` (accept / edit-then-accept / reject, same-kind active memories inline, cap error keeps the card up for retry) + `useMemoryProposals` + `MEMORY_PROPOSALS_GET`/`MEMORY_PROPOSAL_RESOLVE` IPC; accept stamps agent provenance in main from the queued proposal — the renderer can edit text/aliases but never kind or source. M2 degraded-provider note in MemoryDialog via `toolsAvailable`. 10 new tests; suite 766 green; gate web 26 / node 22. | G7 live CDP acceptance (needs an agent-sdk provider + a transcribed project). Then I2–I5. |
| 2026-08-17 | I | **I2–I6 implemented — Phase I is complete; the announcements client ships inert until vidtsx.com serves feed.json.** Settings fields (`newsEnabled` default-on, `newsDismissedIds` capped 200), news IPC (`NEWS_GET`/`NEWS_DISMISS`/`NEWS_SET_ENABLED` — the third channel added because the toggle needs a write path; disabled short-circuits BEFORE the fetch so off means no request), `useNews` + `NewsCard` app-level beside CaptureChip (one message at a time, type-accented, CTA via shell-open), `NewsRow` toggle under Privacy, README "Launch-time network requests" disclosure covering update check + feed together (I6). StatusBar chip skipped as unnecessary. 6 new tests; suite 772 green; gate web 26 / node 22. | G7 live CDP acceptance; H6 provider smoke tests (Hasan's keys); then the licensing flip checklist + Phase E. |
| 2026-08-17 | H | **V1 provider set final (Hasan): Claude ×2 + OpenRouter + MiniMax + Kimi; Z.AI cut** — `zai` added to `V1_HIDDEN_PRESET_IDS` (grandfathered like openai/gemini, returns via flag), H2 tests updated to the five-preset expectation. **H6 pre-flight RUN with real keys** (headless spike mirroring the exact `createSession()` routed path): openrouter **PASS** (the suffix-less baseURL question is closed — Anthropic-shape confirmed, cache reads both turns), minimax **PASS**, kimi functional 3/3 runs (text + tools + good cuts) but multi-turn cache reads report 0 (2/2) with under-counted input — judged a usage-reporting quirk, shipping anyway. Keys stay in `.env` (NOT app settings yet). Suite 772 green; gate at baseline. | In-app H6 leg + G7 in one live session: enter the three keys in Providers UI, one agent turn each, then the G7 memory acceptance script on claude. |
| 2026-08-13 | C+F | Live CDP walkthrough on restarted dev app — ALL PASS: catalogs render from IPC, key save/remove ("Key saved" badge), add custom fal id → row + Customized, remove → gone, reset → Defaults; sd-cli Set up click → 36 MB download+extract → "sd-cli ready", full matched set in userData/sd-cli, `--version` exits 0 (commit c00a9e9). Found+fixed a real picker bug en route: stale `activeProvider` ('local' with 0 ready models) dead-ends the Image Studio model picker because the provider select hides at 1 provider — `useActiveImageProvider` now falls over to the first usable provider; after the fix the custom catalog id shows in the picker. All walkthrough state cleaned up (no fal key, catalog Defaults, AssemblyAI untouched). | A real local generation (needs a model download, e.g. 654 MB BK-SDM-Tiny) — optional pre-E. Then Phase E (hardening). |
