/** Analysis engine (faces, later masks) — worker protocol. */

import type { FilterFace } from '../shared/types/studio-effects';
import type { AnalysisProvider } from '../shared/studio/face-track';

export type { AnalysisProvider };

export interface FaceModelPaths {
  yunet: string;
  mesh: string;
}

export type AnalysisWorkerRequest =
  | {
      type: 'loadFaces';
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
  | { type: 'release' };

export type AnalysisWorkerResponse =
  | {
      type: 'facesLoaded';
      ep: AnalysisProvider;
      loadMs: number;
      /** Why DirectML was not used, when the CPU fallback took over. */
      fallback?: string;
    }
  | { type: 'facesResult'; requestId: string; faces: FilterFace[]; ms: number }
  | { type: 'released' }
  | { type: 'error'; requestId?: string; error: string };
