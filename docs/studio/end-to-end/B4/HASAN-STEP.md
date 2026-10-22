# B4 — Hasan's step: re-do your Act-1 joins, let Studio learn the cut knobs

**What it proves (B4's exit):** after you trim the sentence joins of Act 1 the way you like them,
"Learn from this video" proposes `head`, `minTail` and `margin` within ±30 ms / ±1 dB of the tight
you fitted on 10-15 (`head 0.15 · minTail 0.08 · margin 12`). Everything up to your step is built
and verified (an automated stand-in reached 0.15 / 0.08 / 12 on the same footage).

**Time: about 20–25 minutes** — first launch ~1 min, ~21 joins at 45–60 s each (find, listen, drag
two edges, listen again) ≈ 15–20 min, learn + read the card ~2 min.

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
neighbour clip. If an edge jumps to a neighbour or the playhead while you drag, turn **Snap** (the
magnet, right end of the toolbar) off.

## 2. Trim each sentence join the way you want it (about 21)

A join = two neighbouring clips from the SAME source clip. For each one you care about:

- drag the **right edge of the left clip** to where you want the tail after the last word to end;
- drag the **left edge of the right clip** to where you want the lead-in before the next word.

Listen, adjust, Undo (Ctrl+Z) works. **Only drag edges** in this project: no splits, deletes or
Transcript edits (a Transcript delete is not a learning sample until you trim it; a split or delete
at a join drops what you did there). Joins you leave alone teach nothing; it needs at least 10
trimmed tails and 10 trimmed lead-ins before it changes a knob. The 0369→0370 and 0370→0371 clip
changes are not joins.

The 33 joins on the station (timeline time of the join · last word | next word):

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
"Provider" dropdown: the project is set to a provider id that does not exist (`b4-no-model`), so
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

A missing row means "unchanged" (= the old value, which is outside the pass range). Under the
table, the cut lines say how many joins it learned from (tails and lead-ins counted separately),
your median lead-in / tail / level next to the style's, and **Show the N joins it measured** lists
every join with "you / style" numbers. There should be no non-cut rows (pacing, shots, music …);
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
