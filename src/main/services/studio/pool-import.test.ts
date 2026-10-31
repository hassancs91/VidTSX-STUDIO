// The pool import's `usedIn` landing (T6, E2 — verifier round 1 N3): the handler calls this seam, so removing the
// mark fails here. The import and the index patch are mocked; the order and the arguments are what is pinned.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioMediaAsset } from '../../../shared/types/studio';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  importMediaFiles: vi.fn(),
  markLibraryUsedInForPaths: vi.fn(),
}));

vi.mock('./media-import', () => ({ importMediaFiles: mocks.importMediaFiles }));
vi.mock('../library/library-used-in', () => ({ markLibraryUsedInForPaths: mocks.markLibraryUsedInForPaths }));

import { importMediaFilesMarkingLibrary } from './pool-import';

const asset = (id: string, p: string): StudioMediaAsset => ({
  id,
  kind: 'audio',
  path: p,
  probe: { duration: 2, hasAudio: true },
});

describe('importMediaFilesMarkingLibrary — the pool import marks usedIn (E2)', () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    mocks.importMediaFiles.mockReset();
    mocks.markLibraryUsedInForPaths.mockReset();
    mocks.markLibraryUsedInForPaths.mockImplementation(async () => {
      mocks.calls.push('mark');
    });
  });

  it('imports, then marks every imported asset path with the project id, and returns the import as is', async () => {
    const result = {
      assets: [asset('a1', 'C:/lib/generated/sfx-hit.mp3'), asset('a2', 'D:/elsewhere/voice.wav')],
      errors: ['bad.xyz: unsupported'],
    };
    mocks.importMediaFiles.mockImplementation(async () => {
      mocks.calls.push('import');
      return result;
    });

    const out = await importMediaFilesMarkingLibrary('p1', ['C:/lib/generated/sfx-hit.mp3', 'D:/elsewhere/voice.wav', 'bad.xyz']);

    expect(out).toBe(result);
    expect(mocks.importMediaFiles).toHaveBeenCalledWith('p1', ['C:/lib/generated/sfx-hit.mp3', 'D:/elsewhere/voice.wav', 'bad.xyz']);
    // Outside-root paths are dropped by the helper (its own test) — the seam passes every imported path.
    expect(mocks.markLibraryUsedInForPaths).toHaveBeenCalledTimes(1);
    expect(mocks.markLibraryUsedInForPaths).toHaveBeenCalledWith('p1', ['C:/lib/generated/sfx-hit.mp3', 'D:/elsewhere/voice.wav']);
    expect(mocks.calls).toEqual(['import', 'mark']);
  });

  it('a failed import throws and marks nothing', async () => {
    mocks.importMediaFiles.mockRejectedValue(new Error('Project not found: p1'));
    await expect(importMediaFilesMarkingLibrary('p1', ['C:/lib/x.mp3'])).rejects.toThrow(/Project not found/);
    expect(mocks.markLibraryUsedInForPaths).not.toHaveBeenCalled();
  });
});
