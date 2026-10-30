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
