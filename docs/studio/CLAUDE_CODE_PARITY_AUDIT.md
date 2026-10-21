# Studio agent vs Claude Code — parity audit

> **Question Hasan asked (2026-10-03):** the same prompt ("a 15 second video using TSX
> shots only, explaining the speed the Earth rotates, for kids") went to Claude Code in
> `ai-video-lab` and to the Studio assistant in project "Test". The Claude Code result felt
> better. What limits the Studio agent, in general, and how do we make it as powerful as
> Claude Code at making anything directly in Studio?
>
> This is the answer, from the code and from the two real runs — not from brainstorming.
> Nothing here is a decision; the checklist at the end is what a decision would be made from.
> Companion evidence: `~/Videos/VidTSX Studio/projects/test-2` (the Studio run, with
> `agent-chat.json` and the four `v1.debug.json` sidecars) and
> `ai-video-lab/experiments/earth-spin-01` (the Claude Code run; stills in `qa/`).

## 1. The two runs, side by side

Both used **the same model (`claude-opus-5-5`) on the same subscription through the same
harness** — the Studio's `claude-subscription` provider spawns `claude.exe` through the Claude
Agent SDK (`src/engine/providers/claude-provider.ts:151-177`). So the difference is not the
model. It is everything the model is allowed to do around the model.

| | Claude Code (`earth-spin-01`) | Studio assistant (`test-2`) |
|---|---|---|
| Who wrote the TSX | the agent itself | a second, blind model, from a prose brief per shot |
| Shape | one 15 s composition, one persistent globe moving between 4 beats | 4 separate 3–4 s cutaways, hard cuts |
| Format | 9:16 (inferred: 15 s = a Short) | 16:9 (project default, never questioned) |
| Files | 9 source files sharing one timeline + palette | 4 single files, 350–420 lines each, nothing shared |
| Libraries | installed `d3-geo` + `world-atlas` → a real globe with true continents | react + remotion (+ kit) only → the Earth is hand-drawn blobs, drawn differently in each shot |
| Fonts | `@remotion/google-fonts/Fredoka`, loaded | asked for Fredoka / Nunito / Baloo 2 — none installed, silently fell back to Arial Rounded |
| Verification | typecheck, 30 stills rendered and **looked at**, 3 visual bugs found and fixed | esbuild transpile + import lint + config parse; no frame ever rendered; "ready" = compiles |
| Questions asked | none (told not to) | two before starting, then waited for "add to the timeline" |
| Wall clock | ~13 min build, one session | ~11.5 min of pipeline (4 shots: 114–243 s each) + agent turns |
| Tokens (pipeline only) | n/a | 31k in / **72k out** for ~20k chars of final code (hidden thinking + the whole file re-emitted by "verify") |

**Honest verdict on the output.** The Studio's four shots are competent card-style
infographics with a consistent palette — repeating the look in every brief worked, and the
"1 spin = 1 day" scene adds a fact the Claude Code version does not have. What makes the
Claude Code version read as "a film" and the Studio version as "four cards" is: one
continuous world (the same kid, trees, house ride the same globe for 15 s), real geography,
the 2× claim shown as a race with a true 54 % proportion, format fit, and the fact that
someone looked at the frames before saying "done". None of that needed a better model. All
of it needed tools the Studio agent does not have.

## 2. The mental model in one paragraph

Claude Code is **one model with Read/Write/Edit/Glob/Grep/Bash, image input, on-demand
skills, project memory, and an open loop**: write → run → look → fix, as many times as it
takes. The Studio assistant is **the same model with every built-in tool switched off**
(`tools: []`, `settingSources: []` — `claude-provider.ts:132-160`), given 29 in-process MCP
tools that all return text, no file access, no pixels, and a rule that it must never write
code. It writes a *brief*; a second one-shot model (thinking off, tools off, `maxTurns: 1`)
turns the brief into one file; an LLM "verify" pass re-emits the file; a regex gate checks
imports. Nobody looks. The user is the visual check.

## 3. The limits, ranked by how much output quality they cost

### L1 — No eyes. Nothing on the agent's path ever renders a frame
- The agent never receives an image: no tool returns image blocks, `request.images` is never
  set (`studio-agent.ts`), every tool result goes through `text()` (`agent-tools/types.ts:63`).
- The pipeline never renders either: its "verify" is an LLM re-reading code against a
  mechanical checklist (`prompts/verify-2d-prompt.ts`), then esbuild + lint + config parse.
- The one vision loop that exists — **Refine** (`renderShotStills` → 3 JPEGs → one
  critique-and-revise edit, `shot-generator.ts:475-590`) — is reachable only from the
  Inspector button (`studio-shot-handlers.ts:111-123`), one round per click. The agent cannot
  trigger it. SHOT_QUALITY_DESIGN Q5 proved it works (v5→v6 caught 7 defects in 110 s) and
  then left "always-on rounds" in the v2 ledger.
- **Cost:** every layout bug, overflow, empty region, wrong font and timing miss ships to the
  review panel. In `earth-spin-01` the look-and-fix loop found 3 of those in 30 stills.

### L2 — The brief is the only channel to the code, in both directions
- The agent is told "never write TSX yourself"; `generate_tsx_shot` returns only
  `Shot ready: id "…" (kind, N s, v1)` (`shot-tools.ts:101-105`). It cannot read the file it
  caused to exist, cannot read any other shot's source, and has **no edit, regenerate or
  refine tool** (those exist in `shotGenerator` but only the UI calls them). "Change this
  shot" means a brand-new shot from a rewritten brief.
- The pipeline model sees only the brief + the contract (`SKILL.md:21-23`): not the chat,
  not the other shots, not the previous version on regenerate, not the rendered result.
- Continuity across shots therefore rests on the agent re-typing "same look as the series"
  into every brief — which is exactly why the Earth is a different blob in each `test-2` shot.
- **Cost:** no shared components, no cross-shot consistency beyond a palette, no iteration on
  the actual code, and a lossy hop (intent → English → code) on every shot.

### L3 — One file, three imports
- `ALLOWED_IMPORTS = {'react','remotion','@vidtsx/kit'}` (`shared/studio/shot-lint.ts:12`),
  exact match, no subpaths, no relative imports ("shots are single-file — inline everything").
- **The lint is the bottleneck, not the loaders.** Preview already serves `three` / R3F /
  drei / `@remotion/three` from `resources/vendor/` and any other bare package from esm.sh
  (`tsx-transpiler.ts:164-216`); export resolves against the app's whole `node_modules`
  (`bundle-worker.ts:40-61`: every `@remotion/*`, three, tone, chroma-js, lucide-react,
  react-simple-maps). The generation prompt itself still *advertises* chroma / `@remotion/*`
  / google-fonts / tone (`generate-2d-prompt.ts:76-87`) and then forbids them 20k chars later
  (`shot-prompt.ts:149`) — fix-loop churn for free.
- No data channel: `assetRefs` are images and video only (`shot-asset-refs.ts:62-66`); a
  JSON/CSV/GeoJSON file cannot reach a shot except inlined in the source.
- `shot-bundle.ts` already knows how to take a multi-file source tree and inline it into
  the single-file form (that is what Import TSX does, incl. `compositionConfig` re-literal
  and `staticFile` → `assets` rewrite). It is used for import only, never for authoring.
- **Cost:** no real globe, no charts from data, no shared project kit (CAPABILITY_GAPS
  already recorded this for `short-02`: the project-level kit had to be copied into each of
  19 shots, ~80 KB each).

### L4 — Fresh process every turn, text-only memory of what it did
- No `sessionScope` on the agent's send → each user message is a new one-shot `claude.exe`
  (`claude-provider.ts:206-213`). History is replayed as **one flattened string**
  ("User: … Assistant: …", `:93-98`), capped at 30 exchanges, **without tool calls or tool
  results** — the model forgets shot ids, what it generated, and why.
- **Cost:** every turn re-pays the ~37k-char system prompt + 29 tool schemas with no cache
  across turns, and multi-turn work (make → look → fix → look) is structurally impossible
  even if L1/L2 were solved, because turn N+1 does not remember turn N's observations.

### L5 — The code writer runs with thinking off, under a prompt that is 55 % irrelevant and contradicts itself
- `shotGenerator.generate` passes no `thinkingLevel`; the pipeline defaults to `'off'`
  (`tsx-generation-service.ts:95`). The project's Off/Normal/Deep dial reaches only the
  planning agent. (Opus still thinks adaptively — the sidecars log `blocks: [thinking]` — so
  the thinking is paid for and invisible.)
- No plan step, mode forced to `'2d'`, one generate call, then **verify re-emits the whole
  file** (≈ +45 % output tokens, 43–65 s per shot) for lint-grade checks only.
- Prompt budget (chars): exemplars 8.8k, kit manifest 9.4k, forbidden-library docs ~9.8k
  (incl. an 80-line Tone.js WAV encoder), craft + contract 2.5k. For a kids' cartoon, the kit
  and the forbidden-library sections are dead weight — and one `test-2` shot imported
  `CLAMP, EASINGS` from the kit because the prompt says it MUST reach for it.
- Contradictions a fix loop has to absorb: background "fills the frame" vs "overlays MUST be
  transparent" (`category` is never set by ShotGenerator); `id: 'ComponentName'` vs
  `id: 'shot'` (`FIX_SYSTEM_PROMPT` still says id must match the function name);
  `staticFile()` allowed vs forbidden; "never hardcode frames" vs a frame-cued kit API.
- **Cost:** 14–22k output tokens and 2–4 min per 4 s shot, and a model doing its hardest
  work (layout + choreography in one pass) with its reasoning switched off.

### L6 — Fonts cannot be loaded
- Nothing in `src/main/services/studio` or `src/shared/studio` loads a font. The brand block
  says "Do NOT import any font package — set fontFamily strings exactly" with a
  `'X', 'Segoe UI', sans-serif` fallback (`shot-prompt.ts:249-265`). Only OS-installed fonts
  render. `test-2` asked for Fredoka / Nunito / Baloo 2 and got Arial Rounded.
- The font proxy (`font-proxy.ts`) can already fetch and cache Google CSS, and export waits
  for brand fonts (`BRAND_FONT_WAIT_MS`); the shot path just never uses it.

### L7 — The prompt makes it timid, and its defaults are wrong for this kind of ask
- "PLAN CHEAP, GENERATE EXPENSIVE … get the user's go-ahead BEFORE generating"
  (`studio-agent-prompt-tools.ts:60`, repeated in `SKILL.md:170-172, 184-185`); "STOP after
  every proposal"; "Keep replies short — this is a narrow chat panel"; default shot length
  5 s; "typically 2–8 s"; density ceiling "one headline, one support line, 3–5 items";
  "Calm — one accent at a time" as the example brief's mood.
- From-scratch mode (`SKILL.md:180-191`) is *defined* as "each scene as an unanchored
  cutaway, back-to-back, repeat the palette in every brief" — i.e. the four-cards shape is
  prescribed, not chosen.
- Project default is 1920×1080; the agent never infers 9:16 from "15 second video".
- **Cost:** two questions before any work, and a scene grammar that cannot produce a
  persistent world even when the model would.

### L8 — The kit and the exemplars are for tech videos
- `@vidtsx/kit` = browser / VS Code / terminal / agent feed / typed text / stat block
  ("Fake-screencast and stat components", `resources/shot-kit/core/pack.json`). Exemplars
  are 2 per kind, chosen by kind never by subject — a kids' cartoon gets the
  `browser-walkthrough` screencast as "the bar to match".
- This is correct for its origin (`claude-youtube-editor`, coding videos) and wrong for
  every other genre. Nothing in the kit draws a shape, a chart, a character, a globe.

### L9 — No CLAUDE.md, no on-demand skills, memory = short rules
- `settingSources: []` → no CLAUDE.md, no user skills. Skills are two SKILL.md bodies
  pasted in full every turn; resources beside a SKILL.md are deliberately never read.
  Memory is `rule` (≤300 chars) / `vocabulary` / `profile`, propose-only.
- Project notes exist (`project-notes.ts`, `list_notes` / `read_note`) but are read-only and
  not injected — the agent has nowhere to keep "what this project is, what we decided,
  what is next" the way Claude Code keeps it in CLAUDE.md + NEXT-SESSION-PROMPT.md.

### L10 — Smaller things that bite once the big ones are fixed
- Lint stricter than runtime: `react/jsx-runtime` and `remotion/no-react` are served but
  rejected (CAPABILITY_GAPS G5, still open).
- Preview's virtual `remotion` lacks `prefetch`, `AnimatedImage`, `Html5Video`,
  `Html5Audio`, `useBufferState`, `getStaticFiles`, `Folder`, `Artifact` … — a shot using
  them passes the gate and export, and fails only at preview link time.
- Preview serves the *installed* kit, export the *pinned* one → they diverge after a kit
  update. `ShotErrorBoundary` exists in preview only. `staticFile('C:/…')` previews, fails
  at render. Fonts: preview no wait, export 8 s wait.
- `error_max_turns` (64 for the agent, 16 for TSX Composer) is surfaced as a failure and the
  turn's text is discarded, instead of "stopped at the budget, here is where I am".
- `TOOL_LINES` in the prompt is out of step with the registry (missing `capture_scripted`,
  `list_notes`, `read_note`).
- Packaged-build suspect: `bundleNodePaths()` points at `<resources>/node_modules`, but
  `electron-builder.yml` unpacks only better-sqlite3 / esbuild / onnxruntime — Import TSX's
  inlining of lucide / chroma / `@remotion/*` may fail in an installed app (not tested).

## 4. What the Studio got right — keep all of it

- **The review-card + one-undo-step model.** Claude Code has nothing like it; the Studio's
  "every change is a card you accept or reject" is the right UX for an editor.
- **`assets` prop + the no-paths rule** — preview/export identity by construction.
- **Export pinning** (`kit/<version>/` folder-as-truth), the gate (transpile + lint + config
  parse), per-shot `debug.json` sidecars (they are what made this audit possible), cost
  accounting, brand + style memory with consent, `.vidtsx` packages, the Refine loop itself.
- **The threat model for third-party agents** (no Bash, no model-chosen paths, signed
  packages) is sound *for installed agents*. The mistake is applying it unchanged to the
  first-party Studio assistant running on the user's own project on the user's own machine.

## 5. How to close the gap — proposal

The thesis: **stop making the agent describe code to another model. Let the agent be the
coder, inside the project folder, with eyes.** Everything the Studio already has (gate,
cards, pinning, assets, brand) stays as the rails the coder runs on.

### P1 — Give the Studio assistant Claude Code's file tools, scoped to the project
- The mechanism already exists in the Agents feature: `workspace.sdkFileTools` →
  `cwd = <workspace>` + `canUseTool = createFileToolGuard(cwd)` for Read / Write / Edit /
  Glob / Grep (`agent-runner.ts:203-227`, `file-tool-guard.ts`). Lift it into
  `studio-agent.ts` with `cwd = <project>/` (shots, notes, a new `shared/`). Bash stays off;
  instead add **typed tools for what Bash would be used for**: `validate_shot` (the gate),
  `render_shot_stills` (P2), `bundle_shot` (P3).
- One rule to check first: `allowedTools` + `canUseTool` ordering in the SDK — the guard
  must run before auto-approval (the agents runner adds `sdkTools` to `allowedTools`,
  `agent-runner.ts:216-218`; verify the guard still fires).
- Keep the brief pipeline **as the fallback** for non-`agent-sdk` providers (OpenRouter
  models etc. get tools only through the brief path today) and for the one-click "Generate
  shot" button.
- The agent can then read the shot it made, read sibling shots, edit in place (new version,
  same append-only folders), and share code — L2 closes.

### P2 — Eyes: stills to the agent, and an automatic refine loop
- New tool `render_shot_stills(shotId, frames? | count?)` → `renderShotStills` → return
  **image blocks** (the tool server already supports `{type:'image'}` content,
  `tools/tool-server.ts:166`; copy the shape into `agent-tools/types.ts`). Also
  `render_timeline_stills(t[])` for the assembled edit.
- Make the generate path render stills **by default** after the gate and hand them to the
  agent in the tool result ("here is what you made"), so the look-and-fix loop is the
  normal path, not a button. Budget: N rounds per shot (setting, default 1, hard cap 2),
  cost shown on the card.
- This alone would have caught the dead space in `title-spinning-earth` and the font fallback.

### P3 — Multi-file shots with a project `shared/` folder
- Author sources in `shots/<id>/src/` (+ `shared/`), keep them, and run `bundleShotSource`
  (`shot-bundle.ts`) at save to produce the single-file `v<N>.tsx` the gate / preview /
  export already understand. Edits operate on the sources, not the bundle (today's Import
  TSX keeps only the entry as `original.tsx` and later edits hit bundled JS — fix that).
- `compositionConfig` stays a literal in the entry; `staticFile` → `assets` rewrite stays.
- Allow relative + `shared/` imports in the lint for *sources*; the bundle is what must be
  single-file. One globe, one palette, one timeline helper → continuity by construction.

### P4 — Widen imports in two tiers, no `npm install`
- **Tier 1 (already runs on both sides):** `@remotion/*` (shapes, paths, noise,
  transitions, google-fonts, media-utils), `three` + R3F + drei + `@remotion/three`,
  `chroma-js`, `lucide-react`. Lint allowlist + a bundle dry-run gate (V2 ledger item).
- **Tier 2 (curated data/graphics libs):** `d3-geo`, `d3-shape`, `d3-scale`,
  `topojson-client`, `world-atlas`, `gsap` … — vendored into the app's `node_modules` (export)
  and served through the existing esm.sh path with pinned versions (preview,
  `KNOWN_PACKAGE_VERSIONS`). The allowlist is a file the user can read; "install a package"
  is out of scope for a packaged app, "ship a bigger curated set" is not.
- A data channel: allow `.json` / `.csv` under `assets` (export's `/asset` allowlist already
  has them; preview's does not — align) or inline via the P3 bundle.

### P5 — Session continuity
- Give the agent a `sessionScope = project:<id>` so the SDK session (and its prompt cache)
  survives across turns; or, minimum, persist and replay **tool calls + results** in
  `agent-chat.json`, not just text. Either way the agent must remember what it looked at.

### P6 — Pipeline hygiene (cheap, do first)
- Pass the project's thinking level to the code writer; default Normal for Opus.
- Drop the LLM "verify" rewrite once stills exist (keep the mechanical gate); it costs ~45 %
  of output and has been fighting the contract since D6 (SQ17).
- Prune the prompt: kit manifest + screencast exemplars only when the brief is app-shaped;
  forbidden-library docs out (the lint says it in one line); fix the four contradictions
  (background by kind, `id`, `staticFile`, frame-cued kit) so the fix loop stops paying for
  them; exemplars chosen by subject, with at least one non-tech pair (illustration /
  character / chart).
- Fonts: let shots use `@remotion/google-fonts/<Family>` (tier 1) or inject the brand/font
  stylesheet through the existing proxy for preview *and* export; tell the model which
  families are actually available.

### P7 — Prompt posture and defaults
- A per-project (or per-ask) **"just do it" mode**: no go-ahead questions, state cost and
  proceed; "plan cheap" stays the default for paid passes (video models, flows).
- Infer format from the ask (15–60 s with no footage → offer 9:16; "YouTube video" → 16:9)
  and say which was chosen.
- From-scratch mode: prefer **one continuous composition** or shared components + real
  transitions over back-to-back cutaways; raise the 5 s default; replace "calm" with "match
  the register the user named".

### P8 — Project notes as the agent's CLAUDE.md
- Inject the head of a `NOTES.md` / `project-notes` entry into the system prompt and let
  the agent write it (through the file tools, P1): what the project is, decisions, what is
  next. Skills: load `studio-make-tsx` on demand (when a shot ask appears) instead of every
  turn, and let a skill's resources be read with the file tools.

### Sequencing — a suggestion
1. **P6 + P2** — days of work, no architecture change, measurable on `test-2` (regenerate
   the four shots with stills + thinking and compare).
2. **P1 + P3** — the big one; the file-tool guard and `shot-bundle` already exist, the
   decision is "the Studio agent gets a `cwd`".
3. **P4** tier 1 then tier 2; **P5**; **P7 / P8** are text + one setting each.

## 6. Checklist — answer inline

1. **P1** Does the Studio assistant get Read/Write/Edit/Glob/Grep inside `<project>/`
   (Bash stays off; typed tools for validate / stills / bundle)? *(recommendation: yes — it
   is first-party code on the user's machine; the third-party rule stays for installed agents)*
2. **P2** Stills to the agent after every generate, and automatic refine rounds —
   default 1, cap 2, cost on the card? *(recommendation: yes)*
3. **P3** Shots authored as a source folder + `shared/`, bundled to one file at save, edits
   on the sources? *(recommendation: yes)*
4. **P4** Import tiers as listed, with a readable allowlist file; no `npm install`?
   *(recommendation: yes; tier 2 roster is the open question)*
5. **P5** SDK session per project (prompt cache + memory of tool results) vs replaying tool
   calls from `agent-chat.json`? *(recommendation: session per project, replay as fallback)*
6. **P7** A "just do it" switch, and format inference with a stated choice?
   *(recommendation: yes, per project, default off)*
7. Keep the brief pipeline as the path for non-`agent-sdk` providers and the pool button?
   *(recommendation: yes — it is the only way OpenRouter-class models get shots)*
8. Run the P6 A/B on `test-2` before committing to P1/P3? *(recommendation: yes — same
   four briefs, stills + thinking on, verify off; compare in the review panel)*
