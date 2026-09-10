# Flows — frozen, reusable recipes that people run and agents call

> Status: IN PROGRESS (plan written 2026-09-04; discussion answered
> 2026-09-10, see §0.1; all seven stages ship in V1 as W8 of
> `docs/v1-completion-plan.md`). The agents plan's Stages 0–6 are done, so
> the tool registry, runner, artifact store, interaction broker and package
> code this plan builds on all exist. Companion designs: `docs/agents-plan.md`, `docs/NEXT_FEATURES_DESIGN.md`
> (Q7 packages, Q8 packs), `docs/SKILLS.md`.

## Discussion for Hasan (parked 2026-09-10 — ANSWERED the same day, §0.1)

W8 is parked until this discussion has happened (`docs/v1-completion-plan.md`
§0 decision 2). Nothing below has been built. A: what only you can decide.
B: what the other workstreams already need from flows. C: what is settled.
D: cost, and what can run in a parallel session. E: lines of this plan that
the last week made stale.

### A. Decisions only you can make

1. **How much of W8 ships in V1?**
   (a) All seven stages, ~8.5 sessions, as the completion plan says today.
   (b) Cut line after Stage 3 plus the Studio `run_flow` slice of Stage 4
   (~5.5 sessions): flows run in main, the run form and pauses work, the
   product nodes exist, the Studio agent can apply a flow to a shot range.
   Flow Builder, freeze, `.vidtsxflow` and the Tools-hub migration follow in
   a point release. (c) Keep Flows env-gated and ship V1 without it.
   **Recommendation: (b)** — nothing else in V1 depends on Stages 4b–6, and
   each of them is a self-contained feature that can ship on its own.
2. **Which built-in flows ship first?** (a) All five of §1.7. (b) `thumbnail`,
   `frame-strip` and `explainer-30s` now; `product-ad` and `add-effect` later
   (both spend on `generate_video`, and `add-effect` needs a first-frame
   video model). **Recommendation: (b)** — three flows the "run three times
   before it ships" rule can actually be paid for.
3. **Does the Tools hub lose screens in V1?** (decision 9) (a) Thumbnail
   Generator and Frame Extractor open their flow's run form and the screens
   go. (b) The flows ship beside the screens; nothing is removed in V1.
   **Recommendation: (b)** — the plan already says one release with both
   paths; removing screens is a testing-pass item, not a build item.
4. **Packaging in V1: `.vidtsxflow` or plain JSON?** (a) The full container
   (zip, hash, cap, zip-slip, signing, file association, website metadata),
   the agents' Stage 2 code parameterised. (b) `flow.json` export/import
   through the structural validator; the container after V1, together with
   agent packages carrying `flows/*.json`. **Recommendation: (b)** — the
   code is mostly reuse, but signing keys and a second file association are
   installer and website surface.
5. **How does a Studio flow result land on the timeline?** (decision 13)
   (a) Reuse W3's `insert_asset` (`'insert-plan'` proposal): the flow's
   `video` output is imported like a generated clip and proposed as B-roll
   at an anchor; "replace shot" and "overlay" wait. (b) A new `flow-result`
   proposal kind carrying all three handoffs. **Recommendation: (a)** — one
   card the reviewer already knows; the other two are ordinary follow-ups.
6. **Do agent-launched (unattended) runs get a spend guard?** A flow can
   chain priced nodes with no card between them (`generate_video` is $0.40
   a call, three of them in `product-ad`). (a) None — the same as the Studio
   agent calling `generate_video` today. (b) The run form and the `run_flow`
   tool description list the priced nodes, and the agent must name the flow
   and the expected cost before running it. (c) A `maxUsd` argument on
   `run_flow`; the runner stops before the node that would cross it.
   **Recommendation: (b)** — consistent with W3, and (c) needs per-call
   prices the catalog does not always have (completion plan §5 question 2).

### B. What the other workstreams need folded in (completion plan §2.8)

- **Composition trio ports in Stage 1**, not Stage 3: `generate_composition`,
  `edit_composition`, `render_composition` already exist in the shared
  registry (`src/main/services/agents/tools/`), so giving them `ports` is
  free and the "TSX node" exists from the first runnable build.
- **`generate_audio` node in Stage 3**, on the W2b `AudioGenerationEngine`
  (`kind: 'sfx' | 'music'` → `audio` artifact). Stage 3 therefore lands
  after W2b; audio prompts are not content-gated (W2b's ledger note).
- **Brand.** Run-level `brandId` on `run.json` with the session semantics W4
  built (absent = library default, `null` = none), a brand picker on the run
  form beside the mode switch, and `run_flow` inheriting the calling
  session's brand. Per-node `brandId` config only on nodes whose service
  takes a brand (`generate_image`, `generate_video`, `generate_composition`,
  `generate_audio`); `get_brand`'s summary is what a `generate_text` node
  gets when it opts in. Freeze writes the session's brand as run-level.
- **Model binding reads the W1 catalog.** `LlmModelPickerField` becomes
  `ModelSelect` + `useModelPicker(providerId)` (`LLM_MODEL_CATALOG`, user
  overrides); `modelMode` stays as decision 12 says; free-text "Custom…"
  stays as the escape hatch. Fable 5.1 is not in the Claude catalogs until
  the Agent SDK bump (completion plan §5 question 1).
- **Studio `run_flow` lives in the Studio agent's OWN server**
  (`src/main/services/studio/agent-tools/`, a new group file, id appended to
  `STUDIO_TOOL_IDS`) and calls the main runner directly. It is a second
  tool from the shared registry's `run_flow`; both call `flow-runner.ts`.
- **Presets may reference a flow later.** `StudioPreset.workflow` carries a
  reserve comment for `{ flowId }` (W5); nothing reads it and nothing in
  W8 builds it.

### C. Already decided — not reopened here

- Decisions 1–13 of §0 below: flow vs agent, one registry (nodes are tools
  with ports), the runner in main, per-node pause, no branching, three
  consumers of one document, freeze, the Flow Builder, packaging on the
  agent container, the provider rule, the three model-binding modes, Studio
  through the agent with no manual panel.
- Completion plan §0 decisions 3 (Studio keeps its own tool server) and 4
  (no Audio Studio screen), and its §4 rules: append-only tool ids in both
  registries, generators behind the engine seam, proposals gated, Flows
  flips from env-gated to on in its own Stage 6.
- The `FlowDoc` shape (§1.1), the v1 alias table, and `invokeTool` as the
  single handler path (§11).

### D. Cost, and what can run in a parallel session

| Stage | Sessions | Touches | Parallel-safe? |
|---|---|---|---|
| 0 contracts + migration | ½ | `src/shared/types/flows.ts`, `src/shared/flows/`, `src/shared/ipc/{channels,types}`, `flows-projects-db.ts` | yes (the two IPC files are append-only) |
| 1 ports + main runner | 1½ | `registry.ts` ports, six new tool files, `src/main/services/flows/`, `flows-handlers.ts`, `preload/api/flows.ts`, `src/features/flows/` | yes |
| 2 pause, run form, page | 1½ | `src/features/flows/`, the broker's reply channel, inspector fields moved to `src/renderer/components/fields/` | yes |
| 3 product nodes | 1½ | the composition trio + seven new files under `agents/tools/`, `src/main/services/media/` | yes, after W2b |
| 4 `run_flow`, `run_agent`, Builder | 1 | `agents/tools/`, `studio/agent-tools/` (new file + index), `resources/agents/vidtsx/flow-builder/` | no — shares Studio's tool index with W7/W9 |
| 5 freeze | 1 | `src/main/services/flows/freeze-session.ts`, `features/agents/components/stage/ActionBar.tsx` | mostly (one agents file) |
| 6 packaging, built-ins, release | 1½ | `agent-package.ts`, `resources/flows/`, Tools hub, Library, Video Studio, `Sidebar.tsx`, `feature-flags.ts` | no |

Total ~8.5 sessions (the completion plan rounds to 8). The plan's claim that
W8 touches only `src/features/flows/`, `src/main/services/flows*` and the
registry's `ports` block holds for Stages 0–2 (plus the shared IPC files and
the preload, both append-only) and for Stage 3's new tool files; it does not
hold for Stages 4–6, which reach into the Studio tool index, the agents
stage, the Tools hub, Library and Video Studio. Stages 0–3 can run in a
second session at any time; 4–6 should wait for a quiet tree.

### E. Lines below that were stale — applied in place on 2026-09-10

The five items this section listed (status header, `generate_video` already
in main, viewers and cards already shared, `generate_audio` / `get_brand` /
`brandId` missing, audio prompts not gated) plus three the build-start read
found (`invokeTool` does not exist yet, Stage 2's agents dependency is done,
the W9 web-page tools are not in the catalogue) were corrected where they
stand, each marked "(updated 2026-09-10)".

## 0. Decisions recorded on 2026-09-04

1. **A flow is a frozen plan; an agent decides.** If the steps are known
   before you start, it is a flow: same steps every run, parameters exposed,
   no model choosing the plan. If the plan has to be discovered, it is an
   agent. Flows never replace agents and agents never re-derive a flow.
2. **One registry.** A flow node is an agent tool plus ports. Nodes are not a
   second catalogue of handlers. `run_flow` is one more agent tool and
   `run_agent` is one more node, so the two features grow together and
   cannot drift into redundancy.
3. **The runner lives in the main process** as a persistent job, the same
   shape as the render queue. The renderer subscribes to events. Today's
   renderer-side runner (`src/features/flows/services/run-flow.ts`) is
   retired; no new node is built on it.
4. **Pause is a per-node property, not a node.** Any node can be ticked
   "pause after this node". The interaction kind follows the output type
   (batch → pick, single → approve, text → editable approve). A run-level
   switch chooses "Run with checkpoints" or "Run unattended". Agents always
   run flows unattended.
5. **No branching, no loops.** A rejected checkpoint stops the run or
   retries the upstream node once. Iteration is the agent's job. The canvas
   stays a DAG.
6. **One flow, three consumers.** The canvas (build), the run form (people),
   and `run_flow` (agents). Every consumer reads the same flow document.
7. **Agents can freeze a session into a flow.** The winning path is
   extracted deterministically from artifact lineage; the agent only names,
   describes, and chooses which parameters to expose; the user reviews on
   the canvas before saving.
8. **A built-in "Flow Builder" agent** creates and edits flows through
   proposals the user approves, the same gate the Studio agent uses for
   cuts. Optional: a flow is fully usable without it.
9. **Bundled flows replace the Tools hub over time.** A new tool becomes a
   flow file with a generated run form, not a screen plus hook plus IPC
   handler. Existing Tools screens are migrated one by one, starting with
   the Thumbnail Generator.
10. **Packaging reuses the agent container.** `.vidtsxflow` is a zip with
    the same manifest, hash, cap, zip-slip, and signing rules as
    `.vidtsxagent`; agent packages may also carry `flows/*.json`.
11. **Provider rule.** A flow with no LLM or agent node runs with no
    provider configured. `generate_text` nodes accept any LLM provider. An
    agent node requires an `agent-sdk` provider, same rule and message as
    the Studio agent.
12. **Model binding per node has three modes.** `required`: the named
    provider and model are fixed; the run refuses to start with a clear
    message when they are unavailable. `preferred`: use the named model
    when available, otherwise the app default, and say so in the run log.
    `default`: always the app default. Shared flows pick the mode per node
    in the inspector; the run form shows a "needs model X" chip before Run
    for `required` nodes.
13. **Flows are callable from anywhere an agent runs, Studio first.** The
    Studio agent gets `run_flow` alongside its shot tools. It can suggest a
    flow for a shot or a section, run it with that range as the `video`
    input, and apply the result to the timeline through a handoff
    (`insert as B-roll`, `replace shot`, `overlay`). The user can also ask
    it directly: "apply Flow X on this section". A manual run-form panel in
    Studio is not planned; the agent is the entry point. This is the
    intended shape of the Studio agent: it may call any tool in the app to
    edit the video, and flows are tools. (Updated 2026-09-10: the Studio
    `run_flow` is a tool in the Studio agent's OWN server, §0.1 item 11, and
    the handoff is W3's `insert_asset` card, §0.1 item 5.)

## 0.1 Decisions recorded on 2026-09-10

Answers to the six questions of the discussion above (Hasan, 2026-09-10),
plus the completion-plan folds now fixed as scope. These override any older
line of this plan where the two disagree.

1. **All seven stages ship in V1** (Q1 = a). Stage 0 → 6 in order, ~8.5
   sessions, one fresh-context session per stage, each verified before the
   next. The cut-line variant (Stage 3 + Studio `run_flow`) is not taken.
2. **All five built-in flows ship** (Q2 = a): `vidtsx/thumbnail`,
   `vidtsx/frame-strip`, `vidtsx/explainer-30s`, `vidtsx/product-ad`,
   `vidtsx/add-effect`. Each runs three times unattended before it ships
   (§9); the two paid flows draw on the acceptance cap (about $3–4 in fal
   clips), and a run whose output is wrong is reported, never hidden.
3. **The Tools hub keeps its screens** (Q3 = b). Thumbnail Generator and
   Frame Extractor stay; the two flows ship beside them (a "Flows" group in
   the hub, or a second entry per tool). Removing the screens is a follow-up
   after real use, not a V1 build item. The tester screens stay as screens.
4. **Packaging is the full `.vidtsxflow` container, and a bare `flow.json`
   also imports** (Q4 = a+). The agents' package code (reader, validator,
   hash, cap, zip-slip, ed25519 signing with the EXISTING `vidtsx-1` key,
   install, update) is parameterised by manifest name; `.vidtsxflow` is
   added to the extension map in `src/main/services/packages/pending-open.ts`
   (so `src/main/index.ts`, which another session owns, is not touched) and
   to `electron-builder.yml`'s `fileAssociations`; `scripts/agent-pack.mjs
   --kind flow` (or `flow-pack.mjs`) packs and signs. Import accepts either
   a `.vidtsxflow` or a plain `flow.json` through the same structural
   validator.
5. **A Studio flow result lands through W3's `insert_asset`** (Q5 = a). The
   flow's `video` output is imported like a generated clip and proposed as
   B-roll at an anchor with the existing `'insert-plan'` card; "replace
   shot" and "overlay" are ordinary follow-up cards (a cut proposal plus an
   insert; an insert on the overlay lane). No new proposal kind.
6. **Spend guard = the priced-node listing plus "name the cost first"**
   (Q6 = b). Every `NodeSpec` carries `priced: boolean` and, where the
   catalog knows it, a price hint; the run form shows a "Priced steps: …"
   line before Run; the `run_flow` tool description lists each flow's priced
   nodes; the Studio and shared agent prompts require the agent to name the
   flow and the expected cost in its message before calling `run_flow`.
   Follow-on from W9: `generate_video`'s catalog listing (the tool result
   and the node's model picker) carries the per-second price per model so
   the cost can actually be named. No `maxUsd` enforcement in V1.

Folds from the completion plan (§2.8, its outcomes), now scope:

7. **Composition trio ports in Stage 1.** `generate_composition`,
   `edit_composition`, `render_composition` gain `ports` with the first
   registry change, so the TSX node exists from the first runnable build.
8. **`generate_audio` node in Stage 3** on the W2b `AudioGenerationEngine`
   (`kind: 'sfx' | 'music'` → `audio` artifact). Audio prompts are not
   content-gated (W2b); the runner applies each tool's own gate, never a
   blanket one.
9. **Brand.** `run.json` carries run-level `brandId` with the W4 session
   semantics (absent = library default, `null` = none); the run form shows
   the shared `BrandSelect` beside the mode switch; `run_flow` inherits the
   calling session's brand (Studio: the project's brand). Per-node
   `brandId` config exists only on nodes whose service takes a brand
   (`generate_image`, `generate_video`, `generate_composition`,
   `generate_audio`); a `generate_text` node has a `useBrand` config that
   prepends `get_brand`'s summary (the shared `brand-summary.ts` formatter).
   Freeze writes the session's brand as the run-level default.
10. **Model binding reads the W1 catalog.** `LlmModelPickerField` is
    replaced by the shared `ModelSelect` + `useModelPicker(providerId)`
    (`LLM_MODEL_CATALOG` and user overrides); `modelMode` stays as decision
    12 says; free-text "Custom…" stays as the escape hatch.
11. **Studio `run_flow` lives in the Studio agent's OWN server**:
    `src/main/services/studio/agent-tools/flow-tools.ts`, id appended to
    `STUDIO_TOOL_IDS`, calling `flow-runner.ts` directly with the project's
    brand and the shot range rendered to a clip as the `video` param. It is
    a second tool beside the shared registry's `run_flow`; both call the
    same runner.
12. **Presets may reference a flow later.** `StudioPreset.workflow` keeps
    its `{ flowId }` reserve comment (W5); W8 builds nothing on it.
13. **The W9 web-page tools stay agent-only in V1** (no `ports`); the
    `web-page` artifact kind is not a port type. A flow that wants a page
    can use a `run_agent` node with the web designer.
14. **`invokeTool` is created in Stage 1** (§11 rule): one function in
    `src/main/services/agents/tools/invoke-tool.ts` that validates args,
    runs the handler with the context, and owns the usage `featureSource`;
    the agents' `tool-server.ts` is rerouted through it in the same stage so
    the two runners cannot drift.

Build rules for the unattended run (from the W8 brief): one fresh-context
subagent per stage; commits by explicit pathspec only (never stash, never
`add -A`, never `commit --only`; messages via a file + `git commit -F`);
`check:types` at baseline (web 26 / node 10); `npx vitest run` green (2035 at
the start); `electron-vite build --outDir .vidtsx-temp/w8-build`; an outcome
subsection per stage below; a byte-safe Status.md entry per stage; the app
driven on the second instance (CDP 9223 / inspector 9229, the W3 profile).
Files another session has dirty (`src/main/services/studio/export-engines/`,
`src/main/ipc/render-handlers.ts`, the render-queue context,
`src/main/index.ts`, `resources/vendor`, `scripts/bench`,
`docs/ui-automation-cdp.md`) are never touched. Spend cap for the acceptance
runs: $30. No ElevenLabs key exists on this machine, so audio nodes are
verified through the engine's `registerInstance` seam only.

## 1. Target design

### 1.1 The flow document

`FlowDoc` (`src/shared/types/flows.ts`) replaces the bare `GraphJson` stored
in `graph_json` today. Existing rows migrate on first load (Stage 0).

```jsonc
{
  "formatVersion": 2,
  "id": "01J...",                       // ulid, or "<ns>/<name>" for packaged
  "name": "30-second explainer",
  "description": "Topic → script → composition → rendered MP4.",
  "params": [                           // the run form, in order
    { "id": "topic", "label": "Topic", "kind": "prompt", "required": true,
      "bind": [{ "nodeId": "n-script", "key": "prompt" }] },
    { "id": "style", "label": "Style", "kind": "select",
      "options": ["Clean", "Bold", "Playful"], "default": "Clean",
      "bind": [{ "nodeId": "n-compose", "key": "stylePreset" }] },
    { "id": "product", "label": "Product image", "kind": "image",
      "bind": [{ "nodeId": "n-input-image", "key": "image" }] }
  ],
  "graph": {
    "nodes": [
      { "id": "n-script", "toolId": "generate_text",
        "position": { "x": 80, "y": 80 },
        "config": { "providerId": "", "model": "", "modelMode": "default",
                    "systemPrompt": "…tuned…" },   // modelMode: required | preferred | default
        "pause": false },
      { "id": "n-compose", "toolId": "generate_composition",
        "position": { "x": 480, "y": 80 },
        "config": { "seconds": 30, "aspect": "16:9", "stylePreset": "Clean",
                    "brandId": null },           // per-node brand (updated 2026-09-10): absent = run-level
        "pause": true },
      { "id": "n-render", "toolId": "render_composition",
        "position": { "x": 880, "y": 80 }, "config": {}, "pause": false }
    ],
    "edges": [
      { "id": "e1", "source": "n-script", "sourceHandle": "text",
        "target": "n-compose", "targetHandle": "brief" },
      { "id": "e2", "source": "n-compose", "sourceHandle": "composition",
        "target": "n-render", "targetHandle": "composition" }
    ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "outputs": [{ "nodeId": "n-render", "handle": "video", "label": "Video" }],
  "origin": null                         // or { agentId, sessionId, artifactId } when frozen
}
// run.json (not the doc) carries the run-level brandId (updated 2026-09-10, §0.1 item 9).
```

Rules: a `params[].bind` target must be a config key of that node; a config
key bound to a param is locked in the canvas inspector (shown, not
editable there); `outputs` name what the run form shows large; everything
not exposed is fixed. Node ids are validated ulids or `n-[a-z0-9-]+`.

Migration from `GraphJson` v1: `typeId` → `toolId` through a fixed alias
table (`input-prompt` → `input_text`, `generate-image` → `generate_image`,
`generate-video` → `generate_video`, `generate-text` → `generate_text`,
`input-image-from-gallery` → `input_image_library`,
`input-image-upload` → `input_image_file`), `params` empty, `outputs` =
every sink node, `pause` false. The migration is pure and unit-tested.

### 1.2 Nodes are tools with ports

`src/main/services/agents/tools/registry.ts` (agents plan 1.3) gains an
optional `ports` block per tool. A tool without `ports` is agent-only. A
tool with `ports` is also a node.

```ts
interface ToolPorts {
  inputs: PortDef[];      // { id, label, dataType, required?, argKey }
  outputs: PortDef[];     // { id, label, dataType, from: 'artifact' | 'field:<name>' }
  configSchema: ConfigField[];   // the existing inspector field kinds
  defaultConfig: Record<string, unknown>;
  category: 'input' | 'text' | 'image' | 'video' | 'audio' | 'composition' | 'library' | 'agent';
}
type DataType = 'text' | 'image' | 'images' | 'video' | 'audio'
  | 'composition' | 'transcript' | 'number';
```

Port values are agent artifacts or primitives. `image` carries an
`image-set` artifact with one item; `images` carries any `image-set`;
`video`, `audio`, `composition`, `transcript` carry the artifact of that
kind; `text` and `number` are primitives. The runner builds the tool's
argument object from `argKey` bindings plus node config, calls the tool
handler exactly as the agent runner would (same `AgentToolContext`, each
tool's own content-safety check — audio prompts are not gated, W2b (updated
2026-09-10) — same usage logging with `featureSource: 'flows'`), and maps
the returned artifact or field to the output ports.

The renderer never holds handlers. It fetches serialisable `NodeSpec`s
(`FLOWS_NODES_LIST`): id, label, description, category, ports,
`configSchema`, `defaultConfig`, `needs` (capability gate, shown as a
warning chip on the node when unmet). `src/features/flows/nodes/*` is
deleted; the six current node files become tool entries in
`src/main/services/agents/tools/` (three of them, the inputs, are
main-side resolvers: `input_text`, `input_image_library`,
`input_image_file`, which read the value from params or config and return
an artifact reference).

Wave-1 node catalogue:

| toolId | ports in → out | source |
|---|---|---|
| `input_text` | — → text | new, trivial |
| `input_image_library` | — → image | new, reads Library entry id |
| `input_image_file` | — → image | new, imports a file into the run workspace |
| `input_video_file` | — → video | new, imports a file (or Library video) |
| `generate_text` | text → text | LLM via `runLlmGenerate` |
| `generate_image` | text, image?, images? → image | agents `generate_image` |
| `generate_video` | text, image?, image? → video | the registered main tool (video providers plan Stage 5); only the renderer node retires (updated 2026-09-10) |
| `generate_composition` | text (brief), image?, video? → composition | agents plan wave-1 tool |
| `edit_composition` | composition, text → composition | agents plan wave-1 tool |
| `render_composition` | composition → video | agents plan wave-1 tool |
| `transcribe` | video or audio → transcript | `AUDIO_STT_TRANSCRIBE` service, AssemblyAI or whisper |
| `caption_video` | video, transcript → video | captions burn-in (Studio caption builder + ffmpeg) |
| `text_to_speech` | text → audio | `AUDIO_TTS_GENERATE` |
| `generate_audio` | text → audio | W2b `AudioGenerationEngine`, `kind: 'sfx' \| 'music'` (added 2026-09-10) |
| `extract_frame` | video, number → image | `TOOLS_FRAME_EXTRACT` service |
| `trim_video` / `concat_videos` | video, number, number → video / videos → video | ffmpeg wrappers |
| `save_to_library` | any artifact → same | Library import |
| `run_agent` | text (goal), any? → typed output | agent runner, bounded (1.6) |
| `run_flow` | agent-only tool, no ports | flow runner (1.5); in Studio sessions accepts a shot range as the `video` param |

Not nodes (updated 2026-09-10): `get_brand` stays agent-only — a
`generate_text` node opts into the brand summary through its `useBrand`
config (§0.1 item 9); `ask_user`, `list_artifacts`, `write_document`,
`propose_memory` and the four W9 web-page tools (`write_page`, `edit_page`,
`capture_page`, `export_site`) carry no `ports` in V1.

### 1.3 The runner (main)

`src/main/services/flows/flow-runner.ts`. One run is a job:

```
<assetsRoot>/flows/<flowId>/runs/<runId>/
    run.json        { id, flowId, flowVersion, mode: 'attended' | 'unattended',
                      params, status, startedAt, finishedAt, error,
                      nodes: { [nodeId]: { status, outputs?, error?, durationMs, attempts } } }
    artifacts.json  agent artifact store (same file shape as agent sessions)
    files/...       everything tools wrote
```

Steps per run: validate the doc (unknown tool, unmet capability gate,
unbound required input, cycle), topo-sort, then for each node build args,
call the handler with the run's `AgentToolContext`, store outputs, emit
`FlowRunEvent` (`node-status`, `run-status`, `pause-request`) on
`FLOWS_RUN_EVENT`. Node outputs persist after every node so a crash or app
restart leaves a resumable run: "Resume" reruns from the first node that is
not `done`. Cancel aborts the in-flight handler through `signal` (fal jobs
are abandoned as today; render jobs are cancelled through the queue).

Pause: after a node marked `pause` completes in `attended` mode, the runner
creates an `InteractionRequest` through the agents' interaction broker
(pick for `images`, approve for a single artifact, editable approve for
`text`) and awaits the reply. Reply `accept` continues with the chosen
value substituted on the output port. Reply `reject` with `retry` reruns
that node once with the user's note appended to its prompt-shaped config
key if it has one; a second reject stops the run as `cancelled`. Pending
requests survive restart as "expired" and the run can be resumed from that
node. Runs launched by `run_flow` are always `unattended`.

Concurrency: one run per flow at a time; runs across flows are independent
but share the provider pools and the render queue.

Retention: last 20 runs per flow, oldest pruned with their folders, same
cap as today. `FlowRunRecord` in SQLite keeps the summary row for the
history dropdown; the folder holds the artifacts.

### 1.4 The run form

`RunFormView` renders `params` in order with the existing inspector field
components (`TextField`, `PromptField`, `NumberField`, `SelectField`,
`ImageUploadField`, `GalleryImagePickerField`) plus a new `VideoPickField`.
Below the fields: mode switch (checkpoints on or off, hidden when no node
has `pause`), Run, Cancel, Resume. The right side shows `outputs` large
using the agents' viewer registry (video, image-set, document,
composition) with the same action bar (save to Library, open in Creator,
open in Studio, open folder). Earlier nodes' outputs sit in a collapsible
"steps" strip so a user can inspect intermediate results without opening
the canvas. Pause cards render in the same right pane, exactly as
interactions render in the agent stage.

The form needs no per-flow code: field kinds come from `params[].kind`,
which is the `ConfigField` kind set plus `image` and `video`.

### 1.5 `run_flow` (agent tool) and freezing

`run_flow({ flowId, params })` starts an unattended run, streams progress
into the agent session as tool-progress events, and returns the flow's
`outputs` as artifacts added to the agent's session store (copied into the
session workspace, never linked). A flow that needs a capability the
session lacks fails fast with the same message the UI would show. The
tool description sent to the model lists the installed flows with their
`params` schema, cached per session; the list is short and stable so it is
prompt-cache friendly.

**Freeze** (`freeze_session_to_flow`, invoked by the user from the agent
stage action bar on any artifact, or by the agent when asked):

1. Walk lineage from the chosen artifact backwards through
   `producer.callId` → that call's arguments → every artifact id in those
   arguments → their producers, until inputs are reached. Tool calls that
   are not on this path (dead ends, rejected picks, retries) are dropped.
2. Each call on the path becomes a node with `toolId` = the tool id and
   `config` = the call's literal arguments that are not artifacts. Artifact
   arguments become edges. Calls to tools without `ports` (`ask_user`,
   `list_artifacts`, Studio-only tools) are elided; a `write_document` on
   the path becomes an `input_text` node holding its content.
3. Arguments whose value came from intake answers or a `pick` reply are
   detected by value match against the session's interaction log and become
   `params` with the intake field's label and kind. Everything else stays
   locked.
4. The runner passes the draft `FlowDoc` to the agent with a `save_flow`
   tool whose schema allows only `name`, `description`, `params[].label`,
   `params[].id`, the set of node config keys to promote to params, and
   `pause` flags. The agent cannot add, remove, or rewire nodes.
5. The result opens on the canvas as a proposal ("Frozen from session X",
   accept or discard). Accept writes the flow with `origin` set.

Convention for the built-in agents so their sessions freeze cleanly: every
transformation goes through a tool, text edits go through `generate_text`
with an explicit instruction, and the model never rewrites an artifact by
pasting it into the chat. This is a prompt rule in `AGENT.md`, checked by
the Motion Post end-to-end run in the agents plan.

### 1.6 Agents inside flows: the agent node and the Flow Builder

`run_agent` node: config = goal prompt, agent id (a built-in or installed
agent), tool allowlist (a subset of that agent's manifest tools), max
turns, output type. The runner starts an unattended agent session whose
context block carries the input ports as artifacts, and takes the last
artifact of the requested kind as the output port. This node is the only
non-deterministic step a flow can contain and the canvas marks it as such.
It requires an `agent-sdk` provider.

`vidtsx/flow-builder` built-in agent (`resources/agents/vidtsx/flow-builder/`):
tools `list_nodes`, `read_flow`, `propose_flow` (full doc or a JSON patch),
`run_flow`, `read_run`. `propose_flow` never writes: it emits a proposal
event, the canvas shows the diff (added nodes green, removed red, changed
config highlighted), and Accept applies it through the ordinary save path.
One proposal per turn, as with Studio cuts. This agent is offered in a
side panel on the canvas ("Ask the builder") and is optional; the canvas
is complete without it.

### 1.7 Packaging and bundled flows

`.vidtsxflow` = zip: `flow.json` (the `FlowDoc` plus `author`, `version`,
`minAppVersion`, `requires: { tools[], capabilities[] }`, `files[]`),
optional `assets/` (reference images, exemplar frames), optional
`icon.png`, optional `signature.json`. Reader, validator, install, update,
signing, and file association are the agents' Stage 2 code parameterised
by manifest name; `requires.tools` is checked against the registry the
same way `tools[]` is for agents. Installed flows live at
`<userData>/flows/<ns>/<name>/`; built-ins at `<resources>/flows/<ns>/<name>/`;
user-authored flows stay in SQLite until exported.

Agent packages may include `flows/<name>/flow.json`; those install with the
agent and are removed with it, and appear in the Flows list under the
agent's name.

Built-in flows shipped in the first release (each replaces or extends a
Tools hub screen):

| flow | replaces | nodes |
|---|---|---|
| `vidtsx/thumbnail` | Thumbnail Generator | input_text → generate_text (the existing `thumbnail-system-prompt`) → generate_image |
| `vidtsx/explainer-30s` | new | input_text → generate_text → generate_composition (pause) → render_composition |
| `vidtsx/product-ad` | new | input_image_file + input_text → generate_image ×3 (pause, pick) → generate_video → generate_composition → render_composition |
| `vidtsx/add-effect` | new | input_video_file → extract_frame → generate_image → generate_video (first frame) |
| `vidtsx/frame-strip` | Frame Extractor | input_video_file → extract_frame (batch) |

The tester screens (image, LLM, voice, embedding, moderation) are developer
tools and stay as screens.

### 1.8 UI

**Flows page** (`FlowsScreen`, rework): a list with three groups, My flows,
Built-in, Installed, plus New, Import, and the same card menu as agents
(Run, Edit, Details, Export, Remove; built-ins are read-only, Duplicate
makes an editable copy). Opening a flow lands on **Run** (1.4). A segmented
control switches to **Edit** (the existing canvas, `FlowCanvas` and
`NodeInspector`, with `params` binding controls added to the inspector:
"Expose as parameter" per field, and the `pause` tick per node). The run
history dropdown stays. Node palette groups by the registry `category`.

Shared pieces live outside both features so the isolation rule holds:
interaction cards and artifact viewers ALREADY live at
`src/renderer/components/interactions/` and
`src/renderer/components/artifact-viewers/` (done by the agents plan and W7;
updated 2026-09-10), and the shared chat, `BrandSelect` and the agent hooks
at `src/renderer/components/agents/` and `src/renderer/hooks/agents/` (W7).
The one move still pending is the inspector field components to
`src/renderer/components/fields/`, in Stage 2.

**Handoffs from other screens:** "Run a flow on this" appears on Library
videos and images, and on a Video Studio entry, opening the run form with
the matching `image` or `video` param prefilled.

## 2. What exists and gets reused

| Need | Reuse | File |
|---|---|---|
| Canvas, node UI, inspector, palette, run controls | as is, inspector gains bind + pause | `src/features/flows/components/*` |
| Inspector field components | moved to shared, as is | `src/features/flows/components/inspector-fields/*` |
| Topo sort and validation | moved to main, as is | `src/features/flows/services/topo-sort.ts` |
| Graph thumbnail | as is | `src/features/flows/services/render-graph-thumbnail.ts` |
| Flow and run SQLite store | schema gains `doc_version`, `origin`, `source` | `src/main/services/flows-projects-db.ts`, `flows-handlers.ts` |
| Video node body (submit, poll, save to Video Studio) | moved to a main tool | `src/features/flows/nodes/generate-video.ts` |
| Tool registry, runner context, artifact store, interaction broker | as is | agents plan Stage 1 |
| Viewers and interaction cards | as is, shared location | agents plan Stage 3 and 4 |
| Zip reader, validator, signing, install, updates | parameterised | agents plan Stage 2 |
| Composition, render, image tools | as is | agents plan wave-1 tools |
| STT, TTS, frame extraction, ffmpeg | wrapped as tools | existing main services |
| Thumbnail system prompt | becomes a built-in flow's locked config | `src/features/tools/hooks/thumbnail-system-prompt.ts` |
| Usage accounting | already has `'flows'` | `src/shared/types/ai-usage.ts` |
| Feature flag, nav entry | flip from env-gated to dev-preview | `feature-flags.ts`, `Sidebar.tsx` |

## 3. Stage 0 — Contracts and migration — ~½ session

Files:
- `src/shared/types/flows.ts`: `FlowDoc`, `FlowParam`, `FlowNode`,
  `FlowEdge`, `FlowOutput`, `FlowRunEvent`, `FlowRunMode`, `NodeSpec`,
  `ToolPorts`, `DataType` (moved from `nodes/types.ts`), `isPortCompatible`.
- `src/shared/flows/migrate-v1.ts`: `migrateGraphV1(graphJson): FlowDoc`,
  the alias table, pure.
- `src/shared/flows/validate.ts`: structural validation (ids, binds,
  outputs, cycles) without the registry; the runner adds registry checks.
- `src/shared/ipc/types/flows.ts` and channels: `FLOWS_NODES_LIST`,
  `FLOWS_RUN_START`, `FLOWS_RUN_CANCEL`, `FLOWS_RUN_RESUME`,
  `FLOWS_RUN_EVENT`, `FLOWS_RUN_REPLY` (pause replies, or reuse
  `AGENT_INTERACTION_REPLY` with a run-scoped id), `FLOWS_FREEZE`,
  `FLOWS_EXPORT`, `FLOWS_IMPORT`.
- `flows-projects-db.ts`: migrate rows on read, write v2 on save, keep the
  v1 column until every row has migrated.

Done when: `migrate-v1.test.ts` round-trips the three current templates and
a saved v1 flow with removed model ids; `validate.test.ts` covers bad bind,
cycle, unknown output; `check:types` at baseline.

#### Stage 0 outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything §3 lists is built, unit-tested, committed by pathspec
(`c2edda9`, 18 files, beside the export-engines session's dirty tree) and
exercised on the second dev instance. `check:types` at baseline (web 26,
node 10); 2064 tests passing, up from 2035 (29 new: 14 migration, 8
validation, 6 db, plus the template count); `electron-vite build --outDir
.vidtsx-temp/w8-build` passes (12 m 6 s — it ran beside the suite and
`tsc`; the same three things run one at a time are 41 s / ~2 min / and a
normal build). Spend: $0, no provider call.

**The contracts** (`src/shared/types/flows.ts`, 263 lines). `FlowDoc` is
the §1.1 shape verbatim: `formatVersion: 2`, `id`, `name`, `description`,
`params[]` (`FlowParam` with `kind` = the inspector `ConfigField` kinds plus
`image` and `video`, `bind[]`, `options`, `default`, the field hints),
`graph` (`FlowNode` with `toolId`, `position`, `config`, `pause`; `FlowEdge`
with required string handles; `viewport`), `outputs[]`, `origin`. `DataType`
grew from four to the eight of §1.2; `PortDef` carries `argKey` (inputs) and
`from: 'artifact' | 'field:<name>'` (outputs); `ToolPorts` and `NodeSpec`
are flat (`inputs`, `outputs`, `configSchema`, `defaultConfig`, `category`,
`needs`, `priced`, `priceHint`, `nondeterministic`). The run side:
`FlowRunMode`, `FlowRunDoc` (the §1.3 `run.json` with run-level `brandId`,
`nodes[id] = { status, outputs?, error?, durationMs?, attempts }`,
`pending`), `FlowPortValue` (an artifact reference or a primitive — base64
never travels on a port, §11) and `FlowRunEvent` (`node-status`,
`run-status`, `pause-request` carrying the agents' `InteractionRequest`).
Decisions: the SQLite summary row keeps its existing IPC name
`FlowRunRecord`, so the run.json shape is `FlowRunDoc`; `FlowNodeConfig` is
a plain `Record<string, unknown>` with `brandId` and `modelMode` documented
rather than typed (a typed interface with optional keys is not assignable
from the canvas's record under strict mode); `needs` is `string[]` because
the agents side has no capability vocabulary to import; `FlowSource` is
`'user' | 'template' | 'frozen' | 'imported'` (built-ins and installed
flows live on disk, §1.7, never in the table).

**The migration** (`src/shared/flows/migrate-v1.ts`, pure). The alias
table of §1.1 both ways — `legacyTypeIdForToolId` exists because the canvas
still keys `NODE_REGISTRY` by the old ids until Stage 1. Ids: a ulid or
`n-[a-z0-9-]+`, matched case-INSENSITIVELY — the canvas mints `n-<ULID>` in
upper case and those must stay valid; an invalid id becomes `n-` + its
slug, `-2`, `-3`… when taken (the templates' `tpl-prompt` → `n-tpl-prompt`),
edges follow the first holder of a duplicated id, a dangling edge is
dropped, a null handle becomes `''` for the validator to name. `outputs` =
every sink with its primary handle from a small map keyed by tool id
(`generate_image` → `image`, …, unknown → `output`). A removed model id is
kept verbatim in `config` (§11). `parseFlowDoc(json, meta)` migrates a v1
graph, passes a v2 doc through (normalising `pause`, letting the row's
id/name/description win), and yields the empty doc for garbage.
`doc-graph.ts` holds `emptyFlowDoc`, `isFlowDocV2`, `deriveSinkOutputs`
and `withGraph` — the reconcile the canvas runs on every save (binds whose
node or config key is gone are dropped, outputs pruned then re-derived when
empty, `pause` carried by id).

**Validation** (`validate.ts`, no registry): 17 typed codes over doc id
(ulid or `<ns>/<name>`), node ids and duplicates, empty tool ids, edge
duplicates / missing ends / self loops / empty handles, param ids, kinds
and binds (`PARAM_BIND_KEY_MISSING` when the key is not in that node's
config), outputs, and `GRAPH_CYCLE` through the shared `topo-sort.ts`
(Kahn's, stable in node order, the cycle result names the nodes left;
the feature file re-exports it and keeps only the registry-aware
`validateGraph`). `requireNodes` is an option, so a new empty flow is a
valid document to save but not to run.

**IPC and store.** Ten channels appended (`flows:nodes:list`,
`flows:run:{start,cancel,resume,event,reply,get}`, `flows:freeze`,
`flows:export`, `flows:import`) with request/response types in
`src/shared/ipc/types/flows.ts`; `FlowsRunReplyRequest` wraps the agents'
`InteractionReply` with a `runId`, so Stage 2 can route through the broker
without a second reply shape. `FlowProjectSummary` gains `docVersion`,
`origin`, `source`; `FlowProjectCreateRequest` accepts `source` and
`origin`. `flows-projects-db.ts` adds the three columns by idempotent
`ALTER` (a pre-W8 table gets `doc_version 1`), rewrites every v1 row as a
FlowDoc inside one transaction at open, and every read parses again on the
way out; `graph_json` stays the column and now holds the v2 JSON — nothing
is dropped. Writes accept v1 or v2 and store v2 with the row's name folded
into the doc. The `flow_runs` half moved to `flows-runs-db.ts` (same
connection) to keep the file under 300 lines.

**The canvas.** `useFlowGraph` maps the doc to reactflow nodes
(`toolId` → legacy `typeId`) on load and back on save, keeping the doc on
a ref so `params`, `outputs`, `origin` and each node's `pause` survive a
canvas edit that never sees them. `nodes/types.ts` re-exports the shared
port types and adds colours for the four new data types; `CustomNode` the
labels. `NewFlowDialog` stamps `source: 'template'`. `FlowEditor`, the
thumbnail renderer and the legacy renderer runner are untouched — they
still work on the canvas shape, which is what Stage 1 replaces.

**Verification in the app** (second instance, `VITE_FF_FLOWS=1` in the
launch environment, W3 profile). The profile's `flows-projects.db` was the
pre-W8 table (created Sep 9, zero rows); after open it carries
`doc_version`, `origin`, `source`. Create from "Gallery image variation"
→ 3 nodes / 2 edges on the canvas; drag node 0 by (60, 40) → the stored
row reads `doc_version 2`, `formatVersion 2`, tool ids
`input_image_library` / `input_text` / `generate_image`, ids
`n-tpl-gallery` / `n-tpl-prompt` / `n-tpl-generate`, the moved node at
(140, 120) — the template's (80, 80) plus the drag, so the save wrote v2 —
`outputs` = the generate node's `image`, `params` empty; back → the card
lists it; reopen → 3 / 2 again; `.vidtsx-temp/w8/stage0-canvas.png`. The
row was created through the migration path because the dialog sends v1
template JSON; a saved-before-W8 row was migrated in the unit test
(`flows-projects-db.test.ts`, real SQL through node:sqlite), not live —
the profile had none.

**Left for Stage 1.** `FLOWS_*` handlers, preload methods and
`electron.d.ts` entries (none added — Stage 0 is names and types);
`NodeSpec`s from the registry; the doc's `id` for packaged flows is
validated but nothing reads `<ns>/<name>` yet; `withGraph` re-derives
outputs from a tool-id map that Stage 1 should replace with the registry's
first output port; `FlowRunDoc.flowVersion` is a string (the flow's
`updatedAt` or package version) — the runner decides which. Driver
lessons: `vidtsx:navigate` to `flows` left Home on screen this time —
clicking the sidebar entry works; `.group.relative` matches the sidebar
buttons too, so a card query must add `.cursor-pointer` and a header
button query must exclude `aside`; running the full suite, `tsc` and the
build at once produced 9 contention timeouts that vanished alone (41 s).

## 4. Stage 1 — Registry ports and the main runner — ~1.5 sessions

Depends on agents Stage 1 (done 2026-09-07; updated 2026-09-10).

Files:
- `registry.ts`: `ports` field, `listNodeSpecs()`, `getNode(toolId)`.
- `src/main/services/agents/tools/{input-text, input-image-library,
  input-image-file, input-video-file, generate-text, generate-video}.ts`.
  `generate_image` gains ports on the existing tool.
- `src/main/services/flows/flow-runner.ts`, `flow-run-store.ts`,
  `flow-args.ts` (ports → handler args, outputs → ports).
- `src/main/ipc/flows-handlers.ts`: run start, cancel, resume, event relay.
- `src/preload/api/flows.ts` additions; `electron.d.ts`.
- Renderer: `useFlowRun` rewritten over IPC events; `run-flow.ts` and
  `nodes/*` deleted; `NodePalette` and `CustomNode` read `NodeSpec`s from
  `useNodeSpecs()`.

Steps: registry ports and specs with tests; runner with a fake registry
(order, arg building, persistence after each node, cancel, resume from the
first non-done node); the six migrated nodes; the canvas on the new specs.

Done when: the three current templates run end to end from the canvas
through main, run history shows the same statuses as before, and closing
and reopening the app mid-run offers Resume.

#### Stage 1 outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything §4 lists is built, unit-tested, committed by pathspec in four
commits (`7d4924b` invokeTool + the tool-server reroute, `92d710c` ports +
NodeSpecs + the five new tools, `5b0f3a6` runner + run store + IPC + the
canvas, `578b946` two fixes the live run found) beside the export-engines
session's dirty tree, and exercised on the second dev instance. `check:types`
at baseline (web 26, node 10); 2104 tests passing, up from 2064 (40 new:
6 invokeTool, 5 registry ports, 8 inputs, 8 generate_text + binding, 2
port-media, 6 flow-args, 6 runner, minus one migrate assertion replaced);
`electron-vite build --outDir .vidtsx-temp/w8-build` passes (2 m 40 s,
alone). Spend: $0 — the W3 profile's default image provider is the
Antigravity bridge (`gemini-cli` / `nano-banana-2`), and every one of the
four image calls logged as `featureSource: 'flows'` at $0 (19–21 s each).
No video call was made; `generate_video` has ports, a price hint and unit
tests only.

**invokeTool** (`src/main/services/agents/tools/invoke-tool.ts`, §0.1 item
14, §11). One function: `z.object(def.schema).safeParse` (unknown keys are
stripped, which is what lets node config carry keys a tool does not name),
the `needs` gate when the caller passes capabilities (the runner does; the
tool server does not — the system prompt already told the model, §1.8),
`featureSource` stamped on the context, a throwing handler turned into an
`isError` result. The tool server calls it and nothing else changed there —
`tool-server.test.ts` is untouched and green. `AgentToolContext` gained
`featureSource`, `AgentToolResult` gained `fields` (what a `field:<name>`
output port reads), `AgentToolDef` gained `ports?: AgentToolPorts` (the
shared `ToolPorts` plus `label`, `priced`, `priceHint()`,
`nondeterministic`). `generate_image`, `generate_video`,
`generate_composition` and `generate_text` read `ctx.featureSource` and pass
`agentId` only on the agent path; `buildAgentTsxDeps` takes the source as a
fourth argument.

**Ports and specs** (`registry.ts`). `getNode(toolId)` returns a tool only
when it carries ports; `listNodeSpecs(capabilities)` serialises id, label,
description, category, ports, configSchema, defaultConfig, `needs` plus a
new `available: boolean` on `NodeSpec` (false when the gate is unmet at
list time — the chip's signal, since a spec has no capability vocabulary of
its own), `priced` and `priceHint` (read at list time: `generate_video`'s
is every fal model with a `pricePerSecondUsd`). Ten nodes: the composition
trio (§0.1 item 7: `brief` → composition, with `image` / `video` ports
declared as context only — a value on them is named in the brief, because
no convention exists yet for a composition to load library media; that is
Stage 3's), `generate_image` (prompt, source, references → image; the
schema gained `sourceImage` / `referenceImages` as image-set artifact ids,
`providerId`, `model`, `width` / `height`, and a per-node `brandId` where
`null` opts out and absent inherits, §0.1 item 9), `generate_video`
(prompt, first frame, last frame → video; the schema now also takes the
inspector's string shapes — `"5"`, `"on"` / `"off"`, `""` — so a migrated
node validates as stored), and the five new tools. `generateImageAsset`
grew additively: provider / model selection, explicit size, base64 source
and references, the operation derived from what is present.

**The five tools.** `input_text` emits a `text` field; its config key is
`prompt` — the v1 `input-prompt` key — so migrated rows and the templates
run without a config rename (decided after the live run refused the first
template: the tool had said `text`, invokeTool stripped the config, and the
node reported "invalid arguments"). `input_image_library` (Image Studio
entry id), `input_image_file` (the inspector's downscaled base64, or an
absolute path from a future `image` param) and `input_video_file` (absolute
path or Video Studio entry id, probed with ffprobe) COPY the file into the
run's library folder under `inputs/`, index it as `imported`, and return a
one-item `image-set` or a `video` artifact — never a link, so a run stands
after the gallery entry or the picked file is gone; `port-media.ts` holds
the copy, the artifact-id → library-file resolution and a PNG/JPEG header
reader. `generate_text` runs `runLlmGenerate` with decision 12's modes
(`llm-model-binding.ts`: `required` refuses with a message naming the
model and provider when the provider is not usable per
`filterUsableLlmProviders`, `preferred` falls back to the app default and
writes a note into the node's run log, `default` ignores the binding; a
model id the catalog does not know passes through — the "Custom…" hatch)
and `useBrand`, which prepends `formatBrandSummary` — the same text
`get_brand` returns — to the system prompt. Their tests use fake services
through `vi.mock` and two small seams (`setImageLibraryLookupForTests`,
`setVideoInputDepsForTests`).

**The runner** (`src/main/services/flows/`). `flow-validate.ts` runs the
structural gate, then unknown tool, unmet `needs` (the invokeTool message),
an edge on a handle the tool lacks or between incompatible types, and a
required input fed by no edge, no bound param and no non-empty config
value; then the topo order. `flow-args.ts`: config, then bound params, then
edge values (an `images` port collects every incoming edge; a port value
is the artifact id or the primitive, base64 never, §11), and `mapOutputs`
puts the filed artifact on `artifact` ports and `result.fields` on
`field:` ports. `flow-runner.ts` validates, writes the first `run.json`,
executes in the background and per node: `running` (attempts + 1), args,
`invokeTool` with a run-scoped context (`sessionId` = run id, `agentId`
`flow:<flowId>`, `callId` `<run>:<node>:<attempt>`, `workspaceDir` =
`<run>/files`, the run's brand and library folder, `featureSource:
'flows'`, progress lines into the node's new `notes` — `FlowNodeRunState`
gained the field), the draft filed through `AgentArtifactStore.add`, a
`job` settled, outputs mapped, `done`; `run.json` and the summary row are
written after every one of those transitions; `node-status` / `run-status`
events go out on every change. An error result marks the node `error`,
the rest `skipped`, the run `error` with the tool's text; cancel aborts
through the signal (the in-flight node ends `skipped`, so Resume reruns
it); Resume resets every non-done node to `idle`, keeps done nodes'
outputs in the map, and walks the order again — the test shows only the
failed node rerunning with its prompt read from the persisted outputs. One
run per flow at a time. `flow-jobs.ts` settles video jobs in main by
subscribing to the engine and re-driving the agents' idempotent
`reconcileVideoJob`, cancelling the provider job on abort; a render job
refuses with a message naming Stage 3 (the queue lives in the renderer).
`flow-run-store.ts`: `<assets>/flows/<flowId>/runs/<runId>/{run.json,
artifacts.json, files/}`, atomic writes, the summary row (`persistRun` is
now `INSERT OR REPLACE`), and folders pruned to the 20 rows the table
keeps. `flow-service.ts` wires the one runner to the real registry,
capabilities, invokeTool and store, resolves the run-level brand (absent =
`getDefaultBrandId()`, `null` = none — the W4 semantics), files a run's
media under `flows/<flow-slug>` in the library, and in `get` marks a run
the app closed on as `error` with an "interrupted" message and
`resumable: true`. IPC: `flows-run-handlers.ts` (nodes list, run start /
cancel / resume / get, every body in try/catch), `registrations/flows.ts`
relays `FLOWS_RUN_EVENT` to every webContents; preload + `electron.d.ts`;
`FlowsRunGetResponse` gained `artifacts`, `assetUrls` (artifact id →
servable urls) and `resumable`.

**The canvas.** `useNodeSpecs` fetches once and provides; `useFlowGraph`
keeps `{ toolId, config }` on the reactflow nodes and derives sink outputs
from the registry's first output port (`withGraph` / `deriveSinkOutputs`
take a resolver now; the Stage 0 tool-id map is gone, and `migrate-v1`
keeps the six legacy handles as `legacyPrimaryHandle` for the pure
migration; `legacyTypeIdForToolId` is deleted); `useFlowRun` starts,
cancels, resumes and hydrates over IPC and folds the event stream in;
`CustomNode`, `NodeInspector`, `NodePalette` (grouped by category, gated
nodes listed with a chip, never filtered — §11) and `FlowCanvas` read
specs; previews come from the run's asset urls; `RunControls` shows
Resume; `FlowEditor` hydrates the latest run on open. Deleted: `nodes/*`,
`services/run-flow.ts`, `services/topo-sort.ts`. The thumbnail takes a
category resolver and guesses from the id for a template tile.

**Verification in the app** (second instance, `VITE_FF_FLOWS=1`, W3
profile, `.vidtsx-temp/w8/w8-flows.mjs` extended with `seed-image`,
`set-config`, `doc`, `run`, `run-nowait`, `resume`, `cancel`, `runs`,
`run-get`, `nodes`). `FLOWS_NODES_LIST` returned the ten specs with
`available: true` on the two gated ones. Two gallery entries were seeded
from a canvas (no provider call). "Prompt to image" → 2 nodes / 1 edge,
Run → `success` in 27.4 s, the fox visible in the node preview
(`stage1-prompt-image.png`), `run.json` with both nodes `done` and the
image-set at `flows/s1-prompt/…png`. "Reference style transfer" → 4 / 3,
the two seeded gradients on the reference ports, `success` in 21.5 s, three
previews, the lighthouse in the gradients' palette
(`stage1-style-transfer.png`). "Gallery image variation" → 3 / 2, first
run `error` in 0.2 s: the provider itself refused image-to-image ("Nano
Banana 2 does not support image-to-image here — attach the source as a
reference image instead"), the node showed the error, Resume was offered
(`stage1-gallery-variation.png`); after the fix in `578b946` (a source on
a model whose list has no image-to-image route goes in as the one
reference — checked before the call and again after a failed one, because
the gemini-cli provider lists no models until its first status check,
which the call performs) Resume finished the same run in 18 s with two
previews. Kill mid-run: "Prompt to image" was started, killed 6 s in while
`generate_image` ran, relaunched; opening the flow hydrated the latest run
as `error` "The app closed while this run was in progress — Resume
continues from the first unfinished step", Text `done`, Generate Image
`SKIPPED`, Resume offered (`stage1-interrupted.png`); Resume finished it in
31 s (`stage1-resumed.png`), and the history dropdown lists both runs with
their statuses. Usage rows produced: four × `gemini-cli` /
`nano-banana-2` / `image` / `flows` / $0.

**Deviations, and what it leaves.** (1) The composition trio's `image` /
`video` ports are declared but only named in the brief (above). (2)
Render jobs inside a flow fail with a clear message until Stage 3 builds
the renderer-queue bridge; video jobs settle. (3) Pause is a marked seam
in `flow-runner.ts`, not honoured — a `pause` flag runs through (Stage 2).
(4) Per-node `brandId` is a plain text field in the inspector; the shared
`BrandSelect` and `ModelSelect` (§0.1 item 10) are Stage 2's. (5) The run's
library folder is `flows/<flow-slug>` for every run of a flow, files
suffixed `-2`, `-3` — a per-run folder was rejected as twenty folders per
flow in Assets. (6) The run store and the library share `<userData>/assets`
on this profile, so `flows/<ulid>/runs/…/files` sits beside
`flows/<slug>`; the library scan mints entries only for media, and `files/`
holds work files, but Stage 6 should decide whether runs move under
`<userData>/flow-runs`. (7) `input_video_file` has text fields for a path
or an entry id; the `VideoPickField` is Stage 2's. (8) `AiFeatureSource`
already had `'flows'`; no `agentId` is stamped on flow rows. Driver
lessons: `Page.captureScreenshot` hung twice on the Flows editor after a
run (the 15 s timeout wrapper returned, the driver exited 1 — the capture
before a run and after a relaunch worked); the `vidtsx:navigate` event
again left Home up, the sidebar click works; the app path must be reset
after every relaunch (`w8-apppath.mjs`), or `resources/` resolves nowhere;
`set-config` patches the stored doc from the LIST screen because the open
editor's debounced save would win otherwise.

## 5. Stage 2 — Pause, run form, Flows page — ~1.5 sessions

Depends on agents Stage 4 (interactions) for the cards (done 2026-09-08; updated 2026-09-10).

Files: `RunFormView.tsx`, `RunOutputs.tsx`, `StepsStrip.tsx`,
`ModeSwitch.tsx`, `VideoPickField.tsx`; inspector additions
`ExposeParamToggle.tsx`, `PauseToggle.tsx`; `FlowsScreen` list groups and
the Run / Edit segmented control; runner pause path through the broker;
shared moves listed in 1.8.

Done when: a flow with two params and one paused node runs from the form,
pauses with a pick card, continues with the chosen image, and shows the
video output with the action bar; unattended mode skips the pause.

#### Stage 2 outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything §5 lists is built, unit-tested, committed by pathspec in four
commits (`b9d3aa6` the pure moves, `a7b87db` checkpoints through the
broker, `99a57eb` the run form, the Flows page and the inspector
additions, plus the docs commit) beside the export-engines session's dirty
tree, and exercised on the second dev instance. `check:types` at baseline
(web 26, node 10); 2132 tests passing, up from 2104 (28 new: 8 runner
checkpoint paths, 5 planner / accept / retry-note, 6 reply interpreter, 7
params ↔ bind, 2 priced steps); `electron-vite build --outDir
.vidtsx-temp/w8-build` passes
(1 m 52 s, alone). Spend: $0 — every image call went to the W3 profile's
Antigravity bridge (`gemini-cli` / `nano-banana-2`); 12 usage rows logged
as `featureSource: 'flows'`, `requestType: 'image'`, `costUsd: 0` (16 with
Stage 1's four). No video, LLM or audio call was made.

**Shared moves** (`b9d3aa6`). The ten inspector field components moved to
`src/renderer/components/fields/` with `downscale-image.ts` beside the
upload field; `NodeInspector` imports them from there and the Flows feature
re-exports nothing. The agents stage's `ActionBar` moved to
`src/renderer/components/artifact-viewers/ActionBar.tsx`, beside the viewer
registry it belongs with, so the run form shows the same bar without
importing from the agents feature (`ArtifactStage.tsx` changed one import).
`LlmModelPickerField` was then rewritten (§0.1 item 10) on the shared
`ModelSelect` + `useModelPicker(providerId)` — the W1 catalog with user
overrides and "Custom…" as the free-text hatch — with a `modelMode` select
(default / preferred / required, decision 12) beside it that writes the
node's `modelMode` key; `VideoModelPickerField` / `VideoModelOptionsField`
already read the engine's catalog the way the Video Studio does and were
kept. Two new shared fields for the run form: `ImagePickField` (the native
file dialog → an absolute path, or the gallery picker when the param binds
to an `entryId`) and `VideoPickField` (file dialog, or a Video Studio entry
select); the renderer never sees bytes.

**Checkpoints** (`a7b87db`; `flow-pause.ts`, `flow-checkpoint.ts`,
`flow-node-exec.ts`, `flow-run-types.ts`, the runner rewritten at exactly
300 lines). After a node marked `pause` completes in an `attended` run the
runner posts an `InteractionRequest` through the agents' `InteractionBroker`
— one per run, `sessionId` = the run id, the request persisted into
`run.json.pending` — and waits for `FLOWS_RUN_REPLY` (`flowService.reply` →
`runner.reply`, which only accepts the request the broker holds; a stale
card gets a typed refusal). The card follows the OUTPUT rather than the
port type: an `image-set` with several items → `pick` (each item is filed
as its own one-item `image-set` in the run store, so the card previews by
artifact id and the chosen one is already a port value), one artifact →
`approve`, text or a number → an editable `form` (prefilled from the node's
output by the renderer). Accept substitutes the value on the primary port;
the first reject reruns the node once with the note appended to the BUILT
args' prompt-shaped key (the first `prompt` field, else `prompt`) — applied
to the args, not the config, because a prompt that arrives on an edge would
otherwise overwrite it; a second reject, the card's "Stop run" or a cancel
while paused ends the run `cancelled`. `run-status` goes `running → paused →
running`, `pause-request` / `pause-cleared` events bracket the card. A run
the app closes on at a checkpoint keeps the node `paused` WITH its outputs;
`flowService.get` marks it `error` with a typed "waited at a checkpoint"
message and `pending.expired`, and Resume asks again from that node without
rerunning it (the alternative — rerun — pays for the step twice). `ctx.ask`
is real inside an attended run (a tool's question takes the same path and
gets `answered` back) and refuses with a reason in an unattended one. The
reply conventions live in `src/shared/flows/pause-reply.ts` (the `$reject`
note key, the form's `text` field), read by main and written by the form.
To give a paused image node something to pick from, `generate_image` gained
`count` (1–4 variations, sequential calls so a cancel stops the next, one
image-set) with a "Variations" number field in its inspector.

**The run form** (`99a57eb`). `FlowWorkspace` hosts one loaded flow and one
run state under a Run | Edit segmented control; opening a card lands on
Run, the card menu's Edit (and a freshly created flow) on the canvas; the
history dropdown works from both, the Edit header keeps Stage 1's
`RunControls`. `RunFormView`: `params` in order through `ParamField` (kind →
the shared field; `image` / `video` pick file or library by the bind key;
model-picker kinds fall back to a text value), the shared `BrandSelect`
beside `ModeSwitch` (hidden when no node pauses; attended is the default
when one does), `PricedStepsLine` from `pricedSteps()` over the specs'
`priced` / `priceHint` (§0.1 item 6; `generate_image` is not marked priced,
so the acceptance flow shows no line — `generate_video` does), a needs chip
that blocks Run, Run / Cancel / Resume, and a `prefill` prop (§12 question
1). `RunOutputs`: the flow's `outputs` large through the shared viewer
registry via `useRunArtifactViewer` (run-scoped resolve), the shared
`ActionBar` via `useRunArtifactActions` (navigate + creator-open, as the
agents do), text outputs as panels, the `PauseCard` over the viewer with the
shared card (`cancelLabel="Stop run"` — an additive prop threaded through
`InteractionShell` and the three cards) plus the one control an agent card
lacks, a note and "Retry with note", and `StepsStrip` (collapsible, one tile
per node with status, thumbnail and pause tag; click shows that artifact).
Run-scoped IPC: `FLOWS_RUN_ARTIFACT_RESOLVE` / `FLOWS_RUN_ARTIFACT_ACTION`
(`flow-artifacts.ts`, `flows-artifact-handlers.ts`) reuse the agents'
resolve and `runArtifactAction` with the run's `files/` as the workspace —
`artifactFilesIn` / `ensureCompositionModuleIn` were added to
`artifact-paths.ts` and `workspaceDir` to `ArtifactActionInput`, both
additive. `ActionBar` now offers "Save to Library" on `video`, `image-set`
and `audio` too: the handler already answered for library-rooted media
("report where it is, open Assets"), so the button is the same first button
a document has. `FLOWS_IMPORT` / `FLOWS_EXPORT` are typed stubs (the import
opens the file dialog, then answers "arrives with Stage 6"). Inspector:
`PauseToggle` per node and `ExposeParamToggle` per exposable field
(`params.ts`: `bindTargetFor` maps `image-upload` → the tool's `filePath`
key and `gallery-image-picker` → `entryId`, both kind `image`; a text
`filePath` / `entryId` on a node whose primary output is `video` → kind
`video`); a bound field shows locked with the param id; `useFlowGraph`
gained `doc`, `exposeNodeParam`, `unexposeNodeParam`, `setPause` (doc-level
edits bump a `rev` the debounced save watches). Flows page: My flows /
Built-in / Installed groups (`groupFor` reads `source` forward-compatibly —
`builtin` / `installed` strings, or a `vidtsx/` id — and everything else is
the user's; the two groups say what fills them), New, Import, and the card
menu (Run, Edit, Details, Duplicate, Export, Remove; built-ins hide Edit and
Remove); `FlowDetailsDialog` shows source, steps, params, outputs, origin.

**Verification in the app** (second instance, `VITE_FF_FLOWS=1`, W3
profile, `.vidtsx-temp/w8/w8-flows.mjs` extended with `view`, `param`,
`param-select`, `mode`, `brand`, `run-form`, `wait-pause`, `wait-run`,
`reply pick|approve|text|reject|stop`, `action`, `step`, `menu`,
`select-node`, `expose`, `pause-node`, `set-doc`). "S2 pick" was created
from "Prompt to image", its doc patched from the list screen (the generate
node `count 3`, `pause`, a second `generate_image` fed by the first's
`image` on its `referenceImages` port with a fixed watercolor prompt, the
output = the second node). The two params were made through the inspector:
Edit → node 0 → Expose `prompt` → `prompt:bound`; node 1 (`pauseToggle:
on`) → Expose `count` → `count:bound`; the stored doc read `params:
[prompt, count]` with the field hints and `default: 3`
(`stage2-inspector-bound.png`). Run view listed both params, mode
`attended`, brand "Acme Test" (the library default). Attended run: the pick
card came up in 64 s with three fox variations side by side
(`stage2-pick-card.png`), steps `done / paused / idle`; Option 2 →
`image-set-3` substituted on the port, the watercolor node ran 23 s on it,
`success` in 131 s, the watercolor large with Save to Library / Open folder
/ Copy path (`stage2-output.png`); Save to Library navigated to Assets.
Unattended run (count 2, brand "No brand"): `success` in 89 s, no card, the
final node received the whole two-item set, `run.json` `mode: unattended`,
`brandId: null`. Reject path: attended run, "Retry with note" ("the fox
should face left and be smaller in frame") → the node reran (`running`) and
a second card came up with two new options that follow the note
(`stage2-retry-card.png`; `attempts 2, rejections 1` on disk). Restart
path: the app was killed on that card; `run.json` held `status: paused`,
the pending request and the node `paused` with its outputs; after relaunch
the form showed the typed error "The app closed while this run waited at a
checkpoint — Resume asks again from that step", `pending.expired: true`,
Resume offered; Resume raised a fresh card (`q-245330c1`, options
`image-set-7/8`) with `attempts` still 2 — no rerun — and Option 1 finished
the run `success` (`stage2-resumed-card.png`). Flows page: three groups
(`mine:5, builtin:0, installed:0`, `stage2-flows-page.png`); Details showed
"3 nodes, 2 edges · 1 checkpoint(s) / Text (prompt), Variations (1–4)
(number) / Watercolor"; Duplicate made "S2 pick (copy)" with both params
and the pause, `source: user`; Export and Import answered the Stage 6
message; Remove (through `window.confirm`) deleted the copy. The first
pick-card screenshot showed the card's footer below the fold; fixed in the
same commit (a definite-height column so the shared card's `max-h-full`
resolves) and confirmed on the retry card.

**Deviations, and what it leaves.** (1) The card kind follows the output
artifact, not the port type: no wave-1 node has an `images` OUTPUT port,
so "pick for `images`" was read as "pick when the output holds several
images" — which `generate_image`'s new `count` provides and Stage 3's
`product-ad` (three variations, pick) will use. (2) Resume after an expired
checkpoint re-asks rather than reruns (above). (3) `save-to-library` on
media kinds is a report-and-navigate, not a copy — labelled as the handler
behaves. (4) Sizes on the acceptance cards read 1024×1024 despite `width /
height 768` in config: the Antigravity image provider ignores the size;
not a flows bug. (5) The `send-to-queue` action on a run's composition
answers "arrives with Stage 3" (the queue lives in the renderer). (6) The
web-page artifact kind resolves to a typed refusal in a run (§0.1 item
13). (7) The Library / Video Studio "Run a flow on this" handoffs are
Stage 6's; `FlowWorkspace.prefill` and `RunFormView.prefill` are ready for
them. (8) `input_video_file` and `input_image_file` keep their inspector
fields; the run form reaches them only through an exposed param. Driver
lessons: the run form has no `[data-run-status]` badge (that is the Edit
header's), so the driver reads `[data-run-form-status]`; a renderer edit
hot-reloads to Home while a main-side run keeps going; `window.confirm`
blocks `Runtime.evaluate` and `Page.enable` — answer it with
`Page.handleJavaScriptDialog` WITHOUT `Page.enable` (`w8-dialog.mjs`), and
never send OS keystrokes to unblock it (a broad `SendKeys` loop reached
other windows once this session); a syntax error inside `eval` leaves the
driver hanging on the next command, so kill drivers by command line before
reconnecting; `Page.captureScreenshot` hung twice after the relaunch, the
15 s wrapper returned and the run continued.

## 6. Stage 3 — Product nodes — ~1.5 sessions

Files: `tools/{generate-composition, edit-composition, render-composition}`
gain ports (the handlers already exist from the agents plan);
new `tools/{transcribe, caption-video, text-to-speech, extract-frame,
trim-video, concat-videos, save-to-library}.ts` wrapping the existing
services; `generate_audio` gains ports on the existing W2b tool (updated
2026-09-10, §0.1 item 8); ffmpeg helpers in `src/main/services/media/` if
not already present.

Tests: each tool with a fake service; the runner over a five-node
composition flow with a fake render queue.

Done when: `vidtsx/explainer-30s` runs brief to MP4 unattended on
`claude-subscription` and on one baseURL preset.

#### Stage 3 outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything §6 lists (as §0.1 items 7, 8 and 9 adjust it) is built,
unit-tested, committed by pathspec in four commits (`efe1ed8` the media
helpers, the seven product nodes and `generate_audio`'s ports; `4062256`
the composition trio inside a flow — the media convention, the main-side
render settle, brand on nodes; `b16ef0b` the five built-in fixtures;
`49e3303` two things the live runs found) plus the docs commit, beside the
export-engines session's dirty tree, and exercised on the second dev
instance. `check:types` at baseline (web 26, node 10); 2180 tests passing,
up from 2132 (48 new: 21 across the seven node tests, 3 `flow-render`
runner paths, 13 fixtures, 4 composition-node, 2 audio-node, 2 text-node,
2 args, plus one registry list); `electron-vite build --outDir
.vidtsx-temp/w8-build` passes (1 m 53 s, alone). Spend: $0.44 real (the
`minimax` explainer run) + $0.001 AssemblyAI; the two `claude-subscription`
explainer runs logged $0.80 and about $0.70 API-equivalent at $0; no fal
call, no ElevenLabs.

**Media helpers** (`src/main/services/media/`). `ffmpeg-run.ts` resolves
Remotion's ffmpeg/ffprobe through `getRemotionBinariesDir()` in
`utils/paths.ts`, spawns with `-hide_banner -nostdin -y`, kills on abort and
reads `time=` off stderr for progress; `probeMedia` returns duration, size,
fps and whether the file has video and audio streams. `video-edit.ts` holds
the three edits as pure argument builders plus runners. A finding that
shaped them: Remotion's ffmpeg n7.1 build is trimmed — no `pad`, `fps`,
`setsar`, `color`, `subtitles` or `drawtext` (it has `scale`, `crop`,
`format`, `concat`, `aresample`, `aformat`, `anullsrc`, `libx264`, `aac`).
So `concat_videos` scales-and-crops every clip to the first clip's size,
sets the output rate with `-r`, and gives a silent clip an `anullsrc`
track; letterboxing is not available and a clip of another aspect loses
its edges (recorded in the file). `remotion-render.ts` is a Remotion render
driven from MAIN — `bundleComposition` then `renderComposition` to H.264,
the settings' timeout / GPU backend / hardware acceleration as the queue
handler applies them, the render registered in `getActiveJobs()` under a
caller-chosen job id so `cancelRender` covers it, a test seam for the pair.

**The seven nodes** (`src/main/services/agents/tools/`, ids appended to the
registry and `AGENT_TOOL_IDS`; every one has a fake-service test). Decisions:
- `transcribe` (video or audio → transcript + text) is the same
  `transcribeAudioFile` the Transcribe screen, the Studio and auto-cut use;
  `TranscribeAudioFileParams` gained an optional `featureSource` so the row
  logs as `flows`. The W4 keyterms are the run brand's vocabulary plus the
  active vocabulary memories (`composeKeyterms`), and `applyAliasPostpass`
  / `replaceAliasesInText` correct the words and the text as the Studio's
  transcriber does. The transcript is a `document` artifact — the readable
  Markdown with `[mm:ss]` lines — whose payload carries a NEW `transcript`
  variant (`TranscriptMeta`: the JSON beside it with segments, words,
  utterances, the model, language, duration) rather than an eighth
  `ARTIFACT_KINDS` entry: the document viewer already shows it, and the
  `transcript` PORT type maps to `document` through the new
  `src/shared/flows/port-kinds.ts`. The default model is
  `assemblyai/universal`; the openrouter whisper entries are refused (no
  timestamps).
- `caption_video` (video + transcript → video): the bundled ffmpeg has no
  subtitle filter, so burn-in is what the Captions tool does — the
  self-registering caption composition (`caption-composition.ts`, mode
  `burnin`, the clip served over the bundler's asset route) rendered in
  main through `remotion-render.ts`. Word timings, when present, become
  lines through the Studio's `groupCaptionWords` (punctuation and 0.6 s
  pauses break them); otherwise the STT segments are shown. Styles are the
  three the composition offers (`minimal`, `bold-pop`, `karaoke`).
- `text_to_speech` (text → audio): `audioEngine.generateSpeech` after
  `ensureAudioEngine`, the voice from config or the active TTS model in
  Settings → Audio, loaded on demand from `getModelDir`; no installed voice
  answers `NO_TTS_VOICE_MESSAGE`. The engine, `audio-models.ts` and the
  settings are imported LAZILY: `audio-models.ts` calls
  `app.getPath('userData')` at load, and the registry is imported by tests
  (and the pack checker) without Electron — the first registry test run
  failed on exactly that. `AudioPayload.sound` gained `'speech'`.
- `extract_frame` (video + number → image / images): one `-ss <t>
  -frames:v 1` per frame into `<run folder>/frames/`; `count: 1` samples at
  `atSeconds`, more samples the centre of `count` equal slices (`stripTimes`).
  Both output ports carry the one `image-set`. The time leads the file name
  because the library slug caps at 40 chars and the first live run lost it
  behind a long source name.
- `trim_video` (video, start, end → video): a frame-accurate re-encode by
  default (`-ss` before `-i`, `-t`), a keyframe stream copy as `fast`.
- `concat_videos` (videos → video): `videos` was added to `DataType`
  (additive; `video → videos` widens like `image → images`; `flow-args`
  collects every incoming edge on it, as for `images`).
- `save_to_library` (any of video / image / audio / composition /
  transcript → the same): media already in the library is re-described and
  brand-tagged in place, or COPIED into a given folder; a composition or
  transcript document is copied into the library as content while the
  artifact keeps its workspace path so a downstream node still renders or
  reads it. Its five output ports work because `mapOutputs` now puts a filed
  artifact only on ports OF ITS KIND (`portCarriesKind`) — the general rule,
  not a special case.
- `generate_audio` gained ports (`prompt` → `audio`; `kind`, seconds, loop,
  vocals and a per-node `brandId` in the inspector), `priced: true` with a
  per-kind hint from the engine's registered rate or ElevenLabs' published
  $0.002 / $0.0025 per second when none is registered, the run's
  `featureSource`, and the inspector's `'on'` / `'off'` strings. Verified
  through the tool test only — no ElevenLabs key exists on this machine
  (§0.1 item 8's rule); no live audio row was produced.
- `generate_text` gained `promptPrefix` (fixed text before the port text)
  and `extract` (`first-json-item` for the thumbnail prompt's JSON-array
  reply, `strip-fences`), the smallest additions that let the thumbnail flow
  hand one prompt to `generate_image`.

**The composition trio inside a flow.** (1) The media-load convention the
Stage 1 outcome left open: the `image` / `video` ports of
`generate_composition` resolve the artifact to its library file
(`port-media.ts`) and the model is told to show it with
`<Img src={staticFile("C:/…/hero.png")} />` /
`<OffthreadVideo src={staticFile("…")} />` — forward slashes, the exact
expression — which is the one way the generation prompt already teaches for
local files (`generate-2d-prompt.ts`), so the same TSX previews and
renders. A port artifact of the wrong kind is refused before a pipeline
call. The node also binds a provider and model with decision 12's modes
(`llm-model-binding.ts`, an `llm-model-picker` + mode select in the
inspector), so a flow can pin the composition LLM; an agent session's own
provider stays the default. (2) `render_composition` inside a flow: the
queue's rows live in the renderer and a run lives in main, so the flow does
not enqueue — `flow-render.ts` settles the `job` by rendering through
`remotion-render.ts` (the same two services the queue handler calls; the
tool's job id is what `getActiveJobs()` shows), reserves the output in the
flow's library folder, files the MP4 through the agents'
`applyRenderJobUpdate` (one filing path: the library entry, the probe and
the `video` artifact are an agent session's), and the video lands on the
port. `executeNode` hands the settle the tool's `jobRequest`, the run's
`files/` and the NODE's resolved brand. Cancel reaches the render through
the signal (`cancelRender`); a failed or interrupted render is RERUN on
Resume with a fresh job and, since the failed job left no file, the same
output name — a partial file from a killed render is never trusted, because
Remotion writes in place. (3) Stage 2's `send-to-queue` action on a run
composition now renders in main with a `job` artifact in the run's store,
in the background, refused while the run executes (two writers on one
`artifacts.json`); it answers `success` without navigation and the MP4
shows in Assets and in the run's artifacts on reopen. (4) Brand on nodes
(§0.1 item 9): `resolveNodeBrand` in `session-brand.ts` is the one rule —
a string overrides, `null` opts out, absent OR the inspector's cleared
`''` inherits the run's resolved brand (itself absent = library default,
`null` = none) — used by `generate_image`, `generate_composition`,
`generate_audio`, and for `generate_video` by the settle that files the
clip. `generate_composition` gets `buildBrandInstructions` the way W7's
agent path does (the test asserts node → run → none), and the live run
proved it: the explainer rendered with the "ACME TEST" header of the W3
profile's default brand.

**The five fixtures** (`resources/flows/vidtsx/*/flow.json`, written by
`.vidtsx-temp/w8/gen-fixtures.mjs`, validated by `flows-builtins.test.ts`
structurally and against the REAL registry — tool ids, ports and types,
config keys under each schema, param binds, outputs — and Stage 6 wires
them into the Built-in group). The Thumbnail Generator's system prompt
moved to `src/shared/prompts/thumbnail-system-prompt.ts` (the hook imports
it; the test asserts the fixture equals it — with LF endings, because
esbuild normalises a template literal's CRLF and the first comparison
failed on that alone). `thumbnail`: topic → `generate_text` (locked prompt,
a `promptPrefix` asking for one horizontal prompt, `extract:
first-json-item`) → `generate_image` 1280×720 with a `count` param (1–4)
and a pause; horizontal only — the hub keeps the vertical option.
`frame-strip`: a `video` param bound to `input_video_file.filePath` → a
strip of `count` (default 8) frames. `explainer-30s`: topic → script (a
fixed prefix and system prompt, `strip-fences`, `useBrand: on`) →
`generate_composition` 30 s 1920×1080 with a `style` select whose values are
the style notes (pause) → `render_composition`. `product-ad`: ONE
`generate_image` with `count: 3` + pause (Stage 2's note) fed by the product
image on `referenceImages`, then Hailuo 02 (6 s, ~$0.27) from the picked
frame, the clip on the composition's `video` port, then the render.
`add-effect`: first frame → `generate_image` with the frame as `sourceImage`
→ Kling 2.5 Turbo Pro (5 s, ~$0.40) from that image.

**Verification in the app** (second instance, `VITE_FF_FLOWS=1`, W3 profile,
`.vidtsx-temp/w8/w8-flows.mjs` extended with `seed-fixture`, `run-ipc`,
`wait-ipc`, `usage`, `shot-run`). The fixtures were seeded as
template-sourced rows through `flowsProjectCreate`; runs were started over
the same `FLOWS_RUN_START` IPC the form uses and polled from `run.json` on
disk. `frame-strip` on `Videos\VidTSX\AcmeTestLogoSting…mp4` (10.0 s):
`success` in 2 s, 6 frames 1920×1080 filed under `flows/s3-frame-strip/frames/`,
both ports carrying the set. `S3 transcribe` (a 16.8 s speech MP4 made from
`.vidtsx-temp/w4/vidtsx-3x.wav`; `input_video_file` → `transcribe` →
`caption_video` karaoke): `success` in 41 s — extraction + AssemblyAI
Universal in 5.8 s with 4 keyterms from the `acme-test` brand's vocabulary,
the transcript reading "Welcome to VidTSX. … how LearnWithHasan uses it every
week. Try VidTSX today." (27 words, 4 segments, the brand spellings), the
burn-in render 34.6 s for the 16.8 s clip at 640×360, ffprobe h264 + aac
16.84 s 730 KB, the karaoke highlight visible in a grabbed frame
(`stage3-caption-frame.png`; the caption template's fixed 48 px type is
sized for 1080p and overflows a 360p frame — the Captions tool's template,
not this stage's). The run form showed the captioned video with the shared
action bar and three done steps (`stage3-transcribe-run.png`). `explainer-30s`
unattended on `claude-subscription` (the pipeline's default): `success` in
525 s — script 9.7 s, composition 244 s (classify → generate → verify →
validate, one pass), render 271 s — the MP4 `flows/s3-explainer/explainer-30s.mp4`
30.06 s 1920×1080 h264 + aac 2.82 MB, a mid-clip frame showing the
brand-styled six-beat layout (`stage3-explainer-frame.png`), the form with
the video large and 4/4 steps (`stage3-explainer-run.png`). The second run
on a baseURL preset: with both LLM nodes pinned to `openrouter` in
`required` mode the run refused in 1 ms with decision 12's message ("requires
anthropic/claude-sonnet-4.6 on openrouter, which is not configured or is
disabled") — the W3 profile's `openrouter` LLM entry has no key (its shared
credential serves STT only); pinned to `minimax` / `MiniMax-M2.7` instead
(`required`, brand `null`): `success` in 272 s — script 21 s, composition
153 s, render 97 s — `explainer-30s-2.mp4` 30.06 s 1.87 MB, a plainer card
layout whose cards clip at the frame edge mid-animation
(`stage3-explainer-minimax-frame.png`; a model-quality difference, reported
as seen). Usage rows produced, all `featureSource: 'flows'`:
`assemblyai / universal / stt / $0.0009`; `claude-subscription /
claude-opus-5 / llm` × 4 for the first explainer ($0.028 + $0.023 script and
prefix, $0.428 + $0.320 pipeline — API-equivalent, $0 on the subscription);
`minimax / MiniMax-M2.7 / llm` × 4 ($0.043 + $0.020 + $0.119 + $0.260 =
$0.44). Kill mid-render (§10 item 4): a fifth `claude-subscription` run was killed the second its render node went `running` (still bundling — the job artifact `running`, no output file yet); after the relaunch `flowsRunGet` reported `error` "The app closed while this run was in progress — Resume continues from the first unfinished step", `resumable: true`, the render node `skipped`; `flowsRunResume` over IPC reran ONLY the render (a fresh job, attempt 2, 186 s) and the run finished `success` — 370 s wall including the kill — with `explainer-30s-5.mp4` (3.75 MB) large on the form and 4/4 done steps (`stage3-explainer-resumed.png`). The abandoned first job stays `running` in `artifacts.json` (cosmetic; a reconcile for Stage 6). Two earlier attempts missed: run 4's render (222 s) finished before a poll keyed on the render NOTES fired — the trigger has to key on the node status.

**Deviations, and what it leaves.** (1) The transcript is a `document` +
`transcript` payload variant, not a new artifact kind (above); a
`transcript` port never carries a plain document (`resolveTranscript`
refuses one). (2) The baseURL-preset run used `minimax`, not `openrouter`
(no LLM key on the profile); the refusal itself is decision 12 working.
(3) There is no `input_audio_file` node: `transcribe`'s `audio` port takes
an `audio` artifact from `text_to_speech` or `generate_audio`, and a file
comes in as video (the acceptance made an MP4 from the WAV). (4) Resume
reruns a render rather than picking a finished file up by id. (5)
`send-to-queue` on a run composition is a main-side render with no queue
row and no navigation. (6) `text_to_speech`, `trim_video` and
`concat_videos` were not exercised live (no voice model on the profile;
the two edits are argument builders unit-tested against the filter set
this ffmpeg has); `product-ad` and `add-effect` were not run (fal spend —
Stage 6's three-runs rule and cap). (7) `concat_videos` crops rather than
letterboxes (no `pad`). (8) The bundler reports percent already — the
first live run printed "Bundling… 600%"; fixed, with bundling notes
throttled to 25 % steps. (9) The caption templates size text for 1080p.
Driver lessons: the Bash tool expands `${…}` inside a quoted heredoc and
mangles `\'`, so every patch went through a `.py` file run by path;
`Input.insertText` is not needed when a run starts over `window.api` — the
form was screenshotted after the fact (`shot-run` opens the card, which
hydrates the latest run); polling `run.json` on disk avoids holding a CDP
driver open for ten minutes; the composition render outran a 5 s poll once,
so the kill trigger must fire on the first `Rendering…` note.

## 7. Stage 4 — `run_flow`, `run_agent`, Flow Builder — ~1 session

Files: `tools/run-flow.ts` (agent tool), `tools/run-agent.ts` (node),
`resources/agents/vidtsx/flow-builder/` (`agent.json`, `AGENT.md`,
`skills/flow-design/SKILL.md` covering node catalogue, port types, when to
expose a param, when to pause), `tools/{list-nodes, read-flow,
propose-flow, read-run}.ts`, canvas proposal diff view
(`FlowProposalOverlay.tsx`), "Ask the builder" side panel.

Done when: Motion Post calls `run_flow` on `vidtsx/thumbnail` and shows the
image in its stage; the Flow Builder turns "make me a flow that captions a
video" into an accepted three-node flow that then runs. In Studio, "apply
add-effect on shots 7 to 9" makes the Studio agent run the flow with that
range as input and propose the result as a B-roll insert the user approves.

#### Stage 4 outcome (2026-09-10) — what was built, what the verification showed, and what it leaves

Everything §7 lists (as §0.1 items 5, 6, 11 and 13 adjust it) is built,
unit-tested, committed by pathspec in four commits (`a68bc9e` the shared
tools — `run_flow`, `run_agent`, the Builder's four; `db11706` the Studio
`run_flow` on a shot range; `136478f` the Flow Builder built-in, the
proposal overlay and "Ask the builder"; `73f0a0d` four things the live runs
found) plus the docs commit, beside the export-engines session's dirty tree,
and exercised on the second dev instance. `check:types` at baseline (web 26,
node 10); 2228 tests passing, up from 2180 (48 new: 6 run_flow, 5
run_agent, 8 propose_flow, 5 listing, 4 patch + diff, 5 flow-range, 4
Studio flow-tools, plus the registry list, minus none); `electron-vite
build --outDir .vidtsx-temp/w8-build` passes (2 m 8 s, alone). Spend:
$0.40 real (ONE fal `kling-2.5-turbo-pro` 5 s clip) + $0.0009 AssemblyAI;
two `gemini-cli` images at $0; every LLM turn on `claude-subscription` at $0
(the one `flows` LLM row, the thumbnail's `generate_text`, logged $0.038
API-equivalent).

**The shared `run_flow`** (`agents/tools/run-flow.ts`, §1.5). Starts an
unattended run through `flowService.start` with the calling session's brand
(`ctx.brandId ?? null` — a session without a brand runs with none, never the
library default), streams `node-status` events as tool-progress lines
("Generate Image: running / done" — the chips in the Motion Post screenshot),
waits on a new `flowService.wait`, and hands the flow's `outputs` back as
drafts: media records (video, image-set, audio) as they are — the library
file is the shared durable root — and work files (document, composition,
web-page) COPIED into the session workspace under `flows/<runId>/`
(`run-flow-outputs.ts`). A tool result can now carry `extraArtifacts`, filed
in order by the tool server after the primary, so a flow with several outputs
lands them all. A flow whose node needs an unconfigured provider is refused
by the runner's own validation before any step, and the tool relays that
message. The description is a getter carrying the installed-flows listing
(`flow-listing.ts`): every stored flow with id, steps, outputs, its `params`
schema and its priced steps — `generate_video` priced from the node's model
and duration through the new `shared/presets/video-model-prices.ts` ("kling-
2.5-turbo-pro, 5 s ≈ $0.40"), other priced nodes by their hint — plus the
rule to name the flow and the cost before calling. Decision: the listing is
cached by a fingerprint of the flows' ids and `updatedAt`s rather than per
session, so every session sees one identical string until a flow changes —
which is what the prompt cache wants. `flowId` accepts the row id or the
exact name (`resolveFlowRef`), because the seeded fixtures carry ulids and an
agent types names. Both `generate_video` tools (shared and Studio) now list
every model with its per-second rate when asked for an unknown id, and their
descriptions say so (§0.1 item 6 follow-on).

**`run_agent`** (`agents/tools/run-agent.ts`, §1.6): `goal` + context ports
(text, image, video, audio, composition) → the last artifact of the
configured kind; config = agent id, a comma-separated tool allowlist cut to
the manifest's tools, max turns, output kind, provider/model. It creates a
session titled "Flow: <goal>", seeds the context artifacts into the
session's store (media records; documents and compositions copied into the
session workspace), runs ONE `agentService.send` with additive `tools` /
`maxTurns` overrides that narrow the manifest for that send only, and copies
a work-file output back into the run's `files/`. A session that ends on an
`ask_user` question fails the node with the question's title — the agent
completes before any pause is raised (§11) and nobody can answer. Gated on a
new `agent-provider` capability (the active LLM provider can run a tool
loop, `resolveToolSupport`), marked `nondeterministic` — the canvas shows an
"Agent step — the result varies run to run" chip, the palette a "varies"
tag. Verified through the unit test with a fake runner only: no acceptance
flow uses it, and the seam it needs (an agent-sdk provider) is the W3
profile's default, so a live run is a Stage 6 item.

**The Flow Builder** (`resources/agents/vidtsx/flow-builder/`, hashed with
`agent-pack.mjs --hash`, `--check` clean): `list_nodes` (the catalogue as
the palette sees it — ports with types, config keys with kinds and defaults,
needs and whether met, price), `read_flow` (a compact doc with edges as
"node.port -> node.port", the recent runs, the priced summary; no id lists
every flow), `read_run` (statuses, attempts, durations, errors, log lines,
output ports, artifacts), `run_flow`, `ask_user`, `list_artifacts`, and
`propose_flow`, which NEVER writes: a whole doc (nodes, `"a.port -> b.port"`
edges, params, outputs; positions laid out by dependency depth, config
merged over the registry defaults, outputs derived from the sinks when
absent) or a `patch` of ten named ops (`shared/flows/flow-patch.ts`:
add/remove node, set config, pause, add/remove edge, expose/unexpose,
set-outputs, rename — chosen over JSON Patch because a model writes named
ops reliably and paths into a document it must reproduce verbatim badly),
validated by the structural gate and `validateFlowForRun` with every
capability assumed present (an unmet gate is a chip, not a refusal), queued
one per session in `flows/flow-proposals.ts` (main memory, the
memory-proposal pattern) and emitted as a new `flow-proposal` run event. The
canvas (`FlowProposalOverlay`, `shared/flows/flow-diff.ts`) lists the diff
and paints the union of both graphs — added nodes green, removed red,
changed amber with the changed keys, proposed edges animated green, dropped
edges dashed red; Accept swaps the document under the open flow's id and
origin through `useFlowGraph.replaceDoc` and the ordinary debounced save
(a new name goes through the header's rename), Discard drops it, and main
is told either way over two additive channels (`FLOWS_PROPOSAL_GET` re-reads
the card after a navigation). "Ask the builder" (`BuilderPanel`) embeds the
shared `AgentChat` (W7's `hidePickers` + `interactionCard` slot) on one
session per flow, created with the manifest's one-node starter prefilled
("Which flow are you working on? <name> (id …)") so the agent knows what it
edits without being told; the Flows feature imports only
`src/renderer/components/*` and `src/renderer/hooks/agents/*`. Motion Post
1.2.0 lists `run_flow` (and the `image-set` kind) with a Flows paragraph.

**The Studio `run_flow`** (`studio/agent-tools/flow-tools.ts`, id appended
to `STUDIO_TOOL_IDS`, §0.1 item 11): the same runner, the PROJECT's brand,
and `range` — `{ fromShot, toShot }` counting the media clips on the master
video track from 1 in timeline order (what "shot 7" is after an auto-cut),
or `{ fromSec, toSec }` in timeline seconds. `flow-range.ts` maps the range
to SOURCE spans of the footage assets (contiguous spans of one asset merge
into one trim; a still or a speed-changed clip is refused with the shot
number) and makes the clip with Stage 3's ffmpeg `trimVideo`, or trims plus
`concatVideos` when an auto-cut range is several spans — the smallest
existing path. The renderer's export bridge was not used: the shot lanes and
captions are not part of a B-roll source, and a trim is seconds where a
Remotion render of the range is minutes. The clip lands in
`<temp>/vidtsx-studio/flow-range/` and is bound to the flow's `video` param
(absolute path → `input_video_file.filePath`, Stage 3's convention). The
`video` output is imported into the project on use (`importLibraryFile`, the
`generate_video` pattern) and the answer names the asset id and the exact
`insert_asset(assetId, lane: "broll", at: <range start>, note: …)` call —
W3's 'insert-plan' card, no new proposal kind (§0.1 item 5). Prompt rules in
`studio-agent-prompt-tools.ts`: the tool line and a FLOWS workflow line
(name the flow AND the cost before calling; propose the clip as one card
after; never run a priced flow the user did not ask for; never guess the
shot count from the asset list).

**Load order** (found by the first tool test): a tool that reads the
registry at load — `run_flow` for node labels, `run_agent` through the agent
service whose runner selects tools — formed an import cycle with
`registry.ts` whose outcome depended on the entry file
(`registerTool(undefined)` when a test imported the tool first). The map and
its readers moved to `registry-core.ts`; `registry.ts` registers and
re-exports; the flow service and the tools read the core; `run_agent`
reaches the agent service lazily; and the flows IPC handler imports the
registry for its side effect so a run can never start against an empty
store. `ToolCapabilities.agentProvider` is optional so older test literals
still type.

**Verification in the app** (second instance, `VITE_FF_FLOWS=1`, W3
profile; drivers `.vidtsx-temp/w8/w8-stage4.mjs` — `flows-open`, `ask`,
`wait-proposal`, `accept`, `builder-watch`, `agent-open`, `skip`, `say`,
`watch` — plus `w8-flows.mjs seed-fixture` and W3's `w3-drive.mjs` for
Studio; `seed-w8-studio.mjs` writes a 20 × 3 s tight cut of the W3 60 s
clip). (b) An empty "S4 captions" flow, Edit view, "Ask the builder", one
line "Make me a flow that captions a video": the builder read the flow and
the catalogue, its FIRST `propose_flow` threw (a param it wrote without
`bind` reached the gate — fixed in `73f0a0d`, refused with a message now),
it retried in the same turn, and 90 s in the overlay showed a NEW-flow
proposal: Video File → Transcribe → Caption Video, three edges (the video
on both consumers), three params (Video required, Caption style select,
Words per caption 1–6), one output, with the assistant's own message naming
the only priced step ("AssemblyAI Universal, a few cents per minute")
(`stage4-builder-proposal.png`). Accept: the stored doc read those three
nodes with the registry defaults merged (`sttModelId assemblyai/universal`,
`style minimal`, `wordsPerGroup 4`), the canvas 3 nodes / 3 edges
(`stage4-builder-accepted.png`). "Run it on …/speech-test.mp4 with the
karaoke style" → the builder's `run_flow` finished in 42 s and `video-1`
"S4 captions — Captioned video" landed in ITS session (`artifacts.json`,
`flows/s4-captions/captioned-video.mp4`, h264 + aac, 16.84 s, 640×360); it
said "no priced steps" because `transcribe` was not marked priced — fixed.
Usage: `assemblyai / universal / stt / flows / $0.0009`. (a) Agents page →
Motion Post 1.2.0 → Skip and chat → one line "Run the Thumbnail flow for a
video titled '…' — one variation": chips "Running a flow — Starting
'Thumbnail' / Text: running … Generate Image: done", `image-set-1`
"Thumbnail — Thumbnail" (1376×768) on the stage with Save to Library / Open
folder / Copy path in 42 s (`stage4-motion-post-thumbnail.png`). Usage:
`gemini-cli / nano-banana-2 / image / flows / $0` and `claude-subscription /
claude-opus-5 / llm / flows / $0.038` (the flow's text node). The model wrote
no sentence before the call — the flow is free, and the persisted transcript
holds only the final reply, so the rule's "say free" was not observed. (c)
Studio project "W8 Stage 4 s4-a" (20 clips), line "apply the add-effect flow
on shots 7 to 9": the agent REFUSED — it read the one 60 s asset as one clip
("there is no shot 7–9 yet"), asked for a time range and an effect, and
named the cost correctly ("one Kling 2.5 Turbo Pro clip, 5 s ≈ $0.40"). The
prompt line now tells it the tool checks the range; the second line stated
the 20 clips and a watercolour effect, and the turn ran `run_flow` with
`{ fromShot: 7, toShot: 9 }`: the range trimmed to a 9.0 s h264 + aac clip
(source 18–27 s, one span), the flow ran (`extract_frame` → `generate_image`
on `gemini-cli` $0 → `kling-2.5-turbo-pro` 5 s on fal $0.40), the clip was
imported (asset `b6a6676e…`, 1924×1076, 5.04 s) and proposed with
`insert_asset(lane "broll", at 18)`; the watcher clicked "Place 1 clip";
`project.json` holds the clip on overlay lane O1 at 18 s for 5 s with
`origin { by: 'agent', proposalId }` and the insert-plan `applied`
(`stage4-studio-insert.png`). Usage: `fal / kling-2.5-turbo-pro / video /
flows / $0.40`, `gemini-cli / nano-banana-2 / image / flows / $0`. Main log:
3 warnings — two pre-existing sd-cli lines and the `propose_flow` throw
above. The seeded project was deleted through `studioProjectDelete`; the
seeded flows and the builder session stay on the W3 profile.

**Deviations, and what it leaves.** (1) `run_agent` was not run live
(above). (2) Its `document` output port is typed `transcript` (the only
document-carrying port type), so a plain document lands there and a
downstream `caption_video` would refuse it — a `document` port type is a
one-line addition when a flow needs it. (3) The Builder's card shows only
on the Flows canvas; a `propose_flow` from the Agents page emits the event
into a workspace with no overlay (the tool still answers "shown on the
canvas") — the Agents workspace could mount the overlay later. (4) Accept
applies a NEW-flow proposal to the OPEN flow (its id and origin kept), which
is what the empty-canvas path wants; there is no "create a second flow from
the panel". (5) The interim assistant text before a tool call is not
persisted in `chat.json`, so whether an agent named the cost before calling
is visible only live. (6) The trimmed range clip stays in the temp folder
(the run's `input_video_file` copies it into the library `inputs/`). (7)
Stage 5's freeze can reuse `FlowProposalOverlay` + `replaceDoc` as the
"Frozen from session X" card — `FlowProposal.flowId: null` is already the
new-flow case. Driver lessons: the Bash tool mangles `\'` inside a heredoc
even in a `'EOF'` block on this machine — every patch and every test title
with an apostrophe went through a `.py` file or the Write/Edit tools; two
`w3-drive.mjs watch` loops overlapped once (the first outlived its 600 s
tool timeout in the background) and both logged, one clicked — check
`ps -W` for `w3-drive` before starting a second; `[data-agent-session]` is
not rendered with a single session, `agentSessionsList` finds the id; the
`Page.captureScreenshot` wrapper did not hang this stage.

## 8. Stage 5 — Freeze — ~1 session

Files: `src/main/services/flows/freeze-session.ts` (lineage walk, param
detection, draft doc), `tools/save-flow.ts`, action-bar entry "Freeze into
a flow" in the agent stage, canvas proposal reuse from Stage 4.

Tests: lineage walk on a fixture session with a dead end and a retry
yields only the winning path; intake values become params; a session with
an `ask_user` pick yields a `pause` on the node before it.

Done when: a Motion Post session is frozen, the resulting flow runs
unattended with a new brief, and the video matches the session's style.

## 9. Stage 6 — Packaging, built-in flows, Tools migration, release — ~1.5 sessions

- `.vidtsxflow` reader and install on the shared zip layer; file
  association (`pending-open.ts` extension map + `electron-builder.yml`,
  never `src/main/index.ts`); `scripts/flow-pack.mjs` (or `agent-pack.mjs
  --kind flow`); a bare `flow.json` imports through the same validator
  (§0.1 item 4, updated 2026-09-10).
- The five built-in flows in `resources/flows/vidtsx/`, each run three
  times without manual intervention before it ships.
- Tools hub: the built-in flows appear beside the Thumbnail Generator and
  Frame Extractor screens (a "Flows" group or a second entry per tool); the
  screens stay in V1 (§0.1 item 3, updated 2026-09-10) and their removal is
  a follow-up after real use.
- "Run a flow on this" handoffs from Library and Video Studio.
- Docs: `docs/FLOW_PACKAGE_SPEC.md`, a starter folder under
  `docs/examples/flow-starter/`, `docs/ui-automation-cdp.md` recipe.
- Flag: `flows` moves from `ENV_GATED` to `FEATURE_FLAGS` as a dev-preview,
  then `true` with the installer rebuild.

## 10. Test plan and acceptance

Unit: migration; validation; registry ports and specs; arg building;
runner order, persistence, cancel, resume; pause reply paths; lineage walk;
package validator; `run_flow` result mapping.

Manual, in-app (record results here when run):
1. Open a v1 flow saved before the migration: canvas identical, runs.
2. `vidtsx/thumbnail` from the run form: image in the output pane, save to
   Library works.
3. `vidtsx/product-ad` attended: pick card, chosen image feeds the clips,
   MP4 at the end. Unattended: no pause, first variation used.
4. Kill the app mid-render on `explainer-30s`; reopen; Resume finishes.
5. Motion Post calls `run_flow`; freeze that session; run the frozen flow.
6. Import an unsigned `.vidtsxflow`: warning, installs, appears under
   Installed, runs. Tampered: refused.
7. Provider with no tool support: flows without agent nodes still run;
   the agent node reports the degraded message.

## 11. Risks

- **Two runners diverging.** The flow runner and the agent runner must
  call handlers through one code path (`invokeTool(def, args, ctx)`), or
  content safety and usage logging drift. Rule: no handler is called
  outside `invokeTool`. (Updated 2026-09-10: `invokeTool` does not exist
  yet — the agents' `tool-server.ts` calls handlers directly. Stage 1
  creates `tools/invoke-tool.ts` and reroutes the tool server through it,
  §0.1 item 14.)
- **Artifact size on ports.** Base64 never travels on a port; ports carry
  artifact references and files stay in the run folder. Today's runner
  already had to strip images before persisting.
- **Long pauses hold nothing expensive.** Unlike an agent `ask_user`, a
  paused flow holds no SDK session; the runner is idle until the reply.
  Keep it that way when `run_agent` nodes exist: an agent node completes
  before any pause is raised.
- **Freeze fidelity.** Reasoning that never went through a tool is lost.
  Mitigated by the tool-only convention in built-in agents and by showing
  the draft on the canvas for review before saving.
- **Catalogue sprawl.** Every tool with ports appears in the palette. Keep
  `category` accurate and hide `needs`-gated nodes behind a chip, not a
  filter, so users learn what a provider unlocks.
- **Registry drift** applies here as in the agents plan: tool ids are
  append-only, and a removed model id is coerced as `generate_video`
  already does.

## 12. Open questions

1. Resolved 2026-09-04 as decision 13: no manual Studio panel; the Studio
   agent calls `run_flow` on a shot or section and applies the result.
   `RunFormView` still takes a prefilled params object so a panel stays one
   call away if a bundled flow ever wants it.
2. Resolved 2026-09-04 as decision 12 (required / preferred / default per
   node).
3. Do frozen flows keep a link back to the session for "show me where this
   came from"? `origin` is stored; the UI can add the link later.
4. Pricing surface: a flow declares `requires.capabilities`, so the
   website can show "needs an image provider" before purchase. Same
   metadata JSON per flow as per agent.
