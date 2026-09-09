// "Learn from this video" (V1 completion plan §2.5): deterministic timeline
// stats + ONE LLM summary of what the user did by hand versus what the agent
// proposed → a pending `propose_preset_update` card. Nothing is written
// here — accept (preset-learn-handlers.ts) is the only path that touches the
// preset, the memory design's "nothing inferred silently" rule.
//
// Two callers, one service: the Inspector button hands in the LIVE document
// (the renderer owns it; the 600 ms save debounce may lag), the chat tool
// loads it from disk.

import type { StudioProject } from '../../../shared/types/studio';
import type { StudioPresetEntry, StudioPresetUpdateProposal } from '../../../shared/types/studio-preset';
import { logEngine } from '../../../logging/log-engine';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { getLibraryRoot } from '../library/library-paths';
import { readPreset } from '../library/preset-store';
import { describePresetStyle } from './agent-preset-prompt';
import { addPresetProposal } from './agent-preset-proposals';
import { buildLearnedSection, formatKnobChange, formatStatsLines, formatStatsSummary } from './preset-learn-format';
import { applyKnobChanges, computeLearnStats, diffPresetKnobs } from './preset-learn-stats';
import { loadProject } from './project-store';

const log = logEngine.createLogger('LearnFromProject');

const SUMMARY_SYSTEM_PROMPT =
  'You write one or two plain sentences (at most 60 words) for a video editor\'s preset notes: what the user did by hand versus what the assistant proposed, and what this edit says about how they like this kind of video cut. Use the numbers you are given; no headers, no lists, no preamble.';

export interface LearnFromProjectInput {
  projectId: string;
  /** The live document (Inspector button). Absent = read from disk (chat). */
  project?: StudioProject;
  /** A summary the agent already wrote — skips the LLM call. */
  summary?: string;
  note?: string;
  providerId?: string;
  model?: string;
  signal?: AbortSignal;
  /** Test seam: the summary call. Defaults to the LLM engine. */
  summarize?: (prompt: string) => Promise<string | null>;
  now?: () => Date;
}

export type LearnFromProjectResult =
  | { ok: true; proposal: StudioPresetUpdateProposal }
  | { ok: false; error: string };

async function llmSummary(prompt: string, input: LearnFromProjectInput): Promise<string | null> {
  try {
    const res = await runLlmGenerate(
      {
        prompt,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        maxTurns: 1,
        maxTokens: 300,
        featureSource: 'auto-cut',
        ...(input.providerId ? { providerId: input.providerId } : {}),
        ...(input.model ? { model: input.model } : {}),
      },
      input.signal,
    );
    const text = res.success ? res.text?.trim() : undefined;
    if (!text) {
      log.warn('Preset summary call returned nothing', { error: res.error });
      return null;
    }
    return text.replace(/\s+/g, ' ').slice(0, 600);
  } catch (err) {
    log.warn('Preset summary call failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function summaryPrompt(project: StudioProject, preset: StudioPresetEntry, lines: string[], changes: string[]): string {
  return [
    `Project "${project.name}" was edited on the preset "${preset.name}" (${preset.videoKind}${preset.orientation ? `, ${preset.orientation}` : ''}).`,
    `Measured on the finished timeline:`,
    ...lines.map((l) => `- ${l}`),
    `Preset knobs before: ${describePresetStyle(preset.style) || 'none set'}.`,
    changes.length > 0 ? `Knob changes the numbers justify: ${changes.join('; ')}.` : 'The numbers match the preset — no knob changes.',
  ].join('\n');
}

export async function learnFromProject(input: LearnFromProjectInput): Promise<LearnFromProjectResult> {
  let project: StudioProject;
  try {
    project = input.project ?? (await loadProject(input.projectId));
  } catch (err) {
    return { ok: false, error: `Could not read the project: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (project.id !== input.projectId) return { ok: false, error: 'The document does not belong to this project.' };
  const presetId = project.settings.presetId;
  if (!presetId) {
    return { ok: false, error: 'This project has no editing preset to learn into — pick one in the Inspector (beside the brand) first.' };
  }
  const preset = await readPreset(getLibraryRoot(), presetId);
  if (!preset) {
    return { ok: false, error: `The project preset "${presetId}" no longer exists in the library — pick another in the Inspector.` };
  }

  const stats = computeLearnStats(project);
  if (stats.totalSeconds <= 0) return { ok: false, error: 'The timeline is empty — there is nothing to learn from yet.' };
  const changes = diffPresetKnobs(preset.style, stats);
  const lines = formatStatsLines(stats);
  const changeLines = changes.map(formatKnobChange);

  let summary = input.summary?.trim() || null;
  let summaryFallback = false;
  if (!summary) {
    const summarize = input.summarize ?? ((prompt: string) => llmSummary(prompt, input));
    summary = await summarize(summaryPrompt(project, preset, lines, changeLines));
  }
  if (!summary) {
    summary = formatStatsSummary(stats);
    summaryFallback = true;
  }

  const date = (input.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const learnedSection = buildLearnedSection({ projectName: project.name, date, summary, stats, changes });
  try {
    const proposal = addPresetProposal({
      projectId: project.id,
      projectName: project.name,
      presetId: preset.id,
      presetName: preset.name,
      stats,
      statsSummary: formatStatsSummary(stats),
      summary,
      ...(summaryFallback ? { summaryFallback: true } : {}),
      knobChanges: changes,
      proposedStyle: applyKnobChanges(preset.style, changes),
      learnedSection,
      ...(input.note ? { note: input.note } : {}),
    });
    log.info('Preset-update card queued', { projectId: project.id, presetId: preset.id, changes: changes.length, summaryFallback });
    return { ok: true, proposal };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
