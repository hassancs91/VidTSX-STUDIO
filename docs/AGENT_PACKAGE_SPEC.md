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

### `generate_composition` and `edit_composition` — the TSX builder

Both tools hand the work to the app's **TSX builder**, the same one the TSX
Creator, Studio shots and flows use: it designs the picture, writes the TSX
files, renders frames, looks at them and redesigns. Your agent says *what* the
piece shows and *why*; the builder decides the layout and the pixels.

**A call blocks for the whole build.** Minutes, not seconds: Quick ~1-3 min
(one look at its frames), Standard ~3-10 min (up to 3 looks, the default),
Craft up to 60 min (up to 6 looks; for a finished piece). The app runs one
build at a time across the Creator, Studio, agents and flows, so a call made
while another build runs waits for it; your run's Stop cancels the build,
queued or running. Have AGENT.md say what is about to be made before the call.

**`generate_composition`** takes:

| argument | meaning |
|---|---|
| `title` | names the folder (`compositions/<slug>/`) |
| `brief` | what the piece shows and why: the idea, the exact words and numbers, the motion and what it means. Leave out layouts, coordinates, pixel sizes and frame-by-frame sheets. Required unless `from` is given |
| `width`, `height`, `fps` | default 1920 × 1080 at 30 |
| `durationSeconds` | absent or 0 = the builder picks a length that fits the brief |
| `budget` | `quick`, `standard` (default) or `craft` |
| `loop` | `true` for a seamless loop (the builder must measure the seam before it may finish) |
| `packs` | craft-pack ids, the builder's own know-how for a kind of piece or a look (below) |
| `styleNotes` | extra art direction; with `core/style-custom`, the user's own words for the look |
| `generatedImages` | whether the builder may generate images (priced; needs an image provider). Absent = allowed for an agent |
| `referenceImage` | an `image-set` artifact id: the builder sees up to 4 of its images and can show the first |
| `referenceVideo` | a `video` artifact id the composition should play |
| `from` | a composition artifact id to build again from its own recorded request (brief, packs, style, format, loop, brand), unchanged, as a new composition. Send only `title` and `budget` with it: any other shaping argument is refused. An edited version rebuilds its folder's first request (the result says the edits are not in it); a build made from session media cannot be rebuilt this way |
| `providerId`, `model`, `modelMode` | pin the builder's model; absent = the session's own |

`brandId`, `kindPack`, `stylePack`, `reviseOf` and `revision` are for the flow
node; an agent leaves them out (it names packs in `packs`; the session's brand
reaches the builder by itself).

**Craft packs.** The built-in ids today: `core/infographic-loop` (an animated
infographic post: one whole picture on every frame, a seamless loop, numbers
drawn as countable marks; it brings `core/concept-to-picture` and suits
1080 × 1350, 8 s, loop, Craft) and one style at most of `core/style-blueprint`,
`core/style-flat-bold`, `core/style-neon-dark`, `core/style-editorial`, or
`core/style-custom` with the words in `styleNotes`. Ids are checked before
anything is built: an unknown id, two styles, or `core/style-custom` without
`styleNotes` is refused with the reason. The builder follows a pack, so the
brief need not repeat it.

**`edit_composition`** takes `artifactId`, one `instruction` (one concrete
change; split unrelated changes into separate calls), `budget` (default
Standard), `loop` (`true` / `false`; absent keeps the version's) and
`generatedImages`. The builder continues the version's own source and saves
`vN+1` in the same folder; the new artifact supersedes the old one, which
stays available. An edit keeps its version's format, craft packs and style.

**Both, every time:** your package's `builder: true` skills go to the builder
as packs after the call's own craft packs (see Skills). The builder needs a
model with tool use and image input; an OpenRouter model without either is
refused before the build starts.

**What comes back.** A `composition` artifact (`compositions/<slug>/vN.tsx`
plus its source folder) and one text block:

```
Composition ready: compositions/rate-limit/v1.tsx — 1080x1350, 8.0s at 30fps.
Built on Craft: 6 looks, 14 checks, finished; loop seam OK, numbers checked.
Builder's summary: ...
The pictures below are frames 0, 120 and 239 from its last look (round 6), as the builder saw them.
```

followed by up to three of the frames the builder last looked at (or its last
contact sheet), so your agent can judge the result without a render. A flow
node gets the artifact only. The checks line names only the checks that apply (a loop, a physics engine,
numbers that change on screen):
`loop seam OK` / `NOT verified`, `physics frame-pure` / `purity NOT verified`,
`numbers checked` / `numbers NOT verified (number_check: split or race)`. A
"NOT verified" means the builder finished after three builds that kept
failing that check; it is a reason to look at those frames, or to edit, not
an error. `stopped before it finished` means a cap (time, turns or output
tokens) ended the build before the builder called `finish`, and the result is
the last build that passed the app's `check`. A failed or
cancelled build returns an error and no artifact; a failed edit leaves the
composition unchanged.

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

A skill whose frontmatter says `builder: true` is know-how for the TSX
builder rather than for your agent: it is sent in full, as a pack, with every
`generate_composition` and `edit_composition` call the agent makes (after any
craft packs the call names), and your agent's own prompt only lists its name
and description. Use it for a house look or a kind of piece the builder should
always follow; keep the agent's own skills for what the agent decides.

```markdown
---
name: House look
description: Two-pixel ink lines on a cream ground, one red accent.
builder: true
---
```

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
node scripts/agent-pack.mjs ./my-agent --out ./out.vidtsxagent --key /secure/path/key.pem --key-id acme-1
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
node scripts/agent-pack.mjs --genkey --key-id acme-1   # writes ~/.vidtsx/keys/acme-1.pem (or --out <path>)
```

`--genkey` writes the private key **straight to a file outside your
repository** and never prints it; it prints only the public half (the entry
for `src/shared/agents/publishers.ts`) and refuses to overwrite a file. The
file is **encrypted with a passphrase** you type twice at the terminal (12+
characters): a plain key file can be read and used by any program running as
you, AI coding sessions included. Keep the passphrase in a password manager,
with a copy of the (encrypted) file. Pass the file as `--key <path>` or via
`VIDTSX_AGENT_SIGNING_KEY`; the script reads it itself, so the key never has
to be pasted anywhere.

Every signing run with an encrypted key asks for the passphrase on the
terminal, hidden. It is never read from an argument, an environment variable
or a pipe, so a script or a session cannot sign with the key: run the packer
yourself, in PowerShell or cmd (Git Bash's mintty is not a terminal to Node).
`--genkey --no-passphrase` writes a plain key instead, and a plain key still
signs without a prompt.

The name a package is signed under (`keyId`) comes from the key: a key listed
in `publishers.ts` always signs under its own entry's name, so `--key-id` is
not needed (and a different one is refused). Any other key must be named with
`--key-id`, and not with a name a listed key already uses. A lost key gets a
new name (`vidtsx-1` was lost on 2026-10-17 and replaced by `vidtsx-2`); a
name is never reused for a different key.

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
