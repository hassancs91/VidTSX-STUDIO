// Editing presets (W5): get_preset (the project's playbook in full) and
// propose_preset_update ("learn from this video" from chat — the same
// learn-from-project service the Inspector button calls, as a gated card).
// Main stamps the preset from project settings; the agent never names one.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getLibraryRoot } from '../../library/library-paths';
import { readPreset, readPresetSkills } from '../../library/preset-store';
import { formatPresetSummary } from '../../library/preset-summary';
import { hasPendingPresetProposal } from '../agent-preset-proposals';
import { learnFromProject } from '../learn-from-project';
import { loadProject } from '../project-store';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

const NO_PRESET =
  'This project has no editing preset. The user can pick one in the Inspector (beside the brand) or create one on the Assets screen; until then follow the generic workflow.';

export function buildPresetTools(ctx: StudioToolContext): StudioTool[] {
  const { req, state } = ctx;

  const getPreset = tool(
    'get_preset',
    "Read the project's editing preset in full: video kind, the workflow (the order you run a full edit in), the style knobs, the whole PRESET.md, its skills and its learned notes. The system prompt carries the opening; read this before a full edit when the preset section says it was cut for length.",
    {},
    async () => {
      emitTool(ctx, 'get_preset');
      try {
        const presetId = (await loadProject(req.projectId)).settings.presetId;
        if (!presetId) return text(NO_PRESET);
        const root = getLibraryRoot();
        const preset = await readPreset(root, presetId);
        if (!preset) return text(`The project preset "${presetId}" no longer exists in the library — ask the user to pick one in the Inspector.`);
        const skills = await readPresetSkills(root, presetId);
        return text(formatPresetSummary(preset, { skills }));
      } catch (err) {
        return text(`Could not read the preset: ${errorText(err)}`, true);
      }
    },
  );

  const proposePresetUpdate = tool(
    'propose_preset_update',
    'Learn from this video: measure the CURRENT timeline against the project\'s editing preset and put the differences on a card — knob changes with the numbers behind them and a "Learned from <project>" section for PRESET.md. Never applied directly: the user accepts the card. Pass `summary` (one or two sentences: what the user did by hand versus what you proposed) when you watched the edit; omit it and the tool writes one from the numbers. One card per turn.',
    {
      summary: z.string().optional().describe('One or two sentences on what the user did by hand versus what was proposed'),
      note: z.string().optional().describe('One line for the card header'),
    },
    async (args) => {
      emitTool(ctx, 'propose_preset_update');
      if (state.presetProposalCreated || hasPendingPresetProposal(req.projectId)) {
        return text("A preset-update card is already waiting for the user's decision. Do not propose another until they answer it.", true);
      }
      try {
        const result = await learnFromProject({
          projectId: req.projectId,
          ...(args.summary?.trim() ? { summary: args.summary.trim() } : {}),
          ...(args.note?.trim() ? { note: args.note.trim() } : {}),
          ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
          ...(req.model ? { model: req.model } : {}),
          signal: ctx.signal,
        });
        if (!result.ok) return text(result.error, true);
        state.presetProposalCreated = true;
        ctx.emit({ projectId: req.projectId, kind: 'preset-update-proposal', proposal: result.proposal });
        const changes = result.proposal.knobChanges.length;
        return text(
          `Preset-update card shown to the user for "${result.proposal.presetName}": ${changes} knob change${changes === 1 ? '' : 's'} and a "Learned from" section. ${result.proposal.statsSummary} Do not treat any of it as saved, and do not propose another card this turn.`,
        );
      } catch (err) {
        return text(errorText(err), true);
      }
    },
  );

  return [getPreset, proposePresetUpdate];
}
