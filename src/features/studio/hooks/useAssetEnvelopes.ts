// Loads RMS envelopes into the renderer for the assets a text delete may cut —
// the Transcript panel snaps its edges against the same waveform cache JSON
// (cache/waveforms/<assetId>.json) the main-process planner reads, through the
// guarded studioCacheRead IPC, exactly like the peaks in useStudioMedia.
//
// Kept apart from the peaks on purpose: `rmsDb` doubles the data per asset and
// only this panel needs it, so it loads when the panel asks, not on every open.

import { useEffect, useRef, useState } from 'react';
import { RmsEnvelope } from '@shared/studio';
import type { StudioMediaAsset } from '../types';

/** Structural view of the waveform cache file — main owns the full type. */
interface WaveformFileRms {
  peaksPerSecond?: number;
  rmsDb?: number[];
}

export function parseRmsEnvelope(json: string): RmsEnvelope | null {
  const parsed = JSON.parse(json) as WaveformFileRms;
  // Version-1 files carry peaks only; the caller falls back to padded edges.
  if (!Array.isArray(parsed.rmsDb) || parsed.rmsDb.length === 0 || !parsed.peaksPerSecond) return null;
  return new RmsEnvelope(parsed.rmsDb, parsed.peaksPerSecond);
}

/** Envelopes per asset id for the given assets (ready waveforms that carry RMS data only). */
export function useAssetEnvelopes(
  projectId: string | null,
  assets: StudioMediaAsset[],
): Map<string, RmsEnvelope> {
  const [envelopes, setEnvelopes] = useState<Map<string, RmsEnvelope>>(new Map());
  // Asked once per asset — a file without RMS data must not be re-read on every render.
  const asked = useRef(new Set<string>());

  useEffect(() => {
    asked.current = new Set();
    setEnvelopes(new Map());
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    for (const asset of assets) {
      const relPath = asset.waveform?.status === 'ready' ? asset.waveform.path : null;
      if (!relPath || asked.current.has(asset.id)) continue;
      asked.current.add(asset.id);
      void (async () => {
        try {
          const res = await window.api.studioCacheRead({ projectId, relPath });
          if (!res.success || !res.data) return;
          const envelope = parseRmsEnvelope(atob(res.data));
          if (envelope) setEnvelopes((prev) => new Map(prev).set(asset.id, envelope));
        } catch {
          // No envelope only loses the snap — the delete still works, padded.
        }
      })();
    }
  }, [projectId, assets]);

  return envelopes;
}
