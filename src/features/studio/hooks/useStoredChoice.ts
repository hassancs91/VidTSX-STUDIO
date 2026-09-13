import { useCallback, useEffect, useState } from 'react';
import { readStoredChoice, writeStoredChoice } from '../services/stored-choice';

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * A small UI choice remembered per machine in localStorage (the left pane's
 * tab per project, grid/list density — video-10 feedback item 5). Re-reads
 * when the key changes, so a per-project key follows the open project.
 */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readStoredChoice(storage(), key, allowed, fallback));

  useEffect(() => {
    setValue(readStoredChoice(storage(), key, allowed, fallback));
    // `allowed` is a module constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      writeStoredChoice(storage(), key, next);
    },
    [key],
  );

  return [value, set];
}
