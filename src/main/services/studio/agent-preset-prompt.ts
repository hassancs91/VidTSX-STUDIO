// PURE preset-block composition (V1 completion plan §2.5) — (preset, skills,
// budget) → the "## Editing preset: <name>" section of the Studio system
// prompt. Sits AFTER the skills and BEFORE the memory block (the middle slot
// of composeSystemPrompt). Deterministic on purpose, the memory-block rule:
// the block rides the cached prompt prefix, so no timestamps, no Set
// iteration, nothing that changes between turns.
//
// Budget: the header, workflow and knob lines always ride (they are what the
// agent follows); the body is cut at a paragraph boundary when the whole
// would exceed PRESET_PROMPT_BUDGET, with a visible marker pointing at
// `get_preset` — no silent truncation (§5 question 4 keeps the budget at
// 4 000 until adherence is measured).

import { PRESET_PROMPT_BUDGET, type StudioPresetEntry, type StudioPresetStyle } from '../../../shared/types/studio-preset';
import { describeWorkflowStep } from '../../../shared/studio/preset-workflow-lines';

export interface PresetSkillText {
  name: string;
  body: string;
}

export interface ComposePresetBlockOptions {
  skills?: PresetSkillText[];
  /** Character budget — defaults to PRESET_PROMPT_BUDGET. */
  budget?: number;
}

export interface ComposedPresetBlock {
  block: string;
  /** Characters of body/skills text cut to fit the budget (0 = whole). */
  truncatedBy: number;
}

const TRUNCATION_MARKER =
  '(… the rest of this preset was cut for length — call `get_preset` to read it in full before a full edit.)';

const KIND_LABEL: Record<StudioPresetEntry['videoKind'], string> = {
  short: 'a short',
  long: 'a long-form video',
  course: 'a course lesson',
  custom: 'a custom kind of video',
};

/** One prose line of the structured knobs; absent knobs are not mentioned. */
export function describePresetStyle(style: StudioPresetStyle): string {
  const parts: string[] = [];
  if (style.pacing) parts.push(`pacing ${style.pacing}`);
  if (style.shotsPerMinute !== undefined) parts.push(`about ${style.shotsPerMinute} shots per minute`);
  if (style.sfxPerMinute !== undefined) parts.push(`about ${style.sfxPerMinute} sound effects per minute`);
  if (style.musicBed) parts.push(`music bed ${style.musicBed}`);
  if (style.captions) parts.push(`captions ${style.captions}`);
  if (style.transitions) parts.push(style.transitions.length > 0 ? `transitions ${style.transitions.join(', ')}` : 'no transitions');
  if (style.introSeconds !== undefined) parts.push(`intro ${style.introSeconds} s`);
  if (style.outroSeconds !== undefined) parts.push(`outro ${style.outroSeconds} s`);
  return parts.join(' · ');
}

function headerLines(preset: StudioPresetEntry): string[] {
  const lines = [`## Editing preset: ${preset.name}`, ''];
  if (preset.description) lines.push(preset.description, '');
  const kind = `${KIND_LABEL[preset.videoKind]}${preset.orientation ? ` (${preset.orientation})` : ''}`;
  lines.push(`This project is ${kind}. This preset is the playbook: its workflow replaces the generic "edit this video" order, its knobs and instructions override the general policy where they disagree, and there is no run_preset tool — you run the steps with the tools you have, one review card at a time.`);
  if (preset.workflow.length > 0) {
    lines.push('', 'Workflow, in order:');
    preset.workflow.forEach((step, i) => lines.push(`${i + 1}. ${describeWorkflowStep(step)}`));
  } else {
    lines.push('', 'Workflow: none set — follow the generic order.');
  }
  const knobs = describePresetStyle(preset.style);
  lines.push('', knobs ? `Style knobs: ${knobs}.` : 'Style knobs: none set.');
  return lines;
}

/** Cut text to at most `max` chars at the last paragraph (or line) boundary. */
function cutAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const paragraph = slice.lastIndexOf('\n\n');
  if (paragraph > max * 0.5) return slice.slice(0, paragraph).trimEnd();
  const line = slice.lastIndexOf('\n');
  if (line > max * 0.5) return slice.slice(0, line).trimEnd();
  return slice.trimEnd();
}

export function composePresetBlock(
  preset: StudioPresetEntry,
  options: ComposePresetBlockOptions = {},
): ComposedPresetBlock {
  const budget = options.budget ?? PRESET_PROMPT_BUDGET;
  const head = headerLines(preset).join('\n');
  const bodyParts: string[] = [];
  const body = preset.body.trim();
  if (body) bodyParts.push(body);
  for (const skill of options.skills ?? []) {
    bodyParts.push(`### Preset skill: ${skill.name}\n\n${skill.body.trim()}`);
  }
  const text = bodyParts.join('\n\n');
  if (!text) return { block: head, truncatedBy: 0 };

  const separator = '\n\n';
  const room = budget - head.length - separator.length;
  if (text.length <= room) return { block: `${head}${separator}${text}`, truncatedBy: 0 };

  const roomWithMarker = room - separator.length - TRUNCATION_MARKER.length;
  const kept = roomWithMarker > 0 ? cutAtBoundary(text, roomWithMarker) : '';
  const block = kept
    ? `${head}${separator}${kept}${separator}${TRUNCATION_MARKER}`
    : `${head}${separator}${TRUNCATION_MARKER}`;
  return { block, truncatedBy: text.length - kept.length };
}
