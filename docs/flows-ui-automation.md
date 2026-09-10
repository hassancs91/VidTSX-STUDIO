# Driving the Flows screens from a script (W8, 2026-09-10)

> The general recipe — launching a dev instance with CDP, the visibility rule,
> the dialog trap — is `docs/ui-automation-cdp.md`. This file is what the
> six W8 stages learned about Flows in particular, and the driver commands
> they left in `.vidtsx-temp/w8/` (not committed; the recipe here is enough
> to rebuild them).

## The second instance

```
bash .vidtsx-temp/w8/launch-w8.sh          # own outDir + entry, profile .vidtsx-temp/w3-profile, CDP 9223, inspector 9229
node .vidtsx-temp/w8/w8-apppath.mjs        # ALWAYS right after a launch (below)
```

- Under `--entry`, `app.getAppPath()` is the out dir, so `resources/` — the
  built-in flows, agents, skills — resolves nowhere. `w8-apppath.mjs` calls
  `app.setAppPath(<repo>)` over the 9229 inspector. Run it after EVERY
  relaunch; the flow catalog re-syncs on the next Flows visit, and its rows
  are kept (not pruned) while the built-in root is unreadable.
- `VITE_FF_TOOLS=1` in the launch environment shows the Tools hub (still
  env-gated); Flows itself needs no flag since Stage 6.
- Kill: `taskkill //PID <pid of the :9223 listener> //T //F`.

## Reaching the screens

- Navigate by CLICKING the sidebar entry (`aside button` whose text is
  `Flows`, `Tools`, `Assets`, `Videos`). The `vidtsx:navigate` event works for
  the app's own hand-offs, but from a driver it left Home up twice.
- Every visited screen stays mounted. The Flows screen keeps whatever
  workspace it had open: after a hand-off or a "Save to Library" hop, come
  back and click the `Flows` back button before looking for cards.
- The list re-reads on `refresh()` only — a row created over IPC shows after
  opening any card and going back.

## Markers the screens publish (query these, never CSS classes)

| screen | marker |
|---|---|
| Flows list | `[data-flow-group=mine\|builtin\|installed]`, `[data-flow-card=<id>]`, `[data-flow-menu]`, `[data-flow-menu-item=run\|edit\|details\|duplicate\|export\|remove]`, `[data-flow-import]` |
| Details | `[data-flow-details]`, `[data-flow-trust=builtin\|verified\|signed-unknown\|unsigned]` |
| Workspace | `[data-flow-workspace=run\|edit]`, `[data-flow-view=run\|edit]` |
| Run form | `[data-run-form][data-run-form-status]`, `[data-param-field=<paramId>]`, `[data-mode-switch]`, `[data-brand-select]`, `[data-priced-steps]`, `[data-run-start]`, `[data-run-resume]`, `[data-run-error]` |
| Outputs | `[data-run-outputs]`, `[data-step][data-step-status]`, `[data-pause-card=pick\|approve\|form]`, `[data-interaction-option]`, `[data-pause-note]`, `[data-pause-reject]` |
| Canvas | `.react-flow__node`, `.react-flow__edge`, `[data-node-inspector]`, `[data-config-field][data-expose-toggle]`, `[data-pause-toggle]`, `[data-needs-chip]`, `[data-palette-node]`, `[data-flow-proposal-source]` |
| Tools hub | `[data-tools-flows-group]`, `[data-tools-flow=<id>]` |
| Hand-offs | `[data-run-flow-open]` (the context-menu row), `[data-run-flow-target=<id>]`, `[data-run-flow-empty]`, `[data-video-run-flow]` |

Image and video params render the chosen file as TEXT (`Change… <basename>`),
not an `<input>` — read `[data-param-field=x]`'s `innerText`.

## Starting and watching runs

- Start over the same IPC the form uses: `window.api.flowsRunStart({ flowId,
  mode, params, brandId })`. Built-in ids are `vidtsx/<name>`; user rows are
  ulids; names collide (a seeded template row and a built-in can both be
  "Thumbnail") so resolve by id.
- Watch a run on DISK, not through CDP: `<userData>/flows-runs/<flowId>/<runId>/run.json`
  (Stage 6 moved it out of `<assets>/flows/`). Reading it every few seconds is
  fine — the writer retries its rename — but do not hold a CDP driver open for
  ten minutes, and never run two drivers at once.
- Opening a card hydrates its latest run: the pick / approve card of an
  attended run started over IPC appears on the form once the card is open.
- The kill test: kill when `nodes.<render>.status === 'running'` (the notes
  can stay empty while bundling); after relaunch `flowsRunGet` reports the
  typed "app closed" error with `resumable: true`; `flowsRunResume` reruns
  only the unfinished node.
- Import / export without the OS dialogs: `flowsImport({ path })`,
  `flowsExport({ flowId, targetPath })`; `VIDTSX_FLOW_PICK` / `VIDTSX_FLOW_SAVE`
  in MAIN's environment stand in for the dialogs.

## Screenshots

`Page.captureScreenshot` hangs on the Flows canvas and the run form more
often than not. Capture through MAIN instead: over the 9229 inspector,
`BrowserWindow.getAllWindows()[0]` → `show()`, `focus()`, wait 400 ms, then
`webContents.capturePage()`; without the show/focus the frame is stale.

## Dialogs

`window.confirm` (Remove) blocks `Runtime.evaluate`. Answer it with
`Page.handleJavaScriptDialog` WITHOUT `Page.enable` (`w8-dialog.mjs`); never
send OS keystrokes. A syntax error inside an `eval` leaves the driver hung on
the next command — kill drivers by command line before reconnecting.

## Patches from a driver

The Bash tool's heredoc is not literal for backslashes or `${}`: every patch
and every test title with an apostrophe goes through a `.py` file run by
path, or the editor tools. `Input.insertText` after `focus()` is what React
registers for typed text; `setNative` + an `input` event for selects.
