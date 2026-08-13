import { Button, Panel, ProgressBar } from '@shared/components';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';

function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

interface SdCliSetupCardProps {
  /** In-flight engine download, or null when idle. */
  install: ModelDownloadStatus | null;
  onInstall: () => void;
}

/**
 * Shown on the Image tab while sd-cli isn't installed: one-click setup that
 * downloads the pinned stable-diffusion.cpp release (whisper-style, official
 * upstream, fetched on first use) instead of a dead-end "not installed" badge.
 */
export function SdCliSetupCard({ install, onInstall }: SdCliSetupCardProps) {
  return (
    <Panel className="p-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-text-primary font-medium">Set up local image generation</div>
          <div className="text-[11px] text-text-dim mt-0.5">
            Local generation runs on your GPU (~36 MB one-time engine download).
            Models you install below need the engine to generate.
          </div>
        </div>
        {!install && (
          <Button variant="primary" onClick={onInstall} className="shrink-0">
            Set up
          </Button>
        )}
      </div>

      {install && (
        <div className="mt-2">
          <ProgressBar value={Math.max(install.progress, 0)} color={install.status === 'paused' ? 'amber' : 'purple'} />
          <div className="flex items-center gap-3 mt-1 text-[10px] text-text-dim">
            {install.status === 'extracting' ? (
              <span>Extracting…</span>
            ) : install.status === 'queued' ? (
              <span>Starting…</span>
            ) : install.status === 'paused' ? (
              <span>Paused</span>
            ) : (
              <>
                <span>Downloading engine… {Math.round(install.progress)}%</span>
                {install.speedBps > 0 && <span>{formatSpeed(install.speedBps)}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
