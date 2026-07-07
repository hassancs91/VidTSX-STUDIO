import { PenTool, Plus } from 'lucide-react';
import type { WhiteboardProjectData } from '@shared/ipc/types';
import { WhiteboardProjectCard } from './WhiteboardProjectCard';

interface Props {
  projects: WhiteboardProjectData[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WhiteboardLibrary({ projects, onCreate, onOpen, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-text-muted">
        <PenTool size={56} strokeWidth={1.2} className="text-text-dim" />
        <p className="mt-4 text-base text-text-secondary">No whiteboard projects yet</p>
        <p className="mt-1 text-sm text-text-dim">Create your first one to start drawing.</p>
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          Create your first whiteboard project
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Whiteboard Projects</h1>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {projects.map((project) => (
          <WhiteboardProjectCard
            key={project.id}
            project={project}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
