// Analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md "Analysis tracks"):
// queue a `faceTrack` media job for an asset's spans, or cancel one. Progress
// and results ride the media-job event stream; the renderer reads the track
// through the cache-read channel.

import fs from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioAnalysisCancelRequest,
  StudioAnalysisCancelResponse,
  StudioAnalysisRequest,
  StudioAnalysisResponse,
} from '../../shared/ipc/types';
import type { TrackSpan } from '../../shared/studio/face-track';
import { studioMediaJobs } from '../services/studio/media-jobs';
import { getProjectDir, safeResolveCachePath } from '../services/studio/studio-paths';

/** Finite, ordered, non-negative spans only — anything else is dropped, and an empty list is refused. */
function sanitizeSpans(raw: unknown): TrackSpan[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackSpan[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length !== 2) continue;
    const [a, b] = s as unknown[];
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a < 0 || b < a) continue;
    out.push([a, b]);
  }
  return out;
}

export async function handleStudioAnalysisRequest(
  _event: IpcMainInvokeEvent,
  data: StudioAnalysisRequest,
): Promise<StudioAnalysisResponse> {
  try {
    await getProjectDir(data.projectId); // Validates the id before any fs work.
    if (data.kind !== 'faceTrack') return { success: false, error: `Unknown analysis kind: ${String(data.kind)}` };
    if (data.assetKind !== 'video' && data.assetKind !== 'image') return { success: false, error: 'Face analysis applies to video and image assets' };
    if (typeof data.fps !== 'number' || !Number.isFinite(data.fps) || data.fps <= 0) return { success: false, error: 'Invalid fps' };
    const spans = data.assetKind === 'image' ? [[0, 0] as TrackSpan] : sanitizeSpans(data.spans);
    if (spans.length === 0) return { success: false, error: 'No span to analyse' };
    try {
      await fs.access(data.sourcePath);
    } catch {
      return { success: false, error: 'Source file not found on disk' };
    }
    let proxyPath: string | null = null;
    if (data.proxyRelPath) {
      const resolved = await safeResolveCachePath(data.projectId, data.proxyRelPath);
      try {
        await fs.access(resolved);
        proxyPath = resolved;
      } catch {
        proxyPath = null; // A proxy the document believes in but the disk lost: analyse the original.
      }
    }
    const ready = await studioMediaJobs.request(data.projectId, data.assetId, 'faceTrack', data.sourcePath, {
      analysis: { assetKind: data.assetKind, proxyPath, spans, fps: data.fps },
    });
    return { success: true, ...(ready ? { ready } : {}) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to queue face analysis' };
  }
}

export async function handleStudioAnalysisCancel(
  _event: IpcMainInvokeEvent,
  data: StudioAnalysisCancelRequest,
): Promise<StudioAnalysisCancelResponse> {
  try {
    await getProjectDir(data.projectId);
    return { success: studioMediaJobs.cancel(data.projectId, data.assetId, data.kind) };
  } catch {
    return { success: false };
  }
}
