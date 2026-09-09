// The compact one-line-per-step form of a preset workflow, used by the
// Presets dialog (typed like `auto_cut:aggressive`) and by the prompt block
// (read like `3. shots (cadence 4/min)`). Pure and round-trippable:
// formatWorkflowLines(parseWorkflowLines(text).steps) reproduces the text
// for every valid line.

import { normalizePresetStep } from './preset';
import { PRESET_STEP_IDS, type PresetStep, type PresetStepId } from '../types/studio-preset';

/** The compact `id[:param]` line for one step. */
export function formatWorkflowLine(step: PresetStep): string {
  switch (step.id) {
    case 'transcribe':
      return step.engine ? `transcribe:${step.engine}` : 'transcribe';
    case 'auto_cut':
      return step.aggressiveness ? `auto_cut:${step.aggressiveness}` : 'auto_cut';
    case 'shots':
      return step.cadence !== undefined ? `shots:${step.cadence}` : 'shots';
    case 'broll':
      return step.source ? `broll:${step.source}` : 'broll';
    case 'captions':
      return step.template ? `captions:${step.template}` : 'captions';
    case 'export':
      return step.renderPreset ? `export:${step.renderPreset}` : 'export';
    default:
      return step.id;
  }
}

export function formatWorkflowLines(steps: readonly PresetStep[]): string {
  return steps.map(formatWorkflowLine).join('\n');
}

export interface ParsedWorkflowLines {
  steps: PresetStep[];
  /** Human-readable problems, one per bad line ([] = every line parsed). */
  errors: string[];
}

/** Parse the compact form; blank lines and `#` comments are skipped. */
export function parseWorkflowLines(text: string): ParsedWorkflowLines {
  const steps: PresetStep[] = [];
  const errors: string[] = [];
  const seen = new Set<PresetStepId>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const at = line.indexOf(':');
    const id = (at === -1 ? line : line.slice(0, at)).trim();
    const param = at === -1 ? undefined : line.slice(at + 1).trim();
    if (!(PRESET_STEP_IDS as readonly string[]).includes(id)) {
      errors.push(`Unknown step "${id}" — use one of ${PRESET_STEP_IDS.join(', ')}.`);
      continue;
    }
    const raw: Record<string, unknown> = { id };
    switch (id as PresetStepId) {
      case 'transcribe':
        if (param) raw.engine = param;
        break;
      case 'auto_cut':
        if (param) raw.aggressiveness = param;
        break;
      case 'shots':
        if (param) raw.cadence = Number(param);
        break;
      case 'broll':
        if (param) raw.source = param;
        break;
      case 'captions':
        if (param) raw.template = param;
        break;
      case 'export':
        if (param) raw.renderPreset = param;
        break;
      default:
        break;
    }
    const step = normalizePresetStep(raw);
    if (!step) {
      errors.push(`Could not read "${line}".`);
      continue;
    }
    // A param the normaliser dropped was invalid — say so instead of silently
    // running the step without it.
    if (param && formatWorkflowLine(step) === id) {
      errors.push(`"${line}": "${param}" is not a valid value for ${id}.`);
      continue;
    }
    if (seen.has(step.id)) {
      errors.push(`Step "${step.id}" appears twice.`);
      continue;
    }
    seen.add(step.id);
    steps.push(step);
  }
  return { steps, errors };
}

/** The prose form the agent reads: `auto_cut (aggressive)`. */
export function describeWorkflowStep(step: PresetStep): string {
  switch (step.id) {
    case 'transcribe':
      return step.engine ? `transcribe (engine ${step.engine})` : 'transcribe';
    case 'auto_cut':
      return step.aggressiveness ? `auto_cut (${step.aggressiveness})` : 'auto_cut';
    case 'editorial':
      return 'editorial pass (propose_cuts)';
    case 'shots':
      return step.cadence !== undefined ? `shots (about ${step.cadence} per minute)` : 'shots';
    case 'broll':
      return step.source ? `b-roll (${step.source === 'library' ? 'from the library first' : 'generate'})` : 'b-roll';
    case 'sfx':
      return 'sound effects';
    case 'music':
      return 'music bed';
    case 'captions':
      return step.template ? `captions (template ${step.template})` : 'captions';
    case 'export':
      return step.renderPreset ? `export (${step.renderPreset})` : 'export';
    default:
      return String((step as { id: string }).id);
  }
}
