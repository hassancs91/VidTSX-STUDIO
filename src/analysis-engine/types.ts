/** Analysis engine (faces, subject masks) — worker protocol. */

import type { FilterFace } from '../shared/types/studio-effects';
import type { AnalysisProvider } from '../shared/studio/analysis-track';

export type { AnalysisProvider };

export interface FaceModelPaths {
  yunet: string;
  mesh: string;
}

export type AnalysisWorkerRequest =
  | {
      type: 'loadFaces';
      requestId: string;
      models: FaceModelPaths;
      /** Try DirectML first; false = CPU only. The response says which one ran. */
      preferGpu: boolean;
    }
  | {
      type: 'faces';
      requestId: string;
      width: number;
      height: number;
      /** Tightly packed RGB24 of exactly width × height pixels. */
      rgb: Uint8Array;
      maxFaces: number;
      /** Re-crops from the mesh's own points this many more times (MediaPipe tracks with one). */
      refinePasses: number;
    }
  | {
      type: 'loadMasks';
      requestId: string;
      /** MODNet's path. */
      model: string;
      preferGpu: boolean;
    }
  | {
      type: 'mask';
      requestId: string;
      /** The model's input size (both multiples of 32) — the feed delivers frames at it. */
      width: number;
      height: number;
      /** Tightly packed RGB24 of exactly width × height pixels. */
      rgb: Uint8Array;
      /** The stored mask size the matte is brought down to (≤ 256 on the long side). */
      maskWidth: number;
      maskHeight: number;
    }
  | { type: 'release' };

export type AnalysisWorkerResponse =
  | {
      type: 'loaded';
      requestId: string;
      ep: AnalysisProvider;
      loadMs: number;
      /** Why DirectML was not used, when the CPU fallback took over. */
      fallback?: string;
    }
  | { type: 'facesResult'; requestId: string; faces: FilterFace[]; ms: number }
  | { type: 'maskResult'; requestId: string; mask: Uint8Array; ms: number; inferMs: number }
  | { type: 'released' }
  | { type: 'error'; requestId?: string; error: string };
