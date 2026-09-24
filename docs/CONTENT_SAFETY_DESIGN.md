# Content Safety design — the always-on visual-generation gate

> Written 2026-08-21 from Hasan's directive: **"prevent porn and nudity
> fully, especially in images and videos (visual content), and make sure we
> don't affect LLM generation with falses."** Advertised product angle
> ("Ethical"). Same pattern as the other design docs: decisions with
> options, a recommendation, and an inline-answerable checklist. Research
> basis: classifier-landscape web research 2026-08-21 (UnsafeBench CCS 2025,
> model cards, jailbreak literature — sources at the end) + code audit of
> `src/moderation-engine/` (exists, 4,571 terms / 18 languages, leetspeak
> normalizer — enforced NOWHERE today; only the Tools tester calls it).
>
> Supersedes the Q13a–e sketch in `NEXT_FEATURES_DESIGN.md` (which now
> points here). V1 build-order slice 5.

## D0 — The two directives, turned into architecture

1. **Visual content: maximal prevention.** The authoritative gate is on
   **pixels, not prompts** — every generated image, every img2img
   reference input, every sampled generated-video frame passes a local
   NSFW classifier. Prompt filtering stays as a cheap first layer, never
   the security boundary. This is evidence-driven: the entire text-to-image
   jailbreak literature (SneakyPrompt, JailbreakDiffBench ICCV 2025;
   Rando et al. on the SD safety checker) attacks *prompt* filters —
   an output-pixel gate is immune to phrasing entirely.
2. **LLM: zero false positives — by giving it zero hooks.** No word-list
   gate on chat, transcripts, TSX generation, captions, or editorial
   passes. The text side gets only a policy clause in our system prompts;
   cloud providers carry their own safety. Nothing is lost: the
   engine-level hook on `imageEngine` means an image prompt *authored by
   the agent* still hits the visual gate, and whatever pixels come back
   face the classifier regardless of wording. Text false positives are
   structurally impossible, not threshold-tuned away.

**Scope boundary (both directions):** the gate covers what the app
GENERATES (and captures). It never scans the user's imported footage or
library — their content is theirs; scanning it would be surveillance, not
ethics.

## D1 — Threat model: how NSFW can actually reach a project (ranked)

| # | Leak path | Why prompt filters fail | Countermeasure |
|---|---|---|---|
| 1 | **Local SD with an arbitrary checkpoint** (sd-cli loads any `.safetensors`, incl. porn-tuned; innocent prompt → explicit output) | prompt is clean | Gate B (output pixels) |
| 2 | **Euphemistic / novel-phrasing prompts**, languages beyond the 18 | no list catches phrasing | Gate B |
| 3 | **img2img / multi-reference inputs** — NSFW source image, or an innocent photo of a real person + a sexualizing edit (the non-consensual-imagery case, ethically #1) | instruction can sound innocent | Gate B on **inputs** before any provider call + Gate B on output |
| 4 | **Generated video** (fal) | same as 2 | Gate B on sampled frames |
| 5 | **Agent-authored image prompts** (paraphrase laundering) | agent rewrites wording | engine-level hooks — agent calls the same `imageEngine` |
| 6 | Explicit prompts, leetspeak/evasion | — | Gate A catches early (saves the API call); Gate B backstops |
| 7 | `capture_webpage` of explicit sites | n/a | Gate B on the capture output |

## D2 — Gate B: the pixel classifier (the authoritative gate)

### D2a. Model choice — decided by license + AI-generated-content coverage

Research headline: **UnsafeBench (CCS 2025) measured that every classic
NSFW classifier degrades on AI-generated imagery** — photo-trained models
miss stylized/generated content, which is literally all we produce. The
selection criteria are therefore: (1) AI-generated + drawn content in
training data, (2) commercial license, (3) ONNX-able, (4) small.

**Primary: `Marqo/nsfw-image-detection-384`** — ViT-tiny @384, ~5.7M
params (≈11 MB fp16 ONNX, self-exported for supply-chain hygiene),
**Apache-2.0**, 98.56% on its 20K held-out set, and the **only
top-scoring permissive model whose card documents training on
photorealistic AI output, drawn/Rule-34 content, and memes** — exactly
the three things our pipeline emits.

**Ensemble candidate: `OwenElliott/image-safety-classifier-xs`** —
SwiftFormer-XS, 3.5M params, **MIT**, official ONNX with preprocessing
baked into the graph, 3-class (NSFW / NSFL-gore / SFW). OR-gate: block if
either flags. Different backbone, resolution, and training data → buys
recall (our stated objective) at negligible latency, plus a free gore
signal. **Ship-gate: measure the ensemble on ~500 of our own generator
outputs first; keep it only if it adds recall without wrecking the
borderline band** (no published ensemble eval exists).

**Rejected, with reasons recorded:** NudeNet v3 (AGPL-3.0 — license
virus; also weakest on UnsafeBench, F1 0.596 on AI-generated); CompVis SD
safety checker (documented bypasses, sexual-concepts-only, heavy);
AdamCodd's SD-specialist + prompt classifiers and TostAI (all
non-commercial licenses); VLM guards like LlavaGuard/SafeVision (multi-GB,
wrong footprint); GantMan 5-class (MIT but stale, 2019, no ONNX);
Falconsai/AdamCodd ViT-base (fine models, but 330 MB for less documented
generated-content coverage than Marqo's 11 MB).

### D2b. Thresholds — banded, recall-greedy, because re-rolls are cheap

A false positive on a *generated* image costs one re-roll — not lost user
work. So the bands are deliberately aggressive:

- **p(NSFW) ≥ 0.8 → hard block** ("explicit").
- **0.2 ≤ p < 0.8 → borderline → BLOCK by default** (max recall). A
  future relaxation to blur-preview-with-warning is a policy-page change,
  not an architecture change; V1 ships block.
- **p < 0.2 → pass.**

Band edges are constants tuned on our own eval set (D6), not user
settings.

### D2c. Call sites — one code path, six callers

`moderationService.checkImage(buffer)` (warm ONNX session in a
worker/utilityProcess — the embedding-worker pattern; CPU EP sufficient at
this size, DirectML optional):

1. Every `imageEngine` generation result, before it crosses to the
   renderer (engine-level wrap — covers Image Studio, agent tools, Flows,
   provider tests, all future providers).
2. Local SD results (same wrap — `LocalSdImageProvider` routes through
   `imageEngine`).
3. **Input reference images** for img2img/multi-reference, before any
   provider call (also protects users from accidentally uploading NSFW to
   cloud APIs).
4. Generated video: **2 fps samples + first/middle/last frames**
   (production norm is ~1 fps; a 5–10 s clip = ~12–22 inferences, <1 s on
   CPU). Any frame trips → whole clip blocked. 4K frames additionally
   scan a center crop at native res (downscale can shrink small explicit
   regions below detectability).
5. **Video input media**, added by the video-providers plan (Stage 2 for
   frames, Stage 3 for references) and owned by `video-engine/
   input-media-gate.ts` — one order for every caller (Videos panel, the
   Flows node, `generateVideoAsset`, the `generate_video` agent tool):
   resolve → `checkImage` on the **first frame, last frame and every
   reference image**, and the **2 fps frame sampler on every reference
   clip** → only then upload what cannot travel inline. Nothing is hosted
   or submitted before it is gated, and a reference clip with no sampler
   installed is refused rather than passed (D2d). Reference *audio* is not
   gated — there is no classifier for it, the same position STT input
   takes.
6. `capture_webpage` outputs before they land in the asset library.

**Download-then-return (video, Stage 2).** A completed cloud video job is
never handed back as a provider URL. The engine downloads the clip, files it
through the Video Studio save path — which is call site 4 — and returns the
local entry. So the output gate cannot be skipped by a caller that only
wanted the URL, and the clip survives the provider's own expiry (ModelArk's
signed URLs last 24 h).

### D2d. Fail-closed + no kill switch

- Classifier missing or inference error → **visual generation is blocked**
  with an explicit error, never silently passed. This is why the model
  ships **bundled in the installer** (≈11–15 MB fp16; a deliberate,
  documented exception to the "download models on first use" rule — that
  rule exists for whisper/ffmpeg-scale downloads, and a safety gate must
  not have an absent state).
- **No setting, no feature flag, no env var disables the gate in
  production builds.** A dev-only bypass for test fixtures, if ever
  needed, must be compiled out of release builds — not flag-gated.

## D3 — Gate A: the prompt gate (cheap first layer, visual surfaces only)

Purpose: refuse obvious requests instantly and save the API call. Never
claimed as the security boundary.

- **Applies ONLY to visual-generation prompt fields** (image prompt,
  video prompt, image-edit instruction). Never to chat, transcripts, TSX
  briefs, captions.
- **Curated generation blocklist** derived from the existing 4,571-term
  list via a re-tag pass (LLM-assisted, human-reviewed — Hasan): today
  clearly sexual terms are mis-tagged `profanity` (e.g. "0ral sex"), so
  category-based blocking would simultaneously miss targets and over-block
  swearing. Policy: **sexual/nudity/pornography intent blocks; profanity
  alone NEVER blocks** (creators legitimately script swearing).
  Minors+sexual combination terms: hard block, first priority in
  curation.
- **Normalizer hardening** (audited `text-normalizer.ts` — already
  handles leetspeak, zero-width strip, separator removal, repeat
  collapse, Latin+Arabic diacritics): add Unicode NFKC folding
  (full-width forms) and Cyrillic/Greek homoglyph mapping (е→e, а→a,
  ο→o).
- Research confirmed **no commercial-friendly local prompt-safety model
  exists** (the good ones — AdamCodd DistilRoBERTa, TostAI — are all
  NC-licensed), and the accepted practice is exactly this pairing:
  keyword pre-filter + authoritative output classifier.

## D4 — LLM surface: the do-nothing-by-design contract

- **No moderation hook on `llmEngine` / local LLM engine. None.** This is
  a recorded design decision, not an omission — revisit only with
  evidence of real abuse that Gate B doesn't already stop.
- One policy clause in our system prompts (shot generation, agent,
  flows): the app does not produce sexual content; decline and state why.
- The agent's `generate_image` tool needs no special casing — its output
  route already passes both gates at the engine level.

## D5 — UX and the advertised surface

- Block → typed `ModerationBlockedError { gate: 'prompt'|'image', category }`
  → renderer shows "Blocked by Content Safety — sexual/explicit content"
  with a link to the **Content Safety page** (About/Settings): the
  advertisable surface describing the policy, the categories, the
  always-on stance, and the local-only processing (no telemetry — blocked
  events are counted locally and shown on the usage dashboard, nothing
  leaves the machine).
- Prompt-gate blocks name the **category, not the matched term**; the
  policy page explains rephrasing. False-positive feedback = a mailto
  link, nothing automated.
- **Honest claim discipline** (the repo is public): the claim is
  "built-in content safeguards, always on, cannot be disabled in the
  app" — a default-stance claim. It is NOT "impossible to generate";
  a fork can strip code, classifiers have error rates, word lists have
  gaps. Marketing copy is written to the first claim only.

## D6 — Validation before shipping (the honesty gate)

1. **Eval set**: ~500 images from OUR generators (fal nano-banana, local
   SD across checkpoints, a Flux-class model) over SFW prompts spanning
   portraits, swimwear-adjacent, fitness, medical, art styles — measuring
   the borderline band's false-positive rate on exactly the distribution
   we emit. NSFW recall relies on the models' published benchmarks +
   a small manual spot-check; **no NSFW corpus enters the repo or CI**.
2. **Ensemble decision** (D2a ship-gate) made on this eval.
3. **Golden policy tests** (unit, CI-safe): profanity-alone passes Gate A;
   sexual terms block; normalizer variants block; LLM surfaces have no
   hook (a test asserts the absence); fail-closed path (classifier
   unavailable → generation errors).
4. **Threshold constants** frozen with the eval numbers recorded in this
   doc as a rev.

## D7 — Performance budget

ViT-tiny@384 ≈ tens of ms/image on CPU (unpublished exactly; measure),
SwiftFormer-XS less; both trivial next to seconds-to-minutes generation
times. Video worst case ~22 inferences <1 s. Warm session held in the
worker; first-use latency hidden behind generation time.

## Sequencing & size

V1 build-order **slice 5** (before the Gemini provider — new providers are
born covered; engine-level hooks make that automatic, the ordering lets
1.0.x advertise it early). Size **M**: hooks are small; the curation pass,
ONNX export + worker integration, and the eval harness dominate.

## Checklist (answerable inline)

1. Primary classifier = Marqo nsfw-image-detection-384, self-exported
   ONNX fp16, bundled in the installer as a documented rule exception?
   [recommend: yes]
2. OR-ensemble with image-safety-classifier-xs, kept only if the 500-image
   eval shows added recall? [recommend: yes, eval-gated]
3. Threshold bands 0.8 / 0.2 with borderline → block by default?
   [recommend: yes]
4. Gate A scope = visual prompt fields only; profanity-alone never
   blocks; Hasan reviews the curated blocklist before it ships?
   [recommend: yes]
5. LLM surfaces: zero hooks, system-prompt clause only (a CI test asserts
   the absence)? [recommend: yes]
6. Fail-closed + no production kill switch, exactly as D2d words it?
   [recommend: yes]
7. Claim wording per D5 (default-stance claim, never "impossible")?
   [recommend: yes]

## Rev 1 — implementation plan CONFIRMED (2026-08-23, Hasan)

Checklist 1–7 all confirmed per recommendations. Facts re-verified against
live sources 2026-08-23: Marqo `model.safetensors` = 22.4 MB fp32 → ~5.6M
params, NO official ONNX (self-export fp16 ≈ 11 MB stands); card confirms
training on real photos, drawings, Rule 34, memes, AI-generated images;
ensemble xs has an official 13.1 MB fp32 ONNX (fp32 only, despite card).
Code survey confirmed every seam (five call sites, engine chokepoint at
`image-engine.ts generate/generateWith`, video buffer at
`video-studio-handlers.ts` save path, both capture write sites).

**Decisions taken with Hasan:**

1. **CPU-only execution provider — no DirectML.** Not a size call: GPU EP
   adds init/driver failure modes to a fail-closed gate for imperceptible
   speedup (~30–80 ms/CPU vs seconds-scale generation). Win-x64 CPU ORT =
   23 MB unpacked (measured; DirectML would add +36 MB).
2. **onnxruntime-node** promoted to a direct pinned dep (currently
   transitive at 1.24.3 and EXCLUDED from packaged builds —
   electron-builder.yml `files` exclusion removed + `asarUnpack` restored,
   filtered to CPU-only per-platform binaries). Installer delta ≈ 34 MB
   unpacked (model 11 + ORT 23).
3. **Eval-in-dev-first, bundle the winner** (Hasan's framing): models are
   downloaded loose files in a dev folder; the eval harness runs Marqo
   alone vs OR-ensemble there; ONLY the winning config is committed to
   `resources/content-safety/` and bundled. Marqo-as-primary is already
   decided; the eval decides the ensemble + confirms bands.
4. **ONNX checked into the repo** with the export script + sha256 recorded
   (deterministic builds, supply-chain audit trail).
5. **Eval set = ~500 SFW images from our own generators** (portraits,
   fitness, swimwear-adjacent, medical, art styles) via Cloudflare
   flux-1-schnell free tier + the agy subscription path — measures the
   borderline band's false-positive rate; NO NSFW corpus is ever generated
   or stored (D6 unchanged).
6. **Blocklist curation reviewed by Hasan mid-slice** (produced early in
   NF8 so review overlaps Gate B build).
7. **No feature-flag/env-file changes** — the gate has no flag by D2d, and
   `feature-flags.ts`/`env.d.ts`/`.env.example`/`MainContent.tsx` are
   parallel-session dirty. The Content Safety page is a new `safety`
   sub-tab on the AI screen (new files + ~4 lines in `types.ts` +
   `AiModelsTab.tsx`); blocked counts in a small local counter store +
   one `CONTENT_SAFETY_STATUS` channel, NOT in ai-usage tables.
8. **Worker**: `worker_threads` Worker (embedding-worker pattern, incl.
   the win32 DLL PATH probe), raw `ort.InferenceSession` (not
   transformers.js); decode+resize main-side via nativeImage with ffmpeg
   raw-RGB fallback; undecodable input = blocked (fail-closed).
9. **Typed error**: `ModerationBlockedError { gate, category }` shared +
   Electron-free; destructured at IPC into a `blocked?: { gate, category }`
   discriminant on image/video/capture response types (SdCliError
   precedent) — never serialized as a class.

**Commit plan (NF8–NF12):** NF8 Gate A (normalizer NFKC+homoglyphs,
curated `generation-blocklist.ts`, checkPrompt + visual-prompt hooks,
typed error, renderer copy, golden tests) · NF9 Gate B core (export
script + model, packaging edits, safety worker + classifier + bands,
engine interceptor covering outputs AND input refs) · NF10 remaining
call sites (video 2 fps sampling + both captures) · NF11 Content Safety
page + counters + system-prompt policy clause + LLM-hook-absence test ·
NF12 eval harness + eval run + ensemble/threshold freeze + doc rev +
Status/tracker. Each commit gate-green (vitest + check:types 26/22),
pathspec-only; CDP smoke walk before slice close.

**Spun off (NOT slice 5):** (a) opt-in upload/telemetry to Hasan's server
(Sentry-consent pattern; hard line — blocked IMAGES are never uploaded,
metadata only; needs its own design doc; Content Safety page wording must
stay true); (b) license posture on safety-stripping forks — repo is
FSL-1.1-MIT (noncompete covers commercial stripped forks now; MIT
conversion after 2 yrs per release; ELv2 has no noncompete — wrong shape;
PolyForm Shield = noncompete w/o conversion) → licensing-flip checklist
owns it; README/site/in-app wording stays the D5 default-stance claim.

## Rev 2 — SHIPPED (2026-08-26): implementation record, eval, threshold freeze

Slice 5 shipped as NF8–NF12. Everything below is measured, not planned.

**The export (D2a/decision 4).** `scripts/export-content-safety-model.py`
(venv recipe in its header) → `resources/content-safety/
nsfw-image-detection-384.fp16.onnx`, 11.4 MB, **sha256 `868c759f8167ddf0
48bc8f603132b00db0f78ee0297a76359ed1619c252ffb23`**, opset 17, fp32 I/O.
Max probability drift vs torch: **7.7e-4**. `timm.layers.set_fused_attn
(False)` is required — fused SDPA traces to Cast nodes that break the fp16
conversion. Labels `[NSFW, SFW]` (nsfwIndex 0), preprocessing 384² squash
resize (crop can push explicit regions out of frame), mean/std 0.5, all
recorded in `model-config.json`; the loader re-hashes the model at startup
and fails closed on mismatch. CPU inference ≈ 80–170 ms/image.

**Deviations from Rev 1, with reasons:**

1. **utilityProcess, not worker_threads** (amends decision 8, which named
   both). Found live in the closing CDP walk: sherpa-onnx ships its own
   older `onnxruntime.dll`, Windows resolves DLL dependencies per PROCESS
   by base name, so once sherpa loads, the 1.24.3 binding dies with "The
   operating system cannot run %1" in every thread — and the gate
   fail-closed-blocked ALL generation (correct failure mode, dead
   feature). A separate process has its own DLL space; protocol and
   lifecycle still mirror the embedding-engine pattern.
2. **ffmpeg specifics**: Remotion's trimmed ffmpeg has no `rawvideo`
   muxer and no `fps` filter. The decode fallback pipes PNG over
   `image2pipe` (finished by nativeImage); video sampling uses the `-r`
   output-rate option. Validated against real 4K DJI footage.
3. **Gate A curation extras**: a language-blind collision pass dropped 33
   terms that are innocent words elsewhere (tr `am` = English "am",
   `sperm` = sperm whale, `kinky` = hair type, it `sega` = SEGA, ja
   `カント` = Kant…), and a 22-term sexualized-minor additions block was
   added directly (`child porn`, `csam`, `loli`… — absent from the source
   list, which is no reason to omit them). Final list: **1,264 terms**.
   Full include/exclude rationale is in the "Gate A Blocklist Review"
   artifact handed to Hasan; his pruning pass is still open.

**Eval + ensemble decision (D6/decisions 2–3).** Harness:
`scripts/content-safety-eval.mjs` (dev-only; Marqo from resources, the
ensemble candidate loose in `.vidtsx-temp/eval-models/`). Starter set:
12 agy-generated SFW images across the D6 categories (portraits, swimwear,
fitness, medical, art styles, flat design). Results:

- **Marqo alone: 11/12 pass**, margins bimodal (all passes ≤ 0.086; the
  band edges have real headroom — the 0.1–0.5 sweep doesn't change the FP
  count). One FP: a textbook **anatomy diagram at p=0.859** (explicit
  band) — consistent with its drawn/Rule-34 training data, accepted under
  the recall-greedy stance; the policy page's rephrasing guidance covers
  it.
- **OR-ensemble REJECTED.** image-safety-classifier-xs (official ONNX,
  ImageNet normalization, softmaxed 3-class output) flags **6/12 SFW**
  images at 0.20–0.38 — plain portraits, swimwear, product shots, flat
  design. OR-gating would take the FP rate from 8.3% to **58.3%** for
  recall this distribution gives no evidence of needing. D2a's ship-gate
  said "keep only if it adds recall without wrecking the borderline
  band"; it wrecks the borderline band.
- **Bands FROZEN at 0.8 / 0.2** (D2b unchanged). One recorded caveat:
  fully synthetic flat/gradient buffers score p≈0.20–0.21
  (out-of-distribution uncertainty), but a real generated flat-design
  image scores 0.054 — the concern does not materialize on actual
  generator output.
- The **full ~500-image set keeps accruing** (CF flux-1-schnell free tier
  + agy, per decision 5); re-run the harness on it before the public
  flip. The ensemble verdict would need a dramatic reversal to revisit.

**Live verification (CDP walk, closing gate).** Prompt block proven in
the real Image Studio UI (red pill with the D5 copy, category `nudity`,
never the term); Content Safety page live under AI → Content Safety with
counters that increment and persist across restarts (settings KV);
`CONTENT_SAFETY_STATUS` returns term count 1,264 + model sha; fail-closed
proven for real (it caught the DLL conflict: generation refused with an
explicit error, nothing passed silently); Gate B input-reference check
exercised through a live img2img call.

**Open items:** full-set eval re-run before the flip (set generation in
progress — see amendment 3); a real cloud-provider generation + one video
generation once keys are re-entered (the pipeline below the provider call
is live-proven, the provider leg rides Hasan's testing pass).

## Rev 2 amendments — Hasan's review pass CLOSED (2026-08-26)

1. **Blocklist pruning applied: −41 terms → 1,223** (1,201 curated + 22
   minors). The "Gate A Blocklist Review" artifact was found deleted; the
   review was rebuilt from `generation-blocklist.ts` + matcher semantics
   and walked in-session. Every candidate collision was **verified to fire
   against the live gate before dropping** (40/40 fired). Verdicts, all
   confirmed by Hasan per recommendation:
   - *English homonyms/idioms (24):* `strap on`, `snowballing`,
     `shrimping`, `tossing salad`, `fingering`, `sixty-nine`,
     `girl on top`, `spread legs`, `ball kicking`, `snatch`, `beat off`,
     `spunk`, `axe wound`, `cipa`, `cnut`, `peen`, `threesome`, `hooker`,
     `cock`, `cocks`, `dick`, `dicks`, `voyeur`, `kum`.
   - *Cross-language innocents (12):* fr `bite` (= everyday English
     "bite" — the worst live FP), fr `chatte`/`ramoner`, es `concha`,
     nl `aftrekken`, de `rosette`/`poppen`, ar `فرج`/`قضيب`/`مبادل`,
     ur `چکلا`, tr `sike`.
   - *CJK substring collisions (5):* ja `ローター` (rotor), `脱衣`
     (脱衣所), `裸` (裸足/裸眼; `裸の女性` retained), `変態`
     (metamorphosis), zh `交配` (biological mating).
   - Rationale: Gate B (pixels) is the security boundary (D0), so Gate A
     drops trade zero safety for the FP win. Compound/neighbor terms all
     retained (`suck my cock`, `black cock`, `strapon`, `voyeurweb`, …).
     Everything else keep-as-is: minors additions untouchable, anatomy
     register kept (consistent with Gate B blocking anatomy diagrams).
   - All 40 verified prompts + 5 retained-coverage prompts are pinned as
     golden tests in `generation-gate.test.ts` (moderation suite 47→92).
   - Known cosmetic leftover: typo variant `voyuer` remains while
     `voyeur` was dropped — fires only on the literal misspelling.
2. **Mailto confirmed:** `support@vidtsx.com` in `ContentSafetyContent.tsx`
   is final (Hasan, 2026-08-26). No code change.
3. **Eval set status:** the assumed CF/agy accrual had NOT happened —
   `.vidtsx-temp/eval-images` still held only the 12 NF12 starters. Re-run
   on those 12 reproduces NF12 exactly (11/12 pass, anatomy-diagram FP at
   p=0.859, FP 8.3%, edge sweep flat 0.10–0.50) — bands stay frozen at
   0.8/0.2. Bulk generation of the remaining ~490 SFW images (agy
   subscription path, D6 categories) approved by Hasan and kicked off
   2026-08-26; the full-set re-run happens when it lands.

## Rev 3 amendment — audio generation is not gated (2026-09-10, W2b)

The ledger line the V1 completion plan (§2.2 W2b) asks for. ElevenLabs sound
effects (`POST /v1/sound-generation`) and music (`POST /v1/music`) joined the
app behind `src/audio-engine/generation/` — the Studio agent's `generate_sfx`
/ `generate_music`, the Agents `generate_audio` tool, and the `AUDIO_GENERATE`
IPC all go through that one engine. **Neither gate applies to them, by
design:** Gate A is defined on VISUAL fields only (D3), Gate B classifies
pixels (D2), and D0.2 gives text surfaces zero hooks. An audio prompt is
text and its output is sound, so it takes the same position reference audio
(D2c item 5) and STT input already take — no classifier exists for it, the
provider carries its own policy, and a word-list on a sound prompt would be
exactly the false-positive machine D0.2 rules out. The engine has no
`setSafetyGuard`; if a sound classifier ever becomes worth shipping it lands
as a D2c call site, not as a prompt filter.

## Rev 4 amendment — the dev-only bypass D2d allowed for (2026-09-17)

D2d left one door open: *"A dev-only bypass for test fixtures, if ever needed,
must be compiled out of release builds — not flag-gated."* Hasan asked for it
on 2026-09-17, for his own dev testing only. It is built to that sentence
exactly; D2d's production stance is unchanged.

- **One helper:** `src/content-safety-engine/dev-bypass.ts` —
  `import.meta.env.DEV && process.env.VIDTSX_DEV_DISABLE_CONTENT_SAFETY === '1'`.
  Vite replaces `import.meta.env.DEV` with a literal, so in a production
  bundle the function body is `return false;` and the env read does not
  exist. Verified on the real output, not assumed.
- **Opt-in is per shell, never committed** (no `.env` entry, no npm script,
  no setting, no UI toggle):
  `$env:VIDTSX_DEV_DISABLE_CONTENT_SAFETY = '1'; npm run dev`. Only the exact
  value `1` counts.
- **What it turns off:** Gate A's curated list (`checkGenerationPrompt`) and
  every Gate B pixel check through its two chokepoints (`checkImageBuffer`;
  `checkVideoFile`/`checkVideoBuffer`, so sampling is skipped too and a probe
  failure cannot still fail closed). All six D2c call sites route through
  those, so nothing needed per-caller changes.
- **What stays on even then:** the 22 sexualized-minor terms
  (`MINORS_ADDITIONS`). No test needs them; "untouchable" (Rev 2 amendment 1)
  holds in dev too.
- **Never silent:** one `DEV BYPASS ACTIVE` warning in the main log at init,
  `devBypass` on `CONTENT_SAFETY_STATUS`, and a red banner on the Content
  Safety page (the page's "always on" copy must not be shown as true while it
  is false). Both the log line and the banner sit behind their own literal
  `import.meta.env.DEV` guard, so they are dropped from release bundles too.
- **Enforced, not trusted:** `scripts/check-release-bundle.mjs` fails the
  build if the variable's name survives anywhere in `out/**/*.js`. `build`
  now ends with it and `build:win` / `build:mac` / `publish:win` all go
  through `build`, so no release script can skip it. A guard Vite cannot fold
  (`import.meta.env?.DEV`, a destructured env, a runtime-only check) is
  exactly what it catches. Failure path verified with a planted leak.
- **Tests stay hermetic:** `vitest.config.ts` forces the variable empty, so a
  shell with the bypass on cannot flip the golden policy tests; the bypass's
  own tests stub it back (`dev-bypass.test.ts`, plus three in
  `generation-gate.test.ts`: curated list skipped, every minors term still
  blocks, no effect when `DEV` is false).
- **D5 claim unaffected:** "cannot be disabled in the app" is about the
  shipped app, where the switch does not exist. Running from source was
  always outside that claim ("a fork can strip code").

## Key sources

Marqo model card · OwenElliott/image-safety-classifier-xs · Falconsai ·
AdamCodd vit-base-nsfw-detector (+NC SD-specialist & prompt models) ·
NudeNet v3 (AGPL) · GantMan/nsfw_model · TostAI (NC) · LAION
CLIP-based-NSFW-Detector · UnsafeBench (arXiv:2405.03486, CCS 2025) ·
Rando et al., Red-Teaming the SD Safety Filter · JailbreakDiffBench
(ICCV 2025) · Trembit moderation-pipeline architecture (frame-sampling
norms) · US patent 12417413 (interval sampling) · Google Video
Intelligence explicit-content docs.
