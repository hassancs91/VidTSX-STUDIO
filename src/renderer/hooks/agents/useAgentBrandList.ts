import { useEffect, useState } from 'react';

export interface AgentBrandOption {
  id: string;
  name: string;
}

export interface AgentBrandList {
  brands: AgentBrandOption[];
  /** The library default, when it points at a real brand. */
  defaultBrandId: string | undefined;
  loaded: boolean;
}

/**
 * Read-only brand list for the session brand picker (W4). The agents
 * feature never imports asset-library — the shared library IPC surface is
 * the one crossing point (the Studio `useBrandList` precedent). Fetched
 * once per mount; brand curation happens on the Assets screen.
 */
export function useAgentBrandList(): AgentBrandList {
  const [state, setState] = useState<AgentBrandList>({ brands: [], defaultBrandId: undefined, loaded: false });

  useEffect(() => {
    let cancelled = false;
    void window.api.libraryBrandsGet().then((res) => {
      if (cancelled) return;
      setState({
        brands: res.success && res.brands ? res.brands.map(({ id, name }) => ({ id, name })) : [],
        defaultBrandId: res.success ? res.defaultBrandId : undefined,
        loaded: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
