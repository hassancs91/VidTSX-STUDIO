import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { masterLane, type CaptionTemplateDefaults } from '@shared/studio';
import type {
  StudioCaptionLayer,
  StudioCaptionStyle,
  StudioClip,
  StudioMediaAsset,
  StudioProject,
  StudioProposal,
  StudioShot,
  StudioTimeline,
  StudioTrackKind,
} from '../types';
import {
  applyCaptionTemplate,
  removeCaptions,
  setCaptionsEnabled,
  updateCaptionStyle,
} from '../services/caption-ops';
import {
  addClip,
  moveClip,
  removeClip,
  removeClipsForAsset,
  splitClip,
  trimClip,
} from '../services/timeline-ops';
import {
  detachAudio,
  setClipSpeed,
  updateClip,
  type ClipPatch,
} from '../services/clip-update-ops';
import {
  moveClips,
  pasteClips,
  removeClips,
  updateClips,
  type ClipboardEntry,
} from '../services/timeline-group-ops';
import {
  addTrack,
  moveTrack,
  removeTrack,
  renameTrack,
  setTrackFlag,
  type TrackFlag,
} from '../services/track-ops';
import { addMarker, moveMarker, removeMarker, renameMarker } from '../services/marker-ops';
import {
  removeClipsRippleAll,
  removeSpanAllTracks,
  removeSpanFromTrack,
  trimClipRippleAll,
} from '../services/ripple-ops';
import {
  isJoin,
  joinTarget,
  pruneTransitions,
  removeTransition,
  setTransition,
} from '../services/transition-ops';
import type { FilterCategory, StudioTransitionKind } from '../types';
import {
  removeClipEffect,
  setClipEffect,
  updateClipEffect,
  type EffectDefaults,
  type EffectParams,
} from '../services/effect-ops';
import { applyCutProposal } from '../services/apply-cut-proposal';
import { applyTextDelete, type TimelineSpan } from '../services/text-delete';
import { restoreDeletion } from '../services/text-restore';
import { applyInsertProposal } from '../services/apply-insert-proposal';
import { applyShotProposal, insertShotClip } from '../services/apply-shot-proposal';
import {
  addProposal,
  closeProposal,
  setProposalItemSpan,
  setProposalItemStatus,
} from '../services/proposal-ops';
import { removeClipsForShot, removeShot, setShotVersion } from '../services/shot-ops';

/** Undo depth. Edit documents are small (a 100-cut edit is a few KB), so
 *  whole-document snapshots are cheaper than maintaining inverse operations. */
const HISTORY_LIMIT = 100;

/**
 * The undoable slice of the project: the timeline, the proposals, the shot
 * registry (S4) AND the caption layer (D13). They share one history so
 * applying a proposal (timeline change + status change), deleting a shot
 * (registry entry + its clips) or restyling captions is a single Ctrl+Z step
 * that restores every side consistently.
 */
interface EditDoc {
  timeline: StudioTimeline;
  proposals: StudioProposal[];
  shots: StudioShot[];
  /** null = the project has no caption layer (the document field is absent). */
  captions: StudioCaptionLayer | null;
  /**
   * Media removed from the pool through `remove-asset`, as snapshots. Assets
   * stay owned by `useStudioProject` (proxy/transcript status lands there from
   * background jobs and must never be undone), so the undoable slice records
   * only WHICH assets are gone: the sync effect drops those from the project
   * and puts a snapshot back when an undo takes it off this list. Never
   * persisted — it is reducer state, reset on open.
   */
  removedAssets: RemovedAsset[];
}

/** A pool entry taken out by `remove-asset`: the snapshot and where it sat,
 *  so an undo puts it back in the same place (project.json stays identical). */
export interface RemovedAsset {
  asset: StudioMediaAsset;
  index: number;
}

export type TimelineAction =
  | {
      type: 'reset';
      projectId: string;
      timeline: StudioTimeline;
      proposals: StudioProposal[];
      shots: StudioShot[];
      captions: StudioCaptionLayer | null;
    }
  | { type: 'add'; trackId: string; clip: StudioClip; preferredStart?: number }
  | { type: 'move'; clipId: string; seconds: number; toTrackId?: string }
  | {
      type: 'trim';
      clipId: string;
      edge: 'start' | 'end';
      seconds: number;
      sourceDuration?: number;
      /** Ripple mode 'all': a master-lane trim moves every unlocked track (ripple-ops). */
      rippleAllTracks?: boolean;
    }
  | { type: 'split'; clipId: string; seconds: number }
  | { type: 'remove'; clipId: string; ripple: boolean }
  | { type: 'move-clips'; clipIds: string[]; deltaSeconds: number }
  // `allTracks` (with ripple): a deleted master-lane clip takes its time out
  // of every unlocked track; other lanes still ripple per track.
  | { type: 'remove-clips'; clipIds: string[]; ripple: boolean; allTracks?: boolean }
  // Range delete (I/O points + Delete): remove [from, to) from every unlocked
  // track, or from the master lane only when `allTracks` is false.
  | { type: 'remove-span'; from: number; to: number; allTracks: boolean }
  // Transcript panel (text-based editing): a text delete is N snapped spans in
  // ONE undo step; a restore re-opens the join between two master pieces.
  | { type: 'text-delete'; spans: TimelineSpan[]; allTracks: boolean }
  | { type: 'text-restore'; beforeClipId: string; afterClipId: string; newClipId: string; allTracks: boolean }
  // Ids are minted by the CALLER so it can select the new clips after
  // dispatch — the op itself is deterministic given them.
  | { type: 'paste'; entries: ClipboardEntry[]; atSeconds: number; newIds: string[] }
  // Inspector edits. The UI commits sliders on release (not per pixel), so
  // each of these is exactly one undo step.
  | { type: 'update-clip'; clipId: string; patch: ClipPatch }
  | { type: 'update-clips'; clipIds: string[]; patch: ClipPatch }
  | { type: 'clip-speed'; clipId: string; speed: number }
  // Id minted by the caller so it can select the new audio clip after dispatch.
  | { type: 'detach-audio'; clipId: string; newClipId: string }
  // Remove media from the pool WITH every clip playing it, one undo step (item
  // 6). The snapshot is what an undo restores; the file is never touched.
  | { type: 'remove-asset'; asset: StudioMediaAsset; index: number }
  // Markers (Slice D1). Add ids are minted by the caller, like paste.
  | { type: 'marker-add'; id: string; time: number; label?: string }
  | { type: 'marker-move'; markerId: string; time: number }
  | { type: 'marker-remove'; markerId: string }
  | { type: 'marker-rename'; markerId: string; label: string }
  // Transitions (Slice E) — on the LEADING clip of a contiguous boundary.
  | { type: 'transition-set'; clipId: string; kind: StudioTransitionKind; duration: number }
  | { type: 'transition-remove'; clipId: string }
  // Per-clip filters (FILTER_PACKS_DESIGN.md). `categories` is the installed
  // list's kind → category map, so the slot rule can tell which entry a card
  // replaces; `defaults` is the manifest entry's, for the neutral rule. Each
  // is one undo step for the whole selection; the Inspector's sliders
  // live-preview through an ephemeral override and commit once on release.
  | { type: 'clip-effect-set'; clipIds: string[]; kind: string; category: FilterCategory; categories: Readonly<Record<string, FilterCategory>> }
  | { type: 'clip-effect-update'; clipId: string; kind: string; params?: EffectParams; disabled?: boolean; defaults?: EffectDefaults }
  | { type: 'clip-effect-remove'; clipIds: string[]; kind: string }
  | { type: 'track-add'; kind: StudioTrackKind }
  | { type: 'track-rename'; trackId: string; name: string }
  | { type: 'track-move'; trackId: string; direction: -1 | 1 }
  | { type: 'track-remove'; trackId: string }
  | { type: 'track-flag'; trackId: string; flag: TrackFlag; value: boolean }
  | { type: 'proposal-add'; proposal: StudioProposal }
  | {
      type: 'proposal-item-status';
      proposalId: string;
      itemId: string;
      status: 'accepted' | 'rejected';
    }
  | {
      type: 'proposal-item-span';
      proposalId: string;
      itemId: string;
      sourceStart: number;
      sourceEnd: number;
    }
  | { type: 'proposal-apply'; proposalId: string; rippleAllTracks?: boolean }
  | { type: 'proposal-reject'; proposalId: string }
  // Shots (S4, D9). Undoable ops are exactly the user-meaningful ones; a
  // background generation finishing enters via 'shots-adopt' instead.
  | { type: 'shot-set-version'; shotId: string; version: number }
  | { type: 'shot-remove'; shotId: string }
  // Pool-button insert (D8): the clip lands at the playhead recorded when
  // Generate was clicked, as ONE undo step. Id minted by the caller so it can
  // select the new clip after dispatch.
  | { type: 'shot-clip-insert'; shot: StudioShot; preferredStart: number; newClipId: string }
  // Non-committing adopt: replaces the registry WITHOUT a history entry, and
  // rewrites past/future so undoing an unrelated edit can't resurrect a
  // pre-generation registry (a finishing shot must never plant an undo step
  // the user didn't perform, nor be wiped by one).
  | { type: 'shots-adopt'; shots: StudioShot[] }
  // Captions (D13). Each is exactly one undo step; the words themselves are
  // never stored — they re-derive from the timeline on every serialize.
  | { type: 'caption-apply'; templateId: string; seed?: CaptionTemplateDefaults }
  | { type: 'caption-style'; patch: Partial<StudioCaptionStyle> }
  | { type: 'caption-enabled'; enabled: boolean }
  | { type: 'caption-remove' }
  | { type: 'undo' }
  | { type: 'redo' };

interface HistoryState {
  projectId: string | null;
  past: EditDoc[];
  present: EditDoc;
  future: EditDoc[];
}

const EMPTY_DOC: EditDoc = {
  timeline: { tracks: [] },
  proposals: [],
  shots: [],
  captions: null,
  removedAssets: [],
};

function commit(state: HistoryState, next: EditDoc): HistoryState {
  // Ops return the same object when they reject an edit (locked track, illegal
  // split point, unknown proposal) — those must not create an undo step.
  if (
    next.timeline === state.present.timeline &&
    next.proposals === state.present.proposals &&
    next.shots === state.present.shots &&
    next.captions === state.present.captions &&
    next.removedAssets === state.present.removedAssets
  ) {
    return state;
  }
  return {
    projectId: state.projectId,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

/**
 * Adopt an op's timeline result, running the transition-validity prune. The
 * prune lives HERE (not in each op) so every action — including future ones —
 * drops a transition whose boundary an edit just broke, in the same undo step.
 * Identity is preserved end to end: a rejected op returns the same object,
 * prune returns it untouched, and the reducer skips the undo step.
 */
function withTimeline(doc: EditDoc, timeline: StudioTimeline): EditDoc {
  const pruned = pruneTransitions(timeline);
  return pruned === doc.timeline ? doc : { ...doc, timeline: pruned };
}

function withProposals(doc: EditDoc, proposals: StudioProposal[]): EditDoc {
  return proposals === doc.proposals ? doc : { ...doc, proposals };
}

export function timelineReducer(state: HistoryState, action: TimelineAction): HistoryState {
  const doc = state.present;
  switch (action.type) {
    case 'reset':
      return {
        projectId: action.projectId,
        past: [],
        present: {
          timeline: action.timeline,
          proposals: action.proposals,
          shots: action.shots,
          captions: action.captions,
          removedAssets: [],
        },
        future: [],
      };
    case 'add':
      return commit(
        state,
        withTimeline(
          doc,
          addClip(doc.timeline, action.trackId, action.clip, action.preferredStart ?? 0),
        ),
      );
    case 'move':
      return commit(
        state,
        withTimeline(doc, moveClip(doc.timeline, action.clipId, action.seconds, action.toTrackId)),
      );
    case 'trim':
      return commit(
        state,
        withTimeline(
          doc,
          (action.rippleAllTracks ? trimClipRippleAll : trimClip)(
            doc.timeline,
            action.clipId,
            action.edge,
            action.seconds,
            action.sourceDuration,
          ),
        ),
      );
    case 'split':
      return commit(state, withTimeline(doc, splitClip(doc.timeline, action.clipId, action.seconds)));
    case 'remove':
      return commit(state, withTimeline(doc, removeClip(doc.timeline, action.clipId, action.ripple)));
    case 'move-clips':
      return commit(
        state,
        withTimeline(doc, moveClips(doc.timeline, action.clipIds, action.deltaSeconds)),
      );
    case 'remove-clips':
      return commit(
        state,
        withTimeline(
          doc,
          action.ripple && action.allTracks
            ? removeClipsRippleAll(doc.timeline, action.clipIds)
            : removeClips(doc.timeline, action.clipIds, action.ripple),
        ),
      );
    case 'remove-span': {
      if (action.allTracks) {
        return commit(
          state,
          withTimeline(doc, removeSpanAllTracks(doc.timeline, action.from, action.to)),
        );
      }
      const master = masterLane(doc.timeline);
      if (!master) return state;
      return commit(
        state,
        withTimeline(doc, removeSpanFromTrack(doc.timeline, master.id, action.from, action.to)),
      );
    }
    case 'text-delete':
      return commit(
        state,
        withTimeline(
          doc,
          applyTextDelete(doc.timeline, action.spans, { rippleAllTracks: action.allTracks }),
        ),
      );
    case 'text-restore':
      return commit(
        state,
        withTimeline(
          doc,
          restoreDeletion(doc.timeline, action.beforeClipId, action.afterClipId, {
            rippleAllTracks: action.allTracks,
            newClipId: action.newClipId,
          }),
        ),
      );
    case 'paste':
      return commit(
        state,
        withTimeline(doc, pasteClips(doc.timeline, action.entries, action.atSeconds, action.newIds)),
      );
    case 'update-clip':
      return commit(
        state,
        withTimeline(doc, updateClip(doc.timeline, action.clipId, action.patch)),
      );
    case 'update-clips':
      return commit(
        state,
        withTimeline(doc, updateClips(doc.timeline, action.clipIds, action.patch)),
      );
    case 'clip-speed':
      return commit(
        state,
        withTimeline(doc, setClipSpeed(doc.timeline, action.clipId, action.speed)),
      );
    case 'detach-audio':
      return commit(
        state,
        withTimeline(doc, detachAudio(doc.timeline, action.clipId, action.newClipId)),
      );
    case 'remove-asset': {
      if (doc.removedAssets.some((r) => r.asset.id === action.asset.id)) return state;
      const next = withTimeline(doc, removeClipsForAsset(doc.timeline, action.asset.id));
      return commit(state, {
        ...next,
        removedAssets: [...doc.removedAssets, { asset: action.asset, index: action.index }],
      });
    }
    case 'marker-add':
      return commit(
        state,
        withTimeline(doc, addMarker(doc.timeline, action.id, action.time, action.label)),
      );
    case 'marker-move':
      return commit(
        state,
        withTimeline(doc, moveMarker(doc.timeline, action.markerId, action.time)),
      );
    case 'marker-remove':
      return commit(state, withTimeline(doc, removeMarker(doc.timeline, action.markerId)));
    case 'marker-rename':
      return commit(
        state,
        withTimeline(doc, renameMarker(doc.timeline, action.markerId, action.label)),
      );
    case 'transition-set':
      return commit(
        state,
        withTimeline(
          doc,
          setTransition(doc.timeline, action.clipId, action.kind, action.duration),
        ),
      );
    case 'transition-remove':
      return commit(state, withTimeline(doc, removeTransition(doc.timeline, action.clipId)));
    case 'clip-effect-set':
      return commit(
        state,
        withTimeline(
          doc,
          setClipEffect(doc.timeline, action.clipIds, action.kind, action.category, (kind) => action.categories[kind]),
        ),
      );
    case 'clip-effect-update':
      return commit(
        state,
        withTimeline(
          doc,
          updateClipEffect(
            doc.timeline,
            action.clipId,
            action.kind,
            { ...(action.params ? { params: action.params } : {}), ...(action.disabled !== undefined ? { disabled: action.disabled } : {}) },
            action.defaults,
          ),
        ),
      );
    case 'clip-effect-remove':
      return commit(state, withTimeline(doc, removeClipEffect(doc.timeline, action.clipIds, action.kind)));
    case 'track-add':
      return commit(state, withTimeline(doc, addTrack(doc.timeline, action.kind)));
    case 'track-rename':
      return commit(
        state,
        withTimeline(doc, renameTrack(doc.timeline, action.trackId, action.name)),
      );
    case 'track-move':
      return commit(
        state,
        withTimeline(doc, moveTrack(doc.timeline, action.trackId, action.direction)),
      );
    case 'track-remove':
      return commit(state, withTimeline(doc, removeTrack(doc.timeline, action.trackId)));
    case 'track-flag':
      return commit(
        state,
        withTimeline(doc, setTrackFlag(doc.timeline, action.trackId, action.flag, action.value)),
      );
    case 'proposal-add':
      return commit(state, withProposals(doc, addProposal(doc.proposals, action.proposal)));
    case 'proposal-item-status':
      return commit(
        state,
        withProposals(
          doc,
          setProposalItemStatus(doc.proposals, action.proposalId, action.itemId, action.status),
        ),
      );
    case 'proposal-item-span':
      return commit(
        state,
        withProposals(
          doc,
          setProposalItemSpan(
            doc.proposals,
            action.proposalId,
            action.itemId,
            action.sourceStart,
            action.sourceEnd,
          ),
        ),
      );
    case 'proposal-apply': {
      const proposal = doc.proposals.find((p) => p.id === action.proposalId);
      if (!proposal || proposal.status !== 'proposed') return state;
      const applyByKind =
        proposal.kind === 'shot-plan'
          ? applyShotProposal(doc.timeline, proposal, doc.shots)
          : proposal.kind === 'insert-plan'
            ? applyInsertProposal(doc.timeline, proposal)
            : applyCutProposal(doc.timeline, proposal, {
                rippleAllTracks: action.rippleAllTracks,
              });
      const timeline = pruneTransitions(applyByKind);
      const applied = timeline !== doc.timeline;
      const proposals = closeProposal(doc.proposals, action.proposalId, applied);
      // Spreading `doc` matters: a hand-built literal drops the fields this
      // action doesn't touch (it dropped `shots` once — D9, and `captions`
      // would go the same way).
      return commit(state, { ...doc, timeline, proposals });
    }
    case 'proposal-reject': {
      const proposal = doc.proposals.find((p) => p.id === action.proposalId);
      const proposals = closeProposal(doc.proposals, action.proposalId, false);
      if (proposals === doc.proposals) return state;
      // Rejecting a shot plan drops its registry entries too — files stay on
      // disk (no file deletion under any undoable action, D9); undo restores
      // the entries because disk was never touched.
      let shots = doc.shots;
      if (proposal?.kind === 'shot-plan') {
        const dropped = new Set(
          proposal.items.map((i) => i.shotId).filter((id): id is string => id !== undefined),
        );
        const filtered = doc.shots.filter((s) => !dropped.has(s.id));
        if (filtered.length !== doc.shots.length) shots = filtered;
      }
      return commit(state, { ...doc, proposals, shots });
    }
    case 'shot-set-version': {
      const shots = setShotVersion(doc.shots, action.shotId, action.version);
      return commit(state, shots === doc.shots ? doc : { ...doc, shots });
    }
    case 'shot-remove': {
      // Registry entry + every clip referencing it, one undo step. Files stay
      // on disk (no file deletion under any undoable action, D9).
      const shots = removeShot(doc.shots, action.shotId);
      if (shots === doc.shots) return state;
      const next = withTimeline(doc, removeClipsForShot(doc.timeline, action.shotId));
      return commit(state, { ...next, shots });
    }
    case 'shot-clip-insert':
      return commit(
        state,
        withTimeline(
          doc,
          insertShotClip(doc.timeline, action.shot, action.preferredStart, action.newClipId),
        ),
      );
    case 'caption-apply': {
      const captions = applyCaptionTemplate(doc.captions, action.templateId, action.seed);
      return commit(state, captions === doc.captions ? doc : { ...doc, captions });
    }
    case 'caption-style': {
      const captions = updateCaptionStyle(doc.captions, action.patch);
      return commit(state, captions === doc.captions ? doc : { ...doc, captions });
    }
    case 'caption-enabled': {
      const captions = setCaptionsEnabled(doc.captions, action.enabled);
      return commit(state, captions === doc.captions ? doc : { ...doc, captions });
    }
    case 'caption-remove': {
      const captions = removeCaptions(doc.captions);
      return commit(state, captions === doc.captions ? doc : { ...doc, captions });
    }
    case 'shots-adopt': {
      if (state.projectId === null) return state;
      const adopt = (entry: EditDoc): EditDoc => ({ ...entry, shots: action.shots });
      return {
        projectId: state.projectId,
        past: state.past.map(adopt),
        present: adopt(state.present),
        future: state.future.map(adopt),
      };
    }
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
 * Owns the undoable slice of the open project (timeline + proposals): a
 * reducer over pure ops plus undo/redo, kept in feature state per CLAUDE.md
 * (no global store). Edits flow one way — reducer → document → debounced
 * autosave — while `useStudioProject` keeps owning assets and settings, so
 * the two never fight over the same field.
 */
export function useTimeline(
  project: StudioProject | null,
  updateProject: (updater: (prev: StudioProject) => StudioProject) => void,
) {
  const [state, dispatch] = useReducer(timelineReducer, {
    projectId: null,
    past: [],
    present: EMPTY_DOC,
    future: [],
  });
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  // The "chosen" track: pool-adds land here when compatible, and the track
  // menu (rename/move/delete) acts on it. Null = let clip-factory pick.
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  // The join the user clicked (its LEADING clip's id) — the Transitions tab's
  // target. Selection, not document: never undoable, and it prunes itself
  // when the boundary stops being a join.
  const [selectedJoinId, setSelectedJoinId] = useState<string | null>(null);

  const projectId = project?.id ?? null;
  const projectRef = useRef(project);
  projectRef.current = project;

  // Adopt the document when a project opens — and ONLY then. Keying this on
  // project.timeline would re-reset (and wipe undo history) after every edit,
  // because this reducer is what writes that field back.
  useEffect(() => {
    const loaded = projectRef.current;
    if (projectId && loaded?.timeline) {
      dispatch({
        type: 'reset',
        projectId,
        timeline: loaded.timeline,
        proposals: loaded.proposals ?? [],
        shots: loaded.shots ?? [],
        captions: loaded.captions ?? null,
      });
    }
  }, [projectId]);

  const writtenRef = useRef<EditDoc | null>(null);
  useEffect(() => {
    if (!project || state.projectId !== project.id) return;
    // Right after `reset` the present IS the document — nothing to write
    // back, and writing would mark a freshly opened project dirty.
    const doc = state.present;
    if (doc === writtenRef.current) return;
    // Assets that left `removedAssets` since the last write (an undo) come
    // back from their snapshot; the ones on it stay out of the project.
    const removedIds = new Set(doc.removedAssets.map((r) => r.asset.id));
    const restore = (writtenRef.current?.removedAssets ?? []).filter((r) => !removedIds.has(r.asset.id));
    if (
      doc.timeline === project.timeline &&
      doc.proposals === project.proposals &&
      doc.shots === project.shots &&
      doc.captions === (project.captions ?? null) &&
      removedIds.size === 0 &&
      restore.length === 0
    ) {
      return;
    }
    writtenRef.current = doc;
    updateProject((prev) => {
      let assets = prev.assets;
      if (removedIds.size > 0 || restore.length > 0) {
        assets = prev.assets.filter((a) => !removedIds.has(a.id));
        // Earliest index first, so a multi-step undo re-seats each one where it was.
        for (const { asset, index } of [...restore].sort((a, b) => a.index - b.index)) {
          if (assets.some((a) => a.id === asset.id)) continue;
          assets = [...assets.slice(0, index), asset, ...assets.slice(index)];
        }
      }
      const next = {
        ...prev,
        assets,
        timeline: doc.timeline,
        proposals: doc.proposals,
        shots: doc.shots,
      };
      // Absent, not null: "no captions" is a MISSING field in project.json.
      if (doc.captions) next.captions = doc.captions;
      else delete next.captions;
      return next;
    });
  }, [state.present, state.projectId, project, updateProject]);

  /** Replace the selection with one clip (or clear it with null). */
  const select = useCallback((clipId: string | null) => {
    setSelectedClipIds(clipId ? [clipId] : []);
    setSelectedJoinId(null);
  }, []);
  /** Ctrl/⌘-click: add or remove one clip from the selection. */
  const toggleSelect = useCallback((clipId: string) => {
    setSelectedJoinId(null);
    setSelectedClipIds((current) =>
      current.includes(clipId) ? current.filter((id) => id !== clipId) : [...current, clipId],
    );
  }, []);
  /** Marquee / select-all: a whole set at once, optionally added to the current. */
  const selectMany = useCallback((clipIds: string[], additive: boolean) => {
    setSelectedJoinId(null);
    setSelectedClipIds((current) => {
      const base = additive ? current : [];
      const seen = new Set(base);
      return [...base, ...clipIds.filter((id) => !seen.has(id))];
    });
  }, []);
  const selectCut = useCallback((itemId: string | null) => setSelectedCutId(itemId), []);
  const selectTrack = useCallback((trackId: string | null) => setSelectedTrackId(trackId), []);
  /** Clicking a join makes it THE selection — a clip left selected would
   *  still take the Delete key. */
  const selectJoin = useCallback((clipId: string | null) => {
    setSelectedJoinId(clipId);
    if (clipId) setSelectedClipIds([]);
  }, []);

  // Prune ids whose clips left the document (delete, undo, apply-proposal…).
  useEffect(() => {
    const alive = new Set(
      state.present.timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)),
    );
    setSelectedClipIds((current) =>
      current.every((id) => alive.has(id)) ? current : current.filter((id) => alive.has(id)),
    );
    setSelectedTrackId((current) =>
      current && !state.present.timeline.tracks.some((t) => t.id === current) ? null : current,
    );
    setSelectedJoinId((current) =>
      current && !isJoin(state.present.timeline, current) ? null : current,
    );
  }, [state.present.timeline]);

  const remove = useCallback((clipId: string, ripple: boolean) => {
    dispatch({ type: 'remove', clipId, ripple });
  }, []);

  /** Batch delete of everything selected — one undo step. */
  const removeSelectedRef = useRef(selectedClipIds);
  removeSelectedRef.current = selectedClipIds;
  const removeSelected = useCallback((ripple: boolean, allTracks = false) => {
    if (removeSelectedRef.current.length === 0) return;
    dispatch({ type: 'remove-clips', clipIds: removeSelectedRef.current, ripple, allTracks });
  }, []);

  // The open proposal under review, if any. KIND-AGNOSTIC (D8 Rev 3): one
  // open proposal at a time across cut plans AND shot plans — two live
  // reviews, one scratch-applied to the preview, is a state nothing defines.
  const presentTimeline = state.present.timeline;
  const joinTargetId = useMemo(
    () => joinTarget(presentTimeline, selectedJoinId, selectedClipIds),
    [presentTimeline, selectedJoinId, selectedClipIds],
  );

  const activeProposal = useMemo(() => {
    const open = state.present.proposals.filter((p) => p.status === 'proposed');
    return open.length > 0 ? open[open.length - 1] : null;
  }, [state.present.proposals]);

  return useMemo(
    () => ({
      /** The project the reducer has adopted — null until the open's `reset` lands. */
      projectId: state.projectId,
      timeline: state.projectId ? state.present.timeline : EMPTY_DOC.timeline,
      proposals: state.projectId ? state.present.proposals : EMPTY_DOC.proposals,
      shots: state.projectId ? state.present.shots : EMPTY_DOC.shots,
      captions: state.projectId ? state.present.captions : EMPTY_DOC.captions,
      activeProposal,
      dispatch,
      remove,
      removeSelected,
      selectedClipIds,
      /** The single selection, when exactly one clip is selected. */
      selectedClipId: selectedClipIds.length === 1 ? selectedClipIds[0] : null,
      select,
      toggleSelect,
      selectMany,
      selectedCutId,
      selectCut,
      selectedTrackId,
      selectTrack,
      /** The clicked join (leading clip id), null when none. */
      selectedJoinId,
      selectJoin,
      /** What the Transitions tab acts on: the clicked join, else a single
       *  selected clip's out-join (`joinTarget`). */
      joinTargetId,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
    }),
    [
      state,
      selectedClipIds,
      select,
      toggleSelect,
      selectMany,
      selectedCutId,
      selectCut,
      selectedTrackId,
      selectTrack,
      selectedJoinId,
      selectJoin,
      joinTargetId,
      remove,
      removeSelected,
      activeProposal,
    ],
  );
}

export type UseTimelineResult = ReturnType<typeof useTimeline>;
