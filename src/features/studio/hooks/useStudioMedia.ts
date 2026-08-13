import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioMediaJobEvent } from '@shared/ipc/types';
import { findSttEntry } from '@shared/presets/stt-models';
import type { StudioAssetTranscript, StudioMediaAsset, StudioProject } from '../types';
import type { ClipWaveformData } from '../components/timeline/TimelineClip';

interface WaveformFile {
  peaksPerSecond: number;
  peaks: number[];
}

export interface TranscribeProgress {
  percent: number;
  message?: string;
}

/** Outcome of a Locate… attempt, for the shell to route (toast / confirm). */
export type RelinkResult =
  | { status: 'ok' }
  | { status: 'canceled' }
  | { status: 'mismatch'; pickedPath: string }
  | { status: 'error'; message: string };

/**
 * Derived-media side of the editor: asks the main process for 720p proxies and
 * waveforms, folds job results back into the document, and resolves the URLs
 * the preview plays through. Also owns the per-asset transcription actions —
 * those jobs share the same event stream but only ever start from an explicit
 * user click, never from import.
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
  // Environmental state, deliberately NOT in the document: whether the source
  // file is reachable on THIS machine right now (Slice F relink).
  const [missingAssetIds, setMissingAssetIds] = useState<ReadonlySet<string>>(new Set());
  const [waveforms, setWaveforms] = useState<Map<string, ClipWaveformData>>(new Map());
  const [transcribeProgress, setTranscribeProgress] = useState<Map<string, TranscribeProgress>>(
    new Map(),
  );
  const loadingWaveforms = useRef(new Set<string>());

  const patchAsset = useCallback(
    (assetId: string, patch: (asset: StudioMediaAsset) => StudioMediaAsset) => {
      updateProject((prev) => ({
        ...prev,
        assets: prev.assets.map((asset) => (asset.id === assetId ? patch(asset) : asset)),
      }));
    },
    [updateProject],
  );

  const clearProgress = useCallback((assetId: string) => {
    setTranscribeProgress((prev) => {
      if (!prev.has(assetId)) return prev;
      const next = new Map(prev);
      next.delete(assetId);
      return next;
    });
  }, []);

  const applyEvent = useCallback(
    (event: StudioMediaJobEvent) => {
      if (event.projectId !== projectId) return;

      if (event.kind === 'transcript') {
        if (event.status === 'generating') {
          // Progress ticks live in transient state only — writing them into
          // the document would spam the debounced autosave.
          setTranscribeProgress((prev) =>
            new Map(prev).set(event.assetId, {
              percent: event.percent ?? 0,
              message: event.message,
            }),
          );
          return;
        }
        clearProgress(event.assetId);
        patchAsset(event.assetId, (asset) => {
          if (event.status === 'canceled') {
            const { transcript: _removed, ...rest } = asset;
            return rest;
          }
          if (event.status === 'ready') {
            return {
              ...asset,
              transcript: {
                path: event.relPath ?? asset.transcript?.path ?? '',
                status: 'ready',
                engine: event.transcript?.engine ?? asset.transcript?.engine ?? 'whisper',
                sttModelId: event.transcript?.sttModelId ?? asset.transcript?.sttModelId,
                language: event.transcript?.language,
                hasWords: event.transcript?.hasWords ?? false,
                wordCount: event.transcript?.wordCount,
                features: event.transcript?.features,
              },
            };
          }
          if (!asset.transcript) return asset;
          return { ...asset, transcript: { ...asset.transcript, status: 'error' } };
        });
        return;
      }

      patchAsset(event.assetId, (asset) => {
        const entry = {
          path: event.relPath ?? asset[event.kind]?.path ?? '',
          status: event.status === 'ready' ? ('ready' as const) : event.status === 'error' ? ('error' as const) : ('generating' as const),
        };
        return event.kind === 'proxy' ? { ...asset, proxy: entry } : { ...asset, waveform: entry };
      });
    },
    [projectId, patchAsset, clearProgress],
  );

  // Request caches whenever the set of assets changes (already-generated files
  // come back as immediate 'ready' results, so this is cheap to re-run). The
  // key includes each asset's PATH so a relink re-runs detection and jobs.
  const assetKey = assets.map((a) => `${a.id}:${a.path}`).join(',');
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
        setMissingAssetIds(new Set(res.missing ?? []));
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

  /** Start (or restart) transcription for one asset. Explicit action only. */
  const transcribe = useCallback(
    async (asset: StudioMediaAsset, sttModelId: string): Promise<string | null> => {
      const res = await window.api.studioTranscribeStart({
        projectId,
        assetId: asset.id,
        sourcePath: asset.path,
        sttModelId,
      });
      if (!res.success) return res.error ?? 'Failed to start transcription';
      const entry = findSttEntry(sttModelId);
      const transcript: StudioAssetTranscript = {
        path: `transcripts/${asset.id}.json`,
        status: 'generating',
        engine: entry?.provider === 'assemblyai' ? 'assemblyai' : 'whisper',
        sttModelId,
        hasWords: false,
      };
      patchAsset(asset.id, (prev) => ({ ...prev, transcript }));
      setTranscribeProgress((prev) => new Map(prev).set(asset.id, { percent: 0 }));
      return null;
    },
    [projectId, patchAsset],
  );

  const cancelTranscribe = useCallback(
    async (assetId: string) => {
      const res = await window.api.studioTranscribeCancel({ projectId, assetId });
      if (!res.success) {
        // No live job (e.g. a stale 'generating' left by a closed session) —
        // clean the document up locally since no 'canceled' event will come.
        clearProgress(assetId);
        patchAsset(assetId, (asset) => {
          const { transcript: _removed, ...rest } = asset;
          return rest;
        });
      }
    },
    [projectId, patchAsset, clearProgress],
  );

  const getTranscribeProgress = useCallback(
    (assetId: string): TranscribeProgress | null => transcribeProgress.get(assetId) ?? null,
    [transcribeProgress],
  );

  /**
   * Locate… a missing source file. Without `filePath` main opens the native
   * dialog; the mismatch-confirm retry passes the picked path back with
   * `allowMismatch`. On success the new path/probe/hash merge into the asset —
   * the prepare effect re-runs off the path change, so derived caches (keyed
   * by asset id) come back 'ready' immediately and only regenerate if absent.
   */
  const relink = useCallback(
    async (
      asset: StudioMediaAsset,
      filePath?: string,
      allowMismatch = false,
    ): Promise<RelinkResult> => {
      const res = await window.api.studioMediaRelink({
        projectId,
        assetId: asset.id,
        expectedHash: asset.hash,
        ...(filePath ? { filePath } : {}),
        ...(allowMismatch ? { allowMismatch } : {}),
      });
      if (!res.success) {
        if (res.mismatch && res.pickedPath) {
          return { status: 'mismatch', pickedPath: res.pickedPath };
        }
        return { status: 'error', message: res.error ?? 'Failed to relink media' };
      }
      if (res.canceled) return { status: 'canceled' };
      const relinked = res.asset;
      if (!relinked) return { status: 'error', message: 'Relink returned no file' };
      patchAsset(asset.id, (prev) => {
        const next = { ...prev, path: relinked.path, probe: relinked.probe };
        // A stale hash would poison the NEXT relink check — replace or drop.
        if (relinked.hash) next.hash = relinked.hash;
        else delete next.hash;
        return next;
      });
      setMissingAssetIds((prev) => {
        if (!prev.has(asset.id)) return prev;
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
      return { status: 'ok' };
    },
    [projectId, patchAsset],
  );

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

  return {
    assetBaseUrl,
    resolvePreviewUrl,
    getWaveform,
    proxyProgress,
    transcribe,
    cancelTranscribe,
    getTranscribeProgress,
    missingAssetIds,
    relink,
  };
}
