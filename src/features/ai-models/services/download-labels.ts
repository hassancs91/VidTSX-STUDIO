import type { ModelDownloadStatus } from '../hooks/useImageLibrary';

/** "1.2 MB/s" / "512 KB/s"; empty when the rate is unknown. */
export function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

/** The one-line phase copy next to a runtime's install bar in the status strip. */
export function describeRuntimeInstall(install: ModelDownloadStatus): string {
  switch (install.status) {
    case 'extracting':
      return 'Extracting…';
    case 'queued':
      return 'Starting…';
    case 'paused':
      return 'Paused';
    default: {
      const speed = formatSpeed(install.speedBps);
      return `Downloading… ${Math.round(install.progress)}%${speed ? ` · ${speed}` : ''}`;
    }
  }
}
