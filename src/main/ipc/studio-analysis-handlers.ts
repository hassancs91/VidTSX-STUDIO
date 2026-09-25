// Analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md "Analysis tracks"):
// queue a `faceTrack` / `subjectMask` media job for an asset's spans, or
// cancel one. Progress and results ride the media-job event stream; the
// renderer reads a faces track (and a mask index) through the cache-read
// channel, and mask blobs by byte range here.

import fs from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import {
  STUDIO_MASK_READ_MAX,
  type StudioAnalysisCancelRequest,
  type StudioAnalysisCancelResponse,
  type StudioAnalysisKind,
  type StudioAnalysisReadMaskRequest,
  type StudioAnalysisReadMaskResponse,
  type StudioAnalysisRequest,
  type StudioAnalysisResponse,
} from '../../shared/ipc/types';
import type { TrackSpan } from '../../shared/studio/analysis-track';
import { maskBlobRelPath } from '../../shared/studio/mask-track';
import { studioMediaJobs } from '../services/studio/media-jobs';
import { getProjectDir, safeResolveCachePath } from '../services/studio/studio-paths';

const ANALYSIS_KINDS: readonly StudioAnalysisKind[] = ['faceTrack', 'subjectMask'];
/** Asset ids are uuids / slugs — never a path. */
const ASSET_ID = /^[A-Za-z0-9_-]{1,128}$/;

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
    if (!ANALYSIS_KINDS.includes(data.kind)) return { success: false, error: `Unknown analysis kind: ${String(data.kind)}` };
    if (data.assetKind !== 'video' && data.assetKind !== 'image') return { success: false, error: 'Analysis applies to video and image assets' };
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
    const ready = await studioMediaJobs.request(data.projectId, data.assetId, data.kind, data.sourcePath, {
      analysis: { assetKind: data.assetKind, proxyPath, spans, fps: data.fps },
    });
    return { success: true, ...(ready ? { ready } : {}) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to queue the analysis' };
  }
}

export async function handleStudioAnalysisCancel(
  _event: IpcMainInvokeEvent,
  data: StudioAnalysisCancelRequest,
): Promise<StudioAnalysisCancelResponse> {
  try {
    await getProjectDir(data.projectId);
    if (!ANALYSIS_KINDS.includes(data.kind)) return { success: false };
    return { success: studioMediaJobs.cancel(data.projectId, data.assetId, data.kind) };
  } catch {
    return { success: false };
  }
}

/**
 * The Player's mask reads: one byte range of the asset's mask blobs,
 * bounded, the path built here from the asset id (never a renderer path).
 * A range past the end is an error, not a short read — the index the
 * reader holds never points past what was written.
 */
export async function handleStudioAnalysisReadMask(
  _event: IpcMainInvokeEvent,
  data: StudioAnalysisReadMaskRequest,
): Promise<StudioAnalysisReadMaskResponse> {
  try {
    const { offset, length } = data;
    if (typeof data.assetId !== 'string' || !ASSET_ID.test(data.assetId)) return { success: false, error: 'Invalid asset id' };
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length <= 0 || length > STUDIO_MASK_READ_MAX) {
      return { success: false, error: 'Invalid range' };
    }
    const file = await safeResolveCachePath(data.projectId, maskBlobRelPath(data.assetId));
    const handle = await fs.open(file, 'r');
    try {
      const bytes = new Uint8Array(length);
      const { bytesRead } = await handle.read(bytes, 0, length, offset);
      if (bytesRead !== length) return { success: false, error: `Short read: ${bytesRead} of ${length} bytes` };
      return { success: true, data: bytes };
    } finally {
      await handle.close();
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to read the mask' };
  }
}
