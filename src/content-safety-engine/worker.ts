import path from 'path';
import { existsSync } from 'fs';
import type { SafetyModelConfig, SafetyWorkerRequest, SafetyWorkerResponse } from './types';

/**
 * Content Safety classifier host process.
 *
 * Runs as an Electron utilityProcess (NOT a worker_thread — a deliberate
 * deviation from the embedding-worker pattern): sherpa-onnx ships its own
 * older onnxruntime.dll, and Windows resolves DLL dependencies per PROCESS
 * by base name, so once sherpa loads in main, the 1.24.3 binding fails with
 * "The operating system cannot run %1" in any thread of that process. A
 * separate process has its own DLL space and is immune to the conflict —
 * found live during the slice-5 CDP smoke walk.
 */

/**
 * Prepend the onnxruntime-node DLL directory to PATH on Windows so the
 * native binding finds onnxruntime.dll (same probe as the embedding worker).
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

/** Electron utility processes talk over process.parentPort. */
const parentPort = (process as unknown as {
  parentPort: {
    postMessage(msg: unknown): void;
    on(event: 'message', listener: (e: { data: SafetyWorkerRequest }) => void): void;
  };
}).parentPort;

interface OrtTensor {
  data: Float32Array;
}
interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}

let session: OrtSession | null = null;
let config: SafetyModelConfig | null = null;
let TensorCtor: (new (type: string, data: Float32Array, dims: number[]) => unknown) | null = null;

function send(msg: SafetyWorkerResponse): void {
  parentPort.postMessage(msg);
}

/** CHW float32 tensor from RGB24 bytes, normalized with the model's mean/std. */
function toInputTensor(rgb: Uint8Array, cfg: SafetyModelConfig): Float32Array {
  const [, height, width] = cfg.inputSize;
  const plane = height * width;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      data[c * plane + i] = (rgb[i * 3 + c] / 255 - cfg.mean[c]) / cfg.std[c];
    }
  }
  return data;
}

async function handle(msg: SafetyWorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case 'loadModel': {
        // Dynamic import so the native binding only loads inside this process.
        // CPU EP only — GPU providers add init/driver failure modes to a
        // fail-closed gate for an imperceptible speedup (Rev 1 decision 1).
        const ort = await import('onnxruntime-node');
        session = (await ort.InferenceSession.create(msg.modelPath, {
          executionProviders: ['cpu'],
        })) as unknown as OrtSession;
        TensorCtor = ort.Tensor as unknown as typeof TensorCtor extends null ? never : NonNullable<typeof TensorCtor>;
        config = msg.config;
        send({ type: 'modelLoaded' });
        break;
      }

      case 'classify': {
        if (!session || !config || !TensorCtor) {
          send({ type: 'error', requestId: msg.requestId, error: 'No safety model loaded' });
          return;
        }
        const [channels, height, width] = config.inputSize;
        const expected = channels * height * width;
        // Structured clone can deliver the bytes as a plain Uint8Array or Buffer.
        const rgb = msg.rgb instanceof Uint8Array ? msg.rgb : new Uint8Array(msg.rgb as ArrayBufferLike);
        if (rgb.length !== expected) {
          send({
            type: 'error',
            requestId: msg.requestId,
            error: `Bad input size: got ${rgb.length} bytes, expected ${expected}`,
          });
          return;
        }
        const input = new TensorCtor('float32', toInputTensor(rgb, config), [1, channels, height, width]);
        const outputs = await session.run({ [config.inputName]: input });
        const logits = outputs[config.outputName].data;
        // Softmax over the class logits
        let max = -Infinity;
        for (const v of logits) max = Math.max(max, v);
        let sum = 0;
        const exps = new Array<number>(logits.length);
        for (let i = 0; i < logits.length; i++) {
          exps[i] = Math.exp(logits[i] - max);
          sum += exps[i];
        }
        send({
          type: 'classifyResult',
          requestId: msg.requestId,
          nsfwProbability: exps[config.nsfwIndex] / sum,
        });
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
}

parentPort.on('message', (e) => {
  void handle(e.data);
});
