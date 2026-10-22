# B5 — Hasan's step: edit the long raw recording by text, by ear, then decide the flag flip

> **DRAFT (builder #6, 2026-10-22) — NOT YET CLICK-CHECKED.** Every instruction below must be walked
> literally with real mouse/keyboard input on the station (through `hasan-station.ps1 -CdpPort 9325`),
> corrected, and the station reset before this goes to Hasan. Items marked **[check]** are guesses
> until then; the backfill-fix section points at a change that is not prepared yet.

**What it proves (B5's exit):** the Transcript tab (text-based editing, flag `studio-text-edit`, on in
dev builds, hidden in production) holds up on a long project, on AssemblyAI transcripts, by ear. If
your pass is clean, **flipping the flag on is your call** — the one-line change is at the end.

**What the machine already checked on this same project (so you only listen):** all 1,820 words with
AssemblyAI's own text and times; a word click lands on the word's frame (27/27); the highlight follows
playback (0 wrong frames) and scrolls along; every delete is one undo step, redo is exact, Restore
puts back exactly what was cut, also after closing and reopening the project; read-only while an Auto
Cut review is open; "Remove N fillers" cuts every filler it can. What a machine cannot judge: whether a
join SOUNDS right.

**Time: about 55–60 minutes** — first launch ~1 min, part A (8 words, ~2 min each) ~16 min, part B
(11 deletes, ~2.5 min each) ~28 min, parts C–D ~10 min.

**Nothing of yours is touched.** The station is this branch's dev build (`end-to-end-p0`) on a scratch
profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B5-station\profile`, Studio root = a scratch
copy of M2 `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-station-root`. The raw DJI clips are read in
place. The project is set to a provider id that does not exist (`b5-no-model`): nothing here calls a model.

## 1. Open the station

From the repo folder `D:\repos\VidTSX-STUDIO`:

```powershell
powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B5\hasan-station.ps1
```

The console builds for about a minute, then the app opens. Go to **Studio → video-14-raw**. Dismiss
any "Not now" prompt.

What you should see: **V1 = the nine raw clips 0366 … 0376 in recording order, nothing cut** — the
toolbar total right of the clock reads **`/ 21:23.09`** (MM:SS.FF — the two digits after the dot are
**frames**, 60 per second). In the left pane, click the **Transcript** tab (after Captions): the header
reads **"1,820 words"** and **"Remove 15 fillers"** (amber). Fillers (um / uh) are amber in the text.

### How the Transcript tab works

- Each take starts with a small grey time (M:SS) — the take's place on the timeline. Clicking it jumps
  there. Scroll the transcript with the mouse wheel to find a take.
- **Click a word** → the playhead jumps to it and the word lights up. **Space** = play / pause **[check]**;
  the lit word follows the audio.
- **Select words:** for a few words, drag across them; for a long stretch, click the first word, then
  **Shift+click** the last one. A bar at the bottom shows `N words · X s`, a ▶ (play the selection)
  and **Delete**. For one word: double-click it **[check]**.
- **Delete** (the key or the button) cuts the selected words out of the video; the toast says
  `Removed N words · −X s`. The cut text becomes a small grey pill `¶ 4.8s`; clicking the pill shows the
  struck-through text and a **Restore**.
- **Ctrl+Z** undoes the last edit (a delete is ONE undo step), **Ctrl+Shift+Z** redoes it.
- **To listen across a join:** click a kept word two or three words BEFORE the pill, press Space, listen
  through the join to two or three words after it, Space again.

### What "clean" means (for every join below)

1. no word start clipped (the first sound of the word after the join is there);
2. no word end clipped (the last sound of the word before the join, incl. its natural tail);
3. no audible click or pop at the join;
4. no word lost, no word doubled — you hear exactly the words the table says are kept;
5. the pause at the join sounds natural (not rushed, not a hole) — the cut style decides it, say so if
   it is wrong;
6. Restore brings back exactly what was removed — it sounds like it did before.

**Where to note a problem:** the row (W3, D4 …), the toolbar clock where you hear it, the word, and
what you heard (e.g. `D4 · 07:38.40 · "I clone" · the "I" is clipped`). Tell Claude, or type them into
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\station-runs\notes.txt`.

## 2. Part A — eight short words whose start Studio moves earlier (listen, delete, undo)

Studio moves the start of very short words (stamped under 50 ms, mostly "I", "a", "so") up to 1 s
EARLIER, filling the gap before them — a rule written for whisper's 0–20 ms stamps. It also fires on
AssemblyAI: here 76 of 1,820 words move, 25 of them by ≥ 0.5 s. Whether the word really starts there
is a listening question. For each row:

1. Find the take, **click the word**: the clock shows the "highlight starts" time. Press Space: does
   the word start right away (good), or do you hear about a second of something else first — silence,
   a breath, the end of the word before (early)?
2. **Select only that word and Delete.** Listen across the join: did the cut take sound that was not
   the word (the end of the word before, a breath you wanted, the start of the next word)?
3. **Ctrl+Z once** — the word is back and the pill is gone. (Each row starts from the untouched project.)

| # | word (clip) | take | in the sentence | highlight starts | AssemblyAI's stamp | moved |
|---|---|---|---|---|---|---|
| W1 | I (0370) | 1:48 | …in this video, **I** will reveal the… | `01:49.57` | `01:50.57` | 1.0 s |
| W2 | so (0370) | 2:05 | …everything for free, **so** you'll be able… | `02:05.47` | `02:06.47` | 1.0 s |
| W3 | I (0372) | 6:02 | …what I did. **I** created this desktop… (a QUIET gap before it) | `06:02.45` | `06:03.45` | 1.0 s |
| W4 | And (0372) | 6:45 | …already wired inside. **And** the most important… | `06:45.13` | `06:46.13` | 1.0 s |
| W5 | a (0371) | 3:49 | …Other take. However, **a** desktop app runs… | `03:51.23` | `03:52.06` | 0.7 s |
| W6 | Now (0373) | 7:55 | …the empty application. **Now** in Claude Code,… | `07:55.33` | `07:56.33` | 1.0 s |
| W7 | or (0375) | 15:51 | …day by day **or** feature by feature. | `15:51.59` | `15:52.59` | 1.0 s |
| W8 | How (0376) | 19:06 | …the money part. **How** to sell this… | `19:06.31` | `19:07.31` | 1.0 s |

(Measured on W1–W4: deleting the one word cut 1.0 / 3.2 / 2.2 / 2.9 s of source — the moved start plus
the tight style's snap to the pauses around it.) Note per row: **highlight early? yes/no · delete lost
sound? yes/no**.

## 3. Part B — eleven deletes you keep (bottom of the video first)

Work **from the end of the video backwards** (the table is in that order): a delete moves everything
AFTER it earlier, so going backwards keeps every time below valid when you reach it. For each row:
find the take, select exactly the **bold** words, Delete, check the toast, then listen across the join
(both pills when a delete spans two clips) — the "kept around the join" column is what you should hear.

| # | kind | take | clock at its first word | select | kept around the join |
|---|---|---|---|---|---|
| D11 | a phrase inside a sentence | 20:17 (0376) | `20:18.47` | **from you. These are just barriers** (6 words) | These are just barriers ▸ stopping you from starting. |
| D10 | retake — first words of the last clip | 18:21 (0376) | `18:21.51` | **Okay, so to sum um up, before we move to the money— another take.** (14) | …before you sell the application. ▸ Okay, so to sum up things before… |
| D9 | retake — five false starts | 16:45 (0375) | `16:45.00` | **And here's one of my friends— uh other take. … And here's one— other take.** (30, up to the one before "And here's one of my friends started") | …other projects like PyRunner. ▸ And here's one of my friends started 2 weeks ago… |
| D6 | retake — last words of a clip | 14:04 (0373) | `14:04.11` | **Overtake. I did, I did the first scan … Let's move on. Okay, great.** (26) | …42 gigabytes of disk space. ▸ Building the app is just half… (0374) |
| D7 | one word inside a sentence | 12:19 (0373) | `12:29.47` | **really** (1) | …And it's ▸ a game changer for me. |
| D8 | stutter | 11:07 (0373) | `11:07.42` | **So that's—** (2) | …in the description below. ▸ so that was a 24-minute application. |
| D4 | across two clips | 7:38 (0372 → 0373) | `07:38.36` | **So you can see the real magic. Okay,** (8) | …in just one minute. ▸ I clone it, install, |
| D5 | retake — first words of a clip | 5:47 (0372) | `05:47.59` | **So here's what I did. I built this desktop application starter … Other take.** (31, up to "So here's what I did. I created a starter…") | …on the features you want to build. ▸ So here's what I did. I created a starter… |
| D2 | retake — three takes in a row | 3:24 (0371) | `03:24.17` | **However, a desktop app uh runs locally on your client's— … Other take.** (39, up to the take "However, a desktop app runs directly and locally") | …before even your first customer. ▸ However, a desktop app runs directly and locally… |
| D3 | one filler by hand | 2:26 (0370) | `02:28.24` | **uh** (1) | …if you are ready, let's ▸ get started. |
| D1 | retake — false start, first words of a clip | 1:09 (0370) | `01:09.49` | **Last week I built this app in just 39— other take.** (11) | …Look at this. ▸ Last week I built this in just 39 hours. (0369 → 0370) |

## 4. Part C — Restore and undo

1. Find D7's pill (`…And it's ¶ … a game changer`), click it, click **Restore** → listen: "And it's
   really a game changer for me." exactly as before?
2. D4 left two pills (one per clip) **[check]**: restore both → "…in just one minute. So you can see the
   real magic. Okay, I clone it" exactly as before?
3. Ctrl+Z → the last Restore is undone (its pill is back); Ctrl+Shift+Z → restored again.

## 5. Part D — "Remove N fillers"

Click **Remove N fillers** in the Transcript header (N is lower than 15 now — your deletes took some
along) **[check the number]**. The toast says how many it cut and how many spots were too tight to cut
cleanly (a filler squeezed between two words is left alone). Listen to three of them:

- the very start of the video ("Um" before "Today everyone is building applications.");
- 0373 "You see now? **Uh** — Do you see this?" — the cut takes the filler AND the ~4.5 s pause after it
  (7.0 s in all): does the join sound natural?
- 0373 "add a **uh** desk cleaner" — left alone (too tight): fine to keep?

Then close the window (everything autosaves).

## After

- Tell Claude: part A's yes/no per word, and any problem rows from parts B–D (or "all clean").
- **If part A sounds wrong** (highlights come early / a delete eats sound before the word), the fix is
  prepared, not applied: limit the backfill to whisper-style near-zero stamps (≤ 20 ms) — one place in
  `withSpokenSpans` (`src/features/studio/services/transcript-doc.ts`) with its test. **[TO PREPARE —
  next builder: the patch file + its test, verified to apply.]** Say "apply the backfill fix".
- To redo from scratch (app closed): `hasan-station.ps1 -Reset` — it first saves your `project.json`
  under `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\station-runs\`.

## The flag flip — your call after the pass

The only production gate is `src/shared/feature-flags.ts:73` (`EditorShell.tsx:110` reads it through
`isFeatureEnabled`; dev builds force every plain flag on, which is why the station has the tab):

```diff
-  'studio-text-edit': false,
+  'studio-text-edit': true,
```

(and the comment above it, `:68-72`, from "A dev-preview … hidden in production until it has had its
testing pass on real footage" to "Shipped <date> after the B5 by-ear pass on M2"). Commit message:

```
feat(studio): Transcript tab on in production (studio-text-edit) after the B5 by-ear pass on M2
```
