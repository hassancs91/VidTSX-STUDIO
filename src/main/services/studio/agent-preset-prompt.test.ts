import { describe, expect, it } from 'vitest';
import { composePresetBlock, describePresetStyle } from './agent-preset-prompt';
import type { StudioPresetEntry, StudioPresetStyle } from '../../../shared/types/studio-preset';

function preset(overrides: Partial<StudioPresetEntry> = {}): StudioPresetEntry {
  return {
    id: 'shorts',
    name: 'My shorts',
    description: 'Vertical and tight.',
    videoKind: 'short',
    orientation: '9:16',
    workflow: [{ id: 'transcribe' }, { id: 'auto_cut', aggressiveness: 'aggressive' }, { id: 'shots', cadence: 4 }, { id: 'captions', template: 'core/word-pop' }],
    style: { pacing: 'tight', shotsPerMinute: 4, musicBed: 'present', captions: 'karaoke', transitions: [], outroSeconds: 2 },
    body: '# Shorts\n\n## Hook\n\nFirst line is the hook.',
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('describePresetStyle', () => {
  it('names only the knobs that are set', () => {
    expect(describePresetStyle({ pacing: 'tight', transitions: [] })).toBe('pacing tight · no transitions');
    expect(describePresetStyle({})).toBe('');
    expect(describePresetStyle({ shotsPerMinute: 1.5, introSeconds: 8, transitions: ['crossfade'] })).toBe(
      'about 1.5 shots per minute · transitions crossfade · intro 8 s',
    );
  });

  it("names the preset's own cut style next to pacing (B2 fix round 1)", () => {
    // base + the knobs it sets — so "pacing tight" is not read as the cut style
    expect(describePresetStyle({ pacing: 'tight', cut: { base: 'natural', head: 0.25 } })).toBe(
      'pacing tight · cut style natural, lead-in 0.25 s',
    );
    // no base: the style its pacing maps to (normal → natural); knobs in display order
    expect(describePresetStyle({ pacing: 'normal', cut: { margin: 8, head: 0.2, fricZcr: 4000 } })).toBe(
      'pacing normal · cut style natural, lead-in 0.2 s, decay margin 8 dB, fricative ZCR 4000 /s',
    );
    // neither base nor pacing: the file default
    expect(describePresetStyle({ cut: { minTail: 0.1 } })).toBe('cut style default, tail min 0.1 s');
    // a bare base; a garbage cut is not mentioned
    expect(describePresetStyle({ cut: { base: 'relaxed' } })).toBe('cut style relaxed');
    expect(describePresetStyle({ pacing: 'relaxed', cut: { base: 'loose' } as unknown as StudioPresetStyle['cut'] })).toBe(
      'pacing relaxed',
    );
  });

  it('a preset with a cut puts it in the prompt block\'s knob line', () => {
    const block = composePresetBlock(
      preset({ style: { pacing: 'tight', cut: { base: 'natural', head: 0.25 }, captions: 'karaoke' } }),
    ).block;
    expect(block).toContain('Style knobs: pacing tight · cut style natural, lead-in 0.25 s · captions karaoke.');
  });
});

describe('composePresetBlock', () => {
  it('renders the header, the numbered workflow, the knobs and the body — deterministic', () => {
    const a = composePresetBlock(preset());
    const b = composePresetBlock(preset());
    expect(a.block).toBe(b.block);
    expect(a.truncatedBy).toBe(0);
    expect(a.block.startsWith('## Editing preset: My shorts\n\nVertical and tight.\n\n')).toBe(true);
    expect(a.block).toContain('This project is a short (9:16).');
    expect(a.block).toContain('1. transcribe\n2. auto_cut (aggressive)\n3. shots (about 4 per minute)\n4. captions (template core/word-pop)');
    expect(a.block).toContain('Style knobs: pacing tight · about 4 shots per minute · music bed present · captions karaoke · no transitions · outro 2 s.');
    expect(a.block.endsWith('# Shorts\n\n## Hook\n\nFirst line is the hook.')).toBe(true);
    expect(a.block).not.toMatch(/2026-09-09/); // no timestamps in the cached prefix
  });

  it('says so when there is no workflow and no knobs, and omits an empty body', () => {
    const { block } = composePresetBlock(preset({ workflow: [], style: {}, body: '  ', description: undefined }));
    expect(block).toContain('Workflow: none set — follow the generic order.');
    expect(block).toContain('Style knobs: none set.');
    expect(block.trim().endsWith('Style knobs: none set.')).toBe(true);
  });

  it('appends preset skills after the body as their own headed sections', () => {
    const { block } = composePresetBlock(preset(), { skills: [{ name: 'Hook rule', body: 'Hook first.\n' }] });
    expect(block).toContain('First line is the hook.\n\n### Preset skill: Hook rule\n\nHook first.');
  });

  it('cuts the body at a paragraph boundary under the budget and leaves a visible marker', () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} of the preset body, with enough words to matter.`);
    const long = preset({ body: paragraphs.join('\n\n') });
    const { block, truncatedBy } = composePresetBlock(long, { budget: 1200 });
    expect(block.length).toBeLessThanOrEqual(1200);
    expect(truncatedBy).toBeGreaterThan(0);
    expect(block).toContain('call `get_preset` to read it in full');
    // The header always rides whole.
    expect(block).toContain('4. captions (template core/word-pop)');
    // The cut lands between paragraphs, never mid-sentence.
    const kept = block.split('\n\n(… the rest')[0];
    expect(kept.endsWith('with enough words to matter.')).toBe(true);
  });

  it('keeps the whole body when it fits exactly', () => {
    const p = preset();
    const whole = composePresetBlock(p).block;
    expect(composePresetBlock(p, { budget: whole.length }).truncatedBy).toBe(0);
    expect(composePresetBlock(p, { budget: whole.length - 1 }).truncatedBy).toBeGreaterThan(0);
  });
});
