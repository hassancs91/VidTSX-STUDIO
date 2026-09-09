// The finishing steps (W3), all through the renderer action bridge because
// the document and the render queue are renderer-owned: set_captions (a
// reversible setting, applied directly), accept_proposal (exists ONLY so
// "apply it" in chat works without a click — the prompt restricts it to the
// user's explicit say-so) and export_project (queues the render; the
// existing queue row shows progress).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { aspectOf } from '../../../../shared/studio/caption-pack';
import { EXPORT_ENGINES, isExportEngineId } from '../../../../shared/studio/export-engines';
import { agentActions } from '../agent-actions';
import { listCaptionTemplates } from '../caption-packs';
import { loadProject } from '../project-store';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

const POSITIONS = ['bottom', 'center', 'top'] as const;

export function buildDeliveryTools(ctx: StudioToolContext): StudioTool[] {
  const { req, state } = ctx;

  const setCaptions = tool(
    'set_captions',
    'Turn word-synced captions on (or off) for the whole edit, derived from the footage transcripts at render time. Applies directly as one undo step — use it when the user asked for captions or the workflow they requested includes them. Omit templateId to keep the current template (or the default pack style); an unknown id lists the installed templates.',
    {
      templateId: z.string().optional().describe('Namespaced caption template id, e.g. "core/word-pop"'),
      enabled: z.boolean().optional().describe('Default true; false hides captions without losing the style'),
      position: z.enum(POSITIONS).optional(),
      wordsPerGroup: z.number().int().min(1).max(6).optional(),
      uppercase: z.boolean().optional(),
    },
    async (args) => {
      emitTool(ctx, 'set_captions', args.enabled === false ? 'off' : (args.templateId ?? req.captions?.templateId ?? 'default'));
      try {
        const templates = await listCaptionTemplates();
        if (templates.length === 0) return text('No caption templates are installed.', true);
        const wanted = args.templateId ?? req.captions?.templateId ?? templates.find((t) => t.packId === 'core')?.templateId ?? templates[0].templateId;
        const template = templates.find((t) => t.templateId === wanted);
        if (!template) {
          return text(`Unknown caption template "${wanted}". Installed: ${templates.map((t) => `${t.templateId} (${t.name})`).join(', ')}.`, true);
        }
        const settings = (await loadProject(req.projectId)).settings;
        const seed = template.defaults?.[aspectOf(settings.width, settings.height)];
        const style = {
          ...(args.position ? { position: args.position } : {}),
          ...(args.wordsPerGroup !== undefined ? { wordsPerGroup: args.wordsPerGroup } : {}),
          ...(args.uppercase !== undefined ? { uppercase: args.uppercase } : {}),
        };
        const result = await agentActions.request(
          req.projectId,
          {
            type: 'set-captions',
            templateId: template.templateId,
            enabled: args.enabled ?? true,
            ...(seed ? { seed } : {}),
            ...(Object.keys(style).length > 0 ? { style } : {}),
          },
          ctx.emit,
          ctx.signal,
        );
        return text(result.success ? (result.message ?? 'Captions updated.') : `Captions could not be set: ${result.error ?? 'unknown error'}`, !result.success);
      } catch (err) {
        return text(`Captions failed: ${errorText(err)}`, true);
      }
    },
  );

  const acceptProposal = tool(
    'accept_proposal',
    'Apply the open review-panel proposal (cuts, shots or an insert) with its accepted items — ONLY when the user\'s latest message explicitly says to apply it ("apply it", "go ahead", "yes, place them"). Never call it on your own judgment; the card still shows what was applied, and Ctrl+Z undoes it.',
    {
      proposalId: z.string().describe('The open proposal\'s id (from the prompt, or the tool that created it this turn)'),
    },
    async (args) => {
      emitTool(ctx, 'accept_proposal', args.proposalId);
      const open = req.openProposal?.id === args.proposalId || state.proposalId === args.proposalId;
      if (!open) {
        return text(
          req.openProposal || state.proposalId
            ? `"${args.proposalId}" is not the open proposal (open: ${state.proposalId ?? req.openProposal?.id}).`
            : 'No proposal is open in the review panel.',
          true,
        );
      }
      const result = await agentActions.request(
        req.projectId,
        { type: 'apply-proposal', proposalId: args.proposalId },
        ctx.emit,
        ctx.signal,
      );
      if (!result.success) return text(`Could not apply the proposal: ${result.error ?? 'unknown error'}`, true);
      // The panel is free again — a later tool this turn may propose.
      if (state.proposalId === args.proposalId) state.proposalId = null;
      return text(`${result.message ?? 'Applied.'} (One undo step — Ctrl+Z reverts it.)`);
    },
  );

  const exportProject = tool(
    'export_project',
    `Queue the current edit for export as an MP4 in the render queue (the queue row shows progress; the user finds the file there). Call it only when the user asked to export/render. Engines: ${EXPORT_ENGINES.map((e) => `"${e.id}" (${e.label})`).join(', ')}; omit for the default.`,
    {
      engine: z.string().optional().describe('Export engine id'),
    },
    async (args) => {
      emitTool(ctx, 'export_project', args.engine ?? 'default engine');
      if (args.engine !== undefined && !isExportEngineId(args.engine)) {
        return text(`Unknown export engine "${args.engine}". Use one of: ${EXPORT_ENGINES.map((e) => e.id).join(', ')}.`, true);
      }
      if ((req.timelineDurationSeconds ?? 0) <= 0 && state.proposalId === null && state.importedAssets.size === 0) {
        return text('The timeline is empty — there is nothing to export yet.', true);
      }
      const jobId = `render_agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const result = await agentActions.request(
        req.projectId,
        { type: 'export', jobId, ...(args.engine !== undefined && isExportEngineId(args.engine) ? { engineId: args.engine } : {}) },
        ctx.emit,
        ctx.signal,
      );
      if (!result.success) return text(`Export could not be queued: ${result.error ?? 'unknown error'}`, true);
      return text(`${result.message ?? 'Export queued.'} Render job id: ${jobId}. Tell the user the render queue shows its progress; do not wait for it here.`);
    },
  );

  return [setCaptions, acceptProposal, exportProject];
}
