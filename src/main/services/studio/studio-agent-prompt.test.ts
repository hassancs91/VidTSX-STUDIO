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

describe('buildAgentSystemPrompt — W3 state block and workflows', () => {
  const base = {
    projectName: 'Test',
    assets: [],
    shots: [],
    toolsAvailable: true,
    reviewOpen: false,
  };

  it('describes an empty edit and names the end-to-end tools', () => {
    const prompt = buildAgentSystemPrompt(base);
    expect(prompt).toContain('## State of the edit');
    expect(prompt).toContain('- Timeline: empty.');
    expect(prompt).toContain('- Captions: none set.');
    expect(prompt).toContain('- Open proposal: none.');
    for (const id of [
      'transcribe_asset',
      'run_auto_cut',
      'generate_video',
      'insert_asset',
      'list_assets',
      'get_brand',
      'set_captions',
      'accept_proposal',
      'export_project',
    ]) {
      expect(prompt).toContain(`\`${id}(`);
    }
    expect(prompt).toContain('Workflow for "edit this video"');
    expect(prompt).toContain('[next:');
  });

  it('names the open proposal so accept_proposal can apply it', () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      reviewOpen: true,
      openProposal: { id: 'prop_1', kind: 'cut-plan', itemCount: 12, note: 'Auto Cut (tight)' },
      captions: { templateId: 'core/word-pop', enabled: true },
      timelineDurationSeconds: 125.4,
    });
    expect(prompt).toContain('- Timeline: 2:05 long.');
    expect(prompt).toContain('- Captions: on (template core/word-pop).');
    expect(prompt).toContain('Open proposal: id "prop_1" — 12 cut items ("Auto Cut (tight)")');
    expect(prompt).toContain('call `accept_proposal` with the open proposal\'s id');
  });

  it('keeps the tool section out for chat-only providers', () => {
    const prompt = buildAgentSystemPrompt({ ...base, toolsAvailable: false });
    expect(prompt).toContain('## Tool availability');
    expect(prompt).not.toContain('transcribe_asset');
  });
});
