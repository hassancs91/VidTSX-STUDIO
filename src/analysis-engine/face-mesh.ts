// The face-mesh crop/align — the harness's `faces.mjs` ported (docs/studio/
// FILTER_PACKS_DESIGN.md "Facts the build must carry" 2): MediaPipe's
// detection → ROI is what makes the mesh land. The ROI is a square around the
// detection box's centre, side 1.5 × max(w, h), rolled so the eye line is
// level (YuNet keypoints 0 / 1 = right / left eye in image space); the 256²
// RGB crop goes in as NHWC 0..1, the 478 points come back in crop pixels and
// map back through the same transform. One refine pass re-crops from the
// mesh's own points (33 → 263 for the roll), the way MediaPipe tracks.
// Presence is a logit: sigmoid > 0.5 keeps the face. Pure.

import type { FilterPoint } from '../shared/types/studio-effects';
import { sampleBilinear } from './image-ops';
import type { YunetDetection } from './yunet';

export const MESH_INPUT = 256;
export const MESH_POINTS = 478;
/** The mesh's ROI side relative to the detection box's long side. */
const ROI_SCALE = 1.5;

/** A square region of the frame in pixels: centre, side and roll. */
export interface MeshRoi {
  cx: number;
  cy: number;
  side: number;
  rotation: number;
}

function roiFrom(cx: number, cy: number, w: number, h: number, rightEye: FilterPoint, leftEye: FilterPoint): MeshRoi {
  return { cx, cy, side: Math.max(w, h) * ROI_SCALE, rotation: Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x) };
}

/** MediaPipe's detection → ROI. */
export function roiFromDetection(det: YunetDetection): MeshRoi {
  return roiFrom(det.x + det.w / 2, det.y + det.h / 2, det.w, det.h, det.kps[0], det.kps[1]);
}

/** MediaPipe's landmarks → ROI: the mesh's own box, rolled by 33 (right eye outer) → 263 (left eye outer). */
export function roiFromPoints(points: readonly FilterPoint[], W: number, H: number): MeshRoi {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < 468; i++) {
    const p = points[i];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = ((minX + maxX) / 2) * W;
  const cy = ((minY + maxY) / 2) * H;
  return roiFrom(cx, cy, (maxX - minX) * W, (maxY - minY) * H, { x: points[33].x * W, y: points[33].y * H }, { x: points[263].x * W, y: points[263].y * H });
}

/** Fill the mesh's [1, 256, 256, 3] RGB 0..1 buffer with the rolled square crop. */
export function meshInputFrom(rgb: Uint8Array, W: number, H: number, roi: MeshRoi, buffer: Float32Array): void {
  const cos = Math.cos(roi.rotation);
  const sin = Math.sin(roi.rotation);
  for (let v = 0; v < MESH_INPUT; v++) {
    for (let u = 0; u < MESH_INPUT; u++) {
      const nx = (u + 0.5) / MESH_INPUT - 0.5;
      const ny = (v + 0.5) / MESH_INPUT - 0.5;
      const x = roi.cx + (nx * cos - ny * sin) * roi.side;
      const y = roi.cy + (nx * sin + ny * cos) * roi.side;
      sampleBilinear(rgb, W, H, x, y, buffer, (v * MESH_INPUT + u) * 3);
    }
  }
}

/** The 478 landmarks, crop pixels → frame-normalised, through the ROI's transform. */
export function meshPointsFrom(raw: ArrayLike<number>, roi: MeshRoi, W: number, H: number): FilterPoint[] {
  const cos = Math.cos(roi.rotation);
  const sin = Math.sin(roi.rotation);
  const points: FilterPoint[] = new Array<FilterPoint>(MESH_POINTS);
  for (let i = 0; i < MESH_POINTS; i++) {
    const nx = raw[i * 3] / MESH_INPUT - 0.5;
    const ny = raw[i * 3 + 1] / MESH_INPUT - 0.5;
    points[i] = { x: (roi.cx + (nx * cos - ny * sin) * roi.side) / W, y: (roi.cy + (nx * sin + ny * cos) * roi.side) / H };
  }
  return points;
}

export function presenceFromLogit(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}
