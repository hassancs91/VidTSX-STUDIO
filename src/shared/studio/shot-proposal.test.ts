import { describe, it, expect } from 'vitest';
import type { StudioShot } from '../types/studio';
import { buildShotPlanProposal, SHOTS_PER_PASS_CAP } from './shot-proposal';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'shot-a',
    name: 'Stat card',
    kind: 'cutaway',
    createdAt: '',
    activeVersion: 1,
    status: 'ready',
    config: { durationInFrames: 120, fps: 30, width: 1920, height: 1080 },
    ...overrides,
  };
}

describe('buildShotPlanProposal', () => {
  it('builds one shot-plan proposal, every item starting accepted', () => {
    const proposal = buildShotPlanProposal(
      [{ shot: shot() }, { shot: shot({ id: 'shot-b', kind: 'overlay' }) }],
      'Two shots for the intro',
    );
    expect(proposal.kind).toBe('shot-plan');
    expect(proposal.status).toBe('proposed');
    expect(proposal.agentNote).toBe('Two shots for the intro');
    expect(proposal.items).toHaveLength(2);
    expect(proposal.items.every((i) => i.status === 'accepted')).toBe(true);
  });

  it('anchored shots carry their anchor as source-anchored placement fields', () => {
    const anchored = shot({
      kind: 'title',
      anchor: { assetId: 'asset-1', sourceStart: 12.5, sourceEnd: 15.0 },
    });
    const item = buildShotPlanProposal([{ shot: anchored }], 's').items[0];
    expect(item.assetId).toBe('asset-1');
    expect(item.sourceStart).toBe(12.5);
    expect(item.sourceEnd).toBe(15.0);
    expect(item.timelineStart).toBeUndefined();
  });

  it('unanchored shots keep only the stored timelineStart fallback', () => {
    const item = buildShotPlanProposal([{ shot: shot(), timelineStart: 42 }], 's').items[0];
    expect(item.assetId).toBeUndefined();
    expect(item.timelineStart).toBe(42);
  });

  it('mode defaults from the shot kind (title → overlay) and is overridable', () => {
    expect(buildShotPlanProposal([{ shot: shot({ kind: 'title' }) }], 's').items[0].mode).toBe('overlay');
    expect(buildShotPlanProposal([{ shot: shot() }], 's').items[0].mode).toBe('cutaway');
    expect(buildShotPlanProposal([{ shot: shot(), mode: 'overlay' }], 's').items[0].mode).toBe('overlay');
  });

  it('duration comes from the shot config; absent config leaves it undefined', () => {
    expect(buildShotPlanProposal([{ shot: shot() }], 's').items[0].duration).toBe(4);
    const noConfig = shot();
    delete noConfig.config;
    expect(buildShotPlanProposal([{ shot: noConfig }], 's').items[0].duration).toBeUndefined();
  });

  it('note falls back to the shot name', () => {
    expect(buildShotPlanProposal([{ shot: shot() }], 's').items[0].note).toBe('Stat card');
    expect(buildShotPlanProposal([{ shot: shot(), note: 'why' }], 's').items[0].note).toBe('why');
  });

  it('the per-pass cap the tool enforces is 10 (D8 Rev 2)', () => {
    expect(SHOTS_PER_PASS_CAP).toBe(10);
  });
});
