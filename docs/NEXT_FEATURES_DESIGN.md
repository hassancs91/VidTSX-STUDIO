# Next features design — provider wave · text-based editing · local background removal

> Written 2026-08-20 from Hasan's six-item feature request, after a research
> pass over (a) the provider/usage architecture, (b) the Studio timeline
> architecture, (c) current external-service facts (Kimi, MiniMax, Cloudflare
> Workers AI, ElevenLabs — all verified against live docs 2026-08-20), and
> (d) the local video-matting state of the art. Same pattern as
> `SHOT_QUALITY_DESIGN.md`: each decision lays out options, names a
> recommendation, and the checklist at the end is answerable inline.
>
> **Relation to the release plan**: V1 code is done and the repo is public;
> Hasan's own testing pass is the next gate. None of these features blocks
> 1.0.1. Recommendation: treat them as post-1.0.1 waves (see Sequencing) even
> if we call them "V1 features" — nothing here should delay re-flipping the
> release.
>
> **Relation to SHOT_QUALITY_DESIGN.md**: interference is limited and mostly
> positive — see the Interference map (§7).

## V1 BUILD ORDER — the tracker (work down this list one slice at a time)

> Status column updated as slices ship (the Status.md/design-doc-rev
> pattern). Deferred-by-decision items are listed at the bottom so they
> are never "lost", just not V1. Kit-slice dependency RESOLVED 2026-08-21:
> SHOT_QUALITY Q4 shipped (`shot-kit-pin.ts`, folder-as-truth
> `<project>/kit/<ver>/` pinning) — V1-6 and E-slices now build against a
> real mechanism, not a future one.

| # | Slice | Scope (design §) | Size | Status |
|---|---|---|---|---|
| 0 | **1.0.1 release** | existing V1 code; Hasan's testing pass + release checklist; no new features ride along | — | pending Hasan |
| 1 | **Auto-save hardening** | Q10: beforeunload/before-quit/blur flush; rotating snapshots (`<project>/snapshots/`, open + 10-min active, keep 20 + daily thin); "Restore version…" picker | S | **SHIPPED 2026-08-21** (NF1) |
| 2 | **ElevenLabs STT** | Q3: `SttProviderType 'elevenlabs'`, provider class (sync multipart on extracted audio), `elevenlabs` credential + key row, `STT_CATALOG` `elevenlabs/scribe-v2` (no `verbatimDisfluencies` until tested on Raw Footage Test audio) | S | **SHIPPED 2026-08-21** (NF2; verbatim A/B still open) |
| 3 | **Cloudflare Workers AI images** | Q2: `type 'cloudflare'`, token in `ProviderCredentials.cloudflare` + plain account-id setting, per-model output dialect, default catalog (flux-1-schnell default), neuron-exhaustion error mapping | S | **SHIPPED 2026-08-22** (NF4; live-key test pending Hasan's token) |
| 4 | **Usage-tracking fix** | Q4: `AiRequestType` += `stt`/`video`; log STT + fal-video handlers; `pricePerHourUsd` on STT catalog + `priceUsd` on image models; chart Tokens\|Requests\|Cost toggle; log image provider-test | S | **SHIPPED 2026-08-22** (NF6) |
| 5 | **Content Safety enforcement** | **`CONTENT_SAFETY_DESIGN.md`** (grilled): Gate B pixel classifier (Marqo 384 ONNX bundled, banded thresholds, 5 call sites incl. input refs + video frames + captures, fail-closed, utilityProcess-hosted) + Gate A curated prompt blocklist (visual fields only; profanity never blocks) + ZERO LLM hooks + Content Safety page + eval harness | M | **SHIPPED 2026-08-26** (NF8–NF12; ensemble rejected on eval, bands frozen 0.8/0.2; Hasan's blocklist review + full-set eval re-run open — see doc Rev 2) |
| 6 | **Gemini/agy subscription image provider** | Q1: `type 'gemini-cli'`, TS port of gen-image.ps1 logic into `agy-cli.ts` service, `registerInstance` pattern, setup card (detect + auth probe + install instructions), concurrency-1 queue, aspect bucketing, 3-ref cap. Plumbing built two-wide for the deferred mmx provider | M | **SHIPPED 2026-08-26** (NF13–NF14; live agy generation CDP-verified; stdin-pipe hang found + fixed) |
| 7 | **Project packages** | Q7: `.vidtsx` zip (manifest w/ `packs/`, `kind`, `replaceable` reserved), export dialog (3 media strategies, agent-chat opt-in), import (validate → migrate → new id → media into `<project>/media/` → D14 gate per shot → brand offer), zip-slip + caps, kitVersion pinning against the SHIPPED `shot-kit-pin.ts` scheme, file association | M | **SHIPPED 2026-08-26** (NF16–NF18; export→import round trip CDP-verified, file association proven via a real second-instance argv) |
| 8 | **Text-based editing slice 1** | Q5a: Transcript panel beside preview; click-to-seek; karaoke highlight; select-to-delete (inverse `clipWords` → editorial-snapper edges → `apply-cut-proposal` as `user_cut`, direct apply, one undo step); show-deletions pills + restore; filler highlight + remove-in-selection; read-only while a cut review is open. Flag `studio-text-edit` | L | **BUILT + live-verified 2026-09-17** — dev-preview flag (`false`: on in dev, hidden in production); outcome under Q5 ("Slice 1 outcome"). Committed 2026-09-18; needs Hasan's pass on real footage before the flag flips |
| 9 | **Pack system E1 — transitions** | Q8a/b: pack registry service (scan/validate/degrade), `StudioClipTransition.kind` → namespaced string (schema v2 migration), TransitionRenderer, core pack (crossfade, dip, wipe, slide, zoom, flip via @remotion/transitions), luma-wipe support, picker UI. **Reserve `keyframes` + `effects[]` schema shapes here** (Q9 binding) | M | **design written 2026-09-17 — `docs/studio/TRANSITION_PACKS_DESIGN.md`** (supersedes this row's scope where they differ: the add-ons' authored contract, NO schema v2 bump, no `@remotion/transitions` wrappers; luma wipes + the schema reserves deferred). **P0–P6 all BUILT + verified 2026-09-17 → 2026-09-22 (uncommitted)**: engine (Structure A for renders, scene mirrors in the Player), pack loader + IPC, the Transitions tab, the export copy step, `.vidtsxpack` / `.vidtsxtransition` import, and the content split (four everyday transitions built into `core`, nineteen in the importable `vidtsx-transitions` Volume 01 pack). Open: package drag-drop needs a `webUtils.getPathForFile` preload helper; single removal from `imported`; the add-ons builder |
| 10 | *(optional V1 closer)* **Pack system E2 — effects tiers 1–3** | Q8c: `effects[]`, EffectProps contract, param-schema-driven Inspector, core pack incl. chroma key + Adjust (single-pass + dither rules, Q9b), ephemeral preview. Flag/dev-preview | L | V1-or-V2, Hasan's call |
| P0 | **Preview: proxy hygiene** | **`PREVIEW_ARCHITECTURE.md`** W0+W2: delete the dead NVENC branch (bundled ffmpeg has no hardware encoders), `-hwaccel d3d11va` on the transcode input with guarded fallback. One file (`proxy-generator.ts`), gated on nothing | XS | **SHIPPED 2026-09-02** (T4: `-hwaccel d3d11va` with a sticky-off fallback, `proxy-hwaccel.ts`; the NVENC branch is gone from `proxy-generator.ts`) |
| S0 | **Preview: decoder measurement spike** | **`PREVIEW_ARCHITECTURE.md`** §D4: add `@remotion/media@4.0.435` (same train — verified on npm), swap `case 'video'` behind a dev flag, measure scrub fps / decoder count / preview-vs-export frame diff incl. a D-Log clip. Nothing ships; its result decides P1–P3 | XS–S | **DONE 2026-08-28 as T2** of `PREVIEW_TESTS_PLAN.md` — conditional: loses at 1 layer, wins 3× at 3 layers; colour holds on D-Log; 4K HEVC decodes natively. `@remotion/media` stays behind `media-engine.ts`, default `offthread`. Recommendation on file: keep the flag, do not ship the swap |
| P1–P3 | **Preview: proxy tier + decoder adoption** | **`PREVIEW_ARCHITECTURE.md`** §E3/§F: W4 intraframe-proxy A/B + W3 timeline-first ordering (P1); if S0 passes, Remotion train bump + `@remotion/media` in BOTH hosts + re-vendor + export regression (P2, M); W1 skip-predicate w/ keyframe probe + W5 preview-quality setting (P3) | S / M / S–M | **P1 SHIPPED 2026-09-02** (T3: all-intra 540p, segmented + resumable; T4b: opt-in GPU proxy encoder) · **P2 parked** (T8a: export on the WebCodecs engine returned 0 frames on the GPU backend and fell back on HEVC; the 4K playback drop is unexplained) · **P3 not built** |

**Deferred by decision (2026-08-20), design retained as plan-of-record:**
MiniMax/mmx provider (Q1) · background removal / vision analysis engine
(Q6 — chroma key does NOT wait on it) · everything in the Q9 ledger ·
CLI/local API (Q11, disciplines bind now) · whiteboard studio (Q12) ·
template flavor of packages (Q7g) · ElevenLabs TTS.

## Facts established by research (not guesses)

- **Kimi/Moonshot has no image generation anywhere scriptable.** The API
  model list is text/vision-input only; Kimi CLI is a pure coding agent. The
  consumer kimi.com app can make images, but there is no CLI/headless path.
  → Kimi is **out** as an image provider. (Its LLM preset stays.)
- **MiniMax ships an official CLI (`mmx`, `npm i -g mmx-cli`)** whose
  `mmx image` runs on the **Token Plan subscription** (Plus $20 / Max $50 /
  Ultra $120 per month, shared text+image+speech quota), authenticated via
  OAuth device flow — the direct analog of our `agy` recipe, but official
  and API-shaped rather than an agent we harvest files from.
- **The `agy` path is proven** (skill `google-sdk-gen-img` + live use):
  Nano Banana 2 on the Google AI Ultra subscription. Caveats are all known:
  exit 0 lies (must gate on the `generate_image DONE` event in the NDJSON
  stream), images harvested from `~\.gemini\antigravity-cli\brain\<conv>\`
  non-recursively, max 3 reference images, no seed, always JPEG, aspect set
  `1:1 2:3 3:2 3:4 4:3 4:5 9:16 16:9`, prompt must be pinned VERBATIM, and a
  stray `GEMINI_API_KEY` env var can silently route to metered billing.
- **Cloudflare Workers AI**: one REST shape —
  `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}`
  with a Bearer token scoped "Workers AI". Current txt2img catalog:
  `@cf/black-forest-labs/flux-1-schnell` (base64 JPEG, steps≤8),
  `flux-2-dev` (multi-reference), `flux-2-klein-4b/9b`,
  `@cf/leonardo/lucid-origin` + `phoenix-1.0`, SDXL base + lightning,
  dreamshaper-8-lcm, and SD-1.5 img2img + inpainting. Pricing in "neurons"
  ($0.011/1k), **10k neurons/day free** — flux-1-schnell ≈ $0.0006/image,
  ~170/day free. Output format varies per model (base64 JSON vs raw binary).
- **ElevenLabs STT is now Scribe v2** ($0.22/hr; AssemblyAI ≈ $0.27/hr).
  `POST https://api.elevenlabs.io/v1/speech-to-text` multipart; input `file`
  (≤3GB safe, ≤10h) or `source_url`; params `model_id`, `language_code`,
  `diarize` (up to 32 speakers), `timestamps_granularity word|character`,
  `tag_audio_events`; output `words[]` with `text/type/start/end/speaker_id`
  (`type` includes `spacing` and `audio_event` entries that must be filtered
  when mapping to `SttWord`). Tops the Artificial Analysis WER leaderboard;
  AssemblyAI claims wins on messy/verbatim audio. Same key later unlocks TTS
  ($0.05–0.10/1k chars) + voice cloning.
- **Usage tracking today logs LLM + image only** (`AiRequestType = 'llm' |
  'image' | 'local-llm'`). STT and fal video generation are logged nowhere;
  image entries log 0 tokens/0 cost so they flatline on the chart. Hook
  placement is per-IPC-handler (`aiUsageService.appendEntry`), engines are
  usage-unaware.
- **Local matting with shippable licenses exists**: SAM2.1 video tracking
  (Apache-2.0, full-video ONNX incl. memory modules —
  `square-zero-labs/sam2.1-tiny-video-onnx`) for click-to-select subjects +
  temporal propagation; ViTMatte (MIT, ONNX) or BiRefNet_HR-matting (MIT,
  ONNX, ~17fps @1024² FP16 / 3.5GB VRAM on a 4090) for true soft alpha on
  the edge band; MODNet (Apache, ~25MB) as the fast/CPU talking-head tier.
  All run in **onnxruntime-node with the DirectML EP** (any DX12 GPU — NVIDIA
  /AMD/Intel iGPU, no CUDA toolkit; CUDA EP is Linux-only in the Node
  binding). The famous alternatives are license-blocked: **MatAnyone 1/2 is
  non-commercial (S-Lab)**, **RVM is GPL-3.0** (only usable as a separately
  downloaded sidecar — legal judgment call), **BRIA VRMBG needs a paid
  agreement**. DaVinci's Magic Mask and AE's Roto Brush prove fully-local is
  viable product-wise; their knob set (feather, shift edge, contrast, reduce
  chatter) is the industry template.

---

## Q1 — Subscription CLI image providers (Gemini via `agy`, MiniMax via `mmx`)

### Q1a. Provider shape: the `LocalSdImageProvider` pattern, not an API-key preset

These are **CLI-bridge providers**: no API key, availability = binary
installed + authenticated. The codebase already has the exact pattern —
`LocalSdImageProvider` (`src/image-engine/providers/local-sd-provider.ts`):
`registerInstance()` (never persisted to settings), `getSupportedModels()`
returns `[]` when the CLI is unavailable (UI hides it), settings-save
filters the id out, main-process concerns injected via a prepare hook.

Build:
- `ImageProviderConfig['type']` widens with `'gemini-cli' | 'minimax-cli'`
  (or one `'cli'` type + id dispatch — recommendation: **two explicit
  types**, matching how `'local'` is explicit today).
- `src/image-engine/providers/gemini-cli-provider.ts` +
  `src/main/services/agy-cli.ts`: a TypeScript port of `gen-image.ps1`'s
  logic (spawn `agy -p <pinned instruction> --output-format stream-json`,
  parse NDJSON, require the `generate_image DONE` step event, harvest the
  newest image non-recursively from the brain dir, copy to destination).
  We do NOT depend on the user's `~/.claude/skills` script — the logic moves
  into the app. All the skill's hard-won rules (VERBATIM pinning, soft-deny
  detection, non-recursive harvest, `GEMINI_API_KEY` warning) come along as
  code + comments.
- `src/image-engine/providers/minimax-cli-provider.ts` +
  `src/main/services/mmx-cli.ts`: wraps `mmx image generate`. Exact output
  contract (file path? stdout?) to be pinned during implementation — the
  CLI is API-shaped so this should be far simpler than `agy`.
- Both register from `image-init.ts` alongside the local SD provider.

### Q1b. Detection, auth, and setup UI

Model on `SdCliSetupCard` (AI Models → Image): a **setup card per CLI** —
detect binary (`%LOCALAPPDATA%\agy\bin\agy.exe`; `mmx` on PATH), probe auth
(`agy models` succeeds; `mmx` equivalent TBD), show install + sign-in
instructions when missing. Install/sign-in stays **manual and interactive**
(browser OAuth) — the app never automates account sign-in; it detects and
explains. Re-probe on window focus (the describe-availability precedent).

### Q1c. Provider semantics and limits (surfaced honestly in UI)

- Gemini/agy: models list = one entry ("Nano Banana 2 (subscription)");
  operations `text-to-image` + `multi-reference` (≤3 refs — reject a 4th
  with the skill's "fold extras into the prompt" message); width/height →
  nearest supported aspect (the fal provider's bucketing already does this);
  output JPEG. `numImages > 1` = sequential loop. Concurrency 1 (it spawns a
  whole agent per call); queue further requests.
- MiniMax/mmx: models per CLI capability; concurrency low; quota exhaustion
  (5-hour rolling windows) surfaced as a typed "subscription quota" error,
  not a generic failure.
- Usage logging: `appendEntry` with `requestType: 'image'`, `costUsd: 0` —
  that's the whole point — but provider name makes subscription usage
  visible in the log.

### Q1d. What this buys the Studio agent for free

`generate_image` (agent tool) and `generateImageAsset()` route through
`imageEngine` — once these providers register, **shot-asset generation can
run on subscription quota with zero marginal cost**. Default-provider choice
stays with the user (Image Studio active-provider mechanism). Synergy with
SHOT_QUALITY, no interference.

### Q1e. LLM side — explicitly deferred

`kimi`/`minimax` LLM presets already exist in `src/engine/presets.ts`;
Gemini's is V1-hidden. Nothing in this wave touches LLM routing. A later
version can add an `agy`-backed LLM provider (type `'agent-sdk'`-like) if
wanted.

**DECIDED (Hasan, 2026-08-20): Gemini/agy only in V1; MiniMax/mmx deferred
to a later version.** The provider `type` union and setup-card pattern are
still designed for two so the mmx provider lands as a drop-in when its
time comes; the research facts above stay valid.

---

## Q2 — Cloudflare Workers AI image provider

A plain cloud provider following the established add-a-provider checklist,
with one wrinkle: **two credentials** (API token + account id).

- Credential: `ProviderCredentials.cloudflare` holds the **API token**
  (secret, safeStorage-encrypted like the rest). The **account id** is not a
  secret → plain settings field beside the key row (input in the
  `ApiKeysSection` row, stored via ordinary settings). Avoids inventing a
  multi-part credential format.
- `type: 'cloudflare'` in `ImageProviderConfig`; provider class with
  per-model output dialect (flux models return base64 JSON; SD/SDXL return
  raw binary — normalize to `GeneratedImage.base64`).
- Default catalog (`provider-model-defaults.ts`): `flux-1-schnell`
  (default — fast, ~free), `flux-2-klein-9b`, `flux-2-dev`
  (multi-reference), `leonardo/lucid-origin`, `sdxl-lightning`. img2img /
  inpainting models can join when Image Studio's operations need them; the
  user-editable catalog covers the rest.
- Errors: map CF's neuron-exhaustion / 429 to a "daily free tier exhausted"
  message.
- Key test: existing red-circle `imageTest` flow works as-is.

Small, self-contained, high value ("easiest onboarding of any provider —
free tier, one token"). No open questions beyond catalog composition.

---

## Q3 — ElevenLabs as an STT provider (transcription only, for now)

Follows the STT checklist exactly:

- `SttProviderType` += `'elevenlabs'`; credential `elevenlabs`;
  `ApiKeysSection` row (capability: audio).
- `src/transcription-engine/providers/elevenlabs-provider.ts`: multipart
  upload of the **extracted audio** (we already run `extract-audio.ts`
  first, so payloads are small), **synchronous** request (no webhook — we're
  local-first with no receiver; AssemblyAI-style polling isn't needed since
  the sync API blocks until done and our audio is pre-extracted). Map
  `words[]` → `SttWord[]` filtering `type: 'spacing'`; `audio_event` entries
  → the existing `audioEvents` capability; `speaker_id` → `speaker`.
- `STT_CATALOG` += `elevenlabs/scribe-v2` with features: `wordTimestamps`,
  `speakerLabels`, `audioEvents`; **not** `verbatimDisfluencies` unless
  verified in testing (AssemblyAI stays the recommended pick for the
  editorial pass until Scribe's verbatim behavior is confirmed on our real
  footage — the auto-cut pipeline depends on verbatim fillers).
- Both Studio's picker (`sttEntriesWithTimestamps()`) and the Transcribe
  screen's cloud dropdown pick it up automatically from the catalog. The
  capability-flags-not-provider-names rule means zero consumer changes.
- TTS / voice cloning: same key, explicitly a later version — record in
  `V2_FEATURES.md`.

*(Open: is Scribe v2 verbatim enough for auto-cut? Test on the Raw Footage
Test project audio and set `verbatimDisfluencies` from evidence.)*

---

## Q4 — Usage tracking: close the gaps

Answer to Hasan's question: **today only LLM and image generation are
logged** — image with zero cost/tokens (flat line on the chart), STT and fal
video generation not at all. Plan, smallest useful:

1. `AiRequestType` += `'stt' | 'video'`; `AiFeatureSource` +=
   `'transcription'` (Studio + Transcribe screens both funnel through the
   same handler).
2. Log STT in the `stt:transcribe:run` handler: provider, model, durationMs,
   plus `costUsd` estimated from a new optional `pricePerHourUsd` on
   `STT_CATALOG` entries (AssemblyAI ≈ $0.27/hr, ElevenLabs $0.22/hr,
   local-whisper 0) × audio duration.
3. Log fal video generation in `video-generation.ts`'s completion path
   (`requestType: 'video'`, model, duration; cost estimate per catalog entry
   where known).
4. Image cost: `ImageModelCatalogEntry` already carries `credits?` — add an
   optional per-model `priceUsd` default in `provider-model-defaults.ts` and
   multiply by image count; unknown models stay 0.
5. Chart: add a series toggle **Tokens | Requests | Cost** so non-token
   request types are visible (today's chart plots tokens only). Log table
   gains nothing new — columns already generalize.
6. Also log `handleImageProviderTest` (the LLM test already logs; the image
   test doesn't — asymmetry).

No DB migration needed (TEXT columns). Ring buffer stays 10k.

---

## Q5 — Text-based editing (Descript-style)

### What already exists is most of the engine

- `caption-words.ts` (`masterLane`, `clipWords`, `deriveCaptionSegments`)
  already computes **the transcript of the current edit, in timeline order,
  with per-clip provenance** — a transcript pane is a *render* of it.
- `apply-cut-proposal.ts` already turns accepted **source-time spans** into
  ripple-applied timeline edits in one undo step.
- `cut-planner.ts`'s `planClip` with `internalGap = Infinity` (the editorial
  snapper) snaps any span to **clean audio edges using the RMS envelope** —
  this is our quality edge over Descript, which cuts on word boundaries and
  produces audible clicks.
- `handlePlayRemoved` / `handlePlayJoin` + `preview-mapping.ts` already give
  "audition what you deleted / hear the join".
- `transcript-takes-view.ts` already segments takes (0.8s gaps) and marks
  fillers inline — the agent's text↔time addressing scheme.

So this feature is chiefly **a new panel + inverse mapping + a few timeline
actions**, not a new engine.

### Q5a. The panel

A new Studio panel/tab ("Transcript" or "Text"), rendering the master-lane
edit transcript word-by-word from `deriveCaptionSegments`:

- **Click word → seek** (word's timeline time; the mapping is already
  computed).
- **Playhead karaoke**: current word highlights during playback (the caption
  machinery's timing reused).
- **Select range → Delete**: selection maps to `{assetId, sourceStart,
  sourceEnd}` per contributing clip (inverse of `clipWords`), edges snapped
  via the editorial snapper, applied through the `apply-cut-proposal`
  machinery as `category: 'user_cut'` — **direct apply, one undo step, no
  proposal gate**. The proposal/review gate exists for *agent bulk* edits;
  a user deleting a sentence they selected needs undo, not review.
- **Removed-text visibility ("show deletions")**: because the asset
  transcript retains *all* words and the timeline says what's kept, the gaps
  are **derivable** — removed spans render as collapsed pills (`¶ 3.2s`)
  expandable to struck-through text, with **click-to-restore** (re-insert
  the span: split at the gap and add a clip covering it — the inverse op).
  This out-Descripts Descript: deletions are never destructive state, they
  are a *view* over timeline vs transcript.
- **Filler highlighting**: verbatim fillers get a subtle tint + a "remove
  all fillers in selection/clip" action that builds the same spans the
  editorial pass would — instant, visual, no agent run needed.
- **Speaker colors** when diarization is present; **take grouping** (the
  0.8s take gaps) as paragraph breaks, retakes badge-able later.

### Q5b. Explicit non-goals for slice 1

- **Word text correction** (fixing the transcript text; feeds captions) —
  slice 2. Requires an overrides layer on the transcript cache file
  (never mutate STT output in place).
- **Typed insertion / TTS overdub** (Descript's "type to speak") — only
  meaningful after ElevenLabs TTS lands; ledger V2.
- **Multi-track text editing** — master lane only (matches captions).
- **Word-boundary-only trims of clip edges via text** — later; slice 1 is
  delete/restore of internal ranges + click-to-seek.

### Q5c. Interactions with existing invariants

- One-open-proposal rule: direct text deletes are not proposals, so they
  coexist; but while a cut review IS open, the text panel goes read-only
  (same rule Auto Cut obeys).
- Transcribe-first: panel shows the existing "transcribe this asset" nudge
  (`untranscribedMasterClips`) when words are missing.
- Speed-changed clips: `clipWords` already handles `speed`; text edits on
  sped clips map through the same math.

*(Open: panel placement — right-side Inspector tab vs a bottom drawer
beside the timeline. Recommendation: a **left/main-area tab that can sit
side-by-side with the preview** — Descript's core loop is watching while
reading; burying it in the Inspector kills that.)*

### Slice 1 outcome (2026-09-17)

Built as designed, with four deviations the design could not have known about
— each one a place where "already exists" above turned out to be half true.

- **The snapper moved to shared, no IPC added.** `cut-planner.ts` and the
  snapping half of `editorial-cuts.ts` were pure but lived under `src/main/`.
  They are `src/shared/studio/cut-planner.ts` and `cut-snap.ts` now
  (`snapCutSpans`, generic over the caller's categories; main's
  `snapEditorialCuts` is a typed wrapper, its tests unchanged). The renderer
  already reads both cache files it needs — transcript words and the waveform
  JSON with `rmsDb` — through `studioCacheRead`, so the feature adds **no
  channel, no handler, no preload entry**. `FILLERS` / `TAKE_GAP_SECONDS`
  moved to `shared/studio/transcript-tokens.ts` so the panel tints exactly
  what the agent's takes view marks.
- **Not through `apply-cut-proposal`.** That op is asset-wide by design (it
  cuts EVERY clip that plays the asset) and stamps agent provenance. A text
  delete is `planTextDelete` → TIMELINE spans scoped to the clips under the
  selection → `applyTextDelete` over the range-delete machinery
  (`removeSpanAllTracks` / `removeSpanFromTrack`, which did not exist on
  2026-08-20). Same ripple-mode rule as range delete: the master lane always
  closes, `rippleAllTracks` decides whether the other lanes and the markers
  follow. Reducer actions `text-delete` (N spans, ONE undo step) and
  `text-restore`. Pinned by a test: a second clip playing the same source is
  untouched.
- **Speed was NOT handled** (§Q5c said it was). `splitClip` and
  `cutSpanFromClips` advanced the right piece's `sourceIn` by the timeline
  offset, not offset × speed — wrong source after any split or range delete
  on a sped clip. Fixed in both (`clipRate` in `timeline-ops.ts`), with tests.
  **Still open, same defect:** `trimClip` (start edge + both clamps),
  `trimClipRippleAll`, and `applyCutProposal`'s `keptPieces` /
  `removedTimelineSpans`. Not touched here — they are not on this feature's
  path and their clamps need more than a one-line fix.
- **Restore needed a new op.** `restoreDeletion` re-reads the join from the
  timeline as it is NOW (never from the pill that was clicked, so a stale pill
  is a no-op), opens it with `insertGapAllTracks` or the new
  `insertGapOnTrack`, and inserts a plain user clip — the look of the piece it
  continues, none of its edge state. Round-trip test: delete → restore gives
  the same words at the same seconds.

**Found by the live pass, fixed:** whisper.cpp stamps some real words with no
duration to speak of (0–20 ms) at the instant the next word begins — 7 of 73
words in the test clip ("is", "tells", "we", "noise", "the" ×2, "works").
The membership rule mirrored from `clipWords` dropped the zero-length ones, so
the panel read "The idea simple." `withSpokenSpans` gives such a word the gap
before its stamp (capped at 1 s) — applied once, to the words BOTH the document
and the delete planner read. **`clipWords` still drops them, so captions are
missing those words today** — a captions bug, reported, not fixed here (it
changes caption output and has its own tests). Also: the karaoke lookup looks
25 ms ahead, because a seek rounds to the frame grid and could land half a
frame before the clicked word and light its neighbour.

**Decisions taken while building** (cheap to change): the panel is a fourth
tab of the left pane — beside the preview, mounted only while active; deletion
pills show only where WORDS were removed (Auto Cut's hundreds of tightened
pauses are not text anyone looks for); paragraphs follow the takes of the
ORIGINAL transcript so a delete never reflows the text around it; a delete of
the last words leaves the source's trailing silence (tightening is Auto Cut's
job); without an RMS envelope (a version-1 waveform) edges fall back to the
style's fixed pads and the toast says so.

**Verified:** 37 new unit tests (document, delete planner, restore, reducer
round trips, the two speed fixes). The Studio + shared-studio + main-studio
run: 989 passed, 9 failed, 11 skipped — the nine are 5000 ms timeouts in four
untouched disk-heavy files (snapshot store, agent memory, package export and
import), 64/64 green when those files run alone (the known load flake with a
dev app running);
`check:types` at baseline (26 / 10), none of them in a touched file. Live, by
CDP with real mouse and keyboard input on an isolated second instance (own
`--user-data-dir`, a scratch copy of `s3-autocut`, removed afterwards): 23/23 —
click-to-seek + karaoke, drag-select → exactly four words, Delete key, the pill with the
deleted text, Ctrl+Z / Ctrl+Y from inside the panel as one step each, Restore,
double-click + the Delete button, Remove fillers, autosaved timeline contiguous;
then read-only under a real Auto Cut review (banner, Delete disabled, Delete key
inert, editing back after Reject all), click-each-of-70-words lights that
word, and the shortcut guard against a control — with every clip selected the
editor's Delete removes the master clip, the same Delete on a text selection
in the panel removes the word and leaves the clips.

**Not verified:** a long project (the 3 h case — rendering is per-take with
`content-visibility`, never measured past 73 words); AssemblyAI / ElevenLabs
transcripts and real verbatim fillers (the test clip's two "um"s were planted);
speaker colours (in the design, not in the tracker row, not built); the join's
SOUND on real speech — the edges are the editorial pass's edges, but nobody has
listened to a text delete yet. That last one is Hasan's pass.

---

## Q6 — Local background removal ("Remove Background" on a clip)

> **DECIDED (Hasan, 2026-08-20): moved out of V1 — deferred to a later
> version.** The design below stands as the plan-of-record for when it's
> scheduled. What survives into V1 regardless: the *naming* decision that
> this service is a general **vision analysis engine** (Q8h), so nothing
> built earlier paints it into a matte-only corner; and chroma key (Q8h
> category 1) is **independent of this feature** — it's a pure shader with
> no ML, so green-screen users get a keying path whenever effects land,
> without waiting for Q6.

### Q6a. Model stack — decided by licenses as much as quality

Two user-facing quality modes:

- **Auto (one click, talking-head / clear subject)**: per-frame
  **BiRefNet_HR-matting (MIT)** at 1024², temporal EMA + guided-filter
  upsample to native res. No prompts needed. Flicker risk is the known
  tradeoff, mitigated by EMA; talking-head footage (our core case) is where
  per-frame flicker is least visible.
- **Subject select (best quality)**: click/box a subject on a keyframe →
  **SAM2.1 video ONNX (Apache)** propagates a temporally-consistent mask →
  auto-trimap → **ViTMatte (MIT)** refines the uncertain band into true
  soft alpha → guided-filter upsample. This reproduces the MatAnyone UX
  with shippable licenses.
- **Fast/CPU fallback**: **MODNet (Apache, 25MB)** at 512 + guided filter —
  auto-selected when no DX12 GPU or VRAM probe fails.

Blocked options recorded so we don't relitigate: MatAnyone (non-commercial),
RVM (GPL-3.0 — revisit only as an optional separately-downloaded sidecar if
quality demands it; legal call is Hasan's), BRIA (paid license).

### Q6b. Runtime — onnxruntime-node + DirectML in a utilityProcess

- `onnxruntime-node` is **already a dependency** (embedding engine worker
  uses it with the Windows DLL-path shim — `src/embedding-engine/worker.ts`
  is the template). EP order `['dml','cpu']`; DirectML covers NVIDIA, AMD,
  and Intel iGPUs with zero driver installs.
- Inference runs off the main thread (worker_threads or an Electron
  utilityProcess per job — matches the embedding worker precedent).
- Models download on first use via the existing `download-manager` +
  `model-library` (new `ModelCategory`, e.g. `'matte'`). Nothing bundled —
  the CLAUDE.md rule.

### Q6c. Pipeline and cache shape — a fourth media job kind

Extend `StudioMediaJobEngine` (`media-jobs.ts`) with kind `'matte'` —
and name the service **vision analysis engine** from day one: the matte is
its first artifact, face-landmark tracks its second (see Q8h; same cache
keying, same job events, one more `kind`):

- **Decode**: `runFfmpeg` → `-f rawvideo -pix_fmt rgb24 pipe:1` at inference
  resolution (the waveform generator already proves the stdout-piping
  pattern).
- **Infer**: ONNX session in the worker; recurrent/memory models process
  frames sequentially *within* a clip.
- **Two-stage cache** (so knob changes don't re-run inference):
  1. Raw alpha spool: grayscale PNG frames (or packed binary) in
     `cache/matte/<key>/alpha/` — crash-resumable per frame.
  2. Composited outputs, from the spool + knobs:
     **preview matte** = 720p **VP9-alpha WebM** (Chrome/Remotion Player
     decodes natively; proxy-sized); **export matte** = full-res
     **ProRes 4444** generated (or verified) at export-prepare.
- **Post knobs** (stage 2 only, cheap to re-run): feather, shift edge
  (choke/expand), temporal smoothing strength ("reduce chatter"), spill
  suppression. The AE Roto Brush knob set, deliberately.
- **Job key / scope**: per **asset + source span** — matte the clip's used
  span plus generous handles (recommendation ±2s), not whole assets (a 20s
  clip from a 30-min asset must not cost a 30-min matte). Trimming beyond
  the handles triggers a re-run prompt. Duplicate clips of the same asset
  span share the cache.

### Q6d. Compositing — pre-baked alpha media, no schema surgery

Route: the clip gets a flag (via the `ClipPatch` mechanism, e.g.
`clip.matte?: { key, mode, knobs }`), and `resolvePreviewUrl` /
`export-entry`'s resolver substitute the matte file when the flag is on.
`<OffthreadVideo>` renders alpha natively; tracks already stack
(`[...tracks].reverse()`); the composition's black background becomes
conditional. "What you scrub is what renders" is preserved because preview
and export both flow through `serializeTimeline`'s single resolver. No new
render path, no per-frame drawing in the Player.

Backgrounds are then just… whatever is on the tracks below: color/image/
video/TSX shot. (A "green screen export" — matte over solid color — falls
out for free.)

### Q6e. Concurrency, VRAM, and "multiple slots at once"

- GPU job queue inside the matte engine: **concurrency 1 for the
  BiRefNet/SAM2 tier, 2 for MODNet**, admission by VRAM probe
  (trial-allocate; DirectML degrades to shared memory gracefully but
  slowly). Multiple clips queue and run back-to-back; *within* a clip,
  sequential by design (temporal state). "Run on multiple slots in a track
  at the same time" = queue them all in one action; true parallel heavy
  jobs only on ≥12GB cards (probe-gated), never by default.
- OOM ladder: catch ORT allocation failure → retry at lower inference res →
  FP16 → serialize. (Same spirit as the proxy generator's sticky NVENC→x264
  fallback and the E2E test's OOM recovery.)
- Progress: `StudioMediaJobEvent` percent ticks (transient state map in the
  renderer, never the document — the existing folding rule). Clip badge
  while matting, like transcript status today.

### Q6f. UI

- Clip context menu / Inspector: **Remove Background** → mode picker
  (Auto / Select subject / Fast) → for Select: click points on the preview
  frame via a `CanvasOverlay`-style prompt layer (add/subtract clicks) →
  job runs → clip flips to matted with a badge; knobs live in the Inspector
  `ClipSection` and re-run stage 2 only.
- Ephemeral pre-commit preview of knob changes via the
  `overrideClipTransform` pattern (serialize-override, commit on release).

### Q6g. Sizing honesty

This is the largest feature of the six — a new inference engine, a new job
kind, model downloads, canvas prompting UI, and compositing changes. It
should be **last in sequence** and probably splits into two slices itself:
(1) Auto mode end-to-end (no prompting UI), (2) SAM2 subject-select +
knobs. A machine-capability check (DX12 present? VRAM?) gates the menu item
with an honest "needs a GPU for good speed" note rather than hiding it.

---

## Q7 — Project packages: export / import (`.vidtsx`), later templates

Added 2026-08-20 (Hasan's 7th item). Goal: one file that carries a whole
Studio project — for backup, machine migration, hand-off, and eventually
**selling templates**. Local-first friendly: packages are plain files sold/
shared anywhere; no marketplace backend implied (CLAUDE.md no-backend rule
holds).

### What already exists (this is mostly assembly, not invention)

- The project folder is already the unit of portability
  (`projects/<id>/{project.json, shots/, cache/}`); agent-chat.json was
  *designed* to travel with a handed-off folder (SHOT_QUALITY Q1d).
- The only non-portable piece is media: `StudioMediaAsset.path` is absolute,
  referenced in place — but `hash` + the existing relink/heal machinery
  already solve "same file, different location".
- `cache/` is re-derivable **except transcripts cost credits** — they must
  ride along. Proxies/waveforms/renders stay out (big, free to rebuild).
- Untrusted-TSX import gate exists (D14: transpile + lint + config parse +
  conform), `migrateProject` handles schema versions, `normalizeShots` +
  the Q1c reconcile absorb whatever lands in `shots/`.

### Q7a. Format — a zip container, extension `.vidtsx`

`manifest.json` (format version, app + schema version, project name,
counts, per-file sha256, total size, flags) at the root, then:

```
manifest.json
project.json            # asset paths rewritten to package-relative refs
media/<assetId>.<ext>   # the actual files (subject to Q7c policy)
shots/<shotId>/v*.tsx (+ chat.json)
transcripts/<assetId>.json
brand.json              # snapshot of referenced brand tokens (Q7f)
captions-pack/…         # only if a non-core caption pack is referenced
agent-chat.json         # OPT-IN (private conversation)
thumbnail.jpg           # project preview for pickers/marketplaces
```

Writer/reader in `src/main/services/studio/project-package.ts` (+ a pinned
zip dep — exact version per house rules). Windows file association for
`.vidtsx` via electron-builder so double-click opens an import dialog.

### Q7b. Contents policy

| Item | Default | Why |
|---|---|---|
| project.json, shots/ | always | the work |
| media files | **include** (see Q7c) | portability is the point |
| transcripts | include | cost credits to regenerate |
| cut-plans | include (tiny) | cheap insurance |
| proxies, waveforms, renders | never | re-derivable, huge |
| agent-chat.json | **opt-in checkbox** | it's a private conversation |
| brand snapshot | always (tokens only) | render fidelity on import |

### Q7c. Media strategies (export dialog, per-project choice)

1. **Full media** (default) — self-contained, can be multi-GB; the dialog
   shows per-asset sizes and a total before writing.
2. **Proxies only** — 720p stand-ins flagged `proxyOnly`; import marks the
   assets "needs full-res relink" (existing relink flow). Good for review
   hand-offs.
3. **No media (relink-by-hash)** — tiny package; import prompts to locate
   files, verified against stored hashes. Good for same-team transfers
   where media lives on shared storage.

### Q7d. Import flow

Extract to a temp dir → validate manifest + hashes → refuse newer
`schemaVersion` with a clear message, else `migrateProject` → **new project
id** (never collide) → media lands in `<project>/media/` (project-local, so
the imported project is self-contained; absolute paths written into
project.json as today) → **re-run the D14 gate on every shot** (don't trust
the exporter's machine) — pass = ready, conformable = "Convert for Studio"
card, fail = error card → brand handling per Q7f → open the project.
Reuses: `importShot`'s gate internals, `shot-reconcile`, relink.

### Q7e. Security (packages are untrusted input — template marketplace!)

- **Zip-slip**: every entry path canonicalized + must resolve inside the
  extraction root (the `safeResolveCachePath` discipline, applied at the
  package boundary).
- Manifest limits: max entry count / per-file / total size caps; reject
  nested packages; ignore any file not in the manifest.
- TSX is code that runs in the Player: the gate's allowlist already blocks
  arbitrary imports, and the renderer is sandboxed with no Node access —
  but the gate re-run on import (Q7d) is mandatory, not an optimization.
- `project.json` from the package is data, never trusted for paths: all
  path-bearing fields are rewritten, never passed through.

### Q7f. External references: brand, caption packs, kit

- **Brand**: `settings.brandId` points at a machine-local brand. Export
  writes `brand.json` (palette/fonts/styleNotes snapshot). Import offers:
  match to an existing brand / create a brand from the snapshot / keep
  snapshot as project-local tokens. Sellers ship brand-scrubbed tokens.
- **Caption pack**: core pack ids always resolve; a referenced user pack is
  embedded (pack folder shape) and installed on import with the existing
  namespaced-id + corrupt-pack-degrade rules.
- **Kit**: once shots import from `@vidtsx/kit`, the manifest must record
  `kitVersion` and the package embeds the kit copy so imported projects
  render identically even if the installed kit is newer. **Dependency
  RESOLVED 2026-08-21**: the kit slice shipped with folder-as-truth
  pinning (`shot-kit-pin.ts` snapshots `<project>/kit/<ver>/` on first
  kit-importing save) — the package simply includes the project's `kit/`
  folder and the import side verifies/installs it; no new pinning
  mechanism needed.

### Q7g. Templates — a flavor, not a fork (v2 of this feature)

A template is a package with `manifest.kind: 'template'` plus: placeholder
media (assets flagged `replaceable` with role labels — "your A-roll here" —
import walks the user through swapping them via the relink flow), a
`readme`/license field for sellers, and brand-tokenized shots. First ship
transfer (backup/hand-off); the template flavor rides the same format later
— design the manifest with `kind` + `replaceable` from day one so v1
packages stay forward-compatible.

---

## Q8 — The pack system: pluggable transitions, effects, and every future
## content kind (captions-style, ecosystem-ready)

Added 2026-08-20 (Hasan's 8th item). Goal: transitions, video effects, and
future content kinds are **packs** like captions — core ones ship in-app,
more come from Hasan's website (paid or free), and anyone can author and
share them. This section is deliberately architectural: it decides the
container and contracts NOW so Q6 (matte knobs), Q7 (packages embed packs),
and the SHOT_QUALITY kit slice all land compatible instead of needing
rework.

### The unifying insight

Every pluggable kind is the same thing: **a TSX component with a typed
runtime-props contract + manifest metadata**, validated by the D14-style
gate, served by the module server, pinned at export. Caption templates
already are this. Transitions and effects become this. The kit is this.
One pack container, many kinds.

### Q8a. Container — one format, `pack.json` at the root

```
pack.json     # formatVersion, id (namespace), name, version (semver),
              # author, license, minAppVersion, kinds present
transitions/<id>.tsx
effects/<id>.tsx
captions/<id>.tsx
sfx/<id>.(wav|mp3)          # asset kinds ride the same container
thumbnails/<item-id>.jpg    # gallery previews
README.md                   # seller/author notes
```

Item metadata (display name, param schema, thumbnail ref, default duration)
lives per item **in pack.json**, not parsed out of the TSX — manifests are
data, code is code. Distribution form: a zip (`.vidtsxpack`) or bare
folder; install = validate + copy into `userData/packs/<packId>/`.
Namespaced ids everywhere: `core/crossfade`, `hasan-pro/glitch-wipe`.
Core content ships at `resources/packs/core/` (extraResources — the
captions + exemplars precedent; caption templates migrate into this layout
whenever convenient, their scan already matches).

### Q8b. Transitions become pluggable

- **Schema**: `StudioClipTransition.kind: string` (namespaced id) +
  `params?: Record<string, number|string|boolean>`. Existing docs migrate
  `'crossfade'` → `'core/crossfade'`, `'dip-to-black'` →
  `'core/dip-to-black'` in `migrateProject` (schema v2, trivial).
- **Contract** (modeled on `@remotion/transitions` presentations, which we
  already pin at 4.0.435 — core transitions can simply wrap them):

  ```ts
  interface TransitionProps {
    progress: number;            // 0→1 across the overlap
    exiting: React.ReactNode;    // clip A
    entering: React.ReactNode;   // clip B
    params: Record<string, ParamValue>;
    width: number; height: number; fps: number;
  }
  ```

- The serializer's geometry (`computeAdjustment`, handle clamping) and the
  **equal-power audio curve stay engine-side** — packs own visuals only.
  `TimelineComposition` gains one `TransitionRenderer` that mounts the
  resolved component with computed progress.
- Core pack v1: crossfade, dip-to-black (migrated), plus wipe, slide,
  zoom/push, flip — thin wrappers over `@remotion/transitions`.

### Q8c. Effects — new per-clip field, params-driven UI

- **Schema**: `StudioClip.effects?: Array<{ id: string;
  params?: Record<string, ParamValue>; disabled?: boolean }>` — ordered,
  stackable. Neutral-default normalization per the `ClipPatch` rule (empty
  array = key deleted).
- **Contract**: a wrapper component —

  ```ts
  interface EffectProps {
    children: React.ReactNode;     // the clip's rendered output
    time: number;                  // seconds into the clip
    duration: number;              // clip duration
    params: Record<string, ParamValue>;
    width: number; height: number; fps: number;
  }
  ```

  `ClipRenderer` folds the stack: `effects.reduceRight(wrap, media)`.
- **Param schema in the manifest drives the Inspector automatically**:

  ```ts
  interface ParamSpec {
    key: string; label: string;
    type: 'number' | 'color' | 'select' | 'boolean';
    default: ParamValue;
    min?: number; max?: number; step?: number;
    options?: Array<{ value: string; label: string }>;
  }
  ```

  One generic `EffectControls` component renders any pack's knobs —
  authors never write UI. Live tweak uses the `overrideClipTransform`
  ephemeral-preview pattern; commit = one `update-clip` undo step.
- **"TSX" is the plug, not the effect** (clarified with Hasan 2026-08-20 —
  the target is CapCut-class effects). Everything on screen is drawn by
  Remotion in Chrome, so a component is simply how an effect enters the
  pipeline; inside it, four pixel tiers are available:
  1. **CSS filters** — basic grades (brightness/contrast/saturation/sepia/
     hue washes).
  2. **SVG filters** — the workhorse: feTurbulence (noise, wave warp),
     feDisplacementMap (distortion, approx lens warp), feColorMatrix +
     feOffset (RGB split / chromatic aberration), convolutions. VHS =
     noise + scanline gradient + chroma shift + per-frame jitter.
  3. **Blend-mode asset overlays** — light leaks, film grain, dust, bokeh,
     sparkles as pack-bundled footage/textures with screen/overlay blends
     (this is how CapCut itself implements many "effects"; the container
     carries assets beside components).
  4. **WebGL shaders** — true LUTs, kaleidoscope, fisheye, halftone,
     pixelate, heavy glitch. three.js / react-three-fiber / @remotion/three
     are **already vendored** in `resources/vendor/` for the shot runtime,
     so the path exists; what needs proving is **export parity** in
     headless Chrome with the render service's gpuBackend options — a
     verification spike, not new architecture.
  Plus the motion tier Remotion is built for: shake/zoom-pulse/whip-pan
  keyed to frames — deterministic (pure function of frame number), so
  effects are flicker-free by construction and beat-syncable to markers.
- **Slicing**: E2 ships tiers 1–3 + motion (no parity risk); a **WebGL
  parity spike** (render one shader effect via Player and via export,
  diff frames) gates tier 4 as E2b. Preview perf: heavy filter stacks may
  drop Player fps — acceptable (export is frame-exact regardless); a
  "disable effects in preview" toggle is the cheap escape hatch.
- Heavy precomputed/ML work (the Q6 matte) is explicitly NOT an effect —
  effects are pure render-time functions; matte stays a media job. The two
  compose: matted clip + effects stack works.

### Q8d. Trust, degrade, and the gate

- Install runs the **D14 gate per item** (transpile + react/remotion-
  allowlist lint); items fail individually — one broken transition never
  kills a pack (corrupt-pack-degrade, reaffirmed).
- **Missing/uninstalled pack degrade**: a timeline referencing an unknown
  transition renders `core/crossfade` with a warning badge; an unknown
  effect renders pass-through with a badge. The id **stays in the
  document** — reinstalling the pack restores fidelity. Never crash, never
  strip.
- Zip-slip + size caps at install (same code as Q7e).
- Signing/marketplace verification: v2. The gate + renderer sandbox is the
  real defense; a signature only adds provenance.

### Q8e. Delivery to the renderer + export pinning

- Module server serves installed pack items as content-hash module URLs
  (exactly how shots load today); the kit slice's import-map work (`@vidtsx/
  kit`) is the door pack components could later use to import shared
  primitives — not v1.
- **Export**: the entry copy step copies every referenced pack item (+ its
  pack version) beside the shot copies — the kit pinning scheme, reused
  verbatim. Old projects re-render identically after pack updates.
- **Q7 packages**: the manifest's embedded-pack section (already reserved
  for caption packs) generalizes to "all referenced pack items" — a sold
  template carries its transitions and effects. License field per pack lets
  sellers control whether their pack may be re-embedded (a flag the export
  dialog respects).

### Q8f. Distribution & authoring ecosystem (no backend, per CLAUDE.md)

- **In-app**: "Install pack" (file picker + drag-drop of `.vidtsxpack`),
  pack manager list (installed packs, versions, uninstall, what each
  provides), gallery pickers for transitions/effects fed by the registry
  with thumbnails.
- **Website**: packs are plain files — sell/host them anywhere, zero
  backend in the app. Later, an optional curated **pack gallery feed**
  (same mechanism as the existing update/announcement feeds, which are
  already allowed outbound) can show "available from learnwithhasan"
  inside the app, linking to the browser for purchase/download. Feed =
  metadata only; the app never transacts.
- **Authors**: publish `docs/PACK_SPEC.md` + a starter-pack template repo
  once the format freezes. The install gate doubles as the author's
  validator — instant feedback on import. An in-app "New pack" scaffold is
  ledgered v2.

### Q8h. ML-assisted effects: analysis tracks (the Q6↔Q8 bridge)

Added after Hasan's examples (funny-face fisheye, beautify, LUTs, backlit,
chroma key, relighting — 2026-08-20). They split three ways:

1. **Pure render-time** — LUT grades (WebGL 3D-LUT texture from pack-asset
   `.cube` files), **chroma key** (YUV-distance shader + spill/choke/feather
   — ships as a CORE effect; also the cheap path for real green-screen
   footage), fixed-position warps. No ML; all high-confidence.
2. **Render-time + precomputed analysis track.** Face-tracked warps
   (funny-face), beautify (MediaPipe Face Mesh landmarks — Apache 2.0,
   tiny, CPU-real-time — + skin-masked smoothing shader + landmark warps),
   matte-driven compositing (backlit/rim glow, outline, background blur).
   **Design change this forces**: Q6's engine is not a "matte engine" but a
   **vision analysis engine** with two artifact shapes, both cached per
   asset-span like the matte: *alpha videos* and *data tracks* (keyframed
   JSON, e.g. face center/size/landmarks). Effect manifests gain
   `requires?: Array<'matte' | 'faceTrack'>`; applying such an effect
   auto-queues the analysis job (media-jobs precedent), and the resolved
   track arrives via the effect's props. Preview shows a "analyzing…"
   badge until the track is ready; missing-track degrade = effect inactive
   + badge, id preserved (the Q8d rule).
3. **True heavy ML** — neural relighting (IC-Light-class), GAN beautify:
   offline diffusion-tier jobs; ledgered (V2_FEATURES) — NOT promised. A
   *lighting-look* effect (directional gradient/rim masked by matte +
   face position) covers most practical relighting asks and belongs to
   category 2.

Honest ceilings, recorded so marketing copy stays truthful: beautify tops
out at "good CapCut-grade" (landmark + shader), not GAN retouching;
relighting v1 is a look, not a light source you can move.

### Q8g. Sequencing & scope honesty

Foundation first, kinds incrementally:
- **E1 — registry + transitions**: pack registry service (scan, validate,
  degrade), `kind` widening + migration, TransitionRenderer, core
  transition pack, picker UI. Moderate.
- **E2 — effects**: `effects[]` field, EffectProps contract, param-driven
  Inspector, core effect pack (5–8 CSS-tier effects), ephemeral preview.
  The larger half.
- **E3 — ecosystem polish**: install UX, pack manager, PACK_SPEC.md +
  starter repo, Q7 embedding, export pinning (with/after the kit slice).

Decisions Q6/Q7 must respect **now** even though E-slices come later:
matte is not an effect (Q6d unchanged); the Q7 manifest reserves a
`packs/` section; the kit slice's pinning scheme is written to be reused
by pack items (one pinning mechanism, not two).

---

## Q9 — Capability ledger for V2+ (brainstorm triage, 2026-08-20)

From Hasan's wide brainstorm (CapCut gallery screenshot + 13-item list).
**Positioning statement (Hasan, verbatim intent)**: not cloning editors —
"the best and easiest AI-powered experience, with code available and
almost free, with optional connection to whatever APIs and providers users
want." Two structural consequences:

- **The agent is the catalog.** Because every visual element is code, the
  agent can AUTHOR bespoke effects/transitions/annotations on request
  ("a transition where the screen shatters"), validated by the D14 gate,
  saved as a user-pack item. Catalog + generator, not catalog alone. This
  is the moat; it should shape which primitives we build (contracts and
  gates over giant built-in libraries).
- **Every heavy capability gets a local-free tier and an optional API
  tier** where both exist (audio cleanup: DeepFilterNet vs ElevenLabs
  isolator; avatars: none-local vs fal).

Triage table — "rides on" names the machinery from Q6/Q8/earlier:

| Capability | Rides on | Effort | Verdict |
|---|---|---|---|
| Advanced transitions (shader, 3D) | Q8b tier 4 | low+ | E-slices; **add luma-matte wipes to the transition contract** (grayscale ramp video drives the wipe — a whole pack economy by itself) |
| CapCut-gallery effects (particles, TV-on, splits, spotlight) | Q8c tiers 2–4 + particles | med | E2/E2b core+packs; particles are deterministic in Remotion |
| Audio-reactive effects (Music Frequency) | **`audioEnvelope` analysis track — the rmsDb waveform cache ALREADY EXISTS** | low | third track type beside matte/faceTrack; near-free win |
| Filters | Q8 preset stacks | low | naming layer over effects |
| Color adjust + curves + wheels + grading | Q8c tier 1/4; curve UI → per-channel LUT shader | med | core "Adjust" effect + curves editor; ceiling + mitigations detailed in **Q9b** below |
| Shapes | `@remotion/shapes` (pinned, allowlisted) | low | built-in annotation-pack items |
| Camtasia annotations (arrow start→end, callouts, spotlight-zoom) | new pack kind `annotations` + canvas editing + **keyframes** | med | high fit for screencast audience; needs K below |
| **Keyframes (K)** — params animatable over time | NEW PRIMITIVE: `clip.keyframes` (param path → {t, value, ease}[]) spanning transform + effect params + masks | med-high | **design once, early V2, before deep effect UI**; unlocks arrows, Ken Burns, animated masks, automation; AI angle: agent writes keyframes from a description |
| Masking (static shapes) | SVG clip-path effect + K | low-med | easy |
| Masking (tracked, follows object) | Q6 vision engine — SAM2 tracking is already there for matting | low marginal | second consumer of the same engine |
| Audio noise removal / enhance | new media-transform job (cleaned-audio cache, clip toggles source) | med | local: DeepFilterNet (MIT/Apache, ONNX); API: **ElevenLabs voice isolator on the Q3 key** — flagship local-free/API-better pairing |
| Lip sync | fal queue client (exists) hosting lipsync models | low-med (API) | API-first; local lip sync license-messy (Wav2Lip non-comm etc.) — ledgered pending research |
| AI avatar from image + built-in avatars | script → ElevenLabs TTS (Q3) → fal lipsync/portrait-animation → clip | med | **V2 flagship**: three planned integrations composing; built-in = shipped licensed avatar images on same pipeline |
| Neural relighting, GAN beautify, HDR color | — | — | ledgered (Q8h cat. 3), not promised |

### Q9b. The color ceiling, precisely (discussed with Hasan 2026-08-20)

**What "8-bit sRGB browser pipeline" means mechanically.** Remotion
renders every frame by rasterizing a Chrome page; the captured frame is
8-bit-per-channel sRGB. That is a *structural* property of the renderer,
not a codec setting: even exporting ProRes 4444 (10-bit container) carries
8-bit-precision pixels, because the source raster is 8-bit. Consequences:
no HDR deliverables (PQ/HLG), no true 10-bit grading latitude, and
banding risk when heavy grades stretch smooth gradients (skies).

**What this does NOT block — and the mitigations that matter:**

1. **Log footage is fully supportable.** Hasan's DJI clips ship D-Log;
   "log looks washed out" is solved by an **input conversion LUT**
   (log→Rec.709) — the Q8 LUT effect covers it, and vendor technical LUTs
   (DJI, Sony S-Log, etc.) are freely distributed. A "Footage looks flat?
   Apply camera LUT" affordance (auto-suggest by probing clip metadata for
   known log color spaces via ffprobe) turns the ceiling into a feature:
   drone/mirrorless users get correct color in one click. The nuance to be
   honest about: converting 10-bit log through an 8-bit pipeline loses the
   extra grading latitude the shooter paid for — the *look* is right, the
   *push-it-3-stops-later* headroom is not.
2. **Single-pass composition rule (bake into the Q8c core effects).**
   Inside one WebGL shader, math is float — precision loss happens only at
   raster boundaries. So the core color ops (adjust, curves, wheels, LUT)
   must compose into ONE shader stack per clip, not nested DOM filter
   layers, so the image is quantized to 8-bit once, not per-op. This is a
   contract-level decision: color-kind effects declare themselves
   composable and the effect folder merges them.
3. **Dithering** in the final shader pass hides banding in stretched
   gradients — cheap, standard, worth shipping on by default.
4. **Wide-gamut display path** (canvas `display-p3` is supported by
   Chrome) is a possible later nicety for preview fidelity on P3 screens —
   only if export parity holds; ledgered, not planned.

**Why the ceiling is acceptable for the positioning**: the audience ships
SDR 8-bit H.264/VP9 to YouTube/social — identical to what CapCut,
Descript, and Premiere's default exports deliver. HDR grading is DaVinci's
market, explicitly not ours ("not cloning editors"). Marketing copy may
say: full grading toolset + camera-log LUT support + SDR delivery; it may
NOT say: 10-bit/HDR pipeline.

Sequencing note: K (keyframes) is the only item that should influence
near-term design — reserve the `keyframes` field shape when Q8c's
`effects[]` lands so params are animatable later without a second schema
migration. Everything else in this table is additive on the Q6/Q8 rails.

---

## Q10 — Studio auto-save: mostly ALREADY EXISTS; the real gaps are
## quit-flush and version history

Added 2026-08-20 (Hasan's request). Verified in code first:

**What exists today** (`useStudioProject.ts` + `project-store.ts`):
every `updateProject` schedules a save debounced at 600 ms; writes are
atomic (temp file + rename, so a crash mid-write can never corrupt
project.json); pending edits flush when the editor unmounts. Studio has
been auto-saving since day one — the E2E OOM crash recovered cleanly
because of it.

**Real gaps, smallest-first:**

1. **Quit-flush hardening (build, trivial).** The unmount flush relies on
   React cleanup running; an app quit or window close can skip it, losing
   up to ~600 ms of edits plus any in-flight save. Add a `beforeunload`
   flush in the hook and a main-side `before-quit` guard that gives the
   renderer a beat to flush. Also flush on window blur (free insurance;
   the focus/blur seam already exists for rescans).
2. **Version history / snapshots (build — this is the user-facing "auto
   save" feature).** Autosave means a bad edit becomes permanent the
   moment undo dies with the session. Rotating snapshots fix that:
   - **Where**: `<project>/snapshots/project.<ISO-ts>.json` — beside
     project.json, NOT under `cache/` (Clear Cache must never eat
     history; the agent-chat rotation precedent).
   - **When**: on project open (pre-edit safety copy) + every 10 min of
     *active editing* (dirty-since-last-snapshot check, no timer churn
     when idle).
   - **Retention**: keep last 20 + thin older ones (keep one per day) —
     project.json is small (KBs; media/shots live outside it), so cost is
     negligible.
   - **UI**: "Restore version…" in the project menu — list by timestamp,
     restore = current doc snapshotted first, then swapped (restore is
     itself undoable-by-restore, never destructive).
3. **Persisting undo history across sessions — rejected.** 100
   whole-document snapshots ×
   write-per-edit is heavy machinery for what snapshots already cover;
   ledgered only if users ask.

Scope: small (1 is minutes; 2 is a focused slice). Genuinely V1-worthy —
it hardens the exact crash story the live test already hit. No conflicts:
snapshots are outside cache/, invisible to media jobs, and the Q7 package
export **excludes** `snapshots/` (history is personal, like agent-chat —
but not even opt-in; it never ships).

---

## Q11 — Ledger: headless CLI + local API (Ollama-style) — V-later, three
## disciplines locked now

Feasible with the current architecture: services are renderer-blind, so a
CLI (`vidtsx render …`) and a loopback HTTP API (OpenAI-compatible
endpoints over the LOCAL engines) are additional adapters beside the IPC
handlers. Locked-in disciplines (cheap now, expensive to retrofit):

1. **Seam rule reaffirmed**: no dialogs/BrowserWindow/webContents inside
   services — handlers own UI. (Existing house rule; enforce in review.)
2. **The CLI is the app binary headless, never a separate Node script** —
   native modules (better-sqlite3, node-llama-cpp, onnxruntime) are
   Electron-ABI; plain `node` cannot load them (proven: render.db
   unreadable from `node -e`).
3. **API posture pre-decided**: loopback-only, off by default, token-
   authed, **local models only — never proxies BYOK cloud providers**
   (other processes must not be able to spend the user's API money). A
   loopback server is not a "backend" per CLAUDE.md, but it is opt-in
   attack surface.

Everything else is additive later; no schema or service changes needed.

## Q12 — Ledger: whiteboard animation studio — V-later, no blockers

VideoScribe/Doodly-class whiteboard animation is a near-ideal Remotion
workload: SVG stroke reveal (dash-offset) + hand following the path tip
(pure-JS point-along-path, deterministic per frame) + fill fade — all
frame-pure functions. "Free unlimited" holds structurally: rendering is
local. Content sources: line-art SVG packs (Q8 container: art + hand
packs), AI line-art images vectorized locally (**vtracer, MIT** — sd-cli
runner pattern; honest limit: photos don't vectorize into good line art,
purpose-styled line art does), the agent writing SVG directly, and font
glyph paths for handwriting. Integration is free by prior decisions: a
whiteboard scene IS a shot (folder-of-v*.tsx), primitives ship as a
`<Whiteboard>/<DrawPath>/<Hand>` kit pack via the Q4 import-map, and the
AI flagship (topic → script → scenes → ElevenLabs voiceover → captions)
composes planned integrations. Nothing to build or reserve now — only:
keep drawing primitives in mind as a future kit pack; bake no whiteboard
assumptions anywhere.

---

## Q13 — Content Safety: built-in moderation as a product angle (V1)

> **GRILLED 2026-08-21 into its own doc: `docs/CONTENT_SAFETY_DESIGN.md`**
> — that doc supersedes the sketch below (classifier research, threat
> model, threshold bands, eval plan, and its own checklist). Headline
> decisions there: pixels-not-prompts as the authoritative gate
> (Marqo nsfw-image-detection-384, Apache-2.0, ~11 MB ONNX, bundled;
> optional MIT ensemble, eval-gated); **zero moderation hooks on LLM
> surfaces** (structural, not tuned); fail-closed; input-reference
> scanning; 2 fps video sampling; generated-content-only scope (never
> user imports).

Added 2026-08-21 (Hasan: "Ethical" as an advertised differentiator —
prevent generation of nudity/porn/etc. across all models, now and future).

### What exists (verified in code): an engine with zero enforcement

`src/moderation-engine/` — 4,571 terms / 18 languages (LDNOOBW CC-BY,
profanity.csv MIT, Google list), leetspeak normalization
(`text-normalizer.ts`), word-boundary matching (no "assess"/"therapist"
false positives), categories `sexual|nudity|pornography|profanity` ×
severity. Its ONLY consumer today is the Tools tester screen. The V1
feature = enforcement + output check + policy UX.

### Q13a. Hook placement: ENGINE-level, not handler-level

Deliberate contrast with usage logging (which hooks handlers): moderation
wraps `imageEngine.generate/generateWith`, `llmEngine.generate/
streamGenerate`, the fal video service, and (structurally) anything
registered later — so agent tools (`generateImageAsset`), Flows, and every
FUTURE provider/caller are born covered. A typed `ModerationBlockedError
{categories}` propagates to handlers → friendly renderer message. One
`moderationService.checkPrompt(text, surface)` facade in main.

### Q13b. Policy matrix (the curation pass is the real work)

- **Block for generation**: sexual / nudity / pornography intent.
  **Profanity alone must NOT block** — creators legitimately script
  swearing; blocking "damn" in a caption would make the feature hated.
- **Word-list curation required**: today many sexual terms are tagged
  `profanity` (e.g. "0ral sex"), so category-blocking would both miss and
  over-block. Slice includes an LLM-assisted re-tag pass (reviewed by
  Hasan) producing a curated **generation blocklist** distinct from the
  full tester list. Minors+sexual combination terms: hard block, highest
  priority in curation.
- **Per-surface application**: image/video prompts → block on match.
  LLM: a policy clause injected into our system prompts (all LLM calls
  already flow through prompt builders) + the same prompt check on
  generation-shaped features (tsx/image/flows); plain chat blocks only on
  unambiguous sexual-content *requests*, not mentions — an editor
  discussing sensitive footage must not be blocked.
- **Always-on. No setting, no off switch** — that IS the advertised angle.

### Q13c. Output-side image check (the layer word lists can't provide)

A local NSFW image classifier on every generated image before it reaches
the renderer — decisive for **local SD**, which has no provider-side
safety, and for benign-prompt/NSFW-output cases. Open-source ONNX
classifiers are ~20 MB (e.g. GantMan/nsfw_model lineage, MIT);
onnxruntime-node is already a dependency (embedding worker pattern).
Flagged output → blocked with category message, never previewed.
*(Open: bundle the ~20 MB model as a deliberate exception to the
no-bundled-models rule — safety must not be absent-until-downloaded — or
download on first generation with word-lists-only until then.
Recommendation: bundle; the rule was about whisper/ffmpeg-scale size.)*
Video: prompt-side only in V1 (frame-sampling the classifier over
generated video is a fast follow).

### Q13d. Honest advertising (the repo is public)

The claim is "**built-in content safeguards, always on, cannot be
disabled in the app**" — a stance about what the product refuses to be an
instrument for by default. It is NOT "impossible to misuse": the code is
open source and a fork can strip it; word lists have false negatives
(novel phrasing, languages beyond 18) and the classifier has error rates.
Marketing copy and the in-app **Content Safety page** (About/Settings —
the advertisable surface, describing policy + categories) must match this
truth. Blocked-request count surfaces on the usage dashboard (local
only — no telemetry, consistent with local-first).

### Q13e. UX of a block

Immediate typed error → "Blocked by Content Safety: <category>" with a
link to the policy page. No partial generation, no provider call made
(prompt-side) / no image shown (output-side). False-positive escape
valve: the message names the matched category (not the term) and the
policy page explains phrasing adjustments; a "report a false positive"
mailto/link is the only feedback channel (no telemetry).

Sequencing: lands as its own slice BEFORE the Gemini provider so new
providers are born covered (engine-level hooks make this automatic
anyway; the ordering is belt-and-suspenders + lets 1.0.x advertise it
early). Size M (the curation pass and classifier integration dominate;
the hooks themselves are small).

---

## Q14 — Preview/render engine: stay, hybrid, dual, or replace?

> **RESEARCHED 2026-08-26 into its own doc: `docs/PREVIEW_ARCHITECTURE.md`**
> — Hasan's ask: weigh our Remotion approach against CapCut, Premiere Pro
> and Camtasia and recommend a course. That doc carries the competitor
> research (live-source, with inferred items marked), the four options
> with a named recommendation each, the WebCodecs evaluation, the sized
> near-term wins, and its own inline-answerable checklist. **Nothing there
> is decided until Hasan marks it.**
>
> Headline findings, so this tracker is readable without opening it:
> **nobody ships a pixel-accurate preview** — CapCut, Adobe and TechSmith
> each document the fidelity trade in their own help pages; our
> one-renderer-two-hosts WYSIWYG is the property none of them have, and
> its whole price is `<video>` seek-per-frame. The hybrid *compositor* is
> confirmed a trap (the only provably bounded fast path is the identity
> transform — which is exactly Adobe's smart-render predicate, and exactly
> the still-unbuilt PLAN §5 S3+ export optimisation). The dual renderer is
> what Premiere already built for user-authored comps (MOGRT → AELib), and
> MOGRTs are its documented slow path — our TSX shots would be the same,
> except they are the product. Recommended course: **"one renderer, better
> decoders"** — keep the compositor, replace the decoder under it with
> `@remotion/media` (Mediabunny + WebCodecs), which is **on our exact
> 4.0.435 train** (verified on npm), works in the Player *and* in
> `renderMedia`, and is documented as frame-perfect. `@remotion/webcodecs`
> and `@remotion/media-parser` — the two packages already sitting unused
> in our tree — are **discontinued in the unreleased v5.0**, so they are
> not the route.
>
> Binding on other slices *now*, even though the build comes later:
> **E1 (Q8b transitions) doubles live decoders through every overlap**, so
> the S0 spike belongs before or with E1 and P2 must not land *during* it
> (same file); **E2b's WebGL texture hook** differs between
> `useOffthreadVideoTexture()` and `@remotion/media`'s
> `onVideoFrame`/`effects` — confirm in S0 so E2b isn't authored twice
> *(answered 2026-09-17: at the 4.0.435 pin both tags share
> `onVideoFrame(frame: CanvasImageSource)` and there is no `effects` prop, so
> a hook written against `onVideoFrame` is authored once; S0 itself ran as T2
> — see the status pointer atop `PREVIEW_ARCHITECTURE.md`)*;
> **Q9b is unchanged** — the 8-bit sRGB ceiling is a Chromium-raster
> property, not a decoder one.

---

## §7 — Interference map with SHOT_QUALITY_DESIGN.md

| SHOT_QUALITY item | Touchpoint | Verdict |
|---|---|---|
| Slice 2 (Layer A: exemplars/briefs/craft) | prompt text only | no overlap |
| Slice 3 (kit, module-server import map) | `module-server.ts` also serves `/asset` used by preview + matte preview | additive routes, low risk; coordinate if both land same week |
| `generate_image` agent tool | routes through `imageEngine` | **synergy**: subscription providers make shot assets free (Q1d) |
| Style memory (Q6a–c there) | none of these files | no overlap |
| MotionScreen parallel-session edits | dirty working tree (no-stash rule) | providers wave touches none of those files; text-editing touches EditorShell/Inspector — check buffer state before starting Q5 |
| Capacity | both tracks are Studio-heavy | sequence: SHOT_QUALITY slices 2–3 vs Q5/Q6 here is a scheduling choice for Hasan |

Also: `VITE_FF_*` gating — Q5 and Q6 ship behind flags (`studio-text-edit`,
`studio-matte`) as dev-preview (`false` in `FEATURE_FLAGS`) until proven.

---

## Sequencing (proposed waves — after 1.0.1 ships)

1. **Wave P1 — plain providers** (small, independent, checklist-driven):
   ElevenLabs STT (Q3) + Cloudflare images (Q2) + usage-tracking fix (Q4).
   Each is a day-scale slice; all three land without touching Studio.
2. **Wave P2 — Gemini/agy subscription provider** (Q1): CLI-provider
   plumbing built two-wide, Gemini only ships. *(MiniMax/mmx: DEFERRED —
   Hasan, 2026-08-20.)*
3. **Wave S1 — text-based editing slice 1** (Q5a): transcript panel,
   click-to-seek, select-to-delete with envelope snapping, show-deletions +
   restore, filler highlight.
4. ~~Wave S2/S3 — background removal~~ **DEFERRED out of V1** (Hasan,
   2026-08-20); design stands as plan-of-record.
5. **Wave S4 — project packages** (Q7): transfer first; the template flavor
   after. Hard dependency: lands after the SHOT_QUALITY kit slice defines
   its version-pinning scheme (Q7f) — or before the kit exists at all
   (either order avoids the incompatibility; "during" does not).
6. **Waves E1–E3 — pack system** (Q8): E1 (transitions) is independent and
   can interleave anywhere; E2 (effects) after E1; E3 (ecosystem polish +
   export pinning + Q7 embedding) after the kit slice, sharing its pinning
   mechanism. Q8's *decisions* bind earlier waves (matte ≠ effect; Q7
   manifest reserves `packs/`) even though its build comes later.

SHOT_QUALITY slices 2–4 interleave wherever Hasan wants; no hard ordering
constraint exists between the two tracks.

## Checklist (answerable inline)

1. **Q0**: agree these land post-1.0.1 (repo flip + testing pass first),
   even though we brand them V1 features? [recommend: yes]
2. **Q1**: ~~one slice for both CLI providers?~~ **DECIDED (Hasan,
   2026-08-20): Gemini only in V1; MiniMax deferred.**
3. **Q2**: Cloudflare account id as a plain (unencrypted) settings field
   beside the encrypted token? [recommend: yes]
4. **Q3**: hold `verbatimDisfluencies` off for Scribe v2 until tested on
   Raw Footage Test audio (AssemblyAI stays the auto-cut recommendation)?
   [recommend: yes]
5. **Q4**: chart gains Tokens|Requests|Cost toggle (vs a separate cost
   card)? [recommend: toggle]
6. **Q5**: direct-apply text deletes (undo, no proposal gate)?
   [recommend: yes] · Panel beside the preview, not in the Inspector?
   [recommend: yes]
7. **Q6**: **DEFERRED out of V1 (Hasan, 2026-08-20).** The stack/span/
   slicing questions stay open for when it's scheduled; the vision-engine
   naming (Q8h) binds now regardless.
8. **Flags**: `studio-text-edit`, `studio-matte` as dev-preview flags?
   [recommend: yes]
9. **Q8**: one pack container for all kinds (transitions/effects/captions/
   sfx), namespaced ids, manifest-declared params? [recommend: yes] ·
   `StudioClipTransition.kind` widens to a string with schema-v2 migration?
   [recommend: yes] · E2 ships effect tiers 1–3 + motion, with a WebGL
   export-parity spike gating tier 4 (E2b)? [recommend: yes — three.js is
   already vendored, so the spike is cheap] · Missing-pack degrade keeps ids in the
   document (crossfade/pass-through + badge)? [recommend: yes] · Pack
   gallery via the announcement-feed mechanism, purchases in the browser?
   [recommend: yes] · E-slice order E1→E2→E3 with E3 after the kit slice?
   [recommend: yes] · Q8h: Q6 built as a general vision-analysis engine
   (mattes + face tracks) with effects declaring `requires`, chroma key as
   a core effect, true neural relighting ledgered not promised?
   [recommend: yes]
10. **Q10**: quit-flush hardening + rotating snapshots (open + 10-min,
    keep 20 + daily thinning) with "Restore version…" — into V1?
    [recommend: yes — small, hardens the proven crash story] · Persisted
    undo rejected in favor of snapshots? [recommend: yes]
11. **Q9b**: single-pass color composition + default dithering as
    contract-level rules when core color effects land, camera-log LUT
    auto-suggest as the flagship color affordance, HDR explicitly out of
    scope in marketing copy? [recommend: yes to all]
12. **Q11**: lock the three CLI/API disciplines now (seam rule in review,
    CLI-is-the-app-binary, loopback/local-only API posture)?
    [recommend: yes — zero build cost today]
13. **Q13**: block categories = sexual/nudity/pornography intent, profanity
    alone never blocks generation? [recommend: yes] · Bundle the ~20 MB
    NSFW classifier as a deliberate exception to the no-bundled-models
    rule (vs download-on-first-gen)? [recommend: bundle] · Always-on with
    no setting, Content Safety page as the advertised surface, claim
    worded per Q13d honesty rules? [recommend: yes] · LLM chat blocks only
    unambiguous sexual-content requests (mentions/discussion allowed)?
    [recommend: yes]
14. **Q7**: **DECIDED (Hasan, 2026-08-26) — all five as recommended.**
   `.vidtsx` zip format with the Q7b contents policy? **yes** ·
   agent-chat.json opt-in (default OFF)? **yes** — and the same checkbox
   governs per-shot `chat.json`, which is the same kind of private
   conversation · Three media strategies (full / proxies / relink)? **yes** ·
   Package feature sequenced relative to the kit slice (before or after,
   never during)? **after** — the manifest carries `kitVersion` from day
   one, against the SHIPPED folder-as-truth `shot-kit-pin.ts` scheme (no new
   pinning mechanism) · Template flavor deferred to a second slice, but
   `kind` + `replaceable` reserved in the manifest now? **yes** — plus
   `packs`/`packs/` reserved for Q8, and `role` beside `replaceable`.
15. **Q14**: the preview/render-engine question is answered in
    **`PREVIEW_ARCHITECTURE.md`** — its 12-item checklist is the one to
    answer (invariant · reject hybrid compositor · reject dual renderer ·
    close engine replacement · WebCodecs route = `@remotion/media` · run the
    S0 spike next · adopt in BOTH hosts if it passes · `<Audio>` stays put
    for now · reordered near-term wins S0 → W0+W2 → W4 → W3 → W1 → W5 ·
    delete the dead NVENC branch · smart-render passthrough stays ledgered ·
    claims language). Then slot the P0/S0/P1–P3 rows into the build order
    relative to slices 8–9. [recommend: P0 any time; S0 before slice 9;
    everything else gated on S0's numbers]
