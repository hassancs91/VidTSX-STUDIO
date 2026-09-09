import { describe, expect, it } from 'vitest';
import {
  normalizePreset,
  normalizePresetBody,
  normalizePresetWorkflow,
  validatePresetInput,
  type StudioPresetInput,
} from './preset';
import { PRESET_BODY_MAX } from '../types/studio-preset';

const INPUT: StudioPresetInput = {
  name: 'My shorts',
  videoKind: 'short',
  orientation: '9:16',
  workflow: [{ id: 'transcribe' }, { id: 'auto_cut', aggressiveness: 'aggressive' }, { id: 'captions', template: 'core/word-pop' }],
  style: { pacing: 'tight', shotsPerMinute: 4, captions: 'karaoke' },
  body: '# My shorts\n\nHook first.',
};

describe('validatePresetInput', () => {
  it('accepts a well-formed input', () => {
    expect(validatePresetInput(INPUT)).toEqual([]);
  });

  it('rejects a short name, unknown kinds, duplicate steps and out-of-range knobs', () => {
    const errors = validatePresetInput({
      ...INPUT,
      name: 'x',
      videoKind: 'reel' as never,
      workflow: [{ id: 'shots' }, { id: 'shots' }, { id: 'dance' as never }],
      style: { shotsPerMinute: 99, pacing: 'frantic' as never },
    });
    expect(errors.join(' ')).toMatch(/at least 2 characters/);
    expect(errors.join(' ')).toMatch(/Video kind/);
    expect(errors.join(' ')).toMatch(/appears twice/);
    expect(errors.join(' ')).toMatch(/Unknown workflow step "dance"/);
    expect(errors.join(' ')).toMatch(/Shots per minute/);
    expect(errors.join(' ')).toMatch(/Pacing/);
  });

  it('caps the body', () => {
    expect(validatePresetInput({ ...INPUT, body: 'x'.repeat(PRESET_BODY_MAX + 1) }).join(' ')).toMatch(/PRESET.md is limited/);
  });
});

describe('normalizePresetWorkflow', () => {
  it('keeps order, drops unknown ids and repeated steps, and drops bad params', () => {
    const steps = normalizePresetWorkflow([
      { id: 'captions', template: 'core/karaoke' },
      { id: 'auto_cut', aggressiveness: 'brutal' },
      { id: 'nope' },
      { id: 'shots', cadence: 3 },
      { id: 'captions', template: 'again' },
      { id: 'export', renderPreset: 'line\nbreak' },
    ]);
    expect(steps).toEqual([
      { id: 'captions', template: 'core/karaoke' },
      { id: 'auto_cut' },
      { id: 'shots', cadence: 3 },
      { id: 'export' },
    ]);
  });

  it('is [] for anything that is not an array', () => {
    expect(normalizePresetWorkflow(undefined)).toEqual([]);
    expect(normalizePresetWorkflow('transcribe')).toEqual([]);
  });
});

describe('normalizePreset', () => {
  it('takes the id from the folder and fills defaults', () => {
    const preset = normalizePreset({ name: ' Lessons ', workflow: [{ id: 'editorial' }] }, 'lessons');
    expect(preset).not.toBeNull();
    expect(preset?.id).toBe('lessons');
    expect(preset?.name).toBe('Lessons');
    expect(preset?.videoKind).toBe('custom');
    expect(preset?.workflow).toEqual([{ id: 'editorial' }]);
    expect(preset?.style).toEqual({});
    expect(preset?.learned).toBeUndefined();
    expect(typeof preset?.createdAt).toBe('string');
  });

  it('returns null without a name', () => {
    expect(normalizePreset({ workflow: [] }, 'x')).toBeNull();
    expect(normalizePreset('nope', 'x')).toBeNull();
  });

  it('keeps well-formed learned entries and drops broken ones', () => {
    const preset = normalizePreset(
      {
        name: 'A',
        learned: [{ projectId: 'p1', at: '2026-09-09T00:00:00.000Z', summary: ' tighter ' }, { projectId: 'p2' }],
      },
      'a',
    );
    expect(preset?.learned).toEqual([{ projectId: 'p1', at: '2026-09-09T00:00:00.000Z', summary: 'tighter' }]);
  });

  it('drops unknown style values and out-of-range numbers, keeps the rest', () => {
    const preset = normalizePreset(
      { name: 'A', style: { pacing: 'tight', shotsPerMinute: -1, musicBed: 'loud', transitions: ['crossfade', '', 7], introSeconds: 5 } },
      'a',
    );
    expect(preset?.style).toEqual({ pacing: 'tight', transitions: ['crossfade'], introSeconds: 5 });
  });

  it('keeps an explicit empty transitions list — "hard cuts only" is a knob, not an absence', () => {
    expect(normalizePreset({ name: 'A', style: { transitions: [] } }, 'a')?.style).toEqual({ transitions: [] });
    expect(normalizePreset({ name: 'A', style: {} }, 'a')?.style).toEqual({});
  });
});

describe('normalizePresetBody', () => {
  it('normalises line endings, trims the end and caps', () => {
    expect(normalizePresetBody('a\r\nb  \n\n')).toBe('a\nb');
    expect(normalizePresetBody(42)).toBe('');
    expect(normalizePresetBody('x'.repeat(PRESET_BODY_MAX + 5)).length).toBe(PRESET_BODY_MAX);
  });
});
