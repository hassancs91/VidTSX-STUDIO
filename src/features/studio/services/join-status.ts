// What a join shows (docs/studio/TRANSITION_PACKS_DESIGN.md "UI"): the
// transition's name, how long it really plays, and the two warning states —
// a pack that isn't installed (it plays as a crossfade) and not enough media
// (it plays as a hard cut). Pure. The length comes from the serializer's own
// handle math, so a warning can never disagree with what renders.

import { transitionSpanFrames } from '@shared/studio/serialize';
import { isNativeTransitionKind } from '@shared/studio/transition-windows';
import type { StudioClip, StudioClipKind, StudioMediaAsset, StudioTimeline } from '../types';
import { clipEndTime } from './timeline-ops';
import { contiguousNext } from './transition-ops';

export type JoinWarning = 'hard-cut' | 'not-installed';

export const JOIN_WARNING_TEXT: Record<JoinWarning, string> = {
  'hard-cut':
    'Not enough media: neither clip has footage past the cut, so this plays as a hard cut. Trim the clips to leave room.',
  'not-installed':
    'Its pack isn’t installed, so this plays as a crossfade. It comes back when the pack is reinstalled.',
};

const NATIVE_NAMES: Record<string, string> = { crossfade: 'Crossfade', 'dip-to-black': 'Dip to black' };

/** Clips a transition component can be handed a picture of. */
const PICTURE_KINDS: ReadonlySet<StudioClipKind> = new Set(['video', 'image', 'tsx']);

export interface JoinStatus {
  kind: string;
  name: string;
  /** The length the document asks for. */
  seconds: number;
  /** What actually plays once handles are clamped; 0 = a hard cut. */
  playsSeconds: number;
  /** Plays, but shorter than asked (one side has too little media). More
   *  than a frame short, so rounding at the cut never trips it. */
  short: boolean;
  warning?: JoinWarning;
}

/**
 * Display name for a kind. `installed` maps installed pack kinds to their
 * names; an unknown kind shows its id, so the user can tell which pack to get.
 */
export function transitionName(kind: string, installed: ReadonlyMap<string, string> | null): string {
  return NATIVE_NAMES[kind] ?? installed?.get(kind) ?? kind;
}

/**
 * Status of every join that has a transition, keyed by the LEADING clip's id.
 * `installed` is null while the pack list is still loading, which suppresses
 * the not-installed warning rather than flashing it on every open.
 */
export function joinStatuses(
  timeline: StudioTimeline,
  fps: number,
  sourceDurationOf: (assetId: string) => number | undefined,
  installed: ReadonlyMap<string, string> | null,
): Map<string, JoinStatus> {
  const out = new Map<string, JoinStatus>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const transition = clip.transitionOut;
      if (!transition) continue;
      const next = contiguousNext(track.clips, clip);
      if (!next) continue;
      const frames = transitionSpanFrames(clip, next, fps, sourceDurationOf);
      const status: JoinStatus = {
        kind: transition.kind,
        name: transitionName(transition.kind, installed),
        seconds: transition.duration,
        playsSeconds: frames / fps,
        short: frames > 0 && frames < Math.round(transition.duration * fps) - 1,
      };
      if (frames === 0) status.warning = 'hard-cut';
      else if (installed && !isNativeTransitionKind(transition.kind) && !installed.has(transition.kind)) {
        status.warning = 'not-installed';
      }
      out.set(clip.id, status);
    }
  }
  return out;
}

/** The join the Transitions tab edits, described for its header. */
export interface JoinTargetInfo {
  leadId: string;
  leadLabel: string;
  trailLabel: string;
  /** Where the cut sits, in timeline seconds. */
  at: number;
  /** Both sides paint a picture. A pack transition on a sound-only join
   *  plays as a crossfade, so the tab offers only the native two there. */
  pictureJoin: boolean;
  /** The longest transition the pair takes (`setTransition` clamps to both clips). */
  maxSeconds: number;
  /** Null when the join has no transition yet. */
  status: JoinStatus | null;
}

/** A clip's name as the timeline shows it: its label, else the file name, else its kind. */
export function clipDisplayName(clip: StudioClip, assetsById: ReadonlyMap<string, StudioMediaAsset>): string {
  if (clip.label) return clip.label;
  const asset = clip.assetId ? assetsById.get(clip.assetId) : undefined;
  if (asset) return asset.path.split(/[\\/]/).pop() ?? asset.path;
  return clip.kind;
}

export function describeJoin(
  timeline: StudioTimeline,
  leadId: string | null,
  statuses: ReadonlyMap<string, JoinStatus>,
  assetsById: ReadonlyMap<string, StudioMediaAsset>,
): JoinTargetInfo | null {
  if (!leadId) return null;
  for (const track of timeline.tracks) {
    const lead = track.clips.find((c) => c.id === leadId);
    if (!lead) continue;
    const trail = contiguousNext(track.clips, lead);
    if (!trail) return null;
    return {
      leadId,
      leadLabel: clipDisplayName(lead, assetsById),
      trailLabel: clipDisplayName(trail, assetsById),
      at: clipEndTime(lead),
      pictureJoin: PICTURE_KINDS.has(lead.kind) && PICTURE_KINDS.has(trail.kind),
      maxSeconds: Math.min(lead.duration, trail.duration),
      status: statuses.get(leadId) ?? null,
    };
  }
  return null;
}
