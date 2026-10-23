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
import { buildCutProposal } from '../../../shared/studio/cut-proposal';

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

  it('runs the cut QA on the plan it made and writes it into the plan file (B3)', async () => {
    const { plan, planPath } = await runCutPlan('p1', 'a1', 'src.mp4', resolved('tight'));
    // Two speech runs 2.1 s apart: the first segment + one real join; two atoms
    // whose tails land in the -55 dB room tone (floor) → nothing flagged.
    expect(plan.qa).toEqual({ hardEntries: 0, clippedTails: 0, joinsChecked: 2, atomsChecked: 2, items: [] });
    expect(JSON.parse(await fs.readFile(planPath, 'utf-8')).qa).toEqual(plan.qa);
  });

  it('plans over the timeline keeps it is given: the applied cut is clamped, recorded and not re-proposed; its own file (B7)', async () => {
    const cut = resolved('tight');
    const whole = await runCutPlan('p1', 'a1', 'src.mp4', cut);
    // An applied cut removed 1.5–2.95 s; "Next" starts at 3.0, its 0.11 s head pad wants 2.89.
    const keeps = [
      { start: 0, end: 1.5 },
      { start: 2.95, end: 5 },
    ];
    const { plan, planPath } = await runCutPlan('p1', 'a1', 'src.mp4', cut, keeps);
    expect(plan.keeps).toEqual(keeps);
    expect(plan.segments.every((s) => keeps.some((k) => s.start >= k.start - 1e-6 && s.end <= k.end + 1e-6))).toBe(true);
    expect(plan.segments[1].start).toBe(2.95); // the lead-in stops at the applied cut
    expect(planPath).not.toBe(whole.planPath);
    expect(path.basename(planPath)).toMatch(new RegExp(`^a1-tight-${cut.key}-k[0-9a-z]+\\.json$`));
    expect(path.basename(whole.planPath)).toBe(`a1-tight-${cut.key}.json`);
    const proposal = buildCutProposal({ plan, words: [] });
    expect(proposal.items.some((i) => (i.sourceStart ?? 0) < 2.95 && (i.sourceEnd ?? 0) > 1.5 + 1e-6)).toBe(false);
    expect((proposal.agentNote ?? '').split('\n')[0]).toContain(`of ${(1.5 + 2.05).toFixed(1)} s`);
  });

  it('a timeline keep that holds no word gets no segment: the card proposes it whole and the headline counts it (B7 step 7)', async () => {
    const cut = resolved('tight');
    // Applied cuts removed "Hello there." (0–1.0 s) and 2.5–2.9 s; 1.0–2.5 s is room tone left on the timeline —
    // the step-6 run's clip heads (0375 [0, 3.62], 0370 [0, 1.83], …) and 0373's tail are such keeps.
    const keeps = [
      { start: 1.0, end: 2.5 },
      { start: 2.9, end: 5 },
    ];
    const { plan } = await runCutPlan('p1', 'a1', 'src.mp4', cut, keeps);
    expect(plan.keeps).toEqual(keeps);
    expect(plan.segments.some((s) => s.end > 1.0 + 1e-6 && s.start < 2.5 - 1e-6)).toBe(false);
    expect(plan.segments[0].start).toBe(2.9);
    // The QA reads the plan's own atoms: no clipped tail for a keep the plan does not keep.
    expect(plan.qa?.atomsChecked).toBe(1);
    const proposal = buildCutProposal({ plan, words: [] });
    expect(proposal.items.some((i) => i.sourceStart === 1.0 && i.sourceEnd === 2.5)).toBe(true);
    expect((proposal.agentNote ?? '').split('\n')[0]).toContain('of 3.6 s');
  });

  it('keeps that cover the whole source plan exactly as without keeps (B7)', async () => {
    const cut = resolved('tight');
    const whole = await runCutPlan('p1', 'a1', 'src.mp4', cut);
    const same = await runCutPlan('p1', 'a1', 'src.mp4', cut, [{ start: 0, end: 5 }]);
    expect(same.planPath).toBe(whole.planPath);
    expect('keeps' in same.plan).toBe(false);
    expect(same.plan.segments).toEqual(whole.plan.segments);
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
