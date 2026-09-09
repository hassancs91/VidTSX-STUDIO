// Built-in presets (V1 completion plan §2.5): `resources/presets/<id>/` is
// copied into `<assetsRoot>/presets/<id>/` on first use, so edits never touch
// resources and a deleted built-in stays deleted — the seed ledger
// (`presets/.seeded.json`) records what was copied once.

import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import { PRESETS_DIR, PRESET_JSON_NAME } from './preset-store';

const log = logEngine.createLogger('PresetBuiltins');

const LEDGER_NAME = '.seeded.json';

interface SeedLedger {
  seeded: string[];
}

async function readLedger(ledgerPath: string): Promise<SeedLedger> {
  try {
    const raw = JSON.parse(await fs.readFile(ledgerPath, 'utf-8')) as Partial<SeedLedger>;
    return { seeded: Array.isArray(raw.seeded) ? raw.seeded.filter((s): s is string => typeof s === 'string') : [] };
  } catch {
    return { seeded: [] };
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy every built-in preset folder that has never been seeded into the
 * library. Returns the ids copied this call. Best-effort per preset: one
 * broken resource folder must not block the others, and nothing here throws
 * — a listing must never fail because seeding did.
 */
export async function ensureBuiltinPresets(root: string, builtinDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(builtinDir, { withFileTypes: true });
  } catch {
    return []; // No resources folder (a bare second instance) — nothing to seed.
  }
  const presetsDir = path.join(root, PRESETS_DIR);
  const ledgerPath = path.join(presetsDir, LEDGER_NAME);
  const ledger = await readLedger(ledgerPath);
  const copied: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const id = entry.name;
    if (ledger.seeded.includes(id)) continue;
    const source = path.join(builtinDir, id);
    if (!(await exists(path.join(source, PRESET_JSON_NAME)))) continue;
    const dest = path.join(presetsDir, id);
    try {
      if (!(await exists(dest))) {
        await fs.cp(source, dest, { recursive: true });
        copied.push(id);
      }
      ledger.seeded.push(id);
    } catch (err) {
      log.warn('Could not seed built-in preset', { id, error: String(err) });
    }
  }
  if (copied.length > 0 || ledger.seeded.length > 0) {
    try {
      await fs.mkdir(presetsDir, { recursive: true });
      await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2), 'utf-8');
    } catch (err) {
      log.warn('Could not write the preset seed ledger', { error: String(err) });
    }
  }
  if (copied.length > 0) log.info('Seeded built-in presets', { ids: copied });
  return copied;
}
