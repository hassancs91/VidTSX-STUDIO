import { useEffect, useState } from 'react';
import { getAudioData } from '@remotion/media-utils';
import type { MediaUtilsAudioData } from '@remotion/media-utils';

// Decodes an audio (or video) URL into raw amplitude samples for timeline
// waveform drawing. Decoding is expensive, so results are cached per-URL in a
// module-level Map and shared across every clip/render that points at the same
// source. Decoding a video container's audio track via the Web Audio API isn't
// guaranteed for all codecs — failures resolve to `null` so callers fall back
// to a plain clip (no waveform) instead of erroring.

type CacheEntry = Promise<MediaUtilsAudioData | null>;

const cache = new Map<string, CacheEntry>();

function loadAudioData(url: string): CacheEntry {
  const existing = cache.get(url);
  if (existing) return existing;
  // Downsample to a modest rate — timeline bars don't need full fidelity, and a
  // lower rate keeps decode + memory cheap for long tracks.
  const promise = getAudioData(url, { sampleRate: 4000 }).catch(() => null);
  cache.set(url, promise);
  return promise;
}

export interface UseAudioWaveformResult {
  data: MediaUtilsAudioData | null;
  loading: boolean;
}

export function useAudioWaveform(url: string | undefined): UseAudioWaveformResult {
  const [data, setData] = useState<MediaUtilsAudioData | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadAudioData(url).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading };
}
