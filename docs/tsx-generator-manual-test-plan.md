# TSX Generator — Manual Test Plan

> Covers everything shipped in the stabilization + parallel-jobs effort
> (commits `41d6268` … `ad7b060`, 2026-07-23). Run with `npm run dev`.
> Sections are ordered so earlier steps set up later ones.
>
> Evidence projects left in the library for testing: `props-panel-smoke`
> (has all six prop control types) and `rotating-green-square`.

## 1. Props panel

- [ ] In the Creator library, open **`props-panel-smoke`**.
- [ ] On the **Preview** tab, a **Props** sidebar appears on the right with:
      `circleColor`, `bgColor`, `size`, `label`, `showLabel`, `direction`.
- [ ] Each control updates the playing preview within ~1s, no reload flicker:
  - [ ] `bgColor` — pick a color with the swatch, then type `rgb(200,0,0)`
        in the text field (arbitrary CSS strings work).
  - [ ] `size` — type `500` (circle grows); try `-50` and clearing the field
        (no crash; invalid input just doesn't commit).
  - [ ] `showLabel` — toggle off/on ("Hello Props" disappears/reappears).
  - [ ] `direction` — select `right` (movement flips).
- [ ] A purple dot marks modified props. **Reset** returns all defaults and
      clears the dots.
- [ ] Code tab: change a default (e.g. `label = 'Changed'`), wait ~1s for
      auto-save → Preview panel + preview reflect it.
- [ ] Code tab: delete the whole `Props` interface + destructured params →
      the Props sidebar disappears entirely. (Undo after.)
- [ ] Open **`bouncing-ball`** (no props) → no sidebar, preview full width.
- [ ] Prop edits are preview-only: render a modified preview → the output
      file uses the file's defaults, not the overrides.

## 2. Custom provider UI

- [ ] AI → **Providers** tab → **+ Add custom provider**.
- [ ] Clicking **Add** with empty fields shows inline validation errors
      (name required, URL must be http(s), model required).
- [ ] Add a real endpoint (Groq/DeepSeek-style key, or a local
      ollama/vLLM server with protocol *OpenAI-compatible* and no key) →
      card appears with a **Custom** badge.
- [ ] **Test Connection** → OK + latency for a real endpoint; readable
      error otherwise.
- [ ] **Save**, restart the app → provider still there, still enabled.
- [ ] Creator input panel provider dropdown lists it; run a small
      generation with it if the endpoint is real.
- [ ] **✕** on the card → **Save** → gone; restart to confirm it stays gone.

## 3. Parallel jobs + placeholders + slot control

- [ ] Fire **3–4 generations back-to-back** with different prompts
      (optionally different per-job providers).
- [ ] While running:
  - [ ] Jobs strip shows all with step labels + %, newest left,
        counter reads e.g. `3/4`.
  - [ ] Library shows a dashed placeholder row per running generation
        (prompt snippet + step + %); queued ones say "Queued".
  - [ ] Live token streaming in the center panel when no project is open.
- [ ] Per completion: placeholder disappears, real project row appears,
      one toast with **Open**. The open project is never hijacked by a
      completing job.
- [ ] **Slot dropdown**: set `N/4` → **1**, queue 3 generations → one runs
      at a time. Set back to 4 mid-queue → queued jobs start immediately.
- [ ] Restart the app → slot setting persists.
- [ ] **Cancel**: cancel a job mid-"Generating" from its strip chip →
      Cancelled, no project folder created, other jobs unaffected.
- [ ] **Quit mid-run**: 1 running + 2 queued (slot=1), quit, relaunch →
      queued jobs re-queue and run; the killed one does not resume.
      Task Manager after quit: no orphaned `claude.exe`.

## 4. Edit / fix / chat flow

- [ ] Open a project, type an edit ("make the background blue"), **Apply**
      → runs as a job; progress overlay shows; cancel works.
- [ ] New version (vN+1) on completion. Follow-up edit relying on context
      ("now make *it* darker") works — `chat.json` history feeds edit jobs.
      Inspect `%APPDATA%\vidtsx-studio\projects\<name>\chat.json`.
- [ ] Break the code (delete a `}`), wait for auto-save → Preview shows the
      error with **Fix with AI** → job produces a fixed version.
- [ ] While an edit job runs on the open project, type in Monaco → job
      completion does not stomp the dirty buffer or silently switch versions.

## 5. Regression sweep

- [ ] **Save as new version** and **Overwrite** reflect the live buffer.
- [ ] Render a version to MP4 (render pipeline shares the preview config
      path that was modified).
- [ ] Workspace screen editor still loads/saves files (shares
      `useCodeEditor`).
- [ ] `npm test` → 166 green; `npm run check:types` → web 27 / node 22.

## Cleanup

- [ ] Delete evidence projects when done: `props-panel-smoke`,
      `rotating-green-square` (and `pulsing-blue-circle` from Phase 3 if
      unwanted).
