# Next session — DECISION MODELS, session 3: finish THE BUILD (D4 (f) the UI, (h) the exit check), then D5 the verifier, then STOP

> Written 2026-10-31 17:03 by the session-2 orchestrator after the session ended mid-D4 (f) (Hasan: "ok, lets continue in a new sesssion,
> give me a prompt"). Paste everything inside the fence into a new Claude Code session at `D:\repos\VidTSX-STUDIO`. **The Decisions block =
> Hasan's answers of 2026-10-31 (E-a … E-h, unchanged from `NEXT-SESSION-2.md`) — binding; edit it only if you change your mind.** State:
> `docs/studio/decisions/ORCHESTRATOR.md` ("Session 2": rulings D-r12 … D-r23, Stops, Log), `docs/studio/decisions/D3-mapika-report.md`,
> `docs/studio/decisions/D4/HANDOFF.md`, `docs/studio/DECISION_MODELS_DESIGN.md` (D2).

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
You are the ORCHESTRATOR for DECISION MODELS, session 3 — finish D4 (THE BUILD of the shared decision engine: part (f) the UI, then
part (h) the exit check), then D5 its independent verifier, then STOP. Follow docs/studio/END_TO_END_RUN.md's loop (builders with the
30 % hand-off rule, an independent verifier, the stop report, "things you never do") with the overrides below. Sessions 1–2's state is
docs/studio/decisions/ORCHESTRATOR.md — read its "Session 2" section IN FULL (Answers in force, rulings D-r12 … D-r23, Stops, Log) and
CONTINUE that file (a "Session 3" header, the Decisions block of this file as "Answers in force", one Log line per event). Hasan's
answers E-a … E-h in this file bind this run (E-g's caps are for the whole run: hosted 0 / 60 and keyless 0 / 10 used so far).

WHERE THINGS STAND (as of 0fd72c6, 2026-10-31 17:03): D3 DONE — Mapika decider-2b FAILED the local-rung bar (3 PASS / 4 FAIL,
docs/studio/decisions/D3-mapika-report.md) → the local rung stays empty and D4 part (g) is NOT built. D4 (a)–(e) are DONE and committed
(c7ad6da ed79420 b7b1648 d9ec730 feb5e69 5605c48): the engine core, the System One + LLM-fallback providers contract-tested on D1's
recorded bodies, main's wiring + the `typesafe` registry entry + the 'decision' capability, the four decisions:* IPC functions + preload,
the `decide` tool / node + `check_matches_request` + `route_request`, the committed benchmark whose replay equals D1's c-hosted.md §2, the
gated live test + its launcher, the dev-only stub hook. **Part (f) was INTERRUPTED: D4 builder #7's uncommitted, unverified files are in
the tree** (docs/studio/decisions/D4/HANDOFF.md's status line lists them and says what the next builder does first).

WHY / THE BAR (read first): docs/studio/DECISION_MODELS_DESIGN.md (D2, accepted) — §8 keys / settings / UI, §12 IPC, §15 THE
ACCEPTANCE BAR. The verifier FAILS only by §15, read through the rulings that shape it (ORCHESTRATOR.md "Rulings (session 2)"): D-r16
(the request shape — transport adapter; the built-ins send D1's measured shape), D-r17 (rung id `openrouter-decisions`; `family` on the
request; `invalid-request`; the six-row calibration table), D-r18 (band reads the TOP probability, never System One's `confidence`),
D-r19 / D-r20 (the TypeSafe key test = `decisionsDecide({ test: 'jev' })` on the SAVED key; a renderer decide only as `decision-test` /
`decision-flow`), D-r21 (the dev-only loopback stub hook `VIDTSX_DECISIONS_JEV_URL` / `VIDTSX_DECISIONS_OPENROUTER_URL`, unpackaged only),
D-r22 (whole-word no-claim test; `p` as a record-only port; `allowUncalibrated` keeps the threshold), D-r23 (the live bar's latency terms;
the 4-request cap; the launcher D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\live-test.sh).

WHERE: the git worktree D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt on branch decision-models. Work only there. The main checkout
D:\repos\VidTSX-STUDIO holds another session's uncommitted work: never edit, stage, build or launch there, never touch its out/ or
node_modules, never git stash anywhere. The worktree has no node_modules: tests `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs
run …`, types `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` (and tsconfig.node.check.json;
baseline web 25 / node 10 at b2b8a02, measured; tsc takes ~2 min — run it in the background), build `node D:/repos/VidTSX-STUDIO/
node_modules/electron-vite/bin/electron-vite.js build` from the worktree root (NODE_OPTIONS=--max-old-space-size=8192, ELECTRON_RUN_AS_NODE
unset); never npx / npm there. The full gate's worktree-only reds are the suites of docs/studio/search/ORCHESTRATOR.md LS-r1 / LS-r1b /
LS-r1c (the 25 "Cannot find module '<wt>\stream'" suites, by name) and the package-resolution suites (the 3 E-d2a `shot-bundle*` ones and
`builder-libraries`, DRIVING:186 — confirm each by its error text); each is counted only with the proof that it passes in a fresh `git
worktree add --detach` at the gate's HEAD (commands + outputs recorded; the scratch worktree removed after); any other red is real. Docs:
docs/studio/decisions/ (ORCHESTRATOR.md continued; D4/HANDOFF.md + LOG.md; D5/ with its report). Kits outside the tree:
D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\ and \D5\; big outputs / profiles under C:\Users\hasan\AppData\Local\vidtsx-e2e\.

READ FIRST (from the worktree): CLAUDE.md; this file; ORCHESTRATOR.md "Session 2" in full; D4/HANDOFF.md; D2 §8, §12, §15;
docs/studio/end-to-end/DRIVING.md (the launch recipe from the worktree; running BESIDE Hasan's dev app).

FIRST: say in one line whether the main checkout's uncommitted work is still there and whether Hasan's dev app runs (electron.exe count +
what listens on 5173 / 9222 — at the pause it WAS running on his %APPDATA%\VidTSX Studio profile: never kill it, never electron-vite dev,
launch beside it per DRIVING); resource check (C: ≥ 3 GB and C: + commit headroom ≥ 6 GB); the worktree's HEAD and `git status` (builder
#7's leftovers should still be there — if they are gone or changed, say so and adjust); append the "Session 3" header + "Answers in force"
(E-a … E-h verbatim) to ORCHESTRATOR.md; commit (explicit paths — never builder #7's code).

PARTS, in order, no stop between them unless a STOP rule fires:
D4 (f) — resume per D4/HANDOFF.md: the first builder judges builder #7's leftovers (diff, their tests, the suites they touch, tsc, D2 /
  the rulings), keeps what is green and right, fixes or drops the rest, commits a green sub-checkpoint; then the Settings › General
  "Decisions" row (mode, the hosted order with has-key dots, the OpenRouter model, the local rung "none available"), the AI → Providers
  "Decisions" section (the TypeSafe row + OpenRouter listed under it; the Test button → `decisionsDecide({ test: 'jev' })`, DISABLED until a
  TypeSafe key is SAVED), the dev-preview-gated tester (`featureSource: 'decision-test'`; the one place probabilities show, as numbers),
  D-r22 (2)'s `p` handle; per UI_SPEC.md; then a build of the worktree's out/ and CDP screenshots of both screens on the isolated profile
  C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D4\profile (from profiles\source\profile WITHOUT settings\settings.db*), CDP 9302,
  no key saved.
D4 (h) — the exit check (one or two builders): the full vitest gate from the worktree logged to a file + the fresh-worktree proofs; tsc
  ≤ 25 / ≤ 10; the house-rules sweep over every path in b2b8a02..HEAD (feature isolation — decisions code imports nothing from studio/,
  asset-library/ or the renderer; ≤ ~300 lines for new files, before → after for grown big files; no `any`; named exports; package.json /
  lock unchanged; the preload exposes exactly the four decisions functions; no electron / Node import in src/shared/types/decisions.ts);
  D2 §15.3 1 / 3 / 4 / 5 live on a STUB: a small loopback stub server in the kit (answers System One bodies after 500 ms, logs path / model
  / which variable's URL was called — never headers), the app launched from the worktree's out/ with the D-r21 variables in its launch
  environment, profile decisions-D4, CDP 9302, a FAKE TypeSafe key saved through the Providers row; check 1 = the IPC ping loop (≤ 250 ms
  max gap) during 20 concurrent decisionsDecide calls with featureSource 'decision-test' (D-r20); check 3 = the two-node flow input_text →
  check_matches_request with BOTH inputs (item, request) wired (D-r22), one T3 true row and one false row → act / escalate, p in the run
  record, the canvas shows the band only; check 4 = one agent run with `decide` on a T2 row → no-claim text, the usage row's featureSource
  'decision-agent' / requestType 'decision' / costUsd = tokens × price; check 5 = decisionsMode off → no-provider with zero stub hits, then
  jev removed from the order → the OpenRouter-shaped stub URL is called; then the Status.md row (top, dated) and the TESTING.md §20 block
  (after §19) with the measured numbers. §15.3 2 (the keys screen with a fake key) may be run here too — it needs no real key.
D5 — THE VERIFIER (fresh context; it reads D2 §15 + the rulings that shape it (D-r16 … D-r23, which the orchestrator pastes into its
  brief verbatim) + the commit range b2b8a02..HEAD — NOT the builders' reports, HANDOFFs, LOGs or ORCHESTRATOR's Log): re-runs the gates and
  every §15.3 check it can on an isolated profile (C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D5-verify\profile copied from
  profiles\source\profile WITHOUT settings\settings.db*; Studio root set in the first CDP call; CDP 9305), the replay equality, the no-claim
  test, and **the gated live test with Hasan's keys: `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D4/live-test.sh`** (≤ 4 requests,
  < $0.01; result JSON under …\vidtsx-e2e\decisions\D5\). §15.3 1's "5 real Jev calls" and §15.3 6's "one real check_matches_request run
  with his key" need the key INSIDE the app, which only the Providers screen accepts and no agent may paste — they are DEFERRED-HASAN (his
  own test), and the live test covers the product adapter + the built-ins' framing with the real key. PASS or FAIL only by §15; on FAIL the
  findings go to D4/HANDOFF.md (status FIX) and a builder fixes; ≤ 3 FAIL rounds; on PASS a records builder updates Status.md / TESTING.md
  §20 only if the verifier's numbers differ; then STOP with the stop report (D4's numbers, the verifier's verdict, the hosted spend, what is
  DEFERRED-HASAN, the open questions — incl. D-r16 (e): do the hosted 40 / 40 rows hold in a product-shaped request (state = the evidence)?
  and D3 §10 item 2: D2 §5.3's "CPU by default" for a later local rung).

OVERRIDES for the whole run (unchanged from session 2)
- Keys: only Hasan's two .env files through D1\hosted-live.sh or D4\live-test.sh (same sourcing) — never read, print, grep or copy a value;
  never another key; hosted ≤ 60 requests / ≤ $0.50 in all; keyless claude-subscription ≤ 10 calls. Never read / copy / open a credential
  store (settings.db*, ~/.claude, any profile's). A key never appears in a test fixture, a log, a doc, a commit or a hand-back. Tests and
  stub runs use obviously FAKE keys.
- Packages: NO new npm package in the repo / worktree / package.json (stop and ask if a part seems to need one). No Python in this session.
- The app: isolated profiles only (CDP 9300–9309; builders 9302, the verifier 9305); never Hasan's %APPDATA%\VidTSX Studio, projects or
  stations; if his dev app runs (electron.exe on 9222 / 5173), never kill it, never electron-vite dev, never the main checkout's out/;
  launch from the worktree's own out/ per DRIVING "Launch recipe from the worktree"; stop only the PIDs you started. C: ≥ 3 GB and C: +
  commit headroom ≥ 6 GB before any build / launch / full run.
- Every builder brief adds: "Work only in the worktree; never npx/npm there, never git stash, never touch the main checkout. Read
  docs/studio/end-to-end/DRIVING.md. Edit HANDOFF.md and the docs with the Edit/Write tools only — no Python, node, sed or heredoc for doc
  edits. Never hand back while a job you started is still running (stop your app instance first). Write HANDOFF.md as you go and commit
  early (explicit paths only; each commit ends with the attribution line the session shows). Every git / tree statement is 'as of <hash>'.
  Numbers in prose come from files or command output. Use `date` for every time you write. Never print, log or write an API key. A
  probability is never shown to the user or the assistant as a claim (D2 §1, §15.1)."
- Lessons from session 2 (orchestrator): read `date` BEFORE writing any stamp (session 2's estimates drifted 2–3 min and had to be
  corrected); run tsc in the background (~2 min); re-check every builder hand-back yourself (re-run its tests + tsc, read the file that
  carries the decision) before ruling; record a ruling for every builder decision that shapes how §15 is read and paste those rulings into
  the verifier's brief; one part (or half a part) per builder — (c) split into (c1) / (c2) worked; builders run ~40–100 calls.
- Anything needing Hasan's hands or keys beyond the above: build + verify up to it, mark DEFERRED-HASAN, list it, continue.
- The orchestrator writes only docs (docs/studio/decisions/; Status.md / TESTING.md through a builder), commits after each update (explicit
  paths), logs real-clock times, commits nothing while a builder or verifier runs. Never push; never merge; never rebase.
```
