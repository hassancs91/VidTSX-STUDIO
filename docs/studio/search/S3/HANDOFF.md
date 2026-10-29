# S3 — build library search (red first, in hand-off-sized steps)
status: IN PROGRESS (steps a, b DONE as of `3c50783`; step c CODE DONE as of `62685e9` — its live ping-loop check (design §9.3 1) is next)

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

## Next step (ONE concrete instruction)

Finish step c with its live ping-loop check (design §9.3 1) on the prepared profile, `wt/out` as built at `62685e9` (no rebuild needed unless
`src/` changed): (1) resource guard + DRIVING's not-rendering check (see the 16:35 line under Verified for the method) and write a marker file
under `…\search\S3\step-c\` for the `node_modules` proof; (2) launch `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/search/S3/launch-s3.sh` with
Bash `run_in_background`; (3) `node D:/repos/VidTSX-STUDIO/.vidtsx-temp/search/S3/c-ping.mjs pre` (Studio root FIRST → the scratch
`…\search\S3\studio-root`, mkdir it first; prints the library root — must be `<profile>\assets` — the AI models folder from `settingsGet`, the
status before the model — must be Basic / not downloaded / vectors 0 — and reconciles the library); (4) copy S1's model folder
(`C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\multilingual-e5-small\`, 4 files, 135,392,016 B, read-only) into
`<that AI models folder>\embeddings\multilingual-e5-small\`; (5) `node …/c-ping.mjs run` (a ping every 50 ms over `libraryRootGet` from the
renderer through status → spawn + cold load + the 51-clip build → the first Smart query "things falling over"; writes
`…\search\S3\step-c\ping-report.json`); (6) stop our instance (Name='electron.exe' + the search-S3 profile path), check `<profile>\assets\.vidtsx\
search\vectors-multilingual-e5-small.json` exists, `%TEMP%\vidtsx-studio\library-search\tf-cache` was not created, and `find
D:/repos/VidTSX-STUDIO/node_modules -newer <marker>` prints nothing; (7) the max gap (bar ≤ 250 ms) + the first query's `ran` / `poolSize` /
`vectors` / top candidates into Verified, commit; step c is then DONE — step d (the agent tools) next.

## Open problems

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
- (note — for step e / the orchestrator) **`modelBytes` = the catalog's `sizeBytes` = 118,000,000** for multilingual-e5-small
  (`src/embedding-engine/model-registry.ts:87`, label "118 MB" — the ONNX file); the design §4 says the Settings row shows "the model's size
  (135 MB)" — the four files on disk are 135,392,016 B. Step c returns the catalog's number (the HANDOFF instruction); step e must either show
  118 MB or the catalog entry be corrected (a one-line data change that also changes the AI Models screen's label) — the orchestrator's call.
- (note) a deleted search model while the engine child has it loaded: the delete handler runs first, then the runtime pushes a Basic status; the
  child is not told to unload before the delete (on Windows an open handle could make `fs.rm` fail — not seen, not tested). Not in §9.
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

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 15:05–15:20 · builder #1 · ~45 · read the docs; step a part 1 (service + unit tests + benchmark harness), `3cb73df`.
- 2026-10-29 15:21–15:45 · builder #2 · ~35 · the fixture script + fixture (int16), benchmark test fixes, step a DONE, `2ffcc27`.
- 2026-10-29 16:00–16:25 · builder #3 · ~45 · step b (the engine, vector-sync, the gated live test green, the dtype fix, the build), `3c50783`.
- 2026-10-29 16:26–16:52 · builder #4 · ~60 · step c's code (IPC + settings + runtime + events, 23 tests), `62685e9`; the build; the profile +
  51-clip seed + ping kit prepared; the studio-cut-plan worktree failure bisected (not ours); the ping loop NOT run (hand-off on the call budget).
