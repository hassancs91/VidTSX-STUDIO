# S1 — the spike report: keywords vs local embeddings vs hybrid vs the LLM pick (library search)

> Part S1 of library search (branch `library-search`), written by S1 builder #4 on 2026-10-29. No product code: `src/` is
> unchanged since `c5a6124` (`git log -1 -- src/` = `c5a6124` as of `c642c2a`, this report's parent commit; re-checked after the
> commit in `S1/HANDOFF.md` "Verified"). **Every number below names the kit report file it comes from.** The kit is `K` =
> `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S1\` (outside the tree); a bare file name below means `K\reports\<name>`, written by the
> kit's drivers (`K\run-*.cjs`, `K\build-tables.cjs`, `K\d-diff.cjs`). Big outputs and the model files are on
> `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\`. The S1 records are `docs/studio/search/S1/HANDOFF.md` (Done 1–25) and `S1/LOG.md`.

## 0. Headline

- **STOP judgement: not fired — S1 is DONE** (§13). Every embedding model beats the keyword baseline on recall@10 by a clear margin on
  BOTH readings: **ALL 91.8 → 97.5–98.7** (+5.7 to +6.9 points; misses fall from 8.2 % to 1.3–2.5 % of named rows) and **HELD-OUT 73.4 →
  93.2–96.0** (+19.8 to +22.6) (`z-matrix.md`, R@10). The numbers point to the decided design (keywords + local embeddings for recall + the
  assistant's pick), not away from it.
- **Best retrieval: (c) RRF K = 60 over the keyword list + multilingual-e5-small** — ALL R@10 99.3 / R@20 99.9 / MRR 0.917; HELD-OUT 97.9 /
  99.8 / 0.742; CORPUS 100.0 / 100.0 / 0.995 (`c-rrf60-multilingual-e5-small-mean.md`).
- **Recommendation (Hasan's rule, §12): Smart's default model = multilingual-e5-small** (q8, mean pooling, `query: ` / `passage: `),
  fused with the keyword list by RRF K = 60; **the pick = the assistant over the top-N**; N = 20 for the tool answer (§14).
- **The pick (d)** over the top-20 of (c): R@1 151 / 187 = 80.7 % — "pick acc (named)", which also counts a "none" on an `'x|∅'` row,
  170 / 187 = 90.9 % — and wrong-confident 15 / 240 = 6.3 %, against (a)'s 61 / 240 = 25.4 % on the same rows (`d-pick-top20.md`, §10).
- **(e) the local cross-encoder:** no gain over (c) (ALL R@1 86.6 vs 87.4, MRR 0.911 vs 0.917, Arabic R@1 10.0 vs 50.0) at 243.7 ms per
  request (p50, 20 pairs) — not recommended (`e-rerank-ms-marco-MiniLM-L-6-v2.md`, `e-rerank-ms-marco-MiniLM-L-6-v2-timing-node.md`, §11).
- **S2 / S3 must act on:** the app's worker cannot load a catalog model as written (needs `dtype: 'q8'`, §9); no retrieval floor
  separates "the library lacks it" from a real ask — "nothing fits" must be the pick's "none" (§8); the first index build runs in the
  background (2,000 items ≈ 49 s, §7).

## 1. The labelled set

Built by `K\build-labelled-set.cjs` → `K\labelled-set.json`; composition table verbatim from `K\reports\labelled-set-summary.txt`:
**1,565 rows — 1,375 named, 140 `∅`, 50 `*` (never scored); 2,899 excluded.** Scored rows = 1,515 (named + `∅`).

Row conventions (E3's, `sound-match-corpus-rows.ts:1-22`): `'a|b'` = the first must be one of these; `'∅'` = the library lacks
the sound; `'a|∅'` = either (counted as a named row); `'*'` = anything (not scored). The library = the 51-clip fixture
`sound-match-corpus.fixture.ts` (45 sfx + 6 music).

| source | rows | named | ∅ | * | music | labelled by |
|---|---|---|---|---|---|---|
| sound-match-corpus.test.ts | 150 | 116 | 33 | 1 | 22 | corpus (E3, committed) |
| sound-match-corpus-r3-inflections.test.ts | 194 | 193 | 1 | 0 | 0 | corpus (E3, committed) |
| sound-match-corpus-r3-ordinary.test.ts | 132 | 125 | 5 | 2 | 34 | corpus (E3, committed) |
| sound-match-corpus-r3-placement.test.ts | 129 | 129 | 0 | 0 | 0 | corpus (E3, committed) |
| sound-match-corpus-r3-senses.test.ts | 204 | 136 | 22 | 46 | 0 | corpus (E3, committed) |
| sound-match-corpus-r4-frames.test.ts | 67 | 65 | 2 | 0 | 0 | corpus (E3, committed) |
| sound-match-corpus-r4-ordinary.test.ts | 197 | 186 | 10 | 1 | 11 | corpus (E3, committed) |
| r5/j-falling.txt | 12 | 12 | 0 | 0 | 0 | S1 (plain meaning) |
| r5/c-ordinary.txt | 175 | 171 | 4 | 0 | 0 | verifier r5 (its "right X", verbatim) |
| r5/d-stopword.txt | 236 | 174 | 62 | 0 | 0 | S1 (plain meaning, per verb) |
| r5/i-nine.txt | 6 | 6 | 0 | 0 | 0 | S1 (plain meaning) |
| r5/e-realindex.txt | 2 | 2 | 0 | 0 | 0 | S1 (plain meaning) |
| r5/b-broad-flagged.txt | 26 | 26 | 0 | 0 | 0 | S1 (plain meaning; the verifier's "right" widened) |
| S1-own-en | 25 | 24 | 1 | 0 | 1 | S1 (plain meaning, new row) |
| S1-own-ar | 10 | 10 | 0 | 0 | 1 | S1 (plain meaning, new row; Arabic) |

- **The corpus (7 files, 1,073 rows)** = E3's committed rows, recounted (150 + 194 + 132 + 129 + 204 + 67 + 197 = 1,073, matching the
  E3 records; `K\build-kit.log`). Their labels are E3's.
- **The r3 / r4 probe files add no row:** every prompt of r3 `b-probes` (513), `c-probes2` (141), `c-probes3` (41) and r4 `g-probe`
  (32), `c-ordinary` (247), `f-probe` (44) is already a corpus row (`K\survey-probes.cjs` → `K\probe-parse.json`, "dupCorpus").
- **r5 adds the held-out rows.** Only r5 `c-ordinary` carries the verifier's own verdict ("right X", used verbatim). `j-falling`,
  `i-nine`, `e-realindex` and `d-stopword` (one label per verb, frame rule inside) are S1's plain-meaning labels (`K\s1-labels.json`).
  `b-broad-flagged`: only the named "sparkling" / "swooshing" / "quiet" sets are kept, labelled by S1 with the verifier's single
  "right" **widened** (sparkle → `sparkle-soft|pop-reveal`; swoosh → the W group `whoosh-soft|whoosh-wind|whoosh-reverse|whoosh-data-burst`).
  Every row's `labelledBy` field in `labelled-set.json` says who labelled it.
- **S1-own (35 rows)**: 25 English (synonyms, scene descriptions; 1 `∅`, 1 music) and 10 Arabic (1 music), e.g. "صوت زجاج يتكسر" →
  `break-glass-crack`. Heads-up: `S1-own-en` turned out keyword-easy ((a) scores 100 at every k, `K\reports\a-keywords.md`).
- **HELD-OUT** = r5/* + S1-own-* (492 scored rows, 425 named / 67 `∅`): rows the keyword matcher was never tuned on. **CORPUS** = the seven
  committed files (1,023 scored rows, 950 named / 73 `∅`): the keyword matcher's own acceptance bar, so (a) is at 100 there by
  construction. Every table gives ALL, CORPUS and HELD-OUT.

**Excluded (2,899 rows, source · reason · count; `K\reports\labelled-set-summary.txt`):**

| source | reason | count |
|---|---|---|
| r5/b-broad-flagged.txt | machine frame cross-product outside the named sets | 2,674 |
| r5/b-broad-flagged.txt | machine cross-product (odd noun or -ed form) inside the named sets | 99 |
| r5/b-broad-flagged.txt | machine inflection in an adjective frame | 13 |
| r5/b-broad-flagged.txt | named "quiet" set: participle used as a noun | 3 |
| r5/d-stopword.txt | machine particle cross-product ("… X over / down") | 95 |
| r5/d-stopword.txt | ungrammatical frame | 1 |
| r5/i-nine.txt | machine inflection (no sound meaning) | 8 |
| r5/i-nine.txt | machine inflection ('softing' is not a word) | 2 |
| r5/i-nine.txt | machine inflection ('softed' is not a word) | 1 |
| r4/f-probe.txt, r5/c-ordinary.txt | not a prompt (header lines, a term inside a terms list) | 3 |

Duplicates across r5 files are kept once (first file wins).

## 2. Measures (definitions)

From `K\eval-lib.cjs` (header) and `K\run-d-pick.cjs` (header):

- **pool** = the matcher's own candidate filter (`isCandidate`: sound class sfx / music + minimum length), applied to EVERY candidate.
- **recall@k** = the share of named rows (incl. `'x|∅'`) with an allowed clip among the first k of the candidate's ordered list.
  `'∅'` rows are not in recall; `'*'` rows are never scored.
- **MRR** = mean over named rows of 1 / (rank of the first allowed clip), 0 when none is ranked.
- **wrong-confident** (rows with a pick) = a confident pick that is not an allowed clip; on a `'∅'` row, any confident pick. Over all
  scored rows of the group.
- (a) has a pick (the answer's first row; confident = its label is `[matched]`, coverage ≥ 0.5). (d) has a pick (the model's answer;
  every pick is confident, "none" = no pick). (b), (c), (e) are retrieval only — no pick, no wrong-confident rate.

## 3. The candidates

- **(a) keywords at `c5a6124`** (`K\run-a-keywords.cjs` → `a-keywords.md|json`): the worktree's `sound-match.ts` + `sound-answer.ts`,
  bundled by `K\build-kit.cjs`. Ordered list = the answer's ≤ 3 rows in `selectSoundAnswer` order (what the assistant sees today),
  then the other confident matches (coverage ≥ 0.5) in rank order, then the rest by coverage; clips scoring 0 are not ranked (a miss
  at any k). The matcher's own order (a′) is in `a2-keywords-matcher-order.md` (ALL R@10 91.8, same as (a)).
- **(b) local embeddings** (`K\run-b-embeddings.cjs <id> <pooling>` → `b-<id>-<pooling>.md|json`): transformers.js 4.0.1 the app's way
  (`pipeline('feature-extraction', <absolute dir>, { local_files_only: true })`, `allowRemoteModels = false`) **plus `dtype: 'q8'`** (§9);
  item text = `itemText(e)` = id with hyphens as spaces + category + tags + description joined by ". "; query = the prompt; each
  model's prefixes (e5: `query: ` / `passage: `; bge-small-en-v1.5: query instruction "Represent this sentence for searching relevant
  passages: "; MiniLM none). Ranked by cosine over the pool. Pooling: mean (the app's worker, always); bge also CLS (its model card).
  Four catalog models: all-MiniLM-L6-v2, bge-small-en-v1.5 (mean + CLS), multilingual-e5-small, multilingual-e5-base. bge-m3 (568 MB) was
  not downloaded: me5-base (2.2× me5-small's bytes) already scored below me5-small.
- **(c) hybrid RRF** (`K\run-c-hybrid.cjs <id> <pooling> 60` → `c-rrf60-<id>-<pooling>.md|json`): fused(clip) = Σ 1 / (60 + rank) over
  (a)'s list and (b)'s full ranking; ties by cosine.
- **(d) the LLM pick** (§10): the app's keyless `claude-subscription` picking from the top-20 of (c) RRF60 + me5-small, and from the full
  51-clip library.
- **(e) cross-encoder reranker** (§11): `Xenova/ms-marco-MiniLM-L-6-v2` re-ordering the top-20 of (c) RRF60 + me5-small.

## 4. Recall and MRR — ALL / CORPUS / HELD-OUT

From `z-matrix.md` (built by `K\build-tables.cjs` from the `table` field of each candidate's report `.json`; its recomputation of R@1 /
3 / 10 / 20 from every `perRow[].ranked` matched each table: "0 mismatches"). Cells are R@1 · R@3 · R@10 · R@20 (%) · MRR. Named rows: ALL
1,375 · CORPUS 950 · HELD-OUT 425.

| candidate (report file) | ALL | CORPUS (7 files) | HELD-OUT (r5 + S1-own) |
|---|---|---|---|
| (a) keywords (`a-keywords`) | 83.9 · 90.8 · 91.8 · 91.9 · 0.874 | 98.4 · 100.0 · 100.0 · 100.0 · 0.992 | 51.3 · 70.1 · 73.4 · 73.6 · 0.612 |
| (b) all-MiniLM-L6-v2 mean (`b-all-MiniLM-L6-v2-mean`) | 81.0 · 92.7 · 97.7 · 99.1 · 0.874 | 93.3 · 98.2 · 99.8 · 99.9 · 0.958 | 53.6 · 80.2 · 93.2 · 97.4 · 0.684 |
| (b) bge-small-en-v1.5 mean (`b-bge-small-en-v1.5-mean`) | 84.1 · 93.6 · 97.6 · 98.7 · 0.894 | 92.6 · 97.8 · 99.3 · 99.9 · 0.953 | 65.2 · 84.2 · 93.9 · 96.0 · 0.760 |
| (b) bge-small-en-v1.5 CLS (`b-bge-small-en-v1.5-cls`) | 84.1 · 93.5 · 97.5 · 99.0 · 0.893 | 93.1 · 97.7 · 99.4 · 99.9 · 0.956 | 64.0 · 84.0 · 93.2 · 96.9 · 0.753 |
| (b) multilingual-e5-small mean (`b-multilingual-e5-small-mean`) | 83.6 · 92.7 · 98.7 · 99.8 · 0.886 | 94.9 · 98.6 · 99.9 · 100.0 · 0.968 | 58.1 · 79.3 · 96.0 · 99.3 · 0.704 |
| (b) multilingual-e5-base mean (`b-multilingual-e5-base-mean`) | 79.3 · 90.8 · 97.8 · 99.6 · 0.859 | 89.6 · 98.0 · 99.7 · 99.8 · 0.938 | 56.5 · 74.6 · 93.6 · 99.3 · 0.683 |
| (c) RRF60 + MiniLM (`c-rrf60-all-MiniLM-L6-v2-mean`) | 87.7 · 95.3 · 99.3 · 99.6 · 0.922 | 98.8 · 100.0 · 100.0 · 100.0 · 0.994 | 62.8 · 84.7 · 97.9 · 98.8 · 0.760 |
| (c) RRF60 + bge-small mean (`c-rrf60-bge-small-en-v1.5-mean`) | 88.6 · 95.9 · 98.8 · 99.1 · 0.927 | 98.7 · 100.0 · 100.0 · 100.0 · 0.994 | 65.9 · 86.6 · 96.2 · 97.2 · 0.778 |
| (c) RRF60 + bge-small CLS (`c-rrf60-bge-small-en-v1.5-cls`) | 88.4 · 95.6 · 98.9 · 99.1 · 0.925 | 98.9 · 100.0 · 100.0 · 100.0 · 0.995 | 64.7 · 85.6 · 96.5 · 97.2 · 0.768 |
| **(c) RRF60 + me5-small** (`c-rrf60-multilingual-e5-small-mean`) | **87.4 · 94.8 · 99.3 · 99.9 · 0.917** | **99.1 · 100.0 · 100.0 · 100.0 · 0.995** | **61.4 · 83.3 · 97.9 · 99.8 · 0.742** |
| (c) RRF60 + me5-base (`c-rrf60-multilingual-e5-base-mean`) | 87.2 · 93.2 · 98.4 · 99.8 · 0.911 | 97.4 · 100.0 · 100.0 · 100.0 · 0.987 | 64.5 · 77.9 · 94.8 · 99.3 · 0.741 |
| (e) rerank of (c) me5-small's top-20 (`e-rerank-ms-marco-MiniLM-L-6-v2`) | 86.6 · 94.5 · 98.8 · 99.9 · 0.911 | 96.1 · 99.1 · 100.0 · 100.0 · 0.977 | 65.4 · 84.5 · 96.0 · 99.8 · 0.763 |

Reading: fusing the keyword list in helps every model at every k on ALL (e.g. me5-small R@1 83.6 → 87.4, R@10 98.7 → 99.3); the hybrid
puts CORPUS back at 100.0 for R@3 and beyond. The e5 models are the only ones that read Arabic (S1-own-ar R@20: e5 100.0, the English
models 50.0; §5). bge-small CLS vs mean (the card says CLS) makes no material difference (ALL R@20 99.0 vs 98.7).

## 5. Per source file (S2 sets per-file thresholds from these)

Verbatim from `z-matrix.md`. Columns → report file: **a kw** = `a-keywords` · **b MiniLM** = `b-all-MiniLM-L6-v2-mean` · **b bge mean** =
`b-bge-small-en-v1.5-mean` · **b bge cls** = `b-bge-small-en-v1.5-cls` · **b me5-s** = `b-multilingual-e5-small-mean` · **b me5-b** =
`b-multilingual-e5-base-mean` · **c …** = `c-rrf60-<same model>` · **e rerank** = `e-rerank-ms-marco-MiniLM-L-6-v2` (each `.json` / `.md`).

### R@1 (%)

| source | named | a kw | b MiniLM | b bge mean | b bge cls | b me5-s | b me5-b | c MiniLM | c bge mean | c bge cls | c me5-s | c me5-b | e rerank |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 1375 | 83.9 | 81.0 | 84.1 | 84.1 | 83.6 | 79.3 | 87.7 | 88.6 | 88.4 | 87.4 | 87.2 | 86.6 |
| CORPUS (7 files) | 950 | 98.4 | 93.3 | 92.6 | 93.1 | 94.9 | 89.6 | 98.8 | 98.7 | 98.9 | 99.1 | 97.4 | 96.1 |
| HELD-OUT (r5 + S1-own) | 425 | 51.3 | 53.6 | 65.2 | 64.0 | 58.1 | 56.5 | 62.8 | 65.9 | 64.7 | 61.4 | 64.5 | 65.4 |
| sound-match-corpus.test.ts | 116 | 99.1 | 94.0 | 89.7 | 90.5 | 97.4 | 94.0 | 98.3 | 97.4 | 97.4 | 99.1 | 97.4 | 96.6 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 100.0 | 94.8 | 94.8 | 93.8 | 97.9 | 91.2 | 99.0 | 98.4 | 99.0 | 99.0 | 96.4 | 96.9 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 100.0 | 87.2 | 92.0 | 92.8 | 93.6 | 88.8 | 96.8 | 97.6 | 98.4 | 98.4 | 97.6 | 97.6 |
| sound-match-corpus-r3-placement.test.ts | 129 | 100.0 | 100.0 | 96.1 | 97.7 | 98.4 | 96.9 | 100.0 | 100.0 | 100.0 | 100.0 | 96.9 | 98.4 |
| sound-match-corpus-r3-senses.test.ts | 136 | 99.3 | 84.6 | 81.6 | 85.3 | 85.3 | 74.3 | 98.5 | 98.5 | 98.5 | 97.1 | 99.3 | 91.9 |
| sound-match-corpus-r4-frames.test.ts | 65 | 81.5 | 98.5 | 95.4 | 92.3 | 93.8 | 83.1 | 100.0 | 98.5 | 98.5 | 100.0 | 93.8 | 86.2 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 99.5 | 95.2 | 97.3 | 96.8 | 96.2 | 94.1 | 99.5 | 100.0 | 100.0 | 100.0 | 98.4 | 98.9 |
| r5/j-falling.txt | 12 | 25.0 | 83.3 | 91.7 | 91.7 | 91.7 | 58.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 83.3 |
| r5/c-ordinary.txt | 171 | 72.5 | 70.2 | 77.2 | 74.3 | 76.6 | 81.3 | 80.1 | 85.4 | 84.2 | 81.3 | 88.9 | 68.4 |
| r5/d-stopword.txt | 174 | 37.4 | 35.1 | 50.0 | 50.0 | 32.8 | 23.6 | 50.6 | 48.3 | 46.6 | 38.5 | 36.2 | 59.2 |
| r5/i-nine.txt | 6 | 16.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 50.0 | 50.0 | 50.0 | 33.3 | 50.0 | 66.7 |
| r5/e-realindex.txt | 2 | 0.0 | 50.0 | 100.0 | 100.0 | 100.0 | 50.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/b-broad-flagged.txt | 26 | 3.8 | 26.9 | 61.5 | 61.5 | 53.8 | 80.8 | 34.6 | 61.5 | 61.5 | 73.1 | 88.5 | 69.2 |
| S1-own-en | 24 | 100.0 | 91.7 | 91.7 | 91.7 | 87.5 | 87.5 | 95.8 | 100.0 | 100.0 | 95.8 | 95.8 | 95.8 |
| S1-own-ar | 10 | 0.0 | 10.0 | 10.0 | 10.0 | 50.0 | 40.0 | 10.0 | 10.0 | 10.0 | 50.0 | 40.0 | 10.0 |

### R@3 (%)

| source | named | a kw | b MiniLM | b bge mean | b bge cls | b me5-s | b me5-b | c MiniLM | c bge mean | c bge cls | c me5-s | c me5-b | e rerank |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 1375 | 90.8 | 92.7 | 93.6 | 93.5 | 92.7 | 90.8 | 95.3 | 95.9 | 95.6 | 94.8 | 93.2 | 94.5 |
| CORPUS (7 files) | 950 | 100.0 | 98.2 | 97.8 | 97.7 | 98.6 | 98.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.1 |
| HELD-OUT (r5 + S1-own) | 425 | 70.1 | 80.2 | 84.2 | 84.0 | 79.3 | 74.6 | 84.7 | 86.6 | 85.6 | 83.3 | 77.9 | 84.5 |
| sound-match-corpus.test.ts | 116 | 100.0 | 99.1 | 97.4 | 97.4 | 99.1 | 99.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 100.0 | 99.0 | 99.5 | 99.0 | 99.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.0 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 100.0 | 98.4 | 95.2 | 96.8 | 97.6 | 95.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-placement.test.ts | 129 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-senses.test.ts | 136 | 100.0 | 94.1 | 93.4 | 92.6 | 94.9 | 93.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 97.1 |
| sound-match-corpus-r4-frames.test.ts | 65 | 100.0 | 98.5 | 98.5 | 98.5 | 98.5 | 96.9 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 95.4 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 100.0 | 98.4 | 99.5 | 98.9 | 100.0 | 99.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/j-falling.txt | 12 | 33.3 | 91.7 | 100.0 | 100.0 | 100.0 | 83.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 100.0 |
| r5/c-ordinary.txt | 171 | 97.1 | 85.4 | 94.7 | 93.6 | 91.8 | 97.1 | 95.3 | 99.4 | 98.8 | 97.7 | 98.8 | 86.0 |
| r5/d-stopword.txt | 174 | 42.5 | 74.7 | 71.8 | 72.4 | 59.8 | 44.8 | 77.0 | 77.6 | 75.9 | 67.8 | 54.0 | 79.3 |
| r5/i-nine.txt | 6 | 33.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/e-realindex.txt | 2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/b-broad-flagged.txt | 26 | 100.0 | 84.6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-en | 24 | 100.0 | 95.8 | 100.0 | 100.0 | 95.8 | 95.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-ar | 10 | 0.0 | 10.0 | 10.0 | 10.0 | 70.0 | 60.0 | 10.0 | 10.0 | 10.0 | 70.0 | 60.0 | 40.0 |

### R@10 (%)

| source | named | a kw | b MiniLM | b bge mean | b bge cls | b me5-s | b me5-b | c MiniLM | c bge mean | c bge cls | c me5-s | c me5-b | e rerank |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 1375 | 91.8 | 97.7 | 97.6 | 97.5 | 98.7 | 97.8 | 99.3 | 98.8 | 98.9 | 99.3 | 98.4 | 98.8 |
| CORPUS (7 files) | 950 | 100.0 | 99.8 | 99.3 | 99.4 | 99.9 | 99.7 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| HELD-OUT (r5 + S1-own) | 425 | 73.4 | 93.2 | 93.9 | 93.2 | 96.0 | 93.6 | 97.9 | 96.2 | 96.5 | 97.9 | 94.8 | 96.0 |
| sound-match-corpus.test.ts | 116 | 100.0 | 100.0 | 97.4 | 99.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 100.0 | 100.0 | 100.0 | 99.2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-placement.test.ts | 129 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-senses.test.ts | 136 | 100.0 | 99.3 | 98.5 | 97.8 | 100.0 | 98.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-frames.test.ts | 65 | 100.0 | 98.5 | 98.5 | 98.5 | 98.5 | 98.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 100.0 | 100.0 | 99.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/j-falling.txt | 12 | 33.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 91.7 | 100.0 |
| r5/c-ordinary.txt | 171 | 99.4 | 95.3 | 100.0 | 98.2 | 99.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 99.4 |
| r5/d-stopword.txt | 174 | 46.0 | 92.0 | 89.7 | 89.1 | 91.4 | 85.1 | 98.9 | 95.4 | 95.4 | 95.4 | 88.5 | 92.5 |
| r5/i-nine.txt | 6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/e-realindex.txt | 2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/b-broad-flagged.txt | 26 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-en | 24 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-ar | 10 | 0.0 | 30.0 | 20.0 | 30.0 | 90.0 | 90.0 | 30.0 | 20.0 | 30.0 | 90.0 | 90.0 | 70.0 |

### R@20 (%)

| source | named | a kw | b MiniLM | b bge mean | b bge cls | b me5-s | b me5-b | c MiniLM | c bge mean | c bge cls | c me5-s | c me5-b | e rerank |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 1375 | 91.9 | 99.1 | 98.7 | 99.0 | 99.8 | 99.6 | 99.6 | 99.1 | 99.1 | 99.9 | 99.8 | 99.9 |
| CORPUS (7 files) | 950 | 100.0 | 99.9 | 99.9 | 99.9 | 100.0 | 99.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| HELD-OUT (r5 + S1-own) | 425 | 73.6 | 97.4 | 96.0 | 96.9 | 99.3 | 99.3 | 98.8 | 97.2 | 97.2 | 99.8 | 99.3 | 99.8 |
| sound-match-corpus.test.ts | 116 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-placement.test.ts | 129 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-senses.test.ts | 136 | 100.0 | 100.0 | 99.3 | 99.3 | 100.0 | 99.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-frames.test.ts | 65 | 100.0 | 98.5 | 100.0 | 100.0 | 100.0 | 98.5 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/j-falling.txt | 12 | 33.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/c-ordinary.txt | 171 | 100.0 | 98.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/d-stopword.txt | 174 | 46.0 | 97.7 | 93.1 | 95.4 | 98.3 | 98.3 | 100.0 | 96.0 | 96.0 | 99.4 | 98.3 | 99.4 |
| r5/i-nine.txt | 6 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/e-realindex.txt | 2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/b-broad-flagged.txt | 26 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-en | 24 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-ar | 10 | 0.0 | 50.0 | 50.0 | 50.0 | 100.0 | 100.0 | 50.0 | 50.0 | 50.0 | 100.0 | 100.0 | 100.0 |

### MRR

| source | named | a kw | b MiniLM | b bge mean | b bge cls | b me5-s | b me5-b | c MiniLM | c bge mean | c bge cls | c me5-s | c me5-b | e rerank |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 1375 | 0.874 | 0.874 | 0.894 | 0.893 | 0.886 | 0.859 | 0.922 | 0.927 | 0.925 | 0.917 | 0.911 | 0.911 |
| CORPUS (7 files) | 950 | 0.992 | 0.958 | 0.953 | 0.956 | 0.968 | 0.938 | 0.994 | 0.994 | 0.995 | 0.995 | 0.987 | 0.977 |
| HELD-OUT (r5 + S1-own) | 425 | 0.612 | 0.684 | 0.760 | 0.753 | 0.704 | 0.683 | 0.760 | 0.778 | 0.768 | 0.742 | 0.741 | 0.763 |
| sound-match-corpus.test.ts | 116 | 0.996 | 0.966 | 0.931 | 0.940 | 0.982 | 0.964 | 0.991 | 0.987 | 0.987 | 0.996 | 0.987 | 0.983 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 1.000 | 0.970 | 0.970 | 0.964 | 0.987 | 0.952 | 0.995 | 0.992 | 0.995 | 0.995 | 0.982 | 0.982 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 1.000 | 0.921 | 0.946 | 0.951 | 0.960 | 0.925 | 0.983 | 0.988 | 0.992 | 0.992 | 0.988 | 0.988 |
| sound-match-corpus-r3-placement.test.ts | 129 | 1.000 | 1.000 | 0.981 | 0.988 | 0.991 | 0.984 | 1.000 | 1.000 | 1.000 | 1.000 | 0.984 | 0.992 |
| sound-match-corpus-r3-senses.test.ts | 136 | 0.996 | 0.902 | 0.882 | 0.901 | 0.906 | 0.842 | 0.993 | 0.993 | 0.993 | 0.985 | 0.996 | 0.948 |
| sound-match-corpus-r4-frames.test.ts | 65 | 0.908 | 0.985 | 0.968 | 0.952 | 0.958 | 0.904 | 1.000 | 0.992 | 0.992 | 1.000 | 0.969 | 0.918 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 0.997 | 0.970 | 0.983 | 0.979 | 0.978 | 0.968 | 0.997 | 1.000 | 1.000 | 1.000 | 0.992 | 0.994 |
| r5/j-falling.txt | 12 | 0.292 | 0.882 | 0.958 | 0.958 | 0.958 | 0.738 | 0.473 | 0.489 | 0.489 | 0.485 | 0.460 | 0.917 |
| r5/c-ordinary.txt | 171 | 0.847 | 0.789 | 0.864 | 0.845 | 0.844 | 0.887 | 0.879 | 0.922 | 0.914 | 0.889 | 0.938 | 0.790 |
| r5/d-stopword.txt | 174 | 0.406 | 0.568 | 0.637 | 0.637 | 0.505 | 0.406 | 0.677 | 0.656 | 0.637 | 0.570 | 0.510 | 0.708 |
| r5/i-nine.txt | 6 | 0.403 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 0.750 | 0.750 | 0.750 | 0.667 | 0.750 | 0.833 |
| r5/e-realindex.txt | 2 | 0.500 | 0.750 | 1.000 | 1.000 | 1.000 | 0.750 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| r5/b-broad-flagged.txt | 26 | 0.519 | 0.571 | 0.788 | 0.788 | 0.731 | 0.904 | 0.673 | 0.808 | 0.808 | 0.865 | 0.942 | 0.846 |
| S1-own-en | 24 | 1.000 | 0.941 | 0.958 | 0.958 | 0.918 | 0.924 | 0.979 | 1.000 | 1.000 | 0.979 | 0.979 | 0.972 |
| S1-own-ar | 10 | 0.000 | 0.153 | 0.153 | 0.166 | 0.639 | 0.574 | 0.153 | 0.153 | 0.166 | 0.639 | 0.574 | 0.272 |

Per-file notes for S2: `r5/j-falling` — the hybrid's R@1 drops to 33.3 from (b)'s 91.7 because the keyword list's confident wrong
matches (the F5b case) fuse in at the top; by R@5 (c) me5-small is at 91.7 and by R@8 at 100.0 (§14). `r5/d-stopword` (vague verb-only
prompts) is the weakest file for every candidate (best R@10 98.9, (c) MiniLM). Small files (`i-nine` 6, `e-realindex` 2 named rows) are too
small to set a threshold from alone.

## 6. Wrong-confident rates

**(a) keywords** — the answer's first row labelled `[matched]` and not allowed (`K\reports\a-keywords.md`):

| source | scored rows | wrong-confident | wc named | wc ∅ |
|---|---|---|---|---|
| ALL | 1,515 | 100 / 1,515 (6.6 %) | 88 | 12 |
| CORPUS (7 files) | 1,023 | 4 / 1,023 (0.4 %) | 4 | 0 |
| HELD-OUT (r5 + S1-own) | 492 | 96 / 492 (19.5 %) | 84 | 12 |
| sound-match-corpus.test.ts | 149 | 0 (0.0 %) | 0 | 0 |
| sound-match-corpus-r3-inflections.test.ts | 194 | 0 (0.0 %) | 0 | 0 |
| sound-match-corpus-r3-ordinary.test.ts | 130 | 0 (0.0 %) | 0 | 0 |
| sound-match-corpus-r3-placement.test.ts | 129 | 0 (0.0 %) | 0 | 0 |
| sound-match-corpus-r3-senses.test.ts | 158 | 0 (0.0 %) | 0 | 0 |
| sound-match-corpus-r4-frames.test.ts | 67 | 3 (4.5 %) | 3 | 0 |
| sound-match-corpus-r4-ordinary.test.ts | 196 | 1 (0.5 %) | 1 | 0 |
| r5/j-falling.txt | 12 | 5 (41.7 %) | 5 | 0 |
| r5/c-ordinary.txt | 175 | 23 (13.1 %) | 23 | 0 |
| r5/d-stopword.txt | 236 | 37 (15.7 %) | 25 | 12 |
| r5/i-nine.txt | 6 | 4 (66.7 %) | 4 | 0 |
| r5/e-realindex.txt | 2 | 2 (100.0 %) | 2 | 0 |
| r5/b-broad-flagged.txt | 26 | 25 (96.2 %) | 25 | 0 |
| S1-own-en | 25 | 0 (0.0 %) | 0 | 0 |
| S1-own-ar | 10 | 0 (0.0 %) | 0 | 0 |

**(d) the LLM pick** — on the 240-row sample (`K\reports\d-pick-top20.md`, `K\reports\d-pick-full51.md`): top-20 of (c) 15 / 240 = 6.3 %
(4 named, 11 `∅`); full 51 18 / 240 = 7.5 % (8 named, 10 `∅`). On the SAME 240 rows, (a)'s pick is wrong-confident on 61 / 240 = 25.4 %
(the sample over-weights (a)'s confident errors on purpose: stratum A, §10). HELD-OUT: top-20 5 / 141 = 3.5 %, full 51 8 / 141 = 5.7 %,
(a) 57 / 141 = 40.4 %. CORPUS: 10 / 99 = 10.1 % in both conditions (top-20: all 10 on `∅` rows; full 51: 9 `∅` + 1 named), (a) 4 / 99 =
4.0 % — the corpus `∅` caveat in §8 explains most of these.

## 7. Timing, size, memory, indexing (THIS laptop)

From `K\reports\t-<id>-<pooling>-<node|electron>.md` (`K\run-t-timing.cjs`; plain node 22.14.0 and `ELECTRON_RUN_AS_NODE=1` Electron
41.0.2 / node 24.14.0; main thread, not the app's `worker_threads` Worker — the Worker adds a postMessage hop, not measured). Definitions
(the driver's header): **cold** = process start → the first embedding returned; **load** = the model load alone; **RSS** before the import →
after load → after the 2,000-item index; **index 51** = the 51 real item texts in batches of 32, first pass / median of 3 more; **index 2,000**
= synthetic texts (the 51 texts with shuffled tags + a variant number — timing only), batches of 32; **warm** = 300 distinct labelled-set
prompts after 20 warm-up queries, each = embed ONE query (with its prefix) + cosine over the 51 (or 2,000) vectors + sort, p50 / p95. "MB on
disk" is MiB of the four catalog files.

| model | pooling | runtime | MB on disk | cold ms | load ms | RSS MB before → loaded → +2,000 | index 51 ms first / median | index 2,000 ms | warm 51 p50 / p95 ms | warm 2,000 p50 / p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|
| all-MiniLM-L6-v2 | mean | node 22.14.0 | 22.6 | 405 | 228 | 45.9 → 127.4 → 393.9 | 561 / 529 | 21793 | 1.7 / 2.49 | 5.59 / 7.85 |
| all-MiniLM-L6-v2 | mean | electron 41.0.2 (node 24.14.0) | 22.6 | 373 | 240 | 38.7 → 127.9 → 384.6 | 555 / 572 | 21238 | 1.95 / 2.92 | 4.83 / 8.04 |
| bge-small-en-v1.5 | mean | node 22.14.0 | 33.1 | 603 | 381 | 45.8 → 146.8 → 407.6 | 920 / 866 | 35828 | 5.8 / 7.5 | 12.95 / 16.04 |
| bge-small-en-v1.5 | cls | node 22.14.0 | 33.1 | 530 | 358 | 45.8 → 145.7 → 406.7 | 773 / 771 | 29684 | 5.25 / 6.37 | 12.66 / 15.05 |
| bge-small-en-v1.5 | cls | electron 41.0.2 (node 24.14.0) | 33.1 | 504 | 369 | 38.7 → 145.1 → 392.1 | 741 / 746 | 29892 | 5.91 / 7.86 | 12.79 / 16.09 |
| multilingual-e5-small | mean | node 22.14.0 | 129.1 | 1714 | 1540 | 45.8 → 451.6 → 771.8 | 1171 / 1198 | 50814 | 5.2 / 7.95 | 11.84 / 15.24 |
| multilingual-e5-small | mean | electron 41.0.2 (node 24.14.0) | 129.1 | 1421 | 1208 | 36 → 412.8 → 619.5 | 1398 / 1053 | 48551 | 4.83 / 6.33 | 12.23 / 15.88 |
| multilingual-e5-base | mean | node 22.14.0 | 282 | 2036 | 1858 | 45.8 → 609 → 813 | 2343 / 2386 | 107544 | 9.32 / 13.14 | 24.4 / 29.23 |
| multilingual-e5-base | mean | electron 41.0.2 (node 24.14.0) | 282 | 1740 | 1552 | 38.7 → 567.6 → 731.6 | 2289 / 2402 | 102366 | 10 / 13.47 | 23.16 / 31.23 |

(e)'s cross-encoder has a different shape (one request = 20 (prompt, clip) pairs in one batch, no index): from
`e-rerank-ms-marco-MiniLM-L-6-v2-timing-node.md` (node 22.14.0, main thread) — 23,856,961 B on disk · load (tokenizer + model) 759 ms ·
first request 383 ms · **per request p50 243.7 ms / p95 404.01 ms** / max 1386.01 ms over 1,508 timed requests · RSS 64.7 MB before load →
127 MB loaded → 252.2 MB after all rows. That run had external CPU load (vmmemWSL ≈ 26.6 CPU-s per 5 s ≈ 5 of 16 logical cores, measured
at 14:46; HANDOFF Verified), so its absolute times are pessimistic; even halved it is ~5× the 50 ms budget. Its Electron run was not made
(§11).

Model bytes (HEAD sizes on the catalog URLs, stated before the downloads, HANDOFF Done 8; equal to the files on disk): all-MiniLM-L6-v2
23,685,047 B · bge-small-en-v1.5 34,726,871 B · multilingual-e5-small 135,392,016 B (onnx 118,308,185 + tokenizer.json 17,082,730) ·
multilingual-e5-base 295,731,426 B · ms-marco-MiniLM-L-6-v2 (e) 23,856,961 B (onnx 23,143,499). Every warm p95 is ≤ 50 ms (the largest:
me5-base over 2,000 vectors under Electron, 31.23 ms). **Indexing is the slow part**: 2,000 items take 21.2 s (MiniLM) to 107.5 s (me5-base);
me5-small 48.6 s (Electron) / 50.8 s (node) ≈ 24–25 ms per item.

## 8. Floors: no similarity floor separates `∅` from named rows

Per candidate, the top-1 score's distribution on `∅` rows vs named rows, and the Youden floor (the threshold that maximises named-kept −
∅-kept), from each report's floor section (6 empty-pool `∅` rows have no top-1 score and are left out of (b) / (c)):

| candidate (report file) | score | ∅ p50 / p90 | named p05 / p50 | Youden floor → named kept / ∅ kept (J) | floor that drops 90 % of ∅ keeps … of named |
|---|---|---|---|---|---|
| (a) `a-keywords.md` | top-1 coverage | 0.259 / 0.600 | 0.259 / 0.800 | 0.474 → 82.0 % / 21.1 % (0.610) | 72.9 % |
| (b) MiniLM mean `b-all-MiniLM-L6-v2-mean.md` | cosine | 0.296 / 0.424 | 0.276 / 0.465 | 0.389 → 74.5 % / 14.9 % (0.595) | 64.7 % |
| (b) bge-small mean `b-bge-small-en-v1.5-mean.md` | cosine | 0.559 / 0.612 | 0.530 / 0.657 | 0.612 → 71.2 % / 9.7 % (0.615) | 71.2 % |
| (b) bge-small CLS `b-bge-small-en-v1.5-cls.md` | cosine | 0.630 / 0.674 | 0.599 / 0.706 | 0.686 → 60.9 % / 3.0 % (0.580) | 66.4 % |
| (b) me5-small `b-multilingual-e5-small-mean.md` | cosine | 0.813 / 0.828 | 0.807 / 0.849 | 0.825 → 79.2 % / 12.7 % (0.665) | 75.6 % |
| (b) me5-base `b-multilingual-e5-base-mean.md` | cosine | 0.787 / 0.804 | 0.778 / 0.820 | 0.805 → 69.5 % / 8.2 % (0.612) | 70.3 % |
| (c) RRF60 + me5-small `c-rrf60-multilingual-e5-small-mean.md` | fused score | 0.016 / 0.033 | 0.028 / 0.033 | 0.032 → 92.3 % / 33.6 % (0.587) | 64.7 % |
| (c) RRF60 + me5-small, same file | cosine of the fused top-1 | 0.810 / 0.828 | 0.798 / 0.848 | 0.828 → 71.2 % / 8.2 % (0.630) | 71.6 % |
| (e) rerank `e-rerank-ms-marco-MiniLM-L-6-v2.md` | top-1 cross-encoder logit | −7.486 / −2.978 | −8.326 / 1.263 | −2.727 → 73.7 % / 8.2 % (0.655) | 74.5 % |

**Finding:** the best Youden J is 0.665 (me5-small cosine). Any floor that drops ~90 % of the `∅` rows also drops a quarter or more of
the named rows; e5 cosines sit in a narrow high band (me5-small: ∅ p90 0.828 vs named p50 0.849). The RRF fused score is rank-based (max
2 / 61 = 0.0328), so its "floor" measures agreement between the two lists, not similarity. **A retrieval floor cannot be the "nothing fits"
rule; the pick's "none" (§10) is.** That matches the decided design ("NEVER a confident claim from retrieval alone").

**Builder #3's caveat — most `∅` "wrong" picks are corpus `∅` rows that plain meaning would fill.** E3 marked these `∅` to test the
keyword matcher's word senses; a plain-meaning pick fills them. Every pick on a `∅` row, row by row (`K\reports\d-measures-diff.md`):

| id | source | prompt | top-20 pick | full-51 pick |
|---|---|---|---|---|
| #683 | sound-match-corpus-r3-senses.test.ts | "eaten" | crunch-bite | none |
| #822 | sound-match-corpus-r4-frames.test.ts | "a flickering screen" | glitch-zap | none |
| #1429 | r5/d-stopword.txt | "objects shaking" | crash-tumble | none |
| #1045 | sound-match-corpus-r4-ordinary.test.ts | "a snapper" | trap-snap | none |
| #662 | sound-match-corpus-r3-senses.test.ts | "a runner" | dash-zip | dash-zip |
| #375 | sound-match-corpus-r3-ordinary.test.ts | "a buildup" | riser-soft | riser-soft |
| #290 | sound-match-corpus-r3-inflections.test.ts | "taking a picture" | camera-shutter | camera-shutter |
| #833 | sound-match-corpus-r4-frames.test.ts | "a rewound tape" | whoosh-reverse | whoosh-reverse |
| #1048 | sound-match-corpus-r4-ordinary.test.ts | "a river running" | stream-soft | stream-soft |
| #781 | sound-match-corpus-r3-senses.test.ts | "woooosh" | whoosh-soft | whoosh-soft |
| #1046 | sound-match-corpus-r4-ordinary.test.ts | "a clicker" | ui-click-soft | ui-click-soft |
| #1049 | sound-match-corpus-r4-ordinary.test.ts | "a running tap" | none | stream-soft |
| #1192 | r5/c-ordinary.txt | "a glowing screen" | none | warm-shimmer |
| #630 | sound-match-corpus-r3-senses.test.ts | "a probing beep" | none | knock-solid |

(11 picks on `∅` rows in top-20, 10 in full-51; "none" = that condition answered none, which is right on a `∅` row.) S1's reading: 7 of
them ("a runner", "a buildup", "taking a picture", "a rewound tape", "a river running", "woooosh", "a clicker") are fills a person would
accept, and "eaten" → crunch-bite, "a snapper" → trap-snap, "a running tap" → stream-soft are arguable; "a flickering screen" → glitch-zap,
"objects shaking" → crash-tumble, "a glowing screen" → warm-shimmer and "a probing beep" → knock-solid are real misses. The rates in §6 / §10
are as measured against E3's labels; whether S2's bar re-labels the corpus `∅` rows for the pick is S2's (or Hasan's) call.

## 9. The worker `dtype` finding (S2 / S3 must act on it)

The app's embedding worker **cannot load a catalog model as written**. `src/embedding-engine/worker.ts:57-59` calls
`pipeline('feature-extraction', modelPath, { local_files_only: true })`; under `@huggingface/transformers` 4.0.1 that asks for the fp32
`onnx/model.onnx`, while the catalog (`src/embedding-engine/model-registry.ts`) downloads only `onnx/model_quantized.onnx` → "file was not
found locally at …/onnx/model.onnx". Every (b) report's last line records it (`load: fallback dtype q8 (app options failed: …)`, e.g.
`K\reports\b-multilingual-e5-small-mean.md`). The kit loads with `dtype: 'q8'` added (= `model_quantized.onnx`); everything else is the
app's way. **S2 / S3: add `dtype: 'q8'` to the worker's pipeline options** (or download the file the default asks for). The worker also
always mean-pools (`worker.ts:77-80`): right for e5 and MiniLM; for bge-small CLS vs mean made no material difference (§4).

## 10. (d) The LLM pick

**Set-up** (`K\d-build-sample.cjs` → `K\d-sample.json`; HANDOFF Done 18–20): the app's keyless `claude-subscription` through
`window.api.llmGenerate` in an isolated profile (`profiles\search-S1`, copied WITHOUT `settings.db*`; CDP 9290; Studio root set first),
**25 of 40 model calls** (1 probe "Say OK" + 12 + 12; 0 errors, 0 retries; `K\d-calls.jsonl`), model `claude-sonnet-5-5` (the provider's
default). Sample: **240 rows** of the 1,509 with a non-empty pool (mulberry32 seed 20261029, round-robin over source files inside each
stratum): **A** (a)'s pick confident and wrong 40 · **N** the other `∅` rows 50 · **H** other held-out named 90 · **C** other corpus named 60
→ 187 named / 53 `∅`, 228 sfx / 12 music, all 15 source files (sound-match-corpus 19 · r3-inflections 10 · r3-ordinary 13 · r3-placement 9 ·
r3-senses 18 · r4-frames 13 · r4-ordinary 17 · j-falling 12 · c-ordinary 31 · d-stopword 36 · i-nine 6 · e-realindex 2 · b-broad-flagged 26 ·
S1-own-en 18 · S1-own-ar 10). The same 12 batches of 20 rows go to both conditions. Wall per call: top-20 8.2–13.0 s (prompts 113–124 k chars),
full-51 5.2–14.7 s (~18.7 k chars) (`K\reports\d-pick-*.md` "calls").

**The exact prompt template** (verbatim, `K\d-prompt-template.txt`):

```
=== condition top20 (each request carries its own list) ===
You pick sound clips for a video editor's assistant. Each request below is a sound the user asked for in their video.
Clips are shown one per line as: ref | category | duration | tags | description

Rules:
- Answer each request with exactly ONE ref from the clips that request may use, or "none".
- Pick a clip only if it really is the sound asked for, by plain meaning. If no allowed clip is that sound, answer "none": a loosely related or merely similar clip is NOT a fit.
- Judge by what each clip sounds like (its description and tags), not by words that happen to match.

Reply with ONLY a JSON object that maps every request number to a ref or "none", for example {"1": "library:sfx/door-slam.mp3", "2": "none"}. No other text.

### Request <n>
Asked for: "<prompt>" (<a sound effect | music>[, at least <min> s long])
Clips you may use (the search's order, best first):
<one clipLine per candidate of the row's top-20>

=== condition full51 (the library once, then the requests) ===
You pick sound clips for a video editor's assistant. Each request below is a sound the user asked for in their video.
Clips are shown one per line as: ref | category | duration | tags | description

Rules:
- Answer each request with exactly ONE ref from the clips that request may use, or "none".
- Pick a clip only if it really is the sound asked for, by plain meaning. If no allowed clip is that sound, answer "none": a loosely related or merely similar clip is NOT a fit.
- Judge by what each clip sounds like (its description and tags), not by words that happen to match.

Reply with ONLY a JSON object that maps every request number to a ref or "none", for example {"1": "library:sfx/door-slam.mp3", "2": "none"}. No other text.

The library — every clip:
Sound effects (use these for a sound-effect request):
<one clipLine per sfx clip, library order>
Music (use these for a music request):
<one clipLine per music clip, library order>

### Request <n>
Asked for: "<prompt>" (<a sound effect | music>[, at least <min> s long]) — choose from <Sound effects | Music>[ (only clips at least <min> s long)]

clipLine = library:<relPath> | <audio.category> | <duration, 1 decimal> s | <tags joined ", "> | <description>
```

**Two accuracy measures — defined precisely, both given everywhere** (`K\run-d-pick.cjs` header; the difference listed by `K\d-diff.cjs`
→ `K\reports\d-measures-diff.md`):

- **R@1 (the generic table)** = named rows (187, incl. the 31 `'x|∅'` rows) whose pick is an allowed clip. A "none" never counts.
- **pick acc (named)** (the pick table) = named rows whose pick is an allowed clip, **or whose answer is "none" on an `'x|∅'` row**
  (the label allows "the library lacks it").
- They differ by exactly the `'x|∅'` rows answered "none": **19 in top-20, 13 in full-51** (12 of full-51's 13 are among top-20's 19;
  the 13th is #1399 "stuff crackling"). Top-20's 19: #1350 "firing", #1081 "falling", #1364 "stuff landing", #1346 "stuff firing", #1264
  "something falling", #770 "a box shutting", #1457 "objects tapping", #1379 "something moving", #1484 "something splashing", #1284
  "objects sliding", #1374 "the sound of things passing", #1372 "something passing", #1323 "fluttering", #1082 "a falling sound", #160 "a
  popped balloon", #647 "a breaking news sting", #1282 "stuff sliding", #1487 "a splashing sound", #756 "a vacuum sucking" (15 of them
  r5/d-stopword or r5/j-falling — vague verb-only prompts).

| condition (report file) | R@1 (named 187) | pick acc (named 187) | wrong-confident (240) | wc named / ∅ | correct none (∅ 53) | false none (named, ∅ not allowed, 156) |
|---|---|---|---|---|---|---|
| top-20 of (c) RRF60 + me5-small (`d-pick-top20.md`) | 151 / 187 = 80.7 % | 170 / 187 = 90.9 % | 15 / 240 = 6.3 % | 4 / 11 | 42 / 53 = 79.2 % | 13 / 156 = 8.3 % |
| full 51-clip list (`d-pick-full51.md`) | 151 / 187 = 80.7 % | 164 / 187 = 87.7 % | 18 / 240 = 7.5 % | 8 / 10 | 43 / 53 = 81.1 % | 15 / 156 = 9.6 % |
| ref: (c) top-1 alone, same rows (`d-pick-top20.md`) | 72.2 % | — | — | — | — | — |
| ref: (a) pick, same rows (`d-pick-top20.md`) | 54.5 % (pick acc) | — | 61 / 240 = 25.4 % | — | — | — |

By group (`d-pick-top20.md` / `d-pick-full51.md`; R@1 from each file's generic table, pick acc from its pick table):

| group | top-20 R@1 | top-20 pick acc | top-20 wrong-conf | top-20 correct none | full-51 R@1 | full-51 pick acc | full-51 wrong-conf | full-51 correct none |
|---|---|---|---|---|---|---|---|---|
| CORPUS (99 rows; 64 named, 35 ∅) | 93.8 | 64 / 64 = 100.0 % | 10 / 99 (10.1 %) | 25 / 35 (71.4 %) | 92.2 | 61 / 64 = 95.3 % | 10 / 99 (10.1 %) | 26 / 35 (74.3 %) |
| HELD-OUT (141 rows; 123 named, 18 ∅) | 74.0 | 106 / 123 = 86.2 % | 5 / 141 (3.5 %) | 17 / 18 (94.4 %) | 74.8 | 103 / 123 = 83.7 % | 8 / 141 (5.7 %) | 17 / 18 (94.4 %) |
| stratum A ((a) confidently wrong; 40 rows, 37 named) | — | 31 / 37 = 83.8 % | 2 / 40 (5.0 %) | 3 / 3 | — | 28 / 37 = 75.7 % | 4 / 40 (10.0 %) | 3 / 3 |
| stratum N (∅; 50) | — | — | 11 / 50 (22.0 %) | 39 / 50 (78.0 %) | — | — | 10 / 50 (20.0 %) | 40 / 50 (80.0 %) |

Per file (R@1 of the pick, generic table): top-20 — r5/b-broad-flagged 61.5, r5/d-stopword 43.5, r5/c-ordinary 81.5, r5/j-falling 83.3,
r5/i-nine 66.7, S1-own-en 100.0, S1-own-ar 100.0, r3-senses 62.5, the other corpus files 88.9–100.0 (`d-pick-top20.md`); full-51 in
`d-pick-full51.md`. The top-20 ceiling on the sample (an allowed clip in the 20) is 99.5 % (`d-pick-top20.md`).

**Reading.** By strict R@1 the two conditions tie (151 / 187 each). The top-20 condition is better on everything else: pick acc 90.9 vs
87.7 %, wrong-confident 6.3 vs 7.5 % (named wrong picks 4 vs 8), false none 8.3 vs 9.6 %, stratum A 83.8 vs 75.7 %; full-51 answers one more
`∅` row "none" (43 vs 42). The pick over the top-20 lifts (c)'s top-1 from 72.2 % to 80.7 % R@1 / 90.9 % pick acc on the same rows, and
cuts (a)'s wrong-confident rate from 25.4 % to 6.3 %. Most false nones are odd phrasings in the r5 broad set whose labels S1 widened ("a
door sparkling", "a swooshing menu", "a door swooshing open" → none; the lists at the end of each `d-pick-*.md`). And the full-51 condition
only exists because this library has 51 clips: a 2,000-item library cannot go in one prompt.

## 11. (e) The cross-encoder reranker

**Ran, with no new package.** `Xenova/ms-marco-MiniLM-L-6-v2` (English, MS MARCO), the four files curl'd from that HF repo
(`config.json` 824 B · `tokenizer.json` 711,396 B · `tokenizer_config.json` 1,242 B · `onnx/model_quantized.onnx` 23,143,499 B = 23,856,961 B,
the sizes stated before the download and equal on disk) into `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\ms-marco-MiniLM-L-6-v2\`.
Driver `K\run-e-rerank.cjs`: the installed `@huggingface/transformers` 4.0.1 `AutoTokenizer` + `AutoModelForSequenceClassification`, absolute
model dir, `local_files_only`, `allowRemoteModels = false`, `dtype: 'q8'`, cache dirs on scratch. Per row: the 20 clips of (c) RRF60 +
me5-small's `perRow[].ranked` (`c-rrf60-multilingual-e5-small-mean.json`) → 20 (prompt, `itemText(e)`) pairs in one batch → re-ordered by
the logit (ties keep (c)'s order). R@20 equals (c)'s by construction.

| (report file) | ALL R@1 · R@3 · R@10 · R@20 · MRR | CORPUS | HELD-OUT | S1-own-ar R@1 / R@10 |
|---|---|---|---|---|
| (c) RRF60 + me5-small (`c-rrf60-multilingual-e5-small-mean.md`) | 87.4 · 94.8 · 99.3 · 99.9 · 0.917 | 99.1 · 100.0 · 100.0 · 100.0 · 0.995 | 61.4 · 83.3 · 97.9 · 99.8 · 0.742 | 50.0 / 90.0 |
| (e) its top-20 re-ordered (`e-rerank-ms-marco-MiniLM-L-6-v2.md`) | 86.6 · 94.5 · 98.8 · 99.9 · 0.911 | 96.1 · 99.1 · 100.0 · 100.0 · 0.977 | 65.4 · 84.5 · 96.0 · 99.8 · 0.763 | 10.0 / 70.0 |

Where it helps (`z-matrix.md`, R@1): `r5/d-stopword` 38.5 → 59.2, `r5/j-falling` 33.3 → 83.3, `r5/i-nine` 33.3 → 66.7 — the rows where the
keyword list's confident wrong matches sit on top of the fusion. Where it hurts: CORPUS 99.1 → 96.1, `r5/c-ordinary` 81.3 → 68.4,
`r4-frames` 100.0 → 86.2, Arabic 50.0 → 10.0 (English-only model). Its top-1 logit does not give a floor either (Youden J 0.655, §8).
Timing (§7): 243.7 ms p50 / 404.01 ms p95 per request on node — about 5× the 50 ms budget even allowing for the external load.

**Verdict:** no net gain over (c) on ALL at any k, worse on the corpus and on Arabic, and too slow for the query path → **not part of
Smart's default.** The "Smart + AI rerank" rung of the setting ladder is better served by the LLM pick (§10), which lifts top-1 far more
(72.2 % → 80.7 % R@1 on the same rows) and can say "none". The Electron timing run of (e) was not made: it would take another ~9 minutes of
full CPU and could not change this verdict (the scores are identical under either runtime).

## 12. The recommendation (Hasan's rule, applied model by model)

**Rule:** Smart's default model = the smallest whose recall@20 is within 2 points of the best and warm p95 ≤ 50 ms (prefer a multilingual
model if within 3 points); the pick = the assistant over the top-N where an LLM is in the loop.

Recall@20 from `z-matrix.md` (R@20), on (b) alone and inside the (c) hybrid; warm p95 = the worse of node / Electron from `t-*.md` (51 /
2,000 vectors); bytes from §7.

| model | MiB on disk | languages | (b) ALL R@20 (Δ best) | (b) HELD-OUT R@20 (Δ best) | (c) ALL R@20 (Δ best) | warm p95 ms, 51 / 2,000 | ≤ 2 pts on (b) ALL? | p95 ≤ 50? |
|---|---|---|---|---|---|---|---|---|
| all-MiniLM-L6-v2 | 22.6 | English | 99.1 (−0.7) | 97.4 (−1.9) | 99.6 (−0.3) | 2.92 / 8.04 | yes | yes |
| bge-small-en-v1.5 mean | 33.1 | English | 98.7 (−1.1) | 96.0 (−3.3) | 99.1 (−0.8) | 7.5 / 16.04 (node only) | yes | yes |
| bge-small-en-v1.5 CLS | 33.1 | English | 99.0 (−0.8) | 96.9 (−2.4) | 99.1 (−0.8) | 7.86 / 16.09 | yes | yes |
| **multilingual-e5-small** | 129.1 | multilingual | **99.8 (best)** | **99.3 (best, tie)** | **99.9 (best)** | 7.95 / 15.88 | yes | yes |
| multilingual-e5-base | 282 | multilingual | 99.6 (−0.2) | 99.3 (best, tie) | 99.8 (−0.1) | 13.47 / 31.23 | yes | yes |

Applied:
1. **Best recall@20** (ALL, (b)) = 99.8, multilingual-e5-small.
2. **Within 2 points and warm p95 ≤ 50 ms:** all five qualify (lowest 98.7; slowest p95 31.23 ms). The smallest of them is
   all-MiniLM-L6-v2 (22.6 MiB).
3. **Prefer a multilingual model if within 3 points:** multilingual-e5-small (0.0 behind) and multilingual-e5-base (−0.2) are within 3
   points → prefer multilingual; the smaller of the two is **multilingual-e5-small**.
4. **The same answer on every other reading:** on HELD-OUT, step 2 keeps MiniLM (−1.9) and the two e5s (bge mean −3.3 and CLS −2.4 drop
   out), step 3 again picks me5-small; inside the hybrid (c) all five are within 0.8 points and step 3 again picks me5-small. The
   multilingual preference is not cosmetic here: on the 10 Arabic rows (`S1-own-ar`) the English models reach R@20 50.0 and R@10 20.0–30.0,
   me5-small R@20 100.0 / R@10 90.0 (`z-matrix.md`).

**→ Smart's default model = `multilingual-e5-small`** (catalog id; `Xenova/multilingual-e5-small`, 135,392,016 B), q8, mean pooling +
normalise, prefixes `query: ` / `passage: `, used inside the RRF K = 60 hybrid with the keyword list. Its price vs MiniLM (§7, Electron): 5.7×
the bytes, RSS 412.8 vs 127.9 MB loaded, 2,000-item index 48.6 vs 21.2 s, cold 1,421 vs 373 ms — all inside the rule.

**→ The pick = the assistant over the top-N** where an LLM is in the loop (§10: the top-20 condition beats retrieval's top-1 and is equal
or better than the full-library pick on every measure). Retrieval alone never makes a confident claim (§8).

## 13. The STOP judgement

Hasan's rule: STOP if no embedding model beats the keyword baseline on recall@10 by a clear margin, or if the numbers point to a different
design than keywords + local embeddings for recall + the assistant's pick. Judged now, after (a)–(e):

**Condition 1 — recall@10 vs the keyword baseline (`z-matrix.md`, R@10; (a) = `a-keywords.md`).**

| reading | (a) keywords | MiniLM | bge mean | bge CLS | me5-small | me5-base | margin range |
|---|---|---|---|---|---|---|---|
| **ALL** (1,375 named) | 91.8 | 97.7 | 97.6 | 97.5 | 98.7 | 97.8 | **+5.7 to +6.9** |
| **HELD-OUT** (425 named) | 73.4 | 93.2 | 93.9 | 93.2 | 96.0 | 93.6 | **+19.8 to +22.6** |
| CORPUS (950 named; (a)'s own bar, 100 by construction) | 100.0 | 99.8 | 99.3 | 99.4 | 99.9 | 99.7 | −0.1 to −0.7 |

- **ALL reading:** every model beats (a) by 5.7–6.9 points; the share of named rows with no allowed clip in the top 10 falls from 8.2 % to
  1.3 % (me5-small) – 2.5 % (bge CLS), i.e. 3.3–6.3× fewer misses. ALL is diluted by the 950 corpus rows on which (a) is at 100 by
  construction (Open problems 1 in HANDOFF), so this is the conservative reading — and it is still a clear margin.
- **HELD-OUT reading:** every model beats (a) by 19.8–22.6 points (misses 26.6 % → 4.0–6.8 %).
- The two readings **agree**: a clear margin on both. The CORPUS row (−0.1 to −0.7 for (b) alone) is the matcher's tuning set; the hybrid
  (c) brings every model back to 100.0 there, so "no regression vs the keyword baseline on recall@10" (S2's bar) is reachable with (c).
- **Condition 1 does not fire.**

**Condition 2 — do the numbers point to a different design?**

- *Keywords + embeddings beats either alone* for recall: (c) vs (b) on ALL R@10 for me5-small 99.3 vs 98.7, HELD-OUT 97.9 vs 96.0; vs (a)
  91.8 / 73.4 (`z-matrix.md`). Keep both lists.
- *The assistant's pick over the retrieved top-N* beats retrieval's top-1 (72.2 % → 80.7 % R@1 / 90.9 % pick acc on the same 240 rows) and
  cuts the keyword answer's wrong-confident rate from 25.4 % to 6.3 %; it ties the full-library pick on R@1 (80.7 % both) and beats it on
  wrong-confident (6.3 vs 7.5 %) and pick acc (90.9 vs 87.7 %) — and the full-library prompt cannot scale past a small library
  (`d-pick-top20.md`, `d-pick-full51.md`).
- *No retrieval score can stand in for the pick:* no floor separates `∅` from named rows (best Youden J 0.665, §8), which is exactly why the
  design keeps the confident claim with the assistant.
- *The optional local reranker does not earn a place* (§11) — the design already lists it as optional; dropping it changes nothing.
- **Condition 2 does not fire.** The numbers support the decided design (keywords + a small local embedding model for recall, the
  assistant's pick over the top-N, never a confident claim from retrieval alone).

**Judgement: no STOP. S1 is DONE; S2 can start.** Two things are S2's (or Hasan's) to decide, not stops: whether the pick's bar re-labels the
corpus `∅` rows that plain meaning fills (§8), and N (§14).

## 14. What S2 needs

**N for the tool answer.** Recall of (c) RRF60 + multilingual-e5-small at k (named rows; `z-matrix.md` "recall@k from
`reports/c-rrf60-multilingual-e5-small-mean.json` perRow[].ranked", computed by `K\build-tables.cjs`; k = 5 and 8 are new, k = 1 / 3 / 10 / 20
were checked against the report's own table):

| source | named | R@1 | R@3 | R@5 | R@8 | R@10 | R@20 |
|---|---|---|---|---|---|---|---|
| ALL | 1375 | 87.4 | 94.8 | 97.7 | 99.1 | 99.3 | 99.9 |
| CORPUS (7 files) | 950 | 99.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| HELD-OUT (r5 + S1-own) | 425 | 61.4 | 83.3 | 92.7 | 97.2 | 97.9 | 99.8 |
| sound-match-corpus.test.ts | 116 | 99.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-inflections.test.ts | 193 | 99.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-ordinary.test.ts | 125 | 98.4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-placement.test.ts | 129 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r3-senses.test.ts | 136 | 97.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-frames.test.ts | 65 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| sound-match-corpus-r4-ordinary.test.ts | 186 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/j-falling.txt | 12 | 33.3 | 33.3 | 91.7 | 100.0 | 100.0 | 100.0 |
| r5/c-ordinary.txt | 171 | 81.3 | 97.7 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/d-stopword.txt | 174 | 38.5 | 67.8 | 84.5 | 93.7 | 95.4 | 99.4 |
| r5/i-nine.txt | 6 | 33.3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/e-realindex.txt | 2 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| r5/b-broad-flagged.txt | 26 | 73.1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-en | 24 | 95.8 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| S1-own-ar | 10 | 50.0 | 70.0 | 70.0 | 90.0 | 90.0 | 100.0 |

The keyword baseline at the same k (`z-matrix.md`, from `a-keywords.json`): ALL 83.9 · 90.8 · 91.6 · 91.8 · 91.8 · 91.9; CORPUS 98.4 · 100.0 ·
100.0 · 100.0 · 100.0 · 100.0; HELD-OUT 51.3 · 70.1 · 72.9 · 73.4 · 73.4 · 73.6 (R@1 / 3 / 5 / 8 / 10 / 20). The tool shows 3 today: at k = 3
(c) loses 5.1 points on ALL and 16.5 on HELD-OUT against k = 20.

**S1's recommendation: N = 20** — the condition the pick was measured at (ceiling 99.5 % on the sample, `d-pick-top20.md`), R@20 99.9 ALL /
99.8 HELD-OUT, every file ≥ 99.4. Cost: the (d) top-20 prompts ran 113–124 k chars per 20 requests (`d-sample.json` sizes), i.e. ~6 k chars of
clip lines per sound request. A smaller N is unmeasured for the pick; if S2 wants N = 10 for tokens, the recall ceiling drops to 99.3 ALL /
97.9 HELD-OUT / 95.4 on `d-stopword` / 90.0 on Arabic and S2's bar must say so.

**The RRF k:** K = 60 (the only K measured; `run-c-hybrid.cjs`). Fusion = (a)'s ordered list (answer rows, other confident matches, rest by
coverage; 0-coverage clips not in it) + the embedding's full cosine ranking over the pool; ties by cosine. The fused score is rank-based (max
2 / 61) — not a confidence.

**Prefixes / pooling / dtype (me5-small):** query = `"query: " + prompt`; passage = `"passage: " + itemText(e)` with itemText = clip id with
hyphens as spaces + `audio.category` + tags joined ", " + description, joined by ". " (`eval-lib.cjs`); mean pooling + normalise (the
worker's current pooling — keep it); **`dtype: 'q8'` must be added to `worker.ts:57-59`** (§9). 384 dims (`b-multilingual-e5-small-mean.md`).

**The floor finding:** no similarity floor (§8). Retrieval rows must never be labelled `[matched]` / confident on score alone; "nothing fits"
is the assistant's "none" over the top-N.

**The abstention numbers** (the pick over the top-20 of (c), `d-pick-top20.md`): correct none on `∅` rows 42 / 53 = 79.2 % (CORPUS 25 / 35 =
71.4 %, HELD-OUT 17 / 18 = 94.4 %, stratum N 39 / 50 = 78.0 %); false none on named rows that do not allow `∅` 13 / 156 = 8.3 % (CORPUS 0 / 55,
HELD-OUT 13 / 101 = 12.9 %); "none" on `'x|∅'` rows 19 / 31 (`d-measures-diff.md`). The 11 picks on `∅` rows are listed in §8 (7 of them
plain-meaning fills of corpus `∅` labels). Full-51 for comparison: 43 / 53 = 81.1 %, 15 / 156 = 9.6 %, 13 / 31 (`d-pick-full51.md`,
`d-measures-diff.md`).

**The indexing cost:** me5-small indexes the 51 clips in 1,398 ms first / 1,053 ms median and a 2,000-item library in 48.6 s under
Electron (50.8 s node), batches of 32 (`t-multilingual-e5-small-mean-*.md`) — ≈ 24 ms per item. So the **first build must run in the
background with progress** (never index-on-query; a query waits for nothing but the model load, cold 1,421 ms); later builds are
incremental per added / changed clip. Vectors per item: 384 floats (the 2,000-item store is small next to the model).

**Memory:** me5-small RSS 36 → 412.8 MB loaded → 619.5 MB after the 2,000-item index under Electron (node 45.8 → 451.6 → 771.8 MB;
`t-multilingual-e5-small-mean-*.md`). The app's worker runs it in a `worker_threads` Worker (not measured here: S1 timed the main thread).

**Also for S2:** the per-file tables (§5) for per-file thresholds; the (d) prompt template (§10) as the starting point of the tool's
instructions; the label caveat on corpus `∅` rows (§8); the `j-falling` effect (the keyword list's confident wrong matches pull the
fusion's top-1 down, R@1 33.3 — harmless for recall at N ≥ 8, but the tool must not present the fused order as a ranking of confidence).

## 15. Provenance and process

- **Tree:** as of `c642c2a` the worktree was clean, `git log -1 -- src/` = `c5a6124`, `git diff 906273c..c642c2a -- src/ scripts/` empty. This
  report's commit adds only this file and `docs/studio/search/S1/{HANDOFF,LOG}.md` (re-checked after the commit in HANDOFF "Verified").
- **Kit drivers** (in `K`): `build-kit.cjs`, `survey-probes.cjs`, `build-labelled-set.cjs`, `eval-lib.cjs`, `run-a-keywords.cjs`,
  `run-b-embeddings.cjs`, `run-c-hybrid.cjs`, `run-t-timing.cjs`, `d-build-sample.cjs`, `d-cdp.mjs`, `d-run-all.sh`, `run-d-pick.cjs`,
  `run-e-rerank.cjs`, `d-diff.cjs`, `build-tables.cjs`. Reports in `K\reports\`.
- **Models on C:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S1\models\{all-MiniLM-L6-v2, bge-small-en-v1.5, multilingual-e5-small,
  multilingual-e5-base, ms-marco-MiniLM-L-6-v2}\` — 489.6 MiB in all; downloaded only from the catalog's HF repos and the reranker repo
  named in HANDOFF, each size stated first.
- **`node_modules` untouched:** `D:\repos\VidTSX-STUDIO\node_modules` LastWrite 2026-10-16 12:57:48, `@huggingface\transformers` 2026-07-07
  10:32:45 with its 6 children, `node_modules\.cache` 0 items, 0 files written after 2026-10-29 14:39 (checked 14:50 after (e)); the scratch
  `tf-cache` was never created (`local_files_only`).
- **Model calls:** 25 of 40 (all by builder #3, through the app's keyless `claude-subscription`; 0 errors). Builder #4 made none and did not
  launch the app. No credential store was read.
- **Timing caveats:** main thread, not the app's Worker; the (e) run had external CPU load (§7); builder #2's timing runs did not record the
  machine's load.
- **Process:** builder #2 edited one HANDOFF status line with `sed` (content right; HANDOFF Open problems 6); every other doc edit used the
  Edit / Write tools.
