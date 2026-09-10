export type {
  FlowProject,
  FlowProjectSummary,
  FlowProjectCreateRequest,
  FlowProjectUpdateRequest,
} from '@shared/ipc/types';

/** What a reactflow node carries on the canvas (W8 Stage 1): the registry
 *  tool id and the node's config — no handler, no legacy type id. */
export interface FlowCanvasNodeData extends Record<string, unknown> {
  toolId: string;
  config: Record<string, unknown>;
}

/** The v1 canvas graph — still the shape the bundled templates are written
 *  in (`data.typeId`); the store migrates it on create. */
export interface GraphJson {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface GraphNode {
  id: string;
  type: 'flowNode';
  position: { x: number; y: number };
  data: {
    typeId: string;
    config: Record<string, unknown>;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export const EMPTY_GRAPH: GraphJson = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};
