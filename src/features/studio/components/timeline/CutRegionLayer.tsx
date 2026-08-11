// Review-mode overlay: the open cut proposal drawn as striped regions over
// the lanes. The timeline underneath is untouched — these are the spans that
// WILL be removed on Apply. Regions select (sync with the Inspector list),
// seek on click, and expose drag handles on both edges so a cut can be
// widened or narrowed before it is applied. Edge drags snap to transcript
// word boundaries and commit through the reducer (undoable, marks the item
// `adjusted`).

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { StudioProposal, StudioTimeline } from '../../types';
import type { TimelineAction } from '../../hooks/useTimeline';
import type { CutContextWord } from '../../services/cut-proposal';
import { cutItemDragBounds, mapCutItemToTimeline } from '../../services/cut-proposal';
import { SNAP_THRESHOLD_PX } from '../../services/snapping';
import { TRACK_HEIGHT, secondsToPx } from '../../services/timeline-view';

interface Props {
  timeline: StudioTimeline;
  proposal: StudioProposal;
  pxPerSecond: number;
  visibleFrom: number;
  visibleTo: number;
  selectedCutId: string | null;
  wordsByAsset: Map<string, CutContextWord[]>;
  sourceDurationOf: (assetId: string) => number | undefined;
  onSelectCut: (itemId: string | null) => void;
  onSeek: (seconds: number) => void;
  dispatch: React.Dispatch<TimelineAction>;
}

interface EdgeDrag {
  itemId: string;
  edge: 'start' | 'end';
  /** Live span in SOURCE seconds while the pointer moves. */
  sourceStart: number;
  sourceEnd: number;
}

const ACCEPTED_FILL =
  'repeating-linear-gradient(-45deg, rgba(239,159,39,0.30) 0 6px, rgba(239,159,39,0.10) 6px 12px)';
const REJECTED_FILL =
  'repeating-linear-gradient(-45deg, rgba(130,130,140,0.16) 0 6px, rgba(130,130,140,0.06) 6px 12px)';

function snapToWords(
  seconds: number,
  words: CutContextWord[] | undefined,
  pxPerSecond: number,
): number {
  if (!words || words.length === 0) return seconds;
  const threshold = SNAP_THRESHOLD_PX / pxPerSecond;
  let best = seconds;
  let bestDist = threshold;
  for (const word of words) {
    for (const edge of [word.start, word.end]) {
      const dist = Math.abs(edge - seconds);
      if (dist < bestDist) {
        best = edge;
        bestDist = dist;
      }
    }
  }
  return best;
}

export const CutRegionLayer = memo(function CutRegionLayer({
  timeline,
  proposal,
  pxPerSecond,
  visibleFrom,
  visibleTo,
  selectedCutId,
  wordsByAsset,
  sourceDurationOf,
  onSelectCut,
  onSeek,
  dispatch,
}: Props) {
  const [drag, setDrag] = useState<EdgeDrag | null>(null);
  const dragRef = useRef<EdgeDrag | null>(null);

  const trackIndexById = useMemo(
    () => new Map(timeline.tracks.map((t, i) => [t.id, i])),
    [timeline.tracks],
  );

  // Regions from the committed spans, with the dragged item's live span
  // swapped in — the same "preview runs the real math" idea as useClipDrag.
  const regions = useMemo(() => {
    return proposal.items.flatMap((item) => {
      const effective =
        drag && drag.itemId === item.id
          ? { ...item, sourceStart: drag.sourceStart, sourceEnd: drag.sourceEnd }
          : item;
      return mapCutItemToTimeline(timeline, effective).map((region) => ({
        region,
        item,
      }));
    });
  }, [proposal.items, timeline, drag]);

  const onEdgePointerDown = useCallback(
    (event: React.PointerEvent, itemId: string, edge: 'start' | 'end') => {
      event.stopPropagation();
      event.preventDefault();
      const item = proposal.items.find((i) => i.id === itemId);
      if (!item || item.sourceStart === undefined || item.sourceEnd === undefined) return;
      const assetId = item.assetId;
      if (!assetId) return;
      const bounds = cutItemDragBounds(proposal, itemId, sourceDurationOf(assetId) ?? Infinity);
      if (!bounds) return;
      const words = wordsByAsset.get(assetId);
      const startX = event.clientX;
      const origin: EdgeDrag = {
        itemId,
        edge,
        sourceStart: item.sourceStart,
        sourceEnd: item.sourceEnd,
      };
      dragRef.current = origin;
      setDrag(origin);
      onSelectCut(itemId);

      const onMove = (e: PointerEvent) => {
        const deltaSeconds = (e.clientX - startX) / pxPerSecond;
        const current = dragRef.current;
        if (!current) return;
        let next: EdgeDrag;
        if (edge === 'start') {
          const raw = origin.sourceStart + deltaSeconds;
          const snapped = snapToWords(raw, words, pxPerSecond);
          const value = Math.min(Math.max(snapped, bounds.minStart), bounds.maxStart);
          next = { ...current, sourceStart: value };
        } else {
          const raw = origin.sourceEnd + deltaSeconds;
          const snapped = snapToWords(raw, words, pxPerSecond);
          const value = Math.min(Math.max(snapped, bounds.minEnd), bounds.maxEnd);
          next = { ...current, sourceEnd: value };
        }
        dragRef.current = next;
        setDrag(next);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const final = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!final) return;
        const moved =
          Math.abs(final.sourceStart - origin.sourceStart) > 1e-6 ||
          Math.abs(final.sourceEnd - origin.sourceEnd) > 1e-6;
        if (moved) {
          dispatch({
            type: 'proposal-item-span',
            proposalId: proposal.id,
            itemId,
            sourceStart: final.sourceStart,
            sourceEnd: final.sourceEnd,
          });
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [proposal, pxPerSecond, wordsByAsset, sourceDurationOf, onSelectCut, dispatch],
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {regions.map(({ region, item }) => {
        if (region.end < visibleFrom || region.start > visibleTo) return null;
        const trackIndex = trackIndexById.get(region.trackId);
        if (trackIndex === undefined) return null;
        const left = secondsToPx(region.start, pxPerSecond);
        const width = Math.max(3, secondsToPx(region.end - region.start, pxPerSecond));
        const rejected = item.status === 'rejected';
        const selected = item.id === selectedCutId;
        const seconds = (region.end - region.start).toFixed(1);
        return (
          <div
            key={`${item.id}:${region.trackId}:${region.clipId}`}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left,
              width,
              top: trackIndex * TRACK_HEIGHT,
              height: TRACK_HEIGHT,
              background: rejected ? REJECTED_FILL : ACCEPTED_FILL,
              borderLeft: `1.5px solid ${rejected ? '#55555e' : '#EF9F27'}`,
              borderRight: `1.5px solid ${rejected ? '#55555e' : '#EF9F27'}`,
              outline: selected ? '2px solid var(--color-accent-light, #c8b4ff)' : 'none',
              outlineOffset: -2,
            }}
            title={item.note ?? `Cut ${seconds} s`}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              onSelectCut(item.id);
              onSeek(region.start);
            }}
          >
            {width > 34 && (
              <span
                className="absolute top-[3px] left-[3px] px-[4px] rounded-[3px] text-[8px] font-bold leading-[13px] pointer-events-none"
                style={{
                  background: rejected ? '#55555e' : '#EF9F27',
                  color: rejected ? '#bbbbbb' : '#131316',
                  textDecoration: rejected ? 'line-through' : 'none',
                }}
              >
                {seconds}s
              </span>
            )}
            {selected && !rejected && (
              <>
                <EdgeHandle
                  side="left"
                  onPointerDown={(e) => onEdgePointerDown(e, item.id, 'start')}
                />
                <EdgeHandle
                  side="right"
                  onPointerDown={(e) => onEdgePointerDown(e, item.id, 'end')}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});

function EdgeHandle({
  side,
  onPointerDown,
}: {
  side: 'left' | 'right';
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute top-1/2 -translate-y-1/2 w-[7px] h-[22px] rounded-[3px] cursor-ew-resize"
      style={{
        [side]: -4,
        background: 'var(--color-accent-light, #c8b4ff)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
      }}
    />
  );
}
