import { useEffect, useRef } from 'react';
import type { UsePlaybackResult } from './usePlayback';

interface Options {
  /** The horizontally scrolling lanes viewport. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** The panel's (display-coordinate) playback surface. */
  playback: UsePlaybackResult;
  isPlaying: boolean;
  pxPerSecond: number;
}

/**
 * Auto-scroll during playback: when the playhead exits the visible viewport,
 * scroll so it re-enters at ~20% from the left (CapCut behavior). A manual
 * scroll while playing suspends following so we never fight the user; it
 * resumes when the playhead walks OUT of the viewport again (in→out
 * transition), or on the next play after a pause. Everything lives in refs —
 * this runs per frame and must not touch React state.
 */
export function usePlayheadFollow({ scrollRef, playback, isPlaying, pxPerSecond }: Options): void {
  const stateRef = useRef({ suspended: false, wasInView: false, programmatic: 0, seconds: 0 });
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const ppsRef = useRef(pxPerSecond);
  ppsRef.current = pxPerSecond;

  useEffect(() => {
    if (!isPlaying) stateRef.current.suspended = false;
  }, [isPlaying]);

  // Manual-scroll detection: our own writes announce themselves through the
  // `programmatic` counter, so any other scroll while playing is the user's.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const s = stateRef.current;
      if (s.programmatic > 0) {
        s.programmatic -= 1;
        return;
      }
      if (!isPlayingRef.current) return;
      s.suspended = true;
      // The scroll itself moved the playhead in/out of view without a frame
      // callback — re-derive `wasInView` NOW, or a stale true would read as
      // "the playhead walked out" and resume following on the next frame,
      // yanking the view straight back from under the user.
      const x = s.seconds * ppsRef.current;
      s.wasInView = x >= el.scrollLeft && x <= el.scrollLeft + el.clientWidth;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  useEffect(() => {
    return playback.subscribe((seconds) => {
      const el = scrollRef.current;
      if (!el) return;
      const s = stateRef.current;
      s.seconds = seconds;
      const x = seconds * ppsRef.current;
      const inView = x >= el.scrollLeft && x <= el.scrollLeft + el.clientWidth;
      if (isPlayingRef.current && !inView && (!s.suspended || s.wasInView)) {
        s.suspended = false;
        const before = el.scrollLeft;
        el.scrollLeft = Math.max(0, x - el.clientWidth * 0.2);
        if (el.scrollLeft !== before) s.programmatic += 1;
      }
      s.wasInView = inView;
    });
  }, [playback, scrollRef]);
}
