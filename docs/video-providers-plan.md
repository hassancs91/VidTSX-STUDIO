# Video providers plan — fal + Seedance direct, and a provider registry

> Planned and **locked 2026-09-04** with Hasan. Motivation: shipping V1 of
> *VidTSX* with no reachable video-model generation looks odd. Cloud video
> generation already exists in code (fal queue, five models) but only the Flows
> "Generate Video" node calls it, and both Flows and the Videos screen are
> hidden in V1 builds. This doc records (1) the audit of how providers are
> structured today, (2) the target architecture, (3) the provider facts
> verified on the web, (4) the build stages, (5) the decisions taken.
>
> Companion docs: `V1_RELEASE_PLAN.md` (goal 11 points here; Phase C is the
> Providers restructure this builds on), `docs/CONTENT_SAFETY_DESIGN.md` (gates
> the engine must keep), `docs/flows-plan.md` (the node that consumes the
> engine), `docs/agents-plan.md` (the `generate_video` tool consumes the same
> engine).

---

## 0. Decisions (locked 2026-09-04)

| # | Decision | Outcome |
|---|---|---|
| D1 | Unhide the Videos screen for V1 | **Yes.** Videos becomes the video-generation tool (panel + gallery, like Images). Flows stays hidden; the node still ships for dev/V2. Name stays "Videos". |
| D2 | Direct Seedance route | **BytePlus ModelArk only.** Volcengine (AK/SK signing, CN residency) deferred; the provider class keeps it a base-URL + auth-strategy change. |
| D3 | V1 default fal video catalog | **Seedance-focused five:** Seedance 2.5, Seedance 2.0, Seedance 2.0 Fast, Kling 2.5 Turbo Pro, Veo 3 Fast. WAN 2.5 preview, Hailuo 02, Seedance 1.0 Lite leave the defaults (their dialects stay in code so users can add them back). |
| D4 | Reference inputs in the Videos panel | **Images, video, and audio** — full Seedance 2 reference-to-video in V1 (first/last frame, ≤9 reference images, ≤3 reference videos, ≤3 reference audios). |
| D5 | Job persistence across restarts | In-memory for V1, job record shaped for persistence (Claude's call). |
| D6 | Scope before the V1 flip | **Full five stages** (~5 sessions). |
| D7 | Callable from anywhere | **Yes** (§2.5): engine in main, library entry point `generateVideoAsset`, IPC for screens, `generate_video` agent tool when agents Stage 1 lands. |

---

## 1. Audit — how providers are structured today

### What exists (and is good)

| Layer | Where | Notes |
|---|---|---|
| Shared BYOK credentials | `src/shared/ipc/types/provider-keys.ts`, `settings.ts` (safeStorage) | One key per provider; renderer only sees has-key booleans. Keys: fal, openrouter, assemblyai, elevenlabs, zai, cloudflare. |
| LLM engine | `src/engine/` | `LLMProvider` interface, registry (`llmEngine`), `PROVIDER_PRESETS`, `llm-init.ts`. |
| Image engine | `src/image-engine/` | `ImageProvider` interface, registry with the **fail-closed Content Safety chokepoint** (`runGuarded`), presets, `image-init.ts`. The model to copy. |
| Transcription engine | `src/transcription-engine/` | Same pattern (AssemblyAI, ElevenLabs, OpenRouter, local whisper). |
| Editable model catalogs | `shared/presets/provider-model-defaults.ts`, `main/services/provider-models.ts`, `ModelCatalogSection` | Image only (`ProviderModelCategory = 'image'`). Seeded defaults + user overrides + reset. |
| Providers UI | `features/ai-models/components/providers/ApiKeysSection.tsx` | One row per key with capability badges; LLM presets in the same list. |
| Usage log | `ai-usage.ts` | `requestType` already includes `'video'`; fal video logs on completion. |
| Cloud video | `main/services/video-generation.ts` + `video-payloads.ts` + `shared/presets/video-models.ts` | fal queue only. In-memory job map. Per-model request dialect is a `switch` on model id. |
| Video Studio | `features/video-studio/` | Gallery + folders + `videoStudioSave` (downloads the URL, runs **Gate B on sampled frames**, indexes in SQLite). No generate panel; empty state says "generate one in Flows". |
| Library image entry point | `main/services/library/generate-image-asset.ts` | Wraps `imageEngine`, files the result as managed library content. The agents plan's `generate_image` tool wraps this. The template for video (§2.5). |
| Local video | `src/local-video-engine/` | Wan/LTX model library via sd-cli. Generation blocked on a newer sd.cpp build (backlog A6). Dev-flagged. Out of scope here. |

### What makes adding a provider harder than it should be

1. **No video engine.** `video-generation.ts` instantiates `FalQueueClient` directly. A second video provider means a fork of that file, not a new provider class. Video is the only capability without an engine + provider interface.
2. **A new credential touches six places.** `ProviderCredentials` (closed interface) → `SHARED_KEY_ROWS` in `ApiKeysSection` → the inline ternary in `image-init.ts` (`preset.type === 'fal' ? credentials.fal : …`) → id special-cases in `llm-init.ts` (`openrouter`, `zai`) → `SHARED_CREDENTIAL_IDS` in `llm-provider-filter.ts` → `settings.ts` save/summary. Nothing derives from a single provider definition.
3. **Capability badges are hand-typed strings** (`capabilities: ['Images', 'Video']`) in the UI, not derived from which engines actually register the provider. They drift.
4. **Video model catalog is code-only** because every model had its own dialect. True for the 2025 fal models (Kling `"5"` vs Veo `"8s"`), but the Seedance 2.x family on fal shares one schema (`prompt / duration / aspect_ratio / resolution / generate_audio / seed`). A catalog entry that names its *dialect* makes video catalogs user-editable for any model in a known family.
5. **Video inputs skip Gate B.** `submitVideoJob` runs Gate A on the prompt only; first/last-frame images go to the provider unchecked (the image engine checks input references before any provider call). Output is gated only if the clip is saved via `videoStudioSave`; the Flows node already holds the remote URL before that. The engine must own both gates.
6. **Jobs are in-memory** and the renderer polls per job. Fine for Flows; a Video Studio panel with several clips in flight wants a job list the UI can subscribe to, and ideally survives a restart (fal/BytePlus jobs keep running server-side).

### Verdict

The LLM / image / STT layers are in decent shape: interface + registry + presets + init, shared credentials, editable catalogs, a chokepoint for safety. Video is the outlier. The one structural fix worth doing before adding providers is a **single provider registry** that the credentials type, the key rows, the capability badges, and every `*-init.ts` derive from — then "add a provider" is one entry plus one provider class.

---

## 2. Target architecture

### 2.1 Provider registry (structural fix, all capabilities)

New `src/shared/providers/registry.ts`:

```ts
export type ProviderCapability = 'llm' | 'image' | 'video' | 'stt';

export interface ProviderDefinition {
  id: ProviderKeyId;               // 'fal' | 'byteplus' | 'openrouter' | …
  name: string;                    // 'Fal.ai'
  keyHint: string;                 // 'fal.ai/dashboard/keys'
  keyPlaceholder: string;          // 'key_id:key_secret'
  capabilities: ProviderCapability[];
  /** Extra non-secret field (Cloudflare account id). */
  extraField?: { key: 'cloudflareAccountId'; label: string; hint: string };
  /** Which engine test button the row offers. */
  test?: 'image' | 'video' | 'llm';
}

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = [ … ];
```

Derived from it:
- `ProviderKeyId` = union of registry ids (replaces the hand-written interface; `ProviderCredentials = Partial<Record<ProviderKeyId, string>>`).
- `ApiKeysSection` rows (labels, hints, badges, test buttons) — delete `SHARED_KEY_ROWS`.
- `image-init.ts` / `llm-init.ts` / STT init look up `credentials[preset.credentialId]` instead of ternaries; each engine preset gains a `credentialId`.
- `llm-provider-filter.ts` derives `SHARED_CREDENTIAL_IDS` from presets with a `credentialId`.
- `V1_HIDDEN_PRESET_IDS` / Z.AI grandfathering keeps working (filter by id as today).

This is a refactor with no behaviour change. It lands first so the video work adds `byteplus` in one place.

### 2.2 Video engine (`src/video-engine/`, mirrors `src/image-engine/`)

```
src/video-engine/
  types.ts            VideoProvider, VideoModelInfo, VideoJob*, VideoEngineError
  video-engine.ts     registry + Gate A/B chokepoint + job tracker + usage log
  presets.ts          VIDEO_PROVIDER_PRESETS (fal, byteplus)
  dialects.ts         request-body builders keyed by dialect id (not model id)
  providers/
    fal-video-provider.ts        (absorbs video-generation.ts + video-payloads.ts)
    byteplus-video-provider.ts   (ModelArk async tasks API)
  index.ts
src/shared/providers/byteplus/   http client (create task / get task), errors
src/shared/providers/fal/        + storage upload helper (reference video/audio files)
```

**Provider interface** — async by nature, so unlike image it is submit + poll:

```ts
interface VideoProvider {
  readonly id: string;
  submit(request: VideoGenerationRequest): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<VideoPollResult>;   // pending | running | completed{url} | failed{error}
  cancel?(providerJobId: string): Promise<void>;
  getSupportedModels(): VideoModelInfo[];
}
```

**Request** (what every caller passes; the engine normalizes against the model's capabilities):

```ts
interface VideoGenerationRequest {
  providerId?: string;               // default: active video provider
  model: string;                     // catalog id
  prompt: string;
  durationSeconds?: number | 'auto';
  aspectRatio?: string;              // 'auto' allowed where the model supports it
  resolution?: '480p' | '720p' | '1080p' | '4k';
  generateAudio?: boolean;
  seed?: number;
  firstFrame?: MediaInput;           // { kind: 'base64' | 'path' | 'url', value, contentType? }
  lastFrame?: MediaInput;
  references?: { images?: MediaInput[]; videos?: MediaInput[]; audios?: MediaInput[] };
  signal?: AbortSignal;              // main-process callers only
}
```

**Model info** carries capabilities so pickers narrow themselves (today Flows shows the union and clamps at submit):

```ts
interface VideoModelInfo {
  id: string; name: string; tagline?: string;
  dialect: VideoDialectId;                     // 'fal-seedance-2' | 'fal-kling-2.5' | 'fal-veo-3' | 'byteplus-seedance' | …
  durations: { kind: 'discrete'; values: number[] } | { kind: 'range'; min: number; max: number; auto?: boolean };
  aspectRatios: string[];
  resolutions?: string[];                      // '480p' | '720p' | '1080p' | '4k'
  supports: { audio: boolean; firstFrame: boolean; lastFrame: boolean; references?: { images: number; videos: number; audios: number } };
  pricePerSecondUsd?: number;                  // informational (usage dashboard)
}
```

**Dialects** replace the `switch (model.id)`: a small table `dialect → (model, request) → { endpoint | modelId, body }`. Every Seedance 2.x slug on fal maps to one dialect; every Seedance id on BytePlus maps to one. A user-added catalog id inherits its provider's default dialect unless the entry names another. The fal Seedance dialect picks the endpoint from the inputs: references present → `reference-to-video`, first frame → `image-to-video`, else `text-to-video`.

**Media inputs.** Images travel as data URIs (both providers accept them; fal already does). Reference **video/audio files are too large for data URIs** — the fal provider uploads them through fal's storage API (new helper in `shared/providers/fal/`, verified at build time) and passes the returned URLs; BytePlus needs verification of whether `video_url`/`audio_url` accept base64 or require public URLs — if URLs only, Stage 3 uses the fal storage helper as a neutral host *only when the user also has a fal key*, and otherwise disables video/audio references for BytePlus in the UI (capability flag on the model info). Reference files are copied into the Video Studio folder alongside the output so a job is reproducible.

**Engine chokepoint** (`runGuarded`, same rule as images — always on, fail-closed):
1. Gate A on the prompt (exists today).
2. Gate B on every input image (first frame, last frame, reference images) *before* any provider sees them — closes the gap in §1.5. Reference **videos** go through the existing `checkVideoBuffer` frame sampler before upload; audio is not gated (no classifier; same as STT input today).
3. On completion the engine **downloads the clip into Video Studio via the existing save path** (which runs the frame-sampling Gate B) and returns the local entry, not the remote URL. Callers (Flows, Studio panel, library, agents) never hold an ungated URL. Flows today saves as a side effect; this makes it the only path.

**Job tracker**: `Map<jobId, VideoJobRecord>` where the record is `{ jobId, providerId, providerJobId, request (minus media bytes), submittedAt, status, entryId?, error? }` plus a `webContents.send` push (`video:job-progress`) so the UI subscribes instead of polling per job. In-memory for V1 (D5); the record is plain JSON so persisting it to settings and resuming polling on startup is a later add.

**Usage**: log on completion as today; cost = catalog `pricePerSecondUsd × duration` (fal) or the BytePlus response `usage` when present. `featureSource` is whichever caller submitted (`'video-studio' | 'flows' | 'library' | 'agent'`).

### 2.3 Catalogs — video becomes a category

- `ProviderModelCategory = 'image' | 'video'`.
- `PROVIDER_MODEL_DEFAULTS.fal.video` (D3 five) and `.byteplus.video` (Seedance 2.0, Seedance 2.5) replace `VIDEO_MODEL_CATALOG`. Entry type becomes a discriminated union (`ImageModelCatalogEntry | VideoModelCatalogEntry`); the store's `sanitizeEntries` keeps `id`, `name`, and for video `dialect` (validated against the dialect table).
- `ModelCatalogCard` renders a dialect select for video cards (defaulting to the provider's default dialect).
- `video-models.ts` keeps the coerce helpers and re-exports from the defaults file (one source of truth, per V1 Phase C3). Legacy saved flows carrying WAN / Hailuo / Seedance 1.0 Lite ids still resolve (dialects stay in code); if the id is absent from the user's catalog the node shows it as "not in catalog — add it in Providers" rather than silently coercing to the default.

### 2.4 Surfaces

**Providers page**: new BytePlus row (from the registry) with a `[Video]` badge and a "Test" that spends nothing — it calls the list-tasks endpoint. Two new catalog cards: *fal — Video*, *BytePlus — Video*.

**Videos screen → generation tool** (D1). Mirror Image Studio's split: `VideoControlPanel` on the left (provider select via `useActiveVideoProvider`, model select filtered by provider, prompt, duration / aspect / resolution constrained by the model's capabilities, audio toggle, first / last frame pickers reusing `ReferenceImageLibrary` from Image Studio *moved to `src/shared/`* since two features need it, reference images from the same library, reference video/audio pickers from the Asset Library or a file dialog with the per-model count/size/duration limits shown), gallery on the right with in-flight job cards (status, elapsed, cancel). Generated clips land in the current folder like Flows does. Empty-state copy no longer points at Flows.

**Flows "Generate Video" node**: gains a provider select; model list reads the engine; per-model constraints come from `VideoModelInfo` instead of the union lists; gets `references` inputs (image list, video, audio). Behaviour otherwise unchanged.

**Nav**: `video-studio` flag flipped on for V1 (D1). Flows stays hidden.

### 2.5 Callable from anywhere (D7)

Video gets the same three entry points images have, all over one engine:

| Caller | Images today | Video (this plan) |
|---|---|---|
| Screens (renderer) | `imageGenerate` IPC → `imageEngine` | `videoGenerate` / `videoGetJob` / `videoCancel` IPC + `video:job-progress` push → `videoEngine` |
| Main-process services | `library/generate-image-asset.ts` wraps `imageEngine`, files the result as managed library content | `library/generate-video-asset.ts` wraps `videoEngine.generateAndWait()`, files the clip in Video Studio **and** the Asset Library (`generated/`, origin `'generated'`, brand-tagged) |
| Agents | `generate_image` tool over `generateImageAsset` (agents plan wave 1) | `generate_video` tool over `generateVideoAsset`, `needs: 'video-provider'`, returns a `video` artifact — both already reserved in `docs/agents-plan.md` |

`generateAndWait(request, { onProgress?, signal })` is the awaiting form (submit → poll → download → gate → file → return entry); screens use the job-record form for cards. Studio's agent can call the same tool later to drop a generated clip on the timeline; that is a Studio feature, not part of this plan.

---

## 3. Provider facts (verified 2026-09-04)

### fal.ai (existing key, queue API already implemented)

Seedance 2.x endpoints share one input schema — the reason the dialect approach works:

| Endpoint | Inputs | Notes |
|---|---|---|
| `bytedance/seedance-2.0/text-to-video` | prompt, resolution 480p/720p/1080p/**4k**, duration auto or 4–15, aspect auto/21:9/16:9/4:3/1:1/3:4/9:16, generate_audio (default true), seed, bitrate_mode | ~$0.30/s at 720p standard |
| `bytedance/seedance-2.0/fast/text-to-video` | same | ~$0.24/s |
| `bytedance/seedance-2.0/image-to-video` (+ `/fast/`) | + `image_url`, `end_image_url` (≤30 MB each) | 480p/720p/1080p |
| `bytedance/seedance-2.0/reference-to-video` | + `image_urls` (≤9), `video_urls` (≤3, 2–15 s combined, <50 MB), `audio_urls` (≤3, ≤15 s combined, ≤15 MB each); prompt references `@Image1` etc.; 12 files max | ~$0.30/s, ~$0.18/s when a video input is present |
| `bytedance/seedance-2.5/text-to-video` | duration auto or **4–30**, resolution 480p/720p, aspect as above, generate_audio, seed | ~$0.47/s at 720p, ~$0.22/s at 480p |
| `bytedance/seedance-2.5/image-to-video`, `bytedance/seedance-2.5/reference-to-video` | as 2.0 counterparts | — |

Output for all: `{ video: { url, content_type, file_name, file_size }, seed }` — matches the `FalVideoResult` shape already parsed.

Kling 2.5 Turbo Pro and Veo 3 Fast keep their existing dialects and stay in the defaults (D3). WAN 2.5, Hailuo 02, Seedance 1.0 Lite dialects stay in code, out of the defaults.

### Seedance direct — BytePlus ModelArk (international) vs Volcengine Ark (China)

| | BytePlus ModelArk (**chosen, D2**) | Volcengine Ark (deferred) |
|---|---|---|
| Base URL | `https://ark.ap-southeast.bytepluses.com/api/v3` | `ark.cn-beijing.volces.com` / `ark.ap-southeast-1.volces.com` |
| Auth | `Authorization: Bearer <ARK_API_KEY>` — a plain API key, fits `ProviderCredentials` | AK/SK HMAC-SHA256 request signing; CN data residency |
| Seedance 2.0 model id | `dreamina-seedance-2-0-260128` (from the DataCamp walkthrough; re-verify in the console) | `doubao-seedance-2-*` |
| Seedance 2.5 | ModelArk has 2.5 docs (prompt guide + tutorial pages exist); exact model id **to verify at build time** | `doubao-seedance-2-5` — API live since 2026-08-07 |
| Create / poll | `POST /contents/generations/tasks` → `{ id }`; `GET /contents/generations/tasks/{id}` → `{ status: queued|running|succeeded|failed|cancelled, content: { video_url }, usage }` | same API family |
| Request body | `model`, `content: [{ type:'text', text }, { type:'image_url', image_url:{url}, role:'first_frame'|'last_frame'|'reference_image' }, { type:'video_url', … }, { type:'audio_url', … }]`, `resolution` (480p/720p/1080p/4k), `ratio`, `duration` (`"4s"`…`"15s"`, 2.5 to 30 s), `generate_audio`, `watermark`, `seed`, `camera_fixed`, `return_last_frame` | same |
| Billing | Prepaid model-specific token packs (e.g. ~7 M tokens ≈ $30); tokens ≈ height × width × frames / 1024 | per-second RMB |

The BytePlus request-body field names above come from third-party write-ups (the ModelArk doc pages render client-side and could not be fetched). Stage 3 starts by opening the real `Create a video generation task` page and pinning the schema, both model ids, and whether `video_url`/`audio_url` accept base64, before writing the dialect.

---

## 4. Stages (each one session, each independently shippable)

**Stage 1 — Provider registry (refactor, no behaviour change).** `registry.ts`; derive `ProviderKeyId`/`ProviderCredentials`; engine presets get `credentialId`; `image-init`/`llm-init`/STT init read credentials by id; `ApiKeysSection` rows and `llm-provider-filter` derive from the registry; unit test that every preset's `credentialId` exists in the registry. Type gate at baseline; Providers page pixel-identical.

**Stage 2 — Video engine extraction (behaviour-preserving).** Create `src/video-engine/` with the fal provider absorbing `video-generation.ts` + `video-payloads.ts`; dialect table with the five existing dialects; `VideoModelInfo` capabilities; engine chokepoint with Gate B on input frames and download-then-return; job tracker + `video:job-progress` push + cancel; `video-init.ts`; `generateAndWait`; `library/generate-video-asset.ts`. Existing IPC keeps working (`videoGenerate` gains optional `providerId`, default fal). Flows node unchanged and re-tested against a real fal key. Unit tests for dialects, the job tracker (mock provider), and the chokepoint order.

**Stage 3 — BytePlus provider + catalogs + reference uploads.** Verify ModelArk schema/model ids from the console; `shared/providers/byteplus/` client; `byteplus-video-provider.ts` + `byteplus-seedance` dialect; `byteplus` in the registry (one entry → key row appears); fal storage upload helper for reference video/audio; `ProviderModelCategory` gains `'video'` with dialect-aware entries; default catalogs per D3; catalog cards with the dialect select; usage cost from catalog / `usage`. Acceptance: set a BytePlus key → generate a Seedance 2.5 clip from Flows; add a new fal Seedance slug in the catalog → it appears in the picker and works; a reference-to-video job with one image, one video, one audio completes on fal.

**Stage 4 — Videos generation panel.** Move `ReferenceImageLibrary` to `src/shared/`; `useVideoProviders` / `useVideoModels` / `useVideoGeneration` / `useVideoJobs` hooks; `VideoControlPanel` (provider, model, prompt, constrained duration/aspect/resolution, audio, first/last frame, reference images/video/audio with limits shown); job cards in the gallery; cancel; errors incl. Content Safety block copy. Empty-state copy updated.

**Stage 5 — Flows node, flag flip, agent tool stub, docs, E2E.** Flows node reads provider + `VideoModelInfo` and gains reference inputs; `video-studio` flag on for V1 (D1); `generate_video` tool definition written against `generateVideoAsset` (registered when agents Stage 1 lands); `V1_RELEASE_PLAN.md` checklist rows ("cloud video: fal Seedance + BytePlus Seedance generated, gated, saved, logged"); `STATUS.md`; manual E2E on real keys for each provider × (t2v, i2v, reference) with the usage dashboard checked; update `docs/CONTENT_SAFETY_DESIGN.md` call-site list (input frames, reference videos, download-then-return).

Rough total: five sessions. Stages 1–2 are pure structure and can be reviewed on their own; nothing user-visible changes until Stage 3.

---

## 5. Open items carried into the stages (not decisions, just verification)

- ModelArk exact schema, Seedance 2.5 model id, base64 support for video/audio references (Stage 3, first hour).
- fal storage upload API shape for a raw-HTTP client (Stage 3).
- Whether Kling 2.5 Turbo Pro and Veo 3 Fast slugs on fal are still current (Stage 2 re-test; the catalog is editable if they moved).
- Ordering against Hasan's V1 testing pass and the T8 export tests: this plan is ready to start at Stage 1 whenever he says go.


---

## 6. Stage log

### Stage 1 — provider registry (DONE 2026-09-05, refactor only, nothing user-visible)

- **New** `src/shared/providers/registry.ts`: `PROVIDER_REGISTRY` (fal, openrouter,
  cloudflare, assemblyai, elevenlabs, zai — in Providers-page row order, badges in
  `capabilities` order), `ProviderKeyId` = union of its ids, `ProviderCredentials` =
  `Partial<Record<ProviderKeyId, string>>`, `PROVIDER_KEY_IDS`, `PROVIDER_CAPABILITY_LABELS`,
  `isProviderKeyId`, `getProviderDefinition`. The array is written `as const satisfies`
  a shape interface, then exported as `readonly ProviderDefinition[]` with `id` narrowed
  to the union — so consumers can read `extraField` / `test` on any row.
- `src/shared/ipc/types/provider-keys.ts` keeps only the IPC request/response types and
  re-exports the two derived types. `provider-keys-handlers.ts` builds `hasKeys` from
  `PROVIDER_KEY_IDS` (no more hand-typed six-key objects).
- **Presets gain `credentialId`.** LLM: new `LlmProviderPreset` type (`engine/types.ts`),
  openrouter + zai carry it. Image: `ImageProviderPreset` (required `credentialId`), all
  three cloud presets carry it. STT: new `src/transcription-engine/presets.ts`
  (`STT_PROVIDER_PRESETS` incl. local whisper, `toSttProviderConfig` strips the id before
  the seed is persisted) — `stt-init.ts` seeds from it instead of four inline literals.
- **Credential lookup by id** replaces every ternary / id special-case: `image-init.ts`
  (`credentials[preset.credentialId]`), `image-handlers.ts` `sharedKeyFor` (via the preset
  of that type), `llm-init.ts` (`sharedCredentialFor(id)`), `llm-handlers.ts` extras loop
  (presets with a `credentialId`), `stt-init.ts` (preset of the same type). The Phase C
  enablement rule (a saved config with no own key + a shared key ⇒ `enabled: true`,
  since shared rows have no toggle) used to apply to OpenRouter only — an oversight from
  when zai joined the shared rows. Hasan approved making it generic: `llm-init.ts` and
  the `llm-handlers.ts` get mapper now apply it to every preset with a `credentialId`
  (new llm-handlers test case for zai). Only affects installs with a saved zai config
  carrying the save artifact, i.e. grandfathered dev machines.
- `ApiKeysSection` rows derive from the registry (`SHARED_KEY_ROWS` deleted, −85 lines).
  Z.AI grandfathering and the Cloudflare account-id field (`extraField`) unchanged.
  `llm-provider-filter.ts` derives its shared-credential set from LLM presets with a
  `credentialId` (shared → engine/presets import; data + type only, bundles fine).
- **Test** `src/shared/providers/registry.test.ts` (4 cases): unique ids + a label per
  capability; registry ids ≡ `ProviderKeyId` (compile-time `Record` both ways + runtime
  guard); every LLM/image/STT preset `credentialId` exists; every declared badge is backed
  by a consuming engine preset (video excluded until Stage 2 lands a preset).
- **Verified:** `check:types` web 26 / node 22 (baseline, none in touched files); vitest
  133 files / 1318 tests green; Providers page driven via CDP on the running dev app —
  5 rows (Z.AI hidden, no key) identical to HEAD's `SHARED_KEY_ROWS` in label, badge
  order, hint, placeholder, test button, and the account-id field; `Debugger.scriptParsed`
  confirmed the page runs the registry build (no `SHARED_KEY_ROWS` in the live source).
  Main-process changes were not exercised live (the dev instance predates them); the
  type gate + the existing llm-handlers test cover them until the next restart.
- **One visible change, Hasan's call after the identical-page check:** the badge test
  found OpenRouter also powers transcription (`stt-init` registers it) but its row showed
  only `[Images] [LLMs]`. Hasan asked for the badge — OpenRouter's registry entry now
  declares `'stt'`, the row reads `[Images] [LLMs] [Transcription]`, and the badge test
  is two-directional (badge ⇔ consuming engine preset).
- **Next:** Stage 2 (video engine extraction). `video-generation.ts` still reads
  `credentials.fal` directly — it moves into the fal video provider there.

### Stage 2 — video engine extraction (DONE 2026-09-06, behaviour-preserving, fal E2E passed on the real key)

- **New `src/video-engine/`** mirroring `src/image-engine/`: `types.ts` (`VideoProvider`
  = submit + poll + optional cancel, `VideoModelInfo` with `dialect` + capabilities,
  `VideoGenerationRequest` / normalized `VideoProviderRequest`, `VideoJobRecord` in the
  plain-JSON §2.2 shape, `VideoSafetyGuard`, `VideoClipStore`, `VideoEngineError`),
  `video-engine.ts` (registry + chokepoint + `submit` / `generateAndWait` + usage log
  via an injected logger), `job-tracker.ts` (Map<jobId, record>, one abortable poll loop
  per job, subscribers, cancel, 1 h retention of finished records), `dialects.ts`
  (`VIDEO_DIALECTS: Record<VideoDialectId, builder>` — the `switch (model.id)` from
  `video-payloads.ts` became five family builders + `fal-generic`; endpoint picked from
  the inputs), `normalize.ts` (the old `submitVideoJob` clamps, now capability-driven),
  `model-info.ts`, `media-input.ts` (`path` → base64; the IPC's "base64 or https" string
  → `MediaInput`), `presets.ts` (fal only, `credentialId: 'fal'`),
  `providers/fal-video-provider.ts` (absorbs `video-generation.ts` + `video-payloads.ts`,
  both deleted; keeps fal's status/response/cancel URLs per request). `FalQueueClient`
  gained `cancelUrl` + `cancel()` (PUT, 202 → true, 400 ALREADY_COMPLETED → false).
- **Catalog** (`shared/presets/video-models.ts`): every entry names its `dialect`
  (`fal-kling-2.5`, `fal-veo-3`, `fal-wan-2.5`, `fal-hailuo-02`, `fal-seedance-1`) and,
  where the dialect sends one, `resolutions` (WAN + Seedance 1 → `['720p']`, the value
  the old payloads hard-coded). `allowedDurations` / `allowedAspectRatios` and the
  coerce helpers keep their names (the Flows node reads them unchanged); the helpers
  now delegate to capability-list forms (`closestAllowedDuration`, `pickAllowedAspect`)
  the engine shares.
- **Chokepoint, always on, fail-closed.** `submit()` runs prompt validation + Gate A
  first (before the provider lookup, as `submitVideoJob` did — a flagged prompt is
  refused even with no key). `runGuarded` then refuses without BOTH the input guard and
  the clip store, normalizes against the model, runs **Gate B on first frame, last
  frame, and reference images before the provider call (closes §1.5)**, submits, and
  starts the tracker. On the provider's COMPLETED the tracker calls the engine's finish
  step: the clip store = the same `saveVideoFromUrl` the IPC uses (download →
  `checkVideoBuffer` 2 fps frame sampling → SQLite + thumbnail), then the usage log
  (`pricePerSecondUsd × duration`, the caller's `featureSource`). The record carries
  the **local Video Studio entry**; a Gate B trip on the output marks the job `failed`
  with `blocked` info and no entry.
- **Main wiring**: `services/video-init.ts` (guard + clip store + usage logger, then
  `credentials[preset.credentialId]` per preset; a removed key unregisters) called from
  `main/index.ts` after the image engine and from `provider-keys-handlers.ts` on every
  key save. `content-safety/install.ts` gained `installVideoContentSafetyGuard`
  (`input-media.ts` reads base64 / data URI / https inputs, 30 MB cap, fetch failure
  blocks). `services/video-studio-save.ts` is the download/gate/save/thumbnail path
  extracted from `video-studio-handlers.ts` (the handler is now thin) plus
  `findVideoEntryByFileUrl` / `fileVideoInFolder`. `library/generate-video-asset.ts`
  mirrors `generate-image-asset.ts` over `generateAndWait` (copies the Video Studio
  clip into `generated/`, origin `generated`, brand-tagged, `featureSource:
  'studio-shot-asset'`).
- **IPC**: `videoGenerate` gains optional `providerId` (default: active = fal),
  `folderId`, `featureSource` (default `'flows'`, what the old code hard-coded).
  `videoGetJob` reads the tracker (no provider call per poll any more) and returns
  `entry` + `videoUrl` = the **`file://` URL of the gated local clip** (never the remote
  URL) + `providerId` / `blocked`; status gains `'cancelled'`. New `videoCancel` and
  the `video:job-progress` push (`onVideoJobProgress` in preload + `electron.d.ts`),
  bridged in `video-handlers.ts` to every window.
- **Flows node unchanged — and how it still works.** The node re-saves whatever
  `videoUrl` it gets through `videoStudioSave`. That handler now recognises a `file://`
  URL inside the clips folder and resolves it to the existing entry (no second
  download, no second gate) and files it into the node's `folderId` — so `videoRef`,
  the gallery refresh event, and the flow-folder placement behave exactly as before,
  with one download instead of two. Stage 5 drops the node's save call.
- **Tests** (+22, suite 143 files / 1375 green): `dialects.test.ts` (one case per
  dialect incl. i2v + last frame, `mediaToUrl`, table ⇔ catalog); `video-engine.test.ts`
  (order Gate A → Gate B × 2 → provider; flagged prompt never reaches Gate B or the
  provider; Gate B block never reaches the provider; refuses without guard / without
  store; Gate A before the provider lookup; normalization; tracker submit → pending →
  running → completed with the store call and the usage entry, provider failure, output
  Gate B block → `failed` + `blocked`, cancel → provider.cancel + no further polls,
  `generateAndWait` resolve / reject / abort-signal cancel). `registry.test.ts` now
  cross-checks the `video` badge against `VIDEO_PROVIDER_PRESETS` (the Stage 1
  exclusion is gone). `check:types` web 26 / node 22 (baseline).
- **Live (dev app, CDP, restarted on the new main)** — 11/11 keyless checks:
  `videoGenerate` without a key → the provider message; flagged prompt over IPC →
  `blocked {prompt, nudity}` and the Content Safety counter incremented; empty prompt,
  unknown job, cancel-unknown; progress subscription; `videoStudioSave` of a public
  10 s Big Buck Bunny clip → download → classifier loaded → frames sampled → entry
  (0.99 MB, 3.5 s); the `file://` re-save returned the same entry id with no duplicate;
  a `file://` outside the clips folder refused; probe entry deleted. Side note: the
  w3schools BBB sample was **blocked** by Gate B ("possibly explicit", a cartoon
  frame) — the recall-greedy band at work, not a regression.
- **Live fal E2E — PASSED (2026-09-06, real key, entered mid-session: the engine
  re-registered on save with no restart).** CDP driver seeded a Prompt → Generate Video
  flow (unchanged node, default config: Kling 2.5 Turbo Pro, 5 s, 16:9, audio off),
  opened it, clicked Run. Push events `pending → running → completed` in 117 s; the
  completed event carried the local entry and `videoUrl =
  file:///…/video-studio/videos/vid-…-320b8ea9.mp4`; `videoGetJob` returned the same;
  the Flows badge read **Complete** and the node's `<video>` played the local file
  (readyState 4, 5.04 s); Video Studio gained exactly **one** entry (9.04 MB mp4, the fal
  URL recorded as `sourceUrl`, thumbnail extracted) — the node's re-save resolved to it,
  no duplicate; the usage dashboard logged `fal / kling-2.5-turbo-pro / flows / video /
  $0.40 / 152.7 s`. Main log: `Video job submitted → ContentSafety Sampling video →
  Classifier loaded` (Gate B on the output frames ran before the entry existed).
- **§5 slug re-check (fal, 2026-09-06)**: `fal-ai/kling-video/v2.5-turbo/pro/text-to-video`
  + `/image-to-video` live, schema unchanged (duration "5"/"10", 16:9/9:16/1:1).
  **`fal-ai/veo3/fast` is deprecated** ("This endpoint is deprecated … no longer
  supported"). Successor: **`fal-ai/veo3.1/fast`** and `fal-ai/veo3.1/fast/image-to-video`
  — same dialect (duration `4s/6s/8s`, `aspect_ratio` 16:9/9:16 + `auto` on i2v,
  `generate_audio`, `seed`) plus `resolution` 720p/1080p/4k. Not swapped in Stage 2
  (behaviour-preserving); the D3 default catalog in Stage 3 should carry Veo 3.1 Fast
  (`dialect: 'fal-veo-3'`, `resolutions: ['720p','1080p','4k']`, durations 4/6/8) —
  Hasan's call.
- **Next:** Stage 3 (BytePlus provider + catalogs + reference uploads).

### Stage 3 — BytePlus ModelArk provider, video catalogs, reference uploads (DONE 2026-09-07)

**The first hour was the schema (§5, now closed).** The ModelArk doc pages render
client-side, so `WebFetch` returns only the nav — the article is embedded in the
page as a Quill delta inside `window._ROUTER_DATA`, and decoding that gives the
real reference. What it pins:

- **Endpoints** — `POST/GET/DELETE https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks[/{id}]`,
  `Authorization: Bearer <ARK_API_KEY>` (a plain key, so it fits the shared BYOK
  store — D2's reason for choosing ModelArk over Volcengine holds). Statuses:
  `queued | running | succeeded | failed | cancelled | expired`; the response
  carries `content.video_url` (valid 24 h) and `usage.completion_tokens` (video
  models bill on those, input tokens always 0). DELETE cancels a *queued* task
  and deletes the record of a finished one; a running task cannot be cancelled.
- **Body** — `model` + one `content` array of typed items, each with a `role`:
  `{type:'text',text}`, `{type:'image_url',image_url:{url},role:'first_frame'|'last_frame'|'reference_image'}`,
  `{type:'video_url',…,role:'reference_video'}`, `{type:'audio_url',…,role:'reference_audio'}`,
  plus `resolution`, `ratio`, `duration` (whole seconds or `-1` = model picks),
  `generate_audio`, `watermark`, `seed`, `camera_fixed`, `return_last_frame`.
  First-frame / first-and-last-frame / omni-reference are **mutually exclusive**
  by API rule, and frame images fix the ratio (`adaptive` is the only legal value).
- **Base64 support (the open item)** — `image_url` accepts `data:image/<fmt>;base64,…`
  (≤30 MB) and `audio_url` accepts `data:audio/<fmt>;base64,…` (≤15 MB), but
  **`video_url` takes a URL or an `asset://` id only**. So the plan's fallback is
  the real path: reference videos for BytePlus go through fal storage, and
  without a fal key the BytePlus models report **zero** reference videos.
- **Model ids** — `dreamina-seedance-2-5-260628`, `dreamina-seedance-2-0-260128`,
  `dreamina-seedance-2-0-fast-260128`, `dreamina-seedance-2-0-mini-260615`.
  2.5: duration 4–30 s (or −1), 480p/720p/1080p, refs 30 images / 10 videos /
  10 audios. 2.0 series: 4–15 s, 480p/720p(/1080p/4k on the base model), refs
  9/3/3. **Neither 2.x family takes a `seed`** (nor `camera_fixed`) — that is
  1.x only, so the catalog entries carry `supportsSeed: false` and the dialect
  omits it.
- **fal** — `bytedance/seedance-2.5/{text,image,reference}-to-video` and the same
  three for `seedance-2.0` and `seedance-2.0/fast`: one schema (`prompt`,
  `duration` `auto|4..30`, `aspect_ratio` `auto|21:9|16:9|4:3|1:1|3:4|9:16`,
  `resolution`, `generate_audio`, `bitrate_mode`; `image_url`/`end_image_url` on
  the image route; `image_urls`/`video_urls`/`audio_urls` on the reference route,
  addressed from the prompt as `@Image1` / `@Video1` / `@Audio1`). **Veo 3.1
  Fast confirmed** (`fal-ai/veo3.1/fast` + `/image-to-video`, 4s/6s/8s,
  720p/1080p/4k) and takes the D3 slot the deprecated `fal-ai/veo3/fast` held.
- **fal storage** (the other §5 item) — `POST https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3`
  with `Authorization: Key …` and `{content_type, file_name}` returns
  `{upload_url, file_url}`; PUT the bytes to the signed URL (no auth) and pass
  `file_url`. Single-request uploads only up to 90 MB (fal's own client switches
  to multipart above that) — over it we refuse with a clear message.

**What shipped**

- **`src/shared/providers/byteplus/`** — typed ModelArk client (create / get /
  delete / list tasks) with the ARK error code and message surfaced, mirroring
  the fal client's shape. **`src/shared/providers/fal/fal-storage.ts`** — the
  two-step upload above, used by both video providers.
- **`byteplus-video-provider.ts`** + the **`byteplus-seedance` dialect**: the
  dialect builds the `content` array and picks the task type from the inputs
  (references win, then frames, else text); the provider only knows the task
  protocol, maps the six statuses, and reports `usage.completion_tokens`. Its
  `uploadMedia` hosts reference videos through fal storage when a fal key
  exists, keeps audio inline as a data URI, and **without a host reports
  `references.videos: 0`** so the capability never lies to a picker.
- **`fal-seedance-2` dialect** for the 2.x family (one builder, three routes),
  `fal-veo-3` gained the `resolution` field 3.1 added, and the fal provider
  gained `uploadMedia` (reference video *and* audio go to fal storage).
- **Catalogs are a category now**: `ProviderModelCategory = 'image' | 'video'`,
  entries are a discriminated union, and `PROVIDER_MODEL_DEFAULTS.fal.video`
  (D3's five, with Veo 3.1 Fast) and `.byteplus.video` (the four ModelArk ids)
  replace the code-only list. Stored rows keep only **id + name + dialect**; the
  rest is re-derived on load by `hydrateVideoEntry` from a **per-dialect
  capability template** plus route derivation — a slug that names a route
  (`…/seedance-2.5/text-to-video`) yields its siblings, one that does not
  (`fal-ai/veo3.1/fast`) gets `/image-to-video` appended, and a ModelArk id
  serves all three. So a user-added model can never carry stale hand-written
  capabilities, and a known id keeps its verified ones.
- **Reference media end-to-end**: the request type, the IPC, the engine and the
  Flows node all carry `references.{images,videos,audios}`; the normalizer clamps
  each list to the model's limits and drops the frame route when references are
  present (the APIs forbid mixing). The chokepoint moved into
  `input-media-gate.ts` and runs in one order — resolve → **Gate B on every
  image, and the frame sampler on every reference clip** → only then host what
  cannot travel inline. A reference video with no sampler installed is refused
  (fail-closed), and nothing is uploaded before it is gated.
- **Surfaces**: `byteplus` is one registry entry, so its key row, `[Video]` badge
  and `ProviderCredentials` slot all appear from that; its **Test** button calls
  list-tasks and spends nothing. `videoProvidersGet` / `videoModelsGet` are new,
  and the Flows node's model select is now a **`video-model-picker`** fed by the
  engine (provider + model, with a Resolution field and the three reference
  inputs added). A catalog save re-registers the engine for that category, so a
  new model reaches every picker at once.
- **Usage**: cost stays the catalog's per-second estimate × duration; when a
  provider reports spend of its own (ModelArk tokens) it rides along as the usage
  row's `outputTokens` rather than being converted into a guessed price.

**Verified**

- `check:types` web 26 / node 22 (both at baseline); vitest **146 files / 1445
  tests green** (+70 since Stage 2's run, of which 26 are this stage: the two new
  dialects across all three routes, route derivation and entry hydration, the
  BytePlus provider's status mapping / task body / uploader-gated reference
  limits, and the engine's reference gating order).
- **Live, keyless (dev app over CDP), 11/11**: the engine serves the D3 five with
  Veo 3.1 Fast and no `veo-3-fast`; Seedance 2.5 reports a 4–30 s *range*, audio,
  and 30/10/10 references; both video catalogs exist and every row carries its
  dialect; **adding `bytedance/seedance-2.5/fast/text-to-video` produced the two
  sibling routes and the family's capabilities and reached the picker**, and
  Reset restored the shipped five; a bad BytePlus key fails with ModelArk's own
  message (`The API key format is incorrect`, plus its request id) — proof the
  client, auth and error path are right without spending anything; Gate A still
  refuses a blocked prompt over IPC before any provider lookup.
- **Live UI**: the Providers page shows the **BytePlus ModelArk** row with the
  `[Video]` badge, the `ARK API key` placeholder, the console hint and a Test
  button; Model Catalogs shows **Fal · Video models** and **BytePlus · Video
  models**, each row printing its dialect, each card with the "Request dialect"
  select defaulted to that provider's family. The Flows node's inspector now
  reads **Model — Provider** (Fal.ai) and **Model — Model** (the five, live from
  the engine) plus Resolution, and the node carries six input ports (prompt,
  first/last frame, reference images/video/audio).
- **Live fal E2E PASSED — reference-to-video with one image, one video and one
  audio.** Seedance 2.5, 4 s, 480p, audio on, references: the Stage 2 Kling clip
  (5.04 s, 1080p, 9.04 MB) as `@Video1`, its thumbnail as `@Image1`, a 3 s mp3 as
  `@Audio1`. The main log tells the whole chokepoint in order: `Classifier
  loaded` → Gate B on the reference image → `Sampling video {frames: 15, 1920x1080}`
  → **then** `FalStorage Uploaded reference media {video/mp4, 9043223}` and
  `{audio/mpeg, 24467}` → `Video job submitted` → (374 s later) `Sampling video
  {frames: 13, 854x480}` on the *output* → filed. Result: one Video Studio entry
  (1.70 MB, 480p as asked, thumbnail written), `videoUrl` a local `file://`, the
  fal CDN URL kept only as `sourceUrl`, and the usage row `fal / seedance-2.5 /
  flows / video / $1.88 / 374.6 s`.
- **Live BytePlus E2E PASSED — the acceptance's other half, run from Flows.** A
  two-node flow (Prompt → Generate Video) pinned to `providerId: 'byteplus'` /
  `dreamina-seedance-2-5-260628`, 4 s, 480p, 16:9, was built through
  `flowsProjectCreate` and **Run** was clicked in the UI, so the node's own
  `execute()` drove it. `Video job submitted {provider: 'byteplus', model:
  'dreamina-seedance-2-5-260628'}` → Complete in **371 s**; the node preview
  played the local clip and the run badge read Complete. One Video Studio entry
  (1.02 MB, **854×480 / 4.04 s** — the requested 480p and duration came back
  exactly), thumbnail written, `videoUrl` a local `file://`, and `sourceUrl` the
  ModelArk TOS signed URL — which **expires in 24 h with a 100-download cap**, so
  download-then-return is not a nicety here, it is the only way the clip survives.
  Usage row: `byteplus / dreamina-seedance-2-5-260628 / flows / video / $0.92 /
  366.6 s` with **`outputTokens: 38830`** — the `usage.completion_tokens` ModelArk
  bills on, carried through as designed (fal reports none and logs 0).
  Beforehand, the Providers **Test** button authenticated the saved key against
  the real list-tasks endpoint in 980 ms, and Seedance 2.5 reported
  `references: {images: 30, videos: 10, audios: 10}` — the 10 videos only because
  a fal key is present to host them; without one the same model reports 0.

- **Gate B proved itself on the way in**: the first attempt used synthetic test
  media, and `ContentSafety Image blocked by classifier {band: borderline, p: 0.3049}`
  refused the flat colour card *before* any upload or provider call — exactly the
  §1.5 hole Stage 2 closed for frames, now covering reference inputs too.

**Open / for Hasan**

- ~~BytePlus needs a key.~~ **Key entered by Hasan 2026-09-07; the BytePlus half
  of the acceptance now PASSES too** — see the live BytePlus E2E above. The
  ModelArk activation prerequisite still applies to any fresh account: a balance
  over USD 30, an AI Savings Plan at that tier, or a Seedance resource pack.
- **Cost estimates are per model, not per resolution.** The $1.88 above is
  0.47 × 4 s, the 720p list rate, for a 480p clip that costs roughly a fifth of
  that on fal. The dashboard already calls the column an estimate; a price map
  per resolution (and the "with video input" discount) is a small Stage 4 add.
- The renderer logged one `reactflow.js` uncaught error at 14:31 — from the
  driver's synthetic `DragEvent` with an empty `dataTransfer`, not from the node
  (the node was created and configured fine straight after).

**Next:** Stage 4 — the Videos generation panel (`ReferenceImageLibrary` moves to
`src/shared/`, the control panel with the constrained fields these capabilities
now describe, job cards, cancel).

### Stage 4 — the Videos generation panel (DONE 2026-09-07)

The Videos screen stops being a gallery you can only fill from Flows. It gets
Image Studio's split: a control panel on the left, the gallery on the right, and
job cards in the grid while clips are generating.

**What shipped**

- **`ReferenceImageLibrary` moved to `src/shared/components/`** (both Image
  Studio call sites import it from there now) and gained a
  **`selection: 'shared' | 'local'`** prop. It had persisted every tick on the
  reference-image manifest — right for Image Studio, but it makes two pickers on
  one screen fight over one global flag, and the first- and last-frame pickers
  are exactly that case. `'local'` keeps the ticks in the instance while still
  sharing the library of images; the default is unchanged, so Image Studio
  behaves as before. Its drop zone split out as `ReferenceImageDropZone` to keep
  the file under 300 lines.
- **Four hooks** in `features/video-studio/hooks/`: `useVideoProviders`
  (providers with a key, plus the panel's pick — there is no
  `videoProviderSwitch` IPC because `videoGenerate` takes a `providerId` per
  job, so the choice is panel state seeded from the engine's active provider),
  `useVideoModels` (one provider's models, reloaded on
  `vidtsx:video-providers-changed` so a catalog edit reaches the picker),
  `useVideoJobs` (cards driven **entirely by the `video:job-progress` push** —
  the renderer never polls; a completed job drops its card and refreshes the
  gallery, a failed or cancelled one stays until dismissed) and
  `useVideoGeneration` (submit, and the block copy on refusal).
- **`VideoControlPanel`** with mode tabs, prompt, provider, model and the media
  pickers, plus **`VideoModelFields`** for duration / aspect / resolution /
  audio. Every option is read from the model's `VideoModelInfo`: a discrete
  duration list renders chips, a range renders a slider labelled with its
  bounds, aspect and resolution render only the published values, and the audio
  toggle appears only where the model generates audio. The **mode tabs are the
  routes the model actually has** — the reference and frame routes are mutually
  exclusive on both providers (the normalizer drops the frames), so offering
  them as one form would have promised a combination neither API accepts.
  `services/model-constraints.ts` holds the clamping and is unit-tested.
- **`ReferenceMediaPicker`** for reference video and audio: files are chosen as
  **local paths** (`dialogOpen`, or a drop) so the bytes never enter the
  renderer — the engine gates them and the provider hosts them. Each picker
  prints its per-model limit and hides itself when that limit is 0, which is how
  a BytePlus-only install correctly shows no reference-video input.
- **Job cards** in the gallery grid (`VideoJobCard`): status, elapsed time — the
  honest signal, since neither provider reports a percentage — the prompt,
  Cancel while running, Dismiss when not, and the Content Safety copy verbatim
  when a job was blocked. Jobs suppress the gallery's empty state, and the
  **empty-state copy no longer points at Flows** ("generate one with the panel
  on the left").
- `usePanelResize` extracted to `src/shared/hooks/` for the drag divider.

**Two items folded in from Stage 3's open list**

- **Cost estimates are per resolution now.** `pricePerSecondByResolutionUsd` on
  the catalog entry flows through `VideoModelInfo` and the IPC; the engine bills
  a job at the requested resolution's rate and falls back to the headline (720p)
  rate otherwise, and the panel prints the estimate live, marking it "at list
  rate" where no per-resolution rate exists. Rates added: **fal Seedance 2.5
  {480p 0.22, 720p 0.47}** (section 3's figures) and **BytePlus Seedance 2.5
  {480p 0.10, 720p 0.23}** — the latter corroborated by the real run, whose
  38,830 completion tokens at ModelArk's $10.70/M is $0.4155 for a 4 s 480p
  clip, i.e. $0.104/s. Every other model still estimates at its headline rate
  and says so; a full rate card is follow-up work.
- **`outputTokens` was already surfaced** — the usage log table has an "Out
  Tokens" column and the BytePlus rows carry 38,830 in it. Nothing to fix; the
  Stage 3 note was pessimistic.
- The type gate's **node baseline dropped 22 → 10**. Moving a renderer component
  into `src/shared/` exposed that `tsconfig.node.check.json` never saw the
  `window.api` ambient declaration (it lives under `src/renderer`), so every
  shared module touching `window.api` counted as errors. Adding that one `.d.ts`
  to the node config's `include` fixed those and the pre-existing ones.

**Verified**

- `check:types` web 26 / node **10** (new baseline); vitest **147 files / 1459
  tests green** (+14: the constraint service's clamping, mode derivation and
  cost estimate, and two engine cases pinning the per-resolution billing).
- **Live in the dev app (CDP, flags on), driven from the panel itself:**
  - **fal generated** — Seedance 2.5, 4 s, 480p: card Queued → Generating →
    filed at 197 s, 2.89 MB, thumbnail written, local `file://`, the fal URL
    only as `sourceUrl`; usage `fal / seedance-2.5 / video-studio / $0.88`.
  - **BytePlus generated** — `dreamina-seedance-2-5-260628`, 4 s, 480p,
    submitted while the fal job was still running (**two cards side by side**):
    filed at 265 s, 4.62 MB; usage `byteplus / … / video-studio / $0.40` with
    `outputTokens 38830`. Against the Stage 3 rows for the same clips ($1.88 and
    $0.92) that is the per-resolution fix, measured.
  - **Fields narrow per model, live**: Seedance 2.5 → a 4–30 s *slider*, 7
    aspects, 3 resolutions, audio, all three modes; Veo 3.1 Fast → discrete
    4/6/8 s, 2 aspects, 720p/1080p/4k, **no Reference tab**; Kling → no
    Reference tab either; BytePlus Seedance 2.5 → its own `adaptive` aspect
    rather than fal's `auto`. Veo's estimate reads "at list rate", the Seedance
    pair's does not.
  - **Reference job from the panel** — a real clip thumbnail as `@Image1` and a
    real Video Studio clip dropped as `@Video1` (pickers reading "Reference
    Images (max 30) (1/1 active)", "Reference Videos (1/10)", "Reference Audio
    (0/10)"). The main log tells the chokepoint in order: `Sampling video` on
    the input clip → **then** `FalStorage Uploaded reference media` → **then**
    `Video job submitted` → output sampling → filed, 1.09 MB; usage $0.88.
  - **Cancel** — Generating → **Cancelled in 2 s**, the card kept with its
    Cancelled chip and a Dismiss button.
  - **Blocked prompt** — the panel showed *"Blocked by Content Safety — sexual
    content. Rephrase your prompt … See AI → Content Safety."* and **no job card
    was created**; main logged `Prompt blocked by Content Safety` with no
    provider lookup.
  - **Empty-state copy** — an empty folder reads "This folder is empty" / "Drag
    videos here, or generate one with the panel on the left".

**Open / for Hasan**

- **In-flight jobs are renderer state (D5).** `useVideoJobs` holds the cards in
  `useState` and nothing rehydrates them on mount, so a renderer reload would
  drop them while the job keeps running in main and still files its clip —
  there is no "list active jobs" IPC for the panel to re-attach with. Fine for
  V1 as decided; the job record is already shaped for persistence. This is a
  property of the code, not something the acceptance run hit: an earlier draft
  of this log claimed a reload had wiped the cards mid-run and blamed Vite's
  watcher for picking up driver artifacts written inside the repo. Both halves
  were wrong. A screenshot from later in the same run still shows the Cancelled
  card, and a direct probe (plant a marker on `window`, write a .png, .mjs and
  .json into `.vidtsx-temp/`, re-read the marker) shows it **surviving all
  three** — `.vidtsx-temp/` is outside the module graph and does not trigger a
  reload. What actually happened was a driver-side miss: the `jobCards()` DOM
  selector returned `[]` while a card was on screen. Editing a file Vite
  actually imports (anything under `src/`) is the thing that reloads a waiting
  driver's page, as the export-engines sessions found.
- **Only the two Seedance 2.5 entries have per-resolution rates.** Everything
  else still estimates at its 720p headline rate, labelled "at list rate" in the
  panel. The reference-with-video-input discount is not modelled either.
- Reference **video/audio** are chosen through a native file dialog, which CDP
  cannot drive; the live run exercised that picker through its drop handler with
  a real path instead, which is the same code path a drop takes.

**Next:** Stage 5 — the Flows node reading the same capabilities, the
`video-studio` flag flipped on for V1 (D1), the `generate_video` agent tool
definition, the V1 checklist rows, and the Content Safety call-site list.

### Stage 5 — the Flows node, the flag flip, the agent tool, the docs (DONE 2026-09-07) — **this closes the plan**

The last stage carries no new provider work. It makes the Flows node read the
same capabilities the panel reads, unhides Videos for V1, writes the agent tool
against the shipped engine, and brings the two release documents up to date.

**What shipped**

- **The Flows node's fields are the model's fields now.** `generate-video.ts`
  offered `ASPECT_OPTIONS` / `DURATION_OPTIONS` / `RESOLUTION_OPTIONS` as static
  unions and let the engine clamp at submit, so a saved flow could carry a
  duration its model never accepts and a seed the model ignores. Those four
  selects plus the seed text field collapse into one new inspector field kind,
  **`video-model-options`**, which reads the selected model's `VideoModelInfo`
  over `videoModelsGet` and renders exactly what that model publishes. It also
  **re-clamps the stored config** whenever the model changes — the node never
  keeps a value the model would have to be corrected on — and prints the
  per-run cost estimate the panel prints. Like `image-upload`, the field owns a
  fixed set of config keys (`durationSeconds`, `aspectRatio`, `resolution`,
  `generateAudio`, `seed`) rather than one.
- **Shared, not duplicated** (the plan's instruction): `model-constraints.ts`
  and its test moved from `features/video-studio/services/` to
  **`src/shared/video/`**, and `VideoModelFields` from
  `features/video-studio/components/` to **`src/shared/components/`** — the same
  move Stage 4 made for `ReferenceImageLibrary`, and for the same reason: a
  feature module must never import from another feature module. The panel's
  `VideoPanelMode` is now an alias of the shared `VideoRouteMode`, so every
  video-studio call site is unchanged.
- **`supports.seed` joins `VideoModelInfo`.** `supportsSeed` lived on the catalog
  entry and stopped there, so no picker could know. It now flows to the IPC
  info, which is what lets the node hide the Seed field on both Seedance 2.x
  families and clear a stored seed rather than keep a promise the flow cannot
  keep.
- **`video-studio` is on for V1 (D1).** The flag moved out of `ENV_GATED` into
  `FEATURE_FLAGS` as `true`; `VITE_FF_VIDEO_STUDIO` is retired from
  `.env.example` and `env.d.ts` because nothing reads it any more. **Flows stays
  env-gated.**
- **`generate_video`, written and not registered.**
  `src/main/services/agents/tools/generate-video.ts` wraps `generateVideoAsset`
  with a zod schema, `needs: 'video-provider'`, and a `video` artifact carrying
  the Video Studio entry id and the library path — never a provider URL, because
  ModelArk's expire in 24 h. It is deliberately imported by nothing:
  `docs/agents-plan.md` §1.3 owns the registry, and agents Stage 1 registers it.
  The `types.ts` next to it is the **smallest** provisional slice of that plan's
  `AgentToolDef` needed to type the definition, marked as Stage 1's to replace.
  `generateVideoAsset` gained `providerId`, `resolution` and an optional
  `featureSource` on the way (a new `'agent'` value in `AiFeatureSource`), and
  its "add a Fal API key in Settings → AI Providers" message was two things
  stale at once.
- **Docs**: `docs/CONTENT_SAFETY_DESIGN.md` D2c is six callers now, with the
  video input-media gate written out in its real order (resolve → Gate B on
  frames and reference images, frame sampler on reference clips → only then host
  what cannot travel inline) and a paragraph on download-then-return.
  `V1_RELEASE_PLAN.md` gains the cloud-video checklist rows and a note on the
  flipped flag.

**Verified**

- `check:types` web 26 / node 10 (both at baseline); vitest **149 files / 1466
  tests green** (+7: the seed capability mapping in both directions, and the
  agent tool's provider gate, unknown-model listing, `'agent'` attribution,
  artifact shape and Content-Safety pass-through).
- **The flag flip, proved by absence**: the dev app was launched with
  `VITE_FF_FLOWS=1` and **no** `VITE_FF_VIDEO_STUDIO`, and the Videos tab is in
  the nav with the generation panel behind it. Under Stage 4's code that same
  launch hid the screen.
- **The Flows inspector, live on BytePlus Seedance 2.5**: Duration is a
  **4–30 s slider** (not the old ten-value select); Aspect Ratio lists
  `16:9 9:16 1:1 4:3 3:4 21:9 adaptive` — including BytePlus's own `adaptive`,
  which the static union never had; Resolution lists `720p 480p 1080p` with no
  "Model default" row and no 4K; the audio toggle is present because this model
  makes audio; **there is no Seed input at all**; and the estimate reads
  `~$6.90 estimated per run` for the 30 s the node was seeded with. The node had
  been created with `resolution: ''` and `seed: '12345'` on purpose — the
  inspector re-clamped the **saved** config to `resolution: '720p'`, `seed: ''`.
- **The node still runs.** Duration and resolution set through the narrowed
  controls themselves (4 s, 480p — both persisted to the saved flow), then Run:
  complete in **167.1 s**, the node preview playing the local `file://` clip
  (readyState 4, 4.04 s), the clip filed with a thumbnail and the ModelArk URL
  kept only as `sourceUrl`, and the usage row reading `byteplus /
  dreamina-seedance-2-5-260628 / **flows** / $0.40` — the feature source that
  tells the node apart from the panel.
- **The provider matrix is complete.** Stage 4 covered fal t2v, BytePlus t2v and
  fal reference; this stage ran the remaining three from the Videos panel, all
  4 s at 480p:

  | leg | provider · model | took | usage row |
  |---|---|---|---|
  | image-to-video | fal · `seedance-2.5` | 187.7 s | `$0.88`, 0 out-tokens |
  | image-to-video | byteplus · `dreamina-seedance-2-5-260628` | 229.1 s | `$0.40`, **77 260** out-tokens |
  | reference-to-video | byteplus · `dreamina-seedance-2-5-260628` | 320.4 s | `$0.40`, 38 830 out-tokens |

  Each clip was downloaded, frame-sampled and filed with a thumbnail; the
  provider URL survives only as `sourceUrl` (fal CDN for the first, ModelArk TOS
  for the other two). The BytePlus image-to-video job bills **twice** the
  out-tokens of a text-to-video job of the same length and resolution — worth
  knowing, since the catalog's per-second estimate does not model it.
- **The chokepoint order, in the log, for the BytePlus reference job**:
  `Sampling video` on the input clip → **then** `FalStorage Uploaded reference
  media` → **then** `Video job submitted` → `Sampling video` on the output. That
  is the ModelArk fallback working as designed: `video_url` takes a URL or an
  asset id only, so a reference clip is hosted through fal storage — and it is
  gated before it is hosted, not after.

**Found while driving**

- **ModelArk refuses an image under 300 px tall.** The first BytePlus i2v
  attempt used a Video Studio *thumbnail* (480×270) as the first frame and came
  back `expected the height to be at least 300px, but received a 480x270px image
  instead` with its request id — the provider's own message, surfaced verbatim
  in the panel, and no job card created. Re-seeding the reference library with a
  full-resolution frame (854×480, drawn out of a real clip through a `<video>` +
  canvas in the renderer) fixed it. Worth a line in the panel's first-frame hint
  later; it is not something the catalog can express today.
- **Two live jobs were lost to a careless driver.** A cleanup loop that clicked
  "the button inside any div matching a loose selector" hit two job cards'
  **Cancel** instead of the reference chips it meant to clear. The app behaved
  correctly throughout — the fal job cancelled, and BytePlus answered with its
  documented refusal to cancel a *running* task, logged as `Provider cancel
  failed (job already marked cancelled)`. The lesson is the driver's, and it is
  now in `docs/ui-automation-cdp.md`: never click by a selector loose enough to
  match something destructive.
- Two more driver lessons, same doc: an unfiltered `document.querySelectorAll`
  picks **stale nodes from screens that stay mounted by design** (the first
  React Flow node found belonged to a previously-opened editor, and its rect led
  every click astray); and a backslash Windows path loses one level of escaping
  through `Runtime.evaluate` (`\v` ate the `v` of `video-studio`), so pass
  forward slashes.

**Open / for Hasan**

- **Cost estimates are per model and resolution, not per route.** The
  reference-with-video-input discount is still not modelled, and the BytePlus
  double-token observation above says image-to-video is not priced like
  text-to-video either. Every model without a per-resolution rate is still
  labelled "at list rate".
- **In-flight job cards remain renderer state (D5)**, with no "list active jobs"
  IPC to re-attach after a reload. Unchanged from Stage 4, still fine for V1,
  and worth a known-issues line.
- The `generate_video` tool and its provisional types file are **dead code until
  agents Stage 1**. That is deliberate, but it means the first agents session
  should reconcile `AgentToolDef` with `docs/agents-plan.md` §1.3 rather than
  adopt the stub as-is.

**This closes the video-providers plan.** All five stages are done: the provider
registry (592bca4), the video engine (f5030c5), BytePlus ModelArk with editable
catalogs and reference-to-video (5de9aec), the Videos generation panel (12d85ae),
and this stage. Video generation now has the shape every other capability has —
an engine, a provider interface, editable catalogs, one safety chokepoint and
three entry points — and it is reachable in a V1 build.
