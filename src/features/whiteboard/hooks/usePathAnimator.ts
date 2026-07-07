import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { AnimatorState, PenPosition } from '../types';
import {
  measurePathLength,
  pointAtLength,
  setDasharray,
  setDashoffset,
} from '../services/path-measure';

/**
 * Per-asset hint the animator needs to lay out time slots. Drawable specs
 * contribute their measured path lengths to a path-pixel-driven segment;
 * image and text specs contribute a fixed wall-clock duration.
 */
export type AssetSpec =
  | { kind: 'drawable'; pathCount: number }
  | { kind: 'image'; durationMs: number }
  | { kind: 'text'; durationMs: number };

/** Anything that can receive a per-frame 0..1 progress value via DOM ref. */
export interface AssetProgressHandle {
  setProgress: (progress: number) => void;
}

export interface UsePathAnimatorArgs {
  /** Flat list of drawable path `d` strings (image and text contribute 0). */
  paths: string[];
  pathsRef: MutableRefObject<(SVGPathElement | null)[]>;
  pxPerSec: number;
  /** Multiplier applied to per-frame elapsed delta. Default 1. */
  speed?: number;
  /**
   * Per-asset specs in scene order. Lengths must align: the sum of
   * `pathCount` across drawable specs must equal `paths.length`.
   * When omitted, the animator treats `paths` as a single drawable asset.
   */
  assetSpecs?: AssetSpec[];
  /**
   * Per-asset progress receivers indexed by scene-asset index. Drawable
   * assets register null here; image and text assets register their handle.
   * The animator pushes a 0..1 progress to each handle every frame.
   */
  assetHandlesRef?: MutableRefObject<(AssetProgressHandle | null)[]>;
}

export interface PathAnimator extends AnimatorState {
  play: () => void;
  pause: () => void;
  restart: () => void;
  /**
   * Pause and rewind to the start without auto-playing. Hides every path
   * (dashoffset = full length) and clears pen position.
   */
  reset: () => void;
}

interface AssetSegment {
  kind: 'drawable' | 'image' | 'text';
  startSec: number;
  endSec: number;
  pathStart: number;
  pathCount: number;
}

function computeSegments(
  specs: AssetSpec[] | undefined,
  lengths: number[],
  pxPerSec: number
): AssetSegment[] {
  if (!specs || specs.length === 0) {
    if (lengths.length === 0) return [];
    const total = lengths.reduce((a, b) => a + b, 0);
    return [
      {
        kind: 'drawable',
        startSec: 0,
        endSec: pxPerSec > 0 ? total / pxPerSec : 0,
        pathStart: 0,
        pathCount: lengths.length,
      },
    ];
  }
  const segments: AssetSegment[] = [];
  let pathCursor = 0;
  let timeCursor = 0;
  for (const spec of specs) {
    if (spec.kind === 'drawable') {
      const segLens = lengths.slice(pathCursor, pathCursor + spec.pathCount);
      const total = segLens.reduce((a, b) => a + b, 0);
      const durationSec = pxPerSec > 0 ? total / pxPerSec : 0;
      segments.push({
        kind: 'drawable',
        startSec: timeCursor,
        endSec: timeCursor + durationSec,
        pathStart: pathCursor,
        pathCount: spec.pathCount,
      });
      pathCursor += spec.pathCount;
      timeCursor += durationSec;
    } else {
      // image + text: same shape — fixed duration, contributes no paths.
      const durationSec = spec.durationMs / 1000;
      segments.push({
        kind: spec.kind,
        startSec: timeCursor,
        endSec: timeCursor + durationSec,
        pathStart: pathCursor,
        pathCount: 0,
      });
      timeCursor += durationSec;
    }
  }
  return segments;
}

function resolveActiveSegmentIndex(
  segments: AssetSegment[],
  elapsedSec: number
): number | null {
  if (segments.length === 0) return null;
  for (let i = 0; i < segments.length; i++) {
    if (elapsedSec < segments[i].endSec) return i;
  }
  return segments.length - 1;
}

interface DrawableLocation {
  pathIndex: number;
  distanceAlong: number;
}

function resolveActiveDrawableLocation(
  seg: AssetSegment,
  lengths: number[],
  elapsedSec: number,
  pxPerSec: number
): DrawableLocation | null {
  if (seg.kind !== 'drawable' || seg.pathCount === 0) return null;
  const localTravelled = Math.max(0, (elapsedSec - seg.startSec) * pxPerSec);
  let acc = 0;
  for (let i = seg.pathStart; i < seg.pathStart + seg.pathCount; i++) {
    const len = lengths[i] ?? 0;
    if (localTravelled <= acc + len) {
      return { pathIndex: i, distanceAlong: Math.max(0, localTravelled - acc) };
    }
    acc += len;
  }
  // Past the end of the segment — pin to the last path's tail.
  const lastIdx = seg.pathStart + seg.pathCount - 1;
  return { pathIndex: lastIdx, distanceAlong: lengths[lastIdx] ?? 0 };
}

export function usePathAnimator(args: UsePathAnimatorArgs): PathAnimator {
  const { paths, pathsRef, pxPerSec, speed = 1, assetSpecs, assetHandlesRef } = args;
  const specsRef = useRef<AssetSpec[] | undefined>(assetSpecs);
  useEffect(() => {
    specsRef.current = assetSpecs;
  }, [assetSpecs]);

  const lengthsRef = useRef<number[]>([]);
  const segmentsRef = useRef<AssetSegment[]>([]);
  const totalDurationRef = useRef(0);
  const [totalDuration, setTotalDuration] = useState(0);

  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const [snapshot, setSnapshot] = useState<{
    elapsed: number;
    playing: boolean;
    activePathIndex: number | null;
    activeAssetIndex: number | null;
    penPosition: PenPosition | null;
  }>({
    elapsed: 0,
    playing: false,
    activePathIndex: null,
    activeAssetIndex: null,
    penPosition: null,
  });

  /**
   * Push per-frame progress to each non-drawable segment's reveal handle
   * (image and text). Past segments → 1, future → 0, active → linear within
   * its time slot.
   */
  const writeAssetProgress = useCallback(
    (elapsedSec: number) => {
      const handles = assetHandlesRef?.current;
      if (!handles) return;
      const segments = segmentsRef.current;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.kind === 'drawable') continue;
        const handle = handles[i];
        if (!handle) continue;
        const span = Math.max(0.0001, seg.endSec - seg.startSec);
        let progress: number;
        if (elapsedSec >= seg.endSec) progress = 1;
        else if (elapsedSec <= seg.startSec) progress = 0;
        else progress = (elapsedSec - seg.startSec) / span;
        handle.setProgress(progress);
      }
    },
    [assetHandlesRef]
  );

  /**
   * Walk every drawable segment and write each path's dashoffset for the
   * given elapsed time. Past segments → 0; future segments → full length;
   * the active segment reveals paths cumulatively against its local time.
   */
  const writeDashoffsets = useCallback(
    (elapsedSec: number) => {
      const segments = segmentsRef.current;
      const lengths = lengthsRef.current;
      const elements = pathsRef.current;
      for (const seg of segments) {
        if (seg.kind !== 'drawable' || seg.pathCount === 0) continue;
        const segEnd = seg.pathStart + seg.pathCount;
        if (elapsedSec >= seg.endSec) {
          for (let i = seg.pathStart; i < segEnd; i++) {
            const el = elements[i];
            if (el) setDashoffset(el, 0);
          }
        } else if (elapsedSec <= seg.startSec) {
          for (let i = seg.pathStart; i < segEnd; i++) {
            const el = elements[i];
            if (el) setDashoffset(el, lengths[i] ?? 0);
          }
        } else {
          const localTravelled = (elapsedSec - seg.startSec) * pxPerSec;
          let acc = 0;
          for (let i = seg.pathStart; i < segEnd; i++) {
            const el = elements[i];
            const len = lengths[i] ?? 0;
            if (!el) {
              acc += len;
              continue;
            }
            const start = acc;
            const end = acc + len;
            if (localTravelled >= end) setDashoffset(el, 0);
            else if (localTravelled <= start) setDashoffset(el, len);
            else setDashoffset(el, end - localTravelled);
            acc += len;
          }
        }
      }
    },
    [pathsRef, pxPerSec]
  );

  // Measure each drawable path's length on mount / when paths or specs change,
  // recompute segments, and re-apply visible state at the current elapsed.
  // Preserving elapsed (instead of resetting to 0) keeps the "play finished"
  // state across asset edits — without it, an opacity tweak post-play would
  // wipe the visible reveal because the mount effect would call setProgress(0)
  // on every image and dashoffset=full on every path.
  useEffect(() => {
    const lengths: number[] = [];
    for (let i = 0; i < paths.length; i++) {
      const el = pathsRef.current[i];
      const len = el ? measurePathLength(el) : 0;
      lengths.push(len);
      if (el) setDasharray(el, len);
    }
    lengthsRef.current = lengths;
    const segs = computeSegments(specsRef.current, lengths, pxPerSec);
    segmentsRef.current = segs;
    const total = segs.length > 0 ? segs[segs.length - 1].endSec : 0;
    totalDurationRef.current = total;
    setTotalDuration(total);

    if (elapsedRef.current > total) elapsedRef.current = total;
    const elapsed = elapsedRef.current;

    writeDashoffsets(elapsed);
    writeAssetProgress(elapsed);

    const segIdx = resolveActiveSegmentIndex(segs, elapsed);
    let activePathIndex: number | null = null;
    if (segIdx !== null) {
      const seg = segs[segIdx];
      if (seg.kind === 'drawable') {
        const loc = resolveActiveDrawableLocation(seg, lengths, elapsed, pxPerSec);
        if (loc) activePathIndex = loc.pathIndex;
      }
    }
    setSnapshot((prev) => ({
      ...prev,
      elapsed,
      activePathIndex,
      activeAssetIndex: segIdx,
    }));
  }, [paths, pxPerSec, pathsRef, assetSpecs, writeDashoffsets, writeAssetProgress]);

  const tick = useCallback(
    (now: number) => {
      if (!playingRef.current) return;
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const total = totalDurationRef.current;
      let elapsed = elapsedRef.current + dt * speedRef.current;
      let reachedEnd = false;
      if (elapsed >= total) {
        elapsed = total;
        reachedEnd = true;
      }
      elapsedRef.current = elapsed;

      writeDashoffsets(elapsed);
      writeAssetProgress(elapsed);

      const segments = segmentsRef.current;
      const segIdx = resolveActiveSegmentIndex(segments, elapsed);
      let activePathIndex: number | null = null;
      let pen: PenPosition | null = null;
      if (segIdx !== null) {
        const seg = segments[segIdx];
        if (seg.kind === 'drawable') {
          const loc = resolveActiveDrawableLocation(seg, lengthsRef.current, elapsed, pxPerSec);
          if (loc) {
            activePathIndex = loc.pathIndex;
            const el = pathsRef.current[loc.pathIndex];
            pen = el ? pointAtLength(el, loc.distanceAlong) : null;
          }
        }
      }

      setSnapshot({
        elapsed,
        playing: !reachedEnd,
        activePathIndex: reachedEnd ? null : activePathIndex,
        activeAssetIndex: reachedEnd ? null : segIdx,
        penPosition: reachedEnd ? null : pen,
      });

      if (reachedEnd) {
        playingRef.current = false;
        rafIdRef.current = null;
        return;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    },
    [pathsRef, pxPerSec, writeDashoffsets, writeAssetProgress]
  );

  const play = useCallback(() => {
    if (playingRef.current) return;
    if (totalDurationRef.current <= 0) return;
    if (elapsedRef.current >= totalDurationRef.current) {
      elapsedRef.current = 0;
    }
    playingRef.current = true;
    lastTickRef.current = performance.now();
    setSnapshot((prev) => ({ ...prev, playing: true }));
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setSnapshot((prev) => ({ ...prev, playing: false }));
  }, []);

  const hideAllPaths = useCallback(() => {
    const lengths = lengthsRef.current;
    const elements = pathsRef.current;
    for (let i = 0; i < lengths.length; i++) {
      const el = elements[i];
      if (el) setDashoffset(el, lengths[i]);
    }
  }, [pathsRef]);

  const hideAllNonDrawables = useCallback(() => {
    const handles = assetHandlesRef?.current;
    if (!handles) return;
    const segments = segmentsRef.current;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].kind !== 'drawable') handles[i]?.setProgress(0);
    }
  }, [assetHandlesRef]);

  const restart = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    elapsedRef.current = 0;
    hideAllPaths();
    hideAllNonDrawables();
    if (totalDurationRef.current <= 0) {
      playingRef.current = false;
      setSnapshot({
        elapsed: 0,
        playing: false,
        activePathIndex: null,
        activeAssetIndex: null,
        penPosition: null,
      });
      return;
    }
    playingRef.current = true;
    lastTickRef.current = performance.now();
    setSnapshot({
      elapsed: 0,
      playing: true,
      activePathIndex: null,
      activeAssetIndex: null,
      penPosition: null,
    });
    rafIdRef.current = requestAnimationFrame(tick);
  }, [hideAllPaths, hideAllNonDrawables, tick]);

  const reset = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    playingRef.current = false;
    elapsedRef.current = 0;
    hideAllPaths();
    hideAllNonDrawables();
    setSnapshot({
      elapsed: 0,
      playing: false,
      activePathIndex: null,
      activeAssetIndex: null,
      penPosition: null,
    });
  }, [hideAllPaths, hideAllNonDrawables]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      playingRef.current = false;
    };
  }, []);

  return {
    elapsed: snapshot.elapsed,
    playing: snapshot.playing,
    totalDuration,
    activePathIndex: snapshot.activePathIndex,
    activeAssetIndex: snapshot.activeAssetIndex,
    penPosition: snapshot.penPosition,
    play,
    pause,
    restart,
    reset,
  };
}
