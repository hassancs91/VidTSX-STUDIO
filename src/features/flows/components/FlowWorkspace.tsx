import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Play, PenSquare } from 'lucide-react';
import { useFlowGraph } from '../hooks/useFlowGraph';
import { RunStateProvider, useFlowRun } from '../hooks/useFlowRun';
import { useFlowRuns } from '../hooks/useFlowRuns';
import { NodeSpecsProvider, useNodeSpecs } from '../hooks/useNodeSpecs';
import { FlowEditor } from './FlowEditor';
import { RunControls } from './RunControls';
import { RunFormView } from './RunFormView';
import { RunHistoryDropdown } from './RunHistoryDropdown';

export type FlowView = 'run' | 'edit';

interface Props {
  flowId: string;
  onBack: () => void;
  /** Opening a flow lands on Run (flows plan §1.8); the card menu's Edit lands on the canvas. */
  initialView?: FlowView;
  /** Prefilled run params (§12 open question 1). */
  prefill?: Record<string, unknown>;
  /** W8 Stage 5: the agent session whose frozen proposal the canvas shows. */
  proposalSessionId?: string;
  /** W8 Stage 5: the frozen proposal was discarded. */
  onProposalDiscarded?: () => void;
}

function FlowWorkspaceInner({ flowId, onBack, initialView = 'run', prefill, proposalSessionId, onProposalDiscarded }: Props) {
  const { byId: specs } = useNodeSpecs();
  const graph = useFlowGraph(flowId, specs);
  const { status, project, error, doc, renameFlow, exposeNodeParam, unexposeNodeParam, setPause } = graph;
  const [view, setView] = useState<FlowView>(initialView);
  const [nameDraft, setNameDraft] = useState('');

  const { runs, refresh: refreshRuns } = useFlowRuns(flowId);
  const handleRunSettled = useCallback(() => {
    void refreshRuns();
  }, [refreshRuns]);
  const { runState, run, cancel, resume, reply, hydrate } = useFlowRun({ flowId, onRunSettled: handleRunSettled });

  // Opening a flow shows its latest run — its statuses, outputs, and Resume
  // when the app closed mid-run (flows plan §1.3).
  const [hydratedLatest, setHydratedLatest] = useState<string | null>(null);
  useEffect(() => {
    const latest = runs[0];
    if (!latest || hydratedLatest === flowId || runState.runId) return;
    setHydratedLatest(flowId);
    void hydrate(latest.id);
  }, [runs, flowId, hydratedLatest, runState.runId, hydrate]);

  useEffect(() => {
    if (project) setNameDraft(project.name);
  }, [project]);

  const commitRename = () => {
    if (!project) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === project.name) {
      setNameDraft(project.name);
      return;
    }
    void renameFlow(trimmed);
  };

  const isActive = runState.status === 'queued' || runState.status === 'running' || runState.status === 'paused';

  return (
    <div className="flex flex-col h-full" data-flow-workspace={view}>
      <div className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1 rounded text-text-muted hover:bg-app-hover hover:text-text-primary text-[12px]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          Flows
        </button>
        <span className="text-text-dim">/</span>
        {project ? (
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setNameDraft(project.name);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="bg-transparent text-[13px] font-medium text-text-secondary outline-none focus:bg-app-hover px-1.5 py-0.5 rounded"
          />
        ) : (
          <span className="text-[13px] text-text-muted">Loading…</span>
        )}

        <div className="inline-flex items-center rounded-[6px] bg-app-base p-[2px] ml-2" style={{ border: '0.5px solid var(--color-border-input)' }} role="tablist" data-flow-view-switch>
          {(
            [
              { id: 'run', label: 'Run', icon: Play },
              { id: 'edit', label: 'Edit', icon: PenSquare },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1 h-[20px] px-2.5 rounded-[4px] text-[11px] transition-colors ${
                view === id ? 'bg-app-active text-accent-light' : 'text-text-muted hover:text-text-secondary'
              }`}
              data-flow-view={id}
            >
              <Icon size={10} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        {error && <span className="text-[11px] text-accent-red mr-3">{error}</span>}
        {status === 'ready' && (
          <>
            <RunHistoryDropdown runs={runs} activeRunId={runState.runId} onSelect={(id) => void hydrate(id)} disabled={isActive} />
            {view === 'edit' && <RunControls runState={runState} onRun={() => void run()} onCancel={cancel} onResume={() => void resume()} />}
          </>
        )}
      </div>

      <RunStateProvider value={runState}>
        <div className="flex-1 min-h-0">
          {view === 'run' ? (
            status === 'ready' && doc ? (
              <RunFormView
                doc={doc}
                specs={specs}
                runState={runState}
                {...(prefill ? { prefill } : {})}
                onRun={(options) => void run(options)}
                onCancel={cancel}
                onResume={() => void resume()}
                onReply={reply}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">{status === 'error' ? (error ?? 'Failed to load flow') : 'Loading…'}</div>
            )
          ) : (
            <FlowEditor
              graph={graph}
              doc={doc}
              flowId={flowId}
              flowName={project?.name ?? ''}
              onExpose={exposeNodeParam}
              onUnexpose={unexposeNodeParam}
              onSetPause={setPause}
              {...(proposalSessionId ? { proposalSessionId } : {})}
              {...(onProposalDiscarded ? { onProposalDiscarded } : {})}
            />
          )}
        </div>
      </RunStateProvider>
    </div>
  );
}

export function FlowWorkspace(props: Props) {
  return (
    <NodeSpecsProvider>
      <FlowWorkspaceInner {...props} />
    </NodeSpecsProvider>
  );
}
