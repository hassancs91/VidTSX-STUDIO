import type { PythonModelStatusIpc } from '@shared/ipc/types';
import { usePythonModels } from '../hooks/usePythonModels';
import { PythonModelRow } from './PythonModelRow';
import { AiRuntimeChip } from './local/AiRuntimeChip';
import { LocalModelPage } from './local/LocalModelPage';
import { LocalModelStatusStrip } from './local/LocalModelStatusStrip';
import { LocalSectionPanel } from './local/LocalSectionPanel';

/**
 * The 3D section on the local-model template (docs/ai-models-redesign.md
 * §3.3): the AI runtime as the strip's chip (variants, Repair and Remove stay
 * on Overview), Installed, then every other catalogue model under
 * Recommended. The catalogue is a handful of entries, so there is no "All
 * models" disclosure to hide them behind.
 */
export function ThreeDModelsContent() {
  const lib = usePythonModels('3d');
  const installed = lib.models.filter((m) => m.installed);
  const catalog = lib.models.filter((m) => !m.installed);

  const row = (m: PythonModelStatusIpc) => (
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
  );

  return (
    <LocalModelPage
      strip={
        <LocalModelStatusStrip
          runtime={<AiRuntimeChip />}
          onOpenFolder={() => void lib.openFolder()}
          onRescan={() => void lib.refresh()}
        />
      }
      loading={lib.loading}
      loadingLabel="Checking…"
      error={lib.error ? { message: lib.error } : null}
      onClearError={lib.clearError}
      installed={
        <LocalSectionPanel
          id="installed"
          title="Installed"
          count={installed.length}
          isEmpty={installed.length === 0}
          empty={
            <>
              <div className="text-[12px] text-text-muted">No 3D model installed yet</div>
              <div className="mt-1 text-[11px] text-text-dim">Download one below — 3D Studio uses it for image → 3D.</div>
            </>
          }
        >
          {installed.map(row)}
        </LocalSectionPanel>
      }
      recommended={
        <LocalSectionPanel
          id="recommended"
          title="Recommended"
          count={catalog.length}
          caption="Used by 3D Studio · weights download from the original Hugging Face repos."
          isEmpty={catalog.length === 0}
          empty="Every 3D model in this build is installed."
        >
          {catalog.map(row)}
        </LocalSectionPanel>
      }
    />
  );
}
