# TSX Generator — Stabilization + Parallel Jobs Plan (v2, grilled)

> Written 2026-07-23, revised same day after an adversarial review pass (two code-grounded
> critic agents + manual review). Scope: make the Motion/"Creator" tool (TSX generation +
> editing) fully stable, and support up to 4 simultaneous generations, each with an
> isolated LLM context. Decisions confirmed with Hasan: main-process job manager; per-job
> provider choice; edits/fixes run as jobs too; Phase 4 includes streaming, persistent
> refinement chat, pipeline tests, and finishing the props panel.

## Current architecture (as analyzed)

- Pipeline (`src/shared/tsx-engine/tsx-generation-service.ts`) runs **in the renderer**:
  Plan/Classify → Generate → Verify → transpile-check + up to 3 AI fix retries, each step a
  one-shot `llm:generate` IPC call sharing one `sessionScope`. It also calls
  `window.api.tsxValidate` inside the fix loop (line 158) — both callers must be injected
  to run in main.
- Renderer state: single `useMotionGenerator` hook (one `loading`/`output`/`progress`) in
  `MotionScreen`. No job identity anywhere.
- Providers: `ClaudeProvider` (agent-sdk; also backs MiniMax/OpenRouter via per-subprocess
  env — verified: `buildEnv` never touches `process.env`, so concurrent sessions on
  different providers do NOT cross-contaminate) is a **one-session-per-provider
  singleton**; OpenAI/Gemini/Anthropic-compat are stateless but have **no abort**.
- Cancel: `llm:cancel` → `llmEngine.abortActive()` — global (aborts active + last-used).
- Output: `<projectsDir>/<name>/vN.tsx` + `.debug.json`. **The generate path has NO name
  dedupe today** (`getNextUniqueName` is only used by create-empty/import): if the naming
  LLM returns an existing kebab name, `createProject` silently clobbers that project's
  `v1.tsx`. This is a live data-loss bug, not just a parallelism concern.
- Preview: main-process esbuild transpile (content-addressed caches — parallel-safe) +
  module server + webview-isolated Remotion Player.
- Patterns to reuse: `src/main/services/download-manager/` (multi-concurrent engine —
  including its **persistence/restore/shutdown story**, not just its concurrency), render
  queue's `useSyncExternalStore` progress refs, and download-handlers'
  `BrowserWindow.getAllWindows()` broadcast pattern for push events (jobs outlive the
  originating request; do NOT use the `event.sender` reply pattern).

## Findings from the grill (what changed in v2)

1. **Agent-sdk error results are silently treated as success (TODAY-bug, promoted to
   Phase 1).** `ClaudeProvider`'s `result` branch never inspects `is_error` /
   `subtype` (`error_during_execution`, `error_max_turns`, …) and unconditionally resolves
   with the accumulated text — a usage-limit/overload error resolves as a "successful"
   generation with stale/empty text, which the pipeline then treats as code. Must be fixed
   in `processLoop`'s result handling, not just the catch block. Critical for 4 parallel
   subscription sessions sharing one rate limit.
2. **Streaming claim corrected.** `ClaudeProvider.streamGenerate` yields text only AFTER
   the loop completes — no deltas. Real streaming on the Claude path requires opting into
   `includePartialMessages` and handling `stream_event` messages (SDK supports it). Compat
   providers already stream true deltas. Also `streamGenerate` uses a separate `query()`
   with its own abort controller — per-job cancel must reach it too.
3. **Validate temp-file collision.** `handleTsxValidate` writes `validate-<Date.now()>.tsx`
   then re-reads it from disk — two concurrent validates in the same ms read each other's
   code and race the unlink. Fix: transpile from the in-memory string (no disk round-trip),
   or at minimum a UUID filename.
4. **`fileCreateFolder` can't back collision-retry** — it's `fs.mkdir(recursive: true)`
   (mkdir -p, never throws EEXIST). Atomic reservation needs a new non-recursive mkdir with
   EEXIST → suffix-bump retry.
5. **Throwaway work removed from Phase 1.** The per-`requestId` abort map on the
   `llm:generate` IPC channel would be bypassed once jobs run in main; the `cancelledRef`
   patch dies with the hook in Phase 3. Phase 1 keeps only what survives.
6. **Lifecycle was unaddressed.** `will-quit` (src/main/index.ts) disposes local engines
   but never the cloud `llmEngine` — quitting mid-generation orphans up to 4 `claude.exe`
   children (sessions self-close only via a 120s idle timer). Added shutdown + persistence
   requirements to Phase 2.
7. **Editor-vs-job collision policy was missing** for edits-as-jobs (auto-save debounce
   captures the old path; a job writing vN+1 while Monaco is dirty on vN can stale-flush).
   Added to Phase 3 with the debounce fix as a stated prerequisite.
8. **Error-classifier failure mode corrected:** the regex maps any message containing
   401/404/429 as a substring (e.g. a `"...429ms"` duration) to the wrong human message;
   500 isn't in the map so "500ms" was a bad example.
9. **`generateProjectName` reclassified** from "on the radar" to a Phase 2 task: it must
   move to main with the pipeline, and folding it into the Plan step removes an extra
   concurrent LLM call per job.

## Phase 1 — Stability foundation (only work that survives later phases)

1. **Compat-provider abort.** Implement `abort()` / wire `AbortSignal` into
   OpenAI/Anthropic-compat/Gemini SDK calls. (Kept: the job engine needs these signals.)
   Skip the IPC-level `requestId` map — jobs won't traverse `llm:generate`.
2. **Agent-sdk error-result handling** (finding 1): inspect `is_error`/`subtype` in the
   `result` branch, reject with a typed, human-readable error (map usage-limit/overload
   subtypes). Benefits single generations immediately.
3. **Fix "Save as new version" race** (`MotionScreen.handleSaveNewVersion`): write the new
   version from editor state via a `flushPendingSave()`/content accessor — no disk
   round-trip racing the 500 ms debounce.
4. **Auto-save stale-write guard** (`useCodeEditor.ts`): cancel the pending debounce on
   `filePath` change and capture the target path in the closure. (Prerequisite for
   edits-as-jobs in Phase 3.)
5. **Honest `verified` flag** (`tsx-generation-service.ts:386`).
6. **Retry with backoff for transient errors** (429/ECONNRESET/timeout) on Generate/Edit
   steps: 2 retries, exponential, reusing the download engine's `TRANSIENT_ERRORS`
   approach.
7. **Validate temp-file fix** (finding 3): transpile from string, drop the disk round-trip.
8. **Preview module cleanup:** revoke/prune old module URLs in `useComponentLoader`.
9. **Error classifier fix** (`src/engine/utils.ts`): trust `error.status`; fall back only
   to word-boundary-safe patterns (finding 8).

Deferred out of Phase 1: `cancelledRef` patch (hook is replaced in Phase 3), IPC requestId
abort (superseded by main-process jobs), atomic naming (built once, in Phase 2, as a
main-process util).

## Phase 2 — Job engine in the main process

New service `src/main/services/tsx-jobs/` (`tsx-job-engine.ts`, `types.ts`), modeled on the
download manager **including its lifecycle story**.

- **Job model:** `TsxJob { id, kind: 'generate' | 'edit' | 'fix', prompt, options,
  providerId, status, progress { step, label, percent }, target { projectPath? }, result?,
  error?, usage?, createdAt, startedAt?, completedAt? }`.
- **Status enum:** `queued | planning | generating | verifying | fixing | naming | saving |
  done | error | cancelled`.
- **Concurrency:** `maxConcurrent` is a **setting** (1–4, default 4 per Hasan's ask); extra
  jobs queue. Note: 4 agent-sdk jobs = 4 `claude.exe` processes; consider surfacing the
  existing system-monitor CPU/RAM signal in the UI near the slot indicator.
- **Orchestration moves to main.** Inject **both** callers into the shared pipeline
  (finding: not just LLM): an LLM caller (direct `llmEngine.generate`) and a
  transpile-validator (direct transpiler call — also fixes the temp-file round-trip).
  `src/shared/tsx-engine` stays process-agnostic and becomes unit-testable.
- **Session pool (core refactor).** Extract per-session state from `ClaudeProvider`
  (query, messageQueue, pending promise bridge, text accumulators, idle timer, scope/config
  keys) into a `ClaudeSession` class; provider holds `Map<sessionScope, ClaudeSession>`
  with a cap + idle close. Verified feasible: SDK env is per-subprocess. Minor note:
  concurrent sessions share the default cwd-derived `projectKey` for transcripts —
  acceptable, but set explicit per-session options if it ever matters.
- **Per-job provider:** jobs carry `providerId`; verified safe across concurrent agent-sdk
  providers with different baseURL/env.
- **Per-job cancel:** each job holds its session/request aborts; retire `abortActive`'s
  active+last-used semantics.
- **Atomic naming util (main):** non-recursive `mkdir` + EEXIST suffix-bump returning the
  reserved path; version numbers from a directory listing at write time with EEXIST retry.
  Wire it into the generate path (which today has NO dedupe — live clobber bug) and
  edit/fix version writes.
- **`generateProjectName` moves to main** and folds into the Plan step where possible
  (one less concurrent LLM call per job).
- **Project writes move into the job:** reserve name → write `vN.tsx` + `.debug.json` →
  emit completion with `folderPath`. Emit **incremental** `project-added`/`project-updated`
  events so the renderer doesn't full-rescan the library per completion.
- **Lifecycle (new):** `app.on('will-quit')` → job engine cancels running jobs, aborts all
  pooled sessions (killing `claude.exe` children), flushes state. Persist **queued** jobs
  (render-queue-style JSON or SQLite) and restore on startup; running jobs are marked
  `cancelled` (reason: app quit) — no mid-run resume (explicit non-goal).
- **IPC:** request channels `tsxJob:start`, `tsxJob:cancel`, `tsxJob:list`,
  `tsxJob:clearCompleted`; push channel `tsxJob:event` with throttled snapshots (250 ms),
  broadcast via `BrowserWindow.getAllWindows()`.

## Phase 3 — Renderer job UI

- `TsxJobsProvider` context subscribed to `tsxJob:event`; progress in refs +
  `useSyncExternalStore` (render-queue pattern) to avoid re-render storms.
- **Center-panel ownership rule (new):** the preview/code panel is bound to the *active
  project the user opened*, decoupled from job completion. A completing job never steals
  the panel; non-active completions raise the existing toast (reuse `ToastContext` +
  "Open" action, as the navigate-away path does today).
- **Jobs strip/drawer** in MotionScreen: per-job prompt snippet, provider, step label,
  percent, cancel; failed jobs show error + retry; done jobs click-to-open. Slot indicator
  ("2/4 running"); queued jobs visible as `queued`.
- **Library placeholders:** synthetic `queued`/`generating` rows in the library panel so a
  30–90 s job is visible before its folder exists; coalesce/debounce any remaining
  full rescans.
- **Per-job provider dropdown** in the input panel (defaults to active provider).
- **Edits as jobs + collision policy (new):** "Apply"/"Fix with AI" spawn jobs bound to
  their project. If the target project is open **and dirty** in Monaco when the job
  completes: do NOT auto-switch versions; flush/settle auto-save first (Phase 1.4 is a
  prerequisite), then show a non-blocking "v(N+1) ready" affordance the user clicks to
  switch. Busy badge on the project while its job runs.

## Phase 4 — Features & open-source polish (all confirmed in scope)

1. **Token streaming in the UI.** Compat providers: wire existing deltas through
   `tsxJob:event` (throttled). Agent-sdk: new provider work — opt into
   `includePartialMessages`, handle `stream_event` deltas, and route per-job cancel to the
   stream's abort controller (it currently uses a separate query/abort).
2. **Persistent refinement chat.** `<project>/chat.json`; edit jobs load history so
   refinement is iterative. Replay as messages for compat providers; keep/restore the
   project session where possible on agent-sdk.
3. **Pipeline tests + contributor docs.** Vitest: pipeline with mocked LLM caller +
   validator (extraction, fix loop, verify degradation, error-result subtypes), job engine
   (concurrency cap, overflow, per-job cancel, name collisions, quit shutdown), transpiler
   edges. Plus `docs/tsx-generator-architecture.md`.
4. **Finish the props panel:** AST-based `props-parser`, `PropsPanel`/`PropField`, live
   prop editing → preview update.
5. **Provider expansion (confirmed by Hasan 2026-07-23).**
   - **Local-LLM provider adapter:** add a `local` type to `ProviderConfig` and bridge
     `llmLocalEngine` (node-llama-cpp) into `LLMEngine` so contributors without a paid
     key can run and test the Creator end-to-end.
   - **z.ai (GLM 5.2) preset:** z.ai exposes Anthropic-compatible and OpenAI-compatible
     endpoints — add as a preset on the existing compat providers (verify current endpoint
     + model id at implementation time). OpenRouter already exists as a preset.
   - **Custom provider entry (OSS-friendly):** a "custom provider" option (name + baseURL
     + API key + protocol: openai-compat | anthropic-compat) so the community can add any
     compatible endpoint without a code change — future named presets become curated
     defaults on top of this.

## Process gates & scope notes

- **Type-check gate:** repo baseline is enforced by discipline only (no `type-check`
  script exists despite CLAUDE.md referencing one; baseline counts documented in
  `docs/local-image-models-implementation.md` — re-verify current numbers before starting).
  Add a `check:types` script as part of Phase 1 and treat "no new type errors over
  baseline" as the exit criterion for every phase.
- **Explicitly OUT of scope** (ROADMAP "Now" items that are render-side, not generator):
  Fix GIF render, Render to WebP, Remove Sentry. Noted so this effort doesn't bleed into
  them. ROADMAP's "Claude SDK with different providers" is partially delivered by per-job
  providers; its "Multiple generations at the same time in TSX" bullet is this plan.
- **Uncommitted tree:** the settings-refactor work in the working tree should be committed
  or stashed before Phase 1 starts, to keep this effort cleanly separated.

## Known fragilities on the radar (not blocking)

- esm.sh runtime dependency for non-vendored packages (BUGS.md Bug 5); manual
  `REACT_DEPENDENT_PACKAGES` sync in `tsx-transpiler.ts`.
- Regex-based component-export detection in the transpiler.
- Silent catches in `preview-html.ts` player commands.
- Stub files: `src/renderer/routes.tsx`, editor prop stubs (removed by Phase 4.4).
