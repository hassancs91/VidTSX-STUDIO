# B2 — The default cut style file; `resolveCutStyle`; all four consumers; picker → preset read-out + project override; Project settings knobs; preset editor Cut section
status: IN PROGRESS — step 1 (data + pure resolver) DONE `bc104c3`; step 2 (main-process consumers) DONE `4f0b33b`; step 3 (resolve IPC + Transcript deletes, snapper style required) DONE `b86b279`; step 4 (Auto Cut button + picker → read-out/override) next

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

**Step 1 — data + pure resolver, `bc104c3` (2026-10-22, builder #1).** No consumer uses it yet.

- `resources/skills/studio-clean-cut/cut-style.json` (41 lines): `version 1`, a `notes` string,
  `"default": "tight"`, `styles.tight` = Hasan's fitted tight (all 12 knobs, camelCase),
  `styles.natural` = fitted natural (8 knobs, no opt-ins), `styles.relaxed` = decision 1 values.
  Ships: `electron-builder.yml:67-70` copies `resources/skills` → `skills` with filter `**/*`.
- `src/shared/types/studio-cut-plan.ts:9` `CutPlanStyleName` += `'relaxed'`; `:12`
  `CUT_PLAN_STYLE_NAMES`; `:57-102` `CutPlanKnob`, `CutStyleSpec` (`Partial<CutPlanStyle> &
  {base?}` — the ONE shape of both a preset's `style.cut` and a project's `settings.cutStyle`),
  `CutStyleFile`, `CutStyleSource` (`call|project|preset|pacing|default`), `ResolvedCutStyle`
  (`styleName, style, source, overrides[], presetName?, displayName, key`).
- `src/shared/types/studio-preset.ts:33` `StudioPresetStyle.cut?: CutStyleSpec`; `:157`
  `StudioPresetKnobKey = Exclude<keyof StudioPresetStyle, 'cut'>` (learning nested cut knobs is
  B4 — kept out so the learn card's `from/to: string|number|string[]` stays honest).
- `src/shared/types/studio.ts:384` `StudioProjectSettings.cutStyle?: CutStyleSpec`. The project
  loader spreads `settings` as-is (`project-store.ts:53`), so it round-trips with no normaliser;
  the resolver normalises it on read.
- `src/shared/studio/cut-style-spec.ts` (123): `CUT_PLAN_KNOBS` (display order, :16),
  `CUT_PLAN_REQUIRED_KNOBS` (:32), `CUT_PLAN_KNOB_BOUNDS` (:39, generous typo guards; softGap to
  1000), `isCutPlanStyleName`, `cleanKnob`, `normalizeCutStyleSpec` (:70 — garbage → undefined so a
  bad spec = an absent one; a bare style name string → `{base}`), `parseCutStyleFile` (:113 —
  strict, THROWS `cut-style.json: …` naming the problem; also minTail ≤ maxTail, maxHead ≥ head).
- `src/shared/studio/cut-style-resolve.ts` (143): `resolveCutStyle(file, {callStyle?, project?,
  preset?})` (:130). Rungs: call (the named style as-is, nothing layered) > project (`base` →
  `file.styles[base]` + project knobs, preset ignored; knobs only → over the preset's pick, keeps
  `presetName`) > preset `cut` (base ?? mapped pacing ?? file default, its knobs over it) > pacing
  mapped (tight/normal/relaxed → tight/natural/relaxed) > `file.default`. `overrides` = knobs whose
  final value ≠ the base style's. `displayName`: `tight · default`, `natural · preset “Shorts”`,
  `natural + 1 override · preset “Shorts”`, `relaxed · project override`, `natural · requested`.
  `cutStyleKey(style)` (:120) = FNV-1a 8 hex over every knob in fixed order (decision 5's key).
  `pacingToCutBase` (:51, own-property check — `'toString'` maps to nothing).
- `src/shared/studio/preset.ts:20, 142-143` `normalizePresetStyle` keeps a valid `cut` (old
  presets gain no `cut` key; a garbage `cut` drops).
- `src/shared/studio/cut-planner.ts:57-63` INTERIM: `CUT_PLAN_STYLES.relaxed = NATURAL_STYLE` only
  to keep the widened `Record<CutPlanStyleName,…>` compiling; nothing passes `'relaxed'` yet.
  These constants (`TIGHT_STYLE`, `NATURAL_STYLE`, `CUT_PLAN_STYLES`) go in step 2.
- Tests: `src/shared/studio/cut-style-spec.test.ts` (shipped file = decisions 1–2 exactly, incl.
  relaxed = natural×1.5 rounded; every parse error; normaliser; preset normaliser and `cut`) and
  `src/shared/studio/cut-style-resolve.test.ts` (every rung, pacing map ×3, preset knobs w/o base
  on pacing and on default, project base vs knobs-only, call beats all, garbage at every rung,
  cache key equal/unequal, resolved style is a copy).

**Step 2 — main-process consumers on the resolver, old constants gone, `4f0b33b` (2026-10-22, builder #2).**

- `src/main/services/studio/cut-style-store.ts` (112): `cutStyleFilePath()` (:43, =
  `getSkillsDir()/studio-clean-cut/cut-style.json`), `loadCutStyleFile()` (:65, parsed once per
  run; a failed read/parse is NOT cached, next call retries; errors name the path / "not valid
  JSON"), `resetCutStyleCache()` (tests), `resolveProjectCutStyle(projectId, {callStyle?,
  settings?})` (:103): callStyle → resolved without any I/O; else `settings` (the live document's
  `presetId`/`cutStyle`, OPTIONAL — no caller passes it yet) ?? `loadProject(id).settings`
  (unreadable project → warn, resolves as no project); preset via `readPreset(getLibraryRoot(),
  presetId)` (stale/unreadable → null).
- `src/shared/studio/cut-planner.ts`: `TIGHT_STYLE`/`NATURAL_STYLE`/`CUT_PLAN_STYLES` DELETED
  (comment at :38); `PlanCutsRequest` (:203-210) takes `style: CutPlanStyle` (resolved knobs,
  compensation still applied inside) + optional `styleDisplayName`/`styleKey`, which `planCuts`
  copies onto the plan only when given.
- `src/shared/types/studio-cut-plan.ts:137-139` `StudioCutPlan.styleDisplayName?`/`styleKey?`
  (optional — pre-B2 plans have neither).
- `src/main/services/studio/cut-plan-runner.ts:67` `runCutPlan(projectId, assetId, sourcePath,
  cut: ResolvedCutStyle)`; plan file `:99` = `${assetId}-${styleName}-${key}.json` (decision 5).
  Nothing ever READS a plan file back (the IPC returns the plan; packaging copies the folder), so
  old `<asset>-tight.json` files are simply left in place — tested.
- IPC `src/main/ipc/studio-handlers.ts:465` `handleStudioCutPlanRun`: `resolveProjectCutStyle`
  with `callStyle = data.style` when given. `StudioCutPlanRunRequest.style` stays optional
  (`src/shared/ipc/types/studio.ts:377`, doc comment). NOTE: the renderer's Auto Cut button STILL
  passes the session picker's style, so today the button resolves as `tight · requested` /
  `natural · requested` — step 3 stops passing it.
- `run_auto_cut` (`agent-tools/workflow-tools.ts:135-149`): enum `tight|natural|relaxed`,
  optional; omitted = the project's resolved style; explicit wins (decision 2). Reply names the
  style (`style ${cut.displayName}`).
- Editorial snap (`agent-tools/cut-tools.ts:56-73`): resolves the project style and passes
  `style: cut.style`; a resolve failure returns an error text (logged). Pause compression stays off
  in the snapper (`cut-snap.ts:181-182`, internalGap ∞).
- `src/shared/studio/cut-snap.ts:44-63`: `SnapCutSpansInput.style?: CutPlanStyle` replaces
  `styleName`. **B2 INTERIM:** optional only because Transcript deletes (`text-delete.ts:148-154`,
  renderer) still omit it → they fall back to the private `PRE_B2_NATURAL` (:55, the old natural,
  so text deletes behave exactly as before). Step 3 makes `style` required and deletes the fallback.
- Card headline `src/shared/studio/cut-proposal.ts:104`: `Auto Cut (${plan.styleDisplayName ??
  plan.styleName})`.
- Tests: `src/shared/studio/cut-style-test-fixtures.ts` (`TEST_TIGHT_STYLE`/`TEST_NATURAL_STYLE` =
  the pre-B2 values, test-only, so the mechanics tests keep their hand-checked numbers);
  `cut-planner.test.ts` (fixtures + "stores the resolver name and key"), `cut-planner-knobs.test.ts`
  (:129 block now: shipped tight == FITTED_TIGHT; shipped natural/relaxed set none of the four),
  `editorial-cuts.test.ts` (all 8 calls pass `TEST_NATURAL_STYLE`; new "snaps with the style it is
  given, pause compression still off"), `cut-proposal.test.ts` (headline uses displayName), NEW
  `src/main/services/studio/cut-style-store.test.ts` (9: shipped file, parse-once, missing/broken
  file retried, default, preset pacing by id, stale id, override beats preset, live settings beat
  disk, call style w/o project, unreadable project) and NEW
  `src/main/services/studio/cut-plan-runner.test.ts` (3: resolved knobs + name/key on plan + file
  name, edited knob → new file, pre-B2 file untouched).
- Decision 6, part: test title renamed `src/shared/studio/rms-envelope.test.ts:99` → "a v2 cache
  (no zcr) snaps with the new windowing and the fricative rule off". (The B1 STATUS row + TESTING
  §18.7 "211 ms" wording is still to do — final docs step.)

**Step 3 — resolve IPC + Transcript deletes on the resolved style, snapper `style` required, `b86b279` (2026-10-22, builder #3).**

- IPC `studio:cut-style:resolve`: channel `STUDIO_CUTSTYLE_RESOLVE` (`src/shared/ipc/channels.ts:469`);
  types `StudioCutStyleSettings` (= `Pick<StudioProjectSettings,'presetId'|'cutStyle'>`),
  `StudioCutStyleResolveRequest {projectId, settings?}`, `StudioCutStyleResolveResponse {success,
  resolved?: ResolvedCutStyle, error?}` (`src/shared/ipc/types/studio.ts:390-408`); handler in a
  NEW file `src/main/ipc/cut-style-handlers.ts` (`handleStudioCutStyleResolve`, try/catch → typed
  error; kept out of the 657-line `studio-handlers.ts`), registered `registrations/studio.ts:49,129`;
  preload `studioCutStyleResolve` (`src/preload/api/studio.ts:199`) + the renderer's hand-kept
  `ElectronAPI` declaration `src/renderer/types/electron.d.ts:507` (NB: the renderer's
  `window.api` type is THIS file, not `typeof api` — a new preload call needs both).
- NEW hook `src/features/studio/hooks/useResolvedCutStyle.ts` (71): `useResolvedCutStyle(projectId,
  settings)` → `{ resolved: ResolvedCutStyle|null, error: string|null }`; re-asks when
  `presetId` or the JSON of `cutStyle` changes and on `vidtsx:screen-active` → `studio` (a preset
  edited on the Assets screen); answers are tagged with their project (another project's style
  never shows) and a sequence ref drops late answers. Called ONCE in `EditorShell.tsx:870`
  (`const cutStyle = useResolvedCutStyle(projectId, project?.settings ?? null)`) — step 4 reuses
  this same `cutStyle` for the read-out / Auto Cut / Project settings.
- `useTextEdit.ts`: new option `cutStyle: ResolvedCutStyleState`; `deleteTokens` (:89-99) toasts
  and returns false when `resolved` is null ("still loading" info, or the error) and otherwise passes
  `style: cutStyle.resolved.style`. `EditorShell.tsx:883` passes it.
- `text-delete.ts:34-38` `PlanTextDeleteInput.style: CutPlanStyle` (REQUIRED), forwarded to
  `snapCutSpans` at :159.
- `cut-snap.ts:44-48` `SnapCutSpansInput.style` REQUIRED; `PRE_B2_NATURAL` and the B2 INTERIM
  comments DELETED (`grep -rn "PRE_B2_NATURAL\|B2 INTERIM" src` → nothing).
- Tests: `text-delete.test.ts` / `text-restore.test.ts` pass `TEST_NATURAL_STYLE` (4 calls, numbers
  unchanged); NEW `text-delete.test.ts:44` "snaps with the style it is given" (tight vs natural on
  the same 'um': tight's cut ends > 50 ms later, never starts later); NEW
  `src/main/ipc/cut-style-handlers.test.ts` (3: live settings forwarded, no settings → `{}`, error
  typed not thrown).

## Verified (exact commands + outputs)

Step 1 (2026-10-22, no electron running — `Get-Process electron` count 0):

- `npx vitest run src/shared/studio/cut-style-spec.test.ts src/shared/studio/cut-style-resolve.test.ts src/shared/studio/preset.test.ts src/shared/studio/cut-planner.test.ts src/shared/studio/cut-planner-knobs.test.ts`
  → `Test Files 5 passed (5) · Tests 78 passed (78)`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- `npx vitest run` (full, log `.vidtsx-temp/end-to-end/B2/vitest-step1.log`) →
  `Test Files 441 passed | 5 skipped (446) · Tests 3730 passed | 34 skipped (3764)` (51.5 s).

Step 2 (2026-10-22, `Get-Process electron` count 0):

- `npx vitest run src/main/services/studio/cut-style-store.test.ts src/main/services/studio/cut-plan-runner.test.ts src/main/services/studio/editorial-cuts.test.ts src/shared/studio/cut-planner.test.ts src/shared/studio/cut-planner-knobs.test.ts src/features/studio/services/cut-proposal.test.ts src/shared/studio/cut-style-spec.test.ts src/shared/studio/cut-style-resolve.test.ts src/features/studio/services/text-delete.test.ts src/features/studio/services/text-restore.test.ts`
  → `Test Files 10 passed (10) · Tests 126 passed (126)`.
- `npx vitest run src/shared/studio/rms-envelope.test.ts` → `Test Files 1 passed · Tests 13 passed`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- `npx vitest run` (full, log `.vidtsx-temp/end-to-end/B2/vitest-step2.log`) →
  `Test Files 443 passed | 5 skipped (448) · Tests 3747 passed | 34 skipped (3781)` (44.0 s).
- `grep -rln "TIGHT_STYLE\|NATURAL_STYLE\|CUT_PLAN_STYLES" src scripts` → only test files and
  `cut-style-test-fixtures.ts` (the `TEST_*` names).

Step 3 (2026-10-22, `Get-Process electron` count 0):

- `npx vitest run src/main/ipc/cut-style-handlers.test.ts src/features/studio/services/text-delete.test.ts src/features/studio/services/text-restore.test.ts src/main/services/studio/editorial-cuts.test.ts src/main/services/studio/cut-style-store.test.ts src/shared/studio/cut-style-resolve.test.ts src/main/services/studio/cut-plan-runner.test.ts`
  → `Test Files 7 passed (7) · Tests 70 passed (70)`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok` (first try was 27/26: the missing
  `electron.d.ts` declaration, fixed).
- `npx vitest run` (full): runs 1–2 (`.vidtsx-temp/end-to-end/B2/vitest-step3.log`, `-step3b.log`)
  → `1 failed | 3750 passed`, both times ONLY `shot-module-resolver.test.ts` "a changed transpiler
  fingerprint misses every tier" (`[ShotModuleCache] Shot module cache write failed` → its
  `waitForFile` ~1 s poll gave up; code B2 never touches; the file alone → 10/10 passed). Run 3
  (`-step3c.log`) → `Test Files 444 passed | 5 skipped (449) · Tests 3751 passed | 34 skipped
  (3785)` (37.9 s). The known load flake family (DRIVING.md "Repo facts").

## Next step (ONE concrete instruction)

Step 4 — the Auto Cut button on the resolved style and the `TranscriptSection` picker → read-out
+ project override: (a) add `settings?: StudioCutStyleSettings` to `StudioCutPlanRunRequest`
(`src/shared/ipc/types/studio.ts:~372`) and pass it through in `handleStudioCutPlanRun`
(`studio-handlers.ts:465`, `resolveProjectCutStyle(id, { callStyle?, settings })`); (b) re-grep
`useAutoCut.ts` / `InspectorPanel.tsx` / `TranscriptSection.tsx` for the session style (`styleName`,
`'tight'`), stop sending `style` from the button and send the live `project.settings`
`presetId`/`cutStyle` instead; (c) replace the session picker with a read-out of
`cutStyle.resolved.displayName` (the `cutStyle` from `EditorShell.tsx:870`, thread it down) plus a
small override control (Preset / tight / natural / relaxed) that writes `settings.cutStyle =
{ base }` or deletes it, using the SAME `updateProject` settings-edit pattern as the preset picker
(`EditorShell.tsx:279-289`, saved, not undoable — see Open problems); a unit test for any pure
helper; gates green; hand off. AFTER that (step 5+): Project settings shows the resolved knobs,
the preset editor Cut section (+ `validatePresetInput` checks `style.cut`), then the CDP
click-through on M2 (Auto Cut card headline names the preset's style; a Transcript delete and the
editorial snap use the same knobs) and the docs (STATUS row, TESTING §18.8, decision 6 B1 text).

## Open problems

- (design note, not blocking) `CutStyleSpec` is `Partial<CutPlanStyle>`: a spec can change a knob
  but cannot switch an opt-in knob OFF (e.g. "tight but no fricative rule"). Today the way to get
  no opt-ins is base `natural`/`relaxed`. If the preset editor's Cut section needs "off", add it
  then (e.g. `null` in the spec meaning remove) — decide in that step.
  **DECIDED (orchestrator, 2026-10-22):** no "off" in B2. The Cut section edits the base and the
  knob VALUES the base has; an opt-in knob absent from the base is shown as "off (base
  <name>)" and is not editable; turning the opt-ins off = choosing base natural/relaxed. Keep
  `CutStyleSpec` as is (no `null`). B4's learning widens only `head`/`minTail`/`maxTail`/`margin`,
  so nothing needs "off" before Hasan asks for it — note it in STATUS as a follow-up.
- `validatePresetInput` (`preset.ts:~185`) does not check `style.cut` yet: add it with the preset
  editor Cut section (the normaliser already drops bad values on save/load).
- Decision 6 (B1 doc debt) HALF done: the test title is renamed (step 2). Still to do: B1 STATUS
  row + TESTING §18.7 "211 ms" → warm-cache + the verifier's ~5 s cold first open. Do it in the
  final docs step at the latest.
- (RESOLVED in step 3, `b86b279`) the `PRE_B2_NATURAL` fallback is gone; the snapper's `style` is
  required.
- (design note for step 4 — not blocking) The earlier Next step said the override goes "through the
  reducer (undoable, saved)". The timeline reducer's state holds no settings (`present` =
  timeline/proposals/shots/captions/removedAssets/frame); the preset and brand pickers write
  settings with a NON-undoable `updateProject` (`EditorShell.tsx:279-289`, "same non-undoable
  settings edit as the brand"). Following that pattern (saved, not undoable) is the cheap,
  consistent choice; making settings undoable would widen the reducer. Builder #4: follow the
  preset-picker pattern unless the orchestrator says otherwise, and say so in STATUS.
  **DECIDED (orchestrator, 2026-10-22):** follow the preset-picker pattern (saved, not undoable).
  Guard against A1's trap: the frame-size undo writes `settings` from the timeline side
  (`useTimeline.ts` ~:676-721, `settings: { ...prev.settings, width, height }`) — add a test or a
  live check that a `cutStyle` set through `updateProject` SURVIVES a later frame-size edit and its
  undo/redo, and a timeline edit + autosave (read `project.json` from disk).
- (step 2, interim) The Auto Cut button still sends the session picker's style, so its card reads
  `tight · requested` until the picker becomes the read-out (step 4). The exit ("the card headline
  names the preset's style") is only met once the button stops sending `style`.
- (design note for step 4) Live vs disk settings: `resolveProjectCutStyle` reads project.json when
  no `settings` are passed. The renderer should pass the live document's `presetId`/`cutStyle`
  (the request field is ready in the store; add it to `StudioCutPlanRunRequest` then) so an unsaved
  override is honoured. The agent tools read disk, like `get_preset` does.
- STATUS must say (decision 4): editorial and Transcript deletes moved from the old natural
  (head 0.19 / minTail 0.26 / maxTail 0.45 / margin 5) to the resolved style — Hasan's fitted tight
  by default (head 0.15 with snap-to-onset up to 0.3, minTail 0.08, maxTail 0.7, margin 12, fricative
  rule, min-skip 0.12) — so authored joins land tighter unless the preset/project says natural.

## Do-not-redo

- B1 (DSP, waveform v3, the four knobs, the cutlib comparison) is DONE — do not re-port or
  re-measure it. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY (Python on it
  `-I -B`).
- Step 1 (`bc104c3`): `cut-style.json`, the types, `cut-style-spec.ts`, `cut-style-resolve.ts`
  and their tests are written and green — extend them, do not rewrite them. The fitted values in
  the file were copied from `cuts.json` → `styles` (re-read 2026-10-22) and are pinned by
  `cut-style-spec.test.ts`; no need to re-read `cuts.json`.
- Step 2: `cut-style-store.ts` (+ test), `cut-plan-runner.test.ts`, the planner/runner/IPC/
  `run_auto_cut`/editorial/headline wiring and the repointed tests are written and green — the old
  constants are gone; do not bring them back (tests use `cut-style-test-fixtures.ts`).
- Step 3 (`b86b279`): the resolve IPC + `cut-style-handlers.ts` (+ test), `useResolvedCutStyle`,
  `useTextEdit`/`planTextDelete` on the resolved style, required snapper `style` — written and
  green. Do not add a second resolve hook: reuse `cutStyle` from `EditorShell.tsx:870`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~33 calls · step 1: cut-style.json, types, pure spec/resolver +
  tests, gates (`bc104c3`).
- 2026-10-22 · builder #2 · ~55 calls · step 2: main loader + `resolveProjectCutStyle`, planner/
  runner/IPC/`run_auto_cut`/editorial/headline on the resolver, constants deleted, keyed plan file,
  tests, gates, rms-envelope test title.
- 2026-10-22 · builder #3 · ~40 calls · step 3: resolve IPC + hook, Transcript deletes on the
  resolved style, `PRE_B2_NATURAL` deleted, tests, gates (`b86b279`).
