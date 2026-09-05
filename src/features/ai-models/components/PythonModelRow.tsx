import { useState } from 'react';
import { StatusBadge } from '@shared/components';
import type { PythonModelStatusIpc } from '@shared/ipc/types';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';
import { DownloadCell } from './DownloadCell';
import { FitBadge } from './FitBadge';

interface PythonModelRowProps {
  model: PythonModelStatusIpc;
  download?: ModelDownloadStatus;
  onDownload: (id: string) => void;
  /** Runtime install + model download in one click (shown when the runtime is missing). */
  onInstallAll: (id: string) => void;
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenExternal: (url: string) => void;
}

function runtimeIssue(model: PythonModelStatusIpc): string | null {
  switch (model.runtime.state) {
    case 'installed': return null;
    case 'installing': return 'AI runtime installing…';
    case 'update-available': return `Needs AI runtime update (${model.runtime.version} installed)`;
    case 'broken': return 'AI runtime needs repair';
    default: return 'Needs the AI runtime';
  }
}

/**
 * One catalogue row for a runtime-backed model: name, licence, size, the "needs AI
 * runtime" badge (the `missing-runtime` issue rendered for the first time), fit badge
 * for GPU models, download progress, Download / Remove.
 */
export function PythonModelRow({ model, download, onDownload, onInstallAll, onRemove, onPause, onResume, onCancel, onOpenExternal }: PythonModelRowProps) {
  const [confirming, setConfirming] = useState(false);
  const issue = runtimeIssue(model);
  const busy = download !== undefined || model.downloading;
  const missingFiles = model.files.filter((f) => !f.present);
  const seconds = model.estimatedSeconds;

  return (
    <div className="px-3 py-2 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] text-text-secondary truncate">{model.name}</span>
            <StatusBadge tone="neutral" title={model.licence.name}>{model.licence.name.split(' ')[0]}</StatusBadge>
            <FitBadge fit={model.fit} />
            {issue && (
              <StatusBadge tone="warn" title="Runs on the downloadable AI runtime — install it from the System tab or with the button here">
                {model.runtime.state === 'installed' ? '' : 'needs AI runtime'}
              </StatusBadge>
            )}
            {model.ready && <StatusBadge tone="success">Ready</StatusBadge>}
          </div>
          <div className="text-[10px] text-text-dim truncate">{model.summary}</div>
          <div className="text-[9px] text-text-dim font-mono truncate">
            {model.sizeLabel}
            {model.bytesMissing > 0 && model.bytesMissing !== model.sizeBytes ? ` · ${Math.round(model.bytesMissing / 1_000_000)} MB to download` : ''}
            {' · '}
            {model.cpuOk ? `~${seconds.cpu}s CPU` : ''}{model.vramMb ? ` · ~${seconds.gpu}s GPU (${Math.round(model.vramMb / 1024)} GB+)` : ''}
            {' · '}
            <button onClick={() => onOpenExternal(model.licence.url)} className="hover:text-accent-light hover:underline" title={model.licence.url}>licence</button>
            {' · '}
            <button onClick={() => onOpenExternal(model.sourceUrl)} className="hover:text-accent-light hover:underline" title={model.sourceUrl}>source ↗</button>
          </div>
        </div>

        {busy && download ? (
          <DownloadCell status={download} onPause={() => onPause(model.id)} onResume={() => onResume(model.id)} onCancel={() => onCancel(model.id)} />
        ) : (
          <div className="flex items-center gap-1.5">
            {!model.installed && (
              <button onClick={() => onDownload(model.id)} disabled={busy} className="px-2 h-[24px] rounded text-[10px] font-medium text-accent-light hover:bg-app-hover disabled:opacity-50" title="Download the model files">
                Download
              </button>
            )}
            {issue && model.runtime.state !== 'installing' && (
              <button onClick={() => onInstallAll(model.id)} disabled={busy} className="px-2 h-[24px] rounded text-[10px] font-medium text-accent-light hover:bg-app-hover disabled:opacity-50" title="Install the AI runtime (recommended variant) and download the model">
                {model.installed ? 'Install runtime' : 'Install runtime + model'}
              </button>
            )}
            {model.installed && (
              confirming ? (
                <button onClick={() => { setConfirming(false); onRemove(model.id); }} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-red hover:bg-accent-red/10" title="Deletes the model files from disk">Confirm remove</button>
              ) : (
                <button onClick={() => setConfirming(true)} onBlur={() => setConfirming(false)} className="px-1.5 h-[22px] rounded text-[9px] text-text-dim hover:text-accent-red hover:bg-app-hover" title="Delete the model files from disk">Remove</button>
              )
            )}
          </div>
        )}
      </div>

      {!busy && missingFiles.length > 0 && model.installed === false && missingFiles.length !== model.files.length && (
        <div className="mt-1 pl-1 text-[10px] text-text-dim">
          <span className="text-accent-amber">Missing:</span> {missingFiles.map((f) => f.label).join(', ')}
        </div>
      )}
    </div>
  );
}
