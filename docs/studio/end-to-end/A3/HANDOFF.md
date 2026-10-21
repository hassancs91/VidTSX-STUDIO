# A3 — The no-react fix: `remotion/<subpath>` external in shot bundles
status: IN PROGRESS (step 1 of 4 done: the code fix + unit tests, commit `c3aefe8`)

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
"Learned" lines from A1/A2). Plan §5 calls this part **the highest risk in the plan**.

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A3** | **The no-react fix**: `remotion/<subpath>` external in `shot-bundle.ts`, lint widened, one video-14 shot re-bundled and rendered 5 s through Standard at 4K60 → then all 55 re-bundled by the import script's bundle step (`--shots-only`) | the 5 s render completes with the brand-font hold released; `grep remotion_delayRenderHandles` over the 55 bundles = 0 hits |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.3 A3`). "Anything the composition renders is verified in
preview AND a real export before the part closes" — this part changes what every shot bundle
renders, so the preview (Player) check is part of the exit (see §5 "The Player" below).

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 "The failure" (plan :333-345)** — read it in full. In short: `@remotion/google-fonts`
imports `remotion/no-react`; that subpath is not external (exact-match regex) and is a "builder
library", so every one of the 55 video-14 shot bundles carries a full copy of
`remotion/no-react`. `shot-bundle-finish.ts:108-125` moves the bundle body into a lazy
`__vidtsxInit()` that runs on first render, and the copy's top-level
`window.remotion_delayRenderHandles = [];` (Remotion 4.0.435 `no-react.mjs:139-146`) then runs
**mid-render**, orphaning the export entry's `'brand fonts'` hold (`export-entry.ts:322-336`,
`BRAND_FONT_WAIT_MS` 8000) and any shot's own hold → timeout. The preview serves one shared copy
at `/virtual/remotion.js/no-react` (`module-server.ts:131-134`). Version skew: the inlined
google-fonts code is the editor's 4.0.486 vs the app's 4.0.435.
**§1.7 the 2026-10-16 attempt (:346-348):** Standard, 82–102 s, 3840×2160 @ 60, CPU 25 %,
cancelled by the user at 171 frames after 607 s (`notes/import/range-082-102.json`).
**§1.3 library limits (:162-167):** `EXTERNAL = /^(react|remotion|@vidtsx\/kit)$/`
(`src/main/services/studio/shot-bundle.ts:36`, exact match); every `@remotion/*` and every
`remotion/<subpath>` is a "builder library" and gets **inlined**
(`src/shared/tsx-engine/builder-libraries.ts:113-118`); the lint allows only the three externals
and rejects subpaths (`src/shared/studio/shot-lint.ts:12, 87-90`) — it runs on the bundled
artifact. The builder's `check` inlines the kit (`build-check.ts:92-93`).
**§1.7 Fonts (:360-364):** font proxy cache `<userData>/font-cache`, miss → upstream fetch, 502 on
upstream failure; shots' `@remotion/google-fonts` loads are not warmed.

**§2 T7 (the A3 slice):** "`remotion/<subpath>` becomes external in the shot bundle
(`EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`), the lint allows `remotion/*` subpaths,
the preview keeps serving its shared copy and the export bundle resolves the app's one 4.0.435
copy at module load, before any `delayRender` exists. **A3 proves it on one video-14 shot
first** (inlined 4.0.486 google-fonts code calling the app's no-react — API parity [spike]) and
then re-bundles all 55 through the import script's bundle step."

**§5 items:**
- **A3 parity [spike].** If `NoReactInternals` differs in what the inlined 4.0.486 google-fonts
  uses, the fallback is to externalize `@remotion/google-fonts/*` too and serve it in preview —
  "a bigger change. The one-shot render decides it." (Within the plan: take the fallback if the
  spike fails, and record the evidence.)
- **The Player.** The same reset runs in the preview today (inlined copy inside
  `__vidtsxInit`); its effect on the Player's own `delayRender` holds was never measured. "A3's
  one-shot proof should look at a shot with a font load in the Player as well."

**Orchestrator's read (2026-10-21, read-only):**
- `~/Videos/VidTSX Studio/projects/video-14` = 460 MB; 55 shot folders under `shots/`, each with
  `original.tsx` + `v1.tsx` (the bundle). **All 55 `v1.tsx` contain
  `remotion_delayRenderHandles` today** (`shots/v14-a1-nobody/v1.tsx:982`). V1 master =
  `D:\repos\claude-youtube-editor\videos\video-14\output\master-tight-h264.mp4` (4.05 GB,
  referenced in place, read-only). The editor's preview for frame comparisons:
  `...\output\video-14-preview.mp4` (122 MB).
- `notes/import/build-video14.mjs` **hard-codes `PROJ = 'C:/Users/hasan/Videos/VidTSX
  Studio/projects/video-14'` at :27** and has **no `--shots-only` flag** (only `--dry-run`, :25);
  it imports `studio-lib.mjs`, which compiles Studio's own bundle step from
  `D:/repos/VidTSX-STUDIO/src` on every run (so the branch's fix is what it bundles with), using
  `D:/repos/VidTSX-STUDIO/.vidtsx-temp/v14-import` as scratch.
- `notes/import/warm-fonts.mjs:19` writes to `%APPDATA%\VidTSX Studio\font-cache` — Hasan's real
  profile. Do NOT run it as-is.

**How to work on video-14 safely (orchestrator decision for track A):**
- Make ONE shared copy for track A: `.vidtsx-temp/end-to-end/v14-root/projects/video-14`
  (robocopy/cp of the whole folder, 460 MB on D:; D: had 6.2 GB free at 20:37). A3, A4, A5, A6 and
  the track exit all use it (each isolated profile sets its Studio root to
  `.vidtsx-temp/end-to-end/v14-root`). Never write to the original.
- Run the import script only from the COPY's `notes/import/`, after editing the copy so `PROJ`
  points at the copy (an env var or argv override is fine) and adding `--shots-only` there (the
  script lives in Hasan's project notes, not the repo: changing the COPY is fine; the original
  stays untouched). Read the script fully before running it; `--dry-run` first.
- Fonts: let the isolated profile's own proxy fetch them, or point a copy of `warm-fonts.mjs` at
  `<isolated profile>/font-cache`.
- The 5 s render: a range across `v14-a1-nobody` (or another shot with a google-fonts load), at
  3840×2160 @ 60, Standard, CPU "low". Remotion copies the 4.05 GB master into the job scratch on
  C: (A2 put it there; it is removed after the run) — check C: has ≥ 10 GB free first. Give the
  export an output folder under `.vidtsx-temp/end-to-end/A3/`. Keep the machine awake for the
  render (DRIVING.md).

## Steps (the part, numbered)

1. **Code fix + unit tests** — DONE (`c3aefe8`).
2. **Shared video-14 copy + one-shot re-bundle** — make the copy, edit the COPY's import script
   (`PROJ` override, `--shots-only`, a single-shot filter), re-bundle `v14-a1-nobody` only.
3. **One-shot proof** — isolated profile on the copy: the shot in the Player (font load, no stuck
   hold, no console errors), then the 5 s Standard render at 3840×2160 @ 60 across it, CPU "low".
   Spike verdict recorded (parity holds → keep; fails → the §5 fallback).
4. **All 55** — `--shots-only` over the copy, `grep -c remotion_delayRenderHandles` = 0 over the
   55 `v1.tsx`; full gates, STATUS row, TESTING §18.3, DONE.

## Done (file:line, commit hashes)

- **`c3aefe8` fix(studio): A3 — keep remotion/<subpath> external in shot bundles.**
  - `src/main/services/studio/shot-bundle.ts:43` — `EXTERNAL = /^(react|remotion(\/.+)?|@vidtsx\/kit)$/`
    (the plan's T7 regex; comment :35-42 says why). The `require()` shim path (CJS deps) covers
    subpaths too: same filter.
  - `src/shared/studio/shot-lint.ts:22-27` — `REMOTION_SUBPATHS = ['remotion/no-react',
    'remotion/version']` (remotion 4.0.435's `exports`: `.`, `./version`, `./no-react`,
    `./package.json`) and `isShotModuleSpecifier()`; :103 the lint uses it. Error text keeps
    its old prefix ("shots may only import from 'react', 'remotion', and '@vidtsx/kit' (plus
    remotion's own …)"). An unknown `remotion/foo` is externalized by the bundle step, then
    rejected by the lint on the artifact.
  - `src/shared/studio/shot-import.ts:20, 49` — the classifier's private `SHOT_MODULES` set is
    gone; it uses `isShotModuleSpecifier`.
  - Preview: `src/main/services/virtual-module-files.ts` (new, pure) — the shared-instance map
    moved out of `tsx-transpiler.ts` (used at :234) and gained `remotion/no-react` →
    `remotion.js/no-react`, `remotion/version` → `remotion.js/version`. Before this, a direct
    `remotion/no-react` import in a transpiled shot went to **esm.sh** (`buildCdnUrl`, no alias)
    = a second copy, offline failure.
  - `src/main/services/module-server.ts:136-139` — new route `/virtual/remotion.js/version`;
    `src/main/services/virtual-modules.ts:346` `getVirtualRemotionVersionModule()` (re-exports
    `VERSION` from `window.__VIDTSX_REMOTION__`, which remotion's root exports). The
    `/virtual/remotion.js/no-react` route (:131) already existed; its virtual module exports
    exactly what 4.0.435 `no-react.mjs:693` exports (`random, interpolate, NoReactInternals`).
  - Export: nothing to change — `@remotion/bundler` 4.0.435 `dist/webpack-config.js:31-33`
    aliases `remotion/no-react`, `remotion/version` and `remotion` to the app's one copy.
  - `src/shared/tsx-engine/builder-libraries.ts:114-115` — comment only.
  - Tests: `shot-bundle.test.ts:193` (Space Grotesk via `@remotion/google-fonts`: no inlined
    `remotion`, no `remotion_delayRenderHandles`, the `remotion/no-react` import hoisted above
    `function __vidtsxInit()`, lint clean); `shot-lint.test.ts:68, 79` (accepts both subpaths;
    rejects `remotion/foo`, a deep `remotion/dist/...` path, `@remotion/google-fonts/Inter`,
    `react-dom`); `virtual-module-files.test.ts` (3 tests).
- **Parity spike, static half:** the editor's inlined google-fonts is
  `D:\repos\claude-youtube-editor\remotion\node_modules\@remotion\google-fonts` **4.0.486**; its
  font module imports `continueRender, delayRender` from `remotion` and uses exactly one
  `NoReactInternals` member, `ENABLE_V5_BREAKING_CHANGES` — present in the app's 4.0.435
  (`node_modules/remotion/dist/esm/no-react.mjs:508` `= false`, exported :684). So the API the
  4.0.486 code calls exists; the one-shot render (step 3) is still the decider per §5.

## Verified (exact commands + outputs)

- `npx vitest run src/shared/studio/shot-lint.test.ts src/main/services/studio/shot-bundle.test.ts src/main/services/virtual-module-files.test.ts src/shared/studio/shot-import.test.ts src/shared/tsx-engine/builder-libraries.test.ts`
  → `Test Files 5 passed (5) · Tests 60 passed (60)`.
- Regression proof: with the old regex swapped back (scratch script
  `swap-external.cjs old`), `npx vitest run src/main/services/studio/shot-bundle.test.ts -t "no-react external"`
  → `AssertionError: expected [ Array(2) ] to not include 'remotion'` · `1 failed`; restored →
  `1 passed`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Full `npx vitest run`: NOT run yet (run it at the part's end with the app stopped, logged).
- Free space at 20:44: **C: 24.46 GB, D: 6.11 GB**.

## Next step (ONE concrete instruction)

Copy `%USERPROFILE%\Videos\VidTSX Studio\projects\video-14` to
`D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\v14-root\projects\video-14` (robocopy /E, ~460 MB;
re-check D: free first), then in the COPY's `notes/import/` read `build-video14.mjs` and
`studio-lib.mjs` fully, edit the copy so `PROJ` comes from an env var/argv (default: refuse to run
on the original path) and add `--shots-only` plus a `--shot <id>` filter, run it with `--dry-run`,
then for real on `v14-a1-nobody` only — and confirm that shot's `v1.tsx` has 0
`remotion_delayRenderHandles` and a top-level `from "remotion/no-react"` import.

## Open problems

- `src/main/services/virtual-modules.ts` is now 357 lines (it was 339 before A3, already over the
  ~300 house limit). The version module went there as the natural home; splitting the file is
  out of A3's scope.
- The preview half is unit-tested only. The live Player check (§5 "The Player": a font-loading
  shot, its `delayRender` released, no 404 on `/virtual/remotion.js/*`, no esm.sh request for
  `remotion`) is step 3.
- Plan §1.3 text ("the lint still allows only the three externals and rejects subpaths") is now
  outdated by design (T7); the plan is not edited by builders.

## Do-not-redo

- A1 DONE, A2 DONE (export disk preflight + job-scoped Remotion temp). Do not touch `main`.
- Step 1 (`c3aefe8`): the externals regex, the lint widening, the preview map/route and their
  tests are done and proven to fail without the fix. Do not re-derive them.
- The parity question is answered statically (one member, present in 4.0.435); only the live
  render remains.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-21 · agent 1 · ~38 calls · step 1: read the code paths (bundle step, lint, finish,
  preview transpiler + module server, export webpack aliases), the fix + tests, regression proof,
  types gate, static parity; commit `c3aefe8`.
