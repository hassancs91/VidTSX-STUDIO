# Open-weight video models — research and integration ranking

> Researched 2026-09-09 (web sweep), written up 2026-09-11. Companion to
> `docs/local-audio-models-research.md` and the video backlog in
> `docs/local-image-models-implementation.md` §B.
> Question answered: **which open-weight video generation models exist, what GPU
> does each need, and which can VidTSX install for a user in one click?**

## 0. Summary

- About 30 models have downloadable weights as of this week. Sorted by the
  smallest VRAM a usable quantized build fits in, they form five tiers
  (§2). The ≤ 8 GB and 12 GB tiers are what most of our users own.
- **Wan 2.5, 2.6, 2.7 and 3.0 are NOT open.** Official Alibaba weights stop at
  Wan 2.2 (July 2025). Wan 3.0 is an invite-only hosted beta since 2026-08-06.
  "Wan 2.7 download" pages are SEO with nothing behind them.
- **Two new open flagships in August 2026:** LTX-2.5 (Lightricks, native audio,
  4K, community GGUF from 16 GB) and MiniMax-H3 (33B; license forbids
  self-hosting in the US, EU, UK and South Korea, so local integration is a
  non-starter — hosted via fal is fine).
- **Our bundled `sd-cli.exe` is the July build** (`master-778-c00a9e9`).
  Upstream stable-diffusion.cpp added MiniMax-H3 on 2026-08-04 and LTX-2.5 on
  2026-08-20, and supports HunyuanVideo 1.5. A binary bump unlocks those
  with no new runtime.
- **HunyuanVideo 1.5 is the best 8 GB option** by motion quality, but the
  Tencent license excludes the EU, UK and South Korea (and caps at 100M MAU),
  so it needs the territory dialog already planned for Hunyuan3D.
- **Wan 2.2 A14B is the open quality leader** and is blocked in our catalog
  only by its two-file expert layout (high-noise + low-noise).
- **The one-click path already exists** (§3): catalog entry → Download
  button with the Fits/Tight/Too big badge → Video tab Generate panel. Eight
  models are in the catalog now; the end-to-end click test has never been run
  because no video model was ever downloaded on the dev box.

## 1. The three integration paths

| Path | What it is | Cost per model | Who it reaches |
|---|---|---|---|
| **sd-cli (bundled)** | stable-diffusion.cpp, Vulkan build, GGUF single files + companions, `--offload-to-cpu`. Upstream video families: Wan 2.1/2.2 (incl. VACE), LTX-2.3/2.5, HunyuanVideo 1.5, LingBot-Video, MiniMax-H3. | One catalog entry with HEAD-verified URLs + sizes; a family preset if new. | Any GPU vendor (Vulkan), CPU fallback. **This is the one-click path.** |
| **Python runtime (cu126 stack)** | The portable torch + CUDA 12.6 stack from the 3D Studio work. | A vendored inference script, offline verification, compiled extensions stripped or the model is not shipped. | NVIDIA only, Pascal and up, plus a ~3.5 GB stack download. |
| **fal (hosted)** | Catalog entry with the `fal-generic` dialect, user's own key. | One catalog row. | Everyone, zero local VRAM. Right answer for the 24 GB+ tiers. |

## 2. The VRAM ladder

"Min VRAM" is the lowest published *usable* configuration (usually GGUF Q4 with
offload), "Comfortable" the setting people actually recommend. Path codes:
**sd** = sd-cli, **py** = Python runtime, **fal** = hosted. `[catalog]` = already
in `src/local-video-engine/model-registry.ts`.

### 2.1 ≤ 8 GB — laptop class (GTX 1650 Ti 4 GB with offload, RTX A3000 6 GB, RTX 3060/4060)

| Model | Params | Min VRAM | Comfortable | Does | License | Path | Notes |
|---|---|---|---|---|---|---|---|
| Wan 2.1 T2V 1.3B (Alibaba, Feb 2025) | 1.3B | 4–6 GB (GGUF Q4) | 8 GB (FP16 = 8.19 GB) | t2v 480p, 5 s | Apache 2.0 | sd `[catalog]` | Smallest full set (Q4 0.9 GB, Q8 1.5 GB + umt5). 4090: 5 s 480p in ~4 min; 4060 8 GB: 4–6 min. VACE 1.3B adds editing/reference at the same cost; sd.cpp supports it since Sep 2025. |
| LingBot-Video Dense 1.3B (Robbyant, 2026) | 1.3B | ~6 GB (5.6 GB files) | 8 GB | t2v, i2v | Apache 2.0 | sd `[catalog]` | Robotics/embodied training bias. Prompt is structured JSON — our `prompt-adapter.ts` wraps plain text. |
| Wan 2.2 TI2V 5B (Alibaba, Jul 2025) | 5B | 8 GB (GGUF + offload) | 12 GB (FP16 ~10 GB) | t2v + i2v, **720p 24 fps**, 5 s | Apache 2.0 | sd `[catalog]`, fal | Best quality-per-GB on the ladder; only ≤ 8 GB model that does 720p. Fit floor 8/24 GB. |
| HunyuanVideo 1.5 (Tencent, Nov 2025) | 8.3B | 8 GB (GGUF Q4); 5 GB "5G" build | 16 GB (FP8 14 GB + offload) | t2v, i2v, 480p/720p + SR to 1080p | **Tencent community** (no EU/UK/KR, 100M MAU cap) | sd, py, fal | Best motion quality in this tier. RTX 3060 12 GB: 720p in 8–12 min. Not in catalog; sd.cpp needs Qwen2.5-VL 7B + ByT5 GlyphXL encoders (~8 GB more). |
| LingBot-Video MoE 30B-A3B (Robbyant, Jul 2026) | 30B (3B active) | ≤ 8 GB VRAM + 16 GB RAM (GGUF, RAM-paged) | 16 GB | t2v, i2v | Apache 2.0 | py, sd? | First open MoE video model. Community loader memmaps weights in RAM and dequantizes experts on demand; tested RTX 3070 8 GB. **Verify whether sd.cpp's LingBot support covers the MoE checkpoint** before catalog work. |
| Self-Forcing / CausVid 1.3B (Jun 2025) | 1.3B | 6–8 GB | 12 GB | t2v 480p streaming, ~10 fps on a 4090 | Apache 2.0 | py | Autoregressive distillation of Wan 2.1 1.3B, 0.8 s first-frame latency. Live-preview material, not final clips. |
| FramePack (lllyasviel, Apr 2025) | 13B (Hunyuan base) | 6 GB | 12 GB | i2v, up to 60 s @ 30 fps, constant VRAM | Apache code, **Tencent weights** | py | Same VRAM for 1 s or 1 min. ~1.5 s/frame on a 4090, 4–8× slower on a 6 GB laptop. |

### 2.2 12 GB — mainstream desktop (RTX 3060 12 GB, 4070, 5070)

| Model | Params | Min VRAM | Comfortable | Does | License | Path | Notes |
|---|---|---|---|---|---|---|---|
| Wan 2.1 T2V / I2V 14B (Feb 2025) | 14B | 12 GB (GGUF Q4, 480p) | 24 GB (720p) | t2v, i2v 480p/720p | Apache 2.0 | sd `[catalog]`, fal | Our Q4 files 9.0 GB (T2V) and 10.2 GB (I2V + clip_vision). Fit floor 12/32 GB. |
| LTX-2.3 Distilled 22B (Lightricks, Mar 2026) | 22B | 10–12 GB (GGUF Q3/Q4 + offload) | 24 GB (FP8) | t2v, i2v, **native audio**, up to 4K 50 fps | LTX open weights (free under $10M revenue) | sd `[catalog]`, fal | 8-step, no CFG. RTX 3080 10 GB report: 960×544 5 s with audio in 2–3 min. Companions (Gemma 12B encoder, VAEs) ~11 GB on disk. Our floor 16/48 GB is conservative. |
| Kandinsky 5.0 Video Lite 2B (Nov 2025) | 2B | 12 GB | 16 GB | t2v, i2v, 5 s / 10 s | Apache 2.0 | py | In diffusers. Qwen2.5-VL + CLIP encoders. |
| MAGI-1 4.5B distill + FP8 (Sand AI, Apr 2025) | 4.5B | 12 GB (window_size 1) | 24 GB (standard) | t2v, i2v, v2v, unlimited length (chunked autoregressive) | Apache 2.0 | py | Best physics benchmark among open models. |
| CogVideoX 1.5 5B (Zhipu, Nov 2024) | 5B | 9 GB (BF16 + sequential offload, slow) | 24 GB | t2v, i2v, 768×1360, 5–10 s | Apache 2.0 | py, fal | Best prompt adherence of the 2024 generation; behind Wan 2.2 on motion. |

### 2.3 16 GB — enthusiast (RTX 4080, 5070 Ti, 5080)

| Model | Params | Min VRAM | Comfortable | Does | License | Path | Notes |
|---|---|---|---|---|---|---|---|
| **Wan 2.2 A14B T2V / I2V** (Jul 2025) | 27B MoE (14B active) | 16 GB (GGUF Q4, 480p) | 24 GB (Q5 720p) | t2v, i2v 480p/720p, 5 s | Apache 2.0 | sd, py, fal | **Open quality leader.** Two-file MoE (high + low noise experts) → excluded from our catalog until multi-file profiles land. sd.cpp supports it (`--high-noise-*` flags already accepted by our binary). |
| **LTX-2.5** (Lightricks, Aug 2026) | 22B | 16 GB (community GGUF Q4) | 32 GB (official FP8) | t2v, i2v, first/last frame, native stereo audio, 4K, IC-LoRA control | LTX open weights | sd (post-Aug-20 build), fal | Newest flagship with weights. Official files need 24 GB+ even at the smallest quant; full set (distilled transformer, Gemma 4 12B, VAEs, upscaler) ~66 GiB on disk. |
| Mochi 1 (Genmo, Oct 2024) | 10B | 16 GB (FP8 + offload) | 24 GB (FP8 ~20 GB) | t2v 480p, 5 s | Apache 2.0 | py, fal | Best LoRA fine-tuning base; quality a generation behind. |
| Pyramid Flow (Oct 2024) | 2B / 5B | 16 GB | 24 GB | t2v, i2v, 768p 24 fps, 10 s | MIT | py | Cleanest license on the page; dated output. |

### 2.4 24 GB — top consumer (RTX 3090, 4090). For our users this is the fal tier.

| Model | Params | Min VRAM | Comfortable | Does | License | Path | Notes |
|---|---|---|---|---|---|---|---|
| Kandinsky 5.0 Video Pro (Nov 2025) | 19B | 24 GB (i2v 20 GB) | 80 GB | t2v, i2v HD, 5 s / 10 s, camera control | Apache 2.0 | py | Slow at 24 GB. |
| Ovi (Character.AI, Oct 2025) | 11B (5B video + 5B audio + 1B fusion) | 24 GB (FP8); community build 6 GB | 32 GB | t2v, i2v with synchronized speech/audio, 960p, 5–10 s | Apache 2.0 | py, fal | Veo-3-style talking video, permissive. Built on Wan 2.2 5B. Already on fal. |
| SkyReels-V3 (Skywork, Jan 2026) | 14B (R2V, V2V), 19B (A2V) | < 24 GB with FP8 (`--low_vram`) | 48 GB | multi-reference → video, audio-driven, v2v | Skywork license — verify | py | V4 is preview-only, no weights. |
| Wan-Animate-2 (Alibaba, Aug 2026) | 14B class + Lite | ~24 GB (INT8; unstated) | 48 GB | character animation / replacement from a driving video; Lite real-time 400×720 24 fps | Apache 2.0 | py | Pose-free. Ships INT8/BF16 + distilled variants, ComfyUI/DiffSynth nodes. Fits our talking-head / b-roll workflows once sized. |
| Wan 2.2 S2V 14B (Aug 2025) | 14B | ~24 GB (DiffSynth FP8 + layer offload) | 80 GB (official) | image + audio → lip-synced 480p/720p | Apache 2.0 | py, fal | Wav2Vec injection + FramePack compression. |
| MiniMax-H3 / Hailuo 3.0 base (Aug 3 2026) | 33B + Qwen3-VL-32B encoder | ~24 GB (GGUF Q4 + offload; unstated) | 48 GB+ | t2v + stereo audio, first/last frame, reference; **768p cap** on open weights | **Excludes US, EU, UK, KR self-hosting** | sd (Aug 4 build), fal | Strongest open weights on paper; the license kills local integration. Context-IR and 2K upscaler stay API-only. |
| Allegro (Rhymes, Oct 2024) | 3B | 24 GB | 40 GB | t2v 720p 15 fps, 6 s | Apache 2.0 | py | Superseded. |

### 2.5 32–80 GB and multi-GPU — nothing here belongs in a local catalog

| Model | Params | Min VRAM | Does | License | Path |
|---|---|---|---|---|---|
| LTX-2.5 full precision | 22B | 32 GB FP8 (RTX 5090); 48 GB+ native 4K | as above at full quality | LTX open weights | fal |
| HunyuanVideo 13B original (Dec 2024) | 13B | 24 GB INT8/FP8; 60 GB FP16 720p | t2v, i2v 720p | Tencent community | py, fal |
| Open-Sora 2.0 (Mar 2025) | 11B | 52–60 GB single GPU | t2v, i2v 256p–768p | Apache 2.0 | py |
| SkyReels-V2 14B (Apr 2025) | 14B (1.3B ~15 GB) | 80 GB | infinite-length via diffusion forcing | Skywork license | py |
| Step-Video-T2V (Feb 2025) | 30B | 4× A100 80 GB (DiffSynth single-GPU quant exists) | t2v 544p, 204 frames | MIT | py |
| MAGI-1 24B | 24B | 8× H100 | as 4.5B, higher fidelity | Apache 2.0 | py |
| Krea Realtime 14B (Oct 2025) | 14B | B200 for 11 fps; 24 GB FP8 offline-slow | real-time long-form t2v, v2v | Apache 2.0 | py |
| LingBot-World 2.0 (Jul 2026) | 14B | 8 GPUs FSDP (24 GB+ each) | interactive world model, 720p 60 fps from image + actions | Apache 2.0 | py — out of scope |

### 2.6 Not open weights, despite the SEO pages

- **Wan 2.5 / 2.6 / 2.7 / 3.0** — API-only. Official weights stop at 2.2.
- **SkyReels V4** — limited preview on skyreels.ai, no weights.
- **MiniMax-H3** — open only outside US/EU/UK/KR, 768p cap, modules missing.
- **Seedance, Kling, Veo, Hailuo** — hosted; already in our fal / BytePlus catalogs.

## 3. Which ones install in one click

The one-click path is the sd-cli model library: a catalog entry lists
HEAD-verified download URLs; the AI Models screen shows Download with the
Fits / Tight / CPU offload / Too big badge (`evaluateFit`); the Video tab's
`VideoGeneratePanel` appears once ≥ 1 model is Ready. Backlog B (2026-07-16)
made every downloadable video model usable through `video-cli-runner.ts` +
`prompt-adapter.ts`. Anything on the Python runtime is a curated script plus
the stack download — a second-class install.

### 3.1 Already one-click (in the catalog; runner done; **E2E click test never run**)

| Catalog id | Download |
|---|---|
| `wan21-t2v-1.3b-q4`, `wan21-t2v-1.3b-q8` | 0.9 / 1.5 GB + shared umt5 |
| `lingbot-dense-1.3b` | ~5.6 GB total |
| `wan22-ti2v-5b-q4` | 3.0 GB + own VAE 1.4 GB |
| `wan21-t2v-14b-q4`, `wan21-i2v-14b-480p-q4` | 9.0 / 10.2 GB (+ clip_vision) |
| `ltx23-dev-22b-q4`, `ltx23-distilled-22b-q3ks` | 12.7 / 9.9 GB + ~11 GB companions |

The progress log's own click test: **Video tab → Download Wan 1.3B Q4 →
Generate.** Do this first.

### 3.2 Easy to add — same path, one catalog entry each

| Model | What it needs | Why |
|---|---|---|
| Wan 2.1 VACE 1.3B | Catalog entry only; bundled binary supports it | Editing + reference at the 1.3B cost. |
| HunyuanVideo 1.5 GGUF | Check the July build includes HunyuanVideo 1.5; add Qwen2.5-VL 7B + ByT5 companion kinds; **territory-license dialog** | Best 8 GB quality on the ladder. |
| LTX-2.5 Distilled GGUF | **sd-cli bump** to a post-2026-08-20 build; ~20 GB download with Gemma 4 encoder | 16 GB+ users only; audio in the same pass. |
| Wan 2.2 A14B T2V / I2V | **Multi-file profiles** in the model library (high + low noise experts) | The quality leader; sd.cpp already supports it. |

### 3.3 Possible, but a real project each (Python runtime, NVIDIA only)

Kandinsky 5 Lite, MAGI-1 4.5B, Ovi, FramePack, Self-Forcing. Each needs a
vendored script, offline verification, and any compiled extension stripped.
Ovi and Wan-Animate-2 are better as **fal catalog entries first**.

### 3.4 Not one-click for us

MiniMax-H3 (license), SkyReels (license unclear, 24 GB+), and the whole
32 GB+ tier.

## 4. Recommended order

1. Run the pending click test on the existing catalog (Wan 1.3B Q4).
2. Add Wan 2.1 VACE 1.3B and HunyuanVideo 1.5 GGUF (behind the territory dialog).
3. Bump sd-cli past 2026-08-20; add LTX-2.5 Distilled for the 16 GB tier.
4. Multi-file profiles, then Wan 2.2 A14B.
5. Ovi and Wan-Animate-2 as fal catalog rows; Python runtime later if demand shows.
6. Skip locally: MiniMax-H3, SkyReels, everything ≥ 32 GB.

## 5. Open verifications

- Does the bundled `master-778-c00a9e9` sd-cli run HunyuanVideo 1.5? (upstream
  `docs/hunyuan_video.md` exists; date of support not pinned.)
- Does sd.cpp's LingBot-Video support cover the MoE 30B-A3B checkpoint, or
  only the dense 1.3B?
- Wan-Animate-2 and MiniMax-H3 VRAM figures are unstated upstream; the
  numbers above are estimates from parameter counts.
- SkyReels-V3 license terms.
- AMD/ROCm: LTX runs on a 7900 XTX via ROCm (slowly); Wan 2.2 and Hunyuan
  were reported unstable on ROCm as of April 2026. Our Vulkan sd-cli path
  sidesteps this for the catalog models.

## 6. Sources

- [stable-diffusion.cpp README](https://github.com/leejet/stable-diffusion.cpp) — supported video families, backends, news dates
- [Will It Run AI — video VRAM guide 2026](https://willitrunai.com/blog/video-generation-gpu-guide-2026)
- [Will It Run AI — Wan 2.1/2.2 VRAM by variant](https://willitrunai.com/blog/wan-2-2-vram-requirements)
- [Spheron — Wan 2.2, HunyuanVideo, LTX-2.3 VRAM](https://www.spheron.network/blog/ai-video-generation-gpu-guide/)
- [Wan 2.2 requirements by 8/12/16/24 GB](https://wan27.org/blog/wan-2-2-requirements-guide)
- [HunyuanVideo 1.5 VRAM (FP16/FP8/GGUF)](https://willitrunai.com/blog/hunyuanvideo-1-5-vram-requirements)
- [HunyuanVideo 1.5 low-VRAM GGUF and 5G builds](https://apatero.com/blog/hunyuanvideo-15-low-vram-gguf-5g-complete-guide-2025)
- [HunyuanVideo 1.5 license](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/LICENSE)
- [VentureBeat — LTX-2.5 open weights](https://venturebeat.com/technology/ltx-2-5-can-generate-a-10-second-ai-video-from-an-image-in-just-6-8-seconds-on-nvidia-superchips-and-its-open-weights)
- [LTX-2.5 official weights vs 12/16 GB GPUs](https://note.com/ai_creative_log/n/nd0764eb8f103?hl=en)
- [LTX-2 license and commercial use](https://wavespeed.ai/blog/posts/blog-ltx-2-license-commercial-use/)
- [MiniMax H3 open-weight explainer](https://huggingface.co/blog/ResterChed/minimax-h3-hailuo-3-0)
- [MiniMax H3 open weights, region restrictions](https://comfyui-wiki.com/en/news/2026-08-03-minimax-h3-open-weights-comfyui)
- [Is Wan 3.0 open source](https://www.atlascloud.ai/blog/tips/is-wan-3.0-open-source)
- [Wan 2.7 open-source status](https://localaimaster.com/blog/wan-2-7-open-source)
- [Wan 2.5 open-source status](https://wan27.org/blog/wan-2-5-open-source-guide)
- [Wan-Animate-2 release](https://www.opensourceforu.com/2026/08/alibaba-open-sources-wan-animate-2-real-time-ai-character-animation/)
- [Wan2.2-S2V-14B model card](https://huggingface.co/Wan-AI/Wan2.2-S2V-14B)
- [LingBot-Video MoE 30B-A3B](https://huggingface.co/robbyant/lingbot-video-moe-30b-a3b)
- [LingBot MoE GGUF, 8 GB VRAM RAM-paged](https://huggingface.co/realrebelai/LingBot-30B-3B_GGUF_ComfyUI)
- [LingBot-World 2.0](https://kie.ai/blog/what-is-lingbot-world-2-0)
- [Kandinsky 5.0](https://github.com/kandinskylab/kandinsky-5/)
- [MAGI-1](https://github.com/SandAI-org/MAGI-1)
- [Ovi](https://github.com/character-ai/Ovi) · [Ovi 6 GB community build](https://github.com/character-ai/Ovi/issues/45)
- [SkyReels-V3](https://github.com/SkyworkAI/SkyReels-V3) · [SkyReels V4 status](https://wavespeed.ai/blog/posts/skyreels-v4-review/)
- [Self-Forcing](https://self-forcing.github.io/)
- [Krea Realtime 14B](https://github.com/krea-ai/realtime-video)
- [FramePack at 6 GB](https://www.tomshardware.com/tech-industry/artificial-intelligence/framepack-can-generate-ai-videos-locally-with-just-6gb-of-vram)
- [CogVideoX1.5-5B](https://huggingface.co/zai-org/CogVideoX1.5-5B)
- [Mochi 1 in ComfyUI](https://blog.comfy.org/p/mochi-1)
- [Open-Sora 2.0](https://huggingface.co/hpcai-tech/Open-Sora-v2)
- [Step-Video-T2V](https://github.com/stepfun-ai/Step-Video-T2V)
- [31 open-source video models](https://aifreeforever.com/blog/open-source-ai-video-models-free-tools-to-make-videos)
- [AMD/ROCm status for Wan, LTX, Hunyuan](https://localaimaster.com/blog/local-ai-video-generation)
- Published page (same content, tiered layout): https://claude.ai/code/artifact/a96fb2a4-cb94-4354-bcd2-3ceb586f13c0
