# Library search — one shared, meaning-aware search service (design note)

> S2 of the library-search run (`docs/studio/search/ORCHESTRATOR.md`), written by the orchestrator on 2026-10-29 from the S1 spike
> (`docs/studio/search/S1-spike-report.md`, "the report" below — every number here is quoted from it, with its §) and the code as of
> `040717f` (`src/` = `c5a6124`). **§9 THE ACCEPTANCE BAR is fixed here, before any builder or verifier; S4 fails only by it.** A change
> to §9 after this commit needs Hasan's word, recorded in ORCHESTRATOR.md.

## 1. Why, and the decision

E3's keyword matcher (`src/main/services/library/sound-match*.ts`) cannot tell which word carries the sound ("a cracked screen" →
power-down) and has no synonyms ("things falling over" never finds `crash-tumble`, "objects toppling over and clattering"). Fix round
4 showed three labelled candidates, which helped recall, but retrieval still claims ("The library already has 3 sounds matching
"things falling over"") — E3 verifier round 5's F5a / F5b. Hasan's decision (2026-10-29): **retrieval is wide and humble; the pick
is made where judgement lives.**

- **Retrieval** = the keyword list + a small LOCAL embedding model, fused by reciprocal-rank fusion, top 20.
- **The pick** = the assistant itself wherever an LLM is already in the loop (the Studio tools); an optional rerank by the user's own
  provider where none is (the Assets search box).
- **Retrieval never claims.** No "already has", no `[matched]`. It says "these may fit — read the descriptions".
- **One shared service**, a setting ladder: **Basic** (keywords) · **Smart** (+ local embeddings; the default once the model is on disk)
  · **Smart + AI rerank** (+ the user's provider; off by default).

## 2. What S1 measured (the numbers this design rests on)

The labelled set: 1,565 rows (1,375 named, 140 `∅`, 50 `*`) over the 51-clip fixture — CORPUS = E3's seven committed files (950 named;
the keyword matcher's own tuning set, so keywords score 100 there by construction), HELD-OUT = verifier round 5's files + 35 new rows
incl. 10 Arabic (425 named) (report §1).

| | ALL R@10 / R@20 / MRR | HELD-OUT R@10 / R@20 | CORPUS R@10 | report |
|---|---|---|---|---|
| (a) keywords at `c5a6124` (today) | 91.8 / 91.9 / 0.874 | 73.4 / 73.6 | 100.0 | §4 |
| (b) multilingual-e5-small alone | 98.7 / 99.8 / 0.886 | 96.0 / 99.3 | 99.9 | §4 |
| **(c) RRF K=60, keywords + multilingual-e5-small** | **99.3 / 99.9 / 0.917** | **97.9 / 99.8** | **100.0** | §4 |

- (c) at k = 3 / 5 / 8 / 10 / 20: ALL 94.8 / 97.7 / 99.1 / 99.3 / 99.9; HELD-OUT 83.3 / 92.7 / 97.2 / 97.9 / 99.8; Arabic (10 rows) 70 / 70
  / 90 / 90 / 100 (§14). Today's tool shows 3.
- **The pick** (the keyless assistant model over the top-20 of (c), 240-row sample): R@1 80.7 % (151 / 187), "pick acc" 90.9 % (also counting
  a "none" on an `x|∅` row), **wrong-confident 6.3 %** against the keyword answer's 25.4 % on the same rows; correct "none" on `∅` rows 79.2 %,
  false "none" on named rows 8.3 %; the top-20 condition matched or beat picking from the whole 51-clip list (§10).
- **No similarity floor separates `∅` from named rows** (best Youden J 0.665; a floor that drops 90 % of `∅` rows drops 24–35 % of named
  ones) → "nothing fits" is the pick's "none", never a retrieval threshold (§8).
- **Cost (Electron 41, this laptop):** multilingual-e5-small 135,392,016 B on disk, cold 1,421 ms, RSS 412.8 MB loaded, warm query p95 6.33
  ms over 51 vectors / 15.88 ms over 2,000; indexing ≈ 24 ms per item (2,000 items 48.6 s) (§7).
- **The local cross-encoder (ms-marco-MiniLM-L-6-v2) adds nothing** (ALL R@1 86.6 vs 87.4, Arabic 10 vs 50, 243.7 ms per request) — not
  used (§11).
- **The app's embedding worker cannot load a catalog model as written** — `src/embedding-engine/worker.ts:57-59` needs `dtype: 'q8'` (the
  catalog ships only `onnx/model_quantized.onnx`) (§9).

**Decided by Hasan's rule (§12):** Smart's model = **multilingual-e5-small** (q8, mean pooling, prefixes `query: ` / `passage: `). Every model
was within 2 points of the best R@20 with warm p95 ≤ 50 ms; the rule prefers a multilingual model within 3 points, and e5-small is the best.

## 3. The service — module layout

Feature isolation holds: the service is main-process code; `asset-library` and `studio` reach it only through their own seams (the agent
tools in main, the IPC surface from the renderer). One primary export per file, ≤ ~300 lines, no `any`.

**`src/main/services/library-search/`** (business logic, pure where it can be):

| file | owns |
|---|---|
| `item-text.ts` | the text an item is embedded as — the file name without extension, `-` / `_` as spaces, + `audio.category` + tags (", ") + description, joined by ". " (S1's `itemText`, report §14) — and `textHash` (sha1 of that text). Pure. |
| `keyword-retriever.ts` | Basic's ordered list. **Audio:** E3's `rankLibrarySounds` → `selectSoundAnswer` order, then the other confident matches, then the rest by coverage, zero-coverage clips left out (S1's (a) list, report §3) — the matcher files `sound-match.ts` / `-words.ts` / `-vocab.ts` stay **byte-identical to `7967c6f`** and `sound-answer*.ts` keep their tests. **Image / video:** a coverage ranking over name / tags / description built from the exported `promptTerms` / `matchStrength`. Pure. |
| `fuse.ts` | RRF `Σ 1 / (60 + rank)` over the keyword list and the semantic ranking; ties by cosine, then relPath. Pure. The fused score is rank-based (max 2 / 61) — it is an ORDER, never shown as a confidence. |
| `search-pool.ts` | which entries may answer: `kinds`, the sound class (sfx / music, E3's `isCandidate`), `minDurationSec`, `scope` (a relPath prefix). Pure. |
| `library-search.ts` | `searchLibrary(request, deps)` — resolves the mode (§4), builds the pool, runs Basic or Smart, returns at most `limit` candidates (default **20**). Never throws for an embedder problem: it falls back to Basic and says so in `degraded`. `deps = { loadEntries, semantic?, reranker?, settings }` — every test injects them. |
| `search-settings.ts` | the ladder setting + the model id in the settings KV store (the `library-prefs.ts` pattern). |
| `rerank.ts` | Smart + AI rerank (§8.3): one call to the user's app-default text provider over the top 20, the S1 (d) prompt rules; for the Assets box only. |
| `vector-sync.ts` | main's side of the vector cache (§5): computes `{ relPath, text, textHash }` for the pool and asks the engine to sync. |

**`src/library-search-engine/`** (the process, mirroring `src/content-safety-engine/`): `search-engine.ts` (the utilityProcess host:
lazy spawn, request ids, per-call timeout, death → reject every pending call + respawn on next use, idle unload), `worker.ts` (the child:
transformers.js `feature-extraction`, `dtype: 'q8'`, mean pooling + normalise, the e5 prefixes, `local_files_only`, `allowRemoteModels =
false`; it owns the vector file and the cosine ranking), `types.ts`. New electron-vite entry `library-search-worker`
(`electron.vite.config.mjs`, beside `embedding-worker` / `content-safety-worker`).

**Shared types** `src/shared/types/library-search.ts`:

```ts
export type LibrarySearchMode = 'basic' | 'smart' | 'smart-rerank';
export interface LibrarySearchRequest {
  query: string;
  kinds?: Array<'audio' | 'video' | 'image'>;
  soundClass?: 'sfx' | 'music';
  minDurationSec?: number;
  scope?: string;        // relPath prefix (the Assets breadcrumb)
  limit?: number;        // default 20
}
export interface LibrarySearchCandidate {
  relPath: string;
  rank: number;                                       // 1-based, the order shown
  keyword?: { rank: number; coverage: number; words: string[] };  // prompt words this item covers
  semantic?: { rank: number; cosine: number };
  reranked?: { rank: number };
  why: string;                                        // plain words: "words: whoosh, soft · meaning rank 2"
}
export interface LibrarySearchResult {
  ran: LibrarySearchMode;                             // what actually ran
  requested: LibrarySearchMode;
  modelId?: string;
  candidates: LibrarySearchCandidate[];
  poolSize: number;                                   // entries that could answer (0 = a true miss)
  degraded?: string;                                  // why Smart fell back to Basic for this call
  vectors?: { ready: number; total: number };
}
export interface LibrarySearchStatus {
  mode: LibrarySearchMode;                            // effective
  choice: LibrarySearchMode | 'auto';
  modelId: string;
  modelDownloaded: boolean;
  modelBytes: number;
  vectors: { ready: number; total: number; building: boolean };
}
```

## 4. The ladder and its setting

- KV keys: `librarySearchMode` — unset = **auto**; `librarySearchModelId` — unset = `multilingual-e5-small`.
- **Auto** = Smart when the model is downloaded (`isEmbeddingModelDownloaded`), else Basic. An explicit choice wins (Basic stays Basic
  after a download; Smart with no model runs Basic with `degraded: 'model not downloaded'`).
- **Smart + AI rerank** is only ever an explicit choice. It uses the app-default text provider (the user's own key, or the keyless
  subscription), is logged like every other call (`featureSource: 'library-search-rerank'`), and applies to the Assets box only — in the
  Studio tools the assistant is the picker, so a rerank would pay twice.
- UI: a "Library search" row in Settings › General (`src/renderer/components/SettingsModal/rows/LibrarySearchRow.tsx` + a hook): the three
  choices (Auto is shown as the default), the model's size (135 MB) and a **Download** button that calls the existing
  `embedding:model:download` (the AI Models path; progress on `embedding:download:progress`), and the vector state ("51 / 51 ready",
  "building 12 / 51"). The AI Models screen lists the model as it does today. Nothing downloads without a click (CLAUDE.md: models download
  on first use, never bundled). UI per `UI_SPEC.md`.
- The `embedding-engine` worker's `dtype` bug (§2) is fixed in the same slice (one option + a test), since the download is shared with
  the AI Models screen and the Embedding Tester.

## 5. The vector cache

- **File:** `<library root>/.vidtsx/search/vectors-<modelId>.json`, next to the index, travels with the library, never listed (dot
  folder). `{ version: 1, modelId, dims, pooling: 'mean', prefixVersion: 1, items: { [relPath]: { textHash, v: <base64 Float32> } } }` —
  2,000 items × 384 × 4 B ≈ 3 MB raw.
- **Key** = relPath + textHash + modelId (pooling / prefixVersion / dims in the header: any mismatch rebuilds the file). A changed name,
  description, tags or category → a new textHash → re-embedded; a deleted entry → dropped; a moved / renamed file → a new relPath, its
  text holds the file name → re-embedded (cheap: one item ≈ 24 ms).
- **When:** (1) before every Smart search the pool's diff is embedded first (normally zero or one item); (2) after index writes (upsert,
  reconcile, description / tags set) a debounced background sync; (3) the first full build right after the model download, in the
  background, batches of 32, progress on `library:search:event`. A search during a build uses the vectors ready so far plus the keyword
  list (`vectors.ready < total` is reported, not hidden); a query jumps the build's queue.
- Writes are atomic (`.tmp` + rename) and debounced; a corrupt or wrong-model file is rebuilt, never trusted.

## 6. "Nothing fits" — when a tool may generate without `force`

- **Basic:** as today — a TRUE miss (no candidate scores) generates; anything that scores is shown and generating needs `force: true`.
- **Smart:** no similarity floor exists (§2), so a non-empty pool ALWAYS answers candidates; generating needs `force: true`. Only an empty
  pool (no audio of that class, or none long enough — `poolSize: 0`) generates without `force`. The cost of a genuinely new sound is one
  extra tool round trip; the gain is that the model reads the library before it pays.
- `force: true` always generates (both modes), unchanged from E3.

## 7. Processes — nothing blocks the main process

- **The embedder runs in an Electron utilityProcess, not a worker thread.** sherpa-onnx (transcription) loads its older `onnxruntime.dll`
  into main and the 1.24.3 binding then fails in every thread of that process ("The operating system cannot run %1") — the precedent and
  its proof: `src/content-safety-engine/worker.ts:5-15`, `safety-engine.ts:11-22`. (The Embedding Tester's `src/embedding-engine/` worker
  thread has the same exposure; not this slice's to move — a note.)
- transformers.js / onnxruntime are imported only inside the child. The child owns the vector file and the cosine ranking (≈ 3 MB of
  floats stays out of main); main runs the keyword list (pure, ms) and the fusion.
- Startup cost is zero: no spawn, no model read, no vector read until the first search or status call needs it (`lazily`,
  `src/main/ipc/registrations/lazy.ts`).
- First Smart call after launch pays the child's spawn + cold load (S1 cold 1,421 ms); the caller waits at most **5 s**, then gets Basic
  with `degraded: 'model loading'`; warm calls time out at **2 s** → Basic + `degraded`. Idle unload after 10 min. A dead child rejects its
  calls (→ Basic for those) and respawns on the next.

## 8. The first users

### 8.1 `generate_sfx` / `generate_music` — the assistant picks

- Before the provider check (E3's order kept): `searchLibrary({ query: prompt, kinds: ['audio'], soundClass, minDurationSec, limit: 20 })`.
- A non-empty answer replaces the generation. The text, in this shape (wording pinned by tests in S3):

  ```
  Library sounds that may fit "<prompt>" — found by search (words + meaning), NOT checked; nothing was generated (no cost). Read each
  description and pick by plain meaning: a clip fits only if it IS the sound asked for — a loosely related or merely similar clip is not a fit.
  - library:sfx/… (audio, 1.2 s · emphasis · tags: … · −20.3 LUFS · used in …) — "<description>"
  … (up to 20 rows, E2's `formatLibraryRow`, in the search's order — the order is not a ranking of fit)
  If one fits, place it with insert_asset(assetId: "library:<path>", lane: "audio", at: …). If none fits, call generate_sfx again with force: true.
  ```

  No "already has", no "matching", no `[matched]` / `[weak match]` / `[closest]` — in any mode. The header names what actually ran
  (`ran`): "(words + meaning)" for Smart, "(words only)" for Basic (an explicit Basic choice or a fallback); `degraded` adds one line
  ("Searched by words only: <reason>"). *(Clarified by the orchestrator 2026-10-29 17:25, ruling LS-r6 — the first text printed
  "(words + meaning)" in every mode, untrue in Basic.)*
- `poolSize: 0` → generates (§6). `force: true` → generates. The provider notice, `compositionPlan`, the length rule, E2's normalize /
  `usedIn` — unchanged.
- `REUSE_NOTE` / `FORCE_HINT` (`agent-tools/audio-tools.ts`) and the prompt lines (`studio-agent-prompt-tools.ts:31-32`) say the same; pinned.

### 8.2 `list_assets(scope: "library", query)`

- With a query: the service's ranked candidates (`kind` → `kinds`), E2's rows, at most 20, header "Ranked by search (words + meaning) — check
  the descriptions; the order is not a ranking of fit" ("(words only)" when Basic ran — LS-r6). Basic ranks by the keyword list instead of today's every-word filter (an item with
  no prompt word is not listed in Basic). Without a query: unchanged (today's listing).
- Project scope: unchanged.

### 8.3 The Assets screen search box

- **Basic:** today's client-side filter (`src/features/asset-library/services/asset-search.ts` `filterAssets`) — unchanged, instant.
- **Smart:** the box also calls `library:search` (debounced 250 ms; `scope` = the breadcrumb; `kinds` from the category filter); the grid shows
  the top 20 in the service's order, then any other every-word matches the filter finds; chips still narrow. A small "Smart" marker by the box
  (UI_SPEC tokens), its tooltip naming the mode and the vector state.
- **Smart + AI rerank:** the top 20 reordered by one provider call per settled query (Enter, or 1 s idle), cached by query + index version; a
  failed call keeps the Smart order.
- Renderer code stays in `src/features/asset-library/` (a `useLibrarySearch.ts` hook + the merge in `services/`), through IPC only.

## 9. THE ACCEPTANCE BAR (fixed before any verifier; S4 FAILS only by this)

### 9.1 The committed benchmark (tests in the tree; thresholds, not exact firsts)

- **Fixture:** S1's labelled set (`.vidtsx-temp\search\S1\labelled-set.json`, 1,565 rows with `source` / `labelledBy`) committed as a test
  fixture, plus **precomputed multilingual-e5-small vectors** for the 51 clips and every scored prompt, generated by a committed script
  from the real model through the product's own item-text / prefix code, stored at a precision that changes NO ranking (S3 shows the
  fixture's (c) table equals S1's float32 table, report §5 / §14: int8 per-vector scaled if that holds, else 16-bit; the file ≤ ~3 MB).
  Several files have zero margin (§9.1's table), so this is checked, not assumed. The benchmark test
  runs the PRODUCT's `searchLibrary` (keyword list + fusion + pool) with an injected semantic ranker that reads the fixture vectors.
- **A gated live test** (runs when `VIDTSX_SEARCH_MODEL_DIR` points at a downloaded model): re-embeds through the product worker's code path
  and asserts every fixture vector agrees (cosine ≥ 0.99) and the §9.1 thresholds hold on live vectors. S4 runs it.
- **What is measured:** recall@20 and recall@10 of the answer's candidate list (= what the assistant sees), named rows (`x|∅` counted as
  named), `∅` and `*` rows not in recall — S1's definitions (report §2).

| row set (Smart) | R@20 ≥ | R@10 ≥ | S1 (c) measured R@20 / R@10 | (a) keywords R@10 |
|---|---|---|---|---|
| ALL (1,375) | 99.5 | 98.5 | 99.9 / 99.3 | 91.8 |
| CORPUS — each of the 7 files | 100.0 | 100.0 | 100.0 / 100.0 | 100.0 |
| HELD-OUT together (425) | 99.0 | 96.5 | 99.8 / 97.9 | 73.4 |
| `r5/c-ordinary.txt` (171) | 99.4 (170 / 171) | 99.4 (170 / 171) | 100.0 / 100.0 | 99.4 |
| `r5/d-stopword.txt` (174) | 97.5 | 93.0 | 99.4 / 95.4 | 46.0 |
| `r5/j-falling.txt` (12) | 100.0 | 91.6 (11 / 12) | 100.0 / 100.0 | 33.3 |
| `r5/b-broad-flagged.txt` (26) | 100.0 | 100.0 | 100.0 / 100.0 | 100.0 |
| `S1-own-en` (24) | 100.0 | 100.0 | 100.0 / 100.0 | 100.0 |
| `S1-own-ar` (10, Arabic) | 90.0 (9 / 10) | 80.0 (8 / 10) | 100.0 / 90.0 | 0.0 |

- **No regression vs the keyword baseline on recall@10** (Hasan's rule): at ALL / CORPUS / HELD-OUT and on every source file with ≥ 10
  named rows, Smart R@10 ≥ (a)'s R@10 (report §5) — the table's R@10 column already takes the larger of the two (so every corpus file,
  `b-broad-flagged` and `S1-own-en` must stay at 100.0, `c-ordinary` at 170 / 171). `r5/i-nine.txt` (6) and `r5/e-realindex.txt` (2) are
  too small for a per-file rule; they count inside HELD-OUT.
- **Basic = today, exactly:** in Basic the candidate list's first 3 are `selectSoundAnswer`'s three at `c5a6124` for every row (same clips,
  same order), and R@k per file equals (a)'s (report §5) — the keyword path is kept, not re-tuned. E3's corpus tests and
  `sound-answer*.test.ts` stay green untouched.
- **No claim, every row, both modes:** for all 1,515 scored rows the formatted `generate_sfx` / `generate_music` answer — every line
  except the rows' quoted clip descriptions — contains none of "already has", "matching", "[matched]", "[weak match]", "[closest]",
  "may have"; it contains the neutral header and the `force: true` line.
- **Nothing fits (§6):** Smart with a non-empty pool never generates without `force` (every row); `poolSize: 0` generates; Basic's true miss
  generates; `force: true` generates in both modes (the stand-in provider's call counter proves each).

### 9.2 The gates

- Worktree vitest green except the three E-d2a package-resolution suites (shown independent of `906273c..HEAD` — rule (b), DRIVING "Track
  E"); DRIVING's load rules / E-d13 apply.
- `tsc` web ≤ 26 / node ≤ 10.
- House rules: feature isolation (`asset-library` ↔ `studio` never import each other), IPC-only bridge (no Node API in the renderer), services
  own logic, ≤ ~300 lines per file, no `any`, no new npm package, Remotion pins untouched.
- The matcher files byte-identical to `7967c6f` (`git diff 7967c6f -- src/main/services/library/sound-match.ts sound-match-words.ts
  sound-match-vocab.ts` empty).

### 9.3 The live checks (S4)

1. **Main never blocks:** an IPC ping loop (every 50 ms) during the child's spawn + cold load + the 51-clip vector build + the first Smart
   query — max gap ≤ 250 ms (the `main-process-freeze` method).
2. **The download path:** on an isolated profile with no model, status = Basic / not downloaded and nothing downloads by itself; the Settings
   row's Download fetches the model through `embedding:model:download` into the profile's models folder; status flips to Smart (auto); the
   background build reaches 51 / 51.
3. **The Assets box (CDP):** Smart — "things falling over" shows `crash-tumble` in the first 8 tiles; "صوت زجاج يتكسر" shows `break-glass-crack`
   in the first 8; the grid's first 20 = the `library:search` IPC's 20 for the same query and scope, in order; Basic (Settings row) — the box
   behaves exactly as today's filter (same tiles as `filterAssets` for 3 queries).
4. **Real tool handlers, app stopped, the verifier's own scratch 51-clip library, Smart through a node-hosted embedder over the real model:**
   "things falling over" → `crash-tumble` among the rows, the neutral header, nothing generated (stand-in counter 0); `force: true` generates
   once; a pool with no sfx generates without `force`; the same prompt in Basic → today's ordering under the neutral header.
5. **≤ 4 keyless assistant turns** on an isolated profile with the model, Smart, the 51-clip library, the stand-in provider registered with
   its counter: "Add a soft whoosh at the first cut." ×2 and "Add the sound of things falling over at the first cut." ×2. **PASS** = every
   turn's tool answer carries no claim (§9.1 strings), no turn generates (counter 0), and every turn that proposes / places a clip proposes
   one from the allowed set (whoosh: `whoosh-soft` or another whoosh-tagged sfx, E3's exit rule; falling: `crash-tumble`); each prompt is
   right at least once. A turn that ends by asking the user with the right clip among what it offers is a NOTE. **FAIL** = a generation, a
   wrong clip proposed or placed, or a claim string.

### 9.4 Only notes (never a FAIL)

R@1 / the fused order's first (it is not a confidence — e.g. `j-falling` R@1 33.3 under the fusion); the pick's quality beyond the four turns
(S1 §10's 6.3 % wrong-confident is a measurement, not a bar); E3's corpus `∅` rows that a plain-meaning pick fills ("a river running" →
`stream-soft`, report §8 — no re-labelling in this slice); image / video retrieval quality (no labelled set yet — unit tests only);
recall on libraries bigger than 51 clips (unmeasured); timings on other machines; the live Smart + AI rerank (DEFERRED-HASAN: it needs a
provider call outside S4's four turns — unit-tested with an injected reranker); the Embedding Tester's worker-thread DLL exposure; the
by-ear check of a placed clip (Hasan's list).

## 10. IPC + preload

| channel | kind | request → response |
|---|---|---|
| `library:search` | handle | `LibrarySearchRequest` → `{ ok: true, result: LibrarySearchResult } \| { ok: false, error }` |
| `library:search:status` | handle | `{}` → `LibrarySearchStatus` |
| `library:search:settings:set` | handle | `{ mode?: LibrarySearchMode \| 'auto'; modelId?: string }` → `LibrarySearchStatus` |
| `library:search:event` | push | `{ type: 'vectors'; ready; total; building }` \| `{ type: 'status'; status }` |

Channels in `src/shared/ipc/channels.ts`, request / response types in `src/shared/ipc/types/library-search.ts`, handlers in
`src/main/ipc/library-search-handlers.ts` (every body in try/catch, typed errors), registered with `lazily`, preload
`src/preload/api/library-search.ts`. The model download reuses `embedding:model:download` / `embedding:download:progress`; the renderer never
sees a key.

## 11. Not in this slice

b-roll and other video / image searches beyond what `list_assets` and the Assets box already get; templates / packs; transcripts; image
embeddings (CLIP); a labelled set for images / videos; re-labelling E3's corpus `∅` rows; moving the Embedding Tester to a utilityProcess.

## 12. Build order (S3 parts; each hand-off sized, red first)

- **S3a — the service, pure:** shared types, `item-text`, `search-pool`, `keyword-retriever`, `fuse`, `library-search` with injected deps;
  the benchmark fixture (labelled set + precomputed vectors + its script) and the §9.1 tests (Smart thresholds, Basic = today, no-claim,
  nothing-fits).
- **S3b — the engine:** `src/library-search-engine/` (utilityProcess host + worker, `dtype: 'q8'`, prefixes, mean pooling, the vector file),
  the electron-vite entry, `vector-sync`, the gated live-model test, the `embedding-engine/worker.ts` `dtype` fix + test.
- **S3c — IPC + settings:** channels, types, handlers, preload, `search-settings`, status, events, the background build after a download /
  index write, the `lazily` registration; the ping-loop check (§9.3 1) run by the builder.
- **S3d — the agent tools:** `generate_sfx` / `generate_music` on the service with the §8.1 answer (E3's answer tests rewritten to the new
  wording; the matcher / corpus tests untouched), `REUSE_NOTE` / `FORCE_HINT` / prompt :31-32 pinned; `list_assets` library query ranked.
- **S3e — the UI:** the Settings row + download, the Assets box (hook, merge, marker), a CDP click-through on an isolated profile (§9.3 2–3).
  *(Added by the orchestrator 2026-10-29 17:49, ruling LS-r7 — this list first omitted the third rung:)* **`rerank.ts`** (§3, §8.3) — the
  app-default text provider through `llmEngine.generate` + the usage log (`featureSource: 'library-search-rerank'`), for Assets-box requests
  only, behind the explicit Smart + AI rerank choice, the row's choice enabled; unit tests with an injected generator; the live call is
  DEFERRED-HASAN (§9.4).
- **Records** (Status.md entry at the top + TESTING.md **§19**) are written after S4's PASS, per Hasan's paste-in.
