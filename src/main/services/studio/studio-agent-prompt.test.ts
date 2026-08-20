import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, formatShotLine } from './studio-agent-prompt';
import type { StudioShot } from '@shared/types/studio';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'intro-title',
    name: 'Intro title',
    kind: 'title',
    createdAt: '2026-08-19T00:00:00.000Z',
    activeVersion: 1,
    status: 'ready',
    config: { durationInFrames: 150, fps: 30, width: 1920, height: 1080 },
    anchor: { assetId: 'asset-1', sourceStart: 2.26, sourceEnd: 7.5 },
    ...overrides,
  };
}

describe('formatShotLine', () => {
  it('renders id, kind, duration, version, status, and anchor', () => {
    const line = formatShotLine(shot());
    expect(line).toContain('intro-title');
    expect(line).toContain('"Intro title"');
    expect(line).toContain('title, 5.0 s, v1, ready');
    expect(line).toContain('anchored to asset-1 2.3–7.5s');
  });

  it('marks unanchored shots and unknown durations', () => {
    const line = formatShotLine(
      shot({ config: undefined, anchor: undefined, kind: 'cutaway' }),
    );
    expect(line).toContain('unknown length');
    expect(line).toContain('unanchored');
  });

  it('marks user-imported shots', () => {
    expect(formatShotLine(shot({ origin: { by: 'user' } }))).toContain('imported');
    expect(formatShotLine(shot({ origin: { by: 'agent' } }))).not.toContain('imported');
  });
});

describe('buildAgentSystemPrompt — shot pool section', () => {
  const base = {
    projectName: 'Test',
    assets: [],
    toolsAvailable: true,
    reviewOpen: false,
  };

  it('lists pool shots with the persistence guidance', () => {
    const prompt = buildAgentSystemPrompt({ ...base, shots: [shot()] });
    expect(prompt).toContain('## Shot pool');
    expect(prompt).toContain('intro-title');
    expect(prompt).toContain('persist across sessions');
    expect(prompt).toContain('list_shots');
  });

  it('shows the empty-pool placeholder when there are no shots', () => {
    const prompt = buildAgentSystemPrompt({ ...base, shots: [] });
    expect(prompt).toContain('(empty — no shots generated or imported yet)');
  });
});
