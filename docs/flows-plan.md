# Flows — frozen, reusable recipes that people run and agents call

> Status: PLAN (written 2026-09-04, after the V1 code freeze). Nothing here
> changes V1. Work starts after the V1 flip and after `docs/agents-plan.md`
> Stage 1 (the tool registry) exists, because flows v2 is built on it.
> Companion designs: `docs/agents-plan.md`, `docs/NEXT_FEATURES_DESIGN.md`
> (Q7 packages, Q8 packs), `docs/SKILLS.md`.

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
    edit the video, and flows are tools.

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
        "config": { "seconds": 30, "aspect": "16:9", "stylePreset": "Clean" },
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
handler exactly as the agent runner would (same `AgentToolContext`, same
content-safety check, same usage logging with `featureSource: 'flows'`),
and maps the returned artifact or field to the output ports.

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
| `generate_video` | text, image?, image? → video | fal video job (today's node body, moved to main) |
| `generate_composition` | text (brief), image?, video? → composition | agents plan wave-1 tool |
| `edit_composition` | composition, text → composition | agents plan wave-1 tool |
| `render_composition` | composition → video | agents plan wave-1 tool |
| `transcribe` | video or audio → transcript | `AUDIO_STT_TRANSCRIBE` service, AssemblyAI or whisper |
| `caption_video` | video, transcript → video | captions burn-in (Studio caption builder + ffmpeg) |
| `text_to_speech` | text → audio | `AUDIO_TTS_GENERATE` |
| `extract_frame` | video, number → image | `TOOLS_FRAME_EXTRACT` service |
| `trim_video` / `concat_videos` | video, number, number → video / videos → video | ffmpeg wrappers |
| `save_to_library` | any artifact → same | Library import |
| `run_agent` | text (goal), any? → typed output | agent runner, bounded (1.6) |
| `run_flow` | agent-only tool, no ports | flow runner (1.5); in Studio sessions accepts a shot range as the `video` param |

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
interaction cards and artifact viewers move from `src/features/agents/` to
`src/renderer/components/interactions/` and
`src/renderer/components/artifact-viewers/` (this is a change to the agents
plan's 1.3 file placement, recorded here so Stage 3 there puts them in the
shared location from the start). Inspector field components move to
`src/renderer/components/fields/` for the same reason.

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

## 4. Stage 1 — Registry ports and the main runner — ~1.5 sessions

Depends on agents Stage 1.

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

## 5. Stage 2 — Pause, run form, Flows page — ~1.5 sessions

Depends on agents Stage 4 (interactions) for the cards.

Files: `RunFormView.tsx`, `RunOutputs.tsx`, `StepsStrip.tsx`,
`ModeSwitch.tsx`, `VideoPickField.tsx`; inspector additions
`ExposeParamToggle.tsx`, `PauseToggle.tsx`; `FlowsScreen` list groups and
the Run / Edit segmented control; runner pause path through the broker;
shared moves listed in 1.8.

Done when: a flow with two params and one paused node runs from the form,
pauses with a pick card, continues with the chosen image, and shows the
video output with the action bar; unattended mode skips the pause.

## 6. Stage 3 — Product nodes — ~1.5 sessions

Files: `tools/{generate-composition, edit-composition, render-composition}`
gain ports (the handlers already exist from the agents plan);
new `tools/{transcribe, caption-video, text-to-speech, extract-frame,
trim-video, concat-videos, save-to-library}.ts` wrapping the existing
services; ffmpeg helpers in `src/main/services/media/` if not already
present.

Tests: each tool with a fake service; the runner over a five-node
composition flow with a fake render queue.

Done when: `vidtsx/explainer-30s` runs brief to MP4 unattended on
`claude-subscription` and on one baseURL preset.

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
  association; `scripts/flow-pack.mjs` (or `agent-pack.mjs --kind flow`).
- The five built-in flows in `resources/flows/vidtsx/`, each run three
  times without manual intervention before it ships.
- Tools hub: Thumbnail Generator and Frame Extractor entries open their
  flow's run form; the old screens are removed after one release with both
  paths available.
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
  outside `invokeTool`.
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
