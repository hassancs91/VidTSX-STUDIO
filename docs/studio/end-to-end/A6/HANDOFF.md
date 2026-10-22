# A6 — The user-facing A/V check (T8) on the queue row + report JSON
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, repo facts,
video-14 rules, every "Learned" line). A5's drivers (`.vidtsx-temp/end-to-end/A5/drive.mjs`,
`launch.sh`, `awake-and-priority.ps1`) are reusable.

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **A6** | The A/V check (T8) on the queue row + report JSON | the A5 files pass; a file offset by 100 ms on purpose fails |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.6 A6`).

**Never hand back while a render, a check, or any other long job you started is still running —
wait for it inside your own session (background task + notifications).** (A5 lost ~5.7 h to a
builder that handed back mid-render.)

## Plan context (§1.x facts, §2 decision, §5 items to read)

**§2 T8 (verbatim):** "'Check this export' on the finished queue row runs the audio-offset
instrument against the first clip's camera file and a frame match at the sampled times, with
**verify_sync's verdict**: pass iff median |offset| < 25 ms and |drift × span| ≤ 40 ms over ≥ 3
confident probes; report JSON beside the file. The hidden two-engine verification stays for
developers."

**§1.7 Verify (plan :349-356):** hidden dev mode (`run-export.ts:57-60`: not packaged or
`VIDTSX_EXPORT_VERIFY=1`, plus a localStorage flag); re-exports through a second engine and
measures per-frame diffs at first/last/thirds/every cut, audio offset candidate-vs-reference and
**candidate-vs-the first clip's camera file** (`verify.ts:68-101` — `sourceReferenceOf` picks the
first video clip with an audio-bearing asset at speed 1; `windowsWithin` picks 3 windows;
`audio-offset.ts`: 48 kHz mono, 1 s windows, ±120 ms, normalised xcorr, 102 lines). **Report only,
no pass/fail.** The editor's `verify_sync.py` is differential: audio window located in the source
by xcorr, the frame located by z-score within ±0.8 s of where the audio says, sync error =
video − audio; passes iff median |offset| < 25 ms and |drift × span| ≤ 40 ms, needs ≥ 3 confident
probes.

**The reference implementation (read-only, port its semantics):**
`D:\repos\claude-youtube-editor\tools\verify_sync.py` (286 lines). Orchestrator's read of it:
`SR = 8000` audio work rate; frame thumbnails `192×108` grayscale; `SourceAudio.locate` (:112-135)
finds an audio window in the source by FFT xcorr; `match_frame` (:137-148) z-scores a window of
source frames against the edited frame (`sim = zscore(win) @ zscore(frame) / size`); `measure`
(:150-180) searches the source ±0.8 s around where the audio says (`grab_frames(source, … -0.8,
96)`); `report` (:182-210) exits "only N/M probes produced a confident match — try --probes 24,
or --min-match 0.85 if the video is mostly graphics" when too few are confident, and flags drift
when `abs(slope * span) > 40.0`; `--tolerance` default 25 ms (:249). It also has a `--fix` mode —
NOT in A6's scope.

**The hard part for video-14 (orchestrator's note — design, do not skip):** a whole-frame match
against the camera file only works where the camera picture is what the export shows. In the A5
range (80–110 s) the master is hidden under opaque cutaways except inside the split
(`clip_mvba3wua_309b03`, 89.9–103.15 s, `transform {x:1615.733, y:596, scale:0.388889}`, with the
`V14A1Scratch` overlay on top), so naive probes will not reach "≥ 3 confident". The app KNOWS,
for every timeline second, which V1 clip shows, its source time and its transform — so place
probes where the reference is visible and compare only the region where V1 is drawn (map the
export frame's V1 box back to the reference frame through the clip's transform), or skip times
where V1 is covered. Report how many probes were confident and why others were skipped. If after
a real attempt the A5 range cannot yield ≥ 3 confident probes, that is a finding about the exit
as written → BLOCKED with numbers, not a lowered bar.

**The reference file for video-14:** the copy's V1 asset is the 4.05 GB master
`D:\repos\claude-youtube-editor\videos\video-14\output\master-tight-h264.mp4` (read-only) — the
"first clip's camera file" for this project. A range export's timeline seconds map into it
through the V1 clips' `sourceIn`.

**"A file offset by 100 ms on purpose":** make it from one A5 file with a stream copy and an
audio offset (e.g. `-itsoffset 0.1` on the audio input, `-c copy`), written into
`.vidtsx-temp/end-to-end/A6/` — never next to the A5 originals. The check must FAIL it with the
measured offset (≈ 100 ms) in the report.

**UI:** the queue row lives in `src/features/render-queue/components/RenderItem.tsx` /
`RenderItemDetails.tsx` (`RenderQueueContext.tsx`). "Check this export" appears on a finished
Studio export row; it runs in main (IPC), shows progress, then the verdict (pass/fail, median
offset, drift, probes confident/total) and the report path; report JSON written beside the
exported file (e.g. `<name>.sync.json`). The A5 exports are in `.vidtsx-temp/end-to-end/A5/
export/` — for the click-through, either make them rows in the A6 profile's queue (re-run a short
export there) or let the check accept a file path too; the A5 files must still be checked as-is
for the exit.

**Profile:** copy `.vidtsx-temp/end-to-end/A5/profile` (full ffmpeg installed in-app in A4, NVENC
probed, warm fonts, Studio root `v14-root`) to `.vidtsx-temp/end-to-end/A6/profile`. D: had
3.8 GB free and C: 40 GB at 07:08; check before copying.

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read `verify_sync.py` in full and `src/main/services/studio/export-engines/verify.ts` +
`audio-offset.ts`; then write the pure core test-first: probe placement from the timeline (where
V1 is visible, with its transform), the verdict (median |offset| < 25 ms, |drift × span| ≤ 40 ms,
≥ 3 confident probes), and the report shape.

## Open problems

(none yet)

## Do-not-redo

- A1–A5 DONE. The two A5 exit files are the material — do not re-render them. Do not touch `main`.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
