# Driving the app for UI verification (Chrome DevTools Protocol)

How to launch the dev app and click through it programmatically, so a change can
be verified in the real app instead of only in unit tests. No Playwright or
Puppeteer — Node ≥ 22 has global `fetch` and `WebSocket`, which is all CDP needs.

Everything here was learned by doing it during Studio phases S1–S3
(2026-08-07/08). The two rules under [Visibility](#the-visibility-rule-read-this-first)
and [Delete flows](#safety-delete-flows-differ-per-feature) are the ones that
bite; the rest is convenience.

## Launch

```powershell
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npx electron-vite dev -- --remote-debugging-port=9222
```

`ELECTRON_RUN_AS_NODE` is inherited from the Claude Code process itself and makes
Electron boot as a bare Node runtime with no window. Clearing it first is not
optional. Run the dev server in the background, then poll
`http://127.0.0.1:9222/json/list` until a target of `type: "page"` appears —
the window is not ready the moment the process starts.

Note the app takes a single-instance lock. An installed copy of VidTSX Studio
running in the background will make the dev instance exit immediately; close it
first.

Two more launch/driving lessons (2026-08-20, Slice 2 A/B run):

- **Add `--disable-features=CalculateNativeWinOcclusion`** (plus
  `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding`)
  to the dev launch when screenshots matter. Windows occlusion tracking marks
  a fully-covered window `visibilityState: "hidden"`, the compositor stops
  producing frames, and `Page.captureScreenshot` hangs forever — while
  `Runtime.evaluate` and `Input.dispatchMouseEvent` keep working, which makes
  it look like a driver bug. `Page.bringToFront` does not reliably fix it
  when another window keeps re-covering the app.
- **Never let a CDP failure strand a pressed mouse button.** If the driver
  dies between `mousePressed` and `mouseReleased` (e.g. a screenshot timeout
  in the same session), the page keeps the button down and every later
  `mouseMoved` becomes a drag — this silently moved a timeline clip by 40
  seconds before it was caught. Wrap press/release in try/catch and send a
  best-effort `mouseReleased` on any error. Also measure coordinates and
  click in the SAME driver session — panel scroll positions shift between
  connects, and a stale rect clicks the wrong thing. A control found by text
  can also sit BELOW its panel's fold (`offsetParent` non-null, but
  `elementFromPoint` returns whatever paints there) — `scrollIntoView` it,
  then re-measure, then click.

## Minimal driver

```js
// drive.mjs — node drive.mjs   (Node >= 22)
const PORT = 9222;

async function findPage(match = 'VidTSX') {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page' && (t.title ?? '').includes(match));
      if (page) return page;
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('No page target — is the dev app running with --remote-debugging-port?');
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

const cdp = connect((await findPage()).webSocketDebuggerUrl);
await cdp.ready;

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}

// Screenshot for visual checks:
// await cdp.send('Page.enable');
// const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
// await (await import('fs/promises')).writeFile('shot.png', Buffer.from(data, 'base64'));
```

## The visibility rule (read this first)

**Every DOM query must be filtered to visible elements.**

```js
const visible = (sel, root = document) =>
  [...root.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
```

`src/renderer/App.tsx` keeps every *visited* screen mounted and hides the
inactive ones with `display: none` (see the `visitedScreens` map — the wrapper is
`display: isActive ? 'contents' : 'none'`). So `document.querySelector` happily
matches controls on screens the user cannot see. In practice
`button[title="Delete project"]` matched ~169 hidden Creator library rows before
the visible Studio card, and one text-scoped click landed on a hidden
delete-confirm modal in another feature entirely. Nothing was lost that time,
but only because the click did not complete.

Elements under a `display: none` ancestor report `offsetParent === null`, and the
active screen's `display: contents` wrapper generates no box of its own, so the
filter above is both correct and sufficient.

One exception (hit in the Slice C run): `position: fixed` elements ALSO report
`offsetParent === null`, so the filter hides them even when perfectly visible —
the timeline's `FloatingMenu` (context menus) is fixed. Query those raw
(`document.querySelector('[role="menu"]')`).

## Matching elements by text

Two failure modes, both hit for real:

**Pick the deepest match, not the first.** `textContent` includes descendants, so
a naive `.find()` over all elements returns the app's root container — its text
contains everything. Sort candidates by `textContent.length` ascending and take
the first:

```js
const byText = (text, sel = 'button') =>
  visible(sel)
    .filter((el) => el.textContent.trim() === text)
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
```

**Scope to the section you mean.** Sidebar nav items share labels with in-screen
buttons — there is a "Transcribe" in the sidebar *and* in the Studio inspector.
Find the panel first, then query inside it, with an exact trimmed-text match.

## Getting past native dialogs

OS file pickers cannot be driven through CDP. For folder-as-truth features, seed
the state on disk instead and open it in the UI: write a `project.json` (with
hand-built asset entries carrying real ffprobe values) straight into the Studio
projects root — `~/Videos/VidTSX Studio/projects/<slug>/`. That exercised the
whole timeline, preview, proxy and export path in S2 without ever opening the
import dialog.

Three dialogs have dedicated stand-ins. `VIDTSX_PACKAGE_SAVE=<absolute path>`
replaces the `.vidtsx` export save dialog and `VIDTSX_PACKAGE_PICK=<absolute
path>` replaces the import open dialog, so the whole export → import round trip
(strategy tiles with real sizes, the asset table, the import report cards) can be
clicked through for real. An explicit path in the IPC request still wins over
either env var.

The third: the media-relink "Locate…" picker. Launch
the dev app with `VIDTSX_RELINK_PICK=<absolute path>` and the relink handler
uses that path instead of opening the dialog, so the whole renderer flow
(mismatch confirm card, document merge, cache survival) runs for real. Unset
in normal use — an explicit `filePath` in the request still wins over the env
var (that's the mismatch-confirm retry).

## Synthetic drags and performance measurement

React 19 picks up synthetic pointer events through the root container:
`pointerdown` on the target element, then `pointermove` / `pointerup` dispatched
on `window`, each with `{ bubbles: true, clientX, clientY, pointerId: 1 }`.

For perf work, dispatch one `pointermove` per `requestAnimationFrame` and record
the rAF deltas — that measures what the user actually feels, rather than how fast
a loop can fire events. Numbers swing ±10 ms run to run on a dev machine with the
bundler running, so take several samples and report a range, not a single figure.
This is how the S2 100-cut scrub checkpoint in `STATUS.md` was measured.

## Playback needs a visible window; scroll containers nest

Two more, learned during the Slice A click-through (2026-08-12):

**Playback is frozen while the window is occluded.** Chromium throttles rAF in
a covered/backgrounded window, so the Remotion Player's clock, the playhead,
and anything frame-driven simply stop — while React state updates (clicks,
paste, undo) keep working, which makes the freeze easy to misread as a feature
bug. Send `Page.bringToFront` before any test that plays.

**…and a MINIMIZED window is worse (2026-08-13 sweep).** Minimized means
`document.visibilityState === 'hidden'` and rAF stops entirely —
`Page.bringToFront` raises but does NOT restore a minimized window, so every
rAF-fed readout (toolbar clock, playhead) freezes while pointer/keyboard
tests keep passing. Restore it at the OS level first (user32
`ShowWindow(hwnd, SW_RESTORE)` + `SetForegroundWindow` via PowerShell), then
`Page.bringToFront`. Sanity-check with a
`requestAnimationFrame`-vs-timeout race before trusting any clock assertion.

**Remotion pools shared `<audio>` tags.** The Player pre-creates a handful of
`<audio>` elements and reassigns them; counting audio tags or reading their
`volume` proves nothing. Assert audibility with `paused === false` during
playback (e.g. mute-track semantics: audible-tag count 1 → 0 → 1 across
mute/unmute).

**Pick the INNERMOST scroll container.** The timeline lanes' scroll div is not
the first visible `.overflow-auto` that contains clips — an outer wrapper (84
px wider, never horizontally scrollable) matches earlier in document order and
reads `scrollLeft: 0` forever, silently invalidating every scroll assertion
and write. Filter to candidates that contain no other candidate:

```js
const cands = visible('.overflow-auto').filter((el) => el.querySelector('.cursor-grab'));
const scrollEl = cands.find((el) => !cands.some((o) => o !== el && el.contains(o)));
```

## Safety: delete flows differ per feature

Studio project delete goes through `shell.trashItem` with an `fs.rm` fallback
(`src/main/services/studio/project-store.ts`) — recoverable from the Recycle Bin.
Other features call `fs.rm` directly, which is permanent. Never drive a delete
through a text-matched button without visibility scoping, and prefer seeding
throwaway state on disk over deleting anything real.
