# Flow starter — copy this folder

A complete, working `.vidtsxflow` source folder. It installs, it runs, and
it does something real: a video in, six evenly spaced frames out — with no
provider configured at all.

Read [`../../FLOW_PACKAGE_SPEC.md`](../../FLOW_PACKAGE_SPEC.md) for the full
format. This is the short way in.

## Five minutes to your own flow

1. **Copy the folder** somewhere outside this repo.

   ```bash
   cp -r docs/examples/flow-starter ~/my-flow
   ```

2. **Change four fields** in `flow.json`:

   | field | what to put |
   |---|---|
   | `id` | `<your-namespace>/<your-flow>`, each part `[a-z0-9-]` |
   | `name` | what the card says |
   | `description` | one sentence, shown on the card and in Details |
   | `author` | your name and site |

   Leave `files` and `requires.tools` alone. The packer rebuilds both from
   what is on disk and in the graph — you never write them by hand.

3. **Change the graph** — the easy way is on the canvas. Build the flow on
   the Flows page, run it until it does what you want, then **Export…** from
   its card menu: the file you get is a `.vidtsxflow` whose `flow.json` you
   can unzip and drop in here (fix the `id` — export writes `user/<slug>`).
   Or edit `flow.json` directly: nodes are the app's tools (`Flows → New →
   Edit` shows the palette with every port and config key).

4. **Check it, pack it, install it.**

   ```bash
   node scripts/flow-pack.mjs ~/my-flow --check
   node scripts/flow-pack.mjs ~/my-flow --out ~/my-flow-1.0.0.vidtsxflow
   ```

   Then Flows → Import in the app (or double-click the file). It lands under
   **Installed** with an "Unsigned" notice — sign it (`--key`) to change that.

## What this starter does

```
Video File ──video──▶ Extract Frame (count = Frames)
```

Two params on the run form: **Video** (a file or a Video Studio entry) and
**Frames** (2–24, default 6). The output is one image set, filed in the
Asset Library under `flows/frame-contact-sheet/frames/`.
