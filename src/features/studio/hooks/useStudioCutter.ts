import { useCallback } from 'react';

// Orchestrates clip-cutting across tracks. The UI invokes it via Cut buttons,
// and any programmatic caller (e.g., future AI auto-cut) can invoke the same
// API: `cutAtTime({ timeInSeconds, trackIds })`.
//
// Today each clip type lives on a single static track ('video', 'tsx',
// 'captions'). When multiple tracks of the same type are introduced, clips
// will carry a `trackId` and each hook's `splitAtTime` will filter by it.
// The cutter API does not change.

export interface CutAtTimeOptions {
  timeInSeconds: number;
  trackIds: string[];
}

export interface CutAtPlayheadOptions {
  trackIds: string[];
}

export interface UseStudioCutterTargets {
  videoSplitAtTime?: (t: number) => boolean;
  tsxSplitAtTime?: (t: number) => boolean;
  captionsSplitAtTime?: (t: number) => void;
  imageSplitAtTime?: (t: number) => boolean;
  textSplitAtTime?: (t: number) => boolean;
  // `track` restricts the cut to one audio row; omitted = both (SFX + Music).
  audioSplitAtTime?: (t: number, track?: 'sfx' | 'music') => boolean;
  getPlayheadSeconds: () => number;
}

export interface UseStudioCutterResult {
  cutAtTime: (opts: CutAtTimeOptions) => void;
  cutAtPlayhead: (opts: CutAtPlayheadOptions) => void;
}

export function useStudioCutter({
  videoSplitAtTime,
  tsxSplitAtTime,
  captionsSplitAtTime,
  imageSplitAtTime,
  textSplitAtTime,
  audioSplitAtTime,
  getPlayheadSeconds,
}: UseStudioCutterTargets): UseStudioCutterResult {
  const cutAtTime = useCallback(
    ({ timeInSeconds, trackIds }: CutAtTimeOptions) => {
      if (trackIds.includes('video')) videoSplitAtTime?.(timeInSeconds);
      if (trackIds.includes('tsx')) tsxSplitAtTime?.(timeInSeconds);
      if (trackIds.includes('captions')) captionsSplitAtTime?.(timeInSeconds);
      if (trackIds.includes('image')) imageSplitAtTime?.(timeInSeconds);
      if (trackIds.includes('text')) textSplitAtTime?.(timeInSeconds);
      // SFX + Music share one store. Cut both in a single pass when both rows
      // are targeted; otherwise restrict to the one requested.
      const cutSfx = trackIds.includes('sfx');
      const cutMusic = trackIds.includes('music');
      if (cutSfx && cutMusic) audioSplitAtTime?.(timeInSeconds);
      else if (cutSfx) audioSplitAtTime?.(timeInSeconds, 'sfx');
      else if (cutMusic) audioSplitAtTime?.(timeInSeconds, 'music');
    },
    [videoSplitAtTime, tsxSplitAtTime, captionsSplitAtTime, imageSplitAtTime, textSplitAtTime, audioSplitAtTime]
  );

  const cutAtPlayhead = useCallback(
    ({ trackIds }: CutAtPlayheadOptions) => {
      cutAtTime({ timeInSeconds: getPlayheadSeconds(), trackIds });
    },
    [cutAtTime, getPlayheadSeconds]
  );

  return { cutAtTime, cutAtPlayhead };
}
