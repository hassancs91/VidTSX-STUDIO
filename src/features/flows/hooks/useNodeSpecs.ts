// The node catalogue the canvas draws (flows plan §1.2): serialisable
// `NodeSpec`s fetched once from main over FLOWS_NODES_LIST. The renderer
// never holds a handler; a spec is the tool's id, label, ports, inspector
// fields, defaults, gate and price.

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import type { NodeSpec } from '@shared/types/flows';

export interface NodeSpecsState {
  status: 'loading' | 'ready' | 'error';
  specs: NodeSpec[];
  byId: Record<string, NodeSpec>;
  error: string | null;
}

const INITIAL: NodeSpecsState = { status: 'loading', specs: [], byId: {}, error: null };

const NodeSpecsContext = createContext<NodeSpecsState>(INITIAL);

export function NodeSpecsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NodeSpecsState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    void window.api
      .flowsNodesList()
      .then((res) => {
        if (cancelled) return;
        if (!res.success || !res.nodes) {
          setState({ status: 'error', specs: [], byId: {}, error: res.error ?? 'Failed to load nodes' });
          return;
        }
        setState({
          status: 'ready',
          specs: res.nodes,
          byId: Object.fromEntries(res.nodes.map((s) => [s.id, s])),
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          specs: [],
          byId: {},
          error: err instanceof Error ? err.message : 'Failed to load nodes',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return createElement(NodeSpecsContext.Provider, { value: state }, children);
}

export function useNodeSpecs(): NodeSpecsState {
  return useContext(NodeSpecsContext);
}

export function useNodeSpec(toolId: string): NodeSpec | null {
  return useContext(NodeSpecsContext).byId[toolId] ?? null;
}
