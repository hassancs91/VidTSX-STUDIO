// Preset-update card IPC (W5) — the review gate for "learn from this video".
// Learn runs the same service the chat tool calls and pushes the card on the
// agent event stream; accept is the ONLY path that writes a preset from a
// measurement, against a fresh preset read (the form may have changed it
// since the card was minted). A write failure leaves the card pending.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioPresetLearnRequest,
  StudioPresetLearnResponse,
  StudioPresetProposalResolveRequest,
  StudioPresetProposalResolveResponse,
  StudioPresetProposalsGetRequest,
  StudioPresetProposalsGetResponse,
} from '../../shared/ipc/types';
import { getLibraryRoot } from '../services/library/library-paths';
import { applyPresetLearning, readPreset } from '../services/library/preset-store';
import {
  findPresetProposal,
  getPendingPresetProposals,
  hasPendingPresetProposal,
  removePresetProposal,
} from '../services/studio/agent-preset-proposals';
import { learnFromProject } from '../services/studio/learn-from-project';
import { studioAgent } from '../services/studio/studio-agent';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleStudioPresetLearn(
  _event: IpcMainInvokeEvent,
  data: StudioPresetLearnRequest,
): Promise<StudioPresetLearnResponse> {
  try {
    if (hasPendingPresetProposal(data.projectId)) {
      return { success: false, error: 'A preset-update card is already waiting in the Assistant tab — answer it first.' };
    }
    const agent = data.project.settings.agent;
    const result = await learnFromProject({
      projectId: data.projectId,
      project: data.project,
      ...(agent.providerId ? { providerId: agent.providerId } : {}),
      ...(agent.model ? { model: agent.model } : {}),
    });
    if (!result.ok) return { success: false, error: result.error };
    studioAgent.push({ projectId: data.projectId, kind: 'preset-update-proposal', proposal: result.proposal });
    return { success: true, proposal: result.proposal };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Could not learn from this project') };
  }
}

export async function handleStudioPresetProposalsGet(
  _event: IpcMainInvokeEvent,
  data: StudioPresetProposalsGetRequest,
): Promise<StudioPresetProposalsGetResponse> {
  return { success: true, proposals: getPendingPresetProposals(data.projectId) };
}

export async function handleStudioPresetProposalResolve(
  _event: IpcMainInvokeEvent,
  data: StudioPresetProposalResolveRequest,
): Promise<StudioPresetProposalResolveResponse> {
  const proposal = findPresetProposal(data.projectId, data.proposalId);
  if (!proposal) {
    return { success: false, error: 'That preset-update card is no longer pending.' };
  }
  if (data.action === 'reject') {
    removePresetProposal(data.projectId, data.proposalId);
    return { success: true };
  }
  try {
    const root = getLibraryRoot();
    const preset = await readPreset(root, proposal.presetId);
    if (!preset) {
      removePresetProposal(data.projectId, data.proposalId);
      return { success: false, error: 'The preset no longer exists — card discarded.' };
    }
    // The knobs are re-applied over the preset as it is NOW, so an edit made
    // in the form since the card was minted survives on every knob the card
    // does not touch.
    const style = { ...preset.style };
    for (const change of proposal.knobChanges) {
      (style as Record<string, unknown>)[change.key] = change.to;
    }
    await applyPresetLearning(root, proposal.presetId, {
      style,
      bodyAppend: proposal.learnedSection,
      learned: { projectId: proposal.projectId, at: new Date().toISOString(), summary: proposal.summary },
    });
    removePresetProposal(data.projectId, data.proposalId);
    return { success: true, presetName: preset.name, knobsChanged: proposal.knobChanges.length };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update the preset') };
  }
}
