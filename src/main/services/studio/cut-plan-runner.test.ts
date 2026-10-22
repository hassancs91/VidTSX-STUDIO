import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WAVEFORM_VERSION } from '../../../shared/types/studio-waveform';
import type { ResolvedCutStyle } from '../../../shared/types/studio-cut-plan';
import { cutStyleKey } from '../../../shared/studio/cut-style-resolve';
import { TEST_NATURAL_STYLE, TEST_TIGHT_STYLE } from '../../../shared/studio/cut-style-test-fixtures';

const env = vi.hoisted(() => ({ cacheDir: '' }));

vi.mock('electron', () => ({ app: { getPath: () => 'x', isPackaged: false } }));
vi.mock('./studio-paths', () => ({ getProjectCacheDir: async () => env.cacheDir }));
vi.mock('./waveform-generator', () => ({
  generateWaveform: async () => undefined,
  waveformRelPath: (assetId: string) => path.join('waveforms', `${assetId}.json`),
}));
vi.mock('./asset-transcriber', () => ({
  readTranscriptFile: async () => ({
    words: [
      { text: 'Hello', start: 0.2, end: 0.6 },
      { text: 'there.', start: 0.65, end: 0.9 },
      { text: 'Next', start: 3.0, end: 3.4 },
      { text: 'part.', start: 3.45, end: 3.8 },
    ],
    sttModelId: 'assemblyai/universal',
    // Measured timing → the style is used as-is (no capability widening).
    features: {
      wordTimestamps: true,
      approximateWordTimestamps: false,
      speakerLabels: true,
      highlights: false,
      sentiment: false,
      audioEvents: false,
      verbatimDisfluencies: true,
    },
  }),
}));

import { CUT_PLAN_DIR, runCutPlan } from './cut-plan-runner';

const BPS = 50;

function resolved(styleName: 'tight' | 'natural', style = styleName === 'tight' ? TEST_TIGHT_STYLE : TEST_NATURAL_STYLE): ResolvedCutStyle {
  return { styleName, style, source: 'default', overrides: [], displayName: `${styleName} · default`, key: cutStyleKey(style) };
}

beforeEach(async () => {
  env.cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cut-plan-runner-'));
  const rmsDb = Array.from({ length: 5 * BPS }, (_, i) => {
    const t = i / BPS;
    return (t >= 0.2 && t < 0.9) || (t >= 3.0 && t < 3.8) ? -20 : -55;
  });
  await fs.mkdir(path.join(env.cacheDir, 'waveforms'), { recursive: true });
  await fs.writeFile(
    path.join(env.cacheDir, 'waveforms', 'a1.json'),
    JSON.stringify({ version: WAVEFORM_VERSION, peaksPerSecond: BPS, rmsDb }),
    'utf-8',
  );
});

afterEach(async () => {
  await fs.rm(env.cacheDir, { recursive: true, force: true });
});

describe('runCutPlan (B2: resolved style in, keyed plan file out)', () => {
  it('plans with the resolved knobs and stores the name and key on the plan', async () => {
    const cut = resolved('tight');
    const { plan, planPath } = await runCutPlan('p1', 'a1', 'src.mp4', cut);
    expect(plan).toMatchObject({ styleName: 'tight', styleDisplayName: 'tight · default', styleKey: cut.key });
    expect(plan.style).toEqual(TEST_TIGHT_STYLE);
    expect(path.basename(planPath)).toBe(`a1-tight-${cut.key}.json`);
    expect(JSON.parse(await fs.readFile(planPath, 'utf-8'))).toEqual(plan);
  });

  it('an edited knob writes a new plan file instead of reusing the old one', async () => {
    const a = await runCutPlan('p1', 'a1', 'src.mp4', resolved('natural'));
    const edited = resolved('natural', { ...TEST_NATURAL_STYLE, head: 0.25 });
    const b = await runCutPlan('p1', 'a1', 'src.mp4', edited);
    expect(b.planPath).not.toBe(a.planPath);
    expect(b.plan.style.head).toBe(0.25);
  });

  it('a pre-B2 plan file beside it is left alone and breaks nothing', async () => {
    const old = path.join(env.cacheDir, CUT_PLAN_DIR, 'a1-tight.json');
    await fs.mkdir(path.dirname(old), { recursive: true });
    await fs.writeFile(old, '{"version":1,"styleName":"tight"}', 'utf-8');
    const { planPath } = await runCutPlan('p1', 'a1', 'src.mp4', resolved('tight'));
    expect(planPath).not.toBe(old);
    expect(await fs.readFile(old, 'utf-8')).toBe('{"version":1,"styleName":"tight"}');
  });
});
