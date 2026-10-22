import { useEffect, useState } from 'react';
import type { CutStyleFile } from '@shared/types/studio-cut-plan';

export interface CutStyleFileState {
  /** Null until main answers (and after a failure). */
  file: CutStyleFile | null;
  error: string | null;
}

/**
 * The shipped cut styles (B2) for the preset editor's Cut section — main reads
 * and parses cut-style.json; the form only needs each base's knob values.
 * Asked once per mount: the file ships with the app and never changes at run time.
 */
export function useCutStyleFile(): CutStyleFileState {
  const [state, setState] = useState<CutStyleFileState>({ file: null, error: null });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await window.api.studioCutStyleFile();
        if (!alive) return;
        setState(
          res.success && res.file
            ? { file: res.file, error: null }
            : { file: null, error: res.error ?? 'Could not read the cut styles' },
        );
      } catch (err) {
        if (alive) setState({ file: null, error: err instanceof Error ? err.message : String(err) });
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
