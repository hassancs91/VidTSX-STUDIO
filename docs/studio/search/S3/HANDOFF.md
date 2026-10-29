# S3 — build library search (red first, in hand-off-sized steps)
status: IN PROGRESS (step a DONE as of `2ffcc27`; step b — the engine — next)

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

## Next step (ONE concrete instruction)

Step b, red first: write the failing tests, then `src/library-search-engine/` per design §3 / §5 / §7 — `types.ts` (the host ↔ child messages),
an `embedder.ts` (the transformers.js core: `allowRemoteModels = false`, `localModelPath` / `cacheDir` off node_modules, `local_files_only`,
`dtype: 'q8'`, mean + normalise, `queryText` / `passageText` from `prefixes.ts`, batches of 32 — node-importable so the gated test can use it
without a utilityProcess), `vector-store.ts` (the `<library root>/.vidtsx/search/vectors-<modelId>.json` file: header check → rebuild,
relPath + textHash keys, atomic `.tmp` + rename, cosine ranking), `worker.ts` (the utilityProcess child over both) and `search-engine.ts` (the
host as `src/content-safety-engine/safety-engine.ts`: lazy spawn, request ids, 5 s cold / 2 s warm timeouts rejecting with `'model loading'` /
a timeout reason, death → reject pending + respawn, 10 min idle unload) implementing `SemanticRanker`; the `library-search-worker` entry
beside `embedding-worker` in `electron.vite.config.mjs:31-32`; `src/main/services/library-search/vector-sync.ts`; the gated live test
(`VIDTSX_SEARCH_MODEL_DIR` set → re-embed the 51 clips + 1,505 prompts through `embedder.ts`, every vector's cosine vs the fixture ≥ 0.99,
the §9.1 thresholds on live vectors; skipped otherwise — run it once with the S1 model dir, then prove `node_modules` unchanged); and the
`src/embedding-engine/worker.ts:57-59` `dtype: 'q8'` fix + its test. Commit; then step b is DONE.

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
- (note) **Hasan's dev app is running** since 15:27 (main checkout, `--remote-debugging-port=9222`, his `%APPDATA%\VidTSX Studio` profile,
  6 `electron.exe` at 15:57) — not ours: never stop it, never run `electron-vite dev`; select our instance only by port 9292 / the search-S3
  profile path + `Name='electron.exe'` (DRIVING).

## Do-not-redo

- The service files and their 42 unit tests (`3cb73df`) — extend, don't rewrite.
- S1's tables are already transcribed as counts in `benchmark/s1-tables.ts` (checked against the reports' `table` fields).
- The fixture (`2ffcc27`): don't regenerate it unless item text / prefixes change (a changed textHash makes the benchmark run Basic and fail
  loudly). Regenerating needs only the command under "Verified"; it never downloads (S1's model dir, read-only).

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 15:05–15:20 · builder #1 · ~45 · read the docs; step a part 1 (service + unit tests + benchmark harness), `3cb73df`.
- 2026-10-29 15:21–15:45 · builder #2 · ~35 · the fixture script + fixture (int16), benchmark test fixes, step a DONE, `2ffcc27`.
