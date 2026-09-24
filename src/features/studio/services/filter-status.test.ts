import { describe, expect, it } from 'vitest';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { StudioTimeline } from '../types';
import { effectName, effectStatuses } from './filter-status';

const info = (kind: string, name: string, category: 'filter' | 'effect'): StudioFilterInfo => ({
  kind, name, packId: 'core', packName: 'Core', category, animated: false, defaultIntensity: 1,
  parameters: [], presets: [], heavy: false, version: '1.0.0',
});
const INSTALLED = new Map([['core/noir', info('core/noir', 'Noir', 'filter')], ['core/vhs', info('core/vhs', 'VHS Club', 'effect')]]);

const timeline: StudioTimeline = {
  tracks: [{
    id: 'v1', kind: 'video', name: 'V1',
    clips: [
      { id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, effects: [{ kind: 'core/noir' }, { kind: 'core/vhs', disabled: true }] },
      { id: 'b', kind: 'video', assetId: 'x', timelineStart: 4, duration: 4, effects: [{ kind: 'gone/thing' }, { kind: 'core/noir' }] },
      { id: 'c', kind: 'video', assetId: 'x', timelineStart: 8, duration: 4 },
      { id: 'd', kind: 'video', assetId: 'x', timelineStart: 12, duration: 4, effects: [{ kind: 'core/noir', disabled: true }] },
    ],
  }],
};

describe('effectStatuses', () => {
  it('names entries from the installed list, labels the live ones and warns on a missing pack', () => {
    const statuses = effectStatuses(timeline, INSTALLED);
    expect([...statuses.keys()]).toEqual(['a', 'b', 'd']);
    expect(statuses.get('a')).toEqual({
      entries: [
        { kind: 'core/noir', name: 'Noir', category: 'filter', disabled: false, installed: true },
        { kind: 'core/vhs', name: 'VHS Club', category: 'effect', disabled: true, installed: true },
      ],
      label: 'Noir',
    });
    expect(statuses.get('b')).toMatchObject({ label: 'gone/thing + Noir', warning: 'not-installed' });
    expect(statuses.get('b')?.entries[0]).toEqual({ kind: 'gone/thing', name: 'gone/thing', disabled: false, installed: false });
    expect(statuses.get('d')).toEqual({ entries: [{ kind: 'core/noir', name: 'Noir', category: 'filter', disabled: true, installed: true }], label: 'off' });
  });

  it('never warns while the list is loading', () => {
    const statuses = effectStatuses(timeline, null);
    expect(statuses.get('b')?.warning).toBeUndefined();
    expect(statuses.get('b')?.entries[0].installed).toBe(true);
    expect(effectName('core/noir', null)).toBe('core/noir');
    expect(effectName('core/noir', INSTALLED)).toBe('Noir');
  });
});
