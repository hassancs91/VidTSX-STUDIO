// The preset as the agent reads it in full (`get_preset`, V1 completion plan
// §2.5): the header the prompt block carries, then the WHOLE body and every
// preset skill, then the learned log — the prompt only carries the opening
// when the body is long.

import type { StudioPresetEntry } from '../../../shared/types/studio-preset';
import { describeWorkflowStep } from '../../../shared/studio/preset-workflow-lines';
import { describePresetStyle } from '../studio/agent-preset-prompt';

export interface PresetSummaryOptions {
  skills?: Array<{ name: string; body: string }>;
}

export function formatPresetSummary(preset: StudioPresetEntry, options: PresetSummaryOptions = {}): string {
  const lines = [
    `Preset "${preset.name}" (id ${preset.id}) — ${preset.videoKind}${preset.orientation ? `, ${preset.orientation}` : ''}`,
  ];
  if (preset.description) lines.push(preset.description);
  if (preset.defaultBrandId) lines.push(`Default brand: ${preset.defaultBrandId}`);
  lines.push(
    preset.workflow.length > 0
      ? `Workflow:\n${preset.workflow.map((s, i) => `${i + 1}. ${describeWorkflowStep(s)}`).join('\n')}`
      : 'Workflow: none set',
  );
  const knobs = describePresetStyle(preset.style);
  lines.push(knobs ? `Style knobs: ${knobs}` : 'Style knobs: none set');
  lines.push(preset.body.trim() ? `PRESET.md:\n${preset.body.trim()}` : 'PRESET.md: empty');
  for (const skill of options.skills ?? []) {
    lines.push(`Preset skill "${skill.name}":\n${skill.body.trim()}`);
  }
  if (preset.learned && preset.learned.length > 0) {
    lines.push(
      `Learned from ${preset.learned.length} video${preset.learned.length === 1 ? '' : 's'}:\n${preset.learned
        .map((l) => `- ${l.at.slice(0, 10)} · ${l.projectId}: ${l.summary}`)
        .join('\n')}`,
    );
  }
  return lines.join('\n\n');
}
