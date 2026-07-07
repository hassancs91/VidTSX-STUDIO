import { useCallback, useEffect, useRef } from 'react';
import type {
  StudioTextClip,
  StudioTextStyle,
  StudioComposition,
  LayerTransform,
  StudioClipAnimation,
  StudioAnimationPreset,
} from '@shared/ipc/types';
import { DEFAULT_TEXT_STYLE } from '@shared/ipc/types';
import { splitClipsAtTime } from '../services/cut-service';
import {
  clipAddAnimation,
  clipUpdateAnimation,
  clipRemoveAnimation,
} from '../services/animations';

const MIN_CLIP_DURATION_SECONDS = 0.1;
const DEFAULT_TEXT_DURATION_SECONDS = 5;

export interface UseStudioTextClipsResult {
  clips: StudioTextClip[];
  // Insert a new styled text block. Appended after the last text clip; returns
  // the new clip id so the caller can select it immediately.
  addClip: () => string;
  removeClip: (id: string) => void;
  moveClip: (id: string, newStartTime: number) => void;
  trimClip: (id: string, edge: 'start' | 'end', newTime: number) => void;
  setClipTransform: (id: string, transform: LayerTransform | undefined) => void;
  setClipText: (id: string, text: string) => void;
  // Shallow-merge a style patch into the clip's style.
  setClipStyle: (id: string, patch: Partial<StudioTextStyle>) => void;
  addAnimation: (
    id: string,
    preset: StudioAnimationPreset,
    opts: { playheadSeconds: number }
  ) => void;
  updateAnimation: (id: string, animId: string, patch: Partial<StudioClipAnimation>) => void;
  removeAnimation: (id: string, animId: string) => void;
  splitAtTime: (timeInSeconds: number) => boolean;
  setClips: (next: StudioTextClip[]) => void;
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function useStudioTextClips(
  savedClips: StudioTextClip[] | undefined,
  onUpdateClips: (clips: StudioTextClip[] | undefined) => void,
  composition: StudioComposition | null,
  onUpdateComposition: (comp: StudioComposition) => void
): UseStudioTextClipsResult {
  const clips = savedClips ?? [];

  const onUpdateClipsRef = useRef(onUpdateClips);
  const onUpdateCompositionRef = useRef(onUpdateComposition);
  useEffect(() => {
    onUpdateClipsRef.current = onUpdateClips;
    onUpdateCompositionRef.current = onUpdateComposition;
  }, [onUpdateClips, onUpdateComposition]);

  const persist = useCallback((next: StudioTextClip[]) => {
    onUpdateClipsRef.current(next.length > 0 ? next : undefined);
  }, []);

  const ensureCompositionCovers = useCallback(
    (endTimeSeconds: number) => {
      if (!composition) return;
      if (endTimeSeconds <= composition.durationInSeconds + 0.001) return;
      const newDurationInSeconds = Math.ceil(endTimeSeconds);
      onUpdateCompositionRef.current({
        ...composition,
        durationInSeconds: newDurationInSeconds,
        durationInFrames: Math.round(newDurationInSeconds * composition.fps),
      });
    },
    [composition]
  );

  const addClip = useCallback((): string => {
    const lastEnd = clips.reduce((max, c) => Math.max(max, c.endTime), 0);
    const startTime = lastEnd;
    const endTime = startTime + DEFAULT_TEXT_DURATION_SECONDS;

    // Default to a centered box (~70% width, ~20% height). Unlike an image, an
    // untransformed full-frame text box is hard to locate on the canvas, so we
    // give new blocks a concrete grabbable box right away.
    let transform: LayerTransform | undefined;
    if (composition) {
      const width = Math.round(composition.width * 0.7);
      const height = Math.round(composition.height * 0.2);
      transform = {
        x: Math.round((composition.width - width) / 2),
        y: Math.round((composition.height - height) / 2),
        width,
        height,
        rotation: 0,
      };
    }

    const clip: StudioTextClip = {
      id: makeId(),
      text: 'New text',
      style: { ...DEFAULT_TEXT_STYLE },
      startTime,
      endTime,
      transform,
    };

    ensureCompositionCovers(endTime);
    persist([...clips, clip]);
    return clip.id;
  }, [clips, composition, ensureCompositionCovers, persist]);

  const removeClip = useCallback(
    (id: string) => {
      persist(clips.filter((c) => c.id !== id));
    },
    [clips, persist]
  );

  const moveClip = useCallback(
    (id: string, newStartTime: number) => {
      const target = clips.find((c) => c.id === id);
      if (!target) return;

      const duration = target.endTime - target.startTime;
      const desired = Math.max(0, newStartTime);

      const others = clips
        .filter((c) => c.id !== id)
        .map((c) => ({ startTime: c.startTime, endTime: c.endTime }))
        .sort((a, b) => a.startTime - b.startTime);

      const intervals: { min: number; max: number }[] = [];
      let cursor = 0;
      for (const other of others) {
        const gapEnd = other.startTime - duration;
        if (gapEnd >= cursor) intervals.push({ min: cursor, max: gapEnd });
        cursor = Math.max(cursor, other.endTime);
      }
      intervals.push({ min: cursor, max: Infinity });

      let startTime = desired;
      const containing = intervals.find((iv) => desired >= iv.min && desired <= iv.max);
      if (!containing) {
        let best = intervals[0];
        let bestDist = Infinity;
        for (const iv of intervals) {
          const clamped = Math.max(iv.min, Math.min(iv.max, desired));
          const dist = Math.abs(clamped - desired);
          if (dist < bestDist) {
            bestDist = dist;
            best = iv;
          }
        }
        startTime = Math.max(best.min, Math.min(best.max, desired));
      }

      const endTime = startTime + duration;
      ensureCompositionCovers(endTime);
      persist(clips.map((c) => (c.id === id ? { ...c, startTime, endTime } : c)));
    },
    [clips, ensureCompositionCovers, persist]
  );

  const trimClip = useCallback(
    (id: string, edge: 'start' | 'end', newTime: number) => {
      const target = clips.find((c) => c.id === id);
      if (!target) return;

      const others = clips.filter((c) => c.id !== id);
      let startTime = target.startTime;
      let endTime = target.endTime;

      if (edge === 'start') {
        const leftNeighborEnd = others
          .filter((c) => c.endTime <= startTime)
          .reduce((max, c) => Math.max(max, c.endTime), 0);
        const maxStart = endTime - MIN_CLIP_DURATION_SECONDS;
        startTime = Math.max(leftNeighborEnd, Math.min(maxStart, newTime));
      } else {
        // Text blocks can be any length — bounded only by the next clip.
        const rightNeighborStart = others
          .filter((c) => c.startTime >= endTime)
          .reduce((min, c) => Math.min(min, c.startTime), Infinity);
        const minEnd = startTime + MIN_CLIP_DURATION_SECONDS;
        endTime = Math.max(minEnd, Math.min(rightNeighborStart, newTime));
      }

      ensureCompositionCovers(endTime);
      persist(clips.map((c) => (c.id === id ? { ...c, startTime, endTime } : c)));
    },
    [clips, ensureCompositionCovers, persist]
  );

  const setClipTransform = useCallback(
    (id: string, transform: LayerTransform | undefined) => {
      persist(clips.map((c) => (c.id === id ? { ...c, transform } : c)));
    },
    [clips, persist]
  );

  const setClipText = useCallback(
    (id: string, text: string) => {
      persist(clips.map((c) => (c.id === id ? { ...c, text } : c)));
    },
    [clips, persist]
  );

  const setClipStyle = useCallback(
    (id: string, patch: Partial<StudioTextStyle>) => {
      persist(
        clips.map((c) => (c.id === id ? { ...c, style: { ...c.style, ...patch } } : c))
      );
    },
    [clips, persist]
  );

  const addAnimation = useCallback(
    (id: string, preset: StudioAnimationPreset, opts: { playheadSeconds: number }) => {
      persist(
        clipAddAnimation(clips, id, preset, {
          playheadSeconds: opts.playheadSeconds,
          compWidth: composition?.width ?? 1920,
          compHeight: composition?.height ?? 1080,
        })
      );
    },
    [clips, composition, persist]
  );

  const updateAnimation = useCallback(
    (id: string, animId: string, patch: Partial<StudioClipAnimation>) => {
      persist(
        clipUpdateAnimation(clips, id, animId, patch, {
          compWidth: composition?.width ?? 1920,
          compHeight: composition?.height ?? 1080,
        })
      );
    },
    [clips, composition, persist]
  );

  const removeAnimation = useCallback(
    (id: string, animId: string) => {
      persist(clipRemoveAnimation(clips, id, animId));
    },
    [clips, persist]
  );

  // Split every text clip that straddles the playhead into two clips with the
  // same text + style covering the before/after ranges.
  const splitAtTime = useCallback(
    (timeInSeconds: number): boolean => {
      const { clips: next, splits } = splitClipsAtTime(clips, timeInSeconds);
      if (splits.length === 0) return false;
      persist(next);
      return true;
    },
    [clips, persist]
  );

  const setClips = useCallback(
    (next: StudioTextClip[]) => {
      persist(next);
    },
    [persist]
  );

  return {
    clips,
    addClip,
    removeClip,
    moveClip,
    trimClip,
    setClipTransform,
    setClipText,
    setClipStyle,
    addAnimation,
    updateAnimation,
    removeAnimation,
    splitAtTime,
    setClips,
  };
}
