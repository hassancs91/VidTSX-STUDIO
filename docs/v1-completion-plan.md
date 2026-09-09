# V1 completion — the feature wave that ships under the first release

> Status: PLAN (written 2026-09-09 with Hasan). Nine workstreams, all of them
> IN the first release. Companion plans: `docs/flows-plan.md` (W8 — all seven
> stages ship in V1; its own discussion is still owed, see §0.2),
> `docs/agents-plan.md` (the runner, registry, package format and built-ins
> that W1, W7 and W9 extend), `docs/studio/AGENT_MEMORY_DESIGN.md` (W4 and W5
> build on its memory tiers), `docs/video-providers-plan.md` (the provider
> pattern W2 copies), `docs/CONTENT_SAFETY_DESIGN.md` (the chokepoints every
> new generator must sit behind), `docs/SKILLS.md` (presets compose like
> skills).

## Start here (for the session that begins a workstream)

1. Read §0 (decisions) and §1 (what exists) in full, then only the
   workstream you are on. Each workstream lists its files, its contract
   deltas and its acceptance rows; append an "outcome" subsection when it
   lands, the way `docs/agents-plan.md` does.
2. Preconditions: `check:types` at baseline and `npx vitest run` green on
   `main`. Parallel sessions work this repo — commit with explicit pathspecs,
   never stash (see the memory note on parallel sessions).
3. `package.json` is already 1.1.0 and both built-in agents declare
   `minAppVersion: 1.1.0` (the coupled bump of 2026-09-08). "V1" means the
   first real release; the NUMBER stays ≥ 1.1.0 because a 1.0.0 tag was
   published during the accidental public window in July. Do not lower it.
4. The Studio editor is still `studio-editor: false` in
   `src/shared/feature-flags.ts` — production renders Coming Soon. The flip
   is part of this plan (§3) and happens after W5, with its own testing pass.
5. House rules hold for every file: feature isolation, IPC-only bridge,
   services own logic, ~300 lines per file, named exports, exact-pinned
   Remotion. `studio-agent.ts` is already ~880 lines; W3 splits it before
   adding to it.

## 0. Decisions recorded on 2026-09-09

1. **Everything below ships in the first release.** No 1.2 wave. The list
   is roughly 23 sessions; the order in §3 is chosen so the app is
   releasable at every cut line if the date moves.
2. **Flows ships in V1, all seven stages**, per `docs/flows-plan.md`. Hasan
   wants one more discussion on it; that discussion is recorded in the flows
   plan, not here. This plan only lists what the other workstreams need
   from flows (§2.8).
3. **The Studio agent keeps its own tool server** (`createSdkMcpServer` in
   `src/main/services/studio/studio-agent.ts`). It is NOT rebased onto the
   shared agents registry. It gains capabilities by adding tools that call
   the same main-process services the shared tools call (the way
   `generate_image` already does).
4. **No Audio Studio screen now.** ElevenLabs SFX and music are reachable
   through the Studio agent, the Agents tools and (later) a Flows node. A
   manual generation panel is a later feature.
5. **Vocabulary lives on the brand.** `StudioBrand` gains `vocabulary[]`.
   The memory tier `vocabulary` stays as the PROPOSAL path and promotes into
   the brand, the way rules promote into `styleNotes` today.
6. **"Presets" in Studio are editing playbooks**, one per kind of video
   ("my shorts", "course lessons"): skill-like instructions + an editing
   style + the workflow the agent follows every time. They are a new
   library entity (§2.5), selected per project, and "learn from this video"
   writes into them.
7. **TSX "presets → brands" needs no new work.** The TSX panel already has
   the brand picker (`MotionInputPanel.tsx`). W7 only has to feed the same
   brand into agent mode, and W1 verifies the brand instructions reach both
   the 2D and 3D pipelines.
8. **Web design is a built-in agent that ships with the app**, not a
   screen. A dedicated Web Studio screen is out of scope until the agent
   proves demand.
9. **Home ships without a universal prompt box.** It must look professional
   (UI_SPEC tokens, no marketing copy); the "one prompt that routes to the
   right agent" is deferred.

## 1. What exists (survey of 2026-09-09)

| Item on Hasan's list | State today | Where |
|---|---|---|
| Seedream on ModelArk | ModelArk is video-only: `capabilities: ['video']`, client has no `/images/generations` | `src/shared/providers/registry.ts:51`, `src/shared/providers/byteplus/byteplus-client.ts` |
| Per-model image params | Local models have `SdGenerationDefaults` per family/model but no override store and no UI; cloud request has no steps/guidance/seed at all; catalogs are sanitised to `{id,name}` on save | `src/local-image-engine/types.ts:8`, `family-presets.ts:115`, `src/image-engine/types.ts:10`, `src/main/services/provider-models.ts:40` |
| Project thumbnails | None; card shows a grey box. Media thumbs exist (`cache/thumbs/<assetId>.jpg`) | `ProjectBrowser.tsx:242`, `media-import.ts:125` |
| Model switching (Studio, Agents, TSX) | Provider-only everywhere. No LLM model catalog exists. `StudioAgentSettings.model` exists with no UI; the agents runner accepts a per-turn `model` the renderer never sends | `src/engine/presets.ts:3`, `src/shared/types/studio.ts:274`, `src/shared/ipc/types/agents.ts:166`, `agent-runner.ts:59` |
| ElevenLabs SFX / music | ElevenLabs is STT-only. TTS is local sherpa only | `registry.ts:89`, `src/audio-engine/` |
| Flows | Plan written, zero stages done; legacy renderer-side flows module is what the plan retires; env-gated | `docs/flows-plan.md`, `src/features/flows/` |
| Home | No home screen; default screen is `creator`; routing is the `screens` map | `src/renderer/App.tsx:24-36,113` |
| Studio agent capabilities | 11 tools: transcript, cuts (editorial only), shots, image, rembg, captures, memory, style promotion. No auto-cut, no video, no audio, no insert, no export | `studio-agent.ts:206-880` |
| TSX agent mode | None. Options are thinking, loop count, optimise, refs | `useMotionGenerator.ts:35` |
| Brands in Flows / Agents | Agents capture the library default brand silently; no picker, no `get_brand`. Flows: nothing | `agent-service.ts:152`, `session-context.ts:73` |
| Cut + editorial from the agent | Editorial pass = `propose_cuts` exists. Auto Cut is renderer-only via `studioCutPlanRun` | `useAutoCut.ts`, `cut-plan-runner.ts` |
| Vocabulary | A memory kind with `aliases`, rendered into the prompt, NOT sent to any STT provider | `studio-memory.ts:19`, `assemblyai-provider.ts:105` |
| Script input | None anywhere in the transcription request path | `asset-transcriber.ts`, `run-transcription.ts` |
| Presets / learn | Memory rules + brand `styleNotes` (2000 chars) + gated proposals. No playbook entity, no timeline analysis | `agent-memory.ts`, `agent-style-promotions.ts` |
| Web design | Nothing. Agents platform has artifacts, viewers, packages, skills | `src/main/services/agents/`, `resources/agents/vidtsx/` |

## 2. Workstreams

### 2.1 W1 — Model foundation — ~1.5 sessions

**Goal.** A user can pick a MODEL, not only a provider, wherever an LLM
runs: the Studio agent (two slots), Agents sessions, the TSX panel, flows
node binding (already free-text). Per-turn switching in both chats.

**Design.**

- `src/shared/presets/llm-models.ts` — `LLM_MODEL_CATALOG: Record<ProviderType, LlmModelCatalogEntry[]>` with `{ id, name, tier?: 'fast' | 'balanced' | 'deep', supportsThinking?: boolean, note? }`. Seed lists per preset (claude-subscription and claude-api: `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`; the others from their current `defaultModel` plus the obvious siblings). Every list is VERIFIED against the provider at build time by the session that lands it — a stale id is worse than a short list.
- User-editable the way image and video catalogs are: `ModelCatalogSection` gains `category: 'llm'` (the `{id,name}` sanitiser already fits). Free-text "Custom…" stays allowed everywhere (the Flows picker precedent, `LlmModelPickerField.tsx`).
- `src/renderer/components/ModelSelect.tsx` + `useModelPicker(providerId)` beside `ProviderSelect`. One cluster: provider → model → thinking dial. Thinking options hide when the model does not support thinking.
- **Studio**: `StudioAgentSettings { providerId?, model?, shotModel?, thinking? }`. Inspector shows "Planning model" and "Shot model"; `shotGenerator` and the editorial-cut call read `shotModel` (fallback `model`). The composer in `AgentPanel.tsx` gets a chip ("Fable · Deep") that opens the cluster; the choice applies to the next turn and STICKS for the session (persisted into project settings).
- **Agents**: `CreateAgentSessionInput.model?`, `session.json` gains `model`; `useAgentRun` sends `model` (the field at `agents.ts:166` is already read by the runner). Same composer chip. `StarterFlow` picks provider + model.
- **TSX**: `MotionInputPanel` gains `ModelSelect`; `generateTsxPipeline` already takes a model via the request.
- Claude Agent SDK constraint: the subscription route only accepts model ids the SDK knows. Acceptance includes one real turn per catalog entry on `claude-subscription`.

**Contract deltas.** `StudioAgentSettings` (+`shotModel`, `thinking`), `CreateAgentSessionInput` (+`model`), `AgentSession` (+`model`), settings gain `llmModelCatalogs` overrides (same shape as image/video overrides).

**Acceptance.** (1) Studio: plan with Fable, generate a shot with Sonnet, usage log shows both models on the same project. (2) Agents: switch model mid-session, next turn's usage row carries the new model. (3) A custom typed id round-trips through settings and reaches the provider. (4) Brand instructions reach the 3D pipeline (decision 7 check).

#### W1 outcome (2026-09-09) — what was built, what the verification changed, and what it leaves

All four acceptance rows hold, three of them driven in the real app on a
second dev instance (own profile, CDP 9223 — the export-engines session kept
9222) through `window.api` alone, the fourth as a unit test. `check:types`
at baseline (web 26, node 10); 1786 tests passing, up from 1764.

**The catalog as verified, not as planned.** Every seeded id was called for
real before it stayed (the plan's rule: a stale id is worse than a short
list). The calls ran headless under Electron with the keys the app already
holds (safeStorage, decrypted in-process, never written), which is why the
list differs from the design bullet:

- **`claude-fable-5-1` is NOT in the Claude catalogs.** On the subscription
  route the Agent SDK answers `400 … Claude Code 2.1.119 does not support this
  model; version 2.1.251 or newer is required` — the SDK pinned in
  `package.json` (`@anthropic-ai/claude-agent-sdk` 0.2.119) bundles that
  Claude Code. This closes §5 open question 1 for Fable with a NO until the
  SDK is bumped to one that bundles ≥ 2.1.251; that bump is its own change
  (the engine's thinking/effort surface rides on it) and is the one follow-up
  W1 leaves. Fable IS reachable today through OpenRouter
  (`anthropic/claude-fable-5.1`, verified). Acceptance row 1 therefore ran
  with Opus 5 as the planning model.
- **Claude (subscription and API key):** `claude-opus-5`, `claude-sonnet-5`,
  `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` — all
  five answered on the subscription route (`claude-haiku-4-5` also works as
  an alias and is what row 3 typed). No API key was stored on the verifying
  machine, so `claude-api` carries the same list on the strength of the same
  SDK path.
- **MiniMax** `MiniMax-M3`, `M2.7`, `M2.5`; **Kimi** `kimi-k3`,
  `kimi-k2.7-code`, `kimi-k2.6` (the k2.x ids the design guessed at are
  "not found" on Moonshot's Anthropic route); **OpenRouter** 17 ids across
  Anthropic (dotted ids — `anthropic/claude-opus-4.8`, not `-4-8`), OpenAI
  5.5/5.4/5.4-mini, Gemini 3.1 Pro / 3.5 Flash, DeepSeek V4 Pro/Flash, Grok
  4.6, Kimi K3, GLM 5.3, MiniMax M3. All answered.
- **OpenAI, Gemini, Z.AI:** no key available, and all three are hidden in V1
  (`V1_HIDDEN_PRESET_IDS`). Each carries only its preset `defaultModel`,
  flagged in the file as unverified.

**Where the list lives.** `src/shared/presets/llm-models.ts` keys the catalog
by PRESET id (`claude-subscription`, `openrouter`, …), which is what
`LlmProviderConfig.id` carries — not the `ProviderType` the design wrote,
since one type (`agent-sdk`) spans five presets with disjoint lists. The
lists compose into `PROVIDER_MODEL_DEFAULTS` under `category: 'llm'`, so the
existing Model Catalogs card, the `{id,name}` sanitiser and the
`providerModels` override key all applied unchanged; the only handler change
is that saving an llm catalog re-registers no engine (the model id travels
per request). `tier`, `supportsThinking` and `note` survive a user edit by
being read back from the shipped entry by id, the image-price rule.

**The cluster.** `useModelPicker(providerId)` resolves '' (Studio's "app
default") to the active provider, merges overrides over defaults, and
re-reads on `vidtsx:llm-models-changed`. `ModelSelect` = provider default →
catalog → Custom… (free text, any id). `ModelPickerChip` is the composer chip
both chats share: provider → model → thinking, thinking hidden when the
catalog marks the model `supportsThinking: false`; a custom id keeps the dial
because the engine already drops thinking/effort on models without them.
`claude-capabilities.ts` gained the Claude 5 surface (Fable, Opus 5, Sonnet
5, Opus 4.8: adaptive, effort to `max` incl. `xhigh`, display must be asked
for) and normalises OpenRouter's dotted ids, so `anthropic/claude-opus-4.8`
hits the same rows as `claude-opus-4-8`.

**Contract deltas as built.** `StudioAgentSettings` +`shotModel`,
+`thinking` (a `ThinkingLevel`); `StudioAgentSendRequest` +`shotModel`,
+`thinking`; `StudioShotGenerateRequest` / `StudioShotImportRequest` +`model`
(the conform pass runs on the shot model too); `TsxJobOptionsIpc`,
`TsxGenerateOptions`, `TsxPipelineOptions`, `TsxEditOptions`,
`TsxEditPipelineOptions` +`model`, threaded through every `buildLlmRequest`
site including the fix loop; `AgentSession` +`model`;
`AgentSessionCreateRequest` +`model`. Two things the design did not spell
out: (a) `generate_tsx_shot` runs on `shotModel ?? model`, injected at the
`buildShotEngineDeps` seam so every pipeline step of a shot inherits it; the
"editorial-cut call" the design named is the planning turn itself
(`propose_cuts` is a tool the planning model calls — there is no second LLM
call), so it runs on `model`; (b) an Agents turn that names a provider/model
PATCHES the session record before running (`rememberModelChoice`), which is
what makes the choice stick and lets the workspace restore it on reopen —
`model: ''` on a turn means back to the provider default.

**Acceptance evidence.** (1) A Studio turn with `model: claude-opus-5`,
`shotModel: claude-sonnet-5`, `thinking: medium` generated a title-card shot
and proposed it; the usage log read, newest first, `auto-cut:claude-opus-5 |
studio-tsx-shot:claude-sonnet-5 | studio-tsx-shot:claude-sonnet-5` — the two
shot rows are the generate and verify steps. (2) A `vidtsx/assistant` session
created on Sonnet 5, turn 1 on Sonnet 5, turn 2 with `claude-haiku-4-5-
20251001`: `session.json` then carried the Haiku id and the agent usage rows
read `claude-haiku-4-5-20251001 (vidtsx/assistant) | claude-sonnet-5
(vidtsx/assistant)`. (3) `claude-haiku-4-5` typed into the subscription llm
catalog: saved as `Customized`, re-read from settings with the id present,
`llmGenerate` on it returned `model: "claude-haiku-4-5"`, the usage row
`other:claude-subscription:claude-haiku-4-5`; reset restored `Defaults`. (4)
`prompt-builder.test.ts`: the brand block given as `extraInstructions`
appears verbatim in the 2D and the 3D generate prompts, and the 3D prompt is
the 3D one.

**Second-instance recipe, exercised.** `electron-vite dev --outDir
.vidtsx-temp/w1-out --entry .vidtsx-temp/w1-out/main/index.js
--remoteDebuggingPort 9223 --inspect 9229 -- --user-data-dir=<profile>`.
Three things the memory note did not know: `--outDir` alone still launches
`package.json`'s `main` (the OTHER session's stale `out/`), hence `--entry`;
under `--entry` Electron's `app.getAppPath()` is the out dir and
`app.getVersion()` is Electron's, so `resources/agents` is not found and the
Agents page is empty — `app.setAppPath(<repo>)` through the main inspector
fixes it live; and the fresh profile registers the subscription preset by
default, so no key seeding was needed for a Claude-only run.

**Not done / left for later.** The Flows `LlmModelPickerField` keeps its
free-text box (W8 rebuilds the node inspector); no thinking dial for Agents
sessions (the manifest's `defaults.effort` still governs — a per-session dial
is a W7/W8 question); the SDK bump that unblocks Fable.

### 2.2 W2 — Providers — ~3.5 sessions

#### W2a Seedream images on BytePlus ModelArk — ~1 session

- `registry.ts` byteplus → `capabilities: ['video', 'image']`. Key test stays the video call.
- `byteplus-client.ts` gains `createImage(body)` → `POST /images/generations`. Body: `model`, `prompt`, `image?` (url or base64, one or an array for multi-reference), `size` (`"2K"` or `WxH`), `seed?`, `guidance_scale?`, `watermark: false`, `response_format: 'b64_json'`, `sequential_image_generation` for sets. Types in `byteplus/types.ts`.
- `src/image-engine/providers/byteplus-image-provider.ts` behind the existing image engine, so the content-safety chokepoint, usage logging (`priceUsd` per model) and the library filing come free. Static catalog `BYTEPLUS_IMAGE_MODELS` in `src/shared/presets/image-model-entries.ts`: `seedream-4-5`, `seedream-5-0-lite`, `seedream-5-0-pro`, with `supportedOperations: ['txt2img', 'img2img', 'reference']`. Users can add ids like today.
- Image Studio's reference-image UI must light up for these models (they are multimodal); the `FalModelDef.supportedOperations` idea becomes the dialect capability in W2c.

**Acceptance.** Text→image, image→image and a two-reference call on a real key; the Studio agent's `generate_image` picks it when it is the active image provider; usage row logged with price.

#### W2b ElevenLabs sound effects + music — ~1.5 sessions

- New `ProviderCapability` `'audio'`; ElevenLabs → `['stt', 'audio']`. Key hint unchanged.
- `src/audio-engine/generation/` — `AudioGenerationEngine` with one request shape: `{ kind: 'sfx' | 'music', prompt, durationSec?, loop?, promptInfluence?, compositionPlan?, seed?, outputFormat }`. Provider `elevenlabs-audio-provider.ts`: SFX → `POST /v1/sound-generation` (0.5–30 s, `loop`, `prompt_influence`, `duration_seconds` or auto); music → `POST /v1/music` (`prompt` XOR `composition_plan`, `duration_ms` 3 000–600 000, `model_id: 'music_v2'`). Output MP3 → library as an audio asset via `generate-audio-asset.ts` (mirror of `generate-video-asset.ts`), brand-tagged.
- IPC `AUDIO_GENERATE`; `AiRequestType` += `'audio'`; usage logged with the provider's per-second price when known.
- Content safety: Gate A is defined on VISUAL fields only and LLM surfaces get zero hooks (`CONTENT_SAFETY_DESIGN.md` D0.2). Audio prompts are neither; they are NOT gated. Record this in the design doc's ledger when landing.
- Tools: Studio `generate_sfx` / `generate_music` (W3 wires them to `insert_asset`), Agents `generate_audio` (artifact kind `audio`, viewer = the existing audio player), Flows node in W8 Stage 3.
- ElevenLabs TTS is one more endpoint on the same client; NOT in scope, noted as a cheap follow-on.

**Acceptance.** A 3 s whoosh and a 30 s bed generated from the Studio agent, placed on the audio track at a word timestamp, exported. Usage rows present. Provider key missing → the tool returns the same "needs a provider" message the video tool uses.

#### W2c Per-model image parameters — ~1 session

- **Local first** (Hasan's ask). Settings key `imageModelParamOverrides: Record<modelKey, ImageModelParams>` where `ImageModelParams = Partial<SdGenerationDefaults> & { negativePrompt?, scheduler?, seed?, strength? }`. `local-sd-provider` resolves `request ⊕ override ⊕ family default` (`sd-cli-runner.ts` already accepts all of these).
- Gear button on every row of `ImageModelsContent.tsx` → `ModelParamsDialog.tsx`: schema-driven form (width, height, steps, cfgScale, sampler, scheduler, negative prompt), family defaults shown as placeholders, "Reset to defaults". Schema per family comes from `family-presets.ts`; the dialog never hardcodes fields.
- **Cloud second**, copying the video pattern: `ImageDialectId` (`fal-flux` | `fal-generic` | `cloudflare` | `byteplus-seedream` | `openrouter` | `gemini-cli`), `IMAGE_DIALECT_DEFAULTS` with a `paramSchema` per dialect (steps, guidance, seed, size mode, references cap), `hydrateImageEntry`, and `sanitizeEntries` preserving `dialect` for `category === 'image'`. Same gear button on `ModelCatalogCard` rows; overrides keyed `provider/model`. Image Studio's advanced panel renders the selected model's schema.

**Acceptance.** Change steps on one local model, generate, the sd-cli argv shows the override; reset restores family defaults; a cloud model's dialog shows only the fields its dialect declares.

### 2.3 W3 — Studio agent goes end-to-end — ~2 sessions

**Goal.** "Edit this video" in chat runs transcribe → auto cut → editorial → shots → b-roll → SFX/music → captions → export with the user only answering cards.

**Design.**

- Split `studio-agent.ts` into `src/main/services/studio/agent-tools/*.ts` (one file per group: transcript, cuts, shots, assets, generation, memory) with the server assembled in a ~100-line `studio-agent.ts`. Pure move first, one commit, no behaviour change.
- New tools, each a thin call to an existing service:
  - `transcribe_asset(assetId, engine?)` → `asset-transcriber.ts`; returns when done, streams progress as agent events.
  - `run_auto_cut(assetId | range, params)` → `cut-plan-runner.ts`; emits the SAME proposal the toolbar button emits (Studio plan §6: "buttons and chat converge").
  - `generate_video(prompt, refs?, model?)` → `generate-video-asset.ts` (library filing, brand tag, usage) — the service the agents tool calls.
  - `generate_sfx` / `generate_music` → W2b engine.
  - `insert_asset(assetId, mode: 'broll' | 'overlay' | 'audio', at: seconds | { word, take }, duration?, gain?)` → a new `timeline-insert.ts` service that produces a small proposal (one-clip) or applies directly when the user asked explicitly (the plan's "small explicit asks apply directly, undoable").
  - `list_assets(kind?)`, `get_brand()`, `get_preset()` (W5), `get_script()` (W4).
  - `export_project(preset?)` → the render queue; returns the job id; the existing live-row logic shows progress.
  - `accept_proposal(id)` — exists ONLY so "apply it" in chat works without a click. Prompt rule: call only when the user's latest message explicitly says to apply; the card still shows what was applied, with undo.
- Prompt: `studio-agent-prompt.ts` gains the end-to-end workflow section, parameterised by the preset (W5). `AGENT_MAX_TURNS` raised for preset runs (measure; 32 is too few for eight steps with cards).

**Acceptance.** One chat line on a raw talking-head clip produces an exported MP4 with cuts, two shots, one b-roll, one SFX and captions, the user only accepting cards. Cancel mid-run leaves the timeline consistent. Every generated asset is brand-tagged and in the usage log.

### 2.4 W4 — Script, vocabulary, brands everywhere — ~1.5 sessions

- **Script.** `project.script?: string` (timeline document, versioned with the schema). A Script tab beside Transcript in the editor (`TranscriptPanel` sibling). `get_script` tool; the first ~1 500 chars are injected as context, the rest on demand. Editorial cuts get the script as "the intended final read" (which take is the keeper).
- **Vocabulary on the brand.** `StudioBrand.vocabulary?: { term: string; aliases?: string[] }[]` (validate/normalise in `src/shared/studio/brand.ts`, cap 200). `BrandForm` gets a vocabulary editor. `propose_vocabulary` tool + card (multi-select accept) — the agent proposes after every transcription and from the script: proper nouns, product names, mangled spellings. Accept writes the project's brand (main stamps the brandId, like style promotion) and retires the matching memory entries. Memory `vocabulary` entries with no brand stay app-wide.
- **STT feed.** `TranscriptionRequest.keyterms?: string[]` composed in `asset-transcriber.ts` from brand vocabulary + script proper nouns (deterministic capitalised-token extraction, capped) + active vocabulary memories. AssemblyAI → `keyterms_prompt` (or `word_boost` per model); ElevenLabs Scribe → its keyterms field if the API has one, else skipped; whisper.cpp → `--prompt`. Then a deterministic post-pass replaces aliases in the word list (case-insensitive exact token), logged per replacement.
- **Brands in Agents.** Brand picker in `StarterFlow` and session creation (`CreateAgentSessionInput.brandId` exists); `get_brand` tool in the shared registry; the built-ins' AGENT.md reference it.
- **Brands in Flows.** Recorded here, built in W8: brand as a run-level input, per-node `brandId` config on image, composition, text and audio nodes.

**Acceptance.** A transcript of a clip that says "VidTSX" three times comes back spelled right with the term on the brand; the agent proposes the two names the script mentions; the provider debug log shows the keyterms field was sent.

### 2.5 W5 — Editing presets + learn from this video — ~2 sessions

**The entity.** `StudioPreset`, folder-as-truth like brands: `<assetsRoot>/presets/<id>/preset.json` + `PRESET.md` (+ optional `skills/` in the SKILLS.md folder format).

```ts
interface StudioPreset {
  id: string; name: string; description?: string;
  videoKind: 'short' | 'long' | 'course' | 'custom';
  orientation?: '16:9' | '9:16' | '1:1';
  defaultBrandId?: string;
  workflow: PresetStep[];       // ordered; the agent follows it
  style: {                      // structured knobs, all optional
    pacing?: 'tight' | 'normal' | 'relaxed';
    shotsPerMinute?: number; sfxPerMinute?: number;
    musicBed?: 'none' | 'quiet' | 'present';
    captions?: 'none' | 'karaoke' | 'block';
    transitions?: string[]; introSeconds?: number; outroSeconds?: number;
  };
  learned?: { projectId: string; at: string; summary: string }[];
  createdAt: string; updatedAt: string;
}
type PresetStep =
  | { id: 'transcribe'; engine?: string }
  | { id: 'auto_cut'; aggressiveness?: 'light' | 'normal' | 'aggressive' }
  | { id: 'editorial' } | { id: 'shots'; cadence?: number }
  | { id: 'broll'; source?: 'generate' | 'library' }
  | { id: 'sfx' } | { id: 'music' } | { id: 'captions'; template?: string }
  | { id: 'export'; renderPreset?: string };
```

- `PRESET.md` is the skill-like instruction body (the shorts hook rule, the course-lesson chapter structure, the tone). Composed into the Studio system prompt as `## Editing preset: <name>` AFTER skills and BEFORE the memory block, under a 4 000-char budget (`composeSystemPrompt` already takes a trailing block; add a middle one).
- Selected per project (`project.settings.presetId`), picker in the Inspector beside brand, offered in the new-project dialog. `get_preset` tool. `run_preset` is not a tool — the agent reads the workflow and calls the W3 tools in order.
- **Built-ins** in `resources/presets/`: "Talking-head short", "YouTube long-form", "Course lesson" — brand-scrubbed, copied into the library on first use so edits never touch resources.
- **Management UI** `PresetsDialog.tsx` on the Assets screen like `BrandsDialog`, with a markdown editor for `PRESET.md`.
- **Learn from this video.** Inspector button + chat ask → `learn-from-project.ts`: deterministic timeline stats (cuts/min, mean clip length, shots/min, SFX/min, music bed, caption usage, transitions used, intro/outro lengths, total length) + ONE LLM summary of what the user did by hand versus what the agent proposed → `propose_preset_update` card: a diff of the knobs and an appended "Learned from <project> on <date>" section in `PRESET.md`. Accept writes the preset; nothing is inferred silently (the memory design's rule). Memory rules remain the place for one-line imperatives.
- Later: a preset's workflow may reference a flow (`workflow: { flowId }`) once W8 Stage 4 lands. Reserve the field, do not build it.

**Acceptance.** Two projects with two presets produce visibly different edits from the same clip and the same chat line; "learn from this video" on a hand-tightened project proposes a pacing change with the numbers that justify it; a preset survives export/import as a `.vidtsx` reference (Q7f pattern, brand-style).

### 2.6 W6 — Project thumbnails + Home — ~1.5 sessions

- **Posters.** `StudioProjectSummary.posterPath?`. `<project>/cache/poster.jpg` written by `project-poster.ts` on save (debounced) and on close: the first video clip on the top-most video track at 10 % of the timeline → `ffmpeg -ss <sourceTime> -frames:v 1 -vf scale=480:-2` from the source (proxy if present). No video → no file; the card renders a brand-palette gradient with the project initials in CSS. `ProjectCard` shows it with the orientation preserved.
- **Home** as `src/features/home/`, default screen `'home'` in `App.tsx`, first in the sidebar. Sections, top to bottom: header (greeting, version, update chip if pending); **Continue** (recent Studio projects with posters, TSX projects, agent sessions — eight cards, "See all" to each screen); **Start** tiles (Edit a video, Create a motion graphic, Run an agent → quick starts, Generate image / video, Build a flow); **Status strip** (providers configured, AI runtime installed, queue running/failed, whisper model); **Announcements** (the existing feed, moved here from the app-level card). Data through one `HOME_SUMMARY` IPC that aggregates existing stores; no new persistence.
- Professional look: UI_SPEC tokens only, dense, no hero copy. Universal prompt deferred (decision 9).

**Acceptance.** Cold start lands on Home under the measured budget (the lazy-engine rule holds: Home reads stores, spawns nothing); every card navigates; a project with no video shows the placeholder.

### 2.7 W7 — TSX agent mode — ~1 session

- Toggle `Prompt | Agent` at the top of `MotionInputPanel`. Agent mode embeds the shared `AgentChat` bound to a built-in `vidtsx/tsx-composer` (`resources/agents/vidtsx/tsx-composer/`): tools `generate_composition`, `edit_composition`, `render_composition`, `generate_image`, `ask_user`, `propose_memory`; skill = the TSX craft rules already in the prompts, factored into a skill.
- The session carries `motionProjectId`; a composition artifact is ALSO written into the Motion project (one adapter, `motion-project-sink.ts`), so the preview and the render button work exactly as in prompt mode. Brand and model come from the panel's pickers (W1, decision 7).

**Acceptance.** "Make me a 10-second logo sting for my brand, then make the text bigger" produces two versions in the Motion project, both playable, the second an edit of the first.

### 2.8 W8 — Flows — per `docs/flows-plan.md`, all stages, ~8 sessions

Owned by the flows plan; the pending discussion goes there. What THIS plan needs from it, to fold into the flows discussion:

- The composition trio gets ports in Stage 1 (free), so the "TSX node" exists from Stage 3.
- `generate_audio` node (W2b) in Stage 3.
- Brand as run-level input and per-node config (W4).
- Model binding per node reads the W1 catalog instead of free text (keep free text as the escape hatch).
- Studio `run_flow` in Stage 4 goes into the Studio agent's OWN server (decision 3), calling the main runner.
- Editing presets may reference a flow later (W5); nothing to build now.

### 2.9 W9 — Web designer agent — ~1.5 sessions

- Built-in `resources/agents/vidtsx/web-designer/`: AGENT.md workflow (brief → structure → sections → assets → polish → export), skill `web-design` (typography scale, spacing, responsive rules, accessibility basics, section patterns for landing pages), tools `write_page`, `edit_page`, `generate_image`, `generate_video`, `generate_audio`, `capture_page`, `export_site`, `ask_user`, `propose_memory`. Brand injected (palette, fonts, logo refs) through `get_brand`.
- New artifact kind `web-page`: a self-contained HTML document (inline CSS/JS) plus referenced media artifacts. Viewer `WebPageViewer.tsx` in `src/renderer/components/agents/viewers/`: sandboxed iframe (`sandbox="allow-scripts"`, no `allow-same-origin`, CSP with no network), desktop / tablet / phone width toggles, "Open in browser" and "Export site" (zip: index.html + assets, via the existing zip writer).
- Media references resolve to artifact files copied beside the page at export; inside the viewer they are served as data URIs (16 MB cap per page, enforced by the tool).
- Starter: three questions (what is the page for, who is it for, which brand).

**Acceptance.** One session takes "a landing page for VidTSX with a hero video and three feature cards" to an exported folder that opens in Edge with the generated hero video playing; the viewer shows it at all three widths; nothing in the page can reach the network.

## 3. Order, cut lines and the Studio flip

| Step | Workstream | Sessions | Releasable after? |
|---|---|---|---|
| 1 | W1 model foundation | 1.5 | yes |
| 2 | W3 Studio end-to-end | 2 | yes (Studio still dev-only) |
| 3 | W4 script + vocabulary + brands | 1.5 | yes |
| 4 | W5 presets + learn | 2 | yes |
| 5 | **Studio flip** — `studio-editor: true`, a Studio testing pass on the raw-footage clips, docs | 1 | yes — first cut line with Studio |
| 6 | W2 providers (a, c, then b) | 3.5 | yes |
| 7 | W7 TSX agent mode | 1 | yes |
| 8 | W6 posters + Home | 1.5 | yes — second cut line |
| 9 | W9 web designer | 1.5 | yes |
| 10 | W8 Flows, all stages | 8 | release |

Flows last because it is the largest, still under discussion, and nothing
above depends on it; it can also run in a parallel session once its
discussion is done, since it touches `src/features/flows/`,
`src/main/services/flows*` and the agents registry's `ports` block only.

## 4. Rules that hold across workstreams

- Every new generator (Seedream, audio) sits behind the engine seam that
  already has content safety, usage logging and library filing. No direct
  HTTP from a tool.
- Tool ids are append-only in both registries. New Studio tools live in
  `agent-tools/*.ts`, never back in `studio-agent.ts`.
- Nothing new persists in `userData` except settings keys; content (brands,
  presets, posters) lives under the assets root or the project folder.
- Proposals stay gated. "End-to-end without clicking" means the user SAYS
  apply; it never means silent application.
- Feature flags: W6 Home and W7 agent mode ship on; W9 is a built-in agent
  (no flag); Flows flips from env-gated to on in its Stage 6.

## 5. Open questions

1. W1: does the Claude Agent SDK subscription route accept `claude-fable-5-1`
   and `claude-opus-5` by id? **Answered 2026-09-09 (W1 outcome):** Opus 5,
   Sonnet 5, Opus 4.8, Sonnet 4.6 and Haiku 4.5 yes; Fable 5.1 NO on SDK
   0.2.119 (bundled Claude Code 2.1.119; the API requires ≥ 2.1.251) — it
   returns with the SDK bump, and is reachable via OpenRouter meanwhile.
2. W2b: ElevenLabs music pricing per request is not in the docs read so far;
   usage rows log duration and leave price blank until known.
3. W4: which of AssemblyAI's `keyterms_prompt` and `word_boost` applies to the
   `universal` model the catalog defaults to. Checked against their docs
   when landing; the code path supports both.
4. W5: 4 000-char preset budget plus the 2 000-char memory block plus skills
   — measure adherence with the dilution-spike method before raising either.
5. W8: Hasan's pending flows discussion.
