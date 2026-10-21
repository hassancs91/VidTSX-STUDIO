# A2 — Export disk preflight + cancel/failure cleanup of the job's Remotion assets folder
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts).

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A2** | The disk preflight (output drive + `%TEMP%`, estimate shown) and the cancel/failure cleanup of the job's Remotion assets folder | a cancelled range export leaves nothing; a too-small disk refuses with numbers |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (add `### 18.2 A2` under the existing `## 18`). Anything the
composition renders is verified in preview AND a real export before the part closes (A2
changes no rendering).

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§1.7 "Temp" (plan :365-370):** temp entries in `<appRoot>/.vidtsx-temp/studio` (24 h sweep);
export scratch `%TEMP%/vidtsx-studio/export/<jobId>` removed after every run; Remotion's own
`%TEMP%/remotion-v4.0.435-assets*` copy of every source is swept at startup when older than
1 h, and on cancel only **empty** trees are removed (`run-export.ts:196-236`) — the cancelled
3.77 GB folder was left behind. **No disk-space preflight for exports** (the only `statfs` is
the AI-runtime installer).

Orchestrator's read of the current code (2026-10-21):
`src/main/services/studio/export-engines/run-export.ts` — `sweepExportScratch()` (startup:
scratch dirs + asset dirs older than 1 h), `remotionAssetDirs()` (every
`remotion-v\d+.\d+.\d+-assets*` under `app.getPath('temp')`), `removeEmptyRemotionAssetDirs(since)`
(after a cancel: only dirs born since the export started AND holding no files — "a folder
holding any file belongs to a live render and is left alone"). The hard part of A2 is knowing
which asset folder is THIS job's, so a cancel never deletes another render's folder (Hasan's
own app or another job may be rendering at the same time). Prefer a positive identification
(e.g. Remotion's own per-render download-map dir, if `renderMedia`/the compositor exposes or
accepts it) over a timing heuristic; record what you find.

Other §1.7 facts that touch A2: range export trims the timeline and overrides the frame count
(`studio-handlers.ts:482-499`); Standard concurrency from Settings › Rendering default CPU
(`render-cpu-usage.ts:10-15`); the two copy engines (Fast/Fastest) also write scratch and
browser spans (`export-spans.ts`), so the preflight and the cleanup should cover all three
engines, not only Standard.

**§2 T7 (the A2 slice):** "**Temp + disk**: on cancel/failure the job's own Remotion assets
folder is deleted; a disk-space preflight (output drive and `%TEMP%`) refuses an export that
would not fit, with the estimate shown."

**Making "a too-small disk" testable:** there is a precedent for a dev-only machine-fact
override — `VIDTSX_AI_RUNTIME_OVERRIDES` (`freeBytes`, read once per process, ignored in
packaged builds; `docs/ui-automation-cdp.md` "Getting past native dialogs"). A matching
dev-only override for the export preflight's free-space probe lets the CDP run show the
refusal and its numbers without filling a disk.

**§5:** none specific to A2. §1.8: C: 25 GB free, D: 7.0 GB free at the branch point.

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read `run-export.ts` and its callers/engines (Standard `remotion-engine.ts`, the copy engines,
`studio-handlers.ts:482-499`), find how Remotion names and creates its per-render assets
folder at 4.0.435, and write pure, unit-tested helpers first: the export size/temp estimate
(inputs: duration, resolution, fps, quality/CRF, engine, source sizes) and the preflight
verdict (free bytes on the output drive and on `%TEMP%` vs the estimate → ok | refuse with the
numbers).

## Open problems

(none yet)

## Do-not-redo

- A1 is DONE (`e4803cd`, docs `bd805af` + `8306c8e`). Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
