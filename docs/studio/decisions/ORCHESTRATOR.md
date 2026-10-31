# Decision models — orchestrator state

> Run brief: Hasan's paste-in in `docs/studio/decisions/NEXT-SESSION.md` ("Paste-in", :50-147), with that file's
> "Decisions" block (D-a…D-h, :31-46) as his answers — given 2026-10-30 15:45 ("run the fenced Paste-in block … exactly as
> written, with the Decisions block in that file as my answers … it is my instruction for this session"). It follows
> `docs/studio/END_TO_END_RUN.md`'s loop (builders with the 30 % hand-off rule, the stop report, "things you never do") with the
> paste-in's overrides. Parts D1 → D2 run in order with NO stop between them unless a STOP rule fires; **the session STOPS after D2**
> (D-h) for Hasan's review. **No product code in this session.**

- Branch: `decision-models`, cut from `library-search` @ `efa5e0b` (D-g) on 2026-10-30 15:47 +0200, worktree
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\wt`. `docs/studio/decisions/NEXT-SESSION.md` (this run's brief) was added on
  `library-search` AFTER `efa5e0b` (`2cc2751`, amended `0df9e9c`); it is brought onto this branch from `0df9e9c` in the first
  commit, unchanged. Not pushed, not merged.
- Start state (15:45): main checkout `end-to-end-p0` @ `5d77600` with the other session's 14 modified + 6 untracked files
  (unchanged; never touched); **Hasan's dev app NOT running** (0 `electron.exe`). **Keys: `JEV_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY` all UNSET** (process, user and machine scopes; only set / unset was printed) → per D-d every hosted row is
  **DEFERRED-HASAN**. Resources 15:46: C: 29.4 GB, D: 39.6 GB free; memory commit headroom 33.7 / 99.7 GB; CPU 64 % average of 16
  logical cores over 3 s (top: `vmmemWSL` — external load, not ours).
- A parallel session may run: the assistant-timeline slice in `.vidtsx-temp\search\wt` (branch `library-search`, CDP 9296 / 9297,
  profiles `timeline-T` / `timeline-verify`). Never touch its worktree, branch, profiles, ports or `electron.exe` instances.

| Part | Status | Builders spawned | Re-check | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| D1 — the spike (no product code) | **DONE-WITH-STOPS** (D-r11, 2026-10-31 08:05: STOP 1 + 2 fire on local AND hosted T1; STOP 3 = a different first user + hosted-first ladder); report update by builder #10 | 9 | steps 1–2 (16:00, 16:13); step 3 part 1 (16:31); steps 5–6 (16:50) | docs `ce3f9e4` `71aa0c5` `bfff9d7` `7f72203` | (a): 22 primary sources, 15 contradictions, no candidate drops · (b): T1 240 / T2 40 / T3 40, self-check 17 / 17 | 2026-10-30 15:51 / — |
| D2 — the design note + THE ACCEPTANCE BAR (orchestrator) | **DONE — for Hasan's review** (the direction = D-r11's recommendation, his to confirm) | — | — | draft `99def5d`; final = the commit after `f48ec2e` (this file's 08:26 line) | `docs/studio/DECISION_MODELS_DESIGN.md` 357 lines: contract, hosted-first ladder, first users = `decide` tool / node + verification gates (+ routing hint, slice 2), §15 bar on the recorded Jev / MSD1 T2 / T3 answers (replay = table equality; gated live ≥ 38 / 40; no-claim strings; 6 live checks) | 2026-10-30 17:02 / 2026-10-31 08:26 |

No verifier runs in this session: D1 is checked by the orchestrator against its exit (the S1 precedent); D2 fixes the acceptance bar
for a later build + verifier (D-h).

## Answers in force (Hasan, 2026-10-30 — the Decisions block, verbatim)

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

- **D1's recommendation rule (paste-in, verbatim):** "the local default = the smallest local candidate whose T1 + T2 accuracy is
  within 5 points of the best hosted one, Brier no worse than 0.05 above it, warm p95 ≤ 300 ms and ≤ 2 GB RAM; prefer the one with
  Arabic. STOP and ask me if no local candidate meets the rule, if no decision model beats the keyless LLM baseline on T1's
  wrong-confident rate, or if the numbers point to a different design."
- **D1's references (S1, `docs/studio/search/S1-spike-report.md` §10):** the assistant's pick over the top-20 of (c) on the 240-row
  sample — R@1 80.7 %, pick acc 90.9 %, wrong-confident 6.3 % (15 / 240), correct none 79.2 % (42 / 53); (c)'s order top-1 72.2 %.
- **Overrides (paste-in):** hosted calls only with Hasan's env keys inside D-e's cap — never another paid key; keyless
  `claude-subscription` ≤ 40 calls (+1 retry each on an API error); never read / copy / open a credential store (`settings.db*`,
  `~/.claude`, any profile's); never print a key; nothing new in the repo / worktree / app `package.json` (D-f's scratch install
  outside the repo is the one exception, said in the report); model weights to `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\
  <PART>\models\` with each size stated first and disk checked; isolated profiles only (copied from `profiles\source\profile` WITHOUT
  `settings\settings.db*`; Studio root set in the first CDP call; CDP 9300–9309); never Hasan's `%APPDATA%\VidTSX Studio` library,
  projects or stations; the resource guard (C: ≥ 3 GB and C: + commit headroom ≥ 6 GB before any launch / download / model load /
  full run; local models one at a time; timings with the external CPU load recorded beside them, a loaded latency run repeated);
  DEFERRED-HASAN for anything needing his hands / ears / keys (build + verify up to it, list it, continue); the orchestrator writes
  only docs, commits after each update, logs real-clock times, commits nothing while a builder runs; never push, never merge.
- **Ports / profiles / folders (orchestrator):** D1 builders CDP **9300**, profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\
  decisions-D1\profile`. Kit `K` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\` (outside the tree; drivers, fixtures, small
  reports); big outputs + models `B` = `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\` (D-f's scratch npm folder goes under
  `B`, outside the repo).

## Rulings

- **D-r1 (orchestrator, 15:50 — before any measurement) — the rule with no hosted key.** Every hosted key is unset (D-d), so the
  rule's two hosted terms ("within 5 points of the best hosted one", "Brier no worse than 0.05 above it") are **DEFERRED-HASAN**.
  D1 still applies the rule's other terms (warm p95 ≤ 300 ms, ≤ 2 GB RAM, the Arabic preference) and reports each local candidate's
  T1 + T2 accuracy and Brier beside the keyless baseline's accuracy as a NOTE (the baseline has no calibrated probability; it is not
  the rule's reference). The STOP "no local candidate meets the rule" fires if no local candidate passes the evaluable terms; the
  two other STOP conditions are judged as written. The hosted runners are built and dry-run (request bodies, cap counter, cost
  estimate — no network) so Hasan's keys are the only missing piece.
- **D-r2 (orchestrator, 15:50 — before any measurement) — "wrong-confident" for a model with probabilities.** A decision model's
  T1 answer is a pick when its top option has P ≥ τ, else "none" (abstain); τ ∈ {0.5, 0.7, 0.9}, every table gives all three.
  `choice` mode: the top option over the 20 + "none of these" (a confident "none of these" is "none"). `noul` mode: the candidate with
  the highest P(true), a pick when that P ≥ τ. Wrong-confident, correct none, false none, R@1 and pick acc are S1's definitions
  (§2, §10) over the 240 rows. **"Beats the keyless baseline on T1's wrong-confident rate"** = a lower wrong-confident rate than
  BOTH 6.3 % (S1) and this run's baseline re-run, at a τ where the model's R@1 is no more than 5 points below the baseline's — so
  abstaining on everything never counts as beating it.

- **D-r3 (orchestrator, 16:00) — Laya multilingual's runtime route (builder #1's O1: no official multilingual ONNX).** Step 3 tries, in
  order: (1) the official `laya-ts` package of the upstream repo (Laya's own npm wrapper — D-f covers it: under `B\npm-scratch\` only,
  `--ignore-scripts`, name / version / integrity recorded) if it runs the multilingual checkpoint on `onnxruntime-node`; (2) a community
  ONNX conversion of `convaiinnovations/laya-multilingual`, downloaded as untrusted weights into its own folder under `B\models\` and
  checked against the upstream card's / repo's worked examples before any measured run. **No pip install and no own ONNX export** (a
  new toolchain — Hasan's call). If neither runs, Laya multilingual is "did not run" with the reason, and the ENGLISH checkpoint
  (`@receptron/laya`, ≈ 1.7 GB, size stated first) may run as a NOTE only (no Arabic rows; never the recommended default).
- **D-r4 (orchestrator, 16:00) — D-b's "existing openai-compat / OpenRouter path" (builder #1's C7).** OpenRouter serves decision models
  on its separate Decisions API (`POST https://openrouter.ai/api/alpha/decisions`, System One body — orchestrator spot check ~16:00), so
  the fallback needs a System One adapter with OpenRouter's base URL, not `openai-compat-provider`. Not a block: D-b's order (OpenAI
  first, if Hasan's account has access) stands; D2 designs both adapters; step 6 dry-runs OpenAI's own shape (`input` + `questions[]`,
  `predicate`) and the System One shape (Jev, Microsoft-Decision-1 via OpenRouter).

- **D-r5 (orchestrator, 16:33) — slow downloads: the orchestrator holds them; D1's order becomes 5 → 6 → 3 → 4 → 7.** Hugging Face serves
  ~75 KB/s per connection today for every repo (builder #3: desplega 80 KB/s, ~0.4 MB/s over 8–32 ranged parts; orchestrator 16:30: Qwen's
  official GGUF 3,003,348 B in 40.4 s = 74 KB/s on one connection), so ~2.2 GB of weights takes over an hour — longer than a builder's
  hand-off budget, and a builder may never hand back while its own job runs. The orchestrator therefore runs the three weight downloads
  as its own background jobs with `K\dl-parallel.sh` (read first: curl ranged parts + cat, nothing executed from the downloads), sizes
  stated from HTTP / the HF API before the start, each into its own new folder under `B\models\`, sha256 checked at the end: the Laya
  multilingual fp32 resume (1,324,748,627 B in all, 150,076,382 B already on disk; builder #3's exact command), `qwen2.5-0.5b-instruct-q8_0.gguf`
  675,710,816 B (= the catalog's `fileName`; the catalog's `sizeBytes` 531,000,000 is wrong — builder #1's P5 confirmed), `d1-omni-600M-Q8_0.gguf`
  407,207,584 B. `qwen3.5-0.8b-q8` (812 MB) waits until `qwen2.5-0.5b-q8` has run (builder #1's "SECOND, if the first runs"). Builder #4 does
  step 5 (the keyless baseline — no weights needed) and step 6 (the hosted dry-runs), never touching a download; steps 3 / 4 run when the
  files land; step 7 last.

- **D-r8 (orchestrator, 2026-10-31 07:45) — the hosted keys come from Hasan's `.env` files, loaded into the environment by a launcher,
  never read by hand.** Hasan: "TYPESAFE_API_KEY is in .env" = `D:\repos\VidTSX-STUDIO\.env` (gitignored; variable NAMES checked, never
  values). `D:\repos\ai-video-lab\.env` (gitignored) also holds `TYPESAFE_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN`; no `OPENAI_API_KEY` anywhere → **D-b resolves to its fallback, Microsoft-Decision-1 via OpenRouter** (D-d names
  `OPENROUTER_API_KEY`; it is Hasan's own key). The kit launcher `K\hosted-live.sh` sources the two `.env` files in a subshell (`set -a; . <file>`),
  exports `JEV_API_KEY="$TYPESAFE_API_KEY"`, and `exec`s `hosted-run.cjs` — nothing echoes, nothing is copied, the `.env` files are never
  opened by a person or a Read tool, and no log line ever carries a value (set / unset only). The runner's own rules stand (refuses on an
  unset key, scrubs error texts, the shared counter, the $3 check).
- **D-r9 (orchestrator, 07:45) — P10 ("≤ 600 hosted decision calls"): the small tasks run now under EITHER reading; T1 noul waits.** T2 choice
  (1 request / 40 questions), T3 noul (1 / 40) and T1 choice (17 / 240) per provider = 19 requests / 320 questions per provider — inside
  600 whether "calls" means requests or questions. **T1 noul (27 requests / 4,632 questions per provider) is HELD** until Hasan confirms the
  requests reading (explained to him in plain words in the 07:45 reply). The $3 cap is checked before every call regardless.
- **D-r10 (orchestrator, 07:45) — the experiment `D:\repos\ai-video-lab\youtube-videos\01-jev-vs-clef` (2026-10-05, LOG.md) is a PRIMARY
  source for D1 / D2** (Hasan's own measurements from this desk): Jev `jev-1.13.0` routing 6 teams + 1 noul over 200 + 200 emails —
  90.0 % / 85.5 % (fresh), p50 793 ms / p95 1,568 ms end to end, $0.026 per 1,000, **≥ 0.95 confidence → 96.5 % right (171 / 200), below
  0.95 → 33–62 %**; the cascade "decide when ≥ 0.85 sure, else the LLM" held on fresh emails at ~1/6 of the LLM bill; Arabic 12 / 12 (dialects
  + Arabizi); judgment that needs arithmetic / reference is where deciders slip; Jev rejects images (HTTP 400). **Clef-flash / Clef
  (Cloudflare, Apache-2.0, Jev-API compatible: same body, `{"result": …}` wrapper)** scored 91.5 / 91.0 % (fresh 90.0 / 90.0), 748 / 893 ms,
  $0.047 / $0.12, read images, best of all on 77 options (35 / 40); **GPT-6 Luna as a chat LLM** 91.5 % at $0.061 / 1,000 but 2.8 s and no
  usable confidence. **Local: Mapika decider-2b** (Apache-2.0, Qwen3.5-2B-Base fine-tune, 3.76 GB bf16, per-type fitted temperatures, System One
  API, `decider-ai` + torch cu130, `TORCHDYNAMO_DISABLE=1`) 87.5 % / 83.5 % fresh at 152–162 ms on THIS laptop's A3000, "≥ 0.90 → 96.8–98.8 %
  right", Arabic 9 / 12; **Laya typed-decisions on the OFFICIAL Python runtime** 70.5 % / 60.5 % fresh, under-confident (never > 0.80),
  "multilingual: confidently wrong (0.61–0.87)" on the smoke set — the official runtime agrees with D1's reading that zero-shot Laya is not
  usable; Strands 2B 75–76 %, GLiNER 51–59 %. The experiment's venvs (`tools/laya/.venv`, `tools/deciders/.venv`) are GONE (gitignored, deleted);
  their rebuild recipes are in the two `README.md`s; the weights remain (HF cache: Laya english + typed-decisions 808 MB + multilingual 647 MB;
  `tools/deciders/models/Mapika/decider-2b` 3.6 GB). **Consequences:** (a) Clef-flash and Mapika are the two candidates the brief did not name
  that Hasan's own data ranks first in their class — proposed to him (07:45 reply), run only on his yes; (b) the Laya reference check (his
  "yes") = a CPU-torch venv under `B\py-scratch\laya-venv\` (outside every repo; sizes stated first) running the official `laya` package on E1 /
  E2 with the CACHED multilingual checkpoint (`HF_HUB_DISABLE_XET=1`, `USE_TF=0`); (c) for D2: the app's `python-models` service spawns a
  Python process PER REQUEST (`src/local-python-engine/python-runner.ts:102`) for `image` / `3d` catalogue models on a `pytorch` runtime it
  installs — a Python decider in the app would need a persistent worker (a new piece), not that path as is.

- **D-r11 (orchestrator, 2026-10-31 08:05) — the STOPs re-judged with the hosted leg (`K\reports\c-hosted.md` §3–§4, `c-laya.md` §9).**
  - **STOP 1 — FIRES, now on every term.** The rule's hosted reference exists (best hosted T1 choice 85.0 % Jev, T2 100.0 % both; Brier 0.131 /
    0.014): Qwen2.5-0.5B is 57.9 / 25.0 points under, Qwen3.5-0.8B 37.5 / 17.5 under, both over the Brier bound on every task, both over 300 ms
    warm p95; Laya multilingual 50.4 / 55.0 % (now a measurement — see below); d1-omni did not load. **No local default.**
  - **STOP 2 — FIRES for every measured model, hosted included (T1 choice form).** Jev τ 0.5: R@1 79.1 % with wrong-confident 9.6 % (baseline
    80.7 % / 7.1 %, S1 6.3 %); raising τ lowers both, so no τ reaches wc < 6.3 % at R@1 ≥ 75.7 % (τ 0.7: 67.9 % / 7.5 %; τ 0.9: 53.5 % / 3.8 %).
    MSD1 66.8 % / 10.0 % at τ 0.5. Jev's correct-none 71.7 % < the assistant's 79.2 / 75.5 % — it names a clip on ∅ rows MORE often than the
    assistant. The one unmeasured hosted cell is T1 noul (held, D-r9).
  - **STOP 3 — FIRES, and now says WHAT the different design is:** not "no service" but **a different first user and ladder.** (a) On T2 routing
    and T3 verification both hosted deciders are perfect (100 % / 100 %, Arabic included), 0.3–0.5 s (Jev) / 1–3 s (MSD1) per 40-question
    request, < $0.012 per 1,000 decisions, with probabilities that behave (Jev's 0.9–1.0 bin: 92.9–100 % right) — the keyless LLM matches the
    accuracy (100 / 97.5 %) at 10–16 s per call with no usable confidence. (b) On T1 (library search's pick + "nothing fits") no decision
    model beats the assistant's pick, and none gives a better "nothing fits" signal — so **library search keeps S1's design (the assistant picks
    over the top-20) and is NOT the first user**; a decision model there would pay a second call for a worse "none". (c) No local candidate
    qualifies → **the first slice is hosted-first** (Jev → Microsoft-Decision-1 via OpenRouter → the LLM fallback), the local rung designed but
    empty until a candidate passes the bar (Mapika decider-2b, Python runtime, is the one lead — Hasan's call). **D2 is written on (a)–(c) as the
    RECOMMENDED direction, with the brief's original first user kept as the alternative; Hasan chooses at the stop.**
  - **Laya multilingual's status changes from "NOTE, unverified" to a measurement:** the official `laya` 0.4.18 runtime on the official weights
    reproduces the community export to four decimals on E1 / E2 / E3 (E2 `sales` 0.5811 on both) — the card's printed `billing` is stale, the
    export and the port are faithful (P19 answered). Its numbers (T1 noul 17.2 %, T1 choice 50.4 %, T2 55.0 %, T3 60.0 %) stand as Laya's.
  - **D1 → DONE-WITH-STOPS** (the spike's exit is met: every number from a kit file, hosted rows measured for two of three providers; the three
    STOP conditions judged with their numbers). Remaining unmeasured, listed DEFERRED-HASAN: T1 noul on both providers (54 requests, $0.105
    upper — needs the 600 reading), the OpenAI Decisions API (no key), Clef-flash and Mapika (not in the brief; proposed). Builder #10 updates
    `D1-spike-report.md` accordingly; the orchestrator writes D2 (§2, §5.3, §6, §10, §15, §16 from these numbers).

## Stops

(one line per stop: what was reported, what Hasan said)

- 2026-10-30 20:02 · **STOP — D1 BLOCKED by the paste-in's STOP rules** (`docs/studio/decisions/D1-spike-report.md` §11–§14). Reported: no hosted
  key was set, so Jev / OpenAI / Microsoft-Decision-1 are DEFERRED-HASAN (runners built + dry-run, 138 requests ≤ $0.334); no local candidate
  passes the rule's evaluable terms (both Qwen GGUFs fail warm p95 ≤ 300 ms; d1-omni does not load in node-llama-cpp; Laya's community
  export failed its card's example — NOTE only); no measured decision model beats the keyless baseline on T1 (best R@1 48.7 % at
  wrong-confident 38.3 % vs 80.7 % / 7.1 %); STOP 3 for the local leg. D2 left as a DRAFT. Questions for Hasan: the design direction (hosted
  only + the keyless LLM for T1's pick, or a new local runtime), set the keys for the hosted runs, P10 (600 = requests or questions), Laya's
  `pip install laya` reference check, d1-omni's licence / runtime, T2 / T3 labels. **Hasan said (2026-10-31 ~07:30):** (1) "check the
  experiment we did here: D:\repos\ai-video-lab\youtube-videos\01-jev-vs-clef and how it might help us here"; (2) "TYPESAFE_API_KEY is in
  .env"; (3) "I don't understand" (the 600-calls reading — explained in the reply, the small tasks run first, T1 noul held); (4) "yes you can"
  (the `pip install laya` reference check); (5) "not now" (d1-omni); (6) "what are these? I don't understand?" (the T2 / T3 labels —
  explained; no action, labels stand). → **the run RESUMES: D1's hosted leg** (rulings D-r8 … D-r10), then the STOPs re-judged, then D2.
- 2026-10-31 08:26 · **STOP — D1 DONE-WITH-STOPS + D2 written (the protocol stop, D-h).** Reported: the hosted leg measured (Jev / MSD1 T2 100 %,
  T3 100 %, T1 choice 85.0 / 73.8 %; $0.038; T1 noul held); Laya verified faithful (its numbers stand, far from the bar); STOP 1 + 2 fire on
  local AND hosted T1; STOP 3 = a different first user (routing / verification, not the library pick) on a hosted-first ladder with an empty
  local rung; `docs/studio/DECISION_MODELS_DESIGN.md` written on that direction with §15 THE ACCEPTANCE BAR; the questions for Hasan = design
  §16 (direction; T1 noul / the 600 reading; Clef-flash; Mapika; an OpenAI key; the TypeSafe key row; a spend cap). **Hasan said (2026-10-31
  ~08:35):** (1) "lets build a shared decision engine like in images and videos and so on, so we can use anywhere, and we have a section in
  providers for them" (= D2's direction accepted, shaped as an ENGINE like `src/image-engine/` / `src/local-video-engine/`, with a Decisions
  section in AI → Providers); (2) T1 noul: "no"; (3) Clef-flash: "no need now, we can add more providers later"; (4) Mapika: "yes, we can";
  (5) "I don't want to use OpenAI models" (the OpenAI adapter is DROPPED, not deferred); (6) the TypeSafe key row + the OpenRouter key reuse:
  "yes". Then: "lets continue in a new session, give me a prompt" → D2 amended per (1)–(6), the paste-in for session 2 written
  (`docs/studio/decisions/NEXT-SESSION-2.md`: D3 = the Mapika spike for the local rung, D4 = the build per D2 §14, D5 = the verifier against §15,
  then STOP). This session ends at that commit.

## Log

- 15:45 · start checks: main checkout's uncommitted work still there (14 ` M` + 6 `??`, branch `end-to-end-p0` @ `5d77600`); Hasan's dev
  app NOT running (0 `electron.exe`); `JEV_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` unset in every scope.
- 15:46 · resources: C: 29.4 GB, D: 39.6 GB, headroom 33.7 / 99.7 GB, CPU 64 % (`vmmemWSL`).
- 15:47 · branch `decision-models` + worktree `.vidtsx-temp\decisions\wt` @ `efa5e0b`; `NEXT-SESSION.md` checked out from `0df9e9c`.
- 15:50 · this file + `D1/HANDOFF.md` + `D1/LOG.md`; rulings D-r1, D-r2; D1 builder #1 to spawn.
- 15:51 · D1 builder #1 spawned (HEAD `c14b180`; step 1 only, no download / install / launch / call).
- 15:58 · D1 builder #1 HANDOFF (48 calls, ~8 min; **step 1 DONE**, docs `ce3f9e4`): `K\reports\a-sources.md` 227 lines — 22 primary sources
  (P1–P22, read 2026-10-30 via WebFetch, whose page text is a model's extraction — said in the file), secondary sources listed "not used";
  **no D-a…D-c candidate drops**. Contradictions C1–C15 with NEXT-SESSION's summary, the ones that matter: **C5** OpenAI's Decisions API is
  GA (`POST /v1/decisions`, `gpt-6-luna` only, `input` + an ARRAY of 1–400 questions, `predicate` / `choice` / `score` — not System One);
  **C2** Jev 64k per request / 32k per question (262k opt-in), Arabic not named (English "best"); **C7** OpenRouter's decision models live on
  `/api/alpha/decisions` (System One body), not the chat path; **C8 / C10** NEXT-SESSION's Laya numbers (1.7 GB, 2 GB RAM, 512 tokens,
  140 ms) are the community `@receptron/laya` wrapper's ENGLISH bundle — Laya multilingual = mmBERT-base 322M, ≈ 647 MB safetensors, 1,024
  tokens, Arabic weak (0.400 on its card), no fitted temperatures, no official multilingual ONNX; **C12** d1-omni-600M is LFM Open License
  v1.0 (commercial use only under $10 M revenue — not permissive), official GGUF Q8_0 407 MB served by `llama-server` `/v1/systemone`.
  Step-4 pick: `qwen2.5-0.5b-q8` (catalog; Apache-2.0; Arabic named; card says Q8_0 676 MB vs the catalog's 531 MB → Content-Length first)
  → `qwen3.5-0.8b-q8` → d1-omni GGUF. node-llama-cpp 3.18.1: `evaluateWithMetadata(tokens, { probabilities: true })` first yield (or
  `controlledEvaluate` … `generateNext.probabilities`). SemIf's own ladder: 0.6B → 0.440 balanced acc vs 4B 0.813 (a warning for tiny GGUFs).
- 15:59–16:00 · **Orchestrator re-check:** HEAD `ce3f9e4` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty,
  `B\models\` empty (nothing downloaded); `a-sources.md` read in full. **Independent spot check** (WebFetch, ~16:00): P4 confirms GA,
  `gpt-6-luna` "the only currently supported model", `input` + questions array with `name`, `predicate` / `choice` / `score`, "between 1 and
  400 questions"; P7 confirms `POST https://openrouter.ai/api/alpha/decisions` with `model` + `state` + keyed `questions`, `typesafe/jev-1.14`
  $0.042 / M input, Microsoft-Decision-1 "Text only, $0.042 per million input tokens". Rulings D-r3 (Laya route), D-r4 (C7) above
  (commit `a4fc957`, 16:00:34; its first text said "16:01" / "16:02" — estimates, corrected from the clock). D1 builder #2 (step 2 —
  the task sets + measures) to spawn.
- 16:01 · D1 builder #2 spawned (HEAD `57c27f8`).
- 16:12 · D1 builder #2 HANDOFF (43 calls, ~12 min; **step 2 DONE**, docs `71aa0c5`; no download / install / launch / call; S1's kit read
  only): `K\fixtures\t1-pick.json` (240 rows: 187 named / 53 ∅ / 31 `'x|∅'`, 10 Arabic; (c) top-1 135 / 187 = 72.2 % = S1; one `'x|∅'` row
  #1487 has its allowed clip outside the top-20; noul = 4,632 questions, not 4,800 — the 12 music rows have 6 candidates each),
  `t2-routing.json` (40 rows, 10 Arabic, 7 with two allowed families; cut 8 / audio 7 / shots 8 / captions 7 / export 5 / none 5 by first
  family; mapped to 18 of 29 `STUDIO_TOOL_IDS`), `t3-verify.json` (40 rows, 20 yes / 20 no, 7 Arabic; 16 template / 10 caption-style / 14
  library-clip pairs, every quoted source file:line checked; the requests / script lines are the builder's own — the repo has no
  narration fixture); `K\measures.cjs` + `score.cjs` + `selfcheck.cjs`; ONE answer-file format `vidtsx-d1-answers/1`; `K\reports\b-tasksets.md`
  (composition, judgement calls) + `b-selfcheck.md` — **17 / 17 PASS**, incl. S1's own top-20 picks as P = 1 choice answers → R@1 151 / 187,
  pick acc 170 / 187, wrong-confident 15 / 240 (4 / 11), correct none 42 / 53, false none 13 / 156 = S1 §10 exactly.
- 16:13 · **Orchestrator re-check:** HEAD `71aa0c5` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  `node selfcheck.cjs` re-run in `K` → 17 / 17 PASS (same table); all 40 T2 rows and every third T3 row read — plain-meaning labels hold
  (T2 "Remember that I always want …" → none = outside the five families, accepted). Resources 16:13: C: 29.1 GB, headroom 36.1 GB, CPU
  33.9 %, 0 `electron.exe`. D1 builder #3 (step 3 — Laya multilingual per D-r3; first download) to spawn.
- 16:14 · D1 builder #3 spawned (HEAD `464f613`).
- 16:28 · D1 builder #3 HANDOFF (63 calls, ~15 min; step 3 part 1, docs `23269e8` `bfff9d7`; no model run): **route (1) `laya-ts` did not run**
  — npm name `laya-ts` 0.1.0 is NOT on the registry (`{"error":"Not found"}`), GitHub releases carry only the Python wheel / sdist, and its
  weights come only from `python laya-ts/scripts/export_onnx.py` (no `.onnx` in either official Convai repo); nothing installed, `B\npm-scratch\`
  empty. **Route (2) = `desplega/laya-onnx` `multilingual/fp32`** (encoder + head + tokenizer + `rl_agent_config.json` = the layout `laya-ts`
  loads; its manifest names upstream + revision + a sha256 per file; tokenizer sha256 = the official repo's): 1,324,748,627 B stated first;
  the download PAUSED at 150,076,382 B (HF ~80 KB/s per connection), every download process stopped. Kit: `K\laya-run.cjs` (Laya's pre /
  post-processing ported from the official `laya-ts` source, onnxruntime-node 1.24.3 + `@huggingface/tokenizers` read-only; `--examples` = E1
  Hindi `billing` 0.86, E2 the card's Quickstart `billing`, E3 Arabic sanity; answer files with cold / warm / RSS / CPU load) — not run yet;
  `K\dl-parallel.sh`; the `laya-ts` source read as text under `B\src-read\`. T1 choice fits 21 options by Laya's own head budget
  (`head_max_len` 256). New open problems P8 (download speed), P9 (the Laya framing is its judgement; a NOTE variant with the clip lines in
  the state).
- 16:29–16:31 · **Orchestrator re-check:** HEAD `bfff9d7`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; the partial parts on
  disk; 0 download processes left; `B\npm-scratch\` empty; no reusable GGUF / Laya file anywhere under `vidtsx-e2e`, `.vidtsx-temp`,
  `~/.node-llama-cpp`, `~/.cache/huggingface`. Speed test (16:30, one connection, a 16 MB range of Qwen's official GGUF, file deleted after):
  74,305 B/s; Content-Length 675,710,816. `dl-parallel.sh` read. Resources 16:31: C: 28.5 GB, headroom 33.2 GB → ruling D-r5.
- 16:32 · orchestrator background downloads started (3 jobs: Laya resume, Qwen2.5-0.5B Q8_0, d1-omni Q8_0; logs `B\models\*-download.log`).
  HANDOFF "Next step" amended for builder #4 (steps 5 → 6, then the adapter).
- 16:33 · D1 builder #4 spawned (HEAD `b905295`).
- 16:47 · D1 builder #4 HANDOFF (64 calls, ~15 min; **steps 5 + 6 DONE**, docs `7f72203`): `wt/out` built 16:36–16:39 (rc 0); profile
  `decisions-D1` (0 `settings.db*` in the copy), CDP 9300, Studio root `B\studio-root` set first; other sessions' instances seen at 16:41 (CDP
  9341, and 9296 on `timeline-T`) never touched; **16 / 40 keyless calls** (probe + T1 × 12 + T2 + T3 + one counted re-ask of t1-06, whose
  `success: true` text was cut mid-JSON at 792 chars), all `claude-sonnet-5-5`; its instance stopped. **Baseline (`K\reports\c-baseline.md`):**
  T1 hard — R@1 151 / 187 = 80.7 %, pick acc 173 / 187 = 92.5 %, **wrong-confident 17 / 240 = 7.1 %**, correct none 40 / 53 = 75.5 %, false none
  10 / 156 = 6.4 % (S1: 80.7 / 90.9 / 6.3 / 79.2 / 8.3; same pick on 225 / 240 rows); verbalised confidence (NOTE) at τ 0.5 wrong-confident
  5.8 %, R@1 80.2 %; **T2 100.0 % (Arabic 10 / 10), T3 97.5 % (Arabic 7 / 7)**; T1 call (20 rows) p50 10,424 ms / p95 23,370 ms. **Step 6:**
  `K\hosted-run.cjs` (Jev System One; OpenAI `/v1/decisions` with `input` + `questions[]`; Microsoft-Decision-1 via OpenRouter's Decisions API —
  OpenRouter's own reference read: `criteria` {true, false} REQUIRED on `noul` there, optional at TypeSafe), keys from `process.env` only,
  each refuses when unset (exit 2 ×3), shared counter `K\hosted-calls.jsonl` ≤ 600 + the $3 check before any call; dry-run bodies (first in
  `K\hosted-dryrun\`, all 12 MB in `B\hosted-dryrun\`): 138 requests (46 per provider), upper-bound $0.334. Open problems: **P10** (Hasan) —
  D-e's "600 hosted decision calls" read as HTTP requests; if he meant questions, T1 noul (4,632 per provider) cannot run hosted; **P11** —
  `llmGenerate` can return truncated text marked success (a D2 note); **P12** — D-r2's reference: beat = wrong-confident < 6.3 % at a τ with
  R@1 ≥ 75.7 %.
- 16:48–16:50 · **Orchestrator re-check:** HEAD `7f72203` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  `K\c-calls.jsonl` = 16 lines, every one ok, `claude-sonnet-5-5`, 9.0–23.4 s; a key-pattern scan (`sk-…`, `Bearer …`) over `K` and
  `B\hosted-dryrun\` → nothing; `K\hosted-calls.jsonl` absent (0 hosted calls). P12 checked against D-r2 (6.3 % is the lower of S1's 6.3 % and
  this run's 7.1 %; R@1 80.7 − 5 = 75.7) — right. Downloads at 16:48: d1-omni 155.6 / 407.2 MB, Qwen 157.3 / 675.7 MB, Laya 243.7 / 1,324.7 MB
  (~0.41 MB/s in all). HANDOFF Next step: how a builder sees a landed file (log `ok` + `sha256sum` + `end`, hash = expected). D1 builder #5
  (`llama-run.cjs`, then d1-omni / Qwen runs as they land) to spawn. (Commit `09f965c` landed 16:49:21; the "16:50" in this entry and in
  HANDOFF's note was an estimate.)
- 16:49 · D1 builder #5 spawned (HEAD `09f965c`).
- 16:57 · D1 builder #5 HANDOFF (38 calls, ~9 min; step 4 part 1, docs `f5dfb26`; no model loaded — neither file had landed at 16:56:49):
  `K\llama-run.cjs` 149 lines (the `laya-run.cjs` CLI + `--gpu-layers auto|max|N`, `--candidate`, `--licence`, `--info`; the model's chat
  template; letter / Yes-No option labels, refuses a multi-token label; the first next-token map via `controlledEvaluate` …
  `generateNext.probabilities` at temperature 0 — the native sampler then adds no top-k / top-p / min-p, so the map is the whole vocabulary,
  checked by recording its size + sum on the first question; renormalised over the options with the raw option mass recorded; the shared
  prefix reused and checked once against a fresh evaluation; cold / first answer / per-request / per-question latency, peak RSS, VRAM,
  CPU load; its own resource guard incl. "no other laya-run / llama-run"); `K\temp-oof.cjs` 44 lines (the out-of-fold temperature NOTE for
  any answer file; random files → T ≈ 20, as expected). **P13: the GPU path here is Vulkan** (the CUDA prebuilt fails `NoBinaryFoundError` —
  no CUDA toolkit; Vulkan sees the RTX A3000 + Intel UHD, its VRAM reading is broken (free 0) → `--gpu-layers auto` may put 0 layers on
  the GPU; use `max`). Bundled llama.cpp b8390 has `lfm2` but no `systemone` code. P14: its prompt wording is its judgement (for review).
- 16:58–16:59 · **Orchestrator re-check:** HEAD `f5dfb26` = HANDOFF + LOG only, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty;
  the two scripts on disk (149 + 44 lines); 0 `llama-run` / `laya-run` processes. Downloads at 16:59:05 (rates since 16:48:25): d1-omni
  222.1 / 407.2 MB (~104 KB/s → ≈ 17:29), Qwen 227.9 / 675.7 MB (~110 KB/s → ≈ 18:07), Laya 357.5 / 1,324.7 MB (~178 KB/s → ≈ 18:30). No
  builder until a file lands (a builder must not idle on a download); the next spawns when the d1-omni job reports. **While waiting, the
  orchestrator drafts D2's sections that do not depend on D1's numbers** (contract, adapters, processes, keys, IPC, users, tool / step) —
  marked DRAFT; the recommendation, the local default and THE ACCEPTANCE BAR are written only after D1 is DONE and its STOP judged.
- 17:02 · `docs/studio/DECISION_MODELS_DESIGN.md` DRAFT committed (`99def5d`, 278 lines: contract, layout, adapters, ladder, processes, keys,
  timeouts / cache / usage, the first users without claims, the `decide` tool = flow node, IPC, not-in-slice, build order; §2 / §5.3 / §15 /
  §16 PENDING D1).
- 17:38 · **d1-omni landed:** the job ended 17:37:55 — `ok … 407207584`, sha256 `cd94463f…3d3` = expected (four curl resets / one DNS failure
  on the way, absorbed by the per-part retries). Qwen 518.5 / 675.7 MB (~126 KB/s since 17:03 → ≈ 18:00), Laya 840.0 / 1,324.7 MB (~208 KB/s
  → ≈ 18:17). D1 builder #6 (d1-omni `--info` + self-test, then Qwen when it lands) to spawn.
- 17:38 · D1 builder #6 spawned (HEAD `ce296e6`).
- 17:39–17:43 · **downloads (orchestrator, while builder #6 ran — logged now):** the network sped up. Qwen2.5-0.5B landed 17:39:34 (`ok …
  675710816`, sha256 `ca59ca7f…44e` = expected). Laya: tokenizer / head / `rl_agent_config` landed with the manifest's hashes, but the encoder
  job ended `FAIL … (a part is short)` at 17:39:29 after a burst of DNS failures exhausted some parts' retries; re-run 17:39:49 (same 32
  parts, resumed) → `ok … encoder.onnx 1230282662`, sha256 `4bf4feb8…` = `manifest.json`, 17:40:41. With the network fast, the orchestrator
  also fetched builder #1's SECOND GGUF, `qwen3.5-0.8b-q8` (the catalog's own `downloadUrl`, unsloth/Qwen3.5-0.8B-GGUF; 811,843,840 B, sha256
  `0ad885ff…7a6c` from the HF API, stated first; C: 25 GB free) → landed 17:43:04, hash equal. Every D1 weight file is on disk and checked.
- 18:24 · D1 builder #6 HANDOFF (51 calls, ~46 min incl. its runs; step 4 part 2 DONE, docs `aca2ca3` `ba41a37`): **d1-omni did not run** —
  `llama_model_load: error loading model: missing tensor 'blk.16.ffn_gate.weight'` (Vulkan and CPU); its GGUF metadata says encoder + decision
  head (`lfm2.decision.type lfm2-d1-omni`, `attention.causal false`), only `chat_template.systemone`, `ar` among its 15 languages, fitted
  temperatures per question type → needs `llama-server /v1/systemone` or the community ONNX (+ the revenue-capped licence): P15 for Hasan.
  **Qwen2.5-0.5B Q8_0** (self-test: map 151,936 entries = the vocabulary, sum 1.00001, options present, prefix reuse ≤ 0.0066; Vulkan `auto` put
  0 layers on the GPU → `--gpu-layers max` = 25 / 25 on the RTX A3000): T1 noul 43.2 % (Arabic 18.8 %, Brier 0.336, ECE 0.488; P(Yes) ≥ 0.5 on
  2,796 questions vs 321 true; OOF T at the grid max 20 both folds), T1 choice 27.1 % (top answer "none" on 180 rows), **T2 75.0 %** (Arabic
  80.0 %, Brier 0.155), **T3 67.5 %** (Arabic 57.1 %); D-r2: **does not beat the baseline** (best R@1 36.4 %, wrong-confident 71.7 % at τ 0.5;
  choice R@1 0 % = abstains). Warm per question p50 / p95: T1 noul 208 / 389 ms, T1 choice 569 / 722, T2 230 / 275, T3 222 / 351 ms; peak RSS
  ≤ 1,087 MB; VRAM 800 → ~1,700 MiB. **P16:** ~5/6 of a warm question is node-llama-cpp building a JS map of the whole vocabulary (forward
  pass alone p50 30 / p95 62 ms vs 175 / 279 with the map) — a product adapter must read only the option tokens' logits. **P17:** its CPU-only
  runs (T2 9.8 / 12.2 s, T3 7.5 / 18.2 s per question) ran at node-llama-cpp's default 4 threads and partly under another session's load
  (`ffmpeg`, `chrome-headless-shell`) — not a fair CPU figure, not repeated. Kit fixes: cold timings exclude the guard probes;
  `ignoreMemorySafetyChecks` with `max` layers (Vulkan's VRAM reading → `InsufficientMemoryError`); new `llama-mapcost.cjs`,
  `c-llama-run-all.sh`. P18: run `qwen3.5-0.8b` at all?
- 18:25 · **Orchestrator re-check:** HEAD `ba41a37`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; `K\answers\` holds the 4 + 2
  CPU + 4 OOF Qwen files and `K\reports\c-llama-*` their scores; `c-llama.md` :33 quotes the load error, :85-87 the D-r2 verdict against both
  references; 0 `llama-run` / `laya-run` processes. **Ruling D-r6 (18:25) — P18 + P17:** `qwen3.5-0.8b-q8` is already on disk (above), so it
  runs AFTER Laya with the same four runs (Vulkan `max` layers the headline; cheap: ~20 min), recorded as the second GGUF of the SemIf
  adapter. A fair CPU figure (`--threads` added to `llama-run.cjs`, e.g. 8 of 16) is taken only for a GGUF candidate still in contention
  after its T1 run. A larger GGUF (`qwen3.5-2b-q4km`, 1.28 GB, catalog) is NOT run unless the orchestrator asks after Laya and the 0.8B — it
  would test whether the method scales, not the brief's "tiny GGUF". D1 builder #7 (step 3 — Laya, then the 0.8B) to spawn.
- 18:26 · D1 builder #7 spawned (HEAD `98801e7`).
- 19:16 · D1 builder #7 HANDOFF (70 calls — over budget because its runs could not be left running; docs `28b509f` `8ef2746`): **Laya multilingual
  did not run — the worked-example gate FAILED** (`K\reports\c-laya.md` §4): E1 (README) `billing` P 0.9929 (stated 0.86); **E2 (the card's
  Quickstart, text checked verbatim) `sales` 0.5811 vs `billing` 0.4168** (stated `billing`); each question alone = identical (no padding
  fault); `add_special_tokens` makes E2 worse (0.7340 `sales`). Port audit line by line against the official `laya-ts` source: every step the
  same (§5). The official `model.safetensors` is unchanged between the export's revision `e4e9ddf2` and main; telling an export fault from
  stale printed outputs needs the official Python runtime (D-r3 forbids). The card's own Limits: "Ships uncalibrated … systematically
  over-confident", "Near chance on typed-decisions zero-shot — 0.342, against a 0.318 random". P19 (options a / b / c) for the orchestrator.
  **Qwen3.5-0.8B Q8_0 (D-r6) DONE** (`c-llama.md` §8): the `--info` probe showed P(`<think>`) 0.9999 at the answer position → `--thoughts
  discourage` (an empty `<think></think>`, Qwen's non-thinking mode) added BEFORE any run and used in all (P20); self-test pass (25 / 25 layers
  Vulkan, map 248,320 = vocabulary, sum 1.00007); T1 noul 87.0 % (below the 93.1 % of always-No; P(Yes) ≥ 0.5 on 610 vs 321 true), T1 choice
  47.5 %, **T2 82.5 %** (Arabic 60.0 %), **T3 85.0 %** (Arabic 57.1 %); D-r2: best R@1 48.7 % (noul τ 0.5) with wrong-confident 38.3 %; τ 0.7 →
  R@1 10.7 % / wc 8.3 % — **does not beat the baseline**; OOF T < 1 on noul (T1 0.27 / 0.30 — under-confident; T1 noul Brier 0.132 → 0.092);
  warm per question p50 / p95 T1 noul 326.1 / 482.7 ms (quiet), T2 281.0 / 353.3 ms (repeat, chrome 4–6 %) — the other two loaded twice by
  another session's `ffmpeg` (55–65 %) / chrome / GPU use, answers identical in the repeats (P21); **fails warm p95 ≤ 300 ms on every task**;
  peak RSS ≤ 1,552 MB. Resources 19:15: C: 24.79 GB, headroom 50.77 GB, no model process left.
- 19:18 · **Orchestrator re-check:** HEAD `8ef2746`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; `c-laya.md` §4–§7 read
  (the E1 / E2 / E3 table, the port audit, what would settle it); 0 model processes. **Ruling D-r7 (19:19) — P19:** option (a). Laya
  multilingual runs the four tasks ONCE as a labelled NOTE ("community export FAILED the worked-example gate (E2) — numbers unverified"),
  CPU EP, same framing / scoring / OOF as every candidate, no timing claims beyond what the run records; it is **never eligible for the
  rule's recommendation**. Why: it is D-c's first candidate and Hasan's D2-stop question ("is a local decision model viable?") is better
  answered with its numbers beside the card's own "near chance" warning than without them; the runs are cheap. (b) (the English checkpoint,
  another ~1.7 GB community bundle) is not run; (c) (`pip install laya` for the official runtime) goes on Hasan's list. Then step 7 — the
  report, the recommendation by the rule as D-r1 reads it, and the STOP judgement. D1 builder #8 to spawn. (Commit `ad436b8` landed
  19:18:39; the "19:19" above was an estimate.)
- 19:19 · D1 builder #8 spawned (HEAD `ad436b8`).
- 20:00 · **D1 builder #8 — status BLOCKED** (90 calls incl. a 34-min run; over budget by choice — it drafted the report while T1 noul ran;
  docs `753711b`): **D-r7 Laya NOTE runs** (kit fixes first: `--threads`, a package-version read, the CPU probe; CPU EP 8 intra-op threads,
  19:22:51 → 19:56:59, every run rc 0, quiet machine): T1 noul 17.2 % (P(true) ≥ 0.5 on 4,138 / 4,632; OOF T 20 / 20), T1 choice 50.4 % (best
  R@1 55.6 % at wrong-confident 39.2 %), T2 55.0 %, T3 60.0 %; per question p95 469.2 ms (T1 noul); OS peak RSS 2,269–3,109 MB — every number
  labelled unverified. **The report `docs/studio/decisions/D1-spike-report.md`** (422 lines, every number names its kit file): §11 the rule as
  D-r1 reads it → **no local default** (Qwen2.5-0.5B and Qwen3.5-0.8B fail warm p95 ≤ 300 ms — 388.7 / 722.1 / 350.6 ms and 482.7 / 353.3 ms
  per question; d1-omni did not load; Laya not eligible); §12 **STOP 1 FIRES; STOP 2 FIRES for every measured model** (best local R@1
  48.7 % at wrong-confident 38.3 % vs the bar < 6.3 % at R@1 ≥ 75.7 %; hosted DEFERRED-HASAN — only they could overturn it); **STOP 3 FIRES
  for the local leg** (builder's judgement, P23 — the orchestrator may re-word): no local default from today's candidates; a local leg needs
  a different runtime (an option-logit reader without the vocabulary map, `llama-server` for d1-omni, or an official Laya export). §13
  DEFERRED-HASAN (the hosted runs: one-call probe per provider, then 138 requests ≤ $0.334); §14 six questions for Hasan. Calls: keyless 16 /
  40, hosted 0; no scratch npm install (`B\npm-scratch\` never created); one app launch (step 5).
- 20:01–20:02 · **Orchestrator re-check:** HEAD `753711b`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty, 0 model processes,
  0 `electron.exe`; the report read (§0, §4, §5, §8–§15); spot checks against the kit's score files — Qwen3.5-0.8B T1 noul accuracy 0.8703 at
  τ 0.5 (= 87.0 %), the baseline's T1 choice accuracy 0.8875 (= 88.8 %), `c-llama.md` :190 / :194 hold 482.7 and 353.3 ms. **STOP 3 wording
  accepted as written** (it separates the measured local leg from the unmeasured hosted leg). **D1 → STOP (BLOCKED by Hasan's own STOP
  rules).** Per the paste-in ("STOP and ask me if …"), D2 is NOT finished: `DECISION_MODELS_DESIGN.md` stays the 17:02 DRAFT (its header now
  says it waits on Hasan's answer). → the stop report (20:02; commits `ddf317f`, `e48f7c7`).
- **2026-10-31 07:33 · RESUMED** on Hasan's six answers (Stops). Start checks: main checkout `end-to-end-p0`, Hasan's dev app not checked
  for a launch (none needed — no app launch in this leg); 0 model processes. Read: the experiment's `RESEARCH.md`, `PLAN.md`, `LOG.md`,
  `tests/run.py`, `tests/teams.py`, `results/summary.json`; `tools/laya/README.md`, `tools/deciders/README.md`, Mapika's card +
  `decider_config.json`; the app's `src/local-python-engine/` + `python-models/registry.ts`; `.env` variable NAMES in both repos (values
  never printed; both files gitignored). Rulings D-r8 … D-r10. The model is now Fable 5.1 (commit attribution changes accordingly).
- 07:45 · D1 builder #9 (the hosted leg: `K\hosted-live.sh`, one probe call per provider, then T2 / T3 / T1 choice for `jev` and
  `openrouter-msd1`; scores; the rule's two hosted terms + STOP 2 re-judged for these; then the Laya reference check per D-r10 (b) if budget
  remains) to spawn. Spawned 07:43 (HEAD `5844667`).
- 08:00 · D1 builder #9 HANDOFF (51 calls, ~18 min; docs `b105641` `60564b9`): `K\hosted-live.sh` (D-r8 — sources both `.env` files with stderr to
  /dev/null, strips a trailing CR by parameter expansion, exports `JEV_API_KEY`, `exec`s the runner; the dry check reports jev / openrouter set,
  openai unset); **the hosted leg LIVE 07:45:22–07:46:56: 38 requests, 19 per provider (T2 choice probe 1, T3 noul 1, T1 choice 17), all HTTP
  200, T1 noul NOT run (D-r9)**; Jev `jev-1.14.0` 268–743 ms per request, MSD1 `microsoft/microsoft-decision-1-20261009` 664–2,983 ms; both
  return full probability maps (Σ 1.0000) + `confidence`; Jev rounds to hundredths (P24). `K\reports\c-hosted.md`: **Jev T2 100.0 % (Arabic
  10 / 10; Brier 0.021), T3 100.0 % (Brier 0.003), T1 choice 85.0 % (Brier 0.131, ECE 0.094; 0.9–1.0 bin 92.9 % right); D-r2 τ 0.5 R@1 79.1 % /
  wc 9.6 % (8 named / 15 ∅), correct none 71.7 %; τ 0.7 67.9 / 7.5; τ 0.9 53.5 / 3.8. MSD1 T2 100.0 %, T3 100.0 %, T1 choice 73.8 % (Brier 0.191,
  over-confident: 0.9–1.0 bin 84.5 %; HELD-OUT 66.0 %); τ 0.5 66.8 / 10.0.** STOP 2 not overturned by either; the rule's two hosted terms FAIL
  for both GGUFs. Latency p50 / p95 per request: Jev T1 choice 404 / 743 ms (29 / 52 ms per question), T2 499, T3 342; MSD1 978 / 1,145, 2,983
  (first call), 1,084. Cost: Jev 479,417 input tokens = $0.0201; MSD1 418,770 = $0.0176 (= OpenRouter's own `usage.cost`); ≈ $0.038 in all,
  counter 38 / 600; T1 choice ≈ $0.07–0.08 per 1,000 picks (the 20 clip lines ride with every question — P26), T2 / T3 < $0.012. **D-r10 (b)
  DONE:** venv `B\py-scratch\laya-venv` (912 MB: torch 2.15.0+cpu 126.6 MB wheel, laya 0.4.18, transformers 5.22.1; sizes stated first; C: 31 GB
  after), `K\laya-official-check.py` offline on the cached multilingual checkpoint → **the official runtime = the community export to four
  decimals on every question of E1 / E2 / E3 (E2 `sales` 0.5811)** → P19 answered: the card's printed outputs are stale; Laya's NOTE runs are
  measurements (`c-laya.md` §9). New: P24 (hundredth rounding), P25 (T1 noul the one unmeasured hosted cell), P26 (T1 framing cost).
- 08:02–08:05 · **Orchestrator re-check:** HEAD `60564b9`, tree clean, `efa5e0b..HEAD -- src scripts package*.json` empty; the ledger = 19
  HTTP-200 requests per provider; a key-pattern scan (`sk-…`, `sk-or-…`, `Bearer …`, `<NAME>=<value>`) over `K`, `B\hosted-responses`,
  `B\hosted-dryrun` and the docs → nothing; `hosted-live.sh` read (no value in it); 0 node / python processes; `c-hosted.md` §2–§8 and
  `c-laya.md` §9 read — the numbers above are the files'. → **ruling D-r11** (the STOPs re-judged; D1 DONE-WITH-STOPS; D2's direction).
  D1 builder #10 (the report's hosted rows + Laya's status + §11–§15 per D-r11) to spawn; the orchestrator writes D2 meanwhile and commits
  after the builder hands back. (D-r11's "08:05" is the ruling's own stamp; its commit `4feacfd` landed 08:04:04.)
- 08:06 · D1 builder #10 spawned (HEAD `4feacfd`); the orchestrator wrote `docs/studio/DECISION_MODELS_DESIGN.md` (357 lines) in parallel.
- 08:23 · **D1 builder #10 DONE** (61 calls; docs `f48ec2e` — the report, HANDOFF, LOG only): `D1-spike-report.md` 422 → 585 lines — §0 the
  verdict first (DONE-WITH-STOPS, the three STOPs with D-r11's numbers), §2 what ran (Jev + MSD1 19 requests each, $0.038; T1 noul HELD; OpenAI
  no key; Laya measured; d1-omni parked), §4 six hosted rows + Laya relabelled "verified = the official runtime on E1–E3", §5 the hosted rows at
  every τ, §7 / §8 hosted latency + cost, §10 findings 9–12 (P24–P26, Laya faithful), §11 the rule with the hosted reference, §12 first judgement
  + re-judged, §13 / §14 / §15 per the brief; final `status: DONE-WITH-STOPS` with the three STOPs one line each. No number re-scored or invented
  (its check: every added number names `c-hosted.md` §N / `c-laya.md` §9 / a score file / ORCHESTRATOR D-r10 for the experiment's figures).
- 08:25 · **Orchestrator re-check:** HEAD `f48ec2e`; `git status` = only the orchestrator's D2 file; `efa5e0b..HEAD -- src scripts package*.json`
  empty; the report's §0 and its status line read (D-r11's numbers verbatim); "NOTE, unverified" survives once (the §12 first-judgement history);
  no Jev / MSD1 row still reads DEFERRED; a key-pattern scan over every doc under `docs/studio/decisions/` and the design note → nothing;
  0 `electron.exe`. → D2 committed with this file (`3cd3404`, 08:27:04); **the run STOPS (D-h).**
- 08:35–08:50 · **Hasan's six answers** (Stops) → D2 amended in place (header; §1 items 2–4 — the engine shape, no OpenAI, Mapika spiked; §4 the
  engine layout mirroring `src/image-engine/` + `image-init.ts`; §5.2 OpenAI dropped; §5.3 Mapika = D3; §6 the ladder local → Jev → OpenRouter →
  LLM; §8 the Providers "Decisions" section via `ProviderCapability 'decision'`; §13 / §14 (D4 (a)–(h), (g) only on D3's PASS); §16 = his
  answers); `NEXT-SESSION.md` marked SPENT; **`docs/studio/decisions/NEXT-SESSION-2.md` written** — the session-2 paste-in (Decisions E-a … E-h
  verbatim from his answers; D3 the Mapika spike → D4 the build → D5 the verifier → STOP; caps hosted ≤ 60 requests / $0.50, keyless ≤ 10, no
  npm package, Python only in scratch venvs; keys only via `hosted-live.sh`). Memory updated. **Session 1 ends at this commit.**

---

# Session 2 — D3 the Mapika spike · D4 the build · D5 the verifier (2026-10-31)

> Run brief: Hasan's paste-in in `docs/studio/decisions/NEXT-SESSION-2.md` ("Paste-in", :35-149), with that file's "Decisions" block
> (E-a … E-h, :10-31) as his answers — given 2026-10-31 ~08:48 ("run the fenced "Paste-in" block in it as your brief, exactly as written,
> with the "Decisions" block in that file as my answers (E-a…E-h) — it is my instruction for this session. Start with its FIRST step.").
> It follows `docs/studio/END_TO_END_RUN.md`'s loop (builders with the 30 % hand-off rule, an independent verifier, the stop report, "things
> you never do") with the paste-in's overrides. Parts D3 → D4 → D5 run in order with NO stop between them unless a STOP rule fires; **the
> session STOPS after D5** (the verifier's PASS, or three FAILs — E-h). Session 1's rulings D-r1 … D-r11 stay on record above; the ones
> that still bind are D-r8 (keys only through `hosted-live.sh`) and D-r10 (the experiment is a primary source).

- Start state (08:48): main checkout `end-to-end-p0` @ `5d77600` with the other session's 14 ` M` + 6 `??` files (unchanged; never
  touched); **Hasan's dev app NOT running** (0 `electron.exe`; nothing listening on 9222 / 5173 / 9300–9305). Worktree
  `.vidtsx-temp\decisions\wt` on `decision-models` @ `b2b8a02` (session 1's last commit), tree clean. Resources 08:49: C: 29.5 GB free;
  memory commit 48.0 GB free of 94.2 GB; RAM 31.5 GB free; GPU RTX A3000 Laptop 6,144 MiB (662 MiB used), driver 581.15.
- The model is Opus 5.5 → commits end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the line this session shows).
- **Folders (session 2):** kit `K3` = `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D3\`, big outputs / venv `B3` =
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D3\`; D4's scratch `B4` = `…\vidtsx-e2e\decisions\D4\`; D5's `B5`. D1's kit `K1` =
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\` (fixtures, `score.cjs`, `measures.cjs`, `hosted-run.cjs` + `hosted-live.sh`) is
  reused read-only. **Ports / profiles:** D4 builders CDP **9302**, profile `…\vidtsx-e2e\profiles\decisions-D4\profile`; the verifier CDP
  **9305**, profile `…\profiles\decisions-D5-verify\profile` (both copied from `profiles\source\profile` WITHOUT `settings\settings.db*`).
- **Caps ledger (E-g):** hosted 0 / 60 requests, $0.000 / $0.50 (D3 none; D5 ≤ 20 / ≤ $0.05); keyless claude-subscription 0 / 10.

| Part | Status | Builders spawned | Re-check / verifier | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| D3 — the Mapika spike (no product code) | **DONE — verdict FAIL: the local rung stays empty** (a note, no STOP; D4 (g) not built) | 3 | orchestrator re-check 09:30 (headline re-scored equal) + 09:44 (report) | docs `b5a3d3e` `17b3348` `15b00d8` `048c8a7` `2082918` | GPU headline T2 38 / 40 Brier 0.053, T3 33 / 40 Brier 0.122, off-list 0, warm p95 92.5 / 227.2 ms, peak RSS 4,483.7 MB → 3 PASS / 4 FAIL; `D3-mapika-report.md` 264 lines | 2026-10-31 08:53 / 09:43 |
| D4 — the build (D2 §14 (a) → (h), (g) dropped by D3's FAIL) | BUILDING — (a) `c7ad6da`, (b) `ed79420`, (c) `b7b1648` + `d9ec730`, (d) `feb5e69`, (e) `5605c48` DONE; (f) next | 6 | (a) 10:02, (b) 10:19, (c1) 10:36, (c2) 10:48, (d) 11:23, (e) 11:43 | code `c7ad6da` `ed79420` `b7b1648` `d9ec730` `feb5e69` `5605c48` | replay = c-hosted §2 (4 rows); decisions + engine 179 + 2 skipped; tsc 25 / 10 | 2026-10-31 09:46 / — |
| D5 — the verifier (D2 §15) | TODO | — | — | — | — | — |

## Answers in force (session 2 — Hasan, 2026-10-31, the Decisions block of NEXT-SESSION-2.md, verbatim)

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

- **D3's bar (paste-in (e), verbatim terms):** T2 ≥ 38 / 40 AND T3 ≥ 38 / 40, Brier ≤ 0.05 on each, 0 off-list answers, warm p95 ≤ 300 ms
  per request, RSS ≤ 2 GB (VRAM reported beside; if RSS is the only failing term because the weights live in VRAM, Hasan rules at the stop).
  PASS → the local rung ships in D4 (g); FAIL → the rung stays empty, a note. STOP only if the runtime cannot run on this laptop at all, or
  the numbers point to a different design than D2's.

## Rulings (session 2)

- **D-r12 (orchestrator, 08:52 — before any measurement) — D3's framing and what "per request" means.** D1's hosted runner
  (`K1\hosted-run.cjs:45-57`) sent `state` = the task rule (`T.instruction`) and one self-contained question per row (the row's text inside
  `instructions`, D1's `criteria`), 40 questions packed into one request. A product `decide` call (D2 §10.1–10.2: `route_request`,
  `check_matches_request`) carries ONE state and ONE question. So D3's **headline runs = D1's exact question texts and criteria, sent ONE ROW
  PER REQUEST** through the worker (state = the task rule, one keyed question) — accuracy stays comparable with the hosted rows, and the
  bar's "warm p95 ≤ 300 ms per request" is read on these (per request = per question here). **One PACKED run per task (all rows in one
  System One call, = D1's hosted request) is a NOTE** for the per-question amortised time, if the Mapika API takes many questions per call.
  A product-shaped variant (state = the row's text, a generic question) is an optional NOTE, never the headline.
- **D-r13 (orchestrator, 09:12) — which RSS the bar's "RSS ≤ 2 GB" reads (builder #1's open problem).** The term reads the worker's **PEAK
  RSS over the whole measured run** (process start → last answer) — the measure D1 used for every local candidate (`c-llama.md`, `c-laya.md`
  peaks). The steady RSS after the warm runs, the peak private commit and the VRAM (max allocated / reserved, nvidia-smi before / after) are
  reported beside it. The worker loads through the package's own API (`decider.infer.Decider(path, device=…)`), unmodified; a lower-peak load
  is allowed only through a documented `Decider` argument or the order of our own worker's steps (never a patch to the package), only if the
  smoke's answer stays identical to 4 dp, and then both loads are reported. **If peak RSS is the ONLY failing term, the verdict is "FAIL (RSS
  only)"; per the paste-in's (e) Hasan rules at the stop, so D4 (g) is NOT built in this session** — the report's "How D4 (g) productises it"
  section is the recipe for a follow-up. Private commit (6,651.1 MB in `b-smoke-gpu-run2.json`) is checked by the resource guard before every
  load (C: + commit headroom ≥ 6 GB; 48 GB headroom at 08:49).
- **D-r14 (orchestrator, 09:12) — v11 only.** D3 measures the weights on disk = Hub tag `v11` (sha256 `acaef222…817f`, `a-facts.md` §1). v12
  (Hub `main` since 2026-10-20; noul T 0.05 = uncalibrated yes / no by default; a fitted map on its card), the maker's v12 GGUFs and decider-0.8b
  are FACTS in the report, not measured — the brief authorises the experiment's folder, no new 3.8 GB download. A D4 (g) first-use download pins
  revision `v11` and checks that sha256 (the size cannot tell v11 from v12).
- **D-r15 (orchestrator, 09:33) — the rest of D3 (d): the packed T3 / T1 notes are NOT run; the CPU note and one product-shaped note are.**
  The packed form does not fit this 6 GB card: T2 packed (40 questions in one call) peaked at 6,185 MB VRAM allocated / 6,746 MB reserved and
  took 268.85 s to its answer vs 89.3 ms per one-row request (`d-summary.md`); the T3 packed run was cut at 590 s. Neither changes the verdict
  (D-r12: the headline is one row per request) — the finding for the record is "one row (or a few) per forward pass on this GPU class". The
  paste-in's own "T2 + T3 on CPU as a note" runs (one row per request). **One product-shaped NOTE on GPU** (state = the row's own text, a short
  generic instruction, the same criteria — T3 first, T2 if cheap) is run so the report can say whether the FAIL depends on D1's framing; it
  never replaces the headline. Then step (e).
- **D-r16 (orchestrator, 09:44) — the request shape the product sends (D3 report §10 item 1).** D3's product-shaped note moved Mapika's T3 by
  5 / 40 (`D3-mapika-report.md` §8), and the hosted 40 / 40 rows — on which D2 §15.1's `calibrated: true` rests — were measured ONLY in D1's
  framing (`state` = a fixed task rule; one self-contained question per row with the evidence inside `instructions`; D1's criteria —
  `K1\hosted-run.cjs:50-57`). So: (a) **the `system-one` adapter is a transport** — it sends the caller's `state` + keyed `questions` unchanged
  (the only rewrite is OpenRouter's required `noul` criteria, D2 §5.1); no reframing inside the engine. (b) **The two built-in gate nodes frame
  their requests in D1's measured shape:** `check_matches_request` sends `state` = D1's T3 rule verbatim ("You check a video editor's
  assistant's work. Answer yes only if the item really does what the request or script line asks, by plain meaning; a loosely related or
  merely similar item is NOT a match.") and ONE `noul` question whose `instructions` carry the item and the request the way D1's T3 rows do
  (`t3-verify.json` `question`), with D1's T3 criteria; `route_request` sends `state` = a routing rule (an optional `rule` config — default: a
  generic rule naming the caller's options; D1's T2 rule is passed verbatim in the benchmark) and ONE `choice` question "Which ONE … must act
  on this request? Request: <JSON>" with the caller's options as criteria, as D1's T2. (c) **The benchmark's unit tests (D4 (d) / (e)) assert
  that the built-ins, fed D1's T3 rows / D1's T2 rule + families, produce request bodies EQUAL to D1's** (state + the question text + criteria);
  §15.1's gated live test sends D1's fixtures through the product adapter in that same shape. (d) The generic `decide` tool sends what its
  caller frames (`calibrated` only when the caller sets `family`, D2 §15.1 as accepted). (e) **Whether the hosted rows hold in a product shape
  (state = the evidence) is NOT measured — an open question for Hasan at the stop**, with D3's CPU-default fact (D3 §10 item 2: 2.6–3.9 s per
  request and ~8.1 GB RSS for a 2B decider on CPU — D2 §5.3's "CPU by default" needs his reading before any later local candidate). Not a
  different design (D2 §10.2 already says the built-ins are `decide` with a fixed instruction, "T3's exact question family").
- **D-r17 (orchestrator, 10:02) — D4 builder #1's four contract decisions, accepted (they shape how §15 is read — the verifier gets this
  ruling with §15).** (1) **The second hosted rung's id is `openrouter-decisions` everywhere** (the preset id of D2 §4 / §8 / §10.1); D2 §3's and
  §15.1's `openrouter` in the provider-id union and the calibration rows name the same rung. The AI-usage row's `provider` column stays the KEY's
  registry id (`typesafe` / `openrouter`, D2 §9). `'openai'` is removed from the id union (E-e); `'local'` stays (no adapter in this slice).
  (2) `family?: 'routing' | 'verify' | 'other'` lives on `DecisionRequest` (D2 §15.1: "set by the caller"); absent = `other` = never calibrated.
  (3) A new error code `invalid-request` for a malformed request; `unsupported` keeps D2 §3's meaning (over every adapter's limits).
  (4) **The calibration table has six rows, not four:** D2 §15.1's four + (openrouter-decisions, `microsoft/microsoft-decision-1-20261009`,
  routing | verify) — OpenRouter served that snapshot in all 19 of D1's MSD1 bodies, `DecisionResult.model` is "as served" (§3), so it IS the
  measured model; any other snapshot stays false (drift is never calibrated). §15.1's "exactly" is read as "exactly the measured
  (provider, model, family) triples". Also accepted: `src/decision-engine/**/*` added to `tsconfig.node.json`'s `include` (the library-search
  precedent `62685e9`), so tsc checks the engine before main imports it.
- **D-r18 (orchestrator, 10:19) — D4 builder #2's six decisions, accepted; the one that shapes §15: `band` reads the TOP PROBABILITY, never
  System One's `confidence`.** D1's recorded bodies carry a `confidence` that differs from the top probability (by up to 0.10 on Jev, 0.094 on
  MSD1), and D1's scorer acts on the top probability (`K1\measures.cjs:18,25-26`: choice → `p_top` = the renormalised `probabilities[choice]`;
  noul → `max(p, 1 − p)` with the answer `p ≥ 0.5`). So: (1) `DecisionAnswer.confidence` is the provider's own value passed through (D2 §5.1
  "unchanged"; the top probability only when a provider sends none) — D2 §3's "confidence = the top answer's probability" does not hold for
  System One and is NOT what any gate reads; **the `decide` tool / node and the built-ins compute `band = act` iff the top probability (choice:
  `probabilities[choice]`; noul: `max(p, 1 − p)`) ≥ `threshold` AND `calibrated`** — the quantity D1 calibrated. (2) A cache hit reports usage
  0 / 0 and logs nothing (D2 §9). (3) Per-HTTP-call usage leaves the engine through `setUsageListener` (one event per call, naming the rung);
  main's `decision-usage.ts` maps the rung to the key's registry id (`typesafe` / `openrouter`) and must not double-log an `llm` call the text
  engine already logs. (4) The LLM fallback's strict parse (noul = a JSON boolean, score = a level's text). (5) `scrub.ts` +
  `providers/system-one-answers.ts` beside D2 §4's table (the ≤ ~300-line rule). (6) A failed rung's `skipped` entry reads `provider error —
  <scrubbed message>`; `skipped` is omitted when empty.
- **D-r19 (orchestrator, 10:36) — D4 builder #3's (c1) decisions, accepted; the TypeSafe key test rides `decisions:decide` in a TEST MODE.**
  The app's image / video key tests send the TYPED draft key over IPC (`useProviderKeyDrafts.ts:68-72` → `imageProviderTest` /
  `videoProviderTest`); D2 §15.2 requires that no key crosses the decisions IPC and that the preload exposes exactly the four `decisions:*`
  functions. So the TypeSafe row's test = `decisions:decide` with `{ test: 'jev' }`: the renderer sends ONLY the rung id — no key, no state, no
  questions; main's `DecisionRuntime.testKey()` (`decision-runtime.ts:122-130`) builds its own tiny `noul` with a fresh state, pinned to `jev`,
  `featureSource: 'decision-test'`, and tests the SAVED key. Conditions for (c2) / (f): (1) in test mode main ignores any other field the
  renderer sends; (2) D2 §12's dev-preview gate applies to the free-form `decide` (the developer tester), NOT to this fixed test (it is the
  user-facing key test D2 §8 designs); (3) the row's Test button is disabled until a TypeSafe key is SAVED (its tooltip says so) — a typed,
  unsaved key is never sent. Also accepted: (a) the `llm` rung's usage row is written once, by `decision-usage.ts`, as provider `llm` with output
  tokens 0 (the text engine writes no row; the served text-provider id / output tokens are a NOTE for later, not reopened); (b) a removed key
  UNREGISTERS its rung (image-init never does; §15.3 2 needs the flip back); (c) the status keys rungs at the top level (`status.jev.hasKey`,
  `local: { state: 'none' }`, `llm.available` = a text provider is active); (d) lazy start — nothing at app startup; (e) the status `why` order
  off → no key → switched off → not registered.
- **D-r20 (orchestrator, 10:48) — D4 builder #4's (c2) decisions, accepted.** (1) A free-form `decisions:decide` from the renderer must carry
  `featureSource` `decision-test` (the developer tester) or `decision-flow` (the canvas preview) — D2 §12's only two renderer callers — else
  `invalid-request` with no call; main-side callers (the tool / node, part (d)) call the runtime directly with their own `featureSource`. **The
  verifier's §15.3 1 stub run over IPC therefore sends `featureSource: 'decision-test'`** (the D5 brief says so). (2) A failed first-use start
  answers a typed error instead of rejecting (the handler rule over library search's precedent). (3) The preload rebuilds the decide envelope
  from `test` or `request` only (`src/preload/api/decisions.ts:13-15`). (4) A key save succeeds even when the decisions re-registration fails
  (a fixed warning, no message text logged). (5) Handler errors pass a second scrub (`Bearer …`, `sk-…`). For (f): the TypeSafe Test button
  calls `decisionsDecide({ test: 'jev' })`, disabled until a key is saved; the free-form tester sits behind the dev-preview flag.
- **D-r21 (orchestrator, 10:48) — a dev-only stub hook so §15.3 1 / 3 / 4 / 5 can run without a real key.** The presets' base URLs are fixed
  (`src/decision-engine/presets.ts:12,22`) and nothing lets a builder or the verifier point them at the stub server §15.3 names. Part (e)
  adds, in main's wiring (`decision-init.ts`, injected so it is unit-testable): `VIDTSX_DECISIONS_JEV_URL` and `VIDTSX_DECISIONS_OPENROUTER_URL`
  replace the matching preset's `baseURL` **only when the app is NOT packaged AND the URL is `http://127.0.0.1:<port>/…` or
  `http://localhost:<port>/…`**; otherwise ignored with one warning; one log line per rung when in use ("decisions: dev stub URL in use for
  jev" — the URL host:port only). The key still comes from the credential store (a FAKE key saved through the Providers row in a test
  profile); the stub never logs request headers. Two variables (not one) so §15.3 5 can tell the OpenRouter-shaped call from Jev's. Tests:
  packaged → ignored; non-loopback → ignored; unpackaged + loopback → used; unset → the preset URL.
- **D-r22 (orchestrator, 11:20) — D4 builder #5's (d) decisions, accepted (two shape how §15 is read — the verifier gets this ruling).**
  (1) **The no-claim test matches its words as WHOLE words** (case-insensitive) plus `%` anywhere and no digit in the agent text: D2 §10.1
  MANDATES "Decision: uncertain — top answer billing (escalate)", which contains the substring `certain` that §15.1 forbids — a substring
  reading would make D2 contradict itself; the word `certain` (and `sure`, `match`, …) never appears as a word. (2) **`p` is a third OUTPUT
  PORT** — the flow runner writes only port values into `run.json`, so it is the only way `p` reaches the run record without changing the
  runner; the canvas previews `outputs[0]` = `band`. Its handle is drawn on the canvas labelled "p (run record)" (a value never shown); part
  (f) hides that handle IF the node renderer supports a record-only port with a small change (≤ ~20 lines), otherwise the label stays and it is
  a note. (3) `p` = the TOP answer's probability (choice `probabilities[choice]`; noul `max(p, 1 − p)`), not P(true) — D-r18. (4)
  **`allowUncalibrated` lifts ONLY the calibration term; the threshold still applies** (`decide-outcome.ts:38-41`) — D2 §10.1's "then band =
  act with note 'uncalibrated'" is read inside its own first sentence ("act iff the top probability ≥ threshold AND calibrated"); acting on an
  uncalibrated 0.4 would defeat the gate. (5) A `refused` answer → `escalate` with no answer and no `p`; an engine error → `isError` + one fixed
  sentence per code (`decide-outcome.ts:51-60`), which fails the node in a flow. (6) `route_request.subject` (default "tool family" = D1's
  measured wording); (7) `check_matches_request.itemKind` (item / template / caption / clip → D1's header); (8) the nodes are not marked
  priced (< $0.0001 a call) and need no capability. **For D5's §15.3 3:** the two-node flow wires both required inputs (`item`, `request`) of
  `check_matches_request`.
- **D-r23 (orchestrator, 11:43) — D4 builder #6's (e) decisions, accepted (1 and 7 shape how §15.1's live bar and §15.3 5 are read — the
  verifier gets this ruling).** (1) **The live bar's latency terms with one request per task:** "p95 per 40-question request" = each request's
  own time; Jev T2 and T3 each ≤ 2,000 ms; **MSD1's "first call excluded" = its T2 request** (sent first, as D1's cold 2,983 ms call was) → MSD1
  T3 ≤ 4,000 ms; no warm-up request (it would break the 4-request cap). (2) Latency = the wall time of the product's `engine.decide` call (engine
  overhead included — stricter than the bare HTTP round trip). (3) A hard 4-request cap inside the live test (the adapter's one 429 / 5xx retry
  could otherwise make a fifth). (4) The live requests use the built-ins' own framing functions, packed 40 per request; the dry run pins both
  bodies equal to D1's dry-run bodies (D-r16 (c)). (5) No duplicate calibration-table test (part (a)'s pins D-r17's six rows). (6) The stub URLs
  are resolved once, at the first decisions use → **the D-r21 variables must be in the app's launch environment**. (7) **`noulCriteriaRequired`
  on `DecisionProviderConfig`** (+6 lines in part (b)'s engine): the adapter detects OpenRouter by host, so a loopback stub URL would drop
  OpenRouter's required noul criteria; main sets the flag only for a STUBBED `openrouter-decisions` rung, so §15.3 5's stub sees the real
  OpenRouter shape; real URLs behave as before. **The verifier runs the live test with** `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/decisions/D4/live-test.sh`
  (read by the orchestrator 11:41: it sources the two `.env` files exactly as `hosted-live.sh` does, echoes nothing, `exec`s vitest on
  `src/main/services/decisions/benchmark/live.test.ts` with `VIDTSX_DECISIONS_LIVE=1`; ≤ 4 requests; result JSON of numbers under
  `…\vidtsx-e2e\decisions\D5\`).

## Stops (session 2)

(one line per stop: what was reported, what Hasan said)

- 2026-10-31 17:03 · **PAUSE — the session ended mid-D4 (not a protocol stop).** The Claude Code process exited while D4 builder #7 (part (f))
  ran; it never handed back. State found at 17:02: D3 DONE (verdict FAIL — the local rung stays empty); **D4 (a)–(e) DONE and committed**
  (`c7ad6da` `ed79420` `b7b1648` `d9ec730` `feb5e69` `5605c48`; last commit `0fd72c6`); part (f) = builder #7's UNCOMMITTED, UNVERIFIED files
  (written 11:47–11:49: modified `CustomNode.tsx`, `decide-outcome.ts`, `decide-run.ts`, `src/shared/types/flows.ts`; new
  `src/features/ai-models/services/decision-providers{,.test}.ts`, `src/features/flows/services/port-visibility{,.test}.ts`,
  `src/main/services/agents/tools/decide-shared-pins.test.ts`, `src/shared/decisions-{outcome,tester-form,view}.ts` + two tests) — no build, no
  `decisions-D4` profile, no logs; left in the tree for session 3's first builder to judge (the orchestrator commits no code). (g) not built
  (D3); (h) and D5 not started. Caps used: hosted 0 / 60, keyless 0 / 10. **Hasan's dev app is RUNNING at 17:02** (`electron .` from the main
  checkout on his `%APPDATA%\VidTSX Studio` profile; Vite on 5173) — never touch it. **Hasan said (17:02):** "ok, lets continue in a new
  sesssion, give me a prompt" → `docs/studio/decisions/NEXT-SESSION-3.md` (the session-3 paste-in: finish (f) → (h) → D5 → STOP; E-a … E-h
  still binding; rulings D-r12 … D-r23 in force); `NEXT-SESSION-2.md` marked SPENT.

## Log (session 2)

- 08:48 · start checks: main checkout's uncommitted work still there (14 ` M` + 6 `??`, `end-to-end-p0` @ `5d77600`); Hasan's dev app NOT
  running (0 `electron.exe`); worktree HEAD `b2b8a02`, clean. Resources: C: 29.5 GB, commit headroom 48.0 GB → the guard holds (≥ 3 GB /
  ≥ 6 GB).
- 08:49 · D3 inputs present: `D:\repos\ai-video-lab\tools\deciders\models\Mapika\decider-2b\` (`model.safetensors` 3,763,692,048 B, `README.md`,
  `decider_config.json`, `decider/`, `eval_results.json`), `tools\deciders\README.md` (67 lines), the experiment's `LOG.md` (321 lines); system
  Python 3.13 at `C:\Python313\python.exe` (and 3.14); `nvidia-smi` sees the RTX A3000 (6,144 MiB). pip's HTTP cache exists (a torch wheel
  from 2026-10-05 may be in it — for the builder to check).
- 08:50 · the tsc baseline at `b2b8a02` (orchestrator background check, before any D3 timing run; logs `B4\tsc-{web,node}-b2b8a02.log`):
  **web 25 / node 10** (rc 2 each, finished 08:50:45) = the brief's baseline at `efa5e0b` — D4's gate is ≤ 25 / ≤ 10.
- 08:52 · ruling D-r12 (D3's framing); this section + `D3/HANDOFF.md` + `D3/LOG.md` written (commit `bb2f921`, 08:52:03).
- 08:53 · D3 builder #1 spawned (HEAD `bb2f921`; steps (a) facts + (b) the venv and a one-question GPU smoke; (c) only if budget allows).
  Meanwhile the orchestrator drafted `D4/HANDOFF.md` + `D4/LOG.md` (no code read beyond directory listings and the LS-r1 rulings).
- 09:08 · D3 builder #1 HANDOFF (~58 calls incl. the installs, ~16 min; docs `b5a3d3e` `17b3348`): **(a)** `K3\reports\a-facts.md` + `raw-hub\` — the
  local weights = Hub tag **v11** (sha256 equal, config byte-identical); Hub `main` = v12 (2026-10-20, noul T 0.05); **GGUF / ONNX DO exist**
  (`Mapika/decider-2b-GGUF`: v12 BF16 3,775,708,704 B, Q8_0 2,012,012,064 B, Q4_K_M 1,274,396,192 B; community exports) — contradicts the paste-in's
  "likely not"; decider-ai 1.10.0 declares `flash-linear-attention`; the card facts agree with the paste-in (Apache-2.0, Qwen3.5-2B-Base, en,
  temperatures choice 1.164 / noul 1.624 / score 1.124, 255 options, 32,768 state tokens); `system_one` takes many questions per call; family:
  0.8b 1,504,827,608 B, 2b-vision 4,426,558,864 B, 4b 8,411,558,400 B. **(b)** venv `B3\py-scratch\mapika-venv` 3,417,428,997 B (Python 3.13.2,
  torch 2.14.1+cu130 — the 1,990.6 MB wheel from pip's cache, ≈ 1.8 MB new over the network; decider-ai 1.10.0, transformers 5.22.1; no Triton →
  the reference attention path, as in the experiment); **CUDA works**; one-question smoke run 2 (CPU 6 % / 13 %): load 11.100 s, process start →
  first answer 15.896 s, warm 34.5–37.2 ms per request, RSS 900.1 after load / 1,668.1 end / **peak 4,483.9 MB**, private 6,651.1 MB, VRAM max
  allocated 3,625.7 MB; run 1 under Defender (93 %) repeated, answers identical.
- 09:09–09:12 · **Orchestrator re-check:** HEAD `17b3348`, `b2b8a02..HEAD -- src scripts package*.json` empty, only D3's HANDOFF / LOG changed;
  K3 holds `reports\{a-facts.md,b-venv.md,b-pip-freeze.txt,b-smoke-gpu-run1.json,b-smoke-gpu-run2.json,raw-hub\}`, `scripts\{b-smoke.py,
  hub-facts.py,load-snapshot.ps1}`; `b-smoke-gpu-run2.json` read — every number above is in it; a-facts §1 / §4 / §5 read; 0 python processes.
  → rulings **D-r13** (peak RSS; RSS-only fail → no (g) this session) and **D-r14** (v11 only). D3 builder #2 (step (c) the worker + host, then
  (d)) to spawn. (Commit `e8fdfbc` landed 09:10:19; the rulings' "09:12" stamps and this entry's "09:12" were estimates.)
- 09:11 · D3 builder #2 spawned (HEAD `e8fdfbc`; step (c) worker + host, then (d) the runs; (e) only with budget to spare).
- 09:29 · D3 builder #2 HANDOFF (~47 calls, ~19 min; docs `15b00d8` `048c8a7`): **(c)** `K3\mapika_worker.py` (loads once via the unmodified
  `Decider`; JSONL `hello` / `ready` / `result` / `exit` / `fatal`; ops `system_one` / `ping` / `stats` / `shutdown`; fd 1 → stderr so stdout is
  protocol only; exits on EOF / `shutdown` / `--idle-s`) + `K3\mapika-host.cjs` (spawn once, `TORCHDYNAMO_DISABLE=1` + `HF_HUB_OFFLINE=1`, ids,
  timeouts, Node → Python → Node timing) + `K3\d1-questions.cjs` (D1's texts, verbatim from `K1\hosted-run.cjs:35-82`); smoke 3 / 3 T2 rows
  (`c-host-smoke-cuda.json`). **(d) GPU headline, one row per request (`K3\reports\d-summary.md`):** T2 95.0 % (38 / 40), Brier 0.053, ECE 0.061,
  off-list 0, warm p50 / p95 89.3 / 92.5 ms, Arabic 90.0 %; **T3 82.5 % (33 / 40), Brier 0.122**, ECE 0.148, warm 54.7 / 227.2 ms, Arabic 85.7 %;
  T1 choice NOTE 73.3 %, D-r2 τ 0.5 R@1 47.1 % / wrong-confident 5.8 %, τ 0.9 no picks; spawn → first answer 14.27–16.11 s; peak RSS ≈ 4,483 MB
  on every run, steady 1,673.9–1,737.8 MB, peak private 6,702.6–7,521.8 MB, VRAM max allocated 3,647.5–3,988.8 MB; CPU ≤ 30 % in every sample (no
  repeat needed). T2 packed: 95.0 %, Brier 0.052, but 6,185 MB VRAM and 268.85 s; T3 packed cut at 590 s; T1 packed not started.
- 09:30–09:33 · **Orchestrator re-check:** HEAD `048c8a7`, `e8fdfbc..HEAD -- src scripts package*.json` empty, only D3 HANDOFF / LOG changed; 0
  python processes; `d-summary.md` read in full; **D1's `score.cjs` re-run by the orchestrator on the two headline answer files (outputs in the
  session scratchpad, K1 untouched) → T2 ALL 95.0 % / Brier 0.053 / ECE 0.061 / off-list 0; T3 ALL 82.5 % / Brier 0.122 / ECE 0.148 — equal to
  the builder's.** On these numbers D3 FAILS several terms of its bar (T3 accuracy and Brier, T2 Brier, peak RSS) — not RSS alone → per the
  paste-in's (e) the local rung stays empty (a note, no STOP: the runtime runs on this laptop and D2 already designs an empty rung); the
  verdict is written by the (e) builder from the files. → ruling **D-r15**. D3 builder #3 (CPU note, product-shaped note, then (e)) to spawn.
  (Commit `7a7e8eb` landed 09:30:51; the "09:33" stamps on D-r15, the HANDOFF box and this entry were estimates — from here on every stamp is
  read from `date` first.)
- 09:31 · D3 builder #3 spawned (HEAD `7a7e8eb`; the CPU note + one product-shaped GPU note, then (e) the report).
- 09:43 · D3 builder #3 DONE (~53 calls, ~12 min; docs `2082918` — the report, HANDOFF DONE, LOG): CPU note (eager fp32, 8 threads) T2 38 / 40
  Brier 0.050 (0.0503) p95 4,043.3 ms, T3 33 / 40 Brier 0.124 p95 3,295.8 ms, peak RSS ≈ 8,121–8,126 MB; product-shaped GPU note T3 38 / 40
  Brier 0.054 p95 424.7 ms, T2 37 / 40 Brier 0.058 p95 69.2 ms (`d-summary.md`); **`docs/studio/decisions/D3-mapika-report.md` (264 lines):
  bar 3 PASS / 4 FAIL (T3 accuracy, T2 + T3 Brier, peak RSS) → FAIL, the local rung stays empty, not RSS-only, D4 (g) not built, no STOP**;
  §8 the T3 accuracy fail depends on D1's framing but no framing passes every term; §9 how a later rung would ship (the app's `pytorch` runtime
  = Python 3.11.15 + torch 2.14.0+cu126 / +cpu; `decider-ai`, `flash-linear-attention`, `fla-core` absent from `requirements.cu126.lock` → a
  new runtime build; transformers 5.16.1 vs the checkpoint's 5.17.0 untested; v11 download 3,783,693,401 B, sha256s listed; one row per forward
  pass on a 6 GB card; ~6.7 GB private commit). Two questions for the orchestrator (framing for the hosted adapters; CPU as the default).
- 09:43–09:44 · **Orchestrator re-check:** HEAD `2082918`, `7a7e8eb..HEAD -- src scripts package*.json` empty, only the report + D3 HANDOFF /
  LOG changed; 0 python processes; `d-summary.md` rows for the four new runs read (the numbers above are in it); the report's §6–§10 read —
  the bar table = the score files the orchestrator re-ran at 09:30 (T2 95.0 % / 0.053, T3 82.5 % / 0.122) and `d-summary.md`'s RSS / p95;
  §9's runtime facts cite file:line. **D3 → DONE (verdict FAIL — the local rung stays empty).** → ruling **D-r16** (the request shape:
  transport adapter; the built-ins send D1's measured shape; the product-shape question + the CPU default go to Hasan). D4 starts: HANDOFF
  updated ((g) dropped; D-r16 in (b) / (d) / (e)); D4 builder #1 (part (a)) to spawn. (Commit `d190e27` landed 09:45:28.)
- 09:46 · D4 builder #1 spawned (HEAD `d190e27`; part (a) — the contract types + validate / ladder / calibration-table / cache, red first).
- 10:00 · D4 builder #1 HANDOFF (~44 calls, ~15 min; code `c7ad6da`, docs `80ca732`): **part (a) DONE** — `src/shared/types/decisions.ts` (imports only
  `./ai-usage`), `src/decision-engine/{types,validate,ladder,calibration-table,cache}.ts` + four test files (red first: 4 files "Cannot find
  module"; green 4 / 66); `tsconfig.node.json` include += `src/decision-engine/**/*`; tsc 25 / 10; largest file 213 lines; cache hash via
  WebCrypto (injectable, no Node import). Part (b) started red: `decision-engine.test.ts` + `presets.test.ts` UNTRACKED on purpose (committing
  them would put tsc node above 10). Four decisions for the orchestrator (→ D-r17).
- 10:01–10:02 · **Orchestrator re-check:** HEAD `80ca732`; `d190e27..HEAD` = the 11 decision files + `tsconfig.node.json` + D4 HANDOFF / LOG;
  vitest on the four (a) files → **4 passed / 66 passed**; tsc web 25 / node 16 with the two untracked red tests, **node 10 without them** (all 6
  extra errors are in those two files) → HEAD is at the baseline; `calibration-table.ts` read (36 lines; six rows as described). → ruling
  **D-r17**. D4 builder #2 (part (b)) to spawn. (Commit `649c42b`, 10:02:52.)
- 10:03 · D4 builder #2 spawned (HEAD `649c42b`; part (b) — presets, the engine class, the System One transport tested on D1's recorded
  bodies (scrubbed fixtures + key scan), the LLM fallback).
- 10:16 · D4 builder #2 HANDOFF (~60 calls, ~14 min; code `ed79420`, docs `47abe16`): **part (b) DONE** — `decision-engine.ts` (265 lines; validate →
  ladder → per-rung cache → provider → `calibrated` from the SERVED model + family; `provider-error` falls through once; budget race, default
  15 s; `setUsageListener`), `presets.ts` (both $0.042 / M input), `index.ts`, `providers/system-one-provider.ts` (D-r16 transport; OpenRouter
  noul criteria fill; retry once on 429 / 5xx / network; split > 400 questions or 64k tokens; `usage.cost` else tokens × price),
  `providers/system-one-answers.ts`, `providers/llm-fallback-provider.ts`, `scrub.ts`; fixtures 39 KB (T2 + T3 only: `d1-scored-t2-t3.json`,
  `system-one-recorded-bodies.json`, `system-one-dry-run-slice.json`); red 5 failed (missing modules) → green 9 / 115; the 4 recorded bodies × 40
  rows map to D1's scored probabilities / p / tokens to 4 dp; the request body equals D1's dry-run body for both presets. Six decisions (→ D-r18).
- 10:17–10:19 · **Orchestrator re-check:** HEAD `47abe16`; `649c42b..HEAD` = 16 engine files + D4 HANDOFF / LOG; vitest `src/decision-engine` → **9 /
  115 passed**; tsc **web 25 / node 10**, 0 errors in a decision file; largest source file 265 lines; no `any` / default export; the engine imports
  only `vitest`, its own files and `../shared/types/decisions`; **key scan over the three fixtures** (`sk-…`, `sk-or-…`, `Bearer …`, `api_key`,
  `authorization`, `TYPESAFE`, `OPENROUTER_`, `secret`, any 32+ char token) → nothing; `measures.cjs:18,25-26` read (the scorer acts on the top
  probability) → ruling **D-r18**. D4 builder #3 (part (c), main's wiring) to spawn. (Commit `be4ced8`, 10:19:21.)
- 10:20 · D4 builder #3 spawned (HEAD `be4ced8`; part (c) — `src/main/services/decisions/`, the `typesafe` registry entry + `'decision'`
  capability, IPC §12 + preload + status + the preload-surface test; a green sub-checkpoint + hand-off allowed).
- 10:33 · D4 builder #3 HANDOFF (~66 calls, ~14 min; code `b7b1648`, docs `832d42e`): **(c1)** — `src/main/services/decisions/{decision-init (54),
  decision-usage (50), decision-settings (71), decision-runtime (226)}.ts` + tests; `src/shared/ipc/types/decisions.ts` (70; status keyed by rung,
  has-key booleans only); registry `typesafe` (['decision'], "TypeSafe API key", `test: 'decision'`), `openrouter` += 'decision', `ProviderCapability`
  / `ProviderTestKind` += 'decision', label `decision: 'Decisions'`; `AiFeatureSource` += the four `decision-*`, `AiRequestType` += 'decision'; red 5
  failed → green 5 / 32; related suites 100 / 101 files (the one red = the known worktree-only `builder-libraries` resolution suite, DRIVING:186);
  tsc 25 / 10. Six decisions (→ D-r19). (c2) next: channels, handlers, lazily-registered registration, `src/preload/api/decisions.ts`,
  `electron.d.ts`, the key-save hook, the preload-surface + handlers tests.
- 10:34–10:36 · **Orchestrator re-check:** HEAD `832d42e`; `be4ced8..HEAD` = 12 code paths + D4 HANDOFF / LOG; vitest `src/main/services/decisions` +
  `registry.test.ts` + `src/decision-engine` → **147 passed**; tsc **web 25 / node 10**, 0 errors in a decision / registry / ai-usage file; the
  existing key tests read (`ProviderKeysTable.tsx:61-63`, `useProviderKeyDrafts.ts:68-72` send the typed key) and `decision-runtime.ts:122-130`
  (main builds the test request) → ruling **D-r19**. D4 builder #4 ((c2)) to spawn. (Commit `96e7392`, 10:36:11.)
- 10:37 · D4 builder #4 spawned (HEAD `96e7392`; (c2) — channels, handlers, registration, preload, `electron.d.ts`, the key-save hook, the
  preload-surface + handlers tests; then part (c) DONE).
- 10:45 · D4 builder #4 HANDOFF (~60 calls, ~10 min; code `d9ec730`, docs `2adb1e0` `1ede633`): **(c2) → part (c) DONE** — `src/main/ipc/decisions-handlers.ts`
  (110), `registrations/decisions.ts` (31, `lazily`), `src/preload/api/decisions.ts` (29) + four test files (red 4 → green 4 / 41); channels.ts
  654 → 660, electron.d.ts 656 → 661, register.ts 101 → 103, preload.ts 108 → 110, provider-keys-handlers.ts 83 → 91 (`await decisionsKeysChanged()`
  in its own try / catch); related suites 117 / 118 files (the one red = `builder-libraries`, DRIVING:186); tsc 25 / 10. Five decisions (→ D-r20).
- 10:46–10:48 · **Orchestrator re-check:** HEAD `1ede633`; vitest over the four new files + `src/main/services/decisions` + `src/decision-engine` +
  `src/shared/providers` → **188 passed**; tsc **web 25 / node 10**; `src/preload/api/decisions.ts` read (four functions; the envelope rebuild);
  **found: no way to point the presets at §15.3's stub server** (`presets.ts:12,22` fixed URLs) → rulings **D-r20** and **D-r21** (the dev-only
  stub hook, built in part (e)). D4 builder #5 (part (d)) to spawn. (Commit `dca7023`, 10:48:17.)
- 10:49 · D4 builder #5 spawned (HEAD `dca7023`; part (d) — `decide` tool / node + `check_matches_request` + `route_request`, D-r16 body equality
  over every T2 / T3 row, D-r18 band, the no-claim test; T2 / T3 fixtures to `src/main/services/decisions/benchmark/fixtures/`).
- 11:12 · D4 builder #5 HANDOFF (~99 calls, ~30 min — over budget; code `feb5e69`, docs `28f6d7f`): **part (d) DONE** — `agents/tools/{decide,
  check-matches-request,route-request,decide-run,decide-outcome}.ts` (longest 140 lines), registered in `registry.ts` + appended to
  `src/shared/agents/tool-ids.ts` (`STUDIO_TOOL_IDS` untouched); fixtures `benchmark/fixtures/{t2-routing,t3-verify}.json` (byte copies of D1's) +
  `d1-dry-run-t2-t3.json` (key scan empty); red 4 files / 5 tests → green 4 / 38 (`decide`, `decide-builtins`, `decide-no-claim`, `registry`): the
  built-ins' HTTP bodies through the real engine + System One adapter (fake fetch, fake key) EQUAL D1's dry-run state + question + criteria on all
  40 T2 + 40 T3 rows; band both ways + uncalibrated; no-claim over every row, both bands, every error text; featureSource agent / flow; ports via
  the flow runner's `mapOutputs`; related suites 49 / 365; tsc 25 / 10. Nine decisions (→ D-r22).
- 11:18–11:23 · **Orchestrator re-check:** HEAD `28f6d7f`; the four test files → **38 passed** (23 s — the registry import graph); tsc **web 25 /
  node 10** (finished in the background at ~11:23); `decide-outcome.ts` read in full (band = D-r18; texts = D2 §10.1; error sentences
  number-free) → ruling **D-r22**. D4 builder #6 (part (e) + the D-r21 stub hook) to spawn. (Commit `48a5944`, 11:23:50.)
- 11:24 · D4 builder #6 spawned (HEAD `48a5944`; part (e) — benchmark fixtures + scorer + the replay test = `c-hosted.md` §2, the gated live test
  (not run) + the kit launcher `.vidtsx-temp\decisions\D4\live-test.sh` (not executed), the D-r21 stub hook).
- 11:39 · D4 builder #6 HANDOFF (~70 calls, ~16 min; code `5605c48`, docs `ea4b236`): **part (e) DONE** — `benchmark/fixtures/hosted-{jev,openrouter-msd1}-
  t{2-choice,3-noul}.json` (scrubbed; key scan exit 1 = nothing), `benchmark/{types,measures,score,live-requests,live-run,live-bar}.ts`, tests
  `score.test.ts` (the replay), `measures.test.ts`, `live-dry-run.test.ts`, `live.test.ts` (gated), `decision-init-stub.test.ts`; `decision-init.ts`
  `resolveDecisionStubURLs`; `noulCriteriaRequired` (+6 lines in the engine); red 5 files / 11 tests → green 4 + 1 skipped files, 38 + 2 skipped tests;
  related suites 86 + 1 skipped files / 703 + 2 skipped tests; tsc 25 / 10; the kit launcher `D4\live-test.sh` (`bash -n` OK, its env block = `hosted-live.sh`
  :4-11, not executed). Seven decisions (→ D-r23).
- 11:41–11:43 · **Orchestrator re-check:** HEAD `ea4b236`; `c-hosted.md` §2 read — **the replay table equals it on all four T2 / T3 rows** (accuracy,
  Arabic, Brier with multiclass, ECE, selective ≥ 0.5 / 0.7 / 0.9 with coverage, off-list); `live-test.sh` read (no value, nothing echoed); key
  scan over `benchmark/fixtures/` → nothing; vitest `src/main/services/decisions` + `src/decision-engine` → **17 passed + 1 skipped files, 179
  passed + 2 skipped tests** (the 2 = the gated live cases); tsc **web 25 / node 10** → ruling **D-r23**. D4 builder #7 (part (f), the UI) to spawn.
  (Commit `0fd72c6`, 11:42:34.)
- 11:43 · D4 builder #7 spawned (HEAD `0fd72c6`; part (f) — the Settings row, the Providers "Decisions" section + the TypeSafe test button (saved key
  only), the dev-preview tester, D-r22 (2)'s `p` handle, then a build + CDP screenshots on profile `decisions-D4`, CDP 9302, no key saved).
- ~11:50 · **the session's process exited while D4 builder #7 ran** (no hand-back; its files are stamped 11:47–11:49, nothing later).
- 17:02 · **orchestrator check after the pause:** HEAD `0fd72c6`, no commit since; `git status` = this file + builder #7's 4 modified / 10 new code
  files (listed in Stops); no `out/` rebuild, no `decisions-D4` profile, no D4 log after `tsc-web-e.log` (11:36); 0 instances on 9302 / 9305;
  **Hasan's dev app running** (5 `electron.exe` on `%APPDATA%\VidTSX Studio`, Vite 5173); C: 43.15 GB free. Hasan asked for a new-session prompt →
  `NEXT-SESSION-3.md` written; D4 HANDOFF's status + Next step amended (assess builder #7's leftovers first); docs committed (explicit paths —
  the code leftovers stay uncommitted).

# Session 3 — D4 (f) the UI · D4 (h) the exit check · D5 the verifier (2026-10-31)

> Run brief: Hasan's paste-in in `docs/studio/decisions/NEXT-SESSION-3.md` ("Paste-in"), with that file's "Decisions" block (E-a … E-h) as
> his answers — given 2026-10-31 ~17:11 ("Read … NEXT-SESSION-3.md and run the fenced "Paste-in" block in it as your brief, exactly as
> written, with the "Decisions" block in that file as my answers (E-a…E-h) — it is my instruction for this session. Start with its FIRST
> step."). It follows `docs/studio/END_TO_END_RUN.md`'s loop with the paste-in's overrides (unchanged from session 2). Parts D4 (f) → D4 (h)
> → D5 run in order with NO stop between them unless a STOP rule fires; **the session STOPS after D5** (the verifier's PASS, or three FAILs
> — E-h). Rulings D-r12 … D-r23 (session 2) stay in force; D-r8 (keys only through the launchers) still binds.

- Start state (17:11–17:12): main checkout `end-to-end-p0` @ `5d77600` with the other session's 14 ` M` + 6 `??` files (unchanged; never
  touched); **Hasan's dev app NOT running** (0 `electron.exe`; nothing listening on 5173 / 9222 / 9302 / 9305) — it was running at the
  17:02 pause and has since been closed. Worktree `.vidtsx-temp\decisions\wt` on `decision-models` @ `bfa181f`; `git status` = builder #7's
  4 ` M` (`CustomNode.tsx`, `decide-outcome.ts`, `decide-run.ts`, `src/shared/types/flows.ts`) + 10 `??` (the files listed in Stops
  (session 2)), all still stamped 11:47–11:49 — unchanged since the pause. Resources 17:11: C: 42.99 GB free; memory commit headroom
  63.29 GB (36.41 of 99.70 GB committed); RAM 31.98 GB free → the guard holds (≥ 3 GB / ≥ 6 GB).
- The model is Opus 5.5 → commits end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Caps ledger (E-g, whole run):** hosted **4 / 60** requests, **$0.001298388** / $0.50 (all four = D5's one gated live test, 18:28; D5 ≤ 20 /
  ≤ $0.05 held); keyless claude-subscription **2 / 10** (D4 builder #10's §15.3 4 agent run 17:58; D5's, result file written 18:39:35).
- Folders / ports as session 2: D4 builders CDP **9302**, profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\decisions-D4\profile`
  (not yet created); the verifier CDP **9305**, profile `…\profiles\decisions-D5-verify\profile`; both copied from `profiles\source\profile`
  WITHOUT `settings\settings.db*`. Kits `D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\` and `\D5\`; scratch
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D4\` and `\D5\`.

| Part | Status | Builders spawned | Re-check / verifier | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| D4 (f) — the UI (Settings row, Providers section, dev tester, `p` handle) | **DONE** (step 5 at `3f50e63` / docs `f86221c`) | 2 (#8, #9) | re-check 17:25 → D-r24; 17:54 (stills looked at) | code `cc754fa` `8f6ff6f` `3f50e63` | related 482 tests + 58; tsc 25 / 10; stills `B4\f5-{settings-decisions-row,providers-decisions}.png` | 2026-10-31 17:13 / 17:46 |
| D4 (h) — the exit check | **DONE → D4 DONE** (records `ecb69d8`) | 3 (#9, #10, #11) | re-check 17:54 → D-r26; 18:05 → D-r27; 18:20 → D-r28 | docs `8b24e81` `8f55668` `efb1ee9` `ecb69d8` (no `src/` change after `3f50e63`) | stub §15.3 1–5 PASS (max IPC gap 20.4 ms; flow act / act / escalate, p in run.json; agent "Decision: cut (act)", 416 × 0.042e-6; off → 0 / 0 hits; OpenRouter port with criteria); gate 564 passed / 3 failed = E-d2a (import graph 0 / 0 / 0); tsc 25 / 10; sweep clean | 2026-10-31 17:46 / 18:19 |
| D5 — the verifier (D2 §15) | **DONE — PASS, round 1** (no FAIL round; records `ca4cc81`) | 1 records builder | **PASS** (report `docs/studio/decisions/D5/REPORT.md`, filed by the orchestrator) | verified at `b8e85d0` (`src/` = `3f50e63`) | gated live 2 / 2 PASS: Jev T2 / T3 40 / 40, Brier 0.0199 / 0.0031, 797 / 279 ms; MSD1 40 / 40, 0.0146 / 0.0029, T3 698 ms (T2 2,626 ms excluded); 4 requests $0.001298388; gate 564 / 3 E-d2a (own import-graph proof); tsc 25 / 10; 4 / 4 mutants bite; §15.3 1–5 PASS on its own stub (max gap 19 ms); §15.3 6 DEFERRED-HASAN | 2026-10-31 18:22 / 18:41 |

## Answers in force (session 3 — Hasan, 2026-10-31, the Decisions block of NEXT-SESSION-3.md, verbatim)

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

## Rulings (session 3)

- **D-r24 (orchestrator, 17:25) — D4 builder #8's (f) decisions, accepted (1–3 shape how §15.3 2 and the D5 brief read).** (1) **TypeSafe's
  key row lives in the AI → Providers "Decisions" section** (no longer in "API keys"); OpenRouter keeps its ONE key row in "API keys" and is
  LISTED in Decisions (status + a pointer, no second input) — §15.3 2's "a Decisions section with the TypeSafe row (and OpenRouter listed under
  it too)" reads on this (`DecisionsProvidersSection.tsx`, `decision-providers.ts` `decisionSectionRows`). (2) **The TypeSafe Test button sends
  exactly `{ test: 'jev' }`** (`decision-providers.ts` `runDecisionKeyTest`) and is DISABLED unless a key is SAVED and no typed draft / removal
  is pending (`decisionKeyTestGate`) — D-r19 (3) tightened, not changed; mode `off` makes the test answer `no-provider` (main's `testKey` goes
  through the engine). (3) **The free-form tester sits in Settings › General › Decisions behind a NEW dev-preview flag `decisions-tester`**
  (`feature-flags.ts` `FEATURE_FLAGS` `false` → on under `electron-vite dev`, hidden in a production build, the file's own rule for `false`
  entries) — so the worktree's `electron-vite build` out/ (builders' and the verifier's) does NOT show it; that is D2 §12's gate working, not a
  missing screen. §15.3 1's stub run uses `window.api.decisionsDecide` with `featureSource: 'decision-test'` (D-r20), which needs no tester
  UI. The tester shows probabilities as numbers (3 decimals) — the one place they show (D2 §8). (4) **The `p` handle is hidden on the canvas**
  (`PortDef.recordOnly`, `port-visibility.ts` `drawnPorts`, `CustomNode.tsx`; 16 source lines, within D-r22 (2)'s ≤ ~20); the runner still
  files `p` in `run.json`; an edge wired from `p` has no handle to draw on (React Flow skips it) — a note (no flow wires `p` today). (5) The
  order editor sends the whole new order per click; mode and model are separate patches. Re-check 17:24–17:25: the related suites (`src/shared/
  decisions-*` tests, `src/features/ai-models`, `src/features/flows`, `src/main/services/agents/tools`, the preload-surface + decisions-handlers
  tests, `src/main/services/decisions`, `src/decision-engine`) → **59 passed + 1 skipped files, 482 passed + 2 skipped tests** (the skipped =
  the gated live test) (`B4\orch-f-recheck.log`); tsc **web 25 / node 10** (`B4\tsc-{web,node}-orch-f.log`).
- **D-r25 (orchestrator, 17:27) — how the stub checks of §15.3 3 / 4 / 5 are read (for (h) and the D5 brief).** §15.3 3 was written before
  D-r18: under D-r18 a confident "no" (top probability = 1 − p ≥ 0.9) is `band = act` with answer `no`, so "one true row and one false row →
  act / escalate" cannot hold with real numbers on a false row. So: (1) **the stub serves D1's RECORDED numbers, never a made-up probability** —
  for a `noul` question the Jev-shaped stub answers with the recorded Jev `pTrue` of the T3 row whose text is in the request
  (`src/main/services/decisions/benchmark/fixtures/hosted-jev-t3-noul.json` + `t3-verify.json`), for a `choice` question with the recorded Jev
  `probs` of the T2 row (`hosted-jev-t2-choice.json` + `t2-routing.json`); served `model` = `jev-1.14.0` (so `calibrated` follows the D-r17 table
  and the family); `usage.input_tokens` and no `usage.cost` (Jev's recorded shape — the app then prices tokens × $0.042 / M). The
  OpenRouter-shaped stub serves the same numbers with `model` `microsoft/microsoft-decision-1-20261009` and a `usage.cost` (MSD1's shape). (2)
  **§15.3 3 = THREE flow runs of `input_text` (×2, wired to `item` and `request`) → `check_matches_request`:** `t3-01` (true, recorded 0.96 →
  `act`, answer yes), `t3-09` (false, recorded 0.02 → top 0.98 → `act`, answer no) and `t3-27` (true, recorded 0.88 → top 0.88 < 0.9 →
  `escalate`) — the answer follows the fixture's label, the band follows D-r18 on the recorded number, so both bands appear on recorded data;
  each run's `run.json` holds `p` (= the top probability, D-r22 (3)); the canvas shows the band only (no `p` handle, D-r24 (4)). (3) **§15.3 4's
  "agent run"** is a real agent run in the app (the agent runtime's LLM = the keyless claude-subscription engine — each run counts as ONE of the
  ≤ 10 keyless calls; (h) uses ≤ 3, so D5 keeps room) whose agent can call `decide`, on one T2 row; PASS = the tool's text passes the D-r22 (1)
  whole-word no-claim test and the usage row (`window.api.aiUsageGetLog`) carries `featureSource: 'decision-agent'`, `requestType: 'decision'`,
  `provider: 'typesafe'`, `costUsd` = `inputTokens` × 0.042 / 1,000,000. If the agent's model never calls `decide` in a run, that run counts, it
  is reported, and one more run with a firmer prompt is allowed within the cap. (4) **§15.3 5:** two stub ports, one per D-r21 variable, so the
  stub log names which URL was hit; mode `off` → `decisionsDecide` answers `no-provider` with ZERO new stub hits; then mode `auto` with `jev`
  removed from `decisionsHostedOrder` (a FAKE OpenRouter key saved) → the OpenRouter-shaped port is hit and its body carries the noul criteria
  (`noulCriteriaRequired`, D-r23 (7)). The fake OpenRouter key is saved AFTER check 4 (so it cannot change the agent run's LLM path).
- **D-r26 (orchestrator, 17:54) — D4 builder #9's decisions, accepted (2, 3 and the evidence rule below go into the D5 brief).** (1) The stub
  (`D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D4\stub-server.mjs`) serves D1's raw recorded answer objects matched by the exact T3 question /
  T2 request text, HTTP 422 for an unmatched question — D-r25 (1) as built. (2) **§15.3 2's "a call with the fake key yields `provider-error`
  whose message holds neither the key nor the state" is read on the STUB's 401** (no hosted call with a fake key); the stub's ECHO mode (the
  bearer token + the state's start in its error text) is the strict form — the wire message must come back withheld / redacted. (3) **The
  engine's 15-min in-memory cache (D2 §9) turns a repeated identical request into a cache hit with no HTTP call and no usage row**: a verifier
  that runs §15.3 1 on T3 rows and then §15.3 3 on the same rows restarts the app between them (or uses other rows) — not a defect. (4) The
  stub's `usage.input_tokens` = the engine's own estimate formula per request; §15.3 4's cost term (`costUsd` = `inputTokens` × 0.042 / 1e6) is
  checked on whatever count the stub sends. (5) Every still is looked at (a minimised window can return a STALE frame without hanging). (6)
  **The §15.3 4 evidence rule (orchestrator):** the app does not store a tool's result text (`src/main/services/agents/tool-call-log.ts`
  `ToolCallRecord` = callId / tool / at / args / isError / artifactIds — no result), and `~/.claude` is never read; so "the tool's text passes the
  no-claim test" is evidenced by ALL of: the session's `calls.json` record of the `decide` call (args = the T2 framing, no `isError`); the stub
  hit matched to that T2 row (the served numbers); the tool text the agent quotes word for word; and that quote EQUAL to the text the tree's
  `decisionText` (`decide-outcome.ts` → `src/shared/decisions-outcome.ts`) produces from the served numbers (computed by a small script or test
  in the kit, not in `src/`). The whole-word no-claim test (D-r22 (1)) is applied to the tool text, not to the agent's own prose. Re-check
  17:52–17:54: HEAD `8b24e81`, tree clean, 0 `electron.exe`, nothing on 9302 / 18471 / 18472; `6febcb1..HEAD -- src` = `DecisionsRow.tsx`,
  `decisions-view{,.test}.ts` (+32 / −1); vitest `src/shared/decisions-{view,client,tester-form}.test.ts` + `src/features/ai-models` → **7 / 58
  passed**; tsc **web 25 / node 10** (`B4\tsc-{web,node}-orch-h1.log`); the three stills looked at (`f5-providers-decisions.png`: Decisions
  section with TypeSafe row — Test greyed — + OpenRouter listed; `f5-settings-decisions-row.png`: mode, 1 Jev no key / 2 OpenRouter no key /
  Local none available, OpenRouter model; `h3-flow-canvas.png`: two Text inputs → Check Matches Request showing "escalate", two output
  handles); `h1-concurrency.json` 20 / 20 ok, calibrated, 0 cached, max gap 20.4 ms (2,431 pings in 550 ms), slowest call 549 ms;
  `h3-flow-runs-2.json` act / yes / 0.96, act / no / 0.98, escalate / yes / 0.88, and `p` read straight from two `run.json` files on disk
  (`…\profiles\decisions-D4\profile\flows-runs\01M69AA9S8FS1CNNWXAZ84XW9S\{1dec8639…,caee4cef…}\run.json` → node `n-check` outputs);
  `stub-log.jsonl` 28 lines, 0 hits for `authorization` / `bearer` / the fake key.
- **D-r27 (orchestrator, 18:05) — D4 builder #10's §15.3 4 / 5 decisions, accepted; two notes for Hasan, not §15 terms.** (1) §15.3 4's agent
  = a scratch, unsigned user agent `d4/decide-probe` (`tools: ['decide']`, kit `D4\make-agent.cjs`, installed in the `decisions-D4` profile
  only) whose AGENT.md hands the model D1's T2 framing; "the T2 framing" = D1's t2_01 dry-run body, which the `calls.json` args equal. (2) The
  tool text is recomputed through the tree's whole chain (`readSystemOneAnswers` → `isDecisionCalibrated` → `decisionOutcome` →
  `decisionText`) in a kit-only vitest (`D4\h4-text\h4-decision-text.test.ts`) — stricter than D-r26 (6) asked. (3) §15.3 5's OpenRouter call is
  a noul sent WITHOUT criteria, so the criteria `true` / `false` port B saw prove the adapter's `noulCriteriaRequired` (D-r23 (7)). (4) "Zero new
  hits" = each port's `/__stub/stats` + the stub log's line count unchanged. **Notes (never a FAIL — §15 has no `skipped` term):** (a) with
  `jev` removed from the order the result's `skipped` lists only `local` (`ladder.ts` `skippedBefore` lists rungs AHEAD of the used one; the
  switched-off rung is reported by `decisions:status` as "switched off in Settings", seen in `h5-or-call.json`) — whether D2 §3's "the rungs
  'auto' passed over" should name a switched-off rung is a question for Hasan; (b) the live agent run shows the `act` band only — `escalate` is
  covered offline (part (d)'s no-claim / band tests) and live by §15.3 3's t3-27. Re-check 18:04–18:05: HEAD `efb1ee9`, tree clean,
  `e539586..HEAD -- src` empty, 0 `electron.exe`, nothing on 9302 / 18471 / 18472; read `h4-run1.json` (reply "TOOL TEXT: Decision: cut (act)",
  15:58:45.8 → 15:58:56.9 Z, events tool / done), `h4-run1-calls.json` (one `decide`, args = D1's T2 rule + the t2-01 question + the six
  families, no `isError`), `h4-usage.json` (typesafe / jev-1.14.0 / decision-agent / decision / 416 tokens / $0.000017472 = 416 × 0.042 / 1e6),
  `h4-decision-text.json` (stub hit t2-01 → served `cut`), `h5-off.json` (`no-provider` "Decisions are switched off in Settings." in 1 ms),
  `h5-or-call.json` (port B, `openrouter-decisions`, `microsoft/microsoft-decision-1-20261009`, p 0.95, calibrated, 267 tokens / $0.000011214),
  `h5-restore.json` (final: mode auto, order jev → openrouter-decisions, OpenRouter `hasKey: false`); `stub-log.jsonl` 32 lines (the two new
  ones = t2-01 on port A, t3-30 on port B with criteria true / false); 0 `FAKE-D4` in the stub log and the h4 / h5 files. **Caps:** keyless
  1 / 10 used (this run), hosted 0 / 60.
- **D-r28 (orchestrator, 18:20) — how §15.2's vitest gate is read in THIS worktree (for D5).** (1) **The known worktree-only reds here are the
  three E-d2a package-resolution suites** — `src/shared/tsx-engine/builder-libraries.test.ts` ("@remotion/paths (builder-libraries.ts) is not
  installed"), `src/main/services/studio/shot-bundle.test.ts` and `shot-bundle-in-place.test.ts` (esbuild "Could not resolve <package>") — each
  failing ONLY on package resolution. A fresh detached worktree has no `node_modules` either and gives the SAME reds, so their proof is
  DRIVING's independence proof (`docs/studio/end-to-end/DRIVING.md` :185-194: none of the files `git diff --name-only b2b8a02..HEAD` lists is
  in their runtime import graph; say the method) — the method session 1's S3 / S4 used for the same three. (2) **The 25 LS-r1c `stream`
  suites are NOT red in this worktree** (no "Cannot find module '<wt>\stream'" line in the gate); if any of them is red for the verifier with
  that error alone, it is counted only with the fresh-detached-worktree proof (LS-r1b / LS-r1c). (3) DRIVING's load rule stands (a known
  load-timeout suite — e.g. `shot-module-resolver.test.ts` — rerun alone and a full run green within 3 tries, or E-d13 under external load;
  record CPU). Any other red is real. Re-check 18:19–18:20: HEAD `ecb69d8` (docs only: Status.md, TESTING.md, D4 HANDOFF / LOG); `git worktree
  list` no longer lists `D4\gate-wt`; `h-gate-2.log` → `Test Files 3 failed | 564 passed | 7 skipped (574)`, `Tests 9 failed | 5890 passed | 39
  skipped (5938)`, FAIL = the three files above, every failure line a resolution error (incl. `builder-libraries`' assertion on its
  "not installed" message and `shot-bundle-in-place`'s two `ok: false` from chroma-js), 0 "Cannot find module" lines; `h-ls-r1c-this-wt.log` →
  28 / 28 files, 286 tests passed; tsc `tsc-web-h.log` 25 / `tsc-node-h.log` 10; Status.md's new top row (2026-10-31 — DECISION MODELS …, "D5 …
  judges the build ONLY by … §15") and TESTING.md `## 20. Decision models` at :590 right after §19 (:543) present.
- **D-r29 (orchestrator, 19:18) — D6, the product-shape measurement (Hasan: "yes" to measuring before relying on a free-form `decide`, and
  "yes" to "plan and run it"; scope = the orchestrator's stated default, T3 × Jev only, MSD1 later if he asks).** (1) **Framing = D3's
  product-shaped note verbatim** (`D3\d-run.cjs:32-39`): `state` = the T3 row's own `question` text (the tree's `t3-verify.json`), ONE `noul`
  question keyed by the row id with `instructions` "Does the item really do what the request asks, by plain meaning?" and D1's T3 criteria
  (`CHECK_MATCHES_CRITERIA`); pinned `jev`, `family: 'verify'`, `featureSource: 'decision-test'`, 15 s, one row per request, sequential —
  through the PRODUCT engine (`registerDecisionProviders`, the `live-run.ts` pattern) with `createRequestCap(fetch, 40)` as a hard cap. (2)
  **The bar, fixed before measuring:** "holds" iff §15.1's live-bar terms for Jev hold on these 40 requests — ≥ 38 / 40, Brier ≤ 0.05, 0 errors,
  p95 per request ≤ 2,000 ms; the act-wrong count at threshold 0.9 (the tree's `decisionOutcome`) is reported beside it and flagged if > 0, never
  changing the verdict. (3) **The confound is stated:** one row per request vs D1's 40 packed — not separable within this budget (a D1-framed
  one-row-per-request control = 40 more requests, offered to Hasan, not run). (4) Keys only through a kit launcher
  `D6\product-shape-live.sh` whose sourcing block is byte-identical to `D4\live-test.sh`'s (= `D1\hosted-live.sh` :4-11; diff proof before
  the run) — D-r8 / D-r23 precedent. (5) Kit-only code, no `src/` change, ONE live run (no rerun on an early stop without Hasan); results in
  `D6/HANDOFF.md` "Results" (not a separate report file — the harness refuses subagent report files); the orchestrator re-scores the answer
  file with D1's `score.cjs`. Hosted ledger after D6: ≤ 44 / 60, ≤ $0.50 (E-g's whole-run cap).

## Stops (session 3)

(one line per stop: what was reported, what Hasan said)

- 2026-10-31 18:53 · **STOP — E-h (the session stops after D5's PASS).** Reported: D4 DONE ((f) `cc754fa` `8f6ff6f` `3f50e63`; (h) docs only);
  **D5 verifier round 1 PASS** on every §15 term (report `docs/studio/decisions/D5/REPORT.md`, verified at `b8e85d0`, `src/` = `3f50e63`); the
  gated live test with Hasan's keys 2 / 2 (4 hosted requests, $0.001298388); records `ca4cc81` (Status.md row + TESTING.md §20 with D5's numbers);
  caps used hosted 4 / 60, keyless 2 / 10. DEFERRED-HASAN: §15.3 1's "5 real Jev calls" and §15.3 6's one real `check_matches_request` run with
  his key inside the app; the landing of branch `decision-models` (not pushed, not merged). Open questions for Hasan: D-r16 (e) (do the hosted
  40 / 40 rows hold in a product-shaped request, state = the evidence?), D3 §10 item 2 (D2 §5.3's "CPU by default" for a later local rung), D-r27
  (a) (should `skipped` name a rung switched off in Settings?). **Hasan said (2026-10-31, after 18:53):** "1. yes 2. no 3. what do you
  mean?" → (1) D-r16 (e): YES — the product-shaped request (state = the evidence) must be MEASURED before a free-form `decide` is relied on
  (not started: new hosted work needs his go and a cap); (2) D3 §10 item 2: NO — a later local rung does NOT run on CPU by default (D2 §5.3's
  "CPU by default" to be amended when a local rung is next designed; D2 itself not edited by the orchestrator); (3) D-r27 (a): explained back
  (`ladder.ts` `planDecisionLadder` orders `['local', ...enabled, ...disabled, 'llm']` and `skippedBefore` lists only rungs AHEAD of the one
  that answered, so a switched-off rung never appears; the only place `skipped` is shown is the dev-preview tester's "Skipped:" line,
  `DecisionsTester.tsx:74`) — awaiting his call.

## Log (session 3)

- 17:11 · start checks: main checkout's uncommitted work still there (14 ` M` + 6 `??`, `end-to-end-p0` @ `5d77600`); Hasan's dev app NOT
  running (0 `electron.exe`; nothing on 5173 / 9222); worktree HEAD `bfa181f`, builder #7's 4 ` M` + 10 `??` unchanged (11:47–11:49 stamps).
  Resources: C: 42.99 GB, commit headroom 63.29 GB → the guard holds.
- 17:13 · this section written; committed with its path only (`30ce081`; builder #7's code stays uncommitted for D4 builder #8 to judge).
- 17:13 · D4 builder #8 spawned (HEAD `30ce081`; judge builder #7's leftovers → a green sub-checkpoint, then part (f) steps 1–5).
- 17:22 · D4 builder #8 HANDOFF (~87 tool calls, ~10 min; code `cc754fa` `8f6ff6f`, docs `4646b64`): **(f1)** builder #7's leftovers kept (36 / 36
  green as found; related 156 + 1 skipped / 1 red = `builder-libraries`), one fix (the tester's 30 s budget, D2 §9), nothing dropped; **(f2)**
  `src/shared/decisions-client.ts`, `runDecisionKeyTest`, `useDecisionsSettings.ts` + `rows/DecisionsRow.tsx` (under Library in
  `GeneralSettingsContent.tsx`), `DecisionsProvidersSection.tsx` (after "API keys"), the dev-preview flag `decisions-tester` + `useDecisionsTester.ts`
  + `DecisionsTester.tsx`; red 2 files / 2 tests → green 19 / 19; related 177 + 1 skipped / 1 red (`builder-libraries`); tsc 25 / 10; largest grown
  file `ProviderKeyRow.tsx` 151 → 157. Step 5 (build + two CDP stills) NOT done. Five decisions (→ D-r24). **Rule breach (self-reported):** the last
  HANDOFF "Agents so far" entry + the LOG line were appended with a bash heredoc, not the Edit tool — the text is correct (committed `4646b64`);
  the next brief repeats the rule.
- 17:24–17:25 · **Orchestrator re-check:** HEAD `4646b64`, tree clean; `30ce081..HEAD` = 27 code paths + D4 HANDOFF / LOG; vitest over the related
  suites → **59 passed + 1 skipped files, 482 passed + 2 skipped tests**; tsc **web 25 / node 10**; read `decision-providers.ts`,
  `DecisionsProvidersSection.tsx`, the `feature-flags.ts` / `CustomNode.tsx` / `flows.ts` / `decide-run.ts` / `ProviderKeysTable.tsx` /
  `useProviderKeyDrafts.ts` / `ProvidersContent.tsx` diffs and `port-visibility.ts`; imports of the new `src/shared/decisions-*.ts` = `./ipc/types/
  decisions`, `./types/decisions`, intra only → ruling **D-r24**. D4 builder #9 (step 5 of (f), then (h)'s stub live checks) to spawn.
- 17:26–17:27 · orchestrator: D1's recorded Jev T3 numbers read from the tree's fixtures — the only Jev T3 row with top < 0.9 is `t3-27` (true,
  pTrue 0.88); false rows `t3-09` / `t3-10` / `t3-11` = 0.02 / 0.01 / 0.02; `t3-01` (true) = 0.96; served model `jev-1.14.0` → ruling **D-r25**
  (the stub serves recorded numbers; §15.3 3 = three runs t3-01 / t3-09 / t3-27; §15.3 4's agent run = keyless, ≤ 3 in (h); §15.3 5's two ports).
  (Commit `e1f075c`, 17:27:25 — its "17:31" / "17:28–17:31" stamps were estimates, corrected to the measured clock in the next commit.)
- 17:28 · D4 builder #9 to spawn (HEAD = the correction commit; step 5 of (f), then (h)'s stub live checks §15.3 1 / 2 / 3 / 4 / 5 per D-r25).
  0 `electron.exe`, nothing on 5173 / 9222 / 9302 at 17:27.
- 17:28 · D4 builder #9 spawned (HEAD `6febcb1`).
- 17:52 · D4 builder #9 HANDOFF (~98 tool calls incl. one Explore agent, ~24 min; code `3f50e63`, docs `f86221c` `8b24e81`): **part (f) DONE** — build
  rc 0, profile `decisions-D4` (from `source`, 0 `settings.db*`), launched on 9302 with both D-r21 URLs (main logged both `dev stub URL in use`
  lines), Studio root set first; two stills; one wording fix red first (`rungLineText`, "no key · no key" → once; 8 files / 68 tests; tsc 25 / 10);
  the tester absent in the production build as D-r24 (3) says. **Part (h) stub checks:** §15.3 2 PASS (fake key typed + saved via the UI → `hasKey`
  true + Test enabled; the stub's 401 in echo mode → `provider-error` "[message withheld: it echoed the request]"; fake key 0× in app.log / the stub
  log; removal flips back; bundle 0 key / 0 `sk-…` / 0 "Bearer"); §15.3 1 PASS (max gap 20.4 ms); §15.3 3 PASS (t3-01 / t3-09 / t3-27 → act / act /
  escalate after an app restart — the first pass hit §15.3 1's cache). §15.3 4 / 5 NOT run; 0 hosted, 0 / 3 keyless used. App + stub stopped.
  Six decisions / notes (→ D-r26).
- 17:52–17:54 · **Orchestrator re-check** (details in D-r26) → ruling **D-r26** (incl. the §15.3 4 evidence rule: the app stores no tool result
  text, so calls.json + the stub hit + the agent's word-for-word quote = the tree's `decisionText` on the served numbers). D4 builder #10 (§15.3 4
  then 5) to spawn.
- 17:55 · D4 builder #10 spawned (HEAD `e539586`).
- 18:04 · D4 builder #10 HANDOFF (~79 tool calls, ~9.5 min; docs `8f55668` `efb1ee9`, no `src/` change): **§15.3 4 PASS** (1 keyless run: scratch
  agent `d4/decide-probe`, session `s-a6550d3a`, t2-01, 11.1 s, quoted "Decision: cut (act)" = the tree's chain on the served numbers, no-claim 0,
  usage typesafe / decision-agent / decision / 416 / $0.000017472) and **§15.3 5 PASS** (mode off → `no-provider` 1 ms, 0 / 0 hits; fake
  OpenRouter key via the UI; jev out of the order → port B with the adapter's criteria, MSD1 snapshot, calibrated, usage cost = the stub's;
  restored). The Explore agent's agent-run pointers checked against the code (one correction: the settings patch fields are `mode` /
  `hostedOrder` / `openRouterModel`). Four decisions + Open problems 23–26 (→ D-r27). App + stub stopped.
- 18:04–18:05 · **Orchestrator re-check** (details in D-r27) → ruling **D-r27**. D4 builder #11 (the gate half of (h): full gate + proofs, tsc,
  house-rules sweep, Status.md row, TESTING.md §20) to spawn.
- 18:06 · D4 builder #11 spawned (HEAD `1a0c821`).
- 18:18 · D4 builder #11 DONE (~78 tool calls, ~12.5 min; docs `ecb69d8`, no `src/` change): full worktree gate run 1 = 4 failed (+
  `shot-module-resolver` 1 s poll — green alone 10 / 10, CPU top `vmmemWSL` 4.1 %), **run 2 (counted) = 3 failed / 564 passed / 7 skipped files,
  9 failed / 5,890 passed / 39 skipped tests** — the E-d2a three only; their runtime import graphs (3 / 9 / 17 files) share 0 paths with the 115 of
  `b2b8a02..HEAD`; a fresh detached worktree at `1a0c821` gives the same 9 reds (then removed); the 25 LS-r1c suites green here (28 / 286); tsc
  25 / 10 = the `b2b8a02` error set; house-rules sweep (43 commits, 115 paths) clean — largest new code file 293 lines, grown big files
  `electron.d.ts` 656 → 661 / `channels.ts` 654 → 660 / `flows.ts` 351 → 353, 0 `any`, 0 default exports, package files unchanged, preload = the
  four functions, `decisions.ts` imports only `./ai-usage`, key scan only fakes; Status.md top row + TESTING.md §20 ("D4's numbers — D5 has not
  run"); HANDOFF DONE.
- 18:19–18:20 · **Orchestrator re-check** (details in D-r28) → **D4 DONE**; ruling **D-r28** (the gate reading for D5). D5 (the independent
  verifier, round 1) to spawn — its brief = D2 §15 + rulings D-r16 … D-r23 verbatim + the ruling text of D-r24 … D-r28 (without the
  orchestrator's re-check numbers) + the commit range `b2b8a02..HEAD`; NOT the HANDOFFs, LOGs or this Log.
- 18:21 · D5 verifier round 1 spawned (HEAD `b8e85d0`; isolated profile `decisions-D5-verify`, CDP 9305, its own stub on 18481 / 18482;
  hosted ≤ 8, keyless ≤ 3).
- 18:42 · **D5 verifier round 1 → PASS** (~107 tool calls, ~21 min, 18:22:50 → 18:41:29): every §15 term PASS — §15.1 fixtures / shape / replay
  (= `c-hosted.md` §2 lines 48 / 49 / 51 / 52, string-equal) / calibration table (six rows) / **the gated live test with Hasan's keys (run once:
  `Tests 2 passed (2)`, `verdict PASS`, `violations []`, 4 requests, $0.001298388; Jev T2 / T3 40 / 40, Brier 0.0199 / 0.0031, 797 / 279 ms; MSD1
  40 / 40 / 40 / 40, Brier 0.0146 / 0.0029, T3 698 ms, T2 2,626 ms = the excluded first call)** / no-claim; 4 / 4 mutants bite; §15.2 gate (try 3
  counted: 564 passed / 3 E-d2a, its own import-graph proof 0 range files in 4 roots, positive control 32; `shot-module-resolver` red in tries 1–2,
  green alone), tsc 25 / 10, house rules over 117 paths, package files unchanged, preload = the four, `decisions.ts` imports only `./ai-usage`;
  §15.3 on its own profile + stub: 2 keys PASS (fake key via the UI; 401-echo withheld; removal flips back; bundle clean), 1 max gap 19 ms
  (20 / 20), 3 act / act / escalate with `p` in `run.json` and no `p` handle, 4 one keyless run "Decision: cut (act)" = the tree's chain, usage
  typesafe / decision-agent / 339 × 0.042e-6, 5 off → 0 hits, OpenRouter port with criteria; §15.3 6 DEFERRED-HASAN. Its numbers agree with
  TESTING §20 where both measured (the §15.3 4 token counts differ by stub estimate, D-r26 (4)). **The harness refused the verifier's Write of
  `D5/REPORT.md`** ("Subagents should return findings as text, not write report files"), so it returned the report as text and committed nothing.
- 18:44–18:45 · **Orchestrator spot-check:** HEAD `b8e85d0`, tree clean; `live-result-20261031-182824.json` (`vidtsx-decisions-live/1`, verdict
  PASS, violations [], requests 4, Σ costUsd 0.001298388; 0 key-shaped strings there and in `live-run-1.log`); `gate-3.log` = `Test Files 3 failed
  | 564 passed | 7 skipped (574)`, `Tests 9 failed | 5890 passed | 39 skipped (5938)`, the three E-d2a files; 0 `electron.exe`, nothing on 9305 /
  18481 / 18482, no stub `node`. The verifier's text filed VERBATIM as `docs/studio/decisions/D5/REPORT.md` (the orchestrator's docs folder) with
  a header saying so. **D5 → PASS.** The verifier's numbers differ from Status.md / TESTING §20 (the live test now RUN and PASS; §15.3 1 19 ms;
  §15.3 4 339 tokens; D5's verdict) → a records builder updates those two files, then STOP (E-h). (Commit `6f23b95`, 18:46:05.)
- 18:46 · D5 records builder spawned (HEAD `6f23b95`; Status.md row + TESTING.md §20 only).
- 18:52 · D5 records builder DONE (~43 tool calls, ~6.5 min; `ca4cc81` Status.md + TESTING.md, `3557641` D4 LOG line): the top Status.md row
  updated in place (D5 PASS, the live table, the verifier's numbers beside D4's, DEFERRED-HASAN, notes (1)–(5)); TESTING.md §20 (:590–768) the
  same. Left alone (its note): the row's "Evidence / re-run" bullet lists only D4's files (the verifier's are named inline and in its report).
- 18:53 · **Orchestrator re-check:** HEAD `3557641`, tree clean; `6f23b95..HEAD` = Status.md (+/− 91), TESTING.md (131), D4 LOG (1);
  `0.001298388` in Status.md ×2 / TESTING.md ×3; "20.4 ms (D4) / 19 ms (D5)" at Status.md:68; the added lines' `sk-` / `Bearer` hits are
  descriptions of the scans, no key. **STOP (E-h)** — Stops (session 3).
