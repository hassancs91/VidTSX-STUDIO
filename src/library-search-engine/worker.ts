// The library-search engine child (LIBRARY_SEARCH_DESIGN.md §7), built as `library-search-worker.js` and run as an
// Electron utilityProcess — NOT a worker thread: sherpa-onnx loads its older onnxruntime.dll into main, and the
// 1.24.3 binding then fails in every thread of that process ("The operating system cannot run %1"; the precedent:
// src/content-safety-engine/worker.ts). transformers.js / onnxruntime are imported only here, lazily, on the first
// request. All logic is engine-core.ts; this file wires it to process.parentPort.

import { SearchCore } from './engine-core';
import { loadEmbedder } from './embedder';
import { ortDllDirsBeside, prependOrtDllPath } from './ort-dll-path';
import type { SearchWorkerRequest, SearchWorkerResponse } from './types';

prependOrtDllPath(ortDllDirsBeside(__dirname));

const parentPort = (process as unknown as {
  parentPort: {
    postMessage(msg: SearchWorkerResponse): void;
    on(event: 'message', listener: (e: { data: SearchWorkerRequest }) => void): void;
  };
}).parentPort;

const core = new SearchCore({
  loadEmbedder: (model) => loadEmbedder({ modelDir: model.modelDir, cacheDir: model.cacheDir }),
  send: (msg) => parentPort.postMessage(msg),
});

parentPort.on('message', (e) => {
  void core.handle(e.data);
});
