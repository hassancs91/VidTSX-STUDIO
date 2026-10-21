# A3 — The no-react fix: `remotion/<subpath>` external in shot bundles
status: NEW

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

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read `shot-bundle.ts`, `builder-libraries.ts`, `shot-lint.ts`, `shot-bundle-finish.ts` and how the
export bundle and the preview module server resolve `remotion` subpaths; then change the
externals regex and the lint (with unit tests: a bundle importing `@remotion/google-fonts` keeps
`remotion/no-react` external and contains no `remotion_delayRenderHandles`; the lint accepts
`remotion/no-react` and still rejects other packages), and make sure both the preview and the
export entry can resolve every `remotion/<subpath>` a bundle may now import.

## Open problems

(none yet)

## Do-not-redo

- A1 DONE, A2 DONE (export disk preflight + job-scoped Remotion temp). Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
