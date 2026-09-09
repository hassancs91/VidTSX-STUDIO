// Preset input validation + document normalisation (V1 completion plan §2.5).
// Pure — the main preset-store uses it on load/save, the renderer form for
// inline feedback. Mirrors shared/studio/brand.ts.

import {
  PRESET_BODY_MAX,
  PRESET_LEARNED_MAX,
  PRESET_STEP_IDS,
  type PresetStep,
  type PresetStepId,
  type StudioPreset,
  type StudioPresetCaptions,
  type StudioPresetLearned,
  type StudioPresetMusicBed,
  type StudioPresetOrientation,
  type StudioPresetPacing,
  type StudioPresetStyle,
  type StudioPresetVideoKind,
} from '../types/studio-preset';

/** What the user authors — id/timestamps are the store's business. */
export interface StudioPresetInput {
  name: string;
  description?: string;
  videoKind: StudioPresetVideoKind;
  orientation?: StudioPresetOrientation;
  defaultBrandId?: string;
  workflow: PresetStep[];
  style: StudioPresetStyle;
  /** PRESET.md, verbatim. */
  body: string;
}

export const PRESET_DESCRIPTION_MAX = 300;
const TRANSITIONS_MAX = 10;
const TRANSITION_CHARS_MAX = 40;
const PARAM_CHARS_MAX = 80;

const VIDEO_KINDS: readonly StudioPresetVideoKind[] = ['short', 'long', 'course', 'custom'];
const ORIENTATIONS: readonly StudioPresetOrientation[] = ['16:9', '9:16', '1:1'];
const PACINGS: readonly StudioPresetPacing[] = ['tight', 'normal', 'relaxed'];
const MUSIC_BEDS: readonly StudioPresetMusicBed[] = ['none', 'quiet', 'present'];
const CAPTIONS: readonly StudioPresetCaptions[] = ['none', 'karaoke', 'block'];
const AGGRESSIVENESS = ['light', 'normal', 'aggressive'] as const;
const BROLL_SOURCES = ['generate', 'library'] as const;

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function isStepId(value: unknown): value is PresetStepId {
  return oneOf(PRESET_STEP_IDS, value);
}

/** A finite number in [min, max], else undefined. */
function boundedNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function cleanParam(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > PARAM_CHARS_MAX || /[\n\r]/.test(trimmed)) return undefined;
  return trimmed;
}

/** One parsed step, or null when the id is unknown. Unknown params drop. */
export function normalizePresetStep(raw: unknown): PresetStep | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const step = raw as Record<string, unknown>;
  if (!isStepId(step.id)) return null;
  switch (step.id) {
    case 'transcribe': {
      const engine = cleanParam(step.engine);
      return { id: 'transcribe', ...(engine ? { engine } : {}) };
    }
    case 'auto_cut':
      return {
        id: 'auto_cut',
        ...(oneOf(AGGRESSIVENESS, step.aggressiveness) ? { aggressiveness: step.aggressiveness } : {}),
      };
    case 'shots': {
      const cadence = boundedNumber(step.cadence, 0, 30);
      return { id: 'shots', ...(cadence !== undefined ? { cadence } : {}) };
    }
    case 'broll':
      return { id: 'broll', ...(oneOf(BROLL_SOURCES, step.source) ? { source: step.source } : {}) };
    case 'captions': {
      const template = cleanParam(step.template);
      return { id: 'captions', ...(template ? { template } : {}) };
    }
    case 'export': {
      const renderPreset = cleanParam(step.renderPreset);
      return { id: 'export', ...(renderPreset ? { renderPreset } : {}) };
    }
    default:
      return { id: step.id };
  }
}

/** Steps in the given order, unknown ids dropped, each id at most once. */
export function normalizePresetWorkflow(raw: unknown): PresetStep[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<PresetStepId>();
  const steps: PresetStep[] = [];
  for (const item of raw) {
    const step = normalizePresetStep(item);
    if (!step || seen.has(step.id)) continue;
    seen.add(step.id);
    steps.push(step);
  }
  return steps;
}

export function normalizePresetStyle(raw: unknown): StudioPresetStyle {
  if (typeof raw !== 'object' || raw === null) return {};
  const s = raw as Record<string, unknown>;
  const style: StudioPresetStyle = {};
  if (oneOf(PACINGS, s.pacing)) style.pacing = s.pacing;
  const shots = boundedNumber(s.shotsPerMinute, 0, 30);
  if (shots !== undefined) style.shotsPerMinute = shots;
  const sfx = boundedNumber(s.sfxPerMinute, 0, 60);
  if (sfx !== undefined) style.sfxPerMinute = sfx;
  if (oneOf(MUSIC_BEDS, s.musicBed)) style.musicBed = s.musicBed;
  if (oneOf(CAPTIONS, s.captions)) style.captions = s.captions;
  if (Array.isArray(s.transitions)) {
    // An explicit [] is a knob ("hard cuts only"), not an absent one — the
    // learned diff writes it and the prompt says "no transitions" for it.
    style.transitions = s.transitions
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t !== '' && t.length <= TRANSITION_CHARS_MAX)
      .slice(0, TRANSITIONS_MAX);
  }
  const intro = boundedNumber(s.introSeconds, 0, 120);
  if (intro !== undefined) style.introSeconds = intro;
  const outro = boundedNumber(s.outroSeconds, 0, 120);
  if (outro !== undefined) style.outroSeconds = outro;
  return style;
}

function normalizeLearned(raw: unknown): StudioPresetLearned[] {
  if (!Array.isArray(raw)) return [];
  const out: StudioPresetLearned[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const l = item as Record<string, unknown>;
    if (typeof l.projectId !== 'string' || typeof l.at !== 'string' || typeof l.summary !== 'string') continue;
    out.push({ projectId: l.projectId, at: l.at, summary: l.summary.trim() });
  }
  return out.slice(-PRESET_LEARNED_MAX);
}

/** Validate what the user typed; returns human-readable problems ([] = ok). */
export function validatePresetInput(input: StudioPresetInput): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2) {
    errors.push('Preset name must be at least 2 characters.');
  }
  if (!oneOf(VIDEO_KINDS, input.videoKind)) {
    errors.push('Video kind must be short, long, course or custom.');
  }
  if (input.orientation !== undefined && !oneOf(ORIENTATIONS, input.orientation)) {
    errors.push('Orientation must be 16:9, 9:16 or 1:1.');
  }
  if ((input.description ?? '').length > PRESET_DESCRIPTION_MAX) {
    errors.push(`The description is limited to ${PRESET_DESCRIPTION_MAX} characters.`);
  }
  if (!Array.isArray(input.workflow)) {
    errors.push('The workflow must be a list of steps.');
  } else {
    const ids = new Set<string>();
    for (const step of input.workflow) {
      if (!step || !isStepId(step.id)) {
        errors.push(`Unknown workflow step "${String((step as { id?: unknown })?.id)}".`);
        continue;
      }
      if (ids.has(step.id)) errors.push(`Workflow step "${step.id}" appears twice.`);
      ids.add(step.id);
    }
  }
  const style = input.style ?? {};
  if (style.pacing !== undefined && !oneOf(PACINGS, style.pacing)) errors.push('Pacing must be tight, normal or relaxed.');
  if (style.shotsPerMinute !== undefined && boundedNumber(style.shotsPerMinute, 0, 30) === undefined) errors.push('Shots per minute must be between 0 and 30.');
  if (style.sfxPerMinute !== undefined && boundedNumber(style.sfxPerMinute, 0, 60) === undefined) errors.push('SFX per minute must be between 0 and 60.');
  if (style.musicBed !== undefined && !oneOf(MUSIC_BEDS, style.musicBed)) errors.push('Music bed must be none, quiet or present.');
  if (style.captions !== undefined && !oneOf(CAPTIONS, style.captions)) errors.push('Captions must be none, karaoke or block.');
  if (style.introSeconds !== undefined && boundedNumber(style.introSeconds, 0, 120) === undefined) errors.push('Intro seconds must be between 0 and 120.');
  if (style.outroSeconds !== undefined && boundedNumber(style.outroSeconds, 0, 120) === undefined) errors.push('Outro seconds must be between 0 and 120.');
  if ((style.transitions ?? []).length > TRANSITIONS_MAX) errors.push(`At most ${TRANSITIONS_MAX} transitions.`);
  if (typeof input.body !== 'string') {
    errors.push('The preset body must be text.');
  } else if (input.body.length > PRESET_BODY_MAX) {
    errors.push(`PRESET.md is limited to ${PRESET_BODY_MAX} characters.`);
  }
  return errors;
}

/**
 * Normalise a parsed preset.json. The folder name is the id (folder-as-truth,
 * like brands). Returns null for documents too broken to use — the store
 * skips those with a warning instead of failing the whole listing.
 */
export function normalizePreset(raw: unknown, folderId: string): StudioPreset | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if (typeof doc.name !== 'string' || doc.name.trim() === '') return null;
  const now = new Date().toISOString();
  const learned = normalizeLearned(doc.learned);
  const description = typeof doc.description === 'string' ? doc.description.trim().slice(0, PRESET_DESCRIPTION_MAX) : '';
  const defaultBrandId = typeof doc.defaultBrandId === 'string' ? doc.defaultBrandId.trim() : '';
  return {
    id: folderId,
    name: doc.name.trim(),
    ...(description ? { description } : {}),
    videoKind: oneOf(VIDEO_KINDS, doc.videoKind) ? doc.videoKind : 'custom',
    ...(oneOf(ORIENTATIONS, doc.orientation) ? { orientation: doc.orientation } : {}),
    ...(defaultBrandId ? { defaultBrandId } : {}),
    workflow: normalizePresetWorkflow(doc.workflow),
    style: normalizePresetStyle(doc.style),
    ...(learned.length > 0 ? { learned } : {}),
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : now,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : now,
  };
}

/** The body as stored: LF line endings, trailing whitespace trimmed, capped. */
export function normalizePresetBody(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\r\n/g, '\n').trimEnd().slice(0, PRESET_BODY_MAX);
}
