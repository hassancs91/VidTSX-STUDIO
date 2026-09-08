# Agent starter — copy this folder

A complete, working `.vidtsxagent` source folder. It installs, it runs, and it
does something real: three hooks, a pick, one finished document.

Read [`../../AGENT_PACKAGE_SPEC.md`](../../AGENT_PACKAGE_SPEC.md) for the full
format. This is the short way in.

## Five minutes to your own agent

1. **Copy the folder** somewhere outside this repo.

   ```bash
   cp -r docs/examples/agent-starter ~/my-agent
   ```

2. **Change five fields** in `agent.json`:

   | field | what to put |
   |---|---|
   | `id` | `<your-namespace>/<your-agent>`, each part `[a-z0-9-]` |
   | `name` | what the card says |
   | `description` | one sentence, shown on the card and in the import dialog |
   | `author` | your name and site |
   | `minAppVersion` | the VidTSX version you tested on |

   Leave `files` as `[]`. The packer rebuilds it from what is on disk, with
   sizes and hashes, every time — you never write it by hand.

3. **Rewrite `AGENT.md`.** This is the whole agent. Keep the numbered workflow
   and keep the words **END YOUR TURN** after `ask_user`: the question only
   reaches the user if the model actually stops.

4. **Check it, pack it, install it.**

   ```bash
   node scripts/agent-pack.mjs ~/my-agent --check
   node scripts/agent-pack.mjs ~/my-agent --out ~/my-agent-1.0.0.vidtsxagent
   ```

   Then open VidTSX → Agents → Import, and pick the file. Or just
   double-click it.

5. **Run it end to end at least once** before you give it to anyone.

## What is in here, and why

| file | what it is doing |
|---|---|
| `agent.json` | the manifest — three tools, one artifact kind, one interaction, and a three-step starter |
| `AGENT.md` | the system prompt: a numbered workflow, a style section, a content-policy line |
| `skills/writing-hooks/SKILL.md` | craft the prompt should not carry — judgement, not rules |

Three things in here are worth copying even if you change everything else:

- **The starter's free-text question is FIRST here, but its answer names the
  session.** Whichever question produces the longest typed answer becomes the
  session title, and the title names the Library folder this agent's media
  files into. Put the question whose answer reads like a title where the user
  will actually answer it.
- **`ask_user` is followed by END YOUR TURN.** In capitals, in those words.
- **The tool list is short.** Every tool you declare shows up as a capability
  line in the import dialog. Asking for `render_composition` when you only
  write text makes your agent read as bigger than it is.

## Adding a skill

Make `skills/<id>/SKILL.md` with frontmatter (`name`, `description`) and
markdown below it. Skills carry craft: timing, typography, a house vocabulary,
the things a good practitioner knows. They should not restate rules the app
already enforces — that only creates a second source of truth that drifts.

## When it does not work

- **The agent talks past its own question.** `ask_user` returns immediately by
  design. Say END YOUR TURN after it.
- **`--check` complains about `tools`.** You named a tool id that does not
  exist. The list is in the spec.
- **The card says "Unverified. Use at your own risk".** That is correct for an
  unsigned package, and it installs fine. Signing is optional — see the spec.
- **Nothing appears in the gallery after install.** Check `minAppVersion`
  against the app you are running: a manifest is validated against the app
  version, and one that is too high silently fails to load.
