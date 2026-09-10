import { useCallback, useEffect, useState } from 'react';
import { Workflow } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useToast } from '@renderer/contexts/ToastContext';
import { useFlowProjects } from '../hooks/useFlowProjects';
import { FREEZE_EVENT, pendingFreezeFromEvent, takePendingFreeze, type PendingFreeze } from '../services/pending-freeze';
import { FlowProjectList } from './FlowProjectList';
import { NewFlowDialog } from './NewFlowDialog';
import { FlowDetailsDialog } from './FlowDetailsDialog';
import { FlowWorkspace, type FlowView } from './FlowWorkspace';
import type { FlowCardAction } from './FlowCardMenu';

function FlowsComingSoon() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-[40px] px-3 bg-app-surface shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[13px] font-medium text-text-secondary">Flows</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <span className="text-text-dim">
          <Workflow size={40} strokeWidth={1.25} />
        </span>
        <div className="text-[15px] font-medium text-text-secondary">Flows — Coming soon</div>
        <div className="text-[12px] text-text-dim max-w-[380px]">
          Chain prompts, image generation, and video steps into automated node-based workflows. This feature is under active
          development and will arrive in an upcoming release.
        </div>
      </div>
    </div>
  );
}

export function FlowsScreen() {
  if (!isFeatureEnabled('flows-editor')) return <FlowsComingSoon />;
  return <FlowsScreenInner />;
}

interface OpenFlow {
  id: string;
  view: FlowView;
  /** W8 Stage 5: the agent session whose frozen proposal the canvas shows. */
  proposalSessionId?: string;
}

function FlowsScreenInner() {
  const { status, projects, error, refresh, create, remove } = useFlowProjects();
  const { showToast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [active, setActive] = useState<OpenFlow | null>(null);

  // W8 Stage 5: a session frozen from the agent stage. Main holds the
  // proposal; an EMPTY row is created for it (source `frozen`, the session
  // as origin) so the canvas can show the draft as "all added" over the
  // ordinary overlay — Accept saves through the same path every proposal
  // takes, Discard deletes the row again.
  const openFrozen = useCallback(
    async (pending: PendingFreeze) => {
      const res = await window.api.flowsProposalGet({ sessionId: pending.sessionId });
      if (!res.success || !res.proposal) {
        showToast(res.error ?? 'The frozen flow is no longer pending', 'error');
        return;
      }
      const { doc } = res.proposal;
      const row = await create({
        name: doc.name,
        ...(doc.description ? { description: doc.description } : {}),
        source: 'frozen',
        origin: doc.origin,
      });
      if (row) setActive({ id: row.id, view: 'edit', proposalSessionId: pending.sessionId });
    },
    [create, showToast],
  );
  useEffect(() => {
    const stashed = takePendingFreeze();
    if (stashed) void openFrozen(stashed);
    const handler = (event: Event) => {
      const pending = pendingFreezeFromEvent(event);
      takePendingFreeze();
      if (pending) void openFrozen(pending);
    };
    window.addEventListener(FREEZE_EVENT, handler);
    return () => window.removeEventListener(FREEZE_EVENT, handler);
  }, [openFrozen]);

  const discardFrozen = useCallback(async () => {
    if (!active?.proposalSessionId) return;
    await remove(active.id);
    setActive(null);
    void refresh();
  }, [active, remove, refresh]);

  const duplicate = useCallback(
    async (id: string) => {
      const loaded = await window.api.flowsProjectLoad({ id });
      if (!loaded.success || !loaded.project) {
        showToast(loaded.error ?? 'Could not load the flow to duplicate it', 'error');
        return;
      }
      const copy = await create({
        name: `${loaded.project.name} (copy)`,
        ...(loaded.project.description ? { description: loaded.project.description } : {}),
        graphJson: loaded.project.graphJson,
        source: 'user',
      });
      if (copy) showToast(`Duplicated as "${copy.name}"`, 'success');
    },
    [create, showToast],
  );

  const importFlow = useCallback(async () => {
    const res = await window.api.flowsImport({});
    if (res.success) {
      showToast(`Imported "${res.project?.name ?? 'flow'}"`, 'success');
      void refresh();
      return;
    }
    if (res.error !== 'Import cancelled.') showToast(res.error ?? 'Import failed', 'error');
  }, [refresh, showToast]);

  const onAction = useCallback(
    async (id: string, action: FlowCardAction) => {
      switch (action) {
        case 'run':
          setActive({ id, view: 'run' });
          return;
        case 'edit':
          setActive({ id, view: 'edit' });
          return;
        case 'details':
          setDetails(id);
          return;
        case 'duplicate':
          await duplicate(id);
          return;
        case 'export': {
          const res = await window.api.flowsExport({ flowId: id });
          showToast(res.success ? `Exported to ${res.path ?? 'file'}` : (res.error ?? 'Export failed'), res.success ? 'success' : 'error');
          return;
        }
        case 'remove': {
          const project = projects.find((p) => p.id === id);
          if (window.confirm(`Delete "${project?.name ?? 'this flow'}"? This cannot be undone.`)) await remove(id);
          return;
        }
      }
    },
    [duplicate, projects, remove, showToast],
  );

  if (active) {
    return (
      <FlowWorkspace
        key={active.id}
        flowId={active.id}
        initialView={active.view}
        {...(active.proposalSessionId
          ? { proposalSessionId: active.proposalSessionId, onProposalDiscarded: () => void discardFrozen() }
          : {})}
        onBack={() => {
          setActive(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[13px] font-medium text-text-secondary">Flows</span>
        {error && <span className="text-[11px] text-accent-red">{error}</span>}
      </div>
      <div className="flex-1 min-h-0">
        {status === 'loading' ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">Loading…</div>
        ) : (
          <FlowProjectList
            projects={projects}
            onCreate={() => setShowNew(true)}
            onImport={() => void importFlow()}
            onOpen={(id) => setActive({ id, view: 'run' })}
            onAction={(id, action) => void onAction(id, action)}
          />
        )}
      </div>

      <NewFlowDialog
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onCreate={async (req) => {
          const created = await create(req);
          if (created) setActive({ id: created.id, view: 'edit' });
        }}
      />
      <FlowDetailsDialog flowId={details} onClose={() => setDetails(null)} />
    </div>
  );
}
