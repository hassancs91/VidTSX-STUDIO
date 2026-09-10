// "Run a flow on this" from any screen (flows plan §1.8, W8 Stage 6).
//
// Lives under `src/renderer/` so the Library, the Video Studio and the Tools
// hub can use it without importing the Flows feature (CLAUDE.md rule 1). The
// hook reads the flows list over IPC and keeps the `image` / `video` targets;
// `openFlowRunForm` is the hop itself — `vidtsx:navigate` to Flows, a stash
// for a first visit, then the `vidtsx:flows-open` event once the screen has
// had a tick to mount (the Home / freeze hand-off pattern).

import { useCallback, useEffect, useState } from 'react';
import type { FlowProjectSummary } from '@shared/ipc/types';
import {
  FLOWS_HANDOFF_STASH_KEY,
  FLOWS_OPEN_EVENT,
  buildFlowHandoff,
  handoffTargets,
  type FlowHandoff,
  type FlowHandoffTarget,
} from '@shared/flows/flow-handoff';

const MOUNT_DELAY_MS = 150;

/** Open a flow's run form, optionally with params prefilled. */
export function openFlowRunForm(handoff: FlowHandoff): void {
  try {
    sessionStorage.setItem(FLOWS_HANDOFF_STASH_KEY, JSON.stringify(handoff));
  } catch {
    // The event below still reaches a mounted Flows screen.
  }
  window.dispatchEvent(new CustomEvent('vidtsx:navigate', { detail: { screen: 'flows' } }));
  setTimeout(() => window.dispatchEvent(new CustomEvent(FLOWS_OPEN_EVENT, { detail: handoff })), MOUNT_DELAY_MS);
}

export interface FlowHandoffs {
  /** The flows taking a param of the requested kind. Empty until loaded. */
  targets: FlowHandoffTarget[];
  loaded: boolean;
  /** Every flow, for callers that list them (the Tools hub's Flows group). */
  flows: FlowProjectSummary[];
  /** Open the run form with `value` (an absolute path or a library entry id) on that param. */
  runFlowOn: (target: FlowHandoffTarget, value: string) => void;
  refresh: () => Promise<void>;
}

/** The flows that can take a media item of `kind`, fetched once per mount. */
export function useFlowHandoffs(kind: 'image' | 'video' | null): FlowHandoffs {
  const [flows, setFlows] = useState<FlowProjectSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await window.api.flowsProjectList();
    setFlows(res.success && res.projects ? res.projects : []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runFlowOn = useCallback((target: FlowHandoffTarget, value: string) => {
    openFlowRunForm(buildFlowHandoff(target, value));
  }, []);

  return {
    targets: kind ? handoffTargets(flows, kind) : [],
    loaded,
    flows,
    runFlowOn,
    refresh,
  };
}
