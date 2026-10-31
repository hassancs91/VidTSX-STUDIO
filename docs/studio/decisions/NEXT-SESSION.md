> **SPENT — this paste-in ran as session 1 (2026-10-30 → 2026-10-31: D1 DONE-WITH-STOPS, D2 accepted with Hasan's answers). Session 2's
> paste-in is `docs/studio/decisions/NEXT-SESSION-2.md`.** Kept verbatim below as the run's brief (ORCHESTRATOR.md cites its lines).

# Next session — DECISION MODELS: one shared decision service (Hasan 2026-10-30: "implement the logic of decision models so we can use it anywhere — shared logic, two providers and one local model — search, agents, flows, other places; start with the spikes and small tests")

> Written 2026-10-30 15:21 after the library-search run stopped (S4 PASS, `cf7d550`) and a web search on Jev and the new
> decision-model families (summary below). **Edit the "Decisions" block before pasting** — the defaults are the orchestrator's
> recommendations, not Hasan's answers. Paste everything inside the fence into a new Claude Code session at `D:\repos\VidTSX-STUDIO`.

## What the search found (2026-10-30; mostly vendor-reported, weeks old — the spike re-checks every fact from primary docs)

- **Decision model** = answers TYPED questions about a state (text / JSON) with a probability per allowed answer, one fast pass, no prose:
  `choice` (pick one option), `score` (level on a user rubric), `noul` (calibrated P(true)). Jev's "System One" contract
  (`POST /v1/systemone`: `state` + keyed `questions` → `answers` with probabilities + confidence) is being cloned by others (Laya, Kev, SemIf).
- **Hosted:** TypeSafe **Jev** (2026-09-15; $0.042 / M input, output free; 70–500 ms; 32k context; hosted only; languages not stated) ·
  **OpenAI Decisions API** (preview / beta; $0.10 / M input; text + images) · **Microsoft-Decision-1** (Foundry + **OpenRouter**) · Cloudflare
  **Clef / Clef Flash / Clef-omni** · Perplexity **pplx-decider 27B** (also open weights) · Liquid **D1** · Together **Tev1-4B** · Inception
  **Mercury Decide** (free rate-limited on OpenRouter) · Upstage **Solar Decide**.
- **Local / open:** Convai **Laya** (Apache 2.0; ModernBERT-class encoder; English + multilingual checkpoints; ONNX via `onnxruntime-node`;
  ~1.7 GB fp32, ~2 GB RAM; 512-token state; ≤ ~20 options per `choice`; ~140 ms / 3 questions warm on an M4; npm wrapper
  `@receptron/laya`) · Liquid **D1-3B / D1-Omni-600M** (open weights) · **Kev** (0.8B–27B, Apache 2.0) · **SemIf** (ex-OpenJev: option
  probabilities from open LLMs). Small local rerankers that fit today's stack: Horizon-Labs **multilingual-reranker-small** (141M, Apache 2.0,
  ONNX / transformers.js, int8 build).
- **What the app already has** (as of `efa5e0b`): `openai-compat-provider.ts` with an **OpenRouter** preset (`src/engine/presets.ts:27`),
  `gemini-provider.ts`, `anthropic-compat-provider.ts`, the keyless `claude-subscription`, **`local-llm-provider.ts` on `node-llama-cpp`**
  3.18.1, `onnxruntime-node` 1.24.3, `@huggingface/transformers` 4.0.1, the utilityProcess engine pattern (`src/library-search-engine/`,
  `src/content-safety-engine/`).
- Sources: Thoughtworks "Jev and the rise of decision models"; InfoQ "TypeSafe AI releases Jev" (2026-10); gosearch.ai "AI decision models in
  2026"; github.com/receptron/laya/wiki; hevmind.com "Jev as a reranker"; blog.voyageai.com rerank-3 (2026-09-30); huggingface.co
  Horizon-Labs/multilingual-reranker-small.

## Decisions (EDIT before pasting — defaults are recommendations)

```
D-a  Hosted provider 1: TypeSafe Jev (the reference System One contract).
D-b  Hosted provider 2: OpenAI Decisions API if Hasan's OpenAI account has access, else Microsoft-Decision-1
     through OpenRouter (the app's existing openai-compat / OpenRouter path). The spike checks access first.
D-c  Local model: spike BOTH (1) Laya multilingual (ONNX on the app's onnxruntime-node) and (2) a node-llama-cpp
     "option probabilities" adapter over a tiny GGUF (the SemIf method — no new package); + Liquid D1-Omni-600M if its
     weights load in either runtime. The keyless claude-subscription is the LLM BASELINE (no calibrated probability).
D-d  Keys: Hasan sets JEV_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY as environment variables BEFORE starting the
     session; spike scripts read process.env only, never print / log / write them. A missing key → that provider's
     rows are DEFERRED-HASAN and the spike runs the rest.
D-e  Hosted spend cap for the whole spike: $3 total, ≤ 600 hosted decision calls; keyless baseline ≤ 40 calls.
D-f  Laya's npm wrapper may be installed ONLY in a scratch kit folder outside the repo (never in the repo, a worktree
     or the app's package.json) for the spike; adopting any package into the app is Hasan's call at the D2 stop.
D-g  Base: a new branch `decision-models` cut from `library-search` @ efa5e0b (search is the first user), new worktree.
D-h  The session STOPS after D2 (spike report + design note + acceptance bar) for Hasan's review — no product code.
```

## Paste-in

```
You are the ORCHESTRATOR for a new feature: DECISION MODELS — one shared decision service for the app: typed
questions about a state → typed answers WITH probabilities, behind one contract, with two hosted providers and
one local model, usable anywhere (first users: library search's "nothing fits" + the Assets box order; then the
agents (a tool), flows (a step), and other app places: routing, classification, verification). Follow
docs/studio/END_TO_END_RUN.md's loop (builders with the 30 % hand-off rule, the stop report, "things you never
do") with the overrides below. THIS SESSION = the spikes and small tests (D1) and the design note + acceptance
bar (D2), then STOP for my review. No product code.

WHY (read first): docs/studio/decisions/NEXT-SESSION.md (this file — "What the search found" + the Decisions
block, which binds this run). Library search (docs/studio/LIBRARY_SEARCH_DESIGN.md, docs/studio/search/
S1-spike-report.md §8 / §10) showed that no similarity threshold separates "the library lacks it" from a real
match — "nothing fits" needed an LLM pick; a calibrated decision model may give it without an LLM. Its S4
(docs/studio/search/ORCHESTRATOR.md, ruling LS-r8) is recorded PASS; LS-r8 still waits for my word — do not
touch it.

WHERE: a git worktree D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt on branch decision-models cut per D-g.
Work only there. The main checkout D:\repos\VidTSX-STUDIO has another session's uncommitted work: never edit,
stage, build or launch there, never touch its out/ or node_modules, never git stash. The worktree has no
node_modules: tests `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run …`, never npx / npm there.
Docs: docs/studio/decisions/ (ORCHESTRATOR.md, D1/HANDOFF.md + LOG.md, D1-spike-report.md) and
docs/studio/DECISION_MODELS_DESIGN.md (new). Kits outside the tree: D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\
<PART>\; big outputs and model downloads: C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\<PART>\.

READ FIRST (from the worktree): CLAUDE.md; this file; docs/studio/LIBRARY_SEARCH_DESIGN.md (the service +
utilityProcess engine + benchmark pattern to mirror); docs/studio/search/S1-spike-report.md (§2 measures, §8,
§10 the pick sample); docs/studio/end-to-end/DRIVING.md. Code: src/engine/{llm-engine,types,presets}.ts and
src/engine/providers/{openai-compat-provider,local-llm-provider}.ts (how providers + keys work — main holds
keys, the renderer sees has-key booleans), src/main/services/ai-usage*, src/library-search-engine/ (the
utilityProcess host / child), src/main/services/library-search/rerank*.ts (the rung a decision model could
replace), the agent-tools registry and the flow step registry (where a `decide` tool / step would plug in).

FIRST: say in one line whether the main checkout's uncommitted work is still there and whether my dev app
runs; check which of JEV_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY are SET (print only set / unset, never a
value); then cut the branch + worktree and create docs/studio/decisions/ORCHESTRATOR.md. ANOTHER SESSION may run
at the same time: the assistant-timeline slice in the library-search worktree (.vidtsx-temp\search\wt, branch
library-search, CDP 9296 / 9297, profiles timeline-T / timeline-verify) — never touch its worktree, branch,
profiles, ports or electron.exe instances; cut decision-models from the commit D-g names, not from that branch's
moving head.

PARTS, in order, no stop between them unless a STOP rule fires:
D1 — THE SPIKE (no product code; scratch kits outside the tree). (a) Verify from PRIMARY docs (provider docs,
  model cards, repos — not aggregator blogs) for every candidate in D-a…D-c: the request / response contract,
  question types, limits (context, options per question, batch), languages (Arabic: yes / no / unknown),
  pricing, data retention, licence, weights / runtime / size; record contradictions with the search summary.
  (b) Three SMALL task sets, written as committed-style fixtures in the kit, labelled by plain meaning:
  T1 = library search's pick + "nothing fits": S1's 240-row sample (.vidtsx-temp\search\S1\, the (d) rows:
  187 named / 53 ∅) over the top-20 of S1's (c) RRF60 list, asked as `noul` per candidate ("Is <clip
  description> the sound of <prompt>?") AND as one `choice` over the 20 + "none of these" where the model's
  limits allow; T2 = routing, ~40 Studio-assistant requests → the tool family (cut / audio / shots / captions /
  export / none), 10 in Arabic; T3 = verification, ~40 yes / no pairs from the app's own data (e.g. "does this
  library clip's description match this script line?"). (c) Run every candidate that has a key / runs locally:
  accuracy; calibration (Brier, ECE over 10 bins, a reliability table); selective accuracy at P ≥ 0.5 / 0.7 /
  0.9 (act above, escalate below); T1's wrong-confident rate and correct-"none" rate vs the assistant's pick in
  S1 (R@1 80.7 %, wrong-confident 6.3 %, correct none 79.2 %) and vs (c)'s order (top-1 72.2 %); the Arabic
  subset; latency p50 / p95 (local cold + warm on THIS laptop, hosted end to end); cost per 1,000 decisions; local
  disk + RAM + licence. The keyless claude-subscription answers the same questions as the LLM baseline (JSON,
  no calibrated probability). Write docs/studio/decisions/D1-spike-report.md with the tables and a
  recommendation by this rule: the local default = the smallest local candidate whose T1 + T2 accuracy is
  within 5 points of the best hosted one, Brier no worse than 0.05 above it, warm p95 ≤ 300 ms and ≤ 2 GB
  RAM; prefer the one with Arabic. STOP and ask me if no local candidate meets the rule, if no decision model
  beats the keyless LLM baseline on T1's wrong-confident rate, or if the numbers point to a different design.
D2 — THE DESIGN NOTE (docs/studio/DECISION_MODELS_DESIGN.md): the shared contract (System One-shaped: state +
  keyed typed questions → typed answers + probabilities + confidence + provider / model / usage / latency; an
  adapter interface; uncalibrated adapters flagged as such), the adapters (D-a, D-b, the local one in a
  utilityProcess engine — the library-search lesson: onnxruntime / native DLLs never in main), provider settings
  + keys (main / safeStorage, the renderer sees has-key booleans; AI → Providers UI), choice of provider per call
  ("auto" ladder: local → hosted → LLM fallback, or caller-pinned), timeouts / retries / cache / usage logging
  (featureSource per caller), IPC + preload, the first users and how each consumes probabilities WITHOUT turning
  them into claims (the E3 lesson: a probability is not a fact shown to the user or the assistant as one), the
  agent tool + the flow step, what is NOT in the first slice, the build steps, and THE ACCEPTANCE BAR — fixed
  there before any verifier, from D1's numbers (per task set, per provider; the gates; the live checks; what is
  only a note). Feature isolation, services own logic, IPC-only bridge, ≤ ~300 lines per file, no `any`.
  Then STOP with the stop report (D1's table + the recommendation + the design's open questions for me).

OVERRIDES for the whole run
- Hosted calls ONLY with the keys I set (D-d), inside the cap (D-e); a provider whose key is unset is
  DEFERRED-HASAN; never another paid key. Keyless claude-subscription ≤ 40 calls (+1 retry each on an API error).
  Never read, copy or open a credential store (settings.db*, ~/.claude, any profile's); never print a key.
- Packages: nothing new in the repo, the worktree or the app's package.json. D-f's scratch-only install is the
  one exception, outside the repo, and said in the report.
- Downloads (model weights) go to C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\<PART>\models\ — state each
  size first; check disk. Isolated profiles only if the app must run (copied from profiles\source\profile
  WITHOUT settings\settings.db*; Studio root set in the first CDP call; CDP ports 9300–9309); never my
  %APPDATA%\VidTSX Studio library, projects or stations.
- Resource guard (DRIVING): before any launch, download, model load or full run check C: free AND memory commit
  headroom; C: ≥ 3 GB and (C: + headroom) ≥ 6 GB; local model runs one at a time; timings are measured with the
  other session's CPU load recorded beside them (repeat a latency run if it was loaded).
- Every builder brief adds: "Work only in the worktree; never npx/npm there, never git stash, never touch the
  main checkout. Read docs/studio/end-to-end/DRIVING.md. Edit HANDOFF.md and the docs with the Edit/Write tools
  only — no Python, node, sed or heredoc for doc edits. Never hand back while a job you started is still running.
  Write HANDOFF.md as you go and commit early (explicit paths). Every git / tree statement is 'as of <hash>'.
  Numbers in prose come from the report files. Never print, log or write an API key." Subagents may not write
  report files outside the tree in this harness — the orchestrator saves a hand-back that needs keeping.
- Anything needing my hands, ears or keys: build + verify up to it, mark it DEFERRED-HASAN, list it, continue.
- The orchestrator writes only docs (docs/studio/decisions/, the design note), commits after each update, logs
  times from the real clock (`date`), and commits nothing while a builder runs. Never push; never merge.
```
