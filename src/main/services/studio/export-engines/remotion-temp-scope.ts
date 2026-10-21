/**
 * Puts the temporary folders Remotion makes during one export inside that export's own
 * scratch folder (docs/studio/END_TO_END_PLAN.md §2 T7, part A2).
 *
 * Remotion 4.0.435 names its per-render assets folder `os.tmpdir()/remotion-v<ver>-assets
 * <random>` (`@remotion/renderer` `tmp-dir.js` + `assets/download-map.js`), holding a full
 * copy of every source file the render reads, and a cancelled render can leave it behind
 * (3.77 GB on 2026-10-20). Its name carries no job, so which leftover is whose was a guess.
 * Inside `withRemotionTempDir(dir, fn)` every `os.tmpdir()` call answers `dir` — the async
 * context follows Remotion's promise chain into `makeDownloadMap()` — so this job's assets
 * folder is born under its scratch folder and leaves with it, on success, cancel and
 * failure alike. Renders outside the scope (another job, the Creator) keep the real temp.
 */
import { AsyncLocalStorage } from 'async_hooks';
import os from 'os';

const scope = new AsyncLocalStorage<string>();
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;
  const original = os.tmpdir.bind(os);
  // Remotion calls `require('node:os').tmpdir()` at use time, so the module property is the
  // seam. A default import (never `import * as`) is the one shared builtin object.
  Object.defineProperty(os, 'tmpdir', {
    value: () => scope.getStore() ?? original(),
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/** Run `fn` with `os.tmpdir()` answering `dir` (which must exist) for everything it starts. */
export function withRemotionTempDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  install();
  return scope.run(dir, fn);
}
