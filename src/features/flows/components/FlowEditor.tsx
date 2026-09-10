import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useFlowGraph } from '../hooks/useFlowGraph';
import { RunStateProvider, useFlowRun } from '../hooks/useFlowRun';
import { useFlowRuns } from '../hooks/useFlowRuns';
import { NodeSpecsProvider, useNodeSpecs } from '../hooks/useNodeSpecs';
import { FlowCanvas } from './FlowCanvas';
import { NodePalette } from './NodePalette';
import { NodeInspector } from './NodeInspector';
import { RunControls } from './RunControls';
import { RunHistoryDropdown } from './RunHistoryDropdown';

interface Props {
  flowId: string;
  onBack: () => void;
}

function FlowEditorInner({ flowId, onBack }: Props) {
  const { byId: specs } = useNodeSpecs();
  const {
    status,
    project,
    error,
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onViewportChange,
    addNode,
    updateNodeConfig,
    renameFlow,
  } = useFlowGraph(flowId, specs);

  const [nameDraft, setNameDraft] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { runs, refresh: refreshRuns } = useFlowRuns(flowId);
  const handleRunSettled = useCallback(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const { runState, run, cancel, resume, hydrate } = useFlowRun({ flowId, onRunSettled: handleRunSettled });

  // Opening a flow shows its latest run — its statuses, and Resume when the
  // app closed mid-run (flows plan §1.3).
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

  // Clear selection if the selected node was deleted
  useEffect(() => {
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const commitRename = () => {
    if (!project) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === project.name) {
      setNameDraft(project.name);
      return;
    }
    void renameFlow(trimmed);
  };

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const isActive = runState.status === 'queued' || runState.status === 'running' || runState.status === 'paused';

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded text-text-muted hover:bg-app-hover hover:text-text-primary text-[12px]"
        >
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
        <div className="flex-1" />
        {error && <span className="text-[11px] text-accent-red mr-3">{error}</span>}
        {status === 'ready' && (
          <>
            <RunHistoryDropdown
              runs={runs}
              activeRunId={runState.runId}
              onSelect={(id) => void hydrate(id)}
              disabled={isActive}
            />
            <RunControls runState={runState} onRun={() => void run()} onCancel={cancel} onResume={() => void resume()} />
          </>
        )}
      </div>

      <RunStateProvider value={runState}>
        <div className="flex-1 flex min-h-0">
          {status === 'ready' && (
            <aside className="w-[200px] shrink-0 bg-app-surface" style={{ borderRight: '0.5px solid var(--color-border)' }}>
              <NodePalette />
            </aside>
          )}

          <div className="flex-1 min-w-0 bg-app-deep">
            {status === 'ready' ? (
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                viewport={viewport}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onViewportChange={onViewportChange}
                onSelectionChange={setSelectedNodeId}
                onDropNode={addNode}
              />
            ) : status === 'error' ? (
              <div className="flex items-center justify-center h-full text-accent-red text-sm">
                {error ?? 'Failed to load flow'}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">Loading…</div>
            )}
          </div>

          {status === 'ready' && selectedNode && (
            <aside className="w-[300px] shrink-0 bg-app-surface" style={{ borderLeft: '0.5px solid var(--color-border)' }}>
              <NodeInspector
                toolId={selectedNode.data.toolId}
                config={selectedNode.data.config}
                onPatchConfig={(patch) => updateNodeConfig(selectedNode.id, patch)}
              />
            </aside>
          )}
        </div>
      </RunStateProvider>
    </div>
  );
}

export function FlowEditor(props: Props) {
  return (
    <NodeSpecsProvider>
      <FlowEditorInner {...props} />
    </NodeSpecsProvider>
  );
}
