import { useState, useEffect, useCallback, useMemo } from 'react';
import { extractComponentProps } from '../services/props-parser';
import type { ExtractedProp, PropValue } from '../types';

const PARSE_DEBOUNCE_MS = 300;

export interface UsePropsExtractorResult {
  /** Editable props extracted from the composition's default export. */
  props: ExtractedProp[];
  /** Values the user has changed (keyed by prop name). */
  overrides: Record<string, PropValue>;
  /** Overrides shaped for the Remotion Player, or undefined when untouched. */
  inputProps: Record<string, PropValue> | undefined;
  setValue: (name: string, value: PropValue) => void;
  reset: () => void;
}

/**
 * Extracts editable props from TSX source (debounced re-parse on edit) and
 * holds the user's per-prop override values. Overrides clear when `resetKey`
 * (typically the file path) changes.
 */
export function usePropsExtractor(
  source: string,
  resetKey: string | null,
): UsePropsExtractorResult {
  const [props, setProps] = useState<ExtractedProp[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PropValue>>({});

  useEffect(() => {
    setOverrides({});
  }, [resetKey]);

  useEffect(() => {
    if (!source.trim()) {
      setProps([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      extractComponentProps(source)
        .then((extracted) => {
          if (!cancelled) setProps(extracted);
        })
        .catch(() => {
          if (!cancelled) setProps([]);
        });
    }, PARSE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source]);

  // Drop overrides for props that no longer exist after a re-parse.
  useEffect(() => {
    setOverrides((prev) => {
      const names = new Set(props.map((p) => p.name));
      const kept = Object.entries(prev).filter(([name]) => names.has(name));
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept);
    });
  }, [props]);

  const setValue = useCallback((name: string, value: PropValue) => {
    setOverrides((prev) => ({ ...prev, [name]: value }));
  }, []);

  const reset = useCallback(() => {
    setOverrides({});
  }, []);

  const inputProps = useMemo(
    () => (Object.keys(overrides).length > 0 ? overrides : undefined),
    [overrides],
  );

  return { props, overrides, inputProps, setValue, reset };
}
