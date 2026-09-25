// The analysis models, pinned (docs/studio/FILTER_PACKS_DESIGN.md "Spike
// results" → "Models, sourced and pinned"): url + sha256 + licence, the
// add-ons' `public/models/source.json` convention and the harness's
// `.vidtsx-temp/s2-analysis/models/source.json`, verbatim. Downloaded on
// first use into the app's models folder (CLAUDE.md: never bundled, never in
// `resources/`), and integrity-checked before every load the way the Content
// Safety classifier is (`image-safety.ts`).
//
// One manifest for the three, though masks come later: the faces job asks
// for its two by id.
//
// No `electron` import — the hash helpers are unit-tested in plain Node.

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import fs from 'fs/promises';

export type AnalysisModelId = 'yunet' | 'face-mesh' | 'modnet';

export interface AnalysisModelSpec {
  id: AnalysisModelId;
  /** File name inside the models folder. */
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  license: string;
  origin: string;
}

export const ANALYSIS_MODELS: readonly AnalysisModelSpec[] = [
  {
    id: 'yunet',
    file: 'yunet-2023mar.onnx',
    url: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    bytes: 232589,
    license: 'MIT (opencv_zoo models/face_detection_yunet/LICENSE, © 2020 Shiqi Yu)',
    origin: 'opencv/opencv_zoo face_detection_yunet_2023mar — fixed [1,3,640,640] BGR 0..255, 5 keypoints',
  },
  {
    id: 'face-mesh',
    file: 'face-mesh.onnx',
    url: 'https://huggingface.co/senty-au/face_landmarks_detector-ONNX/resolve/main/onnx/model.onnx',
    sha256: '7d6e82dee82a1dca5fbddb282b3cc74571833a530de317fc22ae325c3358beeb',
    // 4 920 995 measured (sha256 verified) — the spike harness's source.json recorded 4 924 169 by mistake.
    bytes: 4920995,
    license: 'Apache-2.0',
    origin:
      'Google MediaPipe Face Landmarker face_landmarks_detector.tflite (478 points) converted with tf2onnx 1.17.0 by senty-au; ' +
      'provenance verified by hash against the add-ons’ pinned face_landmarker.task (see the design doc)',
  },
  {
    id: 'modnet',
    file: 'modnet.onnx',
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
    bytes: 25888640,
    license: 'Apache-2.0 (ZHKKKe/MODNet)',
    origin: 'Xenova/modnet onnx/model.onnx — the official MODNet checkpoint converted to ONNX; dynamic NCHW in, matte out',
  },
];

/** The two the faces track needs. */
export const FACE_MODEL_IDS: readonly AnalysisModelId[] = ['yunet', 'face-mesh'];

export function analysisModel(id: AnalysisModelId): AnalysisModelSpec {
  const spec = ANALYSIS_MODELS.find((m) => m.id === id);
  if (!spec) throw new Error(`Unknown analysis model: ${id}`);
  return spec;
}

/** Streaming sha256 of a file, lower-case hex. */
export async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

export type ModelVerification = { ok: true; sha256: string } | { ok: false; reason: string };

/**
 * Size then hash: a file that is not exactly the pinned bytes is refused
 * before it is ever loaded — a truncated download or a swapped model is a
 * different model, and the track would be silently different.
 */
export async function verifyModelFile(filePath: string, spec: Pick<AnalysisModelSpec, 'file' | 'sha256' | 'bytes'>): Promise<ModelVerification> {
  let size: number;
  try {
    size = (await fs.stat(filePath)).size;
  } catch {
    return { ok: false, reason: `${spec.file} is missing` };
  }
  if (size !== spec.bytes) return { ok: false, reason: `${spec.file} is ${size} bytes, expected ${spec.bytes}` };
  const sha256 = await sha256OfFile(filePath);
  if (sha256 !== spec.sha256) {
    return { ok: false, reason: `${spec.file} integrity check failed (${sha256.slice(0, 12)}… ≠ pinned ${spec.sha256.slice(0, 12)}…)` };
  }
  return { ok: true, sha256 };
}
