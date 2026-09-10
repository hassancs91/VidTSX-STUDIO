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
import type { FlowDoc, NodeSpec } from '@shared/types/flows';
import { legacyPrimaryHandle, parseFlowDoc } from '@shared/flows/migrate-v1';
import { withGraph } from '@shared/flows/doc-graph';
import { EMPTY_GRAPH, type FlowCanvasNodeData } from '../types';
import { renderGraphThumbnail } from '../services/render-graph-thumbnail';

type FlowNode = Node<FlowCanvasNodeData>;
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

interface CanvasGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
}

// The store holds a v2 FlowDoc (W8 Stage 0); the canvas nodes carry the
// registry tool id directly (Stage 1). Params, outputs, origin and each node's
// `pause` ride along untouched on `docRef` across canvas edits.
function docToCanvas(doc: FlowDoc): CanvasGraph {
  return {
    nodes: doc.graph.nodes.map((n) => ({
      id: n.id,
      type: 'flowNode' as const,
      position: { ...n.position },
      data: { toolId: n.toolId, config: { ...n.config } },
    })),
    edges: doc.graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
    viewport: { ...doc.graph.viewport },
  };
}

function canvasToDoc(
  doc: FlowDoc,
  graph: CanvasGraph,
  primaryHandle: (toolId: string) => string | undefined,
): FlowDoc {
  return withGraph(
    doc,
    {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        toolId: n.data.toolId,
        position: { x: n.position.x, y: n.position.y },
        config: n.data.config,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? '',
        target: e.target,
        targetHandle: e.targetHandle ?? '',
      })),
      viewport: { x: graph.viewport.x, y: graph.viewport.y, zoom: graph.viewport.zoom },
    },
    primaryHandle,
  );
}

const SAVE_DEBOUNCE_MS = 500;

/** `specs` is the registry catalogue (`useNodeSpecs`): defaults for a
 *  dropped node, the first output port for the sink outputs, categories for
 *  the thumbnail. */
export function useFlowGraph(flowId: string, specs: Record<string, NodeSpec>) {
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
  const docRef = useRef<FlowDoc | null>(null);
  const specsRef = useRef(specs);
  useEffect(() => {
    specsRef.current = specs;
  }, [specs]);

  const primaryHandle = useCallback(
    (toolId: string) => specsRef.current[toolId]?.outputs[0]?.id ?? legacyPrimaryHandle(toolId),
    [],
  );
  const categoryOf = useCallback((toolId: string) => specsRef.current[toolId]?.category, []);

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
        setState((prev) => ({ ...prev, status: 'error', error: res.error ?? 'Failed to load flow' }));
        return;
      }
      const doc = parseFlowDoc(res.project.graphJson, {
        id: res.project.id,
        name: res.project.name,
        description: res.project.description,
      });
      docRef.current = doc;
      const graph = docToCanvas(doc);
      lastSavedRef.current = JSON.stringify(canvasToDoc(doc, graph, primaryHandle));
      setState({ status: 'ready', project: res.project, error: null, ...graph });

      // Backfill a thumbnail for a project created without one (a template).
      if (!res.project.thumbnail && graph.nodes.length > 0) {
        const thumbnail = renderGraphThumbnail(graph, { categoryOf });
        void window.api.flowsProjectUpdate({ id: flowId, thumbnail }).then((updRes) => {
          if (cancelled || !updRes.success || !updRes.project) return;
          setState((prev) => ({ ...prev, project: updRes.project ?? prev.project }));
        });
      }
    });

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [flowId, primaryHandle, categoryOf]);

  // Debounced auto-save
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const base = docRef.current;
      if (!base) return;
      const graph = { nodes: state.nodes, edges: state.edges, viewport: state.viewport };
      const nextDoc = canvasToDoc(base, graph, primaryHandle);
      const json = JSON.stringify(nextDoc);
      if (json === lastSavedRef.current) return;
      const thumbnail = renderGraphThumbnail(graph, { categoryOf });
      void window.api.flowsProjectUpdate({ id: flowId, graphJson: json, thumbnail }).then((res) => {
        if (res.success && res.project) {
          lastSavedRef.current = json;
          docRef.current = nextDoc;
          setState((prev) => ({ ...prev, project: res.project ?? prev.project }));
        } else {
          setState((prev) => ({ ...prev, error: res.error ?? 'Failed to save flow' }));
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [flowId, state.status, state.nodes, state.edges, state.viewport, primaryHandle, categoryOf]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setState((prev) => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes) as FlowNode[] }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setState((prev) => ({ ...prev, edges: applyEdgeChanges(changes, prev.edges) }));
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

  const addNode = useCallback((toolId: string, position: { x: number; y: number }) => {
    const spec = specsRef.current[toolId];
    if (!spec) return;
    const newNode: FlowNode = {
      id: `n-${ulid()}`,
      type: 'flowNode',
      position,
      data: { toolId, config: { ...spec.defaultConfig } },
    };
    setState((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n,
      ),
    }));
  }, []);

  const renameFlow = useCallback(
    async (name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const res = await window.api.flowsProjectUpdate({ id: flowId, name: trimmed });
      if (res.success && res.project) {
        if (docRef.current) docRef.current = { ...docRef.current, name: trimmed };
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
