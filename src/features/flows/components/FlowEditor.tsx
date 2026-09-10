import { useEffect, useState } from 'react';
import type { ConfigField, FlowDoc } from '@shared/types/flows';
import type { useFlowGraph } from '../hooks/useFlowGraph';
import { FlowCanvas } from './FlowCanvas';
import { NodePalette } from './NodePalette';
import { NodeInspector } from './NodeInspector';

type Graph = ReturnType<typeof useFlowGraph>;

interface Props {
  graph: Graph;
  doc: FlowDoc | null;
  onExpose: (nodeId: string, field: ConfigField) => void;
  onUnexpose: (nodeId: string, key: string) => void;
  onSetPause: (nodeId: string, pause: boolean) => void;
}

/**
 * The Edit view (flows plan §1.8): palette, canvas, inspector. The workspace
 * host owns the graph hook and the header; this is the body only, so Run
 * and Edit share one loaded flow and one run state.
 */
export function FlowEditor({ graph, doc, onExpose, onUnexpose, onSetPause }: Props) {
  const { status, error, nodes, edges, viewport, onNodesChange, onEdgesChange, onConnect, onViewportChange, addNode, updateNodeConfig } = graph;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Clear selection if the selected node was deleted
  useEffect(() => {
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null);
  }, [nodes, selectedNodeId]);

  const selectedNode = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;

  return (
    <div className="flex-1 flex min-h-0 h-full" data-flow-editor>
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
          <div className="flex items-center justify-center h-full text-accent-red text-sm">{error ?? 'Failed to load flow'}</div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">Loading…</div>
        )}
      </div>

      {status === 'ready' && selectedNode && (
        <aside className="w-[300px] shrink-0 bg-app-surface" style={{ borderLeft: '0.5px solid var(--color-border)' }}>
          <NodeInspector
            nodeId={selectedNode.id}
            toolId={selectedNode.data.toolId}
            config={selectedNode.data.config}
            doc={doc}
            onPatchConfig={(patch) => updateNodeConfig(selectedNode.id, patch)}
            onExpose={(field) => onExpose(selectedNode.id, field)}
            onUnexpose={(key) => onUnexpose(selectedNode.id, key)}
            onSetPause={(pause) => onSetPause(selectedNode.id, pause)}
          />
        </aside>
      )}
    </div>
  );
}
