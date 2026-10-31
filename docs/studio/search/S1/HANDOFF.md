# S1 — the spike: keywords vs local embeddings vs hybrid vs the LLM pick, on E3's labelled set (no product code)
status: DONE — builder #4, 2026-10-29: (e) run, the report `docs/studio/search/S1-spike-report.md` written, STOP judged NOT fired (R@10 beats (a) clearly on ALL +5.7…+6.9 and HELD-OUT +19.8…+22.6); recommendation = multilingual-e5-small in an RRF60 hybrid with keywords + the assistant's pick over the top-20 (25 / 40 model calls used in all)

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

Builder #2, 2026-10-29 13:55–14:22 (step (b) the embeddings, plus (c) and the timing table). Commits `42f8d43` (progress) and
`3eb1772` (hand-off), docs only: as of `3eb1772` the worktree is clean and `git diff 5de37df..3eb1772 -- src/` is empty.

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
13. **(b) multilingual-e5-small mean** (`K\reports\b-multilingual-e5-small-mean.md`): ALL R@1 83.6 · R@10 98.7 · R@20 99.8 · MRR
    0.886; CORPUS R@10 99.9; HELD-OUT R@10 96.0 · R@20 99.3; Arabic R@10 90.0 · R@20 100.0. Youden floor on top-1 cosine 0.825
    (named kept 79.2 %, ∅ kept 12.7 %) — e5 cosines sit in a narrow high band. **(c) RRF60 + me5-small**
    (`K\reports\c-rrf60-multilingual-e5-small-mean.md`): ALL R@1 87.4 · R@10 99.3 · R@20 99.9 · MRR 0.917; CORPUS R@10 100.0;
    HELD-OUT R@10 97.9 · R@20 99.8.
14. **(b) bge-small-en-v1.5** (query instruction on): mean (`K\reports\b-bge-small-en-v1.5-mean.md`) ALL R@10 97.6 · R@20 98.7 ·
    MRR 0.894, HELD-OUT R@10 93.9 · R@20 96.0; CLS (`…-cls.md`) ALL R@10 97.5 · R@20 99.0, HELD-OUT R@10 93.2 · R@20 96.9; Arabic
    R@20 50.0 both. **(c) RRF60 + bge-small**: mean ALL R@10 98.8 / HELD-OUT 96.2; CLS ALL 98.9 / HELD-OUT 96.5
    (`K\reports\c-rrf60-bge-small-en-v1.5-{mean,cls}.md`).
15. **Timing kit** `K\run-t-timing.cjs <id> <pooling>` (plain node 22.14.0 and `ELECTRON_RUN_AS_NODE=1` Electron 41.0.2 / node
    24.14.0; main thread; index vectors as `Float32Array`; definitions in its header) → `K\reports\t-<id>-<pooling>-<node|electron>.md|json`.
    Warm p95 per query over 51 clips (node / electron, ms): MiniLM 2.49 / 2.92 · bge-small mean 7.5 (node) · bge-small CLS 6.37 /
    7.86 · me5-small 7.95 / 6.33; over 2,000: MiniLM 7.85 / 8.04 · bge-small CLS 15.05 / 16.09 · me5-small 15.24 / 15.88. Indexing
    2,000 synthetic items (batches of 32): MiniLM ~21.8 s · bge-small 29.7–35.8 s · me5-small 48.6–50.8 s. RSS loaded: MiniLM
    ~128 MB · bge-small ~146 MB · me5-small 413–452 MB. (A first MiniLM run with plain `tolist()` arrays gave 2,000-scan p50 23 ms;
    replaced by the `Float32Array` run, the reports hold only the latter.)
16. **(b) multilingual-e5-base mean** (`K\reports\b-multilingual-e5-base-mean.md`; files 278,647,662 + 17,082,660 + 686 + 418 B,
    the onnx resumed with `curl -C -` after a 600 s cap): ALL R@1 79.3 · R@10 97.8 · R@20 99.6 · MRR 0.859; CORPUS R@10 99.7; HELD-OUT
    R@10 93.6 · R@20 99.3; Arabic R@10 90.0 · R@20 100.0 — not better than me5-small at 2.2× the bytes. **(c) RRF60 + me5-base**: ALL
    R@10 98.4, HELD-OUT 94.8. Timing (node, `K\reports\t-multilingual-e5-base-mean-node.md`): 282 MB on disk, cold 2,036 ms, RSS
    loaded 609 MB, index 51 2.3 s, index 2,000 107.5 s, warm p95 13.14 ms (51) / 29.23 ms (2,000); the Electron run is in
    `…-electron.md`. bge-m3 (568 MB) was NOT downloaded: me5-base already shows the bigger multilingual model does not help here.
17. **Where the race stands (for the report; the STOP rule is judged only after (d) / (e) and the report):** best retrieval =
    **(c) RRF60 + me5-small** — ALL R@10 99.3 / R@20 99.9; HELD-OUT R@10 97.9 / R@20 99.8 (`K\reports\c-rrf60-multilingual-e5-small-mean.md`).
    R@10 best (b) vs (a): ALL 98.7 vs 91.8 (+6.9) · CORPUS 99.9 vs 100.0 (−0.1, (a) is 100 by construction) · HELD-OUT 96.0 vs 73.4
    (+22.6) (me5-small; `b-multilingual-e5-small-mean.md`, `a-keywords.md`). Hasan's rule, first reading: every (b) model's ALL
    R@20 is within 2 points of the best (me5-small 99.8; MiniLM 99.1, bge CLS 99.0, me5-base 99.6) and all warm p95 ≤ 50 ms; the
    smallest is MiniLM (22.6 MB) but me5-small is multilingual and within 3 points (it IS the best, and the only ones that read
    Arabic are the two e5s) → me5-small, unless the report reads the rule differently.

Builder #3, 2026-10-29 14:24–14:40 (step (d) the LLM pick). Docs commit: see "Agents so far" (this hand-off's commit); no `src/` change.

18. **App for (d):** resource guard 14:25 (C: 50.8 GB, D: 41.7 GB, commit headroom 42.3 / 99.7 GB, 0 `electron.exe`, ports 9222 /
    5173 / 9290 free) → the worktree's `out/` built (DRIVING "Track E" step 1, log `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\logs\build.log`,
    rc 0, 14:25:43–14:28:09) → 14:26:58 guard (C: 50.8, headroom 38.4) → profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\search-S1\profile`
    = robocopy of `profiles\source\profile` with `/XF settings.db*` (rc 1 = copied; 0 `settings.db*` in the copy before launch; the
    app's fresh one was never read) → launch `K\launch-d.sh` (CDP 9290, no Vite server) → `K\d-cdp.mjs root` FIRST:
    `studioRootSet` → `studioRootGet` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\studio-root` (empty `projects\`).
    Stopped 14:35:59 (4 `electron.exe` matched by the profile path + Name; 0 left).
19. **The (d) kit:** `K\d-build-sample.cjs` → `K\d-sample.json` (the sample, its strata, the 12 batches of row ids), `K\d-prompt-template.txt`
    (THE EXACT PROMPT TEMPLATE, both conditions — copy it into the report verbatim) and the 24 prompt files `K\d-prompts\{top20,full51}-NN.txt`.
    Sample: 240 rows of the 1,509 with a non-empty pool (the 6 empty-pool ∅ rows left out), mulberry32 seed 20261029, round-robin over
    source files inside each stratum: **A** (a)'s pick confident and wrong 40 · **N** the other ∅ rows 50 · **H** other held-out named
    90 · **C** other corpus named 60 → 187 named / 53 ∅, 228 sfx / 12 music, all 15 source files (per-file counts in `d-sample.json`
    `bySource`). The same 12 batches of 20 go to both conditions. top20 = each row's own list from `c-rrf60-multilingual-e5-small-mean.json`
    (`perRow[].ranked`), each clip as `library:<relPath> | category | duration | tags | description` (duration added: the tool's line
    shows it and min-length rows need it); full51 = the whole library once per call (sound effects, then music) and each request names
    its section (= `poolOf(row)`). The model answers one JSON object {request no → ref | "none"}. Driver `K\d-cdp.mjs llm <label> <file>`
    = ONE `window.api.llmGenerate({ prompt, providerId: 'claude-subscription' })`, ledger `K\d-calls.jsonl` (budget guard 40, +1 retry
    only after an API error), replies `K\d-responses\<label>.json`; runner `K\d-run-all.sh` (keep-awake while running, log
    `…\search\S1\logs\d-run.log`). Scorer `K\run-d-pick.cjs <cond>` → `K\reports\d-pick-<cond>.md|json` (definitions in its header).
20. **Calls: 25 of 40 used** (probe "Say OK" → "OK" + 12 top20 + 12 full51), **0 errors, 0 retries**, every reply parsed, 0 off-list refs,
    0 missing answers (`K\d-calls.jsonl`). Model `claude-sonnet-5-5` (the provider's default; the SDK's `modelUsage` also lists a
    `claude-haiku-4-5` side call per turn). Wall per call: top20 8.2–13.0 s (prompts 113–124 k chars, ~36–38 k input tokens), full51
    5.2–14.7 s (~18.7 k chars). **Results** (`K\reports\d-pick-top20.md`, `K\reports\d-pick-full51.md`; sample = 240 rows):

    | condition | pick acc (named 187) | wrong-confident (240) | wc named / ∅ | correct none (∅ 53) | false none (named, ∅ not allowed, 156) |
    |---|---|---|---|---|---|
    | top20 of (c) | 170 / 187 = 90.9 % | 15 / 240 = 6.3 % | 4 / 11 | 42 / 53 = 79.2 % | 13 / 156 = 8.3 % |
    | full51 | 164 / 187 = 87.7 % | 18 / 240 = 7.5 % | 8 / 10 | 43 / 53 = 81.1 % | 15 / 156 = 9.6 % |
    | ref: (c) top-1 alone, same rows | 72.2 % | — | — | — | — |
    | ref: (a) pick, same rows | 54.5 % | 61 / 240 = 25.4 % | | | |

    HELD-OUT: top20 pick acc 86.2 % (106 / 123), wrong-confident 3.5 %, correct none 17 / 18; full51 83.7 %, 5.7 %, 17 / 18. CORPUS:
    top20 100.0 % (64 / 64), wrong-confident 10 / 99 (all 10 on ∅ rows); full51 95.3 %, 10 / 99. Stratum A (where (a) was confidently
    wrong): top20 31 / 37 = 83.8 %, wrong-confident 2 / 40; full51 75.7 %, 4 / 40. The top-20 ceiling on the sample is 99.5 %. So the
    top-20 condition beats the full list on every line, and the pick lifts (c)'s top-1 from 72.2 % to 90.9 % on the same rows.
    Reading the misses (lists at the end of each `d-pick-*.md`): most false nones are the r5 broad / odd-phrasing rows ("a door
    sparkling", "a swooshing menu", "a door swooshing open" → none) whose labels S1 widened (Open problems 3); most ∅ "wrong" picks
    are corpus ∅ rows that a plain-meaning reading would fill ("a river running" → stream-soft, "taking a picture" → camera-shutter,
    "a clicker" → ui-click-soft, "woooosh" → whoosh-soft, "a buildup" → riser-soft): E3 labelled those ∅ for the keyword matcher's
    word-sense tests. The report must say this, row by row for the ∅ picks (11 top20 / 10 full51), not just the rate.
21. **(e) named BEFORE any download (none made yet):** `Xenova/ms-marco-MiniLM-L-6-v2` (a cross-encoder, English, MS MARCO), files
    by HEAD on `https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2/resolve/main/{file}`: `config.json` 824 B · `tokenizer.json`
    711,396 B · `tokenizer_config.json` 1,242 B · `onnx/model_quantized.onnx` 23,143,499 B → **23,856,961 B total** — small. It runs
    through `@huggingface/transformers` 4.0.1's `AutoTokenizer` + `AutoModelForSequenceClassification` (already installed; no new
    package). English-only: expect it to fail the 10 Arabic rows. Target folder `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\ms-marco-MiniLM-L-6-v2\`.

Builder #4, 2026-10-29 14:39–14:58 ((e), recall@5 / @8, the report, the STOP judgement). Docs only; no `src/` change, no model call, no
app launch.

22. **(e) the reranker — run.** Resource guard 14:39:52 (C: 51.5 GB, D: 41.6 GB, commit 67.1 / 99.7 GB → headroom 32.6 GB; C: + headroom
    84.1 ≥ 6; 0 `electron.exe`) → the four files of `Xenova/ms-marco-MiniLM-L-6-v2` curl'd 14:40:01–14:40:27 into
    `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\ms-marco-MiniLM-L-6-v2\` (824 · 711,396 · 1,242 · 23,143,499 B = the HEAD sizes
    of Done 21). Driver `K\run-e-rerank.cjs` (transformers.js 4.0.1 `AutoTokenizer` + `AutoModelForSequenceClassification`, absolute dir,
    `local_files_only`, `allowRemoteModels = false`, `dtype: 'q8'`, cache dirs on scratch; no new package) re-orders each row's top-20 of
    `K\reports\c-rrf60-multilingual-e5-small-mean.json` by the logit (query = prompt, passage = `itemText(e)`). **`K\reports\e-rerank-ms-marco-MiniLM-L-6-v2.md`:
    ALL R@1 86.6 · R@3 94.5 · R@10 98.8 · R@20 99.9 · MRR 0.911 (vs (c) 87.4 · 94.8 · 99.3 · 99.9 · 0.917); HELD-OUT R@1 65.4 (vs 61.4); CORPUS R@1
    96.1 (vs 99.1); Arabic R@1 10.0 (vs 50.0)**; Youden J on the top-1 logit 0.655. Timing (`…-timing-node.md`, node 22.14.0, under external load —
    vmmemWSL ≈ 26.6 CPU-s / 5 s at 14:46): load 759 ms, per request (20 pairs) p50 243.7 ms / p95 404.01 ms, RSS 127 MB loaded. Verdict: no gain,
    too slow → not in Smart's default. Its Electron timing run was not made (~9 min of full CPU, could not change the verdict; report §11).
23. **The two (d) measures, row by row:** `K\d-diff.cjs` → `K\reports\d-measures-diff.md|json`. Generic R@1 = pick ∈ allowed (151 / 187 =
    80.7 % in BOTH conditions); "pick acc (named)" adds a "none" on an `'x|∅'` row (31 such rows): +19 in top20 → 170 / 187 = 90.9 %, +13 in
    full51 → 164 / 187 = 87.7 %; the rows are listed, and every pick on a `∅` row (11 top20 / 10 full51, 14 distinct rows).
24. **recall@5 / @8 and the matrices:** `K\build-tables.cjs` → `K\reports\z-matrix.md|json` — R@1 / 3 / 10 / 20 / MRR × 18 sources × 12
    candidates from each report's `table`, plus recall@k (1, 3, 5, 8, 10, 20) from `perRow[].ranked` for (a), (b) me5-small, (c) MiniLM, (c)
    me5-small, (e) (0 mismatches against the tables). **(c) RRF60 + me5-small: ALL R@5 97.7 · R@8 99.1; HELD-OUT 92.7 · 97.2; CORPUS 100 · 100.**
25. **The report** `docs/studio/search/S1-spike-report.md` (§0–§15; every number names its `K\reports\` file): composition, measures, every
    candidate on ALL / CORPUS / HELD-OUT and per file, wrong-confident rates, the timing table, the floors + the `∅`-pick caveat row by row, the
    worker `dtype` finding, (d) with the template verbatim and both measures, (e), Hasan's rule model by model (→ multilingual-e5-small), the
    STOP judgement (not fired: R@10 ALL 91.8 → 97.5–98.7, HELD-OUT 73.4 → 93.2–96.0; the design is supported), "What S2 needs" (N = 20, K = 60,
    prefixes / pooling / `dtype: 'q8'`, no floor, abstention, indexing in the background, memory).

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
- **Final re-check (builder #2, 14:21, after every (b) / (c) / timing run incl. the Electron ones):** `node_modules` 2026-10-16
  12:57:48 · `@huggingface\transformers` 2026-07-07 10:32:45, 6 children · `node_modules\.cache` 0 items · files under
  `node_modules` written after 2026-10-29 13:55: **0** · `electron.exe` 0 · `curl.exe` 0 · C: 50.8 GB free.
- Runs (each `cd K` with `ELECTRON_RUN_AS_NODE` unset): `node run-a-keywords.cjs` (rc 0) · `node run-b-embeddings.cjs <id> <pooling>`
  for all-MiniLM-L6-v2 mean, bge-small-en-v1.5 mean + cls, multilingual-e5-small mean, multilingual-e5-base mean (rc 0 each; logs
  `K\reports\b-*.log`) · `node run-c-hybrid.cjs <same>` (rc 0; `K\reports\c-rrf60-*.log`) · `node run-t-timing.cjs <id> <pooling>` and
  `ELECTRON_RUN_AS_NODE=1 …/electron.exe run-t-timing.cjs <id> <pooling>` → the `t-*.md` rows quoted in Done 15–16. Every (b) report's
  last line says `load: fallback dtype q8 (app options failed: … not found locally at "…/onnx/model.onnx")`.
- **Builder #3 (d), 14:30–14:36:** `cd K; node d-build-sample.cjs` → `{"seed":20261029,"rows":240,"eligible":1509,"strata":{"A a-wrong":40,"N null":50,"H held-out named":90,"C corpus named":60},…,"kinds":{"named":187,"null":53},"cls":{"sfx":228,"music":12},"batches":12,…}`.
  `node d-cdp.mjs root` → `{"set":{"success":true},"get":{"root":"C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\search\\S1\\studio-root"}}`.
  `node d-cdp.mjs llm probe-say-ok d-probe.txt` → `{"n":1,…,"success":true,"model":"claude-sonnet-5-5",…,"textHead":"OK"}`. `bash K/d-run-all.sh`
  → `logs\d-run.log` ends `14:35:32 ALL DONE`; `d-calls.jsonl` 25 lines, n 1–25, all `success: true`, none `retryOfApiError`.
  `node run-d-pick.cjs top20` / `full51` → rc 0 each, the tables in Done 20 (`K\reports\d-pick-*.md|json|log`).
- **After (d), 14:35:59:** 0 `electron.exe` (4 stopped by the search-S1 profile path + Name), 0 keep-awake PowerShell left; C: 50.0 GB
  free, D: 41.6 GB, commit headroom 34.4 / 99.7 GB. `node_modules` 2026-10-16 12:57:48 · `@huggingface\transformers` 2026-07-07
  10:32:45, 6 children · `node_modules\.cache` 0 items · files under `node_modules` written after 2026-10-29 14:22: **0**. Worktree
  `git status --short` empty before this hand-off's edits (its `out/` is gitignored).
- Model files on C: (bytes = the HEAD sizes in Done 8): `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\{all-MiniLM-L6-v2,
  bge-small-en-v1.5, multilingual-e5-small, multilingual-e5-base}\` (489.5 MB).

- **Builder #4 (e) + the report, 14:39–14:58:** guard 14:39:52 (Done 22) → `curl -sSL --retry 5` × 4 → `ls -l` = 824 / 711396 / 1242 /
  23143499 B. `cd K; node run-e-rerank.cjs > reports/e-rerank.log` rc 0 (14:41:30 start; done before 14:50:37) → `e-rerank-ms-marco-MiniLM-L-6-v2.md|json`
  + `…-timing-node.md|json`. `node d-diff.cjs` rc 0 → `top20 … 151 → generic R@1 80.7 %; + "none" on an 'x|∅' row 19 → pick acc 170 / 187 = 90.9 %`
  and `full51 … 151 …; + 13 → 164 / 187 = 87.7 %`. `node build-tables.cjs` rc 0 → `z-matrix written; 18 sources × 12 candidates; recall@k for 5;
  mismatches 0`. CPU over 5 s at 14:46: the rerank node 32.1 CPU-s, vmmemWSL 26.6, python 4.0.
- **`node_modules` re-check after (e), 14:50:37:** `node_modules` 2026-10-16 12:57:48 · `@huggingface\transformers` 2026-07-07 10:32:45, 6
  children (dist, src, types, LICENSE, package.json, README.md) · `node_modules\.cache` 0 items · files under `node_modules` written after
  2026-10-29 14:39: **0** · scratch `tf-cache` does not exist · 0 `electron.exe`, 0 rerank node left · C: 51.3 GB, commit headroom 32.3 / 99.7 GB ·
  models folder on C: 489.6 MiB (5 models).
- **Tree as of `c642c2a` (before this hand-off's commit):** `git status --short` empty, `git log -1 --format=%h -- src/` = `c5a6124`, `git diff
  --stat 906273c..HEAD -- src/ scripts/` empty. The post-commit re-check is the next bullet.
- **Post-commit re-check, as of `edf531c`** (the report commit): `git status --short` empty; `git log -1 --format=%h -- src/` = `c5a6124`;
  `git diff --stat 906273c..HEAD -- src/ scripts/` empty; `git show --stat HEAD` = only `docs/studio/search/S1-spike-report.md` (new),
  `S1/HANDOFF.md`, `S1/LOG.md`. This bullet is added by the follow-up docs commit (its hash in `git log`).

## Next step (ONE concrete instruction)

None for S1 — the exit is met (status DONE). Orchestrator: read `docs/studio/search/S1-spike-report.md` against S1's rule, then start S2 (the
design note + THE ACCEPTANCE BAR) from its §12–§14.

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
4. **For S2/S3, not a stop:** the app's embedding worker cannot load a catalog model as written (Done 9: transformers.js 4.0.1
   defaults to fp32 `onnx/model.onnx`; the catalog ships `model_quantized.onnx`) — the worker needs `dtype: 'q8'`. The report
   must carry this. Indexing is the slow part on CPU (2,000 items 22–51 s by model): S2's design needs a background /
   incremental index, not an index-on-query.
5. **Floors (S2 needs a "nothing fits" floor):** no score separates ∅ from named rows cleanly in any (b) / (c) run so far (best
   Youden J ≈ 0.58–0.67: a floor that drops ~85–90 % of ∅ rows also drops ~20–40 % of named rows; see each report's floor
   section). Read for the report: a retrieval floor alone cannot be the "nothing fits" rule; the LLM pick's "none fits" (d) is
   the candidate for it. The RRF fused score is rank-based (max 2/61), so its floor is about agreement, not similarity.
6. **Process slip (builder #2):** one one-line status edit of this file went through `sed` (14:03, the `status:` line; content
   correct) against the Edit-tool-only rule; every other doc edit used Edit.
7. **(d) label disagreements (for the report, and S2's bar):** the pick's "wrong-confident" on corpus ∅ rows (10 / 35 in both
   conditions) is mostly a label question, not a pick error: E3's corpus marks "a river running", "taking a picture", "a clicker",
   "woooosh", "a buildup", "a runner", "a rewound tape" ∅ because they test the keyword matcher's word senses, while a plain-meaning
   pick fills them (stream-soft, camera-shutter, ui-click-soft, whoosh-soft, riser-soft, dash-zip, whoosh-reverse). Likewise most
   held-out false nones are S1's widened broad-set labels on odd phrasings ("a door sparkling" → none). The report states the rates
   as measured AND lists those rows; whether S2's bar re-labels the corpus ∅ rows for the pick is S2's (or Hasan's) call — not a
   stop for S1.
8. **(d) budget left:** 15 of 40 model calls (+ the retry allowance) remain unused; nothing in S1 needs them now (builder #4 made none).
9. **For S2, not a stop (builder #4):** (i) N for the tool answer — the report recommends 20 (the measured condition); a smaller N is
   unmeasured for the pick (report §14). (ii) Whether S2's bar re-labels the corpus `∅` rows that the pick fills by plain meaning (report §8,
   14 rows listed). (iii) The (c) hybrid's R@1 on `r5/j-falling` is 33.3 (the keyword list's confident wrong matches fuse in on top) — fine for
   recall at N ≥ 8, but the tool must not present the fused order as confidence. (iv) The worker `dtype: 'q8'` fix (Open problems 4). None of
   these is Hasan's call unless S2 says so.

## Do-not-redo

- The corpus recount (1,073) and the fact that r3 / r4 add no row: settled (`K\build-kit.log`, `survey-probes.cjs`).
- `K\out\corpus.cjs` is the matcher at the worktree's code. Rebuild it only if the worktree's `src/main/services/library/`
  changes (it should not in S1).
- Do not hand-label the 2,674 broad cross-products. They are excluded by rule, with the reason.
- (d) is DONE: do not launch the app or make model calls again for S1 (25 / 40 used; replies on disk in `K\d-responses\`). Re-score
  with `node run-d-pick.cjs <cond>` if the scorer changes; never re-ask the model. The worktree's `out/` (built 14:28) and the
  `profiles\search-S1` profile stay as they are.
- (e) is DONE (`K\reports\e-rerank-ms-marco-MiniLM-L-6-v2*.md`); its Electron timing was skipped on purpose (report §11). The report is
  written from `K\reports\z-matrix.md` + the per-candidate reports; if a scorer changes, re-run `node build-tables.cjs` and `node d-diff.cjs`
  and update the report's tables from them.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-29 13:42–13:55 · builder #1 · ~33 calls · the kit bundle, the probe survey, the labelled set (1,565 rows /
  2,899 excluded), candidate (a) and its reports; the `node_modules` baseline; no download, launch or model call (0 / 40 used).
- 2026-10-29 13:55–14:22 · builder #2 · ~48 calls · held-out subtotals, (a) re-run, model sizes + downloads (4 catalog models,
  489.5 MB on C:), (b) × 5 runs (4 models, bge mean + CLS), (c) RRF60 × 5, the timing kit (node + Electron), the worker dtype
  finding, the `node_modules` re-checks; no launch, 0 / 40 model calls used.
- 2026-10-29 14:24–14:40 · builder #3 · ~45 calls · (d) the LLM pick: worktree build, the search-S1 profile + launch on 9290 (stopped),
  the stratified 240-row sample, 25 / 40 model calls (0 errors), the two pick reports; (e)'s reranker named with its size (not
  downloaded); the report and the STOP judgement not started. Hand-off commit: the one that adds this line (hash in LOG.md's next line / `git log`).
- 2026-10-29 14:39–14:58 · builder #4 · ~50 calls · (e) the reranker (download 23.9 MB, run, timing on node), the two (d) measures row by row
  (`d-diff.cjs`), the matrices + recall@5 / @8 (`build-tables.cjs`), the report, the STOP judgement (not fired) → status DONE; 0 model calls, no
  launch. Commits: the report commit + a post-commit re-check commit (hashes in LOG.md / `git log`).
