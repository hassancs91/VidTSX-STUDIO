# D3 — log (append-only, one dated line per event)

- 2026-10-31 08:52 · orchestrator: HANDOFF.md + this LOG created at `b2b8a02` + the session-2 header commit; ruling D-r12 (framing) in
  ORCHESTRATOR.md. Builder #1 next: steps (a) facts + (b) the venv.
- 2026-10-31 08:57 · builder #1: (a) done — `K3\reports\a-facts.md` + `K3\reports\raw-hub\`; local weights = Hub tag v11 (sha256 equal);
  Hub main = v12 since 2026-10-20; GGUF / ONNX exist; decider-ai 1.10.0 declares flash-linear-attention. Step (b) next. (Commit `b5a3d3e`
  08:57:20; this line first carried a guessed "09:06", corrected to the commit time at 09:08.)
- 2026-10-31 09:08 · builder #1: (b) done — venv `B3\py-scratch\mapika-venv` (Python 3.13.2, torch 2.14.1+cu130 from pip's cache, decider-ai
  1.10.0, transformers 5.22.1; 3,417,428,997 B); CUDA works; two one-question GPU smokes (run 1 under Defender load, repeated) → identical
  answers; numbers in `K3\reports\b-venv.md` + `b-smoke-gpu-run{1,2}.json`. HANDOFF — step (c) next.
- 2026-10-31 09:28 · builder #2: (c) done — `K3\mapika_worker.py` + `K3\mapika-host.cjs` (+ `d1-questions.cjs`), round trip 3/3 T2 rows
  (`reports\c-host-smoke-cuda.json`; commit `15b00d8`); (d) GPU via `K3\d-run.cjs`: T2 95.0 % Brier 0.053, T3 82.5 % Brier 0.122, T1 73.3 %,
  warm p95 92.5 / 227.2 / 598.4 ms, peak RSS ≈ 4,483 MB (all in `reports\d-summary.md`); T2 packed spilled past the 6 GB card (251 s for one call).
  HANDOFF — T3 / T1 packed + CPU note next, then (e).
