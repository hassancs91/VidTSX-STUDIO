// run_flow (W8 Stage 4, flows plan §0.1 items 5, 6 and 11, decision 13): the
// Studio agent runs an installed flow on a shot range. A second tool beside
// the shared registry's `run_flow` — same runner (`flowService`), the
// PROJECT's brand, and a range rendered to a clip (`flow-range.ts`) that is
// passed as the flow's `video` param. The `video` output is imported into the
// project the way `generate_video`'s clip is (import-on-use) and the answer
// names the asset id plus the `insert_asset` call that proposes it as B-roll
// at the range's start — W3's existing 'insert-plan' card, no new proposal
// kind. The prompt rule (name the flow and the cost first) lives in
// `studio-agent-prompt-tools.ts`; the listing with the priced steps rides the
// description here, the same text the Agents side sees.

import fs from 'fs/promises';
import path from 'path';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { missingRequiredParams } from '../../../../shared/flows/params';
import type { FlowRunEvent } from '../../../../shared/types/flows';
import { getTempDir } from '../../../utils/paths';
import { installedFlowsListing, pricedSummary } from '../../agents/tools/flow-listing';
import { getNode } from '../../agents/tools/registry-core';
import { collectRunOutputs } from '../../agents/tools/run-flow-outputs';
import { flowService, loadFlowDoc, resolveFlowRef } from '../../flows/flow-service';
import { loadProject } from '../project-store';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { planRange, renderRangeClip, type ShotRange } from './flow-range';
import { importLibraryFile } from './library-import';
import { emitProgress, emitTool, errorText, readProjectBrandId, text, type StudioTool, type StudioToolContext } from './types';

const RULES =
  'Run an installed flow on this project, unattended, with the project\'s brand. Pass `range` to render a stretch of the master track to a clip and hand it to the flow\'s video param: `{ fromShot, toShot }` counts the media clips on the master video track from 1 in timeline order (what "shot 7" means after an auto-cut), or `{ fromSec, toSec }` in timeline seconds. ' +
  'BEFORE calling: tell the user which flow you are running and what it will cost (its "Priced steps" line; say "free" when there are none). The call WAITS (minutes for video). ' +
  'A video result is imported into the project and the answer names the asset id — place it with insert_asset (lane "broll") at the `at` the answer gives. Installed flows:\n';

const rangeSchema = z.union([
  z.object({ fromShot: z.number().int().min(1), toShot: z.number().int().min(1) }),
  z.object({ fromSec: z.number().min(0), toSec: z.number().min(0) }),
]);

export function buildFlowTools(ctx: StudioToolContext): StudioTool[] {
  const { req, signal } = ctx;

  const runFlow = tool(
    'run_flow',
    RULES + installedFlowsListing(),
    {
      flowId: z.string().describe('The flow id from the list, or its exact name'),
      params: z.record(z.string(), z.unknown()).optional().describe('Values for the flow\'s params by param id (the video param is filled from `range`)'),
      range: rangeSchema.optional().describe('The shot or time range to render as the flow\'s video input'),
    },
    async (args) => {
      emitTool(ctx, 'run_flow', args.flowId);
      const ref = resolveFlowRef(args.flowId);
      if ('error' in ref) return text(ref.error, true);
      const { doc } = loadFlowDoc(ref.id);
      const params: Record<string, unknown> = { ...(args.params ?? {}) };
      const videoParam = doc.params.find((p) => p.kind === 'video');

      let plan: ReturnType<typeof planRange> | null = null;
      try {
        if (args.range) {
          if (!videoParam) return text(`"${doc.name}" has no video param, so a range cannot feed it — run it without \`range\`.`, true);
          plan = planRange(await loadProject(req.projectId), args.range as ShotRange);
          if (typeof plan === 'string') return text(plan, true);
          emitProgress(ctx, 'run_flow', `Rendering ${plan.label} to a clip…`);
          const outDir = path.join(getTempDir(), 'flow-range');
          await fs.mkdir(outDir, { recursive: true });
          params[videoParam.id] = await renderRangeClip(plan, outDir, `${req.projectId}-${Date.now().toString(36)}.mp4`, {
            signal,
            onProgress: (f) => emitProgress(ctx, 'run_flow', `Rendering ${plan && typeof plan !== 'string' ? plan.label : 'range'} to a clip…`, Math.round(f * 100)),
          });
        }
        const missing = missingRequiredParams(doc.params, params);
        if (missing.length > 0) {
          return text(`"${doc.name}" needs ${missing.map((p) => `${p.id} (${p.label})`).join(', ')}${videoParam && missing.includes(videoParam) ? ' — pass `range` for the video' : ''}.`, true);
        }

        const brandId = await readProjectBrandId(req.projectId);
        const { runId } = await flowService.start({ flowId: ref.id, mode: 'unattended', params, brandId: brandId ?? null });
        const labelOf = (nodeId: string): string => {
          const node = doc.graph.nodes.find((n) => n.id === nodeId);
          return (node && getNode(node.toolId)?.ports?.label) ?? node?.toolId ?? nodeId;
        };
        const unsubscribe = flowService.onEvent((event: FlowRunEvent) => {
          if (event.runId !== runId || event.kind !== 'node-status') return;
          if (event.state.status === 'running' || event.state.status === 'done') emitProgress(ctx, 'run_flow', `${labelOf(event.nodeId)}: ${event.state.status}`);
        });
        const onAbort = () => {
          flowService.cancel(runId);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          await flowService.wait(runId);
        } finally {
          unsubscribe();
          signal.removeEventListener('abort', onAbort);
        }
        const view = await flowService.get(runId);
        if (view.run.status !== 'success') {
          const failed = Object.entries(view.run.nodes).find(([, s]) => s.status === 'error');
          return text(`"${doc.name}" ${view.run.status === 'cancelled' ? 'was cancelled' : 'failed'}${failed ? ` at "${labelOf(failed[0])}"` : ''}: ${view.run.error ?? 'no output was produced.'}`, true);
        }

        const lines: string[] = [`"${doc.name}" finished (run ${runId}). ${pricedSummary(doc)}`];
        let hinted = false;
        for (const { label, value } of collectRunOutputs(doc, view.run)) {
          if (value.kind !== 'artifact') {
            lines.push(`${label}: ${String(value.value)}`);
            continue;
          }
          const artifact = view.artifacts.find((a) => a.id === value.artifactId);
          if (!artifact) continue;
          if (artifact.kind === 'video') {
            const asset = await importLibraryFile(ctx, artifact.payload.relPath);
            const at = plan && typeof plan !== 'string' ? plan.timelineStart : 0;
            lines.push(
              `${label}: project asset id "${asset.id}" (${LIBRARY_REF_PREFIX}${artifact.payload.relPath}, ${artifact.payload.durationSeconds} s) — imported into the project.` +
                (hinted ? '' : ` Propose it as B-roll with insert_asset(assetId: "${asset.id}", lane: "broll", at: ${at}${plan && typeof plan !== 'string' ? `, note: "${doc.name} on ${plan.label}"` : ''}).`),
            );
            hinted = true;
          } else if (artifact.kind === 'image-set') {
            lines.push(`${label}: ${artifact.payload.items.map((i) => `${LIBRARY_REF_PREFIX}${i.relPath}`).join(', ')} (use as assetRefs in a shot, or insert_asset with the library ref).`);
          } else if (artifact.kind === 'audio') {
            lines.push(`${label}: ${LIBRARY_REF_PREFIX}${artifact.payload.relPath} (${artifact.payload.durationSeconds} s) — insert_asset(lane "audio") with the library ref.`);
          } else {
            lines.push(`${label}: ${artifact.kind} "${artifact.title}" (in the run's folder on the Flows page).`);
          }
        }
        return text(lines.join('\n'));
      } catch (err) {
        return text(`run_flow failed: ${errorText(err)}`, true);
      }
    },
  );

  return [runFlow];
}
