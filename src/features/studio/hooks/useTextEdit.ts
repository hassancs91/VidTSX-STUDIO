import { useCallback, useMemo } from 'react';
import { masterLane, untranscribedMasterClips } from '@shared/studio';
import type { CaptionWordSource } from '@shared/studio';
import type { StudioMediaAsset, StudioTimeline } from '../types';
import {
  buildTranscriptDoc,
  withSpokenSpans,
  type TranscriptDeletion,
  type TranscriptToken,
} from '../services/transcript-doc';
import { planTextDelete } from '../services/text-delete';
import { makeClipId } from '../services/timeline-ops';
import type { TokenRange } from '../services/transcript-selection';
import { useAssetEnvelopes } from './useAssetEnvelopes';
import type { TimelineAction } from './useTimeline';

interface Options {
  projectId: string | null;
  /** False while the panel is not on screen — nothing is derived or loaded. */
  active: boolean;
  /** The document's timeline (edits are planned against it). */
  timeline: StudioTimeline;
  /** What the Player plays — differs from `timeline` only while a cut review previews its result. */
  playerTimeline: StudioTimeline;
  words: CaptionWordSource;
  assets: StudioMediaAsset[];
  dispatch: (action: TimelineAction) => void;
  rippleAllTracks: boolean;
  /** A proposal is open: the panel reads, it does not edit (the rule Auto Cut obeys). */
  reviewOpen: boolean;
  seek: (seconds: number) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const EMPTY_DOC = buildTranscriptDoc({ tracks: [] }, new Map());

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Text-based editing (NEXT_FEATURES_DESIGN.md Q5a): the transcript document of
 * the current edit, and the two edits the panel makes — delete words, restore
 * a deletion. Both are direct, one undo step each.
 */
export function useTextEdit({
  projectId,
  active,
  timeline,
  playerTimeline,
  words: rawWords,
  assets,
  dispatch,
  rippleAllTracks,
  reviewOpen,
  seek,
  showToast,
}: Options) {
  // The document and the delete planner read the SAME normalised words.
  const words = useMemo<CaptionWordSource>(
    () => (active ? new Map([...rawWords].map(([id, list]) => [id, withSpokenSpans(list)])) : rawWords),
    [active, rawWords],
  );
  const doc = useMemo(
    () => (active ? buildTranscriptDoc(playerTimeline, words) : EMPTY_DOC),
    [active, playerTimeline, words],
  );

  // Only the master lane can be cut from here, so only its assets need envelopes.
  const masterAssets = useMemo(() => {
    if (!active) return [];
    const ids = new Set((masterLane(timeline)?.clips ?? []).map((c) => c.assetId).filter(Boolean));
    return assets.filter((a) => ids.has(a.id));
  }, [active, timeline, assets]);
  const envelopes = useAssetEnvelopes(active ? projectId : null, masterAssets);

  const untranscribedCount = useMemo(
    () => (active ? untranscribedMasterClips(playerTimeline, words).length : 0),
    [active, playerTimeline, words],
  );
  const masterLocked = masterLane(timeline)?.locked === true;
  const readOnly = reviewOpen || masterLocked;

  const deleteTokens = useCallback(
    (tokens: readonly TranscriptToken[], what: 'word' | 'filler'): boolean => {
      if (readOnly || tokens.length === 0) return false;
      const plan = planTextDelete({ timeline, tokens, words, envelopes, assets });
      if (plan.blocked === 'locked') {
        showToast('The master track is locked — unlock it to edit by text', 'error');
        return false;
      }
      if (plan.spans.length === 0) {
        showToast(
          what === 'filler'
            ? 'These fillers sit too tight against the words around them to cut cleanly'
            : 'Nothing to cut here — the selection sits inside the pads of the words around it',
          'info',
        );
        return false;
      }
      dispatch({ type: 'text-delete', spans: plan.spans, allTracks: rippleAllTracks });
      seek(plan.spans[0].from);

      const notes: string[] = [];
      if (plan.skippedRuns > 0) notes.push(`${plural(plan.skippedRuns, 'spot')} too tight to cut cleanly`);
      if (plan.unsnappedAssetIds.length > 0) notes.push('no audio envelope — edges are padded, not snapped');
      showToast(
        `Removed ${plural(tokens.length, what)} · −${plan.removedSeconds.toFixed(1)} s` +
          (notes.length > 0 ? ` (${notes.join('; ')})` : ''),
        notes.length > 0 ? 'info' : 'success',
      );
      return true;
    },
    [readOnly, timeline, words, envelopes, assets, dispatch, rippleAllTracks, seek, showToast],
  );

  const deleteRange = useCallback(
    (range: TokenRange) => deleteTokens(doc.tokens.slice(range.from, range.to + 1), 'word'),
    [deleteTokens, doc.tokens],
  );

  /** Fillers inside `range`, or every filler of the edit when there is no selection. */
  const fillersIn = useCallback(
    (range: TokenRange | null) =>
      (range ? doc.tokens.slice(range.from, range.to + 1) : doc.tokens).filter((t) => t.filler),
    [doc.tokens],
  );

  const deleteFillers = useCallback(
    (range: TokenRange | null) => deleteTokens(fillersIn(range), 'filler'),
    [deleteTokens, fillersIn],
  );

  const restore = useCallback(
    (deletion: TranscriptDeletion) => {
      if (readOnly) return;
      dispatch({
        type: 'text-restore',
        beforeClipId: deletion.beforeClipId,
        afterClipId: deletion.afterClipId,
        newClipId: makeClipId(),
        allTracks: rippleAllTracks,
      });
      seek(deletion.at);
    },
    [readOnly, dispatch, rippleAllTracks, seek],
  );

  return {
    doc,
    readOnly,
    /** Why the panel is read-only, for its banner — null when it edits. */
    readOnlyReason: reviewOpen
      ? 'A review is open — apply or reject it to edit by text.'
      : masterLocked
        ? 'The master track is locked.'
        : null,
    untranscribedCount,
    deleteRange,
    deleteFillers,
    fillersIn,
    restore,
  };
}

export type UseTextEditResult = ReturnType<typeof useTextEdit>;
