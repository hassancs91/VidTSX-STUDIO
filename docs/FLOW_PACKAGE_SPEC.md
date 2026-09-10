# The `.vidtsxflow` package format — a guide for flow authors

> For people sharing a flow with VidTSX Studio. The design reasoning is in
> `docs/flows-plan.md` (§1.7, §0.1 item 4); this file is the contract.
>
> A ready-to-copy package is in [`docs/examples/flow-starter/`](examples/flow-starter/).
> Copy that folder, change four fields, and you have a working flow.

## What a flow is

**A flow is a frozen plan.** The steps are known before it runs: the same
nodes every time, in the same order, with a few values exposed as
parameters on a run form. Every node is one of the app's tools — a flow
ships no code and cannot, and it runs with the user's own providers.

That is also why installing a flow is safe: a `.vidtsxflow` holds a document
and, optionally, a few reference files. What it can do is exactly what the
app's tools can do, gated the same way (content safety, usage logging,
the provider rule) whether an agent or a flow calls them.

## Folder layout

```
my-flow/
  flow.json             the manifest (below) — required; it IS the flow document
  assets/*              optional reference media the nodes point at
  icon.png              optional, 256x256 — the tile on the Flows page
```

Everything except `flow.json` must also be listed in the manifest's
`files[]` with its size and sha256. `flow.json` describes the other entries,
so it never describes itself. `signature.json` and `licensee.json` are never
listed either — the packer and the store write them.

## The manifest

`flow.json` is a `FlowDoc` (the document the Flows canvas saves) plus the
package fields on top:

```jsonc
{
  "formatVersion": 2,                       // must be 2
  "id": "acme/captions",                    // "<namespace>/<name>", each [a-z0-9-]+
  "name": "Captions",                       // max 80 chars
  "description": "A video, captioned.",     // max 500 chars
  "version": "1.0.0",                       // semver
  "author": { "name": "Acme", "url": "https://acme.example" },
  "license": "MIT",
  "minAppVersion": "1.1.0",                 // semver; install refuses an older app
  "icon": "icon.png",                       // optional; must be listed in files[]
  "requires": {
    "tools": ["input_video_file", "transcribe", "caption_video"],   // every tool the graph uses
    "capabilities": []                      // the gates those tools carry, e.g. "image-provider"
  },

  "params": [ /* the run form, in order — FlowParam[] */ ],
  "graph":  { "nodes": [ /* FlowNode[] */ ], "edges": [ /* FlowEdge[] */ ], "viewport": { "x": 0, "y": 0, "zoom": 1 } },
  "outputs": [ { "nodeId": "n-caption", "handle": "video", "label": "Captioned video" } ],
  "origin": null,

  "files": [ { "path": "assets/ref.png", "size": 12345, "sha256": "…64 hex…" } ]
}
```

The document half (`params`, `graph`, `outputs`) is the shape the canvas
writes — export a flow from the Flows page and you have a valid one. The
rules the validator applies:

- **`id` is namespaced.** A packaged flow's id is its install folder
  (`<userData>/flows/<namespace>/<name>`). A flow you made on the canvas
  carries a ulid; Export rewrites it as `user/<slug>`.
- **`requires.tools` lists every tool the graph uses**, and every one must
  exist in the app that installs it. `flow-pack.mjs --hash` writes this
  list from the graph; you never maintain it by hand. `capabilities` are the
  provider gates those tools declare (`image-provider`, `video-provider`,
  `audio-provider`, `agent-provider`) — the Flows page shows an unmet gate
  as a chip before Run, and a website can show "needs an image provider"
  before download.
- **The graph passes the structural gate** the canvas and the runner use:
  node ids, no dangling edges, params bound to real config keys, outputs on
  real nodes, no cycles, at least one node.
- **`minAppVersion` is not newer than the running app.**
- **Container caps:** 200 entries, 16 MB per file, 32 MB unpacked, 512 KB
  manifest. Entry paths are relative, forward-slashed, never `..`.

### Limits and what is NOT in a flow

A flow has no branching and no loops: a rejected checkpoint stops the run
or retries the node once. Nothing in the manifest can add a tool the app
does not have, run code, or reach the network on its own.

## Building and checking a package

```
node scripts/flow-pack.mjs my-flow --check                 # validate — nothing written
node scripts/flow-pack.mjs my-flow --hash                  # rewrite files[] and requires.tools in flow.json
node scripts/flow-pack.mjs my-flow --out acme.captions.vidtsxflow
```

The checker IS the install validator: the script bundles the app's own
`parseFlowPackageManifest` and signer out of `src/`, so a package that
passes `--check` passes the app's rules by construction. `--check` runs
offline against the app's tool-id list; the provider gates are only known
to a running app, so an unmet one is a chip on the run form, not a refusal.

A bare `flow.json` also imports (Flows → Import): with the package fields it
goes through the same validator; without them it is validated as a document.
Either way it becomes one of "My flows" (editable, a fresh ulid) — a bare
file has no folder to be the truth of. Only a `.vidtsxflow` installs under
"Installed".

## Signing

```
node scripts/flow-pack.mjs my-flow --out acme.captions.vidtsxflow --key ~/keys/acme.pem
node scripts/flow-pack.mjs my-flow --sign   # a folder that ships as-is: writes signature.json beside flow.json
```

`signature.json` is `{ alg: "ed25519", keyId, publicKey, signature }` over
the canonical JSON of `flow.json` (keys sorted, no whitespace) — which
already hashes every packaged file, so one signature covers the tree. The
key is the same ed25519 key agents use (`node scripts/agent-pack.mjs
--genkey`; the private half lives outside the repo, named by
`VIDTSX_AGENT_SIGNING_KEY`). One signing module, two manifest names.

The four outcomes at install — the agents' three states plus built-in:

| state | what the user sees | installs? |
|---|---|---|
| known key, valid | **Verified by VidTSX** (or the publisher's name) | yes |
| unknown key, valid | Signed, unverified publisher — "VidTSX has not reviewed this flow…" | yes |
| signature does not verify | refused: "does not match its manifest — corrupt or tampered with" | no |
| no signature | Unsigned — the same notice | yes |
| ships in `resources/flows` | **Built-in** (inside the signed installer; no signature of its own) | — |

A publisher is matched by its key BYTES, never by the `keyId` it claims.

## Installing, updating, removing

Import from the Flows page, drag-and-drop, or double-click the file
(`.vidtsxflow` is a registered file type; the Flows screen claims it).
Installed flows live at `<userData>/flows/<namespace>/<name>/`, folder as
truth; the Flows page's row is a cache rewritten from the folder. Installing
a newer version replaces the old one (rotated to `.bak`); an older version
asks first. A user copy of a built-in's id is used only when its version is
higher; Remove on it brings the built-in back. Remove on an installed flow
uninstalls the folder; its run history goes with it. Built-ins are
read-only — Duplicate makes an editable copy of any packaged flow.

An agent package may carry `flows/<name>/flow.json` (a full manifest,
`files: []`): those flows install and uninstall with the agent and list under
Installed with the agent's name ("Ships with: <agent>").

## Where a flow's work goes

Media a run makes files into the Asset Library under `flows/<flow-name>/`.
The run itself — `run.json`, `artifacts.json`, the tools' work files — lives
at `<userData>/flows-runs/<flowId>/<runId>/`, kept for the last 20 runs per
flow.

## A checklist before you publish

- [ ] `id` is `<namespace>/<name>`, lowercase, hyphens only.
- [ ] `minAppVersion` is the version you tested on.
- [ ] Every value a user should change is a param; everything else is fixed.
- [ ] Priced steps (`generate_video`, `generate_audio`, `transcribe`) are
      few and named in the description — the run form lists them, and an
      agent must name the cost before calling `run_flow`.
- [ ] `node scripts/flow-pack.mjs my-flow --check` passes.
- [ ] Run it three times unattended from the run form before you share it.
