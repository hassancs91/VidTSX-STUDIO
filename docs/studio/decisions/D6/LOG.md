# D6 — log (append-only, one dated line per event)

- 2026-10-31 19:18 · orchestrator: D6 opened on Hasan's "yes" (measure the product shape before relying on it; scope = T3 × Jev, one row per
  request, ≤ 40 requests); ruling D-r29; HANDOFF written.
- 2026-10-31 19:24 · D6 builder (as of `da51e0c`, tree clean): kit written in `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D6\` —
  `product-shape.ts` (256 lines), `product-shape.test.ts` (141), `vitest.config.mts` (28); nothing in `src/`. DRY RUN (stub fetch, fake key,
  no network) 19:23 and 19:24: `Tests 4 passed | 1 skipped (5)` — 40 bodies, each equal AND byte-identical to D3's `productShaped('t3', …)`
  (D3's own source lines 32-39 evaluated over `D3\d1-questions.cjs`; D1's `t3-verify.json` = the tree's, sha256 `95207e42…63f0d`, `cmp`
  identical); key refusal before any request; a 429 stops at row 1 (2 HTTP attempts); cap 3 → 3 reach the network, then stop; key / state
  scan of the written files clean. Both scorers agree on the dry answer file (Brier 0.4709, ECE 0.470). LAUNCHER
  `D6\product-shape-live.sh` = `D4\live-test.sh` lines 1-15 + a new tail: `diff` of lines 8-15 (the sourcing block) exit 0, of lines 1-15
  exit 0, `cmp` 1-15 exit 0 (both sha256 `4fac37ec…35fad`); the full diff = `16,19c16,21` only; `bash -n` exit 0; no-echo scan of non-comment
  lines (echo / printf / printenv / env / cat / declare / tee / set -x …) = no match; 0 CR bytes. The live run is next (once).
- 2026-10-31 19:27 · D6 builder: LIVE RUN done ONCE (19:25:05 → 19:25:15, `bash …\D6\product-shape-live.sh`): 40 requests reached the
  network (40 attempts, no retry, cap 40), not stopped early, `jev-1.14.0` + `calibrated: true` on 40 / 40. Verdict **HOLDS**: 40 / 40, Brier
  0.0042, 0 errors, p95 256.8 ms (bar ≥ 38 / ≤ 0.05 / 0 / ≤ 2,000). Beside it: at 0.9 act-right 36 / act-wrong 0 / escalate 4; ECE 0.056;
  sel ≥ 0.9 100.0 % at 90.0 % coverage; cost $0.000701652; 16,706 input tokens. Re-scored by the tree's `scoreNoulAnswers` and D1's
  `score.cjs` (same numbers). Results + the confound in HANDOFF.md "Results"; key scan clean; only HANDOFF.md + LOG.md committed.
