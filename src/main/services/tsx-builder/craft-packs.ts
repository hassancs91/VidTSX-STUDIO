// The built-in craft packs (TSX_BUILDER_DESIGN.md T8, P4-1 (a)): every
// `resources/packs/<packId>/pack.json` `craft[]` entry whose text
// `craft/<id>.md` is there. Read once and cached, synchronously: the job
// engine's start() refuses an unknown id before anything queues, and the
// built-in packs never change while the app runs. A text goes into the
// builder's system prompt as its SKILL.md body (the frontmatter is the
// manifest's, already in the picker).

import fs from 'fs';
import path from 'path';
import { getBuiltinPacksDir } from '../../utils/paths';
import { parseSkillFrontmatter } from '../../../shared/skills/parse-skill';
import { namespacedId } from '../../../shared/studio/caption-pack';
import {
  CRAFT_MANIFEST_KEY,
  CRAFT_MAX_BYTES,
  craftFilePath,
  expandCraftIds,
  parseCraftEntries,
  type CraftPackInfo,
} from '../../../shared/studio/craft-pack';
import { logEngine } from '../../../logging/log-engine';
import type { BuildPack } from './types';

const log = logEngine.createLogger('CraftPacks');

interface CraftRecord {
  info: CraftPackInfo;
  file: string;
}

let cache: { root: string; byId: Map<string, CraftRecord> } | null = null;

function readPack(root: string, packId: string): CraftRecord[] {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(fs.readFileSync(path.join(root, packId, 'pack.json'), 'utf-8')) as Record<string, unknown>;
  } catch {
    return [];
  }
  const list = doc[CRAFT_MANIFEST_KEY];
  if (!Array.isArray(list)) return [];
  const records: CraftRecord[] = [];
  for (const entry of parseCraftEntries(list)) {
    const file = path.join(root, packId, ...craftFilePath(entry.id).split('/'));
    const size = fs.statSync(file, { throwIfNoEntry: false })?.size;
    if (size === undefined || size > CRAFT_MAX_BYTES) {
      log.warn('Craft pack skipped: its text is missing or too large', { id: namespacedId(packId, entry.id), size });
      continue;
    }
    const { id, ...rest } = entry;
    records.push({ info: { ...rest, id: namespacedId(packId, id), packId }, file });
  }
  return records;
}

/** Every built-in craft pack by id. `root` is for tests. */
function catalog(root: string = getBuiltinPacksDir()): Map<string, CraftRecord> {
  if (cache?.root === root) return cache.byId;
  const byId = new Map<string, CraftRecord>();
  let packIds: string[] = [];
  try {
    packIds = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    // No packs folder: no craft packs.
  }
  for (const packId of packIds) for (const record of readPack(root, packId)) byId.set(record.info.id, record);
  cache = { root, byId };
  return byId;
}

/** The picker's list: forms, then methods, then styles, each in manifest order. */
export function listCraftPacks(root?: string): CraftPackInfo[] {
  const order = { form: 0, method: 1, style: 2 } as const;
  return [...catalog(root).values()].map((r) => r.info).sort((a, b) => order[a.role] - order[b.role]);
}

/** Why a request's pack ids cannot run, or null. */
export function craftPacksProblem(ids: unknown, root?: string): string | null {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return 'Craft packs are a list of pack ids';
  if (ids.length === 0) return null;
  const known = catalog(root);
  const unknown = (ids as string[]).filter((id) => !known.has(id));
  if (unknown.length === 0) return null;
  const list = [...known.keys()].join(', ') || 'none';
  return `Unknown craft pack${unknown.length === 1 ? '' : 's'} ${unknown.map((id) => `"${id}"`).join(', ')}. This app has: ${list}.`;
}

export interface ResolvedCraftPacks {
  /** What ran: the ids asked for, each followed by the packs it brings. */
  ids: string[];
  /** Their texts, in that order, for the system prompt. */
  packs: BuildPack[];
  /** Ids this app does not have (an edit of a version made where they existed); logged, not run. */
  skipped: string[];
}

/** Ids → texts. Never throws: an unknown id or an unreadable text is skipped and logged. */
export function resolveCraftPacks(ids: readonly string[], root?: string): ResolvedCraftPacks {
  if (ids.length === 0) return { ids: [], packs: [], skipped: [] };
  const known = catalog(root);
  const skipped = ids.filter((id) => !known.has(id));
  if (skipped.length) log.warn('Craft packs not in this app, skipped', { skipped });
  const out: ResolvedCraftPacks = { ids: [], packs: [], skipped };
  for (const id of expandCraftIds(ids, (i) => known.get(i)?.info)) {
    const record = known.get(id)!;
    try {
      const { body } = parseSkillFrontmatter(fs.readFileSync(record.file, 'utf-8'));
      out.ids.push(id);
      out.packs.push({ name: record.info.name, body });
    } catch (err) {
      log.warn('Craft pack text unreadable, skipped', { id, error: err instanceof Error ? err.message : String(err) });
      out.skipped.push(id);
    }
  }
  return out;
}
