import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { StudioClip, StudioProject, StudioTimeline } from '../types';
import {
  addClip,
  moveClip,
  removeClip,
  removeClipsForAsset,
  splitClip,
  trimClip,
} from '../services/timeline-ops';

/** Undo depth. Timeline documents are small (a 100-cut edit is a few KB), so
 *  whole-document snapshots are cheaper than maintaining inverse operations. */
const HISTORY_LIMIT = 100;

export type TimelineAction =
  | { type: 'reset'; projectId: string; timeline: StudioTimeline }
  | { type: 'add'; trackId: string; clip: StudioClip; preferredStart?: number }
  | { type: 'move'; clipId: string; seconds: number; toTrackId?: string }
  | {
      type: 'trim';
      clipId: string;
      edge: 'start' | 'end';
      seconds: number;
      sourceDuration?: number;
    }
  | { type: 'split'; clipId: string; seconds: number }
  | { type: 'remove'; clipId: string; ripple: boolean }
  | { type: 'remove-asset-clips'; assetId: string }
  | { type: 'undo' }
  | { type: 'redo' };

interface HistoryState {
  projectId: string | null;
  past: StudioTimeline[];
  present: StudioTimeline;
  future: StudioTimeline[];
}

const EMPTY_TIMELINE: StudioTimeline = { tracks: [] };

function commit(state: HistoryState, next: StudioTimeline): HistoryState {
  // Ops return the same object when they reject an edit (locked track, illegal
  // split point) — those must not create an undo step.
  if (next === state.present) return state;
  return {
    projectId: state.projectId,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function timelineReducer(state: HistoryState, action: TimelineAction): HistoryState {
  switch (action.type) {
    case 'reset':
      return { projectId: action.projectId, past: [], present: action.timeline, future: [] };
    case 'add':
      return commit(
        state,
        addClip(state.present, action.trackId, action.clip, action.preferredStart ?? 0),
      );
    case 'move':
      return commit(
        state,
        moveClip(state.present, action.clipId, action.seconds, action.toTrackId),
      );
    case 'trim':
      return commit(
        state,
        trimClip(state.present, action.clipId, action.edge, action.seconds, action.sourceDuration),
      );
    case 'split':
      return commit(state, splitClip(state.present, action.clipId, action.seconds));
    case 'remove':
      return commit(state, removeClip(state.present, action.clipId, action.ripple));
    case 'remove-asset-clips':
      return commit(state, removeClipsForAsset(state.present, action.assetId));
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        projectId: state.projectId,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        projectId: state.projectId,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
      };
    }
    default:
      return state;
  }
}

/**
 * Owns the timeline slice of the open project: a reducer over pure ops plus
 * undo/redo, kept in feature state per CLAUDE.md (no global store). Edits flow
 * one way — reducer → document → debounced autosave — while `useStudioProject`
 * keeps owning assets and settings, so the two never fight over the same field.
 */
export function useTimeline(
  project: StudioProject | null,
  updateProject: (updater: (prev: StudioProject) => StudioProject) => void,
) {
  const [state, dispatch] = useReducer(timelineReducer, {
    projectId: null,
    past: [],
    present: EMPTY_TIMELINE,
    future: [],
  });
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const projectId = project?.id ?? null;
  const projectRef = useRef(project);
  projectRef.current = project;

  // Adopt the document when a project opens — and ONLY then. Keying this on
  // project.timeline would re-reset (and wipe undo history) after every edit,
  // because this reducer is what writes that field back.
  useEffect(() => {
    const loaded = projectRef.current;
    if (projectId && loaded?.timeline) {
      dispatch({ type: 'reset', projectId, timeline: loaded.timeline });
    }
  }, [projectId]);

  const writtenRef = useRef<StudioTimeline | null>(null);
  useEffect(() => {
    if (!project || state.projectId !== project.id) return;
    // Right after `reset` the present IS the document's timeline — nothing to
    // write back, and writing would mark a freshly opened project dirty.
    if (state.present === project.timeline || state.present === writtenRef.current) return;
    writtenRef.current = state.present;
    const timeline = state.present;
    updateProject((prev) => ({ ...prev, timeline }));
  }, [state.present, state.projectId, project, updateProject]);

  const select = useCallback((clipId: string | null) => setSelectedClipId(clipId), []);

  const remove = useCallback((clipId: string, ripple: boolean) => {
    dispatch({ type: 'remove', clipId, ripple });
    setSelectedClipId((current) => (current === clipId ? null : current));
  }, []);

  return useMemo(
    () => ({
      timeline: state.projectId ? state.present : EMPTY_TIMELINE,
      dispatch,
      remove,
      selectedClipId,
      select,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
    }),
    [state, selectedClipId, select, remove],
  );
}

export type UseTimelineResult = ReturnType<typeof useTimeline>;
