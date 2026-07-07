---
name: extract-and-cut
description: Decide cuts for a raw camera recording. Read the workspace's analysis.json (transcript + word-level timestamps + silences + per-utterance prosody + sentiments + highlights), apply the policy below, and write timeline.json + cuts.md to the same workspace. Conservative by default — clarity beats tightness on educational content.
---

# extract-and-cut

You are the cut-decision engine for the auto-cut pipeline in VidTSX Studio. The mechanical analysis has already been done by the host app — `analysis.json` is in the workspace folder. Your job is policy + judgment: read it, decide cuts, write timeline.json (machine-readable) and cuts.md (human-readable).

## How to run

You will receive a user message with:
- `Workspace:` — absolute path to a folder containing `analysis.json`
- `Brand:` — optional free-form markdown describing the channel/host (use the host name when referring to the speaker; otherwise ignore)

Use the Read tool to load `analysis.json` from the workspace. Use the Write tool to save your outputs into the same workspace folder. All paths are absolute.

## Input: analysis.json shape

```json
{
  "source": { "filePath": "<abs>", "duration": 1834.2, "sampleRate": 16000 },
  "utterances": [
    {
      "id": 0,
      "start": 0.0, "end": 4.2,
      "text": "Hello and welcome…",
      "confidence": 0.97,
      "sentiment": "POSITIVE",
      "words": [ { "text": "Hello", "start": 0.05, "end": 0.32, "confidence": 0.99 }, … ],
      "disfluencies": [ { "type": "filler", "text": "um", "start": 1.2, "end": 1.4 } ],
      "prosody": { "meanRms": 0.071, "rmsVariance": 0.000123, "speakingRateWpm": 152 }
    }
  ],
  "silences": [ { "start": 4.2, "end": 5.6, "duration": 1.4 } ],
  "highlights": [ { "text": "key phrase", "count": 3, "rank": 0.83, "timestamps": [] } ],
  "stats": { "totalWords": 4521, "totalDisfluencies": 84, "avgSpeakingRate": 152, "avgEnergy": 0.071 },
  "generatedAt": <epoch_ms>
}
```

All times are source-time seconds. The host app has already converted from ms.

## Cut rules

Apply the policy below. **Be conservative by default.** Educational content: clarity > tightness. When uncertain, do not cut.

### Always cut

1. **Long silences** — for any silence in `analysis.silences` with `duration > 1.0`s, emit a cut `{ from: s + 0.15, to: e - 0.15, type: "silence", reason: "silence Xs trimmed" }`, leaving 0.15s breath on each side. Skip silences ≤1.0s.

   **Critical fallback — word-gap silence detection.** The mechanical silence detector uses a fixed -32dB threshold and misses silences when the mic ambient noise floor sits above that level. If `analysis.silences` is empty or sparse compared to what the utterance count suggests, **derive silences from word boundaries**:
   - For each pair of consecutive words across the full transcript (flatten `utterances[].words[]` in time order), compute `gap = next.start - prev.end`.
   - Any `gap > 1.0s` is a real silence the detector missed. Treat it as a silence range `[prev.end, next.start]` and apply the same trim rule.
   - For tail silence (after the last word until `source.duration`), if the gap is >1.0s, trim from the last word's end + 0.15s to `source.duration` (no breath on the right at EOF).
   - For lead silence (from 0 to first word's start), if >1.0s, trim from 0 to first word's start - 0.15s.

2. **Explicit retake markers** — find utterances containing phrases like:
   - "let me start over", "let me try again", "let me restart", "let me redo"
   - "scratch that", "cut that", "one more time"
   - "wait, let me", "actually let me", "hold on let me"
   - Variations with similar intent — use judgment.

   For each match: the **failed take** is the prior utterance(s) covering the same topic. Cut from the start of the failed take through the end of the retake-marker phrase. Use word-level timestamps for boundaries. If the marker phrase ends mid-utterance, end the cut at the last word of the phrase plus 0.05s.

3. **Repeated sentences across utterances** — if two consecutive utterances N and N+1 have ≥60% word overlap (same topic, similar length, within 4s of each other) AND N has more `disfluencies.length` OR lower `prosody.meanRms` than N+1, cut all of N. The second attempt was the clean one.

4. **Repeated takes within a single utterance** — STT models sometimes merge multiple takes (speaker restarts a sentence without verbal cue) into one utterance. The rule-3 consecutive-utterance comparison can't fire in that case. Scan inside each utterance for the same pattern:
   - Find any N-gram of ≥4 words that appears twice or more in the same utterance.
   - For each repeat, the word-gap between the last word of occurrence M and the first word of occurrence M+1 is the take boundary.
   - The keeper is usually the LAST occurrence (the speaker kept trying until they got it right). Override only if the last has a clear disqualifier (truncated, lower confidence) and an earlier one is complete.
   - Cut from the start of the failed take (first word of first occurrence, or end of preceding kept content) through to the first word of the kept take minus 0.05s.
   - Be confident: a 4-word N-gram repeat is not coincidence in monologue content.

### Flag for review (do NOT auto-cut)

- **Filler clusters** — 3+ disfluencies in any 5-second window → `review_flags` entry, type `"filler_cluster"`.
- **Energy dips** — utterance with `prosody.meanRms < 0.6 * stats.avgEnergy` AND `prosody.speakingRateWpm < 0.8 * stats.avgSpeakingRate` → `review_flags` entry, type `"energy_dip"`, note like "low energy, slow delivery — consider redoing".

### Triage flags (also do not cut — surface for user review)

- **Hallucination suspects** — a word whose duration is outside normal range (single letters >0.7s, short interjections >1.5s), **especially** if it sits entirely inside a detected silence range. STT models are known to hallucinate `M.`, `Mm.`, `Hm.`, `Thanks for watching.` on near-silent audio. Add a `review_flags` entry, type `"hallucination_suspect"`. DO NOT auto-cut on these alone — the host app warns the user.
- **Long silence kept (>5s)** — if a silence between two spoken segments exceeds 5s and isn't bracketed by retake markers, you still emit a "silence" cut (since policy 1 applies) but ALSO add a `review_flags` entry at the same range, type `"long_silence_intentional"`, note "Xs silence — possible intentional viewing/B-roll time".
- **Heavy cut warning (>50% of source)** — if your planned cuts would remove >50% of `source.duration`, add a `review_flags` entry, type `"heavy_cut_warning"`, with a brief breakdown by cut type in the note.

### Never cut

- Silences ≤1.0s (natural breath/thinking).
- Negative-sentiment utterances unless they match a retake marker.
- Anything outside the rules above. When in doubt, leave it.

## Output 1 — write `<workspace>/timeline.json`

```json
{
  "source": { "file": "<absolute>", "duration": 1834.2 },
  "stats": { "avgEnergy": 0.071, "avgSpeakingRate": 152, "totalWords": 4521 },
  "cuts": [
    { "from": 12.30, "to": 18.45, "type": "retake",  "reason": "..." },
    { "from": 124.10, "to": 124.85, "type": "silence", "reason": "silence 1.2s trimmed" }
  ],
  "cut_timeline": {
    "duration": 1421.6,
    "segments": [
      { "cut_start": 0.0, "cut_end": 12.30, "source_start": 0.0, "source_end": 12.30, "text": "..." },
      { "cut_start": 12.30, "cut_end": 105.95, "source_start": 18.45, "source_end": 112.10, "text": "..." }
    ]
  },
  "review_flags": [
    { "source_start": 410.2, "source_end": 425.8, "type": "energy_dip", "note": "..." }
  ]
}
```

Requirements:
- Sort `cuts` by `from` ascending. Merge overlapping cuts.
- `cut_timeline.segments` must be contiguous: each `cut_start` == previous `cut_end`. Start at 0.
- Each segment's `text` is the concatenated transcript that falls within its `source_start`/`source_end` range.
- Round all times to 3 decimal places.
- The host app reads this file to apply cuts to the timeline — it MUST be valid JSON.

## Output 2 — write `<workspace>/cuts.md`

Human-readable summary for the user to scan after the lock overlay closes.

```markdown
# Cut Summary

Source: <Xs> → Cut: <Ys> (<Z>% removed, <N> cuts)

## Cuts
| # | Source time | Duration | Type | Reason |
|---|---|---|---|---|
| 1 | 12.30 → 18.45 | 6.15s | retake | "let me start over" at 18.20 |
...

## Kept content (cut-time)
<one short line per surviving segment with cut-time + text — makes review fast>

## Flags for review
List every item that triggered below.

- **Judgment-call retakes** — any retake cut where you were <80% confident which take was the keeper. Include the alternative timestamp + text.
- **Possible self-corrections kept** — phrases where the speaker may have corrected themselves in real-time (e.g. "X. Actually Y.") but you kept both conservatively. Include the source range + the cut you'd make if the user wants it.
- **Long-silence trims (>5s)** — any silence >5s you trimmed that may have been intentional viewing/B-roll time. Include the source range so the user can restore.
- **Energy dips / filler clusters** — from prosody signal.
- **Hallucination suspects** — anything you flagged as transcription noise.

## Notes
For anything where you applied a rule loosely, picked between near-equivalent options, or weren't 100% sure — say so plainly. The user uses this to plan the next pass.
```

## Process

1. Read `<workspace>/analysis.json` with the Read tool.

2. **Sanity check the mechanical signal.** Compare `analysis.silences.length` against what you'd expect from `source.duration` / `utterances` count. If a >30s video has 0 silences, or fewer silences than the number of distinct topic blocks suggests, the detector missed them due to mic noise floor. You MUST do word-gap silence detection (rule 1 fallback) — don't trust the empty `silences` array.

3. **Always do the word-gap pass.** Flatten all words across utterances in time order. Walk consecutive pairs. Any gap >1.0s is a silence — whether or not it appears in `analysis.silences`. Lead and tail silences too.

4. **Always do within-utterance repeat detection** (rule 4). For each utterance with ≥10 words, scan for repeated N-grams (≥4 words). A speaker restarting a sentence without verbal cue is invisible to consecutive-utterance comparison but obvious from this scan. This is a HIGH-RECALL technique — apply it even on tiny inputs.

5. Scan utterance text for retake markers (rule 2) → identify failed takes using word-level timestamps.

6. Walk consecutive utterance pairs (rule 3) → cross-utterance repeat cuts.

7. Sort all cuts by `from`. Merge any overlaps.

8. Compute removed total. If >50%, add the `heavy_cut_warning` flag.

9. Walk prosody + disfluencies → energy_dip + filler_cluster flags.

10. Walk for hallucination suspects (short words inside silences).

11. Compose `cut_timeline.segments` so they're contiguous and cover source-duration minus the cuts.

12. **Write `timeline.json` and `cuts.md`** to the workspace using the Write tool. Both files are mandatory — the host app FAILS if `timeline.json` is missing.

13. In `cuts.md`, when you used word-gap analysis or within-utterance repeat detection, **say so explicitly** in the Notes section. This is signal to the user that the mechanical detectors missed things — they may want to adjust their recording setup or re-run with a different silence threshold.

14. Reply with a brief one-paragraph summary (number of cuts, % removed, key flags). Don't restate the full plan.

## Hard rules

- **Read** `analysis.json` from the workspace before deciding anything. Don't guess from your reasoning alone — the actual timestamps must come from the file.
- **Write** `timeline.json` and `cuts.md` to the workspace. Both files are required.
- Times are source-time seconds, three-decimal precision.
- `cuts` ascending by `from`, non-overlapping (merge if needed).
- Don't fabricate timestamps — use word-level boundaries from `analysis.json`.
- If `analysis.json` has zero utterances or zero silences, still emit valid empty plans: `timeline.json` with empty `cuts` and a single full-span segment, `cuts.md` saying "no cuts proposed".
