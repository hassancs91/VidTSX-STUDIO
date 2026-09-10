// The freeze hand-off from the agent stage (flows plan §1.5 step 5, W8
// Stage 5). The agents feature cannot import this feature (CLAUDE.md rule
// 1), so it speaks to the Flows screen the way every cross-screen hop does:
// `vidtsx:navigate` to `flows`, then a `vidtsx:flows-open-proposal` event
// naming the session whose proposal main holds — plus a sessionStorage stash
// for the first visit, when the screen mounts after the event has fired.
// Main is the source of truth either way (`FLOWS_PROPOSAL_GET`).

export const FREEZE_EVENT = 'vidtsx:flows-open-proposal';
const FREEZE_STASH_KEY = 'vidtsx:flows-pending-freeze';

export interface PendingFreeze {
  agentId: string;
  sessionId: string;
}

function isPendingFreeze(value: unknown): value is PendingFreeze {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PendingFreeze).agentId === 'string' &&
    typeof (value as PendingFreeze).sessionId === 'string'
  );
}

/** Read and clear the stash; null when nothing is waiting. */
export function takePendingFreeze(): PendingFreeze | null {
  try {
    const raw = sessionStorage.getItem(FREEZE_STASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FREEZE_STASH_KEY);
    const parsed = JSON.parse(raw) as unknown;
    return isPendingFreeze(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function pendingFreezeFromEvent(event: Event): PendingFreeze | null {
  const detail = (event as CustomEvent<unknown>).detail;
  return isPendingFreeze(detail) ? detail : null;
}
