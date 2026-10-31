# Next session — DECISION MODELS, session 2: the Mapika spike (the local rung), THE BUILD of the shared decision engine, its verifier (Hasan 2026-10-31: "lets build a shared decision engine like in images and videos and so on, so we can use anywhere, and we have a section in providers for them")

> Written 2026-10-31 by the session-1 orchestrator after D1 DONE-WITH-STOPS and D2 (accepted with Hasan's six answers, amended the same day).
> Paste everything inside the fence into a new Claude Code session at `D:\repos\VidTSX-STUDIO`. **The Decisions block = Hasan's answers of
> 2026-10-31 — binding; edit it only if you change your mind.** Session 1's state: `docs/studio/decisions/ORCHESTRATOR.md` (Stops, rulings
> D-r1 … D-r11), `docs/studio/decisions/D1-spike-report.md`, `docs/studio/DECISION_MODELS_DESIGN.md` (D2).

## Decisions (Hasan, 2026-10-31 — binding)

```
E-a  THE DIRECTION: D2 as amended — a shared DECISION ENGINE shaped like the image / video engines (src/decision-engine/ with
     presets, providers and one `decisionEngine` instance; main wires it from the user's keys like image-init.ts), usable anywhere;
     a "Decisions" section in AI → Providers (ProviderCapability 'decision'); first users = the `decide` agent tool that is also a
     flow node + the two verification gate nodes (D2 §10.1–10.2); request routing = a prompt hint, slice 2 (§10.3); library search
     keeps S1's design (not a user).
E-b  T1 noul on the hosted providers: NOT run.
E-c  Clef-flash and other hosted deciders: not now — "we can add more providers later" (a preset each, later).
E-d  Mapika decider-2b: YES — spike it as the local rung (D3); it ships (D4 step g) only if it passes D2 §15.1's bar for a local
     rung; otherwise the rung stays empty (a note, not a stop).
E-e  NO OpenAI models — the OpenAI adapter is dropped (no preset, no key row). The two hosted providers = TypeSafe Jev (jev-1.14.0
     pinned) and Microsoft-Decision-1 via OpenRouter's Decisions API (POST https://openrouter.ai/api/alpha/decisions).
E-f  Keys: a TypeSafe row in AI → Providers (new `typesafe` registry id, capability 'decision'); the existing OpenRouter key is
     reused (its registry entry gains 'decision'). For the spike / the verifier's live test ONLY: Hasan's keys live in
     D:\repos\VidTSX-STUDIO\.env (TYPESAFE_API_KEY) and D:\repos\ai-video-lab\.env (OPENROUTER_API_KEY), both gitignored — loaded
     ONLY by the kit launcher D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\hosted-live.sh (ruling D-r8), never printed, read,
     grepped for a value, or copied.
E-g  Caps for this session: hosted ≤ 60 requests / ≤ $0.50 in all (D3 needs none; D5 ≤ 20 requests / ≤ $0.05); keyless
     claude-subscription ≤ 10 calls; Python packages ONLY in a scratch venv outside every repo; NO new npm package (stop and ask).
E-h  The session STOPS after D5 — the verifier's PASS, or three FAILs — with the stop report; Hasan's own test and the landing of
     branch decision-models are his.
```

## Paste-in

```
You are the ORCHESTRATOR for DECISION MODELS, session 2 — D3 the Mapika spike (the local rung), D4 THE BUILD of the shared
decision engine, D5 its independent verifier. Follow docs/studio/END_TO_END_RUN.md's loop (builders with the 30 % hand-off rule,
an independent verifier, the stop report, "things you never do") with the overrides below. Session 1 (2026-10-30/31) ran the
spike D1 and wrote the design D2; its state is docs/studio/decisions/ORCHESTRATOR.md — read its "Stops" and rulings D-r1 … D-r11
first and CONTINUE that file (a "Session 2" header, the Decisions block of this file as "Answers in force", one Log line per
event). Hasan's answers E-a … E-h in this file bind this run.

WHY (read first): docs/studio/DECISION_MODELS_DESIGN.md (D2, accepted — §1 the direction, §3 the contract, §4 THE ENGINE LAYOUT
to build exactly, §5 the providers, §6 the ladder, §8 keys / settings / the Providers section, §9 budgets / cache / usage, §10 the
first users, §12 IPC, §13 not in slice, §14 the build order, §15 THE ACCEPTANCE BAR — the verifier FAILS only by §15);
docs/studio/decisions/D1-spike-report.md §0 + §12 (what was measured; why library search is NOT a user); the experiment
D:\repos\ai-video-lab\youtube-videos\01-jev-vs-clef\LOG.md (Mapika's numbers) and D:\repos\ai-video-lab\tools\deciders\README.md
(its runtime recipe: Python 3.13 venv, torch 2.14.1+cu130, decider-ai, TORCHDYNAMO_DISABLE=1 on Windows).

WHERE: the git worktree D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt on branch decision-models (HEAD = session 1's last commit;
`git log -1`). Work only there. The main checkout D:\repos\VidTSX-STUDIO may hold another session's uncommitted work: never edit,
stage, build or launch there, never touch its out/ or node_modules, never git stash anywhere. The worktree has no node_modules:
tests `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run …`, types `node D:/repos/VidTSX-STUDIO/node_modules/
typescript/bin/tsc -p tsconfig.web.check.json --noEmit` (and tsconfig.node.check.json; baseline web 25 / node 10 at efa5e0b —
re-read it from the first run), build `node D:/repos/VidTSX-STUDIO/node_modules/electron-vite/bin/electron-vite.js build` from the
worktree root (NODE_OPTIONS=--max-old-space-size=8192, ELECTRON_RUN_AS_NODE unset); never npx / npm there. The worktree-only
resolution suites are counted per docs/studio/search/ORCHESTRATOR.md LS-r1b / LS-r1c (each proven green in a fresh detached
worktree at the gate's HEAD). Docs: docs/studio/decisions/ (ORCHESTRATOR.md continued; D3/, D4/, D5/ with HANDOFF.md + LOG.md;
D3-mapika-report.md). Kits outside the tree: D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\<PART>\ (D1's kit is reusable: the
fixtures t1/t2/t3, score.cjs, measures.cjs, hosted-run.cjs + hosted-live.sh, the recorded live responses under
C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\hosted-responses\); big outputs / venvs / models:
C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\<PART>\.

READ FIRST (from the worktree): CLAUDE.md; this file; the design note in full; ORCHESTRATOR.md; docs/studio/end-to-end/DRIVING.md;
docs/studio/LIBRARY_SEARCH_DESIGN.md §3 / §7 and docs/studio/search/ORCHESTRATOR.md's S3 Log (the build pattern that shipped:
utilityProcess engine, lazily-registered IPC, the Settings row, red-first parts). Code: src/image-engine/{image-engine,presets,
types,index}.ts + providers/ and src/main/services/image-init.ts (THE PATTERN — register each preset whose
credentials[preset.credentialId] exists); src/shared/providers/registry.ts (PROVIDER_REGISTRY, ProviderCapability,
PROVIDER_CAPABILITY_LABELS → add decision: 'Decisions'; the `openrouter` entry gains 'decision'); src/features/ai-models/components/
providers/ProviderKeyRow.tsx (the Providers screen groups by capability); src/main/services/agents/tools/{registry-core,
generate-text}.ts (a tool with `ports` is also a flow node); src/main/services/ai-usage.ts + src/shared/types/ai-usage.ts;
src/library-search-engine/{search-engine,electron-fork}.ts (the engine-host pattern); src/local-python-engine/python-runner.ts +
src/main/services/python-models/{service,registry}.ts (the app's Python runtime — per-request today; the local rung needs a
persistent worker).

FIRST: say in one line whether the main checkout's uncommitted work is still there and whether Hasan's dev app runs (electron.exe
count); resource check (C: ≥ 3 GB and C: + commit headroom ≥ 6 GB); the worktree's HEAD; append the "Session 2" header + "Answers
in force" (E-a … E-h verbatim) to ORCHESTRATOR.md; create D3/HANDOFF.md + LOG.md; commit.

PARTS, in order, no stop between them unless a STOP rule fires:
D3 — THE MAPIKA SPIKE (no product code; kit .vidtsx-temp\decisions\D3\; big outputs under …\vidtsx-e2e\decisions\D3\).
  (a) Primary facts from the model folder D:\repos\ai-video-lab\tools\deciders\models\Mapika\decider-2b\ (README.md = the card,
  decider_config.json, the `decider/` inference package — read, never modified; the folder is Hasan's, read-only) and the Hub card:
  licence (Apache-2.0), size (3,763,692,048 B bf16 safetensors), base (Qwen3.5-2B-Base), languages (card says en; Arabic measured
  in the experiment 9 / 12), per-type temperatures, limits (max_options 255, max_state_tokens 32768), the Python API
  (decider.infer.Decider(path, device='cuda').system_one(state, questions)), the smaller / vision members of "the decider family"
  (sizes, as candidates for a lighter rung — facts only), whether any GGUF / ONNX of it exists (likely not: a custom head).
  (b) A scratch venv C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\py-scratch\mapika-venv (system Python 3.13; state the torch
  cu130 wheel's size first — ~2.5 GB — and check C:; if the CUDA build fails on this laptop, CPU torch as the fallback and say so);
  `pip install decider-ai` (+ its deps; versions recorded); weights READ from the experiment's folder (never moved or copied).
  (c) A persistent-worker prototype: mapika_worker.py (load once; JSONL requests over stdin → System One answers over stdout; exits
  on idle / EOF) + a Node host mapika-host.cjs in the kit (spawn once, request ids, timeouts, measure Node → Python → Node) — the
  shape D4 step (g) will productise; TORCHDYNAMO_DISABLE=1 set in the host's env for the child.
  (d) Runs through the worker, GPU first (nvidia-smi before / after), ONE local model at a time, CPU load recorded beside every
  timing (repeat a loaded run): T2 choice (40), T3 noul (40), T1 choice (240, as a note) on D1's fixtures, answer files in the
  vidtsx-d1-answers/1 format, scored with D1's score.cjs; accuracy, Brier, ECE, selective accuracy at 0.5 / 0.7 / 0.9, the Arabic
  subset, T1 under D-r2; cold load (process start → first answer), warm p50 / p95 per request AND per question, peak RSS of the
  worker, VRAM; T2 + T3 on CPU as a note.
  (e) Judge against D2 §15.1's bar for a local rung on the routing and verify families — T2 ≥ 38 / 40 AND T3 ≥ 38 / 40 (within 5
  points of the hosted 100 %), Brier ≤ 0.05 on each, 0 off-list answers — plus the brief's warm p95 ≤ 300 ms per request and RSS
  ≤ 2 GB (VRAM reported beside; if RSS is the only failing term because the weights live in VRAM, say so and let Hasan rule at the
  stop) → docs/studio/decisions/D3-mapika-report.md (every number from a kit file, named) with PASS / FAIL per term. PASS → the
  local rung ships in D4 (g). FAIL → the rung stays empty, a note. STOP and ask Hasan only if the runtime cannot run on this laptop
  at all, or the numbers point to a different design than D2's.
D4 — THE BUILD, D2 §14 (a) → (h), red first, hand-off-sized parts (one builder at a time; HANDOFF.md per part; a part is DONE when
  its tests are green, tsc ≤ baseline, the house rules hold — feature isolation, ≤ ~300 lines per file, no `any`, named exports —
  and it is committed with explicit paths). Specifics: (b)'s contract tests run on D1's RECORDED live responses (copied scrubbed into
  src/decision-engine/providers/fixtures/ — check that no key or state text is in them) and must map them to the exact
  probabilities D1 scored; (c) registers presets from credentials exactly like image-init.ts; the renderer never sees a key; (d)'s
  tool text passes the no-claim test over every T2 / T3 row and both bands; (e)'s replay test = table equality with
  D1's c-hosted.md §2 (Jev T2 40 / 40, T3 40 / 40, Brier 0.021 / 0.003, ECE 0.059 / 0.044; MSD1 40 / 40, 40 / 40, 0.014 / 0.002) and
  the gated live test (VIDTSX_DECISIONS_LIVE=1 + the key in the environment via hosted-live.sh's two variables) is DEFERRED-HASAN
  for builders (the verifier runs it, ≤ 4 requests); (f) the Settings row + the Providers "Decisions" section per UI_SPEC.md; (g)
  only if D3 passed — the worker ships on the app's `pytorch` runtime path (python-models), a first-use download entry with the
  measured size + sha256, never bundled; (h) the exit check: the full vitest gate from the worktree (logged to a file; LS-r1b /
  LS-r1c proof for the worktree-only suites), tsc, the house-rules sweep, the live checks a builder can run (D2 §15.3 1, 3, 4, 5 with
  the stub server), a Status.md row (top, dated) and a TESTING.md §20 block (after §19) with the measured numbers.
D5 — THE VERIFIER (fresh context; it reads D2 §15 and the commit range, NOT the builders' reports or HANDOFFs): re-runs the gates and
  every §15.3 live check on an isolated profile (C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D5-verify\profile copied
  from profiles\source\profile WITHOUT settings\settings.db*; Studio root set in the first CDP call; CDP 9305), the gated live test
  with Hasan's keys through hosted-live.sh (≤ 20 requests, ≤ $0.05), the no-claim test, the replay equality; PASS or FAIL only by
  §15; on FAIL the findings go to the part's HANDOFF (status FIX) and a builder fixes; ≤ 3 FAIL rounds; on PASS a records builder
  writes the Status.md entry + TESTING.md §20; then STOP with the stop report (D4's numbers, the verifier's verdict, what is
  DEFERRED-HASAN, the open questions).

OVERRIDES for the whole run
- Keys: only Hasan's two .env files through .vidtsx-temp\decisions\D1\hosted-live.sh (or a copy that sets the same two variables
  for the product's live test) — never read, print, grep or copy a value; never another key; hosted ≤ 60 requests / ≤ $0.50 in
  all; keyless claude-subscription ≤ 10 calls. Never read / copy / open a credential store (settings.db*, ~/.claude, any
  profile's). A key never appears in a test fixture, a log, a doc, a commit or a hand-back.
- Packages: NO new npm package in the repo / worktree / package.json (fetch is built in; System One is plain HTTPS; stop and ask if
  a part seems to need one). Python packages only in scratch venvs under …\vidtsx-e2e\decisions\<PART>\py-scratch\ (outside every
  repo); the product's Python worker rides the app's own python-models runtime (D3 says how; D4 (g) builds it).
- Downloads: state sizes first; sha256 where published; C: ≥ 3 GB and C: + commit headroom ≥ 6 GB before any download / model
  load / launch / full run; local models one at a time; Hugging Face can crawl (~75 KB/s on 2026-10-30) — the orchestrator holds
  long downloads as its own background jobs, a builder never idles on one.
- The app: isolated profiles only (CDP 9300–9309; builders 9302, the verifier 9305); never Hasan's %APPDATA%\VidTSX Studio,
  projects or stations; if his dev app runs (electron.exe on 9222 / 5173), never kill it, never electron-vite dev, never the main
  checkout's out/; launch from the worktree's own out/ per DRIVING "Launch recipe from the worktree".
- Every builder brief adds: "Work only in the worktree; never npx/npm there, never git stash, never touch the main checkout. Read
  docs/studio/end-to-end/DRIVING.md. Edit HANDOFF.md and the docs with the Edit/Write tools only — no Python, node, sed or heredoc
  for doc edits. Never hand back while a job you started is still running. Write HANDOFF.md as you go and commit early (explicit
  paths; each commit ends with the attribution line the session shows, e.g. `Co-Authored-By: Claude Fable 5.1
  <noreply@anthropic.com>`). Every git / tree statement is 'as of <hash>'. Numbers in prose come from the report files. Never print,
  log or write an API key. A probability is never shown to the user or the assistant as a claim (D2 §1, §15.1)."
- Anything needing Hasan's hands or keys beyond the above: build + verify up to it, mark DEFERRED-HASAN, list it, continue.
- The orchestrator writes only docs (docs/studio/decisions/; Status.md / TESTING.md through a records builder), commits after each
  update, logs real-clock times (`date`), commits nothing while a builder or verifier runs. Never push; never merge; never rebase.
```
