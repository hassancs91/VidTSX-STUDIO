import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeCutStyleSpec, parseCutStyleFile } from './cut-style-spec';
import { normalizePresetStyle } from './preset';

const SHIPPED = path.resolve(process.cwd(), 'resources/skills/studio-clean-cut/cut-style.json');
const shippedRaw = (): Record<string, unknown> =>
  JSON.parse(readFileSync(SHIPPED, 'utf8')) as Record<string, unknown>;

describe('the shipped cut-style.json', () => {
  const file = parseCutStyleFile(shippedRaw());

  it('defaults to tight (B2 decision 2)', () => {
    expect(file.default).toBe('tight');
  });

  it("tight is Hasan's fitted tight, all twelve knobs (cuts.json styles.tight)", () => {
    expect(file.styles.tight).toEqual({
      internalGap: 0.4, head: 0.15, minTail: 0.08, maxTail: 0.7, margin: 12, softGap: 99,
      softMaxTail: 0.6, softMargin: 6, maxHead: 0.3, minSkip: 0.12, fricZcr: 3500, fricMargin: 5,
    });
  });

  it('natural is his fitted natural with the four opt-in knobs off', () => {
    expect(file.styles.natural).toEqual({
      internalGap: 0.4, head: 0.21, minTail: 0.26, maxTail: 0.45, margin: 6, softGap: 1.2,
      softMaxTail: 0.7, softMargin: 3,
    });
  });

  it('relaxed = natural with every time knob x1.5 (2 decimals), dB margins kept (decision 1)', () => {
    const n = file.styles.natural;
    const r = file.styles.relaxed;
    for (const knob of ['internalGap', 'head', 'minTail', 'maxTail', 'softGap', 'softMaxTail'] as const) {
      expect(r[knob]).toBeCloseTo(Math.round(n[knob] * 1.5 * 100) / 100, 6);
    }
    expect(r.margin).toBe(n.margin);
    expect(r.softMargin).toBe(n.softMargin);
    expect([r.maxHead, r.minSkip, r.fricZcr, r.fricMargin]).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('parseCutStyleFile rejects a broken file', () => {
  const broken = (mutate: (raw: Record<string, unknown>) => void): (() => unknown) => () => {
    const raw = shippedRaw();
    mutate(raw);
    return parseCutStyleFile(raw);
  };
  const styles = (raw: Record<string, unknown>): Record<string, Record<string, unknown>> =>
    raw.styles as Record<string, Record<string, unknown>>;

  it('names the problem', () => {
    expect(() => parseCutStyleFile(null)).toThrow(/not an object/);
    expect(broken((r) => { r.default = 'loose'; })).toThrow(/"default"/);
    expect(broken((r) => { delete styles(r).relaxed; })).toThrow(/"relaxed" is missing/);
    expect(broken((r) => { delete styles(r).natural.head; })).toThrow(/natural\.head is required/);
    expect(broken((r) => { styles(r).tight.margin = 600; })).toThrow(/tight\.margin must be/);
    expect(broken((r) => { styles(r).tight.fricZcr = 'high'; })).toThrow(/tight\.fricZcr must be/);
    expect(broken((r) => { styles(r).natural.minTail = 0.9; })).toThrow(/minTail is above maxTail/);
    expect(broken((r) => { styles(r).tight.maxHead = 0.1; })).toThrow(/maxHead is below head/);
  });
});

describe('normalizeCutStyleSpec', () => {
  it('drops garbage to undefined, so a bad cut behaves like an absent one', () => {
    for (const raw of [undefined, null, 3, 'loose', [], {}, { base: 'loose' }, { head: -1 }, { margin: Number.NaN }]) {
      expect(normalizeCutStyleSpec(raw)).toBeUndefined();
    }
  });

  it('keeps a known base and in-bounds knobs, drops the rest', () => {
    expect(normalizeCutStyleSpec({ base: 'natural', head: 0.25, maxTail: 99, extra: 1, softGap: 99 })).toEqual({
      base: 'natural', head: 0.25, softGap: 99,
    });
    expect(normalizeCutStyleSpec({ fricZcr: 4000 })).toEqual({ fricZcr: 4000 });
  });

  it('accepts a bare style name as { base }', () => {
    expect(normalizeCutStyleSpec('relaxed')).toEqual({ base: 'relaxed' });
  });
});

describe('normalizePresetStyle and cut', () => {
  it('an old preset (no cut) gains no cut key', () => {
    expect(normalizePresetStyle({ pacing: 'tight', shotsPerMinute: 4 })).toEqual({ pacing: 'tight', shotsPerMinute: 4 });
  });

  it('keeps a valid cut and drops a garbage one', () => {
    expect(normalizePresetStyle({ cut: { base: 'natural', minTail: 0.3 } }).cut).toEqual({ base: 'natural', minTail: 0.3 });
    expect('cut' in normalizePresetStyle({ cut: { base: 'loose' } })).toBe(false);
  });
});
