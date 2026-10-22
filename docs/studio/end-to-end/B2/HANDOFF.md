# B2 — The default cut style file; `resolveCutStyle`; all four consumers; picker → preset read-out + project override; Project settings knobs; preset editor Cut section
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety rules, launcher, profiles on C:,
every "Learned" line) and the **"Track B decisions"** section of
`docs/studio/end-to-end/ORCHESTRATOR.md` (M2 location, transcripts, profile, Hasan-dependent
parts). B1 is DONE (`2dc5add`): read its STATUS row (top of `Status.md`) for what the snapper
now does.

**Never hand back while a job you started (proxies, waveforms, a render, a check) is still
running — wait for it inside your own session.**

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B2** | The default cut style file beside `studio-clean-cut` with Hasan's fitted values; `resolveCutStyle`; all four consumers on it; the picker becomes a preset read-out + project override; Project settings shows the resolved knobs; the preset editor gets a Cut section | the Auto Cut card headline names the preset's style; editorial and Transcript deletes snap with the same knobs |

Session gates (plan §3 head): `npx vitest run` green, `npm run check:types` at or below
baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md row,
the TESTING.md §18 block (`### 18.8 B2`, after `### 18.7 B1`). Schema additions optional only;
old projects and old presets must open untouched (no `cut`, no `settings.cutStyle` = today's
behaviour resolved through the new path).

## Plan context (§1.x facts, §2 decision, §5 items to read)

**Read plan §1.1 (:52-104), §1.2 (:106-129) and §2 T1 (:394-426) in full.** Essentials:

- **T1 (B2's slice):** "The generic default = `studio-clean-cut` (built-in, read-only, the policy
  prose) plus a default cut style shipped beside it as data
  (`resources/skills/studio-clean-cut/cut-style.json`: the three named styles). Its `tight`
  becomes Hasan's fitted tight (§1.1), `natural` his fitted natural, and a `relaxed` derived from
  natural. The old constants go." · "Per preset: `StudioPresetStyle` gains `cut?:
  Partial<CutPlanStyle> & { base?: 'tight'|'natural'|'relaxed' }`. `pacing` keeps its meaning and
  now maps to `base` (tight → tight, normal → natural, relaxed → relaxed) when `cut.base` is
  unset. One resolver, `resolveCutStyle(project, preset)`, feeds all four consumers — the Auto Cut
  button, `run_auto_cut`, the editorial snap and Transcript deletes — so the style picker in
  `TranscriptSection` becomes a read-out of the preset with an override that is stored on the
  project (`settings.cutStyle`), not in session state." Learning (`StudioPresetKnobKey` widening,
  the learn card) is **B4, not B2**; QA readouts are **B3**.
- **Hasan's fitted values** (`D:\repos\claude-youtube-editor\videos\video-14\work\analysis\cuts.json`
  → `styles`, read-only): tight = `internal_gap 0.4, min_tail 0.08, max_tail 0.7, head 0.15,
  max_head 0.3, min_skip 0.12, margin 12.0, soft_gap 99.0, soft_max_tail 0.6, soft_margin 6.0,
  fric_zcr 3500, fric_margin 5.0`; natural = `internal_gap 0.4, min_tail 0.26, max_tail 0.45,
  head 0.21, margin 6.0, soft_gap 1.2, soft_max_tail 0.7, soft_margin 3.0` (no max_head /
  min_skip / fric_* → those knobs off). Studio names are camelCase (`CutPlanStyle`,
  `src/shared/types/studio-cut-plan.ts`; B1 added the four optional knobs).
- **Where the style is picked today (grep 2026-10-22, line numbers current):**
  `src/shared/studio/cut-planner.ts:39-60` (`TIGHT_STYLE`, `NATURAL_STYLE`, `CUT_PLAN_STYLES`;
  `planCuts` reads `CUT_PLAN_STYLES[req.styleName]` at :239, writes `styleName` at :265);
  `src/shared/types/studio-cut-plan.ts:9` (`CutPlanStyleName = 'tight' | 'natural'`, `:90`
  `styleName` on the plan); `TranscriptSection.tsx:254, 267-270` (session-state picker, default
  tight); `useAutoCut.ts:18, 40, 77`; `InspectorPanel.tsx:43`; `studio-handlers.ts` (IPC default
  tight, plan cites :460-465 — re-grep); `src/shared/ipc/types/studio.ts:377`;
  `agent-tools/workflow-tools.ts:135` (`run_auto_cut` style enum, default tight);
  `cut-plan-runner.ts:62-91` (the plan cache file is `${assetId}-${styleName}.json`);
  `src/shared/studio/cut-snap.ts:45-46, 164` (editorial default `'natural'`) and its caller
  `cut-tools.ts:56-62` (no style passed; pause compression off); Transcript deletes
  `text-delete.ts:148-154` (natural); `src/shared/studio/cut-proposal.ts:102` (the card headline
  `Auto Cut (${plan.styleName})` — the exit reads this). `StudioPresetStyle`
  `src/shared/types/studio-preset.ts:11-25` (`pacing?: 'tight'|'normal'|'relaxed'`).
- **§1.2 presets:** user copies at `<assetsRoot>/presets/<id>/preset.json + PRESET.md`, built-ins
  seeded from `resources/presets/` then edited in place (`preset-store.ts`,
  `preset-builtins.ts`). Skills: ONE directory `resources/skills` (packaged
  `<resources>/skills`, `utils/paths.ts:114-119`); resources beside `SKILL.md` are listed by
  `readSkillResource` but never injected. `cut-style.json` is DATA the main process reads; the
  renderer (Transcript deletes run in `src/features/studio/services/text-delete.ts`) cannot read
  files — it must get the resolved style over IPC or from data it already has. Check the
  packaged build copies `resources/skills/**` (electron-builder `extraResources`) so the file
  ships.

## Orchestrator decisions (DECIDED — follow them; raise objections under Open problems)

1. **`relaxed`** = fitted natural with every time knob × 1.5 (2 decimals), dB margins unchanged,
   none of the four B1 knobs: `internalGap 0.6, head 0.32, minTail 0.39, maxTail 0.68,
   margin 6.0, softGap 1.8, softMaxTail 1.05, softMargin 3.0`. It is data in `cut-style.json`;
   say in STATUS that Hasan can change it. (No `relaxed` exists anywhere in the editor repo.)
2. **The fallback** when neither the project override, `preset.cut.base` nor `preset.pacing`
   names a style: `cut-style.json` carries `"default": "tight"` (the generic default = Hasan's
   fitted tight; Auto Cut and `run_auto_cut` default to tight today). Explicit per-call styles
   (the agent's `run_auto_cut({style})`) still win over everything.
3. **Precedence:** per-call style (agent arg) > project `settings.cutStyle` (the override, a
   style name; optional per-knob overrides only if cheap) > `preset.style.cut` (`base` + partial
   knobs over that base) > `preset.style.pacing` mapped > file default. One pure resolver in
   `src/shared/` with unit tests for every rung; it returns the knobs AND a display name (e.g.
   "tight · Hasan default", "natural (preset: <name>)", "tight + 2 overrides") that the card
   headline, the read-out and Project settings all show.
4. **Editorial keeps its pause-compression-off behaviour** — that is an editorial-pass choice,
   not a style; it now snaps edges with the resolved knobs instead of hard-coded `natural`.
   Transcript deletes likewise. Say in STATUS that editorial/text deletes moved from natural to
   the resolved style (tight by default) and what that changes.
5. **The plan cache key** must change with the resolved knobs (e.g. a short hash of the resolved
   style in the file name or a stored `style` + compare), or an edited preset reuses a stale
   plan. Old `<asset>-tight.json` plans must not break loading.
6. **Also (B1 doc debt, small):** in B1's STATUS row and TESTING §18.7, qualify the "211 ms"
   v2→v3 regeneration as warm-cache and add the verifier's ~5 s for the first open after a fresh
   launch (cold read of two clips at 2 jobs at once); rename the over-claiming test title in
   `src/shared/studio/rms-envelope.test.ts` ("a v2 cache (no zcr) behaves exactly like the old
   snapper" → it tests the new windowing with the fricative rule off).

**B1 finding to keep in mind (not B2's job to fix):** with Hasan's fitted tight now the default,
Studio's `snapHead` can give lead-ins up to +150 ms longer than cutlib's where a 20 ms bucket edge
is loud (4 of 200 atoms on video-14; no join moved). B3 measures hard entries / clipped tails.

**Material:** M2 = `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root\projects\video-14-raw` (nine
raw clips, v3 waveforms, Hasan's AssemblyAI transcripts mapped; clip ↔ asset ids in
`docs/studio/end-to-end/B1/HANDOFF.md` "Done"). It is SHARED by B2–B6 and their verifiers:
back up `project.json` before a live run and restore it afterwards (B1 did — `cmp` identical), or
work on a copy in your own C: root. New profile: copy
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile` to
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B2\profile` (DRIVING.md), CDP port 9281.
Disk at hand-off: C: 23.7 GB, D: 2.15 GB (D: stop line ~2 GB; other Claude sessions write to D:
too — keep your D: writes small).

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Write `resources/skills/studio-clean-cut/cut-style.json` (three styles + `default`, decisions 1–2)
and a pure `src/shared/studio/cut-style-resolve.ts` (`resolveCutStyle` + display name, decision 3)
with unit tests for every precedence rung and for `pacing` mapping, widen `CutPlanStyleName` to
include `relaxed`, and add the optional `cut` field to `StudioPresetStyle` and `cutStyle` to the
project settings type — then hand off before touching the consumers.

## Open problems

(none yet)

## Do-not-redo

- B1 (DSP, waveform v3, the four knobs, the cutlib comparison) is DONE — do not re-port or
  re-measure it. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY (Python on it
  `-I -B`).

## Agents so far (date · approx tool calls · what they covered)

(none yet)
