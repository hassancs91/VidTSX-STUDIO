import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useToast } from '@renderer/contexts/ToastContext';
import { useStudioProject } from '../hooks/useStudioProject';
import { MediaPool } from './MediaPool';
import { PreviewPanel } from './PreviewPanel';
import { TimelinePanel } from './TimelinePanel';
import { InspectorPanel } from './InspectorPanel';
import { AgentPanel } from './AgentPanel';

interface Props {
  projectId: string;
  onBack: () => void;
}

type RightTab = 'inspector' | 'assistant';

export function EditorShell({ projectId, onBack }: Props) {
  const { project, status, error, saveState, updateProject, importMedia, removeAsset } =
    useStudioProject(projectId);
  const { showToast } = useToast();
  const [rightTab, setRightTab] = useState<RightTab>('inspector');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importMedia();
      if (result.added > 0) {
        showToast(`Imported ${result.added} file${result.added === 1 ? '' : 's'}`, 'success');
      }
      for (const err of result.errors) {
        showToast(err, 'error');
      }
    } finally {
      setImporting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-text-dim">
        Loading project…
      </div>
    );
  }

  if (status === 'error' || !project) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <ErrorBanner message={error ?? 'Failed to load project'} />
        <div>
          <Button variant="secondary" onClick={onBack}>
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-2 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          title="Back to projects"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-[13px] font-medium text-text-secondary truncate max-w-[280px]">
          {project.name}
        </span>
        <span
          className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-app-active text-text-muted"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {project.settings.width}×{project.settings.height} · {project.settings.fps} fps
        </span>
        <span className="text-[10px] text-text-ghost">
          {saveState === 'pending' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <div className="flex-1" />
        <Button variant="primary" size="sm" disabled title="Export arrives in Phase S2">
          Export
        </Button>
      </div>

      {/* Main row: media pool | preview | right panel */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[230px] shrink-0" style={{ borderRight: '0.5px solid var(--color-border)' }}>
          <MediaPool
            projectId={projectId}
            assets={project.assets}
            onImport={() => void handleImport()}
            onRemove={removeAsset}
            importing={importing}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <PreviewPanel width={project.settings.width} height={project.settings.height} />
        </div>

        <div
          className="w-[270px] shrink-0 flex flex-col bg-app-deep"
          style={{ borderLeft: '0.5px solid var(--color-border)' }}
        >
          <div className="flex h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
            <RightTabButton
              label="Inspector"
              isActive={rightTab === 'inspector'}
              onClick={() => setRightTab('inspector')}
            />
            <RightTabButton
              label="Assistant"
              isActive={rightTab === 'assistant'}
              onClick={() => setRightTab('assistant')}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === 'inspector' ? (
              <InspectorPanel project={project} onUpdate={updateProject} />
            ) : (
              <AgentPanel />
            )}
          </div>
        </div>
      </div>

      {/* Timeline spans the full width, CapCut-style */}
      <TimelinePanel project={project} />
    </div>
  );
}

function RightTabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[11px] transition-colors ${
        isActive
          ? 'text-text-primary bg-app-surface'
          : 'text-text-muted hover:text-text-secondary hover:bg-app-hover'
      }`}
    >
      {label}
    </button>
  );
}
