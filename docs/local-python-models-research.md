# Local Python-runtime models — research (2026-09-09 → 2026-09-11)

> **Status: research only, nothing implemented.** Planning session with Hasan. Two web-research
> passes: (1) a category sweep of what a video editor's users ask for (upscaling, interpolation,
> matting, depth, TTS, separation, denoise, music, lip-sync, video generation), then (2) a sweep
> of **Pinokio's catalogue** as a demand signal, with licence / VRAM / dependency checks on every
> name that surfaced. All sources dated 2025–2026, cross-checked against what the app ships.
>
> Audio (STT, TTS, cloning, music, SFX, foley, cleanup) has its own deeper doc from a parallel
> session: `docs/local-audio-models-research.md`. This doc only lists audio models where the
> two sweeps disagree or where this sweep found something that doc does not cover. For the
> three inference lanes and the audio hardware ladder, read that doc first.
>
> Nothing below has been downloaded or benchmarked on the test box. Figures are from model
> cards, READMEs and issue threads; *est.* marks a number no source stated.

## 0. What "one-click" means for the ai-runtime lane

The Python lane is `src/main/services/python-models/` + `src/local-python-engine/` + the
relocatable stack `2026.09.1` (Python 3.11, torch 2.14.0+cu126 / +cpu, transformers 5.16.1,
numpy 2.4.6, onnxruntime 1.29.0, rembg 2.0.83, scikit-image, pillow, trimesh, xatlas,
safetensors, einops, omegaconf, moderngl). Today it runs rembg u2net / ISNet and TripoSR.

A candidate is a one-click entry **only if all of these hold** (from
`docs/local-python-runtime-plan.md` §0 and the Stage 0 evidence):

| Rule | Why |
|---|---|
| Permissive licence on **code and weights** (MIT / Apache / BSD), ungated download | The catalogue rule; no login, no acceptance click, no territory clause |
| Every dependency has a cp311 / abi3 / pure Windows wheel — nothing compiled at install | Users never run pip or a compiler |
| Tolerates the shared pins (torch 2.14, numpy 2.x, transformers 5.16) | One stack serves every model in a release; two stacks live at most |
| Runs on a 4–8 GB card, ideally with a CPU fallback | The 4 GB GTX 1650 Ti test box is the floor we can verify |
| Weights small enough to download on first use (hundreds of MB, low GB at most) | Weights are never re-hosted; first-use download is the UX |

Anything that fails only the licence rule can still ship **behind a per-model licence dialog**
(the pattern already planned for Hunyuan3D). Anything that fails the wheel or pin rule needs
vendoring or a stack bump. Anything over ~12 GB VRAM cannot be validated here.

The descriptor type in `python-models/registry.ts` currently accepts **image inputs only**;
video and audio input kinds are the one shared type change most candidates below need.

## 1. Demand signal: Pinokio's catalogue

Pinokio (MIT desktop launcher, v8.0.40 July 2026, ~32k Windows installs in its first week) is
the closest thing to a market survey of "local AI a creator will click on". Its factory scripts
sorted by stars cluster into eight asks:

| Cluster | Pinokio scripts (stars) | VidTSX today |
|---|---|---|
| Video generation | CogStudio 392, Wan 41, FramePack 22, HunyuanVideo 21, Wan2GP | **Covered** — sd-cli video engine |
| Background removal | RMBG-2 Studio 288, video-background-removal 5 | **Covered** — rembg u2net / ISNet |
| Image generation | FLUX WebUI 191, Forge 11, MFLUX 23 | **Covered** — sd-cli |
| Voice-clone TTS | e2-f5-tts 82, Ultimate-TTS-Studio 30, Dia 34, Orpheus 21, Zonos 10, Kokoro 8, StyleTTS2 13 | Partly — sherpa-onnx lane has Kokoro / Kitten / VITS / Piper (CPU, no cloning), Tools tab only |
| Upscaling | Clarity 53, aura-sr 7, instantir 4 | **Gap** |
| Talking heads / face animation | LivePortrait 4+, facepoke 18, hallo 13, echomimic2 9 | **Gap** |
| 3D | Hunyuan3D-2 12+23, TRELLIS 18, TripoSplat | **Covered** — TripoSR; TripoSG planned |
| Music / foley | yue 18, diffrhythm 19, MMAudio 12, stableaudio 11, openaudio 27 | **Gap** (see audio doc) |

Trailing: voice conversion (Applio 7), matting (MatAnyone 11), image editing (MagicQuill 8,
omnigen 7, diffusers-image-fill 21), captioning (florence2), whisper-webui 14,
ai-video-composer 17 (natural-language ffmpeg — the Studio agent already does this).

**Reading:** four of eight clusters are covered. The uncovered ones with real demand are
voice-clone TTS, talking heads, music/SFX, and upscaling. Image editing is smaller than the
hype suggests and belongs to the sd-cli track anyway (§4.5).

## 2. Candidates — enhancement and vision (the Python lane's natural territory)

### 2.1 Tier 1 — permissive, small, fits the current pins (one stack bump)

| Model | Job in VidTSX | Licence | Weights | VRAM | Stack impact | Notes |
|---|---|---|---|---|---|---|
| **BiRefNet** via rembg (`birefnet-general`, `-lite`, `-portrait`) | Better cutout edges; per-frame **video** background removal | MIT | ~1 GB general, ~220 MB lite (*est.*) | ≤ 4 GB | **none** — rembg 2.0.83 already ships the sessions | Cheapest win in the whole list; rembg has no native video loop, we drive frames ourselves |
| **Practical-RIFE 4.25** | Real slow motion, frame-rate conversion | MIT | tens of MB | ≤ 4 GB | + `opencv-python-headless` | Fixes the "slow motion stays a browser span" gap in export-engines; `--multi`, `--scale`, UHD mode; no compiled ops. ncnn/Vulkan builds exist for non-NVIDIA later |
| **Real-ESRGAN** via **spandrel** | Image + per-frame video upscaling | MIT (spandrel) · BSD-3 (weights) | 64 MB x4plus | ≤ 4 GB with tiling | + `spandrel` (pure Python) | spandrel only ships permissive architectures, so any OpenModelDB permissive `.pth` becomes a catalogue entry later |
| **DeepFilterNet3** | Voice denoise for voice-overs and raw footage | MIT / Apache dual | few MB | CPU realtime, 48 kHz | + `deepfilternet` (wheels, no Rust) | Also in the audio doc |
| **Demucs v4 (htdemucs)** | Split voice from music; remove background music from b-roll | MIT | ~80 MB per model | ≤ 4 GB | + `torchaudio` pinned to torch 2.14, `demucs` | Also in the audio doc; BS-Roformer beats it but its community weights have no stated licence |
| **Depth Anything V2 Small**, **Video Depth Anything Small** | Depth maps for parallax / 2.5D / focus / fog TSX effects, pairs with 3D Studio | Apache 2.0 (**Small only** — Base/Large/Giant are CC-BY-NC) | ~100 MB | 8 GB runs Large at 392 px; Small fits 4 GB (*est.*) | none (transformers present) | Streaming mode exists (2025-07) for long clips |
| **Florence-2** (0.23B base / 0.77B large) | Auto-tag the asset library, describe b-roll for the agent, OCR text in frames, grounding | MIT | 0.5 / 1.5 GB | CPU-capable | none, but **vendor the loader** — transformers 5.x native support exists (2025-08) and the API drifted (community fixes for generate() and preprocessor) | Gives the Studio agent and asset search a pair of eyes |

That is **seven models on one stack bump** (`2026.10.x`: + spandrel, opencv-python-headless,
torchaudio, deepfilternet, demucs). Everything else in this section needs either a licence
dialog, a vendoring job, or more VRAM than the test box has.

### 2.2 Tier 2 — wanted, but one blocker each

| Model | Job | Licence | Blocker | Route |
|---|---|---|---|---|
| **SAM 3** (Meta, 2025-11) | Click-to-select and track any object in video → rotoscoping masks, feeds BiRefNet/matting | Custom **SAM License** (commercial OK; no military/ITAR, litigation clause) | Not MIT/Apache | Per-model licence dialog; ~3.4 GB (*est.*) |
| **LivePortrait** | Animate a portrait from a driving video (Pinokio's most-wanted talking-head) | MIT code + weights, **but** bundled InsightFace detector weights are non-commercial | InsightFace | Swap detection to **MediaPipe** (Apache; CPU-only on Windows, slightly worse detection) — the only clean talking-head path found; 6 GB |
| **TripoSplat** | Image → Gaussian splat (up to 262k gaussians) | MIT | App has no splat viewer (GlbViewer is mesh-only) | 3D Studio sibling once a three.js splat renderer is vendored |
| **TripoSG** | 3D quality upgrade | MIT | > 8 GB VRAM per README | Already the planned model #2; needs fp16 + offload measured |
| **Hunyuan3D-2.1** | Textured PBR 3D, ≥ 3 GB geometry / ≥ 6 GB texture | Tencent Hunyuan 3D 2.1 Community — **excludes EU, UK, South Korea**; 1M MAU cap | Territory clause | The territory dialog already planned |
| **GFPGAN** | Face restore after upscaling talking heads | Apache 2.0 | Depends on unmaintained `basicsr` (breaks on new torch/torchvision) | Vendor the arch through spandrel if it ever lands there; else skip |
| **ACE-Step 1.5 turbo 2B** | Background music (≤ 6 GB, < 10 s per song on a 3090) | MIT | Own uv stack, pins unverified, weights large | See audio doc |
| **Stable Audio 3 Small SFX** | Text → sound effects for b-roll | Stability Community (free < $1M revenue) | Revenue cap | Licence dialog; see audio doc |
| **DiffRhythm 2** | Full songs with lyrics | Apache 2.0 | Pins unverified | See audio doc |
| **Qwen3-VL 2B / 4B** | Video understanding, "find the shot where…" | Apache 2.0 | Heavy in Python | Run as GGUF on the existing llama.cpp engine instead — no Python runtime needed |
| **Orpheus 3B** | Emotive TTS with `<laugh>`/`<sigh>` tags, cloning | Apache 2.0 | 8 GB at Q8; ~3 GB at Q4 (*est.*) | Also GGUF on the llama engine + a tiny SNAC decoder — first voice feature with no runtime download; worth a one-day spike |
| **Qwen3-TTS 0.6B / 1.7B** | Voice-over, 3-second clone, 10 languages | Apache 2.0 | transformers pin vs 5.16 unverified; "4 GB" claim unmeasured | Default TTS pick for the Python lane (see audio doc for the alternatives) |

### 2.3 Tier 3 — permissive but low value or too heavy for the box

| Model | Why it waits |
|---|---|
| EchoMimic v2 / v3 (Apache) — audio-driven half-body animation | 12–24 GB VRAM |
| Dia2 1B / 2B (Apache) — two-speaker dialogue TTS | VRAM undocumented; niche for an editor |
| KittenTTS (Apache, < 25 MB, ONNX) | Already on the sherpa-onnx lane |
| AuraSR v2 (Apache, 618M GAN) | Overlaps Real-ESRGAN; tuned for generated images |
| DDColor (Apache) | Colourisation; per-frame flicker on video |
| FramePack (Apache, 13B, runs on 6 GB) | Video generation already lives in sd-cli; 30 GB weights |
| Zonos 1.6B (Apache, 5–30 s clone, 6 GB) | Needs espeak-ng (GPL-3) like Kokoro; Qwen3-TTS covers the job |
| Kokoro 82M (Apache) | Pulls numpy < 2 and espeak-ng (GPL-3); already on the sherpa-onnx lane anyway |
| Chatterbox Turbo (MIT) | Hard pins torch 2.6.0, transformers 5.2.0, numpy < 2 — unvendorable without a second stack |
| SeedVR2 3B / 7B (Apache) — best video upscaler | 18 GB+ VRAM even for 3B |
| Wan 2.2 TI2V-5B (Apache) | 24 GB via diffusers, 8 GB only with ComfyUI-style offload; sd-cli covers it |
| Clarity upscaler (SD 1.5 + ControlNet tile) | "Creative" upscaler that invents detail; if wanted, it is an sd-cli workflow |
| Applio / RVC (MIT) — voice conversion | Ecosystem is celebrity-voice heavy; consent question; see audio doc §2.2 |
| LoRA training (ai-toolkit, llamafactory) | Training is out of scope for V1; "train a LoRA of my product" is a real creator ask for later |

### 2.4 Excluded on licence or policy

| Model | Reason |
|---|---|
| MatAnyone 2, ProPainter, CodeFormer | NTU S-Lab 1.0 — non-commercial |
| RobustVideoMatting | GPL-3.0 |
| Seed-VC | GPL-3.0 |
| MMAudio (video → foley) | Code MIT, **weights CC-BY-NC** — the one genuine loss in the list; foley alternatives are in the audio doc |
| F5-TTS weights | CC-BY-NC (the Apache OpenF5 retrain is admittedly inferior, still alpha) |
| Fish S2 Pro, Higgs Audio v3, IndexTTS-2 | Research / non-commercial licences (IndexTTS-2's terms contradict each other) |
| bria-rmbg (rembg default), RMBG-2 | BRIA licence requires a paid agreement |
| Depth Anything V2 Base / Large / Giant | CC-BY-NC — only Small is Apache |
| MagicQuill | CC-BY-NC |
| Moondream 3 | BSL 1.1 with a grant that restricts embedding in paid products — too ambiguous for a shipped app |
| LTX-2.3 | Community licence with a $10M revenue cap — dialog-only, and sd-cli video already exists |
| SAM2Matting | CC-BY-NC-SA |
| YOLO family | AGPL |
| FaceFusion | OpenRAIL-AS + research-only HyperSwap models; face swap is out of scope on policy grounds regardless |
| OmniGen2 | Apache, but 17 GB VRAM |
| MediaPipe as a *catalogue* model | Fine as a dependency (Apache); not a user-facing model |

## 3. Correction to the first pass

The first summary said the app's voice engine only held VITS and Piper. The sherpa-onnx lane
also carries **Kokoro v0.19 / v1.0 / v1.1 and KittenTTS** (CPU, no cloning), reachable only from
Tools → Voice AI Tester. So the Python lane's TTS job is specifically **voice cloning and
quality**, not "any local TTS".

## 4. What changes in the plan

### 4.1 The next stack bump carries seven models
`2026.10.x` = current pins + spandrel, opencv-python-headless, torchaudio, deepfilternet,
demucs. Models: BiRefNet, RIFE, Real-ESRGAN, DeepFilterNet, Demucs, Depth Anything Small,
Florence-2. Every one is small, permissive, wheel-only, and runs on the 4 GB box.

### 4.2 Surface them as clip actions, not a models tab
In Studio these read as **Enhance** actions on a clip: denoise voice, upscale, smooth slow
motion, remove background, separate music. Same rule as "background removal is an action inside
Image Studio, no Python-models tab". Each action is also an agent tool and a Flows node for free
(the `invokeTool` registry pattern from W8).

### 4.3 Build the non-permissive licence dialog once
Five wanted models are blocked **only** by a revenue cap, a territory clause, or a custom
licence: Stable Audio 3 SFX, LTX-2.3, Hunyuan3D-2.1, SAM 3, and SeedVR2 when cards catch up.
One dialog pattern (per-model terms text, explicit accept, recorded in settings, territory
check where the licence has one) unlocks all of them. Highest-leverage infrastructure item
after the stack bump.

### 4.4 TTS has three permissive routes; pick one per lane
- **Python lane:** Qwen3-TTS (default pick; needs the pin + VRAM test).
- **llama engine:** Orpheus 3B GGUF + SNAC — a one-day spike, because it would be the first
  voice feature that needs no runtime download.
- **sherpa-onnx lane:** already has Kokoro / Kitten for CPU-only boxes.
Zonos and Kokoro-in-Python both stay behind because of espeak-ng's GPL.

### 4.5 Image editing is an sd-cli question
FLUX.2 [klein] 4B (Apache, 2026-01, ~13 GB) and Qwen-Image-Edit 2511 (Apache, 8–12 GB with
GGUF Q4) are the local instruction-editors people use. Whether they land depends on
stable-diffusion.cpp support, which is a check for the image / video-providers track, not the
Python runtime.

### 4.6 Talking heads have exactly one clean path
LivePortrait with MediaPipe replacing InsightFace. Every other popular option is either
non-commercial (hallo's InsightFace, FaceFusion) or needs 12 GB+ (EchoMimic).

## 5. Decisions for Hasan

1. **Stack bump scope:** the seven-model `2026.10` bump as listed, or a smaller first cut?
2. **Licence dialog:** build it before or after the stack bump? It gates SAM 3, Stable Audio
   SFX, Hunyuan3D-2.1 and LTX.
3. **Voice cloning:** in the product at all, given the consent question? If yes, Qwen3-TTS in
   Python vs the Orpheus-on-llama spike first.
4. **Talking heads:** is LivePortrait-with-MediaPipe worth the vendoring work for V1.x?
5. **Music generation:** ACE-Step turbo vs DiffRhythm 2 vs Stable Audio 3 (dialog) — the audio
   doc's §8 has the fuller comparison.
6. **Image editing:** ask the sd-cli track whether stable-diffusion.cpp runs FLUX.2 klein /
   Qwen-Image-Edit today.

## 6. Verify before committing (on the test box, GTX 1650 Ti 4 GB)

- rembg `birefnet-general-lite` on a 4K frame: time and peak VRAM; whether `-general` fits.
- RIFE 4.25 at 1080p ×2 and ×4: fps and whether `--scale 0.5` is needed at 4K.
- Real-ESRGAN x4plus with spandrel tiling at 1080p → 4K: time per frame (the export wall is
  already Chromium screenshots; per-frame upscaling must not double it).
- Florence-2 large on transformers 5.16.1 with the vendored loader: captions, OCR, grounding.
- Qwen3-TTS 0.6B: does `qwen-tts` accept transformers 5.16; real VRAM on 4 GB; clone quality.
- Depth Anything V2 Small on a 1080p frame: time, and Video Depth Anything streaming on a
  30 s clip.
- Demucs htdemucs on a 3-minute track: time on CPU vs GPU; torchaudio 2.14 wheel presence.
- DeepFilterNet3 wheel imports cleanly against numpy 2.4 / torch 2.14.

## 7. Sources

Catalogue and demand: [Pinokio factory repos (page 1)](https://github.com/orgs/pinokiofactory/repositories?type=all&sort=stargazers),
[page 2](https://github.com/orgs/pinokiofactory/repositories?type=all&sort=stargazers&page=2),
[pinokio.co](https://pinokio.co/), [top Pinokio downloads](https://milloz.com/info/ai/free-app-store/pinokio/most-downloaded),
[Pinokio overview](https://www.therundown.ai/tools/pinokio).

Enhancement / vision: [rembg](https://github.com/danielgatis/rembg), [BiRefNet](https://github.com/ZhengPeng7/BiRefNet),
[Practical-RIFE](https://github.com/hzwer/Practical-RIFE), [spandrel](https://github.com/chaiNNer-org/spandrel),
[Real-ESRGAN x4plus](https://openmodeldb.info/models/4x-realesrgan-x4plus),
[Depth Anything V2 licence issue](https://github.com/DepthAnything/Depth-Anything-V2/issues/162),
[Video Depth Anything](https://github.com/DepthAnything/Video-Depth-Anything),
[Florence-2 in transformers](https://huggingface.co/docs/transformers/model_doc/florence2),
[Florence-2 transformers-5 fixes](https://note.com/198619891990/n/nbc5280aecc94?hl=en),
[SeedVR2 low-VRAM guide](https://seedvr2.net/blog/tutorials/seedvr2-comfyui-low-vram-guide-2026),
[AuraSR v2](https://huggingface.co/fal/AuraSR-v2/blob/main/README.md), [DDColor](https://github.com/piddnad/DDColor),
[GFPGAN](https://github.com/tencentarc/gfpgan), [CodeFormer licence](https://github.com/sczhou/CodeFormer/blob/master/LICENSE),
[Clarity upscaler](https://github.com/philz1337x/clarity-upscaler).

Matting / segmentation: [SAM 3 licence](https://github.com/facebookresearch/sam3/blob/main/LICENSE),
[SAM 3 licence summary](https://sam3ai.com/license/), [MatAnyone 2](https://github.com/pq-yang/MatAnyone2),
[SAM2Matting](https://github.com/FudanCVL/SAM2Matting), [RobustVideoMatting licence](https://github.com/PeterL1n/RobustVideoMatting/blob/master/LICENSE),
[ProPainter licence](https://github.com/sczhou/ProPainter/blob/main/LICENSE).

Talking heads / faces: [LivePortrait InsightFace issue](https://github.com/KlingAIResearch/LivePortrait/issues/193),
[Hallo3](https://github.com/fudan-generative-vision/hallo3), [EchoMimic v3](https://github.com/antgroup/echomimic_v3),
[LatentSync / MuseTalk guide](https://tomodahinata.com/en/blog/ai-lip-sync-talking-head-model-selection-guide-2026),
[FaceFusion licences](https://docs.facefusion.io/introduction/licenses), [MediaPipe face detector](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/python).

3D: [TripoSplat](https://github.com/VAST-AI-Research/TripoSplat), [TripoSG](https://github.com/VAST-AI-Research/TripoSG),
[Hunyuan3D-2.1 licence](https://huggingface.co/tencent/Hunyuan3D-2.1/blob/main/LICENSE),
[SAM 3D Objects VRAM](https://github.com/facebookresearch/sam-3d-objects/issues/6).

Voice (this sweep only; the audio doc has more): [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS),
[Kokoro on PyPI](https://pypi.org/project/kokoro/), [espeakng-loader](https://pypi.org/project/espeakng-loader/),
[Chatterbox pyproject](https://github.com/resemble-ai/chatterbox), [Zonos](https://github.com/Zyphra/Zonos),
[Orpheus](https://github.com/canopyai/Orpheus-TTS), [Orpheus GGUF setup](https://localaimaster.com/blog/orpheus-tts-setup-guide),
[Dia2](https://github.com/nari-labs/dia2), [KittenTTS](https://github.com/KittenML/KittenTTS),
[OpenF5-TTS](https://huggingface.co/mrfakename/OpenF5-TTS-Base), [Fish S2 Pro licence](https://huggingface.co/fishaudio/s2-pro/blob/main/LICENSE.md),
[IndexTTS-2 licence issue](https://github.com/index-tts/index-tts/issues/228), [Higgs Audio v3](https://huggingface.co/bosonai/higgs-audio-v3-tts-4b),
[VibeVoice](https://github.com/microsoft/VibeVoice), [Applio](https://github.com/iahispano/Applio), [Seed-VC](https://github.com/Plachtaa/seed-vc).

Audio cleanup / music / foley (this sweep only): [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet),
[Demucs](https://openlaboratory.com/models/demucs/), [BS-RoFormer licence notes](https://github.com/galenoferreira/xeon_split_audio/blob/main/docs/research/model-licenses.md),
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5), [DiffRhythm 2](https://github.com/ASLP-lab/DiffRhythm2),
[HeartMuLa](https://github.com/HeartMuLa/heartlib), [Stable Audio 3](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models),
[SongGeneration](https://huggingface.co/tencent/SongGeneration), [MMAudio](https://github.com/hkchengrex/MMAudio).

Video generation / editing: [Wan 2.2 TI2V-5B VRAM](https://willitrunai.com/video-models/wan-video-2-2-ti2v-5b),
[LTX licence guide](https://techiehub.blog/best-local-ai-video-generator/), [FramePack](https://localaimaster.com/blog/framepack-setup-guide),
[Wan2GP](https://github.com/deepbeepmeep/Wan2GP), [FLUX.2 klein](https://blog.comfy.org/p/flux2-klein-4b-fast-local-image-editing),
[Qwen-Image-Edit local](https://localaimaster.com/blog/best-local-image-models-compared),
[OmniGen2](https://github.com/VectorSpaceLab/OmniGen2), [MagicQuill licence](https://github.com/ant-research/MagicQuill/blob/main/LICENSE),
[Qwen3-VL](https://github.com/qwenlm/qwen3-vl), [Moondream 3 licence](https://huggingface.co/moondream/moondream3-preview/blob/main/LICENSE.md),
[ai-video-composer](https://github.com/pinokiofactory/ai-video-composer), [WhisperX / pyannote gating](https://localaimaster.com/blog/whisperx-guide).
