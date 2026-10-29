// Spawns the library-search engine child as an Electron utilityProcess (LIBRARY_SEARCH_DESIGN.md §7) and adapts it to
// the host's EngineChild. Imported only by main's wiring — search-engine.ts itself never imports electron, so its
// tests run in plain node. `library-search-worker.js` sits beside main's index.js (electron.vite.config.mjs entry).

import { utilityProcess } from 'electron';
import path from 'path';
import type { EngineChild, SearchWorkerResponse } from './types';

export function forkLibrarySearchWorker(): EngineChild {
  const child = utilityProcess.fork(path.join(__dirname, 'library-search-worker.js'), [], { serviceName: 'vidtsx-library-search' });
  return {
    postMessage: (msg) => child.postMessage(msg),
    onMessage: (listener) => {
      child.on('message', (msg: SearchWorkerResponse) => listener(msg));
    },
    onExit: (listener) => {
      child.on('exit', (code: number) => listener(code));
    },
    kill: () => {
      child.kill();
    },
  };
}
