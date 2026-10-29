# S1 — the spike: keywords vs local embeddings vs hybrid vs the LLM pick, on E3's labelled set (no product code)
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Build the labelled set: a kit script that extracts every row from the seven corpus files (recount them) and the
labelled phrasings from the r3 / r4 / r5 probe files, adds your ~30 plain-meaning rows (10 Arabic), and writes ONE
labelled-set file (prompt, allowed clips, `∅` / `x|∅`, source file, who labelled it) under
`.vidtsx-temp\search\S1\`; then run candidate (a) over it and write its report file — then the embeddings (b), the
hybrid (c), the timing table, the LLM pick (d), optional (e), and the report.

## Open problems

(none yet)

## Do-not-redo

(nothing yet)

## Agents so far (date · approx tool calls · what they covered)

(none yet)
