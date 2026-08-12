import { useCallback, useMemo, useRef } from 'react';
import type { UseTimelineResult } from './useTimeline';
import { clipEndTime, makeClipId } from '../services/timeline-ops';
import { pasteClips, type ClipboardEntry } from '../services/timeline-group-ops';

/**
 * In-memory clip clipboard (Ctrl+C / Ctrl+V / Ctrl+D). Deliberately NOT the
 * OS clipboard: entries reference assets of the OPEN project, so cross-project
 * paste is out of scope — the ref dies with the editor, which refuses it
 * cleanly by construction. Duplicate copies the live selection directly and
 * leaves the clipboard alone (CapCut semantics).
 */
export function useClipboard(tl: UseTimelineResult) {
  const clipboardRef = useRef<ClipboardEntry[]>([]);

  /** Deep-copied selection in track order, offsets relative to its first clip. */
  const snapshotSelection = useCallback((): ClipboardEntry[] => {
    const ids = new Set(tl.selectedClipIds);
    if (ids.size === 0) return [];
    const picked: ClipboardEntry[] = [];
    let minStart = Number.POSITIVE_INFINITY;
    for (const track of tl.timeline.tracks) {
      for (const clip of track.clips) {
        if (!ids.has(clip.id)) continue;
        picked.push({ clip: structuredClone(clip), trackId: track.id, offsetSeconds: 0 });
        minStart = Math.min(minStart, clip.timelineStart);
      }
    }
    for (const entry of picked) entry.offsetSeconds = entry.clip.timelineStart - minStart;
    return picked;
  }, [tl]);

  /** Run the op eagerly so a rejected paste selects nothing and burns no ids. */
  const pasteEntries = useCallback(
    (entries: ClipboardEntry[], atSeconds: number) => {
      if (entries.length === 0) return;
      const newIds = entries.map(() => makeClipId());
      if (pasteClips(tl.timeline, entries, atSeconds, newIds) === tl.timeline) return;
      tl.dispatch({ type: 'paste', entries, atSeconds, newIds });
      tl.selectMany(newIds, false);
    },
    [tl],
  );

  const copy = useCallback(() => {
    const entries = snapshotSelection();
    if (entries.length > 0) clipboardRef.current = entries;
  }, [snapshotSelection]);

  const paste = useCallback(
    (atSeconds: number) => pasteEntries(clipboardRef.current, atSeconds),
    [pasteEntries],
  );

  /** Ctrl+D: paste a copy of the selection right after its own last clip. */
  const duplicate = useCallback(() => {
    const entries = snapshotSelection();
    if (entries.length === 0) return;
    const selectionEnd = Math.max(...entries.map((e) => clipEndTime(e.clip)));
    pasteEntries(entries, selectionEnd);
  }, [snapshotSelection, pasteEntries]);

  return useMemo(() => ({ copy, paste, duplicate }), [copy, paste, duplicate]);
}

export type UseClipboardResult = ReturnType<typeof useClipboard>;
