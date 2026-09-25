import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { faceFromLandmarks } from '../shared/studio/face-landmarks';
import type { FilterFace } from '../shared/types/studio-effects';
import { meshInputFrom, meshPointsFrom, MESH_INPUT, MESH_POINTS, presenceFromLogit, roiFromDetection, roiFromPoints } from './face-mesh';
import type { AnalysisProvider, AnalysisWorkerRequest, AnalysisWorkerResponse, FaceModelPaths } from './types';
import { decodeYunet, YUNET_INPUT, yunetInputFrom } from './yunet';

/**
 * Analysis host process (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
 * tracks"): the faces pipeline of the spike harness (`faces.mjs`) — YuNet
 * detect → MediaPipe-style crop/align → face-mesh (+ one refine pass) → the
 * SDK's `faceFromLandmarks` — over frames main feeds it as raw RGB.
 *
 * An Electron utilityProcess on the Content Safety pattern, for the same
 * reason: sherpa-onnx ships an older onnxruntime.dll, Windows resolves DLLs
 * per PROCESS by base name, and the 1.24.3 binding cannot load into a process
 * that already carries the old one. A separate process has its own DLL space.
 *
 * DirectML first (`{ name: 'dml', deviceId: 0 }` — the high-performance
 * adapter on the spike machine), CPU when it fails to initialise; the load
 * response says which one ran, and why DML did not.
 */

/** Prepend the onnxruntime-node DLL directory to PATH on Windows (the embedding / safety workers' probe). */
if (process.platform === 'win32') {
  const subdir = path.join('bin', 'napi-v6', 'win32', process.arch);
  const possibleDirs = [
    path.join(__dirname, '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(__dirname, '..', '..', 'node_modules', 'onnxruntime-node', subdir),
    path.join(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', subdir),
  ];
  for (const dir of possibleDirs) {
    if (existsSync(path.join(dir, 'onnxruntime.dll'))) {
      const currentPath = process.env.PATH || '';
      if (!currentPath.includes(dir)) process.env.PATH = `${dir};${currentPath}`;
      break;
    }
  }
}

// Background work, like the proxy transcodes: never make the editor stutter.
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // Best effort.
}

/** Electron utility processes talk over process.parentPort. */
const parentPort = (process as unknown as {
  parentPort: {
    postMessage(msg: unknown): void;
    on(event: 'message', listener: (e: { data: AnalysisWorkerRequest }) => void): void;
  };
}).parentPort;

interface OrtTensor {
  data: ArrayLike<number>;
  dims: readonly number[];
}
interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
  release(): Promise<void>;
}
interface OrtModule {
  InferenceSession: { create(modelPath: string, options: Record<string, unknown>): Promise<OrtSession> };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
}

let ort: OrtModule | null = null;
let detector: OrtSession | null = null;
let mesh: OrtSession | null = null;
let provider: AnalysisProvider = 'cpu';
const detInput = new Float32Array(3 * YUNET_INPUT * YUNET_INPUT);
const meshInput = new Float32Array(MESH_INPUT * MESH_INPUT * 3);

function send(msg: AnalysisWorkerResponse): void {
  parentPort.postMessage(msg);
}

function firstLine(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 300);
}

async function releaseSessions(): Promise<void> {
  const open = [detector, mesh].filter((s): s is OrtSession => s !== null);
  detector = null;
  mesh = null;
  await Promise.all(open.map((s) => s.release().catch(() => {})));
}

async function createSessions(models: FaceModelPaths, ep: AnalysisProvider): Promise<void> {
  if (!ort) ort = (await import('onnxruntime-node')) as unknown as OrtModule;
  const options = {
    executionProviders: ep === 'dml' ? [{ name: 'dml', deviceId: 0 }] : ['cpu'],
    logSeverityLevel: 3,
  };
  try {
    detector = await ort.InferenceSession.create(models.yunet, options);
    mesh = await ort.InferenceSession.create(models.mesh, options);
  } catch (err) {
    await releaseSessions();
    throw err;
  }
}

async function loadFaces(models: FaceModelPaths, preferGpu: boolean): Promise<AnalysisWorkerResponse> {
  const t0 = performance.now();
  await releaseSessions();
  let fallback: string | undefined;
  if (preferGpu) {
    try {
      await createSessions(models, 'dml');
      provider = 'dml';
    } catch (err) {
      fallback = `DirectML unavailable: ${firstLine(err)}`;
    }
  }
  if (!detector) {
    await createSessions(models, 'cpu');
    provider = 'cpu';
  }
  return { type: 'facesLoaded', ep: provider, loadMs: Math.round(performance.now() - t0), ...(fallback ? { fallback } : {}) };
}

/** The mesh's two outputs by SHAPE (1434 landmark values, 1 presence logit), whatever they are named. */
function meshOutputs(out: Record<string, OrtTensor>): { landmarks: ArrayLike<number>; presence: number } {
  let landmarks: ArrayLike<number> | null = null;
  let presence: number | null = null;
  for (const tensor of Object.values(out)) {
    if (tensor.data.length === MESH_POINTS * 3) landmarks = tensor.data;
    else if (tensor.data.length === 1) presence = tensor.data[0];
  }
  if (!landmarks || presence === null) throw new Error('Face-mesh outputs have an unexpected shape');
  return { landmarks, presence: presenceFromLogit(presence) };
}

async function runFaces(rgb: Uint8Array, W: number, H: number, maxFaces: number, refinePasses: number): Promise<FilterFace[]> {
  if (!ort || !detector || !mesh) throw new Error('Face models are not loaded');
  const { scale } = yunetInputFrom(rgb, W, H, detInput);
  const detOut = await detector.run({ [detector.inputNames[0]]: new ort.Tensor('float32', detInput, [1, 3, YUNET_INPUT, YUNET_INPUT]) });
  const outputs: Record<string, ArrayLike<number>> = {};
  for (const [name, tensor] of Object.entries(detOut)) outputs[name] = tensor.data;
  const detections = decodeYunet(outputs, scale, maxFaces);

  const faces: FilterFace[] = [];
  for (const det of detections) {
    let roi = roiFromDetection(det);
    let points: ReturnType<typeof meshPointsFrom> | null = null;
    let presence = 0;
    for (let pass = 0; pass <= refinePasses; pass++) {
      meshInputFrom(rgb, W, H, roi, meshInput);
      const out = meshOutputs(await mesh.run({ [mesh.inputNames[0]]: new ort.Tensor('float32', meshInput, [1, MESH_INPUT, MESH_INPUT, 3]) }));
      points = meshPointsFrom(out.landmarks, roi, W, H);
      presence = out.presence;
      if (presence < 0.5) break;
      roi = roiFromPoints(points, W, H);
    }
    // The mesh disowned the crop (presence is its own "is there a face here"):
    // no record rather than a wrong one — the clip plays plain at that frame.
    if (!points || presence < 0.5) continue;
    const face = faceFromLandmarks(points, W, H);
    if (face) faces.push(face);
  }
  return faces;
}

async function handle(msg: AnalysisWorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case 'loadFaces':
        send(await loadFaces(msg.models, msg.preferGpu));
        break;
      case 'faces': {
        const expected = msg.width * msg.height * 3;
        // Structured clone can deliver the bytes as a plain Uint8Array or Buffer.
        const rgb = msg.rgb instanceof Uint8Array ? msg.rgb : new Uint8Array(msg.rgb as ArrayBufferLike);
        if (rgb.length !== expected) {
          send({ type: 'error', requestId: msg.requestId, error: `Bad frame size: got ${rgb.length} bytes, expected ${expected}` });
          return;
        }
        const t0 = performance.now();
        const faces = await runFaces(rgb, msg.width, msg.height, msg.maxFaces, msg.refinePasses);
        send({ type: 'facesResult', requestId: msg.requestId, faces, ms: Math.round((performance.now() - t0) * 10) / 10 });
        break;
      }
      case 'release':
        await releaseSessions();
        send({ type: 'released' });
        break;
    }
  } catch (err) {
    send({ type: 'error', requestId: 'requestId' in msg ? msg.requestId : undefined, error: firstLine(err) });
  }
}

parentPort.on('message', (e) => {
  void handle(e.data);
});
