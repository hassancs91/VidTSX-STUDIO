import { useCallback } from 'react';
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
import { getNodeDef } from '../nodes';
import { isPortCompatible } from '../nodes/types';
import { CustomNode } from './CustomNode';
import { PALETTE_DRAG_TYPE } from './NodePalette';

interface NodeData extends Record<string, unknown> {
  typeId: string;
  config: Record<string, unknown>;
}

type FlowNode = Node<NodeData>;
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
}: Props) {
  const { screenToFlowPosition } = useReactFlow();

  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceDef = getNodeDef(sourceNode.data.typeId);
      const targetDef = getNodeDef(targetNode.data.typeId);
      if (!sourceDef || !targetDef) return false;
      const sourcePort = sourceDef.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetDef.inputs.find((p) => p.id === connection.targetHandle);
      if (!sourcePort || !targetPort) return false;
      return isPortCompatible(sourcePort.dataType, targetPort.dataType);
    },
    [nodes],
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
