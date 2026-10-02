# Contributing

Thanks for looking. VidTSX Studio is source-available under the
[FSL-1.1-MIT](LICENSE.md) license and is built by one person, so
contributions are welcome but the bar for merging is "small, tested, and
matching the house rules".

## Before a pull request

- **Open an issue first** for anything bigger than a bug fix. Most of the
  architecture is written down in `PLAN.md` and `docs/`; a two-line issue
  saves a two-day PR that cannot land.
- **Sign the CLA** when the bot asks on your first PR. The license lets every
  release become MIT after two years, and the CLA is what makes that promise
  possible to keep.

## Setting up

Windows 10/11 is the development platform. macOS builds are untested.

```bash
git clone https://github.com/hassancs91/VidTSX-STUDIO.git
cd VidTSX-STUDIO
npm install
npm run dev
```

If `npm run dev` fails on a missing native module, see `BUGS.md` — the first
three entries cover every known Windows install trap.

## The gates

Every PR must pass the same two commands CI runs:

```bash
npm run check:types   # compares TypeScript error counts to a recorded baseline
npx vitest run        # unit tests
```

`check:types` is a baseline gate, not a zero-error gate: the numbers it prints
must not go up. New code should add zero errors. The full test suite is
disk-heavy; if a file times out on a loaded machine, re-run that file on its
own before assuming it is broken.

## House rules

The short version of `CLAUDE.md`, which is the authoritative list:

- **Feature modules are isolated.** `src/features/<a>/` never imports from
  `src/features/<b>/`. Shared code goes in `src/shared/`.
- **IPC is the only bridge.** Renderer code never touches Node or Electron
  directly. New channels follow the recipe in `CLAUDE.md` (channel name,
  request and response types, handler, preload, typed `window.api` call).
- **Services hold the logic.** Components call hooks, hooks call services.
- **One file, one export, about 300 lines.** Split before you pass it.
- TypeScript strict, no `any`, named exports, `async/await`, `kebab-case.ts`
  files and `PascalCase.tsx` components.
- **Remotion packages are pinned to one exact version.** Never bump one alone.
- Paths go through `src/main/utils/paths.ts`. Nothing is hardcoded.
- No new network endpoints, accounts, telemetry or bundled credentials. The
  app is local-first; the README lists the only requests it makes.

## What a good PR looks like

- One change, described in the first line of the PR.
- Tests for anything in `src/main/services/` or `src/shared/`.
- Docs updated if you changed a behaviour a doc describes.
- No drive-by reformatting.

## Adding built-in content

Templates, agents, flows, transitions and filters are folders under
`resources/`, each with a manifest. The tests in `src/shared/templates` and
`src/main/services/templates` run against every template folder, so adding
one is dropping the folder in and running the suite. Agents and flows have
`scripts/agent-pack.mjs` and `scripts/flow-pack.mjs` with a `--check` mode.
