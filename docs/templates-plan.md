# Templates — ready-made compositions you fill in

> Status: **P0–P3 built 2026-09-17; batch 2 built the same day — ten built-ins**
> across Milestones, Social, Product, Openers and Overlays, plus overlay support
> (backdrops, transparent render defaults), a slider for bounded numbers and
> `scripts/template-verify.mjs`. **2026-10-02 (go-live 3a): the `audio` control
> and the `.vidtsxtemplate` importer are built** (§7, log). The rest of P4 (packs,
> list controls, save-as-project) is planned in §7. Decisions in §1 were taken with Hasan on
> 2026-09-17. Batch 2's work order, per-template specs, survey of all 90 addons
> templates and build log: `docs/templates-batch-2.md`.

TSX Creator has three modes: **Prompt** (one generation), **Agent** (TSX
Composer) and **Templates**. A template is a finished TSX composition with a
**form** instead of a prompt: pick one, change its text, numbers, colours and
images in the left column, render. No provider, no model, no tokens.

Templates are also an **extension kind**, like agents and flows: built-ins ship
in the app, more arrive as files a user installs, and they are meant to be sold
in packs. The importer is P4; everything here is shaped so it is an addition,
not a rewrite.

## 1. Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | The form lives in the **left column**. Templates mode turns it into the gallery; opening a template swaps it for that template's form, with a back arrow. The Edit strip under the video is gone in this mode. | Full height and scrollable. A form under the video takes every row from the video's height, and the 45 templates with inline `DATA` will need list/table editors (§7) that cannot fit there. |
| 2 | Picking a template is a **live preview; values autosave per template**. Nothing is copied into the Creator library. "Save as project" is P4. | Browsing must not fill the library. The values survive a restart, so a channel name and avatar are typed once. |
| 3 | **Built-ins ship in the app** (`resources/templates`). One today, more to come. | Templates mode is never empty on first launch — agents and flows each ship five. Note a built-in's source is in this repo's history, so it is public when the repo is. |
| 4 | The form is **declared in a manifest, never parsed out of the TSX**. | NEXT_FEATURES_DESIGN Q8 already decided it: "manifests are data, code is code". The Creator's `props-parser.ts` guesses; a product form needs labels, groups, ranges, help text, image pickers and a format→canvas map, none of which a type annotation can carry. |
| 5 | Metadata lives **per template** (`template.json` in its folder), not in a pack's `pack.json`. This departs from the letter of Q8a. | "Import one template" is a requirement, and a lone template must describe itself. A pack is then a list of self-describing folders, each kind keeping its own manifest and validator — the precedent is a flow shipping inside an agent package. |
| 6 | The Creator's existing **props panel stays preview-only**. | It says so in its footer, deliberately. Only the template render path passes `inputProps` to the render. |

## 2. The manifest — `template.json`

Types: `src/shared/types/templates.ts`. Validator:
`src/shared/templates/manifest.ts` (`parseTemplateManifest`, pure — zod plus the
shared id grammar and entry-path gate, so it serves the scan, a future packer's
`--check`, the importer and the tests). It reports **every** problem at once.

```jsonc
{
  "formatVersion": 1,
  "id": "vidtsx/youtube-subs",        // <namespace>/<name>, the agents' grammar; also the folder
  "name": "YouTube Subs",
  "version": "1.0.0",
  "description": "…",
  "author": { "name": "VidTSX", "url": "https://vidtsx.com" },
  "license": "…",
  "minAppVersion": "1.1.0",           // the scan skips a template that needs a newer app
  "category": "milestones",           // slug; the gallery's filter pills
  "tags": ["youtube", "counter"],
  "entry": "composition.tsx",
  "thumbnail": "thumb.jpg",           // optional, 16:9
  "overlay": false,                   // optional: transparent, sits over footage
  "formats": { "prop": "format", "default": "landscape", "options": [
    { "value": "portrait", "label": "9:16", "width": 1080, "height": 1920 } ] },
  "controls": [ /* TemplateControl[] */ ],
  "presets":  [ { "id": "ocean", "name": "Ocean", "values": { "accent": "#2D8CFF" } } ],
  "files": []                         // written by the packer, verified by the importer (P4)
}
```

**Controls** are Q8c's `ParamSpec` — `key`, `label`, `type`, `default`, `min`,
`max`, `step`, `options` — plus what a whole composition needs beyond an
effect's knobs: the types `text`, `textarea`, `image` and `audio`, and `group`,
`help`, `placeholder`, `maxLength`. `key` is the prop name the composition destructures.
A default must agree with its type; a `select` default must be an option; a
`color` must be `#hex`; an `image` or `audio` default is `''` (the composition
draws its own stand-in, or stays silent) or a safe path inside the template.

**`formats` is not a control.** Choosing one changes the prop the composition
reads *and* the canvas size, and those two must change together (§4). Its `prop`
may not also be a control key.

**Presets are complete looks.** A preset overlays its keys and keeps the rest,
so a preset that pins a background image should be matched by the others
clearing it — otherwise "Ocean" leaves crimson artwork under a blue accent. The
form highlights the preset whose keys all match, preferring the one that pins
the most.

Limits (`TEMPLATE_LIMITS`): 40 controls, 12 presets, 6 formats, 24 select
options, 12 tags, 7680 px canvas.

## 3. Where templates live

```
resources/templates/<namespace>/<name>/     built-in, read-only (extraResources → templates/)
{userData}/templates/<namespace>/<name>/    installed by the user (P4)
{userData}/template-work/<namespace>/<name>/  the working copy + autosave (§4)

  template.json   composition.tsx   thumb.jpg   assets/…
```

`src/main/services/templates/template-store.ts` is `flow-store.ts`'s scan:
folder-as-truth, two levels, a folder that does not parse (or whose name does
not match its id, or whose entry is missing) is skipped with a warning so one
bad template cannot hide the rest. Same id in both roots → the higher version;
equal prefers the built-in.

## 4. The working copy

A template never previews or renders from its install folder. Main **stages** it
(`template-stage.ts`, pure half in `shared/templates/stage-source.ts`) into
`template-work/<ns>/<name>/`:

```
<name>-<format>.tsx   the entry, rewritten (below) — one per format
assets/               a mirror of the template's artwork
values.json           { templateVersion, format, values } — only what differs from the defaults
```

**Preview and render load the same staged file**, so what is previewed is
byte-for-byte what renders. Three facts force this design; each was checked in
the code, and two of them overturned an earlier assumption:

1. **A built-in cannot render in place.** `composition-wrapper.ts` writes its
   `_vidtsx_root_*.tsx` beside the entry, and `resources/` is read-only in an
   installed app.
2. **A job's `width`/`height` do not size the render.** `render-handlers.ts`
   takes the dimensions of the bundle's `<Composition>`, which the wrapper
   builds from the file's own `compositionConfig`; the job's values are only a
   fallback. So a format is applied by **rewriting that literal**
   (`applyCanvasToConfig`). The template contract already requires the literal
   to be plain ("the app parses it textually"), which is what makes this safe;
   the regex is the parser's own, and a test reads every rewrite back through
   `parseCompositionConfig`.
3. **An image prop breaks `staticFile`.** The preview's virtual `staticFile`
   accepts any path; the real one at render refuses an absolute path, and
   `remotion-static-files.ts` only rewrites string *literals* — a form hands the
   composition a path as a **prop**. Both the preview page and the render bundle
   are served by a local server with an `/asset?path=` route, so
   `rewriteStaticFiles` swaps every bare `staticFile(` for an appended helper
   that builds `window.location.origin + '/asset?path=…'`. One helper, correct in
   both; relative paths resolve against the working copy, absolute ones (a file
   the user picked) pass through. It is appended as a hoisted function
   declaration, so every original line keeps its number.

This leaves the general gap — a relative `staticFile()` in an ordinary Creator
project — open (addons plan §5.1). It is a separate change with a wider blast
radius and is not needed here.

The format **prop** follows what is *staged*, not what was just clicked
(`useTemplateSession`), so the layout and the canvas flip in the same frame
instead of flashing a portrait layout on a landscape canvas.

Saved values are re-validated on load (`resolveValues`): after a template
update, a removed control, a retyped one, or a number now out of range falls
back to the default instead of reaching the composition.

## 5. IPC and the Creator UI

| Channel | Does |
|---------|------|
| `templates:list` | scan both roots; adds a module-server `thumbnailUrl` |
| `templates:stage` | `{ id, format? }` → the staged `entryPath`, `workDir`, `assetBaseUrl` |
| `templates:state:load` / `:save` | the autosaved `values.json` |

Renderer, all in `src/features/motion/`:

- `hooks/useTemplates` (the list, loaded the first time the mode opens) and
  `hooks/useTemplateSession` (open template, values, format, staging, a 400 ms
  debounced autosave flushed on close and unmount, stale replies dropped by a
  token). The session lives in `MotionScreen`, so an open template survives a
  trip to Prompt or Agent and back.
- `components/templates/` — `TemplatesPanel` (gallery ⇄ form),
  `TemplateGallery`, `TemplateCard`, `TemplateForm`, `TemplatePreviewPanel`
  (Preview | Rendered, and Render with the form's values as `inputProps`).
- `shared/components/ParamField` renders one declared control. It is shared on
  purpose: it is Q8c's "one generic component renders any pack's knobs", ready
  for transitions and effects. It never touches IPC — the image picker is a
  callback.
- Opening a **project** from anywhere (library, a finished job, an agent's
  hand-off) leaves Templates mode, or the project would open out of sight.
- The Rendered tab was extracted from `MotionPreviewPanel` into
  `useRenderedOutputs` + `RenderedOutputView` so both panels share it.

Automation hooks: `data-motion-mode`, `data-template-gallery`,
`data-template-id`, `data-template-form`, `data-preset`, `data-param`,
`data-template-preview`.

## 6. Authoring a template

The addons contract (`vidtsx-addons/templates/AUTHORING.md`) is unchanged for
`composition.tsx`. A template that wants a form adds:

1. `template.json` (§2). Every control `key` must be a prop the default export
   destructures; give it the same default the TSX has.
2. `thumb.jpg`, 640×360, from the final hold frame.
3. Image props stay `<Img src={staticFile(path)} />` with `''` meaning "draw the
   stand-in". Staging makes both relative and absolute values work.

`manifest.test.ts` and `template-stage.test.ts` run against **every folder under
`resources/templates`**: the manifest parses and matches its folder, the entry
and thumbnail exist, every bundled image a default or preset names really
ships — and nothing under `assets/` ships that none names — every control key
appears in the source, and the template stages and transpiles in every format
it declares.

Adding a built-in (batch-2 doc §7 has the long form):

1. Copy `composition.tsx` and only the assets a default or preset names.
2. Write `template.json`; defaults come from the default export's destructuring.
3. `node scripts/template-verify.mjs --id <ns/name> --thumb --frame N` writes
   `thumb.jpg` (640×360) from the real render path — overlays over the `soft`
   backdrop.
4. `npx vitest run src/shared/templates src/main/services/templates`.
5. `node scripts/template-verify.mjs --id <ns/name>`: every format, the defaults
   and every preset, through wrapper → bundler → `/asset` → `renderStill`; it
   fails on a wrong canvas or an image that is not fetched with 200. Look at the
   stills it leaves in `.vidtsx-temp/template-verify/out/`.

An **overlay** (`"overlay": true`) must paint no full-frame fill. In the app its
preview gets a Backdrop picker — stand-in footage painted behind the Player by
the preview page, never by the composition (`shared/templates/backdrops.ts`) —
and its Render dialog opens on WebM with transparency on.

## 7. What comes next (P4)

- **Importer — BUILT 2026-10-02.** `.vidtsxtemplate` = one template folder
  zipped, as planned: `shared/templates/template-package.ts` (pure: the manifest
  rules plus a `files[]` that must cover the entry, the thumbnail and every file a
  default or preset names; caps 300 entries / 64 MB per entry / 128 MB total),
  `main/services/templates/template-package.ts` (the generic `zip-reader.ts`,
  `signature.json` via `agent-signing.ts`, the D14 gate on the entry =
  `validateAgentCompositionCode`), `template-install.ts` (rename-swap install
  into `{userData}/templates` with `.bak`, an older version asks first, remove of
  a user copy), IPCs `templates:import` / `:remove` / `:package:pending`, an
  "Import…" button in the gallery, an "Installed" chip and a Remove action on
  user cards, `'template'` in `PendingPackageKind` + `fileAssociations` (a
  double-click opens the Creator in Templates mode and imports), and
  `scripts/template-pack.mjs <folder> --check | --out <file> [--key]`, which
  bundles the same package rules. The scan does not re-verify signatures (no
  trust tag in the gallery yet); the install refuses a signature that fails.
- **Packs.** `.vidtsxpack` = `pack.json` + `templates/…`, `agents/…`, `flows/…`,
  `transitions/…`. The importer dispatches each item to its kind's installer;
  no kind's manifest moves into `pack.json` (decision 5). Worth doing first:
  promote `pending-open.ts`'s kind union into a real registry
  (`{ kind, ext, manifestName, parse, roots }`) so kind #5 is one entry.
- **An `audio` control — BUILT 2026-10-02.** `type: "audio"`: `''` = silent, a
  path inside the template, or a file the user picked (`VIDTSX_DIALOG_PICK`
  stands in for the picker). The field (`shared/components/ParamFileField.tsx`,
  shared with `image`) shows a play / stop button, the file name, Choose /
  Replace / Remove. Pair it with a `number` control for `volume`. The addons
  `AUTHORING.md` still needs a `template.json` section that mentions it.
- **List and table controls.** Most templates with real content keep it in an
  inline `const DATA` / `STEPS` / `SCENES` (8 of the 28 audio-free ones, and most
  of the 62). They need a `list`/`table` control type and a template contract
  that takes the data as a prop defaulting to `DATA`. `ParamValue` widens to
  JSON; `controlValueProblem` grows a schema per column.
- **Smaller control gaps the survey found:** an *optional* colour (`''` = "let
  the theme decide" — 10 templates; `color` requires `#hex` today); a **length**
  field that rewrites `durationInFrames` on stage the way `formats` rewrites the
  canvas (corner bugs, chapter bars, countdowns — batch-2 doc §5 C3); a **video
  file** control (1 template). Two templates import three.js and are out of
  scope until a 3D template is verified end to end.
- **Save as project.** Copy the working copy into the Creator library as `v1.tsx`
  with the values baked into the defaults, so AI Edit can take it from there.
- **A "get more templates" link** in the gallery, once there is a page to send
  people to.
- **`VIDTSX_TEMPLATE_IMAGE_PICK`**, a stand-in for the image dialog, so the
  picker can be driven over CDP like the other dialogs.

## 8. Log

**2026-09-17 — P0–P3.** Built and verified without the GUI, because Hasan's own
dev app was running (no debug port) and holds the single-instance lock; a second
dev instance would have rewritten `out/main/chunks` under it.

- Unit: 38 tests (`src/shared/templates`, `src/main/services/templates`). Full
  suite 299 files / 2586 tests green; type gate at baseline (web 26, node 10),
  no error in a touched file.
- **Render path, for real**: `.vidtsx-temp/templates-verify/run.mjs` runs scan →
  stage → the app's `generateWrapper` → `@remotion/bundler` (caching off) → a
  server with the bundler's `/asset` route → `getCompositions` → `renderStill`.
  Portrait: the bundle reported 1080×1920; non-default text, number and accent
  arrived; a **relative** avatar and an **absolute** background both fetched
  with 200 and are visible in the frame.
- **Preview path**: every built-in, staged in every format, goes through the
  app's `transpileTsx` in `template-stage.test.ts`.
- **Not yet verified: the UI itself.** No click-through has been done — mode
  toggle, gallery, form, autosave round trip, format switch, the Render button.
  Needs a dev-app restart (new IPC channels) and a CDP pass.

Two assumptions were wrong on the way and are recorded so they are not made
again: that the props panel not reaching the render was a bug (it is documented
preview-only behaviour), and that a job's `width`/`height` size the render (§4
fact 2).

**2026-09-17 — batch 2: ten built-ins.** Full log, deviations and open items in
`docs/templates-batch-2.md` §9. In short: batch 1 committed (`560ea19`) and its
UI click-through done over CDP with nothing to fix, autosave checked across a
real restart; nine templates added (three of them overlays); C2 overlay support
(`RenderSettingsModal` `initial`, the preview page's `setBackdrop`,
`IsolatedPreview` `backdrop`, a Backdrop picker); C1 slider (bounded, ≤ 1000
stops); H1 asset hygiene; T1 `scripts/template-verify.mjs`. Verified: the
script for all ten × three formats × every look, a 73-check CDP pass over all
ten, Archivo loaded in the app preview, and a transparent WebM render from the
UI whose alpha was measured and composited over a photo. Not done: checking
that WebM over footage in a Studio project.

**2026-10-02 — go-live 3a: the `audio` control and the importer.** Built as §7
now describes. Verified live on an isolated dev instance with a package made by
`template-pack.mjs` from the addons `modern-countdown-timer` (two `audio`
controls defaulting to its bundled `tick.mp3` / `done.mp3`, a volume slider, a
"Silent" look): gallery Import… → toasts (imported, unsigned) → the form opens
with the Sound group; play starts and ends on its own (both sounds served
`audio/mpeg` by `/asset` and decode); Replace takes a picked file, Remove reads
"None (silent)", the Silent look and Reset behave. **A real render** with the
picked file as the tick and the bundled `done.mp3`: the MP4 has an AAC stream,
the tick sounds every second (-29 dBFS) and the done sound decays after zero.
Remove from the gallery; a double-click (a second instance on the same
profile) from Home → Creator → Templates → installed and opened, saved values
kept; an older package asks and installs only on Yes; a package whose entry
imports `lodash` is refused by the D14 gate with a toast naming the import.
**Bug the live check caught:** the downgrade retry sat after a `return` inside
`try`, so Yes did nothing; fixed. Tests: `template-package.test.ts` (5),
`template-install.test.ts` (8, real zips), audio cases in `manifest.test.ts`,
the `template` kind in `pending-open.test.ts`.
