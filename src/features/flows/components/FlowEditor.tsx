import { useEffect, useMemo, useState } from 'react';
import type { Edge } from 'reactflow';
import { Sparkles } from 'lucide-react';
import type { ConfigField, FlowDoc } from '@shared/types/flows';
import { nodeChangeMap } from '@shared/flows/flow-diff';
import type { useFlowGraph } from '../hooks/useFlowGraph';
import { useFlowProposal } from '../hooks/useFlowProposal';
import { useNodeSpecs } from '../hooks/useNodeSpecs';
import { BuilderPanel } from './BuilderPanel';
import { FlowCanvas } from './FlowCanvas';
import { FlowProposalOverlay, proposalDiff } from './FlowProposalOverlay';
import { NodePalette } from './NodePalette';
import { NodeInspector } from './NodeInspector';

type Graph = ReturnType<typeof useFlowGraph>;

interface Props {
  graph: Graph;
  doc: FlowDoc | null;
  flowId: string;
  flowName: string;
  onExpose: (nodeId: string, field: ConfigField) => void;
  onUnexpose: (nodeId: string, key: string) => void;
  onSetPause: (nodeId: string, pause: boolean) => void;
  /** W8 Stage 5: the agent session whose frozen proposal this canvas shows. */
  proposalSessionId?: string;
  /** W8 Stage 5: a frozen proposal was discarded — the host drops the empty row. */
  onProposalDiscarded?: () => void;
}

const ADDED = '#34d399';
const REMOVED = 'var(--color-accent-red)';

/**
 * The Edit view (flows plan §1.8): palette, canvas, inspector — and, W8
 * Stage 4, the "Ask the builder" side panel with the Flow Builder's proposal
 * drawn over the canvas: added nodes green, removed red, changed amber, the
 * card listing the diff. Accept applies the proposed document through the
 * graph hook's ordinary save path; Discard drops it. The workspace host owns
 * the graph hook and the header; this is the body only.
 */
export function FlowEditor({ graph, doc, flowId, flowName, onExpose, onUnexpose, onSetPause, proposalSessionId, onProposalDiscarded }: Props) {
  const { status, error, nodes, edges, viewport, onNodesChange, onEdgesChange, onConnect, onViewportChange, addNode, updateNodeConfig, replaceDoc } = graph;
  const { byId: specs } = useNodeSpecs();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderSession, setBuilderSession] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  // The builder's session once the panel has one; a frozen session's card
  // until then (W8 Stage 5).
  const { proposal, error: proposalError, resolve } = useFlowProposal(builderSession ?? proposalSessionId ?? null);
  const proposalId = proposal?.id ?? null;
  useEffect(() => {
    if (proposalId) setFitToken((t) => t + 1);
  }, [proposalId]);

  // Clear selection if the selected node was deleted
  useEffect(() => {
    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null);
  }, [nodes, selectedNodeId]);

  // A proposal is shown as the union of both graphs, coloured by change.
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!proposal) return { displayNodes: nodes, displayEdges: edges };
    const changes = nodeChangeMap(proposalDiff(proposal, doc));
    const currentIds = new Set(nodes.map((n) => n.id));
    const shownNodes = nodes.map((n) => (changes[n.id] ? { ...n, data: { ...n.data, proposal: changes[n.id] } } : n));
    for (const p of proposal.doc.graph.nodes) {
      if (currentIds.has(p.id)) continue;
      shownNodes.push({
        id: p.id,
        type: 'flowNode' as const,
        position: { ...p.position },
        data: { toolId: p.toolId, config: { ...p.config }, proposal: 'added' as const },
        draggable: false,
        selectable: false,
      });
    }
    const key = (e: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }) =>
      `${e.source}:${e.sourceHandle ?? ''}->${e.target}:${e.targetHandle ?? ''}`;
    const proposed = new Set(proposal.doc.graph.edges.map(key));
    const current = new Set(edges.map(key));
    const shownEdges: Edge[] = edges.map((e) => (proposed.has(key(e)) ? e : { ...e, style: { stroke: REMOVED, strokeDasharray: '4 3' } }));
    for (const e of proposal.doc.graph.edges) {
      if (current.has(key(e))) continue;
      shownEdges.push({ id: `proposed-${e.id}`, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle, animated: true, style: { stroke: ADDED } });
    }
    return { displayNodes: shownNodes, displayEdges: shownEdges };
  }, [proposal, nodes, edges, doc]);

  const accept = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      replaceDoc(proposal.doc);
      await resolve(true);
    } finally {
      setApplying(false);
    }
  };

  const selectedNode = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;

  return (
    <div className="flex-1 flex min-h-0 h-full" data-flow-editor>
      {status === 'ready' && (
        <aside className="w-[200px] shrink-0 bg-app-surface" style={{ borderRight: '0.5px solid var(--color-border)' }}>
          <NodePalette />
        </aside>
      )}

      <div className="flex-1 min-w-0 bg-app-deep relative">
        {status === 'ready' ? (
          <FlowCanvas
            nodes={displayNodes}
            edges={displayEdges}
            viewport={viewport}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onViewportChange={onViewportChange}
            onSelectionChange={setSelectedNodeId}
            onDropNode={addNode}
            fitToken={fitToken}
          />
        ) : status === 'error' ? (
          <div className="flex items-center justify-center h-full text-accent-red text-sm">{error ?? 'Failed to load flow'}</div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">Loading…</div>
        )}
        {status === 'ready' && !builderOpen && (
          <button
            onClick={() => setBuilderOpen(true)}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 h-[26px] px-2.5 rounded-[6px] bg-app-surface text-[11px] text-text-secondary hover:text-text-primary hover:bg-app-hover"
            style={{ border: '0.5px solid var(--color-border)' }}
            data-ask-builder
          >
            <Sparkles size={12} strokeWidth={1.75} className="text-accent" />
            Ask the builder
          </button>
        )}
        {proposal && (
          <FlowProposalOverlay
            proposal={proposal}
            current={doc}
            specs={specs}
            busy={applying}
            error={proposalError}
            onAccept={() => void accept()}
            onDiscard={() => {
              const frozen = proposal.source === 'frozen';
              void resolve(false).then((done) => {
                if (done && frozen) onProposalDiscarded?.();
              });
            }}
          />
        )}
      </div>

      {status === 'ready' && selectedNode && !proposal && (
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

      {status === 'ready' && builderOpen && (
        <aside className="w-[340px] shrink-0 bg-app-surface" style={{ borderLeft: '0.5px solid var(--color-border)' }}>
          <BuilderPanel
            flowId={flowId}
            flowName={flowName}
            onSession={setBuilderSession}
            onClose={() => setBuilderOpen(false)}
          />
        </aside>
      )}
    </div>
  );
}
