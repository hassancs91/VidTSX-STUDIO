import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type {
  AiUsageEntry,
  AiUsageFilter,
  AiUsageSummary,
  AiFeatureSource,
  AiRequestType,
} from '../../shared/types/ai-usage';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ai-usage-db');

let db: Database.Database | null = null;

export const MAX_ENTRIES = 10_000;

export function getAiUsageDir(): string {
  return path.join(app.getPath('userData'), 'ai-usage');
}

function getDbPath(): string {
  return path.join(getAiUsageDir(), 'ai-usage.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getAiUsageDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_entries (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      feature_source TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_read_input_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      duration_ms INTEGER NOT NULL,
      request_type TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp_desc ON ai_usage_entries(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_entries(provider);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_source ON ai_usage_entries(feature_source);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close ai-usage DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mapper ---

interface UsageRow {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  feature_source: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cost_usd: number;
  duration_ms: number;
  request_type: string;
}

function rowToEntry(row: UsageRow): AiUsageEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    provider: row.provider,
    model: row.model,
    featureSource: row.feature_source as AiFeatureSource,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    requestType: row.request_type as AiRequestType,
  };
}

// --- Filter → WHERE clause ---

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

function buildWhere(filter: AiUsageFilter): WhereClause {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filter.startDate) {
    conditions.push('timestamp >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('timestamp <= ?');
    params.push(filter.endDate);
  }
  if (filter.provider) {
    conditions.push('provider = ?');
    params.push(filter.provider);
  }
  if (filter.featureSource) {
    conditions.push('feature_source = ?');
    params.push(filter.featureSource);
  }
  const sql = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  return { sql, params };
}

// --- CRUD ---

export function insertEntry(entry: AiUsageEntry): void {
  const database = getDb();

  const insert = database.prepare(
    `INSERT INTO ai_usage_entries
       (id, timestamp, provider, model, feature_source, input_tokens, output_tokens,
        cache_read_input_tokens, cost_usd, duration_ms, request_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const txn = database.transaction(() => {
    insert.run(
      entry.id,
      entry.timestamp,
      entry.provider,
      entry.model,
      entry.featureSource,
      entry.inputTokens,
      entry.outputTokens,
      entry.cacheReadInputTokens,
      entry.costUsd,
      entry.durationMs,
      entry.requestType
    );
    enforceMaxEntries(database);
  });
  txn();
}

function enforceMaxEntries(database: Database.Database): void {
  const row = database.prepare('SELECT COUNT(*) AS n FROM ai_usage_entries').get() as { n: number };
  if (row.n <= MAX_ENTRIES) return;
  const overflow = row.n - MAX_ENTRIES;
  database
    .prepare(
      `DELETE FROM ai_usage_entries
       WHERE id IN (
         SELECT id FROM ai_usage_entries
         ORDER BY timestamp ASC, rowid ASC
         LIMIT ?
       )`
    )
    .run(overflow);
}

/** Bulk insert for migrations. Ignores duplicates by id. */
export function bulkInsert(entries: AiUsageEntry[]): void {
  if (entries.length === 0) return;
  const database = getDb();

  const insert = database.prepare(
    `INSERT OR IGNORE INTO ai_usage_entries
       (id, timestamp, provider, model, feature_source, input_tokens, output_tokens,
        cache_read_input_tokens, cost_usd, duration_ms, request_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const txn = database.transaction((batch: AiUsageEntry[]) => {
    for (const e of batch) {
      insert.run(
        e.id,
        e.timestamp,
        e.provider,
        e.model,
        e.featureSource,
        e.inputTokens,
        e.outputTokens,
        e.cacheReadInputTokens,
        e.costUsd,
        e.durationMs,
        e.requestType
      );
    }
    enforceMaxEntries(database);
  });
  txn(entries);
}

export function getSummary(filter: AiUsageFilter): AiUsageSummary {
  const database = getDb();
  const where = buildWhere(filter);
  const row = database
    .prepare(
      `SELECT
         COUNT(*) AS total_requests,
         COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
         COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
         COALESCE(SUM(duration_ms), 0) AS total_duration_ms
       FROM ai_usage_entries${where.sql}`
    )
    .get(...where.params) as {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_duration_ms: number;
  };
  return {
    totalRequests: row.total_requests,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalDurationMs: row.total_duration_ms,
  };
}

/**
 * Pull filtered rows needed for chart bucketing. The actual daily/weekly/monthly
 * bucketing runs in JS to preserve the exact (non-ISO) week calculation used
 * by the legacy implementation.
 */
export function getChartRows(filter: AiUsageFilter): {
  timestamp: string;
  provider: string;
  tokens: number;
}[] {
  const database = getDb();
  const where = buildWhere(filter);
  return database
    .prepare(
      `SELECT timestamp, provider, (input_tokens + output_tokens) AS tokens
       FROM ai_usage_entries${where.sql}`
    )
    .all(...where.params) as { timestamp: string; provider: string; tokens: number }[];
}

export function getLog(
  limit: number,
  offset: number,
  filter: AiUsageFilter
): { entries: AiUsageEntry[]; total: number } {
  const database = getDb();
  const where = buildWhere(filter);

  const totalRow = database
    .prepare(`SELECT COUNT(*) AS n FROM ai_usage_entries${where.sql}`)
    .get(...where.params) as { n: number };

  const rows = database
    .prepare(
      `SELECT * FROM ai_usage_entries${where.sql}
       ORDER BY timestamp DESC, rowid DESC
       LIMIT ? OFFSET ?`
    )
    .all(...where.params, limit, offset) as UsageRow[];

  return {
    entries: rows.map(rowToEntry),
    total: totalRow.n,
  };
}

export function clearAll(): void {
  const database = getDb();
  database.prepare('DELETE FROM ai_usage_entries').run();
}
