# Agents — installable, declarative agents on top of the app's building blocks

> Status: PLAN (written 2026-09-04, after the V1 code freeze). Nothing here
> changes V1. Work starts after the V1 flip. Companion designs:
> `docs/NEXT_FEATURES_DESIGN.md` (Q7 packages, Q8 packs, Q11 CLI),
> `docs/studio/AGENT_MEMORY_DESIGN.md` (memory + skills as one mechanism),
> `docs/SKILLS.md`, `docs/flows-plan.md` (flows are built on the tool registry
from Stage 1; nodes are tools with ports, `run_flow` is a tool, sessions can
be frozen into flows).

## Start here (for the session that begins the work)

0. **Stages 0 and 1 are DONE (2026-09-07).** Read section 3, then section 4
   in full — including the step 0 record and the "Stage 1 outcome" subsection,
   which name four contract deltas and the two things Stage 1 left owed. Then
   start at Stage 2 (section 5).
1. Preconditions: the V1 flip has shipped as 1.0.0, and `check:types` plus
   `npx vitest run` are green on `main`. Confirm both before touching code.
2. Read sections 0, 1, and 2 in full, then only the stage you are on.
3. (Historical.) Stage 0 was to come before Stage 1, and Stage 1's step 0
   experiment before its code. The experiment was NOT run — see the record in
   section 4 — and the non-blocking `ask_user` form shipped on the decision
   rule alone. Two of its rows are still owed.
4. Rules that hold for every stage: nothing under
   `src/main/services/studio/` changes except the optional `agentId` field
   in 1.10; tool ids are append-only; every new file follows CLAUDE.md
   (feature isolation, IPC-only bridge, ~300 lines, named exports).
5. Record outcomes in this file as they happen: the step 0 numbers in
   section 4, manual acceptance results in section 10, and a STATUS.md entry
   per finished stage.

## 0. Decisions recorded on 2026-09-04

1. **An agent is wiring, the app owns the parts.** A package ships prompts,
   skills, and a manifest. It never ships code or components. Every tool,
   viewer, and interaction lives in the app and ships with an app version.
2. **Three registries** make agents plug-together: tools (id + zod schema),
   viewers (keyed by artifact kind), interactions (pick / approve / reorder /
   edit / form / progress). New capability = one registry entry.
3. **Artifacts are the universal currency.** Tools return artifacts, viewers
   consume them, interactions operate on them, handoff actions take them.
4. **Contracts are versioned by the app version.** The manifest names the tool
   ids and artifact kinds it needs plus `minAppVersion`. Install refuses with a
   clear message when the app is too old. Registries only grow, so old agents
   keep working.
5. **Agents live on their own page** and hand off into Studio, Creator, the
   Library, and the render queue. They do not run inside Studio.
6. **The Studio agent stays as it is** (decided 2026-09-06, replacing the
   earlier "agent number one" idea). It has Studio-only features and its own
   service, tools, prompt, and panel, and it is not part of the agents
   system. The runner and registry are built fresh; the Studio code is the
   pattern they copy, never a dependency they change. If Studio ever wants a
   registry tool, that is a separate, later migration with its own
   snapshot test.
7. **Update in place by semver, manually.** Same namespaced id + newer
   version replaces the installed folder (one rotated backup). Same version
   reinstalls. Older version asks first. The app never checks or downloads
   on its own; the user checks, downloads from the store, and imports
   (decided 2026-09-06).
8. **No license enforcement in the app, ever.** Packages are signed (publisher
   verification, tamper refusal) and may be stamped per buyer. Selling,
   accounts, and gated update downloads live on the website. The app only
   reads a public metadata JSON per agent when the user clicks "Check for
   update".
9. **In-process MCP tools, not a shell.** Installed agents never get Bash.
   Tool definitions are cached and allowlisted per agent, so token cost is
   controlled by the manifest, not by the transport.
10. **Tool loops require an `agent-sdk` provider** (Claude subscription,
    Claude API, MiniMax, OpenRouter, Z.AI, Kimi). Same rule and same degraded
    message as the Studio agent today.
11. **One built-in test agent ships with the app: "Motion Post"** (animated
    social post). It exercises form, pick, approve, document, composition,
    job, and video without needing an image provider.

## 1. Target design

### 1.1 Package anatomy — `.vidtsxagent`

A zip. Same container discipline as `.vidtsx` (Q7e): the manifest lists every
entry with size + sha256, extraction is hash-verified into a temp tree,
zip-slip guarded, entry and size caps, destination paths built from ids the
app validated.

```
agent.json            manifest (below)
AGENT.md              system prompt body (markdown, no frontmatter)
skills/<id>/SKILL.md  zero or more skills, same format as resources/skills
skills/<id>/*         skill resources (walked recursively, read by tools only)
subagents/<name>.md   optional SDK subagent prompts
assets/*              optional reference images, exemplars, TSX templates
icon.png              optional, 256x256
signature.json        optional publisher signature (1.6)
```

`agent.json`:

```jsonc
{
  "formatVersion": 1,
  "id": "vidtsx/motion-post",          // <namespace>/<name>, [a-z0-9-]+ each
  "name": "Motion Post",
  "version": "1.0.0",                  // semver
  "description": "Brief → animated social post, rendered.",
  "author": { "name": "VidTSX", "url": "https://vidtsx.com" },
  "license": "MIT",
  "minAppVersion": "1.1.0",
  "icon": "icon.png",
  "prompt": "AGENT.md",
  "tools": ["write_document", "generate_composition", "edit_composition",
            "render_composition", "ask_user", "list_artifacts"],
  "sdkTools": ["WebSearch"],           // SDK built-ins only; never Bash
  "artifacts": ["document", "composition", "job", "video"],
  "interactions": ["form", "pick", "approve"],
  "starter": {                         // optional guided start (1.9)
    "entry": "goal",
    "nodes": {
      "goal": { "question": "What kind of post?", "select": "one",
        "options": [
          { "id": "promo", "label": "Promote a product or offer", "next": "platform" },
          { "id": "tip",   "label": "Share a tip or insight",     "next": "platform" },
          { "id": "quote", "label": "A quote card",               "next": "platform" }
        ], "allowOther": true, "otherNext": "platform" },
      "platform": { "question": "Where will it be posted?", "select": "one",
        "options": [
          { "id": "9:16", "label": "Reels / Shorts / TikTok", "next": "brief" },
          { "id": "1:1",  "label": "Instagram feed",          "next": "brief" },
          { "id": "16:9", "label": "YouTube / X",             "next": "brief" }
        ] },
      "brief": { "question": "What is it about?", "text": true, "multiline": true, "next": "$end" }
    },
    "opening": "Make a {{platform}} {{goal}} post about: {{brief}}",
    "quickStarts": ["A 6 s hook for a newsletter launch", "Three-tip loop on focus"]
  },
  "defaults": { "maxTurns": 24, "effort": "medium" },
  "subagents": {},                     // name → { description, prompt, tools }
  "workspace": { "sdkFileTools": false },
  "updateUrl": "https://vidtsx.com/agents/vidtsx.motion-post.json",
  "files": [ { "path": "AGENT.md", "size": 1234, "sha256": "..." } ]
}
```

Rules enforced by the validator (Stage 2): every `tools[]` id must exist in
the tool registry; every `artifacts[]` and `interactions[]` kind must exist
in its registry; `sdkTools[]` is a subset of {WebSearch, WebFetch}, plus
{Read, Write, Edit, Glob, Grep} only when `workspace.sdkFileTools` is true
(they then run behind the path guard in 1.2); `Bash` and any other SDK
tool are rejected; `minAppVersion` must not exceed
the app version; `prompt` must be a listed entry; skills must parse with the
existing skill parser; TSX under `assets/` must pass the D14 gate
(`validateShotCode`) at install.

### 1.2 Runtime — the runner

`src/main/services/agents/agent-runner.ts` is modelled on
`StudioAgentService.send` (copied pattern, separate code). Per session:

1. Resolve provider (per-session choice, else app default). `toolsAvailable`
   is `config.type === 'agent-sdk'`, the same rule the Studio agent's
   `resolveToolSupport` applies, written once more in
   `src/main/services/agents/tool-support.ts` (Studio's copy is left alone).
2. Build the MCP server from the **tool registry filtered by the manifest
   allowlist** with `createSdkMcpServer({ name: 'vidtsx', tools })`. Only
   allowlisted definitions are sent, so token cost follows the manifest.
3. Compose the system prompt: AGENT.md, then agent skills (same `## Skill:`
   sections as `composeSystemPrompt`), then the starter answers (fixed for
   the session), then the memory block (trailing). **The system prompt is
   static for the whole session** (decided 2026-09-06): the artifact list
   is never in it. The model learns about artifacts from the tool results it
   already saw and from `list_artifacts`, so the cached prefix survives
   every turn.
4. `runLlmGenerate(request, signal, onDelta, { mcpServers, trailingSystemPrompt })`
   with `featureSource: 'agent'`, `maxTurns` from defaults, `allowedTools`
   = `mcp__vidtsx__<tool>` plus `sdkTools`, `agents` = manifest subagents,
   and, when `workspace.sdkFileTools` is true, `cwd` = the session
   workspace **and** a `canUseTool` callback (the SDK's permission hook)
   that is the **file-tool path guard**: for Read, Write, Edit, Glob, and
   Grep it resolves every path argument and denies, with a message the
   model sees, anything that is not inside the session workspace folder
   (symlinks resolved, `..` normalised). WebSearch and WebFetch pass
   through. Any other tool name is denied. Decided 2026-09-06.
5. Emit `AgentRunEvent`s to the renderer over `AGENT_RUN_EVENT`.

One in-flight run per session. `cancel(sessionId)` aborts the SDK query and
rejects any pending `ask_user` promise.

### 1.3 The three registries

**Tools** — `src/main/services/agents/tools/registry.ts`. Each entry:

```ts
interface AgentToolDef<TArgs = Record<string, unknown>> {
  id: string;                       // 'generate_composition'
  description: string;              // sent to the model
  schema: ZodRawShape;              // SDK tool() shape
  needs?: 'image-provider' | 'video-provider';  // capability gate, surfaced in UI
  handler: (args: TArgs, ctx: AgentToolContext) => Promise<AgentToolResult>;
}
interface AgentToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  /** A tool RETURNS what it made; the runner files it, assigns the id and
   *  version, and appends to the store. Tools never write the store. */
  artifact?: AgentArtifactDraft;    // = AgentArtifact minus id/createdAt/producer/version
}
interface AgentToolContext {
  sessionId; agentId; workspaceDir; signal; providerId;
  /** Library folder this session files into, RELATIVE to the library root —
   *  what generateImageAsset / generateVideoAsset already take. */
  libraryFolder?: string;
  brandId?: string;                 // auto-tag output when the session has one
  emit(event: AgentRunEvent): void; // `emitProgress(text)` wraps it for tools
  readArtifacts(): AgentArtifact[]; // READ-ONLY; writes go through the result
  ask(request: InteractionRequest): Promise<InteractionReply>;
}
```

**Write through the result, read through the context (decided 2026-09-07.)**
An earlier draft put a writable artifact store on the context. The
provisional `types.ts` written alongside `generate_video` (see below) returns
an artifact draft on the result instead, and that is the better shape: tools
stay free of persistence and are trivial to unit test, the runner owns ids,
ordering, versioning and the one write path, and a tool that throws
mid-handler cannot leave a half-written store. Tools that need to *read*
prior artifacts (`edit_composition`, `list_artifacts`) use the read-only
accessor. `libraryFolder` and `brandId` come from the same file and are
adopted as named.

**`generate_video` already exists.** `src/main/services/agents/tools/generate-video.ts`
plus its test were written by the video-providers plan's Stage 5 (commit
0b0ddd1) against the shipped engine, wrapping `generateVideoAsset` with
`needs: 'video-provider'` and returning a `video` artifact that carries the
Video Studio entry id and library path, never a provider URL (cloud URLs
expire in 24 h). It is imported by nothing until the registry exists.
Stage 1 replaces the provisional `tools/types.ts` with the real contract
above and wires this tool in; the tool file itself should need little more
than an import change. `AiFeatureSource` already gained `'agent'`, and
`generateVideoAsset` now takes `providerId`, `resolution` and an optional
`featureSource` — see `docs/video-providers-plan.md` section 6.

Wave-1 tool set:

| id | source | artifact |
|---|---|---|
| `write_document` | new, writes markdown into the workspace | `document` |
| `generate_composition` | `generateTsxPipeline` with `buildShotEngineDeps`-style deps, project-less; transpile then `storeTranspileResult` | `composition` |
| `edit_composition` | `editTsxPipeline` on an existing composition artifact | `composition` (new version) |
| `render_composition` | enqueues through the ONE render queue (see "Long jobs" below); returns at once | `job`, then `video` on complete |
| `generate_image` | existing `generateImageAsset`, agent library folder | `image-set` |
| `generate_video` | written (commit 0b0ddd1); Stage 1 re-points it at `videoEngine.submit` for the job shape, `needs: 'video-provider'` | `job`, then `video` on complete |
| `ask_user` | new, per the form chosen in Stage 1 step 0 (1.5) | none |
| `list_artifacts` | reads the session's artifacts via `readArtifacts()` | none |
| `run_flow` | flows plan 1.5; Studio sessions may pass a shot range as the video input and apply the output to the timeline | flow outputs |

**Viewers** — `src/renderer/components/artifact-viewers/registry.ts` (shared
with Flows, see `docs/flows-plan.md` 1.8; the agents feature imports it),
keyed by artifact kind. Wave 1: `document` (markdown pane), `composition` (`IsolatedPreview`
over the module server), `video` (new plain `<video>` viewer with scrub),
`image-set` (grid + lightbox, reusing `ImageCard` and `ImageLightbox`),
`job` (`RenderItem` row for renders, a progress row for video). Wave 2 (section 13): `html-page`, `slides`,
`table`, `model-3d`, `frame-strip`, `audio`, `character-bible`.

**Interactions** — `src/renderer/components/interactions/registry.ts` (shared
with Flows for run checkpoints). Wave 1:
`form` (mid-run questions; the starter tree in 1.9 renders through the same
card), `pick` (one or many of a set, compare
mode for images), `approve` (per-item accept/reject, the Studio review
pattern). Wave 2: `reorder`, `edit`. Progress is implicit via the `job` artifact.

### 1.4 Artifacts

`src/shared/types/agents.ts`:

```ts
type ArtifactKind = 'document' | 'composition' | 'video' | 'image-set' | 'job';
interface AgentArtifact {
  id: string; kind: ArtifactKind; title: string; createdAt: string;
  producer: { tool: string; callId: string };
  version?: number;                 // compositions: edit_composition bumps it
  payload: ArtifactPayload;         // discriminated by kind
}
// document:    { relPath }
// composition: { relPath, moduleUrl, config: CompositionConfig }
// video:       { relPath, width, height, durationSeconds }
// image-set:   { items: [{ relPath, width, height }] }
// job:         { jobId, job: 'render' | 'video', status, progress, resultArtifactId? }

// A `job` artifact is minted at SUBMIT time and holds only what exists then:
// the job id, kind, and status. Everything the output has — `relPath` above
// all, which only exists after the file-on-completion step (video) or after
// the queue writes the file (render) — arrives when the job reaches a
// terminal state, as a SEPARATE `video` artifact whose id is written back
// into the job artifact's `resultArtifactId`. Viewers and tools must never
// read a payload field before its job is terminal; `RenderItem` has the same
// before/after split, which is why one kind covers both.
```

All `relPath`s are relative to the session workspace. Never absolute paths
in the store, never a path chosen by the model (tools name files from ids).

Handoff actions (per kind, on the stage action bar): save to Library, open
in Creator (composition), open in Studio as a shot (composition), send to
render queue, open folder, copy path.

### 1.5 Sessions and storage

```
<userData>/agents/<namespace>/<name>/        installed agent (folder-as-truth)
<userData>/agents/<namespace>/<name>.bak/    one rotated previous version
<resources>/agents/<namespace>/<name>/       built-in agents (extraResources)
<userData>/agent-sessions/<namespace>.<name>/<sessionId>/
    session.json      { id, agentId, agentVersion, title, createdAt, lastOpenedAt,
                        providerId, starter, thumbnailRelPath? }
    chat.json         { version: 1, messages }   (agent-chat-store shape)
    artifacts.json    { version: 1, artifacts: AgentArtifact[] }
    work/...          documents, TSX, scratch — never media outputs (see 1.11)
```

**Sessions are saved and resumable (decided 2026-09-06).** Every session
persists as it runs, so the user can close the app and reopen any session
later with the full chat and every result in place. What that takes:

- A sessions list per agent (title, last opened, artifact count, thumbnail
  of the latest visual artifact), sorted by last opened. Title comes from
  the starter answers or the first message and is renameable.
- Reopen = load `chat.json` + `artifacts.json`, replay the chat window, and
  show the latest artifact on the stage. Continuing the conversation sends
  the replay window as today's Studio agent does (append-only, 60-message
  cap, cache-friendly). The model's memory of tool results beyond the window
  comes from `list_artifacts`.
- Composition artifacts store the TSX path, not the module URL. The module
  store is in-memory and gone after a restart, so the viewer asks main to
  re-transpile and serve on demand (`ensureCompositionModule(artifactId)`).
  Video and image artifacts point at files in the Library (1.11) and need
  nothing.
- A render job that finished while the session was closed is reconciled on
  open: output file present = `video` artifact appended; missing = the job
  artifact is marked failed.
- A pending interaction from a previous run shows as expired; the user just
  continues chatting.
- Delete session removes the session folder only. Media already filed in the
  Library stays, because the user may have used it elsewhere.

`ask_user` mechanics: two candidate forms, decided by the Stage 1 experiment
(section 4, step 0).

- **Blocking.** The tool handler creates an `InteractionRequest` (id, kind,
  payload), emits it as a run event, and awaits a promise in a per-session
  map. The reply comes back over `AGENT_INTERACTION_REPLY` and resolves the
  promise. The SDK loop waits inside the tool call; no turn is consumed.
  Cannot survive an app restart, and depends on the SDK's stream-close
  timeout being raised.
- **Non-blocking.** The tool handler stores the request in `session.json`
  as `pendingInteraction`, emits the run event, and returns at once with
  "The question is shown to the user. End your turn and wait." The turn
  ends. The reply is sent as the next user message in a fixed format
  ("[Answer to question <id>] <choice>"), which survives an hour away or an
  app restart. Costs one extra turn, mostly cache reads.

Either way the renderer shows the same card, cancel clears the pending
request, and a session with a pending request reopens on that card.

**Long jobs never block a tool call (decided 2026-09-06).** Rendering is one
flow for the whole app: the render queue owned by the renderer
(`RenderQueueContext`), which starts jobs, persists them, shows them on the
Queue screen, and owns cancel. An agent render therefore works like this:

1. `render_composition` validates the artifact, writes a `job`
   artifact with a fresh job id, emits a `job-request` run event, and
   returns immediately with "Render queued as job X; it will be reported
   when done. End your turn." The SDK turn ends normally.
2. The workspace hook receives the event and enqueues the job through the
   existing queue with the output path in the agent's Library folder (1.11).
   The stage shows the queue row in the `job` viewer.
3. On queue completion the hook appends a `video` artifact and, if the
   session is idle, auto-sends a continuation user message: "Render job X
   finished: video artifact Y." The agent picks up from there. If the user is
   mid-conversation the note is simply the next thing they see in the chat.
4. Cancel from the Queue screen or from the stage marks the job artifact
   failed and sends the same kind of note.

The same rule applies to any tool over ~30 s that is not itself an LLM call.
LLM-backed tools such as `generate_composition` keep blocking, as the Studio
shot tool does today, and so do fast asset calls like `generate_image`
(10–30 s, inside the envelope).

**`generate_video` follows the job shape too (decided 2026-09-07.)** The
tool as written wraps `generateVideoAsset`, which awaits
`videoEngine.generateAndWait`, so the handler blocks for the whole job:
three to six minutes in live runs, one reference-to-video job past
thirteen. It was written that way because Studio's `generate_image` blocks,
which is reasonable at 10–30 s and not at 13 minutes. Three reasons to
move it:

1. **Parallelism is the product.** A short-film agent wants eight clips.
   Blocking makes that eight jobs end to end, forty minutes of frozen chat.
   The job shape submits them and collects, and this argument holds
   whatever the SDK timeout turns out to be.
2. **The timeout is untested.** The tool has never run inside an SDK loop
   (it is imported by nothing yet), and 13 minutes is far past the 60 s the
   SDK's own docs warn about for in-process tool calls.

An earlier draft of this entry gave a third reason, restart survival. It
was wrong, and the correction matters (checked in code 2026-09-07). The
video job tracker is three in-memory Maps with a 1 h retention sweep and no
persistence (`src/video-engine/job-tracker.ts`; `types.ts` says so in as
many words: "in-memory for V1, shaped so persisting it and…"). An app
restart therefore loses in-flight jobs under **either** shape, and because
nothing then polls the provider, the clip is never downloaded, gated or
filed — it simply expires at the provider (24 h on ModelArk) after the user
has already paid for it. The job shape makes persistence *possible* later;
it does not deliver it. Adding it is somebody's stage, not a side effect of
this one.

**What Stage 1 actually has to build.** No engine change: `videoEngine`
already exposes `submit(request)` returning a `VideoJobRecord` with the job
id (Gate A then Gate B, then the tracker starts), `subscribe(listener)`
which pushes progress **in the main process**, so the runner subscribes
directly rather than going through the renderer, `cancel(jobId)`, and
`listJobs()` for enumerating in-flight work. But "handler rewrite" understates
the rest: `generateVideoAsset` is not a thin wrapper on `generateAndWait`.
After the wait it copies the clip out of Video Studio into the asset library
(`ensureLibraryRoot`, `reserveLibraryFile`, `fs.copyFile`), reads the brand,
and upserts the library entry — the engine's own filing only reaches Video
Studio. So Stage 1 splits `generate-video-asset.ts` into a submit step and a
**file-on-completion** step, and decides who calls the second: the runner on
the terminal record, or a completion hook. That is a small but real
main-service refactor and the piece most likely to be missed.

**Make the completion step idempotent and re-runnable, not
fire-and-forget.** If it never runs — the runner crashed, the session
ended, nobody was subscribed — the clip is still safe: gated, on disk, and
in Video Studio. But it never reaches the asset library, so the agent's
artifact points at nothing and the user has paid for a clip they can only
find in the wrong gallery. So the filing step must key off the terminal
`VideoJobRecord` rather than off the subscription event, must be safe to
call twice (a clip already filed at that `relPath` is a no-op, not a
duplicate), and the session must be able to re-drive it for any job that is
terminal with no `resultArtifactId`. Do this on session open as well as on
the live event.

`ArtifactKind` therefore carries one `job` kind covering both renders and
video generations, and Stage 1 keeps `generate-video.test.ts` meaningful.

**`ctx.signal` is load-bearing and must stay wired** through whatever shape
a tool takes. In `generate_video` it reaches the engine and cancels the
provider job, so cancelling an agent run stops paying for a video. BytePlus
refuses to cancel a task that has already started, which surfaces as a
warning rather than an error; that is expected, not a bug.

### 1.6 Install, update, signing

**Install** = `openAgentPackage(file)`, validate the manifest (1.1 rules),
extract to temp, D14 gate on any TSX, compare with the installed copy:
newer moves the installed folder to `.bak` and moves temp in; equal
replaces; older makes the IPC return `needsConfirm: 'downgrade'` so the
dialog asks. Built-ins are read-only. When the same id exists in both the
built-in root and the user root, **the highest version wins**; equal
versions prefer the built-in (decided 2026-09-06). So a user copy imported
from a file is used until an app update ships a newer built-in, and
"Remove" on a user copy deletes it and the built-in shows again.

**Updates are manual (decided 2026-09-06).** The app never checks for
agent updates on its own and never downloads a package on its own. The
agent card menu has "Check for update", which fetches `updateUrl` (https
only) once, on that click, expecting
`{ id, latest: { version, url, sha256, minAppVersion, notes } }`, and shows
the result in the details dialog: newer and compatible = "Version X is
available" with a button that opens `url` in the browser; newer but
incompatible = "needs VidTSX Y". The user downloads the file from the store
and installs it through the ordinary import path, which replaces the older
version (1.6 Install). No update badge, no background fetch, no
`agents-updates.json`. Agents without `updateUrl` simply have no menu item.

**Signing** = `signature.json { alg: 'ed25519', keyId, publicKey, signature }`
over the canonical JSON of `agent.json` (which already hashes every file).
Verification with Node `crypto.verify`. Known publisher public keys ship in
`src/shared/agents/publishers.ts` (public keys only, allowed by the
no-secrets rule). Outcomes: known key + valid = "Verified publisher";
unknown key + valid = "Signed by <keyId>" (installable); invalid = refused;
unsigned = "Unsigned" warning, installable. `signature.json` is never
listed in `files[]`.

**Per-buyer stamping stays outside the signature (decided 2026-09-06).**
The manifest is signed once, offline, by the publisher. The store adds a
separate `licensee.json` (`{ name, orderId, issuedAt }`) to the zip at
download time; it is not hashed and not signed, and the app only shows it
in the details dialog. That keeps the private key off the web server:
tampering with the stamp controls nothing, and a leaked copy still names
its buyer.

Dev tooling: `scripts/agent-pack.mjs <folder> --out <file> [--key <path>]`
builds `files[]`, zips with `archiver`, signs with a key file that lives
outside the repo (path from `VIDTSX_AGENT_SIGNING_KEY`). The install
validator doubles as the author's checker (`--check`).

### 1.7 UI

**Agents page** (`AgentsScreen`): grid of `AgentCard`s (icon, name,
version, trust tag, "Built-in" chip), an Import button, drag-and-drop of
`.vidtsxagent`, double-click via the OS file association. Card menu: Open,
Details (manifest, capabilities, licensee, signature), Check for update,
Remove.

**Trust tags (decided 2026-09-06).** Every card and the import dialog show
exactly one tag, derived from the signature outcome in 1.6:

| tag | when | colour |
|---|---|---|
| Verified by VidTSX | signed with a key in `publishers.ts` | accent |
| Signed, unverified publisher | valid signature, unknown key | warning |
| Unverified. Use at your own risk | unsigned | warning |

The import dialog for anything other than "Verified by VidTSX" adds a
one-line notice: "VidTSX has not reviewed this agent. It runs with your
providers and credits." Install is one click either way; a tampered
package is refused before this point.

**Capability summary.** The details dialog and the import dialog list what
the agent can do, derived from the manifest, in plain words: "Browses the
web" (WebSearch / WebFetch), "Generates images with your image provider"
(`generate_image`), "Renders videos" (`render_composition`), "Writes files
in its own session folder" (`sdkFileTools`), "Asks you questions"
(`ask_user`). One line per capability, nothing to configure.

**Agent workspace** (`AgentWorkspace`): two panes.

- Left (38 %): `AgentChat`, reusing the `AgentPanel` message row (tool
  chips, streamed text, cursor), provider select, the starter tree on a new
  session (1.9) with quick-start chips on the empty state, session switcher
  (sessions list per agent), New session, Start over, Cancel.
- Right: `ArtifactStage`, the latest artifact large in its viewer, a
  filmstrip of earlier artifacts along the bottom, an action bar per kind
  (1.4). Interactions render as cards **inside the stage** (pick shows the
  candidates large; approve lists items) while the chat shows a one-line
  "waiting for your choice" state.

Layout tokens from `UI_SPEC.md`; the split mirrors Studio's panel/preview
proportions. Every viewer and interaction is a plain component with typed
props and no IPC of its own; the workspace hook owns the wiring.

### 1.8 Provider constraint and degraded mode

`resolveToolSupport` false means the runner builds no MCP server and the
system prompt gets the same "Tool availability" section the Studio prompt
uses today, naming the providers that do support tools. The Agents page
shows the same notice on the provider select. Tools with
`needs: 'image-provider'` are listed but the model is told they are
unavailable when no image provider is configured.

**A provider is required before anything runs.** Opening an agent with no
usable LLM provider (`filterUsableLlmProviders` empty) shows a single empty
state: "Configure an AI provider to use agents" with a button that
navigates to the AI page. No starter, no chat box, no session is created.
When at least one usable provider exists it is **preselected**, in this
order: the provider this agent's last session used, else the app's active
provider (`llmActiveProvider`), else the first usable one. The select stays
visible in the chat header so the user can change it per session, and the
choice is stored in `session.json`. Decided 2026-09-04.

### 1.9 Starters — guided, branching first questions

End users should not have to know how to brief an agent. A **starter** is a
small decision tree the author writes in the manifest. It runs entirely in
the renderer: no provider, no tokens, instant, offline. Once the run starts,
the agent can still ask follow-ups through `ask_user`, and both layers use
the same cards, so the user never sees a seam.

Shape (see the example in 1.1):

- `entry` names the first node. Each node is one question with either
  `options[]` (`select: "one" | "many"`) or `text: true` (free text, optional
  `multiline`), and an optional `hint`.
- Every option carries `next` (a node id or `$end`). A node may also carry a
  default `next` for text nodes and for `select: "many"`.
- `allowOther: true` appends an "Other…" choice with a text field;
  `otherNext` says where that path goes. The answer is stored as
  `{ id: "$other", text }` so templates can use either.
- `opening` is a template over the answers (`{{nodeId}}` resolves to the
  option label, or the typed text for `$other` and text nodes). It becomes
  the **prefilled first message in the chat box, not auto-sent**, so the user
  sees exactly what the starter produced and can edit it before sending.
- `quickStarts[]` are optional one-click sample prompts shown on an empty
  session, for agents that want ChatGPT-style starters instead of, or beside,
  the tree.

Validation at install: the tree is a DAG (every `next` exists, no cycles,
`$end` reachable from `entry`), node ids are `[a-z0-9-]+`, at most 12 nodes
and 8 options per node, every `{{ref}}` in `opening` names a node. There is
no expression language; branching is only by `next` per option. Authors
who need more use `ask_user` from the prompt.

User experience rules:

- Every step shows "Skip and chat". Answers so far still go into the context
  block, marked partial, so nothing typed is lost.
- Back goes to the previous node and restores its answer.
- "Start over" on a session re-runs the tree; the answers live in
  `session.json` under `starter` and are shown in the context block as
  "Starter answers" for the whole session.
- A starter never blocks a returning user: opening an existing session goes
  straight to the chat.
- A starter only appears once a provider is selected (1.8). With a provider
  configured that selection is automatic, so the user still lands on the
  first question with no extra step.

### 1.10 Memory — per agent, the Studio way (decided 2026-09-06)

Agents learn from the user exactly as the Studio agent does: nothing enters
memory that the user did not see and accept (`AGENT_MEMORY_DESIGN.md` M2).
The mechanism is reused, not rebuilt.

- `StudioMemory` gains `agentId?: string`, following the `brandId` pattern:
  undefined = applies to every agent, set = only that agent. One store file
  (`userData/studio/memory.json`), one dialog, one proposals path. This is
  the one additive touch to Studio code that decision 6 permits: an
  optional field plus a filter, so entries without `agentId` behave exactly
  as today and Studio's own reads are unchanged.
- The memory block for a session = app-wide entries + entries scoped to
  this agent, composed by the same pure function and budget
  (`MEMORY_PROMPT_BUDGET`, `MAX_ACTIVE_RULES` counted per scope). It stays
  the trailing block for cache reasons.
- `propose_memory` becomes a registry tool any agent may declare. The
  proposal card gains a scope line, "Remember for: this agent / all agents",
  defaulting to this agent. The agent's manifest can set
  `memory: { propose: true }` to opt in; agents that do not declare it get
  the read side only.
- The Studio agent's existing memories stay app-wide (no migration needed);
  Studio reads them as before and keeps its own Memory button and panel.
- The agents chat header gets its own Memory button opening the same
  `MemoryDialog`, filtered to the current agent with an "all agents"
  toggle.
- Same hygiene: provenance, contradiction surfacing at accept time, toggle
  off rather than delete, "applied because" prose. No silent inference.

### 1.11 Output filing — every agent gets its own folders (decided 2026-09-06)

Generated media never lands in a shared pile. Images, videos, audio, and
stills produced by tools are filed into the Asset Library as they are made:

```
<libraryRoot>/agents/<agent-name>/<session-title>/<n>-<slug>.<ext>
```

- `generate_image` already takes a Library `folder`; the runner passes
  `agents/<agent-name>/<session-title>` and the tool records the returned
  `relPath` on the `image-set` artifact. Renders write their output path
  into the same folder. Captures and audio follow when their tools arrive.
- Filing goes through the existing `reserveLibraryFile` + `upsertEntry`
  path, so entries get origin `generated`, the prompt as description, and
  brand tagging like every other born-managed asset. Describe and Organize
  work on them unchanged.
- Folder names are sanitized with `sanitizeFolder` / `slugify` from the
  agent's display name and the session title; renaming a session does not
  move files (the artifact keeps the path).
- The session folder under user data holds only work files (documents,
  TSX, scratch). Documents and compositions are filed to the Library only
  when the user chooses "Save to Library" from the action bar.
- The Library screen gets nothing new: the `agents/` tree is ordinary folders
  the user can browse, move, or delete.

Note: Image Studio keeps its own gallery and database under
`userData/image-studio`, separate from the Asset Library. Agent outputs go
to the Asset Library because that is where the Studio agent already files,
where brands and describe live, and where "open in Studio" reads from. If
agent images should also appear inside Image Studio, that is a general
"show Library folders in Image Studio" change, tracked as open question 5.

## 2. What exists and gets reused

| Need | Reuse | File |
|---|---|---|
| SDK query, sessions, env, bundled CLI | as is | `src/engine/providers/claude-provider.ts`, `claude-session.ts` |
| In-process MCP tools | pattern copied, Studio untouched | `createSdkMcpServer` / `tool` in `studio-agent.ts` |
| Main-side generate entry | as is | `runLlmGenerate` in `src/main/ipc/llm-handlers.ts` |
| Skill parsing + composition | parser extracted | `src/main/services/skills-registry.ts` |
| Transcript store | generalised | `src/main/services/studio/agent-chat-store.ts` |
| Chat UI | message row copied into a shared component; Studio keeps its own until it chooses to adopt it | `src/features/studio/components/AgentPanel.tsx`, `useStudioAgent.ts` |
| Hash-verified zip reading, zip-slip guards, caps | zip layer extracted | `project-package-unzip.ts`, `project-package-zip.ts` |
| Version compare | as is | `compareVersions` in `src/main/services/news-feed-validate.ts` |
| TSX pipeline + gate | as is | `tsx-generation-service.ts`, `buildShotEngineDeps`, `validateShotCode` |
| Module serving | as is | `storeTranspileResult`, `getModuleServerBaseUrl` |
| Render | as is | `RenderQueueContext`, `RENDER_START`, `renderComposition` |
| Composition viewer | as is | `IsolatedPreview` |
| Image grid/lightbox | as is | `ImageCard`, `ImageLightbox` |
| Render row | as is | `RenderItem` |
| Usage accounting | one union member | `AiFeatureSource` in `src/shared/types/ai-usage.ts` |
| Video submit + filing | split in Stage 1 | `submitVideoAsset` / `fileVideoAsset` in `src/main/services/library/generate-video-asset.ts` |
| Routing + nav + flag | one entry each | `App.tsx` screens, `Sidebar.tsx` navItems, `feature-flags.ts` |
| OS open-with | one entry | `electron-builder.yml` fileAssociations, `package-open.ts` |

Ordering (decided 2026-09-06): agents come first. Stages 0 and 1 land
before Flows starts, because Flows builds on the same tool registry.
Estimated total: nine to ten sessions.

## 3. Stage 0 — Contracts and shared types — ~½ session

Goal: every later stage codes against fixed types.

Files:
- `src/shared/types/agents.ts`: `AgentManifest`, `AgentArtifact` and
  payloads, `InteractionRequest` / `InteractionReply`, `AgentRunEvent`,
  `AgentSession`, `InstalledAgent` (manifest + origin `builtin | user` +
  signature status + update status).
- `src/shared/agents/manifest.ts`: `parseAgentManifest(raw): AgentManifest`
  (pure, zod), `AGENT_MANIFEST_NAME = 'agent.json'`,
  `AGENT_PACKAGE_EXT = '.vidtsxagent'`, `AGENT_LIMITS` (entries, bytes,
  manifest bytes).
- `src/shared/agents/ids.ts`: `parseAgentId('ns/name')`, `agentDirName`.
- `src/shared/agents/starter.ts`: `StarterTree` types and `validateStarter`
  (the DAG rules in 1.9); the walker and template renderer follow in Stage 4.
- `src/shared/ipc/types/agents.ts` plus channels `AGENTS_LIST`,
  `AGENTS_INSPECT`, `AGENTS_INSTALL`, `AGENTS_REMOVE`, `AGENTS_CHECK_UPDATE`,
  `AGENT_SESSIONS_LIST / CREATE / LOAD / DELETE`, `AGENT_RUN_SEND`,
  `AGENT_RUN_CANCEL`, `AGENT_RUN_EVENT`, `AGENT_INTERACTION_REPLY`,
  `AGENT_ARTIFACT_ACTION`.
- `AiFeatureSource` already gained `'agent'` (video-providers Stage 5);
  usage entries carry the agent id in the existing free-form label field.

Steps: write the types; write `manifest.test.ts` covering id grammar,
semver, unknown tool ids, `Bash` rejection, `minAppVersion` too high,
missing prompt entry. Done when tests pass and `check:types` is at baseline.

## 4. Stage 1 — Tool registry + runner — ~1 session

Goal: a runner that can take a manifest, build its tool server, run a turn,
and produce artifacts, proven from unit tests and one throwaway manifest.
Nothing under `src/main/services/studio/` is touched.

**Step 0, the ask-user experiment (decided 2026-09-06).** Before the
runner is written, a throwaway script under `scripts/spikes/` drives the
SDK the way `claude-provider.ts` does (streaming input, in-process MCP
server, the bundled CLI path) with one tool that waits for a keypress.
Measure, on `claude-subscription`:

| test | blocking form | non-blocking form |
|---|---|---|
| reply after 2 min | must complete | must complete |
| reply after 15 min, env `CLAUDE_CODE_STREAM_CLOSE_TIMEOUT` raised | pass/fail | n/a |
| reply after 65 min (cache expired) | pass/fail, note the resume cost | must complete |
| app killed and relaunched while waiting | fails by design | must complete |
| model ends its turn after asking, 10 runs | n/a | count how many of 10 |
| extra tokens per question | 0 | measured |

Decision rule: the blocking form is chosen only if it passes the 15-minute
and 65-minute rows, and the restart row is accepted as a documented
limitation. Otherwise the non-blocking form is chosen. If the non-blocking
form is chosen and the model keeps going after asking in more than 1 of 10
runs, the runner enforces the stop by ending the query itself after the
`ask_user` result. Record the numbers in this section.

**Step 0 was NOT run, and the experiment is still owed (2026-09-07).** Every
row that decides between the forms is a long blocking wait — 15 minutes, 65
minutes, a kill-and-relaunch — and the Stage 1 session was asked not to sit
through them. So the decision rule was applied to the rows that are already
known rather than to measurements:

- The restart row is the one row whose answer is not in doubt: the blocking
  form loses the question when the app closes, by construction.
- The 15- and 65-minute rows are exactly the rows the blocking form has to
  PASS to be chosen, and neither has been observed.

The rule says the blocking form is chosen only if it passes both, so the
non-blocking form ships. Stage 1 implemented it as written in 1.5: the
handler posts an `InteractionRequest`, `interaction-broker.ts` persists it
(through a `persist` callback Stage 3 points at `session.json`), the tool
returns "End your turn now and wait", and the reply is sent as the next user
message in the fixed `[Answer to question <id>] …` format.

What is still owed, and what it would change:

| row | status |
|---|---|
| reply after 2 min, both forms | not run |
| reply after 15 min, blocking, `CLAUDE_CODE_STREAM_CLOSE_TIMEOUT` raised | not run — the row that would let the blocking form be chosen |
| reply after 65 min (cache expired) | not run |
| app killed and relaunched while waiting | not run; non-blocking passes by construction |
| model ends its turn after asking, 10 runs | **not run, and this one matters now** |
| extra tokens per question | not measured |

The "model ends its turn" row is the one that can still change Stage 1 code.
The plan says that if the model keeps going after asking in more than 1 of 10
runs, the runner must enforce the stop by ending the query after the
`ask_user` result. That enforcement is NOT implemented, because implementing
it without the measurement would be guessing. What is in place instead: the
tool's description and its result text both tell the model to end its turn
and call nothing else. Run the ten trials in Stage 3, when there is a real
agent and a real chat to run them in, and add the enforcement only if the
count says to.

Switching to the blocking form later touches `interaction-broker.ts` and
nothing else: `InteractionAskResult` already carries an `answered` case, and
`ask-user.ts` handles it.

Files:
- `src/main/services/agents/tools/registry.ts`: `registerTool`, `getTool`,
  `listTools`, `selectTools(manifest, ctx)`.
- `src/main/services/agents/tools/{write-document, generate-composition,
  edit-composition, render-composition, generate-image, ask-user,
  list-artifacts}.ts`.
- `src/main/services/agents/tools/types.ts` — REPLACE the provisional file
  that is already there with the 1.3 contract, then re-point
  `generate-video.ts` (already written and tested, commit 0b0ddd1) at it and
  register it. Keep its existing test green; do not rewrite the tool.
- `src/main/services/agents/tool-support.ts`: the agent-sdk-only rule.
- `src/main/services/agents/file-tool-guard.ts`: the `canUseTool` path guard
  from 1.2, pure except for `fs.realpath`, with tests for `..`, absolute
  paths outside, symlinks pointing outside, Glob patterns with a root, and
  the allow path.
- `src/main/services/agents/prompt-compose.ts`: AGENT.md + skills +
  starter answers + memory; the skill parser is copied into
  `src/shared/skills/parse-skill.ts` and `skills-registry.ts` starts
  importing it (a pure move of a parser, the one shared-code touch).
- `src/main/services/agents/agent-runner.ts`: section 1.2.
- `src/main/services/agents/artifact-store.ts`: `artifacts.json` per
  session, atomic write, `add` (from a draft, assigning id, `createdAt`,
  `producer` and `version`), `list`, `get`, `bumpVersion`. Only the runner
  calls `add`.
- `src/main/services/agents/interaction-broker.ts`: the pending map
  (blocking) or the `pendingInteraction` writer (non-blocking), per step 0.

Steps:
1. Step 0 experiment, numbers recorded, form chosen.
2. Replace `tools/types.ts` with the 1.3 contract and keep
   `generate-video.test.ts` green (it is the first real consumer, so it is
   the contract's first check). Then registry, runner, artifact store,
   broker, guard, with unit tests:
   allowlist filtering, prompt composition order, `ask_user` resolve /
   reject / cancel, artifact relPath containment, guard matrix.
3. Generic tools with tests using a fake `TsxEngineDeps` (the pattern from
   the `tsx-generation-service` tests) and a fake queue event source.

Done when: a throwaway manifest with `write_document` and `ask_user` runs a
turn from a vitest against a stub LLM, and `generate_composition` from a
unit test yields a `composition` artifact with a served module URL.

### Stage 1 outcome (2026-09-07) — what was built, and what it changes downstream

Both "done when" criteria are met from vitest: `tool-server.test.ts` runs a
turn's worth of `write_document` + `ask_user` calls through the wrapped
handlers against a real artifact store and a real broker, and
`generate-composition.test.ts` yields a `composition` artifact carrying a
served module URL. 80 tests across 10 files; `check:types` at baseline
(web 26, node 10); the full suite green.

**Contract deltas — 1.3 as built.** The shape in 1.3 is what shipped, with
four additions that came out of writing the first real consumers. They are
recorded here because Stage 2 onward code against them:

1. `AgentToolContext` carries a **`callId`**. 1.3 gives the context an
   `emit(event: AgentRunEvent)`, but every run event that names a tool needs
   the call id, which the tool cannot know. So the context is built per CALL,
   not per turn, and carries it; `emitProgress(detail)` wraps it as promised.
   `producer.callId` is that same id.
2. `AgentToolResult.supersedes?: string` — the artifact id a draft is a new
   version of. 1.4 says `edit_composition` bumps the version and 1.3 says the
   runner assigns it; `supersedes` is how the runner is told which artifact to
   count from. Without it "the runner assigns the version" has no input.
3. `AgentToolResult.jobRequest?` — a render tool cannot emit the
   `job-request` event itself, because the event carries the `job` artifact's
   id and that id does not exist until the runner has filed the draft. So the
   tool returns the request minus `artifactId` and the runner completes and
   emits it. `generate_video` needs none: main subscribes to the video engine
   directly.
4. `ctx.ask(payload)` returns **`InteractionAskResult`**, not
   `Promise<InteractionReply>`. Under the non-blocking form the ordinary
   outcome is `posted`, which is not a reply at all. The union also carries
   `answered` (the blocking form, unshipped) and `rejected` (a question is
   already pending), so the tool is written once for either form.

**The engine gained two optional fields, and the guard is wired.** 1.2 step 4
asks the runner to pass `cwd` and a `canUseTool` callback, but
`runLlmGenerate`'s `extras` carried neither and `LLMRequest` had no way to
express them. Stage 1 added `cwd?` and `canUseTool?: LlmToolPermission` to
`src/engine/types.ts`, passed them through `claude-provider`'s session query,
and extended the `runLlmGenerate` extras — about fifteen additive lines. The
runner passes them ONLY when `workspace.sdkFileTools` is true, which
`agent-runner.test.ts` asserts in both directions. `LlmToolPermission` is
typed structurally so `src/engine/` still does not import the SDK.

**`agents` (manifest subagents) is NOT wired.** 1.2 step 4 also asks for
`agents` = manifest subagents on the query. Nothing in wave 1 declares any
(the 1.1 example has `subagents: {}`), so the field is parsed and validated
and then ignored. Wiring it is the same shape as `cwd`: one field on
`LLMRequest`, one line in `claude-provider`. Do it in the stage that ships an
agent which needs it.

**`generate-video-asset.ts` no longer has an awaiting form.** The split named
in 1.5 turned out cleanly, because `generateVideoAsset` had exactly one caller
— the agent tool. So rather than keeping a waiter nothing calls, the file now
exports `submitVideoAsset` and `fileVideoAsset` only. Anywhere in this plan or
in `docs/video-providers-plan.md` §6 that says "the tool wraps
`generateVideoAsset`" now means those two.

The **idempotency key is the job id**: `fileVideoAsset` builds
`<folder>/<slug>-<12 hex of jobId><ext>` rather than calling
`reserveLibraryFile`, precisely because reserving would hand out a fresh
`-2` name on the second call and duplicate the clip. That is what makes the
re-drive safe. `src/main/services/agents/video-jobs.ts` is the reconciler:
`reconcileVideoJob` for one job, `reconcileSessionVideoJobs` for session open,
`watchVideoJobs` for the live subscription — and the live path is only an
optimisation over the terminal-record path, never the only route. A job the
in-memory tracker no longer has is reported failed with "lost when the app
restarted" rather than left pending forever.

**Stage 3 owes the reconciler its filing options.** `fileVideoAsset` needs the
library folder and the brand, and neither is on the `VideoJobRecord`. They are
session properties (§1.11), so the session supplies them on both the live
event and the re-drive — which is why `VideoJobDeps.filing` exists. If a
session's folder ever became renameable mid-flight this would need revisiting;
today it cannot.

**Files as built** (all under `src/main/services/agents/` unless noted):
`tools/types.ts` (the 1.3 contract), `tools/registry.ts`,
`tools/tool-server.ts` (the SDK wrapping and the one artifact write),
`tools/{write-document, generate-composition, edit-composition,
render-composition, generate-image, generate-video, ask-user,
list-artifacts}.ts`, `tools/composition-file.ts`, `tools/workspace-files.ts`,
`tools/test-context.ts` (test-only), `tool-support.ts`, `file-tool-guard.ts`,
`prompt-compose.ts`, `agent-skills.ts`, `artifact-store.ts`,
`interaction-broker.ts`, `video-jobs.ts`, `agent-runner.ts`, `tsx-deps.ts`;
plus `src/shared/skills/parse-skill.ts` (the parser move, with
`skills-registry.ts` importing it) and the split
`src/main/services/library/generate-video-asset.ts`.

Two file-placement notes for later stages. `artifact-store.ts` takes a session
DIRECTORY rather than a session id, so Stage 2 can add
`getAgentSessionsDir()` without this file changing. And `tsx-deps.ts` composes
the acceptance gate from the same three shared pieces Studio's
`validateShotCode` composes (`validateTsxCode` + `lintShotSource` +
`parseCompositionConfig`) rather than importing Studio's copy — decision 6
holds, and "acceptable composition code" is still one rule.

**Not started, and Stage 2 or 3 owns them:** no IPC handlers, no preload, no
screens (the channels exist, nothing answers them); no `getAgentsDir` /
`getBuiltinAgentsDir` / `getAgentSessionsDir` / `getAgentOutputFolder` in
`paths.ts`; no session store (`session.json`, `chat.json`) — the runner takes
a session object and a `persistPendingInteraction` hook and leaves the writing
to its caller; no `run_flow`, no `propose_memory`; the memory block is a
parameter `composeAgentSystemPrompt` accepts and nobody yet fills.

## 5. Stage 2 — Package format: reader, validator, install, update, signing — ~1 session

Files:
- `src/main/services/packages/zip-reader.ts`: the generic half of
  `openPackage` (entry caps, duplicate names, manifest read, hash-verified
  extraction, `assertInside`) parameterised by manifest name and parser.
  `project-package-unzip.ts` becomes a thin caller. Existing package tests
  must pass unchanged.
- `src/main/services/agents/agent-package.ts`: `openAgentPackage`,
  `validateAgentPackage` (1.1 rules including D14 on `assets/**/*.tsx`).
- `src/main/services/agents/agent-signing.ts`: canonical JSON, `verify`,
  `sign` (sign is used only by the script).
- `src/shared/agents/publishers.ts`: known public keys.
- `src/main/services/agents/agent-store.ts`: scan built-in and user roots,
  folder-as-truth, corrupt folders skipped with a warning, `install`,
  `remove`, `.bak` rotation, downgrade confirm.
- `src/main/services/agents/agent-updates.ts`: manual `updateUrl` fetch
  and version compare only. No cache, no throttle, no download.
- `src/main/utils/paths.ts`: `getAgentsDir()` (userData),
  `getBuiltinAgentsDir()` (resources), `getAgentSessionsDir()` (userData),
  `getAgentOutputFolder(agentName, sessionTitle)` (Library relative path,
  1.11).
- `scripts/agent-pack.mjs`: build `files[]`, zip, sign, `--check`.
- `electron-builder.yml`: `resources/agents → agents` in extraResources;
  `fileAssociations` gains `vidtsxagent`. `package-open.ts` routes by
  extension.

Tests: manifest/files mismatch refused; zip-slip entry refused; oversize
refused; signed-valid / signed-unknown / tampered / unsigned outcomes;
install newer / equal / older; built-in shadowing and restore; update JSON
newer-but-incompatible shows "needs app X".

Done when: `scripts/agent-pack.mjs --check` passes on the test agent folder,
and a round trip pack, install, list works from a vitest using a temp
userData.

## 6. Stage 3 — Agents page, workspace, wave-1 viewers — ~3 sessions

Files (`src/features/agents/`):
- `components/AgentsScreen.tsx`, `AgentCard.tsx`, `AgentDetailsDialog.tsx`,
  `ImportAgentDialog.tsx` (reuses the `ImportReportCards` patterns).
- `components/AgentWorkspace.tsx`, `AgentChat.tsx` (the message row is a
  copy of the `AgentPanel` row placed in
  `src/renderer/components/agent-chat/`; Studio keeps its own file and may
  adopt the shared one later), `SessionSwitcher.tsx`, `StarterFlow.tsx`
  (walks the tree, Back / Skip and chat, prefills the chat box),
  `QuickStarts.tsx`.
- `components/stage/ArtifactStage.tsx`, `Filmstrip.tsx`, `ActionBar.tsx`.
- `viewers/registry.ts`, `DocumentViewer.tsx`, `CompositionViewer.tsx`,
  `VideoViewer.tsx`, `ImageSetViewer.tsx`, `RenderJobViewer.tsx`.
- `components/SessionList.tsx` (per-agent saved sessions: title, last
  opened, artifact count, thumbnail; open, rename, delete).
- `hooks/useInstalledAgents.ts`, `useAgentSessions.ts`, `useAgentRun.ts`
  (event folding as in `useStudioAgent`), `useArtifactActions.ts`.
- `services/`: pure helpers only (event folding, replay window).
- `types.ts`, `index.ts`.
- Main: `src/main/ipc/agent-handlers.ts`, `registrations/agents.ts`,
  `src/preload/api/agents.ts`, `electron.d.ts` additions.
- `App.tsx` screens entry `agents`, `Sidebar.tsx` nav item "Agents" after
  Studio, `feature-flags.ts` `agents: false` (dev-preview until release).

Steps: page and import first; then the workspace and chat with a no-tool
provider; then viewers one by one against artifacts seeded from a fixture
session; then action-bar handoffs (save to Library, open in Creator, send to
queue, open folder).

Done when: a fixture session with one of each wave-1 artifact renders every
viewer, and each handoff lands in the target screen.

## 7. Stage 4 — Interactions — ~1 session

Files: `src/features/agents/interactions/registry.ts`, `FormCard.tsx`,
`PickCard.tsx` (compare mode for image-set), `ApproveCard.tsx`; the
`ask_user` payload schemas (zod discriminated union by kind) in
`src/shared/types/agents.ts`.

Steps: the starter tree walker and validator as pure functions in
`src/shared/agents/starter.ts` (`validateStarter`, `nextNode`,
`renderOpening`) with tests for DAG checks, `$other`, partial answers, and
template rendering; `StarterFlow` on a new session feeds `session.json` and
the context block; the mid-run `ask_user` round trip (request, card in the
stage, reply, tool returns);
cancel and new-session reject pending requests; no timeouts (the user may
walk away), and a pending request that survives an app restart shows as
"expired".

Done when: a scripted test-agent turn asks for a pick between two documents
and the chosen title appears in the model's next message.

Memory (1.10), same stage: add `agentId` to `StudioMemory` and the store
filter; make `propose_memory` a registry tool with the scope field; add a
Memory button to the agents chat header opening the existing dialog with
the agent filter; extend `agent-memory-prompt` tests for the two-scope
composition. Studio's panel is not touched.
Done when a Motion Post session accepts a proposed rule scoped to the agent
and the next Studio session does not see it, while an "all agents" rule is
visible in both.

## 8. Stage 5 — Built-in test agent "Motion Post" — ~1 session

Folder `resources/agents/vidtsx/motion-post/`:
- `agent.json` as in 1.1.
- `AGENT.md`: role; the workflow (starter answers, two hook/script variants as one
  document, `ask_user` pick, `generate_composition` at the platform size,
  offer approve or one edit round, `render_composition`, point at the
  video); style rules (brand-neutral, readable text, safe margins); and the
  same content-policy paragraph the Studio prompt carries.
- `skills/social-motion/SKILL.md`: timing rules for 3 to 15 s loops, text
  hierarchy, platform safe zones, easing vocabulary from the shot kit.
- `icon.png`.

Steps: write the agent; run it end to end on `claude-subscription` and on
one baseURL preset; fix prompt and skill wording until three consecutive
runs produce a rendered MP4 without manual intervention; record token usage
per run in section 10.

Done when: a fresh install shows two built-in agents, Motion Post completes
brief to video in one session, and the video opens from the action bar.

## 9. Stage 6 — Hardening, docs, release — ~1 session

- Cancel mid-render leaves no orphan job; cancel mid-`ask_user` resolves.
- Corrupt `artifacts.json` / `chat.json` rotate, never delete (store rule).
- Content safety: `generate_image` and `generate_composition` already pass
  through `checkGenerationPrompt`; verify from a tool call.
- Usage: every agent LLM and image call logs `featureSource: 'agent'`; the
  AI usage screen groups by agent id.
- `docs/AGENT_PACKAGE_SPEC.md` for authors (manifest, folder layout,
  signing, `agent-pack.mjs`) and a starter folder under
  `docs/examples/agent-starter/`.
- STATUS.md entry, flag flip `agents: true`, installer rebuild, CDP smoke
  recipe added to `docs/ui-automation-cdp.md`.

## 10. Test plan and acceptance

Unit (vitest): manifest parse; ids; signing; zip reader; store install
matrix; registry selection; prompt composition; broker; artifact store;
event folding; replay window.

Manual, in-app (record results here when run):
1. Import an unsigned test package: "Unsigned" warning, installs.
2. Import the same id at a newer version: replaces, `.bak` present. Older:
   asks.
3. Tampered package: refused with reason.
4. Motion Post: brief, pick, composition, approve, render, video, on
   `claude-subscription`. Token totals: (fill in).
5. Provider without tools: degraded notice, chat still answers.
6. Remove the user copy of a built-in: the built-in returns.
7. "Check for update" with a newer version in the JSON: dialog shows it,
   the button opens the browser, importing the downloaded file replaces the
   old version.

## 11. Risks

- **Registry drift.** A renamed tool id silently breaks installed agents.
  Rule: tool ids are append-only; deprecate by keeping the id and returning
  a guidance error.
- **Prompt cache invalidation.** Resolved by keeping the system prompt
  static (1.2). Any future per-turn context must go into the user message,
  never the system prompt.
- **Long `ask_user` waits.** Settled by the Stage 1 experiment; if the
  blocking form is chosen, the pool cap (8) still applies and the runner
  marks a waiting session busy so the idle timeout cannot kill it.
- **A restart loses in-flight video jobs, and the user has paid for them.**
  The video job tracker is in-memory (1.5). Neither tool shape changes
  this. Until someone persists the tracker, an agent session that submits
  clips and is then closed leaves them to expire at the provider. Mitigate
  in Stage 3 by warning on quit while a session has non-terminal `job`
  artifacts, and treat tracker persistence as a prerequisite for any agent
  that submits video in bulk.
- **SDK file tools.** Only behind the path guard, only when the manifest
  asks. The guard is the one piece of security code in the feature; it
  gets the fullest test matrix.
- **TSX in packages.** Only reaches the app through the D14 gate; still, the
  first release may restrict `assets/` to images and markdown and add TSX
  templates when a real agent needs them.
- **`updateUrl` fetches.** Manual only, https only, one request per click;
  the app never downloads a package itself (1.6).
- **Version numbering.** Decided 2026-09-06: the V1 flip ships as 1.0.0.
  Agents arrive in a later minor, so the first agents declare
  `minAppVersion` equal to that release (1.1.0 in the examples), and a
  1.0.0 app refuses them with "needs VidTSX 1.1.0".

## 12. Open questions

1. Should a session be exportable as a `.vidtsx`-style package (transcript +
   artifacts) for sharing results? Cheap once the zip writer is generic.
2. Does the Agents page replace the flagged-off Tools › AI Chat, which is the
   same thing without a manifest? Proposal: yes, as a built-in
   `vidtsx/assistant` agent with no tools. (The Studio agent is not a
   candidate: it stays Studio-only, decision 6.)
3. (Resolved 2026-09-06, see 1.10.) Memory is per agent plus app-wide.
4. Which publisher key ships first, and where the private key lives (a
   password manager, never the repo or a machine folder).
5. (Resolved 2026-09-06.) Agent outputs file into the Asset Library, same
   pattern as the Studio agent. Image Studio stays a separate gallery.

## 13. After the first release

Wave-2 viewers and the agents that pull them in: `html-page` (Animated Web
Page, Product Demo), `slides` plus PPTX export via pptxgenjs (Presentation
Maker), still rendering with platform size presets (Still Social Post,
Thumbnail Lab), `character-bible` (Story, Comic Strip, Short Film),
`model-3d` (3D Prop Maker), `table` (Data Story), `frame-strip` (Video QA),
`audio` (Podcast Visualizer, Localizer). Interactions `reorder` and `edit`.
A metadata-only gallery feed (Q8f) listing free agents, and the store on
vidtsx-web for paid ones with per-buyer stamped downloads.
