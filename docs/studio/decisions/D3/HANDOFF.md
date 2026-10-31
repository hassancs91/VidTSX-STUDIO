# D3 — the Mapika spike: decider-2b as the local rung (no product code)
status: HANDOFF (2026-10-31 09:28 — builder #2: (c) DONE; (d) GPU headline T2 + T3 + T1-note DONE, T2 packed DONE; left in (d): T3 + T1 packed, CPU T2 + T3)

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
- **(d) GPU runs DONE so far (builder #2, 09:16–09:27; numbers = `K3\reports\d-summary.md`, generated 07:27:40Z, from `d-run-<name>.json` +
  `score-<name>.json|.md`; answers `K3\answers\<name>.json`; name = `mapika-decider-2b-v11-gpu-<task>-<mode>[-packed]`):**

  | run (GPU, one row per request unless packed) | acc | Brier | ECE | sel ≥0.5 / ≥0.7 / ≥0.9 acc (cov) | Arabic | off-list | warm / request p50 · p95 ms | spawn → first answer | peak / steady RSS MB | peak private MB | VRAM max alloc MB | CPU before · mid · after |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | t2-choice (headline) | 95.0 % (38/40) | 0.053 | 0.061 | 95.0 (100) / 94.4 (90) / 100.0 (65) | 90.0 % (10) | 0 | 89.3 · 92.5 | 14.36 s | 4,483.7 / 1,673.9 | 6,702.6 | 3,647.5 | 5.9 · 7 · 8 % |
  | t3-noul (headline) | 82.5 % (33/40) | 0.122 | 0.148 | 82.5 (100) / 90.0 (75) / 100.0 (20) | 85.7 % (7) | n/a (noul) | 54.7 · 227.2 | 14.27 s | 4,482.9 / 1,692.2 | 6,755.7 | 3,648.9 | 9.3 · 30 · 12 % |
  | t1-choice (note) | 73.3 % (240) | 0.240 | 0.249 | 87.0 (45.0) / 90.2 (21.3) / — (0.0) | 80.0 % (10) | 0 | 595.3 · 598.4 | 16.11 s | 4,484.1 / 1,737.8 | 7,521.8 | 3,988.8 | 8 · 14 · 27 % |
  | t2-choice-packed (note; 1 call of 40) | 95.0 % | 0.052 | 0.104 | same as headline | 90.0 % | 0 | — (one cold request 251,311.1 ms) | 268.85 s | 4,484.4 / 3,231.2 | 9,694.2 | **6,185** | 16 · — · 10.2 % |

  T1 under D-r2 (`d-summary.md` "T1 under D-r2", ALL; D1's hosted rows read from `K1\reports\c-hosted-{jev,openrouter-msd1}-t1-choice.json`,
  not re-scored): Mapika τ 0.5 R@1 88/187 = 47.1 %, wrong-confident 14/240 = 5.8 %; τ 0.7 43/187 = 23.0 %, wc 5/240 = 2.1 %; τ 0.9 0 picks
  (R@1 0.0 %, wc 0.0 %, correct none 53/53). Jev τ 0.5 79.1 % / wc 9.6 %; MSD1 τ 0.5 66.8 % / wc 10.0 %. No run hit the > 30 % CPU repeat rule
  (max sample 30 = T3's mid-run, not > 30), so no `-rep2` yet. Transport (host − worker) p50 0.44–0.84 ms. nvidia-smi: 528 MiB before →
  4,313 MiB loaded → 528 MiB after for every per-request run.
- **Preview of the bar (for (e) — the builder of (e) re-reads the files):** T2 38/40 meets "≥ 38" but Brier 0.053 > 0.05; T3 33/40 and Brier
  0.122 fail; off-list 0; warm p95 per request 92.5 (T2) / 227.2 (T3) ms ≤ 300; peak RSS ≈ 4,483 MB > 2 GB (steady ≈ 1.7 GB). → several terms
  fail, NOT "RSS only" → per (e) the rung stays empty (a note, not a STOP: the runtime runs, D2 already allows an empty rung).

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
- (c) smoke: `node mapika-host.cjs --smoke --rows 3 --device cuda` (from K3) → rc 0, `reports\c-host-smoke-cuda.json` (numbers in Done (c)).
- (d): `node d-run.cjs --runs t2:choice:cuda:per-request` (09:16:31–09:17:04) → rc 0, "acc 95.0 % (40 q, answered 40), Brier 0.053, ECE 0.061 ·
  cold 14357 ms · warm/request p50 89.3 p95 92.5 ms · peak RSS 4483.7 MB steady 1673.9 MB · CPU 5.9/7/8 % · errors 0".
  `timeout 590 node d-run.cjs --runs t3:noul:cuda:per-request,t1:choice:cuda:per-request,t2:choice:cuda:packed,t3:noul:cuda:packed,t1:choice:cuda:packed`
  (09:17:19–09:27:12) → T3, T1, T2-packed lines as in the table; then **my own `timeout 590` fired during t3-noul-packed** (rc 124): the
  worker was killed mid-request, the host threw "worker not running" at `stats()`, so NO t3-packed answer / run file was written and t1-packed
  never started. After: `Get-Process python*` → `python_processes=none`; nvidia-smi 387 MiB used (09:27:39). `node d-run.cjs --summary-only` → ok.

## Next step

> **Orchestrator, 09:33 — ruling D-r15 REPLACES items (1) and (3) below:** the packed T3 and T1 notes are NOT run (the T2 packed run already
> shows the packed form overflows the 6 GB card — record that as the finding, with the cut T3 attempt). Run instead: **(2) the CPU note as
> written below**, then **one product-shaped NOTE on GPU** (state = the row's own text, a short generic instruction, the same criteria; T3 first,
> T2 if cheap; one row per request; a new run name, e.g. `…-gpu-t3-noul-product`) so the report can say whether the FAIL depends on D1's
> framing — it never replaces the headline. Then step (e). The orchestrator re-scored the two headline files with `K1\score.cjs` and got the
> same numbers (T2 95.0 % / Brier 0.053; T3 82.5 % / Brier 0.122).

Finish (d), each as its own background command with NO `timeout` wrapper shorter than the job (`run_in_background: true`, then wait for the
notification), from K3: (1) `node d-run.cjs --runs t3:noul:cuda:packed` (expect ~4–5 min: the T2 packed call spilled past the 6 GB card —
see Open problems); (2) `node d-run.cjs --runs t2:choice:cpu:per-request,t3:noul:cpu:per-request` (the CPU note; fp32 eager ≈ 8 GB RAM; check
the guard); (3) T1 packed (17 of D1's hosted requests, ~14 rows × 21 options each) — first estimate it from (1)'s time per question; if it would
exceed ~20 min, record "not run: VRAM spill makes one packed request take minutes" as the note instead of running it. Then step (e) (the report),
reading `K3\reports\d-summary.md` + the score / run files.

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
- **(builder #2) A packed System One call spills past the 6 GB GPU.** `d-run-…-gpu-t2-choice-packed.json`: one call of 40 questions
  (`independent=True` → `Engine.score_shared`, the state's cache forked to 40 rows) reached torch max allocated 6,185 MB / reserved 6,746 MB on a
  6,144 MiB card (nvidia-smi end 5,871 MiB, 100 %) and took 251,311.1 ms — vs 40 × ~89 ms one row per request. Windows' shared-memory fallback is
  the likely reason (not proven). Answers are the same quality (95.0 %, Brier 0.052). For D4 / the design: the worker must send one row (or a
  few) per forward on this class of GPU — a fact for the report's "How D4 (g) productises it"; the D-r12 headline is unaffected.
- **T3 is the weak family:** 33/40, Brier 0.122, ECE 0.148, and only 20 % coverage at ≥ 0.9 (`score-…-gpu-t3-noul.md`). Mapika's noul
  temperature is 1.624 (v11 config). Whether v12's fitted map would do better is outside D3 (D-r14).
- `d-summary.md` prints "undefined" in the per-question / transport cells of a run with no warm request (the packed runs) — cosmetic; fix
  the `?.toFixed` guards in `d-run.cjs` `summary()` if it matters for (e).
- `ORCHESTRATOR.md` showed ` M` in the worktree at 09:21 — not a D3 builder edit; left unstaged (explicit-path commits only).

## Do-not-redo

- D1's fixtures, scorer and hosted answers exist and are final — reuse them, never rebuild or re-score the hosted rows.
- The tsc baseline at `b2b8a02` is measured (web 25 / node 10) — not D3's concern.
- (a) is done: `K3\reports\a-facts.md` + `raw-hub\` — do not re-fetch the Hub / PyPI facts unless a later step needs a NEW fact (e.g. D4's
  file list for revision v11 is already in `raw-hub\api-decider-2b-v11.json`).
- (b) is done: the venv exists and works on CUDA — do not rebuild it; do not reinstall torch (the wheel came from pip's cache).
- (c) is done: `K3\mapika_worker.py`, `K3\mapika-host.cjs`, `K3\d1-questions.cjs` work (smoke `reports\c-host-smoke-cuda.json`) — reuse, don't rewrite.
- (d) GPU per-request T2 / T3 / T1 and GPU T2 packed are done (answers + `d-run-*` + `score-*` in K3) — do not re-run them (a re-run is only
  for the > 30 % CPU rule, which none of them hit).

## Agents so far

- 2026-10-31 08:53–09:08 · builder #1 · ~42 tool calls · read the brief docs + the Mapika card / config / `infer.py` / the deciders recipe +
  install.log + the experiment LOG's Mapika lines (~1,000 lines of source); step (a) facts (`a-facts.md`, `raw-hub\`), step (b) the venv +
  two GPU smokes (`b-venv.md`, `b-smoke-gpu-run{1,2}.json`); handed off before (c) (budget).
- 2026-10-31 09:12–09:29 · builder #2 · ~40 tool calls · read the HANDOFF, ORCHESTRATOR session 2 + D-r2 / D-r8 / D-r10, `K1\hosted-run.cjs`,
  `b-tasksets.md` §4–§5, `score.cjs`, the `Decider` constructor / `system_one` and `systemone.assemble` (~700 lines); step (c) worker + host +
  smoke (commit `15b00d8`); step (d) runner + GPU T2 / T3 / T1 / T2-packed; handed off with T3 / T1 packed and the CPU note left (budget).
