/**
 * One sound at a time on the Assets screen (E3): every player — the screen's one
 * shared tile `<audio>` and the details panel's `<audio controls>` — claims the
 * slot when it starts, which pauses whichever player held it. Pure (anything
 * with `pause()`), unit-tested without a DOM.
 */

export interface Pausable {
  pause(): void;
}

export interface ExclusivePlayback {
  /** `player` is starting: pause the current one if it is another player. */
  claim(player: Pausable): void;
  /** `player` stopped on its own: forget it if it holds the slot. */
  release(player: Pausable): void;
}

export function createExclusivePlayback(): ExclusivePlayback {
  let current: Pausable | null = null;
  return {
    claim(player) {
      if (current && current !== player) current.pause();
      current = player;
    },
    release(player) {
      if (current === player) current = null;
    },
  };
}
