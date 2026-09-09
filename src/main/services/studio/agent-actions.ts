// W3: the main → renderer action bridge for the Studio agent. The document
// (timeline, proposals, captions) and the render queue live in the renderer,
// so a tool that must APPLY something — accept_proposal, insert_asset with
// apply, export_project, set_captions — sends a request over the agent
// event stream and waits for the renderer's answer on
// STUDIO_AGENT_ACTION_RESULT. One pending request per id; the turn's abort
// signal and a per-action timeout both settle it.

import { randomUUID } from 'crypto';
import type {
  StudioAgentAction,
  StudioAgentActionResultRequest,
  StudioAgentEvent,
} from '../../../shared/ipc/types/studio';

export interface AgentActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface PendingAction {
  projectId: string;
  resolve: (result: AgentActionResult) => void;
  timer: ReturnType<typeof setTimeout>;
  onAbort: () => void;
  signal: AbortSignal;
}

/** Renderer round-trips are quick; export prepare validates every shot. */
export const ACTION_TIMEOUT_MS: Record<StudioAgentAction['type'], number> = {
  'apply-proposal': 30_000,
  export: 180_000,
  'set-captions': 30_000,
};

export class AgentActionBridge {
  private pending = new Map<string, PendingAction>();

  /**
   * Ask the renderer to perform `action`. Resolves with the renderer's
   * result, or a failure when the turn aborts, the renderer never answers,
   * or no renderer is listening.
   */
  request(
    projectId: string,
    action: StudioAgentAction,
    emit: (event: StudioAgentEvent) => void,
    signal: AbortSignal,
    timeoutMs = ACTION_TIMEOUT_MS[action.type],
  ): Promise<AgentActionResult> {
    if (signal.aborted) {
      return Promise.resolve({ success: false, error: 'The turn was cancelled.' });
    }
    const requestId = randomUUID();
    return new Promise<AgentActionResult>((resolve) => {
      const settle = (result: AgentActionResult) => {
        const entry = this.pending.get(requestId);
        if (!entry) return;
        this.pending.delete(requestId);
        clearTimeout(entry.timer);
        entry.signal.removeEventListener('abort', entry.onAbort);
        resolve(result);
      };
      const onAbort = () => settle({ success: false, error: 'The turn was cancelled.' });
      const timer = setTimeout(
        () =>
          settle({
            success: false,
            error: `The editor did not answer within ${Math.round(timeoutMs / 1000)} s — is the project still open?`,
          }),
        timeoutMs,
      );
      this.pending.set(requestId, { projectId, resolve: settle, timer, onAbort, signal });
      signal.addEventListener('abort', onAbort, { once: true });
      emit({ projectId, kind: 'action', requestId, action });
    });
  }

  /** The renderer's answer. False when nothing was waiting (late or unknown). */
  resolve(result: StudioAgentActionResultRequest): boolean {
    const entry = this.pending.get(result.requestId);
    if (!entry || entry.projectId !== result.projectId) return false;
    entry.resolve({
      success: result.success,
      ...(result.message ? { message: result.message } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
    return true;
  }

  /** Test/diagnostic hook. */
  pendingCount(): number {
    return this.pending.size;
  }
}

export const agentActions = new AgentActionBridge();
