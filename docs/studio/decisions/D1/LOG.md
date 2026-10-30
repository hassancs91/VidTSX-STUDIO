# D1 — log (append-only, one dated line per agent)

- 2026-10-30 15:50 · orchestrator · HANDOFF.md created (status NEW); keys unset → hosted rows DEFERRED-HASAN (D-r1); D-r2 fixes
  "wrong-confident" for probabilistic answers. Builder #1 next.
- 2026-10-30 15:58 · builder #1 · step 1 DONE → `K\reports\a-sources.md` (22 primary sources, 15 contradictions C1–C15, no candidate
  drops; step-4 pick `qwen2.5-0.5b-q8` → `qwen3.5-0.8b-q8` → d1-omni-600M-GGUF Q8_0; node-llama-cpp `evaluateWithMetadata`
  `{probabilities:true}`); open problems P1–P5 (Laya multilingual has no official ONNX; OpenRouter decisions ≠ openai-compat path). Hand-off.
- 2026-10-30 16:12 · builder #2 · step 2 DONE → `K\fixtures\t1-pick.json` (240 rows, 187 named / 53 ∅, (c) top-1 72.2 %, 4,632 noul + 240
  choice questions), `t2-routing.json` (40, 10 Arabic, 7 two-family), `t3-verify.json` (40, 20 / 20, 7 Arabic, file:line checked);
  `K\measures.cjs` + `K\score.cjs` (answer format `vidtsx-d1-answers/1`); `K\selfcheck.cjs` 17 / 17 PASS incl. S1's picks → R@1 80.7 % /
  wrong-confident 6.3 % / correct none 79.2 % exactly; write-up `K\reports\b-tasksets.md`; open P6 (4,632 not 4,800), P7 (T2 / T3 labels
  one builder's judgement). Hand-off.
- 2026-10-30 16:28 · builder #3 · step 3 PART 1: route (1) `laya-ts` did not run — not on npm (registry "Not found"), weights only via a
  Python export, no official ONNX on HF; route (2) = `desplega/laya-onnx` `multilingual/fp32` (split encoder + head = laya-ts's layout,
  sha256 manifest; 1,324,748,627 B stated first, guard passed). Kit: `K\laya-run.cjs` (laya-ts pre / post-processing ported, worked
  examples E1–E3, task runs → `vidtsx-d1-answers/1`), `K\dl-parallel.sh`. HF served ~0.4 MB/s → download PAUSED at 150 MB (resumable
  parts, every process stopped); no model run yet; open P8 (speed), P9 (framing review). Hand-off at the call budget.
- 2026-10-30 16:47 · builder #4 · step 5 DONE: wt/out built (rc 0), profile `decisions-D1` (no settings.db*), CDP 9300, root set first;
  16 / 40 keyless calls (t1-06's cut response re-asked once as a counted call) → `K\reports\c-baseline.md`: T1 hard R@1 80.7 %, wrong-
  confident 7.1 % (S1 6.3 %), correct none 75.5 %, same pick as S1 on 225 / 240; T2 100 %, T3 97.5 %; instance stopped (0 left). Step 6
  DONE: `K\hosted-run.cjs` dry-run → `K\reports\c-hosted-dryrun.md` (138 requests, $0.334 upper, no network; OpenRouter API reference
  read). Open P10 (D-e "calls" = requests?), P11 (truncated success text), P12 (baseline reference for D-r2). `llama-run.cjs` not written.
  Hand-off at the call budget.
- 2026-10-30 16:58 · builder #5 · step 4 PART 1: `K\llama-run.cjs` (option probabilities via `controlledEvaluate` … `generateNext.probabilities`,
  temperature 0 = greedy chain, full-vocabulary map; single-token label check; prefix reuse + one fresh-eval check; built-in resource guard)
  + `K\temp-oof.cjs` (2-fold OOF temperature NOTE, checked on the synthetic files); GPU probe: Vulkan only (CUDA `NoBinaryFoundError`),
  Vulkan VRAM state misread → `--gpu-layers max` (P13). No model loaded: neither GGUF had landed at 16:56:49 (d1 51 %, Qwen 32 %).
  Hand-off with the next step = d1 `--info` + self-test, then Qwen's four runs.
