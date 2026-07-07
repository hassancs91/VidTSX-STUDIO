# BUGS.md — Issues encountered and fixes

> Document bugs encountered during development for future reference.

---

## Bug 1: ELECTRON_RUN_AS_NODE prevents Electron API from loading

**Date:** 2026-03-14
**Phase:** 0 — Project scaffold

### Symptom
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
    at Object.<anonymous> (D:\repos\vidtsx-desktop\src\main\index.js:16:5)
```

When running `npm run dev` or `electron .`, the app crashes immediately. The `app` object from `require('electron')` is `undefined`.

### Root cause
VSCode's integrated terminal sets `ELECTRON_RUN_AS_NODE=1` in the environment. This makes Electron run as plain Node.js instead of the full Electron runtime, so the Electron API modules (`app`, `BrowserWindow`, etc.) are not available.

When `ELECTRON_RUN_AS_NODE=1`:
- `require('electron')` returns the path string to `electron.exe` (from the npm package)
- The actual Electron API is not loaded

### References
- https://github.com/electron/electron/issues/49018
- https://github.com/electron/electron/issues/49034

### Fix
Created `scripts/dev.js` that spawns electron-vite with the env var removed:

```javascript
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronVite = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-vite.cmd');

const child = spawn(electronVite, ['dev'], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
  shell: true
});

child.on('exit', (code) => process.exit(code || 0));
```

Updated `package.json`:
```json
"dev": "node scripts/dev.js"
```

---

## Bug 2: Missing @rollup/rollup-win32-x64-msvc on Windows

**Date:** 2026-03-14
**Phase:** 0 — Project scaffold

### Symptom
```
Error: Cannot find module @rollup/rollup-win32-x64-msvc. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
```

electron-vite fails to start because rollup can't find its Windows native binary.

### Root cause
npm has a known bug with optional dependencies where platform-specific packages don't get installed correctly. The `@rollup/rollup-win32-x64-msvc` package is listed as an optional dependency of rollup but sometimes fails to install.

### References
- https://github.com/npm/cli/issues/4828

### Fix
Clean reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

This forces npm to re-resolve all dependencies and correctly install the platform-specific rollup binary.

**Note:** After this fix, the package appeared in `node_modules/@rollup/rollup-win32-x64-msvc/` as expected.

---

## Bug 3: Missing Tailwind CSS native bindings on Windows

**Date:** 2026-03-14
**Phase:** 0 — Project scaffold

### Symptom
```
Error: Cannot find module '../lightningcss.win32-x64-msvc.node'
```
and
```
Error: Cannot find native binding. npm has a bug related to optional dependencies
```

Tailwind CSS v4 uses native binaries for `lightningcss` and `@tailwindcss/oxide` which fail to install on Windows.

### Root cause
Same npm optional dependencies bug as rollup. Tailwind CSS v4 depends on:
- `lightningcss` (CSS parsing/minification)
- `@tailwindcss/oxide` (Rust-based engine)

Both have platform-specific native binaries that npm fails to install correctly.

### References
- https://github.com/npm/cli/issues/4828

### Fix
Explicitly install the Windows binaries before running npm install:
```bash
rm -rf node_modules package-lock.json
npm install @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc
npm install
```

This ensures the native binaries are present before other packages try to use them.

---

## Bug 4: Tailwind CSS v4 not scanning src/features/ directory

**Date:** 2026-03-15
**Phase:** 2 — Workspace module

### Symptom
Custom Tailwind classes like `text-text-primary`, `text-text-secondary`, `bg-app-hover` render as black text or no styling. The file explorer panel shows unstyled text while the sidebar navigation (in `src/renderer/`) displays correctly.

### Root cause
Tailwind CSS v4 with `@tailwindcss/vite` uses JIT compilation and auto-detects content files. However, it was only scanning files near the CSS entry point (`src/renderer/styles/global.css`) and missing the `src/features/` directory entirely.

Evidence:
- `text-text-muted` worked (used in `src/shared/` and `src/renderer/`)
- `text-text-primary` and `text-text-secondary` failed (used in `src/features/workspace/`)
- The compiled CSS contained `--color-text-muted` but NOT `--color-text-primary` or `--color-text-secondary`

### Fix
Add explicit `@source` directives to `src/renderer/styles/global.css`:

```css
@import "tailwindcss";

@source "../../features/**/*.tsx";
@source "../../shared/**/*.tsx";

@theme {
  /* theme colors */
}
```

The `@source` directive tells Tailwind v4 exactly which directories to scan for class usage. Restart the dev server after adding these directives.

---

## Bug 5: esm.sh external imports fail in browser

**Date:** 2026-03-15
**Phase:** 3 — Player module (TSX preview)

### Symptom
```
Render Error
Failed to fetch dynamically imported module: http://127.0.0.1:3200/modules/5c2747f18d87.js
```

When loading a TSX file that imports external packages like `three` or `@react-three/fiber`, the dynamic import fails even though the local module server is running.

### Root cause
The initial CDN import rewriting used `?external=react,react-dom,react/jsx-runtime`:

```typescript
// BAD: This breaks!
return `https://esm.sh/${packageName}@${version}?external=react,react-dom,react/jsx-runtime`;
```

The `?external` parameter tells esm.sh NOT to bundle React. The CDN returns code containing:
```javascript
import React from 'react';  // Browser can't resolve this!
```

The browser cannot resolve bare `'react'` imports — they must be URLs. So the entire module fails to load.

### Fix
Use `?alias` instead of `?external` to point React imports to our virtual module URLs:

```typescript
// GOOD: This works!
const alias = `alias=react:${baseUrl}/virtual/react.js,react-dom:${baseUrl}/virtual/react-dom.js`;
return `https://esm.sh/${packageName}@${version}?${alias}`;
```

This tells esm.sh to rewrite its internal React imports to use our virtual modules, so the browser can resolve them.

**For non-React packages** (like `three`, `gsap`): No params needed, esm.sh handles everything.

### Important: Future maintenance

When adding new packages to `KNOWN_PACKAGE_VERSIONS` in `src/shared/constants.ts`, check if the package uses React. If it does (like `@react-spring/web`, `react-icons`, etc.), you must ALSO add it to `REACT_DEPENDENT_PACKAGES` in `src/main/services/tsx-transpiler.ts`, or it will fail at runtime with the same error.

Packages starting with `@react-` are automatically handled.
