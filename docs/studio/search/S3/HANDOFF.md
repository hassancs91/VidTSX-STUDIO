# S3 — build library search (red first, in hand-off-sized steps)
status: IN PROGRESS (step a part 1 done; the fixture script next)

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

## Verified (exact commands + outputs)

All from the worktree root, as of `3cb73df`:

- `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/library-search --exclude '**/benchmark/**'` →
  `Test Files 6 passed (6) · Tests 42 passed (42)`.
- `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` → 26 `error TS` lines (baseline);
  `-p tsconfig.node.check.json` → 10 (baseline). None in the new files.
- `git diff 7967c6f --stat -- src/main/services/library/sound-match.ts src/main/services/library/sound-match-words.ts
  src/main/services/library/sound-match-vocab.ts` → empty.
- Resources at 15:14: C: 51.3 GB free, D: 41.5 GB, memory commit headroom 30.5 GB.
- **RED by design at this hand-off:** `src/main/services/library-search/benchmark/library-search-benchmark.test.ts` (ENOENT on
  `benchmark/fixtures/labelled-set.json` — the fixture + its generator are the next step).

## Next step (ONE concrete instruction)

Write `scripts/library-search-fixture.mjs` (esbuild-bundle an entry exporting `CORPUS_LIBRARY`, `semanticItemOf`, `queryText` /
`passageText`, `runBenchmark` / `recallTable` / `benchDeps`, `encodeVector` / `decodeVector` / `cosine`, `asCounts` / `S1_C_RRF60_E5_SMALL`
into a scratch dir — precedent `scripts/import-sfx-library.mjs:135`; load `@huggingface/transformers` with `env.allowRemoteModels = false`,
`env.localModelPath` = the model's parent, `env.cacheDir` = scratch under `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S3\`,
`pipeline('feature-extraction', <S1 model dir>, { local_files_only: true, dtype: 'q8' })`, the onnxruntime DLL PATH prepend as in
`S1\run-b-embeddings.cjs`; embed `passageText(itemText(e))` for the 51 clips and `queryText(prompt)` for the 1,505 unique scored prompts,
batches of 32, mean + normalize; run the benchmark on float32, then int8 — keep int8 iff its counts equal `S1_C_RRF60_E5_SMALL`, else int16
(and check that too); write `benchmark/fixtures/labelled-set.json` (`{rows}` = S1's 1,565 rows, `excluded` dropped) and the vector file with
`check` = {precision, tableEqualsS1, rowsTop20DifferFromS1 (vs S1's `perRow`), rowsTop20DifferFromFloat32}; a report .md to the scratch dir);
run it, make the benchmark test green, commit; then step a is DONE.

## Open problems

- (note, not blocking) audio requests WITHOUT a sound class use the generic coverage ranking (see `keyword-retriever.ts`); the design names only
  "audio → E3's matcher" and "image / video → coverage". Step d's `list_assets(kind: audio)` will rank that way unless S4 / Hasan say otherwise.

## Do-not-redo

- The service files and their 42 unit tests (`3cb73df`) — extend, don't rewrite.
- S1's tables are already transcribed as counts in `benchmark/s1-tables.ts` (checked against the reports' `table` fields).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 15:05–15:20 · builder #1 · ~45 · read the docs; step a part 1 (service + unit tests + benchmark harness), `3cb73df`.
