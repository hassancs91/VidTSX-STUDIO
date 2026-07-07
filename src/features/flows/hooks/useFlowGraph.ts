import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Viewport,
} from 'reactflow';
import { ulid } from 'ulid';
import type { FlowProject } from '@shared/ipc/types';
import { EMPTY_GRAPH, type GraphJson } from '../types';
import { NODE_REGISTRY } from '../nodes';
import { renderGraphThumbnail } from '../services/render-graph-thumbnail';

interface NodeData extends Record<string, unknown> {
  typeId: string;
  config: Record<string, unknown>;
}

type FlowNode = Node<NodeData>;
type FlowEdge = Edge;

type Status = 'loading' | 'ready' | 'error';

interface State {
  status: Status;
  project: FlowProject | null;
  error: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
}

function parseGraph(raw: string): GraphJson {
  try {
    const parsed = JSON.parse(raw) as Partial<GraphJson>;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_GRAPH };
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      viewport: parsed.viewport ?? { ...EMPTY_GRAPH.viewport },
    };
  } catch {
    return { ...EMPTY_GRAPH };
  }
}

function serialize(nodes: FlowNode[], edges: FlowEdge[], viewport: Viewport): string {
  return JSON.stringify({ nodes, edges, viewport });
}

const SAVE_DEBOUNCE_MS = 500;

export function useFlowGraph(flowId: string) {
  const [state, setState] = useState<State>({
    status: 'loading',
    project: null,
    error: null,
    nodes: [],
    edges: [],
    viewport: { ...EMPTY_GRAPH.viewport },
  });
  const lastSavedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load
  useEffect(() => {
    let cancelled = false;
    setState({
      status: 'loading',
      project: null,
      error: null,
      nodes: [],
      edges: [],
      viewport: { ...EMPTY_GRAPH.viewport },
    });

    void window.api.flowsProjectLoad({ id: flowId }).then((res) => {
      if (cancelled) return;
      if (!res.success || !res.project) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: res.error ?? 'Failed to load flow',
        }));
        return;
      }
      const graph = parseGraph(res.project.graphJson);
      lastSavedRef.current = serialize(
        graph.nodes as FlowNode[],
        graph.edges as FlowEdge[],
        graph.viewport,
      );
      setState({
        status: 'ready',
        project: res.project,
        error: null,
        nodes: graph.nodes as FlowNode[],
        edges: graph.edges as FlowEdge[],
        viewport: graph.viewport,
      });

      // Backfill: if the project was created from a template (or any prior
      // path that wrote nodes without a thumbnail), generate one now so the
      // card has a preview before the user makes any edits.
      if (!res.project.thumbnail && graph.nodes.length > 0) {
        const thumbnail = renderGraphThumbnail(graph);
        void window.api
          .flowsProjectUpdate({ id: flowId, thumbnail })
          .then((updRes) => {
            if (cancelled || !updRes.success || !updRes.project) return;
            setState((prev) => ({ ...prev, project: updRes.project ?? prev.project }));
          });
      }
    });

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [flowId]);

  // Debounced auto-save
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const json = serialize(state.nodes, state.edges, state.viewport);
      if (json === lastSavedRef.current) return;
      // Schematic thumbnail regenerated on every save — pure SVG, ~tiny, doesn't
      // depend on the canvas being mounted or a successful run having happened.
      const graphForThumb: GraphJson = {
        nodes: state.nodes as unknown as GraphJson['nodes'],
        edges: state.edges as unknown as GraphJson['edges'],
        viewport: state.viewport,
      };
      const thumbnail = renderGraphThumbnail(graphForThumb);
      void window.api
        .flowsProjectUpdate({ id: flowId, graphJson: json, thumbnail })
        .then((res) => {
          if (res.success && res.project) {
            lastSavedRef.current = json;
            setState((prev) => ({ ...prev, project: res.project ?? prev.project }));
          } else {
            setState((prev) => ({ ...prev, error: res.error ?? 'Failed to save flow' }));
          }
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [flowId, state.status, state.nodes, state.edges, state.viewport]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setState((prev) => ({
      ...prev,
      nodes: applyNodeChanges(changes, prev.nodes) as FlowNode[],
    }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setState((prev) => ({
      ...prev,
      edges: applyEdgeChanges(changes, prev.edges),
    }));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const newEdge: FlowEdge = {
      id: `e-${ulid()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };
    setState((prev) => ({ ...prev, edges: [...prev.edges, newEdge] }));
  }, []);

  const onViewportChange = useCallback((viewport: Viewport) => {
    setState((prev) => ({ ...prev, viewport }));
  }, []);

  const addNode = useCallback((typeId: string, position: { x: number; y: number }) => {
    const def = NODE_REGISTRY[typeId];
    if (!def) return;
    const newNode: FlowNode = {
      id: `n-${ulid()}`,
      type: 'flowNode',
      position,
      data: {
        typeId,
        config: { ...def.defaultConfig },
      },
    };
    setState((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, []);

  const updateNodeConfig = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } }
            : n,
        ),
      }));
    },
    [],
  );

  const renameFlow = useCallback(
    async (name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const res = await window.api.flowsProjectUpdate({ id: flowId, name: trimmed });
      if (res.success && res.project) {
        setState((prev) => ({ ...prev, project: res.project ?? prev.project }));
      }
    },
    [flowId],
  );

  return {
    status: state.status,
    project: state.project,
    error: state.error,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onViewportChange,
    addNode,
    updateNodeConfig,
    renameFlow,
  };
}
