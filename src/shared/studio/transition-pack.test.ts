import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  DEFAULT_TRANSITION_SECONDS,
  parseTransitionEntries,
  parseTransitionKind,
  parseTransitionPack,
  referencedTransitionKinds,
} from './transition-pack';
import type { SerializedTimeline } from './serialize';

const APP = '1.2.0';

const pack = (overrides: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  id: 'core',
  name: 'Core Transitions',
  version: '1.0.0',
  transitions: [{ id: 'push-left', name: 'Push left', durationSeconds: 0.7, sceneCopies: 'single', version: '1.0.0' }],
  ...overrides,
});

describe('parseTransitionPack', () => {
  it('reads the shipped core pack', () => {
    const raw: unknown = JSON.parse(
      readFileSync(path.join(__dirname, '../../../resources/packs/core/pack.json'), 'utf-8'),
    );
    const parsed = parseTransitionPack(raw, 'core', APP);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.manifest.name).toBe('Core');
    // The everyday four (P6). Every core item is single-copy: the heavy ones
    // ship in the importable Volume 01 pack.
    expect(parsed.entries.map((e) => [e.id, e.durationSeconds, e.sceneCopies])).toEqual([
      ['push-left', 0.7, 'single'],
      ['wipe-right', 0.7, 'single'],
      ['zoom-through', 0.8, 'single'],
      ['iris-open', 0.9, 'single'],
    ]);
  });

  it('takes the folder name as the id, whatever the file says', () => {
    const parsed = parseTransitionPack(pack({ id: 'something-else' }), 'core', APP);
    expect(parsed.ok && parsed.manifest.id).toBe('core');
  });

  it('passes over a caption pack in the same root without complaint', () => {
    const parsed = parseTransitionPack({ id: 'hormozi', type: 'caption-style', version: '1.0.0' }, 'hormozi', APP);
    expect(parsed).toEqual({ ok: false, reason: 'no transitions[]', silent: true });
  });

  it('refuses a folder name that is not a safe slug', () => {
    const parsed = parseTransitionPack(pack(), 'Core Pack', APP);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.silent).toBeFalsy();
  });

  it('refuses an unknown container format', () => {
    expect(parseTransitionPack(pack({ formatVersion: 2 }), 'core', APP).ok).toBe(false);
    expect(parseTransitionPack(pack({ formatVersion: undefined }), 'core', APP).ok).toBe(false);
  });

  it('enforces minAppVersion', () => {
    expect(parseTransitionPack(pack({ minAppVersion: '1.3.0' }), 'core', APP)).toMatchObject({
      ok: false,
      reason: 'needs VidTSX 1.3.0 (this app is 1.2.0)',
    });
    expect(parseTransitionPack(pack({ minAppVersion: '1.2.0' }), 'core', APP).ok).toBe(true);
    expect(parseTransitionPack(pack({ minAppVersion: '1.1.9' }), 'core', APP).ok).toBe(true);
  });

  it('fills a missing name and version', () => {
    const parsed = parseTransitionPack(pack({ name: '  ', version: undefined }), 'core', APP);
    expect(parsed.ok && [parsed.manifest.name, parsed.manifest.version]).toEqual(['core', '0.0.0']);
  });
});

describe('parseTransitionEntries', () => {
  it('drops malformed entries one by one', () => {
    const entries = parseTransitionEntries([
      null,
      'push-left',
      { id: 'Bad Id' },
      { id: '../escape' },
      { id: 'ok-one' },
      { id: 'ok-one', name: 'duplicate' },
      { id: 'zero', durationSeconds: 0 },
      { id: 'text', durationSeconds: '0.7' },
      { id: 'infinite', durationSeconds: Number.POSITIVE_INFINITY },
      { id: 'ok-two', durationSeconds: 1.5, sceneCopies: 'multi', tier: 'advanced', usage: 'Lists.' },
    ]);
    expect(entries).toEqual([
      { id: 'ok-one', name: 'ok-one', durationSeconds: DEFAULT_TRANSITION_SECONDS, sceneCopies: 'single', version: '0.0.0' },
      {
        id: 'ok-two',
        name: 'ok-two',
        durationSeconds: 1.5,
        sceneCopies: 'multi',
        version: '0.0.0',
        tier: 'advanced',
        usage: 'Lists.',
      },
    ]);
  });

  it('treats an unknown sceneCopies as single', () => {
    expect(parseTransitionEntries([{ id: 'a', sceneCopies: 'many' }])[0].sceneCopies).toBe('single');
  });
});

describe('parseTransitionKind', () => {
  it('splits a namespaced id', () => {
    expect(parseTransitionKind('core/push-left')).toEqual({ packId: 'core', itemId: 'push-left' });
    expect(parseTransitionKind('imported/my-wipe')).toEqual({ packId: 'imported', itemId: 'my-wipe' });
  });

  it('leaves the engine-native kinds and unsafe ids alone', () => {
    for (const kind of ['crossfade', 'dip-to-black', 'push-left', 'core/../x', 'a/b/c', 'Core/push-left', '']) {
      expect(parseTransitionKind(kind)).toBeNull();
    }
  });
});

describe('referencedTransitionKinds', () => {
  const clip = (id: string, kind?: string) => ({
    id,
    ...(kind ? { transitionOut: { kind, frames: 21 } } : {}),
  });

  it('collects each pack transition once, sorted, across tracks', () => {
    const timeline = {
      tracks: [
        { clips: [clip('a', 'core/staggered-tiles'), clip('b', 'crossfade'), clip('c', 'core/push-left')] },
        { clips: [clip('d', 'core/push-left'), clip('e', 'dip-to-black'), clip('f', 'not a kind'), clip('g')] },
      ],
    } as unknown as SerializedTimeline;
    expect(referencedTransitionKinds(timeline)).toEqual(['core/push-left', 'core/staggered-tiles']);
  });
});
