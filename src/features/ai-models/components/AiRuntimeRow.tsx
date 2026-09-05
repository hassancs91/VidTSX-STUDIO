import { Button } from '@shared/components';
import type { AiRuntimeStatus, AiRuntimeVariant } from '../../../shared/ipc/types';
import { useAiRuntime } from '../hooks/useAiRuntime';
import { DownloadCell } from './DownloadCell';

const VARIANT_LABEL: Record<AiRuntimeVariant, string> = { cu126: 'GPU', cpu: 'CPU' };

const DOT: Record<AiRuntimeStatus['state'], string> = {
  installed: 'bg-accent-green',
  installing: 'bg-accent',
  'update-available': 'bg-accent-amber',
  missing: 'bg-accent-amber',
  broken: 'bg-accent-red',
};

const WHAT_IS_THIS =
  'A separate Python + PyTorch runtime that powers background removal and image → 3D on your computer. ' +
  'Downloaded once from cdn.vidtsx.com, kept in the app data folder, removable any time. ' +
  'Licences: PSF-2.0 (CPython), BSD-3-Clause (PyTorch), NVIDIA EULA (CUDA libraries, GPU variant); per-package notices ship inside the runtime.';

function headline(s: AiRuntimeStatus): string {
  switch (s.state) {
    case 'installed':
      return `Installed · ${VARIANT_LABEL[s.installed!.variant]} · ${s.installed!.version}`;
    case 'update-available':
      return `Update available · ${s.installed!.version} → ${s.targetVersion}`;
    case 'installing':
      return s.install ? phaseLabel(s) : 'Installing…';
    case 'broken':
      return 'Needs repair';
    default:
      return 'Not installed';
  }
}

function phaseLabel(s: AiRuntimeStatus): string {
  const variant = s.install ? VARIANT_LABEL[s.install.variant] : '';
  switch (s.install?.phase) {
    case 'preflight': return 'Checking this PC…';
    case 'downloading': return `Downloading ${variant} runtime…`;
    case 'verifying': return 'Verifying…';
    case 'warming-up': return 'Warming up (first launch)…';
    case 'finalizing': return 'Finishing…';
    default: return 'Installing…';
  }
}

/**
 * System tab row for the downloadable AI runtime (plan §3 step 8): variant, size,
 * state, Install / Update / Repair / Remove, download progress, and the phases after
 * the download (verify + warm-up) that the engine does not report.
 */
export function AiRuntimeRow() {
  const { status, download, error, loading, install, repair, remove, pause, resume, cancel } = useAiRuntime();

  if (loading || !status) {
    return (
      <div className="flex items-start gap-2.5 py-2">
        <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-border" />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-text-primary font-medium">AI Runtime</span>
          <div className="text-[11px] text-text-dim">{error ?? 'Checking…'}</div>
        </div>
      </div>
    );
  }

  const rec = status.variants[status.recommendedVariant];
  const other = status.variants[status.recommendedVariant === 'cu126' ? 'cpu' : 'cu126'];
  const busy = status.state === 'installing';
  const postDownload = busy && status.install && status.install.phase !== 'downloading' && status.install.phase !== 'preflight';
  const recIssue = rec.issue;
  const message = status.lastError ?? error;

  const onRemove = async () => {
    if (window.confirm('Remove the AI runtime? Background removal and 3D generation will need it downloaded again.')) {
      await remove();
    }
  };

  return (
    <div className="py-2">
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${DOT[status.state]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-text-primary font-medium">
              AI Runtime
              <span
                className="ml-1.5 text-[10px] text-text-dim border border-border rounded px-1 cursor-help"
                title={WHAT_IS_THIS}
              >
                ?
              </span>
            </span>
            <span className="text-[11px] text-text-dim truncate">{headline(status)}</span>
          </div>
          <span className="text-[11px] text-text-dim">Background removal &middot; Image → 3D</span>

          {/* Idle actions */}
          {!busy && (status.state === 'missing' || status.state === 'broken' || status.state === 'update-available') && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => (status.state === 'broken' ? repair() : install(status.recommendedVariant))}
                  disabled={recIssue !== null}
                  title={recIssue?.message ?? status.recommendationReason}
                >
                  {status.state === 'broken' ? 'Repair' : status.state === 'update-available' ? 'Update' : 'Install'}
                  {` ${VARIANT_LABEL[rec.variant]} runtime · ${rec.sizeLabel}`}
                </Button>
                {status.state !== 'broken' && (
                  <button
                    onClick={() => install(other.variant)}
                    disabled={other.issue !== null}
                    title={other.issue?.message ?? (other.variant === 'cpu' ? 'Smaller download, runs on any PC (about a minute per 3D model)' : 'Needs an NVIDIA GPU with 4 GB and a recent driver')}
                    className="text-[10px] text-text-muted hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                  >
                    {other.variant === 'cpu' ? `Use the smaller CPU-only runtime (${other.sizeLabel})` : `Use the GPU runtime instead (${other.sizeLabel})`}
                  </button>
                )}
                {status.installed && (
                  <Button variant="secondary" size="sm" onClick={onRemove}>Remove</Button>
                )}
              </div>
              {recIssue && <div className="text-[10px] text-accent-amber">{recIssue.message}</div>}
              {!recIssue && status.state === 'missing' && (
                <div className="text-[10px] text-text-dim">{status.recommendationReason}</div>
              )}
            </div>
          )}

          {!busy && status.state === 'installed' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-text-dim">
                torch {status.installed!.torch} &middot; {(status.installed!.bytesOnDisk / 1_000_000_000).toFixed(1)} GB on disk
              </span>
              <Button variant="secondary" size="sm" onClick={repair} title="Re-download and re-verify the runtime">Repair</Button>
              <Button variant="secondary" size="sm" onClick={onRemove}>Remove</Button>
            </div>
          )}

          {/* Busy: engine progress, then the verify / warm-up phases */}
          {busy && download && !postDownload && (
            <div className="mt-2 flex justify-end">
              <DownloadCell status={download} onPause={pause} onResume={resume} onCancel={cancel} />
            </div>
          )}
          {busy && (postDownload || !download) && (
            <div className="mt-2 text-[11px] text-text-secondary">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
              {phaseLabel(status)}
              {status.install?.message && <span className="text-text-dim"> — {status.install.message}</span>}
            </div>
          )}

          {message && !busy && (
            <div className="mt-2">
              <span className="text-[11px] text-accent-red break-words">{message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
