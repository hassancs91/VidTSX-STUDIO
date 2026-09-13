// Per-machine UI choices kept in localStorage (the left pane's tab per
// project, the media / shots density — video-10 feedback item 5). Pure over
// a Storage-like object so it tests without a DOM; a blocked or throwing
// storage degrades to the fallback instead of breaking the editor.

export interface ChoiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readStoredChoice<T extends string>(
  storage: ChoiceStorage | undefined,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const raw = storage?.getItem(key) ?? null;
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredChoice(storage: ChoiceStorage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Quota / privacy mode: the choice just isn't remembered.
  }
}
