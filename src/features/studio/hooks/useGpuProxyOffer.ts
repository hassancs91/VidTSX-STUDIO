import { useCallback, useEffect, useRef, useState } from 'react';
import type { DownloadProgressEvent, StudioProxyEncoderStatusResponse } from '@shared/ipc/types';
import type { StudioMediaAsset } from '../types';
import {
  gpuProxyOfferOutcome,
  gpuProxyRebuildTargets,
  isFourKVideo,
  readOfferDismissed,
  shouldOfferGpuProxyDownload,
  withRebuildNote,
  writeOfferDismissed,
} from '../services/gpu-proxy-offer';

/** DOWNLOAD_PROGRESS events for the full ffmpeg carry this metadata.type. */
const DOWNLOAD_TYPE = 'ffmpeg-full';

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * The clip that triggered the card queued its proxy on x264 before the
 * download ended: main rebuilds this session's x264 4K proxies on the GPU, so
 * that clip ends on NVENC without a re-import. Returns how many it re-queued.
 */
async function rebuildOnGpu(project: OfferProject | null): Promise<number> {
  const assets = project ? gpuProxyRebuildTargets(project.assets) : [];
  if (!project || assets.length === 0) return 0;
  try {
    const res = await window.api.studioProxyEncoderRebuild({ projectId: project.id, assets });
    return res.success ? res.restarted.length + res.rebuilt.length : 0;
  } catch {
    return 0; // The encoder is still ready; later imports use it.
  }
}

/** What the card needs of the open project. */
export interface OfferProject {
  id: string;
  assets: StudioMediaAsset[];
}

export type GpuProxyOfferPhase = 'offer' | 'downloading' | 'done';

export interface GpuProxyOffer {
  visible: boolean;
  phase: GpuProxyOfferPhase;
  status: StudioProxyEncoderStatusResponse | null;
  percent: number | null;
  error: string | null;
  outcome: { ok: boolean; text: string } | null;
  /** Call with the assets an import just added; shows the card when it applies. */
  considerImport: (imported: StudioMediaAsset[]) => Promise<void>;
  download: () => Promise<void>;
  /** "Not now": hidden until the app restarts. */
  dismiss: () => void;
  close: () => void;
}

/**
 * The first-4K-import download card (A4): asks main for the GPU encoder
 * status only when an import brought 4K video, downloads the full ffmpeg on
 * click (progress over the shared DOWNLOAD_PROGRESS broadcast, like the
 * Settings row) and reports what the refreshed status says.
 */
export function useGpuProxyOffer(project: OfferProject | null): GpuProxyOffer {
  // Read at download time: the project as it is when the install ends.
  const projectRef = useRef(project);
  projectRef.current = project;
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<GpuProxyOfferPhase>('offer');
  const [status, setStatus] = useState<StudioProxyEncoderStatusResponse | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const considerImport = useCallback(async (imported: StudioMediaAsset[]) => {
    // Cheap gates first: no IPC for HD imports or after "Not now".
    if (!imported.some(isFourKVideo) || readOfferDismissed(sessionStore())) return;
    try {
      const res = await window.api.studioProxyEncoderStatus();
      if (!shouldOfferGpuProxyDownload(imported, res, false)) return;
      setStatus(res);
      setPhase('offer');
      setError(null);
      setOutcome(null);
      setVisible(true);
    } catch {
      // No status, no card — the Settings row still offers the download.
    }
  }, []);

  useEffect(() => {
    if (phase !== 'downloading') return undefined;
    return window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== DOWNLOAD_TYPE) return;
      // The install promise reports the end; only the ticks matter here.
      if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') return;
      setPercent(event.percent >= 0 ? event.percent : 0);
    });
  }, [phase]);

  const download = useCallback(async () => {
    setError(null);
    setPercent(0);
    setPhase('downloading');
    try {
      const res = await window.api.studioProxyEncoderInstall();
      if (!res.success) throw new Error(res.error || 'ffmpeg download failed');
      const next = await window.api.studioProxyEncoderStatus();
      setStatus(next);
      const result = gpuProxyOfferOutcome(next);
      setOutcome(withRebuildNote(result, result.ok ? await rebuildOnGpu(projectRef.current) : 0));
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ffmpeg download failed');
      setPhase('offer');
    } finally {
      setPercent(null);
    }
  }, []);

  const dismiss = useCallback(() => {
    writeOfferDismissed(sessionStore());
    setVisible(false);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return { visible, phase, status, percent, error, outcome, considerImport, download, dismiss, close };
}
