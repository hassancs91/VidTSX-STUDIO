import type { WhiteboardProjectData } from '@shared/ipc/types';

interface Props {
  project: WhiteboardProjectData;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WhiteboardProjectCard({ project, onOpen, onDelete }: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (ok) onDelete(project.id);
  };

  return (
    <div
      className="group relative bg-app-surface rounded-xl overflow-hidden hover:bg-app-hover transition-colors cursor-pointer"
      style={{ border: '0.5px solid var(--color-border)' }}
      onClick={() => onOpen(project.id)}
    >
      <div className="aspect-video bg-app-deep flex items-center justify-center">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-text-dim text-xs">No preview</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm text-text-primary font-medium truncate">{project.name}</p>
        <p className="text-xs text-text-muted mt-0.5">
          Updated {formatDate(project.updatedAt)}
        </p>
      </div>
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-app-deep/80 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete project"
      >
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5h12M7 5V3.5a1 1 0 011-1h2a1 1 0 011 1V5M8 8v5M10 8v5M5 5l.5 9.5a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5L13 5" />
        </svg>
      </button>
    </div>
  );
}
