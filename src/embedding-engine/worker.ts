import { parentPort } from 'worker_threads';
import path from 'path';
import { existsSync } from 'fs';
import type { EmbeddingWorkerRequest, EmbeddingWorkerResponse } from './types';

/**
 * Prepend the onnxruntime-node DLL directory to PATH on Windows.
 * The native onnxruntime_binding.node needs onnxruntime.dll and other
 * companion DLLs in the same directory. Without this, Windows can't
 * find them and throws "The operating system cannot run %1".
 *
 * Same pattern as loadSherpa() in src/audio-engine/audio-engine.ts.
 */
if (process.platform === 'win32') {
  const arch = process.arch; // 'x64' or 'arm64'
  const subdir = path.join('bin', 'napi-v6', 'win32', arch);
  const possibleDirs = [
    path.join(__dirname, '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(__dirname, '..', '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', subdir),
  ];

  for (const dir of possibleDirs) {
    if (existsSync(path.join(dir, 'onnxruntime.dll'))) {
      const currentPath = process.env.PATH || '';
      if (!currentPath.includes(dir)) {
        process.env.PATH = `${dir};${currentPath}`;
      }
      break;
    }
  }
}

// Lazy-loaded transformers pipeline
let currentPipeline: unknown = null;
let currentModelId: string | null = null;

function send(msg: EmbeddingWorkerResponse): void {
  parentPort!.postMessage(msg);
}

parentPort!.on('message', async (msg: EmbeddingWorkerRequest) => {
  try {
    switch (msg.type) {
      case 'loadModel': {
        // Dynamic import so transformers.js is only loaded when needed
        const { pipeline, env } = await import('@huggingface/transformers');

        // Never fetch from remote — only use pre-downloaded local files
        env.allowRemoteModels = false;

        // Dispose previous pipeline if any
        if (currentPipeline && typeof (currentPipeline as { dispose?: () => void }).dispose === 'function') {
          (currentPipeline as { dispose: () => void }).dispose();
        }

        currentPipeline = await pipeline('feature-extraction', msg.modelPath, {
          local_files_only: true,
        });
        currentModelId = msg.modelId;

        send({ type: 'modelLoaded', modelId: msg.modelId });
        break;
      }

      case 'embed': {
        if (!currentPipeline) {
          send({ type: 'error', requestId: msg.requestId, error: 'No model loaded' });
          return;
        }

        const extractor = currentPipeline as (
          texts: string[],
          options: { pooling: string; normalize: boolean },
        ) => Promise<{ tolist: () => number[][]; dims: number[] }>;

        const output = await extractor(msg.texts, {
          pooling: 'mean',
          normalize: msg.normalize,
        });

        send({
          type: 'embedResult',
          requestId: msg.requestId,
          embeddings: output.tolist(),
          dimensions: output.dims[output.dims.length - 1],
        });
        break;
      }

      case 'unloadModel': {
        if (currentPipeline && typeof (currentPipeline as { dispose?: () => void }).dispose === 'function') {
          (currentPipeline as { dispose: () => void }).dispose();
        }
        currentPipeline = null;
        currentModelId = null;
        send({ type: 'modelUnloaded' });
        break;
      }
    }
  } catch (err) {
    send({
      type: 'error',
      requestId: 'requestId' in msg ? msg.requestId : undefined,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
