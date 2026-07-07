import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import type {
  AiUsageEntry,
  AiFeatureSource,
  AiRequestType,
} from '../../shared/types/ai-usage';
import { bulkInsert, getDb } from './ai-usage-db';

const log = logEngine.createLogger('ai-usage-migrate');

const FEATURE_SOURCES: AiFeatureSource[] = [
  'ai-chat',
  'tsx-generation',
  'tsx-analysis',
  'image-generation',
  'provider-test',
  'other',
];
const REQUEST_TYPES: AiRequestType[] = ['llm', 'image', 'local-llm'];

function legacyLogPath(): string {
  return path.join(app.getPath('userData'), 'ai-usage-log.json');
}

function isEntry(e: unknown): e is AiUsageEntry {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.timestamp === 'string' &&
    typeof o.provider === 'string' &&
    typeof o.model === 'string' &&
    typeof o.featureSource === 'string' &&
    FEATURE_SOURCES.includes(o.featureSource as AiFeatureSource) &&
    typeof o.inputTokens === 'number' &&
    typeof o.outputTokens === 'number' &&
    typeof o.cacheReadInputTokens === 'number' &&
    typeof o.costUsd === 'number' &&
    typeof o.durationMs === 'number' &&
    typeof o.requestType === 'string' &&
    REQUEST_TYPES.includes(o.requestType as AiRequestType)
  );
}

/**
 * One-shot import of ai-usage-log.json into SQLite. Safe to call on every launch.
 * Skips when the DB already has rows, then renames the JSON to a backup so
 * we don't reimport even if a user re-creates the file.
 */
export async function migrateAiUsage(): Promise<void> {
  const filePath = legacyLogPath();

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return; // nothing to import
  }

  const db = getDb();
  const count = (
    db.prepare('SELECT COUNT(*) AS n FROM ai_usage_entries').get() as { n: number }
  ).n;

  if (count > 0) {
    await backupFile(filePath);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.error('Legacy ai-usage-log.json is not valid JSON — skipping import', err);
    await backupFile(filePath);
    return;
  }

  // Accept both the versioned shape `{version: 1, entries: [...]}` and a bare array.
  let entries: unknown[] = [];
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    const maybe = (parsed as { entries?: unknown }).entries;
    if (Array.isArray(maybe)) entries = maybe;
  }

  const valid = entries.filter(isEntry);
  if (valid.length > 0) {
    bulkInsert(valid);
    log.info('Imported legacy ai-usage entries into SQLite', { count: valid.length });
  }

  await backupFile(filePath);
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy ai-usage-log.json to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
