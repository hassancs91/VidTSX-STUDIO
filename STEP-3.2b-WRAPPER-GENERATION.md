# Step 3.2 — Dynamic TSX Loading Implementation Plan

## Status: PARTIALLY COMPLETE - Wrapper Generation Needed

The basic bundling infrastructure is implemented, but `getCompositions()` fails because user TSX files don't have `registerRoot()`. See **"Step 3.2b - Wrapper Generation Fix"** section at the bottom.

---

## Overview

Enable dynamic bundling and preview of user-selected `.tsx` files in the Remotion player. When a user selects a TSX file from the workspace file tree, the app bundles it and displays it in the player.

## Architecture

```
User selects .tsx file
        ↓
WorkspaceScreen calls window.api.bundleCreate({ filePath })
        ↓
IPC → Main Process → remotion-bundler.ts
        ↓
@remotion/bundler compiles TSX → Webpack bundle in temp dir
        ↓
Express server serves bundle at http://127.0.0.1:PORT
        ↓
getCompositions() extracts metadata (fps, duration, dimensions)
        ↓
IPC returns { serveUrl, compositions[] }
        ↓
VideoPlayer renders bundle via iframe pointing to serveUrl
```

## Files to Modify/Create

### 1. Package Installation
```bash
npm install --save-exact @remotion/bundler@4.0.435 express@4.21.0
npm install --save-dev @types/express@5.0.0
```

### 2. Main Process Files

#### CREATE: `src/main/services/remotion-bundler.ts`
Core bundling service with:
- `bundleComposition(entryFilePath): Promise<BundleResult>`
- MD5 hash caching (Map of filePath → { contentHash, bundlePath, port })
- Express server to serve bundles at dynamic port (starting 3100)
- Error handling (catch bundler errors, return readable strings)

#### CREATE: `src/main/ipc/bundle-handlers.ts`
IPC handler for `bundle:create`:
- Receives: `{ filePath: string }`
- Calls `bundleComposition()`
- Sends progress events via `webContents.send('bundle:progress', { percent })`
- Returns: `{ success, serveUrl, compositions[], error? }`

#### MODIFY: `src/main/ipc/register.ts`
- Import and register `handleBundleCreate` (replace the TODO stub at line 47)

### 3. Shared Types

#### MODIFY: `src/shared/ipc/types.ts`
Replace empty stubs (lines 144-145) with:
```typescript
export interface CompositionMetadata {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface BundleCreateRequest {
  filePath: string;
}

export interface BundleCreateResponse {
  success: boolean;
  serveUrl?: string;
  compositions?: CompositionMetadata[];
  cached?: boolean;
  error?: string;
}

export interface BundleProgressEvent {
  filePath: string;
  percent: number;
}
```

#### MODIFY: `src/shared/ipc/channels.ts`
Add after line 27:
```typescript
BUNDLE_PROGRESS: 'bundle:progress',  // Push event for progress updates
```

### 4. Preload Updates

#### MODIFY: `src/preload/preload.ts`
- Update `bundleCreate` typing (line 71) with proper types
- Add `onBundleProgress` listener with cleanup function

#### MODIFY: `src/renderer/types/electron.d.ts`
- Update `bundleCreate` signature with proper types
- Add `onBundleProgress` signature

### 5. Player Feature

#### CREATE: `src/features/player/hooks/useBundleLoader.ts`
React hook managing bundle state:
```typescript
export type BundleStatus = 'idle' | 'loading' | 'success' | 'error';

export function useBundleLoader() {
  // Returns: status, progress, serveUrl, compositions, error, cached
  // Methods: loadBundle(filePath), selectComposition(id), reset()
}
```

#### CREATE: `src/features/player/components/BundlePreview.tsx`
Iframe-based preview component:
- Props: `serveUrl`, `composition`, `className?`
- Renders iframe pointing to `${serveUrl}/index.html?composition=${id}`
- Shows loading spinner during iframe load
- Shows error message if iframe fails

#### MODIFY: `src/features/player/components/VideoPlayer.tsx`
Add bundle mode support:
- Add discriminated union: props with `component` OR props with `serveUrl` + `composition`
- Route to existing Player-based implementation OR new BundlePreview
- Export both `VideoPlayer` (component mode) and bundle-aware version

#### MODIFY: `src/features/player/types.ts`
Add:
```typescript
export interface BundlePlayerProps {
  serveUrl: string;
  composition: CompositionMetadata;
  showTimeline?: boolean;
  className?: string;
}
```

#### MODIFY: `src/features/player/index.ts`
Export new hook and component

### 6. Workspace Integration

#### MODIFY: `src/features/workspace/components/WorkspaceScreen.tsx`
- Import `useBundleLoader` from `@features/player`
- Update `handleSelectFile` to call `loadBundle(file.path)`
- Add bundle status UI (progress bar during loading, error message on failure)
- Add composition selector dropdown (when multiple compositions found)
- Pass `serveUrl` and `composition` to VideoPlayer when bundle succeeds

## Implementation Order

1. **Install packages** and verify app still launches
2. **Create remotion-bundler.ts** - core bundling logic
3. **Create bundle-handlers.ts** - IPC handler
4. **Update types** - shared/ipc/types.ts, channels.ts
5. **Update preload** - wire up bundleCreate with types
6. **Create useBundleLoader hook** - renderer state management
7. **Create BundlePreview component** - iframe wrapper
8. **Update VideoPlayer** - add bundle mode
9. **Update WorkspaceScreen** - integrate bundling on file select
10. **Test end-to-end**

## Windows Fallback Strategy

If `@remotion/bundler`'s `bundle()` fails on Windows (common with path issues), implement fallback:

```typescript
async function bundleWithCLI(entryFile: string, outDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['remotion', 'bundle', entryFile, '--output', outDir], {
      cwd: path.dirname(entryFile),
      shell: true,
    });
    // Parse output, handle errors
  });
}
```

Call this fallback inside a try/catch around the main `bundle()` call.

## Edge Cases to Handle

1. **File changes during bundling** - Track current file in ref, ignore stale results
2. **No compositions found** - Show error: "No Remotion compositions found in file"
3. **Missing dependencies** - Parse Webpack error, show: "Missing package: X"
4. **Invalid TSX syntax** - Show bundler error message
5. **Port conflicts** - Try successive ports (3100, 3101, 3102...)
6. **User selects non-TSX file** - Only trigger bundling for `.tsx` files

## Testing Plan

1. **Happy path**: Select valid TSX with single composition → see preview
2. **Multiple compositions**: Select TSX with 2+ compositions → see dropdown, switch between them
3. **Cached bundle**: Select same file again → instant load (shows "cached" indicator)
4. **Modified file**: Edit file externally, reselect → triggers re-bundle
5. **Syntax error**: Select TSX with syntax error → shows error message
6. **Missing import**: Select TSX importing non-existent package → shows "Missing package" error
7. **Rapid switching**: Select file A, then B before A finishes → B's result shown, not A's

## Critical Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/remotion-bundler.ts` | CREATE | Core bundling + caching + Express server |
| `src/main/ipc/bundle-handlers.ts` | CREATE | IPC handler |
| `src/main/ipc/register.ts` | MODIFY | Register handler |
| `src/shared/ipc/types.ts` | MODIFY | Add Bundle types |
| `src/shared/ipc/channels.ts` | MODIFY | Add BUNDLE_PROGRESS |
| `src/preload/preload.ts` | MODIFY | Type bundleCreate, add onBundleProgress |
| `src/features/player/hooks/useBundleLoader.ts` | CREATE | Bundle loading hook |
| `src/features/player/components/BundlePreview.tsx` | CREATE | Iframe preview |
| `src/features/player/components/VideoPlayer.tsx` | MODIFY | Add bundle mode |
| `src/features/player/types.ts` | MODIFY | Add BundlePlayerProps |
| `src/features/workspace/components/WorkspaceScreen.tsx` | MODIFY | Integrate bundling |

---

# Step 3.2b — Wrapper Generation Fix (TODO)

## Problem

The current implementation bundles user TSX files directly, but `getCompositions()` fails with timeout because:
1. User files are React components, NOT Remotion root files
2. Remotion expects `registerRoot()` to be called
3. Without `registerRoot()`, `getCompositions()` times out waiting for compositions to register

**Error seen:**
```
A delayRender() "Loading root component" was called but not cleared after 28000ms
```

## Solution: Generate Wrapper Root File

User TSX files follow a convention with `compositionConfig` export:
```typescript
export const compositionConfig = {
  id: 'ThermometerGauge',
  durationInSeconds: 10,
  fps: 60,
  width: 1920,
  height: 1080,
};

const MyComponent: React.FC = () => { ... };
export default MyComponent;
```

We need to generate a wrapper that imports the user file and registers it properly:
```typescript
// Generated: _vidtsx_root.tsx
import { registerRoot, Composition } from 'remotion';
import UserComponent, { compositionConfig } from './UserFile.tsx';

const Root = () => (
  <Composition
    id={compositionConfig.id}
    component={UserComponent}
    durationInFrames={compositionConfig.durationInSeconds * compositionConfig.fps}
    fps={compositionConfig.fps}
    width={compositionConfig.width}
    height={compositionConfig.height}
  />
);

registerRoot(Root);
```

## Implementation Plan

### 1. Create wrapper generator utility
**File:** `src/main/services/composition-wrapper.ts`

```typescript
interface CompositionConfig {
  id: string;
  durationInSeconds?: number;
  durationInFrames?: number;
  fps: number;
  width: number;
  height: number;
}

interface WrapperResult {
  wrapperPath: string;
  config: CompositionConfig;
}

export async function generateWrapper(userFilePath: string): Promise<WrapperResult> {
  // 1. Read user file content
  // 2. Parse to find:
  //    - compositionConfig export (required)
  //    - Default export name (component)
  // 3. Generate wrapper TSX in same directory
  // 4. Return wrapper path and parsed config
}

export async function cleanupWrapper(wrapperPath: string): Promise<void> {
  // Delete generated wrapper file after bundling
}
```

### 2. Parse user file for exports
Use regex or simple AST parsing to extract:
```typescript
// Find: export const compositionConfig = { ... }
const configMatch = content.match(/export\s+const\s+compositionConfig\s*=\s*(\{[\s\S]*?\});/);

// Find: export default ComponentName
const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
```

### 3. Generate wrapper content
```typescript
function generateWrapperContent(
  userFileName: string,
  componentName: string,
  hasConfig: boolean
): string {
  if (hasConfig) {
    return `
import { registerRoot, Composition } from 'remotion';
import ${componentName}, { compositionConfig } from './${userFileName}';

const durationInFrames = compositionConfig.durationInFrames
  ?? (compositionConfig.durationInSeconds * compositionConfig.fps);

const Root = () => (
  <Composition
    id={compositionConfig.id}
    component={${componentName}}
    durationInFrames={durationInFrames}
    fps={compositionConfig.fps}
    width={compositionConfig.width}
    height={compositionConfig.height}
  />
);

registerRoot(Root);
`;
  } else {
    // Fallback: use defaults
    return `
import { registerRoot, Composition } from 'remotion';
import ${componentName} from './${userFileName}';

const Root = () => (
  <Composition
    id="main"
    component={${componentName}}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(Root);
`;
  }
}
```

### 4. Update remotion-bundler.ts

**Before bundling:**
```typescript
export async function bundleComposition(entryFilePath: string, ...): Promise<BundleResult> {
  // 1. Generate wrapper
  const { wrapperPath, config } = await generateWrapper(entryFilePath);

  // 2. Bundle the WRAPPER, not the original file
  bundlePath = await bundle({
    entryPoint: wrapperPath,  // <-- Use wrapper
    outDir,
    // ...
  });

  // 3. Clean up wrapper file
  await cleanupWrapper(wrapperPath);

  // 4. getCompositions() now works because wrapper has registerRoot
  const compositions = await getCompositions(serveUrl, { ... });

  // ...
}
```

### 5. Handle edge cases

| Case | Handling |
|------|----------|
| No `compositionConfig` | Use defaults (1920x1080, 30fps, 300 frames) |
| No default export | Error: "File must have a default export" |
| `durationInSeconds` vs `durationInFrames` | Support both, calculate frames if needed |
| Multiple compositions | Future: parse array of configs |
| Invalid config values | Validate before generating wrapper |

## Files to Modify

| File | Changes |
|------|---------|
| `src/main/services/composition-wrapper.ts` | CREATE - Wrapper generation logic |
| `src/main/services/remotion-bundler.ts` | MODIFY - Use wrapper before bundling |

## Testing

1. File with `compositionConfig` → wrapper uses config values
2. File without `compositionConfig` → wrapper uses defaults
3. File with `durationInSeconds` → calculates frames correctly
4. File with `durationInFrames` → uses directly
5. Verify wrapper cleanup after bundling
6. Verify `getCompositions()` returns correct metadata

## Dependencies

Already installed:
- `@remotion/bundler@4.0.435`
- `@remotion/renderer@4.0.435` (for getCompositions)
- `@remotion/compositor-win32-x64-msvc` (native module)

## Estimated Effort

~2-3 hours to implement and test wrapper generation
