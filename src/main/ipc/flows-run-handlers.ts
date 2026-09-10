// Flows IPC — nodes and runs (docs/flows-plan.md §1.3, W8 Stage 1). Thin
// bodies over `flowService`; error shaping only. Project and history
// channels stay in `flows-handlers.ts`.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  FlowsNodesListResponse,
  FlowsRunCancelRequest,
  FlowsRunCancelResponse,
  FlowsRunGetRequest,
  FlowsRunGetResponse,
  FlowsRunReplyRequest,
  FlowsRunReplyResponse,
  FlowsRunResumeRequest,
  FlowsRunResumeResponse,
  FlowsRunStartRequest,
  FlowsRunStartResponse,
} from '../../shared/ipc/types';
import { flowService } from '../services/flows/flow-service';
// W8 Stage 4: the flow service reads the registry STORE (`registry-core`);
// this import is what registers every tool before a run can be started.
import '../services/agents/tools/registry';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-handlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

export async function handleFlowsNodesList(): Promise<FlowsNodesListResponse> {
  try {
    return { success: true, nodes: await flowService.listNodes() };
  } catch (err) {
    return fail(err, 'Failed to list flow nodes');
  }
}

export async function handleFlowsRunStart(
  _event: IpcMainInvokeEvent,
  data: FlowsRunStartRequest,
): Promise<FlowsRunStartResponse> {
  try {
    if (!data.flowId) return { success: false, error: 'Missing flow id' };
    const { runId } = await flowService.start({
      flowId: data.flowId,
      mode: data.mode ?? 'unattended',
      params: data.params ?? {},
      ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
    });
    return { success: true, runId };
  } catch (err) {
    return fail(err, 'Failed to start the flow');
  }
}

export async function handleFlowsRunCancel(
  _event: IpcMainInvokeEvent,
  data: FlowsRunCancelRequest,
): Promise<FlowsRunCancelResponse> {
  try {
    if (!flowService.cancel(data.runId)) return { success: false, error: 'That run is not running.' };
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to cancel the run');
  }
}

export async function handleFlowsRunResume(
  _event: IpcMainInvokeEvent,
  data: FlowsRunResumeRequest,
): Promise<FlowsRunResumeResponse> {
  try {
    await flowService.resume(data.runId);
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to resume the run');
  }
}

export async function handleFlowsRunGet(
  _event: IpcMainInvokeEvent,
  data: FlowsRunGetRequest,
): Promise<FlowsRunGetResponse> {
  try {
    const view = await flowService.get(data.runId);
    return {
      success: true,
      run: view.run,
      artifacts: view.artifacts,
      assetUrls: view.assetUrls,
      resumable: view.resumable,
    };
  } catch (err) {
    return fail(err, 'Failed to load the run');
  }
}

/** A checkpoint reply (Stage 2): the agents' `InteractionReply`, scoped by run. */
export async function handleFlowsRunReply(
  _event: IpcMainInvokeEvent,
  data: FlowsRunReplyRequest,
): Promise<FlowsRunReplyResponse> {
  try {
    if (!data.runId || !data.reply?.requestId) return { success: false, error: 'Missing run or request id' };
    await flowService.reply(data.runId, data.reply);
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to answer the checkpoint');
  }
}
