// The checkpoint after a `pause` node, and a tool's own question, in an
// attended run (flows plan §1.3, decision 4, W8 Stage 2). Both post a card
// through the run's interaction broker and wait for the runner's `reply()`
// or the abort. Accept substitutes the chosen value on the port; the first
// reject reruns the node once with the note; a second reject, or Stop, ends
// the run `cancelled`.

import type { InteractionPayload, InteractionReply } from '../../../shared/types/agents';
import type { FlowNodeRunState } from '../../../shared/types/flows';
import { interpretPauseReply } from '../../../shared/flows/pause-reply';
import type { InteractionAskResult } from '../agents/tools/types';
import { acceptedOutputs, planPause } from './flow-pause';
import type { NodeDef, RunCtx, RunHost, StepOutcome } from './flow-run-types';

const MAX_REJECTIONS = 2;

/** Post a card and wait for the reply or the abort. `null` on abort. */
export async function askAndWait(
  host: RunHost,
  ctx: RunCtx,
  nodeId: string,
  payload: InteractionPayload,
  callId: string,
): Promise<InteractionReply | null> {
  ctx.active.pausedNodeId = nodeId;
  await host.setRunStatus(ctx, 'paused');
  const posted = await ctx.active.broker.post(payload, callId);
  if (posted.status !== 'posted') {
    ctx.active.pausedNodeId = null;
    await host.setRunStatus(ctx, 'running');
    return null;
  }
  const reply = await new Promise<InteractionReply | null>((resolve) => {
    const onAbort = () => resolve(null);
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    ctx.active.waiter = (r) => {
      ctx.signal.removeEventListener('abort', onAbort);
      resolve(r);
    };
  });
  ctx.active.pausedNodeId = null;
  if (reply) await host.setRunStatus(ctx, 'running');
  return reply;
}

/** `ctx.ask` for a tool inside an attended run: the same card path, the tool gets the answer. */
export async function askFromTool(
  host: RunHost,
  ctx: RunCtx,
  nodeId: string,
  payload: InteractionPayload,
  callId: string,
): Promise<InteractionAskResult> {
  const reply = await askAndWait(host, ctx, nodeId, payload, callId);
  if (!reply) return { status: 'rejected', reason: 'The run was cancelled.' };
  if (reply.status !== 'answered') return { status: 'rejected', reason: `The user ${reply.status} the question.` };
  return { status: 'answered', requestId: reply.requestId, values: reply.values };
}

/**
 * The checkpoint loop. `initial` is the node's state after its run (`done`
 * with outputs), or a `paused` state Resume kept — then the card is raised
 * again without paying for the step twice.
 */
export async function runCheckpoint(
  host: RunHost,
  ctx: RunCtx,
  nodeId: string,
  def: NodeDef,
  initial: FlowNodeRunState,
): Promise<{ kind: 'continue' } | Extract<StepOutcome, { kind: 'stop' }>> {
  const node = ctx.input.doc.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return { kind: 'stop', status: 'error', error: `Unknown node "${nodeId}".` };
  let state = initial;
  for (;;) {
    const values = state.outputs ?? {};
    const plan = await planPause({
      node,
      label: def.ports.label,
      outputs: def.ports.outputs,
      values,
      store: ctx.artifacts,
      callId: `${ctx.runDoc.id}:${nodeId}:${state.attempts}`,
    });
    if (!plan) {
      if (state.status !== 'done') await host.setNode(ctx, nodeId, { ...state, status: 'done' });
      return { kind: 'continue' };
    }
    state = { ...state, status: 'paused' };
    await host.setNode(ctx, nodeId, state);
    const reply = await askAndWait(host, ctx, nodeId, plan.payload, `${ctx.runDoc.id}:${nodeId}:checkpoint`);
    if (!reply) {
      await host.setNode(ctx, nodeId, { ...state, status: 'skipped' });
      return { kind: 'stop', status: 'cancelled' };
    }
    const decision = interpretPauseReply(reply, plan.payload);
    if (decision.kind === 'cancel' || decision.kind === 'expired') {
      await host.setNode(ctx, nodeId, { ...state, status: 'skipped' });
      return { kind: 'stop', status: 'cancelled' };
    }
    if (decision.kind === 'accept') {
      const outputs = acceptedOutputs(plan, values, decision);
      ctx.outputs.set(nodeId, outputs);
      await host.setNode(ctx, nodeId, { ...state, status: 'done', outputs });
      return { kind: 'continue' };
    }
    const rejections = (state.rejections ?? 0) + 1;
    if (rejections >= MAX_REJECTIONS) {
      await host.setNode(ctx, nodeId, { ...state, status: 'skipped', rejections });
      return { kind: 'stop', status: 'cancelled', error: 'Rejected twice at the checkpoint.' };
    }
    const ran = await host.runOnce(ctx, nodeId, def, { ...state, rejections }, decision.note);
    if (ran.kind === 'stop') return ran;
    state = ran.state;
  }
}
