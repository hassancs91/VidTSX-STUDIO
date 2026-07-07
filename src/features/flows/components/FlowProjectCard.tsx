import { Trash2, Workflow } from 'lucide-react';
import type { FlowProjectSummary } from '@shared/ipc/types';

interface Props {
  project: FlowProjectSummary;
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

export function FlowProjectCard({ project, onOpen, onDelete }: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (ok) onDelete(project.id);
  };

  return (
    <div
      className="group relative bg-app-surface rounded-md overflow-hidden hover:bg-app-hover transition-colors cursor-pointer"
      style={{ border: '0.5px solid var(--color-border)' }}
      onClick={() => onOpen(project.id)}
    >
      <div className="aspect-[16/9] bg-app-deep flex items-center justify-center">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Workflow size={20} strokeWidth={1.2} className="text-text-dim" />
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[12px] text-text-primary font-medium line-clamp-1">{project.name}</p>
        <p className="text-[10px] text-text-dim mt-0.5">{formatDate(project.updatedAt)}</p>
      </div>
      <button
        onClick={handleDelete}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-app-deep/80 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete flow"
      >
        <Trash2 size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}
