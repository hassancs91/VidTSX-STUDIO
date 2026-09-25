// The add-ons SDK's `faceFromLandmarks` vendored into the host, the way ★1
// vendored the renderer (docs/studio/FILTER_PACKS_DESIGN.md "Analysis
// tracks"): `D:/repos/vidtsx-addons/filters/core/landmarks.ts`, behaviour
// unchanged. It turns a 468/478-point face-mesh topology (normalised to the
// frame) into the `Face` record the SDK's filters consume. The analysis
// worker calls it per detected face; the record is what the track stores.
//
// Pure — no DOM, no Node — so main, the worker and the tests share it.

import type { FilterFace, FilterPoint } from '../types/studio-effects';

const middle = (a: FilterPoint, b: FilterPoint): FilterPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Convert MediaPipe's 468/478-point topology. width/height correct roll for non-square inputs. */
export function faceFromLandmarks(
  points: readonly FilterPoint[],
  width = 1,
  height = 1,
  mouthOpen?: number,
): FilterFace | null {
  if (
    points.length < 468 ||
    width <= 0 ||
    height <= 0 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const leftEye = middle(points[33], points[133]),
    rightEye = middle(points[362], points[263]);
  const forehead = points[10],
    chin = points[152];
  const center = middle(forehead, chin);
  const faceWidth =
    Math.hypot((points[454].x - points[234].x) * width, (points[454].y - points[234].y) * height) /
    width;
  const faceHeight =
    Math.hypot((chin.x - forehead.x) * width, (chin.y - forehead.y) * height) / height;
  return {
    center,
    width: faceWidth,
    height: faceHeight,
    rotation: Math.atan2((rightEye.y - leftEye.y) * height, (rightEye.x - leftEye.x) * width),
    leftEye,
    rightEye,
    nose: points[1],
    mouth: middle(points[13], points[14]),
    forehead,
    mouthOpen:
      mouthOpen ??
      Math.min(
        1,
        Math.hypot(points[14].x - points[13].x, points[14].y - points[13].y) / (faceHeight * 0.2),
      ),
  };
}
