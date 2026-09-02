import { useCallback, useEffect, useState } from 'react';
import { Button } from '@shared/components';
import type { DownloadProgressEvent, StudioProxyEncoderStatusResponse } from '@shared/ipc/types';

const DOWNLOAD_TYPE = 'ffmpeg-full';

function mb(bytes: number): string {
  return `${Math.round(bytes / 1048576)} MB`;
}

/**
 * "Faster proxy generation (GPU encoder)" — Settings › Rendering. Self-contained
 * like NewsRow: reads and writes over its own IPC, nothing threaded through
 * the modal. Three states: not downloaded (Download button), downloaded with
 * a working encoder (name + checkbox), downloaded with none (checkbox off and
 * disabled). Off by default; the full ffmpeg is fetched only on click.
 * Measured in T4b (docs/PREVIEW_TESTS_PLAN.md): NVENC made the same proxies
 * in half the wall time at 3% of the CPU.
 */
export function ProxyGpuEncoderRow() {
  const [status, setStatus] = useState<StudioProxyEncoderStatusResponse | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.studioProxyEncoderStatus();
      setStatus(res);
      if (!res.success && res.error) setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read GPU encoder status');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Download progress arrives on the global broadcast; a 'completed' event
  // means the binary is on disk and the probe can run.
  useEffect(() => {
    const unsub = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== DOWNLOAD_TYPE) return;
      if (event.status === 'completed') {
        setPercent(null);
        void refresh();
        return;
      }
      if (event.status === 'failed' || event.status === 'cancelled') {
        setPercent(null);
        if (event.status === 'failed') setError(event.error || 'ffmpeg download failed');
        void refresh();
        return;
      }
      setPercent(event.percent >= 0 ? event.percent : 0);
    });
    return unsub;
  }, [refresh]);

  const download = async () => {
    setError(null);
    setPercent(0);
    try {
      const res = await window.api.studioProxyEncoderInstall();
      if (!res.success) setError(res.error || 'ffmpeg download failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ffmpeg download failed');
    } finally {
      setPercent(null);
      void refresh();
    }
  };

  const toggle = async (enabled: boolean) => {
    setStatus((prev) => (prev ? { ...prev, enabled, fallback: null } : prev));
    try {
      const res = await window.api.studioProxyEncoderSetEnabled({ enabled });
      if (!res.success) setError(res.error || 'Failed to save setting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    }
    void refresh();
  };

  const downloading = percent !== null || status?.downloading === true;
  const installed = status?.installed === true;
  const detected = status?.detected ?? null;

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border" data-proxy-gpu-row>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">Faster proxy generation (GPU encoder)</div>
          <div className="text-[10px] text-text-dim">
            Off by default. Downloads a full ffmpeg build ({status ? mb(status.downloadBytes) : '…'},{' '}
            {status?.licence ?? 'GPL'}, from BtbN) so Studio can encode preview proxies on your
            graphics card instead of the CPU. Proxies only — exports are unchanged.
          </div>
          {installed && (
            <div className="text-[10px] text-text-dim mt-1" data-proxy-gpu-detected>
              {detected
                ? `Detected: ${status?.detectedLabel ?? detected}`
                : 'Downloaded, but no supported GPU encoder works on this machine (NVIDIA, Intel Quick Sync or AMD needed).'}
            </div>
          )}
          {status?.fallback && (
            <div className="text-[10px] text-amber-400 mt-1 italic" data-proxy-gpu-fallback>
              {status.fallback.encoder.toUpperCase()} failed this session — proxies are using the CPU encoder
              until the app restarts or the setting is toggled. ({status.fallback.reason.slice(0, 120)})
            </div>
          )}
          {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
        </div>
        {!installed ? (
          <Button variant="secondary" onClick={() => void download()} disabled={downloading || !status} data-proxy-gpu-download>
            {downloading ? `Downloading… ${percent !== null ? `${Math.round(percent)}%` : ''}` : `Download (~${status ? mb(status.downloadBytes) : '80 MB'})`}
          </Button>
        ) : (
          <input
            type="checkbox"
            className="w-4 h-4 accent-accent cursor-pointer shrink-0 disabled:cursor-not-allowed"
            checked={status?.enabled === true}
            onChange={(e) => void toggle(e.target.checked)}
            disabled={!detected}
            data-proxy-gpu-toggle
          />
        )}
      </div>
    </div>
  );
}
