# Agents — installable, declarative agents on top of the app's building blocks

> Status: PLAN (written 2026-09-04, after the V1 code freeze). Nothing here
> changes V1. Work starts after the V1 flip. Companion designs:
> `docs/NEXT_FEATURES_DESIGN.md` (Q7 packages, Q8 packs, Q11 CLI),
> `docs/studio/AGENT_MEMORY_DESIGN.md` (memory + skills as one mechanism),
> `docs/SKILLS.md`, `docs/flows-plan.md` (flows are built on the tool registry
from Stage 1; nodes are tools with ports, `run_flow` is a tool, sessions can
be frozen into flows).

## Start here (for the session that begins the work)

0. **Stages 0 through 5 are DONE (3, 4 and 5 on 2026-09-08).** Read each
   stage's "outcome" subsection before its successor: section 4 (Stage 1's
   four contract deltas, and the step 0 record — its last open row was
   measured during Stage 3 at **0 of 10**, so no runner-enforced stop was
   added), section 5 (Stage 2's five deltas, and the rule that a built-in needs
   no signature), section 6 (Stage 3's six deltas and its two house-rule
   judgements), section 7 (Stage 4's six deltas, the §7 line about "expired"
   that was wrong, and the starter UI it deferred), and section 8 (Stage 5's
   deltas, the two bugs that only a real run could find, and what the file
   association still needs from a packaged build). Then start at Stage 6
   (section 9). Agents are reachable from the UI behind `feature-flags.ts`
   `agents: false` — force-enabled in dev, hidden in production — and TWO
   built-in agents ship in `resources/agents/vidtsx/`.
1. Preconditions: the V1 flip has shipped as 1.0.0, and `check:types` plus
   `npx vitest run` are green on `main`. Confirm both before touching code.
2. Read sections 0, 1, and 2 in full, then only the stage you are on.
3. (Historical.) Stage 0 was to come before Stage 1, and Stage 1's step 0
   experiment before its code. The experiment was NOT run — see the record in
   section 4 — and the non-blocking `ask_user` form shipped on the decision
   rule alone. Two of its rows are still owed.
4. Rules that hold for every stage: nothing under
   `src/main/services/studio/` changes except the optional `agentId` field
   in 1.10 and — decided 2026-09-08, see the Stage 2 outcome —
   `project-package-unzip.ts` becoming a thin caller of the shared zip
   reader, since decision 6 is about the Studio AGENT and duplicating a
   security gate is worse than touching the file; tool ids are append-only;
   every new file follows CLAUDE.md (feature isolation, IPC-only bridge,
   ~300 lines, named exports).
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
| model ends its turn after asking, 10 runs | **RUN 2026-09-08 (Stage 3): 0 of 10 kept going** |
| extra tokens per question | not measured |

**The "model ends its turn" row: 0 of 10 (2026-09-08).** Ten real turns, in the
real app, on `claude-subscription`, against a throwaway agent
(`dev/asktest`) whose prompt was deliberately NEUTRAL about stopping — "Work in
small steps and use your judgement about when to ask" — carrying
`write_document`, `ask_user` and `list_artifacts`. Every trial got the same
brief ("write two hook variants as a document, then find out which one I want
you to develop"), ran in a fresh session, and was scored on the run stream: a
trial "kept going" if ANY tool call followed the `ask_user` call in the same
turn.

All ten produced exactly `write_document → ask_user` and stopped. None called a
tool after asking, and all ten persisted the question into `session.json`, which
is the round trip the non-blocking form depends on.

The decision rule says the runner enforces the stop only if MORE THAN 1 of 10
keeps going. **0 of 10, so no enforcement was added** — the tool's description
and its result text ("End your turn now and wait") are carrying it. If a later
agent or a different provider shows the failure, the change is still one place:
end the query after the `ask_user` result in `agent-runner.ts`.

The remaining rows are the long blocking waits, and they only matter if the
blocking form is ever reconsidered. It is not currently a candidate.

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

### Stage 2 outcome (2026-09-08) — what was built, and what it changes downstream

Both "done when" criteria are met from vitest: `agent-pack-script.test.ts` runs
the REAL `scripts/agent-pack.mjs` in a child process — `--check` on a good
folder, `--check` on a folder with three separate problems, then pack → sign →
install → scan — against temp roots. 53 new tests in 4 files (133 across 14 in
`services/agents/`); `check:types` at baseline (web 26, node 10); the full suite
green at 1617 passed.

**The §5 file list contradicted rule 4, and the answer was to split it.** §5
asks for two edits under `src/main/services/studio/`, which rule 4 forbids.
Asked and decided 2026-09-08:

- `project-package-unzip.ts` DOES become a thin caller of the new generic
  reader. The alternative was ~150 lines of zip-slip and hash-verification
  logic copied into an agents-side file, where the next fix would land in one
  copy and silently not the other. The 255 existing package tests pass
  unchanged, which is what makes the refactor safe to make.
- `package-open.ts` is NOT touched, and `fileAssociations` does not yet gain
  `vidtsxagent`. Double-click-to-install is convenience the Import button and
  drag-and-drop cover, `package-open.ts` holds ONE global pending slot that
  `studio-package-handlers.ts` claims (a second extension needs that slot to
  carry a kind, and its consumer to change with it), and none of it can be
  tested end to end until there is an Agents screen. **Stage 3 owns it.**

**Contract deltas — what Stage 3 onward codes against:**

1. `OpenedZipPackage` gained **`rawManifest`** and **`manifestBytes`**, and
   both fix real bugs found while writing the tests. A signature covers what
   the PUBLISHER wrote: verifying against the zod-parsed manifest would have
   failed on every package whose author omitted `description` (zod fills `''`)
   or carried a key zod strips. And the installed folder needs `agent.json` on
   disk — it is folder-as-truth — but `agent.json` describes the other entries
   rather than appearing among them, so `extractAll` never writes it. It is
   copied byte for byte, because a re-serialisation stops verifying.
2. `parseAgentManifest` now also enforces **entry-path safety** (the first
   zip-slip gate, via the moved `isSafeEntryPath`), duplicate entries, the
   per-entry and total size caps, and `AGENT_RESERVED_ENTRIES` — a manifest may
   never list `signature.json` or `licensee.json`. §1.1 always implied these;
   Stage 0 had left them to the reader, and the reader is the wrong place for
   a rule `agent-pack --check` must apply offline.
3. `ARTIFACT_KINDS` and `INTERACTION_KINDS` are now **values** in
   `shared/types/agents.ts`, with the types derived from them, because the
   validator needs the list at runtime.
4. `shared/agents/tool-ids.ts` (`AGENT_TOOL_IDS`) is a bundleable copy of the
   registry's ids. `agent-pack --check` and (from Stage 3) the renderer's
   capability summary need the names without importing every tool and, through
   them, Electron. `registry.test.ts` asserts the two are equal.
5. `isSafeEntryPath` moved to `shared/packages/entry-path.ts`;
   `shared/studio/project-package.ts` wraps it with its own path cap, so its
   callers and tests are unchanged.

**Two things are owed before an agent can carry the accent tag.**
*(The first was settled on 2026-09-08 — see §10 row 14. `publishers.ts` now
carries `vidtsx-1`, and a package signed with it reads "Verified by VidTSX" in
the real app. The paragraph is kept because its second half is still the rule.)*
`publishers.ts` shipped EMPTY, deliberately: no VidTSX signing key existed, so
no signature could honestly be attributed to us and every signed package read
"Signed, unverified publisher". Generating one is a two-minute job —
`node scripts/agent-pack.mjs --genkey` prints the private key to store outside
the repo (pointed at by `VIDTSX_AGENT_SIGNING_KEY`) and the exact
`publishers.ts` entry to paste — but it is Hasan's to run, because the private
half must never reach a session. Second: a package is matched to a publisher by
its KEY BYTES, never by the `keyId` it claims, and there is a test for exactly
that impersonation.

**Built-ins have no signature and need none** — they are inside the signed
installer. `readAgentFolder` therefore reports `signature: 'unsigned'` for
them, and the Stage 3 card must let `origin: 'builtin'` outrank the trust tag
rather than labelling a shipped agent "Unverified" (§1.7).

**Files as built:** `src/main/services/packages/zip-reader.ts` (the generic
half) with `studio/project-package-unzip.ts` reduced to the `.vidtsx` spec;
under `src/main/services/agents/`: `agent-package.ts`, `agent-signing.ts`,
`agent-store.ts`, `agent-updates.ts`, `agent-package-context.ts` (the seam that
reaches Electron, the tool registry and the TSX gate, so `agent-package.ts`
stays a pure function of its deps and is testable without an app),
`test-package-builder.ts` (test-only, and able to build BAD packages on
purpose); `src/shared/packages/entry-path.ts`, `src/shared/agents/publishers.ts`,
`src/shared/agents/tool-ids.ts`; `scripts/agent-pack.mjs`; four `paths.ts`
helpers; `resources/agents/` with a README; the `extraResources` line.

**Not started, and Stage 3 owns them:** no IPC handlers and no preload — the 14
channels still answer to nothing, and `buildAgentPackageDeps()` is written and
imported by nothing; the `.vidtsxagent` file association (above); the D14 gate
does not run under `agent-pack --check`, which validates everything pure but
cannot reach the module server from a plain node script, so a bad packaged TSX
is caught at install rather than at pack time.

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

### Stage 3 outcome (2026-09-08) — what was built, and what it changes downstream

**Scope, agreed with Hasan before starting.** §6 estimates ~3 sessions, so the
cut taken was "all of §6 except the starter tree", plus the two things Stage 2
left: the ten `ask_user` trials (run — see §4) and the `.vidtsxagent` file
association (deliberately NOT done, see below). `StarterFlow.tsx` and
`QuickStarts.tsx` are deferred to Stage 4, which already owns the starter
walker: `shared/agents/starter.ts` has `validateStarter` and nothing else, so
building the UI now would have meant inventing `nextNode` and `renderOpening`
for Stage 4 to rewrite. A new session opens on an empty chat box instead.

**The done-when criterion is met in the REAL app**, not only from vitest. A
fixture session carrying one of each wave-1 artifact was seeded on disk and
driven over CDP:

| artifact | viewer showed |
|---|---|
| `document-1` | rendered markdown — H1, bold runs, list items |
| `composition-2` | `IsolatedPreview` webview on `127.0.0.1:3200/preview`, transport reading `00:00.00 / 00:03.00` |
| `image-set-3` | the image, served as `/asset?path=…` |
| `job-4` | "Render queue · Done" and "The finished video is artifact video-5" |
| `video-5` | a live `<video>` with the scrub bar at `00:00 / 00:27` |

and every handoff landed in its target screen:

| action | result |
|---|---|
| Save to Library | toast naming `agents/stage-3-fixture/fixture-session/two-hook-variants.md`, Assets screen active |
| Copy path | the workspace TSX path on the clipboard |
| Open in TSX | Creator active with the project `fixture-card / v1.tsx` open |
| Render | Queue active, a real row rendering `fixture-card.tsx` MP4/1080p |
| Add to Studio | disabled with no open project (and the IPC refuses with the same sentence); with a project open, the shot landed at `projects/t5-1080p-cut-xfade/shots/fixture-card` |
| Open folder | IPC success (it shells out to Explorer) |

**The render round trip completed for real.** The action-bar Render minted
`job-6`, the bridge enqueued it into the app's ONE render queue under that job
id with an output path inside the session's library folder, the queue rendered
it, the renderer reported completion over `AGENT_JOB_UPDATE`, and main filed
`agents/stage-3-fixture/fixture-session/fixture-card.mp4` into the asset library
(`origin: generated`, the composition title as its description), appended
`video-7`, and wrote `resultArtifactId: video-7` back onto `job-6`. That is
§1.5's long-job shape and §1.11's filing, end to end, in the app.

**Contract deltas — what Stage 4 onward codes against:**

1. **Three new channels.** `AGENT_ARTIFACT_RESOLVE` is what §1.5's "the viewer
   asks main to re-transpile and serve on demand" actually needed: viewers are
   plain components with no IPC, so ONE channel returns whatever the kind needs
   — markdown text, a freshly served `moduleUrl`, or `/asset?path=` urls — and
   no path reaches the renderer. `AGENT_JOB_UPDATE` is the render queue
   reporting back (it lives in the renderer, so main cannot subscribe to it the
   way it subscribes to the video engine). `AGENT_SESSION_RENAME` is §6's
   session list, which says "rename".
2. **`AgentSession` gained `libraryFolder` and `brandId`.** §1.11 fixes the
   output folder at creation and says renaming must not move already-filed
   media — which only works if the folder is STORED rather than recomputed from
   the current title. `brandId` is the library default, read once at create, and
   it is what `VideoJobDeps.filing` and the render filing both take.
3. **`AgentJobRequest` gained `tsxPath` and `outputPath`; `JobPayload` gained
   `outputRelPath`.** The render queue takes a FILE PATH, and only the session
   knows where §1.11 wants the output — so `buildQueueRequest` in
   `render-jobs.ts` completes the half-request the tool returns. The
   library-relative `outputRelPath` is stamped on the job artifact so a session
   reopened after a restart can reconcile by asking the disk.
4. **The runner no longer emits `job-request` itself.** Stage 1 had it emit
   straight after calling the hook; the event has to carry paths only the
   session service can supply, so `AgentRunnerHooks.requestJob` now owns the
   emit. The same change gave `persistPendingInteraction` and `requestJob` a
   `sessionId` argument — brokers are per session and the hooks were being asked
   to guess which session had asked.
5. **`AGENTS_INSPECT` with NEITHER an id nor a path opens the OS picker**, with
   `VIDTSX_AGENT_PICK` standing in for it — the fourth such stand-in, matching
   the three in `docs/ui-automation-cdp.md`. Import is therefore drivable end to
   end, which is how the import dialog was verified.
6. **`AgentArtifactActionRequest` gained `projectId`**, and the response gained
   `open`. "Add to Studio" needs the open Studio project, which the renderer
   knows from `useOpenProject` and main will not guess; "Open in TSX" writes a
   Creator project and hands back the paths so the target screen can open it.

**Two house-rule judgements, both visible in the code.** §1.3 names Image
Studio's `ImageCard` / `ImageLightbox` as what `ImageSetViewer` reuses, and
`RenderItem` for the job viewer. Both live inside OTHER features, and a viewer
that Flows also consumes must not reach into one — so the grid, the lightbox and
the job row are written fresh in `renderer/components/artifact-viewers/`. They
are small; the isolation rule is worth more than the duplication. Second: the
agents feature DOES import `@features/render-queue` and `@features/player`,
following the precedent `features/motion` and `features/studio` already set —
the queue and the player are app-level services in this codebase, not peer
features.

**A bug the real app found that the tests did not.** Opening an agent created a
spurious empty session every time, because the workspace read "the session list
has not answered yet" as "there are no sessions". `useAgentSessions` now exposes
`loaded` and the workspace waits for it. Worth remembering as the argument for
driving the app: nothing in the unit tests could have seen it.

**Not started, and later stages own them:**

- **The `.vidtsxagent` file association** — still owed, and still exactly as
  Stage 2 left it. `package-open.ts` holds ONE global pending slot that
  `studio-package-handlers.ts` claims; a second extension needs that slot to
  carry a kind and its consumer to change with it, and rule 4 covers that file.
  Asked and decided with Hasan 2026-09-08: SKIP for this stage. Import and
  drag-and-drop both work, double-click is convenience, and it cannot be
  verified end to end without a packaged installer build. Land it with Stage 5,
  when there is a shipped agent to double-click a package against.
- **Interactions are a placeholder.** `ask_user` ships and works — the ten
  trials in §4 prove the round trip — so a session CAN end up holding a
  question. `PendingQuestionCard` shows what was asked and offers "Dismiss and
  keep chatting" (which sends the `cancelled` reply the broker understands), so
  the state is legible and escapable. Stage 4 replaces it with the real
  `form` / `pick` / `approve` registry.
- **`publishers.ts` is still EMPTY**, so every signed package reads "Signed,
  unverified publisher". The card and both dialogs handle all four outcomes
  today, including the rule that `origin: 'builtin'` outranks the trust tag —
  there is a test for that specific case, because a shipped agent reading
  "Unverified. Use at your own risk" is the exact thing Stage 2 warned about.
  Generating the key is Hasan's (`node scripts/agent-pack.mjs --genkey`).
- No memory button on the chat header (§1.10 is Stage 4), no `run_flow`, no
  `propose_memory`, and the manifest's `subagents` are still parsed and ignored.

**Files as built.** Main: `services/agents/{agent-sessions, agent-service,
session-context, render-jobs, artifact-paths, artifact-actions, job-notes}.ts`,
`ipc/{agent-handlers, agent-run-handlers}.ts`, `ipc/registrations/agents.ts`,
`preload/api/agents.ts`, plus the `electron.d.ts` block. Renderer, shared with
Flows: `renderer/components/artifact-viewers/{registry, types, ViewerFrame,
DocumentViewer, CompositionViewer, VideoViewer, ImageSetViewer, JobViewer}` and
`renderer/components/agent-chat/AgentMessageRow.tsx`. Feature:
`features/agents/` — `components/{AgentsScreen, AgentGallery, AgentCard,
AgentDetailsDialog, ImportAgentDialog, TrustBadge, AgentWorkspace, AgentChat,
SessionList, PendingQuestionCard}.tsx`, `components/stage/{ArtifactStage,
Filmstrip, ActionBar}.tsx`, `hooks/{useInstalledAgents, useAgentSessions,
useAgentProviders, useAgentRun, useAgentRenderBridge, useArtifactViewerData,
useArtifactActions}.ts`, `services/{event-folding, manifest-summary}.ts`,
`types.ts`, `index.ts`. Touched elsewhere: `App.tsx`, `Sidebar.tsx`,
`feature-flags.ts` (`agents: false`), `render-queue/types.ts` +
`RenderQueueContext.tsx` (optional `id` and `outputPath` on `addJob`), and
`motion/hooks/useMotionProject.ts` (the `vidtsx:creator-open` listener).
38 new tests in 4 files — 171 across 18 in the two agents folders.

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

### Stage 4 outcome (2026-09-08) — what was built, and what it changes downstream

**Scope, agreed with Hasan before starting.** §7 estimates ~1 session and Stage 3
handed this stage the starter tree as well, so the cut taken was: the whole of
§7 as written — interactions and the memory half — **plus the pure starter
walker** (`nextNode`, `renderOpening`, with tests), deferring only
`StarterFlow.tsx` and `QuickStarts.tsx` to Stage 5. The argument for that split:
Motion Post is the first agent that actually carries a `starter` tree in its
manifest, so building the UI now means driving it against a tree invented for
the purpose, while building it in Stage 5 means driving it against the real one.
Stage 5 inherits two small components, not a design problem — the walker they
need is written and tested.

**Both "done when" criteria are met in the REAL app**, not only from vitest.
A throwaway agent (`dev/stage4`, `memory: { propose: true }`, tools
`write_document` / `ask_user` / `list_artifacts` / `propose_memory`) was packed,
installed and driven over CDP on `claude-subscription`.

Criterion 1 — *a scripted test-agent turn asks for a pick between two documents
and the chosen title appears in the model's next message*:

| step | what happened |
|---|---|
| the turn | `write_document` × 2, then one `ask_user` (`kind: "pick"`), then it stopped |
| the card | the real `PickCard` on the stage: two candidates with detail lines, "Choose one", Send locked on "Nothing chosen yet" |
| the click | second candidate selected, `aria-pressed="true"`, Send unlocked |
| the reply | `[Answer to question q-31a3da46] confession: I timed how long I lasted before checking my phone` |
| the model | named the chosen hook and built on it — `document-3` is titled "… — 6s reel build" |

The other two wave-1 cards were driven too, though §7 does not ask for them:
`FormCard` collected a select + a required text + a multiline in one card
(Send blocked on "Platform is required" until filled) and delivered
`platform: Reels; tone: dry and understated; notes: no music, no captions`;
`ApproveCard` went `0 of 3 decided` → `3 of 3` with Send locked in between and
delivered `document-1: approved (…); document-2: approved (…); document-3:
rejected (…)`. "Skip and chat" was exercised on a live card and sent the
`cancelled` reply the broker already understood.

Criterion 2 — *a session accepts a proposed rule scoped to the agent, the next
Studio session does not see it, while an "all agents" rule is visible in both*:

| where | what it showed |
|---|---|
| the card | "Remember this?", the proposed text editable, and the scope line — "Stage Four only" / "All agents" |
| accepted `agent` | stored with `agentId: dev/stage4`, `source: { by: 'agent', agentId: 'dev/stage4' }` |
| accepted `all` | stored with no `agentId` — app-wide |
| agents dialog, agent tab | the agent-scoped rule only |
| agents dialog, "All agents" tab | the two app-wide rules only |
| **Studio's own dialog** | "Assistant memory", no scope tabs, exactly the two app-wide rules — **the agent-scoped rule is absent** |

And the prompt side proved itself unprompted: a later turn in the agent session
replied "**applied because of 'keep every hook under eight words'**" — the
agent-scoped rule, reaching that agent's composed block and no other.

**The four decisions §7 left open, and how they were resolved:**

1. **Interactions live in `src/renderer/components/interactions/`** (§1.3), not
   `src/features/agents/interactions/` (§7's file list). §1.3 is the one that
   gives the reason — Flows shares the registry for its run checkpoints — and
   Stage 3 set the precedent with `artifact-viewers/`. **The plan contradicts
   itself here; §1.3 wins.**
2. **No zod copy of the `ask_user` payloads in `shared/types/agents.ts`.** That
   file's header says types only because both processes import it, and
   `tools/ask-user.ts` already validates at the tool boundary — the one place
   untrusted model input enters. Everything downstream is a payload the app
   itself built, so a second schema would validate our own output. The one real
   gap zod at the boundary does not close is a `session.json` that was
   hand-edited or written by an older build: its `pendingInteraction` reaches a
   card without ever passing the tool. `shared/agents/interactions.ts` closes
   exactly that with pure structural guards (no zod, no bundle cost), and
   `readAgentSession` drops a malformed question rather than handing it to the
   registry. There is a test for it, and the first thing the guard caught was a
   fixture in `agent-sessions.test.ts` carrying `candidates: []` — a pick card
   with nothing to click, which `ask-user.ts` also refuses.
3. **The `agentId` touch to `src/main/services/studio/` was asked and approved**
   (rule 4). It is 44 lines across two files: `agent-memory.ts` carries the
   field through `UpsertMemoryInput`, `normalizeRecord` and the record build,
   loosens the agent-provenance branch so `projectId` is optional, and counts
   `MAX_ACTIVE_RULES` **per scope**; `agent-memory-prompt.ts` gains `agentId` on
   the options and one filter clause in `composeMemoryBlock` **and one in
   `composeShotStyleMemory`** — that second one is what keeps agent-scoped rules
   out of Studio's shot pipeline, and it has its own test.
   `agent-memory-proposals.ts` is NOT touched: agents got their own
   session-keyed queue.
4. **`MemoryDialog` moved to `src/renderer/components/memory/`**, asked and
   approved, as a pure `git mv` of three files (`MemoryDialog`,
   `MemoryEntryForm`, `useAgentMemory`) with `formatDate` inlined so nothing
   reaches back into `features/studio/`. `AgentPanel.tsx` changed one import
   line. It was already at the ~300-line house limit, so `MemoryRow` came out
   into its own file. Studio's own Memory button was clicked in the real app
   after the move, and behaves exactly as before.

**Contract deltas — what Stage 5 onward codes against:**

1. **`InteractionReply.values` has a convention now, and it is load-bearing.**
   The KEY is the model's own id and the VALUE is the words the user read,
   because the broker renders entries as `key: value` into the fixed
   `[Answer to question <id>] …` message. `pick` keys by candidate id and values
   with the label (which is what makes the §7 criterion true at all); `approve`
   keys by item id and values `approved (label)` / `rejected (label)`; `form`
   keys by field id and OMITS a skipped optional field rather than sending an
   empty string. That shaping lives in
   `renderer/components/interactions/values.ts` as pure functions — the renderer
   has no component test rig (vitest is node-only, `*.test.ts` only), so keeping
   it out of the components is what makes it checkable.
2. **`AgentRunEvent` gained `memory-proposal`**, and
   `AGENT_MEMORY_PROPOSALS_GET` / `AGENT_MEMORY_PROPOSAL_RESOLVE` are two new
   channels. The card arrives live on the run stream and is re-fetched on mount,
   the same two sources the Studio proposal path uses, because the queue lives in
   main precisely so navigation cannot lose it.
3. **`StudioMemorySource`'s agent variant is now
   `{ by: 'agent'; projectId?; agentId?; acceptedAt }`.** A Studio proposal names
   the project; an agent proposal names the agent. Provenance is stamped in main
   on both paths and is not a field of either request, so the renderer cannot
   forge it.
4. **`propose_memory` is opt-in at RUN time, not at install.** An agent that
   lists the tool without declaring `memory: { propose: true }` gets the read
   side only — the memory block still composes into its prompt, it just cannot
   ask to write. Filtered in `agent-runner.send` rather than in the validator so
   an already-installed package starts working the moment its manifest declares
   the field. `AGENT_TOOL_IDS` gained `propose_memory` (append-only, §11).
5. **The memory block is filled.** `agent-memory-block.ts` composes it per turn
   (app-wide + this agent's, brand filter unchanged) and `buildRunContext` puts
   it on the run context, so §1.2 step 3's trailing block is no longer a
   parameter nobody fills. A read failure is logged and swallowed — a session
   that cannot read memory still runs.
6. **`§7's "a pending request that survives an app restart shows as expired" is
   wrong, and was not implemented.** That line was written while the blocking
   `ask_user` form was still a candidate. Under the non-blocking form that
   shipped, the reply is an ordinary next user message, so a restored question is
   *fully answerable* — `InteractionBroker.adopt` exists for exactly that. The
   card says "Asked in an earlier run — your answer still reaches the agent"
   instead, driven by a `restored` flag `useAgentRun` sets when the question came
   off disk rather than off the stream. This was proven by accident: an HMR
   reload mid-run reset the app to its home screen, and re-opening the workspace
   brought the question back and answered it successfully.

**A driver trap worth recording, and the fix that is not a test hack.** The
first attempt to click a pick candidate clicked the **filmstrip thumbnail**
instead: the filmstrip shows the same document titles the candidates do, and the
usual "sort by `textContent.length`, take the shortest" rule from
`docs/ui-automation-cdp.md` picks the thumbnail, because the candidate button
also carries a `detail` line. A direct `.click()` on it changed nothing, which
looked like a broken handler for a while. The card now publishes
`data-interaction-card="<kind>"` on its root and `data-interaction-option` +
`aria-pressed` on each candidate — the same convention `MemoryDialog` already
uses with `data-memory-row` — so a caller can scope to the card. `aria-pressed`
earns its place independently.

**Files as built.** Shared with Flows:
`renderer/components/interactions/{types, registry, InteractionShell, FormCard,
PickCard, ApproveCard, values}.ts(x)` and
`renderer/components/memory/{MemoryDialog, MemoryEntryForm, MemoryRow,
useAgentMemory}` (the move). Shared: `shared/agents/interactions.ts` (the
guards), `shared/agents/starter.ts` (+ `nextNode`, `renderOpening`),
`shared/types/agents.ts` (`AgentMemoryProposal`, `AgentMemoryScope`, the run
event), `shared/types/studio-memory.ts` (`agentId`, the source variant),
`shared/agents/tool-ids.ts`. Main: `services/agents/{memory-proposals,
agent-memory-block}.ts`, `services/agents/tools/propose-memory.ts`,
`ipc/agent-memory-handlers.ts`, and the two channels. Feature:
`features/agents/hooks/{useInteractionPreviews, useAgentMemoryProposals}.ts`,
`features/agents/components/MemoryProposalCard.tsx`, with
`PendingQuestionCard.tsx` **deleted** — the Stage 3 placeholder it replaced.
Touched: `agent-runner.ts`, `agent-sessions.ts`, `session-context.ts`,
`AgentChat.tsx`, `AgentWorkspace.tsx`, `AgentPanel.tsx` (one import),
`memory-handlers.ts`, `electron.d.ts`, the two approved `services/studio/` files.
43 new tests in 5 files; 1698 passing overall, `check:types` at baseline
(web 26, node 10).

**Not started, and later stages own them:**

- **`StarterFlow.tsx` and `QuickStarts.tsx`** — the agreed cut, above. The
  walker they consume is written and tested (`nextNode` covers the `$other`
  branch, `select: "many"`, an unanswered node, and a node the tree no longer
  has; `renderOpening` covers labels, typed text, joined many-selects and
  partial answers, which must never show the user a raw `{{ref}}`).
  `StarterAnswers` is unchanged, so `prompt-compose.ts` needs nothing.
- **The `.vidtsxagent` file association** — still owed, still exactly as Stages 2
  and 3 left it, still meant to land with Stage 5.
- ~~**`publishers.ts` is still EMPTY.**~~ **Done 2026-09-08, after the Stage 4
  commit.** Hasan ran `--genkey` and pasted the public half; `publishers.ts`
  carries `vidtsx-1` and the accent tag was proven end to end (§10 row 14).
  `publishers.test.ts` guards the shipped list, because a mistyped key here
  fails SILENTLY — verification matches on key bytes, so a bad entry simply
  never matches and every VidTSX package reads "Signed, unverified publisher"
  with no error. Nothing else in the suite would notice: every other signing
  test injects its own list.
- **`reorder` and `edit` interactions** are wave 2 (§13) — one registry entry
  each, and no change to `ArtifactStage` or `AgentWorkspace`.
- No `run_flow`; the manifest's `subagents` are still parsed and ignored.
- `assets/agents/stage-3-fixture/` is still in the asset library. Deleting the
  folder from disk would leave stale rows in `assets/.vidtsx/index.json`, and
  there is no library-delete IPC to drive — it wants the Assets screen's own
  delete flow, on a real library, which was not worth the risk unattended.

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

### Stage 5 outcome (2026-09-08) — what was built, and what it changes downstream

**Scope, agreed with Hasan before starting.** §8 estimates ~1 session, but
Stages 2, 3 and 4 had each deferred something into it, so the agreed cut was all
three: the built-in agents, the starter UI (`StarterFlow.tsx` + `QuickStarts.tsx`
— Stage 4 deliberately left these so they could be driven against Motion Post's
REAL tree rather than one invented for a fixture), and the `.vidtsxagent` file
association. Three of the four open decisions were put to Hasan and answered:

1. **§8's "TWO built-in agents" stands**, and the second one resolves open
   question 2: a built-in `vidtsx/assistant` with `tools: []` — a plain chat
   companion that points at the screen which actually makes each thing. Tools ›
   AI Chat is NOT retired here; that is a later stage's call.
2. **Motion Post ships UNSIGNED**, as the Stage 2 outcome says a built-in should:
   it is inside the signed installer, `readAgentFolder` reports
   `signature: 'unsigned'`, and `origin: 'builtin'` outranks the trust tag. Both
   cards read "Built-in" in the real app; neither reads "Unverified".
3. **`package-open.ts` MOVED** rather than being widened where it sat — see the
   deltas below.

The fourth decision was the session's to make (see "The starter runs before the
session exists").

**The starter runs BEFORE the session exists.** `AGENT_SESSION_CREATE` already
accepts `starter`, but Stage 3's workspace created a session the moment a
provider resolved, which would have left the tree with nowhere to put its
answers but a patch channel. Deferring creation instead needs no new IPC, and it
is better behaviour on its own terms: a user who backs out of the questions
leaves no empty session folder behind (the same class of bug Stage 3 found), and
the answers can NAME the session — which matters more than a label, because
§1.11 fixes the library folder from the title at creation and never moves it.
Without a title every starter session would file its media into
`agents/motion-post/new-session` together. `starterTitle` takes the longest
thing the user actually typed; the first real run filed into
`agents/motion-post/batching-your-camera-roll-once-a-week-so-editing/`.

**Contract deltas — what Stage 6 onward codes against:**

1. **`InteractionCardProps` gained `initialValues`.** §1.9 requires Back to
   restore the answer the user gave a step, and a card that owns its own state
   cannot do that on its own. Mid-run `ask_user` never passes it — a fresh
   question starts blank — so the only caller is the starter.
2. **The starter renders through the SAME cards, as two synthetic requests per
   node.** A select node becomes a `pick` payload; a text node becomes a `form`
   with one field; `allowOther` appends a `$other` candidate whose choice routes
   to a second card that collects the typed words. That second step is what lets
   §1.9's "Other…" work with no change to any card. The mapping lives in
   `features/agents/services/starter-cards.ts` as pure functions, for the same
   reason `interactions/values.ts` is pure: the renderer has no component test
   rig, so the half that decides what the user is asked and what their click
   MEANS is the half that must be testable.
3. **`package-open.ts` became `services/packages/pending-open.ts`** (asked and
   approved, rule 4). The pending slot now carries a KIND, and a claim names the
   kind it can handle: `takePendingPackage('project')` returns nothing when the
   waiting file is an agent package. Without that, Studio's project browser —
   which mounts on almost every launch, and before Agents does — would swallow a
   double-clicked `.vidtsxagent` and drop it. Two new channels,
   `AGENTS_PACKAGE_OPEN_FILE` (push, navigates) and `AGENTS_PENDING_PACKAGE`
   (the claim), mirror the Studio pair exactly; `electron-builder.yml` gained the
   `vidtsxagent` association. One thing the Studio pair did not need:
   getting the user to the Agents SCREEN is not enough, because the GALLERY is
   what claims the path and it is not mounted while an agent workspace is open.
   `AgentsScreen` therefore closes the workspace on that event. Found by testing
   it — the first attempt landed on the screen with the workspace still up and
   the package sat unclaimed.
4. **`InstalledAgent` gained `iconUrl`, filled in by the IPC layer.** §8 asks for
   an `icon.png` and the manifest has always had `icon`, but nothing read it —
   `AgentCard` drew the same lucide glyph for every agent, so two built-ins would
   have shipped as two identical tiles. The url is built with `assetUrlFor`
   (the `/asset` route the image viewers already use), so no path reaches the
   renderer, and a preview server that will not start costs the picture and
   nothing else.
5. **`useAgentRenderBridge` takes the session's artifacts and derives its job
   mapping from them.** See the bug below.
6. **`busy` resets when the open session changes** (`useAgentRun`). A run belongs
   to the session that started it.

**Two real bugs the app found that no unit test could have.** Both are in the
class Stage 3 and Stage 4 each found one of, and both were found by running
Motion Post for real rather than by reading the code.

*The render that finished and was never filed.* Every run produced its MP4 —
in the right library folder, with the queue row reading Done — and the session
still believed it was rendering, because the `completed` update never reached
main. Calling `AGENT_JOB_UPDATE` by hand filed it correctly, which proved main's
half right and put the fault in the renderer.

The cause is one line in `RenderQueueContext.startNextJob`, and it is not a bug
there:

    if (result.success && result.jobId) {
      setJobs((prev) => prev.map((j) => (j.id === nextJob.id ? { ...j, id: result.jobId! } : j)));
    }

`renderStart` mints main's own job id — the id `RENDER_PROGRESS` and
`RENDER_COMPLETE` carry — and the queue adopts it. So the optional `id` Stage 3
added to `addJob` (so the row and the artifact would be the same job) holds only
until the render STARTS. The agent hears `pending` and `running`, the row is
then renamed underneath it, and the completion is reported for an id no artifact
carries. Three runs finished their video and none of them knew it.

The fix is `features/agents/services/render-job-match.ts`: match the row to the
artifact by job id first, and fall back to the OUTPUT PATH, which the bridge
supplies at submit time, the queue keeps verbatim, and the artifact stores as
`outputRelPath`. It is a pure module with its own tests, because this is the
half that decides whether a finished render is ever filed. Nothing outside the
agents feature changes — in particular the queue's id swap is left exactly as it
is, since main's id is what its own events are keyed by.

An earlier attempt at this blamed the in-memory `useRef` map the bridge used to
hold the mapping. That map IS fragile — it is lost whenever the workspace
unmounts, which includes reopening a session whose render is still queued — so
deriving the mapping from the session's artifacts is kept. But it was not the
bug, and replacing the ref alone did not fix a thing: the second run failed
identically. Worth recording, because the plausible explanation looked right for
two runs.

*The composer locked behind a Stop button for a run it had nothing to do with.*
`busy` lived in `useAgentRun` and was never reset when `sessionId` changed, so
starting a new session while a turn was in flight carried the old session's
`busy` across and `send` refused every message. One line in the session-open
effect.

**`reconcileSessionRenderJobs` proved itself, unprompted.** Before the bridge fix
was written, run 2's session was left with a `running` job and its MP4 on disk.
Simply opening that session later filed the video and appended the artifact —
§1.5's "a render that finished while the session was closed is reconciled on
open", working in the real app, and the reason the live path is correctly
described in `render-jobs.ts` as an optimisation rather than the only route.

**Motion Post as written.** `agent.json` declares `write_document`,
`generate_composition`, `edit_composition`, `render_composition`, `ask_user`,
`list_artifacts` and `propose_memory` (with `memory: { propose: true }`, so §7's
own memory criterion is true for the shipped agent and not only for the
throwaway one Stage 4 used), the four wave-1 artifact kinds, the three wave-1
interactions, and §1.1's starter tree with a fourth `goal` option and three
quick starts. It declares no `updateUrl`: a built-in updates with the app, so a
"Check for update" item would be a lie. `minAppVersion` is **1.0.0**, not the
1.1.0 the §1.1 example shows — the manifest is validated against the RUNNING
app version, so 1.1.0 would make the built-in unloadable in the very build that
ships it. Stage 6 raises both together at the release bump.

`AGENT.md` is a seven-step workflow, and the steps that matter are the ones that
say END YOUR TURN — after `ask_user` and after `render_composition` — because
the non-blocking form (§1.5) depends on the model actually stopping. It does:
every run ended its turn on the pick, on the approve, and on the render.

`skills/social-motion/SKILL.md` is craft, not TSX rules — the generation
pipeline has its own system prompt for those and repeating them would only
create a second source of truth. It carries timing (4–8 s, 2–4 beats, land 10–15
frames before the end), text hierarchy (one hook of eight words or fewer, sizes
per platform), safe zones (12 % top and bottom on vertical), and an easing
vocabulary. It visibly lands: the first composition came back at 1080×1920 with
`hookSize: 112`, `supportSize: 52`, line heights 1.1 and 1.35, and
`Easing.bezier(0.16, 1, 0.3, 1)` / `Easing.out(Easing.cubic)` /
`Easing.inOut(Easing.cubic)` named exactly as the skill names them.

**Files as built.** New: `resources/agents/vidtsx/motion-post/{agent.json,
AGENT.md, skills/social-motion/SKILL.md, icon.png}`,
`resources/agents/vidtsx/assistant/{agent.json, AGENT.md, icon.png}`;
`features/agents/components/{StarterFlow, QuickStarts}.tsx`,
`features/agents/hooks/useAgentStarter.ts`,
`features/agents/services/{starter-cards, render-job-match}.ts` (+ tests);
`main/services/packages/pending-open.ts` (+ test, both `git mv`d out of
`services/studio/`). Touched: `AgentWorkspace.tsx` (the starter orchestration
moved into the hook, so the component is back under the house limit),
`AgentChat.tsx` (prefill, quick starts, the disabled-composer hint),
`AgentCard.tsx` (the icon), `AgentGallery.tsx` (the pending claim),
`AgentsScreen.tsx` (closing the workspace when a package arrives — see below),
`useAgentRun.ts`, `useAgentRenderBridge.ts`, `useAgentSessions.ts`,
`interactions/{types, FormCard, PickCard}`, `main/index.ts`,
`agent-handlers.ts`, `registrations/agents.ts`, `studio-package-handlers.ts`,
`preload/api/agents.ts`, `App.tsx`, `electron.d.ts`, `channels.ts`,
`ipc/types/agents.ts`, `types/agents.ts`, `electron-builder.yml`.

**Not done, and Stage 6 owns them:**

- **The file association cannot be fully verified from a dev tree.** Everything
  up to the OS is proven: a second Electron instance launched with a
  `.vidtsxagent` on its argv forwards through `second-instance`, main parks it
  as `kind: 'agent'`, the window navigates to Agents, and the gallery claims the
  path and opens the import dialog on it. What is NOT proven is the part
  `electron-builder.yml` owns — that Windows actually registers the extension
  and hands the path to the app on double-click. That needs a packaged installer
  build, which is Stage 6's own checklist item.
- The `agents` manifest field (SDK subagents) is still parsed and ignored, and
  there is still no `run_flow`.

## 9. Stage 6 — Hardening, docs, release — ~1 session

- Cancel mid-render leaves no orphan job; cancel mid-`ask_user` resolves.
- Corrupt `artifacts.json` / `chat.json` rotate, never delete (store rule).
- Content safety: `generate_image` passes through `checkGenerationPrompt`
  (on `imageEngine`), as `generate_video` does on `videoEngine`; verify from a
  tool call. **`generate_composition` does NOT and must not** — see the Stage 6
  outcome: `CONTENT_SAFETY_DESIGN.md` D0.2 gives the LLM surfaces zero hooks by
  design.
- Usage: every agent LLM and image call logs `featureSource: 'agent'`; the
  AI usage screen groups by agent id.
- `docs/AGENT_PACKAGE_SPEC.md` for authors (manifest, folder layout,
  signing, `agent-pack.mjs`) and a starter folder under
  `docs/examples/agent-starter/`.
- STATUS.md entry, flag flip `agents: true`, installer rebuild, CDP smoke
  recipe added to `docs/ui-automation-cdp.md`.

### Stage 6 outcome (2026-09-08) — what was built, and what is left

**Scope, agreed with Hasan before starting.** §9 estimates ~1 session, and Stage
5 handed over four more things, so the cut was put as four questions and
answered: usage accounting **done properly** rather than cut; the queue's id
rewrite **NOT** fixed at source (the inverted match instead); Tools › AI Chat
**left in place**, closing open question 2 with a decision rather than a
deletion; and the content-safety row driven for real, because an image provider
is configured on this machine.

**§9's content-safety line is wrong, and the correction matters.** It says
`generate_image` and `generate_composition` "already pass through
`checkGenerationPrompt`". Only `generate_image` does — through `imageEngine`,
as `generate_video` does through `videoEngine`. TSX generation has no
moderation hook and **must not get one**: `CONTENT_SAFETY_DESIGN.md` D0.2 gives
the LLM surfaces zero hooks by design, so that text false positives are
structurally impossible rather than threshold-tuned away. Same class of error as
§7's "expired" line.

**Four bullets of §9 were already done.** `artifacts.json` and `session.json`
rotated aside on a parse failure from Stage 1 and Stage 3, with tests. Only
`chat.json` had a real gap, and it was the worst-placed one: a transcript that
PARSED but held the wrong shape was read as an empty list, which the next
`appendAgentChat` then wrote back over the history. Bad JSON was safe and good
JSON of the wrong shape destroyed the session silently. `readJsonFile` now takes
a shape check and rotates on either failure.

**Contract deltas:**

1. **`matchRenderRow`** in `render-job-match.ts` — the artifact → row direction,
   beside Stage 5's row → artifact `matchRenderJob`. Both are needed and neither
   is derivable from the other in a component: the reporting effect walks the
   ROWS and asks which artifact each belongs to, while the stage holds ONE
   artifact and asks which row shows its progress. Stage 5 fixed only the first,
   so from the moment a render actually started the stage showed no progress and
   no Cancel button — §9's first bullet had no button to press.
2. **A settled job is not a pending one.** `pendingRenderJobs` excluded only
   jobs with a `resultArtifactId`; it now also excludes `completed`, `cancelled`
   and `failed` — the rule `reconcileSessionRenderJobs` already applied on
   session open. See the orphan below.
3. **A user's cancel is not overwritten by its own error.**
   `applyRenderJobUpdate` refuses a `failed` update on an artifact that is
   already `cancelled`. Cancelling reports TWICE — the queue marks the row
   cancelled, then main reports the render's own completion, which failed with
   "renderMedia() got cancelled" — and without this the second one won, so a
   render the user deliberately stopped read as Failed with what looked like an
   error. Only `failed` is refused, so a queue Retry (failed → running → done)
   still works.
4. **`AiUsageEntry.agentId`**, `AiUsageFilter.agentId`, `AiUsageAgentTotal`, an
   `agent_id` column with an additive migration, `AI_USAGE_GET_AGENTS`, and
   `AiUsageByAgent` on the AI page. See below.
5. **`generateImageAsset` takes `featureSource` and `agentId`.** It hard-coded
   `'studio-shot-asset'`, so every agent image was logged as Studio's. The
   default is unchanged, so Studio's own calls are untouched.
6. `VideoGenerationRequest`, `VideoJobRecord` and `VideoUsageEntry` gained
   `agentId?` — three additive lines beside the `featureSource` they already
   carried, so the moment an agent declares `generate_video` its clips are
   attributed. No shipped agent declares it yet.

**Usage accounting, done rather than cut — and it was a schema change.**
`featureSource: 'agent'` cannot say WHICH agent, and never will, because every
agent shares the one source. So: `agent_id TEXT` on `ai_usage_entries`, added by
`addMissingColumns` at open (`CREATE TABLE IF NOT EXISTS` does nothing to a
table that already exists, so an upgrading user would otherwise have every
insert throw and lose the whole usage log over a column only agents fill), the
index created afterwards because it names that column, and the by-agent table on
the AI page rendering only once an agent has actually run. Rows with no
`agent_id` are excluded rather than bucketed as "unknown" — everything the app
does outside an agent is one of those.

Two producer-side bugs turned up on the way. The first is delta 5. The second is
that attributing only the runner's chat turns would have credited each agent
with a fraction of what it spends: of Motion Post's **41 logged requests** only
about six per run are chat turns, and the rest are the composition pipeline's
own calls — which is where Stage 5 measured two thirds of a run's wall clock.
`buildAgentTsxDeps` therefore takes the agent id too.

`ai-usage-db.test.ts` is **the first test this repo has had against the real
usage store**. `better-sqlite3` is built against Electron's ABI and cannot load
under vitest, which is why there was none; node ships its own SQLite, and the
slice of the better-sqlite3 surface this module uses adapts in a dozen lines. A
migration test has to be a real database — the whole question is what happens to
a table that already exists without the column. The migration then ran for real
on this machine's own database (`[ai-usage-db] Added agent_id to the AI usage
table` in the app log).

**An orphan, found by driving, that no unit test would have reached.**
Cancelling a render left the NEXT one stuck at "Running" for ever. An agent
asked to render the same composition twice gets two `job` artifacts sharing ONE
output path — `buildQueueRequest` derives the path from the composition — and
with the first still counted as pending, `matchRenderJob` matched every update
meant for the second against the FIRST by path. The cancelled job absorbed the
second job's reports, and the second was left with nothing to tell it anything.
This is the Stage 3/4/5 pattern again, and it took making the mess to see it:
the fix is delta 2, and the tests now cover exactly that pair.

**A known gap, deliberately left, and the comment that claimed otherwise is
corrected.** `reconcileSessionRenderJobs` said a missing output file is
"reported as a failed update by the renderer once it has looked at its own
queue". The renderer does no such thing: `useAgentRenderBridge` walks the
queue's ROWS, so a job artifact whose row has DISAPPEARED — Clear completed, or
a queue emptied between sessions — is told nothing by anyone. Closing it needs
the bridge to know the queue has finished loading, so it can tell "no row yet"
from "no row ever", and `RenderQueueContext` exposes no such flag; adding one is
the shared-file change Hasan chose not to make. Cancelling no longer reaches
this state. The remaining path is a user clearing the queue out from under a
live agent render.

**Docs.** `docs/AGENT_PACKAGE_SPEC.md` is the author's contract — every manifest
field, every tool id, the limits, the trust tags, the signing flow, and a
pre-publish checklist. `docs/examples/agent-starter/` is a working package
(`example/hook-writer`: three hooks, a `pick`, one developed document) with a
README naming the five fields to change. It is not merely valid: it was packed,
installed and RUN in the app — starter tree, prefilled opening,
`write_document`, `ask_user` pick, a second document on the stage — which is
what §9's "an author could ship a package from them alone" has to mean.

**The CDP smoke recipe** is in `docs/ui-automation-cdp.md`, with two escaping
traps worth more than the recipe itself: a regex literal inside a `q()` template
literal silently loses its backslashes (`/\(job-\d+\)$/` arrives at the page as
`/(job-d+)$/` and matches nothing, with no error at all), and escaped-bracket
Tailwind selectors reach `querySelector` unescaped and throw. Both cost real
time here. A third: reading "whichever job card is on the stage" is meaningless
once a session holds two of them — pin every reading to one artifact id.

**Files as built.** New: `docs/AGENT_PACKAGE_SPEC.md`,
`docs/examples/agent-starter/{README.md, agent.json, AGENT.md,
skills/writing-hooks/SKILL.md}`, `src/renderer/components/AiUsageByAgent.tsx`,
`src/main/services/ai-usage-db.test.ts`. Touched: `render-job-match.ts` (+
tests), `useAgentRenderBridge.ts`, `AgentWorkspace.tsx`, `agent-sessions.ts` (+
tests), `render-jobs.ts` (+ tests), `agent-runner.ts`, `tsx-deps.ts`,
`tools/{generate-image, generate-video}.ts`, `ai-usage-db.ts`, `ai-usage.ts`,
`ai-usage-handlers.ts`, `registrations/ai-usage.ts`, `llm-handlers.ts`,
`library/{generate-image-asset, generate-video-asset}.ts`, `video-init.ts`,
`video-engine/{types, video-engine}.ts`, `preload/api/ai-usage.ts`,
`useAiUsage.ts`, `AiUsageDashboard.tsx`, `electron.d.ts`, `channels.ts`,
`ipc/types/ai-usage.ts`, `types/ai-usage.ts`, `docs/ui-automation-cdp.md`.
21 new tests; 1753 passing overall, `check:types` at baseline (web 26, node 10).

**Not done, and waiting on Hasan — release decisions, not code:**

- **The flag flip** `agents: true` in `feature-flags.ts`.
- **The version bump.** `package.json` is 1.0.0 and both built-ins declare
  `minAppVersion: 1.0.0`. They are COUPLED: raise the app alone and the
  built-ins still load; raise the built-ins alone and both silently vanish from
  the gallery, because a manifest is validated against the running app version.
  Raising a built-in also means re-stamping `files[]` (sha256 per entry) and
  re-running `node scripts/agent-pack.mjs resources/agents/vidtsx/<name>
  --check`.
- **The installer rebuild**, which is the only way to finish the file
  association: everything up to the OS is proven in dev, and what is NOT proven
  is that Windows registers `.vidtsxagent` from `electron-builder.yml` and hands
  the path over on a real double-click.

**Also still open, and not this stage's:** the `agents` manifest field (SDK
subagents) is parsed and ignored; there is no `run_flow`; `reorder` and `edit`
are wave 2 (§13); and `assets/agents/stage-3-fixture/` plus the
`assets/agents/motion-post/*` folders from Stages 5 and 6 are still in the asset
library, wanting the Assets screen's own delete flow (deleting folders from disk
leaves stale rows in `assets/.vidtsx/index.json`, and there is no
library-delete IPC).

## 10. Test plan and acceptance

Unit (vitest): manifest parse; ids; signing; zip reader; store install
matrix; registry selection; prompt composition; broker; artifact store;
event folding; replay window.

Manual, in-app (record results here when run):
1. Import an unsigned test package: "Unsigned" warning, installs.
   **PASS 2026-09-08 (Stage 3).** A packed `dev/stage3-fixture` read through
   the import dialog showed "Unverified. Use at your own risk", the
   "VidTSX has not reviewed this agent" notice, and all five capability lines
   derived from its manifest. One click installed it and the card appeared.
2. Import the same id at a newer version: replaces, `.bak` present. Older:
   asks. **Covered by vitest** (`agent-store.test.ts`); the dialog's downgrade
   branch is wired to `needsConfirm` but has not been clicked through.
3. Tampered package: refused with reason. **Covered by vitest.** The dialog
   shows the refusal in place of the manifest — the same path as row 1's read
   failure, not separately exercised.
4. Motion Post: brief, pick, composition, approve, render, video, on
   `claude-subscription`. **PASS 2026-09-08 (Stage 5) — three consecutive runs,
   each brief → rendered MP4 with no intervention**, after the two bugs in §8's
   outcome were fixed. Every run took the same shape: starter (3 steps) →
   `write_document` with two variants → `ask_user` pick → `generate_composition`
   at 1080×1920 → `ask_user` approve → `render_composition` → the queue → a
   `video` artifact on the stage. Token totals per run, from the AI usage log
   filtered to `featureSource: 'agent'` (which covers the chat turns AND the
   composition pipeline's own calls — nothing else logged in the windows):

   | run | brief | calls | input | output | cache read | notional cost | brief→video |
   |---|---|---|---|---|---|---|---|
   | A | "Why a 30 second edit beats a 3 minute one" | 6 | 6,695 | 17,495 | 62,498 | $0.70 | 6m 45s |
   | B | "Three shortcuts that cut an edit in half" | 7 | 7,307 | 17,661 | 67,276 | $0.72 | 7m 00s |
   | C | "Stop colour grading before you lock the cut" | 7 | 6,765 | 18,395 | 59,000 | $0.73 | 6m 25s |

   The cost is what the log computes at API prices; these ran on
   `claude-subscription`, where they are not billed per token. Roughly two
   thirds of the wall clock is the composition pipeline and the render, not the
   chat.

   **And once on a baseURL preset**, as §8 asks: the same brief on **MiniMax
   M2.7** produced its rendered MP4 too — the same seven steps, 13 calls,
   12,486 in / 11,253 out / 21,325 cache read. It took more calls and leaned far
   less on the cache than Claude does, and it needed no prompt changes. One
   caveat on that run: the DRIVER's websocket dropped mid-run, so the approve
   card was answered a few minutes later than it was asked. The app was
   untouched by that — the question was still waiting on the stage when a driver
   reconnected, which is §10 row 10 over again.
5. Provider without tools: degraded notice, chat still answers. NOT RUN — the
   notice renders off `toolsAvailable`, which no run has returned false for.
6. Remove the user copy of a built-in: the built-in returns. **PASS 2026-09-08
   (Stage 5)** — the row that could not be run until something shipped built-in.
   `vidtsx/motion-post` was packed at 1.0.1, installed through the import dialog,
   and the list went from `1.0.0 builtin` to `1.0.1 user` (the card showing the
   user copy's description); Remove took it back to `1.0.0 builtin`, and the IPC
   even names the `restoredBuiltin` it fell back to.
7. "Check for update" with a newer version in the JSON: dialog shows it,
   the button opens the browser, importing the downloaded file replaces the
   old version. NOT RUN — needs a feed to point at; the fixture agents declare
   no `updateUrl`, so their menus correctly have no such item.

Added during Stage 3, and passing in the real app: **one of each wave-1
artifact renders its viewer, and all six handoffs land in their target screen**
— the tables in section 6's "Stage 3 outcome".

Added during Stage 4, and passing in the real app (`dev/stage4`, a throwaway
agent, on `claude-subscription` — the tables in section 7's "Stage 4 outcome"):

8. `ask_user` `pick` between two documents: the card renders on the stage, the
   chosen TITLE reaches the model, and its next message builds on it.
   **PASS 2026-09-08.**
9. `ask_user` `form` (select + required text + multiline) and `approve`
   (accept two, reject one): Send stays locked until the card is answerable, and
   every answer reaches the model in the `[Answer to question <id>] …` format.
   **PASS 2026-09-08.** Not required by §7; driven because they ship.
10. A pending question that outlived a reload comes back on the card, says it
    was asked in an earlier run, and is still answerable. **PASS 2026-09-08** —
    found by accident when an HMR reload reset the app mid-run.
11. "Skip and chat" on a live card sends the `cancelled` reply and the
    conversation continues. **PASS 2026-09-08.**
12. `propose_memory` accepted scoped to the agent, and a second accepted for all
    agents: the agent's dialog shows each on its own tab, Studio's dialog shows
    only the app-wide ones, and a later agent turn cited the agent-scoped rule
    by name ("applied because of …"). **PASS 2026-09-08.**
13. Studio's own Memory button, after `MemoryDialog` moved to
    `renderer/components/memory/`: opens, lists, unchanged. **PASS 2026-09-08.**
14. **A package signed with VidTSX's own key reads "Verified by VidTSX".**
    **PASS 2026-09-08** — the row that could not be run until a key existed.
    Hasan generated the key and pasted only the public half; the fixture was
    packed with `agent-pack.mjs --key <path outside the repo>` (the script reads
    the file, so the private half never entered a session), and the install
    returned `signature: 'verified'` with the card showing the tag in the accent
    tone (`#c8b4ff` on the purple tint) and no "VidTSX has not reviewed this
    agent" notice. **This also proves the pasted public key is the half of the
    pair that was saved** — a mismatch would have shown as "Signed, unverified
    publisher" with no error anywhere, which is why it was checked before the
    key was committed.

Added during Stage 5, and passing in the real app (the tables and the run log in
section 8's "Stage 5 outcome"):

15. **A fresh install shows both built-in agents**, each with its own icon and a
    "Built-in" chip rather than a trust tag. **PASS 2026-09-08** — the gallery
    lists `vidtsx/assistant 1.0.0` and `vidtsx/motion-post 1.0.0`, both
    `origin: builtin`, `signature: unsigned`, and neither reads "Unverified".
16. **The starter runs, and its rules hold.** **PASS 2026-09-08** — three steps
    rendered through the ordinary `pick` and `form` cards; Back returned to the
    previous step with the answer still selected; "Skip and chat" and the
    disabled composer are both offered throughout; the rendered `opening`
    arrived PREFILLED in the chat box and was never auto-sent; no session
    existed on disk until the tree finished, and the one then created carried
    the answers and was named from them.
17. **A returning user goes straight to chat** — opening an agent that already
    has sessions never shows the tree, and "New session" is what re-runs it.
    **PASS 2026-09-08.**
18. **A double-clicked `.vidtsxagent` reaches the import dialog.** **PASS
    2026-09-08, in dev** — a second Electron instance launched with the file on
    argv forwards through `second-instance`; main parks it as `kind: 'agent'`
    (Studio's browser cannot claim it); the window switches to Agents, the
    workspace steps aside if one was open, and the gallery claims the path and
    opens the dialog on it. The remaining half — Windows registering the
    extension so a real double-click does this — needs a packaged installer and
    is Stage 6's.
19. **A render that finished while the session was closed is filed on open.**
    **PASS 2026-09-08**, found by accident: before the bridge was fixed, two
    sessions were left holding a `running` job with the MP4 already on disk, and
    simply reopening each one filed the video and appended the artifact
    (`reconcileSessionRenderJobs`, §1.5).

Added during Stage 6, and passing in the real app (`vidtsx/motion-post` on
`claude-subscription`, plus two throwaway packages — the tables in section 9's
"Stage 6 outcome"):

20. **A live render shows on the stage, with progress and a Cancel button.**
    **PASS 2026-09-08** — the job viewer read `Render queue · Running` with a
    Cancel button throughout. This is the fix: before `matchRenderRow` the stage
    was blank from the moment the render started, because it looked the queue
    row up by the artifact's own job id and the queue had just rewritten it.
21. **Cancel mid-render leaves no orphan job.** **PASS 2026-09-08** — one
    session, one render, one cancel: the card went to `Render queue · Cancelled`
    within three seconds, and `artifacts.json` on disk holds
    `job-3 → cancelled`, no `error`, no `resultArtifactId`, no `video` artifact,
    and the composer not busy. The label is the second fix: a cancel reports
    twice, and the cancellation's own "renderMedia() got cancelled" used to
    overwrite it as Failed.
22. **Cancel mid-`ask_user` resolves.** **PASS 2026-09-08** — with a `pick` card
    up, `session.json` held `pendingInteraction: { id: "q-fb18e8a6", kind:
    "pick" }`; "Skip and chat" cleared the card and the file within two seconds;
    the model was told and replied in prose; the next message went through
    normally. (Under the non-blocking form the turn has already ended by the
    time the card is up, so "Skip and chat" IS the cancel — there is no Stop
    button to press.)
23. **Content Safety refuses a real agent tool call, and the refusal reaches the
    model.** **PASS 2026-09-08** — a throwaway `dev/image-gate` agent
    (`generate_image` only, told to pass the user's words through unchanged)
    was asked for "a plate of grilled chicken breasts with lemon and herbs". The
    tool returned, verbatim to the model: *"Image generation failed: Blocked by
    Content Safety — nudity. Rephrase your prompt — VidTSX does not generate
    sexual or explicit content. See AI → Content Safety."* The run did not
    crash, no provider call was made, and the agent reported the refusal and
    stopped. A deliberately benign prompt was used precisely so the GATE did the
    refusing rather than the model's own judgement — an explicit prompt is
    refused by the model before the tool is ever called, which proves nothing
    about our code. It also shows the accepted trade-off in
    `CONTENT_SAFETY_DESIGN.md` D0.1: the prompt list is a cheap first layer with
    false positives, and the authoritative gate is on pixels.
24. **Usage is attributed per agent, in the app.** **PASS 2026-09-08** — AI →
    Providers → Usage shows a by-agent table above the log:
    `vidtsx/motion-post · 41 requests · 33.6K in · 52.5K out · 417.5K cache read
    · $2.64` and `dev/image-gate · 1 · 362 · 444 · 3.2K · $0.03`. Clicking a row
    narrows the log below it (228 rows total → 41). The 41 is the point: a chat
    turn count would have been about six per run, so the composition pipeline's
    own calls are attributed too. The `agent_id` migration ran for real against
    this machine's existing database.
25. **The shipped author example installs and runs from the folder alone.**
    **PASS 2026-09-08** — `docs/examples/agent-starter/` packed with
    `agent-pack.mjs`, installed, and ran end to end: its three-step starter
    tree, the opening prefilled and not auto-sent, `write_document`, an
    `ask_user` pick between three hooks, and a second document on the stage with
    its action bar. That is what "an author could ship a package from them
    alone" has to mean.


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
2. (Resolved 2026-09-08, Stage 6.) A built-in `vidtsx/assistant` with no tools
   ships, and **Tools › AI Chat STAYS** — decided with Hasan: the `tools` flag is
   env-gated, so the old screen is already invisible in production unless
   `VITE_FF_TOOLS` is set, and deleting a screen on the release path buys
   nothing. Revisit once agents have shipped and the assistant agent has been
   used in anger. (The Studio agent was never a candidate: it stays
   Studio-only, decision 6.)
3. (Resolved 2026-09-06, see 1.10.) Memory is per agent plus app-wide.
4. (Half resolved.) The first publisher key is `vidtsx-1` and it ships in
   `publishers.ts` (Stage 4, §10 row 14). WHERE THE PRIVATE HALF LIVES is still
   open: as of 2026-09-08 it is a plain file on `C:`, which this section says it
   should not be. Moving it to a password manager is Hasan's call, and nothing
   in the app depends on where it sits — `agent-pack.mjs` reads whatever path
   `--key` or `VIDTSX_AGENT_SIGNING_KEY` names.
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
