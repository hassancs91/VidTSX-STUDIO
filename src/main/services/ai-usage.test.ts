import { describe, expect, it, vi } from 'vitest';

// Replace the SQLite/electron-backed module entirely — these tests exercise
// the metric aggregation in getChartData, not storage.
vi.mock('./ai-usage-db', () => ({
  getChartRows: vi.fn(),
  insertEntry: vi.fn(),
  getSummary: vi.fn(),
  getLog: vi.fn(),
  clearAll: vi.fn(),
}));

import { aiUsageService } from './ai-usage';
import * as db from './ai-usage-db';

const ROWS = [
  // two fal requests on the same day, one openrouter on the next
  { timestamp: '2026-08-20T10:00:00.000Z', provider: 'fal', tokens: 0, costUsd: 0.04 },
  { timestamp: '2026-08-20T11:00:00.000Z', provider: 'fal', tokens: 0, costUsd: 0.15 },
  { timestamp: '2026-08-21T09:00:00.000Z', provider: 'openrouter', tokens: 1200, costUsd: 0.002 },
];

function seed() {
  vi.mocked(db.getChartRows).mockReturnValue(ROWS);
}

describe('aiUsageService.getChartData metrics', () => {
  it('defaults to tokens (existing behavior)', () => {
    seed();
    const chart = aiUsageService.getChartData('daily');
    const openrouter = chart.series.find((s) => s.provider === 'openrouter')!;
    const fal = chart.series.find((s) => s.provider === 'fal')!;
    expect(openrouter.data).toEqual([0, 1200]);
    expect(fal.data).toEqual([0, 0]);
  });

  it('counts one per row for the requests metric', () => {
    seed();
    const chart = aiUsageService.getChartData('daily', {}, 'requests');
    const fal = chart.series.find((s) => s.provider === 'fal')!;
    const openrouter = chart.series.find((s) => s.provider === 'openrouter')!;
    expect(fal.data).toEqual([2, 0]);
    expect(openrouter.data).toEqual([0, 1]);
  });

  it('sums costUsd for the cost metric', () => {
    seed();
    const chart = aiUsageService.getChartData('daily', {}, 'cost');
    const fal = chart.series.find((s) => s.provider === 'fal')!;
    expect(fal.data[0]).toBeCloseTo(0.19, 10);
    expect(fal.data[1]).toBe(0);
  });
});
