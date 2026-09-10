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
   **Done 2026-09-10** — `studio-editor: true`, outcome in §3.1.
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

#### W2a outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

All four acceptance rows hold on a real ModelArk key, driven in the real
app on the second dev instance (W3 profile, own out dir, CDP 9223) through
`window.api` and the Studio agent chat, with every wire body captured by
wrapping the main process's `fetch` over the inspector. `check:types` at
baseline (web 26, node 10); 1955 tests passing, up from 1937. Commits
`55c9bc1` (client, provider, catalog, registry, engine, tests) and
`192d5f0` (the catalog card placeholder, the agent path's usage price).
Total spend: five Seedream 5.0 Pro images, about $0.23 (the failed and the Content-Safety-blocked attempts were not billed).

**The wire.** `BytePlusArkClient.createImage(body)` → `POST
/images/generations`, synchronous, `response_format: 'b64_json'` so nothing
is downloaded; a 200 carrying a top-level `error` with no `data` raises like
an HTTP error. The body is `model`, `prompt`, `size`, `response_format`,
`watermark: false`, then `image` (one data URI for image-to-image, an array
for multi-reference), `seed` when set, `output_format` on the 5.0 models,
and `sequential_image_generation` (`'disabled'` on a single image, `'auto'`
+ `sequential_image_generation_options.max_images` for a set) on the
models that take it. The reference pinned on 2026-09-10 lists NO
`guidance_scale` and NO `seed` for the 4.x / 5.x endpoint (both were
Seedream 3.0's API), so both were put on the wire once to find out: `seed:
12345` returned 200, `guidance_scale: 3` returned "the parameter
`guidance_scale` is not supported by the current model". The
`byteplus-seedream` dialect W2c declared as Guidance + Seed is therefore
**Seed only** now (`maxReferences` 14, per the 4.5 / 5.0 lite docs; 5.0 pro
takes 10 and the provider enforces its cap per model).

**Model ids and sizes.** The plan's `seedream-4-5` / `seedream-5-0-lite` /
`seedream-5-0-pro` were approximations; the ModelArk model list gives
`seedream-4-5-251128`, `seedream-5-0-lite-260128` (alias
`seedream-5-0-260128`) and `dola-seedream-5-0-pro-260628`, which is what
`BYTEPLUS_IMAGE_MODELS` in `src/shared/presets/image-model-entries.ts`
ships (the file the plan named; the fal / OpenRouter / Cloudflare lists stay
inline in `provider-model-defaults.ts`). Prices from the pricing page:
$0.04, $0.035, and $0.045 for pro up to 2.61 MP ($0.09 above — the provider
never asks pro for more than its 2K ceiling, so the lower tier is the
estimate; pro also bills $0.003 per reference from the second one, not
modelled). The part no other provider needed: ModelArk's explicit
`<width>x<height>` form has a total-pixel FLOOR per model — 2560×1440 worth
(3.69 MP) on 4.5 and 5.0 lite, 1280×720 worth on 4.0 and 5.0 pro (whose
ceiling is 4.62 MP) — so the app's usual 1024² and 1280×720 asks would be
400s. `fitBytePlusImageSize` scales the caller's aspect onto the model's
envelope on multiples of 16 (Image Studio's 1024² became `1920x1920` on
4.5; the agent's 1280×720 became `2560x1440` on 4.5 and stayed `1280x720`
on pro — all three seen on the wire); a size already inside goes through
untouched, no size at all sends the `2K` tier every model accepts. A
user-added id gets the envelope every listed model accepts (the 4.5 floor
under the pro ceiling), the pro's reference cap, and no version-specific
field, so an unknown Seedream id never gets a body the API rejects.

**What came free.** The provider sits behind `runGuarded`, so Gate A, Gate B
on inputs and outputs, the W2c param resolver, usage logging and library
filing all applied with no call-site change — and Gate B on INPUTS showed
itself on the way: the first image-to-image and two-reference attempts used
two solid-colour 256² PNGs as references and both were stopped at 0.1 s as
"borderline" before any request left the machine (the spy still held the
previous body). Real pictures went through. `generate-image-asset.ts` (the
Studio agent's and the agents' `generate_image`) had always logged `costUsd:
0`; it now uses the same `getDefaultImageModelPriceUsd` lookup as the Image
Studio IPC, which is what the last acceptance row needed.

**Acceptance evidence.** (1) Text→image on `dola-seedream-5-0-pro-260628`,
1280×720: 24.9 s, a 103 KB JPEG of a red apple; body `{model, prompt, size:
"1280x720", response_format: "b64_json", watermark: false}` and, on pro, no
sequential field. (2) Image→image with that apple as the source ("a glossy
red billiard ball on green felt"): 98 s, 1024×1024, body carried `image:
"data:image/jpeg;base64,…"` (113 871 chars) as one string; the output is a
red "1" ball on felt. (3) Two references (the apple + a library screenshot):
89 s, body carried `image: [data:image/jpeg…, data:image/png…]`; the output
a striped beach ball on sand. (4) The Studio agent: byteplus made the
active image provider, a seeded project, one chat line asking for an image —
`generate_image` went to ModelArk on the provider's default model (the body
shows `seedream-4-5-251128`, `size: "2560x1440"`) and came back with
"account … has not activated the model seedream-4-5-251128", which the
agent relayed verbatim with the console step; with the provider's default
model set to 5.0 pro (a Providers-page setting) the retry returned
`library:generated/a-single-red-apple-on-a-plain-white-tabl.png` (1280×720,
brand-tagged) with `output_format: "png"` on the wire. Usage rows: four
`byteplus / dola-seedream-5-0-pro-260628 / image-generation / $0.045` and
one `studio-shot-asset / $0.045` for the agent's image. Image Studio with
byteplus active lists Seedream 4.5 / 5.0 Lite / 5.0 Pro, and Reference mode
shows the Reference Images library plus the Advanced disclosure (Seed).
Everything seeded was removed afterwards (project, the agent's library
image and its index entry; active provider back to gemini-cli, the byteplus
default back to Seedream 4.5).

**Not done / left for later.** Seedream 4.5 and 5.0 lite are NOT activated
on Hasan's ModelArk account (`3004239178`) — only 5.0 pro is — so rows 1–3
were run on pro and the 4.5 / lite bodies were verified on the wire up to
the activation error. To run them: console.byteplus.com/ark → Model
activation → activate `seedream-4-5-251128` and `seedream-5-0-lite-260128`,
then Image Studio → provider BytePlus ModelArk → model Seedream 4.5 →
Generate (1024² lands as 1920×1920, $0.04). Until then a fresh install's
default (Seedream 4.5) fails with the activation message on that account;
the shipped default stays 4.5 because activation is per account, and the
Providers page's default-model select is the switch. Sets on 4.5 / lite use
`sequential_image_generation: 'auto'`, where the COUNT is the model's call
(≤ `max_images`), not the exact number Image Studio asked for — untested
live (not activated); pro loops one call per image and is exact.
`maxReferences` in the dialect schema is still informational — no UI reads
it (pre-existing). The 5.0 pro `layer_decomposition`, `background:
transparent` and marker-based interactive editing are not surfaced. Seed
determinism on pro was not measured (one seeded run, no repeat).

#### W2b ElevenLabs sound effects + music — ~1.5 sessions

- New `ProviderCapability` `'audio'`; ElevenLabs → `['stt', 'audio']`. Key hint unchanged.
- `src/audio-engine/generation/` — `AudioGenerationEngine` with one request shape: `{ kind: 'sfx' | 'music', prompt, durationSec?, loop?, promptInfluence?, compositionPlan?, seed?, outputFormat }`. Provider `elevenlabs-audio-provider.ts`: SFX → `POST /v1/sound-generation` (0.5–30 s, `loop`, `prompt_influence`, `duration_seconds` or auto); music → `POST /v1/music` (`prompt` XOR `composition_plan`, `duration_ms` 3 000–600 000, `model_id: 'music_v2'`). Output MP3 → library as an audio asset via `generate-audio-asset.ts` (mirror of `generate-video-asset.ts`), brand-tagged.
- IPC `AUDIO_GENERATE`; `AiRequestType` += `'audio'`; usage logged with the provider's per-second price when known.
- Content safety: Gate A is defined on VISUAL fields only and LLM surfaces get zero hooks (`CONTENT_SAFETY_DESIGN.md` D0.2). Audio prompts are neither; they are NOT gated. Record this in the design doc's ledger when landing.
- Tools: Studio `generate_sfx` / `generate_music` (W3 wires them to `insert_asset`), Agents `generate_audio` (artifact kind `audio`, viewer = the existing audio player), Flows node in W8 Stage 3.
- ElevenLabs TTS is one more endpoint on the same client; NOT in scope, noted as a cheap follow-on.

**Acceptance.** A 3 s whoosh and a 30 s bed generated from the Studio agent, placed on the audio track at a word timestamp, exported. Usage rows present. Provider key missing → the tool returns the same "needs a provider" message the video tool uses.

#### W2b outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything the spec lists is built, unit-tested and committed, and the whole
app-side path ran in the real app on the second dev instance (W3 profile,
own out dir, CDP 9223) — but **no ElevenLabs key exists on this machine**:
the W3 profile and the primary profile both hold `assemblyai`, `openrouter`,
`fal` and `byteplus` only (checked inside the main process over the
inspector, `providerCredentials` and the legacy `sttProviders` rows alike;
the W3 transcriptions were AssemblyAI's). The brief's premise that the STT
key was there was wrong, so the two live rows that need ElevenLabs' own
answer are **PENDING** below with the exact steps, and nothing about them is
fabricated. What DID run live: the no-key row on the real wire, and the
end-to-end Studio run with ONLY the ElevenLabs HTTP response stubbed inside
main (a fetch wrapper over the 9229 inspector that recorded every request
body and answered with two local MP3s) — engine, filing, import, the word
anchor, the audio lane, the review cards and the export are all the
production code. `check:types` at baseline (web 26, node 10); 1990 tests
passing, up from 1955. Commits `170edef` (engine, provider, registry
capability, `AUDIO_GENERATE`, filing, usage), `5e6ac90` (the Studio tools,
the Agents tool, the `audio` artifact kind + viewer), `0a2dde2` (the audio
lane fix the run found), and the docs commit. Spend: one AssemblyAI
transcription ($0.004); the LLM turns on the subscription; ElevenLabs $0.

**The engine.** `src/audio-engine/generation/` is its own module — no
native addon, unlike the sherpa `audio-engine.ts` beside it — with
`AudioGenerationEngine` (register from presets, `registerInstance` as the
test seam, a usage sink, `getPricePerSecondUsd`) and the one request shape
`{ kind: 'sfx' | 'music', prompt, durationSec?, loop?, promptInfluence?,
compositionPlan?, seed?, instrumental?, outputFormat }`.
`validateAudioRequest` enforces the API's bounds before any call: SFX
0.5–30 s or auto, music 3–600 s, prompt XOR composition plan, seed only with
a plan. There is no `setSafetyGuard` — audio prompts are not gated (D0.2;
recorded as "Rev 3 amendment" in `CONTENT_SAFETY_DESIGN.md`). The engine
registers lazily on first use (`ensureAudioGenerationEngine`) and again on
every key save, because `src/main/index.ts` belongs to another session's
uncommitted work; the one-line `await initAudioGenerationEngine()` after
`initVideoEngine()` there is optional (it only moves the "Engine
initialized" log line to startup).

**The wire, verified against the API reference on 2026-09-10.** SFX: `POST
/v1/sound-generation?output_format=mp3_44100_128` with `{ text, model_id:
"eleven_text_to_sound_v2", duration_seconds?, prompt_influence?, loop? }` —
as the plan said. Music: `POST /v1/music?output_format=…` with `{ model_id:
"music_v2", prompt | composition_plan, music_length_ms?, force_instrumental?,
seed? }` — the plan's `duration_ms` was a stale name (the field is
`music_length_ms`, prompt form only), `seed` is accepted only beside a
composition plan, and `output_format` is a query parameter on both. The
composition plan maps to the API's `snake_case` (`section_name`,
`duration_ms`, `positive_local_styles`…). A 401/403 keeps the API's
`detail` — on this API a key can be scoped per service, so a key without
the sound-generation permission names it in the message the user sees.
Prices from elevenlabs.io/pricing/api: **sound effects $0.12 per minute,
Eleven Music $0.15 per minute** — §5 question 2 is answered, and every usage
row is priced at the rate × the audio length (an auto-length SFX is measured
from the CBR MP3's byte count, `mp3-duration.ts`).

**Filing and the tools.** `generate-audio-asset.ts` is the audio mirror of
`generate-video-asset.ts` in the ONE-call form of `generate-image-asset.ts`
(the provider answers synchronously, so there is no submit/file split):
bytes into `generated/<kind>-<slug>.mp3`, origin `generated`, the prompt (or
a plan's styles → sections) as description, brand-tagged, and
`NO_AUDIO_PROVIDER_MESSAGE` as the one "needs a provider" line every caller
shows. Studio: `generate_sfx` / `generate_music` in
`agent-tools/audio-tools.ts`, awaited like `generate_video`, imported on use,
each answering with the project asset id and the `insert_asset(lane:
"audio")` hint; ids appended to `STUDIO_TOOL_IDS`; the prompt's "NOT
available yet" line is gone, the full-edit workflow gained a sound step, and
a preset's `sfx` / `music` steps now map to the tools (one-line skip only
when no provider is configured). Agents: `generate_audio` (needs
`'audio-provider'`, blocking like `generate_image`) returning an `audio`
artifact — `ARTIFACT_KINDS` gained `'audio'` (`AudioPayload { relPath,
durationSeconds, sound }`, library root), with `AudioViewer` (the video
viewer's transport over an `<audio>` element), the filmstrip icon, the
action bar, the resolver, `list_artifacts`, the manifest capability line
and the chat label. `ToolCapabilities.audioProvider` made
`resolveToolCapabilities` async. IPC `AUDIO_GENERATE` → `window.api.
audioGenerate`.

**Acceptance evidence.** (1) *Provider key missing* — REAL: with no key the
chat line "Add a whoosh sound effect where I say 'building blocks'" ran
`transcribe_asset` (AssemblyAI) → `get_transcript` → `generate_sfx` →
`list_assets(library, "whoosh")`, and the agent relayed "no audio provider
is configured … Add an ElevenLabs key in AI → Providers", then volunteered
that the phrase occurs at 0:11 and 0:25 and the 0:25 take is the keeper.
(2) *The 3 s whoosh at a word, the 30 s bed, the export* — STUBBED WIRE: a
placeholder ElevenLabs key saved through `providerKeysSave` (so the engine
registered through the production path) and the fetch stub armed; the chat
line "Add a whoosh where I say 'building blocks' and a 30-second music bed
under the whole thing, then export it." ran `generate_sfx` → `generate_music`
→ `insert_asset(audio at "blocks")` → card → `insert_asset(audio at 0 s,
gain 0.25)` → card → `export_project`. The recorded bodies: `{ text: "a fast
airy whoosh with a short tail, clean transition sweep", model_id:
"eleven_text_to_sound_v2", duration_seconds: 1.5 }` (the agent chose 1.5 s;
the stub answered a 3.03 s file) and `{ model_id: "music_v2",
force_instrumental: true, prompt: "warm minimal instrumental bed for a
talking-head short, soft pulse and light percussion, 90 bpm, unobtrusive,
no vocals", music_length_ms: 30000 }`, both with the `xi-api-key` header.
Library: `generated/sfx-a-fast-airy-whoosh-with-a-short-tail-cle.mp3` and
`generated/music-warm-minimal-instrumental-bed-for-a-talk.mp3`, both indexed
with the prompt as description; both imported as project audio assets. The
whoosh clip landed at 24.466 s — the SECOND "building blocks", anchored to
the footage. Usage rows: `elevenlabs / eleven_text_to_sound_v2 /
studio-shot-asset / audio / $0.003` and `elevenlabs / music_v2 /
studio-shot-asset / audio / $0.075`. Export: `Videos\VidTSX\
studio-w2b-short-a1_2026-09-09T23-38-47.mp4`, 60.0 s, 1080×1920 H.264 30 fps
+ AAC 48 kHz stereo, 1800 frames on the Remotion engine (374 s). ffmpeg
`astats` on the export against the source: 0–20 s identical (−20.89 vs
−20.89 dB; nothing placed there); the whoosh window 24.4–27.6 s +0.9 dB;
and in the source's quiet stretch at 28–30 s the export reads −41.0 dB
against −51.7 dB, with the 220 Hz band (the stub bed is 220 + 330 Hz sines)
at −44.5 dB against −64.8 dB — +20 dB where the bed plays. (3) *Agents
`generate_audio`* — unit-tested only (no built-in lists it; a manifest that
names it gets the `audio` artifact and viewer); not run live.

**The bug the run found.** The bed was asked for at 0 s and landed at
27.5 s: `applyInsertProposal` took the one audio lane and `addClip`'s
free-slot search pushed the clip past the whoosh. `ensureLane` now takes the
placement and, for audio, chooses the first lane FREE there (`findFreeSlot(at)
=== at`), else adds a lane (`0a2dde2`, unit test + verified live: the next
"place the bed at 0:00" card put it on a new lane A2 at 0 s, gain 0.25, the
whoosh untouched on A1). The verified export above was rendered BEFORE the
fix, so its bed runs 27.5–57.5 s. Overlays keep the shot rule unchanged.

**PENDING — the real-key rows (Hasan).** elevenlabs.io → Developers → API
keys → create a key whose permissions include *Sound Generation* and *Music*
(keys are scoped per service; Speech to Text alone gives a 401 whose
`detail` names the missing permission — the app shows it verbatim) → AI →
Providers → ElevenLabs. Then either (a) in the dev console
`window.api.audioGenerate({ kind: 'sfx', prompt: 'a short soft click',
durationSec: 1 })` for a $0.002 smoke test (the file appears under
`generated/`, one `audio` usage row), or (b) in a Studio project on the
talking-head clip type the acceptance line with "a 3-second whoosh" spelled
out, apply the two cards, and read the export with ffprobe. Budget: under
$0.10 for both clips. Nothing in the app changes for this — only the key.

**Not done / left for later.** ElevenLabs TTS is one more endpoint on the
same client (`POST /v1/text-to-speech/{voice_id}`, same header, bytes back)
— a cheap follow-on, not built. The Flows `generate_audio` node is W8. No
Audio Studio screen (decision 4). `AudioViewer` was not exercised live. The
agent picks the SFX length itself (1.5 s here) unless the user names one.
The two stub usage rows sit in the W3 profile's usage DB (not the primary
profile). The seeded project, the placeholder key, the fetch stub and the
two stub MP3s (files + index entries) were removed afterwards; the export
stays in `Videos\VidTSX` as evidence.

#### W2c Per-model image parameters — ~1 session

- **Local first** (Hasan's ask). Settings key `imageModelParamOverrides: Record<modelKey, ImageModelParams>` where `ImageModelParams = Partial<SdGenerationDefaults> & { negativePrompt?, scheduler?, seed?, strength? }`. `local-sd-provider` resolves `request ⊕ override ⊕ family default` (`sd-cli-runner.ts` already accepts all of these).
- Gear button on every row of `ImageModelsContent.tsx` → `ModelParamsDialog.tsx`: schema-driven form (width, height, steps, cfgScale, sampler, scheduler, negative prompt), family defaults shown as placeholders, "Reset to defaults". Schema per family comes from `family-presets.ts`; the dialog never hardcodes fields.
- **Cloud second**, copying the video pattern: `ImageDialectId` (`fal-flux` | `fal-generic` | `cloudflare` | `byteplus-seedream` | `openrouter` | `gemini-cli`), `IMAGE_DIALECT_DEFAULTS` with a `paramSchema` per dialect (steps, guidance, seed, size mode, references cap), `hydrateImageEntry`, and `sanitizeEntries` preserving `dialect` for `category === 'image'`. Same gear button on `ModelCatalogCard` rows; overrides keyed `provider/model`. Image Studio's advanced panel renders the selected model's schema.

**Acceptance.** Change steps on one local model, generate, the sd-cli argv shows the override; reset restores family defaults; a cloud model's dialog shows only the fields its dialect declares.

#### W2c outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

All three acceptance rows hold, driven in the real app on the second dev
instance (W3 profile, own out dir, CDP 9223) through the gear buttons and
`window.api` — the local half against a real sd-cli run, the cloud half
against one real fal request whose wire body was captured. `check:types` at
baseline (web 26, node 10); 1937 tests passing, up from 1908. Commits
`7f6008d` (engine, main, shared, tests) and `d562325` (the dialog, the gear
rows, Image Studio's advanced panel).

**One shape for both halves.** `ImageModelParams` (width, height, steps,
cfgScale, sampler, scheduler, negativePrompt, seed, strength) and
`ImageParamSchema` (`fields`, `sizeMode`, `maxReferences`) live in
`src/shared/presets/image-model-params.ts`; `cfgScale` is what the cloud
dialects label "Guidance". Overrides sit in the settings key
`imageModelParamOverrides`, keyed `provider/model` (`local/<id>` for sd-cli
models; the key splits on the FIRST slash because OpenRouter ids carry
slashes). The resolution is one place: the cloud image engine's
`runGuarded` asks an injected `ImageParamResolver` for `provider/model`
(request.model, else the provider's `defaultModel`) and merges `request ⊕
override` before Gate A — so Image Studio, `generate_image` in both agent
registries, flows and bulk all inherit an override with no call-site
change; top-level width/height fall back to the override too. The family
defaults are then the runner's `?? defaults` in `buildArgs`, which is the
"⊕ family default" the design asked for. The direct sd-cli IPC (Tools →
Image AI tester) applies the same override in its handler.

**Local.** `FAMILY_PARAM_SCHEMAS` in `family-presets.ts` is the one sd-cli
surface for every family (sampler and scheduler option lists live beside
it; FLUX rows carry a "keep guidance 1.0" hint); the dialog's placeholders
are the MODEL's `defaults`, not the family's, so the tiny profile shows
4 steps / lcm while a generic SD 1.5 import shows 20 / euler_a.
`toSdRequest` in `local-sd-provider.ts` maps the params (a fixed seed
advances per image of a multi-image request; no seed → random per image as
before). The engine gained `onSpawn`, and sdimage-init logs the exact argv
as `"sd-cli argv"` — the acceptance proof and a support line.

**Cloud.** `ImageDialectId` = `fal-flux | fal-nano-banana | fal-generic |
cloudflare | byteplus-seedream | openrouter | gemini-cli` in
`src/shared/presets/image-dialects.ts`, one more than the design listed:
Nano Banana is fal's default image model and takes an `aspect_ratio` and no
numeric parameters, so folding it into `fal-generic` (image_size + seed)
would have shown a Seed field the API does not have. `IMAGE_DIALECT_DEFAULTS`
gives each a `paramSchema` and `supportedOperations` (the capability slot
W2a's `supportedOperations` idea becomes). `hydrateImageEntry` in
`src/image-engine/dialect-capabilities.ts` mirrors the video one: a stored
row keeps id + name + dialect; a pre-W2c row without a dialect resolves to
the shipped entry's dialect, else the provider default. The providers send
only what their dialect declares: fal `num_inference_steps` /
`guidance_scale` / `seed` (`negative_prompt` where a schema declares it —
none does today); Cloudflare maps steps to `steps` (FLUX apps) or
`num_steps` (SDXL Lightning, Lucid Origin) with the API caps (8 / 20 / 40),
plus `guidance`, `seed`, and `negative_prompt` on SDXL only; OpenRouter and
the Antigravity CLI declare nothing (aspect ratio only) and their dialog is
the one-line "takes no generation parameters" notice. One collision found
and fixed on the way: `fal-generic` exists in BOTH dialect namespaces, so
`isVideoCatalogEntry` is now structural (`textToVideoEndpoint`) and the
video sanitiser reads the named dialect directly — otherwise the shipped
SeedREAM image entry was filed as video and `image-init` failed to type.

**The UI.** `ImageParamFields` (shared) renders exactly a schema's fields;
`ModelParamsDialog` wraps it with Save and Reset-to-defaults (removes the
row). AI → Models → Image: a gear on every installed row, a dot on it while
an override is stored. AI → Providers → Model Catalogs: the same gear on
image rows, the dialect line on every image row, and a dialect select
when adding a fal image id (FLUX / Nano Banana / Generic; the other
providers have one dialect and show no select). Image Studio: an
"Advanced" disclosure under the Images count renders the selected model's
schema for this request only, placeholders = the model's defaults overlaid
with its saved override, cleared on model change; Nano Banana shows no
disclosure at all.

**Acceptance evidence.** (1) The 654 MB BK-SDM-Tiny profile (sd15, sha256
verified) was placed in the W3 profile and sd-cli.exe copied from the
primary profile; the gear on its row showed placeholders 512 / 512 / 4 / 7 /
`default (lcm)`; Steps 12 + Scheduler karras + Negative prompt "blurry,
text" saved as `local/bk-sdm-tiny-q4_0`, the gear's title read
"(customized)", and `imageGenerate` on the local provider logged
`sd-cli argv … "-W","512","-H","512","--steps","12","--cfg-scale","7",
"--sampling-method","lcm",… "-n","blurry, text","-s","1164524519",
"--scheduler","karras"` — the three overridden fields, the model's own
size/CFG/sampler for the rest. (That run's pixels were then discarded by
Content Safety's classifier — a 4-step tiny model's red apple read as
explicit; unrelated to W2c and the argv is the proof.) Reset through the
dialog emptied the map and the next run logged `"--steps","4"` with no
`-n` and no `--scheduler`, generating in 7.5 s. (2) The Nano Banana Pro
dialog shows the no-parameters notice and a disabled Save; FLUX.1 Schnell
(cloudflare) shows Steps (with the "at most 8" hint) / Guidance / Seed /
Negative prompt; a `fal-ai/flux/dev` row added with dialect `fal-flux`
shows Steps / Guidance / Seed. (3) One real cloud run: Seed 12345 saved on
`fal/seedream-v4.5` through the gear, then `imageGenerate` with the main
process's `fetch` wrapped over the inspector — the captured body was
`{prompt, num_images: 1, seed: 12345, image_size: {1024×1024}}`. Two
earlier seeded runs returned different JPEGs (1.41 MB vs 1.27 MB), so
SeedREAM v4.5 on fal is not seed-deterministic; the wire capture is the
proof. Three fal images, $0.12. Everything seeded was removed afterwards
(override, catalog row, model file, sd-cli copy; the active provider put
back to gemini-cli).

**What W2a must know.** Add `byteplus` image entries with `dialect:
'byteplus-seedream'` (already in `DEFAULT_IMAGE_DIALECT` and
`IMAGE_DIALECTS_BY_PROVIDER`); its schema today is Guidance (0–10, "defaults
to 2.5") + Seed, `sizeMode: 'image_size'`, `maxReferences: 10` — adjust the
cap to what the 4.5 / 5.0 docs say. The provider reads `request.params`
(`cfgScale` → `guidance_scale`, `seed` → `seed`) and must expose
`readonly defaultModel` and put `paramSchema:
IMAGE_DIALECT_DEFAULTS['byteplus-seedream'].paramSchema` on each
`ImageModelInfo` so the gear and Image Studio's panel light up;
`supportedOperations` on the dialect is the multimodal capability the W2a
bullet mentions (`text-to-image`, `image-to-image`, `multi-reference` are
already declared). The gear reads overrides through `useImageModelParams`
(`window.api.imageModelParamsGet/Save`), keyed `byteplus/<model id>`; no
engine re-registration happens on save — the override is read per request.

**Not done / left for later.** The fal generic def still derives edit
routes as `<app>/edit` (FLUX dev's real img2img route is
`/image-to-image`) — pre-existing, untouched. `strength` is in the value
shape and reaches sd-cli, but no schema declares it yet (img2img strength
stays request-time). The sd-cli `-n` negative prompt is not passed through
Content Safety Gate A (same as the existing tester path: naming unsafe
content there EXCLUDES it). Bulk mode has no advanced panel; it inherits
the saved override only. No `fal-flux` entry ships by default — users add
one with the dialect select.

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

#### W3 outcome (2026-09-09) — what was built, what the run showed, and what it leaves

Three commits: the pure split (`2384f09`), the capabilities (`df40d92`) and
the one fix the live run forced (below). `check:types` at baseline (web 26,
node 10); 1807 tests, up from 1786. The acceptance ran in the real app on a
second dev instance (own profile, CDP 9223 — the export-engines session kept
9222) against a 60 s 1080p30 excerpt of the DJI 0271 talking-head clip.

**The split, then the tools.** `studio-agent.ts` is 175 lines (send, cancel,
the memory block, tool-support resolution); the eleven existing tools moved
unchanged into `agent-tools/{transcript,cut,shot,image,capture,memory}-tools.ts`
with `agent-tools/index.ts` owning the append-only `STUDIO_TOOL_IDS`. Per-turn
state (one proposal per turn, this pass's shots, the one-card rule) is a
`StudioTurnState` object every group reads instead of closure booleans. The
nine new tools, each a thin call to the service the matching button already
calls: `transcribe_asset` (the same `studioMediaJobs` transcript job the
Inspector button runs, awaited, progress into the tool chip), `run_auto_cut`
(`cut-plan-runner` + `buildCutProposal`, which moved to
`src/shared/studio/cut-proposal.ts` so the button and the chat emit the SAME
proposal), `generate_video` (`submitVideoAsset`/`fileVideoAsset`, awaited,
then imported into the project on use), `insert_asset` (a one-clip
`'insert-plan'` proposal — new proposal kind, `StudioProposalItem.insert` —
anchored to a word/take on the footage or a timeline time; `apply: true` only
on an explicit ask, still one undo step), `list_assets`, `get_brand`,
`set_captions`, `accept_proposal` and `export_project`.

**The bridge the renderer-owned document forced.** The timeline, proposals,
captions and the render queue live in the renderer, so applying, exporting and
captions ride a main→renderer request: an `'action'` agent event answered on
`STUDIO_AGENT_ACTION_RESULT` (`agent-actions.ts`; timeout and the turn's abort
both settle it). `export_project` mints the job id the queue row is created
with. Two more events: `'progress'` (long tools update their chip in place)
and `'assets-imported'` (import-on-use, the shot-assetRefs pattern).

**"Only answering cards" is a marker, not a click.** The prompt has the agent
end any message that leaves a card open during a multi-step run with a final
`[next: …]` line. When that card is applied or rejected — Inspector, timeline
or `accept_proposal` — the editor sends a "Review outcome: …" turn on the
user's behalf (`notifyReviewResolved`); no marker, no spent turn. The run
proved the gap this hides: the Apply button is live while the agent's last
sentence still streams, and an outcome that arrives mid-turn was dropped. The
fix queues it and sends it the moment the turn ends if the reply carried the
marker (`queuedOutcomeRef`). The rest of the run used exactly that path.

**The run.** One line — "Edit this video end to end: transcribe it, cut the
silences and the retakes and fillers, add two shots, one b-roll clip,
captions, and export it as an MP4" — on Opus 5 planning, Sonnet 5 shots:
`transcribe_asset` (AssemblyAI, 99 words, verbatim) → `run_auto_cut` (19
cuts, −28.3 s) → card → `get_transcript` ×2 → `propose_cuts` (8: four
retakes, four false starts; −33.3 s) → card → `get_brand`, two
`generate_tsx_shot` (a word-synced title over the kept intro take, a
five-tiles cutaway on the ending line) → `propose_shots` → card →
`list_assets` (library, project) → `generate_video` (fal Kling 2.5 turbo pro,
5 s, $0.40, brand-tagged `acme-test`, imported) → `insert_asset` (b-roll at
the word "factory", anchored) → card → `set_captions` (core/karaoke, 3 words)
→ `export_project`. Four cards clicked, nothing else typed. Final document:
four applied proposals, master lane 14 clips, an overlay lane with two shots
and the b-roll, captions on; the export is 13.6 s / 408 frames, 1080p30
H.264 + AAC. Usage log: five `auto-cut` rows on `claude-opus-5`, four
`studio-tsx-shot` rows on `claude-sonnet-5`, one `studio-shot-asset` row on
fal, one AssemblyAI row (about $2.4 in all). Cancel: Stop 8 s into a
`generate_tsx_shot` left an error row in the chat, no proposal, the timeline
untouched and only an `error` entry in the shot pool; Stop during the
planning step likewise.

**Three things the run surfaced that are not W3's.** (1) The first export
failed at 47 % with a Remotion compositor "No frame found at position …" on
the master clip at source 43.7 s — a libx264 encode with 8 s GOPs and
B-frames that ffmpeg decodes cleanly; re-encoding it with 1 s keyframes and
no B-frames rendered fine on the next `export_project`. Real footage should
be checked for this on the flip's testing pass. (2) One shot generation was
cancelled with the provider's "Request cancelled" and no Stop click; the only
other route to that error is `llmEngine.abortActive()` (the `LLM_CANCEL`
channel, which the Tools chat calls) — a global cancel from another feature
would kill a Studio turn. Unconfirmed; worth a look before the flip. (3) No
SFX: `generate_sfx`/`generate_music` wait for the W2b engine (the prompt
says so in one line), so the acceptance row's "one SFX" is open until W2b;
`get_preset` (W5) and `get_script` (W4) land with their workstreams.

**Driving lessons (docs/ui-automation-cdp.md material).** The review Apply
button only renders on the Inspector tab, so a driver must switch tabs like a
user; a fresh profile decrypts nothing until its `Local State` (Chromium's
os_crypt key) is copied with `settings.db`; never run two drivers at once —
a lingering watcher applied a card in the wrong project; and a tool chip
from an earlier row is still in the DOM, so "wait for the chip" must count
chips, not find one.

### 2.4 W4 — Script, vocabulary, brands everywhere — ~1.5 sessions

- **Script.** `project.script?: string` (timeline document, versioned with the schema). A Script tab beside Transcript in the editor (`TranscriptPanel` sibling). `get_script` tool; the first ~1 500 chars are injected as context, the rest on demand. Editorial cuts get the script as "the intended final read" (which take is the keeper).
- **Vocabulary on the brand.** `StudioBrand.vocabulary?: { term: string; aliases?: string[] }[]` (validate/normalise in `src/shared/studio/brand.ts`, cap 200). `BrandForm` gets a vocabulary editor. `propose_vocabulary` tool + card (multi-select accept) — the agent proposes after every transcription and from the script: proper nouns, product names, mangled spellings. Accept writes the project's brand (main stamps the brandId, like style promotion) and retires the matching memory entries. Memory `vocabulary` entries with no brand stay app-wide.
- **STT feed.** `TranscriptionRequest.keyterms?: string[]` composed in `asset-transcriber.ts` from brand vocabulary + script proper nouns (deterministic capitalised-token extraction, capped) + active vocabulary memories. AssemblyAI → `keyterms_prompt` (or `word_boost` per model); ElevenLabs Scribe → its keyterms field if the API has one, else skipped; whisper.cpp → `--prompt`. Then a deterministic post-pass replaces aliases in the word list (case-insensitive exact token), logged per replacement.
- **Brands in Agents.** Brand picker in `StarterFlow` and session creation (`CreateAgentSessionInput.brandId` exists); `get_brand` tool in the shared registry; the built-ins' AGENT.md reference it.
- **Brands in Flows.** Recorded here, built in W8: brand as a run-level input, per-node `brandId` config on image, composition, text and audio nodes.

**Acceptance.** A transcript of a clip that says "VidTSX" three times comes back spelled right with the term on the brand; the agent proposes the two names the script mentions; the provider debug log shows the keyterms field was sent.

#### W4 outcome (2026-09-09) — what was built, what the run showed, and what it leaves

Five commits (`448a086` brand vocabulary, `03d2a65` the STT feed, `531496e`
the script, `548eab7` `propose_vocabulary`, `20e705c` brands in Agents), each
by pathspec beside the export-engines session's dirty tree. `check:types` at
baseline (web 26, node 10); 1843 tests, up from 1807. All three acceptance
rows hold, driven in the real app on a second dev instance (the W3 profile
and its keys, own out dir, CDP 9223 — the recipe now has the `w4/` scripts
beside the `w3/` ones).

**Vocabulary on the brand (decision §0.5), as built.** `StudioBrand.vocabulary?:
{ term, aliases? }[]` — validated and normalised in `shared/studio/brand.ts`
through the new `brand-vocabulary.ts` (cap 200 terms, 60 chars, 10 aliases;
dedupe case-insensitively; an alias equal to the term is dropped because a
casing-only fix is implicit). `updateBrand` treats the input as the whole
list, which meant the style-promotion accept and the package-import brand
creation had to pass the current vocabulary through — the one place a
"one-field" edit could have silently wiped it. The Brand form edits it as
`Term = mangling, mangling` lines; `get_brand` (both agents) renders it
through the shared `brand-summary.ts` formatter.

**The STT feed.** `ProviderTranscribeRequest.keyterms[]` rides
asset-transcriber → run-transcription → the provider (and the Transcribe
screen's request type carries it too). `stt/keyterms.ts` composes the list
deterministically — brand terms, in-scope vocabulary memories, then the
script's proper nouns (capitalised-token extraction: distinctive shapes
anywhere — inner capitals, digits, all-caps — plain capitals mid-sentence or
when the same word is capitalised mid-sentence elsewhere, phrases of up to
four tokens, ranked by frequency, capped at 60) under an overall cap of 200.
Aliases are never sent: they are the wrong spellings. Provider mapping:
AssemblyAI `keyterms_prompt` for the universal family (§5 question 3, closed
above), `word_boost` only for best/nano; ElevenLabs Scribe repeated
`keyterms` multipart fields (≤ 1 000, < 50 chars, ≤ 5 words); whisper.cpp
`--prompt` with a comma list cut at 600 chars. Then `stt/alias-postpass.ts`
replaces every alias in the words (a multi-word run merges into one word
spanning the run, lowest confidence, first speaker), the segments and the
flat text, and asset-transcriber logs each replacement; the transcript file
and the Inspector readout carry `keytermCount` / `aliasReplacements`.
`studio/transcription-context.ts` loads project, brand and memories for one
run and never throws — a brand problem must not block a transcription.

**Script.** `project.script?: string` (cap 60 000, normalised in
project-store, no schema bump — the captions precedent). A Script tab beside
Inspector / Captions / Assistant; the renderer sends the live copy each turn,
the prompt injects the opening (~1 500 chars at a word boundary) as "the
INTENDED FINAL READ — the keeper take is the one that matches it, wording it
dropped is fluff, spell its names exactly", and `get_script` reads the rest by
character window through the same `project-script.ts` service.

**`propose_vocabulary`.** One multi-select card per turn, its own gate (it
blocks neither review proposals nor memory cards, so the end-to-end run keeps
moving). Main stamps the brand from project settings (the style-promotion
rule), drops terms the brand already carries with those aliases, and needs a
LIBRARY brand — with only a project-local snapshot the tool points the agent
at `propose_memory(kind: "vocabulary")`, which is what "memory entries with no
brand stay app-wide" means in practice. Accept merges the ticked terms into
the brand against a fresh read (an existing term keeps its casing and gains
aliases; a full brand keeps the card pending), writes it, then retires the
active vocabulary memories the brand now carries. The prompt asks for the
card after EVERY `transcribe_asset` and from the script before transcribing.

**Brands in Agents.** `get_brand` joined the shared registry
(`AGENT_TOOL_IDS`, append-only); Motion Post asks for it (manifest 1.1.0,
file hashes regenerated) and reads the brand before the composition — the
Assistant stays tool-less by design, so "the built-ins reference it" is one
of two. Sessions: `AgentSessionCreateRequest.brandId` (absent = the library
default as before, null = none) and a new `AGENT_SESSION_BRAND_SET` channel
that patches an open session (applies from the next turn; media already filed
keeps its tag). The starter shows a brand picker above its questions,
defaulting to the library default; an open session has a compact chip beside
the model chip. **Brands in Flows:** nothing built, per the section — W8
reads this outcome for the run-level input and the per-node `brandId`.

**Acceptance evidence.** A 15.5 s SAPI clip ("Welcome to VidTSX … how VidTSX
renders TSX compositions with Remotion, and how LearnWithHasan uses it …
Try VidTSX today"), the Acme Test brand carrying `VidTSX = Vid TSX, vid t s
x, Vid TS X`, the script in the tab, AssemblyAI `universal`. (1) The
transcript file: `VidTSX` exactly three times, `keytermCount: 4`; the log
read `Vocabulary composed … keyterms 4 (brand 1, memory 0, script 3)` then
`AssemblyAI: Keyterms sent {field: "keyterms_prompt", count: 4, sample:
[VidTSX, TSX, Remotion, LearnWithHasan]}`. A control transcription of the
same clip with no brand and no script came back "VIDTSX", "ReMotion" and
"Learn with Hassan" — the feed is what fixed all three, and the post-pass had
nothing left to correct (`aliasReplacements` absent). (2) One chat line
("propose vocabulary for the brand: the names the brand does not know yet"):
`get_brand → get_script → get_transcript → propose_vocabulary (3 terms)` —
Remotion and LearnWithHasan (the script's two names) plus TSX, VidTSX left
off "because it is already on the brand", each with pre-emptive aliases and
a one-line note. Clicking "Add 3 to brand" wrote the four-term brand.json
with the style notes intact and the panel reported "Brand vocabulary updated
· added Remotion, LearnWithHasan, TSX". (3) The keyterms log line above. On
the Agents page the Motion Post starter opened with the brand picker set to
the library default; `agentSessionCreate({ brandId: null })` produced a
brand-less session and `agentSessionBrandSet` put `acme-test` on it, read
back by `agentSessionLoad`.

**Not done / left for later.** No alias replacement was observed on real
provider output (AssemblyAI got every primed name right); the post-pass is
covered by its unit tests only. The Transcribe screen carries `keyterms` on
its request but has no UI to fill it (it has no brand or script context).
Vocabulary memories with no brand still reach the STT feed app-wide, as
decided, but nothing promotes them automatically — the agent must put them on
a card with source "memory". Flows' brand input is W8's.

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

#### W5 outcome (2026-09-09) — what was built, what the runs showed, and what it leaves

Three commits by pathspec beside the export-engines session's dirty tree:
`aaa6aa2` (the entity, the prompt block, `get_preset`, learn from this
video), `cc136a7` (the `.vidtsx` round trip) and the transitions-knob fix
that landed with this doc. `check:types` at baseline (web 26, node 10); the
suite is up from 1843 (the count is in the Status entry). All three
acceptance rows hold, driven in the real app on a second dev instance (the
W3 profile and its keys, own out dir, CDP 9223) against the same 60 s
talking-head excerpt W3 and W4 used, with the built-ins seeded into that
profile's library on the first preset listing.

**The entity, as built.** `StudioPreset` lives in `shared/types/studio-preset.ts`
with the `PresetStep` union verbatim from the section; the folder is the
truth (`<assetsRoot>/presets/<id>/preset.json` + `PRESET.md`, optional
`skills/<id>/SKILL.md` read by the same loader agent packages use).
`preset-store.ts` is `brand-store.ts` with two files per entry and one extra
write, `applyPresetLearning` (knobs patched, section appended, learned-log
entry — nothing else moves). Two things the section did not spell out: (a)
`PRESET.md` is capped at 12 000 chars in the editor while the PROMPT budget
stays 4 000 — the block composer cuts the body at a paragraph boundary and
ends with a visible "(… cut for length — call `get_preset`)" line, so
truncation is never silent; (b) the workflow is authored one step per line
(`auto_cut:aggressive`, `captions:core/word-pop`) through
`shared/studio/preset-workflow-lines.ts`, which round-trips and reports a bad
value instead of dropping it. The three built-ins ship in `resources/presets/`
(2 040–2 423 chars of body each, every block well under the budget) and are
copied into the library once; a seed ledger (`presets/.seeded.json`) keeps a
deleted built-in deleted. The `workflow: { flowId }` reserve for W8 Stage 4 is
a comment on the type — nothing reads it.

**Where the preset enters the prompt.** `composeSystemPrompt` gained a MIDDLE
parameter — after the skills, before the trailing memory block — and
`studio-agent.ts` fills it from the project's `presetId` on every turn
(`## Editing preset: <name>`, then the kind, the numbered workflow, one
"Style knobs:" line, then the body and any preset skills). The block is
deterministic (no dates) so it rides the cached prefix. The workflow lines in
`studio-agent-prompt-tools.ts` say the preset's workflow REPLACES the generic
"edit this video" order, give the step → tool mapping (light/normal
`auto_cut` → `run_auto_cut(style: "natural")`, aggressive → `"tight"`; a
captions template → `set_captions`; `shots` cadence is per minute of FINISHED
video; `sfx`/`music` get the one-line "not available"), and that there is no
`run_preset` tool. `get_preset` returns the whole thing; `propose_preset_update`
is the chat path of learn (below). The ids are appended in
`agent-tools/index.ts`; the fourth per-turn gate is
`StudioTurnState.presetProposalCreated`.

**Selection.** `project.settings.presetId`, a picker under the brand in the
media pool's Shots section (a stale id shows as "(missing)", the brand
pattern), the Inspector's Project section shows the name beside the learn
button, and the new-project dialog offers the list — picking a preset with an
orientation flips the format tile to match. At creation a preset's
`defaultBrandId` wins over the library default brand when that brand exists;
it only sets the project's `brandId` and never touches the brand (vocabulary
included).

**Learn from this video, as built.** `preset-learn-stats.ts` is pure:
`computeLearnStats(project)` measures the master (first video) lane — clips,
cuts/min, mean clip, seconds removed by ACCEPTED items of applied cut plans —
plus shots, overlay-lane b-roll, SFX clips, a music-bed heuristic (an
untranscribed audio asset covering ≥ 40 % of the edit; gain < 0.5 = quiet),
the caption template mapped to karaoke/block, transition kinds, intro (time
before the first footage clip) and outro (after the last), clips by
`origin.by`, and the review history (proposals applied/rejected, cut items
rejected or dragged by hand). `diffPresetKnobs` turns that into knob changes
each carrying its numbers (pacing: ≥ 8 cuts/min or mean clip ≤ 5 s = tight,
≤ 2 cuts/min and ≥ 15 s = relaxed; numeric knobs move only past 25 % or an
absolute floor; edits under 10 s propose nothing). `learn-from-project.ts`
adds the ONE LLM summary — `runLlmGenerate` on the project's planning model,
or the agent's own `summary` argument on the chat path, or the deterministic
numbers sentence with a visible "(numbers only)" flag when no model answers —
and queues the card. Accept (`preset-learn-handlers.ts`) re-applies the knob
changes over a FRESH preset read (a form edit since the card was minted
survives on every knob the card does not touch) and appends
`## Learned from <project> on <date>` with the summary, the stat lines and the
knob line. The Inspector button hands main the LIVE reducer slice (timeline,
proposals, shots, captions — the 600 ms save debounce may lag) and the card is
pushed on the agent event stream, so it appears in the Assistant tab like the
chat one.

**The runs — same clip, same line, two presets.** One line, "Edit this video
end to end.", on Opus 5 planning / Sonnet 5 shots, the Acme Test brand,
AssemblyAI. *Talking-head short* (9:16 project): `transcribe_asset` (99
words, verbatim) → `run_auto_cut` **tight** (19 cuts, −28.3 s) → card →
`propose_cuts` 11 (7 retakes, 4 false starts, −25.5 s) with the hook trim
proposed "because the preset's hook rule wants the claim first, not a
preamble" → card → one word-synced **hook title in the upper third** (1080 ×
1920) → card → `set_captions` **core/word-pop, three words, uppercase, lower
third** → the sound steps skipped in one line. Final: 11.8 s, 20 clips on the
master lane, the title 1.5–5.9 s on the overlay lane; two cards clicked.
*Course lesson* (16:9 project): the same transcription → `run_auto_cut`
**natural** (18 cuts, −25.1 s: "pauses under about two seconds are left
alone, per the lesson preset") plus a W4 vocabulary card → `propose_cuts` 8
(−31.8 s, "no fluff suggested — lesson preset keeps re-explanations") → one
**chapter title card** with the three outcomes stacked lower-left ("two per
minute allows one, and the preset treats that as a ceiling") → `set_captions`
**core/two-line-rolling, six words, sentence case**. Final: 12.3 s, 14 master
clips; three cards clicked. Neither preset lists b-roll or export, so no
video generation and no render ran; the visible differences — cut style,
fluff policy, shot kind and placement, caption template — all trace to
preset lines.

**Learn, both paths.** A seeded hand-tightened project (twenty 2 s clips from
the clip, no proposals, on the course-lesson preset): the Inspector button
answered "Card ready in the Assistant tab" in ~20 s and the card read
**pacing relaxed → tight (28.5 cuts/min on the master lane, mean clip 2 s)**,
shots 2 → 0, captions block → none, transitions dip-to-black → none, intro
10 → 0, outro 6 → 0, under a two-sentence summary ("You cut all 20 clips by
hand with no assistant proposals in play … a tight, bare hard-cut assembly
that opens and closes straight on the footage"). Accept: the panel read
"Preset "Course lesson" updated · 6 knobs changed", `preset.json` carried the
new style, `updatedAt` and the learned entry, and `PRESET.md` grew from 2 040
to 3 150 chars with the "## Learned from W5 hand-tight w5a on 2026-09-09"
section. The chat path, on the finished short ("Learn from this video: I am
done with this short, update the preset from how it was cut"):
`propose_preset_update` with the agent's own summary (no second model call),
four rows (shots 4 → 5.1, SFX 3 → 0, music present → none, outro 2 → 0), and
the agent itself warned that "96.6 cuts/min" was an artefact of a 60 s take of
slated retakes finishing at 12 s, "worth reading with suspicion". Reject left
the preset untouched (`updatedAt` unchanged, no learned entry).

**The round trip.** Exporting the hand-tight project (`strategy: none`) wrote
`preset.json` beside `brand.json` (manifest `preset: true`, 10 415 bytes in
all); inspect returned the snapshot summary (Course lesson, course, 16:9, 5
steps, 2 040 chars); import with `preset: { mode: 'create' }` created
`course-lesson-2` in the library with the same workflow, knobs and body, and
the new project's `settings.presetId` pointed at it (the exporter's id never
passes through; brand matched to `acme-test` in the same import). The dialog
offers match / create / none with a same-name twin preselected, the brand
shape.

**§5 question 4 — not measured.** Every built-in composes to ~2.5–2.9 k
chars (no truncation logged in either run), and adherence was observed
qualitatively — the agent cited a preset line at every step — but the
dilution-spike measurement was NOT run. The budgets stay at 4 000 (preset) and
2 000 (memory rules) until it is.

**Driving lessons.** The W4 watch loop's busy test (Stop visible OR Send
missing) must run on the Assistant tab — after its own click on Inspector the
Send button is hidden and it read "busy" for nine minutes on "Apply 11 cuts";
the W5 copy flips to Assistant first. "Back to projects" is an icon button
with a title only, so a text lookup misses it. And the Bash tool's heredoc is
not literal for backslashes: two "fixes" of an unescaped apostrophe were
silent no-ops until the patch went through a script file.

**Not done / left for later.** No built-in ships a `skills/` folder and there
is no UI for one (the loader and the block composer handle it). The learn
numbers are naive on tiny edits — a 12 s short reads as 96.6 cuts/min — and a
floor for edits under ~30 s (or per-minute rates normalised to the source
length) is worth adding before the flip's testing pass; the agent's caveat
covered it this time. The agent did not name the preset in its FIRST sentence
as the prompt asks (it named it by the second step in both runs) and once
told the user they could "edit the text on the card", which the card does not
offer. `sfx`/`music` steps degrade to the one-line notice until W2b. Memory
rules stay the place for one-line imperatives; the learned section is prose
plus numbers, never a rule.

### 2.6 W6 — Project thumbnails + Home — ~1.5 sessions

- **Posters.** `StudioProjectSummary.posterPath?`. `<project>/cache/poster.jpg` written by `project-poster.ts` on save (debounced) and on close: the first video clip on the top-most video track at 10 % of the timeline → `ffmpeg -ss <sourceTime> -frames:v 1 -vf scale=480:-2` from the source (proxy if present). No video → no file; the card renders a brand-palette gradient with the project initials in CSS. `ProjectCard` shows it with the orientation preserved.
- **Home** as `src/features/home/`, default screen `'home'` in `App.tsx`, first in the sidebar. Sections, top to bottom: header (greeting, version, update chip if pending); **Continue** (recent Studio projects with posters, TSX projects, agent sessions — eight cards, "See all" to each screen); **Start** tiles (Edit a video, Create a motion graphic, Run an agent → quick starts, Generate image / video, Build a flow); **Status strip** (providers configured, AI runtime installed, queue running/failed, whisper model); **Announcements** (the existing feed, moved here from the app-level card). Data through one `HOME_SUMMARY` IPC that aggregates existing stores; no new persistence.
- Professional look: UI_SPEC tokens only, dense, no hero copy. Universal prompt deferred (decision 9).

**Acceptance.** Cold start lands on Home under the measured budget (the lazy-engine rule holds: Home reads stores, spawns nothing); every card navigates; a project with no video shows the placeholder.

### 2.7 W7 — TSX agent mode — ~1 session

- Toggle `Prompt | Agent` at the top of `MotionInputPanel`. Agent mode embeds the shared `AgentChat` bound to a built-in `vidtsx/tsx-composer` (`resources/agents/vidtsx/tsx-composer/`): tools `generate_composition`, `edit_composition`, `render_composition`, `generate_image`, `ask_user`, `propose_memory`; skill = the TSX craft rules already in the prompts, factored into a skill.
- The session carries `motionProjectId`; a composition artifact is ALSO written into the Motion project (one adapter, `motion-project-sink.ts`), so the preview and the render button work exactly as in prompt mode. Brand and model come from the panel's pickers (W1, decision 7).

**Acceptance.** "Make me a 10-second logo sting for my brand, then make the text bigger" produces two versions in the Motion project, both playable, the second an edit of the first.

#### W7 outcome (2026-09-10) — what was built, what the run showed, and what it leaves

Everything the section lists is built, unit-tested, committed and driven
end to end in the real app on the second dev instance (W3 profile and its
keys, own out dir, CDP 9223 — `.vidtsx-temp/w7/` beside the earlier
folders). `check:types` at baseline (web 26, node 10); 2002 tests passing,
up from 1990. Four commits by pathspec beside the export-engines session's
dirty tree: `8aabd36` (the pure move of the reusable chat half of the
Agents feature to the renderer level), `58e4a98` (the `vidtsx/tsx-composer`
built-in, the Motion project sink, the craft rules as one text), `8a6b58c`
(`Prompt | Agent` in the Creator's input panel) and the docs commit that
carries this section. Spend: seven LLM rows on the subscription route
($0.59 API-equivalent), no cloud image, no other provider call.

**The move first (rule 1).** `src/features/motion` may not import
`src/features/agents`, so the parts the Creator needs left the feature
before anything was built on them: `AgentChat`, `QuickStarts`,
`MemoryProposalCard` and `BrandSelect` to `src/renderer/components/agents/`;
`useAgentRun`, `useAgentSessions`, `useAgentRenderBridge`,
`useAgentMemoryProposals`, `useAgentBrandList`, `useAgentProviders` and the
two pure folds they use (`event-folding`, `render-job-match`, with tests) to
`src/renderer/hooks/agents/`. `AgentChatRow` now lives with the fold that
produces it and the feature re-exports it. The Agents page (gallery,
workspace, starter, session list, stage, viewers) stays where it was.

**The built-in.** `resources/agents/vidtsx/tsx-composer/` — AGENT.md is the
Creator's motion designer (brief → `generate_composition`, then
`edit_composition` one instruction at a time, `render_composition` only on
request, `generate_image` only for a picture code cannot draw, one
`ask_user` question at most and only when the words for the screen are
missing); tools `get_brand`, `generate_composition`, `edit_composition`,
`render_composition`, `generate_image`, `ask_user`, `list_artifacts`,
`propose_memory` — the section's six plus `get_brand` (the W4 way a brand
reaches an agent) and `list_artifacts` (so it never guesses an id); no
starter, no icon (the card shows the Bot fallback). Its `tsx-craft` skill
is GENERATED, not written: the Style presets / Layout / Typography sections
of the 2D generate prompt moved into
`src/shared/tsx-engine/prompts/tsx-craft.ts` as `TSX_CRAFT_RULES`, the
prompt splices them back (byte-identical output for three contexts, hashed
before and after), `renderTsxCraftSkill()` wraps them with a short
briefing preamble, `scripts/gen-tsx-craft-skill.mjs` writes the SKILL.md,
and `tsx-craft-skill.test.ts` fails when the file and the prompt drift.
`scripts/agent-pack.mjs --hash` rewrites a built-in folder's `files[]` —
that is how this manifest's hashes were made (LF on disk, the motion-post
convention) and how the next built-in's will be.

**The sink, as built.** One adapter, `motion-project-sink.ts`. A session
created with `motionSink: true` (the new `AgentSessionCreateRequest` field;
`AgentSession.motionSink` + `motionProjectId`) has every `composition`
draft ALSO written as the next `vN.tsx` of a Motion project. The FIRST
composition creates the project — `reserveProjectFolder(draft.title)`, the
prompt mode's own naming, so "Acme Test logo sting" became
`projects/acme-test-logo-sting/` — and the folder name is patched onto the
session as `motionProjectId`; later ones append. The draft comes back with
`payload.motion = { folderPath, versionPath }`, so the renderer learns the
version off the `artifact` event it already receives, and the workspace
copy under `work/compositions/` is untouched (the sink mirrors, never
moves). The seam is one runner hook, `prepareArtifact(sessionId, draft,
workspaceDir)`, called before the store's single write; the service
re-reads the session record per draft so the second composition of one
turn sees the id the first one set. A project the user deletes mid-session
is recreated by the next version rather than failing the tool. An agent
`render_composition` on a sunk composition renders the Motion version file
(`buildQueueRequest` prefers `payload.motion.versionPath`), so the
Creator's Rendered tab lists it under that version.

**Brand and model (decision 7, W1).** `AgentToolContext.model` carries the
turn's model (`req.model ?? session.model`) into `generate_composition` and
`edit_composition` — the usage rows below show the composition pipeline on
the panel's Opus 5, not the provider default. `generate_composition` also
injects the session brand's `buildBrandInstructions` block ahead of the
agent's own `styleNotes`; that block moved from `useMotionGenerator` to
`src/shared/studio/brand-instructions.ts`, so prompt mode and agent mode
build under the same words, and the agent is told in AGENT.md not to
restate the palette. Verified: v1.tsx carries the Acme Test palette
(`#0F4C81 / #7FB3D5 / #0B1D2A / #F4F6F7 / #F5B041`) and its Georgia display
font verbatim.

**The panel.** `Prompt | Agent` at the top of `MotionInputPanel`. Agent mode
keeps the panel's own Provider, Model and Brand pickers and fills the rest
with the shared `AgentChat` in a new embedded form (`hidePickers`, and an
`interactionCard` slot so an `ask_user` card renders under the conversation
— there is no stage here); FPS, aspect, duration, thinking, optimise and
reference images stay in prompt mode, because the agent takes frame and
length from the conversation. `useMotionAgent`: entering Agent mode reopens
the newest session that HAS the sink (sessions started from the Agents page
for the same agent are left alone) or creates one with the panel's provider,
model and brand; opening a session hands its provider/model/brand back to
the pickers once; after that a brand change patches the open session (W4's
`AGENT_SESSION_BRAND_SET`) and provider + model travel per turn as the run
hook already sends them. The newest mirrored composition is loaded into the
preview on reopen, and every new one live. The panel stays mounted (hidden)
once opened, so a run in flight keeps its view. The panel was split to
stay near the line budget (`MotionModeToggle`, `MotionBrandField`,
`MotionSegmented`); it is 319 lines from 386, and `MotionScreen` grew to 457
from 417 — both still over, noted.

**Acceptance evidence.** Session `s-afece65c` on the W3 profile:
`claude-subscription` / `claude-opus-5` / brand `acme-test`, all three set on
the panel (the brand set patched the open session's record before the first
turn). "Make me a 10-second logo sting for my brand" → `get_brand`, then the
one allowed `ask_user` form ("What words should the sting show?" —
wordmark, optional tagline), answered "Acme Test" on the card inside the
panel → `get_brand` again, `generate_composition` ("Acme Test logo sting",
1920×1080, 30 fps, 10 s) → **`projects/acme-test-logo-sting/v1.tsx`**
(5 569 bytes) and the preview toolbar read `acme-test-logo-sting / v1.tsx`
with the Render button enabled (the loader's success state). "make the text
bigger" → `edit_composition` on composition-1 → **`v2.tsx`** (5 934 bytes)
as `composition-2`, version 2, producer `edit_composition`; the diff is the
edit and nothing else: wordmark `fontSize: 112` → `160`, subhead `32` → `48`
(both at the top of the skill's type scale), the amber rule widened
`760` → `1040` "still far inside the horizontal safe area", line-heights
added; the preview switched to `v2.tsx`. `session.json` afterwards:
`motionSink: true`, `motionProjectId: "acme-test-logo-sting"`, `brandId:
"acme-test"`, `model: "claude-opus-5"`, title set from the first prompt.
Render: the Creator's own Render button on v2 → the settings dialog → Render;
the queue row went `rendering 6 … 62 → completed`; render history's newest
row has `filePath = …\projects\acme-test-logo-sting\v2.tsx`; **ffprobe on
`Videos\VidTSX\AcmeTestLogoSting_2026-09-10T00-17-55.mp4`: h264 1920×1080
yuvj420p 30/1, 300 frames, AAC, duration 10.048 s, 1 616 905 bytes**; the
Rendered tab showed it as `<video>`. Usage log, newest first: seven rows,
every one `claude-subscription | claude-opus-5 | agent | vidtsx/tsx-composer`
— the composition pipeline's classify/generate/verify rows (the $0.12–0.14
ones) on the panel's model, not the default. Main log for the profile: 72
lines, zero `warn` / `error`. Afterwards: "New session" on the panel made a
second sink session with the same brand and model and no project (it would
have been created by its first composition); the Agents gallery lists
`vidtsx/tsx-composer 1.0.0 builtin` beside the other two. Both sessions were
deleted through `agentSessionDelete`, the project folder removed, the app
stopped; the MP4 stays in `Videos\VidTSX` for Hasan.

**Not done / left for later.** Binding Agent mode to an ALREADY-OPEN Motion
project (edit the project on screen) is not built — a new session's first
composition always makes a new project; doing it needs the current version
seeded as a composition artifact, one `AgentSessionCreateRequest` field and
a sink that skips the reserve step. The sink writes no `chat.json` turns into
the Motion project, so prompt mode's edit box has no conversational context
for an agent-made project (the edit pipeline still has the code). No
thinking dial in Agent mode (the W1 note stands: the manifest's
`defaults.effort` governs). Switching to prompt mode mid-run and back keeps
the view because the panel stays mounted, but a full screen remount during a
run reopens the session with `busy` false until the turn's messages are
appended (main keeps running; a second send in that window gets "already
running"). The interaction card in a 280-px panel is cramped for `pick`
with previews (none are resolved there — compositions carry no picture). No
icon for the built-in. `MotionScreen` (457 lines) and `agent-service.ts`
(371) want their splits. For W6: `AgentSession` gained `motionSink` and
`motionProjectId` (folder name relative to the Creator's projects dir,
`getProjectsDir()`), `AgentSessionSummary` carries them through
`listAgentSessions`, and the Motion project store is folder-as-truth
(`<projectsDir>/<name>/vN.tsx`, `scanLibrary` in the renderer) — a Home
card for a tsx-composer session can point at its project by that id, and a
Motion project's newest `vN.tsx` mtime is its "recent" signal.

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
| 5 | **Studio flip** — `studio-editor: true`, a Studio testing pass on the raw-footage clips, docs — **DONE 2026-09-10 (§3.1)** | 1 | yes — first cut line with Studio |
| 6 | W2 providers (a, c, then b) | 3.5 | yes |
| 7 | W7 TSX agent mode | 1 | yes |
| 8 | W6 posters + Home | 1.5 | yes — second cut line |
| 9 | W9 web designer | 1.5 | yes |
| 10 | W8 Flows, all stages | 8 | release |

Flows last because it is the largest, still under discussion, and nothing
above depends on it; it can also run in a parallel session once its
discussion is done, since it touches `src/features/flows/`,
`src/main/services/flows*` and the agents registry's `ports` block only.

### 3.1 Studio flip outcome (2026-09-10)

Step 5 of the table above, run overnight and unattended. Five commits by
pathspec beside the export-engines session's dirty tree: `c8ebecc` (the flip
and the docs that said Studio was coming), `f081745` (`LLM_CANCEL` scoped to
the requester — W3 finding 2), `3771ce2` (the learn floor — the W5 finding),
`d226d9b` (the one-shot retry on Remotion's "No frame found at position" —
W3 finding 1) and the docs commit that carries this section. `check:types`
at baseline (web 26, node 10); 1908 tests, up from 1898. `npm run build` —
electron-vite, the release path — succeeds with the flip and the built
renderer bundle reads `"studio-editor": true`; the Coming Soon screen is
still in the bundle as the flag's off branch (a kill switch, one line to flip
back), which is deliberate.

**The flip.** `studio-editor` was a dev-preview (`false`: forced on in dev,
Coming Soon in production). It is a plain `true` now, so the editor ships in
the first release. Nothing else gated on it — `StudioScreen.tsx` is the one
reader (the Sidebar gates on `studio`, already on). The README gains a Studio
section written from what the app does today and drops Video Studio from
"Coming soon" (it shipped 2026-09-07); `docs/studio/PLAN.md` and
`V1_RELEASE_PLAN.md` note the date. No other user-facing text said Studio
was coming.

**W3 finding 2 — the provider-level "Request cancelled" with no Stop click:
CONFIRMED and fixed.** `handleLlmCancel` called `llmEngine.abortActive()`,
and `ClaudeProvider.abort()` is a global cancel — `for (const session of
this.sessions) session.abort()` then `sessions.clear()` — so a Stop in the
Tools chat (the only renderer caller of `LLM_CANCEL`) rejected EVERY
in-flight request on the provider with `LLMEngineError("Request cancelled")`,
a running Studio turn included; an agents session or a Flows node on
`claude-subscription` would have died the same way. The fix is
`src/main/ipc/llm-request-scope.ts`: every renderer-initiated generate
(`LLM_GENERATE`, `LLM_CHAT_GENERATE`) gets its own AbortController tagged
with the sender window, the feature source and the session scope;
`LLM_CANCEL` takes an optional `{ featureSource?, sessionScope? }` and aborts
only the matching requests of the calling window (the response says how many
it reached). Main-process callers — the Studio agent, the TSX job engine, the
agents runner — pass their own signal and are never in the registry, so they
are out of reach by construction. The Tools chat tags its requests `ai-chat`
(its usage rows read `other` before) and cancels with that tag; the Flows
node's comment says how a per-run cancel would use `sessionScope`. Three unit
tests on the registry. `abortActive()` itself stays for app shutdown.

**The W5 finding — naive learn numbers on tiny edits: fixed.**
`diffPresetKnobs` withholds the three RATE knobs (pacing, shots/min, SFX/min)
when the edit is under 30 s (`MIN_SECONDS_FOR_RATE_KNOBS`); the count-and-flag
knobs (music bed, captions, transitions, intro, outro) still hold. The card's
stats summary and the "Learned from" section carry the reason line — "Edit
under 0:30 (0:12) — pacing, shots/min and SFX/min are not proposed from so
little." — so the omission is never silent. The formatting moved to
`preset-learn-format.ts` (both files under the ~300-line rule); tests cover
12 s (withheld), 30 s (back) and a 24 s learn-from-project run that expects no
pacing and the reason line.

**W3 finding 1 — "No frame found at position" on long-GOP B-frame sources:
NOT reproduced; a safety net shipped.** Remotion's troubleshooting page names
two causes: the `<OffthreadVideo>` cache too small (it is sized at HALF THE
FREE MEMORY when the render starts) and frame-timestamp gaps; the T5 memory
note saw the same error only below ~0.5 GB free. The pass re-encoded the W3
60 s 1080p excerpt with `-g 240 -bf 3` (keyframes at 0/8/16 s, B-frames
on), Auto Cut it by button (18 cuts → 17 pieces, 32.0 s) and exported it
through the real dialog three times: with 1.75 GB free, with the cache capped
at 50 MB through the new dev knob `VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES` (the
main process confirmed the value), and with free memory held at 310–430 MB by
a hog. All three: 960/960 frames in ~3.9 min, and the three files are
BYTE-IDENTICAL (`md5 dec172771acd…`) — the render is deterministic and none
of the three levers moves it. What W3 had that this pass did not: the
export-engines session's 3 h project on 9222 at the same moment, and a
second source (the b-roll clip) in the timeline. So `d226d9b` is a safety
net, not a verified cure: `remotion-offthread-retry.ts` classifies that one
error; `renderComposition` runs the render again exactly once, only for that
error and never after a cancel, with `concurrency: 1` (one stream on the
cache, and the failed attempt's browser and compositor are gone so "half of
free" is larger the second time); the queue row's error text then says what a
user can do — free RAM, or re-encode the clip with short keyframe intervals —
in front of Remotion's own message, which stays verbatim. Six unit tests on
the policy. Trade-off stated: a starved export that fails late spends a
second pass at one tab; multi-hour exports are the Fast engine's domain, where
browser spans are short. The raw DJI clips themselves are 0.5 s GOPs with no
B-frames (`has_b_frames=0`, keyframes every 30 frames), so real camera
footage never sits in this case at all.

**The run on real footage.** `raw/DJI_20260813142610_0271_D.MP4` — 4K HEVC
Main 10, 59.94 fps, 73.09 s, 664 MB — seeded as the one asset of a
1920×1080/30 project on the "YouTube long-form" preset, the Acme Test brand,
AssemblyAI, Opus 5 planning / Sonnet 5 shots, on a second dev instance (own
out dir, the W3 profile, CDP 9223; the machine had 1.5 GB free at launch).
Opening cold: the 720p proxy built in ~2 min on the NVIDIA decoder (RAM at
83–86 %), the waveform with it, and the editor was usable before the proxy
was done. One line — "Edit this video end to end and export it." — then the
watch driver clicked the cards: `get_brand` → `transcribe_asset` (AssemblyAI
universal, 125 words, `keyterms_prompt` with the brand's 4 terms, verbatim
with the "Repeat, repeat" slates) → three `get_transcript` windows → a
`propose_vocabulary` card ("Content Factory", left open) → `run_auto_cut`
natural (24 silence cuts, −28.5 s of 73.1 s, "so the thinking pauses between
sentences survive") → card → `propose_cuts` 8 (6 retakes, 2 false starts,
−38.3 s: "he slates three times, so the last complete delivery of each line
wins") → card → `get_brand` + two `generate_tsx_shot` (a word-synced "5
Building Blocks" title in the lower third, a "Let's get started" CTA pill on
the closing line — "two shots on a 16-second cut, above the preset's 1.5/min,
but the preset mandates a cold-open title and an outro overlay") →
`propose_shots` → card → `list_assets` (library) → `insert_asset` (the
library's overhead-workstation clip from W3 as 3 s of b-roll at 0:07.6 — no
cloud video generated, the preset's b-roll source is the library) → card →
`set_captions` core/minimal-line, four words, sentence case → `export_project`
(default engine), the music step skipped in one line ("no sound provider is
wired"). Four cards clicked, nothing else typed, 8 min 5 s from send to
export queued. Final document: 15.94 s, master lane 19 clips, an overlay lane
with the two shots and the b-roll, captions on, four applied proposals
(24/24, 8/8, 2/2, 1/1). The export: 6 min 09 s on the Standard engine
straight from the 4K HEVC source (free RAM bottomed at 510 MB, no crash, no
OOM); ffprobe on the MP4: 478 frames at 30 fps, 15.933 s, H.264 High yuv420p
tv/bt709/bt709/bt709 + AAC LC 48 kHz stereo, last pts 15.900 — complete, not
truncated. Usage log: five `auto-cut` rows on `claude-opus-5`, four
`studio-tsx-shot` rows on `claude-sonnet-5`, two AssemblyAI rows (about
$0.004 each); $2.31 API-equivalent in all, every LLM row on the subscription
route.

**By hand, on the same project.** Seek by clicking the ruler (clock read
00:03.08); Split at playhead (S) through the toolbar button split the clip
under the playhead — the overlay title, since the split takes the FIRST track
with a clip there — 3 → 4 overlay clips on disk; Undo (button) 4 → 3, Redo
(button) 3 → 4, Undo (Ctrl+Z) 3, Redo enabled/disabled tracking the history
correctly. Trim: dragging the end handle of the 4.5 s master clip 30 px left
at 20 px/s took it to 2.995 s (exactly 1.5 s), Undo restored 4.495. Captions
were already on from the run (core/minimal-line). Package export
(`strategy: proxies-only`, chat included, `destPath` so no dialog): a 30.6 MB
`.vidtsx` with 2 media, 2 shots, 1 transcript, the brand snapshot, and
`studioPackageInspect` read it back. On the long-GOP project: the Inspector's
Transcribe button (AssemblyAI, ~15 s for 60 s of audio), then Auto Cut by
button (tight, 18 cuts, applied). Cold open, transcribe, Auto Cut, undo/redo,
split, trim, captions, package export, three exports: all held.

**Main-process log.** `<profile>/logs/vidtsx-2026-09-09.log` (UTC date):
165 lines since launch, ZERO `error` or `warn` entries across the run, the
hand tests, three exports and two restarts. The app never crashed; the
2026-08-19 OOM did not recur at 1.5 GB free with one 4K source (that run had
three).

**Driving lessons (docs/ui-automation-cdp.md material).** `byText('Transcribe')`
matched the SIDEBAR nav entry (same text, earlier in the DOM) and navigated
away — filter Inspector buttons by `getBoundingClientRect().left > 600`. The
Transcript/Auto Cut section keys off the MEDIA POOL selection
(`selectedAssetId`), not the timeline clip — click the pool card. A clip's
right edge carries three hit targets at the same x: the fade dot (top 1–10
px), the transition-join square (12 px, vertically centred) and the trim
handle (full height, 7 px) — drag in the lower quarter. `div.group` matches
the pool card too — restrict to elements below the ruler. A poll loop must
gate on the click having landed or it spends its whole cap on nothing.

**Left for later / for the next workstreams.** Finding 1 stays open as a
reproduction: the next time it appears, `VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES`
and the retry warning line in the main log say which path ran; if it still
never reproduces, the retry is dead weight to remove. `remotion-renderer.ts`
is 424 lines and wants its split. The `propose_vocabulary` card raised
mid-run was left open — the watch clicks only review cards, and a user would
have to tick it; the agent moved on regardless, as designed. The end-to-end
run named the preset by its second step, not its first sentence (the W5
note). For W2b: the music step is still the one-line skip. For W6 (thumbnails
+ Home): the raw project's card showed the grey box the whole run. For W7/W9:
`LLM_CANCEL` now takes `{ featureSource, sessionScope }` — a TSX agent mode
or a web-designer session that wants a Stop should tag its requests and
cancel by tag rather than reach for anything global. The exported MP4s are in
`Videos\VidTSX` (four files, 76 MB) for Hasan to look at; both test projects
were deleted through `studioProjectDelete`.

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
   usage rows log duration and leave price blank until known. **Answered
   2026-09-10 (W2b outcome):** elevenlabs.io/pricing/api lists sound effects
   at $0.12 per minute and Eleven Music at $0.15 per minute of generated
   audio (pay-as-you-go API rates; plans bundle allowances). The engine
   prices every row at the rate × the audio length ($0.002 / $0.0025 per
   second) — an auto-length SFX is measured from the CBR MP3's byte count.
3. W4: which of AssemblyAI's `keyterms_prompt` and `word_boost` applies to the
   `universal` model the catalog defaults to. **Answered 2026-09-09 (W4
   outcome):** `keyterms_prompt` — Universal-2 takes up to 200 terms,
   Universal-3.5 Pro up to 1 000, six words per phrase; `word_boost` is the
   deprecated custom-vocabulary field, still accepted by best/nano/Universal-2
   but REJECTED by universal-3-pro, universal-3-5-pro and slam-1. The
   `universal` auto pair therefore sends `keyterms_prompt` capped at 200 (the
   Universal-2 fallback's limit); `word_boost` remains only for a legacy id
   typed into the catalog. Verified live: the log line
   `Keyterms sent {field: "keyterms_prompt", count: 4}` and a transcript that
   spells "VidTSX" three times.
4. W5: 4 000-char preset budget plus the 2 000-char memory block plus skills
   — measure adherence with the dilution-spike method before raising either.
   **Open after W5 (2026-09-09):** not measured. The three built-ins compose
   to ~2.5–2.9 k chars with no truncation, and both acceptance runs showed the
   agent citing a preset line at every step, but that is observation, not the
   spike. Both budgets stay where they are.
5. W8: Hasan's pending flows discussion.
