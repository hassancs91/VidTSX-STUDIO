import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  StudioComposition,
  StudioVideoClip,
  StudioAudioClip,
  StudioImageClip,
  StudioTextClip,
  TsxSlot,
  StudioProjectCaptions,
} from '@shared/ipc/types';

// Session-only undo/redo for the Studio's manual editing surface: video clips,
// TSX overlays (incl. transform), captions, and the composition canvas.
//
// Model: debounced post-edit *checkpoints*. An effect watches the four editing
// slices (which are immutable — every edit produces a fresh object, so a
// reference change == a real edit). When one changes, we schedule a checkpoint
// after a short quiet period, which coalesces a whole drag/resize/typing burst
// into a single undo step without any per-gesture begin/commit plumbing.
//
// Snapshots hold slice *references*, so unchanged slices are shared across
// entries — cheap even with a full transcript in `captions`. Bounded to 50.

export interface StudioHistorySnapshot {
  composition: StudioComposition;
  videoClips: StudioVideoClip[] | undefined;
  audioClips: StudioAudioClip[] | undefined;
  imageClips: StudioImageClip[] | undefined;
  textClips: StudioTextClip[] | undefined;
  tsxSlots: TsxSlot[] | undefined;
  captions: StudioProjectCaptions | undefined;
}

interface UseStudioHistoryArgs {
  // Resets history whenever this changes (new project opened).
  projectId: string | undefined;
  // Live editing slices, read from the project-data mirror.
  composition: StudioComposition | undefined;
  videoClips: StudioVideoClip[] | undefined;
  audioClips: StudioAudioClip[] | undefined;
  imageClips: StudioImageClip[] | undefined;
  textClips: StudioTextClip[] | undefined;
  tsxSlots: TsxSlot[] | undefined;
  captions: StudioProjectCaptions | undefined;
  // Pushes a snapshot back into the feature hooks (video clips, slots, captions,
  // composition). Must perform the actual state restore.
  applySnapshot: (snapshot: StudioHistorySnapshot) => void;
}

export interface UseStudioHistoryResult {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HISTORY_LIMIT = 50;
const CHECKPOINT_DEBOUNCE_MS = 400;

export function useStudioHistory({
  projectId,
  composition,
  videoClips,
  audioClips,
  imageClips,
  textClips,
  tsxSlots,
  captions,
  applySnapshot,
}: UseStudioHistoryArgs): UseStudioHistoryResult {
  const stackRef = useRef<StudioHistorySnapshot[]>([]);
  const indexRef = useRef(0);
  // True while applying an undo/redo so the watching effect doesn't record the
  // restored state as a brand-new checkpoint.
  const applyingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Latest live slices, mirrored each render so the debounced commit reads fresh
  // values when it eventually fires.
  const liveRef = useRef<StudioHistorySnapshot | null>(null);
  liveRef.current = composition
    ? { composition, videoClips, audioClips, imageClips, textClips, tsxSlots, captions }
    : null;

  const syncFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < stackRef.current.length - 1);
  }, []);

  const sameAsCurrent = (snap: StudioHistorySnapshot): boolean => {
    const cur = stackRef.current[indexRef.current];
    return (
      !!cur &&
      cur.composition === snap.composition &&
      cur.videoClips === snap.videoClips &&
      cur.audioClips === snap.audioClips &&
      cur.imageClips === snap.imageClips &&
      cur.textClips === snap.textClips &&
      cur.tsxSlots === snap.tsxSlots &&
      cur.captions === snap.captions
    );
  };

  const commitCheckpoint = useCallback(() => {
    timerRef.current = undefined;
    const snap = liveRef.current;
    if (!snap || sameAsCurrent(snap)) return;
    // Drop any redo tail, append, advance, enforce the bound.
    const base = stackRef.current.slice(0, indexRef.current + 1);
    base.push(snap);
    if (base.length > HISTORY_LIMIT) base.splice(0, base.length - HISTORY_LIMIT);
    stackRef.current = base;
    indexRef.current = base.length - 1;
    syncFlags();
  }, [syncFlags]);

  const flushPending = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    commitCheckpoint();
  }, [commitCheckpoint]);

  // Reset history to the loaded baseline when the project changes.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    stackRef.current = liveRef.current ? [liveRef.current] : [];
    indexRef.current = 0;
    applyingRef.current = false;
    syncFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Watch the editing slices; schedule a checkpoint on real edits.
  useEffect(() => {
    if (!projectId) return;
    if (applyingRef.current) {
      // This change is the result of an undo/redo restore — consume the flag.
      applyingRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commitCheckpoint, CHECKPOINT_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, videoClips, audioClips, imageClips, textClips, tsxSlots, captions]);

  // Clean up the pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const undo = useCallback(() => {
    flushPending();
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    applyingRef.current = true;
    applySnapshot(stackRef.current[indexRef.current]);
    syncFlags();
  }, [flushPending, applySnapshot, syncFlags]);

  const redo = useCallback(() => {
    flushPending();
    if (indexRef.current >= stackRef.current.length - 1) return;
    indexRef.current += 1;
    applyingRef.current = true;
    applySnapshot(stackRef.current[indexRef.current]);
    syncFlags();
  }, [flushPending, applySnapshot, syncFlags]);

  return { undo, redo, canUndo, canRedo };
}
