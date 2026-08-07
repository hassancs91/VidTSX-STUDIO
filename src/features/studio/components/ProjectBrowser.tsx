import { useState } from 'react';
import { Clapperboard, FolderCog, Plus, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import type { StudioProjectSummary } from '@shared/ipc/types';
import { useStudioProjects } from '../hooks/useStudioProjects';
import { NewProjectDialog } from './NewProjectDialog';
import { formatDate } from '../services/format-time';

interface Props {
  onOpen: (projectId: string) => void;
}

export function ProjectBrowser({ onOpen }: Props) {
  const { status, projects, root, error, create, remove, changeRoot } = useStudioProjects();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Studio</span>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => void changeRoot()}
            title={`Projects folder: ${root}\nClick to change`}
            className="flex items-center gap-1.5 px-2 h-[24px] rounded-[6px] text-[11px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors max-w-[320px]"
          >
            <FolderCog size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{root || 'Projects folder'}</span>
          </button>
          <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
            <span className="flex items-center gap-1">
              <Plus size={13} strokeWidth={2} />
              New Project
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <ErrorBanner message={error} />}
        {status === 'loading' && (
          <div className="text-[12px] text-text-dim pt-8 text-center">Loading projects…</div>
        )}
        {status === 'ready' && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center pt-24 px-8">
            <span className="text-text-dim">
              <Clapperboard size={40} strokeWidth={1.25} />
            </span>
            <div className="text-[15px] font-medium text-text-secondary">No projects yet</div>
            <div className="text-[12px] text-text-dim max-w-[360px]">
              Create a project to start editing — landscape for longs, portrait for
              shorts. Media stays where it is; the project references it in place.
            </div>
            <Button variant="primary" onClick={() => setShowNew(true)}>
              Create your first project
            </Button>
          </div>
        )}
        {projects.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpen(project.id)}
                onDelete={() => void remove(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onCreate={async (req) => {
          const id = await create(req);
          if (id) onOpen(id);
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: StudioProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isPortrait = project.height > project.width;

  return (
    <div
      className="group relative flex flex-col rounded-[8px] bg-app-deep hover:bg-app-hover transition-colors cursor-pointer overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
      onClick={onOpen}
    >
      <div className="h-[110px] flex items-center justify-center bg-app-surface">
        <div
          className="rounded-[3px] bg-app-base flex items-center justify-center"
          style={{
            border: '0.5px solid var(--color-border-hover)',
            width: isPortrait ? 50 : 130,
            height: isPortrait ? 90 : project.height === project.width ? 74 : 74,
            aspectRatio: `${project.width} / ${project.height}`,
          }}
        >
          <span className="text-[9px] text-text-ghost">
            {project.width}×{project.height}
          </span>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[12px] font-medium text-text-primary truncate">{project.name}</div>
        <div className="text-[10px] text-text-muted mt-0.5">
          {project.fps} fps · {project.assetCount} asset{project.assetCount === 1 ? '' : 's'} ·{' '}
          {formatDate(project.updatedAt)}
        </div>
      </div>

      <div
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <div className="flex items-center gap-1 bg-app-base rounded-[6px] px-1.5 py-1" style={{ border: '0.5px solid var(--color-border)' }}>
            <button
              onClick={onDelete}
              className="text-[10px] text-accent-red hover:underline"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[10px] text-text-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title="Delete project"
            className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-app-base text-text-muted hover:text-accent-red transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
