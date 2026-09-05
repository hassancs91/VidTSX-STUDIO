# GPU Cloud Testing Plan — local image models on rented hardware

> **Status: PARKED (2026-08-23).** Agreed to revisit after all V1 features are
> finished. Nothing here is implemented; this doc captures the research and the
> agreed approach so a future session can start immediately.

## Goal

Test the local image engine (sd-cli / stable-diffusion.cpp) on real GPUs we
don't own, rented **hourly** — no monthly GPU VPS. Later, automate the whole
test pipeline via provider APIs.

## Key constraint discovered

Our local image engine spawns `sd-cli.exe` — the official
**Windows Vulkan** build of stable-diffusion.cpp — and the in-app installer
explicitly refuses non-Windows (`src/main/services/sdcli-install.ts`, ~line 53).
So the meaningful end-to-end test needs a **Windows** machine with a GPU.

**DigitalOcean GPU Droplets are ruled out**: Linux (Ubuntu) only, no Windows
option, and pricier than alternatives (~$0.76–$1.57+/GPU/hr, H100 ~$3.39/hr).

## Chosen approach — Windows GPU VMs by the hour

| Provider | Why | Price point (Aug 2026) |
|---|---|---|
| **TensorDock** (primary) | Windows 10 template + RDP; cheap; full REST API | RTX 4090 24GB ~**$0.37/hr** on-demand (~$0.20 spot — don't use spot, tests get preempted) |
| **Paperspace** (fallback) | Owned by DigitalOcean; Windows templates, hourly, 1-hr minimum; `pspace` CLI + API | Pricier than TensorDock |

Two-tier test matrix (just two API calls with different GPU params):

- **24 GB card (4090)** — validate the big models (Flux etc.).
- **8–12 GB card** — validate VRAM-fit / fallback behavior; this is what most
  users actually have.

### Manual workflow (first sessions)

1. Spin up Windows 10 VM with GPU, RDP in.
2. Install Node + git; either clone repo + `npm install --legacy-peer-deps` +
   `npm run dev`, or (better) copy over a `npm run build:win` installer —
   exercises the packaged-app path too.
3. Run the real user flows: in-app sd-cli install, model downloads, generation
   via the Image AI Tester screen.
4. First thing on any new host: verify the driver exposes **Vulkan**
   (`vulkaninfo` or sd-cli device enumeration). Consumer-GPU hosts (4090)
   generally fine; datacenter GPUs with GRID drivers occasionally have quirks.
5. **Destroy** (not stop) the instance when done — stopped machines still bill
   storage; on DO, stopped droplets bill fully.

## macOS

Separate track, two twists:

1. **Product gap:** Mac local-image support is unimplemented by design
   (installer throws on darwin). stable-diffusion.cpp has a **Metal** backend
   that runs well on Apple Silicon (unified memory ⇒ even base M-series loads
   big models). Mac support = pin/build a macOS arm64 sd-cli (likely build +
   sign/notarize ourselves — Gatekeeper quarantines unsigned downloads; same
   concern as `mac-check.md` documents for sherpa-onnx), add the darwin branch
   to the installer, and rethink VRAM-fit for unified memory.
2. **No hourly Macs exist:** Apple licensing forces a **24-hour minimum lease**
   at every provider. Cheapest: **Scaleway** Apple Silicon (M1/M2/M4 minis)
   from ~€0.11/hr ⇒ a mandatory full day ≈ €3. AWS EC2 Mac: $0.65–1.20/hr, same
   24h floor. Access = SSH + VNC/Screen Sharing.
   ⇒ Do Mac testing in occasional **day-long batches**, not hourly. A rented
   M4 mini is exactly the hardware a real Mac user has, so it's representative.

## Automation (phase 2)

All three providers have APIs, so the full pipeline can be scripted:

- **TensorDock:** REST API (deploy/start/stop/delete). Docs:
  https://dashboard.tensordock.com/api/docs (instance creation:
  /api/docs/instance-creation). API key from their console.
- **Paperspace:** `pspace machine create` + DO-hosted REST API. NOTE: the
  *legacy* Core API was deprecated July 2024 — use the new DO-integrated
  tooling only. https://docs.digitalocean.com/reference/paperspace/core/
- **Scaleway:** API covers the Apple Silicon minis too (nightly Mac batch is
  scriptable, within the 24h-minimum billing).

Pipeline sketch (per run, ~$1 at 4090 rates):

1. **One-time:** provision base Windows VM → install Node/git + OpenSSH server
   → save as **custom disk image** so later boots are test-ready in minutes.
2. Script (PowerShell/Node) calls provider API → boot VM from image → wait for
   SSH → push latest `build:win` installer (or pull repo).
3. Launch the app with a CDP debugging port and drive the real UI —
   the recipe already exists: `docs/ui-automation-cdp.md`.
4. Pull back generated images, logs, screenshots → **destroy VM**.

Security notes:

- Provider API key lives in a local `.env` / CI secret. Never in the repo,
  never in the app bundle (CLAUDE.md no-embedded-credentials rule).
- Use on-demand instances, not spot (preemption kills mid-render tests).

## When we pick this up

1. Hasan creates a TensorDock account, puts the API key in an env var.
2. Build the provisioning script + CDP test driver around it.
3. First manual session on a 4090 to shake out the workflow, then automate.
4. Mac track after Windows automation works (needs the darwin sd-cli work in
   the product first to be worth renting Macs for).

## AI runtime run (Stage 5 item 6 of `docs/ai-runtime-implementation-plan.md`) — ready-to-run checklist

Added 2026-09-05. **Not run yet: no TensorDock / Paperspace account or API key
exists on this box** (`.env` has none), so the rented-VM leg waits for Hasan to
create the account. Everything else for it is prepared; on the VM the whole leg
is ~45 min of wall time, ~$0.30–0.50 at 4090 rates (an 8–12 GB card is the point,
e.g. RTX 3060 12 GB / 4070 12 GB — pick the cheapest on-demand one with ≥ 8 GB):

1. Windows 10/11 template, RDP in. Install Node 24 + git. Note the driver version
   (`nvidia-smi`), must be ≥ 525.60 or the row will recommend the CPU build.
2. `git clone` the private repo (or copy a `npm run build:win` installer — the
   packaged path is the more valuable test), `npm install --legacy-peer-deps`.
   Dev launch: `docs/ui-automation-cdp.md` recipe with `-w`; the drivers from
   this session live in the Stage 5 scratchpad (`b2-runtime.mjs`, `b4-errors.mjs`,
   `b1-guards.mjs`) — copy them over.
3. AI page → System tab → **Install GPU runtime · 2.8 GB** (this box: 2.5 MB/s ≈
   18 min; a datacenter uplink should do it in 1–3 min). Record: download s,
   extract s, verify s (first triposr selftest), warm-up s (rembg first launch +
   triposr `--warmup`), total. Expect the row: "Installed · GPU · 2026.09.1".
4. AI page → 3D tab → TripoSR **Download** (1.7 GB from Hugging Face; record s);
   Image tab → Image tools → both rembg rows (176 MB + 179 MB).
5. 3D Studio: drop `product.png` → Generate at **Standard (256³)**; then
   **High (512³)** — enabled only when VRAM ≥ 8 GB — record click→card seconds
   and `peakVramMb` from `<model dir>/mesh.json` for both, plus vertex counts
   (256³ chair = 41,864 on every box so far).
6. Update path: `AI_RUNTIME_VERSION` → fake `2026.09.2` + a locally served zip as
   in the Stage 5 log (or a real 2026.09.2 if one exists by then): row says
   "Update available", both feature dialogs say "Update the AI runtime", the old
   folder is removed after success.
7. Image Studio: scissors on a gallery image (u2net, then ISNet after its
   download) — record seconds.
8. **Destroy** the instance. Paste every number into the plan's §10 log.

## Sources (checked 2026-08-23)

- DO GPU Droplet pricing: https://www.digitalocean.com/pricing/gpu-droplets
- TensorDock 4090: https://www.tensordock.com/gpu-4090.html
- TensorDock Windows/RDP + SD guide: https://docs.tensordock.com/virtual-machines/installing-and-running-stable-diffusion-ui
- 4090 provider comparison: https://getdeploying.com/gpus/nvidia-rtx-4090
- Paperspace machine create: https://docs.digitalocean.com/products/paperspace/machines/how-to/create/
- Scaleway Apple Silicon pricing: https://www.scaleway.com/en/pricing/apple-silicon/
