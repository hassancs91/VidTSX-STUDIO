import { Workflow } from 'lucide-react';
import type { FlowProjectSummary } from '@shared/ipc/types';
import { FlowCardMenu, type FlowCardAction } from './FlowCardMenu';

interface Props {
  project: FlowProjectSummary;
  /** Built-ins (Stage 6) are read-only. */
  readOnly: boolean;
  onOpen: (id: string) => void;
  onAction: (id: string, action: FlowCardAction) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FlowProjectCard({ project, readOnly, onOpen, onAction }: Props) {
  return (
    <div
      className="group relative bg-app-surface rounded-md overflow-visible hover:bg-app-hover transition-colors cursor-pointer"
      style={{ border: '0.5px solid var(--color-border)' }}
      onClick={() => onOpen(project.id)}
      data-flow-card={project.id}
    >
      <div className="aspect-[16/9] bg-app-deep flex items-center justify-center rounded-t-md overflow-hidden">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <Workflow size={20} strokeWidth={1.2} className="text-text-dim" />
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[12px] text-text-primary font-medium line-clamp-1">{project.name}</p>
        <p className="text-[10px] text-text-dim mt-0.5">
          {formatDate(project.updatedAt)}
          {project.source !== 'user' ? ` · ${project.source}` : ''}
        </p>
      </div>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <FlowCardMenu readOnly={readOnly} onAction={(action) => onAction(project.id, action)} />
      </div>
    </div>
  );
}
