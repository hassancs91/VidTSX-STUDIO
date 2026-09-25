import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { faceFromLandmarks } from '../shared/studio/face-landmarks';
import type { FilterFace } from '../shared/types/studio-effects';
import { meshInputFrom, meshPointsFrom, MESH_INPUT, MESH_POINTS, presenceFromLogit, roiFromDetection, roiFromPoints } from './face-mesh';
import { matteToMask, modnetInputFrom } from './modnet';
import type { AnalysisProvider, AnalysisWorkerRequest, AnalysisWorkerResponse, FaceModelPaths } from './types';
import { decodeYunet, YUNET_INPUT, yunetInputFrom } from './yunet';

/**
 * Analysis host process (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
 * tracks"): the faces pipeline of the spike harness (`faces.mjs`) — YuNet
 * detect → MediaPipe-style crop/align → face-mesh (+ one refine pass) → the
 * SDK's `faceFromLandmarks` — and the masks pipeline (`masks.mjs`) — MODNet
 * → the matte area-averaged to the stored mask size — over frames main feeds
 * it as raw RGB. The two groups load and release independently.
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
let matting: OrtSession | null = null;
const detInput = new Float32Array(3 * YUNET_INPUT * YUNET_INPUT);
const meshInput = new Float32Array(MESH_INPUT * MESH_INPUT * 3);
/** MODNet's input, resized when the input size changes (one size per job). */
let mattingInput = new Float32Array(0);

function send(msg: AnalysisWorkerResponse): void {
  parentPort.postMessage(msg);
}

function firstLine(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 300);
}

async function releaseAll(open: (OrtSession | null)[]): Promise<void> {
  await Promise.all(open.filter((s): s is OrtSession => s !== null).map((s) => s.release().catch(() => {})));
}

async function releaseFaceSessions(): Promise<void> {
  const open = [detector, mesh];
  detector = null;
  mesh = null;
  await releaseAll(open);
}

async function releaseMaskSession(): Promise<void> {
  const open = [matting];
  matting = null;
  await releaseAll(open);
}

async function createSession(modelPath: string, ep: AnalysisProvider): Promise<OrtSession> {
  if (!ort) ort = (await import('onnxruntime-node')) as unknown as OrtModule;
  return ort.InferenceSession.create(modelPath, {
    executionProviders: ep === 'dml' ? [{ name: 'dml', deviceId: 0 }] : ['cpu'],
    logSeverityLevel: 3,
  });
}

/**
 * DirectML first (when preferred), the CPU when it fails to initialise:
 * `create` builds the group's sessions on one provider (and cleans up after
 * itself on a throw). Says which ran, and why DML did not.
 */
async function loadOnBestProvider(
  requestId: string,
  preferGpu: boolean,
  create: (ep: AnalysisProvider) => Promise<void>,
): Promise<AnalysisWorkerResponse> {
  const t0 = performance.now();
  let fallback: string | undefined;
  let ep: AnalysisProvider = 'cpu';
  let ready = false;
  if (preferGpu) {
    try {
      await create('dml');
      ep = 'dml';
      ready = true;
    } catch (err) {
      fallback = `DirectML unavailable: ${firstLine(err)}`;
    }
  }
  if (!ready) await create('cpu');
  return { type: 'loaded', requestId, ep, loadMs: Math.round(performance.now() - t0), ...(fallback ? { fallback } : {}) };
}

async function loadFaces(requestId: string, models: FaceModelPaths, preferGpu: boolean): Promise<AnalysisWorkerResponse> {
  await releaseFaceSessions();
  return loadOnBestProvider(requestId, preferGpu, async (ep) => {
    try {
      detector = await createSession(models.yunet, ep);
      mesh = await createSession(models.mesh, ep);
    } catch (err) {
      await releaseFaceSessions();
      throw err;
    }
  });
}

async function loadMasks(requestId: string, model: string, preferGpu: boolean): Promise<AnalysisWorkerResponse> {
  await releaseMaskSession();
  return loadOnBestProvider(requestId, preferGpu, async (ep) => {
    matting = await createSession(model, ep);
  });
}

/** One frame through MODNet at its input size → the stored mask (`maskWidth × maskHeight`, 8-bit) + the inference time alone. */
async function runMask(rgb: Uint8Array, W: number, H: number, maskWidth: number, maskHeight: number): Promise<{ mask: Uint8Array; inferMs: number }> {
  if (!ort || !matting) throw new Error('The subject model is not loaded');
  if (mattingInput.length !== 3 * W * H) mattingInput = new Float32Array(3 * W * H);
  modnetInputFrom(rgb, W, H, mattingInput);
  const t0 = performance.now();
  const out = await matting.run({ [matting.inputNames[0]]: new ort.Tensor('float32', mattingInput, [1, 3, H, W]) });
  const inferMs = performance.now() - t0;
  const matte = out[matting.outputNames[0]];
  if (!matte || matte.data.length !== W * H) throw new Error('MODNet output has an unexpected shape');
  return { mask: matteToMask(matte.data, W, H, maskWidth, maskHeight), inferMs };
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

/** The frame's bytes, checked against its size (structured clone can deliver a plain Uint8Array or a Buffer). */
function frameBytes(raw: Uint8Array, width: number, height: number): Uint8Array {
  const rgb = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike);
  const expected = width * height * 3;
  if (rgb.length !== expected) throw new Error(`Bad frame size: got ${rgb.length} bytes, expected ${expected}`);
  return rgb;
}

async function handle(msg: AnalysisWorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case 'loadFaces':
        send(await loadFaces(msg.requestId, msg.models, msg.preferGpu));
        break;
      case 'loadMasks':
        send(await loadMasks(msg.requestId, msg.model, msg.preferGpu));
        break;
      case 'faces': {
        const rgb = frameBytes(msg.rgb, msg.width, msg.height);
        const t0 = performance.now();
        const faces = await runFaces(rgb, msg.width, msg.height, msg.maxFaces, msg.refinePasses);
        send({ type: 'facesResult', requestId: msg.requestId, faces, ms: Math.round((performance.now() - t0) * 10) / 10 });
        break;
      }
      case 'mask': {
        const rgb = frameBytes(msg.rgb, msg.width, msg.height);
        const t0 = performance.now();
        const { mask, inferMs } = await runMask(rgb, msg.width, msg.height, msg.maskWidth, msg.maskHeight);
        send({ type: 'maskResult', requestId: msg.requestId, mask, ms: Math.round((performance.now() - t0) * 10) / 10, inferMs: Math.round(inferMs * 10) / 10 });
        break;
      }
      case 'release':
        await Promise.all([releaseFaceSessions(), releaseMaskSession()]);
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
