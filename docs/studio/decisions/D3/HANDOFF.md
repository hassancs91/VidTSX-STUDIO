# D3 — the Mapika spike: decider-2b as the local rung (no product code)
status: BUILDING (2026-10-31 09:21 — builder #2: (c) worker + host DONE, round trip proven; (d) GPU runs in progress)

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

- **(a) facts — `K3\reports\a-facts.md`** (builder #1, written 08:53–08:57; outside the tree; the HANDOFF / LOG lines committed in `b5a3d3e`
  at 08:57:20 first said "09:05 / 09:06" — guessed times, corrected here). Raw Hub / PyPI / PyTorch-index responses verbatim in
  `K3\reports\raw-hub\` (+ `fetched-at.txt`: 08:54:00, 08:55:03, 08:55:25), summarised by `K3\scripts\hub-facts.py` →
  `raw-hub\hub-facts.out.txt`. Headlines (all in a-facts.md): the local weights = Hub tag **v11** (sha256 `acaef222…817f`, equal; config
  byte-identical); the Hub `main` is now **v12** (2026-10-20, same 3,763,692,048 B size, different sha256, Noul T 0.05 = uncalibrated yes/no
  by default); **GGUF / ONNX exist** (`Mapika/decider-2b-GGUF`, v12 builds; community ONNX) — contradicts the paste-in's "likely not";
  decider-ai latest 1.10.0, which declares `flash-linear-attention` as a hard dependency (fla-core needs only `einops`; Triton only in
  extras); torch 2.14.1+cu130 cp313 wheel 1,990.6 MB, sha256 `f064c797…8319`.
- **(b) the venv + the one-question GPU smoke — `K3\reports\b-venv.md`** (builder #1, 08:57–09:07). `B3\py-scratch\mapika-venv`: Python
  3.13.2, torch 2.14.1+cu130 (from pip's cache), decider-ai 1.10.0, transformers 5.22.1, flash-linear-attention 0.6.0 (installed, but
  transformers falls back to the reference path — no Triton), full freeze `K3\reports\b-pip-freeze.txt`; venv 3,417,428,997 B. **CUDA works
  — no CPU fallback needed.** Smoke `K3\scripts\b-smoke.py` (one choice question, CUDA-graph Engine, bf16, the config's per-type map): two runs
  (run 1 at 93 % external CPU load — Defender — so repeated), answers identical (`decider-2b-v11`: billing, x_p_max 0.7817). The numbers are in
  `K3\reports\b-smoke-gpu-run1.json` / `-run2.json` and b-venv.md §4. Helpers: `K3\scripts\load-snapshot.ps1` (the guard + CPU load + top
  processes + nvidia-smi), snapshots in `K3\logs\`.
- **(c) the persistent worker + the Node host — round trip proven** (builder #2, 09:12–09:15). Files in K3 (outside the tree):
  - `K3\mapika_worker.py` — loads once through `decider.infer.Decider(path, device=…)` (unmodified, D-r13); protocol = one JSON object per line,
    UTF-8 both ways: worker → host `hello` (before torch is imported) · `ready` (load_s, start_to_ready_s, mem, vram, versions, engine, dtype,
    the per-type temperatures) · `result` {id, ok, result = the System One answer, workerMs, mem} or {id, ok:false, error} · `exit` {reason
    eof | idle | shutdown} · `fatal` (load failed, exit 1); host → worker {id, op: `system_one` (state, questions, independent?) | `ping` |
    `stats` | `shutdown`}. fd 1 is re-pointed at stderr at start so a library print can never corrupt the protocol; stdin is read as bytes
    and decoded UTF-8 (python `-I` ignores PYTHONIOENCODING); exits on stdin EOF, `shutdown`, or `--idle-s` (default 300) with no request; one
    bad request returns ok:false and never kills the worker. Memory = `K32GetProcessMemoryInfo` (working set, its lifetime peak, commit and
    its peak); VRAM = torch's allocated / reserved / max.
  - `K3\mapika-host.cjs` — `MapikaHost` (spawn once with `-I`, env `TORCHDYNAMO_DISABLE=1` + `HF_HUB_OFFLINE=1`; request ids `q<n>`; per-request
    timeout (default 120 s) and load timeout (300 s); `systemOne` / `ping` / `stats` / `close` (shutdown → stdin end → kill after 30 s);
    pending requests rejected with the stderr tail if the child exits; `hostMs` = Node → Python → Node per request). CLI `--smoke`.
  - `K3\d1-questions.cjs` — D1's question texts + criteria + `pack()` + the System One answer reader copied VERBATIM from
    `K1\hosted-run.cjs:35-82` (D-r12); reads `K1\fixtures\` only.
  - Smoke `node mapika-host.cjs --smoke --rows 3 --device cuda` → `K3\reports\c-host-smoke-cuda.json` (guard snapshots
    `K3\logs\c-host-smoke-cuda.snapshots.txt`: before 09:14:29 CPU 9 %, after 09:14:54 CPU 12 %, GPU 528 → 528 MiB, `python_processes=none`
    after): T2 rows t2-01..03 one per request, **3 / 3 right** (cut 0.9803 / 0.8385 / 0.9742); ready 14.80 s after spawn (load 10.711 s),
    spawn → first answer 15.88 s, first request 1,074.8 ms, warm 87.1 / 88.9 ms host (86.68 / 88.41 worker → transport 0.45 ms), 5 pings
    0.08–0.22 ms; peak RSS 4,483.4 MB, steady 1,672.6 MB, private 6,702.6 MB; VRAM max allocated 3,647.5 MB; exit code 0 (`shutdown`).
- **(d) the runner — `K3\d-run.cjs`** (builder #2): `--runs <task>:<mode>:<device>:<per-request|packed>[,…]`, one worker per run, one at a time
  (refuses when the guard fails or a `mapika-venv` python is alive); CPU load before / mid-run (between two requests, the worker idle) /
  after, nvidia-smi before / loaded / end / after; answer file `K3\answers\<name>.json` (vidtsx-d1-answers/1; `latencyMs` = the host round
  trip, `workerMs` beside), run file `K3\reports\d-run-<name>.json`, D1's `score.cjs` run with `--out K3\reports\score-<name>` (never into
  K1); a run with any CPU sample > 30 % is repeated once (`-rep2`, both kept); `K3\reports\d-summary.md` regenerated after every call
  (`--summary-only` to rebuild it).

## Verified

- `Get-FileHash` on `M\model.safetensors` (read-only) → `acaef2228b134dcdc20cad4ee79219482c927ec819aa3687b9b8a575c338817f` = the Hub `v11` tag's
  lfs sha256 in `raw-hub\api-decider-2b-v11.json`; `cmp raw-hub\hub-v11-decider_config.json M\decider_config.json` → identical.
- `pip install --dry-run torch==2.14.1 --index-url …/cu130` → "Using cached …torch-2.14.1%2Bcu130-cp313-cp313-win_amd64.whl (1990.6 MB)"; the real
  install: rc 0, 128 s. `pip install decider-ai==1.10.0`: rc 0, 95 s; `pip check` → "No broken requirements found."
- `python -c "import torch; …"` → `torch 2.14.1+cu130 cuda 13.0 avail True NVIDIA RTX A3000 Laptop GPU`.
- Smoke run 2 (`TORCHDYNAMO_DISABLE=1 <venv>\Scripts\python.exe -I K3\scripts\b-smoke.py <M> cuda K3\reports\b-smoke-gpu-run2.json 10`, rc 0,
  CPU load 6 % before / 13 % after, GPU 576 → 576 MiB): load 11.100 s, process start → first answer 15.896 s, first answer 981.3 ms, warm
  34.5–37.2 ms, RSS 900.1 MB after load / 1,668.1 MB at the end / peak 4,483.9 MB, VRAM max allocated 3,625.7 MB. No `python` process left
  after either run (`load-snapshot.ps1` "after" lines: `python_processes=none`).

## Next step

Step (c): write the persistent worker `K3\mapika_worker.py` + the Node host `K3\mapika-host.cjs` per the Goal's (c) — first read D1's
`K1\hosted-run.cjs:39-57` (the exact T1 / T2 / T3 question texts + criteria, D-r12), `K1\reports\b-tasksets.md` (the `vidtsx-d1-answers/1`
answer format) and `K1\llama-run.cjs` / `laya-run.cjs` (how D1 recorded cold / warm / RSS / CPU load); reuse `K3\scripts\b-smoke.py`'s
fixed `K32GetProcessMemoryInfo` reader for RSS and `load-snapshot.ps1` for the guard; the venv's python is
`C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\py-scratch\mapika-venv\Scripts\python.exe` (spawn it with `TORCHDYNAMO_DISABLE=1` and
`HF_HUB_OFFLINE=1`, weights from `D:\repos\ai-video-lab\tools\deciders\models\Mapika\decider-2b`); prove the host ↔ worker round trip on 2–3
T2 rows, then step (d).

## Open problems

> **Orchestrator, 09:12:** the first and third items below are RULED — **D-r13** (the term reads the worker's PEAK RSS over the whole run;
> steady RSS, peak private commit and VRAM beside it; a lower-peak load only via a documented `Decider` argument or our worker's own step
> order, answers identical to 4 dp, both reported; RSS-only fail → "FAIL (RSS only)", Hasan rules at the stop, no D4 (g) this session) and
> **D-r14** (v11 only; v12 / the GGUFs / decider-0.8b are facts in the report, not measured). See ORCHESTRATOR.md "Rulings (session 2)".

- **Which RSS the bar reads.** The worker's peak RSS is a load-time peak (4,483.9 MB, run 2) — the weights pass through RAM before moving to VRAM
  — while the steady RSS after warm requests is 1,668.1 MB (b-venv.md §4). The bar says "RSS ≤ 2 GB (VRAM reported beside)". (d) should record
  both peak and steady values; the orchestrator / Hasan decide which one the term reads (the Goal's (e) already lets Hasan rule if RSS alone fails
  because of where the weights live).
- **Private commit ≈ 6.6 GB** for one worker on CUDA (run 2: 6,651.1 MB). It counts against the commit-headroom guard (≥ 6 GB with C:) and against
  D4's "nothing blocks main" budget — a fact for the report's "How D4 (g) productises it".
- **The Hub `main` is v12** (Noul T 0.05 = uncalibrated yes/no by default; a-facts.md §5). D3 measures v11 (on disk). A D4 first-use download
  must pin `revision="v11"` and check sha256 `acaef222…817f` (the size cannot tell v11 from v12). Whether v12 with its fitted map would score
  better is outside D3 (no download into Hasan's folder; a v12 measurement would need the orchestrator's yes and a B3 download of 3.76 GB).
- Not tested: the smoke without `TORCHDYNAMO_DISABLE=1`; the CPU path (planned in (d) as a note); `use_graphs=False` (eager) on CUDA.

## Do-not-redo

- D1's fixtures, scorer and hosted answers exist and are final — reuse them, never rebuild or re-score the hosted rows.
- The tsc baseline at `b2b8a02` is measured (web 25 / node 10) — not D3's concern.
- (a) is done: `K3\reports\a-facts.md` + `raw-hub\` — do not re-fetch the Hub / PyPI facts unless a later step needs a NEW fact (e.g. D4's
  file list for revision v11 is already in `raw-hub\api-decider-2b-v11.json`).
- (b) is done: the venv exists and works on CUDA — do not rebuild it; do not reinstall torch (the wheel came from pip's cache).

## Agents so far

- 2026-10-31 08:53–09:08 · builder #1 · ~42 tool calls · read the brief docs + the Mapika card / config / `infer.py` / the deciders recipe +
  install.log + the experiment LOG's Mapika lines (~1,000 lines of source); step (a) facts (`a-facts.md`, `raw-hub\`), step (b) the venv +
  two GPU smokes (`b-venv.md`, `b-smoke-gpu-run{1,2}.json`); handed off before (c) (budget).
