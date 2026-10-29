# S1 — the spike: keywords vs local embeddings vs hybrid vs the LLM pick, on E3's labelled set (no product code)
status: IN PROGRESS — builder #2 on (b) the embeddings (MiniLM + (c) RRF done; bge-small, me5-small, me5-base downloading)

> Branch `library-search`, worktree `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt` (paths below are relative to it).
> The orchestrator's state: `docs/studio/search/ORCHESTRATOR.md` ("Answers in force" binds this part).
> **No `src/` change in S1.** The only tree files S1 writes are this HANDOFF.md, `LOG.md` beside it and
> `docs/studio/search/S1-spike-report.md`.

## Goal (Hasan's S1 text, verbatim)

S1 — THE SPIKE (no product code). A benchmark kit (scratch, outside the tree) over the labelled set E3 already
produced: the corpus rows (src/main/services/library/sound-match-corpus*.test.ts + -rows.ts, 1,073 rows over
the 51-clip fixture sound-match-corpus.fixture.ts) and the verifier probe files
(C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\r3\, r4\, r5\ — incl. j-falling.txt, the "sparkling" /
"swooshing" / "quiet" sets), plus ~30 new rows of your own written by plain meaning (synonyms, scene
descriptions, and 10 Arabic prompts, e.g. "صوت زجاج يتكسر" → break-glass-crack). Candidates: (a) the
keyword fill at c5a6124 (baseline); (b) embeddings with 3–4 catalog models, item text = name + category +
tags + description, query = the prompt (use each model's query / passage prefixes if it has them); (c)
hybrid keywords + embeddings by reciprocal-rank fusion; (d) the LLM pick: the keyless claude-subscription
choosing from the top-20 of the best retrieval AND from the full 51-clip list (≤ 40 model calls in total —
batch rows per call); (e) optional: a small cross-encoder reranker if transformers.js runs one from an
ONNX repo without a new package (a new catalog entry, first-use download). Measure recall@1/@3/@10/@20,
MRR, wrong-confident rate for the picks, cold load and warm query p50 / p95 on THIS laptop, model size,
memory, indexing time for the 51 clips and for a synthetic 2,000-item library. Model downloads go to a
scratch / isolated-profile folder (state each size first; check disk). Write
docs/studio/search/S1-spike-report.md with the tables and a recommendation by this rule: Smart's default
model = the smallest whose recall@20 is within 2 points of the best and warm p95 ≤ 50 ms (prefer a
multilingual model if within 3 points); the pick = the assistant over the top-N where an LLM is in the loop.
STOP and ask me if no embedding model beats the keyword baseline on recall@10 by a clear margin, or if the
numbers point to a different design than the one above.

**Exit (orchestrator):** `docs/studio/search/S1-spike-report.md` committed, every number in it from a report file
of the kit (named in the report), with: the labelled set's composition (rows per source file, how each probe
file's rows were labelled, what was excluded and why); per candidate the recall@1/@3/@10/@20 and MRR overall AND
per source file (S2 sets per-file thresholds from these); the wrong-confident rate of the picks; the
timing / size / memory / indexing table; the recommendation by Hasan's rule, or a `status: BLOCKED` naming which
STOP condition fired, with the numbers.

## Plan context (facts the orchestrator checked at `906273c`)

- **Why:** E3's keyword matcher (`src/main/services/library/sound-match.ts` 181, `-words.ts` 211, `-vocab.ts` 90) cannot
  tell which word carries the sound and has no synonyms; fix round 4 made the tool show up to three labelled candidates
  (`sound-answer.ts` 96 + `sound-answer-words.ts` 39 → `agent-tools/sound-reuse.ts` 95), recall improved, but retrieval
  still makes confident wrong claims. E3 verifier round 5's findings are the motivating cases (E3 HANDOFF → Open problems →
  "Verifier round 5", `docs/studio/end-to-end/E3/HANDOFF.md:1996-2045`): **F5a** "a sparkling screen" → `[matched]
  power-down 0.53` first (right: `pop-reveal` / `sparkle-soft`); **F5b** "things falling over" / "something falling" →
  three confident 0.60 wrong matches, right `crash-tumble` ("objects toppling over and clattering") scores 0; **F5c** "a
  door / photo / screen / deep swooshing" → a confident stranger first. Verifier round 4: **F4** "a cracked screen" →
  `power-down` (right `break-glass-crack`), "a scribbled note" → `chime-reward` (right `pencil-scribble`) (`:2183-2249`).
- **The labelled set.** Corpus row shape and conventions: `sound-match-corpus-rows.ts:1-22` — `'a|b'` = the first must be
  one of these; `'∅'` = the library lacks the sound (no confident match); `'a|∅'` = either; `'*'` = anything; `not` = never
  offered; `music` = a `generate_music` row. Row files: `sound-match-corpus.test.ts` (the original 150 rows, its own
  rows), `sound-match-corpus-r3-{inflections,ordinary,placement,senses}.test.ts`, `sound-match-corpus-r4-{frames,ordinary}.test.ts`
  (the last two use `describeAnswerCorpus` with `edge` notes). The fixture `sound-match-corpus.fixture.ts` = all 51
  catalog clips (45 sfx + 6 music) copied from a real imported library (relPath, kind, tags, description,
  `audio.category`, duration, `usedIn` count). Shared clip groups (W, IMPACT, CRASH, …) are at `-rows.ts:31-48`.
  "1,073 rows" is the E3 records' count (builder #16's `catalog-order-fix4.txt`) — recount and say so.
- **The probe files (read-only; copy what you need into your kit):** `C:\Users\hasan\AppData\Local\vidtsx-e2e\E3-verify\`
  `r3\` (`b-probes.txt`, `c-probes2.txt`, `c-probes3.txt`), `r4\` (`g-probe.txt`, `c-ordinary.txt`, `f-probe.txt`),
  `r5\` (`j-falling.txt`, `c-ordinary.txt`, `d-stopword.txt`, `i-nine.txt`, `e-realindex.txt`, `b-broad-flagged.txt` —
  the "sparkling" / "swooshing" / "quiet" sets live in r5's broad / flagged files and E3 HANDOFF's round-5 text). Many
  rows in the broad files are machine-made inflections ("a softed screen", "longed"): label by PLAIN MEANING only the
  phrasings a person would write; put the nonsense ones in an "excluded" count with the reason. Where a file carries the
  verifier's own verdict, use it; where you label yourself, say so per row in the kit's labelled-set file.
- **~30 new rows of your own** by plain meaning: synonyms ("objects toppling", "a clatter of things"), scene descriptions
  ("the moment the hero's phone screen shatters"), and **10 Arabic prompts** (e.g. "صوت زجاج يتكسر" → `break-glass-crack`).
  Mark them as a separate source file in every table.
- **(a) the keyword baseline at `c5a6124`:** `rankLibrarySounds(prompt, entries, { limit: <all> })` (`sound-match.ts`) →
  `selectSoundAnswer(ranking, prompt)` (`sound-answer.ts`) = the up-to-three labelled rows the assistant sees today
  (`[matched]` coverage ≥ 0.5 = "confident"); for recall@10 / @20 use the matcher's full candidate order (matches, then
  the nearest by coverage) and SAY exactly how you ordered it. Import the real modules (your kit runs vitest or node on
  the worktree's TS — the E3 kits used a scratch vitest config with the worktree's aliases; see
  `.vidtsx-temp\end-to-end\E3\` for `vitest.e3*.config.ts` / drivers you may copy).
- **The embedding engine (in the app):** `src/embedding-engine/worker.ts` — `pipeline('feature-extraction', modelPath, {
  local_files_only: true })` (:57-59), **mean pooling always** (:77-80), `env.allowRemoteModels = false` (:50), in a
  `worker_threads` Worker (`embedding-engine.ts:25-34`). Catalog `src/embedding-engine/model-registry.ts:17-169`: 8 models, each
  `config.json`, `tokenizer.json`, `tokenizer_config.json`, `onnx/model_quantized.onnx` from `https://huggingface.co/{repo}/resolve/main/{file}`
  (`getHfFileUrl` :9-11): all-MiniLM-L6-v2 23 MB (en) · bge-small-en-v1.5 33 MB (en) · gte-small 33 MB (en) ·
  multilingual-e5-small 118 MB · bge-base-en-v1.5 110 MB · nomic-embed-text-v1.5 137 MB · multilingual-e5-base 278 MB ·
  bge-m3 568 MB (multilingual) — the labels are the catalog's; measure the real bytes. In-app the models live in
  `getEmbeddingModelsDir()` = `{aiModelsFolder}/embeddings/<id>` (`src/main/services/embedding-models.ts:10-23`); IPC
  `embedding:*` (`src/shared/ipc/channels.ts:323-329`, handlers `src/main/ipc/embedding-handlers.ts`).
- **Prefixes / pooling:** e5 models want `query: ` / `passage: `; bge-*-en-v1.5 a query instruction ("Represent this
  sentence for searching relevant passages: ") and CLS pooling officially; nomic `search_query: ` / `search_document: `.
  The app's worker always mean-pools: measure with the app's pooling (that is what S3 would ship unless S2 changes the
  worker) and, where the model card says CLS, also CLS — report both.
- **Installed packages (read-only, the main checkout's `node_modules`):** `@huggingface/transformers` 4.0.1,
  `onnxruntime-node` 1.24.3, `onnxruntime-web` 1.25.0-dev. A kit under `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\`
  resolves them by walking up. **TRAP:** transformers.js's default cache dir is inside its own package folder in
  `node_modules` — set `env.cacheDir` / `env.localModelPath` to your scratch folder (or download the four files yourself
  and load with `local_files_only: true`, `env.allowRemoteModels = false`), and confirm afterwards that NOTHING under
  `D:\repos\VidTSX-STUDIO\node_modules` changed (e.g. no `.cache` folder appeared). A cross-encoder for (e) would use
  `AutoTokenizer` + `AutoModelForSequenceClassification` from the same package (e.g. an `Xenova/ms-marco-MiniLM-L-6-v2` or
  `Xenova/bge-reranker-base` ONNX repo) — only if it runs with no new package; state its size first.
- **(d) the LLM pick — through the APP's keyless `claude-subscription` only.** Build the worktree's own `out/`
  (`docs/studio/end-to-end/DRIVING.md` "Track E" step 1), make the isolated profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\search-S1\profile`
  (copy of `profiles\source\profile` WITHOUT `settings\settings.db*`; the app creates a fresh one on first launch — never
  read it), launch with CDP **9290** (DRIVING "Track E" step 2; kits `.vidtsx-temp\end-to-end\E1\launch.sh`,
  `restore.ps1`, `cdp.mjs`), set the Studio root FIRST to a scratch root, then call `window.api.llmGenerate({ prompt,
  providerId: 'claude-subscription' })` (`src/preload/api/llm.ts:26-27`) from a FILE-based CDP driver. Probe once with
  "Say OK" (that probe counts in the 40). **≤ 40 model calls in total** (+1 retry each on an API error): batch rows per
  call (e.g. 15–25 rows per call, a fixed stratified sample across source files, the same rows for both conditions);
  two conditions — the top-20 of the best retrieval, and the full 51-clip list; the model may answer "none fits" (that is
  how ∅ rows are scored); a "pick" = its first choice; **wrong-confident** = a pick that is not an allowed clip (on a ∅
  row: any pick). Record the exact prompt template in the report. Stop your app instance when done (match the profile
  path + `Name='electron.exe'`).
- **Measures:** recall@1/@3/@10/@20 = an allowed clip among the first k (rows with a named clip; `'x|∅'` rows count as
  named; `'∅'` rows are scored only as "no wrong confident claim" for the picks and the keyword `[matched]` first; `'*'`
  rows excluded); MRR over the named rows; per candidate overall AND per source file; wrong-confident rate for the keyword
  baseline (a `[matched]` first not allowed) and for the LLM picks. Timing on THIS laptop: cold load (process start →
  first embedding), warm query p50 / p95 over ≥ 200 queries (one query embedding + cosine over the 51 vectors — and over
  2,000), model bytes on disk, RSS before / after load, indexing time for the 51 clips and for a synthetic 2,000-item
  library (synthetic texts are fine — timing only). Say whether timings ran under plain `node` or Electron's node
  (`ELECTRON_RUN_AS_NODE=1 D:/repos/VidTSX-STUDIO/node_modules/electron/dist/electron.exe`) — the in-app worker runs under
  Electron; measuring both is better.
- **The recommendation rule (Hasan):** Smart's default model = the smallest whose recall@20 is within 2 points of the
  best and warm p95 ≤ 50 ms (prefer a multilingual model if within 3 points); the pick = the assistant over the top-N where
  an LLM is in the loop. **STOP (status: BLOCKED) if** no embedding model beats the keyword baseline on recall@10 by a clear
  margin (say what margin you saw), **or** the numbers point to a different design than keywords + local embeddings for
  recall + the assistant's pick.
- **Resources (13:38):** C: 51.3 GB, D: 41.8 GB, memory headroom 42.3 / 99.7 GB. Before each download / copy / launch:
  check C: free and memory commit headroom (C: ≥ 3 GB and C: + headroom ≥ 6 GB) and write the numbers here. Kit:
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\` (drivers, small reports); models + big outputs:
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\` (state each model's size before downloading it; downloads only
  from the catalog's HF repos or an ONNX reranker repo named in this file).

## Done (file:line, commit hashes)

Builder #1, 2026-10-29 13:42–13:55. Everything below is kit work in scratch (`K` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\`);
no `src/` change. The tree was clean at `3c0d213` before this hand-off's commit, which adds only this file and `LOG.md`.

1. **The kit's matcher bundle:** `K\build-kit.cjs` esbuild-bundles (main checkout's `node_modules\esbuild` 0.25.0, read-only)
   the WORKTREE's `sound-match.ts` + `sound-answer.ts` + fixture + the seven corpus row files into `K\out\corpus.cjs`, with
   `vitest` stubbed so each file's `it.each(ROWS)` hands over its rows WITH the real shared constants (W, IMPACT, CRASH…).
   Exports `rankLibrarySounds`, `soundClassOf`, `selectSoundAnswer`, `CONFIDENT_COVERAGE`, `CORPUS_LIBRARY`, `corpusFiles()`.
   **Recount: 1,073 rows** = 150 + 194 + 132 + 129 + 204 + 67 + 197, which matches the E3 records (`K\build-kit.log`).
2. **Probe survey:** `K\survey-probes.cjs` → `K\probe-parse.json`. **Every prompt of r3 (`b-probes` 513, `c-probes2` 141,
   `c-probes3` 41) and r4 (`g-probe` 32, `c-ordinary` 247, `f-probe` 44 + 2 non-prompts) is already a corpus row.** Only
   r5 adds rows. Verdicts exist only in r5 `c-ordinary` ("right X", used verbatim) and r5 `b-broad-flagged` ("right X" =
   the frame generator's target clip).
3. **S1's labels:** `K\s1-labels.json` holds my plain-meaning labels for `j-falling` (12), `i-nine` (6 kept of 17),
   `e-realindex` (2), `d-stopword` (per verb, 35 verbs; frame rule inside), the broad named-set rule
   (sparkl / swoosh / quiet), the exclusions with reasons, and **35 own rows (25 en incl. 1 `∅` + 1 music; 10 ar incl. 1 music)**.
4. **THE labelled set:** `K\build-labelled-set.cjs` → `K\labelled-set.json` (each row: prompt, expected, named[], hasNull,
   kind named / null / any, cls, min, source, labelledBy) and `K\reports\labelled-set-summary.txt` (the per-source
   composition and exclusions table, verbatim for the report). **1,565 rows: 1,375 named, 140 `∅`, 50 `*` (never scored);
   2,899 excluded**. The exclusions: broad cross-products outside the named sets 2,674; broad named-set nonsense 115;
   d-stopword particle cross-products 95 + 1 ungrammatical; i-nine nonsense inflections 11; 3 non-prompts.
5. **Scoring library:** `K\eval-lib.cjs`. It has `loadSet()` (drops `*`), `poolOf(row)` (the matcher's `isCandidate`
   class + min-length filter, for EVERY candidate), `metricsOf` / `bySource` (R@1/3/10/20, MRR over named rows,
   wrong-confident over pick rows split named / `∅`), and `writeReport(base, name, results)` → `K\reports\<base>.json|.md`.
   The definitions are in its header comment.
6. **Candidate (a):** `K\run-a-keywords.cjs` → `K\reports\a-keywords.md|json`. The ordered list is the answer's ≤ 3 rows
   in `selectSoundAnswer` order, then the other confident matches in rank order, then the rest by coverage. Clips that
   score 0 are not ranked. The pick is the answer's first, confident when its label is `[matched]`. A second view (a′,
   the matcher's own order) is in `K\reports\a2-keywords-matcher-order.md`. **(a) ALL (1,515 scored rows): R@1 83.9 ·
   R@3 90.8 · R@10 91.8 · R@20 91.9 · MRR 0.874 · wrong-confident 100 / 1,515 = 6.6 % (88 named, 12 `∅`)**, from
   `a-keywords.md`. The seven corpus files score 81.5–100 R@1 and 100 R@10. The weak spots: r5 `d-stopword` R@10 46.0,
   `j-falling` 33.3, broad named sets R@1 3.8 (wrong-confident 25 / 26), `S1-own-ar` 0.0 at every k. `S1-own-en` scored
   100 (my English synonyms share a tag word too often; see Open problems).

Resources at 13:44: C: 51.3 GB free, D: 41.8 GB, memory commit headroom 42.4 / 99.7 GB. No download, copy or launch
was made yet.

Builder #2, 2026-10-29 13:55– (step (b) the embeddings).

7. **Resource guard 13:55 (before the downloads):** C: 51.3 GB free, D: 41.7 GB, memory commit 60.1 / 99.7 GB → headroom
   39.6 GB (C: + headroom 90.9 ≥ 6); 0 `electron.exe` running.
8. **Model sizes, stated BEFORE downloading** (HEAD requests on the catalog URLs `https://huggingface.co/{repo}/resolve/main/{file}`,
   `x-linked-size` / `content-length`; the four catalog files each): `Xenova/all-MiniLM-L6-v2` 23,685,047 B (onnx 22,972,370) ·
   `Xenova/bge-small-en-v1.5` 34,726,871 B (onnx 34,014,426) · `Xenova/multilingual-e5-small` 135,392,016 B (onnx 118,308,185 +
   tokenizer.json 17,082,730) · `Xenova/multilingual-e5-base` 295,731,426 B (onnx 278,647,662 + tokenizer.json 17,082,660). Total
   489.5 MB, into `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\<id>\` (same file layout as the catalog).
   Downloads: curl from the catalog URLs only (~0.3 MB/s per stream; four files failed once on a DNS error for
   `us.aws.cdn.hf.co` and were re-fetched with `--retry`).
9. **FINDING — the app's worker options cannot load a catalog model.** `pipeline('feature-extraction', <dir>, { local_files_only:
   true })` (worker.ts:57-59) under transformers.js 4.0.1 asks for the fp32 `onnx/model.onnx`; the catalog downloads only
   `onnx/model_quantized.onnx` → "file was not found locally at …/onnx/model.onnx". The kit loads with `dtype: 'q8'` added
   (= `model_quantized.onnx`) and says so in every (b) report (`loadMode`). S2/S3 must add `dtype: 'q8'` to the worker (or
   download the file the default asks for). Everything else is the app's way (absolute model dir, `local_files_only`,
   `allowRemoteModels = false`, the onnxruntime DLL PATH prepend).
10. **Kit additions:** `K\eval-lib.cjs` now has the subtotals **CORPUS (7 files)** and **HELD-OUT (r5 + S1-own)** right under
    ALL in every table, `itemText(e)` (id with hyphens as spaces + category + tags + description, joined by ". "), and
    `floorStudy` / `floorMd` (top-1 score distribution on ∅ vs named rows, named split top-1 right / wrong, the Youden floor,
    the floor at named p05 and at ∅ p90; rows with no top-1 are left out and counted). `K\run-b-embeddings.cjs <id> <mean|cls>`
    → `K\reports\b-<id>-<pooling>.md|json` + on C: `out\b-<id>-<pooling>-full.json` (full rankings) and `out\emb-<id>-<pooling>.json`
    (vectors). `K\run-c-hybrid.cjs <id> <pooling> [K]` → `K\reports\c-rrf<K>-<id>-<pooling>.md|json` (RRF K = 60 over (a)'s list
    recomputed + (b)'s full ranking; floors on the fused top-1 score AND the fused top-1's cosine).
11. **(a) re-run with the subtotals** (`K\reports\a-keywords.md`): CORPUS R@10 100.0 · **HELD-OUT R@1 51.3 · R@10 73.4 · R@20 73.6 ·
    MRR 0.612 · wrong-confident 96 / 492 (19.5 %)**. Its top-1 coverage on ∅ vs named rows is in the same file.
12. **(b) all-MiniLM-L6-v2 mean** (`K\reports\b-all-MiniLM-L6-v2-mean.md`): ALL R@10 97.7 · R@20 99.1 · MRR 0.874; CORPUS R@10 99.8;
    HELD-OUT R@10 93.2; Arabic R@10 30.0. **(c) RRF60 + MiniLM** (`K\reports\c-rrf60-all-MiniLM-L6-v2-mean.md`): ALL R@10 99.3,
    HELD-OUT R@10 97.9.

## Verified (exact commands + outputs)

- `cd K; node build-kit.cjs` → seven lines + `TOTAL 1073 rows in 7 files; library 51 clips` (`K\build-kit.log`).
- `node survey-probes.cjs noverdict` → per file `{"parsed","dupCorpus",…}`. r3 / r4: `kept 0` except `r4/f-probe`
  `kept 2` (both non-prompts). r5: `j-falling` 12, `c-ordinary` 176, `d-stopword` 332, `i-nine` 17, `e-realindex` 2,
  `b-broad-flagged` 2,815.
- `node build-labelled-set.cjs` → `labelled-set.json — 1565 rows (1375 named, 140 '∅', 50 '*'), 2899 excluded`.
- `node run-a-keywords.cjs` → the two tables above (`ALL | 1515 | 1375 | 140 | 83.9 | 90.8 | 91.8 | 91.9 | 0.874 | 100/1515 (6.6 %) | 88 | 12`).
- **`node_modules` baseline (BEFORE any transformers.js use):** `D:\repos\VidTSX-STUDIO\node_modules` LastWrite
  2026-10-16 12:57:48. `@huggingface\transformers` 2026-07-07 10:32:45 (children dist / src / types / LICENSE /
  package.json / README.md, all 2026-07-07, no `.cache`). `node_modules\.cache` EXISTS, is EMPTY, LastWrite
  2026-10-13 11:10:47 (it predates S1). `esbuild` 2026-07-07. Re-check these after (b) and compare.
- Worktree `git status --short` empty at `3c0d213` before this commit.
- **`node_modules` re-check after transformers.js ran (builder #2, 14:03, after the MiniLM (b) runs):** `node_modules`
  2026-10-16 12:57:48 · `@huggingface\transformers` 2026-07-07 10:32:45 with the same six children and dates (no `.cache`) ·
  `node_modules\.cache` exists, 0 items, 2026-10-13 11:10:47 · `esbuild` 2026-07-07 10:32:15 · `onnxruntime-node` 2026-07-07
  10:33:53 · `Get-ChildItem node_modules -Recurse -File | ? LastWriteTime -gt '2026-10-29 13:55'` → nothing. Unchanged. (The
  scratch `tf-cache` folder was never even created: with `local_files_only` nothing is cached.)

## Next step (ONE concrete instruction)

Run candidate (b), the embeddings. Do the resource guard first and write the numbers here. Then HEAD-request the four
catalog files (`model-registry.ts` `getHfFileUrl`) of **all-MiniLM-L6-v2, bge-small-en-v1.5, multilingual-e5-small and
one more** (suggested: multilingual-e5-base, so a bigger multilingual model is in the race; bge-m3 568 MB only if p95
allows). Write each model's real bytes here BEFORE downloading. Download into
`C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\<id>\` (catalog URLs only). Load them with
`@huggingface/transformers` from the main checkout's node_modules using `env.allowRemoteModels = false`,
`env.localModelPath` and `env.cacheDir` set to that scratch folder, and the same `pipeline('feature-extraction', …,
{ local_files_only: true })` options as `src/embedding-engine/worker.ts:45-80` (read it first). Write
`K\run-b-embeddings.cjs` on `eval-lib.cjs`:
- item text = id with hyphens as spaces + category + tags + description;
- the query = the prompt, with each model's prefixes;
- the pool = `poolOf(row)`, ranked by cosine;
- mean pooling, plus CLS for the bge models;
- no pick for (b);
- one report per model and pooling: `K\reports\b-<id>-<pooling>.md|json`.

**Add a HELD-OUT subtotal** (r5/* + S1-own-*) to `bySource` and re-run (a) so every table has it. Then re-check the
`node_modules` baseline above. Then the hybrid (c) (RRF over (a)'s list and the best (b)), the timing table, (d), the
optional (e), and the report.

## Open problems

1. **The corpus favours (a) by construction** (heads-up for the STOP test, not a stop yet). The seven corpus files are
   the keyword matcher's own acceptance bar: E3 tuned the matcher until they passed, so (a) scores 100 R@10 there and
   91.8 overall. An embedding model may beat (a) clearly on the HELD-OUT rows (r5 + S1-own: (a) R@10 is 46.0 on
   `d-stopword`, 33.3 on `j-falling`, 0 on Arabic) but not overall. Report overall AND held-out for every candidate. If
   the two readings of "beats the keyword baseline on recall@10 by a clear margin" disagree, that is Hasan's call:
   write both numbers and return `status: BLOCKED`.
2. `S1-own-en` turned out keyword-easy (100 at every k). If the next builder wants harder synonym rows, add them to
   `s1-labels.json` `own` and rebuild before ANY candidate runs (the same rows for all candidates). Otherwise leave it.
3. The labels widened from the broad file's single "right" (sparkle → `sparkle-soft|pop-reveal`, swoosh → the W group)
   and the per-verb `d-stopword` labels are mine (labelledBy `S1 …` in every row). The report must say so.

## Do-not-redo

- The corpus recount (1,073) and the fact that r3 / r4 add no row: settled (`K\build-kit.log`, `survey-probes.cjs`).
- `K\out\corpus.cjs` is the matcher at the worktree's code. Rebuild it only if the worktree's `src/main/services/library/`
  changes (it should not in S1).
- Do not hand-label the 2,674 broad cross-products. They are excluded by rule, with the reason.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 13:42–13:55 · builder #1 · ~33 calls · the kit bundle, the probe survey, the labelled set (1,565 rows /
  2,899 excluded), candidate (a) and its reports; the `node_modules` baseline; no download, launch or model call (0 / 40 used).
