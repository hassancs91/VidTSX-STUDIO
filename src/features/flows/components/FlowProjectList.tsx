import { Workflow, Plus } from 'lucide-react';
import type { FlowProjectSummary } from '@shared/ipc/types';
import { FlowProjectCard } from './FlowProjectCard';

interface Props {
  projects: FlowProjectSummary[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FlowProjectList({ projects, onCreate, onOpen, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-text-muted">
        <Workflow size={56} strokeWidth={1.2} className="text-text-dim" />
        <p className="mt-4 text-base text-text-secondary">No flows yet</p>
        <p className="mt-1 text-sm text-text-dim">
          Create a flow to chain prompts, images and generators visually.
        </p>
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Flow
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Your Flows</h1>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Flow
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {projects.map((project) => (
          <FlowProjectCard
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
