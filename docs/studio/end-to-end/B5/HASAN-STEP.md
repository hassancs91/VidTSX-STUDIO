# B5 — Hasan's step: edit the long raw recording by text, by ear, then decide the flag flip

> **Click-checked 2026-10-22 (builder #7).** Every instruction below was walked literally with real
> mouse/keyboard input on a copy of this station (same project, same 1,820 words): all 8 part-A clocks,
> all 11 part-B clocks, selection counts and toasts, part C and part D came out as written. The station
> itself was opened through `hasan-station.ps1` read-only and is untouched (its `project.json` = the start
> snapshot). The backfill fix under "After" is prepared as a patch (checked to apply on this branch, its
> tests pass) and NOT applied — the station runs the code as it is.

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

The console builds for up to a minute (about 25 s when it has built before), then the app opens. Go to
**Studio → video-14-raw** (the only project card). Dismiss any "Not now" prompt (none came up in the
check).

What you should see: **V1 = the nine raw clips 0366 … 0376 in recording order, nothing cut** — the
toolbar total right of the clock reads **`/ 21:23.09`** (MM:SS.FF — the two digits after the dot are
**frames**, 60 per second). In the left pane the **Transcript** tab (after Captions) is already open —
if not, click it: the header reads **"1,820 words"** and **"Remove 15 fillers"** (amber). Fillers
(um / uh) are amber in the text.

### How the Transcript tab works

- Each take starts with a small grey time (M:SS) — the take's place on the timeline. Clicking it jumps
  there. Scroll the transcript with the mouse wheel to find a take.
- **Click a word** → the playhead jumps to it and the word lights up. **Space** = play / pause (after a
  word click the transcript has the keyboard); the lit word follows the audio.
- **Select words:** for a few words, drag across them; for a long stretch, click the first word, scroll
  with the wheel, then **Shift+click** the last one. A bar at the bottom shows `N words · X s` (X = the
  words' own length), a ▶ (play the selection) and **Delete**. For one word: double-click it — the bar
  must read `1 word`. Escape clears a selection.
- **Delete** (the key or the button) cuts the selected words out of the video; the toast says
  `Removed N words · −X s` — X is what was cut, usually MORE than the bar's X: the cut edges snap to
  the pauses around the words (the project's tight cut style). The cut text becomes a small grey pill
  `¶ 4.8s`; clicking the pill shows the struck-through text and a **Restore**.
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
2. **Double-click the word** — the bar reads `1 word · 1.0 s` (W5: `0.7 s`; that second IS the moved
   start: AssemblyAI's own stamp is 16–49 ms long — W5 "a" 16 ms, W2 "so" 32 ms, W8 "How" 49 ms, the
   other five 48 ms) — **and press Delete.** Listen across the join: did the cut
   take sound that was not the word (the end of the word before, a breath you wanted, the start of the
   next word)?
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

(Measured: deleting the one word cuts W1–W8 = 1.0 / 3.2 / 2.2 / 2.9 / 0.7 / 3.3 / 1.8 / 3.6 s of source
— the toast's `−X s`; the moved start plus the tight style's snap to the pauses around it.) Note per row:
**highlight early? yes/no · delete lost sound? yes/no**.

## 3. Part B — eleven deletes you keep (bottom of the video first)

Work **from the end of the video backwards** (the table is in that order): a delete moves everything
AFTER it earlier, so going backwards keeps every time below valid when you reach it. For each row:
find the take, click its first bold word (the clock shows the "clock" column), select exactly the
**bold** words (the bar shows the "bar" column), Delete, check the toast, then listen across the join
(both pills when a delete spans two clips) — the "kept around the join" column is what you should hear.

| # | kind | take | clock at its first word | select | bar | toast | kept around the join |
|---|---|---|---|---|---|---|---|
| D11 | a phrase inside a sentence | 20:17 (0376) | `20:18.47` | **from you. These are just barriers** (drag) | `6 words · 2.1 s` | `Removed 6 words · −2.9 s` | These are just barriers ▸ stopping you from starting. |
| D10 | retake — first words of the last clip | 18:21 (0376) | `18:21.51` | **Okay, so to sum um up, before we move to the money— another take.** | `14 words · 10.1 s` | `−11.7 s` | …before you sell the application. ▸ Okay, so to sum up things before… |
| D9 | retake — five false starts | 16:45 (0375) | `16:45.00` | **And here's one of my friends— uh other take. … And here's one— other take.** (up to the one before "And here's one of my friends started") | `30 words · 9.5 s` | `−19.5 s` | …other projects like PyRunner. ▸ And here's one of my friends started 2 weeks ago… |
| D6 | retake — last words of a clip | 14:04 (0373) | `14:04.11` | **Overtake. I did, I did the first scan … Let's move on. Okay, great.** | `26 words · 14.8 s` | `−24.2 s` | …42 gigabytes of disk space. ▸ Building the app is just half… (0374) |
| D7 | one word inside a sentence | 12:19 (0373) | `12:29.47` | **really** (double-click) | `1 word · 0.1 s` | `−0.1 s` | …And it's ▸ a game changer for me. |
| D8 | stutter | 11:07 (0373) | `11:07.42` | **So that's—** (drag) | `2 words · 0.5 s` | `−5.0 s` | …in the description below. ▸ so that was a 24-minute application. |
| D4 | across two clips | 7:38 (0372 → 0373) | `07:38.36` | **So you can see the real magic. Okay,** | `8 words · 7.9 s` | `−4.8 s` — TWO pills: `So you can see the real magic.` (end of 0372) and `Okay,` (start of 0373) | …in just one minute. ▸ I clone it, install, |
| D5 | retake — first words of a clip | 5:47 (0372) | `05:47.59` | **So here's what I did. I built this desktop application starter … boilerplate. Other take.** — "So here's what I did. I created" comes TWICE in a row: the first (takes 6:00 + 6:02, "…I created this desktop application boilerplate. Other take.") is selected; Shift+click the "take." that ends the 6:02 take (`06:07.27`). The second, at **`06:08.40`** (take 6:08), is the one followed by "**a starter**" — it is KEPT. | `31 words · 19.8 s` | `−20.5 s` | …on the features you want to build. ▸ So here's what I did. I created a starter… |
| D2 | retake — three takes in a row | 3:24 (0371) | `03:24.17` | **However, a desktop app uh runs locally on your client's— … Other take.** — the selection ends INSIDE the 3:49 take: the "Other take." that OPENS it (`03:49.35`) is part of it; Shift+click that "take." (`03:49.51`). The kept "However, a desktop app runs directly and locally…" starts at `03:50.48`. | `39 words · 26.0 s` | `−31.8 s` | …before even your first customer. ▸ However, a desktop app runs directly and locally… |
| D3 | one filler by hand | 2:26 (0370) | `02:28.24` | **uh** (double-click) | `1 word · 0.6 s` | `−0.6 s` | …if you are ready, let's ▸ get started. |
| D1 | retake — false start, first words of a clip | 1:09 (0370) | `01:09.49` | **Last week I built this app in just 39— other take.** | `11 words · 4.8 s` | `−5.7 s` | …Look at this. ▸ Last week I built this in just 39 hours. (0369 → 0370) |

Every toast reads `Removed N words · −X s` with N = the bar's count. After D1 the project is 1,156.4 s
long (126.8 s cut by the eleven deletes).

## 4. Part C — Restore and undo

1. Find D7's pill (`…And it's ¶ 0.1s a game changer`), click it (it opens to `really 0.1s Restore`),
   click **Restore** → listen: "And it's really a game changer for me." exactly as before?
2. D4 left two pills (one per clip, `¶ 4.5s` and `¶ 0.3s`): open each and Restore → "…in just one
   minute. So you can see the real magic. Okay, I clone it" exactly as before?
3. Ctrl+Z → the last Restore is undone (its pill is back); Ctrl+Shift+Z → restored again. (A Restore
   shows no toast — the pill going away is the sign.)

## 5. Part D — "Remove N fillers"

Click **Remove 9 fillers** in the Transcript header (9, not 15: D2 took three "uh", D3, D9 and D10 one
each; the button hides while words are selected — press Escape first). The toast reads **`Removed 8
fillers · −12.0 s (1 spot too tight to cut cleanly)`** (a filler squeezed between two words is left
alone). Listen to three of them:

- the very start of the video ("Um" before "Today everyone is building applications.", pill `¶ 2.1s`);
- 0373 "You see now? **Uh** — Do you see this?" — the cut takes the filler AND the ~4.5 s pause after it
  (pill `¶ 7.0s`): does the join sound natural?
- 0373 "add a **uh** desk cleaner" — the one left alone (too tight, still amber): fine to keep?

Then close the window (everything autosaves).

## After

- Tell Claude: part A's yes/no per word, and any problem rows from parts B–D (or "all clean").
- **If part A sounds wrong** (highlights come early / a delete eats sound before the word), the fix is
  prepared, not applied: `docs/studio/end-to-end/B5/backfill-fix.patch` limits the backfill to whisper
  transcripts — one place in `withSpokenSpans` (`src/features/studio/services/transcript-doc.ts`, by the
  transcript's engine; AssemblyAI and ElevenLabs words keep the times they came with) + the one call in
  `useTextEdit.ts` + 3 tests. On this project it leaves **all 76** moved words at AssemblyAI's own start
  (a "≤ 20 ms" rule would still move 28 of them, W5 among them — AssemblyAI's "a" is 16 ms). Say "apply
  the backfill fix", or from the repo folder with a clean tree:

  ```powershell
  git apply docs/studio/end-to-end/B5/backfill-fix.patch
  npx vitest run src/features/studio/services/transcript-doc.test.ts src/features/studio/services/text-delete.test.ts
  npm run check:types
  git add src/features/studio/services/transcript-doc.ts src/features/studio/services/transcript-doc.test.ts src/features/studio/hooks/useTextEdit.ts
  git commit -m "fix(studio): Transcript tab keeps AssemblyAI and ElevenLabs word starts (backfill whisper only)"
  ```

  (Restart the station afterwards: part A's clocks then read AssemblyAI's stamps — the "AssemblyAI's
  stamp" column.) If part A sounds RIGHT, the patch is not needed — leave it.
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
