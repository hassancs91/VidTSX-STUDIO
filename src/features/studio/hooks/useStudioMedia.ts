import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioMediaJobEvent } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProject } from '../types';
import type { ClipWaveformData } from '../components/timeline/TimelineClip';

interface WaveformFile {
  peaksPerSecond: number;
  peaks: number[];
}

/**
 * Derived-media side of the editor: asks the main process for 720p proxies and
 * waveforms, folds job results back into the document, and resolves the URLs
 * the preview plays through.
 *
 * Preview always prefers a ready proxy and falls back to the original, so the
 * editor is usable the moment media is imported and simply gets lighter once
 * the background jobs land.
 */
export function useStudioMedia(
  projectId: string,
  folderPath: string | null,
  assets: StudioMediaAsset[],
  updateProject: (updater: (prev: StudioProject) => StudioProject) => void,
) {
  const [assetBaseUrl, setAssetBaseUrl] = useState<string | null>(null);
  const [waveforms, setWaveforms] = useState<Map<string, ClipWaveformData>>(new Map());
  const loadingWaveforms = useRef(new Set<string>());

  const applyEvent = useCallback(
    (event: StudioMediaJobEvent) => {
      if (event.projectId !== projectId) return;
      updateProject((prev) => ({
        ...prev,
        assets: prev.assets.map((asset) => {
          if (asset.id !== event.assetId) return asset;
          const entry = {
            path: event.relPath ?? asset[event.kind]?.path ?? '',
            status: event.status === 'ready' ? ('ready' as const) : event.status === 'error' ? ('error' as const) : ('generating' as const),
          };
          return event.kind === 'proxy'
            ? { ...asset, proxy: entry }
            : { ...asset, waveform: entry };
        }),
      }));
    },
    [projectId, updateProject],
  );

  // Request caches whenever the set of assets changes (already-generated files
  // come back as immediate 'ready' results, so this is cheap to re-run).
  const assetKey = assets.map((a) => a.id).join(',');
  useEffect(() => {
    if (!projectId || assets.length === 0) return;
    let cancelled = false;
    void window.api
      .studioMediaPrepare({
        projectId,
        assets: assets.map((a) => ({
          id: a.id,
          kind: a.kind,
          path: a.path,
          hasAudio: a.probe.hasAudio,
        })),
      })
      .then((res) => {
        if (cancelled || !res.success) return;
        if (res.assetBaseUrl) setAssetBaseUrl(res.assetBaseUrl);
        for (const event of res.ready ?? []) applyEvent(event);
      });
    return () => {
      cancelled = true;
    };
    // applyEvent is intentionally out of the deps — it changes identity with
    // every document write, which would re-request on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, assetKey]);

  useEffect(() => {
    return window.api.onStudioMediaJobEvent(applyEvent);
  }, [applyEvent]);

  // Pull peak data for every waveform that has landed.
  useEffect(() => {
    for (const asset of assets) {
      const relPath = asset.waveform?.status === 'ready' ? asset.waveform.path : null;
      if (!relPath || waveforms.has(asset.id) || loadingWaveforms.current.has(asset.id)) continue;
      loadingWaveforms.current.add(asset.id);
      void window.api
        .studioCacheRead({ projectId, relPath })
        .then((res) => {
          if (!res.success || !res.data) return;
          const parsed = JSON.parse(atob(res.data)) as WaveformFile;
          if (!Array.isArray(parsed.peaks) || !parsed.peaksPerSecond) return;
          setWaveforms((prev) =>
            new Map(prev).set(asset.id, {
              peaks: parsed.peaks,
              peaksPerSecond: parsed.peaksPerSecond,
            }),
          );
        })
        .catch(() => {
          // A missing waveform just means no wave drawn on the clip.
        })
        .finally(() => loadingWaveforms.current.delete(asset.id));
    }
  }, [assets, projectId, waveforms]);

  const cacheUrl = useCallback(
    (relPath: string): string | null => {
      if (!assetBaseUrl || !folderPath) return null;
      const absolute = `${folderPath}/cache/${relPath}`;
      return `${assetBaseUrl}/asset?path=${encodeURIComponent(absolute)}`;
    },
    [assetBaseUrl, folderPath],
  );

  const resolvePreviewUrl = useCallback(
    (assetId: string): string | null => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset || !assetBaseUrl) return null;
      if (asset.proxy?.status === 'ready') {
        const proxyUrl = cacheUrl(asset.proxy.path);
        if (proxyUrl) return proxyUrl;
      }
      return `${assetBaseUrl}/asset?path=${encodeURIComponent(asset.path)}`;
    },
    [assets, assetBaseUrl, cacheUrl],
  );

  const getWaveform = useCallback(
    (assetId: string): ClipWaveformData | null => waveforms.get(assetId) ?? null,
    [waveforms],
  );

  const proxyProgress = useMemo(() => {
    const videos = assets.filter((a) => a.kind === 'video');
    const ready = videos.filter((a) => a.proxy?.status === 'ready').length;
    return { total: videos.length, ready };
  }, [assets]);

  return { assetBaseUrl, resolvePreviewUrl, getWaveform, proxyProgress };
}
