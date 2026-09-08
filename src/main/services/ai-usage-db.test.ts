// The agent_id column, its migration, and the by-agent breakdown (agents plan
// §9). Real SQLite against a temp userData — the migration is the half that
// cannot be tested with a mocked db module, because the whole point is what
// happens to a table that already exists without the column.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';

let userData = '';
vi.mock('electron', () => ({
  app: { getPath: () => userDataForMock() },
}));

// `better-sqlite3` is a native module built against ELECTRON's ABI, so it
// cannot load in a plain node test runner — which is why nothing in this repo
// had ever tested the usage store directly. Node ships its own SQLite, and the
// slice of the better-sqlite3 surface this module uses is small enough to
// adapt in a dozen lines. So these are real SQL statements against a real
// database file, which is what a MIGRATION test has to be: the whole question
// is what happens to a table that already exists without the column.
vi.mock('better-sqlite3', () => ({ default: adaptNodeSqlite() }));

function adaptNodeSqlite() {
  return class Adapter {
    private readonly inner: DatabaseSync;
    constructor(file: string) {
      this.inner = new DatabaseSync(file);
    }
    pragma(text: string): unknown {
      // The module uses pragma() for settings and prepare() for table_info.
      return this.inner.exec(`PRAGMA ${text}`);
    }
    exec(sql: string): void {
      this.inner.exec(sql);
    }
    prepare(sql: string) {
      return this.inner.prepare(sql);
    }
    transaction<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
      return (...args: TArgs) => {
        this.inner.exec('BEGIN');
        try {
          const out = fn(...args);
          this.inner.exec('COMMIT');
          return out;
        } catch (err) {
          this.inner.exec('ROLLBACK');
          throw err;
        }
      };
    }
    close(): void {
      this.inner.close();
    }
  };
}

// The mock factory is hoisted above the variable, so it reads through a call.
function userDataForMock(): string {
  return userData;
}

import * as db from './ai-usage-db';
import type { AiUsageEntry } from '../../shared/types/ai-usage';

function entry(over: Partial<AiUsageEntry> = {}): AiUsageEntry {
  return {
    id: `id-${Math.random().toString(16).slice(2)}`,
    timestamp: '2026-09-08T10:00:00.000Z',
    provider: 'claude-subscription',
    model: 'claude-opus-5',
    featureSource: 'agent',
    inputTokens: 100,
    outputTokens: 200,
    cacheReadInputTokens: 1000,
    costUsd: 0.5,
    durationMs: 1234,
    requestType: 'llm',
    ...over,
  };
}

/** The table exactly as it shipped before agents — no `agent_id`. */
function createLegacyTable(dbPath: string): void {
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    CREATE TABLE ai_usage_entries (
      id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, provider TEXT NOT NULL,
      model TEXT NOT NULL, feature_source TEXT NOT NULL, input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL, cache_read_input_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL, duration_ms INTEGER NOT NULL, request_type TEXT NOT NULL
    );
    INSERT INTO ai_usage_entries VALUES
      ('old-1','2026-08-01T00:00:00.000Z','fal','flux','image-generation',0,0,0,0.02,900,'image');
  `);
  legacy.close();
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vidtsx-usage-'));
});

afterEach(() => {
  db.closeDb();
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('agent_id migration', () => {
  it('adds the column to a database that predates it, keeping the rows', () => {
    fs.mkdirSync(db.getAiUsageDir(), { recursive: true });
    createLegacyTable(path.join(db.getAiUsageDir(), 'ai-usage.db'));

    // Opening is the migration. Without it every insert naming agent_id would
    // throw and take the whole usage log down over a column agents alone fill.
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post' }));

    const log = db.getLog(10, 0, {});
    expect(log.total).toBe(2);
    const old = log.entries.find((e) => e.id === 'old-1');
    expect(old).toBeDefined();
    expect(old?.agentId).toBeUndefined(); // NULL means "not an agent's"
  });

  it('is idempotent across reopens', () => {
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post' }));
    db.closeDb();
    expect(() => db.insertEntry(entry({ agentId: 'vidtsx/assistant' }))).not.toThrow();
    expect(db.getLog(10, 0, {}).total).toBe(2);
  });
});

describe('agent attribution', () => {
  it('round-trips agentId and leaves non-agent rows without one', () => {
    db.insertEntry(entry({ id: 'a', agentId: 'vidtsx/motion-post' }));
    db.insertEntry(entry({ id: 'b', featureSource: 'tsx-generation' }));
    const entries = db.getLog(10, 0, {}).entries;
    expect(entries.find((e) => e.id === 'a')?.agentId).toBe('vidtsx/motion-post');
    expect(entries.find((e) => e.id === 'b')?.agentId).toBeUndefined();
  });

  it('filters the log to one agent', () => {
    db.insertEntry(entry({ id: 'a', agentId: 'vidtsx/motion-post' }));
    db.insertEntry(entry({ id: 'b', agentId: 'vidtsx/assistant' }));
    const only = db.getLog(10, 0, { agentId: 'vidtsx/assistant' });
    expect(only.total).toBe(1);
    expect(only.entries[0].id).toBe('b');
  });

  it('groups totals by agent, biggest spender first', () => {
    db.insertEntry(entry({ agentId: 'vidtsx/assistant', costUsd: 0.1 }));
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post', costUsd: 0.7 }));
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post', costUsd: 0.3, inputTokens: 5 }));
    // Not an agent's, and must not appear as an "unknown" bucket: everything
    // the app does outside an agent looks exactly like this row.
    db.insertEntry(entry({ featureSource: 'ai-chat', costUsd: 99 }));

    const totals = db.getAgentTotals({});
    expect(totals.map((t) => t.agentId)).toEqual(['vidtsx/motion-post', 'vidtsx/assistant']);
    expect(totals[0].requests).toBe(2);
    expect(totals[0].costUsd).toBeCloseTo(1.0, 10);
    expect(totals[0].inputTokens).toBe(105);
    expect(totals[0].cacheReadInputTokens).toBe(2000);
  });

  it('honours the date window the screen is showing', () => {
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post', timestamp: '2026-09-01T00:00:00.000Z' }));
    db.insertEntry(entry({ agentId: 'vidtsx/motion-post', timestamp: '2026-09-08T00:00:00.000Z' }));
    const totals = db.getAgentTotals({ startDate: '2026-09-05T00:00:00.000Z' });
    expect(totals).toHaveLength(1);
    expect(totals[0].requests).toBe(1);
  });

  it('returns nothing when no agent has run', () => {
    db.insertEntry(entry({ featureSource: 'ai-chat' }));
    expect(db.getAgentTotals({})).toEqual([]);
  });
});
