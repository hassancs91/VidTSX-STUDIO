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

## KitIcon
`<KitIcon name size?=18 color? strokeWidth?=1.8 fill? />` — small internal
stroke-icon set (arrows, folder, search, check, …) for custom chrome details.
