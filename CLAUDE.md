# CLAUDE.md — Instructions for Claude Code

> **Read PLAN.md first.** It contains the full architecture, folder structure, and phase breakdown.
> **Read UI_SPEC.md** before building any UI component. It defines every color, spacing value, and layout.
> **Read STATUS.md** to know what has been completed and what to work on next.

## Project context

This is VidTSX Studio, an Electron desktop app for rendering TSX video compositions using Remotion. The codebase follows a strict modular architecture. Every decision should favor modularity and maintainability over cleverness.

**We are developing on Windows.** All paths, commands, and file operations must work on Windows. Use `path.join()` for file paths, forward slashes in imports, and test with PowerShell commands. Do not assume macOS/Linux behavior.

## Critical rules

### Architecture rules (never break these)

1. **Feature modules are isolated.** A component in `src/features/workspace/` must NEVER import from `src/features/editor/`. If two features need to share code, it goes in `src/shared/`.

2. **IPC is the only bridge.** Renderer process code must NEVER use `require('electron')` or Node.js APIs directly. All Node.js operations go through typed IPC channels defined in `src/shared/ipc/`.

3. **Services hold business logic.** React components call hooks. Hooks call services. Services do the work. Components never contain business logic, file I/O, or API calls.

4. **One file, one export, ~300 lines max.** If a file grows past 300 lines, split it. Each file should have one primary export.

5. **Types live in `types.ts` inside each feature module** for feature-specific types, or in `src/shared/types/` for types used across features/processes.

### Code style rules

- Use TypeScript strict mode. No `any` types — use `unknown` and narrow.
- Functional React components only, with hooks.
- Named exports everywhere (no `export default` except for React lazy loading).
- Use `async/await`, never raw Promises with `.then()`.
- Error handling: every IPC handler wraps its body in try/catch and returns typed errors.
- File naming: `kebab-case.ts` for everything. React components are `PascalCase.tsx`.
- Imports: use path aliases (`@main/`, `@renderer/`, `@features/`, `@shared/`).

### Electron-specific rules

- **No `@electron/remote`.** It's deprecated and a security risk. Use IPC.
- **Preload script is the security boundary.** Only expose specific functions via `contextBridge`, never entire modules.
- **All file paths go through `src/main/utils/paths.ts`.** Never hardcode paths. Use `app.getPath()` for user data, temp dirs, etc.
- **ffmpeg and whisper.cpp are external binaries**, not npm packages. They live in `resources/binaries/` and get bundled via electron-builder's `extraResources`.
- **Use electron-vite 5.0** as the build tooling. It handles separate Vite configs for main, preload, and renderer processes via `electron.vite.config.ts`. Do NOT set up raw Vite + Electron manually.
- **Remotion packages must ALL be the same exact version** (currently 4.0.435). Never use `^` prefix for Remotion. If one package is 4.0.435, all must be 4.0.435.
- **Use `ipcMain.handle`** for request/response. Use `webContents.send` only for push events (progress updates, file watchers).

### What NOT to do

- Do NOT install `@electron/remote` or `electron-remote`.
- Do NOT use `nodeIntegration: true` in the browser window.
- Do NOT put React components in `src/main/`.
- Do NOT put Node.js file system calls in `src/renderer/` or `src/features/`.
- Do NOT create global state stores (Redux, Zustand) until explicitly needed. Start with React context + hooks.
- Do NOT bundle whisper models or ffmpeg in the app. Download them on first use.
- Do NOT use `window.require()` — it's a security hole.
- Do NOT add any backend service, user accounts, or cloud storage. The app is local-first and serverless (backend-API track retired 2026-08-16 — see PLAN.md "No backend API"). Outbound network is limited to: provider APIs with the user's own keys, the update/announcement feeds, and first-use binary/model downloads.
- Do NOT embed any credentials, secrets, or access keys in the app bundle.
- Do NOT send provider API keys to the renderer process. The main process holds keys (safeStorage) and adds them to HTTP request headers; the renderer only ever sees has-key booleans.

## How to work on this project

### Starting a new phase

1. Read `STATUS.md` to confirm the current phase.
2. Read the relevant phase section in `PLAN.md`.
3. Create all files for that phase with proper folder structure.
4. Implement feature by feature, testing each before moving to the next.
5. Update `STATUS.md` when the phase is complete.

### Adding a new feature module

1. Create the folder under `src/features/{feature-name}/`.
2. Add: `components/`, `hooks/`, `services/`, `types.ts`.
3. Create barrel export: `index.ts` that re-exports public API.
4. If it needs IPC: add channel definitions in `src/shared/ipc/channels.ts` and types in `src/shared/ipc/types.ts`.
5. Register IPC handlers in `src/main/ipc/`.
6. Add the screen to `src/renderer/routes.tsx`.

### Adding a new IPC channel

1. Add the channel name in `src/shared/ipc/channels.ts`:
   ```ts
   export const IPC_CHANNELS = {
     // ... existing
     MY_NEW_CHANNEL: 'my:new:channel',
   } as const;
   ```
2. Add request/response types in `src/shared/ipc/types.ts`:
   ```ts
   export interface MyNewChannelRequest { /* ... */ }
   export interface MyNewChannelResponse { /* ... */ }
   ```
3. Implement handler in `src/main/ipc/`:
   ```ts
   ipcMain.handle(IPC_CHANNELS.MY_NEW_CHANNEL, async (event, req: MyNewChannelRequest): Promise<MyNewChannelResponse> => {
     // ...
   });
   ```
4. Expose in preload: `src/shared/ipc/preload.ts`.
5. Use in renderer via the `window.api.myNewChannel()` function.

## Build & development commands

```bash
npm run dev          # Start dev server + Electron
npm run build        # Build for production
npm run build:mac    # Build .dmg for macOS
npm run build:win    # Build .exe for Windows
npm run check:types  # TypeScript type gate (baseline-checked via scripts/check-types.mjs)
npx vitest run       # Unit tests
```

> There is NO `lint` or `type-check` script — `check:types` is the gate, and it
> compares error counts against a recorded baseline (web/node) rather than
> requiring zero.

## File naming conventions

| Type | Pattern | Example |
|------|---------|---------|
| React component | `PascalCase.tsx` | `FileTree.tsx` |
| Hook | `useCamelCase.ts` | `useFileTree.ts` |
| Service | `kebab-case.ts` | `file-manager.ts` |
| Types | `types.ts` | `types.ts` |
| IPC handler | `*-handlers.ts` | `render-handlers.ts` |
| Constants | `constants.ts` | `constants.ts` |
| Utility | `kebab-case.ts` | `paths.ts` |

## Testing approach

- **Phase 0-3:** manual testing is fine. Focus on getting the shell stable.
- **Phase 4+:** add unit tests for services (props-parser, queue-manager, caption-builder).
- **IPC handlers:** test with mock electron IPC in vitest.
- **Components:** only test complex interactive components (FileTree, Timeline). Skip simple display components.
- **Driving the real app:** `docs/ui-automation-cdp.md` — dev launch recipe and the visibility rule that keeps automated clicks off hidden screens (every visited screen stays mounted).

## Package installation

When a phase requires new packages:
- Always pin exact versions in package.json.
- Run `npm install` once, then verify the app still launches before writing feature code.
- Never install packages speculatively — only when actively implementing the feature that needs them.