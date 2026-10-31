# D3 — Mapika decider-2b as the local rung: the spike report

> Session 2, part D3 of the decision-models run (branch `decision-models`; tree statements as of `7a7e8eb` unless a later hash is named).
> **No product code:** nothing under `src/`, `scripts/` or `package*.json` changed in D3. Kit `K3` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D3\`
> (outside the tree); scratch `B3` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\` (the venv only); D1's kit `K1` = `…\decisions\D1\`
> (read-only: fixtures, `score.cjs`, the hosted answers). Every number below names the kit file it comes from (paths relative to `K3` unless
> they start with `K1\` or a drive). The model's probabilities are measurements here, never a claim shown to a user or the assistant (D2 §1, §15.1).
> Written by D3 builder #3, 2026-10-31.

## 1. The verdict in one paragraph

**FAIL. The local rung stays empty: a note, not a stop.** The headline is D1's framing, one row per request on the GPU (D-r12). There, Mapika
decider-2b v11 meets T2's accuracy term (38 / 40) but misses its Brier term (0.053 > 0.05). It fails T3 on accuracy (33 / 40) and on Brier
(0.122), and its peak RSS (4,483.7 MB) is over 2 GB. It passes off-list (0) and warm p95 per request (92.5 / 227.2 ms). Four terms fail, so
this is not "FAIL (RSS only)". Per the paste-in's (e) and E-d, the rung stays empty and D4 (g) is not built. The runtime runs on this laptop on
CUDA and on CPU, so there is no STOP. The product-shaped note lifts T3 to 38 / 40, but it still misses Brier (0.054) and warm p95 (424.7 ms),
and T2 drops to 37 / 40. So the FAIL does not come from D1's framing alone (§8).

## 2. Facts (step (a)) — `reports\a-facts.md` (read 2026-10-31 08:53–08:57 by builder #1; raw responses in `reports\raw-hub\`, `fetched-at.txt`)

| Fact | Value | Primary source (as `a-facts.md` cites it) | vs the paste-in's (a) |
|---|---|---|---|
| Weights on disk = Hub tag `v11` | `model.safetensors` 3,763,692,048 B, sha256 `acaef2228b13…a8b575c338817f` — equal to the local file; config byte-identical | `raw-hub\api-decider-2b-v11.json`; `Get-FileHash` + `cmp` (a-facts §1) | agrees |
| Hub `main` today | **v12** (commit `7614a6c7ea`, 2026-10-20): same size, different sha256 `1265b014…6876e1`; Noul T 0.05 = uncalibrated yes / no by default | `raw-hub\api-decider-2b.json`, `api-decider-2b-commits.json` (a-facts §1, §5) | new fact |
| Licence | Apache-2.0 | `M\README.md:2`; Hub `cardData.license` | agrees |
| Size / params | 3,763,692,048 B bf16; 1,881,825,088 params | Hub `safetensors.parameters` (a-facts §2) | agrees |
| Base / arch | Qwen/Qwen3.5-2B-Base; `Qwen3_5ForCausalLM`, 24 layers (18 linear-attention + 6 full), vocab 248,320; `model_type` `qwen3_5_text`, saved with transformers 5.17.0 | `M\README.md:3,16`; `M\config.json:3,17-41,51,56,72,74` | agrees |
| Languages | card: en, "English only"; Arabic **measured** 9 / 12 in Hasan's 2026-10-05 experiment | `README.md:4,470`; `…\01-jev-vs-clef\LOG.md:290` | agrees |
| Temperatures (v11) | 1.145; per type choice 1.164, noul 1.624, score 1.124 (decider-ai ≥ 1.4.0) | `M\decider_config.json:2-7,18` | agrees |
| Limits | `max_options` 255; `max_state_tokens` 32,768 | `decider_config.json:12-13`; `M\decider\prompt.py:12` | agrees |
| Python API | `Decider(path, device=None, dtype=None, temperature=None, abstain_below=0.0, use_graphs=None, temperature_by_type=None)`; `system_one(state, questions, independent=True, max_state_tokens=32768, max_fwd_tokens=65536, …)`, many questions per call | `M\decider\infer.py:75,84-87,100-104,112,180-193` | agrees |
| Readout | the ordinary LM head's option-letter logits, softmaxed / T — **no custom head** | `README.md:145-146,222-231` | **contradicts** "a custom head" |
| GGUF / ONNX | **exist**: the maker's `Mapika/decider-2b-GGUF` (v12 builds: BF16 3,775,708,704 B, Q8_0 2,012,012,064 B, Q4_K_M 1,274,396,192 B); decider-ai `gguf` extra (`llama-cpp-python`); community ONNX / GGUF exports (unverified) | `raw-hub\api-decider-2b-GGUF.json`, `pypi-decider-ai-1.10.0.json`, `search-decider-2b.json` (a-facts §4) | **contradicts** "likely not" |
| decider-ai | latest 1.10.0 (2026-10-20), requires_python ≥ 3.11; hard deps `torch`, `transformers>=5`, `flash-linear-attention`, `numpy`, `huggingface_hub`, `jinja2` | `raw-hub\pypi-decider-ai.json`, `pypi-decider-ai-1.10.0.json` | new fact (fla is a hard dep) |
| flash-linear-attention 0.6.0 | pure-Python; requires `fla-core==0.6.0`, `transformers<6,>=5.6.2`; fla-core needs only `einops` (Triton only in extras) | `raw-hub\pypi-flash-linear-attention.json`, `pypi-fla-core.json` | — |
| Lighter members (facts only, D-r14) | `Mapika/decider-0.8b`: 1,504,827,608 B (752,393,024 params), sha256 `6926f82e…563d`, card "within 1 to 4 points of the 2B, 1.5x faster"; `decider-2b-vision` 4,426,558,864 B; `decider-4b` 8,411,558,400 B (+ vision) | `raw-hub\api-decider-0.8b.json`, `api-decider-2b-vision.json`, `api-decider-4b.json`; v11 `README.md:154-155` (a-facts §3) | — |
| Which decider-ai the 2026-10-05 experiment used | unknown (its install log is a dry run) | `install.log:35-49` (a-facts §6) | unknown |

## 3. The venv actually used (step (b)) — `reports\b-venv.md`, `reports\b-pip-freeze.txt`

- `C:\Python313\python.exe -m venv B3\py-scratch\mapika-venv` (Python 3.13.2) → `pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cu130`
  (rc 0, 128 s; the 1,990.6 MB cp313 wheel came from pip's HTTP cache, sha256 `f064c797…698319` per `raw-hub\torch-cu130-index.html`) →
  `pip install decider-ai==1.10.0` (rc 0, 95 s; `pip check` clean). New bytes over the network ≈ 1.8 MB. Venv 3,417,428,997 B.
- Versions: torch 2.14.1+cu130 · transformers 5.22.1 · decider-ai 1.10.0 · flash-linear-attention 0.6.0 · fla-core 0.6.0 · numpy 2.5.4 ·
  tokenizers 0.23.3 · safetensors 0.8.0 · huggingface_hub 2.4.0 · einops 0.8.2 · Jinja2 3.1.6 (full list in `b-pip-freeze.txt`). **No Triton**:
  transformers logs that `chunk_gated_delta_rule` falls back to its reference PyTorch path (every run's `logs\d-run-*.stderr.log`).
- **CUDA, not CPU:** the cu130 build ran on the RTX A3000 Laptop GPU (6,144 MiB) at once — no fallback was needed. `TORCHDYNAMO_DISABLE=1` set
  before Python starts (the decider engines call `torch.compile`, `M\decider\engine.py:100`); not tested without it.
- One-question smoke (`scripts\b-smoke.py`, `reports\b-smoke-gpu-run2.json`): load 11.100 s, process start → first answer 15.896 s, warm 34.5–37.2 ms;
  RSS after load 900.1 MB / end 1,668.1 MB / peak 4,483.9 MB; private commit peak 6,651.1 MB; VRAM max allocated 3,625.7 MB. Run 1 (93 % external
  CPU load, Defender) gave the identical answer (`b-smoke-gpu-run1.json`).

## 4. The persistent worker + the Node host (step (c))

- **`K3\mapika_worker.py`** — `python -I mapika_worker.py --model <dir> [--device cuda|cpu] [--idle-s 300]`; loads once through
  `decider.infer.Decider(path, device=…)` (the package unmodified, D-r13). Protocol = one JSON object per line, UTF-8 both ways:
  worker → host `hello` (before torch is imported) · `ready` (load_s, start_to_ready_s, mem, vram, versions, engine, dtype, per-type
  temperatures) · `result` `{id, ok:true, result, workerMs, mem}` or `{id, ok:false, error}` · `exit` `{reason: eof|idle|shutdown}` · `fatal`
  (load failed, exit 1); host → worker `{id, op:"system_one", state, questions, independent?}` · `ping` · `stats` · `shutdown`. fd 1 is re-pointed
  at stderr so a library print cannot corrupt the protocol; stdin is read as bytes and decoded UTF-8; exits on EOF, `shutdown` or `--idle-s`
  with no request; a bad request answers `ok:false` and never kills the worker. Memory = `K32GetProcessMemoryInfo` (working set + peak,
  commit + peak); VRAM = torch allocated / reserved / max.
- **`K3\mapika-host.cjs`** — `MapikaHost`: spawns once with `-I` and env `TORCHDYNAMO_DISABLE=1`, `HF_HUB_OFFLINE=1`, `PYTHONUNBUFFERED=1`; request
  ids; per-request timeout (default 120 s) and load timeout (300 s); `systemOne` / `ping` / `stats` / `close` (shutdown → stdin end → kill after
  30 s); pending requests rejected with the stderr tail when the child exits; `hostMs` = Node → Python → Node per request.
- `K3\d1-questions.cjs` = D1's question texts + criteria + `pack()` + the answer reader, copied verbatim from `K1\hosted-run.cjs:35-82` (D-r12).
  `K3\d-run.cjs` = the runner (one worker per run, the guard, CPU load before / mid / after, nvidia-smi, answers in `vidtsx-d1-answers/1`,
  `K1\score.cjs --out K3\reports\score-<name>`); builder #3 added the `product` framing (D-r15).
- Round trip (`reports\c-host-smoke-cuda.json`, 3 T2 rows one per request): 3 / 3 right (top P 0.9803 / 0.8385 / 0.9742); ready 14,798 ms after
  spawn (load 10.711 s); first request 1,074.8 ms, then 87.1 / 88.9 ms host vs 86.68 / 88.41 ms worker (transport 0.45–0.46 ms); 5 pings
  0.08–0.22 ms; RSS 1,672.6 MB steady / 4,483.4 MB peak, private 6,702.6 MB, VRAM max allocated 3,647.5 MB; exit code 0.

## 5. The runs (step (d))

**Conditions.** All runs went through `d-run.cjs` → `mapika-host.cjs` → `mapika_worker.py` on 2026-10-31, 09:16–09:39 (+02:00). There was one
worker process per run and one at a time. The resource guard was OK before each run: for example, before `cpu-t2-choice` C: had 25.11 GB free,
commit headroom was 50.38 GB and 33.11 GB of RAM was free (`reports\d-run-mapika-decider-2b-v11-cpu-t2-choice.json` `cpu.before`). After each run
no python process was left (`cpu.after.python` = []). On the GPU the engine is `Engine` (CUDA graphs) in bf16. On the CPU it is eager float32 with
8 threads (`worker` in each `d-run-*.json`). **No CPU sample was over 30 %.** The highest was 30 %, the GPU T3 headline's mid-run sample, which is
not over the limit. Other processes used at most 7.3 % of all cores (`d-summary.md` "CPU load detail"), so no run counted as loaded and none was
repeated as `-rep2`. Names below are `mapika-decider-2b-v11-<…>`. Each run has three kit files: `answers\<name>.json`
(`vidtsx-d1-answers/1`), `reports\score-<name>.{md,json}` (from `K1\score.cjs`, run with `--out` into K3) and `reports\d-run-<name>.json`.
Every row is gathered in `reports\d-summary.md` (generated 2026-10-31T07:39:22Z).

**5.1 Accuracy and calibration** (`d-summary.md` "Accuracy and calibration"; the per-group rows are in each `score-<name>.md`)

| run | role | acc (right / 40) | Brier | ECE | sel ≥0.5 / ≥0.7 / ≥0.9 acc % (cov %) | Arabic acc (n) | off-list |
|---|---|---|---|---|---|---|---|
| `gpu-t2-choice` | **HEADLINE** | 95.0 % (38) | 0.053 (0.0531 in `.json`) | 0.061 | 95.0 (100) / 94.4 (90) / 100.0 (65) | 90.0 % (10) | 0 |
| `gpu-t3-noul` | **HEADLINE** | 82.5 % (33) | 0.122 | 0.148 | 82.5 (100) / 90.0 (75) / 100.0 (20) | 85.7 % (7) | — (yes / no) |
| `gpu-t1-choice` | NOTE (240 rows) | 73.3 % | 0.240 | 0.249 | 87.0 (45.0) / 90.2 (21.3) / — (0.0) | 80.0 % (10) | 0 |
| `gpu-t2-choice-packed` | NOTE (1 call of 40) | 95.0 % | 0.052 | 0.104 | 95.0 (100) / 94.4 (90) / 100.0 (65) | 90.0 % (10) | 0 |
| `gpu-t3-noul-packed` | NOTE, **cut** | — | — | — | — | — | — |
| `cpu-t2-choice` | NOTE (CPU) | 95.0 % (38) | 0.050 (0.0503 in `.json`) | 0.102 | 95.0 (100) / 94.4 (90) / 100.0 (65) | 90.0 % (10) | 0 |
| `cpu-t3-noul` | NOTE (CPU) | 82.5 % (33) | 0.124 | 0.150 | 82.5 (100) / 90.0 (75) / 100.0 (20) | 85.7 % (7) | — |
| `gpu-t3-noul-product` | NOTE (product-shaped) | 95.0 % (38) | 0.054 | 0.142 | 95.0 (100) / 100.0 (82.5) / 100.0 (22.5) | 85.7 % (7) | — |
| `gpu-t2-choice-product` | NOTE (product-shaped) | 92.5 % (37) | 0.058 | 0.150 | 97.4 (95.0) / 97.0 (82.5) / 100.0 (40.0) | 90.0 % (10) | 0 |

- The hosted rows to compare (D1, quoted in D2 §15.1 from `K1\reports\c-hosted.md` §2): Jev T2 40 / 40 (Brier 0.021), T3 40 / 40 (0.003); MSD1
  40 / 40 (0.014) and 40 / 40 (0.002).
- **T3 by kind** (`score-…-gpu-t3-noul.md`): template 93.8 % (16), caption 60.0 % (10), clip 85.7 % (14). Product-shaped
  (`score-…-gpu-t3-noul-product.md`): 100.0 %, 90.0 %, 92.9 %.
- **Reliability.** The T2 headline (`score-…-gpu-t2-choice.md`) puts 26 rows in the 0.9–1.0 bin, with mean p 0.971 and all 26 right. The T3
  headline (`score-…-gpu-t3-noul.md`) is **under-confident on "yes"**: every row in the 0.5–1.0 bins is labelled true (for example 0.5–0.6:
  n 3, mean p 0.567; 0.8–0.9: n 4, mean p 0.841), but only 1 row reaches 0.9–1.0. The v11 noul temperature is 1.624 (a-facts §2). The full
  ten-bin tables are in each score `.md`.
- **CPU vs GPU:** the accuracy and the selective rows are equal on T2 and on T3. The Brier differs only in the third decimal (0.0503 vs 0.0531;
  0.124 vs 0.122), because the CPU runs float32 eager and the GPU runs bf16 with graphs.
- **The cut T3 packed attempt:** builder #2's own `timeout 590` killed the worker during its one 40-question request, so no answer file and no run
  file exist. `logs\d-run-mapika-decider-2b-v11-gpu-t3-noul-packed.stderr.log` ends at the weight load and the fla fallback warning. Per D-r15 it
  was not re-run, and **T1 packed was not run**. The packed finding stands on the T2 packed row (§5.2).

**5.2 Time, memory, CPU load** (`d-summary.md` "Time, memory, CPU load"; the first request is the "cold" line of each `score-<name>.md`)

| run | spawn → first answer s | load s | first request ms | warm / request p50 · p95 ms | transport p50 ms | peak RSS MB | steady RSS MB | peak private MB | VRAM max alloc · reserved MB | nvidia-smi before → loaded → after | CPU % before · mid · after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gpu-t2-choice` | 14.36 | 9.542 | 1,090.3 | 89.3 · 92.5 | 0.50 | 4,483.7 | 1,673.9 | 6,702.6 | 3,647.5 · 3,738 | 528 → 4,313 → 528 MiB | 5.9 · 7 · 8 |
| `gpu-t3-noul` | 14.27 | 9.341 | 912.7 | 54.7 · 227.2 | 0.44 | 4,482.9 | 1,692.2 | 6,755.7 | 3,648.9 · 3,778 | 528 → 4,313 → 528 MiB | 9.3 · 30 · 12 |
| `gpu-t1-choice` | 16.11 | 9.404 | — | 595.3 · 598.4 | 0.84 | 4,484.1 | 1,737.8 | 7,521.8 | 3,988.8 · 4,440 | 528 → 4,313 → 528 MiB | 8 · 14 · 27 |
| `gpu-t2-choice-packed` | 268.85 | 11.845 | 251,311.1 (the one request) | — | — | 4,484.4 | 3,231.2 | 9,694.2 | **6,185 · 6,746** | 528 → 4,313 → 452 MiB (end 5,871 MiB, 100 %) | 16 · — · 10.2 |
| `cpu-t2-choice` | 18.40 | 10.294 | 4,198.6 | 3,872.3 · 4,043.3 | 0.65 | 8,121.1 | 8,056.1 | 11,374.4 | — (CPU) | 387 → 387 → 387 MiB | 13.7 · 7 · 9 |
| `cpu-t3-noul` | 16.80 | 9.919 | 2,857.8 | 2,595 · 3,295.8 | 0.60 | 8,125.5 | 8,088.8 | 11,448.6 | — (CPU) | 387 → 387 → 387 MiB | 12 · 5.9 · 16 |
| `gpu-t3-noul-product` | 13.84 | 9.112 | 1,135.3 | 54.1 · 424.7 | 0.46 | 4,482.9 | 1,709.8 | 6,822 | 3,657.2 · 3,806 | 387 → 4,172 → 387 MiB | 9.4 · 22 · 8 |
| `gpu-t2-choice-product` | 14.37 | 9.384 | 949.3 | 64.7 · 69.2 | 0.47 | 4,483 | 1,672.5 | 6,677.5 | 3,640.7 · 3,726 | 387 → 4,172 → 387 MiB | 7.1 · 7.5 · 9 |

- In every one-row run, **per question = per request** (the per-question columns of `d-summary.md` equal the per-request ones). The packed T2
  call amortises to 251,311.1 / 40 ≈ 6,283 ms per question, about 70 times one row per request, because it spilled past the card (`d-run-…-gpu-t2-choice-packed.json`
  `vram.end` and `nvidiaSmi.end`).
- The **"cold load"** (process start → first answer) is 13.84–18.40 s across all runs. `Decider()` loading takes 9.1–11.8 s of it.
- The **CPU path** (float32, 8 threads) holds about 8.1 GB of RSS steadily and about 11.4 GB of private commit, and takes 2.6–4.0 s per request.

**5.3 T1 under D-r2** (NOTE; `d-summary.md` "T1 under D-r2", ALL 240 rows; D1's hosted rows are read from `K1\reports\c-hosted-{jev,openrouter-msd1}-t1-choice.json`, not re-scored)

| run | τ | R@1 (named) | pick acc | wrong-confident | correct none | false none | picks |
|---|---|---|---|---|---|---|---|
| D1 hosted Jev | 0.5 | 148/187 = 79.1 % | 158/187 | 23/240 = 9.6 % | 38/53 | 21 | 171 |
| D1 hosted Jev | 0.7 | 127/187 = 67.9 % | 144/187 | 18/240 = 7.5 % | 42/53 | 36 | 145 |
| D1 hosted Jev | 0.9 | 100/187 = 53.5 % | 123/187 | 9/240 = 3.8 % | 46/53 | 62 | 109 |
| D1 hosted MSD1 | 0.5 | 125/187 = 66.8 % | 134/187 | 24/240 = 10.0 % | 40/53 | 42 | 149 |
| D1 hosted MSD1 | 0.7 | 119/187 = 63.6 % | 129/187 | 17/240 = 7.1 % | 45/53 | 49 | 136 |
| D1 hosted MSD1 | 0.9 | 105/187 = 56.1 % | 119/187 | 11/240 = 4.6 % | 48/53 | 62 | 116 |
| Mapika `gpu-t1-choice` | 0.5 | 88/187 = 47.1 % | 110/187 | 14/240 = 5.8 % | 45/53 | 71 | 102 |
| Mapika `gpu-t1-choice` | 0.7 | 43/187 = 23.0 % | 68/187 | 5/240 = 2.1 % | 49/53 | 118 | 48 |
| Mapika `gpu-t1-choice` | 0.9 | 0/187 = 0.0 % | 31/187 | 0/240 = 0.0 % | 53/53 | 156 | 0 |

At τ 0.5 Mapika's wrong-confident rate (5.8 %) is below S1's 6.3 %, at R@1 47.1 % (hosted Jev 79.1 %, MSD1 66.8 %). At τ 0.9 it abstains on
every row. D-r2's "beats the keyless baseline" also needs the baseline re-run's R@1 (D1's file), which was not read here. T1 is not a first user
(D2 §15.1), so this stays a note.

## 6. The bar (paste-in (e) / D2 §15.1 for a local rung; RSS per D-r13)

The bar is read on the **headline**: GPU, D1's framing, one row per request (D-r12).

| term | threshold | measured | kit file | result |
|---|---|---|---|---|
| T2 accuracy | ≥ 38 / 40 | 38 / 40 (95.0 %) | `reports\score-mapika-decider-2b-v11-gpu-t2-choice.md` | **PASS** |
| T3 accuracy | ≥ 38 / 40 | 33 / 40 (82.5 %) | `reports\score-mapika-decider-2b-v11-gpu-t3-noul.md` | **FAIL** |
| T2 Brier | ≤ 0.05 | 0.053 (0.0531) | `reports\score-mapika-decider-2b-v11-gpu-t2-choice.json` | **FAIL** |
| T3 Brier | ≤ 0.05 | 0.122 | `reports\score-mapika-decider-2b-v11-gpu-t3-noul.json` | **FAIL** |
| off-list answers | 0 | 0 (T2; a yes / no question has no off-list answer) | `score-…-gpu-t2-choice.md` | **PASS** |
| warm p95 per request | ≤ 300 ms | T2 92.5 ms; T3 227.2 ms | `reports\d-run-…-gpu-t2-choice.json`, `…-gpu-t3-noul.json`; `d-summary.md` | **PASS** |
| peak RSS (D-r13) | ≤ 2 GB | 4,483.7 MB (T2) / 4,482.9 MB (T3). Beside it: steady 1,673.9 / 1,692.2 MB; peak private commit 6,702.6 / 6,755.7 MB; VRAM max allocated 3,647.5 / 3,648.9 MB; nvidia-smi 528 → 4,313 → 528 MiB | `d-run-…-gpu-t2-choice.json`, `…-gpu-t3-noul.json` | **FAIL** |

**3 PASS / 4 FAIL.** The failing terms include accuracy and Brier, not only RSS, so D-r13's "FAIL (RSS only)" does not apply.

The notes, read against the same terms (they never replace the headline):
- **CPU:** T2 38 / 40, Brier 0.0503 and p95 4,043.3 ms. T3 33 / 40, Brier 0.124 and p95 3,295.8 ms. Peak RSS is about 8,121–8,126 MB. It fails
  more terms than the GPU.
- **Product-shaped:** T3 38 / 40 passes, but Brier 0.054 and p95 424.7 ms fail. T2 37 / 40 fails, Brier 0.058 fails and p95 69.2 ms passes. RSS
  is 4,482.9 / 4,483 MB.

## 7. Verdict

**FAIL. Four of the seven terms fail, so this is not "FAIL (RSS only)".** What follows, per the paste-in's (e) and E-d:

- **The local rung stays empty.** It is a note, not a stop.
- **D4 (g) is not built.**
- D2 §6's `auto` ladder starts at Jev and reports the local rung in `skipped` as `'no local model'`.

**No STOP**, for two reasons:
- The runtime runs on this laptop, on CUDA and on CPU (§3, §5).
- The numbers do not point to a different design than D2's: a candidate that fails the bar leaves the rung empty, as D2 §5.3 already says.

Section 9 is the recipe for a follow-up if a later candidate (or v12 with its fitted map, decider-0.8b, or a GGUF build) passes.

## 8. What the product-shaped note says about the framing

- **What "product-shaped" means here** (`K3\d-run.cjs` `PRODUCT_Q` / `productShaped`; the answer files' `notes`):
  - the state is the row's own text: for T2 the request the user typed; for T3 the row's text as D1 wrote it (the item + the request);
  - the question is a short generic instruction: T2 "Which ONE tool family must act on this request?", T3 "Does the item really do what the
    request asks, by plain meaning?";
  - D1's criteria are unchanged, and there is one row per request.
- **T3 (`score-…-gpu-t3-noul-product.md`):** 82.5 % → **95.0 %** (33 → 38 / 40) and Brier 0.122 → 0.054. By kind: caption 60.0 → 90.0 %,
  template 93.8 → 100.0 %, clip 85.7 → 92.9 %. Arabic is unchanged at 85.7 % (7 rows). Warm p95 rises from 227.2 to 424.7 ms, because the
  state is now the row's text (p50 54.7 → 54.1 ms). **So the T3 accuracy FAIL does depend on D1's framing** (state = the task rule, the row
  inside the question). In the product shape T3 meets the accuracy term, but it still misses Brier (0.054 > 0.05) and warm p95 (424.7 > 300 ms).
- **T2 (`score-…-gpu-t2-choice-product.md`):** 95.0 % → 92.5 % (38 → 37 / 40), Brier 0.053 → 0.058, ECE 0.061 → 0.150. Warm p95 falls from 92.5
  to 69.2 ms. Without the task rule in the state, routing loses a row.
- **Neither framing passes every term.** Peak RSS (about 4,483 MB) does not depend on the framing. The verdict stands under both framings, and
  the headline stays D1's framing (D-r12).
- **A fact for D4:** the framing moves Mapika's T3 by five rows. The hosted 40 / 40 rows were measured in D1's framing only (Open problem 1).

## 9. How D4 (g) productises it (facts only — D4 builds it only on a PASS)

- **The app's `pytorch` runtime** (`src/main/services/ai-runtime/catalogue.ts:15,23,57-90`): `AI_RUNTIME_VERSION` `2026.09.1`, two variants, each a
  prebuilt zip from `https://cdn.vidtsx.com/ai-runtime/2026.09.1-<variant>.zip` with a published sha256:
  **`cu126`** — 2,758,592,573 B zip / 4,613,287,893 B on disk, Python 3.11.15, **torch 2.14.0+cu126**, CUDA 12.6, driver ≥ 525.60;
  **`cpu`** — 279,969,216 B / 899,222,488 B, Python 3.11.15, torch 2.14.0+cpu. The variant is chosen by `chooseVariant(gpu, minDriver)`
  (`ai-runtime/install.ts:141`, `preflight.ts:45-58`: NVIDIA + driver floor + VRAM floor → cu126); the install verifies the reported torch
  version through a pipeline self-test (`install.ts:195-206`). The zips are built by `scripts/ai-runtime/build-stack.ps1` from
  `scripts/ai-runtime/requirements.in` → `requirements.<variant>.lock` ("Never edit the .lock files by hand", `requirements.in:1-5`). The
  python-models registry ties its models to it: `runtime: { id: 'pytorch', stack: PYTHON_MODEL_STACK }`, `PYTHON_MODEL_STACK = '2026.09'`,
  `needs: 'ai-runtime'` (`src/main/services/python-models/registry.ts:39,54,71,112`).
- **How it runs Python today:** one process PER REQUEST — `spawn(python, [runnerPath, '--request', <tmp json>])`
  (`src/local-python-engine/python-runner.ts:4,102`), runner files under `getPipelinesDir()` = `resources/pipelines/<pipeline>/runner.py`
  (`src/main/utils/paths.ts:209-213`; `python-models/service.ts:265`); the service owns the queue, one worker at a time ("nothing else spawns
  Python", `service.ts:4`). The worker env (`python-runner.ts:28-43`) sets `PYTHONUTF8`, `PYTHONIOENCODING`, `HF_HUB_OFFLINE=1`,
  `TRANSFORMERS_OFFLINE=1`, `HF_HUB_DISABLE_TELEMETRY=1`, and `CUDA_VISIBLE_DEVICES=-1` to force the CPU; it does **not** set
  `TORCHDYNAMO_DISABLE` (D3 always set it). A decider needs the persistent shape of §4 instead (D2 §5.3: `src/local-decider-engine/decider-host.ts`).
- **Do decider-ai's dependencies fit the runtime?** Against `scripts/ai-runtime/requirements.cu126.lock`: present — torch 2.14.0+cu126 (decider-ai
  pins no torch version), transformers 5.16.1 (meets decider-ai's `>=5` and flash-linear-attention's `>=5.6.2,<6`), numpy 2.4.6,
  huggingface-hub 1.30.0, jinja2 3.1.6, einops 0.8.2 (fla-core's only dependency), safetensors 0.8.0, tokenizers 0.23.2; Python 3.11.15 meets
  `>=3.11`. **Absent: `decider-ai`, `flash-linear-attention`, `fla-core`** — so adding them means a new runtime build (requirements.in, both
  locks, both zips, the catalogue entry and `AI_RUNTIME_VERSION`). **Not measured:** whether transformers 5.16.1 knows `qwen3_5_text` (the
  checkpoint was saved with 5.17.0, `M\config.json:51,72`; D3 ran 5.22.1), and whether torch 2.14.0+cu126 / Python 3.11 give the same answers
  as D3's torch 2.14.1+cu130 / Python 3.13.2.
- **Where the worker would live:** the app ships its Python files under `resources/pipelines/` (extraResources, `paths.ts:209-213`), so the
  worker (`K3\mapika_worker.py` is the prototype) would sit there beside the one-shot runners, spawned by the host D2 §5.3 names, with the
  runtime's `python.exe` (`aiRuntimePythonPath`, `ai-runtime/manifest.ts:92-93`) and `TORCHDYNAMO_DISABLE=1` added to its env.
- **First-use download (pin `revision="v11"`, D-r14)** — HF repo `Mapika/decider-2b`, the v11 revision's files from `reports\raw-hub\api-decider-2b-v11.json`
  (fetched 2026-10-31 08:54–08:55): `model.safetensors` 3,763,692,048 B, sha256 `acaef2228b134dcdc20cad4ee79219482c927ec819aa3687b9b8a575c338817f`;
  `tokenizer.json` 19,989,325 B, sha256 `06b9509352d2af50381ab2247e083b80d32d5c0aba91c272ca9ff729b6a0e523`; small files (git blob ids only — the API
  publishes no sha256 for non-LFS files): `config.json` 1,790 B, `decider_config.json` 1,240 B, `tokenizer_config.json` 1,127 B, `chat_template.jinja`
  7,755 B, `generation_config.json` 116 B (these seven = 3,783,693,401 B). The size cannot tell v11 from v12 (same 3,763,692,048 B, a-facts §1): the
  sha256 must. Which of the files `Decider()` actually opens was not traced in D3. D2 §5.3's place: `userData/models/decisions/<id>/`.
- **One row per forward pass on this GPU class:** a packed System One call (40 questions, `independent=True` forks the state cache to 40 rows)
  reached torch max allocated 6,185 MB / reserved 6,746 MB on the 6,144 MiB card (nvidia-smi 5,871 MiB, 100 %) and took 251,311.1 ms, vs 89.3 ms
  per one-row request (`reports\d-run-mapika-decider-2b-v11-gpu-t2-choice-packed.json`; §5) — the product worker sends one row (or a few) per
  forward on a 6 GB card.
- **Memory of one worker on CUDA** (`reports\d-run-mapika-decider-2b-v11-gpu-t2-choice.json`): peak private commit 6,702.6 MB, load-time peak RSS
  4,483.7 MB (the weights pass through RAM before VRAM), steady RSS 1,673.9 MB, VRAM max allocated 3,647.5 MB (nvidia-smi 4,313 MiB of 6,144 MiB
  loaded) — the commit counts against main's "nothing blocks main" budget and any other model on the card.
- **Lighter rungs (facts, not measured — D-r14):** decider-0.8b (1,504,827,608 B, card "within 1 to 4 points of the 2B, 1.5x faster"); the
  maker's GGUFs are v12 builds (Q8_0 2,012,012,064 B, Q4_K_M 1,274,396,192 B), and v12's Noul temperature is 0.05 = uncalibrated by default
  (its card gives a fitted map: noul 3.185) — a GGUF rung would need its own calibration and runtime (`raw-hub\api-decider-0.8b.json`,
  `api-decider-2b-GGUF.json`, `card-README.md:37-41`; a-facts §3–§5).

## 10. Open problems

1. **Framing and the hosted adapters (for the orchestrator / D4; not a different design, so not BLOCKED).** The product calls of D2 §10.1–10.2
   will send one state and one question, close to §8's product shape. D1 measured Jev and MSD1 only in D1's framing. For Mapika the framing
   moves T3 by 5 / 40 (§8). Whether the hosted 40 / 40 rows hold in the product shape is not measured. D2 §15.1's gated LIVE test sends D1's
   fixtures through the product adapter, so which framing that adapter sends decides what the test compares against.
2. **CPU as the default.** D2 §5.3 says "CPU by default, GPU as a setting" for any local candidate. For decider-2b the CPU path takes
   2,595–3,872 ms p50 per request and holds about 8.1 GB of RSS (§5.2), far outside the bar. This is moot while the rung is empty, but a fact for
   any later candidate's default.
3. **Not tried:** a lower-peak load (D-r13 allows a documented `Decider` argument or a different step order in the worker; moot, since
   other terms fail); `use_graphs=False` on CUDA; the worker without `TORCHDYNAMO_DISABLE=1`; the app runtime's transformers 5.16.1 /
   torch 2.14.0+cu126 / Python 3.11 with this checkpoint.
4. **Not measured (D-r14):** v12 with its fitted map, decider-0.8b, the GGUF builds. **Not run (D-r15):** T3 packed (cut) and T1 packed.
5. `d-summary.md` prints `null` / `undefined` in the packed row's warm cells (no warm request in that run). This is cosmetic, and §5.2 shows
   them as "—".

status: FAIL — the local rung stays empty: T3 33/40, Brier 0.053 (T2) / 0.122 (T3) and peak RSS 4,483.7 MB fail; T2 38/40, off-list 0 and warm p95 92.5 / 227.2 ms pass (not RSS-only; D4 (g) not built)
