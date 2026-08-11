// Loads transcript WORDS into the renderer for the assets that need them —
// cut-review context lines and word-boundary snapping while dragging cut
// edges. Reads the same cache JSON the main process wrote
// (cache/transcripts/<assetId>.json) through the guarded studioCacheRead IPC,
// exactly like waveform peaks in useStudioMedia.

import { useEffect, useRef, useState } from 'react';
import type { StudioMediaAsset } from '../types';
import type { CutContextWord } from '../services/cut-proposal';

/** Structural view of the transcript cache file — main owns the full type. */
interface TranscriptFileWords {
  words?: Array<{ text?: string; start?: number; end?: number }>;
}

export function parseTranscriptWords(json: string): CutContextWord[] {
  const parsed = JSON.parse(json) as TranscriptFileWords;
  if (!Array.isArray(parsed.words)) return [];
  return parsed.words
    .filter(
      (w): w is { text: string; start: number; end: number } =>
        typeof w.text === 'string' && typeof w.start === 'number' && typeof w.end === 'number',
    )
    .map((w) => ({ text: w.text, start: w.start, end: w.end }))
    .sort((a, b) => a.start - b.start);
}

/** One-off fetch — used by the Auto Cut flow right after planning. */
export async function fetchTranscriptWords(
  projectId: string,
  relPath: string,
): Promise<CutContextWord[]> {
  const res = await window.api.studioCacheRead({ projectId, relPath });
  if (!res.success || !res.data) return [];
  return parseTranscriptWords(atob(res.data));
}

/**
 * Words per asset id for the given assets (ready transcripts only). Pass just
 * the assets under review — normally the one the open proposal cuts.
 */
export function useAssetTranscripts(
  projectId: string | null,
  assets: StudioMediaAsset[],
): Map<string, CutContextWord[]> {
  const [words, setWords] = useState<Map<string, CutContextWord[]>>(new Map());
  const loading = useRef(new Set<string>());

  useEffect(() => {
    if (!projectId) return;
    for (const asset of assets) {
      const relPath = asset.transcript?.status === 'ready' ? asset.transcript.path : null;
      if (!relPath || words.has(asset.id) || loading.current.has(asset.id)) continue;
      loading.current.add(asset.id);
      void fetchTranscriptWords(projectId, relPath)
        .then((parsed) => {
          setWords((prev) => new Map(prev).set(asset.id, parsed));
        })
        .catch(() => {
          // Missing words only lose snapping/context — review still works.
        })
        .finally(() => {
          loading.current.delete(asset.id);
        });
    }
  }, [projectId, assets, words]);

  return words;
}
