// Reading a finished analysis track into the editor (docs/studio/
// FILTER_PACKS_DESIGN.md "Analysis tracks"): the faces JSON through the
// guarded cache-read channel; the mask INDEX the same way, and a reader
// whose blob bytes come by range over `studioAnalysisReadMask` (bounded,
// keyed by asset id — see mask-reader.ts for why not the asset server); the
// whole blob file would be ~95 MB for ten minutes, so it is never read whole.

import { parseFaceTrack, type FaceTrack } from '@shared/studio/face-track';
import { parseMaskIndex } from '@shared/studio/mask-track';
import { createMaskReader, type MaskReader } from '@shared/studio/mask-reader';

async function readCacheJson(projectId: string, relPath: string): Promise<unknown> {
  const res = await window.api.studioCacheRead({ projectId, relPath });
  if (!res.success || !res.data) return null;
  // The cache-read channel returns base64; the text is UTF-8 JSON.
  const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** The faces track, or null when it cannot be read (the clip then plays plain). */
export async function readFaceTrack(projectId: string, relPath: string): Promise<FaceTrack | null> {
  try {
    return parseFaceTrack(await readCacheJson(projectId, relPath));
  } catch {
    return null;
  }
}

/** A reader over the asset's mask track, or null when its index cannot be read. */
export async function readMaskTrack(projectId: string, assetId: string, indexRelPath: string): Promise<MaskReader | null> {
  try {
    const index = parseMaskIndex(await readCacheJson(projectId, indexRelPath));
    if (!index) return null;
    return createMaskReader(index, async (offset, length) => {
      const res = await window.api.studioAnalysisReadMask({ projectId, assetId, offset, length });
      if (!res.success || !res.data) throw new Error(res.error ?? 'mask read failed');
      return res.data instanceof Uint8Array ? res.data : new Uint8Array(res.data);
    });
  } catch {
    return null;
  }
}
