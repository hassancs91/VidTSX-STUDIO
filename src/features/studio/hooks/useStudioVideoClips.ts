import { useCallback, useEffect, useRef } from 'react';
import type {
  StudioImport,
  StudioVideoClip,
  StudioComposition,
  VideoMetadata,
  LayerTransform,
  StudioEffect,
  StudioClipTransition,
  StudioClipAnimation,
  StudioAnimationPreset,
} from '@shared/ipc/types';
import { getVideoMetadata } from '../services/studio-service';
import { splitClipsAtTime } from '../services/cut-service';
import {
  clipAddAnimation,
  clipUpdateAnimation,
  clipRemoveAnimation,
} from '../services/animations';

const MIN_CLIP_DURATION_SECONDS = 0.1;

export interface UseStudioVideoClipsResult {
  clips: StudioVideoClip[];
  addClipFromImport: (item: StudioImport) => Promise<void>;
  removeClip: (id: string) => void;
  moveClip: (id: string, newStartTime: number) => void;
  trimClip: (id: string, edge: 'start' | 'end', newTime: number) => void;
  // Set (or clear) the clip's canvas transform. Undefined resets to full-frame.
  setClipTransform: (id: string, transform: LayerTransform | undefined) => void;
  // Replace the clip's effect stack. Undefined/empty clears all effects.
  setClipEffects: (id: string, effects: StudioEffect[] | undefined) => void;
  // Set (or clear) one of the clip's edge transitions. Undefined removes it.
  setClipTransition: (
    id: string,
    edge: 'in' | 'out',
    transition: StudioClipTransition | undefined
  ) => void;
  // Drop a preset animation arrow on the clip, placed at the playhead (clip-
  // relative) and nudged off existing arrows.
  addAnimation: (
    id: string,
    preset: StudioAnimationPreset,
    opts: { playheadSeconds: number }
  ) => void;
  // Patch one arrow. A `direction` change re-derives the arrow's from/to.
  updateAnimation: (id: string, animId: string, patch: Partial<StudioClipAnimation>) => void;
  removeAnimation: (id: string, animId: string) => void;
  splitAtTime: (timeInSeconds: number) => boolean;
  // Bulk replace — used by the cut-plan applier to swap the whole clip list
  // in one transaction (split + hide all cuts at once).
  setClips: (next: StudioVideoClip[]) => void;
  // Soft-cut toggles. `setClipHidden` flips one clip's hidden flag (also clears
  // cutReason when un-hiding so the chip styling resets).
  setClipHidden: (id: string, hidden: boolean) => void;
  // Mute/unmute a clip's audio (preview + render). Passing false clears the flag.
  setClipMuted: (id: string, muted: boolean) => void;
  // Set the clip's playback gain (0..1, clamped).
  setClipVolume: (id: string, volume: number) => void;
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function useStudioVideoClips(
  savedClips: StudioVideoClip[] | undefined,
  onUpdateClips: (clips: StudioVideoClip[] | undefined) => void,
  composition: StudioComposition | null,
  onUpdateComposition: (comp: StudioComposition) => void
): UseStudioVideoClipsResult {
  const clips = savedClips ?? [];

  const onUpdateClipsRef = useRef(onUpdateClips);
  const onUpdateCompositionRef = useRef(onUpdateComposition);
  useEffect(() => {
    onUpdateClipsRef.current = onUpdateClips;
    onUpdateCompositionRef.current = onUpdateComposition;
  }, [onUpdateClips, onUpdateComposition]);

  const persist = useCallback((next: StudioVideoClip[]) => {
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

  const addClipFromImport = useCallback(
    async (item: StudioImport) => {
      if (item.kind !== 'video') return;

      let metadata: VideoMetadata;
      try {
        metadata = await getVideoMetadata(item.filePath);
      } catch {
        return;
      }

      // Append to end of last clip on the Video track (or 0 if none).
      const lastEnd = clips.reduce((max, c) => Math.max(max, c.endTime), 0);
      const startTime = lastEnd;
      const endTime = startTime + metadata.durationInSeconds;

      const clip: StudioVideoClip = {
        id: makeId(),
        importId: item.id,
        filePath: item.filePath,
        fileName: item.fileName,
        startTime,
        endTime,
        inPointSeconds: 0,
        sourceDurationSeconds: metadata.durationInSeconds,
      };

      ensureCompositionCovers(endTime);
      persist([...clips, clip]);
    },
    [clips, ensureCompositionCovers, persist]
  );

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
      // Free positioning: no upper clamp to the composition length — clips can
      // sit anywhere ≥ 0 (gaps allowed). The interval logic below still
      // prevents overlap with other clips; the timeline grows to fit.
      const maxEnd = Infinity;
      const desired = Math.max(0, Math.min(maxEnd - duration, newStartTime));

      // Build allowed intervals from gaps between OTHER clips.
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
      const tailMax = maxEnd - duration;
      if (tailMax >= cursor) intervals.push({ min: cursor, max: tailMax });

      let startTime = desired;
      if (intervals.length > 0) {
        const containing = intervals.find((iv) => desired >= iv.min && desired <= iv.max);
        if (containing) {
          startTime = desired;
        } else {
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
      }

      const endTime = startTime + duration;
      persist(
        clips.map((c) => (c.id === id ? { ...c, startTime, endTime } : c))
      );
    },
    [clips, composition, persist]
  );

  const trimClip = useCallback(
    (id: string, edge: 'start' | 'end', newTime: number) => {
      const target = clips.find((c) => c.id === id);
      if (!target) return;

      // Free positioning: the right edge is limited only by the next clip and
      // the clip's own remaining source length — not the composition length.
      const compEnd = Infinity;
      const others = clips.filter((c) => c.id !== id);
      const sourceDuration = target.sourceDurationSeconds;
      const inPoint = target.inPointSeconds ?? 0;

      let startTime = target.startTime;
      let endTime = target.endTime;
      let nextInPoint = inPoint;

      if (edge === 'start') {
        const leftNeighborEnd = others
          .filter((c) => c.endTime <= startTime)
          .reduce((max, c) => Math.max(max, c.endTime), 0);
        const sourceStartOnTimeline = startTime - inPoint;
        const minStart = Math.max(leftNeighborEnd, sourceStartOnTimeline);
        const maxStart = endTime - MIN_CLIP_DURATION_SECONDS;
        startTime = Math.max(minStart, Math.min(maxStart, newTime));
        nextInPoint = inPoint + (startTime - target.startTime);
        if (nextInPoint < 0) nextInPoint = 0;
      } else {
        const rightNeighborStart = others
          .filter((c) => c.startTime >= endTime)
          .reduce((min, c) => Math.min(min, c.startTime), compEnd);
        const sourceRemaining = sourceDuration !== undefined ? sourceDuration - inPoint : Infinity;
        const maxEnd = Math.min(rightNeighborStart, startTime + sourceRemaining);
        const minEnd = startTime + MIN_CLIP_DURATION_SECONDS;
        endTime = Math.max(minEnd, Math.min(maxEnd, newTime));
      }

      persist(
        clips.map((c) =>
          c.id === id ? { ...c, startTime, endTime, inPointSeconds: nextInPoint } : c
        )
      );
    },
    [clips, composition, persist]
  );

  const setClipTransform = useCallback(
    (id: string, transform: LayerTransform | undefined) => {
      persist(clips.map((c) => (c.id === id ? { ...c, transform } : c)));
    },
    [clips, persist]
  );

  const setClipEffects = useCallback(
    (id: string, effects: StudioEffect[] | undefined) => {
      persist(
        clips.map((c) =>
          c.id === id
            ? { ...c, effects: effects && effects.length > 0 ? effects : undefined }
            : c
        )
      );
    },
    [clips, persist]
  );

  const setClipTransition = useCallback(
    (id: string, edge: 'in' | 'out', transition: StudioClipTransition | undefined) => {
      const key = edge === 'in' ? 'transitionIn' : 'transitionOut';
      persist(
        clips.map((c) => (c.id === id ? { ...c, [key]: transition } : c))
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

  const splitAtTime = useCallback(
    (timeInSeconds: number): boolean => {
      const { clips: next, splits } = splitClipsAtTime(clips, timeInSeconds);
      if (splits.length === 0) return false;
      // A split introduces an internal cut: the boundary between the two halves
      // is a hard cut, never a transition. Keep the left half's entrance and the
      // right half's exit; drop the transitions that would land on the new seam
      // (left's exit, right's entrance — the right half copied both from the
      // original clip via the spread).
      const leftIds = new Set(splits.map((s) => s.left.id));
      const rightIds = new Set(splits.map((s) => s.right.id));
      const cleaned = next.map((c) => {
        if (leftIds.has(c.id) && c.transitionOut) return { ...c, transitionOut: undefined };
        if (rightIds.has(c.id) && c.transitionIn) return { ...c, transitionIn: undefined };
        return c;
      });
      persist(cleaned);
      return true;
    },
    [clips, persist]
  );

  const setClips = useCallback(
    (next: StudioVideoClip[]) => {
      persist(next);
    },
    [persist]
  );

  const setClipHidden = useCallback(
    (id: string, hidden: boolean) => {
      persist(
        clips.map((c) =>
          c.id === id
            ? hidden
              ? { ...c, hidden: true }
              : { ...c, hidden: false, cutReason: undefined }
            : c
        )
      );
    },
    [clips, persist]
  );

  const setClipMuted = useCallback(
    (id: string, muted: boolean) => {
      persist(
        clips.map((c) =>
          c.id === id ? (muted ? { ...c, muted: true } : { ...c, muted: false }) : c
        )
      );
    },
    [clips, persist]
  );

  const setClipVolume = useCallback(
    (id: string, volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      persist(clips.map((c) => (c.id === id ? { ...c, volume: clamped } : c)));
    },
    [clips, persist]
  );

  return {
    clips,
    addClipFromImport,
    removeClip,
    moveClip,
    trimClip,
    setClipTransform,
    setClipEffects,
    setClipTransition,
    addAnimation,
    updateAnimation,
    removeAnimation,
    splitAtTime,
    setClips,
    setClipHidden,
    setClipMuted,
    setClipVolume,
  };
}
