// Shot exemplar discovery (SHOT_QUALITY_DESIGN.md Q3a).
//
// Built-in exemplar shots — the quality bar the pipeline model reads before
// the shot contract. Folder-shaped exactly like caption packs (pack.json +
// manifest.json + <id>.tsx per exemplar) so the format becomes the "style
// pack" door later; v1 scans only the built-in root under resources/.
//
// Degrade rule: a corrupt or missing pack yields NO exemplars, never an error —
// shot generation must not fail because a bundled resource is bad.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type { StudioShotKind } from '../../../shared/types/studio';
import type { ShotExemplar } from '../../../shared/studio/shot-prompt';
import { getShotExemplarsDir } from '../../utils/paths';

const log = logEngine.createLogger('ShotExemplars');

const KINDS: ReadonlySet<string> = new Set(['cutaway', 'overlay', 'title']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

interface ExemplarEntry {
  id: string;
  kind: StudioShotKind;
  name: string;
  description: string;
}

function parseEntries(raw: unknown): ExemplarEntry[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const list = (raw as { exemplars?: unknown }).exemplars;
  if (!Array.isArray(list)) return [];
  const entries: ExemplarEntry[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, kind, name, description } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) continue;
    if (typeof kind !== 'string' || !KINDS.has(kind)) continue;
    entries.push({
      id,
      kind: kind as StudioShotKind,
      name: typeof name === 'string' && name.length > 0 ? name : id,
      description: typeof description === 'string' ? description : '',
    });
  }
  return entries;
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

/** Exemplars of one kind from one pack folder, in manifest order. */
async function readPack(packDir: string, kind: StudioShotKind): Promise<ShotExemplar[]> {
  const entries = parseEntries(await readJson(path.join(packDir, 'manifest.json')));
  const exemplars: ShotExemplar[] = [];
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    try {
      const code = await fs.readFile(path.join(packDir, `${entry.id}.tsx`), 'utf-8');
      exemplars.push({ name: entry.name, description: entry.description, code });
    } catch {
      log.warn('Exemplar declared but missing on disk', { pack: path.basename(packDir), id: entry.id });
    }
  }
  return exemplars;
}

/**
 * Exemplars of one kind across every pack folder under one root, packs in
 * folder order. Root is a parameter so this half is testable without electron
 * (caption-packs pattern).
 */
export async function loadExemplarsFromRoot(
  root: string,
  kind: StudioShotKind,
): Promise<ShotExemplar[]> {
  let dirEntries;
  try {
    dirEntries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // root missing — degrade to no exemplars
  }
  const exemplars: ShotExemplar[] = [];
  for (const entry of dirEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    exemplars.push(...(await readPack(path.join(root, entry.name), kind)));
  }
  return exemplars;
}

/** Built-in exemplars for a shot kind — what the generator injects (Q3a). */
export async function getShotExemplars(kind: StudioShotKind): Promise<ShotExemplar[]> {
  try {
    return await loadExemplarsFromRoot(getShotExemplarsDir(), kind);
  } catch (err) {
    log.warn('Shot exemplars unavailable — generating without them', { error: String(err) });
    return [];
  }
}
