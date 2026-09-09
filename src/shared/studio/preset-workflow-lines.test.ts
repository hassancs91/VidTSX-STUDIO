import { describe, expect, it } from 'vitest';
import { describeWorkflowStep, formatWorkflowLines, parseWorkflowLines } from './preset-workflow-lines';

describe('parseWorkflowLines', () => {
  it('parses the compact form in order, skipping blanks and comments', () => {
    const { steps, errors } = parseWorkflowLines(
      '# the short\ntranscribe:assemblyai/universal\n\nauto_cut:aggressive\neditorial\nshots:4\nbroll:library\ncaptions:core/word-pop\nexport:h264',
    );
    expect(errors).toEqual([]);
    expect(steps).toEqual([
      { id: 'transcribe', engine: 'assemblyai/universal' },
      { id: 'auto_cut', aggressiveness: 'aggressive' },
      { id: 'editorial' },
      { id: 'shots', cadence: 4 },
      { id: 'broll', source: 'library' },
      { id: 'captions', template: 'core/word-pop' },
      { id: 'export', renderPreset: 'h264' },
    ]);
  });

  it('reports unknown steps, bad params and duplicates instead of dropping them silently', () => {
    const { steps, errors } = parseWorkflowLines('dance\nauto_cut:brutal\nshots:many\nsfx\nsfx');
    expect(steps).toEqual([{ id: 'sfx' }]);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toMatch(/Unknown step "dance"/);
    expect(errors[1]).toMatch(/"brutal" is not a valid value for auto_cut/);
    expect(errors[2]).toMatch(/"many" is not a valid value for shots/);
    expect(errors[3]).toMatch(/appears twice/);
  });

  it('round-trips through formatWorkflowLines', () => {
    const text = 'transcribe\nauto_cut:light\neditorial\nshots:1.5\nbroll:generate\nsfx\nmusic\ncaptions:core/karaoke\nexport';
    expect(formatWorkflowLines(parseWorkflowLines(text).steps)).toBe(text);
  });
});

describe('describeWorkflowStep', () => {
  it('reads as prose for the agent', () => {
    expect(describeWorkflowStep({ id: 'auto_cut', aggressiveness: 'light' })).toBe('auto_cut (light)');
    expect(describeWorkflowStep({ id: 'shots', cadence: 2 })).toBe('shots (about 2 per minute)');
    expect(describeWorkflowStep({ id: 'broll', source: 'library' })).toBe('b-roll (from the library first)');
    expect(describeWorkflowStep({ id: 'editorial' })).toBe('editorial pass (propose_cuts)');
  });
});
