// The preset half of a `.vidtsx` package (V1 completion plan §2.5, the Q7f
// brand pattern): what travels as preset.json, and how the import dialog's
// offer is applied. `settings.presetId` names a MACHINE-LOCAL preset, so the
// package carries a snapshot (knobs, workflow, PRESET.md) and the far side
// chooses: match one of its own presets, create this one, or none.

import type { StudioPreset, StudioPresetEntry } from '../../../shared/types/studio-preset';
import { normalizePreset, normalizePresetBody } from '../../../shared/studio/preset';
import { createPreset } from '../library/preset-store';
import { getLibraryRoot } from '../library/library-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ProjectPackagePreset');

/** What travels: no id, no timestamps, no defaultBrandId (machine-local),
 *  no learned log (project ids) — the learned notes are already in the body. */
export function buildPresetSnapshot(preset: StudioPresetEntry): Record<string, unknown> {
  return {
    name: preset.name,
    ...(preset.description ? { description: preset.description } : {}),
    videoKind: preset.videoKind,
    ...(preset.orientation ? { orientation: preset.orientation } : {}),
    workflow: preset.workflow,
    style: preset.style,
    body: preset.body,
  };
}

/** A package can put anything in preset.json — only a preset-shaped
 *  document with a string body reaches the dialog. */
export function readPresetSnapshot(raw: unknown): StudioPresetEntry | null {
  const preset: StudioPreset | null = normalizePreset(raw, 'imported-preset');
  if (!preset) return null;
  const body = normalizePresetBody((raw as { body?: unknown }).body);
  return { ...preset, body };
}

/** What the user chose in the import dialog's preset offer. */
export type PresetChoice = { mode: 'match'; presetId: string } | { mode: 'create' } | { mode: 'none' };

export interface PresetOutcome {
  applied: PresetChoice['mode'];
  presetId?: string;
  error?: string;
}

export async function applyPresetChoice(choice: PresetChoice, snapshot: unknown): Promise<PresetOutcome> {
  if (choice.mode === 'none') return { applied: 'none' };
  if (choice.mode === 'match') return { applied: 'match', presetId: choice.presetId };
  const preset = readPresetSnapshot(snapshot);
  if (!preset) {
    return { applied: 'none', error: 'The package preset snapshot is unusable — no preset applied.' };
  }
  try {
    const created = await createPreset(getLibraryRoot(), {
      name: preset.name,
      ...(preset.description ? { description: preset.description } : {}),
      videoKind: preset.videoKind,
      ...(preset.orientation ? { orientation: preset.orientation } : {}),
      workflow: preset.workflow,
      style: preset.style,
      body: preset.body,
    });
    return { applied: 'create', presetId: created.id };
  } catch (err) {
    log.warn('Could not create a preset from the package snapshot', { error: String(err) });
    return { applied: 'none', error: 'Could not create a preset from the snapshot.' };
  }
}
