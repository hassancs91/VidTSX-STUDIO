export type {
  FlowProject,
  FlowProjectSummary,
  FlowProjectCreateRequest,
  FlowProjectUpdateRequest,
} from '@shared/ipc/types';

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
