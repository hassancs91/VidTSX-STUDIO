import { randomUUID } from 'crypto';
import type {
  AiUsageEntry,
  AiUsageSummary,
  AiUsageChartData,
  AiUsagePeriod,
  AiUsageMetric,
  AiUsageFilter,
} from '../../shared/types/ai-usage';
import * as db from './ai-usage-db';

// --- Bucket key helpers (kept in JS for exact parity with legacy week calc) ---

function getDayKey(ts: string): string {
  return ts.slice(0, 10); // YYYY-MM-DD
}

function getWeekKey(ts: string): string {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(ts: string): string {
  return ts.slice(0, 7); // YYYY-MM
}

function formatBucketLabel(key: string, period: AiUsagePeriod): string {
  if (period === 'daily') {
    const d = new Date(key);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (period === 'weekly') {
    return key; // e.g. "2026-W14"
  }
  const d = new Date(key + '-01');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

class AiUsageService {
  /**
   * Kept as a no-op for backward compatibility — the JSON service needed a startup
   * load, the SQLite backend opens lazily on first use. Legacy migration runs
   * separately via `migrateAiUsage()` in main/index.ts.
   */
  async init(): Promise<void> {
    // no-op
  }

  async appendEntry(entry: Omit<AiUsageEntry, 'id'>): Promise<void> {
    const full: AiUsageEntry = { id: randomUUID(), ...entry };
    db.insertEntry(full);
  }

  getSummary(filter: AiUsageFilter = {}): AiUsageSummary {
    return db.getSummary(filter);
  }

  getChartData(
    period: AiUsagePeriod,
    filter: AiUsageFilter = {},
    metric: AiUsageMetric = 'tokens'
  ): AiUsageChartData {
    const keyFn = period === 'daily' ? getDayKey : period === 'weekly' ? getWeekKey : getMonthKey;

    const rows = db.getChartRows(filter);

    const timeKeys = new Set<string>();
    const providerSet = new Set<string>();
    const matrix = new Map<string, number>(); // "timeKey|provider" -> metric value

    for (const row of rows) {
      const timeKey = keyFn(row.timestamp);
      timeKeys.add(timeKey);
      providerSet.add(row.provider);
      const mapKey = `${timeKey}|${row.provider}`;
      const value = metric === 'requests' ? 1 : metric === 'cost' ? row.costUsd : row.tokens;
      matrix.set(mapKey, (matrix.get(mapKey) ?? 0) + value);
    }

    const sortedKeys = [...timeKeys].sort();
    const labels = sortedKeys.map((k) => formatBucketLabel(k, period));

    const series = [...providerSet].sort().map((provider) => ({
      provider,
      data: sortedKeys.map((k) => matrix.get(`${k}|${provider}`) ?? 0),
    }));

    return { labels, series };
  }

  getLog(
    limit = 50,
    offset = 0,
    filter: AiUsageFilter = {}
  ): { entries: AiUsageEntry[]; total: number } {
    return db.getLog(limit, offset, filter);
  }

  async clear(): Promise<void> {
    db.clearAll();
  }

  /**
   * No-op with SQLite — every appendEntry commits immediately. Retained so
   * main/index.ts teardown keeps compiling against the old contract.
   */
  async shutdown(): Promise<void> {
    // no-op
  }
}

export const aiUsageService = new AiUsageService();
