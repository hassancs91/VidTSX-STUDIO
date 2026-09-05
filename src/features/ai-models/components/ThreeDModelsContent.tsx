import { ErrorBanner, Panel } from '@shared/components';
import { usePythonModels } from '../hooks/usePythonModels';
import { AiRuntimeRow } from './AiRuntimeRow';
import { PythonModelRow } from './PythonModelRow';

/**
 * 3D tab (plan §5 step 2): the runtime status card at the top (the same row as the
 * System tab — install / update / repair / remove), then the catalogue of runtime-backed
 * 3D models with licence + VRAM-fit badges, Download / Remove, and the combined
 * "install runtime + model" action when the runtime is missing.
 */
export function ThreeDModelsContent() {
  const lib = usePythonModels('3d');

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="px-3 h-[32px] flex items-center text-[11px] font-medium text-text-muted" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          Runtime
        </div>
        <div className="px-3">
          <AiRuntimeRow />
        </div>
      </Panel>

      <Panel>
        <div className="px-3 h-[32px] flex items-center justify-between text-[11px] font-medium text-text-muted" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span>Image → 3D models</span>
          <span className="text-[10px] font-normal text-text-dim">Used by 3D Studio · weights download from the original Hugging Face repos</span>
        </div>
        {lib.loading ? (
          <div className="p-4 text-[12px] text-text-muted text-center">Checking…</div>
        ) : lib.models.length === 0 ? (
          <div className="p-4 text-[12px] text-text-muted text-center">No 3D models in this build</div>
        ) : (
          lib.models.map((m) => (
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
    </div>
  );
}
