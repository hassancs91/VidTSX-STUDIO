import { describe, expect, it, vi } from 'vitest';
import { createExclusivePlayback } from './exclusive-playback';

const player = () => ({ pause: vi.fn() });

describe('createExclusivePlayback (E3 — one sound at a time on the Assets screen)', () => {
  it('claiming a second player pauses the first, and only the first', () => {
    const playback = createExclusivePlayback();
    const tile = player();
    const details = player();
    playback.claim(tile);
    playback.claim(details);
    expect(tile.pause).toHaveBeenCalledTimes(1);
    expect(details.pause).not.toHaveBeenCalled();
    playback.claim(tile);
    expect(details.pause).toHaveBeenCalledTimes(1);
    expect(tile.pause).toHaveBeenCalledTimes(1);
  });

  it('re-claiming the current player pauses nothing', () => {
    const playback = createExclusivePlayback();
    const tile = player();
    playback.claim(tile);
    playback.claim(tile);
    expect(tile.pause).not.toHaveBeenCalled();
  });

  it('release forgets only the current player', () => {
    const playback = createExclusivePlayback();
    const tile = player();
    const details = player();
    playback.claim(tile);
    playback.release(details);
    playback.claim(details);
    expect(tile.pause).toHaveBeenCalledTimes(1);
    playback.release(details);
    playback.claim(tile);
    expect(details.pause).not.toHaveBeenCalled();
  });
});
