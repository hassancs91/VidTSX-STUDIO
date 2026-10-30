# Assistant timeline read — `get_timeline`, the cuts line, the cut anchor (design note + THE ACCEPTANCE BAR)

> T1 of the slice in `docs/studio/assistant-timeline/ORCHESTRATOR.md`, written by the orchestrator 2026-10-30 before any builder.
> Branch `library-search`, from `0df9e9c`. §8 is THE ACCEPTANCE BAR: T3 FAILS only by it. Function and file names are the design's
> suggestion; the BEHAVIOUR and every quoted string are the bar (a builder who must change a string records why in HANDOFF.md and the
> orchestrator rules before the verifier).

## 1. Why

The Studio assistant cannot see where the cuts are. The system prompt's "State of the edit" gives only `- Timeline: <length> long.`
(`studio-agent-prompt.ts:88-90`); none of the 25 prompt-listed tools reads the timeline's clips. So library search's four §9.3 5 turns
("… at the first cut.") all named the right clip and then ASKED for the cut's time (S4, ruling LS-r8). This slice gives the assistant
(1) a read tool, (2) the first cuts in the prompt, (3) a way to place at a cut without arithmetic.

## 2. Terms (one model, shared by the tool, the prompt line and the anchor)

- **Master track** = `masterLane(timeline)` (`src/shared/studio/caption-words.ts:40`): the LAST non-empty `video` track, else the first
  non-empty `audio` track — the lane captions and B4's join maths already use. Its clips are taken in `timelineStart` order.
- For two neighbouring master clips L, R: `d = R.timelineStart − (L.timelineStart + L.duration)`, `JOIN_EPS = 0.002` s (cut-learn-joins'
  `SAME_EDGE`).
  - `d > JOIN_EPS` → a **gap** `[L.end, R.start]` — not a join, not a cut. A first clip starting after `JOIN_EPS` makes a leading gap
    `[0, start]`.
  - otherwise (`|d| ≤ JOIN_EPS`, or an overlap — the document never stores one; listed so the code is total) → a **join** at `R.start`:
    - a **through edit** (not a cut) when ALL hold: `L.transitionOut` is absent; `L.assetId === R.assetId` (both defined); `L.kind ===
      R.kind`; neither has `tsx`; and either the kind is `image`, or the speeds are equal (`speed ?? 1`, within 1e-6) and
      `|R.sourceIn − (L.sourceIn + L.duration × speed)| ≤ JOIN_EPS` (`sourceIn ?? 0`). A plain split — the picture does not change.
    - every other join is a **cut**. Cuts are numbered **1, 2, …** in timeline order over the WHOLE timeline (never per window).
- **Time format** `formatTimelineTc(s)`: `cs = Math.round(max(0, s) × 100)`, `m = floor(cs / 6000)`, `r = cs − 6000m` →
  `` `${m}:${pad2(floor(r / 100))}.${pad2(r % 100)}` `` — `0:03.00`, `1:00.00` for 59.996, `2:05.50`, `60:00.00` for 3600. Source seconds
  print `toFixed(2)`; durations `toFixed(2)` + ` s`.
- Timeline length (for the tool's header) = the largest `timelineStart + duration` over every clip of every track.

## 3. `get_timeline(fromSec?, toSec?)` — the read tool

A new tool group `agent-tools/timeline-tools.ts` (`buildTimelineTools(ctx)`), appended LAST to `STUDIO_TOOL_IDS` (append-only rule,
`index.ts:1-4`). Read-only: allowed while a review is open. It reads the project from disk (`loadProject(req.projectId)` — the tools'
pattern: `cut-run-line.ts`, `flow-range.ts`); names come from `project.assets` (the file's basename, as `assetInfoFromMedia`) and
`project.shots`.

**Output (exact).** Line 1:
`Timeline <tc(length)> · master track "<name>" (<kind>): <n> clip(s) · <k> cut(s)[ · <g> gap(s)]. Times are timeline M:SS.ss; "src" is seconds into the asset.`
(singular for 1: `1 clip`, `1 cut`, `1 gap`). No master track but clips elsewhere → `Timeline <tc> · no master track (no clips on a
video or audio lane) · 0 cuts. Times are timeline M:SS.ss; "src" is seconds into the asset.` Every count is the whole timeline's.

A window (`fromSec > 0` or `toSec` given) adds line 2: `Showing <tc(from)>–<tc(to) | the end>; cut numbers count from the start of the timeline.`
A clip is in the window when `start < toSec` and `end > fromSec`; a gap row when it intersects the window.

Then the master track, then every other track in document order (master skipped):

- Header line `<name> (master track[, muted][, hidden][, locked]):`; other tracks `<name> (<kind>[, muted][, hidden][, locked]):`.
  A track with no clips at all is ONE line: `<name> (<kind>): empty` (`(master track)` never is — it has clips). A track with clips but
  none in the window: its header + `  (nothing in this window)`.
- Master rows (two-space indent), in timeline order, a gap row before the clip that follows it:
  - clip: `  #<i> <tc(start)>–<tc(end)> <label><join>` — `<i>` = the clip's 1-based position on the master track (global).
    `<join>` on the clip that STARTS at a join: ` ← cut <n> at <tc>` (+ ` (<transition kind> <d.toFixed(2)> s)` when L has
    `transitionOut`), or ` ← join at <tc> (same footage continues — not a cut)` for a through edit.
  - gap: `  gap <tc(a)>–<tc(b)> (<(b−a).toFixed(2)> s, nothing on this track)`.
- Other-track rows: `  <tc(start)>–<tc(end)> <label>` (no number).
- `<label>`: video / audio / sfx media → `"<asset name>" (<kind>) src <a>–<b>` with `b = sourceIn + duration × speed`, then
  ` at <speed>×` when speed ≠ 1, then ` · gain <gain>` when gain is set and ≠ 1; image → `"<asset name>" (image)`; TSX →
  `shot "<shot name>" (<tsx.mode>)`, or `shot <shotId> (not in the pool)`; a caption clip → `caption` (+ ` "<label>"` when set); an
  assetId not in the project → `asset <id> (missing)`.
- **Caps (the paging rule):** at most **40** master clip rows and **20** rows per other track per answer. Over the cap, the track's
  last line is `  … +<N> more — get_timeline(fromSec: <x>) continues from <tc(x)>.` with `N` = that track's clips in the window not
  listed, `x` = the first unlisted clip's start as a plain number (`Number(x.toFixed(2))`: `41`, `41.5`). Gap rows do not count toward
  the cap. A gap right before the first unlisted master clip prints on the page that stops there, before its `… +N more` line, and
  not again on the next page (ruling AT-r1, 2026-10-30 16:12 — a gap never falls between pages). (video-14: 35 master clips + 55 shots on one overlay lane → one page of 35 + 20 rows + one `+35 more` line, ≈ 4 KB.)
- Footer, only when the timeline has ≥ 1 cut: `Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.`
- No clip on any track → exactly `The timeline is empty — no clips on any lane.` `toSec ≤ fromSec` → isError
  `toSec must be after fromSec (got <from>–<to>).` A load failure → isError `Could not read the timeline: <message>`.

**The 2-clip test project** (`e3v-whoosh`: V1 = `e3v-c1` 0–3 s src 0–3, `e3v-c2` 3–6 s src 4–7; A1 empty) answers exactly:

```
Timeline 0:06.00 · master track "V1" (video): 2 clips · 1 cut. Times are timeline M:SS.ss; "src" is seconds into the asset.
V1 (master track):
  #1 0:00.00–0:03.00 "e3v-clip.mp4" (video) src 0.00–3.00
  #2 0:03.00–0:06.00 "e3v-clip.mp4" (video) src 4.00–7.00 ← cut 1 at 0:03.00
A1 (audio): empty
Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.
```

Tool description (pinned to mention `{ cut` and the caps): "Read the timeline as it stands: every lane's clips in timeline order
(start–end, the source span, the asset or shot), the master track's cuts numbered from 1 (cut n = the n-th place the picture changes),
and gaps. Read it before placing anything relative to the edit — a sound at a cut is insert_asset(at: { cut: n, offset }). Capped at 40
master clips and 20 clips per other lane per answer; fromSec / toSec read a window (cut numbers stay counted from the start)."

## 4. The cuts line in "State of the edit"

- The renderer already sends the live document's length (`EditorShell.tsx:487`, `timelineDurationSeconds`). It also sends
  **`timelineCuts?: StudioAgentTimelineCuts`** = `summarizeMasterCuts(tl.timeline)` (shared, §2's model; omitted when there is no master
  track): `{ trackName: string; clipCount: number; gapCount: number; cuts: number[] }` (every cut's time). New optional field on
  `StudioAgentSendRequest` (`src/shared/ipc/types/studio.ts`), passed through `useStudioAgent.ts` and `handleStudioAgentSend`
  (`studio-handlers.ts:541`) into `BuildAgentPromptInput`. The renderer owns the document (the request's existing rule); the tools read
  the saved copy — both through the same shared function, so the numbers agree once the autosave lands.
- The line goes right after `- Timeline: …` (exact):
  - field absent or `clipCount` 0 → no line;
  - `- <trackName> (master track): <n> clip(s)[ · <g> gap(s)] · <cuts>.` where `<cuts>` = `no cuts` (0); `<k> cut(s) — cut 1 at <tc>,
    cut 2 at <tc>` (1–5, all); `<k> cuts — cut 1 at <tc>, …, cut 5 at <tc>, +<k − 5> more (get_timeline lists them)` (> 5).
  - e.g. `- V1 (master track): 2 clips · 1 cut — cut 1 at 0:03.00.` · `- V1 (master track): 1 clip · no cuts.`

## 5. The cut anchor — `insert_asset(at: { cut, offset? })`

- Schema: the `at` union gains `{ cut: int ≥ 1 ("The n-th cut on the master track, 1 = the first — get_timeline numbers them"),
  offset?: number ("Seconds from the cut; negative = before it (default 0)") }`. The number and `{ word, take, assetId? }` forms are
  unchanged.
- Resolution (pure `resolveCutAnchor(timeline, { cut, offset }, clipDuration)` in `agent-tools/cut-anchor.ts`) on the SAVED timeline
  (`loadProject`; failure → isError `Could not read the timeline to find cut <n>: <message>`), with the inserted clip's final length
  (the `buildInsertProposal` clipping rule):
  1. `k` = the master track's cut count. `k = 0` (incl. an empty timeline) → isError
     `There is no cut on the master track[ "<name>"] (0 cuts) — pass \`at\` as timeline seconds or { word, take }.`
  2. `cut > k` → isError `The master track "<name>" has <k> cut(s) — cut <n> does not exist (cuts count from 1 in timeline order; get_timeline lists them).`
  3. `t = cutTime + offset` (offset default 0). The SIDE is the clip after the cut for `offset ≥ 0`, the clip before it for
     `offset < 0`; the point must lie inside it (`offset < R.duration`; `−offset ≤ L.duration`), else isError
     `<|offset|.toFixed(2)> s <after|before> cut <n> is outside the clip <after|before> it (<duration.toFixed(2)> s long) — pass \`at\` as timeline seconds instead.`
  4. When the side is a footage clip (an `assetId`, kind `video` / `audio` / `sfx`, no `tsx`): the candidate is
     `{ anchorAssetId: assetId, sourceStart: round3(sourceIn + (offset ≥ 0 ? offset : duration + offset) × speed) }` — the clip AFTER
     the cut for the default / positive offset (the brief's preference), the clip before for a negative one (the point is there).
     The candidate is KEPT only if the shared source→timeline mapping (§6) of `[sourceStart, sourceStart + clipDuration]` on the CURRENT
     timeline puts its first region's start within 0.001 s of `t` — exactly what the renderer will do at apply. Otherwise (speed ≠ 1 —
     the renderer's mapping ignores speed; the same source played earlier on any track; an image / TSX side) the anchor is the fixed
     `{ timelineStart: t }`.
  5. An anchored item is `{ assetId, sourceStart, sourceEnd }` (the word anchor's shape — it follows later trims and ripples until it
     is applied); a fixed one `{ timelineStart }`.
- The proposal headline (`agentNote`, also in the tool's answer) names the cut and the timeline time: `buildInsertProposal` gains an
  optional `atLabel` used instead of its placement label — `at cut <n> (<tc(t)> on the timeline)`, `<|offset|.toFixed(2)> s before cut
  <n> (<tc(t)> on the timeline)`, `<offset.toFixed(2)> s after cut <n> (<tc(t)> on the timeline)`. e.g.
  `Insert "whoosh-soft.mp3" as audio 0.25 s before cut 1 (0:02.75 on the timeline) · 0.7 s`. The answer template is unchanged
  (`Insert proposed (id "…"): <agentNote>. It is in the review panel — …`). The tool chip: `audio at cut 1` / `audio at cut 1 -0.25s`.
- Known limit (a NOTE): an anchored point that a later edit removes is skipped at apply, like a word anchor (`apply-insert-proposal.ts`
  "anchor already cut away").

## 6. Files (house rules: feature isolation, services own logic, pure + unit-tested, ≤ ~300 lines, no `any`, no new package)

New — `src/shared/studio/timeline-cuts.ts` (the §2 model: master clips, joins, cuts, gaps; `summarizeMasterCuts`; `formatTimelineTc`;
exported through `src/shared/studio/index.ts`) · `src/shared/studio/source-span-map.ts` (the source-span → timeline-regions core,
moved VERBATIM in behaviour from `features/studio/services/cut-proposal.ts:44-67`; `mapCutItemToTimeline` becomes a thin wrapper that
adds `itemId` — identical results, its existing tests untouched) · `src/main/services/studio/agent-tools/timeline-listing.ts` (the §3
text and the §4 line, pure) · `agent-tools/cut-anchor.ts` (§5, pure) · `agent-tools/timeline-tools.ts` (`get_timeline`) — each with a
`.test.ts` beside it. Edited — `agent-tools/index.ts` (append `'get_timeline'` + the group), `agent-tools/insert-tools.ts`,
`timeline-insert.ts` (`atLabel`), `studio-agent-prompt-tools.ts` (§7), `studio-agent-prompt.ts` (input + line), `src/main/ipc/studio-handlers.ts`,
`src/shared/ipc/types/studio.ts`, `src/features/studio/components/EditorShell.tsx` + `hooks/useStudioAgent.ts` (both already over 300
lines — a few lines each, said in the records), `src/features/studio/services/cut-proposal.ts`. No renderer file imports `src/main`;
no main file imports `src/features`.

## 7. The prompt lines (exact; pinned)

- `TOOL_LINES`, a new line immediately BEFORE the `insert_asset` line:
  "- `get_timeline(fromSec?, toSec?)` — the timeline as it stands: every lane's clips in order (timeline start–end, the source span, the
  asset or shot), the master track's cuts numbered from 1 in timeline order, and gaps. Read it before placing anything relative to the
  edit ("at the first cut", "after the intro"). A long timeline comes back capped — pass `fromSec` / `toSec` for the next part (cut
  numbers stay counted from the start)."
- The `insert_asset` line's `at` sentence becomes: "`at` is timeline seconds, `{ word, take }` to land where the speaker says a word,
  or `{ cut, offset? }` to land at the n-th cut on the master track (`cut: 1` = the first; `offset` in seconds, negative = before the
  cut) — the state of the edit lists the first cuts, `get_timeline` all of them." (the rest of the line unchanged).
- `insert_asset`'s own tool description gains: "or { cut, offset? } to land at the n-th cut on the master track (1 = the first; offset
  seconds, negative = before it; resolved to the footage where it can be, so it follows later trims)".
- `STUDIO_TOOL_IDS` = the 29 ids of `0df9e9c` in order, then `'get_timeline'`.

## 8. THE ACCEPTANCE BAR (fixed before any verifier; T3 FAILS only by this)

### 8.1 Unit (in the tree; new behaviour red first; the number / word paths pinned GREEN on the unchanged code first)

1. **Model** (`timeline-cuts`): the 2-clip project → 1 cut at 3.00 (left `e3v-c1`, right `e3v-c2`); a split with continuous source is a
   join, not a cut; an image split is not a cut; a `transitionOut` join is a cut even with continuous source; a 0.5 s gap is a gap, not a
   cut, and counted; a leading gap; an overlap → a cut at `R.start`; the master = the last non-empty video track (two video tracks), the
   first non-empty audio track when no video track has clips; TSX clips on the master make cuts; equal-speed continuity; empty → none.
   `formatTimelineTc` for 0, 3, 59.996, 125.5, 3600.
2. **Listing** (`timeline-listing`): the §3 2-clip answer EXACT (whole text); a synthetic timeline — 60 master clips with one gap, a
   25-shot overlay lane, an audio lane of 2 clips (one at gain 0.3), one muted lane: page 1 has exactly 40 master rows + the exact `+20
   more … fromSec: <x>` line, 20 overlay rows + `+5 more`, the audio rows exact; page 2 (`fromSec: x`) starts at clip #41 with GLOBAL cut
   numbers and the same line 1; a `toSec` window; the bad-window error; the empty-timeline string; the no-master header; missing asset /
   shot labels; flags.
3. **The cuts line**: exact for absent / 0 clips (no line), 1 clip 0 cuts, 2 clips 1 cut, exactly 5 cuts, 6 cuts (`+1 more`), with gaps;
   in `buildAgentSystemPrompt`'s output it is the line right after `- Timeline: …`.
4. **The cut anchor**: `{ cut: 1 }` on the 2-clip project → anchored `{ e3v asset, sourceStart 4 }`, t = 3.00; `offset: −0.25` → anchored
   on the left clip, `sourceStart` 2.75, t = 2.75; `offset: 0.5` → `sourceStart` 4.5, t = 3.50; `cut: 2` → the exact error naming
   "1 cut"; a 1-clip timeline and an empty one → the exact "(0 cuts)" error; an offset past its clip → the exact error; a TSX / image side,
   a speed-2 side with offset ≠ 0, and an earlier clip of the same source → the fixed `{ timelineStart: t }`. **It survives a trim:**
   resolve `{ cut: 1 }`, build the insert item, then shorten `e3v-c1` to 2 s and move `e3v-c2` to start at 2.0 → the shared mapping of
   the item starts at 2.00 (the new join); and a renderer-side test (`features/studio/services`, the item written by hand — no `src/main`
   import) shows `insertItemPlacement` = 2.00 on that timeline.
5. **`insert_asset` handler**: the `{ cut }` path through the real tool handler (project load mocked to the 2-clip project, the existing
   tool-test pattern) → the emitted proposal's item (`assetId`, `sourceStart` 4, `sourceEnd` 4 + length) and the answer text with `at cut
   1 (0:03.00 on the timeline)`; each error path isError with its exact text; the number and word paths: characterization tests written
   and green on the UNCHANGED `insert-tools.ts` first (commit shows it), green after; existing tests' assertions not edited.
6. **Prompt pins**: the two `TOOL_LINES` lines exact; `STUDIO_TOOL_IDS` = the 29 + `'get_timeline'` last; both tool descriptions mention
   `{ cut`; `get_timeline`'s mentions its caps.
7. **The shared mapping**: `mapCutItemToTimeline`'s existing tests untouched and green; `source-span-map` has its own test.

### 8.2 Gates

- The worktree vitest full run: green except the **25 LS-r1c suites** (failing here ONLY with "Cannot find module '<wt>\stream'" /
  "'<wt>\stream\promises'", each green in a fresh `git worktree add --detach <scratch> HEAD` run — the proof repeated at the gate's
  HEAD, the scratch worktree removed) and the **3 E-d2a suites** (package resolution only; independent of `git diff --name-only
  0df9e9c..HEAD` by an esbuild metafile or static walk — rule (b)); DRIVING's load rules / E-d13. A 26th `stream` suite, or any other
  failure, is real. *(Ruling AT-r2, 2026-10-30 17:01 — which run counts: the counted run is the first full default run, within three
  tries, whose failed set is exactly the 25 + 3 (or a `--maxWorkers=4` run, or E-d13's run when its load condition is measured). A
  5000 ms timeout seen in a try that does not count is recorded with the file's alone-run and is a NOTE when that file passes alone and
  in the counted run; the same file failing alone, or failing in the counted run, is real.)*
- `tsc` web ≤ 25 / node ≤ 10.
- The matcher files byte-identical to `7967c6f` (`git diff 7967c6f -- src/main/services/library/sound-match.ts sound-match-words.ts
  sound-match-vocab.ts` empty).
- Library search's §9.1 stays green: `src/main/services/library-search`, `src/library-search-engine` (the gated live test may skip),
  `audio-tools-no-claim.test.ts`, `list-assets-library.test.ts`.
- House rules over `0df9e9c..HEAD`: §6's import directions; new files ≤ ~300 lines (the pre-existing over-300 files named with their
  growth); 0 `any`; `package.json` / lock diff empty; Remotion pins untouched; `STUDIO_TOOL_IDS` append-only.

### 8.3 Live

1. **Smoke (T2 builder; the verifier repeats it):** `wt/out` built from HEAD's `src/`; the isolated app opens the 2-clip project (V1 shows
   2 clips; no renderer error in the app log); `get_timeline` through the REAL handler on that project's saved file (a node harness, the
   S4 `tools.s4.test.ts` pattern, app stopped) answers the §3 text exactly. No model turn.
2. **The four turns** (≤ 4 keyless `claude-subscription` turns in the round, + 1 retry each on an API error): t1 / t2 "Add a soft whoosh
   at the first cut.", t3 / t4 "Add the sound of things falling over at the first cut." — the prompts of LIBRARY_SEARCH_DESIGN §9.3 5 —
   on an isolated profile with the model downloaded, Smart, the 51-clip library, the stand-in audio provider (`VIDTSX_AUDIO_STANDIN_FILE`)
   with its counter, the 2-clip project restored to its pristine bytes before each turn, the chat empty. **PASS** = (a) none of §9.1's
   six claim strings in any tool answer (library rows' quoted descriptions excepted — S4's rule); (b) nothing generated (counter 0, no
   new file in the library); (c) every proposal / placement uses the allowed clip (whoosh: `whoosh-soft` or another whoosh-tagged sfx;
   falling: `crash-tumble`) and STARTS within **[2.00 s, 3.10 s]** on the timeline (cut 1 at 3.00 − 1.0 / + 0.1; an anchored item mapped
   through the turn's timeline); (d) at least 3 of the 4 turns place (an insert proposal, or an applied insert), each prompt at least
   once. A turn that ends by asking = a NOTE (at most one). **FAIL** = a generation, a wrong clip, a wrong time, a claim string, or fewer
   than 3 placing turns. Record per turn: the tools called with their arguments (`get_timeline`? `{ cut }` or seconds?), the item, the
   mapped start, the reply.

### 8.4 Only notes (never a FAIL)

Whether a turn used `{ cut }`, seconds or `get_timeline`; the by-ear check of a placed clip (DEFERRED-HASAN); video-14-size paging live
(unit-tested only); `run_flow`'s "shot N" counts the FIRST video track while the master is the last non-empty one (they differ only
with two video tracks — not this slice); the fixed-time fallback; markers are not listed; the renderer's mapping ignores speed
(pre-existing — §5 falls back to a fixed time instead).

## 9. Build order (T2; each part hand-off sized, red first)

1. `timeline-cuts` + `formatTimelineTc` + `timeline-listing` (§3) + `timeline-tools` + the `get_timeline` `TOOL_LINES` line +
   `STUDIO_TOOL_IDS` (§8.1 1, 2, 6).
2. The request field, the renderer, the state line (§8.1 3).
3. `source-span-map` (+ the wrapper), `cut-anchor`, `insert_asset`'s cut path, `atLabel`, the `insert_asset` prompt line and description
   (§8.1 4, 5, 6, 7) — the number / word characterization tests FIRST.
4. Rebuild `wt/out`; the smoke (§8.3 1); the full gates (§8.2). No Status.md / TESTING.md records in T2.

## 10. Not in this slice

Markers in the listing; a `{ marker }` anchor; shot / word anchors for `propose_shots`; changing `run_flow`'s numbering; a fallback
`timelineStart` on anchored inserts; any model call outside T3's four turns.
