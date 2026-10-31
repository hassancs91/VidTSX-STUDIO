# D3 — the Mapika spike: decider-2b as the local rung (no product code)
status: NEW (2026-10-31 08:52 — written by the orchestrator; no builder yet)

> Branch `decision-models`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt` (paths below are relative to it unless absolute).
> The orchestrator's state: `docs/studio/decisions/ORCHESTRATOR.md` — section "Session 2": its "Answers in force" (Hasan's E-a … E-h,
> verbatim), ruling **D-r12** (the framing: one row per request; the packed run is a NOTE) and session 1's **D-r8** (keys) / **D-r10**
> (the experiment is a primary source) bind this part.
> **No `src/` change in D3.** The only tree files D3 writes are this HANDOFF.md, `LOG.md` beside it and
> `docs/studio/decisions/D3-mapika-report.md`. Everything else lives in the kit `K3` or the scratch folder `B3` (below).

## Goal (the paste-in's D3 text, verbatim)

D3 — THE MAPIKA SPIKE (no product code; kit .vidtsx-temp\decisions\D3\; big outputs under …\vidtsx-e2e\decisions\D3\).
  (a) Primary facts from the model folder D:\repos\ai-video-lab\tools\deciders\models\Mapika\decider-2b\ (README.md = the card,
  decider_config.json, the `decider/` inference package — read, never modified; the folder is Hasan's, read-only) and the Hub card:
  licence (Apache-2.0), size (3,763,692,048 B bf16 safetensors), base (Qwen3.5-2B-Base), languages (card says en; Arabic measured
  in the experiment 9 / 12), per-type temperatures, limits (max_options 255, max_state_tokens 32768), the Python API
  (decider.infer.Decider(path, device='cuda').system_one(state, questions)), the smaller / vision members of "the decider family"
  (sizes, as candidates for a lighter rung — facts only), whether any GGUF / ONNX of it exists (likely not: a custom head).
  (b) A scratch venv C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\py-scratch\mapika-venv (system Python 3.13; state the torch
  cu130 wheel's size first — ~2.5 GB — and check C:; if the CUDA build fails on this laptop, CPU torch as the fallback and say so);
  `pip install decider-ai` (+ its deps; versions recorded); weights READ from the experiment's folder (never moved or copied).
  (c) A persistent-worker prototype: mapika_worker.py (load once; JSONL requests over stdin → System One answers over stdout; exits
  on idle / EOF) + a Node host mapika-host.cjs in the kit (spawn once, request ids, timeouts, measure Node → Python → Node) — the
  shape D4 step (g) will productise; TORCHDYNAMO_DISABLE=1 set in the host's env for the child.
  (d) Runs through the worker, GPU first (nvidia-smi before / after), ONE local model at a time, CPU load recorded beside every
  timing (repeat a loaded run): T2 choice (40), T3 noul (40), T1 choice (240, as a note) on D1's fixtures, answer files in the
  vidtsx-d1-answers/1 format, scored with D1's score.cjs; accuracy, Brier, ECE, selective accuracy at 0.5 / 0.7 / 0.9, the Arabic
  subset, T1 under D-r2; cold load (process start → first answer), warm p50 / p95 per request AND per question, peak RSS of the
  worker, VRAM; T2 + T3 on CPU as a note.
  (e) Judge against D2 §15.1's bar for a local rung on the routing and verify families — T2 ≥ 38 / 40 AND T3 ≥ 38 / 40 (within 5
  points of the hosted 100 %), Brier ≤ 0.05 on each, 0 off-list answers — plus the brief's warm p95 ≤ 300 ms per request and RSS
  ≤ 2 GB (VRAM reported beside; if RSS is the only failing term because the weights live in VRAM, say so and let Hasan rule at the
  stop) → docs/studio/decisions/D3-mapika-report.md (every number from a kit file, named) with PASS / FAIL per term. PASS → the
  local rung ships in D4 (g). FAIL → the rung stays empty, a note. STOP and ask Hasan only if the runtime cannot run on this laptop
  at all, or the numbers point to a different design than D2's.

**Exit (orchestrator):** `docs/studio/decisions/D3-mapika-report.md` committed, every number in it naming its kit file under `K3\reports\` or
`K3\answers\`, with: (a) the facts table (source file:line or URL + date read per fact; "unknown" where no primary source says; any
contradiction with the paste-in's (a) list); (b) the venv recipe actually used (Python, torch build, `decider-ai` and every dependency
version, the wheel sizes, CUDA vs CPU and why); (c) the worker + host files and their protocol; (d) per task (T2, T3, T1-note) × device
(GPU headline, CPU note): accuracy, Brier, ECE, reliability, selective accuracy at 0.5 / 0.7 / 0.9, Arabic subset, off-list count; T1 under
D-r2 at every τ beside the hosted Jev / MSD1 rows; cold load, warm p50 / p95 per request and per question, peak RSS, VRAM before / after,
CPU load beside every timing, a loaded run repeated; (e) the bar, one row per term, PASS / FAIL; the verdict; **and a section "How D4 (g)
productises it"** — the app's `pytorch` runtime path (`src/main/services/python-models/{service,registry}.ts`, `src/local-python-engine/
python-runner.ts`): which torch / CUDA build that runtime installs, whether `decider-ai`'s dependencies fit it or what must be added, where
the worker file would live, the first-use download (HF repo id, files, sizes, sha256 from the HF API) — facts only; D4 builds it only on a
PASS. `K3` holds the worker, the host, the run scripts, answers and reports; nothing under `src/`; the venv under `B3` only.

## Plan context

- **Why this part exists:** D1 found no local candidate near the bar (D1 report §11; the tiny GGUFs, Laya, d1-omni all fail). Hasan's own
  2026-10-05 experiment (`D:\repos\ai-video-lab\youtube-videos\01-jev-vs-clef\LOG.md`; ruling D-r10) measured Mapika decider-2b at 87.5 % /
  83.5 % routing (fresh) at 152–162 ms on THIS laptop's A3000, "≥ 0.90 → 96.8–98.8 % right", Arabic 9 / 12. Hasan said "yes, we can" (E-d).
- **The design it feeds:** `docs/studio/DECISION_MODELS_DESIGN.md` §5.3 (the local rung: a persistent worker, JSONL over stdio, idle unload;
  `src/local-decider-engine/decider-host.ts` in D4 (g)), §6 (`auto` uses local only when registered AND calibrated for the family), §15.1.
- **The runtime recipe:** `D:\repos\ai-video-lab\tools\deciders\README.md` (Python 3.13 venv, torch 2.14.1+cu130, `decider-ai`,
  `TORCHDYNAMO_DISABLE=1` on Windows) and its `install.log`. The experiment's venv is GONE (rebuild from the recipe).
- **D1's kit `K1` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\`, read-only, reused:** `fixtures\t1-pick.json` / `t2-routing.json` /
  `t3-verify.json`; `hosted-run.cjs:39-57` (the exact question texts + criteria per task — reuse them, D-r12); `measures.cjs` + `score.cjs`
  (the scorer; answer format `vidtsx-d1-answers/1`, described in `K1\reports\b-tasksets.md`); `answers\hosted-*-t2-choice.json` /
  `-t3-noul.json` / `-t1-choice.json` (the hosted rows to compare); `reports\c-hosted.md` §2 (Jev T2 40 / 40 Brier 0.021, T3 40 / 40 Brier
  0.003; MSD1 40 / 40 Brier 0.014, 40 / 40 Brier 0.002) and §4–§5 (T1 at every τ); `llama-run.cjs` / `laya-run.cjs` (how D1 recorded cold /
  warm / RSS / CPU load and its resource guard — copy the approach, not necessarily the code).
- **Framing (D-r12):** headline = D1's exact question text + criteria, ONE ROW PER REQUEST (state = the task rule, one keyed question);
  one PACKED run per task (all rows in one call) is a NOTE; a product-shaped variant is optional.

## Folders, rules, budget

- `K3` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D3\` (create it): scripts, the worker, the host, `answers\`, `reports\`, small logs.
- `B3` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\`: `py-scratch\mapika-venv\` (the venv), big logs. Nothing else.
- **The Mapika folder `D:\repos\ai-video-lab\tools\deciders\models\Mapika\decider-2b\` is Hasan's and read-only:** read files, load the weights
  from there; never write, move, copy, re-download into it, or `pip install -e` it. Never touch `D:\repos\ai-video-lab\.env` (no keys needed in
  D3 — no hosted call and no keyless call happens in D3).
- **Resource guard** before the venv install, every model load and every full run: C: ≥ 3 GB free AND C: + memory commit headroom ≥ 6 GB;
  ONE local model process at a time (check no other `python` worker of yours is alive); `nvidia-smi` before / after each GPU run; the CPU
  load (and its top external processes) recorded beside every timing; a run taken under external load is repeated once and both kept.
- **Downloads:** state each size first (the torch cu130 wheel ≈ 2.5 GB — check pip's HTTP cache first: `pip cache info`, a 2026-10-05 copy may
  be there); sha256 where published. **If a download would keep you idle more than ~10 minutes, stop it, write the exact command into
  "Next step", and hand back — the orchestrator runs long downloads as its own background job (a builder never idles on one).**
- Python packages ONLY in the scratch venv (E-g). No npm install anywhere. No app launch is needed in D3.
- Every git / tree statement is "as of <hash>". Numbers in prose come from the report files.

## Done

(nothing yet)

## Verified

(nothing yet)

## Next step

Step (a) then (b): write `K3\reports\a-facts.md` from the Mapika folder (README.md card, `decider_config.json`, `decider/` source,
`eval_results.json`) + the Hub card (WebFetch, date read) + `tools\deciders\README.md` / `install.log` + the experiment's `LOG.md` Mapika
lines; then state the venv's download sizes (and what pip's cache already holds), check the resource guard, and build
`B3\py-scratch\mapika-venv` with system Python 3.13 (`C:\Python313\python.exe`) per the recipe, recording every version; prove it with a
one-question `system_one` smoke on the GPU (and say if CUDA fails → CPU torch). Hand off after (b) if the budget says so.

## Open problems

(none yet)

## Do-not-redo

- D1's fixtures, scorer and hosted answers exist and are final — reuse them, never rebuild or re-score the hosted rows.
- The tsc baseline at `b2b8a02` is measured (web 25 / node 10) — not D3's concern.

## Agents so far

(none)
