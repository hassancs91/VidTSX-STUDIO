// Preset storage (V1 completion plan §2.5): `presets/<id>/preset.json` +
// `PRESET.md` (+ optional `skills/<id>/SKILL.md`) inside the assets root —
// real folders, visible in the Assets screen; the folder name IS the preset
// id. Every function takes the root explicitly (the brand-store convention)
// so everything tests against a plain temp dir.

import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import type { StudioPreset, StudioPresetEntry } from '../../../shared/types/studio-preset';
import {
  normalizePreset,
  normalizePresetBody,
  normalizePresetStyle,
  normalizePresetWorkflow,
  validatePresetInput,
  type StudioPresetInput,
} from '../../../shared/studio/preset';
import { loadAgentSkills, type AgentSkill } from '../agents/agent-skills';
import { reserveProjectFolder } from '../tsx-jobs/project-store';
import { resolveLibraryPath } from './library-paths';

const log = logEngine.createLogger('PresetStore');

export const PRESETS_DIR = 'presets';
export const PRESET_JSON_NAME = 'preset.json';
export const PRESET_BODY_NAME = 'PRESET.md';

export function getPresetFolder(root: string, presetId: string): string {
  // resolveLibraryPath guards traversal — a hostile id can't escape the root.
  return resolveLibraryPath(root, `${PRESETS_DIR}/${presetId}`);
}

/** Atomic write (tmp + rename), the brand.json pattern. */
async function writeAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function writePresetFiles(folder: string, preset: StudioPreset, body: string): Promise<void> {
  await writeAtomic(path.join(folder, PRESET_JSON_NAME), JSON.stringify(preset, null, 2));
  await writeAtomic(path.join(folder, PRESET_BODY_NAME), body);
}

/** All presets under presets/, sorted by name; corrupt folders skipped. */
export async function listPresets(root: string): Promise<StudioPresetEntry[]> {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, PRESETS_DIR), { withFileTypes: true });
  } catch {
    return []; // presets/ not created yet
  }
  const presets: StudioPresetEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const preset = await readPreset(root, entry.name);
    if (preset) presets.push(preset);
    else log.warn('Skipping unreadable preset folder', { folder: entry.name });
  }
  presets.sort((a, b) => a.name.localeCompare(b.name));
  return presets;
}

/** One preset by id (with its body), or null when missing/corrupt. A
 *  missing PRESET.md is an empty body, not a broken preset. */
export async function readPreset(root: string, presetId: string): Promise<StudioPresetEntry | null> {
  let folder: string;
  try {
    folder = getPresetFolder(root, presetId);
  } catch {
    return null;
  }
  try {
    const raw = await fs.readFile(path.join(folder, PRESET_JSON_NAME), 'utf-8');
    const preset = normalizePreset(JSON.parse(raw), presetId);
    if (!preset) return null;
    let body = '';
    try {
      body = normalizePresetBody(await fs.readFile(path.join(folder, PRESET_BODY_NAME), 'utf-8'));
    } catch {
      body = '';
    }
    return { ...preset, body };
  } catch {
    return null;
  }
}

/** The preset's own skills (`skills/<id>/SKILL.md`, the SKILLS.md folder
 *  format), in id order. Missing folder = []. */
export async function readPresetSkills(root: string, presetId: string): Promise<AgentSkill[]> {
  try {
    return await loadAgentSkills(getPresetFolder(root, presetId));
  } catch {
    return [];
  }
}

function fromInput(input: StudioPresetInput): Omit<StudioPreset, 'id' | 'createdAt' | 'updatedAt'> {
  const description = input.description?.trim();
  const defaultBrandId = input.defaultBrandId?.trim();
  return {
    name: input.name.trim(),
    ...(description ? { description } : {}),
    videoKind: input.videoKind,
    ...(input.orientation ? { orientation: input.orientation } : {}),
    ...(defaultBrandId ? { defaultBrandId } : {}),
    workflow: normalizePresetWorkflow(input.workflow),
    style: normalizePresetStyle(input.style),
  };
}

/** Create a new preset: reserve presets/<slug>/ from the name, write both files. */
export async function createPreset(root: string, input: StudioPresetInput): Promise<StudioPresetEntry> {
  const errors = validatePresetInput(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const presetsDir = path.join(root, PRESETS_DIR);
  const { name: presetId, folderPath } = await reserveProjectFolder(input.name, presetsDir);
  const now = new Date().toISOString();
  const preset: StudioPreset = { id: presetId, ...fromInput(input), createdAt: now, updatedAt: now };
  const body = normalizePresetBody(input.body);
  await writePresetFiles(folderPath, preset, body);
  return { ...preset, body };
}

/** Update a preset in place (id, createdAt and the learned log survive). */
export async function updatePreset(
  root: string,
  presetId: string,
  input: StudioPresetInput,
): Promise<StudioPresetEntry> {
  const errors = validatePresetInput(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const existing = await readPreset(root, presetId);
  if (!existing) throw new Error(`Preset not found: ${presetId}`);
  const { body: _oldBody, ...previous } = existing;
  const preset: StudioPreset = {
    ...previous,
    ...fromInput(input),
    updatedAt: new Date().toISOString(),
  };
  const body = normalizePresetBody(input.body);
  await writePresetFiles(getPresetFolder(root, presetId), preset, body);
  return { ...preset, body };
}

/** The "learn from this video" write: knobs patched, the learned section
 *  appended to the body, one learned-log entry. Everything else survives. */
export async function applyPresetLearning(
  root: string,
  presetId: string,
  change: {
    style: StudioPreset['style'];
    bodyAppend: string;
    learned: { projectId: string; at: string; summary: string };
  },
): Promise<StudioPresetEntry> {
  const existing = await readPreset(root, presetId);
  if (!existing) throw new Error(`Preset not found: ${presetId}`);
  const { body: oldBody, ...previous } = existing;
  const learned = [...(previous.learned ?? []), change.learned].slice(-20);
  const preset: StudioPreset = {
    ...previous,
    style: normalizePresetStyle(change.style),
    learned,
    updatedAt: change.learned.at,
  };
  const joined = oldBody.trim() === '' ? change.bodyAppend.trim() : `${oldBody.trimEnd()}\n\n${change.bodyAppend.trim()}`;
  const body = normalizePresetBody(joined);
  await writePresetFiles(getPresetFolder(root, presetId), preset, body);
  return { ...preset, body };
}

/**
 * Delete the preset folder (preset.json, PRESET.md and any skills/). The UI
 * confirms first. Projects pointing at the id fall back to no preset.
 */
export async function deletePreset(root: string, presetId: string): Promise<void> {
  await fs.rm(getPresetFolder(root, presetId), { recursive: true, force: true });
}
