import { useState } from 'react';
import { useFlowProjects } from '../hooks/useFlowProjects';
import { FlowProjectList } from './FlowProjectList';
import { NewFlowDialog } from './NewFlowDialog';
import { FlowEditor } from './FlowEditor';

export function FlowsScreen() {
  const { status, projects, error, refresh, create, remove } = useFlowProjects();
  const [showNew, setShowNew] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

  if (activeFlowId) {
    return (
      <FlowEditor
        flowId={activeFlowId}
        onBack={() => {
          setActiveFlowId(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Flows</span>
        {error && <span className="text-[11px] text-accent-red">{error}</span>}
      </div>
      <div className="flex-1 min-h-0">
        {status === 'loading' ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading…
          </div>
        ) : (
          <FlowProjectList
            projects={projects}
            onCreate={() => setShowNew(true)}
            onOpen={setActiveFlowId}
            onDelete={remove}
          />
        )}
      </div>

      <NewFlowDialog
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onCreate={async (req) => {
          const created = await create(req);
          if (created) setActiveFlowId(created.id);
        }}
      />
    </div>
  );
}
