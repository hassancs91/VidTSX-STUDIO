import { useState } from 'react';
import { Workflow } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useFlowProjects } from '../hooks/useFlowProjects';
import { FlowProjectList } from './FlowProjectList';
import { NewFlowDialog } from './NewFlowDialog';
import { FlowEditor } from './FlowEditor';

function FlowsComingSoon() {
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">Flows</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <span className="text-text-dim">
          <Workflow size={40} strokeWidth={1.25} />
        </span>
        <div className="text-[15px] font-medium text-text-secondary">Flows — Coming soon</div>
        <div className="text-[12px] text-text-dim max-w-[380px]">
          Chain prompts, image generation, and video steps into automated
          node-based workflows. This feature is under active development and
          will arrive in an upcoming release.
        </div>
      </div>
    </div>
  );
}

export function FlowsScreen() {
  if (!isFeatureEnabled('flows-editor')) {
    return <FlowsComingSoon />;
  }
  return <FlowsScreenInner />;
}

function FlowsScreenInner() {
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
