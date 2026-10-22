# B4 — Hasan's step: re-do your Act-1 joins, let Studio learn the cut knobs

**What it proves (B4's exit):** after you trim the sentence joins of Act 1 the way you like them,
"Learn from this video" proposes `head`, `minTail` and `margin` within ±30 ms / ±1 dB of the tight
you fitted on 10-15 (`head 0.15 · minTail 0.08 · margin 12`). Everything up to your step is built
and verified (an automated stand-in reached 0.15 / 0.08 / 12 on the same footage).

**Time: about 25–30 minutes** — first launch ~1 min, Snap off once, ~21 joins at 60–70 s each
(put the playhead on it, zoom in, listen, drag two edges, check the total after each, listen again)
≈ 21–25 min, learn + read the card ~2 min.

**Nothing of yours is touched.** The station is this branch's dev build (`end-to-end-p0`; your
installed 1.1.0 has no B1–B4) on a scratch profile
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B1-verify\profile`, Studio root = a scratch copy
of M2 `C:\Users\hasan\AppData\Local\vidtsx-e2e\B1-verify-root`. The raw DJI clips are read in place.

## 1. Open the station

From the repo folder `D:\repos\VidTSX-STUDIO`:

```powershell
powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B4\hasan-station.ps1
```

The console builds for about a minute, then the app opens. Go to **Studio → video-14-raw** (the
profile already points at the scratch root). Dismiss any "Not now" prompt.

What you should see: **V1 = 36 clips, 01:46.47**, A1 empty. These are your own `cuts.json` keeps of
0369 (6 clips), 0370 (10) and 0371 (20) — **Act 1 = preview-tight 0:00–1:55**, retakes already out —
planned with the **old pre-October tight** (`head 0.11, minTail 0.14, maxTail 0.4, margin 5`), so
every join starts with the old lead-ins and tails on purpose. (Optional check: click a clip's tile
in Media → the Auto Cut readout says `tight + 4 overrides · preset "B4 start — old tight"`.)

**Ripple must be on:** in the timeline toolbar the two buttons right of the trash can — **Auto
ripple** and **Ripple all tracks** — are both lit (they are on by default on this profile). With
them on, lengthening a lead-in pushes the rest of the timeline instead of stopping at the
neighbour clip.

## 2. Trim each sentence join the way you want it (about 21)

**First — before you click anything in the timeline — turn Snap OFF.** Snap is ON every time the
project opens (again after a restart or a `-Reset`). It is the magnet ("Snap to edges and playhead")
in the group at the right end of the timeline toolbar, just left of the two magnifiers; lit = on —
click it once so it goes dark. Why first: with Snap on, a dragged edge pulls to any clip edge or to
the playhead within 8 px. The neighbour's edge sits exactly where the edge you drag starts, so a
small trim snaps straight back (nothing changes); and once the playhead stands on a join, a small
drag can snap to the playhead instead — it stands on the nearest frame, a few ms off the edge — and
commit a few-ms trim you would not notice.

A join = two neighbouring clips from the SAME source clip (the 0369→0370 and 0370→0371 changes are
not joins). For each join you care about:

1. **Playhead on the join:** click the ruler (the strip of times above V1) at the join; the playhead
   jumps there.
2. **Zoom in until the + magnifier greys out** ("Zoom in", or Ctrl+scroll over the timeline) — at
   least to 320 px/s, where 30 ms ≈ 10 px. How many clicks depends on where you start: from the
   20 px/s the project opens at, 4 clicks = 320 px/s; from "Zoom to fit" (step 6) the start is lower
   (5–20 px/s depending on the window width), so it takes 5–6 clicks. When + is grey you are at the
   top (640 px/s). If the join lands at the right edge of the timeline, drag the scrollbar under the
   tracks to bring it back. (A verifier at only 80 px/s still got valid trims — this is precision,
   not correctness — but zoom in fully.)
3. **Read the total before you drag:** the grey `/ 01:46.47` right of the clock at the left end of
   the timeline toolbar. Both read MM:SS.FF — the two digits after the dot are **frames** (60 per
   second, 1 frame ≈ 17 ms), not hundredths.
4. **Drag one edge, grabbing it in the LOWER half of the clip**, below the small square that sits on
   the join (hovering a clip lights a thin bar at each of its edges — that bar is the handle). The
   square is "Add transition" and the top corners of each clip hold the fade dots ("Fade in" /
   "Fade out") — grabbing either of those does not trim. The square opens a transition menu
   (Crossfade / Dip to black …): press Escape. A fade dot dragged inward WRITES a short fade (a dark
   wedge appears in that top corner): press Ctrl+Z once to remove it (only if the wedge appeared —
   don't undo a good trim).
   - the **right edge of the left clip** = the tail after the last word;
   - the **left edge of the right clip** = the lead-in before the next word.
5. **Check it took — the total is the sign, for both edges.** A trim changes the total by the amount
   you moved: up when you lengthened (tail dragged right, lead-in dragged left), down when you
   shortened; 30–50 ms is 2–3 frames (e.g. `/ 01:46.47` → `/ 01:46.50`). What the edge itself does:
   - a **tail** edge stays where you dropped it, and everything to its right moves with it;
   - a **lead-in** edge **comes back to the join** when you let go — that is normal with ripple on:
     the right clip keeps its place, its waveform slides (earlier audio appears at its start when you
     lengthen), and everything after it moves. For a lead-in the total and the waveform are the only
     signs.
   - **Total unchanged** = the trim did not register (Snap still lit, you grabbed the square or a
     fade dot — see step 4 for the menu / the fade wedge — or you moved under 2 px) — check the
     magnet is dark and drag again from the lower half. **Total moved more than you meant, or the wrong way** = Ctrl+Z (Undo) and drag again.
6. Listen across the join, adjust, then **Zoom to fit** (Shift+Z, the last toolbar button) to see the
   whole Act and go to the next join.

(Each registered trim also writes a tag on that clip edge in the station's `project.json` —
`"origin": {"by": …, "op": "trim", "edges": {"end": "trim"}}` — which is what the learner reads; you
do not need to look.)

**Only drag edges** in this project: no splits, deletes or Transcript edits (a Transcript delete is
not a learning sample until you trim it; a split or delete at a join drops what you did there).
Joins you leave alone teach nothing; it needs at least 10 trimmed tails and 10 trimmed lead-ins
before it changes a knob.

The 33 joins on the station (timeline time of the join · last word | next word). The **at** column
is seconds with hundredths (M:SS.hh); the toolbar clock shows MM:SS.FF in frames — e.g. join 2 at
0:10.25 reads `00:10.15` on the clock (0.25 s = frame 15):

| # | at | clip | words | # | at | clip | words |
|---|---|---|---|---|---|---|---|
| 1 | 0:05.81 | 0369 | Code. \| But | 18 | 1:04.56 | 0371 | customer. \| However, |
| 2 | 0:10.25 | 0369 | business. \| And | 19 | 1:05.60 | 0371 | However, \| a |
| 3 | 0:13.82 | 0369 | costs, \| no | 20 | 1:08.66 | 0371 | locally \| on |
| 4 | 0:15.22 | 0369 | bills. \| And | 21 | 1:10.42 | 0371 | computer. \| For |
| 5 | 0:17.34 | 0369 | online. \| Look | 22 | 1:12.67 | 0371 | both \| My |
| 6 | 0:22.29 | 0370 | hours. \| And | 23 | 1:14.28 | 0371 | application \| and |
| 7 | 0:26.19 | 0370 | minutes. \| These | 24 | 1:16.07 | 0371 | app \| costs |
| 8 | 0:29.05 | 0370 | applications. \| And | 25 | 1:18.23 | 0371 | run. \| Okay, |
| 9 | 0:31.10 | 0370 | video, \| I | 26 | 1:23.74 | 0371 | fast. \| The |
| 10 | 0:34.35 | 0370 | development. \| And | 27 | 1:28.72 | 0371 | boilerplate. \| Think |
| 11 | 0:36.57 | 0370 | free, \| so | 28 | 1:33.41 | 0371 | want. \| So |
| 12 | 0:39.52 | 0370 | today. \| Not | 29 | 1:35.90 | 0371 | scratch, \| This |
| 13 | 0:43.48 | 0370 | people \| wait | 30 | 1:39.12 | 0371 | costs \| when |
| 14 | 0:47.19 | 0370 | it. \| If | 31 | 1:41.05 | 0371 | Code \| or |
| 15 | 0:53.43 | 0371 | apps? \| Simply, | 32 | 1:42.95 | 0371 | agent. \| so |
| 16 | 0:54.49 | 0371 | Simply, \| uh | 33 | 1:45.18 | 0371 | focus \| on |
| 17 | 0:59.53 | 0371 | database, \| which | | | | |

(Times are at the start state; they shift by your trims since ripple is on.)

## 3. Learn from this video (the button — not the Assistant chat)

Press Escape / click an empty part of the timeline so nothing is selected → **Inspector** tab →
**PROJECT** → **Learn from this video** (beside "Preset B4 start — old tight"). When it says the card
is ready, open the **Assistant** tab.

Do **not** type in the Assistant chat in this project and do **not** change the AI Assistant
"Provider" dropdown (it shows "App default (active provider)" — display only, leave it): the project is set to a provider id that does not exist (`b4-no-model`), so
the button makes no model call and the card's summary reads "(numbers only — no summary model was
available)". That is expected.

## 4. Read the card — what passes

The knob table shows the cut rows as `old → new`:

| Row | Pass |
|---|---|
| **Cut lead-in (s)** `0.11 → X` | X in **0.12 – 0.18** (0.15 ± 0.03) |
| **Cut tail min (s)** `0.14 → Y` | Y in **0.05 – 0.11** (0.08 ± 0.03) |
| **Cut margin (dB)** `5 → Z` | Z in **11 – 13** (12 ± 1) |
| Cut tail max (s) | not part of the exit: it reads "at least N s" (only known up to the longest tail you kept; it is only ever raised) |

A missing row means "unchanged": a knob is proposed only when the value that reproduces your edges
is MORE than 30 ms (1 dB for margin) away from the current one (your Q4 answer). **The pass rule
(orchestrator, 2026-10-22) is the same for all three knobs: PASS if the row is there with its new
value in range, OR the row is missing and the fitted value in its line under the table ("… head X s
reproduces your edges", and the same for tail min / margin) is in range.** A fit of 0.14 is exactly
30 ms from the old 0.11 (and 0.11 from the old 0.14 for tail min), so it is not proposed although it
is inside the range — write down the number from the line either way; Claude records which case it
was (that is your Q4 threshold doing what you asked, not a miss).
Under the
table, the cut lines say how many joins it learned from (tails and lead-ins counted separately),
your median lead-in / tail / level next to the style's, and **Show the N joins it measured** lists
every join with "you / style" numbers (its "@ 7.33 s" is the time inside the SOURCE clip, not the
timeline time in the join table above). There should be no non-cut rows (pacing, shots, music …);
if any appear, ignore them — they come from the scratch preset. `softGap` (your 10-15 "soft
landings off") is not one of the learned knobs: it stays a style choice (a follow-up if you want
it learned).

Take a screenshot of the card (or note the three numbers and the "learned from N joins" line).
**Update preset** is optional: it writes only the scratch preset. Then close the window.

## After

- Tell Claude the numbers (or just "done"): your trims are saved in the station's `project.json`,
  so they can also be re-measured offline.
- To redo from scratch (app closed): `hasan-station.ps1 -Reset` — it first saves your
  `project.json` + `preset.json` under `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\station-runs\`.
- The station was click-checked on 2026-10-22 (launch through this script, the project opens, 36
  clips, the readout, one trim tagged + undone) and reset to its start state afterwards.
