# VidTSX Studio

**AI-powered desktop video studio.** Generate [Remotion](https://www.remotion.dev/) TSX video compositions with AI, create images with local open-source models or cloud providers, transcribe audio/video locally, and render everything to MP4 on your own machine.

Free and open source. Bring your own API keys — no account, no telemetry, no middleman servers. Your keys are stored encrypted on your device (Electron `safeStorage`) and are only ever sent directly to the provider you choose.

## Download

Grab the latest Windows installer from the [Releases page](https://github.com/hassancs91/VidTSX-STUDIO/releases).

> v1 ships a Windows x64 installer. macOS/Linux users can build from source (see below).

## What's inside

### 🪄 TSX Creator
Describe a video and get a working Remotion TSX composition with live preview.

- Works with **Claude (subscription or API key), OpenRouter, OpenAI, Google Gemini, MiniMax, Z.AI (GLM)**, or **any custom OpenAI/Anthropic-compatible endpoint**.
- Up to 4 parallel generation jobs with streaming output.
- Refinement chat per project ("make the title bounce"), AI error fixing, and a props panel that turns your component's props into live-editable controls.
- Full Monaco code editor with auto-save and instant preview refresh.

### 🖼️ Image Studio
Text-to-image, image editing, reference-based generation, and bulk generation.

- **Local open-source models** — run SD 1.5 / SDXL / SD3 / FLUX (GGUF) fully on-device via the bundled `sd-cli` (Vulkan-accelerated, works on NVIDIA/AMD/Intel GPUs). Download models in-app; VRAM fit-checks and automatic CPU offload keep you out of out-of-memory trouble.
- **Cloud providers** — Fal.ai and OpenRouter with your own key.
- Pick the provider per generation from a dropdown; organize results in folders, search by prompt, reuse any image as an edit/reference input.

### 🎙️ Transcribe
Transcribe any audio or video file.

- **Local** — whisper.cpp with any model you download in-app (tiny → large), fully offline.
- **Cloud** — AssemblyAI or OpenRouter (BYOK), including speaker detection on supported models.
- Export SRT, VTT, JSON, or plain text. Transcripts are saved as projects you can reopen.

### 📦 AI Models manager
One screen to manage everything local: system/GPU capability detection, provider API keys, whisper models, and the on-device image model library (folder-as-truth — drop in your own GGUF/safetensors files and they're picked up).

### 🎬 Render queue
Render TSX compositions to MP4 locally through Remotion with a persistent job queue, progress tracking, and desktop notifications.

### Coming soon
**Flows** (node-based AI workflow automation), **Video Studio**, and local **video / 3D / LLM / embedding** model support are visible in the app as previews and land in future releases.

## Requirements

- Windows 10/11 x64.
- For local image generation: a Vulkan-capable GPU is recommended (integrated GPUs work for small models; CPU offload is automatic when VRAM is tight).
- AI features need at least one provider key (or a Claude subscription) — except local image models and local whisper transcription, which run fully offline.

## Build from source

```bash
git clone https://github.com/hassancs91/VidTSX-STUDIO.git
cd VidTSX-STUDIO
npm install
npm run dev        # dev app with hot reload
npm run build:win  # Windows installer (dist/)
npm test           # unit tests
npm run check:types
```

Built with Electron + electron-vite, React 19, TypeScript (strict), Tailwind CSS 4, and Remotion 4. Architecture notes live in [PLAN.md](PLAN.md) and `docs/`.

## License

[MIT](LICENSE) © Hasan Aboul Hasan

<!-- lwh-footer -->

---

## 📘 The free book

This repo is one thing I built with AI. The book is the system underneath it.

**[Vibe Engineering Blocks](https://learnwithhasan.com/blocks/)** is my free 74-page book.
47 building blocks for shipping real apps with AI. One block per page, each with the exact
prompt to hand your AI.

Built by **[Hasan Aboul Hasan](https://learnwithhasan.com)**. I build real products with AI and
write down exactly how.
[Guides](https://learnwithhasan.com/guides/) &nbsp;·&nbsp;
[YouTube](https://www.youtube.com/@HasanAboulHasan) &nbsp;·&nbsp;
[Community](https://learnwithhasan.com/community/)
