import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { TransitionItem } from '../../../shared/studio/transition-pack';

let tmpDir = '';
let installed: TransitionItem[] = [];
const transpile = vi.fn(async (_code: string) => ({ success: true as boolean, error: undefined as string | undefined }));
const list = vi.fn(async () => installed);

vi.mock('electron', () => ({ app: { getPath: () => tmpDir, getVersion: () => '1.2.0', isPackaged: false } }));
vi.mock('./transition-packs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./transition-packs')>()),
  listTransitions: () => list(),
}));
vi.mock('../../ipc/tsx-handlers', () => ({ validateTsxCode: (code: string) => transpile(code) }));
vi.mock('../font-proxy', () => ({ rewriteFontUrls: (source: string) => `/* fonts */${source}` }));

import { prepareTransitionSources } from './export-transitions';

const GOOD = `import React from 'react';\nexport default function T() { return null; }\n`;
const BAD = `import React from 'react';\nimport gsap from 'gsap';\nexport default function T() { return null; }\n`;

function item(kind: string, file: string): TransitionItem {
  const [packId, id] = kind.split('/');
  return {
    id, name: id, kind, packId, packName: packId, durationSeconds: 0.7, sceneCopies: 'single', version: '1.0.0',
    filePath: path.join(tmpDir, file),
  };
}

const timeline = (...kinds: string[]) => ({
  tracks: [
    {
      clips: kinds.map((kind, i) => ({ id: `c${i}`, transitionOut: { kind, frames: 21 } })),
    },
  ],
}) as unknown as Parameters<typeof prepareTransitionSources>[0];

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-export-transitions-'));
  await fs.writeFile(path.join(tmpDir, 'good.tsx'), GOOD);
  await fs.writeFile(path.join(tmpDir, 'bad.tsx'), BAD);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  installed = [item('core/push-left', 'good.tsx'), item('core/staggered-tiles', 'good.tsx'), item('shady/wipe', 'bad.tsx')];
  list.mockClear();
  transpile.mockClear();
});

describe('prepareTransitionSources', () => {
  it('does nothing for a timeline without pack transitions', async () => {
    expect(await prepareTransitionSources(timeline('crossfade', 'dip-to-black'), 'p1', 'http://x')).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('prepares one normalized copy per kind the timeline uses', async () => {
    const prepared = await prepareTransitionSources(
      timeline('core/staggered-tiles', 'crossfade', 'core/push-left', 'core/push-left'),
      'p1',
      'http://x',
    );
    expect(prepared.map((p) => [p.ref.shotId, p.ref.identifier])).toEqual([
      ['core/push-left', 'Transition_0'],
      ['core/staggered-tiles', 'Transition_1'],
    ]);
    expect(prepared[0].source).toBe(`/* fonts */${GOOD}`);
    expect(transpile).toHaveBeenCalledTimes(2);
  });

  it('leaves an uninstalled kind to the crossfade instead of failing', async () => {
    const prepared = await prepareTransitionSources(timeline('gone/whoosh', 'core/push-left'), 'p1', 'http://x');
    expect(prepared.map((p) => [p.ref.shotId, p.ref.identifier])).toEqual([['core/push-left', 'Transition_0']]);
  });

  it('stops the export when an installed transition breaks the import rules', async () => {
    await expect(prepareTransitionSources(timeline('shady/wipe'), 'p1', 'http://x')).rejects.toThrow(
      /Transition "wipe" \(shady\/wipe\): Import "gsap" is not allowed/,
    );
  });

  it('stops the export when an installed transition does not transpile', async () => {
    transpile.mockResolvedValueOnce({ success: false, error: 'Unexpected token' });
    await expect(prepareTransitionSources(timeline('core/push-left'), 'p1', 'http://x')).rejects.toThrow(
      'Transition "push-left" (core/push-left) failed export validation: Unexpected token',
    );
  });
});
