import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { ProviderConfig } from '../../engine/types';
import type { ImageProviderConfig } from '../../image-engine';
import type { ProviderCredentials } from '../../shared/ipc/types/provider-keys';
import { logEngine } from '../../logging/log-engine';
import { getDb, getValue, setValue, setValues } from './settings-db';

const log = logEngine.createLogger('settings-migrate');

function legacySettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

/**
 * One-shot import of settings.json into SQLite. Safe to call on every launch.
 * Skips the import when the DB already has rows, then renames the JSON to a
 * backup so we don't reimport even if a user re-creates the file.
 */
export async function migrateSettings(): Promise<void> {
  const filePath = legacySettingsPath();

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return; // no legacy file to import
  }

  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM app_settings').get() as { n: number }).n;

  if (count > 0) {
    // DB already populated — retire the legacy file so nothing re-imports.
    await backupFile(filePath);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.error('Legacy settings.json is not valid JSON — skipping import', err);
    await backupFile(filePath);
    return;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    log.warn('Legacy settings.json is not an object — skipping');
    await backupFile(filePath);
    return;
  }

  const entries = parsed as Record<string, unknown>;
  setValues(entries);
  log.info('Imported legacy settings into SQLite', { keys: Object.keys(entries).length });

  await backupFile(filePath);
}

/**
 * BYOK migration. Idempotent; runs on every launch before engine init.
 * 1. Seeds the shared providerCredentials record from legacy per-engine
 *    provider configs (LLM OpenRouter key wins over the image one — it was
 *    the only one visible in Settings).
 * 2. Drops persisted VidTSX image-provider rows (the provider is removed)
 *    and repoints imageActiveProvider if it referenced VidTSX.
 */
export async function migrateProviderSettings(): Promise<void> {
  // 1. Harvest legacy keys into providerCredentials (never overwrite existing).
  const existing = getValue<ProviderCredentials>('providerCredentials');
  if (!existing) {
    const llmProviders = getValue<ProviderConfig[]>('llmProviders') ?? [];
    const imageProviders = getValue<ImageProviderConfig[]>('imageProviders') ?? [];

    const credentials: ProviderCredentials = {};
    const openrouterKey =
      llmProviders.find((p) => p.id === 'openrouter' && p.apiKey)?.apiKey ??
      imageProviders.find((p) => p.type === 'openrouter' && p.apiKey)?.apiKey;
    if (openrouterKey) credentials.openrouter = openrouterKey;

    const falKey = imageProviders.find((p) => p.type === 'fal' && p.apiKey)?.apiKey;
    if (falKey) credentials.fal = falKey;

    setValue('providerCredentials', credentials);
    log.info('Seeded providerCredentials from legacy provider configs', {
      openrouter: !!credentials.openrouter,
      fal: !!credentials.fal,
    });
  }

  // 2. Remove persisted VidTSX image providers.
  const imageProviders = getValue<ImageProviderConfig[]>('imageProviders');
  if (imageProviders?.some((p) => (p.type as string) === 'vidtsx')) {
    const filtered = imageProviders.filter((p) => (p.type as string) !== 'vidtsx');
    const active = getValue<string>('imageActiveProvider');
    const activeStillExists = filtered.some((p) => p.id === active);
    const nextActive = activeStillExists
      ? active
      : (filtered.find((p) => p.enabled)?.id ?? filtered[0]?.id);
    setValues({ imageProviders: filtered, imageActiveProvider: nextActive });
    log.info('Removed VidTSX image provider rows from settings', {
      removed: imageProviders.length - filtered.length,
      nextActive,
    });
  }
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy settings.json to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
