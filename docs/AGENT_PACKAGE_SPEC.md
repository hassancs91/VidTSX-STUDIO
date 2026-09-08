# The `.vidtsxagent` package format — a guide for agent authors

> For people writing an agent for VidTSX Studio. If you want the design
> reasoning instead, read `docs/agents-plan.md`; this file is the contract.
>
> A ready-to-copy package is in [`docs/examples/agent-starter/`](examples/agent-starter/).
> Copy that folder, change five fields, and you have a working agent.

## What an agent is

**An agent is wiring. The app owns the parts.** A package ships a prompt, some
skills, and a manifest that says which of the app's tools it may use. It never
ships code, and it cannot: there is no place in the format to put any. Every
tool, viewer, and interaction lives in the app and arrives with an app version.

That is the whole security model, and it is why installing an agent is safe in
a way that installing a plugin is not. An agent you download can write
documents, make compositions, and queue renders — because the app does those
things and the manifest asked for permission — and it can do nothing else. It
gets no shell, no network of its own, and no access to your disk outside its
own session folder.

## Folder layout

```
my-agent/
  agent.json            the manifest (below) — required
  AGENT.md              the system prompt, plain markdown — required
  skills/<id>/SKILL.md  zero or more skills, same format as the app's own
  skills/<id>/*         skill resources, read by tools only
  subagents/<name>.md   optional (parsed, not yet used — see "Not yet wired")
  assets/*              optional reference images, exemplars, TSX templates
  icon.png              optional, 256x256 — the tile in the gallery
```

Everything except `agent.json` must also be listed in the manifest's `files[]`
with its size and sha256. `agent.json` describes the other entries, so it never
describes itself.

## The manifest

```jsonc
{
  "formatVersion": 1,                  // must be 1
  "id": "acme/storyboard",             // "<namespace>/<name>", each [a-z0-9-]+
  "name": "Storyboard",                // shown on the card, max 80 chars
  "version": "1.0.0",                  // semver
  "description": "A brief, turned into a shot-by-shot storyboard.",
  "author": { "name": "Acme", "url": "https://acme.example" },
  "license": "MIT",
  "minAppVersion": "1.0.0",            // semver; install refuses an older app
  "icon": "icon.png",
  "prompt": "AGENT.md",                // must be listed in files[]

  "tools": ["write_document", "ask_user", "list_artifacts"],
  "sdkTools": ["WebSearch"],
  "artifacts": ["document"],
  "interactions": ["pick"],

  "starter": { /* optional — see "Starters" */ },
  "defaults": { "maxTurns": 24, "effort": "medium" },
  "memory": { "propose": true },       // may ask you to remember things
  "workspace": { "sdkFileTools": false },
  "updateUrl": "https://acme.example/agents/acme.storyboard.json",
  "files": [ { "path": "AGENT.md", "size": 1234, "sha256": "..." } ]
}
```

### `tools` — what the agent may ask the app to do

One entry per capability. **Tool ids are append-only**: a shipped id never
changes meaning, so an agent written today keeps working.

| id | what it does | artifact it makes |
|---|---|---|
| `write_document` | writes markdown into the session's own folder | `document` |
| `generate_composition` | generates an animated TSX composition and serves it | `composition` |
| `edit_composition` | revises an existing composition | `composition` (new version) |
| `render_composition` | queues a render in the app's render queue | `job`, then `video` |
| `generate_image` | one image from the user's image provider | `image-set` |
| `generate_video` | one clip from the user's video provider | `job`, then `video` |
| `ask_user` | asks the user a question mid-run | none |
| `list_artifacts` | reads back what this session has made | none |
| `propose_memory` | proposes a rule for the user to accept | none |

`generate_image` and `generate_video` need the user to have configured that
kind of provider. The app tells the model when one is missing rather than
failing the run.

`propose_memory` needs `"memory": { "propose": true }` as well as the tool id.
Listing the tool alone gets the read side only — the agent's remembered rules
still reach its prompt, it just cannot ask to write new ones.

### `sdkTools` — the model's own built-ins

Only `WebSearch` and `WebFetch`, unless `workspace.sdkFileTools` is `true`,
which additionally allows `Read`, `Write`, `Edit`, `Glob`, `Grep` — and those
run behind a path guard that refuses anything outside the session's own
workspace folder. **`Bash` is rejected, always.** Installed agents get no
shell; that is not a setting.

### `artifacts` and `interactions`

Declare what you expect to produce and how you expect to ask. Wave 1 is
`document`, `composition`, `video`, `image-set`, `job` for artifacts, and
`form`, `pick`, `approve` for interactions. Naming a kind the app does not know
fails validation, which is the point: it fails at install rather than mid-run.

### `defaults`

`maxTurns` (1–200, default 24) caps the tool loop. `effort` is one of `low`,
`medium`, `high`, `xhigh`, `max` and is passed to providers that support it.

### `updateUrl`

Optional, `https://` only. The app fetches it **only** when the user clicks
"Check for update" on the card — never on its own, and it never downloads a
package for them. Serve:

```json
{ "id": "acme/storyboard",
  "latest": { "version": "1.1.0", "url": "https://acme.example/buy/storyboard",
              "sha256": "...", "minAppVersion": "1.0.0", "notes": "What changed." } }
```

Omit `updateUrl` and the card simply has no such menu item. A built-in agent
must omit it: built-ins update with the app, so offering the item would lie.

### Limits

| limit | value |
|---|---|
| entries in `files[]` | 500 |
| one entry, uncompressed | 32 MB |
| all entries, uncompressed | 64 MB |
| `agent.json` | 256 KB |
| `tools[]` | 32 |
| `subagents` | 8 |
| starter nodes / options per node | 12 / 8 |

## AGENT.md — the system prompt

Plain markdown, no frontmatter. It is composed into the system prompt with the
agent's skills, the starter answers, and the user's remembered rules, and it
**stays fixed for the whole session** so the provider's prompt cache survives
every turn. Never write anything into it that changes per turn.

Two things matter more than style:

1. **Say when to end the turn.** `ask_user` and `render_composition` both
   return immediately and expect the model to stop and wait. Write "END YOUR
   TURN" after those steps, in those words. The shipped Motion Post agent does,
   and it is why its questions actually reach the user.
2. **Number the workflow.** An agent with seven numbered steps behaves; an
   agent with a paragraph of intent improvises.

Include a content-policy line if your agent generates images or video — the
app's visual gate is authoritative, but the prompt should not be steering into
it.

## Skills

`skills/<id>/SKILL.md`, the same format the app uses for its own. Skills carry
craft — timing, typography, safe zones, a house vocabulary — not rules the app
already enforces. Repeating the TSX pipeline's own instructions in a skill only
creates a second source of truth that will drift.

## Starters — the first questions, with no tokens spent

A starter is a small decision tree that runs entirely in the app: no provider,
no tokens, instant, offline. It produces the first message, **prefilled in the
chat box and never sent for the user**, so they can edit it before sending.

```jsonc
"starter": {
  "entry": "goal",
  "nodes": {
    "goal": { "question": "What kind of post?", "select": "one",
      "options": [
        { "id": "promo", "label": "Promote a product", "next": "platform" },
        { "id": "tip",   "label": "Share a tip",       "next": "platform" }
      ],
      "allowOther": true, "otherNext": "platform" },
    "platform": { "question": "Where will it be posted?", "select": "one",
      "options": [{ "id": "9:16", "label": "Reels / Shorts", "next": "brief" }] },
    "brief": { "question": "What is it about?", "text": true,
      "multiline": true, "next": "$end" }
  },
  "opening": "Make a {{platform}} {{goal}} post about: {{brief}}",
  "quickStarts": ["A 6 s hook for a newsletter launch"]
}
```

Rules the validator enforces: every `next` names a real node or `$end`; the
tree is a DAG with `$end` reachable from `entry`; node ids are `[a-z0-9-]+`;
at most 12 nodes and 8 options each; every `{{ref}}` in `opening` names a node.
There is no expression language — branching is by `next` per option, and an
author who needs more asks with `ask_user` once the run has started.

`allowOther: true` adds an "Other..." choice with a text field; its answer is
stored as `{ id: "$other", text }`, so `{{ref}}` renders the typed words.

The starter answers stay in the session and are shown to the model for its
whole run. The first thing the user types is also used to NAME the session,
which in turn names the Library folder the agent's media is filed into — so
put the free-text question last, and make it a real question.

## Building and checking a package

```bash
# Validate a folder without packing it. Run this first, and often.
node scripts/agent-pack.mjs ./my-agent --check

# Pack it. files[] is rebuilt from what is on disk, so sizes and hashes
# are always right.
node scripts/agent-pack.mjs ./my-agent --out ./acme.storyboard-1.0.0.vidtsxagent

# Pack and sign (see below).
node scripts/agent-pack.mjs ./my-agent --out ./out.vidtsxagent --key /secure/path/key.pem
```

`--check` reports every problem at once rather than one at a time. It runs the
same validation the app runs at install, with **one exception**: TSX under
`assets/` is checked at install, not at pack time, because the check needs the
app's module server. If you ship TSX templates, install the package once before
you publish it.

## Signing

Signing proves who published a package and that nobody has altered it since.
It is optional — an unsigned agent installs fine, with a warning — and it has
nothing to do with licensing. The app enforces no licences, ever.

```bash
node scripts/agent-pack.mjs --genkey        # prints a private key + the entry to publish
```

Store the private key **outside your repository** and pass it as `--key <path>`
or via `VIDTSX_AGENT_SIGNING_KEY`. The script reads the file itself, so the key
never has to be pasted anywhere.

The signature covers the canonical JSON of `agent.json`, which already hashes
every other file — so signing the manifest signs the package. It lands in the
zip as `signature.json`, which is never listed in `files[]`.

What the user sees on the card:

| what the app found | tag |
|---|---|
| signed with a key VidTSX publishes | **Verified by VidTSX** (accent) |
| a valid signature, key we do not know | **Signed, unverified publisher** |
| no signature | **Unverified. Use at your own risk** |
| a signature that does not verify | refused — it will not install |

A package is matched to a publisher by its **key bytes**, never by the `keyId`
it claims, so a package cannot impersonate a publisher by naming their key.

Per-buyer stamping (`licensee.json`) is added by a store *after* signing, is
not hashed and not signed, and only ever appears in the details dialog. That
keeps the private key off the web server: tampering with the stamp controls
nothing, and a leaked copy still names its buyer.

## Installing, updating, removing

The user imports a `.vidtsxagent` through the Agents page — the Import button,
drag-and-drop, or double-clicking the file. Install compares versions with the
copy already there: **newer** replaces it and keeps one `.bak`; **the same**
reinstalls; **older** asks first. Remove deletes the user's copy — and if a
built-in of the same id ships with the app, that one reappears.

Where two copies of an id exist, the highest version wins; on a tie the
built-in does.

## What the user is told your agent can do

The import dialog and the details dialog both list capabilities in plain words,
derived from your manifest — "Browses the web", "Generates images with your
image provider", "Renders videos through the render queue", "Writes files in
its own session folder", "Asks you questions while it works", "Proposes things
to remember (you approve each)". You do not write these lines and cannot
change them: they are read off `tools`, `sdkTools`, `workspace` and `memory`.
Ask for less and your agent reads as smaller.

## Where an agent's work goes

- Generated media (images, video, renders) files into the **Asset Library**
  under `agents/<agent-name>/<session-title>/`, as ordinary managed assets —
  described, brand-tagged, and browsable like anything else.
- Documents, TSX and scratch live in the session's own folder under user data,
  and reach the Library only when the user chooses "Save to Library".
- Deleting a session deletes the session folder. Media already filed stays,
  because the user may have used it elsewhere.

## Not yet wired

Declared, parsed, validated — and currently ignored. Safe to include; they will
start working without a repack.

- `subagents` — SDK subagent prompts.
- `run_flow` — the tool that runs a saved flow. Not in the registry yet.

## A checklist before you publish

1. `node scripts/agent-pack.mjs ./my-agent --check` passes.
2. `minAppVersion` is a version that actually exists, and is no higher than
   the app you tested on.
3. AGENT.md says END YOUR TURN after every `ask_user` and after
   `render_composition`.
4. The starter's free-text question is last, and makes a good session name.
5. You installed the package and ran it end to end — at minimum once on a
   provider that supports tools.
6. If you signed it, you installed the SIGNED file and saw the tag you
   expected. A mistyped public key fails silently: verification matches on key
   bytes, so a bad entry simply never matches and every package of yours reads
   "Signed, unverified publisher" with no error anywhere.
