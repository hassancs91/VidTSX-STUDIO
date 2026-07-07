import { useCallback, useEffect, useRef } from 'react';
import type {
  StudioImport,
  StudioAudioClip,
  StudioAudioTrackKind,
  StudioComposition,
  VideoMetadata,
} from '@shared/ipc/types';
import { getVideoMetadata } from '../services/studio-service';
import { splitClipsAtTime } from '../services/cut-service';

const MIN_CLIP_DURATION_SECONDS = 0.1;

export interface UseStudioAudioClipsResult {
  clips: StudioAudioClip[];
  addClipFromImport: (item: StudioImport, track: StudioAudioTrackKind) => Promise<void>;
  removeClip: (id: string) => void;
  moveClip: (id: string, newStartTime: number) => void;
  trimClip: (id: string, edge: 'start' | 'end', newTime: number) => void;
  // Reassign a clip to the SFX or Music row (drag-to-switch). Re-anchors to a
  // non-overlapping position on the destination row.
  setClipTrack: (id: string, track: StudioAudioTrackKind) => void;
  setClipVolume: (id: string, volume: number) => void;
  // Split clips that straddle the playhead. With `track` set, only that row's
  // clips (SFX or Music) are cut; otherwise both rows are cut.
  splitAtTime: (timeInSeconds: number, track?: StudioAudioTrackKind) => boolean;
  setClips: (next: StudioAudioClip[]) => void;
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Snap `desired` into the nearest gap between `others` (clips on the same row),
// so clips never overlap. Mirrors the video-clip placement logic but operates
// on a pre-filtered same-track list.
function placeWithoutOverlap(
  desired: number,
  duration: number,
  others: { startTime: number; endTime: number }[]
): number {
  const sorted = [...others].sort((a, b) => a.startTime - b.startTime);
  const intervals: { min: number; max: number }[] = [];
  let cursor = 0;
  for (const other of sorted) {
    const gapEnd = other.startTime - duration;
    if (gapEnd >= cursor) intervals.push({ min: cursor, max: gapEnd });
    cursor = Math.max(cursor, other.endTime);
  }
  intervals.push({ min: cursor, max: Infinity });

  const containing = intervals.find((iv) => desired >= iv.min && desired <= iv.max);
  if (containing) return desired;

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
  return Math.max(best.min, Math.min(best.max, desired));
}

export function useStudioAudioClips(
  savedClips: StudioAudioClip[] | undefined,
  onUpdateClips: (clips: StudioAudioClip[] | undefined) => void,
  composition: StudioComposition | null,
  onUpdateComposition: (comp: StudioComposition) => void
): UseStudioAudioClipsResult {
  const clips = savedClips ?? [];

  const onUpdateClipsRef = useRef(onUpdateClips);
  const onUpdateCompositionRef = useRef(onUpdateComposition);
  useEffect(() => {
    onUpdateClipsRef.current = onUpdateClips;
    onUpdateCompositionRef.current = onUpdateComposition;
  }, [onUpdateClips, onUpdateComposition]);

  const persist = useCallback((next: StudioAudioClip[]) => {
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
    async (item: StudioImport, track: StudioAudioTrackKind) => {
      if (item.kind !== 'audio') return;

      let metadata: VideoMetadata;
      try {
        metadata = await getVideoMetadata(item.filePath);
      } catch {
        return;
      }

      // Append after the last clip on the SAME row (sfx/music are independent).
      const lastEnd = clips
        .filter((c) => c.track === track)
        .reduce((max, c) => Math.max(max, c.endTime), 0);
      const startTime = lastEnd;
      const endTime = startTime + metadata.durationInSeconds;

      const clip: StudioAudioClip = {
        id: makeId(),
        importId: item.id,
        filePath: item.filePath,
        fileName: item.fileName,
        track,
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
      const desired = Math.max(0, newStartTime);
      const others = clips
        .filter((c) => c.id !== id && c.track === target.track)
        .map((c) => ({ startTime: c.startTime, endTime: c.endTime }));

      const startTime = placeWithoutOverlap(desired, duration, others);
      const endTime = startTime + duration;
      persist(clips.map((c) => (c.id === id ? { ...c, startTime, endTime } : c)));
    },
    [clips, persist]
  );

  const trimClip = useCallback(
    (id: string, edge: 'start' | 'end', newTime: number) => {
      const target = clips.find((c) => c.id === id);
      if (!target) return;

      const others = clips.filter((c) => c.id !== id && c.track === target.track);
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
          .reduce((min, c) => Math.min(min, c.startTime), Infinity);
        const sourceRemaining =
          sourceDuration !== undefined ? sourceDuration - inPoint : Infinity;
        const maxEnd = Math.min(rightNeighborStart, startTime + sourceRemaining);
        const minEnd = startTime + MIN_CLIP_DURATION_SECONDS;
        endTime = Math.max(minEnd, Math.min(maxEnd, newTime));
      }

      ensureCompositionCovers(endTime);
      persist(
        clips.map((c) =>
          c.id === id ? { ...c, startTime, endTime, inPointSeconds: nextInPoint } : c
        )
      );
    },
    [clips, ensureCompositionCovers, persist]
  );

  const setClipTrack = useCallback(
    (id: string, track: StudioAudioTrackKind) => {
      const target = clips.find((c) => c.id === id);
      if (!target || target.track === track) return;

      const duration = target.endTime - target.startTime;
      const others = clips
        .filter((c) => c.id !== id && c.track === track)
        .map((c) => ({ startTime: c.startTime, endTime: c.endTime }));
      const startTime = placeWithoutOverlap(target.startTime, duration, others);
      const endTime = startTime + duration;

      ensureCompositionCovers(endTime);
      persist(
        clips.map((c) => (c.id === id ? { ...c, track, startTime, endTime } : c))
      );
    },
    [clips, ensureCompositionCovers, persist]
  );

  const setClipVolume = useCallback(
    (id: string, volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      persist(clips.map((c) => (c.id === id ? { ...c, volume: clamped } : c)));
    },
    [clips, persist]
  );

  const splitAtTime = useCallback(
    (timeInSeconds: number, track?: StudioAudioTrackKind): boolean => {
      // Cut only the target row when given; the others pass through untouched.
      const targets = track ? clips.filter((c) => c.track === track) : clips;
      const { clips: splitTargets, splits } = splitClipsAtTime(targets, timeInSeconds);
      if (splits.length === 0) return false;
      if (track) {
        const others = clips.filter((c) => c.track !== track);
        persist([...others, ...splitTargets]);
      } else {
        persist(splitTargets);
      }
      return true;
    },
    [clips, persist]
  );

  const setClips = useCallback(
    (next: StudioAudioClip[]) => {
      persist(next);
    },
    [persist]
  );

  return {
    clips,
    addClipFromImport,
    removeClip,
    moveClip,
    trimClip,
    setClipTrack,
    setClipVolume,
    splitAtTime,
    setClips,
  };
}
