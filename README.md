# VidTSX Studio

**AI-powered desktop video studio.** Edit talking-head footage with an AI assistant, generate [Remotion](https://www.remotion.dev/) TSX compositions, images and video clips with local models or cloud providers, transcribe locally, and render everything to MP4 on your own machine.

Free and source-available. Bring your own API keys — no account, no middleman servers, and no telemetry by default. The only optional exception is [opt-in crash reporting](#crash-reporting-opt-in), which is off until you enable it. Your keys are stored locally on your device — encrypted at rest with the OS keystore (Windows DPAPI) when available — and are only ever sent directly to the provider you choose.

## Download

Grab the latest Windows installer from the [Releases page](https://github.com/hassancs91/VidTSX-STUDIO/releases).

> v1 ships a Windows x64 installer. macOS/Linux users can build from source (see below).
> The installer is not code-signed yet, so Windows SmartScreen shows a warning on first launch: choose **More info**, then **Run anyway**.

## What's inside

### 🎞️ Studio
An AI-assisted video editor for talking-head footage, long or short, horizontal or vertical.

- Import your clips (4K HEVC included — edits run on proxies), transcribe them (AssemblyAI, ElevenLabs or local whisper), and **Auto Cut** silences, retakes and fillers into a normal, hand-editable timeline (split, trim, ripple, undo).
- An editing **assistant** in the project: "Edit this video end to end" transcribes, cuts, proposes TSX shots and b-roll, turns captions on and queues the export — every change arrives as a card you accept or reject.
- **Brands** (colours, fonts, vocabulary the transcriber is primed with), **editing presets** (a playbook per kind of video that learns from how you cut), word-synced **captions**, per-clip **transitions and filters** with importable packs, and a `.vidtsx` project package for moving an edit between machines.
- Export with the Standard engine (every frame rendered through Remotion, exactly as previewed) or the Fast engine, which copies untouched footage straight from the source files and renders only the edited parts.

### 🪄 TSX Creator
Describe a video and get a working Remotion TSX composition with live preview.

- Three modes: **Prompt** (describe it), **Agent** (a session that plans, builds and revises the composition with you), and **Templates** (ten ready-made compositions with a form instead of a prompt, including transparent overlays).
- Works with **Claude (subscription or API key) and OpenRouter (300+ models)**, and you pick the model, not just the provider. More providers return in a future release.
- Up to 4 parallel generation jobs with streaming output, refinement chat per project ("make the title bounce"), AI error fixing, and a props panel that turns your component's props into live-editable controls.
- Full Monaco code editor with auto-save and instant preview refresh.

### 🤖 Agents
Installable agents that take a brief to a finished result inside the app.

- Five built-ins: **Assistant**, **Motion Post** (a one-line brief to a rendered social video), **TSX Composer**, **Web Designer**, and **Flow Builder**.
- Every agent works with your brands, files its outputs into the asset library, and logs what it spent. Drop a `.vidtsxagent` package onto the app to install more.

### 🔀 Flows
Node-based recipes you run yourself or hand to an agent.

- Five built-ins (a 30-second explainer, a product ad, a thumbnail, a frame strip, add an effect) and an editor for your own.
- Nodes for LLM calls, image, video and audio generation, transcription and agents; a run pauses for your input where the flow says so. `.vidtsxflow` packages import with a double-click.

### 🖼️ Images
Text-to-image, image editing, reference-based generation, bulk generation, and background removal.

- **Local open-source models** — run SD 1.5 / SDXL / SD3 / FLUX (GGUF) fully on-device via the bundled `sd-cli` (Vulkan-accelerated, works on NVIDIA/AMD/Intel GPUs). The model library is folder-as-truth: download in-app or drop in your own files. VRAM fit-checks and automatic CPU offload keep you out of out-of-memory trouble.
- **Cloud providers** — Fal, BytePlus ModelArk (Seedream), OpenRouter and Cloudflare Workers AI with your own key, plus the Google and OpenAI CLI subscriptions if you have them. Per-model parameters (steps, guidance, seed) where the model supports them.
- Pick the provider per generation; organize results in folders, search by prompt, reuse any image as an edit/reference input.

### 🎬 Videos
Generate clips from text, an image, or a reference video.

- **Cloud** — Seedance on Fal or BytePlus ModelArk with your own key, priced per clip before you run it.
- **Local** — Wan through the same on-device runtime as images, fully offline (slow on small GPUs, but it works).
- Every generated clip is checked by the content-safety gate before it is filed.

### 🎙️ Transcribe
Transcribe any audio or video file.

- **Local** — whisper.cpp with any model you download in-app (tiny → large), fully offline.
- **Cloud** — AssemblyAI, ElevenLabs or OpenRouter (BYOK), including speaker detection on supported models.
- Export SRT, VTT, JSON, or plain text. Transcripts are saved as projects you can reopen.

### 🧊 3D
Turn an image into a 3D model with an optional local AI runtime, downloaded on first use and checked against your GPU before it starts.

### 📁 Assets, 📦 AI Models, 🎬 Queue
- **Assets** — one library for brands, editing presets, generated images, videos and audio, and everything the agents make.
- **AI Models** — provider keys, the local model library (images, video, whisper), the optional AI runtime, system/GPU detection, and a usage dashboard with cost per request.
- **Queue** — render TSX compositions to MP4 locally through Remotion with a persistent job queue, progress tracking, and desktop notifications.

### In the code, not yet switched on
Text-based editing (edit the video by editing its transcript), local LLM and embedding models, and the MiniMax, Kimi, Z.AI, OpenAI and Gemini providers are built and hidden behind flags until they have had a proper testing pass.

## Requirements

- Windows 10/11 x64.
- For local image generation: a Vulkan-capable GPU is recommended (integrated GPUs work for small models; CPU offload is automatic when VRAM is tight). Local video and 3D want more VRAM; the AI Models screen checks the fit before anything downloads.
- AI features need at least one provider key (or a Claude subscription) — except local image, video and 3D models and local whisper transcription, which run fully offline.

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

Built with Electron + electron-vite, React 19, TypeScript (strict), Tailwind CSS 4, and Remotion 4. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and [SECURITY.md](SECURITY.md) to report a vulnerability.

## Launch-time network requests

On launch the app makes two plain GET requests, neither carrying any user data: an update check against this repo's GitHub releases, and a fetch of `vidtsx.com/app/feed.json` to show in-app announcements (dismissible; turn off entirely in **Settings → Privacy → Show news and announcements**). Beyond these, the app only reaches the network for AI providers you configure with your own keys and for first-use binary/model downloads.

## Crash reporting (opt-in)

The app can send crash and error reports to [Sentry](https://sentry.io) to help fix bugs — but only if you say yes. It is **off by default**: the app asks once on first launch, and you can change your answer anytime in **Settings → Privacy → Send crash reports**. Nothing is ever sent without that consent.

What a report contains: stack trace, app version, OS, and the module that logged the error. What it never contains: your prompts, project files, transcripts, or API keys. Filesystem paths are scrubbed of usernames before sending.

The reporting endpoint (DSN) is baked in at build time via the `VITE_SENTRY_DSN` environment variable. If you build from source without setting it — the default — crash reporting is compiled out entirely and the toggle shows as unavailable: the app cannot send anything, opt-in or not.

## License

VidTSX Studio is **free and source-available** under the
[Functional Source License, FSL-1.1-MIT](LICENSE.md) © Hasan Aboul Hasan.

In plain words: use it, modify it, fork it — including for commercial video
work — freely. The one thing you may not do is offer the software itself (or a
substantially similar product) as a competing product or service. **Each
release automatically becomes MIT open source two years after it ships**, so
everything here is permanently headed for full open source.

> Why not "open source"? FSL is not an OSI-approved license, so we don't use
> the term. It is [fair source](https://fair.io) — the same model used by
> Sentry and GitButler.

### A note on Remotion

VidTSX Studio is free, but the [Remotion](https://www.remotion.dev/) engine it
renders with has its own license: free for individuals and companies of up to
3 people; larger companies need a
[Remotion company license](https://www.remotion.dev/license). Remotion
licenses the *user* of the software, so this applies to you as the person
rendering videos, not just to us as developers.

<!-- lwh-footer -->

---

## 📘 The free book

This repo is one thing I built with AI. The book is the system underneath it.

**[Vibe Engineering Blocks](https://learnwithhasan.com/blocks/?utm_source=github&utm_medium=readme&utm_campaign=VidTSX-STUDIO&utm_content=footer)** is my free 74-page book.
47 building blocks for shipping real apps with AI. One block per page, each with the exact
prompt to hand your AI.

Built by **[Hasan Aboul Hasan](https://learnwithhasan.com/?utm_source=github&utm_medium=readme&utm_campaign=VidTSX-STUDIO&utm_content=footer)**. I build real products with AI and
write down exactly how.
[Guides](https://learnwithhasan.com/guides/?utm_source=github&utm_medium=readme&utm_campaign=VidTSX-STUDIO&utm_content=footer) &nbsp;·&nbsp;
[YouTube](https://www.youtube.com/@HasanAboulHasan) &nbsp;·&nbsp;
[Community](https://learnwithhasan.com/community/?utm_source=github&utm_medium=readme&utm_campaign=VidTSX-STUDIO&utm_content=footer)
