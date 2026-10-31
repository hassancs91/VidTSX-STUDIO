/**
 * A tiny stand-in for React's hook runtime, for hook-level unit tests in the
 * Node test environment (no DOM, no renderer). Use it as the module mock:
 *
 *   vi.mock('react', async (importOriginal) => ({
 *     ...(await importOriginal<Record<string, unknown>>()),
 *     ...(await import('./hook-test-runtime')).fakeReact,
 *   }));
 *
 * `renderHookOnce` calls the hook once, runs its effects, and returns an
 * `unmount` that runs their cleanups. State setters write through to the
 * slot (no re-render); memos and callbacks are not cached. Enough to test the
 * WIRING of a hook — what it calls on mount, on an event, on unmount.
 */

type Cleanup = void | (() => void);

let slots: unknown[] = [];
let cursor = 0;
let effects: Array<() => Cleanup> = [];

function nextSlot<T>(init: () => T): { index: number; value: T } {
  const index = cursor;
  cursor += 1;
  if (!(index in slots)) slots[index] = init();
  return { index, value: slots[index] as T };
}

export const fakeReact = {
  useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
    const { index, value } = nextSlot<T>(() =>
      typeof initial === 'function' ? (initial as () => T)() : initial,
    );
    const set = (next: T | ((prev: T) => T)) => {
      slots[index] = typeof next === 'function' ? (next as (prev: T) => T)(slots[index] as T) : next;
    };
    return [value, set];
  },
  useRef<T>(initial: T): { current: T } {
    return nextSlot(() => ({ current: initial })).value;
  },
  useMemo<T>(factory: () => T): T {
    return factory();
  },
  useCallback<T>(fn: T): T {
    return fn;
  },
  useEffect(effect: () => Cleanup): void {
    effects.push(effect);
  },
};

/** The current value of the hook's n-th state/ref slot (in call order). */
export function hookSlot<T>(index: number): T {
  return slots[index] as T;
}

export function renderHookOnce<R>(hook: () => R): {
  result: R;
  /** Call the hook again over the same slots (effects are not re-run). */
  rerender: () => R;
  unmount: () => void;
} {
  slots = [];
  cursor = 0;
  effects = [];
  const result = hook();
  const cleanups = effects.map((effect) => effect()).filter((c): c is () => void => typeof c === 'function');
  return {
    result,
    rerender: () => {
      cursor = 0;
      effects = [];
      return hook();
    },
    unmount: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
}
