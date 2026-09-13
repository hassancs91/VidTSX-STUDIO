import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPTION_STYLE } from '@shared/studio';
import type { StudioCaptionLayer } from '../types';
import { timelineReducer, type TimelineAction } from '../hooks/useTimeline';
import {
  applyCaptionTemplate,
  removeCaptions,
  setCaptionsEnabled,
  updateCaptionStyle,
} from './caption-ops';

const LAYER: StudioCaptionLayer = {
  templateId: 'core/word-pop',
  enabled: true,
  style: DEFAULT_CAPTION_STYLE,
};

describe('caption-ops (identity on reject)', () => {
  it('first apply seeds the style from the pack defaults', () => {
    const layer = applyCaptionTemplate(null, 'core/karaoke', { scale: 1.15, wordsPerGroup: 2 });
    expect(layer).toEqual({
      templateId: 'core/karaoke',
      enabled: true,
      style: { ...DEFAULT_CAPTION_STYLE, scale: 1.15, wordsPerGroup: 2 },
    });
  });

  it('switching templates KEEPS the configured style', () => {
    const styled = updateCaptionStyle(LAYER, { position: 'top', scale: 1.5 });
    const switched = applyCaptionTemplate(styled, 'core/karaoke', { scale: 0.5 });
    expect(switched?.templateId).toBe('core/karaoke');
    expect(switched?.style).toMatchObject({ position: 'top', scale: 1.5 });
  });

  it('re-applying the active template changes nothing (no undo step)', () => {
    expect(applyCaptionTemplate(LAYER, 'core/word-pop')).toBe(LAYER);
  });

  it('re-applying a DISABLED layer re-enables it', () => {
    const off = setCaptionsEnabled(LAYER, false);
    expect(applyCaptionTemplate(off, 'core/word-pop')?.enabled).toBe(true);
  });

  it('style edits clamp and no-op when nothing moves', () => {
    expect(updateCaptionStyle(LAYER, { scale: 1 })).toBe(LAYER);
    expect(updateCaptionStyle(LAYER, { scale: 99 })?.style.scale).toBe(2);
    expect(updateCaptionStyle(null, { scale: 2 })).toBeNull();
  });

  it('disable keeps the style; remove drops the layer', () => {
    const off = setCaptionsEnabled(LAYER, false);
    expect(off).toMatchObject({ enabled: false, style: DEFAULT_CAPTION_STYLE });
    expect(setCaptionsEnabled(off, false)).toBe(off);
    expect(removeCaptions(LAYER)).toBeNull();
    expect(removeCaptions(null)).toBeNull();
  });
});

function reduce(...actions: TimelineAction[]) {
  return actions.reduce(
    timelineReducer,
    timelineReducer(
      {
        projectId: null,
        past: [],
        present: { timeline: { tracks: [] }, proposals: [], shots: [], captions: null, removedAssets: [] },
        future: [],
      },
      {
        type: 'reset',
        projectId: 'p',
        timeline: { tracks: [] },
        proposals: [],
        shots: [],
        captions: null,
      },
    ),
  );
}

describe('caption actions in the undoable slice', () => {
  it('apply → style → disable are three undo steps that round-trip', () => {
    const state = reduce(
      { type: 'caption-apply', templateId: 'core/word-pop' },
      { type: 'caption-style', patch: { position: 'center' } },
      { type: 'caption-enabled', enabled: false },
    );
    expect(state.present.captions).toMatchObject({
      templateId: 'core/word-pop',
      enabled: false,
      style: { position: 'center' },
    });
    expect(state.past).toHaveLength(3);

    const undone = timelineReducer(state, { type: 'undo' });
    expect(undone.present.captions).toMatchObject({ enabled: true, style: { position: 'center' } });
    const twice = timelineReducer(undone, { type: 'undo' });
    expect(twice.present.captions?.style.position).toBe('bottom');
    const back = timelineReducer(timelineReducer(twice, { type: 'redo' }), { type: 'redo' });
    expect(back.present.captions).toEqual(state.present.captions);
  });

  it('a rejected caption edit creates no undo step', () => {
    const applied = reduce({ type: 'caption-apply', templateId: 'core/word-pop' });
    const same = timelineReducer(applied, { type: 'caption-apply', templateId: 'core/word-pop' });
    expect(same).toBe(applied);
    expect(timelineReducer(applied, { type: 'caption-style', patch: { scale: 1 } })).toBe(applied);
  });

  it('remove drops the layer and undo brings it back with its style', () => {
    const applied = reduce(
      { type: 'caption-apply', templateId: 'core/karaoke' },
      { type: 'caption-style', patch: { uppercase: true } },
    );
    const removed = timelineReducer(applied, { type: 'caption-remove' });
    expect(removed.present.captions).toBeNull();
    expect(timelineReducer(removed, { type: 'undo' }).present.captions).toMatchObject({
      templateId: 'core/karaoke',
      style: { uppercase: true },
    });
    // Removing when there is nothing to remove is not an undo step.
    expect(timelineReducer(removed, { type: 'caption-remove' })).toBe(removed);
  });

  it('unrelated actions carry the caption layer through untouched', () => {
    const applied = reduce({ type: 'caption-apply', templateId: 'core/word-pop' });
    const next = timelineReducer(applied, { type: 'track-add', kind: 'video' });
    expect(next.present.captions).toBe(applied.present.captions);
  });
});
