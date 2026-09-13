import { useCallback, useSyncExternalStore } from 'react';

/**
 * How a delete or edge-trim treats the clips after it:
 *  - 'off'   — nothing moves (the gap stays).
 *  - 'track' — later clips on the SAME track close the gap (the v1 behaviour).
 *  - 'all'   — cutting the master lane pulls EVERY unlocked track along, so
 *              shots and B-roll placed against the footage stay aligned.
 *
 * One value for the whole app, remembered across sessions in localStorage —
 * pure editing ergonomics, like the pane sizes: NOT the settings KV, NOT the
 * project document. Shared as a tiny external store so the toolbar, the
 * shortcuts, the drag hook and the proposal review all read the same mode
 * without prop threading.
 */
export type RippleMode = 'off' | 'track' | 'all';

const STORAGE_KEY = 'studio.ripple.mode';
const DEFAULT_MODE: RippleMode = 'all';

function isMode(value: unknown): value is RippleMode {
  return value === 'off' || value === 'track' || value === 'all';
}

function readStored(): RippleMode {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
    return isMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

let current: RippleMode = readStored();
/** The last non-'off' mode, so toggling ripple off and on restores the choice. */
let lastOn: Exclude<RippleMode, 'off'> = current === 'off' ? DEFAULT_MODE : current;
const listeners = new Set<() => void>();

export function getRippleMode(): RippleMode {
  return current;
}

export function setRippleMode(mode: RippleMode): void {
  if (mode === current) return;
  current = mode;
  if (mode !== 'off') lastOn = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable — the mode still applies for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRippleMode(): {
  mode: RippleMode;
  rippleEnabled: boolean;
  rippleAllTracks: boolean;
  setMode: (mode: RippleMode) => void;
  /** The toolbar's Auto-ripple button: off ↔ the last on-mode. */
  toggleRipple: () => void;
  /** The toolbar's All-tracks button: 'track' ↔ 'all' (turns ripple on if it was off). */
  toggleAllTracks: () => void;
} {
  const mode = useSyncExternalStore(subscribe, getRippleMode, getRippleMode);
  const toggleRipple = useCallback(() => {
    setRippleMode(getRippleMode() === 'off' ? lastOn : 'off');
  }, []);
  const toggleAllTracks = useCallback(() => {
    setRippleMode(getRippleMode() === 'all' ? 'track' : 'all');
  }, []);
  return {
    mode,
    rippleEnabled: mode !== 'off',
    rippleAllTracks: mode === 'all',
    setMode: setRippleMode,
    toggleRipple,
    toggleAllTracks,
  };
}
