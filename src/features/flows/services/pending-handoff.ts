// The "Run a flow on this" / Tools-hub hand-off into this screen (flows
// plan §1.8, W8 Stage 6). Other features cannot import this one, so they
// speak through the shared `flow-handoff.ts` contract: `vidtsx:navigate`
// to `flows`, then a `vidtsx:flows-open` event with `{ flowId, prefill }` —
// plus a sessionStorage stash for the first visit, when the screen mounts
// after the event has fired. Same shape as `pending-freeze.ts`.

import { FLOWS_HANDOFF_STASH_KEY, FLOWS_OPEN_EVENT, isFlowHandoff, type FlowHandoff } from '@shared/flows/flow-handoff';

export { FLOWS_OPEN_EVENT };
export type { FlowHandoff };

/** Read and clear the stash; null when nothing is waiting. */
export function takePendingHandoff(): FlowHandoff | null {
  try {
    const raw = sessionStorage.getItem(FLOWS_HANDOFF_STASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLOWS_HANDOFF_STASH_KEY);
    const parsed = JSON.parse(raw) as unknown;
    return isFlowHandoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function handoffFromEvent(event: Event): FlowHandoff | null {
  const detail = (event as CustomEvent<unknown>).detail;
  return isFlowHandoff(detail) ? detail : null;
}
