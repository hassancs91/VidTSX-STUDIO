# D1 — the spike report: decision models (hosted × 2, local, keyless LLM baseline) on three small task sets

> Part D1 of decision models (branch `decision-models`), written by D1 builder #8 on 2026-10-30. **No product code:** `src/` is unchanged
> by D1 (`git log efa5e0b..HEAD -- src scripts package*.json` is empty as of `ad436b8`, re-checked in `D1/HANDOFF.md` "Verified"). **Every
> number below names the kit report file it comes from.** The kit is `K` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\` (outside the
> tree); a bare file name below means `K\reports\<name>`. Big outputs and the model files are under `B` =
> `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\`. The D1 records are `docs/studio/decisions/D1/HANDOFF.md` and `D1/LOG.md`; the
> rulings D-r1 … D-r7 are in `docs/studio/decisions/ORCHESTRATOR.md`.

## 0. Headline

- **STOP judgement: BLOCKED — STOP 1 and STOP 2 fire, STOP 3 fires for the local leg (§12).** No local candidate passes the rule's
  evaluable terms (D-r1): both GGUFs that ran fail warm p95 ≤ 300 ms (best fair figures: Qwen2.5-0.5B T1 noul 388.7 ms, Qwen3.5-0.8B T2
  353.3 ms — `c-llama.md` §6, §8.2); d1-omni-600M did not load; Laya multilingual is a NOTE only (D-r7). No measured decision model beats
  the keyless baseline on T1's wrong-confident rate under D-r2 (best local R@1 48.7 % against the 75.7 % floor — `c-llama.md` §8.1). **Every
  hosted decision model is DEFERRED-HASAN** (no key set): their runners are built and dry-run (138 requests, $0.334 upper bound —
  `c-hosted-dryrun.md`), so the two hosted terms of the rule and any hosted "beats the baseline" are unmeasured, not failed.
- **The keyless LLM baseline** (the app's `claude-subscription`, model `claude-sonnet-5-5`, 16 of 40 calls): T1 R@1 151 / 187 = 80.7 %,
  wrong-confident 17 / 240 = 7.1 %, correct none 40 / 53 = 75.5 %; T2 100.0 % (Arabic 10 / 10); T3 97.5 % (Arabic 7 / 7); ~10–16 s per
  batched call (`c-baseline.md`).
- **Best local candidate that ran: Qwen3.5-0.8B Q8_0** through the SemIf-style option-probabilities adapter on node-llama-cpp 3.18.1
  (Vulkan): T2 82.5 %, T3 85.0 %, but T1 unusable as a pick — noul 87.0 % (below always-No 93.1 %), choice 47.5 %, best R@1 48.7 % at
  wrong-confident 38.3 % (`c-llama.md` §8.1). Qwen2.5-0.5B is worse on every task (T1 noul 43.2 %, T2 75.0 %, T3 67.5 % — `c-llama.md` §5).
- **Laya multilingual (community ONNX export) — NOTE only:** its export FAILED the worked-example gate (E2 answers `sales` 0.5811 where the
  card prints `billing` — `c-laya.md` §4); D-r7 ran the four tasks once as a labelled NOTE (**unverified**): T1 noul 17.2 % (P(true) ≥ 0.5 on 4,138 / 4,632), T1 choice 50.4 % with
R@1 55.6 % at wrong-confident 39.2 % (τ 0.5), T2 55.0 %, T3 60.0 %; per question p95 469.2 ms (T1 noul), OS peak RSS 3,109 MB
(`c-laya.md` §8) — no better than the GGUFs, and never eligible.
- **For D2:** node-llama-cpp's full-vocabulary probability `Map` is ~5/6 of a warm question (p95 279.0 ms with it vs 61.6 ms token-only —
  `c-llama-mapcost-qwen2.5-0.5b-vulkan.json`), so the 300 ms term is partly a runtime artefact; the laptop's GPU path is Vulkan only, with a
  broken VRAM reading; d1-omni needs `llama-server` or ONNX, not node-llama-cpp; OpenAI's Decisions API is not System One-shaped and
  OpenRouter's Decisions API requires noul `criteria` (§10).

## 1. The task sets (`b-tasksets.md`; fixtures `K\fixtures\*.json`, built by `build-t1.cjs` / `build-t2-t3.cjs`, self-check 17 / 17 PASS)

| set | rows | labels | who labelled (`labelledBy`) | Arabic | questions |
|---|---|---|---|---|---|
| **T1** — library search's pick + "nothing fits" (S1's 240-row (d) sample over the top-20 of S1's (c) RRF60 + multilingual-e5-small) | 240 = 187 named / 53 `∅`; 31 `'x\|∅'` (named, "none" also allowed); 228 sfx / 12 music | allowed clip ids per row (+ `none` on `∅` / `'x\|∅'` rows) | S1's labels, unchanged: corpus (E3, committed) 99 · S1 plain meaning 20 · verifier r5 31 · S1 per verb 36 · S1 widened 26 · S1 new rows 28 | 10 (`S1-own-ar`, all named) | **4,632 noul** (321 true; music rows have 6 candidates, so not 4,800) + **240 choice** (20 + "none of these"; 7 on music rows) |
| **T2** — Studio-assistant request → tool family | 40; 7 rows with two allowed families | cut 8 · audio 7 · shots 8 · captions 7 · export 5 · none 5 (primary), mapped to 18 of the 29 `STUDIO_TOOL_IDS` with file:line | D1 builder #2, plain meaning (requests written for D1) | 10 | 40 choice (6 families) |
| **T3** — yes / no verification from the app's own data | 40 = 20 yes / 20 no | template description vs request 16 · caption style vs request 10 · library clip vs script line 14; 12 source files, every file:line checked | D1 builder #2, plain meaning | 7 | 40 noul |

- T1 self-check against S1 (`b-tasksets.md` §1): (c)'s top-1 on these rows 135 / 187 = **72.2 %**; top-20 ceiling 186 / 187 (the miss: #1487
  "a splashing sound", an `'x|∅'` row); S1's own picks scored by `score.cjs` reproduce R@1 80.7 %, wrong-confident 6.3 %, correct none 79.2 %
  exactly (`b-selfcheck.md`).
- Judgement calls a reviewer can overrule (`b-tasksets.md` §2, HANDOFF P7): a question about a tool is `none`; "Remember …" / notes are
  `none`; `transcribe_asset` sits under captions.
- Measures (`measures.cjs` header): accuracy; Brier (noul: binary; choice: top-label, and multiclass beside it); ECE over 10 equal-width
  bins; the reliability table; selective accuracy at P ≥ 0.5 / 0.7 / 0.9 with coverage; T1's S1 measures per D-r2 (R@1, pick acc,
  wrong-confident, correct none, false none) at each τ; subsets (Arabic, English, CORPUS / HELD-OUT, T3 kind).

## 2. The candidates — what ran, what did not, and why

| candidate (Hasan's slot) | ran? | why / how | report |
|---|---|---|---|
| TypeSafe Jev `jev-1.14.0` (D-a) | **DEFERRED-HASAN** | `JEV_API_KEY` unset; runner `K\hosted-run.cjs` built + dry-run (46 requests, ≈ $0.076 upper) | `c-hosted-dryrun.md` |
| OpenAI Decisions API `gpt-6-luna` (D-b first) | **DEFERRED-HASAN** | `OPENAI_API_KEY` unset → access not checkable; runner dry-run (46 requests, ≈ $0.182 upper) | `c-hosted-dryrun.md` |
| Microsoft-Decision-1 via OpenRouter's Decisions API (D-b fallback) | **DEFERRED-HASAN** | `OPENROUTER_API_KEY` unset; runner dry-run (46 requests, ≈ $0.076 upper) | `c-hosted-dryrun.md` |
| Laya multilingual (D-c 1), community export `desplega/laya-onnx` `multilingual/fp32` on onnxruntime-node 1.24.3 | **NOTE only (D-r7)** | official route impossible (`laya-ts` not on npm; official weights are safetensors only — no pip / own export, D-r3); the community export **failed the worked-example gate** (E2 `sales` 0.5811 vs `billing` 0.4168; E1 `billing` at 0.9929 vs the README's 0.86), port audited line by line, no bug found → four runs once as a labelled NOTE, never eligible for the rule | `c-laya.md` |
| node-llama-cpp option-probabilities adapter (D-c 2, SemIf method) — **Qwen2.5-0.5B-Instruct Q8_0** (catalog `qwen2.5-0.5b-q8`) | **yes** | Vulkan, 25 / 25 layers; self-test PASS (map = vocabulary, Σ 1.00001, 0 missing option tokens) | `c-llama.md` §4–§6 |
| same adapter — **Qwen3.5-0.8B Q8_0** (catalog `qwen3.5-0.8b-q8`, D-r6) | **yes** | Vulkan 25 / 25 layers, `--thoughts discourage` (P(`<think>`) was 0.9999 at the answer slot without it); self-test PASS | `c-llama.md` §8 |
| Liquid d1-omni-600M Q8_0 (D-c +) | **did not run** | node-llama-cpp 3.18.1's llama.cpp b8390 refuses it on Vulkan AND CPU: `missing tensor 'blk.16.ffn_gate.weight'`; its GGUF is an encoder (`lfm2.attention.causal false`) + 2 decision blocks + a `cls` scalar head + a `systemone` template — not a causal LM, so no plain-LM probe either | `c-llama.md` §3 |
| Liquid d1-3B | note only | named in d1-omni's card table only; its own card not read | `a-sources.md` §8 |
| **Keyless LLM baseline** — the app's `claude-subscription` via `window.api.llmGenerate` (isolated profile, CDP 9300) | **yes** (16 / 40 calls) | T1 as S1's top-20 choice in 12 batches of 20 (+ a 0–100 confidence line, a NOTE), T2 + T3 batched | `c-baseline.md` |

## 3. Primary-docs facts (condensed from `a-sources.md`; every fact read 2026-10-30)

Sources (URL — `a-sources.md` "Primary sources read"): P1 https://docs.typesafe.ai/api · P2 https://docs.typesafe.ai/models · P3
https://docs.typesafe.ai/legal.md · P4 https://developers.openai.com/api/docs/guides/decisions · P5
https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision · P6
https://commandline.microsoft.com/microsoft-decision-1-model-foundry/ · P7 https://openrouter.ai/blog/insights/what-is-jev/ · P8
https://huggingface.co/convaiinnovations/laya · P9 https://huggingface.co/convaiinnovations/laya-multilingual · P10
https://github.com/NandhaKishorM/laya · P11 https://registry.npmjs.org/@receptron/laya · P12 https://github.com/receptron/laya · P13
https://huggingface.co/receptron/laya-onnx/tree/main · P14 https://raw.githubusercontent.com/TheoLeeCJ/SemIf/master/README.md · P15
https://huggingface.co/LiquidAI/d1-omni-600M · P16 https://huggingface.co/LiquidAI/d1-omni-600M-GGUF · P17 the HF API search for d1-omni
builds · P18 https://www.liquid.ai/lfm-license · P19 https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF · P20
https://huggingface.co/Qwen/Qwen3.5-0.8B · P21 the installed `node-llama-cpp` 3.18.1 types · P22 `src/llm-engine/model-registry.ts`. Added
later: **P23** OpenRouter's API reference "Submit a Decisions request"
(https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request, read 16:43, `c-hosted-dryrun.md` §1); the npm
registry `https://registry.npmjs.org/laya-ts` → `{"error":"Not found"}` and the HF API trees (read 16:16–16:17 and 18:29, `c-laya.md` §2).
Method caveat (`a-sources.md`): WebFetch returns an extraction of the page, not the raw page. Aggregator blogs were listed as secondary
and not used.

| candidate | contract · question types | limits | Arabic | price | retention | licence · weights / runtime / size |
|---|---|---|---|---|---|---|
| Jev (P1–P3) | `POST https://api.typesafe.ai/v1/systemone`, System One: `model`, `state`, `questions` keyed; `noul` (criteria optional), `choice` (1–255 options), `score` (1–10 levels), `box` (images) | 64k context per request / 32k per question by default, 262k opt-in; no per-request question cap; no batch endpoint documented | **unknown** ("English primary … others not equally well") | $0.042 / M input, output free | DPA (period not stated); not trained on customer data; ZDR on request | hosted; Master Customer Agreement (not read) |
| OpenAI Decisions (P4) | `POST /v1/decisions`, GA, model `gpt-6-luna`; `input` + `questions[]` (1–400) of `predicate` / `choice` (`choices[]`) / `score` (2–10) — **not System One** | context, options per choice, batch: unknown | **unknown** | $0.10 / M uncached input, output free (regional / long-context multipliers) | ZDR + HIPAA for eligible customers; US + EU processing | hosted |
| Microsoft-Decision-1 (P5–P7, P23) | Foundry `…/providers/microsoft/v1/systemone` (System One-shaped); OpenRouter `POST https://openrouter.ai/api/alpha/decisions` (System One; **noul `criteria` {true,false} REQUIRED there**) | unknown (none stated) | **unknown** | $0.042 / M input, output free | unknown | hosted; post-trained from Qwen3.5-9B |
| Laya multilingual (P8–P13) | `state` + typed questions (`choice`, `score`, `noul`) → answers with `confidence`, `probabilities`; one forward pass for many questions | keep `choice` under ~20 options (trim starts), server cap 100; 1,024 tokens (≤ 8,192); `head_max_len` 256 | **yes, weak** ("Arabic 0.110 → 0.400" on its benchmark) | local, $0 | local | weights Apache-2.0; mmBERT-base 322M, ≈ 647 MB safetensors; "over-confident as shipped", **no fitted temperatures**; official runtime Python (`pip install laya`) or `laya-ts` (not published on npm); `@receptron/laya` = community wrapper, ENGLISH bundle only |
| SemIf method (P14) | per-question `options[]` → typed option scores (not System One); one forward pass reading option logits | — | unknown | — | — | code MIT; its own ladder: Qwen3-0.6B 0.440 balanced acc, MiniCPM5-2B 0.686, Qwen3.5-4B 0.813 |
| Qwen2.5-0.5B-Instruct Q8_0 (P19, P22) | causal LM (used through the adapter) | 32,768 context | **yes** (card: "… Arabic …") | $0 | local | Apache-2.0; catalog says 531,000,000 B, the file is 675,710,816 B (P5) |
| Qwen3.5-0.8B Q8_0 (P20, P22) | causal LM, thinking template | 262,144 | **unknown** (201 languages, Arabic not named) | $0 | local | Apache-2.0 (base); 811,843,840 B (unsloth re-quant) |
| node-llama-cpp 3.18.1 (P21) | `controlledEvaluate(… generateNext: { probabilities: true })` / `evaluateWithMetadata(…, { probabilities: true })` → `Map<Token, number>` | — | — | — | — | MIT; bundled llama.cpp b8390; on this laptop GPU = Vulkan only |
| Liquid d1-omni-600M (P15–P18) | `system_one(state, questions, images, audio)`; `noul` / `choice` / `score` (2–10); official GGUF run by `llama-server … POST /v1/systemone` | 16,384 context; options per question unknown | card: unknown; **its GGUF metadata lists `ar`** among 15 languages (`c-llama.md` §2) | $0 | local | **LFM Open License v1.0** — commercial use only below $10 M annual revenue; Q8_0 GGUF 407 MB; fitted temperatures in the GGUF |

**Contradictions with `NEXT-SESSION.md`'s "What the search found"** (`a-sources.md` C1–C15, condensed): **C1** Jev "released 2026-09-15" —
not confirmed (jev-1.14.0 "available from October 14, 2026"); **C2** Jev "32k context" — 64k per request / 32k per question, 262k opt-in;
**C3** Jev "70–500 ms" — not stated by TypeSafe (unknown); **C4** Jev "languages not stated" — stated: English primary, others weaker;
**C5** OpenAI "preview / beta" — GA, `gpt-6-luna`, 1–400 questions; **C6** System One "the contract others clone" — OpenAI and SemIf are not
System One-shaped; **C7** Microsoft-Decision-1 "through the app's openai-compat / OpenRouter path" — OpenRouter serves it on a separate
Decisions API, so `openai-compat-provider` cannot call it (D-r4); **C8** Laya "~1.7 GB, ~2 GB RAM, 512 tokens, ~140 ms / 3 q" — those are the
receptron ENGLISH bundle's; **C9** Laya "≤ ~20 options" — a recommendation, hard cap 100; **C10** `@receptron/laya` is community, with no
multilingual weights; **C11** multilingual = mmBERT-base, not ModernBERT; **C12** Liquid "open weights" — revenue-capped LFM licence; **C13**
d1-omni's own path is `llama-server` / transformers, not node-llama-cpp (confirmed in step 4: it does not load); **C14** Jev hosted only —
consistent; **C15** prices — confirmed (OpenAI output also free). Found later: the official `laya-ts` is not on npm at all (`c-laya.md` §2).

## 4. Results per candidate × task (ALL rows; Brier / ECE on the model's own probabilities)

| candidate · task · mode | n | accuracy | Arabic | Brier | ECE | sel ≥ 0.5 acc (cov) | sel ≥ 0.7 | sel ≥ 0.9 | score file |
|---|---|---|---|---|---|---|---|---|---|
| **baseline (hard)** T1 choice | 240 | 88.8 % | 100.0 % (10) | 0.113 | 0.113 | 88.8 % (100 %) | 88.8 % (100 %) | 88.8 % (100 %) | `c-baseline-t1-choice-hard.md` |
| baseline (verbalised, NOTE) T1 choice | 240 | 88.8 % | 100.0 % (10) | 0.095 | 0.104 | 89.8 % (98.3 %) | 96.1 % (74.6 %) | 98.7 % (31.3 %) | `c-baseline-t1-choice-verbalised.md` |
| **baseline (hard)** T2 choice | 40 | 100.0 % | 100.0 % (10) | 0.000 | 0.000 | 100.0 % (100 %) | 100.0 % (100 %) | 100.0 % (100 %) | `c-baseline-t2-choice-hard.md` |
| baseline (verbalised, NOTE) T2 | 40 | 100.0 % | 100.0 % (10) | 0.036 | 0.123 | 100.0 % (100 %) | 100.0 % (82.5 %) | 100.0 % (77.5 %) | `c-baseline-t2-choice-verbalised.md` |
| **baseline (hard)** T3 noul | 40 | 97.5 % | 100.0 % (7) | 0.025 | 0.025 | 97.5 % (100 %) | 97.5 % (100 %) | 97.5 % (100 %) | `c-baseline-t3-noul-hard.md` |
| baseline (verbalised, NOTE) T3 | 40 | 97.5 % | 100.0 % (7) | 0.022 | 0.075 | 97.5 % (100 %) | 100.0 % (95.0 %) | 100.0 % (82.5 %) | `c-baseline-t3-noul-verbalised.md` |
| Qwen2.5-0.5B T1 noul | 4,632 q | 43.2 % | 18.8 % (186 q) | 0.336 | 0.488 | 43.2 % (100 %) | 40.1 % (45.0 %) | 44.2 % (6.3 %) | `c-llama-qwen2.5-0.5b-t1-noul.md` |
| Qwen2.5-0.5B T1 choice | 240 | 27.1 % | 0.0 % (10) | 0.210 top-label (0.912 multiclass) | 0.180 | 42.2 % (34.6 %) | 53.8 % (10.8 %) | — (0 %) | `c-llama-qwen2.5-0.5b-t1-choice.md` |
| Qwen2.5-0.5B T2 choice | 40 | 75.0 % | 80.0 % (10) | 0.155 (0.383 multiclass) | 0.119 | 79.4 % (85.0 %) | 87.5 % (60.0 %) | 100.0 % (35.0 %) | `c-llama-qwen2.5-0.5b-t2-choice.md` |
| Qwen2.5-0.5B T3 noul | 40 | 67.5 % | 57.1 % (7) | 0.218 | 0.256 | 67.5 % (100 %) | 71.4 % (87.5 %) | 84.2 % (47.5 %) | `c-llama-qwen2.5-0.5b-t3-noul.md` |
| Qwen3.5-0.8B T1 noul | 4,632 q | 87.0 % | 93.5 % (186 q) | 0.132 | 0.270 | 87.0 % (100 %) | 98.4 % (45.8 %) | 100.0 % (0.8 %) | `c-llama-qwen3.5-0.8b-t1-noul.md` |
| Qwen3.5-0.8B T1 choice | 240 | 47.5 % | 40.0 % (10) | 0.269 top-label (0.690 multiclass) | 0.125 | 45.2 % (17.5 %) | 42.9 % (2.9 %) | — (0 %) | `c-llama-qwen3.5-0.8b-t1-choice.md` |
| Qwen3.5-0.8B T2 choice | 40 | 82.5 % | 60.0 % (10) | 0.205 (0.355 multiclass) | 0.307 | 95.5 % (55.0 %) | 100.0 % (22.5 %) | 100.0 % (5.0 %) | `c-llama-qwen3.5-0.8b-t2-choice.md` |
| Qwen3.5-0.8B T3 noul | 40 | 85.0 % | 57.1 % (7) | 0.123 | 0.174 | 85.0 % (100 %) | 95.8 % (60.0 %) | 100.0 % (20.0 %) | `c-llama-qwen3.5-0.8b-t3-noul.md` |
| Laya multilingual T1 noul — *NOTE: community export FAILED the worked-example gate (E2) — unverified* | 4,632 q | 17.2 % | 8.6 % (186 q) | 0.644 | 0.735 | 17.2 % (100 %) | 13.8 % (85.1 %) | 12.4 % (47.6 %) | `c-laya-t1-noul.md` |
| Laya multilingual T1 choice — *NOTE, unverified* | 240 | 50.4 % | 20.0 % (10) | 0.327 top-label (0.779 multiclass) | 0.298 | 54.1 % (85.4 %) | 56.5 % (70.8 %) | 65.5 % (48.3 %) | `c-laya-t1-choice.md` |
| Laya multilingual T2 choice — *NOTE, unverified* | 40 | 55.0 % | 50.0 % (10) | 0.283 (0.694 multiclass) | 0.267 | 57.1 % (87.5 %) | 64.3 % (70.0 %) | 77.8 % (45.0 %) | `c-laya-t2-choice.md` |
| Laya multilingual T3 noul — *NOTE, unverified* | 40 | 60.0 % | 57.1 % (7) | 0.306 | 0.284 | 60.0 % (100 %) | 59.4 % (80.0 %) | 58.8 % (42.5 %) | `c-laya-t3-noul.md` |

- **The baseline has no calibrated probability** (D-a…D-c, D-r1): `hard` = P 1 on its answer (S1-style), so its Brier / ECE / selective
  figures are degenerate; `verbalised` = its stated 0–100 confidence, an uncalibrated NOTE (`c-baseline.md`).
- **Base rates that matter:** T1 noul has 321 true of 4,632 → "always No" = **93.1 %**; Qwen3.5-0.8B's 87.0 % is below it (P(Yes) ≥ 0.5 on
  610 questions), Qwen2.5-0.5B's 43.2 % far below it (P(Yes) ≥ 0.5 on 2,796) (`c-llama.md` §5, §8.1). Qwen2.5-0.5B's T1 choice puts the top
  on "none of these" on 180 / 240 rows and on letter J on 56 — positional, not semantic (`c-llama.md` §5).
- Subsets: Qwen2.5-0.5B T3 groups template 81.3 % / caption 50.0 % / clip 64.3 %; Qwen3.5-0.8B T3 template 87.5 % / caption 90.0 % / clip
  78.6 %, T2 English 90.0 %, T3 English 90.9 %, T1 noul CORPUS 90.5 % / HELD-OUT 84.7 %; baseline T3 template 93.8 % / caption 100.0 % / clip
  100.0 % (`c-llama.md` §5, §8.1; `c-baseline.md`).

### 4.1 The reliability tables

Each score file holds its 10-bin reliability table (bin, n, mean p, observed frequency): `c-llama-qwen2.5-0.5b-<task>-<mode>.md`,
`c-llama-qwen3.5-0.8b-<task>-<mode>.md`, `c-baseline-<task>-<mode>-verbalised.md`, `c-laya-<task>-<mode>.md` (+ `-oofT` for the temperature
NOTE). The shapes, from `c-llama.md`: Qwen2.5-0.5B T1 noul is above the diagonal in every bin from 0.1 (0.9–1.0: n 209, mean p 0.932,
observed 0.239 — over-confident Yes); Qwen3.5-0.8B is UNDER-confident on the noul tasks (out-of-fold T < 1, §6).

### 4.2 The Arabic subset (from the score files above)

| candidate | T1 noul (186 q) | T1 choice (10) | T1 D-r2 R@1 (10 rows) | T2 (10) | T3 (7) |
|---|---|---|---|---|---|
| baseline (hard) | — (not asked as noul) | 100.0 % | — | 100.0 % | 100.0 % |
| Qwen2.5-0.5B | 18.8 % | 0.0 % | noul 4 / 10 at every τ; choice 0 / 10 | 80.0 % | 57.1 % |
| Qwen3.5-0.8B | 93.5 % | 40.0 % | noul 5 / 10 at τ 0.5, 0 / 10 at 0.7 / 0.9; choice 1 / 10 at τ 0.5 | 60.0 % | 57.1 % |
| Laya multilingual (*NOTE, unverified*) | 8.6 % | 20.0 % | noul 0 / 10 at every τ; choice 1 / 10 at τ 0.5 / 0.7, 0 / 10 at 0.9 | 50.0 % | 57.1 % |

### 4.3 What the local runs' probabilities are worth (validity, `c-llama.md` §4, §8)

Both GGUFs passed the adapter's self-test: the next-token map = the whole vocabulary (151,936 / 248,320), Σ ≈ 1 (1.00001 / 1.00007), every
option token present; raw option mass min 0.99588–0.99961 (Qwen2.5) and 0.852–0.985 (Qwen3.5, lowest on T1 choice); the vocabulary's top
token was never outside the options (0 / 4,632 · 0 / 240 · 0 / 40 · 0 / 40 on both). So the low T1 numbers are the models, not the reader.

### 4.4 Laya multilingual — the NOTE runs (D-r7)

*Every number in this subsection and in the Laya rows elsewhere: community export FAILED the worked-example gate (E2) — unverified*
(`c-laya.md` §4, §8). Ruling D-r7 (19:19): the four tasks once, CPU EP, the same framing / scoring / OOF as every candidate; never eligible
for the rule.

- **What ran** (`c-laya.md` §8, runner `K\c-laya-run-all.sh`, log `B\logs\c-laya-run.log`: 19:22:51 → `ALL DONE 19:56:59`, every line
  `rc=0`): `K\laya-run.cjs` (Laya's pre / post-processing ported from the official `laya-ts` source) over `desplega/laya-onnx`
  `multilingual/fp32` on onnxruntime-node 1.24.3, **CPU EP with 8 intra-op threads** (set by a new `--threads` flag = onnxruntime's
  default for the 8 physical cores; `env.intraOpThreads`); answers `K\answers\laya-multilingual-<task>-<mode>[-oofT].json`. Before the runs
  `laya-run.cjs` got four small fixes (its task path had never run): `--threads`, package versions read without the hidden
  `package.json` export, a perf-counter probe that skips invalid samples, and the NOTE label in `notes` — no framing change.
- **Results:** the four Laya rows in §4 / §4.2 / §5 / §6 / §7. In one line: T1 noul 17.2 % — a near-total Yes bias (P(true) ≥ 0.5 on 4,138
  of 4,632, 321 true; its 0.9–1.0 bin holds 2,114 at mean p 0.958 with 8.8 % true) and an OOF T at the grid maximum (no usable signal); T1
  choice 50.4 %, the best local R@1 (55.6 % at τ 0.5) but at wrong-confident 39.2 %; T2 55.0 % (Arabic 50.0 %); T3 60.0 % (Arabic 57.1 %);
  over-confident everywhere (every OOF T > 1).
- **Reading:** consistent with the card's own "Near chance on typed-decisions zero-shot — 0.342, against a 0.318 random" and "Ships
  uncalibrated" (`c-laya.md` §4) and with the failed gate. Whether the official Python runtime would score higher is P19's open question.

## 5. T1 under D-r2 — each τ, beside S1, the baseline re-run and (c)

D-r2: a pick when the top option has P ≥ τ, else "none"; **"beats the keyless baseline" = wrong-confident below BOTH 6.3 % (S1) and 7.1 %
(this run's re-run) — i.e. below 6.3 % — at a τ where R@1 ≥ 80.7 − 5 = 75.7 %** (HANDOFF P12). References on the same 240 rows: S1 R@1 80.7 %,
pick acc 90.9 %, wrong-confident 6.3 %, correct none 79.2 %, false none 8.3 % (`c-baseline.md`, S1 §10); **(c)'s top-1 72.2 %**
(`b-tasksets.md` §1).

| run | mode | τ | R@1 | pick acc | wrong-confident (named / ∅) | correct none | false none | beats? | source |
|---|---|---|---|---|---|---|---|---|---|
| S1 §10 (claude-sonnet-5-5, 2026-10-29) | choice | — | 151/187 = 80.7 % | 170/187 = 90.9 % | 15/240 = 6.3 % (4 / 11) | 42/53 = 79.2 % | 13/156 = 8.3 % | reference | `c-baseline.md` |
| **baseline re-run (hard)** | choice | 0.5 / 0.7 / 0.9 | 151/187 = 80.7 % | 173/187 = 92.5 % | 17/240 = 7.1 % (4 / 13) | 40/53 = 75.5 % | 10/156 = 6.4 % | reference | `c-baseline.md` |
| baseline (verbalised, NOTE — not the rule's reference, D-r1) | choice | 0.5 | 150/187 = 80.2 % | 172/187 = 92.0 % | 14/240 = 5.8 % (4 / 10) | 43/53 = 81.1 % | 11/156 = 7.1 % | (NOTE) | `c-baseline.md` |
| baseline (verbalised, NOTE) | choice | 0.7 | 127/187 = 67.9 % | 151/187 = 80.7 % | 6/240 = 2.5 % (2 / 4) | 49/53 = 92.5 % | 34/156 = 21.8 % | (NOTE) | `c-baseline.md` |
| baseline (verbalised, NOTE) | choice | 0.9 | 61/187 = 32.6 % | 90/187 = 48.1 % | 1/240 = 0.4 % (0 / 1) | 52/53 = 98.1 % | 97/156 = 62.2 % | (NOTE) | `c-baseline.md` |
| Qwen2.5-0.5B | noul | 0.5 | 68/187 = 36.4 % | 68/187 = 36.4 % | 172/240 = 71.7 % (119 / 53) | 0/53 = 0.0 % | 0/156 = 0.0 % | no | `c-llama.md` §5 |
| Qwen2.5-0.5B | noul | 0.7 | 68/187 = 36.4 % | 72/187 = 38.5 % | 162/240 = 67.5 % (110 / 52) | 1/53 = 1.9 % | 5/156 = 3.2 % | no | `c-llama.md` §5 |
| Qwen2.5-0.5B | noul | 0.9 | 34/187 = 18.2 % | 49/187 = 26.2 % | 65/240 = 27.1 % (42 / 23) | 30/53 = 56.6 % | 96/156 = 61.5 % | no | `c-llama.md` §5 |
| Qwen2.5-0.5B | choice | 0.5 | 0/187 = 0.0 % | 31/187 = 16.6 % | 3/240 = 1.3 % (3 / 0) | 53/53 = 100.0 % | 153/156 = 98.1 % | no (abstains) | `c-llama.md` §5 |
| Qwen2.5-0.5B | choice | 0.7 | 0/187 = 0.0 % | 31/187 = 16.6 % | 0/240 = 0.0 % | 53/53 = 100.0 % | 156/156 = 100.0 % | no (abstains) | `c-llama.md` §5 |
| Qwen2.5-0.5B | choice | 0.9 | 0/187 = 0.0 % | 31/187 = 16.6 % | 0/240 = 0.0 % | 53/53 = 100.0 % | 156/156 = 100.0 % | no (abstains) | `c-llama.md` §5 |
| Qwen3.5-0.8B | noul | 0.5 | 91/187 = 48.7 % | 97/187 = 51.9 % | 92/240 = 38.3 % (58 / 34) | 19/53 = 35.8 % | 32/156 = 20.5 % | no | `c-llama.md` §8.1 |
| Qwen3.5-0.8B | noul | 0.7 | 20/187 = 10.7 % | 43/187 = 23.0 % | 20/240 = 8.3 % (17 / 3) | 50/53 = 94.3 % | 127/156 = 81.4 % | no | `c-llama.md` §8.1 |
| Qwen3.5-0.8B | noul | 0.9 | 0/187 = 0.0 % | 31/187 = 16.6 % | 0/240 = 0.0 % | 53/53 = 100.0 % | 156/156 = 100.0 % | no (abstains) | `c-llama.md` §8.1 |
| Qwen3.5-0.8B | choice | 0.5 | 14/187 = 7.5 % | 42/187 = 22.5 % | 16/240 = 6.7 % (6 / 10) | 43/53 = 81.1 % | 139/156 = 89.1 % | no | `c-llama.md` §8.1 |
| Qwen3.5-0.8B | choice | 0.7 | 1/187 = 0.5 % | 32/187 = 17.1 % | 2/240 = 0.8 % (1 / 1) | 52/53 = 98.1 % | 154/156 = 98.7 % | no (abstains) | `c-llama.md` §8.1 |
| Qwen3.5-0.8B | choice | 0.9 | 0/187 = 0.0 % | 31/187 = 16.6 % | 0/240 = 0.0 % | 53/53 = 100.0 % | 156/156 = 100.0 % | no (abstains) | `c-llama.md` §8.1 |
| Laya multilingual (*NOTE, unverified*) | noul | 0.5 | 28/187 = 15.0 % | 28/187 = 15.0 % | 212/240 = 88.3 % (159 / 53) | 0/53 = 0.0 % | 0/156 = 0.0 % | no | `c-laya-t1-noul.md` |
| Laya multilingual (*NOTE*) | noul | 0.7 | 28/187 = 15.0 % | 28/187 = 15.0 % | 211/240 = 87.9 % (159 / 52) | 1/53 = 1.9 % | 0/156 = 0.0 % | no | `c-laya-t1-noul.md` |
| Laya multilingual (*NOTE*) | noul | 0.9 | 28/187 = 15.0 % | 28/187 = 15.0 % | 205/240 = 85.4 % (155 / 50) | 3/53 = 5.7 % | 4/156 = 2.6 % | no | `c-laya-t1-noul.md` |
| Laya multilingual (*NOTE*) | choice | 0.5 | 104/187 = 55.6 % | 109/187 = 58.3 % | 94/240 = 39.2 % (56 / 38) | 15/53 = 28.3 % | 22/156 = 14.1 % | no | `c-laya-t1-choice.md` |
| Laya multilingual (*NOTE*) | choice | 0.7 | 93/187 = 49.7 % | 103/187 = 55.1 % | 74/240 = 30.8 % (41 / 33) | 20/53 = 37.7 % | 43/156 = 27.6 % | no | `c-laya-t1-choice.md` |
| Laya multilingual (*NOTE*) | choice | 0.9 | 74/187 = 39.6 % | 94/187 = 50.3 % | 40/240 = 16.7 % (20 / 20) | 33/53 = 62.3 % | 73/156 = 46.8 % | no | `c-laya-t1-choice.md` |
| Jev / OpenAI / Microsoft-Decision-1 | — | — | DEFERRED-HASAN | | | | | not measured | `c-hosted-dryrun.md` |

Pick acc's floor of 31 / 187 = 16.6 % on the abstaining rows is the 31 `'x|∅'` rows, where "none" also counts (S1 §2 / §10). No measured
local model reaches (c)'s own top-1 (72.2 %) on R@1 at any τ either.

## 6. The out-of-fold temperature NOTE (`K\temp-oof.cjs`: 2-fold by row id, T fitted on one fold by grid NLL, applied to the other)

| candidate · task | fitted T (fold A / B) | after it: Brier / ECE | reading | source |
|---|---|---|---|---|
| Qwen2.5-0.5B T1 noul | 20 / 20 (grid max) | 0.252 / 0.434 | no usable signal (random answers give the same T) | `c-llama.md` §5, `c-llama-qwen2.5-0.5b-t1-noul-oofT.md` |
| Qwen2.5-0.5B T1 choice | 2.11 / 2.63 | 0.197 / 0.103 | over-confident; coverage 0 at every τ after it | `…-t1-choice-oofT.md` |
| Qwen2.5-0.5B T2 | 1.35 / 2.14 | 0.175 / 0.208 | over-confident | `…-t2-choice-oofT.md` |
| Qwen2.5-0.5B T3 | 2.80 / 1.46 | 0.200 / 0.201 | over-confident | `…-t3-noul-oofT.md` |
| Qwen3.5-0.8B T1 noul | 0.273 / 0.302 | 0.092 / 0.117 (from 0.132 / 0.270) | UNDER-confident; after it sel ≥ 0.9 97.2 % at 60.1 % coverage; D-r2 τ 0.9 R@1 33/187 = 17.6 %, wrong-confident 35/240 = 14.6 % — still no τ near 75.7 % R@1 | `c-llama.md` §8.1, `c-llama-qwen3.5-0.8b-t1-noul-oofT.md` |
| Qwen3.5-0.8B T1 choice | 1.46 / 1.43 | 0.297 / 0.212 | over-confident; coverage 2.5 % at τ 0.5 | `…-t1-choice-oofT.md` |
| Qwen3.5-0.8B T2 | 0.492 / 0.224 | 0.136 / 0.149 | under-confident; sel ≥ 0.9 95.0 % at 50.0 % | `…-t2-choice-oofT.md` |
| Qwen3.5-0.8B T3 | 0.795 / 0.324 | 0.121 / 0.144 | under-confident | `…-t3-noul-oofT.md` |
| Laya multilingual T1 noul (*NOTE, unverified*) | 20 / 20 (grid max) | 0.272 / 0.456 (from 0.644 / 0.735) | no usable signal; coverage 0 at τ ≥ 0.7 | `c-laya-t1-noul-oofT.md` |
| Laya multilingual T1 choice (*NOTE*) | 2.157 / 2.223 | 0.224 / 0.072 | over-confident; D-r2 τ 0.7 after it: wrong-confident 14/240 = 5.8 % (< 6.3 %) but R@1 43/187 = 23.0 % | `c-laya-t1-choice-oofT.md` |
| Laya multilingual T2 (*NOTE*) | 3.663 / 2.432 | 0.224 / 0.106 | over-confident | `c-laya-t2-choice-oofT.md` |
| Laya multilingual T3 (*NOTE*) | 4.088 / 7.368 | 0.236 / 0.094 | over-confident; coverage 5.0 % at τ 0.7 | `c-laya-t3-noul-oofT.md` |

T never moves an argmax, so accuracy is unchanged. It is a NOTE (40-row folds on T2 / T3): it says whether the probabilities carry a
rankable signal, not what a shipped temperature would be.

## 7. Latency on THIS laptop (i7-11800H 8 cores / 16 threads, RTX A3000 6 GB via Vulkan) — CPU load beside each

| candidate · run | device | cold load | cold first answer | warm per question p50 / p95 | per request p50 / p95 | CPU load before · after | fair? | source |
|---|---|---|---|---|---|---|---|---|
| Qwen2.5-0.5B T1 noul | Vulkan 25 L | 5,724 ms | 6,035 ms | 208.0 / 388.7 ms | 4,378 / 6,120 ms (20 q) | wmiprvse 5.3 %, node 4.2 % · wmiprvse 2.6 %, vmmemwsl 1.7 % | yes (quiet) | `c-llama.md` §6 |
| Qwen2.5-0.5B T1 choice | Vulkan 25 L | 4,866 | 11,782 | 569.0 / 722.1 | 569.1 / 722.2 | wmiprvse 2.7 % · 3.4 % | yes | `c-llama.md` §6 |
| Qwen2.5-0.5B T2 | Vulkan 25 L | 6,942 | 7,351 | 229.5 / **274.5** | same | wmiprvse 3.4 % · 2.9 % | yes | `c-llama.md` §6 |
| Qwen2.5-0.5B T3 | Vulkan 25 L | 5,268 | 5,621 | 222.0 / 350.6 | same | wmiprvse 3.1 % · 2.8 % | yes | `c-llama.md` §6 |
| Qwen2.5-0.5B T2 (CPU NOTE) | CPU, 4 threads | 3,377 | 22,742 | 9,806.5 / 12,157.2 | same | wmiprvse 2.6 % · vmmemwsl 9.7 %, system 5.6 % | no (4 threads, P17) | `c-llama.md` §6 |
| Qwen2.5-0.5B T3 (CPU NOTE) | CPU, 4 threads | 4,059 | 17,519 | 7,515.4 / 18,221.8 | same | wmiprvse 4.5 % · electron 6.4 %, code 5.9 %, ffmpeg 5.1 % | no (loaded) | `c-llama.md` §6 |
| Qwen3.5-0.8B T1 noul | Vulkan 25 L | 10,961 | 11,599 | 326.1 / 482.7 | 6,508 / 8,564 (20 q) | vmmemwsl 4.1 %, wmiprvse 2.9 % · code 5.5 %, system 1.8 % | **yes (quiet)** | `c-llama.md` §8.2 |
| Qwen3.5-0.8B T1 choice (main / repeat) | Vulkan 25 L | 13,287 / 15,228 | 19,890 / 17,824 | 845.4 / 1,570.0 · 1,758.6 / 2,338.7 | same | GPU busy (30–47 %) · ffmpeg 62.1–64.5 % | no (both loaded) | `c-llama.md` §8.2 |
| Qwen3.5-0.8B T2 (repeat) | Vulkan 25 L | 7,133 | 7,676 | 281.0 / **353.3** | same | chrome 4.1 % · 5.8 % | **yes (light)**; main run loaded (463.2 / 608.5) | `c-llama.md` §8.2 |
| Qwen3.5-0.8B T3 (main / repeat) | Vulkan 25 L | 12,990 / 7,114 | 13,898 / 7,571 | 690.5 / 846.6 · 293.6 / 786.6 | same | chrome 13.4 %, msmpeng 6.7 % · chrome 57.3 %, ffmpeg 54.7 % | no (both loaded) | `c-llama.md` §8.2 |
| Laya multilingual T1 noul (*NOTE, unverified*) | CPU EP, 8 intra-op threads | 4,058 ms | 17,005 ms (incl. the 5 s CPU-load probe) | 397.0 / 469.2 ms (request ÷ 20) | 7,886.7 / 9,219.9 ms (20 q, one forward pass) | wmiprvse 1.3 % · 3.6 % | yes (quiet) | `c-laya.md` §8.2, `c-laya-t1-noul.md` |
| Laya multilingual T1 choice (*NOTE*) | CPU EP, 8 | 4,067 | 10,312 (incl. probe) | 494.9 / 582.4 | same | wmiprvse 1.3 % · 1.7 % | yes | `c-laya-t1-choice.md` |
| Laya multilingual T2 (*NOTE*) | CPU EP, 8 | 4,550 | 10,525 (incl. probe) | 183.6 / **276.2** | same | code 4.2 % · wmiprvse 1.9 % | yes | `c-laya-t2-choice.md` |
| Laya multilingual T3 (*NOTE*) | CPU EP, 8 | 4,151 | 10,124 (incl. probe) | 185.4 / **278.9** | same | wmiprvse 1.9 % · 1.3 % | yes | `c-laya-t3-noul.md` |
| **keyless baseline** T1 (12 calls × 20 rows) | remote (the subscription) | — | — | — | **10,424 / 23,370 ms per call** | not recorded (a remote call) | — | `c-baseline.md` |
| keyless baseline T2 / T3 (1 call × 40 rows each) | remote | — | — | — | 15,776 / 10,767 ms per call | — | — | `c-baseline.md` |

- **Where the local warm time goes** (`c-llama-mapcost-qwen2.5-0.5b-vulkan.json`, 78 warm T1 noul questions, quiet): with node-llama-cpp's
  151,936-entry probability `Map` p50 174.7 / p95 279.0 ms; the same forward pass reading only the next token p50 30.0 / p95 61.6 ms. The
  map is ~5/6 of a warm question (P16); Qwen3.5's map is larger (248,320 entries; not re-measured).
- **Hosted latency:** not measured (DEFERRED-HASAN); no provider states one (Jev C3, OpenAI / Microsoft: unknown — `a-sources.md`).

## 8. Cost per 1,000 decisions

- **Local:** $0 per decision; the price is disk + RAM (+ VRAM) — §9.
- **Hosted (estimate, DEFERRED-HASAN):** from the dry-run's token estimates (UTF-8 bytes / 3, conservative) × the price pages
  (`c-hosted-dryrun.json` `plan[].usdUpper` / `usdStateOnce` ÷ the task's rows × 1,000). "Upper" bills the state once per question, "state
  once" once per request; no source says which System One bills.

| decision (rows) | Jev / Microsoft-Decision-1 ($0.042 / M) upper · state-once | OpenAI ($0.10 / M) upper · state-once |
|---|---|---|
| T1 pick as 20 noul questions (240 rows: $0.052741 / $0.034368 Jev; $0.125575 / $0.081827 OpenAI) | **$0.220** · $0.143 | **$0.523** · $0.341 |
| T1 pick as one choice over 21 (240: $0.022384 / $0.021372; $0.053295 / $0.050887) | **$0.093** · $0.089 | **$0.222** · $0.212 |
| T2 routing (40: $0.000704 / $0.000470; $0.001677 / $0.001120) | **$0.018** · $0.012 | **$0.042** · $0.028 |
| T3 verification (40: $0.000415 / $0.000307; $0.000987 / $0.000730) | **$0.010** · $0.008 | **$0.025** · $0.018 |

  The whole hosted D1 plan: 138 requests, $0.334 upper (`c-hosted-dryrun.md` §3) — inside D-e's 600 / $3.
- **Keyless baseline:** no per-call price (the subscription's quota); **wall time** from the ledger (`c-calls.jsonl` `wallMs`, the table in
  `c-baseline.md`): T1 137,533 ms for 240 picks in 12 calls = 573.1 ms per pick → **≈ 573 s (9.6 min) per 1,000 picks** if run sequentially
  in batches of 20 (≈ 50 calls); T2 15,776 ms / 40 = 394.4 ms per decision → ≈ 394 s per 1,000; T3 10,767 / 40 = 269.2 ms → ≈ 269 s per 1,000.

## 9. Disk / RAM / VRAM / licence per local candidate

| candidate | disk | peak RSS | VRAM | licence | Arabic | ≤ 2 GB RAM? | source |
|---|---|---|---|---|---|---|---|
| Laya multilingual (community export, NOTE) | 1,324,748,627 B (encoder 1,230,282,662 + head 60,101,236 + tokenizer 34,363,188 + configs) | sampled 1,639–3,106 MB; OS peak 2,269–3,109 MB (T1 noul the highest) | 0 (CPU EP) | weights Apache-2.0; the export card's own terms not checked | yes, weak (card); measured T2 50.0 % / T3 57.1 % (*NOTE*) | **no** (OS peak ≥ 2,269 MB on every run) | `c-laya.md` §3 + NOTE runs |
| Qwen2.5-0.5B-Instruct Q8_0 | 675,710,816 B | ≤ 1,087 MB (Vulkan); 767–779 MB (CPU) | + ~0.9 GB (800 → ~1,700 MiB) | Apache-2.0 | yes (card) | **yes** | `c-llama.md` §2, §6 |
| Qwen3.5-0.8B Q8_0 | 811,843,840 B | ≤ 1,552 MB | + ~1.2–1.4 GB | Apache-2.0 | unknown (card); measured T2 60.0 % / T3 57.1 % | **yes** | `c-llama.md` §8 |
| Liquid d1-omni-600M Q8_0 | 407,207,584 B | — (did not load) | — | **LFM Open License v1.0** (< $10 M revenue) | GGUF lists `ar` | — | `c-llama.md` §2–§3 |

## 10. Findings for D2

1. **A JSON-reading caller must validate completeness (P11):** one keyless response came back `success: true` but cut mid-JSON (t1-06, 792
   chars, rows 15–20 missing); D1 re-asked it once as a counted call (`c-baseline.md`).
2. **The laptop's GPU route for node-llama-cpp is Vulkan only, and its VRAM reading is broken (P13):** the CUDA prebuilt has no binary
   (`NoBinaryFoundError`); Vulkan's `getVramState()` reads free 0 with an underflowed `used`, so `gpuLayers: 'auto'` resolved to **0 layers**
   (a silent CPU run) and `--gpu-layers max` needed `ignoreMemorySafetyChecks` (`c-llama.md` §1, §4). The app's `local-llm-provider` would
   hit the same on this laptop class; real VRAM comes from `nvidia-smi`.
3. **The vocabulary-map cost (P16):** node-llama-cpp 3.18.1 builds a JS `Map` of the whole vocabulary per probability read — ~5/6 of a warm
   question (279.0 vs 61.6 ms p95). A runtime that reads only the 2–21 option logits would sit near the token-only figure — not measured as
   a product path.
4. **Qwen3.5's thinking token (P20):** its template puts P(`<think>`) 0.9999 at the answer slot; the adapter needs Qwen's non-thinking mode
   (an empty `<think></think>`, node-llama-cpp's `thoughts: 'discourage'`) — and the mass then splits between `Yes` and ` Yes` on a bare
   probe (0.571 / 0.411), though ≥ 0.852 sits on the no-space option tokens in the task prompts (`c-llama.md` §8).
5. **Laya's calibration and export question (P4, P19):** the multilingual checkpoint "has no fitted temperatures" and its card says
   "Ships uncalibrated … systematically over-confident" and "Near chance on typed-decisions zero-shot — 0.342, against a 0.318 random"; no
   official ONNX exists and the one community export failed its card's own example (`c-laya.md` §1, §4). Shipping it means a community
   export or a one-off Python export — neither official (P1).
6. **OpenRouter requires noul `criteria` {true, false}** on its Decisions API (TypeSafe does not); the runner always sends it, valid on
   both (P23, `c-hosted-dryrun.md` §1). OpenAI's Decisions API is a different shape (`input`, `questions[]` with `name`, `predicate`,
   `choices[]`) → D2 needs a System One adapter AND an OpenAI adapter; `openai-compat-provider` serves neither (C7, D-r4). OpenRouter also
   serves Jev (`typesafe/jev-1.14`) on the same endpoint.
7. **d1-omni needs `llama-server` (`/v1/systemone`, from a llama.cpp build with `lfm2-d1-omni` support, not named on its card) or the
   community ONNX export** — node-llama-cpp's b8390 cannot load it; both are new runtime pieces, under a revenue-capped licence (P3, P15).
8. Small: the catalog's `qwen2.5-0.5b-q8` `sizeBytes` 531,000,000 is wrong (the file is 675,710,816 B — P5); Hugging Face served ~75–80 KB/s
   per connection on 2026-10-30, so a first-use download of ~1.3 GB took about an hour (P8, D-r5).

## 11. The recommendation — the rule as D-r1 reads it

**Rule (Hasan, verbatim):** "the local default = the smallest local candidate whose T1 + T2 accuracy is within 5 points of the best hosted
one, Brier no worse than 0.05 above it, warm p95 ≤ 300 ms and ≤ 2 GB RAM; prefer the one with Arabic."

**D-r1:** the two hosted terms are DEFERRED-HASAN (no key); the rule's other terms are applied (warm p95 ≤ 300 ms, ≤ 2 GB RAM, the Arabic
preference); each local candidate's T1 + T2 accuracy and Brier is printed beside the keyless baseline's as a NOTE (not the rule's
reference). Laya multilingual is never eligible (D-r7).

| term | Qwen2.5-0.5B (676 MB — the smallest that ran) | Qwen3.5-0.8B (812 MB) | d1-omni-600M (407 MB) | Laya multilingual (NOTE) |
|---|---|---|---|---|
| T1 + T2 accuracy within 5 points of the best hosted | DEFERRED-HASAN. NOTE beside the baseline: T1 noul 43.2 % / T1 choice 27.1 % / T2 75.0 % vs the baseline's T1 choice 88.8 % / T2 100.0 % | DEFERRED-HASAN. NOTE: T1 noul 87.0 % / T1 choice 47.5 % / T2 82.5 % vs 88.8 % / 100.0 % | no number | not eligible (D-r7) — numbers in §4.4 |
| Brier ≤ the best hosted + 0.05 | DEFERRED-HASAN. NOTE: T1 noul 0.336, T1 choice 0.210, T2 0.155 | DEFERRED-HASAN. NOTE: 0.132 / 0.269 / 0.205 | no number | not eligible |
| **warm p95 ≤ 300 ms** | **FAIL** — T1 noul 388.7 ms per question (6,120 ms per 20-question pick), T1 choice 722.1 ms, T3 350.6 ms; only T2 274.5 ms passes (`c-llama.md` §6) | **FAIL** — fair figures T1 noul 482.7 ms per question (8,564 ms per pick), T2 353.3 ms; T1 choice / T3 had no clean timing, every run ≥ 786.6 ms (`c-llama.md` §8.2) | — (did not load) | not eligible; for information (*NOTE, unverified*): T1 noul 469.2 ms per question (9,219.9 ms per pick), T1 choice 582.4 ms fail; T2 276.2 / T3 278.9 ms pass (`c-laya.md` §8.2) |
| **≤ 2 GB RAM** | pass — peak RSS ≤ 1,087 MB | pass — ≤ 1,552 MB | — | not eligible; OS peak 2,269–3,109 MB (fail as measured) |
| prefer Arabic | Arabic on its card; measured T2 80.0 %, T3 57.1 %, T1 R@1 4 / 10 | card: unknown; measured T2 60.0 %, T3 57.1 %, T1 R@1 5 / 10 | GGUF lists `ar` | card: yes, weak |
| **meets the evaluable terms?** | **no** (latency) | **no** (latency) | **no** (did not run) | not eligible |

**→ No local default.** No local candidate passes the evaluable terms, so the rule names none; STOP 1 fires (§12). The latency failure is
partly the runtime (P16: the full-vocabulary map), but the T1 numbers would not pass a 5-point accuracy term against any hosted model that
reaches the baseline's level — that is a NOTE, since no hosted number exists.

## 12. The STOP judgement

Hasan's three STOP conditions, each judged with its numbers:

**STOP 1 — "no local candidate meets the rule" (D-r1: no local candidate passes the evaluable terms) → FIRES.** Qwen2.5-0.5B fails warm
p95 ≤ 300 ms on T1 noul (388.7 ms), T1 choice (722.1 ms) and T3 (350.6 ms) (`c-llama.md` §6); Qwen3.5-0.8B fails it on every task at its
quietest (T2 353.3 ms, T1 noul 482.7 ms — `c-llama.md` §8.2); d1-omni-600M did not load in the app's runtime (`c-llama.md` §3); Laya
multilingual is a NOTE and never eligible (D-r7) — and as measured it would fail too (T1 noul 469.2 ms per question, OS peak RSS 2,269–3,109
MB — `c-laya.md` §8.2).

**STOP 2 — "no decision model beats the keyless LLM baseline on T1's wrong-confident rate" (D-r2) → FIRES for every measured model;
the hosted models are DEFERRED-HASAN, not measured.** The bar: wrong-confident < 6.3 % at a τ where R@1 ≥ 75.7 %. Best measured R@1 at any τ:
Qwen3.5-0.8B 48.7 % (noul τ 0.5, wrong-confident 38.3 %), Qwen2.5-0.5B 36.4 % (noul τ 0.5 / 0.7, wrong-confident 71.7 % / 67.5 %); where
their wrong-confident drops below 6.3 % they abstain (R@1 ≤ 0.5 %: Qwen3.5 choice τ 0.7 0.8 % / R@1 0.5 %; Qwen2.5 choice τ 0.5 1.3 % / R@1
0.0 %) (`c-llama.md` §5, §8.1). Even after the out-of-fold temperature NOTE, Qwen3.5-0.8B's T1 noul reaches only R@1 32.6 % (τ 0.7) / 17.6 %
(τ 0.9) (`c-llama.md` §8.1). Laya multilingual (*NOTE, unverified*): best R@1 55.6 % (choice τ 0.5) at wrong-confident 39.2 %; its
lowest raw wrong-confident 16.7 % (choice τ 0.9, R@1 39.6 %); after the OOF temperature NOTE 5.8 % at τ 0.7 but R@1 23.0 % (`c-laya.md`
§8.1). Jev, OpenAI and Microsoft-Decision-1 were not run (no key); only they could overturn this
condition, and only Hasan's keys can run them (`node K\hosted-run.cjs`, §13).

**STOP 3 — "the numbers point to a different design" → FIRES for the LOCAL leg (judged; the hosted leg cannot be judged without keys).**
- For T1 (library search's pick + "nothing fits") the assistant's pick stays far ahead of every local decision model: R@1 80.7 % vs ≤ 48.7 %
  (Laya NOTE: 55.6 %); at each model's best-R@1 τ the wrong-confident rate is 38.3 % (Qwen3.5-0.8B), 71.7 % (Qwen2.5-0.5B), 39.2 % (Laya
  NOTE) against the baseline's 7.1 %, and lower rates come only with R@1 ≤ 10.7 % (Qwen) or 39.6 % (Laya NOTE, at 16.7 %) (§5); no local
  model reaches (c)'s own top-1 (72.2 %) either. A local decision
  model cannot gate or replace S1's design (the assistant's pick over the top-20) today.
- For T2 / T3 the best local model is moderate (Qwen3.5-0.8B 82.5 % / 85.0 %, Arabic 60.0 % / 57.1 %) against the keyless baseline's 100.0 % /
  97.5 % — which is uncalibrated and costs ~10–16 s per batched call (`c-baseline.md`).
- The runtime, not only the model, sets the latency (P16: 279.0 ms of map vs 61.6 ms token-only at p95); d1-omni needs `llama-server` or
  ONNX (P15); Laya needs a community export or a Python export (P1, P19). Any local leg is therefore a different runtime design from "the
  app's node-llama-cpp / onnxruntime-node as installed".
- So the numbers point to: **no local default from today's candidates; any decision service stands on the hosted models (unmeasured) +
  the keyless LLM for T1**, or on a new local runtime (an option-logit reader, `llama-server`, or an official Laya ONNX) — Hasan's call.

**→ status: BLOCKED** (STOP 1, STOP 2 and STOP 3 for the local leg, with the numbers above). This is the expected D1 outcome with no hosted
key, not a failed spike: every runner is built, the hosted rows need only Hasan's keys.

## 13. DEFERRED-HASAN

- **The three hosted runs** — set `JEV_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` in the environment, then per provider
  `node K\hosted-run.cjs --provider <jev|openai|openrouter-msd1> --task t2 --mode choice --max-requests 1` (one call: key, shape, mapping),
  then the four runs and `node K\score.cjs answers\hosted-<p>-<task>-<mode>.json` (`c-hosted-dryrun.md` §4). 138 requests, $0.334 upper.
- **OpenAI access** (D-b: OpenAI first if the account has access, else Microsoft-Decision-1 via OpenRouter) — needs the key.
- **The rule's two hosted terms** (accuracy within 5 points, Brier within 0.05) and the hosted side of STOP 2 / STOP 3 — need the hosted runs.

## 14. Open questions for Hasan

1. **The design (STOP 3):** with no local default from today's candidates, does the decision service go hosted-only (+ the keyless LLM for
   T1's pick), or does D2 design a new local runtime (an option-logit reader without node-llama-cpp's vocabulary map; `llama-server` for
   d1-omni; an official Laya export)?
2. **P10 — D-e's "≤ 600 hosted decision calls":** D1 read it as HTTPS requests (138 needed). If it meant questions, T1 noul alone (4,632 per
   provider) cannot run.
3. **P1 / P19 — Laya:** no official ONNX exists; the community export failed the card's example. Allow a one-off `pip install laya`
   reference check (D-r7 (c)) to tell an export fault from stale printed outputs?
4. **P3 / P15 — d1-omni:** LFM Open License v1.0 (commercial use only below $10 M revenue) and a runtime the app does not ship
   (`llama-server` or ONNX). Worth a D2 path at all?
5. **P7 — T2 / T3 labels** are one builder's plain-meaning judgement (calls listed in §1); overrule any before a hosted run?
6. **P16 / P13 — a native option-logit reader** (and a working GPU path on this laptop class) as a D2 item?

## 15. Provenance

- **Builders** (HANDOFF "Agents so far"): #1 step 1 (a) primary docs → `a-sources.md`; #2 step 2 (b) task sets + measures → `b-tasksets.md`;
  #3 step 3 part 1 (Laya route, `laya-run.cjs`); #4 steps 5–6 (keyless baseline, hosted dry-run); #5 step 4 part 1 (`llama-run.cjs`,
  `temp-oof.cjs`); #6 step 4 part 2 (d1-omni load test, Qwen2.5-0.5B); #7 step 3 (Laya gate failed) + D-r6 (Qwen3.5-0.8B); #8 D-r7 (Laya
  NOTE runs) + this report. Orchestrator: the weight downloads (D-r5) and rulings D-r1 … D-r7.
- **Commits** on `decision-models` since `efa5e0b` (docs only): `c14b180` `ce3f9e4` `a4fc957` `57c27f8` `71aa0c5` `464f613` `23269e8`
  `bfff9d7` `b905295` `7f72203` `09f965c` `f5dfb26` `343c0d5` `99def5d` `ce296e6` `aca2ca3` `ba41a37` `98801e7` `28b509f` `8ef2746` `ad436b8`
  + this report's commit.
- **Calls:** keyless `claude-subscription` **16 / 40** (`c-calls.jsonl`: probe + 12 T1 + T2 + T3 + the t1-06 re-run, all `success: true`, no
  credential logged); **hosted 0** (`hosted-calls.jsonl` absent; every LIVE start refused on the unset key, exit 2).
- **Downloads** (orchestrator jobs, D-r5; each into its own folder under `B\models\`, sha256 checked against the expected value):
  Laya multilingual `desplega/laya-onnx` `multilingual/fp32` 1,324,748,627 B (encoder `4bf4feb8de3ee17e…`, head `03f78ddf0bfaa86f…`, tokenizer
  `609d8f4c067cd395…` = the official repo's LFS oid, rl_agent_config `25061739243b617a…` — each = its `manifest.json`); Qwen2.5-0.5B-Instruct
  Q8_0 675,710,816 B `ca59ca7f13d0e15a…44e`; Liquid d1-omni-600M Q8_0 407,207,584 B `cd94463f4cac9c70…3d3`; Qwen3.5-0.8B Q8_0
  811,843,840 B `0ad885ff…7a6c` (`c-laya.md` §3, `c-llama.md` §2, §8).
- **Scratch npm install: none** (`B\npm-scratch\` was never created — `ls` → "No such file or directory", 19:59; `laya-ts` is not on npm). No package added to the repo, the worktree or the
  app's `package.json`. Kit packages resolved read-only from the main checkout's `node_modules` (onnxruntime-node 1.24.3,
  `@huggingface/tokenizers` 0.1.3, node-llama-cpp 3.18.1).
- **App launch:** one isolated instance in step 5 (built `wt/out`, profile `decisions-D1` copied without `settings\settings.db*`, CDP 9300,
  stopped after); no other launch.

status: BLOCKED — STOP 1 (no local candidate passes the evaluable terms: warm p95 Qwen2.5-0.5B 388.7 ms on T1 noul, Qwen3.5-0.8B 353.3 ms
on T2 at best; d1-omni did not load; Laya NOTE-only), STOP 2 (best measured T1 R@1 48.7 % at wrong-confident 38.3 % against the bar
< 6.3 % at R@1 ≥ 75.7 %; hosted DEFERRED-HASAN) and STOP 3 for the local leg (the numbers point to no local default from today's
candidates; the hosted leg needs Hasan's keys).
