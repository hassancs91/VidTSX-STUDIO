// Transition catalog + pure helpers for the Studio Transitions tab and the
// composition that renders them.
//
// The data shapes live in `@shared/ipc/types` (StudioClipTransition) because
// the composition — shared by preview + headless render — reads them. This
// module owns the EDIT-TIME and RENDER-TIME concerns that don't belong in the
// type file: the tab's catalog metadata, default/clamp durations, the per-frame
// CSS for each transition, and the pure planner that decides which clips extend
// to sit beneath a neighbour's cross-fade. No React, no IPC — testable.

import type { CSSProperties } from 'react';
import type { StudioTransitionType } from '@shared/ipc/types';

// Default duration a transition starts at when first applied, plus the slider
// bounds the tab exposes. Half a second reads as a transition without eating
// much of a short clip.
export const DEFAULT_TRANSITION_DURATION_SECONDS = 0.5;
export const MIN_TRANSITION_DURATION_SECONDS = 0.1;
export const MAX_TRANSITION_DURATION_SECONDS = 3;

export interface TransitionDefinition {
  type: StudioTransitionType;
  label: string;
  description: string;
}

// The five foundational transitions, in display order.
export const TRANSITION_DEFINITIONS: TransitionDefinition[] = [
  {
    type: 'fade',
    label: 'Fade',
    description: 'Cross-dissolve — the clip fades up over the previous one (or from black).',
  },
  {
    type: 'slide',
    label: 'Slide',
    description: 'The clip slides in from the edge of the frame.',
  },
  {
    type: 'wipe',
    label: 'Wipe',
    description: 'The clip is revealed left-to-right behind a moving edge.',
  },
  {
    type: 'zoom',
    label: 'Zoom',
    description: 'The clip scales up into place while fading in.',
  },
  {
    type: 'flip',
    label: 'Flip',
    description: 'A 3D card flip swings the clip into view.',
  },
];

export function getTransitionDefinition(type: StudioTransitionType): TransitionDefinition {
  // Non-null: TRANSITION_DEFINITIONS covers every StudioTransitionType.
  return TRANSITION_DEFINITIONS.find((d) => d.type === type)!;
}

// Compute the CSS for one transition at a given "presence" p (0 = fully
// entered/exited pose, 1 = fully present/identity). `dir` flips directional
// transitions ('in' enters from one side, 'out' exits toward the other) so a
// slide-out mirrors a slide-in rather than reversing it.
//
// Used identically for the entrance window (p ramps 0→1) and the exit window
// (p ramps 1→0), so a single pure function covers both edges.
export function transitionLayerStyle(
  type: StudioTransitionType,
  p: number,
  dir: 'in' | 'out'
): CSSProperties {
  const clamped = Math.max(0, Math.min(1, p));
  const gone = 1 - clamped; // 1 = off-screen/invisible pose, 0 = identity
  switch (type) {
    case 'fade':
      return { opacity: clamped };
    case 'slide': {
      // 'in' enters from the right edge; 'out' exits toward the left.
      const sign = dir === 'in' ? 1 : -1;
      return { transform: `translateX(${sign * gone * 100}%)` };
    }
    case 'wipe':
      // Reveal from the left: a right-side inset shrinks from 100%→0 as p→1.
      return { clipPath: `inset(0 ${gone * 100}% 0 0)` };
    case 'zoom':
      return { transform: `scale(${0.6 + 0.4 * clamped})`, opacity: clamped };
    case 'flip':
      return {
        transform: `perspective(1200px) rotateY(${gone * 90}deg)`,
        opacity: clamped,
        backfaceVisibility: 'hidden',
      };
    default:
      return {};
  }
}

// ─── Render planner ───
// Decides, for each video clip, the Sequence duration to render and which
// transition windows animate. The key trick: when clip B has a `transitionIn`
// and the previous clip A abuts it, A's Sequence is EXTENDED forward by B's
// transition length so A keeps playing underneath while B animates in on top
// (a true cross-fade). No clip's data or the timeline length changes — the
// extension only overlaps into B's existing span.

export interface TransitionPlanClip {
  id: string;
  startFrame: number;
  durationInFrames: number;
  transitionIn?: { type: StudioTransitionType; durationInFrames: number };
  transitionOut?: { type: StudioTransitionType; durationInFrames: number };
}

export interface PlannedTransition {
  type: StudioTransitionType;
  frames: number;
}

export interface PlannedClip {
  id: string;
  // Sequence duration to render — the clip's own duration, possibly extended so
  // it underlaps the NEXT clip's entrance transition.
  renderDurationInFrames: number;
  // The clip's intrinsic (unextended) duration — the window the OUT transition
  // is anchored to (it plays over the clip's true last frames).
  baseDurationInFrames: number;
  transitionIn?: PlannedTransition;
  transitionOut?: PlannedTransition;
}

// ~1 frame of slack absorbs rounding when checking whether two clips abut.
const CONTIGUOUS_EPSILON_FRAMES = 1;

function isContiguous(a: TransitionPlanClip, b: TransitionPlanClip): boolean {
  return Math.abs(b.startFrame - (a.startFrame + a.durationInFrames)) <= CONTIGUOUS_EPSILON_FRAMES;
}

function clampFrames(frames: number | undefined, maxDuration: number): number {
  if (!frames || frames <= 0) return 0;
  return Math.max(1, Math.min(Math.round(frames), maxDuration));
}

export function planVideoTransitions(clips: TransitionPlanClip[]): Map<string, PlannedClip> {
  const sorted = [...clips].sort((a, b) => a.startFrame - b.startFrame);
  const plan = new Map<string, PlannedClip>();

  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i];
    const next = sorted[i + 1];
    const nextContiguous = next && isContiguous(clip, next);

    const inFrames = clampFrames(clip.transitionIn?.durationInFrames, clip.durationInFrames);
    let outFrames = clampFrames(clip.transitionOut?.durationInFrames, clip.durationInFrames);

    // The next clip's entrance owns the shared seam. If it has a transitionIn,
    // suppress THIS clip's out at that seam so they don't fight (the cross-fade
    // is expressed once, by the incoming side).
    const nextInFrames = nextContiguous
      ? clampFrames(next!.transitionIn?.durationInFrames, next!.durationInFrames)
      : 0;
    if (nextInFrames > 0) outFrames = 0;

    // Extend this clip forward so it plays beneath the next clip's entrance.
    const renderDurationInFrames = clip.durationInFrames + nextInFrames;

    plan.set(clip.id, {
      id: clip.id,
      renderDurationInFrames,
      baseDurationInFrames: clip.durationInFrames,
      transitionIn:
        inFrames > 0 && clip.transitionIn
          ? { type: clip.transitionIn.type, frames: inFrames }
          : undefined,
      transitionOut:
        outFrames > 0 && clip.transitionOut
          ? { type: clip.transitionOut.type, frames: outFrames }
          : undefined,
    });
  }

  return plan;
}
