# B2 — The default cut style file; `resolveCutStyle`; all four consumers; picker → preset read-out + project override; Project settings knobs; preset editor Cut section
status: IN PROGRESS — step 1 (data + pure resolver) DONE `bc104c3`; step 2 (main-process consumers) DONE `4f0b33b`; step 3 (resolve IPC + Transcript deletes, snapper style required) DONE `b86b279`; step 4 (Auto Cut button on live settings + picker → read-out/override) DONE `c50968f`; step 5 (Project settings knobs + preset editor Cut section + validator) DONE `bf46298`; step 6 (CDP click-through + docs) next

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

**Step 4 — Auto Cut button on the live settings; picker → read-out + project override (2026-10-22, builder #4, `c50968f`).**

- IPC: `StudioCutPlanRunRequest.settings?: StudioCutStyleSettings` (`src/shared/ipc/types/studio.ts:384`,
  ignored when `style` is set); `handleStudioCutPlanRun` forwards it (`studio-handlers.ts:467`).
- `useAutoCut.ts`: NO style any more — `runAutoCut(asset)`; option `cutStyleSettings:
  StudioCutStyleSettings | null` (:33) sent as `settings` (:60); `PendingRun.style` gone.
  `EditorShell.tsx:360-376` memoises `{presetId?, cutStyle?}` from the live `project.settings`
  (deps: has-project, presetId, the cutStyle object) and passes it; `:1454` passes the ONE
  `cutStyle` (from `useResolvedCutStyle`, now `:882`) to `InspectorPanel`.
- NEW pure `src/features/studio/services/cut-style-override.ts` (37): `CutStyleOverrideChoice =
  'preset' | CutPlanStyleName`; `cutStyleOverrideChoice(settings.cutStyle)` (normalised `base` ??
  `'preset'`); `withCutStyleOverride(settings, choice)` sets/clears `base`, KEEPS hand-written knobs,
  drops garbage, removes `cutStyle` entirely when nothing is left (the project then reads exactly
  like a pre-B2 one).
- `InspectorPanel.tsx:47` prop `cutStyle: ResolvedCutStyleState`; `:233-236` passes the override
  choice and writes it with `onUpdate(prev => ({...prev, settings: withCutStyleOverride(...)}))`
  (= `updateProject`: saved, NOT undoable — the preset-picker pattern, DECIDED); also passes
  `presetName`.
- NEW `src/features/studio/components/AutoCutRunner.tsx` (109; moved out of `TranscriptSection`,
  now 259 lines, no `useState`/`CutPlanStyleName`): "Style" read-out
  `[data-cut-style-readout]` = `resolved.displayName` (title = every knob), "Resolving…" while
  loading, `unavailable` + red error line on a failed resolve; override Select inside
  `[data-cut-style-override]`: `Preset’s style (<name>)` / `Default style` (no preset) · `Tight|
  Natural|Relaxed for this project`; the Auto Cut button; help line adds "The style also sets where
  Transcript deletes and the editorial pass snap."
- Tests: NEW `src/features/studio/services/cut-style-override.test.ts` (9: read none/base/knobs-only/
  bare name/garbage; pin, replace, back-to-preset removes `cutStyle`, knobs kept on change/clear,
  garbage dropped); NEW `src/main/ipc/studio-cut-plan-run-handler.test.ts` (4: live settings
  forwarded + resolved style handed to `runCutPlan`, no settings → `{}`, explicit style → `callStyle`,
  typed error and no plan run).

**Step 5 — Project settings knob read-out; preset editor Cut section; validator (2026-10-22, builder #5, `bf46298`).**

- NEW pure `src/shared/studio/cut-style-labels.ts` (35): `CUT_KNOB_INFO` (label/unit/step/hint per
  knob — e.g. head = "Lead-in" s, margin = "Decay margin" dB, fricZcr = "Fricative ZCR" /s),
  `formatCutKnob` (`0.15 s`, `12 dB`, `3500 /s`, `off`).
- NEW pure `src/shared/studio/preset-cut.ts` (102): `presetCutBase(style, file)` (= resolver rung 3:
  `cut.base` ?? mapped pacing ?? file default); `withPresetCutBase(style, base|undefined, file)` (sets/
  clears base; drops knobs EQUAL to the new base and opt-ins it LACKS; an empty cut is removed);
  `withPresetCutKnob(style, knob, value|undefined, file)` (stores a knob only when it differs from the
  base; undefined/equal removes; never sets an opt-in the base lacks); `cutSpecProblems(spec, base?)`
  (bad base, non-object, every out-of-bounds knob via `CUT_PLAN_KNOB_BOUNDS`, minTail > maxTail,
  maxHead < head — with `base`, knobs the spec leaves to the base count too; a bare style name is fine).
- `src/shared/studio/preset.ts:197` `validatePresetInput` → `cutSpecProblems(style.cut)` (spec-level;
  main's preset-store runs it on save too).
- IPC `studio:cut-style:file` (main stays the ONLY reader of cut-style.json): channel
  `STUDIO_CUTSTYLE_FILE` (`channels.ts:470`), `StudioCutStyleFileResponse {success, file?:
  CutStyleFile, error?}` (`ipc/types/studio.ts:415`), `handleStudioCutStyleFile` (`cut-style-handlers.ts:32`
  → `loadCutStyleFile()`), registered `registrations/studio.ts:130`, preload `studioCutStyleFile`
  (`preload/api/studio.ts:202`) + `electron.d.ts:508`.
- NEW hook `src/features/asset-library/hooks/useCutStyleFile.ts` (40): asks once per mount →
  `{file, error}`.
- NEW `src/features/asset-library/components/PresetCutFields.tsx` (154) `[data-preset-cut]`: summary
  `[data-preset-cut-summary]` (`tight + 1 override`); base select `[data-preset-cut-base]` (`From pacing
  (<mapped>)` / `Default (tight)` when no pacing = unset; Tight/Natural/Relaxed); one input per knob the
  base has `[data-preset-cut-knob="<knob>"]` (local text, placeholder = base value, empty = back to the
  base, overridden labels in accent); an opt-in the base lacks → `[data-preset-cut-off="<knob>"]`
  "off (base natural)" (a hand-written one in preset.json shows read-only "4000 /s (preset.json)");
  live problems in amber `[data-preset-cut-problems]`.
- `PresetForm.tsx` (now 307 lines): `useCutStyleFile()` (:62); `setStyle` re-prunes the cut on a
  PACING change (:64-69, `withPresetCutBase(style, style.cut?.base, file)`); submit adds
  `cutSpecProblems(next.style.cut, <base style>)` and de-dupes messages (:76-79); renders
  `<PresetCutFields>` after the style grid (:250).
- NEW `src/features/studio/components/ProjectCutStyleFields.tsx` (61) `[data-project-cut-style]`:
  `[data-project-cut-style-name]` = `resolved.displayName`; every knob `[data-project-cut-knob="<knob>"]`
  in `CUT_PLAN_KNOBS` order (`formatCutKnob`; absent opt-ins "off"; `resolved.overrides` in accent);
  "Resolving…" / red error otherwise. `ProjectSettingsDialog.tsx:72-75` new section "Cut style"
  (prop `cutStyle`), `EditorShell.tsx:1611` passes the SAME `cutStyle` (no second resolve hook).
- Tests: NEW `src/shared/studio/preset-cut.test.ts` (11, against the SHIPPED cut-style.json: base
  rungs; knob stored only when ≠ base, equal/undefined removes and the cut goes, base kept when the
  last knob goes, opt-in not settable on natural; what it writes is what `resolveCutStyle` reads
  (`tight + 1 override · preset “Shorts”`); base change drops equal knobs + lacking opt-ins; back to
  pacing removes the cut; pacing re-prune; `cutSpecProblems` ok/bad/bounds/ranges with and without
  base; `formatCutKnob`); `preset.test.ts` +1 (validator: sane cut passes, margin 600 + inverted tail
  → exactly two messages); `cut-style-handlers.test.ts` +2 (file handed over; typed error).

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

Step 4 (2026-10-22, `Get-Process electron` count 0; machine CPU at 100 % from other sessions —
`vmmemWSL`, WmiPrvSE):

- `npx vitest run src/features/studio/services/cut-style-override.test.ts src/main/ipc/studio-cut-plan-run-handler.test.ts src/main/ipc/cut-style-handlers.test.ts src/main/services/studio/cut-style-store.test.ts src/shared/studio/cut-style-resolve.test.ts src/features/studio/services/text-delete.test.ts`
  → `Test Files 6 passed (6) · Tests 61 passed (61)`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`; and `npx tsc -p tsconfig.web.check.json
  --noEmit | grep -i "AutoCut\|cut-style\|InspectorPanel\|TranscriptSection\|EditorShell\|cut-plan-run"`
  → no lines (none of the 26 is in a touched file).
- `npx vitest run` (full) ×3 (`.vidtsx-temp/end-to-end/B2/vitest-step4.log`, `-step4b`, `-step4c`)
  → each `1 failed | 3763 passed`, ONLY `flow-render.test.ts:255` "Retry with note edits the
  rejected composition; Stop run…" (`vi.waitFor` 1 s gave up on a pause-request event; flows code,
  untouched by B2; the file alone → 5/5 passed; B1 hit the same one under load). With fewer
  workers: `npx vitest run --maxWorkers=4` (`-step4d.log`) → `Test Files 446 passed | 5 skipped
  (451) · Tests 3764 passed | 34 skipped (3798)` (91.1 s). Green.

Step 5 (2026-10-22, `tasklist` electron.exe → none running):

- `npx vitest run src/shared/studio/preset-cut.test.ts src/shared/studio/preset.test.ts` →
  `Test Files 2 passed (2) · Tests 23 passed (23)`; `npx vitest run src/main/ipc/cut-style-handlers.test.ts`
  → `Tests 5 passed (5)`.
- `npx vitest run src/shared/studio/preset-cut.test.ts src/shared/studio/preset.test.ts src/main/ipc/cut-style-handlers.test.ts src/shared/studio/cut-style-spec.test.ts src/shared/studio/cut-style-resolve.test.ts src/main/services/studio/cut-style-store.test.ts src/main/services/library`
  → `Test Files 17 passed (17) · Tests 180 passed (180)`.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`; `(npx tsc -p tsconfig.web.check.json
  --noEmit; npx tsc -p tsconfig.node.check.json --noEmit) | grep -i "preset-cut\|PresetCut\|PresetForm\|cut-style\|ProjectCutStyle\|ProjectSettingsDialog\|useCutStyleFile\|EditorShell\|preset.ts\|preset.test"`
  → no lines.
- `npx vitest run` (full, default workers, FIRST try; log `.vidtsx-temp/end-to-end/B2/vitest-step5.log`)
  → `Test Files 447 passed | 5 skipped (452) · Tests 3778 passed | 34 skipped (3812)` (35.8 s). Green.
- NOT yet seen live: the Cut section and the Project settings block have only been type-checked and
  unit-tested through their pure ops — step 6 drives them.

## Next step (ONE concrete instruction)

Step 6 — the CDP click-through, then the docs. Drive on profile
`C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B2\profile` (copy of `…\profiles\source\profile`,
CDP 9281, DRIVING.md launcher), on a COPY of M2 in your own C: root or with M2's `project.json`
backed up and restored (`cmp` identical). Show, with stills + disk reads: (1) Assets › Presets ›
edit a preset → the Cut section (`[data-preset-cut]`): pick base Natural, change Lead-in to 0.25,
Save → `preset.json` on disk has `style.cut = {base:"natural", head:0.25}`; an untouched preset
saved again gains NO `cut` key; a bad value (Decay margin 600) shows the error and does not save;
(2) in Studio on that preset: Project settings `[data-project-cut-style-name]` reads
`natural + 1 override · preset “<name>”` with Lead-in 0.25 s in accent and the four opt-ins "off";
the Inspector read-out `[data-cut-style-readout]` says the same; Auto Cut on one clip → the
proposal card headline `Auto Cut (natural + 1 override · preset “<name>”)` (THE EXIT); (3) the
override Select → Tight for this project → read-out + Project settings say `tight · project
override` and a second Auto Cut card says so; (4) a Transcript delete and the editorial snap use
the same knobs (e.g. capture the resolved `key`/`style` the delete path receives, or compare the
delete's cut edges with `snapCutSpans` on the same style in a node script); (5) the OWED survival
check (Open problems): override set → frame size change → undo → redo → a timeline edit → read
`project.json`: `settings.cutStyle` still `{base:"tight"}`. Restore the preset you edited (or use a
copied preset) and M2. Then the docs: STATUS row (top, dated, house format, measured numbers;
say decisions 1 and 4 and the "no off" follow-up), TESTING §18.8 B2 (after §18.7, §17 shape),
decision 6's B1 text (211 ms = warm cache + ~5 s cold first open) — commit, return DONE.

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
- (RESOLVED in step 5, `bf46298`) `validatePresetInput` checks `style.cut` (`preset.ts:197` →
  `cutSpecProblems`).
- **Disk, D: = 1.84 GB at step 5 hand-off (2026-10-22 ~13:25), under the ~2 GB line.** Not from
  B2's writes: step 5 wrote source files (KBs) and `.vidtsx-temp/end-to-end/B2` is 44 KB in total;
  D: was 2.15 GB at step 4's hand-off and other Claude sessions write to D:. Step 6 must keep D:
  writes near zero (profile, M2 copy, stills, scripts all on C:) and re-check before launching; if D:
  keeps falling the orchestrator decides.
- (small) `PresetForm.tsx` is 307 lines after step 5 (was 289; the Cut section itself is its own
  file). If a later part touches it, move the style grid into its own component.
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
  **Step 4 status:** the override is written through `updateProject` (InspectorPanel.tsx:236).
  Code read: the timeline→project write (`useTimeline.ts:715`) is
  `settings: { ...prev.settings, width, height }` inside `updateProject((prev) => …)`, so `prev`
  is the latest document and `cutStyle` is carried — but the DECIDED check is still OWED: do it
  LIVE in step 6 (set the override in the UI → change frame size → undo → redo → a timeline edit →
  read `project.json` from disk: `settings.cutStyle` still `{base: …}`).
- (RESOLVED in step 4) The Auto Cut button no longer sends `style`; it sends the live
  `presetId`/`cutStyle` (`StudioCutPlanRunRequest.settings`), so its card names the resolved style
  (`tight · default`, `natural · preset “…”`, `relaxed · project override`). The agent tools still
  read disk, like `get_preset` does.
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
  green. Do not add a second resolve hook: reuse `cutStyle` from `EditorShell.tsx:882`.
- Step 4: the plan-run IPC `settings` field, `useAutoCut` on live settings (no style),
  `cut-style-override.ts` (+ test), `AutoCutRunner.tsx` (read-out + override Select), the
  InspectorPanel/TranscriptSection threading and `studio-cut-plan-run-handler.test.ts` — written and
  green. Do not reintroduce a session style or a `style` arg on `runAutoCut`.
- Step 5 (`bf46298`): `cut-style-labels.ts`, `preset-cut.ts` (+ test), the validator hook-up, the
  `studio:cut-style:file` IPC (+ test), `useCutStyleFile`, `PresetCutFields`, `ProjectCutStyleFields`
  and their threading — written and green. Do not add a second resolve hook or let the renderer
  read cut-style.json.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~33 calls · step 1: cut-style.json, types, pure spec/resolver +
  tests, gates (`bc104c3`).
- 2026-10-22 · builder #2 · ~55 calls · step 2: main loader + `resolveProjectCutStyle`, planner/
  runner/IPC/`run_auto_cut`/editorial/headline on the resolver, constants deleted, keyed plan file,
  tests, gates, rms-envelope test title.
- 2026-10-22 · builder #3 · ~40 calls · step 3: resolve IPC + hook, Transcript deletes on the
  resolved style, `PRE_B2_NATURAL` deleted, tests, gates (`b86b279`).
- 2026-10-22 · builder #4 · ~42 calls · step 4: plan-run IPC on live settings, Auto Cut without a
  session style, `AutoCutRunner` read-out + project override, pure override helper, tests, gates.
- 2026-10-22 · builder #5 · ~30 calls · step 5: Project settings knob read-out, preset editor Cut
  section + `studio:cut-style:file` IPC, pure preset-cut ops + labels, validator, tests, gates
  (`bf46298`).
