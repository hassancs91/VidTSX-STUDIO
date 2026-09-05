import { ErrorBanner, Panel } from '@shared/components';
import { usePythonModels } from '../hooks/usePythonModels';
import { PythonModelRow } from './PythonModelRow';

/**
 * "Image tools" on the Image tab (plan §4 step 6): the runtime-backed image models
 * (background removal today) with size, licence, the "needs AI runtime" badge and
 * Download / Remove. Behind `ai-system-runtimes` until Stage 5.
 */
export function ImageToolsSection() {
  const lib = usePythonModels('image');
  const rows = lib.models.filter((m) => m.section === 'image-tools');

  return (
    <Panel>
      <div className="px-3 h-[32px] flex items-center justify-between text-[11px] font-medium text-text-muted" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span>Image tools</span>
        <span className="text-[10px] font-normal text-text-dim">Used by "Remove background" in Image Studio</span>
      </div>
      {lib.loading ? (
        <div className="p-4 text-[12px] text-text-muted text-center">Checking…</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-[12px] text-text-muted text-center">No image tools in this build</div>
      ) : (
        rows.map((m) => (
          <PythonModelRow
            key={m.id}
            model={m}
            download={lib.downloads[m.id]}
            onDownload={(id) => void lib.download(id)}
            onInstallAll={(id) => void lib.installAll(id)}
            onRemove={(id) => void lib.remove(id)}
            onPause={(id) => void lib.pauseDownload(id)}
            onResume={(id) => void lib.resumeDownload(id)}
            onCancel={(id) => void lib.cancelDownload(id)}
            onOpenExternal={(url) => void lib.openExternal(url)}
          />
        ))
      )}
      {lib.error && (
        <div className="p-2">
          <ErrorBanner message={lib.error} onDismiss={lib.clearError} />
        </div>
      )}
    </Panel>
  );
}
