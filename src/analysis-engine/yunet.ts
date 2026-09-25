// YuNet 2023mar (OpenCV Zoo) — input packing and output decoding, the spike
// harness's `faces.mjs` ported (docs/studio/FILTER_PACKS_DESIGN.md "Facts
// the build must carry" 3): a fixed 640×640 input, the frame letterboxed
// top-left with zero padding, BGR 0..255, no normalisation
// (cv::dnn::blobFromImage defaults); outputs per stride 8/16/32 as flat
// row-major cells, `cls`/`obj` already probabilities, score = sqrt(cls×obj);
// five keypoints: right eye, left eye, nose tip, right and left mouth corner,
// in image space. Pure — the worker feeds it tensors.

import type { FilterPoint } from '../shared/types/studio-effects';
import { resizeRgb } from './image-ops';

export const YUNET_INPUT = 640;
const STRIDES = [8, 16, 32] as const;
const SCORE_THRESHOLD = 0.6;
const IOU_THRESHOLD = 0.3;

/** A face box in FRAME pixels with its five keypoints. */
export interface YunetDetection {
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** [rightEye, leftEye, nose, rightMouth, leftMouth] in frame pixels. */
  kps: FilterPoint[];
}

export interface YunetInput {
  /** [1, 3, 640, 640] float32, BGR planes. */
  data: Float32Array;
  /** Frame → letterbox scale (≤ 1 for frames larger than 640 on their long side). */
  scale: number;
}

/**
 * Pack a frame into the detector's tensor buffer (reused across frames). The
 * long side is scaled to 640 (never up) and the picture sits top-left.
 */
export function yunetInputFrom(rgb: Uint8Array, W: number, H: number, buffer: Float32Array): YunetInput {
  const scale = Math.min(1, YUNET_INPUT / Math.max(W, H));
  const dw = Math.round(W * scale);
  const dh = Math.round(H * scale);
  const src = resizeRgb(rgb, W, H, dw, dh);
  buffer.fill(0);
  const plane = YUNET_INPUT * YUNET_INPUT;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 3;
      const d = y * YUNET_INPUT + x;
      buffer[d] = src[s + 2];
      buffer[plane + d] = src[s + 1];
      buffer[2 * plane + d] = src[s];
    }
  }
  return { data: buffer, scale };
}

function iou(a: YunetDetection, b: YunetDetection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/**
 * Decode the session's outputs (`cls_8`, `obj_8`, `bbox_8`, `kps_8`, …) into
 * frame-space detections: threshold, greedy NMS by score, at most `maxFaces`.
 */
export function decodeYunet(
  outputs: Record<string, ArrayLike<number>>,
  scale: number,
  maxFaces: number,
  scoreThreshold = SCORE_THRESHOLD,
  iouThreshold = IOU_THRESHOLD,
): YunetDetection[] {
  const candidates: YunetDetection[] = [];
  for (const s of STRIDES) {
    const cols = YUNET_INPUT / s;
    const cls = outputs[`cls_${s}`];
    const obj = outputs[`obj_${s}`];
    const bbox = outputs[`bbox_${s}`];
    const kps = outputs[`kps_${s}`];
    if (!cls || !obj || !bbox || !kps) throw new Error(`YuNet output for stride ${s} missing`);
    for (let idx = 0; idx < cols * cols; idx++) {
      const score = Math.sqrt(Math.max(0, cls[idx]) * Math.max(0, obj[idx]));
      if (score < scoreThreshold) continue;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const cx = (c + bbox[idx * 4]) * s;
      const cy = (r + bbox[idx * 4 + 1]) * s;
      const w = Math.exp(bbox[idx * 4 + 2]) * s;
      const h = Math.exp(bbox[idx * 4 + 3]) * s;
      const points: FilterPoint[] = [];
      for (let n = 0; n < 5; n++) {
        points.push({ x: ((c + kps[idx * 10 + 2 * n]) * s) / scale, y: ((r + kps[idx * 10 + 2 * n + 1]) * s) / scale });
      }
      candidates.push({ score, x: (cx - w / 2) / scale, y: (cy - h / 2) / scale, w: w / scale, h: h / scale, kps: points });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const keep: YunetDetection[] = [];
  for (const candidate of candidates) {
    if (keep.every((k) => iou(k, candidate) < iouThreshold)) keep.push(candidate);
    if (keep.length >= maxFaces) break;
  }
  return keep;
}
