import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { isPortCompatible } from '@shared/types/flows';
import { useNodeSpecs } from '../hooks/useNodeSpecs';
import type { FlowCanvasNodeData } from '../types';
import { CustomNode } from './CustomNode';
import { PALETTE_DRAG_TYPE } from './NodePalette';

type FlowNode = Node<FlowCanvasNodeData>;
type FlowEdge = Edge;

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onViewportChange: (vp: Viewport) => void;
  onSelectionChange: (nodeId: string | null) => void;
  onDropNode: (typeId: string, position: { x: number; y: number }) => void;
  /** W8 Stage 4: bump to fit the view (a proposal landed on an empty canvas). */
  fitToken?: number;
}

const NODE_TYPES = { flowNode: CustomNode };

function FlowCanvasInner({
  nodes,
  edges,
  viewport,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onViewportChange,
  onSelectionChange,
  onDropNode,
  fitToken,
}: Props) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  useEffect(() => {
    if (fitToken) window.setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 50);
  }, [fitToken, fitView]);
  const { byId: specs } = useNodeSpecs();

  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceSpec = specs[sourceNode.data.toolId];
      const targetSpec = specs[targetNode.data.toolId];
      if (!sourceSpec || !targetSpec) return false;
      const sourcePort = sourceSpec.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetSpec.inputs.find((p) => p.id === connection.targetHandle);
      if (!sourcePort || !targetPort) return false;
      return isPortCompatible(sourcePort.dataType, targetPort.dataType);
    },
    [nodes, specs],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const typeId = e.dataTransfer.getData(PALETTE_DRAG_TYPE);
      if (!typeId) return;
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onDropNode(typeId, position);
    },
    [screenToFlowPosition, onDropNode],
  );

  return (
    <div className="w-full h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={(_e, vp) => onViewportChange(vp)}
        onSelectionChange={({ nodes: selectedNodes }) => {
          onSelectionChange(selectedNodes[0]?.id ?? null);
        }}
        isValidConnection={isValidConnection}
        nodeTypes={NODE_TYPES}
        defaultViewport={viewport}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#3a3a44" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          maskColor="rgba(19, 19, 22, 0.7)"
          style={{ backgroundColor: '#1a1a1e' }}
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
