# @vidtsx/kit — component manifest

Import everything from `'@vidtsx/kit'`. All components are frame-based
(no springs, no timeouts). Every visual component takes an optional
`theme?: Partial<KitTheme>` — pass your brand palette/fonts as tokens:
`{ accent, ok, warn, danger, ink, muted, paper, line, fontDisplay, fontBody, fontMono }`.

## EASINGS
`EASINGS.easeOut | easeIn | easeInOut | overshoot` — the house easing family.
Usage: `interpolate(frame, [a, b], [0, 1], { ...CLAMP, easing: EASINGS.easeOut })`.
`CLAMP` is exported too — spread it into every interpolate options object.

## TypedText
`<TypedText text start perChar?=1.3 caret?=true caretColor? doneAt? style? theme? />`
Character-by-character write-on with a blinking block caret; negative `start`
renders fully typed. `typeDuration(text, perChar?)` returns the frames the
type-on takes — schedule the next beat at `start + typeDuration(text)`.
Usage: a prompt or address bar being typed before an action fires.

## GenericWindow
`<GenericWindow title x?=120 y?=150 w?=1680 h?=820 appearAt? variant?='dark'|'light' theme?>{children}</GenericWindow>`
macOS-style shell (traffic lights + title) with fade/rise entrance; children
position absolutely inside the content region (below `WINDOW_TITLE_H` px).
Usage: any "some app" window that isn't the browser/VS Code/terminal.

## TerminalWindow
`<TerminalWindow title lines x? y? w? h? appearAt? rows?=19 size?=22 lineH?=38 cursorUntil? theme? />`
`lines: TermLine[]` where `TermLine = [atFrame, text, 'dim'|'text'|'ok'|'err'|'accent'?]`.
Lines appear on their own frame; the view auto-tails the last `rows`.
`cursorUntil` blinks a caret at the tail (a "still running" stall).
Usage: command runs, build output, logs — cue lines to the narration.

## StatBlock
`<StatBlock items x?=60 y?=12 gap?=14 size?=26 theme? />`
`items: { at, label, color? }[]` — a flex row of stat pills, each fading/rising
in on its cue with a gentle overshoot. In-flow (never hand-placed x/y per pill).
Usage: metrics, counts, "3 files · 0 errors · 12s" payoff rows.

## VSCodeWindow
`<VSCodeWindow rows groups projectName? gitBadge? sidebarW? theme?>{overlays}</VSCodeWindow>`
Full VS Code dark chrome on a 1920×1080 canvas. `rows: ExplorerRow[]` =
`{ name, kind:'folder'|'file', depth?, open?, icon?, mark?, dot?, appearAt?, highlightAt? }`
(rows fade in / highlight on frame cues — a folder "expanding", a new file
"appearing"). `groups: EditorGroup[]` = `{ x, w, tab:{label, icon?, appearAt?}, breadcrumb?, children? }`
for split views; pane content positions absolutely below `GROUP_TOP`.
`VSCODE_LAYOUT` (TITLE_H/ACT_W/SB_X/SB_W/ED_X/ED_W) and `VSCODE_COLORS` are
exported for placing custom pane content. Animate `sidebarW` to collapse the
explorer. Usage: "here's the editor" beats — files appearing, split reveals.

## CodeEditorPane
`<CodeEditorPane x w lines typeStart?=10 cps?=30 fontSize?=26 appearAt? theme? />`
`lines: CodeLine[]` where `CodeLine = [text, color][]` (pre-tokenized segments).
Line numbers + character write-on across all lines + blinking caret.
Usage: code being written inside a VSCodeWindow group.

## ImageViewerPane
`<ImageViewerPane x w src openAt? imgW?=560 imgH? caption? theme? />`
VS Code image preview (checker backdrop, zoom badge) for a generated-file
payoff inside a group. `src` = any asset URL.

## AgentFeed
`<AgentFeed lines x w top rows?=12 size?=20 lineH?=40 spinner? theme? />`
`lines: FeedLine[]` = `[atFrame, 'tool'|'sub'|'ok'|'err', text]` — streaming
agent activity in CLI grammar: accent ⏺ tool lines, dim ⎿ results; view tails.
`spinner: { label, from, until? }` pins a pulsing ✳ working line.
Usage: an AI agent running — pair with AgentInputDock in a VSCodeWindow group.

## AgentInputDock
`<AgentInputDock x w typed? sent? placeholder? modeLabel? bottom?=28 theme? />`
The agent composer: pass `typed` as a node (e.g. `<TypedText …/>`) while
typing, then flip `sent` — placeholder swaps to "Queue another message…" and
the send arrow becomes a stop square.

## KitIcon
`<KitIcon name size?=18 color? strokeWidth?=1.8 fill? />` — small internal
stroke-icon set (arrows, folder, search, check, …) for custom chrome details.
