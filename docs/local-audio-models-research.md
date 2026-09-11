# Local audio models — research (2026-09-09)

> **Status: research only, nothing implemented.** Planning session with Hasan on 2026-09-09.
> Three web-research passes (STT · TTS/cloning · music/SFX/foley/cleanup), all sources dated
> 2025–2026, cross-checked against what the app already ships. Follows the pattern of
> `docs/local-3d-models-research.md` → `docs/ai-runtime-implementation-plan.md`.
>
> Nothing below has been downloaded or benchmarked on the test box. Figures are from model
> cards, release notes and leaderboards; *est.* marks a number no source stated.

## 0. What the app has today

Three local-inference lanes already exist. Every model below is placed on one of them.

| Lane | What it is | Already in it | Cost of adding a model |
|---|---|---|---|
| **1 · sherpa-onnx** | `sherpa-onnx-node` 1.12.35 (ONNX Runtime, native addon, **CPU only** — npm ships no CUDA build) via `src/audio-engine/` | STT: Whisper tiny→large-v3 int8, Distil-Whisper, SenseVoice, Zipformer/Paraformer streaming. TTS: VITS, MeloTTS, Piper, Kokoro v0.19/v1.0/v1.1, KittenTTS. IPC: `audio:tts:load-model` / `audio:tts:generate` | A catalogue entry in `src/audio-engine/model-registry.ts` + a `modelType` the engine knows. Hours. |
| **2 · standalone binary** | Downloaded at first use through the download engine (sha256, resume, atomic reveal) | whisper.cpp v1.8.3 (`src/main/services/whisper.ts`) | A catalogue entry + a child-process wrapper + output parser. Days (whisper.cpp is the template). |
| **3 · ai-runtime (Python)** | Relocatable Python 3.11 + torch 2.14 stack `2026.09.1` (cu126 4.6 GB / cpu 0.9 GB), model = vendored `resources/pipelines/<id>/runner.py` speaking the JSON-lines protocol | rembg u2net/ISNet, TripoSR. Stack pins: torch, transformers 5.16, onnxruntime 1.29, numpy, safetensors, einops, omegaconf | A runner + a `python-models/registry.ts` entry; **audio needs a stack bump** (torchaudio, soundfile, librosa are not pinned). Days per model, one stack rebuild per wave. |

Product hooks that already exist:
- TTS is only surfaced in **Tools → Voice AI Tester**. It is not reachable from Studio.
- Studio's from-scratch mode prompt says *"if the user supplies a voice-over file, suggest
  transcribing it first to re-enable anchored titles"* — the natural slot for local TTS
  (generate voice-over → transcribe → word-anchored titles).
- Auto-cut needs a **verbatim** transcript with filler words and word timestamps
  (see memory: AssemblyAI is recommended today for that reason).

## 1. Speech-to-text

Leaderboard context (Open ASR Leaderboard, snapshot through ~Mar 2026): the top ten are within
one WER point of each other (ARK-ASR-3B 5.0 … Whisper large-v3 7.4). Licence, timestamps and
runtime now matter more than raw accuracy.

### 1.1 Shortlist by hardware tier

| Tier | Model | Licence | Timestamps | Lane | Why it matters |
|---|---|---|---|---|---|
| CPU-light | **Moonshine v2** tiny/base/medium (Feb 2026) | MIT | no | 1 (exported) | <300 MB, English + "Flavors" monolinguals |
| CPU-light | **Parakeet TDT 0.6B v3** int8 (640 MB) | CC-BY-4.0 | **word, native** | 1 (exported) | 25 European languages, 24-min passes |
| CPU-heavy | **Parakeet TDT 0.6B v2** int8 (1.3 GB) | CC-BY-4.0 | **word, native** | 1 (exported) | WER 6.05 at RTFx 3386 — best WER-per-watt; a vendor page claims it keeps "um/uh" (**unverified**) |
| CPU-heavy | Whisper large-v3-turbo q5/q8 (~2 GB) | MIT | DTW (needs re-export for sherpa) | 2 (have) / 1 | 99-language fallback; drops fillers by design |
| CPU-heavy | Distil-Whisper large-v3.5 | MIT | as Whisper | 1 / 2 | EN short-form 7.08, 1.5× faster than turbo |
| CPU-heavy | Nemotron 3.5 ASR streaming 0.6B (Jun 2026) | OpenMDW-1.1 | streaming | 1 (exported Aug 2026) | 40 locales live captions; polishes fillers away |
| CPU-heavy | Qwen3-ASR 0.6B int8 | Apache-2.0 | no | 1 (exported) | 52 languages |
| GPU 4 GB | Qwen3-ForcedAligner-0.6B (Jan 2026) | Apache-2.0 | **aligns any text** | 3 | word timestamps for a hand-corrected verbatim transcript, ≤5 min chunks, 11 langs |
| GPU 4 GB | torchaudio MMS_FA aligner | MIT/CC-BY | aligns any text | 3-cpu ok | 1100+ languages, romanised text only |
| GPU 8 GB | **Qwen3-ASR 1.7B** | Apache-2.0 | via aligner | 3 | WER 5.76, 52 langs, no flash-attn needed since Jun 2026 |
| GPU 8 GB | Granite Speech 4.1 2B-Plus (Apr 2026) | Apache-2.0 | word + speaker tags | 3 | en/fr/de/es/pt, 3.5-min timestamp window |
| GPU 8 GB | MOSS-Transcribe-Diarize 0.9B | Apache-2.0 | word + speaker | 3 | 50+ langs, 90 min single pass — worth an eval |
| GPU 8 GB | CrisperWhisper 2.0 (Jul 2026) | **non-commercial** | 30 ms boundaries, disfluency F1 87.8 | 3 | the only model built for verbatim; needs a paid Nyra licence |
| GPU 12+ | Canary-Qwen 2.5B, ARK-ASR-3B, Kyutai STT 2.6B, Voxtral Realtime 4B (vLLM only) | mixed | mostly none | 3 | no desktop reason to pick them |

Diarization: sherpa-onnx pyannote-seg-3.0 + 3D-Speaker (45 MB, CPU, Lane 1, ungated) now;
pyannote community-1 (CC-BY, **gated HF download**) as the quality option; NVIDIA Sortformer v1
exports to ONNX.

### 1.2 What actually helps auto-cut

1. **Decouple recognition from timing.** Transcribe with the most verbatim recogniser, then
   force-align (Qwen3-ForcedAligner or MMS_FA). Aligners time whatever text they are given, so a
   user's manual "um" insertions get timestamps, and dropped fillers stop shifting neighbours.
2. **A/B Parakeet v2 vs Whisper on real footage** for filler retention before designing around
   either. TDT/RNNT models and Canary-Qwen are trained on more verbatim data; Whisper and
   Kyutai (Whisper pseudo-labels) drop fillers.
3. Pause boundaries from **VAD** (Silero / TEN in Lane 1), not from ASR guesses.
4. Speaker-aware cuts from pyannote community-1's exclusive-diarization output or a joint model
   (Granite-Plus, MOSS-Diarize).
5. CrisperWhisper is the ceiling; if auto-cut is a differentiator, price the licence.

## 2. Text-to-speech and voice cloning

Arena context (Artificial Analysis, Sep 2026): open ladder is Breeze TTS 2 (NC) 1215 › Fish S2
Pro (NC) 1128 › **Step-Audio-EditX (Apache) 1105** › Voxtral TTS (NC) 1078 › **Kokoro 82M
1060** › Maya1 1053 › Chatterbox 1006 › Zonos 1000 › OpenVoice v2 950 › XTTS v2 886.
Kokoro is the only tiny model in the top open tier.

**Big finding:** sherpa-onnx v1.13.7 (1 Sep 2026) has seven TTS families and **two zero-shot
voice-cloning models already exported: Pocket TTS and ZipVoice.** Cloning can land as catalogue
entries.

### 2.1 Shortlist by hardware tier

| Tier | Model | Licence | Cloning | Langs | Lane | Notes |
|---|---|---|---|---|---|---|
| CPU-light | **Kokoro-82M v1.0 / v1.1-zh** | Apache-2.0 | no (54+100 voices) | 8 | 1 (**have**) | keep as default narrator; RTF ~0.5 CPU |
| CPU-light | **Pocket TTS** (Kyutai, Jan–Apr 2026) | code MIT, weights CC-BY-4.0, cloning weights gated w/ consent pledge (auto-approved) | **yes, few seconds, no transcript** | en fr de pt it es | 1 (exported) | 100 M, ~6× realtime CPU, streaming, unlimited length; sherpa quality delta reported (issue #3180) |
| CPU-light | **ZipVoice-Distill** int8 | Apache-2.0 | **yes, <3 s + transcript** | zh en | 1 (exported) | k2-fsa's own model |
| CPU-light | **Supertonic 3** (Apr 2026) | weights OpenRAIL-M, code MIT | no | 31 | 1 (exported) | 99 M, up to 167× realtime, own frontend (no espeak) |
| CPU-light | KittenTTS nano/micro/mini | Apache-2.0 | no | en | 1 (have nano) | |
| CPU-heavy | **Qwen3-TTS 0.6B** Q4 (629 MB) | Apache-2.0 | yes, 3 s | 10 | 2 (**qwentts.cpp** or llama.cpp `llama-tts`, merged Aug 2026) | CPU/CUDA/Vulkan; VoiceDesign from text; OpenAI-compatible server |
| CPU-heavy | Chatterbox Nano 110 M | MIT | yes, ≥10 s | en | 3 | 3× realtime CPU; watermark always on |
| CPU-heavy | NeuTTS Air (GGUF) | Apache-2.0 | yes, 3–15 s | en | 2/3 | needs system espeak-ng |
| CPU-heavy | Chatterbox-Turbo ONNX q4 | MIT | yes | en | 3 (ORT, no torch) | official ONNX graphs |
| GPU 4 GB | **Qwen3-TTS 1.7B** Q8 | Apache-2.0 | yes | 10 | 2 | quality-cloning without Python |
| GPU 4 GB | **OmniVoice** (k2-fsa, Mar 2026) | Apache-2.0 | yes, 3–10 s | **600+** | 3 | 613 M, 1.3–4 GB VRAM; same team as sherpa — ONNX plausible later |
| GPU 4 GB | Fun-CosyVoice3-0.5B, VoxCPM-0.5B, Kani-TTS-2 | Apache-2.0 | yes | 9 / 2 / 2 | 3 | alternatives; CosyVoice vendors Matcha |
| GPU 8 GB | **Chatterbox Multilingual v3** (Jun 2026) | MIT | yes, 5–10 s | 25 | 3 | most production-tested open cloner; `[laugh]` tags |
| GPU 8 GB | IndexTTS-2.5 0.8B (Aug 2026) | bilibili licence (free < 100 M MAU) | yes + emotion vectors | 5 | 3 | disable its optional DeepSpeed/CUDA kernels |
| GPU 8 GB | Dia2, VoxCPM2, GLM-TTS, Maya1, Zonos v0.1 (transformer) | Apache/MIT | mixed | | 3 | niche |
| GPU 12+ | **Step-Audio-EditX** 3 B | Apache-2.0 | yes + **emotion editing of existing takes** | 4 | 3 | best Apache model on the arena; wants Python 3.12 / torch 2.9 — conflicts with our 3.11 stack |
| GPU 12+ | ZONOS2, Higgs Audio v2 (community licence, 100 k AAU cap), VibeVoice 7B | mixed | | | 3 | ZONOS2 hybrid needs mamba-ssm/triton |

### 2.2 Voice conversion (change the voice of an existing recording)

| Tool | Licence | Type | Lane | Notes |
|---|---|---|---|---|
| **RVC / Applio** | MIT | trained per voice, ONNX export official | 3-cpu / ORT | de-facto standard; training out of scope at first |
| **Seed-VC V2** | **GPL-3.0** | zero-shot, 1–30 s ref, 200 M, 4 GB | isolated process only | best zero-shot VC per GB; singing variant |
| OpenVoice V2 | MIT | zero-shot tone colour | 3 | dated, permissive fallback |
| Step-Audio-EditX | Apache-2.0 | emotion/style editing, not timbre | 3 | see above |

### 2.3 Excluded on licence
XTTS-v2 (CPML, Coqui defunct), F5-TTS / E2 weights (CC-BY-NC), LLaSA, Spark-TTS, OuteTTS,
Voxtral TTS (CC-BY-NC), Fish Speech 1.5 / OpenAudio S1 / S2 (research licence), Breeze TTS 2,
Higgs TTS 2/3, NVIDIA Magpie (contradictory terms), Kyutai TTS 1.6B (cloning encoder never
released), piper1-gpl runtime (GPL — keep using Piper voices through sherpa-onnx).

## 3. Music generation

| Tier | Model | Licence | Lane | Notes |
|---|---|---|---|---|
| CPU-heavy / GPU 6–8 | **ACE-Step 1.5** 2B turbo (Jan 2026) | **MIT** | 2 via **acestep.cpp** (GGUF ~3.5 GB, Windows prebuilt, CPU/CUDA/**Vulkan**) | 48 kHz stereo, lyrics + vocals, 10 s–10 min, <10 s/song on a 3090, 8–12 min on a 3060; CPU unbenchmarked |
| GPU 8 GB | SongBloom 2B | Apache-2.0 | 3 | 150 s songs, 10 s audio prompt, 6 GB bf16 |
| GPU 8 GB | DiffRhythm 2 | Apache-2.0 | 3 | 4-min song in 62 s; needs espeak-ng MSI |
| GPU 12+ | ACE-Step 1.5 XL 4B | MIT | 2/3 | ≥12 GB with offload |
| GPU 12+ | Magenta RealTime 2 | weights CC-BY-4.0 | 3 | streaming "endless bed music", JAX-first |
| GPU 16+ | HeartMuLa-oss-3B, SongGeneration 2 (custom Tencent terms), YuE 7B (24–80 GB) | | 3 | out of consumer range |

Excluded: MusicGen / AudioGen / JASCO (weights CC-BY-NC), Stable Audio Open (gated + $1M
revenue cap, and "not able to generate realistic vocals").

## 4. Sound effects and video-to-audio (foley)

| Tier | Model | Licence | Lane | Notes |
|---|---|---|---|---|
| GPU 8 GB | **MOSS-SoundEffect v2** (May 2026) | Apache-2.0 | 3 | 48 kHz, ≤30 s, en+zh prompts; wants Python 3.12 + torch.compile/Triton — must bench eager mode on 3.11 |
| CPU-heavy | Stable Audio Open Small 341 M | Stability community (<$1M revenue, gated HF) | 3 | 11 s clips, tuned for Arm; x86 CPU reports of minutes/hangs |
| GPU 4–8 GB | **HunyuanVideo-Foley XL** (fp8 / offload) | Tencent community: commercial < 100 M MAU, **void in EU/UK/South Korea** | 3 | top-tier sync + 48 kHz; region question |
| GPU 8 GB | ThinkSound 1.3B | Apache-2.0 + **Stability VAE** licence | 3 | Windows `.bat` exists; the VAE inherits the $1M cap |
| GPU 12+ | Foley-Omni 5.5B (Jun 2026) | MIT | 3 | pinned flash-attn 2.7.4 — Windows hazard; weights partly unreleased |

Excluded: MMAudio (best small foley model, weights CC-BY-NC), AudioX, AudioLDM 2, TangoFlux
(Stability + WavCaps NC), PrismAudio (contradictory README), LTX-2.3 Foley LoRA (22B).

## 5. Cleanup, separation and utilities

| Tier | Model | Task | Licence | Lane |
|---|---|---|---|---|
| CPU-light | **DPDFNet 48 kHz HR** (10 MB) | dialogue denoise | Apache-2.0 | 1 (exported) |
| CPU-light | GTCRN (16 kHz) | denoise for STT | MIT (verify) | 1 (exported) |
| CPU-light | **DeepFilterNet3 ONNX** | denoise 48 kHz, RTF 0.19 | MIT | 2 (onnxruntime-node + our STFT/ERB DSP) |
| CPU-light | Silero VAD v6.2, CED tagging, 3D-Speaker | VAD / events / speaker ID | MIT / Apache | 1 (exported) |
| CPU-light | **Beat This!** ONNX (97 MB) | beats + downbeats for beat-synced cuts | MIT | 2 |
| CPU-light | Spleeter 2-stem | vocal/accompaniment, RTF 0.08 | MIT | 1 (exported) |
| CPU-heavy | **UVR MDX-Net** (17 models: Kim_Vocal_2, Inst_HQ_3 …) | vocal/instrument, RTF ~0.65 | MIT GUI; verify each checkpoint | 1 (exported) |
| CPU-heavy | Demucs htdemucs / 6s | 4–6 stems, 1.5× duration CPU | MIT (repo archived, pin fork) | 2 (ONNX) / 3 |
| GPU 4 GB | **Mel-Band RoFormer Kim vocal** | best-SDR dialogue isolation | MIT since 22 Apr 2026 | 3 (`python-audio-separator`) |
| GPU 4 GB | Resemble Enhance | restore + bandwidth extension | MIT | 3 |
| GPU 8 GB | **ClearerVoice MossFormer2 SE/SR 48k** | enhance + super-resolution | Apache-2.0 | 3 |
| GPU 8 GB | SAM Audio (Meta, Dec 2025) | "remove that sound" prompted separation | bespoke SAM licence, gated | 3 — watch |

Avoid: madmom (models CC-BY-NC-SA), essentia (AGPL).

## 6. Everything on one hardware ladder (recommended picks only)

| Tier | STT | TTS / clone | Music | SFX / foley | Cleanup |
|---|---|---|---|---|---|
| **CPU-light (<2 GB)** | Moonshine v2, Parakeet v3 int8 | Kokoro (have), Pocket TTS (clone), ZipVoice (clone), Supertonic 3 | — | — | DPDFNet, DeepFilterNet3, VAD, Beat This!, Spleeter |
| **CPU-heavy (2–8 GB RAM)** | Parakeet v2 int8, Whisper turbo (have) | Qwen3-TTS 0.6B GGUF, Chatterbox Nano | ACE-Step via acestep.cpp (slow) | — | UVR MDX-Net, Demucs |
| **GPU 4 GB** (the test box) | + Qwen3-ForcedAligner | Qwen3-TTS 1.7B GGUF, OmniVoice | ACE-Step turbo (offload) | Hunyuan-Foley XL fp8 (region q.) | RoFormer Kim, Resemble Enhance |
| **GPU 8 GB** | Qwen3-ASR 1.7B, Granite 2B-Plus | Chatterbox Multilingual v3, IndexTTS-2.5 | ACE-Step turbo + LM, SongBloom, DiffRhythm 2 | MOSS-SoundEffect v2, ThinkSound | MossFormer2 SE/SR |
| **GPU 12+ GB** | Canary-Qwen (no ts) | Step-Audio-EditX | ACE-Step XL, Magenta RT2 | Foley-Omni | — |

## 7. Proposed ship order (for discussion)

**Wave 1 — Lane 1 only, CPU, every user.** Bump `sherpa-onnx-node` 1.12.35 → 1.13.7 (needs
new `modelType`s: parakeet/transducer offline, pocket-tts, zipvoice, supertonic, speech
enhancement, source separation APIs). Add: Parakeet TDT v2 + v3, Moonshine v2, Pocket TTS +
ZipVoice (first cloning), Supertonic 3, DPDFNet denoise, UVR MDX vocal isolation, diarization.
Product work: surface TTS in Studio (voice-over generation → transcribe → anchored titles),
a "Clean dialogue" action, a "Voice clone from this clip" flow with the consent pledge.
Attribution panel for CC-BY (Parakeet, Pocket TTS) and OpenRAIL (Supertonic).

**Wave 2 — Lane 2 binaries, GPU-optional via Vulkan.** `qwentts.cpp` (Qwen3-TTS 0.6B/1.7B:
10-language cloning + voice design) and `acestep.cpp` (music with vocals). Both are whisper.cpp-
shaped integrations (download zip + GGUF, spawn, parse). DeepFilterNet3 + Beat This! through
`onnxruntime-node` for beat-synced cuts and better denoise.

**Wave 3 — Lane 3, stack `2026.10` (adds torchaudio, soundfile, librosa, audio-separator).**
Qwen3-ASR 1.7B + ForcedAligner (verbatim + timestamps "pro" preset), Chatterbox Multilingual v3
or OmniVoice (hero cloner), Mel-Band RoFormer + ClearerVoice (restore tier), MOSS-SoundEffect v2
(after an eager-mode bench), one foley model once the licence question is settled.

## 8. Decisions for Hasan

1. **Foley licence stance.** Hunyuan (commercial OK, but void in EU/UK/KR) vs ThinkSound
   (Apache + Stability VAE, $1M cap) vs no foley until a clean model appears. MMAudio is NC.
2. **Stability community licence.** Accept the $1M-revenue cap + gated download (breaks
   anonymous first-use download) for Stable Audio Open Small / ThinkSound, or exclude Stability
   entirely.
3. **CrisperWhisper.** Price a commercial licence if verbatim auto-cut is the differentiator,
   or go permissive: Parakeet/Qwen3-ASR + forced aligner (needs the A/B in §1.2).
4. **GPL at arm's length.** Seed-VC (zero-shot voice conversion) only as an isolated
   downloaded process. Yes/no.
5. **Lane 1 stays CPU.** No CUDA npm addon exists; building one is our work. Accept that
   sherpa models are CPU (they are all sized for it), GPU goes through Lanes 2/3.
6. **Python 3.12 pressure.** Step-Audio-EditX and MOSS-SoundEffect want 3.12; our stack is
   3.11. Either bench them on 3.11 or plan the 3.12 stack line.
7. **Wave order** as in §7, or pull Wave 2's Qwen3-TTS forward if cloning quality matters
   more than zero-engineering.

## 9. Verify before committing (on the test box, GTX 1650 Ti 4 GB)

- Parakeet v2 filler retention vs Whisper on raw footage.
- Pocket TTS quality through sherpa int8 vs the PyTorch original (issue #3180).
- acestep.cpp CPU and Vulkan speed for a 60 s clip; qwentts.cpp 0.6B Q4 RTF on CPU.
- MOSS-SoundEffect eager mode (no Triton) on Windows.
- UVR Kim_Vocal_2 and DPDFNet on a noisy dialogue clip; DeepFilterNet3 with our own DSP wrapper.
- Checkpoint licences for the UVR MDX models bundled by sherpa-onnx.

## 10. Session notes (2026-09-09 → 2026-09-11)

What was discussed with Hasan, in order, so the reasoning survives the session:

1. **Goal stated by Hasan:** launch with more local audio models, not only STT but TTS as
   well, and survey everything open-source that runs locally: STT, TTS, audio generation,
   music and SFX generation, voice cloning. Sort by hardware requirement, name the easiest
   integration path. No implementation this session.
2. **App-side audit first.** Found that TTS already exists in the sherpa-onnx engine (Kokoro,
   Piper, MeloTTS, VITS, KittenTTS) with IPC channels, but is only reachable from Tools →
   Voice AI Tester. Studio's from-scratch prompt already anticipates a user-supplied voice-over
   file, which is where local TTS slots in. The Python stack has no audio pins yet.
3. **Three parallel web-research passes** (STT · TTS/cloning · music/SFX/foley/cleanup),
   sources 2025–2026. Results are §1–§5; the combined ladder is §6.
4. **Hasan asked whether these are all available today.** Answer: yes, all are published open
   weights as of 2026-09-09, verified by date. The distinction that matters is available vs
   shippable: CrisperWhisper is non-commercial, pyannote community-1 is gated, Voxtral has no
   Windows desktop path. One claim is unverified (Parakeet keeps fillers — vendor page only).
   Nothing has been downloaded or run.
5. **Key findings that changed the plan:**
   - sherpa-onnx 1.13.7 turns most of the CPU list, including two voice-cloning models, into
     catalogue entries. Wave 1 is a version bump plus product work, not a new runtime.
   - The verbatim-transcript problem for auto-cut is a licence problem, not a model problem:
     the permissive route is recogniser + forced aligner.
   - Two C++ runtimes (qwentts.cpp, acestep.cpp) give GPU-optional cloning and music through
     the whisper.cpp-shaped lane, with Vulkan for AMD/Intel.
   - Foley has no clean commercial option: Hunyuan is region-limited, ThinkSound inherits the
     Stability cap, MMAudio is non-commercial.
6. **Pending:** the seven decisions in §8 and the §9 verifications. No wave has been approved.
7. Two teammate sessions held dev port 9222 during this session (export-engine gates);
   any §9 verification runs go through the second-instance recipe on port 9223.

## 11. Sources

STT: https://huggingface.co/blog/open-asr-leaderboard · https://github.com/k2-fsa/sherpa-onnx/releases ·
https://github.com/k2-fsa/sherpa-onnx/blob/master/nodejs-addon-examples/README.md ·
https://github.com/k2-fsa/sherpa-onnx/pull/2945 · https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2 ·
https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 · https://huggingface.co/nyralabs/CrisperWhisper2.0_large ·
https://github.com/QwenLM/Qwen3-ASR · https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B ·
https://huggingface.co/ibm-granite/granite-speech-4.1-2b-plus · https://github.com/OpenMOSS/MOSS-Transcribe-Diarize ·
https://arxiv.org/abs/2602.12241 · https://huggingface.co/pyannote/speaker-diarization-community-1 ·
https://www.marktechpost.com/2026/07/23/best-open-speech-recognition-asr-models-in-2026-wer-languages-latency-and-license-compared/

TTS / VC: https://github.com/k2-fsa/sherpa-onnx · https://github.com/kyutai-labs/pocket-tts ·
https://github.com/k2-fsa/ZipVoice · https://huggingface.co/Supertone/supertonic-3 · https://github.com/QwenLM/Qwen3-TTS ·
https://github.com/ServeurpersoCom/qwentts.cpp · https://github.com/ggml-org/llama.cpp/pull/26254 ·
https://github.com/k2-fsa/OmniVoice · https://github.com/resemble-ai/chatterbox · https://huggingface.co/ResembleAI/chatterbox-turbo-ONNX ·
https://github.com/index-tts/index-tts · https://github.com/stepfun-ai/Step-Audio-EditX · https://github.com/Plachtaa/seed-vc ·
https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI · https://artificialanalysis.ai/text-to-speech/leaderboard ·
https://github.com/OHF-Voice/piper1-gpl

Music / SFX / foley / cleanup: https://github.com/ace-step/ACE-Step-1.5 · https://github.com/ServeurpersoCom/acestep.cpp ·
https://github.com/tencent-ailab/SongBloom · https://github.com/ASLP-lab/DiffRhythm2 · https://huggingface.co/google/magenta-realtime-2 ·
https://huggingface.co/OpenMOSS-Team/MOSS-SoundEffect-v2.0 · https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley ·
https://github.com/FunAudioLLM/ThinkSound · https://github.com/hkchengrex/MMAudio · https://github.com/NJU-Speech/Foley-Omni ·
https://github.com/ceva-ip/DPDFNet · https://huggingface.co/soniqo/DeepFilterNet3-ONNX · https://github.com/modelscope/ClearerVoice-Studio ·
https://k2-fsa.github.io/sherpa/onnx/source-separation/models.html · https://github.com/nomadkaraoke/python-audio-separator ·
https://github.com/facebookresearch/sam-audio · https://github.com/mosynthkey/beat_this_cpp · https://stability.ai/license
