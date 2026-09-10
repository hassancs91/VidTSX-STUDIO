// `run_flow` — an agent runs an installed flow (flows plan §1.5, §0.1 items
// 6 and 9, W8 Stage 4). Agent-only: no ports, so a flow cannot contain a flow.
//
// The run is UNATTENDED (decision 4) and inherits the calling session's brand
// (absent on the session = no brand, the W4 semantics). Node progress streams
// into the session as tool-progress events; the tool waits for the run and
// hands back the flow's `outputs` as drafts the tool server files into the
// session's store — copied, never linked (`run-flow-outputs.ts`). A flow that
// needs a capability the session lacks fails before anything runs, with the
// same message the run form shows (the runner's validation).
//
// The description is a GETTER: it carries the installed-flows listing with
// each flow's params and priced steps (`flow-listing.ts`), rebuilt only when a
// flow changes so the prompt prefix stays cacheable.

import path from 'path';
import { z } from 'zod';
import { missingRequiredParams } from '../../../../shared/flows/params';
import type { FlowRunEvent } from '../../../../shared/types/flows';
import { flowService, loadFlowDoc, resolveFlowRef } from '../../flows/flow-service';
import { flowRunStore, RUN_FILES_DIR } from '../../flows/flow-run-store';
import { installedFlowsListing, pricedSummary } from './flow-listing';
import { getNode } from './registry-core';
import { collectRunOutputs, copyRunOutputs } from './run-flow-outputs';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  flowId: z.string().describe('The flow to run — its id from the list below, or its exact name.'),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Values for the flow\'s params by param id. Media params take an absolute file path or a library entry id.'),
};

interface RunFlowArgs {
  flowId: string;
  params?: Record<string, unknown>;
}

const RULES =
  'Run one of the installed flows below, unattended, and get its outputs back as artifacts in this session. ' +
  'BEFORE calling: tell the user which flow you are about to run and what it will cost (its "Priced steps" line — say "free" when there are none). ' +
  'Flows take minutes; this call waits. Pass params by id. Installed flows:\n';

export const runFlowTool: AgentToolDef<RunFlowArgs> = {
  id: 'run_flow',
  get description(): string {
    // The listing reads the flows db; a registry read outside the app (the
    // pack checker, a unit test) must still see a description.
    try {
      return RULES + installedFlowsListing();
    } catch {
      return `${RULES}(the flow list could not be read)`;
    }
  },
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const ref = resolveFlowRef(args.flowId);
    if ('error' in ref) return toolText(ref.error, true);
    const { doc } = loadFlowDoc(ref.id);
    const params = args.params ?? {};
    const missing = missingRequiredParams(doc.params, params);
    if (missing.length > 0) {
      return toolText(`"${doc.name}" needs ${missing.map((p) => `${p.id} (${p.label})`).join(', ')} — pass them in params.`, true);
    }
    if (ctx.signal.aborted) return toolText('The turn was cancelled.', true);

    ctx.emitProgress(`Starting "${doc.name}"`);
    let runId: string;
    try {
      // The runner validates against the registry and the capabilities first
      // — an unmet `needs` gate is refused here, before any step runs.
      ({ runId } = await flowService.start({
        flowId: ref.id,
        mode: 'unattended',
        params,
        brandId: ctx.brandId ?? null,
      }));
    } catch (err) {
      return toolText(`"${doc.name}" could not start: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    const labelOf = (nodeId: string): string => {
      const node = doc.graph.nodes.find((n) => n.id === nodeId);
      return (node && getNode(node.toolId)?.ports?.label) ?? node?.toolId ?? nodeId;
    };
    const unsubscribe = flowService.onEvent((event: FlowRunEvent) => {
      if (event.runId !== runId) return;
      if (event.kind === 'node-status' && (event.state.status === 'running' || event.state.status === 'done' || event.state.status === 'error')) {
        ctx.emitProgress(`${labelOf(event.nodeId)}: ${event.state.status}${event.state.error ? ` — ${event.state.error}` : ''}`);
      }
    });
    const onAbort = () => {
      flowService.cancel(runId);
    };
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    try {
      await flowService.wait(runId);
    } finally {
      unsubscribe();
      ctx.signal.removeEventListener('abort', onAbort);
    }

    const view = await flowService.get(runId);
    if (view.run.status !== 'success') {
      const failed = Object.entries(view.run.nodes).find(([, s]) => s.status === 'error');
      const where = failed ? ` at "${labelOf(failed[0])}"` : '';
      return toolText(
        `"${doc.name}" ${view.run.status === 'cancelled' ? 'was cancelled' : 'failed'}${where}: ${view.run.error ?? 'no output was produced.'}`,
        true,
      );
    }

    const outputs = collectRunOutputs(doc, view.run);
    const copied = await copyRunOutputs({
      flowName: doc.name,
      runId,
      outputs,
      artifacts: view.artifacts,
      runWorkspace: path.join(flowRunStore.runDir(ref.id, runId), RUN_FILES_DIR),
      sessionWorkspace: ctx.workspaceDir,
    });
    const [first, ...rest] = copied.drafts;
    const seconds = view.run.finishedAt && view.run.startedAt ? Math.round((view.run.finishedAt - view.run.startedAt) / 1000) : undefined;
    const lines = [
      `"${doc.name}" finished${seconds !== undefined ? ` in ${seconds} s` : ''} (run ${runId}). ${pricedSummary(doc)}`,
      ...copied.primitives.map((p) => `${p.label}: ${p.text}`),
      ...(copied.drafts.length > 0
        ? [`Outputs filed as artifacts (ids follow): ${copied.drafts.map((d) => `${d.title} [${d.kind}]`).join(', ')}.`]
        : ['The flow produced no artifact outputs.']),
      ...(copied.missing.length > 0 ? [`Outputs without a file: ${copied.missing.join(', ')}.`] : []),
    ];
    return {
      ...toolText(lines.join('\n')),
      ...(first ? { artifact: first } : {}),
      ...(rest.length > 0 ? { extraArtifacts: rest } : {}),
    };
  },
};
