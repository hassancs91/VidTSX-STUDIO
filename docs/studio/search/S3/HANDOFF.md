# S3 — build library search (red first, in hand-off-sized steps)
status: IN PROGRESS (steps a, b, c, d DONE; step e part 1 — the UI code + unit tests — `4337910`; **LS-r7 (the rerank rung) started: 3 RED test files written, UNCOMMITTED, no code yet** — builder #9 stopped by the coordinator at 2026-10-29 ~17:58 for a machine shutdown; then the rebuild + §9.3 2 / 3 click-through, then step f)

> Branch `library-search`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt` (paths below are relative to it).
> **The design is `docs/studio/LIBRARY_SEARCH_DESIGN.md` — it binds S3; its §9 is THE ACCEPTANCE BAR S4 fails by.** If the code
> shows the design wrong somewhere, do not improvise: write it under Open problems and return BLOCKED.
> The orchestrator's state: `docs/studio/search/ORCHESTRATOR.md` ("Answers in force").

## Goal (Hasan's S3 text, verbatim)

S3 — BUILD, red-first, in hand-off-sized parts (service + tests with an injected embedder; the vector cache;
IPC + preload; the agent tools switched over; list_assets; the Assets search box; the Settings ladder + the
model download through the existing AI Models / embedding download path; the keyword path kept as Basic).
The benchmark becomes committed tests (thresholds, not exact firsts).

**Exit (orchestrator):** design note §12's steps S3a–S3e built and committed; design §9.1 (the committed benchmark: thresholds, Basic =
today, no claim, nothing fits) green in the tree; design §9.2's gates met (worktree vitest green except the three E-d2a suites with rule
(b); tsc ≤ 26 / 10; the matcher files byte-identical to `7967c6f`; no file over ~300 lines; no `any`; no new npm package); the gated
live-model test run green once against S1's downloaded model; the builder's own live checks of design §9.3 1–3 on an isolated profile
(the ping loop, the download path, the Assets box) with the numbers here. **No Status.md / TESTING.md records in S3** — they are
written after S4's PASS (Hasan's paste-in).

## Plan context

- **Design note:** read it all before step a. Its §2 numbers come from `docs/studio/search/S1-spike-report.md` (read §2, §3, §8, §9,
  §14 there; the kit is `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\` — `labelled-set.json` (1,565 rows, each with `id`, `prompt`,
  `allowed`, `source`, `labelledBy`), `eval-lib.cjs` (S1's `itemText`, the measures), `run-a-keywords.cjs` (S1's (a) ordered list),
  `run-c-hybrid.cjs` (RRF60), `reports\c-rrf60-multilingual-e5-small-mean.json` (`perRow[]` = `{ id, ranked, scores }`) — your
  benchmark must reproduce its table (design §9.1)).
- **The model:** multilingual-e5-small, already downloaded by S1 to `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\multilingual-e5-small\`
  (the catalog's four files; 135,392,016 B) — use it for the fixture script and the gated live test (read-only; never re-download it).
  Load with `dtype: 'q8'`, mean pooling + normalise, `query: ` / `passage: ` prefixes (report §9, §14).
- **Code facts (orchestrator, as of `040717f`):** E3's matcher `src/main/services/library/sound-match.ts` (`rankLibrarySounds`,
  `isCandidate`), `sound-match-words.ts` (`promptTerms`, `matchStrength`), `sound-answer.ts` (`selectSoundAnswer`) — the three
  `sound-match*` files stay byte-identical to `7967c6f`; the reuse answer `src/main/services/studio/agent-tools/sound-reuse.ts` 95
  (`libraryReuseAnswer`, `formatReuseAnswer`), `audio-tools.ts` 199 (`REUSE_NOTE`, `FORCE_HINT`, `generateAndImport` — the provider check
  `hasAudioProvider()` must stay AFTER the lookup), the prompt `src/main/services/studio/studio-agent-prompt-tools.ts:31-32`;
  `list_assets` in `agent-tools/project-tools.ts:25-60` → `library-listing.ts` `formatLibraryListing` / `formatLibraryRow`; the Assets
  search `src/features/asset-library/services/asset-search.ts` (`filterAssets`, 119 lines); the settings KV pattern
  `src/main/services/library/library-prefs.ts`; the utilityProcess precedent `src/content-safety-engine/{safety-engine,worker}.ts`
  (why: `worker.ts:5-15`); the electron-vite entries `electron.vite.config.mjs:31-32`; the embedding download
  `src/main/ipc/embedding-handlers.ts:106-172` (`embedding:model:download`), `isEmbeddingModelDownloaded` in
  `src/main/services/embedding-models.ts:31-37` (models in `{aiModelsFolder}/embeddings/<id>`); the `dtype` bug
  `src/embedding-engine/worker.ts:57-59`; `lazily` `src/main/ipc/registrations/lazy.ts`; Settings rows
  `src/renderer/components/SettingsModal/rows/`; the AI Models hook `src/features/ai-models/hooks/use-embedding-models.ts`.
- **E2's stand-in audio provider (dev-only):** env `VIDTSX_AUDIO_STANDIN_FILE` = an existing mp3
  (`src/main/services/audio-generation-standin.ts:18-24`) — use it in tests / live checks that must prove "generated" vs "not generated".
- **Tests:** `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run <files>` from the worktree; types `node
  D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` and `-p tsconfig.node.check.json` (count
  `error TS` lines; baseline web 26 / node 10). The full-suite gate per DRIVING "Track E" (E-d2a rule (b); E-d13 under external load;
  `--maxWorkers=2` while memory headroom < 10 GB).
- **Build + launch (live checks):** DRIVING "Track E" steps 1–3 (build `wt/out` with the app stopped; launch `electron.exe .` with NO Vite
  server). Profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\search-S3\profile` (copy of `profiles\source\profile` WITHOUT
  `settings\settings.db*`; the app creates a fresh one — never read it), CDP **9292**, Studio root set in the first CDP call to a scratch
  root under `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\`; the library root of that profile is `<profile>\assets` (confirm from
  the running app). Seed the 51 catalog clips there the way E4 / E3 did (`.vidtsx-temp\end-to-end\E4\`, `E3\` kits; the E4 importer
  with an explicit target) or copy the files of `profiles\E3\profile\assets\sfx|music` (READ-ONLY source) into it. **The download path
  check (design §9.3 2) downloads the 135 MB model from HF into THIS profile's models folder through the app's own button** — state the
  size and check disk first.
- **Kits to reuse:** `.vidtsx-temp\end-to-end\E1\` (`launch.sh`, `restore.ps1`, `cdp.mjs`, `watchdog.ps1`), `E3\` (`e3.mjs`, the
  real-handler drivers), S1's `d-cdp.mjs` / `launch-d.sh`. The ping-loop method: the `main-process-freeze` note — an IPC ping every 50 ms
  from the renderer over CDP, max gap reported.
- **Resources (14:58):** C: ~50 GB, D: ~41 GB, memory headroom ~34 GB. Check before every build / launch / copy / download / full run
  (C: ≥ 3 GB and C: + headroom ≥ 6 GB) and write the numbers here.

## Steps (design note §12) — one numbered step = a hand-off point

- **a — the service, pure** (`src/shared/types/library-search.ts`, `src/main/services/library-search/{item-text,search-pool,keyword-retriever,fuse,library-search,search-settings}.ts`
  + tests): red first. The benchmark fixture (the labelled set + precomputed vectors + the committed generator script) and the §9.1
  tests (Smart thresholds per row set, no regression vs (a) on R@10, Basic = today, nothing fits); prove the fixture's (c) table equals
  S1's (precision check, design §9.1). The no-claim test lands in step d (it needs the formatter).
- **b — the engine** (`src/library-search-engine/`, the electron-vite entry, `vector-sync.ts`, the vector file, the gated live test, the
  `embedding-engine/worker.ts` `dtype` fix + test).
- **c — IPC + settings** (channels, types, handlers, preload, status, events, the background build, `lazily`); builder runs the ping loop
  (design §9.3 1).
- **d — the agent tools** (`generate_sfx` / `generate_music` answer per design §8.1, the no-claim test over all 1,515 rows, `REUSE_NOTE` /
  `FORCE_HINT` / prompt :31-32 pinned; `list_assets` ranked per §8.2; E3's answer-format tests rewritten, the matcher / corpus tests untouched).
- **e — the UI** (Settings row + download; the Assets box hook / merge / marker per UI_SPEC.md; the CDP click-through, design §9.3 2–3).
- **f — the exit check:** the full gates, the gated live test, the numbers into "Verified"; status DONE.

## Done (file:line, commit hashes)

**Step a, part 1 — the pure service + unit tests: `3cb73df`** (as of `3cb73df`; red first: all 7 new test files failed with "Cannot find
module" before the code existed).

- `src/shared/types/library-search.ts` — design §3 types verbatim + `LibrarySearchChoice` (`mode | 'auto'`) and `LibrarySearchKind`.
- `src/main/services/library-search/types.ts` — the seams: `SemanticItem {relPath,text,textHash}`, `SemanticRanking {ranked:[{relPath,cosine}],
  vectors}`, `SemanticRanker.rank(query, items)` (the RAW query — the embedder adds `query: `), `LibraryReranker.rerank(query, items) → relPaths`,
  `LibrarySearchSettings {choice, modelId, modelDownloaded}`, `LibrarySearchDeps {loadEntries, settings(), semantic?, reranker?}`, `KeywordHit`.
- `item-text.ts` — `itemText` (S1's rule; `item-text.test.ts` pins it equal to S1's `itemText` on all 51 clips), `textHash` (sha1),
  `semanticItemOf`.
- `src/library-search-engine/prefixes.ts` — `queryText` / `passageText` / `PREFIX_VERSION = 1` (pure; step b's worker and the fixture script
  import it).
- `search-pool.ts` — kinds / sound class / min length / scope (whole-segment prefix). `isCandidate` is NOT exported by the frozen
  `sound-match.ts`, so the rule is restated via the exported `soundClassOf`; `search-pool.test.ts` pins pool == the matcher's own candidate set
  on the corpus (sfx, music, music ≥ 60 s).
- `keyword-retriever.ts` — `keywordList(pool, request)`: kinds == ['audio'] + soundClass → S1's (a) list (`rankLibrarySounds(pool, …, limit:
  pool.length)` → `selectSoundAnswer` rows, other confident, rest by coverage), `words` = `wordsCoveredBy`; **anything else** (image / video /
  mixed / audio without a class) → a coverage ranking over name / tags / category / description with the matcher's field weights via the
  exported `promptTerms` / `matchStrength` / `soundTokens` (no idf), ties by relPath. (The design names only "audio" and "image / video";
  audio-without-class going the coverage way is this builder's reading — `list_assets(kind: audio)` / the Assets box have no class.)
- `fuse.ts` — `fuseRankings(keywordRelPaths, semanticRanked, k = 60)`: union of both lists (an item in one list keeps one term), ties cosine
  then relPath.
- `library-search.ts` — `resolveSearchMode(choice, downloaded)` (§4) + `searchLibrary(request, deps)`; `DEFAULT_LIMIT = 20`. Basic → keyword
  list. Smart: poolSize 0 → `[]` (ran smart); no `deps.semantic` → Basic + `degraded: 'search engine unavailable'`; a rank() rejection →
  Basic + `degraded: <error message>` (step b's host should reject with `'model loading'` / a timeout reason). smart-rerank applies only when
  `deps.reranker` is passed (the tools never pass one → `ran: 'smart'`); a failed rerank keeps Smart's order (`ran: 'smart'`, no `degraded`).
  `why` = `words: a, b · meaning rank N` (`· reranked N`).
- `search-settings.ts` — KV keys `librarySearchMode` (auto = unset) / `librarySearchModelId` (default = unset); `DEFAULT_SEARCH_MODEL_ID`.
- **Benchmark harness (committed, its test RED — the fixture files do not exist yet):** `benchmark/fixture-codec.ts` (int8 / int16 per-vector
  scaled, base64; `cosine` in float64), `benchmark/benchmark-measure.ts` (`BenchRow`, `runBenchmark` = every scored row through the PRODUCT's
  `searchLibrary` with `{kinds:['audio'], soundClass: row.cls, minDurationSec: row.min, limit: 20}`, `recallTable` → ALL / CORPUS / HELD-OUT /
  per source at k 1/3/10/20, `benchDeps`), `benchmark/benchmark-fixture.ts` (reads `benchmark/fixtures/labelled-set.json` `{rows:[…]}` and
  `benchmark/fixtures/vectors-multilingual-e5-small.json`; `fixtureRanker` throws on a stale textHash so a stale fixture shows as `ran:
  'basic'`), `benchmark/s1-tables.ts` (S1's (a) and (c) tables as hit COUNTS `[named, R@1, R@3, R@10, R@20]` — read from
  `S1\reports\a-keywords.json` / `c-rrf60-multilingual-e5-small-mean.json` `table` × named), `benchmark/library-search-benchmark.test.ts` (the
  §9.1 thresholds per row set; CORPUS 7 files at 100; no regression vs Basic on R@10; **the precision check = Smart's counts equal
  `S1_C_RRF60_E5_SMALL` exactly**; Basic's first 3 == `selectSoundAnswer`'s on every row; **Basic's counts equal `S1_A_KEYWORDS` exactly**;
  Smart non-empty pool → `min(20, poolSize)` candidates, poolSize 0 → none; Basic answers nothing iff the matcher scores nothing).
  The vector file shape it expects: `{version:1, modelId:'multilingual-e5-small', dims:384, pooling:'mean', prefixVersion:1, precision:
  'int8'|'int16', check:{…}, items:{[relPath]:{textHash, s, v}}, queries:{[rawPrompt]:{s, v}}}` (`VectorFixtureFile`).

**Step a, part 2 — the fixture + its generator; the §9.1 benchmark GREEN: `2ffcc27`** (as of `2ffcc27`). **Step a is DONE.**

- `scripts/library-search-fixture.mjs` (218 lines) — `--model <dir> --labelled <S1 labelled-set.json> [--s1-report <S1 c-rrf60 json>]
  [--out <scratch>]`. esbuild-bundles (stdin entry, `packages: 'external'`) the PRODUCT's `CORPUS_LIBRARY`, `semanticItemOf`, `queryText` /
  `passageText` / `PREFIX_VERSION`, `runBenchmark` / `recallTable` / `benchDeps`, `encodeVector` / `decodeVector`, `fixtureRanker`, `asCounts` /
  `S1_C_RRF60_E5_SMALL`; onnxruntime-node DLL PATH prepend (resolved via `createRequire`, not hard-coded); `env.allowRemoteModels = false`,
  `env.localModelPath` = the model's parent, `env.cacheDir` = `<out>/tf-cache` (never created — nothing was cached anywhere);
  `pipeline('feature-extraction', <dir>, { local_files_only: true, dtype: 'q8' })`, batches of 32, mean + normalise. Runs the benchmark at
  float32, then int8, then int16; **the design's rule (§9.1): int8 iff its table equals S1's float32 (c) table, else int16 (checked too); exit 1
  if neither.** Also records rows whose top-20 differs from this run's float32 / from S1's `perRow`, and every clip pair (of 51) whose cosine
  order flips vs float32 with its float32 gap. Writes the two fixture files (one entry per line) + a report to `<out>`.
- `benchmark/fixtures/labelled-set.json` (374,708 B) — `{from, rows}` = S1's 1,565 rows (its `excluded` list, 2,899 entries, dropped).
- `benchmark/fixtures/vectors-multilingual-e5-small.json` (1,698,742 B) — **int16**, 51 items + 1,505 queries; `check` =
  `{"precision":"int16","tableEqualsS1":true,"rowsTop20DifferFromS1":13,"rowsTop20DifferFromFloat32":14,"flippedPairsVsFloat32":36,
  "maxFloat32CosineGapOfAFlip":0.00000222,"float32TableEqualsS1":true,"float32RowsTop20DifferFromS1":1,"tried":[{int8: tableEqualsS1 false,
  rows differing 1,171, flipped pairs 9,684, max gap 0.00148},{int16: true, 14, 36, 0.00000222}],"scoredRows":1515,"dtype":"q8"}`.
- `benchmark/library-search-benchmark.test.ts` — the matcher's rankings computed once in `beforeAll` (180 s) — the two "Basic = today" tests
  timed out at 5 s recomputing 1,515 full rankings each (~7–8 s); the row-field check accepts E3's empty-prompt corpus row `#48` (`∅`, a real
  corpus case) and pins it; a new assertion on the file's recorded `check` (`tableEqualsS1`, `float32TableEqualsS1`, `scoredRows: 1515`).

**Step b — the engine: `3c50783`** (as of `3c50783`; red first: the 5 new test files failed "Cannot find module", the dtype test failed on its
assertion — pipeline called without `dtype`). **Step b is DONE.** All under `src/library-search-engine/` unless named:

- `types.ts` (49) — the protocol: `rank {requestId, model:{modelId, modelDir, cacheDir}, vectorFile, query, items}` → `rankResult {ranked, vectors}`;
  `sync {…, items, prune}` → `syncProgress` … `syncResult {ready, total}`; `unload`; `modelLoaded {modelId, loadMs}`; `error {requestId?, error}`;
  `EngineChild {postMessage, onMessage, onExit, kill}`.
- `embedder.ts` (66) — `loadEmbedder({modelDir, cacheDir})` → `{embedQueries, embedPassages, dispose}`: `allowRemoteModels = false`,
  `localModelPath` = the model's parent, `cacheDir` = scratch (**a cacheDir inside `node_modules` is refused**, :38), `pipeline('feature-extraction',
  dir, {local_files_only: true, dtype: 'q8'})`, mean + normalise, `queryText` / `passageText`, `EMBED_BATCH = 32`. Node-importable.
- `vector-store.ts` (180) — `vectorFilePath(root, id)` = `<root>/.vidtsx/search/vectors-<id>.json`; the design §5 file shape (`v` = base64 Float32);
  `open` → `rebuiltBecause` `missing` / `corrupt` / `header mismatch` (version, modelId, pooling, prefixVersion, dims) → starts empty; `adopt(dims)`
  (another length clears); `missing` / `has` by relPath + textHash; `prune`; `rank` (cosine over items with a vector, best first, `{ready, total}`);
  `save` atomic `.tmp` + rename, serialised, only when dirty.
- `model-lock.ts` (30) — one model call at a time; `'high'` (a query) goes before every waiting `'low'` (a build batch).
- `engine-core.ts` (155) — `SearchCore.handle(msg)`: the model loads once per (id, dir) (load failure → `error` for that request, next one
  retries); **rank** embeds the query, embeds the pool's diff first only when it is ≤ 32 items AND no build of that file runs (never index on
  query — a bigger diff ranks the ready ones, `ready < total`), then ranks; **sync** prunes (when asked), embeds the missing in batches of 32 with
  `syncProgress` (first at the starting `ready`), saves every 8 batches + at the end, one sync per file at a time; **unload** saves + disposes.
- `worker.ts` (30) — the utilityProcess child: ORT DLL PATH (`ort-dll-path.ts`, the same three candidates as the other workers), `SearchCore` on
  `process.parentPort`. `ort-dll-path.ts` (31) — `ortDllDirsBeside(dir)`, `prependOrtDllPath(candidates)`.
- `search-engine.ts` (166) — `LibrarySearchEngine implements SemanticRanker`: lazy fork (injected `fork`, so no electron import), request ids
  `ls-N`, `rank` timeout `COLD_TIMEOUT_MS` 5,000 → `'model loading'` before `modelLoaded`, `WARM_TIMEOUT_MS` 2,000 → `'search timed out (2 s)'`
  after; late answers ignored; `error` rejects with the child's message; child exit → every pending rejects `library search engine exited (code N)`,
  respawn on the next call; idle unload `IDLE_UNLOAD_MS` 10 min after the last settled call (never while a sync is pending); `sync(items, prune)`
  (no short timeout; `onVectors({ready, total, building})`); `model()` null → `'model not downloaded'` without a spawn; `terminate()`.
- `electron-fork.ts` (24) — `forkLibrarySearchWorker()`: `utilityProcess.fork(<__dirname>/library-search-worker.js, [], {serviceName:
  'vidtsx-library-search'})` adapted to `EngineChild` (main imports it in step c).
- `electron.vite.config.mjs:33` — the `library-search-worker` entry beside `content-safety-worker`.
- `src/main/services/library-search/vector-sync.ts` (88) — `syncItemsOf(entries)` = every entry (`searchPool(entries, {query: ''})` →
  `semanticItemOf`); `VectorSync` `{engine.sync, loadEntries, enabled, debounceMs = 2000, onError}`: `schedule()` debounced (index writes),
  `buildNow()` (after a download; a call during a run → one more pass after it), skipped while `enabled()` is false, errors → `onError` + null.
- `src/main/services/library-search/benchmark/benchmark-bar.ts` — `SMART_BAR` (the §9.1 table) moved out of the benchmark test, now shared by
  it and the gated live test (the benchmark test's assertions unchanged).
- `embedder.live.test.ts` — **the gated live-model test**: skipped unless `VIDTSX_SEARCH_MODEL_DIR` is set; (1) the 51 clips and 1,505 prompts
  re-embedded through `embedder.ts` — prompts both in batches of 32 and one at a time (the engine's way) — each cosine vs the fixture ≥ 0.99;
  (2) the §9.1 benchmark through `SearchCore` (a scratch vector file, the 51-clip build, every query a `rank` message): `SMART_BAR`, CORPUS +
  its 7 files at 100 / 100, no regression vs Basic on R@10; the file's header checked (dims 384).
- `src/embedding-engine/worker.ts:57-62` — `dtype: 'q8'` (+ comment); `src/embedding-engine/worker.test.ts` pins `pipeline(…, {local_files_only:
  true, dtype: 'q8'})`.
- Tests added: `vector-store.test.ts` 12, `embedder.test.ts` 5, `engine-core.test.ts` 8, `search-engine.test.ts` 8, `vector-sync.test.ts` 5,
  `embedding-engine/worker.test.ts` 1 (= the 39 of the first green run), + the 2 gated.

**Step c, part 1 — IPC + settings, the code: `62685e9`** (as of `62685e9`; red first: the 4 new test files failed "Cannot find module" before
the code existed — run at 16:28). **The ping-loop check (design §9.3 1) is NOT run yet** — that is step c's last item (Next step).

- `src/shared/ipc/channels.ts:604-609` — `LIBRARY_SEARCH` `library:search`, `LIBRARY_SEARCH_STATUS` `library:search:status`,
  `LIBRARY_SEARCH_SETTINGS_SET` `library:search:settings:set`, `LIBRARY_SEARCH_EVENT` `library:search:event` (push).
- `src/shared/ipc/types/library-search.ts` (33) — `LibrarySearchQueryRequest` (= `LibrarySearchRequest`), `LibrarySearchResponse` `{ok:true,
  result} | {ok:false, error}`, `LibrarySearchStatusRequest` `{}`, `LibrarySearchStatusResponse` = `LibrarySearchStatus & {error?}`,
  `LibrarySearchSettingsSetRequest {mode?, modelId?}` → the status (a refused patch: the unchanged status + `error`), `LibrarySearchEvent`
  `{type:'vectors', ready, total, building} | {type:'status', status}` (design §10). Barrel `types/index.ts:16`.
- `src/main/services/library-search/search-runtime.ts` (156) — `LibrarySearchRuntime` (all deps injected; constructing it calls nothing):
  `status()` (effective mode via `resolveSearchMode`, `modelBytes` from the catalog, the last known vector counts for (library root, model id);
  **the first status call of a session with Smart on starts the background sync** — it opens the vector file and embeds only what is missing);
  `search(req)` (`searchLibrary` with the engine as `semantic`; a Smart result with `vectors.ready < total` starts the build unless one runs);
  `setSettings(patch)` (an unknown model id → throws, nothing stored; pushes + returns the new status; switching Smart on starts the build);
  `modelChanged({modelId, change})` (the search model downloaded → the full build + a status push; deleted → a status push); `indexWritten(root)`
  (this library → `VectorSync.schedule()`, skipped while Smart is off); engine progress → `vectors` events.
- `src/main/services/library-search/search-app.ts` (84) — `getLibrarySearchRuntime()` (the singleton; real deps: `LibrarySearchEngine` with
  `fork: forkLibrarySearchWorker`, `model()` = downloaded ? `{modelId, getEmbeddingModelDir(id), cacheDir: <getTempDir()>/library-search/tf-cache}`
  : null, `vectorFile` = `vectorFilePath(getLibraryRoot(), id)`; `loadIndex(getLibraryRoot()).entries`; `search-settings.ts`; the catalog's
  `sizeBytes`); it subscribes to index writes / model changes only when first created; `onLibrarySearchEvent` (subscribe without creating);
  `ensureLibrarySearch` (the `lazily` initializer). **Main now imports the engine host** (`electron-fork`, `search-engine`, `vector-store`).
- `src/main/ipc/library-search-handlers.ts` (64) — `handleLibrarySearch` (no string query → `{ok:false}` without a search), `handleLibrarySearchStatus`
  (a throw → a Basic status carrying `error`), `handleLibrarySearchSettingsSet` (a throw → the unchanged status + `error`); every body in try/catch.
- `src/main/ipc/registrations/library-search.ts` (23) — the three handles via `lazily(ensureLibrarySearch, …)`; events broadcast to every
  webContents on `library:search:event`. Wired in `register.ts:96` (+ import :44) and the `registrations/index.ts` barrel.
- `src/preload/api/library-search.ts` (25) — `librarySearch`, `librarySearchStatus`, `librarySearchSettingsSet`, `onLibrarySearchEvent`
  (unsubscribe returned); spread in `preload.ts:95` (+ import :44), barrel `api/index.ts:41`.
- `src/main/services/library/library-index-events.ts` (27) — `onLibraryIndexWritten` / `notifyLibraryIndexWritten` (listeners contained);
  `library-index-io.ts:113` `writeIndex` calls it after the rename (the one choke point: upsert, reconcile, description / tags, back-fill).
- `src/main/services/embedding-model-events.ts` (30) — `onEmbeddingModelChanged` / `notifyEmbeddingModelChanged`; `embedding-handlers.ts`
  notifies `downloaded` after the download completes (`enqueueDownload` resolves on completion — `download-engine.ts:111-125`) and `deleted`
  after a delete.
- `tsconfig.node.json:11` — include `src/library-search-engine/**/*` (orchestrator ruling: the node check must cover the engine; main's imports
  alone reach only 5 of its files — the child-only `worker.ts`, `engine-core.ts`, `embedder.ts`, `model-lock.ts`, `ort-dll-path.ts` are reached
  through the electron-vite entry, not tsc). With the include `tsc --listFiles` lists all 15 files of the folder; node errors stay 10.
- Tests added: `search-runtime.test.ts` 13, `library-search-handlers.test.ts` 7, `library-index-events.test.ts` 2, `embedding-model-events.test.ts` 1.

**Step c, part 2 — LS-r2 + LS-r3: `373125a`** (as of `373125a`; red first at 16:53: 9 tests failed, each on the missing code —
`expected 118000000 to be 135392016`, `engine.unload` / `onBeforeEmbeddingModelDelete` / `rt.beforeModelDelete` "is not a function"). **With the
ping loop below, step c is DONE.**

- **LS-r2:** `src/embedding-engine/model-registry.ts:87-89` — multilingual-e5-small `sizeBytes: 135_392_016`, `sizeLabel: '135 MB'` (the four
  files: onnx 118,308,185 + tokenizer.json 17,082,730 + config.json 658 + tokenizer_config.json 443 B — S1's copy listed 16:52). New
  `src/embedding-engine/model-registry.test.ts` (2 tests: the sum, the label, the four files). The two test fakes that said `118_000_000`
  (`search-runtime.test.ts`, `library-search-handlers.test.ts`) now say `135_392_016`. Live: `library:search:status` → `modelBytes: 135392016`.
- **LS-r3:** `src/main/services/embedding-model-events.ts:34-56` — `onBeforeEmbeddingModelDelete(hook)` (returns the unregister) +
  `runBeforeEmbeddingModelDelete(modelId)` (awaits every hook; a throw / rejection is contained, the delete goes ahead);
  `src/main/ipc/embedding-handlers.ts:182-183` awaits it BEFORE `deleteEmbeddingModel` (the `deleted` event after a successful delete only);
  `LibrarySearchRuntime.beforeModelDelete(modelId)` (`search-runtime.ts:121-124`) → `engine.unload()` for the search model only (`RuntimeEngine`
  gains `unload`); `LibrarySearchEngine.unload(waitMs = UNLOAD_WAIT_MS 2,000)` (`search-engine.ts:87-94`) — kills the child via `terminate('library
  search model deleted')` (pending calls reject) and waits for its exit (a per-child `childExited` promise, `ensureChild` :101-104) at most
  `waitMs`; no child → nothing. `search-app.ts:77` registers the hook when the runtime is created (no runtime → no child → nothing to unload).
- Tests added: `embedding-handlers.test.ts` 3 (new: hooks finish before the delete, then `deleted`; a failing hook never blocks; a failed
  delete → `{success:false, error}` and no event), `embedding-model-events.test.ts` +2, `search-runtime.test.ts` +1, `search-engine.test.ts` +3.

**LS-r4 + LS-r5 — `5796423`** (as of `5796423`; red first at 17:10: 4 tests failed, each on its assertion — `vitest-red-r4r5.log`).

- **LS-r4:** `search-pool.ts:25-31` — an entry enters the pool only if its kind (`entry.kind ?? mediaKindOf`) is playable
  (`isPlayableMediaKind` from `shared/media-kinds`: audio / video / image), with or without `kinds`; so `vector-sync.ts` `syncItemsOf` (=
  `searchPool(entries, {query: ''})`) embeds only media — a `source`-copied profile's 6 `presets/…` (`data`) entries get no vectors and are
  never returned. Tests: `search-pool.test.ts` +1 (data / `.md` / `.ttf` / `.glb` dropped, `kinds: []` too), `vector-sync.test.ts` +1.
- **LS-r5:** `search-runtime.ts` — `removing` (set by `beforeModelDelete` for the search model BEFORE `engine.unload()`, cleared by
  `modelChanged` `deleted` / `delete-failed` for that id); while set, `search()` passes the ranker `MODEL_BEING_REMOVED` (rejects `'model
  being removed'` → `searchLibrary`'s Basic + `degraded`), starts no build; `status()` starts no build; `smartOn()` is false (the index-write
  sync is skipped). `embedding-model-events.ts:6-10` — `EmbeddingModelChange.change` gains `'delete-failed'` (optional addition to a
  union); `embedding-handlers.ts` notifies it in the delete's catch (the hooks ran — they never throw). Tests: `search-runtime.test.ts` +1
  (Smart → Basic degraded during the removal, 0 rank / 0 sync calls incl. a status + an index write; `delete-failed` → Smart again; `deleted`
  with the model gone → Basic, no `degraded`), `embedding-handlers.test.ts` 1 rewritten (a failed delete → only `delete-failed`).

**Step d, part 1 — generate_sfx / generate_music on the search: `eebcaff`** (as of `eebcaff`; red first at 17:16 — `vitest-red-d.log`: 16
tests failed on the old answer text, the no-claim file at its first row "never searched: The library already has 3 sounds matching …";
the prompt pins in `studio-agent-prompt.test.ts` were edited together with the prompt — NOT shown red).

- `src/main/services/studio/agent-tools/tool-library-search.ts` (23) — `toolLibrarySearch(request, entries)`: `getLibrarySearchRuntime().search`
  (the step-c runtime: Smart through the engine host, Basic + its own `degraded` when the engine is unavailable); if the runtime itself
  throws → Basic over the entries the tool already read, `degraded: 'search engine unavailable'`. Main imports `search-app` from the tools now.
- `sound-reuse.ts` (84, rewritten) — `libraryReuseAnswer(toolName, prompt, {soundClass, minDurationSec?})`: `loadIndex` (a failure → null
  → generate), then `{query: prompt, kinds: ['audio'], soundClass, minDurationSec?, limit: 20}`; `formatReuseAnswer(result, entries, prompt,
  tool)` = `reuseHeaderOf(prompt)` (design §8.1 verbatim, ONE line, the same in every mode) · `degradedLineOf` "Searched by words only:
  <reason>" when `degraded` · E2's `formatLibraryRow(entry, 'audio', 'library:')` per candidate in the search's order · `reusePlaceLineOf`
  `If one fits, place it with insert_asset(assetId: "library:<path>", lane: "audio", at: …). If none fits, call <tool> again with force: true.`
  (a literal `<path>` — no row is singled out). No candidate → null → the tool generates (Smart: only `poolSize: 0`; Basic: the true miss).
  The old E3 wording (`formatLabelledRow`, headers, `selectSoundAnswer` here) is gone; `sound-answer*.ts` / the matcher untouched.
- `audio-tools.ts:60-64` — `FORCE_HINT` / `REUSE_NOTE` rewritten (no "matching" / labels / "may have" / "up to three"); the call order
  unchanged (`force` skips the search; the search runs BEFORE `hasAudioProvider()`; a composition plan never searches).
- `studio-agent-prompt-tools.ts:31-32` — the generate_sfx / generate_music lines say the same (up to 20 refs that may fit, NOT checked, search
  order ≠ fit, pick by plain meaning, `force: true` only when none fits, generates without force only on no sound of that kind / Basic's no
  shared word). Lines in OTHER prompt files ("on a miss … the closest library sounds") are untouched (out of scope; still true in spirit).
- Tests: `audio-tools-reuse.test.ts` (rewritten, 8: header / rows / place line exact, the search request, the degraded line, the runtime-throws
  fallback, force never searches, music class + length rule + plan, Basic true miss, unreadable index, **REUSE_NOTE / FORCE_HINT pinned verbatim
  + claim-free**), `audio-tools-fill.test.ts` (rewritten, 8: Basic's first 3 rows == `selectSoundAnswer`'s on 5 E3 prompts, no labels; Smart
  "things falling over" → `crash-tumble` in the first 8, min(20, pool) rows; Smart "objects toppling over and clattering" → `crash-tumble` in
  the first 8; music Smart only beds ≥ 60 s), `audio-tools-miss.test.ts` (rewritten, 5: Basic near miss → 1 row, 0 generations; Basic true
  miss → 1; force → 1 more, no search; Smart non-empty pool "a dog bark" → rows, 0; Smart force → 1; Smart poolSize 0 (no sfx / no bed ≥ 90 s)
  → generates), **`audio-tools-no-claim.test.ts` (new, 6: all 1,515 scored rows through the REAL handlers in Basic AND Smart (fixture vectors):
  0 claim strings outside the quoted descriptions, header + force line + rows == the search's candidates in order on every answer; Smart
  generates iff the pool is empty and shows min(20, pool) rows; Basic generates iff no candidate)**, `audio-tools.test.ts` (a `search-app`
  mock only), `studio-agent-prompt.test.ts` (the :31-32 pins rewritten + a claim-free check of both lines).

**Step d, part 2 — LS-r6 + `list_assets` §8.2: `332ef1b`** (as of `332ef1b`; red first at 17:29 — `step-d2\vitest-red.log`: 17 tests failed on
their assertions — the 8 new `list_assets` ones on the old every-word listing / describe text, 9 header pins on "(words + meaning)" in Basic;
the import worked (the no-query / project-scope tests passed red too, as they pin unchanged behaviour)). **Step d is DONE.**

- NEW `src/main/services/studio/agent-tools/library-search-listing.ts` (42) — `searchMethodOf(ran)` (`'basic'` → "words only", else "words +
  meaning"), `degradedLineOf` (moved here from `sound-reuse.ts`), `rankedHeaderOf(ran)` = `Ranked by search (<method>) — check the descriptions;
  the order is not a ranking of fit`, `noSearchResultLineOf(query, kind?)` = `The library search found nothing for "<query>"[ (kind: <kind>)].`,
  and `formatLibrarySearchListing(result, entries, query, kind, refPrefix)`: header · the degraded line when `degraded` · E2's `formatLibraryRow`
  per candidate in the search's order (only playable kinds; the pool already guarantees it).
- `sound-reuse.ts:35-37,56` — **LS-r6:** `reuseHeaderOf(prompt, ran)` prints "(words + meaning)" only when Smart ran, "(words only)" for Basic
  (explicit or a fallback — the fallback also gets "Searched by words only: <reason>").
- `project-tools.ts:25,59-67` — library scope: no / blank query → today's `formatLibraryListing(entries, {kind})` unchanged; a query → `loadIndex`
  then `toolLibrarySearch({query: <trimmed raw>, kinds?: [kind], limit: 20}, entries)` → `formatLibrarySearchListing`; project scope unchanged;
  the `query` describe text (:39) now says the library scope is ranked by the search (≤ 20, search order is not fit, read the descriptions).
- Tests: NEW `list-assets-library.test.ts` (10: Basic header + rows == the search's candidates in order, a no-word item dropped and a one-word
  item listed; Smart header + a no-word item listed, never a `data` file; kind → kinds + the raw trimmed query; ≤ 20 rows; the degraded line;
  the runtime throws → Basic + "search engine unavailable"; the no-result line without "matching"; no / blank query → `formatLibraryListing`
  output, no search; project scope unchanged; the describe text); `audio-tools-reuse.test.ts` (HEADER per mode + a new Smart header test);
  `audio-tools-no-claim.test.ts` (the per-mode header on all 1,515 rows in both modes); `audio-tools-fill.test.ts` (Basic header "(words only)").
  `library-listing.test.ts` unchanged and green.

**Step e, part 1 — the UI code + unit tests: `4337910`** (as of `4337910`; red first at 17:41:22 — `step-e\vitest-red.log`: both new test
files failed "Cannot find module './library-search-text'" / "'./smart-search-merge'"). **The rebuild + the CDP click-through (§9.3 2 / 3)
are NOT done** — Next step. The components / hooks have no unit tests (CLAUDE.md: simple display components skipped); their logic is in
the three pure files below.

- NEW `src/shared/library-search-text.ts` (44) — shared by the Settings row and the Assets marker (two features → `src/shared/`):
  `SEARCH_MODE_LABELS`, `modelSizeLabel(bytes)` (decimal MB: 135,392,016 → "135 MB"), `vectorStateLabel` ("51 / 51 ready", "building 12 / 51",
  "no vectors yet"), `effectiveModeLabel(status)` ("Smart (auto)", "Basic (auto — model not downloaded)", "Basic", "Basic (Smart needs the
  model — not downloaded)"), `searchMarkerTitle(status, result)` ("Library search: Smart (auto) — words + meaning · vectors 51 / 51 ready"
  [+ " · this search ran words only: <degraded>"]). Test `library-search-text.test.ts` (5).
- NEW `src/renderer/hooks/useLibrarySearchSettings.ts` (86) — `librarySearchStatus` on mount + `onLibrarySearchEvent` (status → replace;
  vectors → patch the counts); `onEmbeddingDownloadProgress` filtered to `status.modelId` (percent clamped 0–100); `setChoice` →
  `librarySearchSettingsSet({mode})`; `download()` → `embeddingModelDownload({modelId})` (the existing AI Models path), then a status refresh.
- NEW `src/renderer/components/SettingsModal/rows/LibrarySearchRow.tsx` (74) — self-contained like `ProxyGpuEncoderRow`; a `<select>`
  `[data-library-search-choice]`: `auto` "Auto (default) — Smart once the model is here" · `basic` · `smart` · `smart-rerank` listed
  **disabled** "— not available yet" (Open problems); the description names the model id + size; `[data-library-search-state]` "Now:
  <effectiveModeLabel> · vectors <vectorStateLabel>"; `[data-library-search-download]` "Download (135 MB)" only while `!modelDownloaded`,
  "Downloading… N%" + a 4 px bar `[data-library-search-progress]` (UI_SPEC progress bar, `bg-app-hover` / `bg-accent`); errors
  `[data-library-search-error]` in `text-accent-red`. Registered in `GeneralSettingsContent.tsx:130-131` under a new "Library" section header.
- NEW `src/features/asset-library/services/smart-search-request.ts` (31) — `SMART_LIMIT` 20, `SMART_DEBOUNCE_MS` 250,
  `smartSearchRequestOf(query, scopeRelPath, category)` → `{query: trimmed, scope?, kinds?, limit: 20}` (`''` scope = root → omitted; All →
  no kinds; audio / video / image → that kind; **Other or an empty query → null, no call** — the search covers playable media only, LS-r4),
  `requestKeyOf` (query + scope + kinds).
- NEW `src/features/asset-library/services/smart-search-merge.ts` (46) — `mergeSmartResults({flat, filtered, smart, relPathOf, category,
  chip, metaOf})`: `smart === null` → **`filtered` itself (the same array — Basic = today's `filterAssets`)**; else the service's first 20
  relPaths that are in the listed subtree and pass the category + the chip, in its order, then every `filtered` entry not already shown.
  Test `smart-search.test.ts` (10: request shape / scope / kinds / Other / key; merge Basic identity, order, first N = the service's N, top-20
  cap, chip + category narrowing, outside-subtree drop + no repeats).
- NEW `src/features/asset-library/hooks/useLibrarySearch.ts` (87) — status + pushes; only while `status.mode !== 'basic'` it builds the
  request and calls `librarySearch` 250 ms after the last change (a `setTimeout`, cleared on change); an answer is kept with its key and used
  only while the current key matches (a stale answer is never merged; until the new one arrives the grid is Basic's filter); `relPaths`
  memoised. In Basic **no IPC search call is made at all**.
- NEW `src/features/asset-library/components/SmartSearchMarker.tsx` (21) — `[data-library-search-marker=<mode>]` "Smart" badge (UI_SPEC
  badge: 9 px, 1 px 5 px, 4 px radius; `bg-app-active` / `text-accent-light` / a 0.5 px `--color-accent` border), hidden in Basic, `title` =
  `searchMarkerTitle`.
- `AssetSearchBar.tsx` (+4) — an optional `adornment` prop rendered right after the input. `AssetLibraryScreen.tsx` (464 → 473, pre-existing
  over 300): the 3 imports (:32-34), the hook call (:97, scope = `toLibraryRelPath(rootPath, currentPath)`), the memo now `flat` →
  `filterAssets` → `mergeSmartResults` (:98-104), `adornment={<SmartSearchMarker …/>}` (:297) — nothing else.
- `src/renderer/types/electron.d.ts:642-649` — `ElectronAPI` lacked the step-c preload members: added `librarySearch`, `librarySearchStatus`,
  `librarySearchSettingsSet`, `onLibrarySearchEvent`, and `embeddingModelDownload` / `onEmbeddingDownloadProgress` (the preload already had
  them, `api/embedding.ts`) — **tsc web 26 → 25** (the baseline's `use-embedding-models.ts(131)` `embeddingModelDownload` error is gone).

## Verified (exact commands + outputs)

All from the worktree root, as of `3cb73df`:

- `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library-search --exclude '**/benchmark/**'` →
  `Test Files 6 passed (6) · Tests 42 passed (42)`.
- `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS` lines (baseline);
  `-p tsconfig.node.check.json` → 10 (baseline). None in the new files.
- `git diff 7967c6f --stat -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts` → empty.
- Resources at 15:14: C: 51.3 GB free, D: 41.5 GB, memory commit headroom 30.5 GB.
- (superseded by `2ffcc27`, below) the benchmark test was RED at `3cb73df` by design (ENOENT on the fixture).

As of `2ffcc27` (builder #2, 15:23–15:40):

- Resources at 15:23 (before the model load): C: 51.3 GB free, D: 41.5 GB, memory commit headroom 33.5 GB; 0 `electron.exe` running.
- `node scripts/library-search-fixture.mjs --model "C:/Users/hasan/AppData/Local/vidtsx-e2e/search/S1/models/multilingual-e5-small" --labelled
  "D:/repos/VidTSX-STUDIO/.vidtsx-temp/search/S1/labelled-set.json" --s1-report
  "D:/repos/VidTSX-STUDIO/.vidtsx-temp/search/S1/reports/c-rrf60-multilingual-e5-small-mean.json" --out
  "C:/Users/hasan/AppData/Local/vidtsx-e2e/search/S3/fixture"` → rc 0; `run.log` / `library-search-fixture-report.md` there: "load 2599 ms;
  embedded 51 items + 1505 prompts in 9895 ms (batches of 32) · rows: 1565 (scored 1515) · chosen precision: int16" + the `check` above; the
  report holds the float32 / int8 / int16 tables. (A first run with a stricter self-made rule — int8/int16 only if NO row's top-20 differs from
  float32 — chose nothing; replaced by the design's rule. Same vectors, same numbers.)
- **The fixture's (c) table equals S1's float32 table:** float32 → `float32TableEqualsS1: true`; int16 → `tableEqualsS1: true`; int8 → false.
- `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library-search` → `Test Files 7 passed (7) · Tests 60
  passed (60)` (30.9 s; log `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\fixture\vitest-library-search.log`) — the benchmark's 18 tests
  incl. every §9.1 threshold row, CORPUS 7 files at 100, no regression vs Basic on R@10, Smart counts == `S1_C_RRF60_E5_SMALL`, Basic's first 3
  == `selectSoundAnswer` on every row, Basic counts == `S1_A_KEYWORDS`, nothing-fits (pool > 0 → min(20, pool) candidates; pool 0 → none).
- tsc web → 26 `error TS` (baseline), node → 10 (baseline) (`tsc-web.log` / `tsc-node.log` in the same scratch folder), none in library-search.
- `git diff 7967c6f --stat -- src/main/services/library/sound-match.ts …-words.ts …-vocab.ts` → empty.
- No cache written: `<out>\tf-cache` was never created; `node_modules/@huggingface/transformers/` has no `.cache` (listing unchanged, all
  entries dated Jul 7); **`find D:/repos/VidTSX-STUDIO/node_modules -newer <marker>` → no output** (marker
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\fixture\nm-marker` written 15:23:15, before both model loads at 15:23:57 / 15:25:40;
  the scan ran 15:25:40–15:56).
- Post-commit: `git status --short` clean; `git show --stat HEAD` = the 4 paths (3,377 insertions, 5 deletions).

As of `3c50783` (builder #3, 16:00–16:25; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-b\`):

- Resources at 16:11:43: C: 51.4 GB free, D: 41.5 GB, memory commit headroom 29.4 GB; 6 `electron.exe` (Hasan's), 0 with
  `--remote-debugging-port=9292`. S1's model dir: 4 files, 135,392,016 B (read-only, nothing downloaded).
- `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/library-search-engine src/main/services/library-search/vector-sync.test.ts
  src/embedding-engine/worker.test.ts` → red first (5 × "Cannot find module", the dtype assertion), then `Test Files 6 passed (6) · Tests 39 passed (39)`.
- `… vitest.mjs run src/library-search-engine src/main/services/library-search src/embedding-engine src/main/services/library/sound-answer
  src/main/services/library/sound-match` → `Test Files 26 passed | 1 skipped (27) · Tests 1274 passed | 2 skipped (1276)` (27.9 s;
  `vitest-step-b.log`; the skipped file = the gated test without its env var; the benchmark incl. its `SMART_BAR` import green).
- **The gated live-model test, run green against S1's model** (`VIDTSX_SEARCH_MODEL_DIR=C:/Users/hasan/AppData/Local/vidtsx-e2e/search/S1/models/multilingual-e5-small
  node …/vitest.mjs run src/library-search-engine/embedder.live.test.ts --reporter=verbose --silent=false`) → rc 0, `Tests 2 passed (2)`, 61.4 s
  (`live-test-verbose-2.log`; two earlier green runs, `live-test.log` / `live-test-verbose.log`, before the one-at-a-time measure was added):
  model loaded 2,966 ms; **51 clips min cosine 1.000000; 1,505 prompts min cosine 1.000000 in batches of 32, 0.991872 one at a time**; the
  51-clip build through `SearchCore` 1,765 ms; 1,515 rows through the core 32.9 s (incl. Basic). The live table (same log): ALL 1375 named —
  R@1 1206 (87.7) · R@3 1304 (94.8) · **R@10 1366 (99.3) · R@20 1374 (99.9)**; CORPUS 950 / 950 / 950 at R@3 / 10 / 20, each of the 7 files
  100.0; HELD-OUT 425 — 266 · 354 · **416 (97.9) · 424 (99.8)**; `c-ordinary` 171 / 171 at R@10; `d-stopword` 166 (95.4) / 173 (99.4); `j-falling`
  12 / 12; `b-broad-flagged` 26 / 26; `S1-own-en` 24 / 24; `S1-own-ar` 9 (90.0) / 10 (100.0) — every R@10 / R@20 equals S1's (c) table.
  The test's scratch folder held only `.vidtsx` (the vector file) — no `tf-cache` was created.
- **`node_modules` unchanged:** marker `step-b\nm-marker` written 16:11:44.549, before all three model loads (16:11:55, 16:13:04, 16:14:30);
  `find D:/repos/VidTSX-STUDIO/node_modules -newer <marker>` (16:15:58–16:16:12, `nm-scan.log`) → **no output**, rc 0;
  `node_modules/@huggingface/transformers/` lists only `LICENSE README.md dist package.json src types` (no `.cache`).
- tsc web → 26 `error TS` (baseline), node → 10 (baseline) (`tsc-web.log` / `tsc-node.log`); the engine folder + `embedding-engine` +
  `library-search` via the scratch `tsconfig.engine-check.json` → 0 (`tsc-engine.log`).
- `git diff 7967c6f --stat -- src/main/services/library/sound-match.ts …-words.ts …-vocab.ts` → empty. No `any` in the new files (grep);
  the largest new file is `vector-store.ts`, 180 lines. No new npm package.
- **Build** (DRIVING Track E step 1, our app not running): `unset ELECTRON_RUN_AS_NODE; NODE_OPTIONS=--max-old-space-size=8192 node
  D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` → rc 0, 16:16:48–16:20:51 (`build.log`, "built in 3m 45s");
  `out/main/library-search-worker.js` 13,294 B beside `content-safety-worker.js`; transformers.js stays an external `import("@huggingface/transformers")`.
  The worker has NOT run in a utilityProcess yet (main does not import the engine until step c) — step c's ping loop is its first live run.
- Post-commit: `git status --short` clean after `3c50783` (21 paths).

As of `62685e9` (builder #4, 16:27–16:50; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-c\`):

- Resources: 16:28:54 C: 50.9 GB free, memory commit headroom 22.4 GB; 16:35:00 C: 50.7 GB, D: 41.5 GB, headroom 24.7 GB.
- Red first (16:28): `node …/vitest.mjs run src/main/services/library-search/search-runtime.test.ts src/main/ipc/library-search-handlers.test.ts
  src/main/services/library/library-index-events.test.ts src/main/services/embedding-model-events.test.ts` → `Test Files 4 failed (4)`, each
  "Cannot find module". Then green: `Test Files 4 passed (4) · Tests 23 passed (23)`.
- `… vitest.mjs run src/main/services/library src/main/services/library-search src/library-search-engine src/embedding-engine src/main/ipc
  src/main/ipc/library-search-handlers.test.ts src/main/services/embedding-model-events.test.ts --maxWorkers=2` → `Test Files 1 failed | 67
  passed | 1 skipped (69) · Tests 1611 passed | 2 skipped (1613)` (51 s, `vitest-step-c.log`). The 1 failure is
  `src/main/ipc/studio-cut-plan-run-handler.test.ts` ("Cannot find module '…\wt\stream\promises'"), **independent of step c's diff** — see Open
  problems (it fails in this worktree with every tracked step-c edit reverted, and passes in a fresh `git worktree add --detach` of HEAD
  `0b50a75` with all 21 step-c paths copied in).
- tsc web → 26 `error TS` (`tsc-web.log`), node → 10 (`tsc-node.log`, with `--listFiles`: all 15 `src/library-search-engine/` files listed);
  none in a library-search / engine / events file. Matcher diff vs `7967c6f` empty. No `any` in the 12 new files; largest new file
  `search-runtime.test.ts` 242 lines, largest source `search-runtime.ts` 156. No new npm package.
- **Build** (our app not running; DRIVING Track E step 1): `unset ELECTRON_RUN_AS_NODE; NODE_OPTIONS=--max-old-space-size=8192 node
  D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` → rc 0, started 16:35 (`build.start`), "built in 4m 7s"
  (`build.log`) — **`wt/out` = the `62685e9` sources** (no `src/` edit after the build started; the temporary reverts during the
  studio-cut-plan bisect were restored byte-for-byte from tar copies and `git diff --stat` showed the same 9 files / +20 −1 before the commit).
  `out/main/library-search-worker.js` 8,684 B (main now shares `vector-store` / `prefixes` chunks).
- **Live check prepared, NOT run:** Hasan not rendering at 16:35 (6 `electron.exe`, 0 with `--remote-debugging-port=9292`, 0 ffmpeg /
  chrome-headless-shell / remotion / compositor processes descended from them, 0 entries in `%TEMP%\vidtsx-studio` modified in the last 2 min).
  Profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\search-S3\profile` created by `robocopy profiles\source\profile … /E /XF
  settings.db*` (0 `settings.db*` in the copy); seeded `<profile>\assets\sfx|music` = E3's 51 clips (robocopy from `profiles\E3\profile\assets`,
  read-only source) + E3's `assets\.vidtsx\index.json` (70,096 B: 61 entries — the 51 clips, all with descriptions, 47 with tags, + 4 `generated/`
  whose files are NOT copied + 6 `presets/`; a reconcile drops the 4 — the driver's `pre` calls `libraryIndexGet`). The model is NOT copied yet.
  Kit: `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S3\launch-s3.sh`, `c-ping.mjs` (`pre` / `run`). No app launched, no model loaded this session.

As of `373125a` (builder #5, 16:51–17:05; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-c5\` unless named):

- Resources: 16:54:21 C: 50.2 GB free, D: 41.5 GB, memory commit headroom 25.4 GB; 16:57:27 headroom 23.1 GB; 17:00:07 (`guard-prelaunch.log`)
  C: 50.2 GB, D: 41.5 GB, headroom 25.4 GB.
- Red (16:53, `vitest-red.log`): `node …/vitest.mjs run src/embedding-engine/model-registry.test.ts src/main/ipc/embedding-handlers.test.ts
  src/main/services/embedding-model-events.test.ts src/main/services/library-search/search-runtime.test.ts src/library-search-engine/search-engine.test.ts`
  → `Test Files 5 failed (5) · Tests 9 failed | 24 passed (33)`, each failure on the missing code (see Done).
- Green (16:54, `vitest-green.log`): `… vitest.mjs run src/embedding-engine src/main/ipc/embedding-handlers.test.ts src/main/ipc/library-search-handlers.test.ts
  src/main/services/embedding-model-events.test.ts src/main/services/library-search src/library-search-engine --maxWorkers=2` → `Test Files 18 passed
  | 1 skipped (19) · Tests 131 passed | 2 skipped (133)` (22.3 s; the skipped file = the gated live test without its env var).
- tsc web → 26 `error TS` (`tsc-web.log`; the embedding lines in it are the baseline's `ElectronAPI` ones, pre-existing), node → 10 (`tsc-node.log`).
  Matcher diff vs `7967c6f` empty. No `any` in the touched files (grep). Largest touched source `embedding-handlers.ts` 244, `search-engine.ts` 183.
- **Build** (our app not running): `unset ELECTRON_RUN_AS_NODE; export NODE_OPTIONS=--max-old-space-size=8192; node
  D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` → rc 0, 16:56:38–16:59:58 ("built in 3m 3s", `build.log`) —
  **`wt/out` = the `373125a` sources** (no `src/` edit after the build started). `out/main/library-search-worker.js` 8,684 B.
- **Not rendering** (17:00:07, kit `S3\guard.ps1`): 6 `electron.exe` (Hasan's), 0 ours; 0 ffmpeg / ffprobe / chrome-headless-shell / remotion /
  compositor descendants of his PIDs; 0 entries in `%TEMP%\vidtsx-studio` modified in the last 2 min → GUARD OK. `node_modules` marker
  `step-c5\nm-marker` written 16:57:41.69 (before the app's model load at ~17:00:35).
- **The live ping loop (design §9.3 1) — PASS: max gap 65.1 ms (bar ≤ 250 ms).** Launch `bash …/S3/launch-s3.sh` (background; `wt/out`, no Vite
  server, profile search-S3, CDP 9292; app log `…\search\S3\step-c\app.log`). `node …/S3/c-ping.mjs pre` (`pre.log`; its clock prints UTC):
  studioRootSet → `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\studio-root` (FIRST call, confirmed by `studioRootGet`); library root
  `<profile>\assets` (default, not an override); AI models folder `<profile>\ai-models`; **status before the model = `{mode:'basic', choice:'auto',
  modelDownloaded:false, modelBytes:135392016, vectors:{0,0,building:false}}`**; reconcile → 57 entries (the 51 clips + 6 `presets/`; E3's 4
  `generated/` dropped); no embedding model downloaded. Model copied 17:00:32 (S1's folder, read-only) → `<profile>\ai-models\embeddings\
  multilingual-e5-small\` (4 files, 135,392,016 B). `node …/c-ping.mjs run` (`run.log`; report `…\search\S3\step-c\ping-report.json`, copy in
  `step-c5\`): status at +1,514 ms (2 ms) → `mode:'smart'`, `building:true` (spawn + cold load + build kicked); the last vectors event at +6,002 ms
  = **57 / 57, building false**; **the first Smart query "things falling over" (audio, sfx, limit 20): 40 ms, `ran:'smart'`, `poolSize:45`,
  `vectors:{45,45}`, no `degraded`**; its first 8: party-popper, break-crash-digital, crunch-bite, **crash-tumble (4th — S1 ranks it 4th)**,
  break-glass-crack, flame-snuff, chess-piece-capture, impact-deep-soft. **Ping: 152 pings over 7,556 ms, 0 errors, max gap 65.1 ms (at
  +2,667 ms), max RTT 8.6 ms, p99 RTT 5.9 ms, no gap over 100 ms.** Status after: smart, vectors 57 / 57.
- After (our instance stopped 17:01:02: 5 `electron.exe` matched by the search-S3 profile / port 9292 stopped, 0 left, Hasan's 6 untouched; the
  launcher's exit 127 = the killed `exec`, expected): `<profile>\assets\.vidtsx\search\vectors-multilingual-e5-small.json` 121,842 B, header
  `{version 1, multilingual-e5-small, dims 384, mean, prefixVersion 1}`, 57 items (6 of them `presets/…` — Open problems); **`%TEMP%\vidtsx-studio\
  library-search` does not exist (no tf-cache)**; **`find D:/repos/VidTSX-STUDIO/node_modules -newer step-c5/nm-marker` → 0 lines, rc 0**
  (17:01:15–17:01:27, `nm-scan.log`); `node_modules/@huggingface/transformers/` lists `LICENSE README.md dist package.json src types` only;
  `app.log` has "[LibrarySearch] Library search runtime created" and 0 lines containing "error".

As of `eebcaff` (builder #6, 17:06–17:25; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-d\`; no build, no launch, no model
load, no full run this session — so no resource guard was needed):

- `node …/vitest.mjs run src/main/services/library-search/search-pool.test.ts …/vector-sync.test.ts …/search-runtime.test.ts
  src/main/ipc/embedding-handlers.test.ts` → red 17:10 `Test Files 4 failed (4) · Tests 4 failed | 27 passed (31)` (`vitest-red-r4r5.log`);
  after the code `… run src/main/services/library-search src/library-search-engine src/main/ipc/embedding-handlers.test.ts
  src/main/ipc/library-search-handlers.test.ts src/main/services/embedding-model-events.test.ts --maxWorkers=2` → `Test Files 16 passed | 1
  skipped (17) · Tests 131 passed | 2 skipped (133)` (17:11, `vitest-green-r4r5.log`; the benchmark incl.).
- `… run src/main/services/studio/agent-tools/audio-tools src/main/services/studio/studio-agent-prompt.test.ts --maxWorkers=2` → red 17:16
  `Tests 16 failed | 31 passed | 6 skipped (53)` (`vitest-red-d.log`); green 17:17 `Test Files 6 passed (6) · Tests 53 passed (53)` (20.7 s,
  `vitest-green-d1.log` — the no-claim file's 3,030 handler calls incl.).
- `… run src/main/services/studio src/main/services/library src/main/services/library-search src/library-search-engine
  src/main/ipc/embedding-handlers.test.ts src/main/ipc/library-search-handlers.test.ts src/main/services/embedding-model-events.test.ts
  --maxWorkers=2` (17:19–17:21, `vitest-step-d.log`) → `Test Files 5 failed | 149 passed | 3 skipped (157) · Tests 8 failed | 2286 passed | 25
  skipped (2319)`. The 5: `shot-bundle.test.ts` + `shot-bundle-in-place.test.ts` (E-d2a: `Could not resolve "chroma-js"` / `@remotion/shapes`
  / … only) and `pack-package.test.ts`, `project-package.test.ts`, `project-package-import.test.ts` (each at import: "Cannot find module
  '…\search\wt\stream\promises'" / "'…\search\wt\stream'" from vitest's module-evaluator — the LS-r1 class, see Open problems). E3's matcher /
  corpus / `sound-answer*` tests are inside `src/main/services/library` — green, untouched.
- tsc web → 26 `error TS` (`tsc-web.log`), node → 10 (`tsc-node.log`); none in a touched file. Matcher diff vs `7967c6f` empty. No `any` in the
  touched files (grep: one hit = the word in a comment). Largest touched: `audio-tools-reuse.test.ts` 205, `audio-tools.ts` 199,
  `search-runtime.ts` 180. No new npm package.
- Post-commit: `git status --short` clean after `eebcaff` (10 files, +470 −398).

As of `332ef1b` (builder #7, 17:27–17:35; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-d2\`; no build, no launch, no model
load, no full run — no resource guard needed):

- Red 17:29 (`vitest-red.log`): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/studio/agent-tools/list-assets-library.test.ts
  …/audio-tools-reuse.test.ts …/audio-tools-fill.test.ts …/audio-tools-no-claim.test.ts --maxWorkers=2` → `Test Files 4 failed (4) · Tests 17 failed
  | 16 passed (33)`.
- Green 17:31 (`vitest-green.log`): `… vitest.mjs run src/main/services/studio/agent-tools src/main/services/studio/studio-agent-prompt.test.ts
  --maxWorkers=2` → `Test Files 18 passed (18) · Tests 115 passed (115)` (26.3 s; incl. the 1,515-row no-claim file in both modes and
  `library-listing.test.ts`).
- tsc web → 26 `error TS` (`tsc-web.log`), node → 10 (`tsc-node.log`) — baseline; none in an agent-tools / library-search file. Matcher diff vs
  `7967c6f` empty. No `any` in the touched files (grep: two hits = the word in `sound-reuse.ts` comments). Largest touched:
  `audio-tools-reuse.test.ts` 218, `list-assets-library.test.ts` 195, `project-tools.ts` 92. No new npm package.
- Post-commit: `git status --short` clean after `332ef1b` (7 files, +278 −15).

As of `4337910` (builder #8, 17:37–17:47; logs in `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\step-e\`; no build, no launch, no model
load, no download, no full run — no resource guard needed):

- Red 17:41:22 (`vitest-red.log`): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/shared/library-search-text.test.ts
  src/features/asset-library/services/smart-search.test.ts` → `Test Files 2 failed (2) · Tests no tests` (each "Cannot find module").
- Green 17:45:46 (`vitest-green.log`): `… vitest.mjs run src/shared/library-search-text.test.ts src/features/asset-library
  src/renderer/components/SettingsModal --maxWorkers=2` → `Test Files 7 passed (7) · Tests 53 passed (53)` (the 2 new files' 15 + the 5
  existing asset-library service files, `asset-search.test.ts` incl. — `filterAssets` untouched).
- tsc 17:44 web → **25** `error TS` (`tsc-web.log`; vs `step-d2\tsc-web.log` the only difference is `use-embedding-models.ts(131)` gone),
  node → 10 (`tsc-node.log`); none in a new / touched file. Matcher diff vs `7967c6f` empty. `any` grep over the 9 new files + the 2 touched
  components: one hit = the word in a comment (`smart-search-merge.ts:21`); no `@main` / `@features/studio` / `electron` / `fs` / `path` /
  `require(` import in them. Largest new file `smart-search.test.ts` 119, largest new source `useLibrarySearch.ts` 87. No new npm package.
- Post-commit: `4337910` = 13 paths; `git status --short` clean after it.

## In progress — LS-r7, UNCOMMITTED (builder #9, as of `290dbbb`; stopped mid-step by the coordinator for a shutdown)

Three NEW test files are on disk, untracked (`git status --short` → `??` ×3), **written but NOT run** (no red run was made — the stop came
first), and the code they need does not exist yet, so they are RED by construction ("Cannot find module './rerank'" / "'./rerank-prompt'",
missing exports in `smart-search-request.ts`). They are left uncommitted on purpose (not green). Nothing else changed: no `src/` code, no
build, no launch, no download, no test run, 0 `electron.exe` of ours (checked: port 9292 / search-S3 → 0).

- `src/main/services/library-search/rerank.test.ts` — pins the API: `rerank-prompt.ts` exports `RERANK_TOP = 20`, `rerankPromptOf(query,
  items: SemanticItem[])` (query JSON-quoted; lines `<n> | <relPath> | <text, whitespace flattened>` for the first 20; the S1 (d) rules
  adapted to an order — "plain meaning", "not by words that happen to match", "loosely related or merely similar" below a real fit; reply ONLY
  `{"order": [ … ]}`; no "already has" / "matching"), `parseRerankOrder(text, items)` → relPaths or **null on any bad answer** (accepts a code
  fence, text around the object, numeric strings, a bare array; a partial order is valid; null for empty / prose / broken JSON / no `order` /
  empty / out of range / 0 / duplicate / fraction / a ref instead of a number). `rerank.ts` exports `RERANK_FEATURE_SOURCE =
  'library-search-rerank'` and `createLibraryReranker({generate(LLMRequest) → LLMResponse, logUsage(Omit<AiUsageEntry,'id'>), indexVersion():
  string})` → `LibraryReranker`: one `generate({prompt: rerankPromptOf(…)})` (no providerId = the app default; wire `llmEngine.generate`
  in `search-app.ts`, ideally via a dynamic import so search-app's import graph / tests are unchanged); usage logged after every RESPONSE
  (also a bad one) with provider / model / tokens / cost / `durationMs` / ISO `timestamp` / `requestType: 'llm'` (the `llm-handlers.ts:268-280`
  shape, fire-and-forget); a bad answer → rejects `/rerank answer/`; a generate failure → rejects, nothing logged, NOT cached; cache key =
  index version + query + the items' relPath:textHash list; concurrent identical asks share one call; `[]` → `[]` without a call. Needs
  `'library-search-rerank'` added to `AiFeatureSource` (`src/shared/types/ai-usage.ts:2-17`, no `Record<AiFeatureSource…>` exists — grep).
- `src/main/services/library-search/search-runtime-rerank.test.ts` — `LibrarySearchRuntimeDeps.createReranker?: (indexVersion: () => string)
  => LibraryReranker` (built once in the constructor); `search()` passes `reranker` to `searchLibrary` ONLY when `request.rerank === true`
  (and not while removing) — `searchLibrary` already applies it only for `smart-rerank`; `indexWritten(ROOT)` bumps the version (another
  root does not). Needs `LibrarySearchRequest.rerank?: boolean` (`src/shared/types/library-search.ts:13-22`, optional, doc: the Assets box's
  settled query only). (The existing `search-runtime.test.ts` is 286 lines — hence a new file.)
- `src/features/asset-library/services/smart-search-rerank.test.ts` — `smart-search-request.ts` gains `RERANK_SETTLE_MS = 1000`,
  `rerankRequestOf(req)` = `{...req, rerank: true}` (same `requestKeyOf`), `shouldRerank(status: {mode} | null)` (only `smart-rerank`),
  `keepAnswer(prev, next)` over `{key, result, reranked}` (a late Smart answer never replaces a reranked one for the same key).
- Still to write after those (no tests pinned yet): `useLibrarySearch.ts` — when `shouldRerank(status)`, a 1 s idle timer + a `settle()`
  (Enter) that sends `rerankRequestOf(request)` once per key, answers merged through `keepAnswer` and dropped unless the key is still current
  (a ref); `AssetSearchBar.tsx` `onSubmit` on Enter, `AssetLibraryScreen.tsx` passes `smart.settle`; `LibrarySearchRow.tsx:11` enable the
  option (label + one description sentence: your default AI provider orders the Assets search's top 20 after you stop typing, one logged
  call per search, the assistant never reranks); optionally `searchMarkerTitle` names the rerank (+ a test); `search-app.ts` wiring.

## Next step (ONE concrete instruction)

First finish LS-r7: run the 3 untracked test files red (`node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
src/main/services/library-search/rerank.test.ts src/main/services/library-search/search-runtime-rerank.test.ts
src/features/asset-library/services/smart-search-rerank.test.ts`, log the red), write the code listed under "In progress" until they are
green (plus the library-search / asset-library / SettingsModal folders and tsc ≤ 25 / 10), commit with explicit paths; THEN the rebuild +
click-through below. Rebuild `wt/out` and run the §9.3 2 / 3 click-through: (0) read `docs/ui-automation-cdp.md` (builder #8 did not — it read DRIVING, UI_SPEC
§colour / components, and the design); (1) `S3\guard.ps1` (resources + Hasan not rendering + 0 of ours), write the numbers here, then build
(DRIVING Track E step 1; `wt/out` is still `373125a` — main changed in step d, the renderer in step e); (2) prepare the search-S3 profile for
the no-model start: remove `<profile>\ai-models\embeddings\multilingual-e5-small\` (our copy of S1's model, made 17:00) and
`<profile>\assets\.vidtsx\search\`; state the download size (135,392,016 B) and C: / headroom here; (3) guard again, `launch-s3.sh`, Studio
root first (`c-ping.mjs pre` does it), then a new driver: status = Basic / not downloaded and NO download starts by itself (watch the models
folder for ~30 s); open Settings › General, still of the row (`[data-library-search-row]`, before); click `[data-library-search-download]`,
stills during (`[data-library-search-progress]`, "Downloading… N%") and after; status flips to `smart` / `auto`; the build's events reach
51 / 51 (LS-r4: the 6 `presets/` are no longer embedded); (4) Assets screen at the root, category All: type "things falling over" →
`crash-tumble` in the first 8 tiles, "صوت زجاج يتكسر" → `break-glass-crack` in the first 8; compare the grid's first 20 with
`window.api.librarySearch({query, limit: 20})` (no scope at the root, no kinds for All) in order; still of the box with the marker; (5) set
Basic through `[data-library-search-choice]` (native select: prototype value setter + bubbling `change`), the marker disappears, and for 3
queries the tiles equal today's `filterAssets` (every query word in name / description / tags / sound category, over the reconciled index);
still; (6) stop our instance, `find D:/repos/VidTSX-STUDIO/node_modules -newer <marker>` empty; then step f. **Risk to check first in (4):**
the Assets box at All sends NO `kinds` / `soundClass`, so the keyword half is the generic coverage ranking (not E3's matcher, see the first
Open problem) — the ping check's "crash-tumble 4th" was with `kinds:['audio'], soundClass:'sfx'`. If `crash-tumble` misses the first 8,
read the IPC's own order for the same request before suspecting the merge (`mergeSmartResults` keeps the service's order — unit-tested).

## Open problems

- (note — for the orchestrator; not blocking §9) **the "Smart + AI rerank" rung has no implementation.** Design §3 lists `rerank.ts` and §8.3
  describes the Assets box's rerank (one provider call per settled query, cached by query + index version), but no S3 step builds it (§12's
  S3a–S3e do not name it; §9.4 makes the live rerank DEFERRED-HASAN, "unit-tested with an injected reranker" — `library-search.ts`'s
  injected-reranker tests exist; the runtime passes none). The KV accepts `smart-rerank` (`search-settings.ts:11`), and with no reranker it
  runs Smart (`ran: 'smart'`). The Settings row therefore lists the rung **disabled** ("Smart + AI rerank — not available yet") rather than
  offering a choice that does nothing; Auto / Basic / Smart are selectable. If the orchestrator wants `rerank.ts` + the box's rerank in S3,
  that is a ruling (it needs the app-default provider path; no model call may run in S3).
- (note) `ElectronAPI` (`src/renderer/types/electron.d.ts`) is hand-written and had none of step c's `librarySearch*` members; step e added
  them + `embeddingModelDownload` / `onEmbeddingDownloadProgress`, which also clears one baseline web error (26 → 25). The other baseline
  `ElectronAPI` gaps (`embeddingModelsList`, `embeddingModelDelete`, …) are untouched (not this slice's).

- (note, not blocking) audio requests WITHOUT a sound class use the generic coverage ranking (see `keyword-retriever.ts`); the design names only
  "audio → E3's matcher" and "image / video → coverage". Step d's `list_assets(kind: audio)` will rank that way unless S4 / Hasan say otherwise.
  (Orchestrator ruling after builder #1: accepted.)
- (note, not blocking — for S4) **the int16 fixture's near-ties.** The design's check (§9.1: "the fixture's (c) table equals S1's float32
  table … int8 if that holds, else 16-bit") holds at int16 (and at float32; int8 fails). Its literal "changes NO ranking" is met at the level
  the design measures (every table count, all 18 row sets); at the level of single rows, 14 of 1,515 rows' top-20 ORDER differs from this
  run's float32, from 36 clip pairs (over 1,505 queries × 1,275 pairs) whose cosine order flips — every one a float32 gap ≤ 2.22e-6, i.e.
  ties below the stored precision. Same-precision noise is of the same kind: this run's float32 vs S1's own float32 `perRow` differs in 1 row.
  Recorded in the file's `check` and the report; no bar moves. (Float32 storage would be ≈ 3.3 MB — computed: 1,556 vectors × 384 × 4 B
  as base64 — over the design's ~3 MB.)
- (note, not blocking — for S4 / the orchestrator) **the query batch effect.** The fixture script embedded the 1,505 prompts 32 at a time; the
  engine embeds each query ALONE (one search = one query). With the q8 model the two differ: in the gated test (`live-test-verbose-2.log`) the
  batched prompts match the fixture at min cosine 1.000000, the one-at-a-time ones at **min 0.991872** — above the design's 0.99, but close
  (likely q8's dynamic activation quantization seeing the batch's padding). Through the product path (`SearchCore`, one query per rank) the live
  table equals S1's (c) at R@10 / R@20 on every row set (ALL 1,366 / 1,374, HELD-OUT 416 / 424), and every §9.1 bar holds; R@1 / R@3 drift
  by a few rows (ALL R@1 1,206 vs S1's 87.4 % = 1,202; HELD-OUT R@1 266 vs 61.4 % = 261; `d-stopword` R@1 72 vs 67, R@3 117 vs 118) — R@1 is only
  a note (§9.4). The committed fixture stays batched: one-at-a-time vectors would break the design's precision check (the fixture's table equals
  S1's float32 table). If the orchestrator wants the benchmark to measure the engine's own query vectors, that is a design change (§9.1).
- (note) the electron-vite node check config (`tsconfig.node.json` include) does not cover `src/library-search-engine/` (nor the other
  `*-engine/` folders) — they are checked only through main's imports, and main imports the engine from step c on. Until then this builder
  checked them with a scratch config that extends `tsconfig.node.check.json` (`.vidtsx-temp\search\S3\tsconfig.engine-check.json`): 0 errors.
- (note — for the orchestrator / step f's full run) **`src/main/ipc/studio-cut-plan-run-handler.test.ts` fails in THIS worktree** ("Cannot find
  module 'D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt\stream\promises' imported from …\vitest\dist\module-evaluator.js"; `stream/promises` is
  imported by `src/main/services/packages/zip-reader.ts`), deterministic alone. Not step c's diff: it still fails here with all 9 tracked step-c
  edits reverted (checked by restoring HEAD's copies and back); with `out/` moved aside; with `wt/node_modules` (vitest's results cache only)
  moved aside and `--cache=false` — and it PASSES (5 tests) in a fresh `git worktree add --detach .vidtsx-temp\search\S3\head-wt HEAD` (`0b50a75`),
  both without and with all 21 step-c paths copied in (the scratch worktree was removed after). So it is an environment effect of this worktree
  checkout (cause not found — possibly the LF / CRLF difference DRIVING's B5 note describes), like E-d2a's three package-resolution suites; it
  needs the orchestrator's rule for step f's gate (show it independent of `906273c..HEAD`, as E-d2a does).
- RESOLVED by LS-r2 (`373125a`): the catalog's multilingual-e5-small entry = 135,392,016 B / "135 MB" (was 118,000,000 / "118 MB"); live status
  `modelBytes: 135392016`. The other catalog entries' undercounts stay a NOTE (LS-r2: not this slice's).
- RESOLVED by LS-r3 (`373125a`): the delete handler awaits the before-delete hooks; the runtime kills the engine child and waits for its exit
  (≤ 2 s) before the files are deleted. **A live delete on Windows is a note for S4** (not run here). Remaining edge (note, not tested): a search /
  status call that lands BETWEEN the unload and the `fs.rm` can respawn the child (the files still exist) and race the delete; the delete then
  reports its own error (`{success:false}`), nothing hangs.
- (note — for the orchestrator / step f's gate) **three more suites fail in THIS worktree with the LS-r1 error class** (`vitest-step-d.log`,
  17:21): `src/main/services/studio/pack-package.test.ts` ("Cannot find module '…\search\wt\stream\promises'"), `project-package.test.ts` and
  `project-package-import.test.ts` ("… '…\search\wt\stream'"), all at import from vitest's module-evaluator — package / zip code (`zip-reader.ts`
  imports `stream/promises`) that step d does not touch. Builder #4's step-c run did not include `src/main/services/studio`, so they were not seen
  before. LS-r1 names only `studio-cut-plan-run-handler.test.ts`: step f must give each of these the LS-r1 proof (passes in a fresh detached
  worktree at the gate's HEAD) or the orchestrator must extend LS-r1. Not re-bisected here.
- RESOLVED by LS-r6 (`332ef1b`): the `generate_*` header and the `list_assets` header now name what ran ("(words + meaning)" only for Smart,
  "(words only)" for Basic, + the degraded line on a fallback). The note below is kept for the record.
- (note — for S4) **the §8.1 header is the same in every mode** ("found by search (words + meaning)"), as the design writes it (one neutral
  header; §9.3 4 "Basic → today's ordering under the neutral header"): an explicit Basic choice therefore prints "(words + meaning)" with no
  extra line — the design's "Searched by words only: <reason>" line is added only when the search reports `degraded` (a Smart fallback). Built
  to the letter; if the orchestrator wants Basic-by-choice to say "words only" too, that is a design wording change.
- (note) the placement line names `library:<path>` literally (design §8.1's text) rather than the first row's ref (E3's old hint did) — so no
  row is singled out; the rows carry the refs.
- RESOLVED by LS-r4 (`5796423`): the pool admits only audio / video / image; a `source`-copied profile's build reads 51 / 51. The note below
  is kept for the record.
- (note — for the orchestrator before S4; not blocking step c) **the vector build counts every index entry the pool admits, incl. kind `data`.**
  `syncItemsOf(entries)` = `searchPool(entries, {query: ''})` (no `kinds` → no kind filter), so on the search-S3 profile the build is **57 / 57 =
  the 51 clips + 6 `presets/…` files** (`preset.json` / `PRESET.md` × 3, kind `data`, present in every profile copied from `profiles\source`); a
  request without `kinds` (the Assets box with no category filter, `list_assets` without `kind`) can rank those `data` entries too. Design §9.3 2
  reads "the background build reaches 51 / 51" — on such a profile it reads 57 / 57. Either (a) accept (the verifier reads "all entries ready",
  57 / 57 here), or (b) restrict the pool's default kinds to `audio | video | image` (the request type's own kinds; a step-a `search-pool.ts`
  change + a test; the vector total would then be 51) — the orchestrator's call. This builder did not change it.
- (note) **Hasan's dev app is running** since 15:27 (main checkout, `--remote-debugging-port=9222`, his `%APPDATA%\VidTSX Studio` profile,
  6 `electron.exe` at 15:57) — not ours: never stop it, never run `electron-vite dev`; select our instance only by port 9292 / the search-S3
  profile path + `Name='electron.exe'` (DRIVING).

## Do-not-redo

- The service files and their 42 unit tests (`3cb73df`) — extend, don't rewrite.
- S1's tables are already transcribed as counts in `benchmark/s1-tables.ts` (checked against the reports' `table` fields).
- The fixture (`2ffcc27`): don't regenerate it unless item text / prefixes change (a changed textHash makes the benchmark run Basic and fail
  loudly). Regenerating needs only the command under "Verified"; it never downloads (S1's model dir, read-only).
- The engine (`3c50783`): the 39 unit tests + the gated test are green — extend them. The gated test needs only the command under "Verified"
  (≈ 1 min, ~1 GB RAM; it never downloads); re-run it only after an engine / embedder / item-text change. `wt/out` was built at `3c50783` —
  rebuild after any `src/` change before a live check.
- Step c's code (`62685e9`): the 23 new tests are green — extend them. `wt/out` was rebuilt at `62685e9` (16:35–16:39). The search-S3 profile
  is created and seeded (51 clips + E3's index) — do not re-copy it; only the model copy (Next step (4)) is missing. Do not re-bisect the
  studio-cut-plan failure (Open problems).
- LS-r2 / LS-r3 (`373125a`, 11 new tests) are done; the ping loop (§9.3 1) PASSED at `373125a` (max gap 65.1 ms) — do not re-run it unless
  main-side search code changes. **The search-S3 profile now HAS the model** (`<profile>\ai-models\embeddings\multilingual-e5-small\`, copied
  from S1) and a built vector file (57 items) — step e's download-path check (§9.3 2, "no model" first) needs that model folder AND
  `<profile>\assets\.vidtsx\search\` removed first (or a fresh profile copy). `wt/out` = `373125a`; rebuild after any `src/` change.
  Kit: `S3\guard.ps1` (resources + not-rendering + our instance count), `launch-s3.sh`, `c-ping.mjs` (its clock prints UTC).
- LS-r4 / LS-r5 (`5796423`) and step d part 1 (`eebcaff`: the generate tools, the 1,515-row no-claim test, E3's answer tests rewritten, the
  prompt pins) are done — extend, don't redo. `wt/out` is still `373125a` (main changed since: rebuild before step e's live checks; the search-S3
  profile's vector file holds 57 items from before LS-r4 — the next build prunes it to 51).
- LS-r6 + `list_assets` §8.2 (`332ef1b`, 10 new tests + the per-mode header pins) — **step d is DONE**; extend, don't redo. `REUSE_NOTE` /
  `FORCE_HINT` / the prompt lines still say "(words + meaning; …)" about the tool in general — LS-r6 names only the headers; left as they are.
  `wt/out` is still `373125a`: rebuild before step e's live checks.
- Step e part 1 (`4337910`: the Settings row + hook, the Assets box hook / request / merge / marker, `library-search-text.ts`, the
  `ElectronAPI` members; 15 new unit tests) — extend, don't redo. **`wt/out` is still `373125a`** — rebuild before the click-through. The CDP
  hooks: `[data-library-search-row]`, `[data-library-search-choice]` (a native `<select>`), `[data-library-search-download]`,
  `[data-library-search-progress]`, `[data-library-search-state]`, `[data-library-search-error]`, `[data-library-search-marker]`.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 15:05–15:20 · builder #1 · ~45 · read the docs; step a part 1 (service + unit tests + benchmark harness), `3cb73df`.
- 2026-10-29 15:21–15:45 · builder #2 · ~35 · the fixture script + fixture (int16), benchmark test fixes, step a DONE, `2ffcc27`.
- 2026-10-29 16:00–16:25 · builder #3 · ~45 · step b (the engine, vector-sync, the gated live test green, the dtype fix, the build), `3c50783`.
- 2026-10-29 16:26–16:52 · builder #4 · ~60 · step c's code (IPC + settings + runtime + events, 23 tests), `62685e9`; the build; the profile +
  51-clip seed + ping kit prepared; the studio-cut-plan worktree failure bisected (not ours); the ping loop NOT run (hand-off on the call budget).
- 2026-10-29 16:51–17:05 · builder #5 · ~55 · LS-r2 (catalog 135,392,016 B / "135 MB" + test) and LS-r3 (before-delete hook → the runtime
  kills + awaits the engine child; 11 tests, red first), `373125a`; `wt/out` rebuilt; the live ping loop PASS (max gap 65.1 ms, build 57 / 57,
  first Smart query 40 ms, crash-tumble 4th); node_modules unchanged; **step c DONE**; the `presets/` (kind `data`) vector-count note raised.
- 2026-10-29 17:06–17:25 · builder #6 · ~50 · LS-r4 + LS-r5 (`5796423`, red first); step d part 1 — generate_sfx / generate_music on the search
  (§8.1 answer, the seam `tool-library-search.ts`), REUSE_NOTE / FORCE_HINT / prompt :31-32 pinned, the 1,515-row no-claim + nothing-fits test in
  both modes, E3's answer tests rewritten (`eebcaff`); found 3 more LS-r1-class suites; `list_assets` §8.2 left as the next step.
- 2026-10-29 17:27–17:35 · builder #7 · ~30 · LS-r6 (headers name what ran) + `list_assets(scope "library", query)` §8.2 (new
  `library-search-listing.ts`, `list-assets-library.test.ts`), red first, `332ef1b` — **step d DONE**; scouted step e's files (Next step);
  handed off at the step boundary (no build / launch; DRIVING, ui-automation-cdp and UI_SPEC not read).
- 2026-10-29 17:37–17:48 · builder #8 · ~45 · read the design in full, DRIVING, UI_SPEC (colour / components); step e part 1 — the Settings
  "Library search" row + download hook, the Assets box Smart search (hook, pure request + merge, marker), shared labels, `ElectronAPI`
  members; red first, `4337910`; tsc 25 / 10; handed off on the call budget before the rebuild + §9.3 2 / 3 click-through (ui-automation-cdp
  not read).
- 2026-10-29 17:50–17:58 · builder #9 · ~22 · read HANDOFF, the design in full, DRIVING, ORCHESTRATOR's rulings incl. LS-r7, the rerank seams
  (`library-search.ts` `applyRerank`, `types.ts` `LibraryReranker`, the runtime, `search-app.ts`, `llm-engine.ts`, `llm-handlers.ts:262-281`,
  S1's `d-prompt-template.txt`, the Assets hook / request / search bar, the Settings row); wrote LS-r7's 3 test files (UNCOMMITTED, not run —
  "In progress"); STOPPED by the coordinator for a machine shutdown (no build / launch / download / test run; ui-automation-cdp and UI_SPEC not
  read).
