import { useState, useEffect, useCallback, useRef } from 'react';
import type { SystemInfoGetResponse, DownloadProgressEvent } from '../../../shared/ipc/types';

export type PyTorchDownloadStatus = 'idle' | 'downloading' | 'paused' | 'installing' | 'completed' | 'failed';

export interface PyTorchDownloadState {
  status: PyTorchDownloadStatus;
  percent: number;
  speedBps: number;
  etaSeconds: number;
  error?: string;
}

const PYTORCH_DOWNLOAD_ID_CPU = 'pytorch-cpu';
const PYTORCH_DOWNLOAD_ID_GPU = 'pytorch-gpu';

function isPyTorchDownload(id: string): boolean {
  return id === PYTORCH_DOWNLOAD_ID_CPU || id === PYTORCH_DOWNLOAD_ID_GPU;
}

export function useSystemInfo() {
  const [data, setData] = useState<SystemInfoGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pytorchDownload, setPytorchDownload] = useState<PyTorchDownloadState>({ status: 'idle', percent: 0, speedBps: 0, etaSeconds: 0 });

  const unsubRef = useRef<(() => void) | null>(null);
  // Track the wheel path so we can pip install after download completes
  const wheelPathRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [result, downloads] = await Promise.all([
        window.api.systemInfoGet(),
        window.api.downloadGetAll(),
      ]);
      setData(result);

      // Check if there's an active pytorch download
      const active = downloads.downloads.find(
        (d) => isPyTorchDownload(d.id) && d.status !== 'completed' && d.status !== 'failed' && d.status !== 'cancelled',
      );
      if (active) {
        const mappedStatus: PyTorchDownloadStatus =
          active.status === 'paused' ? 'paused' : 'downloading';
        setPytorchDownload({
          status: mappedStatus,
          percent: active.percent,
          speedBps: active.speedBps,
          etaSeconds: active.etaSeconds,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to download progress for pytorch
    const unsub = window.api.onDownloadProgress((progress: DownloadProgressEvent) => {
      if (!isPyTorchDownload(progress.id)) return;

      if (progress.status === 'completed') {
        // Download finished — now run pip install
        const wheelPath = wheelPathRef.current;
        if (wheelPath) {
          setPytorchDownload({ status: 'installing', percent: 100, speedBps: 0, etaSeconds: 0 });
          window.api.pytorchPipInstall({ wheelPath }).then((result) => {
            if (result.success) {
              setPytorchDownload({ status: 'completed', percent: 100, speedBps: 0, etaSeconds: 0 });
              refresh();
            } else {
              setPytorchDownload({
                status: 'failed',
                percent: 100,
                speedBps: 0,
                etaSeconds: 0,
                error: result.error ?? 'pip install failed',
              });
            }
            wheelPathRef.current = null;
          });
        }
      } else if (progress.status === 'failed' || progress.status === 'cancelled') {
        setPytorchDownload({
          status: 'failed',
          percent: progress.percent,
          speedBps: 0,
          etaSeconds: 0,
          error: progress.error ?? (progress.status === 'cancelled' ? 'Cancelled' : 'Download failed'),
        });
        wheelPathRef.current = null;
      } else {
        const mappedStatus: PyTorchDownloadStatus =
          progress.status === 'paused' ? 'paused' : 'downloading';
        setPytorchDownload({
          status: mappedStatus,
          percent: progress.percent,
          speedBps: progress.speedBps,
          etaSeconds: progress.etaSeconds,
        });
      }
    });
    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [refresh]);

  const pytorchInstall = useCallback(async (variant: 'cpu' | 'gpu') => {
    const id = variant === 'cpu' ? PYTORCH_DOWNLOAD_ID_CPU : PYTORCH_DOWNLOAD_ID_GPU;

    const url = variant === 'cpu'
      ? 'https://download.pytorch.org/whl/cpu/torch-2.11.0%2Bcpu-cp313-cp313-win_amd64.whl'
      : 'https://download.pytorch.org/whl/cu126/torch-2.11.0%2Bcu126-cp313-cp313-win_amd64.whl';

    const fileName = variant === 'cpu'
      ? 'torch-2.11.0+cpu-cp313-cp313-win_amd64.whl'
      : 'torch-2.11.0+cu126-cp313-cp313-win_amd64.whl';

    const userDataDir = await window.api.settingsGet().then((s) => s.aiModelsFolder);
    const destPath = `${userDataDir}/${fileName}`;

    // If the wheel is already cached locally, skip download and pip install directly
    const cachedWheels = data?.engines.pytorch.cachedWheels ?? [];
    if (cachedWheels.includes(variant)) {
      setPytorchDownload({ status: 'installing', percent: 100, speedBps: 0, etaSeconds: 0 });
      const result = await window.api.pytorchPipInstall({ wheelPath: destPath });
      if (result.success) {
        setPytorchDownload({ status: 'completed', percent: 100, speedBps: 0, etaSeconds: 0 });
        refresh();
      } else {
        setPytorchDownload({ status: 'failed', percent: 100, speedBps: 0, etaSeconds: 0, error: result.error ?? 'pip install failed' });
      }
      return;
    }

    // Store the wheel path so the progress handler can trigger pip install
    wheelPathRef.current = destPath;

    setPytorchDownload({ status: 'downloading', percent: 0, speedBps: 0, etaSeconds: 0 });

    await window.api.downloadEnqueue({
      id,
      url,
      destPath,
      metadata: { type: 'pytorch', variant },
      priority: 0,
    });
  }, [data, refresh]);

  const pytorchPause = useCallback(async () => {
    await window.api.downloadPause({ id: PYTORCH_DOWNLOAD_ID_CPU }).catch(() => {});
    await window.api.downloadPause({ id: PYTORCH_DOWNLOAD_ID_GPU }).catch(() => {});
  }, []);

  const pytorchResume = useCallback(async () => {
    await window.api.downloadResume({ id: PYTORCH_DOWNLOAD_ID_CPU }).catch(() => {});
    await window.api.downloadResume({ id: PYTORCH_DOWNLOAD_ID_GPU }).catch(() => {});
  }, []);

  const pytorchCancel = useCallback(async () => {
    await window.api.downloadCancel({ id: PYTORCH_DOWNLOAD_ID_CPU }).catch(() => {});
    await window.api.downloadCancel({ id: PYTORCH_DOWNLOAD_ID_GPU }).catch(() => {});
    setPytorchDownload({ status: 'idle', percent: 0, speedBps: 0, etaSeconds: 0 });
    wheelPathRef.current = null;
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    pytorchDownload,
    pytorchInstall,
    pytorchPause,
    pytorchResume,
    pytorchCancel,
  };
}
